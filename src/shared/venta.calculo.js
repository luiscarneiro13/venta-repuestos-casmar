// Única fuente del cálculo de montos de una venta con IVA. La usan, sin
// copias: la pantalla de venta (cards, carrito, vista previa) y el backend
// (ventas.service.crearVenta), que guarda lo que imprime la factura. Así la
// pantalla y la factura no pueden diferir ni en un céntimo.
//
// Regla: el IVA se calcula POR UNIDAD y por moneda, sobre el precio base
// (sin IVA) ya redondeado:
//   ivaUnitario      = r2(base × iva%)
//   unitarioConIva   = r2(base + ivaUnitario)        ← precio que se le da al cliente
//   subtotal (línea) = r2(base × cantidad)           ← lo que imprime la factura
//   iva (línea)      = r2(ivaUnitario × cantidad)
//   total (línea)    = r2(subtotal + iva)            ← = unitarioConIva × cantidad
// Totales de la venta = suma de las líneas (subtotal, IVA y total).

export const MONEDAS = ['usd', 'bs', 'usdt']

export function r2(n) {
  return Math.round(n * 100) / 100
}

const porMoneda = (fn) => Object.fromEntries(MONEDAS.map((m) => [m, fn(m)]))

// `precio` trae los unitarios base: { precioUsd, precioBs, precioUsdt }.
// Una moneda sin valor (sin tasa vigente) queda en null en todos los campos.
export function calcularLinea(precio, cantidad, ivaPorcentaje) {
  const q = Number(cantidad) || 0
  const pct = Number(ivaPorcentaje) || 0
  const base = { usd: precio?.precioUsd, bs: precio?.precioBs, usdt: precio?.precioUsdt }
  const valido = (m) => base[m] != null && Number.isFinite(Number(base[m]))

  const unitario = porMoneda((m) => (valido(m) ? Number(base[m]) : null))
  const ivaUnitario = porMoneda((m) => (valido(m) ? r2(unitario[m] * pct / 100) : null))
  const unitarioConIva = porMoneda((m) => (valido(m) ? r2(unitario[m] + ivaUnitario[m]) : null))
  const subtotal = porMoneda((m) => (valido(m) ? r2(unitario[m] * q) : null))
  const iva = porMoneda((m) => (valido(m) ? r2(ivaUnitario[m] * q) : null))
  const total = porMoneda((m) => (valido(m) ? r2(subtotal[m] + iva[m]) : null))

  return { cantidad: q, unitario, ivaUnitario, unitarioConIva, subtotal, iva, total }
}

// Suma las líneas ya calculadas. Si alguna línea no tiene valor en una
// moneda, el total de esa moneda queda en null (no se muestra un total falso).
export function calcularTotales(lineas) {
  const sumar = (campo, m) =>
    lineas.some((l) => l[campo][m] == null) ? null : r2(lineas.reduce((s, l) => s + l[campo][m], 0))
  const subtotal = porMoneda((m) => sumar('subtotal', m))
  const iva = porMoneda((m) => sumar('iva', m))
  const total = porMoneda((m) => (subtotal[m] == null || iva[m] == null ? null : r2(subtotal[m] + iva[m])))
  return { subtotal, iva, total }
}
