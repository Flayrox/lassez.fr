// IMPACT_QUOTE — Citation d'Impact (port fidèle du legacy impactquote.tsx).
<template>
  <div class="w-full h-full bg-[#111] overflow-hidden border-4 border-black flex flex-col relative">
    <div class="flex items-center gap-2 px-6 pt-5 pb-4 border-b-2 shrink-0 z-10" :style="{ borderColor: accent + '50' }">
      <div class="w-3.5 h-3.5 bg-white flex items-center justify-center shrink-0"><div class="w-2 h-0.5 bg-black" /></div>
      <RichText
        :doc="docFor(state, 'brand')" label="MARQUE" sticker-pos="top-6 left-0"
        content-class="ab font-bold uppercase tracking-widest text-white"
        :content-style="{ fontSize: '0.6rem' }"
        @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ brand: d })"
      />
      <div class="ml-auto w-5 h-5 border-2 flex items-center justify-center" :style="{ borderColor: accent }">
        <span class="sm font-black" :style="{ fontSize: '0.5rem', color: accent }">"</span>
      </div>
    </div>

    <div class="flex-1 flex flex-col items-center justify-center px-7 py-4 z-10">
      <div class="self-start ab font-black leading-none mb-2" :style="{ fontSize: '5rem', lineHeight: 0.6, color: accent, opacity: 0.8 }">"</div>
      <RichText
        :doc="docFor(state, 'largeQuote')" label="CITATION" sticker-pos="-top-12 left-1/2 -translate-x-1/2"
        content-class="ir font-bold text-white leading-tight text-center"
        :content-style="{ fontSize: 'clamp(1.2rem, 4.5cqw, 2rem)' }"
        @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ largeQuote: d })"
      />
      <div class="self-end ab font-black leading-none mt-2" :style="{ fontSize: '5rem', lineHeight: 0.6, color: accent, opacity: 0.8 }">"</div>
    </div>

    <div class="border-t-4 px-7 py-5 shrink-0 z-10" :style="{ backgroundColor: accent, borderColor: '#000' }">
      <RichText
        :doc="docFor(state, 'author')" label="AUTEUR" sticker-pos="-top-4 left-0"
        content-class="ab font-black text-black uppercase block leading-tight"
        :content-style="{ fontSize: '1.1rem' }"
        @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ author: d })"
      />
      <RichText
        :doc="docFor(state, 'context')" label="CONTEXTE" sticker-pos="-top-4 left-0"
        content-class="sm font-bold text-black/70 uppercase mt-1 block"
        :content-style="{ fontSize: '0.6rem' }"
        @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ context: d })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RichText from '../text/RichText.vue'
import { useTemplateFields } from './useTemplateFields'

const props = defineProps<{ state: Record<string, unknown> }>()

const { onFocus, onBlur, live, docFor, str } = useTemplateFields()

const accent = computed(() => str(props.state, 'accent', '#BC0100'))
</script>
