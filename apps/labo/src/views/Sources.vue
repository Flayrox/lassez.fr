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
              <div class="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <LButton variant="ghost" @click="removeOne(s.id)" title="Supprimer">🗑</LButton>
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

    <!-- Comptes X / Telegram / Google News — chaque canal a son interrupteur -->
    <div class="grid lg:grid-cols-2 gap-4">
      <LCard title="Chaînes Telegram" description="Sans @, 1 par ligne">
        <template #actions>
          <LToggle :model-value="store.sources.telegramEnabled" @update:model-value="(v: boolean) => { store.sources.telegramEnabled = v; store.markDirty() }" />
        </template>
        <div :class="store.sources.telegramEnabled ? '' : 'opacity-40 pointer-events-none'">
          <textarea v-model="store.sources.telegram" rows="4" class="w-full bg-bg border border-border rounded px-3 py-2 text-xs font-mono text-text-1 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20" />
          <p v-if="!store.sources.telegramEnabled" class="text-[11px] text-text-3 mt-1.5">Canal coupé — le robot n'aspire plus ces chaînes.</p>
        </div>
      </LCard>
      <LCard title="Comptes X à suivre" description="Via RSS-Bridge, handles sans @, 1 par ligne">
        <template #actions>
          <LToggle :model-value="store.sources.xEnabled" @update:model-value="(v: boolean) => { store.sources.xEnabled = v; store.markDirty() }" />
        </template>
        <div :class="store.sources.xEnabled ? '' : 'opacity-40 pointer-events-none'">
          <textarea v-model="store.sources.xAccounts" rows="4" class="w-full bg-bg border border-border rounded px-3 py-2 text-xs font-mono text-text-1 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20" />
          <p v-if="!store.sources.xEnabled" class="text-[11px] text-text-3 mt-1.5">Canal coupé — les comptes X ne sont plus suivis.</p>
        </div>
      </LCard>
      <LCard title="Recherches Google News" description="Un mot-clé par ligne (optionnel)">
        <template #actions>
          <LToggle :model-value="store.sources.googleNewsEnabled" @update:model-value="(v: boolean) => { store.sources.googleNewsEnabled = v; store.markDirty() }" />
        </template>
        <div :class="store.sources.googleNewsEnabled ? '' : 'opacity-40 pointer-events-none'">
          <textarea v-model="store.sources.googleNews" rows="3" placeholder="ex : climat" class="w-full bg-bg border border-border rounded px-3 py-2 text-xs font-mono text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20" />
          <p v-if="!store.sources.googleNewsEnabled" class="text-[11px] text-text-3 mt-1.5">Canal coupé — les recherches Google News sont ignorées.</p>
        </div>
      </LCard>
      <LCard title="Serveur RSS-Bridge" description="Convertit les comptes X en flux RSS — requis si tu suis des comptes X">
        <template #actions>
          <LToggle :model-value="store.sources.rssBridgeEnabled" @update:model-value="(v: boolean) => { store.sources.rssBridgeEnabled = v; store.markDirty() }" />
        </template>
        <div :class="store.sources.rssBridgeEnabled ? '' : 'opacity-40 pointer-events-none'">
          <LInput v-model="bridgeProxy" />
          <p class="text-[11px] text-text-3 mt-2">Par défaut sur ta machine : http://localhost:3300</p>
        </div>
      </LCard>
    </div>

    <!-- Vidéos Telegram -->
    <LCard title="Vidéos Telegram" description="Transcription automatique des vidéos publiées dans les chaînes suivies">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">Activer l'ingestion vidéo</p>
            <p class="text-[11px] text-text-3">Plus lourd — à activer seulement si besoin</p>
          </div>
          <LToggle :model-value="store.video.ingestEnabled" @update:model-value="(v: boolean) => { store.video.ingestEnabled = v; store.markDirty() }" />
        </div>
        <template v-if="store.video.ingestEnabled">
          <div class="grid md:grid-cols-2 gap-3">
            <div>
              <p class="text-xs font-medium mb-1">Modèle de pré-filtre</p>
              <select v-model="store.video.prefilterModel" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
                <option v-for="m in store.modelRegistry" :key="m.label" :value="m.label">{{ m.label }}</option>
              </select>
            </div>
            <div>
              <p class="text-xs font-medium mb-1">Modèle de transcription</p>
              <select v-model="store.video.transcribeModel" class="w-full h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60">
                <option v-for="m in store.modelRegistry" :key="m.label" :value="m.label">{{ m.label }}</option>
              </select>
            </div>
          </div>
          <LTextarea label="Question de pré-filtre" help="L'IA répond OUI ou NON — OUI = la vidéo est transcrite" :rows="2" v-model="videoPromptProxy" />
          <div class="grid md:grid-cols-2 gap-3">
            <LInput label="Longueur min. du message (caractères)" help="En dessous, le message est ignoré — video_prefilter_min_chars" type="number" v-model.number="store.video.prefilterMinChars" />
            <LInput label="Taille audio maximum (Mo)" type="number" v-model.number="store.video.maxAudioMb" />
          </div>
        </template>
      </div>
    </LCard>

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
import LCard from '../components/ui/LCard.vue'
import LButton from '../components/ui/LButton.vue'
import LBadge from '../components/ui/LBadge.vue'
import LToggle from '../components/ui/LToggle.vue'
import LInput from '../components/ui/LInput.vue'
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

const bridgeProxy = computed({
  get: () => store.sources.bridgeUrl,
  set: (v: string) => { store.sources.bridgeUrl = v; store.markDirty() },
})
const videoPromptProxy = computed({
  get: () => store.video.prefilterPrompt,
  set: (v: string) => { store.video.prefilterPrompt = v; store.markDirty() },
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
