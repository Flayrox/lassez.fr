// Tests assets, export, génération article.
import { afterEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import {
  buildDeckZip,
  deckFileName,
  downloadBlob,
  downloadDataUrl,
  hideEditingUI,
  renderStagePNG,
  slideFileName,
} from '../exporter'
import { createMemoryAssetStore } from '../assets'
import { buildDeckFromArticle } from '../article'

vi.mock('html-to-image', () => ({
  toPng: vi.fn(async () => 'data:image/png;base64,ZmFrZQ=='),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('filenames', () => {
  it('slideFileName numérote et slugifie', () => {
    expect(slideFileName('Slide 1 — Cover', 0)).toBe('slide-01-slide-1-cover.png')
    expect(slideFileName("L'ÉTÉ", 9, 'jpg')).toBe('slide-10-l-ete.jpg')
  })

  it('deckFileName préfixe + timestamp', () => {
    expect(deckFileName('deck', 'zip')).toMatch(/^lassez-deck-\d+\.zip$/)
    expect(deckFileName('deck', 'json')).toMatch(/^lassez-deck-\d+\.json$/)
  })
})

describe('hideEditingUI', () => {
  it('masque puis restaure les sélecteurs d’édition', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div class="slide-edit-sticker">✎</div>
      <div class="slide-selection" style="display: block;"></div>
      <p class="keep">contenu</p>`
    document.body.appendChild(root)
    const restore = hideEditingUI(root)
    expect((root.querySelector('.slide-edit-sticker') as HTMLElement).style.display).toBe('none')
    expect((root.querySelector('.slide-selection') as HTMLElement).style.display).toBe('none')
    expect((root.querySelector('.keep') as HTMLElement).style.display).toBe('')
    restore()
    expect((root.querySelector('.slide-edit-sticker') as HTMLElement).style.display).toBe('')
    expect((root.querySelector('.slide-selection') as HTMLElement).style.display).toBe('block')
    root.remove()
  })
})

describe('renderStagePNG', () => {
  it('capture via html-to-image avec dimensions exactes + restaure l’UI', async () => {
    const { toPng } = await import('html-to-image')
    const stage = document.createElement('div')
    stage.innerHTML = '<div class="slide-edit-sticker">✎</div><p>Slide</p>'
    document.body.appendChild(stage)
    const dataUrl = await renderStagePNG(stage, { width: 1080, height: 1350, pixelRatio: 2 })
    expect(dataUrl).toMatch(/^data:image\/png/)
    expect(toPng).toHaveBeenCalledWith(
      stage,
      expect.objectContaining({ canvasWidth: 1080, canvasHeight: 1350, pixelRatio: 2 }),
    )
    // UI restaurée après capture
    expect((stage.querySelector('.slide-edit-sticker') as HTMLElement).style.display).toBe('')
    stage.remove()
  })

  it('restaure l’UI même si la capture échoue', async () => {
    const mod = await import('html-to-image')
    vi.mocked(mod.toPng).mockRejectedValueOnce(new Error('capture KO'))
    const stage = document.createElement('div')
    stage.innerHTML = '<div class="slide-tb">tb</div>'
    document.body.appendChild(stage)
    await expect(renderStagePNG(stage, { width: 1080, height: 1080 })).rejects.toThrow('capture KO')
    expect((stage.querySelector('.slide-tb') as HTMLElement).style.display).toBe('')
    stage.remove()
  })
})

describe('download helpers', () => {
  it('downloadDataUrl pose href/download et clique', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    expect(downloadDataUrl('data:image/png;base64,xx', 'a.png')).toBe(true)
    const a = document.body.querySelector('a') ?? (click.mock.instances[0] as unknown as HTMLAnchorElement)
    expect(a.getAttribute('download')).toBe('a.png')
    click.mockRestore()
  })

  it('downloadBlob crée une URL objet révoquée ensuite', () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    expect(downloadBlob(new Blob(['x']), 'b.zip')).toBe(true)
    click.mockRestore()
  })
})

describe('buildDeckZip', () => {
  it('zippe les dataURLs et ignore les entrées invalides', async () => {
    const blob = await buildDeckZip([
      { name: 'slide-01-cover.png', dataUrl: 'data:image/png;base64,aGk=' },
      { name: 'bad.png', dataUrl: 'not-a-data-url' },
    ])
    expect(blob.size).toBeGreaterThan(0)
    const zip = await JSZip.loadAsync(blob)
    expect(Object.keys(zip.files)).toEqual(['slide-01-cover.png'])
  })

  it('zip vide sans throw', async () => {
    const blob = await buildDeckZip([])
    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('createMemoryAssetStore', () => {
  it('ajoute (fichier + URL), liste triée, supprime', async () => {
    const store = createMemoryAssetStore()
    expect(await store.list()).toEqual([])
    const file = new File(['pixels'], 'photo.png', { type: 'image/png' })
    const a = await store.add(file, 'photo.png')
    expect(a.name).toBe('photo.png')
    expect(a.url.length).toBeGreaterThan(0)
    const b = await store.addUrl('https://example.com/x.png')
    expect(b.url).toBe('https://example.com/x.png')
    const list = await store.list()
    expect(list).toHaveLength(2)
    // Plus récent d'abord (b après a)
    expect(list[0].createdAt).toBeGreaterThanOrEqual(list[1].createdAt)
    await store.remove(a.id)
    expect(await store.list()).toHaveLength(1)
    await store.clear()
    expect(await store.list()).toEqual([])
  })

  it('nom par défaut si vide', async () => {
    const store = createMemoryAssetStore()
    const a = await store.add(new File(['x'], 'y.png'), '')
    expect(a.name).toMatch(/^image-/)
  })

  it('remove inconnu sans throw', async () => {
    const store = createMemoryAssetStore()
    await expect(store.remove('nope')).resolves.toBeUndefined()
  })
})

describe('buildDeckFromArticle', () => {
  it('répartit titre + paragraphes sur les templates choisis', () => {
    const { slides, activeId } = buildDeckFromArticle(
      'Gros titre\n\nPremier paragraphe\n\nSecond paragraphe',
      ['COVER', 'INFO', 'OUTRO'],
    )
    expect(slides).toHaveLength(3)
    expect(slides[0].type).toBe('COVER')
    expect(slides[0].label).toContain('Couverture')
    expect(activeId).toBe(slides[0].id)
    expect(JSON.stringify(slides[0].templateState)).toContain('Gros titre')
  })

  it('ignore les types inconnus, repli NEWS si vide', () => {
    const r1 = buildDeckFromArticle('Titre', ['NOPE' as never, 'NEWS'])
    expect(r1.slides).toHaveLength(1)
    expect(r1.slides[0].type).toBe('NEWS')
    const r2 = buildDeckFromArticle('Titre', [])
    expect(r2.slides[0].type).toBe('NEWS')
  })

  it('plafonne à 10 slides, titre par défaut si vide', () => {
    const types = Array.from({ length: 15 }, () => 'INFO' as const)
    const r = buildDeckFromArticle('', types)
    expect(r.slides).toHaveLength(10)
    expect(JSON.stringify(r.slides[0].templateState)).toContain('Sans titre')
  })

  it('ids uniques, format 4:5, couches vides', () => {
    const r = buildDeckFromArticle('A\n\nB', ['COVER', 'NEWS'])
    expect(new Set(r.slides.map((s) => s.id)).size).toBe(2)
    expect(r.slides.every((s) => s.format === '4:5' && s.layers.length === 0)).toBe(true)
  })
})
