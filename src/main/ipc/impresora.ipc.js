import { registrar } from './registro.js'
import { conPermiso } from './permisos.js'
import * as impresoraService from '../services/impresora.service.js'

export function registerImpresoraIpc() {
  registrar('impresora:configuracion', () => impresoraService.obtenerConfiguracion())
  registrar('impresora:guardar', conPermiso('configuracion.gestionar', (_event, datos) => impresoraService.guardarConfiguracion(datos)))
  registrar('impresora:listar', () => impresoraService.listarImpresoras())
  registrar('impresora:probar', () => impresoraService.imprimirPrueba())
  registrar('impresora:imprimirVenta', (_event, ventaId) => impresoraService.imprimirTicketsVenta(ventaId))
  registrar('impresora:previsualizar', (_event, ventaId) => impresoraService.previsualizarTicketVenta(ventaId))
  registrar('impresora:imprimirReporteCierre', (_event, cajaId, usuarioNombre) =>
    impresoraService.imprimirReporteCierre(cajaId, usuarioNombre)
  )
  registrar('impresora:imprimirReporteDiario', (_event, fecha, usuarioNombre) =>
    impresoraService.imprimirReporteDiario(fecha, usuarioNombre)
  )

  // Datos para que una PC esclava arme e imprima el ticket/reporte en su
  // propia impresora (se ejecutan en el servidor vía HTTP).
  registrar('impresora:datosTicketVenta', (_event, ventaId) => impresoraService.datosTicketVenta(ventaId))
  registrar('impresora:datosReporteCierre', (_event, cajaId) => impresoraService.datosReporteCierre(cajaId))
  registrar('impresora:datosReporteDiario', (_event, fecha) => impresoraService.datosReporteDiario(fecha))
}
