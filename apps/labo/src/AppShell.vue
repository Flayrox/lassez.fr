<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CommandPalette from './components/CommandPalette.vue'

const route = useRoute()
const router = useRouter()
const collapsed = ref(false)
const qoeMock = ref(true)

const groups = [
  {
    title: 'Opération',
    items: [
      { to: '/', label: 'Vue d’ensemble', icon: '◉' },
      { to: '/signaux', label: 'Signaux', icon: '▤' },
      { to: '/atelier', label: 'Atelier', icon: '⬢' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { to: '/sources', label: 'Sources', icon: '◎' },
      { to: '/filtres', label: 'Filtres', icon: '◈' },
      { to: '/ecriture', label: 'Écriture', icon: '✎' },
      { to: '/formats', label: 'Formats', icon: '▭' },
    ],
  },
  {
    title: 'Système',
    items: [
      { to: '/partage', label: 'Partage', icon: '↗' },
      { to: '/planning', label: 'Planning', icon: '◷' },
      { to: '/systeme', label: 'Système', icon: '⬡' },
      { to: '/users', label: 'Équipe', icon: '◍' },
      { action: 'scan', label: 'Lancer un scan maintenant', icon: '▶' },
      { action: 'theme', label: 'Basculer le thème (à venir)', icon: '◐' },
    ],
  },
]

const allItems = groups.flatMap(g => g.items.map(i => ({ group: g.title, ...i })))

function onPaletteAction(id: string) {
  if (id === 'scan') console.log('[labo] scan demandé — à brancher sur le daemon')
}
</script>

<template>
  <div class="min-h-screen bg-bg text-text-1 flex flex-col" data-theme="dark">
    <!-- Topbar -->
    <header class="h-12 bg-surface border-b border-border flex items-center gap-3 px-3 sticky top-0 z-40 shrink-0">
      <button @click="collapsed = !collapsed" class="w-7 h-7 flex items-center justify-center text-text-3 hover:text-text-1 transition-colors">☰</button>
      <div class="flex items-center gap-1.5 select-none">
        <div class="w-6 h-6 rounded bg-accent text-accent-fg flex items-center justify-center font-bold text-[11px]">L</div>
        <span class="text-sm font-semibold tracking-tight">Labo</span>
        <span v-if="$route.path !== '/'" class="text-text-3 text-xs mx-1">/</span>
        <span v-if="$route.path !== '/'" class="text-xs text-text-2">{{ $route.name || allItems.find(i => i.to === $route.path)?.label }}</span>
      </div>
      <button
        @click="$router.push('/'); (document.querySelector('body') as any).dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))"
        class="hidden md:flex ml-auto mr-auto items-center gap-2 h-7 px-2.5 min-w-[220px] rounded border border-border bg-bg text-text-3 text-xs hover:border-text-3/50 transition-colors"
      >
        <span>⌕</span><span class="flex-1 text-left">Rechercher…</span>
        <kbd class="font-mono text-[10px] border border-border rounded px-1">⌘K</kbd>
      </button>
      <div class="ml-auto flex items-center gap-2.5">
        <span
          class="hidden sm:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded border"
          :class="qoeMock ? 'border-warning/40 text-warning bg-warning/5' : 'border-accent/40 text-accent bg-accent-muted'"
        >{{ qoeMock ? 'QOE MOCK' : 'QOE LIVE' }}</span>
        <div class="w-7 h-7 rounded-full bg-gradient-to-br from-accent/60 to-info/60 ring-1 ring-border cursor-pointer"></div>
      </div>
    </header>

    <div class="flex flex-1 min-h-0">
      <!-- Sidebar -->
      <aside
        class="bg-surface border-r border-border flex flex-col sticky top-12 h-[calc(100vh-48px)] transition-all duration-150 shrink-0"
        :class="collapsed ? 'w-[52px]' : 'w-[232px]'"
      >
        <nav class="flex-1 overflow-y-auto py-2 px-2 space-y-4">
          <div v-for="g in groups" :key="g.title">
            <p v-if="!collapsed" class="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-3">{{ g.title }}</p>
            <router-link
              v-for="item in g.items.filter(i => i.to)"
              :key="item.to"
              :to="item.to"
              :title="collapsed ? item.label : undefined"
              class="flex items-center gap-2.5 h-8 px-2 rounded text-xs font-medium transition-colors mb-0.5"
              :class="route.path === item.to ? 'bg-surface-hover text-text-1' : 'text-text-2 hover:text-text-1 hover:bg-surface-hover'"
            >
              <span class="w-4 text-center text-sm opacity-70">{{ item.icon }}</span>
              <span v-if="!collapsed">{{ item.label }}</span>
            </router-link>
          </div>
        </nav>
        <div class="p-2 border-t border-border">
          <div class="flex items-center gap-2 px-2 h-7">
            <span class="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0"></span>
            <span v-if="!collapsed" class="text-[11px] text-text-3">Robot en marche</span>
          </div>
        </div>
      </aside>

      <!-- Content -->
      <main class="flex-1 min-w-0 p-6 lg:p-8 max-w-6xl">
        <slot />
      </main>
    </div>

    <CommandPalette :groups="groups" @action="onPaletteAction" />
  </div>
</template>
