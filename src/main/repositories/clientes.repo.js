import { getDb } from '../db/connection.js'

const SELECT_BASE = `
  SELECT id, nombre, tipo_documento, numero_documento AS doc, telefono AS tel, direccion
  FROM clientes
`

export function listar() {
  return getDb().prepare(`${SELECT_BASE} ORDER BY nombre`).all()
}

// Unidades por venta: se agregan aparte para sumar los totales cobrados
// (ventas.total_*, con IVA) una sola vez por venta, sin duplicarlos al
// cruzar con las líneas del detalle.
const UNIDADES_POR_VENTA = `(SELECT venta_id, SUM(cantidad) AS unidades FROM venta_detalle GROUP BY venta_id)`

// Lista los clientes con su consumo acumulado (solo ventas activas):
// cantidad de compras, unidades compradas y totales cobrados (con IVA) en
// USD y Bs. Ordenado de mayor a menor según el total en USD.
export function listarConConsumo() {
  return getDb()
    .prepare(
      `SELECT c.id, c.nombre, c.tipo_documento, c.numero_documento AS doc, c.telefono AS tel, c.direccion,
              COUNT(v.id) AS compras,
              COALESCE(SUM(u.unidades), 0) AS unidades,
              COALESCE(SUM(v.total_usd), 0) AS total_usd,
              COALESCE(SUM(v.total_bs), 0) AS total_bs
       FROM clientes c
       LEFT JOIN ventas v ON v.cliente_id = c.id AND v.estado = 'activa'
       LEFT JOIN ${UNIDADES_POR_VENTA} u ON u.venta_id = v.id
       GROUP BY c.id
       ORDER BY total_usd DESC, c.nombre`
    )
    .all()
}

// Consumo de un cliente agrupado por día, mes o año. `periodo` controla el
// nivel de agrupación: 'dia' | 'mes' | 'anio'. Ordenado ascendente.
// `desde` y `hasta` son opcionales (formato 'YYYY-MM-DD').
export function consumoDiarioPorCliente(clienteId, periodo = 'mes', desde = null, hasta = null) {
  const formato = periodo === 'dia' ? '%Y-%m-%d' : periodo === 'anio' ? '%Y' : '%Y-%m'
  let where = `v.cliente_id = ? AND v.estado = 'activa'`
  const params = [clienteId]
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
       JOIN ${UNIDADES_POR_VENTA} u ON u.venta_id = v.id
       WHERE ${where}
       GROUP BY fecha
       ORDER BY fecha`
    )
    .all(...params)
}

// Historial detallado de ventas de un cliente (solo activas), con filtros
// opcionales de fecha. Ordenado por fecha descendente.
export function historialPorCliente(clienteId, desde = null, hasta = null) {
  let where = `v.cliente_id = ? AND v.estado = 'activa'`
  const params = [clienteId]
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
      `SELECT v.id, v.numero_ticket, v.creado_en,
              COALESCE(SUM(vd.cantidad), 0) AS unidades,
              GROUP_CONCAT(CAST(vd.cantidad AS INTEGER) || ' x ' || COALESCE(vd.producto_nombre, ''), ', ') AS productos,
              v.total_usd, v.total_bs
       FROM ventas v
       JOIN venta_detalle vd ON vd.venta_id = v.id
       WHERE ${where}
       GROUP BY v.id
       ORDER BY v.creado_en DESC`
    )
    .all(...params)
}

export function buscarPorId(id) {
  return getDb().prepare(`${SELECT_BASE} WHERE id = ?`).get(id)
}

export function crear({ nombre, tipoDoc, doc, tel, direccion }) {
  const info = getDb()
    .prepare('INSERT INTO clientes (nombre, tipo_documento, numero_documento, telefono, direccion) VALUES (?, ?, ?, ?, ?)')
    .run(nombre, tipoDoc || 'V', doc, tel, direccion)

  return buscarPorId(info.lastInsertRowid)
}

export function actualizar(id, { nombre, tipoDoc, doc, tel, direccion }) {
  getDb()
    .prepare(
      'UPDATE clientes SET nombre = ?, tipo_documento = ?, numero_documento = ?, telefono = ?, direccion = ? WHERE id = ?'
    )
    .run(nombre, tipoDoc || 'V', doc, tel, direccion, id)

  return buscarPorId(id)
}
