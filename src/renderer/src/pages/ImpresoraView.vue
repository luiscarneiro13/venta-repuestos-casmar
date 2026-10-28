<template>
  <section>
    <div class="view-header">
      <div>
        <BackLink />
        <h1>Impresora</h1>
        <p>Impresora térmica donde se imprimen los tickets de venta.</p>
      </div>
      <button class="btn btn-outline" :disabled="cargando" @click="cargar">Buscar impresoras</button>
    </div>

    <p v-if="!config.plataformaSoportada" class="warning-box">
      La impresión de tickets funciona solo en Windows. Podés dejar la impresora configurada acá, pero la prueba y la
      impresión al finalizar la venta solo van a andar en la máquina Windows del punto de venta.
    </p>

    <p v-if="error" class="warning-box">{{ error }}</p>

    <div class="card" style="padding: 24px; max-width: 620px">
      <div class="login-field">
        <label class="field-label">Impresora instalada en Windows</label>
        <SearchSelect v-model="form.nombre" :options="opcionesImpresoras" placeholder="— Sin impresora configurada —" />
        <p class="tasa-hint">
          Se envía a la cola de impresión de Windows por el nombre de la impresora. El puerto (por ejemplo USB001) lo
          resuelve Windows, no hay que configurarlo acá.
        </p>
      </div>

      <div class="login-field">
        <label class="field-label">Ancho de papel</label>
        <SearchSelect
          v-model="form.ancho"
          :options="[
            { value: '80mm', label: '80 mm (48 caracteres)' },
            { value: '58mm', label: '58 mm (32 caracteres)' }
          ]"
        />
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
const config = reactive({ nombre: null, ancho: '80mm', plataformaSoportada: true })
const form = reactive({ nombre: '', ancho: '80mm' })

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
    form.ancho = guardada.ancho || '80mm'
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
    const actualizada = await window.api.impresora.guardar({ nombre: form.nombre, ancho: form.ancho })
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
      ? 'Ticket de prueba enviado a la impresora.'
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
