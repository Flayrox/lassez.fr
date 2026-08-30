<!-- AppShell — console multi-produits façon GCP, refaite avec shadcn-vue.
     SidebarProvider + Sidebar collapsible="icon" :
     - haut : produits (Signaux, Élections, Slide, Paramètres)
     - bas : pages du produit actif (badge = compteur en attente)
     Topbar : trigger, fil d'ariane, recherche ⌘K, Scan, PipelinePicker, statuts, avatar. -->
<template>
  <SidebarProvider>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" as-child>
              <router-link to="/">
                <div class="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <span class="text-sm font-bold">L</span>
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">Studio</span>
                  <span class="truncate text-xs">{{ activeProduct.label }}</span>
                </div>
              </router-link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <!-- Produits -->
        <SidebarGroup>
          <SidebarGroupLabel>Produits</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem v-for="p in products" :key="p.id">
              <SidebarMenuButton
                as-child
                :is-active="activeProduct.id === p.id"
                :tooltip="p.label"
                @click="goProduct(p)"
              >
                <button type="button">
                  <component :is="p.icon" />
                  <span>{{ p.label }}</span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <!-- Pages du produit actif -->
        <SidebarGroup>
          <SidebarGroupLabel>{{ activeProduct.label }}</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem v-for="pg in activeProduct.pages" :key="pg.to">
              <SidebarMenuButton
                as-child
                :is-active="route.path === pg.to"
                :tooltip="pg.label"
              >
                <router-link :to="pg.to">
                  <component :is="pg.icon" />
                  <span>{{ pg.label }}</span>
                  <SidebarMenuBadge
                    v-if="pg.badge && pg.badge() > 0"
                    class="border border-warning/40 bg-warning/10 text-warning"
                  >{{ pg.badge() }}</SidebarMenuBadge>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" as-child :tooltip="'Toi'">
              <button type="button" class="cursor-pointer">
                <Avatar size="sm" class="bg-gradient-to-br from-accent/60 to-info/60">
                  <AvatarFallback class="bg-transparent text-white font-medium">E</AvatarFallback>
                </Avatar>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-medium">Toi</span>
                  <span class="truncate text-xs">{{ daemonAlive ? 'daemon actif' : 'mode local' }}</span>
                </div>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>

    <SidebarInset>
      <!-- Topbar -->
      <header class="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur">
        <SidebarTrigger class="-ml-1" />
        <Separator orientation="vertical" class="mr-1 data-[orientation=vertical]:h-4" />

        <div class="flex items-center gap-2 select-none">
          <div class="bg-primary text-primary-foreground flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold">L</div>
          <span class="text-sm font-semibold tracking-tight">Studio</span>
          <template v-if="pageLabel">
            <span class="text-muted-foreground mx-0.5 text-xs">/</span>
            <span class="text-muted-foreground text-xs">{{ pageLabel }}</span>
          </template>
        </div>

        <Button
          variant="outline"
          size="sm"
          class="mx-auto hidden w-full max-w-80 justify-between gap-2 text-muted-foreground md:flex"
          @click="paletteOpen = true"
        >
          <span class="flex items-center gap-2">
            <SearchIcon />
            <span class="text-xs">Rechercher…</span>
          </span>
          <kbd class="bg-muted text-muted-foreground pointer-events-none inline-flex h-4 items-center gap-0.5 rounded border px-1 font-mono text-[10px] font-medium">⌘K</kbd>
        </Button>

        <div class="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            @click="onPaletteAction('scan')"
            :title="`Lancer un scan sur « ${cfg.activePipeline?.name ?? '—'} »`"
          >
            <PlayIcon data-icon="inline-start" />
            Scan
          </Button>
          <PipelinePicker />
          <Badge variant="outline" :class="saveStatus.cls" :title="saveStatus.title" class="hidden h-6 font-mono text-[10px] sm:inline-flex">
            {{ saveStatus.label }}
          </Badge>
          <Badge
            variant="outline"
            :class="qoeMock ? 'border-warning/40 text-warning' : 'border-accent/40 text-accent'"
            class="hidden h-6 font-mono text-[10px] lg:inline-flex"
          >{{ qoeMock ? 'QOE MOCK' : 'QOE LIVE' }}</Badge>
          <Badge
            variant="outline"
            :class="daemonAlive ? 'border-accent/40 text-accent' : 'text-muted-foreground'"
            class="hidden h-6 font-mono text-[10px] sm:inline-flex"
            :title="daemonTitle"
          >{{ daemonLabel }}</Badge>
          <Avatar size="sm" class="bg-gradient-to-br from-accent/60 to-info/60">
            <AvatarFallback class="bg-transparent text-white text-xs font-medium">E</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <div class="flex-1 p-6 lg:p-8">
        <slot />
      </div>
    </SidebarInset>

    <CommandPalette
      :groups="paletteGroups"
      :open="paletteOpen"
      @update:open="paletteOpen = $event"
      @action="onPaletteAction"
    />
  </SidebarProvider>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  RadioTowerIcon, VoteIcon, ClapperboardIcon, SettingsIcon,
  CalendarDaysIcon, WavesIcon, RssIcon, WorkflowIcon, PenLineIcon, SendIcon, CpuIcon,
  PlayIcon, SearchIcon,
} from '@lucide/vue'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger } from './components/ui/sidebar'
import { Avatar, AvatarFallback } from './components/ui/avatar'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Separator } from './components/ui/separator'
import CommandPalette from './components/CommandPalette.vue'
import PipelinePicker from './components/PipelinePicker.vue'
import { useConfigStore } from './stores/config'
import { useSystemStore } from './stores/system'

const route = useRoute()
const router = useRouter()
const paletteOpen = ref(false)
const cfg = useConfigStore()
const system = useSystemStore()

// Le thème vit sur <html>.
onMounted(() => {
  document.documentElement.setAttribute('data-theme', 'dark')
  system.fetchHealth()
})

// Auto-refresh léger (30s) pour la topbar + badges.
let heartbeat: ReturnType<typeof setInterval> | null = null
onMounted(() => { heartbeat = setInterval(() => system.fetchHealth(), 30_000) })
onUnmounted(() => { if (heartbeat) clearInterval(heartbeat) })

// ── Produits (sidebar) + leurs pages ──
interface Page { to: string; label: string; icon: Component; badge?: () => number }
interface Product { id: string; label: string; icon: Component; hint?: string; pages: Page[] }

const products: Product[] = [
  {
    id: 'signaux',
    label: 'Signaux',
    icon: RadioTowerIcon,
    pages: [
      // Pipeline + Écriture sont fusionnés dans le hub « Emploi du temps »
      // (un onglet par composant de la chaîne).
      { to: '/', label: 'Calendrier', icon: CalendarDaysIcon },
      { to: '/signaux', label: 'Signaux', icon: WavesIcon, badge: () => system.counts.PENDING ?? 0 },
      { to: '/sources', label: 'Sources', icon: RssIcon },
      { to: '/diffusion', label: 'Diffusion', icon: SendIcon },
    ],
  },
  { id: 'elections', label: 'Élections', icon: VoteIcon, pages: [{ to: '/elections', label: 'Élections', icon: VoteIcon }] },
  { id: 'slide', label: 'Slide', icon: ClapperboardIcon, hint: 'bientôt', pages: [{ to: '/slide', label: 'Slide', icon: ClapperboardIcon }] },
  { id: 'settings', label: 'Paramètres', icon: SettingsIcon, pages: [{ to: '/settings', label: 'Système', icon: CpuIcon }] },
]

// Anciens chemins (redirects actifs dans le router) → produit.
const legacyToProduct: Record<string, string> = {
  '/emploi-du-temps': 'signaux',
  '/atelier': 'signaux', '/filtres': 'signaux',
  '/ia': 'signaux', '/formats': 'signaux', '/partage': 'signaux',
  '/planning': 'signaux', '/schedule': 'signaux', '/hub': 'signaux',
  '/systeme': 'settings', '/users': 'settings',
}

const activeProduct = computed<Product>(() => {
  const path = route.path
  for (const p of products) if (p.pages.some(pg => pg.to === path)) return p
  if (legacyToProduct[path]) return products.find(p => p.id === legacyToProduct[path]) ?? products[0]
  return products[0]
})

const pageLabel = computed(() => {
  if (route.path === '/') return ''
  const pg = activeProduct.value.pages.find(x => x.to === route.path)
  return pg?.label ?? activeProduct.value.label
})

const paletteGroups = computed(() => [
  ...products.map(p => ({
    title: p.label,
    items: p.pages.map(pg => ({ to: pg.to, label: pg.label, icon: pg.icon })),
  })),
  { title: '⚡ Actions', items: [{ action: 'scan', label: 'Lancer un scan', icon: PlayIcon }] },
])

function goProduct(p: Product) {
  if (route.path === p.pages[0].to) return
  router.push(p.pages[0].to)
}

// ── Palette de commandes : le scan est réel (pipeline actif) ──
async function onPaletteAction(id: string) {
  if (id === 'scan' || id === 'trigger-scan') await system.triggerScan()
}

// ── Statuts réels du daemon ──
const daemonAlive = computed(() => !!system.daemon && !system.error)
const qoeMock = computed(() => system.daemon?.qoeMock ?? true)
const daemonLabel = computed(() => (daemonAlive.value ? '⚙ daemon' : '⚙ local'))
const daemonTitle = computed(() =>
  daemonAlive.value ? 'Daemon actif — config.yaml synchronisé' : 'Daemon injoignable — config locale (localStorage)'
)

// ── Indicateur de sauvegarde : tout est gardé automatiquement ──
const saveStatus = computed(() => {
  if (cfg.saveState === 'saving') return { label: 'Enregistrement…', cls: 'border-warning/40 text-warning bg-warning/10', title: 'Écriture en cours…' }
  if (cfg.dirty) return { label: 'Modifications en attente…', cls: 'border-warning/40 text-warning bg-warning/10', title: 'Sauvegarde dans quelques instants' }
  if (cfg.saveState === 'error') {
    if (!daemonAlive.value) return { label: '⚠ Daemon arrêté — en attente', cls: 'border-warning/40 text-warning bg-warning/10', title: 'Sauvegarde locale OK — config.yaml sera synchronisée automatiquement au redémarrage du daemon' }
    return { label: '⚠ Échec enregistrement', cls: 'border-destructive/40 text-destructive bg-destructive/10', title: "Impossible d'écrire la config — clique pour réessayer" }
  }
  if (cfg.lastSavedAt) {
    const hhmm = cfg.lastSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return { label: `✓ Enregistré ${hhmm}`, cls: 'border-accent/40 text-accent bg-accent/10', title: 'Tout est gardé (localStorage + config.yaml)' }
  }
  return { label: 'Autosave actif', cls: 'text-muted-foreground', title: 'Chaque modification est enregistrée automatiquement' }
})
</script>
