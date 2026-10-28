import {
  construirTicketPrueba,
  construirTicketReporteZ,
  construirTicketVenta,
  enviarAImpresora
} from '../printer/ticket.printer.js'

// Acciones de impresión que ya reciben los datos listos y la configuración
// de la impresora DE ESTA PC. Las usa el servicio del servidor (datos + print
// en la misma máquina) y los handlers locales del esclavo (datos por HTTP +
// print en su propia impresora).

export async function imprimirPruebaLocal({ nombre, ancho }) {
  return enviarAImpresora({
    nombreImpresora: nombre,
    bytes: construirTicketPrueba({ ancho, nombreImpresora: nombre }).encode(),
    documento: 'Prueba de impresion'
  })
}

// Imprime los 2 tickets de la venta: copia del cliente (valida la impresora)
// y copia de la tienda. Nunca lanza: devuelve { ok, error }.
export async function imprimirTicketsVentaLocal({ venta, items }, { nombre, ancho }) {
  try {
    const bytesCliente = construirTicketVenta({ venta, items, ancho, copia: 'cliente' }).encode()
    const resultadoCliente = await enviarAImpresora({
      nombreImpresora: nombre,
      bytes: bytesCliente,
      documento: `Ticket ${venta.numero_ticket} - Cliente`,
      validar: true
    })
    if (!resultadoCliente.ok) return resultadoCliente

    const bytesTienda = construirTicketVenta({ venta, items, ancho, copia: 'tienda' }).encode()
    return await enviarAImpresora({
      nombreImpresora: nombre,
      bytes: bytesTienda,
      documento: `Ticket ${venta.numero_ticket} - Tienda`,
      validar: false
    })
  } catch (error) {
    return { ok: false, error: error.message || 'No se pudo armar el ticket' }
  }
}

// Vista previa en texto del ticket (copia del cliente), sin gastar papel.
export function previsualizarTicketVentaLocal({ venta, items }, ancho) {
  return construirTicketVenta({ venta, items, ancho, copia: 'cliente' }).preview()
}

// Imprime el reporte diario/Z con datos ya armados. Nunca lanza.
export async function imprimirReporteZLocal({ ventas, usuarioNombre, tasaBcv, tasaUsdt, totalUnidades, documento }, { nombre, ancho }) {
  try {
    const bytes = construirTicketReporteZ({ ventas, usuarioNombre, tasaBcv, tasaUsdt, totalUnidades, ancho }).encode()
    return enviarAImpresora({ nombreImpresora: nombre, bytes, documento })
  } catch (error) {
    return { ok: false, error: error.message || 'No se pudo armar el reporte' }
  }
}
