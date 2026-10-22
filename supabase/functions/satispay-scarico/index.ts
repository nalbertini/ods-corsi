// ---------------------------------------------------------------------------
// Lo scarico dei pagamenti Satispay del negozio in CONTABILITÀ (96-satispay-scarico.sql).
//
// Qui si legge soltanto: l'elenco `GET /g_business/v1/payments`, con la stessa chiave firmata della funzione
// `satispay`, pagina per pagina, nella tabella `satispay_negozio`. Le regole (modulo, a mano, giorno chiuso,
// movimento nuovo) stanno nel database, in `satispay_negozio_applica`.
//
//   · POST { anteprima: true } con il token dell'amministrazione: legge tutto in `satispay_negozio` e dice cosa
//     scriverebbe, senza scrivere movimenti (il primo scarico);
//   · POST {} con il token dell'amministrazione: «Scarica ora», o la conferma del primo scarico;
//   · POST {} con l'intestazione `x-scarico`: pg_cron, ogni notte, col segreto SATISPAY_SCARICO_SEGRETO (lo stesso
//     di `satispay_scarico_segreto` nel Vault). Fa qualcosa solo se il primo scarico è già confermato.
//
// Scrive solo col negozio vero (SATISPAY_HOST = authservices.satispay.com): i pagamenti della sandbox in
// CONTABILITÀ sarebbero soldi che non ci sono.
//
// Si pubblica con `supabase functions deploy satispay-scarico --no-verify-jwt` (pg_cron chiama senza token,
// col segreto): senza, chiunque abbia l'indirizzo farebbe girare lo scarico.
// vedi `LEGGIMI.md`.
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'
import { chiavePrivata, intestazioni } from '../satispay/firma.ts'
import { scorriPagine, type Pagina, type PagamentoGrezzo } from './pagine.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const risposta = (corpo: Record<string, unknown>, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Lo stesso host di HOST_VERO (src/lib/satispayScarico.ts).
const HOST_VERO = 'authservices.satispay.com'
const keyId = Deno.env.get('SATISPAY_KEY_ID') ?? ''
const pem = Deno.env.get('SATISPAY_CHIAVE') ?? ''
const host = (Deno.env.get('SATISPAY_HOST') ?? '').trim().toLowerCase()
const url = Deno.env.get('SUPABASE_URL')!
const segretoCron = Deno.env.get('SATISPAY_SCARICO_SEGRETO') ?? ''

const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let chiave: Promise<CryptoKey> | null = null

/** Una pagina dell'elenco, la più nuova o quella dopo `startingAfter`; `null` se Satispay non risponde come deve. */
async function leggi(startingAfter?: string): Promise<Pagina | null> {
  chiave ??= chiavePrivata(pem)
  const percorso = `/g_business/v1/payments?limit=100${startingAfter ? `&starting_after=${encodeURIComponent(startingAfter)}` : ''}`
  try {
    const r = await fetch(`https://${host}${percorso}`, {
      headers: await intestazioni({ metodo: 'GET', percorso, host, corpo: '', keyId, chiave: await chiave }),
    })
    if (!r.ok) {
      console.error('Satispay GET', percorso, r.status, await r.text())
      return null
    }
    const p = (await r.json()) as Partial<Pagina>
    return { data: Array.isArray(p.data) ? p.data : [], has_more: p.has_more === true }
  } catch (e) {
    console.error('Satispay GET', percorso, e)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return risposta({ guaio: 'Solo POST' }, 405)
  if (host !== HOST_VERO) return risposta({ guaio: 'Lo scarico gira solo col negozio vero di Satispay' })
  if (!keyId || !pem) return risposta({ guaio: 'Manca la chiave del negozio Satispay fra i segreti: vedi supabase/LEGGIMI.md' })

  let anteprima = false
  try {
    anteprima = (await req.json())?.anteprima === true
  } catch {
    // pg_cron può mandare un corpo vuoto: vale come {}.
  }

  // Chi chiama: con un accesso vero deve passare dalla porta della contabilità; pg_cron porta il segreto.
  // Un token che non vale non diventa pg_cron: senza il segreto giusto si risponde 403.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: chi } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  const daCron = !chi.user && segretoCron !== '' && req.headers.get('x-scarico') === segretoCron
  if (!chi.user && !daCron) return risposta({ guaio: 'Lo scarico Satispay lo fa solo l’amministrazione' }, 403)
  if (chi.user) {
    const comeLui = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const porta = await comeLui.rpc('satispay_scarico_stato')
    if (porta.error) return risposta({ guaio: 'Lo scarico Satispay lo fa solo l’amministrazione' }, 403)
  } else if (anteprima) {
    return risposta({ guaio: 'L’anteprima la chiede solo l’amministrazione' }, 403)
  }

  const { data: stato, error } = await admin.from('satispay_scarico').select('primo_fatto, ripresa, storia_completa').single()
  if (error || !stato) {
    console.error('satispay_scarico', error)
    return risposta({ guaio: 'Lo scarico non è pronto: manca 96-satispay-scarico.sql' }, 501)
  }
  // Di notte niente finché l'amministrazione non ha visto e confermato il primo scarico.
  if (!chi.user && !stato.primo_fatto) return risposta({ fatto: false })

  const storia = stato.storia_completa === true
  const salva = async (pagamenti: PagamentoGrezzo[]) => {
    const r = await admin.rpc('satispay_negozio_salva', { pagamenti })
    if (r.error) {
      console.error('satispay_negozio_salva', r.error)
      return null
    }
    // Mentre si scorre lo storico la ripresa si scrive a ogni pagina: se la funzione si ferma a metà, si riparte da qui.
    // `!`: scorriPagine chiama salva solo con una pagina non vuota.
    if (!storia) await admin.rpc('satispay_scarico_ripresa', { ripresa: pagamenti.at(-1)!.id, completa: false })
    return r.data as number
  }
  const esito = await scorriPagine(leggi, salva, storia ? null : stato.ripresa, storia)
  if (!esito.ok) {
    if (!anteprima) await admin.rpc('satispay_scarico_segna', { errore: esito.errore })
    return risposta({ guaio: esito.errore })
  }
  if (!storia) await admin.rpc('satispay_scarico_ripresa', { ripresa: esito.ripresa, completa: esito.completa })

  const conti = await admin.rpc('satispay_negozio_applica', { scrivi: !anteprima })
  if (conti.error) {
    console.error('satispay_negozio_applica', conti.error)
    const errore = 'Lo scarico non è riuscito a scrivere i movimenti: riprova fra qualche minuto'
    if (!anteprima) await admin.rpc('satispay_scarico_segna', { errore })
    return risposta({ guaio: errore })
  }
  if (!anteprima) await admin.rpc('satispay_scarico_segna', { errore: null })
  return risposta({ fatto: true, conti: conti.data })
})
