// Zone de texte riche — remplace l'EditZone legacy (contentEditable brut +
// execCommand déprécié) par Tiptap. Même look (stickers ✎), moteur moderne.
<template>
  <div class="slide-edit-zone" :class="{ 'is-focused': focused }">
    <div class="slide-edit-sticker" :class="stickerPos" @mousedown.prevent="focusEditor">
      ✎ {{ label }}
    </div>
    <EditorContent :editor="editor" :class="contentClass" :style="contentStyle" />
    <TextToolbar v-if="editable" :editor="editor" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { slideExtensions } from './tiptap'
import TextToolbar from './TextToolbar.vue'

const props = withDefaults(
  defineProps<{
    doc: Record<string, unknown>
    label?: string
    stickerPos?: string
    editable?: boolean
    contentClass?: string | string[] | Record<string, boolean>
    contentStyle?: Record<string, string>
  }>(),
  { label: 'EDIT', stickerPos: '-top-4 left-0', editable: true },
)

const emit = defineEmits<{
  (e: 'update:doc', doc: Record<string, unknown>): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const focused = ref(false)

const editor = new Editor({
  content: props.doc,
  extensions: slideExtensions(),
  editable: props.editable,
  editorProps: { attributes: { class: 'slide-tiptap' } },
  onUpdate: ({ editor: ed }) => {
    emit('update:doc', ed.getJSON() as unknown as Record<string, unknown>)
  },
  onFocus: () => {
    focused.value = true
    emit('focus')
  },
  onBlur: () => {
    focused.value = false
    emit('blur')
  },
})

watch(
  () => props.editable,
  (v) => editor.setEditable(v, false),
)

// Sync externe (undo, reset, IA) : ne pas écraser la frappe en cours.
watch(
  () => props.doc,
  (next) => {
    if (editor.isFocused) return
    const current = JSON.stringify(editor.getJSON())
    if (current !== JSON.stringify(next)) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  },
  { deep: true },
)

function focusEditor() {
  editor.commands.focus('end')
}

onBeforeUnmount(() => {
  editor.destroy()
})

defineExpose({ editor, focusEditor })
</script>
