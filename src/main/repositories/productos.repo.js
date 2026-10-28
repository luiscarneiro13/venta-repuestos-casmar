import { getDb } from '../db/connection.js'

// El stock de cada producto es el saldo del último movimiento de inventario
// (mismo criterio que inventario.repo.saldoActual).
const SUBQUERY_STOCK = `COALESCE((
  SELECT im.saldo FROM inventario_movimientos im
  WHERE im.producto_id = p.id
  ORDER BY im.creado_en DESC, im.id DESC LIMIT 1
), 0)`

const SELECT_BASE = `
  SELECT p.id, p.codigo, p.codigo_barras, p.nombre, p.marca, p.descripcion, p.unidad_medida, p.ubicacion,
         p.precio_compra_usd, p.stock_minimo, p.activo,
         p.categoria_id, cp.nombre AS categoria_nombre,
         ${SUBQUERY_STOCK} AS stock,
         -- Alerta de reposición: solo cuando hay mínimo configurado (> 0) y el
         -- stock actual no lo supera (stock 0 con mínimo > 0 también resalta).
         CASE WHEN p.stock_minimo > 0 AND ${SUBQUERY_STOCK} <= p.stock_minimo THEN 1 ELSE 0 END AS stock_bajo,
         (SELECT COUNT(*) FROM precios pr WHERE pr.producto_id = p.id AND pr.activo = 1) AS cantidad_precios,
         (SELECT MIN(pr.valor_usd) FROM precios pr WHERE pr.producto_id = p.id AND pr.activo = 1) AS precio_min_usd,
         (SELECT MAX(pr.valor_usd) FROM precios pr WHERE pr.producto_id = p.id AND pr.activo = 1) AS precio_max_usd
  FROM productos p
  LEFT JOIN categorias_producto cp ON cp.id = p.categoria_id
`

// `texto` filtra por código (nro. de parte), código de barra, nombre o marca,
// sin importar mayúsculas/minúsculas (LIKE ya es case-insensitive para ASCII
// en SQLite). Escanear un código de barra encuentra el producto directo.
export function listar({ incluirInactivos = false, texto } = {}) {
  const condiciones = []
  const params = []
  if (!incluirInactivos) condiciones.push('p.activo = 1')
  const busqueda = (texto || '').trim()
  if (busqueda) {
    condiciones.push(
      '(p.codigo LIKE ? OR p.codigo_barras LIKE ? OR p.nombre LIKE ? OR p.marca LIKE ? OR p.ubicacion LIKE ? OR cp.nombre LIKE ?)'
    )
    const patron = `%${busqueda}%`
    params.push(patron, patron, patron, patron, patron, patron)
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
  return getDb().prepare(`${SELECT_BASE} ${where} ORDER BY p.nombre`).all(...params)
}

export function buscarPorId(id) {
  return getDb().prepare(`${SELECT_BASE} WHERE p.id = ?`).get(id)
}

export function crear({ codigo, codigoBarras, nombre, marca, descripcion, unidadMedida, ubicacion, stockMinimo, categoriaId }) {
  const info = getDb()
    .prepare(
      'INSERT INTO productos (codigo, codigo_barras, nombre, marca, descripcion, unidad_medida, ubicacion, stock_minimo, categoria_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(codigo, codigoBarras, nombre, marca, descripcion, unidadMedida, ubicacion, stockMinimo ?? 0, categoriaId ?? null)
  return info.lastInsertRowid
}

export function actualizar(id, { codigo, codigoBarras, nombre, marca, descripcion, unidadMedida, ubicacion, stockMinimo, categoriaId }) {
  getDb()
    .prepare(
      'UPDATE productos SET codigo = ?, codigo_barras = ?, nombre = ?, marca = ?, descripcion = ?, unidad_medida = ?, ubicacion = ?, stock_minimo = ?, categoria_id = ? WHERE id = ?'
    )
    .run(codigo, codigoBarras, nombre, marca, descripcion, unidadMedida, ubicacion, stockMinimo ?? 0, categoriaId ?? null, id)
}

export function contarPorCategoria(categoriaId) {
  return getDb().prepare('SELECT COUNT(*) AS n FROM productos WHERE categoria_id = ?').get(categoriaId).n
}

export function actualizarPrecioCompra(id, precioCompraUsd) {
  getDb().prepare('UPDATE productos SET precio_compra_usd = ? WHERE id = ?').run(precioCompraUsd, id)
}

export function tieneVentas(id) {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM venta_detalle vd
       JOIN precios pr ON pr.id = vd.precio_id
       WHERE pr.producto_id = ? LIMIT 1`
    )
    .get(id)
  return Boolean(row)
}

export function tieneMovimientos(id) {
  return Boolean(getDb().prepare('SELECT 1 FROM inventario_movimientos WHERE producto_id = ? LIMIT 1').get(id))
}

export function desactivar(id) {
  getDb().prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(id)
}

export function reactivar(id) {
  getDb().prepare('UPDATE productos SET activo = 1 WHERE id = ?').run(id)
}

export function eliminar(id) {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM precios WHERE producto_id = ?').run(id)
    db.prepare('DELETE FROM productos WHERE id = ?').run(id)
  })()
}
