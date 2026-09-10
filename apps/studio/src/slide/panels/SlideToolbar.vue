// Toolbar supérieure legacy : marque, IA, JSON, compteur, undo/redo,
// format deck, reset, exports.
<template>
  <div
    class="flex items-center px-5 gap-0 shrink-0 z-[100]"
    style="height: 52px; background: #0f0f0f; border-bottom: 1px solid #2a2a2a; font-family: 'Inter', system-ui, sans-serif;"
  >
    <div class="flex items-center gap-4 flex-1">
      <div class="flex items-center gap-2 py-1.5">
        <div class="w-[22px] h-[22px] bg-white flex items-center justify-center shrink-0 rounded">
          <div class="w-2 h-2 bg-black" />
        </div>
        <span class="text-[14px] font-bold text-white" style="letter-spacing: -0.02em;">Studio</span>
      </div>

      <div class="w-px h-5" style="background: #2a2a2a; margin: 0 4px;" />

      <button class="tb-primary" @click="emit('ai')">✦ Générer avec l'IA</button>
      <button class="tb-ghost" @click="emit('importJson')">Importer JSON</button>
    </div>

    <div class="flex items-center gap-1.5">
      <span
        class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
        style="color: #666; font-weight: 600; background: #1a1a1a; border: 1px solid #2a2a2a;"
      >{{ deckCount }} slide{{ deckCount > 1 ? 's' : '' }}</span>
      <span v-if="zoomPercent !== null" class="text-[11px] tabular-nums px-2" style="color: #555;">{{ zoomPercent }}%</span>
    </div>

    <div class="flex items-center gap-2 flex-1 justify-end">
      <button class="tb-icon" title="Annuler (Ctrl+Z)" :disabled="!canUndo" @click="emit('undo')">↩</button>
      <button class="tb-icon" title="Rétablir (Ctrl+Y)" :disabled="!canRedo" @click="emit('redo')">↪</button>
      <select
        class="tb-select"
        title="Format du deck"
        :value="deckFormat"
        @change="emit('format', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="f in formats" :key="f.id" :value="f.id">{{ f.id }} · {{ f.width }}×{{ f.height }}</option>
      </select>
      <button class="tb-ghost" title="Nettoyer les mises en forme du template" @click="emit('clean')">Nettoyer styles</button>
      <button class="tb-ghost danger" title="Reset la slide active" @click="emit('reset')">Reset slide</button>
      <div class="w-px h-5" style="background: #2a2a2a; margin: 0 4px;" />
      <button class="tb-primary" @click="emit('exportJson')">JSON</button>
      <button class="tb-primary" @click="emit('exportZip')">ZIP</button>
      <button class="tb-export" @click="emit('exportPng')">↓ Export PNG</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FORMAT_IDS, FORMATS } from '../formats'

withDefaults(
  defineProps<{
    deckCount?: number
    canUndo?: boolean
    canRedo?: boolean
    deckFormat?: string
    zoomPercent?: number | null
  }>(),
  { deckCount: 0, canUndo: false, canRedo: false, deckFormat: '4:5', zoomPercent: null },
)

const emit = defineEmits<{
  (e: 'ai'): void
  (e: 'importJson'): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'format', format: string): void
  (e: 'clean'): void
  (e: 'reset'): void
  (e: 'exportJson'): void
  (e: 'exportZip'): void
  (e: 'exportPng'): void
}>()

const formats = computed(() => FORMAT_IDS.map((id) => FORMATS[id]))
</script>

<style scoped>
.tb-primary {
  display: flex; align-items: center; gap: 6px;
  background: #252525; border: 1px solid #2a2a2a;
  color: #aaa; font-size: 12px; font-weight: 600;
  padding: 6px 14px; cursor: pointer; border-radius: 8px; font-family: inherit;
}
.tb-primary:hover { border-color: #555; color: #fff; }
.tb-ghost {
  background: none; border: none; cursor: pointer;
  font-size: 12px; color: #666; font-family: inherit; padding: 5px 8px;
}
.tb-ghost:hover { color: #aaa; }
.tb-ghost.danger:hover { color: #ef4444; }
.tb-icon {
  background: none; border: 1px solid transparent; cursor: pointer;
  font-size: 14px; color: #aaa; padding: 4px 8px; border-radius: 6px;
}
.tb-icon:hover:not(:disabled) { background: #252525; color: #fff; }
.tb-icon:disabled { opacity: 0.3; cursor: default; }
.tb-select {
  background: #252525; border: 1px solid #2a2a2a; color: #aaa;
  font-size: 11px; font-weight: 600; padding: 6px 8px; cursor: pointer;
  border-radius: 8px; font-family: 'Inter', monospace;
}
.tb-export {
  background: #ffffff; color: #000; border: none;
  font-size: 12px; font-weight: 700; padding: 7px 18px; cursor: pointer;
  border-radius: 8px; font-family: inherit;
  text-transform: uppercase; letter-spacing: 0.02em;
}
.tb-export:hover { background: #e0e0e0; }
</style>
