import { ipcMain } from '../electron-safe.js'
import { contextoRemoto } from './contexto.js'

// Registro único de canales: cada *.ipc.js declara sus handlers con
// registrar() en vez de ipcMain.handle(). Con ese mapa, instalarIpc() los
// conecta a la ventana local (ipcMain) y el servidor HTTP los ejecuta para
// las PCs esclavas (ejecutarCanal con el usuario del token).
const canales = new Map()

export function registrar(canal, handler) {
  if (canales.has(canal)) throw new Error(`Canal duplicado: ${canal}`)
  canales.set(canal, handler)
}

// Solo en modo cliente: sustituye un canal por su versión local (auth,
// impresora y config local) o por el proxy que lo manda al servidor.
export function reemplazar(canal, handler) {
  canales.set(canal, handler)
}

export function ejecutarCanal(canal, args = [], usuarioRemoto = null) {
  const handler = canales.get(canal)
  if (!handler) throw new Error(`Canal desconocido: ${canal}`)
  if (usuarioRemoto) {
    return contextoRemoto.run({ usuario: usuarioRemoto }, () => handler({}, ...args))
  }
  return handler({}, ...args)
}

export const listarCanales = () => [...canales.keys()]

// Solo para tests: vacía el mapa para volver a registrar.
export const limpiarCanales = () => canales.clear()

// Conecta todos los canales del mapa a ipcMain (ventana Electron). El
// import de electron resuelve al binario fuera de la app, pero instalarIpc
// solo se llama dentro de ella; los tests usan registrar/ejecutarCanal.
export function instalarIpc() {
  for (const [canal, handler] of canales) {
    ipcMain.handle(canal, (event, ...args) => handler(event, ...args))
  }
}
