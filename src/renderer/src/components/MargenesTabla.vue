<template>
  <div class="margenes-card">
    <div class="margenes-head">{{ encabezadoTasas }}</div>
    <table class="margenes-tabla">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>% Utilidad</th>
          <th>Precio Bs / $</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="fila in filas" :key="fila.tipoPrecioId">
          <td>
            <span class="tipo-nombre">{{ fila.nombre }}</span>
            <span class="tipo-tag">{{ etiquetaOrigen(fila) }}</span>
          </td>
          <td class="bcv">
            <span class="pct-wrap">
              <input
                v-model="fila.margenTexto"
                class="input-pct num"
                type="text"
                inputmode="decimal"
                :aria-label="`% utilidad de ${fila.nombre}`"
                @input="onInputMargen(fila)"
              />
            </span>
          </td>
          <td class="bcv">
            <span class="precio-calc">
              {{ preciosDe(fila).precioBs == null ? '—' : `Bs ${fmt(preciosDe(fila).precioBs)}` }}
              <small>$ {{ fmt(preciosDe(fila).precioUsd) }}</small>
            </span>
          </td>
        </tr>
        <tr v-if="filas.length === 0">
          <td colspan="3" class="muted">No hay tipos de precio activos.</td>
        </tr>
      </tbody>
    </table>
    <div class="tasas-info">{{ detalleTasas }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { calcularPrecios, parseMargen } from '../composables/usePrecios'

// Una fila por tipo activo: solo se edita el margen del precio vigente.
const props = defineProps({
  filas: { type: Array, required: true },
  costoUsd: { type: Number, default: null },
  tasaBcv: { type: Number, default: null }
})
const emit = defineEmits(['cambiar-margen'])

const fmt = (n, dec = 2) =>
  n == null ? '—' : Number(n).toLocaleString('es-VE', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const preciosDe = (fila) => calcularPrecios(props.costoUsd, fila.margen, fila.margen, props.tasaBcv, props.tasaBcv)

function onInputMargen(fila) {
  fila.margen = parseMargen(fila.margenTexto)
  fila.origen = 'propio'
  emit('cambiar-margen', fila)
}

const etiquetaOrigen = (fila) => fila.origen === 'propio' ? 'propio del producto' : 'por defecto del tipo'

const encabezadoTasas = computed(() => {
  const partes = ['% Utilidad']
  if (props.tasaBcv > 0) partes.push(`Tasa BCV ${fmt(props.tasaBcv)} bs`)
  return partes.join(' — ')
})

const detalleTasas = computed(() => {
  return props.tasaBcv > 0 ? `Tasa BCV: ${fmt(props.tasaBcv)} Bs/$` : 'Sin tasa BCV: el precio en Bs no se puede calcular.'
})
</script>
