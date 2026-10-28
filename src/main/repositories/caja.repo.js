import { getDb } from '../db/connection.js'

const SELECT_CAJA = `
  SELECT c.id, c.usuario_apertura_id, c.tasa_apertura, c.tasa_apertura_usdt, c.abierta_en, c.estado,
         c.usuario_cierre_id, c.tasa_cierre, c.tasa_cierre_usdt, c.cerrada_en,
         c.total_contado_usd, c.total_contado_bs,
         ua.nombre AS usuario_apertura_nombre, uc.nombre AS usuario_cierre_nombre
  FROM cajas c
  JOIN usuarios ua ON ua.id = c.usuario_apertura_id
  LEFT JOIN usuarios uc ON uc.id = c.usuario_cierre_id
`

export function listarAbiertas() {
  return getDb().prepare(`${SELECT_CAJA} WHERE c.estado = 'abierta' ORDER BY c.abierta_en ASC`).all()
}

export function buscarPorId(id) {
  return getDb().prepare(`${SELECT_CAJA} WHERE c.id = ?`).get(id)
}

// tasa_apertura/tasa_cierre son la tasa BCV (las columnas viejas); las del
// sufijo _usdt guardan la tasa Binance de apertura/cierre.
export function abrir({ usuarioId, tasaApertura, tasaAperturaUsdt }) {
  const info = getDb()
    .prepare('INSERT INTO cajas (usuario_apertura_id, tasa_apertura, tasa_apertura_usdt) VALUES (?, ?, ?)')
    .run(usuarioId, tasaApertura, tasaAperturaUsdt)
  return buscarPorId(info.lastInsertRowid)
}

export function cerrar(id, { usuarioCierreId, tasaCierre, tasaCierreUsdt, totales }) {
  getDb()
    .prepare(
      `UPDATE cajas SET
         estado = 'cerrada',
         usuario_cierre_id = ?,
         tasa_cierre = ?,
         tasa_cierre_usdt = ?,
         cerrada_en = datetime('now', 'localtime'),
         total_contado_usd = ?,
         total_contado_bs = ?
       WHERE id = ?`
    )
    .run(
      usuarioCierreId,
      tasaCierre,
      tasaCierreUsdt,
      totales.contadoUsd,
      totales.contadoBs,
      id
    )
  return buscarPorId(id)
}
