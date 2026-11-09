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
      <span class="bs">{{ formatMontoBs(conIva.bs) }}</span>
      <small class="usd">{{ conIva.usd == null ? '—' : formatUsd(conIva.usd) }}</small>
    </div>
    <div class="desc">
      <template v-if="sinIva">Sin IVA · </template>
      <template v-else-if="ivaPorcentaje > 0">IVA {{ ivaPorcentaje }}% incluido · </template>
      {{ precio.margen }}% utilidad{{ precio.margenOrigen === 'propio' ? ' · margen propio' : '' }}
      <template v-if="precio.precioUsd == null">· sin costo cargado</template>
      <template v-else-if="precio.id == null">· se materializa al registrar una entrada</template>
    </div>
    <span v-if="selected" class="en-ticket">✓ Precio asignado</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { formatUsd, formatMontoBs } from '../composables/useFormato'
import { calcularLinea } from '../../../shared/venta.calculo.js'

const props = defineProps({
  precio: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  ivaPorcentaje: { type: Number, default: 0 },
  // El costo del producto traía el IVA incluido: el precio materializado ya
  // es el precio con IVA (no se le suma el impuesto encima).
  ivaIncluido: { type: Boolean, default: false },
  // Nota de entrega "sin IVA": se muestra la base sin impuesto.
  sinIva: { type: Boolean, default: false }
})
defineEmits(['click'])

// Precio unitario que se le dice al cliente (con IVA, o la base si la nota
// es sin IVA): misma función que usa el backend al registrar la venta.
const conIva = computed(() => {
  const l = calcularLinea(props.precio, 1, props.ivaPorcentaje, props.ivaIncluido)
  return props.sinIva ? l.unitario : l.unitarioConIva
})

</script>

<style scoped>
.amounts-dual {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.price-card .bs {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}
.price-card .usd {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
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
