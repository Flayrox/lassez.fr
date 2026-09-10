// Helpers partagés des templates : lecture typée du state + patch groupé
// (1 focus = 1 niveau d'undo) pour la frappe dans les RichText.
import { useSlideDeckStore } from '../store/deck'
import { fieldDoc } from '../text/fields'

export function useTemplateFields() {
  const store = useSlideDeckStore()
  let gesturing = false

  /** À brancher sur @focus des RichText : groupe la session de frappe. */
  function onFocus() {
    if (gesturing) return
    gesturing = true
    store.beginGesture()
  }

  function onBlur() {
    gesturing = false
  }

  /** Patch discret (couleurs, sliders, drag) : 1 undo par appel. */
  function patch(p: Record<string, unknown>) {
    store.patchTemplateState(p)
  }

  /** Patch de frappe (groupé via onFocus, auto-commit si oublié). */
  function live(p: Record<string, unknown>) {
    if (!gesturing) onFocus()
    store.patchTemplateStateLive(p)
  }

  function docFor(state: Record<string, unknown>, key: string) {
    return fieldDoc(state, key)
  }

  function str(state: Record<string, unknown>, key: string, fallback = ''): string {
    const v = state[key]
    return typeof v === 'string' ? v : fallback
  }

  function num(state: Record<string, unknown>, key: string, fallback = 0): number {
    const v = state[key]
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback
  }

  function bool(state: Record<string, unknown>, key: string, fallback = false): boolean {
    const v = state[key]
    return typeof v === 'boolean' ? v : fallback
  }

  return { onFocus, onBlur, patch, live, docFor, str, num, bool }
}
