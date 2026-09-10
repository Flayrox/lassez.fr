// NEWS — Actualités Flash (port fidèle du legacy news.tsx).
<template>
  <div class="w-full h-full bg-white border-[8px] border-black overflow-hidden flex flex-col relative">
    <div class="relative h-[60%] border-b-[8px] border-black overflow-hidden bg-zinc-700 shrink-0">
      <div class="absolute top-0 left-0 z-30 flex">
        <RichText
          :doc="brandCategoryDoc" label="INFO" sticker-pos="top-10 left-0"
          content-class="sm text-white text-[9px] tracking-[0.2em] uppercase font-bold px-4 py-2 border-r-[4px] border-b-[4px] border-black"
          :content-style="{ backgroundColor: str(state, 'accent', '#DC2626') }"
          @focus="onFocus" @blur="onBlur" @update:doc="onBrandCategory"
        />
      </div>

      <DraggableImage
        v-if="str(state, 'imageUrl')"
        :src="str(state, 'imageUrl')"
        :zoom="num(state, 'zoom', 1)"
        :grayscale="num(state, 'grayscale', 0)"
        :pos-x="num(state, 'posX')"
        :pos-y="num(state, 'posY')"
        @dragstart="onFocus"
        @dragend="(p) => patch({ posX: p.x, posY: p.y })"
      />
      <Aesthetics kind="halftone" :opacity="0.15" :z-index="10" />
    </div>

    <div class="flex-1 bg-white px-6 pt-4 pb-5 flex flex-col justify-between text-black">
      <div class="flex justify-between items-center border-b-2 border-black pb-2">
        <RichText
          :doc="docFor(state, 'date')" label="DATE" sticker-pos="top-4 left-0"
          content-class="sm text-[9px] font-bold uppercase tracking-widest"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ date: d })"
        />
        <RichText
          :doc="docFor(state, 'topic')" label="SUJET" sticker-pos="top-4 right-0"
          content-class="sm text-[9px] font-bold uppercase tracking-widest"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ topic: d })"
        />
      </div>

      <div class="flex-1 flex items-center py-2">
        <RichText
          :doc="docFor(state, 'headline')" label="TITRE" sticker-pos="-top-6 left-0"
          content-class="pd font-black text-[40px] leading-[0.9] uppercase text-black"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ headline: d })"
        />
      </div>

      <div class="flex justify-between items-center">
        <span class="sm text-[8px] uppercase text-zinc-400 font-bold">Rédaction Quotidienne</span>
        <div class="flex items-center gap-1.5">
          <span class="font-bold text-[9px] uppercase tracking-widest">Lire la suite</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="str(state, 'accent', '#DC2626')" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RichText from '../text/RichText.vue'
import Aesthetics from '../engine/Aesthetics.vue'
import DraggableImage from '../engine/DraggableImage.vue'
import { useTemplateFields } from './useTemplateFields'
import { docToPlainText, htmlToTiptapDoc } from '../text/tiptap'
import { isDocValue } from '../text/fields'

const props = defineProps<{ state: Record<string, unknown> }>()

const { onFocus, onBlur, patch, live, docFor, str, num } = useTemplateFields()

// Le legacy fusionnait brand + category dans une seule zone ("L'ASSEZ FLASH").
// On garde le comportement : édition splitée au premier espace.
const brandCategoryDoc = computed(() => {
  const brand = isDocValue(props.state.brand)
    ? docToPlainText(props.state.brand as Record<string, unknown>)
    : String(props.state.brand ?? '')
  const category = isDocValue(props.state.category)
    ? docToPlainText(props.state.category as Record<string, unknown>)
    : String(props.state.category ?? '')
  return htmlToTiptapDoc(`${brand} ${category}`.trim())
})

function onBrandCategory(doc: Record<string, unknown>) {
  const parts = docToPlainText(doc).split(' ')
  live({ brand: htmlToTiptapDoc(parts[0] ?? ''), category: htmlToTiptapDoc(parts.slice(1).join(' ')) })
}
</script>
