import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularPrecios, redondear2 } from '../src/main/services/precios.calculo.js'

// Caso real del cliente (Docs/plan-precios-margenes-tasas.md): costo 1000,
// utilidad 100% (markup = al doble), BCV 100, Binance 120.
test('costo 1000, margen 100, BCV 100, Binance 120 → $2000, Bs 200000, USDT 1666.67', () => {
  assert.deepEqual(calcularPrecios(1000, 100, 100, 120), {
    precioUsd: 2000,
    precioBs: 200000,
    precioUsdt: 1666.67
  })
})

test('el margen es markup sobre el costo: 100% = vender al doble, 0% = al costo', () => {
  assert.equal(calcularPrecios(50, 0, 36, 40).precioUsd, 50)
  assert.equal(calcularPrecios(50, 50, 36, 40).precioUsd, 75)
  assert.equal(calcularPrecios(50, 100, 36, 40).precioUsd, 100)
})

test('redondea a 2 decimales con valores feos', () => {
  assert.equal(redondear2(1666.666666), 1666.67)
  assert.equal(redondear2(1.0049), 1)
  assert.equal(redondear2(1.0051), 1.01)
  // 3.3333 → $6.67 con margen 100
  assert.equal(calcularPrecios(3.3333, 100, 100, 120).precioUsd, 6.67)
  // Bs canónico: el redondeo lo absorbe el USDT, nunca el Bs
  const { precioBs, precioUsdt } = calcularPrecios(100, 33.33, 96.543, 117.891)
  assert.equal(precioBs, redondear2(redondear2(100 * 1.3333) * 96.543))
  assert.equal(precioUsdt, redondear2(precioBs / 117.891))
})

test('el precio en Bs es canónico e igual en ambos métodos de pago', () => {
  const bs = calcularPrecios(250, 100, 100, 120)
  const usdt = calcularPrecios(250, 100, 100, 120)
  assert.equal(bs.precioBs, usdt.precioBs)
  assert.equal(usdt.precioUsdt, redondear2(usdt.precioBs / 120))
})

test('sin tasas el precio en $ sigue calculándose y Bs/USDT quedan en null', () => {
  assert.deepEqual(calcularPrecios(10, 100, null, null), { precioUsd: 20, precioBs: null, precioUsdt: null })
  assert.deepEqual(calcularPrecios(10, 100, 0, 40), { precioUsd: 20, precioBs: null, precioUsdt: null })
})
