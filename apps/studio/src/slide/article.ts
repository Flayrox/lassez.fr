// Génération depuis un article (sans IA) : répartit le titre et les
// paragraphes sur les templates choisis — natifs OU customs (champs liés).
// La génération Gemini (daemon) remplacera ce squelette en phase pipeline.
import type { Layer, Slide, SlideType, UserTemplate } from './types'
import { getTemplate } from './registry'
import { nid } from './utils'
import { DEFAULT_FORMAT } from './formats'
import { deepClone, defaultSlideLabel } from './utils'
import { htmlToTiptapDoc } from './text/tiptap'

export interface ArticleDeck {
  slides: Slide[]
  activeId: string
}

export interface ArticleParts {
  title: string
  rest: string[]
}

/** Clés de liaison proposées dans l'UI (couches texte des customs). */
export const BIND_OPTIONS = [
  { value: '', label: 'Aucune liaison' },
  { value: 'headline', label: 'Titre (headline)' },
  { value: 'body', label: 'Corps (body)' },
  { value: 'sub', label: 'Sous-titre (sub)' },
  { value: 'context', label: 'Contexte' },
  { value: 'quote', label: 'Citation' },
] as const

function firstLines(text: string, n: number): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, n)
}

export function splitArticle(article: string): ArticleParts {
  const lines = firstLines(article, 12)
  return { title: lines[0] ?? 'Sans titre', rest: lines.slice(1) }
}

/** Remplit l'état template (logique historique, extraite pour réemploi). */
export function fillTemplateState(
  templateState: Record<string, unknown>,
  parts: ArticleParts,
  slideIndex: number,
): void {
  const { title, rest } = parts
  const headlineKey = ['headline', 'largeQuote', 'num'].find((k) => k in templateState)
  if (headlineKey) {
    templateState[headlineKey] = htmlToTiptapDoc(
      slideIndex === 0 ? title : (rest[slideIndex - 1] ?? title),
    )
  }
  const bodyKey = ['body', 'bodyMono', 'sub', 'context', 'leftBody'].find((k) => k in templateState)
  if (bodyKey && rest[slideIndex]) templateState[bodyKey] = htmlToTiptapDoc(rest[slideIndex])
}

/**
 * Remplit les couches liées d'un template custom : `headline` ← titre,
 * les autres liaisons ← paragraphes (round-robin dans l'ordre des couches).
 */
export function fillBoundLayers(
  layers: Layer[],
  parts: ArticleParts,
): void {
  const bound = layers.filter(
    (l): l is Layer & { data: { doc: unknown; bind: string } } =>
      l.kind === 'text' &&
      typeof (l.data as { bind?: unknown }).bind === 'string' &&
      ((l.data as { bind?: string }).bind as string).length > 0,
  )
  if (bound.length === 0) return
  let restIdx = 0
  for (const layer of bound) {
    const bind = (layer.data as { bind: string }).bind
    const text = bind === 'headline' ? parts.title : (parts.rest[restIdx++] ?? parts.title)
    ;(layer.data as { doc: unknown }).doc = htmlToTiptapDoc(text)
  }
}

export type DeckSpec =
  | { kind: 'builtin'; type: SlideType }
  | { kind: 'user'; template: UserTemplate }

/** Construit un deck mixte (natifs + customs) depuis un article. */
export function buildDeckFromSpecs(specs: DeckSpec[], article: string): ArticleDeck {
  const picked = specs.slice(0, 10)
  const parts = splitArticle(article)

  const slides: Slide[] = picked.map((spec, i) => {
    if (spec.kind === 'user') {
      const tpl = spec.template
      const meta = getTemplate(tpl.baseType)
      const templateState = deepClone(tpl.templateState) as Record<string, unknown>
      // Les customs sans liaison explicite suivent la même répartition.
      fillTemplateState(templateState, parts, i)
      const layers = deepClone(tpl.layers).map((l) => ({ ...l, id: nid('l') }))
      fillBoundLayers(layers, parts)
      return {
        id: nid('s'),
        type: tpl.baseType,
        label: defaultSlideLabel(i + 1, tpl.name),
        format: tpl.format,
        templateState,
        layers,
      }
    }
    const meta = getTemplate(spec.type)!
    const templateState = deepClone(meta.defaultState) as Record<string, unknown>
    fillTemplateState(templateState, parts, i)
    return {
      id: nid('s'),
      type: spec.type,
      label: defaultSlideLabel(i + 1, meta.name),
      format: DEFAULT_FORMAT,
      templateState,
      layers: [],
    }
  })

  if (slides.length === 0) {
    return buildDeckFromSpecs([{ kind: 'builtin', type: 'NEWS' }], article)
  }
  return { slides, activeId: slides[0].id }
}

/** Construit un deck skeleton déterministe (testable, sans réseau). */
export function buildDeckFromArticle(article: string, types: SlideType[]): ArticleDeck {
  const safeTypes = types.filter((t) => getTemplate(t))
  const specs: DeckSpec[] = (safeTypes.length > 0 ? safeTypes : (['NEWS'] as SlideType[])).map(
    (type) => ({ kind: 'builtin' as const, type }),
  )
  return buildDeckFromSpecs(specs, article)
}
