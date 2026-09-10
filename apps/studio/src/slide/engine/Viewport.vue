// Viewport pan/zoom — l'espace de travail infini (style Canva/Figma).
// Le contenu (slot) est rendu à taille réelle puis transformé : molette =
// pan, Ctrl+molette = zoom au curseur, espace/bouton milieu/fond = pan.
<template>
  <div
    ref="box"
    class="slide-viewport flex-1 overflow-hidden relative select-none"
    :style="{ cursor: panCursor }"
    @wheel="onWheel"
    @pointerdown="onBackgroundDown"
    @dblclick="onDblClick"
  >
    <div
      class="absolute left-0 top-0 origin-top-left"
      :style="{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { clampZoom, fitScale } from '../formats'

const props = withDefaults(
  defineProps<{ stageW: number; stageH: number; min?: number }>(),
  { min: 0.05 },
)

const emit = defineEmits<{ (e: 'zoom', value: number): void }>()

const box = ref<HTMLElement | null>(null)
const scale = ref(1)
// Le stage consomme l'échelle (deltas souris → px slide, poignées constantes).
provide('slide-viewport-scale', scale)
const tx = ref(0)
const ty = ref(0)
const spaceHeld = ref(false)
const panning = ref(false)
let panStart = { x: 0, y: 0, tx: 0, ty: 0 }
let fitted = false

const panCursor = computed(() => {
  if (panning.value) return 'grabbing'
  if (spaceHeld.value) return 'grab'
  return 'default'
})

function applyZoom(next: number, cx?: number, cy?: number) {
  const prev = scale.value
  const s = clampZoom(next)
  if (cx !== undefined && cy !== undefined && box.value) {
    const rect = box.value.getBoundingClientRect()
    const px = cx - rect.left
    const py = cy - rect.top
    tx.value = px - ((px - tx.value) * s) / prev
    ty.value = py - ((py - ty.value) * s) / prev
  }
  scale.value = s
  emit('zoom', s)
}

function zoomAt(factor: number, cx: number, cy: number) {
  applyZoom(scale.value * factor, cx, cy)
}

function zoomStep(dir: 1 | -1) {
  // Paliers doux : ×1.2 / ÷1.2 centrés sur le viewport.
  if (!box.value) return
  const rect = box.value.getBoundingClientRect()
  zoomAt(dir === 1 ? 1.2 : 1 / 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2)
}

function fit() {
  if (!box.value) return
  const rect = box.value.getBoundingClientRect()
  // Padding resserré : le slide occupe le maximum du viewport.
  const s = clampZoom(fitScale(props.stageW, props.stageH, rect.width, rect.height, 28))
  scale.value = s
  tx.value = (rect.width - props.stageW * s) / 2
  ty.value = (rect.height - props.stageH * s) / 2
  fitted = true
  emit('zoom', s)
}

function reset() {
  fitted = false
  fit()
}

/** Double-clic sur le FOND recentre ; sur le contenu (texte…) : ignoré
 * (sinon toute sélection de mot au double-clic resettait la vue). */
function onDblClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.slide-stage')) return
  fit()
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (e.ctrlKey || e.metaKey) {
    zoomAt(Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY)
  } else {
    tx.value -= e.deltaX
    ty.value -= e.deltaY
  }
}

function onBackgroundDown(e: PointerEvent) {
  // Pan uniquement sur le fond (pas sur le contenu), sauf espace ou milieu.
  const onContent = (e.target as HTMLElement).closest('.slide-stage')
  if (onContent && !spaceHeld.value && e.button !== 1) return
  if (e.button === 2) return
  e.preventDefault()
  panning.value = true
  panStart = { x: e.clientX, y: e.clientY, tx: tx.value, ty: ty.value }
  window.addEventListener('pointermove', onPanMove)
  window.addEventListener('pointerup', onPanUp, { once: true })
}

function onPanMove(e: PointerEvent) {
  if (!panning.value) return
  tx.value = panStart.tx + (e.clientX - panStart.x)
  ty.value = panStart.ty + (e.clientY - panStart.y)
}

function onPanUp() {
  panning.value = false
  window.removeEventListener('pointermove', onPanMove)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
    spaceHeld.value = true
    e.preventDefault()
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') spaceHeld.value = false
}

// Refit quand le format change (pas à chaque resize : le zoom manuel est préservé).
watch([() => props.stageW, () => props.stageH], () => fit())

let observer: ResizeObserver | null = null
onMounted(() => {
  fit()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  if (box.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      if (!fitted) fit()
    })
    observer.observe(box.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('pointermove', onPanMove)
  observer?.disconnect()
})

defineExpose({ scale, tx, ty, zoomStep, fit, reset, setZoom: (s: number) => applyZoom(s) })
</script>
