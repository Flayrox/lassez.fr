// Couche image libre : drag sur toute la surface (gesture groupée + snap
// géré par le parent via les événements), resize via la SelectionBox.
<template>
  <div
    class="absolute overflow-hidden"
    :style="boxStyle"
    @pointerdown.stop="onDown"
  >
    <img
      :src="safeSrc"
      alt=""
      crossorigin="anonymous"
      draggable="false"
      decoding="async"
      class="w-full h-full"
      :style="imgStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { buildImageFilter, buildImageTransform, getSafeImageUrl } from '../media'
import { createRafEmitter } from '../engine/gestures'
import type { ImageLayerData, Layer } from '../types'

const props = defineProps<{ layer: Layer; scale?: number }>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'gesturestart', id: string): void
  (e: 'move', pos: { x: number; y: number }): void
  (e: 'gestureend'): void
}>()

const dragging = ref(false)
let origin = { x: 0, y: 0 }
let start = { x: 0, y: 0 }
let out: ReturnType<typeof createRafEmitter<{ x: number; y: number }>> | null = null

const data = computed(() => props.layer.data as ImageLayerData)
const safeSrc = computed(() => getSafeImageUrl(data.value.src))

const boxStyle = computed(() => ({
  left: `${props.layer.x}px`,
  top: `${props.layer.y}px`,
  width: `${props.layer.w}px`,
  height: `${props.layer.h}px`,
  opacity: String(data.value.opacity ?? props.layer.opacity ?? 1),
  transform: props.layer.rotation ? `rotate(${props.layer.rotation}deg)` : undefined,
  cursor: dragging.value ? 'grabbing' : 'grab',
}))

const imgStyle = computed(() => ({
  objectFit: (data.value.fit ?? 'cover') as 'cover' | 'contain',
  // Le cadre = le recadrage (zoom + point focal), les miroirs/filtres suivent.
  objectPosition: `${data.value.focalX ?? 50}% ${data.value.focalY ?? 50}%`,
  transform: buildImageTransform(data.value.zoom ?? 1, data.value.flipH ?? false, data.value.flipV ?? false),
  filter: buildImageFilter(data.value),
  userSelect: 'none',
  pointerEvents: 'none',
}))

function onDown(e: PointerEvent) {
  emit('select', props.layer.id)
  if (e.button !== 0) return
  e.preventDefault()
  dragging.value = true
  origin = { x: e.clientX, y: e.clientY }
  start = { x: props.layer.x, y: props.layer.y }
  emit('gesturestart', props.layer.id)
  out = createRafEmitter((pos: { x: number; y: number }) => emit('move', pos))
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}

function onMove(e: PointerEvent) {
  if (!dragging.value || !out) return
  const s = Math.max(0.05, props.scale ?? 1)
  out.push({
    x: start.x + (e.clientX - origin.x) / s,
    y: start.y + (e.clientY - origin.y) / s,
  })
}

function onUp() {
  window.removeEventListener('pointermove', onMove)
  dragging.value = false
  out?.flush()
  out = null
  emit('gestureend')
}
</script>
