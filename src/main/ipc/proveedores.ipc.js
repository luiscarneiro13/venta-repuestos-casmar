import { registrar } from './registro.js'
import { conPermiso } from './permisos.js'
import * as proveedoresService from '../services/proveedores.service.js'

export function registerProveedoresIpc() {
  registrar('proveedores:listar', (_event, opciones) => proveedoresService.listarProveedores(opciones))
  registrar('proveedores:crear', conPermiso('catalogo.gestionar', (_event, datos) => proveedoresService.crearProveedor(datos)))
  registrar('proveedores:actualizar', conPermiso('catalogo.gestionar', (_event, id, datos) => proveedoresService.actualizarProveedor(id, datos)))
  registrar('proveedores:desactivar', conPermiso('catalogo.gestionar', (_event, id) => proveedoresService.desactivarProveedor(id)))
  registrar('proveedores:reactivar', conPermiso('catalogo.gestionar', (_event, id) => proveedoresService.reactivarProveedor(id)))
}
