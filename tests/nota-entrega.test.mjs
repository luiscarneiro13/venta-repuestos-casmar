// Nota de entrega: mismo correlativo propio (NE-0001…) y mismas tasas/stock
// que la factura, pero el IVA nunca se desglosa: las líneas y el total
// guardan el precio con IVA embebido (cobran lo mismo que la factura) e
// iva_* quedan en 0.
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
const { calcularLinea, calcularTotales, precioUnitarioConIva } = await import('../src/shared/venta.calculo.js')
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

test('la nota de entrega cobra el precio con IVA embebido y no lo desglosa', () => {
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
  // 2 × (2000 + 16%) = 4.640 USD; lo mismo que cobraría la factura.
  assert.equal(venta.total_usd, 4640)
  assert.equal(venta.total_bs, 464000)
  // USDT: 1.666,67 + 16% = 1.933,34 c/u.
  assert.equal(venta.total_usdt, 3866.68)
  // Las líneas guardan el precio con IVA embebido (subtotal = total cobrado).
  const items = ventasRepo.detalleDeVenta(venta.id)
  assert.equal(items[0].precio_unitario_usd, 2320)
  assert.equal(items[0].subtotal_bs, 464000)
  // Opciones por defecto de la nota: en $ y con IVA embebido.
  assert.equal(venta.nota_moneda, 'usd')
  assert.equal(venta.nota_con_iva, 1)
})

test('nota de entrega "sin IVA" cobra la base; la moneda elegida se congela en la venta', () => {
  const { usuarioId, clienteId, precio } = preparar()
  const venta = crearVenta({
    clienteId, usuarioId, metodoPago: 'bs', tipoDocumento: 'nota_entrega', notaMoneda: 'bs', notaConIva: false,
    items: [{ precioId: precio.id, cantidad: 2 }]
  })
  assert.equal(venta.nota_moneda, 'bs')
  assert.equal(venta.nota_con_iva, 0)
  assert.equal(venta.iva_porcentaje, 0)
  assert.equal(venta.iva_bs, 0)
  // 2 × 2000 base, sin impuesto.
  assert.equal(venta.total_usd, 4000)
  assert.equal(venta.total_bs, 400000)
  const items = ventasRepo.detalleDeVenta(venta.id)
  assert.equal(items[0].precio_unitario_usd, 2000)

  // Costo con IVA incluido + nota sin IVA → se le quita el IVA embebido.
  const productoId = db.prepare("INSERT INTO productos (codigo, nombre) VALUES ('NE-SIN', 'Con IVA en costo')").run().lastInsertRowid
  const proveedorId = db.prepare("INSERT INTO proveedores (nombre) VALUES ('Prov sin')").run().lastInsertRowid
  registrarEntrada({ productoId, cantidad: 10, proveedorId, precioCompraUsd: 1000, usuarioId, margenes: [], costoConIva: true })
  const precio2 = listarPreciosPorProducto(productoId).find((p) => p.tipoPrecioNombre === 'Precio Full')
  const nota2 = crearVenta({
    clienteId, usuarioId, tipoDocumento: 'nota_entrega', notaMoneda: 'usd', notaConIva: false,
    items: [{ precioId: precio2.id, cantidad: 1 }]
  })
  assert.equal(nota2.total_usd, 1724.14) // r2(2000 / 1.16)

  // La factura ignora las opciones de la nota.
  const factura = crearVenta({ clienteId, usuarioId, notaMoneda: 'bs', notaConIva: false, items: [{ precioId: precio.id, cantidad: 1 }] })
  assert.equal(factura.nota_moneda, null)
  assert.equal(factura.nota_con_iva, null)
  assert.equal(factura.total_bs, 232000)

  assert.throws(() => crearVenta({ clienteId, usuarioId, tipoDocumento: 'nota_entrega', notaMoneda: 'eur', items: [{ precioId: precio.id, cantidad: 1 }] }), /moneda/)
})

test('la misma venta como factura sí lleva el IVA configurado (16%)', () => {
  const { usuarioId, clienteId, precio } = preparar()
  const venta = crearVenta({ clienteId, usuarioId, metodoPago: 'bs', items: [{ precioId: precio.id, cantidad: 2 }] })
  assert.equal(venta.tipo_documento, 'factura')
  assert.equal(venta.iva_porcentaje, 16)
  assert.equal(venta.total_bs, 464000)
})

test('costo con IVA incluido: la factura desglosa el IVA embebido y la nota cobra el materializado', () => {
  const { usuarioId, clienteId } = preparar()
  const productoId = db.prepare("INSERT INTO productos (codigo, nombre) VALUES ('NE-IVA', 'Con IVA')").run().lastInsertRowid
  const proveedorId = db.prepare("INSERT INTO proveedores (nombre) VALUES ('Prov IVA')").run().lastInsertRowid
  // Costo $1.000 con IVA incluido, margen 100% → precio $2.000 ya con IVA.
  registrarEntrada({ productoId, cantidad: 10, proveedorId, precioCompraUsd: 1000, usuarioId, margenes: [], costoConIva: true })
  assert.equal(db.prepare('SELECT costo_con_iva FROM productos WHERE id = ?').get(productoId).costo_con_iva, 1)
  const precio = listarPreciosPorProducto(productoId).find((p) => p.tipoPrecioNombre === 'Precio Full')

  const factura = crearVenta({ clienteId, usuarioId, items: [{ precioId: precio.id, cantidad: 2 }] })
  // El cliente paga el precio materializado (200.000 Bs c/u); la factura
  // desglosa: base = 200.000/1.16 e IVA = lo embebido. Total = lo cobrado.
  assert.equal(factura.total_bs, 400000)
  const d = ventasRepo.detalleDeVenta(factura.id)[0]
  assert.equal(d.precio_unitario_bs, 172413.79) // r2(200000 / 1.16)
  assert.equal(d.subtotal_bs, 344827.58)
  assert.equal(factura.iva_bs, 55172.42) // r2(27586.21 × 2)
  assert.equal(Math.round((factura.total_bs - factura.iva_bs) * 100) / 100, d.subtotal_bs)

  const nota = crearVenta({ clienteId, usuarioId, tipoDocumento: 'nota_entrega', items: [{ precioId: precio.id, cantidad: 2 }] })
  // La nota cobra lo mismo pero sin desglosar: línea y total = precio con IVA.
  assert.equal(nota.total_bs, 400000)
  assert.equal(nota.iva_bs, 0)
  const dn = ventasRepo.detalleDeVenta(nota.id)[0]
  assert.equal(dn.subtotal_bs, 400000)
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

test('pantalla = backend: la nota calcula con el IVA embebido y el guardián rechaza otro monto', () => {
  const { usuarioId, clienteId, precio } = preparar()
  // Igual que carritoDetallado en VentaView para nota: precio con IVA al 0%.
  const enPantalla = (conIva) => {
    const t = calcularTotales([calcularLinea(precioUnitarioConIva(precio, 16, conIva), 3, 0)])
    return { ivaPorcentaje: 0, subtotalBs: t.subtotal.bs, ivaBs: 0, totalBs: t.total.bs, totalUsdt: t.total.usdt }
  }
  // Pantalla en "Nota de entrega" (precio con IVA embebido) → coincide.
  const ok = crearVenta({
    clienteId, usuarioId, tipoDocumento: 'nota_entrega',
    items: [{ precioId: precio.id, cantidad: 3 }], totalesEsperados: enPantalla(false)
  })
  assert.equal(ok.total_bs, enPantalla(false).totalBs)
  // Una pantalla que no embebió el IVA (precio base) → el guardián rechaza.
  const sinIva = calcularTotales([calcularLinea(precio, 3, 0)])
  assert.throws(
    () => crearVenta({
      clienteId, usuarioId, tipoDocumento: 'nota_entrega',
      items: [{ precioId: precio.id, cantidad: 3 }],
      totalesEsperados: { ivaPorcentaje: 0, subtotalBs: sinIva.subtotal.bs, ivaBs: 0, totalBs: sinIva.total.bs, totalUsdt: sinIva.total.usdt }
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
    // El total es el cobrado: 200.000 + 16% embebido.
    assert.ok(/TOTAL Bs\s+232\.000,00/.test(texto), `${ancho}: total en Bs con IVA embebido`)
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
