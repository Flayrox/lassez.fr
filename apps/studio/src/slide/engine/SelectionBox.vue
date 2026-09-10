// Cadre de sélection : déplace (bandes de bord) + redimensionne
// (8 poignées). Le corps est transparent aux clics pour laisser l'éditeur
// texte/imagette recevoir les événements.
<template>
  <div
    class="slide-selection"
    :style="{ left: `${layer.x}px`, top: `${layer.y}px`, width: `${layer.w}px`, height: `${layer.h}px` }"
  >
    <!-- Bandes de déplacement -->
    <div class="sel-edge sel-top" @pointerdown="onMoveStart" />
    <div class="sel-edge sel-bottom" @pointerdown="onMoveStart" />
    <div class="sel-edge sel-left" @pointerdown="onMoveStart" />
    <div class="sel-edge sel-right" @pointerdown="onMoveStart" />
    <!-- Poignées -->
    <div
      v-for="h in HANDLES"
      :key="h"
      class="slide-handle"
      :class="`h-${h}`"
      :style="handleStyle(h)"
      @pointerdown="onResizeStart($event, h)"
    />
  </div>
</template>

<script setup lang="ts">
import type { Layer } from '../types'
import { resizeRect, type ResizeHandle } from './geometry'
import { createRafEmitter } from './gestures'

const props = withDefaults(
  defineProps<{ layer: Layer; scale?: number }>(),
  { scale: 1 },
)

const emit = defineEmits<{
  (e: 'gesturestart'): void
  (e: 'move', pos: { x: number; y: number }): void
  (e: 'resize', rect: { x: number; y: number; w: number; h: number }): void
  (e: 'gestureend'): void
}>()

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const POS: Record<ResizeHandle, { left: string; top: string; cursor: string }> = {
  nw: { left: '0%', top: '0%', cursor: 'nwse-resize' },
  n: { left: '50%', top: '0%', cursor: 'ns-resize' },
  ne: { left: '100%', top: '0%', cursor: 'nesw-resize' },
  e: { left: '100%', top: '50%', cursor: 'ew-resize' },
  se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
  s: { left: '50%', top: '100%', cursor: 'ns-resize' },
  sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
  w: { left: '0%', top: '50%', cursor: 'ew-resize' },
}

function handleStyle(h: ResizeHandle) {
  const p = POS[h]
  const size = 10 / Math.max(0.1, props.scale)
  return {
    left: p.left,
    top: p.top,
    width: `${size}px`,
    height: `${size}px`,
    cursor: p.cursor,
    transform: 'translate(-50%, -50%)',
  }
}

function toStage(e: PointerEvent, origin: { x: number; y: number }) {
  return {
    dx: (e.clientX - origin.x) / Math.max(0.05, props.scale),
    dy: (e.clientY - origin.y) / Math.max(0.05, props.scale),
  }
}

function onMoveStart(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  emit('gesturestart')
  const origin = { x: e.clientX, y: e.clientY }
  const start = { x: props.layer.x, y: props.layer.y }
  const out = createRafEmitter((pos: { x: number; y: number }) => emit('move', pos))
  const move = (ev: PointerEvent) => {
    const { dx, dy } = toStage(ev, origin)
    out.push({ x: start.x + dx, y: start.y + dy })
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    out.flush()
    emit('gestureend')
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up, { once: true })
}

function onResizeStart(e: PointerEvent, handle: ResizeHandle) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  emit('gesturestart')
  const origin = { x: e.clientX, y: e.clientY }
  const start = { x: props.layer.x, y: props.layer.y, w: props.layer.w, h: props.layer.h }
  const out = createRafEmitter((rect: { x: number; y: number; w: number; h: number }) => emit('resize', rect))
  const move = (ev: PointerEvent) => {
    const { dx, dy } = toStage(ev, origin)
    out.push(resizeRect(start, handle, dx, dy, { keepAspect: ev.shiftKey }))
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    out.flush()
    emit('gestureend')
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up, { once: true })
}
</script>

<style scoped>
.slide-selection { pointer-events: none; }
.sel-edge {
  position: absolute;
  pointer-events: auto;
}
.sel-top, .sel-bottom { left: -4px; right: -4px; height: 8px; cursor: move; }
.sel-top { top: -5px; }
.sel-bottom { bottom: -5px; }
.sel-left, .sel-right { top: -4px; bottom: -4px; width: 8px; cursor: move; }
.sel-left { left: -5px; }
.sel-right { right: -5px; }
</style>
