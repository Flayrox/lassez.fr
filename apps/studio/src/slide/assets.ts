// Bibliothèque d'assets : images importées, persistées en IndexedDB
// (navigateur) avec repli mémoire (tests/jsdom, quota dépassé).
export interface Asset {
  id: string
  name: string
  url: string
  width?: number
  height?: number
  createdAt: number
}

export interface AssetStore {
  list(): Promise<Asset[]>
  add(file: Blob, name: string): Promise<Asset>
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
    async add(file: Blob, name: string) {
      const id = nid()
      blobs.set(id, file)
      const asset: Asset = {
        id,
        name: name || `image-${id.slice(0, 6)}`,
        url: makeUrl(id),
        createdAt: Date.now(),
      }
      try {
        asset.url = URL.createObjectURL(file)
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
        const base = await memory.add(file, name)
        const dims = await readDims(file)
        const asset: Asset = { ...base, ...dims }
        await set(`asset:${asset.id}`, { meta: asset, blob: file }, store)
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
