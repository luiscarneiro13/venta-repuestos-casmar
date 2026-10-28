<template>
  <div class="combobox">
    <input
      v-model="query"
      type="text"
      class="input"
      :placeholder="placeholder"
      autocomplete="off"
      @focus="abierto = true"
      @input="onInput"
      @blur="onBlur"
      @keydown.down.prevent="mover(1)"
      @keydown.up.prevent="mover(-1)"
      @keyup.enter="onEnter"
    />
    <div v-if="abierto" class="combobox-dropdown">
      <div
        v-for="(item, idx) in itemsNavegables"
        :key="item.tipo + '-' + (item.cliente?.id ?? item.texto ?? idx)"
        class="combobox-item"
        :class="{ active: idx === indiceActivo, action: item.tipo === 'crear' || item.tipo === 'agregar' }"
        @mousemove="indiceActivo = idx"
        @mousedown.prevent="elegir(item)"
      >
        <template v-if="item.tipo === 'cliente'">
          {{ item.cliente.nombre }}
          <div class="doc">{{ item.cliente.tipo_documento }}-{{ item.cliente.doc }} · {{ item.cliente.tel }}</div>
        </template>
        <template v-else-if="item.tipo === 'crear'">
          No se encontró ningún cliente para "{{ item.texto }}". Clic aquí para agregarlo.
        </template>
        <template v-else>+ Agregar nuevo cliente</template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  clientes: { type: Array, required: true },
  modelValue: { type: [Number, String], default: null },
  placeholder: { type: String, default: 'Buscar por nombre, documento o teléfono…' }
})
const emit = defineEmits(['update:modelValue', 'crear-cliente'])

const query = ref('')
const abierto = ref(false)
const indiceActivo = ref(-1)

watch(
  () => props.modelValue,
  (id) => {
    const cliente = props.clientes.find((c) => c.id === id)
    query.value = cliente ? cliente.nombre : ''
  },
  { immediate: true }
)

const resultados = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.clientes
  return props.clientes.filter(
    (c) => c.nombre.toLowerCase().includes(q) || (c.tipo_documento + '-' + (c.doc || '')).toLowerCase().includes(q) || (c.doc || '').toLowerCase().includes(q) || (c.tel || '').toLowerCase().includes(q)
  )
})

// Lista única de opciones navegables del dropdown (con flechas arriba/abajo),
// en el mismo orden en que se muestran.
const itemsNavegables = computed(() => {
  const items = resultados.value.map((cliente) => ({ tipo: 'cliente', cliente }))
  if (resultados.value.length === 0 && query.value.trim()) {
    items.push({ tipo: 'crear', texto: query.value.trim() })
  }
  // Siempre al final del dropdown la opción para agregar un cliente nuevo.
  items.push({ tipo: 'agregar' })
  return items
})

function onInput() {
  const seleccionado = props.clientes.find((c) => c.id === props.modelValue)
  if (!seleccionado || seleccionado.nombre !== query.value) {
    emit('update:modelValue', null)
  }
  abierto.value = true
  indiceActivo.value = -1
}

function seleccionar(id) {
  emit('update:modelValue', id)
  abierto.value = false
  indiceActivo.value = -1
}

function elegir(item) {
  if (item.tipo === 'cliente') {
    seleccionar(item.cliente.id)
  } else if (item.tipo === 'crear') {
    emit('crear-cliente', item.texto)
    abierto.value = false
    indiceActivo.value = -1
  } else {
    emit('crear-cliente', '')
    abierto.value = false
    indiceActivo.value = -1
  }
}

function mover(delta) {
  abierto.value = true
  const total = itemsNavegables.value.length
  if (total === 0) return
  if (indiceActivo.value === -1) {
    indiceActivo.value = delta > 0 ? 0 : total - 1
  } else {
    indiceActivo.value = (indiceActivo.value + delta + total) % total
  }
}

function onBlur() {
  setTimeout(() => {
    abierto.value = false
    indiceActivo.value = -1
  }, 150)
}

function onEnter() {
  // Si el usuario navegó el dropdown con las flechas, Enter confirma la
  // opción resaltada, sin importar si escribió números o letras.
  if (abierto.value && indiceActivo.value !== -1) {
    elegir(itemsNavegables.value[indiceActivo.value])
    return
  }

  const texto = query.value.trim()

  // 1. Input vacío: abrir el modal para agregar un cliente nuevo.
  if (!texto) {
    emit('crear-cliente', '')
    abierto.value = false
    return
  }

  const esCedula = /^\d+$/.test(texto)

  // 3. Si escribió letras (nombre, o documento con prefijo V/J): Enter solo
  // despliega el dropdown para que el usuario seleccione manualmente. Nunca
  // selecciona nada automáticamente.
  if (!esCedula) {
    abierto.value = true
    return
  }

  // Es números (cédula):
  // 4. Si hay clientes mostrados en el dropdown, Enter no hace nada: el
  // usuario debe seleccionar uno manualmente.
  if (resultados.value.length > 0) {
    abierto.value = true
    return
  }

  // 2. No existe ningún cliente con esa cédula: abrir el modal para crearlo.
  emit('crear-cliente', texto)
  abierto.value = false
}
</script>
