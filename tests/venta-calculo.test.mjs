import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularLinea, calcularTotales, precioUnitarioConIva } from '../src/shared/venta.calculo.js'

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

// ---------- Costo con IVA incluido (ivaIncluido) ----------
// El precio materializado ya contiene el IVA: se desglosa hacia atrás y el
// total de la línea sigue siendo el precio × cantidad.

test('con IVA incluido: el precio es el con-IVA y base + IVA lo reconstruye al céntimo', () => {
  const l = calcularLinea(precio, 1, 16, true)
  assert.deepEqual(l.unitarioConIva, { usd: 2000, bs: 200000, usdt: 1666.67 })
  assert.equal(l.unitario.usd, 1724.14) // r2(2000 / 1.16)
  assert.equal(l.ivaUnitario.usd, 275.86) // r2(2000 − 1724.14)
  for (const m of ['usd', 'bs', 'usdt']) {
    assert.equal(l.unitario[m] + l.ivaUnitario[m], l.unitarioConIva[m])
    assert.equal(l.total[m], l.unitarioConIva[m])
  }
})

test('con IVA incluido: total de línea = precio × cantidad (subtotal + IVA)', () => {
  const l = calcularLinea(precio, 3, 16, true)
  for (const m of ['usd', 'bs', 'usdt']) {
    assert.equal(l.subtotal[m], Math.round(l.unitario[m] * 3 * 100) / 100)
    assert.equal(l.iva[m], Math.round(l.ivaUnitario[m] * 3 * 100) / 100)
    assert.equal(l.total[m], Math.round(l.unitarioConIva[m] * 3 * 100) / 100)
    assert.equal(Math.round((l.subtotal[m] + l.iva[m]) * 100) / 100, l.total[m])
  }
})

test('con IVA incluido e IVA 0%: el precio queda igual (nada que desglosar)', () => {
  const l = calcularLinea(precio, 2, 0, true)
  assert.equal(l.unitario.usd, 2000)
  assert.equal(l.iva.usd, 0)
  assert.equal(l.total.usd, 4000)
})

test('precioUnitarioConIva: sin IVA en costo suma el impuesto; con IVA devuelve el materializado', () => {
  assert.deepEqual(
    precioUnitarioConIva(precio, 16, false),
    { precioUsd: 2320, precioBs: 232000, precioUsdt: 1933.34 }
  )
  assert.deepEqual(
    precioUnitarioConIva(precio, 16, true),
    { precioUsd: 2000, precioBs: 200000, precioUsdt: 1666.67 }
  )
})
