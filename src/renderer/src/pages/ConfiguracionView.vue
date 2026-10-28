<template>
  <section>
    <div class="view-header">
      <div>
        <h1>Operaciones</h1>
        <p>Accede a las demás secciones del sistema.</p>
      </div>
    </div>

    <div class="config-grid">
      <RouterLink v-for="item in operaciones" :key="item.to" :to="item.to" class="card config-card">
        <div class="config-card-icon" v-html="item.icon"></div>
        <div class="config-card-name">{{ item.label }}</div>
      </RouterLink>
    </div>

    <template v-if="puedeConfigurar">
    <div class="view-header" style="margin-top: 28px">
      <div>
        <h1>Configuración</h1>
        <p>Ajustes generales del sistema.</p>
      </div>
    </div>

    <div class="config-grid">
      <RouterLink v-for="item in configuracion" :key="item.to" :to="item.to" class="card config-card">
        <div class="config-card-icon" v-html="item.icon"></div>
        <div class="config-card-name">{{ item.label }}</div>
      </RouterLink>
      <button class="card config-card" @click="abrirModalReset">
        <div class="config-card-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </div>
        <div class="config-card-name">Restablecer base de datos</div>
      </button>
      <button class="card config-card" @click="abrirModalIva">
        <div class="config-card-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M19 5 5 19" />
            <circle cx="7" cy="7" r="2.5" />
            <circle cx="17" cy="17" r="2.5" />
          </svg>
        </div>
        <div class="config-card-name">Impuestos (IVA)</div>
      </button>
      <button class="card config-card" @click="abrirModalBackup">
        <div class="config-card-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
        </div>
        <div class="config-card-name">Backup de base de datos</div>
      </button>
    </div>
    </template>

    <BaseModal v-if="modalReset.abierto" title="Restablecer base de datos" @close="cerrarModalReset">
      <template v-if="!resetEnProgreso">
        <p style="font-size: 12.5px; margin-bottom: 16px">
          Se borrarán todas las ventas, precios, productos, clientes, proveedores, movimientos
          de inventario, cajas y tasas: la base de datos queda desde cero.<br /><br />
          <strong>No se tocan</strong>: categorías de productos y de proveedores, usuarios, roles,
          tipos de precio ni la configuración (IVA e impresora). Esta acción no se puede deshacer.
        </p>
        <div class="login-field">
          <label class="field-label">Contraseña del Admin de Sistema</label>
          <input
            v-model="modalReset.password"
            class="input"
            type="password"
            placeholder="••••••••"
            @keyup.enter="confirmarReset"
          />
        </div>
        <p v-if="modalReset.error" style="color: var(--danger); font-size: 10.5px; margin-top: -8px">
          {{ modalReset.error }}
        </p>
      </template>
      <template v-else>
        <p style="font-size: 12.5px; margin-bottom: 16px">Reiniciando la base de datos, espera un momento…</p>
        <div class="progress-bar">
          <div class="progress-bar-fill"></div>
        </div>
      </template>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="cerrarModalReset" :disabled="resetEnProgreso">
          Cancelar
        </button>
        <button
          v-if="!resetEnProgreso"
          class="btn btn-primary"
          type="button"
          :disabled="modalReset.procesando"
          @click="confirmarReset"
        >
          {{ modalReset.procesando ? 'Verificando…' : 'Confirmar' }}
        </button>
      </template>
    </BaseModal>

    <BaseModal v-if="modalIva.abierto" title="Impuestos" @close="modalIva.abierto = false">
      <template #icon>
        <span class="modal-icono">
          <svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path d="M19 5 5 19" />
            <circle cx="7" cy="7" r="2.5" />
            <circle cx="17" cy="17" r="2.5" />
          </svg>
        </span>
      </template>
      <template #subtitle>
        <p class="modal-subtitulo">Porcentaje de IVA que se suma al total de cada venta.</p>
      </template>
      <div class="login-field">
        <label class="field-label" for="cfg-iva">Porcentaje de IVA (%)</label>
        <input
          id="cfg-iva"
          v-model="modalIva.valor"
          class="input num"
          type="text"
          inputmode="decimal"
          placeholder="16"
          @keyup.enter="guardarIva"
        />
        <p class="muted" style="font-size: 11px; margin-top: 6px">
          Se aplica como línea adicional: <strong>total a cobrar = base + IVA</strong>. Las ventas ya registradas conservan el porcentaje con el que se cobraron.
        </p>
      </div>
      <p v-if="modalIva.error" style="color: var(--danger); font-size: 10.5px; margin-top: -8px">
        {{ modalIva.error }}
      </p>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="modalIva.abierto = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="modalIva.guardando" @click="guardarIva">
          {{ modalIva.guardando ? 'Guardando…' : 'Guardar' }}
        </button>
      </template>
    </BaseModal>

    <BaseModal v-if="modalBackup.abierto" title="Backup de base de datos" @close="cerrarModalBackup">
      <template v-if="!backupEnProgreso && !backupResultado">
        <p style="font-size: 12.5px; margin-bottom: 12px">
          Exporta una copia de seguridad de la base de datos completa. Puedes guardarla
          en cualquier ubicación (USB, carpeta compartida, etc.).
        </p>
        <div class="backup-info">
          <p style="font-size: 11.5px; font-weight: 600; margin-bottom: 6px">¿Cómo restaurar la copia?</p>
          <p style="font-size: 11px; margin-bottom: 4px">
            1. Cierra el programa por completo.
          </p>
          <p style="font-size: 11px; margin-bottom: 4px">
            2. Copia el archivo <code>.db</code> a la carpeta de datos del programa:
          </p>
          <p style="font-size: 11px; margin-bottom: 4px">
            <code>{{ rutaDatos }}</code>
          </p>
          <p style="font-size: 11px">
            3. Renombra el archivo a <code>venta-repuestos.db</code> reemplazando el existente.
          </p>
        </div>
      </template>
      <template v-else-if="backupEnProgreso">
        <p style="font-size: 12.5px; margin-bottom: 16px">Exportando copia de seguridad…</p>
        <div class="progress-bar">
          <div class="progress-bar-fill"></div>
        </div>
      </template>
      <template v-else-if="backupResultado">
        <p v-if="backupResultado.ok" style="font-size: 12.5px; margin-bottom: 12px">
          Copia de seguridad guardada correctamente en:
        </p>
        <p v-if="backupResultado.ok" style="font-size: 11px; word-break: break-all; margin-bottom: 12px">
          <code>{{ backupResultado.ruta }}</code>
        </p>
        <p v-else style="color: var(--danger); font-size: 12.5px">
          {{ backupResultado.error || 'No se pudo exportar el backup' }}
        </p>
      </template>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="cerrarModalBackup">
          Cerrar
        </button>
        <button
          v-if="!backupEnProgreso && !backupResultado"
          class="btn btn-primary"
          type="button"
          @click="exportarBackup"
        >
          Exportar
        </button>
        <button
          v-if="backupResultado && !backupResultado.ok"
          class="btn btn-primary"
          type="button"
          @click="exportarBackup"
        >
          Reintentar
        </button>
      </template>
    </BaseModal>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RUTAS_OPERACIONES, RUTAS_CONFIGURACION } from '../composables/useConfiguracion'
import { puedeHacer } from '../composables/usePermisos'
import BaseModal from '../components/BaseModal.vue'

// Solo las tarjetas que el rol puede usar. La sección Configuración (IVA,
// borrar ventas, backup, impresora, usuarios, sistema) es de administradores.
const visible = (item) => !item.permiso || puedeHacer(item.permiso)
const operaciones = computed(() => RUTAS_OPERACIONES.filter(visible))
const configuracion = computed(() => RUTAS_CONFIGURACION.filter(visible))
const puedeConfigurar = computed(() => puedeHacer('configuracion.gestionar'))

// --- Impuestos (IVA) ---
const modalIva = reactive({ abierto: false, valor: '16', error: '', guardando: false })

async function abrirModalIva() {
  modalIva.abierto = true
  modalIva.error = ''
  try {
    modalIva.valor = String(await window.api.configuracion.obtenerIva())
  } catch {
    modalIva.valor = '16'
  }
}

async function guardarIva() {
  modalIva.guardando = true
  modalIva.error = ''
  try {
    await window.api.configuracion.guardarIva(Number(String(modalIva.valor).replace(',', '.')))
    modalIva.abierto = false
  } catch (e) {
    modalIva.error = e.message || 'No se pudo guardar el porcentaje'
  } finally {
    modalIva.guardando = false
  }
}

const modalReset = reactive({
  abierto: false,
  password: '',
  error: '',
  procesando: false
})
const resetEnProgreso = ref(false)

function abrirModalReset() {
  modalReset.abierto = true
  modalReset.password = ''
  modalReset.error = ''
  modalReset.procesando = false
  resetEnProgreso.value = false
}

function cerrarModalReset() {
  if (resetEnProgreso.value) return
  modalReset.abierto = false
}

async function confirmarReset() {
  if (!modalReset.password) {
    modalReset.error = 'Ingresa la contraseña del Admin de Sistema.'
    return
  }

  modalReset.procesando = true
  modalReset.error = ''

  try {
    const esAdmin = await window.api.sistema.verificarAdmin(modalReset.password)
    if (!esAdmin) {
      modalReset.error = 'La contraseña no corresponde al Admin de Sistema.'
      modalReset.procesando = false
      return
    }

    resetEnProgreso.value = true
    const resultado = await window.api.sistema.reiniciarBaseDatos()
    if (!resultado.ok) {
      resetEnProgreso.value = false
      modalReset.procesando = false
      modalReset.error = resultado.error || 'No se pudo reiniciar la base de datos'
      return
    }

    // Borrado exitoso: cerrar modal y recargar la app para que todo
    // vuelva a cargar sin las ventas.
    setTimeout(() => {
      window.location.reload()
    }, 800)
  } catch (e) {
    resetEnProgreso.value = false
    modalReset.procesando = false
    modalReset.error = e.message || 'No se pudo verificar la contraseña'
  }
}

// --- Backup de base de datos ---
const modalBackup = reactive({ abierto: false })
const backupEnProgreso = ref(false)
const backupResultado = ref(null)
const rutaDatos = ref('')

function abrirModalBackup() {
  modalBackup.abierto = true
  backupEnProgreso.value = false
  backupResultado.value = null
  cargarRutaDatos()
}

function cerrarModalBackup() {
  if (backupEnProgreso.value) return
  modalBackup.abierto = false
}

async function cargarRutaDatos() {
  try {
    const res = await window.api.sistema.rutaBaseDatos()
    if (res.ok) {
      // Mostrar solo la carpeta (sin el nombre del archivo)
      const partes = res.ruta.replace(/\\/g, '/').split('/')
      partes.pop()
      rutaDatos.value = partes.join('/') + '/'
    }
  } catch {
    rutaDatos.value = ''
  }
}

async function exportarBackup() {
  backupEnProgreso.value = true
  backupResultado.value = null
  try {
    const resultado = await window.api.sistema.exportarBackup()
    backupResultado.value = resultado
  } catch (e) {
    backupResultado.value = { ok: false, error: e.message || 'No se pudo exportar el backup' }
  } finally {
    backupEnProgreso.value = false
  }
}
</script>

<style scoped>
.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--surface-alt);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  width: 40%;
  height: 100%;
  background: var(--primary);
  border-radius: 4px;
  animation: progress-indeterminate 1.2s ease-in-out infinite;
}

@keyframes progress-indeterminate {
  0% {
    margin-left: -40%;
  }
  50% {
    margin-left: 100%;
  }
  100% {
    margin-left: -40%;
  }
}

.backup-info {
  background: var(--surface-alt);
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
}

.backup-info code {
  font-size: 11px;
  word-break: break-all;
}
</style>
