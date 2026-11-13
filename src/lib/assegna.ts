// Un'entrata collegata a una persona (il bonifico) si assegna a quota e corsi, anche dei fratelli del nucleo, come saldo
// o parziale: ogni pezzo è una riga di PAGAMENTI col `movimentoId` del movimento. Dal movimento si fa poi la ricevuta,
// una per persona. In CONTABILITÀ quei soldi restano una volta sola, nel movimento: `incassiDerivati` salta le righe
// col movimento. Le stesse regole sono in `supabase/135-assegna-movimento.sql` e `136-assegna-una-volta.sql`, e per la modalità prova in
// `segreteriaProva.ts`.
import { NOME_CASSA_CONTANTI, NOME_CASSA_CONTO, VOCE_CORSI, VOCE_QUOTA, voceDiSistema, type Cassa, type MovimentoManuale, type VoceContabile } from './contabilita'
import type { PagamentoDiretto } from './pagamenti'
import { VOCE_DA_CLASSIFICARE } from './importaPrimaNota'
import type { VoceStorico } from './movimentiPersona'
import { QUOTA, centesimi, fineTrimestre, vociDelCorso, vociPronte, type QuotaRicevuta, type Ricevuta, type VoceRicevuta } from './ricevute'
import { conAnnuale, statoCorsi, type VoceCorso } from './corsiDaPagare'
import { PIU_CORSI, stagioneDi } from './costi'
import { ePiuCorsi, scontoDellaVoce, VOCE_PIU_CORSI } from './nucleo'
import { listinoUsabile, nomeCorso, voceDelCorso, type CorsoRef, type Listino } from './listino'
import { pagamentoDi, type DatiSegreteria, type PersonaSeg } from './segreteria'
import { nomeOGenitore } from './abbinaMovimenti'
import { ripartizioneSicura } from './sicuro'

/**
 * I soldi sempre con i centesimi, come nel canvas: «50,00 €». Il punto delle migliaia anche a quattro cifre
 * («1.234,50 €»), come `euro_assegna` del database: in italiano `toLocaleString` lo mette solo da cinque.
 */
export function euroAssegna(cent: number): string {
  // A mano e non con `useGrouping: 'always'`: i tipi di ES2022 non lo conoscono.
  const segno = cent < 0 ? '-' : ''
  const tutto = Math.round(Math.abs(cent))
  const interi = String(Math.floor(tutto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${segno}${interi},${String(tutto % 100).padStart(2, '0')} €`
}

/** Una cosa ancora da pagare, nel dialogo ASSEGNA IL BONIFICO. `manca` in centesimi. */
export interface VoceDovuta {
  personaId: string
  voce: string
  /** `abbigliamento`: aggiunta a mano, senza prezzo nel listino; `manca` è il bonifico. */
  tipo: 'quota' | 'corso' | 'abbigliamento'
  dal: string
  manca: number
  /** Per la voce «più corsi»: i corsi che copre, da mostrare (la voce non li elenca). */
  corsi?: string[]
  /** Aggiunta a mano dal listino (`vociDaAggiungere`): `manca` è il prezzo del listino. */
  aggiunta?: { corso: string; suo: boolean }
}

/** Un pezzo del bonifico: a chi, su che voce, quanto. */
export interface RigaAssegnata {
  personaId: string
  voce: string
  importo: number
}

/** Un'assegnazione diventa ricevuta solo dal movimento (il trigger `assegnazione_solo_dal_movimento`, 135). */
export const SOLO_DAL_MOVIMENTO = 'Questi soldi vengono da un bonifico: la ricevuta si fa dal movimento, in CONTABILITÀ.'

const delMovimento = (movimentoId: string) => (x: { movimentoId?: string }) => x.movimentoId === movimentoId

/** Quel che del movimento è già assegnato: le righe attive col movimento, più il pagato delle sue ricevute non annullate. */
export function assegnato(movimentoId: string, diretti: PagamentoDiretto[], ricevute: Ricevuta[]): number {
  const righe = diretti.filter(delMovimento(movimentoId)).filter((d) => !d.annullatoIl).reduce((s, d) => s + d.importo, 0)
  const inRicevuta = ricevute.filter(delMovimento(movimentoId)).filter((r) => !r.annullataIl).reduce((s, r) => s + r.pagato, 0)
  return righe + inRicevuta
}

/** Le parole del trigger `movimento_assegnato_resta` (135) quando si cambia chi o cosa a un movimento con soldi assegnati. */
export const MOVIMENTO_ASSEGNATO = 'Il movimento ha dei soldi assegnati: annulla prima ricevute e assegnazioni.'

/**
 * Persona o voce di questi movimenti non si cambiano se uno ha soldi assegnati: le assegnazioni e le ricevute
 * resterebbero di qualcun altro, o su un'entrata che non è più un incasso della palestra. Tutto o niente.
 */
export const cosaNonVaCambioMovimento = (ids: string[], diretti: PagamentoDiretto[], ricevute: Ricevuta[]): string | undefined =>
  ids.some((id) => assegnato(id, diretti, ricevute) > 0) ? MOVIMENTO_ASSEGNATO : undefined

/**
 * Un'importazione si annulla solo se nessun suo movimento ha una ricevuta attiva: la ricevuta direbbe soldi che
 * nell'elenco non ci sono più. Si nomina la prima, come il database.
 */
export function cosaNonVaAnnullaLotto(ids: string[], ricevute: Ricevuta[]): string | undefined {
  const dentro = new Set(ids)
  const prima = ricevute
    .filter((r) => !!r.movimentoId && dentro.has(r.movimentoId) && !r.annullataIl)
    .sort((x, y) => x.anno - y.anno || x.numero - y.numero)[0]
  return prima ? `Annulla prima la ricevuta n. ${prima.numero}/${prima.anno}` : undefined
}

/**
 * Quanto del movimento non è ancora assegnato. Un'assegnazione diventata ricevuta è annullata e i suoi soldi sono nel
 * pagato della ricevuta: si contano una volta. Mai sotto zero, anche se i dati non tornano.
 */
export const daAssegnare = (m: Pick<MovimentoManuale, 'id' | 'importo'>, diretti: PagamentoDiretto[], ricevute: Ricevuta[]): number =>
  Math.max(0, m.importo - assegnato(m.id, diretti, ricevute))

/** Prima le quote, poi i corsi dal più vecchio; a pari data l'ordine in cui arrivano. Nessuna riga a zero. */
export function proponiRipartizione(importo: number, dovuti: VoceDovuta[]): { righe: RigaAssegnata[]; daAssegnare: number } {
  const ordinati = dovuti
    .map((d, i) => ({ d, i }))
    .sort((a, b) => Number(a.d.tipo !== 'quota') - Number(b.d.tipo !== 'quota') || a.d.dal.localeCompare(b.d.dal) || a.i - b.i)
  let resta = importo
  const righe: RigaAssegnata[] = []
  for (const { d } of ordinati) {
    const quanto = Math.min(resta, d.manca)
    if (quanto <= 0) continue
    righe.push({ personaId: d.personaId, voce: d.voce, importo: quanto })
    resta -= quanto
  }
  return { righe, daAssegnare: resta }
}

/** Dopo «È questo bonifico»: il bonifico è di quella persona, quindi va prima sulle sue cose e quel che avanza sugli altri. */
export function propostaDopoIlSi(importo: number, dovuti: VoceDovuta[], personaId: string): { righe: RigaAssegnata[]; daAssegnare: number } {
  const sue = proponiRipartizione(importo, dovuti.filter((v) => v.personaId === personaId))
  const altre = proponiRipartizione(sue.daAssegnare, dovuti.filter((v) => v.personaId !== personaId))
  return { righe: [...sue.righe, ...altre.righe], daAssegnare: altre.daAssegnare }
}

const stessa = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Perché le righe non si scrivono, o null. `importo` è quel che del bonifico resta da assegnare. */
export function cosaNonVaAssegnazione(righe: RigaAssegnata[], importo: number, dovuti: VoceDovuta[]): string | null {
  if (!righe.length) return 'Metti almeno un importo su una voce.'
  if (righe.some((r) => !(r.importo > 0))) return 'Metti su ogni voce un importo maggiore di zero.'
  if (righe.some((r) => !r.voce.trim())) return 'Scrivi a cosa serve ogni importo.'
  for (const d of dovuti) {
    const messo = righe.filter((r) => r.personaId === d.personaId && stessa(r.voce, d.voce)).reduce((s, r) => s + r.importo, 0)
    if (messo > d.manca) {
      const chi = d.tipo === 'quota' ? 'Alla quota' : `A «${d.voce}»`
      return `${chi} mancano ${euroAssegna(d.manca)}: metti ${euroAssegna(d.manca)} o meno, il resto rimane da assegnare.`
    }
  }
  const totale = righe.reduce((s, r) => s + r.importo, 0)
  if (totale > importo) return `Hai assegnato ${euroAssegna(totale - importo)} più del bonifico: togli da una voce.`
  return null
}

/**
 * Il tetto della quota (136-assegna-una-volta.sql), o null: per persona e stagione, le righe nuove sulla quota più
 * quel che la quota ha già (assegnazioni attive e pagato delle ricevute attive) non passano `tetto`, il prezzo della
 * quota nel listino in centesimi; senza tetto, nessun limite. Le assegnazioni diventate ricevuta sono annullate e
 * contano tramite la ricevuta, una volta sola. La stagione è quella del nome della voce, se no della data: `data` del
 * movimento per le righe nuove, del pagamento, il `dal` della voce della ricevuta o la sua data. Il tetto dei corsi è
 * in `cosaNonVaAssegnazione`.
 */
export function cosaNonVaQuota(righe: RigaAssegnata[], data: string, diretti: PagamentoDiretto[], ricevute: Ricevuta[], tetto?: number): string | null {
  if (!tetto || tetto <= 0) return null
  const gruppi = new Map<string, { personaId: string; stagione: number; nuovo: number }>()
  for (const r of righe.filter((x) => eQuota(x.voce))) {
    const stagione = annoQuota(r.voce, data)
    const g = gruppi.get(`${r.personaId}|${stagione}`) ?? { personaId: r.personaId, stagione, nuovo: 0 }
    g.nuovo += r.importo
    gruppi.set(`${r.personaId}|${stagione}`, g)
  }
  for (const g of gruppi.values()) {
    const gia = giaSullaQuota(g.personaId, g.stagione, diretti, ricevute)
    if (gia + g.nuovo > tetto) {
      const manca = euroAssegna(Math.max(0, tetto - gia))
      return `Alla quota mancano ${manca}: metti ${manca} o meno, il resto rimane da assegnare.`
    }
  }
  return null
}

/**
 * Quel che la quota di una persona ha già in una stagione, come lo conta il database (136): le assegnazioni attive e il
 * pagato delle ricevute attive. Lo usano il tetto (`cosaNonVaQuota`) e quel che il dialogo dice che manca (`dovutiDi`).
 */
function giaSullaQuota(personaId: string, stagione: number, diretti: PagamentoDiretto[], ricevute: Ricevuta[]): number {
  const assegnati = diretti
    .filter((d) => !d.annullatoIl && d.personaId === personaId && eQuota(d.voce) && annoQuota(d.voce, d.data) === stagione)
    .reduce((s, d) => s + d.importo, 0)
  const inRicevuta = ricevute
    .filter((r) => !r.annullataIl && r.personaId === personaId)
    .flatMap((r) => r.voci.filter((v) => eQuota(v.descrizione) && annoQuota(v.descrizione, v.dal || r.data) === stagione))
    .reduce((s, v) => s + v.pagamenti.reduce((t, p) => t + p.importo, 0), 0)
  return assegnati + inRicevuta
}

/**
 * Perché il movimento non si assegna, o null: solo le entrate collegate su quota e corsi, e non i contanti (entrano già da
 * PAGAMENTI). Lo storico del vecchio programma solo dalla stagione di `oggi` (dal 1° agosto, come
 * `71-pagato-vecchio-programma.sql`): quello delle stagioni passate non ha niente da pagare a cui andare.
 */
export function cosaNonVaMovimentoDaAssegnare(
  m: Pick<MovimentoManuale, 'tipo' | 'voceId' | 'cassaId' | 'personaId' | 'annullatoIl' | 'data' | 'origineImport'>,
  casse: Cassa[],
  voci: VoceContabile[],
  oggi: string,
): string | null {
  if (m.annullatoIl) return 'Il movimento è annullato: non si assegna.'
  if (m.tipo !== 'entrata') return 'Un’uscita non si assegna: si assegnano solo le entrate.'
  if (!m.personaId) return 'Collega prima il movimento a una persona.'
  const voce = voci.find((v) => v.id === m.voceId)?.nome
  if (voce !== VOCE_QUOTA && voce !== VOCE_CORSI) return `Si assegnano solo le entrate su «${VOCE_QUOTA}» e «${VOCE_CORSI}».`
  if (casse.find((c) => c.id === m.cassaId)?.nome === NOME_CASSA_CONTANTI) return 'I contanti non si assegnano da qui: registra il pagamento in PAGAMENTI.'
  if (m.origineImport?.startsWith('prima-nota:') && m.data < stagioneDi(oggi).dal) return 'Questo bonifico è del vecchio programma, di una stagione passata: resta nello storico, non si assegna.'
  return null
}

/** A chi si può assegnare il bonifico di `id`: il titolare del nucleo e le persone attive del suo nucleo. */
export function personeDelNucleo(id: string, persone: Array<{ id: string; nucleo?: string; attiva: boolean }>): string[] {
  const titolare = persone.find((p) => p.id === id)?.nucleo ?? id
  return [titolare, ...persone.filter((p) => p.attiva && p.nucleo === titolare && p.id !== titolare).map((p) => p.id)]
}

const GIORNO = 86_400_000
const giorni = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / GIORNO

/** Una ricevuta fatta prima a parte si abbina a un bonifico entro tanti giorni. */
export const GIORNI_ABBINAMENTO = 30

// Nome e genitore servono solo per un bonifico senza persona: chi non li ha non è mai nominato nella causale.
export type PersonaNucleo = { id: string; nucleo?: string; attiva: boolean; nome?: string; cognome?: string; genitoreNome?: string; genitoreCognome?: string }
type MovimentoAbbinabile = { id: string; importo: number; data: string; personaId?: string; descrizione?: string }
type RicevutaAbbinabile = Pick<Ricevuta, 'personaId' | 'pagato' | 'voci' | 'data'> & Partial<Pick<Ricevuta, 'annullataIl' | 'movimentoId' | 'numero' | 'anno'>>

/**
 * Perché la ricevuta non è quella del bonifico, o null. I controlli sul movimento li fa `cosaNonVaMovimentoDaAssegnare`
 * (o `movimentoDaClassificareAbbinabile`). La ricevuta è della persona del bonifico o del suo nucleo, come per «Assegna»
 * (`personeDelNucleo`); senza `persone` vale solo la stessa persona. Un bonifico Da classificare senza persona va solo se la
 * causale nomina, con nome e cognome interi, qualcuno del nucleo della ricevuta o il suo genitore (`nomeOGenitore`, come
 * `abbina_testo_banca`): se no lo stesso importo basta a proporre la ricevuta di una famiglia che non c'entra.
 */
export function cosaNonVaAbbinamento(m: MovimentoAbbinabile, r: RicevutaAbbinabile, persone: PersonaNucleo[] = []): string | null {
  if (r.annullataIl) return 'La ricevuta è annullata.'
  if (r.movimentoId && r.movimentoId !== m.id) return `La ricevuta n. ${r.numero}/${r.anno} è già abbinata a un altro bonifico.`
  if (m.personaId && r.personaId !== m.personaId && !personeDelNucleo(m.personaId, persone).includes(r.personaId ?? '')) return 'La ricevuta è di un’altra persona.'
  // Un bonifico senza persona la prende dalla ricevuta: una ricevuta senza persona non gliela può dare.
  if (!m.personaId && !r.personaId) return 'La ricevuta non ha una persona.'
  if (!m.personaId && !personeDelNucleo(r.personaId ?? '', persone).some((id) => {
    const p = persone.find((x) => x.id === id)
    return !!p && nomeOGenitore({ nome: p.nome ?? '', cognome: p.cognome ?? '', genitoreNome: p.genitoreNome ?? null, genitoreCognome: p.genitoreCognome ?? null }, m.descrizione ?? '') !== null
  })) return 'La causale del bonifico non nomina la persona della ricevuta, il suo genitore o qualcuno della sua famiglia.'
  if (r.pagato !== m.importo) return 'La ricevuta e il bonifico non hanno lo stesso importo.'
  const pagamenti = r.voci.flatMap((v) => v.pagamenti)
  if (!pagamenti.length || pagamenti.some((p) => !stessa(p.metodo, 'Bonifico'))) return 'La ricevuta non è tutta pagata con bonifico.'
  if (giorni(r.data, m.data) > GIORNI_ABBINAMENTO) return `La ricevuta e il bonifico distano più di ${GIORNI_ABBINAMENTO} giorni.`
  return null
}

/** Le persone con il nome del genitore della loro anagrafica (`genitori()`), per la causale di un bonifico senza persona. */
export const conGenitori = <P extends { id: string }>(persone: P[], genitori: Map<string, { genitoreNome?: string; genitoreCognome?: string }>) =>
  persone.map((p) => ({ ...p, genitoreNome: genitori.get(p.id)?.genitoreNome, genitoreCognome: genitori.get(p.id)?.genitoreCognome }))

/**
 * «Collegati prima»: per i bonifici collegati prima di questo cambio, la ricevuta già fatta a parte che è la sua.
 * Una ricevuta va a un solo bonifico, il più vicino di data; un bonifico prende una ricevuta sola.
 */
export function abbinamentiProposti(
  movimenti: MovimentoAbbinabile[],
  ricevute: Ricevuta[],
  persone: PersonaNucleo[] = [],
): Array<{ movimentoId: string; ricevutaId: string }> {
  const coppie = movimenti
    .flatMap((m) => ricevute.filter((r) => !r.movimentoId && cosaNonVaAbbinamento(m, r, persone) === null).map((r) => ({ m, r, d: giorni(r.data, m.data) })))
    .sort((a, b) => a.d - b.d || a.m.data.localeCompare(b.m.data) || a.r.numero - b.r.numero)
  const presiM = new Set<string>()
  const presiR = new Set<string>()
  const fuori: Array<{ movimentoId: string; ricevutaId: string }> = []
  for (const { m, r } of coppie) {
    if (presiM.has(m.id) || presiR.has(r.id)) continue
    presiM.add(m.id)
    presiR.add(r.id)
    fuori.push({ movimentoId: m.id, ricevutaId: r.id })
  }
  return fuori
}

/**
 * «Collegati prima» della scheda Da assegnare: i bonifici collegati senza niente ancora assegnato (abbinare una ricevuta
 * a uno già diviso conterebbe due volte), ciascuno con la ricevuta già fatta che è la sua.
 */
export function collegatiPrima(manuali: MovimentoManuale[], diretti: PagamentoDiretto[], ricevute: Ricevuta[], casse: Cassa[], voci: VoceContabile[], oggi: string, persone: PersonaNucleo[] = []) {
  const liberi = manuali.filter((m) => daAssegnare(m, diretti, ricevute) === m.importo && cosaNonVaMovimentoDaAssegnare(m, casse, voci, oggi) === null)
  return abbinamentiProposti(liberi, ricevute, persone)
}

/** Nel bonifico aperto, la ricevuta già fatta da proporgli: la stessa coppia di «Collegati prima», o undefined. */
export function ricevutaGiaFatta(movimentoId: string, manuali: MovimentoManuale[], diretti: PagamentoDiretto[], ricevute: Ricevuta[], casse: Cassa[], voci: VoceContabile[], oggi: string, persone: PersonaNucleo[] = []): string | undefined {
  return collegatiPrima(manuali, diretti, ricevute, casse, voci, oggi, persone).find((x) => x.movimentoId === movimentoId)?.ricevutaId
}

/**
 * Un'entrata Da classificare del Conto Corrente si abbina a una ricevuta in Bonifico (151): prende persona e voce della
 * ricevuta (se ne ha già una la tiene, e la ricevuta dev'essere del suo nucleo). Non Satispay, non annullata, non lo
 * storico del vecchio programma di una stagione passata.
 */
export function movimentoDaClassificareAbbinabile(
  m: Pick<MovimentoManuale, 'tipo' | 'voceId' | 'cassaId' | 'annullatoIl' | 'data' | 'origineImport' | 'satispayId'>,
  casse: Cassa[],
  voci: VoceContabile[],
  oggi: string,
): boolean {
  return !m.annullatoIl && m.tipo === 'entrata' && !m.satispayId
    && voci.find((v) => v.id === m.voceId)?.nome === VOCE_DA_CLASSIFICARE
    && casse.find((c) => c.id === m.cassaId)?.nome === NOME_CASSA_CONTO
    && !(m.origineImport?.startsWith('prima-nota:') && m.data < stagioneDi(oggi).dal)
}

/**
 * I bonifici Da classificare con le ricevute che possono essere loro (la causale nomina la famiglia), dalla data più vicina:
 * mai una sola scelta da sé, perché lo stesso nome può tornare in più ricevute. Le ricevute di `esclusi` (già proposte a un bonifico collegato) no.
 */
export function daClassificareDaAbbinare(movimenti: MovimentoAbbinabile[], ricevute: Ricevuta[], esclusi: Set<string> = new Set(), persone: PersonaNucleo[] = []): Array<{ movimentoId: string; ricevute: string[] }> {
  return movimenti
    .map((m) => ({
      movimentoId: m.id,
      ricevute: ricevute
        .filter((r) => !r.movimentoId && !esclusi.has(r.id) && cosaNonVaAbbinamento(m, r, persone) === null)
        .sort((a, b) => giorni(a.data, m.data) - giorni(b.data, m.data) || a.data.localeCompare(b.data) || a.numero - b.numero)
        .map((r) => r.id),
    }))
    .filter((x) => x.ricevute.length > 0)
}

/** La voce che prende un bonifico Da classificare abbinato: «Quota associativa» se la ricevuta è solo quota, se no «Corsi e altri pagamenti». */
export const voceDaRicevuta = (r: Pick<Ricevuta, 'voci'>) => (r.voci.length > 0 && r.voci.every((v) => voceDiSistema(v.descrizione) === VOCE_QUOTA) ? VOCE_QUOTA : VOCE_CORSI)

/** I bonifici liberi per un abbinamento: non ancora assegnati, collegati su quota o corsi, o Da classificare (151). */
export function bonificiLiberi(manuali: MovimentoManuale[], diretti: PagamentoDiretto[], ricevute: Ricevuta[], casse: Cassa[], voci: VoceContabile[], oggi: string): MovimentoManuale[] {
  return manuali.filter((m) => daAssegnare(m, diretti, ricevute) === m.importo && (cosaNonVaMovimentoDaAssegnare(m, casse, voci, oggi) === null || movimentoDaClassificareAbbinabile(m, casse, voci, oggi)))
}

/**
 * Il modulo ricevuta in Bonifico: i bonifici del Conto Corrente ancora liberi (collegati e non assegnati, o Da
 * classificare) che possono essere questi soldi, dal più vicino. `movimenti` sono già quelli liberi.
 */
export function bonificiPerRicevuta<T extends MovimentoAbbinabile>(movimenti: T[], bozza: RicevutaAbbinabile, persone: PersonaNucleo[] = []): T[] {
  return movimenti.filter((m) => cosaNonVaAbbinamento(m, bozza, persone) === null).sort((a, b) => giorni(a.data, bozza.data) - giorni(b.data, bozza.data) || a.id.localeCompare(b.id))
}

/** Le entrate che hanno ancora soldi da assegnare, dalla più vecchia, e quanto fanno in tutto. */
export function elencoDaAssegnare(manuali: MovimentoManuale[], diretti: PagamentoDiretto[], ricevute: Ricevuta[], casse: Cassa[], voci: VoceContabile[], oggi: string) {
  const righe = manuali
    .filter((m) => cosaNonVaMovimentoDaAssegnare(m, casse, voci, oggi) === null)
    // `as string`: il filtro qui sopra lascia solo i movimenti collegati, ma TypeScript non lo sa.
    .map((m) => ({ movimentoId: m.id, personaId: m.personaId as string, data: m.data, importo: m.importo, daAssegnare: daAssegnare(m, diretti, ricevute) }))
    .filter((r) => r.daAssegnare > 0)
    .sort((a, b) => a.data.localeCompare(b.data) || a.movimentoId.localeCompare(b.movimentoId))
  return { righe, totale: righe.reduce((s, r) => s + r.daAssegnare, 0) }
}

const assegnazioniDi = (diretti: PagamentoDiretto[], personaId: string) => diretti.filter((d) => d.movimentoId && !d.annullatoIl && d.personaId === personaId)
const eQuota = (voce: string) => voce.trim().toLowerCase().startsWith(VOCE_QUOTA.toLowerCase())
/** «2026/27»: la stagione nel nome della voce, come la scrive il dialogo. */
export const nomeStagione = (dal: string) => {
  const anno = Number(dal.slice(0, 4))
  return `${anno}/${String((anno + 1) % 100).padStart(2, '0')}`
}

/**
 * Le quote della persona con le assegnazioni dentro: i soldi assegnati alla quota della stagione (detta nel nome
 * della voce, se no dalla data) fanno una quota in più, pagata o in parte. Senza assegnazioni, le quote di prima.
 */
export function quoteConAssegnazioni(quote: QuotaRicevuta[], quota: { prezzo: number; dal: string; al: string }, diretti: PagamentoDiretto[], personaId: string): QuotaRicevuta[] {
  const stagione = nomeStagione(quota.dal)
  const sue = assegnazioniDi(diretti, personaId).filter((d) => {
    if (!eQuota(d.voce)) return false
    const detta = d.voce.match(/\d{4}\/\d{2}/)?.[0]
    return detta ? detta === stagione : d.data >= quota.dal && d.data <= quota.al
  })
  if (!sue.length) return quote
  const messo = sue.reduce((s, d) => s + d.importo, 0)
  // Si parte da quel che manca ancora dopo le ricevute della stessa stagione (un acconto già in ricevuta), se no dal
  // prezzo: un saldo assegnato dopo un acconto chiude la quota. Le assegnazioni attive non sono mai in una ricevuta.
  const prima = quote.filter((q) => !!q.dal && q.dal <= quota.al && (q.al ?? '9999-12-31') >= quota.dal).map((q) => q.mancano)
  const base = prima.length ? Math.min(...prima) : quota.prezzo
  // Numero 0: non c'è una ricevuta, ci sono i bonifici. La scheda lo dice così.
  return [...quote, { anno: Number(quota.dal.slice(0, 4)), numero: 0, dal: quota.dal, al: quota.al, mancano: Math.max(0, base - messo) }]
}

/** Le righe attive di `pagamenti_diretti` (bonifici assegnati e pagamenti a mano, non ancora ricevuta) di una persona. */
const attiveDi = (diretti: PagamentoDiretto[], personaId: string) => diretti.filter((d) => d.personaId === personaId && !d.annullatoIl)

/** I centesimi già in segreteria sulla quota di questa stagione, come `quota_in_segreteria` (146): l'area iscritti non li fa pagare di nuovo. */
export const quotaInSegreteria = (diretti: PagamentoDiretto[], personaId: string, oggi: string): number =>
  attiveDi(diretti, personaId)
    .filter((d) => eQuota(d.voce) && annoQuota(d.voce, d.data) === annoQuota('', oggi))
    .reduce((s, d) => s + d.importo, 0)

/**
 * C'è già qualcosa in segreteria sull'annuale, il trimestre o il saldo del corso, nella stagione dei corsi di oggi (dal
 * 1° luglio); un trimestre solo per i suoi tre mesi (`fineTrimestre`). Come `corso_in_segreteria` (146).
 */
export const corsoInSegreteria = (diretti: PagamentoDiretto[], personaId: string, nomi: string[], oggi: string): boolean =>
  attiveDi(diretti, personaId).some((d) => {
    // Coi nomi come `statoCorsi`: «Annuale Fitness 2 giorni», senza accenti e maiuscole (152).
    const m = d.voce.trim().match(/^(annuale|trimestre|saldo)\s+(.+)$/i)
    const formula = m && nomi.some((n) => !!nomeCorso(n) && nomeCorso(n) === nomeCorso(m[2])) ? m[1].toLowerCase() : undefined
    return !!formula && stagioneDi(d.data).corsi.dal === stagioneDi(oggi).corsi.dal && (formula !== 'trimestre' || oggi <= fineTrimestre(d.data))
  })

/**
 * Le quote dell'iscritto con quel che la segreteria ha già, come `quota_della_segreteria` (146): una quota in più,
 * numero 0, con quel che manca dopo le ricevute della stessa stagione (se no dal prezzo). Come `quoteConAssegnazioni`.
 */
export function quoteConSegreteria(quote: QuotaRicevuta[], prezzo: number, diretti: PagamentoDiretto[], personaId: string, oggi: string): QuotaRicevuta[] {
  const messo = quotaInSegreteria(diretti, personaId, oggi)
  if (!messo) return quote
  const q = stagioneDi(oggi).quota
  const prima = quote.filter((x) => !!x.dal && x.dal <= q.al && (x.al ?? '9999-12-31') >= q.dal).map((x) => x.mancano)
  const base = prima.length ? Math.min(...prima) : prezzo
  return [...quote, { anno: annoQuota('', oggi), numero: 0, dal: q.dal, al: q.al, mancano: Math.max(0, base - messo) }]
}

/** Due periodi si toccano. Senza le date del prezzo vale la sola descrizione; una voce senza date non si sa di quando sia. */
const stessoPeriodo = (v: { dal?: string; al?: string }, p: { dal?: string; al?: string }) =>
  !p.dal || (!!v.dal && v.dal <= (p.al ?? '9999-12-31') && (v.al ?? '9999-12-31') >= p.dal)

/** Come `quoteConAssegnazioni`, per le voci dei corsi: una voce per prezzo del listino che ha soldi assegnati. */
export function vociCorsiConAssegnazioni(
  voci: VoceCorso[],
  prezzi: Array<{ descrizione: string; prezzo: number; dal?: string; al?: string }>,
  diretti: PagamentoDiretto[],
  personaId: string,
  /**
   * Quanto costa una voce «più corsi», che il listino non ha: il tetto meno gli annuali già messi in `voci`, che
   * comprende quelli appena fatti dalle assegnazioni (un annuale solo assegnato conta come uno in ricevuta).
   */
  prezzoPiuCorsi: (voce: string, voci: VoceCorso[]) => number = () => TETTO,
): VoceCorso[] {
  const sue = assegnazioniDi(diretti, personaId).filter((d) => !eQuota(d.voce))
  const piu = [...new Set(sue.flatMap((d) => (ePiuCorsi(d.voce) ? [d.voce.trim()] : [])))]
  const stagione = (voce: string) => stagioneDi(sue.filter((d) => stessa(d.voce, voce)).map((d) => d.data).sort()[0]).corsi
  const fatte = new Set<string>()
  const nuove: VoceCorso[] = []
  const conta = (p: { descrizione: string; prezzo: number; dal?: string; al?: string }) => {
    const chiave = p.descrizione.trim().toLowerCase()
    if (chiave === QUOTA.toLowerCase() || fatte.has(chiave)) return
    const sulla = sue.filter((d) => stessa(d.voce, p.descrizione))
    if (!sulla.length) return
    fatte.add(chiave)
    const messo = sulla.reduce((s, d) => s + d.importo, 0)
    const data = sulla.map((d) => d.data).sort()[0]
    // Come per la quota: dopo un acconto già in ricevuta si parte da quel che manca, se no dal prezzo. Solo le
    // ricevute dello stesso periodo: l'annuale della stagione passata, tutto pagato, non chiude quello di adesso.
    const prima = voci
      .filter((v) => stessa(v.descrizione, p.descrizione) && stessoPeriodo(v, p))
      .map((v) => v.mancano)
    const base = prima.length ? Math.min(...prima) : p.prezzo
    // `totale` come una voce di ricevuta: il timbro della scheda dice «di quanto» anche prima della ricevuta.
    nuove.push({ descrizione: p.descrizione, dal: p.dal, al: p.al, mancano: Math.max(0, base - messo), totale: p.prezzo, data })
  }
  prezzi.forEach(conta)
  // Le «più corsi» dopo, perché il loro prezzo dipende dagli annuali appena contati.
  for (const voce of piu) conta({ descrizione: voce, prezzo: prezzoPiuCorsi(voce, [...voci, ...nuove]), ...stagione(voce) })
  return nuove.length ? [...voci, ...nuove] : voci
}

/** Il tetto di PIÙ CORSI, in centesimi: gli annuali di una persona non costano di più (la quota a parte). */
const TETTO = PIU_CORSI * 100

/**
 * Quanto degli annuali della stagione dei corsi di `giorno` è già messo, in ricevuta o assegnato, al prezzo del listino
 * anche se non è pagato tutto (quel che manca resta sulla sua voce): il tetto di PIÙ CORSI meno questo è quel che costa
 * il resto. Una voce «più corsi» chiude il tetto, perché costa proprio quel che mancava; `tranne` è quella che si sta
 * contando.
 */
export function giaSugliAnnuali(voci: VoceCorso[], listino: Listino, giorno: string, tranne = ''): number {
  const prezzi = prezziDelListino(listino, giorno)
  const sue = voci.filter((v) => /^annuale\s/i.test(v.descrizione.trim()) && stessoPeriodo(v, stagioneDi(giorno).corsi) && !stessa(v.descrizione, tranne))
  if (sue.some((v) => ePiuCorsi(v.descrizione))) return TETTO
  const prezzo = (v: VoceCorso) => prezzi.find((x) => stessa(x.descrizione, scontoDellaVoce(v.descrizione.trim())?.descrizione ?? v.descrizione))?.prezzo ?? 0
  return Math.min(TETTO, sue.reduce((t, v) => t + prezzo(v), 0))
}

/** I prezzi del listino in quel giorno, come voci di ricevuta (senza la quota): quelli che `vociCorsiConAssegnazioni` cerca. */
export const prezziDelListino = (listino: Listino, giorno: string) =>
  vociPronte([], giorno, listino).map((v) => v.voce(giorno)).filter((v) => v.descrizione !== QUOTA)

/** La quota della stagione di quel giorno, col prezzo del listino. */
export const quotaDelListino = (listino: Listino, giorno: string) => ({ prezzo: Math.round(listino.quota * 100), ...stagioneDi(giorno).quota })

/**
 * Le assegnazioni dentro quota e corsi di una persona: quel che legge la scheda (`pagamentoDi`, `statoCorsi`). I prezzi
 * sono quelli del listino nel giorno della prima assegnazione.
 */
export function conAssegnazioni<P extends Pick<PersonaSeg, 'id' | 'quote' | 'vociCorsi'>>(p: P, diretti: PagamentoDiretto[], listino: Listino, oggi: string): P {
  // Le schede lette dal database le hanno già dentro (`persone()`): ogni assegnazione si conta una volta sola.
  const gia = (p as ConAssegnazioniDentro)[DENTRO] ?? []
  const sue = assegnazioniDi(diretti, p.id).filter((d) => !gia.includes(d.id))
  if (!sue.length) return p
  const giorno = sue.map((d) => d.data).sort()[0]
  return {
    ...p,
    quote: quoteConAssegnazioni(p.quote ?? [], quotaDelListino(listino, oggi), sue, p.id),
    vociCorsi: p.vociCorsi
      ? vociCorsiConAssegnazioni(p.vociCorsi, prezziDelListino(listino, giorno), sue, p.id, (voce, vv) => TETTO - giaSugliAnnuali(vv, listino, giorno, voce))
      : p.vociCorsi,
    [DENTRO]: [...gia, ...sue.map((d) => d.id)],
  }
}

/** Le assegnazioni già dentro quota e corsi di una scheda: un simbolo, che passa con le copie (`{ ...p }`) e non esce in JSON. */
const DENTRO = Symbol('assegnazioni dentro')
type ConAssegnazioniDentro = { [DENTRO]?: string[] }

/**
 * Le cose ancora da pagare di una persona, per la ripartizione: la quota (intera, o quel che manca) e i corsi in cui è
 * iscritta (l'annuale del listino, o quel che manca di quello che ha). Alla quota non manca mai più di quel che il
 * tetto del database (`cosaNonVaQuota`) lascia mettere: una ricevuta fatta a un prezzo più alto del listino di adesso
 * direbbe di più, e il dialogo proporrebbe un importo che poi si rifiuta.
 */
export function dovutiDi(p: PersonaSeg, corsi: CorsoRef[], listino: Listino, oggi: string, gia: { diretti: PagamentoDiretto[]; ricevute: Ricevuta[] }, causale = ''): VoceDovuta[] {
  // La causale che dice «trimestrale» propone il trimestre: con l'annuale restava da pagare un parziale che non c'è.
  const daPagare = /trimestr/i.test(causale) ? 'trimestre' : 'annuale'
  const stagione = stagioneDi(oggi)
  const fuori: VoceDovuta[] = []
  const q = pagamentoDi(p, oggi)
  const quota = Math.round(listino.quota * 100)
  const perLaScheda = q.come === 'pagato' ? 0 : q.come === 'in_parte' && q.mancano !== undefined ? q.mancano : quota
  // Senza quota nel listino il database non ha tetto: vale quel che dice la scheda.
  const perIlTetto = quota > 0 ? Math.max(0, quota - giaSullaQuota(p.id, Number(stagione.quota.dal.slice(0, 4)), gia.diretti, gia.ricevute)) : perLaScheda
  const mancaQuota = Math.min(perLaScheda, perIlTetto)
  if (mancaQuota > 0) fuori.push({ personaId: p.id, voce: `${VOCE_QUOTA} ${nomeStagione(stagione.quota.dal)}`, tipo: 'quota', dal: stagione.quota.dal, manca: mancaQuota })
  // Gli annuali da pagare per intero: oltre il tetto di PIÙ CORSI diventano una voce sola.
  const annuali: Array<{ corso: string; prezzo: number; voce: VoceDovuta }> = []
  for (const s of statoCorsi(p, corsi, listino, oggi) ?? []) {
    if (!['in_parte', 'da_pagare', 'scaduto'].includes(s.come)) continue
    const corso = corsi.find((c) => c.id === s.corsoId)
    if (!corso) continue
    const formula = s.come === 'in_parte' ? s.formula : daPagare
    const voci = vociDelCorso(corso, oggi, listino).map((v) => v.voce(oggi))
    const conFormula = (f = 'annuale') => voci.find((v) => v.descrizione.toLowerCase().startsWith(f))
    // Un corso senza prezzo del trimestre resta sull'annuale.
    const voce = conFormula(formula) ?? (s.come === 'in_parte' ? undefined : conFormula())
    if (!voce) continue
    const dal = p.iscrizioni.find((i) => i.corsoId === s.corsoId)?.dal ?? stagione.corsi.dal
    if (s.come !== 'in_parte') {
      const dovuta: VoceDovuta = { personaId: p.id, voce: voce.descrizione, tipo: 'corso', dal, manca: voce.prezzo }
      if (/^annuale\s/i.test(voce.descrizione)) annuali.push({ corso: corso.nome, prezzo: voce.prezzo, voce: dovuta })
      else if (voce.prezzo > 0) fuori.push(dovuta)
      continue
    }
    // Una voce «più corsi» pagata in parte è di tutti i suoi corsi: si chiede una volta sola.
    const sua = s.formula === 'annuale' && conAnnuale(listino, corso) ? p.vociCorsi?.find((v) => v.mancano === s.mancano && ePiuCorsi(v.descrizione)) : undefined
    const descrizione = sua?.descrizione ?? voce.descrizione
    const gia = fuori.find((d) => d.personaId === p.id && stessa(d.voce, descrizione))
    if (gia) gia.corsi?.push(corso.nome)
    else if ((s.mancano ?? 0) > 0) fuori.push({ personaId: p.id, voce: descrizione, tipo: 'corso', dal, manca: s.mancano ?? 0, ...(sua ? { corsi: [corso.nome] } : {}) })
  }
  const messo = giaSugliAnnuali(p.vociCorsi ?? [], listino, oggi)
  const tutti = annuali.reduce((t, a) => t + a.prezzo, 0)
  if (messo + tutti > TETTO && (annuali.length > 1 || messo > 0)) {
    const manca = TETTO - messo
    const dal = annuali.map((a) => a.voce.dal).sort()[0]
    if (manca > 0) fuori.push({ personaId: p.id, voce: VOCE_PIU_CORSI, tipo: 'corso', dal, manca, corsi: annuali.map((a) => a.corso) })
  } else fuori.push(...annuali.filter((a) => a.prezzo > 0).map((a) => a.voce))
  return fuori
}

/**
 * «Aggiungi una voce dal listino» della finestra: le voci dei corsi del listino di oggi, per corso, prima quelli a cui
 * la persona è iscritta, poi gli altri per nome. Servono quando il bonifico paga una cosa che `dovutiDi` non vede: un
 * corso senza iscrizione nell'app, il trimestre al posto dell'annuale, o l'abbigliamento (in fondo, con `importo`). Fuori le voci che sono già righe della persona
 * (`gia`, i nomi): due righe con lo stesso nome sarebbero un campo solo.
 */
export function vociDaAggiungere(
  p: Pick<PersonaSeg, 'id' | 'iscrizioni'>, corsi: CorsoRef[], listino: Listino, oggi: string, gia: string[], importo = 0,
): Array<{ corso: string; suo: boolean; voci: Array<{ etichetta: string; dovuta: VoceDovuta }> }> {
  const suoi = corsi.filter((c) => p.iscrizioni.some((i) => i.corsoId === c.id && i.dal <= oggi && (!i.al || i.al >= oggi)))
  const giaQui = new Set(gia.map((v) => v.trim().toLowerCase()))
  const gruppi = new Map<string, { corso: string; suo: boolean; voci: Array<{ etichetta: string; dovuta: VoceDovuta }> }>()
  for (const vc of listino.corsi) {
    const suo = suoi.some((c) => voceDelCorso(listino.corsi, c) === vc)
    for (const x of vociDelCorso(vc.corso, oggi, listino)) {
      const v = x.voce(oggi)
      if (giaQui.has(v.descrizione.trim().toLowerCase())) continue
      // L'etichetta del listino è «Fitness 2 giorni · trimestre · 130,00 €»: un gruppo per riga di prezzo, e nel
      // gruppo basta la formula. Più righe di un corso in un gruppo solo davano voci uguali.
      const [nome, formula] = x.etichetta.split(' · ')
      const g = gruppi.get(nome) ?? { corso: nome, suo, voci: [] }
      g.voci.push({
        etichetta: `${formula.charAt(0).toUpperCase()}${formula.slice(1)} · ${euroAssegna(v.prezzo)}`,
        dovuta: { personaId: p.id, voce: v.descrizione, tipo: 'corso', dal: v.dal ?? oggi, manca: v.prezzo, aggiunta: { corso: nome, suo } },
      })
      gruppi.set(nome, g)
    }
  }
  const fuori = [...gruppi.values()].sort((a, b) => Number(b.suo) - Number(a.suo) || a.corso.localeCompare(b.corso, 'it'))
  // In fondo l'abbigliamento: non ha un prezzo nel listino, il tetto è il bonifico (`importo`).
  if (importo > 0 && !giaQui.has(VOCE_ABBIGLIAMENTO.toLowerCase())) {
    const aggiunta = { corso: VOCE_ABBIGLIAMENTO, suo: true }
    fuori.push({ ...aggiunta, voci: [{ etichetta: 'Prezzo a mano', dovuta: { personaId: p.id, voce: VOCE_ABBIGLIAMENTO, tipo: 'abbigliamento', dal: oggi, manca: importo, aggiunta } }] })
  }
  return fuori
}

export const VOCE_ABBIGLIAMENTO = 'Abbigliamento'

/** L'importo di una voce appena aggiunta: quel che resta del bonifico (`importo` meno `messo`), non oltre il prezzo. */
export const importoProposto = (prezzo: number, importo: number, messo: number) => Math.max(0, Math.min(prezzo, importo - messo))

/**
 * Segnata pagata a mano nella scheda, senza un pagamento nell'app: per `dovutiDi` non ha niente da pagare, e il
 * bonifico che è quel pagamento resterebbe da assegnare per sempre.
 */
export const pagatoAMano = (p: PersonaSeg, oggi: string) => {
  const q = pagamentoDi(p, oggi)
  return q.come === 'pagato' && q.fonte === 'fuori_app'
}

/** La persona come se la scheda non fosse segnata a mano: le cose da pagare di «È questo bonifico». La scheda non cambia. */
export const senzaSegnoAMano = (p: PersonaSeg): PersonaSeg => ({ ...p, pagamento: { ...p.pagamento, stato: 'da_pagare' } })

/** Le cose da pagare del nucleo; per chi ha detto «È questo bonifico» come se la scheda non fosse segnata a mano. */
export const dovutiDelNucleo = (chi: PersonaSeg[], eQuesto: string[], corsi: CorsoRef[], listino: Listino, oggi: string, gia: { diretti: PagamentoDiretto[]; ricevute: Ricevuta[] }, causale = '') =>
  chi.flatMap((p) => dovutiDi(conAssegnazioni(eQuesto.includes(p.id) ? senzaSegnoAMano(p) : p, gia.diretti, listino, oggi), corsi, listino, oggi, gia, causale))

/** A chi del nucleo chiedere «Già pagato a mano»: segnato a mano, niente da pagare, non ha ancora risposto. Con la data del segno. */
export const daChiedereAMano = (chi: PersonaSeg[], risposto: string[], dovuti: VoceDovuta[], diretti: PagamentoDiretto[], listino: Listino, oggi: string) =>
  chi.flatMap((p) => {
    if (risposto.includes(p.id) || dovuti.some((v) => v.personaId === p.id)) return []
    const conDiretti = conAssegnazioni(p, diretti, listino, oggi)
    return pagatoAMano(conDiretti, oggi) ? [{ persona: p, fino: pagamentoDi(conDiretti, oggi).fino ?? '' }] : []
  })

/** La stagione di una quota assegnata: quella detta nel nome della voce («2026/27»), se no quella del giorno. */
const stagioneQuota = (voce: string, giorno: string) => {
  const detta = voce.match(/(\d{4})\/\d{2}/)?.[1]
  return stagioneDi(detta ? `${detta}-09-01` : giorno).quota
}

/** L'anno in cui comincia la stagione di una quota, come `stagione_quota` del database (136). */
const annoQuota = (voce: string, giorno: string) => Number(stagioneQuota(voce, giorno).dal.slice(0, 4))

/**
 * Le voci della ricevuta fatta dal bonifico, per una persona: una per voce assegnata, pagata col bonifico alla sua
 * data. Il prezzo è quello del listino, così un parziale resta un parziale anche nella ricevuta; una voce che il
 * listino non ha costa quel che è assegnato.
 */
export function vociDaMovimento(sue: PagamentoDiretto[], dataMovimento: string, listino: Listino, giaFatte: VoceCorso[] = [], altre: PagamentoDiretto[] = []): VoceRicevuta[] {
  const prezzi = prezziDelListino(listino, dataMovimento)
  // Gli annuali delle altre assegnazioni della persona, non ancora in ricevuta, contano come quelli in ricevuta.
  const ids = new Set(sue.map((d) => d.id))
  const fatte = sue[0] ? vociCorsiConAssegnazioni(giaFatte, prezzi, altre.filter((d) => !ids.has(d.id)), sue[0].personaId) : giaFatte
  const gruppi = new Map<string, { voce: string; importo: number }>()
  for (const d of sue.filter((x) => !x.annullatoIl)) {
    const k = d.voce.trim().toLowerCase()
    const g = gruppi.get(k) ?? { voce: d.voce.trim(), importo: 0 }
    g.importo += d.importo
    gruppi.set(k, g)
  }
  return [...gruppi.values()].map(({ voce, importo }) => {
    const pagamenti = [{ data: dataMovimento, importo, metodo: 'Bonifico' }]
    if (eQuota(voce)) return { descrizione: QUOTA, quantita: 1, prezzo: Math.max(importo, Math.round(listino.quota * 100)), ...stagioneQuota(voce, dataMovimento), pagamenti }
    // La «più corsi» non è nel listino: costa quel che le manca se è già in ricevuta in parte, se no il tetto meno gli
    // annuali già messi, in ricevuta o assegnati, per la stagione.
    if (ePiuCorsi(voce)) {
      const stagione = stagioneDi(dataMovimento).corsi
      const manca = fatte.filter((v) => ePiuCorsi(v.descrizione) && stessoPeriodo(v, stagione)).map((v) => v.mancano)
      const prezzo = manca.length ? Math.min(...manca) : TETTO - giaSugliAnnuali(fatte, listino, dataMovimento, voce)
      return { descrizione: voce, quantita: 1, prezzo: Math.max(importo, prezzo), ...stagione, pagamenti }
    }
    const p = prezzi.find((x) => stessa(x.descrizione, voce))
    return { descrizione: voce, quantita: 1, prezzo: Math.max(importo, p?.prezzo ?? importo), dal: p?.dal, al: p?.al, pagamenti }
  })
}

/**
 * Lo stesso rifiuto di `emetti_ricevuta_da_movimento` (135): nella ricevuta il bonifico entra così com'è, tutto
 * Bonifico, alla data del movimento, per quel che è assegnato alla persona. Un pagamento senza data è del giorno della
 * ricevuta, come in `emetti_ricevuta`.
 */
export function cosaNonVaRicevutaDaMovimento(voci: VoceRicevuta[], giorno: string, dataMovimento: string, sue: Array<{ importo: number }>): string | null {
  const pagamenti = voci.flatMap((v) => v.pagamenti).filter((p) => p.importo > 0)
  const somma = (xs: Array<{ importo: number }>) => xs.reduce((t, x) => t + x.importo, 0)
  return pagamenti.some((p) => !stessa(p.metodo, 'Bonifico') || (p.data || giorno) !== dataMovimento) || somma(pagamenti) !== somma(sue)
    ? 'Il bonifico va nella ricevuta così com’è: rimettilo, o torna ad «Assegna» per cambiare gli importi.'
    : null
}

/**
 * I bonifici di una persona (le righe «SCRITTI IN CONTABILITÀ» della scheda) che hanno ancora soldi da assegnare, dal
 * più vecchio: le stesse regole di `cosaNonVaMovimentoDaAssegnare`, con voce e cassa per nome e `aMano` falso per lo
 * storico del vecchio programma.
 */
export function bonificiDaAssegnare(storico: VoceStorico[], diretti: PagamentoDiretto[], ricevute: Ricevuta[], oggi: string) {
  const inizio = stagioneDi(oggi).dal
  return storico
    .filter((v) => (v.voce === VOCE_QUOTA || v.voce === VOCE_CORSI) && v.cassa !== NOME_CASSA_CONTANTI && (v.aMano || v.data >= inizio))
    .map((v) => ({ movimentoId: v.id, data: v.data, importo: v.importo, daAssegnare: daAssegnare(v, diretti, ricevute) }))
    .filter((x) => x.daAssegnare > 0)
    .sort((a, b) => a.data.localeCompare(b.data) || a.movimentoId.localeCompare(b.movimentoId))
}

/** Quel che serve per dire quali bonifici si assegnano da soli: i dati di CONTABILITÀ e le schede con corsi e listino. */
export interface ContestoDaSoli {
  manuali: MovimentoManuale[]
  diretti: PagamentoDiretto[]
  ricevute: Ricevuta[]
  casse: Cassa[]
  voci: VoceContabile[]
  persone: PersonaSeg[]
  corsi: CorsoRef[]
  listino: Listino
  oggi: string
}

/** Un bonifico che si assegna da solo, con le sue righe. */
export interface ProntoDaSolo {
  movimentoId: string
  personaId: string
  data: string
  importo: number
  descrizione: string
  righe: RigaAssegnata[]
}

/** Un pagamento già fatto da una persona, per la finestra «Chi ha pagato e per cosa?». */
export interface PagamentoFatto {
  data: string
  voce: string
  importo: number
  ricevuta?: { anno: number; numero: number }
}

/** I pagamenti di una persona, dal più recente: le righe a mano attive e le voci delle ricevute non annullate. */
export function pagamentiFatti(personaId: string, diretti: PagamentoDiretto[], ricevute: Ricevuta[]): PagamentoFatto[] {
  const aMano = diretti.filter((x) => x.personaId === personaId && !x.annullatoIl).map((x) => ({ data: x.data, voce: x.voce, importo: x.importo }))
  const inRicevuta = ricevute
    .filter((r) => r.personaId === personaId && !r.annullataIl)
    .flatMap((r) => r.voci.flatMap((v) => v.pagamenti.map((x) => ({ data: x.data || r.data, voce: v.descrizione, importo: x.importo, ricevuta: { anno: r.anno, numero: r.numero } }))))
  return [...aMano, ...inRicevuta].sort((a, b) => b.data.localeCompare(a.data))
}

/** La tipologia del movimento la dice quel che paga: solo la quota → «Quota associativa»; con un corso → «Corsi e altri pagamenti». */
export const tipologiaDaRighe = (righe: RigaAssegnata[]): string | null =>
  !righe.length ? null : righe.every((r) => eQuota(r.voce)) ? VOCE_QUOTA : VOCE_CORSI

/**
 * Chi ha pagato e per cosa: la situazione del nucleo di chi ha pagato (cosa deve, i pagamenti fatti) e la divisione
 * proposta del bonifico. È la stessa logica per la finestra (import, MOVIMENTI, il movimento) e per i bonifici che si
 * assegnano da soli: `sicura` quando c'è un solo modo di dividere (`ripartizioneSicura`) e nessuno da chiedere; se no
 * la proposta è quella di sempre (prima la quota, poi i corsi), da correggere a mano. `eQuesto`: chi ha detto «È questo
 * bonifico» a «Già pagato a mano».
 */
export function chiEPerCosa(
  personaId: string,
  importo: number,
  c: Pick<ContestoDaSoli, 'diretti' | 'ricevute' | 'persone' | 'corsi' | 'listino' | 'oggi'>,
  eQuesto: string[] = [],
  causale = '',
) {
  const chi = personeDelNucleo(personaId, c.persone).flatMap((id) => c.persone.filter((p) => p.id === id))
  const dovuti = dovutiDelNucleo(chi, eQuesto, c.corsi, c.listino, c.oggi, { diretti: c.diretti, ricevute: c.ricevute }, causale)
  const daChiedere = daChiedereAMano(chi, eQuesto, dovuti, c.diretti, c.listino, c.oggi).map((x) => x.persona.id)
  const r = ripartizioneSicura(importo, dovuti)
  // Un corso pagato lasciando fuori la quota della stessa persona non è sicuro: la quota viene prima (la «più corsi» da
  // 660 € è proprio un bonifico da 660 €, ma la quota resta a parte).
  const saltaQuota = 'righe' in r && r.righe.some((x) => !eQuota(x.voce) && dovuti.some((d) => d.personaId === x.personaId && d.tipo === 'quota' && !r.righe.some((y) => y.personaId === d.personaId && stessa(y.voce, d.voce))))
  const sicura = 'righe' in r && !saltaQuota && !daChiedere.length && cosaNonVaAssegnazione(r.righe, importo, dovuti) === null
  const proposta = 'righe' in r && sicura ? r.righe : eQuesto.length ? propostaDopoIlSi(importo, dovuti, eQuesto[eQuesto.length - 1]).righe : proponiRipartizione(importo, dovuti).righe
  return {
    nucleo: chi.map((p) => ({ persona: p, dovuti: dovuti.filter((v) => v.personaId === p.id), pagamenti: pagamentiFatti(p.id, c.diretti, c.ricevute) })),
    dovuti,
    daChiedere,
    proposta,
    sicura,
    motivo: 'motivo' in r ? r : null,
  }
}

/**
 * I bonifici collegati che si assegnano da soli (fra `ids`, se detti: quelli appena collegati), e per gli altri il
 * perché in parole della segreteria. Solo le entrate che `cosaNonVaMovimentoDaAssegnare` lascia passare e ancora
 * intere: uno già assegnato in parte si finisce a mano, e uno con la ricevuta già fatta va abbinato (COLLEGATI PRIMA),
 * se no i soldi si contano due volte. Poi la stessa logica della finestra (`chiEPerCosa`): sicura, e si assegna senza
 * ricevuta; quella resta a mano.
 */
export function daSoli(c: ContestoDaSoli, ids?: string[]): { pronti: ProntoDaSolo[]; perche: Record<string, string> } {
  const voluti = ids ? new Set(ids) : null
  const conRicevuta = new Set(collegatiPrima(c.manuali, c.diretti, c.ricevute, c.casse, c.voci, c.oggi, c.persone).map((x) => x.movimentoId))
  const pronti: ProntoDaSolo[] = []
  const perche: Record<string, string> = {}
  const inizio = stagioneDi(c.oggi).dal
  // Le righe dei bonifici già scelti nel giro contano per quelli dopo: due bonifici uguali non pagano due volte lo stesso corso.
  const diretti = [...c.diretti]
  for (const m of [...c.manuali].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))) {
    if (voluti && !voluti.has(m.id)) continue
    if (!m.personaId || cosaNonVaMovimentoDaAssegnare(m, c.casse, c.voci, c.oggi) !== null || daAssegnare(m, c.diretti, c.ricevute) !== m.importo) continue
    // Di una stagione passata, da qualunque parte venga: andrebbe sulle cose da pagare di adesso.
    if (m.data < inizio) continue
    if (conRicevuta.has(m.id)) {
      perche[m.id] = 'C’è già la ricevuta: abbinala qui sopra.'
      continue
    }
    const x = chiEPerCosa(m.personaId, m.importo, { ...c, diretti }, [], m.descrizione)
    if (x.daChiedere.length) {
      perche[m.id] = 'È segnato pagato a mano: di’ tu se è questo bonifico.'
      continue
    }
    if (x.sicura) {
      pronti.push({ movimentoId: m.id, personaId: m.personaId, data: m.data, importo: m.importo, descrizione: m.descrizione, righe: x.proposta })
      diretti.push(...x.proposta.map((y, i) => ({ id: `${m.id}-${i}`, personaId: y.personaId, data: m.data, importo: y.importo, metodo: 'Bonifico', voce: y.voce, movimentoId: m.id, creatoIl: m.data })))
      continue
    }
    perche[m.id] = x.motivo ? fraseNonDaSolo(x.motivo.motivo, m.importo, x.motivo.dovuto) : 'Decidi tu a cosa va.'
  }
  return { pronti, perche }
}

const fraseNonDaSolo = (motivo: 'niente' | 'piu modi' | 'in parte' | 'di piu', importo: number, dovuto: number): string =>
  motivo === 'niente' ? 'Nel nucleo non c’è niente da pagare: decidi tu a cosa va.'
    : motivo === 'piu modi' ? `Ci sono più modi di dividere ${euroAssegna(importo)}: scegli tu.`
      : motivo === 'in parte' ? `Pagato in parte: ${euroAssegna(importo)} di ${euroAssegna(dovuto)}. Decidi tu su cosa.`
        : `È più di quel che deve (${euroAssegna(dovuto)}): decidi tu dove va il resto.`

/**
 * Scrive i bonifici che si assegnano da soli, uno per volta, ognuno con una chiave sua (136). Un giro rifatto dopo
 * una rete caduta non scrive due volte perché `daSoli` rilegge e salta i bonifici già assegnati, non per la chiave,
 * che è nuova a ogni giro. Le chiavi sono il lotto, per «Togli questo lotto»: uno scritto ma con la risposta persa
 * non c'è, e si annulla dal movimento. Non lancia mai: un guaio ferma il giro e lo dice, e quelli già scritti restano.
 */
export async function assegnaDaSoli(
  d: Pick<DatiSegreteria, 'assegnaMovimento'>,
  pronti: Array<Pick<ProntoDaSolo, 'movimentoId' | 'righe'>>,
  suProgresso?: (fatti: number) => void,
): Promise<{ chiavi: string[]; errore?: string }> {
  const chiavi: string[] = []
  for (const p of pronti) {
    const chiave = crypto.randomUUID()
    try {
      await d.assegnaMovimento(p.movimentoId, p.righe, chiave)
    } catch (e) {
      return { chiavi, errore: e instanceof Error && e.message ? e.message : 'Non si è assegnato: riprova.' }
    }
    chiavi.push(chiave)
    suProgresso?.(chiavi.length)
  }
  return { chiavi }
}

/**
 * «Togli questo lotto»: annulla le assegnazioni scritte con quelle chiavi che sono ancora attive. Una diventata ricevuta
 * è già annullata e resta della ricevuta: si toglie annullando la ricevuta.
 */
export async function togliLottoAssegnazioni(d: Pick<DatiSegreteria, 'pagamentiDiretti' | 'annullaPagamentoDiretto'>, chiavi: string[]): Promise<{ tolti: number }> {
  const lotto = new Set(chiavi)
  const attive = (await d.pagamentiDiretti()).filter((x) => !!x.chiave && lotto.has(x.chiave) && !x.annullatoIl)
  for (const x of attive) await d.annullaPagamentoDiretto(x.id)
  return { tolti: attive.length }
}

/**
 * Dopo un collegamento (import della banca, «Collega i casi sicuri», a mano): legge i dati freschi e assegna da sé quei
 * movimenti, se è sicuro. Non lancia: chi chiama ha già collegato, e un'assegnazione mancata resta in «Da assegnare».
 */
export async function assegnaDopoIlCollegamento(
  d: Pick<DatiSegreteria, 'assegnaMovimento' | 'movimenti' | 'pagamentiDiretti' | 'ricevute' | 'casse' | 'voci' | 'persone' | 'corsi' | 'listino'>,
  ids: string[],
  oggi: string,
): Promise<{ chiavi: string[]; restano: number; errore?: string }> {
  if (!ids.length) return { chiavi: [], restano: 0 }
  try {
    const [manuali, diretti, ricevute, casse, voci, persone, corsi, letto] = await Promise.all([
      d.movimenti(), d.pagamentiDiretti(), d.ricevute(), d.casse(), d.voci(), d.persone(), d.corsi(), d.listino(),
    ])
    const { pronti } = daSoli({ manuali, diretti, ricevute, casse, voci, persone, corsi, listino: listinoUsabile(letto.listino, corsi), oggi }, ids)
    const x = await assegnaDaSoli(d, pronti)
    return { ...x, restano: ids.length - x.chiavi.length }
  } catch (e) {
    return { chiavi: [], restano: ids.length, errore: e instanceof Error && e.message ? e.message : 'Non si è assegnato: riprova.' }
  }
}

/**
 * Scrive quel che la finestra «Chi ha pagato e per cosa?» ha deciso per un movimento già in CONTABILITÀ: la tipologia
 * (da quel che paga, `tipologiaDaRighe`; senza righe resta quella che c'è, e un Da classificare va su «Corsi e altri
 * pagamenti») e la persona, poi le righe, con una chiave (136). La tipologia cambia insieme alla persona; se cambia
 * solo la persona, la collega e basta.
 */
export async function scriviChiEPerCosa(
  d: Pick<DatiSegreteria, 'cambiaVoceMovimenti' | 'collegaMovimentiPersona' | 'assegnaMovimento'>,
  m: { id: string; voceId?: string; personaId?: string },
  scelta: { personaId: string; righe: RigaAssegnata[]; chiave?: string },
  voci: VoceContabile[],
): Promise<void> {
  const daClassificare = voci.find((v) => v.id === m.voceId)?.nome === VOCE_DA_CLASSIFICARE
  const tipologia = tipologiaDaRighe(scelta.righe) ?? (daClassificare || !m.voceId ? VOCE_CORSI : null)
  const voceId = tipologia ? voci.find((v) => v.nome === tipologia)?.id : m.voceId
  if (voceId && voceId !== m.voceId) await d.cambiaVoceMovimenti([m.id], voceId, scelta.personaId)
  else if (scelta.personaId !== m.personaId) await d.collegaMovimentiPersona([m.id], scelta.personaId)
  // La chiave è dell'apertura della finestra: riprovato dopo una rete caduta, il database non assegna due volte (136).
  if (scelta.righe.length) await d.assegnaMovimento(m.id, scelta.righe, scelta.chiave ?? crypto.randomUUID())
}

/**
 * Quali entrate di MOVIMENTI aprono «Chi ha pagato e per cosa?» dalla riga: le Da classificare del conto (non il
 * versamento di Satispay, che non è di una persona) e quelle su quota e corsi ancora intere, con o senza persona.
 * Una già assegnata in parte si finisce dal movimento; i contanti si registrano in PAGAMENTI.
 */
export function apreChiEPerCosa(
  m: Pick<MovimentoManuale, 'id' | 'tipo' | 'importo' | 'data' | 'voceId' | 'cassaId' | 'annullatoIl' | 'origineImport' | 'descrizione'>,
  casse: Cassa[], voci: VoceContabile[], diretti: PagamentoDiretto[], ricevute: Ricevuta[], oggi: string,
): boolean {
  if (m.annullatoIl || m.tipo !== 'entrata' || casse.find((c) => c.id === m.cassaId)?.nome === NOME_CASSA_CONTANTI) return false
  const voce = voci.find((v) => v.id === m.voceId)?.nome
  if (voce === VOCE_DA_CLASSIFICARE) return !/satispay\s+europe/i.test(m.descrizione)
  if (voce !== VOCE_QUOTA && voce !== VOCE_CORSI) return false
  if (m.origineImport?.startsWith('prima-nota:') && m.data < stagioneDi(oggi).dal) return false
  return daAssegnare(m, diretti, ricevute) === m.importo
}

/**
 * La ricevuta già fatta che può essere questo movimento, per la persona scelta nella finestra: le regole di «C'è già
 * la ricevuta» (`ricevutaGiaFatta`), come se il movimento fosse già suo e, se Da classificare, su «Corsi e altri pagamenti».
 */
export function ricevutaPerChi(
  m: MovimentoManuale, personaId: string,
  c: Pick<ContestoDaSoli, 'manuali' | 'diretti' | 'ricevute' | 'casse' | 'voci' | 'persone' | 'oggi'>,
): Ricevuta | undefined {
  const corsi = c.voci.find((v) => v.nome === VOCE_CORSI)?.id
  const daClassificare = c.voci.find((v) => v.id === m.voceId)?.nome === VOCE_DA_CLASSIFICARE
  const comeSuo = c.manuali.map((x) => (x.id === m.id ? { ...x, personaId, voceId: daClassificare || !x.voceId ? corsi : x.voceId } : x))
  const id = ricevutaGiaFatta(m.id, comeSuo, c.diretti, c.ricevute, c.casse, c.voci, c.oggi, c.persone)
  return c.ricevute.find((r) => r.id === id)
}

/** Gli importi scritti nella finestra, per voce (`personaId` e voce uniti da \u0000): le righe e cosa non va, in parole. */
export function righeDaCampi(dovuti: VoceDovuta[], valori: Record<string, string>, importo: number): { righe: RigaAssegnata[]; guaio: string | null } {
  const letti = dovuti.map((v) => {
    const t = valori[`${v.personaId}\u0000${v.voce}`] ?? ''
    return { v, cent: t.trim() ? centesimi(t) : 0 }
  })
  const nonSiCapisce = letti.find((x) => x.cent === null)
  const righe = letti.filter((x) => (x.cent ?? 0) > 0).map((x) => ({ personaId: x.v.personaId, voce: x.v.voce, importo: x.cent ?? 0 }))
  if (nonSiCapisce) return { righe, guaio: `L’importo di «${nonSiCapisce.v.voce}» non si capisce.` }
  return { righe, guaio: righe.length ? cosaNonVaAssegnazione(righe, importo, dovuti) : null }
}

/**
 * «Sì, è questa» nella finestra: il bonifico prende la ricevuta già fatta. Un Da classificare si abbina e basta
 * (`abbina_ricevuta_movimento` gli dà persona e voce della ricevuta, 151); uno già su quota o corsi prima prende la
 * persona scelta, se è un'altra.
 */
export async function abbinaDaFinestra(
  d: Pick<DatiSegreteria, 'collegaMovimentiPersona' | 'abbinaRicevutaMovimento'>,
  m: { id: string; voceId?: string; personaId?: string }, personaId: string, ricevutaId: string, voci: VoceContabile[],
): Promise<void> {
  const daClassificare = !m.voceId || voci.find((v) => v.id === m.voceId)?.nome === VOCE_DA_CLASSIFICARE
  if (!daClassificare && m.personaId !== personaId) await d.collegaMovimentiPersona([m.id], personaId)
  await d.abbinaRicevutaMovimento(m.id, ricevutaId)
}
