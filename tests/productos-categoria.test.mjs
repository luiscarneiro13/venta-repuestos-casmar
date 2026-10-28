import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import { crearProducto, actualizarProducto, listarProductos } from '../src/main/services/productos.service.js'
import { categoriasProducto } from '../src/main/services/categorias.service.js'

const dbDir = join(dirname(fileURLToPath(import.meta.url)), '../src/main/db')
const leer = (ruta) => readFileSync(join(dbDir, ruta), 'utf8')

let db = null
afterEach(() => {
  db?.close()
  db = null
})

const idCategoria = (nombre) => categoriasProducto.listar({ incluirInactivas: true }).find((c) => c.nombre === nombre).id

test('el producto guarda la categoría y la devuelve con su nombre', () => {
  db = nuevaBaseEnMemoria()
  const frenos = idCategoria('Frenos')
  const p = crearProducto({ codigo: 'PF-1', nombre: 'Pastillas', categoriaId: frenos })
  assert.equal(p.categoria_id, frenos)
  assert.equal(p.categoria_nombre, 'Frenos')

  const filtros = idCategoria('Filtros')
  assert.equal(actualizarProducto(p.id, { nombre: 'Pastillas', categoriaId: filtros }).categoria_nombre, 'Filtros')
  assert.equal(actualizarProducto(p.id, { nombre: 'Pastillas', categoriaId: null }).categoria_id, null)
})

test('la categoría es opcional y debe existir', () => {
  db = nuevaBaseEnMemoria()
  assert.equal(crearProducto({ nombre: 'Sin categoría' }).categoria_id, null)
  assert.equal(crearProducto({ nombre: 'Vacía', categoriaId: '' }).categoria_id, null)
  assert.throws(() => crearProducto({ nombre: 'X', categoriaId: 99999 }), /no existe/)
})

test('no se asigna una categoría desactivada, pero el producto que ya la tenía la conserva', () => {
  db = nuevaBaseEnMemoria()
  const sensores = idCategoria('Sensores')
  const p = crearProducto({ nombre: 'Sensor O2', categoriaId: sensores })
  categoriasProducto.desactivar(sensores)

  assert.throws(() => crearProducto({ nombre: 'Otro sensor', categoriaId: sensores }), /desactivada/)
  // Editar otro dato sin cambiar la categoría sigue funcionando.
  assert.equal(actualizarProducto(p.id, { nombre: 'Sensor O2 Bosch', categoriaId: sensores }).categoria_id, sensores)
})

test('una categoría con productos no se elimina (se desactiva); sin productos sí', () => {
  db = nuevaBaseEnMemoria()
  const escape = idCategoria('Escape')
  const p = crearProducto({ nombre: 'Silenciador', categoriaId: escape })
  assert.throws(() => categoriasProducto.eliminar(escape), /1 productos asignados: desactívala/)

  actualizarProducto(p.id, { nombre: 'Silenciador', categoriaId: null })
  categoriasProducto.eliminar(escape)
  assert.ok(!categoriasProducto.listar({ incluirInactivas: true }).some((c) => c.id === escape))
})

test('la búsqueda del catálogo también encuentra por categoría', () => {
  db = nuevaBaseEnMemoria()
  crearProducto({ nombre: 'Bujía NGK', categoriaId: idCategoria('Encendido') })
  crearProducto({ nombre: 'Filtro de aire' })
  assert.deepEqual(listarProductos({ texto: 'encendido' }).map((p) => p.nombre), ['Bujía NGK'])
})

test('seed 005: asigna una sola vez la categoría desde el texto que tenían los productos viejos', () => {
  db = nuevaBaseEnMemoria()
  const viejo = (nombre, descripcion) =>
    db.prepare('INSERT INTO productos (nombre, descripcion) VALUES (?, ?)').run(nombre, descripcion).lastInsertRowid
  const ids = {
    exacto: viejo('Filtro A', 'filtros'),
    prefijo: viejo('Correa B', 'Correas'),
    contiene: viejo('Alternador C', 'Eléctrico'),
    sinCoincidencia: viejo('Cosa D', 'Misceláneos'),
    vacio: viejo('Cosa E', '')
  }
  // La marca ya existe (la BD nueva corrió el seed): se borra para simular
  // una instalación que recién actualiza a esta versión.
  db.prepare("DELETE FROM configuracion WHERE clave = 'seed_productos_categoria'").run()
  db.exec(leer('seeds/005_productos_categoria.sql'))

  const categoriaDe = (id) => db.prepare(
    'SELECT cp.nombre FROM productos p LEFT JOIN categorias_producto cp ON cp.id = p.categoria_id WHERE p.id = ?'
  ).get(id).nombre
  assert.equal(categoriaDe(ids.exacto), 'Filtros')
  assert.equal(categoriaDe(ids.prefijo), 'Correas y cadenas')
  assert.equal(categoriaDe(ids.contiene), 'Sistema eléctrico')
  assert.equal(categoriaDe(ids.sinCoincidencia), null)
  assert.equal(categoriaDe(ids.vacio), null)

  // Segunda corrida: no toca lo que el usuario cambió después.
  db.prepare('UPDATE productos SET categoria_id = NULL WHERE id = ?').run(ids.exacto)
  db.exec(leer('seeds/005_productos_categoria.sql'))
  assert.equal(categoriaDe(ids.exacto), null)
})

test('seed demo: los 12 repuestos quedan con su categoría', () => {
  db = nuevaBaseEnMemoria()
  db.exec(leer('seeds/dev/001_datos_demo.sql'))
  const sin = db.prepare('SELECT COUNT(*) AS n FROM productos WHERE categoria_id IS NULL').get().n
  assert.equal(sin, 0)
  assert.equal(
    listarProductos().find((p) => p.codigo === 'BJ-0017').categoria_nombre,
    'Encendido'
  )
})
