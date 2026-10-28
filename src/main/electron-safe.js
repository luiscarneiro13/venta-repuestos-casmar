import { createRequire } from 'node:module'

// Importa electron sin romper fuera de la app: en tests con node:test el
// paquete npm "electron" es CommonJS y exporta solo la ruta del binario
// (string), así que `import { app } from 'electron'` falla. Acá queda en
// undefined y solo se usa dentro de la app real.
const require = createRequire(import.meta.url)
let electron = {}
try {
  electron = require('electron')
  if (typeof electron !== 'object' || electron === null) electron = {}
} catch {
  electron = {}
}

export const { app, ipcMain, dialog, BrowserWindow, nativeImage, shell } = electron
