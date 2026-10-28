import { getDb } from '../db/connection.js'

// Acceso genérico a los catálogos de categorías (misma estructura:
// id, nombre UNIQUE NOCASE, descripcion, activo). La tabla se valida contra
// una lista cerrada porque se interpola en el SQL.
const TABLAS = ['categorias_proveedor', 'categorias_producto']

export function repoCategorias(tabla) {
  if (!TABLAS.includes(tabla)) throw new Error(`Tabla de categorías no permitida: ${tabla}`)
  const buscarPorId = (id) => getDb().prepare(`SELECT * FROM ${tabla} WHERE id = ?`).get(id)
  return {
    listar: ({ incluirInactivas = false } = {}) =>
      getDb().prepare(`SELECT * FROM ${tabla} ${incluirInactivas ? '' : 'WHERE activo = 1'} ORDER BY nombre`).all(),
    buscarPorId,
    crear: ({ nombre, descripcion }) =>
      buscarPorId(getDb().prepare(`INSERT INTO ${tabla} (nombre, descripcion) VALUES (?, ?)`).run(nombre, descripcion).lastInsertRowid),
    actualizar: (id, { nombre, descripcion }) => {
      getDb().prepare(`UPDATE ${tabla} SET nombre = ?, descripcion = ? WHERE id = ?`).run(nombre, descripcion, id)
      return buscarPorId(id)
    },
    cambiarActivo: (id, activo) => {
      getDb().prepare(`UPDATE ${tabla} SET activo = ? WHERE id = ?`).run(activo ? 1 : 0, id)
      return buscarPorId(id)
    },
    eliminar: (id) => getDb().prepare(`DELETE FROM ${tabla} WHERE id = ?`).run(id)
  }
}
