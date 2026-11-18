// ---------------------------------------------------------------------------
// Il testo grezzo delle API non arriva mai a video: src/lib/guaio.ts lo
// traduce in una frase per chi legge (personale, tablet, iscritto, pubblico).
//
//   node scripts/prova-guaio.mjs
//
// I messaggi scritti da noi (SQL ed Edge Functions) passano identici; il resto
// diventa una frase italiana e il grezzo va solo in console.error.
// ---------------------------------------------------------------------------
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

if (!existsSync('src/lib/guaio.ts')) {
  console.log('  ✗ manca src/lib/guaio.ts: il modulo non esiste ancora')
  process.exit(1)
}

const { outputFiles } = await build({
  stdin: {
    contents: "export { fraseGuaio, RIPIEGO } from './src/lib/guaio.ts'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const { fraseGuaio, RIPIEGO } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

// Il grezzo va in console.error: qui lo si raccoglie, senza sporcare l'uscita.
const errori = []
const consoleError = console.error
console.error = (...a) => errori.push(a)
const frase = (e, per, ripiego) => fraseGuaio(e, { per, ripiego })

const LETTORI = ['personale', 'tablet', 'iscritto', 'pubblico']
const SEGRETERIA = '346 329 2786'

// Una riga per criterio: i quattro lettori con la frase di ciascuno
// (una stringa sola vale per tutti).
const perTutti = (cosa, e, voluto) => {
  for (const per of LETTORI) {
    const v = typeof voluto === 'string' ? voluto : voluto[per]
    ok(`${cosa} (${per})`, frase(e, per), v)
  }
}

// Valori di default
ok('RIPIEGO è la frase di riserva approvata', RIPIEGO, 'Non è andata: riprova fra poco')
ok('senza opzioni il lettore è il personale', fraseGuaio({ code: '42501', message: 'permission denied for table persone' }), 'Non hai il permesso di farlo. Esci e rientra; se ricapita, avvisa chi cura l\'app')

// 1. Messaggi della palestra: identici
for (const e of [
  { code: 'P0001', message: 'Il corso è pieno' },
  { code: '42501', message: 'Non hai il permesso di vedere questi dati' },
  { code: '22023', message: 'Il PIN non è giusto' },
  { code: 'P0002', message: 'La persona non c\'è più', details: null, hint: null },
  { code: '54000', message: 'Il file è troppo grande: al massimo 5 MB' },
  { code: '23505', message: 'Questa email è già usata da un\'altra persona' },
  new Error('Il certificato è scaduto'),
  'Il certificato è scaduto',
]) {
  const testo = typeof e === 'string' ? e : e.message
  perTutti(`un messaggio nostro passa identico: «${testo}»${e.code ? ' ' + e.code : ''}`, e, testo)
}
ok('un messaggio nostro non finisce in console.error', errori.length, 0)

// 1 (bis). Precedenza: stesso codice 42501, testo nostro passa, testo inglese si traduce
ok('42501 con testo nostro passa', frase({ code: '42501', message: 'Non puoi vedere le note' }, 'tablet'), 'Non puoi vedere le note')
ok('42501 con testo inglese si traduce', frase({ code: '42501', message: 'permission denied for table note' }, 'tablet'), 'Il tablet non può farlo: chiedi alla segreteria')

// 1 (ter). I testi veri, estratti dai file SQL e dalle Edge Functions
const file = (dir, ok_) => {
  const fuori = []
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) fuori.push(...file(p, ok_))
    else if (ok_(nome)) fuori.push(p)
  }
  return fuori
}
const veri = new Set()
for (const nome of readdirSync('supabase').filter((n) => n.endsWith('.sql'))) {
  const sql = readFileSync(join('supabase', nome), 'utf8')
  for (const m of sql.matchAll(/raise\s+exception\s+'((?:[^']|'')*)'(\s*\|\|)?/gi)) {
    if (m[2] || m[1].includes('%')) continue
    veri.add(m[1].replace(/''/g, "'"))
  }
}
for (const p of file('supabase/functions', (n) => /\.ts$/.test(n))) {
  const ts = readFileSync(p, 'utf8')
  for (const m of ts.matchAll(/(?:guaio:\s*|\bno\(\s*)'((?:[^'\\\n]|\\.)*)'(?!\s*\+)/g)) {
    if (m[1].includes('%') || m[1].includes('${')) continue
    veri.add(m[1].replace(/\\'/g, "'"))
  }
}
const nonPassano = []
for (const testo of [...veri].filter((t) => t.trim())) {
  if (!LETTORI.every((per) => frase(testo, per) === testo)) nonPassano.push(testo)
}
ok(`i ${veri.size} testi veri di SQL ed Edge Functions passano identici per tutti e 4 i lettori`, nonPassano, [])
ok('ci sono davvero testi veri da provare', veri.size > 100, true)

// 2. Rete
const RETE = {
  personale: 'Non si collega: controlla la connessione e riprova',
  iscritto: 'Non si collega: controlla la connessione e riprova',
  pubblico: 'Non si collega: controlla la connessione e riprova',
  tablet: 'Non si collega: controlla il Wi-Fi. Quello che hai segnato resta in attesa e si salva quando torna la rete, se non ricarichi la pagina',
}
perTutti('rete: TypeError Failed to fetch', new TypeError('Failed to fetch'), RETE)
perTutti('rete: Load failed (Safari)', new TypeError('Load failed'), RETE)
perTutti('rete: NetworkError (Firefox)', new TypeError('NetworkError when attempting to fetch resource.'), RETE)
perTutti('rete: FunctionsFetchError', { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' }, RETE)

// 3. Sessione scaduta
const SESSIONE = {
  personale: 'Accedi di nuovo a ODS Corsi',
  tablet: 'Il tablet va riaperto: chiedi alla segreteria di rientrare. Non ricaricare la pagina finché non è fatto',
  iscritto: "Accedi di nuovo all'area iscritti",
  pubblico: 'Non è andata: ricarica la pagina e riprova',
}
perTutti('sessione: JWT expired', { code: 'PGRST301', message: 'JWT expired' }, SESSIONE)
perTutti('sessione: solo il testo JWT expired', new Error('JWT expired'), SESSIONE)
perTutti('sessione: PGRST301 senza testo', { code: 'PGRST301', message: 'No suitable key or wrong key type' }, SESSIONE)
perTutti('sessione: refresh_token_not_found', { name: 'AuthApiError', status: 400, code: 'refresh_token_not_found', message: 'Invalid Refresh Token: Refresh Token Not Found' }, SESSIONE)
perTutti('sessione: session_not_found', { name: 'AuthApiError', status: 403, code: 'session_not_found', message: 'Session from session_id claim in JWT does not exist' }, SESSIONE)
perTutti('sessione: 401 con JWT', { status: 401, message: 'Invalid JWT' }, SESSIONE)

// 4. Permesso negato grezzo
const PERMESSO = {
  personale: "Non hai il permesso di farlo. Esci e rientra; se ricapita, avvisa chi cura l'app",
  tablet: 'Il tablet non può farlo: chiedi alla segreteria',
  iscritto: `Da qui non si può fare: se ti serve, chiama la segreteria al ${SEGRETERIA}`,
  pubblico: `Non è andata: chiama la segreteria al ${SEGRETERIA}, ti aiutiamo noi`,
}
perTutti('permesso: permission denied for table', { code: '42501', message: 'permission denied for table persone' }, PERMESSO)
perTutti('permesso: riga contro la policy', { code: '42501', message: 'new row violates row-level security policy for table "x"' }, PERMESSO)
perTutti('permesso: funzione', { code: '42501', message: 'permission denied for function y' }, PERMESSO)
perTutti('permesso: solo il testo, senza codice', new Error('permission denied for table persone'), PERMESSO)

// 5. Doppione
const DOPPIONE = {
  personale: "C'è già: per esempio un'email già usata o un corso già assegnato. Cerca prima di aggiungere",
  iscritto: `Non riesco a completare l'iscrizione: chiama la segreteria al ${SEGRETERIA}, ti aiutiamo noi`,
  pubblico: `Non riesco a completare l'iscrizione: chiama la segreteria al ${SEGRETERIA}, ti aiutiamo noi`,
  tablet: RIPIEGO,
}
perTutti('doppione: 23505', { code: '23505', message: 'duplicate key value violates unique constraint "persone_email_key"', details: 'Key (email)=(a@b.it) already exists.' }, DOPPIONE)
perTutti('doppione: solo il testo', new Error('duplicate key value violates unique constraint "x"'), DOPPIONE)

// 6. Collegato
const COLLEGATO = {
  personale: 'Non si può togliere: è ancora collegato ad altro, per esempio iscritti o pagamenti. Togli prima quelli',
  tablet: RIPIEGO,
  iscritto: RIPIEGO,
  pubblico: RIPIEGO,
}
perTutti('collegato: 23503', { code: '23503', message: 'update or delete on table "corsi" violates foreign key constraint "iscrizioni_corso_fkey" on table "iscrizioni"' }, COLLEGATO)
perTutti('collegato: solo il testo', new Error('update or delete on table "persone" violates foreign key constraint "x" on table "y"'), COLLEGATO)

// 7. Database non aggiornato
const NON_ATTIVA = {
  personale: 'Questa funzione non è ancora attiva: avvisa chi cura l\'app',
  tablet: 'Questa parte del tablet non è ancora attiva: avvisa la segreteria',
  iscritto: "L'area degli iscritti non è ancora attiva: chiedi alla segreteria",
  pubblico: `Il modulo non è disponibile in questo momento: chiama la segreteria al ${SEGRETERIA}`,
}
perTutti('non aggiornato: PGRST202', { code: 'PGRST202', message: 'Could not find the function public.x(a, b) in the schema cache', hint: 'Perhaps you meant to call the function public.y' }, NON_ATTIVA)
perTutti('non aggiornato: PGRST205', { code: 'PGRST205', message: "Could not find the table 'public.x' in the schema cache" }, NON_ATTIVA)
perTutti('non aggiornato: 42P01', { code: '42P01', message: 'relation "public.x" does not exist' }, NON_ATTIVA)
perTutti('non aggiornato: 42703', { code: '42703', message: 'column x does not exist' }, NON_ATTIVA)
perTutti('non aggiornato: PGRST204', { code: 'PGRST204', message: "Could not find the 'x' column of 'y' in the schema cache" }, NON_ATTIVA)

// 8. File
const TROPPO_GRANDE = 'Il file è troppo grande: al massimo 10 MB'
const TIPO = 'Questo tipo di file non va: serve una foto o un PDF'
perTutti('file: Storage 413 numerico', { statusCode: 413, error: 'Payload too large', message: 'The object exceeded the maximum allowed size' }, TROPPO_GRANDE)
perTutti('file: Storage 413 come stringa', { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' }, TROPPO_GRANDE)
perTutti('file: solo Payload too large', new Error('Payload too large'), TROPPO_GRANDE)
perTutti('file: solo exceeded the maximum allowed size', new Error('The object exceeded the maximum allowed size'), TROPPO_GRANDE)
perTutti('file: tipo non ammesso', { statusCode: '415', error: 'invalid_mime_type', message: 'mime type image/heic is not supported' }, TIPO)
perTutti('file: invalid_mime_type', new Error('invalid_mime_type'), TIPO)

// 9. Troppi tentativi
const TROPPI = 'Troppi tentativi di fila: aspetta qualche minuto e riprova'
perTutti('tentativi: status 429', { name: 'AuthApiError', status: 429, message: 'x' }, TROPPI)
perTutti('tentativi: Too Many Requests', new Error('Too Many Requests'), TROPPI)
perTutti('tentativi: email rate limit exceeded', { name: 'AuthApiError', status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, TROPPI)
perTutti('tentativi: over_email_send_rate_limit senza status', { code: 'over_email_send_rate_limit', message: 'x' }, TROPPI)

// 10. Sconosciuto: il ripiego, e il grezzo solo in console.error
for (const [nome, e] of [
  ['Edge Function non-2xx', new Error('Edge Function returned a non-2xx status code')],
  ['errore di programma', new TypeError("Cannot read properties of undefined (reading 'x')")],
  ['boom', new Error('boom')],
  ['stringa boom', 'boom'],
  ['null', null],
  ['undefined', undefined],
  ['oggetto vuoto', {}],
]) {
  for (const per of LETTORI) ok(`sconosciuto: ${nome} dà il ripiego (${per})`, frase(e, per), RIPIEGO)
  ok(`sconosciuto: ${nome} dà il ripiego passato`, frase(e, 'personale', 'Non si è salvato: riprova'), 'Non si è salvato: riprova')
}
errori.length = 0
const grezzo = new Error('boom')
frase(grezzo, 'personale')
ok('sconosciuto: console.error riceve il grezzo', errori.length === 1 && errori[0].includes(grezzo), true)
errori.length = 0
frase({ code: 'XX000', message: 'internal error 7' }, 'tablet')
ok('sconosciuto: il testo di un oggetto grezzo finisce in console.error', JSON.stringify(errori).includes('internal error 7'), true)
errori.length = 0
frase('Il certificato è scaduto', 'personale')
frase({ code: '42501', message: 'permission denied for table persone' }, 'personale')
ok('un errore riconosciuto non sporca console.error', errori.length, 0)
ok('il ripiego passato vale anche per un errore riconosciuto? No: la frase è quella del caso', frase({ code: '42501', message: 'permission denied for table x' }, 'tablet', 'altro'), 'Il tablet non può farlo: chiedi alla segreteria')
ok('doppione al tablet dà il ripiego passato', frase({ code: '23505', message: 'duplicate key' }, 'tablet', 'Non si è salvato'), 'Non si è salvato')

// 11. Proprietà: dal grezzo inglese non esce nulla di grezzo
const INGLESE = [
  'JWT expired',
  'Failed to fetch',
  'Load failed',
  'permission denied for table persone',
  'new row violates row-level security policy for table "x"',
  'duplicate key value violates unique constraint "persone_email_key"',
  'update or delete on table "corsi" violates foreign key constraint "f"',
  'Could not find the function public.x(a) in the schema cache',
  'column x does not exist',
  'Edge Function returned a non-2xx status code',
  "Cannot read properties of undefined (reading 'x')",
  'Payload too large',
  'mime type image/heic is not supported',
  'email rate limit exceeded',
  'boom',
]
const VIETATE = ['JWT', 'PGRST', 'schema cache', 'violates', 'fetch']
let sporchi = []
for (const t of INGLESE) {
  for (const forma of [t, new Error(t), { message: t }, { code: '42501', message: t }, { code: 'PGRST202', message: t }]) {
    for (const per of LETTORI) {
      const f = frase(forma, per)
      if (f.includes(t) || VIETATE.some((v) => f.toLowerCase().includes(v.toLowerCase()))) sporchi.push(`${per}: ${t} → ${f}`)
    }
  }
}
ok('dal grezzo inglese non esce il testo d\'ingresso né JWT, PGRST, schema cache, violates, fetch', sporchi, [])

console.error = consoleError
if (nonPassano.length) console.log('\nTesti veri che non passano:\n' + nonPassano.map((t) => '  - ' + t).join('\n'))
if (guai) {
  console.log(`\n${guai} casi falliti`)
  process.exit(1)
}
console.log('\nTutto a posto')
