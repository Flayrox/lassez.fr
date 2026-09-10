// Tests brand kit : unicité, validité, helpers.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BRAND_COLORS,
  BRAND_FONTS,
  DEFAULT_TEXT_SIZE,
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
  brandColorNames,
  clampTextSize,
  findBrandFont,
} from '../brand'

describe('brand kit', () => {
  it('couleurs uniques, hex valides, rouge en tête', () => {
    expect(BRAND_COLORS[0]).toMatchObject({ name: 'Rouge Lassez', value: '#DC2626' })
    const values = BRAND_COLORS.map((c) => c.value.toLowerCase())
    expect(new Set(values).size).toBe(values.length)
    for (const c of BRAND_COLORS) {
      expect(c.value).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(c.name.length).toBeGreaterThan(0)
    }
  })

  it('polices uniques, familles non vides, graisses triées', () => {
    const names = BRAND_FONTS.map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
    for (const f of BRAND_FONTS) {
      expect(f.family).toContain(f.name.split(' ')[0])
      expect(f.weights.length).toBeGreaterThan(0)
      expect([...f.weights].sort((a, b) => a - b)).toEqual(f.weights)
    }
  })

  it('toutes les familles du kit sont chargées dans slide.css', () => {
    // Garde réelle : si une webfont disparaît du CSS, la charte casse en prod.
    const slideCss = readFileSync('src/slide/slide.css', 'utf8')
    expect(slideCss).toContain('fonts.googleapis.com')
    for (const f of BRAND_FONTS) {
      expect(slideCss, `webfont ${f.name} chargée`).toContain(f.name.replace(/ /g, '+'))
    }
  })

  it('brandColorNames liste les noms', () => {
    expect(brandColorNames()).toContain('Rouge Lassez')
    expect(brandColorNames()).toHaveLength(BRAND_COLORS.length)
  })

  it('findBrandFont retrouve par famille (insensible à la casse)', () => {
    expect(findBrandFont("'Archivo Black', sans-serif")?.name).toBe('Archivo Black')
    expect(findBrandFont("'INTER', sans-serif")?.name).toBe('Inter')
    expect(findBrandFont(undefined)).toBeUndefined()
    expect(findBrandFont("'Comic Sans'")).toBeUndefined()
  })

  it('clampTextSize borne + défaut', () => {
    expect(clampTextSize(32)).toBe(32)
    expect(clampTextSize(32.6)).toBe(33)
    expect(clampTextSize(1)).toBe(MIN_TEXT_SIZE)
    expect(clampTextSize(9999)).toBe(MAX_TEXT_SIZE)
    expect(clampTextSize(NaN)).toBe(DEFAULT_TEXT_SIZE)
    expect(clampTextSize(Infinity)).toBe(DEFAULT_TEXT_SIZE)
  })
})
