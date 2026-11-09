import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import { registrarEntrada, editarMovimientoInventario, anularMovimientoInventario, registrarAjusteSalida, datosReporteInventario } from '../src/main/services/inventario.service.js'
import { registrarTasa } from '../src/main/services/tasas.service.js'
import { listarPreciosPorProducto } from '../src/main/services/precios.service.js'
import { crearVenta, anularVenta } from '../src/main/services/ventas.service.js'

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
const tipoFull = (db) => db.prepare("SELECT id FROM tipos_precio WHERE nombre = 'Precio Full'").get().id

function crearProductoYProveedor(db) {
  const productoId = db
    .prepare("INSERT INTO productos (codigo, nombre) VALUES ('EDT-1', 'Producto edición')")
    .run().lastInsertRowid
  const proveedorId = db
    .prepare("INSERT INTO proveedores (nombre, activo) VALUES ('Proveedor A', 1)")
    .run().lastInsertRowid
  const proveedorB = db
    .prepare("INSERT INTO proveedores (nombre, activo) VALUES ('Proveedor B', 1)")
    .run().lastInsertRowid
  return { productoId, proveedorId, proveedorB }
}

const entrada = (db, productoId, cantidad, costo, proveedorId, margen = 100, margenUsdt = null) =>
  registrarEntrada({
    productoId,
    cantidad,
    proveedorId,
    precioCompraUsd: costo,
    usuarioId: adminId(db),
    margenes: [{ tipoPrecioId: tipoFull(db), margen, margenUsdt }]
  })

const movs = (db, productoId) =>
  db.prepare('SELECT * FROM inventario_movimientos WHERE producto_id = ? ORDER BY creado_en, id').all(productoId)

test('corregir cantidad desplaza el saldo de los movimientos posteriores', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)
  entrada(db, productoId, 5, 1000, proveedorId)
  const [e1] = movs(db, productoId)

  editarMovimientoInventario({ id: e1.id, cantidad: 7 })
  const lista = movs(db, productoId)
  assert.equal(lista[0].cantidad, 7)
  assert.equal(lista[0].saldo, 7)
  assert.equal(lista[1].saldo, 12)
  assert.match(lista[0].motivo, /corregido: antes 10/)
})

test('corregir el costo de la última entrada actualiza el costo del producto y los precios', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)
  const ultima = movs(db, productoId).at(-1)

  // El valor activo por tipo es el de Bs: el margen legado de USDT no
  // cambia el precio único ni los movimientos de inventario.
  editarMovimientoInventario({
    id: ultima.id,
    cantidad: 10,
    precioCompraUsd: 1500,
    margenes: [{ tipoPrecioId: tipoFull(db), margen: 120, margenUsdt: 80 }]
  })
  assert.equal(db.prepare('SELECT precio_compra_usd FROM productos WHERE id = ?').get(productoId).precio_compra_usd, 1500)
  const fila = listarPreciosPorProducto(productoId).find((f) => f.tipoPrecioId === tipoFull(db))
  assert.equal(fila.margen, 120)
  assert.equal(fila.margenUsdt, 120)
  assert.equal(fila.precioUsd, 3300)
  assert.equal(fila.precioBs, 330000)
  assert.equal(fila.precioUsdt, 2750)
  assert.equal(db.prepare('SELECT saldo FROM inventario_movimientos WHERE id = ?').get(ultima.id).saldo, 10)
})

test('corregir una entrada vieja no pisa el costo de la más reciente', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)
  entrada(db, productoId, 5, 2000, proveedorId)
  const [vieja] = movs(db, productoId)

  editarMovimientoInventario({ id: vieja.id, cantidad: 10, precioCompraUsd: 500 })
  assert.equal(movs(db, productoId)[0].costo_usd, 500) // queda en el historial…
  assert.equal(db.prepare('SELECT precio_compra_usd FROM productos WHERE id = ?').get(productoId).precio_compra_usd, 2000) // …pero el producto sigue con el costo de la última
})

test('corregir proveedor actualiza el movimiento', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId, proveedorB } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)
  const [e1] = movs(db, productoId)

  editarMovimientoInventario({ id: e1.id, cantidad: 10, proveedorId: proveedorB })
  assert.equal(movs(db, productoId)[0].proveedor_id, proveedorB)
  assert.throws(
    () => editarMovimientoInventario({ id: e1.id, cantidad: 10, proveedorId: 99999 }),
    /proveedor/i
  )
})

test('bajar la cantidad no puede dejar el inventario en negativo', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)
  registrarAjusteSalida({ productoId, cantidad: 8, motivo: 'Pieza dañada', usuarioId: adminId(db) })
  const [e1] = movs(db, productoId)

  // Quedan 2: bajar la entrada a 3 dejaría saldo -5
  assert.throws(
    () => editarMovimientoInventario({ id: e1.id, cantidad: 3 }),
    /negativo/
  )
  // A 8 sí se puede (saldo final 0)
  editarMovimientoInventario({ id: e1.id, cantidad: 8 })
  assert.equal(movs(db, productoId).at(-1).saldo, 0)
})

test('una devolución por anulación solo corrige cantidad y nota', () => {
  const db = base()
  const usuarioId = adminId(db)
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })
  const { productoId, proveedorId, proveedorB } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)

  const clienteId = db.prepare("INSERT INTO clientes (nombre) VALUES ('Cliente X')").run().lastInsertRowid
  const precioId = db.prepare('SELECT id FROM precios WHERE producto_id = ? LIMIT 1').get(productoId).id
  const venta = crearVenta({ clienteId, usuarioId, metodoPago: 'bs', tipoDocumento: 'nota_entrega', items: [{ precioId, cantidad: 4 }] })
  anularVenta(venta.id, 'error de cobro', usuarioId)

  const devolucion = movs(db, productoId).find((m) => m.motivo.startsWith('Anulación'))
  editarMovimientoInventario({
    id: devolucion.id,
    cantidad: 4,
    motivo: 'Anulación corregida',
    proveedorId: proveedorB,
    precioCompraUsd: 999,
    margenes: [{ tipoPrecioId: tipoFull(db), margen: 999 }]
  })
  const editada = movs(db, productoId).find((m) => m.id === devolucion.id)
  assert.equal(editada.motivo, 'Anulación corregida')
  assert.equal(editada.proveedor_id, null) // no le pega proveedor a una devolución
  assert.equal(editada.costo_usd, null)
  // El costo del producto y el margen no cambiaron
  assert.equal(db.prepare('SELECT precio_compra_usd FROM productos WHERE id = ?').get(productoId).precio_compra_usd, 1000)
  assert.equal(listarPreciosPorProducto(productoId).find((f) => f.tipoPrecioId === tipoFull(db)).margen, 100)
})

test('anular una entrada descuenta su cantidad de ella y de los posteriores', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)
  entrada(db, productoId, 5, 1000, proveedorId)
  const [e1] = movs(db, productoId)

  anularMovimientoInventario(e1.id)
  const lista = movs(db, productoId)
  assert.equal(lista[0].anulada, 1)
  assert.equal(lista[0].saldo, 0) // 10 - 10
  assert.equal(lista[1].saldo, 5) // 15 - 10
})

test('la entrada anulada deja de definir el costo: vuelve la anterior y rematerializa precios', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId, 100)
  entrada(db, productoId, 5, 2000, proveedorId, 120) // última: valor_usd = 4400
  const ultima = movs(db, productoId).at(-1)
  assert.equal(db.prepare('SELECT precio_compra_usd FROM productos WHERE id = ?').get(productoId).precio_compra_usd, 2000)

  anularMovimientoInventario(ultima.id)
  assert.equal(db.prepare('SELECT precio_compra_usd FROM productos WHERE id = ?').get(productoId).precio_compra_usd, 1000)
  const fila = listarPreciosPorProducto(productoId).find((f) => f.tipoPrecioId === tipoFull(db))
  // Se rematerializó con el costo vigente (1000) y el margen guardado (120%)
  assert.equal(fila.precioUsd, 2200)
  // La última entrada vigente con costo ya no es la anulada
  assert.notEqual(movs(db, productoId).find((m) => m.anulada === 0 && m.tipo === 'entrada' && m.costo_usd != null).id, ultima.id)
})

test('anular la única entrada con costo deja el producto sin costo pero conserva sus precios', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId, 100)
  const [e1] = movs(db, productoId)

  anularMovimientoInventario(e1.id)
  assert.equal(db.prepare('SELECT precio_compra_usd FROM productos WHERE id = ?').get(productoId).precio_compra_usd, null)
  // Sin costo no hay base nueva: se conserva el último valor materializado (2000)
  const fila = listarPreciosPorProducto(productoId).find((f) => f.tipoPrecioId === tipoFull(db))
  assert.equal(fila.precioUsd, 2000)
})

test('una entrada anulada no se puede editar ni volver a anular', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)
  const [e1] = movs(db, productoId)
  anularMovimientoInventario(e1.id)

  assert.throws(() => editarMovimientoInventario({ id: e1.id, cantidad: 8 }), /anulada/)
  assert.throws(() => anularMovimientoInventario(e1.id), /ya está anulada/)
})

test('no se puede anular una salida ni una devolución por venta', () => {
  const db = base()
  const usuarioId = adminId(db)
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })
  const { productoId, proveedorId } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)
  registrarAjusteSalida({ productoId, cantidad: 2, motivo: 'Daño', usuarioId })
  const clienteId = db.prepare("INSERT INTO clientes (nombre) VALUES ('Cliente X')").run().lastInsertRowid
  const precioId = db.prepare('SELECT id FROM precios WHERE producto_id = ? LIMIT 1').get(productoId).id
  const venta = crearVenta({ clienteId, usuarioId, metodoPago: 'bs', tipoDocumento: 'nota_entrega', items: [{ precioId, cantidad: 3 }] })
  anularVenta(venta.id, 'error', usuarioId)

  const salida = movs(db, productoId).find((m) => m.tipo === 'salida' && !m.motivo.startsWith('Anulación'))
  const devolucion = movs(db, productoId).find((m) => m.tipo === 'entrada' && m.motivo.startsWith('Anulación'))
  assert.throws(() => anularMovimientoInventario(salida.id), /entradas/)
  assert.throws(() => anularMovimientoInventario(devolucion.id), /devoluciones/)
})

test('anular no puede dejar el inventario en negativo', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)
  registrarAjusteSalida({ productoId, cantidad: 8, motivo: 'Pieza dañada', usuarioId: adminId(db) })
  const [e1] = movs(db, productoId)

  assert.throws(() => anularMovimientoInventario(e1.id), /negativo/)
  assert.equal(movs(db, productoId)[0].anulada, 0) // nada cambió
})

test('la entrada anulada no aparece como última entrada en reportes', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId, proveedorB } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)
  entrada(db, productoId, 5, 2000, proveedorB)
  const ultima = movs(db, productoId).at(-1)
  anularMovimientoInventario(ultima.id)

  const fila = datosReporteInventario().productos.find((p) => p.id === productoId)
  assert.equal(fila.proveedor_nombre, 'Proveedor A') // vuelve al proveedor de la entrada vigente
})

test('solo se pueden editar entradas y con cantidad válida', () => {
  const db = base()
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId: adminId(db) })
  const { productoId, proveedorId } = crearProductoYProveedor(db)
  entrada(db, productoId, 10, 1000, proveedorId)
  registrarAjusteSalida({ productoId, cantidad: 2, motivo: 'Daño', usuarioId: adminId(db) })
  const salida = movs(db, productoId).find((m) => m.tipo === 'salida')

  assert.throws(() => editarMovimientoInventario({ id: salida.id, cantidad: 1 }), /entradas/)
  assert.throws(() => editarMovimientoInventario({ id: 99999, cantidad: 1 }), /no encontrado/i)
  assert.throws(() => editarMovimientoInventario({ id: salida.id, cantidad: 0 }), /entero mayor a 0/)
})
