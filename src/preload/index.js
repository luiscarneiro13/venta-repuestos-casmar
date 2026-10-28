import { contextBridge, ipcRenderer } from 'electron'

// Mismo contrato para todos los catálogos de categorías.
const apiCategorias = (prefijo) => ({
  listar: (opciones) => ipcRenderer.invoke(`${prefijo}:listar`, opciones),
  crear: (datos) => ipcRenderer.invoke(`${prefijo}:crear`, datos),
  actualizar: (id, datos) => ipcRenderer.invoke(`${prefijo}:actualizar`, id, datos),
  desactivar: (id) => ipcRenderer.invoke(`${prefijo}:desactivar`, id),
  reactivar: (id) => ipcRenderer.invoke(`${prefijo}:reactivar`, id),
  eliminar: (id) => ipcRenderer.invoke(`${prefijo}:eliminar`, id)
})

const api = {
  auth: {
    login: (credenciales) => ipcRenderer.invoke('auth:login', credenciales),
    logout: () => ipcRenderer.invoke('auth:logout'),
    sesion: () => ipcRenderer.invoke('auth:sesion')
  },
  usuarios: {
    roles: () => ipcRenderer.invoke('usuarios:roles'),
    listar: () => ipcRenderer.invoke('usuarios:listar'),
    crear: (usuario) => ipcRenderer.invoke('usuarios:crear', usuario),
    actualizar: (id, cambios) => ipcRenderer.invoke('usuarios:actualizar', id, cambios),
    eliminar: (id) => ipcRenderer.invoke('usuarios:eliminar', id)
  },
  precios: {
    listar: (opciones) => ipcRenderer.invoke('precios:listar', opciones),
    // Todos los tipos activos del producto con margen efectivo y precio
    // calculado en $ / Bs / USDT con la tasa vigente.
    listarPorProducto: (productoId) => ipcRenderer.invoke('precios:listarPorProducto', productoId),
    listarCatalogo: () => ipcRenderer.invoke('precios:listarCatalogo')
  },
  productos: {
    listar: (opciones) => ipcRenderer.invoke('productos:listar', opciones),
    obtener: (id) => ipcRenderer.invoke('productos:obtener', id),
    crear: (producto) => ipcRenderer.invoke('productos:crear', producto),
    actualizar: (id, producto) => ipcRenderer.invoke('productos:actualizar', id, producto),
    eliminar: (id) => ipcRenderer.invoke('productos:eliminar', id),
    reactivar: (id) => ipcRenderer.invoke('productos:reactivar', id)
  },
  tiposPrecio: {
    listar: () => ipcRenderer.invoke('tiposPrecio:listar'),
    crear: (tipo) => ipcRenderer.invoke('tiposPrecio:crear', tipo),
    actualizar: (id, tipo) => ipcRenderer.invoke('tiposPrecio:actualizar', id, tipo),
    eliminar: (id) => ipcRenderer.invoke('tiposPrecio:eliminar', id)
  },
  tasas: {
    obtenerHoy: () => ipcRenderer.invoke('tasas:obtenerHoy'),
    obtenerUltima: () => ipcRenderer.invoke('tasas:obtenerUltima'),
    registrar: (datos) => ipcRenderer.invoke('tasas:registrar', datos)
  },
  clientes: {
    listar: () => ipcRenderer.invoke('clientes:listar'),
    listarConConsumo: () => ipcRenderer.invoke('clientes:listarConConsumo'),
    consumoDiario: (clienteId, periodo, desde, hasta) =>
      ipcRenderer.invoke('clientes:consumoDiario', clienteId, periodo, desde, hasta),
    historial: (clienteId, desde, hasta) =>
      ipcRenderer.invoke('clientes:historial', clienteId, desde, hasta),
    crear: (cliente) => ipcRenderer.invoke('clientes:crear', cliente),
    actualizar: (id, cliente) => ipcRenderer.invoke('clientes:actualizar', id, cliente)
  },
  proveedores: {
    listar: (opciones) => ipcRenderer.invoke('proveedores:listar', opciones),
    crear: (datos) => ipcRenderer.invoke('proveedores:crear', datos),
    actualizar: (id, datos) => ipcRenderer.invoke('proveedores:actualizar', id, datos),
    desactivar: (id) => ipcRenderer.invoke('proveedores:desactivar', id),
    reactivar: (id) => ipcRenderer.invoke('proveedores:reactivar', id)
  },
  categoriasProveedor: apiCategorias('categoriasProveedor'),
  categoriasProducto: apiCategorias('categoriasProducto'),
  ventas: {
    listar: () => ipcRenderer.invoke('ventas:listar'),
    listarHoy: () => ipcRenderer.invoke('ventas:listarHoy'),
    totalesProductosHoy: () => ipcRenderer.invoke('ventas:totalesProductosHoy'),
    listarConFiltros: (filtros) => ipcRenderer.invoke('ventas:listarConFiltros', filtros),
    graficoVentasTotales: (periodo, desde, hasta) =>
      ipcRenderer.invoke('ventas:graficoVentasTotales', periodo, desde, hasta),
    crear: (venta) => ipcRenderer.invoke('ventas:crear', venta),
    detalle: (id) => ipcRenderer.invoke('ventas:detalle', id),
    anular: (id, motivo, usuarioId) => ipcRenderer.invoke('ventas:anular', id, motivo, usuarioId)
  },
  impresora: {
    configuracion: () => ipcRenderer.invoke('impresora:configuracion'),
    guardar: (datos) => ipcRenderer.invoke('impresora:guardar', datos),
    listar: () => ipcRenderer.invoke('impresora:listar'),
    probar: () => ipcRenderer.invoke('impresora:probar'),
    imprimirVenta: (ventaId) => ipcRenderer.invoke('impresora:imprimirVenta', ventaId),
    previsualizar: (ventaId) => ipcRenderer.invoke('impresora:previsualizar', ventaId),
    imprimirReporteCierre: (cajaId, usuarioNombre) =>
      ipcRenderer.invoke('impresora:imprimirReporteCierre', cajaId, usuarioNombre),
    imprimirReporteDiario: (fecha, usuarioNombre) =>
      ipcRenderer.invoke('impresora:imprimirReporteDiario', fecha, usuarioNombre)
  },
  caja: {
    listarAbiertas: () => ipcRenderer.invoke('caja:listarAbiertas'),
    abrirDelDia: (datos) => ipcRenderer.invoke('caja:abrirDelDia', datos),
    resumenCierre: (cajaId) => ipcRenderer.invoke('caja:resumenCierre', cajaId),
    cerrar: (datos) => ipcRenderer.invoke('caja:cerrar', datos)
  },
  inventario: {
    resumen: () => ipcRenderer.invoke('inventario:resumen'),
    reporte: () => ipcRenderer.invoke('inventario:reporte'),
    estadoProducto: (productoId) => ipcRenderer.invoke('inventario:estadoProducto', productoId),
    listarMovimientos: () => ipcRenderer.invoke('inventario:listarMovimientos'),
    registrarEntrada: (datos) => ipcRenderer.invoke('inventario:registrarEntrada', datos),
    registrarAjusteSalida: (datos) => ipcRenderer.invoke('inventario:registrarAjusteSalida', datos),
    editarMovimiento: (datos) => ipcRenderer.invoke('inventario:editarMovimiento', datos),
    unidadesHoy: () => ipcRenderer.invoke('inventario:unidadesHoy')
  },
  configuracion: {
    obtenerIva: () => ipcRenderer.invoke('configuracion:obtenerIva'),
    guardarIva: (porcentaje) => ipcRenderer.invoke('configuracion:guardarIva', porcentaje)
  },
  appConfig: {
    obtener: () => ipcRenderer.invoke('appConfig:obtener'),
    guardar: (datos) => ipcRenderer.invoke('appConfig:guardar', datos),
    probar: (datos) => ipcRenderer.invoke('appConfig:probar', datos),
    reiniciar: () => ipcRenderer.invoke('appConfig:reiniciar')
  },
  eventos: {
    // Refresco en vivo (WebSocket del esclavo / emisión local del servidor).
    // Devuelve una función para quitar la suscripción.
    on: (callback) => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('evento:remoto', listener)
      return () => ipcRenderer.removeListener('evento:remoto', listener)
    }
  },
  sistema: {
    version: () => ipcRenderer.invoke('sistema:version'),
    verificarAdmin: (password) => ipcRenderer.invoke('sistema:verificarAdmin', password),
    reiniciarBaseDatos: () => ipcRenderer.invoke('sistema:reiniciarBaseDatos'),
    exportarBackup: () => ipcRenderer.invoke('sistema:exportarBackup'),
    rutaBaseDatos: () => ipcRenderer.invoke('sistema:rutaBaseDatos')
  }
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}
