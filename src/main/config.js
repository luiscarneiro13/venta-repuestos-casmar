import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

// Configuración de red por equipo, en `app-config.json` dentro de userData.
// modo: 'servidor' (el principal, dueño de la BD, expone la API) o 'cliente'
// (el esclavo, todo lo que no sea impresora/config local va por HTTP).
// La impresora es de cada PC: el cliente la guarda aquí, el servidor en la BD.
const require = createRequire(import.meta.url)
let app = null
try {
  app = require('electron').app ?? null
} catch {
  app = null
}

const POR_DEFECTO = {
  modo: 'servidor',
  puerto: 8530,
  servidor: null,
  impresora: { nombre: null, ancho: '80mm' }
}

let rutaConfig = null
let cache = null

// Solo para tests: apunta el archivo de config a otra ruta (o null para
// volver al comportamiento normal).
export function setRutaConfig(ruta) {
  rutaConfig = ruta
  cache = null
}

function ruta() {
  if (rutaConfig) return rutaConfig
  if (!app) {
    throw new Error('La configuración no está inicializada (fuera de Electron usar setRutaConfig)')
  }
  rutaConfig = join(app.getPath('userData'), 'app-config.json')
  return rutaConfig
}

export function obtenerConfig() {
  if (cache) return cache
  let leida = {}
  try {
    leida = JSON.parse(readFileSync(ruta(), 'utf8'))
  } catch {
    // Fuera de Electron (tests sin setRutaConfig) o archivo inexistente:
    // valores por defecto = modo servidor.
    leida = {}
  }
  cache = {
    ...POR_DEFECTO,
    ...leida,
    impresora: { ...POR_DEFECTO.impresora, ...(leida.impresora ?? {}) }
  }
  return cache
}

export function guardarConfig(cambios) {
  const actual = obtenerConfig()
  const siguiente = {
    ...actual,
    ...cambios,
    impresora: { ...actual.impresora, ...(cambios.impresora ?? {}) }
  }
  if (!['servidor', 'cliente'].includes(siguiente.modo)) {
    throw new Error('El modo debe ser "servidor" o "cliente"')
  }
  if (siguiente.modo === 'cliente' && !siguiente.servidor) {
    throw new Error('En modo esclavo debes indicar la IP del servidor')
  }
  const puerto = Number(siguiente.puerto)
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error('El puerto debe ser un número entre 1 y 65535')
  }
  siguiente.puerto = puerto
  mkdirSync(dirname(ruta()), { recursive: true })
  writeFileSync(ruta(), JSON.stringify(siguiente, null, 2), 'utf8')
  cache = siguiente
  return siguiente
}

export const esCliente = () => obtenerConfig().modo === 'cliente'

// URL base del servidor (solo en modo cliente).
export function urlServidor() {
  const cfg = obtenerConfig()
  if (!cfg.servidor) throw new Error('No hay IP del servidor configurada')
  return `http://${cfg.servidor}:${cfg.puerto}`
}
