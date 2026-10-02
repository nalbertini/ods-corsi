// ---------------------------------------------------------------------------
// Il backup del database dalla segreteria: IMPOSTAZIONI → IL BACKUP.
//
// La copia la fa GitHub Actions (`.github/workflows/backup.yml`), ogni lunedì
// e quando la si chiede. Per chiederla, e per scaricare le copie, serve un
// token di GitHub: nell'app non può stare (il codice è pubblico), qui sì,
// fra i segreti della funzione. Chi la chiama deve essere della segreteria.
//
//   · `elenco`  → le copie che GitHub tiene, dalla più recente, e com'è
//                 andato l'ultimo lancio;
//   · `avvia`   → fa partire una copia adesso;
//   · `scarica` → l'indirizzo, che vale un minuto, da cui il browser scarica
//                 una copia: uno zip con dentro il file cifrato, da mettere
//                 su Drive così com'è.
//
// Segreti da impostare (Edge Functions → Secrets):
//   GITHUB_TOKEN  un token *fine-grained* solo per questo repository, con
//                 «Actions: Read and write» e nient'altro;
//   GITHUB_REPO   facoltativo, `proprietario/nome`; di solito non serve.
//
// Si pubblica con `supabase functions deploy backup` (vedi `LEGGIMI.md`).
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const WORKFLOW = 'backup.yml'
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

  const gh = Deno.env.get('GITHUB_TOKEN')
  if (!gh) return no('Manca il token di GitHub fra i segreti della funzione: vedi supabase/LEGGIMI.md, «Il backup»', 501)
  const repo = Deno.env.get('GITHUB_REPO') || 'nalbertini/ods-corsi'
  const api = (strada: string, init: RequestInit = {}) =>
    fetch(`https://api.github.com/repos/${repo}${strada}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${gh}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ods-corsi-backup',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })

  let corpo: { azione?: unknown; id?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return no('Richiesta storta', 400)
  }

  try {
    if (corpo.azione === 'elenco') {
      const [r1, r2] = await Promise.all([api('/actions/artifacts?per_page=100'), api(`/actions/workflows/${WORKFLOW}/runs?per_page=1`)])
      if (!r1.ok) return no(await detto(r1), 502)
      const { artifacts } = (await r1.json()) as { artifacts: Artefatto[] }
      const copie = artifacts
        .filter((a) => a.name.startsWith('backup-') && !a.expired)
        .map((a) => ({ id: a.id, giorno: a.name.slice('backup-'.length), byte: a.size_in_bytes, scade: a.expires_at }))
        .sort((a, b) => b.giorno.localeCompare(a.giorno))
      // Il workflow che non c'è ancora su main (404) non è un guaio: nessun lancio.
      let ultimo = null
      if (r2.ok) {
        const { workflow_runs } = (await r2.json()) as { workflow_runs: Lancio[] }
        const l = workflow_runs[0]
        if (l)
          ultimo = {
            stato: l.status !== 'completed' ? 'in_corso' : l.conclusion === 'success' ? 'riuscito' : 'fallito',
            quando: l.run_started_at ?? l.created_at,
            link: l.html_url,
          }
      } else if (r2.status !== 404) return no(await detto(r2), 502)
      return risposta({ copie, ultimo })
    }

    if (corpo.azione === 'avvia') {
      // Una per volta: GitHub la metterebbe in coda, ma la segreteria vuole saperlo.
      const r = await api(`/actions/workflows/${WORKFLOW}/runs?per_page=5`)
      if (r.ok) {
        const { workflow_runs } = (await r.json()) as { workflow_runs: Lancio[] }
        if (workflow_runs.some((l) => l.status !== 'completed')) return no('C’è già un backup in corso: fra qualche minuto è nell’elenco', 409)
      }
      const d = await api(`/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: RAMO }) })
      if (d.status === 404) return no('GitHub non trova il workflow del backup su main: vedi supabase/LEGGIMI.md, «Il backup»', 502)
      if (!d.ok) return no(await detto(d), 502)
      return risposta({ partito: true })
    }

    if (corpo.azione === 'scarica') {
      if (typeof corpo.id !== 'number') return no('Manca la copia da scaricare', 400)
      // Solo le copie del backup: la funzione non scarica altri artefatti.
      const a = await api(`/actions/artifacts/${corpo.id}`)
      if (!a.ok) return no(a.status === 404 ? 'Questa copia non c’è più' : await detto(a), a.status === 404 ? 404 : 502)
      const art = (await a.json()) as Artefatto
      if (!art.name.startsWith('backup-')) return no('Non è una copia del backup', 400)
      if (art.expired) return no('Questa copia è scaduta: GitHub l’ha già tolta', 410)
      const z = await api(`/actions/artifacts/${corpo.id}/zip`, { redirect: 'manual' })
      const link = z.headers.get('Location')
      if (z.status !== 302 || !link) return no(await detto(z), 502)
      return risposta({ link, nome: `${art.name}.zip` })
    }

    return no('Azione sconosciuta', 400)
  } catch (e) {
    return no(`GitHub non risponde${e instanceof Error && e.message ? `: ${e.message}` : ''}`, 502)
  }
})

type Artefatto = { id: number; name: string; size_in_bytes: number; expired: boolean; expires_at: string }
type Lancio = { status: string; conclusion: string | null; created_at: string; run_started_at?: string; html_url: string }

/** Una risposta storta di GitHub detta per la segreteria. */
async function detto(r: Response): Promise<string> {
  if (r.status === 401) return 'GitHub non accetta il token: è scaduto o è sbagliato (vedi supabase/LEGGIMI.md, «Il backup»)'
  if (r.status === 403) return 'Il token di GitHub non ha il permesso «Actions: Read and write» su questo repository'
  let m = ''
  try {
    m = ((await r.json()) as { message?: string }).message ?? ''
  } catch {
    // Non è JSON: basta lo stato.
  }
  return `GitHub ha risposto ${r.status}${m ? `: ${m}` : ''}`
}
