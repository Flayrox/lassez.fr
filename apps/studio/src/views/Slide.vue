<!-- Slide — studio de création visuelle (transposition Vue du legacy).
     Look legacy à l'identique, moteur premium : viewport pan/zoom,
     couches Tiptap, assets derrière/devant, exports multi-format. -->
<template>
  <div
    class="slide-root -m-6 lg:-m-8 flex flex-col overflow-hidden"
    style="height: calc(100dvh - 56px);"
  >
    <SlideToolbar
      :deck-count="store.slides.length"
      :can-undo="store.canUndo"
      :can-redo="store.canRedo"
      :deck-format="store.deckFormat"
      :zoom-percent="zoomPercent"
      @ai="showArticle = true"
      @import-json="showJson = true"
      @undo="store.undo()"
      @redo="store.redo()"
      @format="onDeckFormat"
      @clean="onCleanStyles"
      @reset="onResetSlide"
      @export-json="onExportJSON"
      @export-zip="onExportZIP"
      @export-jpg="onExportJPG"
      @export-png="onExportPNG"
    />

    <div class="flex flex-1 overflow-hidden relative">
      <!-- Sidebar deck -->
      <div :style="{ width: `${sidebarWidth}px`, minWidth: '200px', display: 'flex' }">
        <DeckSidebar :ai-loading="aiLoading" class="flex-1" @generate="showArticle = true" />
      </div>
      <div class="slide-resizer" @mousedown="(e) => startResize(e, 'sidebar')" />

      <!-- Canvas central -->
      <main class="flex-1 overflow-hidden flex flex-col" style="background: #111;">
        <div class="flex items-center px-6 gap-3 shrink-0" style="background: #1a1a1a; border-bottom: 1px solid #2a2a2a; height: 40px;">
          <span class="text-[11px]" style="color: #666; font-family: Inter, sans-serif;">Studio</span>
          <span style="color: #333;">/</span>
          <span class="text-[11px]" style="color: #999; font-family: Inter, sans-serif;">Slide Editor</span>
          <div class="ml-auto flex items-center gap-1.5">
            <button class="zoom-btn" title="Zoom arrière" @click="viewportRef?.zoomStep(-1)">−</button>
            <button class="zoom-btn zoom-value" :title="`Zoom ${zoomPercent ?? 100}% — cliquer pour ajuster`" @click="viewportRef?.fit()">
              {{ zoomPercent ?? 100 }}%
            </button>
            <button class="zoom-btn" title="Zoom avant" @click="viewportRef?.zoomStep(1)">+</button>
            <button class="zoom-btn" title="Ajuster à l’écran" @click="viewportRef?.fit()">⛶</button>
            <span class="text-[10px] ml-2" style="color: #444; font-family: Inter, sans-serif;">
              {{ formatLabel }}
            </span>
          </div>
        </div>

        <Viewport
          v-if="store.activeSlide"
          ref="viewportRef"
          :stage-w="stageW"
          :stage-h="stageH"
          @zoom="zoomPercent = Math.round($event * 100)"
        >
          <SlideStage
            :key="store.activeSlide.id + store.activeSlide.format"
            ref="stageRef"
            :slide="store.activeSlide"
          />
        </Viewport>
      </main>

      <div class="slide-resizer" @mousedown="(e) => startResize(e, 'props')" />

      <!-- Panneau droit : onglets Propriétés / Calques -->
      <div :style="{ width: `${propsWidth}px`, minWidth: '240px', display: 'flex', flexDirection: 'column', background: '#141414' }">
        <div class="flex shrink-0" style="border-bottom: 1px solid #2a2a2a;">
          <button
            v-for="tab in (['props', 'layers'] as const)"
            :key="tab"
            class="right-tab"
            :class="{ 'is-active': rightTab === tab }"
            @click="rightTab = tab"
          >{{ tab === 'props' ? 'Propriétés' : `Calques (${layerCount})` }}</button>
        </div>
        <div class="flex-1 overflow-hidden flex flex-col">
          <PropsPanel v-show="rightTab === 'props'" class="flex-1 overflow-hidden" />
          <LayersPanel v-show="rightTab === 'layers'" class="flex-1 overflow-hidden" @import-image="showAssets = true" />
        </div>
      </div>
    </div>

    <!-- Barre de progression export -->
    <div
      v-if="exportProgress"
      class="flex items-center justify-center gap-3 shrink-0 text-[12px] font-semibold"
      style="height: 36px; background: #0f0f0f; border-top: 1px solid #2a2a2a; color: #fff;"
    >
      <span class="w-2 h-2 rounded-full bg-white animate-ping" />
      {{ exportProgress }}
    </div>

    <SlideModals
      :show-article="showArticle"
      :show-json="showJson"
      :ai-loading="aiLoading"
      :initial-article="store.articleInput"
      @close="showArticle = false; showJson = false"
      @generate="onGenerate"
      @import="onImportJson"
    />

    <AssetsModal
      v-if="showAssets && assetStore"
      :store="assetStore"
      @close="showAssets = false"
      @insert="onInsertAsset"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import '../slide/slide.css'
import { useSlideDeckStore } from '../slide/store/deck'
import { getFormat } from '../slide/formats'
import type { FormatId } from '../slide/types'
import { buildDeckFromArticle } from '../slide/article'
import { ASSETS_KEY, createAssetStore, type AssetStore } from '../slide/assets'
import {
  buildDeckZip,
  deckFileName,
  downloadBlob,
  downloadDataUrl,
  renderStagePNG,
  slideFileName,
} from '../slide/exporter'
import { stripMarksFromState } from '../slide/text/tiptap'
import { useSlideShortcuts } from '../slide/engine/shortcuts'
import Viewport from '../slide/engine/Viewport.vue'
import SlideStage from '../slide/layers/SlideStage.vue'
import DeckSidebar from '../slide/panels/DeckSidebar.vue'
import PropsPanel from '../slide/panels/PropsPanel.vue'
import LayersPanel from '../slide/layers/LayersPanel.vue'
import SlideToolbar from '../slide/panels/SlideToolbar.vue'
import SlideModals from '../slide/panels/SlideModals.vue'
import AssetsModal from '../slide/panels/AssetsModal.vue'

const store = useSlideDeckStore()
const route = useRoute()

const viewportRef = ref<InstanceType<typeof Viewport> | null>(null)
const stageRef = ref<{ stageEl: HTMLElement | null } | null>(null)

const showArticle = ref(false)
const showJson = ref(false)
const showAssets = ref(false)
const aiLoading = ref(false)
const exportProgress = ref<string | null>(null)
const zoomPercent = ref<number | null>(null)
const rightTab = ref<'props' | 'layers'>('props')
const assetStore = ref<AssetStore | null>(null)
// Bibliothèque partagée (champs image des templates + panneau calques).
provide(ASSETS_KEY, assetStore)

// Panneaux redimensionnables (comme le legacy).
const sidebarWidth = ref(300)
const propsWidth = ref(340)
let resizing: 'sidebar' | 'props' | null = null

const stageW = computed(() => getFormat(store.activeSlide?.format ?? '4:5').width)
const stageH = computed(() => getFormat(store.activeSlide?.format ?? '4:5').height)
const formatLabel = computed(() => {
  const f = getFormat(store.activeSlide?.format ?? '4:5')
  return `${f.width} × ${f.height} px`
})
const layerCount = computed(() => store.activeSlide?.layers.length ?? 0)

useSlideShortcuts({
  onDeleteSlide: () => {
    if (store.activeSlide && store.slides.length > 1) {
      store.deleteSlide(store.activeSlide.id)
      toast.success('Slide supprimée')
    }
  },
})

function startResize(e: MouseEvent, which: 'sidebar' | 'props') {
  e.preventDefault()
  resizing = which
  document.body.style.cursor = 'col-resize'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeUp, { once: true })
}

function onResizeMove(e: MouseEvent) {
  if (resizing === 'sidebar') {
    sidebarWidth.value = Math.max(200, Math.min(500, e.clientX))
  } else if (resizing === 'props') {
    propsWidth.value = Math.max(240, Math.min(600, window.innerWidth - e.clientX))
  }
}

function onResizeUp() {
  resizing = null
  document.body.style.cursor = ''
  window.removeEventListener('mousemove', onResizeMove)
}

// ── Persistance (debounce 600ms) ──────────────────────────────
let saveTimer: number | null = null
let quotaWarned = false
watch(
  () => store.serialize(),
  () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      if (!store.saveToStorage() && !quotaWarned) {
        quotaWarned = true
        toast.error('Stockage local plein — exporte ton deck en JSON pour ne rien perdre')
      }
    }, 600)
  },
  { deep: true },
)

// ── Actions ───────────────────────────────────────────────────
function onDeckFormat(format: string) {
  store.setDeckFormat(format as FormatId)
  toast.success(`Format du deck : ${format}`)
}

function onCleanStyles() {
  const slide = store.activeSlide
  if (!slide) return
  store.patchTemplateState(stripMarksFromState(slide.templateState))
  toast.success('Styles nettoyés')
}

function onResetSlide() {
  const slide = store.activeSlide
  if (!slide) return
  if (!window.confirm('Remettre cette slide à zéro ?')) return
  if (store.resetSlide(slide.id)) toast.success('Slide réinitialisée')
}

function onGenerate(payload: { text: string; types: import('../slide/types').SlideType[] }) {
  aiLoading.value = true
  try {
    store.setArticleInput(payload.text)
    const { slides, activeId } = buildDeckFromArticle(payload.text, payload.types)
    // Remplace le deck (avec undo possible : checkpoint manuel via une slide).
    store.loadDoc({ deck: slides.map((s) => ({ ...s, state: s.templateState })), activeId })
    showArticle.value = false
    toast.success(`${slides.length} slides générées — l'IA Gemini prendra le relais`)
  } finally {
    aiLoading.value = false
  }
}

function onImportJson(payload: { raw: string }) {
  try {
    const data = JSON.parse(payload.raw) as unknown
    if (store.loadDoc(data)) {
      showJson.value = false
      toast.success('Deck importé')
    } else {
      toast.error("Deck vide ou format non reconnu (attendu : {deck:[…]} ou {slides:[…]})")
    }
  } catch {
    toast.error('JSON invalide')
  }
}

function stageEl(): HTMLElement | null {
  return stageRef.value?.stageEl ?? null
}

async function settleEditors(ms = 250) {
  // Les éditeurs Tiptap montent en async (rAF) : on attend avant de capturer.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  await new Promise((r) => window.setTimeout(r, ms))
}

async function onExportPNG() {
  await exportSingle('png')
}

async function onExportJPG() {
  await exportSingle('jpeg')
}

async function exportSingle(format: 'png' | 'jpeg') {
  const slide = store.activeSlide
  const el = stageEl()
  if (!slide || !el) return
  exportProgress.value = format === 'png' ? 'Export PNG…' : 'Export JPG…'
  try {
    const f = getFormat(slide.format)
    const dataUrl = await renderStagePNG(el, {
      width: f.width,
      height: f.height,
      pixelRatio: 2,
      format,
    })
    const ext = format === 'png' ? 'png' : 'jpg'
    const name = slideFileName(slide.label, store.slides.indexOf(slide), ext)
    downloadDataUrl(dataUrl, name)
    toast.success(`Exporté : ${name}`)
  } catch (e) {
    toast.error(`Échec export : ${(e as Error).message}`)
  } finally {
    exportProgress.value = null
  }
}

async function onExportZIP() {
  if (store.slides.length === 0) return
  exportProgress.value = 'Export ZIP…'
  const currentId = store.activeId
  try {
    const entries: { name: string; dataUrl: string }[] = []
    for (let i = 0; i < store.slides.length; i++) {
      const slide = store.slides[i]
      exportProgress.value = `Export ${i + 1}/${store.slides.length}…`
      store.setActiveId(slide.id)
      await settleEditors(200)
      const el = stageEl()
      if (!el) continue
      const f = getFormat(slide.format)
      const dataUrl = await renderStagePNG(el, { width: f.width, height: f.height, pixelRatio: 2 })
      entries.push({ name: slideFileName(slide.label, i), dataUrl })
    }
    const blob = await buildDeckZip(entries)
    downloadBlob(blob, deckFileName('deck', 'zip'))
    toast.success(`${entries.length} slides exportées (ZIP)`)
  } catch (e) {
    toast.error(`Échec export : ${(e as Error).message}`)
  } finally {
    store.setActiveId(currentId)
    exportProgress.value = null
  }
}

function onExportJSON() {
  const ok = downloadBlob(
    new Blob([JSON.stringify(store.serialize(), null, 2)], { type: 'application/json' }),
    deckFileName('deck', 'json'),
  )
  if (ok) toast.success('Deck exporté (JSON)')
  else toast.error('Échec export JSON')
}

async function onInsertAsset(url: string) {
  const layer = store.addImageLayer(url)
  if (layer) {
    rightTab.value = 'layers'
    toast.success('Image insérée — déplace-la, redimensionne-la, passe-la derrière')
  }
  showAssets.value = false
}

// ── Init ──────────────────────────────────────────────────────
onMounted(async () => {
  const restored = store.loadFromStorage()
  if (!restored) store.ensureInit()
  assetStore.value = await createAssetStore()
  // Entrée pipeline : ?title=…&body=… (depuis Signaux/Diffusion).
  const title = typeof route.query.title === 'string' ? route.query.title : ''
  const body = typeof route.query.body === 'string' ? route.query.body : ''
  if (title || body) store.fromSignal(title, body)
})

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
  store.saveToStorage()
})
</script>

<style scoped>
.right-tab {
  flex: 1; background: transparent; border: none; cursor: pointer;
  font-size: 11px; font-weight: 700; color: #666; padding: 10px 0;
  text-transform: uppercase; letter-spacing: 0.06em;
  border-bottom: 2px solid transparent;
}
.right-tab.is-active { color: #fff; border-bottom-color: #fff; }
.slide-resizer {
  width: 8px; margin-left: -4px; margin-right: -4px;
  cursor: col-resize; z-index: 100; position: relative;
}
.slide-resizer:hover { background: rgba(255, 255, 255, 0.1); }
.zoom-btn {
  min-width: 26px; height: 24px; padding: 0 6px;
  background: #252525; border: 1px solid #2a2a2a; color: #aaa;
  font-size: 12px; font-weight: 700; cursor: pointer; border-radius: 6px;
  font-family: 'Inter', system-ui, sans-serif;
  display: inline-flex; align-items: center; justify-content: center;
}
.zoom-btn:hover { border-color: #555; color: #fff; }
.zoom-btn.zoom-value { font-family: 'Inter', monospace; font-size: 10px; font-weight: 600; }
</style>
