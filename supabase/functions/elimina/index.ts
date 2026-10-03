// ---------------------------------------------------------------------------
// Eliminare un istruttore: la scheda e l'account.
//
// La scheda la cancella il database, con `elimina_istruttore()`
// (`28-elimina-istruttore.sql`), chiamata col token di chi chiama: è lì che si
// controlla che sia della segreteria, che la persona sia un istruttore e che
// non abbia mai insegnato. Solo dopo, con la chiave `service_role` che non
// lascia mai il progetto, si toglie l'account: dal browser non si può.
//
// Prima la scheda e poi l'account, non il contrario: se il database dice di
// no, l'account resta com'era. Se è l'account a non andarsene, la scheda è già
// andata e senza scheda l'account non entra da nessuna parte: si toglie a mano
// dal pannello.
//
// Si pubblica con `supabase functions deploy elimina` (vedi `LEGGIMI.md`).
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const risposta = (corpo: Record<string, unknown>, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json' } })

const no = (guaio: string, stato: number) => risposta({ guaio }, stato)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return no('Solo POST', 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const authorization = req.headers.get('Authorization') ?? ''
  if (!/^Bearer\s+\S/i.test(authorization)) return no('Serve un accesso da segreteria', 401)

  let corpo: { persona?: unknown } | null
  try {
    corpo = await req.json()
  } catch {
    return no('Richiesta storta', 400)
  }
  if (typeof corpo?.persona !== 'string') return no('Manca la persona da eliminare', 400)

  // Come chi chiama: le regole sono quelle del database.
  const suo = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
  // L'email della scheda, letta prima che se ne vada: l'account da togliere
  // deve avere quella. Ruolo e account di una scheda li cambia la segreteria,
  // e così non si toglie l'account di un altro spostandolo su questa scheda.
  const { data: scheda } = await suo.from('persone').select('email').eq('id', corpo.persona).maybeSingle()
  const { data: account, error } = await suo.rpc('elimina_istruttore', { persona: corpo.persona })
  if (error) {
    if (error.code === 'PGRST202') return no('Per eliminare un istruttore va lanciato 28-elimina-istruttore.sql: vedi supabase/LEGGIMI.md', 501)
    return no(error.message, error.code === '42501' ? 403 : 400)
  }
  if (!account) return risposta({ account: false })

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: utente } = await admin.auth.admin.getUserById(account as string)
  const email = (x: string | null | undefined) => (x ?? '').trim().toLowerCase()
  if (!utente.user || !email(scheda?.email) || email(utente.user.email) !== email(scheda?.email))
    return no('La scheda è eliminata, ma l’account non ha la sua email e non si tocca: se va tolto, da Authentication → Users', 409)
  const { error: e2 } = await admin.auth.admin.deleteUser(account as string)
  if (e2) return no(`La scheda è eliminata, ma l’account no (${e2.message}): va tolto da Authentication → Users`, 502)
  return risposta({ account: true })
})
