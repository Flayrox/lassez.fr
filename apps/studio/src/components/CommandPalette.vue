<script setup lang="ts">
import type { Component } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'

export interface PaletteItem { to?: string; label: string; icon: Component; action?: string }
export interface PaletteGroup { title: string; items: PaletteItem[] }

const props = defineProps<{ groups: PaletteGroup[]; open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'action', id: string): void
}>()

const router = useRouter()

function run(item: PaletteItem) {
  if (item.to) router.push(item.to)
  else if (item.action) emit('action', item.action)
  emit('update:open', false)
}

// Raccourci ⌘K — la palette est pilotée depuis AppShell (bouton « Rechercher » + clavier).
function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    emit('update:open', !props.open)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <CommandDialog
    :open="open"
    @update:open="emit('update:open', $event)"
    class="w-full max-w-xl"
  >
    <CommandInput placeholder="Rechercher une page ou une action…" />
    <CommandList>
      <CommandEmpty>Aucun résultat</CommandEmpty>
      <CommandGroup v-for="g in groups" :key="g.title" :heading="g.title">
        <CommandItem
          v-for="item in g.items"
          :key="item.label"
          :value="item.label"
          @select="run(item)"
        >
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
