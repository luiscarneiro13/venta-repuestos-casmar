<template>
  <section>
    <div class="view-header">
      <div>
        <BackLink />
        <h1>Clientes</h1>
        <p>Registro de negocios y personas atendidas en la tienda.</p>
      </div>
      <div style="display: flex; gap: 10px">
        <button class="btn btn-outline" :disabled="clientes.length === 0" @click="exportarExcel">Exportar a Excel</button>
        <button class="btn btn-primary" @click="abrirModal()">+ Nuevo cliente</button>
      </div>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Documento</th>
            <th>Teléfono</th>
            <th>Dirección</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in clientes" :key="c.id">
            <td>{{ c.nombre }}</td>
            <td class="num">{{ c.tipo_documento }}-{{ c.doc || '—' }}</td>
            <td class="num">{{ c.tel }}</td>
            <td>{{ c.direccion }}</td>
            <td>
              <button class="icon-btn" title="Editar cliente" @click="abrirModal(c)">✎</button>
            </td>
          </tr>
          <tr v-if="!cargando && clientes.length === 0">
            <td colspan="5" class="muted">No hay clientes registrados.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal v-if="modal.abierto" :title="modal.id ? 'Editar cliente' : 'Nuevo cliente'" @close="modal.abierto = false">
      <div class="login-field">
        <label class="field-label">Nombre o razón social</label>
        <input v-model="modal.nombre" class="input" placeholder="Ej. Abastos La Esquina" />
      </div>
      <div class="login-field">
        <label class="field-label">Documento</label>
        <div style="display: flex; gap: 8px">
          <SearchSelect v-model="modal.tipoDoc" :options="['V', 'J']" style="max-width: 90px" placeholder="V" />
          <input
            v-model="modal.doc"
            class="input"
            placeholder="Solo números"
            inputmode="numeric"
            @input="modal.doc = modal.doc.replace(/\D/g, '')"
          />
        </div>
      </div>
      <div class="login-field"><label class="field-label">Teléfono</label><input v-model="modal.tel" class="input" placeholder="Solo números" inputmode="numeric" @input="modal.tel = modal.tel.replace(/\D/g, '')" /></div>
      <div class="login-field"><label class="field-label">Dirección</label><input v-model="modal.direccion" class="input" placeholder="Ej. EL TIGRE" /></div>
      <p v-if="modal.error" style="color: var(--danger); font-size: 10.5px; margin-top: -8px">{{ modal.error }}</p>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="modal.abierto = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="modal.guardando" @click="guardar">
          {{ modal.id ? 'Guardar cambios' : 'Guardar cliente' }}
        </button>
      </template>
    </BaseModal>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import BackLink from '../components/BackLink.vue'
import BaseModal from '../components/BaseModal.vue'
import SearchSelect from '../components/SearchSelect.vue'
import { exportarCsv } from '../composables/useExportarCsv'
import { alCambiar } from '../composables/useEventos'

const clientes = ref([])
const cargando = ref(true)
const modal = reactive({
  abierto: false,
  id: null,
  nombre: '',
  tipoDoc: 'V',
  doc: '',
  tel: '',
  direccion: 'EL TIGRE',
  error: '',
  guardando: false
})

async function cargarClientes() {
  cargando.value = true
  try {
    clientes.value = await window.api.clientes.listar()
  } finally {
    cargando.value = false
  }
}

function abrirModal(cliente) {
  if (cliente) {
    modal.id = cliente.id
    modal.nombre = cliente.nombre
    modal.tipoDoc = cliente.tipo_documento || 'V'
    modal.doc = cliente.doc || ''
    modal.tel = cliente.tel || ''
    modal.direccion = cliente.direccion || 'EL TIGRE'
  } else {
    modal.id = null
    modal.nombre = ''
    modal.tipoDoc = 'V'
    modal.doc = ''
    modal.tel = ''
    modal.direccion = 'EL TIGRE'
  }
  modal.error = ''
  modal.abierto = true
}

async function guardar() {
  const nombre = modal.nombre.trim()
  if (!nombre) {
    modal.error = 'Ingresa un nombre para el cliente.'
    return
  }
  modal.guardando = true
  modal.error = ''
  try {
    const payload = {
      nombre,
      tipoDoc: modal.tipoDoc,
      doc: modal.doc.trim(),
      tel: modal.tel.trim(),
      direccion: modal.direccion.trim() || 'EL TIGRE'
    }
    if (modal.id) {
      const actualizado = await window.api.clientes.actualizar(modal.id, payload)
      const idx = clientes.value.findIndex((c) => c.id === modal.id)
      if (idx !== -1) clientes.value[idx] = actualizado
    } else {
      const nuevo = await window.api.clientes.crear(payload)
      clientes.value.push(nuevo)
    }
    clientes.value.sort((a, b) => a.nombre.localeCompare(b.nombre))
    modal.abierto = false
  } catch (e) {
    modal.error = e.message || 'No se pudo guardar el cliente'
  } finally {
    modal.guardando = false
  }
}

function exportarExcel() {
  const encabezados = ['Nombre', 'Documento', 'Teléfono', 'Dirección']
  const filas = clientes.value.map((c) => [c.nombre, (c.tipo_documento || 'V') + '-' + (c.doc || ''), c.tel || '', c.direccion || ''])
  const fecha = new Date().toISOString().slice(0, 10)
  exportarCsv(`clientes-${fecha}.csv`, encabezados, filas)
}

onMounted(cargarClientes)
alCambiar(['clientes', 'ventas'], () => cargarClientes().catch(() => {}))

</script>
