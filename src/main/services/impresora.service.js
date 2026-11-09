import * as configuracionRepo from '../repositories/configuracion.repo.js'
import * as configuracionService from './configuracion.service.js'
import * as ventasRepo from '../repositories/ventas.repo.js'
import * as cajaRepo from '../repositories/caja.repo.js'
import * as tasasRepo from '../repositories/tasas.repo.js'
import {
  imprimirPruebaLocal,
  imprimirDocumentosVentaLocal,
  previsualizarDocumentoVentaLocal,
  imprimirReporteZLocal
} from './impresora.acciones.js'
import {
  documentosDisponibles,
  listarImpresorasDocumento
} from '../printer/documento.printer.js'

// Unidades vendidas en el conjunto de ventas (suma de cantidades de sus items).
const contarUnidades = (ventas) =>
  ventas.reduce((suma, venta) => suma + venta.items.reduce((s, item) => s + (Number(item.cantidad) || 0), 0), 0)

export function obtenerConfiguracion() {
  return {
    nombre: configuracionRepo.obtener('impresora_nombre'),
    plataformaSoportada: documentosDisponibles()
  }
}

// La impresora configurada es la de oficina (hoja carta); se identifica por
// el nombre tal como aparece instalada en el sistema operativo.
export function guardarConfiguracion({ nombre }) {
  configuracionRepo.guardar('impresora_nombre', (nombre || '').trim() || null)
  return obtenerConfiguracion()
}

export async function listarImpresoras() {
  return listarImpresorasDocumento()
}

// ---------- Datos para documentos/reportes ----------
// Separados de la impresión para que una PC esclava pueda pedir los datos por
// HTTP (impresora:datos*) y armar + imprimir el documento en SU impresora.
// Los datos del negocio van incluidos: el documento impreso en cualquier PC
// lleva el mismo encabezado.

export function datosTicketVenta(ventaId) {
  const venta = ventasRepo.buscarPorId(ventaId)
  if (!venta) return null
  return { venta, items: ventasRepo.detalleDeVenta(ventaId), negocio: configuracionService.obtenerNegocio() }
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
    totalUnidades: contarUnidades(ventas),
    negocio: configuracionService.obtenerNegocio()
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

  return { ventas, tasaBcv, tasaUsdt, totalUnidades: contarUnidades(ventas), negocio: configuracionService.obtenerNegocio() }
}

// ---------- Impresión en la impresora DE ESTA PC ----------

export async function imprimirPrueba() {
  return imprimirPruebaLocal({ ...obtenerConfiguracion(), negocio: configuracionService.obtenerNegocio() })
}

// Imprime (o reimprime) el documento de una venta ya guardada en hoja carta.
// `copias`: 1 = solo ORIGINAL; 2 = ORIGINAL + COPIA (la copia lleva línea de
// firma). Nunca lanza: el resultado se devuelve para que la UI avise si no
// se pudo imprimir.
export async function imprimirTicketsVenta(ventaId, copias = 2) {
  const datos = datosTicketVenta(ventaId)
  if (!datos) return { ok: false, error: 'La venta no existe' }
  return imprimirDocumentosVentaLocal(datos, obtenerConfiguracion(), copias)
}

// Vista previa del documento como HTML (copia ORIGINAL), para poder revisar
// la maqueta o mostrarla en pantalla sin gastar papel.
export function previsualizarTicketVenta(ventaId) {
  const datos = datosTicketVenta(ventaId)
  if (!datos) throw new Error('La venta no existe')
  return previsualizarDocumentoVentaLocal(datos)
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
