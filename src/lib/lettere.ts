/**
 * La lettera d'incarico di un tecnico: collaborazione coordinata e
 * continuativa sportiva dilettantistica, una per stagione
 * (`79-lettere-incarico.sql`).
 *
 * Come le ricevute, i dati del tecnico e le tariffe si copiano dentro quando
 * la lettera si fa: ristampata dice sempre la stessa cosa. Il testo è quello
 * della palestra (il Word «Format co.co.co sportiva»), con due cambi decisi:
 * il compenso sono le tariffe orarie per corso, non più un totale in rate, e
 * i punti sono numerati di seguito (nel Word il 7 mancava). Se la palestra
 * cambia il testo, si cambia qui, in `testoLettera`.
 *
 * Gli importi sono in centesimi.
 */
import { euro } from './ricevute'

export const QUALIFICHE = ['Allenatore', 'Istruttore', 'Direttore tecnico', 'Direttore sportivo', 'Preparatore atletico', 'Direttore di gara', 'Atleta', 'Altro'] as const

export interface TariffaLettera {
  corso: string
  centesimi: number
}

/** I dati del tecnico copiati nella lettera, come erano quel giorno. */
export interface TecnicoLettera {
  nome: string
  cognome: string
  indirizzo?: string
  cap?: string
  comune?: string
  provincia?: string
  codiceFiscale?: string
  natoIl?: string
  natoA?: string
  provinciaNascita?: string
}

export interface DatiLettera {
  personaId: string
  /** «2026/27». */
  stagione: string
  /** `AAAA-MM-GG`. */
  dal: string
  al: string
  qualifica: string
  /** «venerdì», scritto a mano; vuoto, la frase dei giorni non c'è. */
  giorni: string
  /** Il giorno della lettera, `AAAA-MM-GG`. */
  data: string
  tariffe: TariffaLettera[]
  tecnico: TecnicoLettera
}

export interface Lettera extends DatiLettera {
  id: string
  firmata: boolean
  sostituitaIl: string | null
  creataIl: string
}

const UNITA = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove']
const DECINE = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta']

/** Sotto il mille, senza lo zero: «ventuno», «ventotto» (la vocale cade), «centotré» (l'accento in fondo). */
function finoAMille(n: number): string {
  const centinaia = Math.floor(n / 100)
  const resto = n % 100
  let fine = ''
  if (resto >= 20) {
    const u = resto % 10
    const d = DECINE[Math.floor(resto / 10)]
    fine = (u === 1 || u === 8 ? d.slice(0, -1) : d) + (u === 3 ? 'tré' : u ? UNITA[u] : '')
  } else if (resto) fine = centinaia && resto === 3 ? 'tré' : UNITA[resto]
  if (!centinaia) return fine
  const cento = centinaia === 1 ? 'cento' : UNITA[centinaia] + 'cento'
  // «centotto», «centottanta»: davanti a otto la o di cento cade.
  return (fine.startsWith('o') ? cento.slice(0, -1) : cento) + fine
}

function aParole(n: number): string {
  if (n === 0) return 'zero'
  const migliaia = Math.floor(n / 1000)
  const resto = n % 1000
  const mila = !migliaia ? '' : migliaia === 1 ? 'mille' : finoAMille(migliaia) + 'mila'
  return mila + (resto ? finoAMille(resto) : '')
}

/** Come si scrive in una lettera: «quindici/00», «milleduecentocinquanta/50». */
export const importoInLettere = (centesimi: number) => `${aParole(Math.floor(centesimi / 100))}/${String(centesimi % 100).padStart(2, '0')}`

/** La stagione di un giorno: parte il 1° settembre. «2026/27». */
export function stagioneDi(giorno: string): string {
  const [anno, mese] = giorno.split('-').map(Number)
  const da = mese >= 9 ? anno : anno - 1
  return `${da}/${String((da + 1) % 100).padStart(2, '0')}`
}

/** Periodo e data proposti: dal 1° settembre al 30 luglio, lettera del 1° settembre. Per chi arriva dopo si cambiano. */
export function propostaLettera(stagione: string) {
  const da = Number(stagione.slice(0, 4))
  return { dal: `${da}-09-01`, al: `${da + 1}-07-30`, data: `${da}-09-01` }
}

const OMOCODIA = 'LMNPQRSTUV'

/** «Gentile signora» o «Gentile signor» dal codice fiscale (le donne hanno il giorno di nascita +40); senza, «Gentile». */
export function saluto(codiceFiscale?: string): string {
  const cf = (codiceFiscale ?? '').toUpperCase()
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}/.test(cf)) return 'Gentile'
  const giorno = Number(cf.slice(9, 11).replace(/[LMNPQRSTUV]/g, (c) => String(OMOCODIA.indexOf(c))))
  return giorno > 40 ? 'Gentile signora' : 'Gentile signor'
}

/** Perché la lettera non si può fare; `null` se va. Le stesse regole di `fai_lettera_incarico`. */
export function cosaNonVaLettera(d: Pick<DatiLettera, 'stagione' | 'dal' | 'al' | 'qualifica' | 'giorni' | 'data' | 'tariffe' | 'tecnico'>): string | null {
  if (!d.tariffe.length) return 'Scrivi almeno una tariffa nella scheda prima di fare la lettera'
  if (d.tariffe.some((t) => !Number.isInteger(t.centesimi) || t.centesimi <= 0)) return 'Una tariffa non è giusta: correggila nella scheda'
  if (!d.tecnico.codiceFiscale || !d.tecnico.indirizzo?.trim() || !d.tecnico.comune?.trim()) return 'Mancano i dati per la lettera: codice fiscale e residenza'
  if (!/^\d{4}\/\d{2}$/.test(d.stagione)) return 'La stagione si scrive come 2026/27'
  const giorno = /^\d{4}-\d{2}-\d{2}$/
  if (!giorno.test(d.dal) || !giorno.test(d.al) || !giorno.test(d.data)) return 'Scrivi le date per intero'
  if (d.al < d.dal) return "La fine viene prima dell'inizio"
  if (d.al === d.dal) return "La fine è lo stesso giorno dell'inizio"
  if (!(QUALIFICHE as readonly string[]).includes(d.qualifica)) return 'Scegli la qualifica dall’elenco'
  if (d.giorni.length > 80) return 'I giorni sono troppo lunghi: al massimo 80 caratteri'
  return null
}

const gma = (g: string) => g.split('-').reverse().join('/')
const nomeIntero = (t: TecnicoLettera) => `${t.cognome} ${t.nome}`.trim().toUpperCase()

/** Un pezzo della lettera: i punti hanno il numero, le voci di un elenco no. */
export interface Paragrafo {
  numero?: number
  testo: string
  /** Come si impagina: il destinatario in alto, l'oggetto in grassetto, le voci rientrate, le firme con lo spazio sopra. */
  tipo?: 'destinatario' | 'oggetto' | 'voce' | 'firma'
}

const ASD = 'ASD IL CENTRO JUDO'

/** La lettera, paragrafo per paragrafo: quello che va nel PDF. */
export function testoLettera(l: DatiLettera): Paragrafo[] {
  const t = l.tecnico
  const residenza = [t.indirizzo, [t.cap, t.comune].filter(Boolean).join(' ') + (t.provincia ? ` (${t.provincia})` : '')].filter((x) => x?.trim()).join(' – ').toUpperCase()
  const tariffe = l.tariffe.map((x) => `€ ${euro(x.centesimi)} (${importoInLettere(x.centesimi)}) per ogni ora di lezione nel corso ${x.corso}`).join('; ')
  const giorni = l.giorni.trim() ? ` preferibilmente nei giorni di ${l.giorni.trim()},` : ''
  return [
    { testo: saluto(t.codiceFiscale), tipo: 'destinatario' },
    { testo: nomeIntero(t), tipo: 'destinatario' },
    { testo: residenza, tipo: 'destinatario' },
    { testo: t.codiceFiscale ?? '', tipo: 'destinatario' },
    { testo: 'Oggetto: lettera di incarico per collaborazione coordinata e continuativa sportiva dilettantistica.', tipo: 'oggetto' },
    { testo: `E’ a Lei conferito per il periodo dal ${gma(l.dal)} al ${gma(l.al)}, l’incarico di: ${l.qualifica}.` },
    {
      numero: 2,
      testo: `In tale qualifica, svolgerà la funzione indicata nelle modalità previste dai regolamenti federali. La prestazione avverrà${giorni} con la durata che sarà determinata sulla base delle esigenze comunicate e che vengono confermate con la sottoscrizione del presente contratto, a fronte di un compenso di ${tariffe}. Detto compenso, per le ore effettivamente svolte e dedotte le ritenute fiscali e previdenziali applicabili, Le sarà corrisposto mensilmente, in via posticipata.`,
    },
    {
      testo:
        'Si dà atto che la prestazione avverrà secondo le modalità indicate nel secondo comma dell’art. 28 del D.Lvo n. 36/2021 e ss.mm.ii., e che l’impegno assunto non richiede una prestazione superiore alle 24 ore settimanali al netto dell’attività agonistica programmata e concordata.',
    },
    {
      numero: 3,
      testo: `La S.V., quale soggetto operante a tutti gli effetti nell’ordinamento sportivo in quanto tesserato con qualifica ${l.qualifica}, si impegna a svolgere la sua opera nel rispetto delle norme sancite dallo Statuto e dai Regolamenti della ${ASD} e a non rilasciare dichiarazioni contrarie alla dignità di tesserati della ${ASD} e degli associati o che esulino dall’ambito dell’incarico affidatogli, essendo comunque tenuto all’obbligo della riservatezza.`,
    },
    { numero: 4, testo: 'Si obbliga, inoltre:' },
    { testo: 'a svolgere con la massima diligenza l’incarico stesso, nel rispetto degli obiettivi perseguiti dalla ASD IL CENTRO JUDO;', tipo: 'voce' },
    { testo: 'ad avere la massima cura di tutti i materiali, attrezzi ecc., messi a sua disposizione;', tipo: 'voce' },
    {
      testo: `a operare con diligenza e professionalità rispettando le normative interne della ${ASD}, in particolare lo Statuto, i Regolamenti federali, la normativa antidoping ed il Codice di Comportamento Sportivo del CONI con obbligo di assoluta riservatezza, anche dopo la cessazione dell’incarico, circa ogni dato e notizia relativi all’attività svolta ed atleti/e coinvolti/e;`,
      tipo: 'voce',
    },
    { testo: `a comportarsi con lealtà e correttezza, evitando ogni condotta che possa porsi in contrasto con gli interessi federali e/o comunque arrecare danno alla ${ASD}.`, tipo: 'voce' },
    { numero: 5, testo: 'Costituiranno motivo di risoluzione immediata del presente accordo una o più delle ipotesi qui previste:' },
    { testo: 'l’assunzione o induzione all’uso di sostanze dopanti;', tipo: 'voce' },
    { testo: 'la violazione al Codice di Comportamento Sportivo del CONI che dichiara di conoscere ed accettare espressamente;', tipo: 'voce' },
    { testo: 'il mancato rispetto delle obbligazioni di cui al precedente punto 4.', tipo: 'voce' },
    {
      numero: 6,
      testo:
        'La S.V. avrà diritto all’assicurazione previdenziale e assistenziale, con iscrizione alla gestione separata Inps di cui all’articolo 2, comma 26, L. 335/1995, secondo la relativa disciplina previdenziale e con aliquota calcolata sulla parte di compenso eccedente i primi 5.000 euro, applicata secondo le modalità previste dall’articolo 35, comma 8-bis e segg. D.Lvo 36/2021. Sulla parte eccedente i 15.000 euro di reddito lordo percepito verrà applicata la ritenuta fiscale attualmente prevista per la tipologia di compenso. A tal fine, ai sensi del comma 6-bis dell’art. 36 del D.Lvo n. 36/2021, la S.V. rilascerà, all’atto del pagamento, autocertificazione attestante l’ammontare dei compensi percepiti per le prestazioni sportive dilettantistiche rese nell’anno solare.',
    },
    { numero: 7, testo: 'È esclusa qualsiasi forma di ulteriori compensi e/o indennità, a qualsiasi titolo, in aggiunta a quanto previsto ai commi precedenti.' },
    { numero: 8, testo: 'Le Sue competenze Le saranno riconosciute periodicamente a mezzo bonifico bancario – o altra modalità di pagamento – secondo le Sue indicazioni.' },
    {
      numero: 9,
      testo: `Con riferimento alle modalità e al tempo di svolgimento delle proprie prestazioni, Le ricordiamo che dovrà agire nell’interesse della scrivente ${ASD} e nel rispetto dei regolamenti tecnici dalla stessa emanati con l’obiettivo del raggiungimento delle migliori classifiche nelle competizioni di riferimento. Lei ha il solo obbligo di relazionare sul proprio operato agli Organi direttivi ogni qual volta ne verrà richiesto senza che comunque sussistano vincoli di dipendenza e subordinazione nei confronti della ${ASD}. Si precisa che non è volontà delle parti di costituire un rapporto subordinato.`,
    },
    {
      numero: 10,
      testo:
        'La S.V. dichiara, sotto la propria responsabilità, con riferimento all’incarico ricevuto, di non trovarsi in alcuna incompatibilità prevista dalle normative vigenti. In particolare, se dipendente pubblico, dichiara di non trovarsi in situazioni di incompatibilità previste dall’art. 53 del D.Lvo n. 165/2001, di svolgere comunque l’incarico al di fuori dall’orario di lavoro e di aver ottenuto l’autorizzazione dall’amministrazione di appartenenza ai sensi dell’art. 25, comma 6 del D.Lvo n. 36/2021 e s.m.i.',
    },
    {
      numero: 11,
      testo: 'Riguardo all’applicazione di quanto previsto dal D.Lgs. 81/2008 e ss.mm., le parti si danno reciprocamente atto che l’affidamento delle attività dedotte nel presente incarico avviene nel rispetto di quanto segue:',
    },
    { testo: 'a) la conoscenza delle problematiche attinenti l’incarico;', tipo: 'voce' },
    { testo: `b) la ${ASD} ha fornito dettagliate informazioni sui rischi specifici e sulle misure di prevenzione ed emergenza esistenti negli ambienti dove verrà svolta l’attività oggetto del presente incarico;`, tipo: 'voce' },
    { testo: 'c) le parti cooperano nell’attuazione delle misure di prevenzione e protezione dai rischi sul lavoro, incidenti sull’attività oggetto dell’incarico.', tipo: 'voce' },
    { testo: `Certo che garantirà alla ${ASD} il Suo importante apporto con entusiasmo, La saluto cordialmente.` },
    { testo: 'Il Presidente', tipo: 'firma' },
    { testo: `Per accettazione, ${nomeIntero(t)}`, tipo: 'firma' },
    { testo: `Data: ${gma(l.data)}` },
    { testo: 'A norma degli artt. 1341 e 1342 c.c. dichiaro di aver letto, approvato ed accettato in ogni sua parte il presente accordo ivi compresi i punti 4, 5.', tipo: 'firma' },
    { testo: nomeIntero(t) },
  ]
}

/** Quello che si sceglie nella finestra della lettera. */
export type ScelteLettera = Pick<DatiLettera, 'stagione' | 'dal' | 'al' | 'qualifica' | 'giorni' | 'data'>

/**
 * La lettera dai dati della scheda: nome, nascita e residenza del tecnico (non
 * l'IBAN, che va sulle ricevute) e le sue tariffe, in ordine di corso.
 */
export function datiPerLettera(
  p: { id: string; nome: string; cognome: string },
  a: Omit<TecnicoLettera, 'nome' | 'cognome'> | null,
  tariffe: Array<{ corso: string; centesimi: number }>,
  scelte: ScelteLettera,
): DatiLettera {
  const campi = ['indirizzo', 'cap', 'comune', 'provincia', 'codiceFiscale', 'natoIl', 'natoA', 'provinciaNascita'] as const
  const tecnico: TecnicoLettera = { nome: p.nome, cognome: p.cognome }
  for (const k of campi) if (a?.[k]) tecnico[k] = a[k]
  return {
    personaId: p.id,
    ...scelte,
    giorni: scelte.giorni.trim(),
    tariffe: tariffe.map((t) => ({ corso: t.corso, centesimi: t.centesimi })).sort((x, y) => x.corso.localeCompare(y.corso, 'it')),
    tecnico,
  }
}

/** Nella scheda: la lettera valida della stagione, e sotto tutte le altre (sostituite o di stagioni passate), dalla più nuova. */
export function lettereDellaScheda<L extends Pick<Lettera, 'stagione' | 'sostituitaIl'>>(lettere: L[], stagione: string) {
  const valida = lettere.find((l) => l.stagione === stagione && !l.sostituitaIl)
  return { valida, altre: lettere.filter((l) => l !== valida) }
}
