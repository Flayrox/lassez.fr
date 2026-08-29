<script setup lang="ts">
defineProps<{ variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; size?: 'sm' }>()
</script>

<template>
  <button
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
    :class="[
      size === 'sm' ? 'px-2 h-7 text-[11px]' : 'px-3 h-8',
      (variant ?? 'primary') === 'primary' ? 'bg-accent text-accent-fg hover:bg-accent-hover' : '',
      variant === 'secondary' ? 'bg-surface border border-border text-text-1 hover:bg-surface-hover' : '',
      variant === 'danger' ? 'bg-transparent border border-danger/40 text-danger hover:bg-danger/10' : '',
      variant === 'ghost' ? 'bg-transparent text-text-2 hover:text-text-1 hover:bg-surface-hover' : '',
    ]"
  >
    <slot />
  </button>
</template>
