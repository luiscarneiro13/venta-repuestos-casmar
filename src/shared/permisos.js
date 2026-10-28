// Matriz de permisos por rol. Única fuente: la usan el proceso principal
// (guardas de los IPC, la barrera real) y el renderer (ocultar botones y
// proteger rutas, solo comodidad visual).
//
// Roles (tabla `roles`, migración 024):
//   sistema       Admin de Sistema — todo. Cuenta raíz protegida.
//   administrador Todo; gestiona administradores y vendedores.
//   vendedor      Vende y consulta: no crea ni edita productos ni registra
//                 entradas/ajustes de inventario.

export const ROLES = {
  sistema: { nombre: 'Admin de Sistema', nivel: 3, asignable: false },
  administrador: { nombre: 'Administrador', nivel: 2, asignable: true },
  vendedor: { nombre: 'Vendedor', nivel: 1, asignable: true }
}

export const ROLES_ASIGNABLES = Object.keys(ROLES).filter((r) => ROLES[r].asignable)

const ADMINS = ['sistema', 'administrador']
const TODOS = Object.keys(ROLES)

export const PERMISOS = {
  // Productos y su catálogo: crear/editar/eliminar productos, tipos de
  // precio, categorías y proveedores.
  'catalogo.gestionar': ADMINS,
  // Entradas de mercancía, ajustes de salida y corrección de movimientos.
  'inventario.gestionar': ADMINS,
  'usuarios.gestionar': ADMINS,
  // IVA, impresora, borrar ventas, backup.
  'configuracion.gestionar': ADMINS,
  'ventas.anular': ADMINS,
  // Lo operativo del día a día, para todos.
  'ventas.crear': TODOS,
  'clientes.gestionar': TODOS,
  'reportes.ver': TODOS
}

export const nombreRol = (rol) => ROLES[rol]?.nombre ?? rol ?? ''

export function puede(rol, permiso) {
  const permitidos = PERMISOS[permiso]
  if (!permitidos) throw new Error(`Permiso desconocido: ${permiso}`)
  return permitidos.includes(rol)
}
