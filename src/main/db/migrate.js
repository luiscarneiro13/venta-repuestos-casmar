import { getDb } from './connection.js'

// Se importan como texto (Vite ?raw) para quedar embebidas en el build
// y no depender de copiar archivos sueltos dentro del .asar empaquetado.
const migracionesRaw = import.meta.glob('./migrations/*.sql', {
  eager: true,
  query: '?raw',
  import: 'default'
})

const migraciones = Object.entries(migracionesRaw)
  .map(([ruta, sql]) => ({ nombre: ruta.split('/').pop(), sql }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre))

export function runMigrations() {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre TEXT PRIMARY KEY,
      aplicada_en TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const aplicadas = new Set(db.prepare('SELECT nombre FROM schema_migrations').all().map((r) => r.nombre))
  const marcarAplicada = db.prepare('INSERT INTO schema_migrations (nombre) VALUES (?)')

  const pendientes = migraciones.filter((m) => !aplicadas.has(m.nombre))
  if (pendientes.length === 0) return

  // Las migraciones pueden reconstruir tablas (DROP + CREATE + INSERT) que
  // disparan validaciones de FK si foreign_keys está activo. Se desactivan
  // durante las migraciones y se reactivan al terminar. PRAGMA foreign_keys
  // no se puede cambiar dentro de una transacción, por eso va fuera.
  db.pragma('foreign_keys = OFF')

  try {
    for (const { nombre, sql } of pendientes) {
      const aplicar = db.transaction(() => {
        db.exec(sql)
        marcarAplicada.run(nombre)
      })

      aplicar()
      console.log(`[db] migración aplicada: ${nombre}`)
    }
  } finally {
    db.pragma('foreign_keys = ON')
  }
}
