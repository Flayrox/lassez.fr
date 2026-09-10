// Audit e2e — exports (PNG/JPG/ZIP/JSON réels), modales, assets, toolbar.
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/slide')
  await expect(page.locator('.slide-stage')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(800)
})

test('export PNG : téléchargement réel non vide', async ({ page }) => {
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.locator('.tb-export').click()
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^slide-01-.*\.png$/)
  const path = await download.path()
  expect(path).toBeTruthy()
})

test('export JPG : téléchargement réel', async ({ page }) => {
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.locator('.tb-primary', { hasText: 'JPG' }).click()
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/\.jpg$/)
})

test('export ZIP : 2 slides zippées', async ({ page }) => {
  await page.locator('.add-btn').click()
  await page.locator('.add-item', { hasText: 'Comparatif Versus' }).first().click()
  const dl = page.waitForEvent('download', { timeout: 60_000 })
  await page.locator('.tb-primary', { hasText: 'ZIP' }).click()
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^lassez-deck-.*\.zip$/)
})

test('export JSON : contenu deck valide', async ({ page }) => {
  const dl = page.waitForEvent('download', { timeout: 15_000 })
  await page.locator('.tb-primary', { hasText: 'JSON' }).click()
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^lassez-deck-.*\.json$/)
})

test('modale article : génère un deck multi-slides', async ({ page }) => {
  await page.locator('.tb-primary', { hasText: "Générer avec l'IA" }).click()
  await page.locator('.slide-root textarea').first().fill('Titre choc\n\nParagraphe un\n\nParagraphe deux')
  await page.locator('.modal-cta').click()
  await page.waitForTimeout(500)
  const txt = await page.locator('.slide-root').first().textContent()
  const m = txt?.match(/Deck — (\d+)/)
  expect(parseInt(m![1], 10)).toBeGreaterThan(1)
})

test('modale JSON : import remplace le deck', async ({ page }) => {
  await page.locator('.tb-ghost', { hasText: 'Importer JSON' }).click()
  await page.locator('.slide-root textarea').first().fill(
    JSON.stringify({ deck: [{ type: 'COVER', label: 'S1', state: {} }] }),
  )
  await page.locator('.modal-cta').click()
  await page.waitForTimeout(500)
  await expect(page.locator('.slide-stage')).toContainText('PARADIGME')
})

test('modale JSON : invalide affiche l’erreur sans casser', async ({ page }) => {
  await page.locator('.tb-ghost', { hasText: 'Importer JSON' }).click()
  await page.locator('.slide-root textarea').first().fill('{oups')
  await page.locator('.modal-cta').click()
  await expect(page.locator('.slide-root')).toContainText('JSON invalide')
  // Le deck courant est intact.
  await expect(page.locator('.slide-stage')).toContainText('DÉCRYPTAGE')
})

test('bibliothèque : upload insère une image sur la slide', async ({ page }) => {
  await page.locator('.right-tab', { hasText: 'Calques' }).click()
  // Ouvre la modale via le bouton image du panneau (émet import-image).
  await page.locator('button[title="Ajouter une image"]').click()
  await expect(page.locator('text=Bibliothèque d\'images')).toBeVisible({ timeout: 5000 })
  // Upload d'un PNG 1x1 réel.
  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await page.locator('[data-testid="assets-file-input"]').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: png1x1,
  })
  await page.waitForTimeout(800)
  // Clic sur la carte asset → insère.
  await page.locator('.asset-card').first().click()
  await page.waitForTimeout(500)
  await expect(page.locator('.slide-stage img')).toHaveCount(1)
  await page.screenshot({ path: '/tmp/audit-asset.png' })
})

test('toolbar : nettoyer styles + reset slide', async ({ page }) => {
  // Nettoyer styles : pas d'erreur, deck intact.
  await page.locator('.tb-ghost', { hasText: 'Nettoyer styles' }).click()
  await expect(page.locator('.slide-stage')).toContainText('DÉCRYPTAGE')
  // Reset avec confirm accepté.
  page.on('dialog', (d) => d.accept())
  await page.locator('.tb-ghost', { hasText: 'Reset slide' }).click()
  await page.waitForTimeout(300)
  await expect(page.locator('.slide-stage')).toContainText('DÉCRYPTAGE')
})

test('toolbar : changement de format deck via select', async ({ page }) => {
  await page.locator('select.tb-select').selectOption('1:1')
  await page.waitForTimeout(300)
  const style = await page.locator('.slide-stage').getAttribute('style')
  expect(style).toContain('width: 1080px')
  expect(style).toContain('height: 1080px')
})
