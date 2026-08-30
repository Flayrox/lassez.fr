<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">Signaux</h1>
        <p class="text-muted-foreground mt-0.5 text-xs">Les articles collectés par le robot — valide, programme ou rejette</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" @click="refresh"><RefreshCwIcon data-icon="inline-start" /> Actualiser</Button>
        <Button size="sm" @click="scanOpen = true"><PlayIcon data-icon="inline-start" /> Lancer un scan</Button>
      </div>
    </div>

    <!-- Erreur -->
    <div v-if="store.error" class="text-destructive border-destructive/40 bg-destructive/10 rounded-lg border px-4 py-3 text-xs">
      Impossible de joindre le robot ({{ store.error }}). Lance le daemon : <code class="font-mono">PIPELINE_DB_PATH=../data/pipeline.db ./daemon</code>
    </div>

    <Card class="gap-0 overflow-hidden py-0">
      <!-- Toolbar -->
      <div class="space-y-3 px-4 pt-3">
        <Tabs v-model="tab" class="w-full">
          <TabsList class="flex h-auto w-full justify-start overflow-x-auto">
            <TabsTrigger v-for="t in tabs" :key="t.key" :value="t.key" class="flex gap-1.5">
              {{ t.label }}
              <span v-if="t.count > 0" class="bg-muted text-muted-foreground rounded-full px-1.5 font-mono text-[10px]">{{ t.count }}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div class="flex items-center gap-2 pb-3">
          <div class="border-input bg-input/30 flex h-8 max-w-xs flex-1 items-center gap-2 rounded-lg border px-2.5">
            <SearchIcon class="text-muted-foreground size-3.5" />
            <input v-model="search" placeholder="Rechercher un titre, un tag…" class="placeholder:text-muted-foreground w-full bg-transparent text-xs outline-none" />
          </div>
          <div class="bg-input/30 border-input flex overflow-hidden rounded-lg border">
            <button v-for="g in ['all', 'france', 'international']" :key="g" @click="geo = g"
              class="h-8 px-2.5 text-[11px] font-medium capitalize transition-colors"
              :class="geo === g ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'">
              {{ g === 'all' ? 'Tout' : g }}
            </button>
          </div>
          <span class="text-muted-foreground ml-auto text-[11px]">{{ filtered.length }} affichés{{ store.loading ? ' · chargement…' : '' }}</span>
        </div>
      </div>

      <!-- Table -->
      <table class="w-full border-collapse text-left">
        <thead>
          <tr class="text-muted-foreground border-y border-border text-[10px] tracking-wider uppercase">
            <th class="w-10 py-2 pl-4 pr-3"><input type="checkbox" :checked="allSelected" @change="toggleAll" class="accent-primary" /></th>
            <th class="py-2 pr-3 font-medium">Titre</th>
            <th class="hidden py-2 pr-3 font-medium md:table-cell">Format</th>
            <th class="py-2 pr-3 font-medium">Zone</th>
            <th class="hidden py-2 pr-3 font-medium lg:table-cell">Fiabilité</th>
            <th class="hidden py-2 pr-3 font-medium sm:table-cell">Reçu</th>
            <th class="py-2 pl-3 pr-4 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="s in filtered" :key="s.id">
            <tr class="hover:bg-muted/50 group border-b border-border/50 transition-colors" :class="{ 'bg-muted': selected.includes(s.id) }">
              <td class="py-2.5 pl-4 pr-3"><input type="checkbox" :checked="selected.includes(s.id)" @change="toggle(s.id)" class="accent-primary" /></td>
              <td class="max-w-md cursor-pointer py-2.5 pr-3" @click="expanded = expanded === s.id ? null : s.id">
                <p class="line-clamp-1 text-xs font-medium">{{ s.source_title }}</p>
                <p v-if="expanded !== s.id" class="text-muted-foreground mt-0.5 line-clamp-1 text-[11px]">{{ s.flash_content }}</p>
                <p v-if="s.tags" class="text-accent mt-0.5 text-[10px]">{{ s.tags.split(',').map(t => '#' + t.trim()).join(' ') }}</p>
              </td>
              <td class="hidden py-2.5 pr-3 md:table-cell"><Badge :variant="formatVariant(s.type_ouverture)">{{ shortFormat(s.type_ouverture) }}</Badge></td>
              <td class="py-2.5 pr-3"><span class="text-xs text-muted-foreground">{{ s.geo === 'france' ? '🇫🇷' : '🌍' }}</span></td>
              <td class="hidden py-2.5 pr-3 lg:table-cell">
                <span class="text-muted-foreground inline-flex items-center gap-1.5 text-xs capitalize">
                  <span class="size-1.5 rounded-full" :class="dotFiabilite(s.fiabilite)"></span>{{ s.fiabilite }}
                </span>
              </td>
              <td class="text-muted-foreground hidden whitespace-nowrap py-2.5 pr-3 text-[11px] sm:table-cell">{{ timeAgo(s.created_at) }}</td>
              <td class="py-2.5 pl-3 pr-4">
                <div class="group-hover:opacity-100 flex justify-end gap-1 opacity-0 transition-opacity">
                  <Button v-if="s.status === 'PENDING'" variant="ghost" size="icon-xs" title="Valider" @click.stop="bulk([s.id], 'QUEUED')"><CheckIcon /></Button>
                  <Button v-if="canReject(s.status)" variant="ghost" size="icon-xs" class="hover:text-destructive" title="Rejeter" @click.stop="bulk([s.id], 'REJECTED')"><XIcon /></Button>
                  <Button v-if="canDelete(s.status)" variant="ghost" size="icon-xs" class="hover:text-destructive" title="Supprimer" @click.stop="delOne(s.id)"><Trash2Icon /></Button>
                </div>
              </td>
            </tr>
            <!-- Expanded preview -->
            <tr v-if="expanded === s.id">
              <td colspan="7" class="border-b border-border bg-background px-4 py-4">
                <div class="ml-12 max-w-2xl space-y-2">
                  <h4 class="text-sm font-medium">{{ s.source_title }}</h4>
                  <p class="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{{ s.flash_content }}</p>
                  <a :href="s.source_url" target="_blank" rel="noopener" class="text-info break-all text-[11px] hover:underline">{{ s.source_url }}</a>
                  <div class="flex gap-2 pt-1">
                    <Button v-if="s.status === 'PENDING'" @click="bulk([s.id], 'QUEUED')">Valider</Button>
                    <Button v-if="canReject(s.status)" variant="destructive" @click="bulk([s.id], 'REJECTED')">Rejeter</Button>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div v-if="!store.loading && filtered.length === 0" class="border-dashed rounded-lg border py-16 text-center">
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
          <Button @click="bulk(selected, 'QUEUED')">Valider</Button>
          <Button variant="outline" @click="bulk(selected, 'REJECTED')">Rejeter</Button>
          <Button variant="destructive" @click="delSelected()">Supprimer</Button>
          <button @click="selected = []" class="text-muted-foreground hover:text-foreground ml-1 px-1 text-sm">✕</button>
        </div>
      </Transition>
    </Teleport>

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
import { CheckIcon, PlayIcon, RefreshCwIcon, SearchIcon, Trash2Icon, XIcon } from '@lucide/vue'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
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
const expanded = ref<number | null>(null)
const scanOpen = ref(false)

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

const filtered = computed(() => store.all)

const allSelected = computed(() => filtered.value.length > 0 && filtered.value.every(s => selected.value.includes(s.id)))

function toggle(id: number) {
  selected.value = selected.value.includes(id) ? selected.value.filter(i => i !== id) : [...selected.value, id]
}
function toggleAll() {
  selected.value = allSelected.value ? [] : filtered.value.map(s => s.id)
}
async function bulk(ids: number[], status: string) {
  await store.bulkUpdate(ids, status)
  selected.value = []
  expanded.value = null
  load()
}
async function delOne(id: number) {
  await store.remove([id])
  load()
}
async function delSelected() {
  await store.remove(selected.value)
  selected.value = []
  load()
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
