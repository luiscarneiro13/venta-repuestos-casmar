import { onMounted, onUnmounted } from 'vue'

// Se suscribe a los eventos de cambio que difunde el servidor por WebSocket
// (en el esclavo) o emite localmente (en el servidor), para refresco en vivo
// entre las PCs de la oficina. 'todo' (reinicio de BD) recarga cualquier
// vista suscrita.
export function alCambiar(tipos, callback) {
  const conjunto = new Set(Array.isArray(tipos) ? tipos : [tipos])
  let quitar = null
  onMounted(() => {
    quitar = window.api?.eventos?.on?.((evento) => {
      if (conjunto.has(evento.tipo) || evento.tipo === 'todo') callback(evento)
    }) ?? null
  })
  onUnmounted(() => quitar?.())
}
