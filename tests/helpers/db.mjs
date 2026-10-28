// Utilidad para los tests de backend: levanta una BD SQLite en memoria con
// todas las migraciones y seeds aplicados, y la inyecta en el singleton de
// connection.js para que repos/services la usen.
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { setDbPath } from '../../src/main/db/connection.js'

const dbDir = join(dirname(fileURLToPath(import.meta.url)), '../../src/main/db')

function ejecutarSql(db, carpeta) {
  for (const nombre of readdirSync(carpeta).filter((n) => n.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(carpeta, nombre), 'utf8'))
  }
}

// Devuelve la Database ya conectada al singleton (getDb() en cualquier módulo
// del backend apunta a esta misma base). Llamar db.close() al terminar.
export function nuevaBaseEnMemoria() {
  const db = setDbPath(':memory:')
  db.pragma('foreign_keys = OFF')
  ejecutarSql(db, join(dbDir, 'migrations'))
  db.pragma('foreign_keys = ON')
  ejecutarSql(db, join(dbDir, 'seeds'))
  return db
}
