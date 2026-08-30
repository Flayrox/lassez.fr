<!-- Emploi du temps — hub du produit Signaux : le calendrier + un onglet par
     composant de la chaîne (Collecte, Anti-doublons, Orchestrateur, Tri,
     Écriture, Image) avec ses paramètres directement (Pipeline + Écriture
     fusionnés ici). Calendrier natif shadcn, compact.
     - Pills-pipelines : bascule l'affichage, ▶ scan (Spinner pendant le scan),
       ⚙ éditeur de planning inline.
     - Créneaux : tirer sur une case vide en crée un (09:00), glisser le déplace,
       le glisser vers la corbeille le supprime. Clic droit sur un créneau :
       menu contextuel (supprimer / déplacer). Seule la prochaine occurrence de
       chaque créneau est affichée en chip — les répétitions deviennent de
       simples points.
     - Publications : agrégées en badge par jour, liste détaillée en Popover
       (reprogrammation via menu). -->
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
            @click="goTab(n.type)"
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
        <TabsTrigger value="amont">⚙ Amont</TabsTrigger>
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
            class="flex h-7 items-center gap-0.5 rounded-full border pl-1 pr-1 transition-colors"
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
            <TooltipProvider :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    :disabled="pipes.scanning.has(p.id)"
                    @click="runScan(p)"
                  >
                    <Spinner v-if="pipes.scanning.has(p.id)" class="size-3" />
                    <PlayIcon v-else />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Lancer un scan sur {{ p.name }}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    @click="toggleEditor(p.id)"
                  >
                    <SettingsIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Réglages du planning de {{ p.name }}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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

        <!-- Calendrier natif shadcn, compact -->
        <Card class="gap-0 overflow-hidden py-0">
          <!-- Barre d'outils : navigation + mois + prochain scan -->
          <div class="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <ButtonGroup aria-label="Navigation du mois">
              <Button variant="outline" size="sm" title="Mois précédent" @click="prevMonth">
                <ChevronLeftIcon />
              </Button>
              <Button variant="outline" size="sm" @click="goToday">Aujourd'hui</Button>
              <Button variant="outline" size="sm" title="Mois suivant" @click="nextMonth">
                <ChevronRightIcon />
              </Button>
            </ButtonGroup>
            <h2 class="text-sm font-semibold capitalize">{{ monthLabel }}</h2>
            <div class="ml-auto flex items-center gap-3">
              <Badge v-if="nextScanLabel" variant="outline" class="gap-1.5 px-2 py-0 font-mono text-[10px]">
                <span class="size-1.5 animate-pulse rounded-full bg-accent"></span>
                Prochain scan {{ nextScanLabel }}
              </Badge>
              <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span class="size-2 rounded-full bg-muted-foreground/70"></span>Publications
              </span>
            </div>
          </div>

          <template v-if="loaded">
            <!-- Jours de la semaine -->
            <div class="bg-muted/20 grid grid-cols-7 border-b">
              <div v-for="d in DAY_LABELS" :key="d" class="py-1 text-center text-[10px] font-medium tracking-wide text-muted-foreground">
                {{ d }}
              </div>
            </div>

            <!-- Grille du mois -->
            <div class="grid grid-cols-7 select-none" :class="drag ? 'cursor-grabbing' : ''">
              <div
                v-for="cell in cells"
                :key="cell.key"
                :data-date="cell.key"
                class="group relative min-h-[76px] border-r border-b border-border p-1"
                :class="[
                  !cell.inMonth ? 'bg-muted/10' : '',
                  dropKey === cell.key ? 'bg-accent/10 ring-1 ring-accent ring-inset' : '',
                ]"
                @pointerdown="onCellDown(cell, $event)"
              >
                <div class="flex items-center justify-between">
                  <span
                    class="flex size-5 items-center justify-center rounded-full text-[11px] font-medium"
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

                <div class="mt-1 space-y-0.5">
                  <!-- Créneaux : chip pour la prochaine occurrence, points pour les répétitions -->
                  <ContextMenu v-for="ev in cell.slots" :key="ev.id">
                    <ContextMenuTrigger
                      as-child
                      class="block w-full"
                      @pointerdown.stop="onEventDown(ev, $event)"
                    >
                      <div
                        class="event-chip"
                        :class="!ev.next ? 'event-chip-dot' : ''"
                        :style="ev.next ? { background: ev.color, color: ev.fg } : undefined"
                        :title="ev.tooltip"
                      >
                        <template v-if="ev.next">
                          <span class="event-time">{{ ev.timeLabel }}</span>
                          <span class="truncate">{{ ev.text }}</span>
                        </template>
                        <template v-else>
                          <span class="size-1.5 shrink-0 rounded-full" :style="{ background: ev.color }"></span>
                          <span class="font-mono tabular-nums">{{ ev.timeLabel }}</span>
                        </template>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent class="min-w-44">
                      <ContextMenuItem inset disabled class="pointer-events-none">
                        {{ ev.text }} · {{ ev.timeLabel }}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem inset @select="menuMoveSlot(ev, 1)">
                        <CalendarPlusIcon class="size-3.5" /> Déplacer à demain
                      </ContextMenuItem>
                      <ContextMenuItem inset @select="menuMoveSlot(ev, 7)">
                        <CalendarPlusIcon class="size-3.5" /> Déplacer à +7 jours
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem inset variant="destructive" @select="menuDeleteSlot(ev)">
                        <Trash2Icon class="size-3.5" /> Supprimer le créneau
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  <!-- Publications : badge agrégé + liste en Popover -->
                  <Popover v-if="cell.pubs.length">
                    <PopoverTrigger as-child>
                      <button
                        class="pub-badge"
                        :title="`${cell.pubs.length} publication${cell.pubs.length > 1 ? 's' : ''} le ${cell.date.toLocaleDateString('fr-FR')}`"
                        @pointerdown.stop
                        @click.stop
                      >
                        <SendIcon class="size-3" />
                        <span>{{ cell.pubs.length }}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" side="right" class="w-80 p-1.5">
                      <div class="flex items-center justify-between px-2 py-1">
                        <p class="text-xs font-semibold">{{ cell.pubs.length }} publication{{ cell.pubs.length > 1 ? 's' : '' }}</p>
                        <p class="text-muted-foreground text-[10px] capitalize">{{ cell.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) }}</p>
                      </div>
                      <div class="max-h-64 space-y-0.5 overflow-y-auto pr-0.5">
                        <div
                          v-for="pub in cell.pubs"
                          :key="pub.id"
                          class="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
                        >
                          <span class="font-mono text-[10px] text-muted-foreground tabular-nums">{{ pub.timeLabel }}</span>
                          <Badge variant="outline" class="h-4 shrink-0 px-1 font-mono text-[9px]">{{ pub.platform }}</Badge>
                          <span class="min-w-0 flex-1 truncate text-[11px]" :title="pub.tooltip">{{ pub.text }}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                              <Button variant="ghost" size="icon-xs" class="opacity-0 group-hover:opacity-100" @click.stop>
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem @select="reschedulePub(pub, 1)">
                                <CalendarPlusIcon class="size-3.5" /> Reprogrammer à demain
                              </DropdownMenuItem>
                              <DropdownMenuItem @select="reschedulePub(pub, 7)">
                                <CalendarPlusIcon class="size-3.5" /> Reprogrammer à +7 jours
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </template>

          <!-- Chargement initial : squelette de la grille -->
          <template v-else>
            <div class="grid grid-cols-7 gap-px bg-border p-px">
              <Skeleton v-for="i in 42" :key="i" class="h-[76px] rounded-none bg-muted/40" />
            </div>
          </template>
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

      <!-- ══ Amont : Collecte → Anti-doublons → Orchestrateur regroupés ══ -->
      <TabsContent value="amont" class="space-y-4">
        <Card class="gap-0 overflow-hidden py-0">
          <NavigationMenu :viewport="false" class="w-full">
            <NavigationMenuList class="w-full justify-start gap-0.5">
              <NavigationMenuItem v-for="s in AMONT_STEPS" :key="s.key">
                <NavigationMenuLink
                  as-child
                  :active="amontStep === s.key"
                  @select="amontStep = s.key"
                >
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    :class="amontStep === s.key ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                  >
                    <span>{{ s.icon }}</span>
                    <span>{{ s.label }}</span>
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </Card>
        <NodeSettings :node="nodeOf(amontStep)" />
      </TabsContent>

      <!-- ══ Tri : réglages + les blocs de ligne éditoriale que le filtre consomme ══ -->
      <TabsContent value="research" class="space-y-4">
        <NodeSettings :node="nodeOf('research')" />
        <EditorialBlocks node="research" />
      </TabsContent>

      <!-- ══ Image : réglages + les blocs que le choix des visuels consomme ══ -->
      <TabsContent value="media" class="space-y-4">
        <NodeSettings :node="nodeOf('media')" />
        <EditorialBlocks node="media" />
      </TabsContent>

      <!-- ══ Écriture : chaîne (stepper) + formats + modèles (EcriturePanel) ══ -->
      <TabsContent value="ecriture" class="space-y-4">
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
import { CalendarPlusIcon, ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon, PlayIcon, PlusIcon, SendIcon, SettingsIcon, Trash2Icon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { ButtonGroup } from '../components/ui/button-group'
import { Card } from '../components/ui/card'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../components/ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import { Input } from '../components/ui/input'
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from '../components/ui/navigation-menu'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../components/ui/select'
import { Skeleton } from '../components/ui/skeleton'
import { Spinner } from '../components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip'
import EcriturePanel from '../components/EcriturePanel.vue'
import EditorialBlocks from '../components/EditorialBlocks.vue'
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
const tab = ref('calendrier')
let refreshTimer: ReturnType<typeof setInterval> | null = null

const pipelines = computed(() => cfg.pipelines.filter(p => p.enabled !== false))
const editorPipeline = computed(() => pipelines.value.find(p => p.id === editorId.value) ?? null)
const sched = (p: PipelineInfo) => pipes.schedules[p.id]
function slotCount(p: PipelineInfo) { return pipes.slotCount(p) }
const loaded = computed(() => pipes.lastRefresh > 0)

// ── Onglets : chaque composant de la chaîne → son onglet de réglages ──
// Collecte / Anti-doublons / Orchestrateur sont regroupés dans l'onglet
// « Amont » (NavigationMenu) ; research et media ont leur propre onglet avec
// les blocs de la ligne éditoriale qu'ils consomment.
const AMONT_STEPS = [
  { key: 'ingestion', label: 'Collecte', icon: '◉' },
  { key: 'dedup', label: 'Anti-doublons', icon: '⬢' },
  { key: 'orchestrator', label: 'Orchestrateur', icon: '✸' },
]
const amontStep = ref('ingestion')
const TAB_BY_NODE: Record<string, string> = {
  ingestion: 'amont', dedup: 'amont', orchestrator: 'amont',
  research: 'research', editor: 'ecriture', media: 'media',
}
const tabOf = (nodeType: string) => TAB_BY_NODE[nodeType] ?? 'calendrier'
function goTab(nodeType: string) {
  const t = tabOf(nodeType)
  tab.value = t
  if (t === 'amont') amontStep.value = nodeType
}
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
function runScan(p: PipelineInfo) {
  pipes.scan(p)
  toast.success(`Scan lancé sur ${p.name} — le robot tourne en arrière-plan`)
}

// ── Prochain scan global (badge de la barre d'outils) ──
const nextScanLabel = computed(() => {
  let best: { mins: number; label: string } | null = null
  for (const p of pipelines.value) {
    const s = sched(p)
    if (!s || s.mode === 'pulse') continue
    for (const slot of s.weeklySlots ?? []) {
      const d = nextOccurrence(slot, new Date())
      const mins = Math.round((d.getTime() - Date.now()) / 60_000)
      const label = `${p.name} ${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} ${fmtClock(d)}`
      if (!best || mins < best.mins) best = { mins, label }
    }
  }
  if (!best) return ''
  const h = Math.floor(best.mins / 60)
  const m = best.mins % 60
  const dans = h >= 24 ? `dans ${Math.floor(h / 24)} j` : h > 0 ? `dans ${h} h${m ? ` ${m} min` : ''}` : `dans ${m} min`
  return `· ${best.label} (${dans})`
})

// ── Calendrier natif : grille mensuelle (semaine lundi→dimanche) ──
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAY_INDEX: Record<string, number> = { DIM: 0, LUN: 1, MAR: 2, MER: 3, JEU: 4, VEN: 5, SAM: 6 }

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
function fmtClock(d: Date) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// Prochaine occurrence (>= maintenant) d'un créneau hebdomadaire.
function nextOccurrence(slot: WeeklySlot, from: Date): Date {
  const [h, m] = String(slot.time ?? '08:00').split(':').map(Number)
  const dayIdx = DAY_INDEX[slot.day] ?? 0
  let diff = (dayIdx - from.getDay() + 7) % 7
  const cand = addDays(startOfDay(from), diff)
  cand.setHours(h || 0, m || 0, 0, 0)
  if (cand.getTime() <= from.getTime()) return addDays(cand, 7)
  return cand
}

const monthCursor = ref(startOfDay(new Date()))
const monthLabel = computed(() => monthCursor.value.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))

const gridStart = computed(() => {
  const first = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth(), 1)
  return addDays(first, -((first.getDay() + 6) % 7)) // lundi de la semaine du 1er
})
const gridEnd = computed(() => addDays(gridStart.value, 41))

function prevMonth() { monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() - 1, 1) }
function nextMonth() { monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + 1, 1) }
function goToday() { monthCursor.value = startOfDay(new Date()) }

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
  platform?: string
  next?: boolean
}

interface Cell {
  key: string
  date: Date
  day: number
  inMonth: boolean
  isToday: boolean
  slots: CalEvent[]
  pubs: CalEvent[]
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
  const slots = new Map<string, CalEvent[]>()
  const pubs = new Map<string, CalEvent[]>()
  const push = (map: Map<string, CalEvent[]>, ev: CalEvent) => {
    const arr = map.get(ev.key) ?? []
    arr.push(ev)
    map.set(ev.key, arr)
  }

  // Une seule chip par pipeline : le prochain passage global (comme la pill),
  // toutes les autres répétitions du mois deviennent de simples points.
  const now = new Date()
  const nextKeys = new Set<string>()
  for (const p of pipelines.value) {
    let best: Date | null = null
    for (const slot of sched(p)?.weeklySlots ?? []) {
      const occ = nextOccurrence(slot, now)
      if (!best || occ.getTime() < best.getTime()) best = occ
    }
    if (best) nextKeys.add(`${p.id}|${dateKey(best)}`)
  }

  for (const p of pipelines.value) {
    if (!visible.value.has(p.id)) continue
    const s = sched(p)
    if (!s) continue
    for (const slot of s.weeklySlots ?? []) {
      const [h, m] = String(slot.time ?? '08:00').split(':').map(Number)
      for (const d of occurrences(slot.day, gridStart.value, gridEnd.value)) {
        const st = new Date(d); st.setHours(h, m, 0, 0)
        push(slots, {
          id: `slot-${p.id}-${slot.day}-${slot.time}-${st.getTime()}`,
          key: dateKey(d), kind: 'slot', pipelineId: p.id,
          timeLabel: fmtClock(st), text: p.name,
          tooltip: `${p.name} — scan à ${fmtClock(st)} (tous les ${slot.day.toLowerCase()})`,
          color: p.color, fg: '#101010', date: d,
          day: slot.day, time: slot.time,
          next: nextKeys.has(`${p.id}|${dateKey(st)}`),
        })
      }
    }
  }
  for (const pub of pipes.publications) {
    const d = new Date(pub.scheduled_at)
    if (isNaN(d.getTime())) continue
    if (d < gridStart.value || d > gridEnd.value) continue
    const label = pubLabel(pub)
    push(pubs, {
      id: `pub-${pub.pipelineId}-${pub.id}`,
      key: dateKey(d), kind: 'pub', pipelineId: pub.pipelineId,
      timeLabel: fmtClock(d), text: label.slice(0, 44),
      tooltip: label,
      color: 'var(--muted-foreground)', fg: 'var(--background)', date: d,
      pubId: pub.id, platform: String(pub.platform ?? '').toUpperCase(),
    })
  }
  for (const arr of slots.values()) arr.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel))
  for (const arr of pubs.values()) arr.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel))
  return { slots, pubs }
})

const cells = computed<Cell[]>(() => {
  const out: Cell[] = []
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart.value, i)
    const key = dateKey(date)
    out.push({
      key,
      date,
      day: date.getDate(),
      inMonth: date.getMonth() === monthCursor.value.getMonth(),
      isToday: sameDay(date, today.value),
      slots: eventsByDay.value.slots.get(key) ?? [],
      pubs: eventsByDay.value.pubs.get(key) ?? [],
    })
  }
  return out
})

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
  await patchConfig(pid, { scheduling: { weeklySlots: [...cur, slot] } }, `Créneau ${slot.day} ${slot.time} ajouté`)
}

async function persistMoveEvent(ev: CalEvent, target: Date) {
  if (ev.kind === 'pub') {
    await reschedulePub(ev, Math.round((startOfDay(target).getTime() - startOfDay(ev.date).getTime()) / 86_400_000))
    return
  }
  const pid = ev.pipelineId
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  const next = cur.filter(s => !(s.day === ev.day && s.time === ev.time))
  const targetDay = Object.keys(DAY_INDEX).find(k => DAY_INDEX[k] === target.getDay()) ?? null
  if (targetDay && !next.some(s => s.day === targetDay && s.time === ev.time)) {
    next.push({ day: targetDay, time: ev.time! })
  }
  await patchConfig(pid, { scheduling: { weeklySlots: next } }, 'Créneau déplacé')
}

async function persistDeleteSlot(ev: CalEvent) {
  const pid = ev.pipelineId
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  await patchConfig(pid, { scheduling: { weeklySlots: cur.filter(s => !(s.day === ev.day && s.time === ev.time)) } }, 'Créneau supprimé')
}

// Menu contextuel : déplacer un créneau de N jours (réutilise le même chemin
// que le drag, donc mêmes règles de fusion/déplacement).
async function menuMoveSlot(ev: CalEvent, days: number) {
  await persistMoveEvent(ev, addDays(ev.date, days))
}
async function menuDeleteSlot(ev: CalEvent) {
  await persistDeleteSlot(ev)
}

async function reschedulePub(ev: CalEvent, days: number) {
  const at = new Date(ev.date)
  at.setDate(at.getDate() + days)
  const p = pipelines.value.find(x => x.id === ev.pipelineId)
  if (!p) return
  try {
    const res = await fetch(pipelineApiBase(p.port) + '/api/publications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(ev.pubId), scheduled_at: at.toISOString() }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    toast.success(days === 1 ? 'Publication reprogrammée à demain' : `Publication reprogrammée à +${days} jours`)
  } catch {
    toast.error('Reprogrammation impossible — daemon injoignable')
  }
  pipes.refresh(true)
}

async function patchConfig(pid: string, patch: any, okMsg = 'Planning enregistré') {
  const p = cfg.pipelines.find(x => x.id === pid)
  if (!p) return
  try {
    const res = await fetch(pipelineApiBase(p.port) + '/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    toast.success(okMsg)
  } catch {
    toast.error('Config non enregistrée — daemon injoignable')
  }
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
/* Répétitions d'un créneau : simple ligne discrète (point + heure). */
.event-chip-dot {
  padding: 0 4px;
  font-size: 9px;
  font-weight: 400;
  color: var(--muted-foreground);
  line-height: 1.6;
  gap: 3px;
  cursor: default;
}
.event-chip-dot:active {
  cursor: default;
}
/* Badge agrégé des publications du jour. */
.pub-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--muted);
  color: var(--muted-foreground);
  padding: 0 6px;
  font-size: 9px;
  font-weight: 600;
  line-height: 1.6;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.pub-badge:hover {
  background: var(--muted-foreground);
  color: var(--background);
}
</style>
