<template>
  <AppShell :groups="navGroups" @action="onAction">
    <ErrorBoundary>
      <router-view />
    </ErrorBoundary>
  </AppShell>
</template>

<script setup>
import AppShell from './AppShell.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'

const navGroups = [
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
    ],
  },
]
function onAction(id) { console.log('[labo] action:', id) }
</script>

<style>
* { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
</style>
