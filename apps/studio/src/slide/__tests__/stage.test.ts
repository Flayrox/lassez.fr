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

  it('reflète le format de la slide (dimensions exactes)', async () => {
    const store = setup()
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
})
