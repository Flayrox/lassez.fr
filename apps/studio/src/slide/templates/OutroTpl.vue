// OUTRO — Call to Action (port fidèle du legacy outro.tsx).
// NB : les tailles en `vw` du legacy sont converties en `cqw` (le stage est
// un container CSS : 1cqw = 1% de sa largeur, stable quel que soit le zoom).
<template>
  <div class="w-full h-full overflow-hidden flex flex-col group border-4 border-black relative" :style="{ backgroundColor: accent }">
    <div class="absolute top-0 left-0 w-24 h-24 bg-black z-10" style="clip-path: polygon(0 0, 100% 0, 0 100%);" />
    <div class="absolute top-0 left-0 w-32 h-32 border-r-4 border-b-4 border-black z-0" />
    <div class="absolute bottom-0 right-0 w-32 h-32 bg-black z-10" style="clip-path: polygon(100% 100%, 0 100%, 100% 0);" />

    <div class="flex-1 flex flex-col justify-center items-center relative z-20 p-8">
      <div class="absolute top-8 right-8">
        <span class="bg-black text-white px-4 py-1 sg text-sm font-bold uppercase tracking-widest border border-white transform -rotate-2 inline-block shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          Rejoignez la lutte
        </span>
      </div>

      <div class="relative w-full text-center my-auto transform rotate-[-5deg]">
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[120%] border-4 border-black opacity-20 pointer-events-none" />
        <RichText
          :doc="docFor(state, 'headline')" label="TITRE" sticker-pos="-top-4 right-0"
          content-class="pd font-black leading-[0.9] text-black w-full"
          :content-style="{ mixBlendMode: 'multiply', fontSize: 'clamp(3rem, 15cqw, 6rem)' }"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ headline: d })"
        />
      </div>

      <div class="w-full max-w-[400px] mt-8 space-y-4">
        <div class="bg-white border-2 border-black p-3 flex items-center justify-between transform rotate-1" style="box-shadow: 4px 4px 0px 0px rgba(0,0,0,1);">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-black rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <span class="sg font-bold text-lg text-black">{{ str(state, 'brandHandle', '') }}</span>
          </div>
          <span class="text-black text-xl leading-none">→</span>
        </div>
        <div class="bg-black p-4 text-center transform -rotate-1 border-2 border-white">
          <p class="sg font-black text-xl uppercase tracking-wider text-white flex items-center justify-center gap-2">
            <span class="text-sm">🔗</span>
            {{ str(state, 'linkText', '') }}
            <span class="text-sm">🔗</span>
          </p>
        </div>
      </div>
    </div>

    <div class="absolute bottom-8 left-8 flex flex-col gap-1 z-20">
      <div class="w-16 h-1 bg-black" />
      <div class="w-12 h-1 bg-black" />
      <div class="w-20 h-1 bg-black" />
      <div class="w-8 h-1 bg-black" />
      <span class="text-[10px] font-mono font-bold mt-1 text-black">{{ str(state, 'footerYear', '') }}</span>
    </div>

    <div class="absolute -bottom-16 -left-4 ir font-black text-[10rem] opacity-10 pointer-events-none select-none text-black">
      {{ str(state, 'number', '') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RichText from '../text/RichText.vue'
import { useTemplateFields } from './useTemplateFields'

const props = defineProps<{ state: Record<string, unknown> }>()

const { onFocus, onBlur, live, docFor, str } = useTemplateFields()

const accent = computed(() => str(props.state, 'accent', '#DC2626'))
</script>
