import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Ports dédiés « jamais utilisés » : labo 4405, daemon 4406 (surchargeables
// via LABO_PORT / DAEMON_PORT). Domaine dev : http://studio.lassez.test:4405 —
// scripts/dev-domain.sh ajoute l'entrée 127.0.0.1 dans /etc/hosts et démarre
// le daemon sur 127.0.0.1:4406. En prod, même domaine derrière nginx.
const laboPort = Number(process.env.LABO_PORT ?? 4405)
const daemonPort = Number(process.env.DAEMON_PORT ?? 4406)

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: laboPort,
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
