import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import { nuevaBaseEnMemoria } from './helpers/db.mjs'
import { registrarTasa, obtenerTasaDeHoy, obtenerUltimaTasa } from '../src/main/services/tasas.service.js'

let db = null

function base() {
  db?.close()
  db = nuevaBaseEnMemoria()
  return db
}

afterEach(() => {
  db?.close()
  db = null
})

const adminId = (db) => db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id

test('registrarTasa exige ambas tasas positivas e independientes', () => {
  const db = base()
  const usuarioId = adminId(db)
  assert.throws(() => registrarTasa({ valorBcv: 100, usuarioId }), /tasa USDT/i)
  assert.throws(() => registrarTasa({ valorUsdt: 120, usuarioId }), /tasa BCV/i)
  assert.throws(() => registrarTasa({ valorBcv: 0, valorUsdt: 120, usuarioId }), /tasa BCV/i)
  assert.throws(() => registrarTasa({ valorBcv: -5, valorUsdt: 120, usuarioId }), /tasa BCV/i)
  assert.throws(() => registrarTasa({ valorBcv: 100, valorUsdt: -1, usuarioId }), /tasa USDT/i)
  assert.throws(() => registrarTasa({ valorBcv: 100, valorUsdt: 120 }), /usuario/i)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tasas_cambio').get().n, 0)
})

test('registra ambas tasas y las devuelve con la fila', () => {
  const db = base()
  const tasa = registrarTasa({ valorBcv: 100.5, valorUsdt: 120.25, usuarioId: adminId(db) })
  assert.equal(tasa.valor_bcv, 100.5)
  assert.equal(tasa.valor_usdt, 120.25)
  // La columna vieja `valor` queda con la BCV para lectores anteriores.
  assert.equal(tasa.valor, 100.5)
  assert.equal(tasa.usuario_id, adminId(db))
})

test('no duplica la fila si ambos valores son iguales a la vigente', () => {
  const db = base()
  const usuarioId = adminId(db)
  const primera = registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })
  const repetida = registrarTasa({ valorBcv: 100, valorUsdt: 120, usuarioId })
  assert.equal(repetida.id, primera.id)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tasas_cambio').get().n, 1)

  // Cambiar solo una de las dos sí genera una fila nueva.
  const nueva = registrarTasa({ valorBcv: 100, valorUsdt: 125, usuarioId })
  assert.notEqual(nueva.id, primera.id)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tasas_cambio').get().n, 2)
})

test('obtenerUltima devuelve la vigente aunque haya varias en el día', () => {
  const db = base()
  const usuarioId = adminId(db)
  registrarTasa({ valorBcv: 90, valorUsdt: 110, usuarioId })
  registrarTasa({ valorBcv: 95, valorUsdt: 115, usuarioId })
  const ultima = registrarTasa({ valorBcv: 100, valorUsdt: 122, usuarioId })

  const vigente = obtenerUltimaTasa()
  assert.equal(vigente.id, ultima.id)
  assert.equal(vigente.valor_bcv, 100)
  assert.equal(vigente.valor_usdt, 122)

  const hoy = obtenerTasaDeHoy()
  assert.equal(hoy.id, ultima.id)
})

test('sin tasas registradas devuelve null', () => {
  base()
  assert.equal(obtenerUltimaTasa(), null)
  assert.equal(obtenerTasaDeHoy(), null)
})

test('la tasa USDT se ingresa por separado y nunca se reemplaza por BCV en la interfaz', () => {
  const app = readFileSync(new URL('../src/renderer/src/App.vue', import.meta.url), 'utf8')
  const topBar = readFileSync(new URL('../src/renderer/src/components/TopBar.vue', import.meta.url), 'utf8')
  const ventas = readFileSync(new URL('../src/renderer/src/pages/VentasView.vue', import.meta.url), 'utf8')
  for (const vista of [app, topBar]) {
    assert.match(vista, /Tasa BCV/)
    assert.match(vista, /Tasa USDT/)
    assert.match(vista, /registrar\(\{ valorBcv, valorUsdt, usuarioId: session\.usuario\.id \}\)/)
    assert.doesNotMatch(vista, /registrar\(\{ valorBcv, usuarioId:/)
  }
  assert.match(ventas, /tasasDelDia\.usdt = tasaHoy\?\.valor_usdt/)
  assert.match(ventas, /tasaCierreUsdt: tasaUsdt/)
})
