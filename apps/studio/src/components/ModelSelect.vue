<!-- ModelSelect — Combobox shadcn pour choisir un modèle IA du registre.
     Trigger compact (style SelectTrigger) + recherche dans le popover.
     Le registre vit dans le store config (onglet Modèles). -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { CheckIcon, ChevronsUpDownIcon } from '@lucide/vue'
import {
  Combobox, ComboboxAnchor, ComboboxEmpty, ComboboxInput,
  ComboboxItem, ComboboxItemIndicator, ComboboxList, ComboboxTrigger,
} from './ui/combobox'
import { useConfigStore } from '../stores/config'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
}>(), { placeholder: 'Choisir un modèle…' })
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const store = useConfigStore()
const open = ref(false)
const value = computed({
  get: () => props.modelValue ?? '',
  set: (v: string) => emit('update:modelValue', v),
})
</script>

<template>
  <Combobox v-model="value" :open="open" @update:open="open = $event">
    <ComboboxAnchor class="w-full">
      <ComboboxTrigger class="border-input h-7 w-full justify-between rounded-md border bg-transparent px-2 text-xs hover:bg-muted/40">
        <span class="truncate" :class="value ? '' : 'text-muted-foreground'">{{ value || placeholder }}</span>
        <ChevronsUpDownIcon class="text-muted-foreground size-3.5 shrink-0 opacity-60" />
      </ComboboxTrigger>
    </ComboboxAnchor>
    <ComboboxList align="start" class="w-64">
      <ComboboxInput placeholder="Rechercher un modèle…" />
      <ComboboxEmpty>Aucun modèle — ajoute-en un dans l'onglet Modèles</ComboboxEmpty>
      <ComboboxItem
        v-for="m in store.modelRegistry"
        :key="m.label"
        :value="m.label"
        @select="open = false"
      >
        <span class="min-w-0 flex-1 truncate">{{ m.label }}</span>
        <ComboboxItemIndicator v-if="value === m.label">
          <CheckIcon />
        </ComboboxItemIndicator>
      </ComboboxItem>
    </ComboboxList>
  </Combobox>
</template>
