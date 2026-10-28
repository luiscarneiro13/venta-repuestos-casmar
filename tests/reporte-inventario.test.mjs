import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { construirReporte, SIN_GRUPO } from '../src/shared/reporte.inventario.js'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import { datosReporteInventario } from '../src/main/services/inventario.service.js'
import { registrarEntrada, registrarAjusteSalida } from '../src/main/services/inventario.service.js'
import { registrarTasa } from '../src/main/services/tasas.service.js'

// ---------- Lógica pura (shared/reporte.inventario.js) ----------
const fila = (o) => ({
  codigo: null, marca: null, categoria_id: null, categoria_nombre: null,
  proveedor_id: null, proveedor_nombre: null, precio_compra_usd: 10, stock_minimo: 0, ...o
})
const FILAS = [
  fila({ id: 1, nombre: 'Filtro aceite', stock: 2, stock_minimo: 5, categoria_id: 1, categoria_nombre: 'Filtros', proveedor_id: 10, proveedor_nombre: 'Norte', precio_compra_usd: 4 }),
  fila({ id: 2, nombre: 'Filtro aire', stock: 8, stock_minimo: 3, categoria_id: 1, categoria_nombre: 'Filtros', proveedor_id: 20, proveedor_nombre: 'Sur', precio_compra_usd: 6 }),
  fila({ id: 3, nombre: 'Pastillas', stock: 0, stock_minimo: 2, categoria_id: 2, categoria_nombre: 'Frenos', proveedor_id: 10, proveedor_nombre: 'Norte', precio_compra_usd: 12.5 }),
  fila({ id: 4, nombre: 'Bujía', stock: 4, stock_minimo: 4, precio_compra_usd: 2 }), // justo en el mínimo, sin cat/prov
  fila({ id: 5, nombre: 'Sin mínimo', stock: 1, stock_minimo: 0, precio_compra_usd: null })
]

test('inventario total: todos los productos, unidades y valor al costo (USD y Bs)', () => {
  const { detalle, totales } = construirReporte(FILAS, { tipo: 'total', tasaBcv: 100 })
  assert.equal(detalle.length, 5)
  assert.equal(totales.unidades, 15)
  // 2×4 + 8×6 + 0 + 4×2 = 64 (el producto sin costo no suma)
  assert.equal(totales.valor_usd, 64)
  assert.equal(totales.valor_bs, 6400)
  assert.equal(totales.en_minimo, 3)
  assert.equal(totales.sin_costo, 1)
})

test('mínimos totales: solo stock <= mínimo (con mínimo > 0), con faltante y costo de reposición', () => {
  const { detalle, totales } = construirReporte(FILAS, { tipo: 'minimos', tasaBcv: 100 })
  assert.deepEqual(detalle.map((p) => p.id), [1, 3, 4]) // ordenados por faltante desc
  assert.deepEqual(detalle.map((p) => p.faltante), [3, 2, 0])
  assert.equal(totales.faltante, 5)
  // reposición: 3×4 + 2×12,5 + 0 = 37
  assert.equal(totales.reposicion_usd, 37)
  assert.equal(totales.reposicion_bs, 3700)
})

test('mínimos por categoría: grupos con sus totales y "Sin categoría" al final', () => {
  const { grupos } = construirReporte(FILAS, { tipo: 'minimos', agrupar: 'categoria' })
  assert.deepEqual(grupos.map((g) => g.nombre), ['Filtros', 'Frenos', 'Sin categoría'])
  const filtros = grupos.find((g) => g.nombre === 'Filtros')
  assert.equal(filtros.totales.productos, 1)
  assert.equal(filtros.totales.faltante, 3)
  assert.equal(filtros.totales.reposicion_usd, 12)
})

test('mínimos por proveedor y filtro por un proveedor concreto', () => {
  const { grupos } = construirReporte(FILAS, { tipo: 'minimos', agrupar: 'proveedor' })
  assert.deepEqual(grupos.map((g) => [g.nombre, g.totales.productos]), [['Norte', 2], ['Sin proveedor', 1]])

  const soloNorte = construirReporte(FILAS, { tipo: 'minimos', agrupar: 'proveedor', filtroId: 10 })
  assert.deepEqual(soloNorte.detalle.map((p) => p.id), [1, 3])
  assert.equal(soloNorte.totales.reposicion_usd, 37 - 0)

  const sinProv = construirReporte(FILAS, { tipo: 'total', agrupar: 'proveedor', filtroId: SIN_GRUPO })
  assert.deepEqual(sinProv.detalle.map((p) => p.id).sort(), [4, 5])
})

test('la suma de los grupos coincide con el total del reporte', () => {
  for (const tipo of ['total', 'minimos']) {
    for (const agrupar of ['categoria', 'proveedor']) {
      const { grupos, totales } = construirReporte(FILAS, { tipo, agrupar, tasaBcv: 36.5 })
      for (const campo of ['productos', 'unidades', 'faltante', 'valor_usd', 'reposicion_usd', 'valor_bs']) {
        const suma = Math.round(grupos.reduce((s, g) => s + g.totales[campo], 0) * 100) / 100
        assert.equal(suma, totales[campo], `${tipo}/${agrupar}/${campo}`)
      }
    }
  }
})

test('sin tasa vigente los montos en Bs quedan en null (la UI muestra «—», no 0)', () => {
  const { totales, detalle } = construirReporte(FILAS, { tipo: 'total', tasaBcv: null })
  assert.equal(totales.valor_usd, 64)
  assert.equal(totales.valor_bs, null)
  assert.equal(totales.reposicion_bs, null)
  assert.ok(detalle.every((p) => p.valor_bs == null))
})

// ---------- Consulta real (inventario.repo.reporteProductos) ----------
let db = null
afterEach(() => {
  db?.close()
  db = null
})

test('la consulta trae stock actual, categoría y el proveedor de la ÚLTIMA entrada', () => {
  db = nuevaBaseEnMemoria()
  const usuarioId = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id
  registrarTasa({ valorBcv: 40, valorUsdt: 45, usuarioId })
  const cat = db.prepare("SELECT id FROM categorias_producto WHERE nombre = 'Frenos'").get().id
  const productoId = db
    .prepare("INSERT INTO productos (codigo, nombre, stock_minimo, categoria_id) VALUES ('PF-1', 'Pastillas', 5, ?)")
    .run(cat).lastInsertRowid
  db.prepare("INSERT INTO productos (codigo, nombre, activo) VALUES ('X-1', 'Inactivo', 0)").run()
  const norte = db.prepare("INSERT INTO proveedores (nombre) VALUES ('Norte')").run().lastInsertRowid
  const sur = db.prepare("INSERT INTO proveedores (nombre) VALUES ('Sur')").run().lastInsertRowid

  registrarEntrada({ productoId, cantidad: 4, proveedorId: norte, precioCompraUsd: 10, usuarioId, margenes: [] })
  registrarEntrada({ productoId, cantidad: 2, proveedorId: sur, precioCompraUsd: 11, usuarioId, margenes: [] })
  registrarAjusteSalida({ productoId, cantidad: 3, motivo: 'Daño', usuarioId })

  const { productos, tasaBcv } = datosReporteInventario()
  assert.equal(tasaBcv, 40)
  assert.equal(productos.length, 1, 'los inactivos no entran')
  const p = productos[0]
  assert.equal(p.stock, 3)
  assert.equal(p.categoria_nombre, 'Frenos')
  assert.equal(p.proveedor_nombre, 'Sur')
  assert.equal(p.precio_compra_usd, 11)

  const { detalle } = construirReporte(productos, { tipo: 'minimos', tasaBcv })
  assert.equal(detalle[0].faltante, 2)
  assert.equal(detalle[0].reposicion_usd, 22)
  assert.equal(detalle[0].reposicion_bs, 880)
})

test('el costo unitario también trae su equivalente en Bs', () => {
  const { detalle } = construirReporte(FILAS, { tipo: 'total', tasaBcv: 100 })
  assert.equal(detalle.find((p) => p.id === 3).costo_bs, 1250)
  assert.equal(detalle.find((p) => p.id === 5).costo_bs, null)
})
