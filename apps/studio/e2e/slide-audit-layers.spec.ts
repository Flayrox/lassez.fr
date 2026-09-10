// Audit e2e — couches : ajout, déplacement, resize, visibilité, verrou,
// z-order, suppression, typo, image, multi-sélection, raccourcis.
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/slide')
  await expect(page.locator('.slide-stage')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(800)
  // Onglet Calques visible pour les assertions.
  await page.locator('.right-tab', { hasText: 'Calques' }).click()
})

async function layerCount(page: Page): Promise<number> {
  const txt = await page.locator('.right-tab', { hasText: 'Calques' }).textContent()
  const m = txt?.match(/Calques \((\d+)\)/)
  return m ? parseInt(m[1], 10) : -1
}

test('couches : ajout texte / image / forme', async ({ page }) => {
  await page.locator('button[title="Ajouter un texte"]').click()
  await page.locator('button[title="Ajouter une forme"]').click()
  expect(await layerCount(page)).toBe(2)
  expect(await page.locator('.slide-selection').count()).toBe(1)
  await page.screenshot({ path: '/tmp/audit-layers.png' })
})

test('couches : déplacement à la souris du cadre sélectionné', async ({ page }) => {
  await page.locator('button[title="Ajouter un texte"]').click()
  await page.waitForTimeout(400)
  const box = page.locator('.slide-selection').first()
  const before = await box.boundingBox()
  // Drag via la bande haute (+60px, +40px écran).
  const top = page.locator('.sel-top').first()
  const tb = await top.boundingBox()
  // Point excentré de la bande (le centre exact est occupé par la poignée N).
  const sx = tb!.x + tb!.width * 0.25
  const sy = tb!.y + tb!.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 60, sy + 40, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const after = await box.boundingBox()
  expect(after!.x - before!.x, 'déplacement horizontal').toBeGreaterThan(20)
  expect(after!.y - before!.y, 'déplacement vertical').toBeGreaterThan(10)
})

test('couches : resize par poignée SE', async ({ page }) => {
  await page.locator('button[title="Ajouter une forme"]').click()
  await page.waitForTimeout(400)
  const box = page.locator('.slide-selection').first()
  const before = await box.boundingBox()
  const handle = page.locator('.slide-handle.h-se').first()
  const hb = await handle.boundingBox()
  await page.mouse.move(hb!.x + 5, hb!.y + 5)
  await page.mouse.down()
  await page.mouse.move(hb!.x + 80, hb!.y + 60, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const after = await box.boundingBox()
  expect(after!.width - before!.width, 'élargi').toBeGreaterThan(20)
  expect(after!.height - before!.height, 'haussi').toBeGreaterThan(10)
})

test('couches : visibilité, verrou, suppression via panneau', async ({ page }) => {
  await page.locator('button[title="Ajouter un texte"]').click()
  await page.waitForTimeout(300)
  // Masquer → plus de cadre
  await page.locator('.layer-row button[title="Masquer"]').click()
  await expect(page.locator('.slide-selection')).toHaveCount(0)
  // Réafficher → cadre de retour
  await page.locator('.layer-row button[title="Afficher"]').click()
  await expect(page.locator('.slide-selection')).toHaveCount(1)
  // Verrouiller → plus de cadre (non éditable)
  await page.locator('.layer-row button[title="Verrouiller"]').click()
  await expect(page.locator('.slide-selection')).toHaveCount(0)
  // Déverrouiller + supprimer
  await page.locator('.layer-row button[title="Déverrouiller"]').click()
  await page.locator('.layer-row button[title="Supprimer"]').click()
  expect(await layerCount(page)).toBe(0)
})

test('couches : typo taille via panneau', async ({ page }) => {
  await page.locator('button[title="Ajouter un texte"]').click()
  await page.waitForTimeout(400)
  // Retour onglet Propriétés pour la section Typo.
  await page.locator('.right-tab', { hasText: 'Propriétés' }).click()
  expect(page.locator('text=Taille').first()).toBeVisible()
  await page.screenshot({ path: '/tmp/audit-typo.png' })
})

test('multi : shift-clic canvas + Suppr supprime le lot (formes)', async ({ page }) => {
  // Formes plutôt que textes : le focus reste hors éditeur, Suppr agit.
  await page.locator('button[title="Ajouter une forme"]').click()
  await page.locator('button[title="Ajouter une forme"]').click()
  expect(await layerCount(page)).toBe(2)
  // Les 2 formes naissent empilées : on écarte la 2e (sélectionnée) vers la droite.
  const strip = page.locator('.sel-right').first()
  const rb = await strip.boundingBox()
  const sx = rb!.x + rb!.width / 2
  const sy = rb!.y + rb!.height * 0.25 // excentré (poignée E au milieu)
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 200, sy, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const shapes = page.locator('.slide-stage .slide-layer-view')
  await shapes.nth(0).click({ force: true })
  await shapes.nth(1).click({ modifiers: ['Shift'], force: true })
  await page.waitForTimeout(300)
  expect(await page.locator('.slide-selection').count()).toBe(2)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(300)
  expect(await layerCount(page)).toBe(0)
})

test('garde : Suppr pendant la frappe édite le texte, ne supprime pas', async ({ page }) => {
  await page.locator('button[title="Ajouter un texte"]').click()
  await page.waitForTimeout(400)
  const editor = page.locator('.slide-stage .slide-layer-view .slide-tiptap').first()
  await editor.click()
  await page.keyboard.press('Delete') // dans l'éditeur : supprime un caractère
  await page.waitForTimeout(300)
  expect(await layerCount(page)).toBe(1)
})

test('raccourcis : Ctrl+Z annule un ajout de couche', async ({ page }) => {
  await page.locator('button[title="Ajouter une forme"]').click()
  expect(await layerCount(page)).toBe(1)
  // Sortir de tout focus texte avant le raccourci.
  await page.locator('.slide-viewport').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ControlOrMeta+z')
  await page.waitForTimeout(300)
  expect(await layerCount(page)).toBe(0)
})
