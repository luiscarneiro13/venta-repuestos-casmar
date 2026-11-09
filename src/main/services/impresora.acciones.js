import {
  construirDocumentoPrueba,
  construirDocumentoReporteZ,
  construirDocumentoVenta,
  enviarDocumentoAImpresora
} from '../printer/documento.printer.js'

// Acciones de impresión que ya reciben los datos listos y la configuración
// de la impresora DE ESTA PC. Las usa el servicio del servidor (datos + print
// en la misma máquina) y los handlers locales del esclavo (datos por HTTP +
// print en su propia impresora).
//
// Todo se imprime en hoja carta en la impresora de oficina configurada
// (documento.printer.js → webContents.print). El módulo térmico
// ticket.printer.js queda como referencia/legado, sin uso en la app.

export async function imprimirPruebaLocal({ nombre, negocio }) {
  return enviarDocumentoAImpresora({
    nombreImpresora: nombre,
    html: construirDocumentoPrueba({ nombreImpresora: nombre, negocio }),
    documento: 'Prueba de impresión'
  })
}

// Imprime la venta en hoja carta, `copias` veces (1 o 2). Con 2 copias salen
// dos trabajos rotulados ORIGINAL (para el cliente) y COPIA (para la tienda,
// con línea de firma). Nunca lanza: devuelve { ok, error }.
export async function imprimirDocumentosVentaLocal({ venta, items, negocio }, { nombre }, copias = 2) {
  const rotulos = Math.max(1, copias) === 1 ? ['original'] : ['original', 'copia']
  for (const rotulo of rotulos) {
    const resultado = await enviarDocumentoAImpresora({
      nombreImpresora: nombre,
      html: construirDocumentoVenta({ venta, items, negocio, copia: rotulo }),
      documento: `${venta.numero_ticket} - ${rotulo === 'copia' ? 'COPIA' : 'ORIGINAL'}`
    })
    if (!resultado.ok) return resultado
  }
  return { ok: true }
}

// Vista previa del documento de venta como HTML listo para imprimir
// (o para mostrar en un iframe), sin gastar papel.
export function previsualizarDocumentoVentaLocal({ venta, items, negocio }) {
  return construirDocumentoVenta({ venta, items, negocio, copia: 'original' })
}

// Imprime el reporte diario/Z en hoja carta. Nunca lanza.
export async function imprimirReporteZLocal({ ventas, usuarioNombre, tasaBcv, tasaUsdt, totalUnidades, negocio, documento }, { nombre }) {
  try {
    const html = construirDocumentoReporteZ({ ventas, usuarioNombre, tasaBcv, tasaUsdt, totalUnidades, negocio })
    return enviarDocumentoAImpresora({ nombreImpresora: nombre, html, documento })
  } catch (error) {
    return { ok: false, error: error.message || 'No se pudo armar el reporte' }
  }
}
