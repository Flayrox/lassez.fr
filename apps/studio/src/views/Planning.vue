<!-- Planning — le rythme du robot, avec le nouveau calendrier mois+semaine -->
<template>
  <div class="space-y-4">
    <!-- Mode -->
    <LCard title="Comment il se déclenche">
      <div class="grid grid-cols-3 gap-2">
        <button v-for="m in modes" :key="m.id" @click="setMode(m.id)"
          class="flex flex-col items-center gap-1 p-3 rounded border transition-colors"
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

    <!-- Calendrier -->
    <LCard v-if="store.planning.mode !== 'pulse'" title="Calendrier de passage" description="Glisse pour créer des créneaux — clique un créneau pour l'éditer, ✕ pour le supprimer">
      <CalendarView />
    </LCard>

    <LCard v-if="store.planning.mode === 'pulse'" title="Résumé">
      <p class="text-xs text-text-1">En continu — le robot scanne toutes les {{ store.planning.intervalleMinutes }} minutes, sans calendrier.</p>
    </LCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfigStore } from '../stores/config'
import LCard from '../components/ui/LCard.vue'
import LInput from '../components/ui/LInput.vue'
import CalendarView from '../components/CalendarView.vue'

const store = useConfigStore()

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
</script>