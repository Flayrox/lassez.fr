<script setup lang="ts">
defineProps<{ icon?: string; title: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-card">
    <div class="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-text-3 mb-3">{{ icon ?? '◌' }}</div>
    <p class="text-sm font-medium text-text-1">{{ title }}</p>
    <p v-if="description" class="text-xs text-text-3 mt-1 max-w-xs">{{ description }}</p>
    <div v-if="$slots.action" class="mt-4"><slot name="action" /></div>
  </div>
</template>
