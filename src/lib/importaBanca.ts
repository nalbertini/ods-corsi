import { cosaNonVaCambioVoce, giornoChiuso, pacchetti, VOCE_QUOTA, vuolePersonaRiga, type ChiusuraCassa, type MovimentoManuale, type RigaMovimento, type VoceContabile } from './contabilita'
import { STRUTTURA_CF } from './codiceFiscale'
import { VOCE_DA_CLASSIFICARE } from './importaPrimaNota'
import { nomeDallaCausale } from './movimentiPersona'
import type { ComeAbbinato } from './abbinaMovimenti'
import type { SuggerimentoMovimento } from './suggerimentoMovimento'

/**
 * La «Lista movimenti» di BancoPosta (CSV scaricato dall'home banking), letta nel browser e pronta per
 * `importa_prima_nota` (`supabase/63-importa-prima-nota.sql`). L'anteprima non scrive niente: dice cosa
 * entra, cosa c'è già (chiave uguale: già importato; pagamento uguale entro due giorni: coperto) e cosa
 * deve decidere la segreteria. `annulla_importazione_banca` (`104-importa-banca.sql`) disfa un lotto.
 *
 * Il file non ha un identificativo per riga: la chiave nasce dal contenuto (giorno, importo, testo) più
 * l'ordine fra righe identiche dello stesso giorno, così rileggere lo stesso file non duplica niente.
 */

export interface MovimentoBanca {
  /** Il numero di riga nel file, da 1: serve a dire quale riga si scarta. */
  riga: number
  data: string
  tipo: 'entrata' | 'uscita'
  /** In centesimi. */
  importo: number
  descrizione: string
  causale: string
  chiave: string
  /** Fino a due codici fiscali scritti nella causale (struttura valida): servono a proporre i figli, non si mostrano. */
  codiceFiscaleLetto: string[]
}

export interface RigaBancaScartata {
  riga: number
  testo: string
  motivo: string
}

export interface LetturaBanca {
  movimenti: MovimentoBanca[]
  scartate: RigaBancaScartata[]
  dal: string | null
  al: string | null
}

export interface AnteprimaBanca {
  entrano: MovimentoBanca[]
  giaImportati: MovimentoBanca[]
  coperti: { movimento: MovimentoBanca; con: RigaMovimento }[]
  daDecidere: { movimento: MovimentoBanca; candidati: RigaMovimento[]; preselezionato: string | null; come: Record<string, ComeAbbinato> }[]
  avvisi: { tipo: 'contanti'; conteggio: number; totale: number }[]
  scartate: RigaBancaScartata[]
  /** Tutte le righe del file, nell'ordine del file, ognuna col suo stato. */
  righe: RigaAnteprima[]
  /** I movimenti letti che non sono nel futuro, e il loro periodo: i conti dell'anteprima partono da qui. */
  lette: number
  dal: string | null
  al: string | null
  totali: { entrate: { conteggio: number; importo: number }; uscite: { conteggio: number; importo: number }; differenza: number }
}

export interface DatoImportBanca {
  chiave: string
  data: string
  cassa: 'conto'
  tipo: 'entrata' | 'uscita'
  importo: number
  descrizione: string
  voce: string
  codiceFiscaleLetto?: string[]
}

export const PREFISSO_CHIAVE_BANCA = 'banca:'
export const GIORNI_DI_DIFFERENZA = 2
const LUNGHEZZA_MASSIMA = 200

const NON_E_QUELLO_GIUSTO = 'Nel file non trovo l’elenco dei movimenti del conto. Scarica dall’home banking «Lista movimenti» in formato CSV e riprova.'

// Iban e codice fiscale, con la sigla che li precede: dati personali che nella descrizione non servono.
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g
const CODICE_FISCALE = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/g
const SIGLA = /\b(?:IBAN|C\.?F\.?)\s*:?\s*(?=\S)/gi

const centesimi = (testo: string) => Math.round(Number(testo.replace(',', '.')) * 100)

// Prima di puliscila, che i codici li toglie dalla descrizione: restano a parte, solo quelli con la struttura giusta.
function codiciLetti(testo: string): string[] {
  return [...new Set(testo.match(CODICE_FISCALE) ?? [])].filter((c) => STRUTTURA_CF.test(c)).slice(0, 2)
}

function puliscila(testo: string): string {
  return testo
    .replace(new RegExp(`${SIGLA.source}(?:${IBAN.source}|${CODICE_FISCALE.source})`, 'gi'), ' ')
    .replace(IBAN, ' ')
    .replace(CODICE_FISCALE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Un'impronta corta e stabile (FNV-1a) del contenuto: non protegge niente, serve solo a distinguere le righe.
function impronta(testo: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < testo.length; i++) h = Math.imul(h ^ testo.charCodeAt(i), 0x01000193) >>> 0
  return h.toString(36)
}

export function leggiBanca(testo: string): LetturaBanca {
  const righe = testo.split(/\r?\n/)
  const inizio = righe.findIndex((r) => r.trim().toUpperCase() === 'LISTA MOVIMENTI')
  if (inizio < 0) return { movimenti: [], scartate: [{ riga: 1, testo: righe[0] ?? '', motivo: NON_E_QUELLO_GIUSTO }], dal: null, al: null }

  const movimenti: MovimentoBanca[] = []
  const scartate: RigaBancaScartata[] = []
  const viste = new Map<string, number>()
  // La riga dopo il titolo è l'intestazione: sfasata di una colonna, non si legge.
  for (let i = inizio + 2; i < righe.length; i++) {
    const testoRiga = righe[i]
    if (testoRiga.trim() === '') continue
    const riga = i + 1
    const c = testoRiga.split('\t')
    const data = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(c[0]?.trim() ?? '')
    const giorno = data ? `${data[3]}-${data[2]}-${data[1]}` : ''
    const valida = !!data && !Number.isNaN(Date.parse(giorno)) && new Date(giorno).toISOString().slice(0, 10) === giorno
    if (!valida) {
      scartate.push({ riga, testo: testoRiga, motivo: 'La data non si legge. Correggila nel file e riprova.' })
      continue
    }
    const addebito = (c[2] ?? '').trim()
    const accredito = (c[3] ?? '').trim()
    const voluto = addebito || accredito
    if (!/^-?\d+(,\d+)?$/.test(voluto)) {
      scartate.push({ riga, testo: testoRiga, motivo: 'Manca l’importo, o non si legge.' })
      continue
    }
    const importo = Math.abs(centesimi(voluto))
    if (importo === 0) {
      scartate.push({ riga, testo: testoRiga, motivo: 'L’importo è zero.' })
      continue
    }
    const tipo = addebito ? 'uscita' : 'entrata'
    const grezzo = `${c[5] ?? ''} ${c[6] ?? ''}`
    const descrizione = puliscila(grezzo).slice(0, LUNGHEZZA_MASSIMA).trim()
    const hash = impronta(`${tipo}|${importo}|${grezzo.replace(/\s+/g, ' ').trim().toLowerCase()}`)
    const base = `${giorno.replace(/-/g, '')}:${hash}`
    const n = viste.get(base) ?? 0
    viste.set(base, n + 1)
    movimenti.push({ riga, data: giorno, tipo, importo, descrizione: descrizione || 'Movimento della banca', causale: (c[4] ?? '').trim(), chiave: `${PREFISSO_CHIAVE_BANCA}${base}:${n}`, codiceFiscaleLetto: codiciLetti(grezzo) })
  }
  const date = movimenti.map((x) => x.data).sort()
  return { movimenti, scartate, dal: date[0] ?? null, al: date[date.length - 1] ?? null }
}

const giorniTra = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000

const parolePiene = (s: string): string[] => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^\p{L}0-9']+/u).filter(Boolean)

/** Lo stato di una riga del file nell'anteprima: com'è finita, non solo se entra. */
export type StatoRigaBanca = 'nuova' | 'da-controllare' | 'duplicata' | 'da-decidere' | 'scartata'

/** Una riga del file, nell'ordine del file. `voce` è il movimento già presente di cui è la duplicata. */
export interface RigaAnteprima {
  riga: number
  stato: StatoRigaBanca
  /** Null solo per le scartate: del file di cui non si è letto niente resta il testo. */
  movimento: MovimentoBanca | null
  voce: RigaMovimento | null
  /** L'abbinamento l'ha fatto questa anteprima e la segreteria può rifiutarlo; se la riga era già importata di prima, no. */
  rifiutabile: boolean
  candidati: RigaMovimento[]
  preselezionato: string | null
  come: Record<string, ComeAbbinato>
  /** Solo delle scartate: il testo della riga e perché. */
  testo: string
  motivo: string
}

export type FiltroRigheBanca = 'tutte' | 'nuove' | 'duplicate' | 'da-decidere' | 'scartate'

const STATI_DEL_FILTRO: Record<FiltroRigheBanca, StatoRigaBanca[]> = {
  tutte: ['nuova', 'da-controllare', 'duplicata', 'da-decidere', 'scartata'],
  nuove: ['nuova', 'da-controllare'],
  duplicate: ['duplicata'],
  'da-decidere': ['da-decidere'],
  scartate: ['scartata'],
}

export type SegnoBanca = 'entrambe' | 'entrate' | 'uscite'

/** Con un segno le scartate non si vedono: non sono movimenti, non hanno segno. */
const delSegno = (r: RigaAnteprima, segno: SegnoBanca): boolean =>
  segno === 'entrambe' || r.movimento?.tipo === (segno === 'entrate' ? 'entrata' : 'uscita')

export const filtraRighe = (righe: RigaAnteprima[], filtro: FiltroRigheBanca, segno: SegnoBanca = 'entrambe'): RigaAnteprima[] =>
  righe.filter((r) => STATI_DEL_FILTRO[filtro].includes(r.stato) && delSegno(r, segno))

export const contaRighe = (righe: RigaAnteprima[], segno: SegnoBanca = 'entrambe') => ({
  tutte: filtraRighe(righe, 'tutte', segno).length,
  nuove: filtraRighe(righe, 'nuove', segno).length,
  duplicate: filtraRighe(righe, 'duplicate', segno).length,
  daDecidere: filtraRighe(righe, 'da-decidere', segno).length,
  scartate: filtraRighe(righe, 'scartate', segno).length,
})

/** Una riga del file com'è appena importata: un movimento a mano del conto, in «Da classificare». Serve alle regole della voce prima di scrivere. */
export const rigaComeMovimento = (mv: MovimentoBanca, contoId: string): RigaMovimento => ({
  id: mv.chiave, origine: 'movimento', tipo: mv.tipo, data: mv.data, importo: mv.importo, descrizione: mv.descrizione,
  voce: VOCE_DA_CLASSIFICARE, cassaId: contoId, annullato: false, origineImport: mv.chiave,
})

/** La voce (e per una quota o un corso la persona) scelta per una riga prima di importarla. */
export interface SceltaVoceBanca {
  voceId: string
  personaId?: string
  /** Solo per mostrarla: il database tiene l'id. */
  nomePersona?: string
}

/** Cosa non va in una scelta, con le parole di `cambia_voce_movimenti`: la riga come sarà una volta importata. */
export const cosaNonVaSceltaBanca = (mv: MovimentoBanca, scelta: SceltaVoceBanca, voci: VoceContabile[], contoId: string): string | null =>
  cosaNonVaCambioVoce([mv.chiave], [rigaComeMovimento(mv, contoId)], voci, scelta.voceId, scelta.personaId)

/** La riga vuole una persona con questa voce? (Quota o corsi su un'entrata.) */
export const sceltaVuolePersona = (mv: MovimentoBanca, voce: VoceContabile | undefined, contoId: string): boolean =>
  !!voce && vuolePersonaRiga(rigaComeMovimento(mv, contoId), voce.nome)

/** La scelta che parte dal suggerimento: la voce, e la persona solo se è preselezionata. */
export function sceltaProposta(sug: SuggerimentoMovimento | null): SceltaVoceBanca | null {
  if (!sug?.voce) return null
  return sug.preselezionato ? { voceId: sug.voce.voceId, personaId: sug.preselezionato } : { voceId: sug.voce.voceId }
}

/**
 * Cosa si scrive per ogni riga che entra: la scelta della segreteria, se no la voce suggerita. La persona
 * proposta non entra mai da sola: vale solo dopo il ✓, che la mette fra le scelte a mano.
 */
export function scelteDaScrivere(
  entrano: Pick<MovimentoBanca, 'chiave'>[], aMano: Record<string, SceltaVoceBanca>, proposte: Record<string, SuggerimentoMovimento | null>,
): Record<string, SceltaVoceBanca> {
  return Object.fromEntries(entrano.flatMap(({ chiave }) => {
    if (aMano[chiave]) return [[chiave, aMano[chiave]]]
    const p = sceltaProposta(proposte[chiave] ?? null)
    return p ? [[chiave, { voceId: p.voceId }]] : []
  }))
}

/**
 * Dopo l'importazione: a quali movimenti scritti (ritrovati dalla chiave, `origine_import`) cambiare la voce.
 * Le righe con la persona vanno una per volta (il database lo vuole); le altre a lotti per voce. Una scelta che
 * non va, o una riga che non si ritrova, resta in «Da classificare»: l'importazione non si ferma per questo.
 */
export function pianoDiClassificazione(
  entrano: MovimentoBanca[], scelte: Record<string, SceltaVoceBanca>, scritti: Pick<MovimentoManuale, 'id' | 'origineImport' | 'annullatoIl'>[], voci: VoceContabile[], contoId: string,
): { lotti: { ids: string[]; voceId: string; personaId?: string }[]; restano: number } {
  // Un annullato con la stessa chiave non è il movimento appena scritto.
  const perChiave = new Map(scritti.filter((x) => x.origineImport && !x.annullatoIl).map((x) => [x.origineImport, x.id]))
  const conPersona: { ids: string[]; voceId: string; personaId?: string }[] = []
  const perVoce = new Map<string, string[]>()
  let restano = 0
  for (const mv of entrano) {
    const scelta = scelte[mv.chiave]
    const id = perChiave.get(mv.chiave)
    const voce = voci.find((v) => v.id === scelta?.voceId)
    if (!scelta || !id || !voce || voce.nome === VOCE_DA_CLASSIFICARE || cosaNonVaSceltaBanca(mv, scelta, voci, contoId)) { restano++; continue }
    if (sceltaVuolePersona(mv, voce, contoId)) conPersona.push({ ids: [id], voceId: voce.id, personaId: scelta.personaId })
    else perVoce.set(voce.id, [...(perVoce.get(voce.id) ?? []), id])
  }
  const aLotti = [...perVoce].flatMap(([voceId, ids]) => pacchetti(ids).map((p) => ({ ids: p, voceId })))
  return { lotti: [...aLotti, ...conPersona], restano }
}

/**
 * Cosa succederebbe importando, senza scrivere niente. `righe` sono i movimenti già in elenco, `scelte` le
 * decisioni della segreteria: l'id del pagamento giusto, o «nessuno» (è un movimento nuovo).
 */
export function anteprimaBanca(lettura: LetturaBanca, righe: RigaMovimento[], contoId: string, oggi: string, scelte: Record<string, string> = {}, perGenitore: Record<string, string[]> = {}): AnteprimaBanca {
  const scartate = [...lettura.scartate]
  // Una riga già coperta da un movimento a mano è importata quanto una scritta nuova.
  const giaImportate = new Set(righe.flatMap((r) => [r.origineImport, r.bancaChiave]).filter((k): k is string => !!k))
  // Un movimento a mano copre un soldo arrivato solo: se è già di Satispay o di un'altra riga della banca, non è libero.
  const liberi = righe.filter((r) => r.cassaId === contoId && !r.annullato && !r.satispayId && !r.bancaChiave && !r.origineImport?.startsWith(PREFISSO_CHIAVE_BANCA))
  const usati = new Set<string>()
  const gruppi = gruppiRicevute(righe.filter((r) => r.cassaId === contoId && !r.annullato), new Set(liberi.map((r) => r.id)))
  // Un gruppo è libero finché nessuna delle sue rate copre un'altra riga; usarlo prende tutte le rate.
  const libero = (r: RigaMovimento) => !usati.has(r.id) && !(gruppi.get(r.id) ?? []).some((id) => usati.has(id))
  const usa = (r: RigaMovimento) => [r.id, ...(gruppi.get(r.id) ?? [])].forEach((id) => usati.add(id))
  const possibili = [...liberi, ...[...gruppi.keys()].map((id) => gruppoComeRiga(id, liberi.filter((r) => gruppi.get(id)?.includes(r.id))))]

  const validi = lettura.movimenti.filter((x) => x.data <= oggi)
  const date = validi.map((x) => x.data).sort()
  const entrano: MovimentoBanca[] = []
  const giaImportati: MovimentoBanca[] = []
  const coperti: AnteprimaBanca['coperti'] = []
  const daDecidere: AnteprimaBanca['daDecidere'] = []
  const righeDelFile: RigaAnteprima[] = []
  const riga = (r: Pick<RigaAnteprima, 'riga' | 'stato'> & Partial<RigaAnteprima>): RigaAnteprima => ({ movimento: null, voce: null, rifiutabile: false, candidati: [], preselezionato: null, come: {}, testo: '', motivo: '', ...r })

  for (const mv of lettura.movimenti) {
    if (mv.data > oggi) {
      scartate.push({ riga: mv.riga, testo: mv.descrizione, motivo: 'La data è nel futuro.' })
      continue
    }
    if (giaImportate.has(mv.chiave)) {
      giaImportati.push(mv)
      // Il movimento che l'ha scritta o che la copre, anche annullato: dice a cosa si riferisce.
      righeDelFile.push(riga({ riga: mv.riga, stato: 'duplicata', movimento: mv, voce: righe.find((r) => r.origineImport === mv.chiave || r.bancaChiave === mv.chiave) ?? null }))
      continue
    }
    const candidati = possibili
      .filter((r) => libero(r) && r.tipo === mv.tipo && r.importo === mv.importo && giorniTra(r.data, mv.data) <= GIORNI_DI_DIFFERENZA)
      .sort((a, b) => giorniTra(a.data, mv.data) - giorniTra(b.data, mv.data))
    const scelta = scelte[mv.chiave]
    if (scelta === 'nessuno' || candidati.length === 0) {
      entrano.push(mv)
      righeDelFile.push(riga({ riga: mv.riga, stato: 'nuova', movimento: mv }))
      continue
    }
    const migliori = candidati.filter((r) => giorniTra(r.data, mv.data) === giorniTra(candidati[0].data, mv.data))
    // Candidati dello stesso giorno sono intercambiabili: non serve chiedere. Una ricevuta intera no: è un'altra cosa.
    const unico = migliori.every((r) => r.data === migliori[0].data) && (migliori.length === 1 || !migliori.some(eGruppo))
    // Una ricevuta intera si prende da sola solo se il nome è quello del testo: se no la somma può tornare per caso.
    const daSolo = unico && (!eGruppo(migliori[0]) || nomeNelTesto(migliori[0], mv))
    const scelto = candidati.find((r) => r.id === scelta) ?? (daSolo ? migliori[0] : undefined)
    if (scelto) {
      usa(scelto)
      coperti.push({ movimento: mv, con: scelto })
      righeDelFile.push(riga({ riga: mv.riga, stato: 'duplicata', movimento: mv, voce: scelto, rifiutabile: true }))
    } else {
      const d = { movimento: mv, ...inCimaChiSembra(mv, candidati, perGenitore[mv.chiave] ?? []) }
      daDecidere.push(d)
      righeDelFile.push(riga({ riga: mv.riga, stato: 'da-decidere', ...d, motivo: unico ? NOME_DIVERSO : '' }))
    }
  }

  const somma = (tipo: 'entrata' | 'uscita') => {
    const v = entrano.filter((x) => x.tipo === tipo)
    return { conteggio: v.length, importo: v.reduce((s, x) => s + x.importo, 0) }
  }
  const entrate = somma('entrata')
  const uscite = somma('uscita')
  // Lo stesso controllo dà l'avviso e lo stato «da controllare» delle righe. Il versamento di Satispay non ne ha
  // bisogno: è l'incasso, lo scarico non scrive più movimenti.
  const eContanti = (x: MovimentoBanca) => x.tipo === 'entrata' && /versament/i.test(x.descrizione) && /contant/i.test(x.descrizione)
  const avviso = (tipo: 'contanti', vale: (x: MovimentoBanca) => boolean) => {
    const v = entrano.filter(vale)
    return v.length ? [{ tipo, conteggio: v.length, totale: v.reduce((s, x) => s + x.importo, 0) }] : []
  }
  const righeTutte = [
    ...righeDelFile.map((r) => (r.stato === 'nuova' && r.movimento && eContanti(r.movimento) ? { ...r, stato: 'da-controllare' as const } : r)),
    ...scartate.map((x) => riga({ riga: x.riga, stato: 'scartata', testo: x.testo, motivo: x.motivo })),
  ].sort((a, b) => a.riga - b.riga)
  return {
    righe: righeTutte,
    entrano,
    giaImportati,
    coperti,
    daDecidere,
    avvisi: [
      ...avviso('contanti', eContanti),
    ],
    scartate,
    lette: validi.length,
    dal: date[0] ?? null,
    al: date[date.length - 1] ?? null,
    totali: { entrate, uscite, differenza: entrate.importo - uscite.importo },
  }
}

/**
 * Tra i candidati, in cima chi ha nome e cognome interi nel testo della banca, poi i figli del genitore che il database
 * ha riconosciuto (`figli`: id dei movimenti). Si preseleziona solo se è uno in tutto: un nome e un genitore di persone
 * diverse sono troppo vicini per scegliere, come col punteggio di `abbinaMovimenti`. Gli altri restano per data.
 */
function inCimaChiSembra(mv: MovimentoBanca, candidati: RigaMovimento[], figli: string[]): { candidati: RigaMovimento[]; preselezionato: string | null; come: Record<string, ComeAbbinato> } {
  const nelle = new Set(parolePiene(mv.descrizione))
  const perNome = candidati.filter((r) => {
    const p = parolePiene(nomeDallaCausale(r.descrizione) ?? '')
    return p.length > 1 && p.every((w) => nelle.has(w))
  })
  const perGenitore = candidati.filter((r) => !perNome.includes(r) && (figli.includes(r.id) || (!!r.personaId && figli.includes(r.personaId))))
  const sale = [...perNome, ...perGenitore]
  return {
    candidati: [...sale, ...candidati.filter((r) => !sale.includes(r))],
    preselezionato: sale.length === 1 ? sale[0].id : null,
    come: Object.fromEntries(sale.map((r) => [r.id, perNome.includes(r) ? 'nome intero' : 'genitore'])),
  }
}

/** Le righe per `importa_prima_nota`: solo quelle che entrano, nel Conto Corrente, da classificare. */
export function datiImportBanca(a: AnteprimaBanca): DatoImportBanca[] {
  return a.entrano.map((x) => ({ chiave: x.chiave, data: x.data, cassa: 'conto', tipo: x.tipo, importo: x.importo, descrizione: x.descrizione, voce: VOCE_DA_CLASSIFICARE, ...(x.codiceFiscaleLetto.length ? { codiceFiscaleLetto: x.codiceFiscaleLetto } : {}) }))
}

export const MASSIMO_PER_IMPORTAZIONE = 1000

/**
 * L'ultima importazione ancora in piedi: le righe `banca:` non annullate scritte nello stesso istante
 * (un'importazione è una sola chiamata) più recente. Serve a «Annulla tutta l'importazione».
 */
export function ultimaImportazione(righe: RigaMovimento[]): { creatoIl: string; conteggio: number; dal: string; al: string } | null {
  const sue = righe.filter((r) => r.origineImport?.startsWith(PREFISSO_CHIAVE_BANCA) && !r.annullato && r.creatoIl)
  const creatoIl = sue.reduce<string | null>((m, r) => (r.creatoIl && (!m || r.creatoIl > m) ? r.creatoIl : m), null)
  if (!creatoIl) return null
  const lotto = sue.filter((r) => r.creatoIl === creatoIl)
  const date = lotto.map((r) => r.data).sort()
  return { creatoIl, conteggio: lotto.length, dal: date[0], al: date[date.length - 1] }
}

/** Un movimento della banca abbinato da solo a uno già scritto a mano: si salva per poterlo ricontrollare. */
export interface CopertoBanca {
  chiave: string
  data: string
  tipo: 'entrata' | 'uscita'
  importo: number
  descrizione: string
  conId: string
  conDescrizione: string
}

/** Le righe per `banca_segna_coperti` (114-importazioni.sql). */
export function copertiDaSalvare(a: AnteprimaBanca): CopertoBanca[] {
  return a.coperti.map(({ movimento: m, con }) => ({ chiave: m.chiave, data: m.data, tipo: m.tipo, importo: m.importo, descrizione: m.descrizione, conId: con.id, conDescrizione: con.descrizione }))
}

/**
 * `banca_segna_coperti` per la modalità prova: ogni riga coperta dà il segno della banca al suo movimento a mano.
 * Una riga coperta da un incasso (`incasso:`, una ricevuta o un pagamento a mano) resta solo nei coperti: su
 * ricevute e pagamenti non si scrive. L'abbinamento si ricontrolla: se il movimento o l'incasso non c'è più, è
 * già di Satispay o di un'altra riga, o non torna, la riga va in `daScrivere` e entra come un import normale.
 * Una riga già vista non cambia niente.
 */
export function segnaCoperti(movimenti: MovimentoManuale[], coperti: CopertoBanca[], righe: CopertoBanca[], contoId: string, incassi: RigaMovimento[] = []): { movimenti: MovimentoManuale[]; coperti: CopertoBanca[]; daScrivere: DatoImportBanca[] } {
  const mov = [...movimenti]
  const cop = [...coperti]
  const daScrivere: DatoImportBanca[] = []
  for (const r of righe) {
    if (!r.chiave?.startsWith(PREFISSO_CHIAVE_BANCA)) throw new Error('Un movimento già scritto non ha la chiave della banca')
    if (cop.some((c) => c.chiave === r.chiave) || mov.some((m) => m.origineImport === r.chiave || m.bancaChiave === r.chiave)) continue
    if (r.conId.startsWith(PREFISSO_RICEVUTA)) {
      const id = r.conId.slice(PREFISSO_RICEVUTA.length)
      const rate = incassi.filter((x) => ricevutaDellIncasso(x.id) === id && x.tipo === 'entrata' && x.cassaId === contoId && !x.annullato)
      const regge = r.tipo === 'entrata' && rate.length >= 2 && rate.every((x) => x.data === rate[0].data) && rate.reduce((s, x) => s + x.importo, 0) === r.importo
        && !cop.some((c) => c.conId === r.conId || ricevutaDellIncasso(c.conId) === id)
      if (regge) cop.push(r)
      else daScrivere.push({ chiave: r.chiave, data: r.data, cassa: 'conto', tipo: r.tipo, importo: r.importo, descrizione: r.descrizione, voce: VOCE_DA_CLASSIFICARE })
      continue
    }
    if (r.conId.startsWith(PREFISSO_INCASSO)) {
      const regge = r.tipo === 'entrata' && !cop.some((c) => c.conId === r.conId || c.conId === `${PREFISSO_RICEVUTA}${ricevutaDellIncasso(r.conId)}`)
        && incassi.some((x) => x.id === r.conId && x.tipo === 'entrata' && x.importo === r.importo && x.cassaId === contoId && !x.annullato)
      if (regge) cop.push(r)
      else daScrivere.push({ chiave: r.chiave, data: r.data, cassa: 'conto', tipo: r.tipo, importo: r.importo, descrizione: r.descrizione, voce: VOCE_DA_CLASSIFICARE })
      continue
    }
    const i = mov.findIndex((m) => m.id === r.conId && m.tipo === r.tipo && m.importo === r.importo && m.cassaId === contoId && !m.annullatoIl && !m.satispayId && !m.bancaChiave)
    if (i < 0) {
      daScrivere.push({ chiave: r.chiave, data: r.data, cassa: 'conto', tipo: r.tipo, importo: r.importo, descrizione: r.descrizione, voce: VOCE_DA_CLASSIFICARE })
      continue
    }
    mov[i] = { ...mov[i], bancaChiave: r.chiave }
    cop.push(r)
  }
  return { movimenti: mov, coperti: cop, daScrivere }
}

const PREFISSO_INCASSO = 'incasso:'
/** Una ricevuta intera pagata in più rate (`ricevuta:<id>`): copre un bonifico solo che le paga tutte. */
const PREFISSO_RICEVUTA = 'ricevuta:'
const NOME_DIVERSO = 'Il nome nel testo non è quello della ricevuta: dimmi tu.'

/** La ricevuta di un incasso `incasso:<ricevuta>:<voce>:<pagamento>` (`righeDaRicevute`); null per i pagamenti a mano e il resto. */
const ricevutaDellIncasso = (id: string): string | null => /^incasso:(?!diretto:)([^:]+):\d+:\d+$/.exec(id)?.[1] ?? null

const eGruppo = (r: RigaMovimento) => r.id.startsWith(PREFISSO_RICEVUTA)

/**
 * Le ricevute con almeno due rate sul conto, tutte libere e dello stesso giorno: id del gruppo → id delle rate.
 * Una rata già coperta da un'altra riga toglie il gruppo: il database somma tutte le rate sul conto.
 */
function gruppiRicevute(delConto: RigaMovimento[], liberi: Set<string>): Map<string, string[]> {
  const per = new Map<string, RigaMovimento[]>()
  for (const r of delConto) {
    const id = r.tipo === 'entrata' ? ricevutaDellIncasso(r.id) : null
    if (id) per.set(id, [...(per.get(id) ?? []), r])
  }
  return new Map([...per].filter(([, rate]) => rate.length >= 2 && rate.every((x) => liberi.has(x.id) && x.data === rate[0].data))
    .map(([id, rate]) => [`${PREFISSO_RICEVUTA}${id}`, rate.map((x) => x.id)]))
}

const virgola = (c: number) => (c / 100).toFixed(2).replace('.', ',')
// «quota» per la quota associativa, se no la prima parola della voce («trimestre», «annuale»), come sulla ricevuta.
const parteDi = (r: RigaMovimento) =>
  `${r.voce === VOCE_QUOTA ? 'quota' : ((r.sotto ?? '').split(' · ')[0].match(/^(?!ricevuta )(\S+)/)?.[1] ?? r.voce ?? '').toLowerCase()} ${virgola(r.importo)}`

/** La ricevuta intera come una riga sola, per l'anteprima: il nome, la somma e le rate nel dettaglio. */
function gruppoComeRiga(id: string, rate: RigaMovimento[]): RigaMovimento {
  const ordinate = [...rate].sort((a, b) => a.id.localeCompare(b.id, 'it', { numeric: true }))
  const numero = rate.map((r) => /ricevuta \d+\/\d+/.exec(r.sotto ?? '')?.[0]).find(Boolean)
  return {
    ...ordinate[0], id, origine: 'ricevuta', importo: rate.reduce((s, x) => s + x.importo, 0),
    sotto: [numero, ordinate.map(parteDi).join(' + ')].filter(Boolean).join(' · '),
  }
}

/** Il nome della ricevuta (almeno due parole) sta tutto nel testo della banca. */
const nomeNelTesto = (r: RigaMovimento, mv: MovimentoBanca) => {
  const nel = new Set(parolePiene(mv.descrizione))
  const p = parolePiene(r.descrizione)
  return p.length > 1 && p.every((w) => nel.has(w))
}

/**
 * Gli incassi (ricevute e pagamenti a mano) coperti da una riga della banca prendono la sua chiave, come i
 * movimenti a mano: così l'anteprima li vede già importati e non li propone di nuovo, e la quadratura li conta.
 * Una ricevuta intera (`ricevuta:<id>`) la dà a tutte le sue rate.
 */
export function segnaIncassiCoperti(righe: RigaMovimento[], coperti: CopertoBanca[]): RigaMovimento[] {
  const chiavi = new Map(coperti.filter((c) => c.conId.startsWith(PREFISSO_INCASSO)).map((c) => [c.conId, c.chiave]))
  const perRicevuta = new Map(coperti.filter((c) => c.conId.startsWith(PREFISSO_RICEVUTA)).map((c) => [c.conId.slice(PREFISSO_RICEVUTA.length), c.chiave]))
  return righe.map((r) => {
    const k = chiavi.get(r.id) ?? perRicevuta.get(ricevutaDellIncasso(r.id) ?? '')
    return k ? { ...r, bancaChiave: k } : r
  })
}

/**
 * `banca_non_e_questo` per la modalità prova: il movimento della banca entra come un import normale e lascia i
 * coperti. Nei giorni chiusi del Conto Corrente no: cambierebbe i conti di una chiusura già fatta.
 */
export function nonEQuestoBanca(coperti: CopertoBanca[], chiave: string, chiusure: ChiusuraCassa[], contoId: string): { scrivi: DatoImportBanca; coperti: CopertoBanca[] } {
  const c = coperti.find((x) => x.chiave === chiave)
  if (!c) throw new Error('Questo movimento non è fra quelli già scritti')
  if (giornoChiuso(chiusure, [contoId], c.data)) throw new Error('Quel giorno la cassa è chiusa: il collegamento resta')
  return {
    scrivi: { chiave: c.chiave, data: c.data, cassa: 'conto', tipo: c.tipo, importo: c.importo, descrizione: c.descrizione, voce: VOCE_DA_CLASSIFICARE },
    coperti: coperti.filter((x) => x !== c),
  }
}

/** Una riga di «Cosa è entrato» dalla banca: importata come movimento nuovo, o coperta da uno scritto a mano. */
export interface RigaEntratoBanca {
  chiave: string
  data: string
  tipo: 'entrata' | 'uscita'
  importo: number
  descrizione: string
  come: 'nuovo' | 'coperto'
  voce: string | null
  con: { id: string; descrizione: string } | null
}

/** «Cosa è entrato» dalla banca in un mese (`AAAA-MM`): le righe importate ancora in piedi e quelle coperte. */
export function entratoBanca(righe: RigaMovimento[], coperti: CopertoBanca[], mese: string) {
  const importate: RigaEntratoBanca[] = righe
    .filter((r) => r.origineImport?.startsWith(PREFISSO_CHIAVE_BANCA) && !r.annullato && r.data.slice(0, 7) === mese)
    // `as`: le righe `banca:` vengono da `datiImportBanca`, che scrive solo entrate e uscite.
    .map((r) => ({ chiave: r.origineImport as string, data: r.data, tipo: r.tipo as RigaEntratoBanca['tipo'], importo: r.importo, descrizione: r.descrizione, come: 'nuovo', voce: r.voce, con: null }))
  const coperte: RigaEntratoBanca[] = coperti
    .filter((c) => c.data.slice(0, 7) === mese)
    .map((c) => ({ chiave: c.chiave, data: c.data, tipo: c.tipo, importo: c.importo, descrizione: c.descrizione, come: 'coperto', voce: null, con: { id: c.conId, descrizione: c.conDescrizione } }))
  const conto = (xs: RigaEntratoBanca[]) => ({ conteggio: xs.length, importo: xs.reduce((s, x) => s + (x.tipo === 'entrata' ? x.importo : -x.importo), 0) })
  return {
    righe: [...importate, ...coperte].sort((a, b) => a.data.localeCompare(b.data) || a.chiave.localeCompare(b.chiave)),
    nuovi: conto(importate),
    coperti: conto(coperte),
  }
}
