// Nota de entrega: igual que la factura (precios, tasas, stock, ticket), pero
// SIN IVA y con su propio correlativo (NE-0001…).
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { afterEach, test } from 'node:test'

const stubElectron =
  'export const nativeImage = { createFromPath() { throw new Error("nativeImage stub") } }'
const hooks = `
export async function resolve(specifier, context, next) {
  if (specifier === 'electron') {
    return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(stubElectron)}), shortCircuit: true }
  }
  return next(specifier, context)
}`
register('data:text/javascript,' + encodeURIComponent(hooks))

const { construirTicketVenta, construirTicketReporteZ } = await import('../src/main/printer/ticket.printer.js')
const { nuevaBaseEnMemoria } = await import('./helpers/db.mjs')
const { registrarTasa } = await import('../src/main/services/tasas.service.js')
const { registrarEntrada } = await import('../src/main/services/inventario.service.js')
const { crearCliente } = await import('../src/main/services/clientes.service.js')
const { crearVenta } = await import('../src/main/services/ventas.service.js')
const { listarPreciosPorProducto } = await import('../src/main/services/precios.service.js')
const { calcularLinea, calcularTotales } = await import('../src/shared/venta.calculo.js')
const ventasRepo = await import('../src/main/repositories/ventas.repo.js')
const { ventaState, setTipoDocumento, limpiarTicket } = await import('../src/renderer/src/store/venta.js')

let db = null
afterEach(() => {
  db?.close()
  db = null
  limpiarTicket()
})

// Producto costo $1.000, Precio Full (100%) → $2.000 → Bs 200.000 → 1.666,67 USDT.
function preparar() {
  db = nuevaBaseEnMemoria()
  const usuarioId = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id
  registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })
  const productoId = db.prepare("INSERT INTO productos (codigo, nombre) VALUES ('NE-1', 'Repuesto')").run().lastInsertRowid
  const proveedorId = db.prepare("INSERT INTO proveedores (nombre) VALUES ('Prov')").run().lastInsertRowid
  registrarEntrada({ productoId, cantidad: 50, proveedorId, precioCompraUsd: 1000, usuarioId, margenes: [] })
  const precio = listarPreciosPorProducto(productoId).find((p) => p.tipoPrecioNombre === 'Precio Full')
  const clienteId = crearCliente({ nombre: 'Cliente NE' }).id
  return { usuarioId, clienteId, precio }
}

test('la nota de entrega no aplica IVA: total = subtotal en las tres monedas', () => {
  const { usuarioId, clienteId, precio } = preparar()
  const venta = crearVenta({
    clienteId, usuarioId, metodoPago: 'bs', tipoDocumento: 'nota_entrega',
    items: [{ precioId: precio.id, cantidad: 2 }]
  })
  assert.equal(venta.tipo_documento, 'nota_entrega')
  assert.equal(venta.iva_porcentaje, 0)
  assert.equal(venta.iva_bs, 0)
  assert.equal(venta.iva_usd, 0)
  assert.equal(venta.iva_usdt, 0)
  assert.equal(venta.total_usd, 4000)
  assert.equal(venta.total_bs, 400000)
  assert.equal(venta.total_usdt, 3333.34)
})

test('la misma venta como factura sí lleva el IVA configurado (16%)', () => {
  const { usuarioId, clienteId, precio } = preparar()
  const venta = crearVenta({ clienteId, usuarioId, metodoPago: 'bs', items: [{ precioId: precio.id, cantidad: 2 }] })
  assert.equal(venta.tipo_documento, 'factura')
  assert.equal(venta.iva_porcentaje, 16)
  assert.equal(venta.total_bs, 464000)
})

test('facturas y notas de entrega llevan correlativos independientes', () => {
  const { usuarioId, clienteId, precio } = preparar()
  const vender = (tipoDocumento) =>
    crearVenta({ clienteId, usuarioId, tipoDocumento, items: [{ precioId: precio.id, cantidad: 1 }] }).numero_ticket
  assert.deepEqual(
    [vender('factura'), vender('nota_entrega'), vender('nota_entrega'), vender('factura')],
    ['T-0001', 'NE-0001', 'NE-0002', 'T-0002']
  )
  assert.throws(() => vender('presupuesto'), /tipo de documento/)
})

test('pantalla = backend: la nota calcula con IVA 0 y el guardián rechaza si la pantalla usó otro IVA', () => {
  const { usuarioId, clienteId, precio } = preparar()
  const enPantalla = (iva) => {
    const t = calcularTotales([calcularLinea(precio, 3, iva)])
    return { ivaPorcentaje: iva, subtotalBs: t.subtotal.bs, ivaBs: t.iva.bs, totalBs: t.total.bs, totalUsdt: t.total.usdt }
  }
  // Pantalla en "Nota de entrega" (IVA 0) → coincide y se registra.
  const ok = crearVenta({
    clienteId, usuarioId, tipoDocumento: 'nota_entrega',
    items: [{ precioId: precio.id, cantidad: 3 }], totalesEsperados: enPantalla(0)
  })
  assert.equal(ok.total_bs, enPantalla(0).totalBs)
  // Pantalla mostrando montos con IVA pero se envía como nota → se rechaza.
  assert.throws(
    () => crearVenta({
      clienteId, usuarioId, tipoDocumento: 'nota_entrega',
      items: [{ precioId: precio.id, cantidad: 3 }], totalesEsperados: enPantalla(16)
    }),
    /Los montos cambiaron/
  )
})

test('ticket de la nota: encabezado NOTA DE ENTREGA, sin líneas de IVA y solo bolívares', () => {
  const { usuarioId, clienteId, precio } = preparar()
  const venta = crearVenta({ clienteId, usuarioId, metodoPago: 'usdt', tipoDocumento: 'nota_entrega', items: [{ precioId: precio.id, cantidad: 1 }] })
  for (const ancho of ['58mm', '80mm']) {
    const texto = construirTicketVenta({ venta, items: ventasRepo.detalleDeVenta(venta.id), ancho }).preview()
    assert.ok(texto.includes('NOTA DE ENTREGA'), ancho)
    assert.ok(texto.includes('Nro. NE-0001'), ancho)
    assert.ok(!/IVA|Subtotal/.test(texto), `${ancho}: no debe mostrar IVA ni Subtotal`)
    assert.ok(/TOTAL Bs\s+200\.000,00/.test(texto), `${ancho}: total en Bs`)
    assert.ok(!/\$|USDT?\b/.test(texto), `${ancho}: sin dólares`)
  }
})

test('ticket de factura sigue igual (Ticket T-…, con Subtotal e IVA)', () => {
  const { usuarioId, clienteId, precio } = preparar()
  const venta = crearVenta({ clienteId, usuarioId, items: [{ precioId: precio.id, cantidad: 1 }] })
  const texto = construirTicketVenta({ venta, items: ventasRepo.detalleDeVenta(venta.id) }).preview()
  assert.ok(texto.includes('Ticket T-0001'))
  assert.ok(!texto.includes('NOTA DE ENTREGA'))
  assert.ok(/IVA 16%/.test(texto))
})

test('el reporte diario cuenta facturas y notas de entrega por separado', () => {
  const { usuarioId, clienteId, precio } = preparar()
  for (const tipoDocumento of ['factura', 'nota_entrega', 'nota_entrega']) {
    crearVenta({ clienteId, usuarioId, tipoDocumento, items: [{ precioId: precio.id, cantidad: 1 }] })
  }
  const ventas = ventasRepo.listar().map((v) => ({ ...v, items: ventasRepo.detalleDeVenta(v.id) }))
  const texto = construirTicketReporteZ({ ventas, usuarioNombre: 'Admin', tasaBcv: 100, tasaUsdt: 120, totalUnidades: 3 }).preview()
  assert.ok(/Facturas:\s+1/.test(texto))
  assert.ok(/Notas de entrega:\s+2/.test(texto))
  assert.ok(/Documento:\s+Nota de entrega/.test(texto))
})

test('store: el documento es factura por defecto, acepta nota_entrega y se reinicia al limpiar', () => {
  assert.equal(ventaState.tipoDocumento, 'factura')
  setTipoDocumento('nota_entrega')
  assert.equal(ventaState.tipoDocumento, 'nota_entrega')
  setTipoDocumento('otra')
  assert.equal(ventaState.tipoDocumento, 'nota_entrega')
  limpiarTicket()
  assert.equal(ventaState.tipoDocumento, 'factura')
})
