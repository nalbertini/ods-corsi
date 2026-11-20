/**
 * Un tasto che manda qualcosa parte una volta sola, anche col doppio tocco.
 * Il tasto si spegne solo al giro dopo di React: un secondo tocco svelto
 * arriva prima, e senza questa guardia rimanderebbe (ERO PRESENTE tornerebbe
 * «L'hai già segnalata»). Il tocco durante l'invio non fa niente e torna
 * subito; finito l'invio, bene o con un errore, si può ritoccare.
 */
export function unToccoAllaVolta() {
  let inVolo = false
  return async (fai: () => Promise<void>): Promise<void> => {
    if (inVolo) return
    inVolo = true
    try {
      await fai()
    } finally {
      inVolo = false
    }
  }
}
