// Marques Tiptap custom — identité Lassez (remplace le bricolage
// `document.execCommand` + spans inline du legacy BrutToolbar).
import { Mark, mergeAttributes } from '@tiptap/core'
import { TextStyle } from '@tiptap/extension-text-style'

export const MILITANT_RED = '#DC2626'

/**
 * TextStyle étendu : la v3 ne déclare plus que quelques attributs
 * (taille/famille/interligne/couleur via sous-extensions) et JETTE
 * silencieusement les autres au setMark. On déclare graisse, style,
 * interlettrage et casse pour que les presets tiennent.
 */
export const ExtendedTextStyle = TextStyle.extend({
  name: 'textStyle',

  addAttributes() {
    return {
      ...this.parent?.(),
      fontWeight: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.fontWeight || null,
        renderHTML: (attrs) => {
          if (!attrs.fontWeight) return {}
          return { style: `font-weight: ${attrs.fontWeight as string}` }
        },
      },
      fontStyle: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.fontStyle || null,
        renderHTML: (attrs) => {
          if (!attrs.fontStyle) return {}
          return { style: `font-style: ${attrs.fontStyle as string}` }
        },
      },
      letterSpacing: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.letterSpacing || null,
        renderHTML: (attrs) => {
          if (!attrs.letterSpacing) return {}
          return { style: `letter-spacing: ${attrs.letterSpacing as string}` }
        },
      },
      textTransform: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.textTransform || null,
        renderHTML: (attrs) => {
          if (!attrs.textTransform) return {}
          return { style: `text-transform: ${attrs.textTransform as string}` }
        },
      },
    }
  },
})

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
