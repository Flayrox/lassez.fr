// Génération squelette depuis un article (sans IA) : répartit le titre et
// les paragraphes sur les templates choisis. La génération Gemini (daemon)
// remplacera ce squelette en phase pipeline.
import type { SlideType } from './types'
import { getTemplate } from './registry'
import { nid } from './utils'
import type { Slide } from './types'
import { DEFAULT_FORMAT } from './formats'
import { deepClone, defaultSlideLabel } from './utils'
import { htmlToTiptapDoc } from './text/tiptap'

export interface ArticleDeck {
  slides: Slide[]
  activeId: string
}

function firstLines(text: string, n: number): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, n)
}

/** Construit un deck skeleton déterministe (testable, sans réseau). */
export function buildDeckFromArticle(article: string, types: SlideType[]): ArticleDeck {
  const safeTypes = types.filter((t) => getTemplate(t))
  const picked = (safeTypes.length > 0 ? safeTypes : (['NEWS'] as SlideType[])).slice(0, 10)
  const lines = firstLines(article, 12)
  const title = lines[0] ?? 'Sans titre'
  const rest = lines.slice(1)

  const slides: Slide[] = picked.map((type, i) => {
    const meta = getTemplate(type)!
    const templateState = deepClone(meta.defaultState) as Record<string, unknown>
    // Le titre va dans le premier champ "headline-like" disponible.
    const headlineKey = ['headline', 'largeQuote', 'num'].find((k) => k in templateState)
    if (headlineKey) templateState[headlineKey] = htmlToTiptapDoc(i === 0 ? title : (rest[i - 1] ?? title))
    // Le corps suit quand le template a un champ texte secondaire.
    const bodyKey = ['body', 'bodyMono', 'sub', 'context', 'leftBody'].find((k) => k in templateState)
    if (bodyKey && rest[i]) templateState[bodyKey] = htmlToTiptapDoc(rest[i])
    return {
      id: nid('s'),
      type,
      label: defaultSlideLabel(i + 1, meta.name),
      format: DEFAULT_FORMAT,
      templateState,
      layers: [],
    }
  })

  return { slides, activeId: slides[0].id }
}
