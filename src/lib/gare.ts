/**
 * Le gare della palestra: chi ci va, il certificato alla data della gara, la
 * quota a voci. Le regole del database (vincoli, RLS, `incassa_gara`) sono in
 * `supabase/114-gare.sql`; le prove in `scripts/prova-gare.mjs`.
 * I soldi sono centesimi, le date `AAAA-MM-GG`.
 */
import { VOCE_GARE } from './contabilita'
import { paroleCercate, somiglia } from './nomi'
import type { DatiPagamentoDiretto, RigaPagamento } from './pagamenti'
import { chiaveGiorno, dataLunga, GIORNI } from './sala'
import { centesimi } from './ricevute'
import { ilGiorno } from './vestiario'
import { inCorso, statoCertificato, type CorsoSeg, type PersonaSeg, type StatoCertificato } from './segreteria'

export interface VoceGara {
  voce: string
  importo: number
}

/** Quel che l'atleta ha pagato, con le voci di quel momento: se dopo la quota cambia, il suo pagamento no. */
export interface PagamentoGara {
  importo: number
  voci: VoceGara[]
  metodo: string
  data: string
}

export interface Gara {
  id: string
  nome: string
  dal: string
  /** L'ultimo giorno, per una gara di più giorni. */
  al?: string
  luogo?: string
  indirizzo?: string
  organizzatore?: string
  note?: string
  annullata: boolean
  /** La quota a atleta, a voci: ogni atleta le paga tutte. */
  voci: VoceGara[]
  /** Gli istruttori che ci vanno, per id persona. */
  accompagnatori: string[]
}

export interface AtletaGara {
  garaId: string
  personaId: string
  /** Categoria, peso, quel che serve: la palestra ci scrive lì. */
  nota?: string
  pagamento?: PagamentoGara
}

const DATA = /^\d{4}-\d{2}-\d{2}$/
// Gli anni dei vincoli di 114-gare.sql.
const dataVera = (g: string) => DATA.test(g) && chiaveGiorno(new Date(g + 'T12:00:00')) === g && g >= '2000-01-01' && g <= '2100-12-31'
const troppo = (s: string | undefined, max: number) => (s?.trim().length ?? 0) > max

/** Cosa manca per salvare una gara, detto a chi la scrive; `null` se va bene. I limiti sono quelli di 114-gare.sql. */
export function cosaNonVaGara(g: Pick<Gara, 'nome' | 'dal' | 'al' | 'voci' | 'luogo' | 'indirizzo' | 'organizzatore' | 'note'>): string | null {
  if (!g.nome.trim()) return 'Scrivi il nome della gara.'
  if (troppo(g.nome, 120)) return 'Il nome della gara è troppo lungo: al massimo 120 lettere.'
  if (!g.dal) return 'Scegli la data della gara.'
  if (!dataVera(g.dal)) return 'La data della gara non esiste: sceglila dal calendario.'
  if (g.al && !dataVera(g.al)) return 'La data di fine non esiste: sceglila dal calendario.'
  if (g.al && g.al < g.dal) return 'La data di fine viene prima dell’inizio: correggila.'
  if (troppo(g.luogo, 200)) return 'Il luogo è troppo lungo: al massimo 200 lettere.'
  if (troppo(g.indirizzo, 300)) return 'L’indirizzo è troppo lungo: al massimo 300 lettere.'
  if (troppo(g.organizzatore, 200)) return 'Chi organizza è scritto troppo lungo: al massimo 200 lettere.'
  if (troppo(g.note, 2000)) return 'Le note sono troppo lunghe: al massimo 2000 lettere.'
  if (g.voci.some((v) => !v.voce.trim())) return 'Ogni voce della quota ha bisogno di un nome: scrivilo o togli la voce.'
  if (g.voci.some((v) => troppo(v.voce, 120))) return 'Il nome di una voce è troppo lungo: al massimo 120 lettere.'
  if (g.voci.some((v) => !(v.importo > 0))) return 'Ogni voce della quota ha bisogno di un importo più di zero.'
  if (g.voci.some((v) => v.importo > 10_000_000)) return 'L’importo di una voce è troppo alto: al massimo 100.000 €.'
  return null
}

/** La nota su un atleta (categoria, peso): `null` se va bene. */
export const cosaNonVaNota = (nota: string) => (troppo(nota, 300) ? 'La nota è troppo lunga: al massimo 300 lettere.' : null)

export const ultimoGiorno = (g: Pick<Gara, 'dal' | 'al'>) => g.al || g.dal

const giornoDetto = (g: string) => `${GIORNI[new Date(g + 'T12:00:00').getDay()]} ${dataLunga(g, false)}`

/** «sabato 14 novembre 2026», o «sabato 14 e domenica 15 novembre 2026» per due giorni. */
export function dateGara(g: Pick<Gara, 'dal' | 'al'>): string {
  const fine = ultimoGiorno(g)
  const anno = fine.slice(0, 4)
  if (fine === g.dal) return `${giornoDetto(g.dal)} ${anno}`
  const stessoMese = fine.slice(0, 7) === g.dal.slice(0, 7)
  const inizio = stessoMese ? `${GIORNI[new Date(g.dal + 'T12:00:00').getDay()]} ${Number(g.dal.slice(8))}` : giornoDetto(g.dal)
  return `${inizio} e ${giornoDetto(fine)} ${anno}`
}

/** Una gara è passata dal giorno dopo l'ultimo: quella in corso viene ancora. Le annullate restano. */
export function ordinaGare<G extends Gara>(gare: G[], oggi: string): { prossime: G[]; passate: G[] } {
  const prossime = gare.filter((g) => ultimoGiorno(g) >= oggi).sort((a, b) => a.dal.localeCompare(b.dal))
  const passate = gare.filter((g) => ultimoGiorno(g) < oggi).sort((a, b) => b.dal.localeCompare(a.dal))
  return { prossime, passate }
}

/** Le gare di I MIEI → GARE per l'istruttore: le prossime, senza le annullate. */
export const gareDaAccompagnare = <G extends Gara>(gare: G[], oggi: string) => ordinaGare(gare, oggi).prossime.filter((g) => !g.annullata)

/** Una gara passata resta nello storico: si cancella solo finché non è finita. */
export const eliminabile = (g: Pick<Gara, 'dal' | 'al'>, oggi: string) => ultimoGiorno(g) >= oggi

/** Chi si può aggiungere: gli attivi che somigliano a quel che si scrive; chi c'è già è segnato. */
export function candidatiGara(persone: PersonaSeg[], atleti: AtletaGara[], cerca: string) {
  const parole = paroleCercate(cerca)
  const dentro = new Set(atleti.map((a) => a.personaId))
  return persone.filter((p) => p.attiva && somiglia(p, parole)).map((persona) => ({ persona, giaDentro: dentro.has(persona.id) }))
}

/** Un elenco nuovo con chi si aggiunge: solo persone attive, mai due volte nella stessa gara. */
export function aggiungiAtleti(atleti: AtletaGara[], garaId: string, personaIds: string[], persone: PersonaSeg[]): AtletaGara[] {
  const dentro = new Set(atleti.filter((a) => a.garaId === garaId).map((a) => a.personaId))
  const nuovi: AtletaGara[] = []
  for (const id of personaIds) {
    if (dentro.has(id) || !persone.some((p) => p.id === id && p.attiva)) continue
    dentro.add(id)
    nuovi.push({ garaId, personaId: id })
  }
  return [...atleti, ...nuovi]
}

/**
 * Due schede unite: le gare di chi va via passano a chi resta, una riga per
 * gara. Come i trigger `gare_atleti_unione` e `gare_accompagnatori_unione`:
 * se c'erano tutti e due resta la riga di chi resta, col pagamento e la nota
 * dell'altra dove la sua non li ha.
 */
export function unisciGare<G extends Pick<Gara, 'accompagnatori'>>(d: { gare: G[]; atleti: AtletaGara[] }, via: string, resta: string): { gare: G[]; atleti: AtletaGara[] } {
  const atleti = d.atleti.filter((a) => a.personaId !== via)
  for (const a of d.atleti.filter((x) => x.personaId === via)) {
    const i = atleti.findIndex((x) => x.garaId === a.garaId && x.personaId === resta)
    if (i < 0) atleti.push({ ...a, personaId: resta })
    else atleti[i] = { ...atleti[i], pagamento: atleti[i].pagamento ?? a.pagamento, nota: atleti[i].nota ?? a.nota }
  }
  const gare = d.gare.map((g) => (g.accompagnatori.includes(via) ? { ...g, accompagnatori: [...new Set(g.accompagnatori.map((x) => (x === via ? resta : x)))] } : g))
  return { gare, atleti }
}

/** I corsi che fa adesso, per distinguere due omonimi. */
export const corsoDi = (p: PersonaSeg | undefined, corsi: CorsoSeg[], oggi: string) =>
  (p?.iscrizioni ?? [])
    .filter((i) => inCorso(i, oggi))
    .flatMap((i) => corsi.find((c) => c.id === i.corsoId)?.nome ?? [])
    .join(' · ')

/** Il certificato di oggi, guardato all'ultimo giorno della gara: uno non confermato non ha `scade`, quindi manca. */
export const certificatoAllaGara = (p: PersonaSeg, g: Pick<Gara, 'dal' | 'al'>): StatoCertificato => statoCertificato(p, ultimoGiorno(g))

export interface RigaAtletaGara {
  personaId: string
  nome: string
  cognome: string
  annoNascita?: number
  certificato: StatoCertificato
  /** La scadenza scritta dalla segreteria, e se c'è un file mandato dall'iscritto da confermare. */
  scade?: string
  daConfermare: boolean
  senzaCertificatoValido: boolean
  nota?: string
  pagata: boolean
}

/** Gli atleti di una gara, per cognome e nome. Solo questi campi: di un minore niente genitore né contatti. */
export function righeGara(g: Gara, atleti: AtletaGara[], persone: PersonaSeg[]): RigaAtletaGara[] {
  return atleti
    .filter((a) => a.garaId === g.id)
    .flatMap((a) => {
      const p = persone.find((x) => x.id === a.personaId)
      if (!p) return []
      const certificato = certificatoAllaGara(p, g)
      return [{
        personaId: p.id,
        nome: p.nome,
        cognome: p.cognome,
        annoNascita: p.natoIl ? Number(p.natoIl.slice(0, 4)) : undefined,
        certificato,
        scade: p.certificato.scade,
        daConfermare: !!p.certificato.inAttesaIl,
        // Anche chi è archiviato dopo la gara: lì conta la gara, non se frequenta ancora.
        senzaCertificatoValido: certificato === 'manca' || certificato === 'scaduto',
        nota: a.nota,
        pagata: !!a.pagamento,
      }]
    })
    .sort((a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'))
}

/** La cella CERTIFICATO: quel che c'è da fare, detto; `tipo` è il colore del tag (`sg-tag`). */
export function scrittaCertificato(r: Pick<RigaAtletaGara, 'certificato' | 'scade' | 'daConfermare'>): { testo: string; tipo?: 'fatto' | 'manca' | 'aspetta' } {
  const quando = r.scade ? `${ilGiorno(r.scade)} ${r.scade.slice(0, 4)}` : ''
  if (r.certificato === 'non_serve' || r.certificato === 'in_arrivo') return { testo: 'Non serve' }
  if (r.certificato === 'valido' || r.certificato === 'in_scadenza') return { testo: `Valido, scade ${quando}`, tipo: 'fatto' }
  // Il nuovo mandato dall'iscritto non vale finché la segreteria non lo conferma: è lì che si deve guardare.
  if (r.daConfermare) return { testo: 'Caricato, da confermare', tipo: 'aspetta' }
  return r.certificato === 'scaduto' ? { testo: `Scade ${quando}, prima della gara`, tipo: 'manca' } : { testo: 'Manca', tipo: 'manca' }
}

export function avvisoCertificati(righe: Pick<RigaAtletaGara, 'senzaCertificatoValido'>[]): string | null {
  const n = righe.filter((r) => r.senzaCertificatoValido).length
  return n ? `${n} ${n === 1 ? 'atleta' : 'atleti'} senza certificato valido` : null
}

/**
 * Il certificato nella gara dell'iscritto (LE MIE GARE): cosa fare e per quando, guardato all'ultimo giorno.
 * Uno mandato e non confermato non vale ancora, come per la segreteria. `null` se non serve.
 */
export function certificatoPerLaGara(p: { certificato: { scade?: string; inAttesaIl?: string }; natoIl?: string }, g: Pick<Gara, 'dal' | 'al'>): { testo: string; dettaglio?: string; guaio: boolean } | null {
  const stato = statoCertificato(p, ultimoGiorno(g))
  const giorno = (d: string) => dataLunga(d, false)
  const entro = `in segreteria prima del ${giorno(g.dal)}.`
  const scade = p.certificato.scade
  if (stato === 'non_serve' || stato === 'in_arrivo') return null
  if ((stato === 'valido' || stato === 'in_scadenza') && scade) return { testo: `Certificato: valido fino al ${giorno(scade)} ${scade.slice(0, 4)}`, guaio: false }
  if (p.certificato.inAttesaIl) return { testo: 'Certificato: caricato, la segreteria lo deve ancora confermare', dettaglio: 'Finché non lo conferma non vale per la gara.', guaio: true }
  if (stato === 'scaduto' && scade) return { testo: `Certificato: scade il ${giorno(scade)}`, dettaglio: `Scade prima della gara. Va rinnovato ${entro}`, guaio: true }
  return { testo: 'Certificato: manca', dettaglio: `Va portato ${entro}`, guaio: true }
}

export const totaleQuota = (voci: VoceGara[]) => voci.reduce((s, v) => s + v.importo, 0)

/** Il pagamento di un atleta: le voci di adesso, copiate. */
export function pagaGara(g: Pick<Gara, 'voci'>, { metodo, data }: { metodo: string; data: string }): PagamentoGara {
  if (!g.voci.length) throw new Error('La gara non ha una quota: aggiungi le voci prima di incassare.')
  return { importo: totaleQuota(g.voci), voci: g.voci.map((v) => ({ ...v })), metodo, data }
}

/**
 * Il pagamento appena incassato, per FAI LA RICEVUTA: una riga sola, «Gare»,
 * col totale (una riga per voce porterebbe l'incasso in «Corsi e altri pagamenti»).
 */
export function pagamentoPerRicevuta(g: Pick<Gara, 'nome' | 'voci'>, personaId: string, incasso: { metodo: string; data: string }, pagamentoId: string, chiaveRicevuta: string): DatiPagamentoDiretto {
  return { personaId, data: incasso.data, importo: pagaGara(g, incasso).importo, metodo: incasso.metodo, voce: VOCE_GARE, nota: g.nome, chiaveRicevuta, pagamentoId }
}

export function contiGara(g: Gara, atleti: AtletaGara[]) {
  const suoi = atleti.filter((a) => a.garaId === g.id)
  const totale = totaleQuota(g.voci)
  if (!totale) return { totale: 0, incassato: 0, daPagare: 0, pagati: 0, nonPagati: 0 }
  const pagati = suoi.filter((a) => a.pagamento).length
  const nonPagati = suoi.length - pagati
  return { totale, incassato: suoi.reduce((s, a) => s + (a.pagamento?.importo ?? 0), 0), daPagare: nonPagati * totale, pagati, nonPagati }
}

/** Il pagamento come riga di PAGAMENTI: da lì CONTABILITÀ lo porta in cassa con la voce «Gare». */
export function pagamentoComeRiga(g: Pick<Gara, 'id'>, persona: Pick<PersonaSeg, 'id' | 'nome' | 'cognome'>, pag: PagamentoGara): RigaPagamento {
  return {
    id: `gara:${g.id}:${persona.id}`,
    data: pag.data,
    importo: pag.importo,
    metodo: pag.metodo,
    voce: VOCE_GARE,
    personaId: persona.id,
    chi: `${persona.cognome} ${persona.nome}`,
    annullato: false,
  }
}

export interface ChiGuarda {
  ruolo: 'staff' | 'istruttore' | 'iscritto'
  personaId: string
  corsiInsegnati: string[]
}

/**
 * Di quali atleti può vedere la riga chi guarda, come le RLS di `114-gare.sql`:
 * l'iscritto sé e il suo nucleo (`iscritto_puo_vedere`, che lascia fuori chi
 * ha un account suo: in prova nessuno ce l'ha, come in `iscrittoProva.ts`);
 * l'istruttore i suoi atleti, con l'iscrizione ancora aperta, e tutti quelli
 * delle gare in cui accompagna (`riga_gara_dell_istruttore`).
 */
function rigaVisibile(chi: ChiGuarda, gare: Gara[], persone: PersonaSeg[]): (a: AtletaGara) => boolean {
  if (chi.ruolo === 'staff') return () => true
  if (chi.ruolo === 'iscritto') {
    const mie = new Set([chi.personaId, ...persone.filter((p) => p.nucleo === chi.personaId && p.attiva).map((p) => p.id)])
    return (a) => mie.has(a.personaId)
  }
  const corsi = new Set(chi.corsiInsegnati)
  const oggi = chiaveGiorno(new Date())
  const accompagna = new Set(gare.filter((g) => g.accompagnatori.includes(chi.personaId)).map((g) => g.id))
  return (a) => accompagna.has(a.garaId) || !!persone.find((p) => p.id === a.personaId)?.iscrizioni.some((i) => corsi.has(i.corsoId) && (!i.al || i.al >= oggi))
}

/** Le stesse regole delle RLS di `114-gare.sql`, per la modalità prova. */
export function gareVisibili(chi: ChiGuarda, gare: Gara[], atleti: AtletaGara[], persone: PersonaSeg[]): Gara[] {
  if (chi.ruolo === 'staff') return gare
  const vede = rigaVisibile(chi, gare, persone)
  return gare.filter((g) => (chi.ruolo === 'istruttore' && g.accompagnatori.includes(chi.personaId)) || atleti.some((a) => a.garaId === g.id && vede(a)))
}

/**
 * Gli atleti delle gare viste, con le righe che chi guarda può vedere;
 * l'istruttore senza il pagamento, che nel database legge solo da
 * `gare_pagamenti()` (e a lui non dà niente).
 */
export function atletiVisibili(chi: ChiGuarda, viste: Gara[], atleti: AtletaGara[], persone: PersonaSeg[]): AtletaGara[] {
  const ids = new Set(viste.map((g) => g.id))
  const vede = rigaVisibile(chi, viste, persone)
  const sue = atleti.filter((a) => ids.has(a.garaId) && vede(a))
  return chi.ruolo === 'istruttore' ? sue.map(({ pagamento: _, ...a }) => a) : sue
}

/** I corsi in cui insegna un istruttore: le sue gare partono da lì. */
export const corsiInsegnati = (corsi: Pick<CorsoSeg, 'id' | 'istruttori'>[], personaId: string) => corsi.filter((c) => c.istruttori.some((i) => i.id === personaId)).map((c) => c.id)

export interface GaraMia {
  gara: Gara
  personaId: string
  /** La nota della segreteria su questo atleta: la categoria, il peso. */
  nota?: string
  voci: VoceGara[]
  totale: number
  pagata: boolean
  daPagare: number
}

/** Le gare dell'iscritto e del suo nucleo: le sue voci e quanto deve, niente degli altri atleti. */
export function leMieGare(personeIds: string[], gare: Gara[], atleti: AtletaGara[]): GaraMia[] {
  return atleti
    .filter((a) => personeIds.includes(a.personaId))
    .flatMap((a) => {
      const gara = gare.find((g) => g.id === a.garaId)
      if (!gara) return []
      const voci = a.pagamento?.voci ?? gara.voci
      const totale = totaleQuota(voci)
      return [{ gara, personaId: a.personaId, nota: a.nota, voci, totale, pagata: !!a.pagamento, daPagare: a.pagamento ? 0 : totale }]
    })
}

/** Le mie gare: le prossime dalla più vicina; poi le passate e le annullate, dalla più recente. */
export function dividiMieGare(mie: GaraMia[], oggi: string): { prossime: GaraMia[]; passate: GaraMia[] } {
  const ordinate = [...mie].sort((a, b) => a.gara.dal.localeCompare(b.gara.dal))
  const prossime = ordinate.filter((m) => !m.gara.annullata && ultimoGiorno(m.gara) >= oggi)
  return { prossime, passate: ordinate.filter((m) => !prossime.includes(m)).reverse() }
}

/** La scheda della gara come si scrive: gli importi sono testo, AL può essere uguale a DAL. */
export interface BozzaGara {
  nome: string
  dal: string
  al: string
  luogo: string
  indirizzo: string
  organizzatore: string
  note: string
  voci: { voce: string; importo: string }[]
  accompagnatori: string[]
}

/** La gara da salvare dalla scheda, o cosa non va detto a chi la scrive. */
export function garaDaBozza(b: BozzaGara, { id, annullata }: { id?: string; annullata: boolean }): { gara?: Omit<Gara, 'id'> & { id?: string }; errore?: string } {
  const importi = b.voci.map((v) => centesimi(v.importo))
  const sbagliata = b.voci.findIndex((v, i) => v.voce.trim() && v.importo.trim() && importi[i] === null)
  if (sbagliata >= 0) return { errore: `L’importo della voce ${b.voci[sbagliata].voce.trim()} non è un numero: scrivilo come 25 o 25,50.` }
  const voci = b.voci.flatMap((v, i) => (v.voce.trim() || importi[i] ? [{ voce: v.voce, importo: importi[i] ?? 0 }] : []))
  const gara = { id, nome: b.nome, dal: b.dal, al: b.al && b.al !== b.dal ? b.al : undefined, luogo: b.luogo, indirizzo: b.indirizzo, organizzatore: b.organizzatore, note: b.note, annullata, voci, accompagnatori: b.accompagnatori }
  const errore = cosaNonVaGara(gara)
  return errore ? { errore } : { gara }
}

/** Le gare di una settimana, coi soli giorni che ci cadono; in ordine di primo giorno. */
export function gareDellaSettimana(gare: Gara[], lunedi: Date): { gara: Gara; giorni: string[] }[] {
  const settimana = Array.from({ length: 7 }, (_, i) => chiaveGiorno(new Date(lunedi.getFullYear(), lunedi.getMonth(), lunedi.getDate() + i)))
  return gare
    .map((gara) => ({ gara, giorni: settimana.filter((d) => d >= gara.dal && d <= ultimoGiorno(gara)) }))
    .filter((x) => x.giorni.length)
    .sort((a, b) => a.giorni[0].localeCompare(b.giorni[0]))
}

/** I luoghi o gli organizzatori già scritti che contengono quel che si scrive: dal più usato. */
export function suggerimenti(gare: Gara[], campo: 'luogo' | 'organizzatore', scritto: string): string[] {
  const cerca = scritto.trim().toLowerCase()
  const conto = new Map<string, { testo: string; volte: number }>()
  for (const g of gare) {
    const t = g[campo]?.trim()
    if (!t) continue
    const k = t.toLowerCase()
    const c = conto.get(k)
    if (c) c.volte++
    else conto.set(k, { testo: t, volte: 1 })
  }
  return [...conto.entries()]
    .filter(([k]) => k.includes(cerca))
    .sort(([ka, a], [kb, b]) => b.volte - a.volte || Number(kb.startsWith(cerca)) - Number(ka.startsWith(cerca)) || a.testo.localeCompare(b.testo, 'it'))
    .map(([, c]) => c.testo)
}

/** La ricerca di Google Maps: non chiede chiave. */
export function linkMappa(indirizzo?: string): string | null {
  const t = indirizzo?.trim()
  return t ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}` : null
}

type Prendi = (url: string, o: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; json(): Promise<unknown> }>

interface RispostaPlaces {
  suggestions?: { placePrediction?: { text?: { text?: string } } }[]
}

/**
 * Gli indirizzi che Google Places (New) suggerisce per quel che si scrive; senza chiave, o se Google non risponde,
 * nessuno: il campo resta testo libero. Una chiamata, senza script di Google nella pagina (vedi `csp.ts`).
 */
export async function indirizziGoogle(scritto: string, chiave: string | undefined, prendi: Prendi = fetch): Promise<string[]> {
  const input = scritto.trim()
  if (!chiave || input.length < 3) return []
  try {
    const r = await prendi('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chiave },
      body: JSON.stringify({ input, languageCode: 'it', includedRegionCodes: ['it'] }),
    })
    if (!r.ok) return []
    // La forma della risposta è quella documentata da Google; quel che manca si salta sotto.
    const { suggestions = [] } = (await r.json()) as RispostaPlaces
    return suggestions.flatMap((s) => (s.placePrediction?.text?.text ? [s.placePrediction.text.text] : []))
  } catch {
    return []
  }
}
