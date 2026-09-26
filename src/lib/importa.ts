import type { CorsoSeg, DatiSegreteria, PersonaSeg, PersonaleSeg, Sala } from './segreteria'

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
}

export interface Fogli {
  corsi: CorsoFoglio[]
  iscritti: IscrittoFoglio[]
  righe: { corsi: number; iscritti: number; risposte?: number }
  saltate: Saltata[]
  /** Righe entrate, ma con qualcosa da sapere: un corso non riconosciuto, un'email già usata. */
  note?: Saltata[]
}

/** Dai due testi ai corsi e agli iscritti, con le righe che non si capiscono messe da parte. */
export function leggiFogli(testoCorsi: string | null, testoIscritti: string | null, corsiGiaDentro: string[] = []): Fogli {
  const saltate: Saltata[] = []
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
  const perEmail = new Map<string, { chi: string; riga: number }>()
  const righeIscritti = testoIscritti ? leggiCsv(testoIscritti) : []
  righeIscritti.forEach((r, i) => {
    const riga = i + 2
    if (!Object.values(r).some(Boolean)) return
    if (!r.nome || !r.cognome) return saltate.push({ foglio: 'iscritti.csv', riga, motivo: `Manca ${r.nome ? 'il cognome' : 'il nome'}: «${r.nome || r.cognome}»${r.corso ? `, ${r.corso}` : ''}` })
    if (r.corso && !noti.has(piatto(r.corso))) return saltate.push({ foglio: 'iscritti.csv', riga, motivo: `Il corso «${r.corso}» non è fra i corsi` })
    const chi = `${piatto(r.nome)} ${piatto(r.cognome)}`
    const email = r.email?.toLowerCase() || undefined
    if (email) {
      const prima = perEmail.get(email)
      if (prima && prima.chi !== chi) return saltate.push({ foglio: 'iscritti.csv', riga, motivo: `Stessa email della riga ${prima.riga}, ma nome diverso: quale dei due?` })
      perEmail.set(email, { chi, riga })
    }
    // L'email, quando c'è, è l'unica cosa che distingue davvero due omonimi.
    const k = email ?? chi
    const x = iscritti.get(k) ?? { nome: r.nome, cognome: r.cognome, email, telefono: r.telefono || undefined, corsi: [] }
    if (r.corso && !x.corsi.some((c) => piatto(c) === piatto(r.corso))) x.corsi.push(r.corso)
    iscritti.set(k, x)
  })

  return {
    corsi: [...corsi.values()],
    iscritti: [...iscritti.values()],
    righe: { corsi: righeCorsi.length, iscritti: righeIscritti.length },
    saltate,
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
  avvisi: string[]
}

const nomeCognome = (s: string) => {
  const p = s.trim().split(/\s+/)
  return p.length < 2 ? null : { nome: p.slice(0, -1).join(' '), cognome: p[p.length - 1] }
}

/** Cosa farebbe l'import, senza fare niente. */
export function anteprima(f: Fogli, s: Situazione): Anteprima {
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
  const oggi = new Date().toISOString().slice(0, 10)
  for (const x of f.iscritti) {
    const p = trovaPersona(x, s.persone)
    if (!p) iscrittiNuovi++
    for (const nome of x.corsi) {
      const c = corsiDentro.get(piatto(nome))
      if (!p || !c || !p.iscrizioni.some((i) => i.corsoId === c.id && (!i.al || i.al >= oggi))) iscrizioniNuove++
    }
  }
  return { saleNuove, istruttoriNuovi, istruttoriTrovati, istruttori, corsiNuovi, ricorrenzeNuove, iscrittiNuovi, iscrizioniNuove, avvisi }
}

function trovaPersona(x: IscrittoFoglio, persone: PersonaSeg[]) {
  const stessoNome = (p: PersonaSeg) => piatto(p.nome) === piatto(x.nome) && piatto(p.cognome) === piatto(x.cognome)
  const perEmail = x.email ? persone.find((p) => p.email?.toLowerCase() === x.email) : undefined
  if (perEmail && (!x.soloStessoNome || stessoNome(perEmail))) return perEmail
  if (x.email && !x.soloStessoNome) return undefined
  return persone.find((p) => !p.email && stessoNome(p)) ?? persone.find(stessoNome)
}

/**
 * L'import vero. Va in ordine — sale, istruttori, corsi, giorni, iscritti — e
 * alla fine allunga il calendario una volta sola. `passo` dice a che punto è.
 */
export async function importa(d: DatiSegreteria, f: Fogli, passo: (testo: string) => void) {
  const leggi = async (): Promise<Situazione> => {
    const [sale, personale, corsi, persone] = await Promise.all([d.sale(), d.personale(), d.corsi(), d.persone()])
    return { sale, personale, corsi, persone }
  }
  let s = await leggi()
  const a = anteprima(f, s)

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
  const persone = [...s.persone]
  for (const x of f.iscritti) {
    let p = trovaPersona(x, persone)
    if (!p) {
      // Un'email è di una persona sola: se è già di un altro (il fratello, dal
      // modulo), entra senza, col telefono.
      const email = x.email && !persone.some((q) => q.email?.toLowerCase() === x.email) ? x.email : undefined
      const id = await d.salvaPersona({ nome: x.nome, cognome: x.cognome, email, telefono: x.telefono })
      p = { id, nome: x.nome, cognome: x.cognome, email, attiva: true, creataIl: '', iscrizioni: [], certificato: { conFile: false }, pagamento: { stato: 'da_pagare' } }
      persone.push(p)
    }
    for (const nome of x.corsi) {
      const c = corsi.get(piatto(nome))
      if (c) await d.iscrivi(p.id, c.id)
    }
  }

  passo('Il calendario…')
  await d.rigenera()
  return a
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

export type Ruolo = 'nome' | 'cognome' | 'nomeCompleto' | 'email' | 'telefono' | 'corsi'

export const RUOLI: Array<[Ruolo, string]> = [
  ['nome', 'NOME'],
  ['cognome', 'COGNOME'],
  ['nomeCompleto', 'NOME E COGNOME INSIEME'],
  ['email', 'EMAIL'],
  ['telefono', 'TELEFONO'],
  ['corsi', 'CORSI'],
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
  c.email = trova((x) => /e-?mail|posta/.test(x))
  c.telefono = trova((x) => /telefono|cellulare|\bcell\b|recapito/.test(x))
  c.corsi = trova((x) => /corsi|corso|attivita|sport|disciplin/.test(x))
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

/**
 * Dalle risposte agli iscritti. `abbinamenti` dice, per ogni scelta, il corso
 * (il suo id) o `''` per lasciarla stare; `corsi` dà i nomi dei corsi.
 */
export function leggiRisposte(
  t: Tabella,
  col: Colonne,
  abbinamenti: Record<string, string>,
  corsi: Array<{ id: string; nome: string }>,
): { iscritti: IscrittoFoglio[]; righe: number; saltate: Saltata[]; note: Saltata[] } {
  const saltate: Saltata[] = []
  const note: Saltata[] = []
  const nomeDi = new Map(corsi.map((c) => [c.id, c.nome]))
  const cella = (r: string[], k: Ruolo) => (col[k] === undefined ? '' : (r[col[k]!] ?? '').trim())
  const iscritti = new Map<string, IscrittoFoglio>()
  const emailDi = new Map<string, string>()
  let righe = 0

  t.righe.forEach((r, i) => {
    const riga = i + 2
    if (!r.some(Boolean)) return
    righe++
    let nome = cella(r, 'nome')
    let cognome = cella(r, 'cognome')
    if (col.nomeCompleto !== undefined) {
      const nc = nomeCognome(cella(r, 'nomeCompleto'))
      nome = nc?.nome ?? ''
      cognome = nc?.cognome ?? ''
    }
    if (!nome || !cognome) {
      const scritto = cella(r, 'nomeCompleto') || nome || cognome
      return saltate.push({ foglio: 'risposte', riga, motivo: scritto ? `«${scritto}»: servono nome e cognome` : 'Manca il nome' })
    }
    const chi = `${piatto(nome)} ${piatto(cognome)}`
    let email = cella(r, 'email').toLowerCase() || undefined
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      note.push({ foglio: 'risposte', riga, motivo: `${nome} ${cognome}: l'email «${email}» non sembra giusta, entra senza` })
      email = undefined
    }
    if (email && emailDi.has(email) && emailDi.get(email) !== chi) {
      note.push({ foglio: 'risposte', riga, motivo: `${nome} ${cognome}: stessa email di un altro iscritto (un fratello?), entra senza email, col telefono` })
      email = undefined
    }
    if (email) emailDi.set(email, chi)

    const x = iscritti.get(chi) ?? { nome, cognome, email, telefono: cella(r, 'telefono') || undefined, corsi: [], soloStessoNome: true }
    // Chi ha mandato il modulo due volte: vale l'ultima email e l'ultimo telefono, i corsi si sommano.
    if (email) x.email = email
    if (cella(r, 'telefono')) x.telefono = cella(r, 'telefono')
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
    iscritti.set(chi, x)
  })
  return { iscritti: [...iscritti.values()], righe, saltate, note }
}
