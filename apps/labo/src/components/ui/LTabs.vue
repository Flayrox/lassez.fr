<script setup lang="ts">
defineProps<{ tabs: { key: string; label: string; count?: number }[]; modelValue: string }>()
defineEmits<{ (e: 'update:modelValue', v: string): void }>()
</script>

<template>
  <div class="flex items-center gap-4 border-b border-border overflow-x-auto">
    <button
      v-for="t in tabs"
      :key="t.key"
      @click="$emit('update:modelValue', t.key)"
      class="flex items-center gap-1.5 pb-2 pt-1 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
      :class="modelValue === t.key ? 'border-accent text-text-1' : 'border-transparent text-text-3 hover:text-text-2'"
    >
      {{ t.label }}
      <span
        v-if="t.count !== undefined"
        class="px-1 min-w-[18px] h-[16px] inline-flex items-center justify-center rounded-full text-[10px]"
        :class="modelValue === t.key ? 'bg-accent-muted text-accent' : 'bg-surface-hover text-text-3'"
      >
        {{ t.count }}
      </span>
    </button>
  </div>
</template>
