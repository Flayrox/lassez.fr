// Tests LayersPanel : ajout, visibilité, verrou, z-order, renommage, suppression.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LayersPanel from '../layers/LayersPanel.vue'
import { useSlideDeckStore } from '../store/deck'

function setup() {
  setActivePinia(createPinia())
  const store = useSlideDeckStore()
  store.ensureInit()
  return store
}

function panel() {
  // Pas de plugin dédié : le composant utilise la pinia active posée par setup().
  return mount(LayersPanel)
}

describe('LayersPanel', () => {
  it('état vide : message + compteur 0', () => {
    setup()
    const w = panel()
    expect(w.text()).toContain('Calques — 0')
    expect(w.text()).toContain('Aucune couche libre')
    w.unmount()
  })

  it('boutons T et ■ ajoutent texte et forme', async () => {
    const store = setup()
    const w = panel()
    await w.find('button[title="Ajouter un texte"]').trigger('click')
    await w.find('button[title="Ajouter une forme"]').trigger('click')
    expect(store.activeSlide!.layers).toHaveLength(2)
    expect(w.text()).toContain('Calques — 2')
    w.unmount()
  })

  it('sélection au clic sur la ligne', async () => {
    const store = setup()
    store.addTextLayer('A')
    const w = panel()
    await w.find('.layer-row').trigger('click')
    expect(store.selectedLayerId).toBe(store.activeSlide!.layers[0].id)
    w.unmount()
  })

  it('masquer/afficher via ◉/◌', async () => {
    const store = setup()
    const l = store.addTextLayer('A')!
    const w = panel()
    await w.find('button[title="Masquer"]').trigger('click')
    expect(l.visible).toBe(false)
    await w.find('button[title="Afficher"]').trigger('click')
    expect(l.visible).toBe(true)
    w.unmount()
  })

  it('verrouiller via 🔓/🔒', async () => {
    const store = setup()
    const l = store.addTextLayer('A')!
    const w = panel()
    await w.find('button[title="Verrouiller"]').trigger('click')
    expect(l.locked).toBe(true)
    w.unmount()
  })

  it('▲/▼ changent le z-order', async () => {
    const store = setup()
    const a = store.addTextLayer('A')!
    store.addTextLayer('B')!
    const w = panel()
    // Liste affichée dessus = z max d'abord : la ligne de A est la 2e.
    const rows = w.findAll('.layer-row')
    expect(rows).toHaveLength(2)
    await rows[1].find('button[title="Monter"]').trigger('click')
    expect(a.z).toBe(2)
    w.unmount()
  })

  it('⧉ duplique, ✕ supprime', async () => {
    const store = setup()
    store.addTextLayer('A')!
    const w = panel()
    await w.find('button[title="Dupliquer"]').trigger('click')
    expect(store.activeSlide!.layers).toHaveLength(2)
    await w.findAll('button[title="Supprimer"]')[0].trigger('click')
    expect(store.activeSlide!.layers).toHaveLength(1)
    w.unmount()
  })

  it('double-clic → renommage validé par Entrée', async () => {
    const store = setup()
    const l = store.addTextLayer('Ancien')!
    const w = panel()
    await w.find('.layer-row').trigger('dblclick')
    const input = w.find('.layer-row input')
    expect(input.exists()).toBe(true)
    await input.setValue('Nouveau nom')
    await input.trigger('keydown.enter')
    expect(l.name).toBe('Nouveau nom')
    w.unmount()
  })

  it('affiche le badge "derrière template" pour z <= 0', async () => {
    const store = setup()
    const l = store.addTextLayer('Fond')!
    store.sendLayerToBack(l.id)
    const w = panel()
    expect(w.text()).toContain('derrière template')
    w.unmount()
  })
})
