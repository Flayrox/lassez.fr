// COVER — Couverture Magazine (port fidèle du legacy cover.tsx).
<template>
  <div class="w-full h-full border-[10px] border-black overflow-hidden relative" :style="{ backgroundColor: str(state, 'bg', '#FFFFFF') }">
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
    <Aesthetics kind="halftone" :opacity="0.25" :z-index="10" />

    <div class="relative z-30 h-full flex flex-col justify-between p-9">
      <div class="flex justify-between items-start border-b-[3px] border-black pb-3">
        <RichText
          :doc="docFor(state, 'issueNum')" label="ISSUE" sticker-pos="top-6 left-0"
          content-class="sm text-[9px] font-bold uppercase tracking-widest bg-black text-white px-2.5 py-1"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ issueNum: d })"
        />
        <RichText
          :doc="docFor(state, 'brand')" label="MARQUE" sticker-pos="top-6 right-0"
          content-class="sm text-[9px] uppercase tracking-widest text-black font-bold"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ brand: d })"
        />
      </div>

      <div class="flex-grow flex items-center justify-center relative">
        <div class="absolute inset-x-[-36px] h-48 transform -skew-y-3 border-y-[6px] border-black shadow-xl" :style="{ backgroundColor: str(state, 'bg', '#FFFFFF') }" />
        <RichText
          :doc="docFor(state, 'headline')" label="TITRE" sticker-pos="-top-8 left-1/2 -translate-x-1/2"
          content-class="relative z-10 pd font-black text-[76px] leading-[0.82] text-center text-black uppercase italic tracking-tighter"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ headline: d })"
        />
      </div>

      <div class="border-t-[6px] border-black pt-4 flex justify-between items-end">
        <div class="flex flex-col gap-2">
          <RichText
            :doc="docFor(state, 'readTime')" label="LECTURE" sticker-pos="-top-4 left-0"
            content-class="sm text-[8px] font-bold uppercase text-black"
            @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ readTime: d })"
          />
          <RichText
            :doc="docFor(state, 'author')" label="AUTEUR" sticker-pos="-top-4 left-0"
            content-class="sm text-[8px] font-bold uppercase text-black"
            @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ author: d })"
          />
        </div>
        <div class="flex items-center gap-2 pl-3 border-l-2 border-black">
          <RichText
            :doc="docFor(state, 'swipeLabel')" label="SWIPE" sticker-pos="-top-4 right-0"
            content-class="font-bold text-[10px] uppercase tracking-widest text-black italic"
            @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ swipeLabel: d })"
          />
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" :stroke="str(state, 'accent', '#DC2626')" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </div>
      </div>
    </div>

    <div class="absolute top-1/3 left-5 w-5 h-5 bg-black z-40" />
    <div class="absolute top-1/3 left-12 w-5 h-5 border-[3px] border-black z-40" />
    <div class="absolute bottom-10 right-10 rounded-full z-20 mix-blend-hard-light" :style="{ width: '88px', height: '88px', backgroundColor: str(state, 'accent', '#DC2626') }" />
  </div>
</template>

<script setup lang="ts">
import RichText from '../text/RichText.vue'
import Aesthetics from '../engine/Aesthetics.vue'
import DraggableImage from '../engine/DraggableImage.vue'
import { useTemplateFields } from './useTemplateFields'

defineProps<{ state: Record<string, unknown> }>()

const { onFocus, onBlur, patch, live, docFor, str, num } = useTemplateFields()
</script>
