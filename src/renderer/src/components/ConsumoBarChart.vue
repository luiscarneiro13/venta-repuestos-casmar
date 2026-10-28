<template>
  <div class="consumo-chart">
    <div class="legend">
      <span class="legend-item"><span class="dot unidades"></span> Unidades</span>
      <span class="legend-item"><span class="dot monto"></span> Monto (USD · Bs equivalente)</span>
    </div>

    <div v-if="datos.length" class="chart-scroll">
      <div class="chart-area">
        <div v-for="(d, idx) in datos" :key="idx" class="fecha-col">
          <div class="bars-pair">
            <div class="bar-group">
              <div class="bar-value">{{ d.unidades }} und.</div>
              <div class="bar-wrap">
                <div class="bar unidades" :style="{ height: altura(d.unidades, maxUnidades) + '%' }"></div>
              </div>
            </div>
            <div class="bar-group">
              <div class="bar-value" :title="`${formatUsd(d.total_usd)} ≈ ${formatMontoBs(d.total_bs)}`">
                {{ formatUsd(d.total_usd) }}
                <small v-if="d.total_bs != null" class="bar-value-bs">{{ formatMontoBs(d.total_bs) }}</small>
              </div>
              <div class="bar-wrap">
                <div class="bar monto" :style="{ height: altura(d.total_usd, maxMonto) + '%' }"></div>
              </div>
            </div>
          </div>
          <div class="fecha-label">{{ formatearFecha(d.fecha) }}</div>
        </div>
      </div>
    </div>
    <p v-else class="muted sin-datos">Sin ventas registradas para este cliente.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatUsd, formatMontoBs } from '../composables/useFormato'

const props = defineProps({
  datos: { type: Array, default: () => [] }, // [{ fecha, unidades, total_usd, total_bs }]
  periodo: { type: String, default: 'mes' } // 'dia' | 'mes' | 'anio'
})

// Unidades y USD tienen escalas distintas: cada serie se normaliza contra su
// propio máximo.
const maxUnidades = computed(() => Math.max(1, ...props.datos.map((d) => Number(d.unidades) || 0)))
const maxMonto = computed(() => Math.max(1, ...props.datos.map((d) => Number(d.total_usd) || 0)))

function altura(value, max) {
  return Math.max(2, (Number(value) / max) * 100)
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function formatearFecha(fecha) {
  if (props.periodo === 'dia') {
    const [, m, d] = fecha.split('-')
    return `${d}/${m}`
  }
  if (props.periodo === 'anio') {
    return fecha
  }
  // mes
  const [y, m] = fecha.split('-')
  return `${MESES[Number(m) - 1]} ${y}`
}
</script>

<style scoped>
.consumo-chart {
  width: 100%;
}

.legend {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 12px;
  font-size: 13px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}

.dot.unidades {
  background: var(--primary);
}

.dot.monto {
  background: var(--accent);
}

.chart-scroll {
  overflow-x: auto;
}

.chart-area {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  height: 320px;
  padding: 12px 16px 0;
  border-bottom: 1px solid var(--border);
  min-width: max-content;
}

.fecha-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
  border-left: 1px solid var(--border);
  padding-left: 24px;
}

.fecha-col:first-child {
  border-left: none;
  padding-left: 0;
}

.bars-pair {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  height: 100%;
}

.bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  width: 56px;
  height: 100%;
}

.bar-value-bs {
  display: block;
  font-size: 9.5px;
  font-weight: 500;
  color: var(--text-muted);
}

.bar-value {
  font-size: 11px;
  text-align: center;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-primary);
  white-space: nowrap;
}

.bar-wrap {
  width: 100%;
  height: 240px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 80%;
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
}

.bar.unidades {
  background: var(--primary);
}

.bar.monto {
  background: var(--accent);
}

.fecha-label {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

.sin-datos {
  text-align: center;
  padding: 24px;
}
</style>
