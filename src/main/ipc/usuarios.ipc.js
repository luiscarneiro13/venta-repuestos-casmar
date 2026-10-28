import { registrar } from './registro.js'
import * as usuariosService from '../services/usuarios.service.js'
import { sesionActual } from '../services/auth.service.js'
import { conPermiso } from './permisos.js'

export function registerUsuariosIpc() {
  // Listar no exige sesión: el login lo usa (no devuelve contraseñas).
  registrar('usuarios:listar', () => usuariosService.listarUsuarios())
  registrar('usuarios:roles', () => usuariosService.listarRoles())
  registrar('usuarios:crear', conPermiso('usuarios.gestionar', (_event, usuario) => usuariosService.crearUsuario(usuario)))
  registrar('usuarios:actualizar', conPermiso('usuarios.gestionar', (_event, id, cambios) =>
    usuariosService.actualizarUsuario(id, cambios)))
  registrar('usuarios:eliminar', conPermiso('usuarios.gestionar', (_event, id) =>
    usuariosService.eliminarUsuario(id, sesionActual()?.id ?? null)))
}
