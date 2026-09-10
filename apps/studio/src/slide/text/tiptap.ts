// Moteur texte partagé : extensions, presets, conversion HTML legacy ⇄ JSON.
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import type { Extensions, JSONContent } from '@tiptap/core'
import { LassezHighlight, MilitantUnderline } from './marks'

/** Presets typographiques (remplacent le select Style… du BrutToolbar). */
export type TextPreset = 'HEADING' | 'SUBHEAD' | 'BODY' | 'BOLD' | 'CAPTION'

export const TEXT_PRESETS: Record<
  TextPreset,
  { label: string; style: Record<string, string> }
> = {
  HEADING: {
    label: 'HEADING',
    style: {
      fontWeight: '900', fontStyle: 'normal', fontSize: '48px',
      lineHeight: '0.85', letterSpacing: '-0.05em', textTransform: 'uppercase',
    },
  },
  SUBHEAD: {
    label: 'SUBHEAD',
    style: { fontWeight: '700', fontStyle: 'italic', fontSize: '28px' },
  },
  BODY: {
    label: 'BODY',
    style: { fontWeight: '400', fontSize: '12px', fontStyle: 'normal' },
  },
  BOLD: {
    label: 'BOLD',
    style: { fontWeight: '900', fontSize: '13px' },
  },
  CAPTION: {
    label: 'CAPTION',
    style: {
      fontWeight: '700', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase',
    },
  },
}

/** Jeu d'extensions unique — édition ET rendu statique (export). */
export function slideExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      codeBlock: false,
      code: false,
      horizontalRule: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      strike: false,
      dropcursor: false,
      gapcursor: false,
    }),
    // NB : StarterKit v3 fournit déjà Underline — ne pas le redoubler.
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['paragraph'] }),
    MilitantUnderline,
    LassezHighlight,
  ]
}

/** Rendu JSON → HTML (export PNG, miniatures) avec les mêmes extensions. */
export function renderDocToHtml(doc: Record<string, unknown> | null | undefined): string {
  if (!doc || typeof doc !== 'object') return ''
  try {
    return generateHTML(doc as JSONContent, slideExtensions())
  } catch {
    return ''
  }
}

interface InlineMark {
  type: string
  attrs?: Record<string, unknown>
}

function normalizeColor(value: string | null): string | null {
  if (!value) return null
  const v = value.replace(/\s/g, '').toLowerCase()
  if (v === 'rgb(220,38,38)' || v === '#dc2626') return '#DC2626'
  if (v === 'rgb(0,0,0)' || v === '#000' || v === '#000000') return '#000000'
  if (v === 'rgb(255,255,255)' || v === '#fff' || v === '#ffffff') return '#ffffff'
  return value
}

/**
 * Convertit le HTML legacy (innerHTML des anciens EditZone : <br/>, spans
 * stylés, b/i/u) en document Tiptap. Utilisé pour les defaults (INFO.body…)
 * et l'import de decks V1.
 */
export function htmlToTiptapDoc(html: string): Record<string, unknown> {
  const empty: Record<string, unknown> = { type: 'doc', content: [{ type: 'paragraph' }] }
  if (!html || typeof html !== 'string') return empty
  const parser = new DOMParser()
  const parsed = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = parsed.body.firstElementChild
  if (!root) return empty

  const BLOCKS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'])
  const paragraphs: { type: string; content?: unknown[]; attrs?: Record<string, unknown> }[] = []
  let current: { type: string; content: unknown[] } | null = null

  const pushText = (text: string, marks: InlineMark[]) => {
    if (!text) return
    if (!current) {
      current = { type: 'paragraph', content: [] }
      paragraphs.push(current)
    }
    current.content.push(marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text })
  }

  const inlineMarksFor = (el: Element, parent: InlineMark[]): InlineMark[] => {
    const marks = [...parent]
    const tag = el.tagName
    const style = (el as HTMLElement).style
    if (tag === 'STRONG' || tag === 'B') marks.push({ type: 'bold' })
    if (tag === 'EM' || tag === 'I') marks.push({ type: 'italic' })
    if (tag === 'U') marks.push({ type: 'underline' })
    if (el.hasAttribute('data-militant-underline')) marks.push({ type: 'militantUnderline' })
    if (el.hasAttribute('data-lassez-highlight')) {
      marks.push({
        type: 'lassezHighlight',
        attrs: { color: el.getAttribute('data-lassez-highlight') ?? '#DC2626' },
      })
    }
    const deco = style?.textDecoration ?? ''
    const decoColor = normalizeColor(style?.textDecorationColor ?? null)
    if (deco.includes('underline') && decoColor === '#DC2626' && !marks.some((m) => m.type === 'militantUnderline')) {
      marks.push({ type: 'militantUnderline' })
    } else if (deco.includes('underline') && !marks.some((m) => m.type === 'underline')) {
      marks.push({ type: 'underline' })
    }
    const bg = normalizeColor(style?.backgroundColor ?? null)
    if (bg === '#DC2626' || bg === '#000000') {
      marks.push({ type: 'lassezHighlight', attrs: { color: bg } })
    } else if (bg && !marks.some((m) => m.type === 'highlight')) {
      marks.push({ type: 'highlight', attrs: { color: bg } })
    }
    const color = style?.color
    if (color) marks.push({ type: 'textStyle', attrs: { color } })
    const fontSize = style?.fontSize
    if (fontSize) {
      const existing = marks.find((m) => m.type === 'textStyle')
      if (existing) existing.attrs = { ...(existing.attrs ?? {}), fontSize }
      else marks.push({ type: 'textStyle', attrs: { fontSize } })
    }
    return marks
  }

  const walk = (node: Node, marks: InlineMark[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent ?? '', marks)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    if (el.tagName === 'BR') {
      if (!current) {
        current = { type: 'paragraph', content: [] }
        paragraphs.push(current)
      }
      current.content.push({ type: 'hardBreak' })
      return
    }
    // Les spans "block" du legacy (OUTRO) valent des paragraphes.
    const isBlock = BLOCKS.has(el.tagName) || (el.tagName === 'SPAN' && el.className.includes('block'))
    if (isBlock) current = null
    const childMarks = inlineMarksFor(el, marks)
    for (const child of Array.from(el.childNodes)) walk(child, childMarks)
    if (isBlock) current = null
  }

  for (const child of Array.from(root.childNodes)) walk(child, [])
  if (paragraphs.length === 0) return empty
  return { type: 'doc', content: paragraphs }
}

/** Texte brut d'un doc (titres de slides, recherche, pipeline). */
export function docToPlainText(doc: Record<string, unknown> | null | undefined): string {
  if (!doc || typeof doc !== 'object') return ''
  const chunks: string[] = []
  const walk = (node: Record<string, unknown>) => {
    if (typeof node.text === 'string') chunks.push(node.text)
    const content = node.content as Record<string, unknown>[] | undefined
    if (Array.isArray(content)) {
      for (const child of content) {
        const before = chunks.length
        walk(child)
        if (child.type === 'paragraph' && chunks.length > before) chunks.push('\n')
        if (child.type === 'hardBreak') chunks.push('\n')
      }
    }
  }
  walk(doc)
  return chunks.join('').replace(/\n{3,}/g, '\n\n').trim()
}

export function isEmptyDoc(doc: Record<string, unknown> | null | undefined): boolean {
  return docToPlainText(doc) === ''
}

/**
 * Nettoie les mises en forme d'un templateState (bouton "Nettoyer styles") :
 * docs → texte brut conservé, marques supprimées ; strings HTML → texte brut.
 */
export function stripMarksFromState(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(state)) {
    if (value !== null && typeof value === 'object' && (value as Record<string, unknown>).type === 'doc') {
      const text = docToPlainText(value as Record<string, unknown>)
      out[key] = {
        type: 'doc',
        content: text
          ? [{ type: 'paragraph', content: [{ type: 'text', text }] }]
          : [{ type: 'paragraph' }],
      }
    } else if (typeof value === 'string') {
      out[key] = value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
    } else {
      out[key] = value
    }
  }
  return out
}
