<template>
  <div class="card kpi-card">
    <div class="lbl">{{ lbl }}</div>
    <div class="val">{{ val }}</div>
    <div v-if="sub || subBold" class="sub"><strong v-if="subBold">{{ subBold }}</strong> {{ sub }}</div>
  </div>
</template>

<script setup>
defineProps({
  lbl: { type: String, required: true },
  val: { type: [String, Number], required: true },
  sub: { type: String, default: '' },
  subBold: { type: String, default: '' }
})
</script>
