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
      store.selectLayer(null)
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
      if (store.selectedLayerId) store.duplicateLayer(store.selectedLayerId)
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (store.selectedLayerId) {
        e.preventDefault()
        store.removeLayer(store.selectedLayerId)
      } else {
        handlers.onDeleteSlide?.()
      }
      return
    }
    if (e.key.startsWith('Arrow') && store.selectedLayerId) {
      const layer = store.getActiveLayer()
      if (!layer || layer.locked) return
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      store.beginLayerGesture()
      store.moveLayerLive(store.selectedLayerId, layer.x + dx, layer.y + dy)
    }
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

  return { isTyping }
}
