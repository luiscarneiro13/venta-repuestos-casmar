<template>
  <BaseModal extra-wide title="Registrar entrada de mercancía" @close="emit('close')">
    <div class="entrada-grid">
      <div class="login-field col-producto">
        <label class="field-label" for="entrada-producto">Producto *</label>
        <input v-if="productoFijo" id="entrada-producto" class="input" :value="producto?.nombre || 'Cargando…'" readonly />
        <ProductoCombobox v-else v-model="seleccionadoId" :productos="productos" @update:model-value="cargarProducto" />
      </div>
      <div class="login-field col-cantidad">
        <label class="field-label" for="entrada-cantidad">Cantidad *</label>
        <input id="entrada-cantidad" v-model.number="cantidad" class="input" type="number" min="1" step="1" />
      </div>
      <div class="login-field col-proveedor">
        <div class="proveedor-label">
          <label class="field-label" for="entrada-proveedor">Proveedor *</label>
          <button class="btn btn-outline agregar-proveedor" type="button" @click="modalProveedor = true">+ Agregar</button>
        </div>
        <SearchSelect
          input-id="entrada-proveedor"
          v-model="proveedorId"
          :options="opcionesProveedores"
          placeholder="Buscar proveedor…"
        />
      </div>
      <div class="login-field col-costo">
        <label class="field-label" for="entrada-compra">Costo de compra (USD) *</label>
        <input
          id="entrada-compra" :value="compra.texto" class="input num"
          inputmode="numeric" placeholder="0,00"
          @keydown="bloquearNoDigitos" @input="onMontoInput(compra, $event)"
        />
      </div>
    </div>

    <p v-if="cargando" class="muted">Cargando márgenes…</p>
    <div v-else class="login-field">
      <span class="field-label">Utilidad por tipo de precio</span>
      <MargenesTabla
        :filas="margenes"
        :costo-usd="compra.valorUsd"
        :tasa-bcv="tasas.bcv"
        :tasa-usdt="tasas.usdt"
      />
      <p class="muted" style="font-size: 11px; margin: 6px 0 0">
        Un solo % de utilidad sobre el costo — es el mismo en ambos métodos y editable desde cualquiera.
        Precio $ = costo × (1 + %) · Precio Bs = precio $ × BCV · Precio USDT = precio Bs ÷ Binance.
      </p>
    </div>

    <div class="login-field">
      <label class="field-label" for="entrada-nota">Nota (opcional)</label>
      <input id="entrada-nota" v-model="nota" class="input" placeholder="Ej. Factura 1234" />
    </div>
    <p v-if="error" class="warning-box" role="alert">{{ error }}</p>
    <template #footer>
      <button class="btn btn-outline" type="button" @click="emit('close')">Cancelar</button>
      <button class="btn btn-primary" type="button" :disabled="guardando || cargando" @click="guardar">
        {{ guardando ? 'Guardando…' : 'Guardar entrada' }}
      </button>
    </template>
  </BaseModal>
  <ProveedorModal v-if="modalProveedor" @close="modalProveedor = false" @saved="proveedorCreado" />
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseModal from './BaseModal.vue'
import ProductoCombobox from './ProductoCombobox.vue'
import SearchSelect from './SearchSelect.vue'
import ProveedorModal from './ProveedorModal.vue'
import MargenesTabla from './MargenesTabla.vue'
import { session } from '../store/session'
import { aplicarMascaraTasa, bloquearNoDigitos, mascaraTasaDesdeNumero } from '../composables/useMascaras'
import { mensajeError } from '../composables/useErrores'

const props = defineProps({
  productoId: { type: Number, default: null },
  productos: { type: Array, required: true },
  productoFijo: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'saved'])
const seleccionadoId = ref(props.productoId)
const producto = ref(null)
const proveedores = ref([])
const proveedorId = ref(null)
const opcionesProveedores = computed(() =>
  proveedores.value.map((p) => ({ value: p.id, label: p.nombre }))
)
const modalProveedor = ref(false)
const cantidad = ref(null)
const nota = ref('')
const compra = ref({ texto: '', valorUsd: null })
const margenes = ref([])
const tasas = ref({ bcv: null, usdt: null })
const cargando = ref(true)
const guardando = ref(false)
const error = ref('')
let consulta = 0

// Precarga: margen propio del producto o el default del tipo cuando no
// tiene. Si listarPorProducto falla (backend viejo), se arma la tabla con
// los defaults de los tipos activos.
async function cargarFilasMargenes(id) {
  try {
    const lista = await window.api.precios.listarPorProducto(id)
    return lista.map((p) => ({
      tipoPrecioId: p.tipoPrecioId,
      nombre: p.tipoPrecioNombre,
      margen: p.margen,
      margenTexto: String(p.margen),
      origen: p.margenOrigen === 'propio' ? 'propio' : 'default'
    }))
  } catch {
    const tipos = await window.api.tiposPrecio.listar()
    return tipos
      .filter((t) => t.activo !== 0)
      .map((t) => ({
        tipoPrecioId: t.id,
        nombre: t.nombre,
        margen: t.margen_default ?? 100,
        margenTexto: String(t.margen_default ?? 100),
        origen: 'default'
      }))
  }
}

async function cargarProducto(id) {
  const actual = ++consulta
  seleccionadoId.value = id
  producto.value = null
  compra.value = { texto: '', valorUsd: null }
  margenes.value = []
  cargando.value = true
  error.value = ''
  try {
    const [detalle, filas] = await Promise.all([
      id ? window.api.productos.obtener(id) : null,
      id ? cargarFilasMargenes(id) : cargarFilasMargenesSinProducto()
    ])
    if (actual !== consulta) return
    producto.value = detalle
    compra.value = {
      texto: detalle?.precio_compra_usd == null ? '' : mascaraTasaDesdeNumero(detalle.precio_compra_usd).texto,
      valorUsd: detalle?.precio_compra_usd ?? null
    }
    margenes.value = filas
  } catch (e) {
    if (actual === consulta) error.value = mensajeError(e)
  } finally {
    if (actual === consulta) cargando.value = false
  }
}

// Producto sin seleccionar todavía (o recién creado): tipos activos con
// su margen por defecto.
async function cargarFilasMargenesSinProducto() {
  const tipos = await window.api.tiposPrecio.listar()
  return tipos
    .filter((t) => t.activo !== 0)
    .map((t) => ({
      tipoPrecioId: t.id,
      nombre: t.nombre,
      margen: t.margen_default ?? 100,
      margenTexto: String(t.margen_default ?? 100),
      origen: 'default'
    }))
}

async function cargarTasas() {
  try {
    const ultima = await window.api.tasas.obtenerUltima()
    tasas.value = { bcv: ultima?.valor_bcv ?? null, usdt: ultima?.valor_usdt ?? null }
  } catch {
    tasas.value = { bcv: null, usdt: null }
  }
}

function onMontoInput(fila, event) {
  const digitos = event.target.value.replace(/\D/g, '').replace(/^0+/, '')
  const { texto, valor } = digitos ? aplicarMascaraTasa(digitos) : { texto: '', valor: null }
  fila.texto = texto
  fila.valorUsd = valor
  event.target.value = texto
}

function proveedorCreado(nuevo) {
  proveedores.value.push(nuevo)
  proveedores.value.sort((a, b) => a.nombre.localeCompare(b.nombre))
  proveedorId.value = nuevo.id
  modalProveedor.value = false
}

async function guardar() {
  if (!seleccionadoId.value || !producto.value || seleccionadoId.value !== producto.value.id) {
    error.value = 'Selecciona un producto.'
    return
  }
  if (!Number.isInteger(cantidad.value) || cantidad.value <= 0) {
    error.value = 'La cantidad debe ser un entero mayor a 0.'
    return
  }
  if (!proveedorId.value) {
    error.value = 'Selecciona un proveedor.'
    return
  }
  if (!compra.value.valorUsd || compra.value.valorUsd <= 0) {
    error.value = 'Carga el costo de compra (mayor a 0).'
    return
  }
  guardando.value = true
  error.value = ''
  try {
    await window.api.inventario.registrarEntrada({
      productoId: seleccionadoId.value,
      cantidad: cantidad.value,
      proveedorId: proveedorId.value,
      motivo: nota.value.trim(),
      precioCompraUsd: compra.value.valorUsd,
      margenes: margenes.value.map((f) => ({ tipoPrecioId: f.tipoPrecioId, margen: f.margen })),
      usuarioId: session.usuario.id
    })
    emit('saved', seleccionadoId.value)
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    guardando.value = false
  }
}

onMounted(async () => {
  await Promise.all([cargarProducto(seleccionadoId.value), cargarTasas()])
  try {
    proveedores.value = await window.api.proveedores.listar()
  } catch (e) {
    error.value = mensajeError(e)
  }
})
</script>

<style scoped>
.entrada-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 0 16px;
}
.col-producto { grid-column: span 9; }
.col-cantidad { grid-column: span 3; }
.col-proveedor { grid-column: span 8; }
.col-costo { grid-column: span 4; }
/* Misma altura de etiqueta en todos los campos de la grilla: el botón
   "+ Agregar" del proveedor no debe empujar su select hacia abajo. */
.entrada-grid .login-field > .field-label,
.proveedor-label {
  display: flex;
  align-items: center;
  min-height: 24px;
  margin-bottom: 6px;
}
.proveedor-label { justify-content: space-between; gap: 10px; }
.proveedor-label .field-label { margin: 0; }
.agregar-proveedor { min-height: 24px; padding: 0 10px; font-size: 11px; }
@media (max-width: 720px) {
  .col-producto, .col-cantidad, .col-proveedor, .col-costo { grid-column: 1 / -1; }
}
</style>
