import { registrar } from './registro.js'
import * as tasasService from '../services/tasas.service.js'

export function registerTasasIpc() {
  registrar('tasas:obtenerHoy', () => tasasService.obtenerTasaDeHoy())
  registrar('tasas:obtenerUltima', () => tasasService.obtenerUltimaTasa())
  registrar('tasas:registrar', (_event, datos) => tasasService.registrarTasa(datos))
}
