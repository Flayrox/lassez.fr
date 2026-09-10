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
import { getSafeImageUrl } from '../media'
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

const data = computed(() => props.layer.data as ImageLayerData)
const safeSrc = computed(() => getSafeImageUrl(data.value.src))
const zoom = computed(() => data.value.zoom ?? 1)
const grayscale = computed(() => data.value.grayscale ?? 0)

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
  transform: `scale(${zoom.value})`,
  filter: `grayscale(${grayscale.value / 100})`,
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
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}

function onMove(e: PointerEvent) {
  if (!dragging.value) return
  const s = Math.max(0.05, props.scale ?? 1)
  emit('move', {
    x: start.x + (e.clientX - origin.x) / s,
    y: start.y + (e.clientY - origin.y) / s,
  })
}

function onUp() {
  window.removeEventListener('pointermove', onMove)
  dragging.value = false
  emit('gestureend')
}
</script>
