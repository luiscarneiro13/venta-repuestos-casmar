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

// Datos fiscales del negocio: se imprimen en el encabezado de las facturas,
// notas de entrega y reportes en hoja carta. Todos opcionales; si están
// vacíos el documento solo lleva el logo.
const CLAVES_NEGOCIO = {
  nombre: 'negocio_nombre',
  rif: 'negocio_rif',
  direccion: 'negocio_direccion',
  telefono: 'negocio_telefono'
}

export function obtenerNegocio() {
  return {
    nombre: configuracionRepo.obtener(CLAVES_NEGOCIO.nombre) || '',
    rif: configuracionRepo.obtener(CLAVES_NEGOCIO.rif) || '',
    direccion: configuracionRepo.obtener(CLAVES_NEGOCIO.direccion) || '',
    telefono: configuracionRepo.obtener(CLAVES_NEGOCIO.telefono) || ''
  }
}

export function guardarNegocio(datos = {}) {
  for (const campo of Object.keys(CLAVES_NEGOCIO)) {
    const valor = String(datos[campo] ?? '').trim()
    configuracionRepo.guardar(CLAVES_NEGOCIO[campo], valor || null)
  }
  return obtenerNegocio()
}
