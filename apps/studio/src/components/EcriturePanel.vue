<!-- EcriturePanel — onglet « Écriture » du hub Emploi du temps, repensé par
     regroupement logique :
       · Écriture : la rédaction en un seul passage (l'IA écrit ET vérifie)
         + la mémoire éditoriale. Les blocs de la ligne éditoriale que la
         Rédaction consomme (ton, enquête, vocabulaire) + la consigne globale
         vivent ICI, dans l'étape qui les utilise.
      · Formats : chaque rubrique regroupe TOUT — nom, couleur, modèle, statut,
        description, instructions, exemples, schéma JSON et où elle part
        (QOE/Discord/X/…) — ligne toujours visible, édition en Dialog.
       · Modèles : registre des modèles IA (Dialog + ContextMenu).
     Les blocs du Tri et de l'Image vivent dans leurs propres onglets du hub
     (EmploiDuTemps : onglets ✦ Tri et ◎ Image), via EditorialBlocks.
     Tout est sauvegardé automatiquement (store config). -->
<template>
  <Tabs v-model="subTab" class="w-full">
    <TabsList class="mb-3 flex h-auto w-full flex-wrap justify-start">
      <TabsTrigger value="ecriture">✍️ Écriture</TabsTrigger>
      <TabsTrigger value="formats">🎨 Formats</TabsTrigger>
      <TabsTrigger value="modeles">🤖 Modèles</TabsTrigger>
    </TabsList>

    <!-- ══ Écriture : la rédaction (un seul passage) + mémoire, en 2 colonnes ══ -->
    <TabsContent value="ecriture" class="space-y-3">
      <div class="grid items-start gap-3 xl:grid-cols-2">
        <div class="flex flex-col gap-3">
          <!-- Rédaction : l'IA écrit ET vérifie en un seul passage -->
          <Card class="gap-0 overflow-hidden py-0">
            <div class="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <span class="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">✎</span>
              <p class="text-xs font-semibold">Rédaction — un seul passage, l'IA écrit et vérifie</p>
            </div>
            <div class="flex flex-col gap-4 p-4">
              <Field label="Modèle de rédaction" help="Le plus fort pour écrire l'article">
                <ModelSelect
                  :model-value="store.ecriture.modeleRedaction"
                  @update:model-value="(v: string) => { store.ecriture.modeleRedaction = v; store.markDirty() }"
                />
              </Field>
              <Field label="Rédiger en parallèle" help="Combien d'articles à la fois">
                <Select
                  :model-value="String(store.ecriture.tachesEnMemeTempsRedaction)"
                  @update:model-value="(v: string) => { store.ecriture.tachesEnMemeTempsRedaction = Number(v); store.markDirty() }"
                >
                  <SelectTrigger size="sm" class="h-7 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="n in [1, 2, 3, 4, 6, 8]" :key="n" :value="String(n)">{{ n }} article{{ n > 1 ? 's' : '' }} à la fois</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Persona — le nom du rédacteur" help="Remplacé automatiquement dans tous les prompts">
                <Input
                  class="h-7 text-xs"
                  :model-value="store.ecriture.personaName"
                  placeholder="Le Mécanicien"
                  @update:model-value="(v) => { store.ecriture.personaName = String(v); store.markDirty() }"
                />
              </Field>
            </div>
          </Card>

          <!-- Mémoire éditoriale : une ligne compacte -->
          <Card class="gap-0 py-0">
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
              <div class="flex items-center gap-2">
                <BrainIcon class="text-muted-foreground size-4" />
                <p class="text-sm font-medium">Mémoire éditoriale</p>
              </div>
              <Switch
                :model-value="store.ecriture.memoireActivee"
                @update:model-value="(v: boolean) => { store.ecriture.memoireActivee = v; store.markDirty() }"
              />
              <span class="text-muted-foreground text-xs">L'IA se souvient des titres publiés — contradictions, suites, redites</span>
              <div class="ml-auto flex items-center gap-2">
                <Select
                  :model-value="String(store.ecriture.memoireJours)"
                  @update:model-value="(v: string) => { store.ecriture.memoireJours = Number(v); store.markDirty() }"
                >
                  <SelectTrigger size="sm" class="h-7 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 jours</SelectItem>
                    <SelectItem value="30">30 jours</SelectItem>
                    <SelectItem value="90">90 jours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>

        <div class="flex flex-col gap-3">
          <!-- Le style d'écriture : les blocs VIVENT ICI, dans l'étape qui les utilise -->
          <EditorialBlocks node="editor" />
          <EditorialBlocks node="global" />
        </div>
      </div>
    </TabsContent>

    <!-- ══ Formats : chaque rubrique regroupe modèle + prompts + diffusion ══ -->
    <TabsContent value="formats" class="space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-muted-foreground text-xs">Chaque rubrique regroupe son modèle IA, ses instructions, ses exemples, son schéma JSON et ses plateformes de sortie.</p>
        <Button size="sm" class="h-7" @click="addFormat"><PlusIcon class="size-3.5" /> Nouveau format</Button>
      </div>

      <div v-for="f in store.formats" :key="f.id" class="space-y-0.5">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <Card class="gap-0 py-0 transition-colors" :class="f.actif ? '' : 'opacity-70'">
              <!-- En-tête toujours visible : identité + modèle + statut + actions -->
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                <input
                  type="color"
                  :value="f.couleur"
                  class="bg-transparent size-4 shrink-0 cursor-pointer rounded-full border-0 p-0"
                  title="Couleur de la rubrique"
                  @click.stop
                  @input="(e) => { f.couleur = (e.target as HTMLInputElement).value; store.markDirty() }"
                />
                <Input
                  :model-value="f.nom"
                  class="h-6 w-40 shrink-0 border-transparent bg-transparent px-1 text-sm font-medium shadow-none hover:border-input"
                  @click.stop
                  @update:model-value="(v) => { f.nom = String(v); store.markDirty() }"
                />
                <code class="bg-muted text-muted-foreground shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px]">{{ f.id }}</code>

                <!-- LE MODÈLE VIT ICI, avec le format -->
                <span class="flex min-w-0 items-center gap-1.5">
                  <span class="text-muted-foreground hidden text-[10px] font-medium tracking-wider uppercase lg:inline">Modèle</span>
                  <ModelSelect
                    class="w-44"
                    :model-value="modelOf(f.id)"
                    @update:model-value="setModel(f.id, $event)"
                  />
                </span>

                <TooltipProvider :delay-duration="200">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <span class="text-muted-foreground flex shrink-0 cursor-default items-center gap-1 font-mono text-[10px]" @click.stop>
                        <CopyIcon class="size-3" />{{ f.exemples.length }} ex.
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Exemples few-shot pour ce format</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <div class="ml-auto flex shrink-0 items-center gap-1.5">
                  <Badge :variant="f.actif ? 'default' : 'secondary'" class="text-[9px]">{{ f.actif ? 'Actif' : 'En pause' }}</Badge>
                  <Switch :model-value="f.actif" @update:model-value="(v: boolean) => { f.actif = v; store.markDirty() }" />
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon-xs" class="text-muted-foreground"><MoreHorizontalIcon /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @select="editingFormat = f"><PencilIcon class="size-3.5" /> Modifier</DropdownMenuItem>
                      <DropdownMenuItem @select="duplicateFormat(f)"><CopyIcon class="size-3.5" /> Dupliquer</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" @select="removeFormat(f.id)"><Trash2Icon class="size-3.5" /> Supprimer</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon-xs" class="text-muted-foreground" title="Modifier" @click="editingFormat = f">
                    <PencilIcon class="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          </ContextMenuTrigger>
          <ContextMenuContent class="min-w-40">
            <ContextMenuItem @select="editingFormat = f"><PencilIcon class="size-3.5" /> Modifier</ContextMenuItem>
            <ContextMenuItem @select="duplicateFormat(f)"><CopyIcon class="size-3.5" /> Dupliquer</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" @select="removeFormat(f.id)"><Trash2Icon class="size-3.5" /> Supprimer</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <!-- Dialog d'édition complet d'un format : tout d'un coup d'œil, autosave -->
      <Dialog :open="!!editingFormat" @update:open="(v: boolean) => { if (!v) editingFormat = null }">
        <DialogContent class="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Format — {{ editingFormat?.nom }}</DialogTitle>
            <DialogDescription>Modèle, instructions, exemples, schéma JSON et diffusion — sauvegardé automatiquement à chaque frappe.</DialogDescription>
          </DialogHeader>
          <!-- Grand contenu avec scroll interne : tout le format reste éditable sans sortir -->
          <div v-if="editingFormat" class="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1">
            <div class="space-y-1">
              <p class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">Description — aide le robot à reconnaître quand utiliser ce format</p>
              <Input :model-value="editingFormat.description" placeholder="Quand utiliser ce format…" class="h-7 text-xs" @update:model-value="(v) => { editingFormat.description = String(v); store.markDirty() }" />
            </div>

            <div class="space-y-1">
              <p class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">Instructions de format — envoyées à l'IA de rédaction</p>
              <Textarea :model-value="editingFormat.consigne" :rows="5" class="text-xs" placeholder="La structure exacte du post : lignes, MAJUSCULES, tacles…" @update:model-value="(v) => { editingFormat.consigne = String(v); store.markDirty() }" />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <p class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">Exemples (few-shot) — l'IA imite le style</p>
                <Button variant="outline" size="sm" class="h-6 text-[11px]" @click="addExample(editingFormat)">+ Exemple</Button>
              </div>
              <div v-for="(ex, i) in editingFormat.exemples" :key="i" class="relative">
                <span class="text-muted-foreground absolute top-2 left-2.5 text-[9px] font-bold uppercase">#{{ i + 1 }}</span>
                <Textarea :model-value="ex" :rows="2" class="pl-9 pr-8 text-xs" placeholder="Un post d'exemple complet…" @update:model-value="(v) => { editingFormat.exemples[i] = String(v); store.markDirty() }" />
                <Button variant="ghost" size="icon-xs" class="text-muted-foreground absolute top-1 right-1" title="Retirer" @click="removeExample(editingFormat, i)"><XIcon /></Button>
              </div>
              <p v-if="!editingFormat.exemples.length" class="text-muted-foreground text-[11px] italic">Aucun exemple — l'IA se reposera uniquement sur les instructions.</p>
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <p class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">Schéma JSON de sortie</p>
                <span v-if="!isValidJson(editingFormat.schema)" class="text-warning text-[10px]">JSON invalide</span>
                <span v-else class="text-accent text-[10px]">JSON valide ✓</span>
              </div>
              <Textarea :model-value="editingFormat.schema" :rows="7" class="font-mono text-[10px]" placeholder='{ "taxonomie": "…", "geo": …, "tags": […], "headline": …, "body": …, "image_search_queries": […], "metadata": {…} }' @update:model-value="(v) => { editingFormat.schema = String(v); store.markDirty() }" />
            </div>

            <!-- Diffusion : où ce format part (matrice publisher) -->
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3">
              <p class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">Publié sur</p>
              <label v-for="p in PLATFORMS" :key="p.key" class="flex cursor-pointer items-center gap-1.5 text-xs" @click.stop>
                <Switch :model-value="matrixOf(editingFormat.id, p.key)" @update:model-value="(v: boolean) => setMatrix(editingFormat.id, p.key, v)" />
                <span class="text-muted-foreground">{{ p.label }}</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <span class="text-muted-foreground mr-auto text-[11px]">Sauvegardé automatiquement</span>
            <Button @click="editingFormat = null">Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div v-if="!store.formats.length" class="border-dashed rounded-xl border py-16 text-center">
        <p class="text-sm font-medium">Aucun format</p>
        <p class="text-muted-foreground mt-1 text-xs">Crée ta première rubrique : Alerte, Décryptage, Flash…</p>
        <Button class="mt-4" @click="addFormat">+ Nouveau format</Button>
      </div>
    </TabsContent>

    <!-- ══ Modèles IA : Data Table + Dialog + ContextMenu ══ -->
    <TabsContent value="modeles" class="space-y-3">
      <Card class="gap-0 overflow-hidden py-0">
        <CardHeader class="flex-row items-center gap-3 border-b px-4 py-2.5">
          <div class="min-w-0 flex-1">
            <CardTitle class="text-sm">Modèles IA disponibles</CardTitle>
            <CardDescription class="text-xs">Les sélections suivent le <b>nom</b> : change l'ID API sans casser ce qui est déjà choisi.</CardDescription>
          </div>
          <Button size="sm" class="h-7" @click="openNewModel"><PlusIcon class="size-3.5" /> Ajouter un modèle</Button>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="px-4">Modèle</TableHead>
              <TableHead>ID API</TableHead>
              <TableHead>Utilisé par</TableHead>
              <TableHead class="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ContextMenu v-for="(m, i) in store.modelRegistry" :key="m.label">
              <ContextMenuTrigger as-child>
                <TableRow class="cursor-context-menu">
                  <TableCell class="px-4 text-xs font-medium">{{ m.label }}</TableCell>
                  <TableCell><code class="text-muted-foreground font-mono text-[10px]">{{ m.value }}</code></TableCell>
                  <TableCell>
                    <span class="flex flex-wrap gap-1">
                      <Badge v-for="role in usedBy(m.label)" :key="role" variant="outline" class="h-4 px-1.5 text-[9px]">{{ role }}</Badge>
                      <span v-if="!usedBy(m.label).length" class="text-muted-foreground text-[10px] italic">Aucun rôle</span>
                    </span>
                  </TableCell>
                  <TableCell class="pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="icon-xs" class="text-muted-foreground"><MoreHorizontalIcon /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem @select="openEditModel(i)"><PencilIcon class="size-3.5" /> Modifier</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" @select="removeModel(i)"><Trash2Icon class="size-3.5" /> Supprimer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              </ContextMenuTrigger>
              <ContextMenuContent class="min-w-40">
                <ContextMenuItem @select="openEditModel(i)"><PencilIcon class="size-3.5" /> Modifier</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" @select="removeModel(i)"><Trash2Icon class="size-3.5" /> Supprimer</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            <TableRow v-if="!store.modelRegistry.length">
              <TableCell colspan="4" class="text-muted-foreground py-10 text-center text-xs">Aucun modèle — ajoute le premier.</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </TabsContent>

    <!-- ══ Dialog : modèle IA ══ -->
    <Dialog v-model:open="modelOpen">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ modelIndex >= 0 ? 'Modifier le modèle' : 'Ajouter un modèle' }}</DialogTitle>
          <DialogDescription class="text-xs">Nom affiché (ce que tu choisis partout) + ID API (appelé par le daemon).</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-1">
            <p class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">Nom affiché</p>
            <Input v-model="modelLabel" placeholder="gpt-4o-mini…" class="h-7 text-xs" />
          </div>
          <div class="space-y-1">
            <p class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">ID API</p>
            <Input v-model="modelValue" placeholder="gemini-2.5-flash…" class="h-7 font-mono text-xs" />
          </div>
          <p v-if="modelError" class="text-destructive text-xs">{{ modelError }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="modelOpen = false">Annuler</Button>
          <Button :disabled="!modelLabel.trim() || !modelValue.trim()" @click="saveModel">Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Tabs>
</template>

<script setup lang="ts">
import { ref, computed, h, defineComponent } from 'vue'
import { BrainIcon, CopyIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon, XIcon } from '@lucide/vue'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from './ui/context-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Switch } from './ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Textarea } from './ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import EditorialBlocks from './EditorialBlocks.vue'
import ModelSelect from './ModelSelect.vue'
import { useConfigStore, type FormatItem } from '../stores/config'

const store = useConfigStore()
const subTab = ref('ecriture')

// ── Petit champ label + aide ──
const Field = defineComponent({
  props: { label: { type: String, required: true }, help: { type: String, default: '' } },
  setup: (props, { slots }) => () =>
    h('div', { class: 'min-w-0 space-y-1.5' }, [
      h('p', { class: 'text-xs font-medium' }, props.label),
      slots.default?.(),
      props.help ? h('p', { class: 'text-muted-foreground text-[11px]' }, props.help) : null,
    ]),
})

// ── Modèle par format (vit dans l'onglet Formats) ──
function modelOf(formatId: string) {
  return store.ecriture.modeleParFormat[formatId] ?? store.ecriture.modeleRedaction
}
function setModel(formatId: string, v: string) {
  store.ecriture.modeleParFormat[formatId] = v
  store.markDirty()
}

// ── Diffusion par format (matrice publisher.targetsByType) ──
const PLATFORMS = [
  { key: 'qoe', label: 'QOE' },
  { key: 'discord', label: 'Discord' },
  { key: 'x', label: 'X' },
  { key: 'bluesky', label: 'Bluesky' },
  { key: 'mastodon', label: 'Mastodon' },
] as const
function matrixOf(formatId: string, key: string): boolean {
  const m = store.matrix[formatId]
  if (!m) return key === 'qoe' || key === 'discord'
  return m[key as keyof typeof m] !== false
}
function setMatrix(formatId: string, key: string, v: boolean) {
  if (!store.matrix[formatId]) store.matrix[formatId] = { qoe: true, discord: true, x: false, bluesky: false, mastodon: false }
  ;(store.matrix[formatId] as any)[key] = v
  store.markDirty()
}

// ── Formats : lignes toujours visibles + édition complète en Dialog ──
const editingFormat = ref<FormatItem | null>(null)
function addFormat() {
  store.formats.push({ id: 'FORMAT_' + Date.now().toString().slice(-6), nom: 'Nouveau format', actif: true, couleur: '#3ecf8e', description: '', consigne: '', exemples: [], schema: '' })
  store.markDirty()
  editingFormat.value = store.formats[store.formats.length - 1]
}
function duplicateFormat(f: FormatItem) {
  store.formats.push({ ...f, id: 'FORMAT_' + Date.now().toString().slice(-6), nom: f.nom + ' (copie)', exemples: [...f.exemples] })
  store.markDirty()
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

// ── Modèles IA : Data Table + Dialog ──
const modelOpen = ref(false)
const modelIndex = ref(-1)
const modelLabel = ref('')
const modelValue = ref('')
const modelError = ref('')
function openNewModel() {
  modelIndex.value = -1
  modelLabel.value = ''
  modelValue.value = ''
  modelError.value = ''
  modelOpen.value = true
}
function openEditModel(i: number) {
  modelIndex.value = i
  modelLabel.value = store.modelRegistry[i].label
  modelValue.value = store.modelRegistry[i].value
  modelError.value = ''
  modelOpen.value = true
}
function saveModel() {
  const l = modelLabel.value.trim(); const v = modelValue.value.trim()
  if (!l || !v) return
  if (store.modelRegistry.some((m, j) => j !== modelIndex.value && (m.label === l || m.value === v))) {
    modelError.value = 'Nom ou ID API déjà utilisé.'
    return
  }
  if (modelIndex.value >= 0) {
    store.modelRegistry[modelIndex.value].label = l
    store.modelRegistry[modelIndex.value].value = v
  } else {
    store.modelRegistry.push({ label: l, value: v })
  }
  store.markDirty()
  modelOpen.value = false
}
function removeModel(i: number) {
  store.modelRegistry.splice(i, 1)
  store.markDirty()
}
// Où chaque modèle est sélectionné (badges « utilisé par »).
function usedBy(label: string): string[] {
  const roles: string[] = []
  const e = store.ecriture
  if (e.modeleRapide === label) roles.push('Tri')
  if (e.modeleRedaction === label) roles.push('Rédaction')
  if (e.modeleOrchestrateur === label) roles.push('Orchestrateur')
  if (Object.values(e.modeleParFormat).includes(label)) roles.push('Formats')
  return roles
}
</script>
