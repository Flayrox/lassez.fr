// Store des templates personnalisés : catalogue "Mes templates",
// save depuis la slide active, apply (clone avec ids frais), CRUD,
// export/import JSON. Backend interchangeable (local → daemon Phase 4).
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { FormatId, Layer, Slide, UserTemplate } from '../types'
import { createLocalBackend, createDaemonBackend, type TemplateBackend } from '../templateBackend'
import { coerceSlideType, getTemplate } from '../registry'
import { deepClone, defaultSlideLabel, nid } from '../utils'
import { DEFAULT_FORMAT } from '../formats'

function sanitizeTemplate(raw: Record<string, unknown>): UserTemplate | null {
  try {
    const baseType = coerceSlideType(String(raw.baseType ?? raw.type ?? 'INFO'))
    const meta = getTemplate(baseType)
    const state = (raw.templateState ?? raw.state ?? {}) as Record<string, unknown>
    const layers = (Array.isArray(raw.layers) ? raw.layers : []) as Layer[]
    const name = String(raw.name ?? '').trim()
    if (!name) return null
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : nid('t'),
      name,
      category: typeof raw.category === 'string' && raw.category ? raw.category : 'Personnalisé',
      description: typeof raw.description === 'string' ? raw.description : undefined,
      baseType,
      format: (typeof raw.format === 'string' ? raw.format : DEFAULT_FORMAT) as FormatId,
      templateState: { ...deepClone(meta?.defaultState ?? {}), ...deepClone(state) },
      layers: layers.map((l) => ({ ...deepClone(l), id: typeof l.id === 'string' ? l.id : nid('l') })),
      thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : undefined,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
      origin: raw.origin === 'daemon' ? 'daemon' : 'local',
    }
  } catch {
    return null
  }
}

export const useUserTemplatesStore = defineStore('user-templates', () => {
  const items = ref<UserTemplate[]>([])
  const loaded = ref(false)
  let backend: TemplateBackend = createLocalBackend()

  /** Injection du backend (daemon en Phase 4, mock en tests). */
  function setBackend(b: TemplateBackend) {
    backend = b
    loaded.value = false
  }

  /**
   * Bascule vers le daemon si joignable, en poussant d'abord les customs
   * locaux (jamais de perte). Charge dans tous les cas. Retourne le backend.
   */
  async function syncWithDaemon(): Promise<'daemon' | 'local'> {
    const localItems = await backend.list().catch((): UserTemplate[] => [])
    let remote: TemplateBackend | null = null
    try {
      const candidate = createDaemonBackend()
      await candidate.list()
      remote = candidate
    } catch {
      remote = null
    }
    if (!remote) {
      await load()
      return 'local'
    }
    for (const tpl of localItems) {
      try {
        await remote.save({ ...tpl, origin: 'daemon' })
      } catch {
        /* un item en échec n'empêche pas les autres */
      }
    }
    backend = remote
    await load()
    return 'daemon'
  }

  async function load(): Promise<UserTemplate[]> {
    const list = await backend.list()
    // Sanitize au chargement (imports manuels, vieilles versions).
    items.value = list
      .map((t) => sanitizeTemplate(t as unknown as Record<string, unknown>))
      .filter((t): t is UserTemplate => t !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
    loaded.value = true
    return items.value
  }

  const count = computed(() => items.value.length)

  function get(id: string): UserTemplate | undefined {
    return items.value.find((t) => t.id === id)
  }

  async function saveFromSlide(
    slide: Slide,
    opts: { name: string; category?: string; description?: string; thumbnail?: string },
  ): Promise<UserTemplate | null> {
    const name = opts.name.trim()
    if (!name) return null
    const now = Date.now()
    const tpl: UserTemplate = {
      id: nid('t'),
      name,
      category: opts.category?.trim() || 'Personnalisé',
      description: opts.description?.trim() || undefined,
      baseType: slide.type,
      format: slide.format,
      templateState: deepClone(slide.templateState),
      layers: deepClone(slide.layers),
      thumbnail: opts.thumbnail,
      createdAt: now,
      updatedAt: now,
      origin: backend.origin,
    }
    await backend.save(tpl)
    items.value.unshift(tpl)
    return tpl
  }

  /** Clone le template en slide (ids de couches frais, jamais partagés). */
  function instantiate(tpl: UserTemplate, index: number): Slide {
    const meta = getTemplate(tpl.baseType)
    return {
      id: nid('s'),
      type: tpl.baseType,
      label: defaultSlideLabel(index, tpl.name),
      format: tpl.format,
      templateState: deepClone(tpl.templateState),
      layers: deepClone(tpl.layers).map((l) => ({ ...l, id: nid('l') })),
    }
  }

  async function rename(id: string, name: string): Promise<boolean> {
    const tpl = get(id)
    const clean = name.trim()
    if (!tpl || !clean) return false
    const next: UserTemplate = { ...tpl, name: clean, updatedAt: Date.now() }
    await backend.save(next)
    Object.assign(tpl, next)
    return true
  }

  async function remove(id: string): Promise<boolean> {
    if (!get(id)) return false
    await backend.remove(id)
    items.value = items.value.filter((t) => t.id !== id)
    return true
  }

  /** Import JSON (partage entre machines) — sanitizé, jamais d'exception. */
  async function importJSON(raw: unknown): Promise<UserTemplate | null> {
    const obj = (raw ?? {}) as Record<string, unknown>
    // Accepte l'enveloppe d'export {kind, template} comme le brut.
    const payload = (obj.template ?? obj) as Record<string, unknown>
    const tpl = sanitizeTemplate(payload)
    if (!tpl) return null
    tpl.id = nid('t')
    tpl.origin = backend.origin
    tpl.createdAt = Date.now()
    tpl.updatedAt = Date.now()
    await backend.save(tpl)
    items.value.unshift(tpl)
    return tpl
  }

  function exportJSON(id: string): string | null {
    const tpl = get(id)
    if (!tpl) return null
    return JSON.stringify({ kind: 'lassez-slide-template', version: 1, template: tpl }, null, 2)
  }

  function $reset() {
    items.value = []
    loaded.value = false
    backend = createLocalBackend()
  }

  return {
    items, loaded, count, get,
    setBackend, load, syncWithDaemon,
    saveFromSlide, instantiate, rename, remove, importJSON, exportJSON,
    $reset,
  }
})
