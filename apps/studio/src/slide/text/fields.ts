// Pont entre les champs template (strings HTML legacy ou docs Tiptap) et
// les composants : normalise à la lecture, écrit toujours des docs.
import { docToPlainText, htmlToTiptapDoc, isEmptyDoc } from './tiptap'

export function isDocValue(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).type === 'doc'
  )
}

/** Doc éditable pour un champ template (string HTML legacy, doc, ou vide). */
export function fieldDoc(
  state: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = state[key]
  if (isDocValue(value)) return value
  if (typeof value === 'string') return htmlToTiptapDoc(value)
  return htmlToTiptapDoc('')
}

/** Texte brut d'un champ (pipeline, recherche, noms de fichiers). */
export function fieldText(state: Record<string, unknown>, key: string): string {
  const value = state[key]
  if (isDocValue(value)) return docToPlainText(value)
  if (typeof value === 'string') {
    return value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export function isFieldEmpty(state: Record<string, unknown>, key: string): boolean {
  const value = state[key]
  if (isDocValue(value)) return isEmptyDoc(value)
  if (typeof value === 'string') return value.trim() === ''
  return value === undefined || value === null
}
