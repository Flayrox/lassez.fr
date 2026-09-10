// Export PNG / ZIP / JSON — port du useStudioExport legacy (html-to-image
// + jszip), adapté aux couches : on masque l'UI d'édition pendant la capture
// puis on restaure, même en cas d'échec.
import JSZip from 'jszip'
import { toPng } from 'html-to-image'
import { embedImagesForExport } from './media'
import { slugifyFileName } from './utils'

/** Sélecteurs d'UI d'édition à masquer pendant la capture. */
export const EXPORT_HIDDEN_SELECTORS = [
  '.export-hide',
  '.slide-edit-sticker',
  '.slide-selection',
  '.slide-tb',
] as const

export interface PngOptions {
  width: number
  height: number
  pixelRatio?: number
}

function hiddenStyle(el: HTMLElement): string | null {
  return el.style.display || null
}

/** Masque l'UI, retourne une fonction de restauration. */
export function hideEditingUI(root: HTMLElement): () => void {
  const touched: { el: HTMLElement; prev: string | null }[] = []
  const selector = EXPORT_HIDDEN_SELECTORS.join(',')
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
    touched.push({ el, prev: hiddenStyle(el) })
    el.style.display = 'none'
  }
  return () => {
    for (const { el, prev } of touched) {
      if (prev === null) el.style.removeProperty('display')
      else el.style.display = prev
    }
  }
}

/** Capture PNG du stage à taille réelle d'export. */
export async function renderStagePNG(stage: HTMLElement, opts: PngOptions): Promise<string> {
  await embedImagesForExport(stage)
  const restore = hideEditingUI(stage)
  try {
    if (typeof document !== 'undefined' && document.fonts) {
      try {
        await document.fonts.ready
      } catch {
        /* polices optionnelles */
      }
    }
    await new Promise((r) => window.setTimeout(r, 120))
    return await toPng(stage, {
      quality: 1,
      pixelRatio: opts.pixelRatio ?? 2,
      canvasWidth: opts.width,
      canvasHeight: opts.height,
      cacheBust: true,
      style: { margin: '0', transform: 'none' },
    })
  } finally {
    restore()
  }
}

export function downloadDataUrl(dataUrl: string, filename: string): boolean {
  try {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    return true
  } catch {
    return false
  }
}

export function downloadBlob(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob)
    const ok = downloadDataUrl(url, filename)
    window.setTimeout(() => URL.revokeObjectURL(url), 5000)
    return ok
  } catch {
    return false
  }
}

/** `Slide 1 — Cover` + index → `slide-01-cover.png`. */
export function slideFileName(label: string, index: number, ext = 'png'): string {
  const num = String(index + 1).padStart(2, '0')
  return `slide-${num}-${slugifyFileName(label)}.${ext}`
}

export function deckFileName(prefix: string, ext: string): string {
  return `lassez-${prefix}-${Date.now()}.${ext}`
}

/** ZIP d'un deck à partir de dataURLs déjà rendues. */
export async function buildDeckZip(entries: { name: string; dataUrl: string }[]): Promise<Blob> {
  const zip = new JSZip()
  for (const { name, dataUrl } of entries) {
    const base64 = dataUrl.split(',')[1]
    if (!base64) continue
    zip.file(name, base64, { base64: true })
  }
  return zip.generateAsync({ type: 'blob' })
}
