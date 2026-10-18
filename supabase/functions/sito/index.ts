// ---------------------------------------------------------------------------
// Il sito pubblico si rigenera subito, quando la segreteria cambia le pagine.
//
// Il sito lo genera GitHub Actions (`.github/workflows/sito.yml`), ogni cinque
// minuti e quando lo si chiede. Dopo PUBBLICA (e dopo gli altri cambi che il
// sito mostra) l'app chiama questa funzione, che fa partire il workflow senza
// aspettare il giro: il sito è aggiornato in un paio di minuti. Se la funzione
// manca o non risponde non succede niente di grave: il giro a tempo pubblica
// lo stesso.
//
//   · `avvia` → fa partire il workflow del sito adesso. Se un giro è già in
//               corso, GitHub ne mette in coda uno (il gruppo `sito` del
//               workflow): parte dopo, con le pagine cambiate nel frattempo.
//
// Chi la chiama deve essere della segreteria (la stessa regola con cui si
// pubblica una pagina: `e_staff()`).
//
// Segreti: gli stessi del backup (Edge Functions → Secrets).
//   GITHUB_TOKEN  un token *fine-grained* solo per questo repository, con
//                 «Actions: Read and write» e nient'altro;
//   GITHUB_REPO   facoltativo, `proprietario/nome`; di solito non serve.
//
// Si pubblica con `supabase functions deploy sito` (vedi `LEGGIMI.md`).
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const WORKFLOW = 'sito.yml'
const RAMO = 'main'

const risposta = (corpo: Record<string, unknown>, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json' } })

const no = (guaio: string, stato: number) => risposta({ guaio }, stato)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return no('Solo POST', 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Chi chiama: dal suo token, e poi dalla sua riga in `persone`. Lo fanno
  // pubblicare solo alla segreteria (`ruolo = 'staff'`, come `e_staff()`).
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

  let corpo: { azione?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return no('Richiesta storta', 400)
  }
  if (corpo.azione !== 'avvia') return no('Azione sconosciuta', 400)

  const gh = Deno.env.get('GITHUB_TOKEN')
  if (!gh) return no('Manca il token di GitHub fra i segreti della funzione: vedi supabase/LEGGIMI.md, «Il backup»', 501)
  const repo = Deno.env.get('GITHUB_REPO') || 'nalbertini/ods-corsi'

  try {
    const d = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${gh}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ods-corsi-sito',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: RAMO }),
    })
    if (d.status === 404) return no('GitHub non trova il workflow del sito su main', 502)
    if (d.status === 401) return no('GitHub non accetta il token: è scaduto o è sbagliato (vedi supabase/LEGGIMI.md, «Il backup»)', 502)
    if (d.status === 403) return no('Il token di GitHub non ha il permesso «Actions: Read and write» su questo repository', 502)
    if (!d.ok) return no(`GitHub ha risposto ${d.status}`, 502)
    return risposta({ partito: true })
  } catch (e) {
    return no(`GitHub non risponde${e instanceof Error && e.message ? `: ${e.message}` : ''}`, 502)
  }
})
