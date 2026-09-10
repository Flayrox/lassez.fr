// Panneau Calques : ordre z, visibilité, verrou, renommage, actions.
// Le haut de la liste = le dessus de la pile (z max).
<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between px-4 h-10 border-b shrink-0" style="border-color: #2a2a2a;">
      <span class="text-[11px] font-semibold uppercase tracking-[0.06em]" style="color: #666;">Calques — {{ layers.length }}</span>
      <div class="flex items-center gap-1">
        <button class="layer-add" title="Ajouter un texte" @click="addText">T</button>
        <button class="layer-add" title="Ajouter une image" @click="pickImage">▦</button>
        <button class="layer-add" title="Ajouter une forme" @click="addShape">■</button>
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto sb py-1">
      <div v-if="layers.length === 0" class="px-4 py-6 text-center text-[11px]" style="color: #666;">
        Aucune couche libre.<br />Ajoute du texte, une image ou une forme par-dessus le template.
      </div>
      <div
        v-for="layer in ordered"
        :key="layer.id"
        class="layer-row"
        :class="{ 'is-active': isSelected(layer.id), 'is-hidden': !layer.visible }"
        @click="select(layer.id, $event.shiftKey || $event.ctrlKey || $event.metaKey)"
        @dblclick="startRename(layer)"
      >
        <span class="layer-kind">{{ kindIcon(layer.kind) }}</span>
        <div class="flex-1 min-w-0">
          <input
            v-if="renamingId === layer.id"
            v-model="renameValue"
            class="si !py-0.5 !text-[11px]"
            @click.stop
            @keydown.enter="commitRename(layer.id)"
            @keydown.escape="renamingId = null"
            @blur="commitRename(layer.id)"
          />
          <template v-else>
            <div class="text-[12px] truncate" :style="{ color: isSelected(layer.id) ? '#fff' : '#aaa' }">
              <span v-if="layerBind(layer)" title="Champ lié (rempli par l'IA)">🔗</span>{{ layer.name }}
            </div>
            <div class="text-[9px]" style="color: #666;">
              {{ kindLabel(layer.kind) }} · z {{ layer.z }}
              <span v-if="layer.behind">· derrière template</span>
              <span v-if="layer.locked">· verrouillé</span>
            </div>
          </template>
        </div>
        <div class="flex items-center gap-0.5 opacity-0 layer-actions">
          <button :title="layer.visible ? 'Masquer' : 'Afficher'" @click.stop="toggleVisibility(layer.id)">{{ layer.visible ? '◉' : '◌' }}</button>
          <button :title="layer.locked ? 'Déverrouiller' : 'Verrouiller'" @click.stop="toggleLock(layer.id)">{{ layer.locked ? '🔒' : '🔓' }}</button>
          <button title="Monter" @click.stop="moveZ(layer.id, 1)">▲</button>
          <button title="Descendre" @click.stop="moveZ(layer.id, -1)">▼</button>
          <button title="Dupliquer" @click.stop="duplicate(layer.id)">⧉</button>
          <button title="Supprimer" class="hover:!text-red-400" @click.stop="remove(layer.id)">✕</button>
        </div>
      </div>
    </div>

    <div class="px-4 py-2 border-t text-[10px] shrink-0" style="border-color: #2a2a2a; color: #555;">
      « ▼ » répété envoie <em>derrière</em> le template (asset de fond).
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, inject, ref, type Ref } from 'vue'
import { useSlideDeckStore } from '../store/deck'
import { ASSETS_KEY, type AssetStore } from '../assets'
import type { Layer, LayerKind } from '../types'

const emit = defineEmits<{ (e: 'import-image'): void }>()

const store = useSlideDeckStore()
const fileInput = ref<HTMLInputElement | null>(null)
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const assetStore = inject<Ref<AssetStore | null>>(ASSETS_KEY, ref(null))

const layers = computed(() => store.activeSlide?.layers ?? [])
const ordered = computed(() => [...layers.value].sort((a, b) => b.z - a.z))
const selectedIds = computed(() => new Set(store.selectedLayerIds))

function isSelected(id: string): boolean {
  return selectedIds.value.has(id)
}

function kindIcon(kind: LayerKind): string {
  return kind === 'image' ? '▦' : kind === 'shape' ? '■' : 'T'
}

function kindLabel(kind: LayerKind): string {
  return kind === 'image' ? 'Image' : kind === 'shape' ? 'Forme' : 'Texte'
}

function layerBind(layer: Layer): string {
  if (layer.kind !== 'text') return ''
  const bind = (layer.data as { bind?: unknown }).bind
  return typeof bind === 'string' ? bind : ''
}

function select(id: string, additive: boolean) {
  if (additive) store.toggleLayerSelection(id)
  else store.selectLayer(id)
}

function addText() {
  store.addTextLayer('Nouveau texte')
}

function addShape() {
  store.addShapeLayer('rect')
}

function pickImage() {
  // Si le parent branche la bibliothèque d'assets (modale), on le laisse
  // faire ; sinon repli intégré : sélecteur de fichier local.
  emit('import-image')
  if (!hasImportListener()) fileInput.value?.click()
}

function hasImportListener(): boolean {
  const props = getCurrentInstance()?.vnode.props
  return typeof props?.['onImportImage'] === 'function'
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (assetStore.value) {
    try {
      const asset = await assetStore.value.add(file, file.name)
      store.addImageLayer(asset.url)
    } catch {
      /* import annulé, rien à faire */
    }
  } else {
    const url = URL.createObjectURL(file)
    store.addImageLayer(url)
  }
  if (fileInput.value) fileInput.value.value = ''
}

function toggleVisibility(id: string) {
  store.toggleLayerVisibility(id)
}

function toggleLock(id: string) {
  store.toggleLayerLock(id)
}

function moveZ(id: string, dir: 1 | -1) {
  store.moveLayerZ(id, dir)
}

function duplicate(id: string) {
  store.duplicateLayer(id)
}

function remove(id: string) {
  store.removeLayer(id)
}

function startRename(layer: { id: string; name: string }) {
  renamingId.value = layer.id
  renameValue.value = layer.name
}

function commitRename(id: string) {
  if (renamingId.value !== id) return
  renamingId.value = null
  const name = renameValue.value.trim()
  if (name) store.updateLayer(id, { name })
}
</script>

<style scoped>
.layer-add {
  width: 24px; height: 24px;
  background: #222; border: 1px solid #3a3a3a; color: #aaa;
  font-size: 11px; font-weight: 700; cursor: pointer; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.layer-add:hover { color: #fff; border-color: #555; background: #282828; }
.layer-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; cursor: pointer; user-select: none;
  border-left: 2px solid transparent;
}
.layer-row:hover { background: #1a1a1a; }
.layer-row:hover .layer-actions { opacity: 1 !important; }
.layer-row.is-active { background: #252525; border-left-color: #fff; }
.layer-row.is-hidden { opacity: 0.55; }
.layer-kind {
  width: 22px; height: 22px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: #222; border: 1px solid #2a2a2a; border-radius: 6px;
  font-size: 10px; color: #888;
}
.layer-actions button {
  background: transparent; border: none; cursor: pointer;
  color: #888; font-size: 10px; width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center; border-radius: 6px;
}
.layer-actions button:hover { background: #333; color: #fff; }
</style>
