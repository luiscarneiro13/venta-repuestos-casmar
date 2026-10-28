import { registrar } from './registro.js'
import { conPermiso } from './permisos.js'
import * as inventarioService from '../services/inventario.service.js'

export function registerInventarioIpc() {
  registrar('inventario:resumen', () => inventarioService.resumenInventario())
  registrar('inventario:reporte', () => inventarioService.datosReporteInventario())
  registrar('inventario:estadoProducto', (_event, productoId) => inventarioService.estadoProducto(productoId))
  registrar('inventario:listarMovimientos', () => inventarioService.listarMovimientosInventario())
  registrar('inventario:registrarEntrada', conPermiso('inventario.gestionar', (_event, datos) => inventarioService.registrarEntrada(datos)))
  registrar('inventario:registrarAjusteSalida', conPermiso('inventario.gestionar', (_event, datos) =>
    inventarioService.registrarAjusteSalida(datos)))
  registrar('inventario:editarMovimiento', conPermiso('inventario.gestionar', (_event, datos) =>
    inventarioService.editarMovimientoInventario(datos)))
  registrar('inventario:unidadesHoy', () => inventarioService.unidadesVendidasHoy())
}
