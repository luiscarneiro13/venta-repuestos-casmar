// Red local: el servidor HTTP expone los canales y el esclavo los consume
// con token de sesión (sin vencimiento, se cierra con logout o al reiniciar).
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import { registrarCanales } from '../src/main/ipc/index.js'
import { ejecutarCanal, listarCanales, limpiarCanales } from '../src/main/ipc/registro.js'
import { iniciarApiServidor } from '../src/main/server/api.server.js'
import { login, logout } from '../src/main/services/auth.service.js'
import { crearUsuario } from '../src/main/services/usuarios.service.js'

let db = null
let server = null
let base = null
let tmp = null

async function levantar() {
  limpiarCanales()
  db = nuevaBaseEnMemoria()
  registrarCanales()
  await new Promise((resolve) => {
    server = iniciarApiServidor({
      puerto: 0,
      version: 'test',
      onListen: (puerto) => {
        base = `http://127.0.0.1:${puerto}`
        resolve()
      }
    })
  })
}

afterEach(async () => {
  server?.close()
  server = null
  db?.close()
  db = null
  tmp && rmSync(tmp, { recursive: true, force: true })
  tmp = null
})

const post = async (ruta, cuerpo, token = null) => {
  const resp = await fetch(`${base}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(cuerpo)
  })
  return { status: resp.status, datos: await resp.json() }
}

const loginHttp = async (usuario, password) => (await post('/api/login', { usuario, password })).datos

test('health responde sin auth para "Probar conexión"', async () => {
  await levantar()
  const resp = await fetch(`${base}/api/health`)
  const datos = await resp.json()
  assert.equal(resp.status, 200)
  assert.equal(datos.modo, 'servidor')
})

test('login por HTTP devuelve usuario+token sin tocar la sesión local', async () => {
  await levantar()
  login({ usuario: 'admin', password: 'admin123' }) // sesión de la ventana del servidor
  crearUsuario({ nombre: 'Luis', usuario: 'luis', password: 'clave1', rol: 'vendedor' })

  const { usuario, token } = await loginHttp('luis', 'clave1')
  assert.equal(usuario.usuario, 'luis')
  assert.ok(token)

  const mal = await post('/api/login', { usuario: 'luis', password: 'mala' })
  assert.equal(mal.status, 401)
  assert.match(mal.datos.error, /incorrectos/)

  // La sesión local del servidor sigue siendo admin.
  const sesion = await ejecutarCanal('auth:sesion', [])
  assert.equal(sesion.usuario, 'admin')
})

test('invoke exige token y aplica las guardas por rol', async () => {
  await levantar()
  crearUsuario({ nombre: 'Luis', usuario: 'luis', password: 'clave1', rol: 'vendedor' })
  crearUsuario({ nombre: 'Ana', usuario: 'ana', password: 'clave1', rol: 'administrador' })
  const { token: tokenVendedor } = await loginHttp('luis', 'clave1')
  const { token: tokenAdmin } = await loginHttp('ana', 'clave1')

  // Sin token → 401
  assert.equal((await post('/api/invoke', { canal: 'usuarios:listar' })).status, 401)
  assert.equal((await post('/api/invoke', { canal: 'usuarios:listar' }, 'token-falso')).status, 401)

  // Vendedor: lista usuarios no requiere permiso… pero crear producto sí.
  const lista = await post('/api/invoke', { canal: 'usuarios:listar', args: [] }, tokenVendedor)
  assert.equal(lista.status, 200)
  assert.ok(Array.isArray(lista.datos.data))

  const prohibido = await post('/api/invoke', {
    canal: 'productos:crear',
    args: [{ nombre: 'X', usuarioId: 1 }]
  }, tokenVendedor)
  assert.equal(prohibido.status, 403)
  assert.match(prohibido.datos.error, /permiso/)

  const permitido = await post('/api/invoke', {
    canal: 'productos:crear',
    args: [{ nombre: 'Filtro de aire', usuarioId: 1 }]
  }, tokenAdmin)
  assert.equal(permitido.status, 200)
  assert.equal(db.prepare("SELECT COUNT(*) n FROM productos WHERE nombre = 'Filtro de aire'").get().n, 1)
})

test('una venta creada por un esclavo queda en la BD del servidor con el rol correcto', async () => {
  await levantar()
  crearUsuario({ nombre: 'Luis', usuario: 'luis', password: 'clave1', rol: 'vendedor' })
  const adminId = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id
  const { token } = await loginHttp('luis', 'clave1')

  const { token: tokenAdmin } = await loginHttp('admin', 'admin123')
  const tasa = await post('/api/invoke', { canal: 'tasas:registrar', args: [{ valorBcv: 100, valorUsdt: 120, usuarioId: adminId }] }, token)
  assert.equal(tasa.status, 200)

  const prov = await post('/api/invoke', { canal: 'proveedores:crear', args: [{ nombre: 'Proveedor X' }] }, tokenAdmin)
  const prod = await post('/api/invoke', { canal: 'productos:crear', args: [{ nombre: 'Bujía' }] }, tokenAdmin)
  const entrada = await post('/api/invoke', {
    canal: 'inventario:registrarEntrada',
    args: [{ productoId: prod.datos.data.id, cantidad: 5, proveedorId: prov.datos.data.id, precioCompraUsd: 10, usuarioId: adminId, margenes: [] }]
  }, tokenAdmin)
  assert.equal(entrada.status, 200)

  const precioId = db.prepare('SELECT id FROM precios WHERE producto_id = ?').get(prod.datos.data.id).id
  const cliente = await post('/api/invoke', { canal: 'clientes:crear', args: [{ nombre: 'Cliente Red' }] }, token)
  const venta = await post('/api/invoke', {
    canal: 'ventas:crear',
    args: [{ clienteId: cliente.datos.data.id, usuarioId: adminId, items: [{ precioId, cantidad: 1 }] }]
  }, token)
  assert.equal(venta.status, 200)
  assert.match(venta.datos.data.numero_ticket, /^T-/)
})

test('logout remoto cierra solo ese token, no la sesión local', async () => {
  await levantar()
  login({ usuario: 'admin', password: 'admin123' })
  const { token } = await loginHttp('admin', 'admin123')

  assert.equal((await post('/api/invoke', { canal: 'usuarios:listar' }, token)).status, 200)
  await post('/api/logout', { token })
  assert.equal((await post('/api/invoke', { canal: 'usuarios:listar' }, token)).status, 401)

  // La ventana del servidor sigue con su sesión.
  assert.equal((await ejecutarCanal('auth:sesion', [])).usuario, 'admin')
  logout()
})

test('auth:* no se expone por invoke (no debe tocar la sesión local del servidor)', async () => {
  await levantar()
  const { token } = await loginHttp('admin', 'admin123')
  const resp = await post('/api/invoke', { canal: 'auth:login', args: [{ usuario: 'admin', password: 'admin123' }] }, token)
  assert.equal(resp.status, 400)
})

test('los canales registrados incluyen los de datos para imprimir en el esclavo', async () => {
  await levantar()
  for (const canal of ['impresora:datosTicketVenta', 'impresora:datosReporteCierre', 'impresora:datosReporteDiario', 'appConfig:obtener']) {
    assert.ok(listarCanales().includes(canal), canal)
  }
})
