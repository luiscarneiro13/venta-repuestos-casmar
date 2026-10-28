import { formatFechaHoraUtc } from './useFormato.js'
import { exportarXlsx } from './useExportarXlsx.js'

export async function exportarInventario() {
  const [productos, tipos, precios, movimientos] = await Promise.all([
    window.api.productos.listar({ incluirInactivos: true }),
    window.api.tiposPrecio.listar(),
    window.api.precios.listar({ incluirProductosInactivos: true }),
    window.api.inventario.listarMovimientos()
  ])
  const pestanas = crearPestanasInventario(productos, tipos, precios, movimientos)
  exportarXlsx(`inventario-${new Date().toISOString().slice(0, 10)}.xlsx`, pestanas)
}

export function crearPestanasInventario(productos, tipos, precios, movimientos) {
  // Solo tipos activos: los inactivos tienen sus precios desactivados y
  // generarían una columna vacía.
  const tiposActivos = tipos.filter((t) => t.activo !== 0)
  const preciosPorProducto = new Map()
  for (const precio of precios) {
    if (!preciosPorProducto.has(precio.producto_id)) preciosPorProducto.set(precio.producto_id, new Map())
    preciosPorProducto.get(precio.producto_id).set(precio.tipo_precio_id, precio.valor_usd)
  }
  const codigoPorProducto = new Map(productos.map((p) => [p.id, p.codigo || '']))

  const pestanas = [
    {
      nombre: 'Productos',
      encabezados: ['Código', 'Código de barra', 'Producto', 'Marca', 'Categoría', 'Descripción', 'Unidad', 'Estado', 'Stock', 'Mínimo', 'Compra (USD)', ...tiposActivos.map((t) => `${t.nombre} (USD)`)],
      filas: productos.map((p) => [
        p.codigo || '', p.codigo_barras || '', p.nombre, p.marca, p.categoria_nombre || '', p.descripcion, p.unidad_medida,
        p.activo ? 'Activo' : 'Inactivo', p.stock, p.stock_minimo ?? 0, p.precio_compra_usd,
        ...tiposActivos.map((t) => preciosPorProducto.get(p.id)?.get(t.id) ?? null)
      ])
    },
    {
      nombre: 'Movimientos',
      encabezados: ['Fecha', 'Código', 'Producto', 'Tipo', 'Cantidad', 'Saldo', 'Proveedor', 'Motivo', 'Registrado por', 'Venta ID'],
      filas: movimientos.map((m) => [
        formatFechaHoraUtc(m.creado_en),
        codigoPorProducto.get(m.producto_id) || '',
        m.producto_nombre, m.tipo === 'entrada' ? 'Entrada' : 'Salida',
        m.tipo === 'entrada' ? m.cantidad : -m.cantidad, m.saldo,
        m.proveedor_nombre || '', m.motivo, m.usuario_nombre || '', m.venta_id
      ])
    }
  ]

  return pestanas
}
