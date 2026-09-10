// Tests pont champs-template : strings legacy, docs, types exotiques.
import { describe, expect, it } from 'vitest'
import { fieldDoc, fieldText, isDocValue, isFieldEmpty } from '../text/fields'
import { htmlToTiptapDoc } from '../text/tiptap'

describe('isDocValue', () => {
  it('détecte les docs Tiptap', () => {
    expect(isDocValue(htmlToTiptapDoc('x'))).toBe(true)
    expect(isDocValue({ type: 'paragraph' })).toBe(false)
    expect(isDocValue('<b>x</b>')).toBe(false)
    expect(isDocValue(null)).toBe(false)
    expect(isDocValue(42)).toBe(false)
  })
})

describe('fieldDoc', () => {
  it('parse les strings HTML legacy', () => {
    const doc = fieldDoc({ headline: 'A<br/>B' }, 'headline') as unknown as {
      type: string
      content: { content: unknown[] }[]
    }
    expect(doc.type).toBe('doc')
    expect(doc.content[0].content).toHaveLength(3) // texte, hardBreak, texte
  })

  it('laisse passer les docs tels quels (même référence)', () => {
    const doc = htmlToTiptapDoc('Hello')
    expect(fieldDoc({ body: doc }, 'body')).toBe(doc)
  })

  it('retourne un doc vide sur champ absent ou non-texte', () => {
    expect(fieldDoc({}, 'x')).toMatchObject({ type: 'doc' })
    expect(fieldDoc({ x: 42 }, 'x')).toMatchObject({ type: 'doc' })
    expect(fieldDoc({ x: null }, 'x')).toMatchObject({ type: 'doc' })
  })
})

describe('fieldText', () => {
  it('extrait le texte des docs', () => {
    expect(fieldText({ q: htmlToTiptapDoc('<strong>Salut</strong><br/>toi') }, 'q')).toBe('Salut\ntoi')
  })

  it('strip le HTML legacy', () => {
    expect(fieldText({ h: 'LE NOUVEAU<br/>PARADIGME' }, 'h')).toBe('LE NOUVEAU\nPARADIGME')
    expect(fieldText({ h: '<span style="color:red">X</span>' }, 'h')).toBe('X')
  })

  it('stringify les scalaires, "" sinon', () => {
    expect(fieldText({ n: '02' }, 'n')).toBe('02')
    expect(fieldText({ b: true }, 'b')).toBe('true')
    expect(fieldText({}, 'x')).toBe('')
    expect(fieldText({ x: null }, 'x')).toBe('')
  })
})

describe('isFieldEmpty', () => {
  it('détecte vide pour docs et strings', () => {
    expect(isFieldEmpty({ x: htmlToTiptapDoc('') }, 'x')).toBe(true)
    expect(isFieldEmpty({ x: '   ' }, 'x')).toBe(true)
    expect(isFieldEmpty({}, 'x')).toBe(true)
    expect(isFieldEmpty({ x: 'A' }, 'x')).toBe(false)
    expect(isFieldEmpty({ x: htmlToTiptapDoc('A') }, 'x')).toBe(false)
  })
})
