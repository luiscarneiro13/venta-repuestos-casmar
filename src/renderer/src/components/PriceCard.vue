<template>
  <button
    type="button"
    class="card price-card"
    :class="{ selected }"
    :aria-pressed="selected"
    :disabled="precio.id == null || precio.precioUsd == null"
    @click="$emit('click')"
  >
    <div class="code">{{ precio.tipoPrecioNombre }}</div>
    <div class="amounts amounts-dual">
      <span class="usd">{{ conIva.usd == null ? '—' : formatUsd(conIva.usd) }}</span>
      <span class="bs">
        {{ formatMontoBs(conIva.bs) }}
        <template v-if="conIva.usdt != null"> · {{ formatMontoUsdt(conIva.usdt) }}</template>
      </span>
    </div>
    <div class="desc">
      <template v-if="ivaPorcentaje > 0">IVA {{ ivaPorcentaje }}% incluido · </template>
      {{ precio.margen }}% utilidad{{ precio.margenOrigen === 'propio' ? ' · margen propio' : '' }}
      <template v-if="precio.precioUsd == null">· sin costo cargado</template>
      <template v-else-if="precio.id == null">· se materializa al registrar una entrada</template>
    </div>
    <span v-if="selected" class="en-ticket">✓ Precio asignado</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { formatUsd, formatMontoBs, formatMontoUsdt } from '../composables/useFormato'
import { calcularLinea } from '../../../shared/venta.calculo.js'

const props = defineProps({
  precio: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  ivaPorcentaje: { type: Number, default: 0 }
})
defineEmits(['click'])

// Precio unitario CON IVA (lo que se le dice al cliente): misma función que
// usa el backend al registrar la venta.
const conIva = computed(() => calcularLinea(props.precio, 1, props.ivaPorcentaje).unitarioConIva)
</script>

<style scoped>
.amounts-dual {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.price-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.price-card:disabled:hover {
  border-color: var(--border);
  box-shadow: none;
  transform: none;
}
</style>
