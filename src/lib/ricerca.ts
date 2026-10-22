import { paroleCercate, piano, somiglia } from './nomi'
import { anniScritti, minorenne, type Richiesta } from './richieste'
import type { Posto, Voce } from './indirizzoSegreteria'
import { chiaveGiorno, GIORNI, giornoPerEsteso } from './sala'
import { paroleInRegola, type CorsoSeg, type Istruttore, type ParolaStato, type PersonaSeg } from './segreteria'

/**
 * La ricerca in cima al menu di segreteria: un campo, quattro gruppi. Lavora
 * sui dati già letti, senza chiamare il database: quel che la segreteria non
 * può leggere qui non arriva. `null` vuol dire «non l'ho potuto leggere», e
 * non è la stessa cosa di «non c'è».
 */
export type TipoRisultato = 'iscritti' | 'richieste' | 'corsi' | 'istruttori'

export interface Fonti {
  persone: PersonaSeg[] | null
  richieste: Richiesta[] | null
  corsi: CorsoSeg[] | null
  istruttori: Istruttore[] | null
}

export interface RigaTrovata {
  id: string
  nome: string
  /** Chi è o perché è uscito: la riga sotto il nome. */
  sotto: string
  nota?: string
  /** Chi non c'è più (archiviato, rifiutata): la riga è in grigio. */
  spenta?: boolean
  /** La nota è un bollino giallo: c'è qualcosa da fare. */
  tag?: boolean
  /** Di un iscritto attivo: certificato e quota che non vanno, come nella colonna IN REGOLA, vuota se è in regola. */
  stato?: ParolaStato[]
}

export interface GruppoTrovato {
  tipo: TipoRisultato
  titolo: string
  /** Quanti ce ne sono davvero: le righe sono al massimo `RIGHE_PER_GRUPPO`. */
  totale: number
  /** Tutti i trovati, non solo le righe: «ALTRI N» apre la voce già filtrata su questi. */
  ids: string[]
  righe: RigaTrovata[]
}

/** Quel che si è cercato e chi è uscito: una voce del menu lo mostra al posto del suo elenco intero. */
export interface Ricercata {
  testo: string
  ids: string[]
}

export interface EsitoRicerca {
  stato: 'vuoto' | 'trovato' | 'niente' | 'non_letto'
  gruppi: GruppoTrovato[]
  nonLetti: TipoRisultato[]
}

export const RIGHE_PER_GRUPPO = 3

/** La voce del menu che mostra tutto il gruppo: è dove porta «ALTRI N», e dove porta un istruttore (che non ha una scheda). */
export const VOCE_DEL_GRUPPO = { iscritti: 'iscritti', richieste: 'richieste', corsi: 'corsi', istruttori: 'personale' } as const satisfies Record<TipoRisultato, Voce>
/** Sotto le tre cifre un telefono trova mezza rubrica. */
const CIFRE_MINIME = 3

const GIORNI_CORTI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

/** Le cifre di un numero, senza il +39 o lo 0039 davanti: «+39 338 123» e «338123» sono lo stesso. */
const cifreDi = (s: string) => s.trim().replace(/^(\+|00)39/, '').replace(/\D/g, '')

const sembraUnNumero = (s: string) => /^[\d\s+\-().]+$/.test(s)
// Per l'email serve un segno che non sia un nome: senza, «rossi» troverebbe chiunque abbia rossi nell'indirizzo.
const sembraUnaMail = (s: string) => /[@.]/.test(s)

const parteDelGiorno = (g: string, oggi: Date) => {
  const giorno = g.slice(0, 10)
  const ieri = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - 1)
  return giorno === chiaveGiorno(oggi) ? 'oggi' : giorno === chiaveGiorno(ieri) ? 'ieri' : giornoPerEsteso(giorno)
}

function iscritti(persone: PersonaSeg[], corsi: CorsoSeg[] | null, scritto: string, oggi: Date): { p: PersonaSeg; sotto: string }[] {
  const parole = paroleCercate(scritto)
  const t = scritto.trim()
  const cifre = sembraUnNumero(t) ? cifreDi(t) : ''
  const mail = sembraUnaMail(t) ? t.toLowerCase() : ''
  const oggiGg = chiaveGiorno(oggi)
  return persone
    .flatMap((p) => {
      const minore = !!p.natoIl && minorenne(p.natoIl, oggi)
      const eta = minore && p.natoIl ? anniScritti(p.natoIl, oggi) : ''
      if (parole.length && somiglia(p, parole)) {
        // Per distinguere due con lo stesso nome: l'età se è piccolo, e dove va.
        const corsiSuoi = p.iscrizioni
          .filter((i) => !i.al || i.al >= oggiGg)
          .map((i) => corsi?.find((c) => c.id === i.corsoId)?.nome)
          .filter((n): n is string => !!n)
        return [{ p, sotto: [eta, corsiSuoi.slice(0, 2).join(', ')].filter(Boolean).join(' · ') }]
      }
      // Il numero e l'email di un minore sono di un genitore: si trova il minore,
      // ma il numero, l'email e il nome del genitore non escono mai nella riga.
      // Senza la data di nascita (non letta) il minore non si riconosce: la segreteria
      // quei dati li vede comunque nella scheda, e qui esce il suo, non quello di un altro.
      const dettaglio = (cosa: 'tel.' | 'email', valore: string, di: string) => (eta ? `${eta} · ${di}` : `${cosa} ${valore}`)
      if (cifre.length >= CIFRE_MINIME && p.telefono && cifreDi(p.telefono).includes(cifre)) return [{ p, sotto: dettaglio('tel.', p.telefono, 'numero di un genitore') }]
      const email = [p.email, p.emailContatto].find((e) => mail && e?.toLowerCase().includes(mail))
      if (email) return [{ p, sotto: dettaglio('email', email, 'email di un genitore') }]
      return []
    })
    .sort((a, b) => Number(b.p.attiva) - Number(a.p.attiva) || a.p.cognome.localeCompare(b.p.cognome, 'it'))
}

export function cercaTutto(scritto: string, fonti: Fonti, oggi = new Date()): EsitoRicerca {
  const parole = paroleCercate(scritto)
  if (!parole.length) return { stato: 'vuoto', gruppi: [], nonLetti: [] }

  const nonLetti: TipoRisultato[] = [
    ...(fonti.persone === null ? (['iscritti'] as const) : []),
    ...(fonti.richieste === null ? (['richieste'] as const) : []),
    ...(fonti.corsi === null ? (['corsi'] as const) : []),
    ...(fonti.istruttori === null ? (['istruttori'] as const) : []),
  ]

  const gruppi: GruppoTrovato[] = []
  const aggiungi = (tipo: TipoRisultato, titolo: string, righe: RigaTrovata[]) => {
    if (righe.length) gruppi.push({ tipo, titolo, totale: righe.length, ids: righe.map((r) => r.id), righe: righe.slice(0, RIGHE_PER_GRUPPO) })
  }

  if (fonti.persone) {
    aggiungi('iscritti', 'ISCRITTI', iscritti(fonti.persone, fonti.corsi, scritto, oggi).map(({ p, sotto }) => ({
      id: p.id,
      nome: `${p.cognome} ${p.nome}`,
      sotto,
      // Le note grigie della colonna (Non serve, Senza data, Fuori app) qui sono rumore: al banco conta se può entrare.
      // Anche «In regola» si toglie: la lista vuota è il ✓, così la scelta sta qui e si prova.
      ...(p.attiva ? { stato: paroleInRegola(p, chiaveGiorno(oggi)).filter((x) => x.tono === 'rosso' || x.tono === 'giallo') } : { nota: 'non attiva', spenta: true }),
    })))
  }

  if (fonti.richieste) {
    // Il richiedente, non il genitore: i dati di chi non è ancora iscritto non servono a trovarlo.
    const trovate = fonti.richieste
      .filter((r) => somiglia(r, parole))
      .sort((a, b) => Number(b.stato === 'nuova') - Number(a.stato === 'nuova') || b.creataIl.localeCompare(a.creataIl))
    aggiungi('richieste', 'RICHIESTE ONLINE', trovate.map((r) => ({
      id: r.id,
      nome: `${r.cognome} ${r.nome}`,
      sotto: `arrivata ${parteDelGiorno(r.creataIl, oggi)}`,
      nota: r.stato === 'nuova' ? 'DA ACCOGLIERE' : r.stato,
      ...(r.stato === 'nuova' ? { tag: true } : {}),
      ...(r.stato === 'rifiutata' ? { spenta: true } : {}),
    })))
  }

  if (fonti.corsi) {
    const trovati = fonti.corsi
      .filter((c) => {
        const sue = [c.nome, c.sala ?? '', ...c.ricorrenze.map((r) => r.sala ?? '')].flatMap((s) => piano(s).split(/\s+/))
        const giorni = c.ricorrenze.flatMap((r) => [piano(GIORNI[r.giorno]), GIORNI_CORTI[r.giorno]])
        return c.attivo && parole.every((w) => [...sue, ...giorni].some((s) => s.startsWith(w)))
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    aggiungi('corsi', 'CORSI', trovati.map((c) => {
      // Dal lunedì alla domenica, come il calendario.
      const quando = [...c.ricorrenze].sort((a, b) => ((a.giorno + 6) % 7) - ((b.giorno + 6) % 7) || a.ora.localeCompare(b.ora)).map((r) => `${GIORNI_CORTI[r.giorno]} ${r.ora}`).join(', ')
      return { id: c.id, nome: c.nome, sotto: [quando, c.sala].filter(Boolean).join(' · ') }
    }))
  }

  if (fonti.istruttori) {
    const trovati = fonti.istruttori.filter((i) => somiglia({ nome: i.nome, cognome: '' }, parole)).sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    aggiungi('istruttori', 'ISTRUTTORI', trovati.map((i) => ({
      id: i.id,
      nome: i.nome,
      sotto: (fonti.corsi ?? []).filter((c) => c.istruttori.some((x) => x.id === i.id)).map((c) => c.nome).join(', '),
    })))
  }

  return { stato: gruppi.length ? 'trovato' : nonLetti.length ? 'non_letto' : 'niente', gruppi, nonLetti }
}

/**
 * Dove porta un risultato: la scheda di un iscritto, di un corso o di una
 * richiesta; un istruttore non ha una scheda, e va a ISTRUTTORI E ACCESSI.
 * «ALTRI N» (senza riga) apre la voce già filtrata su quel che si è cercato.
 */
export function doveVa(
  tipo: TipoRisultato,
  riga?: Pick<RigaTrovata, 'id'>,
  ricerca?: Ricercata,
): { voce: Voce; dest?: Pick<Posto, 'persona' | 'corso'> & { richiesta?: string; ricerca?: Ricercata } } {
  const voce = VOCE_DEL_GRUPPO[tipo]
  if (tipo === 'istruttori') return { voce }
  if (!riga) return ricerca ? { voce, dest: { ricerca } } : { voce }
  if (tipo === 'iscritti') return { voce, dest: { persona: riga.id } }
  if (tipo === 'corsi') return { voce, dest: { corso: riga.id } }
  return { voce, dest: { richiesta: riga.id } }
}

/**
 * Le fonti dopo una nuova lettura: una che è fallita tiene i dati di prima
 * (`vecchi` lo dice a chi guarda), una riuscita li sostituisce. Se non c'era
 * niente di prima, una fallita resta `null`.
 */
export function unisciLetture(prima: Fonti | null, nuove: Fonti): { fonti: Fonti; vecchi: boolean } {
  if (!prima) return { fonti: nuove, vecchi: false }
  const fonti: Fonti = {
    persone: nuove.persone ?? prima.persone,
    richieste: nuove.richieste ?? prima.richieste,
    corsi: nuove.corsi ?? prima.corsi,
    istruttori: nuove.istruttori ?? prima.istruttori,
  }
  const vecchi = (nuove.persone === null && prima.persone !== null) || (nuove.richieste === null && prima.richieste !== null) || (nuove.corsi === null && prima.corsi !== null) || (nuove.istruttori === null && prima.istruttori !== null)
  return { fonti, vecchi }
}
