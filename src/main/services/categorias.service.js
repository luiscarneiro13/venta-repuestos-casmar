import { repoCategorias } from '../repositories/categorias.repo.js'
import { contarPorCategoria } from '../repositories/productos.repo.js'

// Lógica común de los catálogos de categorías (proveedores y productos).
// `contarUso(id)` (opcional) devuelve cuántos registros usan la categoría:
// si está en uso no se borra (se desactiva) para no dejar huérfanos.
export function servicioCategorias(tabla, { contarUso, entidad = 'registros' } = {}) {
  const repo = repoCategorias(tabla)

  const normalizar = ({ nombre, descripcion }) => {
    const nombreLimpio = String(nombre || '').trim()
    if (!nombreLimpio) throw new Error('El nombre de la categoría es obligatorio')
    return { nombre: nombreLimpio, descripcion: String(descripcion || '').trim() }
  }

  const traducirError = (error) =>
    new RegExp(`UNIQUE constraint failed: ${tabla}\\.nombre`).test(error.message)
      ? new Error('Ya existe una categoría con ese nombre')
      : error

  const existente = (id) => {
    const categoria = repo.buscarPorId(id)
    if (!categoria) throw new Error('La categoría no existe')
    return categoria
  }

  return {
    listar: (opciones) => repo.listar(opciones),
    crear: (datos) => {
      try {
        return repo.crear(normalizar(datos))
      } catch (error) {
        throw traducirError(error)
      }
    },
    actualizar: (id, datos) => {
      existente(id)
      try {
        return repo.actualizar(id, normalizar(datos))
      } catch (error) {
        throw traducirError(error)
      }
    },
    desactivar: (id) => {
      existente(id)
      return repo.cambiarActivo(id, false)
    },
    reactivar: (id) => {
      existente(id)
      return repo.cambiarActivo(id, true)
    },
    eliminar: (id) => {
      existente(id)
      const usos = contarUso ? contarUso(id) : 0
      if (usos > 0) {
        throw new Error(`La categoría tiene ${usos} ${entidad} asignados: desactívala en lugar de eliminarla`)
      }
      repo.eliminar(id)
      return { ok: true }
    }
  }
}

export const categoriasProveedor = servicioCategorias('categorias_proveedor')
export const categoriasProducto = servicioCategorias('categorias_producto', {
  contarUso: contarPorCategoria,
  entidad: 'productos'
})
