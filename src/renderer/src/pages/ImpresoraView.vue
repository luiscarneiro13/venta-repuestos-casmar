<template>
  <section>
    <div class="view-header">
      <div>
        <BackLink />
        <h1>Impresora</h1>
        <p>Impresora donde salen las facturas, notas de entrega y reportes, en hoja carta.</p>
      </div>
      <button class="btn btn-outline" :disabled="cargando" @click="cargar">Buscar impresoras</button>
    </div>

    <p v-if="error" class="warning-box">{{ error }}</p>

    <div class="card" style="padding: 24px; max-width: 620px">
      <div class="login-field">
        <label class="field-label">Impresora instalada</label>
        <SearchSelect v-model="form.nombre" :options="opcionesImpresoras" placeholder="— Sin impresora configurada —" />
        <p class="tasa-hint">
          Los documentos se envían directo a esta impresora en hoja carta, sin abrir el diálogo de impresión.
          Cada PC usa la impresora que tenga configurada aquí.
        </p>
      </div>

      <p v-if="mensaje" class="tasa-hint" :style="{ color: mensajeEsError ? 'var(--danger)' : 'var(--success)' }">
        {{ mensaje }}
      </p>

      <div style="display: flex; gap: 10px; margin-top: 16px">
        <button class="btn btn-primary" :disabled="guardando" @click="guardar">
          {{ guardando ? 'Guardando…' : 'Guardar' }}
        </button>
        <button class="btn btn-outline" :disabled="probando || !config.nombre" @click="probar">
          {{ probando ? 'Imprimiendo…' : 'Imprimir prueba' }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import BackLink from '../components/BackLink.vue'
import SearchSelect from '../components/SearchSelect.vue'

const impresoras = ref([])
const config = reactive({ nombre: null })
const form = reactive({ nombre: '' })

const cargando = ref(false)
const guardando = ref(false)
const probando = ref(false)
const error = ref('')
const mensaje = ref('')
const mensajeEsError = ref(false)

// Si la impresora guardada ya no aparece en la lista del sistema (se
// desinstaló o cambió de nombre), se muestra igual para no perderla de vista.
const nombreGuardadoAusente = computed(
  () => !!config.nombre && !impresoras.value.some((imp) => imp.name === config.nombre)
)

const opcionesImpresoras = computed(() => {
  const opciones = [{ value: '', label: '— Sin impresora configurada —' }]
  for (const imp of impresoras.value) {
    opciones.push({
      value: imp.name,
      label: `${imp.name}${imp.isDefault ? ' (predeterminada)' : ''}${imp.portName ? ' — ' + imp.portName : ''}`
    })
  }
  if (nombreGuardadoAusente.value) {
    opciones.push({ value: config.nombre, label: `${config.nombre} (guardada, no encontrada ahora)` })
  }
  return opciones
})

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [guardada, lista] = await Promise.all([window.api.impresora.configuracion(), window.api.impresora.listar()])
    Object.assign(config, guardada)
    impresoras.value = lista
    form.nombre = guardada.nombre || ''
  } catch (e) {
    error.value = e.message || 'No se pudo leer la configuración de la impresora'
  } finally {
    cargando.value = false
  }
}

async function guardar() {
  guardando.value = true
  mensaje.value = ''
  try {
    const actualizada = await window.api.impresora.guardar({ nombre: form.nombre })
    Object.assign(config, actualizada)
    mensajeEsError.value = false
    mensaje.value = 'Configuración guardada.'
  } catch (e) {
    mensajeEsError.value = true
    mensaje.value = e.message || 'No se pudo guardar'
  } finally {
    guardando.value = false
  }
}

async function probar() {
  probando.value = true
  mensaje.value = ''
  try {
    const resultado = await window.api.impresora.probar()
    mensajeEsError.value = !resultado.ok
    mensaje.value = resultado.ok
      ? 'Página de prueba enviada a la impresora.'
      : resultado.error || 'No se pudo imprimir la prueba'
  } catch (e) {
    mensajeEsError.value = true
    mensaje.value = e.message || 'No se pudo imprimir la prueba'
  } finally {
    probando.value = false
  }
}

onMounted(cargar)
</script>
