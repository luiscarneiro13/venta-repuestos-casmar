import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizarPrecios } from '../src/main/services/precios.validation.js'

test('una entrada necesita al menos un precio de venta', () => {
  assert.throws(() => normalizarPrecios([]), /al menos un precio de venta/)
  assert.throws(() => normalizarPrecios(undefined), /al menos un precio de venta/)
  assert.deepEqual(normalizarPrecios([
    { tipoPrecioId: 1, valorUsd: 12.5, descripcion: ' Detal ' }
  ]), [{ tipoPrecioId: 1, valorUsd: 12.5, descripcion: 'Detal' }])
})

test('rechaza precios repetidos o no positivos', () => {
  assert.throws(() => normalizarPrecios([
    { tipoPrecioId: 1, valorUsd: 12 },
    { tipoPrecioId: 1, valorUsd: 15 }
  ]), /repetido/)
  assert.throws(() => normalizarPrecios([{ tipoPrecioId: 1, valorUsd: 0 }]), /mayor a 0/)
})
