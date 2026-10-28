// Restablecer base de datos: borra lo operativo y conserva categorías,
// usuarios, roles, tipos de precio y configuración.
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import { reiniciarBaseDeDatos } from '../src/main/db/connection.js'
import { registrarTasa } from '../src/main/services/tasas.service.js'
import { registrarEntrada } from '../src/main/services/inventario.service.js'
import { crearCliente } from '../src/main/services/clientes.service.js'
import { crearVenta } from '../src/main/services/ventas.service.js'
import { crearUsuario } from '../src/main/services/usuarios.service.js'
import { categoriasProducto, categoriasProveedor } from '../src/main/services/categorias.service.js'

let db = null
afterEach(() => {
  db?.close()
  db = null
})

const contar = (tabla) => db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get().n

test('el reinicio borra lo operativo y conserva categorías, usuarios y roles', () => {
  db = nuevaBaseEnMemoria()
  const usuarioId = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id

  // Llenar cada tabla operativa.
  const vendedor = crearUsuario({ nombre: 'Luis', usuario: 'luis', password: 'clave', rol: 'vendedor' })
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })
  const productoId = db.prepare("INSERT INTO productos (codigo, nombre) VALUES ('P-1', 'Producto')").run().lastInsertRowid
  const proveedorId = db.prepare("INSERT INTO proveedores (nombre, activo) VALUES ('Proveedor', 1)").run().lastInsertRowid
  registrarEntrada({ productoId, cantidad: 5, proveedorId, precioCompraUsd: 1000, usuarioId, margenes: [] })
  const precioId = db.prepare('SELECT id FROM precios WHERE producto_id = ? LIMIT 1').get(productoId).id
  const clienteId = crearCliente({ nombre: 'Cliente' }).id
  crearVenta({ clienteId, usuarioId, items: [{ precioId, cantidad: 1 }] })
  db.prepare("INSERT INTO cajas (usuario_apertura_id, tasa_apertura, estado) VALUES (?, 100, 'abierta')").run(usuarioId)
  db.prepare("INSERT INTO cierres_caja (usuario_id, tasa_valor, desde, hasta, total_contado_usd, total_credito_usd, total_cobrado_creditos_usd) VALUES (?, 100, '2026-01-01', '2026-01-01', 0, 0, 0)").run(usuarioId)

  const catP = categoriasProducto.crear({ nombre: 'Cat Prueba P' }).id
  const catProv = categoriasProveedor.crear({ nombre: 'Cat Prueba Prov' }).id
  const tiposAntes = contar('tipos_precio')
  const ivaAntes = db.prepare("SELECT valor FROM configuracion WHERE clave = 'iva_porcentaje'").get().valor

  for (const t of ['ventas', 'venta_detalle', 'inventario_movimientos', 'cajas', 'cierres_caja', 'tasas_cambio', 'precios', 'productos', 'clientes', 'proveedores']) {
    assert.ok(contar(t) > 0, `${t} debía tener datos antes del reinicio`)
  }

  reiniciarBaseDeDatos()

  // Se borra todo lo operativo.
  for (const t of ['ventas', 'venta_detalle', 'inventario_movimientos', 'cajas', 'cierres_caja', 'tasas_cambio', 'precios', 'productos', 'clientes', 'proveedores']) {
    assert.equal(contar(t), 0, `${t} debía quedar vacía`)
  }

  // Se conserva la estructura de trabajo.
  assert.equal(contar('usuarios'), 2)
  assert.equal(contar('roles'), 3)
  assert.equal(db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(vendedor.id).rol, 'vendedor')
  assert.equal(contar('categorias_producto'), db.prepare('SELECT COUNT(*) n FROM categorias_producto').get().n)
  assert.ok(db.prepare('SELECT id FROM categorias_producto WHERE id = ?').get(catP), 'categoría de producto conservada')
  assert.ok(db.prepare('SELECT id FROM categorias_proveedor WHERE id = ?').get(catProv), 'categoría de proveedor conservada')
  assert.equal(contar('tipos_precio'), tiposAntes)
  assert.equal(db.prepare("SELECT valor FROM configuracion WHERE clave = 'iva_porcentaje'").get().valor, ivaAntes)
  assert.ok(contar('tipos_precio') >= 3)
})

test('después del reinicio se puede operar de nuevo (nueva venta T-0001)', () => {
  db = nuevaBaseEnMemoria()
  const usuarioId = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })
  const productoId = db.prepare("INSERT INTO productos (codigo, nombre) VALUES ('P-1', 'Producto')").run().lastInsertRowid
  const proveedorId = db.prepare("INSERT INTO proveedores (nombre, activo) VALUES ('Proveedor A', 1)").run().lastInsertRowid
  registrarEntrada({ productoId, cantidad: 5, proveedorId, precioCompraUsd: 1000, usuarioId, margenes: [] })
  const precioId = db.prepare('SELECT id FROM precios WHERE producto_id = ? LIMIT 1').get(productoId).id
  const clienteId = crearCliente({ nombre: 'Cliente' }).id
  crearVenta({ clienteId, usuarioId, items: [{ precioId, cantidad: 1 }] })

  reiniciarBaseDeDatos()

  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })
  const productoId2 = db.prepare("INSERT INTO productos (codigo, nombre) VALUES ('P-2', 'Otro')").run().lastInsertRowid
  const proveedorId2 = db.prepare("INSERT INTO proveedores (nombre, activo) VALUES ('Proveedor B', 1)").run().lastInsertRowid
  registrarEntrada({ productoId: productoId2, cantidad: 3, proveedorId: proveedorId2, precioCompraUsd: 500, usuarioId, margenes: [] })
  const precioId2 = db.prepare('SELECT id FROM precios WHERE producto_id = ? LIMIT 1').get(productoId2).id
  const clienteId2 = crearCliente({ nombre: 'Cliente B' }).id
  const venta = crearVenta({ clienteId: clienteId2, usuarioId, items: [{ precioId: precioId2, cantidad: 2 }] })
  assert.equal(venta.numero_ticket, 'T-0001')
})
