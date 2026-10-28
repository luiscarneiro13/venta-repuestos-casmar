import * as tasasRepo from '../repositories/tasas.repo.js'

export function obtenerTasaDeHoy() {
  return tasasRepo.obtenerTasaDeHoy()
}

export function obtenerUltimaTasa() {
  return tasasRepo.obtenerUltimaTasa()
}

function tasaPositiva(valor, nombre) {
  const num = Number(valor)
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`La tasa ${nombre} debe ser un número mayor a 0`)
  }
  return num
}

// La tasa puede cambiar varias veces en el mismo día: cada cambio se guarda
// como una fila nueva (histórico auditable) y la vigente es la última.
// Recibe las dos tasas operativas: BCV (Bs/USD) y USDT Binance (Bs/USDT).
// Compatibilidad: si llega el payload viejo { valor }, ese valor aplica a ambas.
export function registrarTasa({ valorBcv, valorUsdt, valor, usuarioId }) {
  const bcv = tasaPositiva(valorBcv ?? valor, 'BCV')
  const usdt = tasaPositiva(valorUsdt ?? valor, 'USDT')
  if (!usuarioId) {
    throw new Error('Se requiere el usuario que registra la tasa')
  }

  // Si ambos valores son los mismos que los de la tasa vigente no se registra
  // otra fila, para que el histórico refleje cambios reales y no reconfirmaciones.
  const vigente = tasasRepo.obtenerTasaDeHoy()
  if (
    vigente &&
    Math.abs((vigente.valor_bcv ?? vigente.valor) - bcv) < 0.001 &&
    Math.abs((vigente.valor_usdt ?? vigente.valor) - usdt) < 0.001
  ) {
    return vigente
  }

  return tasasRepo.crear({ valorBcv: bcv, valorUsdt: usdt, usuarioId })
}
