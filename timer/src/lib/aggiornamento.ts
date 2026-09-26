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
 *  3. non si ricarica mai con un timer aperto. Un allenamento a metà vale più
 *     di un aggiornamento immediato, che può aspettare la fine.
 */

let timerAperto = false
let daRicaricare = false
let giàRicaricata = false

function ricarica() {
  if (giàRicaricata) return
  giàRicaricata = true
  window.location.reload()
}

/** Chiamata dalla schermata del timer: finché è aperta non si ricarica nulla. */
export function segnalaTimerAperto(aperto: boolean) {
  timerAperto = aperto
  if (!aperto && daRicaricare) ricarica()
}

function ricaricaQuandoPossibile() {
  if (timerAperto) {
    daRicaricare = true
    return
  }
  ricarica()
}

let registrazione: ServiceWorkerRegistration | null = null

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
    if (controllata) ricaricaQuandoPossibile()
    else controllata = true
  })

  // Senza HTTPS, in incognito o dentro un iframe isolato la registrazione
  // fallisce: l'app resta perfettamente usabile, solo senza cache offline.
  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((reg) => {
      registrazione = reg
      const controlla = () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', controlla)
      window.setInterval(controlla, 60 * 60 * 1000)
    })
    .catch(() => {})
}

export type EsitoControllo = 'nuova' | 'aggiornata' | 'non-disponibile'

/**
 * Il controllo a mano, dalle impostazioni: serve a chi ha in mano il tablet
 * della sala e vuole sapere adesso se sta guardando l'ultima versione.
 */
export async function cercaAggiornamenti(): Promise<EsitoControllo> {
  if (!registrazione) return 'non-disponibile'
  try {
    await registrazione.update()
  } catch {
    return 'non-disponibile'
  }
  // `installing` o `waiting` significa che una versione nuova è arrivata: il
  // service worker si attiva da solo e il cambio di controllo ricarica.
  return registrazione.installing || registrazione.waiting ? 'nuova' : 'aggiornata'
}

/** Il momento in cui è stata compilata questa versione. */
export const COMPILATA_IL = __BUILD_DATE__

/** Il numero di versione, preso da `package.json`: una fonte sola. */
export const VERSIONE = __APP_VERSION__

/** Il commit da cui è compilata questa copia, vuoto fuori dal repository. */
export const COMMIT = __APP_COMMIT__
