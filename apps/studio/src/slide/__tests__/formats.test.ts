// Tests socle : formats (zoom, fit, presets multi-format).
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FORMAT,
  FORMAT_IDS,
  FORMATS,
  MAX_ZOOM,
  MIN_ZOOM,
  clampZoom,
  fitScale,
  getFormat,
  zoomIn,
  zoomOut,
} from '../formats'

describe('formats', () => {
  it('expose les 4 presets multi-format avec dimensions exactes', () => {
    expect(FORMAT_IDS).toEqual(['4:5', '1:1', '9:16', '16:9'])
    expect(FORMATS['4:5']).toMatchObject({ width: 1080, height: 1350 })
    expect(FORMATS['1:1']).toMatchObject({ width: 1080, height: 1080 })
    expect(FORMATS['9:16']).toMatchObject({ width: 1080, height: 1920 })
    expect(FORMATS['16:9']).toMatchObject({ width: 1920, height: 1080 })
  })

  it('garde le portrait 4:5 (legacy 1080×1350) par défaut', () => {
    expect(DEFAULT_FORMAT).toBe('4:5')
    expect(getFormat('4:5').width).toBe(1080)
  })

  it('replie un format inconnu vers le défaut', () => {
    expect(getFormat('21:9' as never)).toEqual(FORMATS[DEFAULT_FORMAT])
  })

  it('fitScale inscrit le slide dans le viewport avec padding', () => {
    // 1080×1350 dans 1200×900, padding 48 → min((1200-96)/1080, (900-96)/1350)
    const s = fitScale(1080, 1350, 1200, 900)
    expect(s).toBeCloseTo(Math.min(1104 / 1080, 804 / 1350), 6)
    expect(s).toBeLessThan(1)
  })

  it('fitScale retourne 1 sur dimensions invalides', () => {
    expect(fitScale(0, 1350, 1200, 900)).toBe(1)
    expect(fitScale(1080, 1350, 0, 900)).toBe(1)
    expect(fitScale(-5, 10, 10, 10)).toBe(1)
  })

  it('clampZoom borne et rejette NaN/Infini', () => {
    expect(clampZoom(0.001)).toBe(MIN_ZOOM)
    expect(clampZoom(999)).toBe(MAX_ZOOM)
    expect(clampZoom(NaN)).toBe(1)
    expect(clampZoom(Infinity)).toBe(1)
    expect(clampZoom(1.5)).toBe(1.5)
  })

  it('zoomIn/zoomOut suivent les paliers discrets', () => {
    expect(zoomIn(1)).toBe(1.25)
    expect(zoomOut(1)).toBe(0.75)
    expect(zoomIn(MAX_ZOOM)).toBe(MAX_ZOOM)
    expect(zoomOut(MIN_ZOOM)).toBe(MIN_ZOOM)
  })

  it('zoomIn/zoomOut restent monotones hors paliers', () => {
    expect(zoomIn(1.1)).toBeGreaterThan(1.1)
    expect(zoomOut(0.9)).toBeLessThan(0.9)
  })
})
