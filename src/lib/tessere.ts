/**
 * Le tessere: chi è tesserato, con quale ente e fino a quando, e cosa manca a
 * chi è iscritto a un corso che ne chiede una. Tutto quello che si decide senza
 * schermo sta qui: il foglio del RASD, lo stato di una persona per ente, le
 * parole nella tabella ISCRITTI, l'incrocio con le iscrizioni e i motivi di
 * un'import che non si può fare. L'import ha le stesse regole di `importa_tessere`
 * in `61-tessere.sql` (in prova: `importaTessereProva`): se cambia una, cambia l'altra.
 * L'incrocio sta solo qui: il database non ne ha una copia.
 */

import { leggiData, leggiTabella, piatto } from './importa'
import { dataLunga } from './sala'
import { inCorso, type CorsoSeg, type PersonaSeg } from './segreteria'

export type TipoTessera = 'praticante' | 'agonista' | 'dirigente' | 'tecnico' | 'altro'

/** Una tessera com'è nel database; `personaId` c'è solo quando si legge l'elenco di tutte. */
export interface TesseraSeg {
  id?: string
  personaId?: string
  /** In maiuscolo: FIJLKAM, FIPE… */
  ente: string
  tipo: TipoTessera
  codice?: string
  dal: string
  al: string
  origine?: 'rasd' | 'manuale'
}

/** Quanti giorni prima della fine una tessera è «in scadenza». */
export const GIORNI_IN_SCADENZA = 60

/** Una riga come la vuole `importa_tessere`. */
export interface RigaRasd {
  ente: string
  nome: string
  codice_fiscale: string
  tipo: TipoTessera
  codice: string
  dal: string
  al: string
}

export interface RigaSaltata {
  /** Il numero della riga nel foglio: l'intestazione è la 1. */
  riga: number
  motivo: string
}

/** Cosa risponde `importa_tessere`. */
export interface EsitoImportTessere {
  nuove: number
  gia_presenti: number
  non_abbinate: Array<{ nome: string; codice_fiscale: string; ente: string; esito: 'nessuna_scheda' | 'nome_diverso' | 'riga_non_valida' }>
  scritto: boolean
}

/** Dal tipo scritto dal RASD («Atleta Praticante») a quello del database. */
export function tipoDaRasd(testo: string): TipoTessera {
  const t = piatto(testo)
  if (t.includes('praticante')) return 'praticante'
  if (t.includes('agonista')) return 'agonista'
  if (t.includes('dirigente')) return 'dirigente'
  if (t.includes('tecnico')) return 'tecnico'
  return 'altro'
}

const COLONNE: Array<{ chiave: string; nome: string }> = [
  { chiave: 'organismo', nome: 'Organismo' },
  { chiave: 'persona', nome: 'Persona' },
  { chiave: 'codice fiscale', nome: 'Codice fiscale' },
  { chiave: 'tipo', nome: 'Tipo' },
  { chiave: 'codice tess', nome: 'Codice tess.' },
  { chiave: 'valido dal', nome: 'Valido dal' },
]

/**
 * Il foglio del RASD (CSV, con `;` o `,` e il BOM come tutti gli altri) in
 * righe per `importa_tessere`. La fine è sempre il 31 dicembre dell'anno di
 * «Valido dal». Le righe che non si leggono non fermano le altre: finiscono in
 * `saltate`, col numero di riga del foglio e il motivo in italiano.
 */
export function righeDalFoglio(testo: string): { righe: RigaRasd[]; saltate: RigaSaltata[]; errore?: string } {
  const t = leggiTabella(testo)
  if (!t.testa.some((h) => h.trim())) return { righe: [], saltate: [], errore: 'Il foglio è vuoto.' }
  const testa = t.testa.map((h) => piatto(h).replace(/\.$/, ''))
  const posto = new Map<string, number>()
  for (const c of COLONNE) {
    const i = testa.indexOf(c.chiave)
    if (i < 0) return { righe: [], saltate: [], errore: `Nel foglio manca la colonna «${c.nome}».` }
    posto.set(c.chiave, i)
  }
  const righe: RigaRasd[] = []
  const saltate: RigaSaltata[] = []
  if (t.righe.every((r) => r.every((x) => !x.trim()))) return { righe, saltate, errore: 'Il foglio non ha righe.' }
  t.righe.forEach((r, n) => {
    if (r.every((x) => !x.trim())) return
    const cella = (k: string) => (r[posto.get(k) ?? -1] ?? '').trim()
    const riga = n + 2
    const salta = (motivo: string) => saltate.push({ riga, motivo })
    const ente = cella('organismo').toUpperCase()
    const nome = cella('persona')
    const cf = cella('codice fiscale').toUpperCase()
    const codice = cella('codice tess')
    const dalScritto = cella('valido dal')
    if (!ente) return salta('Manca l’organismo.')
    if (ente.length > 40) return salta('L’organismo è più lungo di 40 caratteri.')
    if (!nome) return salta('Manca il nome.')
    if (!cf) return salta('Manca il codice fiscale.')
    if (!/^[A-Z0-9]{16}$/.test(cf)) return salta('Il codice fiscale non è di 16 caratteri.')
    if (!codice) return salta('Manca il codice della tessera.')
    if (codice.length > 20) return salta('Il codice della tessera è più lungo di 20 caratteri.')
    // Una tessera può valere da una data futura (un rinnovo già fatto): la data di «oggi» è lontana.
    const dal = leggiData(dalScritto, new Date(2100, 0, 1))
    if (!dal) return salta(`La data «${dalScritto}» non si legge.`)
    if (dal < '2000-01-01' || dal > '2100-12-31') return salta(`La data «${dalScritto}» è fuori dal 2000-2100.`)
    righe.push({ ente, nome, codice_fiscale: cf, tipo: tipoDaRasd(cella('tipo')), codice, dal, al: fineAnno(dal) })
  })
  return { righe, saltate }
}

export type StatoTessera = 'manca' | 'scaduta' | 'in_scadenza' | 'valida'

/** Le tessere finiscono il 31 dicembre dell'anno di «valida dal». */
export const fineAnno = (dal: string) => `${dal.slice(0, 4)}-12-31`

const giorniTra = (da: string, a: string) => Math.round((Date.parse(a) - Date.parse(da)) / 86_400_000)

/** Copre chi pratica solo una tessera da praticante o da agonista: un dirigente o un tecnico non basta. */
const daAtleta = (t: Pick<TesseraSeg, 'tipo'>) => t.tipo === 'praticante' || t.tipo === 'agonista'

/** Fin dove vale la tessera da atleta più lontana di un ente, o niente se non ne ha mai avuta una. */
export function fineTessera(tessere: Array<Pick<TesseraSeg, 'ente' | 'tipo' | 'al'>>, ente: string): string | undefined {
  return tessere.filter((t) => t.ente === ente && daAtleta(t)).reduce<string | undefined>((m, t) => (m === undefined || t.al > m ? t.al : m), undefined)
}

/**
 * Come sta una persona con la tessera di un ente. Conta la più lontana; un
 * rinnovo che comincia più avanti vale già (non è «in scadenza»).
 */
export function statoTessera(tessere: Array<Pick<TesseraSeg, 'ente' | 'tipo' | 'al'>>, ente: string, oggi: string): StatoTessera {
  const fine = fineTessera(tessere, ente)
  if (fine === undefined) return 'manca'
  if (fine < oggi) return 'scaduta'
  return giorniTra(oggi, fine) <= GIORNI_IN_SCADENZA ? 'in_scadenza' : 'valida'
}

const MESI = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE']
const mese = (al: string | undefined) => (MESI[Number((al ?? '').slice(5, 7)) - 1] ?? '').toLowerCase()

/** La parola nella colonna IN REGOLA di ISCRITTI; niente se la tessera è valida (IN REGOLA lo dice già). */
export function parolaTessera(stato: StatoTessera, al: string | undefined): { tono: 'rosso' | 'giallo'; parola: string } | null {
  if (stato === 'manca') return { tono: 'rosso', parola: 'Manca la tessera' }
  if (stato === 'scaduta') return { tono: 'rosso', parola: 'Tessera scaduta' }
  if (stato === 'in_scadenza') return { tono: 'giallo', parola: `Tessera scade a ${mese(al)}`.trim() }
  return null
}

/** La parola di una tessera nella sua riga (nella scheda), senza «tessera» davanti: la riga lo dice già. */
export function parolaTesseraBreve(stato: StatoTessera, al: string | undefined): { tono: 'rosso' | 'giallo'; parola: string } | null {
  if (stato === 'manca') return { tono: 'rosso', parola: 'Manca la tessera' }
  if (stato === 'scaduta') return { tono: 'rosso', parola: 'Scaduta' }
  if (stato === 'in_scadenza') return { tono: 'giallo', parola: `Scade a ${mese(al)}`.trim() }
  return null
}

/** Una tessera in parole, per la scheda della persona. */
export function fraseTessera(t: Pick<TesseraSeg, 'ente' | 'tipo' | 'al'>, oggi: string): string {
  const base = `${t.ente} · ${t.tipo}`
  if (t.al < oggi) return `${base} · scaduta il ${dataLunga(t.al)}`
  const giorni = giorniTra(oggi, t.al)
  const presto = giorni <= GIORNI_IN_SCADENZA && daAtleta(t) ? ` · scade fra ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}` : ''
  return `${base} · fino al ${dataLunga(t.al)}${presto}`
}

export type EsitoIncrocio = 'manca' | 'scaduta' | 'in_scadenza' | 'non_iscritto'

export interface RigaIncrocio {
  personaId: string
  ente: string
  esito: EsitoIncrocio
  /** I corsi che chiedono la tessera, per chi è iscritto. */
  corsi?: string
  /** La fine dell'ultima tessera, se ne ha avuta una. */
  tesseraAl?: string
}

type PersonaPerTessere = Pick<PersonaSeg, 'id' | 'attiva' | 'iscrizioni'> & { tessere?: TesseraSeg[] }

/** Le tessere che chiedono i corsi a cui è iscritta oggi una persona: ente → nomi dei corsi, in ordine. */
export function tessereRichieste(p: Pick<PersonaSeg, 'iscrizioni'>, corsi: Array<Pick<CorsoSeg, 'id' | 'nome'> & { enteTessera?: string | null }>, oggi: string): Map<string, string[]> {
  const perId = new Map(corsi.map((c) => [c.id, c]))
  const per = new Map<string, string[]>()
  for (const i of p.iscrizioni) {
    const c = perId.get(i.corsoId)
    if (c?.enteTessera && inCorso(i, oggi)) per.set(c.enteTessera, [...(per.get(c.enteTessera) ?? []), c.nome])
  }
  for (const [ente, nomi] of per) per.set(ente, [...new Set(nomi)].sort((a, b) => a.localeCompare(b)))
  return per
}

/**
 * L'incrocio fra iscrizioni e tessere: una riga per
 * persona ed ente. Chi è iscritto a un corso che chiede la tessera di un ente
 * e non ce l'ha (manca, scaduta, in scadenza a 60 giorni), e chi ha una tessera
 * da atleta che vale oggi ma nessun corso. Le prove gratuite non sono
 * iscrizioni, e le schede archiviate non si guardano.
 */
export function incrocioTessere(persone: PersonaPerTessere[], corsi: Array<Pick<CorsoSeg, 'id' | 'nome'> & { enteTessera?: string | null }>, oggi: string): RigaIncrocio[] {
  const righe: RigaIncrocio[] = []
  for (const p of persone) {
    if (!p.attiva) continue
    const tessere = p.tessere ?? []
    const iscritta = p.iscrizioni.some((i) => inCorso(i, oggi))
    for (const [ente, nomi] of tessereRichieste(p, corsi, oggi)) {
      const stato = statoTessera(tessere, ente, oggi)
      if (stato === 'valida') continue
      righe.push({ personaId: p.id, ente, esito: stato, corsi: nomi.join(', '), tesseraAl: fineTessera(tessere, ente) })
    }
    if (iscritta) continue
    for (const ente of new Set(tessere.filter((t) => daAtleta(t) && t.dal <= oggi && t.al >= oggi).map((t) => t.ente))) {
      righe.push({ personaId: p.id, ente, esito: 'non_iscritto', tesseraAl: fineTessera(tessere, ente) })
    }
  }
  return righe
}

/** Le persone senza una tessera valida (manca o scaduta): il numero della casella TESSERE di COSA MANCA e le righe del filtro. */
export const contaTessere = (righe: RigaIncrocio[]) => new Set(righe.filter((r) => senzaTessera([r])).map((r) => r.personaId)).size

/** Attacca a ogni persona le sue tessere. */
export function conTessere<T extends { id: string }>(persone: T[], tessere: TesseraSeg[]): Array<T & { tessere: TesseraSeg[] }> {
  const per = new Map<string, TesseraSeg[]>()
  for (const t of tessere) if (t.personaId) per.set(t.personaId, [...(per.get(t.personaId) ?? []), t])
  return persone.map((p) => ({ ...p, tessere: per.get(p.id) ?? [] }))
}

/** Perché una riga del foglio non è entrata, in parole di chi lo legge: mai il testo grezzo dell'API. */
export function motivoNonAbbinata(esito: string): string {
  if (esito === 'nome_diverso') return 'Il codice fiscale è di un’altra persona: controlla il nome.'
  if (esito === 'nessuna_scheda') return 'Nessuna scheda ha questo codice fiscale: scrivilo nella scheda della persona.'
  return 'La riga ha dei dati che non vanno: controllala nel foglio.'
}

/** I conti di COSA ENTRA nell'anteprima dell'import: [numero, parole]. */
export function contiImport(e: Pick<EsitoImportTessere, 'nuove' | 'gia_presenti' | 'non_abbinate'>): Array<[string, string]> {
  const n = e.non_abbinate.length
  return [
    [String(e.nuove), e.nuove === 1 ? 'tessera nuova' : 'tessere nuove'],
    [String(e.gia_presenti), 'già in app, non cambiano'],
    [String(n), n === 1 ? 'riga non abbinata' : 'righe non abbinate'],
  ]
}

/** Le parole di un nome, in maiuscolo, senza accenti né apostrofi, in ordine: «GULLI' ANNA» e «Anna Gullì» sono lo stesso nome (come `parole_nome` del database). */
export const paroleNome = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ')

const TIPI: TipoTessera[] = ['praticante', 'agonista', 'dirigente', 'tecnico', 'altro']

/**
 * L'import dal foglio come lo fa `importa_tessere`, per la modalità prova:
 * aggancia la persona dal codice fiscale E dallo stesso nome, non crea
 * nessuno, non ripete una tessera che c'è già (neanche dentro lo stesso
 * foglio) e dice cosa scriverebbe. Le righe che non vanno finiscono in
 * `non_abbinate` col motivo.
 */
export function importaTessereProva(
  righe: Array<Omit<RigaRasd, 'tipo'> & { tipo: string }>,
  schede: Array<{ personaId: string; nome: string; cognome: string; codiceFiscale?: string }>,
  esistenti: Array<Pick<TesseraSeg, 'personaId' | 'ente' | 'tipo' | 'dal' | 'al'>>,
): { esito: EsitoImportTessere; daScrivere: Array<Omit<TesseraSeg, 'id'> & { personaId: string; codice: string }> } {
  if (righe.length > 2000) throw new Error('Il foglio ha più di 2000 righe: dividilo in due')
  const non_abbinate: EsitoImportTessere['non_abbinate'] = []
  const daScrivere: Array<Omit<TesseraSeg, 'id'> & { personaId: string; codice: string }> = []
  const viste = new Set(esistenti.map((t) => `${t.personaId}|${t.ente}|${t.tipo}|${t.dal}`))
  let gia = 0
  // Una data che non c'è (30 febbraio) il database la rifiuta: Date la sposterebbe a marzo, quindi si rilegge.
  const dataVera = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d && d >= '2000-01-01' && d <= '2100-12-31'
  for (const r of righe) {
    const ente = r.ente.trim().toUpperCase()
    const cf = r.codice_fiscale.trim().toUpperCase()
    const nome = r.nome.trim()
    const codice = r.codice.trim()
    const dato = { nome, codice_fiscale: cf, ente }
    if (ente.length < 1 || ente.length > 40 || !TIPI.includes(r.tipo as TipoTessera) || codice.length < 1 || codice.length > 20 || !dataVera(r.dal) || !dataVera(r.al) || r.al < r.dal) {
      non_abbinate.push({ ...dato, esito: 'riga_non_valida' })
      continue
    }
    const chi = schede.find((s) => s.codiceFiscale === cf && paroleNome(`${s.nome} ${s.cognome}`) === paroleNome(nome))
    if (!chi) {
      non_abbinate.push({ ...dato, esito: schede.some((s) => s.codiceFiscale === cf) ? 'nome_diverso' : 'nessuna_scheda' })
      continue
    }
    const chiave = `${chi.personaId}|${ente}|${r.tipo}|${r.dal}`
    if (viste.has(chiave)) {
      gia++
      continue
    }
    viste.add(chiave)
    daScrivere.push({ personaId: chi.personaId, ente, tipo: r.tipo as TipoTessera, codice, dal: r.dal, al: r.al, origine: 'rasd' })
  }
  return { esito: { nuove: daScrivere.length, gia_presenti: gia, non_abbinate, scritto: false }, daScrivere }
}

/** L'ente scritto da chi usa l'app: in maiuscolo, o niente se è vuoto. */
export const enteDaDati = (ente?: string): string | undefined => ente?.trim().toUpperCase() || undefined

/** L'errore di un database dove `61-tessere.sql` non è ancora passato (tabella, colonna o funzione che non ci sono). */
export function mancaTessere(e: { code?: string; message?: string } | null | undefined): boolean {
  return !!e && ['42703', '42P01', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205'].includes(e.code ?? '') && /tessere|ente_tessera/.test(e.message ?? '')
}

/** Chi non ha la tessera che il suo corso chiede (manca o scaduta): quello che dice il filtro SENZA TESSERA e la casella TESSERE. */
export const senzaTessera = (righe: RigaIncrocio[]) => righe.some((r) => r.esito === 'manca' || r.esito === 'scaduta')

/**
 * Le parole di IN REGOLA con quelle della tessera: se manca o è scaduta c'è
 * il rosso, se scade presto il giallo, e «IN REGOLA» resta solo se tutto torna.
 * Le righe sono quelle dell'incrocio della persona: senza corsi che la
 * chiedono non c'è niente da dire.
 */
export function paroleConTessera<P extends { tono: string; parola: string }>(parole: P[], righe: RigaIncrocio[]): Array<P | { tono: 'rosso' | 'giallo'; parola: string }> {
  const nuove: Array<{ tono: 'rosso' | 'giallo'; parola: string }> = []
  for (const r of righe) {
    if (r.esito === 'non_iscritto') continue
    const p = parolaTessera(r.esito, r.tesseraAl)
    if (p && !nuove.some((x) => x.parola === p.parola)) nuove.push(p)
  }
  if (!nuove.length) return parole
  // In questa lista il verde è solo «In regola»: se la tessera manca o scade non c'è più.
  return [...parole.filter((x) => x.tono !== 'verde'), ...nuove]
}

/** Una tessera da sola, per le sue date: quella dello stato di una persona è `statoTessera`. */
export function statoDiUna(t: Pick<TesseraSeg, 'al'>, oggi: string): 'scaduta' | 'in_scadenza' | 'valida' {
  if (t.al < oggi) return 'scaduta'
  return giorniTra(oggi, t.al) <= GIORNI_IN_SCADENZA ? 'in_scadenza' : 'valida'
}

const GRAVITA: Record<StatoTessera, number> = { manca: 3, scaduta: 2, in_scadenza: 1, valida: 0 }
const dataBreve = (g: string) => g.split('-').reverse().join('/')

/**
 * Il timbro TESSERA in cima alla scheda, come quelli del certificato e della
 * quota: la parola, e una riga per ente. Niente se nessun corso della persona
 * la chiede. Con più enti vale il peggiore.
 */
export function timbroTessera(
  p: PersonaPerTessere,
  corsi: Array<Pick<CorsoSeg, 'id' | 'nome'> & { enteTessera?: string | null }>,
  oggi: string,
): { tono: 'rosso' | 'giallo' | 'verde'; parola: string; righe: Array<{ testo: string }> } | null {
  const richieste = tessereRichieste(p, corsi, oggi)
  if (!richieste.size) return null
  const tessere = p.tessere ?? []
  const stati = [...richieste].map(([ente, nomi]) => ({ ente, nomi, stato: statoTessera(tessere, ente, oggi), al: fineTessera(tessere, ente) }))
  const peggiore = stati.reduce((m, x) => (GRAVITA[x.stato] > GRAVITA[m.stato] ? x : m))
  const righe = stati.map((x) => ({
    testo:
      x.stato === 'manca'
        ? `${x.ente} · ${x.nomi.join(', ')}`
        : x.stato === 'scaduta'
          ? `${x.ente} · scaduta il ${dataBreve(x.al!)}`
          : `${x.ente} · fino al ${dataBreve(x.al!)}${x.stato === 'in_scadenza' ? `, fra ${giorniTra(oggi, x.al!)} ${giorniTra(oggi, x.al!) === 1 ? 'giorno' : 'giorni'}` : ''}`,
  }))
  if (peggiore.stato === 'valida') return { tono: 'verde', parola: 'IN REGOLA', righe }
  if (peggiore.stato === 'in_scadenza') return { tono: 'giallo', parola: `SCADE A ${MESI[Number(peggiore.al!.slice(5, 7)) - 1]}`, righe }
  return { tono: 'rosso', parola: peggiore.stato === 'manca' ? 'NO TESSERA' : 'SCADUTA', righe }
}

export type ListaTessere = 'senza' | 'mai' | 'scadute' | 'senza-corso'

/** Le righe di una lista della pagina TESSERE: chi non l'ha (manca, scaduta, in scadenza), chi non l'ha mai avuta, chi l'ha scaduta, chi è tesserato senza corso. */
export function righeDellaLista(righe: RigaIncrocio[], lista: ListaTessere): RigaIncrocio[] {
  const esiti: Record<ListaTessere, EsitoIncrocio[]> = {
    senza: ['manca', 'scaduta', 'in_scadenza'],
    mai: ['manca'],
    scadute: ['scaduta'],
    'senza-corso': ['non_iscritto'],
  }
  return righe.filter((r) => esiti[lista].includes(r.esito))
}
