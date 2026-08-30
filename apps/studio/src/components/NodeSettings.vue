<!-- NodeSettings — carte de réglages d'un composant de la chaîne (onglet du hub
     « Emploi du temps »). Switch marche/pause + champs typés (slider, select,
     toggle, input) branchés directement sur le store config (autosave). -->
<template>
  <Card class="gap-0 overflow-hidden py-0">
    <CardHeader class="flex-row items-center gap-3 border-b px-4 py-3">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
          :class="node.enabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
        >{{ iconOf(node.type) }}</span>
        <div class="min-w-0">
          <CardTitle class="text-sm">{{ node.label }}</CardTitle>
          <CardDescription class="text-xs">{{ summary }}</CardDescription>
        </div>
      </div>
      <Badge :variant="node.enabled ? 'default' : 'secondary'" class="shrink-0">{{ node.enabled ? 'En marche' : 'En pause' }}</Badge>
      <Switch :model-value="node.enabled" @update:model-value="toggleEnabled" />
    </CardHeader>

    <CardContent class="grid gap-5 p-4 md:grid-cols-2">
      <template v-for="f in fields" :key="f.key">
        <!-- Ligne switch -->
        <div v-if="f.type === 'toggle-row'" class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div class="min-w-0">
            <p class="text-sm font-medium">{{ f.label }}</p>
            <p v-if="f.help" class="text-muted-foreground mt-0.5 text-xs">{{ f.help }}</p>
          </div>
          <Switch :model-value="!!f.value" @update:model-value="(v: boolean) => update(f, v)" />
        </div>

        <!-- Slider -->
        <div v-else-if="f.type === 'slider'" class="space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">{{ f.label }}</p>
            <span class="text-muted-foreground font-mono text-xs">{{ f.value }}{{ f.unit ?? '' }}</span>
          </div>
          <Slider
            :model-value="[Number(f.value)]"
            :min="f.min"
            :max="f.max"
            :step="f.step ?? 1"
            @update:model-value="(v: number[]) => update(f, v[0])"
          />
          <p v-if="f.help" class="text-muted-foreground text-xs">{{ f.help }}</p>
        </div>

        <!-- Select -->
        <div v-else-if="f.type === 'select'" class="space-y-1.5">
          <p class="text-sm font-medium">{{ f.label }}</p>
          <Select :model-value="String(f.value)" @update:model-value="(v: string) => update(f, v)">
            <SelectTrigger size="sm" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="o in f.options ?? []" :key="o" :value="o">{{ o }}</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="f.help" class="text-muted-foreground text-xs">{{ f.help }}</p>
        </div>

        <!-- Input -->
        <div v-else class="space-y-1.5">
          <p class="text-sm font-medium">{{ f.label }}</p>
          <Input
            :type="f.type"
            :model-value="String(f.value ?? '')"
            @update:model-value="(v) => update(f, v)"
          />
          <p v-if="f.help" class="text-muted-foreground text-xs">{{ f.help }}</p>
        </div>
      </template>

      <p v-if="fields.length === 0" class="text-muted-foreground text-xs md:col-span-2">Aucun réglage pour cette étape pour l'instant.</p>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { useConfigStore } from '../stores/config'

const store = useConfigStore()

const props = defineProps<{ node: { type: string; label: string; desc: string; enabled: boolean } }>()

const icons: Record<string, string> = {
  ingestion: '◉', dedup: '⬢', orchestrator: '✸', research: '✦', editor: '✎', validator: '✓', media: '◎',
}
const iconOf = (t: string) => icons[t] ?? '●'

function toggleEnabled(v: boolean) {
  const n = store.atelier.find(x => x.type === props.node.type)
  if (n) { n.enabled = v; store.markDirty() }
}

// Résumé de l'étape, change en direct avec les réglages.
const summary = computed(() => {
  const t = props.node.type
  switch (t) {
    case 'ingestion':
      return `Fenêtre ${store.sources.lookbackHours} h · ${store.sources.maxArticlesPerScan} articles/passage · ${store.sources.concurrency} en parallèle`
    case 'dedup':
      return `Ressemblance max ${store.filtres.seuilRessemblance}% · mémoire ${store.filtres.fenetreDoublonsHeures} h`
    case 'orchestrator':
      return `${store.ecriture.modeleOrchestrateur} · thinking ${store.ecriture.thinkingOrchestrateur} tokens · 1 appel/cycle`
    case 'research':
      return `${store.ecriture.modeleRapide} · thinking ${store.ecriture.thinkingRapide} tokens · ${store.ecriture.tachesEnMemeTempsRapide} en parallèle`
    case 'editor':
      return `${store.ecriture.modeleRedaction} · ${store.ecriture.tachesEnMemeTempsRedaction} en parallèle`
    case 'validator':
      return `Note min ${store.ecriture.scoreMini}/100 · ${store.partage.autoApprove ? 'mode fantôme (approuve seul)' : 'attend ta validation'}`
    case 'media':
      return `Overlay ${store.media.overlayEnabled ? 'oui' : 'non'} · ${store.media.overlayOpacity}% · cadres ${store.media.boxScale169}% / ${store.media.boxScale11}%`
    default:
      return props.node.desc
  }
})

interface Field {
  key: string
  label: string
  help?: string
  type: 'text' | 'number' | 'select' | 'toggle' | 'toggle-row' | 'slider'
  value: any
  options?: string[]
  min?: number
  max?: number
  step?: number
  unit?: string
  apply: (v: any) => void
}

const fields = computed<Field[]>(() => {
  switch (props.node.type) {
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
        { key: 'webSearch', label: 'Recherche web', help: "Gemini vérifie sur le web avant de rédiger — pour tous les types d'articles", type: 'toggle-row', value: store.ecriture.webSearchEnabled, apply: (v: boolean) => (store.ecriture.webSearchEnabled = v) },
      ]
    case 'editor':
      return [
        { key: 'aiModelPro', label: 'Modèle de rédaction', help: 'Le plus fort pour écrire', type: 'select', options: store.modelRegistry.map(m => m.label), value: store.ecriture.modeleRedaction, apply: (v: string) => (store.ecriture.modeleRedaction = v) },
        { key: 'concurrency', label: 'Rédiger combien à la fois', type: 'slider', min: 1, max: 8, value: store.ecriture.tachesEnMemeTempsRedaction, apply: (v: number) => (store.ecriture.tachesEnMemeTempsRedaction = v) },
      ]
    case 'validator':
      return [
        { key: 'scoreMini', label: 'Note minimale /100', help: 'En dessous → rejeté automatiquement', type: 'slider', min: 20, max: 80, value: store.ecriture.scoreMini, apply: (v: number) => (store.ecriture.scoreMini = v) },
        { key: 'autoApprove', label: 'Mode Fantôme : l’IA valide à ta place', help: 'Les articles passent directement à la publication, sans modération humaine — distinct de la Publication auto (Diffusion)', type: 'toggle-row', value: store.partage.autoApprove, apply: (v: boolean) => (store.partage.autoApprove = v) },
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

function update(f: Field, v: any) {
  f.apply(v)
  store.markDirty()
}
</script>
