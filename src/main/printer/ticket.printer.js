import { nativeImage } from '../electron-safe.js'
import { join } from 'node:path'
import { createReceipt, listPrinters, print } from '@maxxuxx/node-printer'
import { r2 } from '../../shared/venta.calculo.js'

// Impresión de tickets en impresora térmica (POS 8330 y compatibles ESC/POS).
//
// El envío es RAW contra la cola de impresión de Windows (winspool), usando el
// NOMBRE de la impresora, no su puerto: "USB001" es un puerto virtual del
// spooler y no se puede abrir como si fuera un archivo (a diferencia de COM1).
// Por eso la impresora tiene que estar instalada en Windows y acá se guarda su
// nombre tal como aparece en "Dispositivos e impresoras".
//
// El módulo nativo de winspool solo existe en Windows; en Linux/macOS (donde
// se desarrolla) cualquier intento de imprimir falla de forma controlada.
const SOLO_WINDOWS = 'La impresión de tickets solo está disponible en Windows.'

// El ticket no lleva nombre del negocio impreso: el logo.png ya hace la marca.

export function esPlataformaSoportada() {
  return process.platform === 'win32'
}

// Logo que va al inicio de los tickets (cliente, tienda y reporte diario).
// Se rasteriza resources/logo.png a 1 bit: la API image() de la librería
// espera 1 byte por pixel (>0 = punto negro) y el comando GS v 0 no centra
// solo: el centrado se hace en los píxeles, rellenando el bitmap a todo el
// ancho imprimible del papel.
const ANCHO_DOTS = { '58mm': 384, '80mm': 576 }
const logoCache = new Map()

// El logo ocupa el 72% del ancho imprimible, centrado. nativeImage.toBitmap()
// devuelve BGRA premultiplicado: los píxeles transparentes tienen alfa 0 y se
// tratan como blanco sin depender del orden de canales.
function logoDesdePng(dots) {
  const ruta = join(__dirname, '../../resources/logo.png')
  const imagen = nativeImage?.createFromPath(ruta)
  if (!imagen || imagen.isEmpty()) return null

  const anchoLogo = Math.round(dots * 0.72)
  const altoLogo = Math.max(1, Math.round((imagen.getSize().height / imagen.getSize().width) * anchoLogo))
  const bitmap = imagen.resize({ width: anchoLogo, height: altoLogo }).toBitmap()

  const bytesPx = bitmap.length / (anchoLogo * altoLogo)
  if (bytesPx !== 4 && bytesPx !== 3) return null

  const data = new Uint8Array(dots * altoLogo)
  const offsetX = Math.floor((dots - anchoLogo) / 2)
  for (let y = 0; y < altoLogo; y += 1) {
    for (let x = 0; x < anchoLogo; x += 1) {
      const i = (y * anchoLogo + x) * bytesPx
      const alfa = bytesPx === 4 ? bitmap[i + 3] : 255
      if (alfa < 128) continue
      const gris = (bitmap[i] + bitmap[i + 1] + bitmap[i + 2]) / 3
      if (gris < 140) data[y * dots + offsetX + x] = 1
    }
  }
  return { width: dots, height: altoLogo, data }
}

function logoRasterizado(ancho) {
  if (logoCache.has(ancho)) return logoCache.get(ancho)

  const dots = ANCHO_DOTS[ancho] ?? ANCHO_DOTS['80mm']
  let resultado = null
  try {
    resultado = logoDesdePng(dots)
  } catch {
    resultado = null
  }

  // Respaldo: isotipo dibujado en píxeles si el PNG no se pudo leer.
  if (!resultado) {
    const lado = Math.round(dots * 0.15)
    const data = new Uint8Array(dots * lado)
    const offsetX = Math.floor((dots - lado) / 2)
    for (let y = 0; y < lado; y += 1) {
      for (let x = 0; x < lado; x += 1) {
        const u = ((x + 0.5) / lado - 0.5) * 2
        const v = ((y + 0.5) / lado - 0.5) * 2
        const exterior = Math.abs(u) < 0.86 && Math.abs(v) < 1 - 0.58 * Math.abs(u)
        const interior = Math.abs(u) < 0.68 && Math.abs(v) < 0.79 - 0.58 * Math.abs(u)
        const radio = Math.hypot(u, v)
        const tuerca = exterior && !interior
        const eje = radio > 0.27 && radio < 0.37
        const ranura = Math.abs(u + v) < 0.075 && radio < 0.27
        if (tuerca || eje || ranura) data[y * dots + offsetX + x] = 1
      }
    }
    resultado = { width: dots, height: lado, data }
  }

  logoCache.set(ancho, resultado)
  return resultado
}

function agregarLogo(recibo, ancho) {
  const logo = logoRasterizado(ancho)
  if (logo) recibo.image(logo).blank(1)
}

export async function listarImpresorasDelSistema() {
  if (!esPlataformaSoportada()) return []
  return listPrinters('winspool')
}

function formatearBs(valor) {
  return Number(valor).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatearUsd(valor) {
  return Number(valor).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// USDT con separadores es-VE, igual que formatMontoUsdt de la pantalla.
function formatearUsdt(valor) {
  return Number(valor).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatearFechaHora(fechaUtc) {
  const fecha = fechaUtc ? new Date(fechaUtc.replace(' ', 'T') + 'Z') : new Date()
  return fecha.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

// Cada línea: cantidad y nombre del producto, debajo el tipo de precio con
// el precio unitario (ambos pueden ocupar varias líneas en papel de 58mm) y
// al final el subtotal en bolívares (que es con lo que paga el cliente) a la
// derecha. `conUsd` agrega el equivalente en USD a la izquierda: se usa en el
// reporte Z, no en el ticket del cliente (que es solo bolívares). Los textos
// largos van con wrap() y no con leftRight(), que los superpone si no caben.
// conUsd: reportes (USD principal + Bs equivalente). Sin conUsd: factura,
// que va solo en bolívares.
function agregarItems(recibo, items, { conUsd = true } = {}) {
  for (const item of items) {
    recibo.wrap(`${item.cantidad} x ${item.producto_nombre}`)
    if (conUsd) {
      recibo.wrap(`${item.tipo_precio_nombre || ''} - $ ${formatearUsd(item.precio_unitario_usd)} c/u`)
      filaMonto(recibo, `  $ ${formatearUsd(item.subtotal_usd)}`, formatearBs(item.subtotal_bs) + ' Bs')
    } else {
      recibo
        .wrap(`${item.tipo_precio_nombre || ''} - ${formatearBs(item.precio_unitario_bs)} Bs c/u`)
        .leftRight('', formatearBs(item.subtotal_bs) + ' Bs')
    }
  }
}

// leftRight() encima etiqueta y valor si no caben (58mm); en ese caso la
// etiqueta va en su línea y el valor alineado a la derecha debajo.
function filaMonto(recibo, etiqueta, valor) {
  if (etiqueta.length + valor.length + 1 > recibo.config.columns) return recibo.line(etiqueta).leftRight('', valor)
  return recibo.leftRight(etiqueta, valor)
}

// keyValue() superpone etiqueta y valor si no caben juntos en una línea
// (ej. nombres de cliente largos en 58mm); en ese caso se usa wrap().
function claveValor(recibo, clave, valor) {
  const columnas = recibo.config.columns
  if (clave.length + valor.length + 2 > columnas) return recibo.wrap(`${clave}: ${valor}`)
  return recibo.keyValue(clave, valor)
}

// Arma el ticket de una venta y devuelve el builder: quien llama hace
// .encode() para obtener los bytes ESC/POS o .preview() para verlo en texto
// (útil para revisar la maqueta sin impresora ni papel).
//
// `copia` controla qué texto va al final del ticket:
//   - 'cliente': lleva "(Cliente)" arriba de "Gracias por su compra"
//   - 'tienda':  lleva "(Tienda)", una zona de firma/fecha y NO lleva
//                "Gracias por su compra"
export function construirTicketVenta({ venta, items, ancho = '80mm', copia = 'cliente' }) {
  const recibo = createReceipt({ paper: ancho, encoding: 'cp858' })

  recibo.initialize().align('center')
  agregarLogo(recibo, ancho)

  // La nota de entrega se identifica en el encabezado; va sin IVA, así que
  // abajo solo imprime TOTAL (iva_porcentaje = 0 → sin Subtotal/IVA).
  if (venta.tipo_documento === 'nota_entrega') {
    recibo
      .style({ bold: true }, (r) => r.line('NOTA DE ENTREGA'))
      .line('Nro. ' + venta.numero_ticket)
  } else {
    recibo.style({ bold: true }, (r) => r.line('Ticket ' + venta.numero_ticket))
  }
  recibo
    .line(formatearFechaHora(venta.creado_en))
    .align('left')
    .divider()

  claveValor(recibo, 'Vendido por', venta.usuario_nombre || '-')
  claveValor(recibo, 'Cliente', venta.cliente_nombre || 'Sin cliente')
  recibo.divider()

  // La factura va SOLO en bolívares (sin $, USDT ni tasas): los montos
  // impresos son los guardados en la venta (subtotal_bs / total_bs), nunca
  // se recalculan.
  agregarItems(recibo, items, { conUsd: false })

  recibo.divider()

  // Ventas con IVA (post-migración 019): Subtotal + IVA + TOTAL. Las viejas
  // (iva_* en NULL) solo muestran el total, como siempre.
  // Subtotal = suma de las líneas impresas (sin IVA), igual que la vista
  // previa de la pantalla de venta (shared/venta.calculo.js).
  const ivaPct = Number(venta.iva_porcentaje) || 0
  const tieneIva = ivaPct > 0 && venta.iva_bs != null
  const sumar = (campo) => r2(items.reduce((s, item) => s + (Number(item[campo]) || 0), 0))
  if (tieneIva) {
    recibo
      .leftRight('Subtotal Bs', formatearBs(sumar('subtotal_bs')))
      .leftRight(`IVA ${ivaPct}%`, formatearBs(venta.iva_bs))
  }
  recibo.style({ bold: true }, (r) => r.leftRight('TOTAL Bs', formatearBs(venta.total_bs)))

  if (copia === 'cliente') {
    return recibo.blank(1).align('center').line('(Cliente)').line('Gracias por su compra').feed(4).cut()
  }

  // copia === 'tienda'
  // Al final va una zona para firma y fecha del operador: 3 líneas en
  // blanco arriba, "Recibido por:" con guiones hasta el final, 3 líneas
  // en blanco, "Fecha:" con guiones hasta el final y 3 líneas abajo.
  const columnas = recibo.config.columns
  const lineaRecibido = 'Recibido por: ' + '_'.repeat(Math.max(1, columnas - 'Recibido por: '.length))
  const lineaFecha = 'Fecha: ' + '_'.repeat(Math.max(1, columnas - 'Fecha: '.length))

  return recibo
    .blank(1)
    .align('center')
    .line('(Tienda)')
    .blank(3)
    .align('left')
    .line(lineaRecibido)
    .blank(3)
    .line(lineaFecha)
    .blank(3)
    .feed(4)
    .cut()
}

// Arma el reporte diario (reporte Z) de las ventas del turno. Lleva el
// mismo encabezado del ticket de venta, pero agrega "Reporte diario", la
// fecha/hora de impresión, el usuario que lo imprimió y la tasa del día.
// Después lista cada venta (cliente, items con cantidad/producto/subtotal
// y total) igual que en el ticket de venta, y al final los totales generales
// (USD, Bs, unidades vendidas) y una zona
// de firma del responsable.
export function construirTicketReporteZ({
  ventas,
  usuarioNombre,
  tasaBcv,
  tasaUsdt,
  totalUnidades = 0,
  ancho = '80mm'
}) {
  const recibo = createReceipt({ paper: ancho, encoding: 'cp858' })

  recibo.initialize().align('center')
  agregarLogo(recibo, ancho)

  recibo
    .style({ bold: true }, (r) => r.line('Reporte diario'))
    .line(formatearFechaHora())
    .align('left')
    .divider()
    .style({ bold: true }, (r) => r.keyValue('Imprimió', usuarioNombre || '-'))
    .divider()
    .style({ bold: true }, (r) => r.line('Tasas del día'))
  // claveValor parte la línea si no cabe (58mm) en vez de encimar el monto.
  claveValor(recibo, 'Tasa BCV (USD)', formatearBs(tasaBcv) + ' Bs')
  claveValor(recibo, 'Tasa Binance (USDT)', formatearBs(tasaUsdt) + ' Bs')
  const notas = ventas.filter((v) => v.tipo_documento === 'nota_entrega').length
  recibo
    .divider()
    .keyValue('Ventas', String(ventas.length))
    .keyValue('Facturas', String(ventas.length - notas))
    .keyValue('Notas de entrega', String(notas))
    .divider()

  let totalGeneralBs = 0
  let totalGeneralUsd = 0
  let totalIvaBs = 0
  let totalIvaUsd = 0
  let cobradoBs = 0
  let cobradoUsdt = 0

  for (const venta of ventas) {
    recibo.style({ bold: true }, (r) => r.wrap(`${venta.numero_ticket} · ${venta.cliente_nombre || 'Sin cliente'}`))
    claveValor(recibo, 'Documento', venta.tipo_documento === 'nota_entrega' ? 'Nota de entrega' : 'Factura')
    claveValor(recibo, 'Vendido por', venta.usuario_nombre || '-')
    claveValor(recibo, 'Pago', venta.metodo_pago === 'usdt' ? 'USDT/Divisas' : 'Bolívares')

    // Reporte en USD con su equivalente en Bs. Líneas sin IVA ($ a la
    // izquierda, Bs a la derecha); el total de la venta sí lo incluye.
    agregarItems(recibo, venta.items, { conUsd: true })

    recibo.style({ bold: true }, (r) => filaMonto(r, 'Total USD', '$ ' + formatearUsd(venta.total_usd)))
    filaMonto(recibo, '  equiv. Bs', formatearBs(venta.total_bs))
    if (Number(venta.iva_porcentaje) > 0 && venta.iva_bs != null) {
      filaMonto(recibo, `  inc. IVA ${venta.iva_porcentaje}%`, '$ ' + formatearUsd(venta.iva_usd ?? 0))
      filaMonto(recibo, '  IVA equiv. Bs', formatearBs(venta.iva_bs))
    }
    if (venta.metodo_pago === 'usdt') {
      filaMonto(recibo, '  cobrado USDT', formatearUsdt(venta.total_usdt) + ' USDT')
    }
    recibo.divider()

    totalGeneralBs += Number(venta.total_bs) || 0
    totalGeneralUsd += Number(venta.total_usd) || 0
    totalIvaBs += Number(venta.iva_bs) || 0
    totalIvaUsd += Number(venta.iva_usd) || 0
    if (venta.metodo_pago === 'usdt') cobradoUsdt += Number(venta.total_usdt) || 0
    else cobradoBs += Number(venta.total_bs) || 0
  }

  // Totales generales del día en USD con su equivalente en Bs, y el desglose
  // de lo cobrado en cada moneda (para cuadrar la caja).
  recibo.style({ bold: true }, (r) => filaMonto(r, 'Total USD', '$ ' + formatearUsd(totalGeneralUsd)))
  filaMonto(recibo, '  equiv. Bs', formatearBs(totalGeneralBs))
  filaMonto(recibo, 'IVA del día USD', '$ ' + formatearUsd(totalIvaUsd))
  filaMonto(recibo, '  equiv. Bs', formatearBs(totalIvaBs))
  filaMonto(recibo, 'Cobrado en Bs', formatearBs(cobradoBs))
  filaMonto(recibo, 'Cobrado en USDT', formatearUsdt(cobradoUsdt) + ' USDT')
  recibo.leftRight('Unidades vendidas', String(totalUnidades)).divider()

  // Zona de firma del responsable: 3 líneas en blanco, nombre y firma con
  // guiones hasta completar el ancho del papel.
  const columnas = recibo.config.columns
  const lineaNombre = 'Nombre Resp.: ' + '_'.repeat(Math.max(1, columnas - 'Nombre Resp.: '.length))
  const lineaFirma = 'Firma.: ' + '_'.repeat(Math.max(1, columnas - 'Firma.: '.length))

  recibo
    .blank(3)
    .line(lineaNombre)
    .blank(3)
    .line(lineaFirma)
    .blank(3)
    .feed(4)
    .cut()

  return recibo
}

export function construirTicketPrueba({ ancho = '80mm', nombreImpresora = '' } = {}) {
  return createReceipt({ paper: ancho, encoding: 'cp858' })
    .initialize()
    .align('center')
    .style({ bold: true }, (r) => r.line('Prueba de impresion'))
    .align('left')
    .divider()
    .keyValue('Impresora', nombreImpresora || '-')
    .keyValue('Ancho', ancho)
    .keyValue('Fecha', formatearFechaHora())
    .divider()
    .line('Acentos y enes: ñ á é í ó ú')
    .line('Si esto se lee bien y el papel se corto,')
    .line('la impresora esta lista para vender.')
    .feed(2)
    .cut()
}

// Manda los bytes a la cola de Windows. Devuelve el resultado en vez de
// lanzar, porque quien llama (una venta ya guardada) no debe romperse por un
// problema de impresora.
//
// `validar` controla si se consulta la lista de impresoras de Windows para
// verificar que el nombre configurado existe. Por defecto es true, pero
// cuando se imprimen varios tickets seguidos (ej. copia cliente + tienda)
// se valida solo una vez y se omite en los siguientes para no demorar.
export async function enviarAImpresora({ nombreImpresora, bytes, documento = 'Ticket', validar = true }) {
  if (!esPlataformaSoportada()) {
    return { ok: false, error: SOLO_WINDOWS }
  }
  if (!nombreImpresora) {
    return { ok: false, error: 'No hay impresora configurada. Elegí una en Configuración → Impresora.' }
  }

  // El nombre tiene que coincidir exacto con el de la cola de Windows. Si no
  // existe, winspool devuelve un error genérico que no dice qué está mal, así
  // que se avisa antes y se listan las instaladas para poder corregirlo.
  if (validar) {
    try {
      const instaladas = await listPrinters('winspool')
      if (instaladas.length > 0 && !instaladas.some((imp) => imp.name === nombreImpresora)) {
        const nombres = instaladas.map((imp) => imp.name).join(', ')
        return {
          ok: false,
          error: `Windows no tiene una impresora llamada "${nombreImpresora}". Instaladas: ${nombres}.`
        }
      }
    } catch {
      // Si no se pudo consultar la lista se intenta imprimir igual.
    }
  }

  try {
    const resultado = await print(
      { type: 'winspool', printerName: nombreImpresora, documentName: documento },
      bytes
    )
    return { ok: true, jobId: resultado.jobId }
  } catch (error) {
    return { ok: false, error: error.message || 'No se pudo imprimir el ticket' }
  }
}
