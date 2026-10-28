const encoder = new TextEncoder()
const xml = (valor) => String(valor ?? '')
  .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

function columna(indice) {
  let nombre = ''
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    nombre = String.fromCharCode(65 + (n - 1) % 26) + nombre
  }
  return nombre
}

function hoja(encabezados, filas) {
  const contenido = [encabezados, ...filas].map((fila, indice) => {
    const celdas = fila.map((valor, col) => {
      if (valor === null || valor === undefined || valor === '') return ''
      const ref = `${columna(col)}${indice + 1}`
      if (typeof valor === 'number' && Number.isFinite(valor)) {
        return `<c r="${ref}"><v>${valor}</v></c>`
      }
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(valor)}</t></is></c>`
    }).join('')
    return `<row r="${indice + 1}">${celdas}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${contenido}</sheetData></worksheet>`
}

const tablaCrc = Uint32Array.from({ length: 256 }, (_, n) => {
  let crc = n
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

function crc32(datos) {
  let crc = 0xffffffff
  for (const byte of datos) crc = tablaCrc[(crc ^ byte) & 255] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function juntar(partes) {
  const resultado = new Uint8Array(partes.reduce((suma, parte) => suma + parte.length, 0))
  let offset = 0
  for (const parte of partes) {
    resultado.set(parte, offset)
    offset += parte.length
  }
  return resultado
}

// Un XLSX es un ZIP de archivos XML; STORE evita depender de bibliotecas externas.
function comprimir(archivos) {
  const locales = []
  const centrales = []
  let offset = 0
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const nombre = encoder.encode(ruta)
    const datos = encoder.encode(contenido)
    const crc = crc32(datos)
    const local = new Uint8Array(30)
    const l = new DataView(local.buffer)
    l.setUint32(0, 0x04034b50, true)
    l.setUint16(4, 20, true)
    l.setUint16(10, 0, true)
    l.setUint16(12, 0x21, true)
    l.setUint32(14, crc, true)
    l.setUint32(18, datos.length, true)
    l.setUint32(22, datos.length, true)
    l.setUint16(26, nombre.length, true)
    locales.push(local, nombre, datos)

    const central = new Uint8Array(46)
    const c = new DataView(central.buffer)
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(12, 0, true)
    c.setUint16(14, 0x21, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, datos.length, true)
    c.setUint32(24, datos.length, true)
    c.setUint16(28, nombre.length, true)
    c.setUint32(42, offset, true)
    centrales.push(central, nombre)
    offset += local.length + nombre.length + datos.length
  }
  const directorio = juntar(centrales)
  const fin = new Uint8Array(22)
  const e = new DataView(fin.buffer)
  e.setUint32(0, 0x06054b50, true)
  e.setUint16(8, centrales.length / 2, true)
  e.setUint16(10, centrales.length / 2, true)
  e.setUint32(12, directorio.length, true)
  e.setUint32(16, offset, true)
  return juntar([...locales, directorio, fin])
}

export function generarXlsx(pestanas) {
  const archivos = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      pestanas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
      `</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets>${pestanas.map((p, i) => `<sheet name="${xml(p.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      pestanas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `</Relationships>`
  }
  pestanas.forEach((p, i) => { archivos[`xl/worksheets/sheet${i + 1}.xml`] = hoja(p.encabezados, p.filas) })
  return comprimir(archivos)
}

export function exportarXlsx(nombreArchivo, pestanas) {
  const datos = generarXlsx(pestanas)
  const blob = new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
