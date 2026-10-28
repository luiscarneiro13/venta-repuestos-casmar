<template>
  <header class="topbar">
    <div class="brand"><img :src="marcaUrl" class="brand-mark" alt="" /> Venta de Repuestos</div>
    <div class="topbar-right">
      <button class="btn btn-outline menu-btn" type="button" @click="irAMenu">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        Menú
      </button>
      <div class="tasa-chip">
        <span class="lbl">BCV</span>
        <span class="val num">{{ formatMontoBs(session.tasa) }}</span>
        <span class="lbl">· USDT</span>
        <span class="val num">{{ formatMontoBs(session.tasaUsdt) }}</span>
        <button type="button" title="Actualizar tasas" @click="abrirModalTasa">✎</button>
      </div>
      <div v-if="cajaPendiente" class="caja-chip pendiente">
        <span class="lbl"><strong>Caja:</strong> Sin cerrar (día anterior)</span>
        <span class="fecha">Abierta el {{ formatearFecha(cajaPendiente.abierta_en) }}</span>
      </div>
      <div v-else-if="session.caja" class="caja-chip">
        <span class="lbl"><strong>Caja:</strong> Abierta</span>
        <span class="fecha">{{ formatearFecha(session.caja.abierta_en) }}</span>
      </div>
      <button v-if="cajaPendiente || session.caja" class="btn btn-outline" type="button" @click="irACierre">
        Cerrar caja
      </button>
      <div class="user-chip">
        <div class="avatar">{{ iniciales }}</div>
        <div class="info">
          <div class="name">{{ session.usuario?.nombre }}</div>
          <div class="role">{{ rolLabel }}</div>
        </div>
      </div>
      <button class="btn btn-outline logout-btn" type="button" title="Cerrar sesión" @click="cerrarSesion">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
        Salir
      </button>
    </div>
  </header>

  <BaseModal v-if="modalAbierto" title="Actualizar tasas del día" @close="modalAbierto = false">
    <label class="field-label">Tasa BCV (Bs/USD)</label>
    <div class="tasa-row">
      <span class="prefix">1 USD =</span>
      <input
        :value="tasaBcvDisplay"
        type="text"
        inputmode="numeric"
        @input="onTasaInput('bcv', $event)"
        @keydown="bloquearNoDigitos"
        @keyup.enter="guardarTasa"
      />
      <span class="prefix">Bs</span>
    </div>
    <label class="field-label" style="margin-top: 12px">Tasa USDT Binance (Bs/USDT)</label>
    <div class="tasa-row">
      <span class="prefix">1 USDT =</span>
      <input
        :value="tasaUsdtDisplay"
        type="text"
        inputmode="numeric"
        @input="onTasaInput('usdt', $event)"
        @keydown="bloquearNoDigitos"
        @keyup.enter="guardarTasa"
      />
      <span class="prefix">Bs</span>
    </div>
    <div class="tasa-hint">
      Quedan registradas con la fecha y hora del cambio. Las ventas ya emitidas mantienen las tasas con las que se cobraron.
    </div>

    <p v-if="errorTasa" class="tasa-hint" style="color: var(--danger)">{{ errorTasa }}</p>

    <template #footer>
      <button class="btn btn-outline" type="button" @click="modalAbierto = false">Cancelar</button>
      <button class="btn btn-primary" type="button" :disabled="guardando" @click="guardarTasa">
        {{ guardando ? 'Guardando…' : 'Guardar tasa' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { nombreRol } from '../../../shared/permisos.js'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseModal from './BaseModal.vue'
import marcaUrl from '../assets/logo.png'
import { session, actualizarTasa, cerrarSesion } from '../store/session'
import { formatMontoBs } from '../composables/useFormato'
import { aplicarMascaraTasa, bloquearNoDigitos, mascaraTasaDesdeNumero } from '../composables/useMascaras'

const router = useRouter()
const modalAbierto = ref(false)
const tasaBcvDisplay = ref(mascaraTasaDesdeNumero(session.tasa).texto)
const tasaUsdtDisplay = ref(mascaraTasaDesdeNumero(session.tasaUsdt).texto)
const guardando = ref(false)
const errorTasa = ref('')

function onTasaInput(campo, e) {
  const { texto } = aplicarMascaraTasa(e.target.value)
  if (campo === 'bcv') tasaBcvDisplay.value = texto
  else tasaUsdtDisplay.value = texto
  e.target.value = texto
}

const iniciales = computed(() => {
  const nombre = session.usuario?.nombre ?? ''
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
})

const rolLabel = computed(() => nombreRol(session.usuario?.rol))

// Si hay alguna caja de un día anterior sin cerrar, se avisa con esa en vez
// de la de hoy (es la más urgente) y "Cerrar caja" apunta a ella primero.
const cajaPendiente = computed(() => session.cajasPendientes[0] ?? null)

function formatearFecha(fechaHoraLocal) {
  if (!fechaHoraLocal) return ''
  const d = new Date(fechaHoraLocal.replace(' ', 'T'))
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function abrirModalTasa() {
  tasaBcvDisplay.value = mascaraTasaDesdeNumero(session.tasa).texto
  tasaUsdtDisplay.value = mascaraTasaDesdeNumero(session.tasaUsdt).texto
  errorTasa.value = ''
  modalAbierto.value = true
}

function valorMascara(display) {
  return mascaraTasaDesdeNumero(Number(display.replace(/\./g, '').replace(',', '.'))).valor
}

// Las tasas se guardan en la base (una fila por cambio) antes de tocar el
// estado de la sesión: si falla el registro, el sistema sigue vendiendo
// con las tasas anteriores en vez de con unas que no quedaron auditadas.
async function guardarTasa() {
  errorTasa.value = ''

  const valorBcv = valorMascara(tasaBcvDisplay.value)
  const valorUsdt = valorMascara(tasaUsdtDisplay.value)
  if (!valorBcv || valorBcv <= 0) {
    errorTasa.value = 'Ingresa una tasa BCV válida (mayor a 0)'
    return
  }
  if (!valorUsdt || valorUsdt <= 0) {
    errorTasa.value = 'Ingresa una tasa USDT válida (mayor a 0)'
    return
  }

  guardando.value = true
  try {
    await window.api.tasas.registrar({ valorBcv, valorUsdt, usuarioId: session.usuario.id })
    actualizarTasa(valorBcv, valorUsdt)
    modalAbierto.value = false
  } catch (e) {
    errorTasa.value = e.message || 'No se pudieron registrar las tasas'
  } finally {
    guardando.value = false
  }
}

function irACierre() {
  router.push('/ventas')
}

function irAMenu() {
  router.push('/menu')
}
</script>
