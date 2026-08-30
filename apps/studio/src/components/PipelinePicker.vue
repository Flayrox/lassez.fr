<!-- PipelinePicker — le sélecteur de pipelines façon GCP (projet actif en topbar).
     Panneau déroulant : une carte par pipeline (couleur, description, port,
     prochain passage), ▶ scan par instance, clic = bascule du pipeline actif. -->
<template>
  <div class="relative">
    <button
      @click="toggle"
      class="h-7 flex items-center gap-1.5 pl-2 pr-1.5 rounded border transition-colors"
      :class="open ? 'border-accent/60 bg-accent-muted' : 'border-border bg-bg hover:border-text-3/50'"
      title="Changer de pipeline (instance)"
    >
      <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: active?.color ?? 'var(--border)' }"></span>
      <span class="text-[11px] font-medium text-text-2">{{ active?.name ?? 'Pipeline' }}</span>
      <span class="text-[9px] text-text-3">▾</span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-[70]" @click="open = false" @keydown.esc="open = false">
        <div
          class="absolute top-12 right-3 w-[340px] max-w-[calc(100vw-24px)] rounded-lg border border-border bg-surface shadow-2xl overflow-hidden"
          @click.stop
        >
          <div class="px-3 py-2 flex items-center gap-2 border-b border-border">
            <p class="text-[10px] uppercase tracking-wider text-text-3">Pipelines</p>
            <button @click="pl.refresh(true)" class="ml-auto text-[10px] text-text-3 hover:text-accent" title="Rafraîchir">↻</button>
          </div>
          <div
            v-for="p in cfg.pipelines"
            :key="p.id"
            class="px-3 py-2.5 flex items-center gap-2.5 border-b border-border/50 last:border-0 cursor-pointer transition-colors"
            :class="p.id === cfg.activePipelineId ? 'bg-accent-muted/40' : 'hover:bg-surface-hover'"
            @click="select(p)"
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: p.color }"></span>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-text-1 flex items-center gap-1.5">
                {{ p.name }}
                <span v-if="p.id === cfg.activePipelineId" class="text-[9px] font-normal text-accent">actif</span>
                <span v-if="p.enabled === false" class="text-[9px] font-normal text-text-3">off</span>
              </p>
              <p class="text-[10px] text-text-3 truncate">{{ p.description }}</p>
              <p class="text-[10px] text-text-3">:{{ p.port }} · {{ pl.nextRunLabel(p) }}</p>
            </div>
            <button
              @click.stop="scan(p)"
              :disabled="scanningId === p.id"
              class="w-7 h-7 shrink-0 rounded-full border border-border text-[10px] text-text-2 hover:text-accent hover:border-accent/50 disabled:opacity-40 transition-colors"
              :title="`Scanner ${p.name} maintenant`"
            >▶</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useConfigStore, type PipelineInfo } from '../stores/config'
import { useSystemStore } from '../stores/system'
import { usePipelinesStore } from '../stores/pipelines'

const cfg = useConfigStore()
const system = useSystemStore()
const pl = usePipelinesStore()

const open = ref(false)
const scanningId = ref<string | null>(null)
const active = computed(() => cfg.activePipeline)

function toggle() {
  open.value = !open.value
  if (open.value) pl.refresh()
}

async function select(p: PipelineInfo) {
  open.value = false
  if (p.id === cfg.activePipelineId) return
  await cfg.switchPipeline(p.id)
  await Promise.all([system.fetchHealth(), pl.refresh(true)])
}

async function scan(p: PipelineInfo) {
  scanningId.value = p.id
  try {
    await pl.scan(p)
  } finally {
    scanningId.value = null
  }
}

function onKey(e: KeyboardEvent) {
  if (open.value && e.key === 'Escape') open.value = false
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
