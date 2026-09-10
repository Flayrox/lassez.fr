// Brand kit L'Assez — charte verrouillée du média : couleurs, polices,
// presets. Source unique pour les swatches (champs couleur), la typo des
// couches et la toolbar. Les templates gardent leur DA propre ; le kit
// garantit que tout ajout libre reste dans la charte.
export interface BrandColor {
  name: string
  value: string
}

export interface BrandFont {
  name: string
  /** Famille CSS (webfonts chargées dans slide.css). */
  family: string
  /** Graisses proposées dans l'UI. */
  weights: number[]
}

export const BRAND_RED = '#DC2626'

export const BRAND_COLORS: BrandColor[] = [
  { name: 'Rouge Lassez', value: '#DC2626' },
  { name: 'Rouge sombre', value: '#BC0100' },
  { name: 'Noir', value: '#000000' },
  { name: 'Encre', value: '#111111' },
  { name: 'Gris', value: '#71717A' },
  { name: 'Gris clair', value: '#E4E4E7' },
  { name: 'Blanc', value: '#FFFFFF' },
  { name: 'Papier', value: '#F3F4F6' },
]

export const BRAND_FONTS: BrandFont[] = [
  { name: 'Archivo Black', family: "'Archivo Black', sans-serif", weights: [400] },
  { name: 'Playfair Display', family: "'Playfair Display', serif", weights: [400, 700, 900] },
  { name: 'Inter', family: "'Inter', sans-serif", weights: [400, 500, 700, 900] },
  { name: 'Space Grotesk', family: "'Space Grotesk', sans-serif", weights: [400, 500, 700] },
  { name: 'Space Mono', family: "'Space Mono', monospace", weights: [400, 700] },
  { name: 'Anton', family: "'Anton', sans-serif", weights: [400] },
]

export const DEFAULT_TEXT_SIZE = 32
export const MIN_TEXT_SIZE = 8
export const MAX_TEXT_SIZE = 400

export function brandColorNames(): string[] {
  return BRAND_COLORS.map((c) => c.name)
}

export function findBrandFont(family: string | undefined): BrandFont | undefined {
  if (!family) return undefined
  const norm = family.toLowerCase()
  return BRAND_FONTS.find((f) => norm.includes(f.name.toLowerCase()))
}

export function clampTextSize(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_TEXT_SIZE
  return Math.min(MAX_TEXT_SIZE, Math.max(MIN_TEXT_SIZE, Math.round(px)))
}
