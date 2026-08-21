<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
</script>

<template>
  <button
    role="switch"
    :aria-checked="modelValue"
    @click="$emit('update:modelValue', !modelValue)"
    class="relative w-8 h-[18px] rounded-full transition-colors shrink-0"
    :class="modelValue ? 'bg-accent' : 'bg-border'"
  >
    <span
      class="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all"
      :style="{ left: modelValue ? '16px' : '2px' }"
    />
  </button>
</template>
