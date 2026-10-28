import { registrar } from './registro.js'
import * as cajaService from '../services/caja.service.js'

export function registerCajaIpc() {
  registrar('caja:listarAbiertas', () => cajaService.listarAbiertas())
  registrar('caja:abrirDelDia', (_event, datos) => cajaService.abrirCajaDelDia(datos))
  registrar('caja:resumenCierre', (_event, cajaId) => cajaService.obtenerResumenParaCierre(cajaId))
  registrar('caja:cerrar', (_event, datos) => cajaService.cerrarCaja(datos))
}
