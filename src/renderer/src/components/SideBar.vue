<template>
  <nav class="sidebar" :class="{ collapsed: uiState.sidebarCollapsed }">
    <button class="sidebar-toggle" title="Colapsar menú" aria-label="Colapsar menú" @click="toggleSidebar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>

    <RouterLink to="/venta" class="nav-item" active-class="active" data-label="Nueva venta">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M2 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7H6" />
      </svg>
      <span class="label">Nueva venta</span>
    </RouterLink>

    <RouterLink to="/configuracion" class="nav-item" :class="{ active: configuracionActiva }" data-label="Configuración">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
      <span class="label">Configuración</span>
    </RouterLink>

    <RouterLink to="/indicadores" class="nav-item" :class="{ active: indicadoresActiva }" data-label="Indicadores">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M4 19V5M4 19h16M8 19v-6M13 19v-9M18 19v-4" />
      </svg>
      <span class="label">Indicadores</span>
    </RouterLink>

    <div class="sidebar-footer">
      <button type="button" class="nav-item" data-label="Salir" @click="cerrarSesion">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
        <span class="label">Salir</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { uiState, toggleSidebar } from '../store/ui'
import { cerrarSesion } from '../store/session'
import { RUTAS_OPERACIONES, RUTAS_CONFIGURACION, RUTAS_INDICADORES } from '../composables/useConfiguracion'

const route = useRoute()
const configuracionActiva = computed(
  () =>
    route.path === '/configuracion' ||
    RUTAS_OPERACIONES.some((item) => item.to === route.path) ||
    RUTAS_CONFIGURACION.some((item) => item.to === route.path)
)
const indicadoresActiva = computed(
  () => route.path === '/indicadores' || RUTAS_INDICADORES.some((item) => item.to === route.path)
)
</script>
