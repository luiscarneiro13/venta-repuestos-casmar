import { getDb } from '../db/connection.js'
import * as productosRepo from '../repositories/productos.repo.js'
import * as preciosRepo from '../repositories/precios.repo.js'
import { aplicarMargenesDeProducto } from './precios.service.js'
import { repoCategorias } from '../repositories/categorias.repo.js'

const categoriasProductoRepo = repoCategorias('categorias_producto')

function traducirErrorSqlite(error) {
  if (/UNIQUE constraint failed: productos\.codigo_barras/.test(error.message)) {
    return new Error('Ya existe un producto con ese código de barra')
  }
  if (/UNIQUE constraint failed: productos\.codigo/.test(error.message)) {
    return new Error('Ya existe un producto con ese código')
  }
  return error
}

// La categoría es opcional. Debe existir y estar activa; solo se acepta una
// desactivada si el producto ya la tenía (editar no obliga a cambiarla).
function normalizarCategoria(categoriaId, categoriaActual = null) {
  if (categoriaId === undefined || categoriaId === null || categoriaId === '') return null
  const id = Number(categoriaId)
  const categoria = Number.isInteger(id) ? categoriasProductoRepo.buscarPorId(id) : null
  if (!categoria) throw new Error('La categoría seleccionada no existe')
  if (!categoria.activo && id !== categoriaActual) throw new Error('La categoría seleccionada está desactivada')
  return id
}

function normalizarProducto({ codigo, codigoBarras, nombre, marca, descripcion, unidadMedida, ubicacion, stockMinimo }) {
  const datos = {
    codigo: (codigo || '').trim() || null,
    codigoBarras: (codigoBarras || '').trim() || null,
    nombre: (nombre || '').trim(),
    marca: (marca || '').trim(),
    descripcion: (descripcion || '').trim(),
    unidadMedida: (unidadMedida || '').trim() || 'unidad',
    ubicacion: (ubicacion || '').trim() || null,
    stockMinimo: stockMinimo === undefined || stockMinimo === null || stockMinimo === '' ? 0 : Number(stockMinimo)
  }
  if (!datos.nombre) throw new Error('El nombre del producto es obligatorio')
  if (!Number.isInteger(datos.stockMinimo) || datos.stockMinimo < 0) {
    throw new Error('El inventario mínimo debe ser un entero mayor o igual a 0')
  }
  return datos
}

function conPrecios(producto) {
  return producto ? { ...producto, precios: preciosRepo.listarPorProducto(producto.id) } : null
}

export function listarProductos(opciones) {
  return productosRepo.listar(opciones)
}

export function obtenerProducto(id) {
  const producto = conPrecios(productosRepo.buscarPorId(id))
  if (!producto) throw new Error('El producto no existe')
  return producto
}

// Los márgenes son dato del producto (la entrada es solo el atajo operativo):
// si vienen, se guardan como margen propio y se rematerializa valor_usd con
// el costo registrado, sin generar movimiento de inventario.
function aplicarMargenesSiVienen(productoId, margenes) {
  if (margenes === undefined) return
  const costo = productosRepo.buscarPorId(productoId).precio_compra_usd
  aplicarMargenesDeProducto(productoId, costo, margenes)
}

export function crearProducto(producto) {
  const datos = { ...normalizarProducto(producto), categoriaId: normalizarCategoria(producto.categoriaId) }
  try {
    return getDb().transaction(() => {
      const id = productosRepo.crear(datos)
      aplicarMargenesSiVienen(id, producto.margenes)
      return obtenerProducto(id)
    })()
  } catch (error) {
    throw traducirErrorSqlite(error)
  }
}

export function actualizarProducto(id, producto) {
  const actual = productosRepo.buscarPorId(id)
  if (!actual) throw new Error('El producto no existe')
  const datos = { ...normalizarProducto(producto), categoriaId: normalizarCategoria(producto.categoriaId, actual.categoria_id) }
  try {
    return getDb().transaction(() => {
      productosRepo.actualizar(id, datos)
      aplicarMargenesSiVienen(id, producto.margenes)
      return obtenerProducto(id)
    })()
  } catch (error) {
    throw traducirErrorSqlite(error)
  }
}

// Si el producto ya tiene ventas o movimientos de inventario no se puede
// borrar sin perder historial: se desactiva (deja de aparecer en ventas y en
// el catálogo, pero sus ventas pasadas siguen intactas).
export function eliminarProducto(id) {
  if (!productosRepo.buscarPorId(id)) throw new Error('El producto no existe')
  if (productosRepo.tieneVentas(id) || productosRepo.tieneMovimientos(id)) {
    productosRepo.desactivar(id)
    return { desactivado: true }
  }
  productosRepo.eliminar(id)
  return { desactivado: false }
}

export function reactivarProducto(id) {
  productosRepo.reactivar(id)
  return obtenerProducto(id)
}
