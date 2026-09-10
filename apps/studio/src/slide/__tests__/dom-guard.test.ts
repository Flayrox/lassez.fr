// Tests garde frappe : le pan Espace et les raccourcis ne volent jamais
// une frappe (non-régression : espaces avalés par preventDefault).
import { describe, expect, it } from 'vitest'
import { isTypingTarget } from '../engine/dom'

describe('isTypingTarget', () => {
  it('détecte inputs, textareas, selects', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('select'))).toBe(true)
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
    expect(isTypingTarget(document.body)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
    expect(isTypingTarget({} as EventTarget)).toBe(false)
  })

  it('détecte les descendants .tiptap (cas ProseMirror réel)', () => {
    const ed = document.createElement('div')
    ed.className = 'tiptap ProseMirror'
    document.body.appendChild(ed)
    const inner = document.createElement('span')
    ed.appendChild(inner)
    expect(isTypingTarget(inner)).toBe(true)
    expect(isTypingTarget(ed)).toBe(true)
    ed.remove()
  })
})
