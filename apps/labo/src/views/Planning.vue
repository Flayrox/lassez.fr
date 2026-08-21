<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold">Planning</h1>
      <p class="text-xs text-text-3 mt-0.5">Quand le robot passe — glisse sur la grille pour choisir les heures</p>
    </div>

    <!-- Mode -->
    <LCard :padding="false" title="Comment il se déclenche">
      <div class="p-4 pt-0">
        <div class="grid grid-cols-3 gap-2">
          <button v-for="m in modes" :key="m.id" @click="setMode(m.id)"
            class="flex flex-col items-center gap-1 p-3 rounded border transition-all"
            :class="store.planning.mode === m.id ? 'border-accent bg-accent-muted' : 'border-border hover:bg-surface-hover'">
            <span class="text-lg">{{ m.icon }}</span>
            <span class="text-xs font-medium">{{ m.label }}</span>
            <span class="text-[10px] text-text-3">{{ m.desc }}</span>
          </button>
        </div>
      </div>
    </LCard>

    <!-- Pulse options -->
    <LCard v-if="store.planning.mode !== 'calendar'" title="Intervalle" description="Scanner toutes les X minutes">
      <input type="number" v-model.number="store.planning.intervalleMinutes" class="w-full h-8 bg-bg border border-border rounded px-2.5 text-sm focus:outline-none focus:border-accent/60 max-w-[160px]" />
    </LCard>

    <!-- Grille calendrier -->
    <LCard v-if="store.planning.mode !== 'pulse'" :padding="false"
      title="Calendrier de passage" description="Glisse pour sélectionner les créneaux — clic sur un créneau sélectionné pour l'enlever">
      <div class="px-4 pb-4 pt-0">
        <div class="flex justify-between items-center mb-2">
          <span class="text-[11px] text-text-3">{{ selectedCount }} créneau{{ selectedCount > 1 ? 'x' : '' }} sélectionné{{ selectedCount > 1 ? 's' : '' }}</span>
          <LButton variant="danger" @click="clearAll">Tout effacer</LButton>
        </div>
        <div class="border border-border rounded overflow-hidden select-none">
          <!-- Header jours -->
          <div class="flex bg-surface-hover/50 border-b border-border">
            <div class="w-14 shrink-0 border-r border-border"></div>
            <div v-for="d in days" :key="d.key" class="flex-1 text-center py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-3 border-r border-border/40 last:border-r-0">{{ d.label }}</div>
          </div>
          <!-- Heures -->
          <div class="max-h-[380px] overflow-y-auto">
            <div v-for="(hour, hi) in hours" :key="hour" class="flex border-b border-border/30 last:border-b-0 group">
              <div class="w-14 shrink-0 border-r border-border py-0.5 flex items-center justify-center sticky left-0 bg-surface z-10">
                <span class="text-[10px] font-mono text-text-3 group-hover:text-text-1 transition-colors">{{ hour }}</span>
              </div>
              <div v-for="(d, di) in days" :key="d.key"
                @mousedown="startDrag(di, hi)" @mouseenter="onDragOver(di, hi)"
                class="flex-1 h-6 cursor-crosshair transition-colors duration-75 border-r border-border/20 last:border-r-0 flex items-center justify-center"
                :class="isOn(di, hi) ? 'bg-accent' : 'hover:bg-surface-hover'">
                <svg v-if="isOn(di, hi)" viewBox="0 0 12 12" class="w-2.5 h-2.5"><path d="M2 6l3 3 5-6" stroke="#052e1b" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LCard>

    <!-- Résumé -->
    <LCard title="Résumé">
      <p class="text-sm font-medium">{{ summary }}</p>
      <p class="text-[11px] text-text-3 mt-1">Le partage, lui, vérifie ses envois toutes les 2 min à part</p>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LButton from '../components/ui/LButton.vue'

const store = useConfigStore()

const modes = [
  { id: 'hybrid', icon: '◈', label: 'Hybride', desc: 'Interval + heures fixes' },
  { id: 'pulse', icon: '↻', label: 'En continu', desc: 'Toutes les X minutes' },
  { id: 'calendar', icon: '▦', label: 'Calendrier strict', desc: 'Uniquement les cases noircies' },
]
function setMode(id: 'hybrid' | 'pulse' | 'calendar') {
  store.planning.mode = id
  store.markDirty()
}

const days = [
  { key: 'DIM', label: 'Dim' }, { key: 'LUN', label: 'Lun' }, { key: 'MAR', label: 'Mar' },
  { key: 'MER', label: 'Mer' }, { key: 'JEU', label: 'Jeu' }, { key: 'VEN', label: 'Ven' }, { key: 'SAM', label: 'Sam' },
]
const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

// Slots sélectionnés "LUN-08:00"
const slots = ref(new Set<string>())
const dragStart = ref<{ d: number; h: number } | null>(null)
const dragCurrent = ref<{ d: number; h: number } | null>(null)
const dragMode = ref<'add' | 'remove' | null>(null)

// Parse depuis le format ancien "LUN 08:00\nMAR 08:00" si présent
if (store.planning.heures && !slots.value.size) {
  for (const line of store.planning.heures.split(/[\n;]+/)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length === 2) {
      const day = parts[0].toUpperCase()
      const time = parts[1]
      if (days.some(d => d.key === day)) slots.value.add(`${day}-${time}`)
    }
  }
}

function isOn(d: number, h: number): boolean {
  const inDragRange =
    dragStart.value && dragCurrent.value &&
    d >= Math.min(dragStart.value.d, dragCurrent.value.d) && d <= Math.max(dragStart.value.d, dragCurrent.value.d) &&
    h >= Math.min(dragStart.value.h, dragCurrent.value.h) && h <= Math.max(dragStart.value.h, dragCurrent.value.h)
  if (inDragRange) return dragMode.value === 'add'
  return slots.value.has(`${days[d].key}-${hours[h]}`)
}
function startDrag(d: number, h: number) {
  const key = `${days[d].key}-${hours[h]}`
  dragMode.value = slots.value.has(key) ? 'remove' : 'add'
  dragStart.value = { d, h }
  dragCurrent.value = { d, h }
}
function onDragOver(d: number, h: number) {
  if (dragStart.value) dragCurrent.value = { d, h }
}
function commit() {
  if (!dragStart.value || !dragCurrent.value || !dragMode.value) return
  for (let d = 0; d < 7; d++)
    for (let h = 0; h < 24; h++) {
      const on = isOn(d, h)
      const key = `${days[d].key}-${hours[h]}`
      if (on) slots.value.add(key)
      else if (dragMode.value === 'remove') slots.value.delete(key)
    }
  serialize()
  dragStart.value = null
  dragCurrent.value = null
  dragMode.value = null
}
function onMouseUpGlobal() { commit() }
onMounted(() => window.addEventListener('mouseup', commit))
onUnmounted(() => window.removeEventListener('mouseup', commit))

function clearAll() {
  slots.value.clear()
  serialize()
}
function serialize() {
  // Reconvertit en lignes "JOUR HH:MM" pour le daemon (format getDelayToNextScan)
  const byDay: Record<string, string[]> = {}
  slots.value.forEach(s => {
    const [day, time] = s.split('-')
    ;(byDay[day] ??= []).push(time)
  })
  const lines = Object.entries(byDay)
    .map(([day, times]) => times.sort().map(t => `${day} ${t}`).join('\n'))
    .join('\n')
  store.planning.heures = lines
  store.markDirty()
}
const selectedCount = computed(() => slots.value.size)
const summary = computed(() =>
  store.planning.mode === 'pulse'
    ? `Le robot passe toutes les ${store.planning.intervalleMinutes} min`
    : store.planning.mode === 'calendar'
      ? `Le robot passe uniquement aux ${selectedCount.value} créneaux choisis`
      : `Toutes les ${store.planning.intervalleMinutes} min + aux ${selectedCount.value} créneaux fixes`
)
</script>
