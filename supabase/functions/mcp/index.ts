// ---------------------------------------------------------------------------
// Il server MCP di ODS Corsi: chi cura i conti collega Claude al suo account, e Claude registra in CONTABILITÀ
// le spese lette su fatture e scontrini dei fornitori, dopo il suo «ok».
//
// L'accesso è quello di Supabase (Authentication → OAuth Server): Claude chiede il token, la persona entra in ODS
// e dice CONSENTI (`/oauth/consent` nell'app), e da lì ogni chiamata porta il suo token. Qui non c'è la chiave
// `service_role`: il server legge e scrive col token di chi chiama, quindi valgono le stesse regole dell'app
// (`e_amministrazione()`, le funzioni di 59, 60 e 72). Le regole e il protocollo sono in src/lib/mcp.ts e
// src/lib/movimentiDallaChat.ts, provate da scripts/prova-mcp.mjs; qui solo Supabase.
//
// Si pubblica senza il controllo del token di Supabase (`--no-verify-jwt`): senza token deve rispondere questo
// server, col 401 che dice a Claude dove fare l'accesso. Il token lo controlla lui, a ogni richiesta.
//
//   node scripts/costruisci-mcp.mjs && supabase functions deploy mcp --no-verify-jwt --project-ref <id>
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'
// Generato da scripts/costruisci-mcp.mjs prima di pubblicare.
import { metadatiRisorsa, nonAutorizzato, rispondiMcp } from './regole.js'

const url = Deno.env.get('SUPABASE_URL')!
const pubblica = Deno.env.get('SUPABASE_ANON_KEY')!
const risorsa = `${url}/functions/v1/mcp`
const METADATI = `${risorsa}/.well-known/oauth-protected-resource`

const oggiARoma = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
const giorniPrima = (giorno: string, n: number) => new Date(Date.parse(`${giorno}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)

// Un errore di Supabase si lancia così com'è: lo traduce `testoDellErrore`, che non lo fa mai uscire grezzo.
const ok = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error
  return data
}

function apri(token: string) {
  const db = createClient(url, pubblica, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return {
    eAmministrazione: async () => ok(await db.rpc('e_amministrazione')) === true,
    async voci() {
      const righe = ok(await db.from('voci_contabili').select('id, nome, tipo, di_sistema, attiva')) as Array<{ id: string; nome: string; tipo: 'entrata' | 'uscita'; di_sistema: boolean; attiva: boolean }>
      return righe.map((r) => ({ id: r.id, nome: r.nome, tipo: r.tipo, diSistema: r.di_sistema, attiva: r.attiva }))
    },
    async casse() {
      const righe = ok(await db.from('casse').select('id, nome, saldo_iniziale, dal').order('nome')) as Array<{ id: string; nome: string; saldo_iniziale: number; dal: string | null }>
      return righe.map((r) => ({ id: r.id, nome: r.nome, saldoIniziale: r.saldo_iniziale, ...(r.dal ? { dal: r.dal } : {}) }))
    },
    async chiusure() {
      // Senza 60-chiusura-cassa.sql non ci sono giorni chiusi: il database lo ricontrolla comunque scrivendo.
      const { data, error } = await db.from('chiusure_cassa').select('id, cassa_id, dal, data, previsto, contato, differenza, chiusa_il, annullata_il')
      if (error) return []
      return (data as Array<{ id: string; cassa_id: string; dal: string; data: string; previsto: number; contato: number; differenza: number; chiusa_il: string; annullata_il: string | null }>).map((r) => ({
        id: r.id, cassaId: r.cassa_id, dal: r.dal, data: r.data, previsto: r.previsto, contato: r.contato, differenza: r.differenza, chiusaIl: r.chiusa_il,
        ...(r.annullata_il ? { annullataIl: r.annullata_il } : {}),
      }))
    },
    async simili(testo: string) {
      const righe = ok(await db.rpc('movimenti_simili', { testo })) as Array<{ id: string; data: string; tipo: string; importo: number; descrizione: string; voce: string; voce_id: string; voce_attiva: boolean; cassa: string }>
      return righe.map((r) => ({ id: r.id, data: r.data, tipo: r.tipo, importo: r.importo, descrizione: r.descrizione, voce: r.voce, voceId: r.voce_id, voceAttiva: r.voce_attiva, cassa: r.cassa }))
    },
    async uguali(c: { tipo: string; importo: number; data: string }) {
      const righe = ok(await db.from('movimenti').select('id, tipo, data, importo, descrizione, cassa_id, annullato_il')
        .eq('tipo', c.tipo).eq('importo', c.importo).gte('data', giorniPrima(c.data, 60)).lte('data', c.data)) as Array<{ id: string; tipo: string; data: string; importo: number; descrizione: string; cassa_id: string; annullato_il: string | null }>
      return righe.map((r) => ({ id: r.id, tipo: r.tipo, data: r.data, importo: r.importo, descrizione: r.descrizione, cassaId: r.cassa_id, annullato: r.annullato_il !== null }))
    },
    registra: async (dati: Record<string, unknown>) => ok(await db.rpc('registra_movimento_dalla_chat', { dati })) as { id: string },
  }
}

Deno.serve(async (req) => {
  if (new URL(req.url).pathname.endsWith('/.well-known/oauth-protected-resource')) {
    return new Response(JSON.stringify(metadatiRisorsa(risorsa, `${url}/auth/v1`)), { headers: { 'Content-Type': 'application/json' } })
  }
  // Un token scaduto o revocato è un 401, non un errore dello strumento: così Claude lo rinnova da solo.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s*/i, '').trim()
  if (token) {
    const { data } = await createClient(url, pubblica, { auth: { persistSession: false, autoRefreshToken: false } }).auth.getUser(token)
    if (!data.user) return nonAutorizzato(METADATI)
  }
  return rispondiMcp(req, { metadati: METADATI, apri, oggi: oggiARoma })
})
