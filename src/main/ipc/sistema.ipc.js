import { conPermiso } from './permisos.js'
import { app, dialog, BrowserWindow } from '../electron-safe.js'
import { registrar } from './registro.js'
import { reiniciarBaseDeDatos, backupDb, getDbPath } from '../db/connection.js'
import { verificarPasswordAdmin } from '../services/usuarios.service.js'

export function registerSistemaIpc() {
  registrar('sistema:version', () => app.getVersion())

  registrar('sistema:verificarAdmin', (_event, password) => verificarPasswordAdmin(password))

  // Reinicio desde cero: borra lo operativo y conserva categorías,
  // usuarios, roles, tipos de precio y configuración.
  registrar('sistema:reiniciarBaseDatos', conPermiso('configuracion.gestionar', () => {
    try {
      reiniciarBaseDeDatos()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error.message || 'No se pudo reiniciar la base de datos' }
    }
  }))

  // Abre el diálogo "Guardar como" para que el usuario elija dónde guardar el
  // backup de la BD. El nombre por defecto incluye la fecha. Devuelve
  // { ok, ruta } o { ok: false, error }.
  registrar('sistema:exportarBackup', conPermiso('configuracion.gestionar', async () => {
    try {
      const fecha = new Date().toISOString().slice(0, 10)
      const ventana = BrowserWindow.getFocusedWindow()
      const resultado = await dialog.showSaveDialog(ventana, {
        title: 'Guardar copia de seguridad',
        defaultPath: `venta-repuestos-backup-${fecha}.db`,
        filters: [{ name: 'Base de datos SQLite', extensions: ['db'] }],
        properties: ['createDirectory']
      })

      if (resultado.canceled || !resultado.filePath) {
        return { ok: false, cancelado: true }
      }

      backupDb(resultado.filePath)
      return { ok: true, ruta: resultado.filePath }
    } catch (error) {
      return { ok: false, error: error.message || 'No se pudo exportar el backup' }
    }
  }))

  // Devuelve la ruta de la carpeta donde está la BD (para mostrar al usuario
  // dónde debe colocar el archivo para restaurarlo).
  registrar('sistema:rutaBaseDatos', () => {
    try {
      return { ok: true, ruta: getDbPath() }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })
}
