import * as configuracionRepo from '../repositories/configuracion.repo.js'
import * as ventasRepo from '../repositories/ventas.repo.js'
import * as cajaRepo from '../repositories/caja.repo.js'
import * as tasasRepo from '../repositories/tasas.repo.js'
import {
  imprimirPruebaLocal,
  imprimirTicketsVentaLocal,
  previsualizarTicketVentaLocal,
  imprimirReporteZLocal
} from './impresora.acciones.js'
import {
  esPlataformaSoportada,
  listarImpresorasDelSistema
} from '../printer/ticket.printer.js'

const ANCHOS = ['58mm', '80mm']

// Unidades vendidas en el conjunto de ventas (suma de cantidades de sus items).
const contarUnidades = (ventas) =>
  ventas.reduce((suma, venta) => suma + venta.items.reduce((s, item) => s + (Number(item.cantidad) || 0), 0), 0)

export function obtenerConfiguracion() {
  return {
    nombre: configuracionRepo.obtener('impresora_nombre'),
    ancho: configuracionRepo.obtener('impresora_ancho') || '80mm',
    plataformaSoportada: esPlataformaSoportada()
  }
}

export function guardarConfiguracion({ nombre, ancho }) {
  if (ancho && !ANCHOS.includes(ancho)) {
    throw new Error('El ancho de papel debe ser 58mm o 80mm')
  }
  configuracionRepo.guardar('impresora_nombre', (nombre || '').trim() || null)
  if (ancho) configuracionRepo.guardar('impresora_ancho', ancho)
  return obtenerConfiguracion()
}

export async function listarImpresoras() {
  return listarImpresorasDelSistema()
}

// ---------- Datos para tickets/reportes ----------
// Separados de la impresión para que una PC esclava pueda pedir los datos por
// HTTP (impresora:datos*) y armar + imprimir el ticket en SU impresora.

export function datosTicketVenta(ventaId) {
  const venta = ventasRepo.buscarPorId(ventaId)
  if (!venta) return null
  return { venta, items: ventasRepo.detalleDeVenta(ventaId) }
}

export function datosReporteCierre(cajaId) {
  const caja = cajaRepo.buscarPorId(cajaId)
  if (!caja) return null

  const ventas = ventasRepo.listarActivasDesde(caja.abierta_en).map((venta) => ({
    ...venta,
    items: ventasRepo.detalleDeVenta(venta.id)
  }))

  // Las tasas del día: si la caja ya se cerró, se usan las de cierre; si no,
  // las de apertura.
  return {
    ventas,
    tasaBcv: caja.tasa_cierre || caja.tasa_apertura,
    tasaUsdt: caja.tasa_cierre_usdt || caja.tasa_apertura_usdt || caja.tasa_cierre || caja.tasa_apertura,
    totalUnidades: contarUnidades(ventas)
  }
}

export function datosReporteDiario(fecha) {
  const ventas = ventasRepo.listarActivasPorFecha(fecha).map((venta) => ({
    ...venta,
    items: ventasRepo.detalleDeVenta(venta.id)
  }))

  // Las tasas del día: la última registrada en esa fecha; si ese día no se
  // registró tasa, las de la última venta del día (tasa_valor = respaldo de
  // ventas viejas, solo BCV).
  const tasaDelDia = tasasRepo.obtenerTasaDeFecha(fecha)
  const ultimaVenta = ventas[0]
  const tasaBcv = Number(tasaDelDia?.valor_bcv ?? tasaDelDia?.valor ?? ultimaVenta?.tasa_bcv ?? ultimaVenta?.tasa_valor) || 0
  const tasaUsdt = Number(tasaDelDia?.valor_usdt ?? ultimaVenta?.tasa_usdt ?? ultimaVenta?.tasa_valor) || 0

  return { ventas, tasaBcv, tasaUsdt, totalUnidades: contarUnidades(ventas) }
}

// ---------- Impresión en la impresora DE ESTA PC ----------

export async function imprimirPrueba() {
  return imprimirPruebaLocal(obtenerConfiguracion())
}

// Imprime (o reimprime) los 2 tickets de una venta ya guardada: la copia
// del cliente (con "Gracias por su compra") y la copia de la tienda (sin
// ese mensaje). Nunca lanza: el resultado se devuelve para que la UI avise
// si no se pudo imprimir.
export async function imprimirTicketsVenta(ventaId) {
  const datos = datosTicketVenta(ventaId)
  if (!datos) return { ok: false, error: 'La venta no existe' }
  return imprimirTicketsVentaLocal(datos, obtenerConfiguracion())
}

// Vista previa en texto del ticket (copia del cliente), para poder revisar la
// maqueta sin gastar papel ni tener la impresora conectada.
export function previsualizarTicketVenta(ventaId) {
  const datos = datosTicketVenta(ventaId)
  if (!datos) throw new Error('La venta no existe')
  return previsualizarTicketVentaLocal(datos, obtenerConfiguracion().ancho)
}

// Imprime el reporte diario (reporte Z) de las ventas del turno de la caja
// indicada. Se llama después de cerrar la caja: arma el reporte con todas las
// ventas activas desde la apertura de la caja y lo manda a la impresora.
// Nunca lanza: el resultado se devuelve para que la UI avise si falló, sin
// deshacer el cierre ya hecho.
export async function imprimirReporteCierre(cajaId, usuarioNombre) {
  const datos = datosReporteCierre(cajaId)
  if (!datos) return { ok: false, error: 'La caja no existe' }
  return imprimirReporteZLocal(
    { ...datos, usuarioNombre, documento: `Reporte diario - Caja ${cajaId}` },
    obtenerConfiguracion()
  )
}

// Imprime el reporte diario (reporte Z) de las ventas activas de una fecha
// específica (formato 'YYYY-MM-DD'). Se usa desde Indicadores, para
// reimprimir el reporte de cualquier día sin necesidad de una caja abierta.
// Nunca lanza: el resultado se devuelve para que la UI avise si falló.
export async function imprimirReporteDiario(fecha, usuarioNombre) {
  return imprimirReporteZLocal(
    { ...datosReporteDiario(fecha), usuarioNombre, documento: `Reporte diario - ${fecha}` },
    obtenerConfiguracion()
  )
}
