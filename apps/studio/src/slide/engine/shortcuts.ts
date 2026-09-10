// Raccourcis clavier du studio (inactifs pendant la frappe / les champs).
import { onBeforeUnmount, onMounted } from 'vue'
import { useSlideDeckStore } from '../store/deck'

export interface ShortcutHandlers {
  onDeleteSlide?: () => void
}

/** Suppr = supprimer couche (ou slide via handler), Ctrl+Z/Y, Ctrl+D, Échap, flèches. */
export function useSlideShortcuts(handlers: ShortcutHandlers = {}) {
  const store = useSlideDeckStore()

  function isTyping(): boolean {
    const el = document.activeElement as HTMLElement | null
    if (!el) return false
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
    if (el.isContentEditable) return true
    if (el.closest?.('.tiptap')) return true
    return false
  }

  function onKey(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey

    if (e.key === 'Escape') {
      store.clearLayerSelection()
      return
    }
    if (isTyping()) return

    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault()
      store.undo()
      return
    }
    if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) {
      e.preventDefault()
      store.redo()
      return
    }
    if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      if (store.selectedLayerIds.length > 0) store.duplicateLayers([...store.selectedLayerIds])
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (store.selectedLayerIds.length > 0) {
        e.preventDefault()
        store.removeLayers([...store.selectedLayerIds])
      } else {
        handlers.onDeleteSlide?.()
      }
      return
    }
    if (e.key.startsWith('Arrow') && store.selectedLayerIds.length > 0) {
      const step = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      const movables = store.selectedLayers.filter((l) => !l.locked)
      if (movables.length === 0) return
      e.preventDefault()
      store.beginLayerGesture()
      for (const layer of movables) {
        store.moveLayerLive(layer.id, layer.x + dx, layer.y + dy)
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

  return { isTyping }
}
