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
        <div v-if="activeLayer" class="mt-5">
          <div class="flex items-center gap-2 mb-2.5">
            <span class="text-[10px] font-bold uppercase tracking-[0.1em] shrink-0" style="color: #666;">Couche — {{ activeLayer.name }}</span>
            <div class="flex-1 h-px" style="background: #2a2a2a;" />
          </div>
          <div class="flex flex-col gap-3">
            <div class="grid grid-cols-2 gap-2">
              <label class="layer-num">X <input type="number" :value="Math.round(activeLayer.x)" @change="setLayer({ x: numVal($event) })" /></label>
              <label class="layer-num">Y <input type="number" :value="Math.round(activeLayer.y)" @change="setLayer({ y: numVal($event) })" /></label>
              <label class="layer-num">L <input type="number" :value="Math.round(activeLayer.w)" @change="setLayer({ w: Math.max(20, numVal($event)) })" /></label>
              <label class="layer-num">H <input type="number" :value="Math.round(activeLayer.h)" @change="setLayer({ h: Math.max(20, numVal($event)) })" /></label>
            </div>
            <label class="layer-slider">Rotation <input type="range" min="-180" max="180" step="1" :value="activeLayer.rotation" @input="setLayer({ rotation: numVal($event) })" /><span>{{ Math.round(activeLayer.rotation) }}°</span></label>
            <label class="layer-slider">Opacité <input type="range" min="0" max="1" step="0.01" :value="activeLayer.opacity" @input="setLayer({ opacity: numVal($event) })" /><span>{{ Math.round(activeLayer.opacity * 100) }}%</span></label>
            <div class="flex gap-1.5">
              <button class="layer-btn" @click="toggleBehind">{{ activeLayer.behind ? 'Passer devant' : 'Passer derrière' }}</button>
              <button class="layer-btn" @click="duplicateLayer">Dupliquer</button>
              <button class="layer-btn danger" @click="removeLayer">Supprimer</button>
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
import type { FormatId, Layer } from '../types'
import { useSlideDeckStore } from '../store/deck'
import SchemaForm from './SchemaForm.vue'

const store = useSlideDeckStore()

const slide = computed(() => store.activeSlide)
const meta = computed(() => (slide.value ? getTemplate(slide.value.type) : undefined))
const schema = computed(() =>
  meta.value && slide.value ? resolveTemplateSchema(meta.value, slide.value.templateState) : [],
)
const formats = computed(() => FORMAT_IDS.map((id) => FORMATS[id]))
const activeLayer = computed(() => store.getActiveLayer())

function setFormat(format: FormatId) {
  if (slide.value) store.setSlideFormat(slide.value.id, format)
}

function numVal(e: Event): number {
  const v = parseFloat((e.target as HTMLInputElement).value)
  return Number.isNaN(v) ? 0 : v
}

function setLayer(patch: Partial<Pick<Layer, 'x' | 'y' | 'w' | 'h' | 'rotation' | 'opacity'>>) {
  const layer = activeLayer.value
  if (layer) store.updateLayer(layer.id, patch)
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
.layer-btn {
  flex: 1; background: #222; border: 1px solid #3a3a3a; color: #aaa;
  font-size: 10px; font-weight: 700; padding: 6px 0; cursor: pointer; border-radius: 6px;
}
.layer-btn:hover { color: #fff; border-color: #555; }
.layer-btn.danger:hover { background: #2a1010; color: #ef4444; border-color: #4a1010; }
</style>
