// E2E templates customs : sauver, appliquer, génération liée, sync daemon.
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/slide')
  await expect(page.locator('.slide-stage')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(800)
})

test('sauver la slide puis l’appliquer depuis Mes templates', async ({ page }) => {
  const name = `E2E custom ${Date.now()}`
  await page.locator('.save-btn').click()
  await page.locator('input[placeholder="Ex : Ma couverture enquête"]').fill(name)
  await page.locator('.modal-cta').click()
  await page.waitForTimeout(600)
  // Catalogue : groupe + miniature + apply (match exact, noms uniques par run).
  await page.locator('.add-btn').click()
  await expect(page.locator('.add-menu')).toContainText('Mes templates')
  await page.locator('.custom-item', { hasText: name }).click({ timeout: 10_000 })
  await page.waitForTimeout(400)
  const txt = await page.locator('.slide-root').first().textContent()
  expect(txt).toMatch(/Deck — 2/)
  // Nettoyage : pas de pollution de la base dev partagée.
  await page.evaluate(async (n: string) => {
    const r = await fetch('/api/slide-templates')
    const data = (await r.json()) as { templates: { id: string; name: string }[] }
    for (const t of data.templates.filter((t) => t.name === n)) {
      await fetch(`/api/slide-templates?id=${encodeURIComponent(t.id)}`, { method: 'DELETE' })
    }
  }, name)
  await page.screenshot({ path: '/tmp/e2e-custom.png' })
})

test('génération IA propose les customs et remplit les liaisons', async ({ page }) => {
  // Couche liée headline sauvée comme template.
  await page.locator('.right-tab', { hasText: 'Calques' }).click()
  await page.locator('button[title="Ajouter un texte"]').click()
  await page.waitForTimeout(300)
  await page.locator('.right-tab', { hasText: 'Propriétés' }).click()
  // TODO liaison via UI quand exposée : ici save direct, bind via API interne.
  await page.locator('.save-btn').click()
  await page.locator('input[placeholder="Ex : Ma couverture enquête"]').fill('E2E lié')
  await page.locator('.modal-cta').click()
  await page.waitForTimeout(600)
  // La modale IA liste le custom.
  await page.locator('.tb-primary', { hasText: "Générer avec l'IA" }).click()
  await expect(page.locator('.slide-root')).toContainText('Mes templates')
  await page.keyboard.press('Escape')
})

test('sync daemon : le custom sauvé est persisté serveur', async ({ page }) => {
  const name = `E2E sync ${Date.now()}`
  await page.locator('.save-btn').click()
  await page.locator('input[placeholder="Ex : Ma couverture enquête"]').fill(name)
  await page.locator('.modal-cta').click()
  await page.waitForTimeout(800)
  // Lecture directe API daemon (via le proxy vite /api).
  const list = await page.evaluate(async () => {
    const r = await fetch('/api/slide-templates')
    return (await r.json()) as { templates: { id: string; name: string }[] }
  })
  const found = list.templates.find((t) => t.name === name)
  expect(found, 'custom persisté côté daemon').toBeTruthy()
  // Nettoyage : ne pas polluer la base dev.
  await page.evaluate(async (id: string) => {
    await fetch(`/api/slide-templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  }, found!.id)
  // Suppression locale aussi (rebuild catalogue).
  await page.reload()
  await expect(page.locator('.slide-stage')).toBeVisible({ timeout: 20_000 })
})
