// QA: la factura impresa (ticket.printer.js → construirTicketVenta) debe
// mostrar EXACTAMENTE los mismos números que la vista previa de la pantalla
// de venta (VentaView.vue, modal "Vista previa del ticket").
//
// - Las ventas se crean de verdad en una BD en memoria con los services.
// - La vista previa se simula igual que finalizarVenta(): precios de
//   listarPreciosPorProducto + calcularLinea/calcularTotales (shared) y los
//   formatters reales del renderer (useFormato.js no depende de Vue).
// - 'electron' se reemplaza con un hook de resolución (module.register) por
//   un stub cuyo nativeImage falla: el printer cae al logo de respaldo.
//
// Los desajustes de FORMATO conocidos se marcan como `todo` (se reportan
// sin romper la suite); los numéricos son asserts duros.
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

const stubElectron =
  'export const nativeImage = { createFromPath() { throw new Error("nativeImage stub (QA)") } }'
const hooks = `
export async function resolve(specifier, context, next) {
  if (specifier === 'electron') {
    return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(stubElectron)}), shortCircuit: true }
  }
  return next(specifier, context)
}`
register('data:text/javascript,' + encodeURIComponent(hooks))

const { construirTicketVenta } = await import('../src/main/printer/ticket.printer.js')
const { nuevaBaseEnMemoria } = await import('./helpers/db.mjs')
const { registrarTasa } = await import('../src/main/services/tasas.service.js')
const { registrarEntrada } = await import('../src/main/services/inventario.service.js')
const { crearCliente } = await import('../src/main/services/clientes.service.js')
const { guardarIva, obtenerIva } = await import('../src/main/services/configuracion.service.js')
const { crearVenta } = await import('../src/main/services/ventas.service.js')
const { listarPreciosPorProducto } = await import('../src/main/services/precios.service.js')
const ventasRepo = await import('../src/main/repositories/ventas.repo.js')
const { calcularLinea, calcularTotales } = await import('../src/shared/venta.calculo.js')
const { formatMontoBs } = await import('../src/renderer/src/composables/useFormato.js')

// ---------- PRNG determinista ----------
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const SEED = 20240611
const rnd = mulberry32(SEED)
const entre = (min, max) => min + Math.floor(rnd() * (max - min + 1))
const elegir = (lista) => lista[Math.floor(rnd() * lista.length)]
const conDecimales = (min, max, dec) => Number((min + rnd() * (max - min)).toFixed(dec))

const TASAS_RARAS = [36.5123, 401.37, 36.505, 1.005, 187.32, 99.995, 4013.7777, 0.5, 1234.5678]
const IVAS = [0, 8, 16, 16.5]
const NOMBRES = [
  'Filtro',
  'Bujía NGK',
  'Pastillas de freno delanteras cerámicas Toyota Hilux 2.7 2015-2023',
  'Kit de embrague completo con collarín hidráulico y volante bimasa reforzado',
  'Correa',
  'AmortiguadorTraseroIzquierdoGasHidráulicoXL900',
  'Aceite 15W40 1,5 L x 4 und',
  'Ñapa: tornillería surtida M8×1.25 (100 und)'
]

// ---------- Helpers de parsing ----------
const parseBs = (s) => Number(s.replace(/\./g, '').replace(',', '.')) // es-VE 1.234,56
const sinSufijo = (s, suf) => s.slice(0, -suf.length)

// Separa el texto del ticket en bloques por los divisores de '-'.
function parsearTicket(texto, columnas) {
  const lineas = texto.split('\n')
  const problemas = []
  for (const l of lineas) if (l.length > columnas) problemas.push(`línea de ${l.length} > ${columnas} cols: "${l}"`)
  const div = '-'.repeat(columnas)
  const idx = lineas.map((l, i) => (l === div ? i : -1)).filter((i) => i >= 0)
  if (idx.length < 3) throw new Error('No se encontraron 3 divisores en el ticket:\n' + texto)
  const encabezado = lineas.slice(idx[0] + 1, idx[1])
  const bloqueItems = lineas.slice(idx[1] + 1, idx[2])
  const bloqueTotales = []
  for (const l of lineas.slice(idx[2] + 1)) {
    if (l.trim() === '') break
    bloqueTotales.push(l)
  }

  const items = []
  let acumulado = []
  for (const l of bloqueItems) {
    const m = /^ +([\d.,]+) Bs$/.exec(l)
    if (m && l.length === columnas) {
      const unido = acumulado.join(' ')
      const u = /- ([\d.,]+) Bs c\/u$/.exec(unido)
      items.push({ texto: unido, crudo: [...acumulado], unitarioStr: u?.[1] ?? null, subtotalStr: m[1] })
      acumulado = []
    } else {
      acumulado.push(l)
    }
  }
  if (acumulado.length) problemas.push('líneas de items sin subtotal: ' + JSON.stringify(acumulado))

  const totales = { ivaLabels: [] }
  for (const l of bloqueTotales) {
    let m
    if ((m = /^Subtotal Bs +(\S+)$/.exec(l))) totales.subtotalBs = m[1]
    else if ((m = /^IVA (\S+)% +(\S+) USDT$/.exec(l))) { totales.ivaUsdt = m[2]; totales.ivaLabels.push(m[1]) }
    else if ((m = /^IVA (\S+)% +(\S+)$/.exec(l))) { totales.ivaBs = m[2]; totales.ivaLabels.push(m[1]) }
    else if ((m = /^TOTAL Bs +(\S+)$/.exec(l))) totales.totalBs = m[1]
    else if (/^Pago: +USDT$/.test(l)) totales.pagoUsdt = true
    else if ((m = /^Subtotal USDT +(\S+) USDT$/.exec(l))) totales.subtotalUsdt = m[1]
    else if ((m = /^TOTAL USDT +(\S+) USDT$/.exec(l))) totales.totalUsdt = m[1]
    else problemas.push(`línea de totales no reconocida / superpuesta: "${l}"`)
    if (l.length !== columnas) problemas.push(`línea de totales no alineada (${l.length} cols): "${l}"`)
  }
  const tasa = encabezado.map((l) => /^Tasa BCV: +(\S+) Bs\/USD$/.exec(l)).find(Boolean)?.[1] ?? null
  return { items, totales, tasa, problemas, encabezado }
}

// ---------- Generación de escenarios ----------
function generarEscenario(n) {
  const tasaBcv = rnd() < 0.4 ? elegir(TASAS_RARAS) : conDecimales(1, 5000, entre(2, 4))
  const tasaUsdt = rnd() < 0.2 ? tasaBcv : Number((tasaBcv * (1 + rnd() * 0.35)).toFixed(entre(2, 4)))
  const iva = n < IVAS.length * 2 ? IVAS[n % IVAS.length] : elegir(IVAS)
  const metodo = n % 2 === 0 ? 'bs' : 'usdt'
  const lineas = Array.from({ length: entre(1, 6) }, () => ({
    costo: rnd() < 0.15 ? elegir([0.01, 0.005, 1.005, 2.675, 0.125, 9999.99]) : conDecimales(0.01, 2500, entre(0, 4)),
    margenes: [1, 2, 3].map((t) => ({ tipoPrecioId: t, margen: rnd() < 0.2 ? elegir([0, 33.333, 12.5, 250]) : conDecimales(0, 300, entre(0, 3)) })),
    tipoPrecioId: entre(1, 3),
    cantidad: entre(1, 40),
    nombre: elegir(NOMBRES) + ' #' + n
  }))
  return { n, tasaBcv, tasaUsdt, iva, metodo, lineas }
}

// Vista previa simulada tal cual VentaView.finalizarVenta().
function vistaPrevia({ productos, ivaPct, metodo }) {
  const detallado = productos.map((p) => {
    const precio = listarPreciosPorProducto(p.productoId).find((x) => x.id === p.precioId)
    const linea = calcularLinea(precio, p.cantidad, ivaPct)
    return { ...p, precio, linea }
  })
  const t = calcularTotales(detallado.map((d) => d.linea))
  return {
    metodoPago: metodo,
    ivaPorcentaje: ivaPct,
    items: detallado.map((d) => ({
      precioId: d.precioId,
      cantidad: d.cantidad,
      nombre: d.nombre,
      tipoPrecioNombre: d.precio.tipoPrecioNombre,
      unitarioBs: d.linea.unitario.bs,
      subtotalBs: d.linea.subtotal.bs
    })),
    subtotalBs: t.subtotal.bs,
    subtotalUsdt: t.subtotal.usdt,
    ivaBs: t.iva.bs,
    ivaUsdt: t.iva.usdt,
    totalBs: t.total.bs,
    totalUsdt: t.total.usdt
  }
}

// Corre un escenario completo; devuelve preview + tickets impresos.
function ejecutarEscenario(esc) {
  const db = nuevaBaseEnMemoria()
  try {
    const usuarioId = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id
    registrarTasa({ valorBcv: esc.tasaBcv, valorUsdt: esc.tasaUsdt, usuarioId })
    guardarIva(esc.iva)
    const proveedorId = db.prepare("INSERT INTO proveedores (nombre, activo) VALUES ('Prov QA', 1)").run().lastInsertRowid
    const clienteId = crearCliente({ nombre: 'Cliente QA ' + esc.n }).id
    const productos = esc.lineas.map((l, i) => {
      const productoId = db
        .prepare('INSERT INTO productos (codigo, nombre) VALUES (?, ?)')
        .run(`QA-${esc.n}-${i}`, l.nombre).lastInsertRowid
      registrarEntrada({ productoId, cantidad: 100, proveedorId, precioCompraUsd: l.costo, usuarioId, margenes: l.margenes })
      const precioId = db
        .prepare('SELECT id FROM precios WHERE producto_id = ? AND tipo_precio_id = ?')
        .get(productoId, l.tipoPrecioId).id
      return { productoId, precioId, cantidad: l.cantidad, nombre: l.nombre }
    })

    const preview = vistaPrevia({ productos, ivaPct: obtenerIva(), metodo: esc.metodo })
    // Igual que imprimirYCerrar(): manda lo que mostró como totalesEsperados.
    const creada = crearVenta({
      clienteId,
      usuarioId,
      metodoPago: esc.metodo,
      items: productos.map((p) => ({ precioId: p.precioId, cantidad: p.cantidad })),
      totalesEsperados: {
        ivaPorcentaje: preview.ivaPorcentaje,
        subtotalBs: preview.subtotalBs,
        ivaBs: preview.ivaBs,
        totalBs: preview.totalBs,
        totalUsdt: preview.totalUsdt
      }
    })
    const venta = ventasRepo.buscarPorId(creada.id)
    const items = ventasRepo.detalleDeVenta(creada.id)
    const tickets = []
    for (const ancho of ['80mm', '58mm']) {
      for (const copia of ['cliente', 'tienda']) {
        const recibo = construirTicketVenta({ venta, items, ancho, copia })
        tickets.push({ ancho, copia, columnas: recibo.config.columns, texto: recibo.preview() })
      }
    }
    return { preview, venta, items, tickets }
  } finally {
    db.close()
  }
}

// ---------- Ejecución ----------
const N_ESCENARIOS = 160
const resultados = []
for (let n = 0; n < N_ESCENARIOS; n += 1) {
  const esc = generarEscenario(n)
  resultados.push({ esc, ...ejecutarEscenario(esc) })
}

const desc = (esc, t) =>
  `#${esc.n} ${t.ancho}/${t.copia} bcv=${esc.tasaBcv} usdt=${esc.tasaUsdt} iva=${esc.iva} pago=${esc.metodo}`

test(`QA: ${N_ESCENARIOS} escenarios × 2 anchos × 2 copias, montos impresos = vista previa (numérico)`, () => {
  const fallos = []
  for (const { esc, preview, tickets } of resultados) {
    for (const t of tickets) {
      const p = parsearTicket(t.texto, t.columnas)
      const d = desc(esc, t)
      for (const pr of p.problemas) fallos.push(`${d}: ${pr}`)
      const cmp = (campo, impreso, esperado, parse) => {
        if (esperado == null && impreso == null) return
        if (impreso == null) return fallos.push(`${d}: falta ${campo} en el ticket (preview ${esperado})`)
        if (esperado == null) return fallos.push(`${d}: ${campo} impreso (${impreso}) pero la preview no lo muestra`)
        if (parse(impreso) !== esperado) fallos.push(`${d}: ${campo} preview=${esperado} impreso=${impreso}`)
      }
      if (p.items.length !== preview.items.length) fallos.push(`${d}: ${p.items.length} items impresos vs ${preview.items.length}`)
      preview.items.forEach((it, i) => {
        const imp = p.items[i]
        if (!imp) return
        const esperadoTexto = `${it.cantidad} x ${it.nombre} ${it.tipoPrecioNombre} - `
        if (!imp.texto.replace(/\s+/g, '').startsWith(esperadoTexto.replace(/\s+/g, '')))
          fallos.push(`${d}: item ${i} texto "${imp.texto}" ≠ "${esperadoTexto}…"`)
        cmp(`item${i}.unitarioBs`, imp.unitarioStr, it.unitarioBs, parseBs)
        cmp(`item${i}.subtotalBs`, imp.subtotalStr, it.subtotalBs, parseBs)
      })
      const conIva = preview.ivaPorcentaje > 0
      cmp('subtotalBs', p.totales.subtotalBs, conIva ? preview.subtotalBs : null, parseBs)
      cmp('ivaBs', p.totales.ivaBs, conIva ? preview.ivaBs : null, parseBs)
      cmp('totalBs', p.totales.totalBs, preview.totalBs, parseBs)
      // La factura va SOLO en bolívares, pague en Bs o en USDT.
      if (p.totales.pagoUsdt || p.totales.subtotalUsdt || p.totales.ivaUsdt || p.totales.totalUsdt)
        fallos.push(`${d}: la factura muestra montos USDT`)
      // Etiqueta "IVA X%" = la de la preview (`IVA {{ ivaPorcentaje }}%`).
      for (const lbl of p.totales.ivaLabels)
        if (lbl !== String(preview.ivaPorcentaje)) fallos.push(`${d}: etiqueta IVA impresa "${lbl}%" vs preview "${preview.ivaPorcentaje}%"`)
    }
  }
  assert.deepEqual(fallos.slice(0, 40), [], `${fallos.length} desajustes numéricos/de maquetación`)
})

test('QA: los montos en Bs impresos son el MISMO string que formatMontoBs de la preview', () => {
  const fallos = []
  for (const { esc, preview, tickets } of resultados) {
    for (const t of tickets) {
      const p = parsearTicket(t.texto, t.columnas)
      const ver = (campo, impreso, valor) => {
        if (valor == null || impreso == null) return
        const enPantalla = sinSufijo(formatMontoBs(valor), ' Bs')
        if (impreso !== enPantalla) fallos.push(`${desc(esc, t)}: ${campo} pantalla "${enPantalla}" impreso "${impreso}"`)
      }
      preview.items.forEach((it, i) => {
        ver(`item${i}.unitario`, p.items[i]?.unitarioStr, it.unitarioBs)
        ver(`item${i}.subtotal`, p.items[i]?.subtotalStr, it.subtotalBs)
      })
      ver('subtotalBs', p.totales.subtotalBs, preview.subtotalBs)
      ver('ivaBs', p.totales.ivaBs, preview.ivaBs)
      ver('totalBs', p.totales.totalBs, preview.totalBs)
    }
  }
  assert.deepEqual(fallos.slice(0, 20), [], `${fallos.length} strings Bs distintos`)
})

// La factura (copia cliente y tienda, 58 y 80mm) no puede mencionar dólares
// en ninguna forma: ni montos ni tasas en $, USD o USDT.
test('QA: la factura impresa no tiene ninguna referencia a dólares ($, USD, USDT)', () => {
  const fallos = []
  for (const { esc, tickets } of resultados) {
    for (const t of tickets) {
      const linea = t.texto.split('\n').find((l) => /\$|\bUSDT?\b|D[oó]lar/i.test(l))
      if (linea) fallos.push(`${desc(esc, t)}: "${linea.trim()}"`)
    }
  }
  assert.deepEqual(fallos.slice(0, 10), [], `${fallos.length} tickets con referencias a dólares`)
})

// Fronteras de redondeo: ambos formatters de Bs usan Intl con las mismas
// opciones, así que deben coincidir siempre, incluso en .xx5 y valores
// grandes. Se pasa una venta sintética directo al printer.
test('QA: frontera de redondeo .005 / valores grandes — formatearBs (printer) ≡ formatMontoBs (pantalla)', () => {
  const valores = [0, 0.005, 0.015, 1.005, 2.675, 1.045, 10.235, 1234.565, 99999.995, 1e6 + 0.005, 12345678.9, 0.1 + 0.2]
  const fallos = []
  for (const v of valores) {
    const venta = { numero_ticket: 'T-QA', creado_en: '2024-01-01 12:00:00', tasa_bcv: 1, metodo_pago: 'bs', iva_porcentaje: 0, total_bs: v }
    const items = [{ cantidad: 1, producto_nombre: 'X', tipo_precio_nombre: 'T', precio_unitario_bs: v, subtotal_bs: v }]
    const recibo = construirTicketVenta({ venta, items, ancho: '80mm' })
    const p = parsearTicket(recibo.preview(), recibo.config.columns)
    const pantalla = sinSufijo(formatMontoBs(v), ' Bs')
    for (const [campo, impreso] of [['unit', p.items[0].unitarioStr], ['sub', p.items[0].subtotalStr], ['total', p.totales.totalBs]])
      if (impreso !== pantalla) fallos.push(`${v} ${campo}: pantalla "${pantalla}" impreso "${impreso}"`)
  }
  assert.deepEqual(fallos, [])
})

test('QA: la venta guardada coincide con la preview y se cubrieron todas las combinaciones', () => {
  const combos = new Set()
  let lineas = 0
  for (const { esc, preview, venta, items } of resultados) {
    combos.add(`${esc.iva}|${esc.metodo}`)
    lineas += items.length
    assert.equal(venta.total_bs, preview.totalBs)
    assert.equal(venta.total_usdt, preview.totalUsdt)
    assert.equal(venta.iva_bs ?? 0, preview.ivaBs)
    assert.equal(venta.iva_porcentaje, preview.ivaPorcentaje)
  }
  assert.equal(combos.size, IVAS.length * 2, 'cada IVA × método')
  assert.ok(lineas >= N_ESCENARIOS, `${lineas} líneas`)
})
