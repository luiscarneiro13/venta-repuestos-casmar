import { getDb } from '../db/connection.js'

const SELECT_BASE = `
  SELECT tp.id, tp.nombre, tp.orden, tp.margen_default, tp.activo,
         (SELECT COUNT(*) FROM precios p WHERE p.tipo_precio_id = tp.id AND p.activo = 1) AS cantidad_precios
  FROM tipos_precio tp
`

export function listar() {
  return getDb().prepare(`${SELECT_BASE} ORDER BY tp.orden, tp.nombre`).all()
}

// Solo los tipos activos, en orden de presentación. Es la lista que usa la
// tabla de márgenes de la entrada y del editor de producto.
export function listarActivos() {
  return getDb().prepare(`${SELECT_BASE} WHERE tp.activo = 1 ORDER BY tp.orden, tp.nombre`).all()
}

export function buscarPorId(id) {
  return getDb().prepare(`${SELECT_BASE} WHERE tp.id = ?`).get(id)
}

export function crear({ nombre, orden, margenDefault }) {
  const info = getDb()
    .prepare('INSERT INTO tipos_precio (nombre, orden, margen_default) VALUES (?, ?, ?)')
    .run(nombre, orden, margenDefault)
  return buscarPorId(info.lastInsertRowid)
}

export function actualizar(id, { nombre, orden, margenDefault, activo }) {
  getDb()
    .prepare('UPDATE tipos_precio SET nombre = ?, orden = ?, margen_default = ?, activo = ? WHERE id = ?')
    .run(nombre, orden, margenDefault, activo, id)
  return buscarPorId(id)
}

export function siguienteOrden() {
  return getDb().prepare('SELECT COALESCE(MAX(orden), 0) + 1 AS orden FROM tipos_precio').get().orden
}

export function tienePrecios(id) {
  return Boolean(getDb().prepare('SELECT 1 FROM precios WHERE tipo_precio_id = ? LIMIT 1').get(id))
}

// Los tipos que ya se usaron no se borran: se desactivan para conservar el
// histórico (precios y venta_detalle guardan snapshot por id/nombre).
export function desactivar(id) {
  getDb().prepare('UPDATE tipos_precio SET activo = 0 WHERE id = ?').run(id)
  return buscarPorId(id)
}

export function eliminar(id) {
  getDb().prepare('DELETE FROM tipos_precio WHERE id = ?').run(id)
}
