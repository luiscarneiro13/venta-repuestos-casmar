import { session } from '../store/session'
import { puede, nombreRol } from '../../../shared/permisos.js'

// Permisos del usuario en sesión (misma matriz que las guardas del proceso
// principal). En la UI solo oculta/deshabilita: la barrera real son los IPC.
// Reactivo: lee session.usuario, que es reactivo.
export const puedeHacer = (permiso) => Boolean(session.usuario) && puede(session.usuario.rol, permiso)

export const rolActual = () => nombreRol(session.usuario?.rol)
