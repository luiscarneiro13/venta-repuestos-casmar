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

// `precio` trae los unitarios materializados: { precioUsd, precioBs, precioUsdt }.
// Una moneda sin valor (sin tasa vigente) queda en null en todos los campos.
//
// `ivaIncluido` = el costo de compra ya traía el IVA (productos.costo_con_iva):
// el precio materializado ES el precio con IVA. En vez de sumar el impuesto,
// la base y el IVA se desglosan hacia atrás por unidad:
//   unitarioConIva = precio materializado
//   unitario (base) = r2(conIva ÷ (1 + iva%))
//   ivaUnitario     = r2(conIva − base)        ← base + iva = precio exacto
// Así la factura muestra sus líneas sin IVA y el impuesto al final, y el
// total coincide al céntimo con lo que se cobró.
export function calcularLinea(precio, cantidad, ivaPorcentaje, ivaIncluido = false) {
  const q = Number(cantidad) || 0
  const pct = Number(ivaPorcentaje) || 0
  const base = { usd: precio?.precioUsd, bs: precio?.precioBs, usdt: precio?.precioUsdt }
  const valido = (m) => base[m] != null && Number.isFinite(Number(base[m]))
  const incluido = ivaIncluido && pct > 0

  // Con IVA incluido, `precioMaterializado` ES el precio con IVA y la base
  // se deriva; sin él, la base es el precio y el con-IVA se construye.
  const precioMaterializado = porMoneda((m) => (valido(m) ? Number(base[m]) : null))
  const unitario = porMoneda((m) =>
    !valido(m) ? null : incluido ? r2(precioMaterializado[m] / (1 + pct / 100)) : precioMaterializado[m]
  )
  const ivaUnitario = porMoneda((m) =>
    !valido(m) ? null : incluido ? r2(precioMaterializado[m] - unitario[m]) : r2(unitario[m] * pct / 100)
  )
  const unitarioConIva = porMoneda((m) =>
    !valido(m) ? null : incluido ? precioMaterializado[m] : r2(unitario[m] + ivaUnitario[m])
  )
  const subtotal = porMoneda((m) => (valido(m) ? r2(unitario[m] * q) : null))
  const iva = porMoneda((m) => (valido(m) ? r2(ivaUnitario[m] * q) : null))
  const total = porMoneda((m) => (valido(m) ? r2(subtotal[m] + iva[m]) : null))

  return { cantidad: q, unitario, ivaUnitario, unitarioConIva, subtotal, iva, total }
}

// Precio unitario CON IVA por moneda, lo que se le dice al cliente:
// - costo sin IVA  → base + IVA (el impuesto se suma encima)
// - costo con IVA  → el precio materializado tal cual (ya lo trae embebido)
// Lo usan la pantalla de venta (todo se muestra con IVA) y la nota de
// entrega, que cobra estos montos sin desglosar el impuesto.
export function precioUnitarioConIva(precio, ivaPorcentaje, ivaIncluido = false) {
  const l = calcularLinea(precio, 1, ivaPorcentaje, ivaIncluido)
  return { precioUsd: l.unitarioConIva.usd, precioBs: l.unitarioConIva.bs, precioUsdt: l.unitarioConIva.usdt }
}

// Precio unitario SIN IVA por moneda (la base):
// - costo sin IVA  → el precio materializado tal cual
// - costo con IVA  → se le quita el IVA embebido (precio ÷ (1 + iva%))
// Lo usa la nota de entrega "sin IVA", que cobra la base sin impuesto.
export function precioUnitarioSinIva(precio, ivaPorcentaje, ivaIncluido = false) {
  const l = calcularLinea(precio, 1, ivaPorcentaje, ivaIncluido)
  return { precioUsd: l.unitario.usd, precioBs: l.unitario.bs, precioUsdt: l.unitario.usdt }
}

// Línea de una NOTA DE ENTREGA: nunca desglosa IVA (se calcula con 0%).
// `conIva` decide qué precio cobra: el final con IVA embebido o la base.
export function calcularLineaNota(precio, cantidad, ivaPorcentaje, ivaIncluido = false, conIva = true) {
  const unitario = conIva
    ? precioUnitarioConIva(precio, ivaPorcentaje, ivaIncluido)
    : precioUnitarioSinIva(precio, ivaPorcentaje, ivaIncluido)
  return calcularLinea(unitario, cantidad, 0)
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
