// E2E interaction texte (modèle Canva) : clic = sélection, drag corps =
// déplacement, double-clic = édition, Échap = retour, Suppr = suppression.
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/slide')
  await expect(page.locator('.slide-stage')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(800)
  await page.locator('.right-tab', { hasText: 'Calques' }).click()
})

test('clic sélectionne sans éditer, drag corps déplace', async ({ page }) => {
  await page.locator('button[title="Ajouter un texte"]').click()
  await page.waitForTimeout(400)
  // Sélectionnée mais PAS en édition : pas de curseur texte.
  await expect(page.locator('.slide-selection')).toHaveCount(1)
  const box = page.locator('.slide-selection').first()
  const before = await box.boundingBox()
  // Drag direct sur le corps du texte (centre, loin des bandes).
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2)
  await page.mouse.down()
  await page.mouse.move(before!.x + before!.width / 2 + 70, before!.y + before!.height / 2 + 50, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const after = await box.boundingBox()
  expect(after!.x - before!.x, 'drag corps déplace').toBeGreaterThan(25)
  expect(after!.y - before!.y, 'drag corps déplace').toBeGreaterThan(15)
})

test('double-clic édite : frappe puis Échap puis Suppr', async ({ page }) => {
  await page.locator('button[title="Ajouter un texte"]').click()
  await page.waitForTimeout(400)
  const layer = page.locator('.slide-stage .slide-layer-view').first()
  await layer.dblclick()
  await page.waitForTimeout(400)
  // En édition : contenteditable actif.
  await expect(page.locator('.slide-stage .slide-layer-view .slide-tiptap[contenteditable="true"]')).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Mon super titre', { delay: 20 })
  await expect(page.locator('.slide-stage')).toContainText('Mon super titre')
  // Échap : quitte l'édition, garde la sélection (cadre de retour).
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await expect(page.locator('.slide-stage .slide-layer-view .slide-tiptap[contenteditable="true"]')).toHaveCount(0)
  await expect(page.locator('.slide-selection')).toHaveCount(1)
  // Suppr : la couche part (focus hors éditeur).
  await page.keyboard.press('Delete')
  await page.waitForTimeout(300)
  await expect(page.locator('.slide-stage .slide-layer-view')).toHaveCount(0)
  await page.screenshot({ path: '/tmp/e2e-text-flow.png' })
})

test('Entrée édite la couche sélectionnée', async ({ page }) => {
  await page.locator('button[title="Ajouter un texte"]').click()
  await page.waitForTimeout(400)
  // Clic vide du stage pour être sûr de ne pas être en édition, puis reclic.
  await page.locator('.slide-stage .slide-layer-view').first().click()
  await page.waitForTimeout(200)
  await expect(page.locator('.slide-stage .slide-layer-view .slide-tiptap[contenteditable="true"]')).toHaveCount(0)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await expect(page.locator('.slide-stage .slide-layer-view .slide-tiptap[contenteditable="true"]')).toHaveCount(1)
})
