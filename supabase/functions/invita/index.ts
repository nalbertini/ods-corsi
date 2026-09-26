// ---------------------------------------------------------------------------
// L'invito per email a un istruttore o a una persona della segreteria.
//
// Dal browser un account non si crea: la chiave che sta nell'app è pubblica.
// Qui sì, perché la funzione gira sul server di Supabase e ha la chiave
// `service_role`, che non lascia mai il progetto. Chi la chiama deve essere
// della segreteria, e invita solo una persona già in `persone`: la funzione
// non inventa account per email scritte al volo.
//
//   · la persona non ha ancora un account → Supabase la invita: le arriva una
//     mail con un link, lo apre e sceglie la sua password;
//   · ha già un account ma non ci è mai entrata (invito scaduto, o creato a
//     mano dal pannello) → le arriva il link per scegliere la password;
//   · è già entrata → niente: se ha perso la password la chiede lei dalla
//     porta, con «password dimenticata».
//
// Al primo accesso l'account e la scheda si legano da soli, per email
// (`collega_utente()`, in `05-segreteria.sql`): aprire il link conferma
// l'email, ed è quello che `collega_utente()` vuole.
//
// Si pubblica con `supabase functions deploy invita` (vedi `LEGGIMI.md`).
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
  const pubblica = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Chi chiama: dal suo token, e poi dalla sua riga in `persone`.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: chi } = await admin.auth.getUser(token)
  if (!chi.user) return no('Serve un accesso da segreteria', 401)
  const { data: staff } = await admin
    .from('persone')
    .select('id')
    .eq('utente_id', chi.user.id)
    .eq('attiva', true)
    .eq('ruolo', 'staff')
    .maybeSingle()
  if (!staff) return no('Non hai il permesso: serve un accesso da segreteria', 403)

  let corpo: { persona?: unknown; ritorno?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return no('Richiesta storta', 400)
  }
  if (typeof corpo.persona !== 'string') return no('Manca la persona da invitare', 400)
  // Dove porta il link. Supabase lo accetta solo se è fra i Redirect URLs del
  // progetto; altrimenti usa la Site URL. Qui si scarta solo quel che non è un
  // indirizzo web.
  let ritorno: string | undefined
  if (typeof corpo.ritorno === 'string' && /^https?:\/\//i.test(corpo.ritorno)) ritorno = corpo.ritorno

  const { data: p, error } = await admin
    .from('persone')
    .select('nome, email, ruolo, attiva, utente_id')
    .eq('id', corpo.persona)
    .maybeSingle()
  if (error) return no(error.message, 500)
  if (!p || (p.ruolo !== 'istruttore' && p.ruolo !== 'staff')) return no('Si invitano solo istruttori e segreteria', 400)
  if (!p.attiva) return no(`${p.nome} è senza accesso: prima va ridato`, 400)
  if (!p.email) return no(`${p.nome} non ha un’email`, 400)
  if (p.utente_id) return no(`${p.nome} è già entrata: se ha perso la password, la chiede dalla porta con «password dimenticata»`, 409)

  const invito = await admin.auth.admin.inviteUserByEmail(p.email, { redirectTo: ritorno, data: { nome: p.nome } })
  if (!invito.error) return risposta({ come: 'invito' })

  // Un account con quell'email c'è già: si manda il link per scegliere la
  // password. Lo manda il client pubblico, lo stesso di «password dimenticata».
  const esiste = invito.error.code === 'email_exists' || /already been registered|already exists/i.test(invito.error.message)
  if (!esiste) return no(detto(invito.error), 502)
  const { error: e2 } = await createClient(url, pubblica, { auth: { persistSession: false } }).auth.resetPasswordForEmail(p.email, {
    redirectTo: ritorno,
  })
  if (e2) return no(detto(e2), 502)
  return risposta({ come: 'password' })
})

/** L'errore di Supabase detto per la segreteria. */
function detto(e: { message?: string; code?: string; status?: number }): string {
  const m = e.message ?? ''
  if (e.code === 'over_email_send_rate_limit' || e.status === 429 || /rate limit/i.test(m))
    return 'Troppe email in poco tempo: riprova fra un’ora, o si configura un SMTP in Supabase (vedi LEGGIMI)'
  if (/invalid.*email|email.*invalid/i.test(m)) return 'Supabase dice che l’email non è valida'
  return `La mail non è partita${m ? `: ${m}` : ''}`
}
