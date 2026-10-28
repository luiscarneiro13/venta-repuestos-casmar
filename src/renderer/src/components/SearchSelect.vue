<template>
  <div class="combobox search-select">
    <span class="buscador-icono">⌕</span>
    <input
      ref="inputRef"
      :id="inputId"
      v-model="texto"
      type="text"
      class="input buscador-input"
      :placeholder="placeholder"
      autocomplete="off"
      role="combobox"
      :aria-expanded="abierto"
      aria-autocomplete="list"
      @focus="abrir"
      @click="abrir"
      @input="onInput"
      @blur="onBlur"
      @keydown.down.prevent="mover(1)"
      @keydown.up.prevent="mover(-1)"
      @keydown.enter.prevent="onEnter"
      @keydown.esc="cerrar"
      @keydown.tab="cerrar"
    />
    <div v-if="abierto" class="combobox-dropdown" role="listbox">
      <div v-if="visibles.length === 0" class="combobox-item vacio">
        Sin resultados{{ texto.trim() ? ` para «${texto.trim()}»` : '' }}
      </div>
      <div
        v-for="(op, i) in visibles"
        :key="i"
        class="combobox-item"
        :class="{ active: i === indice }"
        role="option"
        :aria-selected="i === indice"
        @mousemove="indice = i"
        @mousedown.prevent="seleccionar(op)"
      >
        {{ op.label }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'

// Select con búsqueda para reemplazar <select> nativos: mismo look que los
// inputs del sistema (la envoltura .combobox se ajusta al ancho del padre).
// `options` acepta [{ value, label }] o strings sueltos.
const props = defineProps({
  options: { type: Array, default: () => [] },
  modelValue: { default: null },
  placeholder: { type: String, default: 'Selecciona…' },
  inputId: { type: String, default: undefined }
})
const emit = defineEmits(['update:modelValue', 'change'])

const inputRef = ref(null)
const texto = ref('')
const abierto = ref(false)
const indice = ref(-1)
let blurTimeout

const normalizadas = computed(() =>
  props.options.map((o) => (typeof o === 'object' && o !== null ? o : { value: o, label: String(o) }))
)

const actual = computed(() => normalizadas.value.find((o) => o.value === props.modelValue) ?? null)

const normalizar = (t) =>
  (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const visibles = computed(() => {
  const q = normalizar(texto.value)
  if (!q || q === normalizar(actual.value?.label)) return normalizadas.value
  return normalizadas.value.filter((o) => normalizar(o.label).includes(q))
})

// El texto del input siempre refleja la etiqueta de la opción vigente;
// al cambiar el modelo desde afuera se sincroniza.
watch(
  actual,
  (op) => {
    texto.value = op?.label ?? ''
  },
  { immediate: true }
)

function abrir() {
  clearTimeout(blurTimeout)
  abierto.value = true
  indice.value = actual.value ? visibles.value.indexOf(actual.value) : -1
}

function onInput() {
  // Si el texto deja de coincidir con la selección, el valor se limpia:
  // el padre nunca guarda una opción que el usuario ya no ve completa.
  if (texto.value !== actual.value?.label) emit('update:modelValue', null)
  abierto.value = true
  indice.value = visibles.value.length === 1 ? 0 : -1
}

function seleccionar(op) {
  texto.value = op.label
  abierto.value = false
  indice.value = -1
  emit('update:modelValue', op.value)
  emit('change', op.value)
}

function mover(delta) {
  abierto.value = true
  const total = visibles.value.length
  if (total === 0) return
  indice.value = indice.value === -1 ? (delta > 0 ? 0 : total - 1) : (indice.value + delta + total) % total
}

function onEnter() {
  const op = visibles.value[indice.value] ?? (visibles.value.length === 1 ? visibles.value[0] : null)
  if (op) seleccionar(op)
}

function cerrar() {
  abierto.value = false
  indice.value = -1
  // Esc/blur restauran el texto de la opción vigente (no quedan textos sueltos).
  texto.value = actual.value?.label ?? ''
}

function onBlur() {
  blurTimeout = setTimeout(cerrar, 150)
}

onUnmounted(() => clearTimeout(blurTimeout))

function enfocar() {
  inputRef.value?.focus()
}

defineExpose({ enfocar })
</script>

<style scoped>
.search-select {
  width: 100%;
}
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
.vacio {
  text-align: center;
  color: var(--text-muted);
  cursor: default;
}
.vacio:hover {
  background: var(--surface);
}
</style>
