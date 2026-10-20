import { oggiARoma, ultimaChiusura, type Cassa, type ChiusuraCassa, type VoceContabile } from './contabilita'
import {
  cosaNonVaDallaChat,
  doppioneDi,
  finestraDoppione,
  importoInCentesimi,
  MSG_AMMINISTRAZIONE,
  testoDellErrore,
  voceProposta,
  vociPerLaChat,
  type MovimentoDallaChat,
  type MovimentoEsistente,
  type Simile,
} from './movimentiDallaChat'
import { dataRicevuta, euro } from './ricevute'

/**
 * Il server MCP di ODS Corsi (`supabase/functions/mcp`): Claude lo chiama col token della persona che si è
 * collegata, e ogni lettura e scrittura passa dalle regole del database come se fosse l'app. Il protocollo è
 * scritto qui a mano, senza dipendenze: JSON-RPC 2.0 su HTTP, una richiesta e una risposta in JSON, senza
 * sessione. Servono solo `initialize`, `ping`, `tools/list` e `tools/call`.
 *
 * Il database arriva da fuori (`apri`), così le prove (scripts/prova-mcp.mjs) lo fingono senza Deno né rete.
 */

// Il server Deno lo prende da qui, col resto delle regole: un «oggi a Roma» solo.
export { oggiARoma }

/** Un movimento come lo restituisce il database dopo averlo scritto. */
export interface MovimentoScritto {
  id: string
  tipo: string
  data: string
  importo: number
  descrizione: string
  voce_id: string
  cassa_id: string
}

/** Quel che il server legge e scrive, col token di chi chiama. */
export interface DatabaseChat {
  eAmministrazione(): Promise<boolean>
  voci(): Promise<VoceContabile[]>
  casse(): Promise<Cassa[]>
  chiusure(): Promise<ChiusuraCassa[]>
  simili(testo: string): Promise<Simile[]>
  /** I movimenti dello stesso tipo e importo da `dal` ad `al` compresi (vedi `finestraDoppione`). */
  uguali(cerca: { tipo: string; importo: number; dal: string; al: string }): Promise<MovimentoEsistente[]>
  /** Il movimento non annullato che chi chiama ha già scritto con questa chiave, se c'è. */
  perChiave(chiave: string): Promise<MovimentoScritto | null>
  registra(dati: { chiave: string; tipo: string; data: string; importo: number; voce_id: string; cassa_id: string; descrizione: string; nota?: string }): Promise<MovimentoScritto>
}

export interface OpzioniMcp {
  /** L'indirizzo dei metadati della risorsa (RFC 9728), da dove Claude scopre come fare l'accesso. */
  metadati: string
  apri: (token: string) => DatabaseChat
  oggi: () => string
}

const VERSIONI = ['2025-06-18', '2025-03-26', '2024-11-05']

/** Come Claude deve usare gli strumenti: le scelte della palestra, che valgono per ogni documento. */
const ISTRUZIONI = `Registri in CONTABILITÀ di ODS Corsi le spese e le entrate lette su fatture, ricevute e scontrini di FORNITORI.
- Prima di registrare mostra sempre il riepilogo (tipo, data, importo, voce, cassa, descrizione) e aspetta l'«ok» della persona.
- Solo documenti di fornitori. Ricevute a iscritti e compensi di istruttori non si registrano dalla chat: si fanno nell'app (PAGAMENTI o CONTABILITÀ).
- La data è il giorno in cui i soldi sono usciti o entrati, non quella della fattura. Se il documento ha solo la scadenza (bollette con addebito), chiedi quando è stato addebitato. Una fattura non ancora pagata non si registra: chiedi di riportarla quando è pagata.
- L'importo è quello pagato davvero: con la ritenuta d'acconto è il netto; la ritenuta si registra a parte quando si paga l'F24.
- La cassa: contanti → Cassa Contanti, tutto il resto (POS, bonifico, addebito) → Conto Corrente. Se il documento non lo dice, chiedi. Una spesa anticipata da un collaboratore non si registra ora: si registra il rimborso quando lo si paga.
- Un versamento in banca è un giroconto: non si registra dalla chat, si fa in CONTABILITÀ → Giroconto.
- Uno scontrino con spese di voci diverse: un movimento per voce, da confermare insieme.
- Descrizione: «Fornitore · documento n. · mese», per esempio «Enel · bolletta n. 123 · set 2026». Mai codice fiscale o IBAN.
- Prima di scegliere la voce chiama movimenti_simili col nome del fornitore. «Da classificare» solo se la persona la chiede.
- Dopo la registrazione di' cosa hai scritto e che si annulla da CONTABILITÀ → MOVIMENTI.`

const STRUMENTI = [
  {
    name: 'voci',
    title: 'Voci del bilancio',
    description: 'Le voci di entrata o di uscita che si possono scegliere, con il loro id. Gli incassi degli iscritti non ci sono: si registrano in PAGAMENTI.',
    inputSchema: { type: 'object', properties: { tipo: { type: 'string', enum: ['entrata', 'uscita'] } }, required: ['tipo'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'casse',
    title: 'Casse',
    description: 'Le casse (Cassa Contanti, Conto Corrente) con il loro id, da quando si contano e fino a quando sono chiuse.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'movimenti_simili',
    title: 'Movimenti simili',
    description: 'Gli ultimi movimenti con questo testo nella descrizione (di solito il fornitore) e la voce usata l’ultima volta.',
    inputSchema: { type: 'object', properties: { testo: { type: 'string', description: 'Il fornitore, per esempio «Enel».' } }, required: ['testo'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'registra_movimento',
    title: 'Registra il movimento',
    description:
      'Registra un’entrata o un’uscita, solo dopo l’«ok» della persona sul riepilogo. Se c’è già un movimento che sembra lo stesso non scrive e lo dice: si chiede alla persona e, se è un altro, si riprova con confermo_doppione.',
    inputSchema: {
      type: 'object',
      properties: {
        chiave: { type: 'string', description: 'Un identificativo nuovo per ogni movimento, lo stesso se si riprova: lo stesso movimento non si scrive due volte.' },
        tipo: { type: 'string', enum: ['entrata', 'uscita'] },
        data: { type: 'string', description: 'AAAA-MM-GG: il giorno in cui i soldi sono usciti o entrati.' },
        importo: { type: 'string', description: 'In euro, come sul documento, per esempio «312,40».' },
        voce_id: { type: 'string' },
        cassa_id: { type: 'string' },
        descrizione: { type: 'string', description: '«Fornitore · documento n. · mese», senza codice fiscale né IBAN.' },
        nota: { type: 'string' },
        fornitore: { type: 'string', description: 'Il nome del fornitore, per riconoscere la stessa fattura già registrata.' },
        confermo_doppione: { type: 'boolean', description: 'Vero solo se la persona ha detto che non è il movimento già registrato.' },
      },
      required: ['chiave', 'tipo', 'data', 'importo', 'voce_id', 'cassa_id', 'descrizione'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
]

type Id = string | number | null
type Argomenti = Record<string, unknown>

const json = (corpo: unknown, stato = 200, intestazioni: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status: stato, headers: { 'Content-Type': 'application/json', ...intestazioni } })
const risultato = (id: Id, result: unknown) => json({ jsonrpc: '2.0', id, result })
const errore = (id: Id, code: number, message: string) => json({ jsonrpc: '2.0', id, error: { code, message } })
const testo = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], isError })

/** Il 401 che fa partire l'accesso di Claude: dice dove sono i metadati della risorsa. */
export const nonAutorizzato = (metadati: string) =>
  json({ error: 'invalid_token', error_description: 'Accedi a ODS Corsi' }, 401, { 'WWW-Authenticate': `Bearer resource_metadata="${metadati}"` })

/** I metadati della risorsa (RFC 9728): chi rilascia i token per questo server. */
export const metadatiRisorsa = (risorsa: string, autorizzazione: string) => ({
  resource: risorsa,
  authorization_servers: [autorizzazione],
  bearer_methods_supported: ['header'],
  resource_name: 'ODS Corsi · contabilità',
})

const stringa = (x: unknown): string | undefined => (typeof x === 'string' ? x : undefined)

/** Un importo mandato come numero (12.34) diventa il testo all'italiana («12,34»): «12.345» si leggerebbe 12.345 euro. */
const importoDaNumero = (n: number): string =>
  Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 ? (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') : 'non è un importo'

function movimentoDa(a: Argomenti): MovimentoDallaChat {
  return {
    chiave: stringa(a.chiave),
    tipo: stringa(a.tipo),
    data: stringa(a.data),
    importo: typeof a.importo === 'number' ? importoDaNumero(a.importo) : stringa(a.importo),
    voce_id: stringa(a.voce_id),
    cassa_id: stringa(a.cassa_id),
    descrizione: stringa(a.descrizione),
    nota: stringa(a.nota),
    fornitore: stringa(a.fornitore),
    confermo_doppione: a.confermo_doppione === true,
  }
}

async function strumentoVoci(db: DatabaseChat, a: Argomenti) {
  const tipo = a.tipo
  if (tipo !== 'entrata' && tipo !== 'uscita') return testo('Scegli se è un’entrata o un’uscita', true)
  const righe = vociPerLaChat(await db.voci(), tipo).map((v) => `- ${v.nome} (id ${v.id})${v.soloSeLaChiedi ? ' · solo se la chiedi' : ''}`)
  return testo([`${tipo === 'uscita' ? 'Uscite' : 'Entrate'}:`, ...righe].join('\n'))
}

async function strumentoCasse(db: DatabaseChat) {
  const [casse, chiusure] = await Promise.all([db.casse(), db.chiusure()])
  const righe = casse.map((c) => {
    const k = ultimaChiusura(chiusure, c.id)
    return `- ${c.nome} (id ${c.id})${c.dal ? ` · si conta dal ${dataRicevuta(c.dal)}` : ''}${k ? ` · chiusa fino al ${dataRicevuta(k.data)}: in quei giorni non si registra` : ''}`
  })
  return testo(righe.join('\n'))
}

async function strumentoSimili(db: DatabaseChat, a: Argomenti) {
  const simili = await db.simili(stringa(a.testo) ?? '')
  if (!simili.length) return testo('Nessun movimento simile: è un fornitore nuovo, la voce la sceglie la persona.')
  const { proposta, avviso } = voceProposta(simili)
  return testo(
    [
      ...simili.map((s) => `- ${dataRicevuta(s.data)} · ${s.tipo} · ${euro(s.importo)} € · ${s.voce} · ${s.cassa} · ${s.descrizione}`),
      proposta ? `Voce proposta: ${proposta.nome} (id ${proposta.id}), l’ultima volta era lì.` : (avviso ?? 'Nessuna voce da proporre: la sceglie la persona.'),
    ].join('\n'),
  )
}

/** Cosa è stato scritto, dal movimento che il database restituisce: non da quel che Claude ha mandato. */
function registrato(r: MovimentoScritto, voci: VoceContabile[], casse: Cassa[]) {
  const voce = voci.find((v) => v.id === r.voce_id)?.nome ?? ''
  const cassa = casse.find((c) => c.id === r.cassa_id)?.nome ?? ''
  return testo(
    `Registrato: ${r.tipo === 'entrata' ? 'entrata' : 'uscita'} di ${euro(r.importo)} € del ${dataRicevuta(r.data)}, ${voce}, ${cassa}, «${r.descrizione}» (id ${r.id}). Se è sbagliato si annulla da CONTABILITÀ → MOVIMENTI.`,
  )
}

async function strumentoRegistra(db: DatabaseChat, a: Argomenti, oggi: string) {
  const m = movimentoDa(a)
  const chiave = m.chiave?.trim() ?? ''
  if (!chiave) return testo('Manca la chiave della registrazione: riprova dalla chat', true)
  const [voci, casse] = await Promise.all([db.voci(), db.casse()])
  // Claude riprova con la stessa chiave quando la risposta si è persa: era già registrato, e lo si dice,
  // prima dei controlli (adesso quel movimento è un doppione di sé stesso, o il giorno si è chiuso).
  const gia = await db.perChiave(chiave)
  if (gia) {
    const importo = importoInCentesimi(m.importo ?? '')
    const stesso = gia.tipo === m.tipo && 'centesimi' in importo && gia.importo === importo.centesimi && gia.descrizione === m.descrizione?.trim()
    return stesso ? registrato(gia, voci, casse) : testo('Questa registrazione c’è già con altri dati: riprova dalla chat', true)
  }
  const guaio = cosaNonVaDallaChat(m, { voci, casse, chiusure: await db.chiusure(), oggi })
  if (guaio) return testo(guaio, true)
  const importo = importoInCentesimi(m.importo ?? '')
  if ('errore' in importo) return testo(importo.errore, true)
  const base = { tipo: m.tipo ?? '', data: m.data ?? '', importo: importo.centesimi }
  if (!m.confermo_doppione) {
    const gia = doppioneDi({ ...base, fornitore: m.fornitore }, await db.uguali({ tipo: base.tipo, importo: base.importo, ...finestraDoppione(base.data) }), voci)
    if (gia)
      return testo(
        `Non ho registrato: c’è già un movimento che sembra lo stesso, ${dataRicevuta(gia.data)} · ${euro(gia.importo)} € · ${gia.descrizione}. Chiedi se è un altro: se sì, riprova con confermo_doppione.`,
        true,
      )
  }
  const nota = m.nota?.trim()
  const r = await db.registra({
    chiave,
    ...base,
    voce_id: m.voce_id ?? '',
    cassa_id: m.cassa_id ?? '',
    descrizione: (m.descrizione ?? '').trim(),
    ...(nota ? { nota } : {}),
  })
  return registrato(r, voci, casse)
}

async function chiama(db: DatabaseChat, nome: string, a: Argomenti, oggi: string) {
  try {
    if (!(await db.eAmministrazione())) return testo(MSG_AMMINISTRAZIONE, true)
    if (nome === 'voci') return await strumentoVoci(db, a)
    if (nome === 'casse') return await strumentoCasse(db)
    if (nome === 'movimenti_simili') return await strumentoSimili(db, a)
    if (nome === 'registra_movimento') return await strumentoRegistra(db, a, oggi)
    return testo(`Lo strumento «${nome}» non c’è`, true)
  } catch (e) {
    return testo(testoDellErrore(e), true)
  }
}

/** Una richiesta HTTP del protocollo MCP, la sua risposta. */
export async function rispondiMcp(req: Request, o: OpzioniMcp): Promise<Response> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s*/i, '').trim()
  if (!token) return nonAutorizzato(o.metadati)
  if (req.method !== 'POST') return json({ error: 'Solo POST' }, 405, { Allow: 'POST' })
  let msg: unknown
  try {
    msg = await req.json()
  } catch {
    return errore(null, -32700, 'Richiesta che non si capisce')
  }
  if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return errore(null, -32600, 'Una richiesta alla volta')
  // Un oggetto JSON: i campi si guardano uno a uno qui sotto, e restano `unknown` finché non si guardano.
  const { id, method, params } = msg as { id?: unknown; method?: unknown; params?: Argomenti }
  // Una notifica non ha risposta.
  if (id === undefined) return new Response(null, { status: 202 })
  if (id !== null && typeof id !== 'string' && typeof id !== 'number') return errore(null, -32600, 'L’id della richiesta non si capisce')
  if (method === 'initialize') {
    const chiesta = stringa(params?.protocolVersion)
    return risultato(id, {
      protocolVersion: chiesta && VERSIONI.includes(chiesta) ? chiesta : VERSIONI[0],
      capabilities: { tools: {} },
      serverInfo: { name: 'ods-corsi', title: 'ODS Corsi · contabilità', version: '1' },
      instructions: ISTRUZIONI,
    })
  }
  if (method === 'ping') return risultato(id, {})
  if (method === 'tools/list') return risultato(id, { tools: STRUMENTI })
  if (method === 'tools/call') {
    const nome = stringa(params?.name) ?? ''
    if (!STRUMENTI.some((s) => s.name === nome)) return errore(id, -32602, `Lo strumento «${nome}» non c’è`)
    // Gli argomenti si leggono uno a uno (`stringa`, `movimentoDa`): basta che sia un oggetto.
    const a = typeof params?.arguments === 'object' && params.arguments !== null ? (params.arguments as Argomenti) : {}
    return risultato(id, await chiama(o.apri(token), nome, a, o.oggi()))
  }
  return errore(id, -32601, 'Metodo che non c’è')
}

