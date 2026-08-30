import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Ports dédiés « jamais utilisés » : studio 4405, daemon 4406 (surchargeables
// via STUDIO_PORT / DAEMON_PORT). Domaine dev : http://studio.lassez.test:4405 —
// scripts/dev-domain.sh ajoute l'entrée 127.0.0.1 dans /etc/hosts et démarre
// le daemon sur 127.0.0.1:4406. En prod, même domaine derrière nginx.
const studioPort = Number(process.env.STUDIO_PORT ?? 4405)
const daemonPort = Number(process.env.DAEMON_PORT ?? 4406)

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: studioPort,
    strictPort: true,
    // Hôte custom (protection DNS rebinding de Vite) : autorise
    // studio.lassez.test, lassez.test et tous leurs sous-domaines.
    allowedHosts: ['.lassez.test'],
    proxy: {
      // Proxy dev : /api → daemon Go (:4406).
      '/api': `http://localhost:${daemonPort}`,
    },
  },
})
