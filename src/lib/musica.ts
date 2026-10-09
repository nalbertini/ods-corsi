import { eHttp, leggiLink, leggiLinkSpotify, leggiRadio, MESSAGGIO_HTTP } from '../../timer/src/lib/link'
import type { Settings } from '../../timer/src/types'
import { type Disciplina, nomeDisciplina, ripulisciDisciplina } from '../../timer/src/lib/discipline'

/**
 * La musica delle sale: le liste che la segreteria prepara e il tablet fa
 * partire con un tocco.
 *
 * Una lista è un nome e un link, a una playlist di YouTube o di Spotify. Vale
 * per una sala, o per tutte se non ne ha una. Il tablet non la cambia: la
 * sceglie, e la sua barra in basso la suona. A cosa serve il link lo dice il
 * link stesso (vedi `fonteDelLink`), così la segreteria non deve scegliere.
 */
export interface ListaMusica {
  id: string
  nome: string
  link: string
  /** Nulla: per tutte le sale. */
  salaId: string | null
  /** La disciplina (id della lista della palestra), o `tutte`; senza, nessuna in particolare. */
  disciplina?: string
}

/**
 * La disciplina da scrivere salvando una lista: `undefined` se non se ne parla
 * (la riga resta com'era), `null` per toglierla, altrimenti l'id. Una
 * disciplina che non esiste vale «nessuna».
 */
export function disciplinaDaSalvare(l: { disciplina?: string | null }, discipline: Disciplina[]): string | null | undefined {
  if (!('disciplina' in l)) return undefined
  return ripulisciDisciplina(l.disciplina, discipline) ?? null
}

export type FonteMusica = 'youtube' | 'spotify' | 'radio'

/** Fonte e link della musica, come li legge il timer. */
export type MusicaDelTimer = Pick<Settings, 'musicaFonte' | 'youtube' | 'radio'>

/**
 * Da dove viene un link: YouTube, Spotify, una radio (un indirizzo https
 * qualunque), o niente che si sappia suonare. L'http semplice non va: l'app è
 * su https e il browser blocca il suono (vedi `erroreDelLink`).
 */
export function fonteDelLink(link: string): FonteMusica | null {
  if (leggiLink(link)) return 'youtube'
  if (leggiLinkSpotify(link)) return 'spotify'
  return leggiRadio(link) ? 'radio' : null
}

/** Cosa dire a chi scrive un indirizzo che comincia con http: null se non è il caso. */
export function erroreDelLink(link: string): string | null {
  if (link.trim().length > MAX_LINK) return 'Il link è troppo lungo'
  return fonteDelLink(link) === null && eHttp(link) ? MESSAGGIO_HTTP : null
}

/**
 * La musica che il tablet passa al timer: fonte e link scelti in sala. Se chi è
 * in sala l'ha spenta dal tablet, `musica: false` vince su quello che dicono le
 * impostazioni; altrimenti il campo non c'è e valgono le impostazioni.
 */
export function musicaDellaSala<T extends object>(base: T, spenta: boolean): T | (T & { musica: false }) {
  return spenta ? { ...base, musica: false } : base
}

export const MAX_NOME_LISTA = 40
/** Quanto può essere lungo un link: lo dice anche il database. */
const MAX_LINK = 500

/**
 * La musica che il timer suona: quella della lista scelta, se se ne sa
 * suonare il link, altrimenti quella delle impostazioni del timer. Spenta,
 * vince `musica: false`. La stessa per il tablet e per il telefono.
 */
export function musicaScelta(
  lista: ListaMusica | null,
  impostazioni: MusicaDelTimer,
  spenta: boolean,
): MusicaDelTimer & { musica?: false } {
  const fonte = lista ? fonteDelLink(lista.link) : null
  return musicaDellaSala<MusicaDelTimer>(
    lista && fonte
      ? { musicaFonte: fonte, youtube: fonte === 'youtube' ? lista.link : impostazioni.youtube, radio: fonte === 'radio' ? lista.link : impostazioni.radio }
      : { musicaFonte: impostazioni.musicaFonte, youtube: impostazioni.youtube, radio: impostazioni.radio },
    spenta,
  )
}

/** Dove suona: il tablet di sala o il telefono di chi insegna, ognuno con la sua scelta. */
export type Dispositivo = 'tablet' | 'telefono'

// Le chiavi del tablet sono quelle di sempre: un tablet già in sala non perde la sua scelta.
const DOVE_SPENTA: Record<Dispositivo, string> = { tablet: 'ods-corsi:musica-spenta', telefono: 'ods-corsi:musica-istruttori-spenta' }
const DOVE_LISTA: Record<Dispositivo, string> = { tablet: 'ods-corsi:musica-sala', telefono: 'ods-corsi:musica-istruttori' }

/**
 * Se la musica è spenta su questo dispositivo. Il tablet parte acceso, come
 * sempre; il telefono spento: suona solo se lo vuole chi insegna, anche in una
 * sala col tablet che suona già. Senza memoria vale lo stesso.
 */
export function spentaRicordata(d: Dispositivo): boolean {
  try {
    const v = localStorage.getItem(DOVE_SPENTA[d])
    return v === null ? d === 'telefono' : v === '1'
  } catch {
    return d === 'telefono'
  }
}
export function ricordaSpenta(d: Dispositivo, spenta: boolean) {
  try {
    localStorage.setItem(DOVE_SPENTA[d], spenta ? '1' : '0')
  } catch {
    // Si perde solo la scelta al prossimo ricaricamento.
  }
}
export function listaRicordata(d: Dispositivo): string | null {
  try {
    return localStorage.getItem(DOVE_LISTA[d])
  } catch {
    return null
  }
}
export function ricordaLista(d: Dispositivo, id: string | null) {
  try {
    if (id) localStorage.setItem(DOVE_LISTA[d], id)
    else localStorage.removeItem(DOVE_LISTA[d])
  } catch {
    // Si perde solo la scelta al prossimo ricaricamento.
  }
}

export type StatoMusica = 'spenta' | 'ferma' | 'suona' | 'pausa'

/**
 * A che punto è la musica. «Ferma» è prima del primo ▶ (o della prima lista
 * toccata): dopo un ricaricamento la musica non riparte da sola, il browser
 * non lo lascerebbe e in palestra sarebbe una sorpresa.
 */
export function statoMusica({ spenta, partita, inRiproduzione }: { spenta: boolean; partita: boolean; inRiproduzione: boolean }): StatoMusica {
  if (spenta) return 'spenta'
  if (!partita) return 'ferma'
  return inRiproduzione ? 'suona' : 'pausa'
}

/** La riga sotto il titolo della barra: l'errore prima di tutto, poi «Tocca ▶» se è ferma. */
export function sottoMusica({ stato, errore, dettaglio }: { stato: StatoMusica; errore: string | null; dettaglio: string }): string {
  return errore ?? (stato === 'ferma' ? 'Tocca ▶ per farla partire' : dettaglio)
}

const NOME_FONTE: Record<FonteMusica, string> = { youtube: 'YouTube', spotify: 'Spotify', radio: 'Radio' }

/**
 * Una lista nel pannello ☰: spenta se non si può suonare, e la riga sotto il
 * nome che dice cos'è o perché no. Sul telefono la sala non conta (le liste
 * sono tutte) e YouTube avvisa che col telefono bloccato si ferma.
 */
export function rigaLista(
  l: ListaMusica,
  { dispositivo, spotifyCollegato, discipline }: { dispositivo: Dispositivo; spotifyCollegato: boolean; discipline: Disciplina[] },
): { spenta: boolean; sotto: string } {
  const fonte = fonteDelLink(l.link)
  if (!fonte) return { spenta: true, sotto: 'Link non valido' }
  if (fonte === 'spotify' && !spotifyCollegato) return { spenta: true, sotto: `Spotify non è collegato su questo ${dispositivo}` }
  const disciplina = nomeDisciplina(l.disciplina, discipline)
  const pezzi = [
    fonte === 'radio' ? 'Radio' : `Playlist ${NOME_FONTE[fonte]}`,
    dispositivo === 'tablet' && !l.salaId ? 'tutte le sale' : null,
    disciplina,
    dispositivo === 'telefono' && fonte === 'youtube' ? 'si ferma col telefono bloccato' : null,
  ]
  return { spenta: false, sotto: pezzi.filter(Boolean).join(' · ') }
}
