<template>
  <span class="tag" :class="'tag-' + estado">{{ etiqueta }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  estado: { type: String, required: true },
  etiquetas: { type: Object, default: () => ({}) }
})

const ETIQUETAS_BASE = {
  activa: 'Activa',
  anulada: 'Anulada'
}

const etiqueta = computed(() => props.etiquetas[props.estado] ?? ETIQUETAS_BASE[props.estado] ?? props.estado)
</script>
