import Database from 'better-sqlite3'
import { join } from 'node:path'
import { mkdirSync, copyFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// `electron` solo se puede importar como módulo dentro de la app; en los
// tests con node:test el paquete npm "electron" resuelve a la ruta del
// binario, así que `app` queda en null y la BD se inyecta con setDbPath().
const require = createRequire(import.meta.url)
let app = null
try {
  app = require('electron').app ?? null
} catch {
  app = null
}

let db = null
let dbPath = null

// Apunta el singleton a otra base de datos (ruta de archivo o ':memory:').
// Solo se usa desde los tests: la app nunca la llama, getDb() abre la BD en
// userData la primera vez.
export function setDbPath(ruta) {
  if (db) {
    db.close()
    db = null
  }
  dbPath = ruta
  db = new Database(ruta)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

export function getDb() {
  if (db) return db
  if (!app) {
    throw new Error('La base de datos no está inicializada (fuera de Electron usar setDbPath)')
  }

  const dbDir = app.getPath('userData')
  mkdirSync(dbDir, { recursive: true })
  dbPath = join(dbDir, 'venta-repuestos.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  return db
}

// Devuelve la ruta del archivo de la base de datos.
export function getDbPath() {
  if (!dbPath) getDb()
  return dbPath
}

// Hace un backup de la BD usando el backup API de better-sqlite3, que
// garantiza una copia consistente sin bloquear la BD. `destino` es la ruta
// completa donde se guardará el archivo .db.
export function backupDb(destino) {
  const db = getDb()
  db.backup(destino)
}

// Borra todas las ventas y datos asociados (detalle, movimientos de
// inventario, cajas, tasas) sin tocar usuarios, clientes, productos, precios
// ni configuración. Se ejecuta dentro de una transacción para que sea
// atómica.
// Reinicia la base de datos "desde cero": borra solo la actividad del negocio
// (ventas con su detalle, cajas, cierres de caja y tasas de cambio).
// NO toca el catálogo ni la estructura de trabajo: productos (con sus precios
// y movimientos de inventario), clientes, proveedores, categorías de productos
// y de proveedores, usuarios, roles, tipos de precio ni la configuración
// (IVA, impresora).
const TABLAS_OPERATIVAS = [
  'venta_detalle',
  'ventas',
  'cajas',
  'cierres_caja',
  'tasas_cambio'
]

export function reiniciarBaseDeDatos() {
  const db = getDb()
  db.pragma('foreign_keys = OFF')
  try {
    db.transaction(() => {
      for (const tabla of TABLAS_OPERATIVAS) {
        db.exec(`DELETE FROM ${tabla}; DELETE FROM sqlite_sequence WHERE name = '${tabla}'`)
      }
      // Los movimientos se conservan pero sus ventas ya no existen: se suelta
      // la referencia (el motivo "Anulación T-XXXX" queda como texto igual).
      db.exec('UPDATE inventario_movimientos SET venta_id = NULL WHERE venta_id IS NOT NULL')
    })()
  } finally {
    db.pragma('foreign_keys = ON')
  }
}
