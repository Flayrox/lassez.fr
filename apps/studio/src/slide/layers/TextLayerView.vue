// Couche texte libre — modèle Canva : clic = sélection (read-only),
// drag corps = déplacement (seuil 4px), double-clic/Entrée = édition,
// Échap = retour sélection. Frappe groupée en un seul undo.
<template>
  <div
    class="absolute slide-layer-view"
    :class="{ 'is-editing': editing }"
    :style="boxStyle"
    @pointerdown.stop="onDown"
    @dblclick.stop="onEditRequest"
  >
    <RichText
      ref="richRef"
      :doc="doc"
      :label="layer.name"
      sticker-pos="-top-4 left-0"
      :editable="editing"
      :content-style="typoStyle"
      @focus="onFocus"
      @update:doc="onUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import RichText from '../text/RichText.vue'
import { DEFAULT_TEXT_SIZE } from '../brand'
import { createRafEmitter } from '../engine/gestures'
import { useSlideDeckStore } from '../store/deck'
import type { Layer, TextLayerData } from '../types'

const props = withDefaults(
  defineProps<{ layer: Layer; scale?: number }>(),
  { scale: 1 },
)

const emit = defineEmits<{
  (e: 'select', id: string, additive: boolean): void
  (e: 'gesturestart', id: string): void
  (e: 'move', pos: { x: number; y: number }): void
  (e: 'gestureend'): void
}>()

const store = useSlideDeckStore()
const richRef = ref<{ editor: { commands: { focus: (pos?: string) => void } } } | null>(null)
let gesturing = false
let dragging = false
let out: ReturnType<typeof createRafEmitter<{ x: number; y: number }>> | null = null
let origin = { x: 0, y: 0 }
let start = { x: 0, y: 0 }

/** Seuil drag vs clic (px écran) — en dessous : simple sélection. */
const DRAG_THRESHOLD = 4

const data = computed(() => props.layer.data as TextLayerData)
const doc = computed(() => (data.value.doc ?? {}) as Record<string, unknown>)
const editing = computed(() => store.editingLayerId === props.layer.id)

/** Typo libre de la couche — héritée par les paragraphes sans marque. */
const typoStyle = computed<Record<string, string>>(() => {
  const d = data.value
  const style: Record<string, string> = {
    textAlign: d.align ?? 'left',
    fontSize: `${d.fontSize ?? DEFAULT_TEXT_SIZE}px`,
  }
  if (d.color) style.color = d.color
  if (d.fontFamily) style.fontFamily = d.fontFamily
  if (d.fontWeight) style.fontWeight = String(d.fontWeight)
  if (d.lineHeight) style.lineHeight = String(d.lineHeight)
  if (d.letterSpacing) style.letterSpacing = `${d.letterSpacing}em`
  return style
})

const boxStyle = computed(() => ({
  left: `${props.layer.x}px`,
  top: `${props.layer.y}px`,
  width: `${props.layer.w}px`,
  minHeight: `${props.layer.h}px`,
  opacity: String(props.layer.opacity),
  transform: props.layer.rotation ? `rotate(${props.layer.rotation}deg)` : undefined,
  cursor: editing.value ? 'text' : 'move',
}))

// Entrée en édition → focus vérifié (retry borné) : le focus programmatique
// peut rater sa cible (sélection native du double-clic, mount async de la
// vue Tiptap) — on revérifie et on réessaie sur les frames suivantes.
watch(editing, (v) => {
  if (!v) return
  focusEditorSoon()
})

function focusEditorSoon(attempt = 0) {
  if (!editing.value) return
  const ed = richRef.value?.editor as unknown as {
    commands: { focus: (pos?: string) => void }
    isFocused?: boolean
  } | null
  if (!ed) {
    if (attempt < 8) requestAnimationFrame(() => focusEditorSoon(attempt + 1))
    return
  }
  try {
    if (!ed.isFocused) ed.commands.focus('end')
  } catch {
    /* réessayé ci-dessous */
  }
  requestAnimationFrame(() => {
    if (!editing.value) return
    try {
      if (!ed.isFocused && attempt < 8) {
        ed.commands.focus('end')
        focusEditorSoon(attempt + 1)
      }
    } catch {
      /* abandon silencieux : l'utilisateur cliquera dans le texte */
    }
  })
}

function isAdditive(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return e.shiftKey || e.ctrlKey || e.metaKey
}

function onDown(e: PointerEvent) {
  // En édition : l'éditeur gère tout (curseur, sélection de texte).
  if (editing.value) return
  emit('select', props.layer.id, isAdditive(e))
  if (e.button !== 0) return
  origin = { x: e.clientX, y: e.clientY }
  start = { x: props.layer.x, y: props.layer.y }
  dragging = false
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}

function onMove(e: PointerEvent) {
  const dist = Math.hypot(e.clientX - origin.x, e.clientY - origin.y)
  if (!dragging) {
    if (dist < DRAG_THRESHOLD) return
    dragging = true
    emit('gesturestart', props.layer.id)
    out = createRafEmitter((pos: { x: number; y: number }) => emit('move', pos))
  }
  const s = Math.max(0.05, props.scale)
  out?.push({ x: start.x + (e.clientX - origin.x) / s, y: start.y + (e.clientY - origin.y) / s })
}

function onUp() {
  window.removeEventListener('pointermove', onMove)
  if (!dragging) return
  dragging = false
  out?.flush()
  out = null
  emit('gestureend')
}

function onEditRequest() {
  store.startEditing(props.layer.id)
}

function onFocus() {
  emit('select', props.layer.id, false)
  if (!gesturing) {
    gesturing = true
    store.beginGesture()
  }
}

function onUpdate(doc: Record<string, unknown>) {
  if (!gesturing) {
    gesturing = true
    store.beginGesture()
  }
  store.updateLayerDataLive(props.layer.id, { doc })
  // Fin de session : le prochain blur/focus rouvrira un geste.
  window.clearTimeout((onUpdate as unknown as { _t?: number })._t)
  ;(onUpdate as unknown as { _t?: number })._t = window.setTimeout(() => {
    gesturing = false
  }, 2000)
}
</script>
