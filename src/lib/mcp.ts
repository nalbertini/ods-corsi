import { bilancioAnno, contiPeriodo, gruppiDaClassificare, importoConMeno, periodoInParole, variazione } from './bilancio'
import {
  chiusuraDaRiga,
  dataVera,
  incassiDaRighe,
  incassiPerConti,
  oggiARoma,
  righeMovimenti,
  saldiCasse,
  ultimaChiusura,
  type Cassa,
  type ChiusuraCassa,
  type IncassoPerConti,
  type MovimentoManuale,
  type VoceContabile,
} from './contabilita'
import { VOCE_DA_CLASSIFICARE } from './importaPrimaNota'
import { tutteLeRighe } from './tutteLeRighe'
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
import {
  CHAT_SEGRETERIA_ACCESA,
  corsoDa,
  erroreSegreteria,
  MSG_SEGRETERIA,
  testoChiManca,
  testoCertificati,
  testoIscritti,
  testoPresenze,
  testoQuote,
  type AppelloChat,
  type CorsoChat,
  type IscrittoChat,
  type ProvaChat,
} from './chatSegreteria'

/**
 * Il server MCP di ODS Corsi (`supabase/functions/mcp`): Claude lo chiama col token della persona che si è
 * collegata, e ogni lettura e scrittura passa dalle regole del database come se fosse l'app. Gli strumenti sono quelli
 * del suo ruolo: la contabilità per l'amministrazione, le domande sugli iscritti per la segreteria (`chatSegreteria.ts`,
 * finché è accesa), tutti e due per chi li ha tutti e due. Il protocollo è
 * scritto qui a mano, senza dipendenze: JSON-RPC 2.0 su HTTP, una richiesta e una risposta in JSON, senza
 * sessione. Servono solo `initialize`, `ping`, `tools/list` e `tools/call`.
 *
 * Il database arriva da fuori (`apri`), così le prove (scripts/prova-mcp.mjs) lo fingono senza Deno né rete.
 */

// Il server Deno li prende da qui, col resto delle regole: un «oggi a Roma» solo, e la lettura a pagine dell'app.
export { chiusuraDaRiga, incassiDaRighe, oggiARoma, tutteLeRighe }

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
  /** I movimenti scritti a mano, senza la nota (per i conti non serve, e uscirebbe verso Claude). */
  movimenti(): Promise<MovimentoManuale[]>
  /** Gli incassi degli iscritti, senza chi ha pagato. */
  incassi(): Promise<IncassoPerConti[]>
  registra(dati: { chiave: string; tipo: string; data: string; importo: number; voce_id: string; cassa_id: string; descrizione: string; nota?: string }): Promise<MovimentoScritto>
  /** Chi ha il ruolo di segreteria (`e_staff()`). */
  eSegreteria(): Promise<boolean>
  /** I corsi attivi, per nome. */
  corsi(): Promise<CorsoChat[]>
  /** Gli iscritti attivi (`chat_iscritti`): dei minori niente nomi. */
  iscritti(): Promise<IscrittoChat[]>
  /** Le lezioni dal `dal` all'`al` (giorni di Roma) con l'appello di ognuno (`chat_registro`). */
  registro(dal: string, al: string): Promise<AppelloChat[]>
  /** Quante prove per lezione (`chat_prove`): mai chi. */
  prove(dal: string, al: string): Promise<ProvaChat[]>
}

export interface OpzioniMcp {
  /** L'indirizzo dei metadati della risorsa (RFC 9728), da dove Claude scopre come fare l'accesso. */
  metadati: string
  apri: (token: string) => DatabaseChat
  oggi: () => string
  /** Gli strumenti della segreteria: di base `CHAT_SEGRETERIA_ACCESA`. */
  segreteria?: boolean
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
- Dopo la registrazione di' cosa hai scritto e che si annulla da CONTABILITÀ → MOVIMENTI.
- Per i conti (conti, saldi_casse, da_classificare) riporta i numeri come li dà lo strumento: sono quelli di BILANCIO nell'app. Della Cassa Contanti non c'è il saldo: la chiusura si conta alla cieca.
- La voce dei gruppi da classificare si cambia nell'app (CONTABILITÀ → MOVIMENTI, «Cambiare la voce»): di' cosa cercare, la voce di partenza e il periodo «Tutto».`

/** Per la segreteria: le stesse cautele dei testi, e i nomi dei minori che non ci sono. */
const ISTRUZIONI_SEGRETERIA = `Rispondi alla segreteria di ODS Corsi su iscritti, certificati, quote e presenze, in sola lettura.
- Dei minori, e di chi non ha la data di nascita, gli strumenti danno solo numeri: non chiedere né cercare i loro nomi. I nomi si vedono nell'app, in DA FARE.
- Chi è venuto a provare è solo un numero.
- Riporta i numeri come li dà lo strumento: le regole sono quelle di DA FARE e PRESENZE nell'app.
- Il corso si sceglie per nome: lo strumento corsi dà l'elenco.
- Le presenze contano gli appelli arrivati: uno ancora sul tablet senza rete non c'è.
- Dalla chat non si cambia niente: iscrizioni, appelli e pagamenti si fanno nell'app.`

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
  {
    name: 'conti',
    title: 'Conti',
    description:
      'Entrate, uscite, risultato e voci di un periodo, col confronto sullo stesso tratto dell’anno prima: gli stessi numeri di BILANCIO. Senza dal/al, l’anno (solare) chiesto o quello in corso, col riepilogo per il direttivo. Gli incassi degli iscritti sono solo importi.',
    inputSchema: {
      type: 'object',
      properties: {
        dal: { type: 'string', description: 'AAAA-MM-GG' },
        al: { type: 'string', description: 'AAAA-MM-GG; dopo oggi vale oggi' },
        anno: { type: 'number', description: 'Anno solare, se non c’è dal' },
        voce: { type: 'string', description: 'Solo questa voce' },
        tipo: { type: 'string', enum: ['entrata', 'uscita'] },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'saldi_casse',
    title: 'Saldi delle casse',
    description: 'Il saldo «secondo i conti» del Conto Corrente (da confrontare con la banca). Della Cassa Contanti solo l’ultima chiusura e il contato, mai il previsto.',
    inputSchema: { type: 'object', properties: { al: { type: 'string', description: 'AAAA-MM-GG; di base oggi' } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'da_classificare',
    title: 'Da classificare',
    description: 'Le uscite ancora su «Da classificare», «Varie» o senza voce, raggruppate per descrizione (le più pesanti in euro), con la voce proposta e come ritrovarle nell’app.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
]

const corso = { type: 'string', description: 'Il nome del corso, come lo dà lo strumento corsi' }
const STRUMENTI_SEGRETERIA = [
  {
    name: 'corsi',
    title: 'Corsi',
    description: 'I corsi attivi, per nome: si usano negli altri strumenti della segreteria.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'certificati',
    title: 'Certificati',
    description: 'Fra chi è attivo, i certificati scaduti, mancanti e in scadenza entro 30 giorni, come DA FARE. Gli adulti per nome, i minori solo contati.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'quote',
    title: 'Quote',
    description: 'Fra chi è attivo, le quote da pagare, scadute o pagate in parte (con quanto manca). Gli adulti per nome, i minori solo contati.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'iscritti',
    title: 'Iscritti di un corso',
    description: 'Chi è iscritto oggi a un corso: gli adulti per nome, i minori solo contati.',
    inputSchema: { type: 'object', properties: { corso }, required: ['corso'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'presenze',
    title: 'Presenze di un corso',
    description: 'Le lezioni di un corso con e senza appello e le presenze di ognuno, dagli appelli arrivati. Di base dal primo del mese a oggi.',
    inputSchema: {
      type: 'object',
      properties: { corso, dal: { type: 'string', description: 'AAAA-MM-GG' }, al: { type: 'string', description: 'AAAA-MM-GG; dopo oggi vale oggi' } },
      required: ['corso'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'chi_manca',
    title: 'Chi si sta perdendo',
    description: 'Chi ha 3 o più assenze di fila negli ultimi 60 giorni, come in PRESENZE, in tutti i corsi o in uno.',
    inputSchema: { type: 'object', properties: { corso } },
    annotations: { readOnlyHint: true },
  },
]
const DELLA_SEGRETERIA = new Set(STRUMENTI_SEGRETERIA.map((s) => s.name))

const LETTURA = new Set(['conti', 'saldi_casse', 'da_classificare'])

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
  resource_name: 'ODS Corsi',
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

/** L'elenco unico dell'app (`righeMovimenti`), con gli incassi degli iscritti senza nomi. */
async function elenco(db: DatabaseChat) {
  const [voci, casse, manuali, incassi] = await Promise.all([db.voci(), db.casse(), db.movimenti(), db.incassi()])
  return { voci, casse, righe: righeMovimenti(incassiPerConti(incassi, casse), manuali, voci) }
}

/** «· anno prima 300,00 € · +68%», o «nessun dato» se l'anno prima è vuoto. */
const confronto = (adesso: number, prima: number | undefined) => {
  if (prima === undefined) return ' · anno prima: nessun dato'
  const v = variazione(adesso, prima)
  return ` · anno prima ${importoConMeno(prima)}${v ? ` · ${v}` : ''}`
}

async function strumentoConti(db: DatabaseChat, a: Argomenti, oggi: string) {
  if (a.tipo !== undefined && a.tipo !== 'entrata' && a.tipo !== 'uscita') return testo('Scegli se è un’entrata o un’uscita', true)
  const tipo = a.tipo === 'entrata' || a.tipo === 'uscita' ? a.tipo : undefined
  const dal = stringa(a.dal)
  const al = stringa(a.al)
  if ((dal !== undefined && !dataVera(dal)) || (al !== undefined && !dataVera(al))) return testo('La data non si capisce', true)
  const anno = a.anno === undefined ? Number(oggi.slice(0, 4)) : a.anno
  if (!dal && (typeof anno !== 'number' || !Number.isInteger(anno))) return testo('L’anno non si capisce', true)
  if (!dal && Number(anno) > Number(oggi.slice(0, 4))) return testo(`L’anno ${anno} non è ancora cominciato`, true)
  const { voci, casse, righe } = await elenco(db)
  const voce = stringa(a.voce)?.trim()
  const voceEsiste = (n: string) => n.toLowerCase() === VOCE_DA_CLASSIFICARE.toLowerCase() || voci.some((v) => v.nome.toLowerCase() === n.toLowerCase())
  if (voce && !voceEsiste(voce)) return testo(`Non c’è una voce «${voce}»: vedi lo strumento voci`, true)
  if (dal && dal > (al ?? oggi)) return testo('La data di inizio è dopo quella di fine', true)
  if (dal && dal > oggi) return testo('Il periodo comincia dopo oggi: non ci sono ancora movimenti', true)
  // Senza dal: l'anno solare, come BILANCIO, che dà anche il «provvisorio».
  const b = dal ? null : bilancioAnno(righe, casse, Number(anno), oggi)
  const c = contiPeriodo(righe, { dal: dal ?? b?.dal ?? oggi, al: dal ? (al ?? oggi) : (b?.al ?? oggi), voce, tipo }, oggi)
  const righeTesto = [
    `${b ? `Anno ${anno}, ` : 'Conti '}${periodoInParole(c.dal, c.al)}${c.parziale || b?.parziale ? ' (parziale: fino a oggi)' : ''}, confronto ${periodoInParole(c.confrontoDal, c.confrontoAl)}`,
  ]
  if (b?.provvisorio) righeTesto.push('Risultato provvisorio: più di metà delle uscite è da classificare')
  if (c.sovrapposizione) righeTesto.push(`Attenzione, possibile doppio conteggio degli incassi ${periodoInParole(c.sovrapposizione.dal, c.sovrapposizione.al)}: lo storico importato si sovrappone agli incassi dell’app`)
  righeTesto.push(`Entrate: ${importoConMeno(c.entrate)}${confronto(c.entrate, c.prima?.entrate)}`)
  righeTesto.push(`Uscite: ${importoConMeno(c.uscite)}${confronto(c.uscite, c.prima?.uscite)}`)
  righeTesto.push(`Risultato: ${importoConMeno(c.risultato)}${c.prima ? ` · anno prima ${importoConMeno(c.prima.risultato)}` : ''}`)
  for (const v of c.voci) {
    if (v.totale === null) continue
    righeTesto.push(`- ${v.tipo === 'entrata' ? 'Entrata' : 'Uscita'} · ${v.voce}: ${importoConMeno(v.totale)}${v.aParte ? ' (nel totale, ma è la differenza di una chiusura di cassa)' : ''}`)
  }
  if (c.daSistemare) righeTesto.push(`${c.daSistemare.movimenti} movimenti per ${euro(c.daSistemare.uscite)} € ancora da sistemare (Da classificare, Varie o senza voce): i totali per voce possono essere più alti`)
  return testo(righeTesto.join('\n'))
}

async function strumentoSaldi(db: DatabaseChat, a: Argomenti, oggi: string) {
  const al = stringa(a.al)
  if (al !== undefined && !dataVera(al)) return testo('La data non si capisce', true)
  const giorno = al && al < oggi ? al : oggi
  const [{ casse, righe }, chiusure] = await Promise.all([elenco(db), db.chiusure()])
  const righeTesto = saldiCasse(casse, righe, chiusure, giorno).map((s) => {
    if (s.ultimaChiusura !== undefined) {
      const k = s.ultimaChiusura
      return k
        ? `- ${s.nome}: ultima chiusura il ${dataRicevuta(k.data)}, contati ${euro(k.contato)} €${k.nonPiuInRegola ? ' · non più in regola: qualche incasso è cambiato dopo' : ''} (il saldo dei contanti non si dice: la chiusura si conta alla cieca)`
        : `- ${s.nome}: nessuna chiusura (il saldo dei contanti non si dice: la chiusura si conta alla cieca)`
    }
    if (s.saldo === null) return `- ${s.nome}: non ancora partita dal ${dataRicevuta(s.parteIl ?? '')}`
    return `- ${s.nome}: ${importoConMeno(s.saldo)} secondo i conti`
  })
  return testo([`Al ${dataRicevuta(giorno)}:`, ...righeTesto].join('\n'))
}

async function strumentoDaClassificare(db: DatabaseChat) {
  const { voci, righe } = await elenco(db)
  const g = gruppiDaClassificare(righe, voci)
  if (!g.gruppiTotali) return testo('Niente da classificare: ogni uscita ha la sua voce.')
  return testo(
    [
      `${g.gruppiTotali} gruppi, ${g.movimentiTotali} movimenti da classificare${g.gruppiTotali > g.gruppi.length ? ` (qui i ${g.gruppi.length} più pesanti)` : ''}. In MOVIMENTI: cerca il testo, voce di partenza, periodo «Tutto».`,
      ...g.gruppi.map((x) => {
        // Il filtro voce di MOVIMENTI va per nome: un gruppo tutto senza voce si ritrova col testo e basta.
        const da = x.voci.length ? `ora su ${x.voci.join(', ')}${x.senzaVoce ? ' o senza voce' : ''}` : 'senza voce'
        const quando = x.primo === x.ultimo ? dataRicevuta(x.primo) : `dal ${dataRicevuta(x.primo)} al ${dataRicevuta(x.ultimo)}`
        const voce = x.proposta ? `voce proposta ${x.proposta.nome}` : (x.avviso ?? 'nessuna proposta')
        return `- cerca «${x.cerca}» · ${x.movimenti} movimenti · ${euro(x.totale)} € · ${quando} · ${da} · periodo «Tutto» · ${voce}`
      }),
    ].join('\n'),
  )
}

/** Il giorno `giorni` prima o dopo, `AAAA-MM-GG`. */
const spostato = (giorno: string, giorni: number) => new Date(Date.parse(`${giorno}T12:00:00Z`) + giorni * 86_400_000).toISOString().slice(0, 10)

/** Il corso chiesto, o il testo che dice che non c'è. */
async function corsoChiesto(db: DatabaseChat, a: Argomenti): Promise<{ corso: CorsoChat; corsi: CorsoChat[] } | { no: string }> {
  const chiesto = stringa(a.corso)?.trim() ?? ''
  if (!chiesto) return { no: 'Scegli il corso: lo strumento corsi dà l’elenco' }
  const corsi = await db.corsi()
  const corso = corsoDa(corsi, chiesto)
  return corso ? { corso, corsi } : { no: `Non c’è un corso «${chiesto}»: vedi lo strumento corsi` }
}

async function strumentoSegreteria(db: DatabaseChat, nome: string, a: Argomenti, oggi: string) {
  if (nome === 'corsi') {
    const corsi = await db.corsi()
    return testo(corsi.length ? ['Corsi attivi:', ...corsi.map((c) => `- ${c.nome}`)].join('\n') : 'Nessun corso attivo.')
  }
  if (nome === 'certificati' || nome === 'quote') {
    const [iscritti, corsi] = await Promise.all([db.iscritti(), db.corsi()])
    return testo(nome === 'certificati' ? testoCertificati(iscritti, corsi, oggi) : testoQuote(iscritti, corsi, oggi))
  }
  if (nome === 'chi_manca') {
    const scelto = stringa(a.corso)?.trim() ? await corsoChiesto(db, a) : null
    if (scelto && 'no' in scelto) return testo(scelto.no, true)
    // Le assenze di fila guardano più indietro del mese, come PRESENZE.
    return testo(testoChiManca(await db.registro(spostato(oggi, -60), oggi), scelto?.corso ?? null))
  }
  const scelto = await corsoChiesto(db, a)
  if ('no' in scelto) return testo(scelto.no, true)
  if (nome === 'iscritti') return testo(testoIscritti(await db.iscritti(), scelto.corso, oggi))
  const dal = stringa(a.dal)
  const al = stringa(a.al)
  if ((dal !== undefined && !dataVera(dal)) || (al !== undefined && !dataVera(al))) return testo('La data non si capisce', true)
  const fino = al && al < oggi ? al : oggi
  const da = dal ?? `${oggi.slice(0, 8)}01`
  if (da > fino) return testo('La data di inizio è dopo quella di fine', true)
  const [registro, prove] = await Promise.all([db.registro(da, fino), db.prove(da, fino)])
  return testo(testoPresenze(registro, prove, scelto.corso, da, fino))
}

async function chiama(db: DatabaseChat, nome: string, a: Argomenti, oggi: string) {
  if (DELLA_SEGRETERIA.has(nome)) {
    try {
      if (!(await db.eSegreteria())) return testo(MSG_SEGRETERIA, true)
      return await strumentoSegreteria(db, nome, a, oggi)
    } catch (e) {
      return testo(erroreSegreteria(e), true)
    }
  }
  try {
    if (!(await db.eAmministrazione())) return testo(MSG_AMMINISTRAZIONE, true)
    if (nome === 'voci') return await strumentoVoci(db, a)
    if (nome === 'casse') return await strumentoCasse(db)
    if (nome === 'movimenti_simili') return await strumentoSimili(db, a)
    if (nome === 'registra_movimento') return await strumentoRegistra(db, a, oggi)
    if (nome === 'conti') return await strumentoConti(db, a, oggi)
    if (nome === 'saldi_casse') return await strumentoSaldi(db, a, oggi)
    if (nome === 'da_classificare') return await strumentoDaClassificare(db)
    return testo(`Lo strumento «${nome}» non c’è`, true)
  } catch (e) {
    return testo(testoDellErrore(e, LETTURA.has(nome) ? 'leggere' : 'registrare'), true)
  }
}

/**
 * Chi è, per gli strumenti da mostrare. Un database che non risponde vale come l'amministrazione sola: gli strumenti di
 * sempre, che poi diranno loro cosa non va.
 */
async function ruoli(db: DatabaseChat, accesa: boolean): Promise<{ amministrazione: boolean; segreteria: boolean }> {
  try {
    const [amministrazione, segreteria] = await Promise.all([db.eAmministrazione(), accesa ? db.eSegreteria() : false])
    return { amministrazione, segreteria }
  } catch {
    return { amministrazione: true, segreteria: false }
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
  const accesa = o.segreteria ?? CHAT_SEGRETERIA_ACCESA
  if (method === 'initialize') {
    const chiesta = stringa(params?.protocolVersion)
    const r = await ruoli(o.apri(token), accesa)
    return risultato(id, {
      protocolVersion: chiesta && VERSIONI.includes(chiesta) ? chiesta : VERSIONI[0],
      capabilities: { tools: {} },
      serverInfo: { name: 'ods-corsi', title: 'ODS Corsi', version: '1' },
      // Chi non ha nessuno dei due ruoli sente le istruzioni di sempre: gli strumenti gli diranno di no.
      instructions: [...(r.amministrazione || !r.segreteria ? [ISTRUZIONI] : []), ...(r.segreteria ? [ISTRUZIONI_SEGRETERIA] : [])].join('\n\n'),
    })
  }
  if (method === 'ping') return risultato(id, {})
  if (method === 'tools/list') {
    const r = await ruoli(o.apri(token), accesa)
    return risultato(id, { tools: [...(r.amministrazione ? STRUMENTI : []), ...(r.segreteria ? STRUMENTI_SEGRETERIA : [])] })
  }
  if (method === 'tools/call') {
    const nome = stringa(params?.name) ?? ''
    if (![...STRUMENTI, ...(accesa ? STRUMENTI_SEGRETERIA : [])].some((s) => s.name === nome)) return errore(id, -32602, `Lo strumento «${nome}» non c’è`)
    // Gli argomenti si leggono uno a uno (`stringa`, `movimentoDa`): basta che sia un oggetto.
    const a = typeof params?.arguments === 'object' && params.arguments !== null ? (params.arguments as Argomenti) : {}
    return risultato(id, await chiama(o.apri(token), nome, a, o.oggi()))
  }
  return errore(id, -32601, 'Metodo che non c’è')
}

