import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularPrecios, redondear2 } from '../src/main/services/precios.calculo.js'

// Caso real del cliente (Docs/plan-precios-margenes-tasas.md): costo 1000,
// utilidad 100% (markup = al doble), BCV 100, Binance 120.
test('costo 1000, margen 100, BCV 100, Binance 120 → $2000, Bs 200000, USDT 1666.67', () => {
  assert.deepEqual(calcularPrecios(1000, 100, null, 100, 120), {
    precioUsd: 2000,
    precioBs: 200000,
    precioUsdt: 1666.67
  })
})

test('el margen es markup sobre el costo: 100% = vender al doble, 0% = al costo', () => {
  assert.equal(calcularPrecios(50, 0, null, 36, 40).precioUsd, 50)
  assert.equal(calcularPrecios(50, 50, null, 36, 40).precioUsd, 75)
  assert.equal(calcularPrecios(50, 100, null, 36, 40).precioUsd, 100)
})

test('margen USDT propio mueve solo el precio en divisas', () => {
  // costo 1000: %Bs 100 → $2000 → Bs 200.000; %USDT 150 → base $2500 →
  // Bs ficticio 250.000 → 250.000 ÷ 120 = 2.083,33 USDT
  const { precioUsd, precioBs, precioUsdt } = calcularPrecios(1000, 100, 150, 100, 120)
  assert.equal(precioUsd, 2000)
  assert.equal(precioBs, 200000)
  assert.equal(precioUsdt, 2083.33)
  // %USDT 80 → base $1800 → 180.000 ÷ 120 = 1.500 USDT
  assert.equal(calcularPrecios(1000, 100, 80, 100, 120).precioUsdt, 1500)
})

test('redondea a 2 decimales con valores feos', () => {
  assert.equal(redondear2(1666.666666), 1666.67)
  assert.equal(redondear2(1.0049), 1)
  assert.equal(redondear2(1.0051), 1.01)
  // 3.3333 → $6.67 con margen 100
  assert.equal(calcularPrecios(3.3333, 100, null, 100, 120).precioUsd, 6.67)
  // Bs canónico: el redondeo lo absorbe el USDT, nunca el Bs
  const { precioBs, precioUsdt } = calcularPrecios(100, 33.33, null, 96.543, 117.891)
  assert.equal(precioBs, redondear2(redondear2(100 * 1.3333) * 96.543))
  assert.equal(precioUsdt, redondear2(precioBs / 117.891))
})

test('con % iguales el precio USDT es exactamente Bs ÷ Binance', () => {
  const { precioBs, precioUsdt } = calcularPrecios(250, 100, 100, 100, 120)
  assert.equal(precioUsdt, redondear2(precioBs / 120))
})

test('sin tasas el precio en $ sigue calculándose y Bs/USDT quedan en null', () => {
  assert.deepEqual(calcularPrecios(10, 100, null, null, null), { precioUsd: 20, precioBs: null, precioUsdt: null })
  assert.deepEqual(calcularPrecios(10, 100, null, 0, 40), { precioUsd: 20, precioBs: null, precioUsdt: null })
})
