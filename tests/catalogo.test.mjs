import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import Database from 'better-sqlite3'

const dbDir = join(dirname(fileURLToPath(import.meta.url)), '../src/main/db')

function ejecutarSql(db, carpeta) {
  for (const nombre of readdirSync(carpeta).filter((n) => n.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(carpeta, nombre), 'utf8'))
  }
}

function nuevaBase() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = OFF')
  ejecutarSql(db, join(dbDir, 'migrations'))
  db.pragma('foreign_keys = ON')
  ejecutarSql(db, join(dbDir, 'seeds'))
  return db
}

test('base limpia tiene los tres tipos de precio con margen 100 y costo de compra', () => {
  const db = nuevaBase()
  try {
    assert.deepEqual(
      db.prepare('SELECT nombre FROM tipos_precio ORDER BY orden').all().map((t) => t.nombre),
      ['Precio Full', 'Precio Especial', 'Precio Interno']
    )
    assert.deepEqual(
      db.prepare('SELECT DISTINCT margen_default, activo FROM tipos_precio').all(),
      [{ margen_default: 100, activo: 1 }]
    )
    assert.ok(db.prepare('PRAGMA table_info(productos)').all().some((col) => col.name === 'precio_compra_usd'))
    ejecutarSql(db, join(dbDir, 'seeds'))
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tipos_precio').get().n, 3)
  } finally {
    db.close()
  }
})

test('el catálogo admite productos sin entrada y editar datos conserva sus precios', () => {
  const db = nuevaBase()
  try {
    const id = db.prepare(
      'INSERT INTO productos (codigo, nombre, marca, descripcion, unidad_medida) VALUES (?, ?, ?, ?, ?)'
    ).run('PR-1', 'Repuesto', 'Marca', '', 'unidad').lastInsertRowid
    const sinEntrada = db.prepare('SELECT precio_compra_usd FROM productos WHERE id = ?').get(id)
    assert.equal(sinEntrada.precio_compra_usd, null)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM precios WHERE producto_id = ?').get(id).n, 0)
    const tipo = db.prepare("SELECT id FROM tipos_precio WHERE nombre = 'Precio Full'").get().id
    db.prepare('INSERT INTO precios (producto_id, tipo_precio_id, valor_usd) VALUES (?, ?, ?)').run(id, tipo, 10)
    db.prepare('UPDATE productos SET nombre = ? WHERE id = ?').run('Repuesto actualizado', id)
    assert.equal(db.prepare('SELECT valor_usd FROM precios WHERE producto_id = ?').get(id).valor_usd, 10)
    assert.equal(db.prepare('SELECT precio_compra_usd FROM productos WHERE id = ?').get(id).precio_compra_usd, null)
  } finally {
    db.close()
  }
})

test('seed de simulacion usa solo los tres tipos y guarda costos de compra', () => {
  const db = nuevaBase()
  try {
    ejecutarSql(db, join(dbDir, 'seeds/dev'))
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM productos WHERE precio_compra_usd IS NULL').get().n, 0)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ventas').get().n, 120)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tipos_precio').get().n, 3)
    // Los precios demo son coherentes con el modelo de márgenes:
    // valor_usd = round2(costo × (1 + margen/100)).
    assert.equal(
      db.prepare(
        `SELECT COUNT(*) AS n FROM precios p
         JOIN productos pr ON pr.id = p.producto_id
         WHERE ABS(p.valor_usd - ROUND(pr.precio_compra_usd * (1 + p.margen / 100.0), 2)) > 0.001`
      ).get().n,
      0
    )
  } finally {
    db.close()
  }
})

test('proveedores se vinculan a las entradas sin perder el historial al desactivarlos', () => {
  const db = nuevaBase()
  try {
    db.exec(readFileSync(join(dbDir, 'seeds/dev/001_datos_demo.sql'), 'utf8'))
    const proveedorId = db.prepare("INSERT INTO proveedores (nombre) VALUES ('Repuestos Norte')").run().lastInsertRowid
    const productoId = db.prepare('SELECT id FROM productos LIMIT 1').get().id
    const usuarioId = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id
    db.prepare(
      "INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, saldo, motivo, usuario_id, proveedor_id) VALUES (?, 'entrada', 1, 1, 'Compra', ?, ?)"
    ).run(productoId, usuarioId, proveedorId)
    db.prepare('UPDATE proveedores SET activo = 0 WHERE id = ?').run(proveedorId)
    assert.equal(
      db.prepare('SELECT p.nombre FROM inventario_movimientos im JOIN proveedores p ON p.id = im.proveedor_id WHERE im.proveedor_id = ?').get(proveedorId).nombre,
      'Repuestos Norte'
    )
    assert.throws(() => db.prepare(
      "INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, saldo, motivo, usuario_id, proveedor_id) VALUES (?, 'entrada', 1, 1, 'Compra', ?, 99999)"
    ).run(productoId, usuarioId), /FOREIGN KEY/)
  } finally {
    db.close()
  }
})
