// ---------------------------------------------------------------------------
// Il sito pubblico: dalle pagine pubblicate nel pannello SITO ai file statici.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… node scripts/genera-sito.mjs [cartella]
//   node scripts/genera-sito.mjs [cartella] --da-file dati.json
//
// Legge solo le tre funzioni pubbliche del database (`sito_pagine_pubbliche`,
// `sito_menu_pubblico`, `sito_redirect_pubblici`) con la chiave anon: mai le
// bozze, mai le pagine nascoste. Per le pagine collegate ai corsi legge anche
// `orari_aperti()` (solo corso, giorno, ora, durata): se manca la funzione o la
// colonna (48 o 68 non lanciati) le pagine restano non collegate (lo decide `datiDaRisposte`), e il giro non si ferma. Scrive i file in `<cartella>` (di solito
// `dist-sito`), con carattere e logo da `sito/risorse/`. Se qualcosa non va non
// tocca la cartella: i file nascono in una cartella accanto e la sostituiscono
// solo a lavoro finito, così il sito di prima resta com'è.
//
// La cartella di uscita si svuota e si rifà: per questo lo script rifiuta le
// cartelle che non si cancellano (il repository, quella da cui lo si lancia,
// quelle sopra, la cartella di casa, la radice).
//
// `--da-file` legge le stesse risposte da un file json (`{ pagine, menu,
// rinvii, orari? }`), senza rete: per provare il sito e per i test.
// `SITO_DOMINIO` cambia il dominio (di norma https://www.officinedellosport.it).
// Codici di uscita: 0 fatto; 2 la home non è ancora pubblicata (niente da pubblicare); 1 un guasto.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'

/** Il percorso vero, senza collegamenti (su macOS «/var» è «/private/var»), anche se la cartella non esiste ancora. */
function vera(p) {
  try {
    return realpathSync(p)
  } catch {
    const su = dirname(p)
    return su === p ? p : join(vera(su), basename(p))
  }
}

const argomenti = process.argv.slice(2)
const iFile = argomenti.indexOf('--da-file')
const daFile = iFile >= 0 ? argomenti[iFile + 1] : null
const uscita = vera(resolve(argomenti.find((a, i) => !a.startsWith('--') && i !== iFile + 1) ?? 'dist-sito'))
const dominio = process.env.SITO_DOMINIO || 'https://www.officinedellosport.it'
const radice = vera(resolve(import.meta.dirname, '..'))

const fine = (testo) => {
  console.error(`✗ ${testo}`)
  process.exit(1)
}

// La cartella di uscita si cancella: mai una che contiene il repository, la cartella da cui si lancia, casa o la radice.
const nonSiCancella = [radice, vera(process.cwd()), vera(homedir()), sep]
if (nonSiCancella.some((p) => p === uscita || `${p}${p.endsWith(sep) ? '' : sep}`.startsWith(`${uscita}${uscita.endsWith(sep) ? '' : sep}`))) {
  fine(`La cartella di uscita «${uscita}» non si può usare: si svuota prima di scriverci, e qui c'è altro. Scegline una dentro, per esempio dist-sito.`)
}

const risorse = join(radice, 'sito/risorse')
if (!existsSync(risorse)) fine('Manca la cartella sito/risorse (carattere e logo).')

// Il generatore è TypeScript e usa sanitize-html (che vuole `require`): si impacchetta come fanno le prove.
const { outputFiles } = await build({
  entryPoints: [join(radice, 'src/lib/sitoGenera.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
  define: { 'import.meta.env': '{}' },
  banner: { js: `import { createRequire as __cr } from 'node:module'; const require = __cr(${JSON.stringify(`${radice}/`)});` },
})
const { generaSito, datiDaRisposte, prefissoImmagini } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

async function leggi() {
  if (daFile) {
    try {
      return JSON.parse(readFileSync(resolve(daFile), 'utf8'))
    } catch {
      return fine(`Non riesco a leggere i dati da «${daFile}»: manca il file, o non è un json fatto come { pagine, menu, rinvii }.`)
    }
  }
  const url = process.env.SUPABASE_URL
  const chiave = process.env.SUPABASE_ANON_KEY
  if (!url || !chiave) fine('Mancano SUPABASE_URL e SUPABASE_ANON_KEY (la chiave anon, quella pubblica).')
  // Una funzione o una colonna che il database non ha ancora: non è un guasto, la parte nuova semplicemente non c'è.
  const MANCA = new Set(['42703', '42883', 'PGRST202'])
  const chiama = async (funzione, { facoltativa = false } = {}) => {
    let r
    try {
      r = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${funzione}`, {
        method: 'POST',
        headers: { apikey: chiave, Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(20000),
      })
    } catch {
      fine(`Il database non risponde (${funzione}): riprova fra poco.`)
    }
    if (!r.ok && facoltativa && MANCA.has((await r.json().catch(() => ({}))).code)) return null
    if (!r.ok) fine(`Il database ha rifiutato ${funzione} (${r.status}): manca 56-sito.sql, o va rilanciato 06-iscrizioni.sql.`)
    try {
      return await r.json()
    } catch {
      return fine(`Il database ha risposto una cosa che non si legge (${funzione}): riprova fra poco.`)
    }
  }
  const [pagine, menu, rinvii, orari] = await Promise.all([chiama('sito_pagine_pubbliche'), chiama('sito_menu_pubblico'), chiama('sito_redirect_pubblici'), chiama('orari_aperti', { facoltativa: true })])
  return { pagine, menu, rinvii, orari }
}

const risposte = await leggi()
for (const nome of ['pagine', 'menu', 'rinvii']) {
  if (!Array.isArray(risposte[nome])) fine(`I dati non sono fatti come si aspetta il generatore: «${nome}» dovrebbe essere un elenco.`)
}
const dati = datiDaRisposte(dominio, risposte.pagine, risposte.menu, risposte.rinvii, Array.isArray(risposte.orari) ? risposte.orari : undefined)
// Le immagini delle pagine stanno nel contenitore «sito» del progetto: solo quelle entrano nel sito (vedi `supabase/58-sito-immagini.sql`).
if (process.env.SUPABASE_URL) {
  let origine
  try {
    origine = new URL(process.env.SUPABASE_URL).origin
  } catch {
    fine('SUPABASE_URL non è un indirizzo valido (deve cominciare con https://).')
  }
  dati.ospitiImmagini = [prefissoImmagini(origine)]
}
if (!dati.pagine.some((p) => p.slug === 'home')) {
  // Codice 2: «non c'è ancora niente da pubblicare». Chi pubblica il sito lo distingue da un guasto (codice 1).
  console.error('✗ La pagina iniziale (home) non è pubblicata: non genero un sito senza prima pagina.')
  process.exit(2)
}

let file
try {
  file = generaSito(dati)
} catch (e) {
  fine(e instanceof Error ? e.message : 'Non sono riuscito a generare il sito.')
}

const nuova = `${uscita}.nuovo`
const vecchia = `${uscita}.vecchio`
try {
  rmSync(nuova, { recursive: true, force: true })
  for (const [percorso, contenuto] of Object.entries(file)) {
    const dove = join(nuova, percorso)
    mkdirSync(dirname(dove), { recursive: true })
    writeFileSync(dove, contenuto)
  }
  cpSync(risorse, join(nuova, 'risorse'), { recursive: true })
  // Il sito di prima si sposta da parte e si butta solo a cambio fatto: non c'è un momento senza sito.
  rmSync(vecchia, { recursive: true, force: true })
  if (existsSync(uscita)) renameSync(uscita, vecchia)
  renameSync(nuova, uscita)
  rmSync(vecchia, { recursive: true, force: true })
} catch {
  fine('Non sono riuscito a scrivere i file del sito: controlla che la cartella di uscita si possa scrivere.')
} finally {
  rmSync(nuova, { recursive: true, force: true })
}
console.log(`✓ ${Object.keys(file).length} file in ${uscita} (${dati.pagine.length} pagine)`)
