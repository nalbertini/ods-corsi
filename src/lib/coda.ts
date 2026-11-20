/**
 * La coda delle scritture che non sono ancora arrivate al server.
 *
 * Il wifi della palestra è il rischio numero uno di questa parte dell'app: si
 * fa l'appello in fondo a una sala, con venti persone davanti, e se la rete non
 * c'è la presenza non si può perdere. Ogni scrittura passa di qui, va su
 * `localStorage` prima di partire, e resta lì finché il server non l'ha presa.
 *
 * Le operazioni superate si buttano: segnare la stessa persona tre volte
 * mentre la rete non c'è deve lasciare in coda l'ultimo stato, non tre
 * scritture di cui due già sbagliate. La chiave è «cosa» più «su chi», e
 * l'ultima vince.
 */

export interface Operazione {
  /** Identifica l'oggetto della scrittura: due operazioni con la stessa chiave si sostituiscono. */
  chiave: string
  tipo: string
  args: unknown[]
  quando: number
  /**
   * Chi l'ha scritta. Un tablet o un telefono passano di mano: senza, la coda
   * partirebbe col token di chi entra dopo, rifiutata o attribuita a lui.
   * Manca nelle code di prima e in quelle che non sanno chi è collegato (il timer).
   */
  autore?: Autore
}

/** L'account che ha scritto un'operazione: `nome` è quel che si legge sulla spia. */
export interface Autore {
  id: string
  nome: string
}

/** Le presenze in coda di un altro account: aspettano lui, e la spia dice chi e da quando. */
export interface DiAltri {
  nome: string
  quante: number
  /** Quando è stata segnata la prima. */
  dal: number
}

// Prefisso `ods-corsi:` e non `ods-timer:`: le due app stanno sullo stesso
// sito (il timer è pubblicato in `timer/`), e condividono un solo
// `localStorage` — l'origine è la stessa, la cartella non
// conta. Con lo stesso nome una si leggerebbe i dati dell'altra. Il timer usa
// questa stessa coda, sotto la sua chiave: una coda che trovasse le
// operazioni dell'altra app non saprebbe eseguirle, e si fermerebbe lì.
// Le chiavi `ods-corsi:prova-…` (archivio, richieste, `prova-richieste-contate`
// coi conteggi di da dove arrivano le richieste) sono i dati della modalità
// prova sul dispositivo: non tracciano nessuno, e si tolgono ripartendo.
const DOVE = 'ods-corsi:coda'

const eOperazione = (o: unknown): o is Operazione => {
  // Un oggetto qualsiasi letto dal disco: si guardano i campi uno per uno.
  const x = o as Partial<Operazione> | null
  return !!x && typeof x.chiave === 'string' && typeof x.tipo === 'string' && Array.isArray(x.args)
}

interface Letta {
  lista: Operazione[]
  /**
   * Quel che c'era su disco, se non si è letto tutto: un JSON rotto o una riga
   * che non è un'operazione. Erano presenze anche loro, e una coda che le
   * leggesse come vuota le cancellerebbe alla prima scrittura senza dirlo.
   */
  illeggibile: string | null
}

const leggi = (dove: string): Letta => {
  let grezzo: string | null = null
  try {
    grezzo = localStorage.getItem(dove)
    const lista: unknown = grezzo ? JSON.parse(grezzo) : []
    if (!Array.isArray(lista)) return { lista: [], illeggibile: grezzo }
    const buone = lista.filter(eOperazione)
    return { lista: buone, illeggibile: buone.length === lista.length ? null : grezzo }
  } catch {
    return { lista: [], illeggibile: grezzo }
  }
}

/** Dove si mette da parte una coda illeggibile, perché la si possa ancora guardare. */
const daParte = (dove: string) => `${dove}:illeggibile`

/**
 * Aggiunge `grezzo` alle code illeggibili già messe da parte, senza toccare
 * quelle di prima. Vero se è arrivato su disco: solo allora l'originale si
 * può sovrascrivere.
 */
const metteDaParte = (dove: string, grezzo: string): boolean => {
  try {
    let prima: unknown = []
    try {
      prima = JSON.parse(localStorage.getItem(daParte(dove)) ?? '[]')
    } catch {
      // Anche la copia è rotta: la si tiene com'è, dentro la lista nuova.
      prima = [localStorage.getItem(daParte(dove))]
    }
    const copie = Array.isArray(prima) ? prima : [prima]
    // Due pagine aperte, o una ricarica prima che l'originale sia riscritto, rileggono la stessa coda rotta.
    if (!copie.includes(grezzo)) localStorage.setItem(daParte(dove), JSON.stringify([...copie, grezzo]))
    return true
  } catch {
    return false
  }
}

/** Vero se la lista è arrivata su disco. */
const scrivi = (dove: string, lista: Operazione[]): boolean => {
  try {
    localStorage.setItem(dove, JSON.stringify(lista))
    return true
  } catch {
    /* Memoria piena o modalità privata: la coda vive comunque in memoria. */
    return false
  }
}

/** Le code che questa pagina ha aperto: serve a mandarle o a svuotarle quando si esce. */
const vive = new Set<Coda>()

/** Vero se c'è una coda illeggibile messa da parte e non ancora guardata. */
const haCopia = (dove: string): boolean => {
  try {
    return localStorage.getItem(daParte(dove)) !== null
  } catch {
    return false
  }
}

/** Toglie la copia di una coda illeggibile. */
const dimentica = (dove: string) => {
  try {
    localStorage.removeItem(daParte(dove))
  } catch {
    // Niente da fare: al più resta una copia che nessuno legge.
  }
}

const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Quel che la spia della coda deve sapere, oltre al numero. */
export interface StatoCoda {
  inAttesa: number
  /** Quante si perderebbero ricaricando: il disco non le ha prese. */
  soloInMemoria: number
  /** Su disco c'era una coda che non si è letta: messa da parte, non mandata. */
  illeggibile: boolean
  /** Le presenze di altri account, che con questo non partono. */
  diAltri?: DiAltri[]
}

export class Coda {
  private lista: Operazione[]
  private sta = false
  private ascoltatori = new Set<(n: number, stato: StatoCoda) => void>()
  private illeggibile = false
  /**
   * La coda illeggibile non è stata messa da parte (memoria piena): finché è
   * così il disco non si sovrascrive, e la coda vive solo in questa pagina.
   */
  private bloccata = false
  /**
   * L'ultima scrittura su disco è riuscita. Se no, quel che c'è in coda vive
   * solo in questa pagina, e ricaricarla lo perde: la schermata d'errore lo
   * deve sapere prima di offrire RICARICA.
   */
  private suDisco = true
  /**
   * L'ultimo account visto collegato. Resta anche a sessione scaduta: quel che
   * si segna mentre il rinnovo non arriva è ancora suo.
   */
  private io: Autore | null = null

  /**
   * @param esegui Porta davvero a termine l'operazione. Se solleva, l'operazione
   *   resta in coda e si riprova più tardi.
   * @param dove La chiave in `localStorage`: una per app.
   * @param chiE Chi è collegato adesso, `null` se nessuno o non si sa. Senza,
   *   la coda non firma niente e parte tutta, come il timer.
   */
  constructor(
    private esegui: (op: Operazione) => Promise<void>,
    readonly dove = DOVE,
    private chiE?: () => Autore | null | Promise<Autore | null>,
  ) {
    vive.add(this)
    const letta = leggi(dove)
    this.lista = letta.lista
    if (letta.illeggibile !== null) {
      this.illeggibile = true
      this.bloccata = !metteDaParte(dove, letta.illeggibile)
      // Messa da parte, al suo posto va quel che si è letto: se no ogni ricarica la ritrova rotta.
      this.suDisco = !this.bloccata && scrivi(dove, this.lista)
    } else {
      // La copia di una volta precedente resta da guardare: la spia lo dice finché non si svuota.
      this.illeggibile = haCopia(dove)
    }
    window.addEventListener('online', () => void this.scarica())
    // Quello rimasto dall'ultima volta (l'app chiusa senza rete, o ricaricata
    // per un aggiornamento) parte appena si riapre, senza aspettare un tocco.
    queueMicrotask(() => void this.scarica())
    // Col wifi acceso ma il server irraggiungibile `online` non arriva mai:
    // finché c'è qualcosa in coda si riprova ogni tanto.
    window.setInterval?.(() => {
      if (this.lista.length) void this.scarica()
    }, 60_000)
  }

  /** Quante scritture non sono ancora arrivate, anche quelle di altri account. */
  get inAttesa() {
    return this.lista.length
  }

  /**
   * Le operazioni ancora da mandare, in ordine. Serve a chi rilegge i dati dal
   * server mentre la coda non è vuota: quello che il server manda non ha
   * ancora le modifiche fatte senza rete, e senza rimetterle sopra
   * sparirebbero dallo schermo finché non arrivano.
   */
  get operazioni(): readonly Operazione[] {
    return this.lista
  }

  /** Quante scritture si perderebbero ricaricando la pagina. */
  get soloInMemoria() {
    return this.suDisco ? 0 : this.lista.length
  }

  /** Di chi è collegato. Finché non si sa chi è, tutte: meglio dirle in attesa che di nessuno. */
  private mia = (o: Operazione) => !this.io || !o.autore || o.autore.id === this.io.id

  get stato(): StatoCoda {
    const altri = new Map<string, DiAltri>()
    for (const o of this.lista) {
      if (this.mia(o) || !o.autore) continue
      const a = altri.get(o.autore.id)
      if (a) {
        a.quante++
        a.dal = Math.min(a.dal, o.quando)
      } else altri.set(o.autore.id, { nome: o.autore.nome, quante: 1, dal: o.quando })
    }
    return {
      inAttesa: this.lista.filter(this.mia).length,
      soloInMemoria: this.soloInMemoria,
      illeggibile: this.illeggibile,
      diAltri: [...altri.values()],
    }
  }

  /**
   * Avvisa quando la coda si allunga o si accorcia, o quando il disco smette
   * (o riprende) di prenderla: serve alla spia in alto.
   */
  guarda(f: (n: number, stato: StatoCoda) => void) {
    this.ascoltatori.add(f)
    const s = this.stato
    f(s.inAttesa, s)
    return () => this.ascoltatori.delete(f)
  }

  private avvisa() {
    const s = this.stato
    for (const f of this.ascoltatori) f(s.inAttesa, s)
  }

  /** Scrive su disco, se si può: una coda illeggibile non messa da parte non si sovrascrive. */
  private salva() {
    this.suDisco = !this.bloccata && scrivi(this.dove, this.lista)
  }

  /** Come `scarica`, ma se ne sta già scaricando un'altra giro aspetta che finisca. */
  async scaricaEAspetta(ms: number): Promise<void> {
    const fine = Date.now() + ms
    do {
      await this.scarica()
      if (this.sta) await pausa(50)
    } while (this.sta && Date.now() < fine)
  }

  /** Butta le scritture ancora in coda, in memoria e su disco. Solo uscendo: vedi `uscita.ts`. */
  svuota() {
    // Chi esce lo stesso ha scelto di perdere quel che c'è, anche quel che non
    // si leggeva: il prossimo account non deve ritrovarselo.
    this.lista = []
    this.bloccata = false
    this.illeggibile = false
    dimentica(this.dove)
    this.salva()
    this.avvisa()
  }

  /** Mette in coda e prova subito. Non aspetta il server: l'interfaccia va avanti. */
  accoda(chiave: string, tipo: string, args: unknown[]) {
    this.lista = this.lista.filter((o) => o.chiave !== chiave)
    this.lista.push({ chiave, tipo, args, quando: Date.now(), ...(this.io ? { autore: this.io } : {}) })
    this.salva()
    this.avvisa()
    void this.scarica()
  }

  /**
   * Chi è collegato adesso, e se c'è lo ricorda. Le operazioni senza autore
   * (le code di prima) diventano sue: il primo che apre se le prende, invece
   * di lasciarle a nessuno. Un `chiE` che non risponde vale «non si sa».
   */
  private async chiEAdesso(): Promise<Autore | null> {
    if (!this.chiE) return null
    let chi: Autore | null = null
    try {
      chi = await this.chiE()
    } catch {
      return null
    }
    if (!chi) return null
    const cambiato = this.io?.id !== chi.id
    this.io = chi
    if (this.lista.some((o) => !o.autore)) {
      this.lista = this.lista.map((o) => (o.autore ? o : { ...o, autore: chi }))
      this.salva()
    } else if (!cambiato) return chi
    this.avvisa()
    return chi
  }

  /**
   * Svuota la coda, in ordine. Si ferma al primo errore invece di andare
   * avanti: se il server non risponde, insistere sulle successive è solo modo
   * di consumare batteria, e l'ordine fra due scritture sulla stessa lezione
   * conta. Con un account collegato partono solo le sue: quelle di un altro
   * aspettano lui, né mandate col token sbagliato né buttate.
   */
  async scarica(): Promise<void> {
    if (this.sta) return
    this.sta = true
    try {
      for (;;) {
        const chi = await this.chiEAdesso()
        // Senza nessuno collegato, una scrittura di qualcuno non ha il token giusto e aspetta;
        // una senza autore la prova chi esegue, che sa tenerla finché torna l'accesso.
        const op = !this.chiE ? this.lista[0] : this.lista.find((o) => (chi ? o.autore?.id === chi.id : !o.autore))
        if (!op) return
        try {
          await this.esegui(op)
        } catch {
          return
        }
        // Può essere stata sostituita mentre il server rispondeva: si toglie
        // per identità, non per posizione.
        this.lista = this.lista.filter((o) => o !== op)
        this.salva()
        this.avvisa()
      }
    } finally {
      this.sta = false
    }
  }
}

// Le code dell'app dei corsi (non quella del timer, che ha la sua app e il
// suo esecutore): quelle che il prossimo account del dispositivo si
// ritroverebbe e rieseguirebbe col suo token.
const CODE_DELL_APP = ['ods-corsi:coda', 'ods-corsi:coda-sala']

/**
 * Quante scritture non sono arrivate, su disco o in memoria (la memoria piena
 * non le fa sparire). Una coda illeggibile conta per una: non si sa quante
 * presenze tiene, ma uscendo si cancellerebbe, e chi esce deve poter dire no.
 */
export function inCodaDiTutte(): number {
  return CODE_DELL_APP.reduce((tot, dove) => {
    const qui = [...vive].filter((c) => c.dove === dove)
    return tot + Math.max(leggi(dove).lista.length, ...qui.map((c) => c.inAttesa)) + (rotta(dove) ? 1 : 0)
  }, 0)
}

/** Una coda dell'app non si è letta: la copia è da parte, su disco o appena scoperta. */
function rotta(dove: string): boolean {
  return haCopia(dove) || [...vive].some((c) => c.dove === dove && c.stato.illeggibile)
}

/**
 * Vero se una coda dell'app è illeggibile: alla porta non c'è niente «da
 * inviare» che parta da solo, c'è da ricontrollare a mano.
 */
export function illeggibileDiTutte(): boolean {
  return CODE_DELL_APP.some(rotta)
}

/**
 * Quante scritture dell'app stanno solo in memoria (il disco non le ha
 * prese): ricaricando la pagina si perderebbero.
 */
export function soloInMemoriaDiTutte(): number {
  return [...vive].filter((c) => CODE_DELL_APP.includes(c.dove)).reduce((tot, c) => tot + c.soloInMemoria, 0)
}

/** Prova a mandare tutto ora, per al massimo `ms`: un server muto non deve tenere ferma l'uscita. */
export async function mandaTutto(ms: number): Promise<void> {
  await Promise.race([Promise.all([...vive].map((c) => c.scaricaEAspetta(ms))), pausa(ms)])
}

/** Dimentica le scritture ancora in coda, di tutte le code dell'app. */
/**
 * Le presenze di altri account in tutte le code dell'app, sommate per nome:
 * il telefono e la sala dello stesso dispositivo sono una cosa sola per chi esce.
 */
export function diAltriDiTutte(): DiAltri[] {
  const per = new Map<string, DiAltri>()
  for (const c of vive) {
    if (!CODE_DELL_APP.includes(c.dove)) continue
    for (const a of c.stato.diAltri ?? []) {
      const prima = per.get(a.nome)
      per.set(a.nome, prima ? { nome: a.nome, quante: prima.quante + a.quante, dal: Math.min(prima.dal, a.dal) } : { ...a })
    }
  }
  return [...per.values()]
}

export function svuotaTutte(): void {
  for (const c of vive) if (CODE_DELL_APP.includes(c.dove)) c.svuota()
  for (const dove of CODE_DELL_APP) {
    scrivi(dove, [])
    dimentica(dove)
  }
}

/**
 * Un permesso negato (42501) senza nessun accesso non è un no del server: la
 * richiesta è partita come anonima perché la sessione è scaduta, e il
 * rinnovo non è riuscito. Buttarla perderebbe la presenza: resta in coda
 * finché qualcuno rientra. Con l'accesso, invece, il no è vero. La sessione
 * si chiede solo per un 42501: per la rete che manca non serve.
 */
export async function aspettaLAccesso(e: unknown, conAccesso: () => boolean | Promise<boolean>): Promise<boolean> {
  const codice = (e as { code?: unknown } | null)?.code
  return codice === '42501' && !(await conAccesso())
}

/** Una riga della spia della coda: il tono decide il colore, il resto si legge. */
export interface AvvisoCoda {
  tono: 'attesa' | 'guaio'
  titolo: string
  frase: string
  /** Presenze di un altro account: aspettano lui, non la rete. */
  altri?: true
}

const quante = (n: number) => (n === 1 ? 'UNA PRESENZA DA INVIARE' : `${n} PRESENZE DA INVIARE`)

/**
 * Cosa dire a chi ha la coda davanti. Tre casi diversi, e chi li confonde
 * sbaglia: «salvate sul telefono» a memoria piena è falso (chiudendo l'app si
 * perdono), e una coda che non si legge non aspetta la rete, aspetta qualcuno
 * che ricontrolli l'appello.
 */
export function avvisiCoda(s: StatoCoda, dispositivo: 'telefono' | 'tablet' = 'telefono'): AvvisoCoda[] {
  const avvisi: AvvisoCoda[] = []
  if (s.illeggibile) {
    avvisi.push({
      tono: 'guaio',
      titolo: 'PRESENZE DA RICONTROLLARE',
      frase: `Alcune presenze salvate su questo ${dispositivo} non si leggono più: ricontrolla l’appello delle ultime lezioni.`,
    })
  }
  if (s.soloInMemoria > 0) {
    avvisi.push({
      tono: 'guaio',
      titolo: quante(s.inAttesa),
      frase: `Il ${dispositivo} non ha più spazio per salvarle: non chiudere l’app finché non partono.`,
    })
  } else if (s.inAttesa > 0) {
    avvisi.push({ tono: 'attesa', titolo: quante(s.inAttesa), frase: `Sono salvate sul ${dispositivo}: partono da sole appena c’è rete.` })
  }
  for (const a of s.diAltri ?? []) avvisi.push(avvisoDiAltri(a))
  return avvisi
}

const giornoDi = (t: number) => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })

/** «Le tue non sono toccate»: chi vede la seconda spia deve sapere che le sue partono lo stesso. */
function avvisoDiAltri(a: DiAltri): AvvisoCoda {
  const una = a.quante === 1
  const quando = giornoDi(a.dal) === giornoDi(Date.now()) && Date.now() - a.dal < 86_400_000 ? 'oggi' : `${una ? 'il' : 'dal'} ${giornoDi(a.dal)}`
  const chi = a.nome || (una ? 'chi l\'ha segnata' : 'chi le ha segnate')
  return {
    tono: 'attesa',
    altri: true,
    titolo: `${una ? 'UNA PRESENZA' : `${a.quante} PRESENZE`} DI ${(a.nome || 'un altro account').toUpperCase()}`,
    frase: `${una ? 'Segnata' : 'Segnate'} ${quando}, non ancora ${una ? 'arrivata' : 'arrivate'}: ${una ? 'parte' : 'partono'} quando ${chi} entra di nuovo con il suo account. Le tue non sono toccate.`,
  }
}

/**
 * Alla porta, quando la sessione è scaduta con qualcosa in coda: quelle
 * scritture aspettano un nuovo accesso (vedi `aspettaLAccesso`), e chi è
 * davanti al modulo deve saperlo per non pensarle perse.
 */
export function avvisoPerChiRientra(n: number, dispositivo: 'tablet' | 'dispositivo' = 'dispositivo', illeggibile = false): AvvisoCoda | null {
  if (n <= 0) return null
  // Una coda che non si legge non riparte col nuovo accesso: dirlo «da inviare» la farebbe credere al sicuro.
  if (illeggibile) {
    return {
      tono: 'guaio',
      titolo: 'PRESENZE DA RICONTROLLARE',
      frase: `Alcune presenze salvate su questo ${dispositivo} non si leggono più: entra e ricontrolla l’appello delle ultime lezioni.`,
    }
  }
  return {
    tono: 'attesa',
    titolo: n === 1 ? 'UNA MODIFICA DA INVIARE' : `${n} MODIFICHE DA INVIARE`,
    // Con un altro account restano qui, e partono solo quando rientra chi le ha segnate.
    frase: `Sono salvate su questo ${dispositivo}: entra di nuovo con lo stesso account e partono da sole.`,
  }
}
