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

test('al editar el precio de compra se actualiza el costo y se rematerializan los precios', async () => {
  const db = base()
  const { registrarEntrada } = await import('../src/main/services/inventario.service.js')
  const { listarPreciosPorProducto } = await import('../src/main/services/precios.service.js')
  const { registrarTasa } = await import('../src/main/services/tasas.service.js')
  const usuarioId = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })

  const p = crearProducto({ codigo: 'PC-1', nombre: 'Con costo editable' })
  const proveedorId = db.prepare("INSERT INTO proveedores (nombre) VALUES ('Prov')").run().lastInsertRowid
  registrarEntrada({ productoId: p.id, cantidad: 10, proveedorId, precioCompraUsd: 10, usuarioId, margenes: [] })

  // Costo de la entrada: 10 → precio materializado 20 (margen 100% del tipo).
  let precio = listarPreciosPorProducto(p.id).find((x) => x.tipoPrecioNombre === 'Precio Full')
  assert.equal(precio.precioUsd, 20)

  // Corrección manual del costo desde la edición del producto.
  const actualizado = actualizarProducto(p.id, {
    codigo: 'PC-1', nombre: 'Con costo editable', precioCompraUsd: 15
  })
  assert.equal(actualizado.precio_compra_usd, 15)
  precio = listarPreciosPorProducto(p.id).find((x) => x.tipoPrecioNombre === 'Precio Full')
  assert.equal(precio.precioUsd, 30, 'el precio se recalcula con el costo corregido')
})

test('el flag costo con IVA se edita con el producto y se conserva si no se envía', async () => {
  const db = base()
  const { registrarEntrada } = await import('../src/main/services/inventario.service.js')
  const usuarioId = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id
  const p = crearProducto({ codigo: 'PC-IVA', nombre: 'Con IVA' })
  const proveedorId = db.prepare("INSERT INTO proveedores (nombre) VALUES ('Prov IVA')").run().lastInsertRowid
  registrarEntrada({ productoId: p.id, cantidad: 10, proveedorId, precioCompraUsd: 10, usuarioId, margenes: [], costoConIva: true })
  const flag = () => db.prepare('SELECT costo_con_iva FROM productos WHERE id = ?').get(p.id).costo_con_iva
  assert.equal(flag(), 1)

  // Corregir solo el costo (sin enviar el flag) NO lo pisa.
  actualizarProducto(p.id, { codigo: 'PC-IVA', nombre: 'Con IVA', precioCompraUsd: 12 })
  assert.equal(flag(), 1)
  // Editar solo el flag, sin costo.
  actualizarProducto(p.id, { codigo: 'PC-IVA', nombre: 'Con IVA', costoConIva: false })
  assert.equal(flag(), 0)
  actualizarProducto(p.id, { codigo: 'PC-IVA', nombre: 'Con IVA', precioCompraUsd: 12, costoConIva: true })
  assert.equal(flag(), 1)
  // Quitar el costo deja el flag en 0.
  actualizarProducto(p.id, { codigo: 'PC-IVA', nombre: 'Con IVA', precioCompraUsd: null })
  assert.equal(flag(), 0)
})

test('el precio de compra debe ser mayor que cero o vacío; sin él no se toca el costo', () => {
  const db = base()
  const p = crearProducto({ codigo: 'PC-2', nombre: 'Costo inválido' })
  db.prepare('UPDATE productos SET precio_compra_usd = 7.5 WHERE id = ?').run(p.id)

  assert.throws(
    () => actualizarProducto(p.id, { codigo: 'PC-2', nombre: 'Costo inválido', precioCompraUsd: 0 }),
    /mayor que cero/
  )
  assert.throws(
    () => actualizarProducto(p.id, { codigo: 'PC-2', nombre: 'Costo inválido', precioCompraUsd: -3 }),
    /mayor que cero/
  )

  // Vacío quita el costo; no enviarlo lo deja como estaba.
  const sinCosto = actualizarProducto(p.id, { codigo: 'PC-2', nombre: 'Costo inválido', precioCompraUsd: null })
  assert.equal(sinCosto.precio_compra_usd, null)
  const sinCampo = actualizarProducto(p.id, { codigo: 'PC-2', nombre: 'Costo inválido' })
  assert.equal(sinCampo.precio_compra_usd, null)
})
