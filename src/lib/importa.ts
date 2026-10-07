import type { Anagrafica, CorsoSeg, DatiSegreteria, PersonaSeg, PersonaleSeg, Sala, StatoBackup } from './segreteria'
import { chiaveGiorno } from './sala'
import { anni } from './richieste'
import { compatto, paroleDelNome } from './nomi'
import { STRUTTURA_CF, cfTornaColNome, cfTornaConLaData, cfValido, lettereCognome, lettereNome } from './codiceFiscale'

/**
 * L'import dei fogli Excel, dalla segreteria.
 *
 * Legge gli stessi due fogli di `scripts/importa.mjs` — `corsi.csv` e
 * `iscritti.csv`, col punto e virgola o la virgola, col BOM o senza — ma
 * invece di scrivere SQL da incollare fa le stesse operazioni che la
 * segreteria fa a mano: dal browser l'SQL non si può lanciare. Come lo
 * script, si può rifare quante volte si vuole: quello che c'è già si
 * riconosce (i corsi e le sale per nome, le persone per email o per nome e
 * cognome) e non si duplica.
 *
 * Una cosa in più dello script: un istruttore scritto col nome soltanto si
 * lega a chi ha quel nome, se in palestra ce n'è uno solo.
 */

const GIORNI: Record<string, number> = {
  domenica: 0, dom: 0, lunedi: 1, lun: 1, martedi: 2, mar: 2, mercoledi: 3, mer: 3,
  giovedi: 4, gio: 4, venerdi: 5, ven: 5, sabato: 6, sab: 6,
}

/** Via accenti e maiuscole: «Martedì», «MARTEDI» e «martedi» sono lo stesso giorno. */
export const piatto = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Un CSV che regge i campi fra virgolette, per nome di colonna (senza accenti né maiuscole). */
export function leggiCsv(testo: string): Array<Record<string, string>> {
  const t = leggiTabella(testo)
  const testa = t.testa.map(piatto)
  return t.righe.map((r) => Object.fromEntries(testa.map((h, i) => [h, r[i] ?? ''])))
}

export interface Tabella {
  /** L'intestazione com'è scritta: per il modulo Google è il testo delle domande. */
  testa: string[]
  righe: string[][]
}

/** Lo stesso CSV per posizione di colonna; il separatore si indovina dall'intestazione. */
export function leggiTabella(testo: string): Tabella {
  const pulito = testo.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const primaRiga = pulito.slice(0, pulito.indexOf('\n') + 1 || undefined)
  const sep = (primaRiga.match(/;/g) ?? []).length >= (primaRiga.match(/,/g) ?? []).length ? ';' : ','
  const righe: string[][] = []
  let campo = ''
  let riga: string[] = []
  let fra = false
  for (let i = 0; i < pulito.length; i++) {
    const c = pulito[i]
    if (fra) {
      if (c === '"' && pulito[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') fra = false
      else campo += c
    } else if (c === '"') fra = true
    else if (c === sep) {
      riga.push(campo)
      campo = ''
    } else if (c === '\n') {
      riga.push(campo)
      righe.push(riga)
      riga = []
      campo = ''
    } else campo += c
  }
  if (campo || riga.length) {
    riga.push(campo)
    righe.push(riga)
  }
  const testa = (righe.shift() ?? []).map((h) => h.trim())
  return { testa, righe: righe.map((r) => r.map((x) => x.trim())) }
}

export interface Saltata {
  foglio: 'corsi.csv' | 'iscritti.csv' | 'risposte'
  riga: number
  motivo: string
  /** Chi è la riga, com'è scritto nel foglio: serve a ritrovarla nell'elenco di quelle da sistemare. */
  nome?: string
}

interface CorsoFoglio {
  nome: string
  /** Quella della prima riga del corso: le altre righe possono dirne un'altra, per il loro giorno. */
  sala?: string
  istruttori: string[]
  capienza?: number
  colore?: string
  orari: Array<{ giorno: number; ora: string; durata: number; sala?: string }>
}

interface IscrittoFoglio {
  nome: string
  cognome: string
  email?: string
  telefono?: string
  corsi: string[]
  /**
   * L'email non basta a dire che è lei: dalle risposte del modulo è spesso
   * quella del genitore, uguale per due fratelli. Serve anche lo stesso nome.
   */
  soloStessoNome?: boolean
  /** Nascita, residenza e genitore: solo dalle risposte del modulo. */
  anagrafica?: Anagrafica
  /** Il foglio e la prima riga in cui compare: la segreteria la cerca lì. Le righe di due fogli diversi hanno lo stesso numero. */
  foglio: Saltata['foglio']
  riga: number
  /** Da quando è iscritto: il giorno della risposta nel modulo, `AAAA-MM-GG`. Senza, vale oggi. */
  iscrittoIl?: string
  /**
   * L'email era già di un altro (il fratello, nel foglio): non è la sua di
   * accesso, entra senza e la tiene come contatto (`44-email-contatto.sql`).
   */
  emailContatto?: string
  /** Di chi era quell'email nel foglio, per dirlo nel resoconto. */
  contattoDi?: string
}

/** Chi ha già quell'email in palestra: un iscritto, un istruttore o la segreteria. */
const diChiEmail = (email: string | undefined, persone: PersonaSeg[], personale: PersonaleSeg[]) =>
  email ? [...persone, ...personale].find((q) => q.email?.toLowerCase() === email) : undefined

export interface Fogli {
  corsi: CorsoFoglio[]
  iscritti: IscrittoFoglio[]
  righe: { corsi: number; iscritti: number; risposte?: number }
  saltate: Saltata[]
  /** Righe entrate, ma con qualcosa da sapere: un corso non riconosciuto, un'email già usata. */
  note?: Saltata[]
}

/** I telefoni letti per ogni scheda, con la riga: serve a dire quale è stato preso se sono diversi. */
const telefoniDi = new WeakMap<IscrittoFoglio, { lista: { riga: number; telefono: string }[]; nota: Saltata }>()

/**
 * Il telefono di una persona che sta su più righe: il primo scritto entra, e se una riga dopo ne ha
 * uno diverso (confronto sulle sole cifre) vale l'ultimo e una nota sola dice quali erano.
 */
function aggiungiTelefono(x: IscrittoFoglio, telefono: string, riga: number, foglio: Saltata['foglio'], note: Saltata[]) {
  if (!telefono) return
  const prima = telefoniDi.get(x)
  const cifre = (t: string) => t.replace(/\D/g, '')
  if (!prima) {
    x.telefono = telefono
    telefoniDi.set(x, { lista: [{ riga, telefono }], nota: { foglio, riga, motivo: '' } })
    return
  }
  if (cifre(telefono) === cifre(x.telefono ?? '')) return
  prima.lista.push({ riga, telefono })
  x.telefono = telefono
  const n = prima.lista.length
  prima.nota.riga = riga
  prima.nota.motivo = `${x.nome} ${x.cognome}: ${n === 2 ? 'due' : n} telefoni diversi (${prima.lista.map((l) => `riga ${l.riga}: ${l.telefono}`).join(', ')}), ho preso ${telefono}`
  if (!note.includes(prima.nota)) note.push(prima.nota)
}

/** Dai due testi ai corsi e agli iscritti, con le righe che non si capiscono messe da parte. */
export function leggiFogli(testoCorsi: string | null, testoIscritti: string | null, corsiGiaDentro: string[] = []): Fogli {
  const saltate: Saltata[] = []
  const note: Saltata[] = []
  const corsi = new Map<string, CorsoFoglio>()
  const righeCorsi = testoCorsi ? leggiCsv(testoCorsi) : []
  righeCorsi.forEach((r, i) => {
    const riga = i + 2
    if (!Object.values(r).some(Boolean)) return
    if (!r.nome) return saltate.push({ foglio: 'corsi.csv', riga, motivo: 'Manca il nome del corso' })
    const giorno = /^\d$/.test(r.giorno ?? '') ? Number(r.giorno) : GIORNI[piatto(r.giorno ?? '')]
    if (giorno === undefined || giorno > 6) return saltate.push({ foglio: 'corsi.csv', riga, motivo: `«${r.nome}»: non capisco il giorno «${r.giorno ?? ''}»` })
    if (!/^\d{1,2}[:.]\d{2}$/.test(r.ora ?? '')) return saltate.push({ foglio: 'corsi.csv', riga, motivo: `«${r.nome}»: non capisco l'ora «${r.ora ?? ''}»` })
    const ora = r.ora.replace('.', ':').padStart(5, '0')
    const k = piatto(r.nome)
    const c = corsi.get(k) ?? {
      nome: r.nome,
      sala: r.sala || undefined,
      istruttori: (r.istruttore ?? '').split(',').map((x) => x.trim()).filter(Boolean),
      capienza: Number(r.capienza) || undefined,
      colore: r.colore || undefined,
      orari: [],
    }
    // La prima sala che si trova è quella del corso; una diversa è la sala di quel giorno.
    if (!c.sala && r.sala) c.sala = r.sala
    const sala = r.sala && c.sala && piatto(r.sala) !== piatto(c.sala) ? r.sala : undefined
    if (!c.orari.some((o) => o.giorno === giorno && o.ora === ora)) c.orari.push({ giorno, ora, durata: Number(r.durata) || 60, ...(sala ? { sala } : {}) })
    corsi.set(k, c)
  })

  const noti = new Set([...corsi.keys(), ...corsiGiaDentro.map(piatto)])
  const iscritti = new Map<string, IscrittoFoglio>()
  const perEmail = new Map<string, { chi: string; nome: string; riga: number }>()
  const notate = new Set<string>()
  let righeIscritti = testoIscritti ? leggiCsv(testoIscritti) : []
  // Il foglio delle risposte del modulo, caricato nella casella di iscritti.csv, non ha le colonne
  // nome e cognome: una riga sola lo dice, invece di una per ogni persona col nome «undefined».
  if (righeIscritti.length && !('nome' in righeIscritti[0] && 'cognome' in righeIscritti[0])) {
    saltate.push({
      foglio: 'iscritti.csv',
      riga: 1,
      motivo: `Le ${righeIscritti.length} righe di questo foglio non si leggono: mancano le colonne nome e cognome. Se è il foglio delle risposte del modulo Google, caricalo nella casella «risposte del modulo Google»`,
    })
    righeIscritti = []
  }
  righeIscritti.forEach((r, i) => {
    const riga = i + 2
    if (!Object.values(r).some(Boolean)) return
    if (!r.nome || !r.cognome) return saltate.push({ foglio: 'iscritti.csv', riga, nome: r.nome || r.cognome, motivo: `Manca ${r.nome ? 'il cognome' : 'il nome'}: «${r.nome || r.cognome}»${r.corso ? `, ${r.corso}` : ''}` })
    if (r.corso && !noti.has(piatto(r.corso))) return saltate.push({ foglio: 'iscritti.csv', riga, nome: `${r.nome} ${r.cognome}`, motivo: `Il corso «${r.corso}» non è fra i corsi` })
    const chi = `${compatto(r.nome)} ${compatto(r.cognome)}`
    let email = r.email?.toLowerCase() || undefined
    let emailContatto: string | undefined
    let contattoDi: string | undefined
    if (email) {
      const prima = perEmail.get(email)
      // Due fratelli con l'email del genitore: entrano tutti e due, il secondo senza email di accesso e con quella come contatto.
      if (prima && prima.chi !== chi) {
        // Una persona su più righe (un corso per riga) ha una nota sola.
        if (!notate.has(chi)) note.push({ foglio: 'iscritti.csv', riga, motivo: `${r.nome} ${r.cognome}: ${email} è già di ${prima.nome} (riga ${prima.riga}): la metto come email di contatto, senza email di accesso` })
        notate.add(chi)
        emailContatto = email
        contattoDi = prima.nome
        email = undefined
      } else perEmail.set(email, { chi, nome: `${r.nome} ${r.cognome}`, riga })
    }
    // L'email, quando c'è, è l'unica cosa che distingue davvero due omonimi.
    const k = email ?? chi
    const x = iscritti.get(k) ?? { nome: r.nome, cognome: r.cognome, email, corsi: [], foglio: 'iscritti.csv', riga, ...(emailContatto ? { emailContatto, contattoDi } : {}) }
    aggiungiTelefono(x, r.telefono ?? '', riga, 'iscritti.csv', note)
    if (r.corso && !x.corsi.some((c) => piatto(c) === piatto(r.corso))) x.corsi.push(r.corso)
    iscritti.set(k, x)
  })

  return {
    corsi: [...corsi.values()],
    iscritti: [...iscritti.values()],
    righe: { corsi: righeCorsi.length, iscritti: righeIscritti.length },
    saltate,
    note,
  }
}

/** Com'è il database prima dell'import: serve a dire cosa è nuovo e cosa c'è già. */
export interface Situazione {
  sale: Sala[]
  personale: PersonaleSeg[]
  corsi: CorsoSeg[]
  persone: PersonaSeg[]
}

export interface Anteprima {
  saleNuove: string[]
  istruttoriNuovi: string[]
  istruttoriTrovati: number
  /** Nome del foglio → persona già in palestra, o `null` se non si lega a nessuno. */
  istruttori: Map<string, string | null>
  corsiNuovi: string[]
  ricorrenzeNuove: number
  iscrittiNuovi: number
  iscrizioniNuove: number
  /** Gli iscritti con nascita, residenza o genitore da scrivere. */
  anagrafiche: number
  avvisi: string[]
  /** Gli iscritti che entrano senza email di accesso, perché la loro è già di un altro: una riga ciascuno, con la riga del foglio e di chi era. */
  emailDiAltri: string[]
  /** Dopo l'import: perché nascita, residenza e genitore non sono entrati. */
  anagraficheFuori?: string
}

const nomeCognome = (s: string) => {
  const p = s.trim().split(/\s+/)
  return p.length < 2 ? null : { nome: p.slice(0, -1).join(' '), cognome: p[p.length - 1] }
}

/** Chi sta scritto prima in una casella sola: il nome («Anna De Luca») o il cognome («De Luca Anna»). */
export type OrdineNome = 'nomeCognome' | 'cognomeNome'

/** Le parole che aprono un cognome e restano con lui: «De Luca», «Dal Pozzo», «Van Basten». */
const PARTICELLE = new Set(['de', 'di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'dal', 'dalla', 'da', 'lo', 'la', 'le', 'van', 'von', 'der', 'den'])
const particella = (w: string) => PARTICELLE.has(piatto(w))

/**
 * Nome e cognome da una casella sola, senza codice fiscale: il cognome è
 * l'ultima parola o la prima, a seconda dell'ordine, e si porta dietro le
 * particelle che lo precedono («Anna De Luca» → Anna, De Luca). Una parola
 * sola non si divide.
 */
function dividiPerOrdine(testo: string, ordine: OrdineNome): { nome: string; cognome: string } | null {
  const p = testo.trim().split(/\s+/).filter(Boolean)
  if (p.length < 2) return null
  if (ordine === 'nomeCognome') {
    let da = p.length - 1
    while (da > 1 && particella(p[da - 1])) da--
    return { nome: p.slice(0, da).join(' '), cognome: p.slice(da).join(' ') }
  }
  let fino = 1
  while (fino < p.length - 1 && particella(p[fino - 1])) fino++
  return { nome: p.slice(fino).join(' '), cognome: p.slice(0, fino).join(' ') }
}

/** L'ordine che dice l'intestazione della colonna: «COGNOME NOME ATLETA» → cognome prima; senza colonna o senza dirlo, nome prima. */
export function indovinaOrdine(testa: string[], col: Colonne): OrdineNome {
  const h = col.nomeCompleto === undefined ? '' : piatto(testa[col.nomeCompleto] ?? '')
  return /cognome\s*(e|,|\/)?\s*nome/.test(h) ? 'cognomeNome' : 'nomeCognome'
}

/** Cosa farebbe l'import, senza fare niente. */
export function anteprima(f: Fogli, s: Situazione, scelte: Scelte = {}): Anteprima {
  const avvisi: string[] = []
  const sale = new Set(s.sale.map((x) => piatto(x.nome)))
  const tutte = f.corsi.flatMap((c) => [c.sala, ...c.orari.map((o) => o.sala)]).filter((x): x is string => !!x)
  const saleNuove = [...new Map(tutte.map((x) => [piatto(x), x])).values()].filter((x) => !sale.has(piatto(x)))

  const istruttori = new Map<string, string | null>()
  const istruttoriNuovi: string[] = []
  let istruttoriTrovati = 0
  for (const nome of new Set(f.corsi.flatMap((c) => c.istruttori))) {
    const intero = s.personale.find((p) => piatto(`${p.nome} ${p.cognome}`) === piatto(nome))
    const soloNome = s.personale.filter((p) => piatto(p.nome) === piatto(nome))
    const trovato = intero ?? (soloNome.length === 1 ? soloNome[0] : undefined)
    if (trovato) {
      istruttori.set(nome, trovato.id)
      istruttoriTrovati++
    } else if (nomeCognome(nome)) {
      istruttori.set(nome, null)
      istruttoriNuovi.push(nome)
    } else {
      istruttori.set(nome, null)
      avvisi.push(
        soloNome.length > 1
          ? `«${nome}»: in palestra ce n'è più d'uno con questo nome, scrivi anche il cognome`
          : `«${nome}»: manca il cognome, il corso entra senza e lo si lega dopo`,
      )
    }
  }

  const corsiDentro = new Map(s.corsi.map((c) => [piatto(c.nome), c]))
  const corsiNuovi = f.corsi.filter((c) => !corsiDentro.has(piatto(c.nome))).map((c) => c.nome)
  let ricorrenzeNuove = 0
  for (const c of f.corsi) {
    const dentro = corsiDentro.get(piatto(c.nome))
    ricorrenzeNuove += c.orari.filter((o) => !dentro?.ricorrenze.some((r) => r.giorno === o.giorno && r.ora === o.ora)).length
  }

  let iscrittiNuovi = 0
  let iscrizioniNuove = 0
  const emailDiAltri: string[] = []
  const oggi = chiaveGiorno(new Date())
  for (const x of f.iscritti) {
    const sc = scelte[chiaveRiga(x)]
    const c = riconosci(x, s.persone, sc)
    // Chi aspetta una scelta non entra: non si conta.
    if (c.esito === 'da_sistemare') continue
    if (c.esito === 'nuova') {
      iscrittiNuovi++
      iscrizioniNuove += x.corsi.length
      const diChi = diChiEmail(x.email, s.persone, s.personale)
      const [indirizzo, di] = x.emailContatto ? [x.emailContatto, x.contattoDi] : [x.email, diChi && `${diChi.nome} ${diChi.cognome}`]
      if (indirizzo && di) emailDiAltri.push(`riga ${x.riga}: ${x.nome} ${x.cognome}, contatto ${indirizzo} (email di ${di})`)
      continue
    }
    if (!c.p.attiva && sc?.archiviato !== 'riattiva') continue
    for (const nome of x.corsi) {
      const corso = corsiDentro.get(piatto(nome))
      const dentro = corso && c.p.iscrizioni.find((i) => i.corsoId === corso.id)
      if (dentro?.al && dentro.al < oggi) {
        if (sc?.terminate === 'riapri') iscrizioniNuove++
      } else if (!dentro || dentro.al) iscrizioniNuove++
    }
  }
  const anagrafiche = f.iscritti.filter((x) => x.anagrafica && Object.keys(x.anagrafica).length > 0).length
  return { saleNuove, istruttoriNuovi, istruttoriTrovati, istruttori, corsiNuovi, ricorrenzeNuove, iscrittiNuovi, iscrizioniNuove, anagrafiche, avvisi, emailDiAltri }
}

function trovaPersona(x: IscrittoFoglio, persone: PersonaSeg[]) {
  // Senza accenti, maiuscole, apostrofi e spazi: «D’Angelo», «d'angelo» e «Dangelo»,
  // «De Luca» e «Deluca» sono lo stesso cognome.
  const stessoNome = (p: PersonaSeg) => compatto(p.nome) === compatto(x.nome) && compatto(p.cognome) === compatto(x.cognome)
  const perEmail = x.email ? persone.find((p) => p.email?.toLowerCase() === x.email) : undefined
  // L'email dice chi è solo se torna anche il nome: quella del genitore è
  // uguale per due fratelli, e il secondo non deve finire sulla scheda del primo.
  if (perEmail && stessoNome(perEmail)) return perEmail
  // Chi era entrato con quell'indirizzo come contatto (l'email era di un altro): rifacendo il foglio non si duplica.
  const perContatto = x.email ? persone.find((p) => p.emailContatto?.toLowerCase() === x.email && stessoNome(p)) : undefined
  if (perContatto) return perContatto
  // Dal foglio Excel un'email nuova è una persona nuova, anche se omonima.
  if (x.email && !perEmail && !x.soloStessoNome) return undefined
  return persone.find((p) => !p.email && stessoNome(p)) ?? persone.find(stessoNome)
}

/** La riga di un foglio, per chiave: «iscritti.csv:5» e «risposte:5» sono due righe diverse. */
export const chiaveRiga = (x: { foglio: Saltata['foglio']; riga: number }) => `${x.foglio}:${x.riga}`

/** Le scelte della segreteria sui dubbi, per riga: di base, senza scelta, non si tocca niente. */
export type Scelte = Record<string, { doppione?: 'lega' | 'nuova'; archiviato?: 'riattiva'; terminate?: 'riapri' }>

type Chi =
  | { esito: 'nuova' }
  | { esito: 'in_palestra'; p: PersonaSeg }
  | { esito: 'da_sistemare'; motivo: string; doppione?: PersonaSeg }

const paroleOrdinate = (nome: string, cognome: string) => paroleDelNome(`${nome} ${cognome}`).sort().join(' ')

/**
 * Chi è la riga del foglio: una persona già in palestra, una nuova, o una che
 * va guardata prima. Nome e cognome scambiati («Prudente Manuel» per «Manuel
 * Prudente») non si danno per nuovi in silenzio: la segreteria sceglie.
 */
function riconosci(x: IscrittoFoglio, persone: PersonaSeg[], scelta?: Scelte[string]): Chi {
  const p = trovaPersona(x, persone)
  if (p) return { esito: 'in_palestra', p }
  const doppione = persone.find(
    (q) =>
      (compatto(q.nome) === compatto(x.cognome) && compatto(q.cognome) === compatto(x.nome)) ||
      paroleOrdinate(q.nome, q.cognome) === paroleOrdinate(x.nome, x.cognome),
  )
  if (!doppione) return { esito: 'nuova' }
  if (scelta?.doppione === 'lega') return { esito: 'in_palestra', p: doppione }
  if (scelta?.doppione === 'nuova') return { esito: 'nuova' }
  return { esito: 'da_sistemare', motivo: `forse è già in palestra come ${doppione.nome} ${doppione.cognome}`, doppione }
}

/** I nomi dei corsi del foglio a cui la persona era iscritta e ha smesso. */
const terminate = (p: PersonaSeg, x: IscrittoFoglio, corsi: Map<string, CorsoSeg>, oggi: string) =>
  x.corsi.filter((nome) => {
    const c = corsi.get(piatto(nome))
    return !!c && p.iscrizioni.some((i) => i.corsoId === c.id && i.al && i.al < oggi)
  })

export type EsitoRiga = 'nuova' | 'in_palestra' | 'da_sistemare'

export interface RigaControllo {
  /** Il foglio e la riga: la segreteria la cerca lì. */
  foglio: Saltata['foglio']
  riga: number
  nome: string
  esito: EsitoRiga
  motivo?: string
  /** Cose da sapere anche se entra: archiviato, iscrizione terminata, senza email. */
  avvisi: string[]
  /** Se «forse è già in palestra»: chi. */
  doppione?: { id: string; nome: string }
  /** Già in palestra ma archiviato: la scelta è RIATTIVA o LASCIA. */
  archiviato?: boolean
  /** Già in palestra con iscrizioni finite a questi corsi: la scelta è RIAPRI o LASCIA. */
  terminate?: string[]
  /** Aspetta una scelta della segreteria. */
  chiedeScelta: boolean
}

/** Il controllo riga per riga, col nome, in ordine di riga del foglio, e i totali per tipo. */
export function controllaRighe(f: Fogli, s: Situazione): { righe: RigaControllo[]; totali: Record<EsitoRiga, number> } {
  const oggi = chiaveGiorno(new Date())
  const corsi = new Map(s.corsi.map((c) => [piatto(c.nome), c]))
  const righe: RigaControllo[] = f.saltate
    .filter((x) => x.foglio !== 'corsi.csv')
    .map((x) => ({ foglio: x.foglio, riga: x.riga, nome: x.nome ?? '', esito: 'da_sistemare' as const, motivo: x.motivo, avvisi: [], chiedeScelta: false }))
  for (const x of f.iscritti) {
    const c = riconosci(x, s.persone)
    const avvisi: string[] = []
    let archiviato = false
    let ferme: string[] = []
    if (x.emailContatto || (c.esito === 'nuova' && diChiEmail(x.email, s.persone, s.personale))) {
      avvisi.push('la sua email è già di un altro: entra senza email di accesso, e la tiene come email di contatto')
    }
    if (c.esito === 'in_palestra') {
      archiviato = !c.p.attiva
      if (archiviato) avvisi.push('è archiviato: resta archiviato e non lo iscrivo, a meno che tu scelga «Riattivala e iscrivila»')
      ferme = terminate(c.p, x, corsi, oggi)
      if (ferme.length) avvisi.push(`l'iscrizione a ${ferme.join(', ')} era terminata: resta terminata, a meno che tu scelga «Riapri»`)
    }
    righe.push({
      foglio: x.foglio,
      riga: x.riga,
      nome: `${x.nome} ${x.cognome}`,
      esito: c.esito,
      ...(c.esito === 'da_sistemare' ? { motivo: c.motivo, ...(c.doppione ? { doppione: { id: c.doppione.id, nome: `${c.doppione.nome} ${c.doppione.cognome}` } } : {}) } : {}),
      avvisi,
      ...(archiviato ? { archiviato } : {}),
      ...(ferme.length ? { terminate: ferme } : {}),
      chiedeScelta: c.esito === 'da_sistemare' || archiviato || ferme.length > 0,
    })
  }
  righe.sort((a, b) => a.foglio.localeCompare(b.foglio) || a.riga - b.riga)
  const totali = { nuova: 0, in_palestra: 0, da_sistemare: 0 }
  for (const r of righe) totali[r.esito]++
  return { righe, totali }
}

/** Quante righe del foglio entrano: quelle lette, meno le saltate e quelle che aspettano ancora una scelta. */
export function righeBuone(f: Fogli, c: { righe: RigaControllo[] }, scelte: Scelte): number {
  const lette = f.righe.corsi + f.righe.iscritti + (f.righe.risposte ?? 0)
  const inAttesa = c.righe.filter((r) => {
    if (f.saltate.some((x) => x.foglio === r.foglio && x.riga === r.riga)) return false
    const sc = scelte[chiaveRiga(r)]
    if (r.esito === 'da_sistemare') return !(r.doppione && sc?.doppione)
    return !!r.archiviato && sc?.archiviato !== 'riattiva'
  }).length
  return lette - f.saltate.length - inAttesa
}

/**
 * Cosa dire sul backup prima di importare: l'import scrive e non si disfa.
 * `stato` è quel che dice `backup()`, o `undefined` se non si è potuto leggere.
 * `avviso` è vero quando conviene farne uno prima: mai fatto, non riuscito,
 * o più vecchio di ieri (la copia da sé è settimanale).
 */
export function promemoriaBackup(stato: StatoBackup | undefined, adesso = new Date()): { testo: string; avviso: boolean } {
  const dove = 'IMPOSTAZIONI › IL BACKUP'
  if (!stato) return { testo: `Non riesco a leggere i backup: controlla da ${dove} prima di importare.`, avviso: true }
  const ultimo = stato.ultimo
  if (!ultimo) return { testo: `Non risulta nessun backup. Prima di importare, fanne uno da ${dove}.`, avviso: true }
  if (ultimo.stato === 'in_corso') return { testo: 'Un backup è in corso: aspetta che finisca, poi importa.', avviso: false }
  if (ultimo.stato === 'fallito') return { testo: `L'ultimo backup non è riuscito. Riprova da ${dove} prima di importare.`, avviso: true }
  // Giorni di calendario, non ore: un backup di ieri sera è «ieri».
  const giorni = Math.round((Date.parse(chiaveGiorno(adesso)) - Date.parse(chiaveGiorno(new Date(ultimo.quando)))) / 86_400_000)
  if (giorni <= 0) return { testo: 'Ultimo backup riuscito oggi.', avviso: false }
  if (giorni === 1) return { testo: 'Ultimo backup riuscito ieri.', avviso: false }
  return { testo: `Ultimo backup riuscito ${giorni} giorni fa. Se importi tanto, fanne uno nuovo da ${dove}.`, avviso: true }
}

export interface RigaSistemare {
  foglio: Saltata['foglio']
  riga: number
  nome: string
  motivo: string
}

export type Resoconto = Anteprima & { daSistemare: RigaSistemare[] }

/** Il testo del database non dice alla segreteria cosa fare: lo si traduce, e un messaggio già chiaro resta com'è. */
export function messaggioRiga(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/duplicate key|unique constraint/i.test(m)) return 'questa email è già di un\'altra persona: toglila dal foglio o cambiala e rilancia'
  if (/row-level|policy|permission denied|not authorized|jwt/i.test(m)) return 'non hai il permesso di scrivere questa riga: esci, rientra come segreteria e rilancia'
  if (/fetch|network|timeout|offline|load failed/i.test(m)) return 'la rete è caduta: controlla la connessione e rilancia, quello che è già entrato non si duplica'
  if (/violat|constraint|relation |column |syntax|null value|invalid input|pgrst|schema/i.test(m)) return 'il database non l\'ha accettata: controlla i dati della riga e rilancia; se si ripete, scrivilo in SEGNALAZIONI'
  // Un messaggio nostro è in italiano; quello che non riconosciamo non si mostra com'è.
  if (/\b(non|già|è|di|il|la|un|una|serve|manca|questa|questo|controlla|riprova)\b/i.test(m)) return m
  return 'la riga non è entrata: rilancia, e se si ripete scrivilo in SEGNALAZIONI'
}

/** Le righe non entrate, una per riga di testo. */
export const righeDaSistemare = (a: { daSistemare: RigaSistemare[] }) => a.daSistemare.map((r) => `${r.foglio}, riga ${r.riga}: ${r.nome} — ${r.motivo}`)

/**
 * Il resoconto di fine import, da leggere e da copiare per correggere il foglio.
 * Chi è entrato con l'email di un altro come contatto è da controllare, non da sistemare.
 */
export function testoResoconto(a: { daSistemare: RigaSistemare[]; emailDiAltri?: string[] }): string {
  const contatti = a.emailDiAltri ?? []
  const n = a.daSistemare.length + contatti.length
  if (!n) return 'FATTO'
  const come = contatti.length ? 'controllare' : 'sistemare'
  return [`FATTO, ${n} ${n === 1 ? 'riga' : 'righe'} da ${come}`, ...righeDaSistemare(a), ...contatti].join('\n')
}

/** La frase sotto il titolo del resoconto, quando qualcuno è entrato con l'email di un altro come contatto. */
export function fraseResoconto(a: { iscrittiNuovi: number; emailDiAltri: string[] }): string {
  const m = a.emailDiAltri.length
  return `${a.iscrittiNuovi === 1 ? 'È entrato 1 iscritto' : `Sono entrati ${a.iscrittiNuovi} iscritti`}. Per ${m} l'email era già di un'altra persona: ora è ${m === 1 ? 'la sua' : 'la loro'} email di contatto.`
}

/**
 * L'import vero. Va in ordine — sale, istruttori, corsi, giorni, iscritti — e
 * alla fine allunga il calendario una volta sola. `passo` dice a che punto è.
 * Una riga che non va non ferma le altre: finisce nel resoconto, col motivo.
 */
export async function importa(d: DatiSegreteria, f: Fogli, passo: (testo: string) => void, scelte: Scelte = {}): Promise<Resoconto> {
  const leggi = async (): Promise<Situazione> => {
    const [sale, personale, corsi, persone] = await Promise.all([d.sale(), d.personale(), d.corsi(), d.persone()])
    return { sale, personale, corsi, persone }
  }
  let s = await leggi()
  const a = anteprima(f, s, scelte)

  passo('Le sale…')
  for (const nome of a.saleNuove) await d.salvaSala({ nome })

  passo('Gli istruttori…')
  for (const nome of a.istruttoriNuovi) {
    const nc = nomeCognome(nome)!
    a.istruttori.set(nome, await d.salvaPersonale({ ...nc, ruolo: 'istruttore' }))
  }
  s = await leggi()
  const salaDi = new Map(s.sale.map((x) => [piatto(x.nome), x.id]))

  passo('I corsi e i loro giorni…')
  let corsi = new Map(s.corsi.map((c) => [piatto(c.nome), c]))
  for (const c of f.corsi) {
    const chi = c.istruttori.map((n) => a.istruttori.get(n)).filter((x): x is string => !!x)
    const dentro = corsi.get(piatto(c.nome))
    if (!dentro) {
      await d.salvaCorso({ nome: c.nome, salaId: c.sala ? salaDi.get(piatto(c.sala)) : undefined, istruttori: chi, capienza: c.capienza, colore: c.colore })
    } else if (chi.some((x) => !dentro.istruttori.some((i) => i.id === x))) {
      // Un corso che c'è già non si cambia: gli si aggiunge solo chi mancava fra gli istruttori.
      const tutti = [...dentro.istruttori.map((i) => i.id), ...chi.filter((x) => !dentro.istruttori.some((i) => i.id === x))]
      await d.salvaCorso({ id: dentro.id, nome: dentro.nome, salaId: dentro.salaId, istruttori: tutti, capienza: dentro.capienza, colore: dentro.colore })
    }
  }
  corsi = new Map((await d.corsi()).map((c) => [piatto(c.nome), c]))
  for (const c of f.corsi) {
    const dentro = corsi.get(piatto(c.nome))!
    for (const o of c.orari) {
      if (dentro.ricorrenze.some((r) => r.giorno === o.giorno && r.ora === o.ora)) continue
      const salaId = o.sala ? salaDi.get(piatto(o.sala)) : undefined
      await d.aggiungiRicorrenza(dentro.id, { giorno: o.giorno, ora: o.ora, durata: o.durata, salaId: salaId !== dentro.salaId ? salaId : undefined }, { rigenera: false })
    }
  }

  passo('Gli iscritti…')
  const daSistemare: RigaSistemare[] = f.saltate
    .filter((x) => x.foglio !== 'corsi.csv')
    .map((x) => ({ foglio: x.foglio, riga: x.riga, nome: x.nome ?? '', motivo: x.motivo }))
  const oggi = chiaveGiorno(new Date())
  const persone = [...s.persone]
  for (const x of f.iscritti) {
    const riga = x.riga
    const nome = `${x.nome} ${x.cognome}`
    const sc = scelte[chiaveRiga(x)]
    try {
      const c = riconosci(x, persone, sc)
      if (c.esito === 'da_sistemare') {
        daSistemare.push({ foglio: x.foglio, riga, nome, motivo: c.motivo })
        continue
      }
      let p: PersonaSeg
      if (c.esito === 'in_palestra') {
        p = c.p
        if (!p.attiva) {
          // Un archiviato resta com'è finché la segreteria non sceglie.
          if (sc?.archiviato !== 'riattiva') {
            daSistemare.push({ foglio: x.foglio, riga, nome, motivo: 'è archiviato: non l\'ho iscritto. Riattivalo tu, o rilancia scegliendo «Riattivala e iscrivila»' })
            continue
          }
          await d.attivaPersona(p.id, true)
        }
      } else {
        // L'email di accesso è di una persona sola: se è già di un altro (il
        // fratello, un istruttore), entra senza e la tiene come contatto.
        const presa = !!diChiEmail(x.email, persone, s.personale)
        const email = presa ? undefined : x.email
        const emailContatto = x.emailContatto ?? (presa ? x.email : undefined)
        const id = await d.salvaPersona({ nome: x.nome, cognome: x.cognome, email, emailContatto, telefono: x.telefono })
        p = { id, nome: x.nome, cognome: x.cognome, email, emailContatto, attiva: true, creataIl: '', iscrizioni: [], certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' } }
        persone.push(p)
      }
      const ferme: string[] = []
      for (const nomeCorso of x.corsi) {
        const corso = corsi.get(piatto(nomeCorso))
        if (!corso) continue
        const dentro = p.iscrizioni.find((i) => i.corsoId === corso.id)
        // Un'iscrizione finita non si riapre da sola: chi era uscito può non voler tornare.
        if (dentro?.al && dentro.al < oggi && sc?.terminate !== 'riapri') {
          ferme.push(nomeCorso)
          continue
        }
        // La data della risposta vale per un'iscrizione nuova; chi riapre riparte da oggi.
        await d.iscrivi(p.id, corso.id, dentro ? undefined : x.iscrittoIl)
      }
      if (ferme.length) daSistemare.push({ foglio: x.foglio, riga, nome, motivo: `l'iscrizione a ${ferme.join(', ')} era terminata: non l'ho riaperta. Rilancia scegliendo «Riapri» se serve` })
      if (x.anagrafica && Object.keys(x.anagrafica).length > 0 && !a.anagraficheFuori) {
        try {
          await d.salvaAnagrafica(p.id, x.anagrafica)
        } catch (e) {
          // Senza 18-anagrafiche.sql gli iscritti entrano lo stesso: si dice cosa è rimasto fuori.
          const m = e instanceof Error ? e.message : String(e)
          if (!/18-anagrafiche/.test(m)) throw e
          a.anagraficheFuori = m
        }
      }
    } catch (e) {
      daSistemare.push({ foglio: x.foglio, riga, nome, motivo: messaggioRiga(e) })
    }
  }

  passo('Il calendario…')
  await d.rigenera()
  return { ...a, daSistemare: daSistemare.sort((x, y) => x.foglio.localeCompare(y.foglio) || x.riga - y.riga) }
}

// ---------------------------------------------------------------------------
// Le risposte del modulo Google.
//
// Il foglio delle risposte, scaricato come CSV, ha per intestazione il testo
// delle domande, che cambia da un modulo all'altro: le colonne si indovinano
// e la segreteria le corregge, e così le scelte dei corsi («Judo 2 (nati
// 2017-2019)») si abbinano ai corsi veri. Da lì diventano iscritti come quelli
// del foglio Excel, e passano dallo stesso controllo e dallo stesso import:
// rifarlo col foglio che è cresciuto non duplica chi era già entrato.
// ---------------------------------------------------------------------------

export type Ruolo =
  | 'nome'
  | 'cognome'
  | 'nomeCompleto'
  | 'codiceFiscale'
  | 'email'
  | 'telefono'
  | 'corsi'
  | 'natoIl'
  | 'natoA'
  | 'comune'
  | 'indirizzo'
  | 'cap'
  | 'genitore'
  | 'genitoreCodiceFiscale'
  | 'genitoreNato'
  | 'dataRisposta'

export const RUOLI: Array<[Ruolo, string]> = [
  ['nome', 'NOME'],
  ['cognome', 'COGNOME'],
  ['nomeCompleto', 'NOME E COGNOME INSIEME'],
  ['codiceFiscale', 'CODICE FISCALE'],
  ['email', 'EMAIL'],
  ['telefono', 'TELEFONO'],
  ['corsi', 'CORSI'],
  ['natoIl', 'DATA DI NASCITA'],
  ['natoA', 'LUOGO DI NASCITA'],
  ['comune', 'COMUNE DI RESIDENZA'],
  ['indirizzo', 'INDIRIZZO'],
  ['cap', 'CAP'],
  ['genitore', 'GENITORE (NOME E COGNOME)'],
  ['genitoreCodiceFiscale', 'CODICE FISCALE DEL GENITORE'],
  ['genitoreNato', 'NASCITA DEL GENITORE'],
  ['dataRisposta', 'DATA DELLA RISPOSTA (DA QUANDO È ISCRITTO)'],
]

/** Ruolo → posizione della colonna. */
export type Colonne = Partial<Record<Ruolo, number>>

/** Le colonne che parlano del genitore: da lì email e telefono sì, il nome no. */
const DEL_GENITORE = /genitor|tutor|padre|madre|mamma|papa/

export function indovinaColonne(testa: string[]): Colonne {
  const h = testa.map(piatto)
  const trova = (ok: (x: string) => boolean) => {
    const i = h.findIndex((x, n) => ok(x) && !Object.values(c).includes(n))
    return i < 0 ? undefined : i
  }
  const c: Colonne = {}
  const persona = (x: string) => !DEL_GENITORE.test(x)
  c.nomeCompleto = trova((x) => persona(x) && /nome\s*(e|,|\/)?\s*cognome|cognome\s*(e|,|\/)?\s*nome/.test(x))
  if (c.nomeCompleto === undefined) {
    c.cognome = trova((x) => persona(x) && x.includes('cognome'))
    c.nome = trova((x) => persona(x) && /\bnome\b/.test(x) && !x.includes('cognome'))
  }
  c.codiceFiscale = trova((x) => persona(x) && /codice\s*fiscale|\bc\.?\s?f\.?(\s|$)/.test(x))
  c.email = trova((x) => /e-?mail|posta/.test(x))
  c.telefono = trova((x) => /telefono|cellulare|\bcell\b|recapito/.test(x))
  c.corsi = trova((x) => /corsi|corso|attivita|sport|disciplin/.test(x))
  c.natoIl = trova((x) => persona(x) && /data\s*(di\s*)?nascita|nat[oa]\s*il\b/.test(x))
  c.natoA = trova((x) => persona(x) && /luogo\s*(di\s*)?nascita|comune\s*di\s*nascita|nat[oa]\s*a\b/.test(x))
  c.comune = trova((x) => persona(x) && /citta|comune|localita/.test(x) && !/nascita/.test(x))
  c.indirizzo = trova((x) => persona(x) && /indirizzo|residenza/.test(x) && !/e-?mail|posta|citta|comune|nascita/.test(x))
  c.cap = trova((x) => persona(x) && /\bcap\b|codice\s*postale|c\.a\.p/.test(x))
  const delGenitore = (x: string) => DEL_GENITORE.test(x)
  c.genitoreCodiceFiscale = trova((x) => delGenitore(x) && /codice\s*fiscale|\bc\.?\s?f\.?(\s|$)/.test(x))
  // Il giorno in cui Google ha registrato la risposta: da lì si sa da quando è iscritto.
  c.dataRisposta = trova((x) => /informazioni cronologiche|timestamp|data.*(risposta|invio|compilazione)/.test(x))
  c.genitoreNato = trova((x) => delGenitore(x) && /nascita|nat[oa]\b/.test(x))
  c.genitore = trova((x) => delGenitore(x) && /nome|cognome/.test(x) && !/nascita|fiscale|mail|telefono/.test(x))
  for (const k of Object.keys(c) as Ruolo[]) if (c[k] === undefined) delete c[k]
  return c
}

/**
 * Una cella con più scelte, come la scrive Google: «Judo 2, Lotta 3». Una
 * virgola dentro le parentesi, o seguita da una minuscola («lunedì,
 * mercoledì»), fa parte della scelta e non la divide.
 */
export function divideScelte(cella: string): string[] {
  const fuori: string[] = []
  let dentro = 0
  let pezzo = ''
  for (let i = 0; i < cella.length; i++) {
    const ch = cella[i]
    if (ch === '(') dentro++
    if (ch === ')') dentro = Math.max(0, dentro - 1)
    const dopo = cella.slice(i + 1).trimStart()[0] ?? ''
    if (ch === ',' && dentro === 0 && !/[a-zà-ÿ]/.test(dopo)) {
      fuori.push(pezzo)
      pezzo = ''
    } else pezzo += ch
  }
  fuori.push(pezzo)
  return fuori.map((x) => x.trim()).filter(Boolean)
}

/** Le scelte diverse che compaiono nella colonna dei corsi, con quante volte. */
export function scelteCorsi(t: Tabella, colonna: number | undefined): Array<{ testo: string; quante: number }> {
  if (colonna === undefined) return []
  const conta = new Map<string, number>()
  for (const r of t.righe) for (const x of divideScelte(r[colonna] ?? '')) conta.set(x, (conta.get(x) ?? 0) + 1)
  return [...conta].map(([testo, quante]) => ({ testo, quante })).sort((a, b) => a.testo.localeCompare(b.testo, 'it'))
}

/**
 * Il corso di una scelta: con lo stesso nome, o il cui nome apre la scelta
 * («Judo 2 (nati 2017-2019)» → Judo 2, ma non Judo 22). Il più lungo vince:
 * «Judo adulti» prima di «Judo».
 */
export function indovinaCorso(testo: string, corsi: Array<{ id: string; nome: string }>): string | undefined {
  const t = piatto(testo)
  const uguale = corsi.find((c) => piatto(c.nome) === t)
  if (uguale) return uguale.id
  return corsi
    .filter((c) => {
      const n = piatto(c.nome)
      return t.startsWith(n) && !/[a-z0-9]/.test(t[n.length] ?? '')
    })
    .sort((a, b) => b.nome.length - a.nome.length)[0]?.id
}

const cfDi = (s: string) => {
  const cf = s.replace(/\s/g, '').toUpperCase()
  return STRUTTURA_CF.test(cf) ? cf : undefined
}

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Una data scritta a mano, com'è nel foglio Google: «13/06/2014», «3-6-14»,
 * «13.06.2014» o già «2014-06-13». `AAAA-MM-GG`, o `null` se non è una data
 * vera. Con l'anno di due cifre vale il secolo che non la mette nel futuro.
 */
export function leggiData(s: string, oggi = new Date()): string | null {
  const t = s.trim()
  let g: number, m: number, a: number
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  const it = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/)
  if (iso) [a, m, g] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
  else if (it) {
    ;[g, m, a] = [Number(it[1]), Number(it[2]), Number(it[3])]
    if (it[3].length === 2) a = 2000 + a > oggi.getFullYear() ? 1900 + a : 2000 + a
  } else return null
  const d = new Date(a, m - 1, g)
  if (d.getFullYear() !== a || d.getMonth() !== m - 1 || d.getDate() !== g || d > oggi) return null
  return `${a}-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`
}

/** Quanto può essere lungo un campo di `anagrafiche` (18-anagrafiche.sql). */
const LUNGHI: Partial<Record<keyof Anagrafica, number>> = { natoA: 80, comune: 80, indirizzo: 160, genitoreNato: 120, genitoreNome: 80, genitoreCognome: 80 }

/**
 * Nome e cognome da una casella sola. Il modulo dice «cognome nome» e c'è chi
 * scrive «nome cognome», o chi scrive solo il cognome: il codice fiscale, che
 * ha tre lettere per il cognome e tre per il nome, dice quali parole sono
 * l'uno e quali l'altro, anche per un cognome di due parole («De Luca Mario»).
 * A chi ha scritto una parola sola si cerca l'altra nell'email
 * («nicola.albertini@…»), se torna col codice. Senza codice, o se non torna
 * in nessun modo, vale l'ordine scelto: il cognome è l'ultima parola o la prima.
 */
export function dividiNome(testo: string, cf?: string, email?: string, ordine: OrdineNome = 'nomeCognome'): { nome: string; cognome: string; dallEmail?: boolean } | null {
  const p = testo.trim().split(/\s+/).filter(Boolean)
  const codice = cf ? cfDi(cf) : undefined
  if (codice) {
    const torna = (nome: string, cognome: string) => lettereCognome(cognome) === codice.slice(0, 3) && lettereNome(nome) === codice.slice(3, 6)
    for (let k = 1; k < p.length; k++) {
      const [a, b] = [p.slice(0, k).join(' '), p.slice(k).join(' ')]
      if (torna(a, b)) return { nome: a, cognome: b }
      if (torna(b, a)) return { nome: b, cognome: a }
    }
    if (p.length === 1 && email) {
      const parole = email.split('@')[0].split(/[._\-\d]+/).filter((x) => x.length > 1)
      const nome = parole.find((x) => torna(x, p[0]))
      if (nome) return { nome: maiuscola(nome), cognome: p[0], dallEmail: true }
      const cognome = parole.find((x) => torna(p[0], x))
      if (cognome) return { nome: p[0], cognome: maiuscola(cognome), dallEmail: true }
    }
  }
  return dividiPerOrdine(testo, ordine)
}

/**
 * Dalle risposte agli iscritti. `abbinamenti` dice, per ogni scelta, il corso
 * (il suo id) o `''` per lasciarla stare; `corsi` dà i nomi dei corsi.
 */
export function leggiRisposte(
  t: Tabella,
  col: Colonne,
  abbinamenti: Record<string, string>,
  corsi: Array<{ id: string; nome: string }>,
  ordine: OrdineNome = 'nomeCognome',
): { iscritti: IscrittoFoglio[]; righe: number; saltate: Saltata[]; note: Saltata[] } {
  const saltate: Saltata[] = []
  const note: Saltata[] = []
  const nomeDi = new Map(corsi.map((c) => [c.id, c.nome]))
  // Un modulo con le sezioni (maggiorenni, minorenni) ripete le stesse domande:
  // se la colonna scelta è vuota, vale quella con la stessa domanda che non lo è.
  const gemelle = (i: number) => [i, ...t.testa.flatMap((h, j) => (j !== i && piatto(h) === piatto(t.testa[i] ?? '') ? [j] : []))]
  const cella = (r: string[], k: Ruolo) => {
    if (col[k] === undefined) return ''
    for (const i of gemelle(col[k]!)) if ((r[i] ?? '').trim()) return r[i].trim()
    return ''
  }
  const iscritti = new Map<string, IscrittoFoglio>()
  const emailDi = new Map<string, string>()
  const emailNome = new Map<string, string>()
  const genitoreDi = new Map<IscrittoFoglio, string>()
  const rigaDi = new Map<IscrittoFoglio, number>()
  let righe = 0

  t.righe.forEach((r, i) => {
    const riga = i + 2
    if (!r.some(Boolean)) return
    righe++
    let nome = cella(r, 'nome')
    let cognome = cella(r, 'cognome')
    if (col.nomeCompleto !== undefined) {
      const nc = dividiNome(cella(r, 'nomeCompleto'), cella(r, 'codiceFiscale'), cella(r, 'email'), ordine)
      nome = nc?.nome ?? ''
      cognome = nc?.cognome ?? ''
      if (nc?.dallEmail) note.push({ foglio: 'risposte', riga, motivo: `«${cella(r, 'nomeCompleto')}»: scritto solo in parte, ${nome} ${cognome} viene dall'email e dal codice fiscale` })
    }
    if (!nome || !cognome) {
      const scritto = cella(r, 'nomeCompleto') || nome || cognome
      return saltate.push({ foglio: 'risposte', riga, nome: scritto, motivo: scritto ? `«${scritto}»: servono nome e cognome` : 'Manca il nome' })
    }
    const chi = `${compatto(nome)} ${compatto(cognome)}`
    let email = cella(r, 'email').toLowerCase() || undefined
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      note.push({ foglio: 'risposte', riga, motivo: `${nome} ${cognome}: l'email «${email}» non sembra giusta, entra senza` })
      email = undefined
    }
    let emailContatto: string | undefined
    let contattoDi: string | undefined
    if (email && emailDi.has(email) && emailDi.get(email) !== chi) {
      contattoDi = emailNome.get(email)
      note.push({ foglio: 'risposte', riga, motivo: `${nome} ${cognome}: ${email} è già di un altro iscritto (della stessa famiglia?): la metto come email di contatto, senza email di accesso` })
      emailContatto = email
      email = undefined
    }
    if (email) {
      emailDi.set(email, chi)
      emailNome.set(email, `${nome} ${cognome}`)
    }

    const x = iscritti.get(chi) ?? { nome, cognome, email, corsi: [], soloStessoNome: true, foglio: 'risposte', riga, ...(emailContatto ? { emailContatto, contattoDi } : {}) }
    // Chi ha mandato il modulo due volte: vale l'ultima email e, se i telefoni sono diversi, l'ultimo (con una nota); i corsi si sommano.
    if (email) x.email = email
    if (emailContatto) x.emailContatto = emailContatto
    aggiungiTelefono(x, cella(r, 'telefono'), riga, 'risposte', note)
    // Chi ha mandato il modulo più volte è iscritto dalla prima risposta. Con la data illeggibile vale oggi.
    const quando = leggiData(cella(r, 'dataRisposta').split(/[\sT]/)[0])
    if (quando && (!x.iscrittoIl || quando < x.iscrittoIl)) x.iscrittoIl = quando
    for (const scelta of divideScelte(cella(r, 'corsi'))) {
      const id = abbinamenti[scelta]
      if (id === '') continue
      const nomeCorso = id ? nomeDi.get(id) : undefined
      if (!nomeCorso) {
        note.push({ foglio: 'risposte', riga, motivo: `${nome} ${cognome}: «${scelta}» non è abbinato a un corso, entra senza` })
        continue
      }
      if (!x.corsi.includes(nomeCorso)) x.corsi.push(nomeCorso)
    }
    // Nascita, residenza e genitore: chi ha mandato il modulo due volte aggiunge, e l'ultima risposta vale.
    const an = anagrafica(r, riga, nome, cognome)
    if (Object.keys(an).length) x.anagrafica = { ...x.anagrafica, ...an }
    if (cella(r, 'genitore')) genitoreDi.set(x, cella(r, 'genitore'))
    rigaDi.set(x, riga)
    iscritti.set(chi, x)
  })

  // Il genitore dopo, quando ci sono tutti: se ha mandato il modulo anche lui
  // («Nicola Albertini», che fa preparazione atletica), si prendono il suo
  // nome e cognome giusti e il suo codice fiscale.
  for (const [x, scritto] of genitoreDi) {
    const parole = (s: string) => s.split(/\s+/).map(piatto).filter(Boolean).sort().join(' ')
    const lui = [...iscritti.values()].find((y) => y !== x && parole(`${y.nome} ${y.cognome}`) === parole(scritto))
    const an = { ...x.anagrafica }
    if (lui) {
      an.genitoreNome = lui.nome
      an.genitoreCognome = lui.cognome
      if (!an.genitoreCodiceFiscale && lui.anagrafica?.codiceFiscale) an.genitoreCodiceFiscale = lui.anagrafica.codiceFiscale
    } else {
      const nc = dividiNome(scritto, an.genitoreCodiceFiscale)
      an.genitoreNome = nc?.nome
      an.genitoreCognome = nc?.cognome ?? scritto.trim()
      if (!an.genitoreNome) delete an.genitoreNome
    }
    for (const k of ['genitoreNome', 'genitoreCognome'] as const) if ((an[k]?.length ?? 0) > LUNGHI[k]!) delete an[k]
    x.anagrafica = an
  }
  // Un maggiorenne non ha un genitore sulla ricevuta: la domanda era per i minori.
  for (const x of iscritti.values()) {
    const an = x.anagrafica
    if (!an?.natoIl || anni(an.natoIl) < 18 || !(an.genitoreNome || an.genitoreCognome || an.genitoreCodiceFiscale || an.genitoreNato)) continue
    note.push({ foglio: 'risposte', riga: rigaDi.get(x) ?? 0, motivo: `${x.nome} ${x.cognome}: è maggiorenne, il genitore scritto nel modulo non entra` })
    delete an.genitoreNome
    delete an.genitoreCognome
    delete an.genitoreCodiceFiscale
    delete an.genitoreNato
  }
  return { iscritti: [...iscritti.values()], righe, saltate, note }

  /** I dati anagrafici di una risposta, con una nota per quello che non si capisce e resta fuori. */
  function anagrafica(r: string[], riga: number, nome: string, cognome: string): Anagrafica {
    const chi = `${nome} ${cognome}`
    const nota = (motivo: string) => note.push({ foglio: 'risposte', riga, motivo: `${chi}: ${motivo}` })
    const a: Anagrafica = {}
    const data = cella(r, 'natoIl')
    if (data) {
      const d = leggiData(data)
      if (d) a.natoIl = d
      else nota(`non capisco la data di nascita «${data}», entra senza`)
    }
    const cfScritto = cella(r, 'codiceFiscale')
    if (cfScritto) {
      const cf = cfDi(cfScritto)
      if (!cf) nota(`il codice fiscale «${cfScritto}» non sembra giusto, entra senza`)
      else {
        a.codiceFiscale = cf
        if (!cfValido(cf)) nota(`nel codice fiscale ${cf} l'ultimo carattere non torna: controllalo`)
        else if (!cfTornaColNome(cf, nome, cognome)) nota(`il codice fiscale ${cf} non torna con nome e cognome (è di qualcun altro?)`)
        else if (a.natoIl && !cfTornaConLaData(cf, a.natoIl)) nota(`la data di nascita ${data} e il codice fiscale non dicono lo stesso giorno: controllali`)
      }
    }
    const cfGenitore = cella(r, 'genitoreCodiceFiscale')
    if (cfGenitore) {
      const cf = cfDi(cfGenitore)
      if (cf) a.genitoreCodiceFiscale = cf
      else nota(`il codice fiscale del genitore «${cfGenitore}» non sembra giusto, entra senza`)
    }
    for (const k of ['natoA', 'comune', 'indirizzo', 'genitoreNato'] as const) {
      const v = cella(r, k).replace(/\s+/g, ' ')
      if (!v) continue
      if (v.length > LUNGHI[k]!) nota(`«${v.slice(0, 30)}…» è troppo lungo, entra senza`)
      else a[k] = v
    }
    const cap = cella(r, 'cap').replace(/\s/g, '')
    if (cap) {
      if (/^\d{5}$/.test(cap)) a.cap = cap
      else nota(`il CAP «${cap}» non sembra giusto, entra senza`)
    }
    return a
  }
}
