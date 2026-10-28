import { registrar } from './registro.js'
import * as authService from '../services/auth.service.js'

export function registerAuthIpc() {
  registrar('auth:login', (_event, credenciales) => authService.login(credenciales))
  registrar('auth:logout', () => authService.logout())
  registrar('auth:sesion', () => authService.sesionActual())
}
