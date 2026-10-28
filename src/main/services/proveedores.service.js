import * as proveedoresRepo from '../repositories/proveedores.repo.js'

function normalizar({ nombre, documento, telefono, direccion }) {
  const nombreLimpio = String(nombre || '').trim()
  if (!nombreLimpio) throw new Error('El nombre del proveedor es obligatorio')
  return {
    nombre: nombreLimpio,
    documento: String(documento || '').trim().toUpperCase() || null,
    telefono: String(telefono || '').trim(),
    direccion: String(direccion || '').trim()
  }
}

function traducirError(error) {
  if (/UNIQUE constraint failed: proveedores\.nombre/.test(error.message)) {
    return new Error('Ya existe un proveedor con ese nombre')
  }
  if (/UNIQUE constraint failed: proveedores\.documento/.test(error.message)) {
    return new Error('Ya existe un proveedor con ese documento')
  }
  return error
}

export function listarProveedores(opciones) {
  return proveedoresRepo.listar(opciones)
}

export function crearProveedor(datos) {
  try {
    return proveedoresRepo.crear(normalizar(datos))
  } catch (error) {
    throw traducirError(error)
  }
}

export function actualizarProveedor(id, datos) {
  if (!proveedoresRepo.buscarPorId(id)) throw new Error('El proveedor no existe')
  try {
    return proveedoresRepo.actualizar(id, normalizar(datos))
  } catch (error) {
    throw traducirError(error)
  }
}

export function desactivarProveedor(id) {
  if (!proveedoresRepo.buscarPorId(id)) throw new Error('El proveedor no existe')
  return proveedoresRepo.cambiarActivo(id, false)
}

export function reactivarProveedor(id) {
  if (!proveedoresRepo.buscarPorId(id)) throw new Error('El proveedor no existe')
  return proveedoresRepo.cambiarActivo(id, true)
}
