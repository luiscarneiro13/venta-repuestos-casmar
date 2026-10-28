<template>
  <BaseModal :title="proveedor ? 'Editar proveedor' : 'Nuevo proveedor'" @close="emit('close')">
    <div class="login-field">
      <label class="field-label" for="proveedor-nombre">Nombre o razón social *</label>
      <input id="proveedor-nombre" v-model="form.nombre" class="input" required placeholder="Ej. Repuestos del Este" />
    </div>
    <div class="login-field">
      <label class="field-label" for="proveedor-documento">RIF / documento</label>
      <input id="proveedor-documento" v-model="form.documento" class="input" placeholder="Ej. J-12345678-9" />
    </div>
    <div class="login-field">
      <label class="field-label" for="proveedor-telefono">Teléfono</label>
      <input id="proveedor-telefono" v-model="form.telefono" class="input" type="tel" />
    </div>
    <div class="login-field">
      <label class="field-label" for="proveedor-direccion">Dirección</label>
      <input id="proveedor-direccion" v-model="form.direccion" class="input" />
    </div>
    <p v-if="error" class="warning-box" role="alert">{{ error }}</p>
    <template #footer>
      <button class="btn btn-outline" type="button" @click="emit('close')">Cancelar</button>
      <button class="btn btn-primary" type="button" :disabled="guardando" @click="guardar">
        {{ guardando ? 'Guardando…' : 'Guardar proveedor' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { reactive, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import { mensajeError } from '../composables/useErrores'

const props = defineProps({ proveedor: { type: Object, default: null } })
const emit = defineEmits(['saved', 'close'])
const form = reactive({
  nombre: props.proveedor?.nombre || '',
  documento: props.proveedor?.documento || '',
  telefono: props.proveedor?.telefono || '',
  direccion: props.proveedor?.direccion || ''
})
const error = ref('')
const guardando = ref(false)

async function guardar() {
  error.value = ''
  if (!form.nombre.trim()) {
    error.value = 'El nombre del proveedor es obligatorio.'
    return
  }
  guardando.value = true
  try {
    const datos = { ...form }
    const resultado = props.proveedor
      ? await window.api.proveedores.actualizar(props.proveedor.id, datos)
      : await window.api.proveedores.crear(datos)
    emit('saved', resultado)
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    guardando.value = false
  }
}
</script>
