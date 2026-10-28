import { registrar } from './registro.js'
import { categoriasProveedor, categoriasProducto } from '../services/categorias.service.js'
import { conPermiso } from './permisos.js'

// Canales `<prefijo>:listar|crear|actualizar|desactivar|reactivar|eliminar`
// para cada catálogo de categorías. Listar es libre; modificar exige
// 'catalogo.gestionar' (los vendedores no gestionan el catálogo).
function registrarCatalogo(prefijo, servicio) {
  const gestionar = (handler) => conPermiso('catalogo.gestionar', handler)
  registrar(`${prefijo}:listar`, (_event, opciones) => servicio.listar(opciones))
  registrar(`${prefijo}:crear`, gestionar((_event, datos) => servicio.crear(datos)))
  registrar(`${prefijo}:actualizar`, gestionar((_event, id, datos) => servicio.actualizar(id, datos)))
  registrar(`${prefijo}:desactivar`, gestionar((_event, id) => servicio.desactivar(id)))
  registrar(`${prefijo}:reactivar`, gestionar((_event, id) => servicio.reactivar(id)))
  registrar(`${prefijo}:eliminar`, gestionar((_event, id) => servicio.eliminar(id)))
}

export function registerCategoriasIpc() {
  registrarCatalogo('categoriasProveedor', categoriasProveedor)
  registrarCatalogo('categoriasProducto', categoriasProducto)
}
