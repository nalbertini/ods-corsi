// ---------------------------------------------------------------------------
// Il pagamento con la carta dal modulo di iscrizione (115-carta.sql).
//
// Incassa PayPal, coi suoi campi carta ospitati (e Apple Pay / Google Pay):
// i dati della carta vanno dal browser a PayPal, mai di qui. Questa funzione
// crea l'ordine con l'importo che calcola il database e lo cattura, con la
// chiave segreta di PayPal e la `service_role`, che non escono mai di qui:
//
//   · POST { azione: 'attivo' }: se la carta c'è, col client id pubblico che
//     serve al browser per aprire i campi, e se è la sandbox (per Google Pay);
//   · POST { azione: 'prepara', corso, formula, nome, cognome, email, chiave }:
//     il pagamento da fare in fondo al modulo (`carta_prepara_prima`): quello in
//     attesa per la stessa scelta e la stessa chiave del browser, o uno nuovo con
//     il suo ordine PayPal. Torna l'id, l'importo e l'ordine;
//   · POST { azione: 'cattura', pagamento }: chi paga ha confermato la carta,
//     si incassa. Solo un pagamento ancora in attesa: uno dato per non andato
//     (30 minuti) non si cattura più. Torna lo stato;
//   · POST { azione: 'stato_pagamento', pagamento }: com'è andato, chiedendolo
//     a PayPal se è ancora in attesa.
//
// Senza i segreti (PAYPAL_CLIENT_ID, PAYPAL_SECRET) o senza 115-carta.sql
// risponde { attivo: false }: il modulo offre solo Satispay e bonifico.
//
// Si pubblica con `supabase functions deploy paypal --no-verify-jwt` (il
// modulo pubblico chiama senza accesso): vedi `LEGGIMI.md`.
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'
import { catturaOrdine } from './cattura.ts'
import { statoCarta } from './stato.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const risposta = (corpo: Record<string, unknown>, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Il testo per chi paga, mai quello grezzo di PayPal o del database: è lo stesso di ERRORE_CARTA (src/lib/satispay.ts).
const NON_RISPONDE = 'Il pagamento con la carta non risponde: riprova fra qualche minuto'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const clientId = Deno.env.get('PAYPAL_CLIENT_ID') ?? ''
const segreto = Deno.env.get('PAYPAL_SECRET') ?? ''
// La sandbox finché non si mette quello di produzione (api-m.paypal.com).
const host = Deno.env.get('PAYPAL_HOST') ?? 'api-m.sandbox.paypal.com'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let gettone: { valore: string; scade: number } | null = null

/** Il token OAuth di PayPal, tenuto finché vale (circa 9 ore); `null` se PayPal non lo dà. */
async function token() {
  if (gettone && gettone.scade > Date.now()) return gettone.valore
  try {
    const r = await fetch(`https://${host}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${clientId}:${segreto}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    })
    if (!r.ok) {
      console.error('PayPal token', r.status, await r.text())
      return null
    }
    // La forma della risposta OAuth di PayPal, documentata.
    const t = (await r.json()) as { access_token: string; expires_in: number }
    gettone = { valore: t.access_token, scade: Date.now() + (t.expires_in - 60) * 1000 }
    return gettone.valore
  } catch (e) {
    console.error('PayPal token', e)
    return null
  }
}

type Ordine = { id: string; status: string; purchase_units?: { payments?: { captures?: { status: string }[] } }[] }

/**
 * Una chiamata a PayPal. `null` se non risponde; `{ rifiuto }` se dice di no (422: la carta rifiutata alla cattura,
 * l'ordine non più catturabile): i dettagli restano nel log, mai a chi paga.
 */
async function paypal(metodo: 'GET' | 'POST', percorso: string, corpo?: unknown, idempotenza?: string): Promise<Ordine | { rifiuto: true } | null> {
  const t = await token()
  if (!t) return null
  try {
    const r = await fetch(`https://${host}${percorso}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
        // Lo stesso pagamento nostro non diventa mai due ordini, né due catture, anche se la risposta si perde.
        ...(idempotenza ? { 'PayPal-Request-Id': idempotenza } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    if (r.status === 422) {
      console.error('PayPal', metodo, percorso, r.status, await r.text())
      return { rifiuto: true }
    }
    if (!r.ok) {
      console.error('PayPal', metodo, percorso, r.status, await r.text())
      return null
    }
    // La forma degli ordini v2 di PayPal: si leggono solo status e catture.
    return (await r.json()) as Ordine
  } catch (e) {
    console.error('PayPal', metodo, percorso, e)
    return null
  }
}

const cattura = (o: Ordine) => o.purchase_units?.[0]?.payments?.captures?.[0]?.status

/** Scrive lo stato dell'ordine nel database, come lo calcola `statoCarta`; `null` se non si scrive. */
async function scrivi(paypalId: string, stato: string) {
  const { data, error } = await admin.rpc('carta_esito', { paypal_id: paypalId, stato })
  if (error) {
    // 22023 con «pagato» su un pagamento non andato: soldi da restituire dal conto PayPal, resta nel log.
    console.error('carta_esito', paypalId, stato, error)
    return null
  }
  // Quel che torna carta_esito (115-carta.sql).
  return data as { stato: string; importo: number; pagato_il?: string | null }
}

/** L'ordine com'è su PayPal; `null` se non si rilegge. */
async function rileggi(paypalId: string) {
  const o = await paypal('GET', `/v2/checkout/orders/${encodeURIComponent(paypalId)}`)
  return !o || 'rifiuto' in o ? null : { status: o.status, cattura: cattura(o) }
}

/** Rilegge l'ordine da PayPal e ne scrive lo stato. */
async function aggiorna(paypalId: string, creatoIl: string) {
  const o = await rileggi(paypalId)
  return o && scrivi(paypalId, statoCarta(o, creatoIl, new Date()))
}

type Nostro = { stato: string; importo: number; pagato_il?: string | null; collegato: boolean; paypal_id?: string | null; creato_il: string }

/** Il pagamento per il browser: l'ordine e quando è nato restano qui. */
const perIlBrowser = ({ paypal_id: _ordine, creato_il: _creato, ...p }: Nostro) => p

const detto = (e: { message?: string; code?: string }) =>
  // I messaggi del database con errcode 22023 sono già scritti per chi paga (115-carta.sql).
  e.code === '22023' && e.message ? e.message : NON_RISPONDE

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return risposta({ guaio: 'Solo POST' }, 405)
  if (!clientId || !segreto) return risposta({ attivo: false })

  let corpo: { azione?: unknown; pagamento?: unknown; corso?: unknown; formula?: unknown; nome?: unknown; cognome?: unknown; email?: unknown; chiave?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return risposta({ guaio: 'Richiesta storta' }, 400)
  }

  // REGOLE → COME SI PAGA (126-metodi-pagamento.sql). Spenta, non si comincia un pagamento nuovo; l'ordine già
  // approvato si cattura lo stesso, se no chi ha già autorizzato la carta resterebbe senza ricevuta.
  if (corpo.azione === 'attivo' || corpo.azione === 'prepara') {
    const { data } = await admin.rpc('metodi_spenti')
    if (Array.isArray(data) && data.includes('carta')) return risposta({ attivo: false })
  }
  if (corpo.azione === 'attivo') {
    // La carta c'è se c'è anche 115-carta.sql: PGRST202 vuol dire che non è stato lanciato.
    const { error } = await admin.rpc('carta_stato_pagamento', { pagamento: '00000000-0000-0000-0000-000000000000' })
    return error?.code === 'PGRST202' ? risposta({ attivo: false }) : risposta({ attivo: true, clientId, sandbox: host.includes('sandbox') })
  }

  if (corpo.azione === 'prepara') {
    // Oltre le misure delle colonne il database direbbe un vincolo, non una frase: 80 per nome e cognome, 254 per l'email.
    const testo = (x: unknown, quanto = 80) => (typeof x === 'string' ? x.slice(0, quanto) : '')
    const corso = typeof corpo.corso === 'string' && UUID.test(corpo.corso) ? corpo.corso : null
    if (!corso) return risposta({ guaio: 'Manca il corso' }, 400)
    // Una chiave storta resta null: il database risponde «Ricarica la pagina e riprova a pagare».
    const chiave = typeof corpo.chiave === 'string' && UUID.test(corpo.chiave) ? corpo.chiave : null
    const dati = { corso, formula: testo(corpo.formula), nome: testo(corpo.nome), cognome: testo(corpo.cognome), email: testo(corpo.email, 254), chiave }
    const prepara = () => admin.rpc('carta_prepara_prima', { dati })
    let { data, error } = await prepara()
    if (error) return error.code === 'PGRST202' ? risposta({ attivo: false }) : risposta({ guaio: detto(error) }, 409)
    // Quel che torna carta_prepara_prima (115-carta.sql).
    let p = data as { stato: string; id: string; importo: number; paypal_id?: string | null; pagato_il?: string | null; creato_il: string }
    if (p.stato === 'attesa' && p.paypal_id) {
      // L'ordine c'è già: forse è stato pagato e la risposta si è persa, o non vale più. Si rilegge prima di ridarlo.
      const ora = await aggiorna(p.paypal_id, p.creato_il)
      if (ora?.stato === 'pagato') p = { ...p, ...ora }
      else if (ora?.stato === 'non-andato') {
        ;({ data, error } = await prepara())
        if (error) return risposta({ guaio: detto(error) }, 409)
        p = data as typeof p
      }
    }
    // Già pagato e non ancora preso da una richiesta (la pagina ricaricata dopo aver pagato): non si paga due volte.
    if (p.stato === 'pagato') return risposta({ stato: 'pagato', id: p.id, importo: p.importo, pagato_il: p.pagato_il })
    if (p.paypal_id) return risposta({ stato: 'attesa', id: p.id, importo: p.importo, ordine: p.paypal_id })

    const nuovo = await paypal(
      'POST',
      '/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            // Si legge nel riepilogo di chi paga: niente nomi, solo un riferimento per la segreteria.
            custom_id: p.id,
            description: `ISCRIZIONE ${p.id.slice(0, 8).toUpperCase()}`,
            amount: { currency_code: 'EUR', value: (p.importo / 100).toFixed(2) },
          },
        ],
      },
      `ordine-${p.id}`,
    )
    if (!nuovo || 'rifiuto' in nuovo) return risposta({ guaio: NON_RISPONDE }, 502)
    const scritto = await admin.rpc('carta_creato', { id: p.id, paypal_id: nuovo.id })
    if (scritto.error) {
      // Senza l'ordine nel database la cattura non si riconoscerebbe: si riprova, e PayPal ridà lo stesso ordine.
      console.error('carta_creato', scritto.error)
      return risposta({ guaio: NON_RISPONDE }, 502)
    }
    return risposta({ stato: 'attesa', id: p.id, importo: p.importo, ordine: nuovo.id })
  }

  const pagamento = typeof corpo.pagamento === 'string' && UUID.test(corpo.pagamento) ? corpo.pagamento : null
  if (corpo.azione !== 'cattura' && corpo.azione !== 'stato_pagamento') return risposta({ guaio: 'Azione sconosciuta' }, 400)
  if (!pagamento) return risposta({ guaio: 'Manca il pagamento' }, 400)

  const { data, error } = await admin.rpc('carta_stato_pagamento', { pagamento })
  if (error) return error.code === 'PGRST202' ? risposta({ attivo: false }) : risposta({ guaio: NON_RISPONDE }, 502)
  // Quel che torna carta_stato_pagamento (115-carta.sql).
  const s = data as Nostro | null
  if (!s || s.stato !== 'attesa' || !s.paypal_id) return risposta({ pagamento: s && perIlBrowser(s) })
  const ordine = s.paypal_id

  if (corpo.azione === 'stato_pagamento') {
    const nuovo = await aggiorna(ordine, s.creato_il)
    return risposta({ pagamento: nuovo ? { ...perIlBrowser(s), ...nuovo } : perIlBrowser(s) })
  }

  const r = await catturaOrdine(s, ordine, pagamento, new Date(), {
    cattura: async (o, idempotenza) => {
      const fatto = await paypal('POST', `/v2/checkout/orders/${encodeURIComponent(o)}/capture`, {}, idempotenza)
      return !fatto ? null : 'rifiuto' in fatto ? 'rifiuto' : { status: fatto.status, cattura: cattura(fatto) }
    },
    rileggi,
    scrivi,
  })
  if (r.errore) return risposta({ guaio: NON_RISPONDE }, 502)
  return risposta({ pagamento: r.nuovo ? { ...perIlBrowser(s), ...r.nuovo } : perIlBrowser(s) })
})
