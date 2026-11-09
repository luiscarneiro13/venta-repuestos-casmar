import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BrowserWindow } from '../electron-safe.js'
import { r2 } from '../../shared/venta.calculo.js'

// Impresión de documentos en hoja carta (Letter 216x279mm): facturas, notas
// de entrega, reportes de cierre/diario y página de prueba. A diferencia del
// ticket térmico (ESC/POS por winspool, solo Windows), el documento se arma
// como HTML y se imprime con webContents.print() de Electron en una ventana
// oculta: funciona con cualquier impresora instalada por su driver y en
// cualquier plataforma. La impresora se configura por nombre en /impresora.
//
// Cada copia sale como trabajo aparte para poder rotular ORIGINAL (va al
// cliente, con "Gracias por su compra") y COPIA (se queda en tienda, con
// línea de firma), igual que hacían los tickets cliente/tienda.

const SIN_ELECTRON = 'La impresión solo está disponible dentro de la aplicación.'

// El logo se embebe como data URI: el documento se imprime desde un data:
// URL donde las rutas file:// relativas no resuelven. La ruta difiere según
// corra suelto (src/main/printer/) o empaquetado en el bundle (out/main/).
const LOGO_DATA_URI = (() => {
  try {
    const dir = dirname(fileURLToPath(import.meta.url))
    for (const arriba of ['../../', '../../../']) {
      const ruta = join(dir, arriba, 'resources/logo.png')
      if (existsSync(ruta)) return 'data:image/png;base64,' + readFileSync(ruta).toString('base64')
    }
    return null
  } catch {
    return null
  }
})()

// ---------- Formatos (espejo de los del ticket térmico) ----------

function formatearBs(valor) {
  return Number(valor).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatearUsd(valor) {
  return Number(valor).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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

const esc = (valor) =>
  String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

// ---------- Piezas del HTML ----------

const CSS = `
  @page { size: Letter; margin: 0 }
  * { box-sizing: border-box }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 16mm 18mm; color: #111; font-size: 12px }
  .cabecera { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px }
  .logo { max-width: 58mm; max-height: 26mm; object-fit: contain }
  .doc-box { border: 1.5px solid #222; padding: 10px 16px; text-align: center; min-width: 62mm }
  .doc-box .tipo { font-weight: 700; font-size: 15px; letter-spacing: .5px }
  .doc-box .nro { font-weight: 700; font-size: 14px; margin-top: 2px }
  .doc-box .copia { margin-top: 6px; font-size: 10px; letter-spacing: 1px; border-top: 1px solid #999; padding-top: 4px }
  .negocio { margin-top: 6px; font-size: 12px; line-height: 1.45 }
  .negocio .nombre { font-weight: 700; font-size: 14px }
  .meta { margin-top: 10px; display: flex; gap: 28px; font-size: 12px }
  .meta div span { color: #555 }
  table.items { width: 100%; border-collapse: collapse; margin-top: 12px }
  table.items th { border-bottom: 2px solid #222; text-align: left; padding: 5px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .4px }
  table.items td { border-bottom: 1px solid #ddd; padding: 6px; vertical-align: top }
  td.num, th.num { text-align: right; white-space: nowrap }
  td.cant { text-align: center; white-space: nowrap }
  .tipo-precio { color: #555; font-size: 10.5px }
  .totales { margin-top: 10px; margin-left: auto; width: 78mm }
  .totales .fila { display: flex; justify-content: space-between; padding: 3px 0 }
  .totales .total { border-top: 2px solid #222; font-weight: 700; font-size: 14px; padding-top: 6px; margin-top: 4px }
  .pie { margin-top: 16mm; font-size: 11px; color: #333 }
  .gracias { text-align: center; margin-top: 14mm; font-size: 13px; font-weight: 600 }
  .firmas { margin-top: 22mm; display: flex; gap: 30mm }
  .firmas div { flex: 1; border-top: 1px solid #333; padding-top: 4px; text-align: center; font-size: 11px }
  /* Nota de entrega: bloque de recepción fijo abajo a la izquierda. El
     padding-bottom de la página evita que los ítems choquen con él. */
  .pagina-nota { padding-bottom: 62mm }
  .recibo { position: fixed; left: 18mm; bottom: 13mm; font-size: 12px }
  .recibo .linea { display: flex; align-items: flex-end; margin-top: 10mm }
  .recibo .linea:first-child { margin-top: 0 }
  .recibo .rotulo { font-weight: 700; letter-spacing: .5px }
  .recibo .espacio { width: 60mm; border-bottom: 1px solid #333; height: 14px }
  h2.titulo-reporte { text-align: center; font-size: 16px; margin: 4mm 0 }
  .bloque-venta { margin-top: 10px; border: 1px solid #ccc; border-radius: 4px; padding: 8px 10px; page-break-inside: avoid }
  .bloque-venta .head { font-weight: 700; display: flex; justify-content: space-between }
  .resumen { margin-top: 8px }
`

function pagina(contenido, titulo = 'Documento', claseBody = '') {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head><body${claseBody ? ` class="${claseBody}"` : ''}>${contenido}</body></html>`
}

function bloqueNegocio(negocio = {}) {
  const lineas = [negocio.rif, negocio.direccion, negocio.telefono].filter(Boolean).map(esc).join('<br>')
  return `<div class="negocio">
    ${LOGO_DATA_URI ? `<img class="logo" src="${LOGO_DATA_URI}" alt="">` : ''}
    ${negocio.nombre ? `<div class="nombre">${esc(negocio.nombre)}</div>` : ''}
    ${lineas ? `<div>${lineas}</div>` : ''}
  </div>`
}

// ---------- Documento de venta (factura / nota de entrega) ----------

// copia: 'original' (cliente, con "Gracias por su compra") o 'copia'
// (tienda, con zona de firma). Misma regla que los tickets cliente/tienda.
export function construirDocumentoVenta({ venta, items, negocio = {}, copia = 'original' }) {
  const esNota = venta.tipo_documento === 'nota_entrega'
  const tituloDoc = esNota ? 'NOTA DE ENTREGA' : 'FACTURA'

  const cliente = [venta.cliente_nombre || 'Sin cliente', venta.cliente_doc && `${venta.cliente_tipo_doc || ''}-${venta.cliente_doc}`]
    .filter(Boolean).map(esc).join(' · ')
  const clienteExtra = [venta.cliente_direccion, venta.cliente_telefono].filter(Boolean).map(esc).join(' · ')

  // La factura va SOLO en bolívares; la nota de entrega va en la moneda
  // elegida al venderla (nota_moneda: '$' por defecto, o Bs). Los montos
  // impresos son los guardados en la venta, nunca recalculados.
  const notaEnUsd = esNota && venta.nota_moneda !== 'bs'
  const monto = (usd, bs) => (notaEnUsd ? `$ ${formatearUsd(usd)}` : `${formatearBs(bs)} Bs`)
  const filasItems = items
    .map(
      (item) => `<tr>
        <td class="cant">${esc(item.cantidad)}</td>
        <td>${esc(item.producto_nombre)}<div class="tipo-precio">${esc(item.tipo_precio_nombre || '')}</div></td>
        <td class="num">${monto(item.precio_unitario_usd, item.precio_unitario_bs)}</td>
        <td class="num">${monto(item.subtotal_usd, item.subtotal_bs)}</td>
      </tr>`
    )
    .join('')

  // Ventas con IVA muestran Subtotal + IVA + TOTAL; las viejas (iva_* NULL)
  // solo TOTAL Bs. La nota solo TOTAL (sin IVA, método ni tasas).
  const ivaPct = Number(venta.iva_porcentaje) || 0
  const tieneIva = !esNota && ivaPct > 0 && venta.iva_bs != null
  const subtotalBs = r2(items.reduce((s, item) => s + (Number(item.subtotal_bs) || 0), 0))

  const filasTotales = esNota
    ? `<div class="fila total"><span>TOTAL${notaEnUsd ? '' : ' Bs'}</span><span>${monto(venta.total_usd, venta.total_bs)}</span></div>`
    : `
    ${tieneIva ? `<div class="fila"><span>Subtotal Bs</span><span>${formatearBs(subtotalBs)} Bs</span></div>
    <div class="fila"><span>IVA ${ivaPct}%</span><span>${formatearBs(venta.iva_bs)} Bs</span></div>` : ''}
    <div class="fila total"><span>TOTAL Bs</span><span>${formatearBs(venta.total_bs)} Bs</span></div>`

  const metodoPago = venta.metodo_pago === 'usdt' ? 'USDT · Divisas' : 'Bolívares (Bs)'
  const totalUsdt = !esNota && venta.metodo_pago === 'usdt' && venta.total_usdt != null
    ? `Total USDT: <strong>${formatearUsdt(venta.total_usdt)} USDT</strong>`
    : ''

  // La nota lleva el bloque de recepción fijo abajo a la izquierda, con
  // espacio para rellenar a mano (ORIGINAL y COPIA).
  const recibo = `<div class="recibo">
    <div class="linea"><span class="rotulo">RECIBIDO:</span><span class="espacio"></span></div>
    <div class="linea"><span class="rotulo">FECHA:</span><span class="espacio"></span></div>
    <div class="linea"><span class="rotulo">FIRMA:</span><span class="espacio"></span></div>
  </div>`

  const pie = esNota
    ? recibo
    : copia === 'copia'
      ? `<div class="firmas"><div>Recibido por</div><div>C.I. / Fecha</div></div>`
      : `<div class="gracias">Gracias por su compra</div>`

  // Las tasas NO se imprimen en ningún documento; en la factura pagada en
  // USDT solo queda el equivalente cobrado.
  const filaTasas = totalUsdt ? `<div class="pie">${totalUsdt}</div>` : ''

  return pagina(
    `<div class="cabecera">
      ${bloqueNegocio(negocio)}
      <div class="doc-box">
        <div class="tipo">${tituloDoc}</div>
        <div class="nro">Nro. ${esc(venta.numero_ticket)}</div>
        <div>${esc(formatearFechaHora(venta.creado_en))}</div>
        <div class="copia">${copia === 'copia' ? 'COPIA' : 'ORIGINAL'}</div>
      </div>
    </div>
    <div class="meta">
      <div><span>Cliente:</span> <strong>${cliente}</strong>${clienteExtra ? `<br><span>${clienteExtra}</span>` : ''}</div>
      <div><span>Vendido por:</span> ${esc(venta.usuario_nombre || '—')}${esNota ? '' : `<br><span>Método de pago:</span> ${metodoPago}`}</div>
    </div>
    <table class="items">
      <thead><tr><th class="cant" style="width:12mm">Cant.</th><th>Descripción</th><th class="num" style="width:30mm">Precio Unit.</th><th class="num" style="width:30mm">Importe</th></tr></thead>
      <tbody>${filasItems}</tbody>
    </table>
    <div class="totales">${filasTotales}</div>
    ${filaTasas}
    ${pie}`,
    `${tituloDoc} ${venta.numero_ticket}`,
    esNota ? 'pagina-nota' : ''
  )
}

// ---------- Reporte Z en carta ----------

export function construirDocumentoReporteZ({ ventas, usuarioNombre, tasaBcv, tasaUsdt, totalUnidades = 0, negocio = {} }) {
  const notas = ventas.filter((v) => v.tipo_documento === 'nota_entrega').length

  let totalGeneralBs = 0
  let totalGeneralUsd = 0
  let totalIvaBs = 0
  let totalIvaUsd = 0

  const bloques = ventas
    .map((venta) => {
      const filasItems = venta.items
        .map(
          (item) => `<tr>
            <td class="cant">${esc(item.cantidad)}</td>
            <td>${esc(item.producto_nombre)}<div class="tipo-precio">${esc(item.tipo_precio_nombre || '')}</div></td>
            <td class="num">$ ${formatearUsd(item.subtotal_usd)}</td>
            <td class="num">${formatearBs(item.subtotal_bs)} Bs</td>
          </tr>`
        )
        .join('')

      const ivaPct = Number(venta.iva_porcentaje) || 0
      const ivaLinea = ivaPct > 0 && venta.iva_bs != null
        ? `<div><span>IVA ${ivaPct}%:</span> $ ${formatearUsd(venta.iva_usd ?? 0)} · ${formatearBs(venta.iva_bs)} Bs</div>`
        : ''

      totalGeneralBs += Number(venta.total_bs) || 0
      totalGeneralUsd += Number(venta.total_usd) || 0
      totalIvaBs += Number(venta.iva_bs) || 0
      totalIvaUsd += Number(venta.iva_usd) || 0

      return `<div class="bloque-venta">
        <div class="head"><span>${esc(venta.numero_ticket)} · ${esc(venta.cliente_nombre || 'Sin cliente')}</span><span>$ ${formatearUsd(venta.total_usd)} · ${formatearBs(venta.total_bs)} Bs</span></div>
        <div class="tipo-precio" style="margin:3px 0 6px">
          ${venta.tipo_documento === 'nota_entrega' ? 'Nota de entrega' : 'Factura'} ·
          ${esc(venta.usuario_nombre || '—')}
        </div>
        <table class="items"><tbody>${filasItems}</tbody></table>
        ${ivaLinea}
      </div>`
    })
    .join('')

  return pagina(
    `<div class="cabecera">
      ${bloqueNegocio(negocio)}
      <div class="doc-box">
        <div class="tipo">REPORTE DIARIO</div>
        <div>${esc(formatearFechaHora())}</div>
        <div class="copia">Imprimió: ${esc(usuarioNombre || '—')}</div>
      </div>
    </div>
    <div class="meta">
      <div><span>Tasa BCV (USD):</span> ${formatearBs(tasaBcv)} Bs<br><span>Tasa USDT:</span> ${formatearBs(tasaUsdt)} Bs</div>
      <div><span>Ventas:</span> ${ventas.length}<br><span>Facturas:</span> ${ventas.length - notas} · <span>Notas:</span> ${notas}</div>
    </div>
    ${bloques}
    <div class="totales resumen">
      <div class="fila"><span>Total USD</span><span>$ ${formatearUsd(totalGeneralUsd)}</span></div>
      <div class="fila"><span>Total Bs</span><span>${formatearBs(totalGeneralBs)} Bs</span></div>
      <div class="fila"><span>IVA del día</span><span>$ ${formatearUsd(totalIvaUsd)} · ${formatearBs(totalIvaBs)} Bs</span></div>
      <div class="fila total"><span>Unidades vendidas</span><span>${totalUnidades}</span></div>
    </div>
    <div class="firmas"><div>Nombre del responsable</div><div>Firma</div></div>`,
    'Reporte diario'
  )
}

// ---------- Página de prueba ----------

export function construirDocumentoPrueba({ nombreImpresora = '', negocio = {} } = {}) {
  return pagina(
    `<div class="cabecera">
      ${bloqueNegocio(negocio)}
      <div class="doc-box"><div class="tipo">PRUEBA DE IMPRESIÓN</div><div>${esc(formatearFechaHora())}</div></div>
    </div>
    <div class="meta"><div><span>Impresora:</span> ${esc(nombreImpresora || '—')}</div></div>
    <table class="items">
      <thead><tr><th class="cant">Cant.</th><th>Descripción</th><th class="num">Importe</th></tr></thead>
      <tbody><tr><td class="cant">2</td><td>Producto de prueba ñ á é í ó ú</td><td class="num">1.234,56 Bs</td></tr></tbody>
    </table>
    <div class="totales"><div class="fila total"><span>TOTAL Bs</span><span>1.234,56 Bs</span></div></div>
    <div class="gracias">Si esta hoja se imprimió correctamente, la impresora está lista para facturar.</div>`,
    'Prueba de impresión'
  )
}

// ---------- Envío a la impresora ----------

export function documentosDisponibles() {
  return !!BrowserWindow
}

// Lista las impresoras del sistema vía Electron (multiplataforma, a
// diferencia de winspool que solo existe en Windows). Devuelve el mismo
// contrato que usaba listarImpresorasDelSistema: [{name, isDefault}].
export async function listarImpresorasDocumento() {
  const ventana = BrowserWindow?.getAllWindows?.()[0]
  if (!ventana) return []
  const impresoras = await ventana.webContents.getPrintersAsync()
  return impresoras.map((imp) => ({ name: imp.name, isDefault: !!imp.isDefault }))
}

// Imprime el HTML en la impresora indicada, en silencio (sin diálogo del SO)
// en hoja carta. Nunca lanza: devuelve { ok, error } para que la UI avise
// sin romper el flujo (la venta ya quedó registrada).
export async function enviarDocumentoAImpresora({ html, nombreImpresora, documento = 'Documento' }) {
  if (!documentosDisponibles()) {
    return { ok: false, error: SIN_ELECTRON }
  }
  if (!nombreImpresora) {
    return { ok: false, error: 'No hay impresora configurada. Elegí una en Configuración → Impresora.' }
  }

  let ventana = null
  try {
    ventana = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    await ventana.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    const resultado = await new Promise((resolve) => {
      ventana.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: nombreImpresora,
          pageSize: 'Letter',
          margins: { marginType: 'default' },
          jobName: documento
        },
        (exito, motivo) => resolve({ ok: exito, error: motivo || 'La impresora rechazó el trabajo' })
      )
    })
    return resultado.ok
      ? { ok: true }
      : { ok: false, error: `No se pudo imprimir "${documento}": ${resultado.error}` }
  } catch (error) {
    return { ok: false, error: error.message || 'No se pudo imprimir el documento' }
  } finally {
    ventana?.destroy()
  }
}
