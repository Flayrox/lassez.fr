<!-- CalendarView — vue Semaine + Mois pour le planning de diffusion.
     Même modèle de données inchangé : weeklySlots[{day, time}].
     Interactions : drag-créer (semaine), presets, résumé temps réel. -->
<template>
  <div class="space-y-3">
    <!-- Barre d'outils -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex bg-bg border border-border rounded overflow-hidden">
        <button @click="view = 'week'" class="px-3 h-7 text-[11px] font-medium transition-colors" :class="view === 'week' ? 'bg-surface-hover text-text-1' : 'text-text-3 hover:text-text-2'">Semaine</button>
        <button @click="view = 'month'" class="px-3 h-7 text-[11px] font-medium transition-colors" :class="view === 'month' ? 'bg-surface-hover text-text-1' : 'text-text-3 hover:text-text-2'">Mois</button>
      </div>
      <div class="flex items-center gap-1 bg-bg border border-border rounded overflow-hidden">
        <button @click="prev" class="px-2 h-7 text-xs text-text-2 hover:text-text-1 transition-colors" title="Précédent">◀</button>
        <span class="text-[11px] font-medium text-text-1 px-2 tabular-nums">{{ navLabel }}</span>
        <button @click="next" class="px-2 h-7 text-xs text-text-2 hover:text-text-1 transition-colors" title="Suivant">▶</button>
      </div>
      <button @click="goToday" class="px-2.5 h-7 text-[11px] border border-border rounded text-text-2 hover:text-text-1 hover:bg-surface-hover transition-colors">Aujourd'hui</button>
      <span class="text-[11px] text-text-3 ml-auto">{{ store.planning.weeklySlots.length }} créneau{{ store.planning.weeklySlots.length > 1 ? 'x' : '' }}</span>
    </div>

    <!-- Presets -->
    <div class="flex flex-wrap gap-1.5">
      <button v-for="p in presets" :key="p.label" @click="applyPreset(p)" class="px-2 h-6 text-[10px] rounded border border-border text-text-3 hover:text-text-1 hover:bg-surface-hover transition-colors">{{ p.label }}</button>
    </div>

    <!-- Vue Semaine -->
    <div v-if="view === 'week'" class="border border-border rounded-card bg-bg overflow-hidden select-none">
      <!-- En-tête jours -->
      <div class="flex border-b border-border bg-surface-hover/30 sticky top-0 z-10">
        <div class="w-14 shrink-0"></div>
        <div v-for="d in displayDays" :key="d.key" class="flex-1 text-center py-2 border-r border-border/30 last:border-r-0">
          <p class="text-[10px] text-text-3 uppercase tracking-wider">{{ d.short }}</p>
          <p class="text-[11px] font-medium text-text-1 mt-0.5">{{ d.date }}</p>
        </div>
      </div>
      <!-- Grille 24h -->
      <div class="max-h-[480px] overflow-y-auto relative" ref="gridRef">
        <div v-for="h in 24" :key="h" class="flex border-b border-border/20 last:border-b-0 group" :style="{ height: hourPx + 'px' }">
          <div class="w-14 shrink-0 border-r border-border/30 flex items-start justify-center pt-0.5 sticky left-0 bg-bg z-10">
            <span class="text-[10px] font-mono text-text-3 group-hover:text-text-1 leading-tight">
              {{ String(h - 1).padStart(2, '0') }}:00
            </span>
          </div>
          <div v-for="d in displayDays" :key="d.key"
            @mousedown.prevent="startDrag(d.key, h - 1)"
            @mouseenter="onDragOver(d.key, h - 1)"
            class="flex-1 border-r border-border/20 last:border-r-0 relative cursor-crosshair"
            :class="h > 8 && h < 21 ? '' : 'bg-surface-hover/20'">
            <!-- Pilules (créneaux existants) -->
            <template v-for="s in slotsAtHour(d.key, h - 1)" :key="s.day + s.time">
              <div
                class="absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 bg-accent text-accent-fg text-[9px] font-medium leading-tight cursor-grab z-20 overflow-hidden"
                :style="slotStyle(s)"
                @mousedown.stop.prevent
                @click="editSlot = s; editTime = s.time"
                title="Cliquer pour éditer — ✕ pour supprimer"
              >
                {{ s.time.slice(0, 5) }}
                <button @click.stop="removeSlot(s)" class="float-right opacity-60 hover:opacity-100 ml-1">✕</button>
              </div>
            </template>
            <!-- Drag actif -->
            <div v-if="dragStart && dragStart.day === d.key && isDragOver(d.key, h - 1)"
              class="absolute left-0.5 right-0.5 bg-accent-muted border border-accent/30 rounded -z-10"
              :style="dragRect(d.key, h - 1)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Vue Mois -->
    <div v-else class="grid grid-cols-7 border border-border rounded-card bg-bg overflow-hidden select-none">
      <div v-for="d in dayOrder" :key="d" class="text-center py-1.5 text-[10px] uppercase tracking-wider text-text-3 border-b border-r border-border/30">{{ d.slice(0, 2) }}</div>
      <div v-for="(cell, i) in monthCells" :key="i"
        class="min-h-[52px] p-1 border-r border-b border-border/20 text-xs cursor-pointer hover:bg-surface-hover transition-colors relative"
        :class="cell.outOfMonth ? 'opacity-30' : ''"
        @click="cell.day ? navigateToWeek(cell.day) : null"
        :title="cell.day ? `${cell.day} — ${slotsForDay(cell.day).length} créneau(x)` : ''">
        <span class="text-[10px] font-medium" :class="cell.isToday ? 'text-accent' : 'text-text-2'">{{ cell.date }}</span>
        <div class="flex flex-wrap gap-0.5 mt-0.5">
          <span v-for="s in (cell.day ? slotsForDay(cell.day) : [])" :key="s.time"
            class="w-1.5 h-1.5 rounded-full bg-accent" :title="s.time" />
        </div>
      </div>
    </div>

    <!-- Éditeur inline (quand un créneau est sélectionné) -->
    <div v-if="editSlot" class="bg-surface border border-border rounded-card p-3 flex items-center gap-3">
      <span class="text-xs text-text-2">{{ editSlot.day }} à</span>
      <input type="time" v-model="editTime" @input="applyEdit" class="h-8 bg-bg border border-border rounded px-2 text-xs focus:outline-none focus:border-accent/60" />
      <span class="text-[10px] text-text-3">{{ store.planning.weeklySlots.length }} créneaux au total</span>
    </div>

    <!-- Résumé -->
    <LCard>
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-text-1">{{ summary }}</p>
        <span class="text-[10px] text-text-3 shrink-0">{{ store.planning.mode === 'hybrid' ? `+ toutes les ${store.planning.intervalleMinutes} min` : '' }}</span>
      </div>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfigStore, type WeeklySlot } from '../stores/config'
import LCard from './ui/LCard.vue'

const DAYS_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']
const dayOrder: string[] = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']

const store = useConfigStore()
const view = ref<'week' | 'month'>('week')
const weekOffset = ref(0) // 0 = cette semaine, -1 = semaine précédente, etc.
const monthOffset = ref(0)
const hourPx = 52 // hauteur d'une heure en px
const editSlot = ref<WeeklySlot | null>(null)
const editTime = ref('')
const gridRef = ref<HTMLElement | null>(null)

// ── Navigation ──
const baseDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + weekOffset.value * 7)
  return d
})

function prev() { view.value === 'week' ? weekOffset.value-- : monthOffset.value-- }
function next() { view.value === 'week' ? weekOffset.value++ : monthOffset.value++ }
function goToday() { weekOffset.value = 0; monthOffset.value = 0 }
function navigateToWeek(isoDay: string) {
  view.value = 'week'
  const target = new Date()
  const idx = DAYS_FR.indexOf(isoDay)
  if (idx >= 0) {
    const diff = idx - target.getDay() // Sunday=0 in JS, but DAYS_FR starts with DIM
    const jsDay = target.getDay()
    const targetJS = idx // DIM=0..SAM=6 in DAYS_FR
    const currentJS = jsDay // 0=Sun..6=Sat
    let daysToAdd = targetJS - currentJS
    if (daysToAdd >= 0) weekOffset.value = Math.round((baseDate.value.getTime() - target.getTime() + daysToAdd * 86400000) / 604800000)
  }
  // simpler: set baseDate so that the given day matches
  const now = new Date()
  const jsTarget = DAYS_FR.indexOf(isoDay) // 0=DIM..6=SAM
  const todayJS = now.getDay() // 0=Sun..6=Sat
  let diff = jsTarget - todayJS
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + diff)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  weekOffset.value = Math.round((targetDate.getTime() - today.getTime()) / 604800000)
}

const navLabel = computed(() => {
  if (view.value === 'week') {
    const start = weekStart()
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return fmtDate(start) + ' – ' + fmtDate(end)
  }
  const d = new Date()
  d.setMonth(d.getMonth() + monthOffset.value)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})

function weekStart(): Date {
  const d = new Date()
  d.setDate(d.getDate() + weekOffset.value * 7 - (d.getDay() + 6) % 7) // Lundi
  return d
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const displayDays = computed(() => {
  const start = weekStart()
  return dayOrder.map((k, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return { key: k, short: k, date: d.getDate(), full: d }
  })
})

// ── Month cells ──
const monthCells = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(); d.setMonth(d.getMonth() + monthOffset.value, 1)
  const startDay = d.getDay() // 0=DIM, 1=LUN...
  const startDate = new Date(d)
  startDate.setDate(startDate.getDate() - startDay) // start on Sunday

  const cells: { date: number; day: string | null; outOfMonth: boolean; isToday: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(startDate)
    cellDate.setDate(cellDate.getDate() + i)
    const cellDay = DAYS_FR[cellDate.getDay()]
    cells.push({
      date: cellDate.getDate(),
      day: cellDay,
      outOfMonth: cellDate.getMonth() !== d.getMonth(),
      isToday: cellDate.getTime() === today.getTime(),
    })
  }
  return cells
})

// ── Slots helpers ──
function slotsForDay(day: string): WeeklySlot[] {
  return store.planning.weeklySlots.filter(s => s.day === day)
}

function slotsAtHour(day: string, hour: number): WeeklySlot[] {
  return store.planning.weeklySlots.filter(s => s.day === day && parseInt(s.time.split(':')[0]) === hour)
}

function slotStyle(s: WeeklySlot): Record<string, string> {
  const [h, m] = s.time.split(':').map(Number)
  const top = (h + m / 60) * hourPx
  return { top: top + 'px', height: '22px' }
}

function removeSlot(s: WeeklySlot) {
  store.planning.weeklySlots = store.planning.weeklySlots.filter(x => !(x.day === s.day && x.time === s.time))
  if (editSlot.value === s) editSlot.value = null
  store.markDirty()
}

function applyEdit() {
  if (!editSlot.value || !editTime.value) return
  editSlot.value.time = editTime.value
  store.markDirty()
}

// ── Drag to create ──
const dragStart = ref<{ day: string; hour: number } | null>(null)
const dragEnd = ref<{ day: string; hour: number } | null>(null)

function startDrag(day: string, hour: number) {
  dragStart.value = { day, hour }
  dragEnd.value = { day, hour }
  window.addEventListener('mouseup', commitDrag, { once: true })
}

function onDragOver(day: string, hour: number) {
  if (dragStart.value) dragEnd.value = { day, hour }
}

function isDragOver(day: string, hour: number) {
  if (!dragStart.value || !dragEnd.value) return false
  const ds = dragStart.value; const de = dragEnd.value
  const loD = Math.min(dayOrder.indexOf(ds.day), dayOrder.indexOf(de.day))
  const hiD = Math.max(dayOrder.indexOf(ds.day), dayOrder.indexOf(de.day))
  const loH = Math.min(ds.hour, de.hour)
  const hiH = Math.max(ds.hour, de.hour)
  const dIdx = dayOrder.indexOf(day)
  return dIdx >= loD && dIdx <= hiD && hour >= loH && hour <= hiH
}

function dragRect(day: string, hour: number) {
  if (!dragStart.value || !dragEnd.value) return {}
  const ds = dragStart.value; const de = dragEnd.value
  const loD = Math.min(dayOrder.indexOf(ds.day), dayOrder.indexOf(de.day))
  const hiD = Math.max(dayOrder.indexOf(ds.day), dayOrder.indexOf(de.day))
  const loH = Math.min(ds.hour, de.hour)
  const hiH = Math.max(ds.hour, de.hour)
  const dIdx = dayOrder.indexOf(day)
  const isFirstDay = dIdx === loD
  return {
    top: (loH * hourPx) + 'px',
    height: ((hiH + 1 - loH) * hourPx) + 'px',
    ...(isFirstDay ? {} : { display: 'none' }),
    opacity: isFirstDay ? '1' : '0',
  }
}

function commitDrag() {
  if (!dragStart.value || !dragEnd.value) return
  const ds = dragStart.value; const de = dragEnd.value
  const loD = Math.min(dayOrder.indexOf(ds.day), dayOrder.indexOf(de.day))
  const hiD = Math.max(dayOrder.indexOf(ds.day), dayOrder.indexOf(de.day))
  const loH = Math.min(ds.hour, de.hour)
  const hiH = Math.max(ds.hour, de.hour)

  for (let di = loD; di <= hiD; di++) {
    const day = dayOrder[di]
    for (let h = loH; h <= hiH; h++) {
      const time = String(h).padStart(2, '0') + ':00'
      const exists = store.planning.weeklySlots.some(s => s.day === day && s.time === time)
      if (!exists) {
        store.planning.weeklySlots.push({ day, time })
      }
    }
  }
  store.markDirty()
  dragStart.value = null
  dragEnd.value = null
}

// ── Presets ──
const presets = [
  { label: 'Tous les jours à 20:08', apply: () => store.planning.weeklySlots = dayOrder.map(d => ({ day: d, time: '20:08' })) },
  { label: 'Matin + soir (08:00, 20:00)', apply: () => store.planning.weeklySlots = dayOrder.flatMap(d => [{ day: d, time: '08:00' }, { day: d, time: '20:00' }]) },
  { label: 'Heures ouvrées (08,12,17)', apply: () => store.planning.weeklySlots = dayOrder.flatMap(d => [{ day: d, time: '08:00' }, { day: d, time: '12:00' }, { day: d, time: '17:00' }]) },
  { label: 'Vider tout', apply: () => { if (confirm('Effacer tous les créneaux ?')) store.planning.weeklySlots = [] } },
]

function applyPreset(p: typeof presets[0]) {
  p.apply()
  store.markDirty()
}

// ── Résumé ──
const summary = computed(() => {
  const n = store.planning.weeklySlots.length
  if (n === 0) return 'Aucun créneau'
  const byDay: Record<string, string[]> = {}
  for (const s of store.planning.weeklySlots) (byDay[s.day] ??= []).push(s.time)
  if (Object.keys(byDay).length === 7 && Object.values(byDay).every((ts, i, arr) => ts.length === arr[0].length && ts.join(',') === arr[0].join(','))) {
    // Tous les jours, mêmes créneaux
    return `Tous les jours à ${[...new Set(Object.values(byDay)[0])].sort().join(' et ')}`
  }
  return Object.entries(byDay).map(([d, ts]) => `${d} à ${[...new Set(ts)].sort().join(' et ')}`).join(' · ')
})
</script>