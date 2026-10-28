import { getDb } from '../db/connection.js'

export function listar() {
  return getDb().prepare('SELECT id, nombre, usuario, rol, creado_en FROM usuarios ORDER BY nombre').all()
}

export function buscarPorUsuario(usuario) {
  return getDb().prepare('SELECT * FROM usuarios WHERE usuario = ?').get(usuario)
}

export function buscarSistema() {
  return getDb().prepare("SELECT * FROM usuarios WHERE rol = 'sistema' ORDER BY id LIMIT 1").get()
}

export function listarRoles() {
  return getDb().prepare('SELECT * FROM roles ORDER BY nivel DESC').all()
}

export function buscarPorId(id) {
  return getDb().prepare('SELECT id, nombre, usuario, rol, creado_en FROM usuarios WHERE id = ?').get(id)
}

export function crear({ nombre, usuario, passwordHash, rol }) {
  const info = getDb()
    .prepare('INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?, ?, ?, ?)')
    .run(nombre, usuario, passwordHash, rol)

  return { id: info.lastInsertRowid, nombre, usuario, rol }
}

export function actualizar(id, { nombre, usuario, rol, passwordHash }) {
  if (passwordHash) {
    getDb()
      .prepare('UPDATE usuarios SET nombre = ?, usuario = ?, rol = ?, password_hash = ? WHERE id = ?')
      .run(nombre, usuario, rol, passwordHash, id)
  } else {
    getDb().prepare('UPDATE usuarios SET nombre = ?, usuario = ?, rol = ? WHERE id = ?').run(nombre, usuario, rol, id)
  }
  return buscarPorId(id)
}

export function eliminar(id) {
  getDb().prepare('DELETE FROM usuarios WHERE id = ?').run(id)
}
