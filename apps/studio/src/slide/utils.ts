// Utilitaires partagés du module Slide.
import type { Layer, LayerKind, Slide } from './types'

let counter = 0

/** Identifiant court unique (même esprit que le `nid()` legacy). */
export function nid(prefix = ''): string {
  counter += 1
  const rand = Math.random().toString(36).slice(2, 9)
  return `${prefix}${rand}${counter.toString(36)}`
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** Clone profond via structuredClone avec repli JSON. */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      /* repli JSON ci-dessous */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T
}

/** Prochain z disponible au-dessus des couches existantes. */
export function nextZ(layers: Pick<Layer, 'z'>[]): number {
  if (layers.length === 0) return 1
  return Math.max(...layers.map((l) => l.z)) + 1
}

/** Couches triées pour le rendu (z croissant, stables). */
export function sortLayers<T extends Pick<Layer, 'z'>>(layers: T[]): T[] {
  return [...layers].sort((a, b) => a.z - b.z)
}

/** Renumérote les z de 1..n en gardant l'ordre visuel. */
export function normalizeZ(layers: Layer[]): Layer[] {
  return sortLayers(layers).map((l, i) => ({ ...l, z: i + 1 }))
}

/**
 * Renumérote les z de 1..n EN PLACE (même ordre visuel, identités d'objets
 * conservées) — à préférer dans le store pour que les références retournées
 * (ex : `addTextLayer()`) restent réactives et vivantes.
 */
export function renumberZ(layers: Layer[]): void {
  sortLayers(layers).forEach((l, i) => {
    l.z = i + 1
  })
}

const LAYER_NAMES: Record<LayerKind, string> = {
  text: 'Texte',
  image: 'Image',
  shape: 'Forme',
}

export function defaultLayerName(kind: LayerKind, index: number): string {
  return `${LAYER_NAMES[kind]} ${index}`
}

/** Libellé de slide par défaut : "Slide 03 — Cover". */
export function defaultSlideLabel(index: number, templateName: string): string {
  return `Slide ${String(index).padStart(2, '0')} — ${templateName}`
}

export function findSlide(slides: Slide[], id: string): Slide | undefined {
  return slides.find((s) => s.id === id)
}

/**
 * Totaux sûrs pour l'export : nom de fichier sans caractères spéciaux.
 * Ex : "Slide 1 — Cover" → "slide-1-cover".
 */
export function slugifyFileName(label: string, fallback = 'slide'): string {
  const slug = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}
