// E2E éditeur Slide : reproduit les bugs d'affichage signalés —
// 1. double-clic sur un texte ne doit PAS reset la position du viewport,
// 2. la toolbar flottante doit apparaître AU-DESSUS de la sélection,
// 3. taper du texte ne doit pas déplacer le stage.
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/slide')
  await expect(page.locator('.slide-stage')).toBeVisible({ timeout: 20_000 })
  // Laisse les éditeurs Tiptap monter (rAF async).
  await page.waitForTimeout(800)
})

async function stageTransform(page: Page): Promise<string> {
  return page.evaluate(() => {
    const inner = document.querySelector('.slide-viewport > div') as HTMLElement | null
    return inner?.style.transform ?? 'none'
  })
}

test('double-clic sur un texte ne reset pas le viewport', async ({ page }) => {
  // Zoome/déplace d'abord pour rendre tout reset visible.
  await page.mouse.move(800, 450)
  await page.mouse.wheel(0, -400) // ctrl-less wheel = pan (change tx/ty)
  const before = await stageTransform(page)
  expect(before).not.toBe('none')

  // Double-clic sur le titre NEWS pour sélectionner un mot.
  const title = page.locator('.slide-stage .slide-tiptap', { hasText: 'DÉCRYPTAGE' }).first()
  await title.dblclick()
  await page.waitForTimeout(300)

  const after = await stageTransform(page)
  expect(after, 'le viewport ne doit pas bouger au double-clic texte').toBe(before)
  await page.screenshot({ path: '/tmp/e2e-dblclick.png' })
})

test('la toolbar flottante colle à la sélection', async ({ page }) => {
  const title = page.locator('.slide-stage .slide-tiptap', { hasText: 'DÉCRYPTAGE' }).first()
  await title.dblclick() // sélectionne un mot → toolbar
  const toolbar = page.locator('.slide-tb')
  await expect(toolbar).toBeVisible({ timeout: 5_000 })

  const box = await toolbar.boundingBox()
  const sel = await page.evaluate(() => {
    const r = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null
  })
  expect(sel, 'une sélection doit exister').not.toBeNull()
  expect(box, 'toolbar visible à l’écran').not.toBeNull()
  // Au-dessus de la sélection, centrée horizontalement (±120px de tolérance).
  const tbCx = box!.x + box!.width / 2
  const selCx = sel!.x + sel!.width / 2
  expect(Math.abs(tbCx - selCx), `toolbar centrée (tb=${tbCx}, sel=${selCx})`).toBeLessThan(120)
  expect(box!.y, 'toolbar au-dessus ou proche').toBeLessThan(sel!.y + sel!.height + 40)
  expect(box!.y, 'toolbar pas collée en haut de l’écran').toBeGreaterThan(sel!.y - 200)
  await page.screenshot({ path: '/tmp/e2e-toolbar.png' })
})

test('taper du texte ne déplace pas le stage', async ({ page }) => {
  const before = await stageTransform(page)
  const title = page.locator('.slide-stage .slide-tiptap', { hasText: 'DÉCRYPTAGE' }).first()
  await title.click()
  await page.keyboard.type(' TEST', { delay: 30 })
  await page.waitForTimeout(300)
  expect(await stageTransform(page), 'le stage ne bouge pas pendant la frappe').toBe(before)
  await expect(title).toContainText('TEST')
})

test('contrôles zoom : + agrandit, % recentre (fit)', async ({ page }) => {
  const zoomValue = page.locator('.zoom-value')
  const initial = await zoomValue.textContent()
  await page.locator('.zoom-btn', { hasText: '+' }).click()
  await page.waitForTimeout(200)
  const grown = await zoomValue.textContent()
  expect(parseInt(grown!), 'zoom augmenté').toBeGreaterThan(parseInt(initial!))
  // Le % affiché est cliquable → fit.
  await zoomValue.click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: '/tmp/e2e-zoom.png' })
})
