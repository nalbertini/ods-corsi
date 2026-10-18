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
      { voce: 'personale', nome: 'ACCESSI' },
    ],
  },
  {
    id: 'corsi',
    nome: 'CORSI',
    voci: [
      { voce: 'corsi', nome: 'CORSI' },
      { voce: 'esercizi', nome: 'ESERCIZI' },
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

/** In che luogo sta una voce: da qui la barra sa quale luogo accendere. */
export function luogoDi(voce: Voce): LuogoId {
  const lista = voceInLista(voce)
  return LUOGHI.find((l) => l.voci.some((v) => v.voce === lista))?.id ?? 'oggi'
}
