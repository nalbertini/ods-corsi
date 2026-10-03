// Dove era l'elenco sotto le schede a pieno schermo, per ogni contenitore che
// scorre. Condiviso fra le schede: passando da una all'altra la posizione
// segnata resta quella dell'elenco, non quella della scheda di prima.
const segnate = new WeakMap<object, { dovEra: number; aperte: number }>()
// L'ultima posizione dell'elenco vista scorrendo: quando la scheda si monta,
// l'elenco è già nascosto e il browser ha già tagliato `scrollTop` all'altezza
// della scheda, quindi lì non si può più leggere.
const ultime = new WeakMap<object, number>()

/**
 * Una scheda si apre nel contenitore `corpo`: la pagina va in cima, e la
 * funzione restituita la chiude. Solo se nessun'altra si apre nel frattempo
 * (un'altra scheda, o lo StrictMode che rimonta) la pagina torna dov'era
 * l'elenco. Si decide dopo un microtask, a commit finito: prima l'elenco torna
 * visibile, poi la pagina scende.
 */
export function apriScheda(corpo: { scrollTop: number }): () => void {
  const segnata = segnate.get(corpo) ?? { dovEra: ultime.get(corpo) ?? corpo.scrollTop, aperte: 0 }
  segnate.set(corpo, segnata)
  segnata.aperte++
  corpo.scrollTop = 0
  return () => {
    segnata.aperte--
    queueMicrotask(() => {
      if (segnata.aperte > 0 || segnate.get(corpo) !== segnata) return
      corpo.scrollTop = segnata.dovEra
      segnate.delete(corpo)
    })
  }
}

/** Da `onScroll` del contenitore: segna dove sta l'elenco, finché nessuna scheda è aperta. */
export function scorre(corpo: { scrollTop: number }): void {
  if (!segnate.has(corpo)) ultime.set(corpo, corpo.scrollTop)
}
