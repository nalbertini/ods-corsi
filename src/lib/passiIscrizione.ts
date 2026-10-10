import type { CorsoPerEta, CorsoRef, Listino } from './listino'
import { corsiPerEta, voceDelCorso } from './listino'
import type { VoceCosto } from './costi'
import type { Abbonamento, RigaStima } from './nucleo'
import { causale, stimaIscrizione } from './nucleo'
import type { CampoModulo, DatiRichiesta, DatiRichieste, Formula, OrarioAperto, TipoFile } from './richieste'
import { certificatoDaPortare, dataDaCf, NOTE_NEL_DATABASE, domandaUscita, ETICHETTA_FILE, FILE, firmaDaRifare, minorenne, problemi, pulisciCf } from './richieste'
import type { Luoghi } from './codiceFiscale'
import { cfValido, luogoDaCf, scriviLuogo } from './codiceFiscale'
import { nomeProprio } from './nomi'
import { elenco } from './ricevute'

/**
 * L'iscrizione a passi (`iscrizioni/#nuova`, solo in prova): le regole di
 * ogni passo, senza browser. La schermata (`IscrizioneAPassi.tsx`) mostra e
 * chiama; la logica di oggi (`richieste`, `listino`, `nucleo`) si importa, non
 * si riscrive. Niente bozza: lo stato vive solo in memoria.
 */

export type Chi = 'adulto' | 'figlio'
type Scelte = { tesseramento?: boolean; foto?: boolean }

export interface StatoPassi {
  chi: Chi
  /**
   * Chi compila un bambino (la persona 0) e si iscrive anche lui: un adulto della famiglia che prende dal bambino
   * chi è, la residenza, i contatti, la carta, la firma e l'ok (`conDatiDellaFamiglia`). Corso, formula, caselle e
   * certificato sono suoi.
   */
  io?: true
  /** Chi si iscrive (adulto), o il bambino col genitore e i suoi contatti. */
  risposte: DatiRichiesta
  /** «Ho il foglio firmato»: il modulo si manda in foto, non si firma qui. */
  firmaInFoto?: boolean
  /** Com'era all'apertura: INDIETRO chiede solo se c'è qualcosa di nuovo. */
  inizio: DatiRichiesta
  scelte: Scelte
  /** Quanti tratti di firma: la forma sta nel componente. */
  tratti: number
  file: Partial<Record<TipoFile, File>>
  privacy: boolean
  /** Dove è nato il genitore, che le domande non chiedono ma il modulo sì. */
  natoAGenitore: string
  avvisoFirma?: string
  /** In famiglia, per un bambino: il posto dell'adulto che firma per lui (`conDatiDellaFamiglia` ne prende i dati). 0 con la persona 0 bambino: chi compila. */
  firmatario?: number
  /** Solo nella prima persona, con la ricevuta del modulo: il totale (centesimi) e quante persone c'erano quando si è caricata. */
  ricevutaPer?: { totale: number; persone: number }
}

/** Il foglio vuoto, com'è quello del modulo di oggi. */
const VUOTO: DatiRichiesta = {
  nome: '',
  cognome: '',
  natoIl: '',
  natoA: '',
  codiceFiscale: '',
  indirizzo: '',
  cap: '',
  comune: '',
  email: '',
  telefono: '',
  telefono2: '',
  genitoreNome: '',
  genitoreCognome: '',
  genitoreCodiceFiscale: '',
  corsi: [],
  formula: 'trimestre',
  regolamento: false,
}

/** Si apre solo in prova, e solo con `#nuova`: col database vero il cancelletto si ignora. */
export const flussoNuovoAcceso = (haUnServer: boolean, hash: string) => !haUnServer && hash === '#nuova'

export const nuovoStato = (chi: Chi): StatoPassi => ({
  chi,
  risposte: { ...VUOTO, corsi: [] },
  inizio: { ...VUOTO, corsi: [] },
  scelte: {},
  tratti: 0,
  file: {},
  privacy: false,
  natoAGenitore: '',
})

/** Cosa si fa in ogni passo: l'ordine sta qui, e solo qui. */
export type TipoPasso = 'dati' | 'genitore' | 'corso' | 'modulo' | 'documenti' | 'famiglia' | 'pagamento' | 'riepilogo'

// LA FAMIGLIA sta prima di QUANTO PAGHI: chi si aggiunge entra nel conto che si paga.
export const tipiDiPassi = (chi: Chi): TipoPasso[] =>
  chi === 'adulto'
    ? ['dati', 'corso', 'modulo', 'documenti', 'famiglia', 'pagamento', 'riepilogo']
    : ['dati', 'genitore', 'corso', 'modulo', 'documenti', 'famiglia', 'pagamento', 'riepilogo']

const NOME_PASSO: Record<Chi, Partial<Record<TipoPasso, string>>> = {
  adulto: { dati: 'I TUOI DATI', corso: 'SCEGLI IL CORSO', modulo: 'IL MODULO E LA FIRMA', documenti: 'I DOCUMENTI', famiglia: 'LA FAMIGLIA', pagamento: 'QUANTO PAGHI', riepilogo: 'CONTROLLA E INVIA' },
  figlio: {
    dati: 'IL BAMBINO',
    genitore: 'IL GENITORE CHE FIRMA',
    corso: 'SCEGLI IL CORSO',
    modulo: 'IL MODULO E LA FIRMA',
    documenti: 'I DOCUMENTI',
    famiglia: 'LA FAMIGLIA',
    pagamento: 'QUANTO PAGHI',
    riepilogo: 'CONTROLLA E INVIA',
  },
}

export const passiDi = (chi: Chi): string[] => tipiDiPassi(chi).map((t) => NOME_PASSO[chi][t] ?? '')

/** Le risposte come partono: il regolamento è accettato iscrivendosi, la data dice il codice fiscale, l'adulto non ha genitore. */
export function risposteDaiPassi(s: StatoPassi, oggi = new Date()): DatiRichiesta {
  const r = { ...s.risposte, regolamento: true, natoIl: dataDaCf(s.risposte.codiceFiscale, s.risposte.natoIl, oggi) ?? s.risposte.natoIl }
  return s.chi === 'adulto' ? { ...r, genitoreNome: '', genitoreCognome: '', genitoreCodiceFiscale: '' } : r
}

/**
 * Il codice fiscale dice un'età che non è quella della scelta: chi si iscrive
 * da adulto ha un codice da minorenne, o chi iscrive il figlio ne ha uno da
 * maggiorenne. Parte appena il codice è valido; prima nessun verdetto.
 */
export function controlloScelta(s: StatoPassi, oggi = new Date()): { verdetto: 'minore' | 'adulto'; domanda: string } | null {
  const cf = pulisciCf(s.risposte.codiceFiscale)
  if (!cfValido(cf)) return null
  const nato = dataDaCf(cf, s.risposte.natoIl, oggi)
  if (!nato) return null
  const minore = minorenne(nato, oggi)
  if (s.chi === 'adulto' && minore) return { verdetto: 'minore', domanda: 'Stai iscrivendo un bambino?' }
  if (s.chi === 'figlio' && !minore) return { verdetto: 'adulto', domanda: 'Ti stai iscrivendo tu?' }
  return null
}

// --- cosa manca in ogni passo -----------------------------------------------

interface Pastiglia {
  chiave: string
  nome: string
}

/** Il nome di un campo sulla pastiglia «MANCA N COSE». */
const NOMI: Record<CampoModulo, string> = {
  nome: 'NOME',
  cognome: 'COGNOME',
  natoIl: 'DATA DI NASCITA',
  natoA: 'LUOGO DI NASCITA',
  codiceFiscale: 'CODICE FISCALE',
  indirizzo: 'INDIRIZZO',
  cap: 'CAP',
  comune: 'COMUNE',
  email: 'EMAIL',
  telefono: 'TELEFONO',
  telefono2: 'SECONDO TELEFONO',
  genitoreNome: 'NOME DEL GENITORE',
  genitoreCognome: 'COGNOME DEL GENITORE',
  genitoreCodiceFiscale: 'CODICE FISCALE DEL GENITORE',
  corsi: 'CORSO',
  formula: 'FORMULA',
  regolamento: 'REGOLAMENTO',
}
// L'ordine delle chiavi è quello della pagina: il focus dopo AVANTI va al primo che si vede.
const DATI: CampoModulo[] = ['nome', 'cognome', 'codiceFiscale', 'natoIl', 'natoA', 'indirizzo', 'cap', 'comune']
const CONTATTI: CampoModulo[] = ['email', 'telefono', 'telefono2']
const GENITORE: CampoModulo[] = ['genitoreNome', 'genitoreCognome', 'genitoreCodiceFiscale']

/** I campi di `quali` che non vanno, coi controlli di oggi (`problemi`) e il verdetto sul codice fiscale. */
function campi(s: StatoPassi, oggi: Date, quali: CampoModulo[]): Pastiglia[] {
  const g: Partial<Record<CampoModulo, string>> = { ...problemi(risposteDaiPassi(s, oggi), oggi) }
  if (controlloScelta(s, oggi)) g.codiceFiscale = g.codiceFiscale ?? 'Non torna'
  return quali.filter((k) => g[k]).map((k) => ({ chiave: k, nome: NOMI[k] }))
}

/** Caselle e firma (se il foglio non è stato firmato a mano), regolamento e privacy: come in pagina. */
function moduloEFile(s: StatoPassi): Pastiglia[] {
  const m: Pastiglia[] = []
  if (s.firmaInFoto && !s.file.modulo) {
    m.push({ chiave: 'modulo', nome: 'MODULO FIRMATO' })
  } else if (!s.file.modulo) {
    if (s.scelte.tesseramento === undefined) m.push({ chiave: 'tesseramento', nome: 'TESSERAMENTO' })
    if (s.scelte.foto === undefined) m.push({ chiave: 'foto', nome: 'FOTO' })
    if (!s.tratti) m.push({ chiave: 'firma', nome: 'FIRMA' })
  }
  if (!s.risposte.regolamento) m.push({ chiave: 'regolamento', nome: 'REGOLAMENTO' })
  if (!s.privacy) m.push({ chiave: 'privacy', nome: 'INFORMATIVA PRIVACY' })
  return m
}

/** I documenti che ferma la richiesta: la carta d'identità. Il retro, il certificato e la ricevuta non fermano. */
function documenti(s: StatoPassi): Pastiglia[] {
  return FILE.filter((f) => f.obbligatorio && f.tipo !== 'modulo' && !s.file[f.tipo]).map((f) => ({ chiave: f.tipo, nome: f.etichetta }))
}

/** Le caselle dell'io: la firma, l'ok e il foglio sono quelli del bambino 0, le risposte sul tesseramento e le foto sono sue. */
function caselleDellIo(s: StatoPassi): Pastiglia[] {
  const m: Pastiglia[] = []
  if (s.scelte.tesseramento === undefined) m.push({ chiave: 'tesseramento', nome: 'TESSERAMENTO' })
  if (s.scelte.foto === undefined) m.push({ chiave: 'foto', nome: 'FOTO' })
  return m
}

function sezione(s: StatoPassi, passo: number, oggi: Date): Pastiglia[] {
  switch (tipiDiPassi(s.chi)[passo - 1]) {
    case 'dati':
      // L'io è già scritto nel bambino 0: lì si corregge, e lì manca.
      if (s.io) return []
      return campi(s, oggi, s.chi === 'adulto' ? [...DATI, ...CONTATTI] : DATI)
    case 'genitore':
      // Il luogo del genitore lo dice il suo codice fiscale (il componente lo riempie): se resta vuoto lo chiede qui, dove si parla a lui.
      // Serve solo al PDF del modulo: col foglio firmato in foto il PDF non si fa e non lo chiede.
      return [...campi(s, oggi, GENITORE), ...(s.natoAGenitore.trim() || s.file.modulo || s.firmaInFoto ? [] : [{ chiave: 'natoAGenitore', nome: 'DOVE SEI NATO' }]), ...campi(s, oggi, CONTATTI)]
    case 'corso':
      return campi(s, oggi, ['corsi', 'formula'])
    case 'modulo':
      return s.io ? caselleDellIo(s) : moduloEFile(s)
    case 'documenti':
      // La carta dell'io è quella caricata per il bambino 0.
      return s.io ? [] : documenti(s)
    default:
      return []
  }
}

/** Le cose che mancano nel passo, in ordine; l'ultimo passo rimette insieme tutto. */
function mancanze(s: StatoPassi, passo: number, oggi: Date): Pastiglia[] {
  return senzaDoppioni(s, passo, oggi, 'nome')
}

/** Il passo, o all'ultimo tutti i precedenti insieme, senza doppioni per `nome` (la conta di AVANTI) o per `chiave` (le voci toccabili). */
function senzaDoppioni(s: StatoPassi, passo: number, oggi: Date, per: 'nome' | 'chiave'): Pastiglia[] {
  const ultimo = passiDi(s.chi).length
  if (passo < ultimo) return sezione(s, passo, oggi)
  const tutte = Array.from({ length: ultimo - 1 }, (_, i) => sezione(s, i + 1, oggi)).flat()
  return tutte.filter((p, i) => tutte.findIndex((q) => q[per] === p[per]) === i)
}

/**
 * Le voci toccabili della barra: nome e chiave del campo dove portano. Come
 * `mancaNelPasso`, ma all'ultimo passo i doppioni si tolgono per chiave, così
 * il tocco va al campo giusto.
 */
export const mancanti = (s: StatoPassi, passo: number, oggi = new Date()): Pastiglia[] => senzaDoppioni(s, passo, oggi, 'chiave')

/** Di chi è una cosa del genitore: «di Nicola», o «del genitore» finché il nome non c'è (mai «di» e niente). */
export const diChiFirma = (nome: string | undefined): string => (nome?.trim() ? `di ${nome.trim()}` : 'del genitore')

/**
 * Chi firma la persona `i`, quando non è chi compila: il suo nome (vuoto se non c'è). `undefined` vuol dire
 * «tu». In famiglia compila la prima persona: un altro adulto firma per sé, un bambino lo firma il suo
 * `firmatario`. Le persone sono quelle di `conDatiDellaFamiglia`, col nome di chi firma già nel bambino.
 */
export function chiFirma(persone: StatoPassi[], i: number): string | undefined {
  const s = persone[i]
  if (!s || i === 0 || s.io) return undefined
  if (s.chi === 'figlio' && s.firmatario === 0) return undefined
  const nome = (s.chi === 'adulto' ? s.risposte.nome : (s.risposte.genitoreNome ?? '')).trim()
  // Chi compila può essere il genitore di un bambino messo per primo, che poi aggiunge sé stesso: resta «tu».
  const prima = persone[0]
  const io = (prima.chi === 'adulto' ? prima.risposte.nome : (prima.risposte.genitoreNome ?? '')).trim()
  return nome && nome.toLocaleLowerCase('it') === io.toLocaleLowerCase('it') ? undefined : nome
}

/** Nel passo del modulo dell’io, la casella delle sue foto: col suo nome. */
export const etichettaSueFoto = (genitoreNome: string | undefined): string => `LE FOTO E I VIDEO ${diChiFirma(genitoreNome).toUpperCase()}`

/** La riga della carta d'identità nel riepilogo: di chi firma per un bambino, senza nome per un adulto. */
export const cartaNelRiepilogo = (chi: Chi, genitoreNome: string | undefined): string => (chi === 'figlio' ? `Carta d’identità ${diChiFirma(genitoreNome)}` : 'Carta d’identità')

/** La frase in cima al passo del genitore: «tu» se firma chi compila, se no il nome di chi firma. */
export function fraseDelGenitore(chi: string | undefined): string {
  if (chi === undefined) return 'Firma tu, che sei maggiorenne. I tuoi dati servono anche per il modulo.'
  return `Firma ${chi.trim() || 'il genitore'}, che è maggiorenne. I suoi dati servono anche per il modulo.`
}

/**
 * Il titolo sopra regolamento e privacy: come «LA FIRMA DI», dice di chi è l'ok quando non è di chi compila.
 * Senza nome «DI CHI FIRMA», non «DEL GENITORE»: l'ok può essere di un adulto che firma per sé.
 */
export function titoloDellOk(chi: string | undefined): string {
  if (chi === undefined) return 'IL TUO OK'
  return `L’OK DI ${chi.trim().toUpperCase() || 'CHI FIRMA'}`
}

/** Le pastiglie di «MANCA N COSE»: lista viva, conta anche «scritto male». */
export const mancaNelPasso = (s: StatoPassi, passo: number, oggi = new Date()): string[] => mancanze(s, passo, oggi).map((p) => p.nome)

export function avanti(s: StatoPassi, passo: number, oggi = new Date()): { passo: number; manca: string[] } {
  const manca = mancaNelPasso(s, passo, oggi)
  return manca.length ? { passo, manca } : { passo: passo + 1, manca: [] }
}

/** La chiave del primo campo che non va, dove porta il focus. */
export const primoDaCorreggere = (s: StatoPassi, passo: number, oggi = new Date()): string | undefined => mancanze(s, passo, oggi)[0]?.chiave

/** Sotto il campo: «Manca» solo dopo il tentativo, «scritto male» anche appena si lascia il campo. */
export function notaSottoIlCampo(errore: string | undefined, provato: boolean, visto: boolean): string | undefined {
  if (!errore) return undefined
  return errore === 'Manca' ? (provato ? errore : undefined) : provato || visto ? errore : undefined
}

// --- cambiare scelta, uscire, un altro figlio -------------------------------

const quanteCaselle = (sc: Scelte) => Object.values(sc).filter((v) => v !== undefined).length
const quantiFile = (f: StatoPassi['file']) => Object.values(f).filter(Boolean).length

/** Si tiene chi è (nome, codice, residenza, contatti) e il documento; il foglio, firmato da un altro, si rifà. */
export function cambiaScelta(s: StatoPassi, a: Chi): StatoPassi {
  const r = s.risposte
  const { modulo, ...file } = s.file
  return {
    ...nuovoStato(a),
    inizio: s.inizio,
    risposte: {
      ...VUOTO,
      corsi: [],
      nome: r.nome,
      cognome: r.cognome,
      codiceFiscale: r.codiceFiscale,
      indirizzo: r.indirizzo,
      cap: r.cap,
      comune: r.comune,
      email: r.email,
      telefono: r.telefono,
      telefono2: r.telefono2,
    },
    file,
    // La ricevuta è del modulo, non della scelta: resta, e col suo totale per l'avviso.
    ...(s.ricevutaPer && { ricevutaPer: s.ricevutaPer }),
    privacy: s.privacy,
    avvisoFirma: firmaDaRifare(a === 'figlio', { tratti: s.tratti, scelte: quanteCaselle(s.scelte), foto: !!modulo, avvisato: !!s.avvisoFirma }),
  }
}

export const perDomandaUscita = (s: StatoPassi): Parameters<typeof domandaUscita>[0] => ({
  risposte: s.risposte,
  inizio: s.inizio,
  file: quantiFile(s.file),
  scelte: quanteCaselle(s.scelte),
  tratti: s.tratti,
  privacy: s.privacy,
  luogoGenitore: s.natoAGenitore,
})

/** Dal passo 2 si torna al passo prima, senza domande; dal 1 si esce alla scelta, chiedendo se c'è qualcosa di scritto. */
export function indietro(passo: number, uscita: string | undefined): { a: 'passo'; passo: number } | { a: 'scelta'; chiede?: string } {
  if (passo >= 2) return { a: 'passo', passo: passo - 1 }
  return uscita ? { a: 'scelta', chiede: uscita } : { a: 'scelta' }
}

/**
 * Il genitore iscrive un altro bambino: restano i suoi dati e i contatti, non
 * firma, documento né il luogo di nascita del genitore (si chiedono di nuovo,
 * e così il foglio nuovo non sembra già scritto a chi esce).
 */
export function perUnAltroFiglio(s: StatoPassi): StatoPassi {
  const r = s.risposte
  const risposte: DatiRichiesta = {
    ...VUOTO,
    corsi: [],
    genitoreNome: r.genitoreNome,
    genitoreCognome: r.genitoreCognome,
    genitoreCodiceFiscale: r.genitoreCodiceFiscale,
    indirizzo: r.indirizzo,
    cap: r.cap,
    comune: r.comune,
    email: r.email,
    telefono: r.telefono,
    telefono2: r.telefono2,
  }
  return { ...nuovoStato('figlio'), risposte, inizio: { ...risposte } }
}

// --- la famiglia: chi si aggiunge ----------------------------------------------

/** Quante persone stanno in un solo modulo: come le richieste al giorno per email (`49-richieste-per-email.sql`). */
export const MASSIMO_PERSONE = 6

export const puoiAggiungere = (quante: number): boolean => quante < MASSIMO_PERSONE

/**
 * Cosa della famiglia si vede in un passo. Chi aggiungere (o, al massimo, il riquadro che lo dice) sta nel suo
 * passo, LA FAMIGLIA, prima di QUANTO PAGHI: così chi si aggiunge entra nel conto. In famiglia le pastiglie
 * restano in ogni passo, per passare dall'una all'altra; all'ultimo le persone sono nel riepilogo.
 */
export function famigliaNelPasso({ tipo, quante }: { tipo: TipoPasso; quante: number }): { pastiglie: boolean; aggiungi: boolean; massimo: boolean } {
  return {
    pastiglie: tipo !== 'riepilogo' && quante > 1,
    aggiungi: tipo === 'famiglia' && puoiAggiungere(quante),
    massimo: tipo === 'famiglia' && !puoiAggiungere(quante),
  }
}

const NUMERI = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci']
const massimo = NUMERI[MASSIMO_PERSONE]

/** Il riquadro che prende il posto di AGGIUNGI UN FAMILIARE al massimo: il numero è quello della regola, scritto in lettere. */
export const frasiDelMassimo = {
  etichetta: `SIETE IN ${massimo.toUpperCase()}`,
  titolo: 'Di più, chiamaci: vi iscriviamo insieme.',
  testo: `In un solo modulo ci sono al massimo ${massimo} persone.`,
}

/** Chi compila un bambino (la persona 0) firma per lui: il posto 0 vale come firmatario anche se lì c'è un bambino. */
const firmaChiCompila = (persone: StatoPassi[], indice: number) => indice === 0 && persone[0]?.chi === 'figlio'

/**
 * Una persona in più nella famiglia, da scrivere da capo: l'indirizzo, i contatti e, per un bambino, i dati di
 * chi firma non si copiano ora, si prendono quando servono (`conDatiDellaFamiglia`). Il bambino lo firma un
 * adulto della famiglia, `indiceFirmatario`, o chi compila (0, con la persona 0 bambino). `io`: è chi compila il
 * bambino 0 che si iscrive anche lui, una volta sola. In famiglia il foglio si firma qui, per ognuno: la foto del
 * foglio firmato prima non vale più.
 */
export function aggiungiFamiliare(persone: StatoPassi[], chi: Chi, indiceFirmatario: number, io = false): StatoPassi[] {
  if (!puoiAggiungere(persone.length)) throw new Error(frasiDelMassimo.testo)
  if (io && (chi !== 'adulto' || persone[0]?.chi !== 'figlio')) throw new Error('Ti aggiungi così solo quando iscrivi un bambino: scegli UN ALTRO ADULTO.')
  if (io && persone.some((p) => p.io)) throw new Error('Ci sei già, nel modulo: scegli UN ALTRO ADULTO.')
  if (chi === 'figlio' && persone[indiceFirmatario]?.chi !== 'adulto' && !firmaChiCompila(persone, indiceFirmatario))
    throw new Error('Per firmare serve un adulto della famiglia: scegline un altro.')
  const nuova: StatoPassi = { ...nuovoStato(chi), ...(chi === 'figlio' ? { firmatario: indiceFirmatario } : {}), ...(io ? { io: true as const } : {}) }
  return [...persone, nuova].map((p) => {
    const { modulo, ...file } = p.file
    return { ...p, file }
  })
}

/**
 * Chi può aggiungere AGGIUNGI UN ADULTO: con la persona 0 bambino anche chi compila («IO, PAOLA»), se non c'è già;
 * sempre un altro adulto. `io` va ad `aggiungiFamiliare`.
 */
export function scelteAdulto(persone: StatoPassi[]): Array<{ io: boolean; testo: string }> {
  const zero = persone[0]
  const altro = { io: false, testo: 'UN ALTRO ADULTO' }
  if (zero?.chi !== 'figlio' || persone.some((p) => p.io)) return [altro]
  const nome = nomeProprio(zero.risposte.genitoreNome ?? '').toUpperCase()
  return [{ io: true, testo: nome ? `IO, ${nome}` : 'IO' }, altro]
}

/**
 * Chi firma per un bambino che si aggiunge: con la persona 0 bambino chi compila (posto 0, col nome del genitore) e
 * gli altri adulti, non l'io (è sempre chi compila); se no gli adulti della famiglia (`chiPuoFirmare`).
 */
export function firmatariPossibili(persone: StatoPassi[]): Array<{ indice: number; nome: string }> {
  const zero = persone[0]
  if (zero?.chi !== 'figlio') return chiPuoFirmare(persone)
  const tu = { indice: 0, nome: nomeProprio(zero.risposte.genitoreNome ?? '') || 'Tu' }
  return [tu, ...chiPuoFirmare(persone).filter((x) => !persone[x.indice].io)]
}

/** Quello che un familiare lascia vuoto: lo prende da un altro. Quello che ha scritto lui resta suo. */
const oppure = (suo: string | undefined, altro: string | undefined): string => (suo?.trim() ? suo : (altro ?? ''))

/**
 * Nome, cognome e codice di chi firma per il bambino `s`: l'adulto al suo posto, o con la persona 0 bambino chi
 * compila (il suo genitore, se l'ha scritto). `undefined` se non c'è più un adulto che firmi.
 */
function datiDiChiFirma(persone: StatoPassi[], s: StatoPassi): { nome: string; cognome: string; codiceFiscale: string } | undefined {
  if (s.chi !== 'figlio' || s.firmatario === undefined) return undefined
  const lui = persone[s.firmatario]
  if (lui?.chi === 'adulto' && !lui.io) return lui.risposte
  // Chi compila il bambino 0 (anche quando firma l'io, che è lui): i dati sono quelli del genitore del bambino 0.
  const zero = persone[0].risposte
  if ((firmaChiCompila(persone, s.firmatario) || lui?.io) && persone[0].chi === 'figlio' && zero.genitoreNome?.trim())
    return { nome: zero.genitoreNome, cognome: zero.genitoreCognome ?? '', codiceFiscale: zero.genitoreCodiceFiscale ?? '' }
  return undefined
}

/**
 * L'io prende dal bambino 0, sempre (anche quello che ha scritto lui: il suo passo dei dati non c'è): chi è, dove è
 * nato, la residenza, i contatti, la carta, la firma e l'ok. Se la persona 0 non è più un bambino, niente.
 */
function conDatiDelBambino(s: StatoPassi, bambino: StatoPassi): StatoPassi {
  if (bambino.chi !== 'figlio') return s
  const b = bambino.risposte
  return {
    ...s,
    risposte: {
      ...s.risposte,
      nome: b.genitoreNome ?? '',
      cognome: b.genitoreCognome ?? '',
      codiceFiscale: b.genitoreCodiceFiscale ?? '',
      natoA: bambino.natoAGenitore,
      indirizzo: b.indirizzo,
      cap: b.cap,
      comune: b.comune,
      email: b.email,
      telefono: b.telefono,
      telefono2: b.telefono2,
      genitoreNome: '',
      genitoreCognome: '',
      genitoreCodiceFiscale: '',
      regolamento: b.regolamento,
    },
    tratti: bambino.tratti,
    privacy: bambino.privacy,
    file: { ...s.file, documento: bambino.file.documento, 'documento-retro': bambino.file['documento-retro'] },
  }
}

/**
 * Le persone della famiglia coi dati che prendono dagli altri, al momento di usarli (il conto, l'invio):
 * indirizzo e contatti dalla prima persona, e per un bambino nome, cognome e codice di chi firma; l'io tutto
 * quello che è suo nel bambino 0. Così quello che si scrive o si corregge dopo arriva anche a loro. Se chi firma
 * non è più un adulto, non si prende.
 */
export function conDatiDellaFamiglia(persone: StatoPassi[]): StatoPassi[] {
  if (persone.length < 2) return persone
  const prima = persone[0].risposte
  return persone.map((s, i) => {
    if (i === 0) return s
    if (s.io) return conDatiDelBambino(s, persone[0])
    const r = s.risposte
    const firma = datiDiChiFirma(persone, s)
    return {
      ...s,
      risposte: {
        ...r,
        indirizzo: oppure(r.indirizzo, prima.indirizzo),
        cap: oppure(r.cap, prima.cap),
        comune: oppure(r.comune, prima.comune),
        email: oppure(r.email, prima.email),
        telefono: oppure(r.telefono, prima.telefono),
        telefono2: oppure(r.telefono2, prima.telefono2),
        ...(firma ? { genitoreNome: oppure(r.genitoreNome, firma.nome), genitoreCognome: oppure(r.genitoreCognome, firma.cognome), genitoreCodiceFiscale: oppure(r.genitoreCodiceFiscale, firma.codiceFiscale) } : {}),
      },
    }
  })
}

/**
 * Una famiglia che non può partire, con una frase per chi usa l'app: un bambino il cui adulto che firma ha
 * cambiato scelta, o l'io quando la persona 0 non è più un bambino (era lì come suo genitore).
 */
export function fermoDellaFamiglia(persone: StatoPassi[]): string | undefined {
  for (const [i, s] of persone.entries()) {
    if (s.io && persone[0].chi !== 'figlio') {
      const lui = nomeDellaPersona(persone[0], 0)
      return `${lui} ora si iscrive da adulto, e tu eri nel modulo come suo genitore: rimetti ${lui} come bambino, oppure chiama la segreteria.`
    }
    if (s.chi !== 'figlio' || s.firmatario === undefined || datiDiChiFirma(persone, s)) continue
    const lui = nomeDellaPersona(persone[s.firmatario], s.firmatario)
    return `${lui} non è più un adulto, e ${nomeDellaPersona(s, i)} ha bisogno di un adulto che firmi: rimetti ${lui} come adulto, oppure chiama la segreteria.`
  }
  return undefined
}

/** Il foglio si firma in foto solo da soli, per chi l'ha scelto: in famiglia si firma qui. La persona non conta più (era per «Anche tu»), il posto resta per chi chiama. */
export const firmaInFoto = (_s: StatoPassi, sceltaLaFoto: boolean, quante: number): boolean => sceltaLaFoto && quante === 1

/** La provincia di chi firma per un bambino: la dice il suo codice fiscale, se no quella scritta a mano. */
export const siglaDelGenitore = (s: StatoPassi, luoghi: Luoghi | null | undefined, scritta: string): string =>
  (luoghi && luogoDaCf(luoghi, pulisciCf(s.risposte.genitoreCodiceFiscale ?? ''))?.sigla) || scritta

/** Chi è sulla pastiglia e nelle frasi: il nome scritto, o «Adulto 2» / «Bambino 3» (il posto in famiglia) finché non c'è. */
export const nomeDellaPersona = (s: StatoPassi, indice: number): string => nomeProprio(s.risposte.nome) || `${s.chi === 'figlio' ? 'Bambino' : 'Adulto'} ${indice + 1}`

/** I nomi dei passi di una persona della famiglia: i dati di un adulto aggiunto non sono di chi compila, il titolo dice di chi sono. */
export function nomiDeiPassi(s: StatoPassi, indice: number): string[] {
  const nomi = passiDi(s.chi)
  // L'io è chi compila: i dati sono «tuoi».
  if (s.chi !== 'adulto' || indice === 0 || s.io) return nomi
  return [`I DATI DI ${nomeDellaPersona(s, indice).toUpperCase()}`, ...nomi.slice(1)]
}

/** Chi può firmare per un bambino: gli adulti della famiglia, col loro posto (`indiceFirmatario` di `aggiungiFamiliare`). */
export const chiPuoFirmare = (persone: StatoPassi[]): Array<{ indice: number; nome: string }> =>
  persone.flatMap((p, indice) => (p.chi === 'adulto' ? [{ indice, nome: nomeDellaPersona(p, indice) }] : []))

const ultimoPasso = (s: StatoPassi) => passiDi(s.chi).length

/** «manca 1 cosa» / «mancano 3 cose»: per chi legge lo schermo. */
export const fraseCoseCheMancano = (n: number): string => (n === 1 ? 'manca 1 cosa' : `mancano ${n} cose`)

/** Cosa legge lo schermo sulla pastiglia di una persona: il nome, e quante cose le mancano se ne mancano. */
export const etichettaPastiglia = (nome: string, mancano: number): string => (mancano ? `${nome}: ${fraseCoseCheMancano(mancano)}` : nome)

/** Il tasto RIPROVA dell'esito a metà: per nome se sono uno o due, se no per i mancanti. */
export const etichettaRiprova = (mancanti: string[]): string => `RIPROVA PER ${mancanti.length > 2 ? 'I MANCANTI' : mancanti.map((n) => n.toUpperCase()).join(' E ')}`

/** Quante cose mancano a una persona in tutto, come all'ultimo passo: il numero sulla sua pastiglia. */
export const quantoManca = (s: StatoPassi, oggi = new Date()): number => mancaNelPasso(s, ultimoPasso(s), oggi).length

/**
 * Cosa manca a tutta la famiglia, per l'ultimo passo. Con una persona sola sono le voci di `mancanti`; con
 * più persone ogni voce dice di chi è («FIRMA DI PAOLA») e la chiave comincia dal posto di quella persona
 * («2:firma»), così il tocco porta da lei.
 */
export function mancantiFamiglia(persone: StatoPassi[], oggi = new Date()): Array<{ chiave: string; nome: string }> {
  if (persone.length === 1) return mancanti(persone[0], ultimoPasso(persone[0]), oggi)
  return persone.flatMap((s, i) => mancanti(s, ultimoPasso(s), oggi).map((p) => ({ chiave: `${i}:${p.chiave}`, nome: `${p.nome} DI ${nomeDellaPersona(s, i).toUpperCase()}` })))
}

/** In quale passo di `s` si scrive una cosa che manca; `undefined` se non manca. */
export function passoDelCampo(s: StatoPassi, chiave: string, oggi = new Date()): number | undefined {
  for (let passo = 1; passo < ultimoPasso(s); passo++) if (sezione(s, passo, oggi).some((p) => p.chiave === chiave)) return passo
  return undefined
}

/** La domanda di INDIETRO dal primo passo: con più persone si perdono le risposte di tutte, anche se nessuna ha scritto ancora. */
export const uscitaDellaFamiglia = (persone: StatoPassi[]): string | undefined =>
  persone.length > 1 ? domandaUscita({ ...perDomandaUscita(persone[0]), privacy: true }) : domandaUscita(perDomandaUscita(persone[0]))

// --- i file, la firma, il riepilogo -----------------------------------------

/**
 * Etichetta e dettaglio di un file nel flusso a passi. Per chi iscrive il figlio parlano al genitore
 * («il certificato di Luca», «la tua carta»); per l'adulto restano quelli di `FILE`, come nel modulo di oggi.
 */
export function testoFile(chi: Chi, tipo: TipoFile, nome: string, firma: string | undefined): { etichetta: string; dettaglio: string } {
  const f = FILE.find((x) => x.tipo === tipo)!
  const n = nome.trim()
  // La carta è di chi firma, che non sempre è chi compila (in famiglia): il suo nome, non «tua».
  const di = diChiFirma(firma).toUpperCase()
  if (chi === 'figlio') {
    if (tipo === 'documento') return { etichetta: `LA CARTA D’IDENTITÀ ${di}`, dettaglio: `Il fronte. È ${firma?.trim() || 'il genitore'} che firma: serve la sua carta, non quella ${n ? `di ${n}` : 'del bambino'}.` }
    if (tipo === 'documento-retro') return { etichetta: `IL RETRO DELLA CARTA ${di}`, dettaglio: 'Il retro. Una foto o il PDF.' }
    if (tipo === 'certificato') {
      return {
        etichetta: `IL CERTIFICATO ${n ? `DI ${n.toUpperCase()}` : 'DEL BAMBINO'}`,
        dettaglio: `Lo porti in segreteria prima della prima lezione: senza, ${n || 'il bambino'} non può partecipare.`,
      }
    }
  }
  return { etichetta: f.etichetta, dettaglio: f.dettaglio }
}

/**
 * Il luogo di nascita del genitore si chiede solo se il suo codice fiscale non lo dice (elenco dei luoghi assente,
 * codice non ancora scritto o luogo che non c'è). Segue `natoAGenitore`, che il componente riempie dallo stesso elenco:
 * se uno dei due cambia, cambia anche l'altro (la mancanza «DOVE SEI NATO» in `sezione`).
 */
export function luogoGenitoreDaChiedere(s: StatoPassi, luoghi: Luoghi | undefined): boolean {
  if (s.chi !== 'figlio') return false
  return !(luoghi && luogoDaCf(luoghi, pulisciCf(s.risposte.genitoreCodiceFiscale ?? '')))
}

/** La frase sotto l'elenco dei corsi di un minore, se qualche corso per grandi non compare. */
export function fraseCorsiNascosti(nascosti: string[], nomeBambino: string): string | undefined {
  if (!nascosti.length) return undefined
  const lui = nomeBambino.trim() || 'il bambino'
  const elenco = nascosti.length > 3 ? undefined : nascosti.length === 1 ? nascosti[0] : `${nascosti.slice(0, -1).join(', ')} e ${nascosti[nascosti.length - 1]}`
  const cosa = elenco ? `${elenco} ${nascosti.length === 1 ? 'non compare' : 'non compaiono'}` : 'I corsi per grandi non compaiono'
  return `${cosa}: ${lui} è troppo piccolo. Cerchi altro? Chiama la segreteria.`
}

/** A quale passo manda MODIFICA nelle righe fisse del riepilogo: la carta d'identità sta nei documenti, la firma nel modulo. */
export const passoDelRiepilogo = (riga: 'carta' | 'firma'): TipoPasso => (riga === 'carta' ? 'documenti' : 'modulo')

/** Una cifra in centesimi per la riga del totale: «50 €», «50,50 €», lo sconto con il meno. */
const euroBreve = (cent: number) => `${cent < 0 ? '−' : ''}${Math.abs(cent) % 100 === 0 ? Math.abs(cent) / 100 : (Math.abs(cent) / 100).toFixed(2).replace('.', ',')} €`

/**
 * Il totale che sta sempre nella barra al passo del corso, dove ogni scelta lo cambia: la stessa stima del
 * riepilogo (stessi centesimi), solo scritta corta. In famiglia è `totaleDellaFamiglia`. A QUANTO PAGHI no: lì il
 * conto è il contenuto del passo. Senza corso scelto, senza listino e negli altri passi non c'è.
 */
export function totaleDelPasso(s: StatoPassi, passo: number, corsi: CorsoRef[], listino: Listino | undefined, giorno: string): TotaleDelPasso | undefined {
  if (tipiDiPassi(s.chi)[passo - 1] !== 'corso') return undefined
  const c = contoCorto(persona(s, corsi), listino, giorno)
  return c && { etichetta: 'TOTALE', righe: c.righe, totale: c.totale }
}

/** Il totale della barra: l'etichetta dice se la cifra è di tutti (TOTALE FAMIGLIA) o di chi si iscrive. */
export interface TotaleDelPasso {
  etichetta: 'TOTALE' | 'TOTALE FAMIGLIA'
  righe: string
  totale: string
}

/** Il conto di una persona, scritto corto; `undefined` senza listino o senza un corso che c'è nell'elenco. */
function contoCorto(lui: { corsi: CorsoRef[]; formula: Formula }, listino: Listino | undefined, giorno: string): { righe: string; totale: string; senzaPrezzo: string[] } | undefined {
  if (!listino || !lui.corsi.length) return undefined
  const conto = stimaIscrizione({ chi: '', ...lui }, [], giorno, listino)
  // Un corso senza prezzo nel listino non vale 0: lo dice la riga, e il totale è quello che si sa.
  const daConfermare = conto.senzaPrezzo.map((nome) => `${nome} prezzo da confermare`)
  // Le righe si accorciano: «Quota associativa» → «Quota», «Annuale Judo adulti» → «Judo adulti annuale».
  const voce = (testo: string) => testo.replace(/^Quota associativa$/, 'Quota').replace(/^(Annuale|Trimestre|Saldo)\s+(.+)$/i, (_, f: string, c: string) => `${c} ${f.toLowerCase()}`)
  return {
    righe: [...conto.righe.map((r) => `${voce(r.testo)} ${euroBreve(r.importo)}`), ...daConfermare].join(' + '),
    totale: euroBreve(conto.totale),
    senzaPrezzo: conto.senzaPrezzo,
  }
}

/** Se chi esce perde qualcosa che ha scritto: la stessa regola della domanda di INDIETRO, per l'avviso del browser. */
export const rispostePerdibili = (s: StatoPassi): boolean => domandaUscita(perDomandaUscita(s)) !== undefined

/**
 * Cosa dice la schermata «RICHIESTA ARRIVATA». `pagamento` decide il blocco del conto: `ricevuta` (già caricata, la segreteria
 * controlla), `importo` (da pagare, con la cifra) o `senzaImporto` (da pagare ma la cifra non si sa: listino non letto, corso non in elenco).
 * `famiglia` sono le due richieste (bambino e genitore): l'importo è quello del conto con lo sconto, se c'è (`conSconto`).
 */
export function riassuntoEsito(
  s: StatoPassi,
  corsi: CorsoRef[],
  listino: Listino | undefined,
  giorno: string,
  /** Più persone nello stesso modulo (`s` è la prima): il conto è quello della famiglia, e la ricevuta di una basta. */
  persone?: StatoPassi[],
): {
  importo?: string
  pagamento: 'ricevuta' | 'importo' | 'senzaImporto'
  daPagare: boolean
  famiglia: boolean
  conSconto: boolean
  senzaPrezzo: string[]
  contatti: { email: string; telefono: string }
} {
  const piu = persone && persone.length > 1
  const famiglia = piu ? contoDellaFamiglia(persone, corsi, listino, giorno) : undefined
  const solo = famiglia || piu ? undefined : contoCorto(persona(s, corsi), listino, giorno)
  const importo = famiglia ? euroBreve(famiglia.totale) : solo?.totale
  const daPagare = !(piu ? persone : [s]).some((p) => p.file.ricevuta)
  return {
    importo,
    pagamento: !daPagare ? 'ricevuta' : importo ? 'importo' : 'senzaImporto',
    daPagare,
    famiglia: !!famiglia,
    conSconto: famiglia?.sconto !== undefined,
    senzaPrezzo: famiglia?.senzaPrezzo ?? solo?.senzaPrezzo ?? [],
    contatti: { email: s.risposte.email.trim(), telefono: s.risposte.telefono.trim() },
  }
}

/** «La segreteria ti scrive a …, se manca qualcosa»: con l'email, il telefono o tutti e due. */
export function fraseContatti(email: string, telefono: string): string | undefined {
  const e = email.trim()
  const t = telefono.trim()
  if (!e && !t) return undefined
  const come = [e && `ti scrive a ${e}`, t && `ti chiama al ${t}`].filter(Boolean).join(' o ')
  return `La segreteria ${come}, se manca qualcosa.`
}

/** I file da chiedere: il certificato solo dai 6 anni, e quale lo dice l'età e il corso. */
export function fileDaChiedere(natoIl: string, nomiCorsi: string[], oggi = new Date()) {
  const certificato = certificatoDaPortare(natoIl, nomiCorsi, oggi)
  return {
    certificato,
    file: FILE.filter((f) => certificato !== 'nessuno' || f.tipo !== 'certificato').map((f) => ({ tipo: f.tipo, etichetta: f.etichetta, obbligatorio: f.obbligatorio })),
  }
}

/** Cosa manca per fare il modulo firmato; `null` se si può. Come `ModuloIscrizione`, ma coi tratti contati. */
export function mancaPerFirmare(s: StatoPassi): string | null {
  if (s.file.modulo) return null
  if (s.scelte.tesseramento === undefined) return 'Nel modulo: scegli se acconsenti al tesseramento alla FIJLKAM e/o FIPE'
  if (s.scelte.foto === undefined) return 'Nel modulo: scegli se autorizzi le foto'
  if (s.chi === 'figlio' && !s.natoAGenitore.trim()) return 'Nel modulo: manca dove è nato il genitore'
  if (!s.tratti) return 'Manca la firma sul modulo'
  return null
}

export interface RigaRiepilogo {
  etichetta: string
  valore: string
  /** Di cosa parla la riga: la schermata sceglie da qui il titolo, non dall'etichetta. */
  cosa: 'corso' | 'genitore' | 'certificato' | 'ricevuta'
  /** A quale passo manda MODIFICA o CARICA. */
  passo: 'dati' | 'genitore' | 'corso' | 'modulo' | 'documenti' | 'pagamento'
  manca?: boolean
  carica?: TipoFile
}

/**
 * Se chi si iscrive deve ancora portare il certificato medico (`['chi']`), per la sua età e i suoi corsi. Lo
 * usano il riepilogo e l'esito, così non possono dire cose diverse; in famiglia ognuno per sé.
 */
export function certificatiMancanti(s: StatoPassi, corsi: CorsoRef[], oggi = new Date()): Array<'chi'> {
  const r = risposteDaiPassi(s, oggi)
  const nomi = (ids: string[]) => ids.map((id) => corsi.find((c) => c.id === id)?.nome ?? id)
  return certificatoDaPortare(r.natoIl, nomi(r.corsi), oggi) !== 'nessuno' && !s.file.certificato ? ['chi'] : []
}

export function righeRiepilogo(s: StatoPassi, corsi: CorsoRef[], oggi = new Date()): RigaRiepilogo[] {
  const r = risposteDaiPassi(s, oggi)
  const nomi = (ids: string[]) => ids.map((id) => corsi.find((c) => c.id === id)?.nome ?? id)
  const seManca = (t: TipoFile) => FILE.find((f) => f.tipo === t)?.seManca ?? ''
  const certificato = (natoIl: string, ids: string[], dato: File | undefined): RigaRiepilogo[] =>
    certificatoDaPortare(natoIl, nomi(ids), oggi) === 'nessuno'
      ? []
      : [
          dato
            ? { etichetta: ETICHETTA_FILE.certificato, valore: dato.name, cosa: 'certificato', passo: 'documenti' }
            : { etichetta: ETICHETTA_FILE.certificato, valore: seManca('certificato'), cosa: 'certificato', passo: 'documenti', manca: true, carica: 'certificato' },
        ]
  const righe: RigaRiepilogo[] = [{ etichetta: 'CORSO', valore: nomi(r.corsi).join(', '), cosa: 'corso', passo: 'corso' }]
  if (s.chi === 'figlio') righe.push({ etichetta: 'GENITORE', valore: `${r.genitoreNome ?? ''} ${r.genitoreCognome ?? ''}`.trim(), cosa: 'genitore', passo: 'genitore' })
  righe.push(...certificato(r.natoIl, r.corsi, s.file.certificato))
  righe.push(rigaDellaRicevuta([s]))
  return righe
}

/** La riga della ricevuta nel riepilogo: una per tutto il modulo, chiunque l'abbia caricata; porta a QUANTO PAGHI. */
export function rigaDellaRicevuta(persone: StatoPassi[]): RigaRiepilogo {
  const ricevuta = ricevutaDelModulo(persone)
  return ricevuta
    ? { etichetta: ETICHETTA_FILE.ricevuta, valore: ricevuta.name, cosa: 'ricevuta', passo: 'pagamento' }
    : { etichetta: ETICHETTA_FILE.ricevuta, valore: FILE.find((f) => f.tipo === 'ricevuta')?.seManca ?? '', cosa: 'ricevuta', passo: 'pagamento', manca: true, carica: 'ricevuta' }
}

// --- la stessa ora ------------------------------------------------------------

const minuti = (ora: string) => {
  const [h, m] = ora.split(':').map(Number)
  return h * 60 + (m || 0)
}
/** Due lezioni lo stesso giorno che si sovrappongono anche in parte: una che comincia quando l'altra finisce no. */
const siToccano = (a: OrarioAperto, b: OrarioAperto) =>
  a.giorno === b.giorno && minuti(a.ora) < minuti(b.ora) + b.durata && minuti(b.ora) < minuti(a.ora) + a.durata

export type CorsoParallelo = CorsoPerEta & { stessaOra: true; giorni?: number[] }

/**
 * I corsi per l'età del genitore che si fanno mentre il figlio è in palestra:
 * dal calendario, almeno un giorno in comune. `giorni` c'è solo se non tutti i
 * giorni del corso del genitore lo sono. Prima quelli con tutti i giorni.
 */
export function corsiParalleli(corsi: CorsoRef[], voci: VoceCosto[], natoIlGenitore: string, corsiFiglio: string[], orari: OrarioAperto[]): CorsoParallelo[] {
  const delFiglio = orari.filter((o) => corsiFiglio.includes(o.corsoId))
  if (!delFiglio.length) return []
  const perEta = corsiPerEta(corsi, voci, natoIlGenitore)
  // Senza fascia d'età si propongono solo i corsi che il listino non ha (Preparazione atletica 1, 2, 3):
  // una voce senza anni di nascita ha l'età scritta a parole, spesso dei piccoli («3-4-5 anni»).
  const senzaVoce = perEta.senzaAnni.filter((c) => !voceDelCorso(voci, c))
  const trovati = [...perEta.adatti, ...senzaVoce].flatMap((c): CorsoParallelo[] => {
    if (corsiFiglio.includes(c.id)) return []
    const suoi = orari.filter((o) => o.corsoId === c.id)
    const giorni = [...new Set(suoi.map((o) => o.giorno))]
    const comuni = giorni.filter((g) => suoi.some((o) => o.giorno === g && delFiglio.some((f) => siToccano(o, f))))
    if (!comuni.length) return []
    return [{ ...c, stessaOra: true, ...(comuni.length < giorni.length && { giorni: comuni.sort(perSettimana) }) }]
  })
  return [...trovati.filter((c) => !c.giorni), ...trovati.filter((c) => c.giorni)]
}

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
/** La settimana della palestra comincia il lunedì. */
const perSettimana = (a: number, b: number) => ((a + 6) % 7) - ((b + 6) % 7)
const orologio = (m: number) => `${Math.floor(m / 60)}.${String(m % 60).padStart(2, '0')}`

/**
 * L'orario di un corso dal calendario, come lo scrive il volantino: «lunedì, mercoledì e venerdì 18.00-19.00».
 * `soloInizio`: «lunedì e giovedì 18.00», corto, per le carte di LA FAMIGLIA.
 */
export function orarioDetto(orari: OrarioAperto[], corsoId: string, soloInizio = false): string {
  const pezzi = new Map<string, number[]>()
  for (const o of orari.filter((x) => x.corsoId === corsoId)) {
    const fascia = soloInizio ? orologio(minuti(o.ora)) : `${orologio(minuti(o.ora))}-${orologio(minuti(o.ora) + o.durata)}`
    pezzi.set(fascia, [...(pezzi.get(fascia) ?? []), o.giorno])
  }
  const ordinati = [...pezzi].map(([fascia, giorni]): [string, number[]] => [fascia, [...new Set(giorni)].sort(perSettimana)])
  // Anche i pezzi in ordine di settimana: chi legge parte dal lunedì.
  ordinati.sort((a, b) => perSettimana(a[1][0], b[1][0]))
  return ordinati.map(([fascia, giorni]) => `${elenco(giorni.map((g) => GIORNI[g]))} ${fascia}`).join(' · ')
}

/**
 * I corsi per l'età del genitore, con quelli alla stessa ora del figlio a
 * parte, in cima: il gruppo dice «alla stessa ora di <di>», la riga solo i
 * giorni quando non sono tutti, poi età e orari del listino (o del calendario).
 */
export function corsiPerEtaConStessaOra(corsi: CorsoRef[], listino: Listino | undefined, natoIl: string, corsiFiglio: string[], orari: OrarioAperto[]) {
  const perEta = corsiPerEta(corsi, listino?.corsi ?? [], natoIl, listino?.senzaPrezzoVaBene)
  const paralleli = listino ? corsiParalleli(corsi, listino.corsi, natoIl, corsiFiglio, orari) : []
  const ids = new Set(paralleli.map((c) => c.id))
  const tutti = new Map([...perEta.adatti, ...perEta.senzaAnni].map((c) => [c.id, c]))
  const stessaOra = paralleli.map((p): CorsoPerEta => {
    const c = tutti.get(p.id) ?? p
    const giorni = p.giorni && `stessa ora ${elenco(p.giorni.map((g) => `il ${GIORNI[g]}`))}`
    const riga = [giorni, c.riga ?? (orarioDetto(orari, c.id) || undefined)].filter(Boolean).join(' · ')
    return { id: c.id, nome: c.nome, ...(riga && { riga }), ...(c.prezzoDaConfermare && { prezzoDaConfermare: true as const }) }
  })
  // Fuori dalla stessa ora restano i corsi per lui; quelli del figlio no, nemmeno fra gli altri. Senza riga del listino, l'orario del calendario.
  const resto = (elenco: CorsoPerEta[]) =>
    elenco.filter((c) => !ids.has(c.id) && !corsiFiglio.includes(c.id)).map((c) => (c.riga ? c : { ...c, ...(orarioDetto(orari, c.id) && { riga: orarioDetto(orari, c.id) }) }))
  return { ...perEta, stessaOra, adatti: resto(perEta.adatti), senzaAnni: resto(perEta.senzaAnni), altri: perEta.altri.filter((c) => !corsiFiglio.includes(c.id)) }
}

// --- LA FAMIGLIA: le carte e il corso già spuntato -----------------------------

/** I corsi di `ids` che si fanno mentre la persona 0 è in palestra: almeno una lezione che si tocca con una delle sue. */
function allaStessaOraDi(ids: readonly string[], dellaPersona0: readonly string[], orari: OrarioAperto[]): string[] {
  const sue = orari.filter((o) => dellaPersona0.includes(o.corsoId))
  return ids.filter((id) => !dellaPersona0.includes(id) && orari.some((o) => o.corsoId === id && sue.some((x) => siToccano(o, x))))
}

/**
 * Un corso per bambini: il listino gli dà anni di nascita, e un minorenne ci sta (l'ultimo anno è di chi ha meno di
 * 18 anni). Senza anni non si sa: non si propone a un bambino.
 */
function perBambini(voci: VoceCosto[], corso: CorsoRef, anno: number): boolean {
  const v = voceDelCorso(voci, corso)
  if (!v || (v.natiDal === undefined && v.natiAl === undefined)) return false
  return v.natiAl === undefined || Number(v.natiAl) > anno - 18
}

/** Una carta di LA FAMIGLIA: chi aggiunge, cosa dice, i corsi alla stessa ora e quanto si risparmia, il tasto. */
export interface CartaFamiglia {
  chi: Chi
  titolo: string
  frase: string
  /** «Judo 3 · lunedì e giovedì 18.00»; da tre corsi in su si contano. Non c'è senza corsi alla stessa ora. */
  stessaOra?: string
  /** Con un corso solo alla stessa ora e il suo prezzo: lo sconto famiglia se tutti e due fanno l'annuale. */
  risparmio?: string
  tasto: string
}

/**
 * Le due carte di LA FAMIGLIA, girate sulla persona 0 (chi si iscrive da adulto, o il bambino che si iscrive): un
 * bambino a un corso alla stessa ora, e un adulto (chi compila, o un altro) allo stesso corso o a uno alla stessa ora.
 * Uno o due corsi si nominano, coi giorni e l'ora di inizio; da tre in su si contano.
 */
export function carteDellaFamiglia(persone: StatoPassi[], corsi: CorsoRef[], listino: Listino | undefined, orari: OrarioAperto[], giorno: string): CartaFamiglia[] {
  const zero = persone[0]
  const bambino = zero.chi === 'figlio'
  const nome = nomeDellaPersona(zero, 0)
  const suoi = corsi.filter((c) => zero.risposte.corsi.includes(c.id))
  const nomiSuoi = elenco(suoi.map((c) => c.nome))
  const voci = listino?.corsi ?? []
  const anno = Number(giorno.slice(0, 4))
  // Per un bambino in più: i corsi per bambini alla stessa ora; per un adulto, con la persona 0 adulta i suoi corsi,
  // con la persona 0 bambino quelli per l'età del genitore che si fanno mentre il bambino è in palestra.
  const perFiglio = listino ? allaStessaOraDi(corsi.filter((c) => perBambini(voci, c, anno)).map((c) => c.id), zero.risposte.corsi, orari) : []
  const natoIlGenitore = dataDaCf(zero.risposte.genitoreCodiceFiscale ?? '', '') ?? ''
  const perAdulto = bambino ? (listino ? corsiParalleli(corsi, voci, natoIlGenitore, zero.risposte.corsi, orari).map((c) => c.id) : []) : suoi.map((c) => c.id)
  const ref = (ids: string[]) => ids.flatMap((id) => corsi.filter((c) => c.id === id))
  const stessaOra = (ids: string[]) => {
    if (!ids.length) return undefined
    if (ids.length > 2) return `${ids.length} corsi: li trovi in cima quando scegli il corso`
    return ref(ids).map((c) => [c.nome, orarioDetto(orari, c.id, true)].filter(Boolean).join(' · ')).join('; ')
  }
  // Lo sconto si conta come se tutti e due facessero l'annuale: è quello che si risparmia scegliendolo.
  const risparmio = (ids: string[]) => {
    if (ids.length !== 1 || !listino || !suoi.length) return undefined
    const [c] = ref(ids)
    const sconto = c && contoFamiglia([{ chi: '0', corsi: suoi, formula: 'annuale' }, { chi: '1', corsi: [c], formula: 'annuale' }], giorno, listino).sconto
    return sconto ? `Con ${c.nome} annuale risparmiate ${euroBreve(sconto)}` : undefined
  }
  const quanti = (ids: string[]) => (ids.length === 1 ? 'c’è un corso' : `ci sono ${NUMERI[ids.length] ?? ids.length} corsi`)
  const carta = (chi: Chi, titolo: string, frase: string, ids: string[], tasto: string): CartaFamiglia => {
    const ora = stessaOra(ids)
    const quanto = risparmio(ids)
    return { chi, titolo, frase, ...(ora && { stessaOra: ora }), ...(quanto && { risparmio: quanto }), tasto }
  }
  const conLio = persone.some((p) => p.io)
  if (bambino)
    return [
      carta('figlio', 'UN FRATELLO O UNA SORELLA', perFiglio.length ? `Un solo viaggio in palestra: alla stessa ora di ${nome} ${quanti(perFiglio)} anche per lui.` : 'Un fratello o una sorella nello stesso modulo, con lo sconto famiglia sull’annuale.', perFiglio, '+ AGGIUNGI UN BAMBINO'),
      carta(
        'adulto',
        conLio ? 'UN ALTRO ADULTO' : 'TU O UN ALTRO ADULTO',
        perAdulto.length && !conLio ? `Mentre ${nome} fa ${nomiSuoi}, ti alleni anche tu, alla stessa ora.` : 'Un adulto della famiglia nello stesso modulo, con lo sconto famiglia sull’annuale.',
        perAdulto,
        '+ AGGIUNGI UN ADULTO',
      ),
    ]
  return [
    carta('figlio', 'UN FIGLIO O UNA FIGLIA', perFiglio.length ? `Mentre fai ${nomiSuoi}, si allena anche lui: ${quanti(perFiglio)} per bambini alla stessa ora.` : 'Un figlio o una figlia nello stesso modulo: scegli il suo corso, per la sua età.', perFiglio, '+ AGGIUNGI UN FIGLIO'),
    carta('adulto', 'UN ALTRO ADULTO', suoi.length ? `Venite insieme: ${nomiSuoi}, ${suoi.length > 1 ? 'gli stessi corsi' : 'lo stesso corso'}, gli stessi giorni.` : 'Un altro adulto nello stesso modulo, con lo sconto famiglia sull’annuale.', perAdulto, '+ AGGIUNGI UN ADULTO'),
  ]
}

/** La domanda in cima a LA FAMIGLIA, e cosa dice lo sconto: con la persona 0 bambino si parla di fratelli. */
export const frasiDellaFamiglia = (zero: StatoPassi) =>
  zero.chi === 'figlio'
    ? { domanda: 'Iscrivi anche qualcun altro della famiglia?', sconto: 'Sull’annuale che costa meno della famiglia, anche fra fratelli.' }
    : { domanda: 'Iscrivi anche qualcuno della tua famiglia?', sconto: 'Sull’annuale che costa meno della famiglia. Più siete, più conviene.' }

/**
 * I corsi da spuntare quando un familiare arriva al suo passo del corso senza averne scelto uno: un adulto con la
 * persona 0 adulta va ai suoi corsi; gli altri al corso per la loro età alla stessa ora della persona 0, se è uno
 * solo (fra due o più si sceglie da sé).
 */
export function corsiGiaScelti(persone: StatoPassi[], i: number, corsi: CorsoRef[], listino: Listino | undefined, orari: OrarioAperto[]): string[] {
  const zero = persone[0]
  const lui = conDatiDellaFamiglia(persone)[i]
  if (i === 0 || !lui || lui.risposte.corsi.length) return []
  if (lui.chi === 'adulto' && zero.chi === 'adulto') return [...zero.risposte.corsi]
  if (!listino) return []
  const paralleli = corsiParalleli(corsi, listino.corsi, risposteDaiPassi(lui).natoIl, zero.risposte.corsi, orari)
  return paralleli.length === 1 ? [paralleli[0].id] : []
}

/**
 * I corsi di un familiare, coi corsi alla stessa ora della persona 0 in cima: per un adulto con la persona 0 adulta
 * i suoi corsi, per gli altri quelli per la sua età che si toccano coi suoi (`corsiPerEtaConStessaOra`). Gli altri
 * restano quelli per l'età, compresi i corsi della persona 0: un fratello può fare lo stesso.
 */
export function corsiDelFamiliare(persone: StatoPassi[], i: number, corsi: CorsoRef[], listino: Listino | undefined, orari: OrarioAperto[]) {
  const lui = conDatiDellaFamiglia(persone)[i]
  const natoIl = risposteDaiPassi(lui).natoIl
  const perEta = corsiPerEta(corsi, listino?.corsi ?? [], natoIl, listino?.senzaPrezzoVaBene)
  if (i === 0) return { ...perEta, stessaOra: [] }
  const zero = persone[0].risposte.corsi
  const tutti = [...perEta.adatti, ...perEta.senzaAnni, ...perEta.altri]
  const stessaOra = lui.chi === 'adulto' && persone[0].chi === 'adulto' ? tutti.filter((c) => zero.includes(c.id)) : corsiPerEtaConStessaOra(corsi, listino, natoIl, zero, orari).stessaOra
  const fuori = (elenco: CorsoPerEta[]) => elenco.filter((c) => !stessaOra.some((x) => x.id === c.id))
  return { ...perEta, stessaOra, adatti: fuori(perEta.adatti), senzaAnni: fuori(perEta.senzaAnni), altri: fuori(perEta.altri) }
}

/** L'avviso sotto l'elenco del genitore, se il figlio ha cambiato corso. */
export function fraseNonPiuAllaStessaOra(nomi: string[], nome: string): string | undefined {
  if (!nomi.length) return undefined
  return `${elenco(nomi)} ${nomi.length > 1 ? 'non sono' : 'non è'} più alla stessa ora di ${nome}.`
}

/**
 * Il conto della famiglia: ognuno con la sua stima, gli annuali degli altri
 * contano per lo sconto (20% sul più basso, quota esclusa), che si toglie una
 * volta sola anche a prezzi uguali, e sulla riga di chi ha quell'annuale: in
 * qualunque ordine stiano le persone. Centesimi; lo sconto è positivo.
 */
export function contoFamiglia(
  persone: Array<{ chi: string; corsi: Array<string | CorsoRef>; formula: Formula }>,
  giorno: string,
  listino: Listino,
): { righe: RigaStima[]; totale: number; sconto?: number; senzaPrezzo: string[] } {
  // Gli annuali di una persona, uno per corso: il prezzo lo dice la stessa stima di oggi.
  const annuali = (p: (typeof persone)[number]): Abbonamento[] =>
    p.formula !== 'annuale'
      ? []
      : p.corsi.flatMap((corso) => {
          const st = stimaIscrizione({ chi: p.chi, corsi: [corso], formula: 'annuale' }, [], giorno, listino)
          return st.senzaPrezzo.length ? [] : [{ chi: p.chi, corso: typeof corso === 'string' ? corso : corso.nome, importo: st.righe[1].importo }]
        })
  const righe: RigaStima[] = []
  let totale = 0
  let sconto: number | undefined
  // Lo sconto passa da `sconto` anche quando sta sulla riga di un altro: «già tolto» è solo se una riga di sconto è già entrata, se no chi viene dopo lo perde.
  let tolto = false
  const senzaPrezzo: string[] = []
  persone.forEach((p, i) => {
    const st = stimaIscrizione(p, persone.flatMap((x, j) => (j === i ? [] : annuali(x))), giorno, listino)
    const doppio = st.sconto?.qui && tolto
    const mie = doppio ? st.righe.slice(0, -1) : st.righe
    if (st.sconto?.qui) tolto = true
    righe.push(...mie.map((r) => ({ ...r, testo: `${p.chi}: ${r.testo}` })))
    totale += mie.reduce((t, r) => t + r.importo, 0)
    sconto = sconto ?? st.sconto?.importo
    senzaPrezzo.push(...st.senzaPrezzo)
  })
  return { righe, totale, sconto, senzaPrezzo }
}

/** Chi si iscrive nello stato dei passi, come entra in ogni conto: nome (o «Il bambino» / «Chi si iscrive»), corsi e formula. */
const persona = (s: StatoPassi, corsi: CorsoRef[]) => ({
  chi: s.risposte.nome.trim() || (s.chi === 'figlio' ? 'Il bambino' : 'Chi si iscrive'),
  corsi: corsi.filter((c) => s.risposte.corsi.includes(c.id)),
  formula: s.risposte.formula,
})

/**
 * Il conto di tutta la famiglia, di chi ha già scelto un corso: `contoFamiglia` con le persone dello stato.
 * `persone` dice quanto fa ognuno (quota e corsi, lo sconto resta a parte). Due con lo stesso nome si
 * distinguono col posto, se no le righe e le cifre si confondono.
 */
export function contoDellaFamiglia(persone: StatoPassi[], corsi: CorsoRef[], listino: Listino | undefined, giorno: string) {
  if (!listino) return undefined
  const dentro = persone
    .map((s, i) => {
      const nome = nomeDellaPersona(s, i)
      const chi = persone.some((x, j) => j !== i && nomeDellaPersona(x, j) === nome) ? `${nome} ${i + 1}` : nome
      return { chi, corsi: corsi.filter((c) => s.risposte.corsi.includes(c.id)), formula: s.risposte.formula }
    })
    .filter((x) => x.corsi.length)
  if (!dentro.length) return undefined
  const conto = contoFamiglia(dentro, giorno, listino)
  const quanto = (chi: string) => conto.righe.filter((r) => r.importo > 0 && r.testo.startsWith(`${chi}: `)).reduce((t, r) => t + r.importo, 0)
  return { ...conto, persone: dentro.map((x) => ({ chi: x.chi, importo: quanto(x.chi) })) }
}

/**
 * Il totale sopra la barra quando le persone sono più d'una: quello di tutta la famiglia, ognuno con la sua
 * cifra e lo sconto a parte. Nello stesso passo di `totaleDelPasso` (il corso, di chi è aperto);
 * con una persona sola è `totaleDelPasso`.
 */
export function totaleDellaFamiglia(persone: StatoPassi[], attivo: number, passo: number, corsi: CorsoRef[], listino: Listino | undefined, giorno: string): TotaleDelPasso | undefined {
  if (persone.length < 2) return totaleDelPasso(persone[0], passo, corsi, listino, giorno)
  if (tipiDiPassi(persone[attivo].chi)[passo - 1] !== 'corso') return undefined
  const c = contoDellaFamiglia(persone, corsi, listino, giorno)
  if (!c) return undefined
  const righe = [...c.persone.map((x) => `${x.chi} ${euroBreve(x.importo)}`), ...c.senzaPrezzo.map((nome) => `${nome} prezzo da confermare`)].join(' + ')
  return { etichetta: 'TOTALE FAMIGLIA', righe: c.sconto ? `${righe} − sconto famiglia ${euroBreve(c.sconto)}` : righe, totale: euroBreve(c.totale) }
}

/**
 * Una riga per persona nell'ultimo passo di una famiglia: chi è, il corso e come paga, o cosa manca (le prime
 * tre cose); `passo` è dove porta MODIFICA, o VAI A se manca qualcosa: dove va scritta la prima cosa che manca.
 */
export function righeDellaFamiglia(persone: StatoPassi[], corsi: CorsoRef[], oggi = new Date()): Array<{ titolo: string; dettaglio: string; manca: boolean; passo: number }> {
  return persone.map((s, i) => {
    const manca = mancanti(s, ultimoPasso(s), oggi)
    const nomi = manca.map((p) => p.nome.toLowerCase())
    const corsiScelti = corsi.filter((c) => s.risposte.corsi.includes(c.id)).map((c) => c.nome)
    return {
      titolo: `${nomeDellaPersona(s, i)} ${nomeProprio(s.risposte.cognome)}`.trim(),
      dettaglio: manca.length ? `manca: ${nomi.slice(0, 3).join(', ')}${nomi.length > 3 ? ` e altre ${nomi.length - 3}` : ''}` : `${corsiScelti.join(', ')} · ${s.risposte.formula}`,
      manca: manca.length > 0,
      passo: (manca.length && passoDelCampo(s, manca[0].chiave, oggi)) || 1,
    }
  })
}

// --- mandare ------------------------------------------------------------------

/**
 * Le note arrivano al database con un massimo di 1000 caratteri: chi scrive ne
 * ha 900, il resto è per la riga che lega le due richieste di una famiglia.
 */
export const MASSIMO_NOTE = 900

/**
 * Le note di una richiesta con la riga che la lega alle altre della famiglia, a capo. La riga coi nomi si usa
 * solo se ci sta nei 1000 caratteri del database (due nomi da 60 + 60 e note da 900 non ci stanno); se no
 * una riga corta fissa, che dice solo quante sono.
 */
export function conIlLegame(note: string | undefined, altri: string[]): string {
  const sconto = 'sconto famiglia da applicare'
  const coiNomi = altri.length === 1 ? `mandata insieme alla richiesta di ${altri[0]}, ${sconto}` : `con ${altri.join(', ')}: ${sconto}`
  const corta = `con ${altri.length === 1 ? 'un’altra persona' : `altre ${NUMERI[altri.length]} persone`} della famiglia: ${sconto}`
  const con = (riga: string) => (note ? `${note}\n${riga}` : riga)
  return con(coiNomi).length <= NOTE_NEL_DATABASE ? con(coiNomi) : con(corta)
}

/** Una richiesta da mandare: i suoi dati, i file, e come si fa il suo PDF se il foglio non è in foto. */
export interface DaMandare {
  dati: DatiRichiesta
  file: Partial<Record<TipoFile, File>>
  faiPdf?: () => Promise<File>
}

/** Cosa serve per compilare il PDF di una persona. */
export interface PerIlPdf {
  dati: DatiRichiesta
  minore: boolean
  scelte: Scelte
  natoA: string
  provincia: string
}

/**
 * Cosa parte per una persona, dallo stato (con `conDatiDellaFamiglia` i dati presi dagli altri ci sono): la sua
 * richiesta, coi suoi file. Il foglio firmato in foto, se c'è, è dell'unica richiesta che ha scelto di mandarlo; se
 * no il PDF lo fa l'app. L'io porta il luogo di nascita scritto per il bambino 0: la provincia la dice `provincia`,
 * se il luogo non ce l'ha già.
 */
export function richiesteDaMandare(s: StatoPassi, provincia: string, faiPdf: (c: PerIlPdf) => Promise<File>, oggi = new Date()): DaMandare[] {
  const r = risposteDaiPassi(s, oggi)
  const luogo = r.natoA.trim()
  const conProvincia = s.io && luogo && provincia && !/\([A-Z]{2}\)$/i.test(luogo)
  const dati = conProvincia ? { ...r, natoA: scriviLuogo({ nome: luogo, sigla: provincia }) } : r
  return [{ dati, file: s.file, faiPdf: s.file.modulo ? undefined : () => faiPdf({ dati, minore: s.chi === 'figlio', scelte: s.scelte, natoA: s.natoAGenitore, provincia }) }]
}

/** La ricevuta del modulo va in ogni richiesta: un bonifico solo per tutti, e nessuna richiesta dice «nessuna ricevuta». */
export const conLaRicevutaInTutte = (daMandare: DaMandare[], ricevuta: File | undefined): DaMandare[] =>
  daMandare.map((x) => {
    const { ricevuta: _, ...file } = x.file
    return { ...x, file: ricevuta ? { ...file, ricevuta } : file }
  })

/** Le richieste di tutto il modulo: quelle di ogni persona (`perPersona`), con la ricevuta del modulo in ognuna. */
export const richiesteDelModulo = (persone: StatoPassi[], perPersona: (s: StatoPassi, i: number) => DaMandare[]): DaMandare[] =>
  conLaRicevutaInTutte(persone.flatMap(perPersona), ricevutaDelModulo(persone))

/** Cosa dire se il PDF non viene: «Ho il foglio firmato» c'è tra le scelte solo da soli. */
export const moduloNonSiPrepara = (conFoglioInFoto: boolean) =>
  'Non riesco a preparare il modulo con la tua firma. Riprova fra un momento. ' +
  (conFoglioInFoto ? 'Se non va, torna indietro, scegli «Ho il foglio firmato», firma il modulo a mano e carica la foto.' : 'Se non va, chiama la segreteria.')

type Mancato = { richiesta: number; tipo: TipoFile }

export type Esito =
  | { esito: 'fatto'; ids: string[] }
  | { esito: 'fermo'; perche: string }
  | { esito: 'secondaNo'; perche: string; ids: string[]; riprova: () => Promise<Esito> }
  // Da tre persone in su: `arrivati` e `mancanti` sono i nomi, nell'ordine in cui si mandano; `ids` quelli di chi è arrivato.
  | { esito: 'aMeta'; perche: string; arrivati: string[]; mancanti: string[]; ids: string[]; riprova: () => Promise<Esito> }
  | { esito: 'file'; perche: string; mancati: Mancato[]; riprova: () => Promise<Esito> }

/**
 * L'esito a metà detto per nome: quante richieste sono arrivate su quante, di chi, e di chi no. Si parla
 * di richieste e non di persone («arrivate», «partite»), così il genere dei nomi non conta.
 */
export function fraseAMeta(arrivati: string[], mancanti: string[]): { titolo: string; arrivate: string; mancano: string } {
  const una = (n: string[]) => n.length === 1
  return {
    titolo: `${una(arrivati) ? 'ARRIVATA 1 RICHIESTA' : `ARRIVATE ${arrivati.length} RICHIESTE`} SU ${arrivati.length + mancanti.length}`,
    arrivate: una(arrivati) ? `La richiesta di ${elenco(arrivati)} è arrivata e resta: non la rimandiamo.` : `Le richieste di ${elenco(arrivati)} sono arrivate e restano: non le rimandiamo.`,
    mancano: `${una(mancanti) ? 'Quella' : 'Quelle'} di ${elenco(mancanti)} ${una(mancanti) ? 'non è partita' : 'non sono partite'}. Riprova ora, oppure chiama la segreteria.`,
  }
}

/**
 * Come `ModuloIscrizione.manda`, per una o più persone: prima i PDF (se uno
 * non viene non nasce niente), poi per ognuna la richiesta e i suoi file uno
 * alla volta. Se una richiesta dopo la prima si ferma, quelle prima sono
 * arrivate: RIPROVA rimanda solo da quella in poi, mai le arrivate (sarebbero
 * doppioni).
 */
export function mandaRichieste(d: DatiRichieste, daMandare: DaMandare[]): Promise<Esito> {
  // Due tocchi nello stesso istante: la seconda chiamata ha gli stessi dati e aspetta la prima, non manda un doppione.
  const chiave = JSON.stringify(daMandare.map((x) => x.dati))
  const inCorso = invii.get(chiave)
  if (inCorso) return inCorso
  const giro = mandaDavvero(d, daMandare).finally(() => invii.delete(chiave))
  invii.set(chiave, giro)
  return giro
}

const invii = new Map<string, Promise<Esito>>()

/** Una sola esecuzione alla volta: chi chiama mentre la prima è in volo riceve la stessa promessa. */
function unaAlla<T>(f: () => Promise<T>): () => Promise<T> {
  let inVolo: Promise<T> | undefined
  return () => (inVolo ??= f().finally(() => (inVolo = undefined)))
}

async function mandaDavvero(d: DatiRichieste, daMandare: DaMandare[]): Promise<Esito> {
  const file: Array<Partial<Record<TipoFile, File>>> = []
  for (const r of daMandare) {
    try {
      file.push(r.faiPdf ? { ...r.file, modulo: await r.faiPdf() } : r.file)
    } catch (e) {
      // Chi usa l'app non legge il testo dell'errore: ci serve solo in console.
      console.error(e)
      return { esito: 'fermo', perche: moduloNonSiPrepara(daMandare.length === 1) }
    }
  }
  // Le richieste arrivano separate: la segreteria le lega da questa riga.
  // Il nome come lo scrive `invia`: la segreteria lo ritrova uguale in elenco.
  const nome = (x: DatiRichiesta) => `${nomeProprio(x.nome)} ${nomeProprio(x.cognome)}`
  const dati = daMandare.map(({ dati: x }, i) => {
    if (daMandare.length < 2) return x
    return { ...x, note: conIlLegame(x.note, daMandare.filter((_, j) => j !== i).map((y) => nome(y.dati))) }
  })

  const ids: string[] = []
  let mancati: Mancato[] = []
  let perche = ''
  const carica = async (richiesta: number, tipi: TipoFile[]) => {
    for (const tipo of tipi) {
      const f = file[richiesta][tipo]
      if (!f) continue
      try {
        await d.caricaFile(ids[richiesta], tipo, f)
      } catch (e) {
        mancati.push({ richiesta, tipo })
        perche = e instanceof Error ? e.message : 'Il file non è partito'
      }
    }
  }
  const finale = (): Esito =>
    mancati.length
      ? {
          esito: 'file',
          perche,
          mancati: [...mancati],
          riprova: unaAlla(async () => {
            const prima = mancati
            mancati = []
            for (const m of prima) await carica(m.richiesta, [m.tipo])
            return finale()
          }),
        }
      : { esito: 'fatto', ids: [...ids] }
  const manda = async (da: number): Promise<Esito> => {
    for (let i = da; i < dati.length; i++) {
      try {
        ids[i] = await d.invia(dati[i])
      } catch (e) {
        const motivo = e instanceof Error ? e.message : 'Il server non risponde: riprova fra poco'
        if (i === 0) return { esito: 'fermo', perche: motivo }
        const riprova = unaAlla(() => manda(i))
        if (dati.length === 2) return { esito: 'secondaNo', perche: motivo, ids: ids.slice(0, i), riprova }
        return { esito: 'aMeta', perche: motivo, arrivati: dati.slice(0, i).map(nome), mancanti: dati.slice(i).map(nome), ids: ids.slice(0, i), riprova }
      }
      await carica(i, FILE.map((f) => f.tipo))
    }
    return finale()
  }
  return manda(0)
}

// --- QUANTO PAGHI: il conto, la causale e la ricevuta di tutto il modulo -----

/**
 * Il conto di tutto il modulo, quello che si paga: in famiglia quello di `contoDellaFamiglia`, da soli la stima
 * della persona. Lo stesso totale del riepilogo e dell'esito. `undefined` senza listino o senza un corso scelto.
 */
export function contoDelModulo(persone: StatoPassi[], corsi: CorsoRef[], listino: Listino | undefined, giorno: string): { righe: RigaStima[]; totale: number; senzaPrezzo: string[]; conSconto: boolean } | undefined {
  if (!listino || !persone.length) return undefined
  const conto = (c: { righe: RigaStima[]; totale: number; senzaPrezzo: string[] }) => ({ righe: c.righe, totale: c.totale, senzaPrezzo: c.senzaPrezzo, conSconto: c.righe.some((x) => x.importo < 0) })
  if (persone.length > 1) {
    const c = contoDellaFamiglia(persone, corsi, listino, giorno)
    return c && conto(c)
  }
  const s = persone[0]
  const lui = persona(s, corsi)
  if (!lui.corsi.length) return undefined
  return conto(stimaIscrizione(lui, [], giorno, listino))
}

/**
 * Il modulo è di più persone (anche il bambino e chi lo compila, l'io). Decide il titolo del conto, la causale
 * coi nomi e il «Totale famiglia»: tutti dalla stessa regola.
 */
export const insieme = (persone: StatoPassi[]): boolean => persone.length > 1

/** Il bonifico SEPA tiene 140 caratteri di causale. */
const MASSIMO_CAUSALE = 140

/**
 * La causale del bonifico di tutto il modulo. Da soli come sempre, coi corsi; in più persone solo i nomi, il
 * cognome uguale scritto una volta: «Iscrizione Manuela e Nicola Albertini, Paola Rossi». Mai più lunga di quanto
 * il bonifico tiene. Le persone sono quelle di `conDatiDellaFamiglia`: l'io ha il nome del genitore.
 */
export function causaleDelModulo(persone: StatoPassi[], corsi: CorsoRef[]): string {
  const chi = persone.map((s) => ({ nome: s.risposte.nome.trim(), cognome: s.risposte.cognome.trim() }))
  if (chi.length === 1) {
    const r = persone[0].risposte
    return causale(r.nome.trim(), r.cognome.trim(), corsi.filter((c) => r.corsi.includes(c.id)).map((c) => c.nome)).slice(0, MASSIMO_CAUSALE)
  }
  const gruppi: Array<{ cognome: string; nomi: string[] }> = []
  for (const x of chi) {
    const chiave = x.cognome.toLocaleLowerCase('it')
    const g = gruppi.find((y) => y.cognome.toLocaleLowerCase('it') === chiave)
    if (g) g.nomi.push(x.nome)
    else gruppi.push({ cognome: x.cognome, nomi: [x.nome] })
  }
  const testo = gruppi.map((g) => `${elenco(g.nomi.filter(Boolean))} ${g.cognome}`.trim()).filter(Boolean).join(', ')
  return `Iscrizione ${testo}`.trim().slice(0, MASSIMO_CAUSALE)
}

/** La ricevuta del modulo, chiunque l'abbia: è una sola per tutti. */
export const ricevutaDelModulo = (persone: StatoPassi[]): File | undefined => persone.find((p) => p.file.ricevuta)?.file.ricevuta

/**
 * La ricevuta caricata (o tolta) a QUANTO PAGHI: sta nella prima persona e in nessun'altra, col totale e quante
 * persone c'erano, così se dopo il conto cambia lo si dice (`avvisoRicevuta`).
 */
export function conLaRicevuta(persone: StatoPassi[], ricevuta: File | undefined, totale: number | undefined): StatoPassi[] {
  return persone.map((p, i) => {
    const { ricevuta: _, ...file } = p.file
    const { ricevutaPer: __, ...resto } = p
    if (i > 0 || !ricevuta) return { ...resto, file }
    return { ...resto, file: { ...file, ricevuta }, ...(totale !== undefined && { ricevutaPer: { totale, persone: persone.length } }) }
  })
}

/** Se il conto è cambiato dopo la ricevuta: quanto, perché e cosa fare. `undefined` se torna. */
export function avvisoRicevuta(persone: StatoPassi[], totaleOra: number | undefined): string | undefined {
  const per = persone[0]?.ricevutaPer
  if (!per || totaleOra === undefined || totaleOra === per.totale) return undefined
  const differenza = euroBreve(Math.abs(totaleOra - per.totale))
  if (totaleOra < per.totale) return `Hai caricato la ricevuta quando il totale era ${euroBreve(per.totale)}: ora è ${euroBreve(totaleOra)}, cioè ${differenza} in meno. La differenza la sistema la segreteria.`
  const aggiunti = persone.slice(per.persone).map((p, i) => nomeDellaPersona(p, per.persone + i))
  const prima = aggiunti.length ? `Hai caricato la ricevuta prima di aggiungere ${elenco(aggiunti)}: ora il totale è` : `Hai caricato la ricevuta quando il totale era ${euroBreve(per.totale)}: ora è`
  return `${prima} ${euroBreve(totaleOra)}, cioè ${differenza} in più. La differenza la paghi in segreteria o con un altro bonifico.`
}
