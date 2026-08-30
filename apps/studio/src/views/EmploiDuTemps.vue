<!-- Emploi du temps — hub du produit Signaux : le calendrier + un onglet par
     étape de la chaîne. Collecte, Anti-doublons et Orchestrateur sont réunis
     dans l'onglet « Amont » sans sous-onglets : toutes les cartes empilées,
     toutes visibles d'un coup. Calendrier natif shadcn, compact.
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
          <!-- Cadence : publications (offset scan → pub) + fenêtre d'activité -->
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 pt-3">
            <p class="text-xs font-medium">Publications</p>
            <span class="text-muted-foreground text-xs">X min après le scan</span>
            <Input
              type="number"
              min="0"
              max="1440"
              class="h-7 w-16"
              :model-value="sched(editorPipeline)?.publishOffsetMinutes"
              @update:model-value="(v) => setPublishOffset(editorPipeline, Number(v))"
            />
            <span class="text-muted-foreground text-xs">· pipeline active du</span>
            <Input type="date" class="h-7 w-36" :model-value="sched(editorPipeline)?.activeFrom" @update:model-value="(v) => setActive(editorPipeline, 'activeFrom', String(v))" />
            <span class="text-muted-foreground text-xs">au</span>
            <Input type="date" class="h-7 w-36" :model-value="sched(editorPipeline)?.activeUntil" @update:model-value="(v) => setActive(editorPipeline, 'activeUntil', String(v))" />
            <Button variant="ghost" size="sm" class="text-destructive h-6 text-[10px] hover:text-destructive" @click="clearActive(editorPipeline)">↺ Infini</Button>
          </div>
        </Card>

        <!-- Calendrier natif shadcn, compact et enrichi -->
        <Card class="gap-0 overflow-hidden py-0">
          <!-- Barre d'outils : navigation + bascule de vue + bouton + Programmer + alertes -->
          <div class="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
            <!-- Navigation de date -->
            <div class="flex items-center gap-2">
              <ButtonGroup aria-label="Navigation du calendrier">
                <Button variant="outline" size="sm" title="Précédent" @click="prevPeriod">
                  <ChevronLeftIcon />
                </Button>
                <Button variant="outline" size="sm" @click="goToday">Aujourd'hui</Button>
                <Button variant="outline" size="sm" title="Suivant" @click="nextPeriod">
                  <ChevronRightIcon />
                </Button>
              </ButtonGroup>
              <h2 class="text-sm font-semibold capitalize min-w-36">{{ viewTitleLabel }}</h2>
            </div>

            <!-- Bascule de vue (Mois / Semaine / Jour) & Bouton d'action -->
            <div class="flex flex-wrap items-center gap-2">
              <CalendarConflictBadge :conflicts="detectedConflicts" />

              <Tabs v-model="calendarViewMode" class="h-8">
                <TabsList class="h-8 p-0.5">
                  <TabsTrigger value="month" class="h-7 text-xs px-2.5">Mois</TabsTrigger>
                  <TabsTrigger value="week" class="h-7 text-xs px-2.5">Semaine</TabsTrigger>
                  <TabsTrigger value="day" class="h-7 text-xs px-2.5">Jour</TabsTrigger>
                </TabsList>
              </Tabs>

              <Button size="sm" class="h-8 gap-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90 font-medium" @click="openQuickAdd()">
                <PlusIcon class="size-3.5" /> Programmer
              </Button>
            </div>
          </div>

          <!-- Sous-barre d'information : Prochain scan, Semaine A/B, Légendes -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
            <div class="flex items-center gap-3">
              <Badge v-if="nextScanLabel" variant="outline" class="gap-1.5 px-2 py-0 font-mono text-[10px]">
                <span class="size-1.5 animate-pulse rounded-full bg-accent"></span>
                Prochain scan {{ nextScanLabel }}
              </Badge>
              <Badge variant="outline" class="gap-1 px-2 py-0 font-mono text-[10px]" :title="'Les créneaux marqués A/B ne tournent que les semaines impaires/paires (ISO)'">
                Semaine {{ currentWeek }}
              </Badge>
            </div>
            <div class="flex items-center gap-3 text-[11px]">
              <span class="flex items-center gap-1.5">
                <span class="size-2 rounded-full bg-primary/70"></span> Scan automatique
              </span>
              <span class="flex items-center gap-1.5">
                <span class="size-2 rounded-full bg-muted-foreground/70"></span> Publication programmée
              </span>
            </div>
          </div>

          <template v-if="loaded">
            <!-- VUE SEMAINE (Grille horaire) -->
            <CalendarWeekView
              v-if="calendarViewMode === 'week'"
              :start-date="weekStartCursor"
              :events-by-day="eventsByDay"
              @create-slot="(d, time) => openQuickAdd(d, time)"
              @edit-event="(ev) => openEditEvent(ev)"
              @delete-event="(ev) => persistDeleteSlot(ev)"
              @move-event="(ev, targetDate) => persistMoveEvent(ev, targetDate)"
            />

            <!-- VUE JOUR (Timeline détaillée) -->
            <CalendarDayView
              v-else-if="calendarViewMode === 'day'"
              :day-date="monthCursor"
              :events-by-day="eventsByDay"
              @create-slot="(d, time) => openQuickAdd(d, time)"
              @edit-event="(ev) => openEditEvent(ev)"
              @delete-event="(ev) => persistDeleteSlot(ev)"
            />

            <!-- VUE MOIS (Grille mensuelle) -->
            <div v-else>
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
                  class="group relative min-h-[76px] border-r border-b border-border p-1 hover:bg-muted/10 transition-colors"
                  :class="[
                    !cell.inMonth ? 'bg-muted/10' : '',
                    dropKey === cell.key ? 'bg-accent/10 ring-1 ring-accent ring-inset' : '',
                  ]"
                  @pointerdown="onCellDown(cell, $event)"
                >
                  <div class="flex items-center justify-between">
                    <button
                      type="button"
                      class="flex size-5 items-center justify-center rounded-full text-[11px] font-medium transition-transform hover:scale-110"
                      :class="cell.isToday ? 'bg-primary text-primary-foreground' : cell.inMonth ? 'text-foreground' : 'text-muted-foreground/50'"
                      @click.stop="monthCursor = cell.date; calendarViewMode = 'day'"
                      :title="`Ouvrir la journée du ${cell.date.toLocaleDateString('fr-FR')}`"
                    >
                      {{ cell.day }}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      class="opacity-0 transition-opacity group-hover:opacity-100"
                      :title="`Programmer le ${cell.date.toLocaleDateString('fr-FR')}`"
                      @pointerdown.stop
                      @click.stop="openQuickAdd(cell.date, '09:00')"
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
                          class="event-chip cursor-pointer"
                          :class="!ev.next ? 'event-chip-dot' : ''"
                          :style="ev.next ? { background: ev.color, color: ev.fg } : undefined"
                          :title="ev.tooltip"
                          @click.stop="openEditEvent(ev)"
                        >
                          <template v-if="ev.next">
                            <span class="event-time">{{ ev.timeLabel }}</span>
                            <span v-if="ev.week" class="rounded border px-0.5 text-[8px] leading-tight">{{ ev.week }}</span>
                            <span class="truncate">{{ ev.text }}</span>
                            <span v-if="ev.publishLabel" class="shrink-0 text-[9px] font-semibold">{{ ev.publishLabel }}</span>
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
                        <ContextMenuItem inset @select="openEditEvent(ev)">
                          <SettingsIcon class="size-3.5" /> Modifier les options…
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem inset @select="duplicateSlot(ev, 'tomorrow')">
                          <CopyIcon class="size-3.5" /> Dupliquer à demain
                        </ContextMenuItem>
                        <ContextMenuItem inset @select="duplicateSlot(ev, 'weekdays')">
                          <CopyIcon class="size-3.5" /> Copier sur Lun-Ven (Semaine)
                        </ContextMenuItem>
                        <ContextMenuItem inset @select="duplicateSlot(ev, 'all')">
                          <CopyIcon class="size-3.5" /> Copier sur Tous les jours
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem inset @select="setSlotWeek(ev, 'A')" :class="ev.week === 'A' ? 'text-accent' : ''">
                          Semaine A (impaire)
                        </ContextMenuItem>
                        <ContextMenuItem inset @select="setSlotWeek(ev, 'B')" :class="ev.week === 'B' ? 'text-accent' : ''">
                          Semaine B (paire)
                        </ContextMenuItem>
                        <ContextMenuItem inset @select="setSlotWeek(ev, '')">
                          Toutes les semaines
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem inset @select="openSlotPublish(ev)">
                          <ClockIcon class="size-3.5" /> Heure de publication…
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

                    <!-- Publications planifiées (cadence) : pointillés discrets -->
                    <div
                      v-for="ev in cell.plans"
                      :key="ev.id"
                      class="event-chip event-chip-plan"
                      :title="ev.tooltip"
                    >
                      <SendIcon class="size-2.5 shrink-0" />
                      <span class="font-mono tabular-nums">{{ ev.timeLabel }}</span>
                    </div>

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
            </div>
          </template>

          <!-- Chargement initial : squelette de la grille -->
          <template v-else>
            <div class="grid grid-cols-7 gap-px bg-border p-px">
              <Skeleton v-for="i in 42" :key="i" class="h-[76px] rounded-none bg-muted/40" />
            </div>
          </template>
        </Card>

        <!-- Modale universelle de création/édition de créneau & publication -->
        <SlotEditorDialog
          :open="slotDialogOpen"
          :initial-date="dialogInitialDate"
          :initial-time="dialogInitialTime"
          :initial-pipeline-id="dialogInitialPipelineId"
          :edit-event="dialogEditEvent"
          @update:open="(v) => slotDialogOpen = v"
          @saved="refreshAll"
        />

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

      <!-- ══ Amont : Collecte → Anti-doublons → Orchestrateur en 3 colonnes ══ -->
      <!-- Pas de sous-onglets ni de repli : chaque étape est une carte compacte
           toujours visible (résumé + champs), posée en colonne côte à côte.
           La liste vient de store.atelier filtré sur AMONT_NODES — ajouter un
           type ici = il apparaît dans l'onglet. -->
      <TabsContent value="amont" class="space-y-3">
        <p class="text-muted-foreground text-xs">Collecte, Anti-doublons et Orchestrateur côte à côte — tout est visible, rien à déplier.</p>
        <div class="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="n in amontSteps" :id="`amont-${n.type}`" :key="n.type" class="scroll-mt-4">
            <NodeSettings :node="n" />
          </div>
        </div>
      </TabsContent>

      <!-- ══ Tri : réglages et ligne éditoriale côte à côte (2 colonnes) ══ -->
      <TabsContent value="research" class="space-y-3">
        <div class="grid items-start gap-3 xl:grid-cols-2">
          <NodeSettings :node="nodeOf('research')" />
          <EditorialBlocks node="research" />
        </div>
      </TabsContent>

      <!-- ══ Image : réglages et choix des visuels côte à côte (2 colonnes) ══ -->
      <TabsContent value="media" class="space-y-3">
        <div class="grid items-start gap-3 xl:grid-cols-2">
          <NodeSettings :node="nodeOf('media')" />
          <EditorialBlocks node="media" />
        </div>
      </TabsContent>

      <!-- ══ Écriture : chaîne (stepper) + formats + modèles (EcriturePanel) ══ -->
      <TabsContent value="ecriture" class="space-y-4">
        <EcriturePanel />
      </TabsContent>
    </Tabs>

    <!-- Heure de publication d'un créneau (Dialog) : vide = offset du pipeline -->
    <Dialog :open="!!slotEditor" @update:open="(v: boolean) => { if (!v) slotEditor = null }">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Heure de publication — {{ slotEditor?.text }} {{ slotEditor?.timeLabel }}</DialogTitle>
          <DialogDescription>Laisse vide pour publier X minutes après le scan (offset du pipeline, réglable dans ⚙).</DialogDescription>
        </DialogHeader>
        <div class="space-y-2">
          <Input type="time" class="h-8" :model-value="slotPublish" @update:model-value="(v) => slotPublish = String(v)" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="slotPublish = ''">Offset par défaut</Button>
          <Button @click="saveSlotPublish">OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { CalendarPlusIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, CopyIcon, MoreHorizontalIcon, PlayIcon, PlusIcon, SendIcon, SettingsIcon, Trash2Icon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { ButtonGroup } from '../components/ui/button-group'
import { Card } from '../components/ui/card'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../components/ui/context-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import { Input } from '../components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../components/ui/select'
import { Skeleton } from '../components/ui/skeleton'
import { Spinner } from '../components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip'
import EcriturePanel from '../components/EcriturePanel.vue'
import EditorialBlocks from '../components/EditorialBlocks.vue'
import NodeSettings from '../components/NodeSettings.vue'
import CalendarConflictBadge, { type ConflictItem } from '../components/calendar/CalendarConflictBadge.vue'
import CalendarDayView from '../components/calendar/CalendarDayView.vue'
import CalendarWeekView from '../components/calendar/CalendarWeekView.vue'
import SlotEditorDialog from '../components/calendar/SlotEditorDialog.vue'
import { useConfigStore, type PipelineInfo, type WeeklySlot } from '../stores/config'
import { usePipelinesStore } from '../stores/pipelines'
import { useSystemStore } from '../stores/system'
import { pipelineApiBase } from '../lib/api'

const cfg = useConfigStore()
const store = useConfigStore()
const pipes = usePipelinesStore()
const system = useSystemStore()

const today = ref(new Date())
const calendarViewMode = ref<'month' | 'week' | 'day'>('month')
const slotDialogOpen = ref(false)
const dialogInitialDate = ref<Date | undefined>(undefined)
const dialogInitialTime = ref<string | undefined>(undefined)
const dialogInitialPipelineId = ref<string | undefined>(undefined)
const dialogEditEvent = ref<any>(null)
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
// « Amont » SANS sous-onglets : les cartes sont empilées et toutes visibles.
// La liste des étapes de l'amont est pilotée par la config — un nœud ajouté
// à AMONT_NODES (et présent dans la chaîne store.atelier) apparaît d'office.
const AMONT_NODES = new Set(['ingestion', 'dedup', 'orchestrator'])
const amontSteps = computed(() => store.atelier.filter(n => AMONT_NODES.has(n.type)))
const TAB_BY_NODE: Record<string, string> = {
  ingestion: 'amont', dedup: 'amont', orchestrator: 'amont',
  research: 'research', editor: 'ecriture', media: 'media',
}
const tabOf = (nodeType: string) => TAB_BY_NODE[nodeType] ?? 'calendrier'
function goTab(nodeType: string) {
  const t = tabOf(nodeType)
  tab.value = t
  // Amont = une seule vue : la pill de la chaîne saute directement à la carte.
  if (t === 'amont') {
    nextTick(() => {
      document.getElementById(`amont-${nodeType}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
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
const weekStartCursor = computed(() => {
  const d = new Date(monthCursor.value)
  const day = (d.getDay() + 6) % 7 // lundi = 0
  return addDays(d, -day)
})

const viewTitleLabel = computed(() => {
  if (calendarViewMode.value === 'month') {
    return monthCursor.value.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }
  if (calendarViewMode.value === 'week') {
    const end = addDays(weekStartCursor.value, 6)
    const m1 = weekStartCursor.value.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    const m2 = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${m1} – ${m2}`
  }
  return monthCursor.value.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})

const monthLabel = computed(() => viewTitleLabel.value)

const gridStart = computed(() => {
  const first = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth(), 1)
  return addDays(first, -((first.getDay() + 6) % 7)) // lundi de la semaine du 1er
})
const gridEnd = computed(() => addDays(gridStart.value, 41))

function prevPeriod() {
  if (calendarViewMode.value === 'month') {
    monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() - 1, 1)
  } else if (calendarViewMode.value === 'week') {
    monthCursor.value = addDays(monthCursor.value, -7)
  } else {
    monthCursor.value = addDays(monthCursor.value, -1)
  }
}
function nextPeriod() {
  if (calendarViewMode.value === 'month') {
    monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + 1, 1)
  } else if (calendarViewMode.value === 'week') {
    monthCursor.value = addDays(monthCursor.value, 7)
  } else {
    monthCursor.value = addDays(monthCursor.value, 1)
  }
}
function prevMonth() { prevPeriod() }
function nextMonth() { nextPeriod() }
function goToday() { monthCursor.value = startOfDay(new Date()) }

function openQuickAdd(d?: Date, time?: string) {
  dialogInitialDate.value = d || new Date()
  dialogInitialTime.value = time || '09:00'
  dialogInitialPipelineId.value = cfg.activePipelineId
  dialogEditEvent.value = null
  slotDialogOpen.value = true
}

function openEditEvent(ev: any) {
  dialogInitialDate.value = ev.date
  dialogInitialTime.value = ev.time || ev.timeLabel
  dialogInitialPipelineId.value = ev.pipelineId
  dialogEditEvent.value = ev
  slotDialogOpen.value = true
}

// ── Détection des conflits d'horaires (ex: 2 pipelines qui tournent à la même minute) ──
const detectedConflicts = computed<ConflictItem[]>(() => {
  const conflicts: ConflictItem[] = []
  const timeMap = new Map<string, { pid: string; name: string }[]>()

  for (const p of pipelines.value) {
    const s = sched(p)
    if (!s) continue
    for (const slot of s.weeklySlots ?? []) {
      const key = `${slot.day}-${slot.time}`
      const arr = timeMap.get(key) ?? []
      arr.push({ pid: p.id, name: p.name })
      timeMap.set(key, arr)
    }
  }

  for (const [key, list] of timeMap.entries()) {
    if (list.length > 1) {
      const [day, time] = key.split('-')
      conflicts.push({
        day,
        time,
        pipelines: list.map(x => x.name),
        reason: 'Scans simultanés programmés à la même minute',
      })
    }
  }
  return conflicts
})

interface CalEvent {
  id: string
  key: string
  kind: 'slot' | 'pub' | 'plan'
  pipelineId: string
  timeLabel: string
  text: string
  tooltip: string
  color: string
  fg: string
  date: Date
  day?: string
  time?: string
  week?: 'A' | 'B'
  publish?: string
  publishLabel?: string
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
  plans: CalEvent[]
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
  const plans = new Map<string, CalEvent[]>()
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
      const pubTime = pubTimeOf(slot, p.id)
      for (const d of occurrences(slot.day, gridStart.value, gridEnd.value)) {
        const st = new Date(d); st.setHours(h, m, 0, 0)
        push(slots, {
          id: `slot-${p.id}-${slot.day}-${slot.time}-${st.getTime()}`,
          key: dateKey(d), kind: 'slot', pipelineId: p.id,
          timeLabel: fmtClock(st), text: p.name,
          tooltip: `${p.name} — scan à ${fmtClock(st)} (${slot.day.toLowerCase()}${slot.week ? `, semaine ${slot.week}` : ''})${pubTime ? ` · publication ${pubTime}` : ''}`,
          color: p.color, fg: '#101010', date: d,
          day: slot.day, time: slot.time,
          week: slot.week,
          publish: slot.publish,
          publishLabel: pubTime ? `→ ${pubTime}` : undefined,
          next: nextKeys.has(`${p.id}|${dateKey(st)}`),
        })
      }
    }
  }
  // Publications PLANIFIÉES (cadence) : scan + offset ou heure explicite —
  // les pointsillés montrent le plan, les badges pleins les vraies missions.
  for (const p of pipelines.value) {
    if (!visible.value.has(p.id)) continue
    const s = sched(p)
    if (!s) continue
    for (const slot of s.weeklySlots ?? []) {
      const pt = pubTimeOf(slot, p.id)
      if (!pt) continue
      const [ph, pm] = pt.split(':').map(Number)
      for (const d of occurrences(slot.day, gridStart.value, gridEnd.value)) {
        const st = new Date(d); st.setHours(ph, pm, 0, 0)
        push(plans, {
          id: `plan-${p.id}-${slot.day}-${slot.time}-${st.getTime()}`,
          key: dateKey(d), kind: 'plan', pipelineId: p.id,
          timeLabel: fmtClock(st), text: `${p.name} — publication planifiée`,
          tooltip: `${p.name} — publication prévue à ${fmtClock(st)} (scan ${slot.time}${slot.publish ? '' : ' + offset'})`,
          color: p.color, fg: '#101010', date: d,
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
  for (const arr of plans.values()) arr.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel))
  return { slots, pubs, plans }
})

// Heure de publication d'un créneau : explicite (slot.publish) sinon
// scan + offset du pipeline (défaut 30 min).
function pubTimeOf(slot: WeeklySlot, pipelineId: string): string | null {
  if (slot.publish) return slot.publish
  const offset = pipes.schedules[pipelineId]?.publishOffsetMinutes ?? 30
  const [h, m] = String(slot.time ?? '').split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const total = (h * 60 + m + offset) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

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
      plans: eventsByDay.value.plans.get(key) ?? [],
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

// Duplication d'un créneau sur d'autres jours
async function duplicateSlot(ev: CalEvent, target: 'tomorrow' | 'weekdays' | 'all') {
  const pid = ev.pipelineId
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  let targetDays: string[] = []

  if (target === 'tomorrow') {
    const nextDate = addDays(ev.date, 1)
    const day = Object.keys(DAY_INDEX).find(k => DAY_INDEX[k] === nextDate.getDay())
    if (day) targetDays = [day]
  } else if (target === 'weekdays') {
    targetDays = ['LUN', 'MAR', 'MER', 'JEU', 'VEN']
  } else if (target === 'all') {
    targetDays = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
  }

  const nextSlots = [...cur]
  let addedCount = 0

  for (const d of targetDays) {
    if (!nextSlots.some(s => s.day === d && s.time === ev.time && s.week === ev.week)) {
      nextSlots.push({
        day: d,
        time: ev.time!,
        week: ev.week,
        publish: ev.publish,
      })
      addedCount++
    }
  }

  if (addedCount > 0) {
    await patchConfig(pid, { scheduling: { weeklySlots: nextSlots } }, `Créneau copié sur ${addedCount} jour(s)`)
  } else {
    toast.info('Ce créneau existe déjà sur les jours ciblés')
  }
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

// ── Cadence : semaine A/B, heure de publication, fenêtre d'activité ──
function isoWeekNumber(d: Date): number {
  const t = new Date(d)
  const day = (t.getDay() + 6) % 7
  t.setDate(t.getDate() - day + 3)
  const firstThursday = new Date(t.getFullYear(), 0, 4)
  const fDay = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - fDay + 3)
  return 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7)
}
// Semaine ISO impaire = A, paire = B (même règle que le daemon).
const currentWeek = computed(() => (isoWeekNumber(today.value) % 2 === 1 ? 'A' : 'B'))

async function setSlotWeek(ev: CalEvent, week: 'A' | 'B' | '') {
  const pid = ev.pipelineId
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  const next = cur.map(s => (s.day === ev.day && s.time === ev.time ? { ...s, week: week || undefined } : s))
  await patchConfig(pid, { scheduling: { weeklySlots: next } }, `Créneau ${ev.day} ${ev.time} — ${week ? `semaine ${week}` : 'toutes les semaines'}`)
}

const slotEditor = ref<CalEvent | null>(null)
const slotPublish = ref('')
function openSlotPublish(ev: CalEvent) {
  slotEditor.value = ev
  slotPublish.value = ev.publish ?? ''
}
async function saveSlotPublish() {
  const ev = slotEditor.value
  if (!ev) return
  const pid = ev.pipelineId
  const cur = pipes.schedules[pid]?.weeklySlots ?? []
  const v = slotPublish.value.trim()
  const next = cur.map(s => (s.day === ev.day && s.time === ev.time ? { ...s, publish: v || undefined } : s))
  await patchConfig(pid, { scheduling: { weeklySlots: next } }, v ? `Publication ${ev.day} ${ev.time} → ${v}` : 'Publication par défaut (offset du pipeline)')
  slotEditor.value = null
}

async function setPublishOffset(p: PipelineInfo, minutes: number) {
  if (Number.isNaN(minutes) || minutes < 0) return
  if (pipes.schedules[p.id]) pipes.schedules[p.id].publishOffsetMinutes = minutes
  await patchConfig(p.id, { scheduling: { publishOffsetMinutes: minutes } })
}
async function setActive(p: PipelineInfo, key: 'activeFrom' | 'activeUntil', v: string) {
  if (pipes.schedules[p.id]) pipes.schedules[p.id][key] = v
  await patchConfig(p.id, { scheduling: { [key]: v } })
}
async function clearActive(p: PipelineInfo) {
  if (pipes.schedules[p.id]) { pipes.schedules[p.id].activeFrom = ''; pipes.schedules[p.id].activeUntil = '' }
  await patchConfig(p.id, { scheduling: { activeFrom: '', activeUntil: '' } })
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
/* Publications planifiées (cadence) : pointillés discrets. */
.event-chip-plan {
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--muted-foreground);
  cursor: default;
}
.event-chip-plan:active {
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
