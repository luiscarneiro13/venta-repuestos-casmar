<template>
  <div id="login-overlay">
    <div class="login-box">
      <div class="login-logo login-logo-centered">
        <img :src="logoUrl" class="login-logo-img" alt="Venta de Repuestos" />
        <div class="sub">v{{ VERSION }}</div>
      </div>
      <h2>Iniciar sesión</h2>

      <div class="login-field">
        <label class="field-label">Usuario</label>
        <input
          :value="usuarioTexto"
          class="input"
          type="text"
          placeholder="Usuario"
          autocomplete="off"
          @input="onUsuarioInput"
          @keyup.enter="manejarEnter"
        />
      </div>
      <div class="login-field">
        <label class="field-label">Contraseña</label>
        <input v-model="password" class="input" type="password" placeholder="••••••••" @keyup.enter="manejarEnter" />
      </div>

      <p v-if="error" class="tasa-hint" style="color: var(--danger)">{{ error }}</p>

      <p v-if="modoEsclavo" class="login-modo">Esclavo · servidor {{ modoEsclavo }}</p>
      <button class="btn btn-primary" :disabled="cargando" @click="ingresar">Ingresar al sistema</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { iniciarSesion } from '../store/session'
import { normalizarUsuario } from '../composables/useMascaras'
import { mensajeError } from '../composables/useErrores'
import logoUrl from '../assets/logo.png'

const router = useRouter()

// Inyectada por electron-vite en tiempo de build (electron.vite.config.mjs),
// lee la versión de package.json. Fallback para `npm run dev` donde la
// constante podría no estar definida si no se procesa el define.
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

const usuarioTexto = ref('')
const password = ref('')
const error = ref('')
const cargando = ref(false)
// En modo esclavo muestra a qué servidor se está conectando (útil para
// diagnosticar "no hay conexión").
const modoEsclavo = ref('')

onMounted(async () => {
  try {
    const cfg = await window.api?.appConfig?.obtener()
    if (cfg?.modo === 'cliente') modoEsclavo.value = `${cfg.servidor}:${cfg.puerto}`
  } catch { /* sin config accesible: se asume principal */ }
})

function onUsuarioInput(e) {
  usuarioTexto.value = normalizarUsuario(e.target.value)
  e.target.value = usuarioTexto.value
}

async function ingresar() {
  error.value = ''

  const texto = normalizarUsuario(usuarioTexto.value)
  if (!texto || !password.value) {
    error.value = 'Ingresa usuario y contraseña'
    return
  }

  cargando.value = true
  try {
    // El proceso principal verifica la contraseña y abre la sesión que usan
    // las guardas de permisos; el renderer solo guarda el usuario devuelto.
    const usuario = await window.api.auth.login({ usuario: texto, password: password.value })
    password.value = ''
    iniciarSesion({ usuario })

    // Se reemplaza (no se apila) la ruta para que el menú principal quede
    // como única pantalla de entrada: evita volver por error a la última
    // pantalla visitada antes de cerrar sesión.
    await router.replace('/menu')
  } catch (e) {
    error.value = mensajeError(e) || 'No se pudo iniciar sesión'
  } finally {
    cargando.value = false
  }
}

function manejarEnter() {
  if (usuarioTexto.value.trim() && password.value) {
    ingresar()
  }
}

</script>

<style scoped>
.login-modo {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: -4px;
}

.login-logo-centered {
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.login-logo-img {
  width: 190px;
  height: auto;
  margin-bottom: 8px;
}

</style>
