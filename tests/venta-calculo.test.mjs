import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularLinea, calcularTotales } from '../src/shared/venta.calculo.js'

const precio = { precioUsd: 2000, precioBs: 200000, precioUsdt: 1666.67 }

test('precio con IVA por unidad = base + IVA unitario redondeado', () => {
  const l = calcularLinea(precio, 1, 16)
  assert.deepEqual(l.ivaUnitario, { usd: 320, bs: 32000, usdt: 266.67 })
  assert.deepEqual(l.unitarioConIva, { usd: 2320, bs: 232000, usdt: 1933.34 })
})

test('total de línea = precio con IVA × cantidad, y subtotal + IVA = total', () => {
  const l = calcularLinea(precio, 3, 16)
  for (const m of ['usd', 'bs', 'usdt']) {
    assert.equal(l.total[m], Math.round(l.unitarioConIva[m] * 3 * 100) / 100)
    assert.equal(Math.round((l.subtotal[m] + l.iva[m]) * 100) / 100, l.total[m])
  }
})

test('los totales de la venta son la suma de las líneas', () => {
  const l1 = calcularLinea(precio, 2, 16)
  const l2 = calcularLinea({ precioUsd: 12.35, precioBs: 1235.5, precioUsdt: 10.3 }, 7, 16)
  const t = calcularTotales([l1, l2])
  for (const m of ['usd', 'bs', 'usdt']) {
    assert.equal(t.subtotal[m], Math.round((l1.subtotal[m] + l2.subtotal[m]) * 100) / 100)
    assert.equal(t.iva[m], Math.round((l1.iva[m] + l2.iva[m]) * 100) / 100)
    assert.equal(t.total[m], Math.round((l1.total[m] + l2.total[m]) * 100) / 100)
  }
})

test('IVA 0 deja el precio igual y una moneda sin tasa queda en null', () => {
  const l = calcularLinea({ precioUsd: 10, precioBs: null, precioUsdt: null }, 2, 0)
  assert.equal(l.unitarioConIva.usd, 10)
  assert.equal(l.total.bs, null)
  assert.equal(calcularTotales([l]).total.bs, null)
})
