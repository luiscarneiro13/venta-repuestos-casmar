import { getDb } from '../db/connection.js'

const SELECT_VENTA = `
  SELECT v.id, v.numero_ticket, v.cliente_id, v.usuario_id, v.tasa_valor,
         v.tasa_bcv, v.tasa_usdt, v.metodo_pago, v.tipo_documento,
         v.iva_porcentaje, v.iva_usd, v.iva_bs, v.iva_usdt,
         v.total_usd, v.total_bs, v.total_usdt, v.estado, v.creado_en, v.anulado_en, v.anulado_motivo,
         v.anulado_por_usuario_id,
         c.nombre AS cliente_nombre, c.numero_documento AS cliente_doc,
         u.nombre AS usuario_nombre,
         ua.nombre AS usuario_anulacion_nombre
  FROM ventas v
  LEFT JOIN clientes c ON c.id = v.cliente_id
  JOIN usuarios u ON u.id = v.usuario_id
  LEFT JOIN usuarios ua ON ua.id = v.anulado_por_usuario_id
`

// Correlativo independiente por tipo de documento: facturas T-0001…,
// notas de entrega NE-0001….
const PREFIJO_DOCUMENTO = { factura: 'T-', nota_entrega: 'NE-' }

function siguienteNumeroTicket(db, tipoDocumento = 'factura') {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM ventas WHERE tipo_documento = ?').get(tipoDocumento)
  return PREFIJO_DOCUMENTO[tipoDocumento] + String(total + 1).padStart(4, '0')
}

export function listar() {
  return getDb().prepare(`${SELECT_VENTA} ORDER BY v.creado_en DESC, v.id DESC`).all()
}

// listarDeHoy agrega por venta la cantidad de unidades vendidas (suma de
// cantidades de todas sus líneas) para la tabla Ventas del día.
const SELECT_VENTA_CON_UNIDADES = SELECT_VENTA.replace(
  'FROM ventas v',
  `, COALESCE(tu.unidades, 0) AS cantidad_unidades
   FROM ventas v
   LEFT JOIN (
     SELECT venta_id, SUM(cantidad) AS unidades FROM venta_detalle GROUP BY venta_id
   ) tu ON tu.venta_id = v.id`
)

export function listarDeHoy() {
  return getDb()
    .prepare(
      `${SELECT_VENTA_CON_UNIDADES} WHERE date(v.creado_en, 'localtime') = date('now', 'localtime') ORDER BY v.creado_en DESC, v.id DESC`
    )
    .all()
}

// Unidades vendidas hoy (solo ventas activas).
export function totalesProductosDeHoy() {
  return getDb()
    .prepare(
      `SELECT COALESCE(SUM(vd.cantidad), 0) AS unidades
       FROM ventas v
       JOIN venta_detalle vd ON vd.venta_id = v.id
       WHERE v.estado = 'activa'
         AND date(v.creado_en, 'localtime') = date('now', 'localtime')`
    )
    .get()
}

// Unidades vendidas y monto cobrado en USD (total con IVA, el mismo que usan
// los KPIs) agrupados por día, mes o año (solo ventas activas). `periodo` controla el nivel de agrupación: 'dia' | 'mes' | 'anio'.
// `desde` y `hasta` son opcionales ('YYYY-MM-DD'). Ordenado ascendente.
export function ventasProductosAgrupadas(periodo = 'mes', desde = null, hasta = null) {
  const formato = periodo === 'dia' ? '%Y-%m-%d' : periodo === 'anio' ? '%Y' : '%Y-%m'
  let where = `v.estado = 'activa'`
  const params = []
  if (desde) {
    where += ` AND date(v.creado_en, 'localtime') >= ?`
    params.push(desde)
  }
  if (hasta) {
    where += ` AND date(v.creado_en, 'localtime') <= ?`
    params.push(hasta)
  }
  return getDb()
    .prepare(
      `SELECT strftime('${formato}', v.creado_en, 'localtime') AS fecha,
              COALESCE(SUM(u.unidades), 0) AS unidades,
              COALESCE(SUM(v.total_usd), 0) AS total_usd,
              COALESCE(SUM(v.total_bs), 0) AS total_bs
       FROM ventas v
       JOIN (SELECT venta_id, SUM(cantidad) AS unidades FROM venta_detalle GROUP BY venta_id) u ON u.venta_id = v.id
       WHERE ${where}
       GROUP BY fecha
       ORDER BY fecha`
    )
    .all(...params)
}

export function buscarPorId(id) {
  return getDb().prepare(`${SELECT_VENTA} WHERE v.id = ?`).get(id)
}

// Filtros opcionales para "Ventas totales": rango de fechas (datetimes en
// hora LOCAL, ya con el "hasta" incluyendo todo ese día).
export function listarConFiltros({ desde, hasta }) {
  const condiciones = []
  const params = []

  if (desde) {
    condiciones.push("datetime(v.creado_en, 'localtime') >= datetime(?)")
    params.push(desde)
  }
  if (hasta) {
    condiciones.push("datetime(v.creado_en, 'localtime') <= datetime(?)")
    params.push(hasta)
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
  return getDb()
    .prepare(`${SELECT_VENTA} ${where} ORDER BY v.creado_en DESC, v.id DESC`)
    .all(...params)
}

// `desdeLocal` es un datetime en hora LOCAL (ej. cajas.abierta_en). Como
// v.creado_en se guarda en UTC, se convierte a local antes de comparar.
export function listarActivasDesde(desdeLocal) {
  return getDb()
    .prepare(
      `${SELECT_VENTA}
       WHERE v.estado = 'activa' AND datetime(v.creado_en, 'localtime') >= datetime(?)
       ORDER BY v.creado_en DESC, v.id DESC`
    )
    .all(desdeLocal)
}

// `fecha` es una fecha en formato 'YYYY-MM-DD' (en hora local). Devuelve
// todas las ventas activas de ese día (desde 00:00 hasta 23:59:59).
export function listarActivasPorFecha(fecha) {
  return getDb()
    .prepare(
      `${SELECT_VENTA}
       WHERE v.estado = 'activa'
         AND date(v.creado_en, 'localtime') = date(?)
       ORDER BY v.creado_en DESC, v.id DESC`
    )
    .all(fecha)
}

export function detalleDeVenta(ventaId) {
  return getDb()
    .prepare(
      `SELECT vd.id, vd.precio_id, vd.cantidad, vd.precio_unitario_usd, vd.precio_unitario_bs,
              vd.precio_unitario_usdt, vd.subtotal_usd, vd.subtotal_bs, vd.subtotal_usdt,
              vd.margen_utilidad, p.producto_id,
              COALESCE(vd.producto_nombre, pr.nombre) AS producto_nombre,
              COALESCE(vd.tipo_precio_nombre, tp.nombre) AS tipo_precio_nombre,
              pr.codigo AS producto_codigo
       FROM venta_detalle vd
       JOIN precios p ON p.id = vd.precio_id
       JOIN productos pr ON pr.id = p.producto_id
       JOIN tipos_precio tp ON tp.id = p.tipo_precio_id
       WHERE vd.venta_id = ?
       ORDER BY vd.id`
    )
    .all(ventaId)
}

export function anular(id, { motivo, usuarioId }) {
  getDb()
    .prepare(
      `UPDATE ventas SET estado = 'anulada', anulado_en = datetime('now'), anulado_motivo = ?, anulado_por_usuario_id = ? WHERE id = ?`
    )
    .run(motivo, usuarioId, id)
  return buscarPorId(id)
}

// `tasaBcv` y `tasaUsdt` son la tasa vigente al momento de la venta;
// `tasaValor` recibe la BCV para que reportes y lectores viejos sigan
// funcionando igual.
export function crear({ clienteId, usuarioId, tasaBcv, tasaUsdt, metodoPago, tipoDocumento = 'factura', ivaPorcentaje, ivaUsd, ivaBs, ivaUsdt, totalUsd, totalBs, totalUsdt, items }) {
  const db = getDb()

  const crearEnTransaccion = db.transaction(() => {
    const numeroTicket = siguienteNumeroTicket(db, tipoDocumento)
    const info = db
      .prepare(
        `INSERT INTO ventas
           (numero_ticket, cliente_id, usuario_id, tasa_valor, tasa_bcv, tasa_usdt, metodo_pago, tipo_documento,
            iva_porcentaje, iva_usd, iva_bs, iva_usdt,
            total_usd, total_bs, total_usdt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(numeroTicket, clienteId, usuarioId, tasaBcv, tasaBcv, tasaUsdt, metodoPago, tipoDocumento, ivaPorcentaje, ivaUsd, ivaBs, ivaUsdt, totalUsd, totalBs, totalUsdt)

    const ventaId = info.lastInsertRowid
    const insertarDetalle = db.prepare(
      `INSERT INTO venta_detalle
         (venta_id, precio_id, cantidad, precio_unitario_usd, precio_unitario_bs, precio_unitario_usdt,
          subtotal_usd, subtotal_bs, subtotal_usdt, margen_utilidad,
          producto_nombre, tipo_precio_nombre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const item of items) {
      insertarDetalle.run(
        ventaId,
        item.precioId,
        item.cantidad,
        item.precioUnitarioUsd,
        item.precioUnitarioBs,
        item.precioUnitarioUsdt,
        item.subtotalUsd,
        item.subtotalBs,
        item.subtotalUsdt,
        item.margenUtilidad,
        item.productoNombre,
        item.tipoPrecioNombre
      )
    }

    return ventaId
  })

  const ventaId = crearEnTransaccion()
  return buscarPorId(ventaId)
}
