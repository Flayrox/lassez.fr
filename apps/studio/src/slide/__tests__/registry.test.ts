// Tests socle : registre (7 templates noyau, schémas, groupes, coercition).
import { describe, expect, it } from 'vitest'
import {
  TemplateRegistry,
  coerceSlideType,
  getAllTemplates,
  getTemplate,
  getTemplateGroups,
  resolveTemplateSchema,
} from '../registry'
import { CORE_SLIDE_TYPES } from '../types'

describe('registry', () => {
  it('contient exactement le noyau V1 de 7 templates', () => {
    expect(Object.keys(TemplateRegistry).sort()).toEqual([...CORE_SLIDE_TYPES].sort())
    expect(getAllTemplates()).toHaveLength(7)
  })

  it('chaque template a meta complète + defaultState + schema non vide', () => {
    for (const t of getAllTemplates()) {
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.category).toBeTruthy()
      expect(typeof t.defaultState).toBe('object')
      const schema = resolveTemplateSchema(t, t.defaultState)
      expect(schema.length).toBeGreaterThan(0)
      for (const f of schema) {
        expect(f.key).toBeTruthy()
        expect(f.label).toBeTruthy()
        expect(['text', 'longtext', 'color', 'image', 'number', 'select', 'boolean', 'list']).toContain(f.type)
      }
    }
  })

  it('porte fidèlement les defaults legacy (spot-check)', () => {
    expect(getTemplate('COVER')!.defaultState).toMatchObject({
      bg: '#FFFFFF', accent: '#DC2626', headline: 'LE NOUVEAU<br/>PARADIGME',
    })
    expect(getTemplate('NEWS')!.defaultState).toMatchObject({
      accent: '#DC2626', category: 'FLASH',
    })
    expect(getTemplate('VERSUS')!.defaultState).toMatchObject({
      headline: 'DISCOURS VS RÉALITÉ', leftTitle: "CE QU'ILS DISENT",
    })
    expect(getTemplate('BIG_NUM')!.defaultState).toMatchObject({ num: '42%', dark: false })
    expect(getTemplate('IMPACT_QUOTE')!.defaultState).toMatchObject({
      author: 'ANONYME', accent: '#BC0100',
    })
    expect(getTemplate('INFO')!.defaultState).toMatchObject({ tag: 'Flash Info', slideNum: '02' })
    expect(getTemplate('OUTRO')!.defaultState).toMatchObject({
      brandHandle: '@L_ASSEZ_MEDIA', linkText: 'Lien en bio',
    })
  })

  it('toutes les clés de defaultState texte/couleur sont couvertes par le schema', () => {
    for (const t of getAllTemplates()) {
      const keys = new Set(resolveTemplateSchema(t, t.defaultState).map((f) => f.key))
      for (const [key, value] of Object.entries(t.defaultState)) {
        if (['zoom', 'grayscale', 'posX', 'posY'].includes(key)) continue // gérés par le moteur couches
        if (typeof value === 'string' || typeof value === 'boolean') {
          expect(keys.has(key), `${t.id}.${key} sans champ schema`).toBe(true)
        }
      }
    }
  })

  it('getTemplate retourne undefined pour un id inconnu', () => {
    expect(getTemplate('NOPE')).toBeUndefined()
  })

  it('getTemplateGroups regroupe par catégorie éditoriale', () => {
    const groups = getTemplateGroups()
    const names = groups.map((g) => g.name)
    expect(names).toContain('Éditorial')
    expect(names).toContain('Analyse')
    const total = groups.reduce((n, g) => n + g.templates.length, 0)
    expect(total).toBe(7)
  })

  it('coerceSlideType replie les ids V2/legacy inconnus vers INFO', () => {
    expect(coerceSlideType('COVER')).toBe('COVER')
    expect(coerceSlideType('VIDEO_NOTE')).toBe('INFO')
    expect(coerceSlideType('')).toBe('INFO')
    expect(coerceSlideType('MANIFESTO')).toBe('INFO')
  })
})
