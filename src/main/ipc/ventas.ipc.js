import { registrar } from './registro.js'
import { conPermiso } from './permisos.js'
import * as ventasService from '../services/ventas.service.js'

export function registerVentasIpc() {
  registrar('ventas:listar', () => ventasService.listarVentas())
  registrar('ventas:listarHoy', () => ventasService.listarVentasDeHoy())
  registrar('ventas:totalesProductosHoy', () => ventasService.totalesProductosHoy())
  registrar('ventas:listarConFiltros', (_event, filtros) => ventasService.listarVentasConFiltros(filtros))
  registrar('ventas:graficoVentasTotales', (_event, periodo, desde, hasta) =>
    ventasService.graficoVentasTotales(periodo, desde, hasta)
  )
  registrar('ventas:crear', conPermiso('ventas.crear', (_event, venta) => ventasService.crearVenta(venta)))
  registrar('ventas:detalle', (_event, id) => ventasService.obtenerVentaConDetalle(id))
  registrar('ventas:anular', conPermiso('ventas.anular', (_event, id, motivo, usuarioId) => ventasService.anularVenta(id, motivo, usuarioId)))
}
