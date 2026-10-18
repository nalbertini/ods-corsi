/**
 * La pagina «Orari» del sito (docs/design-canvas/orari-sito/): dagli orari tipo dei corsi attivi, come li dà `orari_sito()`
 * (`supabase/68-orari-sito.sql`), a una tessera per giorno. Le regole le prova `scripts/prova-sito-orari.mjs`.
 *
 * La pagina si riconosce dallo slug «orari» e da un paragrafo che dice solo «[orari]»: il testo prima è l'introduzione, quello
 * dopo la riga «Per variazioni contatta…». Senza il segnaposto la pagina resta com'è scritta, e gli orari scritti a mano restano.
 * Niente data di oggi: «Aggiornato al» viene dai dati, così gli stessi dati danno gli stessi file.
 */

import { blocchi, testoSolo } from './sitoLayout'
import { esc } from './sitoHome'
import { scrivi } from './sito'

/** Una riga di `orari_sito()`: `ora` è un «time» di Postgres («HH:MM:SS»), `modificata_il` un istante con fuso. */
export interface OrarioSito {
  corso: string
  /** 0 = domenica, come `getDay()`. */
  giorno: number
  ora: string
  durata_min: number
  modificata_il: string
}

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const hhmm = (minuti: number) => `${String(Math.floor(minuti / 60) % 24).padStart(2, '0')}:${String(minuti % 60).padStart(2, '0')}`

/** Da lunedì a domenica, poi per ora, poi per nome. Una riga che non si legge (giorno o ora strani) si salta: la pagina si genera lo stesso. */
function ordinate(righe: OrarioSito[]) {
  return righe
    .flatMap((r) => {
      const m = /^(\d{1,2}):(\d{2})/.exec(r.ora)
      if (!m || !GIORNI[r.giorno]) return []
      const inizio = Number(m[1]) * 60 + Number(m[2])
      return [{ giorno: r.giorno, inizio, ora: `${hhmm(inizio)}–${hhmm(inizio + r.durata_min)}`, corso: r.corso }]
    })
    .sort((a, b) => ((a.giorno + 6) % 7) - ((b.giorno + 6) % 7) || a.inizio - b.inizio || a.corso.localeCompare(b.corso, 'it'))
}

/** «Martedì 19:00–20:00 · Preparazione atletica», nell'ordine della settimana. */
export const vociOrari = (righe: OrarioSito[]): string[] => ordinate(righe).map((r) => `${GIORNI[r.giorno]} ${r.ora} · ${r.corso}`)

/** Le voci raccolte per giorno, nell'ordine della settimana; un giorno senza lezioni non c'è. */
export function giorniOrari(righe: OrarioSito[]): Array<{ giorno: string; voci: Array<{ ora: string; corso: string }> }> {
  const fuori: Array<{ giorno: string; voci: Array<{ ora: string; corso: string }> }> = []
  for (const r of ordinate(righe)) {
    const nome = GIORNI[r.giorno]
    if (fuori[fuori.length - 1]?.giorno !== nome) fuori.push({ giorno: nome, voci: [] })
    fuori[fuori.length - 1].voci.push({ ora: r.ora, corso: r.corso })
  }
  return fuori
}

/** «18 ottobre 2026»: la modifica più recente fra gli orari, nel giorno di Roma. Senza orari, niente data. */
export function aggiornatoAl(righe: OrarioSito[]): string | null {
  const quando = righe.map((r) => Date.parse(r.modificata_il)).filter(Number.isFinite)
  if (!quando.length) return null
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long', year: 'numeric' }).format(Math.max(...quando))
}

/** Il testo prima e dopo il paragrafo «[orari]», o niente se il paragrafo non c'è. */
export function dividiOrari(testoPulito: string): { prima: string; dopo: string } | null {
  const b = blocchi(testoPulito)
  const i = b.findIndex((x) => x.tag === 'p' && /^\[orari\]$/i.test(testoSolo(x.html)))
  if (i < 0) return null
  return { prima: b.slice(0, i).map((x) => x.html).join(''), dopo: b.slice(i + 1).map((x) => x.html).join('') }
}

/** Le tessere dei giorni (o «Orari in arrivo»), la fascia con le variazioni e la data. `html` va in `<main>` dopo la testata. */
export function orariHtml(dopo: string, righe: OrarioSito[]): string {
  // Il numero è quello dei recapiti del sito (`CONTATTI`), mai scritto qui.
  const giorni = giorniOrari(righe)
  const data = giorni.length ? aggiornatoAl(righe) : null
  const tessere = giorni.length
    ? `<div class="orari">${giorni.map((g) => `<article class="giorno"><h2>${g.giorno}</h2><ul>${g.voci.map((v) => `<li><span class="ora">${v.ora}</span><span class="corso">${esc(v.corso)}</span></li>`).join('')}</ul></article>`).join('')}</div>`
    : '<div class="orari-vuoto"><p>Orari in arrivo</p></div>'
  const tasto = `<a class="pulsante primario" href="${esc(scrivi('Ciao, vorrei informazioni sugli orari.'))}" rel="noopener noreferrer">Scrivici su WhatsApp</a>`
  const nota = `<section class="orari-nota"><div class="variazioni">${dopo ? `<div class="testo-variazioni">${dopo}</div>` : ''}${tasto}</div>${data ? `<p class="aggiornato">Aggiornato al ${data}</p>` : ''}</section>`
  return `<section class="orari-giorni">${tessere}</section>${nota}`
}

/** Sotto `main.pagina-orari` (che ha già le regole della Home): le misure sono quelle del design a 1440px e a 375px. */
export const CSS_ORARI = `
.pagina-orari h1{font-size:clamp(92px,13.9vw,200px);line-height:.84;letter-spacing:-.01em}
.pagina-orari .intro p{max-width:760px}
.orari-giorni{padding:56px var(--margine) 0}
.orari{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.orari .giorno{padding:24px 24px 12px;border-radius:6px;background:var(--chiara);color:var(--inchiostro)}
.orari .giorno h2{margin:0 0 12px;font-family:var(--display);font-size:44px;font-weight:800;line-height:.95;text-transform:uppercase}
.orari ul{margin:0;padding:0;list-style:none}
.orari li{display:flex;flex-direction:column;gap:2px;margin:0;padding:12px 0;border-top:2px solid var(--fondo)}
.orari .ora{flex:none;font-family:var(--display);font-size:30px;font-weight:800;line-height:1;white-space:nowrap}
.orari .corso{font-size:18px;font-weight:600;line-height:1.35;overflow-wrap:anywhere}
.orari-vuoto{display:flex;flex-direction:column;justify-content:center;min-height:280px;padding:56px 48px;border-radius:6px;background:var(--chiara);color:var(--inchiostro)}
.orari-vuoto p{margin:0;max-width:none;font-family:var(--display);font-size:96px;font-weight:800;line-height:.9;text-transform:uppercase}
.orari-nota{padding:6px var(--margine) 0}
.orari-nota .variazioni{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:32px 40px;border-radius:6px;background:var(--inchiostro);color:#fff;font-size:22px;line-height:1.45}
.orari-nota .testo-variazioni{max-width:760px}
.orari-nota .testo-variazioni>*{margin:0}
.orari-nota .testo-variazioni>*+*{margin-top:12px}
.orari-nota .testo-variazioni a{color:inherit}
.orari-nota .pulsante{flex:none;min-height:56px;padding:0 28px;font-size:17px}
.orari-nota .aggiornato{margin:16px 0 0;font-size:16px;font-weight:500;line-height:1.5}
@media (max-width:900px){
.pagina-orari h1{font-size:84px}
.orari-giorni{padding-top:32px}
.orari{grid-template-columns:1fr}
.orari .giorno{padding:20px 20px 8px}
.orari .giorno h2{margin-bottom:8px;font-size:36px}
.orari li{flex-direction:row;gap:16px}
.orari .ora{width:128px;font-size:24px}
.orari .corso{font-size:17px}
.orari-vuoto{min-height:200px;padding:32px 24px}
.orari-vuoto p{font-size:56px}
.orari-nota .variazioni{flex-direction:column;align-items:flex-start;padding:24px 20px;font-size:18px}
.orari-nota .pulsante{width:100%}
.orari-nota .aggiornato{font-size:15px}
}
`
