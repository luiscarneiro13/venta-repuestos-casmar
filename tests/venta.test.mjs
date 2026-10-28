import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  ventaState,
  agregarProducto,
  asignarPrecio,
  setCantidad,
  setMetodoPago,
  quitarDelCarrito,
  limpiarTicket
} from '../src/renderer/src/store/venta.js'

afterEach(() => limpiarTicket())

test('agregar un producto no asigna precio ni duplica su línea', () => {
  agregarProducto(1)
  agregarProducto(1)
  assert.deepEqual([...ventaState.carrito], [{ productoId: 1, precioId: null, cantidad: 1 }])
  assert.equal(ventaState.productoActivoId, 1)
})

test('elegir otro precio modifica la línea seleccionada sin alterar cantidad ni otros productos', () => {
  agregarProducto(1)
  setCantidad(1, 3)
  agregarProducto(2)
  asignarPrecio(1, 10)
  asignarPrecio(1, 11)
  assert.deepEqual([...ventaState.carrito], [
    { productoId: 1, precioId: 11, cantidad: 3 },
    { productoId: 2, precioId: null, cantidad: 1 }
  ])
})

test('quitar el producto activo limpia la selección de precios', () => {
  agregarProducto(1)
  quitarDelCarrito(1)
  assert.equal(ventaState.productoActivoId, null)
  assert.equal(ventaState.carrito.length, 0)
})

test('el método de pago es bs por defecto y solo acepta bs o usdt', () => {
  assert.equal(ventaState.metodoPago, 'bs')
  setMetodoPago('usdt')
  assert.equal(ventaState.metodoPago, 'usdt')
  setMetodoPago('efectivo')
  assert.equal(ventaState.metodoPago, 'usdt')
})

test('limpiar el ticket reinicia el método de pago a bs', () => {
  setMetodoPago('usdt')
  limpiarTicket()
  assert.equal(ventaState.metodoPago, 'bs')
})
