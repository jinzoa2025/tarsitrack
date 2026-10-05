import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['tracker-icon-192.png', 'tracker-icon-512.png'],
    manifest: {
      name: 'Tracker · Family Finance',
      short_name: 'Tracker',
      description: 'Simple payday sheets and family finance.',
      theme_color: '#f6f7f3',
      background_color: '#f6f7f3',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/tracker-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/tracker-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/index.html',
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    },
  })],
})
