// Tests composants primitifs : StaticHtml, RichText (Tiptap), Aesthetics, DraggableImage.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StaticHtml from '../text/StaticHtml.vue'
import RichText from '../text/RichText.vue'
import Aesthetics from '../engine/Aesthetics.vue'
import DraggableImage from '../engine/DraggableImage.vue'
import TextLayerView from '../layers/TextLayerView.vue'
import { htmlToTiptapDoc } from '../text/tiptap'
import { createPinia, setActivePinia } from 'pinia'
import { useSlideDeckStore } from '../store/deck'

describe('StaticHtml', () => {
  it('rend le HTML du doc avec les classes passées', () => {
    const w = mount(StaticHtml, {
      props: {
        doc: htmlToTiptapDoc('<strong>Salut</strong>'),
        contentClass: 'pd font-black',
      },
    })
    expect(w.html()).toContain('<strong>Salut</strong>')
    expect(w.classes()).toContain('pd')
  })

  it('rend vide sans throw sur doc null', () => {
    const w = mount(StaticHtml, { props: { doc: null } })
    expect(w.text()).toBe('')
  })
})

describe('RichText', () => {
  // Tiptap v3 monte la vue ProseMirror de façon asynchrone (rAF) : on attend
  // un frame avant toute assertion DOM.
  async function mountEditor(props: Record<string, unknown>) {
    const w = mount(RichText, { props: props as never })
    await new Promise((res) => requestAnimationFrame(() => res(null)))
    await w.vm.$nextTick()
    return w
  }

  it('monte un éditeur Tiptap avec le contenu du doc', async () => {
    const w = await mountEditor({ doc: htmlToTiptapDoc('Bonjour <strong>le monde</strong>'), label: 'TITRE' })
    expect(w.find('.tiptap').exists()).toBe(true)
    expect(w.find('.tiptap').text()).toContain('Bonjour')
    expect(w.find('.slide-edit-sticker').text()).toContain('TITRE')
    w.unmount()
  })

  it('émet update:doc quand le contenu change (transaction)', async () => {
    const w = await mountEditor({ doc: htmlToTiptapDoc('Hello') })
    const vm = w.vm as unknown as { editor: { commands: { setContent: (d: unknown) => void } } }
    vm.editor.commands.setContent(htmlToTiptapDoc('Modifié'))
    await w.vm.$nextTick()
    const emitted = w.emitted('update:doc')
    expect(emitted).toBeTruthy()
    expect(JSON.stringify(emitted![0][0])).toContain('Modifié')
    w.unmount()
  })

  it('mode non éditable : pas de contenteditable', async () => {
    const w = await mountEditor({ doc: htmlToTiptapDoc('X'), editable: false })
    expect(w.find('.tiptap[contenteditable="false"]').exists()).toBe(true)
    w.unmount()
  })
})

describe('TextLayerView', () => {
  async function flushEditor() {
    await new Promise((r) => requestAnimationFrame(() => r(null)))
  }

  it('applique la typo libre de la couche (taille, famille, graisse)', async () => {
    setActivePinia(createPinia())
    const store = useSlideDeckStore()
    store.ensureInit()
    const layer = store.addTextLayer('Hello')!
    store.updateLayerData(layer.id, {
      fontSize: 48,
      fontFamily: "'Anton', sans-serif",
      fontWeight: 900,
      lineHeight: 1.1,
      letterSpacing: 0.05,
      align: 'center',
      color: '#DC2626',
    })
    const w = mount(TextLayerView, { props: { layer } })
    await flushEditor()
    const content = w.find('.slide-editor-content')
    const style = content.attributes('style') ?? ''
    expect(style).toContain('font-size: 48px')
    expect(style).toContain('font-weight: 900')
    expect(style).toContain('text-align: center')
    expect(w.text()).toContain('Hello')
    w.unmount()
  })

  it('défaut 32px sans typo explicite', async () => {
    setActivePinia(createPinia())
    const store = useSlideDeckStore()
    store.ensureInit()
    const layer = store.addTextLayer('Hi')!
    const w = mount(TextLayerView, { props: { layer } })
    await flushEditor()
    expect(w.find('.slide-editor-content').attributes('style')).toContain('font-size: 32px')
    w.unmount()
  })

  it('clic sélectionne la couche', async () => {
    setActivePinia(createPinia())
    const store = useSlideDeckStore()
    store.ensureInit()
    const layer = store.addTextLayer('Hi')!
    const w = mount(TextLayerView, { props: { layer } })
    await flushEditor()
    await w.trigger('pointerdown')
    expect(w.emitted('select')![0]).toEqual([layer.id])
    w.unmount()
  })
})

describe('Aesthetics', () => {
  it('rend noise par défaut, halftone sur demande, avec opacité', () => {
    const noise = mount(Aesthetics)
    expect(noise.find('.noise-overlay').exists()).toBe(true)
    const half = mount(Aesthetics, { props: { kind: 'halftone', opacity: 0.2, zIndex: 5 } })
    const el = half.find('.halftone-overlay')
    expect(el.exists()).toBe(true)
    expect(el.attributes('style')).toContain('opacity: 0.2')
  })
})

function pointerDown(el: Element, init: MouseEventInit = {}) {
  // test-utils `trigger` ne peut pas poser `button` (getter seul sur
  // MouseEvent) : on dispatche un événement natif, jsdom route par type.
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, ...init }))
}

describe('DraggableImage', () => {
  it('ne rend rien d’utile sans src mais ne crash pas', () => {
    const w = mount(DraggableImage, { props: { src: '' } })
    expect(w.find('img').attributes('src')).toBe('')
  })

  it('proxifie la src externe et applique zoom/grisaille', () => {
    const w = mount(DraggableImage, {
      props: { src: 'https://example.com/a.png', zoom: 1.5, grayscale: 50 },
    })
    expect(w.find('img').attributes('src')).toContain('/api/media/proxy?url=')
    expect(w.find('img').attributes('style')).toContain('grayscale(0.5)')
  })

  it('drag complet : dragstart → dragmove coalescé → dragend final', async () => {
    const w = mount(DraggableImage, {
      props: { src: 'https://example.com/a.png', posX: 10, posY: 20 },
      attachTo: document.body,
    })
    const frame = w.find('.slide-draggable')
    pointerDown(frame.element, { clientX: 100, clientY: 100 })
    expect(w.emitted('dragstart')).toHaveLength(1)
    // Flood : 3 moves → 1 seul dragmove (dernier pendant) après la frame.
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 110, clientY: 120 }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 120, clientY: 140 }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 130, clientY: 160 }))
    expect(w.emitted('dragmove')).toBeUndefined()
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    expect(w.emitted('dragmove')).toHaveLength(1)
    expect(w.emitted('dragmove')![0][0]).toEqual({ x: 40, y: 80 })
    window.dispatchEvent(new MouseEvent('pointerup'))
    expect(w.emitted('dragend')![0][0]).toEqual({ x: 40, y: 80 })
    w.unmount()
  })

  it('clic droit ne démarre pas de drag', async () => {
    const w = mount(DraggableImage, { props: { src: 'https://example.com/a.png' } })
    pointerDown(w.find('.slide-draggable').element, { button: 2 })
    expect(w.emitted('dragstart')).toBeUndefined()
  })

  it('draggable=false : pas de drag', async () => {
    const w = mount(DraggableImage, {
      props: { src: 'https://example.com/a.png', draggable: false },
    })
    pointerDown(w.find('.slide-draggable').element)
    expect(w.emitted('dragstart')).toBeUndefined()
  })
})
