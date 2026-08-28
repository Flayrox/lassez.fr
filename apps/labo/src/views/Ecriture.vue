<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">Écriture</h1>
      <p class="text-xs text-text-3 mt-0.5">Les consignes qu'on donne aux IA — et les formats de chaque type d'info</p>
      <p class="text-[11px] text-accent mt-1">💾 Enregistrement automatique : tout ce que tu modifies est gardé au fil de la frappe.</p>
    </div>

    <!-- Comment ça marche — en français simple, pas de jargon interne -->
    <LCard :padding="false">
      <div class="px-4 py-3.5">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-text-3 mb-2">Comment ça marche</p>
        <div class="grid md:grid-cols-3 gap-3 text-[11px] text-text-2">
          <div class="border border-border/60 rounded p-3 bg-bg/40">
            <p class="font-medium text-text-1 mb-1">1 · Le tri 🤖</p>
            <p>Le robot lit les articles ramenés, les note de 0 à 100 et ne garde que ceux qui valent la peine. Tu règles sa note minimale et son filtre ci-dessous.</p>
          </div>
          <div class="border border-border/60 rounded p-3 bg-bg/40">
            <p class="font-medium text-text-1 mb-1">2 · La rédaction ✍️</p>
            <p>L'IA écrit le post : elle lit les articles, vérifie les faits sur internet, puis applique ta ligne éditoriale (les blocs ci-dessous) et le format choisi.</p>
          </div>
          <div class="border border-border/60 rounded p-3 bg-bg/40">
            <p class="font-medium text-text-1 mb-1">3 · La vérification ⚖️</p>
            <p>Un second contrôle relit le brouillon : ton, précision des faits, clarté. Il valide, corrige le texte, ou le refuse.</p>
          </div>
        </div>
      </div>
    </LCard>

    <LCard :padding="false">
      <LTabs v-model="tab" :tabs="[{ key: 'consignes', label: 'Consignes' }, { key: 'formats', label: 'Formats' }]" />
      <div class="p-4">
        <template v-if="tab === 'consignes'">
          <div class="space-y-6">
            <!-- ── Modèles & notation ── -->
            <section-head label="Modèles & notation" />

            <LCard :padding="false">
              <div class="grid md:grid-cols-4 gap-px bg-border">
                <div class="bg-surface p-4">
                  <p class="text-xs font-medium text-text-1">Modèle pour trier</p>
                  <p class="text-[11px] text-text-3 mt-0.5 mb-2">Le plus rapide — note de 0 à 100</p>
                  <select v-model="store.ecriture.modeleRapide" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
                    <option v-for="m in store.modelRegistry" :key="m.label" :value="m.label">{{ m.label }}</option>
                  </select>
                </div>
                <div class="bg-surface p-4">
                  <p class="text-xs font-medium text-text-1">Modèle pour écrire</p>
                  <p class="text-[11px] text-text-3 mt-0.5 mb-2">Le plus fort pour rédiger l'article</p>
                  <select v-model="store.ecriture.modeleRedaction" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
                    <option v-for="m in store.modelRegistry" :key="m.label" :value="m.label">{{ m.label }}</option>
                  </select>
                </div>
                <div class="bg-surface p-4">
                  <p class="text-xs font-medium text-text-1">Modèle pour vérifier</p>
                  <p class="text-[11px] text-text-3 mt-0.5 mb-2">Contrôle les faits avant publication</p>
                  <select v-model="store.ecriture.modeleVerification" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
                    <option v-for="m in store.modelRegistry" :key="m.label" :value="m.label">{{ m.label }}</option>
                  </select>
                </div>
                <div class="bg-surface p-4">
                  <p class="text-xs font-medium text-text-1">Note minimale</p>
                  <p class="text-[11px] text-text-3 mt-0.5 mb-2">En dessous, le sujet est rejeté</p>
                  <input type="range" min="20" max="80" v-model.number="store.ecriture.scoreMini" class="w-full accent-accent" />
                  <p class="text-[10px] text-text-3 mt-1">{{ store.ecriture.scoreMini }}/100</p>
                </div>
              </div>
            </LCard>

            <!-- ── Par format ── -->
            <section-head label="Par format" />

            <div class="grid lg:grid-cols-2 gap-4">
              <LCard title="Modèle par format" description="Chaque rubrique a son IA — le défaut = modèle de rédaction">
                <div class="space-y-2">
                  <div v-for="f in store.formats.filter(x => x.actif)" :key="f.id" class="flex items-center gap-2 border border-border/50 rounded px-3 py-1.5">
                    <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: f.couleur }"></span>
                    <span class="text-xs text-text-1 flex-1 truncate">{{ f.nom }}</span>
                    <select :value="modelOf(f.id)" @change="setModel(f.id, ($event.target as HTMLSelectElement).value)" class="h-7 bg-bg border border-border rounded px-2 text-[11px] focus:outline-none focus:border-accent/60">
                      <option v-for="m in store.modelRegistry" :key="m.label" :value="m.label">{{ m.label }}</option>
                    </select>
                  </div>
                </div>
              </LCard>

              <LCard title="Recherche web" description="L'IA cherche sur internet à chaque article : vérifier les faits, dénicher le passif des personnalités, étoffer le contexte. Activé = articles plus fiables, mais un peu plus lent.">
                <div class="flex items-center justify-between gap-2 border border-border/50 rounded px-3 py-2">
                  <span class="text-xs text-text-1">Vérifier les sujets sur le web</span>
                  <LToggle :model-value="store.ecriture.webSearchEnabled" @update:model-value="(v: boolean) => { store.ecriture.webSearchEnabled = v; store.markDirty() }" />
                </div>
              </LCard>
            </div>

            <!-- ── Ligne éditoriale ── -->
            <section-head label="Le style d'écriture (ligne éditoriale)" />

            <LCard :padding="false">
              <div v-for="block in blocks" :key="block.key" class="border-b border-border last:border-b-0">
                <button class="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/60 transition-colors text-left" @click="expanded = expanded === block.key ? null : block.key">
                  <span class="w-7 h-7 rounded bg-surface-hover flex items-center justify-center text-sm shrink-0">{{ block.icon }}</span>
                  <span class="flex-1 min-w-0">
                    <span class="text-xs font-medium text-text-1 block">{{ block.label }}</span>
                    <span class="text-[11px] text-text-3 line-clamp-2 block mt-0.5">{{ previewOf(block) }}</span>
                  </span>
                  <LBadge v-if="block.get() !== block.resetTo" variant="accent">Personnalisé</LBadge>
                  <span class="text-text-3 shrink-0">{{ expanded === block.key ? '−' : '+' }}</span>
                </button>
                <div v-if="expanded === block.key" class="border-t border-border px-4 py-4 bg-bg/40">
                  <p class="text-[11px] text-text-3 mb-2">{{ block.help }}</p>
                  <LTextarea :model-value="block.get()" @update:model-value="block.set" :rows="7" />
                  <div class="flex justify-between items-center mt-2">
                    <button v-if="block.resetTo" @click="block.set(block.resetTo)" class="text-[11px] text-text-3 hover:text-danger transition-colors">↺ Remettre par défaut</button>
                    <span class="text-[10px] font-mono text-text-3 ml-auto">{{ block.get().length }} caractères</span>
                  </div>
                </div>
              </div>
            </LCard>

            <!-- ── Modèles disponibles ── -->
            <section-head label="Modèles IA disponibles" />

            <LCard>
              <div class="space-y-1.5">
                <div v-for="(m, i) in store.modelRegistry" :key="m.label" class="flex items-center gap-2 border border-border/50 rounded px-3 py-1.5" :class="{ 'border-accent/60': editingIndex === i }">
                  <template v-if="editingIndex === i">
                    <input v-model="editLabel" placeholder="Nom affiché…" class="flex-1 min-w-0 h-7 bg-bg border border-accent/50 rounded px-2 text-xs focus:outline-none focus:border-accent" />
                    <input v-model="editValue" placeholder="ID API…" class="flex-1 min-w-0 h-7 bg-bg border border-accent/50 rounded px-2 text-xs font-mono focus:outline-none focus:border-accent" />
                    <button @click="confirmEdit(i)" class="text-accent hover:text-accent-hover transition-colors px-1" title="Valider">✓</button>
                    <button @click="cancelEdit" class="text-text-3 hover:text-text-1 transition-colors px-1" title="Annuler">✕</button>
                  </template>
                  <template v-else>
                    <span class="text-xs text-text-1 flex-1 truncate" :title="m.label">{{ m.label }}</span>
                    <code class="text-[10px] font-mono text-text-3 truncate max-w-[180px]">{{ m.value }}</code>
                    <button @click="startEdit(i)" class="text-text-3 hover:text-text-1 transition-colors px-1" title="Modifier (nom + ID API)">✎</button>
                    <button @click="removeRegistry(i)" class="text-text-3 hover:text-danger transition-colors px-1" title="Retirer">✕</button>
                  </template>
                </div>
                <p v-if="editError" class="text-[11px] text-danger">{{ editError }}</p>
                <div class="flex items-center gap-2 pt-2">
                  <input v-model="newRegLabel" placeholder="Nom affiché…" class="flex-1 h-8 bg-bg border border-border rounded px-2.5 text-xs focus:outline-none focus:border-accent/60" />
                  <input v-model="newRegValue" placeholder="ID API…" class="flex-1 h-8 bg-bg border border-border rounded px-2.5 text-xs font-mono focus:outline-none focus:border-accent/60" />
                  <LButton :disabled="!newRegLabel.trim() || !newRegValue.trim()" @click="addRegistry">+ Ajouter</LButton>
                </div>
                <p class="text-[10px] text-text-3 pt-1">Les sélections (trier, écrire, vérifier, par format…) suivent le <b>nom</b> du modèle : tu peux changer son ID API sans casser ce qui est déjà choisi.</p>
              </div>
            </LCard>
          </div>
        </template>
        <Formats v-else />
      </div>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { ref, h } from 'vue'
import { useConfigStore } from '../stores/config'
import { FACTORY_PROMPTS } from '../stores/factory'
import LCard from '../components/ui/LCard.vue'
import LBadge from '../components/ui/LBadge.vue'
import LTextarea from '../components/ui/LTextarea.vue'
import LButton from '../components/ui/LButton.vue'
import LTabs from '../components/ui/LTabs.vue'
import LToggle from '../components/ui/LToggle.vue'
import Formats from './Formats.vue'

// Petit titre de section (comme les groupes de navigation) + filet.
const SectionHead = {
  props: { label: { type: String, required: true } },
  setup: (props: { label: string }) => () =>
    h('div', { class: 'flex items-center gap-3 pt-1' }, [
      h('h2', { class: 'text-[11px] font-semibold uppercase tracking-wider text-text-3' }, props.label),
      h('div', { class: 'flex-1 h-px bg-border' }),
    ]),
}
const store = useConfigStore()
const expanded = ref<string | null>(null)
const tab = ref('consignes')

// Modèle par format : un select par rubrique active, défaut = modèle de rédaction.
function modelOf(formatId: string) {
  return store.ecriture.modeleParFormat[formatId] ?? store.ecriture.modeleRedaction
}
function setModel(formatId: string, v: string) {
  store.ecriture.modeleParFormat[formatId] = v
  store.markDirty()
}

interface Block {
  key: string
  icon: string
  label: string
  help: string
  resetTo: string
  get: () => string
  set: (v: string) => void
}
const setKey = (key: keyof typeof store.ecriture) => (v: string) => { (store.ecriture as any)[key] = v; store.markDirty() }
const getKey = (key: keyof typeof store.ecriture) => () => String((store.ecriture as any)[key] ?? '')

// Ligne éditoriale — les textes par défaut sont ceux qui tournaient sur le VPS
// (ai_prompt_* vides → défauts du code, portés dans stores/factory.ts).
const blocks: Block[] = [
  { key: 'identite', icon: '◆', label: "Le ton du média", help: "La personnalité du rédacteur IA : « Le Mécanicien » = direct, scandalisé, implacable. Il démonte le système sans langue de bois ni jargon militant. C'est le tempérament de tous les articles.", resetTo: FACTORY_PROMPTS.identite, get: getKey('identite'), set: setKey('identite') },
  { key: 'mission', icon: '➤', label: "L'enquête avant d'écrire", help: "Ce que l'IA fait avant de rédiger : lire les articles fournis, vérifier les faits sur internet, chercher le passé des personnalités citées (leurs « casseroles ») pour étayer son propos.", resetTo: FACTORY_PROMPTS.mission, get: getKey('mission'), set: setKey('mission') },
  { key: 'vocabulaire', icon: 'Aa', label: "Les mots à utiliser ou éviter", help: "Les mots interdits (trop militants), les mots conseillés (plus directs, ex. « le gouvernement », « les milliardaires »), et la traduction du langage officiel : « maintien de l'ordre » = répression policière.", resetTo: FACTORY_PROMPTS.vocabulaire, get: getKey('vocabulaire'), set: setKey('vocabulaire') },
  { key: 'consignesImages', icon: '▣', label: "Comment choisir les images", help: "La méthode des 3 tirs : une recherche d'image très précise (tir 1), deux plus larges sur le lieu ou le contexte (tir 2), ou trois symboles de secours (tir 3) quand aucune photo précise n'existe.", resetTo: FACTORY_PROMPTS.consignesImages, get: getKey('consignesImages'), set: setKey('consignesImages') },
  { key: 'consigneTri', icon: '⚖', label: "Ce que le robot garde au tri", help: "Le filtre du tri automatique : les sujets systémiques (inégalités, luttes sociales, corruption, mensonges médiatiques…), et la méfiance automatique quand une source de droite ou d'extrême droite attaque la gauche — l'IA doit alors redoubler de prudence.", resetTo: FACTORY_PROMPTS.consigneTri, get: getKey('consigneTri'), set: setKey('consigneTri') },
  { key: 'criteresRejet', icon: '✕', label: "Ce que le robot jette", help: "Les sujets écartés d'office au tri : faits divers isolés, sport, divertissement, polémiques de réseaux sociaux sans enjeu de pouvoir.", resetTo: FACTORY_PROMPTS.criteresRejet, get: getKey('criteresRejet'), set: setKey('criteresRejet') },
  { key: 'consigneGlobale', icon: '✦', label: 'Consigne supplémentaire (temporaire)', help: "Ex : « cette semaine, couvre surtout les manifestations » — ajoutée à chaque article, en plus des blocs ci-dessus.", resetTo: '', get: getKey('consigneGlobale'), set: setKey('consigneGlobale') },
]

const previewOf = (b: Block) => {
  const v = b.get().trim()
  return v || 'Vide — le texte par défaut du code sera utilisé'
}

const newRegLabel = ref('')
const newRegValue = ref('')
const editingIndex = ref(-1)
const editLabel = ref('')
const editValue = ref('')
const editError = ref('')
function addRegistry() {
  const label = newRegLabel.value.trim(); const value = newRegValue.value.trim()
  if (!label || !value) return
  if (store.modelRegistry.some(m => m.label === label)) { editError.value = 'Ce nom de modèle existe déjà.'; return }
  if (store.modelRegistry.some(m => m.value === value)) { editError.value = 'Cet ID API existe déjà.'; return }
  store.modelRegistry.push({ label, value }); store.markDirty()
  newRegLabel.value = ''; newRegValue.value = ''; editError.value = ''
}
function removeRegistry(i: number) { store.modelRegistry.splice(i, 1); store.markDirty() }
function startEdit(i: number) {
  editingIndex.value = i
  editLabel.value = store.modelRegistry[i].label
  editValue.value = store.modelRegistry[i].value
  editError.value = ''
}
function cancelEdit() { editingIndex.value = -1; editError.value = '' }
function confirmEdit(i: number) {
  const label = editLabel.value.trim(); const value = editValue.value.trim()
  if (!label || !value) { editError.value = 'Nom et ID API requis.'; return }
  if (store.modelRegistry.some((m, j) => j !== i && m.label === label)) { editError.value = 'Ce nom de modèle existe déjà.'; return }
  if (store.modelRegistry.some((m, j) => j !== i && m.value === value)) { editError.value = 'Cet ID API existe déjà.'; return }
  store.modelRegistry[i].label = label
  store.modelRegistry[i].value = value
  store.markDirty()
  editingIndex.value = -1
  editError.value = ''
}
</script>
