import { obtenerConfig } from '../config.js'
import { setSesionCliente, getSesionCliente } from '../services/auth.service.js'
import { BrowserWindow } from '../electron-safe.js'

// Lado esclavo: cada canal remoto sale por HTTP al servidor. El token de la
// sesión vive en auth.service (sesionCliente) y se adjunta solo: el renderer
// nunca lo ve. Sin vencimiento (red local).

const TIMEOUT = 8000
const REINTENTO_WS = 5000

const base = () => {
  const cfg = obtenerConfig()
  if (!cfg.servidor) throw new Error('No hay IP del servidor configurada')
  return `http://${cfg.servidor}:${cfg.puerto}`
}

const errorConexion = (error) => {
  const cfg = obtenerConfig()
  const destino = cfg.servidor ? `${cfg.servidor}:${cfg.puerto}` : 'el servidor'
  return new Error(`No hay conexión con ${destino}. Verifica que la PC principal esté encendida y el programa abierto.`)
}

async function post(ruta, cuerpo, token = null) {
  let resp
  try {
    resp = await fetch(`${base()}${ruta}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIMEOUT)
    })
  } catch (error) {
    throw errorConexion(error)
  }
  const datos = await resp.json().catch(() => ({ ok: false, error: 'Respuesta inválida del servidor' }))
  if (!resp.ok || !datos.ok) throw new Error(datos.error || `Error ${resp.status} del servidor`)
  return datos
}

// WebSocket de eventos: el esclavo escucha /ws?token=... y reenvía cada
// evento a sus ventanas ('evento:remoto'), para refresco en vivo. Reintenta
// mientras haya sesión (el servidor pudo reiniciarse o caer la red).
let ws = null
let reintentoWs = null

function avisarVentanas(payload) {
  try {
    for (const w of BrowserWindow?.getAllWindows?.() ?? []) {
      if (!w.isDestroyed()) w.webContents.send('evento:remoto', payload)
    }
  } catch { /* sin ventanas todavía */ }
}

function conectarEventos() {
  const sesion = getSesionCliente()
  if (!sesion?.token || ws) return
  let socket
  try {
    socket = new WebSocket(`${base().replace(/^http/, 'ws')}/ws?token=${sesion.token}`)
  } catch {
    return
  }
  ws = socket
  socket.onmessage = (e) => {
    try {
      avisarVentanas(JSON.parse(e.data))
    } catch { /* mensaje inválido: se ignora */ }
  }
  socket.onclose = () => {
    ws = null
    if (getSesionCliente()?.token && !reintentoWs) {
      reintentoWs = setTimeout(() => {
        reintentoWs = null
        conectarEventos()
      }, REINTENTO_WS)
      reintentoWs.unref?.()
    }
  }
  socket.onerror = () => {
    try {
      socket.close()
    } catch { /* ya cerrado */ }
  }
}

function desconectarEventos() {
  if (reintentoWs) {
    clearTimeout(reintentoWs)
    reintentoWs = null
  }
  try {
    ws?.close()
  } catch { /* ya cerrado */ }
  ws = null
}

// Login del esclavo: guarda {usuario, token} en la sesión cliente y devuelve
// el usuario (mismo contrato que auth:login local).
export async function loginCliente(credenciales) {
  const { usuario, token } = await post('/api/login', credenciales)
  setSesionCliente({ usuario, token })
  conectarEventos()
  return usuario
}

export async function logoutCliente() {
  const sesion = getSesionCliente()
  desconectarEventos()
  if (sesion?.token) {
    try {
      await post('/api/logout', { token: sesion.token })
    } catch { /* si el servidor no responde, la sesión se cierra igual */ }
  }
  setSesionCliente(null)
  return { ok: true }
}

export function usuarioCliente() {
  return getSesionCliente()?.usuario ?? null
}

// Proxy de un canal al servidor (equivale a ipcRenderer.invoke del servidor).
export async function invocarRemoto(canal, args = []) {
  const datos = await post('/api/invoke', { canal, args }, getSesionCliente()?.token)
  return datos.data
}

// "Probar conexión" de la configuración: acepta IP/puerto aún no guardados.
export async function probarConexion({ servidor, puerto } = {}) {
  const cfg = obtenerConfig()
  const host = servidor ?? cfg.servidor
  const port = puerto ?? cfg.puerto
  if (!host) throw new Error('Indica la IP del servidor')
  try {
    const resp = await fetch(`http://${host}:${port}/api/health`, { signal: AbortSignal.timeout(5000) })
    const datos = await resp.json()
    if (!resp.ok || !datos.ok) throw new Error(datos.error || 'El servidor respondió con error')
    return datos
  } catch (error) {
    if (error.message && !/fetch|abort|network|ECONN|timeout|Timeout/i.test(error.message)) throw error
    throw new Error(`No hay conexión con ${host}:${port}. Verifica la IP, que la PC principal esté encendida y el programa abierto.`)
  }
}
