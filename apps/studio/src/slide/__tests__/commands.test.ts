// Tests commands : vrais Editors Tiptap sous jsdom (sélections simulées).
import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/vue-3'
import { TextSelection } from '@tiptap/pm/state'
import { slideExtensions } from '../text/tiptap'
import {
  applyTextPreset,
  selectionFontSize,
  stepFontSize,
  toggleLassezHighlight,
} from '../text/commands'
import { htmlToTiptapDoc } from '../text/tiptap'

let editors: Editor[] = []

function makeEditor(html: string): Editor {
  const ed = new Editor({
    content: htmlToTiptapDoc(html),
    extensions: slideExtensions(),
  })
  editors.push(ed)
  return ed
}

function selectAll(ed: Editor) {
  const { state } = ed
  ed.view.dispatch(
    state.tr.setSelection(TextSelection.create(state.doc, 0, state.doc.content.size)),
  )
}

afterEach(() => {
  for (const ed of editors) {
    try {
      ed.destroy()
    } catch {
      /* déjà détruit */
    }
  }
  editors = []
  document.body.innerHTML = ''
})

describe('applyTextPreset', () => {
  it('applique le style HEADING à la sélection', () => {
    const ed = makeEditor('Bonjour')
    // Sans sélection : no-op
    expect(applyTextPreset(ed, 'HEADING')).toBe(false)
    selectAll(ed)
    expect(applyTextPreset(ed, 'HEADING')).toBe(true)
    expect(ed.isActive('textStyle')).toBe(true)
    const attrs = ed.getAttributes('textStyle')
    expect(attrs.fontWeight).toBe('900')
    expect(attrs.textTransform).toBe('uppercase')
  })

  it('CAPTION pose le tracking militant', () => {
    const ed = makeEditor('Légende')
    selectAll(ed)
    applyTextPreset(ed, 'CAPTION')
    expect(ed.getAttributes('textStyle').letterSpacing).toBe('0.15em')
  })
})

describe('toggleLassezHighlight', () => {
  it('pose fond + texte blanc, re-clic retire', () => {
    const ed = makeEditor('60% des promesses')
    selectAll(ed)
    expect(toggleLassezHighlight(ed, '#DC2626')).toBe(true)
    expect(ed.isActive('lassezHighlight', { color: '#DC2626' })).toBe(true)
    expect(toggleLassezHighlight(ed, '#DC2626')).toBe(true)
    expect(ed.isActive('lassezHighlight')).toBe(false)
  })

  it('couleur custom (noir)', () => {
    const ed = makeEditor('audit')
    selectAll(ed)
    toggleLassezHighlight(ed, '#000000')
    expect(ed.isActive('lassezHighlight', { color: '#000000' })).toBe(true)
  })
})

describe('selectionFontSize / stepFontSize', () => {
  it('défaut 16px sans marque', () => {
    const ed = makeEditor('Texte')
    expect(selectionFontSize(ed)).toBe(16)
  })

  it('lit la marque existante', () => {
    const ed = makeEditor('<span style="font-size: 42px;">Grand</span>')
    selectAll(ed)
    // La marque est parsée par TextStyle au chargement
    expect(ed.isActive('textStyle')).toBe(true)
    expect(selectionFontSize(ed)).toBe(42)
  })

  it('A+ / A- ajustent par pas, sans sélection = no-op', () => {
    const ed = makeEditor('Texte')
    expect(stepFontSize(ed, 2)).toBe(false)
    selectAll(ed)
    expect(stepFontSize(ed, 4)).toBe(true)
    expect(selectionFontSize(ed)).toBe(20)
    stepFontSize(ed, -6)
    expect(selectionFontSize(ed)).toBe(14)
  })

  it('borné par le brand kit', () => {
    const ed = makeEditor('<span style="font-size: 399px;">Max</span>')
    selectAll(ed)
    stepFontSize(ed, 50)
    expect(selectionFontSize(ed)).toBe(400)
  })
})
