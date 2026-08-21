<script setup lang="ts">
defineProps<{ variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
    :class="{
      'bg-surface-hover text-text-2 border border-border': (variant ?? 'neutral') === 'neutral',
      'bg-accent-muted text-accent': variant === 'accent',
      'bg-[var(--accent-muted)] text-accent': variant === 'success',
      'bg-warning/10 text-warning': variant === 'warning',
      'bg-danger/10 text-danger': variant === 'danger',
      'bg-info/10 text-info': variant === 'info',
    }"
  >
    <slot />
  </span>
</template>
