// Couche texte libre : RichText positionné, sélection au clic, frappe
// groupée en un seul undo (focus → beginGesture, frappe → live).
<template>
  <div
    class="absolute"
    :style="boxStyle"
    @pointerdown.stop="onSelect"
  >
    <RichText
      :doc="doc"
      :label="layer.name"
      sticker-pos="-top-4 left-0"
      :content-style="typoStyle"
      @focus="onFocus"
      @update:doc="onUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RichText from '../text/RichText.vue'
import { DEFAULT_TEXT_SIZE } from '../brand'
import { useSlideDeckStore } from '../store/deck'
import type { Layer, TextLayerData } from '../types'

const props = defineProps<{ layer: Layer }>()

const emit = defineEmits<{ (e: 'select', id: string): void }>()

const store = useSlideDeckStore()
let gesturing = false

const data = computed(() => props.layer.data as TextLayerData)
const doc = computed(() => (data.value.doc ?? {}) as Record<string, unknown>)

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
}))

function onSelect() {
  emit('select', props.layer.id)
}

function onFocus() {
  emit('select', props.layer.id)
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
