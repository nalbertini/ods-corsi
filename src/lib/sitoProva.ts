import { controllaMenu, controllaSlug, MASSIMO_DESCRIZIONE, MASSIMO_TITOLO, pagineDiLeggeProtette, testoTroppoLungo, type PaginaSito, type VoceMenu } from './sitoPagine'
import { testoSicuro } from './sitoTesto'
import { pezziInHtml, pezziValidi, type PezziPagina } from './sitoPezzi'
import type { OrarioSito } from './sitoOrari'
import { TRACCIA_ACCESSIBILITA } from './sitoAccessibilita'

/**
 * Le regole di `supabase/56-sito.sql` rifatte in memoria, per la modalità
 * prova: le stesse frasi, gli stessi rifiuti. Ogni funzione prende lo stato e
 * ne dà uno nuovo (o lancia l'errore che darebbe il database), così si prova
 * senza browser.
 *
 * Una differenza voluta: `testoSicuro` qui è più stretto del filtro del database
 * (`sito_testo_sicuro`): rifiuta ogni testo che la pulizia cambierebbe, non solo
 * quello con codice. Il pannello ripulisce prima di salvare, quindi per chi lo usa
 * non cambia; il database si prende anche chi scrive all'API.
 */

export interface StatoSito {
  pagine: PaginaSito[]
  menu: VoceMenu[]
  footer: VoceMenu[]
  /** I vecchi indirizzi di pagine che ne hanno cambiato: il sito li manda al nuovo. */
  rinvii?: Array<{ da: string; a: string }>
}

const CAMBIATA = 'La pagina è cambiata mentre la modificavi: ricaricala per vedere le modifiche di chi l’ha toccata'
const NON_C_E = 'La pagina non c’è più'
const TITOLO_NO = `Il titolo va da 1 a ${MASSIMO_TITOLO} lettere`
const DESCRIZIONE_NO = `La descrizione arriva al massimo a ${MASSIMO_DESCRIZIONE} lettere`
const TESTO_NO = 'Il testo contiene cose che il sito non ammette (script, moduli, stili): toglile e riprova'

let contatore = 0
const nuovoId = () => `sp-${Date.now().toString(36)}-${++contatore}`

/** Le pagine che il sito ha sempre, come dopo `56-sito.sql`, con qualche testo d'esempio. */
export function sitoIniziale(): StatoSito {
  const pagina = (slug: string, titolo: string, o: Partial<PaginaSito> = {}): PaginaSito => ({
    id: `sp-${slug}`,
    slug,
    titolo,
    descrizione: '',
    bozza: '',
    pezzi: null,
    corsiCollegati: [],
    pubblicato: null,
    nascosta: false,
    diLegge: false,
    versione: 1,
    ...o,
  })
  const pre = '<h2>Cos’è il corso</h2><p>Un percorso introduttivo ai fondamentali della boxe: guardia, spostamenti e colpi base.</p>'
  const judo = '<p>Un percorso educativo e sportivo.</p><img alt="Due judoka sul tatami" src="https://example.test/judo-1.jpg" /><ul><li><strong>Quando</strong> Lunedì e venerdì</li></ul><h2>Orario delle lezioni</h2><h3>Judo 2</h3><p>17:00 – 18:00</p><h2>Cosa aspettarsi</h2><p>Si procede un passo alla volta.</p><img alt="Tre ragazzi sorridono" src="https://example.test/judo-2.jpg" /><h2>Una settimana per scegliere.</h2><p>1 settimana di prova a 10 euro.</p>'
  const pagine = [
    pagina('home', 'Home', { bozza: '<p>Benvenuti alle Officine Dello Sport.</p>', pubblicato: '<p>Benvenuti alle Officine Dello Sport.</p>', pubblicataIl: '2026-10-03T09:00:00.000Z' }),
    pagina('pre-pugilistica', 'Pre pugilistica', { descrizione: 'Guardia, spostamenti e colpi base per ragazze e ragazzi.', bozza: `${pre}<p>Nuove date in arrivo.</p>`, pubblicato: pre, pubblicataIl: '2026-10-03T09:00:00.000Z' }),
    // Una pagina già a pezzi ma con un solo TESTO lungo: serve a provare «Dividi in parti».
    pagina('judo', 'Judo', { bozza: judo, pezzi: { content: [{ type: 'testo', props: { id: 'p1', html: judo } }] } }),
    pagina('chi-siamo', 'Chi siamo', { bozza: '<p>La palestra di Collegno.</p>' }),
    pagina('privacy', 'Privacy policy', { diLegge: true, bozza: '<p>Informativa.</p>', pubblicato: '<p>Informativa.</p>', pubblicataIl: '2026-10-02T09:00:00.000Z' }),
    pagina('cookie', 'Cookie policy', { diLegge: true, bozza: '<p>Il sito non usa cookie.</p>', pubblicato: '<p>Il sito non usa cookie.</p>', pubblicataIl: '2026-10-02T09:00:00.000Z' }),
    pagina('contributi-pubblici', 'Contributi pubblici', { diLegge: true, bozza: '<p>Elenco dei contributi pubblici ricevuti.</p>', pubblicato: '<p>Elenco dei contributi pubblici ricevuti.</p>', pubblicataIl: '2026-10-02T09:00:00.000Z' }),
    // Come dopo `107-sito-accessibilita.sql`: bozza con segnaposto, mai pubblicata.
    pagina('dichiarazione-accessibilita', 'Dichiarazione di accessibilità', { diLegge: true, bozza: TRACCIA_ACCESSIBILITA }),
  ]
  const id = (slug: string) => `sp-${slug}`
  return {
    pagine,
    menu: [
      { etichetta: 'Home', paginaId: id('home'), indirizzo: null },
      { etichetta: 'Pre pugilistica', paginaId: id('pre-pugilistica'), indirizzo: null },
    ],
    footer: [
      { etichetta: 'Privacy policy', paginaId: id('privacy'), indirizzo: null },
      { etichetta: 'Cookie policy', paginaId: id('cookie'), indirizzo: null },
      { etichetta: 'Contributi pubblici', paginaId: id('contributi-pubblici'), indirizzo: null },
      { etichetta: 'Accessibilità', paginaId: id('dichiarazione-accessibilita'), indirizzo: null },
    ],
  }
}

/** Dati di prova salvati prima dei pezzi non hanno il campo: valgono «vecchio editor» (`null`), non «database senza il 62» (`undefined`). */
export const conPezzi = (s: StatoSito): StatoSito => ({ ...s, pagine: s.pagine.map((p) => ({ ...p, pezzi: p.pezzi ?? null, corsiCollegati: p.corsiCollegati ?? [] })) })

const trova = (s: StatoSito, id: string) => {
  const p = s.pagine.find((x) => x.id === id)
  if (!p) throw new Error(NON_C_E)
  return p
}
const cambia = (s: StatoSito, id: string, f: (p: PaginaSito) => PaginaSito): StatoSito => ({ ...s, pagine: s.pagine.map((p) => (p.id === id ? f(p) : p)) })

const PEZZI_NO = 'I pezzi della pagina non sono fatti come il sito li vuole: ricarica la pagina e riprova'

export function nuovaPagina(s: StatoSito, titolo: string, slug: string, pezzi?: PezziPagina): { stato: StatoSito; id: string } {
  const no = controllaSlug(slug, s.pagine.map((p) => p.slug))
  if (no) throw new Error(no)
  if ((s.rinvii ?? []).some((r) => r.da === slug)) throw new Error('Questo indirizzo era di una pagina che ha cambiato indirizzo: scegline un altro')
  if (!titolo.trim() || titolo.trim().length > MASSIMO_TITOLO) throw new Error(TITOLO_NO)
  if (pezzi && !pezziValidi(pezzi)) throw new Error(PEZZI_NO)
  const id = nuovoId()
  const p: PaginaSito = { id, slug, titolo: titolo.trim(), descrizione: '', bozza: pezzi ? pezziInHtml(pezzi) : '', pezzi: pezzi ?? null, corsiCollegati: [], pubblicato: null, nascosta: false, diLegge: false, versione: 1 }
  return { stato: { ...s, pagine: [...s.pagine, p] }, id }
}

export function salvaBozza(s: StatoSito, id: string, versione: number, dati: { titolo: string; descrizione: string; bozza: string }): { stato: StatoSito; versione: number } {
  const p = trova(s, id)
  if (p.versione !== versione) throw new Error(CAMBIATA)
  if (!dati.titolo.trim() || dati.titolo.trim().length > MASSIMO_TITOLO) throw new Error(TITOLO_NO)
  if (dati.descrizione.trim().length > MASSIMO_DESCRIZIONE) throw new Error(DESCRIZIONE_NO)
  const lungo = testoTroppoLungo(dati.bozza)
  if (lungo) throw new Error(lungo)
  if (!testoSicuro(dati.bozza)) throw new Error(TESTO_NO)
  const nuova = p.versione + 1
  return { stato: cambia(s, id, (x) => ({ ...x, titolo: dati.titolo.trim(), descrizione: dati.descrizione.trim(), bozza: dati.bozza, versione: nuova })), versione: nuova }
}

/**
 * Come `salva_bozza_pezzi_sito`: salva i pezzi e il testo piatto che ne esce, con le stesse regole di `salvaBozza`.
 * Più severa del database, che controlla solo «oggetto non troppo grande»: la forma dei pezzi la garantisce l'app (`sitoPezzi.ts`).
 */
export function salvaBozzaPezzi(s: StatoSito, id: string, versione: number, dati: { titolo: string; descrizione: string; pezzi: PezziPagina }): { stato: StatoSito; versione: number } {
  if (!pezziValidi(dati.pezzi)) throw new Error(PEZZI_NO)
  const r = salvaBozza(s, id, versione, { titolo: dati.titolo, descrizione: dati.descrizione, bozza: pezziInHtml(dati.pezzi) })
  return { stato: cambia(r.stato, id, (x) => ({ ...x, pezzi: dati.pezzi })), versione: r.versione }
}

/** Come `salva_corsi_sito`: i corsi da cui viene l'orario, senza doppioni e nell'ordine scelto. Non è un cambio di testo: versione e bozza restano. */
export function collegaCorsi(s: StatoSito, id: string, corsi: string[], corsiEsistenti?: string[]): StatoSito {
  trova(s, id)
  // Come il database: prima la pagina, poi i corsi.
  if (corsiEsistenti && corsi.some((c) => !corsiEsistenti.includes(c))) throw new Error('Uno dei corsi scelti non c’è più: ricarica la pagina e scegli di nuovo')
  return cambia(s, id, (x) => ({ ...x, corsiCollegati: [...new Set(corsi)] }))
}

export function pubblica(s: StatoSito, id: string, versione: number): { stato: StatoSito; versione: number } {
  const p = trova(s, id)
  if (p.versione !== versione) throw new Error('La pagina è cambiata mentre la modificavi: ricaricala prima di pubblicare')
  const nuova = p.versione + 1
  return { stato: cambia(s, id, (x) => ({ ...x, pubblicato: x.bozza, titoloPubblicato: x.titolo, descrizionePubblicata: x.descrizione, pubblicataIl: new Date().toISOString(), versione: nuova })), versione: nuova }
}

export function cambiaIndirizzo(s: StatoSito, id: string, slug: string): StatoSito {
  const p = trova(s, id)
  if (p.slug === slug) return s
  const protetta = pagineDiLeggeProtette(p, 'indirizzo')
  if (protetta) throw new Error(protetta)
  const no = controllaSlug(slug, s.pagine.filter((x) => x.id !== id).map((x) => x.slug))
  if (no) throw new Error(no)
  // Come il database: il nuovo indirizzo non è più un rinvio, il vecchio porta al nuovo, e chi portava al vecchio ora porta al nuovo.
  const rinvii = (s.rinvii ?? []).filter((r) => r.da !== slug).map((r) => (r.a === p.slug ? { ...r, a: slug } : r))
  return { ...cambia(s, id, (x) => ({ ...x, slug, versione: x.versione + 1 })), rinvii: [...rinvii, { da: p.slug, a: slug }] }
}

export function nascondi(s: StatoSito, id: string, nascosta: boolean): StatoSito {
  const p = trova(s, id)
  const no = nascosta ? pagineDiLeggeProtette(p, 'nascondi') : null
  if (no) throw new Error(no)
  return cambia(s, id, (x) => ({ ...x, nascosta }))
}

export function cancella(s: StatoSito, id: string): StatoSito {
  const p = trova(s, id)
  const no = pagineDiLeggeProtette(p, 'cancella')
  if (no) throw new Error(no)
  if ([...s.menu, ...s.footer].some((v) => v.paginaId === id)) throw new Error('La pagina è nel menu o nel footer del sito: toglila da lì, poi si cancella')
  return { ...s, pagine: s.pagine.filter((x) => x.id !== id) }
}

export function salvaMenu(s: StatoSito, dove: 'menu' | 'footer', voci: VoceMenu[]): StatoSito {
  const problemi = controllaMenu(dove, voci, s.pagine)
  if (problemi.length) throw new Error(problemi[0])
  return { ...s, [dove]: voci.map((v) => ({ ...v, etichetta: v.etichetta.trim() })) }
}

/**
 * Gli orari della pagina «Orari» in prova: gli stessi che darebbe `orari_sito()` (69-orari-sito.sql), corsi attivi e
 * ricorrenze non finite (quella che finisce oggi c'è ancora), e nient'altro. La data di modifica è quella di oggi, fissa:
 * in prova niente la sposta, e gli stessi dati danno la stessa pagina.
 */
export function orariSitoProva(corsi: Array<{ nome: string; attivo: boolean; ricorrenze: Array<{ giorno: number; ora: string; durata: number; al?: string }> }>, oggi: string): OrarioSito[] {
  return corsi
    .filter((c) => c.attivo)
    .flatMap((c) => c.ricorrenze.filter((r) => !r.al || r.al >= oggi).map((r) => ({ corso: c.nome, giorno: r.giorno, ora: r.ora.length === 5 ? `${r.ora}:00` : r.ora, durata_min: r.durata, modificata_il: `${oggi}T10:00:00+00:00` })))
}
