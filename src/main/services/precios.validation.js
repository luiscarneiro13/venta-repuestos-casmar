// Normaliza la tabla de márgenes que llega de la entrada de mercancía o del
// editor de producto: [{ tipoPrecioId, margen, margenUsdt? }]. `margen` es el
// % de markup sobre el costo del precio en Bs y `margenUsdt` el del precio en
// divisas (opcional: si no viene, copia el de Bs — payloads de un solo %
// conservan el comportamiento anterior). Devuelve null si no vino la lista
// (la entrada mínima sin márgenes sigue siendo válida).
export function normalizarMargenes(margenes) {
  if (margenes === undefined || margenes === null) return null
  if (!Array.isArray(margenes)) {
    throw new Error('Los márgenes deben ser una lista de { tipoPrecioId, margen }')
  }
  const vistos = new Set()
  return margenes.map((m) => {
    const tipoPrecioId = Number(m.tipoPrecioId)
    const margen = Number(m.margen)
    const margenUsdt = m.margenUsdt === undefined || m.margenUsdt === null ? null : Number(m.margenUsdt)
    if (!Number.isInteger(tipoPrecioId) || tipoPrecioId <= 0) throw new Error('Margen sin tipo de precio')
    if (vistos.has(tipoPrecioId)) throw new Error('Hay un tipo de precio repetido en los márgenes')
    if (!Number.isFinite(margen) || margen < 0) throw new Error('Cada margen debe ser un número mayor o igual a 0')
    if (margenUsdt != null && (!Number.isFinite(margenUsdt) || margenUsdt < 0)) {
      throw new Error('Cada margen debe ser un número mayor o igual a 0')
    }
    vistos.add(tipoPrecioId)
    return { tipoPrecioId, margen, margenUsdt }
  })
}

// Se comparte entre el alta de productos y el registro de entradas.
// LEGADO: modelo anterior de precios fijos; las entradas nuevas usan
// normalizarMargenes (los precios nacen del costo × margen).
export function normalizarPrecios(precios) {
  if (!Array.isArray(precios) || precios.length === 0) {
    throw new Error('El producto debe tener al menos un precio de venta')
  }
  const vistos = new Set()
  return precios.map((p) => {
    const tipoPrecioId = Number(p.tipoPrecioId)
    const valorUsd = Number(p.valorUsd)
    if (!Number.isInteger(tipoPrecioId) || tipoPrecioId <= 0) throw new Error('Precio sin tipo de precio')
    if (vistos.has(tipoPrecioId)) throw new Error('Hay un tipo de precio repetido')
    if (!Number.isFinite(valorUsd) || valorUsd <= 0) throw new Error('Cada precio debe ser mayor a 0')
    vistos.add(tipoPrecioId)
    return { tipoPrecioId, valorUsd, descripcion: (p.descripcion || '').trim() }
  })
}
