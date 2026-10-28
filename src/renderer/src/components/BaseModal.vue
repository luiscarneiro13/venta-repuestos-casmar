<template>
  <div class="modal-overlay">
    <div class="modal-box" :class="{ wide, 'extra-wide': extraWide, xl, 'modal-box--teclado': tecladoActivo }" ref="modalBoxRef">
      <div class="modal-header">
        <slot name="icon" />
        <div class="modal-header-texto">
          <div class="modal-header-titulo">
            <h3>{{ title }}</h3>
            <slot name="header-extra" />
          </div>
          <slot name="subtitle" />
        </div>
        <button v-if="cerrable" type="button" title="Cerrar" @click="$emit('close')">×</button>
      </div>

      <slot />

      <div v-if="$slots.footer" class="modal-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

defineProps({
  title: { type: String, required: true },
  wide: { type: Boolean, default: false },
  extraWide: { type: Boolean, default: false },
  xl: { type: Boolean, default: false },
  cerrable: { type: Boolean, default: true }
})
defineEmits(['close'])

const tecladoActivo = ref(false)
let alturaTeclado = 0

function onViewportResize() {
  if (!window.visualViewport) return
  const alturaVentana = window.innerHeight
  const alturaVisible = window.visualViewport.height
  const diferencia = alturaVentana - alturaVisible

  if (diferencia > 100) {
    // El teclado está visible
    tecladoActivo.value = true
    alturaTeclado = diferencia
    document.documentElement.style.setProperty('--teclado-altura', `${diferencia}px`)
  } else {
    tecladoActivo.value = false
    alturaTeclado = 0
    document.documentElement.style.setProperty('--teclado-altura', '0px')
  }
}

onMounted(() => {
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize)
    onViewportResize()
  }
})

onUnmounted(() => {
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', onViewportResize)
  }
  document.documentElement.style.setProperty('--teclado-altura', '0px')
})
</script>
