import { getDb } from '../db/connection.js'
import * as inventarioRepo from '../repositories/inventario.repo.js'
import * as productosRepo from '../repositories/productos.repo.js'
import * as preciosRepo from '../repositories/precios.repo.js'
import * as proveedoresRepo from '../repositories/proveedores.repo.js'
import * as tasasRepo from '../repositories/tasas.repo.js'
import { normalizarPrecios } from './precios.validation.js'
import { aplicarMargenesDeProducto } from './precios.service.js'

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
export function registrarEntrada({ productoId, cantidad, motivo, usuarioId, precioCompraUsd, precios, margenes, proveedorId }) {
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

  // Payload legado con precios fijos (renderer anterior al modelo de márgenes).
  if (precios !== undefined) {
    const preciosValidados = normalizarPrecios(precios)
    return getDb().transaction(() => {
      productosRepo.actualizarPrecioCompra(productoId, costo)
      preciosRepo.reemplazarDeProducto(productoId, preciosValidados)
      return inventarioRepo.registrarEntrada({
        productoId, cantidad: unidades, motivo: nota, usuarioId, proveedorId: proveedor.id, costoUsd: costo
      })
    })()
  }

  return getDb().transaction(() => {
    productosRepo.actualizarPrecioCompra(productoId, costo)
    // Recalcula el valor_usd de TODOS los tipos activos con su margen
    // efectivo y desactiva las filas de tipos que quedaron inactivos.
    aplicarMargenesDeProducto(productoId, costo, margenes)
    return inventarioRepo.registrarEntrada({
      productoId, cantidad: unidades, motivo: nota, usuarioId, proveedorId: proveedor.id, costoUsd: costo
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

// Edita la cantidad de un movimiento de inventario: el saldo se corrige
// solo (los movimientos posteriores se desplazan con la diferencia). Solo
// se pueden editar entradas; si la entrada viene de una anulación, la venta
// no se modifica: solo el inventario.
export function editarMovimientoInventario({ id, cantidad, motivo }) {
  const num = validarCantidad(cantidad)
  const mov = inventarioRepo.obtenerMovimiento(id)
  if (!mov) throw new Error('Movimiento no encontrado')
  if (mov.tipo !== 'entrada') throw new Error('Solo se pueden editar entradas')
  const nota = (motivo || '').trim() || mov.motivo
  const motivoFinal = num === mov.cantidad ? nota : `${nota} (corregido: antes ${mov.cantidad})`
  return inventarioRepo.editarMovimiento({ id, cantidad: num, motivo: motivoFinal })
}

// Devuelve el total de unidades vendidas hoy.
export function unidadesVendidasHoy() {
  return inventarioRepo.contarUnidadesVendidasHoy()
}
