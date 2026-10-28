import assert from 'node:assert/strict'
import { test } from 'node:test'
import { r2, calcularPrecios, parseMargen } from '../src/renderer/src/composables/usePrecios.js'

test('r2 redondea a 2 decimales una sola vez', () => {
  assert.equal(r2(1666.6666667), 1666.67)
  assert.equal(r2(2000), 2000)
  assert.equal(r2(0.005), 0.01)
})

test('ejemplo del cliente: costo 1000, margen 100%, BCV 100, Binance 120', () => {
  const { precioUsd, precioBs, precioUsdt } = calcularPrecios(1000, 100, 100, 120)
  assert.equal(precioUsd, 2000)
  assert.equal(precioBs, 200000)
  assert.equal(precioUsdt, 1666.67)
})

test('margen 0% vende al costo y el USDT siempre es Bs ÷ Binance', () => {
  const { precioUsd, precioBs, precioUsdt } = calcularPrecios(50, 0, 100, 120)
  assert.equal(precioUsd, 50)
  assert.equal(precioBs, 5000)
  assert.equal(precioUsdt, 41.67)
})

test('sin tasa vigente el precio en esa moneda queda null', () => {
  assert.deepEqual(calcularPrecios(10, 100, null, null), { precioUsd: 20, precioBs: null, precioUsdt: null })
  assert.deepEqual(calcularPrecios(10, 100, 100, 0), { precioUsd: 20, precioBs: 2000, precioUsdt: null })
})

test('parseMargen acepta coma o punto y rechaza negativos e inválidos', () => {
  assert.equal(parseMargen('75,5'), 75.5)
  assert.equal(parseMargen('75.5'), 75.5)
  assert.equal(parseMargen('abc'), 0)
  assert.equal(parseMargen('-5'), 0)
  assert.equal(parseMargen(''), 0)
})
