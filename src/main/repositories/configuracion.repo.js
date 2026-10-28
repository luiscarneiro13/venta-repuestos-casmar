import { getDb } from '../db/connection.js'

export function obtener(clave) {
  const fila = getDb().prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave)
  return fila ? fila.valor : null
}

export function guardar(clave, valor) {
  getDb()
    .prepare(
      `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now', 'localtime')`
    )
    .run(clave, valor)
  return obtener(clave)
}
