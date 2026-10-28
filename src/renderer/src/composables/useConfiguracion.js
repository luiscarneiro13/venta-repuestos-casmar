// Menús del hub de "Configuración", divididos en dos bloques.
// Se comparten entre SideBar.vue (para marcar el ítem activo) y
// ConfiguracionView.vue (para las tarjetas del hub).
// `permiso` (opcional): la tarjeta solo se muestra a los roles que lo tienen
// (src/shared/permisos.js); la ruta además está protegida en el router.

// Bloque "Operaciones": accesos a las pantallas operativas del día a día.
export const RUTAS_OPERACIONES = [
  {
    to: '/proveedores',
    permiso: 'catalogo.gestionar',
    label: 'Proveedores',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h18v12H3zM7 8V4h10v4M7 13h10M7 17h6"/></svg>'
  },
  {
    to: '/categorias-proveedor',
    permiso: 'catalogo.gestionar',
    label: 'Categorías de proveedores',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'
  },
  {
    to: '/categorias-producto',
    permiso: 'catalogo.gestionar',
    label: 'Categorías de productos',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none"/></svg>'
  },
  {
    to: '/clientes',
    label: 'Clientes',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 19c.6-3.4 3.3-5.4 6.5-5.4s5.9 2 6.5 5.4"/><circle cx="17.5" cy="8.5" r="2.3"/><path d="M16 13.6c2.5.3 4.4 2.1 4.9 4.9"/></svg>'
  },
  {
    to: '/operaciones-inventario',
    permiso: 'inventario.gestionar',
    label: 'Operaciones de entrada y salida',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
  },
  {
    to: '/tipos-precio',
    permiso: 'catalogo.gestionar',
    label: 'Tipos de precio',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 8-9 9-8-8V4h8z"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/></svg>'
  }
]

// Bloque "Indicadores": reportes de ventas.
export const RUTAS_INDICADORES = [
  {
    to: '/ventas',
    label: 'Ventas del día',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h3"/></svg>'
  },
  {
    to: '/ventas-totales',
    label: 'Ventas totales',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5M4 19h16M8 19v-6M13 19v-9M18 19v-4"/></svg>'
  },
  {
    to: '/reportes-inventario',
    label: 'Reportes de inventario',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>'
  },
  {
    to: '/consumo-clientes',
    label: 'Consumo por cliente',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 19c.6-3.4 3.3-5.4 6.5-5.4s5.9 2 6.5 5.4"/><path d="M16 4h6M19 1v6"/></svg>'
  }
]

// Bloque "Configuración": ajustes generales del sistema.
export const RUTAS_CONFIGURACION = [
  {
    to: '/impresora',
    permiso: 'configuracion.gestionar',
    label: 'Impresora',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M6 17h12v4H6z"/></svg>'
  },
  {
    to: '/usuarios',
    permiso: 'usuarios.gestionar',
    label: 'Usuarios',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 19c.6-3.4 3.3-5.4 6.5-5.4s5.9 2 6.5 5.4"/><circle cx="17.5" cy="8.5" r="2.3"/><path d="M16 13.6c2.5.3 4.4 2.1 4.9 4.9"/></svg>'
  },
  {
    to: '/sistema',
    permiso: 'configuracion.gestionar',
    label: 'Sistema',
    icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  }
]
