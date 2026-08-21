import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Proxy dev : /api → daemon Go (:2506). En prod, même domaine derrière nginx.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 2505,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:2506',
    },
  },
})
