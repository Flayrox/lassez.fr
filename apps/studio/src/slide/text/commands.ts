// Helpers de commandes éditeur (toolbar flottante).
import type { Editor } from '@tiptap/vue-3'
import { TEXT_PRESETS, type TextPreset } from './tiptap'

/** Applique un preset typo à la sélection (fusionne avec le textStyle existant). */
export function applyTextPreset(editor: Editor, preset: TextPreset): boolean {
  const style = TEXT_PRESETS[preset].style
  const { from, to } = editor.state.selection
  if (from === to) return false
  editor.chain().focus().setMark('textStyle', style).run()
  return true
}

/** Bascule le surligné Lassez (fond + texte blanc forcé pour rester lisible). */
export function toggleLassezHighlight(editor: Editor, color = '#DC2626'): boolean {
  const active = editor.isActive('lassezHighlight', { color })
  if (active) {
    return editor.chain().focus().unsetMark('lassezHighlight').run()
  }
  return editor
    .chain()
    .focus()
    .setMark('textStyle', { color: '#ffffff' })
    .toggleLassezHighlight(color)
    .run()
}
