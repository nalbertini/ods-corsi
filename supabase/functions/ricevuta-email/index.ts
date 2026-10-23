// ---------------------------------------------------------------------------
// La ricevuta per email: fatta la ricevuta (o premuto MANDA PER EMAIL), la
// famiglia la riceve in PDF all’email in scheda della persona della
// ricevuta, mai a quella di accesso (`76-ricevute-email.sql`).
//
//   corpo `{ ricevuta: uuid, pdf: base64 }`, col token di chi preme
//   → `{ esito: 'mandata', indirizzo?, registrata?: false }` o `{ guaio, tipo }` (tipo: un MotivoNonPartita di src/lib/ricevuteEmail.ts)
//
// L'indirizzo lo sceglie il database (`indirizzo_ricevuta`, solo service
// role): un indirizzo nel corpo si ignora. Chi può mandare e se la ricevuta si
// manda lo dice `controlla_invio_ricevuta`, chiamata col token di chi preme
// così vale il suo ruolo; ogni tentativo resta in `invii_ricevute` con
// `registra_invio_ricevuta`, che può chiamare solo il server (col client
// admin, passando chi ha premuto e l'indirizzo usato). A chi è partita lo si
// risponde solo alla segreteria. L'indirizzo non va mai nei log né nelle
// risposte d'errore. Le decisioni stanno in mail.ts (leggiCorpo,
// noDalControllo, decidiInvio, rispostaMandata), provate senza posta.
//
// Il PDF lo fa l'app (ricevutaPdf.ts), lo stesso che si scarica: qui si
// controlla solo che sia un PDF e non troppo grosso.
//
// Posta: Register.it, authsmtp.securemail.pro:465 (SSL), utente
// info@officinedellosport.it; 500 mail al giorno per casella, l'app ne usa al
// più 400 (il resto resta a inviti e reset).
//
// Segreto (Edge Functions → Secrets):
//   SMTP_PASSWORD  la password della casella info@officinedellosport.it.
//
// mail.ts è una copia di src/lib/ricevutaMail.ts (Deno non legge src/lib):
// si cambia là e si ricopia qui; `npm run prova:ricevute-email` controlla.
// Si pubblica con `supabase functions deploy ricevuta-email` (vedi `LEGGIMI.md`).
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'
import { decidiInvio, leggiCorpo, noDalControllo, rispostaMandata, testoMail, type ControlloInvio, type Rifiuto } from './mail.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MITTENTE = '"Officine Dello Sport" <info@officinedellosport.it>'

const risposta = (corpo: Record<string, unknown>, stato = 200) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { ...CORS, 'Content-Type': 'application/json' } })

const no = (r: Rifiuto) => risposta({ guaio: r.guaio, tipo: r.tipo }, r.stato)

/** L'impronta del PDF allegato: se un giorno serve, dice quale PDF è partito senza tenerne la copia. */
const impronta = async (pdf: string) => {
  const byte = Uint8Array.from(atob(pdf), (x) => x.charCodeAt(0))
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', byte))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Quello che dà `controlla_invio_ricevuta`: mai l'indirizzo. */
interface Controllo extends ControlloInvio {
  numero: number
  anno: number
  data: string
  totale: number
  nome: string
  cognome: string
  /** Chi ha premuto (`persona_corrente()`): va in `invii_ricevute.creato_da`. */
  persona: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return no({ guaio: 'Solo POST', stato: 405, tipo: 'posta' })

  const authorization = req.headers.get('Authorization') ?? ''
  if (!/^Bearer\s+\S/i.test(authorization)) return no({ guaio: 'Serve un accesso da segreteria', stato: 401, tipo: 'posta' })

  let letto: ReturnType<typeof leggiCorpo>
  try {
    letto = leggiCorpo(await req.json())
  } catch {
    return no({ guaio: 'Richiesta storta', stato: 400, tipo: 'posta' })
  }
  if ('guaio' in letto) return no(letto)
  const { ricevuta, pdf } = letto

  // `!`: SUPABASE_URL e le chiavi le mette Supabase in ogni funzione, come nelle altre.
  const url = Deno.env.get('SUPABASE_URL')!
  // Come chi preme: le regole sono quelle del database.
  const suo = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
  const { data, error } = await suo.rpc('controlla_invio_ricevuta', { ricevuta })
  if (error) return no(noDalControllo(error.code))
  // `as`: il jsonb di controlla_invio_ricevuta in 76-ricevute-email.sql, che il client non conosce.
  const c = data as Controllo

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const sha = await impronta(pdf)
  // Ogni tentativo resta, col motivo corto. Solo il server registra: chi preme e l'indirizzo li passa lui.
  const registra = async (esito: 'mandata' | 'non partita', motivo: string | null, indirizzo: string | null) => {
    const { error: e } = await admin.rpc('registra_invio_ricevuta', { ricevuta, esito, motivo, da: c.persona, indirizzo, pdf_sha256: sha })
    if (e) console.error('ricevuta-email: tentativo non registrato', ricevuta, e.code)
    return !e
  }

  const { data: trovato, error: senza } = await admin.rpc('indirizzo_ricevuta', { ricevuta })
  if (senza) {
    console.error('ricevuta-email: email in scheda non letta', ricevuta, senza.code)
    await registra('non partita', `indirizzo ${senza.code ?? 'sconosciuto'}`.slice(0, 60), null)
    return no({ guaio: 'La mail non è partita', stato: 502, tipo: 'posta' })
  }
  const password = Deno.env.get('SMTP_PASSWORD')
  const indirizzo = typeof trovato === 'string' ? trovato : null
  const d = decidiInvio(c, indirizzo, !!password)
  if (!d.manda) {
    if (d.registra) await registra('non partita', d.registra, indirizzo)
    return no(d)
  }
  // shortcut: la soglia di 400 è contata prima di mandare, quindi due invii insieme alla 399ª la passano di uno; basta finché le mail sono una per ricevuta fatta al banco, se diventano a lotti serve un contatore con lock.

  const t = testoMail({ numero: c.numero, anno: c.anno, data: c.data, totale: c.totale, intestatario: { nome: c.nome, cognome: c.cognome } })
  const posta = nodemailer.createTransport({
    host: 'authsmtp.securemail.pro',
    port: 465,
    secure: true,
    auth: { user: 'info@officinedellosport.it', pass: password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })
  try {
    await posta.sendMail({
      from: MITTENTE,
      to: d.a,
      subject: t.oggetto,
      text: t.testo,
      html: t.html,
      attachments: [{ filename: t.allegato, content: pdf, encoding: 'base64', contentType: 'application/pdf' }],
    })
  } catch (e) {
    // Solo il codice: il messaggio del server di posta può contenere l'indirizzo.
    const dato = (k: string) => (e && typeof e === 'object' && k in e ? Reflect.get(e, k) : undefined)
    const codice = String(dato('responseCode') ?? dato('code') ?? 'sconosciuto').slice(0, 40)
    console.error('ricevuta-email: non partita', ricevuta, codice)
    await registra('non partita', `posta ${codice}`, d.a)
    return no({ guaio: 'La mail non è partita', stato: 502, tipo: 'posta' })
  }
  // La mail è partita: la riga deve restare. Un secondo tentativo, poi lo si dice all'app.
  const registrata = (await registra('mandata', null, d.a)) || (await registra('mandata', null, d.a))
  return risposta(rispostaMandata(c, d.a, registrata))
})
