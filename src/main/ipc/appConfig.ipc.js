import { app } from '../electron-safe.js'
import { registrar } from './registro.js'
import { conPermiso } from './permisos.js'
import { obtenerConfig, guardarConfig } from '../config.js'
import { probarConexion } from '../client/proxy.js'

// Config de red por equipo (Principal/Esclavo + IP/puerto). Es LOCAL en cada
// PC: no se proxea al servidor. Cambiar el modo exige reiniciar la app.
export function registerAppConfigIpc() {
  registrar('appConfig:obtener', () => {
    const cfg = obtenerConfig()
    return { modo: cfg.modo, servidor: cfg.servidor, puerto: cfg.puerto }
  })

  registrar('appConfig:guardar', conPermiso('configuracion.gestionar', (_event, datos) =>
    guardarConfig({ modo: datos?.modo, servidor: datos?.servidor ?? null, puerto: datos?.puerto })
  ))

  registrar('appConfig:probar', (_event, datos) => probarConexion(datos ?? {}))

  registrar('appConfig:reiniciar', () => {
    app.relaunch()
    app.exit(0)
  })
}
