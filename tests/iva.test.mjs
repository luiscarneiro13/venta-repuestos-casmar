import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import { registrarTasa } from '../src/main/services/tasas.service.js'
import { registrarEntrada } from '../src/main/services/inventario.service.js'
import { crearVenta } from '../src/main/services/ventas.service.js'
import { crearCliente } from '../src/main/services/clientes.service.js'
import { obtenerIva, guardarIva } from '../src/main/services/configuracion.service.js'

let db = null

function base() {
  db?.close()
  db = nuevaBaseEnMemoria()
  return db
}

afterEach(() => {
  db?.close()
  db = null
})

const adminId = (db) => db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id

// Producto con costo 1000 y stock; su Precio Full (margen 100) queda en
// $2.000 → Bs 200.000 → 1.666,67 USDT con BCV 100 / Binance 120.
function prepararVentaBase(db) {
  const usuarioId = adminId(db)
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })
  const productoId = db
    .prepare("INSERT INTO productos (codigo, nombre) VALUES ('IVA-1', 'Producto IVA')")
    .run().lastInsertRowid
  const proveedorId = db
    .prepare("INSERT INTO proveedores (nombre, activo) VALUES ('Proveedor T', 1)")
    .run().lastInsertRowid
  registrarEntrada({ productoId, cantidad: 5, proveedorId, precioCompraUsd: 1000, usuarioId, margenes: [] })
  const precioId = db
    .prepare('SELECT id FROM precios WHERE producto_id = ? LIMIT 1')
    .get(productoId).id
  const clienteId = crearCliente({ nombre: 'Cliente IVA' }).id
  return { usuarioId, precioId, clienteId }
}

test('el IVA arranca en 16% y es editable dentro de 0–100', () => {
  base()
  assert.equal(obtenerIva(), 16)
  assert.equal(guardarIva(8), 8)
  assert.equal(obtenerIva(), 8)
  assert.throws(() => guardarIva(-1), /entre 0 y 100/)
  assert.throws(() => guardarIva(101), /entre 0 y 100/)
  assert.throws(() => guardarIva('abc'), /entre 0 y 100/)
})

test('la venta suma el IVA al final: total = base + IVA en las tres monedas', () => {
  const db = base()
  const { usuarioId, precioId, clienteId } = prepararVentaBase(db)

  const venta = crearVenta({ clienteId, usuarioId, metodoPago: 'bs', items: [{ precioId, cantidad: 2 }] })

  // IVA por unidad: $320 / Bs 32.000 / 266,67 USDT (1.666,67 × 16%).
  // Base: 2 × $2.000 = $4.000 → Bs 400.000 → 3.333,34 USDT
  // IVA:  2 × unitario = $640 → Bs 64.000 → 533,34 USDT
  // Total = precio con IVA × 2: $4.640 → Bs 464.000 → 3.866,68 USDT
  assert.equal(venta.iva_porcentaje, 16)
  assert.equal(venta.iva_usd, 640)
  assert.equal(venta.iva_bs, 64000)
  assert.equal(venta.iva_usdt, 533.34)
  assert.equal(venta.total_usd, 4640)
  assert.equal(venta.total_bs, 464000)
  assert.equal(venta.total_usdt, 3866.68)
})

test('cada venta congela el porcentaje vigente al cobrarse', () => {
  const db = base()
  const { usuarioId, precioId, clienteId } = prepararVentaBase(db)

  guardarIva(8)
  const venta = crearVenta({ clienteId, usuarioId, metodoPago: 'usdt', items: [{ precioId, cantidad: 1 }] })

  // Base $2.000, IVA 8% → $160 / Bs 16.000 / 133,33 USDT
  assert.equal(venta.iva_porcentaje, 8)
  assert.equal(venta.iva_usd, 160)
  assert.equal(venta.iva_bs, 16000)
  assert.equal(venta.iva_usdt, 133.33)
  assert.equal(venta.total_usd, 2160)
  assert.equal(venta.total_bs, 216000)
  assert.equal(venta.total_usdt, 1800)

  // Cambiar el % después no retroafecta la venta ya registrada.
  guardarIva(16)
  const guardada = db.prepare('SELECT iva_porcentaje, total_bs FROM ventas WHERE id = ?').get(venta.id)
  assert.equal(guardada.iva_porcentaje, 8)
  assert.equal(guardada.total_bs, 216000)
})

test('las gráficas de reportes reciben el total en USD y su equivalente en Bs (lo cobrado)', async () => {
  const db = base()
  const { usuarioId, precioId, clienteId } = prepararVentaBase(db)
  const venta = crearVenta({ clienteId, usuarioId, items: [{ precioId, cantidad: 2 }] })
  const { ventasProductosAgrupadas } = await import('../src/main/repositories/ventas.repo.js')
  const { consumoDiarioPorCliente, listarConConsumo } = await import('../src/main/repositories/clientes.repo.js')

  const [general] = ventasProductosAgrupadas('dia')
  assert.equal(general.total_usd, venta.total_usd)
  assert.equal(general.total_bs, venta.total_bs)
  const [cliente] = consumoDiarioPorCliente(clienteId, 'dia')
  assert.equal(cliente.total_usd, venta.total_usd)
  assert.equal(cliente.total_bs, venta.total_bs)
  const fila = listarConConsumo().find((c) => c.id === clienteId)
  assert.equal(fila.total_bs, venta.total_bs)
})
