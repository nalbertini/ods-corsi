import type { Voce } from './indirizzoSegreteria'

/**
 * I cinque luoghi de «Il Banco», con le voci della seconda riga. Sono dati,
 * non markup: la mappa del design (`docs/design-canvas/banco/Mappa.dc.html`)
 * e la barra dicono la stessa cosa perché nascono da qui.
 */
export type LuogoId = 'oggi' | 'persone' | 'corsi' | 'soldi' | 'palestra'

export const LUOGHI: Array<{ id: LuogoId; nome: string; voci: Array<{ voce: Voce; nome: string }> }> = [
  {
    id: 'oggi',
    nome: 'OGGI',
    voci: [
      { voce: 'dafare', nome: 'OGGI' },
      { voce: 'settimana', nome: 'SETTIMANA' },
      { voce: 'presenze', nome: 'PRESENZE' },
    ],
  },
  {
    id: 'persone',
    nome: 'PERSONE',
    voci: [
      { voce: 'iscritti', nome: 'ISCRITTI' },
      { voce: 'tessere', nome: 'TESSERE' },
      { voce: 'richieste', nome: 'RICHIESTE ONLINE' },
      { voce: 'istruttori', nome: 'ISTRUTTORI' },
      { voce: 'compensi', nome: 'COMPENSI' },
      { voce: 'personale', nome: 'ACCESSI' },
    ],
  },
  {
    id: 'corsi',
    nome: 'CORSI',
    voci: [
      { voce: 'corsi', nome: 'CORSI' },
    ],
  },
  {
    id: 'soldi',
    nome: 'SOLDI',
    voci: [
      { voce: 'pagamenti', nome: 'PAGAMENTI' },
      { voce: 'contabilita', nome: 'CONTABILITÀ' },
      { voce: 'listino', nome: 'LISTINO' },
      { voce: 'vestiario', nome: 'VESTIARIO' },
    ],
  },
  {
    id: 'palestra',
    nome: 'PALESTRA',
    voci: [
      { voce: 'statistiche', nome: 'STATISTICHE' },
      { voce: 'segnalazioni', nome: 'SEGNALAZIONI' },
      { voce: 'sito', nome: 'SITO' },
      { voce: 'regole', nome: 'IMPOSTAZIONI' },
    ],
  },
]

/** I luoghi con le sole voci consentite: un luogo senza voci non c'è (chi ha solo l'amministrazione vede SOLDI e basta). */
export const luoghiPer = (consentite: readonly Voce[]): typeof LUOGHI =>
  LUOGHI.map((l) => ({ ...l, voci: l.voci.filter((v) => consentite.includes(v.voce)) })).filter((l) => l.voci.length > 0)

/** La voce da evidenziare nella seconda riga: le segnalate sono una scheda di PRESENZE, non una voce. */
export const voceInLista = (voce: Voce): Voce => (voce === 'segnalate' ? 'presenze' : voce)

/**
 * Dove porta il tasto di un luogo: la sua prima voce, salvo PALESTRA. Quel che sta lì si apre di rado,
 * e nessuna delle quattro è più importante delle altre: si arriva a una pagina che le mostra in grande.
 */
export const voceDelLuogo = (l: (typeof LUOGHI)[number]): Voce => (l.id === 'palestra' ? 'palestra' : l.voci[0].voce)

/** In che luogo sta una voce: da qui la barra sa quale luogo accendere. */
export function luogoDi(voce: Voce): LuogoId {
  if (voce === 'palestra') return 'palestra'
  const lista = voceInLista(voce)
  return LUOGHI.find((l) => l.voci.some((v) => v.voce === lista))?.id ?? 'oggi'
}

/** Cosa c'è dietro ogni voce di PALESTRA, detto in una frase: è il `sotto` della pagina che apre. */
const FRASI_PALESTRA: Partial<Record<Voce, string>> = {
  statistiche: 'Come va la palestra, mese per mese: chi viene, quando, in quali corsi, quanto entra.',
  segnalazioni: 'Cosa non va nell’app o cosa serve: si scrive qui, la risposta arriva sotto.',
  sito: 'Le pagine del sito della palestra, il menu, il footer e le immagini.',
  regole: 'Le scelte che spettano alla palestra, non al programma.',
}

/**
 * Le tessere della pagina LA PALESTRA: le voci del luogo, nello stesso ordine e con lo stesso nome, così la pagina
 * e la riga sotto i luoghi non si separano. SEGNALAZIONI dice quante aspettano risposta, come il numero del menu.
 */
export function tesserePalestra(daRispondere: number): Array<{ voce: Voce; titolo: string; frase: string; stato?: string }> {
  const palestra = LUOGHI.find((l) => l.id === 'palestra')?.voci ?? []
  return palestra.map((v) => ({
    voce: v.voce,
    titolo: v.nome,
    frase: FRASI_PALESTRA[v.voce] ?? '',
    stato: v.voce === 'segnalazioni' && daRispondere > 0 ? `${daRispondere} da rispondere` : undefined,
  }))
}
