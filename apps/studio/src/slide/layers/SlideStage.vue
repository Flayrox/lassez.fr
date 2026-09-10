// SlideStage — la slide à taille réelle : template + couches libres.
// behind = derrière le template (assets de fond), les autres devant.
// Clics dans le vide → désélection. Guides magnétiques au déplacement.
<template>
  <div
    ref="stageEl"
    class="slide-stage relative overflow-hidden"
    data-export="stage"
    :style="stageStyle"
    @pointerdown.self="onEmptyDown"
  >
    <!-- Derrière le template -->
    <template v-for="layer in behind" :key="layer.id">
      <component
        :is="viewFor(layer.kind)"
        v-if="layer.visible"
        :layer="layer"
        :scale="viewportScale"
        @select="select"
        @gesturestart="onGestureStart"
        @move="onMove"
        @resize="onResize"
        @gestureend="onGestureEnd"
      />
    </template>

    <!-- Template -->
    <div class="absolute inset-0" @pointerdown="onTemplateDown">
      <component :is="tplComponent" :state="slide.templateState" />
    </div>

    <!-- Devant le template -->
    <template v-for="layer in front" :key="layer.id">
      <component
        :is="viewFor(layer.kind)"
        v-if="layer.visible"
        :layer="layer"
        :scale="viewportScale"
        @select="select"
        @gesturestart="onGestureStart"
        @move="onMove"
        @resize="onResize"
        @gestureend="onGestureEnd"
      />
    </template>

    <!-- Guides magnétiques -->
    <div v-if="guides.includes('v-left')" class="absolute top-0 bottom-0 w-px bg-[#DC2626] z-[200] pointer-events-none" style="left: 0;" />
    <div v-if="guides.includes('v-center')" class="absolute top-0 bottom-0 w-px bg-[#DC2626] z-[200] pointer-events-none" style="left: 50%;" />
    <div v-if="guides.includes('v-right')" class="absolute top-0 bottom-0 w-px bg-[#DC2626] z-[200] pointer-events-none" style="right: 0;" />
    <div v-if="guides.includes('h-top')" class="absolute left-0 right-0 h-px bg-[#DC2626] z-[200] pointer-events-none" style="top: 0;" />
    <div v-if="guides.includes('h-middle')" class="absolute left-0 right-0 h-px bg-[#DC2626] z-[200] pointer-events-none" style="top: 50%;" />
    <div v-if="guides.includes('h-bottom')" class="absolute left-0 right-0 h-px bg-[#DC2626] z-[200] pointer-events-none" style="bottom: 0;" />

    <!-- Sélections (la primaire a les poignées complètes) -->
    <SelectionBox
      v-for="boxed in selectedBoxes"
      :key="boxed.id"
      :layer="boxed"
      :scale="viewportScale"
      @gesturestart="onGestureStart"
      @move="onMove"
      @resize="onResize"
      @gestureend="onGestureEnd"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import { getFormat } from '../formats'
import { useSlideDeckStore } from '../store/deck'
import { snapToGuides, type Guide } from '../engine/geometry'
import { sortLayers } from '../utils'
import type { Layer, LayerKind, Slide } from '../types'
import SelectionBox from '../engine/SelectionBox.vue'
import TextLayerView from './TextLayerView.vue'
import ImageLayerView from './ImageLayerView.vue'
import ShapeLayerView from './ShapeLayerView.vue'
import CoverTpl from '../templates/CoverTpl.vue'
import NewsTpl from '../templates/NewsTpl.vue'
import VersusTpl from '../templates/VersusTpl.vue'
import BigNumTpl from '../templates/BigNumTpl.vue'
import ImpactQuoteTpl from '../templates/ImpactQuoteTpl.vue'
import InfoTpl from '../templates/InfoTpl.vue'
import OutroTpl from '../templates/OutroTpl.vue'

const props = defineProps<{ slide: Slide }>()

const store = useSlideDeckStore()
// Nœud d'export (taille réelle) — exposé pour renderStagePNG.
const stageEl = ref<HTMLElement | null>(null)
defineExpose({ stageEl })
// Échelle du viewport (provide par Viewport, défaut 1 hors viewport/tests).
const viewportScale = inject<Ref<number>>('slide-viewport-scale', ref(1))

const guides = ref<Guide[]>([])

const format = computed(() => getFormat(props.slide.format))

const stageStyle = computed(() => ({
  width: `${format.value.width}px`,
  height: `${format.value.height}px`,
  containerType: 'inline-size' as const,
}))

const TPL_MAP = {
  COVER: CoverTpl,
  NEWS: NewsTpl,
  VERSUS: VersusTpl,
  BIG_NUM: BigNumTpl,
  IMPACT_QUOTE: ImpactQuoteTpl,
  INFO: InfoTpl,
  OUTRO: OutroTpl,
} as const

const tplComponent = computed(() => {
  return (TPL_MAP as Record<string, unknown>)[props.slide.type] ?? InfoTpl
})

const visibleLayers = computed(() => props.slide.layers)
const behind = computed(() => sortLayers(visibleLayers.value.filter((l) => l.behind)))
const front = computed(() => sortLayers(visibleLayers.value.filter((l) => !l.behind)))

/** Toutes les sélectionnées (visibles, déverrouillées) ont leur cadre. */
const selectedBoxes = computed<Layer[]>(() => {
  const ids = new Set(store.selectedLayerIds)
  return props.slide.layers.filter((l) => ids.has(l.id) && l.visible && !l.locked)
})

/** Couche pilotant le geste en cours (drag groupé). */
const draggedId = ref<string | null>(null)

function viewFor(kind: LayerKind) {
  if (kind === 'image') return ImageLayerView
  if (kind === 'shape') return ShapeLayerView
  return TextLayerView
}

function select(id: string, additive: boolean) {
  if (additive) store.toggleLayerSelection(id)
  else store.selectLayer(id)
}

function onEmptyDown() {
  store.selectLayer(null)
}

function onTemplateDown() {
  // Cliquer le template désélectionne la couche (édition template prioritaire).
  if (store.selectedLayerId) store.selectLayer(null)
}

function onGestureStart(id: string) {
  // Draguer une couche hors sélection la sélectionne seule (standard).
  if (!store.selectedLayerIds.includes(id)) store.selectLayer(id)
  draggedId.value = id
  store.beginGesture()
}

function onMove(payload: { id?: string; x: number; y: number }) {
  const dragged = props.slide.layers.find((l) => l.id === (draggedId.value ?? payload.id))
  if (!dragged) return
  const snapped = snapToGuides(payload.x, payload.y, dragged.w, dragged.h, format.value.width, format.value.height)
  guides.value = snapped.guides
  const nx = Math.round(snapped.x * 100) / 100
  const ny = Math.round(snapped.y * 100) / 100
  const dx = nx - dragged.x
  const dy = ny - dragged.y
  store.moveLayerLive(dragged.id, nx, ny)
  // Drag groupé : les autres sélectionnées suivent du même delta.
  for (const other of selectedBoxes.value) {
    if (other.id === dragged.id || other.locked) continue
    store.moveLayerLive(other.id, other.x + dx, other.y + dy)
  }
}

function onResize(payload: { id: string; rect: { x: number; y: number; w: number; h: number } }) {
  const layer = props.slide.layers.find((l) => l.id === payload.id)
  if (!layer) return
  store.updateLayerLive(layer.id, payload.rect)
}

function onGestureEnd() {
  guides.value = []
  draggedId.value = null
}
</script>
