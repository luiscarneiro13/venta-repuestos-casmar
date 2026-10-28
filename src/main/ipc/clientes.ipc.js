import { registrar } from './registro.js'
import { conPermiso } from './permisos.js'
import * as clientesService from '../services/clientes.service.js'

export function registerClientesIpc() {
  registrar('clientes:listar', () => clientesService.listarClientes())
  registrar('clientes:listarConConsumo', () => clientesService.listarClientesConConsumo())
  registrar('clientes:consumoDiario', (_event, clienteId, periodo, desde, hasta) =>
    clientesService.consumoDiarioCliente(clienteId, periodo, desde, hasta)
  )
  registrar('clientes:historial', (_event, clienteId, desde, hasta) =>
    clientesService.historialCliente(clienteId, desde, hasta)
  )
  registrar('clientes:crear', conPermiso('clientes.gestionar', (_event, cliente) => clientesService.crearCliente(cliente)))
  registrar('clientes:actualizar', conPermiso('clientes.gestionar', (_event, id, cliente) =>
    clientesService.actualizarCliente(id, cliente)))
}
