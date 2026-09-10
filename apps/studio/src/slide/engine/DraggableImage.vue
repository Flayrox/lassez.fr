// Image déplaçable — remplace le DraggableImage legacy.
// Perf : pendant le drag on écrit le transform directement dans le DOM
// (aucun re-render, aucun setState par pixel) ; le store n'est commité
// qu'au pointerup (un seul niveau d'undo par geste).
<template>
  <div
    ref="frame"
    class="slide-draggable"
    :class="{ 'is-dragging': dragging, 'is-static': !draggable }"
    :style="frameStyle"
    @pointerdown="onDown"
  >
    <img
      :src="safeSrc"
      alt=""
      crossorigin="anonymous"
      draggable="false"
      decoding="async"
      :style="imgStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { getSafeImageUrl } from '../media'
import { createRafEmitter } from './gestures'

const props = withDefaults(
  defineProps<{
    src: string
    zoom?: number
    grayscale?: number
    posX?: number
    posY?: number
    opacity?: number
    draggable?: boolean
  }>(),
  { zoom: 1, grayscale: 0, posX: 0, posY: 0, opacity: 1, draggable: true },
)

const emit = defineEmits<{
  (e: 'dragstart'): void
  (e: 'dragmove', pos: { x: number; y: number }): void
  (e: 'dragend', pos: { x: number; y: number }): void
}>()

const frame = ref<HTMLElement | null>(null)
const dragging = ref(false)
const live = ref<{ x: number; y: number } | null>(null)
let startPointer = { x: 0, y: 0 }
let startPos = { x: 0, y: 0 }
let out: ReturnType<typeof createRafEmitter<{ x: number; y: number }>> | null = null

const safeSrc = computed(() => getSafeImageUrl(props.src))

const frameStyle = computed(() => {
  const x = live.value?.x ?? props.posX
  const y = live.value?.y ?? props.posY
  const size = `${props.zoom * 100}%`
  return {
    position: 'absolute',
    width: size,
    height: size,
    left: `calc(${(1 - props.zoom) * 50}% + ${x}px)`,
    top: `calc(${(1 - props.zoom) * 50}% + ${y}px)`,
    opacity: String(props.opacity),
    cursor: props.draggable ? 'grab' : 'default',
  } as Record<string, string>
})

const imgStyle = computed(() => ({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  userSelect: 'none',
  pointerEvents: 'none',
  filter: `grayscale(${props.grayscale / 100}) contrast(${1 + (props.grayscale / 100) * 0.5}) brightness(${1 - (props.grayscale / 100) * 0.25})`,
}))

function onDown(e: PointerEvent) {
  if (!props.draggable || e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  dragging.value = true
  startPointer = { x: e.clientX, y: e.clientY }
  startPos = { x: props.posX, y: props.posY }
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  emit('dragstart')
  out = createRafEmitter((pos: { x: number; y: number }) => emit('dragmove', pos))
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}

function onMove(e: PointerEvent) {
  if (!dragging.value || !out) return
  live.value = {
    x: startPos.x + (e.clientX - startPointer.x),
    y: startPos.y + (e.clientY - startPointer.y),
  }
  out.push({ ...live.value })
}

function onUp() {
  window.removeEventListener('pointermove', onMove)
  if (!dragging.value) return
  dragging.value = false
  out?.flush()
  out = null
  const end = live.value ? { ...live.value } : { ...startPos }
  live.value = null
  emit('dragend', end)
}
</script>
