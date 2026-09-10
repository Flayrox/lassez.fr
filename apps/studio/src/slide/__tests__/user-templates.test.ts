// Tests templates customs : backend local, store CRUD, apply, bindings.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDaemonBackend, createLocalBackend, type TemplateBackend } from '../templateBackend'
import { useUserTemplatesStore } from '../store/userTemplates'
import { useSlideDeckStore } from '../store/deck'
import {
  BIND_OPTIONS,
  buildDeckFromSpecs,
  fillBoundLayers,
  splitArticle,
} from '../article'
import type { UserTemplate } from '../types'

beforeEach(() => setActivePinia(createPinia()))

function makeTpl(overrides: Partial<UserTemplate> = {}): UserTemplate {
  return {
    id: 't1',
    name: 'Mon custom',
    category: 'Personnalisé',
    baseType: 'INFO',
    format: '4:5',
    templateState: { headline: 'H' },
    layers: [
      {
        id: 'l1', kind: 'text', name: 'Titre lié', visible: true, locked: false,
        behind: false, x: 0, y: 0, w: 100, h: 50, rotation: 0, opacity: 1, z: 1,
        data: { doc: { type: 'doc' }, bind: 'headline' },
      },
      {
        id: 'l2', kind: 'text', name: 'Corps lié', visible: true, locked: false,
        behind: false, x: 0, y: 60, w: 100, h: 50, rotation: 0, opacity: 1, z: 2,
        data: { doc: { type: 'doc' }, bind: 'body' },
      },
    ],
    createdAt: 1,
    updatedAt: 2,
    origin: 'local',
    ...overrides,
  }
}

describe('createLocalBackend (repli mémoire jsdom)', () => {
  it('save/list/remove/clear en boucle fermée', async () => {
    const b = createLocalBackend()
    expect(b.origin).toBe('local')
    expect(await b.list()).toEqual([])
    await b.save(makeTpl())
    await b.save(makeTpl({ id: 't2', name: 'Second' }))
    const list = await b.list()
    expect(list.map((t) => t.id).sort()).toEqual(['t1', 't2'])
    // Upsert même id.
    await b.save(makeTpl({ id: 't1', name: 'Renommé' }))
    expect((await b.list()).find((t) => t.id === 't1')!.name).toBe('Renommé')
    await b.remove('t1')
    expect((await b.list()).map((t) => t.id)).toEqual(['t2'])
    await b.clear()
    expect(await b.list()).toEqual([])
  })
})

describe('userTemplates store', () => {
  it('load sanitize + tri par updatedAt décroissant', async () => {
    const s = useUserTemplatesStore()
    const backend = createLocalBackend()
    await backend.save(makeTpl({ id: 'old', updatedAt: 5 }))
    await backend.save(makeTpl({ id: 'new', name: 'New', updatedAt: 50 }))
    await backend.save({ broken: true } as unknown as UserTemplate)
    s.setBackend(backend)
    const items = await s.load()
    expect(s.loaded).toBe(true)
    expect(items.map((t) => t.id)).toEqual(['new', 'old'])
    expect(s.count).toBe(2)
  })

  it('saveFromSlide fige la slide (isolation anti-mutation)', async () => {
    const deck = useSlideDeckStore()
    deck.ensureInit()
    deck.addTextLayer('Hello')
    const s = useUserTemplatesStore()
    await s.load()
    const tpl = (await s.saveFromSlide(deck.activeSlide!, { name: '  Ma une  ' }))!
    expect(tpl.name).toBe('Ma une')
    expect(tpl.baseType).toBe('NEWS')
    expect(tpl.layers).toHaveLength(1)
    // Muter la slide ne touche pas le template.
    deck.patchTemplateState({ headline: 'CHANGÉ' })
    expect(JSON.stringify(tpl.templateState)).not.toContain('CHANGÉ')
  })

  it('saveFromSlide refuse un nom vide', async () => {
    const deck = useSlideDeckStore()
    deck.ensureInit()
    const s = useUserTemplatesStore()
    await s.load()
    expect(await s.saveFromSlide(deck.activeSlide!, { name: '   ' })).toBeNull()
    expect(s.count).toBe(0)
  })

  it('instantiate clone avec ids frais (jamais partagés)', async () => {
    const s = useUserTemplatesStore()
    const tpl = makeTpl()
    const a = s.instantiate(tpl, 1)
    const b = s.instantiate(tpl, 2)
    expect(a.label).toContain('01')
    expect(b.label).toContain('02')
    expect(a.layers[0].id).not.toBe(tpl.layers[0].id)
    expect(a.layers[0].id).not.toBe(b.layers[0].id)
    // Isolation : muter le clone ne touche pas le template.
    a.layers[0].x = 999
    expect(tpl.layers[0].x).toBe(0)
  })

  it('rename/remove + export/import JSON round-trip', async () => {
    const s = useUserTemplatesStore()
    const backend = createLocalBackend()
    await backend.save(makeTpl())
    s.setBackend(backend)
    await s.load()
    expect(await s.rename('t1', '  Nouveau nom  ')).toBe(true)
    expect(s.get('t1')!.name).toBe('Nouveau nom')
    expect(await s.rename('t1', '   ')).toBe(false)
    expect(await s.rename('nope', 'X')).toBe(false)
    const json = s.exportJSON('t1')!
    expect(JSON.parse(json).kind).toBe('lassez-slide-template')
    expect(s.exportJSON('nope')).toBeNull()
    await s.remove('t1')
    expect(s.count).toBe(0)
    expect(await s.remove('t1')).toBe(false)
    const imported = (await s.importJSON(JSON.parse(json)))!
    expect(imported.name).toBe('Nouveau nom')
    expect(imported.id).not.toBe('t1') // nouvel id anti-collision
    expect(await s.importJSON({})).toBeNull()
    expect(await s.importJSON(null)).toBeNull()
    expect(await s.importJSON('{oups')).toBeNull()
  })
})

describe('bindings article', () => {
  it('splitArticle titre + restes', () => {
    expect(splitArticle('')).toEqual({ title: 'Sans titre', rest: [] })
    expect(splitArticle('T\n\nA\n\nB')).toEqual({ title: 'T', rest: ['A', 'B'] })
  })

  it('fillBoundLayers : headline ← titre, autres ← paragraphes round-robin', () => {
    const tpl = makeTpl()
    fillBoundLayers(tpl.layers, { title: 'GROS TITRE', rest: ['P1', 'P2'] })
    expect(JSON.stringify(tpl.layers[0].data)).toContain('GROS TITRE')
    expect(JSON.stringify(tpl.layers[1].data)).toContain('P1')
  })

  it('fillBoundLayers : repli titre si plus de paragraphes', () => {
    const tpl = makeTpl()
    fillBoundLayers(tpl.layers, { title: 'T', rest: [] })
    expect(JSON.stringify(tpl.layers[1].data)).toContain('T')
  })

  it('fillBoundLayers : ignore couches non liées et non-texte', () => {
    const tpl = makeTpl()
    tpl.layers.push({
      id: 'l3', kind: 'image', name: 'img', visible: true, locked: false,
      behind: false, x: 0, y: 0, w: 10, h: 10, rotation: 0, opacity: 1, z: 3,
      data: { src: 'x', bind: 'body' } as unknown as Record<string, unknown> as never,
    })
    tpl.layers[0].data = { doc: { type: 'doc' } } as never
    fillBoundLayers(tpl.layers, { title: 'T', rest: ['P'] })
    expect(JSON.stringify(tpl.layers[1].data)).toContain('P')
  })

  it('buildDeckFromSpecs mixte natif + custom lié', () => {
    const deck = buildDeckFromSpecs(
      [
        { kind: 'builtin', type: 'NEWS' },
        { kind: 'user', template: makeTpl() },
      ],
      'Titre choc\n\nPara un',
    )
    expect(deck.slides).toHaveLength(2)
    expect(deck.slides[0].type).toBe('NEWS')
    expect(deck.slides[1].type).toBe('INFO')
    expect(deck.slides[1].label).toContain('Mon custom')
    expect(JSON.stringify(deck.slides[1].layers[0].data)).toContain('Titre choc')
    expect(deck.activeId).toBe(deck.slides[0].id)
  })

  it('buildDeckFromSpecs vide → repli NEWS', () => {
    const deck = buildDeckFromSpecs([], 'Hello')
    expect(deck.slides).toHaveLength(1)
    expect(deck.slides[0].type).toBe('NEWS')
  })

  it('BIND_OPTIONS : vocabulaire fermé avec sortie Aucune', () => {
    expect(BIND_OPTIONS[0]).toMatchObject({ value: '' })
    expect(BIND_OPTIONS.map((o) => o.value)).toContain('headline')
    expect(BIND_OPTIONS.map((o) => o.value)).toContain('body')
  })
})

describe('createDaemonBackend (fetch mocké)', () => {
  afterEach(() => vi.unstubAllGlobals())

  function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () => handler(url, init),
      })),
    )
  }

  it('list mappe les lignes (strings JSON parsées, filtre les invalides)', async () => {
    mockFetch(() => ({
      templates: [
        {
          id: 'd1', name: 'Serv', category: 'X', baseType: 'cover',
          format: '1:1', templateState: '{"headline":"H"}', layers: '[]',
          thumbnail: '', createdAt: 1, updatedAt: 2,
        },
        { id: '', name: '', baseType: 'NOPE' },
      ],
    }))
    const b = createDaemonBackend()
    expect(b.origin).toBe('daemon')
    const items = await b.list()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'd1', name: 'Serv', baseType: 'COVER', origin: 'daemon' })
    expect(items[0].templateState).toMatchObject({ headline: 'H' })
  })

  it('save POSTe + valide la réponse, remove DELETE', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    mockFetch((url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url === '/api/slide-templates' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { template: Record<string, unknown> }
        return { ok: true, template: { ...body.template, createdAt: 1, updatedAt: 2 } }
      }
      return { ok: true }
    })
    const b = createDaemonBackend()
    await b.save(makeTpl({ origin: 'daemon' }))
    expect(calls[0].url).toBe('/api/slide-templates')
    expect(calls[0].init?.method).toBe('POST')
    const sent = JSON.parse(String(calls[0].init?.body)) as { template: { layers: unknown[] } }
    expect(Array.isArray(sent.template.layers)).toBe(true)
    await b.remove('d1')
    expect(calls[1]).toMatchObject({ url: '/api/slide-templates?id=d1' })
  })

  it('erreur HTTP → throw avec message serveur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'nom requis' }) })),
    )
    const b = createDaemonBackend()
    await expect(b.list()).rejects.toThrow()
    await expect(b.save(makeTpl())).rejects.toThrow('nom requis')
  })

  it('réseau coupé → throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('down')
      }),
    )
    await expect(createDaemonBackend().list()).rejects.toThrow()
  })
})

describe('syncWithDaemon', () => {
  function memBackend(initial: UserTemplate[] = []): TemplateBackend & { pushed: UserTemplate[] } {
    const items = [...initial]
    const pushed: UserTemplate[] = []
    return {
      origin: 'local',
      pushed,
      async list() {
        return [...items]
      },
      async save(t: UserTemplate) {
        pushed.push(t)
        const i = items.findIndex((x) => x.id === t.id)
        if (i >= 0) items[i] = t
        else items.push(t)
      },
      async remove(id: string) {
        const i = items.findIndex((x) => x.id === id)
        if (i >= 0) items.splice(i, 1)
      },
      async clear() {
        items.length = 0
      },
    }
  }

  it('daemon injoignable → reste local et charge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('down')
      }),
    )
    try {
      const s = useUserTemplatesStore()
      const local = memBackend([makeTpl()])
      s.setBackend(local)
      expect(await s.syncWithDaemon()).toBe('local')
      expect(s.count).toBe(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('daemon joignable → pousse les locaux puis bascule', async () => {
    const posted: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () => {
          if (url === '/api/slide-templates' && (!init || !init.method || init.method === 'GET')) {
            return { templates: [] }
          }
          posted.push(JSON.parse(String(init?.body)))
          const body = JSON.parse(String(init?.body)) as { template: Record<string, unknown> }
          return { ok: true, template: { ...body.template, createdAt: 1, updatedAt: 2 } }
        },
      })),
    )
    try {
      const s = useUserTemplatesStore()
      s.setBackend(memBackend([makeTpl()]))
      expect(await s.syncWithDaemon()).toBe('daemon')
      expect(posted).toHaveLength(1)
      // Les saves suivants partent au daemon (fetch POST).
      await s.saveFromSlide(
        { id: 'x', type: 'NEWS', label: 'L', format: '4:5', templateState: {}, layers: [] } as never,
        { name: 'Second' },
      )
      expect(posted).toHaveLength(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
