// Store Pinia du deck Slide — transposition du `StudioContext` legacy,
// étendu : couches libres, historique undo/redo, multi-format, persistance.
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  DeckDoc,
  FormatId,
  ImageLayerData,
  Layer,
  LayerData,
  LayerKind,
  ShapeLayerData,
  Slide,
  SlideType,
  TextLayerData,
} from '../types'
import { DEFAULT_FORMAT, getFormat } from '../formats'
import { DEFAULT_TEXT_SIZE } from '../brand'
import { coerceSlideType, getTemplate } from '../registry'
import {
  deepClone,
  defaultLayerName,
  defaultSlideLabel,
  findSlide,
  nid,
  nextZ,
  renumberZ,
} from '../utils'
import { distributeRects } from '../engine/geometry'

export const STORAGE_KEY = 'lassez_slide_deck_v2'
export const LEGACY_STORAGE_KEY = 'lassez_studio_deck_v1'
const HISTORY_LIMIT = 100

export type AlignPosition = 'left' | 'center-x' | 'right' | 'top' | 'middle' | 'bottom'

interface Snapshot {
  slides: Slide[]
  activeId: string
  deckFormat: FormatId
}

function snapshotOf(slides: Slide[], activeId: string, deckFormat: FormatId): Snapshot {
  return { slides: deepClone(slides), activeId, deckFormat }
}

export function emptyTiptapDoc(text = ''): Record<string, unknown> {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : [],
      },
    ],
  }
}

export const useSlideDeckStore = defineStore('slide-deck', () => {
  const slides = ref<Slide[]>([])
  const activeId = ref('')
  const deckFormat = ref<FormatId>(DEFAULT_FORMAT)
  /** Sélection multiple — [0] = primaire (cible des poignées/panneaux). */
  const selectedLayerIds = ref<string[]>([])
  /**
   * Couche en cours d'ÉDITION texte (double-clic/Entrée). Séparée de la
   * sélection : hors édition l'éditeur est read-only donc le drag déplace
   * et Suppr supprime (modèle Canva). Une seule à la fois.
   */
  const editingLayerId = ref<string | null>(null)
  const articleInput = ref('')
  const past = ref<Snapshot[]>([])
  const future = ref<Snapshot[]>([])

  const activeSlide = computed<Slide | null>(() => {
    return findSlide(slides.value, activeId.value) ?? slides.value[0] ?? null
  })
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  /** Compat : id primaire (première couche sélectionnée). */
  const selectedLayerId = computed<string | null>(() => selectedLayerIds.value[0] ?? null)
  /** Couches sélectionnées de la slide active, dans l'ordre de sélection. */
  const selectedLayers = computed<Layer[]>(() => {
    const slide = activeSlide.value
    if (!slide) return []
    const byId = new Map(slide.layers.map((l) => [l.id, l]))
    return selectedLayerIds.value
      .map((id) => byId.get(id))
      .filter((l): l is Layer => l !== undefined)
  })

  function checkpoint() {
    past.value.push(snapshotOf(slides.value, activeId.value, deckFormat.value))
    if (past.value.length > HISTORY_LIMIT) past.value.shift()
    future.value = []
  }

  function undo() {
    const prev = past.value.pop()
    if (!prev) return
    future.value.push(snapshotOf(slides.value, activeId.value, deckFormat.value))
    slides.value = prev.slides
    activeId.value = prev.activeId
    deckFormat.value = prev.deckFormat
    selectedLayerIds.value = []
    editingLayerId.value = null
  }

  function redo() {
    const next = future.value.pop()
    if (!next) return
    past.value.push(snapshotOf(slides.value, activeId.value, deckFormat.value))
    slides.value = next.slides
    activeId.value = next.activeId
    deckFormat.value = next.deckFormat
    selectedLayerIds.value = []
    editingLayerId.value = null
  }

  function buildSlide(type: SlideType, index: number): Slide {
    const meta = getTemplate(type)
    return {
      id: nid('s'),
      type,
      label: defaultSlideLabel(index, meta?.name ?? type),
      format: deckFormat.value,
      templateState: deepClone(meta?.defaultState ?? {}),
      layers: [],
    }
  }

  /** Garantit un deck non vide (init / après import vide). */
  function ensureInit() {
    if (slides.value.length > 0) {
      if (!findSlide(slides.value, activeId.value)) {
        activeId.value = slides.value[0].id
      }
      return
    }
    const slide = buildSlide('NEWS', 1)
    slides.value = [slide]
    activeId.value = slide.id
  }

  function addSlide(type: SlideType = 'INFO'): Slide {
    checkpoint()
    const slide = buildSlide(type, slides.value.length + 1)
    slides.value.push(slide)
    activeId.value = slide.id
    selectedLayerIds.value = []
    editingLayerId.value = null
    return slide
  }

  function duplicateSlide(id: string): Slide | null {
    const src = findSlide(slides.value, id)
    if (!src) return null
    checkpoint()
    const dup: Slide = {
      ...deepClone(src),
      id: nid('s'),
      label: `${src.label} (copie)`,
    }
    const idx = slides.value.findIndex((s) => s.id === id)
    slides.value.splice(idx + 1, 0, dup)
    activeId.value = dup.id
    return dup
  }

  function deleteSlide(id: string): boolean {
    if (slides.value.length <= 1) return false
    const idx = slides.value.findIndex((s) => s.id === id)
    if (idx < 0) return false
    checkpoint()
    slides.value.splice(idx, 1)
    if (activeId.value === id) activeId.value = slides.value[Math.max(0, idx - 1)].id
    // Élagage : ne garde que les ids encore présents dans le deck.
    selectedLayerIds.value = selectedLayerIds.value.filter((lid) =>
      slides.value.some((s) => s.layers.some((l) => l.id === lid)),
    )
    if (
      editingLayerId.value &&
      !slides.value.some((s) => s.layers.some((l) => l.id === editingLayerId.value))
    ) {
      editingLayerId.value = null
    }
    return true
  }

  /** Réordonne par indices (drag & drop) — équivalent du `onReorder` legacy. */
  function reorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || fromIndex >= slides.value.length) return
    if (toIndex < 0 || toIndex >= slides.value.length) return
    checkpoint()
    const [moved] = slides.value.splice(fromIndex, 1)
    slides.value.splice(toIndex, 0, moved)
  }

  function moveSlide(id: string, dir: -1 | 1) {
    const idx = slides.value.findIndex((s) => s.id === id)
    if (idx < 0) return
    reorder(idx, idx + dir)
  }

  function renameSlide(id: string, label: string) {
    const slide = findSlide(slides.value, id)
    if (!slide) return
    checkpoint()
    slide.label = label
  }

  function setActiveId(id: string) {
    if (!findSlide(slides.value, id)) return
    activeId.value = id
    selectedLayerIds.value = []
    editingLayerId.value = null
  }

  function patchTemplateState(patch: Record<string, unknown>) {
    const slide = activeSlide.value
    if (!slide) return
    checkpoint()
    Object.assign(slide.templateState, patch)
  }

  /**
   * Patch template SANS checkpoint (frappe dans les RichText) — l'appelant
   * commit un beginGesture() au focus pour grouper toute la session en 1 undo.
   */
  function patchTemplateStateLive(patch: Record<string, unknown>) {
    const slide = activeSlide.value
    if (!slide) return
    Object.assign(slide.templateState, patch)
  }

  function resetSlide(id: string): boolean {
    const slide = findSlide(slides.value, id)
    const meta = slide ? getTemplate(slide.type) : undefined
    if (!slide || !meta) return false
    if (!confirmReset()) return false
    checkpoint()
    slide.templateState = deepClone(meta.defaultState)
    slide.layers = []
    selectedLayerIds.value = []
    editingLayerId.value = null
    return true
  }

  /** Appliquée par la toolbar ("Reset slide") — confirmation portée par l'appelant en tests. */
  function confirmReset(): boolean {
    return true
  }

  function setSlideFormat(id: string, format: FormatId) {
    const slide = findSlide(slides.value, id)
    if (!slide) return
    checkpoint()
    slide.format = format
  }

  /** Change le format du deck : défaut + toutes les slides existantes. */
  function setDeckFormat(format: FormatId) {
    checkpoint()
    deckFormat.value = format
    for (const slide of slides.value) slide.format = format
  }

  // ── Couches ────────────────────────────────────────────────

  function addLayer(kind: LayerKind, data: LayerData, overrides: Partial<Layer> = {}): Layer | null {
    const slide = activeSlide.value
    if (!slide) return null
    checkpoint()
    const layer: Layer = {
      id: nid('l'),
      kind,
      name: defaultLayerName(kind, slide.layers.length + 1),
      visible: true,
      locked: false,
      behind: false,
      x: 60,
      y: 60,
      w: kind === 'text' ? 480 : 360,
      h: kind === 'text' ? 160 : 360,
      rotation: 0,
      opacity: 1,
      z: nextZ(slide.layers),
      data,
      ...overrides,
    }
    // L'id reste généré (un override explicite est respecté tel quel).
    slide.layers.push(layer)
    renumberZ(slide.layers)
    selectedLayerIds.value = [layer.id]
    return layer
  }

  function addTextLayer(text = '', overrides: Partial<Layer> = {}): Layer | null {
    const data: TextLayerData = { doc: emptyTiptapDoc(text), fontSize: DEFAULT_TEXT_SIZE }
    return addLayer('text', data, overrides)
  }

  function addImageLayer(src: string, overrides: Partial<Layer> = {}): Layer | null {
    if (!src) return null
    const data: ImageLayerData = { src, zoom: 1, grayscale: 0, opacity: 1, fit: 'cover' }
    return addLayer('image', data, overrides)
  }

  function addShapeLayer(
    shape: ShapeLayerData['shape'] = 'rect',
    overrides: Partial<Layer> = {},
  ): Layer | null {
    const data: ShapeLayerData = { shape, fill: '#DC2626', stroke: '#000000', strokeWidth: 4 }
    return addLayer('shape', data, overrides)
  }

  function getActiveLayer(): Layer | null {
    const slide = activeSlide.value
    if (!slide || !selectedLayerId.value) return null
    return slide.layers.find((l) => l.id === selectedLayerId.value) ?? null
  }

  function updateLayer(id: string, patch: Partial<Omit<Layer, 'id' | 'data'>>) {
    const layer = activeSlide.value?.layers.find((l) => l.id === id)
    if (!layer || layer.locked) return
    checkpoint()
    Object.assign(layer, patch)
  }

  /** Patch SANS checkpoint (resize/move en cours de geste — beginGesture avant). */
  function updateLayerLive(id: string, patch: Partial<Omit<Layer, 'id' | 'data'>>) {
    const layer = activeSlide.value?.layers.find((l) => l.id === id)
    if (!layer || layer.locked) return
    Object.assign(layer, patch)
  }

  function updateLayerData(id: string, patch: Record<string, unknown>) {
    const layer = activeSlide.value?.layers.find((l) => l.id === id)
    if (!layer || layer.locked) return
    checkpoint()
    Object.assign(layer.data as unknown as Record<string, unknown>, patch)
  }

  /**
   * Patch data SANS checkpoint (frappe clavier des calques texte) — l'appelant
   * a commité via beginGesture() au focus / de façon debouncée.
   */
  function updateLayerDataLive(id: string, patch: Record<string, unknown>) {
    const layer = activeSlide.value?.layers.find((l) => l.id === id)
    if (!layer || layer.locked) return
    Object.assign(layer.data as unknown as Record<string, unknown>, patch)
  }

  /** Déplacement pendant le drag : sans checkpoint (commit au pointerup). */
  function moveLayerLive(id: string, x: number, y: number) {
    const layer = activeSlide.value?.layers.find((l) => l.id === id)
    if (!layer || layer.locked) return
    layer.x = x
    layer.y = y
  }

  /** Commit explicite avant un drag (pour que undo annule tout le geste). */
  function beginLayerGesture() {
    checkpoint()
  }

  /** Alias sémantique (templates, resize) — même checkpoint. */
  function beginGesture() {
    checkpoint()
  }

  function removeLayer(id: string) {
    const slide = activeSlide.value
    if (!slide) return
    const idx = slide.layers.findIndex((l) => l.id === id)
    if (idx < 0) return
    checkpoint()
    slide.layers.splice(idx, 1)
    renumberZ(slide.layers)
    selectedLayerIds.value = selectedLayerIds.value.filter((lid) => lid !== id)
    if (editingLayerId.value === id) editingLayerId.value = null
  }

  /** Suppression groupée (multi-sélection) — 1 seul undo. */
  function removeLayers(ids: string[]): number {
    const slide = activeSlide.value
    if (!slide) return 0
    const targets = slide.layers.filter((l) => ids.includes(l.id))
    if (targets.length === 0) return 0
    checkpoint()
    slide.layers = slide.layers.filter((l) => !ids.includes(l.id))
    renumberZ(slide.layers)
    const gone = new Set(targets.map((l) => l.id))
    selectedLayerIds.value = selectedLayerIds.value.filter((lid) => !gone.has(lid))
    if (editingLayerId.value && gone.has(editingLayerId.value)) editingLayerId.value = null
    return targets.length
  }

  function duplicateLayer(id: string): Layer | null {
    const slide = activeSlide.value
    const src = slide?.layers.find((l) => l.id === id)
    if (!slide || !src) return null
    checkpoint()
    const dup: Layer = { ...deepClone(src), id: nid('l'), name: `${src.name} (copie)`, z: nextZ(slide.layers) }
    dup.x += 24
    dup.y += 24
    slide.layers.push(dup)
    renumberZ(slide.layers)
    selectedLayerIds.value = [dup.id]
    return dup
  }

  /** Duplication groupée (multi-sélection) — 1 seul undo, sélectionne les copies. */
  function duplicateLayers(ids: string[]): Layer[] {
    const slide = activeSlide.value
    if (!slide) return []
    const sources = slide.layers.filter((l) => ids.includes(l.id))
    if (sources.length === 0) return []
    checkpoint()
    const dups = sources.map((src) => {
      const dup: Layer = { ...deepClone(src), id: nid('l'), name: `${src.name} (copie)`, z: nextZ(slide.layers) }
      dup.x += 24
      dup.y += 24
      slide.layers.push(dup)
      return dup
    })
    renumberZ(slide.layers)
    selectedLayerIds.value = dups.map((d) => d.id)
    return dups
  }

  function moveLayerZ(id: string, dir: 1 | -1) {
    const slide = activeSlide.value
    const layer = slide?.layers.find((l) => l.id === id)
    if (!slide || !layer) return
    // Le z n'ordonne qu'à l'intérieur d'un même plan (devant/derrière).
    const ordered = slide.layers
      .filter((l) => l.behind === layer.behind)
      .sort((a, b) => a.z - b.z)
    const idx = ordered.findIndex((l) => l.id === id)
    if (idx < 0) return
    const swapWith = ordered[idx + dir]
    if (!swapWith) {
      // Bord de plan : ▼ répété en bas du devant → derrière le template ;
      // ▲ répété en haut du derrière → devant.
      if (dir === -1 && !layer.behind) {
        sendLayerToBack(id)
        return
      }
      if (dir === 1 && layer.behind) {
        checkpoint()
        layer.behind = false
        layer.z = nextZ(slide.layers.filter((l) => !l.behind))
        renumberPlane(slide, false)
        return
      }
      return
    }
    checkpoint()
    const tmp = ordered[idx].z
    ordered[idx].z = swapWith.z
    swapWith.z = tmp
  }

  function bringLayerToFront(id: string) {
    const slide = activeSlide.value
    const layer = slide?.layers.find((l) => l.id === id)
    if (!slide || !layer) return
    checkpoint()
    layer.behind = false
    layer.z = nextZ(slide.layers.filter((l) => !l.behind))
    renumberPlane(slide, false)
  }

  function sendLayerToBack(id: string) {
    const slide = activeSlide.value
    const layer = slide?.layers.find((l) => l.id === id)
    if (!slide || !layer) return
    checkpoint()
    // Bascule dans le plan "derrière le template", tout en bas de ce plan.
    layer.behind = true
    const plane = slide.layers.filter((l) => l.behind)
    layer.z = plane.length > 0 ? Math.min(...plane.map((l) => l.z)) - 1 : 0
    renumberPlane(slide, true)
  }

  /** Renumérote 1..n les z d'un plan, sans toucher l'autre plan. */
  function renumberPlane(slide: Slide, behind: boolean) {
    slide.layers
      .filter((l) => l.behind === behind)
      .sort((a, b) => a.z - b.z)
      .forEach((l, i) => {
        l.z = i + 1
      })
  }

  function toggleLayerVisibility(id: string) {
    const layer = activeSlide.value?.layers.find((l) => l.id === id)
    if (!layer) return
    checkpoint()
    layer.visible = !layer.visible
  }

  function toggleLayerLock(id: string) {
    const layer = activeSlide.value?.layers.find((l) => l.id === id)
    if (!layer) return
    checkpoint()
    layer.locked = !layer.locked
  }

  /** Aligne la couche sur la slide (bords/centre) — 1 undo. */
  function alignLayer(id: string, pos: AlignPosition) {
    alignLayers([id], pos)
  }

  /** Aligne un lot de couches sur la slide — 1 seul undo. */
  function alignLayers(ids: string[], pos: AlignPosition) {
    const slide = activeSlide.value
    if (!slide) return
    const targets = slide.layers.filter((l) => ids.includes(l.id) && !l.locked)
    if (targets.length === 0) return
    const f = getFormat(slide.format)
    checkpoint()
    for (const layer of targets) {
      switch (pos) {
        case 'left': layer.x = 0; break
        case 'center-x': layer.x = Math.round(((f.width - layer.w) / 2) * 100) / 100; break
        case 'right': layer.x = f.width - layer.w; break
        case 'top': layer.y = 0; break
        case 'middle': layer.y = Math.round(((f.height - layer.h) / 2) * 100) / 100; break
        case 'bottom': layer.y = f.height - layer.h; break
      }
    }
  }

  /** Sélection simple (remplace). `null` = désélectionne tout + stop édition. */
  function selectLayer(id: string | null) {
    if (id === null) {
      selectedLayerIds.value = []
      editingLayerId.value = null
      return
    }
    const slide = activeSlide.value
    if (slide && !slide.layers.some((l) => l.id === id)) return
    selectedLayerIds.value = [id]
    if (editingLayerId.value !== id) editingLayerId.value = null
  }

  /** Entre en édition texte (la couche doit être sélectionnée). */
  function startEditing(id: string): boolean {
    const slide = activeSlide.value
    const layer = slide?.layers.find((l) => l.id === id)
    if (!slide || !layer || layer.kind !== 'text' || layer.locked || !layer.visible) return false
    if (!selectedLayerIds.value.includes(id)) selectedLayerIds.value = [id]
    editingLayerId.value = id
    return true
  }

  function stopEditing() {
    editingLayerId.value = null
  }

  function isEditing(id: string): boolean {
    return editingLayerId.value === id
  }

  /** Bascule additive (shift/ctrl-clic) pour la multi-sélection. */
  function toggleLayerSelection(id: string) {
    const slide = activeSlide.value
    if (!slide || !slide.layers.some((l) => l.id === id)) return
    selectedLayerIds.value = selectedLayerIds.value.includes(id)
      ? selectedLayerIds.value.filter((lid) => lid !== id)
      : [...selectedLayerIds.value, id]
  }

  function clearLayerSelection() {
    selectedLayerIds.value = []
  }

  /** Distribution régulière des sélectionnées sur un axe — 1 undo. */
  function distributeSelected(axis: 'x' | 'y'): boolean {
    const layers = selectedLayers.value.filter((l) => !l.locked)
    if (layers.length < 3) return false
    checkpoint()
    const positions = distributeRects(
      layers.map((l) => ({ x: l.x, y: l.y, w: l.w, h: l.h })),
      axis,
    )
    const byIndex = new Map(layers.map((l, i) => [l.id, positions[i]]))
    for (const layer of layers) {
      const p = byIndex.get(layer.id)!
      layer.x = p.x
      layer.y = p.y
    }
    return true
  }

  // ── (Dé)sérialisation ──────────────────────────────────────

  function serialize(): DeckDoc {
    return {
      version: 2,
      format: deckFormat.value,
      activeId: activeId.value,
      slides: deepClone(slides.value),
    }
  }

  function sanitizeSlide(raw: Record<string, unknown>, index: number): Slide {
    const type = coerceSlideType(String(raw.type ?? 'INFO'))
    const meta = getTemplate(type)
    const rawState = (raw.state ?? raw.templateState ?? {}) as Record<string, unknown>
    const layers = (Array.isArray(raw.layers) ? deepClone(raw.layers) : []) as Layer[]
    // Les couches legacy n'ont pas de plan : tout devant par défaut.
    for (const layer of layers) {
      if (typeof layer.behind !== 'boolean') layer.behind = false
    }
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : nid('s'),
      type,
      label: typeof raw.label === 'string' && raw.label ? raw.label : defaultSlideLabel(index + 1, meta?.name ?? type),
      format: typeof raw.format === 'string' ? (raw.format as FormatId) : deckFormat.value,
      templateState: { ...deepClone(meta?.defaultState ?? {}), ...deepClone(rawState) },
      layers,
    }
  }

  /** Charge un doc V2 (ou legacy `{deck}` / tableau) — sanitizé, jamais d'exception. */
  function loadDoc(raw: unknown): boolean {
    try {
      const obj = raw as Record<string, unknown> | null
      const arr = Array.isArray(raw) ? raw : (obj?.deck ?? obj?.slides)
      if (!Array.isArray(arr) || arr.length === 0) return false
      checkpoint()
      if (!Array.isArray(raw) && obj && typeof obj.format === 'string') {
        deckFormat.value = obj.format as FormatId
      }
      slides.value = (arr as Record<string, unknown>[]).map((s, i) => sanitizeSlide(s, i))
      const wanted = !Array.isArray(raw) ? String((raw as Record<string, unknown>)?.activeId ?? '') : ''
      activeId.value = findSlide(slides.value, wanted)?.id ?? slides.value[0].id
      selectedLayerIds.value = []
      return true
    } catch {
      return false
    }
  }

  function saveToStorage(storage: Pick<Storage, 'setItem' | 'getItem'> = localStorage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(serialize()))
      return true
    } catch {
      return false
    }
  }

  /** Restaure depuis le storage, avec migration du format legacy V1. */
  function loadFromStorage(storage: Pick<Storage, 'getItem'> = localStorage): boolean {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (raw) {
        const doc = JSON.parse(raw) as DeckDoc
        if (Array.isArray(doc.slides) && doc.slides.length > 0) {
          deckFormat.value = (doc.format as FormatId) ?? DEFAULT_FORMAT
          slides.value = doc.slides.map((s, i) => sanitizeSlide(s as unknown as Record<string, unknown>, i))
          activeId.value = findSlide(slides.value, String(doc.activeId ?? ''))?.id ?? slides.value[0].id
          return true
        }
      }
      // Migration legacy V1 : { deck, activeId }
      const legacy = storage.getItem(LEGACY_STORAGE_KEY)
      if (legacy) {
        const parsed = JSON.parse(legacy) as { deck?: unknown[]; activeId?: string }
        if (Array.isArray(parsed.deck) && parsed.deck.length > 0) {
          slides.value = parsed.deck.map((s, i) => sanitizeSlide(s as Record<string, unknown>, i))
          activeId.value = findSlide(slides.value, String(parsed.activeId ?? ''))?.id ?? slides.value[0].id
          return true
        }
      }
    } catch {
      /* storage corrompu → init par défaut */
    }
    return false
  }

  /** Pré-remplit depuis un signal validé (pipeline → slide). */
  function fromSignal(title: string, body: string) {
    checkpoint()
    ensureInit()
    articleInput.value = [title, body].filter(Boolean).join('\n\n')
    const slide = slides.value[0]
    if (title) slide.templateState.headline = title
  }

  function setArticleInput(value: string) {
    articleInput.value = value
  }

  function $reset() {
    slides.value = []
    activeId.value = ''
    deckFormat.value = DEFAULT_FORMAT
    selectedLayerIds.value = []
    editingLayerId.value = null
    articleInput.value = ''
    past.value = []
    future.value = []
  }

  return {
    slides,
    activeId,
    deckFormat,
    selectedLayerId,
    articleInput,
    activeSlide,
    canUndo,
    canRedo,
    ensureInit,
    addSlide,
    duplicateSlide,
    deleteSlide,
    reorder,
    moveSlide,
    renameSlide,
    setActiveId,
    patchTemplateState,
    patchTemplateStateLive,
    resetSlide,
    setSlideFormat,
    setDeckFormat,
    addLayer,
    addTextLayer,
    addImageLayer,
    addShapeLayer,
    getActiveLayer,
    updateLayer,
    updateLayerLive,
    updateLayerData,
    updateLayerDataLive,
    moveLayerLive,
    beginLayerGesture,
    beginGesture,
    removeLayer,
    removeLayers,
    duplicateLayer,
    duplicateLayers,
    distributeSelected,
    moveLayerZ,
    bringLayerToFront,
    sendLayerToBack,
    toggleLayerVisibility,
    toggleLayerLock,
    alignLayer,
    alignLayers,
    selectLayer,
    toggleLayerSelection,
    clearLayerSelection,
    startEditing,
    stopEditing,
    isEditing,
    editingLayerId,
    selectedLayerIds,
    selectedLayers,
    undo,
    redo,
    serialize,
    loadDoc,
    saveToStorage,
    loadFromStorage,
    fromSignal,
    setArticleInput,
    $reset,
  }
})
