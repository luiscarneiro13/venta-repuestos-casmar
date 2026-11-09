import { getDb } from '../db/connection.js'

const SELECT_MOV = `
  SELECT im.id, im.producto_id, im.tipo, im.cantidad, im.saldo, im.motivo, im.proveedor_id,
         im.venta_id, im.usuario_id, im.creado_en, im.costo_usd, im.costo_con_iva, im.anulada,
         p.nombre AS producto_nombre,
         u.nombre AS usuario_nombre, prov.nombre AS proveedor_nombre
  FROM inventario_movimientos im
  JOIN productos p ON p.id = im.producto_id
  LEFT JOIN usuarios u ON u.id = im.usuario_id
  LEFT JOIN proveedores prov ON prov.id = im.proveedor_id
`

// Devuelve el saldo actual de un producto: el saldo del último movimiento
// registrado. Si no hay movimientos, el saldo es 0.
// Filas para los reportes de inventario: productos activos con stock actual,
// mínimo, costo, categoría y el proveedor de su ÚLTIMA entrada de mercancía.
export function reporteProductos() {
  return getDb()
    .prepare(
      `SELECT p.id, p.codigo, p.nombre, p.marca, p.unidad_medida, p.ubicacion,
              p.stock_minimo, p.precio_compra_usd,
              p.categoria_id, cp.nombre AS categoria_nombre,
              COALESCE((
                SELECT im.saldo FROM inventario_movimientos im
                WHERE im.producto_id = p.id
                ORDER BY im.creado_en DESC, im.id DESC LIMIT 1
              ), 0) AS stock,
              ue.proveedor_id, pv.nombre AS proveedor_nombre, ue.creado_en AS ultima_entrada
       FROM productos p
       LEFT JOIN categorias_producto cp ON cp.id = p.categoria_id
       LEFT JOIN inventario_movimientos ue ON ue.id = (
         SELECT im.id FROM inventario_movimientos im
         WHERE im.producto_id = p.id AND im.tipo = 'entrada' AND im.proveedor_id IS NOT NULL AND im.anulada = 0
         ORDER BY im.creado_en DESC, im.id DESC LIMIT 1
       )
       LEFT JOIN proveedores pv ON pv.id = ue.proveedor_id
       WHERE p.activo = 1
       ORDER BY p.nombre`
    )
    .all()
}

export function saldoActual(productoId) {
  const row = getDb()
    .prepare(
      'SELECT saldo FROM inventario_movimientos WHERE producto_id = ? ORDER BY creado_en DESC, id DESC LIMIT 1'
    )
    .get(productoId)
  return row ? row.saldo : 0
}

// Lista todos los movimientos de un producto, ordenados del más reciente al
// más antiguo (igual que la vista de inventario).
export function listarMovimientos(productoId) {
  return getDb()
    .prepare(`${SELECT_MOV} WHERE im.producto_id = ? ORDER BY im.creado_en DESC, im.id DESC`)
    .all(productoId)
}

// Lista todos los movimientos de todos los productos.
export function listarTodosLosMovimientos() {
  return getDb().prepare(`${SELECT_MOV} ORDER BY im.creado_en DESC, im.id DESC`).all()
}

// Registra un movimiento de entrada (compra / ingreso de mercancía).
// `costoUsd` conserva el costo de esa compra para auditar/valorar el
// inventario (las salidas y ajustes lo dejan en null); `costoConIva`
// declara si ese costo ya traía el IVA incluido.
export function registrarEntrada({ productoId, cantidad, motivo, usuarioId, proveedorId = null, costoUsd = null, costoConIva = null }) {
  const saldo = saldoActual(productoId) + cantidad
  getDb()
    .prepare(
      `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, saldo, motivo, usuario_id, proveedor_id, costo_usd, costo_con_iva)
       VALUES (?, 'entrada', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(productoId, cantidad, saldo, motivo || 'Ingreso de mercancía', usuarioId, proveedorId, costoUsd, costoConIva == null ? null : (costoConIva ? 1 : 0))
  return saldo
}

// Registra un movimiento de salida (venta o ajuste) para un producto.
// Devuelve el nuevo saldo.
export function registrarSalida({ productoId, cantidad, motivo, ventaId, usuarioId }) {
  const saldo = saldoActual(productoId) - cantidad
  getDb()
    .prepare(
      `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, saldo, motivo, venta_id, usuario_id)
       VALUES (?, 'salida', ?, ?, ?, ?, ?)`
    )
    .run(productoId, cantidad, saldo, motivo, ventaId ?? null, usuarioId)
  return saldo
}

// Devuelve un movimiento por id (sin joins).
export function obtenerMovimiento(id) {
  return getDb().prepare('SELECT * FROM inventario_movimientos WHERE id = ?').get(id)
}

// La última entrada del producto que registró costo de compra: es la que
// define productos.precio_compra_usd. Las entradas anuladas no cuentan.
// NULL si nunca hubo entrada con costo vigente.
export function ultimaEntradaConCosto(productoId) {
  return getDb()
    .prepare(
      `SELECT id, costo_usd, costo_con_iva FROM inventario_movimientos
       WHERE producto_id = ? AND tipo = 'entrada' AND costo_usd IS NOT NULL AND anulada = 0
       ORDER BY creado_en DESC, id DESC LIMIT 1`
    )
    .get(productoId)
}

// Edita un movimiento existente (cantidad, motivo y, opcionalmente,
// proveedor y costo de compra). Como `saldo` es el balance acumulado,
// desplaza el saldo de esa fila y de todos los movimientos posteriores del
// producto (el orden del libro es creado_en ASC, id ASC). En una entrada,
// subir la cantidad suma al inventario; en una salida, subirla resta (se
// desplaza con el signo contrario). Rechaza la corrección si dejaría algún
// saldo en negativo (unidades ya despachadas por movimientos posteriores).
export function editarMovimiento({ id, cantidad, motivo, proveedorId, costoUsd, costoConIva }) {
  const db = getDb()
  const mov = db.prepare('SELECT * FROM inventario_movimientos WHERE id = ?').get(id)
  if (!mov) throw new Error('Movimiento no encontrado')
  const delta = cantidad - mov.cantidad
  const shift = mov.tipo === 'entrada' ? delta : -delta
  const editar = db.transaction(() => {
    if (shift < 0) {
      const minimo = db
        .prepare(
          `SELECT MIN(saldo) AS m FROM inventario_movimientos
           WHERE producto_id = ? AND (creado_en > ? OR (creado_en = ? AND id >= ?))`
        )
        .get(mov.producto_id, mov.creado_en, mov.creado_en, mov.id)?.m
      if (minimo != null && minimo + shift < 0) {
        throw new Error('La corrección dejaría el inventario en negativo: hay unidades ya despachadas')
      }
    }
    db.prepare(
      `UPDATE inventario_movimientos
       SET cantidad = ?, motivo = ?, proveedor_id = ?, costo_usd = ?, costo_con_iva = ? WHERE id = ?`
    ).run(
      cantidad,
      motivo,
      proveedorId === undefined ? mov.proveedor_id : proveedorId,
      costoUsd === undefined ? mov.costo_usd : costoUsd,
      costoConIva === undefined ? mov.costo_con_iva : (costoConIva == null ? null : (costoConIva ? 1 : 0)),
      id
    )
    if (shift !== 0) {
      db.prepare(
        `UPDATE inventario_movimientos
         SET saldo = saldo + ?
         WHERE producto_id = ?
           AND (creado_en > ? OR (creado_en = ? AND id >= ?))`
      ).run(shift, mov.producto_id, mov.creado_en, mov.creado_en, mov.id)
    }
  })
  editar()
  return saldoActual(mov.producto_id)
}

// Anula una entrada de mercancía: la fila queda marcada (anulada + fecha +
// quién) para auditoría, y su cantidad se descuenta del saldo propio y de
// todos los movimientos posteriores del producto. Rechaza la anulación si
// dejaría algún saldo en negativo (unidades ya despachadas). El servicio
// decide qué entradas pueden anularse (no devoluciones ni ya anuladas).
export function anularMovimiento({ id, usuarioId }) {
  const db = getDb()
  const mov = db.prepare('SELECT * FROM inventario_movimientos WHERE id = ?').get(id)
  if (!mov) throw new Error('Movimiento no encontrado')
  const anular = db.transaction(() => {
    const minimo = db
      .prepare(
        `SELECT MIN(saldo) AS m FROM inventario_movimientos
         WHERE producto_id = ? AND (creado_en > ? OR (creado_en = ? AND id >= ?))`
      )
      .get(mov.producto_id, mov.creado_en, mov.creado_en, mov.id)?.m
    if (minimo != null && minimo - mov.cantidad < 0) {
      throw new Error('No se puede anular: dejaría el inventario en negativo (hay unidades ya despachadas)')
    }
    db.prepare(
      `UPDATE inventario_movimientos
       SET anulada = 1, anulada_en = datetime('now'), anulada_por_id = ?, saldo = saldo - ?
       WHERE id = ?`
    ).run(usuarioId ?? null, mov.cantidad, id)
    db.prepare(
      `UPDATE inventario_movimientos
       SET saldo = saldo - ?
       WHERE producto_id = ? AND (creado_en > ? OR (creado_en = ? AND id > ?))`
    ).run(mov.cantidad, mov.producto_id, mov.creado_en, mov.creado_en, mov.id)
  })
  anular()
  return saldoActual(mov.producto_id)
}

// Unidades vendidas hoy (todas las líneas de ventas activas).
export function contarUnidadesVendidasHoy() {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(vd.cantidad), 0) AS total
       FROM venta_detalle vd
       JOIN ventas v ON v.id = vd.venta_id
       WHERE v.estado = 'activa'
         AND date(v.creado_en, 'localtime') = date('now', 'localtime')`
    )
    .get()
  return row ? row.total : 0
}

// Resumen del inventario total: productos activos, unidades en existencia y
// productos sin stock.
export function resumen() {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS productos,
              COALESCE(SUM(CASE WHEN stock > 0 THEN stock ELSE 0 END), 0) AS unidades,
              COALESCE(SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END), 0) AS sin_stock
       FROM (
         SELECT p.id, COALESCE((
           SELECT im.saldo FROM inventario_movimientos im
           WHERE im.producto_id = p.id
           ORDER BY im.creado_en DESC, im.id DESC LIMIT 1
         ), 0) AS stock
         FROM productos p WHERE p.activo = 1
       )`
    )
    .get()
}
