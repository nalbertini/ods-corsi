import type { CorsoPerEta, CorsoRef, Listino } from './listino'
import { corsiPerEta, voceDelCorso } from './listino'
import type { VoceCosto } from './costi'
import type { Abbonamento, RigaStima } from './nucleo'
import { stimaIscrizione } from './nucleo'
import type { CampoModulo, DatiRichiesta, DatiRichieste, Formula, TipoFile } from './richieste'
import { certificatoDaPortare, dataDaCf, domandaUscita, ETICHETTA_FILE, FILE, firmaDaRifare, minorenne, problemi, pulisciCf } from './richieste'
import type { Luoghi } from './codiceFiscale'
import { cfValido, luogoDaCf, scriviLuogo } from './codiceFiscale'
import { nomeProprio } from './nomi'

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
  /** Il genitore che si iscrive con il figlio: decide da sé corso, formula e consensi. */
  suo?: { corsi: string[]; formula: Formula; scelte: Scelte; certificato?: File }
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

/** «Anche tu»: il corso e i consensi del genitore, che decide da sé. */
function ilSuo(s: StatoPassi): Pastiglia[] {
  const m: Pastiglia[] = []
  if (!s.suo?.corsi.length) m.push({ chiave: 'suoCorsi', nome: 'CORSO' })
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
  return senzaDoppioni(s, passo, oggi, 'chiave').map((p) => ({
    ...p,
    nome: NOMI_DEL_GENITORE[p.chiave] ?? (p.chiave === 'corsi' && s.ancheTu && bambino ? `CORSO DI ${bambino}` : p.nome),
  }))
}

const NOMI_DEL_GENITORE: Record<string, string> = {
  suoCorsi: 'IL TUO CORSO',
  suoTesseramento: 'TESSERAMENTO DEL GENITORE',
  suoFoto: 'FOTO DEL GENITORE',
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

// --- i file, la firma, il riepilogo -----------------------------------------

/**
 * Etichetta e dettaglio di un file nel flusso a passi. Per chi iscrive il figlio parlano al genitore
 * («il certificato di Luca», «la tua carta»); per l'adulto restano quelli di `FILE`, come nel modulo di oggi.
 */
export function testoFile(chi: Chi, tipo: TipoFile, nome: string): { etichetta: string; dettaglio: string } {
  const f = FILE.find((x) => x.tipo === tipo)!
  const n = nome.trim()
  if (chi === 'figlio') {
    if (tipo === 'documento') return { etichetta: 'LA TUA CARTA D’IDENTITÀ', dettaglio: `Il fronte. Firmi tu, genitore: serve la tua, non quella ${n ? `di ${n}` : 'del bambino'}.` }
    if (tipo === 'documento-retro') return { etichetta: 'IL RETRO DELLA TUA CARTA', dettaglio: 'Il retro. Una foto o il PDF.' }
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
 * del riepilogo (stessi centesimi), solo scritta corta. Con «Anche tu» è quello della famiglia, con lo sconto.
 * Senza corso scelto, senza listino e negli altri passi non c'è.
 */
export function totaleDelPasso(s: StatoPassi, passo: number, corsi: CorsoRef[], listino: Listino | undefined, giorno: string): { righe: string; totale: string } | undefined {
  const tipo = tipiDiPassi(s.chi, s.ancheTu === true)[passo - 1]
  if ((tipo !== 'corso' && tipo !== 'documenti') || !listino || !s.risposte.corsi.length) return undefined
  const famiglia = s.chi === 'figlio' && s.ancheTu && s.suo?.corsi.length ? contoDelloStato(s, corsi, listino, giorno) : undefined
  const conto = famiglia ?? stimaIscrizione(persona(s, corsi), [], giorno, listino)
  // Un corso senza prezzo nel listino non vale 0: lo dice la riga, e il totale è quello che si sa.
  const daConfermare = !famiglia && 'senzaPrezzo' in conto ? conto.senzaPrezzo.map((nome) => `${nome} prezzo da confermare`) : []
  // Per una persona sola le righe si accorciano («Quota associativa» → «Quota», «Annuale Judo adulti» → «Judo adulti annuale»); per la famiglia i testi della stima restano com'è.
  const voce = (testo: string) =>
    famiglia ? testo : testo.replace(/^Quota associativa$/, 'Quota').replace(/^(Annuale|Trimestre|Saldo)\s+(.+)$/i, (_, f: string, c: string) => `${c} ${f.toLowerCase()}`)
  return { righe: [...conto.righe.map((r) => `${voce(r.testo)} ${euroBreve(r.importo)}`), ...daConfermare].join(' + '), totale: euroBreve(conto.totale) }
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

/** I corsi per l'età del genitore che hanno lo stesso orario scritto di uno del figlio: «stessa ora». */
export function corsiParalleli(corsi: CorsoRef[], voci: VoceCosto[], natoIlGenitore: string, corsiFiglio: string[]): Array<CorsoPerEta & { stessaOra: true }> {
  const orari = new Set(
    corsiFiglio.flatMap((id) => {
      const c = corsi.find((x) => x.id === id)
      return (c && voceDelCorso(voci, c)?.orari.map((o) => o.trim())) || []
    }),
  )
  return corsiPerEta(corsi, voci, natoIlGenitore)
    .adatti.filter((c) => !corsiFiglio.includes(c.id) && voceDelCorso(voci, c)?.orari.some((o) => orari.has(o.trim())))
    .map((c) => ({ ...c, stessaOra: true as const }))
}

/** Il corso d'un orario scritto uguale a quello del figlio va in cima, con «stessa ora di <di>» sotto il nome. */
export function corsiPerEtaConStessaOra(corsi: CorsoRef[], listino: Listino | undefined, natoIl: string, corsiFiglio: string[], di: string) {
  const perEta = corsiPerEta(corsi, listino?.corsi ?? [], natoIl, listino?.senzaPrezzoVaBene)
  const ids = new Set((listino ? corsiParalleli(corsi, listino.corsi, natoIl, corsiFiglio) : []).map((c) => c.id))
  const segna = (c: CorsoPerEta): CorsoPerEta => (ids.has(c.id) ? { ...c, riga: [c.riga, `stessa ora di ${di}`].filter(Boolean).join(' · ') } : c)
  return { ...perEta, adatti: [...perEta.adatti.filter((c) => ids.has(c.id)), ...perEta.adatti.filter((c) => !ids.has(c.id))].map(segna) }
}

/**
 * Il conto della famiglia: ognuno con la sua stima, gli annuali degli altri
 * contano per lo sconto (20% sul più basso, quota esclusa), che si toglie una
 * volta sola anche a prezzi uguali. Centesimi; lo sconto è positivo.
 */
export function contoFamiglia(
  persone: Array<{ chi: string; corsi: Array<string | CorsoRef>; formula: Formula }>,
  giorno: string,
  listino: Listino,
): { righe: RigaStima[]; totale: number; sconto?: number } {
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
  persone.forEach((p, i) => {
    const st = stimaIscrizione(p, persone.flatMap((x, j) => (j === i ? [] : annuali(x))), giorno, listino)
    const doppio = st.sconto?.qui && sconto !== undefined
    const mie = doppio ? st.righe.slice(0, -1) : st.righe
    righe.push(...mie.map((r) => ({ ...r, testo: `${p.chi}: ${r.testo}` })))
    totale += mie.reduce((t, r) => t + r.importo, 0)
    sconto = sconto ?? st.sconto?.importo
  })
  return { righe, totale, sconto }
}

/**
 * Il conto di bambino e genitore, dallo stato: lo stesso per la proposta del
 * passo «corsi» (`proposta`: il corso parallelo, con la formula del figlio) e
 * per il riepilogo (il corso e la formula scelti dal genitore). Senza genitore
 * e senza proposta non c'è un conto di famiglia.
 */
/** Chi si iscrive nello stato dei passi, come entra in ogni conto: nome (o «Il bambino» / «Chi si iscrive»), corsi e formula. */
const persona = (s: StatoPassi, corsi: CorsoRef[]) => ({
  chi: s.risposte.nome.trim() || (s.chi === 'figlio' ? 'Il bambino' : 'Chi si iscrive'),
  corsi: corsi.filter((c) => s.risposte.corsi.includes(c.id)),
  formula: s.risposte.formula,
})

export function contoDelloStato(s: StatoPassi, corsi: CorsoRef[], listino: Listino, giorno: string, proposta?: CorsoRef) {
  const ref = (ids: string[]) => corsi.filter((c) => ids.includes(c.id))
  const lui = proposta ? { corsi: [proposta], formula: s.risposte.formula } : s.chi === 'figlio' && s.ancheTu && s.suo ? { corsi: ref(s.suo.corsi), formula: s.suo.formula } : undefined
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

// --- mandare ------------------------------------------------------------------

/**
 * Le note arrivano al database con un massimo di 1000 caratteri: chi scrive ne
 * ha 900, il resto è per la riga che lega le due richieste di una famiglia.
 */
export const MASSIMO_NOTE = 900

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
  | { esito: 'file'; perche: string; mancati: Mancato[]; riprova: () => Promise<Esito> }

/**
 * Come `ModuloIscrizione.manda`, per una o due persone: prima i PDF (se uno
 * non viene non nasce niente), poi per ognuna la richiesta e i suoi file uno
 * alla volta. Se la seconda richiesta si ferma la prima è arrivata: RIPROVA
 * rimanda solo la seconda, mai la prima (sarebbe un doppione).
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
  // Le due richieste arrivano separate: la segreteria le lega da questa riga.
  const dati = daMandare.map(({ dati: x }, i) => {
    const altro = daMandare.length === 2 ? daMandare[1 - i].dati : null
    if (!altro) return x
    // Il nome come lo scrive `invia`: la segreteria lo ritrova uguale in elenco.
    const legame = `mandata insieme alla richiesta di ${nomeProprio(altro.nome)} ${nomeProprio(altro.cognome)}, sconto famiglia da applicare`
    return { ...x, note: x.note ? `${x.note}\n${legame}` : legame }
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
        return i === 0 ? { esito: 'fermo', perche: motivo } : { esito: 'secondaNo', perche: motivo, ids: ids.slice(0, i), riprova: unaAlla(() => manda(i)) }
      }
      await carica(i, FILE.map((f) => f.tipo))
    }
    return finale()
  }
  return manda(0)
}
