import { getDb } from '../db/connection.js'

export function listar({ incluirInactivos = false } = {}) {
  return getDb()
    .prepare(`SELECT * FROM proveedores ${incluirInactivos ? '' : 'WHERE activo = 1'} ORDER BY nombre`)
    .all()
}

export function buscarPorId(id) {
  return getDb().prepare('SELECT * FROM proveedores WHERE id = ?').get(id)
}

export function crear({ nombre, documento, telefono, direccion }) {
  const info = getDb()
    .prepare('INSERT INTO proveedores (nombre, documento, telefono, direccion) VALUES (?, ?, ?, ?)')
    .run(nombre, documento, telefono, direccion)
  return buscarPorId(info.lastInsertRowid)
}

export function actualizar(id, { nombre, documento, telefono, direccion }) {
  getDb()
    .prepare('UPDATE proveedores SET nombre = ?, documento = ?, telefono = ?, direccion = ? WHERE id = ?')
    .run(nombre, documento, telefono, direccion, id)
  return buscarPorId(id)
}

export function cambiarActivo(id, activo) {
  getDb().prepare('UPDATE proveedores SET activo = ? WHERE id = ?').run(activo ? 1 : 0, id)
  return buscarPorId(id)
}
