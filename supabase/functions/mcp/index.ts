// ---------------------------------------------------------------------------
// Il server MCP di ODS Corsi: chi cura i conti collega Claude al suo account, e Claude registra in CONTABILITÀ
// le spese lette su fatture e scontrini dei fornitori, dopo il suo «ok».
//
// L'accesso è quello di Supabase (Authentication → OAuth Server): Claude chiede il token, la persona entra in ODS
// e dice CONSENTI (la pagina `collega/` dell'app), e da lì ogni chiamata porta il suo token. Qui non c'è la chiave
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
import { metadatiRisorsa, nonAutorizzato, oggiARoma, rispondiMcp, tutteLeRighe } from './regole.js'

// Supabase le mette sempre in ogni funzione: senza, la funzione non serve a niente e lo dice subito.
const url = Deno.env.get('SUPABASE_URL') ?? ''
const pubblica = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
if (!url || !pubblica) throw new Error('Mancano SUPABASE_URL e SUPABASE_ANON_KEY')
const risorsa = `${url}/functions/v1/mcp`
const METADATI = `${risorsa}/.well-known/oauth-protected-resource`


// Un errore di Supabase si lancia così com'è: lo traduce `testoDellErrore`, che non lo fa mai uscire grezzo.
const ok = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error
  return data
}

// `utente` è l'account del token: la chiave di una registrazione vale solo per i suoi movimenti.
type MovimentoScritto = { id: string; tipo: string; data: string; importo: number; descrizione: string; voce_id: string; cassa_id: string }
const COLONNE = 'id, tipo, data, importo, descrizione, voce_id, cassa_id'

function apri(token: string, utente: string) {
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
      const righe = ok(await db.from('chiusure_cassa').select('id, cassa_id, dal, data, previsto, contato, differenza, chiusa_il, annullata_il'))
      return (righe as Array<{ id: string; cassa_id: string; dal: string; data: string; previsto: number; contato: number; differenza: number; chiusa_il: string; annullata_il: string | null }>).map((r) => ({
        id: r.id, cassaId: r.cassa_id, dal: r.dal, data: r.data, previsto: r.previsto, contato: r.contato, differenza: r.differenza, chiusaIl: r.chiusa_il,
        ...(r.annullata_il ? { annullataIl: r.annullata_il } : {}),
      }))
    },
    async simili(testo: string) {
      const righe = ok(await db.rpc('movimenti_simili', { testo })) as Array<{ id: string; data: string; tipo: string; importo: number; descrizione: string; voce: string; voce_id: string; voce_attiva: boolean; cassa: string }>
      return righe.map((r) => ({ id: r.id, data: r.data, tipo: r.tipo, importo: r.importo, descrizione: r.descrizione, voce: r.voce, voceId: r.voce_id, voceAttiva: r.voce_attiva, cassa: r.cassa }))
    },
    async uguali(c: { tipo: string; importo: number; dal: string; al: string }) {
      const righe = ok(await db.from('movimenti').select('id, tipo, data, importo, descrizione, voce_id, persona_id, annullato_il')
        .eq('tipo', c.tipo).eq('importo', c.importo).gte('data', c.dal).lte('data', c.al)) as Array<{ id: string; tipo: string; data: string; importo: number; descrizione: string; voce_id: string | null; persona_id: string | null; annullato_il: string | null }>
      return righe.map((r) => ({ id: r.id, tipo: r.tipo, data: r.data, importo: r.importo, descrizione: r.descrizione, voceId: r.voce_id ?? '', personaId: r.persona_id, annullato: r.annullato_il !== null }))
    },
    async perChiave(chiave: string) {
      const chi = ok(await db.from('persone').select('id').eq('utente_id', utente).maybeSingle()) as { id: string } | null
      if (!chi) return null
      return ok(await db.from('movimenti').select(COLONNE).eq('chiave_chat', chiave).eq('creato_da', chi.id).is('annullato_il', null).maybeSingle()) as MovimentoScritto | null
    },
    // Le letture dei conti: tutte le righe (lo storico supera le 1000 di una pagina), con le sole colonne che servono.
    async movimenti() {
      const righe = ok(await tutteLeRighe((da: number, a: number) => db.from('movimenti').select('id, tipo, data, importo, voce_id, cassa_id, cassa_a_id, descrizione, creato_il, annullato_il, origine_import, persona_id').order('id').range(da, a))) as Array<{
        id: string; tipo: 'entrata' | 'uscita' | 'giroconto'; data: string; importo: number; voce_id: string | null; cassa_id: string; cassa_a_id: string | null
        descrizione: string; creato_il: string; annullato_il: string | null; origine_import: string | null; persona_id: string | null
      }>
      return righe.map((r) => ({
        id: r.id, tipo: r.tipo, data: r.data, importo: r.importo, cassaId: r.cassa_id, descrizione: r.descrizione, creatoIl: r.creato_il,
        ...(r.voce_id ? { voceId: r.voce_id } : {}),
        ...(r.cassa_a_id ? { cassaAId: r.cassa_a_id } : {}),
        ...(r.annullato_il ? { annullatoIl: r.annullato_il } : {}),
        ...(r.origine_import ? { origineImport: r.origine_import } : {}),
        ...(r.persona_id ? { personaId: r.persona_id } : {}),
      }))
    },
    // Gli incassi degli iscritti: mai intestatario, ente, note o persona; delle ricevute solo le voci coi loro pagamenti.
    async incassi() {
      const [ricevute, diretti] = await Promise.all([
        tutteLeRighe((da: number, a: number) => db.from('ricevute').select('id, voci, annullata_il').order('id').range(da, a)),
        tutteLeRighe((da: number, a: number) => db.from('pagamenti_diretti').select('id, data, importo, metodo, voce, annullato_il').order('id').range(da, a)),
      ])
      const r = ok(ricevute) as Array<{ voci: Array<{ descrizione: string; pagamenti: Array<{ data: string; importo: number; metodo: string }> }>; annullata_il: string | null }>
      const d = ok(diretti) as Array<{ data: string; importo: number; metodo: string; voce: string; annullato_il: string | null }>
      return [
        ...r.flatMap((x) => x.voci.flatMap((v) => v.pagamenti.map((p) => ({ data: p.data, importo: p.importo, metodo: p.metodo, voce: v.descrizione, annullato: x.annullata_il !== null })))),
        ...d.map((x) => ({ data: x.data, importo: x.importo, metodo: x.metodo, voce: x.voce, annullato: x.annullato_il !== null })),
      ]
    },
    registra: async (dati: Record<string, unknown>) => {
      const r = ok(await db.rpc('registra_movimento_dalla_chat', { dati })) as MovimentoScritto
      return { id: r.id, tipo: r.tipo, data: r.data, importo: r.importo, descrizione: r.descrizione, voce_id: r.voce_id, cassa_id: r.cassa_id }
    },
  }
}

Deno.serve(async (req) => {
  if (new URL(req.url).pathname.endsWith('/.well-known/oauth-protected-resource')) {
    return new Response(JSON.stringify(metadatiRisorsa(risorsa, `${url}/auth/v1`)), { headers: { 'Content-Type': 'application/json' } })
  }
  // Un token scaduto o revocato è un 401, non un errore dello strumento: così Claude lo rinnova da solo.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s*/i, '').trim()
  let utente = ''
  if (token) {
    const { data } = await createClient(url, pubblica, { auth: { persistSession: false, autoRefreshToken: false } }).auth.getUser(token)
    if (!data.user) return nonAutorizzato(METADATI)
    utente = data.user.id
  }
  return rispondiMcp(req, { metadati: METADATI, apri: (t: string) => apri(t, utente), oggi: () => oggiARoma() })
})
