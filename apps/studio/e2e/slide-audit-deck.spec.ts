// Audit e2e — deck : CRUD slides, reorder, undo/redo, formats, persistance.
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/slide')
  await expect(page.locator('.slide-stage')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(800)
})

async function deckCount(page: Page): Promise<number> {
  const txt = await page.locator('.slide-root').first().textContent()
  const m = txt?.match(/Deck — (\d+)/)
  return m ? parseInt(m[1], 10) : -1
}

test('deck : ajout via catalogue pour chaque template du noyau', async ({ page }) => {
  const names = [
    'Couverture Magazine',
    'Actualités Flash',
    'Comparatif Versus',
    'Chiffre Impact',
    "Citation d'Impact",
    'Fiche Information',
    'Call to Action / Outro',
  ]
  for (const name of names) {
    await page.locator('.add-btn').click()
    await page.locator('.add-item', { hasText: name }).click()
  }
  expect(await deckCount(page)).toBe(1 + names.length)
  await page.screenshot({ path: '/tmp/audit-deck-full.png' })
})

test('deck : rename, duplicate, suppression, undo/redo', async ({ page }) => {
  // Rename ligne 1
  const label = page.locator('.row-label').first()
  await label.fill('Ma Une test')
  await expect(page.locator('.row-label').first()).toHaveValue('Ma Une test')

  // Duplicate via hover (bouton visible au survol)
  await page.locator('.slide-row').first().hover()
  await page.locator('.slide-row').first().locator('.row-btn', { hasText: '⧉' }).click()
  expect(await deckCount(page)).toBe(2)

  // Undo → 1, redo → 2
  await page.locator('button[title="Annuler (Ctrl+Z)"]').click()
  expect(await deckCount(page)).toBe(1)
  await page.locator('button[title="Rétablir (Ctrl+Y)"]').click()
  expect(await deckCount(page)).toBe(2)

  // Suppression ligne 2
  await page.locator('.slide-row').nth(1).hover()
  await page.locator('.slide-row').nth(1).locator('.row-btn.danger').click()
  expect(await deckCount(page)).toBe(1)
})

test('deck : refus de supprimer la dernière slide', async ({ page }) => {
  expect(await deckCount(page)).toBe(1)
  await page.locator('.slide-row').first().hover()
  await page.locator('.slide-row').first().locator('.row-btn.danger').click()
  expect(await deckCount(page)).toBe(1)
})

test('formats : 1:1, 9:16, 16:9 changent les dimensions du stage', async ({ page }) => {
  const stage = page.locator('.slide-stage')
  const dims: Record<string, [number, number]> = {
    '1:1': [1080, 1080],
    '9:16': [1080, 1920],
    '16:9': [1920, 1080],
    '4:5': [1080, 1350],
  }
  for (const [id, [w, h]] of Object.entries(dims)) {
    await page.locator('.format-btn', { hasText: id }).first().click()
    await page.waitForTimeout(200)
    const box = await stage.boundingBox()
    // Dimensions CSS = taille réelle × échelle viewport : on lit le style inline.
    const style = await stage.getAttribute('style')
    expect(style, `format ${id}`).toContain(`width: ${w}px`)
    expect(style, `format ${id}`).toContain(`height: ${h}px`)
    expect(box).not.toBeNull()
  }
})

test('persistance : reload restaure le deck', async ({ page }) => {
  await page.locator('.add-btn').click()
  await page.locator('.add-item', { hasText: 'Comparatif Versus' }).first().click()
  expect(await deckCount(page)).toBe(2)
  await page.waitForTimeout(900) // debounce autosave 600ms
  await page.reload()
  await expect(page.locator('.slide-stage')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(500)
  expect(await deckCount(page)).toBe(2)
})
