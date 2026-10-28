<template>
  <section>
    <div class="view-header">
      <div>
        <RouterLink to="/menu" class="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Menú principal
        </RouterLink>
        <h1>Indicadores</h1>
        <p>Reportes de ventas.</p>
      </div>
    </div>

    <div class="config-grid">
      <RouterLink v-for="item in RUTAS_INDICADORES" :key="item.to" :to="item.to" class="card config-card">
        <div class="config-card-icon" v-html="item.icon"></div>
        <div class="config-card-name">{{ item.label }}</div>
      </RouterLink>
      <button class="card config-card" @click="abrirModalReporte">
        <div class="config-card-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M6 9V2h12v7" />
            <rect x="6" y="14" width="12" height="8" rx="1" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
            <path d="M10 18h4" />
          </svg>
        </div>
        <div class="config-card-name">Imprimir Reporte Diario</div>
      </button>
    </div>

    <BaseModal v-if="modalReporte.abierto" title="Imprimir reporte diario" @close="cerrarModalReporte">
      <div class="login-field">
        <label class="field-label">Fecha del reporte</label>
        <input v-model="modalReporte.fecha" class="input" type="date" />
      </div>
      <p v-if="modalReporte.error" style="color: var(--danger); font-size: 10.5px; margin-top: -8px">
        {{ modalReporte.error }}
      </p>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="cerrarModalReporte" :disabled="modalReporte.imprimiendo">
          Cancelar
        </button>
        <button class="btn btn-primary" type="button" :disabled="modalReporte.imprimiendo" @click="imprimirReporte">
          {{ modalReporte.imprimiendo ? 'Imprimiendo…' : 'Imprimir' }}
        </button>
      </template>
    </BaseModal>
  </section>
</template>

<script setup>
import { reactive } from 'vue'
import { RUTAS_INDICADORES } from '../composables/useConfiguracion'
import BaseModal from '../components/BaseModal.vue'
import { session } from '../store/session'

const modalReporte = reactive({
  abierto: false,
  fecha: new Date().toISOString().slice(0, 10),
  error: '',
  imprimiendo: false
})

function abrirModalReporte() {
  modalReporte.fecha = new Date().toISOString().slice(0, 10)
  modalReporte.error = ''
  modalReporte.abierto = true
}

function cerrarModalReporte() {
  if (modalReporte.imprimiendo) return
  modalReporte.abierto = false
}

async function imprimirReporte() {
  if (!modalReporte.fecha) {
    modalReporte.error = 'Selecciona una fecha.'
    return
  }

  modalReporte.error = ''
  modalReporte.imprimiendo = true

  try {
    const resultado = await window.api.impresora.imprimirReporteDiario(
      modalReporte.fecha,
      session.usuario?.nombre || '-'
    )
    if (!resultado.ok) {
      modalReporte.error = resultado.error || 'No se pudo imprimir el reporte'
      return
    }
    modalReporte.abierto = false
  } catch (e) {
    modalReporte.error = e.message || 'No se pudo imprimir el reporte'
  } finally {
    modalReporte.imprimiendo = false
  }
}
</script>
