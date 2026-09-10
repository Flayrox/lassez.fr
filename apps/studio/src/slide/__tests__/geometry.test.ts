// Tests géométrie moteur : resize 8 poignées, ratio, mini, snap.
import { describe, expect, it } from 'vitest'
import { resizeRect, snapToGuides } from '../engine/geometry'

describe('resizeRect', () => {
  const base = { x: 100, y: 100, w: 200, h: 100 }

  it('poignée E étire vers la droite', () => {
    expect(resizeRect(base, 'e', 50, 0)).toMatchObject({ x: 100, w: 250, h: 100 })
  })

  it('poignée W déplace x et réduit/agrandit', () => {
    expect(resizeRect(base, 'w', 30, 0)).toMatchObject({ x: 130, w: 170 })
    expect(resizeRect(base, 'w', -20, 0)).toMatchObject({ x: 80, w: 220 })
  })

  it('poignée S étire vers le bas, N remonte y', () => {
    expect(resizeRect(base, 's', 0, 40)).toMatchObject({ y: 100, h: 140 })
    expect(resizeRect(base, 'n', 25, 0)).toMatchObject({ x: 100, w: 200 })
    expect(resizeRect(base, 'n', 0, 25)).toMatchObject({ y: 125, h: 75 })
  })

  it('coins combinent les deux axes', () => {
    expect(resizeRect(base, 'se', 10, 20)).toMatchObject({ x: 100, y: 100, w: 210, h: 120 })
    expect(resizeRect(base, 'nw', 10, 20)).toMatchObject({ x: 110, y: 120, w: 190, h: 80 })
  })

  it('taille mini avec ré-ancrage du côté fixe', () => {
    const r = resizeRect(base, 'w', 500, 0, { min: 20 })
    expect(r.w).toBe(20)
    expect(r.x).toBe(280) // x suit pour garder le bord droit fixe
    const r2 = resizeRect(base, 'n', 0, 500, { min: 20 })
    expect(r2.h).toBe(20)
    expect(r2.y).toBe(180)
  })

  it('keepAspect conserve le ratio (coins + bords)', () => {
    const r = resizeRect(base, 'se', 100, 10, { keepAspect: true })
    expect(r.w / r.h).toBeCloseTo(2, 5)
    const r2 = resizeRect(base, 'e', 100, 0, { keepAspect: true })
    expect(r2.w / r2.h).toBeCloseTo(2, 5)
    const r3 = resizeRect(base, 'nw', -40, -40, { keepAspect: true })
    expect(r3.w / r3.h).toBeCloseTo(2, 5)
    expect(r3.x).toBeLessThan(base.x)
  })

  it('ignore les deltas nuls', () => {
    expect(resizeRect(base, 'se', 0, 0)).toEqual(base)
  })
})

describe('snapToGuides', () => {
  it('snappe au centre quand proche du seuil', () => {
    // stage 1080×1350, couche 200×100 → cx=440, cy=625
    const r = snapToGuides(442, 623, 200, 100, 1080, 1350)
    expect(r.x).toBe(440)
    expect(r.y).toBe(625)
    expect(r.guides).toEqual(['v-center', 'h-middle'])
  })

  it('snappe les bords sur les bords du stage', () => {
    const left = snapToGuides(3, 100, 200, 100, 1080, 1350)
    expect(left.x).toBe(0)
    expect(left.guides).toContain('v-left')
    const right = snapToGuides(878, 100, 200, 100, 1080, 1350)
    expect(right.x).toBe(880)
    expect(right.guides).toContain('v-right')
    const top = snapToGuides(100, 2, 200, 100, 1080, 1350)
    expect(top.y).toBe(0)
    expect(top.guides).toContain('h-top')
    const bottom = snapToGuides(100, 1248, 200, 100, 1080, 1350)
    expect(bottom.y).toBe(1250)
    expect(bottom.guides).toContain('h-bottom')
  })

  it('le bord gauche est prioritaire sur le centre en cas de conflit', () => {
    // Couche large 1076 : x=2 proche de 0 ET centre proche du centre → v-left gagne
    const r = snapToGuides(2, 100, 1076, 100, 1080, 1350)
    expect(r.guides).toContain('v-left')
    expect(r.guides).not.toContain('v-center')
  })

  it('ne snappe pas hors seuil, guides vides', () => {
    const r = snapToGuides(100, 100, 200, 100, 1080, 1350)
    expect(r).toEqual({ x: 100, y: 100, guides: [] })
  })

  it('snappe un seul axe', () => {
    const r = snapToGuides(440, 100, 200, 100, 1080, 1350)
    expect(r.guides).toEqual(['v-center'])
    expect(r.y).toBe(100)
  })

  it('seuil custom', () => {
    const r = snapToGuides(430, 100, 200, 100, 1080, 1350, 20)
    expect(r.x).toBe(440)
  })
})
