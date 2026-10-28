// Única fuente del cálculo de precios (ver Docs/plan-precios-margenes-tasas.md).
//
// El margen es MARKUP sobre el costo: 100% = vender al doble.
//   precioUsd  = round2(costo × (1 + margen/100))
//   precioBs   = round2(precioUsd × tasaBcv)     // canónico, igual en ambos pagos
//   precioUsdt = round2(precioBs / tasaUsdt)     // el redondeo lo absorbe el USDT
//
// Nada se re-redondea después: los subtotales salen del unitario redondeado
// multiplicado por la cantidad, y el total es la suma de subtotales.

export function redondear2(n) {
  return Math.round(n * 100) / 100
}

// Devuelve { precioUsd, precioBs, precioUsdt }. Si no hay tasas vigentes,
// precioBs y precioUsdt quedan en null (el precio en $ no depende de la tasa).
export function calcularPrecios(costoUsd, margen, tasaBcv, tasaUsdt) {
  const costo = Number(costoUsd)
  const m = Number(margen)
  const precioUsd = redondear2(costo * (1 + m / 100))
  const bcv = Number(tasaBcv)
  const usdt = Number(tasaUsdt)
  if (!Number.isFinite(bcv) || bcv <= 0 || !Number.isFinite(usdt) || usdt <= 0) {
    return { precioUsd, precioBs: null, precioUsdt: null }
  }
  const precioBs = redondear2(precioUsd * bcv)
  return { precioUsd, precioBs, precioUsdt: redondear2(precioBs / usdt) }
}
