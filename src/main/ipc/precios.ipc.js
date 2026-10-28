import { registrar } from './registro.js'
import { conPermiso } from './permisos.js'
import * as preciosService from '../services/precios.service.js'
import * as productosService from '../services/productos.service.js'

export function registerPreciosIpc() {
  registrar('precios:listar', (_event, opciones) => preciosService.listarPrecios(opciones))
  registrar('precios:listarPorProducto', (_event, productoId) =>
    preciosService.listarPreciosPorProducto(productoId)
  )
  registrar('precios:listarCatalogo', () => preciosService.listarPreciosCatalogo())

  registrar('productos:listar', (_event, opciones) => productosService.listarProductos(opciones))
  registrar('productos:obtener', (_event, id) => productosService.obtenerProducto(id))
  registrar('productos:crear', conPermiso('catalogo.gestionar', (_event, producto) => productosService.crearProducto(producto)))
  registrar('productos:actualizar', conPermiso('catalogo.gestionar', (_event, id, producto) => productosService.actualizarProducto(id, producto)))
  registrar('productos:eliminar', conPermiso('catalogo.gestionar', (_event, id) => productosService.eliminarProducto(id)))
  registrar('productos:reactivar', conPermiso('catalogo.gestionar', (_event, id) => productosService.reactivarProducto(id)))

  registrar('tiposPrecio:listar', () => preciosService.listarTiposPrecio())
  registrar('tiposPrecio:crear', conPermiso('catalogo.gestionar', (_event, tipo) => preciosService.crearTipoPrecio(tipo)))
  registrar('tiposPrecio:actualizar', conPermiso('catalogo.gestionar', (_event, id, tipo) => preciosService.actualizarTipoPrecio(id, tipo)))
  registrar('tiposPrecio:eliminar', conPermiso('catalogo.gestionar', (_event, id) => preciosService.eliminarTipoPrecio(id)))
}
