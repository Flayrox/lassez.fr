<script setup lang="ts">
defineProps<{ variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean }>()
</script>

<template>
  <button
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-1.5 rounded px-3 h-8 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    :class="{
      'bg-accent text-accent-fg hover:bg-accent-hover': (variant ?? 'primary') === 'primary',
      'bg-surface border border-border text-text-1 hover:bg-surface-hover': variant === 'secondary',
      'bg-transparent border border-danger/40 text-danger hover:bg-danger/10': variant === 'danger',
      'bg-transparent text-text-2 hover:text-text-1 hover:bg-surface-hover': variant === 'ghost',
    }"
  >
    <slot />
  </button>
</template>
