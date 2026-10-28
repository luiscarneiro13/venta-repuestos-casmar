import { createRouter, createWebHashHistory } from 'vue-router'
import { puedeHacer } from '../composables/usePermisos'
import VentaView from '../pages/VentaView.vue'
import MenuView from '../pages/MenuView.vue'
import ConfiguracionView from '../pages/ConfiguracionView.vue'
import ClientesView from '../pages/ClientesView.vue'
import InventarioView from '../pages/InventarioView.vue'
import VentasView from '../pages/VentasView.vue'
import VentasTotalesView from '../pages/VentasTotalesView.vue'
import IndicadoresView from '../pages/IndicadoresView.vue'
import ConsumoClientesView from '../pages/ConsumoClientesView.vue'
import ConsumoClienteGraficoView from '../pages/ConsumoClienteGraficoView.vue'
import ProductosView from '../pages/ProductosView.vue'
import ProveedoresView from '../pages/ProveedoresView.vue'
import CategoriasView from '../pages/CategoriasView.vue'
import ReportesInventarioView from '../pages/ReportesInventarioView.vue'
import TiposPrecioView from '../pages/TiposPrecioView.vue'
import ImpresoraView from '../pages/ImpresoraView.vue'
import UsuariosView from '../pages/UsuariosView.vue'
import SistemaView from '../pages/SistemaView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/menu' },
    { path: '/menu', name: 'menu', component: MenuView },
    { path: '/venta', name: 'venta', component: VentaView },
    { path: '/configuracion', name: 'configuracion', component: ConfiguracionView },
    { path: '/clientes', name: 'clientes', component: ClientesView },
    { path: '/inventario', name: 'inventario', component: ProductosView },
    { path: '/operaciones-inventario', name: 'operaciones-inventario', component: InventarioView, meta: { permiso: 'inventario.gestionar' } },
    { path: '/ventas', name: 'ventas', component: VentasView },
    { path: '/ventas-totales', name: 'ventas-totales', component: VentasTotalesView },
    { path: '/indicadores', name: 'indicadores', component: IndicadoresView },
    { path: '/consumo-clientes', name: 'consumo-clientes', component: ConsumoClientesView },
    { path: '/reportes-inventario', name: 'reportes-inventario', component: ReportesInventarioView },
    { path: '/consumo-cliente-grafico', name: 'consumo-cliente-grafico', component: ConsumoClienteGraficoView },
    { path: '/productos', redirect: '/inventario' },
    { path: '/proveedores', name: 'proveedores', component: ProveedoresView, meta: { permiso: 'catalogo.gestionar' } },
    {
      path: '/categorias-proveedor',
      name: 'categorias-proveedor',
      component: CategoriasView,
      meta: { permiso: 'catalogo.gestionar' },
      props: {
        titulo: 'Categorías de proveedores',
        subtitulo: 'Rubros que surten tus proveedores: motor, frenos, eléctrico…',
        api: 'categoriasProveedor'
      }
    },
    {
      path: '/categorias-producto',
      name: 'categorias-producto',
      component: CategoriasView,
      meta: { permiso: 'catalogo.gestionar' },
      props: {
        titulo: 'Categorías de productos',
        subtitulo: 'Familias de repuestos para organizar el catálogo: filtros, frenos, sensores…',
        api: 'categoriasProducto'
      }
    },
    { path: '/tipos-precio', name: 'tipos-precio', component: TiposPrecioView, meta: { permiso: 'catalogo.gestionar' } },
    { path: '/precios', redirect: '/inventario' },
    { path: '/impresora', name: 'impresora', component: ImpresoraView, meta: { permiso: 'configuracion.gestionar' } },
    { path: '/usuarios', name: 'usuarios', component: UsuariosView, meta: { permiso: 'usuarios.gestionar' } },
    { path: '/sistema', name: 'sistema', component: SistemaView, meta: { permiso: 'configuracion.gestionar' } }
  ]
})

// Rutas con `meta.permiso`: si el rol no lo tiene se vuelve al menú (la UI
// tampoco muestra sus tarjetas; la barrera real son las guardas de los IPC).
router.beforeEach((to) => {
  if (to.meta?.permiso && !puedeHacer(to.meta.permiso)) return { path: '/menu' }
  return true
})

export default router
