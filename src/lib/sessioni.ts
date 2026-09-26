/**
 * Dove sta la sessione di Supabase sul dispositivo.
 *
 * Qui e non in `supabase.ts` perché lo legge anche il timer (`timer/`): le due
 * app stanno sulla stessa origine e condividono il `localStorage`, quindi il
 * timer ritrova l'accesso fatto in ODS Corsi, istruttore o tablet di sala,
 * senza chiederne un altro. Perché funzioni devono calcolare le stesse chiavi,
 * e il modo più sicuro è che le calcoli lo stesso codice. Niente import: il
 * timer se lo porta dietro senza tirarsi dietro il resto di ODS Corsi.
 */

/**
 * Di chi è la sessione: degli istruttori (`personale`, il nome di sempre, ed è
 * quella che legge il timer), della segreteria o del tablet di sala.
 *
 * Istruttori e segreteria avevano una sessione sola, e sullo stesso browser
 * l'accesso fatto in segreteria valeva anche agli istruttori: chi apriva
 * `istruttori/` sul computer della reception si trovava dentro con l'account
 * della segreteria, e da lì il link alla segreteria lo faceva entrare. Ora
 * ognuna ha la sua porta e la sua sessione.
 */
export type Sessione = 'personale' | 'segreteria' | 'sala'

/**
 * L'indirizzo del progetto, anche se nel segreto è finito quello dell'API.
 *
 * Il pannello di Supabase mostra accanto alla *Project URL* anche l'indirizzo
 * dell'API REST, `https://….supabase.co/rest/v1/`, ed è facile copiare quello:
 * il client ci attacca `/auth/v1/…` e l'accesso finisce su un indirizzo che
 * non esiste. Qui si tiene solo la radice.
 */
export function indirizzoProgetto(grezzo: string): string {
  return grezzo.trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/, '')
}

/** Quella degli istruttori è la chiave di sempre di Supabase; segreteria e sala hanno la loro accanto. */
export function chiaviSessione(indirizzo: string): Record<Sessione, string> {
  let progetto = 'ods'
  try {
    progetto = new URL(indirizzo).hostname.split('.')[0]
  } catch {
    // Un indirizzo storto fallirà comunque alla prima chiamata.
  }
  const personale = `sb-${progetto}-auth-token`
  return { personale, segreteria: `${personale}-segreteria`, sala: `${personale}-sala` }
}

/**
 * Dove `accesso.ts` ricorda l'ultima persona vista, per l'apertura senza rete:
 * una per sessione, così uscire da un'area non la dimentica nell'altra.
 */
export const PERSONA_VISTA: Record<Exclude<Sessione, 'sala'>, string> = {
  personale: 'ods-corsi:personale',
  segreteria: 'ods-corsi:personale-segreteria',
}
