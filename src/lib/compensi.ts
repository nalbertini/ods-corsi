/**
 * Il compenso del mese di un tecnico e la sua ricevuta: l'autocertificazione
 * per i compensi sportivi e la liquidazione (`80-ricevute-compensi.sql`).
 *
 * Il compenso è, corso per corso, le ore confermate (`delMese` di `ore.ts`)
 * per la tariffa di quel tecnico in quel corso (`tariffe.ts`), anche da
 * sostituto. Il netto è uguale al lordo: nessuno supera le soglie, e INPS,
 * IRPEF e addizionali escono a 0,00. Il compenso si può cambiare a mano,
 * scrivendo il perché: la ricevuta esce con quello.
 *
 * Come la lettera, la ricevuta copia dentro le righe del conto, i dati del
 * tecnico e la qualifica: ristampata dice sempre la stessa cosa. Il testo è
 * quello della bozza della palestra, senza la riga del progetto «spazi
 * civici» che non c'è più.
 *
 * Gli importi sono in centesimi.
 */
import { delMese, type MiaPresenza } from './ore'
import { euro } from './ricevute'
import { QUALIFICHE, stagioneDi, type Lettera, type TecnicoLettera } from './lettere'
import type { LezioneSenzaIstruttore, PresenzaIstruttoreSeg, Tariffa } from './segreteria'
import { giornoChiuso, type Cassa, type ChiusuraCassa } from './contabilita'

export interface RigaCompenso {
  corso: string
  lezioni: number
  minuti: number
  /** Senza: il corso non ha una tariffa, e non entra nella ricevuta. */
  centesimiOra?: number
  importo?: number
}

export interface ContoCompenso {
  righe: RigaCompenso[]
  lezioni: number
  minuti: number
  /** La somma dei corsi con la tariffa. */
  calcolato: number
  daConfermare: number
  senzaTariffa: string[]
}

export type TecnicoCompenso = TecnicoLettera & { iban?: string }

export interface DatiRicevutaCompenso {
  personaId: string
  /** `AAAA-MM-01`. */
  mese: string
  righe: RigaCompenso[]
  calcolato: number
  importo: number
  /** Perché l'importo è diverso dal calcolato; `null` se è uguale. */
  motivo: string | null
  tecnico: TecnicoCompenso
  /** La qualifica della lettera valida di quella stagione; senza lettera, la mansione si barra a mano. */
  qualifica: string | null
  /** Il giorno della stampa, `AAAA-MM-GG`. */
  data: string
}

export interface RicevutaCompenso extends DatiRicevutaCompenso {
  id: string
  firmata: boolean
  annullataIl: string | null
  creataIl: string
  /** Il movimento in CONTABILITÀ che l'ha pagata (`81-compensi-pagati.sql`); `null` = da pagare. */
  movimentoId: string | null
  /** Il giorno del pagamento, `AAAA-MM-GG`. */
  pagataIl: string | null
}

export type StatoCompenso = 'da-confermare' | 'senza-tariffa' | 'senza-dati' | 'da-fare' | 'fatta' | 'non-torna' | 'pagata' | 'solo-attese'

/** Il primo del mese di una data, `AAAA-MM-01`, nel giorno di qui. */
export const primoDelMese = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`

/** Il conto del mese di un tecnico: per ogni corso, le ore confermate per la sua tariffa. */
export function compensoDelMese<P extends MiaPresenza>(presenze: P[], senzaIstruttore: LezioneSenzaIstruttore[], personaId: string, mese: { da: Date; a: Date }, tariffe: Tariffa[]): ContoCompenso {
  const x = delMese(presenze, senzaIstruttore, personaId, mese)
  const righe: RigaCompenso[] = x.perCorso.map((r) => {
    const t = tariffe.find((t) => t.corso === r.corso)
    const base = { corso: r.corso, lezioni: r.lezioni, minuti: r.minuti }
    return t ? { ...base, centesimiOra: t.centesimi, importo: Math.round((r.minuti / 60) * t.centesimi) } : base
  })
  return {
    righe,
    lezioni: x.confermate.length,
    minuti: x.minuti,
    calcolato: righe.reduce((s, r) => s + (r.importo ?? 0), 0),
    daConfermare: x.daConfermare,
    senzaTariffa: righe.filter((r) => r.importo === undefined).map((r) => r.corso),
  }
}

/**
 * A che punto è il mese di un tecnico. Con la ricevuta conta se il conto di
 * adesso torna con quello di quando è stata fatta (il calcolato, non
 * l'importo, che può essere cambiato a mano): una presenza decisa dopo si vede.
 */
export function statoCompenso({ conto, ricevuta, manca }: { conto: ContoCompenso; ricevuta?: Pick<RicevutaCompenso, 'calcolato' | 'annullataIl' | 'pagataIl'> | null; manca?: string | null }): StatoCompenso {
  // Pagata è pagata, anche se dopo è cambiata una presenza: i soldi sono usciti.
  if (ricevuta && !ricevuta.annullataIl && ricevuta.pagataIl) return 'pagata'
  if (ricevuta && !ricevuta.annullataIl) return ricevuta.calcolato === conto.calcolato ? 'fatta' : 'non-torna'
  if (conto.daConfermare > 0) return 'da-confermare'
  if (conto.senzaTariffa.length) return 'senza-tariffa'
  // Senza codice fiscale, residenza o IBAN la ricevuta non si fa: si vede prima di provarci.
  if (manca) return 'senza-dati'
  return 'da-fare'
}

/** Una lezione tenuta in due dove a un previsto manca la firma. */
export type SenzaFirma = { sessioneId: string; corso: string; inizio: string; firmatoDa: string[] }
type PresenzaPerFirma = Pick<PresenzaIstruttoreSeg, 'sessioneId' | 'corso' | 'inizio' | 'fine' | 'personaId' | 'nome' | 'stato' | 'previstiElenco' | 'annullata' | 'bastaUno'>

/**
 * Le lezioni del mese, già finite e non annullate, dove `personaId` era
 * previsto, non ha nessuna presenza (né rifiutata né da confermare: quelle si
 * decidono già) e un collega sì, non rifiutata. Una lezione senza nessuna firma
 * non c'è: sta fra quelle senza istruttore. Nei corsi dove basta uno non si
 * chiede.
 */
export function senzaFirma(presenze: PresenzaPerFirma[], personaId: string, mese: { da: Date; a: Date }, adesso = new Date()): SenzaFirma[] {
  const fine = new Date(mese.a.getFullYear(), mese.a.getMonth(), mese.a.getDate() + 1).getTime()
  const perLezione = new Map<string, PresenzaPerFirma[]>()
  for (const p of presenze) perLezione.set(p.sessioneId, [...(perLezione.get(p.sessioneId) ?? []), p])
  return [...perLezione.values()]
    .flatMap((l): SenzaFirma[] => {
      const x = l[0]
      const inizio = new Date(x.inizio).getTime()
      if (inizio < mese.da.getTime() || inizio >= fine || new Date(x.fine) > adesso) return []
      if (l.some((p) => p.annullata || p.bastaUno) || l.some((p) => p.personaId === personaId)) return []
      if (!l.some((p) => p.previstiElenco?.some((q) => q.id === personaId))) return []
      const firmatoDa = l.filter((p) => p.stato !== 'rifiutata').map((p) => p.nome)
      return firmatoDa.length ? [{ sessioneId: x.sessioneId, corso: x.corso, inizio: x.inizio, firmatoDa }] : []
    })
    .sort((a, b) => a.inizio.localeCompare(b.inizio))
}

/**
 * Le righe della pagina COMPENSI per un mese: un tecnico per riga, per
 * cognome. Chi non ha lezioni, né da confermare, né una ricevuta, né una
 * lezione senza la sua firma di quel mese non c'è.
 */
export function righeCompensi<P extends MiaPresenza & PresenzaPerFirma>({
  tecnici,
  presenze,
  senzaIstruttore,
  mese,
  tariffe,
  ricevute,
  mancano,
}: {
  tecnici: Array<{ id: string; nome: string; cognome: string }>
  presenze: P[]
  senzaIstruttore: LezioneSenzaIstruttore[]
  mese: { da: Date; a: Date }
  tariffe: Record<string, Tariffa[]>
  ricevute: RicevutaCompenso[]
  /** Cosa manca nella scheda di ognuno per fare la ricevuta (`mancaPerRicevuta`); senza, non si guarda. */
  mancano?: Record<string, string | null>
}) {
  const chiave = primoDelMese(mese.da)
  return [...tecnici]
    .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'))
    .map((persona) => {
      const conto = compensoDelMese(presenze, senzaIstruttore, persona.id, mese, tariffe[persona.id] ?? [])
      const ricevuta = ricevute.find((r) => r.personaId === persona.id && r.mese === chiave && !r.annullataIl)
      const manca = mancano?.[persona.id] ?? null
      const firme = senzaFirma(presenze, persona.id, mese)
      // Chi ha solo lezioni senza la sua firma non ha niente da pagare finché la segreteria non dice C'ERA.
      const solo = !ricevuta && !conto.lezioni && !conto.daConfermare
      const stato: StatoCompenso = solo ? 'solo-attese' : statoCompenso({ conto, ricevuta, manca })
      return { persona, conto, ricevuta, manca, senzaFirma: firme, stato }
    })
    .filter((r) => r.ricevuta || r.conto.lezioni || r.conto.daConfermare || r.senzaFirma.length)
}

/** Perché la ricevuta non si può fare con questo importo; `null` se va. Le stesse regole di `fai_ricevuta_compenso`. */
export function cosaNonVaCompenso({ importo, calcolato, motivo }: { importo: number; calcolato: number; motivo: string | null }): string | null {
  if (!Number.isInteger(importo) || importo <= 0) return 'Il compenso è un importo più grande di zero'
  if (importo > 10_000_000) return 'Il compenso è al massimo 100.000 €'
  const m = (motivo ?? '').trim()
  if (importo !== calcolato && !m) return 'Scrivi perché il compenso è diverso da quello calcolato'
  if (importo !== calcolato && m.length < 3) return 'Il perché è troppo corto: almeno tre lettere'
  if (importo !== calcolato && m.length > 200) return 'Il perché è troppo lungo: al massimo 200 caratteri'
  return null
}

const gma = (g: string) => g.split('-').reverse().join('/')
const casella = (si: boolean) => (si ? '☒' : '☐')
/** L'ordine della bozza: prima l'atleta. */
const MANSIONI = ['Atleta', 'Allenatore', 'Istruttore', 'Direttore tecnico', 'Direttore sportivo', 'Preparatore atletico', 'Direttore di gara', 'Altro'] as const satisfies ReadonlyArray<(typeof QUALIFICHE)[number]>

/**
 * La ricevuta, una riga per riga: quello che va nel PDF. Le caselle `☐`/`☒`
 * il PDF le disegna (Helvetica non le ha); le righe della liquidazione sono
 * intere, «voce … segno importo».
 */
export function testoRicevutaCompenso(r: DatiRicevutaCompenso): string[] {
  const t = r.tecnico
  const [anno, mese] = r.mese.split('-').map(Number)
  const ultimo = new Date(anno, mese, 0).getDate()
  const mm = String(mese).padStart(2, '0')
  const importo = euro(r.importo)
  const su = (x?: string) => (x ?? '').toUpperCase()
  return [
    `AUTOCERTIFICAZIONE PER COMPENSI A COLLABORATORI SPORTIVI – ANNO ${anno}`,
    `COGNOME: ${su(t.cognome)}`,
    `NOME: ${su(t.nome)}`,
    `NATO A: ${su(t.natoA)} PROV: ${t.provinciaNascita ?? ''}`,
    `DATA DI NASCITA: ${t.natoIl ? gma(t.natoIl) : ''}`,
    `INDIRIZZO E N. CIVICO: ${su(t.indirizzo)}`,
    `COMUNE: ${su(t.comune)} PROV: ${t.provincia ?? ''} CAP: ${t.cap ?? ''}`,
    `CODICE FISCALE: ${t.codiceFiscale ?? ''}`,
    'Il sottoscritto, titolare di un rapporto di lavoro sportivo ai sensi dell’art. 25 del Decreto Legislativo 28 febbraio 2021, n. 36, con mansioni di (barrare la casella di interesse):',
    ...MANSIONI.map((q) => `${casella(r.qualifica === q)} ${q.toUpperCase()}`),
    'consapevole delle sanzioni penali previste in caso di dichiarazioni non veritiere e di falsità negli atti (articolo 76, D.P.R. 445/2000), ai sensi degli artt. 46 e 47 del D.P.R. 445/2000,',
    'DICHIARA ai fini fiscali',
    `ai sensi del comma 1-bis, articolo 51, D.lgs. 36/2021 come novellato dall’articolo 16, D.L. 198/2022 convertito con modificazioni dalla L. 14/2023, relativamente al periodo dal 1° gennaio ${anno} alla data odierna:`,
    '☐ di NON AVER RICEVUTO compensi di cui all’articolo 36, comma 6 del D.lgs. 36/2021 e pertanto CHIEDE di beneficiare dell’esenzione da ritenute fiscali nella misura prevista dal comma 1-bis, articolo 51, D.lgs. 36/2021 (euro 15.000);',
    '☐ di AVER RICEVUTO compensi di cui all’articolo 36, comma 6 del D.lgs. 36/2021, per un ammontare complessivo di euro ____________________ e, pertanto, CHIEDE l’esenzione da ritenute fiscali sugli ulteriori compensi che mi sono dovuti sino a concorrenza della già menzionata soglia (euro 15.000);',
    '☐ di AVER RICEVUTO compensi di cui all’articolo 36, comma 6 del D.lgs. 36/2021 eguali o superiori alla già menzionata soglia (euro 15.000) e, pertanto, NON HA DIRITTO all’esenzione da ritenute fiscali.',
    'DICHIARA ai fini previdenziali',
    `ai sensi dell’articolo 35, D.lgs. 36/2021 come novellato dall’articolo 16, D.L. 198/2022 convertito con modificazioni dalla L. 14/2023, relativamente al periodo dal 1° gennaio ${anno} alla data odierna:`,
    '☐ di NON AVER RICEVUTO compensi per prestazioni di lavoro sportivo dilettantistico e pertanto CHIEDE di beneficiare dell’esenzione da ritenute previdenziali nella misura prevista dall’articolo 35, D.lgs. 36/2021 (euro 5.000);',
    '☐ di AVER RICEVUTO compensi per prestazioni di lavoro sportivo dilettantistico per un ammontare complessivo di euro ____________________ (inclusa presente) e, pertanto, CHIEDE l’esenzione da ritenute previdenziali sugli ulteriori compensi che mi sono dovuti sino a concorrenza della già menzionata soglia (euro 5.000);',
    '☐ di AVER RICEVUTO compensi per prestazioni di lavoro sportivo dilettantistico eguali o superiori alla già menzionata soglia (euro 5.000) e, pertanto, NON HA DIRITTO all’esenzione da ritenute previdenziali.',
    'DICHIARA',
    '(si evidenzia che al superamento della soglia di euro 5.000 ex art. 35, D.lgs. 36/2021 e ss.mm.ii. al fine di garantire il corretto accredito dei suoi contributi è necessario che provveda alla sua iscrizione alla Gestione Separata Inps)',
    '☐ di essere iscritto alla cassa professionale di appartenenza ovvero ad altre forme pensionistiche obbligatorie (Specificare Ente ………………………………………………);',
    '☐ di essere pensionato (Specificare Ente ………………………………………………);',
    '☐ di non essere iscritto ad alcuna forma pensionistica obbligatoria.',
    'DICHIARA ALTRESÌ',
    '☐ di non essere dipendente pubblico;',
    '☐ di essere dipendente pubblico (in tal caso barrare anche una delle due caselle seguenti):',
    '☐ dichiara di aver ricevuto autorizzazione per lo svolgimento di lavoro sportivo di cui all’articolo 25 e ss., D.lgs. 36/2021;',
    '☐ dichiara di non aver ricevuto autorizzazione per lo svolgimento di lavoro sportivo di cui all’articolo 25 e ss., D.lgs. 36/2021.',
    'RICHIEDE',
    `La liquidazione e il pagamento del compenso lordo pari ad € ${importo} maturato nel periodo 01/${mm}/${anno}-${ultimo}/${mm}/${anno}, a mezzo bonifico bancario su IBAN ${t.iban ?? '__________________________'}`,
    'Luogo e data Firma del collaboratore',
    `Collegno, ${gma(r.data)}`,
    `LIQUIDAZIONE DEI COMPENSI A COLLABORATORI SPORTIVI – ANNO ${anno}`,
    `Compenso lordo ${importo} + ${importo}`,
    'Contribuzione INPS a carico del collaboratore (1/3) - 0,00',
    'Ritenute IRPEF a carico del collaboratore - 0,00',
    'Addizionali regionali - 0,00',
    'Addizionali comunali - 0,00',
    `NETTO A PAGARE = ${importo}`,
    'DATA PAGAMENTO:',
  ]
}

/** Quello che serve sulla ricevuta e manca nella scheda: senza, la ricevuta non si fa. */
export function mancaPerRicevuta(a: { codiceFiscale?: string; indirizzo?: string; comune?: string; iban?: string } | null): string | null {
  const mancano = [!a?.codiceFiscale && 'codice fiscale', !(a?.indirizzo?.trim() && a?.comune?.trim()) && 'residenza', !a?.iban && 'IBAN'].filter((x): x is string => !!x)
  if (!mancano.length) return null
  return `Mancano i dati per la ricevuta: ${mancano.length === 1 ? mancano[0] : `${mancano.slice(0, -1).join(', ')} e ${mancano.at(-1)}`}`
}

/** Il compenso scritto a mano, in centesimi: «1540,00», «1.250,50», «180.5». `null` se non si legge. */
export function centesimiDaImporto(testo: string): number | null {
  let t = testo.trim().replace(/\s|€/g, '')
  // Col punto e la virgola il punto è delle migliaia; con uno solo dei due, è il separatore dei decimali.
  t = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}

/** Perché quello scritto nel campo del compenso non va; `null` se va. */
export function cosaNonVaImportoScritto(testo: string): string | null {
  const c = centesimiDaImporto(testo)
  if (c === null) return 'Scrivi il compenso in euro, per esempio 180 o 180,50'
  if (c <= 0) return 'Il compenso è un importo più grande di zero'
  if (c > 10_000_000) return 'Il compenso è al massimo 100.000 €'
  return null
}

/**
 * La ricevuta dai dati della scheda: le righe con la tariffa (un corso senza
 * non entra), il tecnico con IBAN e province, la qualifica della lettera
 * valida della stagione del mese. Il compenso è il calcolato, o quello
 * scritto a mano col perché.
 */
export function datiPerRicevuta(
  p: { id: string; nome: string; cognome: string },
  a: Omit<TecnicoCompenso, 'nome' | 'cognome'> | null,
  conto: ContoCompenso,
  mese: string,
  lettere: Array<Pick<Lettera, 'stagione' | 'qualifica' | 'sostituitaIl'>>,
  oggi: string,
  cambiato?: { importo: number; motivo: string },
): DatiRicevutaCompenso {
  const campi = ['indirizzo', 'cap', 'comune', 'provincia', 'codiceFiscale', 'natoIl', 'natoA', 'provinciaNascita', 'iban'] as const
  const tecnico: TecnicoCompenso = { nome: p.nome, cognome: p.cognome }
  for (const k of campi) if (a?.[k]) tecnico[k] = a[k]
  const stagione = stagioneDi(mese)
  const importo = cambiato?.importo ?? conto.calcolato
  return {
    personaId: p.id,
    mese,
    righe: conto.righe.filter((r) => r.importo !== undefined),
    calcolato: conto.calcolato,
    importo,
    motivo: importo === conto.calcolato ? null : cambiato?.motivo.trim() || null,
    tecnico,
    qualifica: lettere.find((l) => l.stagione === stagione && !l.sostituitaIl)?.qualifica ?? null,
    data: oggi,
  }
}

/** Cosa dire dopo «Prepara e stampa le ricevute»: quante fatte e chi è stato saltato; è un guaio solo se non ne è uscita nessuna. */
export function esitoDelMese(fatte: number, saltati: string[]): { testo: string; guaio: boolean } {
  const quante = fatte === 0 ? 'Nessuna ricevuta fatta' : fatte === 1 ? 'Fatta 1 ricevuta' : `Fatte ${fatte} ricevute`
  return { testo: saltati.length ? `${quante}. Saltati: ${saltati.join('; ')}` : quante, guaio: fatte === 0 && saltati.length > 0 }
}

const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

/**
 * La descrizione del movimento del pagamento, come la scrive `paga_compensi`:
 * «Compenso · Anna Gialli · set, ott 2026»; anni diversi «dic 2026, gen 2027».
 * Mai codice fiscale né IBAN.
 */
export function descrizionePagamento(nome: string, cognome: string, mesi: string[]): string {
  const anni = new Map<string, number[]>()
  for (const m of [...new Set(mesi)].sort()) anni.set(m.slice(0, 4), [...(anni.get(m.slice(0, 4)) ?? []), Number(m.slice(5, 7))])
  const quando = [...anni].map(([anno, ms]) => `${ms.map((x) => MESI_BREVI[x - 1]).join(', ')} ${anno}`).join(', ')
  return `Compenso · ${`${nome} ${cognome}`.trim()} · ${quando}`
}

/** Quanto ha preso da noi in un anno: le ricevute pagate quell'anno, per data di pagamento (per cassa, come il BILANCIO). */
export const presoNellAnno = (ricevute: Array<Pick<RicevutaCompenso, 'importo' | 'annullataIl' | 'pagataIl'>>, anno: number) =>
  ricevute.filter((r) => !r.annullataIl && r.pagataIl?.startsWith(`${anno}-`)).reduce((s, r) => s + r.importo, 0)

/**
 * Le ricevute di un tecnico che si possono pagare: fatte, non annullate, non
 * pagate, dalla più vecchia. Con `calcolatoDiAdesso` (il conto di oggi del mese
 * di una ricevuta) si tolgono quelle che non tornano più: si annullano e si
 * rifanno prima, come dice la loro riga.
 */
export const pagabili = <R extends Pick<RicevutaCompenso, 'personaId' | 'mese' | 'annullataIl' | 'pagataIl' | 'calcolato'>>(
  ricevute: R[],
  personaId: string,
  calcolatoDiAdesso?: (r: R) => number | undefined,
) =>
  ricevute
    .filter((r) => r.personaId === personaId && !r.annullataIl && !r.pagataIl)
    .filter((r) => {
      const adesso = calcolatoDiAdesso?.(r)
      return adesso === undefined || adesso === r.calcolato
    })
    .sort((x, y) => x.mese.localeCompare(y.mese))

/** La voce di sistema dei pagamenti dei tecnici in CONTABILITÀ (`81-compensi-pagati.sql`). */
export const VOCE_COMPENSI = 'Compensi istruttori'

/**
 * Perché il pagamento non si può segnare; `null` se va. Le stesse regole di
 * `paga_compensi`, dette prima di premere: almeno una ricevuta, il giorno non
 * nel futuro, la cassa, non prima del suo inizio, non in un giorno chiuso.
 */
export function cosaNonVaPagamento({
  ricevute,
  data,
  cassaId,
  casse,
  chiusure,
  oggi,
}: {
  ricevute: unknown[]
  data: string
  cassaId: string
  casse: Cassa[]
  chiusure: ChiusuraCassa[]
  oggi: string
}): string | null {
  if (!ricevute.length) return 'Scegli almeno una ricevuta da pagare'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return 'Scrivi il giorno del pagamento'
  if (data > oggi) return 'La data del pagamento non può essere nel futuro'
  const cassa = casse.find((c) => c.id === cassaId)
  if (!cassa) return 'Scegli la cassa'
  if (cassa.dal && data < cassa.dal) return 'La data è prima dell’inizio della cassa'
  if (giornoChiuso(chiusure, [cassa.id], data)) return 'Quel giorno la cassa è già chiusa: scegli un altro giorno o annulla la chiusura'
  return null
}
