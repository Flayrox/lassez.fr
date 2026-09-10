// Tests moteur texte : conversion HTML legacy, rendu, texte brut.
import { describe, expect, it } from 'vitest'
import {
  docToPlainText,
  htmlToTiptapDoc,
  isEmptyDoc,
  renderDocToHtml,
  slideExtensions,
} from '../text/tiptap'

describe('htmlToTiptapDoc', () => {
  it('convertit le texte simple en un paragraphe', () => {
    const doc = htmlToTiptapDoc('Bonjour le monde') as unknown as {
      type: string
      content: { type: string; content: { text: string }[] }[]
    }
    expect(doc.type).toBe('doc')
    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].content[0].text).toBe('Bonjour le monde')
  })

  it('convertit les <br/> en hardBreak dans le même paragraphe', () => {
    const doc = htmlToTiptapDoc('Ligne 1<br/>Ligne 2<br>Ligne 3') as {
      content: { content: unknown[] }[]
    }
    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].content.filter((n) => (n as { type: string }).type === 'hardBreak')).toHaveLength(2)
  })

  it('convertit b/i/u en marques', () => {
    const doc = htmlToTiptapDoc('<strong>Gras</strong> et <em>italique</em> et <u>souligné</u>') as {
      content: { content: { text: string; marks?: { type: string }[] }[] }[]
    }
    const texts = doc.content[0].content
    expect(texts[0].marks).toContainEqual({ type: 'bold' })
    expect(texts.find((t) => t.text === 'italique')!.marks).toContainEqual({ type: 'italic' })
    expect(texts.find((t) => t.text === 'souligné')!.marks).toContainEqual({ type: 'underline' })
  })

  it('convertit le span surligné rouge legacy en lassezHighlight', () => {
    const doc = htmlToTiptapDoc(
      'plus de <span style="background:#000;color:#fff;padding:0 4px;font-weight:700">60% des promesses</span> sont restées',
    ) as { content: { content: { text: string; marks?: { type: string; attrs?: { color: string } }[] }[] }[] }
    const target = doc.content[0].content.find((t) => t.text.includes('60%'))
    expect(target!.marks).toContainEqual({ type: 'lassezHighlight', attrs: { color: '#000000' } })
  })

  it('convertit le souligné militant legacy en marque dédiée', () => {
    const doc = htmlToTiptapDoc(
      '<span style="text-decoration:underline;text-decoration-color:#DC2626;text-decoration-thickness:4px">le système</span>',
    ) as { content: { content: { marks?: { type: string }[] }[] }[] }
    expect(doc.content[0].content[0].marks).toContainEqual({ type: 'militantUnderline' })
  })

  it('sépare les blocs P/DIV et les spans block (OUTRO)', () => {
    const doc = htmlToTiptapDoc('<p>Un</p><p>Deux</p>') as { content: unknown[] }
    expect(doc.content).toHaveLength(2)
    const outro = htmlToTiptapDoc('<span class="block relative">A</span><span class="block ml-12">B</span>') as {
      content: unknown[]
    }
    expect(outro.content).toHaveLength(2)
  })

  it('gère le HTML réel du default INFO.body', () => {
    const body = `L'audit confirme que plus de <span style="background:#000;color:#fff;padding:0 4px;text-decoration:underline;text-decoration-color:#DC2626;text-decoration-thickness:3px;font-weight:700">60% des promesses</span> sont restées lettre morte.`
    const text = docToPlainText(htmlToTiptapDoc(body))
    expect(text).toContain('60% des promesses')
    expect(text).toContain('lettre morte')
  })

  it('retourne un doc vide sur entrée vide/invalide', () => {
    expect(isEmptyDoc(htmlToTiptapDoc(''))).toBe(true)
    expect(isEmptyDoc(htmlToTiptapDoc(null as unknown as string))).toBe(true)
    expect(isEmptyDoc(null)).toBe(true)
    expect(isEmptyDoc(undefined)).toBe(true)
  })
})

describe('docToPlainText / isEmptyDoc', () => {
  it('extrait le texte en ignorant les marques', () => {
    const doc = htmlToTiptapDoc('<strong>Salut</strong><br/>les <em>amis</em>')
    expect(docToPlainText(doc)).toBe('Salut\nles amis')
  })

  it('détecte les docs vides (paragraphes sans texte)', () => {
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true)
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph', content: [] }] })).toBe(true)
    expect(isEmptyDoc(htmlToTiptapDoc('Hello'))).toBe(false)
  })
})

describe('renderDocToHtml', () => {
  it('rend les marques premium en HTML exportable', () => {
    const html = renderDocToHtml(htmlToTiptapDoc('<strong>Gras</strong> et <u>U</u>'))
    expect(html).toContain('<strong>Gras</strong>')
    expect(html).toContain('<u>U</u>')
  })

  it('rend militantUnderline + lassezHighlight avec data-attrs stables', () => {
    const html = renderDocToHtml(
      htmlToTiptapDoc(
        '<span style="background:#000;color:#fff">X</span><span style="text-decoration:underline;text-decoration-color:#DC2626">Y</span>',
      ),
    )
    expect(html).toContain('data-lassez-highlight')
    expect(html).toContain('data-militant-underline')
  })

  it('retourne "" sur doc invalide sans throw', () => {
    expect(renderDocToHtml(null)).toBe('')
    expect(renderDocToHtml(undefined)).toBe('')
    expect(renderDocToHtml({ type: 'nope' })).toBe('')
  })
})

describe('slideExtensions', () => {
  it('fournit un jeu unique incluant les marques Lassez', () => {
    const names = slideExtensions().map((e) => e.name)
    expect(names).toContain('militantUnderline')
    expect(names).toContain('lassezHighlight')
    expect(names).toContain('textAlign')
    // underline + bold/italic viennent du StarterKit (vérifiés par round-trip <u>/<strong>)
    expect(names).not.toContain('heading')
    expect(names).not.toContain('bulletList')
    expect(names).not.toContain('codeBlock')
  })
})
