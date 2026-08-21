<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">Écriture</h1>
      <p class="text-xs text-text-3 mt-0.5">Les consignes qu'on donne aux IA pour trier et rédiger</p>
    </div>

    <div class="grid md:grid-cols-3 gap-4">
      <LCard title="Modèle pour trier" description="Le plus rapide — note de 0 à 100">
        <select v-model="store.ecriture.modeleRapide" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
          <option>gemini-3-flash-preview</option><option>gemini-2.5-flash</option>
        </select>
      </LCard>
      <LCard title="Modèle pour écrire" description="Le plus fort pour rédiger l'article">
        <select v-model="store.ecriture.modeleRedaction" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
          <option>gemini-3.1-pro-preview</option><option>gemini-2.5-pro</option>
        </select>
      </LCard>
      <LCard title="Modèle pour vérifier" description="Contrôle les faits avant publication">
        <select v-model="store.ecriture.modeleVerification" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
          <option>gemini-3-flash-preview</option><option>gemini-2.0-flash</option>
        </select>
      </LCard>
    </div>

    <LCard title="Note minimale pour garder un sujet" :description="`${store.ecriture.scoreMini}/100 — en dessous, le sujet est rejeté automatiquement`">
      <input type="range" min="20" max="80" v-model.number="store.ecriture.scoreMini" class="w-full accent-accent" />
    </LCard>

    <LCard>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium">Recherche web pour l'IA</p>
          <p class="text-[11px] text-text-3 mt-0.5">Gemini peut chercher sur le web pour vérifier les sujets (activé pour tri, décryptage et standard)</p>
        </div>
        <LToggle :model-value="store.ecriture.webSearchEnabled" @update:model-value="(v: boolean) => { store.ecriture.webSearchEnabled = v; store.markDirty() }" />
      </div>
    </LCard>

    <!-- Blocs de consignes -->
    <div v-for="block in blocks" :key="block.key" class="bg-surface border border-border rounded-card">
      <button class="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/60 transition-colors" @click="expanded = expanded === block.key ? null : block.key">
        <span class="w-7 h-7 rounded bg-surface-hover flex items-center justify-center text-sm shrink-0">{{ block.icon }}</span>
        <span class="flex-1 text-left min-w-0">
          <span class="text-xs font-medium text-text-1 block">{{ block.label }}</span>
          <span class="text-[11px] text-text-3 line-clamp-1 block">{{ block.preview || 'Vide — le texte par défaut du code sera utilisé' }}</span>
        </span>
        <LBadge v-if="block.preview" variant="accent">Personnalisé</LBadge>
        <span class="text-text-3">{{ expanded === block.key ? '−' : '+' }}</span>
      </button>
      <div v-if="expanded === block.key" class="border-t border-border p-4 space-y-2">
        <p class="text-[11px] text-text-3">{{ block.help }}</p>
        <LTextarea :model-value="block.get()" @update:model-value="block.set" :rows="6" />
        <div class="flex justify-between items-center">
          <button v-if="block.resetTo" @click="block.set(block.resetTo)" class="text-[11px] text-text-3 hover:text-danger transition-colors">↺ Remettre par défaut</button>
          <span class="text-[10px] font-mono text-text-3 ml-auto">{{ block.get().length }} caractères</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LBadge from '../components/ui/LBadge.vue'
import LTextarea from '../components/ui/LTextarea.vue'

const store = useConfigStore()
const expanded = ref<string | null>(null)

const blocks = [
  {
    key: 'consigneTri', icon: '⚖', label: 'Consigne pour trier',
    help: 'Dis à l’IA ce qui mérite d’être traité en article',
    preview: store.ecriture.consigneTri,
    get: () => store.ecriture.consigneTri,
    set: (v: string) => { store.ecriture.consigneTri = v; store.markDirty() },
    resetTo: '',
  },
  {
    key: 'criteresRejet', icon: '✕', label: 'Ce qu’on jette',
    help: 'Ex : faits divers mineurs, publicité déguisée',
    preview: store.ecriture.criteresRejet,
    get: () => store.ecriture.criteresRejet,
    set: (v: string) => { store.ecriture.criteresRejet = v; store.markDirty() },
  },
  {
    key: 'identite', icon: '◆', label: 'Qui est L’Assez',
    help: 'Le ton du média, la personnalité de l’IA',
    preview: store.ecriture.identite,
    get: () => store.ecriture.identite,
    set: (v: string) => { store.ecriture.identite = v; store.markDirty() },
  },
  {
    key: 'mission', icon: '➤', label: 'Mission d’enquête',
    help: 'Transformer l’info brute en enquête étayée',
    preview: store.ecriture.mission,
    get: () => store.ecriture.mission,
    set: (v: string) => { store.ecriture.mission = v; store.markDirty() },
  },
  {
    key: 'vocabulaire', icon: 'Aa', label: 'Mots à utiliser ou éviter',
    help: 'Précis et factuel, pas de sensationnalisme',
    preview: store.ecriture.vocabulaire,
    get: () => store.ecriture.vocabulaire,
    set: (v: string) => { store.ecriture.vocabulaire = v; store.markDirty() },
  },
  {
    key: 'consignesImages', icon: '▣', label: 'Consigne pour les images',
    help: 'Quels mots-clés pour choisir les illustrations',
    preview: store.ecriture.consignesImages,
    get: () => store.ecriture.consignesImages,
    set: (v: string) => { store.ecriture.consignesImages = v; store.markDirty() },
  },
  {
    key: 'consigneGlobale', icon: '✦', label: 'Consigne globale (pour tout le cycle)',
    help: 'Ex : « insiste sur l’écologie cette semaine » — laisse vide si rien à ajouter',
    preview: store.ecriture.consigneGlobale,
    get: () => store.ecriture.consigneGlobale,
    set: (v: string) => { store.ecriture.consigneGlobale = v; store.markDirty() },
  },
]
</script>
