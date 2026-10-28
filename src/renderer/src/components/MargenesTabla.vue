<template>
  <div class="margenes-card">
    <div class="margenes-head">{{ encabezadoTasas }}</div>
    <table class="margenes-tabla">
      <thead>
        <tr>
          <th rowspan="2">Tipo</th>
          <th class="grupo-bcv" colspan="2">Si paga en Bs (tasa BCV)</th>
          <th class="grupo-usdt" colspan="2">Si paga en USDT / divisas (tasa Binance)</th>
        </tr>
        <tr>
          <th class="grupo-bcv">% Utilidad</th>
          <th class="grupo-bcv">Precio</th>
          <th class="grupo-usdt">% Utilidad</th>
          <th class="grupo-usdt">Precio</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="fila in filas" :key="fila.tipoPrecioId">
          <td>
            <span class="tipo-nombre">{{ fila.nombre }}</span>
            <span class="tipo-tag">{{ fila.origen === 'propio' ? 'propio del producto' : 'por defecto del tipo' }}</span>
          </td>
          <td class="bcv">
            <span class="pct-wrap">
              <input
                v-model="fila.margenTexto"
                class="input-pct num"
                type="text"
                inputmode="decimal"
                :aria-label="`% utilidad (grupo Bs) de ${fila.nombre}`"
                @input="onInputMargen(fila)"
              />
            </span>
          </td>
          <td class="bcv">
            <span class="precio-calc">
              {{ preciosDe(fila).precioBs == null ? '—' : `Bs ${fmt(preciosDe(fila).precioBs)}` }}
              <small>≈ $ {{ fmt(preciosDe(fila).precioUsd) }}</small>
            </span>
          </td>
          <td class="usdt sep-usdt">
            <span class="pct-wrap">
              <input
                v-model="fila.margenTexto"
                class="input-pct num"
                type="text"
                inputmode="decimal"
                :aria-label="`% utilidad (grupo USDT) de ${fila.nombre}`"
                @input="onInputMargen(fila)"
              />
            </span>
          </td>
          <td class="usdt">
            <span class="precio-calc">
              {{ preciosDe(fila).precioUsdt == null ? '—' : `${fmt(preciosDe(fila).precioUsdt)} USDT` }}
              <small>≈ Bs {{ preciosDe(fila).precioBs == null ? '—' : fmt(preciosDe(fila).precioBs) }}</small>
            </span>
          </td>
        </tr>
        <tr v-if="filas.length === 0">
          <td colspan="5" class="muted">No hay tipos de precio activos.</td>
        </tr>
      </tbody>
    </table>
    <div class="tasas-info">{{ detalleTasas }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { calcularPrecios, parseMargen, r2 } from '../composables/usePrecios'

// Una fila por tipo de precio activo:
//   { tipoPrecioId, nombre, margen, margenTexto, origen: 'propio'|'default' }
// El % es uno solo por tipo: los dos inputs editan el mismo margenTexto y
// quedan sincronizados por el v-model compartido.
const props = defineProps({
  filas: { type: Array, required: true },
  costoUsd: { type: Number, default: null },
  tasaBcv: { type: Number, default: null },
  tasaUsdt: { type: Number, default: null }
})
const emit = defineEmits(['cambiar-margen'])

const fmt = (n, dec = 2) =>
  n == null ? '—' : Number(n).toLocaleString('es-VE', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const preciosDe = (fila) => calcularPrecios(props.costoUsd, fila.margen, props.tasaBcv, props.tasaUsdt)

function onInputMargen(fila) {
  fila.margen = parseMargen(fila.margenTexto)
  fila.origen = 'propio'
  emit('cambiar-margen', fila)
}

const encabezadoTasas = computed(() => {
  const partes = ['% Utilidad']
  if (props.tasaBcv > 0) partes.push(`Tasa BCV ${fmt(props.tasaBcv)} bs`)
  if (props.tasaUsdt > 0) partes.push(`Tasa Binance ${fmt(props.tasaUsdt)} bs`)
  return partes.join(' — ')
})

const detalleTasas = computed(() => {
  if (!(props.tasaBcv > 0) || !(props.tasaUsdt > 0)) {
    return 'Sin tasas del día registradas: los precios en Bs y USDT no se pueden calcular.'
  }
  const dif = r2((props.tasaUsdt / props.tasaBcv - 1) * 100)
  const posicion = dif >= 0 ? 'por encima de' : 'por debajo de'
  return (
    `Tasas del día — BCV: ${fmt(props.tasaBcv)} Bs/$ · USDT Binance: ${fmt(props.tasaUsdt)} Bs/USDT · ` +
    `USDT está ${fmt(Math.abs(dif), 1)}% ${posicion} BCV`
  )
})
</script>
