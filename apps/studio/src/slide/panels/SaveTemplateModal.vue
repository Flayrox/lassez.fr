// Sauvegarde de la slide active comme template custom (nom + catégorie).
<template>
  <div v-if="show" class="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8" style="backdrop-filter: blur(4px);">
    <div
      class="border shadow-2xl flex flex-col w-full max-w-md overflow-hidden rounded-xl"
      style="background: #131313; border-color: #2a2a2a; font-family: Inter, sans-serif;"
    >
      <div class="px-6 py-5 border-b flex justify-between items-center bg-[#111]" style="border-color: #2a2a2a;">
        <div>
          <h3 class="text-[13px] font-bold text-white uppercase tracking-wider">💾 Sauver comme template</h3>
          <p class="text-[11px] mt-1 font-medium" style="color: #666;">La slide active (état + couches + format) devient réutilisable.</p>
        </div>
        <button class="text-[#666] hover:text-white transition-colors p-1 rounded-full" @click="emit('close')">✕</button>
      </div>

      <div class="p-6 flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-[11px] font-bold uppercase tracking-tight ml-1" style="color: #999;">Nom du template</label>
          <input
            v-model="name"
            type="text"
            class="w-full p-3 text-[13px] text-white rounded-lg"
            style="background: #1a1a1a; border: 1px solid #2a2a2a; font-family: Inter, sans-serif;"
            placeholder="Ex : Ma couverture enquête"
            maxlength="60"
            @keydown.enter="save"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-[11px] font-bold uppercase tracking-tight ml-1" style="color: #999;">Catégorie</label>
          <select
            v-model="category"
            class="w-full p-3 text-[12px] rounded-lg cursor-pointer"
            style="background: #1a1a1a; border: 1px solid #2a2a2a; color: #fff;"
          >
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <button class="modal-cta" :disabled="!name.trim()" @click="save">Sauver le template</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { getTemplateGroups } from '../registry'

defineProps<{ show?: boolean }>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { name: string; category: string }): void
}>()

const name = ref('')
const category = ref('Personnalisé')
const categories = computed(() => [
  'Personnalisé',
  ...getTemplateGroups().map((g) => g.name),
])

function save() {
  if (!name.value.trim()) return
  emit('save', { name: name.value.trim(), category: category.value })
  name.value = ''
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
