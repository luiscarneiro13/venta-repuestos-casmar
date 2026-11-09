import { registrar } from './registro.js'
import { conPermiso } from './permisos.js'
import * as configuracionService from '../services/configuracion.service.js'

export function registerConfiguracionIpc() {
  registrar('configuracion:obtenerIva', () => configuracionService.obtenerIva())
  registrar('configuracion:guardarIva', conPermiso('configuracion.gestionar', (_event, porcentaje) =>
    configuracionService.guardarIva(porcentaje)))
  registrar('configuracion:obtenerNegocio', () => configuracionService.obtenerNegocio())
  registrar('configuracion:guardarNegocio', conPermiso('configuracion.gestionar', (_event, datos) =>
    configuracionService.guardarNegocio(datos)))
}
