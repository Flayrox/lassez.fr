// Tests socle : utils (ids, clamp, clone, z-order, slug).
import { describe, expect, it } from 'vitest'
import {
  clamp,
  deepClone,
  defaultLayerName,
  defaultSlideLabel,
  findSlide,
  nextZ,
  nid,
  normalizeZ,
  renumberZ,
  slugifyFileName,
  sortLayers,
} from '../utils'
import type { Layer, Slide } from '../types'

function layer(id: string, z: number): Layer {
  return {
    id, kind: 'text', name: id, visible: true, locked: false, behind: false,
    x: 0, y: 0, w: 10, h: 10, rotation: 0, opacity: 1, z,
    data: { doc: { type: 'doc' } },
  }
}

describe('utils', () => {
  it('nid génère des ids uniques avec préfixe', () => {
    const ids = new Set(Array.from({ length: 200 }, () => nid('s')))
    expect(ids.size).toBe(200)
    expect(nid('l').startsWith('l')).toBe(true)
  })

  it('clamp borne et gère NaN', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(99, 0, 10)).toBe(10)
    expect(clamp(NaN, 2, 10)).toBe(2)
  })

  it('deepClone isole les mutations', () => {
    const src = { a: { b: [1, 2, 3] } }
    const dup = deepClone(src)
    dup.a.b.push(4)
    expect(src.a.b).toEqual([1, 2, 3])
  })

  it('nextZ / sortLayers / normalizeZ gèrent le z-order', () => {
    expect(nextZ([])).toBe(1)
    const layers = [layer('a', 3), layer('b', 1), layer('c', 2)]
    expect(nextZ(layers)).toBe(4)
    expect(sortLayers(layers).map((l) => l.id)).toEqual(['b', 'c', 'a'])
    // normalizeZ ne mute pas l'entrée
    const renum = normalizeZ(layers)
    expect(renum.map((l) => l.z)).toEqual([1, 2, 3])
    expect(layers.find((l) => l.id === 'a')!.z).toBe(3)
  })

  it('renumberZ renumérote en place en gardant les identités', () => {
    const layers = [layer('a', 30), layer('b', 10), layer('c', 20)]
    const refs = new Map(layers.map((l) => [l.id, l]))
    renumberZ(layers)
    expect(layers.find((l) => l.id === 'b')!.z).toBe(1)
    expect(layers.find((l) => l.id === 'c')!.z).toBe(2)
    expect(layers.find((l) => l.id === 'a')!.z).toBe(3)
    // mêmes objets
    for (const l of layers) expect(l).toBe(refs.get(l.id))
  })

  it('defaultLayerName / defaultSlideLabel formatent en FR', () => {
    expect(defaultLayerName('text', 2)).toBe('Texte 2')
    expect(defaultLayerName('image', 1)).toBe('Image 1')
    expect(defaultSlideLabel(3, 'Cover')).toBe('Slide 03 — Cover')
  })

  it('findSlide retrouve par id', () => {
    const slides = [{ id: 'x' }, { id: 'y' }] as Slide[]
    expect(findSlide(slides, 'y')?.id).toBe('y')
    expect(findSlide(slides, 'z')).toBeUndefined()
  })

  it('slugifyFileName produit des noms de fichiers sûrs', () => {
    expect(slugifyFileName('Slide 1 — Cover')).toBe('slide-1-cover')
    expect(slugifyFileName("L'ÉTÉ À PARIS")).toBe('l-ete-a-paris')
    expect(slugifyFileName('!!!')).toBe('slide')
    expect(slugifyFileName('')).toBe('slide')
  })
})
