import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// La versione dell'app: il numero di package.json e il commit da cui è
// compilata, così chi segnala un problema dal tablet dice anche quale app ha.
// Su GitHub Actions il commit c'è in GITHUB_SHA; in locale lo si chiede a git,
// e fuori da un repository resta senza.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
// Il timer sta anche dentro il tablet di sala (vedi `TimerSala.tsx`): le sue
// impostazioni dicono la sua versione, non quella di ODS Corsi.
const { version: versioneTimer } = JSON.parse(readFileSync(new URL('./timer/package.json', import.meta.url), 'utf8')) as { version: string }
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

// Le aree con un indirizzo vero: vedi `src/lib/aree.ts`.
const AREE = ['segreteria', 'iscrizioni', 'iscritti', 'istruttori', 'sala']
const BASE = '<base href="../">'
const conBase = (html: string) => html.replace(/<head>/i, `<head>\n    ${BASE}`)

/**
 * Una pagina per area, `segreteria/index.html` e le altre: GitHub Pages serve
 * solo file che ci sono, e senza quelle `…/ods-corsi/segreteria/` sarebbe un
 * 404. Sono la stessa pagina della radice con `<base href="../">`, così i
 * file relativi (`./assets/…`, le icone, i moduli, il timer) si prendono da
 * lì e l'app è una sola, con un service worker solo che le precarica tutte.
 *
 * In sviluppo il server risponde già con la pagina a ogni indirizzo: qui gli
 * si aggiunge la base, e la barra finale a chi la dimentica (senza, `../`
 * uscirebbe dalla cartella del sito).
 */
function pagineDelleAree(): Plugin {
  const dellArea = new RegExp(`^(.*/(?:${AREE.join('|')}))(/|/index\\.html)?(\\?.*)?$`)
  return {
    name: 'ods-pagine-delle-aree',
    enforce: 'post',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url ? dellArea.exec(req.url) : null
        if (m && !m[2]) {
          res.statusCode = 301
          res.setHeader('Location', `${m[1]}/${m[3] ?? ''}`)
          res.end()
          return
        }
        next()
      })
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        return ctx.server && ctx.originalUrl && dellArea.test(ctx.originalUrl) ? conBase(html) : html
      },
    },
    generateBundle(_, bundle) {
      const radice = bundle['index.html']
      if (!radice || radice.type !== 'asset') return
      for (const area of AREE) {
        this.emitFile({ type: 'asset', fileName: `${area}/index.html`, source: conBase(String(radice.source)) })
      }
    },
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
    // Quelle del timer, che qui dentro è la scheda TIMER del tablet di sala:
    // i suoi file (voce, illustrazioni, guida) stanno in `timer/`.
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(versioneTimer),
    __APP_COMMIT__: JSON.stringify(commit()),
    __TIMER_RADICE__: JSON.stringify('timer/'),
  },
  // Il timer ha le sue dipendenze in `timer/node_modules`: senza, i suoi file
  // prenderebbero da lì una seconda copia di React, e due React nella stessa
  // pagina non si parlano.
  resolve: { dedupe: ['react', 'react-dom', '@supabase/supabase-js'] },
  // pdf-lib, per il modulo firmato dal telefono, in un pezzo col suo nome:
  // serve solo a chi si iscrive, e non entra nella cache di tutti (vedi sotto).
  build: {
    rollupOptions: {
      output: { manualChunks: (id) => (/node_modules\/(@pdf-lib|pdf-lib|pako|tslib)\//.test(id) ? 'pdf-lib' : undefined) },
    },
  },
  plugins: [
    react(),
    pagineDelleAree(),
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
        // La query non cambia la pagina: `segreteria/?prova` è `segreteria/`.
        // Senza, la pagina di un'area con `?prova` o `?adesso=…` non si
        // trovava fra quelle salvate, e il service worker rispondeva con la
        // radice, che non ha `<base href="../">` (vedi `pagineDelleAree`):
        // lo stile e i moduli si cercavano in `segreteria/assets/`, e la
        // pagina restava bianca.
        ignoreURLParametersMatching: [/.*/],
        // Le pagine a sé, come l'informativa, restano quelle: senza, il
        // service worker a ogni indirizzo risponde con l'app. Lo stesso i
        // moduli in PDF: aperti in una scheda, senza, si vedeva una pagina bianca.
        //
        // Il timer, in `timer/`, ha il suo service worker: questo non deve
        // rispondere con ODS Corsi alle sue pagine, né precaricarne i file.
        navigateFallbackDenylist: [/informativa\.html$/, /\/moduli\//, /\.pdf$/, /\/timer(\/|$)/],
        // Né pdf-lib: 180 KB che scarica solo chi firma il modulo, quando lo firma.
        // Né i luoghi di nascita, altri 175 KB che servono solo al modulo.
        globIgnores: ['timer/**', 'assets/pdf-lib-*.js', 'assets/luoghi-*.js'],
        // La voce e le illustrazioni del timer, chieste dal tablet di sala che
        // lo contiene: come nel timer, entrano in cache alla prima richiesta.
        // Stessi nomi delle cache del timer: la cache è una per il sito, e
        // una clip scaricata da una delle due app vale anche per l'altra.
        runtimeCaching: [
          {
            urlPattern: /\/timer\/voce\/.*\.(mp3|m4a|ogg|wav|webm|json)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ods-voce',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/timer\/adesivi\/.*\.webp$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ods-adesivi',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
