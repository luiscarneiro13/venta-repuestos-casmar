import * as cajaRepo from '../repositories/caja.repo.js'
import * as ventasRepo from '../repositories/ventas.repo.js'

function esDeHoy(fechaHoraLocal) {
  const hoy = new Date()
  const hoyTexto = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  return (fechaHoraLocal || '').slice(0, 10) === hoyTexto
}

export function listarAbiertas() {
  return cajaRepo.listarAbiertas()
}

// Lee el par de tasas del payload. `base` es 'tasaApertura' o 'tasaCierre'
// (BCV); el USDT llega como `${base}Usdt`. También acepta los nombres del
// modal de tasas (valorBcv/valorUsdt) como alias, y si solo llega una tasa
// (payload viejo de un solo valor) esa aplica a ambas.
function leerTasas(datos, base) {
  const bcv = Number(datos[base] ?? datos.valorBcv)
  const usdt = Number(datos[`${base}Usdt`] ?? datos.valorUsdt ?? datos[base] ?? datos.valorBcv)
  return validarTasas(bcv, usdt)
}

function validarTasas(bcv, usdt) {
  const bcvNum = Number(bcv)
  const usdtNum = Number(usdt)
  if (!Number.isFinite(bcvNum) || bcvNum <= 0) {
    throw new Error('La tasa BCV del día debe ser mayor a 0')
  }
  if (!Number.isFinite(usdtNum) || usdtNum <= 0) {
    throw new Error('La tasa USDT del día debe ser mayor a 0')
  }
  return { bcv: bcvNum, usdt: usdtNum }
}

// Se llama al iniciar sesión. Si el usuario (o cualquier otro) ya abrió la
// caja de hoy, no crea una nueva: la reutiliza. Cualquier caja abierta de
// un día anterior que siga sin cerrarse se reporta aparte, para avisar que
// falta cerrarla.
export function abrirCajaDelDia({ usuarioId, ...datos }) {
  if (!usuarioId) {
    throw new Error('Falta el usuario que abre la caja')
  }
  const { bcv, usdt } = leerTasas(datos, 'tasaApertura')

  const abiertas = cajaRepo.listarAbiertas()
  const cajaHoyExistente = abiertas.find((c) => esDeHoy(c.abierta_en))
  const cajasPendientes = abiertas.filter((c) => !esDeHoy(c.abierta_en))

  const cajaHoy = cajaHoyExistente || cajaRepo.abrir({ usuarioId, tasaApertura: bcv, tasaAperturaUsdt: usdt })
  return { cajaHoy, cajasPendientes }
}

function calcularTotales(desdeLocal) {
  const ventas = ventasRepo.listarActivasDesde(desdeLocal)
  return {
    contadoUsd: ventas.reduce((s, v) => s + v.total_usd, 0),
    contadoBs: ventas.reduce((s, v) => s + v.total_bs, 0)
  }
}

export function obtenerResumenParaCierre(cajaId) {
  const caja = cajaRepo.buscarPorId(cajaId)
  if (!caja) {
    throw new Error('La caja no existe')
  }
  if (caja.estado === 'cerrada') {
    throw new Error('Esta caja ya está cerrada')
  }
  const totales = calcularTotales(caja.abierta_en)
  return { caja, totales }
}

export function cerrarCaja({ cajaId, usuarioCierreId, ...datos }) {
  if (!usuarioCierreId) {
    throw new Error('Falta el usuario que cierra la caja')
  }

  const caja = cajaRepo.buscarPorId(cajaId)
  if (!caja) {
    throw new Error('La caja no existe')
  }
  if (caja.estado === 'cerrada') {
    throw new Error('Esta caja ya está cerrada')
  }

  // Al cerrar una caja de un día anterior, la tasa que corresponde es la de
  // su propia apertura, no la de hoy: si el payload no trae alguna de las dos
  // tasas se completa con la de apertura de esa caja.
  const { bcv, usdt } = validarTasas(
    datos.tasaCierre ?? datos.valorBcv ?? caja.tasa_apertura,
    datos.tasaCierreUsdt ?? datos.valorUsdt ?? caja.tasa_apertura_usdt ?? caja.tasa_apertura
  )

  const totales = calcularTotales(caja.abierta_en)
  return cajaRepo.cerrar(cajaId, { usuarioCierreId, tasaCierre: bcv, tasaCierreUsdt: usdt, totales })
}
