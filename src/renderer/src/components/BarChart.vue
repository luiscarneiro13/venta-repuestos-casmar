<template>
  <div class="bar-chart">
    <div class="chart-area">
      <div class="bars">
        <div v-for="(bar, idx) in bars" :key="idx" class="bar-col">
          <div class="bar-value">{{ format(bar.value) }}</div>
          <div class="bar-wrap">
            <div class="bar" :style="{ height: altura(bar.value) + '%' }"></div>
          </div>
          <div class="bar-label">{{ bar.label }}</div>
        </div>
      </div>
    </div>
    <p v-if="!bars.length" class="muted sin-datos">Sin datos para mostrar.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  bars: { type: Array, default: () => [] }, // [{ label, value }]
  suffix: { type: String, default: '' }
})

const max = computed(() => Math.max(1, ...props.bars.map((b) => Number(b.value) || 0)))

function altura(value) {
  return Math.max(2, (Number(value) / max.value) * 100)
}

function format(value) {
  const n = Number(value) || 0
  return n.toLocaleString('es-VE') + props.suffix
}
</script>

<style scoped>
.bar-chart {
  width: 100%;
}

.chart-area {
  display: flex;
  justify-content: center;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 48px;
  height: 280px;
  padding: 12px 24px 0;
  border-bottom: 1px solid var(--border);
}

.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 120px;
  height: 100%;
  justify-content: flex-end;
}

.bar-value {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.bar-wrap {
  width: 100%;
  height: 220px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 70%;
  background: var(--primary);
  border-radius: 6px 6px 0 0;
  transition: height 0.3s ease;
}

.bar-label {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
}

.sin-datos {
  text-align: center;
  padding: 24px;
}
</style>
