// Tests SlideStage : ordre z (derrière/devant template), sélection, guides.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SlideStage from '../layers/SlideStage.vue'
import { useSlideDeckStore } from '../store/deck'

async function flush() {
  await new Promise((res) => requestAnimationFrame(() => res(null)))
}

function setup() {
  setActivePinia(createPinia())
  const store = useSlideDeckStore()
  store.ensureInit()
  return store
}

describe('SlideStage', () => {
  it('rend le template de la slide active', async () => {
    const store = setup()
    const w = mount(SlideStage, { props: { slide: store.activeSlide! } })
    await flush()
    expect(w.text()).toContain('DÉCRYPTAGE')
    w.unmount()
  })

  it('ordonne : plan derrière avant le template, plan devant après', async () => {
    const store = setup()
    const behindLayer = store.addTextLayer('DERRIERE')!
    store.addTextLayer('DEVANT')!
    store.sendLayerToBack(behindLayer.id) // plan derrière
    expect(behindLayer.behind).toBe(true)
    const slide = store.activeSlide!
    const w = mount(SlideStage, { props: { slide } })
    await flush()
    const html = w.html()
    const iBehind = html.indexOf('DERRIERE')
    const iFront = html.indexOf('DEVANT')
    const iTpl = html.indexOf('DÉCRYPTAGE')
    expect(iBehind).toBeGreaterThan(-1)
    expect(iFront).toBeGreaterThan(-1)
    expect(iBehind).toBeLessThan(iTpl)
    expect(iFront).toBeGreaterThan(iTpl)
    w.unmount()
  })

  it('masque les couches invisibles', async () => {
    const store = setup()
    const l = store.addTextLayer('CACHEE')!
    store.toggleLayerVisibility(l.id)
    const w = mount(SlideStage, { props: { slide: store.activeSlide! } })
    await flush()
    expect(w.text()).not.toContain('CACHEE')
    w.unmount()
  })

  it('affiche la SelectionBox sur la couche sélectionnée', async () => {
    const store = setup()
    const l = store.addTextLayer('SEL')!
    store.selectLayer(l.id)
    const w = mount(SlideStage, { props: { slide: store.activeSlide! } })
    await flush()
    expect(w.find('.slide-selection').exists()).toBe(true)
    w.unmount()
  })

  it('pas de SelectionBox pour une couche verrouillée', async () => {
    const store = setup()
    const l = store.addTextLayer('LOCK')!
    store.toggleLayerLock(l.id)
    store.selectLayer(l.id)
    const w = mount(SlideStage, { props: { slide: store.activeSlide! } })
    await flush()
    expect(w.find('.slide-selection').exists()).toBe(false)
    w.unmount()
  })

  it('clic sur le vide désélectionne', async () => {
    const store = setup()
    const l = store.addTextLayer('X')!
    store.selectLayer(l.id)
    const w = mount(SlideStage, { props: { slide: store.activeSlide! } })
    await flush()
    await w.trigger('pointerdown')
    expect(store.selectedLayerId).toBeNull()
    w.unmount()
  })

  it('guides magnétiques : déplacement au centre affiche les lignes', async () => {
    const store = setup()
    const l = store.addTextLayer('X')! // 480×160 → centre x=300
    store.selectLayer(l.id)
    const w = mount(SlideStage, { props: { slide: store.activeSlide! } })
    await flush()
    expect(w.find('.slide-selection').exists()).toBe(true)
    // Drag via la bande haute : de x=100 vers x=340 → dx=240 → couche à x=300 (centre)
    const strip = w.find('.sel-top')
    strip.element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 340, clientY: 100 }))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await w.vm.$nextTick()
    expect(l.x).toBe(300)
    const guides = w.findAll('.z-\\[200\\]')
    expect(guides.length).toBeGreaterThan(0)
    window.dispatchEvent(new MouseEvent('pointerup'))
    await w.vm.$nextTick()
    // Fin de geste : guides effacés
    expect(w.findAll('.z-\\[200\\]')).toHaveLength(0)
    w.unmount()
  })

  it('reflète le format de la slide (dimensions exactes)', async () => {    const store = setup()
    store.setSlideFormat(store.activeSlide!.id, '1:1')
    const w = mount(SlideStage, { props: { slide: store.activeSlide! } })
    await flush()
    const style = (w.element as HTMLElement).style
    expect(style.width).toBe('1080px')
    expect(style.height).toBe('1080px')
    w.unmount()
  })

  it('repli template inconnu vers INFO sans crash', async () => {
    const store = setup()
    const slide = { ...store.activeSlide!, type: 'VIDEO_NOTE' as never }
    const w = mount(SlideStage, { props: { slide } })
    await flush()
    expect(w.text().length).toBeGreaterThan(0)
    w.unmount()
  })

  it('shift-clic bascule la multi-sélection (plusieurs cadres)', async () => {
    const store = setup()
    store.addTextLayer('A')
    store.addTextLayer('B')
    const slide = store.activeSlide!
    const w = mount(SlideStage, { props: { slide } })
    await flush()
    const boxes = () => w.findAllComponents({ name: 'TextLayerView' })
    expect(boxes()).toHaveLength(2)
    // Clic simple sur A
    boxes()[0].trigger('pointerdown')
    await w.vm.$nextTick()
    expect(store.selectedLayerIds).toHaveLength(1)
    // Shift-clic sur B → les deux
    boxes()[1].element.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, button: 0, shiftKey: true }),
    )
    await w.vm.$nextTick()
    expect(store.selectedLayerIds).toHaveLength(2)
    expect(w.findAll('.slide-selection')).toHaveLength(2)
    // Re shift-clic sur A → retire A
    boxes()[0].element.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, button: 0, shiftKey: true }),
    )
    await w.vm.$nextTick()
    expect(store.selectedLayerIds).toHaveLength(1)
    w.unmount()
  })

  it('drag groupé : les sélectionnées suivent du même delta', async () => {
    const store = setup()
    const a = store.addTextLayer('A')!
    const b = store.addTextLayer('B')!
    store.selectLayer(a.id)
    store.toggleLayerSelection(b.id)
    const slide = store.activeSlide!
    const w = mount(SlideStage, { props: { slide } })
    await flush()
    const ax0 = a.x
    const bx0 = b.x
    // Drag via la bande de A : +40px
    const strip = w.findAll('.sel-top')[0]
    strip.element.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }),
    )
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 140, clientY: 100 }))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await w.vm.$nextTick()
    expect(a.x).toBe(ax0 + 40)
    expect(b.x).toBe(bx0 + 40)
    window.dispatchEvent(new MouseEvent('pointerup'))
    // 1 seul undo pour tout le geste groupé
    store.undo()
    const after = new Map(store.activeSlide!.layers.map((l) => [l.id, l.x]))
    expect(after.get(a.id)).toBe(ax0)
    expect(after.get(b.id)).toBe(bx0)
    w.unmount()
  })
})
