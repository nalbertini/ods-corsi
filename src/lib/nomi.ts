/**
 * Nomi e cognomi come si scrivono: la prima lettera di ogni parola maiuscola,
 * il resto minuscolo, gli spazi in più via. «MARIA GRAZIA» e «maria grazia»
 * diventano «Maria Grazia», «d'amico» «D'Amico», «rossi-bianchi»
 * «Rossi-Bianchi». Il database fa lo stesso da sé (`nome_proprio` in
 * `supabase/20-nomi.sql`), così prova e database scrivono uguale.
 */
export function nomeProprio(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('it')
    .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, prima: string, lettera: string) => prima + lettera.toLocaleUpperCase('it'))
}

/** Senza maiuscole né accenti: «nicolò» trova «Nicolo». */
export const piano = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Apostrofi e trattini (anche lunghi) di ogni tastiera: D'Amico, D’Amico e De-Luca si scrivono in tanti modi. */
const STACCA = /['’‘ʼ´‐–—-]/g

/** Un nome scritto attaccato, senza accenti, apostrofi e trattini: D'Amico, D’amico e Damico diventano «damico». */
export const compatto = (s: string) => piano(s).replace(STACCA, '').replace(/\s+/g, '')

/** Le parole di un nome, senza accenti, apostrofi, trattini e punti: «Maria-Chiara M.» → maria, chiara, m. */
export const paroleDelNome = (s: string): string[] =>
  piano(s)
    .replace(STACCA, ' ')
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter(Boolean)

/** Le parole di quel che si sta scrivendo per cercare qualcuno, senza apostrofi né trattini. */
export const paroleCercate = (scritto: string): string[] =>
  piano(scritto)
    .split(/\s+/)
    .map((w) => w.replace(STACCA, ''))
    .filter(Boolean)

/**
 * Se nome e cognome vanno bene per le parole cercate: ognuna è l'inizio di
 * una parola del nome o del cognome, o del nome o del cognome scritti
 * attaccati, ciascuno per conto suo. Così «d'am», «damico» e «amico» trovano
 * D'Amico e «deluca» De Luca, comunque li abbia scritti chi li ha salvati.
 * Va bene anche tutto lo scritto attaccato, se è l'inizio del nome o del
 * cognome attaccati: «de luca» trova Deluca.
 */
export function somiglia(p: { nome: string; cognome: string }, parole: string[]): boolean {
  const nomi = [p.nome, p.cognome].map(piano)
  const attaccati = [p.nome, p.cognome].map(compatto)
  const sue = [...nomi.flatMap((n) => n.replace(STACCA, ' ').split(/\s+/)), ...attaccati]
  return parole.every((w) => sue.some((s) => s.startsWith(w))) || attaccati.some((s) => s.startsWith(parole.join('')))
}

/**
 * La scheda del personale da riprendere quando se ne aggiunge uno, invece di
 * farne un doppione: quella senza email con lo stesso nome e cognome, scritti
 * attaccati (D'Amico e D’Amico, senza jolly). Un'email già di un altro del
 * personale è un errore. Mai la scheda di un iscritto, neanche con la stessa
 * email o lo stesso nome: chi si allena e insegna ha due schede, una da
 * iscritto e una del personale (scelta della palestra, 2026-11-12).
 */
export function personaleDaRiprendere<P extends { nome: string; cognome: string; email?: string | null; ruolo: string }>(
  persone: readonly P[],
  nuovo: { nome: string; cognome: string; email?: string | null },
): P | undefined {
  const personale = persone.filter((p) => p.ruolo !== 'iscritto')
  const email = nuovo.email?.trim().toLowerCase()
  const altro = email && personale.find((p) => p.email?.toLowerCase() === email)
  if (altro) throw new Error(`Questa email è già di ${altro.cognome ? `${altro.nome} ${altro.cognome}` : altro.nome}`)
  return personale.find((p) => !p.email && compatto(p.nome) === compatto(nuovo.nome) && compatto(p.cognome) === compatto(nuovo.cognome))
}
