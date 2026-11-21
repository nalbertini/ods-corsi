// ---------------------------------------------------------------------------
// Il limite di frequenza della Edge Function pubblica dei pagamenti
// (`satispay`), senza Deno, senza rete e senza database.
//
//   node scripts/prova-edge-limite.mjs
//
// Chi non ha un accesso può chiamare `prepara`, `paga`, `stato`,
// `stato_pagamento` e la callback quante volte vuole, e ogni volta la funzione
// parla col database e con Satispay. Il limite sta nel database
// (`limite_frequenza`, 168-limite-frequenza.sql; le sue regole le prova
// `supabase/prova/limite-frequenza.sql`); qui c'è quello che decide la
// funzione: quando lo chiede, con che chiave, cosa risponde se è finito e che
// non blocca mai chi paga davvero (limite che non risponde = passa).
//
// Si impacchetta il vero `index.ts`; il client Supabase, `fetch` e `Deno` sono
// finti e `limite_frequenza` risponde true o false a comando.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { inspect } from 'node:util'

const dire = console.log
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  dire(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// --- i finti ----------------------------------------------------------------
const SERVIZIO = 'chiave-di-servizio'
let chiamate // [{ chi, nome, args, n }]
let risposteDb // 'admin:nome' | 'lui:nome' → (args) => { data, error }
let utenti
let rete // [{ metodo, host, percorso, corpo, n }]
let rispondeRete // (metodo, percorso) => { stato, json } | 'cade'
let log // tutto quel che le funzioni scrivono nel log, per leggerlo dopo
let n // l'ordine in cui succedono le cose, fra database e rete

globalThis.__finto = {
  createClient(_url, chiave) {
    const chi = chiave === SERVIZIO ? 'admin' : 'lui'
    return {
      auth: { getUser: async (token) => ({ data: { user: utenti[token] ?? null } }) },
      rpc: async (nome, args) => {
        chiamate.push({ chi, nome, args, n: ++n })
        const f = risposteDb[`${chi}:${nome}`]
        return f ? f(args) : { data: null, error: null }
      },
    }
  },
}
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(url)
  rete.push({ metodo: o.method, host: u.host, percorso: u.pathname, corpo: o.body && o.body.startsWith('{') ? JSON.parse(o.body) : null, n: ++n })
  const r = rispondeRete(o.method, u.pathname)
  if (r === 'cade') throw new Error('rete giù')
  return { ok: r.stato < 400, status: r.stato, json: async () => r.json, text: async () => JSON.stringify(r.json) }
}
// Come il log di Deno: un oggetto si legge per intero, non «[object Object]».
for (const k of ['log', 'error', 'warn', 'info', 'debug']) {
  console[k] = (...a) => log.push(a.map((x) => (typeof x === 'string' ? x : inspect(x, { depth: 6 }))).join(' '))
}

// --- caricare la funzione col suo ambiente -----------------------------------
const impacchetta = async (file) => {
  const { outputFiles } = await build({
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
  })
  return outputFiles[0].text
}
let contatore = 0
const carica = async (testo, env) => {
  let gestore
  const deno = { env: { get: (k) => env[k] }, serve: (g) => (gestore = g) }
  globalThis.Deno = deno
  await import('data:text/javascript;base64,' + Buffer.from(`${testo}\n//${++contatore}`).toString('base64'))
  return (req) => {
    globalThis.Deno = deno
    return gestore(req)
  }
}

const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const P = 'cccccccc-0000-4000-8000-000000000003'
const NON_RISPONDE = 'Satispay non risponde: riprova fra qualche minuto'
const TROPPE = 'Troppe richieste: riprova fra qualche minuto'
const IP1 = '203.0.113.77'
const IP2 = '198.51.100.9'
const IP6 = '2001:db8::1a2b'
const ENV_S = {
  SUPABASE_URL: 'https://prova.supabase.co',
  SUPABASE_ANON_KEY: 'chiave-anon',
  SUPABASE_SERVICE_ROLE_KEY: SERVIZIO,
  SATISPAY_KEY_ID: 'kid',
  SATISPAY_CHIAVE: '', // si riempie sotto
  APP_URL: 'https://app.esempio.it/iscrizioni/',
  LIMITE_SEGRETO: 'segreto-di-prova',
}
const { generateKeyPairSync } = await import('node:crypto')
ENV_S.SATISPAY_CHIAVE = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' })

const retePagamenti = (metodo, percorso) => {
  if (percorso.startsWith('/g_business/v1/payments')) {
    return metodo === 'POST'
      ? { stato: 200, json: { id: 'sp-1', status: 'PENDING', redirect_url: 'https://satispay.it/paga/1' } }
      : { stato: 200, json: { id: 'sp-9', status: 'ACCEPTED' } }
  }
  return { stato: 404, json: {} }
}
// `limite` è quel che risponde limite_frequenza: true passa, false è finito.
const riparti = (limite = true) => {
  chiamate = []
  risposteDb = { 'admin:limite_frequenza': () => ({ data: limite, error: null }) }
  utenti = { buono: { id: 'u1' } }
  rete = []
  rispondeRete = retePagamenti
  log = []
  n = 0
}
riparti()

const chiama = async (gestore, corpo, { token = '', metodo = 'POST', url = 'https://x/functions/v1/f', ip, xff } = {}) => {
  const intestazioni = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(ip ? { 'cf-connecting-ip': ip } : {}),
    ...(xff ? { 'x-forwarded-for': xff } : {}),
  }
  const r = await gestore(new Request(url, { method: metodo, headers: intestazioni, body: metodo === 'POST' ? JSON.stringify(corpo) : undefined }))
  return { stato: r.status, corpo: await r.json(), cors: r.headers.get('Access-Control-Allow-Origin') }
}

const limiti = () => chiamate.filter((c) => c.nome === 'limite_frequenza')
// Le chiamate al database che non sono né il limite né «Satispay è spento?».
const dominio = () => chiamate.filter((c) => !['limite_frequenza', 'metodi_spenti'].includes(c.nome))
const senzaFare = () => [dominio().map((c) => c.nome), rete.length]

const SATISPAY = await impacchetta('supabase/functions/satispay/index.ts')
const sp = await carica(SATISPAY, ENV_S)

// Le due azioni per IP: il database di dominio e la rete che servono perché vadano a buon fine.
const PER_IP = [
  {
    nome: 'satispay prepara', g: sp, ambito: 'satispay:prepara', corpo: { azione: 'prepara', corso: A, formula: 'annuale', nome: 'Anna', cognome: 'Rossi', email: 'a@e.it' },
    semina: () => {
      risposteDb['admin:satispay_prepara_prima'] = () => ({ data: { stato: 'attesa', id: P, importo: 23000, satispay_id: null, link: null }, error: null })
    },
    buono: { stato: 200, corpo: { stato: 'attesa', id: P, link: 'https://satispay.it/paga/1', importo: 23000 } },
  },
  {
    nome: 'satispay paga', g: sp, ambito: 'satispay:paga', corpo: { azione: 'paga', richiesta: A },
    semina: () => {
      risposteDb['admin:satispay_prepara'] = () => ({ data: { stato: 'attesa', id: P, importo: 23000, satispay_id: null, link: null }, error: null })
    },
    buono: { stato: 200, corpo: { link: 'https://satispay.it/paga/1' } },
  },
]

// Le due che rileggono da Satispay: il limite è per id e si chiede solo quando si sta per farlo.
const PER_ID = [
  {
    nome: 'satispay stato', g: sp, ambito: 'satispay:stato', corpo: { azione: 'stato', richiesta: A },
    db: 'satispay_stato', attesa: { stato: 'attesa', importo: 23000, satispay_id: 'sp-9' }, pagato: { stato: 'pagato', importo: 23000, pagato_il: '2026-10-20T10:00:00Z', satispay_id: 'sp-9' },
    senzaProvider: { stato: 'attesa', importo: 23000 },
    letto: (c) => [c.pagamento?.stato, c.pagamento?.importo], dallaFinta: ['attesa', 23000],
    dopo: (c) => c.stato === 'pagato', provider: (r) => r.host.includes('satispay'),
  },
  {
    nome: 'satispay stato_pagamento', g: sp, ambito: 'satispay:stato_pagamento', corpo: { azione: 'stato_pagamento', pagamento: P },
    db: 'satispay_stato_pagamento', attesa: { stato: 'attesa', importo: 23000, satispay_id: 'sp-9' }, pagato: { stato: 'pagato', importo: 23000, pagato_il: '2026-10-20T10:00:00Z', satispay_id: 'sp-9' },
    senzaProvider: { stato: 'attesa', importo: 23000 },
    letto: (c) => [c.pagamento?.stato, c.pagamento?.importo], dallaFinta: ['attesa', 23000],
    provider: (r) => r.host.includes('satispay'),
  },
]
const valore = (x) => (typeof x === 'function' ? x() : x)
const dalDb = (p, dato) => {
  risposteDb[`admin:${p.db}`] = () => ({ data: valore(dato), error: null })
  risposteDb['admin:satispay_esito'] = () => ({ data: { stato: 'pagato', importo: 23000, pagato_il: '2026-10-20T10:00:00Z' }, error: null })
  risposteDb['admin:satispay_creato'] = () => ({ data: null, error: null })
}

// ===========================================================================
dire('\n1. prepara e paga: il limite per IP, all\'ingresso')
for (const a of PER_IP) {
  riparti(true)
  a.semina()
  const r = await chiama(a.g, a.corpo, { ip: IP1 })
  ok(`${a.nome}: col limite che passa va come prima`, a.buono.corpo ? { stato: r.stato, corpo: r.corpo } : { stato: r.stato }, a.buono)
  ok(`${a.nome}: il limite si chiede una volta, con l'ambito «${a.ambito}»`, limiti().map((c) => c.args.ambito), [a.ambito])
  ok(`${a.nome}: …dal server (service role)`, limiti().map((c) => c.chi), ['admin'])
  const l = limiti()[0]?.args
  ok(`${a.nome}: …con un massimo e una finestra veri, larghi per chi paga davvero`, [Number.isInteger(l?.massimo) && l.massimo >= 10, Number.isInteger(l?.secondi) && l.secondi >= 60], [true, true])
  ok(`${a.nome}: …e ha la chiave dell'IP`, typeof l?.chiave === 'string' && l.chiave.length > 0, true)

  riparti(false)
  a.semina()
  const no = await chiama(a.g, a.corpo, { ip: IP1 })
  ok(`${a.nome}: limite finito: 429 con la frase che dice cosa fare`, [no.stato, no.corpo], [429, { guaio: TROPPE }])
  ok(`${a.nome}: …si legge anche dal browser (CORS)`, no.cors, '*')
  ok(`${a.nome}: …nessuna chiamata al database di dominio e nessuna al provider`, senzaFare(), [[], 0])
  ok(`${a.nome}: …il limite si è chiesto per quell'azione`, limiti().map((c) => c.args.ambito), [a.ambito])

  // L'ordine: il limite prima di tutto quel che costa.
  riparti(true)
  a.semina()
  await chiama(a.g, a.corpo, { ip: IP1 })
  const primoCosto = Math.min(...dominio().map((c) => c.n), ...rete.map((r) => r.n))
  ok(`${a.nome}: il limite viene prima di ogni chiamata di dominio e di rete`, limiti()[0]?.n < primoCosto, true)
}

// ===========================================================================
dire('\n2. stato e stato_pagamento: in attesa e limite finito, si risponde col database')
for (const p of PER_ID) {
  riparti(false)
  dalDb(p, p.attesa)
  const r = await chiama(p.g, p.corpo, { ip: IP1 })
  ok(`${p.nome}: limite finito: 200 con lo stato del database, com'è oggi`, [r.stato, ...p.letto(r.corpo)], [200, ...p.dallaFinta])
  ok(`${p.nome}: …e non si chiama il provider`, rete.length, 0)
  ok(`${p.nome}: …il limite si è chiesto per «${p.ambito}»`, limiti().map((c) => c.args.ambito), [p.ambito])
  ok(`${p.nome}: …non è un 429: chi aspetta di sapere se ha pagato non si spaventa`, r.stato === 429, false)
  ok(`${p.nome}: …l'esito non si scrive (non si è chiesto a nessuno)`, chiamate.filter((c) => c.nome === 'satispay_esito').length, 0)

  riparti(true)
  dalDb(p, p.attesa)
  const si = await chiama(p.g, p.corpo, { ip: IP1 })
  ok(`${p.nome}: limite che passa: si rilegge dal provider, come prima`, [si.stato, rete.some(p.provider)], [200, true])
  ok(`${p.nome}: …il limite si chiede una volta, con una chiave`, [limiti().length, typeof limiti()[0]?.args.chiave === 'string' && limiti()[0].args.chiave.length > 0], [1, true])
  const l = limiti()[0]?.args
  ok(`${p.nome}: …con massimo e finestra veri`, [Number.isInteger(l?.massimo) && l.massimo >= 10, Number.isInteger(l?.secondi) && l.secondi >= 1], [true, true])
  // Si chiede subito prima di chiamare il provider, non prima di sapere se serve.
  const dbStato = chiamate.find((c) => c.nome === p.db)
  const primaRete = Math.min(...rete.map((r) => r.n))
  ok(`${p.nome}: …dopo aver letto lo stato dal database e prima del provider`, dbStato?.n < limiti()[0]?.n && limiti()[0]?.n < primaRete, true)
}

// ===========================================================================
dire('\n3. già pagato, o niente da chiedere: il limite non si tocca')
for (const p of PER_ID) {
  riparti(false)
  dalDb(p, p.pagato)
  const r = await chiama(p.g, p.corpo, { ip: IP1 })
  ok(`${p.nome}: già pagato, lo dice`, [r.stato, r.corpo.pagamento?.stato], [200, 'pagato'])
  ok(`${p.nome}: …senza chiamare limite_frequenza né il provider`, [limiti().length, rete.length], [0, 0])

  riparti(false)
  dalDb(p, p.senzaProvider)
  const s = await chiama(p.g, p.corpo, { ip: IP1 })
  ok(`${p.nome}: in attesa ma senza ordine presso il provider: niente da chiedere, niente limite`, [s.stato, limiti().length, rete.length], [200, 0, 0])

  riparti(false)
  dalDb(p, null)
  const v = await chiama(p.g, p.corpo, { ip: IP1 })
  ok(`${p.nome}: nessun pagamento: nessun limite`, [v.stato, limiti().length, rete.length], [200, 0, 0])
}

// ===========================================================================
dire('\n4. la callback di Satispay con il limite finito')
{
  const CB = (id) => ({ metodo: 'GET', url: `https://x/functions/v1/satispay?payment_id=${id}`, ip: IP1 })
  riparti(false)
  risposteDb['admin:satispay_esito'] = () => ({ data: { stato: 'pagato', importo: 100 }, error: null })
  const r = await chiama(sp, null, CB('sp-6'))
  ok('limite finito: 200 {ok:true}, Satispay non ci riprova per niente', [r.stato, r.corpo], [200, { ok: true }])
  ok('…nessuna chiamata a Satispay', rete.length, 0)
  ok('…e nessuna a satispay_esito', chiamate.filter((c) => c.nome === 'satispay_esito').length, 0)
  ok('…il limite si è chiesto per «satispay:callback»', limiti().map((c) => c.args.ambito), ['satispay:callback'])

  riparti(true)
  risposteDb['admin:satispay_esito'] = () => ({ data: { stato: 'pagato', importo: 100 }, error: null })
  const s = await chiama(sp, null, CB('sp-6'))
  ok('limite che passa: come prima, riletto da Satispay e scritto', [s.stato, rete[0]?.percorso, chiamate.filter((c) => c.nome === 'satispay_esito').length], [200, '/g_business/v1/payments/sp-6', 1])
  ok('…il limite si chiede una volta, e prima di Satispay', [limiti().length, limiti()[0]?.n < rete[0]?.n], [1, true])
  ok('…la chiave non è l\'IP e il massimo è un numero vero', [!JSON.stringify(limiti()[0]?.args ?? {}).includes(IP1), Number.isInteger(limiti()[0]?.args.massimo)], [true, true])

  riparti(false)
  const lungo = 'a'.repeat(64)
  await chiama(sp, null, CB(lungo))
  ok('un id di 64 caratteri è valido: il limite lo conta', limiti().length, 1)

  const SENZA = await carica(SATISPAY, { ...ENV_S, SATISPAY_KEY_ID: '' })
  riparti(false)
  const spento = await chiama(SENZA, null, CB('sp-6'))
  ok('senza i segreti: 200, nessun limite, nessuna rete', [spento.stato, limiti().length, rete.length], [200, 0, 0])
}

// ===========================================================================
dire('\n5. la callback con un id che non è un id')
for (const [cosa, id] of [
  ['con una barra', 'a%2Fb'],
  ['con i punti e la barra', '..%2F..%2Fetc'],
  ['con uno spazio', 'ab%20cd'],
  ['di 65 caratteri', 'a'.repeat(65)],
  ['con un apice', "x'%3B--"],
  ['con la query dentro', 'abc%3Fx%3D1'],
  ['con una lettera accentata', 'caf%C3%A8'],
]) {
  riparti(false)
  const r = await chiama(sp, null, { metodo: 'GET', url: `https://x/f?payment_id=${id}`, ip: IP1 })
  ok(`id ${cosa}: 200 {ok:true}`, [r.stato, r.corpo], [200, { ok: true }])
  ok(`…nessun limite, nessuna rete, nessuna RPC`, [limiti().length, rete.length, chiamate.length], [0, 0, 0])
}

// ===========================================================================
dire('\n6. il limite che non risponde non blocca chi paga')
const guasti = [
  ['errore dell\'RPC', () => ({ data: null, error: { code: 'XX000', message: 'boom' } })],
  ['funzione mancante (PGRST202)', () => ({ data: null, error: { code: 'PGRST202', message: 'no function' } })],
  ['RPC che non risponde (eccezione)', () => { throw new Error('rete giù') }],
  ['risposta senza dati', () => ({ data: null, error: null })],
]
for (const [guasto, f] of guasti) {
  for (const a of PER_IP) {
    riparti(true)
    a.semina()
    risposteDb['admin:limite_frequenza'] = f
    const r = await chiama(a.g, a.corpo, { ip: IP1 })
    ok(`${guasto}: ${a.nome} passa lo stesso`, [r.stato, dominio().length > 0], [200, true])
  }
  for (const p of PER_ID) {
    riparti(true)
    dalDb(p, p.attesa)
    risposteDb['admin:limite_frequenza'] = f
    const r = await chiama(p.g, p.corpo, { ip: IP1 })
    ok(`${guasto}: ${p.nome} rilegge lo stesso dal provider`, [r.stato, rete.some(p.provider)], [200, true])
  }
  riparti(true)
  risposteDb['admin:limite_frequenza'] = f
  await chiama(sp, null, { metodo: 'GET', url: 'https://x/f?payment_id=sp-6', ip: IP1 })
  ok(`${guasto}: la callback legge lo stesso Satispay`, rete.length, 1)
}
// Un limite che non risponde sparisce: almeno si deve leggere nei log, senza l'IP.
riparti(true)
PER_IP[0].semina()
risposteDb['admin:limite_frequenza'] = guasti[0][1]
await chiama(PER_IP[0].g, PER_IP[0].corpo, { ip: IP1 })
ok('il guasto del limite si legge nel log, con l\'ambito e il codice', log.some((r) => r.includes('satispay:prepara') && r.includes('XX000')), true)
ok('…e nel log non c\'è l\'IP', log.some((r) => r.includes(IP1)), false)
// Anche l'impronta dell'IP può guastarsi (crypto.subtle che lancia): la richiesta passa lo stesso.
{
  const vero = crypto.subtle.importKey
  crypto.subtle.importKey = async () => { throw new Error('crypto giù') }
  try {
    for (const a of PER_IP) {
      riparti(true)
      a.semina()
      const r = await chiama(a.g, a.corpo, { ip: IP1 })
      ok(`impronta che non si fa: ${a.nome} passa lo stesso`, [r.stato, dominio().length > 0], [200, true])
    }
  } finally {
    crypto.subtle.importKey = vero
  }
}

// ===========================================================================
dire('\n7. la chiave per IP: niente IP in chiaro, stabile, diversa tra IP')
{
  const chiave = async (g, corpo, opzioni, amb = 'prepara') => {
    riparti(true)
    risposteDb['admin:satispay_prepara_prima'] = () => ({ data: { stato: 'pagato', id: P, importo: 1 }, error: null })
    await chiama(g, corpo ?? { azione: 'prepara', corso: A, formula: 'annuale' }, opzioni)
    return limiti()[0]?.args.chiave
  }
  const k1 = await chiave(sp, null, { ip: IP1 })
  const k1bis = await chiave(sp, null, { ip: IP1 })
  const k2 = await chiave(sp, null, { ip: IP2 })
  ok('una chiave c\'è', typeof k1, 'string')
  ok('è un\'impronta esadecimale di 256 bit (HMAC-SHA256)', /^[0-9a-f]{64}$/.test(k1 ?? ''), true)
  ok('lo stesso IP dà la stessa chiave', k1bis, k1)
  ok('un altro IP ne dà un\'altra', [typeof k2, k2 !== k1], ['string', true])
  ok('l\'IP non è nella chiave', [(k1 ?? '').includes(IP1), (k1 ?? '').includes(IP1.replaceAll('.', ''))], [false, false])
  ok('non è nemmeno l\'hash semplice dell\'IP: ci vuole il segreto', [k1 === createHash('sha256').update(IP1).digest('hex'), k1 === createHash('sha1').update(IP1).digest('hex')], [false, false])

  const altro = await carica(SATISPAY, { ...ENV_S, LIMITE_SEGRETO: 'un-altro-segreto' })
  ok('con un altro segreto la chiave dello stesso IP cambia', (await chiave(altro, null, { ip: IP1 })) !== k1, true)
  const derivato = await carica(SATISPAY, { ...ENV_S, LIMITE_SEGRETO: undefined })
  const kd = await chiave(derivato, null, { ip: IP1 })
  ok('senza LIMITE_SEGRETO il limite funziona lo stesso, con un\'impronta esadecimale', /^[0-9a-f]{64}$/.test(kd ?? ''), true)
  ok('…diversa da quella col segreto, e stabile', [kd !== k1, kd === (await chiave(derivato, null, { ip: IP1 }))], [true, true])
  ok('…e anche così l\'IP non c\'è', (kd ?? '').includes(IP1), false)

  ok('IPv6: impronta esadecimale, senza l\'indirizzo', [/^[0-9a-f]{64}$/.test((await chiave(sp, null, { ip: IP6 })) ?? ''), (await chiave(sp, null, { ip: IP6 }))?.includes('db8')], [true, false])

  // Da dove si legge l'IP: solo cf-connecting-ip, che mette il proxy.
  // x-forwarded-for lo scrive chi chiama: se contasse, cambiandolo a ogni richiesta il limite per IP sparirebbe.
  ok('cf-connecting-ip vince su x-forwarded-for', await chiave(sp, null, { ip: IP1, xff: `${IP2}, 10.0.0.1` }), k1)
  ok('…anche con gli spazi attorno', await chiave(sp, null, { ip: `  ${IP1}  ` }), k1)
  ok('x-forwarded-for da solo non dà una chiave', await chiave(sp, null, { xff: `${IP1}, 10.0.0.1` }), undefined)

  // Senza un IP non c'è niente da contare: non si inventa una chiave comune a tutti (e non si blocca nessuno).
  for (const a of PER_IP) {
    riparti(false)
    a.semina()
    const r = await chiama(a.g, a.corpo, {})
    ok(`${a.nome}: senza intestazioni con l'IP non si chiama il limite`, limiti().length, 0)
    ok(`${a.nome}: …e la richiesta va avanti (non è un 429)`, [r.stato === 429, dominio().length > 0], [false, true])
  }
  riparti(false)
  PER_IP[0].semina()
  await chiama(sp, PER_IP[0].corpo, { ip: '   ' })
  ok('un cf-connecting-ip vuoto vale come nessun IP', limiti().length, 0)
}

// ===========================================================================
dire('\n8. l\'ambito dice quale azione')
{
  const visti = new Set()
  for (const a of PER_IP) {
    riparti(true)
    a.semina()
    await chiama(a.g, a.corpo, { ip: IP1 })
    for (const c of limiti()) visti.add(c.args.ambito)
    const azione = a.corpo.azione
    ok(`${a.nome}: l'ambito contiene il nome dell'azione`, limiti().every((c) => c.args.ambito.endsWith(`:${azione}`)), true)
  }
  for (const p of PER_ID) {
    riparti(true)
    dalDb(p, p.attesa)
    await chiama(p.g, p.corpo, { ip: IP1 })
    for (const c of limiti()) visti.add(c.args.ambito)
  }
  riparti(true)
  await chiama(sp, null, { metodo: 'GET', url: 'https://x/f?payment_id=sp-6', ip: IP1 })
  for (const c of limiti()) visti.add(c.args.ambito)
  ok('i cinque ambiti, uno per azione e nessun altro', [...visti].sort(), [
    'satispay:callback', 'satispay:paga', 'satispay:prepara', 'satispay:stato', 'satispay:stato_pagamento',
  ])
}

// ===========================================================================
dire('\n9. «attivo» non conta')
for (const [nome, g] of [['satispay', sp]]) {
  riparti(false)
  const r = await chiama(g, { azione: 'attivo' }, { ip: IP1 })
  ok(`${nome} attivo: risponde com'è oggi, anche con un limite che direbbe di no`, [r.stato, r.corpo.attivo === true || r.corpo.attivo === false], [200, true])
  ok(`${nome} attivo: nessun limite`, limiti().length, 0)
  riparti(false)
  risposteDb['admin:metodi_spenti'] = () => ({ data: ['satispay'], error: null })
  await chiama(g, { azione: 'attivo' }, { ip: IP1 })
  ok(`${nome} attivo, metodo spento: nessun limite`, limiti().length, 0)
}

// ===========================================================================
dire('\n10. l\'IP e la sua impronta non finiscono né nei log né nelle risposte')
{
  const raccolto = []
  const impronte = new Set()
  const giro = async (a, ip, limite) => {
    riparti(limite)
    a.semina?.()
    const r = await chiama(a.g, a.corpo, { ip, xff: `${ip}, 10.1.1.1` })
    raccolto.push(JSON.stringify(r.corpo), ...log)
    for (const c of limiti()) impronte.add(c.args.chiave)
  }
  for (const guasto of [true, false, 'errore', 'mancante']) {
    for (const a of PER_IP) {
      riparti(true)
      a.semina()
      if (guasto === 'errore') risposteDb['admin:limite_frequenza'] = () => ({ data: null, error: { code: 'XX000', message: 'boom' } })
      else if (guasto === 'mancante') risposteDb['admin:limite_frequenza'] = () => ({ data: null, error: { code: 'PGRST202', message: 'no function' } })
      else risposteDb['admin:limite_frequenza'] = () => ({ data: guasto, error: null })
      const r = await chiama(a.g, a.corpo, { ip: IP1, xff: `${IP1}, 10.1.1.1` })
      raccolto.push(JSON.stringify(r.corpo), ...log)
      for (const c of limiti()) impronte.add(c.args.chiave)
    }
    for (const p of PER_ID) {
      riparti(true)
      dalDb(p, p.attesa)
      if (guasto === 'errore') risposteDb['admin:limite_frequenza'] = () => ({ data: null, error: { code: 'XX000', message: 'boom' } })
      else if (guasto === 'mancante') risposteDb['admin:limite_frequenza'] = () => ({ data: null, error: { code: 'PGRST202', message: 'no function' } })
      else risposteDb['admin:limite_frequenza'] = () => ({ data: guasto, error: null })
      const r = await chiama(p.g, p.corpo, { ip: IP1, xff: `${IP1}, 10.1.1.1` })
      raccolto.push(JSON.stringify(r.corpo), ...log)
    }
  }
  await giro(PER_IP[0], IP2, false)
  ok('c\'è almeno un\'impronta da cercare', impronte.size > 0, true)
  ok('nessun IP nei log e nelle risposte', raccolto.filter((t) => t.includes(IP1) || t.includes(IP2) || t.includes('10.1.1.1')), [])
  ok('nessuna impronta nei log e nelle risposte', raccolto.filter((t) => [...impronte].some((i) => i && t.includes(i))), [])
}

// ===========================================================================
dire('\n11. il limite si tocca solo dove deve')
{
  // Le azioni che non chiamano il provider e non sono l'ingresso di un pagamento nuovo.
  const SENZA_LIMITE = [
    ['satispay attivo', sp, { azione: 'attivo' }],
    ['satispay: azione che non c\'è', sp, { azione: 'boh', richiesta: A }],
    ['satispay: il saldo senza login', sp, { azione: 'saldo', persona: A, ricevuta: P }],
    ['satispay: la quota senza login', sp, { azione: 'quota', persona: A }],
    ['satispay: stato_pagamento senza pagamento', sp, { azione: 'stato_pagamento' }],
  ]
  for (const [nome, g, corpo] of SENZA_LIMITE) {
    riparti(false)
    const r = await chiama(g, corpo, { ip: IP1 })
    ok(`${nome}: nessun limite, e non è un 429`, [limiti().length, r.stato === 429], [0, false])
  }
  // Chi ha un accesso (area degli iscritti) non passa dal limite: non è anonimo e il database lo conosce.
  for (const [azione, rpc, extra] of [['quota_stato', 'satispay_quota_stato', {}], ['corso_stato', 'satispay_corso_stato', { corso: A }], ['saldo_stato', 'satispay_saldo_stato', { ricevuta: P }]]) {
    riparti(false)
    risposteDb[`lui:${rpc}`] = () => ({ data: { stato: 'attesa', importo: 5000, chi: 'Rossi Anna', satispay_id: 'sp-9' }, error: null })
    risposteDb['admin:satispay_esito'] = () => ({ data: { stato: 'pagato', importo: 5000 }, error: null })
    const r = await chiama(sp, { azione, persona: A, ...extra }, { token: 'buono', ip: IP1 })
    ok(`${azione} con l'accesso: nessun limite, come prima`, [r.stato, limiti().length, rete.length > 0], [200, 0, true])
  }
  // Una richiesta storta non costa niente: non dovrebbe consumare il limite di nessuno.
  riparti(false)
  const storta = await chiama(sp, { azione: 'stato' }, { ip: IP1 })
  ok('stato senza richiesta: 400 e nessun limite', [storta.stato, limiti().length], [400, 0])
  // OPTIONS e metodi che non servono non toccano il database.
  riparti(false)
  const opz = await sp(new Request('https://x/f', { method: 'OPTIONS', headers: { 'cf-connecting-ip': IP1 } }))
  ok('OPTIONS: nessun limite', [opz.status, chiamate.length], [200, 0])
}

if (guai) {
  dire(`\n${guai} cose non tornano`)
  process.exit(1)
}
dire('\nTutto a posto')
