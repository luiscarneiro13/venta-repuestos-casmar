// QA de conciliación pantalla ↔ backend ↔ factura.
//
// Propiedad: para cualquier combinación de costo, márgenes, tasas, IVA,
// carrito y método de pago, los montos que muestra la pantalla de venta
// (PriceCard, línea del carrito, totales y vista previa de la factura) son
// EXACTAMENTE los que crearVenta guarda en ventas/venta_detalle (que es lo
// que imprime el ticket). Escenarios generados con un PRNG con semilla fija
// (deterministas y reproducibles).
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import { registrarTasa, obtenerUltimaTasa } from '../src/main/services/tasas.service.js'
import { registrarEntrada } from '../src/main/services/inventario.service.js'
import { crearVenta } from '../src/main/services/ventas.service.js'
import { crearCliente } from '../src/main/services/clientes.service.js'
import { obtenerIva, guardarIva } from '../src/main/services/configuracion.service.js'
import { listarPreciosPorProducto } from '../src/main/services/precios.service.js'
import * as ventasRepo from '../src/main/repositories/ventas.repo.js'
import { calcularLinea, calcularTotales, r2, MONEDAS } from '../src/shared/venta.calculo.js'

const SEMILLA = 0x5eed2024
const ESCENARIOS = 320
const ESCENARIOS_NEGATIVOS = 60

let db = null
afterEach(() => {
  db?.close()
  db = null
})

// ---------- PRNG determinista (mulberry32) ----------
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
const crearAzar = (seed) => {
  const rnd = mulberry32(seed)
  const entre = (min, max) => min + rnd() * (max - min)
  const entero = (min, max) => Math.floor(entre(min, max + 1))
  const uno = (lista) => lista[Math.floor(rnd() * lista.length)]
  const dec = (n, d) => Number(n.toFixed(d))
  return { rnd, entre, entero, uno, dec }
}

// ---------- Generadores ----------
function generarCosto(az) {
  const rango = az.uno(['centavos', 'chico', 'medio', 'grande', 'fijo'])
  const d = az.uno([2, 3])
  if (rango === 'fijo') return az.uno([0.37, 12.345, 0.01, 1.005, 2.675, 99.999, 0.125, 1234.565, 10.1, 0.995])
  if (rango === 'centavos') return Math.max(0.01, az.dec(az.entre(0.01, 1), d))
  if (rango === 'chico') return az.dec(az.entre(1, 100), d)
  if (rango === 'medio') return az.dec(az.entre(100, 2000), d)
  return az.dec(az.entre(2000, 20000), d)
}
const generarMargen = (az) =>
  az.rnd() < 0.7 ? az.uno([0, 7.5, 33, 100, 250, 12.5, 45, 66.66, 150]) : az.dec(az.entre(0, 300), az.uno([0, 1, 2]))
function generarTasas(az) {
  const bcv = az.rnd() < 0.4
    ? az.uno([36.5123, 401.37, 1, 100, 36.25, 47.8912, 0.9999, 1234.5678])
    : az.dec(az.entre(1, 1000), az.uno([2, 3, 4]))
  // Binance más alta (lo usual) o más baja que el BCV.
  const factor = az.rnd() < 0.75 ? az.entre(1.0, 1.6) : az.entre(0.7, 1.0)
  const usdt = Math.max(0.0001, az.dec(bcv * factor, az.uno([2, 3, 4])))
  return { bcv, usdt }
}
const generarIva = (az) =>
  az.rnd() < 0.8 ? az.uno([0, 8, 12, 16, 16.5, 100]) : az.dec(az.entre(0, 100), az.uno([0, 1, 2]))

// ---------- Montaje de la BD ----------
const adminId = (db) => db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id

function montarEscenario(az, n) {
  db?.close()
  db = nuevaBaseEnMemoria()
  const usuarioId = adminId(db)
  const tasas = generarTasas(az)
  registrarTasa({ valorBcv: tasas.bcv, valorUsdt: tasas.usdt, usuarioId })
  const iva = generarIva(az)
  guardarIva(iva)
  const proveedorId = db.prepare("INSERT INTO proveedores (nombre, activo) VALUES ('Prov QA', 1)").run().lastInsertRowid
  const tipos = db.prepare('SELECT id FROM tipos_precio WHERE activo = 1 ORDER BY orden').all().map((t) => t.id)
  const nProductos = az.entero(1, 4)
  const productos = []
  for (let i = 0; i < nProductos; i++) {
    const productoId = db
      .prepare('INSERT INTO productos (codigo, nombre) VALUES (?, ?)')
      .run(`QA-${n}-${i}`, `Producto QA ${n}-${i}`).lastInsertRowid
    const costo = generarCosto(az)
    const margenes = tipos.map((tipoPrecioId) => ({ tipoPrecioId, margen: generarMargen(az) }))
    registrarEntrada({ productoId, cantidad: 100000, proveedorId, precioCompraUsd: costo, usuarioId, margenes })
    productos.push({ productoId, costo, margenes })
  }
  const clienteId = crearCliente({ nombre: `Cliente QA ${n}` }).id
  return { usuarioId, clienteId, tasas, iva, productos }
}

// Elige 1–8 pares (producto, tipo de precio) distintos y cantidades 1–50.
function generarCarrito(az, esc) {
  const pares = []
  for (const p of esc.productos) for (const m of p.margenes) pares.push({ ...p, tipoPrecioId: m.tipoPrecioId, margen: m.margen })
  for (let i = pares.length - 1; i > 0; i--) {
    const j = Math.floor(az.rnd() * (i + 1))
    ;[pares[i], pares[j]] = [pares[j], pares[i]]
  }
  const n = Math.min(pares.length, az.entero(1, 8))
  return pares.slice(0, n).map((p) => ({ ...p, cantidad: az.uno([1, 1, 2, 3, 50]) === 50 ? 50 : az.entero(1, 50) }))
}

// ---------- Simulación exacta del renderer (VentaView.vue) ----------
// Pasa por un clon estructurado como el IPC de Electron.
const viaIpc = (v) => structuredClone(v)

function simularPantalla(carrito) {
  const ivaPorcentaje = viaIpc(obtenerIva())
  const cache = new Map()
  const lineas = carrito.map((item) => {
    if (!cache.has(item.productoId)) cache.set(item.productoId, viaIpc(listarPreciosPorProducto(item.productoId)))
    const precio = cache.get(item.productoId).find((p) => p.tipoPrecioId === item.tipoPrecioId)
    assert.ok(precio && precio.id, 'el tipo de precio debe estar materializado')
    return {
      precioId: precio.id,
      cantidad: item.cantidad,
      precio,
      card: calcularLinea(precio, 1, ivaPorcentaje), // PriceCard
      linea: calcularLinea(precio, item.cantidad, ivaPorcentaje) // línea del carrito
    }
  })
  const totales = calcularTotales(lineas.map((l) => l.linea))
  const modal = {
    ivaPorcentaje,
    items: lineas.map((l) => ({ unitarioBs: l.linea.unitario.bs, subtotalBs: l.linea.subtotal.bs, unitarioUsdt: l.linea.unitario.usdt, subtotalUsdt: l.linea.subtotal.usdt })),
    subtotalBs: totales.subtotal.bs,
    subtotalUsdt: totales.subtotal.usdt,
    ivaBs: totales.iva.bs,
    ivaUsdt: totales.iva.usdt,
    totalBs: totales.total.bs,
    totalUsdt: totales.total.usdt
  }
  const totalesEsperados = {
    ivaPorcentaje: modal.ivaPorcentaje,
    subtotalBs: modal.subtotalBs,
    ivaBs: modal.ivaBs,
    totalBs: modal.totalBs,
    totalUsdt: modal.totalUsdt
  }
  return { ivaPorcentaje, lineas, totales, modal, totalesEsperados }
}

const cents = (x) => Math.round(Number(x) * 100)

// ---------- Prueba principal ----------
test(`conciliación pantalla = backend = factura en ${ESCENARIOS} escenarios aleatorios`, () => {
  const az = crearAzar(SEMILLA)
  const fallos = []
  let lineasVerificadas = 0
  let porMetodo = { bs: 0, usdt: 0 }
  let conIvaCero = 0

  for (let n = 0; n < ESCENARIOS; n++) {
    const esc = montarEscenario(az, n)
    const carrito = generarCarrito(az, esc)
    const metodoPago = az.rnd() < 0.5 ? 'bs' : 'usdt'
    const pantalla = simularPantalla(carrito)
    const ctx = (extra) => ({
      escenario: n,
      tasas: esc.tasas,
      iva: esc.iva,
      metodoPago,
      ...extra
    })
    const difiere = (capa, campo, esperado, real, extra = {}) => {
      if (!Object.is(esperado, real) && esperado !== real) fallos.push({ capa, campo, esperado, real, ...ctx(extra) })
    }

    let venta
    try {
      venta = crearVenta({
        clienteId: esc.clienteId,
        usuarioId: esc.usuarioId,
        metodoPago,
        items: pantalla.lineas.map((l) => ({ precioId: l.precioId, cantidad: l.cantidad })),
        totalesEsperados: pantalla.totalesEsperados
      })
    } catch (e) {
      fallos.push({ capa: 'crearVenta', campo: 'throw', esperado: 'sin error', real: e.message, ...ctx({ carrito, totalesEsperados: pantalla.totalesEsperados }) })
      continue
    }
    porMetodo[metodoPago]++
    if (esc.iva === 0) conIvaCero++

    const guardada = db.prepare('SELECT * FROM ventas WHERE id = ?').get(venta.id)
    const detalle = ventasRepo.detalleDeVenta(venta.id)
    difiere('venta_detalle', 'nº de líneas', pantalla.lineas.length, detalle.length)
    difiere('ventas', 'metodo_pago', metodoPago, guardada.metodo_pago)
    difiere('ventas', 'iva_porcentaje', pantalla.ivaPorcentaje, guardada.iva_porcentaje)
    difiere('ventas', 'tasa_bcv', esc.tasas.bcv, guardada.tasa_bcv)
    difiere('ventas', 'tasa_usdt', esc.tasas.usdt, guardada.tasa_usdt)

    // Por línea: unitario base y subtotal (sin IVA) en las tres monedas.
    pantalla.lineas.forEach((l, i) => {
      const d = detalle[i]
      const item = carrito[i]
      const info = { linea: i, costo: item.costo, margen: item.margen, cantidad: item.cantidad }
      if (!d) return
      lineasVerificadas++
      difiere('venta_detalle', 'precio_id', l.precioId, d.precio_id, info)
      difiere('venta_detalle', 'cantidad', l.cantidad, d.cantidad, info)
      for (const m of MONEDAS) {
        difiere('venta_detalle', `precio_unitario_${m}`, l.linea.unitario[m], d[`precio_unitario_${m}`], info)
        difiere('venta_detalle', `subtotal_${m}`, l.linea.subtotal[m], d[`subtotal_${m}`], info)
        // Invariantes de la pantalla
        difiere('pantalla', `card.unitarioConIva×q ${m}`, cents(l.linea.total[m]), cents(l.card.unitarioConIva[m] * l.cantidad), info)
        difiere('pantalla', `card.unitarioConIva = linea.unitarioConIva ${m}`, l.card.unitarioConIva[m], l.linea.unitarioConIva[m], info)
        difiere('pantalla', `linea subtotal+iva=total ${m}`, cents(l.linea.total[m]), cents(l.linea.subtotal[m] + l.linea.iva[m]), info)
      }
      // Vista previa de la factura vs lo que imprime el ticket (precio_unitario_bs / subtotal_bs)
      difiere('factura', 'unitario Bs', pantalla.modal.items[i].unitarioBs, d.precio_unitario_bs, info)
      difiere('factura', 'subtotal Bs', pantalla.modal.items[i].subtotalBs, d.subtotal_bs, info)
      difiere('factura', 'unitario USDT', pantalla.modal.items[i].unitarioUsdt, d.precio_unitario_usdt, info)
      difiere('factura', 'subtotal USDT', pantalla.modal.items[i].subtotalUsdt, d.subtotal_usdt, info)
      // Precio unitario independiente (oráculo): costo × margen → BCV → Binance.
      const usd = r2(item.costo * (1 + item.margen / 100))
      const bs = r2(usd * esc.tasas.bcv)
      const usdt = r2(bs / esc.tasas.usdt)
      difiere('oráculo', 'precioUsd', usd, l.precio.precioUsd, info)
      difiere('oráculo', 'precioBs', bs, l.precio.precioBs, info)
      difiere('oráculo', 'precioUsdt', usdt, l.precio.precioUsdt, info)
    })

    // Totales: subtotal (= lo que imprime el ticket: r2(Σ subtotal_*)), IVA y total.
    for (const m of MONEDAS) {
      const subGuardado = r2(detalle.reduce((s, d) => s + d[`subtotal_${m}`], 0))
      difiere('totales', `subtotal_${m} (Σ venta_detalle)`, pantalla.totales.subtotal[m], subGuardado)
      difiere('totales', `iva_${m}`, pantalla.totales.iva[m], guardada[`iva_${m}`])
      difiere('totales', `total_${m}`, pantalla.totales.total[m], guardada[`total_${m}`])
      difiere('totales', `total_${m} - iva_${m} = subtotal`, cents(pantalla.totales.subtotal[m]), cents(guardada[`total_${m}`] - guardada[`iva_${m}`]))
      difiere('pantalla', `totales subtotal+iva=total ${m}`, cents(pantalla.totales.total[m]), cents(pantalla.totales.subtotal[m] + pantalla.totales.iva[m]))
      difiere('pantalla', `Σ total de líneas = total ${m}`, cents(pantalla.totales.total[m]), cents(pantalla.lineas.reduce((s, l) => s + l.linea.total[m], 0)))
      if (esc.iva === 0) {
        difiere('iva0', `iva_${m}`, 0, guardada[`iva_${m}`])
        difiere('iva0', `total_${m} = base`, subGuardado, guardada[`total_${m}`])
      }
    }
    // Vista previa (modal) vs ventas.
    difiere('factura', 'Subtotal Bs', pantalla.modal.subtotalBs, r2(detalle.reduce((s, d) => s + d.subtotal_bs, 0)))
    difiere('factura', 'IVA Bs', pantalla.modal.ivaBs, guardada.iva_bs)
    difiere('factura', 'TOTAL Bs', pantalla.modal.totalBs, guardada.total_bs)
    difiere('factura', 'Subtotal USDT', pantalla.modal.subtotalUsdt, r2(detalle.reduce((s, d) => s + d.subtotal_usdt, 0)))
    difiere('factura', 'IVA USDT', pantalla.modal.ivaUsdt, guardada.iva_usdt)
    difiere('factura', 'TOTAL USDT', pantalla.modal.totalUsdt, guardada.total_usdt)
  }

  if (fallos.length) console.log('DIFERENCIAS:\n' + JSON.stringify(fallos.slice(0, 50), null, 2))
  console.log(`# escenarios=${ESCENARIOS} lineas=${lineasVerificadas} bs=${porMetodo.bs} usdt=${porMetodo.usdt} iva0=${conIvaCero} diferencias=${fallos.length}`)
  assert.equal(fallos.length, 0, `${fallos.length} diferencias pantalla/backend`)
})

// ---------- Negativo: cambia tasa o IVA entre la vista previa y el cobro ----------
test(`crearVenta rechaza totalesEsperados obsoletos (${ESCENARIOS_NEGATIVOS} escenarios)`, () => {
  const az = crearAzar(SEMILLA ^ 0xbad)
  const fallos = []
  let rechazadas = 0
  let sinCambioReal = 0

  for (let n = 0; n < ESCENARIOS_NEGATIVOS; n++) {
    const esc = montarEscenario(az, n)
    const carrito = generarCarrito(az, esc)
    const metodoPago = az.rnd() < 0.5 ? 'bs' : 'usdt'
    const previa = simularPantalla(carrito)
    const items = previa.lineas.map((l) => ({ precioId: l.precioId, cantidad: l.cantidad }))
    const tipo = ['bcv', 'usdt', 'iva'][n % 3]
    let cambio
    if (tipo === 'iva') {
      const nuevo = esc.iva === 16 ? 12 : 16
      guardarIva(nuevo)
      cambio = { iva: [esc.iva, nuevo] }
    } else {
      const bcv = tipo === 'bcv' ? Number((esc.tasas.bcv * 1.05 + 0.01).toFixed(4)) : esc.tasas.bcv
      const usdt = tipo === 'usdt' ? Number((esc.tasas.usdt * 1.07 + 0.01).toFixed(4)) : esc.tasas.usdt
      registrarTasa({ valorBcv: bcv, valorUsdt: usdt, usuarioId: esc.usuarioId })
      const vigente = obtenerUltimaTasa()
      if (vigente.valor_bcv !== bcv || vigente.valor_usdt !== usdt) {
        fallos.push({ n, motivo: 'obtenerUltimaTasa no devuelve la tasa recién registrada', esperado: { bcv, usdt }, real: vigente })
      }
      cambio = { tasas: [esc.tasas, { bcv, usdt }] }
    }
    // ¿Cambió de verdad algún monto que se compara? (pantalla recargada)
    const actual = simularPantalla(carrito).totalesEsperados
    const debeRechazar = Object.keys(actual).some((k) => Math.abs(actual[k] - previa.totalesEsperados[k]) > 0.001)
    const antes = db.prepare('SELECT COUNT(*) AS n FROM ventas').get().n
    let error = null
    try {
      crearVenta({ clienteId: esc.clienteId, usuarioId: esc.usuarioId, metodoPago, items, totalesEsperados: previa.totalesEsperados })
    } catch (e) {
      error = e
    }
    const despues = db.prepare('SELECT COUNT(*) AS n FROM ventas').get().n
    if (debeRechazar) {
      if (!error || !/Los montos cambiaron/.test(error.message)) {
        fallos.push({ n, tipo, cambio, motivo: 'no rechazó', error: error?.message, previa: previa.totalesEsperados, actual })
      } else rechazadas++
      if (despues !== antes) fallos.push({ n, tipo, motivo: 'se guardó la venta pese al rechazo' })
      // Con los montos refrescados la venta sí pasa.
      try {
        crearVenta({ clienteId: esc.clienteId, usuarioId: esc.usuarioId, metodoPago, items, totalesEsperados: actual })
      } catch (e) {
        fallos.push({ n, tipo, motivo: 'rechazó montos refrescados', error: e.message })
      }
    } else {
      sinCambioReal++
      if (error) fallos.push({ n, tipo, cambio, motivo: 'rechazó sin cambio real de montos', error: error.message })
    }
  }

  if (fallos.length) console.log('FALLOS NEGATIVOS:\n' + JSON.stringify(fallos, null, 2))
  console.log(`# negativos=${ESCENARIOS_NEGATIVOS} rechazadas=${rechazadas} sinCambioReal=${sinCambioReal} fallos=${fallos.length}`)
  assert.equal(fallos.length, 0)
  assert.ok(rechazadas >= ESCENARIOS_NEGATIVOS * 0.8, 'la mayoría de los cambios deben provocar rechazo')
})
