// ---------------------------------------------------------------------------
// I numeri del sito per il riquadro IL SITO di STATISTICHE.
//
// Il sito conta le visite e i tocchi su Iscriviti, Chiama e Scrivici con
// GoatCounter (`ods.goatcounter.com`). La chiave per leggerli non può stare
// nell'app (la chiave anon è pubblica, e GoatCounter non dice niente sul CORS):
// la tiene questa funzione, che li legge, li riassume e manda all'app solo i
// conti. Niente tabella: i numeri si leggono ogni volta da GoatCounter.
//
//   corpo `{ da: 'AAAA-MM-GG', a: 'AAAA-MM-GG' }`, i giorni del periodo a Roma
//   → `{ numeri }` (vedi NumeriSito in numeri.ts) o `{ guaio, tipo }`
//
// Chi la chiama deve essere della segreteria (`ruolo = 'staff'`, attiva):
// l'amministrazione e gli istruttori non la vedono.
//
// Tre chiamate a GoatCounter insieme (total, hits, toprefs), sotto il limite
// di 4 al secondo; oltre 100 voci, al massimo due pagine in più di hits.
//
// Segreto (Edge Functions → Secrets):
//   GOATCOUNTER_CHIAVE  una chiave di API di GoatCounter con la sola lettura
//                       delle statistiche.
//
// numeri.ts è una copia di src/lib/sitoNumeri.ts (Deno non legge src/lib):
// si cambia là e si ricopia qui; `npm run prova:statistiche-sito` controlla.
// Si pubblica con `supabase functions deploy conti-sito` (vedi `LEGGIMI.md`). Il nome non dice «statistiche»:
// i filtri contro il tracciamento dei browser bloccano gli indirizzi che lo contengono, e il riquadro restava vuoto.
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ancoraVoci, giaViste, giornoValido, intervalloSito, riassumi } from './numeri.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BASE = 'https://ods.goatcounter.com/api/v0'
/** Oltre 100 voci di /stats/hits si chiedono le pagine dopo, ma non più di tre in tutto: il sito ne ha una ventina. */
const PAGINE_MASSIME = 3

/** Un anno e poco più: il periodo più lungo di STATISTICHE è di 12 mesi. */
const GIORNI_MASSIMI = 400

const risposta = (corpo: Record<string, unknown>, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json' } })

const no = (guaio: string, stato: number, tipo?: string) => risposta(tipo ? { guaio, tipo } : { guaio }, stato)

/** Un no di GoatCounter, col tipo che l'app trasforma in una frase che dice cosa fare. */
class NoGoat extends Error {
  constructor(readonly tipo: 'chiave-rifiutata' | 'aspetta' | 'non-risponde', messaggio: string) {
    super(messaggio)
  }
}

async function chiedi(chiave: string, strada: string, parametri: Record<string, string>): Promise<unknown> {
  let r: Response
  try {
    r = await fetch(`${BASE}${strada}?${new URLSearchParams(parametri)}`, {
      headers: { Authorization: `Bearer ${chiave}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new NoGoat('non-risponde', 'GoatCounter non risponde')
  }
  if (r.status === 401 || r.status === 403) throw new NoGoat('chiave-rifiutata', 'GoatCounter non accetta la chiave')
  if (r.status === 429) throw new NoGoat('aspetta', 'GoatCounter chiede di aspettare')
  if (!r.ok) throw new NoGoat('non-risponde', `GoatCounter ha risposto ${r.status}`)
  try {
    return await r.json()
  } catch {
    throw new NoGoat('non-risponde', 'GoatCounter ha risposto una cosa storta')
  }
}

/**
 * Il token che Claude riceve quando lo si collega a ODS Corsi (OAuth Server, claim `client_id`): `getUser` lo accetta
 * come un accesso qualunque, ma da Claude questa funzione non si chiama (vedi 76-claude-dalla-porta.sql). Il token è
 * già verificato da `getUser`: qui se ne leggono solo i claim; uno che non si legge vale come di Claude.
 */
function daClaude(token: string): boolean {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return 'client_id' in JSON.parse(atob(parte.padEnd(Math.ceil(parte.length / 4) * 4, '=')))
  } catch {
    return true
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return no('Solo POST', 405)

  // `!`: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li mette Supabase in ogni funzione, come nelle altre.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Chi chiama: dal suo token, e poi dalla sua riga in `persone`. Solo la segreteria (come `e_staff()`).
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: chi } = await admin.auth.getUser(token)
  if (!chi.user) return no('Serve un accesso da segreteria', 401)
  if (daClaude(token)) return no('Da Claude questa funzione non si chiama: si usa dall’app', 403)
  const { data: staff } = await admin
    .from('persone')
    .select('id')
    .eq('utente_id', chi.user.id)
    .eq('attiva', true)
    .eq('ruolo', 'staff')
    .maybeSingle()
  if (!staff) return no('Non hai il permesso: serve un accesso da segreteria', 403)

  let corpo: { da?: unknown; a?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return no('Richiesta storta', 400)
  }
  const { da, a } = corpo
  if (!giornoValido(da) || !giornoValido(a) || da > a) return no('Il periodo è storto', 400)
  if ((Date.parse(a) - Date.parse(da)) / 86_400_000 > GIORNI_MASSIMI) return no('Il periodo è troppo lungo', 400)

  const intervallo = intervalloSito(da, a)
  // Tutto prima del contatore: niente da chiedere, i conti sono vuoti.
  if (!intervallo) return risposta({ numeri: riassumi({}, {}, {}, da, a) })

  const chiave = Deno.env.get('GOATCOUNTER_CHIAVE')
  if (!chiave) return no('Manca la chiave di GoatCounter fra i segreti della funzione: vedi supabase/LEGGIMI.md, «I numeri del sito»', 501, 'chiave-manca')

  try {
    const [totale, prima, refs] = await Promise.all([
      chiedi(chiave, '/stats/total', intervallo),
      chiedi(chiave, '/stats/hits', { ...intervallo, limit: '100' }),
      chiedi(chiave, '/stats/toprefs', { ...intervallo, limit: '100' }),
    ])
    const hits = [prima]
    // Le pagine dopo una alla volta, con una pausa: tre chiamate sono appena partite e il limite è 4 al secondo.
    while (hits.length < PAGINE_MASSIME && ancoraVoci(hits[hits.length - 1])) {
      await new Promise((fatto) => setTimeout(fatto, 400))
      hits.push(await chiedi(chiave, '/stats/hits', { ...intervallo, limit: '100', exclude_paths: giaViste(hits) }))
    }
    return risposta({ numeri: riassumi(totale, hits, refs, da, a) })
  } catch (e) {
    if (e instanceof NoGoat) return no(e.message, 502, e.tipo)
    return no('I numeri del sito non si leggono', 502, 'non-risponde')
  }
})
