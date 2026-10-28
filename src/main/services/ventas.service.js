import { getDb } from '../db/connection.js'
import * as ventasRepo from '../repositories/ventas.repo.js'
import * as inventarioRepo from '../repositories/inventario.repo.js'
import * as preciosRepo from '../repositories/precios.repo.js'
import * as tasasRepo from '../repositories/tasas.repo.js'
import * as configuracionService from './configuracion.service.js'
import { redondear2 } from './precios.calculo.js'
import { calcularLinea, calcularTotales } from '../../shared/venta.calculo.js'

const METODOS_PAGO = ['bs', 'usdt']
// 'factura' cobra el IVA configurado; 'nota_entrega' es igual pero SIN IVA.
const TIPOS_DOCUMENTO = ['factura', 'nota_entrega']

export function listarVentas() {
  return ventasRepo.listar()
}

export function listarVentasDeHoy() {
  return ventasRepo.listarDeHoy()
}

export function totalesProductosHoy() {
  return ventasRepo.totalesProductosDeHoy()
}

// `desde`/`hasta` llegan como fecha simple "YYYY-MM-DD" (del selector de
// fecha del frontend); "hasta" se extiende al final de ese día para incluir
// todas las ventas de esa fecha.
export function listarVentasConFiltros({ desde, hasta } = {}) {
  return ventasRepo.listarConFiltros({
    desde: desde ? `${desde} 00:00:00` : null,
    hasta: hasta ? `${hasta} 23:59:59` : null
  })
}

// Datos para la gráfica de Ventas totales: unidades vendidas y monto en USD
// agrupados por día, mes o año. `desde`/`hasta` llegan como fecha simple
// 'YYYY-MM-DD' (o null). Devuelve un array ordenado ascendente:
//   [{ fecha, unidades, total_usd }]
export function graficoVentasTotales(periodo = 'mes', desde = null, hasta = null) {
  return ventasRepo.ventasProductosAgrupadas(periodo, desde, hasta)
}

export function obtenerVentaConDetalle(id) {
  const venta = ventasRepo.buscarPorId(id)
  if (!venta) {
    throw new Error('La venta no existe')
  }
  return { ...venta, items: ventasRepo.detalleDeVenta(id) }
}

// Anula una venta: marca estado='anulada', registra fecha/hora/usuario/motivo,
// y devuelve los productos al inventario registrando entradas por cada item.
export function anularVenta(id, motivo, usuarioId) {
  const venta = ventasRepo.buscarPorId(id)
  if (!venta) {
    throw new Error('La venta no existe')
  }
  if (venta.estado === 'anulada') {
    throw new Error('Esta venta ya está anulada')
  }
  if (!usuarioId) {
    throw new Error('Falta el usuario que anula la venta')
  }

  const items = ventasRepo.detalleDeVenta(id)
  const ventaActualizada = ventasRepo.anular(id, {
    motivo: (motivo || '').trim() || null,
    usuarioId
  })

  // Devolver productos al inventario: por cada item se registra una entrada
  // (inversa a la salida que se hizo al vender).
  for (const item of items) {
    const precio = preciosRepo.buscarPorId(item.precio_id)
    if (!precio) continue
    inventarioRepo.registrarEntrada({
      productoId: precio.producto_id,
      cantidad: item.cantidad,
      motivo: `Anulación ${venta.numero_ticket}`,
      usuarioId
    })
  }

  return ventaActualizada
}

// Las tasas vigentes se leen de la BD (última de tasas_cambio), no vienen del
// renderer. `metodoPago` es 'bs' (default) o 'usdt'; el Bs es canónico e igual
// en ambos métodos — en USDT el cliente paga total_usdt (= Bs ÷ tasa Binance,
// el redondeo lo absorbe el USDT).
export function crearVenta({ clienteId, usuarioId, metodoPago, tipoDocumento, items, totalesEsperados }) {
  const tipo = tipoDocumento == null ? 'factura' : String(tipoDocumento)
  if (!TIPOS_DOCUMENTO.includes(tipo)) {
    throw new Error("El tipo de documento debe ser 'factura' o 'nota_entrega'")
  }
  if (!usuarioId) {
    throw new Error('Falta el usuario que registra la venta')
  }
  if (!clienteId) {
    throw new Error('La venta debe tener un cliente')
  }
  const metodo = metodoPago === undefined || metodoPago === null ? 'bs' : String(metodoPago)
  if (!METODOS_PAGO.includes(metodo)) {
    throw new Error("El método de pago debe ser 'bs' o 'usdt'")
  }
  const tasa = tasasRepo.obtenerUltimaTasa()
  const tasaBcv = Number(tasa?.valor_bcv ?? tasa?.valor)
  const tasaUsdt = Number(tasa?.valor_usdt ?? tasa?.valor)
  if (!tasa || !(tasaBcv > 0) || !(tasaUsdt > 0)) {
    throw new Error('No hay una tasa registrada: registra la tasa del día (BCV y USDT)')
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('La venta debe tener al menos un producto')
  }

  // IVA general vigente (se congela en la venta). La nota de entrega no
  // lleva IVA: mismo cálculo con 0%, así total = subtotal.
  const ivaPorcentaje = tipo === 'nota_entrega' ? 0 : configuracionService.obtenerIva()

  // El precio unitario se toma de la BD (no del renderer) y se congela en la
  // venta junto con el nombre del producto, el tipo de precio y el margen
  // aplicado. Los montos salen de shared/venta.calculo.js — la misma función
  // que usa la pantalla de venta —: unitario y subtotal guardados SIN IVA
  // (lo que imprime la factura) y el IVA por línea para los totales.
  const lineas = []
  const itemsCalculados = items.map((item) => {
    const cantidad = Number(item.cantidad)
    if (!item.precioId || !(cantidad > 0) || !Number.isInteger(cantidad)) {
      throw new Error('Datos de producto inválidos en la venta')
    }
    const precio = preciosRepo.buscarPorId(item.precioId)
    if (!precio || !precio.activo) {
      throw new Error('Uno de los precios del ticket ya no está disponible')
    }
    const precioUsd = precio.valor_usd
    const precioBs = redondear2(precioUsd * tasaBcv)
    const precioUsdt = redondear2(precioBs / tasaUsdt)
    const linea = calcularLinea({ precioUsd, precioBs, precioUsdt }, cantidad, ivaPorcentaje)
    lineas.push(linea)
    return {
      precioId: precio.id,
      productoId: precio.producto_id,
      productoNombre: precio.producto_nombre,
      tipoPrecioNombre: precio.tipo_precio_nombre,
      cantidad,
      precioUnitarioUsd: linea.unitario.usd,
      precioUnitarioBs: linea.unitario.bs,
      precioUnitarioUsdt: linea.unitario.usdt,
      subtotalUsd: linea.subtotal.usd,
      subtotalBs: linea.subtotal.bs,
      subtotalUsdt: linea.subtotal.usdt,
      margenUtilidad: precio.margen ?? precio.margen_default
    }
  })

  // Bloquea la venta si algún producto no tiene stock suficiente. Se suman
  // las cantidades por producto porque un mismo producto puede ir en varias
  // líneas (una por tipo de precio).
  const cantidadPorProducto = new Map()
  for (const item of itemsCalculados) {
    const actual = cantidadPorProducto.get(item.productoId) || { nombre: item.productoNombre, cantidad: 0 }
    actual.cantidad += item.cantidad
    cantidadPorProducto.set(item.productoId, actual)
  }
  for (const [productoId, { nombre, cantidad }] of cantidadPorProducto) {
    const stock = inventarioRepo.saldoActual(productoId)
    if (cantidad > stock) {
      throw new Error(`Stock insuficiente de "${nombre}": disponible ${stock}, en el ticket ${cantidad}`)
    }
  }

  // Totales = suma de líneas (misma función que la pantalla de venta):
  // total = subtotal sin IVA + IVA, por moneda.
  const totales = calcularTotales(lineas)

  // Si el renderer envía lo que mostró en la factura, debe coincidir al
  // céntimo con lo que se guardará (pantalla y factura nunca difieren). Si
  // no, cambió algo entre la vista previa y el cobro (tasa, IVA o precio).
  if (totalesEsperados) {
    const esperado = {
      ivaPorcentaje: ivaPorcentaje,
      subtotalBs: totales.subtotal.bs,
      ivaBs: totales.iva.bs,
      totalBs: totales.total.bs,
      totalUsdt: totales.total.usdt
    }
    const difiere = Object.keys(esperado).some(
      (k) => totalesEsperados[k] !== undefined && Math.abs(Number(totalesEsperados[k]) - esperado[k]) > 0.001
    )
    if (difiere) {
      throw new Error('Los montos cambiaron (tasa, IVA o precio actualizados). Revisa el ticket y vuelve a finalizar.')
    }
  }

  const ivaUsd = totales.iva.usd
  const ivaBs = totales.iva.bs
  const ivaUsdt = totales.iva.usdt
  const totalUsd = totales.total.usd
  const totalBs = totales.total.bs
  const totalUsdt = totales.total.usdt

  // Venta + salidas de inventario en una sola transacción.
  return getDb().transaction(() => {
    const venta = ventasRepo.crear({
      clienteId,
      usuarioId,
      tasaBcv,
      tasaUsdt,
      metodoPago: metodo,
      tipoDocumento: tipo,
      ivaPorcentaje,
      ivaUsd,
      ivaBs,
      ivaUsdt,
      totalUsd,
      totalBs,
      totalUsdt,
      items: itemsCalculados
    })
    for (const item of itemsCalculados) {
      inventarioRepo.registrarSalida({
        productoId: item.productoId,
        cantidad: item.cantidad,
        motivo: `Venta ${venta.numero_ticket}`,
        ventaId: venta.id,
        usuarioId
      })
    }
    return venta
  })()
}
