<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-lg font-semibold text-text-1">Vue d'ensemble</h1>
        <p class="text-xs text-text-3 mt-0.5">Ton atelier en un coup d'œil — données réelles du daemon</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex bg-bg border border-border rounded overflow-hidden">
          <button @click="mode = 'overview'"
            class="px-2.5 h-8 text-[11px] font-medium transition-colors"
            :class="mode === 'overview' ? 'bg-surface-hover text-text-1' : 'text-text-3 hover:text-text-2'">◉ Vue d'ensemble</button>
          <button @click="mode = 'suivi'"
            class="px-2.5 h-8 text-[11px] font-medium transition-colors"
            :class="mode === 'suivi' ? 'bg-surface-hover text-text-1' : 'text-text-3 hover:text-text-2'">📈 Suivi</button>
        </div>
        <LButton :disabled="system.scanning" @click="runScan">
          {{ system.scanning ? 'Scan en cours…' : '▶ Lancer un scan' }}
        </LButton>
      </div>
    </div>

    <!-- ════════════ MODE SUIVI : historique des cycles + journal ════════════ -->
    <template v-if="mode === 'suivi'">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <LCard>
          <p class="text-[11px] text-text-3">Cycles enregistrés</p>
          <p class="text-xl font-semibold mt-1 text-text-1">{{ system.cycles.length }}</p>
          <p class="text-[11px] text-text-3 mt-1">derniers passages du robot</p>
        </LCard>
        <LCard>
          <p class="text-[11px] text-text-3">Dernier cycle</p>
          <p class="text-xl font-semibold mt-1 text-text-1 truncate">{{ lastCycleShort }}</p>
          <p class="text-[11px] text-text-3 mt-1">{{ lastCycleDurLabel }}</p>
        </LCard>
        <LCard>
          <p class="text-[11px] text-text-3">Étapes en échec</p>
          <p class="text-xl font-semibold mt-1" :class="errorCount > 0 ? 'text-danger' : 'text-accent'">{{ errorCount }}</p>
          <p class="text-[11px] text-text-3 mt-1">{{ errorCount > 0 ? 'à corriger sur les derniers cycles' : 'tout est vert' }}</p>
        </LCard>
        <LCard>
          <p class="text-[11px] text-text-3">Signaux publiés</p>
          <p class="text-xl font-semibold mt-1 text-text-1">{{ system.counts.PUBLISHED ?? 0 }}</p>
          <p class="text-[11px] text-text-3 mt-1">au total</p>
        </LCard>
      </div>

      <!-- Historique visuel -->
      <LCard :padding="false" title="Historique des cycles" :description="cycleDesc">
        <div v-if="!system.daemon && system.error" class="px-4 pt-3">
          <p class="text-xs text-danger">daemon injoignable — l'historique n'est pas disponible ({{ system.error }}).</p>
        </div>
        <div v-if="system.cycles.length === 0" class="p-8 text-center">
          <p class="text-sm font-medium text-text-1">Aucun cycle enregistré</p>
          <p class="text-xs text-text-3 mt-1">Lance un scan pour voir la chaîne tourner : aspiré → trié → rédigé → validé → publié.</p>
          <div class="mt-4"><LButton @click="runScan">▶ Lancer un scan</LButton></div>
        </div>
        <div v-else class="divide-y divide-border">
          <div v-for="c in system.cycles" :key="c.id" class="px-4 py-3">
            <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div class="flex items-center gap-2 text-xs min-w-0">
                <span class="font-medium text-text-1 whitespace-nowrap">{{ cycleTime(c.started_at) }}</span>
                <span class="text-text-3 whitespace-nowrap">· {{ cycleDur(c.durationMs) }}</span>
                <LBadge :variant="c.source === 'publisher' ? 'neutral' : 'info'" class="shrink-0">{{ c.source === 'publisher' ? 'diffusion' : 'pipeline' }}</LBadge>
                <span v-if="c.error" class="text-[11px] text-danger truncate" :title="c.error">{{ c.error }}</span>
              </div>
              <span v-if="cycleDetail(c)" class="text-[11px] text-text-3 truncate">{{ cycleDetail(c) }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-1 mt-2">
              <template v-for="(st, i) in c.steps" :key="st.type + i">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] whitespace-nowrap" :class="stepClass(st)" :title="st.error || st.detail || st.label">
                  <span class="text-[9px]">{{ st.status === 'ok' ? '✓' : st.status === 'error' ? '✕' : '·' }}</span>{{ st.label }}
                </span>
                <span v-if="i < c.steps.length - 1" class="text-text-3 text-[10px]">→</span>
              </template>
            </div>
            <p v-if="stepErrors(c).length" class="text-[11px] text-danger mt-1.5">{{ stepErrors(c).join(' · ') }}</p>
          </div>
        </div>
      </LCard>

      <!-- Journal -->
      <LCard :padding="false" title="Journal du robot" description="Ce que le daemon fait en direct — rafraîchi toutes les 3 secondes">
        <div class="px-4 pt-3 pb-2 flex flex-wrap items-center gap-2">
          <select v-model="logFilter" class="h-7 bg-bg border border-border rounded px-2 text-[11px] focus:outline-none focus:border-accent/60">
            <option value="ALL">Tous les niveaux</option>
            <option value="ERROR">Erreurs</option>
            <option value="WARN">Avertissements</option>
            <option value="SUCCESS">Succès</option>
            <option value="INFO">Infos</option>
          </select>
          <label class="flex items-center gap-1.5 text-[11px] text-text-3 cursor-pointer select-none">
            <input type="checkbox" v-model="follow" class="accent-accent" /> suivre le flux
          </label>
          <div class="ml-auto flex items-center gap-2">
            <span class="text-[10px] text-text-3">{{ system.logs.length }} lignes</span>
            <LButton size="sm" variant="ghost" @click="refreshSuivi">↻</LButton>
          </div>
        </div>
        <div ref="logBox" class="bg-bg border-t border-border p-3 h-72 overflow-y-auto font-mono text-[10.5px] leading-relaxed">
          <p v-for="(l, i) in filteredLogs" :key="i" class="whitespace-pre-wrap break-words py-px">
            <span class="text-text-3">{{ logTime(l.ts) }}</span>
            <span class="mx-1.5" :class="logLevelClass(l.level)">[{{ l.level }}]</span>
            <span class="text-info/70">{{ l.node }}</span>
            <span class="text-text-2"> {{ l.message }}</span>
          </p>
          <p v-if="filteredLogs.length === 0" class="text-text-3">Aucune ligne pour le moment{{ system.error ? ' — daemon injoignable' : '' }}…</p>
        </div>
      </LCard>
    </template>

    <!-- ════════════ MODE VUE D'ENSEMBLE ════════════ -->
    <template v-else>
      <!-- Décisions d'abord : ce qui t'attend (cliquable → Signaux), puis l'état du robot -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <router-link v-for="c in decisionCards" :key="c.label" :to="c.to" class="block group">
          <LCard>
            <p class="text-[11px] text-text-3">{{ c.label }}</p>
            <p class="text-xl font-semibold mt-1" :class="c.class">{{ c.value }}</p>
            <p class="text-[11px] text-text-3 mt-1 group-hover:text-accent transition-colors">{{ c.sub }}</p>
          </LCard>
        </router-link>
        <LCard v-for="c in statusCards" :key="c.label">
          <p class="text-[11px] text-text-3">{{ c.label }}</p>
          <p class="text-xl font-semibold mt-1" :class="c.class">{{ c.value }}</p>
          <p class="text-[11px] text-text-3 mt-1">{{ c.sub }}</p>
        </LCard>
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <!-- Prochain scan -->
        <LCard title="Prochain passage" description="Le robot parcourt tes sources automatiquement">
          <div class="flex items-center gap-4">
            <div class="relative w-16 h-16 shrink-0">
              <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" stroke-width="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--accent)" stroke-width="3"
                  :stroke-dasharray="`${nextPct} ${100 - nextPct}`" stroke-linecap="round" />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-xs font-semibold">{{ nextPct }}%</span>
            </div>
            <div class="space-y-1 min-w-0">
              <p class="text-sm font-medium">{{ nextLabel }}</p>
              <p class="text-[11px] text-text-3">
                {{ lastCycleLabel }} · intervalle {{ store.planning.intervalleMinutes }} min · {{ rssCount }} sources RSS
              </p>
              <router-link to="/planning" class="text-[11px] text-accent hover:underline inline-block">Modifier le planning →</router-link>
            </div>
          </div>
        </LCard>

        <!-- Chaîne -->
        <LCard title="Chaîne de fabrication" :description="`${activeCount} étapes sur 7 actives`">
          <div class="flex flex-wrap items-center gap-1">
            <template v-for="(n, i) in store.atelier" :key="n.type">
              <div class="flex items-center gap-1">
                <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[11px]"
                  :class="n.enabled ? 'border-accent/40 bg-accent-muted text-accent' : 'border-border text-text-3'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="n.enabled ? 'bg-accent' : 'bg-border'"></span>{{ n.label }}
                </span>
                <span v-if="i < store.atelier.length - 1" class="text-text-3">→</span>
              </div>
            </template>
          </div>
          <router-link to="/atelier" class="text-[11px] text-accent hover:underline inline-block mt-3">Gérer l'atelier →</router-link>
        </LCard>

        <!-- Sources -->
        <LCard title="Sources en difficulté" description="Flux qui ont échoué au dernier passage">
          <div v-if="failedSources.length === 0" class="text-xs text-text-3 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-accent"></span> Tout va bien, aucune erreur</div>
          <ul v-else class="space-y-2">
            <li v-for="s in failedSources" :key="s.url" class="text-xs flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-text-2 truncate font-mono">{{ s.url }}</p>
                <p v-if="s.detail" class="text-[10px] text-text-3 truncate">{{ s.detail }}</p>
              </div>
              <LBadge :variant="s.status === 'DISABLED' ? 'danger' : 'warning'" class="shrink-0">
                {{ s.status === 'DISABLED' ? 'Quarantaine' : `${s.errors} échec${s.errors > 1 ? 's' : ''}` }}
              </LBadge>
            </li>
          </ul>
          <router-link to="/sources" class="text-[11px] text-accent hover:underline inline-block mt-3">Voir les sources →</router-link>
        </LCard>

        <!-- Activité -->
        <LCard title="File de validation" description="Ce qui attend ton feu vert — valide ou rejette">
          <ul v-if="recentSignals.length" class="space-y-2.5">
            <li v-for="s in recentSignals" :key="s.id" class="text-xs flex items-start gap-2">
              <LBadge :variant="s.type_ouverture.includes('ALERTE') ? 'accent' : 'neutral'" class="shrink-0 mt-0.5">{{ s.type_ouverture.replace('📌 ', '') }}</LBadge>
              <span class="text-text-2 line-clamp-1">{{ s.source_title }}</span>
            </li>
          </ul>
          <p v-else class="text-xs text-text-3">Aucun signal à valider pour l'instant.</p>
          <router-link to="/signaux" class="text-[11px] text-accent hover:underline inline-block mt-3">Tous les signaux →</router-link>
        </LCard>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useConfigStore, DAYS } from '../stores/config'
import { useSignalsStore } from '../stores/signals'
import { useSystemStore, type Cycle, type CycleStep } from '../stores/system'
import LCard from '../components/ui/LCard.vue'
import LBadge from '../components/ui/LBadge.vue'
import LButton from '../components/ui/LButton.vue'

const store = useConfigStore()
const signals = useSignalsStore()
const system = useSystemStore()
const mode = ref<'overview' | 'suivi'>('overview')

onMounted(() => {
  system.fetchHealth()
  store.loadSourceHealth()
  signals.fetchSignals('PENDING')
})

async function runScan() {
  await system.triggerScan()
  // Le cycle tourne en arrière-plan — on rafraîchit tout de suite, puis après 6 s.
  refreshAll()
  setTimeout(refreshAll, 6000)
}
function refreshAll() {
  system.fetchHealth()
  store.loadSourceHealth()
  signals.fetchSignals('PENDING')
  if (mode.value === 'suivi') {
    system.fetchCycles()
    system.fetchLogs()
  }
}

// ── Auto-refresh du mode Suivi ──
let suiviTimer: ReturnType<typeof setInterval> | null = null
watch(mode, (m) => {
  if (m === 'suivi') {
    system.fetchCycles()
    system.fetchLogs()
    suiviTimer = setInterval(() => {
      system.fetchCycles()
      system.fetchLogs()
    }, 3000)
  } else if (suiviTimer) {
    clearInterval(suiviTimer)
    suiviTimer = null
  }
})
onUnmounted(() => { if (suiviTimer) clearInterval(suiviTimer) })

const activeCount = computed(() => store.atelier.filter(p => p.enabled).length)
const rssCount = computed(() => store.sources.list.filter(s => s.active).length)

// ── Robot / Publication : état réel du daemon ──
const robotDown = computed(() => !!system.error || !system.daemon)
const robot = computed(() => {
  if (robotDown.value) return { value: '● Hors ligne', sub: 'daemon injoignable', class: 'text-danger' }
  return { value: '● En marche', sub: `Binaire Go · up depuis ${humanize(system.daemon!.uptimeSeconds)}`, class: 'text-accent' }
})
const pub = computed(() => {
  const mock = system.daemon?.qoeMock ?? true
  return {
    value: mock ? 'Mode test' : 'Branché',
    sub: mock ? 'qoe.fi sans clé — envois simulés' : `qoe.fi · ${system.daemon?.qoePublicationId || 'publié'}`,
    class: mock ? 'text-warning' : 'text-accent',
  }
})

// Décisions d'abord : les deux cartes humaines sont cliquables (→ Signaux),
// l'état du robot (télémétrie) reste compact en dessous.
const decisionCards = computed(() => [
  { label: 'À valider', value: String(system.counts.PENDING ?? 0), sub: 'à décider — Signaux →', class: 'text-warning', to: '/signaux' },
  { label: 'À publier', value: String(system.counts.QUEUED ?? 0), sub: 'programmés — Signaux →', class: 'text-info', to: '/signaux' },
])
const statusCards = computed(() => [
  { label: 'Robot', value: robot.value.value, sub: robot.value.sub, class: robot.value.class },
  { label: 'Publication', value: pub.value.value, sub: pub.value.sub, class: pub.value.class },
])

// ── Prochain passage : vrai (dernier cycle + planning) ──
// Le temps zéro Go (0001-01-01) = "jamais exécuté".
const lastCycleTs = computed<number | null>(() => {
  const at = system.daemon?.lastCycleAt
  if (!at) return null
  const d = new Date(at)
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1970) return null
  return d.getTime()
})

const lastCycleLabel = computed(() => {
  if (lastCycleTs.value == null) return 'Dernier scan : jamais encore'
  return `Dernier scan : ${relTime(system.daemon!.lastCycleAt!)}`
})

const nextPct = computed(() => {
  const last = lastCycleTs.value
  if (last == null) return 0
  const now = Date.now()
  const span = nextDelayMs(now)
  if (!span || span <= 0) return 100
  return Math.min(100, Math.max(0, Math.round(((now - last) / span) * 100)))
})

const nextLabel = computed(() => {
  if (lastCycleTs.value == null) return 'Jamais encore scanné'
  if (store.planning.mode === 'pulse') return `Toutes les ${store.planning.intervalleMinutes} min`
  const slot = nextSlot()
  if (!slot) return 'Aucun créneau configuré'
  return slot.label
})

// Intervalle (ms) entre deux passages selon le mode de planification.
function nextDelayMs(now: number): number {
  if (store.planning.mode === 'pulse') return store.planning.intervalleMinutes * 60_000
  const slot = nextSlot()
  if (!slot) return store.planning.intervalleMinutes * 60_000
  return Math.max(60_000, slot.at - now)
}

// Prochain créneau du calendrier (7×24) : l'occurrence la plus proche.
function nextSlot(): { at: number; label: string } | null {
  const slots = store.planning.weeklySlots
  if (!slots.length) return null
  const now = new Date()
  let best: { at: number; label: string } | null = null
  for (const s of slots) {
    const dayIdx = DAYS.indexOf(s.day)
    if (dayIdx < 0) continue
    const [h, m] = s.time.split(':').map(Number)
    if (h == null || m == null) continue
    let daysAhead = (dayIdx - now.getDay() + 7) % 7
    const at = new Date(now)
    at.setDate(at.getDate() + daysAhead)
    at.setHours(h, m, 0, 0)
    if (at.getTime() <= now.getTime()) {
      // L'heure est déjà passée aujourd'hui → prochaine semaine.
      at.setDate(at.getDate() + 7)
    }
    if (!best || at.getTime() < best.at) {
      const daysDiff = Math.round((at.getTime() - now.getTime()) / 86_400_000)
      const label = daysDiff === 0 ? `aujourd'hui à ${s.time}` : daysDiff === 1 ? `demain à ${s.time}` : `${s.day} à ${s.time}`
      best = { at: at.getTime(), label }
    }
  }
  return best
}

// ── Sources en difficulté : santé réelle (daemon_source_health) ──
const failedSources = computed(() => {
  const out: { url: string; detail: string; errors: number; status: string }[] = []
  for (const h of Object.values(store.sourceHealth)) {
    if (h.status === 'HEALTHY') continue
    out.push({
      url: h.url,
      status: h.status,
      errors: h.consecutive_failures,
      detail: h.last_error || (h.status === 'DISABLED' ? 'source mise en quarantaine' : 'échecs répétés'),
    })
  }
  return out
    .sort((a, b) => (a.status === 'DISABLED' ? -1 : 1) - (b.status === 'DISABLED' ? -1 : 1) || b.errors - a.errors)
    .slice(0, 5)
})

const recentSignals = computed(() => signals.all.slice(0, 4))

// ── Suivi : stats + helpers ──
const errorCount = computed(() =>
  system.cycles.reduce((n, c) => n + c.steps.filter(s => s.status === 'error').length, 0)
)
const lastCycleShort = computed(() => {
  const list = system.cycles
  if (!list.length) return '—'
  const last = list[list.length - 1]
  return relTime(last.started_at)
})
const lastCycleDurLabel = computed(() => {
  const list = system.cycles
  if (!list.length) return "aucun passage pour l'instant"
  return `durée ${cycleDur(list[list.length - 1].durationMs)}`
})
const cycleDesc = computed(() => {
  const list = system.cycles
  if (!list.length) return 'Les derniers passages du robot — erreurs en rouge'
  return `Dernier passage ${relTime(list[list.length - 1].started_at)} · ${errorCount.value} étape${errorCount.value > 1 ? 's' : ''} en échec`
})

function cycleTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1970) return '—'
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay ? time : `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} ${time}`
}
function cycleDur(ms: number): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}
function stepClass(st: CycleStep): string {
  if (st.status === 'error') return 'border-danger/50 bg-danger/10 text-danger'
  if (st.status === 'skipped') return 'border-border text-text-3'
  return 'border-accent/40 bg-accent-muted text-accent'
}
function stepErrors(c: Cycle): string[] {
  return c.steps.filter(s => s.status === 'error' && s.error).map(s => `${s.label} : ${s.error}`)
}
function cycleDetail(c: Cycle): string {
  const details = c.steps.filter(s => s.status === 'ok' && s.detail).map(s => s.detail)
  return details.slice(0, 3).join(' · ')
}

// ── Journal : filtre + autoscroll ──
const logFilter = ref('ALL')
const follow = ref(true)
const logBox = ref<HTMLElement | null>(null)
const filteredLogs = computed(() => {
  if (logFilter.value === 'ALL') return system.logs
  return system.logs.filter(l => l.level === logFilter.value)
})
watch(() => system.logs.length, async () => {
  if (follow.value && logBox.value) {
    await nextTick()
    logBox.value.scrollTop = logBox.value.scrollHeight
  }
})
function logTime(ts: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function logLevelClass(level: string): string {
  switch ((level || '').toUpperCase()) {
    case 'ERROR': return 'text-danger font-semibold'
    case 'WARN': return 'text-warning'
    case 'SUCCESS': return 'text-accent'
    default: return 'text-info'
  }
}
function refreshSuivi() {
  system.fetchCycles()
  system.fetchLogs()
}

// ── Helpers ──
function humanize(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '?'
  if (seconds < 60) return `${Math.floor(seconds)} s`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ${m % 60} min`
  return `${Math.floor(h / 24)} j ${h % 24} h`
}
function relTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1970) return 'jamais'
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (s < 60) return `à l'instant`
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86_400) return `il y a ${Math.floor(s / 3600)} h`
  return `il y a ${Math.floor(s / 86_400)} j`
}
</script>
