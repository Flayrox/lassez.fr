<!-- AppShell — console multi-produits façon GCP :
     ┌ topbar ──────────────────────────────────────────────┐
     ├ sur-sidebar (produits) ┬ sous-sidebar (pages) ┬ page ┤
     Chaque produit a ses pages ; Signaux contient tout le
     pipeline éditorial, dont le Calendrier en accueil. -->
<template>
  <div class="min-h-screen bg-bg text-text-1 flex flex-col">
    <!-- Topbar -->
    <header class="h-11 bg-surface border-b border-border flex items-center gap-2 px-3 sticky top-0 z-40 shrink-0">
      <button @click="collapsed = !collapsed" class="w-7 h-7 flex items-center justify-center text-text-3 hover:text-text-1 transition-colors" title="Menu">☰</button>
      <div class="flex items-center gap-2 select-none">
        <div class="w-[22px] h-[22px] rounded bg-accent text-accent-fg flex items-center justify-center font-bold text-[10px]">L</div>
        <span class="text-sm font-semibold tracking-tight">Studio</span>
        <template v-if="pageLabel">
          <span class="text-text-3 text-xs mx-0.5">/</span>
          <span class="text-xs text-text-2">{{ pageLabel }}</span>
        </template>
      </div>
      <button
        @click="$router.push('/'); (document.querySelector('body') as any).dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))"

        class="hidden md:flex ml-auto mr-auto items-center gap-2 h-7 px-2.5 min-w-[200px] rounded border border-border bg-bg text-text-3 text-xs hover:border-text-3/50 transition-colors"
      >
        <span>⌕</span><span class="flex-1 text-left">Rechercher…</span>
        <kbd class="font-mono text-[10px] border border-border rounded px-1">⌘K</kbd>
      </button>
      <div class="ml-auto flex items-center gap-2.5">
        <button
          @click="onPaletteAction('scan')"
          class="h-7 px-2 rounded border border-border text-[11px] text-text-2 hover:border-accent/50 hover:text-accent transition-colors"
          :title="`Lancer un scan sur « ${cfg.activePipeline?.name ?? '—'} »`"
        >▶ Scan</button>
        <PipelinePicker />
        <button
          @click="cfg.save()"
          class="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors"
          :class="saveStatus.cls"
          :title="saveStatus.title"
        >{{ saveStatus.label }}</button>
        <span
          class="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border"
          :class="qoeMock ? 'border-warning/40 text-warning bg-warning/5' : 'border-accent/40 text-accent bg-accent-muted'"
        >{{ qoeMock ? 'QOE MOCK' : 'QOE LIVE' }}</span>
        <span
          class="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border"
          :class="daemonAlive ? 'border-accent/40 text-accent bg-accent-muted' : 'border-border text-text-3'"
          :title="daemonTitle"
        >{{ daemonLabel }}</span>
        <div class="w-6 h-6 rounded-full bg-gradient-to-br from-accent/60 to-info/60 ring-1 ring-border cursor-pointer" title="Toi"></div>
      </div>
    </header>

    <div class="flex flex-1 min-h-0">
      <!-- Sur-sidebar : les produits -->
      <aside
        class="bg-surface border-r border-border flex flex-col sticky top-11 h-[calc(100vh-44px)] transition-all duration-150 shrink-0 py-2 px-1.5"
        :class="collapsed ? 'w-[48px]' : 'w-[76px]'"
      >
        <button
          v-for="p in products"
          :key="p.id"
          @click="goProduct(p)"
          class="w-full py-2.5 flex flex-col items-center gap-1 rounded-lg transition-colors mb-0.5 relative"
          :class="activeProduct.id === p.id ? 'bg-accent-muted text-accent' : 'text-text-2 hover:text-text-1 hover:bg-surface-hover'"
          :title="p.label"
        >
          <span v-if="activeProduct.id === p.id" class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r bg-accent"></span>
          <span class="text-base leading-none">{{ p.icon }}</span>
          <span v-if="!collapsed" class="text-[9px] leading-tight text-center">{{ p.label }}</span>
          <span v-if="!collapsed && p.hint" class="text-[8px] text-text-3/60 leading-none">{{ p.hint }}</span>
        </button>
      </aside>

      <!-- Sous-sidebar : les pages du produit actif -->
      <aside
        v-if="!collapsed && activeProduct.pages.length > 1"
        class="bg-surface border-r border-border hidden md:flex flex-col sticky top-11 h-[calc(100vh-44px)] w-[184px] shrink-0 py-3 px-2"
      >
        <p class="px-2 pb-2 text-[10px] font-medium uppercase tracking-wider text-text-3">{{ activeProduct.label }}</p>
        <router-link
          v-for="pg in activeProduct.pages"
          :key="pg.to"
          :to="pg.to"
          :title="pg.label"
          class="flex items-center gap-2.5 h-8 px-2 rounded text-xs font-medium transition-colors mb-0.5 relative"
          :class="route.path === pg.to ? 'bg-accent-muted text-accent' : 'text-text-2 hover:text-text-1 hover:bg-surface-hover'"
        >
          <span v-if="route.path === pg.to" class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-accent"></span>
          <span class="w-4 text-center text-sm opacity-70">{{ pg.icon }}</span>
          <span>{{ pg.label }}</span>
          <span
            v-if="pg.badge && pg.badge() > 0"
            class="ml-auto text-[10px] font-mono px-1.5 rounded-full border border-warning/40 text-warning bg-warning/5"
          >{{ pg.badge() }}</span>
        </router-link>
      </aside>

      <!-- Content -->
      <main class="flex-1 min-w-0 p-6 lg:p-8 max-w-6xl">
        <slot />
      </main>
    </div>

    <CommandPalette :groups="paletteGroups" @action="onPaletteAction" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CommandPalette from './components/CommandPalette.vue'
import PipelinePicker from './components/PipelinePicker.vue'
import { useConfigStore } from './stores/config'
import { useSystemStore } from './stores/system'

const route = useRoute()
const router = useRouter()
const collapsed = ref(false)
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

// ── Produits (sur-sidebar) + leurs pages (sous-sidebar) ──
interface Page { to: string; label: string; icon: string; badge?: () => number }
interface Product { id: string; label: string; icon: string; hint?: string; pages: Page[] }

const products: Product[] = [
  {
    id: 'signaux',
    label: 'Signaux',
    icon: '📡',
    pages: [
      { to: '/', label: 'Calendrier', icon: '🗓' },
      { to: '/signaux', label: 'Signaux', icon: '▤', badge: () => system.counts.PENDING ?? 0 },
      { to: '/sources', label: 'Sources', icon: '◎' },
      { to: '/pipeline', label: 'Pipeline', icon: '⇶' },
      { to: '/ecriture', label: 'Écriture', icon: '✎' },
      { to: '/diffusion', label: 'Diffusion', icon: '↗' },
    ],
  },
  { id: 'elections', label: 'Élections', icon: '🗳', pages: [{ to: '/elections', label: 'Élections', icon: '🗳' }] },
  { id: 'slide', label: 'Slide', icon: '🎞', hint: 'bientôt', pages: [{ to: '/slide', label: 'Slide', icon: '🎞' }] },
  { id: 'settings', label: 'Paramètres', icon: '⚙', pages: [{ to: '/settings', label: 'Système', icon: '⬡' }] },
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
  { title: '⚡ Actions', items: [{ action: 'scan', label: 'Lancer un scan', icon: '▶' }] },
])

function goProduct(p: Product) {
  if (route.path === p.pages[0].to) return
  // Le module à venir n'a pas de page réelle à montrer.
  router.push(p.pages[0].to)
}

// ── Palme de commandes : le scan est réel (pipeline actif) ──
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
  if (cfg.saveState === 'saving') return { label: 'Enregistrement…', cls: 'text-warning border-warning/40 bg-warning/5', title: 'Écriture en cours…' }
  if (cfg.dirty) return { label: 'Modifications en attente…', cls: 'text-warning border-warning/40 bg-warning/5', title: 'Sauvegarde dans quelques instants' }
  if (cfg.saveState === 'error') {
    if (!daemonAlive.value) return { label: '⚠ Daemon arrêté — en attente', cls: 'text-warning border-warning/40 bg-warning/5', title: 'Sauvegarde locale OK — config.yaml sera synchronisée automatiquement au redémarrage du daemon' }
    return { label: '⚠ Échec enregistrement', cls: 'text-danger border-danger/40 bg-danger/10', title: "Impossible d'écrire la config — clique pour réessayer" }
  }
  if (cfg.lastSavedAt) {
    const hhmm = cfg.lastSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return { label: `✓ Enregistré ${hhmm}`, cls: 'text-accent border-accent/40 bg-accent-muted', title: 'Tout est gardé (localStorage + config.yaml)' }
  }
  return { label: 'Autosave actif', cls: 'text-text-3 border-border', title: 'Chaque modification est enregistrée automatiquement' }
})
</script>
