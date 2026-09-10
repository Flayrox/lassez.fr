// Rendu statique d'un doc Tiptap (miniatures deck, export) — sans éditeur,
// donc sans coût ProseMirror : juste le HTML généré avec les mêmes extensions.
<template>
  <div class="slide-static-html" :class="contentClass" :style="contentStyle" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderDocToHtml } from './tiptap'

const props = defineProps<{
  doc: Record<string, unknown> | null | undefined
  contentClass?: string | string[] | Record<string, boolean>
  contentStyle?: Record<string, string>
}>()

const html = computed(() => renderDocToHtml(props.doc))
</script>
