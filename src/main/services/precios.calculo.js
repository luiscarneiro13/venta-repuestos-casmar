// Única fuente del cálculo de precios (ver Docs/plan-precios-margenes-tasas.md).
//
// El margen es MARKUP sobre el costo: 100% = vender al doble. Hay un margen
// por método de pago: `margen` (Bs) y `margenUsdt` (USDT/divisas); si
// margenUsdt es null/undefined se usa el de Bs — con % iguales los precios
// son idénticos al modelo anterior.
//   precioUsd  = round2(costo × (1 + margen/100))
//   precioBs   = round2(precioUsd × tasaBcv)              // canónico
//   baseUsdt   = round2(costo × (1 + margenUsdt/100))     // base en $ propia
//   precioUsdt = round2(round2(baseUsdt × tasaBcv) / tasaUsdt)
//
// Nada se re-redondea después: los subtotales salen del unitario redondeado
// multiplicado por la cantidad, y el total es la suma de subtotales.

export function redondear2(n) {
  return Math.round(n * 100) / 100
}

// Devuelve { precioUsd, precioBs, precioUsdt }. Si no hay tasas vigentes,
// precioBs y precioUsdt quedan en null (los precios en $ no dependen de la
// tasa). El Bs intermedio del USDT se redondea como el Bs canónico, así con
// margenUsdt = margen el resultado es exactamente round2(precioBs / tasaUsdt).
export function calcularPrecios(costoUsd, margen, margenUsdt, tasaBcv, tasaUsdt) {
  const costo = Number(costoUsd)
  const m = Number(margen)
  const mUsdt = margenUsdt == null ? m : Number(margenUsdt)
  const precioUsd = redondear2(costo * (1 + m / 100))
  const baseUsdt = redondear2(costo * (1 + mUsdt / 100))
  const bcv = Number(tasaBcv)
  const usdt = Number(tasaUsdt)
  if (!Number.isFinite(bcv) || bcv <= 0 || !Number.isFinite(usdt) || usdt <= 0) {
    return { precioUsd, precioBs: null, precioUsdt: null }
  }
  const precioBs = redondear2(precioUsd * bcv)
  return { precioUsd, precioBs, precioUsdt: redondear2(redondear2(baseUsdt * bcv) / usdt) }
}
