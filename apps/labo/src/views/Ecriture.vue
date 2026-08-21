<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">Écriture</h1>
      <p class="text-xs text-text-3 mt-0.5">Les consignes qu'on donne aux IA pour trier et rédiger</p>
    </div>

    <div class="grid md:grid-cols-3 gap-4">
      <LCard title="Modèle pour trier" description="Le plus rapide — note de 0 à 100">
        <select v-model="store.ecriture.modeleRapide" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
          <option v-for="m in store.modelRegistry" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </LCard>
      <LCard title="Modèle pour écrire" description="Le plus fort pour rédiger l'article">
        <select v-model="store.ecriture.modeleRedaction" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
          <option v-for="m in store.modelRegistry" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </LCard>
      <LCard title="Modèle pour vérifier" description="Contrôle les faits avant publication">
        <select v-model="store.ecriture.modeleVerification" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
          <option v-for="m in store.modelRegistry" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </LCard>
    </div>

    <LCard title="Note minimale pour garder un sujet" :description="`${store.ecriture.scoreMini}/100 — en dessous, le sujet est rejeté automatiquement`">
      <input type="range" min="20" max="80" v-model.number="store.ecriture.scoreMini" class="w-full accent-accent" />
    </LCard>

    <!-- Modèle par type d'article (ai_model_main/breaking/standard/decrypt) -->
    <LCard title="Modèle par type d'article" description="Chaque rubrique peut avoir son IA — une Alerte a besoin du plus fort, un standard du plus rapide">
      <div class="grid md:grid-cols-3 gap-4">
        <div>
          <p class="text-xs font-medium mb-1">🔴 Alertes</p>
          <p class="text-[10px] text-text-3 mb-1.5">Breaking news — le plus fort pour décider vite</p>
          <select v-model="store.ecriture.modeleAlerte" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
            <option v-for="m in store.modelRegistry" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div>
          <p class="text-xs font-medium mb-1">📌 Standard</p>
          <p class="text-[10px] text-text-3 mb-1.5">Le fait du jour — équilibre vitesse/qualité</p>
          <select v-model="store.ecriture.modeleStandard" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
            <option v-for="m in store.modelRegistry" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div>
          <p class="text-xs font-medium mb-1">🔎 Décryptage</p>
          <p class="text-[10px] text-text-3 mb-1.5">Analyse de fond — le plus nuancé</p>
          <select v-model="store.ecriture.modeleDecryptage" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
            <option v-for="m in store.modelRegistry" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
      </div>
    </LCard>

    <!-- Recherche web par type (google_search_*_enabled) -->
    <LCard title="Recherche web par type" description="Gemini peut chercher sur le web pour vérifier les sujets — activable indépendamment par rubrique">
      <div class="space-y-2">
        <div v-for="row in webRows" :key="row.key" class="flex items-center justify-between gap-2 border border-border/50 rounded px-3 py-2">
          <span class="text-xs text-text-1">{{ row.label }}</span>
          <LToggle :model-value="row.get()" @update:model-value="row.set" />
        </div>
      </div>
    </LCard>

    <!-- Le grand prompt éditorial (ai_prompt) -->
    <LCard title="Ligne éditoriale complète" description="Le texte d'origine qui définit qui est L'Assez, ce qu'on ignore, les tactiques, les tags obligatoires — laisse vide pour utiliser le texte par défaut du code">
      <LTextarea v-model="promptEditorialProxy" :rows="10" help="C'est le prompt le plus puissant : il est ajouté à chaque rédaction. Vide = comportement par défaut du daemon." />
      <p class="text-[11px] text-text-3 mt-2">{{ store.ecriture.promptEditorial.length }} caractères</p>
    </LCard>

    <!-- Registry des modèles IA -->
    <LCard title="Modèles IA disponibles" description="La liste qui alimente tous les sélecteurs de modèles — ajoute un modèle, il apparaît partout">
      <div class="space-y-1.5">
        <div v-for="(m, i) in store.modelRegistry" :key="m.value" class="flex items-center gap-2 border border-border/50 rounded px-3 py-1.5">
          <span class="text-xs text-text-1 flex-1 truncate">{{ m.label }}</span>
          <code class="text-[10px] font-mono text-text-3">{{ m.value }}</code>
          <button @click="removeRegistry(i)" class="text-text-3 hover:text-danger transition-colors px-1" title="Retirer">✕</button>
        </div>
        <div class="flex items-center gap-2 pt-2">
          <input v-model="newRegLabel" placeholder="Nom affiché…" class="flex-1 h-8 bg-bg border border-border rounded px-2.5 text-xs focus:outline-none focus:border-accent/60" />
          <input v-model="newRegValue" placeholder="ID API (ex: gemini-2.5-pro)…" class="flex-1 h-8 bg-bg border border-border rounded px-2.5 text-xs font-mono focus:outline-none focus:border-accent/60" />
          <LButton :disabled="!newRegLabel.trim() || !newRegValue.trim()" @click="addRegistry">+ Ajouter</LButton>
        </div>
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
import { ref, computed } from 'vue'
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LBadge from '../components/ui/LBadge.vue'
import LTextarea from '../components/ui/LTextarea.vue'
import LButton from '../components/ui/LButton.vue'

const store = useConfigStore()
const expanded = ref<string | null>(null)

const promptEditorialProxy = computed({
  get: () => store.ecriture.promptEditorial,
  set: (v: string) => { store.ecriture.promptEditorial = v; store.markDirty() },
})

const webRows = [
  { key: 'breaking', label: '🔴 Alertes', get: () => store.ecriture.webSearchBreaking, set: (v: boolean) => { store.ecriture.webSearchBreaking = v; store.markDirty() } },
  { key: 'standard', label: '📌 Standard', get: () => store.ecriture.webSearchStandard, set: (v: boolean) => { store.ecriture.webSearchStandard = v; store.markDirty() } },
  { key: 'decrypt', label: '🔎 Décryptage', get: () => store.ecriture.webSearchDecrypt, set: (v: boolean) => { store.ecriture.webSearchDecrypt = v; store.markDirty() } },
]

// Registry des modèles IA (CRUD) — alimente tous les selects
const newRegLabel = ref('')
const newRegValue = ref('')
function addRegistry() {
  const label = newRegLabel.value.trim()
  const value = newRegValue.value.trim()
  if (!label || !value) return
  if (store.modelRegistry.some(m => m.value === value)) return
  store.modelRegistry.push({ label, value })
  store.markDirty()
  newRegLabel.value = ''
  newRegValue.value = ''
}
function removeRegistry(i: number) {
  store.modelRegistry.splice(i, 1)
  store.markDirty()
}

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
