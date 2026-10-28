import { reactive, readonly } from 'vue'

const state = reactive({
  autenticado: false,
  usuario: null,
  tasa: 187.32, // tasa BCV (Bs por USD)
  tasaUsdt: 187.32, // tasa USDT Binance (Bs por USDT)
  tasaConfirmada: false, // true cuando las tasas del día ya fueron verificadas/ingresadas
  caja: null, // fila de la caja abierta HOY (o null si no hay ninguna)
  cajasPendientes: [] // cajas abiertas de días anteriores que quedaron sin cerrar
})

export const session = readonly(state)

export function iniciarSesion({ usuario }) {
  state.usuario = usuario
  state.autenticado = true
  state.tasaConfirmada = false
}

// Se confirman las dos tasas juntas: son un solo registro en tasas_cambio.
export function confirmarTasa(valorBcv, valorUsdt) {
  state.tasa = valorBcv
  state.tasaUsdt = valorUsdt ?? valorBcv
  state.tasaConfirmada = true
}

export function setCajaDelDia(caja, cajasPendientes = []) {
  state.caja = caja
  state.cajasPendientes = cajasPendientes
}

// Se llama tras cerrar una caja: si era la de hoy, deja de mostrarse como
// abierta; si era una pendiente de un día anterior, se quita de la lista.
export function marcarCajaCerrada(cajaId) {
  if (state.caja?.id === cajaId) {
    state.caja = null
  }
  state.cajasPendientes = state.cajasPendientes.filter((c) => c.id !== cajaId)
}

export function cerrarSesion() {
  // También se cierra la sesión del proceso principal (la que usan las
  // guardas de permisos). No se espera: la UI sale de inmediato.
  window.api?.auth?.logout().catch(() => {})
  state.autenticado = false
  state.usuario = null
  state.tasaConfirmada = false
  state.caja = null
  state.cajasPendientes = []
}

export function actualizarTasa(valorBcv, valorUsdt) {
  state.tasa = valorBcv
  state.tasaUsdt = valorUsdt ?? valorBcv
}
