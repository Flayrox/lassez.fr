<template>
  <Dialog :open="open" @update:open="(v: boolean) => emit('update:open', v)">
    <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-base">
          <CalendarIcon class="size-4 text-primary" />
          {{ isEdit ? 'Modifier la programmation' : 'Programmer un créneau ou une publication' }}
        </DialogTitle>
        <DialogDescription class="text-xs">
          Configurez un scan régulier / ponctuel pour un pipeline, ou insérez une publication planifiée multi-plateformes dans la file d'attente.
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="entryType" class="w-full">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="scan" class="text-xs">
            <RadioIcon class="mr-1.5 size-3.5" /> Scan Automatique
          </TabsTrigger>
          <TabsTrigger value="pub" class="text-xs">
            <SendIcon class="mr-1.5 size-3.5" /> Publication Planifiée
          </TabsTrigger>
        </TabsList>

        <!-- Formulaire Scan -->
        <TabsContent value="scan" class="space-y-4 pt-3">
          <!-- Pipeline -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Pipeline cible</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="p in pipelines"
                :key="p.id"
                type="button"
                class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                :class="selectedPipelineId === p.id ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted'"
                @click="selectedPipelineId = p.id"
              >
                <span class="size-2.5 rounded-full" :style="{ background: p.color }"></span>
                {{ p.name }}
              </button>
            </div>
          </div>

          <!-- Type de récurrence -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Fréquence & Période</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                class="rounded-lg border p-2 text-left text-xs transition-colors"
                :class="recurrenceMode === 'weekly' ? 'border-primary bg-primary/10 font-medium text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'"
                @click="recurrenceMode = 'weekly'"
              >
                <p class="font-semibold text-[11px]">Hebdo régulier</p>
                <p class="text-[9px] text-muted-foreground mt-0.5">Chaque semaine aux jours choisis</p>
              </button>
              <button
                type="button"
                class="rounded-lg border p-2 text-left text-xs transition-colors"
                :class="recurrenceMode === 'range' ? 'border-primary bg-primary/10 font-medium text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'"
                @click="recurrenceMode = 'range'"
              >
                <p class="font-semibold text-[11px]">Plage horaire</p>
                <p class="text-[9px] text-muted-foreground mt-0.5">Ex: 8h-22h toutes les heures</p>
              </button>
              <button
                type="button"
                class="rounded-lg border p-2 text-left text-xs transition-colors"
                :class="recurrenceMode === 'once' ? 'border-primary bg-primary/10 font-medium text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'"
                @click="recurrenceMode = 'once'"
              >
                <p class="font-semibold text-[11px]">Ponctuel unique</p>
                <p class="text-[9px] text-muted-foreground mt-0.5">À une date et heure précises</p>
              </button>
            </div>
          </div>

          <!-- Si mode Ponctuel : Date unique + Heure -->
          <div v-if="recurrenceMode === 'once'" class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-foreground">Date du scan</label>
              <Input type="date" v-model="singleScanDate" class="h-8 text-xs" />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-foreground">Heure du scan</label>
              <Input type="time" v-model="scanTime" class="h-8 text-xs" />
            </div>
          </div>

          <!-- Si mode Hebdo / Plage : Sélection des jours avec options rapides -->
          <div v-else class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-foreground">Jours ciblés</label>
              <div class="flex items-center gap-1.5 text-[10px]">
                <button type="button" class="text-primary hover:underline" @click="selectAllDays">Tous (7j)</button>
                <span class="text-muted-foreground">·</span>
                <button type="button" class="text-primary hover:underline" @click="selectWeekdays">Semaine (Lun-Ven)</button>
                <span class="text-muted-foreground">·</span>
                <button type="button" class="text-primary hover:underline" @click="selectNext7Days">7 prochains jours</button>
                <span class="text-muted-foreground">·</span>
                <button type="button" class="text-primary hover:underline" @click="selectCurrentWeek">Semaine active</button>
              </div>
            </div>
            <div class="grid grid-cols-7 gap-1">
              <button
                v-for="d in ALL_DAYS"
                :key="d.key"
                type="button"
                class="flex h-8 items-center justify-center rounded-md border text-xs font-medium transition-colors"
                :class="selectedDays.includes(d.key) ? 'border-primary bg-primary text-primary-foreground font-bold' : 'border-border bg-card text-muted-foreground hover:bg-muted'"
                @click="toggleDay(d.key)"
              >
                {{ d.label }}
              </button>
            </div>
          </div>

          <!-- Si mode Weekly standard : Heure unique + Semaines A/B -->
          <div v-if="recurrenceMode === 'weekly'" class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-foreground">Heure du scan</label>
              <Input type="time" v-model="scanTime" class="h-8" />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-foreground">Alternance des semaines</label>
              <Select v-model="weekOption">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue placeholder="Toutes les semaines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les semaines</SelectItem>
                  <SelectItem value="A">Semaine A uniquement (impaire)</SelectItem>
                  <SelectItem value="B">Semaine B uniquement (paire)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- Si mode Range : Plage horaire automatique -->
          <div v-else-if="recurrenceMode === 'range'" class="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3">
            <p class="text-xs font-medium">Générer les créneaux par heure</p>
            <div class="flex items-center gap-3">
              <div class="flex-1 space-y-1">
                <span class="text-[10px] text-muted-foreground">De (Heure début)</span>
                <Input type="time" v-model="rangeStart" class="h-8" />
              </div>
              <span class="text-muted-foreground pt-3 text-xs">à</span>
              <div class="flex-1 space-y-1">
                <span class="text-[10px] text-muted-foreground">À (Heure fin)</span>
                <Input type="time" v-model="rangeEnd" class="h-8" />
              </div>
              <div class="w-28 space-y-1">
                <span class="text-[10px] text-muted-foreground">Toutes les</span>
                <Select v-model="rangeStep">
                  <SelectTrigger class="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">1 heure</SelectItem>
                    <SelectItem value="120">2 heures</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p class="text-[11px] text-muted-foreground">
              ⚡ Créera {{ previewRangeCount }} créneaux sur {{ selectedDays.length }} jour(s) = <strong>{{ previewRangeCount * selectedDays.length }} exécutions</strong> par semaine.
            </p>
          </div>

          <!-- Publication associée -->
          <div class="rounded-lg border border-border/80 bg-card p-3 space-y-2">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-medium">Publication automatique associée</p>
                <p class="text-[10px] text-muted-foreground">Quand diffuser les articles rédigés après le scan</p>
              </div>
              <Select v-model="pubOffsetMode">
                <SelectTrigger class="h-7 w-48 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Offset du pipeline (+30 min)</SelectItem>
                  <SelectItem value="custom">Offset personnalisé</SelectItem>
                  <SelectItem value="exact">Heure fixe spécifique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="pubOffsetMode === 'custom'" class="flex items-center gap-2 pt-1">
              <span class="text-xs text-muted-foreground">Publier</span>
              <Input type="number" min="0" max="720" v-model="customOffsetMinutes" class="h-7 w-20 text-xs" />
              <span class="text-xs text-muted-foreground">minutes après la fin du scan</span>
            </div>
            <div v-if="pubOffsetMode === 'exact'" class="flex items-center gap-2 pt-1">
              <span class="text-xs text-muted-foreground">Heure exacte de publication :</span>
              <Input type="time" v-model="exactPubTime" class="h-7 w-32 text-xs" />
            </div>
          </div>
        </TabsContent>

        <!-- Formulaire Publication Directe -->
        <TabsContent value="pub" class="space-y-4 pt-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Pipeline d'origine</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="p in pipelines"
                :key="p.id"
                type="button"
                class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                :class="selectedPipelineId === p.id ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted'"
                @click="selectedPipelineId = p.id"
              >
                <span class="size-2.5 rounded-full" :style="{ background: p.color }"></span>
                {{ p.name }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-foreground">Date de diffusion</label>
              <Input type="date" v-model="pubDate" class="h-8 text-xs" />
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-foreground">Heure de diffusion</label>
              <Input type="time" v-model="pubTime" class="h-8 text-xs" />
            </div>
          </div>

          <!-- Multi-sélection des Plateformes -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-foreground">Plateformes cibles (multi-sélection)</label>
              <button type="button" class="text-[10px] text-primary hover:underline" @click="toggleAllPlatforms">
                {{ selectedPlatforms.length === PLATFORM_OPTIONS.length ? 'Désélectionner tout' : 'Tout sélectionner' }}
              </button>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="plat in PLATFORM_OPTIONS"
                :key="plat.key"
                type="button"
                class="flex items-center gap-2 rounded-lg border p-2 text-xs transition-colors"
                :class="selectedPlatforms.includes(plat.key) ? 'border-primary bg-primary/10 font-semibold text-foreground ring-1 ring-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted'"
                @click="togglePlatform(plat.key)"
              >
                <span class="text-sm">{{ plat.icon }}</span>
                <span class="truncate">{{ plat.label }}</span>
              </button>
            </div>
          </div>

          <!-- Multi-sélection des Formats -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-foreground">Formats autorisés</label>
              <button type="button" class="text-[10px] text-primary hover:underline" @click="toggleAllFormats">
                {{ selectedFormats.length === formats.length ? 'Désélectionner tout' : 'Tous les formats' }}
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="f in formats"
                :key="f.id"
                type="button"
                class="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors"
                :class="selectedFormats.includes(f.id) ? 'border-primary bg-primary/15 text-primary font-medium' : 'border-border bg-card text-muted-foreground hover:bg-muted'"
                @click="toggleFormat(f.id)"
              >
                <span class="size-1.5 rounded-full" :style="{ background: f.couleur }"></span>
                {{ f.nom }}
              </button>
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Titre ou Accroche du post</label>
            <Input v-model="postTitle" placeholder="Ex: Flash Info : Découverte majeure..." class="h-8 text-xs" />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">Contenu / Message à publier (optionnel)</label>
            <Textarea
              v-model="postContent"
              placeholder="Rédigez directement votre post ici ou laissez vide pour laisser l'IA du pipeline générer à partir du prochain signal..."
              rows="3"
              class="text-xs resize-none"
            />
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter class="mt-4 flex items-center justify-between border-t pt-3">
        <Button variant="ghost" size="sm" @click="emit('update:open', false)">Annuler</Button>
        <Button size="sm" :disabled="saving" @click="handleSave">
          <Spinner v-if="saving" class="mr-1.5 size-3.5" />
          {{ isEdit ? 'Enregistrer les modifications' : 'Ajouter au planning' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CalendarIcon, RadioIcon, SendIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Spinner } from '../ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Textarea } from '../ui/textarea'
import { useConfigStore, type PipelineInfo, type WeeklySlot } from '../../stores/config'
import { usePipelinesStore } from '../../stores/pipelines'
import { pipelineApiBase } from '../../lib/api'

const props = defineProps<{
  open: boolean
  initialDate?: Date
  initialTime?: string
  initialPipelineId?: string
  editEvent?: any
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'saved'): void
}>()

const cfg = useConfigStore()
const pipes = usePipelinesStore()

const ALL_DAYS = [
  { key: 'LUN', label: 'Lun' },
  { key: 'MAR', label: 'Mar' },
  { key: 'MER', label: 'Mer' },
  { key: 'JEU', label: 'Jeu' },
  { key: 'VEN', label: 'Ven' },
  { key: 'SAM', label: 'Sam' },
  { key: 'DIM', label: 'Dim' },
]

const DAY_INDEX: Record<string, number> = { DIM: 0, LUN: 1, MAR: 2, MER: 3, JEU: 4, VEN: 5, SAM: 6 }

// Options de plateformes
const PLATFORM_OPTIONS = [
  { key: 'x', label: '𝕏 / Twitter', icon: '𝕏' },
  { key: 'discord', label: 'Discord', icon: '◉' },
  { key: 'bluesky', label: 'Bluesky', icon: '☁' },
  { key: 'mastodon', label: 'Mastodon', icon: '🐘' },
  { key: 'qoe', label: 'qoe.fi', icon: '◈' },
]

const entryType = ref<'scan' | 'pub'>('scan')
const selectedPipelineId = ref('')
const recurrenceMode = ref<'weekly' | 'range' | 'once'>('weekly')
const singleScanDate = ref('')
const selectedDays = ref<string[]>(['LUN', 'MAR', 'MER', 'JEU', 'VEN'])
const scanTime = ref('09:00')
const weekOption = ref<'all' | 'A' | 'B'>('all')

// Plage horaire
const rangeStart = ref('08:00')
const rangeEnd = ref('22:00')
const rangeStep = ref('60')

// Mode Publication scan
const pubOffsetMode = ref<'default' | 'custom' | 'exact'>('default')
const customOffsetMinutes = ref(30)
const exactPubTime = ref('09:30')

// Publication directe
const pubDate = ref('')
const pubTime = ref('10:00')
const selectedPlatforms = ref<string[]>(['x', 'discord', 'bluesky'])
const selectedFormats = ref<string[]>(['FLASH', 'ALERTE'])
const postTitle = ref('')
const postContent = ref('')

const saving = ref(false)

const pipelines = computed(() => {
  const list = cfg.pipelines.filter(p => p.enabled !== false)
  if (list.length > 0) return list
  // Fallback direct
  return [
    { id: 'principal', name: 'Principal', color: '#F59E0B', port: 4406, enabled: true, description: '', configPath: '', dbPath: '' },
    { id: 'flash', name: 'Flash', color: '#3B82F6', port: 4407, enabled: true, description: '', configPath: '', dbPath: '' },
  ]
})
const formats = computed(() => cfg.formats)
const isEdit = computed(() => !!props.editEvent)

const previewRangeCount = computed(() => {
  const [sh] = rangeStart.value.split(':').map(Number)
  const [eh] = rangeEnd.value.split(':').map(Number)
  const step = Number(rangeStep.value) || 60
  if (eh <= sh) return 1
  return Math.floor(((eh - sh) * 60) / step) + 1
})

function selectAllDays() {
  selectedDays.value = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
}
function selectWeekdays() {
  selectedDays.value = ['LUN', 'MAR', 'MER', 'JEU', 'VEN']
}
function selectNext7Days() {
  const start = props.initialDate || new Date()
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const k = Object.keys(DAY_INDEX).find(x => DAY_INDEX[x] === d.getDay())
    if (k && !days.includes(k)) days.push(k)
  }
  selectedDays.value = days
}
function selectCurrentWeek() {
  selectedDays.value = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
}

function toggleDay(key: string) {
  if (selectedDays.value.includes(key)) {
    if (selectedDays.value.length > 1) {
      selectedDays.value = selectedDays.value.filter(d => d !== key)
    }
  } else {
    selectedDays.value = [...selectedDays.value, key]
  }
}

function togglePlatform(key: string) {
  if (selectedPlatforms.value.includes(key)) {
    if (selectedPlatforms.value.length > 1) {
      selectedPlatforms.value = selectedPlatforms.value.filter(k => k !== key)
    }
  } else {
    selectedPlatforms.value = [...selectedPlatforms.value, key]
  }
}
function toggleAllPlatforms() {
  if (selectedPlatforms.value.length === PLATFORM_OPTIONS.length) {
    selectedPlatforms.value = ['x']
  } else {
    selectedPlatforms.value = PLATFORM_OPTIONS.map(p => p.key)
  }
}

function toggleFormat(id: string) {
  if (selectedFormats.value.includes(id)) {
    if (selectedFormats.value.length > 1) {
      selectedFormats.value = selectedFormats.value.filter(k => k !== id)
    }
  } else {
    selectedFormats.value = [...selectedFormats.value, id]
  }
}
function toggleAllFormats() {
  if (selectedFormats.value.length === formats.value.length) {
    selectedFormats.value = formats.value.slice(0, 1).map(f => f.id)
  } else {
    selectedFormats.value = formats.value.map(f => f.id)
  }
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  const pid = props.initialPipelineId || cfg.activePipelineId || pipelines.value[0]?.id || 'principal'
  selectedPipelineId.value = pid

  const d = props.initialDate || new Date()
  const dayKey = Object.keys(DAY_INDEX).find(k => DAY_INDEX[k] === d.getDay()) || 'LUN'
  selectedDays.value = [dayKey]

  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  pubDate.value = `${yyyy}-${mm}-${dd}`
  singleScanDate.value = `${yyyy}-${mm}-${dd}`

  if (props.initialTime) {
    scanTime.value = props.initialTime
    pubTime.value = props.initialTime
  } else {
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, '0')
    scanTime.value = `${hh}:${min}`
    pubTime.value = `${hh}:${min}`
  }

  if (props.editEvent) {
    if (props.editEvent.kind === 'pub') {
      entryType.value = 'pub'
      selectedPipelineId.value = props.editEvent.pipelineId
      selectedPlatforms.value = props.editEvent.platform ? [props.editEvent.platform.toLowerCase()] : ['x']
      postTitle.value = props.editEvent.text || ''
    } else {
      entryType.value = 'scan'
      selectedPipelineId.value = props.editEvent.pipelineId
      scanTime.value = props.editEvent.time || '09:00'
      selectedDays.value = [props.editEvent.day || dayKey]
      weekOption.value = props.editEvent.week || 'all'
    }
  }
})

async function handleSave() {
  if (!selectedPipelineId.value) {
    selectedPipelineId.value = pipelines.value[0]?.id || 'principal'
  }

  saving.value = true
  try {
    if (entryType.value === 'scan') {
      await saveScanSlots()
    } else {
      await saveDirectPublication()
    }
    emit('saved')
    emit('update:open', false)
  } catch (err: any) {
    toast.error(err.message || 'Erreur lors de l\'enregistrement')
  } finally {
    saving.value = false
  }
}

async function saveScanSlots() {
  const pid = selectedPipelineId.value
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  let slotsToAdd: WeeklySlot[] = []

  const pubValue = pubOffsetMode.value === 'exact' ? exactPubTime.value : undefined

  if (recurrenceMode.value === 'once') {
    // Mode ponctuel : on calcule le jour de la semaine et la semaine ISO (A ou B)
    const target = new Date(singleScanDate.value || pubDate.value)
    const dayKey = Object.keys(DAY_INDEX).find(k => DAY_INDEX[k] === target.getDay()) || 'LUN'
    const t = new Date(target)
    const day = (t.getDay() + 6) % 7
    t.setDate(t.getDate() - day + 3)
    const firstThursday = new Date(t.getFullYear(), 0, 4)
    const fDay = (firstThursday.getDay() + 6) % 7
    firstThursday.setDate(firstThursday.getDate() - fDay + 3)
    const isoWk = 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7)
    const weekAorB = isoWk % 2 === 1 ? 'A' : 'B'

    slotsToAdd.push({
      day: dayKey,
      time: scanTime.value,
      week: weekAorB,
      publish: pubValue,
    })
  } else if (recurrenceMode.value === 'weekly') {
    for (const day of selectedDays.value) {
      slotsToAdd.push({
        day,
        time: scanTime.value,
        week: weekOption.value === 'all' ? undefined : weekOption.value,
        publish: pubValue,
      })
    }
  } else {
    // Mode plage horaire
    const [sh, sm] = rangeStart.value.split(':').map(Number)
    const [eh, em] = rangeEnd.value.split(':').map(Number)
    const step = Number(rangeStep.value) || 60

    let currentTotal = (sh || 0) * 60 + (sm || 0)
    const endTotal = (eh || 0) * 60 + (em || 0)

    while (currentTotal <= endTotal) {
      const hStr = String(Math.floor(currentTotal / 60)).padStart(2, '0')
      const mStr = String(currentTotal % 60).padStart(2, '0')
      const time = `${hStr}:${mStr}`

      for (const day of selectedDays.value) {
        slotsToAdd.push({
          day,
          time,
          publish: pubValue,
        })
      }
      currentTotal += step
    }
  }

  // Filtrer les doublons exacts
  const nextSlots = [...cur]
  for (const s of slotsToAdd) {
    if (!nextSlots.some(x => x.day === s.day && x.time === s.time && x.week === s.week)) {
      nextSlots.push(s)
    }
  }

  // Si offset custom
  const patchBody: any = { scheduling: { weeklySlots: nextSlots } }
  if (pubOffsetMode.value === 'custom') {
    patchBody.scheduling.publishOffsetMinutes = Number(customOffsetMinutes.value)
  }

  const p = pipelines.value.find(x => x.id === pid) ?? { port: pid === 'flash' ? 4407 : 4406, name: pid }

  const res = await fetch(pipelineApiBase(p.port) + '/api/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patchBody),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  await pipes.refresh(true)
  toast.success(`${slotsToAdd.length} créneau(x) configuré(s) pour ${p.name}`)
}

async function saveDirectPublication() {
  const pid = selectedPipelineId.value
  const p = pipelines.value.find(x => x.id === pid) ?? { port: pid === 'flash' ? 4407 : 4406, name: pid }

  const scheduledIso = new Date(`${pubDate.value}T${pubTime.value}:00`).toISOString()
  const targetPlats = selectedPlatforms.value.length ? selectedPlatforms.value : ['x']
  const targetFmts = selectedFormats.value.length ? selectedFormats.value : ['FLASH']

  let count = 0
  for (const plat of targetPlats) {
    for (const fmt of targetFmts) {
      try {
        await fetch(pipelineApiBase(p.port) + '/api/publications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: props.editEvent?.pubId || 0,
            scheduled_at: scheduledIso,
            platform: plat.toUpperCase(),
            format: fmt,
            title: postTitle.value,
            content: postContent.value,
          }),
        })
        count++
      } catch { /* log/skip */ }
    }
  }

  // Si le daemon n'a pas encore de signal lié, on recharge les données
  await pipes.refresh(true)
  toast.success(`${count} publication(s) programmée(s) le ${pubDate.value} à ${pubTime.value}`)
}
</script>
