import { exigirPermiso } from '../services/auth.service.js'

// Envuelve un handler de ipcMain.handle: antes de ejecutarlo exige sesión y
// el permiso (src/shared/permisos.js). Es la barrera real: ocultar botones
// en el renderer es solo comodidad visual.
export const conPermiso = (permiso, handler) => (event, ...args) => {
  exigirPermiso(permiso)
  return handler(event, ...args)
}
