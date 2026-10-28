// El reporte diario (reporte Z) debe mostrar las tasas del día: BCV (USD) y
// Binance (USDT), en 58 y 80mm sin encimar texto.
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

const { construirTicketReporteZ } = await import('../src/main/printer/ticket.printer.js')
const { nuevaBaseEnMemoria } = await import('./helpers/db.mjs')
const { registrarTasa } = await import('../src/main/services/tasas.service.js')
const tasasRepo = await import('../src/main/repositories/tasas.repo.js')

let db = null
afterEach(() => {
  db?.close()
  db = null
})

test('obtenerTasaDeFecha devuelve la última tasa registrada ese día', () => {
  db = nuevaBaseEnMemoria()
  const usuarioId = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id
  registrarTasa({ valorBcv: 36.5, valorUsdt: 40.1, usuarioId })
  registrarTasa({ valorBcv: 36.75, valorUsdt: 41.25, usuarioId })
  const hoy = db.prepare("SELECT date('now', 'localtime') AS d").get().d
  const tasa = tasasRepo.obtenerTasaDeFecha(hoy)
  assert.equal(tasa.valor_bcv, 36.75)
  assert.equal(tasa.valor_usdt, 41.25)
  assert.equal(tasasRepo.obtenerTasaDeFecha('2000-01-01'), null)
})

test('el reporte diario imprime la tasa BCV (USD) y la tasa Binance (USDT) del día', () => {
  for (const ancho of ['58mm', '80mm']) {
    const recibo = construirTicketReporteZ({
      ventas: [],
      usuarioNombre: 'Admin',
      tasaBcv: 1234.56,
      tasaUsdt: 1456.78,
      totalUnidades: 0,
      ancho
    })
    const texto = recibo.preview()
    const lineas = texto.split('\n')
    assert.ok(texto.includes('Tasas del día'), `${ancho}: falta el título`)
    assert.ok(/Tasa BCV \(USD\).*1\.234,56 Bs/s.test(texto), `${ancho}: falta la tasa BCV`)
    assert.ok(/Tasa Binance \(USDT\).*1\.456,78 Bs/s.test(texto), `${ancho}: falta la tasa Binance`)
    for (const l of lineas) assert.ok(l.length <= recibo.config.columns, `${ancho}: línea desbordada "${l}"`)
  }
})

test('el reporte diario va en USD con el equivalente en Bs, sin desbordar en 58mm', () => {
  const venta = {
    numero_ticket: 'T-0001', cliente_nombre: 'Cliente con un nombre bastante largo', usuario_nombre: 'Admin',
    tipo_documento: 'factura', metodo_pago: 'usdt',
    iva_porcentaje: 16, iva_usd: 1234.56, iva_bs: 98765432.1,
    total_usd: 8950.56, total_bs: 716044800.12, total_usdt: 5966.99,
    items: [{
      cantidad: 3, producto_nombre: 'Amortiguador delantero Corolla', tipo_precio_nombre: 'Precio Full',
      precio_unitario_usd: 2572, precio_unitario_bs: 205760000, subtotal_usd: 7716, subtotal_bs: 617280000.01
    }]
  }
  for (const ancho of ['58mm', '80mm']) {
    const recibo = construirTicketReporteZ({ ventas: [venta], usuarioNombre: 'Admin', tasaBcv: 80000, tasaUsdt: 120000, totalUnidades: 3, ancho })
    const texto = recibo.preview()
    for (const l of texto.split('\n')) assert.ok(l.length <= recibo.config.columns, `${ancho}: línea desbordada "${l}"`)
    // USD primero y el equivalente en Bs después, por venta y en totales.
    const usd = texto.indexOf('Total USD')
    const bs = texto.indexOf('equiv. Bs')
    assert.ok(usd >= 0 && bs > usd, `${ancho}: USD antes que Bs`)
    assert.ok(texto.includes('$ 8,950.56'), `${ancho}: total USD`)
    assert.ok(texto.includes('716.044.800,12'), `${ancho}: equivalente Bs`)
    assert.ok(texto.includes('Precio Full - $ 2,572.00 c/u'), `${ancho}: unitario en USD`)
    assert.ok(texto.includes('IVA del día USD'), `${ancho}: IVA en USD`)
    assert.ok(texto.includes('$ 1,234.56'), `${ancho}: IVA del día en USD`)
  }
})
