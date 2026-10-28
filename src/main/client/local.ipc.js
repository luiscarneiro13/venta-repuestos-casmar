import { join } from 'node:path'
import { app } from '../electron-safe.js'
import { reemplazar, listarCanales } from '../ipc/registro.js'
import { conPermiso } from '../ipc/permisos.js'
import { obtenerConfig, guardarConfig } from '../config.js'
import { invocarRemoto, loginCliente, logoutCliente, usuarioCliente } from './proxy.js'
import {
  imprimirPruebaLocal,
  imprimirTicketsVentaLocal,
  previsualizarTicketVentaLocal,
  imprimirReporteZLocal
} from '../services/impresora.acciones.js'
import { esPlataformaSoportada, listarImpresorasDelSistema } from '../printer/ticket.printer.js'

// Canales que en el esclavo se ejecutan LOCALMENTE (no se proxean al
// servidor): auth (maneja el token), config de red (archivo local),
// impresora (winspool de esta PC) y datos del propio equipo.
const CANALES_LOCALES = new Set([
  'auth:login',
  'auth:logout',
  'auth:sesion',
  'appConfig:obtener',
  'appConfig:guardar',
  'appConfig:probar',
  'appConfig:reiniciar',
  'sistema:version',
  'sistema:rutaBaseDatos',
  'impresora:configuracion',
  'impresora:guardar',
  'impresora:listar',
  'impresora:probar',
  'impresora:imprimirVenta',
  'impresora:previsualizar',
  'impresora:imprimirReporteCierre',
  'impresora:imprimirReporteDiario'
])

const cfgImpresora = () => obtenerConfig().impresora

function registrarAuthLocal() {
  reemplazar('auth:login', (_event, credenciales) => loginCliente(credenciales))
  reemplazar('auth:logout', () => logoutCliente())
  reemplazar('auth:sesion', () => usuarioCliente())
}

function registrarImpresoraLocal() {
  reemplazar('impresora:configuracion', () => ({
    ...cfgImpresora(),
    plataformaSoportada: esPlataformaSoportada()
  }))

  reemplazar('impresora:guardar', conPermiso('configuracion.gestionar', (_event, { nombre, ancho } = {}) => {
    if (ancho && !['58mm', '80mm'].includes(ancho)) {
      throw new Error('El ancho de papel debe ser 58mm o 80mm')
    }
    const cfg = guardarConfig({
      impresora: { nombre: (nombre || '').trim() || null, ...(ancho ? { ancho } : {}) }
    })
    return { ...cfg.impresora, plataformaSoportada: esPlataformaSoportada() }
  }))

  reemplazar('impresora:listar', () => listarImpresorasDelSistema())
  reemplazar('impresora:probar', () => imprimirPruebaLocal(cfgImpresora()))

  reemplazar('impresora:imprimirVenta', async (_event, ventaId) => {
    const datos = await invocarRemoto('impresora:datosTicketVenta', [ventaId])
    if (!datos) return { ok: false, error: 'La venta no existe' }
    return imprimirTicketsVentaLocal(datos, cfgImpresora())
  })

  reemplazar('impresora:previsualizar', async (_event, ventaId) => {
    const datos = await invocarRemoto('impresora:datosTicketVenta', [ventaId])
    if (!datos) throw new Error('La venta no existe')
    return previsualizarTicketVentaLocal(datos, cfgImpresora().ancho)
  })

  reemplazar('impresora:imprimirReporteCierre', async (_event, cajaId, usuarioNombre) => {
    const datos = await invocarRemoto('impresora:datosReporteCierre', [cajaId])
    if (!datos) return { ok: false, error: 'La caja no existe' }
    return imprimirReporteZLocal(
      { ...datos, usuarioNombre, documento: `Reporte diario - Caja ${cajaId}` },
      cfgImpresora()
    )
  })

  reemplazar('impresora:imprimirReporteDiario', async (_event, fecha, usuarioNombre) => {
    const datos = await invocarRemoto('impresora:datosReporteDiario', [fecha])
    return imprimirReporteZLocal(
      { ...datos, usuarioNombre, documento: `Reporte diario - ${fecha}` },
      cfgImpresora()
    )
  })
}

function registrarSistemaLocal() {
  // La "ruta de datos" del esclavo sin abrir ninguna BD local.
  reemplazar('sistema:rutaBaseDatos', () => {
    try {
      return { ok: true, ruta: join(app.getPath('userData'), 'venta-repuestos.db') }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })
}

// En modo esclavo: todos los canales que no son locales pasan a ser un proxy
// HTTP al servidor, y los locales se reimplementan encima.
export function prepararModoCliente() {
  for (const canal of listarCanales()) {
    if (!CANALES_LOCALES.has(canal)) {
      reemplazar(canal, async (_event, ...args) => invocarRemoto(canal, args))
    }
  }
  registrarAuthLocal()
  registrarImpresoraLocal()
  registrarSistemaLocal()
}
