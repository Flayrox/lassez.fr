// Géométrie pure du moteur (testable sans DOM) : resize par poignées,
// snapping sur les guides du stage.
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface ResizeOptions {
  min?: number
  keepAspect?: boolean
}

/** dx/dy exprimés en px du référentiel du slide (déjà divisés par le zoom). */
export function resizeRect(rect: Rect, handle: ResizeHandle, dx: number, dy: number, opts: ResizeOptions = {}): Rect {
  const min = opts.min ?? 20
  let { x, y, w, h } = rect

  if (handle.includes('e')) w += dx
  if (handle.includes('s')) h += dy
  if (handle.includes('w')) {
    x += dx
    w -= dx
  }
  if (handle.includes('n')) {
    y += dy
    h -= dy
  }

  if (opts.keepAspect) {
    const aspect = rect.w / Math.max(1, rect.h)
    // L'axe dominant pilote, l'autre suit le ratio.
    if (handle === 'e' || handle === 'w') {
      h = w / aspect
      if (handle.includes('n')) y = rect.y + (rect.h - h)
    } else if (handle === 's' || handle === 'n') {
      w = h * aspect
      if (handle.includes('w')) x = rect.x + (rect.w - w)
    } else {
      // Coins : l'axe le plus étiré pilote.
      const dw = Math.abs(w - rect.w)
      const dh = Math.abs(h - rect.h)
      if (dw >= dh) {
        h = w / aspect
        if (handle.includes('n')) y = rect.y + (rect.h - h)
      } else {
        w = h * aspect
        if (handle.includes('w')) x = rect.x + (rect.w - w)
      }
    }
  }

  // Taille mini : on re-ancre le côté fixe.
  if (w < min) {
    if (handle.includes('w')) x -= min - w
    w = min
  }
  if (h < min) {
    if (handle.includes('n')) y -= min - h
    h = min
  }

  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    w: Math.round(w * 100) / 100,
    h: Math.round(h * 100) / 100,
  }
}

export type Guide = 'v-left' | 'v-center' | 'v-right' | 'h-top' | 'h-middle' | 'h-bottom'

/**
 * Snap magnétique : les bords/centre de la couche s'alignent sur les
 * bords/centre du stage quand ils s'en approchent (seuil en px slide).
 */
export function snapToGuides(
  x: number,
  y: number,
  w: number,
  h: number,
  stageW: number,
  stageH: number,
  threshold = 5,
): { x: number; y: number; guides: Guide[] } {
  const guides: Guide[] = []
  // Candidats X : bord gauche→gauche, centre→centre, bord droit→droite.
  const cx = stageW / 2 - w / 2
  const rx = stageW - w
  if (Math.abs(x - 0) <= threshold) {
    x = 0
    guides.push('v-left')
  } else if (Math.abs(x - cx) <= threshold) {
    x = cx
    guides.push('v-center')
  } else if (Math.abs(x - rx) <= threshold) {
    x = rx
    guides.push('v-right')
  }
  // Candidats Y : haut→haut, milieu→milieu, bas→bas.
  const cy = stageH / 2 - h / 2
  const by = stageH - h
  if (Math.abs(y - 0) <= threshold) {
    y = 0
    guides.push('h-top')
  } else if (Math.abs(y - cy) <= threshold) {
    y = cy
    guides.push('h-middle')
  } else if (Math.abs(y - by) <= threshold) {
    y = by
    guides.push('h-bottom')
  }
  return { x, y, guides }
}
