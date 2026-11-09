import { reactive } from 'vue'

// Estado del ticket de "Nueva venta" en curso. Vive fuera del componente
// VentaView (a nivel de módulo) para sobrevivir a la navegación entre
// pantallas: Vue Router desmonta VentaView al salir de /venta, así que un
// state local del componente se perdería al volver.
//
// Cada línea es un producto; el precio se asigna explícitamente después.
// Las ventas nuevas siempre se registran en Bs; no hay método de pago en el
// estado del ticket para evitar conservar una selección USDT anterior.
// tipoDocumento: 'factura' (desglosa IVA) o 'nota_entrega' (nunca lo
// desglosa). La nota tiene dos opciones propias elegidas en un modal al
// seleccionarla: notaMoneda ('usd' | 'bs', moneda del documento) y
// notaConIva (true = cobra el precio con IVA embebido; false = la base).
export const ventaState = reactive({
  carrito: [],
  clienteSeleccionadoId: null,
  productoActivoId: null,
  tipoDocumento: 'factura',
  notaMoneda: 'usd',
  notaConIva: false
})

export function setTipoDocumento(tipo) {
  if (tipo === 'factura' || tipo === 'nota_entrega') ventaState.tipoDocumento = tipo
}

export function setNotaMoneda(moneda) {
  if (moneda === 'usd' || moneda === 'bs') ventaState.notaMoneda = moneda
}

export function setNotaConIva(conIva) {
  ventaState.notaConIva = Boolean(conIva)
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

// Recalcula en vivo mientras se escribe: acepta 0 de forma transitoria
// (el subtotal de la línea se ve en 0) sin quitar el producto todavía.
export function setCantidad(productoId, valor) {
  const item = ventaState.carrito.find((i) => i.productoId === productoId)
  if (!item) return
  const v = parseInt(valor, 10)
  item.cantidad = Number.isNaN(v) || v < 0 ? 0 : v
}

export function ajustarCantidadAlStock(productoId, stock) {
  const disponible = Math.max(0, Math.floor(Number(stock) || 0))
  if (disponible === 0) {
    quitarDelCarrito(productoId)
  } else {
    setCantidad(productoId, disponible)
  }
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
  ventaState.tipoDocumento = 'factura'
  ventaState.notaMoneda = 'usd'
  ventaState.notaConIva = false
}
