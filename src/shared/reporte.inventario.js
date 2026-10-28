// Cálculo de los reportes de inventario (pantalla Indicadores → Reportes de
// inventario). Puro: recibe las filas de inventario.repo.reporteProductos y
// devuelve detalle, grupos y totales. Sin dependencias de Vue ni de la BD.
//
// Reportes:
//   tipo 'total'   → todos los productos activos (inventario total).
//   tipo 'minimos' → productos con mínimo configurado (> 0) y stock <= mínimo.
// agrupar: null | 'categoria' | 'proveedor' (proveedor = el de la última
// entrada de mercancía). filtroId limita a una categoría/proveedor concreto
// (0 = "Sin categoría" / "Sin proveedor").

export const r2 = (n) => Math.round(n * 100) / 100

export const SIN_GRUPO = 0

export const enMinimo = (p) => (p.stock_minimo ?? 0) > 0 && p.stock <= p.stock_minimo

function enriquecer(p, tasaBcv) {
  const costo = p.precio_compra_usd
  const faltante = Math.max(0, (p.stock_minimo ?? 0) - p.stock)
  const valorUsd = costo == null ? null : r2(Math.max(0, p.stock) * costo)
  const reposicionUsd = costo == null ? null : r2(faltante * costo)
  const aBs = (usd) => (usd == null || !(tasaBcv > 0) ? null : r2(usd * tasaBcv))
  return {
    ...p,
    costo_bs: aBs(costo),
    en_minimo: enMinimo(p),
    faltante,
    valor_usd: valorUsd,
    valor_bs: aBs(valorUsd),
    reposicion_usd: reposicionUsd,
    reposicion_bs: aBs(reposicionUsd)
  }
}

const claveGrupo = (p, agrupar) =>
  agrupar === 'categoria' ? (p.categoria_id ?? SIN_GRUPO) : (p.proveedor_id ?? SIN_GRUPO)

const nombreGrupo = (p, agrupar) =>
  agrupar === 'categoria' ? (p.categoria_nombre || 'Sin categoría') : (p.proveedor_nombre || 'Sin proveedor')

// Suma de una lista de productos ya enriquecidos. Los montos solo suman los
// productos con costo; `sin_costo` cuenta los que no tienen (para avisarlo).
export function totalizar(productos) {
  const sumar = (campo) => r2(productos.reduce((s, p) => s + (p[campo] ?? 0), 0))
  // Sin tasa vigente no hay Bs: el total queda en null (la UI muestra «—»)
  // en vez de un 0,00 que parecería un inventario sin valor.
  const sinTasa = productos.some((p) => p.valor_usd != null && p.valor_bs == null)
  const sumarBs = (campo) => (sinTasa ? null : sumar(campo))
  return {
    productos: productos.length,
    unidades: productos.reduce((s, p) => s + Math.max(0, p.stock), 0),
    en_minimo: productos.filter((p) => p.en_minimo).length,
    faltante: productos.reduce((s, p) => s + p.faltante, 0),
    valor_usd: sumar('valor_usd'),
    valor_bs: sumarBs('valor_bs'),
    reposicion_usd: sumar('reposicion_usd'),
    reposicion_bs: sumarBs('reposicion_bs'),
    sin_costo: productos.filter((p) => p.precio_compra_usd == null).length
  }
}

export function construirReporte(filas, { tipo = 'total', agrupar = null, filtroId = null, tasaBcv = null } = {}) {
  let detalle = filas.map((p) => enriquecer(p, tasaBcv))
  if (tipo === 'minimos') detalle = detalle.filter((p) => p.en_minimo)
  if (agrupar && filtroId != null) detalle = detalle.filter((p) => claveGrupo(p, agrupar) === filtroId)

  // Orden: en mínimos primero los de mayor faltante; en total, por nombre.
  detalle.sort((a, b) =>
    tipo === 'minimos' ? b.faltante - a.faltante || a.nombre.localeCompare(b.nombre) : a.nombre.localeCompare(b.nombre)
  )

  let grupos = []
  if (agrupar) {
    const mapa = new Map()
    for (const p of detalle) {
      const id = claveGrupo(p, agrupar)
      if (!mapa.has(id)) mapa.set(id, { id, nombre: nombreGrupo(p, agrupar), productos: [] })
      mapa.get(id).productos.push(p)
    }
    // Los grupos con nombre van alfabéticos; "Sin categoría/proveedor" al final.
    grupos = [...mapa.values()]
      .map((g) => ({ id: g.id, nombre: g.nombre, productos: g.productos, totales: totalizar(g.productos) }))
      .sort((a, b) => (a.id === SIN_GRUPO) - (b.id === SIN_GRUPO) || a.nombre.localeCompare(b.nombre))
  }

  return { detalle, grupos, totales: totalizar(detalle) }
}
