// Config de red por equipo (app-config.json): modo principal/esclavo + IP.
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { obtenerConfig, guardarConfig, esCliente, urlServidor, setRutaConfig } from '../src/main/config.js'

let tmp = null
afterEach(() => {
  setRutaConfig(null)
  tmp && rmSync(tmp, { recursive: true, force: true })
  tmp = null
})

const ruta = () => {
  tmp = mkdtempSync(join(tmpdir(), 'vr-cfg-'))
  const r = join(tmp, 'app-config.json')
  setRutaConfig(r)
  return r
}

test('por defecto es principal en el puerto 8530', () => {
  ruta()
  const cfg = obtenerConfig()
  assert.equal(cfg.modo, 'servidor')
  assert.equal(cfg.puerto, 8530)
  assert.equal(esCliente(), false)
})

test('modo esclavo exige la IP y compone la URL del servidor', () => {
  ruta()
  assert.throws(() => guardarConfig({ modo: 'cliente' }), /IP del servidor/)
  const cfg = guardarConfig({ modo: 'cliente', servidor: '192.168.1.10', puerto: 8530 })
  assert.equal(esCliente(), true)
  assert.equal(urlServidor(), 'http://192.168.1.10:8530')
  // Persiste en disco: se relee al reiniciar.
  setRutaConfig(join(tmp, 'app-config.json'))
  assert.equal(obtenerConfig().modo, 'cliente')
})

test('valida modo y puerto', () => {
  ruta()
  assert.throws(() => guardarConfig({ modo: 'otro' }), /modo debe ser/)
  assert.throws(() => guardarConfig({ modo: 'servidor', puerto: 0 }), /puerto/)
  assert.throws(() => guardarConfig({ modo: 'servidor', puerto: 'abc' }), /puerto/)
})

test('la impresora de cada PC se guarda en la config local', () => {
  ruta()
  guardarConfig({ impresora: { nombre: 'POS8330', ancho: '58mm' } })
  assert.equal(obtenerConfig().impresora.nombre, 'POS8330')
  guardarConfig({ modo: 'cliente', servidor: '10.0.0.5' })
  assert.equal(obtenerConfig().impresora.ancho, '58mm', 'guardar red no pisa la impresora')
})
