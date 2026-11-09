import { getDb } from '../db/connection.js'

const SELECT_BASE = `
  SELECT p.id, p.producto_id, p.tipo_precio_id, p.valor_usd, p.valor_usdt,
         p.margen, p.margen_usdt, p.descripcion, p.activo,
         pr.nombre AS producto_nombre, pr.codigo AS producto_codigo,
         pr.costo_con_iva AS producto_costo_con_iva,
         tp.nombre AS tipo_precio_nombre, tp.orden AS tipo_precio_orden, tp.margen_default
  FROM precios p
  JOIN productos pr ON pr.id = p.producto_id
  JOIN tipos_precio tp ON tp.id = p.tipo_precio_id
`

const ORDEN = 'ORDER BY pr.nombre, tp.orden, tp.nombre'

// Para exportación se pueden incluir los precios vigentes de productos desactivados.
export function listar({ incluirProductosInactivos = false } = {}) {
  const filtroProducto = incluirProductosInactivos ? '' : 'AND pr.activo = 1'
  return getDb().prepare(`${SELECT_BASE} WHERE p.activo = 1 ${filtroProducto} ${ORDEN}`).all()
}

export function listarPorProducto(productoId) {
  return getDb().prepare(`${SELECT_BASE} WHERE p.producto_id = ? AND p.activo = 1 ${ORDEN}`).all(productoId)
}

export function buscarPorId(id) {
  return getDb().prepare(`${SELECT_BASE} WHERE p.id = ?`).get(id)
}

// Todos los productos × tipos activos con la fila de `precios` si existe.
// Base de la tabla general del catálogo con precios calculados.
export function listarCatalogoTiposConMargen() {
  return getDb()
    .prepare(
      `SELECT pr.id AS producto_id, pr.precio_compra_usd,
              tp.id AS tipo_precio_id, tp.nombre AS tipo_precio_nombre, tp.orden AS tipo_precio_orden,
              tp.margen_default,
              p.id AS precio_id, p.margen, p.margen_usdt, p.valor_usd, p.valor_usdt
       FROM productos pr
       CROSS JOIN tipos_precio tp
       LEFT JOIN precios p ON p.tipo_precio_id = tp.id AND p.producto_id = pr.id
       WHERE tp.activo = 1
       ORDER BY pr.nombre, tp.orden, tp.nombre`
    )
    .all()
}

// Todos los tipos de precio ACTIVOS con la fila de `precios` del producto si
// existe (incluso inactiva, para no perder el margen propio guardado). Es la
// base de la tabla de márgenes de la entrada y del listado calculado.
export function listarTiposConMargen(productoId) {
  return getDb()
    .prepare(
      `SELECT tp.id AS tipo_precio_id, tp.nombre AS tipo_precio_nombre, tp.orden AS tipo_precio_orden,
              tp.margen_default,
              p.id AS precio_id, p.margen, p.margen_usdt, p.valor_usd, p.valor_usdt,
              p.activo AS precio_activo
       FROM tipos_precio tp
       LEFT JOIN precios p ON p.tipo_precio_id = tp.id AND p.producto_id = ?
       WHERE tp.activo = 1
       ORDER BY tp.orden, tp.nombre`
    )
    .all(productoId)
}

// Inserta o actualiza el precio materializado de un producto para un tipo:
// margenes propios (Bs y USDT) + bases en $ materializadas
// (valor_usd = round2(costo×(1+margen/100)), valor_usdt = lo propio con
// margen_usdt), activo = 1. Devuelve el id de la fila (RETURNING).
export function upsertPrecio(productoId, { tipoPrecioId, margen, margenUsdt, valorUsd, valorUsdt }) {
  return getDb()
    .prepare(
      `INSERT INTO precios (producto_id, tipo_precio_id, valor_usd, valor_usdt, margen, margen_usdt, activo)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT (producto_id, tipo_precio_id)
       DO UPDATE SET valor_usd = excluded.valor_usd, valor_usdt = excluded.valor_usdt,
                     margen = excluded.margen, margen_usdt = excluded.margen_usdt, activo = 1
       RETURNING id`
    )
    .get(productoId, tipoPrecioId, valorUsd, valorUsdt, margen, margenUsdt)?.id
}

// Actualiza solo los márgenes propios de una fila existente (sin tocar los
// precios materializados). Se usa cuando el producto aún no tiene costo
// registrado.
export function actualizarMargen(productoId, tipoPrecioId, margen, margenUsdt) {
  getDb()
    .prepare('UPDATE precios SET margen = ?, margen_usdt = ? WHERE producto_id = ? AND tipo_precio_id = ?')
    .run(margen, margenUsdt, productoId, tipoPrecioId)
}

// Actualiza solo las bases materializadas de una fila (sin tocar los
// márgenes propios). Se usa cuando cambia el costo vigente por una
// corrección o anulación de entrada.
export function actualizarValores(precioId, valorUsd, valorUsdt) {
  getDb().prepare('UPDATE precios SET valor_usd = ?, valor_usdt = ? WHERE id = ?').run(valorUsd, valorUsdt, precioId)
}

// Desactiva las filas de precios del producto cuyo tipo quedó inactivo: no se
// borran porque el histórico de ventas las referencia.
export function desactivarDeTiposInactivos(productoId) {
  getDb()
    .prepare(
      `UPDATE precios SET activo = 0
       WHERE producto_id = ?
         AND tipo_precio_id IN (SELECT id FROM tipos_precio WHERE activo = 0)`
    )
    .run(productoId)
}

// Recalcula el valor_usd materializado de las filas que usan el margen por
// defecto del tipo (margen IS NULL) cuando cambia margen_default. valor_usdt
// se recalcula con su margen efectivo (propio USDT o el que hereda). Solo
// toca productos con costo conocido; los demás conservan su valor anterior.
export function recalcularValorUsdDefault(tipoPrecioId, margenDefault) {
  getDb()
    .prepare(
      `UPDATE precios
       SET valor_usd = ROUND(
         (SELECT pr.precio_compra_usd FROM productos pr WHERE pr.id = precios.producto_id)
           * (1 + ? / 100.0), 2),
       valor_usdt = ROUND(
         (SELECT pr.precio_compra_usd FROM productos pr WHERE pr.id = precios.producto_id)
           * (1 + COALESCE(margen_usdt, ?) / 100.0), 2)
       WHERE tipo_precio_id = ?
         AND margen IS NULL
         AND (SELECT pr.precio_compra_usd FROM productos pr WHERE pr.id = precios.producto_id) IS NOT NULL`
    )
    .run(margenDefault, margenDefault, tipoPrecioId)
}

// LEGADO — modelo anterior de precios fijos. Reemplaza el juego de precios de
// un producto. `precios` es la lista de precios que deben quedar vigentes:
// [{ tipoPrecioId, valorUsd, descripcion }].
// - Los que ya existían se actualizan (y se reactivan si estaban inactivos).
// - Los nuevos se insertan.
// - Los que ya no vienen se eliminan; si tienen ventas asociadas se
//   desactivan para no romper el historial.
export function reemplazarDeProducto(productoId, precios) {
  const db = getDb()
  const upsert = db.prepare(
    `INSERT INTO precios (producto_id, tipo_precio_id, valor_usd, descripcion, activo)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT (producto_id, tipo_precio_id)
     DO UPDATE SET valor_usd = excluded.valor_usd, descripcion = excluded.descripcion, activo = 1`
  )
  const existentes = db.prepare('SELECT id, tipo_precio_id FROM precios WHERE producto_id = ?')
  const tieneVentas = db.prepare('SELECT 1 FROM venta_detalle WHERE precio_id = ? LIMIT 1')
  const borrar = db.prepare('DELETE FROM precios WHERE id = ?')
  const desactivar = db.prepare('UPDATE precios SET activo = 0 WHERE id = ?')

  db.transaction(() => {
    const vigentes = new Set(precios.map((p) => p.tipoPrecioId))
    for (const p of precios) {
      upsert.run(productoId, p.tipoPrecioId, p.valorUsd, p.descripcion)
    }
    for (const fila of existentes.all(productoId)) {
      if (vigentes.has(fila.tipo_precio_id)) continue
      if (tieneVentas.get(fila.id)) desactivar.run(fila.id)
      else borrar.run(fila.id)
    }
  })()
}
