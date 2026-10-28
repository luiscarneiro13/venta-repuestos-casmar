import * as preciosRepo from '../repositories/precios.repo.js'
import * as tiposPrecioRepo from '../repositories/tiposPrecio.repo.js'
import * as productosRepo from '../repositories/productos.repo.js'
import * as tasasRepo from '../repositories/tasas.repo.js'
import { calcularPrecios, redondear2 } from './precios.calculo.js'
import { normalizarMargenes } from './precios.validation.js'

// Los precios se calculan del costo × margen y se materializan al registrar
// entradas o al editar el producto (ver inventario.service). Acá queda la
// lectura, el cálculo con tasas vigentes y el CRUD de los tipos de precio.

export function listarPrecios(opciones) {
  return preciosRepo.listar(opciones)
}

// Todos los tipos de precio activos del producto con su margen efectivo y el
// precio calculado en las tres monedas con la tasa vigente:
//   [{ id, tipoPrecioId, tipoPrecioNombre, tipoPrecioOrden, margen,
//      margenOrigen: 'propio'|'default', precioUsd, precioBs, precioUsdt }]
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
        valorUsd
      })
      fila.valor_usd = valorUsd
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

// Resuelve el margen efectivo y los tres montos de una fila
// producto×tipo. Si existe la fila, valor_usd es el materializado
// autoritativo; si no, se calcula al vuelo con el margen efectivo
// (producto sin entrada aún). Sin tasa vigente, Bs/USDT van en null.
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
  if (precioUsd != null && tasa) {
    const calculado = calcularPrecios(precioUsd, 0, tasa.valor_bcv, tasa.valor_usdt)
    precioBs = calculado.precioBs
    precioUsdt = calculado.precioUsdt
  }
  return { margen, margenOrigen: propio ? 'propio' : 'default', precioUsd, precioBs, precioUsdt }
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

// Aplica la tabla de márgenes a un producto dentro de la transacción de quien
// llama (entrada de mercancía o edición de producto). Por cada tipo ACTIVO se
// guarda margen propio = el enviado, o el margen_default del tipo si no vino,
// y se materializa valor_usd = round2(costo × (1 + margen/100)).
//
// Si `costoUsd` es null (producto sin costo registrado) solo se actualiza el
// margen de las filas existentes: no se pueden materializar precios sin costo.
// Las filas de tipos inactivos quedan desactivadas.
export function aplicarMargenesDeProducto(productoId, costoUsd, margenesRaw) {
  const margenes = normalizarMargenes(margenesRaw) ?? []
  const enviados = new Map(margenes.map((m) => [m.tipoPrecioId, m.margen]))

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
    const margen = enviados.has(tipo.id) ? enviados.get(tipo.id) : tipo.margen_default
    if (costoUsd != null) {
      preciosRepo.upsertPrecio(productoId, {
        tipoPrecioId: tipo.id,
        margen,
        valorUsd: redondear2(costoUsd * (1 + margen / 100))
      })
    } else if (filaPorTipo.has(tipo.id)) {
      preciosRepo.actualizarMargen(productoId, tipo.id, margen)
    }
  }
  preciosRepo.desactivarDeTiposInactivos(productoId)
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
