import * as clientesRepo from '../repositories/clientes.repo.js'

function traducirErrorSqlite(error) {
  if (/UNIQUE constraint failed: clientes\.numero_documento/.test(error.message)) {
    return new Error('Ya existe un cliente con ese documento')
  }
  return error
}

export function listarClientes() {
  return clientesRepo.listar()
}

export function listarClientesConConsumo() {
  return clientesRepo.listarConConsumo()
}

export function consumoDiarioCliente(clienteId, periodo, desde, hasta) {
  return clientesRepo.consumoDiarioPorCliente(clienteId, periodo, desde, hasta)
}

export function historialCliente(clienteId, desde, hasta) {
  return clientesRepo.historialPorCliente(clienteId, desde, hasta)
}

export function crearCliente({ nombre, tipoDoc, doc, tel, direccion }) {
  const nombreLimpio = (nombre || '').trim()
  if (!nombreLimpio) {
    throw new Error('El nombre del cliente es obligatorio')
  }

  const datos = {
    nombre: nombreLimpio,
    tipoDoc: tipoDoc || 'V',
    doc: (doc || '').trim() || null,
    tel: (tel || '').trim() || null,
    direccion: (direccion || '').trim() || 'EL TIGRE'
  }

  try {
    return clientesRepo.crear(datos)
  } catch (error) {
    throw traducirErrorSqlite(error)
  }
}

export function actualizarCliente(id, { nombre, tipoDoc, doc, tel, direccion }) {
  const nombreLimpio = (nombre || '').trim()
  if (!nombreLimpio) {
    throw new Error('El nombre del cliente es obligatorio')
  }

  const datos = {
    nombre: nombreLimpio,
    tipoDoc: tipoDoc || 'V',
    doc: (doc || '').trim() || null,
    tel: (tel || '').trim() || null,
    direccion: (direccion || '').trim() || 'EL TIGRE'
  }

  try {
    return clientesRepo.actualizar(id, datos)
  } catch (error) {
    throw traducirErrorSqlite(error)
  }
}
