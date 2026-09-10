// Panneau Propriétés : info template + formulaire schema + format +
// section couche sélectionnée (le côté "Photoshop"). Look legacy.
<template>
  <aside class="flex flex-col h-full shrink-0 overflow-hidden" style="background: #141414; font-family: 'Inter', system-ui, sans-serif;">
    <div class="flex items-center justify-between px-4 shrink-0" style="height: 40px; border-bottom: 1px solid #2a2a2a;">
      <span class="text-[11px] font-semibold uppercase tracking-[0.06em]" style="color: #666;">Propriétés</span>
      <span
        v-if="meta"
        class="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
        style="color: #666; background: #222; border: 1px solid #2a2a2a; font-family: Inter, sans-serif;"
      >{{ slide?.type.replace(/_/g, ' ') }}</span>
    </div>

    <div v-if="!slide" class="flex-1 flex items-center justify-center">
      <span class="text-[12px]" style="color: #666; font-family: Inter, sans-serif;">Sélectionnez une slide</span>
    </div>

    <template v-else-if="meta">
      <div class="px-4 py-3 shrink-0" style="border-bottom: 1px solid #2a2a2a; background: #1a1a1a;">
        <p class="text-[13px] font-bold text-white m-0" style="letter-spacing: -0.01em;">{{ meta.name }}</p>
        <p v-if="meta.description" class="text-[11px] mt-1 leading-relaxed font-medium" style="color: #666;">{{ meta.description }}</p>
        <span
          v-if="meta.category"
          class="inline-block mt-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
          style="color: #888; background: #222; border: 1px solid #2a2a2a; letter-spacing: 0.06em;"
        >{{ meta.category }}</span>
      </div>

      <div class="flex-1 overflow-y-auto sb p-4">
        <!-- Format de la slide -->
        <div class="mb-5">
          <div class="flex items-center gap-2 mb-2.5">
            <span class="text-[10px] font-bold uppercase tracking-[0.1em] shrink-0" style="color: #666;">Format</span>
            <div class="flex-1 h-px" style="background: #2a2a2a;" />
          </div>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="f in formats"
              :key="f.id"
              class="format-btn"
              :class="{ 'is-active': slide.format === f.id }"
              :title="`${f.label} — ${f.width}×${f.height}`"
              @click="setFormat(f.id)"
            >{{ f.id }}</button>
          </div>
        </div>

        <SchemaForm :schema="schema" :state="slide.templateState" />

        <!-- Couche sélectionnée -->
        <div v-if="multiCount > 1" class="mt-5">
          <div class="flex items-center gap-2 mb-2.5">
            <span class="text-[10px] font-bold uppercase tracking-[0.1em] shrink-0" style="color: #666;">{{ multiCount }} couches</span>
            <div class="flex-1 h-px" style="background: #2a2a2a;" />
          </div>
          <div class="flex flex-col gap-3">
            <div>
              <div class="text-[10px] font-bold mb-1.5" style="color: #666;">ALIGNER SUR LA SLIDE</div>
              <div class="grid grid-cols-6 gap-1">
                <button
                  v-for="a in ALIGN_BUTTONS"
                  :key="a.pos"
                  class="align-btn"
                  :title="a.label"
                  @click="alignAll(a.pos)"
                >{{ a.icon }}</button>
              </div>
            </div>
            <div class="flex gap-1.5">
              <button class="layer-btn" title="Espacements horizontaux égaux" @click="distribute('x')">⇋ Distribuer</button>
              <button class="layer-btn" title="Espacements verticaux égaux" @click="distribute('y')">⇅ Distribuer</button>
            </div>
            <div class="flex gap-1.5">
              <button class="layer-btn" @click="duplicateAll">Dupliquer ({{ multiCount }})</button>
              <button class="layer-btn danger" @click="removeAll">Supprimer ({{ multiCount }})</button>
            </div>
          </div>
        </div>
        <div v-else-if="activeLayer" class="mt-5">
          <div class="flex items-center gap-2 mb-2.5">
            <span class="text-[10px] font-bold uppercase tracking-[0.1em] shrink-0" style="color: #666;">Couche — {{ activeLayer.name }}</span>
            <div class="flex-1 h-px" style="background: #2a2a2a;" />
          </div>
          <div class="flex flex-col gap-3">
            <div class="grid grid-cols-2 gap-2">
              <label class="layer-num">X <input type="number" :value="Math.round(activeLayer.x)" @focus="gesture.onBegin" @input="gesture.liveLayer(activeLayer.id, { x: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /></label>
              <label class="layer-num">Y <input type="number" :value="Math.round(activeLayer.y)" @focus="gesture.onBegin" @input="gesture.liveLayer(activeLayer.id, { y: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /></label>
              <label class="layer-num">L <input type="number" :value="Math.round(activeLayer.w)" @focus="gesture.onBegin" @input="gesture.liveLayer(activeLayer.id, { w: Math.max(20, numVal($event)) })" @change="gesture.onEnd" @blur="gesture.onEnd" /></label>
              <label class="layer-num">H <input type="number" :value="Math.round(activeLayer.h)" @focus="gesture.onBegin" @input="gesture.liveLayer(activeLayer.id, { h: Math.max(20, numVal($event)) })" @change="gesture.onEnd" @blur="gesture.onEnd" /></label>
            </div>
            <label class="layer-slider">Rotation <input type="range" min="-180" max="180" step="1" :value="activeLayer.rotation" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="gesture.liveLayer(activeLayer.id, { rotation: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ Math.round(activeLayer.rotation) }}°</span></label>
            <label class="layer-slider">Opacité <input type="range" min="0" max="1" step="0.01" :value="activeLayer.opacity" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="gesture.liveLayer(activeLayer.id, { opacity: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ Math.round(activeLayer.opacity * 100) }}%</span></label>

            <!-- Typographie libre (couches texte) -->
            <div v-if="textData" class="flex flex-col gap-3 pt-3" style="border-top: 1px dashed #2a2a2a;">
              <label class="layer-slider">Taille <input type="range" min="8" max="200" step="1" :value="textData.fontSize ?? 32" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="typo({ fontSize: clampTextSize(numVal($event)) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ Math.round(textData.fontSize ?? 32) }}px</span></label>
              <label class="layer-field">Police
                <select class="si" :value="textData.fontFamily ?? ''" @change="typoDiscrete({ fontFamily: ($event.target as HTMLSelectElement).value || undefined })">
                  <option value="">Défaut du template</option>
                  <option v-for="f in BRAND_FONTS" :key="f.name" :value="f.family">{{ f.name }}</option>
                </select>
              </label>
              <label class="layer-field">Graisse
                <select class="si" :value="String(textData.fontWeight ?? '')" @change="typoDiscrete({ fontWeight: weightVal(($event.target as HTMLSelectElement).value) })">
                  <option value="">Défaut</option>
                  <option value="400">Normal 400</option>
                  <option value="500">Medium 500</option>
                  <option value="700">Bold 700</option>
                  <option value="900">Black 900</option>
                </select>
              </label>
              <label class="layer-slider">Interligne <input type="range" min="0.8" max="2" step="0.05" :value="textData.lineHeight ?? 1.2" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="typo({ lineHeight: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ (textData.lineHeight ?? 1.2).toFixed(2) }}</span></label>
              <label class="layer-slider">Interlettre <input type="range" min="-0.1" max="0.5" step="0.01" :value="textData.letterSpacing ?? 0" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="typo({ letterSpacing: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ (textData.letterSpacing ?? 0).toFixed(2) }}em</span></label>
              <div class="flex gap-1.5">
                <button
                  v-for="a in (['left', 'center', 'right', 'justify'] as const)"
                  :key="a"
                  class="align-btn"
                  :class="{ 'is-active': (textData.align ?? 'left') === a }"
                  :title="`Aligner ${a}`"
                  @click="typoDiscrete({ align: a })"
                >{{ a === 'left' ? '⇤' : a === 'center' ? '⇔' : a === 'right' ? '⇥' : '≣' }}</button>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold" style="color: #666;">Couleur</span>
                <input
                  type="color" class="typo-color" :value="textColor"
                  @pointerdown="gesture.onBegin" @focus="gesture.onBegin"
                  @input="typo({ color: ($event.target as HTMLInputElement).value })"
                  @change="gesture.onEnd" @blur="gesture.onEnd"
                />
              </div>
              <BrandSwatches :value="textData.color" @select="(c) => typoDiscrete({ color: c })" />
              <label class="layer-field">Liaison IA 🔗
                <select class="si" :value="textData.bind ?? ''" @change="typoDiscrete({ bind: ($event.target as HTMLSelectElement).value || undefined })">
                  <option v-for="o in BIND_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
              </label>
            </div>

            <!-- Image : recadrage + miroirs + filtres -->
            <div v-if="imageData" class="flex flex-col gap-3 pt-3" style="border-top: 1px dashed #2a2a2a;">
              <label class="layer-slider">Zoom <input type="range" min="0.2" max="3" step="0.05" :value="imageData.zoom ?? 1" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="photo({ zoom: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>×{{ (imageData.zoom ?? 1).toFixed(2) }}</span></label>
              <label class="layer-slider">Focal X <input type="range" min="0" max="100" step="1" :value="imageData.focalX ?? 50" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="photo({ focalX: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ Math.round(imageData.focalX ?? 50) }}%</span></label>
              <label class="layer-slider">Focal Y <input type="range" min="0" max="100" step="1" :value="imageData.focalY ?? 50" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="photo({ focalY: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ Math.round(imageData.focalY ?? 50) }}%</span></label>
              <div class="flex gap-1.5">
                <button class="layer-btn" :class="{ 'is-active': imageData.flipH }" @click="photoDiscrete({ flipH: !imageData.flipH })">⇋ Miroir H</button>
                <button class="layer-btn" :class="{ 'is-active': imageData.flipV }" @click="photoDiscrete({ flipV: !imageData.flipV })">⇅ Miroir V</button>
              </div>
              <label class="layer-slider">Lumière <input type="range" min="0" max="200" step="1" :value="imageData.brightness ?? 100" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="photo({ brightness: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ Math.round(imageData.brightness ?? 100) }}%</span></label>
              <label class="layer-slider">Contraste <input type="range" min="0" max="200" step="1" :value="imageData.contrast ?? 100" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="photo({ contrast: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ Math.round(imageData.contrast ?? 100) }}%</span></label>
              <label class="layer-slider">Saturation <input type="range" min="0" max="200" step="1" :value="imageData.saturate ?? 100" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="photo({ saturate: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ Math.round(imageData.saturate ?? 100) }}%</span></label>
              <label class="layer-slider">Grisaille <input type="range" min="0" max="100" step="1" :value="imageData.grayscale ?? 0" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="photo({ grayscale: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ Math.round(imageData.grayscale ?? 0) }}%</span></label>
              <label class="layer-slider">Flou <input type="range" min="0" max="10" step="0.5" :value="imageData.blur ?? 0" @pointerdown="gesture.onBegin" @focus="gesture.onBegin" @input="photo({ blur: numVal($event) })" @change="gesture.onEnd" @blur="gesture.onEnd" /><span>{{ (imageData.blur ?? 0).toFixed(1) }}px</span></label>
            </div>
            <div class="flex gap-1.5">
              <button class="layer-btn" @click="toggleBehind">{{ activeLayer.behind ? 'Passer devant' : 'Passer derrière' }}</button>
              <button class="layer-btn" @click="duplicateLayer">Dupliquer</button>
              <button class="layer-btn danger" @click="removeLayer">Supprimer</button>
            </div>
            <div>
              <div class="text-[10px] font-bold mb-1.5" style="color: #666;">ALIGNER SUR LA SLIDE</div>
              <div class="grid grid-cols-6 gap-1">
                <button
                  v-for="a in ALIGN_BUTTONS"
                  :key="a.pos"
                  class="align-btn"
                  :title="a.label"
                  @click="align(a.pos)"
                >{{ a.icon }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 px-4 shrink-0" style="height: 32px; border-top: 1px solid #2a2a2a;">
        <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background: #22c55e;" />
        <span class="text-[11px]" style="color: #666; font-family: Inter, sans-serif;">Sauvegarde automatique active</span>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getTemplate, resolveTemplateSchema } from '../registry'
import { FORMAT_IDS, FORMATS } from '../formats'
import type { FormatId } from '../types'
import type { ImageLayerData, TextLayerData } from '../types'
import { BRAND_FONTS, clampTextSize } from '../brand'
import { BIND_OPTIONS } from '../article'
import { useSlideDeckStore } from '../store/deck'
import type { AlignPosition } from '../store/deck'
import { useGestureInput } from '../engine/gestures'
import SchemaForm from './SchemaForm.vue'
import BrandSwatches from './BrandSwatches.vue'

const store = useSlideDeckStore()
const gesture = useGestureInput()

const slide = computed(() => store.activeSlide)
const meta = computed(() => (slide.value ? getTemplate(slide.value.type) : undefined))
const schema = computed(() =>
  meta.value && slide.value ? resolveTemplateSchema(meta.value, slide.value.templateState) : [],
)
const formats = computed(() => FORMAT_IDS.map((id) => FORMATS[id]))
const activeLayer = computed(() => store.getActiveLayer())
const multiCount = computed(() => store.selectedLayers.length)
const textData = computed<TextLayerData | null>(() => {
  const layer = activeLayer.value
  if (!layer || layer.kind !== 'text') return null
  return layer.data as TextLayerData
})
const imageData = computed<ImageLayerData | null>(() => {
  const layer = activeLayer.value
  if (!layer || layer.kind !== 'image') return null
  return layer.data as ImageLayerData
})
const textColor = computed(() =>
  typeof textData.value?.color === 'string' && /^#[0-9a-f]{6}$/i.test(textData.value.color)
    ? textData.value.color
    : '#ffffff',
)

function setFormat(format: FormatId) {
  if (slide.value) store.setSlideFormat(slide.value.id, format)
}

function numVal(e: Event): number {
  const v = parseFloat((e.target as HTMLInputElement).value)
  return Number.isNaN(v) ? 0 : v
}

function weightVal(raw: string): number | undefined {
  const v = parseInt(raw, 10)
  return Number.isFinite(v) ? v : undefined
}

/** Patch typo continu (groupé par geste). */
function typo(patch: Partial<TextLayerData>) {
  const layer = activeLayer.value
  if (layer) gesture.liveLayerData(layer.id, patch as Record<string, unknown>)
}

/** Patch typo discret (clic/select : 1 undo). */
function typoDiscrete(patch: Partial<TextLayerData>) {
  const layer = activeLayer.value
  if (layer) store.updateLayerData(layer.id, patch as Record<string, unknown>)
}

/** Patch data image continu (groupé par geste). */
function photo(patch: Partial<ImageLayerData>) {
  const layer = activeLayer.value
  if (layer) gesture.liveLayerData(layer.id, patch as Record<string, unknown>)
}

/** Patch data image discret (clic : 1 undo). */
function photoDiscrete(patch: Partial<ImageLayerData>) {
  const layer = activeLayer.value
  if (layer) store.updateLayerData(layer.id, patch as Record<string, unknown>)
}

function toggleBehind() {
  const layer = activeLayer.value
  if (!layer) return
  if (layer.behind) store.bringLayerToFront(layer.id)
  else store.sendLayerToBack(layer.id)
}

function duplicateLayer() {
  const layer = activeLayer.value
  if (layer) store.duplicateLayer(layer.id)
}

function removeLayer() {
  const layer = activeLayer.value
  if (layer) store.removeLayer(layer.id)
}

const ALIGN_BUTTONS: { pos: AlignPosition; icon: string; label: string }[] = [
  { pos: 'left', icon: '⇤', label: 'Bord gauche' },
  { pos: 'center-x', icon: '⇔', label: 'Centrer horizontalement' },
  { pos: 'right', icon: '⇥', label: 'Bord droit' },
  { pos: 'top', icon: '⇈', label: 'Haut' },
  { pos: 'middle', icon: '⇕', label: 'Centrer verticalement' },
  { pos: 'bottom', icon: '⇊', label: 'Bas' },
]

function align(pos: AlignPosition) {
  const layer = activeLayer.value
  if (layer) store.alignLayer(layer.id, pos)
}

function alignAll(pos: AlignPosition) {
  store.alignLayers(store.selectedLayerIds, pos)
}

function distribute(axis: 'x' | 'y') {
  // < 3 couches : no-op silencieux (pas d'undo vide).
  store.distributeSelected(axis)
}

function duplicateAll() {
  store.duplicateLayers([...store.selectedLayerIds])
}

function removeAll() {
  store.removeLayers([...store.selectedLayerIds])
}
</script>

<style scoped>
.format-btn {
  background: #0f0f0f; border: 1px solid #2a2a2a; color: #aaa;
  font-size: 10px; font-weight: 700; padding: 6px 0; cursor: pointer;
  border-radius: 6px; font-family: 'Inter', monospace;
}
.format-btn:hover { border-color: #555; color: #fff; }
.format-btn.is-active { background: #fff; color: #000; border-color: #fff; }
.layer-num {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 700; color: #666;
  background: #0f0f0f; border: 1px solid #2a2a2a;
  padding: 4px 8px; border-radius: 6px;
}
.layer-num input {
  width: 100%; background: transparent; border: none; outline: none;
  color: #fff; font-size: 11px; font-family: 'Inter', monospace; text-align: right;
}
.layer-slider {
  display: grid; grid-template-columns: 52px 1fr 38px; align-items: center; gap: 8px;
  font-size: 10px; font-weight: 700; color: #666;
}
.layer-slider span { text-align: right; color: #aaa; font-family: 'Inter', monospace; }
.layer-field {
  display: flex; flex-direction: column; gap: 4px;
  font-size: 10px; font-weight: 700; color: #666;
}
.align-btn {
  flex: 1; background: #0f0f0f; border: 1px solid #2a2a2a; color: #aaa;
  font-size: 13px; padding: 5px 0; cursor: pointer; border-radius: 6px;
}
.align-btn:hover { border-color: #555; color: #fff; }
.align-btn.is-active { background: #fff; color: #000; border-color: #fff; }
.typo-color {
  width: 44px; height: 24px; background: #0f0f0f;
  border: 1px solid #2a2a2a; border-radius: 6px; cursor: pointer; padding: 2px 4px;
}
.layer-btn {
  flex: 1; background: #222; border: 1px solid #3a3a3a; color: #aaa;
  font-size: 10px; font-weight: 700; padding: 6px 0; cursor: pointer; border-radius: 6px;
}
.layer-btn:hover { color: #fff; border-color: #555; }
.layer-btn.is-active { background: #fff; color: #000; border-color: #fff; }
.layer-btn.danger:hover { background: #2a1010; color: #ef4444; border-color: #4a1010; }
</style>
