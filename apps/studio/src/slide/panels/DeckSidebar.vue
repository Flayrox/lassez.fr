// Sidebar Deck : liste des slides (drag & drop), catalogue d'ajout groupé,
// footer génération IA. Look legacy à l'identique.
<template>
  <aside class="flex flex-col h-full shrink-0 overflow-visible relative" style="background: #141414; font-family: 'Inter', system-ui, sans-serif;">
    <div class="flex items-center justify-between px-4 shrink-0" style="height: 44px; border-bottom: 1px solid #2a2a2a; background: #111;">
      <span class="text-[10px] font-bold uppercase tracking-[0.08em]" style="color: #666;">
        Deck — {{ slides.length }}
      </span>
      <div class="relative">
        <button class="add-btn" :class="{ 'is-open': showMenu }" title="Ajouter une slide" @click="showMenu = !showMenu">+</button>
        <div v-if="showMenu" class="add-menu sb">
          <div v-for="group in groups" :key="group.name">
            <div class="add-group">{{ group.name }}</div>
            <button
              v-for="t in group.templates"
              :key="t.id"
              class="add-item"
              @click="add(t.id)"
            ><span class="mr-2">{{ t.icon }}</span>{{ t.name }}</button>
          </div>
        </div>
      </div>
    </div>

    <div ref="listEl" class="flex-1 overflow-y-auto sb py-1.5">
      <div
        v-for="(slide, i) in slides"
        :key="slide.id"
        class="slide-row group"
        :class="{ 'is-active': slide.id === activeId }"
        @pointerdown="select(slide.id)"
      >
        <span class="drag-handle" title="Réordonner">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" /></svg>
        </span>
        <span class="text-[9px] font-semibold tabular-nums w-3.5 text-right shrink-0" style="color: #666;">
          {{ String(i + 1).padStart(2, '0') }}
        </span>
        <div class="flex-1 min-w-0">
          <input
            class="row-label"
            :class="{ 'is-active': slide.id === activeId }"
            :value="slide.label"
            @change="rename(slide.id, ($event.target as HTMLInputElement).value)"
            @pointerdown.stop
          />
          <div class="text-[9px] font-medium opacity-80" style="color: #666;">
            {{ templateName(slide.type) }}
          </div>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button class="row-btn" title="Dupliquer" @click.stop="duplicate(slide.id)">⧉</button>
          <button class="row-btn danger" title="Supprimer" @click.stop="remove(slide.id)">✕</button>
        </div>
      </div>
    </div>

    <div class="p-3 shrink-0" style="border-top: 1px solid #2a2a2a; background: #111;">
      <button class="gen-btn" :disabled="aiLoading" @click="emit('generate')">
        <span v-if="aiLoading" class="animate-ping w-2 h-2 rounded-full bg-white" />
        {{ aiLoading ? 'Génération…' : '✦ Générer le deck' }}
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Sortable from 'sortablejs'
import { getTemplate, getTemplateGroups } from '../registry'
import type { SlideType } from '../types'
import { useSlideDeckStore } from '../store/deck'

defineProps<{ aiLoading?: boolean }>()

const emit = defineEmits<{ (e: 'generate'): void }>()

const store = useSlideDeckStore()
const showMenu = ref(false)
const listEl = ref<HTMLElement | null>(null)
let sortable: Sortable | null = null

const slides = computed(() => store.slides)
const activeId = computed(() => store.activeId)
const groups = computed(() => getTemplateGroups())

function templateName(type: SlideType): string {
  return getTemplate(type)?.name ?? type.replace(/_/g, ' ')
}

function select(id: string) {
  store.setActiveId(id)
}

function add(type: SlideType) {
  store.addSlide(type)
  showMenu.value = false
}

function duplicate(id: string) {
  store.duplicateSlide(id)
}

function remove(id: string) {
  store.removeSlide(id)
}

function rename(id: string, label: string) {
  if (label.trim()) store.renameSlide(id, label.trim())
}

onMounted(() => {
  if (!listEl.value) return
  try {
    sortable = Sortable.create(listEl.value, {
      animation: 150,
      handle: '.drag-handle',
      draggable: '.slide-row',
      onEnd: (evt) => {
        if (evt.oldIndex === undefined || evt.newIndex === undefined) return
        store.reorder(evt.oldIndex, evt.newIndex)
      },
    })
  } catch {
    sortable = null // jsdom / SSR : le DnD est optionnel, la liste reste cliquable
  }
})

onBeforeUnmount(() => {
  sortable?.destroy()
  sortable = null
})
</script>

<style scoped>
.add-btn {
  width: 28px; height: 28px;
  background: #222; border: 1px solid #3a3a3a; color: #aaa;
  font-size: 18px; font-weight: 400; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px; line-height: 1;
}
.add-btn.is-open { background: #fff; border-color: #fff; color: #000; }
.add-menu {
  position: absolute; top: 36px; left: 0;
  background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px;
  z-index: 1000; width: 220px; max-height: 60vh; overflow-y: auto;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
}
.add-group {
  padding: 10px 14px 4px;
  font-size: 9px; font-weight: 800; color: #555;
  text-transform: uppercase; letter-spacing: 0.12em;
}
.add-item {
  width: 100%; text-align: left; background: none; border: none;
  cursor: pointer; padding: 8px 16px; font-size: 12px; color: #aaa;
  font-family: 'Inter', system-ui, sans-serif;
  display: flex; align-items: center;
}
.add-item:hover { background: #202020; color: #fff; }
.slide-row {
  display: flex; align-items: center; gap: 10px;
  padding: 4px 12px 4px 10px; cursor: pointer; user-select: none;
  border-left: 2px solid transparent; position: relative;
}
.slide-row:hover { background: #1a1a1a; }
.slide-row.is-active { background: #252525; border-left-color: #fff; }
.drag-handle { cursor: grab; display: flex; align-items: center; padding: 4px 2px; color: #333; }
.drag-handle:hover { color: #666; }
.row-label {
  background: transparent; border: none; outline: none; width: 100%;
  font-size: 12px; color: #aaa; font-family: 'Inter', system-ui, sans-serif;
  cursor: text; letter-spacing: -0.01em; padding: 0;
}
.row-label.is-active { color: #fff; font-weight: 600; }
.row-btn {
  background: transparent; border: none; cursor: pointer;
  color: #888; font-size: 10px; width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center; border-radius: 6px;
}
.row-btn:hover { background: #333; color: #fff; }
.row-btn.danger:hover { background: #2a1010; color: #ef4444; }
.gen-btn {
  width: 100%; background: #222; border: 1px solid #3a3a3a; color: #fff;
  font-size: 11px; font-weight: 700; padding: 10px 12px; cursor: pointer;
  border-radius: 8px; font-family: 'Inter', system-ui, sans-serif;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.gen-btn:hover:not(:disabled) { border-color: #555; background: #282828; }
.gen-btn:disabled { cursor: not-allowed; color: #666; }
</style>
