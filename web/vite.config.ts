import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// Application 100 % statique : le service worker met en cache le « shell » pour le mode hors ligne.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Vigilis',
        short_name: 'Vigilis',
        description: 'Détection et signalement des situations à risque (version démo, données simulées).',
        lang: 'fr',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        background_color: '#f4f6fb',
        theme_color: '#0b1220',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
