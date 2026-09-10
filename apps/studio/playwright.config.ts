import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4405',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome système (pas de téléchargement navigateur).
        channel: 'chrome',
        viewport: { width: 1600, height: 900 },
      },
    },
  ],
  // Les serveurs tournent déjà (daemon :4406 + studio :4405) — pas de webServer
  // ici pour garder la main sur les logs ; la CI pourra les déclarer plus tard.
})
