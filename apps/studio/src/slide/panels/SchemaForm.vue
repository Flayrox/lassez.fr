// Formulaire généré depuis le schema template (port du SidebarForm legacy),
// groupé par sections. Texte = RichText (aucune perte de mise en forme),
// contrôles discrets = patch (1 undo par geste).
<template>
  <div class="flex flex-col gap-5">
    <div v-for="[group, fields] in groups" :key="group">
      <div class="flex items-center gap-2 mb-2.5">
        <span class="text-[10px] font-bold uppercase tracking-[0.1em] shrink-0" style="color: #666;">{{ group }}</span>
        <div class="flex-1 h-px" style="background: #2a2a2a;" />
      </div>
      <div class="flex flex-col gap-3.5">
        <SchemaField
          v-for="field in fields"
          :key="field.key"
          :field="field"
          :value="state[field.key]"
          @patch="(v) => onFieldPatch(field.key, v)"
          @live="(v) => onFieldLive(field.key, v)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TemplateField } from '../types'
import { useTemplateFields } from '../templates/useTemplateFields'
import SchemaField from './SchemaField.vue'

const props = defineProps<{
  schema: TemplateField[]
  state: Record<string, unknown>
}>()

const { patch, live } = useTemplateFields()

const groups = computed(() => {
  const map = new Map<string, TemplateField[]>()
  for (const f of props.schema) {
    const g = f.group ?? 'Général'
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(f)
  }
  return [...map.entries()]
})

function onFieldPatch(key: string, value: unknown) {
  patch({ [key]: value })
}

function onFieldLive(key: string, value: unknown) {
  live({ [key]: value })
}
</script>
