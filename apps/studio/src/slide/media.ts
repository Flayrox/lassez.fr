// Médias : URLs sûres (proxy anti-CORS, port du legacy getSafeImageUrl) +
// pré-chargement et embedding pour l'export PNG.
export const MEDIA_PROXY_PATH = '/api/media/proxy'
const LEGACY_PROXY_PATH = '/api/proxy-image'

export function isInlineUrl(url: string): boolean {
  return (
    url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/uploads/')
  )
}

export function proxyUrl(url: string, base: string = MEDIA_PROXY_PATH): string {
  return `${base}?url=${encodeURIComponent(url)}`
}

/**
 * Rend une URL d'image chargeable dans le canvas : data/blob/local telles
 * quelles, même origine telles quelles, externes via le proxy daemon.
 */
export function getSafeImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (isInlineUrl(trimmed)) return trimmed
  if (trimmed.startsWith('http')) {
    if (trimmed.includes(`${MEDIA_PROXY_PATH}?url=`)) return trimmed
    if (trimmed.includes(`${LEGACY_PROXY_PATH}?url=`)) return trimmed
    if (typeof window !== 'undefined') {
      try {
        const parsed = new URL(trimmed)
        if (parsed.origin === window.location.origin) return trimmed
      } catch {
        return trimmed
      }
    }
    return proxyUrl(trimmed)
  }
  return trimmed
}

export function preloadImage(src: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = getSafeImageUrl(src)
    if (!url) {
      reject(new Error('URL vide'))
      return
    }
    const img = new Image()
    img.decoding = 'async'
    img.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => {
      img.src = ''
      reject(new Error(`Timeout chargement image (${timeoutMs}ms)`))
    }, timeoutMs)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve()
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error(`Image illisible : ${src}`))
    }
    img.src = url
  })
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Lecture blob impossible'))
    reader.readAsDataURL(blob)
  })
}

async function waitForImage(img: HTMLImageElement, timeoutMs = 2500): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return
  await new Promise<void>((resolve) => {
    const done = () => resolve()
    img.onload = done
    img.onerror = done
    window.setTimeout(done, timeoutMs)
  })
}

/**
 * Remplace les <img> externes du nœud d'export par des dataURL (via proxy),
 * avec repli gracieux : une image qui échoue garde sa src d'origine plutôt
 * que de faire échouer tout l'export.
 */
export async function embedImagesForExport(root: HTMLElement): Promise<{
  embedded: number
  skipped: number
}> {
  let embedded = 0
  let skipped = 0
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || img.src
      if (!src || isInlineUrl(src)) return
      if (typeof window !== 'undefined') {
        try {
          if (src.startsWith('/') || src.startsWith(window.location.origin)) return
        } catch {
          /* compare impossible → on tente le proxy */
        }
      }
      try {
        const res = await fetch(proxyUrl(src))
        if (!res.ok) throw new Error(`Proxy ${res.status}`)
        const dataUrl = await blobToDataUrl(await res.blob())
        img.setAttribute('src', dataUrl)
        img.src = dataUrl
        await waitForImage(img)
        embedded += 1
      } catch {
        skipped += 1
      }
    }),
  )
  return { embedded, skipped }
}
