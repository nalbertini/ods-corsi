import { archivio, STAGIONE, type LezioneProva, type PresenzaIstruttoreProva } from './archivioProva'
import { comeE, iscrittiIl, lezioniFra, memoria, type LezioneTrovata } from './datiProva'
import { aggiungiRichiesteProva } from './richiesteProva'
import type { Richiesta } from './richieste'
import { carattereControllo, lettereCognome, lettereNome } from './codiceFiscale'
import { chiaveGiorno, type StatoPresenza } from './sala'
import { conti, ENTE_PREDEFINITO, voceQuota, vociDelCorso, type Ricevuta, type VoceRicevuta } from './ricevute'

/**
 * Gli esempi della prova: quello che una palestra vera ha già dopo qualche
 * settimana, e che un archivio appena aperto non ha.
 *
 * L'orario e gli iscritti inventati bastavano al calendario e all'appello, ma
 * le aree venute dopo partivano vuote: le PRESENZE senza un appello da
 * contare, nessuno che si sta perdendo, nessuna presenza degli istruttori da
 * confermare, nessuna richiesta online, nessun telefono da chiamare. Qui si
 * mettono, una volta per dispositivo, contando da oggi: le ultime cinque
 * settimane di appelli (qualcuno manca apposta, qualcuno dal tablet), le
 * presenze col PIN delle ultime due, una lezione annullata, un sostituto,
 * uno stage, e quattro richieste.
 *
 * Si aggiungono a quello che c'è senza cambiarlo: un appello già fatto a mano
 * resta com'è, e una prova già avviata prende solo quello che le manca. Li
 * chiamano gli strati dati dell'app quando si aprono in prova, non i moduli
 * di prova da soli, così `scripts/prova-*.mjs` partono ancora da vuoti.
 */

const DOVE = 'ods-corsi:prova-esempi'   // vedi la nota in coda.ts
const VERSIONE = '1'
/**
 * Le ricevute sono venute dopo, con l'area degli iscritti: hanno il loro
 * segno, così arrivano anche su un dispositivo che gli altri esempi li ha già.
 */
const DOVE_RICEVUTE = 'ods-corsi:prova-esempi-ricevute'
/** I nuclei familiari, venuti ancora dopo: anche loro col segno loro. */
const DOVE_NUCLEI = 'ods-corsi:prova-esempi-nuclei'

const MIN = 60_000
const GIORNO = 24 * 60 * MIN

/** Un numero da una stringa, sempre lo stesso: gli esempi non cambiano a ogni caricamento. */
function numero(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

/** Già seminati su questo dispositivo. */
function fatti(): boolean {
  try {
    return localStorage.getItem(DOVE) === VERSIONE
  } catch {
    // Senza memoria gli esempi si rifarebbero a ogni pagina: meglio niente.
    return true
  }
}

/** Per «Riparti dall'orario vero»: al prossimo caricamento gli esempi tornano. */
export function scordaEsempi() {
  try {
    localStorage.removeItem(DOVE)
    localStorage.removeItem(DOVE_RICEVUTE)
    localStorage.removeItem(DOVE_NUCLEI)
  } catch {
    /* pazienza */
  }
}

export function seminaEsempi(adesso = new Date()) {
  seminaRicevute(adesso)
  seminaNuclei()
  if (fatti()) return
  const ora = adesso.getTime()
  const passate = lezioniFra(new Date(ora - 35 * GIORNO), adesso).filter((l) => l.fine.getTime() < ora)
  const prossime = lezioniFra(adesso, new Date(ora + 14 * GIORNO)).filter((l) => l.inizio.getTime() > ora)

  lezioni(passate, prossime)
  appelli(passate)
  pinIstruttori(passate.filter((l) => l.inizio.getTime() > ora - 14 * GIORNO))
  telefoni()
  archivio.salva()
  memoria.salva()
  aggiungiRichiesteProva(richieste(adesso))

  try {
    localStorage.setItem(DOVE, VERSIONE)
  } catch {
    /* si rifaranno, e non cambiano niente di quello che c'è */
  }
}

/** Una lezione annullata la settimana scorsa, un sostituto e uno stage nelle prossime. */
function lezioni(passate: LezioneTrovata[], prossime: LezioneTrovata[]) {
  const a = archivio.dati
  const decidi = (l: LezioneTrovata | undefined, x: LezioneProva) => {
    if (l && !a.lezioni[l.id] && !memoria.segnate[l.id]) a.lezioni = { ...a.lezioni, [l.id]: x }
  }
  decidi(passate.filter((l) => l.corso.id === 'aikido-2').at(-1), { stato: 'annullata' })
  decidi(prossime.find((l) => l.corso.id === 'judo-2'), { istruttore: 'i-manuel' })
  decidi(prossime.find((l) => l.corso.id === 'lotta-3' && l.inizio.getDay() === 5), { stato: 'annullata' })

  // Lo stage del sabato mattina: una lezione in più, fuori dall'orario.
  const sabato = new Date(prossime[0]?.inizio ?? Date.now())
  sabato.setDate(sabato.getDate() + ((6 - sabato.getDay() + 7) % 7 || 7))
  sabato.setHours(10, 0, 0, 0)
  if (!a.lezioni['x@esempio-stage'] && a.corsi.some((c) => c.id === 'judo-agonisti' && c.attivo))
    a.lezioni = { ...a.lezioni, 'x@esempio-stage': { straordinaria: { corsoId: 'judo-agonisti', inizio: sabato.toISOString(), durata: 120 } } }
}

/**
 * Gli appelli delle lezioni passate. Quasi tutti vengono quasi sempre;
 * qualcuno a metà, e uno su venti ha smesso di venire senza dirlo, perché
 * «chi si sta perdendo» abbia qualcuno da far vedere. Una lezione su undici
 * non ha l'appello, e una su otto l'hanno fatta solo i tablet.
 */
function appelli(passate: LezioneTrovata[]) {
  for (const l of passate) {
    if (memoria.segnate[l.id] || comeE(l).stato === 'annullata') continue
    const caso = numero(l.id)
    if (caso < 1 / 11) continue
    const soloTablet = caso > 0.875
    const segni: Record<string, StatoPresenza> = {}
    const origini: (typeof memoria.origini)[string] = {}
    const sala = comeE(l).sala
    for (const p of iscrittiIl(l.corso.id, chiaveGiorno(l.inizio))) {
      const tipo = numero(p.id)
      const viene = tipo < 0.05 ? 0.12 : tipo < 0.15 ? 0.65 : 0.92
      const x = numero(`${l.id}|${p.id}`)
      const stato: StatoPresenza = x < viene ? 'presente' : x > 0.97 ? 'giustificato' : 'assente'
      if (soloTablet && stato !== 'presente') continue
      segni[p.id] = stato
      if (stato !== 'presente') continue
      // Dal tablet all'arrivo, o il giorno dopo per chi si era dimenticato.
      const y = numero(`${p.id}|${l.id}`)
      if (soloTablet || y < 0.35) {
        const recupero = y < 0.04
        origini[p.id] = {
          da: recupero ? 'recupero' : 'tablet',
          il: recupero ? Math.min(l.fine.getTime() + GIORNO, Date.now()) : l.inizio.getTime() - Math.round(y * 20) * MIN,
          postazione: sala,
        }
      }
    }
    memoria.segnate = { ...memoria.segnate, [l.id]: segni }
    if (Object.keys(origini).length) memoria.origini = { ...memoria.origini, [l.id]: origini }
  }
}

/**
 * Gli istruttori col PIN (quelli di `PIN_PROVA`) entrati nelle loro lezioni,
 * e quattro volte in lezioni non loro: due da confermare, una confermata e una
 * rifiutata dalla segreteria.
 */
function pinIstruttori(recenti: LezioneTrovata[]) {
  const a = archivio.dati
  const tutte = [...(a.presenzeIstruttori ?? [])]
  const giaDentro = (sessioneId: string, personaId: string) => tutte.some((x) => x.sessioneId === sessioneId && x.personaId === personaId)
  const entra = (l: LezioneTrovata | undefined, personaId: string, altro: Partial<PresenzaIstruttoreProva>) => {
    if (!l || giaDentro(l.id, personaId) || comeE(l).stato === 'annullata') return
    tutte.push({
      id: `pi-esempio-${tutte.length}-${l.id.replace(/[^a-z0-9]+/gi, '-')}`,
      sessioneId: l.id,
      personaId,
      stato: 'confermata',
      prevista: true,
      entratoIl: new Date(l.inizio.getTime() + Math.round(numero(l.id + personaId) * 8) * MIN).toISOString(),
      sala: comeE(l).sala,
      ...altro,
    })
  }
  const conPin = ['i-maurizio', 'i-maura', 'i-fabio']
  for (const l of recenti) {
    const chi = comeE(l).istruttori.find((i) => conPin.includes(i))
    if (chi && numero(`pin|${l.id}`) < 0.7) entra(l, chi, {})
  }
  const ultima = (corsoId: string, prima = 0) => recenti.filter((l) => l.corso.id === corsoId).at(-1 - prima)
  const gestita = (l: LezioneTrovata | undefined) => ({ gestitaDa: 'Segreteria di prova', gestitaIl: new Date((l?.fine.getTime() ?? Date.now()) + GIORNO).toISOString() })
  entra(ultima('pesi-1'), 'i-maurizio', { stato: 'da_confermare', prevista: false })
  entra(ultima('body-functional'), 'i-fabio', { stato: 'da_confermare', prevista: false })
  const pugilistica = ultima('pre-pugilistica', 3)
  entra(pugilistica, 'i-maurizio', { stato: 'confermata', prevista: false, ...gestita(pugilistica) })
  const gioco = ultima('giocomotricita', 1)
  entra(gioco, 'i-maura', { stato: 'rifiutata', prevista: false, ...gestita(gioco) })
  a.presenzeIstruttori = tutte
}

/** Un telefono a ogni iscritto inventato: chi non ha l'email, la segreteria lo chiama. */
function telefoni() {
  const a = archivio.dati
  a.persone = a.persone.map((p) => {
    if (p.ruolo !== 'iscritto' || p.telefono || p.id.startsWith('p-nuovo-') || p.id.startsWith('p-web-')) return p
    const n = String(Math.floor(numero(`tel|${p.id}`) * 1e7)).padStart(7, '0')
    return { ...p, telefono: `3${['33', '35', '38', '40', '47'][Math.floor(numero(p.id) * 5)]} ${n.slice(0, 3)} ${n.slice(3)}` }
  })
}

/** Il codice fiscale vero di una persona inventata, carattere di controllo compreso. */
function codice(cognome: string, nome: string, natoIl: string, donna: boolean, comune: string) {
  const [anno, mese, giorno] = natoIl.split('-').map(Number)
  const g = String(giorno + (donna ? 40 : 0)).padStart(2, '0')
  const base = `${lettereCognome(cognome)}${lettereNome(nome)}${String(anno % 100).padStart(2, '0')}${'ABCDEHLMPRST'[mese - 1]}${g}${comune}`
  return base + carattereControllo(base)
}

/** Le richieste online: tre da guardare, un minore col genitore, e una già rifiutata. */
function richieste(adesso: Date): Richiesta[] {
  const fa = (ore: number) => new Date(adesso.getTime() - ore * 60 * MIN).toISOString()
  const aperti = new Set(archivio.dati.corsi.filter((c) => c.attivo).map((c) => c.id))
  const soloAperti = (r: Richiesta): Richiesta => ({ ...r, corsi: r.corsi.filter((c) => aperti.has(c)) })
  const collegno = { comune: 'Collegno', cap: '10093' }
  return [
    {
      id: 'r-esempio-ferrero',
      creataIl: fa(3),
      stato: 'nuova',
      nome: 'Davide',
      cognome: 'Ferrero',
      natoIl: '1991-04-12',
      natoA: 'Torino',
      codiceFiscale: codice('Ferrero', 'Davide', '1991-04-12', false, 'L219'),
      indirizzo: 'Via Roma 18',
      ...collegno,
      email: 'davide.ferrero@esempio.it',
      telefono: '347 210 5518',
      corsi: ['judo-adulti'],
      formula: 'annuale',
      note: 'Ho fatto judo da ragazzo, fino alla cintura verde.',
    },
    {
      id: 'r-esempio-bertola',
      creataIl: fa(26),
      stato: 'nuova',
      nome: 'Giulia',
      cognome: 'Bertola',
      natoIl: '2015-06-03',
      natoA: 'Rivoli',
      codiceFiscale: codice('Bertola', 'Giulia', '2015-06-03', true, 'H355'),
      indirizzo: 'Corso Francia 240',
      ...collegno,
      email: 'paola.rinaudo@esempio.it',
      telefono: '338 904 1127',
      genitoreNome: 'Paola',
      genitoreCognome: 'Rinaudo',
      genitoreCodiceFiscale: codice('Rinaudo', 'Paola', '1984-11-21', true, 'L219'),
      corsi: ['lotta-2'],
      formula: 'trimestre',
      note: 'Viene con la sua amica Sofia, già iscritta.',
    },
    {
      id: 'r-esempio-actis',
      creataIl: fa(70),
      stato: 'nuova',
      nome: 'Simone',
      cognome: 'Actis',
      natoIl: '1998-01-30',
      natoA: 'Grugliasco',
      codiceFiscale: codice('Actis', 'Simone', '1998-01-30', false, 'E216'),
      indirizzo: 'Via Torino 5',
      comune: 'Grugliasco',
      cap: '10095',
      email: 'simone.actis@esempio.it',
      telefono: '340 118 7702',
      corsi: ['pesi-1', 'prep-atletica-1'],
      formula: 'annuale',
    },
    {
      id: 'r-esempio-chiado',
      creataIl: fa(150),
      stato: 'rifiutata',
      gestitaIl: fa(140),
      gestitaDa: 'Segreteria di prova',
      nome: 'Elisa',
      cognome: 'Chiadò',
      natoIl: '1979-09-08',
      natoA: 'Collegno',
      codiceFiscale: codice('Chiadò', 'Elisa', '1979-09-08', true, 'C860'),
      indirizzo: 'Via Martiri XXX Aprile 7',
      ...collegno,
      email: 'elisa.chiado@esempio.it',
      telefono: '335 662 0931',
      corsi: ['body-functional'],
      formula: 'trimestre',
      note: 'Mandata due volte per sbaglio.',
    },
  ].map((r) => soloAperti(r as Richiesta))
}

/**
 * Le ricevute di chi ha pagato, tutto o in parte: la quota e il primo dei suoi
 * corsi che è nel listino, fatte nei primi giorni della stagione (o oggi, se
 * la stagione non è ancora cominciata). Chi ha pagato in parte ha dato metà
 * del corso. Una sola per persona, e solo a chi non ne ha già una.
 */
function seminaRicevute(adesso: Date) {
  try {
    if (localStorage.getItem(DOVE_RICEVUTE) === VERSIONE) return
  } catch {
    return
  }
  const a = archivio.dati
  const tutte = [...(a.ricevute ?? [])]
  const conRicevuta = new Set(tutte.map((r) => r.personaId))
  const oggi = chiaveGiorno(adesso)
  const giornoDopo = (g: string, n: number) => {
    const [y, m, d] = g.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
  }
  for (const p of a.persone) {
    const stato = p.pagamento?.stato
    if (p.ruolo !== 'iscritto' || !p.attiva || conRicevuta.has(p.id) || (stato !== 'pagato' && stato !== 'in_parte')) continue
    const corso = a.iscrizioni
      .filter((i) => i.personaId === p.id)
      .map((i) => a.corsi.find((c) => c.id === i.corsoId)?.nome)
      .map((nome) => nome && vociDelCorso(nome, STAGIONE.dal)[0])
      .find(Boolean)
    const prima = giornoDopo(STAGIONE.dal, Math.floor(numero(`ric|${p.id}`) * 10))
    const data = prima > oggi ? oggi : prima
    const metodo = ['Bonifico', 'Contanti', 'POS'][Math.floor(numero(`met|${p.id}`) * 3)]
    const paga = (v: Omit<VoceRicevuta, 'pagamenti'>, meta = false): VoceRicevuta => ({
      ...v,
      pagamenti: [{ data, importo: meta ? Math.round((v.prezzo * v.quantita) / 2) : v.prezzo * v.quantita, metodo }],
    })
    const voci = [paga(voceQuota().voce(data)), ...(corso ? [paga(corso.voce(data), stato === 'in_parte')] : [])]
    const anno = Number(data.slice(0, 4))
    const numeroRicevuta = Math.max(0, ...tutte.filter((r) => r.anno === anno).map((r) => r.numero)) + 1
    const c = conti({ voci, anticipo: 0 })
    const r: Ricevuta = {
      id: `r-esempio-${p.id}`,
      anno,
      numero: numeroRicevuta,
      data,
      personaId: p.id,
      ente: a.enteRicevute ?? ENTE_PREDEFINITO,
      intestatario: { nome: p.nome, cognome: p.cognome },
      voci,
      anticipo: 0,
      totale: c.totale,
      pagato: c.pagato,
      creataIl: new Date(`${data}T10:00:00`).toISOString(),
    }
    tutte.push(r)
  }
  a.ricevute = tutte
  archivio.salva()
  try {
    localStorage.setItem(DOVE_RICEVUTE, VERSIONE)
  } catch {
    /* si rifaranno, e saltano chi ne ha già una */
  }
}

/**
 * I nuclei familiari (vedi `nucleo.ts`): gli iscritti inventati con lo stesso
 * cognome, a gruppi di due o tre, fanno famiglia, fino a otto famiglie. Il
 * titolare è il primo per nome, e gli si danno nascita, codice fiscale e
 * residenza, che il modulo di una persona in più riusa. Chi ha già un nucleo,
 * o dei dati scritti dalla segreteria, resta com'è.
 */
function seminaNuclei() {
  try {
    if (localStorage.getItem(DOVE_NUCLEI) === VERSIONE) return
  } catch {
    return
  }
  const a = archivio.dati
  const liberi = a.persone.filter((p) => p.ruolo === 'iscritto' && p.attiva && !p.nucleo && !a.persone.some((x) => x.nucleo === p.id))
  const perCognome = new Map<string, typeof liberi>()
  for (const p of liberi) perCognome.set(p.cognome, [...(perCognome.get(p.cognome) ?? []), p])
  const famiglie = [...perCognome.values()]
    .filter((g) => g.length >= 2 && g.length <= 3)
    .sort((x, y) => x[0].cognome.localeCompare(y[0].cognome, 'it'))
    .slice(0, 8)
  const nel = new Map<string, string>()
  const anagrafiche = { ...(a.anagrafiche ?? {}) }
  for (const g of famiglie) {
    const [titolare, ...altri] = [...g].sort((x, y) => x.nome.localeCompare(y.nome, 'it'))
    for (const p of altri) nel.set(p.id, titolare.id)
    if (anagrafiche[titolare.id]) continue
    const anno = 1972 + Math.floor(numero(`anno|${titolare.id}`) * 18)
    const mese = 1 + Math.floor(numero(`mese|${titolare.id}`) * 12)
    const giorno = 1 + Math.floor(numero(`giorno|${titolare.id}`) * 28)
    const natoIl = `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
    const donna = /a$/i.test(titolare.nome) && !/^(luca|andrea|nicola|mattia|elia)$/i.test(titolare.nome)
    const civico = 1 + Math.floor(numero(`via|${titolare.id}`) * 120)
    anagrafiche[titolare.id] = {
      natoIl,
      natoA: 'Torino',
      codiceFiscale: codice(titolare.cognome, titolare.nome, natoIl, donna, 'L219'),
      indirizzo: `${['Via Roma', 'Corso Francia', 'Via Torino', 'Via Martiri XXX Aprile', 'Viale Gramsci'][Math.floor(numero(`strada|${titolare.id}`) * 5)]} ${civico}`,
      cap: '10093',
      comune: 'Collegno',
      cambiataIl: STAGIONE.dal,
    }
  }
  a.persone = a.persone.map((p) => (nel.has(p.id) ? { ...p, nucleo: nel.get(p.id) } : p))
  a.anagrafiche = anagrafiche
  archivio.salva()
  try {
    localStorage.setItem(DOVE_NUCLEI, VERSIONE)
  } catch {
    /* si rifaranno, e saltano chi ha già un nucleo */
  }
}
