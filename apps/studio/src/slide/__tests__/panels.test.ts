// Tests panneaux : sidebar deck, propriétés schema, toolbar, modales,
// nettoyage de styles.
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DeckSidebar from '../panels/DeckSidebar.vue'
import PropsPanel from '../panels/PropsPanel.vue'
import SchemaForm from '../panels/SchemaForm.vue'
import SlideToolbar from '../panels/SlideToolbar.vue'
import SlideModals from '../panels/SlideModals.vue'
import { useSlideDeckStore } from '../store/deck'
import { stripMarksFromState } from '../text/tiptap'
import { htmlToTiptapDoc } from '../text/tiptap'

async function flush() {
  await new Promise((res) => requestAnimationFrame(() => res(null)))
}

beforeEach(() => setActivePinia(createPinia()))

function setup() {
  const store = useSlideDeckStore()
  store.ensureInit()
  return store
}

describe('stripMarksFromState', () => {
  it('retire les marques des docs en gardant le texte', () => {
    const out = stripMarksFromState({
      headline: htmlToTiptapDoc('<strong>Gras</strong> et <u>U</u>'),
      accent: '#DC2626',
      dark: false,
      count: 3,
    })
    expect(out.accent).toBe('#DC2626')
    expect(out.dark).toBe(false)
    expect(out.count).toBe(3)
    const doc = out.headline as { content: { content: { text: string; marks?: unknown[] }[] }[] }
    expect(doc.content[0].content[0].text).toBe('Gras et U')
    expect(doc.content[0].content[0].marks).toBeUndefined()
  })

  it('strip le HTML des strings', () => {
    const out = stripMarksFromState({ h: 'A<br/>B<span style="x">C</span>' })
    expect(out.h).toBe('A\nBC')
  })
})

describe('DeckSidebar', () => {
  it('affiche le compteur + lignes + catalogue groupé', async () => {
    setup()
    const w = mount(DeckSidebar)
    expect(w.text()).toContain('Deck — 1')
    await w.find('.add-btn').trigger('click')
    expect(w.text()).toContain('Éditorial')
    expect(w.text()).toContain('Couverture Magazine')
    w.unmount()
  })

  it('ajout via catalogue, sélection, rename, duplicate, suppression', async () => {
    const store = setup()
    const w = mount(DeckSidebar)
    await w.find('.add-btn').trigger('click')
    await w.findAll('.add-item')[0].trigger('click')
    expect(store.slides).toHaveLength(2)
    const rows = w.findAll('.slide-row')
    await rows[1].trigger('pointerdown')
    expect(store.activeId).toBe(store.slides[1].id)
    await w.findAll('.row-label')[0].setValue('Renommée')
    expect(store.slides[0].label).toBe('Renommée')
    await w.findAll('.row-btn')[0].trigger('click') // dupliquer ligne 1
    expect(store.slides).toHaveLength(3)
    w.unmount()
  })

  it('bouton Générer émet generate', async () => {
    setup()
    const w = mount(DeckSidebar)
    await w.find('.gen-btn').trigger('click')
    expect(w.emitted('generate')).toHaveLength(1)
    w.unmount()
  })
})

describe('PropsPanel', () => {
  it('affiche meta template + schema + format + autosave', async () => {
    setup()
    const w = mount(PropsPanel)
    await flush()
    expect(w.text()).toContain('Propriétés')
    expect(w.text()).toContain('Actualités Flash')
    expect(w.text()).toContain('Couleur Accent')
    expect(w.text()).toContain('Sauvegarde automatique active')
    w.unmount()
  })

  it('sélecteur de format change le format de la slide', async () => {
    const store = setup()
    const w = mount(PropsPanel)
    await flush()
    await w.findAll('.format-btn')[1].trigger('click') // 1:1
    expect(store.activeSlide!.format).toBe('1:1')
    w.unmount()
  })

  it('champ couleur patch le templateState', async () => {
    const store = setup()
    const w = mount(PropsPanel)
    await flush()
    const color = w.find('input[type="color"]')
    expect(color.exists()).toBe(true)
    await color.setValue('#00ff00')
    expect(String(store.activeSlide!.templateState.accent).toLowerCase()).toBe('#00ff00')
    w.unmount()
  })

  it('drag du slider rotation = 1 seul undo', async () => {
    const store = setup()
    const added = store.addTextLayer('X')!
    const w = mount(PropsPanel)
    await flush()
    const rotation = w.findAll('input[type="range"]').find((i) => String(i.attributes('min')) === '-180')!
    const el = rotation.element as HTMLInputElement
    await rotation.trigger('pointerdown')
    for (const v of ['30', '60', '90']) {
      el.value = v
      await rotation.trigger('input')
    }
    await rotation.trigger('change')
    expect(store.getActiveLayer()!.rotation).toBe(90)
    store.undo() // vide aussi la sélection (comportement store)
    expect(store.activeSlide!.layers.find((l) => l.id === added.id)!.rotation).toBe(0)
    w.unmount()
  })

  it('drag du slider couleur template = 1 seul undo', async () => {
    const store = setup()
    const w = mount(PropsPanel)
    await flush()
    const color = w.find('input[type="color"]')
    const el = color.element as HTMLInputElement
    await color.trigger('pointerdown')
    for (const v of ['#111111', '#222222']) {
      el.value = v
      await color.trigger('input')
    }
    await color.trigger('change')
    expect(String(store.activeSlide!.templateState.accent)).toBe('#222222')
    store.undo()
    expect(String(store.activeSlide!.templateState.accent)).toBe('#DC2626')
    w.unmount()
  })

  it('typo couche texte : taille/famille/align/couleur + 1 undo par drag', async () => {
    const store = setup()
    const added = store.addTextLayer('Hello')!
    expect((added.data as { fontSize?: number }).fontSize).toBe(32)
    const w = mount(PropsPanel)
    await flush()
    // Section typo visible uniquement pour les couches texte
    expect(w.text()).toContain('Taille')
    const size = w.findAll('input[type="range"]').find((i) => String(i.attributes('max')) === '200')!
    const el = size.element as HTMLInputElement
    await size.trigger('pointerdown')
    for (const v of ['40', '48']) {
      el.value = v
      await size.trigger('input')
    }
    await size.trigger('change')
    const data = () => store.activeSlide!.layers.find((l) => l.id === added.id)!.data as unknown as Record<string, unknown>
    expect(data().fontSize).toBe(48)
    store.undo()
    expect(data().fontSize).toBe(32)
    // undo() vide la sélection (comportement store) → resélection pour la suite
    store.selectLayer(added.id)
    await w.vm.$nextTick()
    // Famille via le kit
    const family = w.findAll('select.si')[0]
    await family.setValue("'Anton', sans-serif")
    expect(data().fontFamily).toBe("'Anton', sans-serif")
    // Alignement centré
    await w.findAll('.align-btn')[1].trigger('click')
    expect(data().align).toBe('center')
    // Swatch brand rouge — 2e groupe de dots (le 1er = champ accent du template)
    await w.findAll('.brand-dot')[8].trigger('click')
    expect(data().color).toBe('#DC2626')
    w.unmount()
  })

  it('pas de section typo pour les couches image', async () => {
    const store = setup()
    const l = store.addImageLayer('https://example.com/a.png')!
    store.selectLayer(l.id)
    const w = mount(PropsPanel)
    await flush()
    expect(w.text()).not.toContain('Taille')
    expect(w.text()).not.toContain('Interligne')
    w.unmount()
  })

  it('BrandSwatches : 8 dots, actif, émission', async () => {
    const { default: BrandSwatches } = await import('../panels/BrandSwatches.vue')
    const w = mount(BrandSwatches, { props: { value: '#dc2626' } })
    expect(w.findAll('.brand-dot')).toHaveLength(8)
    expect(w.findAll('.brand-dot.is-active')).toHaveLength(1)
    await w.findAll('.brand-dot')[6].trigger('click')
    expect(w.emitted('select')![0]).toEqual(['#FFFFFF'])
    w.unmount()
  })

  it('section couche : sliders + suppression', async () => {
    const store = setup()
    const l = store.addTextLayer('X')!
    const w = mount(PropsPanel)
    await flush()
    expect(w.text()).toContain('Couche —')
    const ranges = w.findAll('input[type="range"]')
    expect(ranges.length).toBeGreaterThan(0)
    store.selectLayer(null)
    await w.vm.$nextTick()
    expect(w.text()).not.toContain('Couche —')
    store.selectLayer(l.id)
    await w.vm.$nextTick()
    await w.find('button.layer-btn.danger').trigger('click')
    expect(store.activeSlide!.layers).toHaveLength(0)
    w.unmount()
  })
})

describe('SchemaForm (listes)', () => {
  it('rend les groupes dans l’ordre du schema', async () => {
    setup()
    const store = useSlideDeckStore()
    const w = mount(SchemaForm, {
      props: {
        schema: [
          { key: 'a', label: 'Champ A', type: 'text', group: 'Premier' },
          { key: 'b', label: 'Champ B', type: 'text', group: 'Second' },
        ],
        state: store.activeSlide!.templateState,
      },
    })
    await flush()
    const html = w.html()
    expect(html.indexOf('Premier')).toBeLessThan(html.indexOf('Second'))
    w.unmount()
  })
})

describe('SlideToolbar', () => {
  it('compteur, undo/redo désactivés par défaut, exports émis', async () => {
    const w = mount(SlideToolbar, {
      props: { deckCount: 3, canUndo: false, canRedo: true, deckFormat: '4:5', zoomPercent: 75 },
    })
    expect(w.text()).toContain('3 slides')
    expect(w.text()).toContain('75%')
    expect((w.find('button[title="Annuler (Ctrl+Z)"]').element as HTMLButtonElement).disabled).toBe(true)
    await w.find('.tb-export').trigger('click')
    expect(w.emitted('exportPng')).toHaveLength(1)
    await w.findAll('.tb-primary').find((b) => b.text() === 'ZIP')!.trigger('click')
    expect(w.emitted('exportZip')).toHaveLength(1)
    await w.find('select.tb-select').setValue('1:1')
    expect(w.emitted('format')![0]).toEqual(['1:1'])
    w.unmount()
  })
})

describe('SlideModals', () => {
  it('modale article : toggle templates + generate', async () => {
    const w = mount(SlideModals, { props: { showArticle: true } })
    expect(w.text()).toContain("depuis un article")
    await w.find('textarea').setValue('Mon article de test')
    await w.find('.modal-cta').trigger('click')
    const payload = w.emitted('generate')![0][0] as { text: string; types: string[] }
    expect(payload.text).toBe('Mon article de test')
    expect(payload.types.length).toBeGreaterThan(0)
    w.unmount()
  })

  it('modale JSON : erreur sur JSON invalide, import sur valide', async () => {
    const w = mount(SlideModals, { props: { showJson: true } })
    await w.find('textarea').setValue('{oups')
    await w.find('.modal-cta').trigger('click')
    expect(w.text()).toContain('JSON invalide')
    expect(w.emitted('import')).toBeUndefined()
    await w.find('textarea').setValue('{"deck":[]}')
    await w.find('.modal-cta').trigger('click')
    expect(w.emitted('import')).toHaveLength(1)
    w.unmount()
  })

  it('rien rendu quand fermées', () => {
    const w = mount(SlideModals, { props: {} })
    expect(w.html()).toBe('<!--v-if-->')
    w.unmount()
  })
})
