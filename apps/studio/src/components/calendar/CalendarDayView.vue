<template>
  <div class="space-y-4 select-none p-3">
    <!-- En-tête du jour -->
    <div class="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
      <div>
        <h2 class="text-sm font-semibold capitalize">{{ formattedDayTitle }}</h2>
        <p class="text-xs text-muted-foreground">{{ allEvents.length }} événement{{ allEvents.length > 1 ? 's' : '' }} programmé{{ allEvents.length > 1 ? 's' : '' }} aujourd'hui</p>
      </div>
      <Button size="sm" class="gap-1.5" @click="emit('create-slot', dayDate, '09:00')">
        <PlusIcon class="size-3.5" /> Ajouter un créneau
      </Button>
    </div>

    <!-- Timeline des événements du jour -->
    <div class="space-y-2">
      <div v-if="allEvents.length === 0" class="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <CalendarXIcon class="size-8 text-muted-foreground/50 mb-2" />
        <p class="text-xs font-medium">Aucun scan ni publication pour ce jour</p>
        <p class="text-[11px] text-muted-foreground mt-0.5">Cliquez sur « Ajouter un créneau » pour programmer une action.</p>
      </div>

      <div
        v-for="ev in allEvents"
        :key="ev.id"
        class="flex items-center justify-between gap-3 rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors"
        :style="{ borderLeftColor: ev.color, borderLeftWidth: '4px' }"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span class="font-mono text-xs font-bold w-12 shrink-0">{{ ev.timeLabel }}</span>
          
          <div class="min-w-0 space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="font-medium text-xs truncate">{{ ev.text }}</span>
              <Badge v-if="ev.kind === 'pub'" variant="secondary" class="font-mono text-[9px] px-1 h-4">
                {{ ev.platform || 'PUBLICATION' }}
              </Badge>
              <Badge v-else variant="outline" class="font-mono text-[9px] px-1 h-4">
                SCAN
              </Badge>
              <Badge v-if="ev.week" variant="secondary" class="font-mono text-[9px] px-1 h-4">
                Semaine {{ ev.week }}
              </Badge>
            </div>

            <p class="text-[11px] text-muted-foreground truncate">{{ ev.tooltip }}</p>
          </div>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="emit('edit-event', ev)">
            <PencilIcon class="size-3 mr-1" /> Modifier
          </Button>
          <Button variant="ghost" size="icon-xs" class="h-7 w-7 text-destructive hover:text-destructive" @click="emit('delete-event', ev)">
            <Trash2Icon class="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CalendarXIcon, PencilIcon, PlusIcon, Trash2Icon } from '@lucide/vue'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'

const props = defineProps<{
  dayDate: Date
  eventsByDay: {
    slots: Map<string, any[]>
    pubs: Map<string, any[]>
    plans: Map<string, any[]>
  }
}>()

const emit = defineEmits<{
  (e: 'create-slot', date: Date, time: string): void
  (e: 'edit-event', ev: any): void
  (e: 'delete-event', ev: any): void
}>()

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const currentKey = computed(() => dateKey(props.dayDate))

const formattedDayTitle = computed(() => {
  return props.dayDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const allEvents = computed(() => {
  const s = props.eventsByDay.slots.get(currentKey.value) ?? []
  const p = props.eventsByDay.pubs.get(currentKey.value) ?? []
  const pl = props.eventsByDay.plans.get(currentKey.value) ?? []

  const merged = [...s, ...p, ...pl]
  return merged.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel))
})
</script>
