// Formats d'export — multi-format dès V1 (le legacy ne faisait que 1080×1350).
import type { FormatId, SlideFormat } from './types'

export const FORMATS: Record<FormatId, SlideFormat> = {
  '4:5': { id: '4:5', label: 'Portrait 4:5', width: 1080, height: 1350 },
  '1:1': { id: '1:1', label: 'Carré 1:1', width: 1080, height: 1080 },
  '9:16': { id: '9:16', label: 'Story 9:16', width: 1080, height: 1920 },
  '16:9': { id: '16:9', label: 'Paysage 16:9', width: 1920, height: 1080 },
}

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[]

export const DEFAULT_FORMAT: FormatId = '4:5'

export function getFormat(id: FormatId): SlideFormat {
  return FORMATS[id] ?? FORMATS[DEFAULT_FORMAT]
}

/** Échelle pour inscrire le slide (w×h) dans un viewport (vw×vh). */
export function fitScale(
  w: number, h: number, vw: number, vh: number, padding = 48,
): number {
  if (w <= 0 || h <= 0 || vw <= 0 || vh <= 0) return 1
  return Math.min((vw - padding * 2) / w, (vh - padding * 2) / h)
}

/** Étapes de zoom discrètes (molette / +/-), bornées. */
export const ZOOM_STEPS = [
  0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4,
]

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 8

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

export function zoomIn(current: number): number {
  const next = ZOOM_STEPS.find((s) => s > current + 1e-9)
  return clampZoom(next ?? current * 1.25)
}

export function zoomOut(current: number): number {
  const prev = [...ZOOM_STEPS].reverse().find((s) => s < current - 1e-9)
  return clampZoom(prev ?? current / 1.25)
}
