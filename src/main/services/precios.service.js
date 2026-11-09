import * as preciosRepo from '../repositories/precios.repo.js'
import * as tiposPrecioRepo from '../repositories/tiposPrecio.repo.js'
import * as productosRepo from '../repositories/productos.repo.js'
import * as tasasRepo from '../repositories/tasas.repo.js'
import { redondear2 } from './precios.calculo.js'
import { normalizarMargenes } from './precios.validation.js'

// Los precios se calculan del costo × margen y se materializan al registrar
// entradas o al editar el producto (ver inventario.service). Acá queda la
// lectura, el cálculo con tasas vigentes y el CRUD de los tipos de precio.

export function listarPrecios(opciones) {
  return preciosRepo.listar(opciones)
}

// Todos los tipos activos del producto con su único margen efectivo. Se
// conserva el equivalente USDT en el contrato interno por compatibilidad.
//   [{ id, tipoPrecioId, tipoPrecioNombre, tipoPrecioOrden, margen, margenUsdt,
//      margenOrigen, margenUsdtOrigen: 'propio'|'default',
//      precioUsd, precioBs, precioUsdt }]
// `id` es el id de la fila en precios (null si el producto todavía no tiene
// precio materializado para ese tipo). Sin tasa vigente, Bs/USDT van en null.
export function listarPreciosPorProducto(productoId) {
  const producto = productosRepo.buscarPorId(productoId)
  if (!producto) throw new Error('El producto no existe')
  const costo = producto.precio_compra_usd
  const tasa = tasasRepo.obtenerUltimaTasa()

  const filas = preciosRepo.listarTiposConMargen(productoId)

  // Materializa al vuelo los precios de tipos sin fila (o con fila
  // desactivada) cuando el producto tiene costo: un tipo creado después de
  // la última entrada queda vendible de inmediato — su precio ya estaba
  // definido por el margen efectivo, solo faltaba la fila en `precios`.
  // El margen propio se conserva; si no hay, queda NULL (hereda el default).
  if (costo != null) {
    for (const fila of filas) {
      if (fila.precio_id != null && fila.precio_activo !== 0) continue
      const margenEfectivo = fila.margen ?? fila.margen_default
      const valorUsd = redondear2(costo * (1 + margenEfectivo / 100))
      fila.precio_id = preciosRepo.upsertPrecio(productoId, {
        tipoPrecioId: fila.tipo_precio_id,
        margen: fila.margen ?? null,
        margenUsdt: fila.margen ?? null,
        valorUsd,
        valorUsdt: valorUsd
      })
      fila.valor_usd = valorUsd
      fila.valor_usdt = valorUsd
    }
  }

  return filas.map((fila) => ({
    id: fila.precio_id,
    tipoPrecioId: fila.tipo_precio_id,
    tipoPrecioNombre: fila.tipo_precio_nombre,
    tipoPrecioOrden: fila.tipo_precio_orden,
    ...calcularFila(fila, costo, tasa)
  }))
}

// Resuelve los márgenes efectivos y los tres montos de una fila
// producto×tipo. Solo valor_usd es autoritativo; valor_usdt/margen_usdt se
// mantienen en la BD para compatibilidad sin modificar inventarios existentes.
// Sin tasa vigente, Bs/USDT van en null.
function calcularFila(fila, costo, tasa) {
  const propio = fila.margen != null
  const margen = propio ? fila.margen : fila.margen_default
  let precioUsd
  if (fila.valor_usd != null) {
    precioUsd = fila.valor_usd
  } else if (costo != null) {
    precioUsd = redondear2(costo * (1 + margen / 100))
  } else {
    precioUsd = null
  }
  let precioBs = null
  let precioUsdt = null
  if (tasa) {
    const bcv = Number(tasa.valor_bcv)
    const usdt = Number(tasa.valor_usdt)
    if (precioUsd != null && bcv > 0) precioBs = redondear2(precioUsd * bcv)
    if (precioUsd != null && bcv > 0 && usdt > 0) {
      precioUsdt = redondear2(redondear2(precioUsd * bcv) / usdt)
    }
  }
  return {
    margen,
    margenUsdt: margen,
    margenOrigen: propio ? 'propio' : 'default',
    margenUsdtOrigen: propio ? 'propio' : 'default',
    precioUsd,
    precioBs,
    precioUsdt
  }
}

// Todos los productos × tipos activos con sus precios calculados, en una
// sola consulta. Alimenta las columnas de precios del catálogo de
// Inventario sin hacer una llamada por producto:
//   [{ productoId, tipoPrecioId, tipoPrecioNombre, tipoPrecioOrden,
//      margen, margenOrigen, precioUsd, precioBs, precioUsdt }]
export function listarPreciosCatalogo() {
  const tasa = tasasRepo.obtenerUltimaTasa()
  return preciosRepo.listarCatalogoTiposConMargen().map((fila) => ({
    productoId: fila.producto_id,
    tipoPrecioId: fila.tipo_precio_id,
    tipoPrecioNombre: fila.tipo_precio_nombre,
    tipoPrecioOrden: fila.tipo_precio_orden,
    ...calcularFila(fila, fila.precio_compra_usd, tasa)
  }))
}

// Aplica el margen único a cada tipo activo dentro de la transacción de
// entrada o edición. Las columnas legadas se sincronizan al editar, sin
// recorrer ni reescribir productos anteriores.
//
// Si `costoUsd` es null (producto sin costo registrado) solo se actualizan
// los márgenes de las filas existentes: no se pueden materializar precios
// sin costo. Las filas de tipos inactivos quedan desactivadas.
export function aplicarMargenesDeProducto(productoId, costoUsd, margenesRaw) {
  const margenes = normalizarMargenes(margenesRaw) ?? []
  const enviados = new Map(margenes.map((m) => [m.tipoPrecioId, m]))

  const tipos = tiposPrecioRepo.listarActivos()
  const activos = new Set(tipos.map((t) => t.id))
  for (const tipoPrecioId of enviados.keys()) {
    if (activos.has(tipoPrecioId)) continue
    const tipo = tiposPrecioRepo.buscarPorId(tipoPrecioId)
    if (!tipo) throw new Error('Uno de los tipos de precio indicados no existe')
    throw new Error(`El tipo de precio "${tipo.nombre}" está inactivo`)
  }

  const conPrecio = preciosRepo.listarTiposConMargen(productoId)
  const filaPorTipo = new Map(conPrecio.map((f) => [f.tipo_precio_id, f]))

  for (const tipo of tipos) {
    const enviado = enviados.get(tipo.id)
    const margen = enviado ? enviado.margen : tipo.margen_default
    if (costoUsd != null) {
      const valorUsd = redondear2(costoUsd * (1 + margen / 100))
      preciosRepo.upsertPrecio(productoId, {
        tipoPrecioId: tipo.id,
        margen,
        margenUsdt: margen,
        valorUsd,
        valorUsdt: valorUsd
      })
    } else if (filaPorTipo.has(tipo.id)) {
      preciosRepo.actualizarMargen(productoId, tipo.id, margen, margen)
    }
  }
  preciosRepo.desactivarDeTiposInactivos(productoId)
}

// Recalcula valor_usd/valor_usdt materializados con el costo vigente y los
// márgenes YA guardados en `precios` (no toca margen ni margen_usdt). Se usa
// cuando el costo cambia sin que el usuario re-edite márgenes — p. ej. al
// anular la entrada que definía el costo. Con costo null no hay base nueva:
// las filas conservan su último valor materializado (igual que
// aplicarMargenesDeProducto, que tampoco materializa sin costo).
export function rematerializarPrecios(productoId, costoUsd) {
  if (costoUsd == null) return
  const filas = preciosRepo.listarTiposConMargen(productoId)
  for (const fila of filas) {
    if (fila.precio_id == null) continue
    const margen = fila.margen ?? fila.margen_default
    const valorUsd = redondear2(costoUsd * (1 + margen / 100))
    preciosRepo.actualizarValores(
      fila.precio_id,
      valorUsd,
      valorUsd
    )
  }
}

export function listarTiposPrecio() {
  return tiposPrecioRepo.listar()
}

function traducirErrorTipo(error) {
  if (/UNIQUE constraint failed: tipos_precio\.nombre/.test(error.message)) {
    return new Error('Ya existe un tipo de precio con ese nombre')
  }
  return error
}

function normalizarTipo({ nombre, orden, margenDefault, activo }) {
  const limpio = (nombre || '').trim()
  if (!limpio) throw new Error('El nombre del tipo de precio es obligatorio')
  const num = Number(orden)
  const margen = Number(margenDefault)
  return {
    nombre: limpio,
    orden: Number.isInteger(num) && num > 0 ? num : null,
    margenDefault: Number.isFinite(margen) && margen >= 0 ? margen : null,
    activo: activo === undefined ? null : activo ? 1 : 0
  }
}

export function crearTipoPrecio(datos) {
  const tipo = normalizarTipo(datos)
  try {
    return tiposPrecioRepo.crear({
      nombre: tipo.nombre,
      orden: tipo.orden ?? tiposPrecioRepo.siguienteOrden(),
      margenDefault: tipo.margenDefault ?? 100
    })
  } catch (error) {
    throw traducirErrorTipo(error)
  }
}

export function actualizarTipoPrecio(id, datos) {
  const existente = tiposPrecioRepo.buscarPorId(id)
  if (!existente) throw new Error('El tipo de precio no existe')
  const tipo = normalizarTipo(datos)
  const margenDefault = tipo.margenDefault ?? existente.margen_default
  try {
    const actualizado = tiposPrecioRepo.actualizar(id, {
      nombre: tipo.nombre,
      orden: tipo.orden ?? existente.orden,
      margenDefault,
      activo: tipo.activo ?? existente.activo
    })
    // Los productos sin margen propio heredan el nuevo default: se
    // rematerializan sus valor_usd con el costo que tengan registrado.
    if (margenDefault !== existente.margen_default) {
      preciosRepo.recalcularValorUsdDefault(id, margenDefault)
    }
    return actualizado
  } catch (error) {
    throw traducirErrorTipo(error)
  }
}

// Un tipo con uso (precios o ventas, que referencian filas de precios) no se
// borra: se desactiva para no romper el histórico. Si nunca se usó, se borra.
export function eliminarTipoPrecio(id) {
  if (!tiposPrecioRepo.buscarPorId(id)) throw new Error('El tipo de precio no existe')
  if (tiposPrecioRepo.tienePrecios(id)) {
    return tiposPrecioRepo.desactivar(id)
  }
  tiposPrecioRepo.eliminar(id)
  return { eliminado: true }
}
