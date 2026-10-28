import { getDb } from '../db/connection.js'

export function obtenerTasaDeHoy() {
  return (
    getDb()
      .prepare(
        "SELECT * FROM tasas_cambio WHERE date(fecha_hora) = date('now', 'localtime') ORDER BY fecha_hora DESC LIMIT 1"
      )
      .get() ?? null
  )
}

// Última tasa registrada en una fecha ('YYYY-MM-DD', hora local), para el
// reporte diario de un día pasado.
export function obtenerTasaDeFecha(fecha) {
  return (
    getDb()
      .prepare('SELECT * FROM tasas_cambio WHERE date(fecha_hora) = date(?) ORDER BY fecha_hora DESC, id DESC LIMIT 1')
      .get(fecha) ?? null
  )
}

// Última tasa registrada en el histórico, sin importar el día. Se usa al
// iniciar el sistema para precargar el modal con la tasa vigente real,
// aunque la última actualización sea de uno o varios días atrás.
export function obtenerUltimaTasa() {
  return getDb().prepare('SELECT * FROM tasas_cambio ORDER BY fecha_hora DESC LIMIT 1').get() ?? null
}

// `valor` sigue poblándose con la tasa BCV para los lectores viejos
// (reportes, tickets y la columna de días anteriores a la migración 016).
export function crear({ valorBcv, valorUsdt, usuarioId }) {
  const info = getDb()
    .prepare('INSERT INTO tasas_cambio (valor, valor_bcv, valor_usdt, usuario_id) VALUES (?, ?, ?, ?)')
    .run(valorBcv, valorBcv, valorUsdt, usuarioId)

  return getDb().prepare('SELECT * FROM tasas_cambio WHERE id = ?').get(info.lastInsertRowid)
}
