// ---------------------------------------------------------------------------
// Il pagamento con Satispay dal modulo di iscrizione.
//
// Chi si iscrive non ha un accesso: il modulo chiama questa funzione con l'id
// della richiesta appena mandata, che conosce solo lui. La funzione gira sul
// server, con la chiave `service_role` e la chiave privata Satispay, che non
// escono mai di qui. Tre strade:
//
//   · POST { azione: 'paga', richiesta }: il pagamento della richiesta, con
//     l'importo che calcola il database (`satispay_prepara`, 73-satispay.sql).
//     Se è già pagata lo dice; se ce n'è uno in attesa torna quello, mai un
//     secondo. Torna il link della pagina di Satispay;
//   · POST { azione: 'stato', richiesta }: com'è andata, chiedendolo a
//     Satispay se è ancora in attesa (la callback può essersi persa);
//   · POST { azione: 'prepara', corso, formula, nome, cognome, email }: il
//     pagamento da fare in fondo al modulo, prima di mandare la richiesta
//     (`satispay_prepara_prima`, 83-satispay-prima.sql): quello in attesa per
//     la stessa scelta, o uno nuovo. Torna l'id, il link e l'importo;
//   · POST { azione: 'stato_pagamento', pagamento }: com'è andato quel
//     pagamento, per id, chiedendolo a Satispay se è ancora in attesa;
//   · POST { azione: 'saldo', persona, ricevuta }: il saldo della quota associativa
//     dall'area degli iscritti (`satispay_prepara_saldo`, 103-saldo-satispay.sql).
//     Chiede il login: il database controlla la persona con la sessione di chi
//     chiama, mai con `service_role`. Torna il link, o { pagato: true };
//   · POST { azione: 'saldo_stato', persona, ricevuta }: com'è andato il saldo
//     (`satispay_saldo_stato`), chiedendolo a Satispay se è ancora in attesa;
//   · POST { azione: 'saldo_attivo' }: se c’è il saldo (103), con il login;
//   · GET ?payment_id=…: la callback di Satispay. Non dice lo stato e chiunque
//     la può chiamare: lo stato si rilegge da Satispay con una chiamata firmata.
//
// Senza i segreti (SATISPAY_KEY_ID, SATISPAY_CHIAVE) o senza 73-satispay.sql
// risponde { attivo: false }: il modulo propone il bonifico con la sua ricevuta.
//
// Si pubblica con `supabase functions deploy satispay --no-verify-jwt` (la
// callback di Satispay arriva senza token): vedi `LEGGIMI.md`.
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'
import { chiavePrivata, intestazioni } from './firma.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const risposta = (corpo: Record<string, unknown>, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Il testo per chi paga, mai quello grezzo di Satispay o del database: è lo stesso di ERRORE_SATISPAY (src/lib/satispay.ts).
const NON_RISPONDE = 'Satispay non risponde: riprova fra qualche minuto'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const keyId = Deno.env.get('SATISPAY_KEY_ID') ?? ''
const pem = Deno.env.get('SATISPAY_CHIAVE') ?? ''
// La sandbox finché non si mette quello di produzione (authservices.satispay.com).
const host = Deno.env.get('SATISPAY_HOST') ?? 'staging.authservices.satispay.com'
// Dove torna chi ha pagato: la pagina di iscrizione dell'app, mai un indirizzo che manda il browser.
const app = Deno.env.get('APP_URL') ?? ''

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let chiave: Promise<CryptoKey> | null = null

/** Una chiamata firmata a Satispay; `null` se non risponde come deve. */
async function satispay(metodo: 'GET' | 'POST', percorso: string, corpo = '', extra: Record<string, string> = {}) {
  chiave ??= chiavePrivata(pem)
  try {
    const r = await fetch(`https://${host}${percorso}`, {
      method: metodo,
      headers: { ...(await intestazioni({ metodo, percorso, host, corpo, keyId, chiave: await chiave })), ...extra },
      body: metodo === 'POST' ? corpo : undefined,
    })
    if (!r.ok) {
      console.error('Satispay', metodo, percorso, r.status, await r.text())
      return null
    }
    return (await r.json()) as { id: string; status: string; redirect_url?: string }
  } catch (e) {
    console.error('Satispay', metodo, percorso, e)
    return null
  }
}

/** Crea il pagamento in Satispay per il nostro `nostro`, e ne scrive l'id e il link; `null` se non va. */
async function creaInSatispay(nostro: string, importo: number, ritorno: URL, riferimento = 'ISCRIZIONE') {
  const nuovo = await satispay(
    'POST',
    '/g_business/v1/payments',
    JSON.stringify({
      flow: 'MATCH_CODE',
      amount_unit: importo,
      currency: 'EUR',
      // Si legge nell'app Satispay di chi paga: niente nomi, solo un riferimento per la segreteria.
      external_code: `${riferimento} ${nostro.slice(0, 8).toUpperCase()}`,
      callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/satispay?payment_id={uuid}`,
      redirect_url: ritorno.toString(),
    }),
    // Lo stesso pagamento nostro non diventa mai due pagamenti Satispay, anche se la risposta si perde.
    { 'Idempotency-Key': nostro },
  )
  if (!nuovo?.redirect_url) return null
  const scritto = await admin.rpc('satispay_creato', { id: nostro, satispay_id: nuovo.id, link: nuovo.redirect_url })
  if (scritto.error) {
    // Senza l'id di Satispay nel database la callback non si riconoscerebbe: niente link, si riprova. Il tentativo
    // dopo ha la stessa Idempotency-Key e riceve lo stesso pagamento Satispay, non uno nuovo.
    console.error('satispay_creato', scritto.error)
    return null
  }
  return nuovo.redirect_url
}

/** Rilegge lo stato da Satispay e lo scrive nel database. */
async function aggiorna(satispayId: string) {
  const p = await satispay('GET', `/g_business/v1/payments/${encodeURIComponent(satispayId)}`)
  if (!p) return null
  const { data, error } = await admin.rpc('satispay_esito', { satispay_id: satispayId, stato_satispay: p.status })
  if (error) {
    console.error('satispay_esito', error)
    return null
  }
  return data as { stato: string; importo: number; pagato_il?: string }
}

/**
 * Il database con la sessione di chi chiama (`Authorization`), per le funzioni che chiedono il login: sono loro a
 * controllare che la persona sia sua o del suo nucleo. `null` senza una sessione vera.
 */
async function comeChiChiama(req: Request) {
  const autorizzazione = req.headers.get('Authorization') ?? ''
  const token = autorizzazione.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  if (!data.user) return null
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: autorizzazione } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const detto = (e: { message?: string; code?: string }) =>
  // I messaggi del database con errcode 22023 sono già scritti per chi paga (73-satispay.sql).
  e.code === '22023' && e.message ? e.message : NON_RISPONDE

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const attivo = keyId && pem && app

  if (req.method === 'GET') {
    // La callback: si risponde sempre 200, se no Satispay ritenta per niente; lo stato lo chiede `stato` alla pagina.
    const id = new URL(req.url).searchParams.get('payment_id')
    if (attivo && id) await aggiorna(id)
    return risposta({ ok: true })
  }
  if (req.method !== 'POST') return risposta({ guaio: 'Solo GET e POST' }, 405)
  if (!attivo) return risposta({ attivo: false })

  let corpo: { azione?: unknown; richiesta?: unknown; persona?: unknown; ricevuta?: unknown; pagamento?: unknown; corso?: unknown; formula?: unknown; nome?: unknown; cognome?: unknown; email?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return risposta({ guaio: 'Richiesta storta' }, 400)
  }
  if (corpo.azione === 'attivo') {
    // Il servizio c'è se c'è anche 83-satispay-prima.sql (e quindi 73): PGRST202 vuol dire che non è stato lanciato.
    // L'app di prima chiede solo 73, ma 83 si lancia prima che la nuova vada in linea.
    const { error } = await admin.rpc('satispay_stato_pagamento', { pagamento: '00000000-0000-0000-0000-000000000000' })
    return risposta({ attivo: error?.code !== 'PGRST202' })
  }
  if (corpo.azione === 'prepara') {
    // Oltre le misure delle colonne il database direbbe un vincolo, non una frase: 80 per nome e cognome, 254 per l'email.
    const testo = (x: unknown, quanto = 80) => (typeof x === 'string' ? x.slice(0, quanto) : '')
    const corso = typeof corpo.corso === 'string' && UUID.test(corpo.corso) ? corpo.corso : null
    if (!corso) return risposta({ guaio: 'Manca il corso' }, 400)
    const { data, error } = await admin.rpc('satispay_prepara_prima', {
      corso,
      formula: testo(corpo.formula),
      nome: testo(corpo.nome),
      cognome: testo(corpo.cognome),
      email: testo(corpo.email, 254),
    })
    // PGRST202: 83-satispay-prima.sql non c'è ancora.
    if (error) return error.code === 'PGRST202' ? risposta({ attivo: false }) : risposta({ guaio: detto(error) }, 409)
    const p = data as { stato: string; id: string; importo: number; satispay_id?: string | null; link?: string | null; pagato_il?: string | null }
    // Già pagato e non ancora preso da una richiesta (la pagina ricaricata dopo aver pagato): non si paga due volte.
    if (p.stato === 'pagato') return risposta({ stato: 'pagato', id: p.id, importo: p.importo, pagato_il: p.pagato_il })
    if (p.satispay_id && p.link) return risposta({ stato: 'attesa', id: p.id, link: p.link, importo: p.importo })
    const ritorno = new URL(app)
    ritorno.searchParams.set('satispay', p.id)
    const link = await creaInSatispay(p.id, p.importo, ritorno)
    return link ? risposta({ stato: 'attesa', id: p.id, link, importo: p.importo }) : risposta({ guaio: NON_RISPONDE }, 502)
  }
  if (corpo.azione === 'stato_pagamento') {
    const pagamento = typeof corpo.pagamento === 'string' && UUID.test(corpo.pagamento) ? corpo.pagamento : null
    if (!pagamento) return risposta({ guaio: 'Manca il pagamento' }, 400)
    const { data, error } = await admin.rpc('satispay_stato_pagamento', { pagamento })
    if (error) return error.code === 'PGRST202' ? risposta({ attivo: false }) : risposta({ guaio: NON_RISPONDE }, 502)
    const s = data as { stato: string; importo: number; pagato_il?: string; satispay_id?: string } | null
    if (s?.stato === 'attesa' && s.satispay_id) return risposta({ pagamento: (await aggiorna(s.satispay_id)) ?? s })
    return risposta({ pagamento: s })
  }

  if (corpo.azione === 'saldo_attivo') {
    // Il saldo c'è se c'è 103-saldo-satispay.sql: PGRST202 vuol dire che non è stato lanciato.
    const lui = await comeChiChiama(req)
    if (!lui) return risposta({ guaio: 'Entra con il tuo accesso per pagare' }, 401)
    const { error } = await lui.rpc('satispay_saldo_stato', { persona: '00000000-0000-0000-0000-000000000000', ricevuta: '00000000-0000-0000-0000-000000000000' })
    return risposta({ attivo: error?.code !== 'PGRST202' })
  }
  if (corpo.azione === 'saldo' || corpo.azione === 'saldo_stato') {
    const persona = typeof corpo.persona === 'string' && UUID.test(corpo.persona) ? corpo.persona : null
    const ricevuta = typeof corpo.ricevuta === 'string' && UUID.test(corpo.ricevuta) ? corpo.ricevuta : null
    if (!persona || !ricevuta) return risposta({ guaio: 'Manca la persona o la ricevuta' }, 400)
    const lui = await comeChiChiama(req)
    if (!lui) return risposta({ guaio: 'Entra con il tuo accesso per pagare' }, 401)

    if (corpo.azione === 'saldo_stato') {
      const { data, error } = await lui.rpc('satispay_saldo_stato', { persona, ricevuta })
      if (error) return error.code === 'PGRST202' ? risposta({ attivo: false }) : risposta({ guaio: NON_RISPONDE }, 502)
      const s = data as { stato: string; importo: number; pagato_il?: string; chi: string } | null
      if (s?.stato !== 'attesa') return risposta({ pagamento: s })
      // In attesa: si rilegge da Satispay, che può aver già confermato (la callback si può perdere).
      const { data: p } = await lui.rpc('satispay_prepara_saldo', { persona, ricevuta })
      const satispayId = (p as { satispay_id?: string | null } | null)?.satispay_id
      const nuovo = satispayId ? await aggiorna(satispayId) : null
      return risposta({ pagamento: nuovo ? { ...s, stato: nuovo.stato, pagato_il: nuovo.pagato_il } : s })
    }

    // 42501: non è una persona sua; 22023: i testi per chi paga. Il resto è il servizio che non c'è o non risponde.
    const { data, error } = await lui.rpc('satispay_prepara_saldo', { persona, ricevuta })
    if (error) {
      if (error.code === 'PGRST202') return risposta({ attivo: false })
      return risposta({ guaio: error.code === '42501' && error.message ? error.message : detto(error) }, error.code === '42501' ? 403 : 409)
    }
    const p = data as { stato: string; id: string; importo: number; satispay_id?: string | null; link?: string | null }
    if (p.satispay_id && p.link) return risposta({ link: p.link })
    // Torna all'area degli iscritti, accanto alla pagina di iscrizione di `APP_URL`: la persona e la ricevuta per rileggere com'è andata.
    const ritorno = new URL('../iscritti/', app)
    ritorno.searchParams.set('saldo', ricevuta)
    ritorno.searchParams.set('persona', persona)
    const link = await creaInSatispay(p.id, p.importo, ritorno, 'SALDO')
    return link ? risposta({ link }) : risposta({ guaio: NON_RISPONDE }, 502)
  }

  const richiesta = typeof corpo.richiesta === 'string' && UUID.test(corpo.richiesta) ? corpo.richiesta : null
  if (!richiesta) return risposta({ guaio: 'Manca la richiesta' }, 400)

  if (corpo.azione === 'stato') {
    const { data, error } = await admin.rpc('satispay_stato', { richiesta })
    // PGRST202: 73-satispay.sql non c'è ancora.
    if (error) return error.code === 'PGRST202' ? risposta({ attivo: false }) : risposta({ guaio: NON_RISPONDE }, 502)
    const s = data as { stato: string; importo: number; pagato_il?: string; satispay_id?: string } | null
    if (s?.stato === 'attesa' && s.satispay_id) return risposta({ pagamento: (await aggiorna(s.satispay_id)) ?? s })
    return risposta({ pagamento: s })
  }

  if (corpo.azione !== 'paga') return risposta({ guaio: 'Azione sconosciuta' }, 400)
  const { data, error } = await admin.rpc('satispay_prepara', { richiesta })
  if (error) return error.code === 'PGRST202' ? risposta({ attivo: false }) : risposta({ guaio: detto(error) }, 409)
  const p = data as { stato: string; id?: string; importo: number; satispay_id?: string | null; link?: string | null }
  if (p.stato === 'pagato') return risposta({ pagato: true })
  // In attesa `satispay_prepara` dà sempre l'id del nostro pagamento.
  const nostro = p.id ?? ''
  if (p.satispay_id && p.link) return risposta({ link: p.link })

  const ritorno = new URL(app)
  ritorno.searchParams.set('pagamento', richiesta)
  const link = await creaInSatispay(nostro, p.importo, ritorno)
  return link ? risposta({ link }) : risposta({ guaio: NON_RISPONDE }, 502)
})
