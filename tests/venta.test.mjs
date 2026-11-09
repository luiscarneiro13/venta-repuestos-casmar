import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import {
  ventaState,
  agregarProducto,
  asignarPrecio,
  setCantidad,
  ajustarCantidadAlStock,
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

test('al aceptar stock insuficiente la cantidad baja al máximo disponible', () => {
  agregarProducto(1)
  asignarPrecio(1, 10)
  setCantidad(1, '9')
  ajustarCantidadAlStock(1, 2)
  assert.equal(ventaState.carrito[0].cantidad, 2)
  assert.equal(ventaState.carrito[0].precioId, 10)
})

test('si el stock disponible es cero, aceptar quita el producto del carrito', () => {
  agregarProducto(1)
  setCantidad(1, '9')
  ajustarCantidadAlStock(1, 0)
  assert.equal(ventaState.carrito.length, 0)
  assert.equal(ventaState.productoActivoId, null)
})

test('el aviso de stock ajusta la cantidad al aceptar o cerrar el modal', () => {
  const vista = readFileSync(new URL('../src/renderer/src/pages/VentaView.vue', import.meta.url), 'utf8')
  assert.match(vista, /title="Stock insuficiente" @close="aceptarStock"/)
  assert.match(vista, /@click="aceptarStock">Entendido/)
  assert.match(vista, /ajustarCantidadAlStock\(modalStock\.productoId,/)
  assert.doesNotMatch(vista, /Se dejó la cantidad en el máximo disponible/)
})

test('el ticket no guarda un método de pago oculto', () => {
  assert.equal(Object.hasOwn(ventaState, 'metodoPago'), false)
})

test('la pantalla no ofrece un selector de pago y registra siempre en Bs', () => {
  const vista = readFileSync(new URL('../src/renderer/src/pages/VentaView.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(vista, /setMetodoPago|aria-label="Método de pago"/)
  assert.match(vista, /window\.api\.ventas\.crear\(\{[\s\S]*?metodoPago: 'bs'/)
})

test('el carrito muestra el mismo precio en Bs y $ sin cotización separada', () => {
  const vista = readFileSync(new URL('../src/renderer/src/pages/VentaView.vue', import.meta.url), 'utf8')
  const linea = readFileSync(new URL('../src/renderer/src/components/CartItem.vue', import.meta.url), 'utf8')
  assert.match(vista, /Pago en bolívares[\s\S]*?formatMontoBs\(totales\.total\.bs\)/)
  assert.match(vista, /formatUsd\(totales\.total\.usd\)/)
  assert.match(linea, /formatUsd\(item\.linea\.unitarioConIva\.usd\)/)
  assert.match(linea, /formatUsd\(item\.linea\.total\.usd\)/)
  assert.doesNotMatch(vista, /Pago en divisas|Binance \(USDT\)/)
  assert.doesNotMatch(linea, /USDT|Binance|divisas/i)
  assert.doesNotMatch(vista + linea, /≈/)
})

test('las cards muestran Bs primero y el mismo precio en $ debajo; factura sigue predeterminada', () => {
  const card = readFileSync(new URL('../src/renderer/src/components/PriceCard.vue', import.meta.url), 'utf8')
  assert.ok(card.indexOf('formatMontoBs(conIva.bs)') < card.indexOf('formatUsd(conIva.usd)'))
  assert.doesNotMatch(card.split('<script setup>')[0], /USDT|Divisas/)
  assert.equal(ventaState.tipoDocumento, 'factura')
  assert.deepEqual([...ventaState.carrito], [])
})
