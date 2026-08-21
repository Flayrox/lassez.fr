<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ groups: { title: string; items: { to?: string; label: string; icon: string; action?: string }[] }[] }>()
const emit = defineEmits<{ (e: 'action', id: string): void }>()

const open = ref(false)
const query = ref('')
const idx = ref(0)
const router = useRouter()

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  const out: { group: string; label: string; icon: string; to?: string; action?: string }[] = []
  for (const g of props.groups)
    for (const item of g.items) {
      if (!q || item.label.toLowerCase().includes(q)) out.push({ group: g.title, ...item })
    }
  return out.slice(0, 12)
})

function run(item: { to?: string; action?: string }) {
  if (item.to) router.push(item.to)
  else if (item.action) emit('action', item.action)
  open.value = false
  query.value = ''
}

function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    open.value = !open.value
  } else if (open.value && e.key === 'Escape') {
    open.value = false
  } else if (open.value && e.key === 'ArrowDown') {
    e.preventDefault()
    idx.value = Math.min(idx.value + 1, results.value.length - 1)
  } else if (open.value && e.key === 'ArrowUp') {
    e.preventDefault()
    idx.value = Math.max(idx.value - 1, 0)
  } else if (open.value && e.key === 'Enter' && results.value[idx.value]) {
    run(results.value[idx.value])
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-[2px]" @click="open = false" />
      <div class="relative w-full max-w-lg bg-surface border border-border rounded-card shadow-2xl overflow-hidden">
        <input
          v-model="query"
          autofocus
          placeholder="Rechercher ou taper une commande…"
          class="w-full h-11 bg-transparent px-4 text-sm text-text-1 placeholder:text-text-3 outline-none border-b border-border"
        />
        <div class="max-h-80 overflow-y-auto p-1.5">
          <button
            v-for="(r, i) in results"
            :key="i"
            @click="run(r)"
            @mouseenter="idx = i"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors"
            :class="i === idx ? 'bg-surface-hover' : ''"
          >
            <span class="text-text-3 text-sm w-5">{{ r.icon }}</span>
            <span class="text-xs text-text-1 flex-1">{{ r.label }}</span>
            <span class="text-[10px] text-text-3">{{ r.group }}</span>
          </button>
          <p v-if="results.length === 0" class="px-3 py-6 text-center text-xs text-text-3">Aucun résultat</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
