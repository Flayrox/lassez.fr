// Tests raccourcis clavier : suppression, undo/redo, duplicate, Échap, flèches, garde frappe.
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { useSlideShortcuts } from '../engine/shortcuts'
import { useSlideDeckStore } from '../store/deck'

function setup() {
  setActivePinia(createPinia())
  const store = useSlideDeckStore()
  store.ensureInit()
  const Host = defineComponent({
    setup() {
      useSlideShortcuts()
      return () => h('div')
    },
  })
  const w = mount(Host)
  return { store, w }
}

function key(init: KeyboardEventInit & { key: string }) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('useSlideShortcuts', () => {
  it('Suppr supprime la couche sélectionnée', () => {
    const { store, w } = setup()
    const l = store.addTextLayer('A')!
    store.selectLayer(l.id)
    key({ key: 'Delete' })
    expect(store.activeSlide!.layers).toHaveLength(0)
    w.unmount()
  })

  it('Ctrl+Z / Ctrl+Y annulent et rétablissent', () => {
    const { store, w } = setup()
    store.addSlide('COVER')
    expect(store.slides).toHaveLength(2)
    key({ key: 'z', ctrlKey: true })
    expect(store.slides).toHaveLength(1)
    key({ key: 'y', ctrlKey: true })
    expect(store.slides).toHaveLength(2)
    w.unmount()
  })

  it('Ctrl+D duplique la couche sélectionnée', () => {
    const { store, w } = setup()
    const l = store.addTextLayer('A')!
    store.selectLayer(l.id)
    key({ key: 'd', ctrlKey: true })
    expect(store.activeSlide!.layers).toHaveLength(2)
    w.unmount()
  })

  it('Échap désélectionne', () => {
    const { store, w } = setup()
    const l = store.addTextLayer('A')!
    store.selectLayer(l.id)
    key({ key: 'Escape' })
    expect(store.selectedLayerId).toBeNull()
    w.unmount()
  })

  it('flèches déplacent au pixel (×10 avec Shift)', () => {
    const { store, w } = setup()
    const l = store.addTextLayer('A')!
    store.selectLayer(l.id)
    const x0 = l.x
    const y0 = l.y
    key({ key: 'ArrowRight' })
    // moveLayerLive ne remplace pas l'objet → même référence observable
    const live = store.activeSlide!.layers[0]
    expect(live.x).toBe(x0 + 1)
    key({ key: 'ArrowDown', shiftKey: true })
    expect(store.activeSlide!.layers[0].y).toBe(y0 + 10)
    w.unmount()
  })

  it('flèches ignorées sur couche verrouillée', () => {
    const { store, w } = setup()
    const l = store.addTextLayer('A')!
    store.toggleLayerLock(l.id)
    store.selectLayer(l.id)
    const x0 = l.x
    key({ key: 'ArrowRight' })
    expect(store.activeSlide!.layers[0].x).toBe(x0)
    w.unmount()
  })

  it('aucune action pendant la frappe (input focus)', () => {
    const { store, w } = setup()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    store.addSlide('COVER')
    key({ key: 'z', ctrlKey: true })
    // Pas d'undo : toujours 2 slides
    expect(store.slides).toHaveLength(2)
    input.remove()
    w.unmount()
  })

  it('aucune action pendant l’édition Tiptap (contenteditable focus)', () => {
    const { store, w } = setup()
    const ed = document.createElement('div')
    ed.contentEditable = 'true'
    ed.className = 'tiptap'
    ed.tabIndex = -1 // rend le div focalisable sous jsdom
    document.body.appendChild(ed)
    ed.focus()
    const l = store.addTextLayer('A')!
    store.selectLayer(l.id)
    key({ key: 'Delete' })
    expect(store.activeSlide!.layers).toHaveLength(1)
    ed.remove()
    w.unmount()
  })

  it('Suppr + Ctrl+D + flèches agissent sur toute la sélection', () => {
    const { store, w } = setup()
    const a = store.addTextLayer('A')!
    const b = store.addTextLayer('B')!
    store.addTextLayer('C')!
    store.selectLayer(a.id)
    store.toggleLayerSelection(b.id)
    key({ key: 'd', ctrlKey: true })
    expect(store.activeSlide!.layers).toHaveLength(5)
    // Les 2 copies sont sélectionnées
    expect(store.selectedLayerIds).toHaveLength(2)
    key({ key: 'Delete' })
    expect(store.activeSlide!.layers).toHaveLength(3)
    w.unmount()
  })

  it('flèches déplacent tout le groupe en 1 undo', () => {
    const { store, w } = setup()
    const a = store.addTextLayer('A')!
    const b = store.addTextLayer('B')!
    const ax0 = a.x
    const bx0 = b.x
    store.selectLayer(a.id)
    store.toggleLayerSelection(b.id)
    key({ key: 'ArrowRight' })
    const live = new Map(store.activeSlide!.layers.map((l) => [l.id, l.x]))
    expect(live.get(a.id)).toBe(ax0 + 1)
    expect(live.get(b.id)).toBe(bx0 + 1)
    store.undo()
    const after = new Map(store.activeSlide!.layers.map((l) => [l.id, l.x]))
    expect(after.get(a.id)).toBe(ax0)
    expect(after.get(b.id)).toBe(bx0)
    w.unmount()
  })
})
