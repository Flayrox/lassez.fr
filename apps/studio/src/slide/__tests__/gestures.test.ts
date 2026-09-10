// Tests useGestureInput : 1 geste = 1 undo, auto-begin, sessions isolées.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createRafEmitter, useGestureInput } from '../engine/gestures'
import { useSlideDeckStore } from '../store/deck'

beforeEach(() => setActivePinia(createPinia()))

describe('createRafEmitter', () => {
  async function frame() {
    await new Promise((r) => requestAnimationFrame(() => r(null)))
  }

  it('coalesce N push en 1 émission (dernier pendant)', async () => {
    const seen: number[] = []
    const out = createRafEmitter((v: number) => void seen.push(v))
    out.push(1)
    out.push(2)
    out.push(3)
    expect(seen).toEqual([])
    await frame()
    expect(seen).toEqual([3])
  })

  it('flush rejoue le pendant de façon synchrone', () => {
    const seen: number[] = []
    const out = createRafEmitter((v: number) => void seen.push(v))
    out.push(7)
    out.flush()
    expect(seen).toEqual([7])
  })

  it('cancel jette le pendant sans émettre', async () => {
    const seen: number[] = []
    const out = createRafEmitter((v: number) => void seen.push(v))
    out.push(9)
    out.cancel()
    await frame()
    expect(seen).toEqual([])
  })

  it('flush/cancel sans pendant = no-op', async () => {
    const fn = vi.fn()
    const out = createRafEmitter(fn)
    out.flush()
    out.cancel()
    await frame()
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('useGestureInput', () => {
  it('un drag complet de slider = 1 seul niveau d’undo', () => {
    const store = useSlideDeckStore()
    store.ensureInit()
    const g = useGestureInput()
    const before = String(store.activeSlide!.templateState.accent)
    g.onBegin()
    for (const c of ['#111111', '#222222', '#333333', '#444444']) {
      g.liveTemplate({ accent: c })
    }
    g.onEnd()
    expect(store.activeSlide!.templateState.accent).toBe('#444444')
    store.undo()
    expect(store.activeSlide!.templateState.accent).toBe(before)
    expect(store.canRedo).toBe(true)
  })

  it('auto-begin si live appelé sans begin', () => {
    const store = useSlideDeckStore()
    store.ensureInit()
    const g = useGestureInput()
    expect(g.isGesturing()).toBe(false)
    g.liveTemplate({ accent: '#123456' })
    expect(g.isGesturing()).toBe(true)
    g.onEnd()
    store.undo()
    expect(String(store.activeSlide!.templateState.accent)).not.toBe('#123456')
  })

  it('deux gestes séparés = 2 undos', () => {
    const store = useSlideDeckStore()
    store.ensureInit()
    const g = useGestureInput()
    g.onBegin()
    g.liveTemplate({ accent: '#aaaaaa' })
    g.onEnd()
    g.onBegin()
    g.liveTemplate({ accent: '#bbbbbb' })
    g.onEnd()
    store.undo()
    expect(store.activeSlide!.templateState.accent).toBe('#aaaaaa')
    store.undo()
    expect(store.activeSlide!.templateState.accent).toBe('#DC2626')
  })

  it('liveLayer groupe les patchs couche de la même façon', () => {
    const store = useSlideDeckStore()
    store.ensureInit()
    const l = store.addTextLayer('x')!
    const g = useGestureInput()
    g.onBegin()
    g.liveLayer(l.id, { x: 100 })
    g.liveLayer(l.id, { x: 200, y: 50 })
    g.onEnd()
    expect(l.x).toBe(200)
    store.undo()
    const after = store.activeSlide!.layers.find((x) => x.id === l.id)!
    expect(after.x).toBe(60)
  })

  it('onBegin répété sans end ne re-snapshot pas', () => {
    const store = useSlideDeckStore()
    store.ensureInit()
    const g = useGestureInput()
    g.onBegin()
    g.liveTemplate({ accent: '#aaaaaa' })
    g.onBegin() // no-op
    g.liveTemplate({ accent: '#bbbbbb' })
    g.onEnd()
    store.undo()
    expect(store.activeSlide!.templateState.accent).toBe('#DC2626')
  })
})
