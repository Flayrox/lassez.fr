<script setup lang="ts">
defineProps<{ title?: string; description?: string }>()
</script>

<template>
  <div class="bg-surface border border-border rounded-card">
    <div v-if="title || $slots.header" class="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/60">
      <slot name="header">
        <div>
          <h3 class="text-sm font-medium text-text-1">{{ title }}</h3>
          <p v-if="description" class="text-xs text-text-3 mt-0.5">{{ description }}</p>
        </div>
      </slot>
      <slot name="actions" />
    </div>
    <div :class="title || $slots.header ? 'p-4' : 'p-4'">
      <slot />
    </div>
  </div>
</template>
