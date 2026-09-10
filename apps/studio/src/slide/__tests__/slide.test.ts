// Tests d'intégration Slide.vue : layout complet, génération, import,
// exports, autosave, entrée pipeline.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import Slide from '../../views/Slide.vue'
import { useSlideDeckStore } from '../store/deck'

vi.mock('html-to-image', () => ({
  toPng: vi.fn(async () => 'data:image/png;base64,ZmFrZQ=='),
}))

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

async function flush(ms = 60) {
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  await new Promise((r) => setTimeout(r, ms))
}

function router(query: Record<string, string> = {}) {
  const r = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/slide', component: { template: '<div />' } }],
  })
  r.push({ path: '/slide', query })
  return r
}

async function setup(query: Record<string, string> = {}) {
  setActivePinia(createPinia())
  localStorage.clear()
  const r = router(query)
  await r.isReady()
  const w = mount(Slide, {
    global: { plugins: [createPinia(), r] },
    attachTo: document.body,
  })
  await flush(150)
  return w
}

beforeEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  vi.clearAllMocks()
})

describe('Slide.vue', () => {
  it('rend le layout complet : toolbar, deck, stage, onglets', async () => {
    const w = await setup()
    expect(w.text()).toContain('Studio')
    expect(w.text()).toContain('Deck — 1')
    expect(w.text()).toContain('Propriétés')
    expect(w.text()).toContain('Calques (0)')
    expect(w.find('.slide-stage').exists()).toBe(true)
    expect(w.text()).toContain('1080 × 1350 px')
    w.unmount()
  })

  it('ajout de slide via le catalogue du deck', async () => {
    const w = await setup()
    await w.find('.add-btn').trigger('click')
    await w.findAll('.add-item')[0].trigger('click')
    expect(w.text()).toContain('Deck — 2')
    w.unmount()
  })

  it('onglet Calques : ajout texte puis insertion asset via modale', async () => {
    const w = await setup()
    const tabs = w.findAll('.right-tab')
    await tabs[1].trigger('click')
    expect(w.text()).toContain('Aucune couche libre')
    await w.find('button[title="Ajouter un texte"]').trigger('click')
    expect(w.text()).toContain('Calques (1)')
    w.unmount()
  })

  it('export PNG : capture + toast succès', async () => {
    const { toast } = await import('vue-sonner')
    const { toPng } = await import('html-to-image')
    const w = await setup()
    await w.find('.tb-export').trigger('click')
    await flush(400)
    expect(toPng).toHaveBeenCalled()
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(expect.stringMatching(/Exporté/))
    w.unmount()
  })

  it('import JSON via la modale remplace le deck', async () => {
    const w = await setup()
    await w.findAll('.tb-ghost').find((b) => b.text() === 'Importer JSON')!.trigger('click')
    const modal = w.findComponent({ name: 'SlideModals' })
    expect(modal.props('showJson')).toBe(true)
    await w.find('.slide-root textarea').setValue(
      JSON.stringify({ deck: [{ type: 'COVER', label: 'S1', state: {} }] }),
    )
    await w.find('.modal-cta').trigger('click')
    await flush()
    expect(w.text()).toContain('Deck — 1')
    const store = useSlideDeckStore()
    expect(store.slides[0].type).toBe('COVER')
    w.unmount()
  })

  it('génération article : squelette multi-slides', async () => {
    const w = await setup()
    await w.find('.tb-primary').trigger('click') // "Générer avec l'IA"
    await w.find('.slide-root textarea').setValue('Titre choc\n\nParagraphe un\n\nParagraphe deux')
    await w.find('.modal-cta').trigger('click')
    await flush()
    const store = useSlideDeckStore()
    expect(store.slides.length).toBeGreaterThan(1)
    expect(JSON.stringify(store.slides[0].templateState)).toContain('Titre choc')
    w.unmount()
  })

  it('entrée pipeline ?title=&body= pré-remplit', async () => {
    const w = await setup({ title: 'Flash spécial', body: 'Corps du flash' })
    const store = useSlideDeckStore()
    expect(store.articleInput).toContain('Flash spécial')
    expect(store.slides[0].templateState.headline).toBe('Flash spécial')
    w.unmount()
  })

  it('reset slide avec confirm = true', async () => {
    vi.stubGlobal('confirm', () => true)
    const w = await setup()
    const resetBtn = w.findAll('.tb-ghost').find((b) => b.text() === 'Reset slide')!
    await resetBtn.trigger('click')
    const store = useSlideDeckStore()
    expect(store.slides[0].templateState.headline).toContain('DÉCRYPTAGE')
    vi.unstubAllGlobals()
    w.unmount()
  })

  it('autosave : le deck est persisté en localStorage', async () => {
    const w = await setup()
    await w.find('.add-btn').trigger('click')
    await w.findAll('.add-item')[0].trigger('click')
    await new Promise((r) => setTimeout(r, 800))
    const raw = localStorage.getItem('lassez_slide_deck_v2')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).slides).toHaveLength(2)
    w.unmount()
  })

  it('undo/redo via toolbar', async () => {
    const w = await setup()
    await w.find('.add-btn').trigger('click')
    await w.findAll('.add-item')[0].trigger('click')
    expect(w.text()).toContain('Deck — 2')
    await w.find('button[title="Annuler (Ctrl+Z)"]').trigger('click')
    expect(w.text()).toContain('Deck — 1')
    await w.find('button[title="Rétablir (Ctrl+Y)"]').trigger('click')
    expect(w.text()).toContain('Deck — 2')
    w.unmount()
  })
})
