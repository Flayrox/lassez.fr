// Bibliothèque d'assets : grille, upload, insertion, suppression.
<template>
  <div class="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8" style="backdrop-filter: blur(4px);">
    <div
      class="border shadow-2xl flex flex-col w-full max-w-2xl overflow-hidden rounded-xl"
      style="background: #131313; border-color: #2a2a2a; font-family: Inter, sans-serif; max-height: 80vh;"
    >
      <div class="px-6 py-5 border-b flex justify-between items-center bg-[#111]" style="border-color: #2a2a2a;">
        <div>
          <h3 class="text-[13px] font-bold text-white uppercase tracking-wider">Bibliothèque d'images</h3>
          <p class="text-[11px] mt-1 font-medium" style="color: #666;">Clique pour insérer sur la slide active (devant par défaut).</p>
        </div>
        <button class="text-[#666] hover:text-white transition-colors p-1 rounded-full" @click="emit('close')">✕</button>
      </div>

      <div class="p-6 flex flex-col gap-4 overflow-y-auto sb">
        <div class="flex gap-2">
          <button class="modal-cta" @click="fileInput?.click()">+ Importer une image</button>
          <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" data-testid="assets-file-input" @change="onFiles" />
        </div>

        <div v-if="loading" class="text-center text-[12px] py-8" style="color: #666;">Chargement…</div>
        <div v-else-if="assets.length === 0" class="text-center text-[12px] py-8" style="color: #666;">
          Aucune image. Importe des visuels pour les placer derrière ou devant tes templates.
        </div>
        <div v-else class="grid grid-cols-3 gap-3">
          <div
            v-for="a in assets"
            :key="a.id"
            class="asset-card group"
            :title="a.name"
            @click="emit('insert', a.url)"
          >
            <img :src="a.url" :alt="a.name" loading="lazy" decoding="async" />
            <div class="asset-bar">
              <span class="truncate">{{ a.name }}</span>
              <button
                class="asset-del"
                title="Supprimer"
                @click.stop="remove(a.id)"
              >✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Asset, AssetStore } from '../assets'

const props = defineProps<{ store: AssetStore }>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'insert', url: string): void
}>()

const assets = ref<Asset[]>([])
const loading = ref(true)
const fileInput = ref<HTMLInputElement | null>(null)

async function refresh() {
  loading.value = true
  try {
    assets.value = await props.store.list()
  } finally {
    loading.value = false
  }
}

async function onFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  for (const f of files) {
    const asset = await props.store.add(f, f.name)
    assets.value.unshift(asset)
  }
  if (fileInput.value) fileInput.value.value = ''
  await refresh()
}

async function remove(id: string) {
  await props.store.remove(id)
  await refresh()
}

onMounted(refresh)
</script>

<style scoped>
.modal-cta {
  width: 100%; background: #fff; color: #000; border: none;
  font-size: 12px; font-weight: 700; padding: 10px; cursor: pointer;
  border-radius: 8px; text-transform: uppercase; letter-spacing: 0.04em;
}
.modal-cta:hover { background: #e0e0e0; }
.asset-card {
  border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden;
  cursor: pointer; background: #0f0f0f;
}
.asset-card:hover { border-color: #555; }
.asset-card img { width: 100%; height: 120px; object-fit: cover; display: block; }
.asset-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  padding: 6px 8px; font-size: 10px; color: #aaa;
}
.asset-del {
  background: none; border: none; color: #666; cursor: pointer;
  font-size: 10px; padding: 2px 4px; opacity: 0;
}
.asset-card:hover .asset-del { opacity: 1; }
.asset-del:hover { color: #ef4444; }
</style>
