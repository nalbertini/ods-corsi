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
const piano = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

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
