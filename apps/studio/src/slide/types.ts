// Slide — modèle de données socle (transposition Vue du legacy .reference).
// Le legacy stockait un `state` plat par template ; ici chaque slide porte en
// plus des couches libres (layers) insérables à n'importe quel z — c'est ce
// qui donne le feeling Photoshop/Canva (assets derrière/devant le template).

export type SlideType =
  | 'COVER' | 'NEWS' | 'VERSUS' | 'BIG_NUM' | 'IMPACT_QUOTE' | 'INFO' | 'OUTRO'
  // Réserve V2 — ids legacy connus, non implémentés en V1 mais typés pour
  // que le registre et les imports JSON restent compatibles.
  | 'MANIFESTO' | 'MAXTEXT' | 'GRANULAR' | 'CHECKLIST' | 'ANALYSIS'
  | 'COMPARISON_CHART' | 'STACKED_DATA' | 'VOTE_TRACKER' | 'TERRITORY_RADAR'
  | 'DECODING' | 'CHRONO_LOCK' | 'SOCIAL_COST' | 'VIDEO_NOTE'

export const CORE_SLIDE_TYPES: SlideType[] = [
  'COVER', 'NEWS', 'VERSUS', 'BIG_NUM', 'IMPACT_QUOTE', 'INFO', 'OUTRO',
]

export type FieldType =
  | 'text' | 'longtext' | 'color' | 'image' | 'number' | 'select' | 'boolean' | 'list'

export interface TemplateFieldOption {
  label: string
  value: string | number | boolean
}

export interface TemplateField {
  key: string
  label: string
  type: FieldType
  group?: string
  options?: TemplateFieldOption[]
  itemSchema?: TemplateField[]
  props?: {
    min?: number
    max?: number
    step?: number
    hideSlider?: boolean
    color?: string
    variant?: 'compact' | 'default'
    placeholder?: string
  }
}

export interface TemplateMeta {
  id: SlideType
  name: string
  description?: string
  category?: string
  icon?: string
  defaultState: Record<string, unknown>
  schema: TemplateField[] | ((state: Record<string, unknown>) => TemplateField[])
}

// ── Couches libres ──────────────────────────────────────────────

export type LayerKind = 'text' | 'image' | 'shape'

export interface TextLayerData {
  /** Document Tiptap (JSON) — jamais du HTML brut. */
  doc: Record<string, unknown>
  /** Habillage par défaut quand un nœud ne porte pas sa propre marque. */
  color?: string
  fontFamily?: string
  align?: 'left' | 'center' | 'right' | 'justify'
}

export interface ImageLayerData {
  src: string
  zoom?: number
  grayscale?: number
  opacity?: number
  fit?: 'cover' | 'contain'
}

export interface ShapeLayerData {
  shape: 'rect' | 'ellipse' | 'line' | 'arrow'
  fill?: string
  stroke?: string
  strokeWidth?: number
}

export type LayerData = TextLayerData | ImageLayerData | ShapeLayerData

export interface Layer {
  id: string
  kind: LayerKind
  name: string
  visible: boolean
  locked: boolean
  /**
   * Plan d'empilement : `true` = derrière le template (asset de fond),
   * `false` = devant. Le z n'ordonne qu'à l'intérieur d'un même plan.
   */
  behind: boolean
  /** Position en px dans le référentiel du slide (taille réelle du format). */
  x: number
  y: number
  w: number
  h: number
  rotation: number
  opacity: number
  /** Ordre d'empilement dans son plan — 1 = tout en bas du plan. */
  z: number
  data: LayerData
}

// ── Slide / Deck ────────────────────────────────────────────────

export interface Slide {
  id: string
  type: SlideType
  label: string
  format: FormatId
  /** Champs du template (même forme que le legacy `state`). */
  templateState: Record<string, unknown>
  layers: Layer[]
}

export interface DeckDoc {
  version: 2
  /** Format par défaut appliqué aux nouvelles slides. */
  format: FormatId
  slides: Slide[]
  activeId: string
}

// ── Formats (multi-format dès V1) ───────────────────────────────

export type FormatId = '4:5' | '1:1' | '9:16' | '16:9'

export interface SlideFormat {
  id: FormatId
  label: string
  /** Dimensions d'export en px. */
  width: number
  height: number
}
