/**
 * Le guide per chi usa l'app, quelle della cartella `guida/`.
 *
 * I file sono gli stessi che si leggono su GitHub: l'app li prende così come
 * sono, uno per pagina, e li carica solo quando si aprono. Si scrivono una
 * volta sola, e nell'app e sul repository dicono la stessa cosa.
 *
 * Una pagina ha un nome, che è il percorso del file senza `.md` e senza
 * `README`: `''` è la guida generale, `sala` il tablet, `segreteria` l'indice
 * della segreteria, `segreteria/settimana` una sua voce. L'indirizzo è
 * `#guida/<nome>`.
 */
const FILE = import.meta.glob<string>('../../guida/**/*.md', { query: '?raw', import: 'default' })

const DOVE = '../../guida/'

/** `segreteria/README.md` → `segreteria`, `sala.md` → `sala`, `README.md` → `''`. */
function nomeDi(file: string): string {
  return file.replace(/\.md$/, '').replace(/(^|\/)README$/, '')
}

/** Il file di ogni pagina, relativo alla cartella `guida/`. */
const PAGINE = new Map(Object.keys(FILE).map((k) => [nomeDi(k.slice(DOVE.length)), k.slice(DOVE.length)]))

export const INDIRIZZO_GUIDA = '#guida'

export const eIndirizzoGuida = (hash: string) => hash === INDIRIZZO_GUIDA || hash.startsWith(`${INDIRIZZO_GUIDA}/`)

export const indirizzoPagina = (nome: string) => (nome ? `${INDIRIZZO_GUIDA}/${nome}` : INDIRIZZO_GUIDA)

/** La pagina dell'indirizzo, `''` per la guida generale. */
export function paginaDi(hash: string): string {
  const x = hash.slice(INDIRIZZO_GUIDA.length).replace(/^\//, '')
  try {
    return decodeURIComponent(x).replace(/\/$/, '')
  } catch {
    // Un indirizzo storpiato (`%E0`) diventa «pagina non trovata», non uno schermo bianco.
    return x.replace(/\/$/, '')
  }
}

export const esistePagina = (nome: string) => PAGINE.has(nome)

/** Il testo di una pagina, o `null` se non c'è. */
export async function leggiPagina(nome: string): Promise<string | null> {
  const file = PAGINE.get(nome)
  return file ? FILE[DOVE + file]() : null
}

/**
 * La guida pubblicata sta all'indirizzo dell'app: nei file i collegamenti
 * all'app sono scritti per intero, perché su GitHub funzionino. Nell'app
 * bastano l'indirizzo interno (`#istruttori`), che vale anche in prova e sul
 * computer di chi la sviluppa.
 */
const APP_PUBBLICATA = 'https://nalbertini.github.io/ods-corsi/'

/**
 * Dove porta un collegamento scritto in una pagina: un altro file della guida
 * diventa la sua pagina nell'app, un indirizzo dell'app resta nell'app, il
 * resto esce. `esterno` dice se va aperto a parte.
 */
export function risolvi(href: string, pagina: string): { href: string; esterno: boolean } {
  if (href.startsWith(APP_PUBBLICATA)) return { href: href.slice(APP_PUBBLICATA.length) || '#', esterno: false }
  if (/^[a-z]+:/i.test(href) || href.startsWith('#')) return { href, esterno: !href.startsWith('#') }

  const [percorso, ancora] = href.split('#')
  const qui = (PAGINE.get(pagina) ?? 'README.md').split('/').slice(0, -1)
  for (const pezzo of percorso.split('/')) {
    if (pezzo === '..') qui.pop()
    else if (pezzo && pezzo !== '.') qui.push(pezzo)
  }
  const nome = nomeDi(qui.join('/'))
  if (!PAGINE.has(nome)) return { href, esterno: true }
  return { href: indirizzoPagina(nome) + (ancora ? `#${ancora}` : ''), esterno: false }
}
