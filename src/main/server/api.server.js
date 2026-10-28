import { createServer } from 'node:http'
import { ejecutarCanal } from '../ipc/registro.js'
import { loginConToken, logoutToken, usuarioDeToken } from '../services/auth.service.js'
import { setDifusor } from '../eventos.js'
import { adjuntarWebSocket, difundirEvento } from './ws.server.js'

// API HTTP local del equipo "principal": las PCs esclavas llaman
//   GET  /api/health          sin auth, para "Probar conexión"
//   POST /api/login           {usuario, password} → {usuario, token}
//   POST /api/logout          {token}
//   POST /api/invoke          {canal, args} + Authorization: Bearer <token>
// Respuestas siempre { ok, ... | error } para que el proxy del cliente sea
// un espejo del IPC (los servicios y guardas son los mismos).
const MAX_BODY = 1024 * 1024

const responder = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

async function leerJson(req) {
  const partes = []
  let total = 0
  for await (const parte of req) {
    total += parte.length
    if (total > MAX_BODY) throw new Error('Petición demasiado grande')
    partes.push(parte)
  }
  if (!partes.length) return {}
  return JSON.parse(Buffer.concat(partes).toString('utf8'))
}

const tokenDe = (req) => {
  const auth = req.headers.authorization || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

const estadoDe = (mensaje) => {
  if (mensaje === 'Debes iniciar sesión' || /sesión|inicia sesión/.test(mensaje)) return 401
  if (/permiso/i.test(mensaje)) return 403
  return 400
}

async function manejar(req, res, version) {
  const url = new URL(req.url || '/', 'http://servidor')

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return responder(res, 200, { ok: true, modo: 'servidor', version })
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    try {
      const { usuario, token } = loginConToken(await leerJson(req))
      return responder(res, 200, { ok: true, usuario, token })
    } catch (error) {
      return responder(res, 401, { ok: false, error: error.message })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const { token } = await leerJson(req)
    return responder(res, 200, logoutToken(token))
  }

  if (req.method === 'POST' && url.pathname === '/api/invoke') {
    const usuario = usuarioDeToken(tokenDe(req))
    if (!usuario) {
      return responder(res, 401, { ok: false, error: 'La sesión no existe: vuelve a iniciar sesión' })
    }
    const { canal, args = [] } = await leerJson(req)
    // auth:* no va por invoke: login/logout tienen endpoint propio y no
    // deben tocar la sesión local de la ventana del servidor.
    if (typeof canal === 'string' && canal.startsWith('auth:')) {
      return responder(res, 400, { ok: false, error: `Canal no permitido: ${canal}` })
    }
    try {
      const data = await ejecutarCanal(canal, args, usuario)
      return responder(res, 200, { ok: true, data })
    } catch (error) {
      const mensaje = error.message || 'Error del servidor'
      return responder(res, estadoDe(mensaje), { ok: false, error: mensaje })
    }
  }

  responder(res, 404, { ok: false, error: 'Ruta no encontrada' })
}

export function iniciarApiServidor({ puerto, version = 'dev', onListen } = {}) {
  const server = createServer((req, res) => {
    manejar(req, res, version).catch((error) => {
      try {
        responder(res, 500, { ok: false, error: error.message || 'Error interno' })
      } catch { /* respuesta ya enviada */ }
    })
  })
  adjuntarWebSocket(server)
  setDifusor(difundirEvento)
  server.listen(puerto, '0.0.0.0', () => {
    console.log(`[api] Escuchando en 0.0.0.0:${server.address().port}`)
    onListen?.(server.address().port)
  })
  return server
}
