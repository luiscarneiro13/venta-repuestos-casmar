// Niveles de acceso: Admin de Sistema (protegido), Administrador y Vendedor.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'
import Database from 'better-sqlite3'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import { PERMISOS, ROLES_ASIGNABLES, puede, nombreRol } from '../src/shared/permisos.js'
import { login, logout, sesionActual, exigirPermiso } from '../src/main/services/auth.service.js'
import { conPermiso } from '../src/main/ipc/permisos.js'
import {
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  verificarPasswordAdmin,
  listarRoles
} from '../src/main/services/usuarios.service.js'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const dbDir = join(raiz, 'src/main/db')

let db = null
afterEach(() => {
  logout()
  db?.close()
  db = null
})

const idDe = (usuario) => db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuario).id

// ---------- Base de datos ----------
test('la BD tiene los 3 niveles y el usuario admin es el Admin de Sistema', () => {
  db = nuevaBaseEnMemoria()
  assert.deepEqual(
    listarRoles().map((r) => [r.clave, r.nombre, r.asignable]),
    [['sistema', 'Admin de Sistema', 0], ['administrador', 'Administrador', 1], ['vendedor', 'Vendedor', 1]]
  )
  assert.equal(db.prepare("SELECT rol FROM usuarios WHERE usuario = 'admin'").get().rol, 'sistema')
})

test('al actualizar una instalación existente, admin pasa a "sistema" y los demás conservan su rol', () => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = OFF')
  const migraciones = readdirSync(join(dbDir, 'migrations')).filter((f) => f.endsWith('.sql')).sort()
  for (const f of migraciones.filter((m) => m < '024')) db.exec(readFileSync(join(dbDir, 'migrations', f), 'utf8'))
  const ins = db.prepare("INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?, ?, 'x:y', ?)")
  ins.run('Admin', 'admin', 'administrador')
  ins.run('Ana', 'ana', 'administrador')
  ins.run('Luis', 'luis', 'vendedor')
  ins.run('Raro', 'raro', 'supervisor')
  for (const f of migraciones.filter((m) => m >= '024')) db.exec(readFileSync(join(dbDir, 'migrations', f), 'utf8'))
  const rol = (u) => db.prepare('SELECT rol FROM usuarios WHERE usuario = ?').get(u).rol
  assert.equal(rol('admin'), 'sistema')
  assert.equal(rol('ana'), 'administrador')
  assert.equal(rol('luis'), 'vendedor')
  assert.equal(rol('raro'), 'vendedor', 'un rol desconocido baja al de menos privilegios')
})

// ---------- Matriz de permisos ----------
test('vendedor: vende y consulta, pero no gestiona productos, inventario, usuarios ni configuración', () => {
  for (const p of ['catalogo.gestionar', 'inventario.gestionar', 'usuarios.gestionar', 'configuracion.gestionar', 'ventas.anular']) {
    assert.equal(puede('vendedor', p), false, p)
  }
  for (const p of ['ventas.crear', 'clientes.gestionar', 'reportes.ver']) assert.equal(puede('vendedor', p), true, p)
})

test('administrador y Admin de Sistema tienen todos los permisos', () => {
  for (const p of Object.keys(PERMISOS)) {
    assert.equal(puede('administrador', p), true, p)
    assert.equal(puede('sistema', p), true, p)
  }
  assert.equal(puede(undefined, 'ventas.crear'), false)
  assert.throws(() => puede('administrador', 'no.existe'), /desconocido/)
  assert.deepEqual(ROLES_ASIGNABLES, ['administrador', 'vendedor'])
  assert.equal(nombreRol('sistema'), 'Admin de Sistema')
})

// ---------- Login y sesión ----------
test('el login verifica la contraseña y no revela si el usuario existe', () => {
  db = nuevaBaseEnMemoria()
  assert.throws(() => login({ usuario: 'admin', password: 'mala' }), /Usuario o contraseña incorrectos/)
  assert.throws(() => login({ usuario: 'nadie', password: 'admin123' }), /Usuario o contraseña incorrectos/)
  assert.throws(() => login({ usuario: 'admin' }), /Usuario o contraseña incorrectos/)
  assert.equal(sesionActual(), null)

  const u = login({ usuario: 'ADMIN', password: 'admin123' })
  assert.deepEqual(Object.keys(u).sort(), ['id', 'nombre', 'rol', 'usuario'], 'nunca devuelve el hash')
  assert.equal(u.rol, 'sistema')
  logout()
  assert.equal(sesionActual(), null)
})

test('las guardas exigen sesión y permiso; el cambio de rol aplica de inmediato', () => {
  db = nuevaBaseEnMemoria()
  crearUsuario({ nombre: 'Luis', usuario: 'luis', password: 'clave1', rol: 'vendedor' })
  const crearProducto = conPermiso('catalogo.gestionar', () => 'creado')

  assert.throws(() => crearProducto({}), /iniciar sesión/)
  login({ usuario: 'luis', password: 'clave1' })
  assert.throws(() => crearProducto({}), /No tienes permiso/)
  assert.equal(conPermiso('ventas.crear', () => 'vendido')({}), 'vendido')

  // Un administrador lo asciende: la próxima acción ya lo permite.
  db.prepare("UPDATE usuarios SET rol = 'administrador' WHERE usuario = 'luis'").run()
  assert.equal(crearProducto({}), 'creado')
  assert.equal(sesionActual().rol, 'administrador')

  // Si lo eliminan, la sesión se invalida.
  db.prepare("DELETE FROM usuarios WHERE usuario = 'luis'").run()
  assert.throws(() => exigirPermiso('ventas.crear'), /ya no existe/)
  assert.equal(sesionActual(), null)
})

// ---------- Reglas del Admin de Sistema ----------
test('nadie puede editar ni eliminar al Admin de Sistema', () => {
  db = nuevaBaseEnMemoria()
  const id = idDe('admin')
  assert.throws(() => actualizarUsuario(id, { nombre: 'X', usuario: 'admin', rol: 'administrador' }), /no se puede editar/)
  assert.throws(() => actualizarUsuario(id, { nombre: 'X', usuario: 'admin', rol: 'administrador', password: 'nueva' }), /no se puede editar/)
  assert.throws(() => eliminarUsuario(id), /no se puede eliminar/)
  assert.ok(verificarPasswordAdmin('admin123'))
})

test('no se pueden crear ni asignar otros Admin de Sistema', () => {
  db = nuevaBaseEnMemoria()
  assert.throws(() => crearUsuario({ nombre: 'Otro', usuario: 'otro', password: 'x', rol: 'sistema' }), /El rol debe ser/)
  const ana = crearUsuario({ nombre: 'Ana', usuario: 'ana', password: 'x', rol: 'vendedor' })
  assert.throws(() => actualizarUsuario(ana.id, { nombre: 'Ana', usuario: 'ana', rol: 'sistema' }), /El rol debe ser/)
})

test('se pueden agregar y editar administradores y vendedores', () => {
  db = nuevaBaseEnMemoria()
  const admin = crearUsuario({ nombre: 'Ana', usuario: 'ana', password: 'clave', rol: 'administrador' })
  const vendedor = crearUsuario({ nombre: 'Luis', usuario: 'luis', password: 'clave', rol: 'vendedor' })
  assert.equal(admin.rol, 'administrador')
  assert.equal(vendedor.rol, 'vendedor')
  assert.equal(actualizarUsuario(vendedor.id, { nombre: 'Luis', usuario: 'luis', rol: 'administrador' }).rol, 'administrador')
  // Login con la contraseña del usuario creado.
  assert.equal(login({ usuario: 'ana', password: 'clave' }).rol, 'administrador')
})

test('nadie se elimina a sí mismo', () => {
  db = nuevaBaseEnMemoria()
  const ana = crearUsuario({ nombre: 'Ana', usuario: 'ana', password: 'x', rol: 'administrador' })
  assert.throws(() => eliminarUsuario(ana.id, ana.id), /tu propio usuario/)
  eliminarUsuario(ana.id, idDe('admin'))
})

// ---------- Ningún canal de escritura sin guarda ----------
test('todos los IPC que modifican productos, inventario, catálogo, usuarios o configuración tienen guarda', () => {
  const ipcDir = join(raiz, 'src/main/ipc')
  const codigo = readdirSync(ipcDir).filter((f) => f.endsWith('.ipc.js')).map((f) => readFileSync(join(ipcDir, f), 'utf8')).join('\n')
  const deben = [
    'productos:crear', 'productos:actualizar', 'productos:eliminar', 'productos:reactivar',
    'tiposPrecio:crear', 'tiposPrecio:actualizar', 'tiposPrecio:eliminar',
    'proveedores:crear', 'proveedores:actualizar', 'proveedores:desactivar', 'proveedores:reactivar',
    'inventario:registrarEntrada', 'inventario:registrarAjusteSalida', 'inventario:editarMovimiento',
    'usuarios:crear', 'usuarios:actualizar', 'usuarios:eliminar',
    'configuracion:guardarIva', 'impresora:guardar', 'sistema:reiniciarBaseDatos', 'sistema:exportarBackup',
    'ventas:anular', 'ventas:crear'
  ]
  for (const canal of deben) {
    const linea = codigo.split('\n').find((l) => l.includes(`'${canal}'`))
    assert.ok(linea, `no se encontró ${canal}`)
    assert.ok(linea.includes('conPermiso('), `${canal} no tiene guarda de permiso`)
  }
  // Categorías: el registro genérico envuelve crear/actualizar/desactivar/reactivar/eliminar.
  const categorias = readFileSync(join(ipcDir, 'categorias.ipc.js'), 'utf8')
  for (const accion of ['crear', 'actualizar', 'desactivar', 'reactivar', 'eliminar']) {
    assert.match(categorias, new RegExp(`:${accion}\`, gestionar\\(`), `categorías:${accion} sin guarda`)
  }
})
