// Setup global vitest : shim localStorage mémoire (jsdom sans origin
// n'en fournit pas) + rAF déjà présent sous jsdom.
if (typeof localStorage === 'undefined') {
  const map = new Map<string, string>()
  const shim: Storage = {
    get length() {
      return map.size
    },
    clear: () => void map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: shim,
    writable: true,
    configurable: true,
  })
}
