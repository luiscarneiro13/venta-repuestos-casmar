<template>
  <section>
    <div class="view-header">
      <div>
        <BackLink />
        <h1>Sistema</h1>
        <p>Información general de la instalación de Venta de Repuestos.</p>
      </div>
    </div>

    <div class="card" style="padding: 24px">
      <table>
        <tbody>
          <tr>
            <td>Versión del software</td>
            <td class="num">{{ version }}</td>
          </tr>
          <tr>
            <td>Modo del equipo</td>
            <td class="num">
              {{ config.modo === 'cliente' ? `Esclavo · servidor ${config.servidor}:${config.puerto}` : 'Principal (servidor)' }}
            </td>
          </tr>
          <tr>
            <td>Entorno</td>
            <td class="num">{{ modo }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card" style="padding: 24px; margin-top: 16px">
      <h2 class="titulo-tabla" style="padding: 0 0 12px">Conexión en red local</h2>
      <p class="muted" style="margin-bottom: 16px">
        Elige si esta PC es la <strong>Principal</strong> (tiene la base de datos y atiende a las demás)
        o una <strong>Esclava</strong> (se conecta a la principal por la red de la oficina).
        Cambiar el modo reinicia la aplicación.
      </p>

      <div class="modo-selector">
        <label class="modo-opcion" :class="{ activa: form.modo === 'servidor' }">
          <input v-model="form.modo" type="radio" value="servidor" />
          <span>
            <strong>Principal (servidor)</strong>
            <small>Guarda la base de datos y atiende a las PCs esclavas en el puerto {{ form.puerto }}.</small>
          </span>
        </label>
        <label class="modo-opcion" :class="{ activa: form.modo === 'cliente' }">
          <input v-model="form.modo" type="radio" value="cliente" />
          <span>
            <strong>Esclavo</strong>
            <small>Todo pasa por la red a la PC principal; imprime en la impresora de esta PC.</small>
          </span>
        </label>
      </div>

      <div v-if="form.modo === 'cliente'" class="login-field" style="margin-top: 14px; max-width: 340px">
        <label class="field-label">IP del servidor (PC principal)</label>
        <input v-model="form.servidor" class="input" placeholder="Ej. 192.168.1.10" />
      </div>
      <div class="login-field" style="margin-top: 14px; max-width: 160px">
        <label class="field-label">Puerto</label>
        <input v-model="form.puerto" class="input" inputmode="numeric" placeholder="8530" />
      </div>

      <div style="display: flex; gap: 10px; margin-top: 18px; align-items: center">
        <button class="btn btn-primary" :disabled="guardando" @click="guardar">
          {{ guardando ? 'Guardando…' : 'Guardar y reiniciar' }}
        </button>
        <button v-if="form.modo === 'cliente'" class="btn btn-outline" :disabled="probando" @click="probar">
          {{ probando ? 'Probando…' : 'Probar conexión' }}
        </button>
        <span
          v-if="resultadoPrueba"
          :style="{ color: resultadoPrueba.ok ? 'var(--success)' : 'var(--danger)', fontSize: '12px' }"
        >
          {{ resultadoPrueba.mensaje }}
        </span>
      </div>
      <p v-if="error" class="warning-box" style="margin-top: 14px">{{ error }}</p>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import BackLink from '../components/BackLink.vue'
import { mensajeError } from '../composables/useErrores'

const version = ref('...')
const modo = import.meta.env.MODE ?? 'production'
const config = reactive({ modo: 'servidor', servidor: null, puerto: 8530 })
const form = reactive({ modo: 'servidor', servidor: '', puerto: 8530 })
const guardando = ref(false)
const probando = ref(false)
const resultadoPrueba = ref(null)
const error = ref('')

onMounted(async () => {
  version.value = await window.api.sistema.version()
  const cfg = await window.api.appConfig.obtener()
  Object.assign(config, cfg)
  form.modo = cfg.modo
  form.servidor = cfg.servidor ?? ''
  form.puerto = cfg.puerto
})

async function probar() {
  probando.value = true
  resultadoPrueba.value = null
  try {
    const datos = await window.api.appConfig.probar({ servidor: form.servidor, puerto: Number(form.puerto) })
    resultadoPrueba.value = { ok: true, mensaje: `Conectado al servidor (v${datos.version}).` }
  } catch (e) {
    resultadoPrueba.value = { ok: false, mensaje: mensajeError(e) }
  } finally {
    probando.value = false
  }
}

async function guardar() {
  error.value = ''
  guardando.value = true
  try {
    await window.api.appConfig.guardar({
      modo: form.modo,
      servidor: form.modo === 'cliente' ? form.servidor.trim() : null,
      puerto: Number(form.puerto)
    })
    await window.api.appConfig.reiniciar()
  } catch (e) {
    error.value = mensajeError(e)
    guardando.value = false
  }
}
</script>

<style scoped>
.modo-selector {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.modo-opcion {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  background: var(--surface);
}
.modo-opcion.activa {
  border-color: var(--accent);
  background: var(--accent-light);
}
.modo-opcion input {
  margin-top: 3px;
}
.modo-opcion span {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.modo-opcion small {
  color: var(--text-secondary);
  font-size: 11.5px;
}
@media (max-width: 700px) {
  .modo-selector { grid-template-columns: 1fr; }
}
</style>
