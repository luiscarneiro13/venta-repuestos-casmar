export function formatUsd(valor) {
  return '$ ' + Number(valor).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatBs(valorUsd, tasa) {
  return (
    (Number(valorUsd) * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs'
  )
}

export function formatMontoBs(valorBs) {
  if (valorBs == null) return '—'
  return Number(valorBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs'
}

export function formatMontoUsdt(valorUsdt) {
  if (valorUsdt == null) return '—'
  return Number(valorUsdt).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT'
}

// ventas.creado_en, ventas.anulado_en e inventario_movimientos.creado_en se
// guardan en UTC (datetime('now') de SQLite). Este formatter los interpreta
// como UTC y los muestra en la hora local del equipo.
export function formatFechaHoraUtc(fechaUtc) {
  if (!fechaUtc) return ''
  const d = new Date(fechaUtc.replace(' ', 'T') + 'Z')
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}
