// ---------------------------------------------------------------------------
// Il testo della pagina Corsi rivista, come lo scriverebbe la segreteria. Le 9 schede sono
// quelle vere di docs/sito/home.html (stessa fonte: la Home e Corsi non devono divergere).
// Lo usa prova-sito-corsi-nuova.mjs.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { ISCRIZIONE, DOMINIO, P, MENU } from './fixture-home-nuova.mjs'

export { ISCRIZIONE, DOMINIO, P }
export const FRASE = 'Per bambini, ragazzi e adulti, a ogni età e livello: tecnica, benessere e relazione vanno nella stessa direzione.'
const home = readFileSync(new URL('../docs/sito/home.html', import.meta.url), 'utf8')
const dopo = home.slice(home.indexOf('<h2>I nostri corsi</h2>'))
const sez = dopo.slice(dopo.indexOf('<h3>'), dopo.indexOf('<h2>', 10))
/** Le 9 schede di home.html, da «<h3>Judo» fino all'ultima. */
export const SCHEDE_HOME = sez.trim()
/** Gli h3 di una sola scheda, per nome (serve a togliere o sostituire una scheda). */
export const scheda = (nome) => SCHEDE_HOME.split(/(?=<h3>)/).find((s) => s.includes(`>${nome}</a>`))

export const PULSANTE = `<a class="pulsante" href="${ISCRIZIONE}">Prova una settimana a 5 €</a>`
export const CTA = (foto = true, bottoni = `<p>${PULSANTE} <a class="pulsante" href="/contatti/">Scrivici</a></p>`) =>
  `<h2>Una settimana per scegliere.</h2><p>5 € e provi tutte le discipline.</p>${bottoni}${foto ? `<img src="${P}814a717b-91a2-441c-b34c-ef376d4781c6.jpg" alt="Gli istruttori" />` : ''}`

export const TESTO_NUOVO = `<p>${FRASE}</p>${SCHEDE_HOME}${CTA()}`
/** Lo stesso testo senza alcun pulsante: la pagina Corsi di oggi. */
export const TESTO_SENZA_PULSANTE = `<p>${FRASE}</p>${SCHEDE_HOME}<h2>Una settimana per scegliere.</h2><p>5 € e provi tutte le discipline.</p>`

const pag = (slug, titolo, testo, descrizione = 'Descrizione dei corsi.') => ({ slug, titolo, descrizione, testo })
export const dati = (testoCorsi, slug = 'corsi', extra = {}) => ({
  dominio: DOMINIO,
  pagine: [pag('home', 'Home', '<p>Home</p>'), pag(slug, 'I nostri corsi', testoCorsi), pag('contatti', 'Contatti', '<p>Scrivici.</p>')].filter((p, i, a) => a.findIndex((q) => q.slug === p.slug) === i),
  menu: MENU,
  rinvii: [],
  ospitiImmagini: ['https://qfejpnkryrvjubcxvuco.supabase.co/storage/v1/object/public/sito/', P],
  ...extra,
})
