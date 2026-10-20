import { periodoInParole } from './bilancio'
import { giornoRoma } from './contabilita'
import { chiSiStaPerdendo, conAppello, DI_FILA, GIORNI_RECENTI, type LezioneRegistro } from './frequenza'
import { MSG_ACCEDI } from './movimentiDallaChat'
import { dataRicevuta, euro } from './ricevute'
import type { StatoPresenza, StatoSessione } from './sala'
import { pagamentoDi, statoCertificato, type PagamentoSeg } from './segreteria'

/**
 * La segreteria dalla chat (`mcp.ts`, `supabase/75-chat-segreteria.sql`): Claude legge, per chi ha il ruolo di
 * segreteria, certificati, quote, iscritti e presenze, con le regole di DA FARE e PRESENZE. Il database dà già nulli
 * nome e cognome di chi non è adulto; qui i testi contano i minori e chi non ha la data di nascita, e nominano solo
 * gli adulti. Mai contatti, codice fiscale, date di nascita, note del pagamento o numeri di ricevuta.
 */

/**
 * Spenta finché chi segue la privacy della palestra non dice sì e l'informativa non nomina Anthropic (PRODUCT.md,
 * principio 4): la segreteria non può collegare Claude e non vede gli strumenti.
 */
export const CHAT_SEGRETERIA_ACCESA = false

export const MSG_SEGRETERIA = 'Questa parte è per la segreteria'
const MSG_SEG_INDIETRO = 'Il database non è ancora aggiornato per le domande della segreteria: va chiesto a chi cura l’app'
const MSG_GUASTO = 'Qualcosa non è andato: riprova tra poco, o guarda nell’app'

export type Eta = 'adulto' | 'minore' | 'non_si_sa'

/** Un iscritto attivo come lo dà `chat_iscritti`: nome e cognome solo per gli adulti, mai la data di nascita. */
export interface IscrittoChat {
  chiave: string
  nome: string | null
  cognome: string | null
  eta: Eta
  /** Il giorno dei 6 anni, solo per chi non li ha ancora compiuti: la regola del certificato. */
  seiAnni?: string
  certificatoScade?: string
  pagamento: PagamentoSeg
  quote: Array<{ dal?: string; al?: string; mancano: number }>
  /** I corsi delle iscrizioni in corso oggi, per id. */
  corsi: string[]
}

/** Una riga di `chat_registro`: una lezione e un iscritto; `chiave` nulla per una lezione senza iscritti. */
export interface AppelloChat {
  sessioneId: string
  corsoId: string
  corso: string
  inizio: string
  stato: StatoSessione
  chiave: string | null
  nome: string | null
  cognome: string | null
  eta: Eta | null
  presenza: StatoPresenza | null
}

export interface ProvaChat {
  sessioneId: string
  corsoId: string
  inizio: string
  prove: number
}

export interface CorsoChat {
  id: string
  nome: string
}

/** L'errore detto per la segreteria: i rifiuti del database, il database indietro, il resto mai grezzo. */
export function erroreSegreteria(e: unknown): string {
  // Un errore qualunque: si leggono solo `code` e `message`, se ci sono, e restano `unknown` finché non si guardano.
  const { code, message } = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; message?: unknown }
  if (code === '42501') return MSG_SEGRETERIA
  // I rifiuti del database con le loro parole («Al massimo un anno alla volta»).
  if (code === '22023' && typeof message === 'string' && message) return message
  if (code === 'PGRST202' || code === '42883' || code === '42703') return MSG_SEG_INDIETRO
  if (code === 'PGRST301' || code === 'PGRST303' || (typeof message === 'string' && /JWT/i.test(message))) return MSG_ACCEDI
  return MSG_GUASTO
}

/** Il corso chiesto, per id o per nome senza badare alle maiuscole. */
export const corsoDa = (corsi: CorsoChat[], chiesto: string): CorsoChat | undefined => {
  const t = chiesto.trim().toLowerCase()
  return corsi.find((c) => c.id === chiesto.trim()) ?? corsi.find((c) => c.nome.trim().toLowerCase() === t)
}

type Adulto = { nome: string; cognome: string }
const eAdulto = <T extends { eta: Eta | null; nome: string | null; cognome: string | null }>(x: T): x is T & Adulto =>
  x.eta === 'adulto' && x.nome !== null && x.cognome !== null
const perCognome = (a: Adulto, b: Adulto) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it')
const nomeDi = (a: Adulto) => `${a.nome} ${a.cognome}`
const nomiCorsi = (ids: string[], corsi: CorsoChat[]) =>
  ids
    .map((id) => corsi.find((c) => c.id === id)?.nome)
    .filter((x): x is string => !!x)
    .sort((a, b) => a.localeCompare(b, 'it'))
const coiCorsi = (ids: string[], corsi: CorsoChat[]) => {
  const n = nomiCorsi(ids, corsi)
  return n.length ? ` · ${n.join(', ')}` : ''
}
const MINORI_IN_APP = 'Non si dicono i nomi dei minori: si vedono in DA FARE nell’app.'

/** I certificati da sistemare fra chi è attivo, come DA FARE: gli adulti per nome, gli altri contati. */
export function testoCertificati(iscritti: IscrittoChat[], corsi: CorsoChat[], oggi: string): string {
  // Il certificato con l'età: un adulto, e chi non ha la data, ce l'ha sempre da portare; chi non ha 6 anni no.
  const stato = (x: IscrittoChat) => statoCertificato({ certificato: { scade: x.certificatoScade }, seiAnni: x.eta === 'minore' ? x.seiAnni : undefined }, oggi)
  const adulti = iscritti.filter(eAdulto).sort(perCognome)
  const gruppo = (titolo: string, come: string, riga: (x: IscrittoChat & Adulto) => string) => {
    const chi = adulti.filter((x) => stato(x) === come)
    return chi.length ? [`${titolo} (${chi.length}):`, ...chi.map((x) => `- ${nomeDi(x)}${coiCorsi(x.corsi, corsi)} · ${riga(x)}`)] : []
  }
  const righe = [
    ...gruppo('Scaduto', 'scaduto', (x) => `scaduto il ${dataRicevuta(x.certificatoScade)}`),
    ...gruppo('Manca', 'manca', () => 'manca'),
    ...gruppo('In scadenza entro 30 giorni', 'in_scadenza', (x) => `scade il ${dataRicevuta(x.certificatoScade)}`),
  ]
  const conta = (eta: Eta, ...come: string[]) => iscritti.filter((x) => x.eta === eta && come.includes(stato(x))).length
  const minori = [conta('minore', 'manca', 'scaduto'), conta('minore', 'in_scadenza'), conta('minore', 'in_arrivo')]
  const ignoti = [conta('non_si_sa', 'manca', 'scaduto'), conta('non_si_sa', 'in_scadenza')]
  const altri: string[] = []
  if (minori[0] || minori[1]) altri.push(`Minori: ${minori[0]} senza certificato valido, ${minori[1]} in scadenza.`)
  if (minori[2]) altri.push(`${minori[2]} ${minori[2] === 1 ? 'compie' : 'compiono'} 6 anni entro un mese senza certificato.`)
  if (ignoti[0] || ignoti[1]) altri.push(`Senza data di nascita: ${ignoti[0]} senza certificato valido, ${ignoti[1]} in scadenza.`)
  return [
    `Fra chi è attivo, al ${dataRicevuta(oggi)}:`,
    ...(righe.length ? righe : ['Fra gli adulti, tutti col certificato valido.']),
    ...altri,
    ...(altri.length ? [MINORI_IN_APP] : []),
  ].join('\n')
}

/** Le quote da sistemare fra chi è attivo: gli adulti per nome, con quanto manca se lo dice una ricevuta. */
export function testoQuote(iscritti: IscrittoChat[], corsi: CorsoChat[], oggi: string): string {
  // Senza la nota scritta a mano (può avere nomi), e con un numero di ricevuta finto: nessuno dei due esce.
  const paga = (x: IscrittoChat) =>
    pagamentoDi({ pagamento: { stato: x.pagamento.stato, fino: x.pagamento.fino }, quote: x.quote.map((q) => ({ ...q, anno: 0, numero: 0 })) }, oggi)
  const adulti = iscritti
    .filter(eAdulto)
    .sort(perCognome)
    .flatMap((x) => {
      const p = paga(x)
      if (p.come === 'pagato') return []
      const come =
        p.come === 'scaduto'
          ? `scaduta il ${dataRicevuta(p.fino)}`
          : p.come === 'in_parte'
            ? ['in parte', ...(p.mancano ? [`mancano ${euro(p.mancano)} €`] : []), ...(p.fino ? [`fino al ${dataRicevuta(p.fino)}`] : [])].join(' · ')
            : 'da pagare'
      return [`- ${nomeDi(x)}${coiCorsi(x.corsi, corsi)} · ${come}`]
    })
  const conta = (eta: Eta) => {
    const c = iscritti.filter((x) => x.eta === eta).map((x) => paga(x).come)
    return [c.filter((x) => x === 'da_pagare' || x === 'scaduto').length, c.filter((x) => x === 'in_parte').length]
  }
  const [m, mp] = conta('minore')
  const [n, np] = conta('non_si_sa')
  return [
    `Fra chi è attivo, al ${dataRicevuta(oggi)}:`,
    ...(adulti.length ? adulti : ['Fra gli adulti, tutti con la quota pagata.']),
    ...(m || mp ? [`Minori: ${m} da pagare o scaduta, ${mp} in parte.`] : []),
    ...(n || np ? [`Senza data di nascita: ${n} da pagare o scaduta, ${np} in parte.`] : []),
  ].join('\n')
}

const contati = (eta: Array<Eta | null>) => {
  const m = eta.filter((x) => x === 'minore').length
  const n = eta.filter((x) => x === 'non_si_sa').length
  return [...(m ? [`Minori: ${m}.`] : []), ...(n ? [`Senza data di nascita: ${n}.`] : [])]
}

/** Chi è iscritto oggi al corso: gli adulti per nome, gli altri contati. */
export function testoIscritti(iscritti: IscrittoChat[], corso: CorsoChat, oggi: string): string {
  const qui = iscritti.filter((x) => x.corsi.includes(corso.id))
  const adulti = qui.filter(eAdulto).sort(perCognome)
  return [
    `${corso.nome}, iscritti al ${dataRicevuta(oggi)}:`,
    adulti.length ? `${adulti.length} ${adulti.length === 1 ? 'adulto' : 'adulti'}: ${adulti.map(nomeDi).join(', ')}` : 'Nessun adulto.',
    ...contati(qui.map((x) => x.eta)),
    ...(qui.length ? [] : ['Nessuno iscritto oggi.']),
  ].join('\n')
}

/** Le righe del registro in lezioni, con la chiave al posto della persona: quel che `frequenza.ts` sa contare. */
function lezioni(appelli: AppelloChat[]): Array<LezioneRegistro & { sessioneId: string }> {
  const perSessione = new Map<string, LezioneRegistro & { sessioneId: string }>()
  for (const r of appelli) {
    const l = perSessione.get(r.sessioneId) ?? { sessioneId: r.sessioneId, corsoId: r.corsoId, corso: r.corso, inizio: r.inizio, stato: r.stato, appello: [] }
    if (r.chiave !== null) l.appello.push({ personaId: r.chiave, nome: r.nome ?? '', cognome: r.cognome ?? '', stato: r.presenza })
    perSessione.set(r.sessioneId, l)
  }
  return [...perSessione.values()].sort((a, b) => a.inizio.localeCompare(b.inizio))
}

type ConChiave = AppelloChat & { chiave: string }
const persone = (appelli: AppelloChat[]) => new Map(appelli.filter((r): r is ConChiave => r.chiave !== null).map((r) => [r.chiave, r]))

/** Le presenze di un corso nel periodo, dagli appelli arrivati: gli adulti per nome, gli altri contati. */
export function testoPresenze(appelli: AppelloChat[], prove: ProvaChat[], corso: CorsoChat, dal: string, al: string): string {
  const tutte = lezioni(appelli.filter((r) => r.corsoId === corso.id))
  const annullate = tutte.filter((l) => l.stato === 'annullata').length
  const fatte = tutte.filter((l) => l.stato !== 'annullata' && conAppello(l))
  const senza = tutte.filter((l) => l.stato !== 'annullata' && !conAppello(l))
  const chi = persone(appelli.filter((r) => r.corsoId === corso.id && fatte.some((l) => l.sessioneId === r.sessioneId)))
  const adulti = [...chi.values()].filter(eAdulto).sort(perCognome)
  // Come PRESENZE: presenti su lezioni dovute, i giustificati fuori.
  const di = (chiave: string) => {
    const segni = fatte.flatMap((l) => l.appello.filter((p) => p.personaId === chiave && p.stato !== 'giustificato'))
    return `${segni.filter((p) => p.stato === 'presente').length} su ${segni.length}`
  }
  const presenti = fatte.reduce((s, l) => s + l.appello.filter((p) => p.stato === 'presente').length, 0)
  const numeroProve = prove.filter((p) => p.corsoId === corso.id).reduce((s, p) => s + p.prove, 0)
  return [
    `${corso.nome} · ${periodoInParole(dal, al)}`,
    [
      `${fatte.length} ${fatte.length === 1 ? 'lezione' : 'lezioni'} con l’appello`,
      ...(senza.length ? [`${senza.length} senza appello (${senza.map((l) => dataRicevuta(giornoRoma(l.inizio))).join(', ')})`] : []),
      ...(annullate ? [`${annullate} ${annullate === 1 ? 'annullata' : 'annullate'}`] : []),
    ].join(', ') + '.',
    ...(fatte.length ? [`In media ${Math.round(presenti / fatte.length)} presenti a lezione, contando tutti.`] : []),
    ...(adulti.length ? ['Adulti, presenti su lezioni dovute (i giustificati non contano):', ...adulti.map((a) => `- ${nomeDi(a)} · ${di(a.chiave)}`)] : ['Adulti: nessuno.']),
    ...contati([...chi.values()].map((x) => x.eta)),
    `Prove: ${numeroProve}.`,
    'Contano gli appelli arrivati: uno ancora sul tablet senza rete non c’è.',
  ].join('\n')
}

/** Chi si sta perdendo (la regola di PRESENZE), in tutti i corsi o in uno: gli adulti per nome, gli altri contati. */
export function testoChiManca(appelli: AppelloChat[], corso: CorsoChat | null): string {
  const chi = persone(appelli)
  const persi = chiSiStaPerdendo(lezioni(appelli), corso?.id)
  const adulti = persi
    .map((x) => ({ ...x, p: chi.get(x.id) }))
    .filter((x): x is typeof x & { p: ConChiave & Adulto } => !!x.p && eAdulto(x.p))
    .sort((a, b) => b.fila - a.fila || perCognome(a.p, b.p))
  const righe = adulti.map(
    (x) =>
      `- ${nomeDi(x.p)} · ${x.fila} assenze di fila · ${x.ultima ? `ultima presenza il ${dataRicevuta(giornoRoma(x.ultima))}` : `nessuna presenza negli ultimi ${GIORNI_RECENTI} giorni`}${corso ? '' : ` · ${x.corsi.join(', ')}`}`,
  )
  const altri = contati(persi.map((x) => chi.get(x.id)?.eta ?? null))
  return [
    `${corso ? `${corso.nome}: ` : ''}${DI_FILA} o più assenze di fila negli ultimi ${GIORNI_RECENTI} giorni (appelli arrivati, giustificati esclusi).`,
    ...(righe.length || altri.length ? [...righe, ...altri] : ['Nessuno: chi è iscritto viene.']),
  ].join('\n')
}
