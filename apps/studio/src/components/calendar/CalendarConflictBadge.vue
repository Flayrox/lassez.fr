<template>
  <div
    v-if="conflicts.length"
    class="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-400"
    :title="tooltipText"
  >
    <AlertTriangleIcon class="size-3.5 shrink-0" />
    <span class="font-medium font-mono text-[11px]">{{ conflicts.length }} conflit{{ conflicts.length > 1 ? 's' : '' }} détecté{{ conflicts.length > 1 ? 's' : '' }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangleIcon } from '@lucide/vue'

export interface ConflictItem {
  time: string
  day?: string
  pipelines: string[]
  reason: string
}

const props = defineProps<{
  conflicts: ConflictItem[]
}>()

const tooltipText = computed(() => {
  return props.conflicts.map(c => `${c.day ? c.day + ' ' : ''}${c.time} : ${c.reason} (${c.pipelines.join(', ')})`).join('\n')
})
</script>
