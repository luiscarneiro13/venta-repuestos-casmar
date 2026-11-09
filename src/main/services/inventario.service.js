import { getDb } from '../db/connection.js'
import { actorActual } from './auth.service.js'
import * as inventarioRepo from '../repositories/inventario.repo.js'
import * as productosRepo from '../repositories/productos.repo.js'
import * as preciosRepo from '../repositories/precios.repo.js'
import * as proveedoresRepo from '../repositories/proveedores.repo.js'
import * as tasasRepo from '../repositories/tasas.repo.js'
import { normalizarPrecios } from './precios.validation.js'
import { aplicarMargenesDeProducto, rematerializarPrecios } from './precios.service.js'

function validarCantidad(cantidad) {
  const num = Number(cantidad)
  if (!num || num <= 0 || !Number.isInteger(num)) throw new Error('La cantidad debe ser un entero mayor a 0')
  return num
}

function productoExistente(productoId) {
  const producto = productosRepo.buscarPorId(productoId)
  if (!producto) throw new Error('El producto no existe')
  return producto
}

// Resumen general (productos activos, unidades en stock, sin stock).
export function resumenInventario() {
  return inventarioRepo.resumen()
}

// Datos crudos de los reportes de inventario + la tasa BCV vigente para
// valorizar en Bs. El agrupado/filtrado lo hace shared/reporte.inventario.js.
export function datosReporteInventario() {
  const tasa = tasasRepo.obtenerUltimaTasa()
  return {
    productos: inventarioRepo.reporteProductos(),
    tasaBcv: Number(tasa?.valor_bcv ?? tasa?.valor) || null
  }
}

// Devuelve el estado del inventario de un producto: saldo actual y movimientos.
export function estadoProducto(productoId) {
  productoExistente(productoId)
  return {
    saldo: inventarioRepo.saldoActual(productoId),
    movimientos: inventarioRepo.listarMovimientos(productoId)
  }
}

export function listarMovimientosInventario() {
  return inventarioRepo.listarTodosLosMovimientos()
}

// Registra una entrada de mercancía (compra, devolución de proveedor, etc.).
//
// Recibe `margenes`: [{ tipoPrecioId, margen }] con el % de utilidad por tipo
// de precio (tal como se ve en la tabla del modal). En una sola transacción
// se actualiza el costo del producto, se materializan los precios de todos
// los tipos activos (margen enviado o margen_default si no vino) y se guarda
// el movimiento con el costo de la compra.
//
// Compatibilidad con la firma vieja mínima: sin costo ni márgenes solo se
// registra el movimiento (entradas iniciales creadas desde Productos), y un
// payload viejo con `precios` fijos sigue el flujo anterior.
export function registrarEntrada({ productoId, cantidad, motivo, usuarioId, precioCompraUsd, precios, margenes, proveedorId, costoConIva }) {
  productoExistente(productoId)
  if (!usuarioId) throw new Error('Falta el usuario que registra la entrada')
  const unidades = validarCantidad(cantidad)
  // Las entradas iniciales creadas desde Productos no modifican costo ni precios.
  if (precios === undefined && margenes === undefined && precioCompraUsd === undefined) {
    return inventarioRepo.registrarEntrada({
      productoId, cantidad: unidades, motivo: (motivo || '').trim() || 'Ingreso de mercancía', usuarioId
    })
  }
  const costo = Number(precioCompraUsd)
  if (precioCompraUsd == null || precioCompraUsd === '' || !Number.isFinite(costo) || costo <= 0) {
    throw new Error('El precio de compra debe ser mayor a 0')
  }
  const proveedor = proveedoresRepo.buscarPorId(proveedorId)
  if (!proveedor || !proveedor.activo) throw new Error('Selecciona un proveedor activo')
  const nota = (motivo || '').trim() || 'Ingreso de mercancía'
  // El costo puede venir del proveedor con el IVA ya incluido: el flag se
  // guarda en la entrada y queda vigente en el producto (ver migración 027).
  const conIva = costoConIva ? 1 : 0

  // Payload legado con precios fijos (renderer anterior al modelo de márgenes).
  if (precios !== undefined) {
    const preciosValidados = normalizarPrecios(precios)
    return getDb().transaction(() => {
      productosRepo.actualizarPrecioCompra(productoId, costo, conIva)
      preciosRepo.reemplazarDeProducto(productoId, preciosValidados)
      return inventarioRepo.registrarEntrada({
        productoId, cantidad: unidades, motivo: nota, usuarioId, proveedorId: proveedor.id, costoUsd: costo, costoConIva: conIva
      })
    })()
  }

  return getDb().transaction(() => {
    productosRepo.actualizarPrecioCompra(productoId, costo, conIva)
    // Recalcula el valor_usd de TODOS los tipos activos con su margen
    // efectivo y desactiva las filas de tipos que quedaron inactivos.
    aplicarMargenesDeProducto(productoId, costo, margenes)
    return inventarioRepo.registrarEntrada({
      productoId, cantidad: unidades, motivo: nota, usuarioId, proveedorId: proveedor.id, costoUsd: costo, costoConIva: conIva
    })
  })()
}

// Registra una salida manual (ajuste por daño, pérdida, garantía...). No
// puede dejar el stock en negativo.
export function registrarAjusteSalida({ productoId, cantidad, motivo, usuarioId }) {
  productoExistente(productoId)
  if (!usuarioId) throw new Error('Falta el usuario que registra el ajuste')
  const num = validarCantidad(cantidad)
  const nota = (motivo || '').trim()
  if (!nota) throw new Error('Indica el motivo del ajuste')
  const stock = inventarioRepo.saldoActual(productoId)
  if (num > stock) throw new Error(`No hay stock suficiente: disponible ${stock}`)
  return inventarioRepo.registrarSalida({ productoId, cantidad: num, motivo: `Ajuste: ${nota}`, usuarioId })
}

// Edita una entrada de mercancía completa: cantidad (el saldo se corrige
// solo, desplazando los movimientos posteriores), nota, proveedor, costo de
// compra y márgenes por tipo de precio — todo lo que pudo equivocarse al
// registrarla. Previsiones:
// - El costo del producto es el de su ÚLTIMA entrada con costo: solo se
//   actualiza (y rematerializa precios) si la entrada editada es esa; una
//   entrada vieja no pisa el costo que vino después.
// - Los % se guardan con el costo vigente del producto tras la corrección.
// - Las devoluciones por anulación (venta_id o motivo "Anulación …") solo
//   corrigen cantidad/nota: la venta anulada no cambia.
// - Bajar una cantidad no puede dejar el inventario en negativo.
export function editarMovimientoInventario({ id, cantidad, motivo, proveedorId, precioCompraUsd, margenes, costoConIva }) {
  const num = validarCantidad(cantidad)
  const mov = inventarioRepo.obtenerMovimiento(id)
  if (!mov) throw new Error('Movimiento no encontrado')
  if (mov.tipo !== 'entrada') throw new Error('Solo se pueden editar entradas')
  if (mov.anulada) throw new Error('No se puede editar una entrada anulada')
  const esDevolucion = Boolean(mov.venta_id) || (mov.motivo || '').startsWith('Anulación')

  let proveedorFinal = mov.proveedor_id
  if (!esDevolucion && proveedorId !== undefined && proveedorId !== null) {
    const proveedor = proveedoresRepo.buscarPorId(proveedorId)
    if (!proveedor || !proveedor.activo) throw new Error('Selecciona un proveedor activo')
    proveedorFinal = proveedor.id
  }
  let costoFinal = mov.costo_usd
  if (!esDevolucion && precioCompraUsd !== undefined && precioCompraUsd !== null) {
    const costo = Number(precioCompraUsd)
    if (!Number.isFinite(costo) || costo <= 0) throw new Error('El precio de compra debe ser mayor a 0')
    costoFinal = costo
  }
  // El flag "costo con IVA" solo se corrige si se envía; las devoluciones
  // por anulación de venta no lo tocan.
  const conIvaFinal = esDevolucion || costoConIva === undefined ? mov.costo_con_iva : (costoConIva ? 1 : 0)

  const nota = (motivo || '').trim() || mov.motivo
  const motivoFinal = num === mov.cantidad ? nota : `${nota} (corregido: antes ${mov.cantidad})`

  return getDb().transaction(() => {
    const saldo = inventarioRepo.editarMovimiento({
      id,
      cantidad: num,
      motivo: motivoFinal,
      proveedorId: proveedorFinal,
      costoUsd: costoFinal,
      costoConIva: conIvaFinal
    })
    if (!esDevolucion) {
      // Solo la última entrada con costo define el costo del producto.
      if (costoFinal != null && inventarioRepo.ultimaEntradaConCosto(mov.producto_id)?.id === mov.id) {
        productosRepo.actualizarPrecioCompra(mov.producto_id, costoFinal, conIvaFinal)
      }
      // Los márgenes se aplican con el costo vigente del producto (ya
      // corregido); también rematerializa los precios de todos los tipos.
      if (margenes !== undefined) {
        const costo = productosRepo.buscarPorId(mov.producto_id).precio_compra_usd
        aplicarMargenesDeProducto(mov.producto_id, costo, margenes)
      }
    }
    return saldo
  })()
}

// Anula una entrada de mercancía (la fila NO se borra: queda marcada con
// fecha y quién, para auditoría). En una sola transacción:
// - descuenta su cantidad del saldo propio y de los movimientos posteriores
//   (rechaza si dejaría saldo negativo por unidades ya despachadas),
// - recalcula el costo del producto desde la última entrada con costo
//   vigente (la anulada deja de contar; si no queda ninguna, el producto
//   queda sin costo y conserva sus últimos precios materializados),
// - rematerializa los precios con ese costo y los márgenes ya guardados.
// No se anulan: salidas, devoluciones por anulación de venta ni entradas ya
// anuladas.
export function anularMovimientoInventario(id) {
  const mov = inventarioRepo.obtenerMovimiento(id)
  if (!mov) throw new Error('Movimiento no encontrado')
  if (mov.tipo !== 'entrada') throw new Error('Solo se pueden anular entradas')
  if (mov.anulada) throw new Error('Esta entrada ya está anulada')
  if (mov.venta_id || (mov.motivo || '').startsWith('Anulación')) {
    throw new Error('Las devoluciones por anulación de venta no se pueden anular')
  }
  const actor = actorActual()
  return getDb().transaction(() => {
    const saldo = inventarioRepo.anularMovimiento({ id, usuarioId: actor?.id })
    const ultima = inventarioRepo.ultimaEntradaConCosto(mov.producto_id)
    const costo = ultima?.costo_usd ?? null
    // El costo vigente vuelve a la última entrada con costo, con su flag de
    // IVA incluido (sin entradas con costo queda sin costo y flag 0).
    productosRepo.actualizarPrecioCompra(mov.producto_id, costo, ultima?.costo_con_iva ?? 0)
    rematerializarPrecios(mov.producto_id, costo)
    return saldo
  })()
}

// Devuelve el total de unidades vendidas hoy.
export function unidadesVendidasHoy() {
  return inventarioRepo.contarUnidadesVendidasHoy()
}
