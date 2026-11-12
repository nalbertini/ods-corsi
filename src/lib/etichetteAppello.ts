/**
 * Le parole di stato dell'appello e del calendario. Il segno davanti (… ✕ ✓)
 * dice lo stato anche a chi non distingue i colori: il colore da solo non basta.
 * Il `tono` sceglie il colore nel CSS; senza tono la parola non è uno stato.
 */
export type Tono = 'aspetta' | 'manca' | 'fatto'

export const NON_ANCORA_COMINCIATA = '… NON ANCORA COMINCIATA'

export function statoAppello(a: {
  soloLettura: boolean
  tuttiSegnati: boolean
  tuttiAssenti: boolean
  mancano: number
  proveMancano: number
  /** C'è un tasto per chiudere l'appello (l'istruttore può chiuderlo). */
  haChiudi: boolean
}): { testo: string; tono: Tono; tasto?: true } {
  if (a.soloLettura) return { testo: '… SOLO LETTURA', tono: 'aspetta' }
  if (a.tuttiAssenti) return { testo: '✕ TUTTI ASSENTI', tono: 'manca' }
  if (a.tuttiSegnati) return a.haChiudi ? { testo: 'CHIUDI IN FONDO ↓', tono: 'fatto', tasto: true } : { testo: '✓ TUTTI SEGNATI', tono: 'fatto' }
  return { testo: a.mancano ? `… ${a.mancano} DA SEGNARE` : `… ${a.proveMancano} PROVA DA SEGNARE`, tono: 'aspetta' }
}

/** Vuota senza coda: la testa dell'appello non cambia altezza. */
export const codaAppello = (n: number): string => (n > 0 ? `… ${n} DA INVIARE` : '')

/** Sempre lo stesso tasto: un altro comparso al suo posto prenderebbe il secondo tocco. */
export function tastoAppello(a: { segnatiIscritti: number; tuttiAssenti: boolean; tuttiSegnati: boolean }): string {
  if (a.segnatiIscritti === 0 || a.tuttiAssenti) return 'TUTTI PRESENTI'
  return a.tuttiSegnati ? 'TUTTI SEGNATI' : 'GLI ALTRI PRESENTI'
}

export function statoLezione(l: { manca: boolean; iniziato: boolean; fatto: boolean; presentiIscritti: number }): { testo: string; tono?: Tono } {
  if (l.manca) return { testo: '✕ DA CHIUDERE', tono: 'manca' }
  if (!l.iniziato) return { testo: 'ISCRITTI' }
  if (l.fatto) return l.presentiIscritti > 0 ? { testo: '✓ FATTO', tono: 'fatto' } : { testo: '… NESSUN PRESENTE', tono: 'aspetta' }
  return { testo: '… IN CORSO', tono: 'aspetta' }
}

export const proveInPiu = (n: number): string => `+${n} PROVA`

/**
 * I messaggi d'errore dell'appello. Si riconoscono solo le frasi che sappiamo
 * nostre (da `datiSupabase.ts` e `datiProva.ts`) e si dicono con cosa fare;
 * tutto il resto è un testo del server o del browser, e non si mostra mai così
 * com'è: `sembraItaliano` di `importa.ts` qui non basta, perché lascia fuori
 * «Puoi cambiare l'attività solo delle tue lezioni».
 */
const testo = (e: unknown) => (e instanceof Error ? e.message : '')

export function fraseGuaioAttivita(e: unknown): string {
  const m = testo(e)
  if (m.startsWith('Le attività non sono ancora attive')) return 'Le attività non sono ancora attive: chiedi alla segreteria.'
  if (m.startsWith('Puoi cambiare l’attività solo delle tue lezioni')) return 'Puoi cambiare l’attività solo delle tue lezioni: per questa chiedi alla segreteria.'
  return 'Non sono riuscito a cambiare l’attività: controlla la connessione e riprova.'
}

export function fraseGuaioSegnalata(e: unknown): string {
  const m = testo(e)
  // Accolta o rifiutata intanto da un'altra parte (la segreteria, un'altra scheda): l'appello qui è indietro.
  const gia = /^È già stata (accolta|rifiutata)/.exec(m)
  if (gia) return `È già stata ${gia[1]}: ricarica la pagina per vederla com’è adesso.`
  if (m.startsWith('Non è una tua lezione')) return 'Non è una tua lezione: la vede la segreteria.'
  return 'Non sono riuscito a salvare la scelta: controlla la connessione e riprova.'
}
