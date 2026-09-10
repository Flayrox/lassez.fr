// INFO — Fiche Information (port fidèle du legacy info.tsx).
<template>
  <div class="w-full h-full overflow-hidden border-4 border-black flex flex-col relative" style="background-color: #F3F4F6">
    <div style="position: absolute; inset: 0; pointer-events: none;">
      <div style="position: absolute; top: 0; right: 0; width: 60%; height: 100%; background-color: #000; opacity: 0.1; transform: skewX(-12deg) translateX(25%);" :style="{ borderLeft: `8px solid ${accent}` }" />
      <div style="position: absolute; top: 15%; left: 0; width: 100%; height: 8px; background-color: #000; transform: rotate(-1deg);" />
      <div style="position: absolute; bottom: 10%; left: 0; width: 100%; height: 16px; background-color: #000; transform: rotate(1deg);" />
    </div>

    <header class="relative z-20 px-8 pt-10 pb-4 flex justify-between items-end border-b-4 border-black bg-white shrink-0">
      <div class="flex flex-col">
        <span class="sm text-[10px] uppercase tracking-widest font-bold mb-1" :style="{ color: accent }">{{ str(state, 'tag', '') }}</span>
        <RichText
          :doc="docFor(state, 'headline')" label="TITRE" sticker-pos="-top-5 right-0"
          content-class="pd font-black text-[36px] leading-none text-black uppercase tracking-tighter"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ headline: d })"
        />
      </div>
      <div class="text-right">
        <div class="sm text-[36px] font-bold text-black leading-none">{{ str(state, 'slideNum', '') }}</div>
        <div class="sm text-[9px] uppercase text-gray-400">Slide</div>
      </div>
    </header>

    <main class="relative z-20 flex-grow p-7 flex flex-col justify-between gap-5">
      <div class="relative bg-white border-2 border-black p-5 flex-grow flex flex-col justify-center" style="box-shadow: 8px 8px 0 0 #000;">
        <RichText
          :doc="docFor(state, 'body')" label="CORPS" sticker-pos="-top-5 right-0"
          content-class="pd text-[20px] font-bold leading-tight text-black mb-3"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ body: d })"
        />
        <RichText
          :doc="docFor(state, 'bodyMono')" label="CORPS 2" sticker-pos="-top-5 left-0"
          content-class="sm text-[11px] leading-relaxed text-gray-700 text-justify border-l-4 pl-3"
          :content-style="{ borderColor: accent }"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ bodyMono: d })"
        />
      </div>

      <div class="relative">
        <div class="absolute -top-4 -right-2 px-2 py-1 sm text-[9px] font-bold uppercase z-20 border-2 border-white bg-black text-white" style="transform: rotate(2deg);">Warning</div>
        <div
          class="p-5 border-4 border-black relative"
          :style="{
            backgroundColor: accent,
            boxShadow: '4px 4px 0 0 #000',
            clipPath: 'polygon(0% 0%,100% 0%,100% 100%,95% 93%,90% 100%,85% 93%,80% 100%,75% 93%,70% 100%,65% 93%,60% 100%,55% 93%,50% 100%,45% 93%,40% 100%,35% 93%,30% 100%,25% 93%,20% 100%,15% 93%,10% 100%,5% 93%,0% 100%)',
          }"
        >
          <div class="flex flex-col text-white">
            <h2 class="ab text-[28px] uppercase leading-none text-white mb-1" style="mix-blend-mode: hard-light;">{{ str(state, 'actionTitle', '') }}</h2>
            <p class="sm text-[10px] font-bold uppercase text-black tracking-wider">{{ str(state, 'actionMeta', '') }}</p>
          </div>
        </div>
      </div>
    </main>

    <footer class="relative z-20 bg-black text-white px-5 py-3 flex justify-between items-center mt-auto border-t-4 shrink-0" :style="{ borderColor: accent }">
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full border border-white" :style="{ backgroundColor: accent }" />
        <span class="ab text-[18px] uppercase tracking-widest">{{ str(state, 'brand', '') }}</span>
      </div>
      <span class="sm text-[10px]">{{ str(state, 'footerHandle', '') }}</span>
    </footer>
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
