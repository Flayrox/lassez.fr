<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CommandPalette from './components/CommandPalette.vue'
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

// Auto-refresh léger (30s) pour la sidebar + topbar.
let heartbeat: ReturnType<typeof setInterval> | null = null
onMounted(() => { heartbeat = setInterval(() => system.fetchHealth(), 30_000) })
onUnmounted(() => { if (heartbeat) clearInterval(heartbeat) })

// ── 4 blocs de navigation (la chaîne du pipeline) ──
const navGroups = [
  {
    title: '📥 Entre',
    items: [
      { to: '/sources', label: 'Sources', icon: '◎' },
    ],
  },
  {
    title: '⚙️ Transforme',
    items: [
      { to: '/pipeline', label: 'Pipeline', icon: '⇶' },
      { to: '/atelier', label: 'Atelier', icon: '⬢' },
      { to: '/ecriture', label: 'Écriture', icon: '✎' },
    ],
  },
  {
    title: '📤 Sort',
    items: [
      { to: '/diffusion', label: 'Diffusion', icon: '↗' },
    ],
  },
  {
    title: '🎛️ Pilote',
    items: [
      { to: '/', label: 'Vue d\'ensemble', icon: '◉' },
      { to: '/signaux', label: 'Signaux', icon: '▤' },
      { to: '/systeme', label: 'Système', icon: '⬡' },
      { action: 'scan', label: 'Lancer un scan maintenant', icon: '▶' },
    ],
  },
]

const allItems = navGroups.flatMap(g => g.items.map(i => ({ group: g.title, ...i })))

// ── Palme de commandes : le scan est réel ──
async function onPaletteAction(id: string) {
  if (id === 'scan' || id === 'trigger-scan') await system.triggerScan()
}

// ── Statuts réels du daemon ──
const daemonAlive = computed(() => !!system.daemon && !system.error)
const qoeMock = computed(() => system.daemon?.qoeMock ?? true)
const daemonLabel = computed(() => {
  if (daemonAlive.value) return '⚙ daemon'
  return '⚙ local'
})
const daemonTitle = computed(() => {
  if (daemonAlive.value) return 'Daemon actif — config.yaml synchronisé'
  return 'Daemon injoignable — config locale (localStorage)'
})

// ── Indicateur de sauvegarde : tout est gardé automatiquement ──
const saveStatus = computed(() => {
  if (cfg.saveState === 'saving') return { label: 'Enregistrement…', cls: 'text-warning border-warning/40 bg-warning/5', title: 'Écriture en cours…' }
  if (cfg.dirty) return { label: 'Modifications en attente…', cls: 'text-warning border-warning/40 bg-warning/5', title: 'Sauvegarde dans quelques instants' }
  if (cfg.saveState === 'error') {
    if (!daemonAlive.value) return { label: '⚠ Daemon arrêté — en attente', cls: 'text-warning border-warning/40 bg-warning/5', title: 'Sauvegarde locale OK — config.yaml sera synchronisée automatiquement au redémarrage du daemon' }
    return { label: '⚠ Échec enregistrement', cls: 'text-danger border-danger/40 bg-danger/10', title: 'Impossible d\'écrire la config — clique pour réessayer' }
  }
  if (cfg.lastSavedAt) {
    const hhmm = cfg.lastSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return { label: `✓ Enregistré ${hhmm}`, cls: 'text-accent border-accent/40 bg-accent-muted', title: 'Tout est gardé (localStorage + config.yaml)' }
  }
  return { label: 'Autosave actif', cls: 'text-text-3 border-border', title: 'Chaque modification est enregistrée automatiquement' }
})
</script>

<template>
  <div class="min-h-screen bg-bg text-text-1 flex flex-col" data-theme="dark">
    <!-- Topbar -->
    <header class="h-11 bg-surface border-b border-border flex items-center gap-3 px-3 sticky top-0 z-40 shrink-0">
      <button @click="collapsed = !collapsed" class="w-7 h-7 flex items-center justify-center text-text-3 hover:text-text-1 transition-colors" title="Menu">☰</button>
      <div class="flex items-center gap-2 select-none">
        <div class="w-[22px] h-[22px] rounded bg-accent text-accent-fg flex items-center justify-center font-bold text-[10px]">L</div>
        <span class="text-sm font-semibold tracking-tight">Labo</span>
        <span v-if="$route.path !== '/'" class="text-text-3 text-xs mx-1">/</span>
        <span v-if="$route.path !== '/'" class="text-xs text-text-2">{{ allItems.find(i => i.to === $route.path)?.label }}</span>
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
          @click="cfg.save()"
          class="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors"
          :class="saveStatus.cls"
          :title="saveStatus.title"
        >{{ saveStatus.label }}</button>
        <span
          class="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border"
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
      <!-- Sidebar -->
      <aside
        class="bg-surface border-r border-border flex flex-col sticky top-11 h-[calc(100vh-44px)] transition-all duration-150 shrink-0"
        :class="collapsed ? 'w-[52px]' : 'w-[220px]'"
      >
        <nav class="flex-1 overflow-y-auto py-2 px-2 space-y-4">
          <div v-for="g in navGroups" :key="g.title">
            <p v-if="!collapsed" class="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-3">{{ g.title }}</p>
            <template v-for="item in g.items" :key="item.to ?? item.action">
              <button
                v-if="!item.to"
                :title="collapsed ? item.label : undefined"
                @click="item.action ? onPaletteAction(item.action) : undefined"
                class="flex items-center gap-2.5 h-8 px-2 rounded text-xs font-medium transition-colors mb-0.5 relative w-full text-left"
                :class="'text-text-2 hover:text-text-1 hover:bg-surface-hover'"
              >
                <span class="w-4 text-center text-sm opacity-70">{{ item.icon }}</span>
                <span v-if="!collapsed">{{ item.label }}</span>
              </button>
              <router-link
                v-else
                :to="item.to"
                :title="collapsed ? item.label : undefined"
                class="flex items-center gap-2.5 h-8 px-2 rounded text-xs font-medium transition-colors mb-0.5 relative"
                :class="route.path === item.to ? 'bg-accent-muted text-accent' : 'text-text-2 hover:text-text-1 hover:bg-surface-hover'"
              >
                <span v-if="route.path === item.to && !collapsed" class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-accent"></span>
                <span class="w-4 text-center text-sm opacity-70">{{ item.icon }}</span>
                <span v-if="!collapsed">{{ item.label }}</span>
              </router-link>
            </template>
          </div>
        </nav>
        <div class="p-2 border-t border-border">
          <div class="flex items-center gap-2 px-2 h-7">
            <span class="w-2 h-2 rounded-full shrink-0" :class="daemonAlive ? 'bg-accent animate-pulse' : 'bg-border'"></span>
            <span v-if="!collapsed" class="text-[11px]" :class="daemonAlive ? 'text-text-3' : 'text-text-3'">{{ daemonAlive ? 'Robot en marche' : 'Robot à l\'arrêt' }}</span>
          </div>
        </div>
      </aside>

      <!-- Content -->
      <main class="flex-1 min-w-0 p-6 lg:p-8 max-w-6xl">
        <slot />
      </main>
    </div>

    <CommandPalette :groups="navGroups" @action="onPaletteAction" />
  </div>
</template>