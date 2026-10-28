import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (ruta) => readFileSync(join(root, ruta))

test('login, favicon y ventana usan la marca del negocio (logo.png)', () => {
  const logo = leer('resources/logo.png')
  assert.deepEqual(logo, leer('src/renderer/src/assets/logo.png'))
  assert.deepEqual(logo, leer('logo.png'))
  assert.ok(logo.length > 4096, 'El PNG no debe quedar embebido como data URI con el CSP actual')

  // El icono de ventana/instalador es el isotipo cuadrado derivado del logo.
  assert.deepEqual(leer('resources/icon.png'), leer('build/icon.png'))

  for (const ruta of [
    'src/renderer/src/components/LoginOverlay.vue',
    'src/renderer/src/components/TopBar.vue',
    'src/renderer/src/pages/VentaView.vue'
  ]) {
    assert.match(leer(ruta).toString(), /assets\/logo\.png/)
  }
  assert.match(leer('src/renderer/index.html').toString(), /rel="icon" type="image\/png" href="\/src\/assets\/logo\.png"/)
  assert.match(leer('src/main/index.js').toString(), /\.\.\/\.\.\/resources\/icon\.png/)
  assert.match(leer('src/main/printer/ticket.printer.js').toString(), /\.\.\/\.\.\/resources\/logo\.png/)
  assert.equal(leer('build/icon.ico').readUInt16LE(2), 1)
  assert.ok(statSync(join(root, 'build/icon.ico')).size > 1000)
})
