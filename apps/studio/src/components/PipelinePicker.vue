<!-- PipelinePicker — le sélecteur de pipelines façon GCP (projet actif en topbar),
     refait avec shadcn-vue (DropdownMenu). Une entrée par pipeline : couleur,
     description, port, prochain passage, ▶ scan par instance, clic = bascule. -->
<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" class="gap-1.5 pl-2 pr-1.5">
        <span class="size-2 shrink-0 rounded-full" :style="{ background: active?.color ?? 'var(--border)' }"></span>
        <span class="text-xs font-medium">{{ active?.name ?? 'Pipeline' }}</span>
        <ChevronsUpDownIcon class="text-muted-foreground size-3.5" />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="w-80">
      <DropdownMenuLabel class="flex items-center justify-between">
        <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pipelines</span>
        <Button variant="ghost" size="icon-xs" title="Rafraîchir" @click.stop="pl.refresh(true)">
          <RefreshCwIcon />
        </Button>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="p in cfg.pipelines"
        :key="p.id"
        class="items-center gap-2.5 py-2"
        @select="select(p)"
      >
        <span class="size-2.5 shrink-0 rounded-full" :style="{ background: p.color }"></span>
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-1.5 text-sm font-medium">
            {{ p.name }}
            <Badge v-if="p.id === cfg.activePipelineId" variant="secondary" class="h-4 px-1 text-[9px] font-medium">actif</Badge>
            <Badge v-else-if="p.enabled === false" variant="outline" class="h-4 px-1 text-[9px] font-medium text-muted-foreground">off</Badge>
          </p>
          <p class="truncate text-xs text-muted-foreground">{{ p.description }}</p>
          <p class="text-xs text-muted-foreground">:{{ p.port }} · {{ pl.nextRunLabel(p) }}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          :disabled="scanningId === p.id"
          :title="`Scanner ${p.name} maintenant`"
          @click.stop="scan(p)"
        >
          <PlayIcon />
        </Button>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronsUpDownIcon, PlayIcon, RefreshCwIcon } from '@lucide/vue'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'
import { useConfigStore, type PipelineInfo } from '../stores/config'
import { useSystemStore } from '../stores/system'
import { usePipelinesStore } from '../stores/pipelines'

const cfg = useConfigStore()
const system = useSystemStore()
const pl = usePipelinesStore()

const scanningId = ref<string | null>(null)
const active = computed(() => cfg.activePipeline)

async function select(p: PipelineInfo) {
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
</script>
