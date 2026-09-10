// Tests store deck : CRUD slides, couches, historique, persistance, imports.
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { LEGACY_STORAGE_KEY, STORAGE_KEY, emptyTiptapDoc, useSlideDeckStore } from '../store/deck'

function memStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('deck store — slides', () => {
  it('ensureInit crée une slide NEWS par défaut', () => {
    const s = useSlideDeckStore()
    expect(s.slides).toHaveLength(0)
    s.ensureInit()
    expect(s.slides).toHaveLength(1)
    expect(s.slides[0].type).toBe('NEWS')
    expect(s.activeId).toBe(s.slides[0].id)
    expect(s.activeSlide?.id).toBe(s.slides[0].id)
  })

  it('ensureInit répare un activeId orphelin', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    s.activeId = 'orphelin'
    s.ensureInit()
    expect(s.activeId).toBe(s.slides[0].id)
  })

  it('addSlide ajoute, active et labellise en séquence', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const a = s.addSlide('COVER')
    const b = s.addSlide('VERSUS')
    expect(s.slides).toHaveLength(3)
    expect(s.activeId).toBe(b.id)
    expect(a.label).toMatch(/^Slide 02/)
    expect(b.label).toMatch(/^Slide 03/)
    expect(a.templateState.headline).toContain('PARADIGME')
  })

  it('duplicateSlide clone après la source avec "(copie)"', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const src = s.slides[0]
    const dup = s.duplicateSlide(src.id)!
    expect(dup.id).not.toBe(src.id)
    expect(dup.label).toBe(`${src.label} (copie)`)
    expect(s.slides[1].id).toBe(dup.id)
    expect(s.activeId).toBe(dup.id)
    // Isolation : muter la copie ne touche pas la source
    dup.templateState.headline = 'CHANGÉ'
    expect(src.templateState.headline).not.toBe('CHANGÉ')
  })

  it('duplicateSlide retourne null sur id inconnu', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    expect(s.duplicateSlide('nope')).toBeNull()
  })

  it('deleteSlide refuse de supprimer la dernière slide', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    expect(s.deleteSlide(s.slides[0].id)).toBe(false)
    expect(s.slides).toHaveLength(1)
  })

  it('deleteSlide supprime et réactive le voisin', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const b = s.addSlide('COVER')
    s.addSlide('VERSUS')
    expect(s.deleteSlide(b.id)).toBe(true)
    expect(s.slides).toHaveLength(2)
    expect(s.slides.some((x) => x.id === b.id)).toBe(false)
  })

  it('reorder déplace par indices + moveSlide par direction', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const b = s.addSlide('COVER')
    const c = s.addSlide('VERSUS')
    s.reorder(0, 2)
    expect(s.slides[2].type).toBe('NEWS')
    s.reorder(0, 0) // no-op
    s.moveSlide(c.id, -1)
    expect(s.slides[0].id).toBe(c.id)
    expect(s.slides[1].id).toBe(b.id)
  })

  it('reorder ignore les indices hors bornes', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    s.addSlide('COVER')
    const before = s.slides.map((x) => x.id)
    s.reorder(-1, 5)
    s.reorder(0, 9)
    expect(s.slides.map((x) => x.id)).toEqual(before)
  })

  it('renameSlide + setActiveId + patchTemplateState', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const other = s.addSlide('COVER')
    s.renameSlide(other.id, 'Ma Une')
    expect(other.label).toBe('Ma Une')
    s.setActiveId(other.id)
    s.patchTemplateState({ headline: 'TITRE X' })
    expect(other.templateState.headline).toBe('TITRE X')
    s.setActiveId('inconnu') // ignoré
    expect(s.activeId).toBe(other.id)
  })

  it('resetSlide restaure le defaultState du template', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const id = s.slides[0].id
    s.patchTemplateState({ headline: 'MODIFIÉ' })
    s.addTextLayer('hello')
    expect(s.resetSlide(id)).toBe(true)
    expect(s.slides[0].templateState.headline).toContain('DÉCRYPTAGE')
    expect(s.slides[0].layers).toHaveLength(0)
  })
})

describe('deck store — formats', () => {
  it('les nouvelles slides héritent du format du deck', () => {
    const s = useSlideDeckStore()
    s.setDeckFormat('1:1')
    s.ensureInit()
    expect(s.slides[0].format).toBe('1:1')
  })

  it('setDeckFormat propage à toutes les slides', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    s.addSlide('COVER')
    s.setDeckFormat('9:16')
    expect(s.slides.every((x) => x.format === '9:16')).toBe(true)
  })

  it('setSlideFormat ne touche que la slide visée', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const b = s.addSlide('COVER')
    s.setSlideFormat(b.id, '16:9')
    expect(b.format).toBe('16:9')
    expect(s.slides[0].format).toBe('4:5')
  })
})

describe('deck store — couches', () => {
  it('addTextLayer crée un doc Tiptap valide et sélectionne', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const l = s.addTextLayer('Bonjour')!
    expect(l.kind).toBe('text')
    expect(l.z).toBe(1)
    expect(s.selectedLayerId).toBe(l.id)
    expect(JSON.stringify(l.data)).toContain('Bonjour')
  })

  it('addImageLayer refuse une src vide', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    expect(s.addImageLayer('')).toBeNull()
    const l = s.addImageLayer('https://example.com/a.png')!
    expect(l.z).toBe(1)
    expect(l.data).toMatchObject({ src: 'https://example.com/a.png', zoom: 1 })
  })

  it('addShapeLayer porte les defaults militant (rouge + contour noir)', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const l = s.addShapeLayer('ellipse')!
    expect(l.data).toMatchObject({ shape: 'ellipse', fill: '#DC2626' })
  })

  it('updateLayer / updateLayerData patchent, moveLayerLive sans checkpoint', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const l = s.addTextLayer('x')!
    s.updateLayer(l.id, { x: 10, y: 20, opacity: 0.5 })
    expect(l.x).toBe(10)
    expect(l.opacity).toBe(0.5)
    s.moveLayerLive(l.id, 99, 98)
    expect(l.x).toBe(99)
    s.updateLayerData(l.id, { color: '#fff' })
    expect((l.data as unknown as Record<string, unknown>).color).toBe('#fff')
  })

  it('les couches verrouillées ignorent les mutations', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const l = s.addTextLayer('x')!
    s.toggleLayerLock(l.id)
    expect(l.locked).toBe(true)
    s.updateLayer(l.id, { x: 500 })
    s.updateLayerData(l.id, { color: '#000' })
    s.moveLayerLive(l.id, 500, 500)
    expect(l.x).toBe(60) // valeur initiale du store
  })

  it('duplicateLayer décale et renomme', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const l = s.addTextLayer('x')!
    const dup = s.duplicateLayer(l.id)!
    expect(dup.id).not.toBe(l.id)
    expect(dup.name).toContain('(copie)')
    expect(dup.x).toBe(l.x + 24)
  })

  it('moveLayerZ / front / back réordonnent + traversent les plans', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const a = s.addTextLayer('a')!
    const b = s.addTextLayer('b')!
    const c = s.addTextLayer('c')!
    s.moveLayerZ(a.id, 1)
    const zs = new Map(s.slides[0].layers.map((l) => [l.id, l.z]))
    expect(zs.get(a.id)).toBeGreaterThan(zs.get(b.id)!)
    // ▼ répété sur la couche du bas du devant → derrière le template
    s.moveLayerZ(b.id, -1)
    s.moveLayerZ(b.id, -1)
    const bb = s.slides[0].layers.find((l) => l.id === b.id)!
    expect(bb.behind).toBe(true)
    // ▲ répété → revient devant
    s.moveLayerZ(b.id, 1)
    expect(s.slides[0].layers.find((l) => l.id === b.id)!.behind).toBe(false)
    // send/bring directs
    s.sendLayerToBack(c.id)
    expect(s.slides[0].layers.find((l) => l.id === c.id)!.behind).toBe(true)
    s.bringLayerToFront(c.id)
    const cc = s.slides[0].layers.find((l) => l.id === c.id)!
    expect(cc.behind).toBe(false)
    expect(cc.z).toBe(Math.max(...s.slides[0].layers.map((l) => l.z)))
  })

  it('toggleLayerVisibility + removeLayer + selectLayer', () => {    const s = useSlideDeckStore()
    s.ensureInit()
    const l = s.addTextLayer('x')!
    s.toggleLayerVisibility(l.id)
    expect(l.visible).toBe(false)
    s.selectLayer(null)
    expect(s.selectedLayerId).toBeNull()
    s.selectLayer(l.id)
    expect(s.getActiveLayer()?.id).toBe(l.id)
    s.removeLayer(l.id)
    expect(s.slides[0].layers).toHaveLength(0)
    expect(s.selectedLayerId).toBeNull()
  })
})

describe('deck store — historique', () => {
  it('undo/redo sur ajout de slide', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    expect(s.canUndo).toBe(false)
    s.addSlide('COVER')
    expect(s.slides).toHaveLength(2)
    s.undo()
    expect(s.slides).toHaveLength(1)
    expect(s.canRedo).toBe(true)
    s.redo()
    expect(s.slides).toHaveLength(2)
  })

  it('le drag (beginLayerGesture + moves) s’annule en un seul undo', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const l = s.addTextLayer('x')!
    const x0 = l.x
    s.beginLayerGesture()
    s.moveLayerLive(l.id, 100, 100)
    s.moveLayerLive(l.id, 200, 200)
    s.undo()
    expect(s.slides[0].layers[0].x).toBe(x0)
  })

  it('une nouvelle action vide le redo', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    s.addSlide('COVER')
    s.undo()
    s.addSlide('VERSUS')
    expect(s.canRedo).toBe(false)
  })

  it('undo/redo sans historique sont des no-op', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    expect(() => { s.undo(); s.redo() }).not.toThrow()
  })
})

describe('deck store — sérialisation & persistance', () => {
  it('serialize/loadDoc font un aller-retour exact', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    s.addSlide('COVER')
    s.addTextLayer('hello')
    const doc = s.serialize()
    expect(doc.version).toBe(2)
    s.$reset()
    expect(s.loadDoc(doc)).toBe(true)
    expect(s.slides).toHaveLength(2)
    expect(s.slides[1].layers).toHaveLength(1)
  })

  it('loadDoc accepte le format legacy {deck} et sanitise', () => {
    const s = useSlideDeckStore()
    const legacy = {
      deck: [
        { id: 'a', type: 'COVER', label: 'Slide 1', state: { headline: 'H' } },
        { type: 'VIDEO_NOTE', state: {} }, // inconnu → INFO, id généré
        'corrompu',
      ],
    }
    expect(s.loadDoc(legacy)).toBe(true)
    expect(s.slides).toHaveLength(3)
    expect(s.slides[0].templateState).toMatchObject({ headline: 'H', accent: '#DC2626' })
    expect(s.slides[1].type).toBe('INFO')
  })

  it('loadDoc refuse les docs vides/corrompus sans casser le deck', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    expect(s.loadDoc({ deck: [] })).toBe(false)
    expect(s.loadDoc(null)).toBe(false)
    expect(s.loadDoc('nope')).toBe(false)
    expect(s.slides).toHaveLength(1)
  })

  it('saveToStorage/loadFromStorage persistent en localStorage', () => {
    const s = useSlideDeckStore()
    const storage = memStorage()
    s.ensureInit()
    s.addSlide('VERSUS')
    expect(s.saveToStorage(storage as unknown as Storage)).toBe(true)
    expect(storage._map.has(STORAGE_KEY)).toBe(true)
    s.$reset()
    expect(s.loadFromStorage(storage as unknown as Storage)).toBe(true)
    expect(s.slides).toHaveLength(2)
  })

  it('loadFromStorage migre la clé legacy V1', () => {
    const s = useSlideDeckStore()
    const storage = memStorage({
      [LEGACY_STORAGE_KEY]: JSON.stringify({
        deck: [{ id: 'a', type: 'NEWS', label: 'Slide 1', state: { headline: 'X' } }],
        activeId: 'a',
      }),
    })
    expect(s.loadFromStorage(storage as unknown as Storage)).toBe(true)
    expect(s.slides[0].type).toBe('NEWS')
  })

  it('loadFromStorage tolère le JSON corrompu', () => {
    const s = useSlideDeckStore()
    const storage = memStorage({ [STORAGE_KEY]: '{corrompu!!!' })
    expect(s.loadFromStorage(storage as unknown as Storage)).toBe(false)
  })

  it('saveToStorage gère un quota dépassé sans throw', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const failing = {
      getItem: () => null,
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError') },
    }
    expect(s.saveToStorage(failing as unknown as Storage)).toBe(false)
  })
})

describe('deck store — pipeline', () => {
  it('fromSignal pré-remplit headline + articleInput', () => {
    const s = useSlideDeckStore()
    s.fromSignal('Gros titre', 'Corps du flash')
    expect(s.slides[0].templateState.headline).toBe('Gros titre')
    expect(s.articleInput).toContain('Gros titre')
    expect(s.articleInput).toContain('Corps du flash')
  })

  it('fromSignal tolère titre/body vides', () => {
    const s = useSlideDeckStore()
    expect(() => s.fromSignal('', '')).not.toThrow()
  })
})

describe('emptyTiptapDoc', () => {
  it('produit un doc ProseMirror valide, vide ou pré-rempli', () => {
    expect(emptyTiptapDoc()).toMatchObject({ type: 'doc' })
    const doc = emptyTiptapDoc('Hi') as { content: { content: { text: string }[] }[] }
    expect(doc.content[0].content[0].text).toBe('Hi')
  })
})

describe('resetSlide — cas limites', () => {
  it('retourne false sur id inconnu', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    expect(s.resetSlide('inconnu')).toBe(false)
  })
})

describe('deck store — alignement', () => {
  it('aligne sur les 6 positions (slide 4:5 = 1080×1350)', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const l = s.addTextLayer('x')! // 480×160 à 60,60
    s.alignLayer(l.id, 'left')
    expect(l.x).toBe(0)
    s.alignLayer(l.id, 'center-x')
    expect(l.x).toBe(300)
    s.alignLayer(l.id, 'right')
    expect(l.x).toBe(600)
    s.alignLayer(l.id, 'top')
    expect(l.y).toBe(0)
    s.alignLayer(l.id, 'middle')
    expect(l.y).toBe(595)
    s.alignLayer(l.id, 'bottom')
    expect(l.y).toBe(1190)
  })

  it('1 seul undo pour un alignement', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const l = s.addTextLayer('x')!
    s.alignLayer(l.id, 'center-x')
    s.undo()
    expect(s.activeSlide!.layers[0].x).toBe(60)
  })

  it('ignore id inconnu et couche verrouillée', () => {
    const s = useSlideDeckStore()
    s.ensureInit()
    const l = s.addTextLayer('x')!
    s.alignLayer('nope', 'left')
    expect(l.x).toBe(60)
    s.toggleLayerLock(l.id)
    s.alignLayer(l.id, 'left')
    expect(l.x).toBe(60)
  })
})
