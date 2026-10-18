import { VOCE_CORSI, VOCE_QUOTA } from './contabilita'
import { euro } from './ricevute'

/**
 * L'«Elenco Movimenti Prima Nota» del vecchio programma, letto dal testo che esce da
 * `pdftotext -layout` e pronto per `importa_movimenti` (`supabase/*-importa-movimenti.sql`).
 * Si usa una volta sola, dallo script `scripts/importa-prima-nota.mjs`: il file vero ha nomi di
 * iscritti e non entra mai nel repository, qui ci sono solo le regole per leggerlo.
 *
 * Quello che il file ha: data, cassa («Categoria»), entrata o uscita, causale scritta a mano
 * (niente voce), importo netto e lordo. Si legge il LORDO: con quello i totali tornano al piede
 * del file, il netto ha errori di virgola.
 */

export interface RigaPrimaNota {
  /** Il posto fra le righe con la data (le scartate lasciano un buco): la chiave non cambia rileggendo il file. */
  posizione: number
  data: string
  /** Vuota se nel file la cassa manca. */
  cassa: 'contanti' | 'conto' | null
  tipo: 'entrata' | 'uscita'
  importo: number
  causale: string
}

export interface RigaScartata {
  posizione: number
  testo: string
  motivo: string
}

export interface LetturaPrimaNota {
  righe: RigaPrimaNota[]
  scartate: RigaScartata[]
}

export interface TotaliPrimaNota {
  conteggio: number
  entrate: number
  uscite: number
}

export const VOCE_DA_CLASSIFICARE = 'Da classificare'

const CON_DATA = /^\d\d\/\d\d\/\d{4}\s/
// Data, cassa e tipo (che nel file a volte mancano), causale, importo netto, IVA («N.I.») o niente, importo lordo, numero.
const RIGA = /^(\d\d)\/(\d\d)\/(\d{4})\s+(Cassa Conto Corrente|Cassa Contanti)?\s*(Entrata|Uscita)?\s*(.*?)\s*€\s*[\d.]+,\d\d\s+(?:(?:N\.I\.|[A-Z0-9.%]+)\s+)?€\s*([\d.]+,\d\d)(?:\s+\d+)?\s*$/
const PIEDE = /N°\s*Movimenti\s+(\d+)\s+Totale Entrate\s+([\d.]+,\d\d)\s+Totale Uscite\s+([\d.]+,\d\d)/

const centesimi = (testo: string) => Math.round(Number(testo.replace(/\./g, '').replace(',', '.')) * 100)

export function leggiPrimaNota(testo: string): LetturaPrimaNota {
  const righe: RigaPrimaNota[] = []
  const scartate: RigaScartata[] = []
  let posizione = 0
  // Dove attaccare una causale che va a capo: l'ultima riga letta, se è stata letta.
  let ultima: RigaPrimaNota | null = null
  // Il salto pagina (\f) sta davanti alla prima riga della pagina: toglierlo, se no la riga non si legge.
  for (const riga of testo.replace(/\f/g, '').split('\n')) {
    if (CON_DATA.test(riga)) {
      posizione++
      ultima = null
      const m = RIGA.exec(riga)
      if (!m) {
        scartate.push({ posizione, testo: riga.trim(), motivo: 'Riga non letta' })
        continue
      }
      const [, giorno, mese, anno, cassa, tipo, causale, lordo] = m
      const importo = centesimi(lordo)
      if (importo === 0) {
        scartate.push({ posizione, testo: riga.trim(), motivo: 'Importo zero' })
        continue
      }
      if (!tipo) {
        scartate.push({ posizione, testo: riga.trim(), motivo: 'Manca entrata o uscita' })
        continue
      }
      ultima = {
        posizione,
        data: `${anno}-${mese}-${giorno}`,
        cassa: cassa ? (cassa === 'Cassa Contanti' ? 'contanti' : 'conto') : null,
        tipo: tipo === 'Entrata' ? 'entrata' : 'uscita',
        importo,
        causale: causale.replace(/\s+/g, ' ').trim(),
      }
      righe.push(ultima)
    } else if (ultima && /^\s{10,}\S/.test(riga) && !riga.includes('€') && !/Elenco Movimenti/.test(riga)) {
      ultima.causale = `${ultima.causale} ${riga.replace(/\s+/g, ' ').trim()}`.trim()
    }
  }
  return { righe, scartate }
}

/** Il piede del file: quanti movimenti e il totale delle entrate e delle uscite. */
export function totaliDelPiede(testo: string): TotaliPrimaNota | null {
  const m = PIEDE.exec(testo)
  return m ? { conteggio: Number(m[1]), entrate: centesimi(m[2]), uscite: centesimi(m[3]) } : null
}

/** I totali delle righe lette; le scartate (a zero) contano nel numero dei movimenti, come nel piede. */
export function totaliDelleRighe(lettura: LetturaPrimaNota): TotaliPrimaNota {
  const somma = (tipo: RigaPrimaNota['tipo']) => lettura.righe.filter((r) => r.tipo === tipo).reduce((s, r) => s + r.importo, 0)
  return { conteggio: lettura.righe.length + lettura.scartate.length, entrate: somma('entrata'), uscite: somma('uscita') }
}

/** Le righe lette fanno gli stessi totali del piede? Se no, dice cosa non torna. */
export function quadra(lettura: LetturaPrimaNota, piede: TotaliPrimaNota | null): { quadra: boolean; differenze: string[] } {
  if (!piede) return { quadra: false, differenze: ['il file non ha il piede coi totali'] }
  const avuto = totaliDelleRighe(lettura)
  const differenze: string[] = []
  if (avuto.conteggio !== piede.conteggio) differenze.push(`movimenti: ${avuto.conteggio} invece di ${piede.conteggio}`)
  if (avuto.entrate !== piede.entrate) differenze.push(`entrate: ${euro(avuto.entrate)} € invece di ${euro(piede.entrate)} €`)
  if (avuto.uscite !== piede.uscite) differenze.push(`uscite: ${euro(avuto.uscite)} € invece di ${euro(piede.uscite)} €`)
  return { quadra: differenze.length === 0, differenze }
}

/** La voce, scelta dalla causale: i pagamenti dei clienti vanno sulle due voci di sistema, il resto da classificare. */
export function voceDellaCausale(causale: string, tipo: 'entrata' | 'uscita'): string {
  if (tipo !== 'entrata' || !/^cliente\s.+\sper\s/i.test(causale)) return VOCE_DA_CLASSIFICARE
  return /^cliente\s.+\sper\s+quota associativa/i.test(causale) ? VOCE_QUOTA : VOCE_CORSI
}

export interface DatiImport {
  /** Non cambia rileggendo lo stesso file: rilanciare l'import non duplica niente. */
  chiave: string
  data: string
  cassa: 'contanti' | 'conto'
  tipo: 'entrata' | 'uscita'
  importo: number
  descrizione: string
  voce: string
}

/**
 * Via gli incassi dei clienti (le due voci di sistema) dopo una data: da lì in poi l'app li ricava da ricevute
 * e pagamenti a mano, e importarli anche dal vecchio programma li conterebbe due volte. Senza data si tiene tutto.
 */
export const senzaIncassiDopo = (righe: RigaPrimaNota[], data: string | null): RigaPrimaNota[] =>
  data ? righe.filter((r) => r.data <= data || voceDellaCausale(r.causale, r.tipo) === VOCE_DA_CLASSIFICARE) : righe

/** Le righe con la cassa mancante: l'import le mette sul conto, e l'anteprima le fa vedere. */
export const cassaIncerta = (righe: RigaPrimaNota[]): RigaPrimaNota[] => righe.filter((r) => !r.cassa)

export const datiImport = (righe: RigaPrimaNota[]): DatiImport[] =>
  righe.map((r) => ({
    chiave: `prima-nota:${r.posizione}`,
    data: r.data,
    cassa: r.cassa ?? 'conto',
    tipo: r.tipo,
    importo: r.importo,
    descrizione: r.causale ? r.causale.slice(0, 200) : '(senza causale)',
    voce: voceDellaCausale(r.causale, r.tipo),
  }))

/** A pacchetti: la funzione del database ne vuole al massimo mille per volta. */
export function apacchetti<T>(lista: T[], grandezza: number): T[][] {
  const pacchetti: T[][] = []
  for (let i = 0; i < lista.length; i += grandezza) pacchetti.push(lista.slice(i, i + grandezza))
  return pacchetti
}
