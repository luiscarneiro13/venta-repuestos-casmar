import * as configuracionRepo from '../repositories/configuracion.repo.js'

const IVA_DEFAULT = 16

// Porcentaje de IVA que se suma al final de cada venta (total = base + IVA).
export function obtenerIva() {
  const numero = Number(configuracionRepo.obtener('iva_porcentaje'))
  return Number.isFinite(numero) && numero >= 0 ? numero : IVA_DEFAULT
}

export function guardarIva(porcentaje) {
  const numero = Number(porcentaje)
  if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
    throw new Error('El porcentaje de IVA debe ser un número entre 0 y 100')
  }
  configuracionRepo.guardar('iva_porcentaje', String(numero))
  return numero
}
