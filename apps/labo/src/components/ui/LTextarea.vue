<script setup lang="ts">
defineProps<{ label?: string; help?: string; rows?: number; placeholder?: string; modelValue?: string }>()
defineEmits<{ (e: 'update:modelValue', v: string): void }>()
</script>

<template>
  <label class="block">
    <span v-if="label" class="text-xs font-medium text-text-1 block">{{ label }}</span>
    <span v-if="help" class="text-[11px] text-text-3 block mb-1.5">{{ help }}</span>
    <textarea
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      :rows="rows ?? 4"
      :placeholder="placeholder"
      class="w-full bg-bg border border-border rounded-md px-2.5 py-2 text-xs font-mono text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition-colors resize-y"
    />
  </label>
</template>
