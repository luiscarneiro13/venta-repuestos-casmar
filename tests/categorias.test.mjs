import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import { categoriasProveedor, categoriasProducto } from '../src/main/services/categorias.service.js'

const seeds = join(dirname(fileURLToPath(import.meta.url)), '../src/main/db/seeds')

// Mismo comportamiento para los dos catálogos de categorías.
const CATALOGOS = [
  {
    nombre: 'proveedores',
    servicio: categoriasProveedor,
    seed: '003_categorias_proveedor.sql',
    cantidad: 20,
    esperadas: ['Motor', 'Frenos', 'Sistema eléctrico', 'Filtros', 'Lubricantes y fluidos'],
    aRenombrar: 'Motor'
  },
  {
    nombre: 'productos',
    servicio: categoriasProducto,
    seed: '004_categorias_producto.sql',
    cantidad: 24,
    esperadas: ['Frenos', 'Filtros', 'Sensores', 'Encendido', 'Empacaduras y sellos'],
    aRenombrar: 'Motor'
  }
]

let db = null
afterEach(() => {
  db?.close()
  db = null
})

for (const cat of CATALOGOS) {
  const s = cat.servicio

  test(`[${cat.nombre}] el seed carga las categorías comunes de repuestos`, () => {
    db = nuevaBaseEnMemoria()
    const nombres = s.listar().map((c) => c.nombre)
    assert.equal(nombres.length, cat.cantidad)
    for (const n of cat.esperadas) assert.ok(nombres.includes(n), `falta ${n}`)
    assert.ok(s.listar().every((c) => c.descripcion), 'todas traen descripción')
  })

  test(`[${cat.nombre}] el seed corre una sola vez: lo borrado o renombrado no reaparece`, () => {
    db = nuevaBaseEnMemoria()
    s.eliminar(s.listar().find((c) => c.nombre === 'Frenos').id)
    const motor = s.listar().find((c) => c.nombre === cat.aRenombrar)
    s.actualizar(motor.id, { nombre: `${cat.aRenombrar} (editado)`, descripcion: '' })

    db.exec(readFileSync(join(seeds, cat.seed), 'utf8'))
    const nombres = s.listar().map((c) => c.nombre)
    assert.ok(!nombres.includes('Frenos'))
    assert.ok(!nombres.includes(cat.aRenombrar))
    assert.ok(nombres.includes(`${cat.aRenombrar} (editado)`))
    assert.equal(nombres.length, cat.cantidad - 1)
  })

  test(`[${cat.nombre}] CRUD: crear, editar, desactivar, reactivar y eliminar`, () => {
    db = nuevaBaseEnMemoria()
    const c = s.crear({ nombre: '  Tapicería  ', descripcion: ' Asientos ' })
    assert.equal(c.nombre, 'Tapicería')
    assert.equal(c.descripcion, 'Asientos')
    assert.equal(s.actualizar(c.id, { nombre: 'Tapicería y vidrios' }).nombre, 'Tapicería y vidrios')

    s.desactivar(c.id)
    assert.ok(!s.listar().some((x) => x.id === c.id))
    assert.ok(s.listar({ incluirInactivas: true }).some((x) => x.id === c.id))
    s.reactivar(c.id)
    assert.ok(s.listar().some((x) => x.id === c.id))

    s.eliminar(c.id)
    assert.throws(() => s.eliminar(c.id), /no existe/)
  })

  test(`[${cat.nombre}] valida nombre obligatorio y único (sin importar mayúsculas)`, () => {
    db = nuevaBaseEnMemoria()
    assert.throws(() => s.crear({ nombre: '   ' }), /obligatorio/)
    assert.throws(() => s.crear({ nombre: 'frenos' }), /Ya existe/)
  })
}

test('los dos catálogos son independientes', () => {
  db = nuevaBaseEnMemoria()
  const nueva = categoriasProducto.crear({ nombre: 'Solo productos' })
  assert.ok(!categoriasProveedor.listar().some((c) => c.nombre === 'Solo productos'))
  categoriasProducto.eliminar(nueva.id)
  assert.ok(categoriasProveedor.listar().some((c) => c.nombre === 'Frenos'))
})
