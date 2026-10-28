<template>
  <section>
    <div class="view-header">
      <div>
        <BackLink />
        <h1>Tipos de precio</h1>
        <p>Precios de venta disponibles para todos los productos. Cada tipo define su % de utilidad por defecto sobre el costo; el orden define cómo se muestran en la venta.</p>
      </div>
      <button class="btn btn-primary" @click="abrirModal()">+ Nuevo tipo de precio</button>
    </div>

    <p v-if="error" class="warning-box">{{ error }}</p>
    <p v-if="cargando" class="muted">Cargando…</p>

    <template v-else>
      <div class="toolbar">
        <span class="muted">{{ tiposVisibles.length }} {{ tiposVisibles.length === 1 ? 'tipo' : 'tipos' }}</span>
        <label class="muted ver-inactivos">
          <input v-model="mostrarInactivos" type="checkbox" />
          Mostrar desactivados
        </label>
      </div>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Orden</th>
              <th>Nombre</th>
              <th style="text-align: right">% utilidad por defecto</th>
              <th>Productos que lo usan</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tiposVisibles" :key="t.id" :class="{ 'fila-inactiva': t.activo === 0 }">
              <td style="white-space: nowrap">
                <button class="icon-btn" title="Editar" @click="abrirModal(t)">✎</button>
                <button v-if="t.activo !== 0" class="icon-btn icon-btn-danger" title="Eliminar" @click="pedirEliminar(t)">🗑</button>
                <button v-else class="icon-btn" title="Reactivar" @click="reactivar(t)">↺</button>
              </td>
              <td class="num">{{ t.orden }}</td>
              <td>{{ t.nombre }}</td>
              <td class="num" style="text-align: right">{{ t.margen_default ?? 0 }}%</td>
              <td class="num">{{ t.cantidad_precios }}</td>
              <td>
                <span class="tag" :class="t.activo === 0 ? 'tag-anulada' : 'tag-activa'">
                  {{ t.activo === 0 ? 'Inactivo' : 'Activo' }}
                </span>
              </td>
            </tr>
            <tr v-if="tiposVisibles.length === 0">
              <td colspan="6" class="muted">No hay tipos de precio{{ mostrarInactivos ? '' : ' activos' }}.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <BaseModal v-if="modal.abierto" :title="modal.id ? 'Editar tipo de precio' : 'Nuevo tipo de precio'" @close="modal.abierto = false">
      <div class="login-field">
        <label class="field-label">Nombre</label>
        <input v-model="modal.nombre" class="input" placeholder="Ej. Precio Full" @keyup.enter="guardar" />
      </div>
      <div class="login-field">
        <label class="field-label">Orden</label>
        <input
          v-model="modal.orden"
          class="input"
          inputmode="numeric"
          style="max-width: 100px"
          @input="modal.orden = String(modal.orden).replace(/\D/g, '')"
        />
      </div>
      <div class="login-field">
        <label class="field-label">% utilidad por defecto</label>
        <input
          v-model="modal.margenDefault"
          class="input num"
          inputmode="decimal"
          style="max-width: 100px"
          placeholder="100"
          @keyup.enter="guardar"
        />
        <p class="muted" style="font-size: 10.5px; margin: 6px 0 0">
          Markup sobre el costo: 100% = vender al doble. Aplica a los productos que no tengan margen propio.
        </p>
      </div>
      <p v-if="modal.error" style="color: var(--danger); font-size: 11px">{{ modal.error }}</p>
      <template #footer>
        <button class="btn btn-outline" type="button" @click="modal.abierto = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="modal.guardando" @click="guardar">Guardar</button>
      </template>
    </BaseModal>

    <ConfirmModal
      v-if="confirmEliminar.abierto"
      title="Eliminar tipo de precio"
      :message="`¿Eliminar «${confirmEliminar.tipo?.nombre}»? Si ya tiene productos o ventas asociadas se desactivará en lugar de borrarse (el historial se conserva).`"
      confirm-text="Eliminar"
      @confirm="confirmarEliminar"
      @cancel="confirmEliminar.abierto = false"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import BackLink from '../components/BackLink.vue'
import BaseModal from '../components/BaseModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import { mensajeError } from '../composables/useErrores'

const tipos = ref([])
const cargando = ref(true)
const error = ref('')
const mostrarInactivos = ref(false)

const tiposVisibles = computed(() =>
  mostrarInactivos.value ? tipos.value : tipos.value.filter((t) => t.activo !== 0)
)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    tipos.value = await window.api.tiposPrecio.listar()
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargando.value = false
  }
}

const modal = reactive({ abierto: false, id: null, nombre: '', orden: '', margenDefault: '', activo: 1, error: '', guardando: false })

function abrirModal(tipo = null) {
  Object.assign(modal, {
    abierto: true,
    id: tipo?.id ?? null,
    nombre: tipo?.nombre ?? '',
    orden: tipo ? String(tipo.orden) : '',
    margenDefault: tipo ? String(tipo.margen_default ?? 100) : '100',
    activo: tipo?.activo ?? 1,
    error: '',
    guardando: false
  })
}

async function guardar() {
  modal.error = ''
  const margen = Number(String(modal.margenDefault).replace(',', '.'))
  if (!modal.nombre.trim()) {
    modal.error = 'El nombre es obligatorio.'
    return
  }
  if (!Number.isFinite(margen) || margen < 0) {
    modal.error = 'El % de utilidad por defecto debe ser un número mayor o igual a 0.'
    return
  }
  modal.guardando = true
  const datos = { nombre: modal.nombre, orden: modal.orden, margenDefault: margen, activo: modal.activo }
  try {
    if (modal.id) await window.api.tiposPrecio.actualizar(modal.id, datos)
    else await window.api.tiposPrecio.crear(datos)
    modal.abierto = false
    await cargar()
  } catch (e) {
    modal.error = mensajeError(e)
  } finally {
    modal.guardando = false
  }
}

const confirmEliminar = reactive({ abierto: false, tipo: null })

function pedirEliminar(tipo) {
  confirmEliminar.abierto = true
  confirmEliminar.tipo = tipo
}

// El backend decide si borra o solo desactiva (según tenga uso); la UI solo
// informa el resultado recargando la lista o mostrando el mensaje de error.
async function confirmarEliminar() {
  confirmEliminar.abierto = false
  error.value = ''
  try {
    await window.api.tiposPrecio.eliminar(confirmEliminar.tipo.id)
    await cargar()
  } catch (e) {
    error.value = mensajeError(e)
  }
}

async function reactivar(tipo) {
  error.value = ''
  try {
    await window.api.tiposPrecio.actualizar(tipo.id, {
      nombre: tipo.nombre,
      orden: tipo.orden,
      margenDefault: tipo.margen_default,
      activo: 1
    })
    await cargar()
  } catch (e) {
    error.value = mensajeError(e)
  }
}

onMounted(cargar)
</script>

<style scoped>
.ver-inactivos {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.fila-inactiva td {
  color: var(--text-muted);
}
</style>
