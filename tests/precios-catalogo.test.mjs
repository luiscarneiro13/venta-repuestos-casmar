import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import { listarPreciosCatalogo, listarPreciosPorProducto } from '../src/main/services/precios.service.js'
import { registrarTasa } from '../src/main/services/tasas.service.js'
import { registrarEntrada } from '../src/main/services/inventario.service.js'

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

function crearProductoConProveedor(db, { costo = 1000 } = {}) {
  const productoId = db
    .prepare("INSERT INTO productos (codigo, nombre, marca, precio_compra_usd) VALUES ('TST-1', 'Producto prueba', 'Marca X', ?)")
    .run(costo).lastInsertRowid
  const proveedorId = db
    .prepare("INSERT INTO proveedores (nombre, activo) VALUES ('Proveedor T', 1)")
    .run().lastInsertRowid
  return { productoId, proveedorId }
}

test('listarPreciosCatalogo devuelve producto × tipos activos con las tres monedas', () => {
  const db = base()
  const usuarioId = adminId(db)
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })

  const { productoId, proveedorId } = crearProductoConProveedor(db)
  registrarEntrada({ productoId, cantidad: 5, proveedorId, precioCompraUsd: 1000, usuarioId, margenes: [] })

  const catalogo = listarPreciosCatalogo()
  const tipos = db.prepare("SELECT id, nombre FROM tipos_precio WHERE activo = 1").all()
  assert.ok(tipos.length >= 3)

  const filas = catalogo.filter((f) => f.productoId === productoId)
  assert.equal(filas.length, tipos.length)

  // costo 1000, margen default 100 → $2000 → Bs 200.000 → USDT 1.666,67
  // Al guardar la entrada los márgenes se materializan como propios del
  // producto (regla aprobada: se persisten tal como se ven en el formulario).
  const full = filas.find((f) => f.tipoPrecioNombre === 'Precio Full')
  assert.equal(full.margen, 100)
  assert.equal(full.margenOrigen, 'propio')
  assert.equal(full.precioUsd, 2000)
  assert.equal(full.precioBs, 200000)
  assert.equal(full.precioUsdt, 1666.67)
})

test('producto sin costo aparece con precios en null', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const productoId = db
    .prepare("INSERT INTO productos (codigo, nombre) VALUES ('TST-2', 'Sin costo')")
    .run().lastInsertRowid

  const filas = listarPreciosCatalogo().filter((f) => f.productoId === productoId)
  assert.ok(filas.length > 0)
  for (const f of filas) {
    assert.equal(f.precioUsd, null)
    assert.equal(f.precioBs, null)
    assert.equal(f.precioUsdt, null)
  }
})

test('un tipo creado después de la entrada se materializa al listar y queda vendible', () => {
  const db = base()
  const usuarioId = adminId(db)
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })
  const { productoId, proveedorId } = crearProductoConProveedor(db)
  registrarEntrada({ productoId, cantidad: 5, proveedorId, precioCompraUsd: 1000, usuarioId, margenes: [] })

  // El producto ya tiene entrada; ahora se crea un tipo nuevo con margen 150.
  const tipoId = db
    .prepare("INSERT INTO tipos_precio (nombre, orden, margen_default, activo) VALUES ('Precio Nuevo', 9, 150, 1)")
    .run().lastInsertRowid

  const filas = listarPreciosPorProducto(productoId)
  const nuevo = filas.find((f) => f.tipoPrecioId === tipoId)
  // Aparece con id real (seleccionable en la venta), margen default del tipo
  // heredado y las tres monedas calculadas: 1000×2,5 = $2500 → Bs 250.000 → 2083,33 USDT.
  assert.ok(nuevo.id != null)
  assert.equal(nuevo.margen, 150)
  assert.equal(nuevo.margenOrigen, 'default')
  assert.equal(nuevo.precioUsd, 2500)
  assert.equal(nuevo.precioBs, 250000)
  assert.equal(nuevo.precioUsdt, 2083.33)
})

test('el catálogo y la ficha del producto calculan lo mismo', () => {
  const db = base()
  const usuarioId = adminId(db)
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })
  const { productoId, proveedorId } = crearProductoConProveedor(db)
  registrarEntrada({ productoId, cantidad: 3, proveedorId, precioCompraUsd: 500, usuarioId, margenes: [] })

  const ficha = listarPreciosPorProducto(productoId)
  const catalogo = listarPreciosCatalogo().filter((f) => f.productoId === productoId)
  assert.equal(catalogo.length, ficha.length)
  for (const f of ficha) {
    const c = catalogo.find((x) => x.tipoPrecioId === f.tipoPrecioId)
    assert.equal(c.precioUsd, f.precioUsd)
    assert.equal(c.precioBs, f.precioBs)
    assert.equal(c.precioUsdt, f.precioUsdt)
    assert.equal(c.margen, f.margen)
  }
})
