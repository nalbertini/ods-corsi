import { centesimi, dataRicevuta, euro, type Ricevuta } from './ricevute'
import { piano } from './nomi'
import { csv } from './vestiario'
import { righeDaRicevute, righeDirette, type PagamentoDiretto, type RigaPagamento } from './pagamenti'
import { righeSatispay, type PagamentoSatispay } from './satispay'
import type { FiltroPersona } from './movimentiPersona'

/**
 * La contabilità di base, per chi cura i conti (`supabase/59-contabilita.sql`):
 * voci, casse e movimenti, e i conti che se ne fanno. Niente browser, niente
 * database: le schermate e i dati la chiamano, e le prove la leggono sola.
 *
 * Gli incassi degli iscritti non si copiano nei movimenti: si derivano qui dalle
 * righe di PAGAMENTI (ricevute e pagamenti a mano), così un annullo si vede da sé.
 * Importi sempre in centesimi.
 */

export interface Cassa {
  id: string
  nome: string
  saldoIniziale: number
  /** Da questa data si contano i movimenti; vuoto = tutti. */
  dal?: string
}

export interface VoceContabile {
  id: string
  nome: string
  tipo: 'entrata' | 'uscita'
  /** Le due voci degli incassi degli iscritti: non si cambiano. */
  diSistema: boolean
  attiva: boolean
}

/** Un movimento scritto a mano. Un giroconto non ha voce e ha una seconda cassa. */
export interface MovimentoManuale {
  id: string
  tipo: 'entrata' | 'uscita' | 'giroconto'
  data: string
  importo: number
  voceId?: string
  cassaId: string
  cassaAId?: string
  descrizione: string
  nota?: string
  creatoIl: string
  annullatoIl?: string
  /** `prima-nota:N` per lo storico importato dal vecchio programma, vuoto per un movimento scritto qui. */
  origineImport?: string
  /** La persona a cui lo storico è collegato (`70-movimenti-persona.sql`): un'etichetta, non cambia i conti. */
  personaId?: string
  /** Registrato da Claude col server MCP (`72-movimenti-dalla-chat.sql`): il segno DALLA CHAT nel movimento aperto. */
  dallaChat?: boolean
  /** Scaricato da Satispay (`97-satispay-scarico.sql`), o un movimento a mano riconosciuto: il segno DA SATISPAY. */
  satispayId?: string
  /** Coperto da un movimento della banca (`114-importazioni.sql`): la sua chiave. Mai insieme a `satispayId`. */
  bancaChiave?: string
  /** Solo modalità prova: i codici fiscali letti dalla causale, come `movimenti_codici_letti` nel database. */
  codiciLetti?: string[]
}

/** Una chiusura della Cassa Contanti: il periodo da `dal` a `data`, quel che c'era «secondo i conti» e quel che si è contato. */
export interface ChiusuraCassa {
  id: string
  cassaId: string
  dal: string
  data: string
  previsto: number
  contato: number
  /** Contato meno previsto: se non è zero, `movimentoId` è il movimento «Differenza di cassa». */
  differenza: number
  nota?: string
  movimentoId?: string
  /** Il nome di chi ha chiuso, «—» se la persona non c'è più. */
  chiusaDa?: string
  chiusaIl: string
  annullataIl?: string
  annullataDa?: string
}

/** Una riga dell'elenco: un movimento a mano o un incasso di un iscritto. */
export interface RigaMovimento {
  id: string
  origine: 'ricevuta' | 'pagamento' | 'movimento'
  tipo: 'entrata' | 'uscita' | 'giroconto'
  data: string
  importo: number
  descrizione: string
  sotto?: string
  voce: string | null
  cassaId: string
  cassaAId?: string
  /** Solo dei movimenti a mano: serve a chi ne corregge il testo, per non perderla. */
  nota?: string
  annullato: boolean
  /** Solo dei movimenti a mano: `prima-nota:N` se vengono dallo storico importato. */
  origineImport?: string
  /** La persona: collegata a mano allo storico, o quella della ricevuta o del pagamento di un incasso iscritto. */
  personaId?: string
  /** Solo dei movimenti a mano: registrato dalla chat con Claude. */
  dallaChat?: boolean
  /** Quando è stato scritto: dei movimenti dalla chat e di quelli importati dalla banca (`banca:`), che così si riconoscono a lotti. */
  creatoIl?: string
  /** Solo dei movimenti a mano: l'id del pagamento Satispay, il segno DA SATISPAY. */
  satispayId?: string
  /** Solo dei movimenti a mano: la chiave della riga della banca che lo copre. */
  bancaChiave?: string
}

export const NOME_CASSA_CONTANTI = 'Cassa Contanti'
export const NOME_CASSA_CONTO = 'Conto Corrente'
export const NOME_CASSA_SATISPAY = 'Satispay'
/** Come il trigger del 132: i soldi di Satispay arrivano col versamento in banca, la cassa non prende movimenti. */
export const MSG_CASSA_SATISPAY_CHIUSA = 'La cassa Satispay è chiusa: i soldi di Satispay arrivano col versamento in Conto Corrente'
/** La carta dal modulo di iscrizione (115-carta.sql): una cassa sua da subito. Al banco la carta resta «POS», sul conto. */
export const NOME_CASSA_CARTA = 'Carta'
export const VOCE_QUOTA = 'Quota associativa'
export const VOCE_CORSI = 'Corsi e altri pagamenti'
/** Le quote delle gare (`117-gare.sql`): una voce a sé, per sapere quanto entra e quanto si spende per le gare. */
export const VOCE_GARE = 'Gare'
/** Il versamento «Da Satispay Europe S.A.» in banca, al netto della commissione: è l'incasso di Satispay (`132-satispay-solo-chi-ha-pagato.sql`). */
export const VOCE_INCASSI_SATISPAY = 'Incassi Satispay'
/** Un'entrata su una quota o un corso, scritta a mano, ha la persona che ha pagato (`98-quote-persona.sql`). */
export const vuolePersona = (tipo: string, voceNome: string | null | undefined): boolean =>
  tipo === 'entrata' && (voceNome === VOCE_QUOTA || voceNome === VOCE_CORSI)
/** Un movimento a mano (non dello storico) che cambia voce verso una quota o un corso: ci va con la persona. */
export const vuolePersonaRiga = (r: Pick<RigaMovimento, 'tipo' | 'voce' | 'origineImport'>, voceNome: string | null | undefined): boolean =>
  r.voce !== voceNome && vuolePersona(r.tipo, voceNome) && !r.origineImport?.startsWith('prima-nota:')
/** Le parole del database quando manca la persona: lo schermo le riconosce per non ripeterle sotto il campo. */
export const SCEGLI_LA_PERSONA = 'Scegli la persona'
/** Le parole di `cambia_voce_movimenti` quando un lotto porterebbe su una quota o un corso dei movimenti a mano. */
export const UNA_RIGA_ALLA_VOLTA = 'Una quota o un corso si sposta una riga alla volta, con la persona: apri il movimento dall’elenco e cambia la voce lì.'
/** La voce che la chiusura di cassa scrive da sola (una di entrata e una di uscita): a mano non si sceglie. */
export const VOCE_DIFFERENZA = 'Differenza di cassa'
/** La voce dove lo storico ha messo le spese sparse: per i conti della chat è da sistemare, come «Da classificare». */
export const VOCE_VARIE = 'Varie'
/** Sopra questa differenza (in centesimi) la schermata chiede una conferma in più. */
export const SOGLIA_DIFFERENZA = 2000

/**
 * Contanti in Cassa Contanti, Carta nella cassa Carta, tutto il resto (bonifico, POS, assegno) in Conto Corrente.
 * Satispay, di qualunque data, non entra in CONTABILITÀ: i soldi sono il versamento «Da Satispay Europe S.A.» in banca.
 */
export const cassaDelMetodo = (metodo: string, _data: string): 'contanti' | 'conto' | 'satispay' | 'carta' => {
  const m = metodo.trim().toLowerCase()
  return m === 'contanti' ? 'contanti' : m === 'carta' ? 'carta' : m === 'satispay' ? 'satispay' : 'conto'
}
const NOME_CASSA = { contanti: NOME_CASSA_CONTANTI, conto: NOME_CASSA_CONTO, satispay: NOME_CASSA_SATISPAY, carta: NOME_CASSA_CARTA }

/** La voce di sistema di un incasso: la quota associativa, le gare, o tutto il resto. */
export const voceDiSistema = (voce: string) => {
  const v = voce.trim().toLowerCase()
  return v === 'quota associativa' ? VOCE_QUOTA : v === 'gare' ? VOCE_GARE : VOCE_CORSI
}

/** Dove va un incasso in CONTABILITÀ, detto prima di registrarlo: la cassa e la voce che `incassiDerivati` gli darà. */
export const doveEntraInContabilita = (metodo: string, voce: string, data: string) =>
  cassaDelMetodo(metodo, data) === 'satispay'
    ? 'Non entra in CONTABILITÀ: i soldi arrivano col versamento di Satispay in banca'
    : `Entra in CONTABILITÀ: ${NOME_CASSA[cassaDelMetodo(metodo, data)]} · ${voceDiSistema(voce)}`

/**
 * Gli incassi degli iscritti come movimenti di entrata, uno per pagamento. Sono
 * le righe di PAGAMENTI (`righeDaRicevute`, `righeDirette`): `pagato fino al` e
 * l'anticipo non ci sono, e un annullo resta, segnato annullato. Satispay no: è già nel versamento della banca.
 */
export function incassiDerivati(righe: RigaPagamento[], casse: Cassa[]): RigaMovimento[] {
  const cassa = (nome: string) => casse.find((c) => c.nome === nome)?.id ?? ''
  return righe.filter((r) => cassaDelMetodo(r.metodo, r.data) !== 'satispay').map((r) => ({
    id: `incasso:${r.id}`,
    origine: r.ricevuta ? 'ricevuta' : 'pagamento',
    tipo: 'entrata',
    data: r.data,
    importo: r.importo,
    descrizione: r.chi,
    // Il metodo lo dice la colonna CASSA e la quota la voce sotto il nome: qui resta quel che le colonne non dicono.
    sotto: [voceDiSistema(r.voce) === VOCE_CORSI ? r.voce : '', r.ricevuta ? `ricevuta ${r.ricevuta.numero}/${r.ricevuta.anno}` : r.senzaRichiesta ? '' : 'senza ricevuta'].filter(Boolean).join(' · ') || undefined,
    personaId: r.personaId,
    voce: voceDiSistema(r.voce),
    cassaId: cassa(NOME_CASSA[cassaDelMetodo(r.metodo, r.data)]),
    annullato: r.annullato,
  }))
}

/** L'elenco unico, dal più recente; a parità di giorno per id, così non salta da un giro all'altro. */
export function righeMovimenti(derivati: RigaMovimento[], manuali: MovimentoManuale[], voci: VoceContabile[]): RigaMovimento[] {
  const mie = manuali.map(
    (x): RigaMovimento => ({
      id: x.id,
      origine: 'movimento',
      tipo: x.tipo,
      data: x.data,
      importo: x.importo,
      descrizione: x.descrizione,
      voce: voci.find((v) => v.id === x.voceId)?.nome ?? null,
      cassaId: x.cassaId,
      cassaAId: x.cassaAId,
      nota: x.nota,
      annullato: !!x.annullatoIl,
      origineImport: x.origineImport,
      personaId: x.personaId,
      ...(x.dallaChat ? { dallaChat: true, creatoIl: x.creatoIl } : x.origineImport?.startsWith('banca:') ? { creatoIl: x.creatoIl } : {}),
      ...(x.satispayId ? { satispayId: x.satispayId } : {}),
      ...(x.bancaChiave ? { bancaChiave: x.bancaChiave } : {}),
    }),
  )
  return [...derivati, ...mie].sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id))
}

/** L'elenco della schermata: gli incassi (ricevute e pagamenti a mano, col nome di chi ha pagato) e i movimenti a mano. */
export function elencoMovimenti(
  ricevute: Ricevuta[],
  diretti: PagamentoDiretto[],
  nomi: Array<{ id: string; nome: string; cognome: string }>,
  casse: Cassa[],
  manuali: MovimentoManuale[],
  voci: VoceContabile[],
  satispay: PagamentoSatispay[] = [],
): RigaMovimento[] {
  const chi = new Map(nomi.map((p) => [p.id, `${p.cognome} ${p.nome}`.trim()]))
  const nomeDi = (id: string) => chi.get(id) ?? '—'
  const incassi = [...righeDaRicevute(ricevute), ...righeDirette(diretti, nomeDi), ...righeSatispay(satispay, nomeDi)]
  return righeMovimenti(incassiDerivati(incassi, casse), manuali, voci)
}

/** Quanti movimenti non annullati usano una voce. */
export const quanteUsate = (righe: RigaMovimento[], voce: VoceContabile): number =>
  righe.filter((r) => r.voce === voce.nome && r.tipo === voce.tipo && !r.annullato).length

export const totaleResidui = (conti: Array<{ residuo: number }>): number => conti.reduce((s, c) => s + c.residuo, 0)

/** Le casse dei saldi in testa a CONTABILITÀ: Satispay e Carta, a zero, no (i loro soldi arrivano sul Conto Corrente). Con qualcosa dentro tornano, se no il Totale non si spiega. */
export const casseDeiSaldi = (casse: Cassa[], conti: Array<{ cassaId: string; residuo: number }>): Cassa[] =>
  casse.filter((c) => ![NOME_CASSA_SATISPAY, NOME_CASSA_CARTA].includes(c.nome) || (conti.find((x) => x.cassaId === c.id)?.residuo ?? 0) !== 0)

/** Il giorno dopo, come `AAAA-MM-GG`. */
export const giornoDopo = (giorno: string): string => new Date(new Date(`${giorno}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)

/** Da dove parte il periodo di una chiusura: dal giorno dopo l'ultima, se no dall'inizio della cassa (come `chiudi_cassa`). */
export const dalDellaChiusura = (cassa: Cassa, ultima: ChiusuraCassa | undefined): string => (ultima ? giornoDopo(ultima.data) : (cassa.dal ?? '2000-01-01'))

/** Sopra questa differenza (in più o in meno) la schermata chiede una conferma. */
export const serveConfermaDifferenza = (differenza: number): boolean => Math.abs(differenza) > SOGLIA_DIFFERENZA

/** L'importo di una riga visto da una cassa: un'entrata e un versamento che arriva sono +, un'uscita e un versamento che parte sono −. */
export const importoPerCassa = (r: RigaMovimento, cassaId: string): number => (r.tipo === 'entrata' || (r.tipo === 'giroconto' && r.cassaAId === cassaId) ? r.importo : -r.importo)

/** Cosa si legge in una riga di movimento: gli incassi degli iscritti senza il loro nome (il foglio di chiusura gira di mano in mano). */
export const descrizioneRiga = (r: RigaMovimento): string => (r.origine === 'movimento' ? r.descrizione : `Incasso iscritto · ${r.voce ?? ''}`)

/** Il giorno a Roma di un istante (`2026-09-14T22:30:00Z` è già il 15). */
export const giornoRoma = (istante: string): string => oggiARoma(new Date(istante))

/** L'ultima chiusura attiva di una cassa: quella con la data più grande. */
export function ultimaChiusura(chiusure: ChiusuraCassa[], cassaId: string): ChiusuraCassa | undefined {
  return chiusure.filter((k) => k.cassaId === cassaId && !k.annullataIl).sort((a, b) => b.data.localeCompare(a.data))[0]
}

/** Un giorno è chiuso se è uguale o precedente all'ultima chiusura di una delle casse (un giroconto ne ha due). */
export const giornoChiuso = (chiusure: ChiusuraCassa[], cassaIds: string[], data: string): boolean =>
  cassaIds.some((id) => {
    const k = ultimaChiusura(chiusure, id)
    return !!k && data <= k.data
  })

/**
 * Quanto c'è in una cassa «secondo i conti» fino a un giorno compreso: come `residui`, ma ferma al giorno.
 * Le righe sono l'elenco unico (incassi dei contanti compresi, e le differenze delle chiusure di prima).
 * La stessa regola è `previsto_cassa` in 60-chiusura-cassa.sql.
 */
export function previstoCassa(casse: Cassa[], righe: RigaMovimento[], cassaId: string, giorno: string): number {
  const cassa = casse.find((c) => c.id === cassaId)
  if (!cassa) return 0
  return residui([cassa], righe.filter((r) => r.data <= giorno))[0].residuo
}

/** I movimenti di una cassa nel periodo di una chiusura (anche i giroconti da e verso), per giorno e poi per id: quelli che il foglio PDF elenca. */
export const righeDelPeriodo = (righe: RigaMovimento[], chiusura: Pick<ChiusuraCassa, 'dal' | 'data'>, cassaId: string): RigaMovimento[] =>
  righe
    .filter((r) => !r.annullato && r.data >= chiusura.dal && r.data <= chiusura.data && (r.cassaId === cassaId || r.cassaAId === cassaId))
    .sort((x, y) => x.data.localeCompare(y.data) || x.id.localeCompare(y.id))

/** Dopo la chiusura qualche incasso è cambiato (una ricevuta annullata): il previsto di allora non torna più. */
export function chiusuraNonPiuInRegola(chiusura: ChiusuraCassa, casse: Cassa[], righe: RigaMovimento[]): boolean {
  if (chiusura.annullataIl) return false
  const senzaDifferenza = righe.filter((r) => r.id !== chiusura.movimentoId)
  return previstoCassa(casse, senzaDifferenza, chiusura.cassaId, chiusura.data) !== chiusura.previsto
}

/**
 * La chiusura di cassa si fa alla cieca: il previsto e la differenza si vedono solo dopo aver scritto quanto si è contato
 * (zero è un importo valido, il vuoto no).
 */
export function chiusuraVisibile(contati: string, previsto: number): { previsto: number; differenza: number } | null {
  const c = centesimi(contati)
  return c === null ? null : { previsto, differenza: c - previsto }
}

/** «tornano», «5,00 € in più» o «5,00 € in meno». */
export const differenzaInParole = (differenza: number): string =>
  differenza === 0 ? 'tornano' : `${euro(Math.abs(differenza))} € ${differenza > 0 ? 'in più' : 'in meno'}`

/** Le voci da offrire in «Nuovo movimento»: quelle in uso del tipo giusto, senza la differenza di cassa. */
export const vociOfferte = (voci: VoceContabile[], tipo: 'entrata' | 'uscita'): VoceContabile[] =>
  voci.filter((v) => v.tipo === tipo && v.attiva && v.nome !== VOCE_DIFFERENZA).sort((x, y) => x.nome.localeCompare(y.nome, 'it'))

const MSG_GIORNO_CHIUSO = 'Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura'

/** Un movimento a mano di un giorno chiuso non si annulla: si annulla la chiusura, o si scrive una rettifica di oggi. */
export function cosaNonVaAnnulloMovimento(riga: RigaMovimento, chiusure: ChiusuraCassa[]): string | null {
  if (riga.origine !== 'movimento') return null
  const casse = riga.cassaAId ? [riga.cassaId, riga.cassaAId] : [riga.cassaId]
  return giornoChiuso(chiusure, casse, riga.data) ? 'Quel giorno è già chiuso: annulla prima la chiusura, o scrivi una rettifica con una data dopo la chiusura' : null
}

/**
 * Annullare un incasso in contanti di un giorno già chiuso lascia la chiusura «non più in regola»: l'avviso, da dire prima di farlo.
 * `fino`: l'ultima chiusura attiva della Cassa Contanti (`contantiChiusiFino`, che legge anche la segreteria), o null.
 */
export function avvisoCassaChiusa(pagamenti: Array<{ data: string; metodo: string }>, fino: string | null): string | null {
  if (!fino || !pagamenti.some((p) => p.data <= fino && cassaDelMetodo(p.metodo, p.data) === 'contanti')) return null
  return `Attenzione: la cassa contanti è chiusa fino al ${dataRicevuta(fino)} e questo incasso in contanti è di quei giorni: la chiusura non sarà più in regola e dovrai scrivere una rettifica.`
}

/** Il rifiuto dei contanti in un giorno già chiuso: lo stesso del pagamento a mano e di `emetti_ricevuta`. */
export const MSG_CONTANTI_CHIUSI = 'Quel giorno la cassa è già chiusa: scegli una data dopo la chiusura'

/**
 * I contanti di una ricevuta in un giorno già chiuso romperebbero la chiusura: come `fai_ricevuta` (92-ricevuta-cassa-chiusa.sql).
 * Un pagamento senza data è del giorno della ricevuta. `tranne`: il pagamento a mano che diventa ricevuta, se è in contanti
 * i suoi soldi di quel giorno sono già nel previsto.
 */
export function contantiInGiornoChiuso(
  pagamenti: Array<{ data?: string; importo: number; metodo: string }>,
  dataRicevuta: string,
  fino: string | null,
  tranne?: { data: string; metodo: string },
): string | null {
  const salvo = tranne && cassaDelMetodo(tranne.metodo, tranne.data) === 'contanti' ? tranne.data : null
  const chiuso = (p: { data?: string; importo: number; metodo: string }) => {
    const quando = p.data ?? dataRicevuta
    return p.importo > 0 && cassaDelMetodo(p.metodo, quando) === 'contanti' && quando !== salvo && !!fino && quando <= fino
  }
  return pagamenti.some(chiuso) ? MSG_CONTANTI_CHIUSI : null
}

/** Le voci «Rettifica» (entrata e uscita) che non ci sono ancora: servono a correggere un giorno chiuso. */
export const rettificheMancanti = (voci: VoceContabile[]): Array<'entrata' | 'uscita'> =>
  (['entrata', 'uscita'] as const).filter((tipo) => !voci.some((v) => v.tipo === tipo && v.nome.trim().toLowerCase() === 'rettifica'))

/** Quanti movimenti per volta cambiano voce: lo stesso limite di `cambia_voce_movimenti` (67-cambia-voce.sql). */
export const LIMITE_CAMBIO_VOCE = 500

/** Un cambio di voce nella traccia di un movimento: chi, quando, la voce di prima e quella di dopo. */
export interface CambioVoce {
  quando: string
  chi: string
  prima: string
  dopo: string
}

/**
 * Si sceglie per cambiarle la voce solo un movimento a mano, in uso, con una voce: non un incasso, un annullato, un giroconto o la differenza di una chiusura.
 * La differenza si riconosce dal nome: nessuno può creare una voce con quel nome (nome unico per tipo, `59-contabilita.sql`).
 */
export const cambiabile = (r: RigaMovimento): boolean => r.origine === 'movimento' && r.tipo !== 'giroconto' && !r.annullato && r.voce !== VOCE_DIFFERENZA

/**
 * Cosa non va in un cambio di voce, con le parole di `cambia_voce_movimenti`. Cambia solo la voce, quindi i giorni
 * chiusi non contano. `righe` è l'elenco intero; il primo movimento che non va, in ordine di id, dà il messaggio.
 */
export function cosaNonVaCambioVoce(ids: string[], righe: RigaMovimento[], voci: VoceContabile[], voceId: string, personaId?: string): string | null {
  const scelte = [...new Set(ids)].sort()
  if (!scelte.length) return 'Scegli almeno un movimento'
  if (scelte.length > LIMITE_CAMBIO_VOCE) return `Troppi movimenti in una volta: al massimo ${LIMITE_CAMBIO_VOCE}`
  const voce = voci.find((v) => v.id === voceId)
  if (!voce) return 'Scegli la voce'
  if (!voce.attiva) return 'La voce non è più in uso: scegline un’altra'
  if (voce.nome === VOCE_DIFFERENZA) return 'La «Differenza di cassa» si scrive da sola chiudendo la cassa'
  // Una mappa sola: l'elenco intero ha migliaia di righe, e questa funzione gira a ogni giro dello schermo.
  const perId = new Map(righe.filter((r) => r.origine === 'movimento').map((r) => [r.id, r]))
  const trovate = scelte.map((id) => perId.get(id))
  if (trovate.some((r) => !r)) return 'Il movimento non c’è'
  for (const r of trovate) {
    if (!r) continue
    const quale = `Il movimento del ${dataRicevuta(r.data)} (${r.descrizione})`
    if (r.annullato) return `${quale} è annullato: non si cambia`
    if (r.tipo === 'giroconto') return 'Un giroconto non ha voce'
    if (r.voce === VOCE_DIFFERENZA) return `${quale} è scritto dalla chiusura di cassa: non si cambia`
    if (r.tipo !== voce.tipo) return 'La voce scelta non va con questo tipo di movimento'
  }
  // Lo storico del vecchio programma resta facoltativo: la persona la vogliono solo i movimenti scritti a mano.
  const aMano = trovate.filter((r) => r && vuolePersonaRiga(r, voce.nome))
  if (aMano.length && scelte.length > 1) return UNA_RIGA_ALLA_VOLTA
  if (aMano.length && !personaId) return SCEGLI_LA_PERSONA
  return null
}

/** Il riepilogo prima di scrivere: quanti, di che tipo, quanto, da quali voci e quanti hanno già la voce di arrivo. */
export function riepilogoCambioVoce(ids: string[], righe: RigaMovimento[], voceId: string, voci: VoceContabile[]) {
  const voce = voci.find((v) => v.id === voceId)
  const scelti = new Set(ids)
  const scelte = righe.filter((r) => scelti.has(r.id) && r.origine === 'movimento')
  const tipi = new Set(scelte.map((r) => r.tipo))
  const per = new Map<string, number>()
  for (const r of scelte) per.set(r.voce ?? '—', (per.get(r.voce ?? '—') ?? 0) + 1)
  return {
    quanti: scelte.length,
    tipo: tipi.size === 1 ? [...tipi][0] : ('misto' as const),
    totale: scelte.reduce((s, r) => s + r.importo, 0),
    daVoci: [...per].map(([nome, quanti]) => ({ voce: nome, quanti })).sort((a, b) => b.quanti - a.quanti || a.voce.localeCompare(b.voce, 'it')),
    giaCosi: voce ? scelte.filter((r) => r.voce === voce.nome && r.tipo === voce.tipo).length : 0,
  }
}

/** Una lista a pacchetti: ognuno entra tutto o niente. */
export function pacchetti<T>(elementi: T[]): T[][] {
  const fuori: T[][] = []
  for (let i = 0; i < elementi.length; i += LIMITE_CAMBIO_VOCE) fuori.push(elementi.slice(i, i + LIMITE_CAMBIO_VOCE))
  return fuori
}

/** Il tasto che tiene solo le entrate o solo le uscite di una scelta mista: «Solo le 4 entrate», «Solo 1 entrata». */
export const soloTipo = (quante: number, tipo: 'entrata' | 'uscita'): string =>
  quante === 1 ? `Solo 1 ${tipo}` : `Solo le ${quante} ${tipo === 'entrata' ? 'entrate' : 'uscite'}`

/** L'esito a lavoro fatto: «12 cambiati, 3 erano già così». */
export function esitoCambioVoce(cambiati: number, giaCosi: number): string {
  if (!cambiati) return `${giaCosi} ${giaCosi === 1 ? 'era già così' : 'erano già così'}: non è cambiato niente`
  return `${cambiati} ${cambiati === 1 ? 'cambiato' : 'cambiati'}${giaCosi ? `, ${giaCosi} ${giaCosi === 1 ? 'era già così' : 'erano già così'}` : ''}`
}

/** Le voci da offrire per una scelta: quelle del suo tipo; con entrate e uscite insieme, o niente scelto, nessuna. */
export function vociPerLaScelta(ids: string[], righe: RigaMovimento[], voci: VoceContabile[]): VoceContabile[] {
  const scelti = new Set(ids)
  const tipi = new Set(righe.filter((r) => scelti.has(r.id) && r.origine === 'movimento').map((r) => r.tipo))
  const tipo = tipi.size === 1 ? [...tipi][0] : undefined
  return tipo === 'entrata' || tipo === 'uscita' ? vociOfferte(voci, tipo) : []
}

/** Si annulla solo l'ultima chiusura attiva della cassa. */
export function cosaNonVaAnnulloChiusura(id: string, chiusure: ChiusuraCassa[]): string | null {
  const k = chiusure.find((x) => x.id === id)
  if (!k) return 'La chiusura non c’è'
  if (k.annullataIl) return 'La chiusura è già annullata'
  if (ultimaChiusura(chiusure, k.cassaId)?.id !== k.id) return 'Si annulla solo l’ultima chiusura della cassa'
  return null
}

/** Il giorno di oggi a Roma, come lo conta il database: a mezzanotte il browser di chi è altrove può essere un giorno indietro. */
export const oggiARoma = (adesso: Date = new Date()): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(adesso)

/**
 * Il residuo di ogni cassa: saldo iniziale + entrate − uscite ± giroconti, dei
 * soli movimenti non annullati dal giorno di partenza. Un giroconto sposta i
 * soldi e non conta come entrata né uscita.
 */
export function residui(casse: Cassa[], righe: RigaMovimento[]): Array<{ cassaId: string; entrate: number; uscite: number; residuo: number }> {
  return casse.map((c) => {
    let entrate = 0
    let uscite = 0
    let giroconti = 0
    for (const r of righe) {
      if (r.annullato || (c.dal && r.data < c.dal)) continue
      if (r.tipo === 'giroconto') {
        if (r.cassaId === c.id) giroconti -= r.importo
        if (r.cassaAId === c.id) giroconti += r.importo
      } else if (r.cassaId === c.id) {
        if (r.tipo === 'entrata') entrate += r.importo
        else uscite += r.importo
      }
    }
    return { cassaId: c.id, entrate, uscite, residuo: c.saldoIniziale + entrate - uscite + giroconti }
  })
}

export interface RigaEstratto {
  riga: RigaMovimento
  entrata: number
  uscita: number
  /** Il saldo delle casse scelte dopo questo movimento. */
  saldo: number
}

export interface EstrattoConto {
  saldoIniziale: number
  entrate: number
  uscite: number
  saldoFinale: number
  righe: RigaEstratto[]
}

/**
 * MOVIMENTI come un estratto conto: le righe dalla più recente, ciascuna col saldo
 * delle casse scelte dopo di lei (vuote = tutte). Un giroconto è un'uscita se parte da
 * una cassa scelta e arriva fuori, un'entrata nel caso opposto, a zero fra due scelte.
 * Come `residui`, un movimento prima del «dal» della cassa non conta.
 */
export function estrattoConto(righe: RigaMovimento[], casse: Cassa[], f: FiltroMovimenti & { cassaIds?: string[] }): EstrattoConto {
  const scelte = casse.filter((c) => !f.cassaIds?.length || f.cassaIds.includes(c.id))
  const conta = (r: RigaMovimento, id?: string) => {
    const c = id ? scelte.find((x) => x.id === id) : undefined
    return !!c && !(c.dal && r.data < c.dal)
  }
  /** Quanto una riga sposta il saldo, e se tocca le casse scelte. */
  const effetto = (r: RigaMovimento) => {
    const da = conta(r, r.cassaId)
    const a = r.tipo === 'giroconto' && conta(r, r.cassaAId)
    if (r.tipo === 'giroconto') return { tocca: da || a, entrata: a && !da ? r.importo : 0, uscita: da && !a ? r.importo : 0 }
    return { tocca: da, entrata: da && r.tipo === 'entrata' ? r.importo : 0, uscita: da && r.tipo === 'uscita' ? r.importo : 0 }
  }
  const { dal } = f
  const prima = dal ? righe.filter((r) => !r.annullato && r.data < dal) : []
  const saldoIniziale = scelte.reduce((s, c) => s + c.saldoIniziale, 0) + prima.reduce((s, r) => s + effetto(r).entrata - effetto(r).uscita, 0)
  const periodo = { annullati: f.annullati, dal: f.dal, al: f.al }
  const cercate = new Set(filtraMovimenti(righe, { ...periodo, testo: f.testo, voce: f.voce }).map((r) => r.id))
  const viste = filtraMovimenti(righe, periodo)
    .sort((x, y) => y.data.localeCompare(x.data) || x.id.localeCompare(y.id))
    .map((riga) => ({ riga, ...effetto(riga) }))
    .filter((x) => x.tocca)
  // Il saldo è sempre quello vero delle casse: tipo, testo e voce nascondono righe, non le tolgono dal conto.
  let corrente = saldoIniziale
  const conSaldo: RigaEstratto[] = []
  for (const x of [...viste].reverse()) {
    const e = x.riga.annullato ? 0 : x.entrata
    const u = x.riga.annullato ? 0 : x.uscita
    corrente += e - u
    conSaldo.unshift({ riga: x.riga, entrata: e, uscita: u, saldo: corrente })
  }
  const mostrate = conSaldo.filter((x) => cercate.has(x.riga.id)).filter((x) => !f.tipo || (f.tipo === 'entrata' ? x.entrata > 0 : f.tipo === 'uscita' && x.uscita > 0) || (x.riga.annullato && x.riga.tipo === f.tipo))
  const entrate = mostrate.reduce((s, x) => s + x.entrata, 0)
  const uscite = mostrate.reduce((s, x) => s + x.uscita, 0)
  return { saldoIniziale, entrate, uscite, saldoFinale: corrente, righe: mostrate }
}

/** Entrate, uscite e la differenza: i giroconti e gli annullati non contano. */
export function totali(righe: RigaMovimento[]): { entrate: number; uscite: number; differenza: number } {
  const valide = righe.filter((r) => !r.annullato)
  const somma = (tipo: RigaMovimento['tipo']) => valide.filter((r) => r.tipo === tipo).reduce((s, r) => s + r.importo, 0)
  const entrate = somma('entrata')
  const uscite = somma('uscita')
  return { entrate, uscite, differenza: entrate - uscite }
}

export interface FiltroMovimenti {
  testo?: string
  dal?: string
  al?: string
  tipo?: string
  cassaId?: string
  voce?: string
  annullati?: boolean
}

/** Un testo come lo confronta la ricerca: senza accenti né maiuscole, e gli spazi in più contano come uno (lo storico ne ha). */
export const cercabile = (s: string) => piano(s).replace(/\s+/g, ' ').trim()

/** I filtri dell'elenco. Gli annullati ci sono solo se li si chiede; un giroconto è di tutte e due le sue casse. */
export function filtraMovimenti(righe: RigaMovimento[], f: FiltroMovimenti): RigaMovimento[] {
  const testo = cercabile(f.testo ?? '')
  return righe.filter((r) => {
    if (r.annullato && !f.annullati) return false
    if (f.dal && r.data < f.dal) return false
    if (f.al && r.data > f.al) return false
    if (f.tipo && r.tipo !== f.tipo) return false
    if (f.cassaId && r.cassaId !== f.cassaId && r.cassaAId !== f.cassaId) return false
    if (f.voce && r.voce !== f.voce) return false
    return !testo || cercabile(`${r.descrizione} ${r.voce} ${r.sotto ?? ''}`).includes(testo)
  })
}

export type Periodo = 'mese' | 'scorso' | 'anno' | 'tutto'

/** Il periodo con cui si apre l'elenco: tutto l'anno, non il mese, così un pagamento di qualche mese fa non resta nascosto. */
export const PERIODO_INIZIALE: Periodo = 'anno'

export interface FiltriElenco {
  testo: string
  periodo: Periodo
  tipo: string
  cassaId: string
  voce: string
  persona: FiltroPersona
  annullati: boolean
}

export const FILTRI_INIZIALI: FiltriElenco = { testo: '', periodo: PERIODO_INIZIALE, tipo: '', cassaId: '', voce: '', persona: '', annullati: false }

const NOME_TIPO: Record<string, string> = { entrata: 'Entrate', uscita: 'Uscite', giroconto: 'Giroconti' }
const NOME_PERSONA: Record<string, string> = { collegati: 'Collegati', da_decidere: 'Da decidere', senza_scheda: 'Senza scheda', senza_persona: 'Quote e corsi senza persona' }

/** Le pillole della riga di stato: un filtro acceso, una pillola con la sua ✕. `mese` è il nome del mese in corso («Ottobre 2026»). */
export function filtriAccesi(f: FiltriElenco, nomi: { nomeCassa: (id: string) => string; mese: string }): { chiave: keyof FiltriElenco; testo: string }[] {
  const periodo = { mese: nomi.mese, scorso: 'Mese scorso', anno: 'Tutto l’anno', tutto: 'Tutto' }[f.periodo]
  const tutte: [keyof FiltriElenco, boolean, string][] = [
    ['testo', f.testo.trim() !== '', `«${f.testo.trim()}»`],
    ['periodo', f.periodo !== PERIODO_INIZIALE, periodo],
    ['tipo', f.tipo !== '', NOME_TIPO[f.tipo] ?? f.tipo],
    // Una cassa non più in elenco: la pillola non resta vuota, si può ancora togliere.
    ['cassaId', f.cassaId !== '', nomi.nomeCassa(f.cassaId) || 'Cassa'],
    ['voce', f.voce !== '', f.voce],
    ['persona', f.persona !== '', NOME_PERSONA[f.persona] ?? f.persona],
    ['annullati', f.annullati, 'Con gli annullati'],
  ]
  return tutte.filter(([, acceso]) => acceso).map(([chiave, , testo]) => ({ chiave, testo }))
}

/** La ✕ di una pillola: quel filtro torna com'era alla partenza, gli altri restano. */
export const togliFiltro = (f: FiltriElenco, chiave: keyof FiltriElenco): FiltriElenco => ({ ...f, [chiave]: FILTRI_INIZIALI[chiave] })

export type IconaConti = 'banconota' | 'banca' | 'telefono' | 'tessera' | 'persone' | 'lampadina' | 'manubrio' | 'casa'

/** L'icona accanto al nome della cassa, per le tre casse della palestra; le altre restano senza. */
const ICONE_CASSE: Record<string, IconaConti> = { [NOME_CASSA_CONTANTI]: 'banconota', [NOME_CASSA_CONTO]: 'banca', [NOME_CASSA_SATISPAY]: 'telefono', [NOME_CASSA_CARTA]: 'tessera' }
export const iconaCassa = (nome: string): IconaConti | null => ICONE_CASSE[nome] ?? null

/** Il tipo di un movimento, per la colonna TIPO dell'elenco: il nome e l'icona (quelle di `ICONE_CONTI`). */
export const tipoMovimento = (r: Pick<RigaMovimento, 'origine' | 'tipo'>): { nome: string; icona: IconaConti | 'frecce' } =>
  r.tipo === 'giroconto' ? { nome: 'Giroconto', icona: 'frecce' }
  : r.origine !== 'movimento' ? { nome: 'Incasso iscritto', icona: 'tessera' }
  : { nome: r.tipo === 'entrata' ? 'Entrata' : 'Uscita', icona: 'banconota' }

/** Da dove viene una riga, per il tag nell'elenco e nel movimento aperto: tutti i movimenti si correggono allo stesso modo, qualunque sia l'origine. */
export const originiMovimento = (r: Pick<RigaMovimento, 'origine' | 'origineImport' | 'satispayId' | 'dallaChat'>): string =>
  r.origineImport?.startsWith('banca:') ? 'Dalla banca'
  : r.origineImport?.startsWith('prima-nota:') ? 'Dallo storico'
  : r.satispayId ? 'Da Satispay'
  : r.dallaChat ? 'Dalla chat'
  : 'Dal gestionale'

/** Un'uscita dalla banca che ha ancora solo la scritta grezza («Distinta: …»): del destinatario non si sa niente. */
export const mancaDestinatario = (r: Pick<RigaMovimento, 'origine' | 'tipo' | 'origineImport' | 'satispayId' | 'descrizione'>): boolean =>
  r.origine === 'movimento' && r.tipo === 'uscita' && !r.satispayId && !!r.origineImport?.startsWith('banca:') && (!r.descrizione.trim() || /^distinta:/i.test(r.descrizione.trim()))

/** Il destinatario scritto a mano diventa la descrizione; la scritta della banca va in nota, per il confronto con l'estratto conto. */
export function testoConDestinatario(descrizioneBanca: string, notaAttuale: string | null | undefined, destinatario: string): { descrizione: string; nota: string } {
  const nota = notaAttuale ?? ''
  const descrizione = destinatario.trim().replace(/\s+/g, ' ')
  if (!descrizione) return { descrizione: descrizioneBanca, nota }
  if (!descrizioneBanca.trim()) return { descrizione, nota }
  const traccia = `Dalla banca: ${descrizioneBanca}`
  return { descrizione, nota: nota.includes(traccia) ? nota : nota ? `${nota}\n${traccia}` : traccia }
}

/** La linea sotto il nome di una riga: la voce, e la persona solo se non è già il nome (negli incassi lo è). */
export const lineaVoce = (r: Pick<RigaMovimento, 'descrizione' | 'voce'>, persona?: string): string => {
  const uguale = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  return [r.voce, persona && !uguale(persona, r.descrizione) ? persona : ''].filter(Boolean).join(' · ')
}

// Le voci le scrive chi cura i conti: l'icona si trova solo per le parole che si riconoscono, il resto resta senza.
const ICONE_VOCI: [RegExp, IconaConti][] = [
  [/quot[ae] associativ|tesseramento/, 'tessera'],
  [/corsi|istruttori/, 'persone'],
  [/utenze/, 'lampadina'],
  [/telefon/, 'telefono'],
  [/attrezzatur/, 'manubrio'],
  [/affitto/, 'casa'],
  [/bancari/, 'banca'],
]

export const iconaVoce = (nome: string | null | undefined): IconaConti | null => {
  const n = (nome ?? '').trim().toLowerCase()
  return ICONE_VOCI.find(([parole]) => parole.test(n))?.[1] ?? null
}

/** Quanti filtri sono diversi dalla partenza: serve a dire «N filtri attivi» e a mostrare «Togli i filtri». */
export function filtriAttivi(f: FiltriElenco): number {
  return [f.testo.trim() !== '', f.periodo !== PERIODO_INIZIALE, f.tipo !== '', f.cassaId !== '', f.voce !== '', f.persona !== '', f.annullati].filter(Boolean).length
}

/** Il movimento appena scritto com'è nell'elenco, per sapere se i filtri lo nascondono. */
export const rigaAppenaScritta = (r: Pick<RigaMovimento, 'tipo' | 'data' | 'importo' | 'descrizione' | 'cassaId' | 'cassaAId' | 'personaId'> & { voce?: string | null }): RigaMovimento => ({
  id: 'nuovo',
  origine: 'movimento',
  voce: null,
  annullato: false,
  ...r,
})

/**
 * Un movimento appena scritto resta fuori dall'elenco se i filtri lo escludono: la schermata lo dice, se no sembra perso.
 * Con una persona scelta si dice sempre: il filtro guarda i collegamenti letti prima di scriverlo.
 */
export function nonSiVedra(r: RigaMovimento, f: Pick<FiltroMovimenti, 'testo' | 'dal' | 'al' | 'tipo' | 'cassaId' | 'voce'> & { persona?: string }): boolean {
  return !!f.persona || filtraMovimenti([r], { ...f, annullati: false }).length === 0
}

/** I totali per voce, le entrate prima e in ciascun gruppo la più grande: senza giroconti e annullati. */
export function perVoce(righe: RigaMovimento[]): Array<{ voce: string; tipo: 'entrata' | 'uscita'; totale: number }> {
  const gruppi = new Map<string, { voce: string; tipo: 'entrata' | 'uscita'; totale: number }>()
  for (const r of righe) {
    if (r.annullato || r.tipo === 'giroconto' || !r.voce) continue
    const chiave = `${r.tipo}|${r.voce}`
    const g = gruppi.get(chiave) ?? { voce: r.voce, tipo: r.tipo, totale: 0 }
    g.totale += r.importo
    gruppi.set(chiave, g)
  }
  return [...gruppi.values()].sort((a, b) => (a.tipo === b.tipo ? b.totale - a.totale : a.tipo === 'entrata' ? -1 : 1))
}

/** Il foglio per Excel e per il commercialista: come quello di PAGAMENTI, senza gli annullati e con l'importo senza segno (il tipo dice se esce). */
export function csvMovimenti(righe: RigaMovimento[], casse: Cassa[]): string {
  const nome = (id?: string) => casse.find((c) => c.id === id)?.nome ?? ''
  return csv([
    ['data', 'tipo', 'descrizione', 'voce', 'cassa', 'importo'],
    ...righe
      .filter((r) => !r.annullato)
      .map((r) => [dataRicevuta(r.data), r.tipo, r.descrizione, r.voce ?? '', r.tipo === 'giroconto' ? `${nome(r.cassaId)} → ${nome(r.cassaAId)}` : nome(r.cassaId), euro(r.importo)]),
  ])
}

// Gli stessi rifiuti delle funzioni di 59-contabilita.sql, detti subito sotto al modulo.

/** Una data vera (non il 30 febbraio) in forma `AAAA-MM-GG`. */
export const dataVera = (data: string) => {
  const giorno = /^\d{4}-\d{2}-\d{2}$/.test(data) ? new Date(`${data}T00:00:00Z`) : null
  return !!giorno && !Number.isNaN(giorno.getTime()) && giorno.toISOString().slice(0, 10) === data
}

/** Importo, data e nota: quello che un movimento e un giroconto hanno in comune. */
function cosaNonVaIlComune(importo: number, data: string, nota: string | undefined, oggi: string): string | null {
  if (!Number.isInteger(importo)) return 'L’importo non si capisce'
  if (importo <= 0) return 'L’importo deve essere più di zero'
  if (importo > 10_000_000) return 'L’importo è troppo alto: controlla le cifre'
  if (!dataVera(data) || data < '2000-01-01') return 'La data non si capisce'
  if (data > oggi) return 'La data è nel futuro: si registra quel che è già successo'
  if ((nota ?? '').trim().length > 300) return 'La nota è troppo lunga: al massimo 300 caratteri'
  return null
}

/** L'importo scritto in un campo: vuoto non è ancora un errore, un testo che non è un numero sì. */
export function cosaNonVaImporto(testo: string, esempio: string): string | null {
  if (testo === '' || centesimi(testo) !== null) return null
  return `L’importo non si capisce: scrivi un numero, per esempio ${esempio}.`
}

export interface DatiMovimento {
  tipo: string
  data: string
  importo: number
  voceId?: string
  cassaId: string
  descrizione: string
  nota?: string
  /** Chi ha pagato: obbligatoria per una quota o un corso (`vuolePersona`), ignorata sulle altre voci. */
  personaId?: string
}

export function cosaNonVaMovimento(d: DatiMovimento, voci: VoceContabile[], casse: Cassa[], oggi: string, chiusure: ChiusuraCassa[] = []): string | null {
  if (d.tipo !== 'entrata' && d.tipo !== 'uscita') return 'Scegli se è un’entrata o un’uscita'
  const comune = cosaNonVaIlComune(d.importo, d.data, d.nota, oggi)
  if (comune) return comune
  const voce = voci.find((v) => v.id === d.voceId)
  if (!voce) return 'Scegli la voce'
  if (voce.tipo !== d.tipo) return 'La voce scelta non va con questo tipo di movimento'
  if (!voce.attiva) return 'La voce non è più in uso: scegline un’altra'
  if (voce.diSistema && voce.nome === VOCE_DIFFERENZA) return 'La «Differenza di cassa» si scrive da sola chiudendo la cassa'
  if (vuolePersona(d.tipo, voce.nome) && !d.personaId) return SCEGLI_LA_PERSONA
  const cassa = casse.find((c) => c.id === d.cassaId)
  if (!cassa) return 'Scegli la cassa'
  if (cassa.nome === NOME_CASSA_SATISPAY) return MSG_CASSA_SATISPAY_CHIUSA
  if (cassa.dal && d.data < cassa.dal) return 'La data è prima dell’inizio della cassa'
  if (giornoChiuso(chiusure, [cassa.id], d.data)) return MSG_GIORNO_CHIUSO
  if (!d.descrizione.trim()) return 'Scrivi una descrizione'
  if (d.descrizione.trim().length > 200) return 'La descrizione è troppo lunga: al massimo 200 caratteri'
  return null
}

/**
 * Una ricevuta o un pagamento della stessa persona e dello stesso importo nei 30 giorni fino a `data`: la quota che
 * si sta scrivendo a mano sembra già incassata. È un avviso, non un rifiuto.
 */
export function ricevutaDoppione<T extends Pick<RigaMovimento, 'origine' | 'annullato' | 'personaId' | 'importo' | 'data'>>(righe: T[], personaId: string, importo: number, data: string): T | null {
  if (!personaId) return null
  const dal = new Date(new Date(`${data}T12:00:00Z`).getTime() - 30 * 86_400_000).toISOString().slice(0, 10)
  return righe.find((r) => r.origine !== 'movimento' && !r.annullato && r.personaId === personaId && r.importo === importo && r.data >= dal && r.data <= data) ?? null
}

/** Le righe del riepilogo da confermare prima di scrivere un movimento. */
export const riepilogoMovimento = (d: DatiMovimento, nomeVoce: string, nomeCassa: string): string[] => [
  `${d.tipo === 'entrata' ? 'Entrata' : 'Uscita'} di ${euro(d.importo)} €`,
  `${nomeVoce} · ${nomeCassa}`,
  dataRicevuta(d.data),
  d.descrizione.trim(),
  ...(d.nota?.trim() ? [d.nota.trim()] : []),
]

export interface DatiGiroconto {
  daCassaId: string
  aCassaId: string
  data: string
  importo: number
  nota?: string
}

/** Le righe del riepilogo da confermare prima di scrivere un giroconto: la cassa di partenza prima di quella di arrivo. */
export const riepilogoGiroconto = (d: DatiGiroconto, nomeDa: string, nomeA: string): string[] => [
  `Giroconto di ${euro(d.importo)} €`,
  `Da ${nomeDa} a ${nomeA}`,
  dataRicevuta(d.data),
  ...(d.nota?.trim() ? [d.nota.trim()] : []),
]

export function cosaNonVaGiroconto(d: DatiGiroconto, casse: Cassa[], oggi: string, chiusure: ChiusuraCassa[] = []): string | null {
  const da = casse.find((c) => c.id === d.daCassaId)
  const a = casse.find((c) => c.id === d.aCassaId)
  if (!da || !a) return 'Scegli le due casse'
  if (da.id === a.id) return 'Scegli due casse diverse'
  if (da.nome === NOME_CASSA_SATISPAY || a.nome === NOME_CASSA_SATISPAY) return MSG_CASSA_SATISPAY_CHIUSA
  const comune = cosaNonVaIlComune(d.importo, d.data, d.nota, oggi)
  if (comune) return comune
  if ((da.dal && d.data < da.dal) || (a.dal && d.data < a.dal)) return 'La data è prima dell’inizio della cassa'
  if (giornoChiuso(chiusure, [da.id, a.id], d.data)) return MSG_GIORNO_CHIUSO
  return null
}

/** Per rinominare una voce si passa l'elenco senza quella voce: il nome suo non è un doppione. */
export function cosaNonVaVoce(nome: string, tipo: string | undefined, voci: VoceContabile[]): string | null {
  const n = nome.trim()
  if (!n) return 'Scrivi il nome della voce'
  if (n.length > 60) return 'Il nome della voce è troppo lungo: al massimo 60 caratteri'
  if (tipo !== 'entrata' && tipo !== 'uscita') return 'Scegli se è un’entrata o un’uscita'
  if (voci.some((v) => v.tipo === tipo && v.nome.trim().toLowerCase() === n.toLowerCase())) return `C’è già una voce «${n}» tra le ${tipo === 'entrata' ? 'entrate' : 'uscite'}`
  return null
}

/** Il saldo scritto è diverso da quello salvato? «100» e «100,00» sono lo stesso saldo; un testo che non è un importo conta come cambiato, così la bozza non si perde. */
export function saldoCambiato(testo: string, saldoIniziale: number): boolean {
  return centesimi(testo) !== saldoIniziale
}

/** Il saldo come lo scrive chi lo imposta: `centesimi` scarta il «-», e il messaggio giusto è «negativo». */
export function cosaNonVaSaldoTesto(testo: string, dal?: string | null, contesto?: { oggi: string; primoMovimento?: string; chiusa?: boolean }): string | null {
  const cent = centesimi(testo)
  if (cent === null) return testo.trim().startsWith('-') ? 'Il saldo iniziale non può essere negativo' : 'Il saldo non si capisce: scrivi un numero, per esempio 500,00.'
  return cosaNonVaSaldo(cent, dal, contesto)
}

/** Il giorno del primo movimento a mano non annullato di una cassa (anche come seconda cassa di un giroconto): gli incassi degli iscritti non contano, come nel database. */
export function primoMovimentoManuale(righe: RigaMovimento[], cassaId: string): string | undefined {
  return righe
    .filter((r) => r.origine === 'movimento' && !r.annullato && (r.cassaId === cassaId || r.cassaAId === cassaId))
    .map((r) => r.data)
    .sort()[0]
}

/** `contesto` c'è dove si salva davvero (non basta una data vera: oggi e movimenti già registrati contano). */
export function cosaNonVaSaldo(saldo: number, dal?: string | null, contesto?: { oggi: string; primoMovimento?: string; chiusa?: boolean }): string | null {
  if (contesto?.chiusa) return 'La cassa ha una chiusura: annullala prima di cambiare il saldo iniziale'
  if (!Number.isInteger(saldo)) return 'Il saldo iniziale non si capisce'
  if (saldo < 0) return 'Il saldo iniziale non può essere negativo'
  if (saldo > 100_000_000) return 'Il saldo iniziale è troppo alto: controlla le cifre'
  if (dal && (!dataVera(dal) || dal < '2000-01-01')) return 'La data non si capisce'
  if (dal && contesto) {
    if (dal > contesto.oggi) return 'L’inizio della cassa non può essere nel futuro'
    if (contesto.primoMovimento && contesto.primoMovimento < dal) return 'Ci sono movimenti prima di quella data: annullali o scegli una data più vecchia'
  }
  return null
}

/** Ricevute da cifre assurde: il previsto non torna e la chiusura non si fa (come `chiudi_cassa`). */
export function cosaNonVaPrevisto(previsto: number, contato: number): string | null {
  return Math.abs(contato - previsto) > 100_000_000 || Math.abs(previsto) > 1_000_000_000 ? 'Il previsto della Cassa Contanti non torna: controlla le ricevute in contanti' : null
}

/** Gli stessi rifiuti di `chiudi_cassa` (60-chiusura-cassa.sql), nello stesso ordine. */
export function cosaNonVaChiusura(d: { cassaId: string; data: string; contato: number; nota?: string }, casse: Cassa[], chiusure: ChiusuraCassa[], oggi: string): string | null {
  const cassa = casse.find((c) => c.id === d.cassaId)
  if (!cassa) return 'Scegli la cassa'
  if (cassa.nome !== NOME_CASSA_CONTANTI) return 'Si chiude solo la Cassa Contanti'
  if (!cassa.dal) return 'Imposta prima il saldo iniziale e il giorno di partenza della Cassa Contanti'
  if (!dataVera(d.data) || d.data < '2000-01-01') return 'La data non si capisce'
  if (d.data > oggi) return 'La data è nel futuro: si chiude quel che è già successo'
  const ultima = ultimaChiusura(chiusure, cassa.id)
  if (ultima && d.data <= ultima.data) return `Quel giorno è già chiuso: scegli un giorno dopo il ${dataRicevuta(ultima.data)}`
  if (cassa.dal && d.data < cassa.dal) return 'La data è prima dell’inizio della cassa'
  if (!Number.isInteger(d.contato)) return 'I contanti contati non si capiscono'
  if (d.contato < 0) return 'I contanti contati non possono essere negativi'
  if (d.contato > 100_000_000) return 'I contanti contati sono troppi: controlla le cifre'
  if ((d.nota ?? '').trim().length > 300) return 'La nota è troppo lunga: al massimo 300 caratteri'
  return null
}

/**
 * Un incasso di un iscritto come lo legge la chat (`mcp.ts`): solo quanto, quando, come e su che voce. Nessun
 * nome, nessuna nota: i conti non ne hanno bisogno, e da qui escono verso Claude.
 */
export interface IncassoPerConti {
  data: string
  importo: number
  metodo: string
  voce: string
  annullato: boolean
}

/**
 * Le stesse righe di `incassiDerivati`, senza chi ha pagato: la descrizione dice solo la voce di sistema, e `sotto`
 * (la voce scritta sulla ricevuta, testo libero che può avere un nome) non c'è.
 */
export const incassiPerConti = (incassi: IncassoPerConti[], casse: Cassa[]): RigaMovimento[] =>
  incassiDerivati(incassi.map((x, i) => ({ ...x, id: String(i), chi: '' })), casse).map(({ sotto: _, ...r }) => ({ ...r, descrizione: `Incasso iscritto · ${r.voce}` }))

/**
 * Gli incassi per i conti dalle righe del database: una per ogni pagamento di ogni voce di una ricevuta (annullato se
 * lo è la ricevuta) e una per ogni pagamento a mano, come `righeDaRicevute` e `righeDirette`. Le righe arrivano senza
 * intestatario, note né persona: il server non li legge nemmeno.
 */
export function incassiDaRighe(
  ricevute: Array<{ voci: Array<{ descrizione: string; pagamenti: Array<{ data: string; importo: number; metodo: string }> }>; annullata_il: string | null }>,
  diretti: Array<{ data: string; importo: number; metodo: string; voce: string; annullato_il: string | null }>,
): IncassoPerConti[] {
  return [
    ...ricevute.flatMap((r) => r.voci.flatMap((v) => v.pagamenti.map((p) => ({ data: p.data, importo: p.importo, metodo: p.metodo, voce: v.descrizione, annullato: r.annullata_il !== null })))),
    ...diretti.map((d) => ({ data: d.data, importo: d.importo, metodo: d.metodo, voce: d.voce, annullato: d.annullato_il !== null })),
  ]
}

/** Una chiusura come la dà il database (60-chiusura-cassa.sql), col movimento della sua differenza. */
export const chiusuraDaRiga = (r: {
  id: string; cassa_id: string; dal: string; data: string; previsto: number; contato: number; differenza: number
  movimento_id: string | null; chiusa_il: string; annullata_il: string | null
}): ChiusuraCassa => ({
  id: r.id,
  cassaId: r.cassa_id,
  dal: r.dal,
  data: r.data,
  previsto: r.previsto,
  contato: r.contato,
  differenza: r.differenza,
  chiusaIl: r.chiusa_il,
  ...(r.movimento_id ? { movimentoId: r.movimento_id } : {}),
  ...(r.annullata_il ? { annullataIl: r.annullata_il } : {}),
})

/** Il saldo di una cassa a un giorno, per la chat: `null` se non si dice (vedi `saldiCasse`). */
export interface SaldoPerChat {
  cassaId: string
  nome: string
  saldo: number | null
  /** La cassa parte dopo il giorno chiesto: da quando. */
  parteIl?: string
  /** Solo della Cassa Contanti: l'ultima chiusura attiva fino al giorno chiesto, o `null` se non ce n'è. */
  ultimaChiusura?: { data: string; contato: number; nonPiuInRegola: boolean } | null
}

/**
 * Quanto c'è nelle casse «secondo i conti» a un giorno. Della Cassa Contanti mai il previsto: la chiusura si
 * conta alla cieca, e chi conta potrebbe chiederlo prima; se ne dicono l'ultima chiusura e se è ancora in regola.
 * Una cassa che parte dopo quel giorno non ha un saldo, nemmeno zero.
 */
export function saldiCasse(casse: Cassa[], righe: RigaMovimento[], chiusure: ChiusuraCassa[], giorno: string): SaldoPerChat[] {
  return casse.map((c) => {
    const base = { cassaId: c.id, nome: c.nome }
    if (c.nome === NOME_CASSA_CONTANTI) {
      const k = ultimaChiusura(chiusure.filter((x) => x.data <= giorno), c.id)
      return { ...base, saldo: null, ultimaChiusura: k ? { data: k.data, contato: k.contato, nonPiuInRegola: chiusuraNonPiuInRegola(k, casse, righe) } : null }
    }
    if (c.dal && c.dal > giorno) return { ...base, saldo: null, parteIl: c.dal }
    return { ...base, saldo: previstoCassa(casse, righe, c.id, giorno) }
  })
}
