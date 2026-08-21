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
        <LButton variant="secondary" @click="resetLayout">↺ Remettre en place</LButton>
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
              class="border border-border rounded px-2.5 py-2 text-left hover:border-accent/60 hover:bg-surface-hover transition-all disabled:opacity-30"
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
          <div v-for="s in editableSettings" :key="s.key" class="space-y-1">
            <LInput :label="s.label" :help="s.help" :model-value="s.value" @update:model-value="(v: string) => updateSetting(s, v)" />
          </div>
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

const palette = [
  { type: 'ingestion', label: 'Collecte', desc: 'Récupère les articles', icon: '◉' },
  { type: 'dedup', label: 'Anti-doublons', desc: 'Enlève les déjà vus', icon: '⬢' },
  { type: 'research', label: 'Tri', desc: 'Note l’intérêt', icon: '✦' },
  { type: 'editor', label: 'Rédaction', desc: 'Écrit le brouillon', icon: '✎' },
  { type: 'validator', label: 'Vérification', desc: 'Vérifie les faits', icon: '✓' },
  { type: 'media', label: 'Image', desc: 'Ajoute l’illustration', icon: '◎' },
]

const elements = ref<any[]>([])
function toElements() {
  const nodes = store.atelier.map((n, i) => ({
    id: n.type,
    type: 'custom',
    position: { x: 40 + (i % 2) * 240, y: 40 + Math.floor(i / 2) * 120 },
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
  store.markDirty(); selectedId.value = null; toElements(); markPending()
}
function onNodesChange() { store.markDirty(); markPending() }

const editableSettings = computed(() => {
  if (!selected.value) return []
  const t = selected.value.data.type
  if (t === 'ingestion')
    return [
      { key: 'lookback', label: 'Heures en arrière', help: 'On ne prend que les articles récents', value: String(store.sources.lookbackHours), apply: (v: string) => (store.sources.lookbackHours = parseInt(v) || 10) },
      { key: 'concurrency', label: 'Sources chargées à la fois', help: 'Plus = plus vite mais plus de charge', value: String(store.sources.concurrency), apply: (v: string) => (store.sources.concurrency = parseInt(v) || 5) },
    ]
  if (t === 'research')
    return [
      { key: 'aiModelFlash', label: 'Modèle de tri', help: 'Le plus rapide pour noter 0-100', value: store.ecriture.modeleRapide, apply: (v: string) => (store.ecriture.modeleRapide = v) },
      { key: 'concurrency', label: 'Traiter combien à la fois', help: 'En parallèle', value: String(store.ecriture.tachesEnMemeTempsRapide), apply: (v: string) => (store.ecriture.tachesEnMemeTempsRapide = parseInt(v) || 5) },
    ]
  if (t === 'editor')
    return [
      { key: 'aiModelPro', label: 'Modèle de rédaction', help: 'Le plus fort pour écrire', value: store.ecriture.modeleRedaction, apply: (v: string) => (store.ecriture.modeleRedaction = v) },
    ]
  if (t === 'validator')
    return [
      { key: 'scoreMini', label: 'Note minimale /100', help: 'En dessous → rejeté', value: String(store.ecriture.scoreMini), apply: (v: string) => (store.ecriture.scoreMini = parseInt(v) || 50) },
    ]
  return []
})
function updateSetting(s: any, v: string) {
  s.apply(v)
  store.markDirty()
  markPending()
}

let tmr: ReturnType<typeof setTimeout> | null = null
function markPending() {
  sync.value = 'pending'
  syncDetail.value = 'Modification en cours…'
  if (tmr) clearTimeout(tmr)
  tmr = setTimeout(() => {
    store.save()
    sync.value = 'saved'
    syncDetail.value = 'Gardé — le robot le lira au prochain tour'
    setTimeout(() => { if (sync.value === 'saved') sync.value = 'idle' }, 2000)
  }, 400)
}
function resetLayout() { toElements(); markPending() }
const syncLabel = computed(() => (sync.value === 'pending' ? '● En attente' : sync.value === 'saved' ? '✓ Gardé' : 'Prêt'))
</script>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';

/* Vue Flow sombre */
.vue-flow__pane { background: var(--bg); cursor: grab; }
.vue-flow__edge-path { stroke: var(--border); }
.vue-flow__edge.animated .vue-flow__edge-path { stroke: var(--accent); }
.vue-flow__handle { background: var(--surface-hover); border: 1px solid var(--border); width: 8px; height: 8px; }
.vue-flow__attribution { display: none; }
</style>
