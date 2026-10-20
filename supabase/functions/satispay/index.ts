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
//   · GET ?payment_id=…: la callback di Satispay. Non dice lo stato e chiunque
//     la può chiamare: lo stato si rilegge da Satispay con una chiamata firmata.
//
// Senza i segreti (SATISPAY_KEY_ID, SATISPAY_CHIAVE) o senza 73-satispay.sql
// risponde { attivo: false }: il modulo propone bonifico e segreteria.
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
const NON_RISPONDE = 'Satispay non risponde: riprova o paga in segreteria'
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

  let corpo: { azione?: unknown; richiesta?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return risposta({ guaio: 'Richiesta storta' }, 400)
  }
  if (corpo.azione === 'attivo') {
    // Il servizio c'è se c'è anche 73-satispay.sql: PGRST202 vuol dire che non è stato lanciato.
    const { error } = await admin.rpc('satispay_stato', { richiesta: '00000000-0000-0000-0000-000000000000' })
    return risposta({ attivo: error?.code !== 'PGRST202' })
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
  const nuovo = await satispay(
    'POST',
    '/g_business/v1/payments',
    JSON.stringify({
      flow: 'MATCH_CODE',
      amount_unit: p.importo,
      currency: 'EUR',
      // Si legge nell'app Satispay di chi paga: niente nomi, solo un riferimento per la segreteria.
      external_code: `ISCRIZIONE ${nostro.slice(0, 8).toUpperCase()}`,
      callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/satispay?payment_id={uuid}`,
      redirect_url: ritorno.toString(),
    }),
    // Lo stesso pagamento nostro non diventa mai due pagamenti Satispay, anche se la risposta si perde.
    { 'Idempotency-Key': nostro },
  )
  if (!nuovo?.redirect_url) return risposta({ guaio: NON_RISPONDE }, 502)
  const scritto = await admin.rpc('satispay_creato', { id: nostro, satispay_id: nuovo.id, link: nuovo.redirect_url })
  if (scritto.error) {
    // Senza l'id di Satispay nel database la callback non si riconoscerebbe: niente link, si riprova. Il tentativo
    // dopo ha la stessa Idempotency-Key e riceve lo stesso pagamento Satispay, non uno nuovo.
    console.error('satispay_creato', scritto.error)
    return risposta({ guaio: NON_RISPONDE }, 502)
  }
  return risposta({ link: nuovo.redirect_url })
})
