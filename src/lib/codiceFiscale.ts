/**
 * Il codice fiscale, letto invece che solo contato.
 *
 * Sedici caratteri non bastano: in un codice copiato a mano la lettera
 * sbagliata è la regola, e l'ultimo carattere, che si calcola dagli altri
 * quindici, la scopre quasi sempre. Dentro ci sono anche la data di nascita e
 * tre lettere per cognome e nome, così si vede se il codice è della persona
 * del modulo o, per dire, del genitore messo nella casella sbagliata.
 *
 * Le stesse regole stanno in `supabase/06-iscrizioni.sql` (`cf_controllo`,
 * `cf_nato_il`), tranne cognome e nome: quelli qui danno solo un avviso,
 * perché con i doppi cognomi e i nomi stranieri le tre lettere non sempre
 * tornano, e il database non rifiuta niente per un avviso.
 */

/**
 * Cognome, nome, anno, mese, giorno e sesso, comune, controllo. Le cifre
 * possono essere lettere (LMNPQRSTUV per 0-9): è l'omocodia, per le persone
 * che altrimenti avrebbero lo stesso codice.
 */
export const STRUTTURA_CF = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/

const MESI = 'ABCDEHLMPRST'
const OMOCODIA = 'LMNPQRSTUV'
/** Il valore dei caratteri in posizione dispari; le cifre valgono come A-J. */
const DISPARI = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23]

const valore = (c: string) => (c >= '0' && c <= '9' ? c.charCodeAt(0) - 48 : c.charCodeAt(0) - 65)

/** L'ultimo carattere, calcolato dai primi quindici. */
export function carattereControllo(cf: string): string {
  let somma = 0
  for (let i = 0; i < 15; i++) somma += i % 2 === 0 ? DISPARI[valore(cf[i])] : valore(cf[i])
  return String.fromCharCode(65 + (somma % 26))
}

/** Scritto giusto: la forma e il carattere di controllo. */
export const cfValido = (cf: string) => STRUTTURA_CF.test(cf) && carattereControllo(cf) === cf[15]

const cifre = (s: string) => Number(s.replace(/[LMNPQRSTUV]/g, (c) => String(OMOCODIA.indexOf(c))))

/**
 * La data di nascita scritta nel codice, `AAAA-MM-GG`. L'anno ha due cifre:
 * si prende il secolo più recente che non la metta nel futuro. `null` se il
 * codice non è valido o la data non esiste.
 */
export function cfNatoIl(cf: string, oggi = new Date()): string | null {
  if (!cfValido(cf)) return null
  const aa = cifre(cf.slice(6, 8))
  const mese = MESI.indexOf(cf[8]) + 1
  let giorno = cifre(cf.slice(9, 11))
  if (giorno > 40) giorno -= 40
  let anno = 2000 + aa
  if (new Date(anno, mese - 1, giorno) > oggi) anno -= 100
  const d = new Date(anno, mese - 1, giorno)
  if (d.getMonth() !== mese - 1 || d.getDate() !== giorno) return null
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
}

/** Il codice e la data di nascita dicono lo stesso giorno (l'anno a due cifre). */
export function cfTornaConLaData(cf: string, natoIl: string): boolean {
  const dal = cfNatoIl(cf)
  return !!dal && dal.slice(2) === natoIl.slice(2)
}

/** Solo le lettere, senza accenti e in maiuscolo: «D'Agostino» → «DAGOSTINO». */
const lettere = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')

const tre = (consonanti: string, vocali: string) => (consonanti + vocali + 'XXX').slice(0, 3)
const divise = (s: string) => {
  const l = lettere(s)
  return [l.replace(/[AEIOU]/g, ''), l.replace(/[^AEIOU]/g, '')]
}

/** Le tre lettere del cognome: le consonanti, poi le vocali, poi X. */
export function lettereCognome(cognome: string): string {
  const [c, v] = divise(cognome)
  return tre(c, v)
}

/** Le tre lettere del nome: con quattro consonanti o più, la prima, la terza e la quarta. */
export function lettereNome(nome: string): string {
  const [c, v] = divise(nome)
  return c.length >= 4 ? c[0] + c[2] + c[3] : tre(c, v)
}

/** Le prime sei lettere tornano con cognome e nome. */
export const cfTornaColNome = (cf: string, nome: string, cognome: string) => cf.slice(0, 6) === lettereCognome(cognome) + lettereNome(nome)
