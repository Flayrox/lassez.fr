<!-- Emploi du temps — hub du produit Signaux : le calendrier + un onglet par
     composant de la chaîne (Collecte, Anti-doublons, Orchestrateur, Tri,
     Écriture, Image) avec ses paramètres directement (Pipeline + Écriture
     fusionnés ici). Calendrier natif shadcn.
     - Pills-pipelines : bascule l'affichage, ▶ scan, ⚙ éditeur de planning inline.
     - Créneaux : tirer sur une case vide en crée un (09:00), glisser le déplace,
       le glisser vers la corbeille le supprime. Publications : glisser les reprogramme.
     - Section « Suivi » repliée (accordéon) : journal, cycles, agenda. -->
<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-lg font-semibold">Emploi du temps</h1>
      <p class="text-muted-foreground mt-0.5 text-xs">Quand chaque pipeline scanne et publie — et un onglet par composant de la chaîne pour régler chaque étape directement.</p>
    </div>

    <!-- La chaîne d'un coup d'œil : cliquer saute à l'onglet du composant -->
    <Card class="gap-0 py-0">
      <div class="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <template v-for="(n, i) in store.atelier" :key="n.type">
          <Button
            variant="ghost"
            size="xs"
            class="gap-1.5"
            :class="tab === tabOf(n.type) && tab !== 'calendrier' ? 'bg-muted text-foreground' : ''"
            :title="`Ouvrir les réglages de ${n.label}`"
            @click="tab = tabOf(n.type)"
          >
            <span class="size-1.5 rounded-full" :class="n.enabled ? 'bg-accent' : 'bg-border'"></span>
            {{ n.label }}
          </Button>
          <span v-if="i < store.atelier.length - 1" class="text-muted-foreground text-[11px]">→</span>
        </template>
      </div>
    </Card>

    <!-- Onglets : calendrier + chaque composant de la chaîne -->
    <Tabs v-model="tab" class="w-full">
      <TabsList class="flex h-auto w-full flex-wrap justify-start">
        <TabsTrigger value="calendrier">📅 Calendrier</TabsTrigger>
        <TabsTrigger value="ingestion">◉ Collecte</TabsTrigger>
        <TabsTrigger value="dedup">⬢ Anti-doublons</TabsTrigger>
        <TabsTrigger value="orchestrator">✸ Orchestrateur</TabsTrigger>
        <TabsTrigger value="research">✦ Tri</TabsTrigger>
        <TabsTrigger value="ecriture">✎ Écriture</TabsTrigger>
        <TabsTrigger value="media">◎ Image</TabsTrigger>
      </TabsList>

      <!-- ══ Calendrier ══ -->
      <TabsContent value="calendrier" class="space-y-4">
        <!-- Pills-pipelines : bascule + scan + éditeur de planning -->
        <div class="flex flex-wrap gap-2">
          <div
            v-for="p in pipelines"
            :key="p.id"
            class="flex h-8 items-center gap-0.5 rounded-full border pl-1 pr-1 transition-colors"
            :class="visible.has(p.id) ? 'border-accent/40 bg-accent/10' : 'border-border bg-card opacity-70'"
          >
            <Button
              variant="ghost"
              size="xs"
              class="gap-1.5 px-2"
              :title="`Afficher/masquer ${p.name} sur le calendrier`"
              @click="toggleVisible(p.id)"
            >
              <span class="size-2.5 shrink-0 rounded-full" :style="{ background: p.color }"></span>
              <span class="text-xs font-medium">{{ p.name }}</span>
              <span class="text-muted-foreground hidden font-mono text-[10px] sm:inline">{{ pipes.nextRunLabel(p) }}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              :title="`Lancer un scan sur ${p.name}`"
              @click="pipes.scan(p)"
            >
              <PlayIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              :title="`Réglages du planning de ${p.name}`"
              @click="toggleEditor(p.id)"
            >
              <SettingsIcon />
            </Button>
          </div>
        </div>

        <!-- Éditeur de planning inline (instance sélectionnée par ⚙) -->
        <Card v-if="editorId && editorPipeline" class="gap-0 py-3">
          <div class="flex flex-wrap items-center gap-4 px-4">
            <span class="size-2.5 shrink-0 rounded-full" :style="{ background: editorPipeline.color }"></span>
            <p class="text-sm font-medium">{{ editorPipeline.name }} — planning</p>
            <Select
              :model-value="sched(editorPipeline)?.mode"
              @update:model-value="(v: string) => setMode(editorPipeline, v)"
            >
              <SelectTrigger size="sm" class="w-64">
                <SelectValue placeholder="Mode de planification" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Mode de planification</SelectLabel>
                  <SelectItem value="hybrid">Hybride — intervalle + créneaux</SelectItem>
                  <SelectItem value="pulse">En continu — toutes les X minutes</SelectItem>
                  <SelectItem value="calendar">Calendrier strict — créneaux seuls</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <div v-if="sched(editorPipeline)?.mode !== 'calendar'" class="flex items-center gap-2">
              <span class="text-muted-foreground text-xs">Toutes les</span>
              <Input
                type="number"
                min="1"
                max="480"
                class="h-7 w-16"
                :model-value="sched(editorPipeline)?.intervalleMinutes"
                @update:model-value="(v) => setInterval(editorPipeline, Number(v))"
              />
              <span class="text-muted-foreground text-xs">min</span>
            </div>
            <span class="text-muted-foreground text-xs">{{ slotCount(editorPipeline) }} créneau{{ slotCount(editorPipeline) > 1 ? 'x' : '' }}</span>
            <Button variant="outline" size="sm" class="ml-auto" @click="editorId = null">Fermer</Button>
          </div>
        </Card>

        <!-- Calendrier natif shadcn -->
        <Card class="gap-0 overflow-hidden py-0">
          <!-- Barre d'outils : navigation + légende -->
          <div class="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <div class="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" title="Mois précédent" @click="prevMonth">
                <ChevronLeftIcon />
              </Button>
              <Button variant="outline" size="icon-sm" title="Mois suivant" @click="nextMonth">
                <ChevronRightIcon />
              </Button>
              <Button variant="outline" size="sm" @click="goToday">Aujourd'hui</Button>
            </div>
            <h2 class="text-sm font-semibold capitalize">{{ monthLabel }}</h2>
            <div class="ml-auto flex flex-wrap items-center gap-3">
              <span v-for="p in pipelines" :key="p.id" class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span class="size-2 rounded-full" :style="{ background: p.color }"></span>{{ p.name }}
              </span>
              <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span class="size-2 rounded-full" :style="{ background: 'var(--muted-foreground)' }"></span>Publications
              </span>
            </div>
          </div>

          <!-- Jours de la semaine -->
          <div class="bg-muted/20 grid grid-cols-7 border-b">
            <div v-for="d in DAY_LABELS" :key="d" class="py-1.5 text-center text-[11px] font-medium text-muted-foreground">
              {{ d }}
            </div>
          </div>

          <!-- Grille du mois -->
          <div class="grid grid-cols-7 select-none" :class="drag ? 'cursor-grabbing' : ''">
            <div
              v-for="cell in cells"
              :key="cell.key"
              :data-date="cell.key"
              class="group relative min-h-28 border-r border-b border-border p-1.5"
              :class="[
                !cell.inMonth ? 'bg-muted/10' : '',
                dropKey === cell.key ? 'bg-accent/10 ring-1 ring-accent ring-inset' : '',
              ]"
              @pointerdown="onCellDown(cell, $event)"
            >
              <div class="flex items-start justify-between">
                <span
                  class="flex size-6 items-center justify-center rounded-full text-xs font-medium"
                  :class="cell.isToday ? 'bg-primary text-primary-foreground' : cell.inMonth ? 'text-foreground' : 'text-muted-foreground/50'"
                >{{ cell.day }}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  class="opacity-0 transition-opacity group-hover:opacity-100"
                  :title="`Créer un créneau à 09:00 le ${cell.date.toLocaleDateString('fr-FR')}`"
                  @pointerdown.stop
                  @click.stop="createSlotAt(cell.date)"
                >
                  <PlusIcon />
                </Button>
              </div>

              <div class="mt-1 space-y-1">
                <div
                  v-for="ev in shownEvents(cell)"
                  :key="ev.id"
                  class="event-chip"
                  :class="ev.kind === 'pub' ? 'event-pub' : ''"
                  :style="ev.kind === 'slot' ? { background: ev.color, color: ev.fg } : undefined"
                  :title="ev.tooltip"
                  @pointerdown.stop="onEventDown(ev, $event)"
                >
                  <span class="event-time">{{ ev.timeLabel }}</span>
                  <span class="truncate">{{ ev.text }}</span>
                </div>
                <button
                  v-if="cell.events.length > MAX_CHIPS"
                  class="block w-full rounded px-1 py-0.5 text-left text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  @click="toggleExpanded(cell.key)"
                >
                  {{ expanded.has(cell.key) ? '− Réduire' : `+${cell.events.length - MAX_CHIPS} autres` }}
                </button>
              </div>
            </div>
          </div>
        </Card>

        <!-- Suivi replié (accordéon shadcn) -->
        <Card class="gap-0 py-0">
          <Accordion type="multiple" class="w-full">
            <AccordionItem value="suivi" class="border-0">
              <AccordionTrigger class="px-4 py-3">
                <span class="flex items-center gap-2">
                  <span class="text-sm font-medium">Suivi</span>
                  <Badge variant="secondary" class="font-mono text-[10px]">{{ system.cycles.length }} cycles · {{ system.orchestration.length }} décisions</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent class="px-4 pb-4">
                <div class="grid gap-4 lg:grid-cols-3">
                  <div class="min-w-0">
                    <p class="text-muted-foreground mb-2 text-[10px] font-medium tracking-wider uppercase">Journal</p>
                    <div class="max-h-64 space-y-1 overflow-y-auto pr-1">
                      <p v-for="(l, i) in system.logs.slice(0, 40)" :key="i" class="text-muted-foreground font-mono text-[10px] leading-snug">
                        <span class="opacity-70">{{ shortTs(l.ts) }}</span>
                        <span :class="levelCls(l.level)">{{ l.level }}</span>
                        <span class="opacity-70">[{{ l.node }}]</span> {{ l.message }}
                      </p>
                      <p v-if="!system.logs.length" class="text-muted-foreground text-xs">Aucune entrée pour l'instant.</p>
                    </div>
                  </div>
                  <div class="min-w-0">
                    <p class="text-muted-foreground mb-2 text-[10px] font-medium tracking-wider uppercase">Derniers cycles</p>
                    <div class="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                      <div v-for="c in system.cycles.slice(0, 10)" :key="c.id" class="rounded-lg border border-border px-2 py-1.5">
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-muted-foreground font-mono text-[10px]">{{ c.source }} #{{ c.id }}</span>
                          <span class="text-muted-foreground font-mono text-[10px]">{{ fmtDur(c.durationMs) }}</span>
                        </div>
                        <div class="mt-1 flex flex-wrap items-center gap-1">
                          <Badge
                            v-for="s in c.steps ?? []"
                            :key="s.type"
                            :variant="s.status === 'ok' ? 'secondary' : s.status === 'error' ? 'destructive' : 'outline'"
                            class="h-4 px-1 text-[9px] font-mono"
                            :title="s.label"
                          >{{ s.type }}</Badge>
                        </div>
                        <p v-if="c.error" class="text-destructive mt-1 truncate text-[10px]" :title="c.error">{{ c.error }}</p>
                      </div>
                      <p v-if="!system.cycles.length" class="text-muted-foreground text-xs">Aucun cycle pour l'instant.</p>
                    </div>
                  </div>
                  <div class="min-w-0">
                    <p class="text-muted-foreground mb-2 text-[10px] font-medium tracking-wider uppercase">Agenda de l'orchestrateur</p>
                    <div class="max-h-64 space-y-1 overflow-y-auto pr-1">
                      <div v-for="d in system.orchestration.slice(0, 15)" :key="d.id" class="rounded-lg border border-border px-2 py-1.5">
                        <div class="flex items-center justify-between gap-2">
                          <Badge
                            :variant="d.decision === 'keep' ? 'secondary' : 'outline'"
                            class="h-4 px-1 font-mono text-[9px]"
                            :class="d.decision === 'keep' ? 'border-accent/40 bg-accent/10 text-accent' : 'border-warning/40 bg-warning/10 text-warning'"
                          >{{ d.decision }}</Badge>
                          <span class="text-muted-foreground truncate font-mono text-[9px]">{{ d.taxonomy }} · {{ d.geo }}</span>
                        </div>
                        <p class="mt-1 truncate text-[10px]" :title="d.source_title">{{ d.source_title }}</p>
                        <p class="text-muted-foreground truncate text-[10px]" :title="d.reason">{{ d.reason }}</p>
                      </div>
                      <p v-if="!system.orchestration.length" class="text-muted-foreground text-xs">Aucune décision pour l'instant.</p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </TabsContent>

      <!-- ══ Composants de la chaîne : leurs paramètres directement ══ -->
      <TabsContent v-for="nt in NODE_TABS" :key="nt.key" :value="nt.key" class="space-y-4">
        <NodeSettings :node="nodeOf(nt.nodeType)" />
      </TabsContent>

      <!-- ══ Écriture : rédaction + vérification + consignes + formats + modèles ══ -->
      <TabsContent value="ecriture" class="space-y-4">
        <NodeSettings :node="nodeOf('editor')" />
        <NodeSettings :node="nodeOf('validator')" />
        <EcriturePanel />
      </TabsContent>
    </Tabs>

    <!-- Corbeille : apparaît pendant un drag pour supprimer un créneau -->
    <div v-if="drag" class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div
        data-trash
        class="pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur transition-colors"
        :class="overTrash ? 'border-destructive bg-destructive/20 text-destructive' : 'border-border bg-background/90 text-muted-foreground'"
      >
        <Trash2Icon class="size-4" />
        Glisser ici pour supprimer
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, PlusIcon, SettingsIcon, Trash2Icon } from '@lucide/vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import EcriturePanel from '../components/EcriturePanel.vue'
import NodeSettings from '../components/NodeSettings.vue'
import { useConfigStore, type PipelineInfo, type WeeklySlot } from '../stores/config'
import { usePipelinesStore } from '../stores/pipelines'
import { useSystemStore } from '../stores/system'
import { pipelineApiBase } from '../lib/api'

const cfg = useConfigStore()
const store = useConfigStore()
const pipes = usePipelinesStore()
const system = useSystemStore()

const today = ref(new Date())
const visible = ref<Set<string>>(new Set())
const editorId = ref<string | null>(null)
const expanded = ref<Set<string>>(new Set())
const tab = ref('calendrier')
let refreshTimer: ReturnType<typeof setInterval> | null = null

const pipelines = computed(() => cfg.pipelines.filter(p => p.enabled !== false))
const editorPipeline = computed(() => pipelines.value.find(p => p.id === editorId.value) ?? null)
const sched = (p: PipelineInfo) => pipes.schedules[p.id]
function slotCount(p: PipelineInfo) { return pipes.slotCount(p) }

// ── Onglets : chaque composant de la chaîne → son onglet de réglages ──
const NODE_TABS = [
  { key: 'ingestion', nodeType: 'ingestion' },
  { key: 'dedup', nodeType: 'dedup' },
  { key: 'orchestrator', nodeType: 'orchestrator' },
  { key: 'research', nodeType: 'research' },
  { key: 'media', nodeType: 'media' },
]
const TAB_BY_NODE: Record<string, string> = {
  ingestion: 'ingestion', dedup: 'dedup', orchestrator: 'orchestrator',
  research: 'research', editor: 'ecriture', validator: 'ecriture', media: 'media',
}
const tabOf = (nodeType: string) => TAB_BY_NODE[nodeType] ?? 'calendrier'
const nodeOf = (nodeType: string) => {
  const n = store.atelier.find(x => x.type === nodeType)
  return n ?? { type: nodeType, label: nodeType, desc: '', enabled: false }
}

// ── Pills : visibilité des calendriers par pipeline ──
function toggleVisible(id: string) {
  const next = new Set(visible.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  visible.value = next
}
function toggleEditor(id: string) {
  editorId.value = editorId.value === id ? null : id
}

// ── Calendrier natif : grille mensuelle (semaine lundi→dimanche) ──
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAY_INDEX: Record<string, number> = { DIM: 0, LUN: 1, MAR: 2, MER: 3, JEU: 4, VEN: 5, SAM: 6 }
const MAX_CHIPS = 3

function startOfDay(d: Date) { const o = new Date(d); o.setHours(0, 0, 0, 0); return o }
function addDays(d: Date, n: number) { const o = new Date(d); o.setDate(o.getDate() + n); return o }
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function sameDay(a: Date, b: Date) { return dateKey(a) === dateKey(b) }

const monthCursor = ref(startOfDay(new Date()))
const monthLabel = computed(() => monthCursor.value.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))

const gridStart = computed(() => {
  const first = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth(), 1)
  return addDays(first, -((first.getDay() + 6) % 7)) // lundi de la semaine du 1er
})
const gridEnd = computed(() => addDays(gridStart.value, 41))

function prevMonth() { monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() - 1, 1); expanded.value = new Set() }
function nextMonth() { monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + 1, 1); expanded.value = new Set() }
function goToday() { monthCursor.value = startOfDay(new Date()); expanded.value = new Set() }

interface CalEvent {
  id: string
  key: string
  kind: 'slot' | 'pub'
  pipelineId: string
  timeLabel: string
  text: string
  tooltip: string
  color: string
  fg: string
  date: Date
  day?: string
  time?: string
  pubId?: number
}

interface Cell {
  key: string
  date: Date
  day: number
  inMonth: boolean
  isToday: boolean
  events: CalEvent[]
}

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

function pubLabel(pub: any): string {
  let title = ''
  try {
    const sig = JSON.parse(pub.signal ?? '{}')
    title = sig?.headline ?? sig?.title ?? ''
  } catch { /* pas de signal embarqué */ }
  const plat = String(pub.platform ?? '').toUpperCase()
  const head = title ? ` — ${title.slice(0, 48)}` : ''
  return `${pub.pipelineName} · ${plat}${head}`
}

const eventsByDay = computed(() => {
  const map = new Map<string, CalEvent[]>()
  const push = (ev: CalEvent) => {
    const arr = map.get(ev.key) ?? []
    arr.push(ev)
    map.set(ev.key, arr)
  }
  const fmt = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  for (const p of pipelines.value) {
    if (!visible.value.has(p.id)) continue
    const s = sched(p)
    if (!s) continue
    for (const slot of s.weeklySlots ?? []) {
      const [h, m] = String(slot.time ?? '08:00').split(':').map(Number)
      for (const d of occurrences(slot.day, gridStart.value, gridEnd.value)) {
        const st = new Date(d); st.setHours(h, m, 0, 0)
        push({
          id: `slot-${p.id}-${slot.day}-${slot.time}-${st.getTime()}`,
          key: dateKey(d), kind: 'slot', pipelineId: p.id,
          timeLabel: fmt(st), text: p.name,
          tooltip: `${p.name} — scan à ${fmt(st)} (tous les ${slot.day.toLowerCase()})`,
          color: p.color, fg: '#101010', date: d,
          day: slot.day, time: slot.time,
        })
      }
    }
  }
  for (const pub of pipes.publications) {
    const d = new Date(pub.scheduled_at)
    if (isNaN(d.getTime())) continue
    if (d < gridStart.value || d > gridEnd.value) continue
    const label = pubLabel(pub)
    push({
      id: `pub-${pub.pipelineId}-${pub.id}`,
      key: dateKey(d), kind: 'pub', pipelineId: pub.pipelineId,
      timeLabel: fmt(d), text: label.slice(0, 40),
      tooltip: label,
      color: 'var(--muted-foreground)', fg: 'var(--background)', date: d,
      pubId: pub.id,
    })
  }
  for (const arr of map.values()) arr.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel))
  return map
})

const cells = computed<Cell[]>(() => {
  const out: Cell[] = []
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart.value, i)
    out.push({
      key: dateKey(date),
      date,
      day: date.getDate(),
      inMonth: date.getMonth() === monthCursor.value.getMonth(),
      isToday: sameDay(date, today.value),
      events: eventsByDay.value.get(dateKey(date)) ?? [],
    })
  }
  return out
})

function shownEvents(cell: Cell) {
  return expanded.value.has(cell.key) ? cell.events : cell.events.slice(0, MAX_CHIPS)
}
function toggleExpanded(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key); else next.add(key)
  expanded.value = next
}

// ── Drag & drop : créer / déplacer / supprimer ──
type DragState =
  | { type: 'create'; fromKey: string }
  | { type: 'move'; ev: CalEvent }
  | null

const drag = ref<DragState>(null)
const dragStart = ref<{ x: number; y: number } | null>(null)
const dropKey = ref<string | null>(null)
const overTrash = ref(false)

function onCellDown(cell: Cell, e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  drag.value = { type: 'create', fromKey: cell.key }
  dragStart.value = { x: e.clientX, y: e.clientY }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragUp)
}

function onEventDown(ev: CalEvent, e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  drag.value = { type: 'move', ev }
  dragStart.value = { x: e.clientX, y: e.clientY }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragUp)
}

function onDragMove(e: PointerEvent) {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const cellEl = el?.closest?.('[data-date]') as HTMLElement | null
  dropKey.value = cellEl?.dataset.date ?? null
  overTrash.value = !!el?.closest?.('[data-trash]')
}

async function onDragUp(e: PointerEvent) {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
  const st = drag.value
  const moved = dragStart.value && Math.hypot(e.clientX - dragStart.value.x, e.clientY - dragStart.value.y) > 5
  drag.value = null
  dragStart.value = null
  if (!st) return

  if (st.type === 'create') {
    if (moved && dropKey.value) await createSlotAt(parseKey(dropKey.value))
  } else {
    if (overTrash.value) {
      if (st.ev.kind === 'slot') await persistDeleteSlot(st.ev)
    } else if (dropKey.value && dropKey.value !== st.ev.key) {
      await persistMoveEvent(st.ev, parseKey(dropKey.value))
    }
  }
  dropKey.value = null
  overTrash.value = false
}

// ── Persistance : créneaux (weeklySlots) + publications (PATCH) ──
function toSlot(d: Date): WeeklySlot | null {
  const day = Object.keys(DAY_INDEX).find(k => DAY_INDEX[k] === d.getDay()) ?? null
  if (!day) return null
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return { day, time: `${hh}:${mm}` }
}

async function createSlotAt(d: Date) {
  const at = startOfDay(d); at.setHours(9, 0, 0, 0)
  const slot = toSlot(at)
  if (!slot) return
  // Le créneau est créé sur le pipeline actif (sélecteur en topbar).
  const pid = cfg.activePipelineId ?? pipelines.value[0]?.id
  if (!pid) return
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  if (cur.some(s => s.day === slot.day && s.time === slot.time)) return
  await patchConfig(pid, { scheduling: { weeklySlots: [...cur, slot] } })
}

async function persistMoveEvent(ev: CalEvent, target: Date) {
  if (ev.kind === 'pub') {
    const orig = ev.date
    const at = startOfDay(target)
    at.setHours(orig.getHours(), orig.getMinutes(), 0, 0)
    const p = pipelines.value.find(x => x.id === ev.pipelineId)
    if (!p) return
    try {
      await fetch(pipelineApiBase(p.port) + '/api/publications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(ev.pubId), scheduled_at: at.toISOString() }),
      })
    } catch { /* instance injoignable */ }
    pipes.refresh(true)
    return
  }
  const pid = ev.pipelineId
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  const next = cur.filter(s => !(s.day === ev.day && s.time === ev.time))
  const targetDay = Object.keys(DAY_INDEX).find(k => DAY_INDEX[k] === target.getDay()) ?? null
  if (targetDay && !next.some(s => s.day === targetDay && s.time === ev.time)) {
    next.push({ day: targetDay, time: ev.time! })
  }
  await patchConfig(pid, { scheduling: { weeklySlots: next } })
}

async function persistDeleteSlot(ev: CalEvent) {
  const pid = ev.pipelineId
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  await patchConfig(pid, { scheduling: { weeklySlots: cur.filter(s => !(s.day === ev.day && s.time === ev.time)) } })
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
  if (l === 'error') return 'text-destructive'
  if (l === 'warn' || l === 'warning') return 'text-warning'
  return 'text-accent'
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
/* Puces d'événements du calendrier natif. */
.event-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 5px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.5;
  cursor: grab;
  user-select: none;
}
.event-chip:active {
  cursor: grabbing;
}
.event-time {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  opacity: 0.75;
}
.event-pub {
  background: var(--muted-foreground);
  color: var(--background);
}
</style>
