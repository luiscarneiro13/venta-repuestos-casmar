// El documento de venta en hoja carta (documento.printer.js →
// construirDocumentoVenta) debe imprimir EXACTAMENTE los montos guardados en
// la venta — los mismos que ve la pantalla — y respetar las reglas del
// documento impreso:
//   - Factura: título FACTURA + T-XXXX, líneas SIN IVA, Subtotal/IVA/TOTAL en Bs.
//   - Nota de entrega: título NOTA DE ENTREGA + NE-XXXX, solo TOTAL (sin IVA).
//   - ORIGINAL: "Gracias por su compra". COPIA: líneas de firma.
//   - El encabezado lleva los datos del negocio configurados.
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

const { construirDocumentoVenta, construirDocumentoReporteZ, construirDocumentoPrueba } =
  await import('../src/main/printer/documento.printer.js')
const { nuevaBaseEnMemoria } = await import('./helpers/db.mjs')
const { registrarTasa } = await import('../src/main/services/tasas.service.js')
const { registrarEntrada } = await import('../src/main/services/inventario.service.js')
const { crearCliente } = await import('../src/main/services/clientes.service.js')
const { guardarNegocio } = await import('../src/main/services/configuracion.service.js')
const { crearVenta } = await import('../src/main/services/ventas.service.js')
const { listarPreciosPorProducto } = await import('../src/main/services/precios.service.js')
const { datosTicketVenta } = await import('../src/main/services/impresora.service.js')
const { formatMontoBs } = await import('../src/renderer/src/composables/useFormato.js')

const NEGOCIO = {
  nombre: 'Repuestos El Torno C.A.',
  rif: 'J-12345678-9',
  direccion: 'Av. Principal, Local 5',
  telefono: '0414-000-0000'
}

let db = null
afterEach(() => {
  db?.close()
  db = null
})

function preparar({ tipoDocumento = 'factura', notaMoneda, notaConIva } = {}) {
  db = nuevaBaseEnMemoria()
  guardarNegocio(NEGOCIO)
  const usuarioId = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id
  registrarTasa({ valorBcv: 400, valorUsdt: 410, usuarioId })
  const productoId = db
    .prepare("INSERT INTO productos (codigo, nombre, unidad_medida) VALUES ('P1', 'Buje delantero', 'UNIDAD')")
    .run().lastInsertRowid
  const proveedorId = db.prepare("INSERT INTO proveedores (nombre) VALUES ('Prov')").run().lastInsertRowid
  registrarEntrada({ productoId, cantidad: 50, proveedorId, precioCompraUsd: 5, usuarioId, margenes: [] })
  const precio = listarPreciosPorProducto(productoId).find((p) => p.tipoPrecioNombre === 'Precio Full')
  const cliente = crearCliente({
    nombre: 'Cliente Prueba',
    tipoDoc: 'V',
    doc: '12345678',
    tel: '0424-111',
    direccion: 'Sector Centro'
  })
  const venta = crearVenta({
    clienteId: cliente.id,
    usuarioId,
    metodoPago: 'bs',
    tipoDocumento,
    notaMoneda,
    notaConIva,
    items: [{ precioId: precio.id, cantidad: 2 }]
  })
  return datosTicketVenta(venta.id)
}

test('factura en carta: encabezado del negocio, montos guardados y ORIGINAL', () => {
  const { venta, items, negocio } = preparar()

  const html = construirDocumentoVenta({ venta, items, negocio, copia: 'original' })

  assert.ok(html.includes('size: Letter'), 'la página es hoja carta')
  assert.ok(html.includes('FACTURA'), 'es una factura')
  assert.ok(html.includes(venta.numero_ticket), 'lleva el número de ticket')
  assert.ok(html.includes('ORIGINAL'), 'rotulada como ORIGINAL')
  assert.ok(html.includes('Gracias por su compra'), 'la original despide al cliente')

  // Datos del negocio configurados en el encabezado
  for (const campo of Object.values(NEGOCIO)) assert.ok(html.includes(campo), `falta ${campo}`)

  // Cliente con su documento
  assert.ok(html.includes('Cliente Prueba'), 'nombre del cliente')
  assert.ok(html.includes('V-12345678'), 'documento del cliente')

  // Montos: exactamente los guardados en la venta (nunca recalculados)
  const subtotal = items.reduce((s, i) => s + i.subtotal_bs, 0)
  assert.ok(html.includes(formatMontoBs(subtotal).replace(' Bs', '')), 'subtotal de líneas')
  assert.ok(html.includes(formatMontoBs(venta.iva_bs).replace(' Bs', '')), `IVA ${venta.iva_bs}`)
  assert.ok(html.includes(formatMontoBs(venta.total_bs).replace(' Bs', '')), `TOTAL ${venta.total_bs}`)
  assert.ok(html.includes(`IVA ${venta.iva_porcentaje}%`), 'etiqueta del % de IVA')
  // Las tasas de cambio no se imprimen en la factura.
  assert.ok(!html.includes('Tasa BCV') && !html.includes('Binance'), 'sin fila de tasas')
})

test('la COPIA lleva rótulo COPIA y zona de firma, sin "Gracias"', () => {
  const { venta, items, negocio } = preparar()
  const html = construirDocumentoVenta({ venta, items, negocio, copia: 'copia' })

  assert.ok(html.includes('>COPIA<'), 'rotulada como COPIA')
  assert.ok(!html.includes('ORIGINAL'), 'sin rótulo ORIGINAL')
  assert.ok(html.includes('Recibido por'), 'línea de firma')
  assert.ok(!html.includes('Gracias por su compra'), 'la copia es de la tienda')
})

test('nota de entrega: montos en $, sin IVA/método/tasas, con bloque de recepción', () => {
  const { venta, items, negocio } = preparar({ tipoDocumento: 'nota_entrega' })
  const html = construirDocumentoVenta({ venta, items, negocio, copia: 'original' })

  assert.ok(html.includes('NOTA DE ENTREGA'), 'título de nota de entrega')
  assert.ok(html.includes(venta.numero_ticket), 'número NE-')

  // Todo en dólares: total, unitario e importe de línea.
  const usd = (n) => `$ ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  assert.ok(html.includes(usd(venta.total_usd)), 'TOTAL en $')
  assert.ok(html.includes(usd(items[0].precio_unitario_usd)), 'precio unitario en $')
  assert.ok(html.includes(usd(items[0].subtotal_usd)), 'importe en $')
  assert.ok(!html.includes('TOTAL Bs'), 'sin total en Bs')

  // Lo que la nota NO lleva.
  assert.ok(!/IVA \d/.test(html), 'sin línea de IVA')
  assert.ok(!html.includes('Método de pago'), 'sin método de pago')
  assert.ok(!html.includes('Tasa BCV'), 'sin tasas de cambio')

  // Bloque de recepción fijo abajo a la izquierda.
  for (const rotulo of ['RECIBIDO:', 'FECHA:', 'FIRMA:']) {
    assert.ok(html.includes(rotulo), `falta ${rotulo}`)
  }
  assert.ok(html.includes('pagina-nota'), 'la página marca la clase de nota')
})

test('nota de entrega en Bs y sin IVA: montos en bolívares (la base) y nada de IVA', () => {
  const { venta, items, negocio } = preparar({ tipoDocumento: 'nota_entrega', notaMoneda: 'bs', notaConIva: false })
  const html = construirDocumentoVenta({ venta, items, negocio, copia: 'original' })

  assert.equal(venta.nota_moneda, 'bs')
  // Precio $10 base × 2 = $20 → 8.000 Bs a tasa 400 (sin el 16%).
  assert.equal(venta.total_bs, 8000)
  assert.ok(html.includes('NOTA DE ENTREGA'))
  assert.ok(html.includes('TOTAL Bs'), 'total rotulado en Bs')
  assert.ok(html.includes(formatMontoBs(venta.total_bs).replace(' Bs', '')), 'TOTAL en Bs')
  assert.ok(html.includes(formatMontoBs(items[0].precio_unitario_bs).replace(' Bs', '')), 'unitario en Bs')
  assert.ok(!html.includes('$ '), 'sin montos en dólares')
  assert.ok(!/IVA \d/.test(html) && !html.includes('Método de pago') && !html.includes('Tasa BCV'))
  assert.ok(html.includes('RECIBIDO:'))
})

test('el texto del documento escapa HTML de datos del negocio y del cliente', () => {
  const { venta, items } = preparar()
  const html = construirDocumentoVenta({
    venta: { ...venta, cliente_nombre: 'A&B <Repuestos>' },
    items,
    negocio: { nombre: 'El <Taller> & Cía' },
    copia: 'original'
  })
  assert.ok(html.includes('A&amp;B &lt;Repuestos&gt;'), 'cliente escapado')
  assert.ok(html.includes('El &lt;Taller&gt; &amp; Cía'), 'negocio escapado')
  assert.ok(!html.includes('A&B <Repuestos>'), 'sin HTML crudo')
})

test('datosTicketVenta incluye el bloque negocio para imprimir igual en cualquier PC', () => {
  const datos = preparar()
  assert.deepEqual(datos.negocio, NEGOCIO)
})

test('reporte diario en carta con totales y firmas', () => {
  const { venta, items, negocio } = preparar()
  const html = construirDocumentoReporteZ({
    ventas: [{ ...venta, items }],
    usuarioNombre: 'Admin',
    tasaBcv: 400,
    tasaUsdt: 410,
    totalUnidades: 2,
    negocio
  })
  assert.ok(html.includes('REPORTE DIARIO'), 'título')
  assert.ok(html.includes(venta.numero_ticket), 'lista la venta')
  assert.ok(html.includes('Tasa BCV (USD):</span> 400,00 Bs'), 'tasa BCV del día')
  assert.ok(html.includes('Tasa USDT:</span> 410,00 Bs'), 'tasa USDT independiente')
  assert.ok(html.includes(formatMontoBs(venta.total_bs).replace(' Bs', '')), 'total del día')
  assert.ok(html.includes('Unidades vendidas'), 'resumen de unidades')
  assert.ok(html.includes('Firma'), 'zona de firma')
})

test('página de prueba en carta con el nombre de la impresora', () => {
  const html = construirDocumentoPrueba({ nombreImpresora: 'HP LaserJet', negocio: NEGOCIO })
  assert.ok(html.includes('PRUEBA DE IMPRESIÓN'))
  assert.ok(html.includes('HP LaserJet'))
  assert.ok(html.includes('size: Letter'))
})
