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
 */

let giàRicaricata = false
let trattenuta = false
let inAttesa = false

function ricarica() {
  if (giàRicaricata) return
  // Il timer del tablet di sala a metà allenamento: si ricarica dopo.
  if (trattenuta) {
    inAttesa = true
    return
  }
  giàRicaricata = true
  window.location.reload()
}

/**
 * Il ricaricamento aspetta finché serve: sul tablet di sala il timer sta
 * nella stessa pagina, e un allenamento a metà vale più di una versione nuova
 * subito. Quando il timer si ferma, se era arrivata, la versione nuova entra.
 */
export function trattieniAggiornamento(si: boolean) {
  trattenuta = si
  if (!si && inAttesa) ricarica()
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
