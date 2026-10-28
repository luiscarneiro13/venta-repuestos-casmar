import { reactive } from 'vue'

// Estado del ticket de "Nueva venta" en curso. Vive fuera del componente
// VentaView (a nivel de módulo) para sobrevivir a la navegación entre
// pantallas: Vue Router desmonta VentaView al salir de /venta, así que un
// state local del componente se perdería al volver.
//
// Cada línea es un producto; el precio se asigna explícitamente después.
// metodoPago es uno solo para toda la venta: 'bs' (bolívares a tasa BCV)
// o 'usdt' (equivalente del total en Bs a tasa Binance).
// tipoDocumento: 'factura' (con IVA) o 'nota_entrega' (igual, pero sin IVA).
export const ventaState = reactive({
  carrito: [],
  clienteSeleccionadoId: null,
  productoActivoId: null,
  metodoPago: 'bs',
  tipoDocumento: 'factura'
})

export function setTipoDocumento(tipo) {
  if (tipo === 'factura' || tipo === 'nota_entrega') ventaState.tipoDocumento = tipo
}

export function agregarProducto(productoId) {
  if (!ventaState.carrito.some((i) => i.productoId === productoId)) {
    ventaState.carrito.push({ productoId, precioId: null, cantidad: 1 })
  }
  ventaState.productoActivoId = productoId
}

export function asignarPrecio(productoId, precioId) {
  const item = ventaState.carrito.find((i) => i.productoId === productoId)
  if (item) item.precioId = precioId
}

export function setMetodoPago(metodo) {
  if (metodo === 'bs' || metodo === 'usdt') ventaState.metodoPago = metodo
}

// Recalcula en vivo mientras se escribe: acepta 0 de forma transitoria
// (el subtotal de la línea se ve en 0) sin quitar el producto todavía.
export function setCantidad(productoId, valor) {
  const item = ventaState.carrito.find((i) => i.productoId === productoId)
  if (!item) return
  const v = parseInt(valor, 10)
  item.cantidad = Number.isNaN(v) || v < 0 ? 0 : v
}

export function quitarDelCarrito(productoId) {
  const idx = ventaState.carrito.findIndex((i) => i.productoId === productoId)
  if (idx !== -1) ventaState.carrito.splice(idx, 1)
  if (ventaState.productoActivoId === productoId) ventaState.productoActivoId = null
}

// Se llama al salir del input de cantidad (blur): la cantidad debe quedar
// en un entero mayor a 0; si el usuario dejó 0 (o algo inválido/vacío), el
// producto se elimina del carrito en vez de forzarlo a 1.
export function confirmarCantidad(productoId, valor) {
  const v = parseInt(valor, 10)
  if (!v || v < 1) {
    quitarDelCarrito(productoId)
    return
  }
  setCantidad(productoId, valor)
}

export function limpiarCarrito() {
  ventaState.carrito.splice(0, ventaState.carrito.length)
}

export function limpiarTicket() {
  limpiarCarrito()
  ventaState.clienteSeleccionadoId = null
  ventaState.productoActivoId = null
  ventaState.metodoPago = 'bs'
  ventaState.tipoDocumento = 'factura'
}
