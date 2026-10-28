<template>
  <BaseModal :title="title" @close="$emit('cancel')">
    <p style="margin: 0; font-size: 12.5px; color: var(--text-primary); line-height: 1.5">{{ message }}</p>

    <template #footer>
      <button v-if="showCancel" class="btn btn-outline" type="button" @click="$emit('cancel')">
        {{ cancelText }}
      </button>
      <button class="btn btn-primary" type="button" @click="$emit('confirm')">{{ confirmText }}</button>
    </template>
  </BaseModal>
</template>

<script setup>
import BaseModal from './BaseModal.vue'

defineProps({
  title: { type: String, required: true },
  message: { type: String, required: true },
  confirmText: { type: String, default: 'Confirmar' },
  cancelText: { type: String, default: 'Cancelar' },
  showCancel: { type: Boolean, default: true }
})
defineEmits(['confirm', 'cancel'])
</script>
