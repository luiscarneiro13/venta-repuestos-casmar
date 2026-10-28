import { getDb } from './connection.js'

// Igual que en migrate.js: se importan como texto (Vite ?raw) para quedar
// embebidos en el build.
const catalogoRaw = import.meta.glob('./seeds/*.sql', {
  eager: true,
  query: '?raw',
  import: 'default'
})
const demoRaw = import.meta.glob('./seeds/dev/*.sql', {
  eager: true,
  query: '?raw',
  import: 'default'
})

function ordenarPorNombre(raw) {
  return Object.entries(raw)
    .map(([ruta, sql]) => ({ nombre: ruta.split('/').pop(), sql }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

// Catálogo base (usuarios, productos, tipos_precio): idempotente vía INSERT OR
// IGNORE, se corre en cada arranque igual que las migraciones. Los precios los
// carga el operario desde la pantalla de Precios.
export function runSeeds() {
  const db = getDb()
  for (const { nombre, sql } of ordenarPorNombre(catalogoRaw)) {
    db.exec(sql)
    console.log(`[db] seed aplicado: ${nombre}`)
  }
}

// Datos ficticios para desarrollo/pruebas: NO es idempotente, pensado para
// correr una sola vez sobre una base vacía. Solo se activa explícitamente
// (ver main/index.js) con SEED_DEMO=1; nunca debe usarse en producción.
export function runDevSeeds() {
  const db = getDb()
  for (const { nombre, sql } of ordenarPorNombre(demoRaw)) {
    try {
      db.exec(sql)
      console.log(`[db] seed de desarrollo aplicado: ${nombre}`)
    } catch (e) {
      console.error(`[db] seed de desarrollo FALLIDO: ${nombre} - ${e.message}`)
    }
  }
}
