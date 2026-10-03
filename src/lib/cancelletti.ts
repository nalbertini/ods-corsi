/**
 * Gli indirizzi dopo il cancelletto che non sono della segreteria: la guida e
 * la scelta dell'area. Stanno qui, senza Vite né React, perché la segreteria
 * li deve riconoscere anche nelle prove senza browser.
 */
export const INDIRIZZO_GUIDA = '#guida'

export const eIndirizzoGuida = (hash: string) => hash === INDIRIZZO_GUIDA || hash.startsWith(`${INDIRIZZO_GUIDA}/`)

export const INDIRIZZO_AREE = '#aree'
