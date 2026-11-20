/**
 * L'aggiornamento dell'app.
 *
 * Una PWA installata non si «ricarica» mai: chi la apre in palestra continua a
 * vedere la versione con cui l'ha installata finché qualcosa non gliela cambia
 * sotto. Qui ci sono le tre cose che servono perché succeda da sé:
 *
 *  1. si controlla se c'è una versione nuova quando l'app torna in primo piano,
 *     che per un'app installata è l'unico momento equivalente a un caricamento;
 *  2. quando il nuovo service worker prende il posto del vecchio, la pagina si
 *     ricarica, perché il codice già in memoria resta quello di prima;
 *
 * Nel timer c'era un terzo punto: non ricaricare mai a metà allenamento. Per
 * le presenze non serve — ogni presenza è scritta su disco prima di partire
 * (`coda.ts`), quindi un ricaricamento a metà appello non perde niente — ma il
 * tablet di sala ha il timer dentro, e lì vale ancora (`trattieniAggiornamento`).
 * Vale anche per il modulo d'iscrizione: quello che c'è scritto sta solo in
 * pagina, e un ricaricamento lo cancellerebbe.
 */

let giàRicaricata = false
/** Chi trattiene adesso: il timer del tablet, uno o più moduli aperti. */
let trattenitori = 0
let inAttesa = false

function ricarica() {
  if (giàRicaricata) return
  // Un allenamento a metà o un modulo aperto: si ricarica dopo.
  if (trattenitori > 0) {
    inAttesa = true
    return
  }
  giàRicaricata = true
  window.location.reload()
}

/**
 * Il ricaricamento aspetta finché serve: un allenamento a metà, o un modulo
 * compilato a metà, valgono più di una versione nuova subito. Restituisce la
 * funzione che lascia; quando lascia l'ultimo, se era arrivata, la versione
 * nuova entra. È un conteggio e non un sì/no perché tablet e modulo, o due
 * moduli, possono trattenere insieme: chi lascia per primo non deve far
 * ricaricare la pagina sotto l'altro.
 */
export function trattieniAggiornamento(): () => void {
  trattenitori++
  let lasciato = false
  return () => {
    // Lo stesso rilascio chiamato due volte (React in sviluppo) conta una.
    if (lasciato) return
    lasciato = true
    trattenitori--
    if (trattenitori === 0 && inAttesa) ricarica()
  }
}

export function aggiornamentoTrattenuto(): boolean {
  return trattenitori > 0
}

const CHIAVE_PEZZO = 'ods-ricaricata-per-pezzo'

/**
 * Dopo una pubblicazione i file con l'impronta nel nome (`supabase-xxx.js`)
 * cambiano: una pagina rimasta aperta, o servita dalla cache, chiede quelli
 * vecchi e non li trova più. Ricaricare basta, una volta; se il guaio resta
 * (rete assente, file davvero mancante) non si ricarica all'infinito.
 */
export function ricaricarePerPezzoMancante(ultima: string | null, ora: number): boolean {
  const quando = Number(ultima)
  return !Number.isFinite(quando) || ora - quando > 30_000
}

/**
 * Vite lancia questo evento quando un pezzo caricato al bisogno non arriva.
 * Lo si ascolta subito, non al `load`: il guaio può capitare prima.
 */
export function ricaricaSePezzoMancante() {
  window.addEventListener('vite:preloadError', (e) => {
    // Con un modulo aperto ricaricare cancellerebbe quel che c'è scritto:
    // l'errore arriva a chi ha chiesto il pezzo, che dice di riprovare.
    if (aggiornamentoTrattenuto()) return
    try {
      if (!ricaricarePerPezzoMancante(sessionStorage.getItem(CHIAVE_PEZZO), Date.now())) return
      sessionStorage.setItem(CHIAVE_PEZZO, String(Date.now()))
    } catch {
      return // senza sessionStorage non si può evitare il ciclo: meglio l'errore
    }
    e.preventDefault()
    ricarica()
  })
}

/** Registra il service worker e tiene d'occhio gli aggiornamenti. */
export function registraAggiornamenti() {
  if (!('serviceWorker' in navigator)) return

  // Il primo cambio di controllo di una pagina non ancora controllata è
  // l'installazione, non un aggiornamento: lì ricaricare sarebbe un lampo
  // senza motivo. Dal secondo in poi vuol dire che una versione nuova ha
  // preso il posto della vecchia, e allora la pagina va rifatta.
  // Lo stato va aggiornato man mano e non letto una volta sola all'avvio:
  // una scheda aperta dalla prima visita non si aggiornerebbe mai più.
  let controllata = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controllata) ricarica()
    else controllata = true
  })

  // Senza HTTPS, in incognito o dentro un iframe isolato la registrazione
  // fallisce: l'app resta perfettamente usabile, solo senza cache offline.
  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((reg) => {
      const controlla = () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', controlla)
      window.setInterval(controlla, 60 * 60 * 1000)
    })
    .catch(() => {})
}
