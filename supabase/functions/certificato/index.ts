// ---------------------------------------------------------------------------
// Il certificato dal link, senza password (`142-certificato-link.sql`).
//
// Il link è `…/certificato/?l=<id>.<firma>`: la firma è l'HMAC-SHA256 dell'id
// col segreto `LINK_SEGRETO`, che sta solo qui. Nel database c'è solo l'id.
// Cambiare il segreto spegne tutti i link già mandati.
//
//   GET  ?l=<codice>                 cosa dice la pagina: nome, tipo, entro
//   POST multipart l, scade, file    il file in attesa, con la chiave di servizio
//   POST JSON { persona } + accesso  la segreteria chiede il link firmato
//
// Si pubblica con `supabase functions deploy certificato --no-verify-jwt`: chi
// apre il link non ha un accesso, lo protegge la firma. Nei log mai l'id della
// persona, il nome o il codice del link.
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const risposta = (corpo: Record<string, unknown>, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const no = (guaio: string, stato: number) => risposta({ guaio }, stato)

// Gli stessi tipi e lo stesso limite dell'area iscritti (`ESTENSIONI_MANDATO`, `MASSIMO_MANDATO` in src/lib/certificatoIscritto.ts).
const ESTENSIONI: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }
const MASSIMO = 5 * 1024 * 1024

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const CODICE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/

const base64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function firma(id: string): Promise<string> {
  const chiave = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('LINK_SEGRETO') ?? ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return base64url(await crypto.subtle.sign('HMAC', chiave, new TextEncoder().encode(id)))
}

// In tempo costante: la firma non si indovina un carattere alla volta.
function uguali(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

/** L'id del link, se il codice è suo; se no null. */
async function idDi(codice: string | null): Promise<string | null> {
  const m = CODICE.exec(codice ?? '')
  if (!m || !Deno.env.get('LINK_SEGRETO')) return null
  return uguali(await firma(m[1]), m[2]) ? m[1] : null
}

// shortcut: il conto vive nella singola istanza della funzione, che Supabase può moltiplicare; se servisse un tetto vero, una tabella.
const invii = new Map<string, number[]>()
function troppi(id: string): boolean {
  const ora = Date.now()
  // Un'istanza che vive a lungo non si tiene i link di ieri.
  if (invii.size > 1000) invii.clear()
  const suoi = (invii.get(id) ?? []).filter((t) => ora - t < 60_000)
  suoi.push(ora)
  invii.set(id, suoi)
  return suoi.length > 10
}

const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })

interface Info {
  persona_id: string | null
  stato: 'valido' | 'arrivato' | 'non_vale'
  nome: string | null
  iniziale: string | null
  tipo: 'normale' | 'agonistico' | null
  entro: string | null
}

async function apri(id: string): Promise<Info | null> {
  const { data, error } = await admin().rpc('link_certificato_apri', { link: id })
  if (error) {
    console.error('link_certificato_apri', error.code)
    return null
  }
  // `as`: link_certificato_apri() rende sempre una riga di questa forma (142-certificato-link.sql).
  return ((data as Info[] | null) ?? [])[0] ?? null
}

/** Quel che la pagina può sapere: mai l'id della persona. */
const perLaPagina = (i: Info) =>
  i.stato === 'valido' ? { stato: i.stato, nome: i.nome, iniziale: i.iniziale, tipo: i.tipo, entro: i.entro } : i.stato === 'arrivato' ? { stato: i.stato, nome: i.nome } : { stato: i.stato }

async function linkPerLaSegreteria(req: Request, authorization: string) {
  let corpo: { persona?: unknown } | null
  try {
    corpo = await req.json()
  } catch {
    return no('Richiesta storta', 400)
  }
  if (typeof corpo?.persona !== 'string' || !UUID.test(corpo.persona)) return no('Manca la persona', 400)
  if (!Deno.env.get('LINK_SEGRETO')) return no('Manca LINK_SEGRETO nella funzione certificato: vedi supabase/LEGGIMI.md', 501)
  // Come chi chiama: che sia della segreteria lo dice il database.
  const suo = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
  const { data, error } = await suo.rpc('link_certificato_per', { persona: corpo.persona })
  if (error) {
    if (error.code === 'PGRST202') return no('Per il link va lanciato 142-certificato-link.sql: vedi supabase/LEGGIMI.md', 501)
    if (error.code === '42501') return no('Il link lo chiede la segreteria', 403)
    if (error.code === 'P0002') return no('La scheda non c’è o è disattivata', 404)
    console.error('link_certificato_per', error.code)
    return no('Il link non si è preparato: riprova fra poco', 500)
  }
  if (typeof data !== 'string') return no('Il link non si è preparato: riprova fra poco', 500)
  const id = data
  return risposta({ codice: `${id}.${await firma(id)}`, id })
}

async function manda(req: Request) {
  let modulo: FormData
  try {
    modulo = await req.formData()
  } catch {
    return no('Richiesta storta', 400)
  }
  const l = modulo.get('l')
  const id = await idDi(typeof l === 'string' ? l : null)
  if (!id) return risposta({ stato: 'non_vale' }, 410)
  if (troppi(id)) return no('Troppi invii in un minuto: aspetta un momento e riprova.', 429)
  const info = await apri(id)
  if (!info) return no('Non è partito: riprova fra poco.', 500)
  if (info.stato !== 'valido' || !info.persona_id) return risposta(perLaPagina(info), 410)

  const file = modulo.get('file')
  const scade = modulo.get('scade')
  if (!(file instanceof File)) return no('Scegli la foto o il PDF del certificato.', 400)
  const estensione = ESTENSIONI[file.type]
  if (!estensione) return no('Questo tipo di file non va: serve una foto o un PDF', 400)
  if (file.size === 0) return no('Il file è vuoto: scegline un altro', 400)
  if (file.size > MASSIMO) return no('Il file è troppo grande: al massimo 5 MB', 400)
  if (typeof scade !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(scade)) return no('Scrivi quando scade il certificato.', 400)

  const db = admin()
  const nome = `${info.persona_id}/attesa-${Date.now()}.${estensione}`
  const su = await db.storage.from('certificati').upload(nome, file, { contentType: file.type, upsert: false })
  if (su.error) {
    // Il messaggio dello storage ha dentro il percorso, cioè l'id della persona: non si scrive.
    console.error('upload non riuscito')
    return no('Il file non è partito: riprova fra poco.', 500)
  }
  const { error } = await db.rpc('link_manda_certificato', { link: id, file: nome, scade })
  if (error) {
    // Il file non è in attesa: non deve restare nello storage.
    await db.storage.from('certificati').remove([nome])
    if (error.code === '22023') return no(error.message, 400)
    if (error.code === '42501') return risposta({ stato: 'non_vale', guaio: error.message }, 410)
    console.error('link_manda_certificato', error.code)
    return no('Non è partito: riprova fra poco.', 500)
  }
  return risposta({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method === 'GET') {
    const id = await idDi(new URL(req.url).searchParams.get('l'))
    if (!id) return risposta({ stato: 'non_vale' })
    const info = await apri(id)
    return info ? risposta(perLaPagina(info)) : no('La pagina non si è aperta: riprova fra poco.', 500)
  }
  if (req.method !== 'POST') return no('Solo GET e POST', 405)
  if ((req.headers.get('Content-Type') ?? '').includes('application/json')) {
    const authorization = req.headers.get('Authorization') ?? ''
    if (!/^Bearer\s+\S/i.test(authorization)) return no('Serve un accesso da segreteria', 401)
    return linkPerLaSegreteria(req, authorization)
  }
  return manda(req)
})
