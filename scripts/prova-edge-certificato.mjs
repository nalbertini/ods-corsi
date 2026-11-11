// ---------------------------------------------------------------------------
// La Edge Function `certificato` (il certificato dal link, senza password),
// senza Deno e senza rete.
//
//   node scripts/prova-edge-certificato.mjs
//
// Come `prova-edge.mjs`: si impacchetta il vero `index.ts` con esbuild;
// `Deno`, il client Supabase e lo Storage sono finti, e si guarda cosa chiama
// la funzione e cosa risponde. Le regole in SQL le prova
// `supabase/prova/certificato-link.sql`; qui: la firma del link (HMAC, in
// tempo costante), che il database non si chiami per un link storto, che
// `persona_id` non esca mai, i limiti del file, il tetto di 10 richieste al
// minuto, il file caricato che si toglie se il database dice di no, la
// richiesta della segreteria col suo JWT, e che nei log non finisca niente.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { createHmac } from 'node:crypto'
import { inspect } from 'node:util'

let guai = 0
const dire = (s) => process.stdout.write(s + '\n')
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  dire(`${va ? '  ✓' : '  ✗'} ${cosa}${va ? '' : ` — atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`}`)
  if (!va) guai++
}

// --- i finti ----------------------------------------------------------------
const SERVIZIO = 'chiave-di-servizio'
const SEGRETO = 'segreto-di-prova'
const PERSONA = '5e5e5e5e-1111-4222-8333-444444444444'
const LINK_ID = '0b5f2c7e-3a41-4f6e-9d1c-7a8e5b2c9f10'
const NOME = 'Marco'
const firma = (id, segreto = SEGRETO) => createHmac('sha256', segreto).update(id).digest('base64url')
const CODICE = `${LINK_ID}.${firma(LINK_ID)}`

let chiamate // [{ chi: 'admin' | 'lui', nome, args, sessione }]
let risposteDb // 'admin:nome' | 'lui:nome' → (args) => { data, error }
let storage // [{ azione: 'upload' | 'remove', bucket, percorso, tipo }]
let esitoUpload
let log // tutto quello che la funzione scrive con console.*
const riga = { persona_id: PERSONA, stato: 'valido', nome: NOME, iniziale: 'R', tipo: 'normale', entro: '2026-12-12' }

globalThis.__finto = {
  createClient(_url, chiave, opzioni) {
    const chi = chiave === SERVIZIO ? 'admin' : 'lui'
    return {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
      rpc: async (nome, args) => {
        chiamate.push({ chi, nome, args, sessione: opzioni?.global?.headers?.Authorization })
        const f = risposteDb[`${chi}:${nome}`]
        return f ? f(args) : { data: null, error: null }
      },
      storage: {
        from: (bucket) => ({
          upload: async (percorso, _corpo, o) => {
            storage.push({ azione: 'upload', chi, bucket, percorso, tipo: o?.contentType })
            return esitoUpload(percorso)
          },
          remove: async (percorsi) => {
            for (const percorso of percorsi) storage.push({ azione: 'remove', chi, bucket, percorso })
            return { data: [], error: null }
          },
        }),
      },
    }
  },
}
const testo = (a) => a.map((x) => (typeof x === 'string' ? x : inspect(x))).join(' ')
for (const k of ['log', 'info', 'warn', 'error', 'debug']) console[k] = (...a) => log.push(testo(a))

const impacchetta = (file) =>
  build({
    entryPoints: [file],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'finti',
        setup(b) {
          b.onResolve({ filter: /^npm:@supabase\/supabase-js/ }, () => ({ path: 'supabase', namespace: 'finto' }))
          b.onLoad({ filter: /^supabase$/, namespace: 'finto' }, () => ({ contents: 'export const createClient = (...a) => globalThis.__finto.createClient(...a)' }))
        },
      },
    ],
  }).then((r) => r.outputFiles[0].text)
let contatore = 0
const ENV = { SUPABASE_URL: 'https://prova.supabase.co', SUPABASE_ANON_KEY: 'chiave-anon', SUPABASE_SERVICE_ROLE_KEY: SERVIZIO, LINK_SEGRETO: SEGRETO }
const carica = async (testoFunzione, env = ENV) => {
  let gestore
  const deno = { env: { get: (k) => env[k] }, serve: (g) => (gestore = g) }
  globalThis.Deno = deno
  await import('data:text/javascript;base64,' + Buffer.from(`${testoFunzione}\n//${++contatore}`).toString('base64'))
  return (req) => {
    globalThis.Deno = deno
    return gestore(req)
  }
}
const riparti = () => {
  chiamate = []
  storage = []
  log = []
  esitoUpload = () => ({ data: {}, error: null })
  risposteDb = {
    'admin:link_certificato_apri': () => ({ data: [riga], error: null }),
    'admin:link_manda_certificato': () => ({ data: null, error: null }),
    'lui:link_certificato_per': () => ({ data: LINK_ID, error: null }),
  }
}
let g
const rpc = (nome) => chiamate.filter((c) => c.nome === nome)

// Un'istanza nuova a ogni caso: il tetto di 10 richieste al minuto è per istanza e per link, e tutti i casi scrivono dallo stesso link.
const ripartiG = async () => {
  riparti()
  g = await carica(testoFunzione)
}
const URL_F = 'https://x/functions/v1/certificato'
const leggi = async (r) => ({ stato: r.status, corpo: await r.json().catch(() => null), testo: '' })
const prendi = async (g, codice) => leggi(await g(new Request(`${URL_F}${codice === undefined ? '' : `?l=${encodeURIComponent(codice)}`}`)))
const modulo = ({ l = CODICE, scade = '2027-03-01', file = new File(['x'.repeat(100)], 'cert.pdf', { type: 'application/pdf' }) } = {}) => {
  const f = new FormData()
  if (l !== null) f.set('l', l)
  if (scade !== null) f.set('scade', scade)
  if (file) f.set('file', file)
  return f
}
const manda = async (g, campi) => leggi(await g(new Request(URL_F, { method: 'POST', body: modulo(campi) })))
const dellaSegreteria = async (g, corpo, token = 'jwt-segreteria') =>
  leggi(await g(new Request(URL_F, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(corpo) })))
const testoDi = (x) => JSON.stringify(x)
const messaggio = (c) => Object.values(c ?? {}).find((v) => typeof v === 'string' && v.length > 0)

// ===========================================================================
dire('\n0. la funzione c\'è')
let testoFunzione
try {
  testoFunzione = await impacchetta('supabase/functions/certificato/index.ts')
  g = await carica(testoFunzione)
  dire('  ✓ supabase/functions/certificato/index.ts si impacchetta')
} catch (e) {
  dire(`  ✗ manca supabase/functions/certificato/index.ts — ${(e.errors?.[0]?.text ?? e.message).split('\n')[0]}`)
  dire('\n1 cosa non torna')
  process.exit(1)
}

// ===========================================================================
dire('\n1. GET: apre il link e non dice chi è')
{
  await ripartiG()
  const r = await prendi(g, CODICE)
  const apri = rpc('link_certificato_apri')
  ok('chiama link_certificato_apri una volta, con la chiave di servizio e l\'id del link', [apri.length, apri[0]?.chi, apri[0]?.args], [1, 'admin', { link: LINK_ID }])
  ok('risponde con stato, nome, iniziale, tipo e termine', [r.stato, r.corpo], [200, { stato: 'valido', nome: NOME, iniziale: 'R', tipo: 'normale', entro: '2026-12-12' }])
  ok('mai persona_id, né nel corpo né altrove', [JSON.stringify(r.corpo).includes(PERSONA), JSON.stringify(r.corpo).includes('persona_id')], [false, false])

  await ripartiG()
  risposteDb['admin:link_certificato_apri'] = () => ({ data: [{ persona_id: null, stato: 'non_vale', nome: null, iniziale: null, tipo: null, entro: null }], error: null })
  ok('il database dice non_vale: { stato: non_vale }', (await prendi(g, CODICE)).corpo, { stato: 'non_vale' })
  await ripartiG()
  risposteDb['admin:link_certificato_apri'] = () => ({ data: [{ ...riga, stato: 'arrivato', tipo: null, entro: null }], error: null })
  const a = await prendi(g, CODICE)
  ok('già arrivato: lo stato e il nome, mai persona_id', [a.corpo?.stato, a.corpo?.nome, JSON.stringify(a.corpo).includes(PERSONA)], ['arrivato', NOME, false])
}

// ===========================================================================
dire('\n2. GET: un codice storto non arriva al database')
{
  const storti = {
    'firma sbagliata (stessa lunghezza)': `${LINK_ID}.${firma(LINK_ID).slice(0, 42)}${firma(LINK_ID).endsWith('A') ? 'B' : 'A'}`,
    'firma di un altro segreto': `${LINK_ID}.${firma(LINK_ID, 'altro-segreto')}`,
    'la firma di un altro link': `${LINK_ID}.${firma('1b5f2c7e-3a41-4f6e-9d1c-7a8e5b2c9f10')}`,
    'senza la firma': LINK_ID,
    'firma vuota': `${LINK_ID}.`,
    'senza l\'id': `.${firma(LINK_ID)}`,
    'non un uuid': `abc.${firma('abc')}`,
    'una firma corta': `${LINK_ID}.abc`,
    'un punto in più': `${CODICE}.x`,
    'spazzatura': '%00; drop table link_certificato',
    'vuoto': '',
  }
  for (const [cosa, codice] of Object.entries(storti)) {
    await ripartiG()
    const r = await prendi(g, codice)
    ok(`${cosa}: non_vale, e il database non si chiama`, [r.corpo, chiamate.length], [{ stato: 'non_vale' }, 0])
  }
  await ripartiG()
  ok('senza ?l=: non_vale, e il database non si chiama', [(await prendi(g, undefined)).corpo, chiamate.length], [{ stato: 'non_vale' }, 0])
}

// ===========================================================================
dire('\n3. POST con il file: i limiti, prima di caricare')
{
  await ripartiG()
  const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.pdf', { type: 'application/pdf' })
  const r = await manda(g, { file: grande })
  ok('un file di oltre 5 MB: 400, col testo per chi carica, e niente upload', [r.stato, typeof messaggio(r.corpo), storage.length, rpc('link_manda_certificato').length], [400, 'string', 0, 0])
  await ripartiG()
  const r2 = await manda(g, { file: new File(['x'], 'cert.txt', { type: 'text/plain' }) })
  ok('un tipo sbagliato (text/plain): 400, niente upload', [r2.stato, typeof messaggio(r2.corpo), storage.length, rpc('link_manda_certificato').length], [400, 'string', 0, 0])
  await ripartiG()
  const r3 = await manda(g, { file: new File(['x'], 'cert.gif', { type: 'image/gif' }) })
  ok('un\'immagine che non è jpg né png: 400, niente upload', [r3.stato, storage.length], [400, 0])
  await ripartiG()
  const r4 = await manda(g, { file: new File([], 'vuoto.pdf', { type: 'application/pdf' }) })
  ok('un file vuoto: 400, niente upload', [r4.stato, storage.length, rpc('link_manda_certificato').length], [400, 0, 0])
  await ripartiG()
  const r5 = await manda(g, { file: null })
  ok('senza file: 400, niente upload', [r5.stato, storage.length], [400, 0])
  for (const jpg of [true, false]) {
    await ripartiG()
    const r6 = await manda(g, { file: new File(['x'], 'a.jpg', { type: jpg ? 'image/jpeg' : 'image/png' }) })
    ok(`un ${jpg ? 'jpeg' : 'png'} piccolo passa`, [r6.stato, storage.length], [200, 1])
  }
}

// ===========================================================================
dire('\n4. POST: il link deve valere')
{
  for (const stato of ['non_vale', 'arrivato']) {
    await ripartiG()
    risposteDb['admin:link_certificato_apri'] = () => ({ data: [{ ...riga, stato }], error: null })
    const r = await manda(g)
    ok(`stato ${stato}: 410 con { stato }, niente upload, niente link_manda`, [r.stato, r.corpo?.stato, storage.length, rpc('link_manda_certificato').length], [410, stato, 0, 0])
  }
  await ripartiG()
  const r = await manda(g, { l: `${LINK_ID}.${firma(LINK_ID, 'altro')}` })
  ok('con la firma sbagliata: nessuna chiamata al database, nessun upload', [chiamate.length, storage.length, r.stato >= 400], [0, 0, true])
  await ripartiG()
  const r2 = await manda(g, { l: null })
  ok('senza link: nessuna chiamata al database, nessun upload', [chiamate.length, storage.length, r2.stato >= 400], [0, 0, true])
}

// ===========================================================================
dire('\n5. POST buono: il file in attesa e la data')
{
  await ripartiG()
  const r = await manda(g, { scade: '2027-03-01' })
  ok('risponde { ok: true }', [r.stato, r.corpo], [200, { ok: true }])
  const su = storage.find((s) => s.azione === 'upload')
  ok('upload con la chiave di servizio, nel bucket certificati', [su?.chi, su?.bucket], ['admin', 'certificati'])
  ok('il nome è <persona>/attesa-<ms>.pdf', new RegExp(`^${PERSONA}/attesa-[0-9]+\\.pdf$`).test(su?.percorso ?? ''), true)
  ok('il tipo del file passa allo storage', su?.tipo, 'application/pdf')
  const m = rpc('link_manda_certificato')
  ok('link_manda_certificato col link, il file caricato e la data', [m.length, m[0]?.chi, m[0]?.args], [1, 'admin', { link: LINK_ID, file: su?.percorso, scade: '2027-03-01' }])
  ok('l\'upload viene prima di link_manda, e dopo link_certificato_apri', chiamate.map((c) => c.nome), ['link_certificato_apri', 'link_manda_certificato'])
  ok('niente è stato tolto', storage.filter((s) => s.azione === 'remove').length, 0)

  for (const [tipo, estensione] of [['image/jpeg', 'jpg'], ['image/png', 'png']]) {
    await ripartiG()
    await manda(g, { file: new File(['x'], 'foto', { type: tipo }) })
    ok(`${tipo}: l'estensione è .${estensione}`, new RegExp(`^${PERSONA}/attesa-[0-9]+\\.${estensione}$`).test(storage[0]?.percorso ?? ''), true)
  }
  await ripartiG()
  await manda(g, { file: new File(['x'], 'evil.png', { type: 'application/pdf' }) })
  ok('l\'estensione viene dal tipo, non dal nome che manda chi carica', /\.pdf$/.test(storage[0]?.percorso ?? ''), true)
}

// ===========================================================================
dire('\n6. POST: se link_manda_certificato dice di no, il file caricato si toglie')
{
  const casi = [
    ['22023', 'Questo certificato è già scaduto: serve quello nuovo.', true],
    ['42501', 'Questo link non vale più', true],
    ['XX000', `boom interno ${PERSONA} ${NOME}`, false],
  ]
  for (const [codice, messaggioDb, passa] of casi) {
    await ripartiG()
    risposteDb['admin:link_manda_certificato'] = () => ({ data: null, error: { code: codice, message: messaggioDb } })
    const r = await manda(g)
    const su = storage.find((s) => s.azione === 'upload')
    const via = storage.filter((s) => s.azione === 'remove')
    ok(`${codice}: il file appena caricato si toglie, e solo quello`, [via.length, via[0]?.percorso === su?.percorso, via[0]?.bucket], [1, true, 'certificati'])
    ok(`${codice}: non è un 200`, r.stato >= 400, true)
    if (passa) ok(`${codice}: chi carica legge il testo del database`, testoDi(r.corpo).includes(messaggioDb), true)
    else ok(`${codice}: chi carica legge «Non è partito: riprova fra poco», non il testo grezzo`, [testoDi(r.corpo).includes('Non è partito: riprova fra poco'), testoDi(r.corpo).includes('boom'), testoDi(r.corpo).includes(PERSONA)], [true, false, false])
  }
  await ripartiG()
  esitoUpload = () => ({ data: null, error: { message: `storage giù per ${PERSONA}` } })
  const r = await manda(g)
  ok('lo storage non risponde: nessun link_manda, risposta con il testo per chi carica e non quello grezzo', [rpc('link_manda_certificato').length, r.stato >= 400, testoDi(r.corpo).includes('storage giù')], [0, true, false])
}

// ===========================================================================
dire('\n7. POST: al più 10 richieste al minuto per link')
{
  const veroNow = Date.now
  let T = 1_800_000_000_000
  Date.now = () => T
  try {
    await ripartiG()
    const g2 = await carica(testoFunzione)
    const stati = []
    for (let i = 0; i < 10; i++) stati.push((await manda(g2)).stato)
    ok('le prime 10 passano', stati, Array(10).fill(200))
    const undicesima = await manda(g2)
    ok('l\'undicesima: 429, col testo per chi carica', [undicesima.stato, typeof messaggio(undicesima.corpo)], [429, 'string'])
    ok('e non arriva al database: 10 aperture, 10 invii, 10 upload', [rpc('link_certificato_apri').length, rpc('link_manda_certificato').length, storage.filter((s) => s.azione === 'upload').length], [10, 10, 10])
    const altro = '9b5f2c7e-3a41-4f6e-9d1c-7a8e5b2c9f10'
    ok('un altro link non è limitato', (await manda(g2, { l: `${altro}.${firma(altro)}` })).stato, 200)
    T += 61_000
    ok('un minuto dopo, lo stesso link passa di nuovo', (await manda(g2)).stato, 200)
    const g3 = await carica(testoFunzione)
    await ripartiG()
    for (let i = 0; i < 10; i++) await g3(new Request(`${URL_F}?l=${CODICE}`))
    ok('i GET non contano nel tetto (10 GET, poi un POST passa)', (await manda(g3)).stato, 200)
  } finally {
    Date.now = veroNow
  }
}

// ===========================================================================
dire('\n8. POST JSON della segreteria: il codice del link')
{
  await ripartiG()
  const r = await dellaSegreteria(g, { persona: PERSONA }, '')
  ok('senza Authorization: 401, e il database non si chiama', [r.stato, chiamate.length], [401, 0])

  await ripartiG()
  const ok1 = await dellaSegreteria(g, { persona: PERSONA }, 'jwt-segreteria')
  const per = rpc('link_certificato_per')
  ok('chiama link_certificato_per col client di chi chiama, con il suo JWT, e solo con la persona', [per.length, per[0]?.chi, per[0]?.sessione, per[0]?.args], [1, 'lui', 'Bearer jwt-segreteria', { persona: PERSONA }])
  ok('nessuna chiamata con la chiave di servizio', chiamate.filter((c) => c.chi === 'admin').length, 0)
  ok('rende { codice, id }: il codice è <id>.<firma>', [ok1.stato, ok1.corpo], [200, { codice: CODICE, id: LINK_ID }])
  ok('la firma si verifica con il segreto', ok1.corpo?.codice === `${LINK_ID}.${createHmac('sha256', SEGRETO).update(LINK_ID).digest('base64url')}` && (ok1.corpo?.codice.split('.')[1] ?? '').length === 43, true)

  await ripartiG()
  risposteDb['lui:link_certificato_per'] = () => ({ data: null, error: { code: '42501', message: 'solo la segreteria' } })
  ok('non è la segreteria (42501): 403', (await dellaSegreteria(g, { persona: PERSONA })).stato, 403)
  await ripartiG()
  risposteDb['lui:link_certificato_per'] = () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
  const mancante = await dellaSegreteria(g, { persona: PERSONA })
  ok('la funzione non c\'è (PGRST202): 501 «va lanciato 142-certificato-link.sql»', [mancante.stato, testoDi(mancante.corpo).includes('142-certificato-link.sql')], [501, true])
  await ripartiG()
  const senzaPersona = await dellaSegreteria(g, {})
  ok('senza persona: 4xx, il database non si chiama', [senzaPersona.stato >= 400 && senzaPersona.stato < 500, chiamate.length], [true, 0])
  await ripartiG()
  const storta = await dellaSegreteria(g, { persona: 'x; drop' })
  ok('una persona che non è un uuid: 4xx, il database non si chiama', [storta.stato >= 400 && storta.stato < 500, chiamate.length], [true, 0])
}

// ===========================================================================
dire('\n9. nei log non finisce mai l\'id della persona, un nome o il codice del link')
{
  // Ogni guasto ha dentro l'id, il nome e il codice: un log che stampa l'errore grezzo li lascia vedere.
  const raccolto = []
  const scenari = [
    ['admin:link_manda_certificato', manda],
    ['admin:link_certificato_apri', async (x) => (await prendi(x, CODICE), manda(x))],
    ['lui:link_certificato_per', (x) => dellaSegreteria(x, { persona: PERSONA })],
    ['upload', manda],
  ]
  for (const [dove, esegui] of scenari) {
    await ripartiG()
    const guasto = { data: null, error: { code: 'XX000', message: `guasto per ${PERSONA} (${NOME}) link ${CODICE}` } }
    if (dove === 'upload') esitoUpload = () => guasto
    else risposteDb[dove] = () => guasto
    await esegui(g)
    raccolto.push(...log)
  }
  await ripartiG()
  await manda(g)
  await prendi(g, CODICE)
  await dellaSegreteria(g, { persona: PERSONA })
  raccolto.push(...log)
  ok('niente id di persona', raccolto.filter((l) => l.includes(PERSONA)), [])
  ok('niente nome', raccolto.filter((l) => l.includes(NOME)), [])
  ok('niente codice del link, né il suo id, né la firma', raccolto.filter((l) => l.includes(LINK_ID) || l.includes(firma(LINK_ID))), [])
}

if (guai) {
  dire(`\n${guai} cose non tornano`)
  process.exit(1)
}
dire('\nTutto a posto')
