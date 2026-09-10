// Backend de persistance des templates customs — interface + impl locale.
// La Phase 4 ajoute le backend daemon (SQLite) et la sync ; le store ne
// changera pas d'API.
import type { FormatId, UserTemplate } from './types'
import { coerceSlideType } from './registry'
import { DEFAULT_FORMAT } from './formats'

export interface TemplateBackend {
  readonly origin: 'local' | 'daemon'
  list(): Promise<UserTemplate[]>
  save(tpl: UserTemplate): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

/** Base IndexedDB des templates (dédiée : un store par base, jamais partagée). */
export const TEMPLATES_IDB = { db: 'lassez-slide-templates', store: 'templates' } as const

async function idb(): Promise<{
  get: (k: string) => Promise<UserTemplate[] | undefined>
  set: (k: string, v: UserTemplate[]) => Promise<void>
  del: (k: string) => Promise<void>
} | null> {
  try {
    if (typeof indexedDB === 'undefined') return null
    const { createStore, get, set, del } = await import('idb-keyval')
    const store = createStore(TEMPLATES_IDB.db, TEMPLATES_IDB.store)
    return {
      get: (k: string) => get(k, store) as Promise<UserTemplate[] | undefined>,
      set: (k: string, v: UserTemplate[]) => set(k, v, store) as Promise<void>,
      del: (k: string) => del(k, store) as Promise<void>,
    }
  } catch {
    return null
  }
}

const ALL_KEY = 'all-v1'

/** Backend local : IndexedDB, repli mémoire (tests/jsdom, quota). */export function createLocalBackend(): TemplateBackend {
  let memory: UserTemplate[] | null = null

  async function read(): Promise<UserTemplate[]> {
    if (memory) return [...memory]
    const db = await idb()
    if (!db) {
      memory = []
      return []
    }
    try {
      return (await db.get(ALL_KEY)) ?? []
    } catch {
      memory = []
      return []
    }
  }

  async function write(items: UserTemplate[]): Promise<void> {
    if (memory) {
      memory = [...items]
      return
    }
    const db = await idb()
    if (!db) {
      memory = [...items]
      return
    }
    try {
      await db.set(ALL_KEY, items)
    } catch {
      memory = [...items]
    }
  }

  return {
    origin: 'local',
    async list() {
      return read()
    },
    async save(tpl: UserTemplate) {
      const items = await read()
      const idx = items.findIndex((t) => t.id === tpl.id)
      if (idx >= 0) items[idx] = tpl
      else items.unshift(tpl)
      await write(items)
    },
    async remove(id: string) {
      await write((await read()).filter((t) => t.id !== id))
    },
    async clear() {
      memory = []
      const db = await idb()
      if (db) {
        try {
          await db.del(ALL_KEY)
        } catch {
          /* déjà vide */
        }
      }
    },
  }
}

function parseJSONField(raw: unknown, fallback: string): string {
  // Le daemon stocke des strings JSON ; on normalise en string dans tous les cas.
  if (typeof raw === 'string') {
    try {
      JSON.parse(raw)
      return raw
    } catch {
      return fallback
    }
  }
  try {
    return JSON.stringify(raw ?? JSON.parse(fallback))
  } catch {
    return fallback
  }
}

function mapRow(row: Record<string, unknown>): UserTemplate | null {
  try {
    const stateStr = parseJSONField(row.templateState, '{}')
    const layersStr = parseJSONField(row.layers, '[]')
    return {
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      category: typeof row.category === 'string' && row.category ? row.category : 'Personnalisé',
      description: typeof row.description === 'string' ? row.description : undefined,
      baseType: coerceSlideType(String(row.baseType ?? 'INFO').toUpperCase()),
      format: (typeof row.format === 'string' ? row.format : DEFAULT_FORMAT) as FormatId,
      templateState: JSON.parse(stateStr) as Record<string, unknown>,
      layers: JSON.parse(layersStr) as UserTemplate['layers'],
      thumbnail: typeof row.thumbnail === 'string' ? row.thumbnail : undefined,
      createdAt: typeof row.createdAt === 'number' ? row.createdAt : Date.now(),
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : Date.now(),
      origin: 'daemon',
    }
  } catch {
    return null
  }
}

async function daemonFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(path, init)
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    const err = typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`
    throw new Error(err)
  }
  return data
}

/**
 * Backend daemon : table SQLite serveur (partagé, sauvegardé).
 * Échec réseau/HTTP → throw (l'appelant bascule sur le local).
 */
export function createDaemonBackend(): TemplateBackend {
  return {
    origin: 'daemon',
    async list() {
      const data = (await daemonFetch('/api/slide-templates')) as { templates?: unknown[] }
      const rows = Array.isArray(data.templates) ? data.templates : []
      return rows
        .map((r) => mapRow(r as Record<string, unknown>))
        .filter((t): t is UserTemplate => t !== null && t.id !== '' && t.name !== '')
    },
    async save(tpl: UserTemplate) {
      const data = (await daemonFetch('/api/slide-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: {
            id: tpl.id,
            name: tpl.name,
            category: tpl.category,
            description: tpl.description ?? '',
            baseType: tpl.baseType,
            format: tpl.format,
            templateState: tpl.templateState,
            layers: tpl.layers,
            thumbnail: tpl.thumbnail ?? '',
          },
        }),
      })) as { template?: unknown }
      const mapped = mapRow((data.template ?? {}) as Record<string, unknown>)
      if (!mapped) throw new Error('réponse daemon invalide')
    },
    async remove(id: string) {
      await daemonFetch(`/api/slide-templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
    async clear() {
      const items = await this.list()
      for (const t of items) await this.remove(t.id)
    },
  }
}
