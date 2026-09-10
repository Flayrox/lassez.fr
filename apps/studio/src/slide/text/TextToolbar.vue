// Toolbar flottante de mise en forme — remplace le BrutToolbar legacy.
// Même positionnement (bulle au-dessus de la sélection), mêmes actions
// (B/I/U, souligné militant, couleurs, surlignés, presets), mais branchée
// sur les commandes Tiptap au lieu de document.execCommand.
// Téléportée sur body : le viewport applique un transform CSS qui casserait
// tout position fixed resté dans l'arbre du stage (repère faussé).
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="slide-tb export-hide"
      :style="{ left: `${x}px`, top: `${y}px` }"
      @mousedown.prevent
    >
    <button class="tb-btn" :class="{ 'is-active': isActive('bold') }" title="Gras" @click="chain().toggleBold().run()"><b>B</b></button>
    <button class="tb-btn" :class="{ 'is-active': isActive('italic') }" title="Italique" @click="chain().toggleItalic().run()"><i>I</i></button>
    <button class="tb-btn" :class="{ 'is-active': isActive('underline') }" title="Souligné" @click="chain().toggleUnderline().run()"><u>U</u></button>
    <button
      class="tb-btn" :class="{ 'is-active': isActive('militantUnderline') }" title="Souligné militant"
      @click="chain().toggleMilitantUnderline().run()"
    >
      <span class="tb-militant">U</span>
    </button>
    <span class="tb-sep" />
    <button class="tb-btn" title="Texte rouge" @click="chain().setColor('#DC2626').run()"><span class="tb-dot" style="background:#DC2626" /></button>
    <button class="tb-btn" title="Texte noir" @click="chain().setColor('#000000').run()"><span class="tb-dot" style="background:#000" /></button>
    <button class="tb-btn" title="Texte blanc" @click="chain().setColor('#ffffff').run()"><span class="tb-dot" style="background:#fff" /></button>
    <button
      class="tb-btn" :class="{ 'is-active': isActive('lassezHighlight', { color: '#DC2626' }) }"
      title="Surligné rouge" @click="onHighlight('#DC2626')"
    ><span class="tb-hl" style="background:#DC2626">A</span></button>
    <button
      class="tb-btn" :class="{ 'is-active': isActive('lassezHighlight', { color: '#000000' }) }"
      title="Surligné noir" @click="onHighlight('#000000')"
    ><span class="tb-hl" style="background:#000">A</span></button>
    <span class="tb-sep" />
    <button class="tb-btn" title="Réduire la taille (pas de 2px)" @click="step(-2)"><span class="tb-size">A-</span></button>
    <button class="tb-btn" title="Agrandir la taille (pas de 2px)" @click="step(2)"><span class="tb-size tb-big">A+</span></button>
    <span class="tb-sep" />
    <button class="tb-btn" title="Aligner à gauche" @click="chain().setTextAlign('left').run()">⇤</button>
    <button class="tb-btn" title="Centrer" @click="chain().setTextAlign('center').run()">⇔</button>
    <button class="tb-btn" title="Aligner à droite" @click="chain().setTextAlign('right').run()">⇥</button>
    <span class="tb-sep" />
    <select class="tb-sel" title="Preset typographique" :value="''" @change="onPreset(($event.target as HTMLSelectElement).value)">
      <option value="" disabled>Style…</option>
      <option v-for="(p, key) in TEXT_PRESETS" :key="key" :value="key">{{ p.label }}</option>
    </select>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { TEXT_PRESETS, type TextPreset } from './tiptap'
import { applyTextPreset, stepFontSize, toggleLassezHighlight } from './commands'

const props = defineProps<{ editor: Editor }>()

const visible = ref(false)
const x = ref(0)
const y = ref(0)

function chain() {
  return props.editor.chain().focus()
}

function isActive(name: string, attrs?: Record<string, unknown>) {
  return props.editor.isActive(name, attrs)
}

function onHighlight(color: string) {
  toggleLassezHighlight(props.editor, color)
}

function step(delta: number) {
  stepFontSize(props.editor, delta)
}

function onPreset(value: string) {
  if (!value) return
  applyTextPreset(props.editor, value as TextPreset)
}

function refresh() {
  const { editor } = props
  const sel = window.getSelection()
  if (!editor.isEditable || editor.state.selection.empty || !sel || sel.rangeCount === 0) {
    visible.value = false
    return
  }
  const range = sel.getRangeAt(0)
  const host = (editor.view.dom as HTMLElement).closest('.slide-stage')
  const anchor = host ?? editor.view.dom
  if (!anchor.contains(range.commonAncestorContainer)) {
    visible.value = false
    return
  }
  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    visible.value = false
    return
  }
  x.value = rect.left + rect.width / 2
  // Carte de 42px + marge : la bulle flotte au-dessus sans recouvrir.
  y.value = Math.max(48, rect.top - 52)
  visible.value = true
}

function onSelectionChange() {
  // Laisse le DOM se stabiliser avant de mesurer la sélection.
  requestAnimationFrame(refresh)
}

onMounted(() => {
  document.addEventListener('selectionchange', onSelectionChange)
  props.editor.on('blur', () => { visible.value = false })
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
})
</script>
