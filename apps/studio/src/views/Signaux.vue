<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">Signaux</h1>
        <p class="text-muted-foreground mt-0.5 text-xs">Les articles collectés par le robot — valide, programme ou rejette</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" :disabled="store.loading" @click="refresh">
          <RefreshCwIcon v-if="!store.loading" data-icon="inline-start" />
          <Spinner v-else class="size-3.5" />
          Actualiser
        </Button>
        <Button size="sm" @click="scanOpen = true"><PlayIcon data-icon="inline-start" /> Lancer un scan</Button>
      </div>
    </div>

    <!-- Erreur -->
    <div v-if="store.error" class="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-xs">
      Impossible de joindre le robot ({{ store.error }}). Lance le daemon : <code class="font-mono">PIPELINE_DB_PATH=../data/pipeline.db ./daemon</code>
    </div>

    <Card class="gap-0 overflow-hidden py-0">
      <!-- Toolbar -->
      <div class="space-y-2.5 px-3 pt-2.5">
        <Tabs v-model="tab" class="w-full">
          <TabsList class="flex h-auto w-full justify-start overflow-x-auto">
            <TabsTrigger v-for="t in tabs" :key="t.key" :value="t.key" class="flex gap-1.5">
              {{ t.label }}
              <span v-if="t.count > 0" class="bg-muted text-muted-foreground rounded-full px-1.5 font-mono text-[10px]">{{ t.count }}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div class="flex items-center gap-1.5 pb-2.5">
          <div class="border-input bg-input/30 flex h-7 max-w-xs flex-1 items-center gap-2 rounded-lg border px-2">
            <SearchIcon class="text-muted-foreground size-3.5" />
            <input v-model="search" placeholder="Rechercher un titre, un tag…" class="placeholder:text-muted-foreground w-full bg-transparent text-xs outline-none" />
          </div>

          <!-- Filtre format (combobox : Popover + Command) -->
          <Popover>
            <PopoverTrigger as-child>
              <Button variant="outline" size="sm" class="h-7 gap-1.5 px-2 text-[11px] font-normal">
                <span>{{ formatLabel }}</span>
                <ChevronsUpDownIcon class="size-3 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-52 p-0" align="end">
              <Command>
                <CommandInput v-model="formatSearch" placeholder="Filtrer par format…" class="h-8" />
                <CommandList>
                  <CommandEmpty>Aucun format</CommandEmpty>
                  <CommandGroup>
                    <CommandItem v-for="f in formatOptions" :key="f.value" :value="f.label" @select="formatFilter = f.value; formatSearch = ''">
                      {{ f.label }}
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <!-- Zone (segmented compact) -->
          <div class="bg-input/30 border-input flex overflow-hidden rounded-lg border">
            <button v-for="g in ['all', 'france', 'international']" :key="g" @click="geo = g"
              class="h-7 px-2 text-[11px] font-medium capitalize transition-colors"
              :class="geo === g ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'">
              {{ g === 'all' ? 'Tout' : g }}
            </button>
          </div>

          <span class="text-muted-foreground ml-auto flex items-center gap-1.5 text-[11px]">
            <Spinner v-if="store.loading" class="size-3" />
            {{ filtered.length }} affichés
          </span>
        </div>
      </div>

      <!-- Table -->
      <Table v-if="!store.loading" class="text-xs">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-9 pl-3 pr-1.5">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" class="accent-primary" />
            </TableHead>
            <TableHead class="text-muted-foreground text-[10px] tracking-wider uppercase">Titre</TableHead>
            <TableHead class="text-muted-foreground hidden text-[10px] tracking-wider uppercase md:table-cell">Format</TableHead>
            <TableHead class="text-muted-foreground hidden text-[10px] tracking-wider uppercase lg:table-cell">Fiabilité</TableHead>
            <TableHead class="text-muted-foreground hidden text-[10px] tracking-wider uppercase sm:table-cell">Reçu</TableHead>
            <TableHead class="w-9 pr-3 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <ContextMenu v-for="s in filtered" :key="s.id">
            <ContextMenuTrigger as-child>
              <TableRow :class="selected.includes(s.id) ? 'bg-muted/60' : ''">
                <TableCell class="py-1.5 pl-3 pr-1.5">
                  <input type="checkbox" :checked="selected.includes(s.id)" @change="toggle(s.id)" class="accent-primary" />
                </TableCell>
                <TableCell class="max-w-md cursor-pointer py-1.5 pr-2" @click="openDetail(s)">
                  <p class="truncate text-xs font-medium">{{ s.source_title }}</p>
                  <p v-if="s.tags" class="text-accent mt-0.5 truncate text-[10px]">{{ s.tags.split(',').map(t => '#' + t.trim()).join(' ') }}</p>
                </TableCell>
                <TableCell class="hidden py-1.5 pr-2 md:table-cell">
                  <Badge :variant="formatVariant(s.type_ouverture)" class="h-4 px-1.5 text-[9px]">{{ shortFormat(s.type_ouverture) }}</Badge>
                </TableCell>
                <TableCell class="hidden py-1.5 pr-2 lg:table-cell">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <span class="text-muted-foreground inline-flex items-center gap-1.5 text-xs capitalize">
                          <span class="size-1.5 rounded-full" :class="dotFiabilite(s.fiabilite)"></span>{{ s.fiabilite }}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right">Fiabilité {{ s.fiabilite }}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell class="text-muted-foreground hidden whitespace-nowrap py-1.5 pr-2 text-[11px] sm:table-cell">{{ timeAgo(s.created_at) }}</TableCell>
                <TableCell class="py-1.5 pl-2 pr-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon-xs" class="text-muted-foreground hover:text-foreground">
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-40">
                      <DropdownMenuItem v-if="s.status === 'PENDING'" @select="bulk([s.id], 'QUEUED')">
                        <CheckIcon data-icon="inline-start" /> Valider
                      </DropdownMenuItem>
                      <DropdownMenuItem v-if="canReject(s.status)" class="text-destructive focus:text-destructive" @select="bulk([s.id], 'REJECTED')">
                        <XIcon data-icon="inline-start" /> Rejeter
                      </DropdownMenuItem>
                      <DropdownMenuItem v-if="canDelete(s.status)" class="text-destructive focus:text-destructive" @select="delOne(s.id)">
                        <Trash2Icon data-icon="inline-start" /> Supprimer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem @select="openDetail(s)">Voir le détail</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </ContextMenuTrigger>
            <ContextMenuContent class="w-44">
              <ContextMenuItem v-if="s.status === 'PENDING'" @select="bulk([s.id], 'QUEUED')">
                <CheckIcon data-icon="inline-start" /> Valider
              </ContextMenuItem>
              <ContextMenuItem v-if="canReject(s.status)" class="text-destructive focus:text-destructive" @select="bulk([s.id], 'REJECTED')">
                <XIcon data-icon="inline-start" /> Rejeter
              </ContextMenuItem>
              <ContextMenuItem v-if="canDelete(s.status)" class="text-destructive focus:text-destructive" @select="delOne(s.id)">
                <Trash2Icon data-icon="inline-start" /> Supprimer
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem @select="openDetail(s)">Voir le détail</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </TableBody>
      </Table>

      <!-- Skeleton pendant le chargement -->
      <div v-else class="space-y-2.5 p-3">
        <div v-for="i in 6" :key="i" class="flex items-center gap-3">
          <Skeleton class="size-4 rounded" />
          <div class="flex-1 space-y-1.5">
            <Skeleton class="h-3 w-2/3" />
            <Skeleton class="h-2.5 w-1/3" />
          </div>
          <Skeleton class="h-4 w-16" />
          <Skeleton class="size-6 rounded-md" />
        </div>
      </div>

      <!-- Vide -->
      <div v-if="!store.loading && filtered.length === 0" class="border-dashed rounded-lg border py-14 text-center">
        <div class="bg-muted text-muted-foreground mx-auto mb-3 flex size-10 items-center justify-center rounded-full">▤</div>
        <p class="text-sm font-medium">Aucun signal ici</p>
        <p class="text-muted-foreground mx-auto mt-1 max-w-xs text-xs">Change d'onglet ou lance un scan pour collecter de nouveaux articles.</p>
        <Button class="mt-4" @click="scanOpen = true">Lancer un scan</Button>
      </div>
    </Card>

    <!-- Bulk bar -->
    <Teleport to="body">
      <Transition name="fadeup">
        <div v-if="selected.length > 0" class="bg-card border-border fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-4 py-2.5 shadow-2xl">
          <span class="mr-1 text-xs font-medium">{{ selected.length }} sélectionné{{ selected.length > 1 ? 's' : '' }}</span>
          <Button size="sm" @click="bulk(selected, 'QUEUED')">Valider</Button>
          <Button variant="outline" size="sm" @click="bulk(selected, 'REJECTED')">Rejeter</Button>
          <Button variant="destructive" size="sm" @click="delSelected()">Supprimer</Button>
          <button @click="selected = []" class="text-muted-foreground hover:text-foreground ml-1 px-1 text-sm">✕</button>
        </div>
      </Transition>
    </Teleport>

    <!-- Détail d'un signal -->
    <Dialog v-model:open="detailOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle class="pr-6">{{ detail?.source_title }}</DialogTitle>
          <DialogDescription>
            <span class="flex flex-wrap gap-1.5 pt-1">
              <Badge :variant="detail ? formatVariant(detail.type_ouverture) : 'secondary'" class="h-4 px-1.5 text-[9px]">{{ detail ? shortFormat(detail.type_ouverture) : '' }}</Badge>
              <Badge variant="outline" class="h-4 px-1.5 text-[9px]">{{ detail?.geo === 'france' ? '🇫🇷 France' : '🌍 International' }}</Badge>
              <Badge variant="secondary" class="h-4 px-1.5 text-[9px] capitalize">{{ detail?.fiabilite }}</Badge>
            </span>
          </DialogDescription>
        </DialogHeader>
        <p class="text-muted-foreground whitespace-pre-line text-xs leading-relaxed">{{ detail?.flash_content }}</p>
        <a v-if="detail?.source_url" :href="detail.source_url" target="_blank" rel="noopener" class="text-info break-all text-[11px] hover:underline">{{ detail.source_url }}</a>
        <DialogFooter>
          <Button v-if="detail?.status === 'PENDING'" @click="bulk([detail.id], 'QUEUED')">Valider</Button>
          <Button v-if="detail && canReject(detail.status)" variant="destructive" @click="bulk([detail.id], 'REJECTED')">Rejeter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Scan modal -->
    <Dialog v-model:open="scanOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lancer un scan maintenant</DialogTitle>
          <DialogDescription>Le robot va parcourir tes sources RSS et ramener les nouveaux articles. Ça prend quelques secondes.</DialogDescription>
        </DialogHeader>
        <DialogFooter class="flex sm:justify-end">
          <Button variant="outline" @click="scanOpen = false">Annuler</Button>
          <Button @click="doScan"><PlayIcon data-icon="inline-start" /> Lancer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { CheckIcon, ChevronsUpDownIcon, MoreHorizontalIcon, PlayIcon, RefreshCwIcon, SearchIcon, Trash2Icon, XIcon } from '@lucide/vue'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../components/ui/context-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Skeleton } from '../components/ui/skeleton'
import { Spinner } from '../components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip'
import { toast } from 'vue-sonner'
import { useSignalsStore, SIGNAL_TABS, tabToStatus } from '../stores/signals'

const store = useSignalsStore()
const tab = ref('inbox')

// Onglets lisibles : les étapes internes automatiques sont regroupées, seuls
// les 4 vrais états (à valider / à publier / publiés / rejetés) comptent.
const tabs = computed(() =>
  SIGNAL_TABS.map((t) => ({
    key: t.key,
    label: t.label,
    count: t.statuses.reduce((n, s) => n + (store.counts[s] ?? 0), 0),
  })),
)
const geo = ref('all')
const search = ref('')
const selected = ref<number[]>([])
const detail = ref<any | null>(null)
const detailOpen = ref(false)
const scanOpen = ref(false)

// Filtre format (client-side — les formats présents dans le flux actuel).
const formatFilter = ref('all')
const formatSearch = ref('')
const formatOptions = computed(() => {
  const set = new Map<string, string>()
  for (const s of store.all) {
    const raw = String(s.type_ouverture ?? '').trim()
    if (!raw) continue
    const key = raw.toUpperCase()
    if (!set.has(key)) set.set(key, shortFormat(raw) || raw)
  }
  return [{ value: 'all', label: 'Tout' }, ...[...set.entries()].map(([value, label]) => ({ value, label }))]
})
const formatLabel = computed(() =>
  formatFilter.value === 'all' ? 'Format : tout' : `Format : ${formatOptions.value.find(f => f.value === formatFilter.value)?.label ?? formatFilter.value}`,
)

function load() {
  store.fetchSignals(tabToStatus(tab.value), geo.value, search.value)
}
onMounted(load)

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 350)
})
watch(tab, load)
watch(geo, load)

// Le filtre format s'applique côté client sur la liste déjà filtrée (tab/géo/recherche).
const filtered = computed(() => {
  const all = store.all
  if (formatFilter.value === 'all') return all
  return all.filter(s => String(s.type_ouverture ?? '').toUpperCase() === formatFilter.value)
})

const allSelected = computed(() => filtered.value.length > 0 && filtered.value.every(s => selected.value.includes(s.id)))

function toggle(id: number) {
  selected.value = selected.value.includes(id) ? selected.value.filter(i => i !== id) : [...selected.value, id]
}
function toggleAll() {
  selected.value = allSelected.value ? [] : filtered.value.map(s => s.id)
}
function openDetail(s: any) {
  detail.value = s
  detailOpen.value = true
}
async function bulk(ids: number[], status: string) {
  try {
    await store.bulkUpdate(ids, status)
    selected.value = []
    detailOpen.value = false
    load()
    const n = ids.length
    const verb = status === 'QUEUED' ? 'validé' : 'rejeté'
    toast.success(`${n} signal${n > 1 ? 's' : ''} ${verb}${n > 1 ? 's' : ''}`)
  } catch {
    toast.error('Impossible de mettre à jour — daemon injoignable')
  }
}
async function delOne(id: number) {
  try {
    await store.remove([id])
    load()
    toast.success('Signal supprimé')
  } catch {
    toast.error('Suppression impossible — daemon injoignable')
  }
}
async function delSelected() {
  const n = selected.value.length
  try {
    await store.remove(selected.value)
    selected.value = []
    load()
    toast.success(`${n} signal${n > 1 ? 's' : ''} supprimé${n > 1 ? 's' : ''}`)
  } catch {
    toast.error('Suppression impossible — daemon injoignable')
  }
}
function refresh() { load() }
function doScan() { scanOpen.value = false; refresh() }

const FINAL_STATUSES = ['PUBLISHED', 'REJECTED', 'REJECTED_ERROR']
function canReject(status: string) {
  return !FINAL_STATUSES.includes(status)
}
function canDelete(status: string) {
  return !FINAL_STATUSES.includes(status)
}

function formatVariant(t: string): 'default' | 'secondary' | 'outline' {
  const u = t.toUpperCase()
  if (u.includes('ALERTE') || u.includes('URGENT') || u.includes('BREAKING')) return 'default'
  if (u.includes('DÉCRYPTAGE') || u.includes('ENQUÊTE')) return 'secondary'
  if (u.includes('FLASH')) return 'outline'
  return 'secondary'
}
function shortFormat(t: string) {
  return t.replace(/📌|🔴|🔎|🚨|💅/g, '').trim() || t
}
function dotFiabilite(f: string) {
  return f === 'haute' ? 'bg-accent' : f === 'moyenne' ? 'bg-warning' : 'bg-destructive'
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `il y a ${Math.max(1, m)} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}
</script>

<style scoped>
.fadeup-enter-active,
.fadeup-leave-active {
  transition: all 150ms ease;
}
.fadeup-enter-from,
.fadeup-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
