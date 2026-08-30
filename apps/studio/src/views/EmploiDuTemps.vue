<!-- Emploi du temps — accueil du produit Signaux : le calendrier de tous les
     pipelines (scans) + publications planifiées. Tout tourne autour de lui.
     - Pills-pipelines : bascule l'affichage, ▶ scan par instance, ⚙ éditeur de planning inline.
     - Glisser un créneau le déplace, tirer sur une case vide en crée un, la
       corbeille de l'éditeur le supprime (scheduling.weeklySlots de l'instance).
     - Glisser une publication la reprogramme (PATCH /api/publications).
     - Section « Suivi » repliée : journal, derniers cycles, agenda de l'orchestrateur. -->
<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-lg font-semibold">Emploi du temps</h1>
      <p class="text-xs text-text-3 mt-0.5">Quand chaque pipeline scanne et publie — glisse pour déplacer, tire sur une case vide pour créer, reprogramme une publication en la glissant.</p>
    </div>

    <!-- Pills-pipelines : bascule + scan + éditeur de planning -->
    <div class="flex flex-wrap gap-2">
      <div
        v-for="p in pipelines"
        :key="p.id"
        class="flex items-center gap-1 h-8 pl-1 pr-1.5 rounded-lg border transition-colors"
        :class="visible.has(p.id) ? 'border-accent/40 bg-accent-muted/40' : 'border-border bg-surface opacity-70'"
      >
        <button
          @click="toggleVisible(p.id)"
          class="flex items-center gap-2 h-full pl-1.5 pr-2 text-left"
          :title="`Afficher/masquer ${p.name} sur le calendrier`"
        >
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: p.color }"></span>
          <span class="text-xs font-medium text-text-1">{{ p.name }}</span>
          <span class="text-[10px] text-text-3 font-mono hidden sm:inline">{{ pipes.nextRunLabel(p) }}</span>
        </button>
        <button
          @click="pipes.scan(p)"
          class="w-6 h-6 flex items-center justify-center rounded text-[11px] text-text-2 hover:text-accent hover:bg-surface-hover transition-colors"
          :title="`Lancer un scan sur ${p.name}`"
        >▶</button>
        <button
          @click="toggleEditor(p.id)"
          class="w-6 h-6 flex items-center justify-center rounded text-[11px] text-text-2 hover:text-accent hover:bg-surface-hover transition-colors"
          :title="`Réglages du planning de ${p.name}`"
        >⚙</button>
      </div>
    </div>

    <!-- Éditeur de planning inline (instance sélectionnée par ⚙) -->
    <LCard v-if="editorId && editorPipeline">
      <div class="flex flex-wrap items-center gap-4">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: editorPipeline.color }"></span>
        <p class="text-sm font-medium text-text-1">{{ editorPipeline.name }} — planning</p>
        <select
          :value="sched(editorPipeline)?.mode"
          @change="setMode(editorPipeline, ($event.target as HTMLSelectElement).value)"
          class="h-7 bg-bg border border-border rounded px-2 text-[11px] focus:outline-none focus:border-accent/60 text-text-2"
        >
          <option value="hybrid">Hybride — intervalle + créneaux</option>
          <option value="pulse">En continu — toutes les X minutes</option>
          <option value="calendar">Calendrier strict — créneaux seuls</option>
        </select>
        <div v-if="sched(editorPipeline)?.mode !== 'calendar'" class="flex items-center gap-2">
          <span class="text-[11px] text-text-3">Toutes les</span>
          <input
            type="number" min="1" max="480"
            :value="sched(editorPipeline)?.intervalleMinutes"
            @change="setInterval(editorPipeline, Number(($event.target as HTMLInputElement).value))"
            class="h-7 w-16 bg-bg border border-border rounded px-2 text-[11px] focus:outline-none focus:border-accent/60"
          />
          <span class="text-[11px] text-text-3">min</span>
        </div>
        <span class="text-[11px] text-text-3">{{ slotCount(editorPipeline) }} créneau{{ slotCount(editorPipeline) > 1 ? 'x' : '' }}</span>
        <button
          @click="editorId = null"
          class="ml-auto h-7 px-2 rounded border border-border text-[11px] text-text-3 hover:text-text-1 hover:border-text-3/50 transition-colors"
        >Fermer</button>
      </div>
    </LCard>

    <!-- Calendrier SVAR (pleine largeur — tout tourne autour de lui) -->
    <LCard :padding="false">
      <div class="emploi-calendar p-2">
        <WillowDark :fonts="false">
          <Calendar
            :init="initCal"
            :events="events"
            :view="view"
            :date="today"
            :eventClass="eventClass"
          >
            <CalendarPanel :calendars="panelCalendars" />
          </Calendar>
          <Editor v-if="calApi" :api="calApi" />
        </WillowDark>
      </div>
    </LCard>

    <!-- Suivi replié : journal + cycles + agenda de l'orchestrateur (pipeline actif) -->
    <LCard>
      <button
        @click="suiviOpen = !suiviOpen"
        class="w-full flex items-center justify-between text-left"
      >
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-text-1">Suivi</span>
          <span class="text-[10px] font-mono text-text-3">{{ system.cycles.length }} cycles · {{ system.orchestration.length }} décisions</span>
        </div>
        <span class="text-text-3 text-xs transition-transform" :class="suiviOpen ? 'rotate-180' : ''">▾</span>
      </button>

      <div v-if="suiviOpen" class="grid lg:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
        <!-- Journal -->
        <div class="min-w-0">
          <p class="text-[10px] font-medium uppercase tracking-wider text-text-3 mb-2">Journal</p>
          <div class="space-y-1 max-h-64 overflow-y-auto pr-1">
            <p v-for="(l, i) in system.logs.slice(0, 40)" :key="i" class="text-[10px] font-mono leading-snug text-text-2">
              <span class="text-text-3">{{ shortTs(l.ts) }}</span>
              <span :class="levelCls(l.level)">{{ l.level }}</span>
              <span class="text-text-3">[{{ l.node }}]</span> {{ l.message }}
            </p>
            <p v-if="!system.logs.length" class="text-[11px] text-text-3">Aucune entrée pour l'instant.</p>
          </div>
        </div>
        <!-- Derniers cycles -->
        <div class="min-w-0">
          <p class="text-[10px] font-medium uppercase tracking-wider text-text-3 mb-2">Derniers cycles</p>
          <div class="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            <div v-for="c in system.cycles.slice(0, 10)" :key="c.id" class="rounded border border-border px-2 py-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] font-mono text-text-2">{{ c.source }} #{{ c.id }}</span>
                <span class="text-[10px] font-mono text-text-3">{{ fmtDur(c.durationMs) }}</span>
              </div>
              <div class="flex items-center gap-1 mt-1 flex-wrap">
                <span
                  v-for="s in c.steps ?? []"
                  :key="s.type"
                  class="text-[9px] px-1 py-0.5 rounded border"
                  :class="stepCls(s.status)"
                  :title="s.label"
                >{{ s.type }}</span>
              </div>
              <p v-if="c.error" class="text-[10px] text-danger mt-1 truncate" :title="c.error">{{ c.error }}</p>
            </div>
            <p v-if="!system.cycles.length" class="text-[11px] text-text-3">Aucun cycle pour l'instant.</p>
          </div>
        </div>
        <!-- Agenda de l'orchestrateur -->
        <div class="min-w-0">
          <p class="text-[10px] font-medium uppercase tracking-wider text-text-3 mb-2">Agenda de l'orchestrateur</p>
          <div class="space-y-1 max-h-64 overflow-y-auto pr-1">
            <div
              v-for="d in system.orchestration.slice(0, 15)"
              :key="d.id"
              class="rounded border border-border px-2 py-1.5"
            >
              <div class="flex items-center justify-between gap-2">
                <span
                  class="text-[9px] px-1 py-0.5 rounded font-mono"
                  :class="d.decision === 'keep' ? 'bg-accent-muted text-accent' : 'bg-warning/10 text-warning'"
                >{{ d.decision }}</span>
                <span class="text-[9px] font-mono text-text-3 truncate">{{ d.taxonomy }} · {{ d.geo }}</span>
              </div>
              <p class="text-[10px] text-text-1 mt-1 truncate" :title="d.source_title">{{ d.source_title }}</p>
              <p class="text-[10px] text-text-3 truncate" :title="d.reason">{{ d.reason }}</p>
            </div>
            <p v-if="!system.orchestration.length" class="text-[11px] text-text-3">Aucune décision pour l'instant.</p>
          </div>
        </div>
      </div>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import { Calendar, CalendarPanel, Editor, WillowDark } from '@svar-ui/vue-calendar'
import { locale } from '@svar-ui/lib-dom'
import { fr as frCalendar } from '@svar-ui/calendar-locales'
import { fr as frCore } from '@svar-ui/core-locales'
import { useConfigStore, type PipelineInfo, type WeeklySlot } from '../stores/config'
import { usePipelinesStore } from '../stores/pipelines'
import { useSystemStore } from '../stores/system'
import { pipelineApiBase } from '../lib/api'
import LCard from '../components/ui/LCard.vue'

const cfg = useConfigStore()

// Locale française : le calendrier SVAR ne fournit son i18n (clé « wx-i18n »)
// que s'il n'existe pas déjà — on fournit donc nous-mêmes les mots FR (éditeur
// = calendar-locales, calendrier/formats = core-locales).
provide('wx-i18n', locale({ ...frCalendar, ...frCore }))
const pipes = usePipelinesStore()
const system = useSystemStore()

const view = ref('month')
const today = ref(new Date())
const calApi = ref<any>(null)
const visible = ref<Set<string>>(new Set())
const editorId = ref<string | null>(null)
const suiviOpen = ref(false)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const pipelines = computed(() => cfg.pipelines.filter(p => p.enabled !== false))
const editorPipeline = computed(() => pipelines.value.find(p => p.id === editorId.value) ?? null)
const sched = (p: PipelineInfo) => pipes.schedules[p.id]
function slotCount(p: PipelineInfo) { return pipes.slotCount(p) }

// ── Pills : visibilité des calendriers par pipeline ──
function toggleVisible(id: string) {
  const next = new Set(visible.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  visible.value = next
}
function toggleEditor(id: string) {
  editorId.value = editorId.value === id ? null : id
}

const panelCalendars = computed(() => [
  ...pipelines.value.map(p => ({ id: p.id, label: p.name, css: `cal-${p.id}`, active: visible.value.has(p.id) })),
  { id: 'publications', label: 'Publications', css: 'cal-publications', active: true },
])

// ── Événements du calendrier (créneaux + publications) ──
const DAY_INDEX: Record<string, number> = { DIM: 0, LUN: 1, MAR: 2, MER: 3, JEU: 4, VEN: 5, SAM: 6 }

function addDays(d: Date, n: number) {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}
function startOfDay(d: Date) { const o = new Date(d); o.setHours(0, 0, 0, 0); return o }

function occurrences(day: string, start: Date, end: Date): Date[] {
  const out: Date[] = []
  const target = DAY_INDEX[day] ?? -1
  if (target < 0) return out
  const d = new Date(start)
  while (d <= end) {
    if (d.getDay() === target) out.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

const events = computed(() => {
  const out: any[] = []
  const start = addDays(startOfDay(today.value), -3)
  const end = addDays(start, 48)
  for (const p of pipelines.value) {
    const s = sched(p)
    if (!s) continue
    for (const slot of s.weeklySlots ?? []) {
      const [h, m] = String(slot.time ?? '08:00').split(':').map(Number)
      for (const d of occurrences(slot.day, start, end)) {
        const st = new Date(d); st.setHours(h, m, 0, 0)
        const en = new Date(st); en.setMinutes(en.getMinutes() + 30)
        out.push({
          id: `slot-${p.id}-${slot.day}-${slot.time}-${st.getTime()}`,
          start: st, end: en, text: p.name,
          calendarId: p.id, kind: 'slot', pipelineId: p.id, day: slot.day, time: slot.time,
        })
      }
    }
  }
  for (const pub of pipes.publications) {
    const d = new Date(pub.scheduled_at)
    if (!isNaN(d.getTime()) && d >= start && d <= end) {
      const en = new Date(d); en.setMinutes(en.getMinutes() + 15)
      out.push({
        id: `pub-${pub.pipelineId}-${pub.id}`,
        start: d, end: en, text: pubLabel(pub),
        calendarId: 'publications', kind: 'pub', pipelineId: pub.pipelineId, pubId: pub.id,
      })
    }
  }
  return out
})

function pubLabel(pub: any): string {
  let title = ''
  try {
    const sig = JSON.parse(pub.signal ?? '{}')
    title = sig?.headline ?? sig?.title ?? ''
  } catch { /* pas de signal embarqué */ }
  const plat = String(pub.platform ?? '').toUpperCase()
  const head = title ? ` — ${title.slice(0, 60)}` : ''
  return `${pub.pipelineName} · ${plat}${head}`
}

function eventClass(e: any) {
  const id = e.calendarId ?? e.event?.calendarId
  return id === 'publications' ? 'cal-publications' : `cal-${id}`
}

// ── Édition : créer / déplacer / supprimer (créneaux) + reprogrammer (publications) ──
function initCal(api: any) {
  calApi.value = api
  api.on('add-event', (e: any) => { persistCreate(e) })
  api.on('update-event', (e: any) => { persistMove(e) })
  api.on('delete-event', (e: any) => { persistDelete(e) })
}

async function persistCreate(e: any) {
  const ev = e?.event ?? e
  const pid = ev?.calendarId
  if (!pid || pid === 'publications' || !sched({ id: pid } as any)) return
  const st = ev?.start ? new Date(ev.start) : null
  if (!st) return
  const slot = toSlot(st)
  if (!slot) return
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  if (cur.some(s => s.day === slot.day && s.time === slot.time)) return
  await patchConfig(pid, { scheduling: { weeklySlots: [...cur, slot] } })
}

async function persistMove(e: any) {
  const ev = e?.event ?? e
  if (!ev?.start) return
  // Publication → reprogrammation (PATCH /api/publications sur l'instance).
  if (ev.kind === 'pub') {
    const st = new Date(ev.start)
    if (isNaN(st.getTime())) return
    const p = pipelines.value.find(x => x.id === ev.pipelineId)
    if (!p) return
    try {
      await fetch(pipelineApiBase(p.port) + '/api/publications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(ev.pubId), scheduled_at: st.toISOString() }),
      })
    } catch { /* instance injoignable */ }
    pipes.refresh(true)
    return
  }
  // Créneau → déplacement dans weeklySlots.
  if (ev.kind !== 'slot') return
  const pid = ev.pipelineId
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  const next = cur.filter(s => !(s.day === ev.day && s.time === ev.time))
  const slot = toSlot(new Date(ev.start))
  if (slot && !next.some(s => s.day === slot.day && s.time === slot.time)) next.push(slot)
  await patchConfig(pid, { scheduling: { weeklySlots: next } })
}

async function persistDelete(e: any) {
  const ev = e?.event ?? e
  if (ev.kind !== 'slot') return
  const pid = ev.pipelineId
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  await patchConfig(pid, { scheduling: { weeklySlots: cur.filter(s => !(s.day === ev.day && s.time === ev.time)) } })
}

function toSlot(d: Date): WeeklySlot | null {
  const day = Object.keys(DAY_INDEX).find(k => DAY_INDEX[k] === d.getDay()) ?? null
  if (!day) return null
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return { day, time: `${hh}:${mm}` }
}

async function patchConfig(pid: string, patch: any) {
  const p = cfg.pipelines.find(x => x.id === pid)
  if (!p) return
  try {
    await fetch(pipelineApiBase(p.port) + '/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  } catch { /* instance injoignable */ }
  pipes.refresh(true)
}

async function setMode(p: PipelineInfo, mode: string) {
  if (pipes.schedules[p.id]) pipes.schedules[p.id].mode = mode as any
  await patchConfig(p.id, { scheduling: { mode } })
}

async function setInterval(p: PipelineInfo, minutes: number) {
  if (!minutes || minutes < 1) return
  if (pipes.schedules[p.id]) pipes.schedules[p.id].intervalleMinutes = minutes
  await patchConfig(p.id, { scheduling: { scrapingIntervalMinutes: minutes } })
}

// ── Suivi : journal, cycles, agenda (pipeline actif) ──
function shortTs(ts: string) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDur(ms?: number) {
  if (ms == null) return ''
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}
function levelCls(level: string) {
  const l = String(level).toLowerCase()
  if (l === 'error') return 'text-danger'
  if (l === 'warn' || l === 'warning') return 'text-warning'
  return 'text-accent'
}
function stepCls(status: string) {
  if (status === 'ok') return 'border-accent/40 text-accent bg-accent-muted'
  if (status === 'error') return 'border-danger/40 text-danger bg-danger/10'
  return 'border-border text-text-3'
}

async function refreshAll() {
  today.value = new Date()
  await Promise.all([pipes.refresh(), system.fetchCycles(), system.fetchLogs(), system.fetchOrchestration()])
}

onMounted(async () => {
  if (cfg.pipelines.length === 0) await cfg.loadPipelines()
  visible.value = new Set(pipelines.value.map(p => p.id))
  await refreshAll()
  refreshTimer = setInterval(refreshAll, 60_000)
})
onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer) })
</script>

<style>
/* Thème SVAR aligné sur le studio sombre — scope sur .emploi-calendar pour
   ne pas fuir sur les autres widgets de la page. */
.emploi-calendar {
  --wx-background: var(--surface);
  --wx-background-alt: var(--bg);
  --wx-background-hover: var(--surface-hover);
  --wx-border: 1px solid var(--border);
  --wx-border-radius: var(--radius);
  --wx-color-primary: var(--accent);
  --wx-color-font: var(--text-1);
  --wx-color-font-alt: var(--text-3);
  --wx-color-link: var(--accent);
  --wx-color-danger: var(--danger);
  --wx-calendar-grid-color: var(--border);
  --wx-calendar-weekend-background: rgba(255, 255, 255, 0.02);
  --wx-calendar-y-scale-width: 56px;
}
.emploi-calendar .wx-calendar { min-height: 520px; }
.emploi-calendar .wx-navigation { border-color: var(--border); }

/* Couleurs par pipeline (événements + légende du panneau) */
.emploi-calendar .cal-publications.wx-box-event,
.emploi-calendar .cal-publications.wx-bar-event,
.emploi-calendar .cal-publications.wx-calendar-name {
  background-color: #3f3f46;
  color: var(--text-1);
}
.emploi-calendar .cal-principal.wx-box-event,
.emploi-calendar .cal-principal.wx-bar-event,
.emploi-calendar .cal-principal.wx-calendar-name {
  background-color: #F59E0B;
  color: #1a1205;
}
.emploi-calendar .cal-flash.wx-box-event,
.emploi-calendar .cal-flash.wx-bar-event,
.emploi-calendar .cal-flash.wx-calendar-name {
  background-color: #3B82F6;
  color: #08111f;
}
</style>
