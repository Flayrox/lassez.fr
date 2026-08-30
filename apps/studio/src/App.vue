<template>
  <AppShell>
    <ErrorBoundary>
      <router-view />
    </ErrorBoundary>
  </AppShell>
  <Toaster position="bottom-right" />
</template>

<script setup lang="ts">
import AppShell from './AppShell.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import { Toaster } from './components/ui/sonner'
</script>

<style>
* { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
</style>