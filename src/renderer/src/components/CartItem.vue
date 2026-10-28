<template>
  <div class="cart-item" :class="{ 'cart-item-selected': selected }">
    <button type="button" class="remove" :aria-label="`Quitar ${item.producto.nombre}`" @click="$emit('remove')">×</button>
    <div class="info">
      <button type="button" class="cart-product-select" :aria-pressed="selected" @click="$emit('select')">
        <span class="name">
          {{ item.producto.nombre }}<span v-if="item.precio" class="tipo-precio-tag">{{ item.precio.tipoPrecioNombre }}</span>
        </span>
        <span class="price" :class="{ 'sin-precio': !item.precio }">
          <template v-if="item.precio && item.linea">
            {{ formatMontoBs(item.linea.unitarioConIva.bs) }} c/u
            <span class="muted equiv">≈ {{ formatMontoUsdt(item.linea.unitarioConIva.usdt) }} ({{ item.linea.unitarioConIva.usd == null ? '—' : formatUsd(item.linea.unitarioConIva.usd) }})</span>
          </template>
          <template v-else>Selecciona un precio →</template>
        </span>
        <span v-if="item.excedeStock" class="sin-stock">· stock: {{ item.stock }}</span>
      </button>
    </div>
    <div class="qty-control">
      <button
        type="button"
        class="qty-btn"
        :disabled="item.cantidad <= 1"
        title="Disminuir"
        @click="cambiarCantidad(-1)"
      >−</button>
      <input
        type="text"
        inputmode="numeric"
        class="qty-input"
        :value="item.cantidad"
        @click="$event.target.select()"
        @keydown="bloquearNoDigitos"
        @input="onCantidadInput"
        @change="emit('confirmar-cantidad', $event.target.value)"
      />
      <button
        type="button"
        class="qty-btn"
        :disabled="Number.isFinite(item.stock) && item.cantidad >= item.stock"
        title="Aumentar"
        @click="cambiarCantidad(1)"
      >+</button>
    </div>
    <div class="num" style="width: 140px; text-align: right; font-weight: 600; font-size: 14px">
      <template v-if="item.precio && item.linea">
        {{ formatMontoBs(item.linea.total.bs) }}
        <div class="muted equiv-sub">
          ≈ {{ item.linea.total.usdt == null ? '—' : formatMontoUsdt(item.linea.total.usdt) }}
        </div>
      </template>
      <template v-else>—</template>
    </div>
  </div>
</template>

<script setup>
import { formatMontoBs, formatMontoUsdt, formatUsd } from '../composables/useFormato'

const props = defineProps({
  item: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})
const emit = defineEmits(['set-cantidad', 'confirmar-cantidad', 'remove', 'select'])

function bloquearNoDigitos(e) {
  const permitidas = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'Enter']
  if (permitidas.includes(e.key) || e.ctrlKey || e.metaKey) return
  if (!/^\d$/.test(e.key)) {
    e.preventDefault()
  }
}

function onCantidadInput(e) {
  const soloDigitos = e.target.value.replace(/\D/g, '')
  if (soloDigitos !== e.target.value) {
    e.target.value = soloDigitos
  }
  // Recalcula el subtotal en vivo mientras se escribe; si el campo queda
  // vacío a mitad de edición no se fuerza ningún valor todavía (eso lo
  // resuelve @change al salir del campo), para no interrumpir la escritura.
  if (soloDigitos) {
    emit('set-cantidad', soloDigitos)
  }
}

function cambiarCantidad(delta) {
  const actual = Number(props.item.cantidad) || 0
  let siguiente = actual + delta
  // El + nunca pasa del stock disponible.
  if (Number.isFinite(props.item.stock)) siguiente = Math.min(siguiente, props.item.stock)
  if (siguiente < 1) return
  emit('set-cantidad', String(siguiente))
  emit('confirmar-cantidad', String(siguiente))
}
</script>

<style scoped>
.equiv {
  font-size: 11px;
}
.equiv-sub {
  font-size: 10.5px;
  font-weight: 400;
}
</style>
