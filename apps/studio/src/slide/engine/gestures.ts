// Regroupement des contrôles continus (sliders, color pickers, champs URL)
// en UN seul niveau d'undo par geste : begin au premier contact, live
// pendant, end à la validation. Sans ça, chaque tick de slider clonait le
// deck entier (structuredClone) — mémoire + GC en chute libre pendant le drag.
import { useSlideDeckStore } from '../store/deck'
import type { Layer } from '../types'

export type LayerLivePatch = Partial<Omit<Layer, 'id' | 'data' | 'kind' | 'name' | 'behind' | 'visible' | 'locked' | 'z'>>

export function useGestureInput() {
  const store = useSlideDeckStore()
  let gesturing = false

  /** Premier contact (pointerdown / focus) : snapshot pour le undo. */
  function onBegin() {
    if (gesturing) return
    gesturing = true
    store.beginGesture()
  }

  /** Fin de geste (change / blur / pointerup) : le prochain contact rouvre. */
  function onEnd() {
    gesturing = false
  }

  function isGesturing(): boolean {
    return gesturing
  }

  /** Patch template groupé (auto-begin si le contact a été oublié). */
  function liveTemplate(patch: Record<string, unknown>) {
    if (!gesturing) onBegin()
    store.patchTemplateStateLive(patch)
  }

  /** Patch couche groupé (auto-begin si oublié). */
  function liveLayer(id: string, patch: LayerLivePatch) {
    if (!gesturing) onBegin()
    store.updateLayerLive(id, patch)
  }

  return { onBegin, onEnd, isGesturing, liveTemplate, liveLayer }
}

/**
 * Coalesce les émissions pointermove sur rAF (1/frame max) : les floods
 * tactiles n'atteignent plus le store, le rendu suit le rafraîchissement.
 * `flush()` rejoue le dernier pendant de façon synchrone (pointerup).
 */
export function createRafEmitter<T>(emit: (value: T) => void) {
  let raf = 0
  let latest: T | null = null
  let pending = false

  function push(value: T) {
    latest = value
    pending = true
    if (raf !== 0) return
    raf = requestAnimationFrame(() => {
      raf = 0
      if (!pending) return
      pending = false
      emit(latest as T)
    })
  }

  function flush() {
    if (raf !== 0) {
      cancelAnimationFrame(raf)
      raf = 0
    }
    if (pending) {
      pending = false
      emit(latest as T)
    }
  }

  function cancel() {
    if (raf !== 0) cancelAnimationFrame(raf)
    raf = 0
    pending = false
  }

  return { push, flush, cancel }
}
