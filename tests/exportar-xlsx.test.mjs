import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generarXlsx } from '../src/renderer/src/composables/useExportarXlsx.js'
import { crearPestanasInventario } from '../src/renderer/src/composables/useExportarInventario.js'

test('inventario exporta todos los productos y movimientos en pestañas independientes', () => {
  const pestanas = crearPestanasInventario(
    [
      { id: 1, codigo: 'A', nombre: 'Aceite', marca: '', descripcion: '', unidad_medida: 'unidad', activo: 1, stock: 4, precio_compra_usd: 3 },
      { id: 2, codigo: 'B', nombre: 'Bujía', marca: '', descripcion: '', unidad_medida: 'unidad', activo: 0, stock: 0, precio_compra_usd: 2 }
    ],
    [{ id: 1, nombre: 'Precio 1' }],
    [{ producto_id: 1, tipo_precio_id: 1, valor_usd: 7 }, { producto_id: 2, tipo_precio_id: 1, valor_usd: 5 }],
    [
      { producto_id: 1, producto_nombre: 'Aceite', tipo: 'entrada', cantidad: 6, saldo: 6, creado_en: '2026-10-21 12:00:00', proveedor_nombre: 'Proveedor', motivo: 'Compra', usuario_nombre: 'Admin', venta_id: null },
      { producto_id: 1, producto_nombre: 'Aceite', tipo: 'salida', cantidad: 2, saldo: 4, creado_en: '2026-10-21 13:00:00', proveedor_nombre: null, motivo: 'Venta', usuario_nombre: 'Admin', venta_id: 10 }
    ]
  )
  assert.deepEqual(pestanas.map((p) => p.nombre), ['Productos', 'Movimientos'])
  assert.equal(pestanas[0].filas.length, 2)
  assert.equal(pestanas[0].filas[1].at(-1), 5)
  assert.equal(pestanas[1].filas.length, 2)
  assert.equal(pestanas[1].filas[1][4], -2)
  assert.equal(pestanas[1].filas[1].at(-1), 10)
})

test('genera un libro Excel con Productos y Movimientos, números y textos seguros', () => {
  const datos = generarXlsx([
    { nombre: 'Productos', encabezados: ['Nombre', 'Stock'], filas: [['Filtro & aceite', 8]] },
    { nombre: 'Movimientos', encabezados: ['Nota', 'Cantidad'], filas: [['=1+1 <prueba>', -2]] }
  ])
  assert.equal(new DataView(datos.buffer).getUint32(0, true), 0x04034b50)

  const archivos = new Map()
  const decoder = new TextDecoder()
  let offset = 0
  while (new DataView(datos.buffer).getUint32(offset, true) === 0x04034b50) {
    const cabecera = new DataView(datos.buffer, offset)
    const tamano = cabecera.getUint32(18, true)
    const longitudNombre = cabecera.getUint16(26, true)
    const longitudExtra = cabecera.getUint16(28, true)
    const inicio = offset + 30
    const nombre = decoder.decode(datos.subarray(inicio, inicio + longitudNombre))
    const contenido = inicio + longitudNombre + longitudExtra
    archivos.set(nombre, decoder.decode(datos.subarray(contenido, contenido + tamano)))
    offset = contenido + tamano
  }
  assert.match(archivos.get('xl/workbook.xml'), /name="Productos".*name="Movimientos"/)
  assert.match(archivos.get('xl/worksheets/sheet1.xml'), /Filtro &amp; aceite/)
  assert.match(archivos.get('xl/worksheets/sheet1.xml'), /<c r="B2"><v>8<\/v><\/c>/)
  assert.match(archivos.get('xl/worksheets/sheet2.xml'), /<t xml:space="preserve">=1\+1 &lt;prueba&gt;<\/t>/)
  assert.match(archivos.get('xl/worksheets/sheet2.xml'), /<c r="B2"><v>-2<\/v><\/c>/)
  assert.equal(archivos.size, 6)
})
