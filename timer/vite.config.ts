import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const versione = JSON.parse(readFileSync('./package.json', 'utf8')).version as string

/**
 * Il commit da cui è compilata questa copia.
 *
 * Il numero di versione dice a che punto è il progetto; il commit dice quale
 * copia esatta stai guardando, ed è quello che serve quando si prova una cosa
 * sul telefono e si vuole sapere se è già dentro. Fuori da un repository — o
 * in un archivio scaricato — non c'è, e la riga si limita al numero.
 */
function commit(): string {
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

export default defineConfig({
  // Il momento della compilazione, mostrato nelle impostazioni: su un tablet
  // in sala «che versione sto guardando?» è una domanda che capita davvero.
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(versione),
    __APP_COMMIT__: JSON.stringify(commit()),
  },
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
        name: 'ODS Timer — Officine Dello Sport',
        short_name: 'ODS Timer',
        description: 'Interval timer di Officine Dello Sport, Collegno. Tabata, EMOM, AMRAP, circuiti.',
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
        // Senza queste due il service worker nuovo si installa e resta in
        // attesa che tutte le schede si chiudano: su un'app installata, che
        // non si chiude mai davvero, vuol dire non aggiornarsi mai.
        // `registerType: 'autoUpdate'` da solo non le accende, perché la
        // registrazione la facciamo a mano invece di lasciarla al plugin.
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Le clip della voce: alla prima richiesta entrano in cache e da lì
            // valgono anche senza rete. Non sono nella precache perché servono
            // solo a chi tiene accesa la voce, e senza si ricade sulla sintesi.
            urlPattern: /\/voce\/.*\.(mp3|m4a|ogg|wav|webm|json)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ods-voce',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Le schermate della guida: stessa logica delle illustrazioni. La
            // guida in sé è precaricata — sono cinquanta kilobyte — ma le sue
            // immagini si scaricano solo se qualcuno la apre davvero.
            urlPattern: /\/guida\/.*\.webp$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ods-guida',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Le illustrazioni della modalità Maurizio pesano mezzo mega: non
            // entrano nella precache, si scaricano solo se qualcuno usa la
            // modalità, e da lì restano disponibili anche offline.
            urlPattern: /\/adesivi\/.*\.webp$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ods-adesivi',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // I font restano disponibili anche senza rete, dopo il primo caricamento.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ods-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
