// ---------------------------------------------------------------------------
// Gli avvisi alla segreteria: un'email quando arriva una richiesta di
// iscrizione, un pagamento Satispay (`84-avvisi-segreteria.sql`) o un
// certificato mandato dall'area iscritti (`139-avviso-certificato.sql`, che si
// lancia dopo aver pubblicato questa funzione). E i solleciti del certificato
// alle famiglie (`143-solleciti-certificato.sql`): a chi lo dice il database,
// coi link firmati qui col segreto della funzione `certificato` (LINK_SEGRETO).
//
//   POST (corpo ignorato) → `{ mandati, guasti }`
//
// La chiama pg_cron ogni cinque minuti (pg_net, nel file 84). Non riceve
// niente: cosa mandare, a chi e in copia a chi lo dice il database
// (`avvisi_da_mandare`, solo service role). Ogni avviso si prende
// (`avviso_preso`) prima di mandarlo e si segna partito dopo
// (`avviso_mandato`): due chiamate insieme non mandano la stessa mail, e
// chiamarla di nuovo non fa partire niente di più. Per questo si pubblica
// senza token (`--no-verify-jwt`), come `satispay`. Un avviso che non parte si
// riprende dieci minuti dopo; dopo dodici volte il database lo chiude.

//
// Posta: la stessa casella di `ricevuta-email` (Register.it, SMTP_PASSWORD).
// Nei log mai indirizzi né nomi.
//
// mail.ts è una copia di src/lib/avvisoSegreteria.ts (Deno non legge src/lib):
// si cambia là e si ricopia qui; `npm run prova:avvisi-segreteria` controlla.
// Si pubblica con `supabase functions deploy avvisi-segreteria --no-verify-jwt`.
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'
import { MITTENTE, testoAvviso, type Avviso } from './mail.ts'

/** La segreteria pubblicata: i link della mail aprono lì la richiesta. */
const APP = 'https://app.officinedellosport.it/segreteria/'
/** La pagina del link del certificato (area `certificato`). */
const PAGINA_LINK = 'https://app.officinedellosport.it/certificato/?l='

const base64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Il link firmato come in supabase/functions/certificato/index.ts: `<id>.<HMAC-SHA256 dell'id>`. */
async function linkFirmato(id: string, segreto: string): Promise<string> {
  const chiave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return `${PAGINA_LINK}${id}.${base64url(await crypto.subtle.sign('HMAC', chiave, new TextEncoder().encode(id)))}`
}

/** Il database dà l'id del link; la mail vuole il link firmato. */
type DalDatabase = Exclude<Avviso, { tipo: 'sollecito_certificato' }> | { tipo: 'sollecito_certificato'; oggetto: string; testo: string; persone: { nome: string; entro: string; linkId: string }[] }

const risposta = (corpo: Record<string, unknown>, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async () => {
  const password = Deno.env.get('SMTP_PASSWORD')
  if (!password) return risposta({ guaio: 'manca SMTP_PASSWORD' }, 500)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })

  const pronti = await db.rpc('avvisi_da_mandare')
  // Senza il file 84 la funzione non c'è: niente da mandare, nessun guaio. Ogni altro errore ferma gli avvisi: si dice.
  if (pronti.error?.code === 'PGRST202' || pronti.error?.code === '42883') return risposta({ mandati: 0, guasti: 0 })
  if (pronti.error) {
    console.error('avvisi_da_mandare', pronti.error.code)
    return risposta({ guaio: pronti.error.code }, 500)
  }
  // as: la forma di `avvisi_da_mandare()` (84, 143), che il client non conosce.
  const avvisi = (pronti.data ?? []) as Array<{ id: string; a: string | null; cc: string | null; avviso: DalDatabase }>
  if (!avvisi.length) return risposta({ mandati: 0, guasti: 0 })

  const posta = nodemailer.createTransport({
    host: 'authsmtp.securemail.pro',
    port: 465,
    secure: true,
    auth: { user: 'info@officinedellosport.it', pass: password },
  })
  let mandati = 0
  let guasti = 0
  for (const x of avvisi) {
    // Senza indirizzo il database non lo dà (resta `a_mano`): qui solo per il tipo.
    if (!x.a) continue
    let avviso: Avviso
    if (x.avviso.tipo === 'sollecito_certificato') {
      // Senza il segreto i link non si aprirebbero: meglio non mandare e dirlo.
      const segreto = Deno.env.get('LINK_SEGRETO')
      if (!segreto) {
        console.error('sollecito', x.id, 'manca LINK_SEGRETO')
        guasti++
        continue
      }
      const persone = await Promise.all(x.avviso.persone.map(async (p) => ({ nome: p.nome, entro: p.entro, link: await linkFirmato(p.linkId, segreto) })))
      avviso = { tipo: 'sollecito_certificato', oggetto: x.avviso.oggetto, testo: x.avviso.testo, persone }
    } else avviso = x.avviso
    // Un'altra chiamata l'ha già preso, o la posta l'ha rifiutato troppe volte.
    const preso = await db.rpc('avviso_preso', { avviso: x.id })
    if (preso.error || preso.data !== true) continue
    const t = testoAvviso(avviso, APP)
    try {
      await posta.sendMail({ from: MITTENTE, to: x.a, ...(x.cc && { cc: x.cc }), subject: t.oggetto, text: t.testo, html: t.html })
    } catch (e) {
      // Solo il codice: il messaggio del server di posta può contenere l'indirizzo.
      console.error('avviso', x.id, 'non partito', (e as { code?: string })?.code ?? '')
      guasti++
      continue
    }
    mandati++
    // Non segnato, ripartirebbe dieci minuti dopo: meglio fermare il giro e dirlo.
    const segnato = await db.rpc('avviso_mandato', { avviso: x.id })
    if (segnato.error) {
      console.error('avviso', x.id, 'partito ma non segnato', segnato.error.code)
      break
    }
  }
  return risposta({ mandati, guasti })
})
