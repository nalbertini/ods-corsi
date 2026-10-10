import type { CorsoPerEta, CorsoRef, Listino } from './listino'
import { corsiPerEta, voceDelCorso } from './listino'
import type { VoceCosto } from './costi'
import type { Abbonamento, RigaStima } from './nucleo'
import { stimaIscrizione } from './nucleo'
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
  /** Solo per il figlio: il genitore si iscrive anche lui? `undefined`: non ha ancora risposto. */
  ancheTu?: boolean
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
  /** In famiglia, per un bambino: il posto dell'adulto che firma per lui (`conDatiDellaFamiglia` ne prende i dati). */
  firmatario?: number
  /** Il genitore che si iscrive con il figlio: decide da sé corso, formula e consensi. */
  suo?: Suo
}

export interface Suo {
  corsi: string[]
  formula: Formula
  scelte: Scelte
  certificato?: File
  /** I suoi corsi che erano alla stessa ora del figlio quando li ha scelti: se il figlio cambia, lo si dice. */
  allaStessaOra?: string[]
}

export const SUO_VUOTO: Suo = { corsi: [], formula: 'trimestre', scelte: {} }

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
export type TipoPasso = 'dati' | 'genitore' | 'corso' | 'modulo' | 'documenti' | 'anche' | 'riepilogo'

export const tipiDiPassi = (chi: Chi, ancheTu: boolean): TipoPasso[] =>
  chi === 'adulto' ? ['dati', 'corso', 'modulo', 'documenti', 'riepilogo'] : ['dati', 'genitore', 'corso', 'modulo', 'documenti', ...(ancheTu ? (['anche'] as const) : []), 'riepilogo']

const NOME_PASSO: Record<Chi, Partial<Record<TipoPasso, string>>> = {
  adulto: { dati: 'I TUOI DATI', corso: 'SCEGLI IL CORSO', modulo: 'IL MODULO E LA FIRMA', documenti: 'I DOCUMENTI E IL PAGAMENTO', riepilogo: 'CONTROLLA E INVIA' },
  figlio: {
    dati: 'IL BAMBINO',
    genitore: 'IL GENITORE CHE FIRMA',
    corso: 'SCEGLI IL CORSO',
    modulo: 'IL MODULO E LA FIRMA',
    documenti: 'I DOCUMENTI E IL PAGAMENTO',
    anche: 'ANCHE TU: POCHE COSE',
    riepilogo: 'CONTROLLA E INVIA',
  },
}

export const passiDi = (chi: Chi, ancheTu: boolean): string[] => tipiDiPassi(chi, ancheTu).map((t) => NOME_PASSO[chi][t] ?? '')

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

/** «Anche tu»: i consensi del genitore, che decide da sé. Il suo corso lo sceglie al passo dei corsi. */
function ilSuo(s: StatoPassi): Pastiglia[] {
  const m: Pastiglia[] = []
  if (s.suo?.scelte.tesseramento === undefined) m.push({ chiave: 'suoTesseramento', nome: 'TESSERAMENTO' })
  if (s.suo?.scelte.foto === undefined) m.push({ chiave: 'suoFoto', nome: 'FOTO' })
  return m
}

function sezione(s: StatoPassi, passo: number, oggi: Date): Pastiglia[] {
  switch (tipiDiPassi(s.chi, s.ancheTu === true)[passo - 1]) {
    case 'dati':
      return campi(s, oggi, s.chi === 'adulto' ? [...DATI, ...CONTATTI] : DATI)
    case 'genitore':
      // Il luogo del genitore lo dice il suo codice fiscale (il componente lo riempie): se resta vuoto lo chiede qui, dove si parla a lui.
      // Serve solo al PDF del modulo: col foglio firmato in foto il PDF non si fa e non lo chiede.
      return [...campi(s, oggi, GENITORE), ...(s.natoAGenitore.trim() || s.file.modulo || s.firmaInFoto ? [] : [{ chiave: 'natoAGenitore', nome: 'DOVE SEI NATO' }]), ...campi(s, oggi, CONTATTI)]
    case 'corso':
      return [
        ...campi(s, oggi, ['corsi']),
        ...(s.chi === 'figlio' && s.ancheTu === undefined ? [{ chiave: 'ancheTu', nome: 'SCEGLI: ANCHE TE?' }] : []),
        ...(s.chi === 'figlio' && s.ancheTu === true && !s.suo?.corsi.length ? [{ chiave: 'suoCorsi', nome: 'CORSO' }] : []),
        ...campi(s, oggi, ['formula']),
      ]
    case 'modulo':
      return moduloEFile(s)
    case 'documenti':
      return documenti(s)
    case 'anche':
      return ilSuo(s)
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
  const ultimo = passiDi(s.chi, s.ancheTu === true).length
  if (passo < ultimo) return sezione(s, passo, oggi)
  const tutte = Array.from({ length: ultimo - 1 }, (_, i) => sezione(s, i + 1, oggi)).flat()
  return tutte.filter((p, i) => tutte.findIndex((q) => q[per] === p[per]) === i)
}

/**
 * Le voci toccabili della barra: nome e chiave del campo dove portano. Come
 * `mancaNelPasso`, ma all'ultimo passo chi iscrive e il genitore restano due
 * voci (la chiave le distingue, il nome lo dice), così il tocco va al campo giusto.
 */
export function mancanti(s: StatoPassi, passo: number, oggi = new Date()): Pastiglia[] {
  const bambino = s.risposte.nome.trim().toUpperCase()
  const genitore = diChiFirma(s.risposte.genitoreNome).toUpperCase()
  return senzaDoppioni(s, passo, oggi, 'chiave').map((p) => ({
    ...p,
    nome: Object.hasOwn(COSE_DEL_GENITORE, p.chiave) ? `${COSE_DEL_GENITORE[p.chiave]} ${genitore}` : p.chiave === 'corsi' && s.ancheTu && bambino ? `CORSO DI ${bambino}` : p.nome,
  }))
}

const COSE_DEL_GENITORE: Record<string, string> = {
  suoCorsi: 'CORSO',
  suoTesseramento: 'TESSERAMENTO',
  suoFoto: 'FOTO',
}

/** Di chi è una cosa del genitore: «di Nicola», o «del genitore» finché il nome non c'è (mai «di» e niente). */
export const diChiFirma = (nome: string | undefined): string => (nome?.trim() ? `di ${nome.trim()}` : 'del genitore')

/**
 * Chi firma la persona `i`, quando non è chi compila: il suo nome (vuoto se non c'è). `undefined` vuol dire
 * «tu». In famiglia compila la prima persona: un altro adulto firma per sé, un bambino lo firma il suo
 * `firmatario`. Le persone sono quelle di `conDatiDellaFamiglia`, col nome di chi firma già nel bambino.
 */
export function chiFirma(persone: StatoPassi[], i: number): string | undefined {
  const s = persone[i]
  if (!s || i === 0) return undefined
  if (s.chi === 'figlio' && s.firmatario === 0) return undefined
  const nome = (s.chi === 'adulto' ? s.risposte.nome : (s.risposte.genitoreNome ?? '')).trim()
  // Chi compila può essere il genitore di un bambino messo per primo, che poi aggiunge sé stesso: resta «tu».
  const prima = persone[0]
  const io = (prima.chi === 'adulto' ? prima.risposte.nome : (prima.risposte.genitoreNome ?? '')).trim()
  return nome && nome.toLocaleLowerCase('it') === io.toLocaleLowerCase('it') ? undefined : nome
}

/** Nel passo «Anche tu», la casella delle foto del genitore. */
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

/** In famiglia nessun bambino chiede «anche te?»: ognuno decide da sé il suo corso. Chi ha già risposto resta com'è. */
const senzaAncheTu = (s: StatoPassi): StatoPassi => (s.chi === 'figlio' && s.ancheTu === undefined ? { ...s, ancheTu: false } : s)

/** Si tiene chi è (nome, codice, residenza, contatti) e il documento; il foglio, firmato da un altro, si rifà. */
export function cambiaScelta(s: StatoPassi, a: Chi, inFamiglia = false): StatoPassi {
  const r = s.risposte
  const { modulo, ...file } = s.file
  const nuovo: StatoPassi = {
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
    privacy: s.privacy,
    avvisoFirma: firmaDaRifare(a === 'figlio', { tratti: s.tratti, scelte: quanteCaselle(s.scelte), foto: !!modulo, avvisato: !!s.avvisoFirma }),
  }
  return inFamiglia ? senzaAncheTu(nuovo) : nuovo
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
 * Cosa della famiglia si vede in un passo. Chi si iscrive da solo pensa a una persona alla volta: AGGIUNGI UN
 * FAMILIARE (o, al massimo, il riquadro che lo dice) sta solo all'ultimo passo, prima di mandare. In famiglia le
 * pastiglie restano in ogni passo, per passare dall'una all'altra; all'ultimo le persone sono nel riepilogo.
 * Con «Anche tu» da soli la famiglia non c'è: il genitore è già nello stesso modulo.
 */
export function famigliaNelPasso({ ultimo, quante, ancheTu }: { ultimo: boolean; quante: number; ancheTu: boolean }): { pastiglie: boolean; aggiungi: boolean; massimo: boolean } {
  const conLaFamiglia = !(ancheTu && quante === 1)
  return {
    pastiglie: !ultimo && quante > 1,
    aggiungi: ultimo && conLaFamiglia && puoiAggiungere(quante),
    massimo: ultimo && conLaFamiglia && !puoiAggiungere(quante),
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

/**
 * Una persona in più nella famiglia, da scrivere da capo: l'indirizzo, i contatti e, per un bambino, i dati di
 * chi firma non si copiano ora, si prendono quando servono (`conDatiDellaFamiglia`). Il bambino lo firma un
 * adulto della famiglia, `indiceFirmatario`. In famiglia il foglio si firma qui, per ognuno: la foto del foglio
 * firmato prima non vale più.
 */
export function aggiungiFamiliare(persone: StatoPassi[], chi: Chi, indiceFirmatario: number): StatoPassi[] {
  if (!puoiAggiungere(persone.length)) throw new Error(frasiDelMassimo.testo)
  if (chi === 'figlio' && persone[indiceFirmatario]?.chi !== 'adulto') throw new Error('Per firmare serve un adulto della famiglia: scegline un altro.')
  const nuova: StatoPassi = { ...nuovoStato(chi), ...(chi === 'figlio' ? { firmatario: indiceFirmatario } : {}) }
  return [...persone, nuova].map((p) => {
    const { modulo, ...file } = p.file
    return senzaAncheTu({ ...p, file })
  })
}

/** Quello che un familiare lascia vuoto: lo prende da un altro. Quello che ha scritto lui resta suo. */
const oppure = (suo: string | undefined, altro: string | undefined): string => (suo?.trim() ? suo : (altro ?? ''))

/**
 * Le persone della famiglia coi dati che prendono dagli altri, al momento di usarli (il conto, l'invio):
 * indirizzo e contatti dalla prima persona, e per un bambino nome, cognome e codice di chi firma. Così quello
 * che chi firma scrive o corregge dopo arriva anche a loro. Se chi firma non è più un adulto, non si prende.
 */
export function conDatiDellaFamiglia(persone: StatoPassi[]): StatoPassi[] {
  if (persone.length < 2) return persone
  const prima = persone[0].risposte
  return persone.map((s, i) => {
    if (i === 0) return s
    const r = s.risposte
    const firma = s.chi === 'figlio' && s.firmatario !== undefined && persone[s.firmatario]?.chi === 'adulto' ? persone[s.firmatario].risposte : undefined
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

/** Una famiglia che non può partire: un bambino il cui adulto che firma ha cambiato scelta. Una frase per chi usa l'app. */
export function fermoDellaFamiglia(persone: StatoPassi[]): string | undefined {
  for (const [i, s] of persone.entries()) {
    if (s.chi !== 'figlio' || s.firmatario === undefined || persone[s.firmatario]?.chi === 'adulto') continue
    const lui = nomeDellaPersona(persone[s.firmatario], s.firmatario)
    return `${lui} non è più un adulto, e ${nomeDellaPersona(s, i)} ha bisogno di un adulto che firmi: rimetti ${lui} come adulto, oppure chiama la segreteria.`
  }
  return undefined
}

/** Il foglio si firma in foto solo da soli, per chi l'ha scelto, e senza «Anche te»: in famiglia si firma qui. */
export const firmaInFoto = (s: StatoPassi, sceltaLaFoto: boolean, quante: number): boolean => sceltaLaFoto && !s.ancheTu && quante === 1

/** La provincia di chi firma per un bambino: la dice il suo codice fiscale, se no quella scritta a mano. */
export const siglaDelGenitore = (s: StatoPassi, luoghi: Luoghi | null | undefined, scritta: string): string =>
  (luoghi && luogoDaCf(luoghi, pulisciCf(s.risposte.genitoreCodiceFiscale ?? ''))?.sigla) || scritta

/** Chi è sulla pastiglia e nelle frasi: il nome scritto, o «Adulto 2» / «Bambino 3» (il posto in famiglia) finché non c'è. */
export const nomeDellaPersona = (s: StatoPassi, indice: number): string => nomeProprio(s.risposte.nome) || `${s.chi === 'figlio' ? 'Bambino' : 'Adulto'} ${indice + 1}`

/** I nomi dei passi di una persona della famiglia: i dati di un adulto aggiunto non sono di chi compila, il titolo dice di chi sono. */
export function nomiDeiPassi(s: StatoPassi, indice: number): string[] {
  const nomi = passiDi(s.chi, s.ancheTu === true)
  if (s.chi !== 'adulto' || indice === 0) return nomi
  return [`I DATI DI ${nomeDellaPersona(s, indice).toUpperCase()}`, ...nomi.slice(1)]
}

/** Chi può firmare per un bambino: gli adulti della famiglia, col loro posto (`indiceFirmatario` di `aggiungiFamiliare`). */
export const chiPuoFirmare = (persone: StatoPassi[]): Array<{ indice: number; nome: string }> =>
  persone.flatMap((p, indice) => (p.chi === 'adulto' ? [{ indice, nome: nomeDellaPersona(p, indice) }] : []))

const ultimoPasso = (s: StatoPassi) => passiDi(s.chi, s.ancheTu === true).length

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
 * Il totale che sta sempre sopra la barra, nei passi del corso e dei documenti: la stessa stima
 * del riepilogo (stessi centesimi), solo scritta corta, di chi si iscrive: come QUANTO COSTA nello stesso passo.
 * Il conto della famiglia, con lo sconto, sta nel riepilogo.
 * Senza corso scelto, senza listino e negli altri passi non c'è.
 */
export function totaleDelPasso(s: StatoPassi, passo: number, corsi: CorsoRef[], listino: Listino | undefined, giorno: string): { righe: string; totale: string } | undefined {
  const tipo = tipiDiPassi(s.chi, s.ancheTu === true)[passo - 1]
  if (tipo !== 'corso' && tipo !== 'documenti') return undefined
  const c = contoCorto(persona(s, corsi), listino, giorno)
  // Al passo del corso, col genitore che ha scelto il suo corso, il totale è quello della famiglia: lo stesso del riepilogo.
  // Al passo dei documenti no: lì QUANTO COSTA e la causale sono del bambino, e il totale deve dire la stessa cifra.
  const famiglia = c && listino && tipo === 'corso' && s.chi === 'figlio' && s.ancheTu && s.suo?.corsi.length ? contoDelloStato(s, corsi, listino, giorno) : undefined
  const suo = famiglia && s.suo && contoCorto({ corsi: corsi.filter((x) => s.suo?.corsi.includes(x.id)), formula: s.suo.formula }, listino, giorno, true)
  const delBambino = famiglia && contoCorto(persona(s, corsi), listino, giorno, true)
  if (delBambino && famiglia && suo) {
    const sconto = famiglia.sconto ? ` · Sconto famiglia ${euroBreve(-famiglia.sconto)}` : ''
    return { righe: `${persona(s, corsi).chi}: ${delBambino.righe} · Tu: ${suo.righe}${sconto}`, totale: euroBreve(famiglia.totale) }
  }
  return c && { righe: c.righe, totale: c.totale }
}

/** Il conto di una persona, scritto corto; `undefined` senza listino o senza un corso che c'è nell'elenco. */
/** `senzaSconto`: nel conto di famiglia lo sconto è uno solo, quello di `contoDelloStato`, scritto una volta in fondo. */
function contoCorto(lui: { corsi: CorsoRef[]; formula: Formula }, listino: Listino | undefined, giorno: string, senzaSconto = false): { righe: string; totale: string; senzaPrezzo: string[] } | undefined {
  if (!listino || !lui.corsi.length) return undefined
  const stima = stimaIscrizione({ chi: '', ...lui }, [], giorno, listino)
  const conto = senzaSconto ? { ...stima, righe: stima.righe.filter((r) => r.importo >= 0) } : stima
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
  const famiglia = piu ? contoDellaFamiglia(persone, corsi, listino, giorno) : listino && s.chi === 'figlio' && s.ancheTu && s.suo ? contoDelloStato(s, corsi, listino, giorno) : undefined
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
  passo: 'dati' | 'genitore' | 'corso' | 'modulo' | 'documenti' | 'anche'
  manca?: boolean
  carica?: TipoFile
  /** La riga è del genitore che si iscrive con il figlio. */
  suo?: true
}

/**
 * Chi deve ancora portare il certificato medico: `chi` è chi si iscrive (l'adulto
 * o il bambino), `genitore` quello che si iscrive con lui. Lo usano il riepilogo
 * e l'esito, così non possono dire cose diverse.
 */
export function certificatiMancanti(s: StatoPassi, corsi: CorsoRef[], oggi = new Date()): Array<'chi' | 'genitore'> {
  const r = risposteDaiPassi(s, oggi)
  const nomi = (ids: string[]) => ids.map((id) => corsi.find((c) => c.id === id)?.nome ?? id)
  const m: Array<'chi' | 'genitore'> = []
  if (certificatoDaPortare(r.natoIl, nomi(r.corsi), oggi) !== 'nessuno' && !s.file.certificato) m.push('chi')
  if (s.chi === 'figlio' && s.ancheTu && s.suo && certificatoDaPortare(dataDaCf(r.genitoreCodiceFiscale ?? '', '', oggi) ?? '', nomi(s.suo.corsi), oggi) !== 'nessuno' && !s.suo.certificato) m.push('genitore')
  return m
}

export function righeRiepilogo(s: StatoPassi, corsi: CorsoRef[], oggi = new Date()): RigaRiepilogo[] {
  const r = risposteDaiPassi(s, oggi)
  const nomi = (ids: string[]) => ids.map((id) => corsi.find((c) => c.id === id)?.nome ?? id)
  const seManca = (t: TipoFile) => FILE.find((f) => f.tipo === t)?.seManca ?? ''
  const certificato = (natoIl: string, ids: string[], dato: File | undefined, suo?: true): RigaRiepilogo[] =>
    certificatoDaPortare(natoIl, nomi(ids), oggi) === 'nessuno'
      ? []
      : [
          dato
            ? { etichetta: ETICHETTA_FILE.certificato, valore: dato.name, cosa: 'certificato', passo: suo ? 'anche' : 'documenti', suo }
            : { etichetta: ETICHETTA_FILE.certificato, valore: seManca('certificato'), cosa: 'certificato', passo: suo ? 'anche' : 'documenti', manca: true, carica: 'certificato', suo },
        ]
  const righe: RigaRiepilogo[] = [{ etichetta: 'CORSO', valore: nomi(r.corsi).join(', '), cosa: 'corso', passo: 'corso' }]
  if (s.chi === 'figlio') righe.push({ etichetta: 'GENITORE', valore: `${r.genitoreNome ?? ''} ${r.genitoreCognome ?? ''}`.trim(), cosa: 'genitore', passo: 'genitore' })
  righe.push(...certificato(r.natoIl, r.corsi, s.file.certificato))
  if (s.chi === 'figlio' && s.ancheTu && s.suo)
    righe.push(...certificato(dataDaCf(r.genitoreCodiceFiscale ?? '', '', oggi) ?? '', s.suo.corsi, s.suo.certificato, true))
  righe.push(
    s.file.ricevuta
      ? { etichetta: ETICHETTA_FILE.ricevuta, valore: s.file.ricevuta.name, cosa: 'ricevuta', passo: 'documenti' }
      : { etichetta: ETICHETTA_FILE.ricevuta, valore: seManca('ricevuta'), cosa: 'ricevuta', passo: 'documenti', manca: true, carica: 'ricevuta' },
  )
  return righe
}

// --- anche tu: il genitore che si iscrive col figlio -------------------------

/** La richiesta del genitore: lui è chi si iscrive, con la residenza e i contatti del foglio; corso e formula sono suoi. */
export function richiestaDelGenitore(figlio: DatiRichiesta, suo: { corsi: string[]; formula: Formula; natoA: string }, oggi = new Date()): DatiRichiesta {
  const cf = figlio.genitoreCodiceFiscale ?? ''
  return {
    nome: figlio.genitoreNome ?? '',
    cognome: figlio.genitoreCognome ?? '',
    natoIl: dataDaCf(cf, '', oggi) ?? '',
    natoA: suo.natoA,
    codiceFiscale: cf,
    indirizzo: figlio.indirizzo,
    cap: figlio.cap,
    comune: figlio.comune,
    email: figlio.email,
    telefono: figlio.telefono,
    telefono2: figlio.telefono2,
    genitoreNome: '',
    genitoreCognome: '',
    genitoreCodiceFiscale: '',
    corsi: suo.corsi,
    formula: suo.formula,
    regolamento: true,
  }
}

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

/** L'orario di un corso dal calendario, come lo scrive il volantino: «lunedì, mercoledì e venerdì 18.00-19.00». */
export function orarioDetto(orari: OrarioAperto[], corsoId: string): string {
  const pezzi = new Map<string, number[]>()
  for (const o of orari.filter((x) => x.corsoId === corsoId)) {
    const fascia = `${orologio(minuti(o.ora))}-${orologio(minuti(o.ora) + o.durata)}`
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

/** Il titolo e la frase di «Ti iscrivi anche tu?»: uno o due corsi alla stessa ora si nominano, da tre in su si contano. */
export function fraseAncheTu(nome: string, corsiDelFiglio: string, paralleli: ReadonlyArray<{ nome: string }>): { titolo: string; dettaglio: string } {
  const famiglia = 'Nello stesso modulo, con lo sconto famiglia sull’annuale.'
  if (!paralleli.length) return { titolo: 'Ti iscrivi anche tu?', dettaglio: 'Se vuoi, scegli un corso anche per te: nello stesso modulo, con lo sconto famiglia sull’annuale.' }
  if (paralleli.length > 2) return { titolo: `Mentre ${nome} è in palestra, ci sono ${paralleli.length} corsi per te alla stessa ora`, dettaglio: `Sono per la tua età e sono in cima all’elenco. ${famiglia}` }
  const quali = paralleli.map((p) => p.nome).join(' o ')
  const chi = paralleli.length === 1 ? `${quali} è` : 'Sono'
  return { titolo: `Mentre ${nome} fa ${corsiDelFiglio}, tu puoi fare ${quali}`, dettaglio: `${chi} per la tua età, alla stessa ora di ${nome}. ${famiglia}` }
}

/** ISCRIVO ANCHE ME: con un solo corso alla stessa ora lo spunta già; quel che il genitore aveva scelto resta. */
export function suoDopoIscrivoAncheMe(suo: Suo | undefined, paralleli: ReadonlyArray<{ id: string }>): Suo {
  const s = suo ?? SUO_VUOTO
  if (paralleli.length !== 1 || s.corsi.length) return s
  return { ...s, corsi: [paralleli[0].id], allaStessaOra: [paralleli[0].id] }
}

/** Spunta o toglie un corso del genitore, e si ricorda se era alla stessa ora del figlio. */
export function scegliSuoCorso(suo: Suo | undefined, id: string, paralleli: ReadonlyArray<{ id: string }>): Suo {
  const s = suo ?? SUO_VUOTO
  const prima = s.allaStessaOra ?? []
  if (s.corsi.includes(id)) return { ...s, corsi: s.corsi.filter((c) => c !== id), allaStessaOra: prima.filter((c) => c !== id) }
  return { ...s, corsi: [...s.corsi, id], allaStessaOra: paralleli.some((p) => p.id === id) ? [...prima, id] : prima }
}

/** L'avviso sotto l'elenco del genitore, se il figlio ha cambiato corso. */
export function fraseNonPiuAllaStessaOra(nomi: string[], nome: string): string | undefined {
  if (!nomi.length) return undefined
  return `${elenco(nomi)} ${nomi.length > 1 ? 'non sono' : 'non è'} più alla stessa ora di ${nome}.`
}

/** I corsi del genitore che erano alla stessa ora quando li ha scelti, e col figlio cambiato non lo sono più. */
export const nonPiuAllaStessaOra = (suo: Suo | undefined, paralleli: ReadonlyArray<{ id: string }>): string[] =>
  (suo?.corsi ?? []).filter((id) => suo?.allaStessaOra?.includes(id) && !paralleli.some((p) => p.id === id))

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

/**
 * Il conto di bambino e genitore, dallo stato: lo stesso nel riquadro del
 * passo «corsi» e nel riepilogo, col corso e la formula scelti dal genitore.
 * Senza genitore non c'è un conto di famiglia.
 */
/** Chi si iscrive nello stato dei passi, come entra in ogni conto: nome (o «Il bambino» / «Chi si iscrive»), corsi e formula. */
const persona = (s: StatoPassi, corsi: CorsoRef[]) => ({
  chi: s.risposte.nome.trim() || (s.chi === 'figlio' ? 'Il bambino' : 'Chi si iscrive'),
  corsi: corsi.filter((c) => s.risposte.corsi.includes(c.id)),
  formula: s.risposte.formula,
})

export function contoDelloStato(s: StatoPassi, corsi: CorsoRef[], listino: Listino, giorno: string) {
  const ref = (ids: string[]) => corsi.filter((c) => ids.includes(c.id))
  const lui = s.chi === 'figlio' && s.ancheTu && s.suo ? { corsi: ref(s.suo.corsi), formula: s.suo.formula } : undefined
  if (!lui) return undefined
  return contoFamiglia(
    [
      persona(s, corsi),
      { chi: s.risposte.genitoreNome?.trim() || 'Genitore', ...lui },
    ],
    giorno,
    listino,
  )
}

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
 * cifra e lo sconto a parte. Negli stessi passi di `totaleDelPasso` (corso e documenti, di chi è aperto);
 * con una persona sola è `totaleDelPasso`.
 */
export function totaleDellaFamiglia(persone: StatoPassi[], attivo: number, passo: number, corsi: CorsoRef[], listino: Listino | undefined, giorno: string): { righe: string; totale: string } | undefined {
  if (persone.length < 2) return totaleDelPasso(persone[0], passo, corsi, listino, giorno)
  const tipo = tipiDiPassi(persone[attivo].chi, persone[attivo].ancheTu === true)[passo - 1]
  if (tipo !== 'corso' && tipo !== 'documenti') return undefined
  const c = contoDellaFamiglia(persone, corsi, listino, giorno)
  if (!c) return undefined
  const righe = [...c.persone.map((x) => `${x.chi} ${euroBreve(x.importo)}`), ...c.senzaPrezzo.map((nome) => `${nome} prezzo da confermare`)].join(' + ')
  return { righe: c.sconto ? `${righe} − sconto famiglia ${euroBreve(c.sconto)}` : righe, totale: euroBreve(c.totale) }
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
 * Cosa parte, dallo stato: la richiesta di chi si iscrive e, con «Anche tu»,
 * quella del genitore. La carta d'identità e la ricevuta valgono per tutti e
 * due; il certificato è di ognuno; il foglio firmato in foto, se c'è, è
 * dell'unica richiesta che ha scelto di mandarlo. Il PDF si fa solo se il
 * foglio non è in foto: quello del genitore è per maggiorenni, con le sue scelte.
 */
export function richiesteDaMandare(s: StatoPassi, provincia: string, faiPdf: (c: PerIlPdf) => Promise<File>, oggi = new Date()): DaMandare[] {
  const prima = risposteDaiPassi(s, oggi)
  const natoA = s.natoAGenitore.trim() ? (provincia ? scriviLuogo({ nome: s.natoAGenitore.trim(), sigla: provincia }) : s.natoAGenitore.trim()) : ''
  const daMandare: DaMandare[] = [
    { dati: prima, file: s.file, faiPdf: s.file.modulo ? undefined : () => faiPdf({ dati: prima, minore: s.chi === 'figlio', scelte: s.scelte, natoA: s.natoAGenitore, provincia }) },
  ]
  if (s.chi === 'figlio' && s.suo) {
    const suo = s.suo
    const lui = richiestaDelGenitore(prima, { corsi: suo.corsi, formula: suo.formula, natoA }, oggi)
    daMandare.push({
      dati: lui,
      file: { documento: s.file.documento, 'documento-retro': s.file['documento-retro'], ricevuta: s.file.ricevuta, certificato: suo.certificato },
      faiPdf: () => faiPdf({ dati: lui, minore: false, scelte: suo.scelte, natoA: '', provincia: '' }),
    })
  }
  return daMandare
}

/** Cosa dire se il PDF non viene: «Ho il foglio firmato» c'è tra le scelte solo senza «Anche tu». */
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
