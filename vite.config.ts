import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// La versione dell'app: il numero di package.json e il commit da cui è
// compilata, così chi segnala un problema dal tablet dice anche quale app ha.
// Su GitHub Actions il commit c'è in GITHUB_SHA; in locale lo si chiede a git,
// e fuori da un repository resta senza.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

export default defineConfig({
  // Percorsi relativi: l'app funziona anche servita da una sottocartella,
  // non solo dalla radice del dominio.
  base: './',
  define: {
    __VERSIONE__: JSON.stringify(version),
    __COMMIT__: JSON.stringify(commit()),
    __COMPILATA__: JSON.stringify(new Date().toISOString()),
  },
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
        // service worker a ogni indirizzo risponde con l'app. Lo stesso i
        // moduli in PDF: aperti in una scheda, senza, si vedeva una pagina bianca.
        //
        // Il timer, in `timer/`, ha il suo service worker: questo non deve
        // rispondere con ODS Corsi alle sue pagine, né precaricarne i file.
        navigateFallbackDenylist: [/informativa\.html$/, /\/moduli\//, /\.pdf$/, /\/timer(\/|$)/],
        globIgnores: ['timer/**'],
      },
    }),
  ],
})
