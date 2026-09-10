// Bibliothèque d'assets : images importées, persistées en IndexedDB
// (navigateur) avec repli mémoire (tests/jsdom, quota dépassé).
// Tous les imports passent par `prepareImageFile` : redimensionnement à
// 2048px max + WebP — sans ça, une photo 8Mo restait 8Mo dans IndexedDB et
// les objectURL des champs template mouraient au reload (perte de données).
export interface Asset {
  id: string
  name: string
  url: string
  width?: number
  height?: number
  createdAt: number
}

/** Clé d'injection Vue du store (fourni par Slide.vue). */
export const ASSETS_KEY = 'slide-assets'

/** Plus grande dimension conservée à l'import (comme Canva : 2048px). */
export const MAX_IMPORT_DIM = 2048
/** Sous ce poids, les PNG sont gardés tels quels (logos, alpha). */
export const PNG_PASSTHROUGH_BYTES = 1_500_000

/** Nouvelles dimensions en conservant le ratio, plafonnées à `max`. Pure. */
export function fitDims(w: number, h: number, max: number = MAX_IMPORT_DIM): { w: number; h: number } {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return { w: 0, h: 0 }
  if (Math.max(w, h) <= max) return { w: Math.round(w), h: Math.round(h) }
  const ratio = max / Math.max(w, h)
  return { w: Math.max(1, Math.round(w * ratio)), h: Math.max(1, Math.round(h * ratio)) }
}

function canvas2d(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  try {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    return { canvas, ctx }
  } catch {
    return null
  }
}

function loadBitmap(file: Blob, timeoutMs = 8000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof URL?.createObjectURL !== 'function') {
      reject(new Error('images non supportées ici'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url)
      reject(new Error('timeout lecture image'))
    }, timeoutMs)
    img.onload = () => {
      window.clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      URL.revokeObjectURL(url)
      reject(new Error('image illisible'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality)
    } catch {
      resolve(null)
    }
  })
}

export interface PreparedImage {
  blob: Blob
  width?: number
  height?: number
}

/**
 * Prépare un fichier importé : dimensions lues, redimensionnement si > 2048px,
 * WebP 0.85 (garde l'alpha, contrairement au JPEG). Tout échec → original tel
 * quel : l'import ne doit jamais casser à cause de la compression.
 */
export async function prepareImageFile(file: Blob): Promise<PreparedImage> {
  const passthrough: PreparedImage = { blob: file }
  const smallPng = file.type === 'image/png' && file.size <= PNG_PASSTHROUGH_BYTES
  const g = canvas2d()
  if (!g) return passthrough
  let img: HTMLImageElement
  try {
    img = await loadBitmap(file)
  } catch {
    return passthrough
  }
  const natural = { w: img.naturalWidth || 0, h: img.naturalHeight || 0 }
  if (smallPng && Math.max(natural.w, natural.h) <= MAX_IMPORT_DIM) {
    return { blob: file, width: natural.w || undefined, height: natural.h || undefined }
  }
  const target = fitDims(natural.w, natural.h)
  if (target.w === 0) return passthrough
  g.canvas.width = target.w
  g.canvas.height = target.h
  g.ctx.drawImage(img, 0, 0, target.w, target.h)
  const webp = await canvasToBlob(g.canvas, 'image/webp', 0.85)
  if (webp && webp.size > 0) return { blob: webp, width: target.w, height: target.h }
  const png = await canvasToBlob(g.canvas, 'image/png')
  if (png && png.size > 0) return { blob: png, width: target.w, height: target.h }
  return { blob: file, width: natural.w || undefined, height: natural.h || undefined }
}

export interface AssetStore {
  list(): Promise<Asset[]>
  add(file: Blob, name: string, prepped?: PreparedImage): Promise<Asset>
  addUrl(url: string, name?: string): Promise<Asset>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

function makeUrl(id: string): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    // L'URL réelle est créée à partir du blob au moment de l'ajout.
    return `blob:pending-${id}`
  }
  return `asset:${id}`
}

function nid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** Store 100 % mémoire — tests, SSR, ou repli quand IndexedDB manque. */
export function createMemoryAssetStore(): AssetStore {
  const blobs = new Map<string, Blob>()
  const metas = new Map<string, Asset>()

  return {
    async list() {
      return [...metas.values()].sort((a, b) => b.createdAt - a.createdAt)
    },
    async add(file: Blob, name: string, prepped?: PreparedImage) {
      const id = nid()
      const prepared = prepped ?? (await prepareImageFile(file))
      blobs.set(id, prepared.blob)
      const asset: Asset = {
        id,
        name: name || `image-${id.slice(0, 6)}`,
        url: makeUrl(id),
        width: prepared.width,
        height: prepared.height,
        createdAt: Date.now(),
      }
      try {
        asset.url = URL.createObjectURL(prepared.blob)
      } catch {
        /* garde l'URL de repli */
      }
      metas.set(id, asset)
      return asset
    },
    async addUrl(url: string, name?: string) {
      const id = nid()
      const asset: Asset = {
        id,
        name: name ?? url.split('/').pop() ?? `image-${id.slice(0, 6)}`,
        url,
        createdAt: Date.now(),
      }
      metas.set(id, asset)
      return asset
    },
    async remove(id: string) {
      const asset = metas.get(id)
      if (asset?.url.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
        try {
          URL.revokeObjectURL(asset.url)
        } catch {
          /* déjà révoquée */
        }
      }
      metas.delete(id)
      blobs.delete(id)
    },
    async clear() {
      for (const id of [...metas.keys()]) await this.remove(id)
    },
  }
}

/**
 * Store persistant : métadonnées + blobs en IndexedDB via idb-keyval,
 * avec bascule automatique vers la mémoire si indisponible.
 */
export async function createAssetStore(): Promise<AssetStore> {
  if (typeof indexedDB === 'undefined') return createMemoryAssetStore()
  try {
    const { createStore, get, set, del, keys } = await import('idb-keyval')
    const store = createStore('lassez-slide', 'assets')
    const memory = createMemoryAssetStore()

    const readDims = (blob: Blob): Promise<{ width?: number; height?: number }> =>
      new Promise((resolve) => {
        if (typeof Image === 'undefined' || typeof URL?.createObjectURL !== 'function') {
          resolve({})
          return
        }
        const url = URL.createObjectURL(blob)
        const img = new Image()
        const done = (dims: { width?: number; height?: number }) => {
          URL.revokeObjectURL(url)
          resolve(dims)
        }
        img.onload = () => done({ width: img.naturalWidth || undefined, height: img.naturalHeight || undefined })
        img.onerror = () => done({})
        img.src = url
        window.setTimeout(() => done({}), 5000)
      })

    return {
      async list() {
        const all = await keys(store)
        const assets: Asset[] = []
        for (const k of all) {
          const entry = (await get(k, store)) as { meta: Asset; blob: Blob } | undefined
          if (!entry) continue
          // Recrée une URL de session à chaque lecture (les blob: ne survivent pas au reload).
          if (typeof URL?.createObjectURL === 'function') {
            try {
              entry.meta.url = URL.createObjectURL(entry.blob)
            } catch {
              /* garde l'URL stockée */
            }
          }
          assets.push(entry.meta)
        }
        return assets.sort((a, b) => b.createdAt - a.createdAt)
      },
      async add(file: Blob, name: string) {
        const prepared = await prepareImageFile(file)
        const base = await memory.add(prepared.blob, name, prepared)
        const dims =
          base.width !== undefined ? { width: base.width, height: base.height } : await readDims(prepared.blob)
        const asset: Asset = { ...base, ...dims }
        await set(`asset:${asset.id}`, { meta: asset, blob: prepared.blob }, store)
        return asset
      },
      async addUrl(url: string, name?: string) {
        const asset = await memory.addUrl(url, name)
        await set(`asset:${asset.id}`, { meta: asset, blob: null }, store)
        return asset
      },
      async remove(id: string) {
        await memory.remove(id)
        await del(`asset:${id}`, store)
      },
      async clear() {
        await memory.clear()
        for (const k of await keys(store)) await del(k, store)
      },
    }
  } catch {
    return createMemoryAssetStore()
  }
}
