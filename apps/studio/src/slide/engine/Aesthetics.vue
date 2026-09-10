// Habillages visuels Lassez (port direct du legacy Aesthetics).
<template>
  <div v-if="kind === 'noise'" class="noise-overlay" :style="{ opacity, zIndex }" />
  <div v-else class="halftone-overlay" :style="{ opacity, zIndex }" />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ kind?: 'noise' | 'halftone'; opacity?: number; zIndex?: number }>(),
  { kind: 'noise', opacity: 0.08, zIndex: 10 },
)
</script>
