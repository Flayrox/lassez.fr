// Tests templates : rendu fidèle des 7 + patch store réactif.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Component } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { getTemplate } from '../registry'
import { useSlideDeckStore } from '../store/deck'
import CoverTpl from '../templates/CoverTpl.vue'
import NewsTpl from '../templates/NewsTpl.vue'
import VersusTpl from '../templates/VersusTpl.vue'
import BigNumTpl from '../templates/BigNumTpl.vue'
import ImpactQuoteTpl from '../templates/ImpactQuoteTpl.vue'
import InfoTpl from '../templates/InfoTpl.vue'
import OutroTpl from '../templates/OutroTpl.vue'
import { deepClone } from '../utils'

async function flush() {
  await new Promise((res) => requestAnimationFrame(() => res(null)))
}

function hexToRgbTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

function setup() {
  setActivePinia(createPinia())
  return useSlideDeckStore()
}

const CASES = [
  { id: 'COVER', component: CoverTpl, texts: ['PARADIGME', 'RÉDACTION'], sticker: 'TITRE', accent: '#DC2626' },
  { id: 'NEWS', component: NewsTpl, texts: ['DÉCRYPTAGE', 'Rédaction Quotidienne'], sticker: 'TITRE', accent: '#DC2626' },
  { id: 'VERSUS', component: VersusTpl, texts: ['DISCOURS', 'VS'], sticker: 'BANNER', accent: '#DC2626' },
  { id: 'BIG_NUM', component: BigNumTpl, texts: ['42%', 'INSEE'], sticker: 'NOMBRE', accent: '#DC2626' },
  { id: 'IMPACT_QUOTE', component: ImpactQuoteTpl, texts: ['DÉPOSSESSION', 'ANONYME'], sticker: 'CITATION', accent: '#BC0100' },
  { id: 'INFO', component: InfoTpl, texts: ['DÉCORTIQUER', 'Warning'], sticker: 'CORPS', accent: '#DC2626' },
  { id: 'OUTRO', component: OutroTpl, texts: ['Rejoignez la lutte', 'Lien en bio'], sticker: 'TITRE', accent: '#DC2626' },
] as { id: string; component: Component; texts: readonly string[]; sticker: string; accent: string }[]

describe.each(CASES)('template $id', ({ id, component, texts, sticker, accent }) => {
  it('rend les contenus par défaut avec stickers legacy', async () => {
    setup()
    const state = deepClone(getTemplate(id)!.defaultState)
    const w = mount(component, { props: { state } })
    await flush()
    for (const t of texts) expect(w.text(), `${id} contient "${t}"`).toContain(t)
    expect(w.text()).toContain(sticker)
    w.unmount()
  })

  it('réagit aux patchs du store (couleur accent)', async () => {
    const store = setup()
    store.ensureInit()
    const slide = store.addSlide(id as unknown as import('../types').SlideType)
    const w = mount(component, { props: { state: slide.templateState } })
    await flush()
    // L'accent par défaut est visible dans le DOM (hex brut ou rgb normalisé)…
    const html = w.html()
    expect(html.includes(accent) || html.includes(hexToRgbTriplet(accent))).toBe(true)
    store.patchTemplateState({ accent: '#00FF00' })
    await w.vm.$nextTick()
    expect(w.html()).toMatch(/#00FF00|rgb\(0,\s*255,\s*0\)|0,\s*255,\s*0/)
    w.unmount()
  })
})

describe('templates — cas spécifiques', () => {
  it('BIG_NUM : mode sombre inverse fond/texte', async () => {
    setup()
    const state = { ...deepClone(getTemplate('BIG_NUM')!.defaultState), dark: true }
    const w = mount(BigNumTpl, { props: { state } })
    await flush()
    expect(w.html()).toContain('background-color: rgb(0, 0, 0)')
    w.unmount()
  })

  it('NEWS : image absente par défaut, présente avec URL', async () => {
    setup()
    const empty = mount(NewsTpl, {
      props: { state: deepClone(getTemplate('NEWS')!.defaultState) },
    })
    await flush()
    expect(empty.find('img').exists()).toBe(false)
    empty.unmount()
    const withImg = mount(NewsTpl, {
      props: {
        state: { ...deepClone(getTemplate('NEWS')!.defaultState), imageUrl: 'https://example.com/a.png' },
      },
    })
    await flush()
    expect(withImg.find('img').exists()).toBe(true)
    withImg.unmount()
  })

  it('INFO : le corps HTML legacy est converti sans perdre le chiffre', async () => {
    setup()
    const w = mount(InfoTpl, {
      props: { state: deepClone(getTemplate('INFO')!.defaultState) },
    })
    await flush()
    expect(w.text()).toContain('60% des promesses')
    w.unmount()
  })
})
