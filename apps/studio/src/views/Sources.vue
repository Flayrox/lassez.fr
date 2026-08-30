<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">Sources</h1>
        <p class="text-muted-foreground mt-0.5 text-xs">D'où viennent les infos — clique le point de fiabilité pour la changer</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" @click="importOpen = true"><DownloadIcon data-icon="inline-start" /> Importer</Button>
        <Button variant="outline" size="sm" :class="editMode ? 'border-accent text-accent' : ''" :title="editMode ? 'Fermer le mode édition' : 'Débloquer les textes pour les modifier directement'" @click="editMode = !editMode">
          <PencilIcon data-icon="inline-start" /> {{ editMode ? 'Terminer' : 'Éditer' }}
        </Button>
        <Button variant="outline" size="sm" :disabled="testingAll" :title="testingAll ? 'Test en cours…' : 'Tester tous les flux — indique lesquels répondent et lesquels échouent (isolé, sans effet sur le pipeline)'" @click="testAllSources">
          <RadioIcon data-icon="inline-start" /> {{ testingAll ? `Test… (${bulkTest?.done ?? 0}/${bulkTest?.total ?? 0})` : 'Tester les flux' }}
        </Button>
        <Button size="sm" @click="startAdd">+ Ajouter</Button>
      </div>
    </div>

    <Card class="gap-0 overflow-hidden py-0">
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-2 px-4 py-3">
        <div class="border-input bg-input/30 flex h-8 max-w-xs flex-1 items-center gap-2 rounded-lg border px-2.5">
          <SearchIcon class="text-muted-foreground size-3.5" />
          <input v-model="search" placeholder="Rechercher une source…" class="placeholder:text-muted-foreground w-full bg-transparent text-xs outline-none" />
        </div>
        <div class="bg-input/30 border-input flex overflow-hidden rounded-lg border">
          <button v-for="f in trustFilters" :key="f.key" @click="trustFilter = f.key"
            class="inline-flex h-8 items-center gap-1.5 px-2.5 text-[11px] font-medium transition-colors"
            :class="trustFilter === f.key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'">
            <span v-if="f.key !== 'all'" class="size-1.5 rounded-full" :class="dotClass(f.key)"></span>{{ f.label }}
          </button>
        </div>
        <span class="text-muted-foreground ml-auto text-[11px]">{{ filtered.length }}/{{ store.sources.list.length }} sources · {{ activeCount }} actives</span>
      </div>

      <!-- Table -->
      <table class="w-full border-collapse text-left">
        <thead>
          <tr class="text-muted-foreground border-y border-border text-[10px] tracking-wider uppercase">
            <th class="w-24 py-2 pl-4 pr-3 font-medium">Fiabilité</th>
            <th class="py-2 pr-3 font-medium">Source</th>
            <th class="hidden py-2 pr-3 font-medium lg:table-cell">Biais</th>
            <th class="hidden py-2 pr-3 font-medium md:table-cell">Santé</th>
            <th class="py-2 pr-3 font-medium">Active</th>
            <th class="py-2 pl-3 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          <!-- Ligne d'ajout inline : Entrée = valider, Échap = annuler -->
          <tr v-if="adding" class="border-accent/40 bg-accent/10 border-b">
            <td colspan="6" class="py-2 pl-4 pr-4">
              <div class="flex items-center gap-2">
                <input ref="addInput" v-model="newUrl" placeholder="https://exemple.com/rss — Entrée pour valider"
                  class="border-input placeholder:text-muted-foreground h-8 flex-1 min-w-0 rounded-lg border bg-transparent px-2.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  @keydown.enter="confirmAdd" @keydown.esc="adding = false" />
                <span v-if="newUrl.trim() && !duplicateError" class="text-muted-foreground shrink-0 whitespace-nowrap text-[11px]">
                  <span class="inline-block size-2 rounded-full align-middle" :class="dotClass(detectTrust(newUrl))"></span>
                  <span class="align-middle capitalize">{{ trustLabel(detectTrust(newUrl)) }}</span>
                </span>
                <Button size="sm" :disabled="!newUrl.trim() || !!duplicateError" @click="confirmAdd" title="Ajouter"><CheckIcon /></Button>
                <Button size="sm" variant="ghost" @click="adding = false" title="Annuler"><XIcon /></Button>
              </div>
              <p v-if="duplicateError" class="text-destructive mt-1 text-[11px]">{{ duplicateError }}</p>
            </td>
          </tr>
          <tr v-for="s in filtered" :key="s.id" class="hover:bg-muted/50 group border-b border-border/50 transition-colors" :class="editMode ? 'bg-accent/10' : ''">
            <!-- Trust dot : clic pour cycler -->
            <td class="py-2 pl-4">
              <button @click="cycleTrust(s.id)" :title="`Fiabilité ${trustLabel(s.trust)} — cliquer pour changer`"
                class="hover:bg-muted inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors">
                <span class="size-2 rounded-full" :class="dotClass(s.trust)"></span>
                <span class="text-muted-foreground text-[11px] capitalize">{{ trustLabel(s.trust) }}</span>
              </button>
            </td>
            <td class="min-w-0 py-2.5 pr-3">
              <input
                v-if="editMode"
                :value="s.url"
                @input="setUrl(s.id, ($event.target as HTMLInputElement).value)"
                placeholder="https://…"
                class="border-input placeholder:text-muted-foreground h-7 w-full rounded-lg border bg-transparent px-2 font-mono text-xs outline-none focus-visible:border-ring"
              />
              <template v-else>
                <p class="truncate text-xs font-medium" :title="hostOf(s.url)">{{ hostOf(s.url) }}</p>
                <a :href="s.url" target="_blank" rel="noopener" class="text-muted-foreground hover:text-info line-clamp-1 text-[11px]">{{ s.url }}</a>
              </template>
            </td>
            <td class="hidden py-2.5 pr-3 lg:table-cell">
              <Select :model-value="s.bias" @update:model-value="(v: string) => setBias(s.id, v)">
                <SelectTrigger size="sm" class="max-w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="b in BIAS_VALUES" :key="b" :value="b">{{ b }}</SelectItem>
                </SelectContent>
              </Select>
            </td>
            <td class="hidden py-2.5 pr-3 md:table-cell">
              <Badge :class="healthOf(s.url).cls" :title="healthTitle(s.url)" class="border">{{ healthOf(s.url).label }}</Badge>
            </td>
            <td class="py-2.5 pr-3"><Switch :model-value="s.active" @update:model-value="(v: boolean) => setActive(s.id, v)" /></td>
            <td class="py-2.5 pl-3 pr-4">
              <div class="group-hover:opacity-100 flex justify-end gap-1 opacity-0 transition-opacity">
                <Button variant="ghost" size="icon-xs" :disabled="testingId === s.id" :title="testingId === s.id ? 'Test en cours…' : 'Tester ce flux (aspiration isolée, sans lancer un cycle)'" @click="testSource(s)">
                  <RadioIcon v-if="testingId !== s.id" />
                  <span v-else>…</span>
                </Button>
                <Button variant="ghost" size="icon-xs" class="hover:text-destructive" @click="removeOne(s.id)" title="Supprimer"><Trash2Icon /></Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="filtered.length === 0 && !store.loading" class="border-dashed rounded-lg border py-16 text-center">
        <div class="bg-muted text-muted-foreground mx-auto mb-3 flex size-10 items-center justify-center rounded-full">◎</div>
        <p class="text-sm font-medium">Aucune source</p>
        <p class="text-muted-foreground mt-1 text-xs">Ajoute des flux RSS ou importe une liste d'un coup.</p>
        <Button class="mt-4" @click="startAdd">+ Ajouter une source</Button>
      </div>
    </Card>

    <!-- Modal résultat du test de flux -->
    <Dialog v-model:open="testModal">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test du flux</DialogTitle>
        </DialogHeader>
        <div v-if="testError" class="border-destructive/40 bg-destructive/10 mb-3 rounded-lg border p-3">
          <p class="text-destructive text-xs font-medium">❌ Aspiration impossible</p>
          <p class="text-muted-foreground mt-1 break-all font-mono text-[11px]">{{ testError }}</p>
          <p class="text-muted-foreground mt-2 text-[11px]">Vérifie l'URL et que le site répond.</p>
        </div>
        <template v-else-if="testResult">
          <div class="mb-1 flex items-center justify-between gap-2">
            <p class="truncate text-sm font-semibold" :title="testResult.title">{{ testResult.title || 'Flux sans titre' }}</p>
            <span class="text-muted-foreground shrink-0 whitespace-nowrap text-[11px]">{{ testResult.fetchMs }} ms</span>
          </div>
          <p class="text-muted-foreground mb-3 truncate font-mono text-[11px]" :title="testResult.url">{{ testResult.url }}</p>
          <p class="text-muted-foreground mb-2 text-xs">{{ testResult.articles.length }} article{{ testResult.articles.length > 1 ? 's' : '' }} récent{{ testResult.articles.length > 1 ? 's' : '' }}<span v-if="testResult.skipped"> · {{ testResult.skipped }} ignoré{{ testResult.skipped > 1 ? 's' : '' }} (sans titre/lien)</span></p>
          <ul v-if="testResult.articles.length" class="max-h-80 space-y-2 overflow-y-auto pr-1">
            <li v-for="(a, i) in testResult.articles" :key="i" class="border-border bg-input/30 rounded-lg border p-2.5">
              <a :href="a.link" target="_blank" rel="noopener" class="line-clamp-2 text-xs font-medium hover:text-info">{{ a.title }}</a>
              <p class="text-muted-foreground mt-0.5 text-[11px]">{{ a.publishedAt ? new Date(a.publishedAt).toLocaleString('fr-FR') : 'date inconnue' }}</p>
            </li>
          </ul>
          <p v-else class="text-muted-foreground text-xs">Le flux répond mais ne contient aucun article exploitable (titre + lien requis).</p>
        </template>
        <DialogFooter>
          <Button variant="outline" @click="testModal = false">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Modal test de tous les flux -->
    <Dialog v-model:open="bulkModal">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test des flux RSS</DialogTitle>
        </DialogHeader>
        <template v-if="!bulkResults">
          <p class="text-muted-foreground mb-2 text-xs">Test isolé de chaque flux (aucun effet sur le pipeline)…</p>
          <div class="flex items-center gap-3">
            <div class="border-input bg-input/30 h-2 flex-1 overflow-hidden rounded border">
              <div class="bg-accent h-full transition-all duration-200" :style="{ width: pct + '%' }"></div>
            </div>
            <span class="text-muted-foreground whitespace-nowrap text-xs">{{ bulkTest?.done ?? 0 }}/{{ bulkTest?.total ?? 0 }}</span>
          </div>
        </template>
        <template v-else>
          <div class="mb-3 flex items-center gap-4">
            <span class="text-accent text-xs font-medium">✅ {{ okCount }} opérationnel{{ okCount > 1 ? 's' : '' }}</span>
            <span class="text-destructive text-xs font-medium">❌ {{ failCount }} en échec{{ failCount > 1 ? 's' : '' }}</span>
          </div>
          <ul class="max-h-96 space-y-1.5 overflow-y-auto pr-1">
            <li v-for="r in sortedBulk" :key="r.url" class="border-border/60 bg-input/30 flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
              <div class="min-w-0">
                <p class="truncate text-xs font-medium" :title="r.url">{{ hostOf(r.url) }}</p>
                <p class="text-muted-foreground truncate font-mono text-[11px]">{{ r.url }}</p>
              </div>
              <div class="shrink-0 text-right">
                <template v-if="r.ok">
                  <span class="text-accent text-[11px] font-semibold">OK</span>
                  <p class="text-muted-foreground text-[10px]">{{ r.articles }} article{{ r.articles !== null ? 's' : '' }} · {{ r.fetchMs }} ms</p>
                </template>
                <template v-else>
                  <span class="text-destructive text-[11px] font-semibold">ÉCHEC</span>
                  <p class="text-muted-foreground max-w-[220px] truncate text-[10px]" :title="r.error">{{ r.error }}</p>
                </template>
              </div>
            </li>
          </ul>
          <p class="text-muted-foreground mt-2 text-[11px]">Astuce : désactive dans la colonne « Active » les flux marqués en échec, puis vérifie leurs URLs.</p>
        </template>
        <DialogFooter>
          <Button variant="outline" @click="bulkModal = false" :disabled="testingAll">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Modal importer -->
    <Dialog v-model:open="importOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer des sources</DialogTitle>
          <DialogDescription>Colle une liste d'URLs (une par ligne). Les doublons sont ignorés, la fiabilité détectée automatiquement.</DialogDescription>
        </DialogHeader>
        <Textarea v-model="csvPaste" :rows="8" placeholder="https://exemple.com/rss&#10;https://autre.fr/feed" />
        <DialogFooter>
          <Button variant="outline" @click="importOpen = false">Annuler</Button>
          <Button :disabled="csvLines === 0" @click="doImport">Importer {{ csvLines }} URL{{ csvLines > 1 ? 's' : '' }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { CheckIcon, DownloadIcon, PencilIcon, RadioIcon, SearchIcon, Trash2Icon, XIcon } from '@lucide/vue'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { Textarea } from '../components/ui/textarea'
import { useConfigStore, detectTrust, hostOf, BIAS_VALUES } from '../stores/config'
import { api } from '../lib/api'

const store = useConfigStore()
const search = ref('')
const trustFilter = ref<'all' | 'high' | 'medium' | 'low'>('all')
const adding = ref(false)
const addInput = ref<HTMLInputElement | null>(null)
const importOpen = ref(false)
const newUrl = ref('')
const csvPaste = ref('')
const editMode = ref(false)

// Test isolé d'un flux (bouton ▶ par ligne) — POST /api/sources/test.
interface SourceTestArticle {
  title: string
  link: string
  publishedAt?: string
  snippet?: string
}
interface SourceTestResult {
  url: string
  title?: string
  articles: SourceTestArticle[]
  skipped?: number
  fetchMs?: number
}
const testingId = ref<string | null>(null)
const testModal = ref(false)
const testResult = ref<SourceTestResult | null>(null)
const testError = ref('')

async function testSource(s: { id: string; url: string }) {
  testingId.value = s.id
  testError.value = ''
  testResult.value = null
  try {
    const res = await api('/api/sources/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: s.url, type: 'RSS' }),
    })
    const data = await res.json()
    if (data.ok && data.result) {
      testResult.value = data.result
    } else {
      testError.value = data.error || 'Erreur inconnue du daemon'
    }
  } catch {
    testError.value = 'Impossible de contacter le daemon (il est peut-être arrêté)'
  } finally {
    testingId.value = null
    testModal.value = true
  }
}

// ── Test en masse : tous les flux (actifs + désactivés) — le daemon aspire
// isolément chaque URL, on affiche lesquels répondent / échouent. ──
interface BulkResult {
  url: string
  ok: boolean
  error?: string
  articles?: number | null
  fetchMs?: number
}
const testingAll = ref(false)
const bulkModal = ref(false)
const bulkTest = ref<{ done: number; total: number } | null>(null)
const bulkResults = ref<BulkResult[] | null>(null)

async function runSourceTest(url: string): Promise<BulkResult> {
  try {
    const res = await api('/api/sources/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, type: 'RSS' }),
    })
    const data = await res.json()
    if (data.ok && data.result) {
      return {
        url,
        ok: true,
        articles: data.result.articles?.length ?? 0,
        fetchMs: data.result.fetchMs,
      }
    }
    return { url, ok: false, error: data.error || 'Erreur inconnue du daemon' }
  } catch {
    return { url, ok: false, error: 'Impossible de contacter le daemon (il est peut-être arrêté)' }
  }
}

async function testAllSources() {
  if (testingAll.value) return
  const urls = store.sources.list.map(s => s.url)
  if (urls.length === 0) return
  testingAll.value = true
  bulkResults.value = null
  bulkTest.value = { done: 0, total: urls.length }
  bulkModal.value = true
  const results: BulkResult[] = new Array(urls.length)
  let next = 0
  const CONCURRENCY = 3
  async function worker() {
    while (true) {
      const i = next++
      if (i >= urls.length) return
      results[i] = await runSourceTest(urls[i])
      bulkTest.value = { done: results.filter(Boolean).length, total: urls.length }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker))
  bulkResults.value = results
  testingAll.value = false
}

const pct = computed(() => {
  const d = bulkTest.value
  if (!d || d.total === 0) return 0
  return Math.round((d.done / d.total) * 100)
})
const okCount = computed(() => bulkResults.value?.filter(r => r.ok).length ?? 0)
const failCount = computed(() => bulkResults.value?.filter(r => !r.ok).length ?? 0)
const sortedBulk = computed(() => {
  if (!bulkResults.value) return []
  return [...bulkResults.value].sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? 1 : -1))
})

async function startAdd() {
  adding.value = true
  newUrl.value = ''
  await nextTick()
  addInput.value?.focus()
}

function setUrl(id: string, v: string) {
  const s = store.sources.list.find(x => x.id === id)
  if (!s) return
  s.url = v
  store.markDirty()
}

const filtered = computed(() =>
  store.sources.list.filter(s => {
    if (trustFilter.value !== 'all' && s.trust !== trustFilter.value) return false
    if (search.value.trim()) {
      const hay = `${hostOf(s.url)} ${s.url}`.toLowerCase()
      if (!hay.includes(search.value.toLowerCase())) return false
    }
    return true
  })
)
const activeCount = computed(() => store.sources.list.filter(s => s.active).length)
const csvLines = computed(() => csvPaste.value.split('\n').filter(s => s.trim()).length)
const duplicateError = computed(() => {
  const u = newUrl.value.trim().toLowerCase()
  if (!u) return ''
  return store.sources.list.some(s => s.url.toLowerCase() === u) ? 'Cette source existe déjà.' : ''
})

const trustFilters = [
  { key: 'all', label: 'Toutes' },
  { key: 'high', label: 'Haute' },
  { key: 'medium', label: 'Moyenne' },
  { key: 'low', label: 'Faible' },
] as const

function dotClass(t: string) {
  return t === 'high' ? 'bg-accent' : t === 'medium' ? 'bg-warning' : 'bg-destructive'
}
function trustLabel(t: string) {
  return t === 'high' ? 'haute' : t === 'medium' ? 'moyenne' : 'faible'
}
function cycleTrust(id: string) {
  const s = store.sources.list.find(x => x.id === id)
  if (!s) return
  s.trust = s.trust === 'high' ? 'medium' : s.trust === 'medium' ? 'low' : 'high'
  store.markDirty()
}
function setActive(id: string, v: boolean) {
  const s = store.sources.list.find(x => x.id === id)
  if (s) { s.active = v; store.markDirty() }
}
function setBias(id: string, v: string) {
  const s = store.sources.list.find(x => x.id === id)
  if (s && BIAS_VALUES.includes(v)) { s.bias = v; store.markDirty() }
}
function removeOne(id: string) {
  store.sources.list = store.sources.list.filter(x => x.id !== id)
  store.markDirty()
}
function confirmAdd() {
  const url = newUrl.value.trim()
  if (!url || duplicateError.value) return
  store.sources.list.unshift({ id: Math.random().toString(36).slice(2, 9), url, trust: detectTrust(url), active: true } as any)
  store.markDirty()
  newUrl.value = ''
  adding.value = false
}
function doImport() {
  const urls = csvPaste.value.split('\n').map(u => u.trim()).filter(Boolean)
  const existing = new Set(store.sources.list.map(s => s.url.toLowerCase()))
  let added = 0
  for (const url of urls) {
    if (existing.has(url.toLowerCase())) continue
    existing.add(url.toLowerCase())
    store.sources.list.push({ id: Math.random().toString(36).slice(2, 9), url, trust: detectTrust(url), active: true } as any)
    added++
  }
  if (added > 0) store.markDirty()
  csvPaste.value = ''
  importOpen.value = false
}

// Santé réelle enregistrée par le daemon à chaque scan (daemon_source_health).
const FALLBACK_FAILED = [
  'https://www.rtl.fr/actu/rss',
  'https://www.arretsurimages.net/rss',
  'https://www.politis.fr/feed/',
  'https://www.palestinechronicle.com/feed/',
]
function healthOf(url: string): { cls: string; label: string } {
  const h = store.sourceHealth[url]
  if (h) {
    if (h.status === 'DISABLED') return { cls: 'border-destructive/40 bg-destructive/10 text-destructive', label: `Quarantaine (${h.consecutive_failures} échecs)` }
    if (h.status === 'DEGRADED') return { cls: 'border-warning/40 bg-warning/10 text-warning', label: `En échec (${h.consecutive_failures})` }
    return { cls: 'border-accent/40 bg-accent/10 text-accent', label: 'OK' }
  }
  if (FALLBACK_FAILED.includes(url)) return { cls: 'border-destructive/40 bg-destructive/10 text-destructive', label: 'En échec' }
  if (!url.startsWith('https://')) return { cls: 'border-warning/40 bg-warning/10 text-warning', label: 'HTTP' }
  return { cls: 'border-accent/40 bg-accent/10 text-accent', label: 'OK' }
}
function healthTitle(url: string): string {
  const h = store.sourceHealth[url]
  if (!h) return 'Aucune donnée du daemon'
  const lines = [
    `Dernier check : ${h.last_check_at ? new Date(h.last_check_at).toLocaleString('fr-FR') : '—'}`,
    h.last_status ? `Statut : ${h.last_status}` : '',
    h.last_error ? `Erreur : ${h.last_error}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}
</script>
