import type { RigaMovimento } from './contabilita'
import { VOCE_DA_CLASSIFICARE } from './importaPrimaNota'

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
  daDecidere: { movimento: MovimentoBanca; candidati: RigaMovimento[] }[]
  avvisi: { tipo: 'satispay' | 'contanti'; conteggio: number; totale: number }[]
  scartate: RigaBancaScartata[]
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
}

export const PREFISSO_CHIAVE_BANCA = 'banca:'
const GIORNI_DI_DIFFERENZA = 2
const LUNGHEZZA_MASSIMA = 200

const NON_E_QUELLO_GIUSTO = 'Nel file non trovo l’elenco dei movimenti del conto. Scarica dall’home banking «Lista movimenti» in formato CSV e riprova.'

// Iban e codice fiscale, con la sigla che li precede: dati personali che nella descrizione non servono.
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g
const CODICE_FISCALE = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/g
const SIGLA = /\b(?:IBAN|C\.?F\.?)\s*:?\s*(?=\S)/gi

const centesimi = (testo: string) => Math.round(Number(testo.replace(',', '.')) * 100)

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
    movimenti.push({ riga, data: giorno, tipo, importo, descrizione: descrizione || 'Movimento della banca', causale: (c[4] ?? '').trim(), chiave: `${PREFISSO_CHIAVE_BANCA}${base}:${n}` })
  }
  const date = movimenti.map((x) => x.data).sort()
  return { movimenti, scartate, dal: date[0] ?? null, al: date[date.length - 1] ?? null }
}

const giorniTra = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000

/**
 * Cosa succederebbe importando, senza scrivere niente. `righe` sono i movimenti già in elenco, `scelte` le
 * decisioni della segreteria: l'id del pagamento giusto, o «nessuno» (è un movimento nuovo).
 */
export function anteprimaBanca(lettura: LetturaBanca, righe: RigaMovimento[], contoId: string, oggi: string, scelte: Record<string, string> = {}): AnteprimaBanca {
  const scartate = [...lettura.scartate]
  const giaImportate = new Set(righe.map((r) => r.origineImport).filter((k): k is string => !!k))
  const liberi = righe.filter((r) => r.cassaId === contoId && !r.annullato && !r.origineImport?.startsWith(PREFISSO_CHIAVE_BANCA))
  const usati = new Set<string>()

  const validi = lettura.movimenti.filter((x) => x.data <= oggi)
  const date = validi.map((x) => x.data).sort()
  const entrano: MovimentoBanca[] = []
  const giaImportati: MovimentoBanca[] = []
  const coperti: AnteprimaBanca['coperti'] = []
  const daDecidere: AnteprimaBanca['daDecidere'] = []

  for (const mv of lettura.movimenti) {
    if (mv.data > oggi) {
      scartate.push({ riga: mv.riga, testo: mv.descrizione, motivo: 'La data è nel futuro.' })
      continue
    }
    if (giaImportate.has(mv.chiave)) {
      giaImportati.push(mv)
      continue
    }
    const candidati = liberi
      .filter((r) => !usati.has(r.id) && r.tipo === mv.tipo && r.importo === mv.importo && giorniTra(r.data, mv.data) <= GIORNI_DI_DIFFERENZA)
      .sort((a, b) => giorniTra(a.data, mv.data) - giorniTra(b.data, mv.data))
    const scelta = scelte[mv.chiave]
    if (scelta === 'nessuno' || candidati.length === 0) {
      entrano.push(mv)
      continue
    }
    const migliori = candidati.filter((r) => giorniTra(r.data, mv.data) === giorniTra(candidati[0].data, mv.data))
    // Candidati dello stesso giorno sono intercambiabili: non serve chiedere.
    const unico = migliori.every((r) => r.data === migliori[0].data)
    const scelto = candidati.find((r) => r.id === scelta) ?? (unico ? migliori[0] : undefined)
    if (scelto) {
      usati.add(scelto.id)
      coperti.push({ movimento: mv, con: scelto })
    } else {
      daDecidere.push({ movimento: mv, candidati })
    }
  }

  const somma = (tipo: 'entrata' | 'uscita') => {
    const v = entrano.filter((x) => x.tipo === tipo)
    return { conteggio: v.length, importo: v.reduce((s, x) => s + x.importo, 0) }
  }
  const entrate = somma('entrata')
  const uscite = somma('uscita')
  const avviso = (tipo: 'satispay' | 'contanti', vale: (x: MovimentoBanca) => boolean) => {
    const v = entrano.filter((x) => x.tipo === 'entrata' && vale(x))
    return v.length ? [{ tipo, conteggio: v.length, totale: v.reduce((s, x) => s + x.importo, 0) }] : []
  }
  return {
    entrano,
    giaImportati,
    coperti,
    daDecidere,
    avvisi: [
      ...avviso('satispay', (x) => /satispay europe/i.test(x.descrizione)),
      ...avviso('contanti', (x) => /versament/i.test(x.descrizione) && /contant/i.test(x.descrizione)),
    ],
    scartate,
    lette: validi.length,
    dal: date[0] ?? null,
    al: date[date.length - 1] ?? null,
    totali: { entrate, uscite, differenza: entrate.importo - uscite.importo },
  }
}

/** Le righe per `importa_prima_nota`: solo quelle che entrano, nel Conto Corrente, da classificare. */
export function datiImportBanca(a: AnteprimaBanca): DatoImportBanca[] {
  return a.entrano.map((x) => ({ chiave: x.chiave, data: x.data, cassa: 'conto', tipo: x.tipo, importo: x.importo, descrizione: x.descrizione, voce: VOCE_DA_CLASSIFICARE }))
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
