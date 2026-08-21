<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">Planning</h1>
      <p class="text-xs text-text-3 mt-0.5">Quand le robot scanne tes sources — glisse sur la grille, règle l'heure exacte en dessous</p>
    </div>

    <!-- Mode -->
    <LCard title="Comment il se déclenche">
      <div class="grid grid-cols-3 gap-2">
        <button v-for="m in modes" :key="m.id" @click="setMode(m.id)"
          class="flex flex-col items-center gap-1 p-3 rounded border transition-all"
          :class="store.planning.mode === m.id ? 'border-accent bg-accent-muted' : 'border-border hover:bg-surface-hover'">
          <span class="text-lg">{{ m.icon }}</span>
          <span class="text-xs font-medium">{{ m.label }}</span>
          <span class="text-[10px] text-text-3">{{ m.desc }}</span>
        </button>
      </div>
      <div v-if="store.planning.mode !== 'calendar'" class="mt-3 max-w-[220px]">
        <LInput label="Intervalle (minutes)" help="Scan continu entre les créneaux fixes" v-model.number="intervalProxy" />
      </div>
    </LCard>

    <!-- Grille calendrier -->
    <LCard v-if="store.planning.mode !== 'pulse'" :padding="false"
      title="Calendrier de passage" description="Glisse pour ajouter/enlever des heures · clique une case sélectionnée pour l'enlever">
      <div class="px-4 pb-4 pt-0">
        <div class="flex justify-between items-center mb-2">
          <span class="text-[11px] text-text-3">{{ store.planning.weeklySlots.length }} créneau{{ store.planning.weeklySlots.length > 1 ? 'x' : '' }} · fuseau {{ store.planning.timezone }}</span>
          <LButton variant="danger" @click="clearAll">Tout effacer</LButton>
        </div>
        <div class="border border-border rounded overflow-hidden select-none">
          <!-- Header jours -->
          <div class="flex bg-surface-hover/50 border-b border-border">
            <div class="w-14 shrink-0 border-r border-border"></div>
            <div v-for="d in dayOrder" :key="d" class="flex-1 text-center py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-3 border-r border-border/40 last:border-r-0">{{ d }}</div>
          </div>
          <!-- Heures -->
          <div class="max-h-[380px] overflow-y-auto">
            <div v-for="(hour, hi) in hours" :key="hour" class="flex border-b border-border/30 last:border-b-0 group">
              <div class="w-14 shrink-0 border-r border-border py-0.5 flex items-center justify-center sticky left-0 bg-surface z-10">
                <span class="text-[10px] font-mono text-text-3 group-hover:text-text-1 transition-colors">{{ hour }}</span>
              </div>
              <div v-for="d in dayOrder" :key="d"
                @mousedown="startDrag(d, hi)" @mouseenter="onDragOver(d, hi)"
                class="flex-1 h-6 cursor-crosshair transition-colors duration-75 border-r border-border/20 last:border-r-0 flex items-center justify-center relative"
                :class="cellOn(d, hour) ? 'bg-accent' : 'hover:bg-surface-hover'"
                :title="slotsAt(d, hour).map(s => s.time).join(', ')">
                <svg v-if="cellOn(d, hour)" viewBox="0 0 12 12" class="w-2.5 h-2.5"><path d="M2 6l3 3 5-6" stroke="#052e1b" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                <span v-if="hasMinutes(d, hour)" class="absolute bottom-0 right-0.5 text-[7px] font-mono text-accent-fg leading-none">{{ minuteTag(d, hour) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Édition fine des créneaux -->
        <div v-if="store.planning.weeklySlots.length > 0" class="mt-4 space-y-2">
          <p class="text-[11px] text-text-3">Réglage fin — ajuste chaque créneau à la minute près :</p>
          <div class="flex flex-wrap gap-2">
            <div v-for="(s, i) in store.planning.weeklySlots" :key="i" class="flex items-center gap-1.5 bg-surface-hover rounded px-2 py-1">
              <select :value="s.day" @change="changeDay(i, ($event.target as HTMLSelectElement).value)" class="bg-transparent text-xs font-mono outline-none text-text-1">
                <option v-for="d in dayOrder" :key="d" :value="d">{{ d }}</option>
              </select>
              <input type="time" :value="s.time" @input="changeTime(i, ($event.target as HTMLInputElement).value)"
                class="bg-transparent text-xs font-mono outline-none text-accent w-[72px]" />
              <button @click="removeSlot(i)" class="text-text-3 hover:text-danger text-xs px-0.5">✕</button>
            </div>
          </div>
        </div>
      </div>
    </LCard>

    <!-- Résumé -->
    <LCard title="Résumé">
      <p class="text-sm font-medium">{{ summary }}</p>
      <p class="text-[11px] text-text-3 mt-1">Le partage vérifie ses envois toutes les 2 min, indépendamment du scan</p>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useConfigStore, DAYS } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LButton from '../components/ui/LButton.vue'
import LInput from '../components/ui/LInput.vue'

const store = useConfigStore()
// Ordre français de la semaine (lundi → dimanche) pour l'affichage
const dayOrder = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

const modes = [
  { id: 'hybrid', icon: '◈', label: 'Hybride', desc: 'Interval + calendrier' },
  { id: 'pulse', icon: '↻', label: 'En continu', desc: 'Toutes les X minutes' },
  { id: 'calendar', icon: '▦', label: 'Calendrier strict', desc: 'Uniquement les créneaux' },
]
function setMode(id: 'hybrid' | 'pulse' | 'calendar') {
  store.planning.mode = id
  store.markDirty()
}
const intervalProxy = computed({
  get: () => store.planning.intervalleMinutes,
  set: (v: number) => { store.planning.intervalleMinutes = v || 6; store.markDirty() },
})

// ── Slots helpers ──
function slotsAt(day: string, hour: string) {
  return store.planning.weeklySlots.filter(s => s.day === day && s.time.startsWith(hour.slice(0, 3)))
}
function cellOn(day: string, hour: string) { return slotsAt(day, hour).length > 0 }
function hasMinutes(day: string, hour: string) {
  return slotsAt(day, hour).some(s => s.time.slice(3) !== '00')
}
function minuteTag(day: string, hour: string) {
  const s = slotsAt(day, hour)[0]
  return s ? s.time.slice(3) : ''
}

// ── Drag rectangle ──
const dragStart = ref<{ day: string; hi: number } | null>(null)
const dragCurrent = ref<{ day: string; hi: number } | null>(null)
const dragMode = ref<'add' | 'remove' | null>(null)

function startDrag(day: string, hi: number) {
  dragMode.value = cellOn(day, hours[hi]) ? 'remove' : 'add'
  dragStart.value = { day, hi }
  dragCurrent.value = { day, hi }
}
function onDragOver(day: string, hi: number) {
  if (dragStart.value) dragCurrent.value = { day, hi }
}
function commit() {
  if (!dragStart.value || !dragCurrent.value || !dragMode.value) return
  const dIdxA = dayOrder.indexOf(dragStart.value.day), dIdxB = dayOrder.indexOf(dragCurrent.value.day)
  const loD = Math.min(dIdxA, dIdxB), hiD = Math.max(dIdxA, dIdxB)
  const loH = Math.min(dragStart.value.hi, dragCurrent.value.hi), hiH = Math.max(dragStart.value.hi, dragCurrent.value.hi)

  for (let di = loD; di <= hiD; di++) {
    const day = dayOrder[di]
    for (let hi = loH; hi <= hiH; hi++) {
      const hour = hours[hi]
      const on = dragMode.value === 'add'
        ? true
        : false // remove : on retire tout ce qui est dans le rectangle
      if (on && !cellOn(day, hour)) {
        store.planning.weeklySlots.push({ day, time: `${hour.slice(0, 3)}00` })
      }
      if (!on) {
        store.planning.weeklySlots = store.planning.weeklySlots.filter(s => !(s.day === day && s.time.startsWith(hour.slice(0, 3))))
      }
    }
  }
  store.markDirty()
  dragStart.value = null
  dragCurrent.value = null
  dragMode.value = null
}
function onMouseUpGlobal() { commit() }
onMounted(() => window.addEventListener('mouseup', commit))
onUnmounted(() => window.removeEventListener('mouseup', commit))

// ── Édition fine ──
function changeDay(i: number, day: string) {
  store.planning.weeklySlots[i].day = day
  store.markDirty()
}
function changeTime(i: number, time: string) {
  if (!time) return
  store.planning.weeklySlots[i].time = time
  store.markDirty()
}
function removeSlot(i: number) {
  store.planning.weeklySlots.splice(i, 1)
  store.markDirty()
}
function clearAll() {
  store.planning.weeklySlots = []
  store.markDirty()
}

// ── Résumé + export format daemon ("LUN 20:08\n...") ──
const summary = computed(() => {
  const n = store.planning.weeklySlots.length
  if (n === 0) return 'Aucun créneau — le robot ne scannera jamais (mode calendrier)'
  const byDay: Record<string, string[]> = {}
  for (const s of store.planning.weeklySlots) (byDay[s.day] ??= []).push(s.time)
  const parts = Object.entries(byDay).map(([d, ts]) => {
    const uniq = [...new Set(ts)].sort()
    return `${d} à ${uniq.join(' et ')}`
  })
  const prefix = store.planning.mode === 'hybrid' ? `Toutes les ${store.planning.intervalleMinutes} min + ` : ''
  return prefix + parts.join(' · ')
})

// Export lisible pour le daemon : "LUN 20:08\nMAR 20:08…" (format getDelayToNextScan)
// Sera envoyé via PATCH /api/config quand la config sera branchée au daemon.
const daemonFormat = computed(() => store.planning.weeklySlots.map(s => `${s.day} ${s.time}`).join('\n'))
</script>
