/**
 * La Content-Security-Policy delle pagine. GitHub Pages non dà header, quindi
 * sta in una `<meta>` (vite.config.ts la mette in ogni pagina compilata): lì
 * `frame-ancestors`, `report-uri` e `sandbox` non valgono, e non si scrivono.
 *
 * Gli script sono solo i nostri (`'self'`) più il lettore di YouTube del timer.
 * Gli stili in pagina restano ammessi: React e Puck li scrivono, e l'anteprima
 * del sito (iframe `srcdoc`) ha il suo `<style>`. Le immagini e l'audio
 * possono venire da https: le foto del sito e le radio le sceglie la segreteria.
 */
export function politicaCsp(urlSupabase: string | undefined): string {
  const connect = ["'self'", 'https://accounts.spotify.com', 'https://api.spotify.com']
  try {
    // Dall'indirizzo si prende solo l'origine: il resto (`/rest/v1`) non conta.
    const { protocol, host } = new URL(urlSupabase ?? '')
    if (protocol === 'https:') connect.push(`https://${host}`, `wss://${host}`)
  } catch {
    // Modalità prova: nessun database.
  }
  return [
    "default-src 'self'",
    "script-src 'self' https://www.youtube.com https://s.ytimg.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/**
 * Toglie da un CSS gli `@import` di altri siti. Il CSS di Puck importa il font Inter da
 * rsms.me, che la nostra CSP blocca: il font non arriva comunque, e l'errore in console
 * confonde chi cerca perché l'editor non si apre.
 */
export function senzaImportEsterni(css: string): string {
  return css.replace(/@import\s*(?:url\(\s*)?["']?https?:\/\/[^;]*;/g, '')
}
