// VERSUS — Comparatif (port fidèle du legacy versus.tsx).
<template>
  <div class="w-full h-full overflow-hidden border-4 border-black flex flex-col relative">
    <div class="absolute inset-0 flex">
      <div class="w-1/2 bg-white flex flex-col border-r-2 border-black">
        <div class="h-14 bg-black text-white flex items-center justify-center ab text-sm uppercase px-4 text-center">
          <RichText
            :doc="docFor(state, 'leftTitle')" label="TITRE G" sticker-pos="top-0"
            @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ leftTitle: d })"
          />
        </div>
        <div class="flex-1 p-8 flex items-center justify-center text-black text-center relative">
          <RichText
            :doc="docFor(state, 'leftBody')" label="CORPS G" sticker-pos="bottom-2"
            content-class="ir font-bold text-xl leading-snug italic"
            @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ leftBody: d })"
          />
        </div>
      </div>
      <div class="w-1/2 bg-[#0F0F0F] flex flex-col">
        <div class="h-14 flex items-center justify-center ab text-sm uppercase px-4 text-center text-white" :style="{ backgroundColor: str(state, 'accent', '#DC2626') }">
          <RichText
            :doc="docFor(state, 'rightTitle')" label="TITRE D" sticker-pos="top-0"
            @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ rightTitle: d })"
          />
        </div>
        <div class="flex-1 p-8 flex items-center justify-center text-white text-center relative">
          <RichText
            :doc="docFor(state, 'rightBody')" label="CORPS D" sticker-pos="bottom-2"
            content-class="ir font-bold text-xl leading-snug"
            @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ rightBody: d })"
          />
        </div>
      </div>
    </div>

    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
      <div class="w-20 h-20 bg-black border-4 border-white flex items-center justify-center ab text-4xl text-white italic transform -rotate-12 shadow-2xl">VS</div>
    </div>

    <div class="absolute top-0 left-0 w-full z-10 p-3 pointer-events-none">
      <RichText
        :doc="docFor(state, 'headline')" label="BANNER" sticker-pos="top-5 right-5"
        content-class="sm text-[8px] font-black uppercase tracking-[0.4em] text-center bg-white/10 backdrop-blur-sm py-1 border border-black/10 text-gray-500"
        @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ headline: d })"
      />
    </div>

    <div class="absolute bottom-5 left-5 ab text-[12px] opacity-20 pointer-events-none">L'ASSEZ / DECODAGE</div>
  </div>
</template>

<script setup lang="ts">
import RichText from '../text/RichText.vue'
import { useTemplateFields } from './useTemplateFields'

defineProps<{ state: Record<string, unknown> }>()

const { onFocus, onBlur, live, docFor, str } = useTemplateFields()
</script>
