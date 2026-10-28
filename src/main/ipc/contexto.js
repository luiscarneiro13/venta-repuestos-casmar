import { AsyncLocalStorage } from 'node:async_hooks'

// Contexto de la petición HTTP remota que se está atendiendo. Cuando el
// servidor ejecuta un canal para un cliente, corre dentro de contextoRemoto
// con { usuario }: así las guardas de permiso (conPermiso → exigirPermiso)
// saben quién actúa sin cambiar la firma de los handlers, y las peticiones
// concurrentes de distintos clientes no se mezclan.
export const contextoRemoto = new AsyncLocalStorage()
