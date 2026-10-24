// ---------------------------------------------------------------------------
// Le stesse prove sui due motori della segreteria, senza browser.
//
//   node scripts/prova-segreteria-comune.mjs
//   PGRST_URL=http://localhost:3000 PGRST_JWT_SECRET=… node scripts/prova-segreteria-comune.mjs
//
// segreteriaProva.ts e segreteriaSupabase.ts sono due versioni di
// `DatiSegreteria`: se dicono cose diverse, l'app in prova passa le prove e in
// palestra fa un'altra cosa. Qui ogni caso si scrive una volta, su
// `DatiSegreteria`, e gira sul motore di prova sempre; su quello Supabase
// quando c'è un PostgREST davanti allo schema delle prove SQL (lo prepara
// scripts/segreteria-comune/avvia.sh, in CI il lavoro «Segreteria sui due motori»).
//
// Un caso nuovo: una funzione in `casi` che usa solo `DatiSegreteria`, crea i
// dati che le servono (il database è condiviso fra i casi) e confronta con
// `ok`. Lo stesso voluto vale per tutti e due i motori.
// ---------------------------------------------------------------------------
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { build } from 'esbuild'

// segreteriaProva tiene i dati nel localStorage: qui basta una mappa.
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
  // sanitize-html (dal sito) usa require: nel bundle ESM va dato a mano.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// Un nome che non si ripete fra un giro e l'altro sullo stesso database.
const giro = Date.now().toString(36)
// Il giorno del dispositivo, come `chiaveGiorno` dei due motori: non quello UTC, che dopo mezzanotte in Italia è ancora ieri.
const oggi = new Date().toLocaleDateString('sv-SE')

const casi = {
  async 'un corso nuovo c’è, e archiviato non è più attivo'(s) {
    const sala = await s.salvaSala({ nome: `Tatami ${giro}`, capienza: 20 })
    const id = await s.salvaCorso({ nome: `Judo ${giro}`, salaId: sala, istruttori: [], capienza: 12 })
    const c = (await s.corsi()).find((x) => x.id === id)
    ok('si legge col suo nome, la sala e la capienza', [c?.nome, c?.sala, c?.capienza, c?.attivo], [`Judo ${giro}`, `Tatami ${giro}`, 12, true])
    await s.archiviaCorso(id, false)
    ok('archiviato: attivo è falso', (await s.corsi()).find((x) => x.id === id)?.attivo, false)
  },

  async 'una persona nuova è attiva, senza iscrizioni né certificato'(s) {
    const id = await s.salvaPersona({ nome: 'Lia', cognome: `Prova${giro}`, telefono: '3331234567' })
    const p = (await s.persone()).find((x) => x.id === id)
    ok('nome, telefono, attiva', [p?.nome, p?.telefono, p?.attiva], ['Lia', '3331234567', true])
    ok('nessuna iscrizione', p?.iscrizioni, [])
    ok('nessun certificato', [p?.certificato.scade, p?.certificato.conFile], [undefined, false])
    await s.attivaPersona(id, false)
    ok('disattivata: attiva è falso', (await s.persone()).find((x) => x.id === id)?.attiva, false)
  },

  async 'iscrivere e terminare un corso'(s) {
    const corso = await s.salvaCorso({ nome: `Karate ${giro}`, istruttori: [] })
    const id = await s.salvaPersona({ nome: 'Ugo', cognome: `Iscritto${giro}` })
    await s.iscrivi(id, corso)
    const iscr = () => s.persone().then((ps) => ps.find((x) => x.id === id)?.iscrizioni.filter((i) => i.corsoId === corso))
    ok('iscritto da oggi, senza fine', (await iscr()).map((i) => [i.dal, i.al]), [[oggi, undefined]])
    await s.termina(id, corso)
    ok('terminata oggi', (await iscr()).map((i) => [i.dal, i.al]), [[oggi, oggi]])
  },

  async 'la scadenza del certificato scritta a mano'(s) {
    const id = await s.salvaPersona({ nome: 'Eva', cognome: `Medica${giro}` })
    await s.salvaCertificato(id, '2027-06-30')
    const c = (await s.persone()).find((x) => x.id === id)?.certificato
    ok('la data c’è, il file no', [c?.scade, c?.conFile], ['2027-06-30', false])
  },
}

/** Un token HS256 di chi sta in segreteria (scripts/segreteria-comune/postgrest.sql). */
function token(segreto) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const corpo = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '5e5e5e5e-0000-0000-0000-000000000001', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}`
  return `${corpo}.${createHmac('sha256', segreto).update(corpo).digest('base64url')}`
}

const motori = [['prova', () => m.creaSegreteriaProva()]]
if (process.env.PGRST_URL) {
  const base = process.env.PGRST_URL.replace(/\/$/, '')
  const jwt = token(process.env.PGRST_JWT_SECRET ?? '')
  // supabase-js parla a `/rest/v1` (il gateway di Supabase); PostgREST da solo sta alla radice.
  const db = createClient('http://supabase.prova', jwt, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (u, o) => fetch(String(u).replace('http://supabase.prova/rest/v1', base), o) },
  })
  motori.push(['supabase', () => m.creaSegreteriaSupabase(db)])
} else {
  console.log('(senza PGRST_URL solo il motore di prova: vedi scripts/segreteria-comune/avvia.sh)')
}

for (const [nome, crea] of motori) {
  console.log(`\n— motore ${nome}`)
  for (const [cosa, caso] of Object.entries(casi)) {
    console.log(`\n${cosa}`)
    try {
      await caso(crea())
    } catch (e) {
      ok('nessun errore', e.message, undefined)
    }
  }
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
