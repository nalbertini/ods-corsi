/**
 * Dove sta la sessione di Supabase sul dispositivo.
 *
 * Qui e non in `supabase.ts` perché lo legge anche il timer (`timer/`): le due
 * app stanno sulla stessa origine e condividono il `localStorage`, quindi il
 * timer ritrova l'accesso fatto in ODS Corsi, istruttore o tablet di sala,
 * senza chiederne un altro. Perché funzioni devono calcolare la stessa chiave,
 * e il modo più sicuro è che la calcoli lo stesso codice. Niente import: il
 * timer se lo porta dietro senza tirarsi dietro il resto di ODS Corsi.
 *
 * La sessione è una sola per il dispositivo: segreteria, istruttori e tablet
 * di sala entrano tutti dalla stessa porta, e l'account dice in che area si
 * va. Chi è entrato in un'area non entra nelle altre: aprendo l'indirizzo di
 * un'altra si torna nella propria (vedi `accesso.ts`). Per cambiare area si
 * esce, e si rientra con un altro account.
 *
 * Prima le sessioni erano tre, una per area, ognuna sotto la sua chiave: vedi
 * `unisciSessioni`, che le riporta a una.
 */

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

/** La chiave di sempre di Supabase. */
export function chiaveSessione(indirizzo: string): string {
  let progetto = 'ods'
  try {
    progetto = new URL(indirizzo).hostname.split('.')[0]
  } catch {
    // Un indirizzo storto fallirà comunque alla prima chiamata.
  }
  return `sb-${progetto}-auth-token`
}

/**
 * Dove `accesso.ts` ricorda l'ultimo account visto, per l'apertura senza rete.
 */
export const PERSONA_VISTA = 'ods-corsi:personale'

/**
 * Le sessioni di prima riportate a una, una volta per dispositivo: la
 * segreteria e la sala avevano la loro chiave accanto a quella di sempre.
 * Se la chiave di sempre è vuota ci va una delle altre: su un tablet di sala
 * (`ods-corsi:modo`, vedi `tablet.ts`) quella della sala, altrove quella della
 * segreteria, così chi era collegato resta collegato. Le altre si buttano:
 * due account sullo stesso dispositivo sono proprio quello che non si vuole.
 */
export function unisciSessioni(indirizzo: string) {
  const chiave = chiaveSessione(indirizzo)
  const segreteria = `${chiave}-segreteria`
  const sala = `${chiave}-sala`
  try {
    const vecchie = [localStorage.getItem(segreteria), localStorage.getItem(sala)]
    if (!vecchie[0] && !vecchie[1]) return
    if (!localStorage.getItem(chiave)) {
      const tablet = localStorage.getItem('ods-corsi:modo') === 'tablet'
      const tenuta = tablet ? (vecchie[1] ?? vecchie[0]) : (vecchie[0] ?? vecchie[1])
      if (tenuta) localStorage.setItem(chiave, tenuta)
      // L'ultima persona vista della segreteria va con la sua sessione.
      const vista = localStorage.getItem(`${PERSONA_VISTA}-segreteria`)
      if (tenuta === vecchie[0] && vista) localStorage.setItem(PERSONA_VISTA, vista)
    }
    localStorage.removeItem(segreteria)
    localStorage.removeItem(sala)
    localStorage.removeItem(`${PERSONA_VISTA}-segreteria`)
  } catch {
    // Senza localStorage non c'è nemmeno una sessione salvata da spostare.
  }
}
