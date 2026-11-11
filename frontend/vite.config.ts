import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En développement, Vite redirige /api et /ws vers le backend Spring Boot (port 8081).
// host: true rend le serveur accessible depuis les téléphones du même réseau Wi-Fi.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    proxy: {
      '/api': 'http://localhost:8081',
      '/ws': { target: 'ws://localhost:8081', ws: true },
    },
  },
})
