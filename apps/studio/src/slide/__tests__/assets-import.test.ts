// Tests assets : fitDims, prepareImageFile (repli sans canvas),
// routage des imports via le store injecté.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import {
  ASSETS_KEY,
  MAX_IMPORT_DIM,
  createMemoryAssetStore,
  fitDims,
  prepareImageFile,
  type AssetStore,
} from '../assets'
import SchemaField from '../panels/SchemaField.vue'
import LayersPanel from '../layers/LayersPanel.vue'
import { useSlideDeckStore } from '../store/deck'

async function flush() {
  await new Promise((r) => requestAnimationFrame(() => r(null)))
}

afterEach(() => vi.unstubAllGlobals())

function setFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true })
}

describe('fitDims', () => {
  it('laisse passer sous le plafond', () => {
    expect(fitDims(1080, 1350)).toEqual({ w: 1080, h: 1350 })
    expect(fitDims(MAX_IMPORT_DIM, MAX_IMPORT_DIM)).toEqual({ w: MAX_IMPORT_DIM, h: MAX_IMPORT_DIM })
  })

  it('réduit en gardant le ratio (paysage + portrait)', () => {
    expect(fitDims(4000, 3000)).toEqual({ w: 2048, h: 1536 })
    expect(fitDims(3000, 4000)).toEqual({ w: 1536, h: 2048 })
  })

  it('gère les dimensions invalides sans throw', () => {
    expect(fitDims(0, 100)).toEqual({ w: 0, h: 0 })
    expect(fitDims(NaN, 100)).toEqual({ w: 0, h: 0 })
    expect(fitDims(-5, 100)).toEqual({ w: 0, h: 0 })
  })

  it('plafond custom', () => {
    expect(fitDims(1000, 500, 500)).toEqual({ w: 500, h: 250 })
  })
})

describe('prepareImageFile', () => {
  it('repli : retourne l’original quand canvas 2d indisponible (jsdom)', async () => {
    const file = new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' })
    const out = await prepareImageFile(file)
    expect(out.blob).toBe(file)
    expect(out.width).toBeUndefined()
  })

  it('ne throw jamais sur blob vide', async () => {
    const out = await prepareImageFile(new File([], 'vide.png', { type: 'image/png' }))
    expect(out.blob).toBeTruthy()
  })
})

describe('imports via asset store injecté', () => {
  function mockStore(url = 'https://assets/biblio.png'): AssetStore {
    return {
      list: async () => [],
      add: async () => ({
        id: 'a1', name: 'biblio.png', url, createdAt: Date.now(),
      }),
      addUrl: async (u: string) => ({ id: 'u1', name: u, url: u, createdAt: Date.now() }),
      remove: async () => {},
      clear: async () => {},
    }
  }

  it('SchemaField image : le fichier part dans la bibliothèque, patch avec son URL', async () => {
    setActivePinia(createPinia())
    const store = mockStore()
    const w = mount(SchemaField, {
      props: { field: { key: 'imageUrl', label: 'Image', type: 'image', group: 'Média' }, value: '' },
      global: { provide: { [ASSETS_KEY]: ref(store) } },
    })
    const input = w.find('input[type="file"]')
    setFiles(input.element as HTMLInputElement, [new File(['x'], 'up.png', { type: 'image/png' })])
    await input.trigger('change')
    await flush()
    expect(w.emitted('patch')).toBeTruthy()
    expect(w.emitted('patch')![0]).toEqual(['https://assets/biblio.png'])
    w.unmount()
  })

  it('SchemaField image : repli objectURL sans provider', async () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:fake-123' })
    setActivePinia(createPinia())
    const w = mount(SchemaField, {
      props: { field: { key: 'imageUrl', label: 'Image', type: 'image', group: 'Média' }, value: '' },
    })
    const input = w.find('input[type="file"]')
    setFiles(input.element as HTMLInputElement, [new File(['x'], 'up.png', { type: 'image/png' })])
    await input.trigger('change')
    await flush()
    expect(w.emitted('patch')![0]).toEqual(['blob:fake-123'])
    w.unmount()
  })

  it('LayersPanel : import fichier → calque image avec URL persistée', async () => {
    setActivePinia(createPinia())
    const deck = useSlideDeckStore()
    deck.ensureInit()
    const store = mockStore('https://assets/fond.png')
    const w = mount(LayersPanel, {
      global: { provide: { [ASSETS_KEY]: ref(store) } },
    })
    const input = w.find('input[type="file"]')
    setFiles(input.element as HTMLInputElement, [new File(['x'], 'fond.png', { type: 'image/png' })])
    await input.trigger('change')
    await flush()
    const layers = deck.activeSlide!.layers
    expect(layers).toHaveLength(1)
    expect((layers[0].data as { src: string }).src).toBe('https://assets/fond.png')
    w.unmount()
  })

  it('memory store add prépare sans throw (repli jsdom)', async () => {
    const store = createMemoryAssetStore()
    const a = await store.add(new File(['x'.repeat(100)], 'gros.jpg', { type: 'image/jpeg' }), 'gros.jpg')
    expect(a.url.length).toBeGreaterThan(0)
    expect(a.name).toBe('gros.jpg')
  })
})
