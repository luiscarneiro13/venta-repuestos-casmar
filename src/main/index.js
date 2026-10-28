import { app, shell, BrowserWindow, nativeImage } from 'electron'
import { join } from 'node:path'
import { runMigrations } from './db/migrate.js'
import { runSeeds, runDevSeeds } from './db/seed.js'
import { registrarCanales } from './ipc/index.js'
import { instalarIpc } from './ipc/registro.js'
import { obtenerConfig, esCliente } from './config.js'
import { iniciarApiServidor } from './server/api.server.js'
import { prepararModoCliente } from './client/local.ipc.js'

const isDev = !app.isPackaged

function createWindow() {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) console.error(`[app] No se pudo cargar el icono: ${iconPath}`)
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  if (process.platform === 'linux' && !icon.isEmpty()) mainWindow.setIcon(icon)

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.ventarepuestos.pos')

  // Mismo registro de canales en los dos modos: en el servidor se usan tal
  // cual (IPC local + API HTTP); en el esclavo se sustituyen por el proxy,
  // salvo los locales (auth, impresora, config de red). El esclavo no abre
  // ninguna BD local: no corre migraciones ni seeds.
  const cfg = obtenerConfig()
  registrarCanales()

  if (esCliente()) {
    prepararModoCliente()
  } else {
    runMigrations()
    runSeeds()
    if (process.env.SEED_DEMO === '1') runDevSeeds()
    iniciarApiServidor({ puerto: cfg.puerto, version: app.getVersion() })
  }

  instalarIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
