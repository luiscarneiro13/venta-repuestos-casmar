import { reactive } from 'vue'

// Datos ficticios en memoria para las pantallas que todavía no tienen
// backend propio (inventario). El catálogo de precios, clientes y ventas
// SÍ vienen de la base de datos real. Los valores son los mismos que
// Docs/casmar-pos-demo.html para poder comparar el aspecto de ambos uno a uno.
export const demoData = reactive({
  stockBolsas: 640,
  movimientosInventario: [
    { fecha: '27/08/2026 06:00', tipo: 'entrada', cantidad: 400, motivo: 'Producción del turno mañana', saldo: 640 },
    { fecha: '26/08/2026 18:30', tipo: 'salida', cantidad: 60, motivo: 'Venta T-0004', saldo: 240 },
    { fecha: '26/08/2026 10:47', tipo: 'salida', cantidad: 120, motivo: 'Venta T-0003', saldo: 300 },
    { fecha: '26/08/2026 06:00', tipo: 'entrada', cantidad: 420, motivo: 'Producción del turno mañana', saldo: 420 }
  ]
})

export function registrarSalidaInventario(cantidad, motivo) {
  demoData.stockBolsas -= cantidad
  demoData.movimientosInventario.unshift({
    fecha: '27/08/2026',
    tipo: 'salida',
    cantidad,
    motivo,
    saldo: demoData.stockBolsas
  })
}

export function registrarEntradaInventario(cantidad, nota) {
  demoData.stockBolsas += cantidad
  demoData.movimientosInventario.unshift({
    fecha: '27/08/2026',
    tipo: 'entrada',
    cantidad,
    motivo: nota || 'Producción registrada',
    saldo: demoData.stockBolsas
  })
}
