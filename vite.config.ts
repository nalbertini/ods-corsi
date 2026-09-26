import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Percorsi relativi: l'app funziona anche servita da una sottocartella,
  // non solo dalla radice del dominio.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // La registrazione la facciamo a mano in main.tsx, per poterla fallire in pace.
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'ODS Corsi — Officine Dello Sport',
        short_name: 'ODS Corsi',
        description: 'Calendario dei corsi e registro delle presenze di Officine Dello Sport, Collegno.',
        lang: 'it',
        start_url: '.',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#121212',
        theme_color: '#121212',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // Senza queste due il service worker nuovo resta in attesa che tutte
        // le schede si chiudano: su un'app installata vuol dire mai.
        skipWaiting: true,
        clientsClaim: true,
        // Le pagine a sé, come l'informativa, restano quelle: senza, il
        // service worker a ogni indirizzo risponde con l'app.
        navigateFallbackDenylist: [/informativa\.html$/],
        runtimeCaching: [
          {
            // Il nome della cache ha il prefisso dell'app: sullo stesso dominio
            // del timer la Cache Storage è una sola, come il localStorage.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ods-corsi-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
