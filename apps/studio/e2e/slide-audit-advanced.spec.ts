// Audit e2e — interactions avancées : reorder deck, resizers, z-order,
// rename couche, drag image canvas, space-pan.
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/slide')
  await expect(page.locator('.slide-stage')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(800)
})

test('sidebar : drag & drop réordonne le deck', async ({ page }) => {
  await page.locator('.add-btn').click()
  await page.locator('.add-item', { hasText: 'Comparatif Versus' }).first().click()
  await page.locator('.add-btn').click()
  await page.locator('.add-item', { hasText: "Citation d'Impact" }).first().click()
  const firstBefore = await page.locator('.slide-row').first().textContent()
  // Drag ligne 1 → position ligne 3 via poignée.
  const handle = page.locator('.slide-row').first().locator('.drag-handle')
  const hb = await handle.boundingBox()
  const target = await page.locator('.slide-row').nth(2).boundingBox()
  await page.mouse.move(hb!.x + 6, hb!.y + 6)
  await page.mouse.down()
  await page.mouse.move(target!.x + 10, target!.y + target!.height - 4, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  const firstAfter = await page.locator('.slide-row').first().textContent()
  expect(firstAfter, 'l’ordre a changé').not.toBe(firstBefore)
})

test('resizers : la sidebar deck se redimensionne', async ({ page }) => {
  const sidebar = page.locator('aside').first()
  const before = await sidebar.boundingBox()
  const resizer = page.locator('.slide-resizer').first()
  const rb = await resizer.boundingBox()
  await page.mouse.move(rb!.x + 4, rb!.y + 100)
  await page.mouse.down()
  await page.mouse.move(rb!.x + 104, rb!.y + 100, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const after = await sidebar.boundingBox()
  expect(after!.width - before!.width, 'sidebar élargie').toBeGreaterThan(50)
})

test('calques : monter/descendre change l’ordre, rename persiste', async ({ page }) => {
  await page.locator('.right-tab', { hasText: 'Calques' }).click()
  await page.locator('button[title="Ajouter un texte"]').click()
  await page.locator('button[title="Ajouter un texte"]').click()
  // La 2e ligne (A, z bas) → Monter.
  const rows = page.locator('.layer-row')
  await rows.nth(1).locator('button[title="Monter"]').click()
  await page.waitForTimeout(200)
  const firstName = await rows.first().textContent()
  expect(firstName).toContain('Texte 1')
  // Rename par double-clic.
  await rows.first().dblclick()
  await page.locator('.layer-row input').fill('Titre choc')
  await page.keyboard.press('Enter')
  await expect(page.locator('.layer-row').first()).toContainText('Titre choc')
})

test('image template : drag repositionne (NEWS sans image → avec picsum)', async ({ page }) => {
  // Met une image externe via le champ URL du panneau.
  await page.locator('.right-tab', { hasText: 'Propriétés' }).click()
  const urlInput = page.locator('.si[placeholder="https://…"]')
  await urlInput.fill('https://picsum.photos/seed/audit-drag/1200/800')
  await page.waitForTimeout(1500) // chargement image via proxy daemon
  const img = page.locator('.slide-stage img').first()
  await expect(img).toBeVisible()
  const before = await img.getAttribute('src')
  expect(before).toContain('picsum')
  // Drag de l'image elle-même.
  const ib = await img.boundingBox()
  await page.mouse.move(ib!.x + ib!.width / 2, ib!.y + ib!.height / 2)
  await page.mouse.down()
  await page.mouse.move(ib!.x + ib!.width / 2 + 40, ib!.y + ib!.height / 2 + 30, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/audit-imagedrag.png' })
})

test('space + drag panne le viewport', async ({ page }) => {
  const t = () =>
    page.evaluate(() => {
      const inner = document.querySelector('.slide-viewport > div') as HTMLElement | null
      return inner?.style.transform ?? 'none'
    })
  const before = await t()
  await page.keyboard.down('Space')
  await page.mouse.move(800, 450)
  await page.mouse.down()
  await page.mouse.move(950, 500, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  await page.waitForTimeout(200)
  expect(await t(), 'pan au space-drag').not.toBe(before)
})
