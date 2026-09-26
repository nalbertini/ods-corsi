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

/** Di chi è la sessione: del personale (istruttori e segreteria) o del tablet di sala. */
export type Sessione = 'personale' | 'sala'

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

/** Quella del personale è la chiave di sempre di Supabase; la sala ha la sua accanto. */
export function chiaviSessione(indirizzo: string): Record<Sessione, string> {
  let progetto = 'ods'
  try {
    progetto = new URL(indirizzo).hostname.split('.')[0]
  } catch {
    // Un indirizzo storto fallirà comunque alla prima chiamata.
  }
  const personale = `sb-${progetto}-auth-token`
  return { personale, sala: `${personale}-sala` }
}
