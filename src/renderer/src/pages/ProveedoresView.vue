<template>
  <section>
    <div class="view-header">
      <div>
        <BackLink />
        <h1>Proveedores</h1>
        <p>Administra los proveedores de las entradas de mercancía.</p>
      </div>
      <button class="btn btn-primary" type="button" @click="abrirModal()">+ Nuevo proveedor</button>
    </div>
    <p v-if="error" class="warning-box" role="alert">{{ error }}</p>
    <p v-if="cargando" class="muted">Cargando…</p>
    <div v-else class="card">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Documento</th>
            <th>Teléfono</th>
            <th>Dirección</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="proveedor in proveedores" :key="proveedor.id" :class="{ inactivo: !proveedor.activo }">
            <td>{{ proveedor.nombre }} <span v-if="!proveedor.activo" class="tag tag-anulada">Inactivo</span></td>
            <td>{{ proveedor.documento || '—' }}</td>
            <td>{{ proveedor.telefono || '—' }}</td>
            <td>{{ proveedor.direccion || '—' }}</td>
            <td>
              <button class="icon-btn" type="button" :aria-label="`Editar ${proveedor.nombre}`" @click="abrirModal(proveedor)">✎</button>
              <button
                v-if="proveedor.activo"
                class="btn btn-ghost"
                type="button"
                @click="pedirDesactivar(proveedor)"
              >Desactivar</button>
              <button v-else class="btn btn-ghost" type="button" @click="reactivar(proveedor)">Reactivar</button>
            </td>
          </tr>
          <tr v-if="proveedores.length === 0"><td colspan="5" class="muted">Aún no hay proveedores registrados.</td></tr>
        </tbody>
      </table>
    </div>

    <ProveedorModal v-if="modal.abierto" :proveedor="modal.proveedor" @close="modal.abierto = false" @saved="alGuardar" />
    <ConfirmModal
      v-if="aDesactivar"
      title="Desactivar proveedor"
      :message="`¿Desactivar «${aDesactivar.nombre}»? Sus entradas anteriores conservarán el proveedor.`"
      confirm-text="Desactivar"
      @confirm="desactivar"
      @cancel="aDesactivar = null"
    />
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { alCambiar } from '../composables/useEventos'
import BackLink from '../components/BackLink.vue'
import ProveedorModal from '../components/ProveedorModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import { mensajeError } from '../composables/useErrores'

const proveedores = ref([])
const cargando = ref(true)
const error = ref('')
const aDesactivar = ref(null)
const modal = reactive({ abierto: false, proveedor: null })

async function cargar() {
  try {
    proveedores.value = await window.api.proveedores.listar({ incluirInactivos: true })
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargando.value = false
  }
}

function abrirModal(proveedor = null) {
  modal.proveedor = proveedor
  modal.abierto = true
}

async function alGuardar() {
  modal.abierto = false
  await cargar()
}

function pedirDesactivar(proveedor) {
  aDesactivar.value = proveedor
}

async function desactivar() {
  const id = aDesactivar.value.id
  aDesactivar.value = null
  try {
    await window.api.proveedores.desactivar(id)
    await cargar()
  } catch (e) {
    error.value = mensajeError(e)
  }
}

async function reactivar(proveedor) {
  try {
    await window.api.proveedores.reactivar(proveedor.id)
    await cargar()
  } catch (e) {
    error.value = mensajeError(e)
  }
}

onMounted(cargar)
alCambiar(['proveedores', 'catalogo'], () => cargar().catch(() => {}))

</script>

<style scoped>
.inactivo { color: var(--text-muted); }
</style>
