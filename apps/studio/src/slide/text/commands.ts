// Helpers de commandes éditeur (toolbar flottante).
import type { Editor } from '@tiptap/vue-3'
import { TEXT_PRESETS, type TextPreset } from './tiptap'
import { clampTextSize } from '../brand'

/** Applique un preset typo à la sélection (fusionne avec le textStyle existant). */
export function applyTextPreset(editor: Editor, preset: TextPreset): boolean {
  const style = TEXT_PRESETS[preset].style
  const { from, to } = editor.state.selection
  if (from === to) return false
  // setTextSelection : focus() peut réduire la sélection (jsdom, edge cases)
  // → on la restaure explicitement avant de poser la marque.
  return editor.chain().focus().setTextSelection({ from, to }).setMark('textStyle', style).run()
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

/** Taille (px) de la sélection — marque textStyle, 16px par défaut. */
export function selectionFontSize(editor: Editor): number {
  const raw = editor.getAttributes('textStyle').fontSize as string | undefined
  const parsed = raw ? parseFloat(String(raw).replace(/[^0-9.]/g, '')) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16
}

/** Ajuste la taille de la sélection par pas (toolbar A-/A+). */
export function stepFontSize(editor: Editor, delta: number): boolean {
  const { from, to } = editor.state.selection
  if (from === to) return false
  return editor
    .chain()
    .focus()
    .setTextSelection({ from, to })
    .setMark('textStyle', { fontSize: `${clampTextSize(selectionFontSize(editor) + delta)}px` })
    .run()
}
