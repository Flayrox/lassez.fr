// BIG_NUM — Chiffre Impact (port fidèle du legacy bignum.tsx).
<template>
  <div
    class="w-full h-full overflow-hidden border-4 border-black flex flex-col relative"
    :style="{ backgroundColor: isDark ? '#000' : '#fff', color: isDark ? '#fff' : '#000' }"
  >
    <div class="absolute inset-0 pointer-events-none opacity-20" :style="{ backgroundImage: `radial-gradient(${accent} 2px, transparent 2px)`, backgroundSize: '24px 24px' }" />

    <header class="p-6 border-b-4 border-black flex justify-between items-center z-20 bg-inherit">
      <RichText
        :doc="docFor(state, 'brand')" label="MARQUE" sticker-pos="top-10 left-0"
        content-class="ab text-xl uppercase tracking-tighter"
        :content-style="{ color: accent }"
        @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ brand: d })"
      />
      <div class="w-8 h-8 flex items-center justify-center border-2 border-black font-bold">!</div>
    </header>

    <main class="flex-1 flex flex-col justify-center items-center p-8 z-20 text-center relative">
      <RichText
        :doc="docFor(state, 'headline')" label="TITRE" sticker-pos="-top-8 left-1/2 -translate-x-1/2"
        content-class="sm text-[10px] font-bold uppercase tracking-[.3em] mb-4 opacity-50"
        @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ headline: d })"
      />

      <div class="relative">
        <RichText
          :doc="docFor(state, 'num')" label="NOMBRE" sticker-pos="-top-10 left-1/2 -translate-x-1/2"
          content-class="ab text-[180px] leading-none tracking-tighter"
          :content-style="{ WebkitTextStroke: isDark ? '2px #fff' : '2px #000', color: 'transparent' }"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ num: d })"
        />
        <span
          class="absolute inset-0 ab text-[180px] leading-none tracking-tighter mix-blend-overlay pointer-events-none"
          :style="{ color: accent, opacity: 0.6 }"
          v-html="numHtml"
        />
      </div>

      <div class="mt-2 bg-black text-white px-5 py-1.5 transform -rotate-1 skew-x-12 inline-block shadow-lg">
        <RichText
          :doc="docFor(state, 'label')" label="UNITÉ" sticker-pos="top-8 right-0"
          content-class="ab text-2xl font-black uppercase italic"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ label: d })"
        />
      </div>

      <div class="mt-8 max-w-[320px]">
        <RichText
          :doc="docFor(state, 'sub')" label="DÉTAILS" sticker-pos="bottom-0"
          content-class="ir text-lg font-bold leading-tight"
          @focus="onFocus" @blur="onBlur" @update:doc="(d) => live({ sub: d })"
        />
      </div>
    </main>

    <footer class="p-4 border-t-4 border-black flex justify-center z-20 bg-inherit">
      <div class="flex gap-2">
        <div v-for="i in 12" :key="i" class="w-1.5 h-6" :style="{ backgroundColor: i % 2 === 1 ? accent : (isDark ? '#fff' : '#000') }" />
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RichText from '../text/RichText.vue'
import { useTemplateFields } from './useTemplateFields'
import { renderDocToHtml } from '../text/tiptap'
import { fieldDoc } from '../text/fields'

const props = defineProps<{ state: Record<string, unknown> }>()

const { onFocus, onBlur, live, docFor, str, bool } = useTemplateFields()

const accent = computed(() => str(props.state, 'accent', '#DC2626'))
const isDark = computed(() => bool(props.state, 'dark', false))
// Reflet synchronisé sur le nombre (legacy : span overlay via dangerouslySetInnerHTML).
const numHtml = computed(() => renderDocToHtml(fieldDoc(props.state, 'num')))
</script>
