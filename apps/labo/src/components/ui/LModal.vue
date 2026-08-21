<script setup lang="ts">
defineProps<{ open: boolean; title?: string; wide?: boolean }>()
defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-[2px]" @click="$emit('close')" />
      <div
        class="relative bg-surface border border-border rounded-card w-full shadow-2xl max-h-[85vh] flex flex-col"
        :class="wide ? 'max-w-2xl' : 'max-w-md'"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 class="text-sm font-medium text-text-1">{{ title }}</h3>
          <button @click="$emit('close')" class="text-text-3 hover:text-text-1 transition-colors">✕</button>
        </div>
        <div class="p-4 overflow-y-auto"><slot /></div>
        <div v-if="$slots.footer" class="px-4 py-3 border-t border-border flex justify-end gap-2">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
