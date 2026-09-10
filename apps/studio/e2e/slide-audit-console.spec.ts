// Audit e2e — zéro erreur console/pageerror au chargement et pendant un tour
// complet (ajout slide/couches, modales, undo, formats).
import { expect, test } from '@playwright/test'

test('console propre pendant un tour complet', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const loc = msg.location().url ? ` @ ${msg.location().url}` : ''
      errors.push(`console: ${msg.text().slice(0, 200)}${loc}`)
    }
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${String(err).slice(0, 300)}`))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http-${r.status()}: ${r.url().slice(0, 200)}`)
  })

  await page.goto('/slide')
  await expect(page.locator('.slide-stage')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(800)

  // Tour : catalogue, couches, onglets, modales, undo, format.
  await page.locator('.add-btn').click()
  await page.locator('.add-item', { hasText: 'Comparatif Versus' }).first().click()
  await page.locator('.right-tab', { hasText: 'Calques' }).click()
  await page.locator('button[title="Ajouter un texte"]').click()
  await page.locator('button[title="Ajouter une forme"]').click()
  await page.waitForTimeout(400)
  await page.locator('.right-tab', { hasText: 'Propriétés' }).click()
  await page.locator('.tb-primary', { hasText: "Générer avec l'IA" }).click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.locator('.tb-ghost', { hasText: 'Importer JSON' }).click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.keyboard.press('ControlOrMeta+z')
  await page.waitForTimeout(300)
  await page.locator('.format-btn', { hasText: '1:1' }).first().click()
  await page.waitForTimeout(400)

  const benign = [/favicon/i, /net::ERR_INTERNET_DISCONNECTED/i]
  const real = errors.filter((e) => !benign.some((b) => b.test(e)))
  expect(real, `erreurs console:\n${real.join('\n')}`).toEqual([])
})
