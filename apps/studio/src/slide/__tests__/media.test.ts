// Tests médias : URLs sûres + embedding export (fetch mocké).
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MEDIA_PROXY_PATH,
  buildImageFilter,
  buildImageTransform,
  embedImagesForExport,
  getSafeImageUrl,
  isInlineUrl,
  proxyUrl,
} from '../media'

describe('isInlineUrl', () => {
  it('détecte data/blob/uploads', () => {
    expect(isInlineUrl('data:image/png;base64,xx')).toBe(true)
    expect(isInlineUrl('blob:https://x/yz')).toBe(true)
    expect(isInlineUrl('/uploads/a.png')).toBe(true)
    expect(isInlineUrl('https://example.com/a.png')).toBe(false)
  })
})

describe('getSafeImageUrl', () => {
  it('laisse passer les URLs inline et locales', () => {
    expect(getSafeImageUrl('data:image/png;base64,xx')).toBe('data:image/png;base64,xx')
    expect(getSafeImageUrl('blob:abc')).toBe('blob:abc')
    expect(getSafeImageUrl('/uploads/a.png')).toBe('/uploads/a.png')
  })

  it('proxifie les externes, sans double proxy', () => {
    const proxied = getSafeImageUrl('https://example.com/a.png')
    expect(proxied).toBe(`${MEDIA_PROXY_PATH}?url=${encodeURIComponent('https://example.com/a.png')}`)
    expect(getSafeImageUrl(proxied)).toBe(proxied)
    expect(getSafeImageUrl('/api/proxy-image?url=https%3A%2F%2Fx')).toBe('/api/proxy-image?url=https%3A%2F%2Fx')
  })

  it('gère vide/null/blank', () => {
    expect(getSafeImageUrl('')).toBe('')
    expect(getSafeImageUrl(null)).toBe('')
    expect(getSafeImageUrl(undefined)).toBe('')
    expect(getSafeImageUrl('   ')).toBe('')
  })

  it('laisse la même origine telle quelle', () => {
    const same = `${window.location.origin}/img/a.png`
    expect(getSafeImageUrl(same)).toBe(same)
  })

  it('proxyUrl encode correctement', () => {
    expect(proxyUrl('https://a.fr/x?y=1&z=2')).toContain('url=https%3A%2F%2Fa.fr%2Fx%3Fy%3D1%26z%3D2')
  })
})

describe('buildImageFilter', () => {
  it('neutre → none', () => {
    expect(buildImageFilter({})).toBe('none')
    expect(buildImageFilter({ grayscale: 0, brightness: 100, contrast: 100, saturate: 100, blur: 0 })).toBe('none')
  })

  it('combine grisaille + contraste + flou', () => {
    expect(buildImageFilter({ grayscale: 50, contrast: 120, blur: 2 })).toBe(
      'grayscale(0.5) contrast(1.2) blur(2px)',
    )
  })

  it('luminosité et saturation', () => {
    expect(buildImageFilter({ brightness: 150, saturate: 0 })).toBe('brightness(1.5) saturate(0)')
  })

  it('ignore le flou nul/négatif', () => {
    expect(buildImageFilter({ blur: -3 })).toBe('none')
  })
})

describe('buildImageTransform', () => {
  it('identité → none', () => {
    expect(buildImageTransform()).toBe('none')
    expect(buildImageTransform(1, false, false)).toBe('none')
  })

  it('zoom + miroirs', () => {
    expect(buildImageTransform(1.5, false, false)).toBe('scale(1.5) scaleX(1) scaleY(1)')
    expect(buildImageTransform(1, true, false)).toBe('scale(1) scaleX(-1) scaleY(1)')
    expect(buildImageTransform(2, true, true)).toBe('scale(2) scaleX(-1) scaleY(-1)')
  })
})

describe('embedImagesForExport', () => {
  afterEach(() => vi.unstubAllGlobals())

  function rootWithImages(srcs: string[]): HTMLElement {
    const root = document.createElement('div')
    for (const src of srcs) {
      const img = document.createElement('img')
      img.setAttribute('src', src)
      root.appendChild(img)
    }
    document.body.appendChild(root)
    return root
  }

  it('embed les externes via proxy, ignore data/blob/locales', async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71])
    vi.stubGlobal('fetch', vi.fn(async () => new Response(pngBytes, { status: 200 })))
    const root = rootWithImages([
      'https://example.com/a.png',
      'data:image/png;base64,xx',
      '/local/b.png',
    ])
    const { embedded, skipped } = await embedImagesForExport(root)
    expect(embedded).toBe(1)
    expect(skipped).toBe(0)
    expect(root.querySelectorAll('img')[0].getAttribute('src')).toMatch(/^data:/)
    expect(root.querySelectorAll('img')[1].getAttribute('src')).toBe('data:image/png;base64,xx')
    root.remove()
  })

  it('compte en skipped les échecs proxy sans throw', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ko', { status: 500 })))
    const root = rootWithImages(['https://example.com/ko.png'])
    const res = await embedImagesForExport(root)
    expect(res).toEqual({ embedded: 0, skipped: 1 })
    // La src d'origine est conservée
    expect(root.querySelector('img')!.getAttribute('src')).toBe('https://example.com/ko.png')
    root.remove()
  })

  it('tolère un fetch qui rejette (réseau coupé)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
    const root = rootWithImages(['https://example.com/a.png', 'https://example.com/b.png'])
    const res = await embedImagesForExport(root)
    expect(res).toEqual({ embedded: 0, skipped: 2 })
    root.remove()
  })
})
