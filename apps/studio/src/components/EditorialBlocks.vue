<!-- EditorialBlocks — les blocs de la ligne éditoriale, rendus DANS l'onglet de
     l'étape de la pipeline qui les consomme (Tri / Rédaction / Image / Global).
     Chaque bloc = un prompt éditable avec sa clé config.yaml.
     Prop `node` : 'research' | 'editor' | 'media' | 'global' — filtre les blocs
     de l'étape. Tout est sauvegardé automatiquement (store config).
     ZÉRO FRICTION : chaque bloc est une ligne TOUJOURS visible (label + aperçu)
     — cliquer ouvre l'édition dans un Dialog (pas d'accordéon qui déplie). -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { PencilIcon } from '@lucide/vue'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Textarea } from './ui/textarea'
import { useConfigStore } from '../stores/config'
import { FACTORY_PROMPTS } from '../stores/factory'

const props = defineProps<{ node: 'research' | 'editor' | 'media' | 'global' }>()

const store = useConfigStore()

interface Block {
  key: string
  label: string
  help: string
  resetTo: string
  get: () => string
  set: (v: string) => void
}

const setKey = (key: keyof typeof store.ecriture) => (v: string) => { (store.ecriture as any)[key] = v; store.markDirty() }
const getKey = (key: keyof typeof store.ecriture) => () => String((store.ecriture as any)[key] ?? '')

// La définition canonique : chaque bloc connaît l'étape qui le consomme + sa clé.
const ALL: (Block & { node: string; cfgKey: string })[] = [
  // Étape Tri
  { node: 'research', cfgKey: 'research.systemPrompt', key: 'consigneTri', label: "Ce que le robot garde au tri", help: "Le filtre du tri automatique : la ligne éditoriale du média + la méfiance automatique quand une source de droite attaque la gauche.", resetTo: FACTORY_PROMPTS.consigneTri, get: getKey('consigneTri'), set: setKey('consigneTri') },
  { node: 'research', cfgKey: 'research.rejectCriteria', key: 'criteresRejet', label: "Ce que le robot jette", help: "Les sujets écartés d'office au tri : international anecdotique, faits divers isolés, lifestyle, polémiques stériles, communication gouvernementale.", resetTo: FACTORY_PROMPTS.criteresRejet, get: getKey('criteresRejet'), set: setKey('criteresRejet') },
  // Étape Rédaction
  { node: 'editor', cfgKey: 'editorial.baseIdentity', key: 'identite', label: "Le ton du média", help: "La personnalité du rédacteur IA : direct, scandalisé, implacable. Deux poids deux mesures, paroles exactes de la droite, sous-entendus dénoncés, aligné avec la gauche sociale.", resetTo: FACTORY_PROMPTS.identite, get: getKey('identite'), set: setKey('identite') },
  { node: 'editor', cfgKey: 'editorial.researchMission', key: 'mission', label: "L'enquête avant d'écrire", help: "Ce que l'IA fait avant de rédiger : lire les articles fournis, vérifier les faits sur internet, chercher la contradiction « deux poids deux mesures », retrouver les paroles exactes.", resetTo: FACTORY_PROMPTS.mission, get: getKey('mission'), set: setKey('mission') },
  { node: 'editor', cfgKey: 'editorial.vocabularyRules', key: 'vocabulaire', label: "Les mots à utiliser ou éviter", help: "Les mots interdits (trop militants), les mots conseillés, et la traduction du langage officiel : « maintien de l'ordre » = répression policière.", resetTo: FACTORY_PROMPTS.vocabulaire, get: getKey('vocabulaire'), set: setKey('vocabulaire') },
  // Étape Image
  { node: 'media', cfgKey: 'editorial.imageRules', key: 'consignesImages', label: "Comment choisir les images", help: "La méthode des 3 tirs : une recherche précise (tir 1), deux plus larges (tir 2), ou trois symboles de secours (tir 3).", resetTo: FACTORY_PROMPTS.consignesImages, get: getKey('consignesImages'), set: setKey('consignesImages') },
  // Toutes les étapes
  { node: 'global', cfgKey: 'research/editorial.customModifier', key: 'consigneGlobale', label: 'Consigne supplémentaire (temporaire)', help: "Ex : « cette semaine, couvre surtout les manifestations » — ajoutée à chaque article.", resetTo: '', get: getKey('consigneGlobale'), set: setKey('consigneGlobale') },
]

const NODE_META: Record<string, { label: string; icon: string }> = {
  research: { label: 'Tri — le filtre automatique', icon: '✦' },
  editor: { label: 'Rédaction — le rédacteur IA', icon: '✎' },
  media: { label: 'Image — le choix des visuels', icon: '◎' },
  global: { label: 'Consigne temporaire — toutes les étapes IA', icon: '✦' },
}

const meta = NODE_META[props.node]
const list = computed(() => ALL.filter(b => b.node === props.node))
const customCount = computed(() => list.value.filter(b => b.get() !== b.resetTo).length)
function resetGroup() {
  for (const b of list.value) b.set(b.resetTo)
}
const previewOf = (b: Block) => b.get().trim() || 'Vide — le texte par défaut du code sera utilisé'

// Le bloc en cours d'édition (Dialog) — null = fermé.
const editBlock = ref<Block | null>(null)
</script>

<template>
  <Card class="gap-0 overflow-hidden py-0">
    <div class="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <span class="flex size-5 shrink-0 items-center justify-center rounded text-[11px]">{{ meta.icon }}</span>
      <p class="text-xs font-semibold">{{ meta.label }}</p>
      <code class="text-muted-foreground truncate font-mono text-[10px]">{{ list.map(b => b.cfgKey).join(' · ') }}</code>
      <div class="ml-auto flex shrink-0 items-center gap-2">
        <span class="text-muted-foreground text-[10px]">{{ customCount }}/{{ list.length }} personnalisé{{ customCount > 1 ? 's' : '' }}</span>
        <Button variant="ghost" size="sm" class="text-destructive h-6 text-[10px] hover:text-destructive" :disabled="!customCount" @click="resetGroup">↺ Défauts</Button>
      </div>
    </div>

    <!-- Chaque bloc = une ligne toujours visible (label + aperçu) ; clic → Dialog -->
    <div class="flex flex-col p-2">
      <button
        v-for="(b, i) in list"
        :key="b.key"
        type="button"
        class="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50"
        @click="editBlock = b"
      >
        <span class="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold">{{ i + 1 }}</span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2">
            <span class="text-[13px] font-medium">{{ b.label }}</span>
            <Badge v-if="b.get() !== b.resetTo" variant="secondary" class="shrink-0 text-[9px]">Personnalisé</Badge>
          </span>
          <span class="text-muted-foreground mt-0.5 line-clamp-2 block text-[11px]">{{ previewOf(b) }}</span>
        </span>
        <PencilIcon class="text-muted-foreground size-3.5 shrink-0" />
      </button>
    </div>

    <!-- Dialog d'édition du prompt : autosave, on ferme quand on a fini -->
    <Dialog :open="!!editBlock" @update:open="(v: boolean) => { if (!v) editBlock = null }">
      <DialogContent class="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{{ editBlock?.label }}</DialogTitle>
          <DialogDescription>{{ editBlock?.help }}</DialogDescription>
        </DialogHeader>
        <div v-if="editBlock" class="space-y-2">
          <!-- Grande zone d'édition : la textarea prend la place et scrolle en interne -->
          <Textarea :model-value="editBlock.get()" class="h-[55vh] text-xs" @update:model-value="editBlock.set" />
          <div class="flex items-center justify-between">
            <Button v-if="editBlock.resetTo" variant="ghost" size="sm" class="text-destructive h-6 text-[11px] hover:text-destructive" @click="editBlock.set(editBlock.resetTo)">↺ Remettre par défaut</Button>
            <span class="text-muted-foreground ml-auto font-mono text-[10px]">{{ editBlock.get().length }} caractères</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editBlock = null">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>
</template>
