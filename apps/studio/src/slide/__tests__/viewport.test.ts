// Tests Viewport : fit, zoom molette/ctrl, pan, curseurs, expose.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Viewport from '../engine/Viewport.vue'

async function flush() {
  await new Promise((res) => requestAnimationFrame(() => res(null)))
}

function wheel(el: Element, init: WheelEventInit) {
  // test-utils `trigger` ne peut pas poser ctrlKey/delta (getters seuls) :
  // événement natif, jsdom route par type.
  const Ctor = typeof WheelEvent !== 'undefined' ? WheelEvent : Event
  el.dispatchEvent(new Ctor('wheel', { bubbles: true, cancelable: true, ...init }) as Event)
}

function viewport(props = { stageW: 1080, stageH: 1350 }) {
  return mount(Viewport, {
    props,
    slots: { default: '<div class="slide-stage" style="width:1080px;height:1350px"></div>' },
    attachTo: document.body,
  })
}

describe('Viewport', () => {
  it('fit initial : échelle 1 et centrage négatif en jsdom (boîte 0×0)', async () => {
    const w = viewport()
    await flush()
    const vm = w.vm as unknown as { scale: number; tx: number; ty: number }
    // jsdom : getBoundingClientRect = 0 → fitScale invalide → clamp(1)
    expect(vm.scale).toBe(1)
    expect(vm.tx).toBe((0 - 1080) / 2)
    w.unmount()
  })

  it('molette simple = pan (translate)', async () => {
    const w = viewport()
    await flush()
    const vm = w.vm as unknown as { tx: number; ty: number }
    const tx0 = vm.tx
    wheel(w.element, { deltaX: 10, deltaY: 20 })
    expect(vm.tx).toBe(tx0 - 10)
    expect(vm.ty).toBe((0 - 1350) / 2 - 20)
    w.unmount()
  })

  it('ctrl+molette = zoom centré curseur + événement zoom', async () => {
    const w = viewport()
    await flush()
    const vm = w.vm as unknown as { scale: number }
    wheel(w.element, { deltaY: -100, ctrlKey: true, clientX: 50, clientY: 60 })
    expect(vm.scale).toBeGreaterThan(1)
    expect(w.emitted('zoom')).toBeTruthy()
    w.unmount()
  })

  it('zoomStep + setZoom bornent via clamp', async () => {
    const w = viewport()
    await flush()
    const vm = w.vm as unknown as {
      scale: number
      zoomStep: (d: 1 | -1) => void
      setZoom: (s: number) => void
    }
    vm.setZoom(999)
    expect(vm.scale).toBeLessThanOrEqual(8)
    vm.setZoom(0.0001)
    expect(vm.scale).toBeGreaterThanOrEqual(0.05)
    const before = vm.scale
    vm.zoomStep(1)
    expect(vm.scale).toBeGreaterThan(before)
    w.unmount()
  })

  it('double-clic refit', async () => {
    const w = viewport()
    await flush()
    const vm = w.vm as unknown as { scale: number; setZoom: (s: number) => void }
    vm.setZoom(3)
    expect(vm.scale).toBe(3)
    await w.trigger('dblclick')
    expect(vm.scale).toBe(1) // refit jsdom → 1
    w.unmount()
  })

  it('double-clic sur le contenu ne refit pas (sélection de mot)', async () => {
    const w = mount(Viewport, {
      props: { stageW: 1080, stageH: 1350 },
      slots: { default: '<div class="slide-stage" style="width:1080px;height:1350px"><p>texte</p></div>' },
      attachTo: document.body,
    })
    await flush()
    const vm = w.vm as unknown as { scale: number; setZoom: (s: number) => void }
    vm.setZoom(2.5)
    await w.find('.slide-stage p').trigger('dblclick')
    expect(vm.scale).toBe(2.5)
    w.unmount()
  })

  it('changement de format refit', async () => {
    const w = viewport()
    await flush()
    await w.setProps({ stageW: 1920, stageH: 1080 })
    const vm = w.vm as unknown as { tx: number }
    expect(vm.tx).toBe((0 - 1920) / 2)
    w.unmount()
  })
})
