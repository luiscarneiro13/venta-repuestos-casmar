<template>
  <LoginOverlay v-if="!session.autenticado" />

  <div v-else id="app">
    <TopBar />
    <div class="layout">
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>

  <BaseModal v-if="modalCajaPendiente.abierto" title="Caja del día anterior sin cerrar" :cerrable="false">
    <p class="tasa-hint">
      Hay una caja abierta de un día anterior que todavía no se ha cerrado. Se va a cerrar
      automáticamente con la tasa con la que se abrió, para que puedas iniciar el turno de hoy.
    </p>
    <div v-if="modalCajaPendiente.caja" class="ticket">
      <div class="line"><span>Abierta el</span><span>{{ formatearFecha(modalCajaPendiente.caja.abierta_en) }}</span></div>
      <div class="line"><span>Abierta por</span><span>{{ modalCajaPendiente.caja.usuario_apertura_nombre }}</span></div>
      <div class="line"><span>Tasa de apertura BCV</span><span>{{ Number(modalCajaPendiente.caja.tasa_apertura).toFixed(2) }} Bs</span></div>
      <div v-if="modalCajaPendiente.caja.tasa_apertura_usdt" class="line">
        <span>Tasa de apertura USDT</span><span>{{ Number(modalCajaPendiente.caja.tasa_apertura_usdt).toFixed(2) }} Bs</span>
      </div>
    </div>
    <p v-if="modalCajaPendiente.error" class="tasa-hint" style="color: var(--danger)">{{ modalCajaPendiente.error }}</p>
    <template #footer>
      <button class="btn btn-primary" type="button" :disabled="modalCajaPendiente.cerrando" @click="cerrarCajaPendiente">
        {{ modalCajaPendiente.cerrando ? 'Cerrando…' : 'Siguiente' }}
      </button>
    </template>
  </BaseModal>

  <BaseModal v-if="modalTasa.abierto" title="Tasas del día" :cerrable="false">
    <p class="tasa-hint">
      Ingresa las dos tasas de hoy. Se usan para calcular los precios en bolívares
      (pago en Bs) y el equivalente en USDT (pago en divisas) de todas las ventas del día.
    </p>
    <div class="login-field">
      <label class="field-label" for="tasa-bcv">Tasa BCV (Bs/USD) *</label>
      <div class="tasa-row">
        <span class="prefix">1 USD =</span>
        <input
          id="tasa-bcv"
          ref="tasaBcvInput"
          :value="tasaBcvDisplay"
          type="text"
          inputmode="numeric"
          @input="onTasaInput('bcv', $event)"
          @keydown="bloquearNoDigitos"
          @keyup.enter="guardarTasa"
        />
        <span class="prefix">Bs</span>
      </div>
    </div>
    <div class="login-field">
      <label class="field-label" for="tasa-usdt">Tasa USDT Binance (Bs/USDT) *</label>
      <div class="tasa-row">
        <span class="prefix">1 USDT =</span>
        <input
          id="tasa-usdt"
          :value="tasaUsdtDisplay"
          type="text"
          inputmode="numeric"
          @input="onTasaInput('usdt', $event)"
          @keydown="bloquearNoDigitos"
          @keyup.enter="guardarTasa"
        />
        <span class="prefix">Bs</span>
      </div>
    </div>
    <p v-if="modalTasa.error" class="tasa-hint" style="color: var(--danger)">{{ modalTasa.error }}</p>

    <template #footer>
      <button class="btn btn-primary" type="button" :disabled="modalTasa.guardando" @click="guardarTasa">
        {{ modalTasa.guardando ? 'Guardando…' : 'Confirmar y continuar' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue'
import BaseModal from './components/BaseModal.vue'
import LoginOverlay from './components/LoginOverlay.vue'
import TopBar from './components/TopBar.vue'
import { session, confirmarTasa, setCajaDelDia, marcarCajaCerrada } from './store/session'
import { aplicarMascaraTasa, bloquearNoDigitos, mascaraTasaDesdeNumero } from './composables/useMascaras'

const tasaBcvDisplay = ref('187,32')
const tasaUsdtDisplay = ref('187,32')
const tasaBcvInput = ref(null)

const modalCajaPendiente = reactive({
  abierto: false,
  cerrando: false,
  error: '',
  caja: null
})

const modalTasa = reactive({
  abierto: false,
  guardando: false,
  error: ''
})

// Cada vez que un usuario inicia sesión se sigue este orden:
//   1. Si hay cajas de días anteriores sin cerrar, se avisa y se cierran.
//   2. Se verifica la tasa del día. Si ya existe, se usa; si no, se pide.
//   3. Se abre la caja del día actual.
watch(
  () => session.autenticado,
  async (autenticado) => {
    if (!autenticado) return

    try {
      const abiertas = await window.api.caja.listarAbiertas()
      const hoy = new Date()
      const hoyTexto = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
      const pendientes = (abiertas || []).filter((c) => (c.abierta_en || '').slice(0, 10) !== hoyTexto)

      if (pendientes.length > 0) {
        // Hay caja(s) pendiente(s): se muestra el modal para que el usuario
        // confirme el cierre antes de continuar con la tasa y la caja de hoy.
        modalCajaPendiente.caja = pendientes[0]
        modalCajaPendiente.error = ''
        modalCajaPendiente.abierto = true
        return
      }
    } catch (e) {
      console.error('No se pudieron listar las cajas abiertas:', e)
    }

    // No hay cajas pendientes: continuar con el flujo de tasa + caja de hoy.
    await continuarConTasaYApertura()
  }
)

async function cerrarCajaPendiente() {
  const caja = modalCajaPendiente.caja
  if (!caja) return
  modalCajaPendiente.cerrando = true
  modalCajaPendiente.error = ''
  try {
    // Se cierra con la misma tasa con la que se abrió, para no inventar un
    // valor de cierre que el usuario no ingresó.
    await window.api.caja.cerrar({
      cajaId: caja.id,
      usuarioCierreId: session.usuario.id,
      tasaCierre: caja.tasa_apertura,
      tasaCierreUsdt: caja.tasa_apertura_usdt ?? caja.tasa_apertura
    })
    marcarCajaCerrada(caja.id)
    modalCajaPendiente.abierto = false
    modalCajaPendiente.caja = null
    await continuarConTasaYApertura()
  } catch (e) {
    modalCajaPendiente.error = e.message || 'No se pudo cerrar la caja'
  } finally {
    modalCajaPendiente.cerrando = false
  }
}

// Verifica las tasas del día: se precarga el modal con el último registro
// del histórico (sin importar de qué día sea) para que el usuario solo
// tenga que confirmarlas o actualizarlas. El modal SIEMPRE se muestra al
// iniciar sesión: no se puede entrar al sistema sin confirmar las tasas.
async function continuarConTasaYApertura() {
  let ultimaTasa = null
  try {
    ultimaTasa = await window.api.tasas.obtenerUltima()
  } catch (e) {
    console.error('No se pudo verificar la última tasa registrada:', e)
  }

  // `valor` es la columna legada (= BCV) de tasas anteriores a la migración.
  const { texto: textoBcv } = mascaraTasaDesdeNumero(
    ultimaTasa ? (ultimaTasa.valor_bcv ?? ultimaTasa.valor) : session.tasa
  )
  const { texto: textoUsdt } = mascaraTasaDesdeNumero(
    ultimaTasa ? (ultimaTasa.valor_usdt ?? ultimaTasa.valor) : session.tasaUsdt
  )
  tasaBcvDisplay.value = textoBcv
  tasaUsdtDisplay.value = textoUsdt
  modalTasa.error = ''
  modalTasa.abierto = true
  nextTick(() => tasaBcvInput.value?.focus())
}

function onTasaInput(campo, e) {
  const { texto } = aplicarMascaraTasa(e.target.value)
  if (campo === 'bcv') tasaBcvDisplay.value = texto
  else tasaUsdtDisplay.value = texto
  e.target.value = texto
}

function valorMascara(display) {
  return mascaraTasaDesdeNumero(Number(display.replace(/\./g, '').replace(',', '.'))).valor
}

async function guardarTasa() {
  const valorBcv = valorMascara(tasaBcvDisplay.value)
  const valorUsdt = valorMascara(tasaUsdtDisplay.value)
  tasaBcvDisplay.value = mascaraTasaDesdeNumero(valorBcv).texto
  tasaUsdtDisplay.value = mascaraTasaDesdeNumero(valorUsdt).texto

  if (!valorBcv || valorBcv <= 0) {
    modalTasa.error = 'Ingresa una tasa BCV válida (mayor a 0)'
    return
  }
  if (!valorUsdt || valorUsdt <= 0) {
    modalTasa.error = 'Ingresa una tasa USDT válida (mayor a 0)'
    return
  }

  modalTasa.guardando = true
  modalTasa.error = ''
  try {
    await window.api.tasas.registrar({ valorBcv, valorUsdt, usuarioId: session.usuario.id })
    confirmarTasa(valorBcv, valorUsdt)
    modalTasa.abierto = false
    await abrirCaja(valorBcv, valorUsdt)
  } catch (e) {
    modalTasa.error = e.message || 'No se pudieron registrar las tasas'
  } finally {
    modalTasa.guardando = false
  }
}

async function abrirCaja(tasaBcv, tasaUsdt) {
  try {
    // Se envían ambos juegos de nombres: los del contrato (tasaBcv/tasaUsdt)
    // y los que lee caja.service (tasaApertura/tasaAperturaUsdt).
    const { cajaHoy, cajasPendientes } = await window.api.caja.abrirDelDia({
      usuarioId: session.usuario.id,
      tasaBcv,
      tasaUsdt,
      tasaApertura: tasaBcv,
      tasaAperturaUsdt: tasaUsdt
    })
    setCajaDelDia(cajaHoy, cajasPendientes)
  } catch (e) {
    console.error('No se pudo abrir la caja del día:', e)
  }
}

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
</script>
