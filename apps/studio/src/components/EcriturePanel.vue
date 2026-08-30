<!-- EcriturePanel — onglet « Écriture » du hub Emploi du temps : les modèles IA,
     la ligne éditoriale (blocs de prompts), les formats et le registre des modèles.
     Refait avec shadcn-vue ; tout est sauvegardé automatiquement (store config). -->
<template>
  <Tabs v-model="subTab" class="w-full">
    <TabsList class="mb-4 w-fit">
      <TabsTrigger value="consignes">Consignes</TabsTrigger>
      <TabsTrigger value="formats">Formats</TabsTrigger>
    </TabsList>

    <!-- ══ Consignes ══ -->
    <TabsContent value="consignes" class="space-y-6">
      <!-- ── Modèles & notation ── -->
      <SectionHead label="Modèles & notation" />
      <Card class="gap-0 overflow-hidden py-0">
        <div class="grid gap-px bg-border md:grid-cols-4">
          <div class="bg-card p-4">
            <p class="text-sm font-medium">Modèle pour trier</p>
            <p class="text-muted-foreground mt-0.5 mb-2 text-xs">Le plus rapide — note de 0 à 100</p>
            <Select :model-value="store.ecriture.modeleRapide" @update:model-value="(v: string) => { store.ecriture.modeleRapide = v; store.markDirty() }">
              <SelectTrigger size="sm" class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in store.modelRegistry" :key="m.label" :value="m.label">{{ m.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="bg-card p-4">
            <p class="text-sm font-medium">Modèle pour écrire</p>
            <p class="text-muted-foreground mt-0.5 mb-2 text-xs">Le plus fort pour rédiger l'article</p>
            <Select :model-value="store.ecriture.modeleRedaction" @update:model-value="(v: string) => { store.ecriture.modeleRedaction = v; store.markDirty() }">
              <SelectTrigger size="sm" class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in store.modelRegistry" :key="m.label" :value="m.label">{{ m.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="bg-card p-4">
            <p class="text-sm font-medium">Modèle pour vérifier</p>
            <p class="text-muted-foreground mt-0.5 mb-2 text-xs">Contrôle les faits avant publication</p>
            <Select :model-value="store.ecriture.modeleVerification" @update:model-value="(v: string) => { store.ecriture.modeleVerification = v; store.markDirty() }">
              <SelectTrigger size="sm" class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in store.modelRegistry" :key="m.label" :value="m.label">{{ m.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="bg-card p-4">
            <p class="text-sm font-medium">Note minimale</p>
            <p class="text-muted-foreground mt-0.5 mb-3 text-xs">En dessous, le sujet est rejeté</p>
            <Slider :model-value="[store.ecriture.scoreMini]" min="20" max="80" @update:model-value="(v: number[]) => { store.ecriture.scoreMini = v[0]; store.markDirty() }" />
            <p class="text-muted-foreground mt-1 text-[10px]">{{ store.ecriture.scoreMini }}/100</p>
          </div>
        </div>
      </Card>

      <!-- ── Par format ── -->
      <SectionHead label="Par format" />
      <div class="grid gap-4 lg:grid-cols-2">
        <Card class="gap-0 py-0">
          <CardHeader class="border-b px-4 py-3">
            <CardTitle class="text-sm">Modèle par format</CardTitle>
            <CardDescription class="text-xs">Chaque rubrique a son IA — le défaut = modèle de rédaction</CardDescription>
          </CardHeader>
          <CardContent class="space-y-2 p-4">
            <div v-for="f in store.formats.filter(x => x.actif)" :key="f.id" class="flex items-center gap-2.5 rounded-lg border px-3 py-1.5">
              <span class="size-2 shrink-0 rounded-full" :style="{ background: f.couleur }"></span>
              <span class="flex-1 truncate text-sm">{{ f.nom }}</span>
              <Select :model-value="modelOf(f.id)" @update:model-value="(v: string) => setModel(f.id, v)">
                <SelectTrigger size="sm" class="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="m in store.modelRegistry" :key="m.label" :value="m.label">{{ m.label }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card class="gap-0 py-0">
          <CardHeader class="border-b px-4 py-3">
            <CardTitle class="text-sm">Recherche web + raisonnement</CardTitle>
            <CardDescription class="text-xs">L'IA raisonne longuement (thinking) et cherche sur internet avant d'écrire — un seul passage rédige ET contrôle.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-2 p-4">
            <div class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <p class="text-sm">Vérifier les sujets sur le web</p>
              <Switch :model-value="store.ecriture.webSearchEnabled" @update:model-value="(v: boolean) => { store.ecriture.webSearchEnabled = v; store.markDirty() }" />
            </div>
            <div class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <div class="min-w-0">
                <p class="text-sm">Raisonnement (thinking)</p>
                <p class="text-muted-foreground text-xs">Élevé = rédige et vérifie mieux, mais consomme plus de tokens.</p>
              </div>
              <Select :model-value="String(store.ecriture.thinkingBudget)" @update:model-value="(v: string) => { store.ecriture.thinkingBudget = Number(v); store.markDirty() }">
                <SelectTrigger size="sm" class="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 — rapide</SelectItem>
                  <SelectItem value="2048">2048 — moyen</SelectItem>
                  <SelectItem value="8192">8192 — élevé</SelectItem>
                  <SelectItem value="16384">16384 — très élevé</SelectItem>
                  <SelectItem value="32768">32768 — maximum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <!-- ── Mémoire éditoriale ── -->
        <Card class="gap-0 py-0 lg:col-span-2">
          <CardHeader class="border-b px-4 py-3">
            <CardTitle class="text-sm">🧠 Mémoire éditoriale</CardTitle>
            <CardDescription class="text-xs">L'IA se souvient de ce que tu as publié — contradictions, suites, redites</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-2 p-4 sm:grid-cols-2">
            <div class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <div>
                <p class="text-sm">Activer la mémoire</p>
                <p class="text-muted-foreground text-xs">Injecte les titres publiés récents dans l'orchestrateur et la rédaction</p>
              </div>
              <Switch :model-value="store.ecriture.memoireActivee" @update:model-value="(v: boolean) => { store.ecriture.memoireActivee = v; store.markDirty() }" />
            </div>
            <div class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <div>
                <p class="text-sm">Fenêtre de mémoire</p>
                <p class="text-muted-foreground text-xs">Combien de jours de publications à rappeler</p>
              </div>
              <Select :model-value="String(store.ecriture.memoireJours)" @update:model-value="(v: string) => { store.ecriture.memoireJours = Number(v); store.markDirty() }">
                <SelectTrigger size="sm" class="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                  <SelectItem value="90">90 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- ── Ligne éditoriale ── -->
      <SectionHead label="Le style d'écriture (ligne éditoriale)" />
      <Card class="gap-0 overflow-hidden py-0">
        <div class="border-b px-4 py-3">
          <p class="text-sm font-medium">Nom du rédacteur IA</p>
          <p class="text-muted-foreground mt-0.5 mb-2 text-xs">Le nom de la persona qui signe les articles — remplacé automatiquement dans tous les prompts.</p>
          <Input
            class="max-w-xs"
            :model-value="store.ecriture.personaName"
            placeholder="Le Mécanicien"
            @update:model-value="(v) => { store.ecriture.personaName = String(v); store.markDirty() }"
          />
        </div>
        <Accordion type="multiple" class="w-full">
          <AccordionItem v-for="b in blocks" :key="b.key" :value="b.key" class="px-4">
            <AccordionTrigger class="gap-2 py-3">
              <span class="flex items-center gap-3">
                <span class="bg-muted flex size-7 shrink-0 items-center justify-center rounded text-sm">{{ b.icon }}</span>
                <span class="min-w-0 text-left">
                  <span class="block text-sm font-medium">{{ b.label }}</span>
                  <span class="text-muted-foreground line-clamp-2 mt-0.5 block text-xs">{{ previewOf(b) }}</span>
                </span>
              </span>
              <Badge v-if="b.get() !== b.resetTo" variant="default" class="shrink-0">Personnalisé</Badge>
            </AccordionTrigger>
            <AccordionContent>
              <div class="space-y-2">
                <p class="text-muted-foreground text-xs">{{ b.help }}</p>
                <Textarea :model-value="b.get()" :rows="7" @update:model-value="b.set" />
                <div class="flex items-center justify-between">
                  <Button v-if="b.resetTo" variant="ghost" size="sm" class="text-destructive hover:text-destructive" @click="b.set(b.resetTo)">↺ Remettre par défaut</Button>
                  <span class="text-muted-foreground ml-auto font-mono text-[10px]">{{ b.get().length }} caractères</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <!-- ── Modèles disponibles ── -->
      <SectionHead label="Modèles IA disponibles" />
      <Card class="gap-0 py-0">
        <CardContent class="space-y-1.5 p-4">
          <div
            v-for="(m, i) in store.modelRegistry"
            :key="m.label"
            class="flex items-center gap-2 rounded-lg border px-3 py-1.5"
            :class="editingIndex === i ? 'border-ring' : ''"
          >
            <template v-if="editingIndex === i">
              <Input v-model="editLabel" placeholder="Nom affiché…" class="h-7 flex-1" />
              <Input v-model="editValue" placeholder="ID API…" class="h-7 flex-1 font-mono" />
              <Button variant="ghost" size="icon-xs" title="Valider" @click="confirmEdit(i)"><CheckIcon /></Button>
              <Button variant="ghost" size="icon-xs" title="Annuler" @click="cancelEdit"><XIcon /></Button>
            </template>
            <template v-else>
              <span class="flex-1 truncate text-sm" :title="m.label">{{ m.label }}</span>
              <code class="text-muted-foreground max-w-[180px] truncate font-mono text-[10px]">{{ m.value }}</code>
              <Button variant="ghost" size="icon-xs" title="Modifier (nom + ID API)" @click="startEdit(i)"><PencilIcon /></Button>
              <Button variant="ghost" size="icon-xs" class="text-destructive hover:text-destructive" title="Retirer" @click="removeRegistry(i)"><XIcon /></Button>
            </template>
          </div>
          <p v-if="editError" class="text-destructive text-xs">{{ editError }}</p>
          <div class="flex items-center gap-2 pt-2">
            <Input v-model="newRegLabel" placeholder="Nom affiché…" class="flex-1" />
            <Input v-model="newRegValue" placeholder="ID API…" class="flex-1 font-mono" />
            <Button :disabled="!newRegLabel.trim() || !newRegValue.trim()" @click="addRegistry">+ Ajouter</Button>
          </div>
          <p class="text-muted-foreground pt-1 text-[10px]">Les sélections (trier, écrire, vérifier, par format…) suivent le <b>nom</b> du modèle : tu peux changer son ID API sans casser ce qui est déjà choisi.</p>
        </CardContent>
      </Card>
    </TabsContent>

    <!-- ══ Formats ══ -->
    <TabsContent value="formats" class="space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-muted-foreground text-xs">Chaque type d'info a ses instructions de format, ses exemples à recopier et son schéma de sortie — l'IA s'en sert à chaque rédaction.</p>
        <Button size="sm" @click="addFormat">+ Nouveau format</Button>
      </div>

      <div v-for="f in store.formats" :key="f.id" class="space-y-3">
        <Card class="gap-0 overflow-hidden py-0" :class="f.actif ? '' : 'opacity-70'">
          <div class="flex items-center gap-3 px-4 py-3" @click="expandedFormat = expandedFormat === f.id ? null : f.id">
            <span class="size-2 shrink-0 rounded-full" :style="{ background: f.couleur }"></span>
            <Input
              :model-value="f.nom"
              class="h-7 flex-1 border-transparent bg-transparent text-sm font-medium shadow-none hover:border-input"
              @click.stop
              @update:model-value="(v) => { f.nom = String(v); store.markDirty() }"
            />
            <code class="bg-muted text-muted-foreground shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px]">{{ f.id }}</code>
            <Badge :variant="f.actif ? 'default' : 'secondary'" class="shrink-0">{{ f.actif ? 'Actif' : 'En pause' }}</Badge>
            <Switch :model-value="f.actif" @click.stop @update:model-value="(v: boolean) => { f.actif = v; store.markDirty() }" />
            <Button variant="ghost" size="icon-xs" class="shrink-0 text-destructive hover:text-destructive" title="Supprimer" @click.stop="removeFormat(f.id)"><Trash2Icon /></Button>
            <span class="text-muted-foreground shrink-0 text-xs">{{ expandedFormat === f.id ? '−' : '+' }}</span>
          </div>

          <div v-if="expandedFormat === f.id" class="space-y-4 border-t p-4">
            <div class="space-y-1.5">
              <p class="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">Description — aide le robot à reconnaître quand utiliser ce format</p>
              <Input :model-value="f.description" placeholder="Quand utiliser ce format…" @update:model-value="(v) => { f.description = String(v); store.markDirty() }" />
            </div>
            <div class="space-y-1.5">
              <p class="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">Instructions de format — envoyées à l'IA de rédaction</p>
              <Textarea :model-value="f.consigne" :rows="7" placeholder="La structure exacte du post : lignes, MAJUSCULES, tacles…" @update:model-value="(v) => { f.consigne = String(v); store.markDirty() }" />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <p class="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">Exemples (few-shot) — l'IA imite le style</p>
                <Button variant="outline" size="sm" @click="addExample(f)">+ Exemple</Button>
              </div>
              <div v-for="(ex, i) in f.exemples" :key="i" class="relative">
                <span class="text-muted-foreground absolute top-2.5 left-2.5 text-[9px] font-bold uppercase">#{{ i + 1 }}</span>
                <Textarea :model-value="ex" :rows="3" class="pl-8 pr-8" placeholder="Un post d'exemple complet…" @update:model-value="(v) => { f.exemples[i] = String(v); store.markDirty() }" />
                <Button variant="ghost" size="icon-xs" class="absolute top-2 right-2 text-muted-foreground" title="Retirer" @click="removeExample(f, i)"><XIcon /></Button>
              </div>
              <p v-if="f.exemples.length === 0" class="text-muted-foreground text-xs italic">Aucun exemple — l'IA se reposera uniquement sur les instructions.</p>
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <p class="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">Schéma JSON de sortie attendu</p>
                <span v-if="!isValidJson(f.schema)" class="text-warning text-[10px]">JSON invalide</span>
                <span v-else class="text-accent text-[10px]">JSON valide ✓</span>
              </div>
              <Textarea :model-value="f.schema" :rows="8" class="font-mono" placeholder='{ "taxonomie": "…", "geo": …, "tags": […], "headline": …, "body": …, "image_search_queries": […], "metadata": {…} }' @update:model-value="(v) => { f.schema = String(v); store.markDirty() }" />
            </div>
            <div class="flex items-center justify-between">
              <label class="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                Couleur
                <input type="color" :value="f.couleur" class="bg-transparent size-6 cursor-pointer rounded border p-0" @input="(e) => { f.couleur = (e.target as HTMLInputElement).value; store.markDirty() }" />
              </label>
              <span class="text-muted-foreground font-mono text-[10px]">{{ f.consigne.length }} chars instructions · {{ f.exemples.length }} exemples</span>
            </div>
          </div>
        </Card>
      </div>

      <div v-if="store.formats.length === 0" class="border-dashed rounded-xl border py-16 text-center">
        <p class="text-sm font-medium">Aucun format</p>
        <p class="text-muted-foreground mt-1 text-xs">Crée ta première rubrique : Alerte, Décryptage, Flash…</p>
        <Button class="mt-4" @click="addFormat">+ Nouveau format</Button>
      </div>
    </TabsContent>
  </Tabs>
</template>

<script setup lang="ts">
import { ref, h } from 'vue'
import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from '@lucide/vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Textarea } from './ui/textarea'
import { useConfigStore, type FormatItem } from '../stores/config'
import { FACTORY_PROMPTS } from '../stores/factory'

const store = useConfigStore()
const subTab = ref('consignes')

// Petit titre de section + filet.
const SectionHead = {
  props: { label: { type: String, required: true } },
  setup: (props: { label: string }) => () =>
    h('div', { class: 'flex items-center gap-3 pt-1' }, [
      h('h2', { class: 'text-muted-foreground text-[11px] font-semibold tracking-wider uppercase' }, props.label),
      h('div', { class: 'bg-border h-px flex-1' }),
    ]),
}

// Modèle par format : un select par rubrique active, défaut = modèle de rédaction.
function modelOf(formatId: string) {
  return store.ecriture.modeleParFormat[formatId] ?? store.ecriture.modeleRedaction
}
function setModel(formatId: string, v: string) {
  store.ecriture.modeleParFormat[formatId] = v
  store.markDirty()
}

// ── Ligne éditoriale ──
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

const blocks: Block[] = [
  { key: 'identite', icon: '◆', label: "Le ton du média", help: "La personnalité du rédacteur IA : direct, scandalisé, implacable. Deux poids deux mesures, paroles exactes de la droite, sous-entendus dénoncés, aligné avec la gauche sociale.", resetTo: FACTORY_PROMPTS.identite, get: getKey('identite'), set: setKey('identite') },
  { key: 'mission', icon: '➤', label: "L'enquête avant d'écrire", help: "Ce que l'IA fait avant de rédiger : lire les articles fournis, vérifier les faits sur internet, chercher la contradiction « deux poids deux mesures », retrouver les paroles exactes.", resetTo: FACTORY_PROMPTS.mission, get: getKey('mission'), set: setKey('mission') },
  { key: 'vocabulaire', icon: 'Aa', label: "Les mots à utiliser ou éviter", help: "Les mots interdits (trop militants), les mots conseillés, et la traduction du langage officiel : « maintien de l'ordre » = répression policière.", resetTo: FACTORY_PROMPTS.vocabulaire, get: getKey('vocabulaire'), set: setKey('vocabulaire') },
  { key: 'consignesImages', icon: '▣', label: "Comment choisir les images", help: "La méthode des 3 tirs : une recherche précise (tir 1), deux plus larges (tir 2), ou trois symboles de secours (tir 3).", resetTo: FACTORY_PROMPTS.consignesImages, get: getKey('consignesImages'), set: setKey('consignesImages') },
  { key: 'consigneTri', icon: '⚖', label: "Ce que le robot garde au tri", help: "Le filtre du tri automatique : la ligne éditoriale du média + la méfiance automatique quand une source de droite attaque la gauche.", resetTo: FACTORY_PROMPTS.consigneTri, get: getKey('consigneTri'), set: setKey('consigneTri') },
  { key: 'criteresRejet', icon: '✕', label: "Ce que le robot jette", help: "Les sujets écartés d'office au tri : international anecdotique, faits divers isolés, lifestyle, polémiques stériles, communication gouvernementale.", resetTo: FACTORY_PROMPTS.criteresRejet, get: getKey('criteresRejet'), set: setKey('criteresRejet') },
  { key: 'consigneGlobale', icon: '✦', label: 'Consigne supplémentaire (temporaire)', help: "Ex : « cette semaine, couvre surtout les manifestations » — ajoutée à chaque article.", resetTo: '', get: getKey('consigneGlobale'), set: setKey('consigneGlobale') },
]

const previewOf = (b: Block) => {
  const v = b.get().trim()
  return v || 'Vide — le texte par défaut du code sera utilisé'
}

// ── Registre des modèles ──
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

// ── Formats ──
const expandedFormat = ref<string | null>(null)
function addFormat() {
  store.formats.push({ id: 'FORMAT_' + Date.now().toString().slice(-6), nom: 'Nouveau format', actif: true, couleur: '#3ecf8e', description: '', consigne: '', exemples: [], schema: '' })
  store.markDirty()
  expandedFormat.value = store.formats[store.formats.length - 1].id
}
function removeFormat(id: string) {
  store.formats = store.formats.filter(f => f.id !== id)
  store.markDirty()
}
function addExample(f: FormatItem) {
  f.exemples.push('')
  store.markDirty()
}
function removeExample(f: FormatItem, i: number) {
  f.exemples.splice(i, 1)
  store.markDirty()
}
function isValidJson(s: string) {
  if (!s.trim()) return true
  try { JSON.parse(s); return true } catch { return false }
}
</script>
