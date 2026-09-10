// Marques Tiptap custom — identité Lassez (remplace le bricolage
// `document.execCommand` + spans inline du legacy BrutToolbar).
import { Mark, mergeAttributes } from '@tiptap/core'

export const MILITANT_RED = '#DC2626'

/** Souligné militant : U rouge épais (legacy : wrap textDecoration #DC2626 4px). */
export const MilitantUnderline = Mark.create({
  name: 'militantUnderline',

  parseHTML() {
    return [{ tag: 'span[data-militant-underline]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-militant-underline': '',
        style:
          'text-decoration: underline; text-decoration-color: #DC2626;' +
          ' text-decoration-thickness: 4px; text-underline-offset: 3px;',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      toggleMilitantUnderline:
        () =>
        ({ commands }: MarkCommandContext) => {
          return commands.toggleMark(this.name)
        },
    } as never
  },
})

/** Surligné Lassez : fond rouge/noir + texte blanc (legacy : toggleHighlight). */
export const LassezHighlight = Mark.create({
  name: 'lassezHighlight',

  addAttributes() {
    return {
      color: {
        default: MILITANT_RED,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-lassez-highlight') ?? MILITANT_RED,
        renderHTML: (attrs) => ({ 'data-lassez-highlight': attrs.color as string }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-lassez-highlight]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const color = (HTMLAttributes['data-lassez-highlight'] as string | undefined) ?? MILITANT_RED
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        style: `background-color: ${color}; color: #fff; padding: 0 3px;`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      toggleLassezHighlight:
        (color: string = MILITANT_RED) =>
        ({ commands }: MarkCommandContext) => {
          return commands.toggleMark(this.name, { color })
        },
    } as never
  },
})

// Contexte minimal typé pour les commandes custom (évite les `any` implicites).
export interface MarkCommandContext {
  commands: {
    toggleMark: (name: string, attrs?: Record<string, unknown>) => boolean
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    militantUnderline: {
      toggleMilitantUnderline: () => ReturnType
    }
    lassezHighlight: {
      toggleLassezHighlight: (color?: string) => ReturnType
    }
  }
}
