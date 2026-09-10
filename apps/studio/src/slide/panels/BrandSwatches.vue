// Nuancier brand kit — points de couleur charte, sélection visuelle.
<template>
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="c in BRAND_COLORS"
      :key="c.value"
      class="brand-dot"
      :class="{ 'is-active': isActive(c.value) }"
      :style="{ backgroundColor: c.value }"
      :title="c.name"
      @click="emit('select', c.value)"
    />
  </div>
</template>

<script setup lang="ts">
import { BRAND_COLORS } from '../brand'

const props = defineProps<{ value?: string }>()

const emit = defineEmits<{ (e: 'select', color: string): void }>()

function isActive(hex: string): boolean {
  return (props.value ?? '').toLowerCase() === hex.toLowerCase()
}
</script>

<style scoped>
.brand-dot {
  width: 20px; height: 20px; border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.25);
  cursor: pointer; padding: 0;
}
.brand-dot:hover { transform: scale(1.15); }
.brand-dot.is-active { outline: 2px solid #fff; outline-offset: 1px; }
</style>
