// Modales : génération depuis article (sélection des templates autorisés)
// + import JSON. Look legacy.
<template>
  <div v-if="showArticle || showJson" class="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8" style="backdrop-filter: blur(4px);">
    <div
      class="border shadow-2xl flex flex-col w-full max-w-2xl overflow-hidden rounded-xl"
      style="background: #131313; border-color: #2a2a2a; font-family: Inter, sans-serif;"
    >
      <div class="px-6 py-5 border-b flex justify-between items-center bg-[#111]" style="border-color: #2a2a2a;">
        <div>
          <h3 class="text-[13px] font-bold text-white uppercase tracking-wider">{{ title }}</h3>
          <p v-if="subtitle" class="text-[11px] mt-1 font-medium" style="color: #666;">{{ subtitle }}</p>
        </div>
        <button class="text-[#666] hover:text-white transition-colors p-1 rounded-full" @click="close">✕</button>
      </div>

      <div class="p-6 flex flex-col gap-5 overflow-y-auto sb" style="max-height: 80vh;">
        <!-- Article → deck -->
        <template v-if="showArticle">
          <div class="flex flex-col gap-2">
            <label class="text-[11px] font-bold uppercase tracking-tight ml-1" style="color: #999;">Contenu de l'article</label>
            <textarea
              v-model="articleText"
              class="w-full h-40 resize-none p-4 text-[12px] text-white rounded-lg"
              style="background: #1a1a1a; border: 1px solid #2a2a2a; font-family: Inter, sans-serif;"
              placeholder="Colle ton texte ici…"
            />
          </div>
          <div class="flex flex-col gap-3">
            <label class="text-[11px] font-bold uppercase tracking-tight ml-1" style="color: #999;">Paramètres IA — Templates autorisés</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="t in allTemplates"
                :key="t.id"
                class="flex items-center gap-2 p-2.5 text-left border rounded-lg transition-all text-[11px] font-semibold"
                :style="{
                  borderColor: enabledTypes.includes(t.id) ? '#fff' : '#2a2a2a',
                  color: enabledTypes.includes(t.id) ? '#fff' : '#888',
                  background: enabledTypes.includes(t.id) ? '#222' : 'transparent',
                }"
                @click="toggleType(t.id)"
              ><span>{{ t.icon }}</span>{{ t.name }}</button>
            </div>
          </div>
          <button class="modal-cta" :disabled="aiLoading || !articleText.trim()" @click="generate">
            {{ aiLoading ? 'Génération en cours…' : '✦ Générer le deck' }}
          </button>
          <p class="text-[11px] text-center" style="color: #555;">La génération IA sera branchée sur le daemon (Gemini) en phase pipeline.</p>
        </template>

        <!-- Import JSON -->
        <template v-else>
          <div class="flex flex-col gap-2">
            <label class="text-[11px] font-bold uppercase tracking-tight ml-1" style="color: #999;">Deck JSON (format legacy accepté)</label>
            <textarea
              v-model="jsonText"
              class="w-full h-56 resize-y p-4 text-[11px] text-white rounded-lg font-mono"
              style="background: #1a1a1a; border: 1px solid #2a2a2a;"
              placeholder='{ "deck": [ { "type": "COVER", "state": { … } } ] }'
            />
          </div>
          <p v-if="jsonError" class="text-[12px]" style="color: #ef4444;">{{ jsonError }}</p>
          <button class="modal-cta" :disabled="!jsonText.trim()" @click="importJson">Importer</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { getAllTemplates } from '../registry'
import type { SlideType } from '../types'

const props = withDefaults(
  defineProps<{ showArticle?: boolean; showJson?: boolean; aiLoading?: boolean; initialArticle?: string }>(),
  { showArticle: false, showJson: false, aiLoading: false, initialArticle: '' },
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'generate', payload: { text: string; types: SlideType[] }): void
  (e: 'import', payload: { raw: string }): void
}>()

const title = computed(() => (props.showArticle ? "✨ Générer le deck depuis un article" : 'Importer un deck JSON'))
const subtitle = computed(() =>
  props.showArticle ? "Colle ton article ou ton flash info. L'IA va créer un deck complet." : 'Formats V1 legacy {deck:[…]} et V2 {slides:[…]} acceptés.',
)

const articleText = ref(props.initialArticle)
const enabledTypes = ref<SlideType[]>(['NEWS', 'INFO', 'VERSUS', 'BIG_NUM', 'IMPACT_QUOTE', 'OUTRO'])
const jsonText = ref('')
const jsonError = ref('')
const allTemplates = computed(() => getAllTemplates())

function toggleType(id: string) {
  const t = id as SlideType
  enabledTypes.value = enabledTypes.value.includes(t)
    ? enabledTypes.value.filter((x) => x !== t)
    : [...enabledTypes.value, t]
}

function close() {
  jsonError.value = ''
  emit('close')
}

function generate() {
  if (!articleText.value.trim()) return
  emit('generate', { text: articleText.value, types: [...enabledTypes.value] })
}

function importJson() {
  try {
    JSON.parse(jsonText.value)
  } catch {
    jsonError.value = "JSON invalide — vérifie la syntaxe (guillemets, virgules)."
    return
  }
  jsonError.value = ''
  emit('import', { raw: jsonText.value })
}
</script>

<style scoped>
.modal-cta {
  width: 100%; background: #fff; color: #000; border: none;
  font-size: 12px; font-weight: 700; padding: 10px; cursor: pointer;
  border-radius: 8px; text-transform: uppercase; letter-spacing: 0.04em;
}
.modal-cta:hover:not(:disabled) { background: #e0e0e0; }
.modal-cta:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
