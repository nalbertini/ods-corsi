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
}

// Prefisso `ods-corsi:` e non `ods-timer:`: le due app stanno sullo stesso
// sito (il timer è pubblicato in `timer/`), e condividono un solo
// `localStorage` — l'origine è la stessa, la cartella non
// conta. Con lo stesso nome una si leggerebbe i dati dell'altra. Il timer usa
// questa stessa coda, sotto la sua chiave: una coda che trovasse le
// operazioni dell'altra app non saprebbe eseguirle, e si fermerebbe lì.
const DOVE = 'ods-corsi:coda'

const leggi = (dove: string): Operazione[] => {
  try {
    const grezzo = localStorage.getItem(dove)
    const lista: unknown = grezzo ? JSON.parse(grezzo) : []
    if (!Array.isArray(lista)) return []
    return lista.filter(
      (o): o is Operazione =>
        !!o && typeof o.chiave === 'string' && typeof o.tipo === 'string' && Array.isArray(o.args),
    )
  } catch {
    return []
  }
}

const scrivi = (dove: string, lista: Operazione[]) => {
  try {
    localStorage.setItem(dove, JSON.stringify(lista))
  } catch {
    /* Memoria piena o modalità privata: la coda vive comunque in memoria. */
  }
}

export class Coda {
  private lista: Operazione[]
  private sta = false
  private ascoltatori = new Set<(n: number) => void>()

  /**
   * @param esegui Porta davvero a termine l'operazione. Se solleva, l'operazione
   *   resta in coda e si riprova più tardi.
   * @param dove La chiave in `localStorage`: una per app.
   */
  constructor(
    private esegui: (op: Operazione) => Promise<void>,
    private dove = DOVE,
  ) {
    this.lista = leggi(dove)
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

  /** Quante scritture non sono ancora arrivate. */
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

  /** Avvisa quando la coda si allunga o si accorcia: serve alla spia in alto. */
  guarda(f: (n: number) => void) {
    this.ascoltatori.add(f)
    f(this.inAttesa)
    return () => this.ascoltatori.delete(f)
  }

  private avvisa() {
    for (const f of this.ascoltatori) f(this.inAttesa)
  }

  /** Mette in coda e prova subito. Non aspetta il server: l'interfaccia va avanti. */
  accoda(chiave: string, tipo: string, args: unknown[]) {
    this.lista = this.lista.filter((o) => o.chiave !== chiave)
    this.lista.push({ chiave, tipo, args, quando: Date.now() })
    scrivi(this.dove, this.lista)
    this.avvisa()
    void this.scarica()
  }

  /**
   * Svuota la coda, in ordine. Si ferma al primo errore invece di andare
   * avanti: se il server non risponde, insistere sulle successive è solo modo
   * di consumare batteria, e l'ordine fra due scritture sulla stessa lezione
   * conta.
   */
  async scarica(): Promise<void> {
    if (this.sta) return
    this.sta = true
    try {
      while (this.lista.length) {
        const op = this.lista[0]
        try {
          await this.esegui(op)
        } catch {
          return
        }
        // Può essere stata sostituita mentre il server rispondeva: si toglie
        // per identità, non per posizione.
        this.lista = this.lista.filter((o) => o !== op)
        scrivi(this.dove, this.lista)
        this.avvisa()
      }
    } finally {
      this.sta = false
    }
  }
}
