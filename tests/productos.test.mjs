import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import {
  crearProducto,
  actualizarProducto,
  listarProductos
} from '../src/main/services/productos.service.js'

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

test('el código de barra es opcional y se guarda tal cual', () => {
  base()
  const con = crearProducto({ codigo: 'A-1', codigoBarras: '7590000000001', nombre: 'Con barra' })
  assert.equal(con.codigo_barras, '7590000000001')

  const sin = crearProducto({ codigo: 'A-2', nombre: 'Sin barra' })
  assert.equal(sin.codigo_barras, null)

  // Cadena vacía también queda como NULL (no como código vacío).
  const vacio = crearProducto({ codigo: 'A-3', codigoBarras: '   ', nombre: 'Barra vacía' })
  assert.equal(vacio.codigo_barras, null)
})

test('el código de barra es único cuando existe', () => {
  base()
  crearProducto({ codigo: 'B-1', codigoBarras: '7590000000002', nombre: 'Primero' })
  assert.throws(
    () => crearProducto({ codigo: 'B-2', codigoBarras: '7590000000002', nombre: 'Duplicado' }),
    /código de barra/
  )

  // Dos productos sin código de barra pueden coexistir.
  crearProducto({ codigo: 'B-3', nombre: 'Sin barra 1' })
  crearProducto({ codigo: 'B-4', nombre: 'Sin barra 2' })
})

test('se puede actualizar y quitar el código de barra', () => {
  base()
  const p = crearProducto({ codigo: 'C-1', nombre: 'Editable' })
  const conBarra = actualizarProducto(p.id, { codigo: 'C-1', codigoBarras: '7590000000003', nombre: 'Editable' })
  assert.equal(conBarra.codigo_barras, '7590000000003')
  const sinBarra = actualizarProducto(p.id, { codigo: 'C-1', codigoBarras: '', nombre: 'Editable' })
  assert.equal(sinBarra.codigo_barras, null)
})

test('la búsqueda encuentra el producto por su código de barra', () => {
  base()
  crearProducto({ codigo: 'D-1', codigoBarras: '7590000000004', nombre: 'Filtro buscable' })
  crearProducto({ codigo: 'D-2', nombre: 'Otro producto' })

  const porBarra = listarProductos({ texto: '7590000000004' })
  assert.equal(porBarra.length, 1)
  assert.equal(porBarra[0].codigo, 'D-1')

  const porNombre = listarProductos({ texto: 'Filtro' })
  assert.equal(porNombre.length, 1)
})
