<template>
  <section>
    <div class="view-header">
      <div>
        <BackLink />
        <h1>{{ titulo }}</h1>
        <p>{{ subtitulo }}</p>
      </div>
      <button class="btn btn-primary" type="button" @click="abrirModal()">+ Nueva categoría</button>
    </div>
    <p v-if="error" class="warning-box" role="alert">{{ error }}</p>
    <p v-if="cargando" class="muted">Cargando…</p>
    <div v-else class="card">
      <div class="filtro">
        <div class="input-icono">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" stroke-linecap="round" />
          </svg>
          <input v-model="busqueda" class="input" placeholder="Buscar categoría…" />
        </div>
        <span class="muted" style="font-size: 11.5px">{{ filtradas.length }} de {{ categorias.length }}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Descripción</th>
            <th style="width: 220px">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in filtradas" :key="c.id" :class="{ inactivo: !c.activo }">
            <td>{{ c.nombre }} <span v-if="!c.activo" class="tag tag-anulada">Inactiva</span></td>
            <td>{{ c.descripcion || '—' }}</td>
            <td>
              <button class="icon-btn" type="button" :aria-label="`Editar ${c.nombre}`" title="Editar" @click="abrirModal(c)">✎</button>
              <button v-if="c.activo" class="btn btn-ghost" type="button" @click="cambiarActivo(c, false)">Desactivar</button>
              <button v-else class="btn btn-ghost" type="button" @click="cambiarActivo(c, true)">Reactivar</button>
              <button class="btn btn-danger-ghost" type="button" @click="aEliminar = c">Eliminar</button>
            </td>
          </tr>
          <tr v-if="filtradas.length === 0">
            <td colspan="3" class="muted">
              {{ categorias.length === 0 ? 'Aún no hay categorías registradas.' : 'Ninguna categoría coincide con la búsqueda.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal v-if="modal.abierto" :title="modal.id ? 'Editar categoría' : 'Nueva categoría'" @close="modal.abierto = false">
      <div class="login-field">
        <label class="field-label" for="cat-nombre">Nombre *</label>
        <input id="cat-nombre" v-model="modal.nombre" class="input" placeholder="Ej. Frenos" @keyup.enter="guardar" />
      </div>
      <div class="login-field">
        <label class="field-label" for="cat-desc">Descripción</label>
        <input id="cat-desc" v-model="modal.descripcion" class="input" placeholder="Ej. Pastillas, discos, bandas…" @keyup.enter="guardar" />
      </div>
      <p v-if="modal.error" style="color: var(--danger); font-size: 11px">{{ modal.error }}</p>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="modal.abierto = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="modal.guardando" @click="guardar">
          {{ modal.guardando ? 'Guardando…' : 'Guardar' }}
        </button>
      </template>
    </BaseModal>

    <ConfirmModal
      v-if="aEliminar"
      title="Eliminar categoría"
      :message="`¿Eliminar la categoría «${aEliminar.nombre}»? Esta acción no se puede deshacer.`"
      confirm-text="Eliminar"
      @confirm="eliminar"
      @cancel="aEliminar = null"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import BackLink from '../components/BackLink.vue'
import BaseModal from '../components/BaseModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import { mensajeError } from '../composables/useErrores'

// Vista genérica para los catálogos de categorías; el router le pasa los
// textos y qué API usar (window.api.categoriasProveedor / categoriasProducto).
const props = defineProps({
  titulo: { type: String, required: true },
  subtitulo: { type: String, default: '' },
  api: { type: String, required: true }
})
const servicio = () => window.api[props.api]

const categorias = ref([])
const cargando = ref(true)
const error = ref('')
const busqueda = ref('')
const aEliminar = ref(null)
const modal = reactive({ abierto: false, id: null, nombre: '', descripcion: '', error: '', guardando: false })

const normalizar = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const filtradas = computed(() => {
  const q = normalizar(busqueda.value.trim())
  if (!q) return categorias.value
  return categorias.value.filter((c) => normalizar(`${c.nombre} ${c.descripcion}`).includes(q))
})

async function cargar() {
  try {
    categorias.value = await servicio().listar({ incluirInactivas: true })
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargando.value = false
  }
}

function abrirModal(categoria = null) {
  Object.assign(modal, {
    abierto: true,
    id: categoria?.id ?? null,
    nombre: categoria?.nombre ?? '',
    descripcion: categoria?.descripcion ?? '',
    error: '',
    guardando: false
  })
}

async function guardar() {
  if (!modal.nombre.trim()) {
    modal.error = 'El nombre de la categoría es obligatorio.'
    return
  }
  modal.guardando = true
  modal.error = ''
  try {
    const datos = { nombre: modal.nombre, descripcion: modal.descripcion }
    if (modal.id) await servicio().actualizar(modal.id, datos)
    else await servicio().crear(datos)
    modal.abierto = false
    await cargar()
  } catch (e) {
    modal.error = mensajeError(e)
  } finally {
    modal.guardando = false
  }
}

async function cambiarActivo(categoria, activo) {
  error.value = ''
  try {
    if (activo) await servicio().reactivar(categoria.id)
    else await servicio().desactivar(categoria.id)
    await cargar()
  } catch (e) {
    error.value = mensajeError(e)
  }
}

async function eliminar() {
  const id = aEliminar.value.id
  aEliminar.value = null
  error.value = ''
  try {
    await servicio().eliminar(id)
    await cargar()
  } catch (e) {
    error.value = mensajeError(e)
  }
}

onMounted(cargar)
// Vue reutiliza la instancia al pasar de un catálogo al otro: se recarga.
watch(
  () => props.api,
  () => {
    busqueda.value = ''
    cargando.value = true
    cargar()
  }
)
</script>

<style scoped>
.inactivo { color: var(--text-muted); }
.filtro {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.filtro .input-icono {
  flex: 1;
  max-width: 420px;
}
</style>
