import { clock } from '../../timer/src/lib/format'
import { lezioneDaIndirizzo, type Lezione } from '../../timer/src/lib/lezione'
import type { SegmentKind } from '../../timer/src/types'
import type { Status } from '../../timer/src/lib/useTimer'
import { timerDellaLezione } from './aree'
import type { Incorporato, StatoTimer } from '../../timer/src/lib/incorporato'
import type { StatoMusica } from './musica'

/**
 * Il timer dentro l'app degli istruttori: una pagina della stessa scheda, con
 * la navigazione CALENDARIO · TIMER · I MIEI · ORE (barra in basso sul
 * telefono, menu a sinistra su schermo largo). Le regole stanno qui perché si
 * provino senza browser; i componenti mostrano e chiamano.
 */

export type PaginaIstruttori = 'calendario' | 'timer' | 'mieiTimer' | 'ore'

/**
 * Le voci della navigazione. LE MIE ORE c'è solo per chi insegna: la
 * segreteria che non insegna ha le lezioni di tutti, ma non ore sue.
 */
export function vociNavigazione({ ruolo, ancheIstruttore }: { ruolo: 'istruttore' | 'staff'; ancheIstruttore?: boolean }): { pagina: PaginaIstruttori; nome: string }[] {
  const voci: { pagina: PaginaIstruttori; nome: string }[] = [
    { pagina: 'calendario', nome: 'CALENDARIO' },
    { pagina: 'timer', nome: 'TIMER' },
    { pagina: 'mieiTimer', nome: 'I MIEI' },
  ]
  if (ruolo === 'istruttore' || ancheIstruttore) voci.push({ pagina: 'ore', nome: 'ORE' })
  return voci
}

/**
 * Il timer aperto dentro l'app: la lezione che arriva dall'appello, o nessuna
 * dal menu. Passa dallo stesso indirizzo di `timer/?corso=…&lezione=…`, così
 * il timer incorporato e quello a sé leggono la lezione allo stesso modo.
 */
export function timerAperto(l: { id: string; corsoId: string; corso: string } | null): Lezione | null {
  return l ? lezioneDaIndirizzo(new URL(timerDellaLezione(l), 'https://ods.test/').href) : null
}

export interface AllenamentoInCorso {
  status: Status
  kind: SegmentKind | null
  /** Quando finisce l'intervallo (orologio, ms); vale solo se in corso. */
  scadeAlle: number
  /** I secondi rimasti da fermo, in pausa. */
  secondiFermo: number
}

/** Il colore dell'intervallo, quello del bordo dello schermo del timer. */
const COLORE: Record<SegmentKind, string> = {
  prepare: 'var(--giallo)',
  work: 'var(--rosso)',
  rest: 'var(--verde)',
  setRest: 'var(--blu)',
  cooldown: 'var(--blu)',
}
const TESTO: Record<SegmentKind, string> = {
  prepare: 'PREPARATI',
  work: 'LAVORO',
  rest: 'RECUPERO',
  setRest: 'RIPOSO',
  cooldown: 'DEFATICAMENTO',
}

/**
 * La striscia dell'allenamento in corso: testo e colore (mai solo il colore) e
 * il tempo. Il tempo si ricalcola dall'orologio a ogni lettura: una scheda in
 * secondo piano, che il telefono rallenta, mostra comunque il tempo giusto.
 */
export function statoStriscia(s: AllenamentoInCorso, ora: number): { testo: string; colore: string; tempo: string } {
  const colore = s.kind ? COLORE[s.kind] : 'var(--line)'
  if (s.status === 'done') return { testo: 'FINITO', colore: 'var(--giallo)', tempo: 'FINE' }
  if (s.status === 'paused') return { testo: 'IN PAUSA', colore, tempo: clock(s.secondiFermo) }
  return { testo: s.kind ? TESTO[s.kind] : '', colore, tempo: clock((s.scadeAlle - ora) / 1000) }
}

const nonFinito = (s: Status) => s === 'running' || s === 'paused'

/**
 * Chi sta per aprire il timer di un'altra lezione con un allenamento non
 * finito deve prima confermare: aprirlo lo ferma. Dal menu (`richiesta` nulla)
 * no: riapre quello in corso, e chiedere ogni volta impedirebbe di tornarci.
 */
export function chiediPrimaDiSostituire(inCorso: { lezioneId: string | null; status: Status } | null, richiesta: string | null): boolean {
  if (!inCorso || !nonFinito(inCorso.status) || richiesta === null) return false
  return richiesta !== inCorso.lezioneId
}

/**
 * Senza rete il timer parte lo stesso: l'avviso dice cosa cambia, e con la
 * musica accesa anche cosa suona ancora. Null se online.
 */
export function avvisoSenzaRete(online: boolean, conMusica = false): string | null {
  if (online) return null
  return conMusica
    ? 'Il timer funziona lo stesso. YouTube, Spotify e la radio non partono, i file del telefono sì. La voce incisa lascia il posto a quella del telefono e le illustrazioni degli esercizi non si vedono.'
    : 'Il timer funziona lo stesso. La voce incisa lascia il posto a quella del telefono e le illustrazioni degli esercizi non si vedono.'
}

/** Quale lezione mostra il timer: dal menu riapre quella in corso, dall'appello la richiesta. */
export function lezioneDelTimer(inCorso: { lezioneId: string | null; status: Status } | null, richiesta: string | null, dalMenu: boolean): string | null {
  if (!dalMenu) return richiesta
  return inCorso && nonFinito(inCorso.status) ? inCorso.lezioneId : null
}

/** La striscia resta finché l'allenamento non è fermo (anche finito, fino a OK) e fuori dalla pagina timer. */
export function mostraStriscia(status: Status, pagina: PaginaIstruttori): boolean {
  return status !== 'idle' && pagina !== 'timer'
}

interface StatoVisto {
  status: Status
  kind: SegmentKind | null
  nome: string
  conto: string | number
}

/** Serve a ridisegnare la pagina solo se cambia status, kind, nome o conto, non a ogni secondo. */
export function statoCambiato(prima: StatoVisto | null, dopo: StatoVisto | null): boolean {
  if (!prima || !dopo) return prima !== dopo
  return prima.status !== dopo.status || prima.kind !== dopo.kind || prima.nome !== dopo.nome || prima.conto !== dopo.conto
}

/**
 * La barra piccola della musica, fuori dalla pagina TIMER: solo se la musica
 * suona o è in pausa. Spenta o ferma (dopo un ricaricamento) non c'è niente da
 * comandare da fuori. Non dipende dall'allenamento: le due barre sono separate.
 */
export function mostraMusicaMini(stato: StatoMusica, pagina: PaginaIstruttori): boolean {
  return pagina !== 'timer' && (stato === 'suona' || stato === 'pausa')
}

/**
 * Il timer dentro l'app istruttori. Senza `sala` né `onTimerSala`: le
 * impostazioni cambiate dal telefono (la musica compresa) restano sul
 * telefono e non arrivano ai tablet. La musica è quella scelta qui.
 */
export function incorporatoIstruttori({
  lezione,
  musica,
  visibile,
  ferma,
  onStato = () => {},
  onSettings = () => {},
}: {
  lezione: Lezione | null
  musica: Incorporato['musica']
  visibile: boolean
  ferma: number
  onStato?: (s: StatoTimer | null) => void
  onSettings?: Incorporato['onSettings']
}): Incorporato {
  // La scheda (TIMER o IMPOSTAZIONI) la sceglie PaginaTimer, col tasto accanto al titolo.
  return { lezione, musica, sala: null, clip: null, visibile, conImpostazioni: true, senzaTestata: true, ferma, onStato, onSettings }
}

/** ESCI ferma la musica prima di uscire: Spotify suonerebbe ancora nella sua app. Senza ESCI, niente tasto. */
export function esciConMusica(ferma: () => void, esci: (() => void) | undefined): (() => void) | undefined {
  return (
    esci &&
    (() => {
      ferma()
      esci()
    })
  )
}

/**
 * YouTube fuori dal TIMER: suonando, il lettore resta visibile in un angolo
 * (nascosto smetterebbe) e le pagine fanno spazio sotto, così non copre CHIUDI
 * né i nomi. Fermo o spento non serve: niente riquadro.
 */
export function youtubeNellAngolo({ stato, pagina, youtube }: { stato: StatoMusica; pagina: PaginaIstruttori; youtube: boolean }): boolean {
  return youtube && pagina !== 'timer' && (stato === 'suona' || stato === 'pausa')
}

/** Il lettore di YouTube c'è nel TIMER (il video ha il suo posto) o nell'angolo mentre suona. */
export function lettoreYoutube(m: { stato: StatoMusica; pagina: PaginaIstruttori; youtube: boolean }): boolean {
  return m.youtube && m.stato !== 'spenta' && (m.pagina === 'timer' || youtubeNellAngolo(m))
}

/** Lo spazio sotto le pagine quando YouTube sta nell'angolo: il riquadro (200) e il suo margine (12). */
export const SPAZIO_YOUTUBE = 212

/**
 * Il tasto IMPOSTAZIONI c'è solo senza un allenamento aperto: il timer lo
 * mostrerebbe sopra le impostazioni, e il titolo direbbe una cosa che non si vede.
 */
export function tastoImpostazioni(status: Status | null): boolean {
  return status === null || status === 'idle'
}
