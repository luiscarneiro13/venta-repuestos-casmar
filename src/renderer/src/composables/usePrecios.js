// Cálculo de precios de venta en el renderer: replica la función única del
// backend (ver Docs/plan-precios-margenes-tasas.md, anexo) para la vista
// previa en vivo de la entrada de mercancía y la edición de márgenes.
//
//   precio_$   = costo × (1 + %Bs)            — markup sobre el costo
//   precio_Bs  = precio_$ × tasa BCV          — canónico
//   base_USDT  = costo × (1 + %USDT)          — margen propio del método
//   precioUSDT = base_USDT × tasa BCV ÷ tasa Binance
//
// %USDT null/undefined = mismo % de Bs (los precios no cambian).

export function r2(n) {
  return Math.round(n * 100) / 100
}

// Sin tasa vigente el precio en esa moneda queda null (la UI muestra «—»).
export function calcularPrecios(costoUsd, margen, margenUsdt, tasaBcv, tasaUsdt) {
  const costo = Number(costoUsd) || 0
  const m = Number(margen) || 0
  const mUsdt = margenUsdt == null ? m : Number(margenUsdt) || 0
  const precioUsd = r2(costo * (1 + m / 100))
  const baseUsdt = r2(costo * (1 + mUsdt / 100))
  const bcv = Number(tasaBcv) || 0
  const usdt = Number(tasaUsdt) || 0
  const precioBs = bcv > 0 ? r2(precioUsd * bcv) : null
  const precioUsdt = bcv > 0 && usdt > 0 ? r2(r2(baseUsdt * bcv) / usdt) : null
  return { precioUsd, precioBs, precioUsdt }
}

// Parsea un % escrito por el usuario: admite coma o punto decimal y
// devuelve 0 cuando el texto no es un número válido.
export function parseMargen(texto) {
  const v = Number(String(texto ?? '').trim().replace(',', '.'))
  return Number.isFinite(v) && v >= 0 ? v : 0
}
