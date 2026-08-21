<template>
  <div class="flex flex-col h-[calc(100vh-80px)] space-y-3">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">Atelier</h1>
        <p class="text-xs text-text-3 mt-0.5">Ta chaîne de fabrication — clique une étape pour la régler, mets en pause sans perdre ses réglages</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[11px] font-mono px-2 py-1 rounded border"
          :class="sync === 'saved' ? 'border-accent/40 text-accent bg-accent-muted' : sync === 'pending' ? 'border-warning/40 text-warning bg-warning/5' : 'border-border text-text-3'">{{ syncLabel }}</span>
        <LButton variant="secondary" @click="resetLayout">↺ Réorganiser</LButton>
      </div>
    </div>

    <div class="flex-1 flex gap-4 min-h-0">
      <!-- Canvas -->
      <div class="flex-1 border border-border rounded-card relative overflow-hidden bg-bg">
        <VueFlow v-model="elements" :default-viewport="{ x: 20, y: 20, zoom: 0.9 }" :snap-to-grid="true" :snap-grid="[20, 20]" fit-view-on-init class="h-full" @nodeDragStop="onNodesChange">
          <template #node-custom="props">
            <div @click="selectNode(props.id)"
              class="w-[190px] rounded-card border bg-surface p-3 cursor-pointer select-none transition-all"
              :class="selectedId === props.id ? 'border-accent shadow-[0_0_0_2px_var(--accent-muted)]' : 'border-border hover:border-text-3'"
              :style="{ opacity: isEnabled(props.id) ? 1 : 0.45 }">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded flex items-center justify-center text-xs font-semibold shrink-0" :class="isEnabled(props.id) ? 'bg-accent text-accent-fg' : 'bg-surface-hover text-text-3'">{{ iconFor(props.data.type) }}</div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium truncate">{{ props.data.label }}</p>
                  <p class="text-[10px] text-text-3 truncate">{{ props.data.desc }}</p>
                </div>
                <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="isEnabled(props.id) ? 'bg-accent' : 'bg-border'"></span>
              </div>
              <div class="mt-2">
                <LBadge :variant="isEnabled(props.id) ? 'accent' : 'neutral'">{{ isEnabled(props.id) ? 'En marche' : 'En pause' }}</LBadge>
              </div>
            </div>
          </template>
        </VueFlow>
        <div v-if="elements.length === 0" class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <LEmpty icon="⬢" title="Aucune étape" description="Ajoute des étapes depuis la palette à droite" />
        </div>
      </div>

      <!-- Panneau droit -->
      <div class="w-[320px] shrink-0 flex flex-col gap-3 overflow-y-auto">
        <!-- Palette -->
        <LCard title="Ajouter une étape">
          <div class="grid grid-cols-2 gap-2">
            <button v-for="t in palette" :key="t.type" @click="addNode(t)"
              class="border border-border rounded px-2.5 py-2 text-left hover:border-accent/60 hover:bg-surface-hover transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="!!store.atelier.find(x => x.type === t.type)">
              <p class="text-xs font-medium">{{ t.label }}</p>
              <p class="text-[10px] text-text-3">{{ t.desc }}</p>
              <p v-if="store.atelier.find(x => x.type === t.type)" class="text-[9px] text-accent mt-0.5">déjà ajoutée ✓</p>
            </button>
          </div>
        </LCard>

        <!-- Inspector -->
        <div v-if="selected" class="bg-surface border border-border rounded-card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium">{{ selected.data.label }}</h3>
            <button @click="selectedId = null" class="text-text-3 hover:text-text-1">✕</button>
          </div>
          <label class="flex items-center gap-2.5 text-xs">
            <LToggle :model-value="isEnabled(selected.id)" @update:model-value="() => toggleEnabled(selected.id)" />
            En marche (les réglages sont gardés si en pause)
          </label>

          <!-- Champs riches par type -->
          <template v-for="f in editableSettings" :key="f.key">
            <LToggle v-if="f.type === 'toggle'" :model-value="!!f.value" @update:model-value="(v: boolean) => updateSetting(f, v)" />
            <label v-else-if="f.type === 'toggle-row'" class="flex items-center justify-between gap-2 -mx-1 px-1 py-1 border border-border/50 rounded">
              <span class="min-w-0"><span class="text-xs font-medium block">{{ f.label }}</span><span v-if="f.help" class="text-[10px] text-text-3 block">{{ f.help }}</span></span>
              <LToggle :model-value="!!f.value" @update:model-value="(v: boolean) => updateSetting(f, v)" />
            </label>
            <div v-else-if="f.type === 'slider'" class="space-y-1">
              <div class="flex justify-between text-xs"><span class="font-medium">{{ f.label }}</span><span class="text-text-3 font-mono">{{ f.value }}{{ f.unit ?? '' }}</span></div>
              <input type="range" :min="f.min" :max="f.max" :step="f.step ?? 1" :value="f.value" @input="updateSetting(f, parseInt(($event.target as HTMLInputElement).value))" class="w-full accent-accent" />
              <p v-if="f.help" class="text-[10px] text-text-3">{{ f.help }}</p>
            </div>
            <div v-else-if="f.type === 'select'" class="space-y-1">
              <p class="text-xs font-medium">{{ f.label }}</p>
              <select :value="f.value" @change="updateSetting(f, ($event.target as HTMLSelectElement).value)" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
                <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
              </select>
              <p v-if="f.help" class="text-[10px] text-text-3">{{ f.help }}</p>
            </div>
            <LInput v-else :label="f.label" :help="f.help" :model-value="String(f.value ?? '')" @update:model-value="(v: string) => updateSetting(f, v)" />
          </template>

          <LButton variant="danger" class="w-full" @click="removeNode(selected.id)">Retirer cette étape</LButton>
        </div>
        <LEmpty v-else icon="✎" title="Rien sélectionné" description="Clique une étape sur le graphe pour régler ses détails" />

        <!-- État sync -->
        <div class="bg-surface border border-border rounded-card px-3 py-2">
          <p class="text-[10px] uppercase tracking-wider text-text-3 mb-0.5">État</p>
          <p class="text-[11px] text-text-2">{{ syncDetail }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LButton from '../components/ui/LButton.vue'
import LBadge from '../components/ui/LBadge.vue'
import LInput from '../components/ui/LInput.vue'
import LToggle from '../components/ui/LToggle.vue'
import LEmpty from '../components/ui/LEmpty.vue'

const store = useConfigStore()
const selectedId = ref<string | null>(null)
const sync = ref<'idle' | 'pending' | 'saved'>('idle')
const syncDetail = ref('Prêt — tout est gardé automatiquement')

interface Field {
  key: string
  label?: string
  help?: string
  type: 'text' | 'number' | 'select' | 'toggle' | 'toggle-row' | 'slider'
  value: any
  options?: string[]
  min?: number
  max?: number
  unit?: string
  apply: (v: any) => void
}

const palette = [
  { type: 'ingestion', label: 'Collecte', desc: 'Récupère les articles', icon: '◉' },
  { type: 'dedup', label: 'Anti-doublons', desc: 'Enlève les déjà vus', icon: '⬢' },
  { type: 'research', label: 'Tri', desc: 'Note l’intérêt', icon: '✦' },
  { type: 'editor', label: 'Rédaction', desc: 'Écrit le brouillon', icon: '✎' },
  { type: 'validator', label: 'Vérification', desc: 'Vérifie les faits', icon: '✓' },
  { type: 'media', label: 'Image', desc: 'Ajoute l’illustration', icon: '◎' },
]

// ── Éléments du graphe, positions persistées dans le store ──
const elements = ref<any[]>([])
function toElements() {
  const nodes = store.atelier.map((n, i) => ({
    id: n.type,
    type: 'custom',
    position: store.positions[n.type] ?? { x: 40 + (i % 2) * 240, y: 40 + Math.floor(i / 2) * 120 },
    data: { label: n.label, type: n.type, desc: n.desc },
  }))
  const edges = []
  for (let i = 0; i < nodes.length - 1; i++)
    if (store.atelier[i].enabled && store.atelier[i + 1].enabled)
      edges.push({ id: `e-${nodes[i].id}-${nodes[i + 1].id}`, source: nodes[i].id, target: nodes[i + 1].id, animated: true, style: { stroke: 'var(--accent)', strokeWidth: 1.5 } })
  elements.value = [...nodes, ...edges]
}
toElements()
watch(() => store.atelier, toElements, { deep: true })

function savePositions() {
  const pos: Record<string, { x: number; y: number }> = {}
  for (const el of elements.value) {
    if (el.position) pos[el.id] = { x: Math.round(el.position.x), y: Math.round(el.position.y) }
  }
  store.positions = pos
}

const selected = computed(() => elements.value.find(e => e.id === selectedId.value))
function selectNode(id: string) { selectedId.value = id }
function isEnabled(id: string) { return store.atelier.find(x => x.type === id)?.enabled ?? true }
function iconFor(t: string) { return palette.find(p => p.type === t)?.icon || '●' }
function toggleEnabled(id: string) {
  const n = store.atelier.find(x => x.type === id)
  if (n) { n.enabled = !n.enabled; store.markDirty(); markPending() }
}
function addNode(t: any) {
  if (store.atelier.find(x => x.type === t.type)) return
  store.atelier.push({ type: t.type, label: t.label, enabled: true, desc: t.desc, order: store.atelier.length + 1 })
  store.markDirty(); toElements(); markPending()
}
function removeNode(id: string) {
  store.atelier = store.atelier.filter(x => x.type !== id)
  delete store.positions[id]
  store.markDirty(); selectedId.value = null; toElements(); markPending()
}
function onNodesChange() {
  savePositions()
  store.markDirty(); markPending()
}
function resetLayout() {
  // "Réorganiser" = disposition auto propre (pas de remise à zéro des réglages)
  store.positions = {}
  toElements(); markPending()
}

// ── Champs riches par étape ──
const editableSettings = computed<Field[]>(() => {
  if (!selected.value) return []
  switch (selected.value.data.type) {
    case 'ingestion':
      return [
        { key: 'lookback', label: 'Fenêtre de collecte', unit: ' h', help: 'On ne prend que les articles de ces dernières heures', type: 'slider', min: 1, max: 48, value: store.sources.lookbackHours, apply: (v: number) => (store.sources.lookbackHours = v) },
        { key: 'maxArticles', label: 'Maximum d’articles par passage', help: 'Garde le robot rapide', type: 'slider', min: 5, max: 50, value: store.sources.maxArticlesPerScan, apply: (v: number) => (store.sources.maxArticlesPerScan = v) },
        { key: 'concurrency', label: 'Sources chargées à la fois', help: 'Plus = plus vite mais plus de charge', type: 'slider', min: 1, max: 15, value: store.sources.concurrency, apply: (v: number) => (store.sources.concurrency = v) },
      ]
    case 'dedup':
      return [
        { key: 'threshold', label: 'Ressemblance maximum', unit: '%', help: 'Au-delà, l’article est un doublon', type: 'slider', min: 10, max: 90, value: store.filtres.seuilRessemblance, apply: (v: number) => (store.filtres.seuilRessemblance = v) },
        { key: 'window', label: 'Mémoire anti-doublons', unit: ' h', help: 'On compare avec cette fenêtre', type: 'slider', min: 1, max: 72, value: store.filtres.fenetreDoublonsHeures, apply: (v: number) => (store.filtres.fenetreDoublonsHeures = v) },
      ]
    case 'research':
      return [
        { key: 'aiModelFlash', label: 'Modèle de tri', help: 'Le plus rapide pour noter 0–100', type: 'select', options: ['gemini-3-flash-preview', 'gemini-2.5-flash'], value: store.ecriture.modeleRapide, apply: (v: string) => (store.ecriture.modeleRapide = v) },
        { key: 'concurrency', label: 'Traiter combien à la fois', help: 'En parallèle', type: 'slider', min: 1, max: 10, value: store.ecriture.tachesEnMemeTempsRapide, apply: (v: number) => (store.ecriture.tachesEnMemeTempsRapide = v) },
        { key: 'webSearch', label: 'Recherche web', help: 'Gemini vérifie sur le web avant de noter', type: 'toggle-row', value: store.ecriture.webSearchEnabled, apply: (v: boolean) => (store.ecriture.webSearchEnabled = v) },
      ]
    case 'editor':
      return [
        { key: 'aiModelPro', label: 'Modèle de rédaction', help: 'Le plus fort pour écrire', type: 'select', options: ['gemini-3.1-pro-preview', 'gemini-2.5-pro'], value: store.ecriture.modeleRedaction, apply: (v: string) => (store.ecriture.modeleRedaction = v) },
        { key: 'concurrency', label: 'Rédiger combien à la fois', type: 'slider', min: 1, max: 8, value: store.ecriture.tachesEnMemeTempsRedaction, apply: (v: number) => (store.ecriture.tachesEnMemeTempsRedaction = v) },
      ]
    case 'validator':
      return [
        { key: 'scoreMini', label: 'Note minimale /100', help: 'En dessous → rejeté automatiquement', type: 'slider', min: 20, max: 80, value: store.ecriture.scoreMini, apply: (v: number) => (store.ecriture.scoreMini = v) },
        { key: 'autoApprove', label: 'Approuver tout seul', help: 'Sinon les articles attendent ta validation dans Signaux', type: 'toggle-row', value: store.partage.auto, apply: (v: boolean) => (store.partage.auto = v) },
      ]
    case 'media':
      return [
        { key: 'overlay', label: 'Overlay sombre', help: 'Assombrit l’image pour que le texte se lise', type: 'toggle-row', value: store.media.overlayEnabled, apply: (v: boolean) => (store.media.overlayEnabled = v) },
        { key: 'opacity', label: 'Opacité de l’overlay', unit: '%', type: 'slider', min: 10, max: 90, value: store.media.overlayOpacity, apply: (v: number) => (store.media.overlayOpacity = v) },
        { key: 'scale169', label: 'Zone image 16:9', unit: '%', help: 'Taille du cadre image sur les visuels larges', type: 'slider', min: 50, max: 95, value: store.media.boxScale169, apply: (v: number) => (store.media.boxScale169 = v) },
        { key: 'scale11', label: 'Zone image carrée', unit: '%', type: 'slider', min: 50, max: 95, value: store.media.boxScale11, apply: (v: number) => (store.media.boxScale11 = v) },
      ]
    default:
      return []
  }
})
function updateSetting(f: Field, v: any) {
  f.apply(v)
  store.markDirty()
  markPending()
}

// ── Sync debounced ──
let tmr: ReturnType<typeof setTimeout> | null = null
function markPending() {
  sync.value = 'pending'
  syncDetail.value = 'Modification en cours…'
  if (tmr) clearTimeout(tmr)
  tmr = setTimeout(() => {
    savePositions()
    store.save()
    sync.value = 'saved'
    syncDetail.value = 'Gardé — le robot le lira au prochain tour'
    setTimeout(() => { if (sync.value === 'saved') sync.value = 'idle' }, 2000)
  }, 400)
}
const syncLabel = computed(() => (sync.value === 'pending' ? '● En attente' : sync.value === 'saved' ? '✓ Gardé' : 'Prêt'))
</script>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';

.vue-flow__pane { background: var(--bg); cursor: grab; }
.vue-flow__edge-path { stroke: var(--border); }
.vue-flow__edge.animated .vue-flow__edge-path { stroke: var(--accent); }
.vue-flow__handle { background: var(--surface-hover); border: 1px solid var(--border); width: 8px; height: 8px; }
.vue-flow__attribution { display: none; }
</style>
