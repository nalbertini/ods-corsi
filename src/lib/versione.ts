/**
 * La versione dell'app, per chi deve dire quale sta usando: il numero di
 * package.json e il commit da cui è compilata (vedi vite.config.ts).
 *
 * Una PWA installata si aggiorna da sé (`aggiornamento.ts`), ma se qualcosa
 * non torna la prima domanda è «che versione hai?»: la risposta è in fondo
 * alla pagina di scelta, nel piede del tablet e nel menu della segreteria.
 */
export const VERSIONE = __COMMIT__ ? `v${__VERSIONE__} · ${__COMMIT__}` : `v${__VERSIONE__}`

/** Quando è stata compilata, per il suggerimento al passaggio del mouse. */
export const COMPILATA = new Date(__COMPILATA__).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })


/** Da mettere nel `title`: la versione e quando è stata compilata. */
export const VERSIONE_ESTESA = `ODS Corsi ${VERSIONE} — compilata il ${COMPILATA}`
