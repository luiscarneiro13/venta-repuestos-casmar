import { createHash } from 'node:crypto'
import { usuarioDeToken } from '../services/auth.service.js'

// WebSocket mínimo (RFC 6455) sin dependencias: el servidor solo DIFUNDE
// eventos a las PCs esclavas; los clientes no envían datos (solo close/ping).
// Se autentica con el mismo token de sesión: GET /ws?token=<uuid>.
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
const clientes = new Set()

function frameTexto(datos) {
  const carga = Buffer.from(datos)
  const len = carga.length
  let cabecera
  if (len < 126) {
    cabecera = Buffer.from([0x81, len])
  } else if (len < 65536) {
    cabecera = Buffer.alloc(4)
    cabecera[0] = 0x81
    cabecera[1] = 126
    cabecera.writeUInt16BE(len, 2)
  } else {
    cabecera = Buffer.alloc(10)
    cabecera[0] = 0x81
    cabecera[1] = 127
    cabecera.writeBigUInt64BE(BigInt(len), 2)
  }
  return Buffer.concat([cabecera, carga])
}

// Frame de control (pong/close): FIN + opcode, carga < 126 bytes.
const frameControl = (opcode, datos = Buffer.alloc(0)) =>
  Buffer.concat([Buffer.from([0x80 | opcode, datos.length]), datos])

// Sobre el mismo server HTTP de la API: GET /ws?token=... → 101 upgrade.
export function adjuntarWebSocket(server) {
  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url || '/', 'http://servidor')
    const key = req.headers['sec-websocket-key']
    if (url.pathname !== '/ws' || !key || !usuarioDeToken(url.searchParams.get('token'))) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    const accept = createHash('sha1').update(key + GUID).digest('base64')
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    )
    socket.setNoDelay(true)
    clientes.add(socket)
    socket.on('data', (buf) => {
      const opcode = buf[0] & 0x0f
      if (opcode === 0x8) socket.end()
      else if (opcode === 0x9) socket.write(frameControl(0xA))
    })
    const quitar = () => clientes.delete(socket)
    socket.on('close', quitar)
    socket.on('error', quitar)
  })

  // Al cerrar el servidor se tumban las conexiones abiertas (upgrade no
  // cierra con server.close()).
  server.on('close', () => {
    for (const socket of clientes) socket.destroy()
    clientes.clear()
  })
}

export function difundirEvento(payload) {
  const frame = frameTexto(JSON.stringify(payload))
  for (const socket of clientes) {
    try {
      socket.write(frame)
    } catch {
      clientes.delete(socket)
    }
  }
}

// Solo para tests.
export const cantidadClientes = () => clientes.size
