<script setup lang="ts">
defineProps<{ label?: string; help?: string; modelValue?: string | number }>()
defineEmits<{ (e: 'update:modelValue', v: string): void }>()
</script>

<template>
  <label class="block">
    <span v-if="label" class="text-xs font-medium text-text-1 block">{{ label }}</span>
    <span v-if="help" class="text-[11px] text-text-3 block mb-1.5">{{ help }}</span>
    <input
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      class="w-full h-8 bg-bg border border-border rounded px-2.5 text-xs text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition-all"
    />
  </label>
</template>
