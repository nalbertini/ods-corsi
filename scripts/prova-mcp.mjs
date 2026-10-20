// ---------------------------------------------------------------------------
// Le fatture dalla chat: il server MCP di ODS Corsi, senza Deno e senza browser.
//
//   node scripts/prova-mcp.mjs
//
// Chi ha l'amministrazione fotografa a Claude la fattura o lo scontrino di un
// fornitore, e Claude la registra in CONTABILITÀ dopo il suo «ok». Qui si
// controllano:
//   · `src/lib/movimentiDallaChat.ts`: le voci da offrire, l'importo scritto
//     all'italiana, i rifiuti (gli stessi di `cosaNonVaMovimento` più i campi
//     che mancano, gli incassi degli iscritti, codice fiscale e IBAN), il
//     doppione, la voce proposta dai movimenti simili e l'errore detto per chi
//     usa l'app;
//   · `src/lib/mcp.ts`: il protocollo (JSON-RPC su HTTP), gli strumenti e chi
//     li può usare, la stessa chiave mandata di nuovo dopo una registrazione
//     riuscita, con un database finto al posto di Supabase.
// Lo stesso lato database è `supabase/prova/movimenti-dalla-chat.sql`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

// Un modulo che non c'è ancora: si dice e si va avanti, ogni prova fallisce col suo nome.
const carica = async (percorso) => {
  try {
    const { outputFiles } = await build({
      stdin: { contents: `export * from '${percorso}'`, resolveDir: '.', loader: 'ts' },
      bundle: true,
      format: 'esm',
      platform: 'node',
      write: false,
      logLevel: 'silent',
      define: { 'import.meta.env': '{}' },
    })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log(`  ✗ ${percorso} non si carica: ${e.errors?.[0]?.text ?? e.message}`)
    return {}
  }
}
const m = await carica('./src/lib/movimentiDallaChat')
const mcp = await carica('./src/lib/mcp')
const collega = await carica('./src/lib/collega')
const conti = await carica('./src/lib/contabilita')

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che non c'è ancora lancia: la prova fallisce con quel messaggio, non si ferma.
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
const provaA = async (f) => {
  try {
    return await f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const MSG_AMMINISTRAZIONE = 'La contabilità la cura l’amministrazione'
const MSG_INCASSI = 'Gli incassi degli iscritti si registrano in PAGAMENTI'
const MSG_DIFFERENZA = 'La «Differenza di cassa» si scrive da sola chiudendo la cassa'
const MSG_PRIVATI = 'Togli codice fiscale e IBAN dalla descrizione'
const MSG_ACCEDI = 'Accedi di nuovo a ODS Corsi'
const MSG_FUTURO = 'La data è nel futuro: si registra quel che è già successo'
const MSG_PRIMA = 'La data è prima dell’inizio della cassa'
const MSG_CHIUSO = 'Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura'

// Oggi, per la prova, è martedì 20 ottobre 2026 a Roma.
const OGGI = '2026-10-20'
const voci = [
  { id: 'v-quota', nome: 'Quota associativa', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'v-corsi', nome: 'Corsi e altri pagamenti', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'v-dife', nome: 'Differenza di cassa', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'v-difu', nome: 'Differenza di cassa', tipo: 'uscita', diSistema: true, attiva: true },
  { id: 'v-don', nome: 'Donazioni', tipo: 'entrata', diSistema: false, attiva: true },
  { id: 'v-dce', nome: 'Da classificare', tipo: 'entrata', diSistema: false, attiva: true },
  { id: 'v-dc', nome: 'Da classificare', tipo: 'uscita', diSistema: false, attiva: true },
  { id: 'v-ut', nome: 'Utenze', tipo: 'uscita', diSistema: false, attiva: true },
  { id: 'v-aff', nome: 'Affitto sala', tipo: 'uscita', diSistema: false, attiva: true },
  { id: 'v-vecchia', nome: 'Vecchia', tipo: 'uscita', diSistema: false, attiva: false },
]
const casse = [
  { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 10000, dal: '2026-09-01' },
  { id: 'c2', nome: 'Conto Corrente', saldoIniziale: 0 },
]
// La Cassa Contanti è chiusa fino al 10 ottobre.
const chiusure = [{ id: 'k10', cassaId: 'c1', dal: '2026-09-01', data: '2026-10-10', previsto: 10000, contato: 10000, differenza: 0, chiusaIl: '2026-10-10T19:00:00Z' }]
const contesto = { voci, casse, chiusure, oggi: OGGI }
// La bolletta del design: Enel, 312,40 €, addebitata il 14/10 sul conto.
const bolletta = { chiave: 'K1', tipo: 'uscita', data: '2026-10-14', importo: '312,40', voce_id: 'v-ut', cassa_id: 'c2', descrizione: 'Enel · bolletta n. 123 · set 2026', fornitore: 'Enel' }
const CF = 'RSSMRA80A01L219M' // scritto giusto, carattere di controllo compreso
const CF_SBAGLIATO = 'RSSMRA80A01L219X'
const IBAN = 'IT60 X054 2811 1010 0000 0123 456'

console.log('1. le voci che la chat può offrire')
{
  const nomi = (tipo) => m.vociPerLaChat(voci, tipo).map((v) => v.nome)
  ok('le uscite: niente disattivate né «Differenza di cassa»', prova(() => nomi('uscita').filter((x) => x === 'Vecchia' || x === 'Differenza di cassa')), [])
  ok('…solo quelle in uso', prova(() => [...nomi('uscita')].sort()), ['Affitto sala', 'Da classificare', 'Utenze'])
  ok('le entrate: niente «Quota associativa», «Corsi e altri pagamenti», «Differenza di cassa»', prova(() => [...nomi('entrata')].sort()), ['Da classificare', 'Donazioni'])
  ok('«Da classificare» c\'è, segnata «solo se la chiedi»; le altre no',
    prova(() => m.vociPerLaChat(voci, 'uscita').map((v) => [v.nome, v.soloSeLaChiedi]).sort()),
    [['Affitto sala', false], ['Da classificare', true], ['Utenze', false]])
  ok('ogni voce porta il suo id, per registrare', prova(() => m.vociPerLaChat(voci, 'uscita').map((v) => v.id).sort()), ['v-aff', 'v-dc', 'v-ut'])
}

console.log('\n2. l\'importo letto sulla fattura, scritto all\'italiana')
{
  const di = (t) => prova(() => m.importoInCentesimi(t))
  ok('«45,90» sono 4590 centesimi', di('45,90'), { centesimi: 4590 })
  ok('«45.90» pure', di('45.90'), { centesimi: 4590 })
  ok('«1.234,50» sono 123450', di('1.234,50'), { centesimi: 123450 })
  ok('«312,40 €» col simbolo', di('312,40 €'), { centesimi: 31240 })
  ok('«0» no', di('0'), { errore: 'L’importo deve essere più di zero' })
  ok('«-5» no, e dice perché (non «non si capisce»)', di('-5'), { errore: 'L’importo deve essere più di zero' })
  ok('«100.000,01» no: oltre i centomila euro', di('100.000,01'), { errore: 'L’importo è troppo alto: controlla le cifre' })
  ok('«100.000,00» sì, è il massimo', di('100.000,00'), { centesimi: 10_000_000 })
  ok('un testo che non è un importo', di('trecento'), { errore: 'L’importo non si capisce' })
}

console.log('\n3. cosa non va in un movimento dalla chat')
{
  const di = (cambio) => prova(() => m.cosaNonVaDallaChat({ ...bolletta, ...cambio }, contesto))
  ok('la bolletta del design va', di({}), null)
  ok('con la nota va', di({ nota: 'addebito diretto' }), null)
  ok('«Da classificare» va, se la si sceglie', di({ voce_id: 'v-dc' }), null)
  ok('un\'entrata su una voce di entrata va', di({ tipo: 'entrata', voce_id: 'v-don', descrizione: 'Contributo del Comune' }), null)
  ok('il giorno dopo la chiusura, in contanti, va', di({ cassa_id: 'c1', data: '2026-10-11' }), null)
  ok('oggi va', di({ data: OGGI }), null)
  console.log('   i campi che mancano')
  ok('senza data', di({ data: undefined }), 'Scrivi la data')
  ok('…o con la data vuota', di({ data: '' }), 'Scrivi la data')
  ok('senza importo', di({ importo: undefined }), 'Scrivi l’importo')
  ok('…o con l\'importo vuoto', di({ importo: '  ' }), 'Scrivi l’importo')
  ok('senza voce', di({ voce_id: undefined }), 'Scegli la voce')
  ok('senza cassa', di({ cassa_id: undefined }), 'Scegli la cassa')
  ok('senza descrizione', di({ descrizione: undefined }), 'Scrivi una descrizione')
  ok('…o di soli spazi', di({ descrizione: '   ' }), 'Scrivi una descrizione')
  ok('senza tipo', di({ tipo: undefined }), 'Scegli se è un’entrata o un’uscita')
  ok('un giroconto non passa dalla chat', di({ tipo: 'giroconto' }), 'Scegli se è un’entrata o un’uscita')
  console.log('   l\'importo')
  ok('«0»', di({ importo: '0' }), 'L’importo deve essere più di zero')
  ok('«-5»', di({ importo: '-5' }), 'L’importo deve essere più di zero')
  ok('«100.000,01»', di({ importo: '100.000,01' }), 'L’importo è troppo alto: controlla le cifre')
  console.log('   le date, come il database (59 e 60)')
  ok('domani a Roma no', di({ data: '2026-10-21' }), MSG_FUTURO)
  ok('prima dell\'inizio della Cassa Contanti no', di({ cassa_id: 'c1', data: '2026-08-31' }), MSG_PRIMA)
  ok('un giorno chiuso no, e suggerisce la rettifica', di({ cassa_id: 'c1', data: '2026-10-10' }), MSG_CHIUSO)
  ok('…anche un giorno prima della chiusura', di({ cassa_id: 'c1', data: '2026-10-03' }), MSG_CHIUSO)
  console.log('   le voci che non si offrono')
  ok('«Quota associativa» no', di({ tipo: 'entrata', voce_id: 'v-quota' }), MSG_INCASSI)
  ok('«Corsi e altri pagamenti» no', di({ tipo: 'entrata', voce_id: 'v-corsi' }), MSG_INCASSI)
  ok('«Differenza di cassa» no', di({ voce_id: 'v-difu' }), MSG_DIFFERENZA)
  ok('una voce disattivata no', di({ voce_id: 'v-vecchia' }), 'La voce non è più in uso: scegline un’altra')
  ok('una voce che non c\'è no', di({ voce_id: 'v-xxx' }), 'Scegli la voce')
  ok('una voce di entrata su una uscita no', di({ voce_id: 'v-don' }), 'La voce scelta non va con questo tipo di movimento')
  ok('una cassa che non c\'è no', di({ cassa_id: 'cX' }), 'Scegli la cassa')
  console.log('   codice fiscale e IBAN')
  ok('un codice fiscale nella descrizione no', di({ descrizione: `Compenso ${CF}` }), MSG_PRIVATI)
  ok('…in minuscolo pure', di({ descrizione: `Fattura ${CF.toLowerCase()}` }), MSG_PRIVATI)
  ok('…nella nota pure', di({ nota: `cf ${CF}` }), MSG_PRIVATI)
  ok('un IBAN nella descrizione no, anche con gli spazi', di({ descrizione: `Bonifico su ${IBAN}` }), MSG_PRIVATI)
  ok('…tutto attaccato', di({ descrizione: `Bonifico su ${IBAN.replaceAll(' ', '')}` }), MSG_PRIVATI)
  ok('…nella nota pure', di({ nota: `pagato su ${IBAN}` }), MSG_PRIVATI)
  ok('sedici lettere che non sono un codice fiscale valido vanno', di({ descrizione: `Ordine ${CF_SBAGLIATO}` }), null)
  ok('un numero di fattura va', di({ descrizione: 'Ferramenta Bianchi · scontrino 0042-2026' }), null)
}

console.log('\n4. il doppione: un avviso, non un blocco')
{
  const nuovo = { tipo: 'uscita', data: '2026-10-14', importo: 31240, fornitore: 'Enel' }
  // Adattata alla regola nuova: l'esistente porta voceId e personaId (non più cassaId), e doppioneDi riceve le voci.
  const es = (id, tipo, data, importo, descrizione, annullato = false, altro = {}) => ({ id, tipo, data, importo, descrizione, voceId: tipo === 'uscita' ? 'v-ut' : 'v-don', personaId: null, annullato, ...altro })
  const di = (esistenti, cambio = {}) => prova(() => m.doppioneDi({ ...nuovo, ...cambio }, esistenti, voci)?.id ?? null)
  ok('stesso tipo, importo e data: doppione, qualunque sia la descrizione', di([es('a', 'uscita', '2026-10-14', 31240, 'Bolletta luce')]), 'a')
  ok('stesso tipo e importo, il fornitore nella descrizione 12 giorni prima: doppione', di([es('b', 'uscita', '2026-10-02', 31240, 'Enel bolletta settembre')]), 'b')
  ok('…il fornitore scritto con altre maiuscole', di([es('b', 'uscita', '2026-10-02', 31240, 'ENEL ENERGIA SPA')]), 'b')
  ok('…60 giorni prima: ancora doppione', di([es('f', 'uscita', '2026-08-15', 31240, 'Enel bolletta')]), 'f')
  ok('…61 giorni prima: no', di([es('g', 'uscita', '2026-08-14', 31240, 'Enel bolletta')]), null)
  ok('annullato: nessun avviso', di([es('c', 'uscita', '2026-10-02', 31240, 'Enel bolletta settembre', true)]), null)
  ok('annullato lo stesso giorno: nessun avviso', di([es('c', 'uscita', '2026-10-14', 31240, 'Bolletta luce', true)]), null)
  ok('un\'entrata uguale non è il doppione di un\'uscita', di([es('d', 'entrata', '2026-10-14', 31240, 'Enel rimborso')]), null)
  ok('un centesimo di differenza: no', di([es('e', 'uscita', '2026-10-14', 31241, 'Enel bolletta')]), null)
  ok('un altro fornitore in un altro giorno: no', di([es('h', 'uscita', '2026-10-02', 31240, 'Ferramenta Bianchi')]), null)
  ok('senza fornitore conta solo la stessa data', [di([es('b', 'uscita', '2026-10-02', 31240, 'Enel bolletta')], { fornitore: undefined }), di([es('a', 'uscita', '2026-10-14', 31240, 'Bolletta')], { fornitore: undefined })], [null, 'a'])
  ok('senza movimenti, niente', di([]), null)
  console.log('   mai le persone né le voci di sistema')
  ok('un movimento collegato a una persona, stesso giorno e importo: no', di([es('p', 'uscita', '2026-10-14', 31240, 'Enel bolletta', false, { personaId: 'aaaaaaaa-0000-0000-0000-000000000007' })]), null)
  ok('…nemmeno col fornitore nella descrizione', di([es('p', 'uscita', '2026-10-02', 31240, 'Enel bolletta', false, { personaId: 'aaaaaaaa-0000-0000-0000-000000000007' })]), null)
  ok('una «Differenza di cassa» uguale lo stesso giorno: no', di([es('k', 'uscita', '2026-10-14', 31240, 'Differenza Enel', false, { voceId: 'v-difu' })]), null)
  ok('un incasso degli iscritti uguale lo stesso giorno: no', di([es('q', 'entrata', '2026-10-14', 31240, 'Quota Enel', false, { voceId: 'v-quota' })], { tipo: 'entrata' }), null)
  ok('…«Corsi e altri pagamenti» pure', di([es('q', 'entrata', '2026-10-14', 31240, 'Corso Enel', false, { voceId: 'v-corsi' })], { tipo: 'entrata' }), null)
  ok('un\'entrata uguale su una voce a mano sì', di([es('d', 'entrata', '2026-10-14', 31240, 'Contributo')], { tipo: 'entrata' }), 'd')
  console.log('   i giorni in cui si cerca')
  ok('GIORNI_DOPPIONE è 60', m.GIORNI_DOPPIONE, 60)
  ok('finestraDoppione: dai 60 giorni prima, compreso, al giorno stesso', prova(() => m.finestraDoppione('2026-10-14')), { dal: '2026-08-15', al: '2026-10-14' })
  ok('…attraverso l\'anno', prova(() => m.finestraDoppione('2026-01-10')), { dal: '2025-11-11', al: '2026-01-10' })
  ok('…con febbraio bisestile', prova(() => m.finestraDoppione('2028-03-01')), { dal: '2028-01-01', al: '2028-03-01' })
  ok('…col cambio d\'ora di marzo in mezzo', prova(() => m.finestraDoppione('2026-04-15')), { dal: '2026-02-14', al: '2026-04-15' })
}

console.log('\n5. la voce proposta dai movimenti simili')
{
  const s = (data, voce, voceId, voceAttiva = true) => ({ id: `s-${data}`, data, tipo: 'uscita', importo: 30000, descrizione: `Enel ${data}`, voce, voceId, voceAttiva, cassa: 'Conto Corrente' })
  const simili = [s('2026-08-02', 'Affitto sala', 'v-aff'), s('2026-10-02', 'Da classificare', 'v-dc'), s('2026-09-02', 'Utenze', 'v-ut')]
  ok('la voce del più recente che non è «Da classificare», in qualunque ordine arrivino', prova(() => m.voceProposta(simili)), { proposta: { id: 'v-ut', nome: 'Utenze' }, avviso: null })
  const spenta = prova(() => m.voceProposta([s('2026-08-02', 'Affitto sala', 'v-aff'), s('2026-09-02', 'Telefono', 'v-tel', false)]))
  ok('se quella voce è disattivata non la propone', prova(() => spenta.proposta), null)
  ok('…e lo dice, col nome della voce', prova(() => [spenta.avviso.includes('«Telefono»'), spenta.avviso.includes('non è più in uso')]), [true, true])
  ok('solo «Da classificare»: nessuna proposta, nessun avviso', prova(() => m.voceProposta([s('2026-10-02', 'Da classificare', 'v-dc')])), { proposta: null, avviso: null })
  ok('nessun simile: niente', prova(() => m.voceProposta([])), { proposta: null, avviso: null })
}

console.log('\n6. l\'errore detto per chi usa l\'app')
{
  const di = (e) => prova(() => m.testoDellErrore(e))
  ok('un rifiuto del database con le sue parole passa com\'è', di({ code: '22023', message: 'L’importo deve essere più di zero' }), 'L’importo deve essere più di zero')
  ok('…anche il giorno chiuso', di({ code: '22023', message: MSG_CHIUSO }), MSG_CHIUSO)
  ok('la porta della contabilità', di({ code: '42501', message: 'la contabilità la cura l’amministrazione' }), MSG_AMMINISTRAZIONE)
  ok('il token scaduto', di({ code: 'PGRST301', message: 'JWT expired' }), MSG_ACCEDI)
  ok('…detto solo dal messaggio', di({ message: 'JWT expired' }), MSG_ACCEDI)
  const grezzi = [
    new TypeError('fetch failed'),
    { code: '42P01', message: 'relation "public.movimenti" does not exist' },
    { code: 'PGRST202', message: 'Could not find the function public.registra_movimento_dalla_chat(dati) in the schema cache' },
    { code: '23505', message: 'duplicate key value violates unique constraint "movimenti_chiave"' },
    {},
    'boh',
  ]
  for (const e of grezzi) {
    const t = di(e)
    ok(`mai il testo grezzo: ${JSON.stringify(e.message ?? e)}`, [typeof t === 'string' && t.length > 0 && !t.startsWith('ERRORE'), /fetch|relation|PGRST|schema|duplicate|constraint|boh|undefined/i.test(String(t))], [true, false])
  }
}

// ---------------------------------------------------------------------------
// Il server: una richiesta HTTP vera (Request di Node), un database finto.
// ---------------------------------------------------------------------------
const INDIRIZZO = 'https://progetto.supabase.co/functions/v1/mcp'
const METADATI = 'https://progetto.supabase.co/functions/v1/mcp/.well-known/oauth-protected-resource'
const simili = [
  { id: 's1', data: '2026-09-14', tipo: 'uscita', importo: 29870, descrizione: 'Enel · bolletta agosto', voce: 'Utenze', voceId: 'v-ut', voceAttiva: true, cassa: 'Conto Corrente' },
]
// Il database visto da chi ha il token: `scritti` è quel che è arrivato a registra_movimento_dalla_chat
// (ogni chiamata, anche con una chiave già vista), `cercati` quel che è arrivato a `uguali`. Ricorda i
// movimenti scritti per chiave (`perChiave`), come la colonna chiave_chat. `uguali` e `chiusure` si
// cambiano fra una chiamata e l'altra (`db.uguali_ora`, `db.chiusure_ora`); `restituisce` cambia la
// riga che il database rimanda indietro.
const finto = ({ amministrazione = true, guasto = null, guastoScrittura = null, uguali = [], restituisce = null } = {}) => {
  const scritti = []
  const cercati = []
  const perChiave = new Map()
  const leggi = async (x) => {
    if (guasto) throw guasto
    return x
  }
  const db = {
    scritti,
    cercati,
    uguali_ora: uguali,
    chiusure_ora: chiusure,
    eAmministrazione: () => leggi(amministrazione),
    voci: () => leggi(voci),
    casse: () => leggi(casse),
    chiusure: () => leggi(db.chiusure_ora),
    simili: () => leggi(simili),
    uguali: (cerca) => {
      cercati.push(cerca)
      return leggi(db.uguali_ora)
    },
    perChiave: async (chiave) => {
      if (guasto) throw guasto
      return perChiave.get(chiave) ?? null
    },
    registra: async (dati) => {
      if (guasto) throw guasto
      if (guastoScrittura) throw guastoScrittura
      scritti.push(dati)
      const riga = perChiave.get(dati.chiave) ?? { id: `m-${scritti.length}`, tipo: dati.tipo, data: dati.data, importo: dati.importo, descrizione: dati.descrizione, voce_id: dati.voce_id, cassa_id: dati.cassa_id, ...(restituisce ?? {}) }
      perChiave.set(dati.chiave, riga)
      return riga
    },
  }
  return db
}
let n = 0
const manda = async (corpo, { token = 'token-di-ada', db = finto() } = {}) => {
  const intestazioni = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }
  if (token !== null) intestazioni.authorization = `Bearer ${token}`
  const req = new Request(INDIRIZZO, { method: 'POST', headers: intestazioni, body: JSON.stringify(corpo) })
  const r = await mcp.rispondiMcp(req, { metadati: METADATI, apri: () => db, oggi: () => OGGI })
  const testo = await r.text()
  let json = null
  try {
    json = testo ? JSON.parse(testo) : null
  } catch {
    json = testo
  }
  return { stato: r.status, header: r.headers, corpo: json, testo }
}
// Una richiesta HTTP com'è, per i corpi che non sono JSON e i metodi che non sono POST.
const mandaGrezzo = async (metodo, corpo, { db = finto() } = {}) => {
  const req = new Request(INDIRIZZO, { method: metodo, headers: { 'content-type': 'application/json', authorization: 'Bearer token-di-ada' }, ...(corpo === undefined ? {} : { body: corpo }) })
  const r = await mcp.rispondiMcp(req, { metadati: METADATI, apri: () => db, oggi: () => OGGI })
  const testo = await r.text()
  let json = null
  try {
    json = testo ? JSON.parse(testo) : null
  } catch {
    json = testo
  }
  return { stato: r.status, corpo: json }
}
const richiesta = (method, params) => ({ jsonrpc: '2.0', id: ++n, method, ...(params ? { params } : {}) })
const strumento = (name, args) => richiesta('tools/call', { name, arguments: args })
// Il testo che Claude legge dalla risposta di uno strumento, e se è un errore.
const esito = (r) => [r.corpo?.result?.content?.[0]?.text ?? null, r.corpo?.result?.isError === true]

console.log('\n7. il protocollo')
{
  const senza = await provaA(() => manda(richiesta('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude', version: '1' } }), { token: null }))
  ok('senza Authorization: 401', senza.stato, 401)
  const www = prova(() => senza.header.get('www-authenticate') ?? '')
  ok('…con WWW-Authenticate che punta ai metadati della risorsa, per far partire l\'OAuth di Claude', prova(() => [www.startsWith('Bearer'), www.includes(`resource_metadata="${METADATI}"`)]), [true, true])
  const vuoto = await provaA(() => manda(richiesta('tools/list'), { token: '' }))
  ok('con «Bearer» e niente dopo: 401 lo stesso', vuoto.stato, 401)

  const ini = await provaA(() => manda(richiesta('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude', version: '1' } })))
  ok('initialize risponde 200, in JSON-RPC 2.0, con lo stesso id', prova(() => [ini.stato, ini.corpo.jsonrpc, ini.corpo.id]), [200, '2.0', n])
  ok('…con la versione del protocollo chiesta', prova(() => ini.corpo.result.protocolVersion), '2025-06-18')
  ok('…e capabilities.tools', prova(() => typeof ini.corpo.result.capabilities.tools), 'object')
  ok('…e il suo nome', prova(() => typeof ini.corpo.result.serverInfo.name), 'string')

  const notifica = await provaA(() => manda({ jsonrpc: '2.0', method: 'notifications/initialized' }))
  ok('una notifica (senza id) non ha risposta: 202 e corpo vuoto', prova(() => [notifica.stato, notifica.testo]), [202, ''])

  const strano = await provaA(() => manda({ jsonrpc: '2.0', id: 77, method: 'risorse/inventate' }))
  ok('un metodo che non c\'è: errore -32601, con lo stesso id', prova(() => [strano.corpo.id, strano.corpo.error.code, strano.corpo.result ?? null]), [77, -32601, null])

  const elenco = await provaA(() => manda(richiesta('tools/list')))
  const tools = prova(() => elenco.corpo.result.tools)
  ok('tools/list: esattamente voci, casse, movimenti_simili, registra_movimento', prova(() => tools.map((t) => t.name).sort()), ['casse', 'movimenti_simili', 'registra_movimento', 'voci'])
  ok('solo registra_movimento non è di sola lettura (readOnlyHint)', prova(() => tools.map((t) => [t.name, t.annotations?.readOnlyHint]).sort()), [['casse', true], ['movimenti_simili', true], ['registra_movimento', false], ['voci', true]])
  ok('ognuno ha la descrizione e lo schema degli argomenti', prova(() => tools.map((t) => typeof t.description === 'string' && t.description.length > 0 && t.inputSchema?.type === 'object')), [true, true, true, true])
  console.log('   le richieste che non vanno')
  const get = await provaA(() => mandaGrezzo('GET'))
  ok('GET: 405', prova(() => get.stato), 405)
  const rotto = await provaA(() => mandaGrezzo('POST', '{"jsonrpc": "2.0", "id": 1, '))
  ok('un corpo che non è JSON: -32700, id null', prova(() => [rotto.corpo.error.code, rotto.corpo.id]), [-32700, null])
  const lotto = await provaA(() => mandaGrezzo('POST', JSON.stringify([richiesta('ping'), richiesta('ping')])))
  ok('un array di richieste: -32600', prova(() => [lotto.corpo.error.code, lotto.corpo.id]), [-32600, null])
  const idStrano = await provaA(() => manda({ jsonrpc: '2.0', id: { a: 1 }, method: 'ping' }))
  ok('un id che è un oggetto: -32600, id null', prova(() => [idStrano.corpo.error?.code ?? null, idStrano.corpo.id, idStrano.corpo.result ?? null]), [-32600, null, null])
  const idLista = await provaA(() => manda({ jsonrpc: '2.0', id: [1], method: 'ping' }))
  ok('…o una lista: -32600', prova(() => idLista.corpo.error?.code ?? null), -32600)
  const idVero = await provaA(() => manda({ jsonrpc: '2.0', id: true, method: 'ping' }))
  ok('…o un booleano: -32600', prova(() => idVero.corpo.error?.code ?? null), -32600)
  const idTesto = await provaA(() => manda({ jsonrpc: '2.0', id: 'abc', method: 'ping' }))
  ok('un id di testo va, e torna uguale', prova(() => [idTesto.corpo.id, idTesto.corpo.error ?? null]), ['abc', null])
  const idNull = await provaA(() => manda({ jsonrpc: '2.0', id: null, method: 'ping' }))
  ok('…anche null', prova(() => [idNull.stato, idNull.corpo.id, idNull.corpo.error ?? null]), [200, null, null])
  const nessuno = await provaA(() => manda(strumento('cancella_tutto', {})))
  ok('tools/call con uno strumento che non c\'è: -32602', prova(() => nessuno.corpo.error.code), -32602)
  ok('registra_movimento vuole la chiave, e accetta confermo_doppione', prova(() => { const s = tools.find((t) => t.name === 'registra_movimento').inputSchema; return [s.required.includes('chiave'), 'confermo_doppione' in s.properties] }), [true, true])
}

console.log('\n8. solo chi ha l\'amministrazione')
{
  for (const [nome, args] of [['voci', { tipo: 'uscita' }], ['casse', {}], ['movimenti_simili', { testo: 'enel' }], ['registra_movimento', bolletta]]) {
    const db = finto({ amministrazione: false })
    const r = await provaA(() => manda(strumento(nome, args), { db }))
    ok(`${nome}: la segreteria semplice, un istruttore, un tablet, un iscritto si sentono dire di no`, prova(() => esito(r)), [MSG_AMMINISTRAZIONE, true])
    ok(`…e ${nome} non scrive niente`, db.scritti.length, 0)
  }
  const db = finto()
  const r = await provaA(() => manda(strumento('registra_movimento', bolletta), { db, token: null }))
  ok('senza token, registra_movimento non arriva al database', [prova(() => r.stato), db.scritti.length], [401, 0])
}

console.log('\n9. gli strumenti di lettura')
{
  const uscite = await provaA(() => manda(strumento('voci', { tipo: 'uscita' })))
  const [t, errore] = prova(() => esito(uscite))
  ok('voci: le uscite che si possono scegliere, «Da classificare» solo se la chiedi', prova(() => [errore, t.includes('Utenze'), t.includes('Affitto sala'), t.includes('Da classificare'), t.includes('solo se la chiedi')]), [false, true, true, true, true])
  ok('…mai le disattivate né quelle di sistema', prova(() => [t.includes('Vecchia'), t.includes('Differenza di cassa')]), [false, false])
  const entrate = await provaA(() => manda(strumento('voci', { tipo: 'entrata' })))
  ok('voci delle entrate: mai gli incassi degli iscritti', prova(() => { const x = esito(entrate)[0]; return [x.includes('Donazioni'), x.includes('Quota associativa'), x.includes('Corsi e altri pagamenti')] }), [true, false, false])
  for (const [cosa, args] of [['senza tipo', {}], ['con un tipo strano', { tipo: 'giroconto' }]]) {
    const r = await provaA(() => manda(strumento('voci', args)))
    ok(`voci ${cosa}: chiede se è un'entrata o un'uscita`, prova(() => esito(r)), ['Scegli se è un’entrata o un’uscita', true])
  }
  const cc = await provaA(() => manda(strumento('casse', {})))
  ok('casse: le due casse', prova(() => { const x = esito(cc)[0]; return [x.includes('Cassa Contanti'), x.includes('Conto Corrente')] }), [true, true])
  const sim = await provaA(() => manda(strumento('movimenti_simili', { testo: 'enel' })))
  ok('movimenti_simili: propone la voce dell\'ultima volta', prova(() => { const x = esito(sim); return [x[1], x[0].includes('Utenze')] }), [false, true])
}

console.log('\n10. registra_movimento')
{
  const db = finto()
  const r = await provaA(() => manda(strumento('registra_movimento', bolletta), { db }))
  ok('la bolletta arriva al database una volta, con la chiave e l\'importo in centesimi', prova(() => db.scritti.map((s) => [s.chiave, s.tipo, s.data, s.importo, s.voce_id, s.cassa_id, s.descrizione])), [['K1', 'uscita', '2026-10-14', 31240, 'v-ut', 'c2', 'Enel · bolletta n. 123 · set 2026']])
  ok('…e la risposta dice cosa è stato registrato', prova(() => { const x = esito(r); return [x[1], x[0].includes('Registrato'), x[0].includes('312,40')] }), [false, true, true])

  const ferma = async (cosa, args, messaggio) => {
    const d = finto()
    const x = await provaA(() => manda(strumento('registra_movimento', { ...bolletta, ...args }), { db: d }))
    ok(cosa, prova(() => esito(x)), [messaggio, true])
    ok('…e non scrive', d.scritti.length, 0)
  }
  await ferma('senza data: «Scrivi la data»', { data: undefined }, 'Scrivi la data')
  await ferma('senza importo', { importo: undefined }, 'Scrivi l’importo')
  await ferma('senza voce', { voce_id: undefined }, 'Scegli la voce')
  await ferma('senza cassa', { cassa_id: undefined }, 'Scegli la cassa')
  await ferma('senza descrizione', { descrizione: undefined }, 'Scrivi una descrizione')
  await ferma('importo «0»', { importo: '0' }, 'L’importo deve essere più di zero')
  await ferma('importo «-5»', { importo: '-5' }, 'L’importo deve essere più di zero')
  await ferma('importo «100.000,01»', { importo: '100.000,01' }, 'L’importo è troppo alto: controlla le cifre')
  await ferma('domani', { data: '2026-10-21' }, MSG_FUTURO)
  await ferma('prima dell\'inizio della cassa', { cassa_id: 'c1', data: '2026-08-31' }, MSG_PRIMA)
  await ferma('un giorno chiuso, con la rettifica suggerita', { cassa_id: 'c1', data: '2026-10-08' }, MSG_CHIUSO)
  await ferma('«Quota associativa»', { tipo: 'entrata', voce_id: 'v-quota' }, MSG_INCASSI)
  await ferma('«Corsi e altri pagamenti»', { tipo: 'entrata', voce_id: 'v-corsi' }, MSG_INCASSI)
  await ferma('«Differenza di cassa»', { voce_id: 'v-difu' }, MSG_DIFFERENZA)
  await ferma('un codice fiscale nella descrizione', { descrizione: `Fattura ${CF}` }, MSG_PRIVATI)
  await ferma('un IBAN nella nota', { nota: `bonifico su ${IBAN}` }, MSG_PRIVATI)

  console.log('   il doppione')
  // Adattata alla regola nuova: voceId e personaId al posto di cassaId.
  const settembre = { id: 'm-set', tipo: 'uscita', data: '2026-10-02', importo: 31240, descrizione: 'Enel bolletta settembre', voceId: 'v-ut', personaId: null, annullato: false }
  const d1 = finto({ uguali: [settembre] })
  const r1 = await provaA(() => manda(strumento('registra_movimento', bolletta), { db: d1 }))
  ok('c\'è già un\'uscita uguale dello stesso fornitore: non scrive', d1.scritti.length, 0)
  ok('…e dice quale, per chiedere se è la stessa', prova(() => esito(r1)[0].includes('Enel bolletta settembre')), true)
  const d2 = finto({ uguali: [settembre] })
  await provaA(() => manda(strumento('registra_movimento', { ...bolletta, confermo_doppione: true }), { db: d2 }))
  ok('con confermo_doppione: true scrive', d2.scritti.length, 1)
  const d3 = finto({ uguali: [{ ...settembre, annullato: true }] })
  await provaA(() => manda(strumento('registra_movimento', bolletta), { db: d3 }))
  ok('se quello uguale è annullato scrive senza chiedere', d3.scritti.length, 1)
  const d4 = finto({ uguali: [{ ...settembre, data: '2026-10-14', personaId: 'aaaaaaaa-0000-0000-0000-000000000007' }] })
  await provaA(() => manda(strumento('registra_movimento', bolletta), { db: d4 }))
  ok('se quello uguale è collegato a una persona scrive senza chiedere', d4.scritti.length, 1)
  const d5 = finto({ uguali: [{ ...settembre, data: '2026-10-14', voceId: 'v-difu' }] })
  await provaA(() => manda(strumento('registra_movimento', bolletta), { db: d5 }))
  ok('…e se è una «Differenza di cassa»', d5.scritti.length, 1)
  const d6 = finto()
  await provaA(() => manda(strumento('registra_movimento', bolletta), { db: d6 }))
  ok('uguali riceve tipo, importo e i giorni in cui cercare (finestraDoppione), non la data',
    prova(() => d6.cercati.map((c) => [Object.keys(c).sort(), c.tipo, c.importo, c.dal, c.al])), [[['al', 'dal', 'importo', 'tipo'], 'uscita', 31240, '2026-08-15', '2026-10-14']])

  console.log('   la chiave')
  const d7 = finto()
  const senzaChiave = await provaA(() => manda(strumento('registra_movimento', { ...bolletta, chiave: undefined }), { db: d7 }))
  ok('senza chiave: «Manca la chiave della registrazione: riprova dalla chat»', prova(() => esito(senzaChiave)), ['Manca la chiave della registrazione: riprova dalla chat', true])
  ok('…e non scrive', d7.scritti.length, 0)

  console.log('   la stessa chiave dopo una registrazione riuscita (la risposta si era persa)')
  const ripeti = async (cosa, cambia) => {
    const d = finto()
    const prima = await provaA(() => manda(strumento('registra_movimento', bolletta), { db: d }))
    cambia(d)
    const dopo = await provaA(() => manda(strumento('registra_movimento', bolletta), { db: d }))
    const id = (r) => prova(() => /\(id ([^)]+)\)/.exec(esito(r)[0])?.[1] ?? null)
    ok(`${cosa}: «Registrato», non un errore`, prova(() => { const x = esito(dopo); return [x[1], x[0].startsWith('Registrato')] }), [false, true])
    ok('…con lo stesso id della prima', [id(dopo), id(prima)], ['m-1', 'm-1'])
    ok('…e al database è arrivata una scrittura sola', d.scritti.length, 1)
  }
  await ripeti('riprova subito', () => {})
  await ripeti('riprova quando uguali vede la prima come doppione', (d) => {
    d.uguali_ora = [{ id: 'm-1', tipo: 'uscita', data: '2026-10-14', importo: 31240, descrizione: bolletta.descrizione, voceId: 'v-ut', personaId: null, annullato: false }]
  })
  await ripeti('riprova quando nel frattempo il giorno si è chiuso', (d) => {
    d.chiusure_ora = [...chiusure, { id: 'k14', cassaId: 'c2', dal: '2026-10-01', data: '2026-10-15', previsto: 0, contato: 0, differenza: 0, chiusaIl: '2026-10-15T19:00:00Z' }]
  })

  console.log('   «Registrato» dice quel che il database ha scritto, non quel che è stato mandato')
  const d8 = finto({ restituisce: { descrizione: 'Enel Energia · bolletta 123', importo: 31241, data: '2026-10-13', voce_id: 'v-aff', cassa_id: 'c1' } })
  const scritto = await provaA(() => manda(strumento('registra_movimento', bolletta), { db: d8 }))
  const [ts] = prova(() => esito(scritto))
  ok('la descrizione restituita, non quella mandata', prova(() => [ts.includes('Enel Energia · bolletta 123'), ts.includes(bolletta.descrizione)]), [true, false])
  ok('…l\'importo, la data, la voce e la cassa restituiti', prova(() => [ts.includes('312,41'), ts.includes('13/10/2026'), ts.includes('Affitto sala'), ts.includes('Cassa Contanti')]), [true, true, true, true])

  console.log('   l\'importo mandato come numero')
  const numero = async (importo) => {
    const d = finto()
    const r = await provaA(() => manda(strumento('registra_movimento', { ...bolletta, importo }), { db: d }))
    return [prova(() => d.scritti.map((x) => x.importo)), prova(() => esito(r)[1])]
  }
  ok('12.34 sono 1234 centesimi', await numero(12.34), [[1234], false])
  ok('1234.5 sono 123450', await numero(1234.5), [[123450], false])
  const d9 = finto()
  const tre = await provaA(() => manda(strumento('registra_movimento', { ...bolletta, importo: 12.345 }), { db: d9 }))
  ok('12.345 non si capisce (non sono 12.345 euro)', prova(() => esito(tre)), ['L’importo non si capisce', true])
  ok('…e non scrive', d9.scritti.length, 0)
}

console.log('\n11. quando qualcosa va storto')
{
  const scaduto = await provaA(() => manda(strumento('voci', { tipo: 'uscita' }), { db: finto({ guasto: { code: 'PGRST301', message: 'JWT expired' } }) }))
  ok('il token scaduto: «Accedi di nuovo a ODS Corsi»', prova(() => esito(scaduto)), [MSG_ACCEDI, true])
  const rete = await provaA(() => manda(strumento('casse', {}), { db: finto({ guasto: new TypeError('fetch failed') }) }))
  ok('la rete che non va: un errore, mai «fetch failed»', prova(() => { const [t, e] = esito(rete); return [e, typeof t === 'string' && t.length > 0, /fetch/i.test(t)] }), [true, true, false])
  const chiusoNelFrattempo = await provaA(() => manda(strumento('registra_movimento', bolletta), { db: finto({ guastoScrittura: { code: '22023', message: MSG_CHIUSO } }) }))
  ok('il database rifiuta con le sue parole: passano com\'è', prova(() => esito(chiusoNelFrattempo)), [MSG_CHIUSO, true])
  const nonCe = await provaA(() => manda(strumento('registra_movimento', bolletta), { db: finto({ guastoScrittura: { code: 'PGRST202', message: 'Could not find the function public.registra_movimento_dalla_chat(dati) in the schema cache' } }) }))
  ok('una funzione che manca sul database: mai il testo di PostgREST', prova(() => { const [t, e] = esito(nonCe); return [e, /PGRST|schema cache|registra_movimento_dalla_chat/.test(t)] }), [true, false])
}

console.log('\n12. nell\'app: il consenso a Claude e il segno DALLA CHAT')
{
  ok('l\'autorizzazione arriva nella query da Supabase', prova(() => collega.autorizzazioneDa('?authorization_id=abc-123')), 'abc-123')
  ok('…senza, niente', prova(() => [collega.autorizzazioneDa(''), collega.autorizzazioneDa('?authorization_id=')]), [null, null])
  const puo = (p) => prova(() => collega.puoCollegare(p))
  ok('chi ha l\'amministrazione può collegare Claude', puo({ ruolo: 'amministrazione' }), true)
  ok('…anche la segreteria che cura i conti', puo({ ruolo: 'staff', ancheAmministrazione: true }), true)
  ok('la segreteria semplice no, l\'istruttore no, il tablet no', [puo({ ruolo: 'staff' }), puo({ ruolo: 'istruttore' }), puo(null)], [false, false, false])
  const manuale = { id: 'm1', tipo: 'uscita', data: '2026-10-14', importo: 31240, voceId: 'v-ut', cassaId: 'c2', descrizione: 'Enel · bolletta n. 123 · set 2026', creatoIl: '2026-10-20T08:00:00Z' }
  const riga = (x) => prova(() => conti.righeMovimenti([], [x], voci)[0])
  ok('il movimento dalla chat ha il segno nella sua riga', prova(() => riga({ ...manuale, dallaChat: true }).dallaChat), true)
  ok('…gli altri no', prova(() => riga(manuale).dallaChat ?? false), false)
  ok('la frase sotto il movimento aperto, col giorno di Roma', prova(() => collega.fraseDallaChat(riga({ ...manuale, dallaChat: true }))), 'Registrato dalla chat con Claude il 20/10/2026.')
  ok('…e niente per un movimento scritto nell\'app', prova(() => collega.fraseDallaChat(riga(manuale))), null)
}

console.log('\n13. oggiARoma anche da mcp.ts (per il file Deno), la stessa di contabilita.ts')
{
  ok('mcp.ts la esporta', typeof mcp.oggiARoma, 'function')
  const quando = ['2026-10-20T21:59:00Z', '2026-10-20T22:30:00Z', '2026-12-31T23:30:00Z', '2026-03-29T00:30:00Z']
  ok('alle 23:59, a mezzanotte e mezza, a capodanno, col cambio d\'ora: il giorno di Roma',
    prova(() => quando.map((q) => mcp.oggiARoma(new Date(q)))), ['2026-10-20', '2026-10-21', '2027-01-01', '2026-03-29'])
  ok('…come contabilita.ts', prova(() => quando.map((q) => mcp.oggiARoma(new Date(q)))), prova(() => quando.map((q) => conti.oggiARoma(new Date(q)))))
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
