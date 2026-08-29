<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-text-1">Atelier</h1>
        <p class="text-xs text-text-3 mt-0.5">Ta chaîne de fabrication — chaque étape se règle en un clic, mets-en une en pause sans perdre ses réglages</p>
      </div>
      <span
        class="text-[11px] font-mono px-2 py-1 rounded border shrink-0"
        :class="sync === 'saved' ? 'border-accent/40 text-accent bg-accent-muted' : sync === 'pending' ? 'border-warning/40 text-warning bg-warning/5' : 'border-border text-text-3'"
      >{{ syncLabel }}</span>
    </div>

    <!-- La chaîne d'un coup d'œil -->
    <LCard :padding="false" title="La chaîne" description="6 étapes dans l'ordre — le robot passe de gauche à droite à chaque tour">
      <div class="flex flex-wrap items-center gap-1.5 px-4 py-3">
        <template v-for="(n, i) in store.atelier" :key="n.type">
          <button
            @click="expanded = expanded === n.type ? null : n.type"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] transition-colors"
            :class="n.enabled
              ? expanded === n.type ? 'border-accent bg-accent-muted text-accent' : 'border-accent/40 text-accent hover:bg-accent-muted'
              : 'border-border text-text-3 hover:bg-surface-hover'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="n.enabled ? 'bg-accent' : 'bg-border'"></span>{{ n.label }}
          </button>
          <span v-if="i < store.atelier.length - 1" class="text-text-3 text-[11px]">→</span>
        </template>
      </div>
    </LCard>

    <!-- Étapes -->
    <div class="space-y-2">
      <div
        v-for="n in store.atelier"
        :key="n.type"
        class="bg-surface border rounded-card overflow-hidden transition-colors"
        :class="expanded === n.type ? 'border-accent/50' : 'border-border'"
      >
        <!-- En-tête de l'étape -->
        <div class="flex items-center gap-3 px-4 py-3">
          <span
            class="w-8 h-8 rounded flex items-center justify-center text-sm font-semibold shrink-0"
            :class="n.enabled ? 'bg-accent text-accent-fg' : 'bg-surface-hover text-text-3'"
          >{{ iconFor(n.type) }}</span>
          <button class="flex-1 min-w-0 text-left" @click="toggle(n.type)">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium text-text-1">{{ n.label }}</p>
              <LBadge :variant="n.enabled ? 'accent' : 'neutral'">{{ n.enabled ? 'En marche' : 'En pause' }}</LBadge>
            </div>
            <p class="text-[11px] text-text-3 mt-0.5 truncate">{{ summaryOf(n.type) }}</p>
          </button>
          <router-link :to="'/pipeline#noeud-' + explainId(n.type)" class="text-[11px] text-accent hover:underline shrink-0 whitespace-nowrap" title="Voir l'explication de cette étape">Expliquer →</router-link>
          <label class="flex items-center gap-2 text-[11px] text-text-3 shrink-0 cursor-pointer select-none" :title="n.enabled ? 'Mettre en pause' : 'Remettre en marche'">
            <LToggle :model-value="n.enabled" @update:model-value="() => toggleEnabled(n.type)" />
          </label>
          <button
            class="text-text-3 hover:text-text-1 transition-colors shrink-0 w-6 text-center"
            :title="expanded === n.type ? 'Replier les réglages' : 'Déplier les réglages'"
            @click="toggle(n.type)"
          >
            <span class="inline-block transition-transform" :class="expanded === n.type ? 'rotate-180' : ''">▾</span>
          </button>
        </div>

        <!-- Réglages (accordéon) -->
        <div v-if="expanded === n.type" class="border-t border-border/60 px-4 py-4 bg-bg/40">
          <div class="grid md:grid-cols-2 gap-x-6 gap-y-4">
            <template v-for="f in fieldsFor(n.type)" :key="f.key">
              <LToggle v-if="f.type === 'toggle'" :model-value="!!f.value" @update:model-value="(v: boolean) => updateSetting(f, v)" />
              <label v-else-if="f.type === 'toggle-row'" class="flex items-center justify-between gap-2 border border-border/50 rounded px-3 py-2">
                <span class="min-w-0">
                  <span class="text-xs font-medium block text-text-1">{{ f.label }}</span>
                  <span v-if="f.help" class="text-[10px] text-text-3 block">{{ f.help }}</span>
                </span>
                <LToggle :model-value="!!f.value" @update:model-value="(v: boolean) => updateSetting(f, v)" />
              </label>
              <div v-else-if="f.type === 'slider'" class="space-y-1.5">
                <div class="flex justify-between text-xs">
                  <span class="font-medium text-text-1">{{ f.label }}</span>
                  <span class="text-text-3 font-mono">{{ f.value }}{{ f.unit ?? '' }}</span>
                </div>
                <input type="range" :min="f.min" :max="f.max" :step="f.step ?? 1" :value="f.value" @input="updateSetting(f, parseInt(($event.target as HTMLInputElement).value))" class="w-full accent-accent" />
                <p v-if="f.help" class="text-[10px] text-text-3">{{ f.help }}</p>
              </div>
              <div v-else-if="f.type === 'select'" class="space-y-1.5">
                <p class="text-xs font-medium text-text-1">{{ f.label }}</p>
                <select :value="f.value" @change="updateSetting(f, ($event.target as HTMLSelectElement).value)" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
                  <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
                </select>
                <p v-if="f.help" class="text-[10px] text-text-3">{{ f.help }}</p>
              </div>
              <LInput v-else :label="f.label" :help="f.help" :model-value="String(f.value ?? '')" @update:model-value="(v: string) => updateSetting(f, v)" />
            </template>
            <p v-if="fieldsFor(n.type).length === 0" class="text-xs text-text-3 md:col-span-2">Aucun réglage pour cette étape pour l'instant.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- État sync -->
    <div class="bg-surface border border-border rounded-card px-3 py-2">
      <p class="text-[10px] uppercase tracking-wider text-text-3 mb-0.5">État</p>
      <p class="text-[11px] text-text-2">{{ syncDetail }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LBadge from '../components/ui/LBadge.vue'
import LInput from '../components/ui/LInput.vue'
import LToggle from '../components/ui/LToggle.vue'

const store = useConfigStore()
const expanded = ref<string | null>(null)
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

const icons: Record<string, string> = {
  ingestion: '◉', dedup: '⬢', orchestrator: '✸', research: '✦', editor: '✎', validator: '✓', media: '◎',
}
function iconFor(t: string) { return icons[t] ?? '●' }
// Nœud du pipeline → numéro de la carte « Expliquer » (/pipeline#noeud-N)
const explainByType: Record<string, number> = { ingestion: 1, dedup: 2, orchestrator: 3, research: 4, editor: 5, validator: 6, media: 7 }
function explainId(t: string) { return explainByType[t] ?? 1 }

function toggle(type: string) { expanded.value = expanded.value === type ? null : type }
function toggleEnabled(type: string) {
  const n = store.atelier.find(x => x.type === type)
  if (n) { n.enabled = !n.enabled; store.markDirty(); markPending() }
}

// Résumé de l'étape, visible sans déplier — change en direct avec les réglages.
const summaryOf = (t: string) => {
  switch (t) {
    case 'ingestion':
      return `Fenêtre ${store.sources.lookbackHours} h · ${store.sources.maxArticlesPerScan} articles/passage · ${store.sources.concurrency} en parallèle`
    case 'dedup':
      return `Ressemblance max ${store.filtres.seuilRessemblance}% · mémoire ${store.filtres.fenetreDoublonsHeures} h`
    case 'orchestrator':
      return `${store.ecriture.modeleOrchestrateur} · thinking ${store.ecriture.thinkingOrchestrateur} tokens · 1 appel/cycle · remplace le Tri`
    case 'research':
      return `${store.ecriture.modeleRapide} · thinking ${store.ecriture.thinkingRapide} tokens · ${store.ecriture.tachesEnMemeTempsRapide} en parallèle (repli)`
    case 'editor':
      return `${store.ecriture.modeleRedaction} · ${store.ecriture.tachesEnMemeTempsRedaction} en parallèle`
    case 'validator':
      return `Note min ${store.ecriture.scoreMini}/100 · ${store.partage.autoApprove ? 'mode fantôme (approuve seul)' : 'attend ta validation'}`
    case 'media':
      return `Overlay ${store.media.overlayEnabled ? 'oui' : 'non'} · ${store.media.overlayOpacity}% · cadres ${store.media.boxScale169}% / ${store.media.boxScale11}%`
    default:
      return ''
  }
}

// ── Champs riches par étape (les mêmes réglages que l'ancien inspector) ──
const fieldsFor = (type: string): Field[] => {
  switch (type) {
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
    case 'orchestrator':
      return [
        { key: 'aiModelOrchestrator', label: 'Modèle de l’orchestrateur', help: 'Chef de desk — 1 appel IA par cycle', type: 'select', options: store.modelRegistry.map(m => m.label), value: store.ecriture.modeleOrchestrateur, apply: (v: string) => (store.ecriture.modeleOrchestrateur = v) },
        { key: 'thinkingOrchestrator', label: 'Raisonnement (thinking)', help: 'Moyen par défaut : il planifie, la rédaction rédige', type: 'select', options: ['2048 — moyen', '8192 — élevé', '16384 — très élevé'], value: String(store.ecriture.thinkingOrchestrateur), apply: (v: string) => (store.ecriture.thinkingOrchestrateur = parseInt(v)) },
        { key: 'maxTopics', label: 'Sujets lus par cycle', help: 'La liste complète du jour (borne du prompt)', type: 'slider', min: 10, max: 100, value: store.ecriture.maxSujetsOrchestrateur, apply: (v: number) => (store.ecriture.maxSujetsOrchestrateur = v) },
      ]
    case 'research':
      return [
        { key: 'aiModelFlash', label: 'Modèle de tri', help: 'Repli de l’orchestrateur — note 0–100', type: 'select', options: store.modelRegistry.map(m => m.label), value: store.ecriture.modeleRapide, apply: (v: string) => (store.ecriture.modeleRapide = v) },
        { key: 'thinkingRapide', label: 'Raisonnement (thinking)', help: 'Moyen par défaut — 0 = réponse directe', type: 'select', options: ['0 — rapide', '2048 — moyen', '8192 — élevé'], value: String(store.ecriture.thinkingRapide), apply: (v: string) => (store.ecriture.thinkingRapide = parseInt(v)) },
        { key: 'concurrency', label: 'Traiter combien à la fois', help: 'En parallèle', type: 'slider', min: 1, max: 10, value: store.ecriture.tachesEnMemeTempsRapide, apply: (v: number) => (store.ecriture.tachesEnMemeTempsRapide = v) },
        { key: 'webSearch', label: 'Recherche web', help: "Gemini vérifie sur le web avant de rédiger — pour tous les types d'articles (réglable dans Écriture)", type: 'toggle-row', value: store.ecriture.webSearchEnabled, apply: (v: boolean) => (store.ecriture.webSearchEnabled = v) },
      ]
    case 'editor':
      return [
        { key: 'aiModelPro', label: 'Modèle de rédaction', help: 'Le plus fort pour écrire', type: 'select', options: store.modelRegistry.map(m => m.label), value: store.ecriture.modeleRedaction, apply: (v: string) => (store.ecriture.modeleRedaction = v) },
        { key: 'concurrency', label: 'Rédiger combien à la fois', type: 'slider', min: 1, max: 8, value: store.ecriture.tachesEnMemeTempsRedaction, apply: (v: number) => (store.ecriture.tachesEnMemeTempsRedaction = v) },
      ]
    case 'validator':
      return [
        { key: 'scoreMini', label: 'Note minimale /100', help: 'En dessous → rejeté automatiquement', type: 'slider', min: 20, max: 80, value: store.ecriture.scoreMini, apply: (v: number) => (store.ecriture.scoreMini = v) },
        { key: 'autoApprove', label: 'Mode Fantôme : l’IA valide à ta place', help: 'Les articles passent directement à la publication, sans modération humaine — distinct de la Publication auto (Partage)', type: 'toggle-row', value: store.partage.autoApprove, apply: (v: boolean) => (store.partage.autoApprove = v) },
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
}
function updateSetting(f: Field, v: any) {
  f.apply(v)
  store.markDirty()
  markPending()
}

// ── Sync debounced (même comportement qu'avant) ──
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
const syncLabel = computed(() => (sync.value === 'pending' ? '● En attente' : sync.value === 'saved' ? '✓ Gardé' : 'Prêt'))
</script>
