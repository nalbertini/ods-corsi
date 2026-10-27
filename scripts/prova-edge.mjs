// ---------------------------------------------------------------------------
// Le Edge Function `satispay` e `ricevuta-email`, senza Deno, senza rete e
// senza posta.
//
//   node scripts/prova-edge.mjs
//
// Si impacchetta il vero `index.ts` con esbuild; `Deno`, il client Supabase,
// `fetch` (Satispay) e nodemailer sono finti, e si guarda cosa chiama la
// funzione e cosa risponde. Così non si riscrive niente: se si toglie un
// pezzo di `index.ts` cade la prova. Le regole in SQL le provano
// `supabase/prova/*.sql`; qui c'è quello che la funzione decide da sé:
// l'importo viene dal database e mai dal corpo, il database si chiama con la
// sessione di chi preme, l'indirizzo non esce mai, il testo per chi paga non
// è quello grezzo di Satispay.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { createHash, generateKeyPairSync } from 'node:crypto'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// --- i finti ----------------------------------------------------------------
const SERVIZIO = 'chiave-di-servizio'
let chiamate // [{ chi: 'admin' | 'lui', nome, args }]
let risposteDb // 'admin:nome' | 'lui:nome' → (args, n) => { data, error }
let utenti // token → utente
let rete // [{ metodo, url, corpo, intestazioni }]
let rispondeRete // (metodo, percorso) => { stato, json } | 'cade'
let posta // { inviate: [], errore: null }
let errori // console.error
const volte = {}

const finto = {
  createClient(_url, chiave, opzioni) {
    const chi = chiave === SERVIZIO ? 'admin' : 'lui'
    return {
      auth: { getUser: async (token) => ({ data: { user: utenti[token] ?? null } }) },
      rpc: async (nome, args) => {
        chiamate.push({ chi, nome, args, sessione: opzioni?.global?.headers?.Authorization })
        const k = `${chi}:${nome}`
        volte[k] = (volte[k] ?? 0) + 1
        const f = risposteDb[k]
        return f ? f(args, volte[k]) : { data: null, error: null }
      },
    }
  },
}
globalThis.__finto = finto
globalThis.__posta = {
  createTransport: () => ({
    sendMail: async (m) => {
      if (posta.errore) throw posta.errore
      posta.inviate.push(m)
    },
  }),
}
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(url)
  rete.push({ metodo: o.method, host: u.host, percorso: u.pathname, corpo: o.body ? JSON.parse(o.body) : null, intestazioni: o.headers })
  const r = rispondeRete(o.method, u.pathname)
  if (r === 'cade') throw new Error('rete giù')
  return { ok: r.stato < 400, status: r.stato, json: async () => r.json, text: async () => JSON.stringify(r.json) }
}
const dicono = [console.error]
console.error = (...a) => errori.push(a.map(String).join(' '))

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
          b.onResolve({ filter: /^npm:nodemailer/ }, () => ({ path: 'nodemailer', namespace: 'finto' }))
          b.onLoad({ filter: /^supabase$/, namespace: 'finto' }, () => ({ contents: 'export const createClient = (...a) => globalThis.__finto.createClient(...a)' }))
          b.onLoad({ filter: /^nodemailer$/, namespace: 'finto' }, () => ({ contents: 'export default { createTransport: (...a) => globalThis.__posta.createTransport(...a) }' }))
        },
      },
    ],
  })
  return outputFiles[0].text
}
let contatore = 0
/** Un'istanza nuova della funzione con queste variabili d'ambiente; torna il suo gestore. */
const carica = async (testo, env) => {
  let gestore
  const deno = { env: { get: (k) => env[k] }, serve: (g) => (gestore = g) }
  globalThis.Deno = deno
  await import('data:text/javascript;base64,' + Buffer.from(`${testo}\n//${++contatore}`).toString('base64'))
  // `Deno.env` si legge a ogni richiesta: ogni istanza rimette il suo.
  return (req) => {
    globalThis.Deno = deno
    return gestore(req)
  }
}
const riparti = () => {
  chiamate = []
  risposteDb = {}
  utenti = { buono: { id: 'u1' } }
  rete = []
  rispondeRete = () => ({ stato: 200, json: {} })
  posta = { inviate: [], errore: null }
  errori = []
  for (const k of Object.keys(volte)) delete volte[k]
}
riparti()

const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' })
const ENV = {
  SUPABASE_URL: 'https://prova.supabase.co',
  SUPABASE_ANON_KEY: 'chiave-anon',
  SUPABASE_SERVICE_ROLE_KEY: SERVIZIO,
  SATISPAY_KEY_ID: 'kid',
  SATISPAY_CHIAVE: pem,
  APP_URL: 'https://app.esempio.it/iscrizioni/',
}
const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const B = 'bbbbbbbb-0000-4000-8000-000000000002'
const P = 'cccccccc-0000-4000-8000-000000000003'
const NON_RISPONDE = 'Satispay non risponde: riprova fra qualche minuto'

const chiama = async (gestore, corpo, { token = 'buono', metodo = 'POST', url = 'https://x/functions/v1/f' } = {}) => {
  const intestazioni = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const r = await gestore(new Request(url, { method: metodo, headers: intestazioni, body: metodo === 'POST' ? (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) : undefined }))
  return { stato: r.status, corpo: await r.json() }
}

// ===========================================================================
console.log('\n1. satispay: il servizio spento, il metodo, il corpo')
const testoSatispay = await impacchetta('supabase/functions/satispay/index.ts')
{
  riparti()
  const spento = await carica(testoSatispay, { ...ENV, SATISPAY_KEY_ID: '' })
  ok('senza i segreti: attivo false, e nessuna chiamata', [await chiama(spento, { azione: 'quota', persona: A }), rete.length, chiamate.length], [{ stato: 200, corpo: { attivo: false } }, 0, 0])
  ok('la callback senza i segreti risponde 200 e non chiama Satispay', [(await chiama(spento, null, { metodo: 'GET', url: 'https://x/f?payment_id=abc' })).stato, rete.length], [200, 0])
  const g = await carica(testoSatispay, ENV)
  ok('un metodo che non c\'è: 405', (await chiama(g, null, { metodo: 'PUT' })).stato, 405)
  ok('un corpo che non è JSON: 400', await chiama(g, '{storto'), { stato: 400, corpo: { guaio: 'Richiesta storta' } })
  ok('un\'azione che non c\'è: 400', (await chiama(g, { azione: 'boh', richiesta: A })).stato, 400)
  ok('senza richiesta: 400', await chiama(g, { azione: 'paga' }), { stato: 400, corpo: { guaio: 'Manca la richiesta' } })
}

// ===========================================================================
console.log('\n2. satispay: la quota intera')
{
  riparti()
  const g = await carica(testoSatispay, ENV)
  ok('senza persona: 400', await chiama(g, { azione: 'quota' }), { stato: 400, corpo: { guaio: 'Manca la persona' } })
  ok('con una persona che non è un UUID: 400', (await chiama(g, { azione: 'quota', persona: 'x; drop' })).stato, 400)
  ok('senza accesso: 401, e il database non si tocca', [(await chiama(g, { azione: 'quota', persona: A }, { token: '' })).stato, chiamate.length], [401, 0])
  ok('con un token che non è di nessuno: 401', (await chiama(g, { azione: 'quota', persona: A }, { token: 'falso' })).stato, 401)

  riparti()
  risposteDb['lui:satispay_prepara_quota'] = () => ({ data: { stato: 'attesa', id: P, importo: 5000, satispay_id: null, link: null }, error: null })
  risposteDb['admin:satispay_creato'] = () => ({ data: null, error: null })
  rispondeRete = () => ({ stato: 200, json: { id: 'sp-1', status: 'PENDING', redirect_url: 'https://satispay.it/paga/1' } })
  // `importo` nel corpo è quello che manderebbe un telefono truccato.
  const r = await chiama(g, { azione: 'quota', persona: A, importo: 1 })
  ok('risponde col link di Satispay', r, { stato: 200, corpo: { link: 'https://satispay.it/paga/1' } })
  const prepara = chiamate.find((c) => c.nome === 'satispay_prepara_quota')
  ok('il database lo chiama chi preme, con la sua sessione, e solo con la persona', [prepara?.chi, prepara?.sessione, prepara?.args], ['lui', 'Bearer buono', { persona: A }])
  const crea = rete.find((x) => x.metodo === 'POST')
  ok('Satispay riceve l\'importo del database, mai quello del corpo', crea?.corpo?.amount_unit, 5000)
  ok('…in euro, con un riferimento che non ha nomi', [crea?.corpo?.currency, crea?.corpo?.flow, crea?.corpo?.external_code], ['EUR', 'MATCH_CODE', 'QUOTA CCCCCCCC'])
  ok('…con la Idempotency-Key del pagamento nostro: due tocchi non fanno due pagamenti', crea?.intestazioni?.['Idempotency-Key'], P)
  ok('…firmata', /^Signature keyId="kid", algorithm="rsa-sha256"/.test(crea?.intestazioni?.Authorization ?? ''), true)
  ok('…alla sandbox, finché non c\'è SATISPAY_HOST', [crea?.host, crea?.percorso], ['staging.authservices.satispay.com', '/g_business/v1/payments'])
  const ritorno = new URL(crea?.corpo?.redirect_url ?? 'http://vuoto')
  ok('si torna all\'area iscritti accanto alla pagina di iscrizione', [ritorno.origin + ritorno.pathname, ritorno.searchParams.get('quota'), ritorno.searchParams.get('persona')], ['https://app.esempio.it/iscritti/', '1', A])
  ok('la callback è la funzione stessa', crea?.corpo?.callback_url, 'https://prova.supabase.co/functions/v1/satispay?payment_id={uuid}')
  const scritto = chiamate.find((c) => c.nome === 'satispay_creato')
  ok('l\'id di Satispay lo scrive il server (service role), non chi preme', [scritto?.chi, scritto?.args], ['admin', { id: P, satispay_id: 'sp-1', link: 'https://satispay.it/paga/1' }])

  riparti()
  risposteDb['lui:satispay_prepara_quota'] = () => ({ data: { stato: 'attesa', id: P, importo: 5000, satispay_id: 'sp-1', link: 'https://satispay.it/paga/1' }, error: null })
  ok('già in attesa: ridà lo stesso link, senza chiamare Satispay', [await chiama(g, { azione: 'quota', persona: A }), rete.length], [{ stato: 200, corpo: { link: 'https://satispay.it/paga/1' } }, 0])

  riparti()
  risposteDb['lui:satispay_prepara_quota'] = () => ({ data: null, error: { code: '42501', message: 'Questa persona non è fra le tue' } })
  ok('non è una persona sua: 403 col testo del database', await chiama(g, { azione: 'quota', persona: A }), { stato: 403, corpo: { guaio: 'Questa persona non è fra le tue' } })
  risposteDb['lui:satispay_prepara_quota'] = () => ({ data: null, error: { code: '22023', message: 'La quota è già pagata' } })
  ok('così non si paga: 409 col testo del database', await chiama(g, { azione: 'quota', persona: A }), { stato: 409, corpo: { guaio: 'La quota è già pagata' } })
  risposteDb['lui:satispay_prepara_quota'] = () => ({ data: null, error: { code: 'XX000', message: 'relation "pagamenti_satispay" does not exist' } })
  ok('un altro errore: mai il testo grezzo del database', await chiama(g, { azione: 'quota', persona: A }), { stato: 409, corpo: { guaio: NON_RISPONDE } })
  risposteDb['lui:satispay_prepara_quota'] = () => ({ data: null, error: { code: 'PGRST202', message: 'no function' } })
  ok('il file SQL non lanciato: attivo false', await chiama(g, { azione: 'quota', persona: A }), { stato: 200, corpo: { attivo: false } })

  riparti()
  risposteDb['lui:satispay_prepara_quota'] = () => ({ data: { stato: 'attesa', id: P, importo: 5000, satispay_id: null, link: null }, error: null })
  rispondeRete = () => ({ stato: 500, json: { message: 'errore interno di Satispay con dettagli' } })
  ok('Satispay risponde male: 502 col testo per chi paga', await chiama(g, { azione: 'quota', persona: A }), { stato: 502, corpo: { guaio: NON_RISPONDE } })
  ok('…e l\'errore grezzo resta nel log del server', errori.some((e) => e.includes('errore interno di Satispay')), true)
  rispondeRete = () => 'cade'
  ok('Satispay non si raggiunge: 502', (await chiama(g, { azione: 'quota', persona: A })).stato, 502)
  rispondeRete = () => ({ stato: 200, json: { id: 'sp-1', status: 'PENDING' } })
  ok('Satispay risponde senza link: 502', (await chiama(g, { azione: 'quota', persona: A })).stato, 502)
  rispondeRete = () => ({ stato: 200, json: { id: 'sp-1', status: 'PENDING', redirect_url: 'https://satispay.it/paga/1' } })
  risposteDb['admin:satispay_creato'] = () => ({ data: null, error: { code: 'XX000', message: 'boom' } })
  ok('l\'id non si scrive nel database: niente link, 502 (la callback non si riconoscerebbe)', await chiama(g, { azione: 'quota', persona: A }), { stato: 502, corpo: { guaio: NON_RISPONDE } })
}

// ===========================================================================
console.log('\n3. satispay: com\'è andata (quota_stato, corso_stato, saldo_stato)')
{
  const g = await carica(testoSatispay, ENV)
  for (const [azione, rpc, extra] of [
    ['quota_stato', 'satispay_quota_stato', {}],
    ['corso_stato', 'satispay_corso_stato', { corso: B }],
    ['saldo_stato', 'satispay_saldo_stato', { ricevuta: B }],
  ]) {
    riparti()
    const corpo = { azione, persona: A, ...extra }
    const attesa = { stato: 'attesa', importo: 5000, chi: 'Rossi Anna', satispay_id: 'sp-9' }
    risposteDb[`lui:${rpc}`] = () => ({ data: attesa, error: null })
    risposteDb['admin:satispay_esito'] = () => ({ data: { stato: 'pagato', importo: 5000, pagato_il: '2026-10-20T10:00:00Z' }, error: null })
    rispondeRete = () => ({ stato: 200, json: { id: 'sp-9', status: 'ACCEPTED' } })
    const r = await chiama(g, corpo)
    ok(`${azione}: in attesa, si rilegge da Satispay e si risponde col nuovo stato`, r, { stato: 200, corpo: { pagamento: { stato: 'pagato', importo: 5000, chi: 'Rossi Anna', pagato_il: '2026-10-20T10:00:00Z' } } })
    ok(`${azione}: lo stato lo chiede chi preme, e l'esito lo scrive il server`, [chiamate[0]?.chi, chiamate.find((c) => c.nome === 'satispay_esito')?.chi, chiamate.find((c) => c.nome === 'satispay_esito')?.args], ['lui', 'admin', { satispay_id: 'sp-9', stato_satispay: 'ACCEPTED' }])
    ok(`${azione}: l'id di Satispay non esce`, JSON.stringify(r.corpo).includes('sp-9'), false)

    riparti()
    risposteDb[`lui:${rpc}`] = () => ({ data: { stato: 'pagato', importo: 5000, chi: 'Rossi Anna', satispay_id: 'sp-9' }, error: null })
    ok(`${azione}: già pagato, non si chiede a Satispay e l'id non esce`, [(await chiama(g, corpo)).corpo, rete.length], [{ pagamento: { stato: 'pagato', importo: 5000, chi: 'Rossi Anna' } }, 0])

    riparti()
    risposteDb[`lui:${rpc}`] = () => ({ data: attesa, error: null })
    rispondeRete = () => 'cade'
    ok(`${azione}: Satispay non risponde, resta com'è nel database`, (await chiama(g, corpo)).corpo, { pagamento: { stato: 'attesa', importo: 5000, chi: 'Rossi Anna' } })

    riparti()
    ok(`${azione}: nessun pagamento (o non suo): null`, (await chiama(g, corpo)).corpo, { pagamento: null })
    risposteDb[`lui:${rpc}`] = () => ({ data: null, error: { code: 'PGRST202' } })
    ok(`${azione}: file SQL non lanciato: attivo false`, (await chiama(g, corpo)).corpo, { attivo: false })
    risposteDb[`lui:${rpc}`] = () => ({ data: null, error: { code: 'XX000', message: 'boom' } })
    ok(`${azione}: altro errore: 502 col testo per chi paga`, await chiama(g, corpo), { stato: 502, corpo: { guaio: NON_RISPONDE } })
    ok(`${azione}: serve il login`, (await chiama(g, corpo, { token: '' })).stato, 401)
  }
  riparti()
  ok('saldo_stato: senza ricevuta, 400', (await chiama(g, { azione: 'saldo_stato', persona: A })).stato, 400)
}

// ===========================================================================
console.log('\n4. satispay: il corso e il saldo')
{
  const g = await carica(testoSatispay, ENV)
  riparti()
  risposteDb['lui:satispay_prepara_corso'] = () => ({ data: { stato: 'attesa', id: P, importo: 9000, satispay_id: null, link: null }, error: null })
  risposteDb['admin:satispay_creato'] = () => ({ data: null, error: null })
  rispondeRete = () => ({ stato: 200, json: { id: 'sp-2', status: 'PENDING', redirect_url: 'https://satispay.it/paga/2' } })
  ok('corso: senza il corso, 400', (await chiama(g, { azione: 'corso', persona: A })).stato, 400)
  const r = await chiama(g, { azione: 'corso', persona: A, corso: B, formula: 'trimestre', importo: 1 })
  ok('corso: il link', r, { stato: 200, corpo: { link: 'https://satispay.it/paga/2' } })
  ok('corso: al database arrivano persona, corso e formula com\'è (la controlla lui)', chiamate.find((c) => c.nome === 'satispay_prepara_corso')?.args, { persona: A, corso: B, formula: 'trimestre' })
  const crea = rete.find((x) => x.metodo === 'POST')
  const ritorno = new URL(crea?.corpo?.redirect_url ?? 'http://vuoto')
  ok('corso: importo del database, riferimento CORSO, si torna al corso', [crea?.corpo?.amount_unit, crea?.corpo?.external_code, ritorno.searchParams.get('corso'), ritorno.searchParams.get('persona')], [9000, 'CORSO CCCCCCCC', B, A])
  risposteDb['lui:satispay_prepara_corso'] = () => ({ data: null, error: { code: '42501', message: 'Non è tuo' } })
  ok('corso: non è suo, 403', (await chiama(g, { azione: 'corso', persona: A, corso: B })).stato, 403)

  riparti()
  risposteDb['lui:satispay_prepara_saldo'] = () => ({ data: { stato: 'attesa', id: P, importo: 3000, satispay_id: null, link: null }, error: null })
  risposteDb['admin:satispay_creato'] = () => ({ data: null, error: null })
  rispondeRete = () => ({ stato: 200, json: { id: 'sp-3', status: 'PENDING', redirect_url: 'https://satispay.it/paga/3' } })
  ok('saldo: senza la ricevuta, 400', (await chiama(g, { azione: 'saldo', persona: A })).stato, 400)
  ok('saldo: il link', await chiama(g, { azione: 'saldo', persona: A, ricevuta: B }), { stato: 200, corpo: { link: 'https://satispay.it/paga/3' } })
  ok('saldo: al database persona e ricevuta, con la sessione di chi preme', [chiamate.find((c) => c.nome === 'satispay_prepara_saldo')?.chi, chiamate.find((c) => c.nome === 'satispay_prepara_saldo')?.args], ['lui', { persona: A, ricevuta: B }])
  const cs = rete.find((x) => x.metodo === 'POST')
  const rs = new URL(cs?.corpo?.redirect_url ?? 'http://vuoto')
  ok('saldo: importo del database, riferimento SALDO, si torna alla ricevuta', [cs?.corpo?.amount_unit, cs?.corpo?.external_code, rs.searchParams.get('saldo'), rs.searchParams.get('persona')], [3000, 'SALDO CCCCCCCC', B, A])

  riparti()
  risposteDb['lui:satispay_saldo_stato'] = () => ({ data: null, error: null })
  ok('saldo_attivo: c\'è se il file SQL c\'è', await chiama(g, { azione: 'saldo_attivo' }), { stato: 200, corpo: { attivo: true } })
  risposteDb['lui:satispay_saldo_stato'] = () => ({ data: null, error: { code: 'PGRST202' } })
  ok('saldo_attivo: non c\'è se manca', (await chiama(g, { azione: 'saldo_attivo' })).corpo, { attivo: false })
  ok('saldo_attivo: serve il login', (await chiama(g, { azione: 'saldo_attivo' }, { token: '' })).stato, 401)
}

// ===========================================================================
console.log('\n5. satispay: il modulo di iscrizione (senza login) e la callback')
{
  const g = await carica(testoSatispay, ENV)
  riparti()
  risposteDb['admin:satispay_prepara'] = () => ({ data: { stato: 'attesa', id: P, importo: 23000, satispay_id: null, link: null }, error: null })
  risposteDb['admin:satispay_creato'] = () => ({ data: null, error: null })
  rispondeRete = () => ({ stato: 200, json: { id: 'sp-4', status: 'PENDING', redirect_url: 'https://satispay.it/paga/4' } })
  ok('paga: il link', await chiama(g, { azione: 'paga', richiesta: A }, { token: '' }), { stato: 200, corpo: { link: 'https://satispay.it/paga/4' } })
  const rp = new URL(rete.find((x) => x.metodo === 'POST')?.corpo?.redirect_url ?? 'http://vuoto')
  ok('paga: si torna alla pagina di iscrizione con la richiesta', [rp.origin + rp.pathname, rp.searchParams.get('pagamento')], ['https://app.esempio.it/iscrizioni/', A])
  risposteDb['admin:satispay_prepara'] = () => ({ data: { stato: 'pagato', importo: 23000 }, error: null })
  ok('paga: già pagata, lo dice e non ne fa un secondo', [await chiama(g, { azione: 'paga', richiesta: A }, { token: '' }), rete.length], [{ stato: 200, corpo: { pagato: true } }, 1])

  riparti()
  risposteDb['admin:satispay_prepara_prima'] = () => ({ data: { stato: 'pagato', id: P, importo: 23000, pagato_il: '2026-10-20T10:00:00Z' }, error: null })
  ok('prepara: già pagato e non ancora in una richiesta: non si paga due volte', [(await chiama(g, { azione: 'prepara', corso: A, formula: 'annuale' }, { token: '' })).corpo.stato, rete.length], ['pagato', 0])
  ok('prepara: senza il corso, 400', (await chiama(g, { azione: 'prepara', formula: 'annuale' }, { token: '' })).stato, 400)
  riparti()
  risposteDb['admin:satispay_prepara_prima'] = () => ({ data: { stato: 'attesa', id: P, importo: 23000, satispay_id: null, link: null }, error: null })
  risposteDb['admin:satispay_creato'] = () => ({ data: null, error: null })
  rispondeRete = () => ({ stato: 200, json: { id: 'sp-5', status: 'PENDING', redirect_url: 'https://satispay.it/paga/5' } })
  await chiama(g, { azione: 'prepara', corso: A, formula: 'annuale', nome: 'N'.repeat(200), cognome: 'C', email: 'e'.repeat(300) }, { token: '' })
  const prima = chiamate.find((c) => c.nome === 'satispay_prepara_prima')?.args
  ok('prepara: nome e cognome a 80 caratteri, email a 254', [prima?.nome.length, prima?.email.length], [80, 254])

  riparti()
  risposteDb['admin:satispay_esito'] = () => ({ data: { stato: 'pagato', importo: 100 }, error: null })
  rispondeRete = () => ({ stato: 200, json: { id: 'sp-6', status: 'ACCEPTED' } })
  ok('callback: risponde 200 e riletto da Satispay, lo scrive il server', [(await chiama(g, null, { metodo: 'GET', url: 'https://x/f?payment_id=sp-6' })).stato, rete[0]?.metodo, rete[0]?.percorso, chiamate[0]?.chi, chiamate[0]?.args], [200, 'GET', '/g_business/v1/payments/sp-6', 'admin', { satispay_id: 'sp-6', stato_satispay: 'ACCEPTED' }])
  riparti()
  rispondeRete = () => 'cade'
  ok('callback: Satispay non risponde, 200 lo stesso (se no ritenta per niente)', (await chiama(g, null, { metodo: 'GET', url: 'https://x/f?payment_id=sp-6' })).stato, 200)
  riparti()
  ok('callback: senza payment_id, niente', [(await chiama(g, null, { metodo: 'GET' })).stato, rete.length], [200, 0])
}

// ===========================================================================
console.log('\n6. ricevuta-email: chi preme, l\'indirizzo, la posta')
const testoRicevuta = await impacchetta('supabase/functions/ricevuta-email/index.ts')
{
  const PDF = Buffer.from('%PDF-1.7 ricevuta di prova').toString('base64')
  const SHA = createHash('sha256').update(Buffer.from(PDF, 'base64')).digest('hex')
  const IND = 'mamma.rossi@esempio.it'
  const controllo = { numero: 7, anno: 2026, data: '2026-10-21', totale: 5000, nome: 'Anna', cognome: 'Rossi', persona: P, ha_indirizzo: true, oltre_soglia: false, segreteria: true }
  const pronto = () => {
    riparti()
    risposteDb['lui:controlla_invio_ricevuta'] = () => ({ data: controllo, error: null })
    risposteDb['admin:indirizzo_ricevuta'] = () => ({ data: IND, error: null })
    risposteDb['admin:registra_invio_ricevuta'] = () => ({ data: null, error: null })
  }
  const g = await carica(testoRicevuta, { ...ENV, SMTP_PASSWORD: 'segreto' })
  const senzaPassword = await carica(testoRicevuta, ENV)
  const registrati = () => chiamate.filter((c) => c.nome === 'registra_invio_ricevuta')

  pronto()
  ok('un metodo che non c\'è: 405', (await chiama(g, null, { metodo: 'GET' })).stato, 405)
  ok('senza accesso: 401, e il database non si tocca', [(await chiama(g, { ricevuta: A, pdf: PDF }, { token: '' })).stato, chiamate.length], [401, 0])
  ok('un corpo storto: 400', (await chiama(g, '{storto')).stato, 400)
  ok('senza ricevuta: 400', (await chiama(g, { pdf: PDF })).corpo.guaio, 'Manca la ricevuta')
  ok('un PDF che non è un PDF: 400', (await chiama(g, { ricevuta: A, pdf: Buffer.from('<html>').toString('base64') })).corpo.guaio, 'Il PDF non va')
  ok('…e il database non si tocca', chiamate.length, 0)

  pronto()
  const r = await chiama(g, { ricevuta: A, pdf: PDF, indirizzo: 'ladro@esempio.it', to: 'ladro@esempio.it' })
  ok('la mail parte e si risponde alla segreteria con l\'indirizzo', r, { stato: 200, corpo: { esito: 'mandata', indirizzo: IND } })
  ok('…all\'indirizzo del database, mai a uno del corpo', posta.inviate.map((m) => m.to), [IND])
  ok('…con il PDF che è arrivato, in allegato', [posta.inviate[0]?.attachments?.[0]?.content === PDF, posta.inviate[0]?.attachments?.[0]?.contentType, posta.inviate[0]?.attachments?.[0]?.filename], [true, 'application/pdf', 'ricevuta-7-2026-rossi-anna.pdf'])
  const c0 = chiamate[0]
  ok('il controllo lo fa chi preme, con la sua sessione', [c0?.chi, c0?.nome, c0?.sessione, c0?.args], ['lui', 'controlla_invio_ricevuta', 'Bearer buono', { ricevuta: A }])
  ok('l\'indirizzo lo legge il server (service role), per quella ricevuta', chiamate.filter((c) => c.nome === 'indirizzo_ricevuta').map((c) => [c.chi, c.args]), [['admin', { ricevuta: A }]])
  ok('il tentativo lo registra il server, con chi ha premuto, l\'indirizzo e l\'impronta del PDF', registrati().map((c) => [c.chi, c.args]), [['admin', { ricevuta: A, esito: 'mandata', motivo: null, da: P, indirizzo: IND, pdf_sha256: SHA }]])
  ok('nessuno registra con la sessione di chi preme', chiamate.some((c) => c.chi === 'lui' && c.nome === 'registra_invio_ricevuta'), false)

  pronto()
  risposteDb['lui:controlla_invio_ricevuta'] = () => ({ data: { ...controllo, segreteria: false }, error: null })
  ok('l\'amministrazione non vede l\'indirizzo', (await chiama(g, { ricevuta: A, pdf: PDF })).corpo, { esito: 'mandata' })

  for (const [codice, stato, tipo] of [['55000', 409, 'annullata'], ['54000', 429, 'troppe'], ['42501', 403, 'posta'], ['PGRST202', 501, 'manca-sql']]) {
    pronto()
    risposteDb['lui:controlla_invio_ricevuta'] = () => ({ data: null, error: { code: codice } })
    const n = await chiama(g, { ricevuta: A, pdf: PDF })
    ok(`il controllo dice ${codice}: ${stato} ${tipo}, e non parte niente`, [n.stato, n.corpo.tipo, posta.inviate.length, registrati().length], [stato, tipo, 0, 0])
  }

  pronto()
  risposteDb['lui:controlla_invio_ricevuta'] = () => ({ data: { ...controllo, oltre_soglia: true }, error: null })
  ok('oltre le 400 al giorno: 429, non parte, resta «soglia»', [(await chiama(g, { ricevuta: A, pdf: PDF })).stato, posta.inviate.length, registrati().map((c) => c.args.motivo)], [429, 0, ['soglia']])

  pronto()
  risposteDb['admin:indirizzo_ricevuta'] = () => ({ data: null, error: null })
  ok('senza email in scheda: 409, non parte, e non resta niente', [(await chiama(g, { ricevuta: A, pdf: PDF })).stato, posta.inviate.length, registrati().length], [409, 0, 0])

  pronto()
  risposteDb['admin:indirizzo_ricevuta'] = () => ({ data: null, error: { code: 'XX000' } })
  ok('l\'indirizzo non si legge: 502, non parte, resta «indirizzo XX000» senza indirizzo', [(await chiama(g, { ricevuta: A, pdf: PDF })).stato, posta.inviate.length, registrati().map((c) => [c.args.esito, c.args.motivo, c.args.indirizzo])], [502, 0, [['non partita', 'indirizzo XX000', null]]])

  pronto()
  const sp = await chiama(senzaPassword, { ricevuta: A, pdf: PDF })
  ok('senza SMTP_PASSWORD: 501, non parte, resta il motivo', [sp.stato, sp.corpo.tipo, posta.inviate.length, registrati().map((c) => c.args.motivo)], [501, 'manca-password', 0, ['manca SMTP_PASSWORD']])

  pronto()
  posta.errore = Object.assign(new Error(`550 mailbox ${IND} unavailable`), { responseCode: 550 })
  const np = await chiama(g, { ricevuta: A, pdf: PDF })
  ok('la posta rifiuta: 502 «La mail non è partita», resta «posta 550» con l\'indirizzo usato', [np.stato, np.corpo, registrati().map((c) => [c.args.esito, c.args.motivo, c.args.indirizzo])], [502, { guaio: 'La mail non è partita', tipo: 'posta' }, [['non partita', 'posta 550', IND]]])
  ok('…l\'indirizzo non è né nella risposta né nei log', [JSON.stringify(np.corpo).includes(IND), errori.some((e) => e.includes(IND))], [false, false])

  pronto()
  risposteDb['admin:registra_invio_ricevuta'] = (_a, n) => ({ data: null, error: n === 1 ? { code: 'XX000' } : null })
  ok('la mail parte e la prima registrazione fallisce: si riprova, e va', [(await chiama(g, { ricevuta: A, pdf: PDF })).corpo, posta.inviate.length, registrati().length], [{ esito: 'mandata', indirizzo: IND }, 1, 2])
  pronto()
  risposteDb['admin:registra_invio_ricevuta'] = () => ({ data: null, error: { code: 'XX000' } })
  ok('…se non va mai, la mail è partita e lo si dice all\'app', [(await chiama(g, { ricevuta: A, pdf: PDF })).corpo, registrati().length], [{ esito: 'mandata', indirizzo: IND, registrata: false }, 2])
}

console.error = dicono[0]
if (guai) {
  console.log(`\n${guai} cose non tornano`)
  process.exit(1)
}
console.log('\nTutto a posto')
