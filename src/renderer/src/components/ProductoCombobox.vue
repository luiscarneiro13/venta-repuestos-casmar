<template>
  <div class="combobox producto-combobox">
    <span class="buscador-icono">⌕</span>
    <input
      ref="inputRef"
      v-model="query"
      :id="inputId"
      type="text"
      class="input buscador-input"
      :placeholder="placeholder"
      autocomplete="off"
      @focus="abrirLista"
      @click="abrirLista"
      @input="onInput"
      @blur="onBlur"
      @keydown.down.prevent="mover(1)"
      @keydown.up.prevent="mover(-1)"
      @keydown.enter.prevent="onEnter"
      @keydown.esc="abierto = false"
    />
    <div v-if="abierto" class="combobox-dropdown">
      <div v-if="resultados.length === 0" class="combobox-item vacio">
        {{ query.trim() ? `No se encontró «${query.trim()}»` : 'No hay productos disponibles' }}
      </div>
      <div
        v-for="(producto, idx) in resultados"
        :key="producto.id"
        class="combobox-item producto-item"
        :class="{ active: idx === indiceActivo }"
        @mousemove="indiceActivo = idx"
        @mousedown.prevent="seleccionar(producto)"
      >
        <div class="producto-datos">
          <div class="producto-nombre">{{ producto.nombre }}</div>
          <div class="doc">
            {{ [producto.codigo, producto.codigo_barras, producto.marca, producto.categoria_nombre].filter(Boolean).join(' · ') }}
            <template v-if="producto.cantidad_precios">
              · {{ producto.cantidad_precios }} {{ producto.cantidad_precios === 1 ? 'precio' : 'precios' }}
              ({{ rangoPrecios(producto) }})
            </template>
            <template v-else> · sin precios</template>
          </div>
        </div>
        <span class="stock-badge" :class="{ agotado: producto.stock <= 0 }">{{ producto.stock }} disp.</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { formatUsd } from '../composables/useFormato'
import { calcularLinea } from '../../../shared/venta.calculo.js'

const MAX_RESULTADOS = 50

const props = defineProps({
  productos: { type: Array, required: true },
  modelValue: { type: Number, default: null },
  limpiarAlSeleccionar: { type: Boolean, default: false },
  inputId: { type: String, default: undefined },
  placeholder: { type: String, default: 'Buscar por nombre, código, código de barra o marca…' },
  // En la venta se pasa el IVA para que el rango coincida con las cards
  // (precio con IVA incluido). Con 0 se muestra el precio base.
  ivaPorcentaje: { type: Number, default: 0 }
})
const emit = defineEmits(['seleccionar', 'update:modelValue'])

const inputRef = ref(null)
const query = ref('')
const abierto = ref(false)
const mostrarTodos = ref(false)
const indiceActivo = ref(-1)
let blurTimeout

watch(
  () => [props.modelValue, props.productos],
  ([id]) => {
    if (id != null) query.value = props.productos.find((p) => p.id === id)?.nombre ?? ''
    else if (query.value && !abierto.value) query.value = ''
  },
  { immediate: true }
)

const normalizar = (texto) =>
  (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

// Coincide si todas las palabras escritas aparecen en nombre, código,
// código de barra o marca (ej. "filtro corolla" encuentra "Filtro de aceite
// Corolla 2009-2018"; un lector de barras encuentra el producto directo).
const resultados = computed(() => {
  if (mostrarTodos.value) return props.productos
  const palabras = normalizar(query.value).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return props.productos
  return props.productos
    .filter((p) => {
      const texto = normalizar(`${p.nombre} ${p.codigo || ''} ${p.codigo_barras || ''} ${p.marca || ''} ${p.categoria_nombre || ''}`)
      return palabras.every((palabra) => texto.includes(palabra))
    })
    .slice(0, MAX_RESULTADOS)
})

function abrirLista() {
  clearTimeout(blurTimeout)
  const seleccionado = props.productos.find((p) => p.id === props.modelValue)
  mostrarTodos.value = !query.value.trim() || query.value === seleccionado?.nombre
  abierto.value = true
  indiceActivo.value = -1
}

const conIva = (usd) => calcularLinea({ precioUsd: usd }, 1, props.ivaPorcentaje).unitarioConIva.usd

function rangoPrecios(producto) {
  const sufijo = props.ivaPorcentaje > 0 ? ' c/IVA' : ''
  if (producto.precio_min_usd === producto.precio_max_usd) return formatUsd(conIva(producto.precio_min_usd)) + sufijo
  return `${formatUsd(conIva(producto.precio_min_usd))} – ${formatUsd(conIva(producto.precio_max_usd))}${sufijo}`
}

function onInput() {
  mostrarTodos.value = false
  if (props.modelValue != null && props.productos.find((p) => p.id === props.modelValue)?.nombre !== query.value) {
    emit('update:modelValue', null)
  }
  abierto.value = query.value.trim() !== ''
  indiceActivo.value = resultados.value.length === 1 ? 0 : -1
}

function seleccionar(producto) {
  emit('seleccionar', producto.id)
  emit('update:modelValue', producto.id)
  query.value = props.limpiarAlSeleccionar ? '' : producto.nombre
  abierto.value = false
  mostrarTodos.value = false
  indiceActivo.value = -1
}

function mover(delta) {
  if (!query.value.trim()) mostrarTodos.value = true
  abierto.value = true
  const total = resultados.value.length
  if (total === 0) return
  indiceActivo.value = indiceActivo.value === -1 ? (delta > 0 ? 0 : total - 1) : (indiceActivo.value + delta + total) % total
}

function onEnter() {
  if (indiceActivo.value !== -1 && resultados.value[indiceActivo.value]) {
    seleccionar(resultados.value[indiceActivo.value])
  } else if (resultados.value.length === 1) {
    seleccionar(resultados.value[0])
  }
}

function onBlur() {
  blurTimeout = setTimeout(() => {
    abierto.value = false
    indiceActivo.value = -1
  }, 150)
}

onUnmounted(() => clearTimeout(blurTimeout))

function enfocar() {
  inputRef.value?.focus()
}

defineExpose({ enfocar })
</script>

<style scoped>
.buscador-icono {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 15px;
  pointer-events: none;
}

.buscador-input {
  padding-left: 32px;
}

.producto-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.producto-datos {
  min-width: 0;
}

.producto-nombre {
  font-weight: 600;
  font-size: 12.5px;
}

.stock-badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--success);
  background: var(--success-light);
  padding: 2px 8px;
  border-radius: 100px;
  white-space: nowrap;
}

.stock-badge.agotado {
  color: var(--danger);
  background: var(--danger-light);
}

.vacio {
  text-align: center;
  color: var(--text-muted);
  cursor: default;
}

.vacio:hover {
  background: var(--surface);
}
</style>
