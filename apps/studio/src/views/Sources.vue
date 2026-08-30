<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">Sources</h1>
        <p class="text-xs text-text-3 mt-0.5">D'où viennent les infos — clique le point de fiabilité pour la changer</p>
      </div>
      <div class="flex gap-2">
        <LButton variant="secondary" @click="importOpen = true">⤓ Importer</LButton>
        <LButton variant="secondary" @click="editMode = !editMode" :class="editMode ? '!border-accent !text-accent' : ''" :title="editMode ? 'Fermer le mode édition' : 'Débloquer les textes pour les modifier directement'">
          ✎ {{ editMode ? 'Terminer' : 'Éditer' }}
        </LButton>
        <LButton variant="secondary" :disabled="testingAll" :title="testingAll ? 'Test en cours…' : 'Tester tous les flux — indique lesquels répondent et lesquels échouent (isolé, sans effet sur le pipeline)'" @click="testAllSources">
          📡 {{ testingAll ? `Test… (${bulkTest?.done ?? 0}/${bulkTest?.total ?? 0})` : 'Tester les flux' }}
        </LButton>
        <LButton @click="startAdd">+ Ajouter</LButton>
      </div>
    </div>

    <LCard :padding="false">
      <!-- Toolbar -->
      <div class="px-4 pt-3 pb-3 flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-2 h-8 px-2.5 rounded border border-border bg-bg flex-1 max-w-xs">
          <span class="text-text-3 text-xs">⌕</span>
          <input v-model="search" placeholder="Rechercher une source…" class="bg-transparent outline-none text-xs text-text-1 placeholder:text-text-3 w-full" />
        </div>
        <!-- Filtro fiabilité -->
        <div class="flex bg-bg border border-border rounded overflow-hidden">
          <button v-for="f in trustFilters" :key="f.key" @click="trustFilter = f.key"
            class="px-2.5 h-8 text-[11px] font-medium transition-colors inline-flex items-center gap-1.5"
            :class="trustFilter === f.key ? 'bg-surface-hover text-text-1' : 'text-text-3 hover:text-text-2'">
            <span v-if="f.key !== 'all'" class="w-1.5 h-1.5 rounded-full" :class="dotClass(f.key)"></span>{{ f.label }}
          </button>
        </div>
        <span class="ml-auto text-[11px] text-text-3">{{ filtered.length }}/{{ store.sources.list.length }} sources · {{ activeCount }} actives</span>
      </div>

      <!-- Table -->
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-y border-border text-[10px] uppercase tracking-wider text-text-3">
            <th class="pl-4 pr-3 py-2 font-medium w-24">Fiabilité</th>
            <th class="py-2 pr-3 font-medium">Source</th>
            <th class="py-2 pr-3 font-medium hidden lg:table-cell">Biais</th>
            <th class="py-2 pr-3 font-medium hidden md:table-cell">Santé</th>
            <th class="py-2 pr-3 font-medium">Active</th>
            <th class="py-2 pl-3 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          <!-- Ligne d'ajout inline : Entrée = valider, Échap = annuler -->
          <tr v-if="adding" class="border-b border-accent/40 bg-accent-muted/10">
            <td colspan="6" class="pl-4 pr-4 py-2">
              <div class="flex items-center gap-2">
                <input ref="addInput" v-model="newUrl" placeholder="https://exemple.com/rss — Entrée pour valider"
                  class="flex-1 min-w-0 h-8 bg-bg border border-accent/50 rounded px-2.5 text-xs font-mono text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent"
                  @keydown.enter="confirmAdd" @keydown.esc="adding = false" />
                <span v-if="newUrl.trim() && !duplicateError" class="text-[11px] text-text-3 whitespace-nowrap shrink-0">
                  <span class="w-2 h-2 rounded-full inline-block align-middle" :class="dotClass(detectTrust(newUrl))"></span>
                  <span class="capitalize align-middle">{{ trustLabel(detectTrust(newUrl)) }}</span>
                </span>
                <LButton size="sm" :disabled="!newUrl.trim() || !!duplicateError" @click="confirmAdd" title="Ajouter">✓</LButton>
                <LButton size="sm" variant="ghost" @click="adding = false" title="Annuler">✕</LButton>
              </div>
              <p v-if="duplicateError" class="text-[11px] text-danger mt-1">{{ duplicateError }}</p>
            </td>
          </tr>
          <tr v-for="s in filtered" :key="s.id" class="border-b border-border/50 hover:bg-surface-hover/50 transition-colors group" :class="editMode ? 'bg-accent-muted/10' : ''">
            <!-- Trust dot : clic pour cycler -->
            <td class="pl-4 py-2">
              <button @click="cycleTrust(s.id)" :title="`Fiabilité ${trustLabel(s.trust)} — cliquer pour changer`"
                class="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-surface-hover transition-colors">
                <span class="w-2 h-2 rounded-full" :class="dotClass(s.trust)"></span>
                <span class="text-[11px] capitalize text-text-2">{{ trustLabel(s.trust) }}</span>
              </button>
            </td>
            <td class="py-2.5 pr-3 min-w-0">
              <input
                v-if="editMode"
                :value="s.url"
                @input="setUrl(s.id, ($event.target as HTMLInputElement).value)"
                placeholder="https://…"
                class="w-full h-7 bg-bg border border-accent/50 rounded px-2 text-xs font-mono text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent transition-colors"
              />
              <template v-else>
                <p class="text-xs font-medium truncate" :title="hostOf(s.url)">{{ hostOf(s.url) }}</p>
                <a :href="s.url" target="_blank" rel="noopener" class="text-[11px] text-text-3 hover:text-info transition-colors line-clamp-1">{{ s.url }}</a>
              </template>
            </td>
            <td class="py-2.5 pr-3 hidden lg:table-cell">
              <select :value="s.bias" @change="setBias(s.id, ($event.target as HTMLSelectElement).value)"
                class="h-7 bg-bg border border-border rounded px-1.5 text-[11px] text-text-2 focus:outline-none focus:border-accent/60 max-w-[140px]">
                <option v-for="b in BIAS_VALUES" :key="b" :value="b">{{ b }}</option>
              </select>
            </td>
            <td class="py-2.5 pr-3 hidden md:table-cell">
              <LBadge :variant="healthOf(s.url).variant" :title="healthTitle(s.url)">{{ healthOf(s.url).label }}</LBadge>
            </td>
            <td class="py-2.5 pr-3"><LToggle :model-value="s.active" @update:model-value="(v: boolean) => setActive(s.id, v)" /></td>
            <td class="py-2.5 pl-3 pr-4">
              <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <LButton variant="ghost" size="sm" :disabled="testingId === s.id" :title="testingId === s.id ? 'Test en cours…' : 'Tester ce flux (aspiration isolée, sans lancer un cycle)'" @click="testSource(s)">
                  {{ testingId === s.id ? '…' : '▶' }}
                </LButton>
                <LButton variant="ghost" size="sm" @click="removeOne(s.id)" title="Supprimer">🗑</LButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <LEmpty v-if="filtered.length === 0 && !store.loading" icon="◎" title="Aucune source"
        description="Ajoute des flux RSS ou importe une liste d'un coup.">
        <template #action><LButton @click="startAdd">+ Ajouter une source</LButton></template>
      </LEmpty>
    </LCard>

    <!-- Modal résultat du test de flux -->
    <LModal :open="testModal" title="Test du flux" wide @close="testModal = false">
      <div v-if="testError" class="border border-danger/40 bg-danger/10 rounded-lg p-3 mb-3">
        <p class="text-xs font-medium text-danger">❌ Aspiration impossible</p>
        <p class="text-[11px] text-text-2 mt-1 font-mono break-all">{{ testError }}</p>
        <p class="text-[11px] text-text-3 mt-2">Vérifie l'URL et que le site répond.</p>
      </div>
      <template v-else-if="testResult">
        <div class="flex items-center justify-between gap-2 mb-1">
          <p class="text-sm font-semibold truncate" :title="testResult.title">{{ testResult.title || 'Flux sans titre' }}</p>
          <span class="text-[11px] text-text-3 whitespace-nowrap shrink-0">{{ testResult.fetchMs }} ms</span>
        </div>
        <p class="text-[11px] text-text-3 font-mono truncate mb-3" :title="testResult.url">{{ testResult.url }}</p>
        <p class="text-xs text-text-2 mb-2">{{ testResult.articles.length }} article{{ testResult.articles.length > 1 ? 's' : '' }} récent{{ testResult.articles.length > 1 ? 's' : '' }}<span v-if="testResult.skipped"> · {{ testResult.skipped }} ignoré{{ testResult.skipped > 1 ? 's' : '' }} (sans titre/lien)</span></p>
        <ul v-if="testResult.articles.length" class="space-y-2 max-h-80 overflow-y-auto pr-1">
          <li v-for="(a, i) in testResult.articles" :key="i" class="border border-border rounded-lg p-2.5 bg-bg/40">
            <a :href="a.link" target="_blank" rel="noopener" class="text-xs font-medium text-text-1 hover:text-info transition-colors line-clamp-2">{{ a.title }}</a>
            <p class="text-[11px] text-text-3 mt-0.5">{{ a.publishedAt ? new Date(a.publishedAt).toLocaleString('fr-FR') : 'date inconnue' }}</p>
          </li>
        </ul>
        <p v-else class="text-xs text-text-3">Le flux répond mais ne contient aucun article exploitable (titre + lien requis).</p>
      </template>
      <template #footer>
        <LButton variant="secondary" @click="testModal = false">Fermer</LButton>
      </template>
    </LModal>

    <!-- Modal test de tous les flux -->
    <LModal :open="bulkModal" title="Test des flux RSS" wide @close="bulkModal = false">
      <template v-if="!bulkResults">
        <p class="text-xs text-text-2 mb-2">Test isolé de chaque flux (aucun effet sur le pipeline)…</p>
        <div class="flex items-center gap-3">
          <div class="h-2 flex-1 rounded bg-bg border border-border overflow-hidden">
            <div class="h-full bg-accent transition-all duration-200" :style="{ width: pct + '%' }"></div>
          </div>
          <span class="text-xs text-text-3 whitespace-nowrap">{{ bulkTest?.done ?? 0 }}/{{ bulkTest?.total ?? 0 }}</span>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center gap-4 mb-3">
          <span class="text-xs font-medium text-accent">✅ {{ okCount }} opérationnel{{ okCount > 1 ? 's' : '' }}</span>
          <span class="text-xs font-medium text-danger">❌ {{ failCount }} en échec{{ failCount > 1 ? 's' : '' }}</span>
        </div>
        <ul class="space-y-1.5 max-h-96 overflow-y-auto pr-1">
          <li v-for="r in sortedBulk" :key="r.url" class="flex items-start justify-between gap-3 border border-border/60 rounded-lg px-3 py-2 bg-bg/40">
            <div class="min-w-0">
              <p class="text-xs font-medium truncate" :title="r.url">{{ hostOf(r.url) }}</p>
              <p class="text-[11px] text-text-3 font-mono truncate">{{ r.url }}</p>
            </div>
            <div class="text-right shrink-0">
              <template v-if="r.ok">
                <span class="text-[11px] text-accent font-semibold">OK</span>
                <p class="text-[10px] text-text-3">{{ r.articles }} article{{ r.articles !== null ? 's' : '' }} · {{ r.fetchMs }} ms</p>
              </template>
              <template v-else>
                <span class="text-[11px] text-danger font-semibold">ÉCHEC</span>
                <p class="text-[10px] text-text-3 max-w-[220px] truncate" :title="r.error">{{ r.error }}</p>
              </template>
            </div>
          </li>
        </ul>
        <p class="text-[11px] text-text-3 mt-2">Astuce : désactive dans la colonne « Active » les flux marqués en échec, puis vérifie leurs URLs.</p>
      </template>
      <template #footer>
        <LButton variant="secondary" @click="bulkModal = false" :disabled="testingAll">Fermer</LButton>
      </template>
    </LModal>

    <!-- Modal importer -->
    <LModal :open="importOpen" title="Importer des sources" wide @close="importOpen = false">
      <p class="text-xs text-text-2 mb-3">Colle une liste d'URLs (une par ligne). Les doublons sont ignorés, la fiabilité détectée automatiquement.</p>
      <LTextarea v-model="csvPaste" :rows="8" placeholder="https://exemple.com/rss&#10;https://autre.fr/feed" />
      <template #footer>
        <LButton variant="secondary" @click="importOpen = false">Annuler</LButton>
        <LButton :disabled="csvLines === 0" @click="doImport">Importer {{ csvLines }} URL{{ csvLines > 1 ? 's' : '' }}</LButton>
      </template>
    </LModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useConfigStore, detectTrust, hostOf, BIAS_VALUES } from '../stores/config'
import { api } from '../lib/api'
import LCard from '../components/ui/LCard.vue'
import LButton from '../components/ui/LButton.vue'
import LBadge from '../components/ui/LBadge.vue'
import LToggle from '../components/ui/LToggle.vue'
import LTextarea from '../components/ui/LTextarea.vue'
import LModal from '../components/ui/LModal.vue'
import LEmpty from '../components/ui/LEmpty.vue'

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
  const CONCURRENCY = 3 // on ne tape pas le réseau à 10 flux d'un coup
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
  return t === 'high' ? 'bg-accent' : t === 'medium' ? 'bg-warning' : 'bg-danger'
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
  store.sources.list.unshift({ id: Math.random().toString(36).slice(2, 9), url, trust: detectTrust(url), active: true })
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
    store.sources.list.push({ id: Math.random().toString(36).slice(2, 9), url, trust: detectTrust(url), active: true })
    added++
  }
  if (added > 0) store.markDirty()
  csvPaste.value = ''
  importOpen.value = false
}

// Santé réelle enregistrée par le daemon à chaque scan (daemon_source_health).
// Sans daemon : repli sur les échecs connus du VPS pour ne pas tout montrer vert.
const FALLBACK_FAILED = [
  'https://www.rtl.fr/actu/rss',
  'https://www.arretsurimages.net/rss',
  'https://www.politis.fr/feed/',
  'https://www.palestinechronicle.com/feed/',
]
function healthOf(url: string): { variant: 'success' | 'warning' | 'danger'; label: string } {
  const h = store.sourceHealth[url]
  if (h) {
    if (h.status === 'DISABLED') return { variant: 'danger', label: `Quarantaine (${h.consecutive_failures} échecs)` }
    if (h.status === 'DEGRADED') return { variant: 'warning', label: `En échec (${h.consecutive_failures})` }
    return { variant: 'success', label: 'OK' }
  }
  // Daemon muet : on garde les échecs réels connus du dernier scan VPS
  if (FALLBACK_FAILED.includes(url)) return { variant: 'danger', label: 'En échec' }
  if (!url.startsWith('https://')) return { variant: 'warning', label: 'HTTP' }
  return { variant: 'success', label: 'OK' }
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
