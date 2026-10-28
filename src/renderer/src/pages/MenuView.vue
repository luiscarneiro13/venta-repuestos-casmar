<template>
  <section class="menu-page">
    <div class="menu-heading">
      <span class="menu-eyebrow">PUNTO DE VENTA · REPUESTOS</span>
      <h1>Panel de trabajo</h1>
      <p>Accede a ventas, inventario y gestión desde un mismo lugar.</p>
    </div>
    <div class="menu-grid">
      <button class="menu-card" @click="irA('/venta')">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
          <path d="M2 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7H6" />
        </svg>
        <span class="menu-copy"><strong class="menu-label">Nueva venta</strong><small>Registrar pedidos y elegir precios</small></span>
        <span class="menu-arrow" aria-hidden="true">→</span>
      </button>

      <button class="menu-card" @click="irA('/inventario')">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 8l9-5 9 5-9 5-9-5z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
        <span class="menu-copy"><strong class="menu-label">Inventario</strong><small>Productos, existencias y entradas por producto</small></span>
        <span class="menu-arrow" aria-hidden="true">→</span>
      </button>

      <button class="menu-card" @click="irA('/configuracion')">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span class="menu-copy"><strong class="menu-label">Operaciones</strong><small>Entradas, salidas, clientes y configuración</small></span>
        <span class="menu-arrow" aria-hidden="true">→</span>
      </button>

      <button class="menu-card" @click="irA('/indicadores')">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 19V5M4 19h16M8 19v-6M13 19v-9M18 19v-4" />
        </svg>
        <span class="menu-copy"><strong class="menu-label">Indicadores</strong><small>Ventas, consumo por cliente y reporte diario</small></span>
        <span class="menu-arrow" aria-hidden="true">→</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function irA(ruta) {
  router.push(ruta)
}
</script>

<style scoped>
.menu-page {
  max-width: 1020px;
  margin: 0 auto;
  min-height: calc(100vh - 160px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px 0;
}
.menu-heading {
  margin-bottom: 28px;
}
.menu-eyebrow {
  color: var(--accent);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.13em;
}
.menu-heading h1 {
  font: 720 32px/1.2 var(--display-font);
  letter-spacing: -0.04em;
  margin: 8px 0 4px;
}
.menu-heading p {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 0;
}
.menu-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.menu-card {
  min-height: 126px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  text-align: left;
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.menu-card:first-child {
  border-left-color: var(--accent);
}
.menu-card:hover:not(:disabled) {
  border-color: var(--accent);
  box-shadow: 0 12px 28px rgba(24, 38, 43, 0.12);
  transform: translateY(-2px);
}
.menu-card:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.menu-card > svg {
  width: 48px;
  height: 48px;
  flex: none;
  padding: 10px;
  color: var(--primary);
  background: var(--primary-light);
  border-radius: 10px;
}
.menu-card:first-child > svg {
  color: var(--accent);
  background: var(--accent-light);
}
.menu-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}
.menu-label {
  font: 700 17px/1.2 var(--display-font);
  letter-spacing: -0.02em;
}
.menu-copy small {
  color: var(--text-secondary);
  font-size: 12px;
}
.menu-arrow {
  color: var(--accent);
  font-size: 22px;
  line-height: 1;
}
@media (max-width: 700px) {
  .menu-grid { grid-template-columns: 1fr; }
  .menu-page { min-height: auto; }
}
</style>
