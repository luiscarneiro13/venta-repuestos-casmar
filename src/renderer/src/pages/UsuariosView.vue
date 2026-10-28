<template>
  <section>
    <div class="view-header">
      <div>
        <BackLink />
        <h1>Usuarios</h1>
        <p>Usuarios con acceso al sistema y su nivel de acceso.</p>
      </div>
      <button class="btn btn-primary" @click="abrirCrear">+ Nuevo usuario</button>
    </div>

    <p v-if="error" class="warning-box">{{ error }}</p>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Usuario</th>
            <th>Rol</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in usuarios" :key="u.id">
            <td>{{ u.nombre }}</td>
            <td class="num">{{ u.usuario }}</td>
            <td>
              <span class="tag" :class="u.rol === 'sistema' ? 'tag-vencido' : u.rol === 'administrador' ? 'tag-parcial' : 'tag-activa'">
                {{ nombreRol(u.rol) }}
              </span>
            </td>
            <td>
              <template v-if="u.rol === 'sistema'">
                <span class="muted" style="font-size: 11px" title="El Admin de Sistema no lo puede editar ni eliminar nadie">
                  Protegido
                </span>
              </template>
              <template v-else>
                <button class="icon-btn" title="Editar usuario" @click="abrirEditar(u)">✎</button>
                <button
                  v-if="u.id !== session.usuario?.id"
                  class="icon-btn icon-btn-danger"
                  title="Eliminar usuario"
                  @click="pedirEliminar(u)"
                >🗑</button>
              </template>
            </td>
          </tr>
          <tr v-if="!cargando && usuarios.length === 0">
            <td colspan="4" class="muted">No hay usuarios registrados.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal v-if="modal.abierto" :title="modal.id ? 'Editar usuario' : 'Nuevo usuario'" @close="cerrarModal">
      <label class="field-label">Nombre completo</label>
      <input v-model="form.nombre" class="input" placeholder="Ej. María Gómez" />

      <label class="field-label" style="margin-top: 12px">Usuario</label>
      <input
        :value="form.usuario"
        class="input"
        placeholder="Ej. maria"
        autocomplete="off"
        @input="onUsuarioInput"
      />
      <p class="tasa-hint">Solo letras y números, en minúsculas y sin espacios.</p>

      <label class="field-label" style="margin-top: 12px">Nivel de acceso</label>
      <SearchSelect v-model="form.rol" :options="opcionesRol" />
      <p class="tasa-hint">{{ descripcionRol }}</p>

      <label class="field-label" style="margin-top: 12px">
        {{ modal.id ? 'Nueva contraseña (déjalo en blanco para no cambiarla)' : 'Contraseña' }}
      </label>
      <input v-model="form.password" class="input" type="password" placeholder="••••••••" autocomplete="new-password" />

      <p v-if="modal.error" style="color: var(--danger); font-size: 10.5px; margin-top: 10px">{{ modal.error }}</p>

      <template #footer>
        <button class="btn btn-outline" type="button" @click="cerrarModal">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="modal.guardando" @click="guardar">
          {{ modal.guardando ? 'Guardando…' : 'Guardar usuario' }}
        </button>
      </template>
    </BaseModal>

    <ConfirmModal
      v-if="confirmEliminar.abierto"
      title="Eliminar usuario"
      :message="`¿Eliminar al usuario &quot;${confirmEliminar.usuario?.nombre}&quot;? Esta acción no se puede deshacer.`"
      confirm-text="Eliminar"
      @confirm="confirmarEliminar"
      @cancel="confirmEliminar.abierto = false"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { alCambiar } from '../composables/useEventos'
import { ROLES_ASIGNABLES, nombreRol } from '../../../shared/permisos.js'
import { session } from '../store/session'
import { mensajeError } from '../composables/useErrores'
import BackLink from '../components/BackLink.vue'
import BaseModal from '../components/BaseModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import SearchSelect from '../components/SearchSelect.vue'
import { normalizarUsuario } from '../composables/useMascaras'

const usuarios = ref([])

// Solo se asignan Administrador y Vendedor: el Admin de Sistema es único y
// protegido (no se crea ni se asigna desde aquí).
const DESCRIPCION_ROL = {
  administrador: 'Acceso total: gestiona productos, inventario, usuarios y configuración.',
  vendedor: 'Vende y consulta. No puede crear ni editar productos ni registrar entradas.'
}
const opcionesRol = ROLES_ASIGNABLES.map((r) => ({ value: r, label: nombreRol(r) }))
const descripcionRol = computed(() => DESCRIPCION_ROL[form.rol] ?? '')
const cargando = ref(true)
const error = ref('')

async function cargarUsuarios() {
  cargando.value = true
  error.value = ''
  try {
    usuarios.value = await window.api.usuarios.listar()
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const modal = reactive({ abierto: false, id: null, error: '', guardando: false })
const form = reactive({ nombre: '', usuario: '', rol: 'vendedor', password: '' })

function abrirCrear() {
  modal.abierto = true
  modal.id = null
  modal.error = ''
  form.nombre = ''
  form.usuario = ''
  form.rol = 'vendedor'
  form.password = ''
}

function abrirEditar(usuario) {
  modal.abierto = true
  modal.id = usuario.id
  modal.error = ''
  form.nombre = usuario.nombre
  form.usuario = usuario.usuario
  form.rol = usuario.rol
  form.password = ''
}

function cerrarModal() {
  modal.abierto = false
}

function onUsuarioInput(e) {
  form.usuario = normalizarUsuario(e.target.value)
  e.target.value = form.usuario
}

async function guardar() {
  modal.error = ''
  modal.guardando = true
  try {
    if (modal.id) {
      await window.api.usuarios.actualizar(modal.id, {
        nombre: form.nombre.trim(),
        usuario: normalizarUsuario(form.usuario),
        rol: form.rol,
        password: form.password
      })
    } else {
      await window.api.usuarios.crear({
        nombre: form.nombre.trim(),
        usuario: normalizarUsuario(form.usuario),
        rol: form.rol,
        password: form.password
      })
    }
    await cargarUsuarios()
    cerrarModal()
  } catch (e) {
    modal.error = mensajeError(e)
  } finally {
    modal.guardando = false
  }
}

const confirmEliminar = reactive({ abierto: false, usuario: null })

function pedirEliminar(usuario) {
  confirmEliminar.abierto = true
  confirmEliminar.usuario = usuario
}

async function confirmarEliminar() {
  const usuario = confirmEliminar.usuario
  confirmEliminar.abierto = false
  if (!usuario) return

  error.value = ''
  try {
    await window.api.usuarios.eliminar(usuario.id)
    await cargarUsuarios()
  } catch (e) {
    error.value = mensajeError(e)
  }
}

onMounted(cargarUsuarios)
alCambiar('usuarios', () => cargarUsuarios().catch(() => {}))

</script>
