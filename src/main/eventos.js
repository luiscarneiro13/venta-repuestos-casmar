import { BrowserWindow } from './electron-safe.js'

// Eventos de cambio: cada canal de escritura exitoso difunde un evento por
// WebSocket a las PCs esclavas y a la ventana local del servidor, para que
// las vistas se recarguen en vivo. Los eventos son por GRUPO (no por canal):
// la vista se suscribe al grupo que le afecta ('ventas', 'catalogo', ...).
const GRUPOS = {
  ventas: ['ventas:crear', 'ventas:anular'],
  inventario: ['inventario:registrarEntrada', 'inventario:registrarAjusteSalida', 'inventario:editarMovimiento'],
  catalogo: [
    'productos:crear', 'productos:actualizar', 'productos:eliminar', 'productos:reactivar',
    'tiposPrecio:crear', 'tiposPrecio:actualizar', 'tiposPrecio:eliminar',
    'categoriasProveedor:crear', 'categoriasProveedor:actualizar', 'categoriasProveedor:desactivar',
    'categoriasProveedor:reactivar', 'categoriasProveedor:eliminar',
    'categoriasProducto:crear', 'categoriasProducto:actualizar', 'categoriasProducto:desactivar',
    'categoriasProducto:reactivar', 'categoriasProducto:eliminar'
  ],
  clientes: ['clientes:crear', 'clientes:actualizar'],
  proveedores: ['proveedores:crear', 'proveedores:actualizar', 'proveedores:desactivar', 'proveedores:reactivar'],
  usuarios: ['usuarios:crear', 'usuarios:actualizar', 'usuarios:eliminar'],
  tasas: ['tasas:registrar'],
  caja: ['caja:abrirDelDia', 'caja:cerrar'],
  config: ['configuracion:guardarIva'],
  // 'todo' avisa que cambió TODO (reinicio de BD): cualquier vista recarga.
  todo: ['sistema:reiniciarBaseDatos']
}

const EVENTO_POR_CANAL = new Map()
for (const [tipo, canales] of Object.entries(GRUPOS)) {
  for (const canal of canales) EVENTO_POR_CANAL.set(canal, tipo)
}

// El servidor WebSocket registra aquí su difusor (ws.server.js); los oyentes
// internos son para tests.
let difusor = null
const oyentes = new Set()

export const setDifusor = (fn) => { difusor = fn }
export const alEmitir = (fn) => {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

export function emitirEvento(tipo, datos = {}) {
  const payload = { tipo, datos }
  for (const fn of oyentes) fn(payload)
  try {
    difusor?.(payload)
    for (const w of BrowserWindow?.getAllWindows?.() ?? []) {
      if (!w.isDestroyed()) w.webContents.send('evento:remoto', payload)
    }
  } catch { /* difundir nunca debe romper la operación que lo originó */ }
}

// Envuelve el resultado de un canal: solo si resuelve con éxito se emite el
// evento del grupo. Lo usan ejecutarCanal (HTTP) e instalarIpc (IPC local).
export function conEvento(canal, resultado) {
  const tipo = EVENTO_POR_CANAL.get(canal)
  if (!tipo) return resultado
  return Promise.resolve(resultado).then((r) => {
    emitirEvento(tipo, { canal })
    return r
  })
}
