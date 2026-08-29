<template>
  <AppShell>
    <ErrorBoundary>
      <router-view />
    </ErrorBoundary>
  </AppShell>
</template>

<script setup lang="ts">
import AppShell from './AppShell.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
</script>

<style>
* { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
</style>