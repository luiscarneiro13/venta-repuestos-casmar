function csvEscape(valor) {
  const texto = String(valor ?? '')
  if (/[",\n;]/.test(texto)) {
    return '"' + texto.replace(/"/g, '""') + '"'
  }
  return texto
}

// Genera un CSV (lo abre Excel directamente) y dispara su descarga.
// `encabezados` es un array de strings; `filas` un array de arrays con los
// mismos valores en el mismo orden que los encabezados.
export function exportarCsv(nombreArchivo, encabezados, filas) {
  const contenido = [encabezados, ...filas].map((fila) => fila.map(csvEscape).join(',')).join('\r\n')
  // BOM UTF-8 para que Excel muestre bien las tildes/ñ al abrir el archivo.
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}
