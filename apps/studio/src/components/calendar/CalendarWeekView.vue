<template>
  <div class="flex flex-col select-none overflow-hidden rounded-b-lg">
    <!-- En-tête des jours de la semaine -->
    <div class="grid grid-cols-8 border-b bg-muted/30">
      <div class="w-16 border-r p-2 text-center text-[10px] font-medium text-muted-foreground">Heure</div>
      <div
        v-for="(day, idx) in weekDays"
        :key="day.key"
        class="p-2 text-center border-r last:border-r-0"
        :class="day.isToday ? 'bg-primary/5 font-semibold text-primary' : ''"
      >
        <p class="text-[11px] font-medium tracking-wide uppercase">{{ day.label }}</p>
        <p class="text-xs font-bold" :class="day.isToday ? 'text-primary' : 'text-foreground'">{{ day.dateNum }}</p>
      </div>
    </div>

    <!-- Grille horaire défilante (07h00 à 23h00) -->
    <div class="relative max-h-[620px] overflow-y-auto">
      <div class="grid grid-cols-8 relative divide-x divide-border">
        <!-- Colonne des Heures -->
        <div class="w-16 flex flex-col bg-muted/10">
          <div
            v-for="h in hours"
            :key="h"
            class="h-14 border-b border-border/40 pr-2 text-right text-[10px] font-mono text-muted-foreground pt-0.5"
          >
            {{ String(h).padStart(2, '0') }}:00
          </div>
        </div>

        <!-- 7 Colonnes des jours -->
        <div
          v-for="day in weekDays"
          :key="day.key"
          :data-date="day.key"
          class="relative flex flex-col bg-background/50 transition-colors"
          :class="dropTargetKey === day.key ? 'bg-accent/15 ring-2 ring-primary ring-inset' : ''"
        >
          <!-- Lignes horaires (zones cliquables pour créer un créneau) -->
          <div
            v-for="h in hours"
            :key="h"
            class="h-14 border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer relative group"
            @click="emit('create-slot', day.date, `${String(h).padStart(2, '0')}:00`)"
          >
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span class="rounded bg-primary/20 text-primary text-[10px] px-1 py-0.5 font-medium">+ {{ String(h).padStart(2, '0') }}:00</span>
            </div>
          </div>

          <!-- Événements positionnés dans la colonne du jour -->
          <div
            v-for="ev in getDayEvents(day.key)"
            :key="ev.id"
            class="absolute left-1 right-1 rounded-md p-1.5 shadow-sm text-xs transition-transform cursor-grab active:cursor-grabbing z-10 border overflow-hidden group"
            :style="getEventStyle(ev)"
            :title="ev.tooltip"
            @pointerdown.stop="onEventPointerDown(ev, $event)"
          >
            <div class="flex items-start justify-between gap-1">
              <div class="flex items-center gap-1 min-w-0">
                <span v-if="ev.kind === 'pub'" class="flex size-3.5 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <SendIcon class="size-2" />
                </span>
                <span v-else class="size-2 shrink-0 rounded-full" :style="{ background: ev.color }"></span>
                <span class="font-mono text-[10px] font-bold shrink-0">{{ ev.timeLabel }}</span>
                <span class="truncate font-medium text-[11px]">{{ ev.text }}</span>
              </div>
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon-xs" class="h-4 w-4 p-0 text-muted-foreground hover:text-foreground" @click.stop="emit('edit-event', ev)">
                  <PencilIcon class="size-2.5" />
                </Button>
                <Button variant="ghost" size="icon-xs" class="h-4 w-4 p-0 text-destructive hover:text-destructive" @click.stop="emit('delete-event', ev)">
                  <Trash2Icon class="size-2.5" />
                </Button>
              </div>
            </div>

            <!-- Tags et publication associée -->
            <div class="mt-0.5 flex flex-wrap items-center gap-1 text-[9px]">
              <span v-if="ev.week" class="rounded bg-muted/60 px-1 py-0.2 font-mono font-semibold">Semaine {{ ev.week }}</span>
              <span v-if="ev.publishLabel" class="rounded bg-accent/20 text-accent font-semibold px-1 py-0.2">Pub {{ ev.publishLabel }}</span>
              <span v-if="ev.platform" class="rounded bg-primary/15 text-primary px-1 py-0.2 font-mono uppercase">{{ ev.platform }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { PencilIcon, SendIcon, Trash2Icon } from '@lucide/vue'
import { Button } from '../ui/button'

const props = defineProps<{
  startDate: Date
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
  (e: 'move-event', ev: any, newDate: Date, newTime?: string): void
}>()

// Heures affichées : de 06h à 23h
const startHour = 6
const endHour = 23
const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

const dropTargetKey = ref<string | null>(null)

const weekDays = computed(() => {
  const labels = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
  const fullLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const todayKey = dateKey(new Date())

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(props.startDate)
    d.setDate(d.getDate() + i)
    const key = dateKey(d)
    return {
      key,
      date: d,
      label: fullLabels[i],
      shortKey: labels[i],
      dateNum: d.getDate(),
      isToday: key === todayKey,
    }
  })
})

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getDayEvents(key: string) {
  const s = props.eventsByDay.slots.get(key) ?? []
  const p = props.eventsByDay.pubs.get(key) ?? []
  const pl = props.eventsByDay.plans.get(key) ?? []
  return [...s, ...p, ...pl]
}

function getEventStyle(ev: any) {
  const [h, m] = String(ev.time || ev.timeLabel || '09:00').split(':').map(Number)
  const hourOffset = Math.max(0, (h || 0) - startHour) + (m || 0) / 60
  // Chaque heure fait 56px (h-14)
  const top = hourOffset * 56
  const height = 48

  if (ev.kind === 'pub') {
    return {
      top: `${top}px`,
      minHeight: `${height}px`,
      background: 'hsl(var(--card))',
      borderColor: 'hsl(var(--primary) / 0.4)',
      color: 'hsl(var(--card-foreground))',
    }
  }

  return {
    top: `${top}px`,
    minHeight: `${height}px`,
    background: ev.color ? `${ev.color}18` : 'hsl(var(--muted))',
    borderColor: ev.color ? `${ev.color}80` : 'hsl(var(--border))',
    color: 'hsl(var(--foreground))',
  }
}

// Drag & drop
let draggingEvent: any = null
let dragStartX = 0
let dragStartY = 0

function onEventPointerDown(ev: any, e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  draggingEvent = ev
  dragStartX = e.clientX
  dragStartY = e.clientY

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const cellEl = el?.closest?.('[data-date]') as HTMLElement | null
  dropTargetKey.value = cellEl?.dataset.date ?? null
}

function onPointerUp(e: PointerEvent) {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)

  const dist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY)
  if (dist > 6 && draggingEvent && dropTargetKey.value) {
    const targetDate = parseKey(dropTargetKey.value)
    emit('move-event', draggingEvent, targetDate)
  }

  draggingEvent = null
  dropTargetKey.value = null
}
</script>
