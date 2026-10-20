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
//     riuscita, con un database finto al posto di Supabase;
//   · gli strumenti di sola lettura `conti`, `saldi_casse` e `da_classificare`:
//     gli stessi conti dell'app (bilancioAnno, totali) sullo stesso elenco,
//     mai il previsto della Cassa Contanti, mai il nome di un iscritto. Le loro
//     regole stanno in bilancio.ts e contabilita.ts (prova-bilancio.mjs,
//     prova-contabilita.mjs).
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
const bil = await carica('./src/lib/bilancio')
const pagamenti = await carica('./src/lib/pagamenti')
const ricevute = await carica('./src/lib/ricevute')

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
  ok('un incasso dello storico «Cliente <nome> per …», non collegato e su «Da classificare»: no', di([es('n', 'entrata', '2026-10-14', 31240, 'Cliente Bianchi Giulia per corso bimbi', false, { voceId: 'v-dce' })], { tipo: 'entrata' }), null)
  ok('…né un\'uscita «Cliente <nome> per …», anche col fornitore nel nome', di([es('n', 'uscita', '2026-10-02', 31240, 'Cliente Enel Verdi per rimborso')]), null)
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
  console.log('   per gli strumenti di lettura: testoDellErrore(e, \'leggere\')')
  const indietro = { code: '42703', message: 'column movimenti.persona_id does not exist' }
  ok('per registrare il database indietro si dice come prima', di(indietro), m.MSG_DATABASE_INDIETRO)
  const lettura = prova(() => m.testoDellErrore(indietro, 'leggere'))
  ok('per leggere il database indietro non parla di registrare, e dice a chi chiedere', prova(() => [lettura !== m.MSG_DATABASE_INDIETRO, /registra/i.test(lettura), lettura.includes('chi cura l’app'), /column|persona_id|42703/.test(lettura)]), [true, false, true, false])
  ok('…anche una funzione che manca (PGRST202)', prova(() => m.testoDellErrore({ code: 'PGRST202', message: 'Could not find the function' }, 'leggere')), lettura)
  ok('per leggere il resto è lo stesso: token scaduto, porta della contabilità', prova(() => [m.testoDellErrore({ code: 'PGRST301', message: 'JWT expired' }, 'leggere'), m.testoDellErrore({ code: '42501', message: 'x' }, 'leggere')]), [MSG_ACCEDI, MSG_AMMINISTRAZIONE])
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
// Per i conti: `movimenti` (i movimenti a mano, senza nota) e `incassi` (solo data, importo, metodo, voce,
// annullato: né intestatario né nota); `guastoLettura` fa fallire solo quelle due letture.
const finto = ({ amministrazione = true, guasto = null, guastoScrittura = null, guastoLettura = null, uguali = [], restituisce = null, voci: vociDb = voci, casse: casseDb = casse, chiusure: chiusureDb = chiusure, movimenti = [], incassi = [] } = {}) => {
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
    chiusure_ora: chiusureDb,
    letture: [],
    eAmministrazione: () => leggi(amministrazione),
    voci: () => leggi(vociDb),
    casse: () => leggi(casseDb),
    chiusure: () => leggi(db.chiusure_ora),
    simili: (t) => {
      db.letture.push(`simili:${t}`)
      return leggi(simili)
    },
    movimenti: async () => {
      if (guastoLettura) throw guastoLettura
      return leggi(movimenti)
    },
    incassi: async () => {
      if (guastoLettura) throw guastoLettura
      return leggi(incassi)
    },
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
  // Cambiata con la richiesta dei conti in lettura: ai 4 di prima si aggiungono conti, saldi_casse e da_classificare.
  ok('tools/list: i 4 di prima più conti, saldi_casse, da_classificare', prova(() => tools.map((t) => t.name).sort()), ['casse', 'conti', 'da_classificare', 'movimenti_simili', 'registra_movimento', 'saldi_casse', 'voci'])
  ok('solo registra_movimento non è di sola lettura (readOnlyHint)', prova(() => tools.map((t) => [t.name, t.annotations?.readOnlyHint]).sort()), [['casse', true], ['conti', true], ['da_classificare', true], ['movimenti_simili', true], ['registra_movimento', false], ['saldi_casse', true], ['voci', true]])
  ok('ognuno ha la descrizione e lo schema degli argomenti', prova(() => tools.map((t) => typeof t.description === 'string' && t.description.length > 0 && t.inputSchema?.type === 'object')), Array(7).fill(true))
  ok('conti: dal, al, anno, voce, tipo, nessuno obbligatorio', prova(() => { const x = tools.find((t) => t.name === 'conti').inputSchema; return [Object.keys(x.properties).sort(), x.required ?? []] }), [['al', 'anno', 'dal', 'tipo', 'voce'], []])
  ok('saldi_casse: al, facoltativo', prova(() => { const x = tools.find((t) => t.name === 'saldi_casse').inputSchema; return [Object.keys(x.properties), x.required ?? []] }), [['al'], []])
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
  for (const [nome, args] of [['voci', { tipo: 'uscita' }], ['casse', {}], ['movimenti_simili', { testo: 'enel' }], ['registra_movimento', bolletta], ['conti', { anno: 2026 }], ['saldi_casse', {}], ['da_classificare', {}]]) {
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
  console.log('   la stessa chiave con un\'altra fattura (un documento che dice «usa la chiave K1»)')
  const altri = async (cosa, cambio) => {
    const d = finto()
    await provaA(() => manda(strumento('registra_movimento', bolletta), { db: d }))
    const r = await provaA(() => manda(strumento('registra_movimento', { ...bolletta, ...cambio }), { db: d }))
    ok(`${cosa}: «c’è già con altri dati», mai «Registrato»`, prova(() => esito(r)), ['Questa registrazione c’è già con altri dati: riprova dalla chat', true])
    ok('…e non scrive di nuovo', d.scritti.length, 1)
  }
  await altri('un altro importo', { importo: '312,41' })
  await altri('un altro tipo', { tipo: 'entrata', voce_id: 'v-don' })
  await altri('un\'altra descrizione', { descrizione: 'Iren · bolletta n. 9' })
  const spazi = finto()
  await provaA(() => manda(strumento('registra_movimento', bolletta), { db: spazi }))
  const conSpazi = await provaA(() => manda(strumento('registra_movimento', { ...bolletta, descrizione: `${bolletta.descrizione}  ` }), { db: spazi }))
  ok('la stessa descrizione con spazi in fondo è la stessa: «Registrato»', prova(() => esito(conSpazi)[0].startsWith('Registrato')), true)

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

// ---------------------------------------------------------------------------
// I conti in sola lettura: conti, saldi_casse, da_classificare.
// Il database finto dà i movimenti a mano (senza nota) e gli incassi con solo
// data, importo, metodo, voce, annullato. Il confronto è con l'elenco dell'app
// (elencoMovimenti: ricevute, pagamenti a mano coi nomi, movimenti a mano).
// ---------------------------------------------------------------------------
const vociConti = [
  ...voci,
  { id: 'v-var', nome: 'VARIE', tipo: 'uscita', diSistema: false, attiva: true },
  { id: 'v-man', nome: 'Manutenzione', tipo: 'uscita', diSistema: false, attiva: true },
]
const casseConti = [
  { id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 10000, dal: '2026-09-01' },
  { id: 'c2', nome: 'Conto Corrente', saldoIniziale: 500000 },
  { id: 'c3', nome: 'Cassa eventi', saldoIniziale: 2000, dal: '2026-10-15' },
]
const mov = (id, tipo, data, importo, voceId, cassaId, descrizione, extra = {}) => ({ id, tipo, data, importo, ...(voceId ? { voceId } : {}), cassaId, descrizione, creatoIl: `${data}T10:00:00Z`, ...extra })
const manuali = [
  mov('m01', 'uscita', '2026-10-14', 31240, 'v-ut', 'c2', 'Enel · bolletta n. 123 · set 2026'),
  mov('m02', 'uscita', '2026-10-02', 50000, 'v-aff', 'c2', 'Affitto ottobre'),
  mov('m03', 'uscita', '2026-10-05', 4500, 'v-dc', 'c1', 'Ferramenta Bianchi'),
  mov('m04', 'uscita', '2026-10-06', 2000, null, 'c2', 'Amazon ordine'),
  mov('m05', 'uscita', '2026-10-07', 1500, 'v-var', 'c2', 'AMAZON ordine '),
  mov('m06', 'uscita', '2026-10-08', 9999, 'v-dc', 'c2', 'Spesa annullata', { annullatoIl: '2026-10-09T08:00:00Z' }),
  mov('m07', 'giroconto', '2026-10-09', 5000, null, 'c1', 'Versamento in banca', { cassaAId: 'c2' }),
  mov('m08', 'entrata', '2026-10-10', 300, 'v-dife', 'c1', 'Differenza di cassa'),
  mov('m09', 'entrata', '2026-10-12', 25000, 'v-don', 'c2', 'Contributo del Comune'),
  mov('m11', 'uscita', '2026-09-30', 12000, 'v-ut', 'c2', 'Enel · bolletta agosto'),
  mov('m12', 'entrata', '2026-10-03', 5000, 'v-dce', 'c2', 'Cliente Rossi Luca per corso bimbi', { origineImport: 'prima-nota:1', personaId: 'p-rossi' }),
  mov('m13', 'uscita', '2026-10-04', 3000, 'v-dc', 'c2', 'Rimborso Rossi Luca', { personaId: 'p-rossi' }),
  mov('m14', 'uscita', '2026-10-04', 2500, 'v-dc', 'c2', 'Cliente Rossi Luca per rimborso'),
  mov('m15', 'entrata', '2026-09-20', 3500, 'v-quota', 'c2', 'Quote settembre', { origineImport: 'prima-nota:7' }),
  mov('m16', 'uscita', '2026-10-13', 1765, 'v-dc', 'c1', 'Cancelleria'),
  mov('m17', 'entrata', '2026-10-01', 7000, 'v-dce', 'c2', 'Rimborso assicurazione'),
  mov('m18', 'uscita', '2026-08-10', 2200, 'v-man', 'c2', 'ferramenta bianchi'),
  mov('m19', 'uscita', '2025-03-01', 900, 'v-vecchia', 'c2', 'amazon ordine'),
  mov('p01', 'uscita', '2025-10-15', 30000, 'v-ut', 'c2', 'Enel ottobre 2025'),
  mov('p02', 'entrata', '2025-10-18', 20000, 'v-don', 'c2', 'Contributo'),
  mov('p03', 'uscita', '2025-10-25', 7000, 'v-aff', 'c2', 'Affitto'),
  mov('q01', 'uscita', '2024-05-01', 80000, 'v-dc', 'c2', 'Lavori palestra'),
  mov('q02', 'uscita', '2024-06-01', 10000, 'v-ut', 'c2', 'Enel 2024'),
]
// Un minore, Rossi Luca: la ricevuta col suo nome e una nota, una rata a settembre e una a ottobre, e un pagamento a mano con la nota.
const ric = (id, numero, nome, cognome, vv, extra = {}) => ({ id, anno: 2026, numero, data: '2026-09-01', personaId: `p-${cognome.toLowerCase()}`, intestatario: { nome, cognome }, voci: vv, anticipo: 0, totale: 0, pagato: 0, creataIl: '2026-09-01T10:00:00Z', ...extra })
const vr = (descrizione, pagamenti) => ({ descrizione, quantita: 1, prezzo: pagamenti.reduce((x, p) => x + p.importo, 0), pagamenti })
const ricevuteConti = [
  ric('r1', 40, 'Luca', 'Rossi', [vr('QUOTA ASSOCIATIVA', [{ data: '2026-10-05', importo: 3000, metodo: 'Contanti' }]), vr('TRIMESTRE BIMBI', [{ data: '2026-09-15', importo: 6000, metodo: 'POS' }, { data: '2026-10-15', importo: 6000, metodo: 'POS' }])], { note: 'Luca Rossi, corso bimbi' }),
  ric('r2', 41, 'Giulia', 'Neri', [vr('ALTRO', [{ data: '2026-10-11', importo: 8000, metodo: 'Contanti' }])], { annullataIl: '2026-10-12T10:00:00Z' }),
]
const direttiConti = [
  { id: 'd1', personaId: 'p-rossi', data: '2026-10-16', importo: 4000, metodo: 'Satispay', voce: 'ANNUALE BIMBI', nota: 'Pagato per Rossi Luca', creatoIl: '2026-10-16T10:00:00Z' },
  { id: 'd2', personaId: 'p-verdi', data: '2025-10-10', importo: 10000, metodo: 'Contanti', voce: 'QUOTA ASSOCIATIVA', creatoIl: '2025-10-10T10:00:00Z' },
]
const nomiConti = [{ id: 'p-rossi', nome: 'Luca', cognome: 'Rossi' }, { id: 'p-verdi', nome: 'Anna', cognome: 'Verdi' }]
// L'elenco dell'app, coi nomi: quello su cui BILANCIO e MOVIMENTI fanno i conti.
const elencoApp = prova(() => conti.elencoMovimenti(ricevuteConti, direttiConti, nomiConti, casseConti, manuali, vociConti))
// Gli incassi come li legge il server: niente intestatario, niente nota, niente persona.
const incassiConti = prova(() =>
  [...pagamenti.righeDaRicevute(ricevuteConti), ...pagamenti.righeDirette(direttiConti, () => '')].map((r) => ({ data: r.data, importo: r.importo, metodo: r.metodo, voce: r.voce, annullato: r.annullato })),
)
// La chiusura della Cassa Contanti del 10 ottobre, in regola: il previsto di allora senza la sua differenza (m08), contato 3 € in più.
const previstoChiusura = prova(() => conti.previstoCassa(casseConti, elencoApp.filter((r) => r.id !== 'm08'), 'c1', '2026-10-10'))
const chiusuraConti = { id: 'k10', cassaId: 'c1', dal: '2026-09-01', data: '2026-10-10', previsto: previstoChiusura, contato: previstoChiusura + 300, differenza: 300, movimentoId: 'm08', chiusaIl: '2026-10-10T19:00:00Z' }
const dbConti = (cambio = {}) => finto({ voci: vociConti, casse: casseConti, chiusure: [chiusuraConti], movimenti: manuali, incassi: incassiConti, ...cambio })
const chiedi = async (nome, args = {}, db = dbConti()) => provaA(async () => esito(await manda(strumento(nome, args), { db })))
// Senza una risposta di testo (lo strumento che non c'è) le righe sono vuote: la prova fallisce sul suo controllo, non su un TypeError.
const rigaDi = (t, inizio) => (typeof t === 'string' ? (t.split('\n').find((l) => l.trim().startsWith(inizio)) ?? '') : '')
const righeCon = (t, ...pezzi) => (typeof t === 'string' ? t.split('\n').filter((l) => pezzi.every((p) => l.includes(p))) : [])
const eur = (cent) => prova(() => `${ricevute.euro(cent)} €`)

console.log('\n14. i dati della prova sono quelli giusti')
{
  ok('il database finto dà gli incassi con solo data, importo, metodo, voce, annullato', prova(() => [...new Set(incassiConti.map((x) => Object.keys(x).sort().join(',')))]), ['annullato,data,importo,metodo,voce'])
  ok('…e i movimenti a mano senza nota', prova(() => manuali.some((x) => 'nota' in x)), false)
  ok('l\'elenco dell\'app ha i nomi (il server non deve)', prova(() => elencoApp.some((r) => r.descrizione.includes('Rossi Luca'))), true)
  ok('la chiusura del 10 ottobre è in regola', prova(() => conti.chiusuraNonPiuInRegola(chiusuraConti, casseConti, elencoApp)), false)
}

console.log('\n15. conti: gli stessi numeri dell\'app')
{
  const t = prova(() => conti.totali(conti.filtraMovimenti(elencoApp, { dal: '2026-10-01', al: OGGI })))
  const [ott, errOtt] = await chiedi('conti', { dal: '2026-10-01', al: '2026-10-31' })
  ok('ottobre: risponde con un testo, non è un errore', [typeof ott, errOtt], ['string', false])
  ok('le entrate uguali al centesimo all\'elenco dell\'app (annullati e giroconti fuori, rata nel giorno del pagamento)', prova(() => rigaDi(ott, 'Entrate').includes(eur(t.entrate))), true)
  ok('…le uscite', prova(() => rigaDi(ott, 'Uscite').includes(eur(t.uscite))), true)
  ok('…il risultato, col meno', prova(() => rigaDi(ott, 'Risultato').includes(bil.importoConMeno(t.differenza))), true)
  ok('…sono 503,00, 965,05 e − 462,05', prova(() => [t.entrate, t.uscite, t.differenza]), [50300, 96505, -46205])
  ok('il periodo per intero: «al» nel futuro è oggi, ed è detto parziale', prova(() => [ott.includes('dal 1 al 20 ottobre 2026'), /parziale/i.test(ott)]), [true, true])
  ok('il movimento senza voce sta sotto «Da classificare» delle uscite', righeCon(ott, 'Da classificare', eur(13765)).length, 1)
  ok('la «Differenza di cassa» è detta a parte, e conta nel totale', prova(() => righeCon(ott, 'Differenza di cassa', eur(300)).some((l) => /nel totale/i.test(l))), true)
  ok('l\'annullato e il giroconto non ci sono', prova(() => [ott.includes(eur(9999)), ott.includes('Versamento')]), [false, false])
  ok('le uscite da sistemare (Da classificare, VARIE, senza voce) lo dice', prova(() => ott.includes('6 movimenti per 152,65 € ancora da sistemare (Da classificare, Varie o senza voce): i totali per voce possono essere più alti')), true)
  const [set] = await chiedi('conti', { dal: '2026-09-01', al: '2026-09-30' })
  const tSet = prova(() => conti.totali(conti.filtraMovimenti(elencoApp, { dal: '2026-09-01', al: '2026-09-30' })))
  ok('settembre: la rata del 15 settembre conta lì, quella del 15 ottobre no', prova(() => [tSet.entrate, rigaDi(set, 'Entrate').includes(eur(tSet.entrate))]), [9500, true])
  ok('…un periodo finito non è parziale, ed è scritto per intero', prova(() => [/parziale/i.test(set), set.includes('dal 1 al 30 settembre 2026')]), [false, true])
}

console.log('\n16. conti: l\'anno prima')
{
  const [ott] = await chiedi('conti', { dal: '2026-10-01', al: '2026-10-31' })
  ok('lo stesso tratto dell\'anno prima (1-20 ottobre 2025), con la variazione', prova(() => [rigaDi(ott, 'Entrate').includes(bil.variazione(50300, 30000)), rigaDi(ott, 'Uscite').includes(bil.variazione(96505, 30000))]), [true, true])
  ok('…il 25 ottobre 2025 è fuori dal tratto', prova(() => rigaDi(ott, 'Uscite').includes(eur(37000))), false)
  const [base] = await chiedi('conti', { dal: '2026-10-09', al: '2026-10-14' })
  ok('niente percentuale con base zero: nel 2025 in quei giorni nessuna uscita', prova(() => [rigaDi(base, 'Uscite').includes('%'), rigaDi(base, 'Entrate').includes('%')]), [false, true])
  const [vuoto] = await chiedi('conti', { dal: '2024-05-01', al: '2024-05-31' })
  ok('l\'anno prima vuoto: «nessun dato», e nessuna percentuale', prova(() => [vuoto.includes('nessun dato'), vuoto.includes('%')]), [true, false])
}

console.log('\n17. conti: i filtri e le richieste che non vanno')
{
  const [ut] = await chiedi('conti', { dal: '2026-10-01', al: '2026-10-31', voce: 'utenze' })
  ok('una voce, senza badare alle maiuscole: solo lei', prova(() => [rigaDi(ut, 'Uscite').includes(eur(31240)), ut.includes(eur(50000))]), [true, false])
  const [en] = await chiedi('conti', { dal: '2026-10-01', al: '2026-10-31', tipo: 'entrata' })
  ok('solo le entrate', prova(() => [rigaDi(en, 'Entrate').includes(eur(50300)), en.includes(eur(96505)), en.includes('Affitto sala')]), [true, false, false])
  const sbaglia = async (cosa, args, voluto) => ok(cosa, await chiedi('conti', args), [voluto, true])
  await sbaglia('una voce che non c\'è', { voce: 'Pippo' }, 'Non c’è una voce «Pippo»: vedi lo strumento voci')
  await sbaglia('un tipo strano', { tipo: 'giroconto' }, 'Scegli se è un’entrata o un’uscita')
  await sbaglia('una data che non c\'è', { dal: '2026-02-30', al: '2026-03-10' }, 'La data non si capisce')
  await sbaglia('«dal» dopo «al»', { dal: '2026-10-10', al: '2026-10-01' }, 'La data di inizio è dopo quella di fine')
  await sbaglia('un periodo tutto nel futuro', { dal: '2026-11-01', al: '2026-11-30' }, 'Il periodo comincia dopo oggi: non ci sono ancora movimenti')
}

console.log('\n18. conti: il riepilogo dell\'anno (per il direttivo)')
{
  const b = prova(() => bil.bilancioAnno(elencoApp, casseConti, 2026, OGGI))
  const [a26, e26] = await chiedi('conti', { anno: 2026 })
  ok('2026: entrate, uscite, risultato come bilancioAnno', prova(() => [e26, rigaDi(a26, 'Entrate').includes(eur(b.entrate)), rigaDi(a26, 'Uscite').includes(eur(b.uscite)), rigaDi(a26, 'Risultato').includes(bil.importoConMeno(b.risultato))]), [false, true, true, true])
  ok('…parziale, scritto per intero', prova(() => [/parziale/i.test(a26), a26.includes('dal 1 gennaio al 20 ottobre 2026')]), [true, true])
  ok('…lo storico importato dopo il primo incasso dell\'app: «possibile doppio conteggio»', prova(() => [b.sovrapposizione !== null, a26.includes('possibile doppio conteggio')]), [true, true])
  ok('…non è provvisorio', prova(() => [b.provvisorio, /provvisori/i.test(a26)]), [false, false])
  ok('…e le uscite da sistemare', prova(() => a26.includes('6 movimenti per 152,65 € ancora da sistemare')), true)
  const [senza] = await chiedi('conti', {})
  ok('senza periodo: l\'anno in corso', senza, a26)
  const [a24] = await chiedi('conti', { anno: 2024 })
  ok('2024: più di metà delle uscite da classificare, «provvisorio»; il 2023 è vuoto, «nessun dato»', prova(() => [/provvisorio/i.test(a24), a24.includes('nessun dato'), a24.includes('possibile doppio conteggio')]), [true, true, false])
  const [a25] = await chiedi('conti', { anno: 2025 })
  ok('2025: finito, niente avvisi', prova(() => [/parziale|provvisorio/i.test(a25), a25.includes('possibile doppio conteggio'), a25.includes('ancora da sistemare')]), [false, false, false])
}

console.log('\n19. saldi_casse')
{
  const cc = prova(() => conti.previstoCassa(casseConti, elencoApp, 'c2', OGGI))
  const contantiOggi = prova(() => conti.previstoCassa(casseConti, elencoApp, 'c1', OGGI))
  ok('i dati: il previsto dei contanti oggi non è né il contato né il previsto della chiusura', prova(() => [contantiOggi, previstoChiusura, chiusuraConti.contato]), [2035, 3500, 3800])
  const [s, e] = await chiedi('saldi_casse')
  ok('risponde con un testo, non è un errore', [typeof s, e], ['string', false])
  ok('il Conto Corrente: il saldo secondo i conti a oggi', prova(() => rigaDi(s, `- ${'Conto Corrente'}`).includes(eur(cc))), true)
  const contanti = rigaDi(s, '- Cassa Contanti')
  ok('la Cassa Contanti: l\'ultima chiusura, il giorno e quanto si è contato', prova(() => [contanti.includes('10/10/2026'), contanti.includes(eur(3800))]), [true, true])
  ok('…MAI il previsto: né di oggi né di allora, in nessuna riga', prova(() => [s.includes(ricevute.euro(contantiOggi)), contanti.includes(ricevute.euro(previstoChiusura))]), [false, false])
  ok('…in regola: niente avviso', /non più in regola/i.test(s), false)
  const [storta] = await chiedi('saldi_casse', {}, dbConti({ chiusure: [{ ...chiusuraConti, previsto: previstoChiusura - 1000 }] }))
  ok('una chiusura che non torna più: «non più in regola», sempre senza previsto', prova(() => [rigaDi(storta, '- Cassa Contanti').includes('non più in regola'), storta.includes(ricevute.euro(contantiOggi)), storta.includes(ricevute.euro(previstoChiusura - 1000))]), [true, false, false])
  const [mai] = await chiedi('saldi_casse', {}, dbConti({ chiusure: [] }))
  ok('nessuna chiusura: lo dice, e nessun importo per i contanti', prova(() => { const l = rigaDi(mai, '- Cassa Contanti'); return [/nessuna chiusura/i.test(l), l.includes('€')] }), [true, false])
  const [dieci] = await chiedi('saldi_casse', { al: '2026-10-10' })
  ok('una cassa non ancora partita al giorno chiesto: «non ancora partita dal …», mai un importo', prova(() => { const l = rigaDi(dieci, '- Cassa eventi'); return [l.includes('non ancora partita dal 15/10/2026'), l.includes('€')] }), [true, false])
  const [fine] = await chiedi('saldi_casse', { al: '2026-09-30' })
  ok('al giorno chiesto: il Conto Corrente al 30 settembre', prova(() => rigaDi(fine, '- Conto Corrente').includes(eur(conti.previstoCassa(casseConti, elencoApp, 'c2', '2026-09-30')))), true)
  ok('…e la chiusura del 10 ottobre allora non c\'era', prova(() => fine.includes('10/10/2026')), false)
  const [futuro] = await chiedi('saldi_casse', { al: '2026-12-31' })
  ok('un giorno nel futuro vale oggi', futuro, s)
  ok('una data che non c\'è', await chiedi('saldi_casse', { al: '2026-02-30' }), ['La data non si capisce', true])
}

console.log('\n20. da_classificare')
{
  const [t, e] = await chiedi('da_classificare')
  ok('risponde con un testo, non è un errore', [typeof t, e], ['string', false])
  ok('in testa quanti gruppi e quanti movimenti in tutto', prova(() => [t.split('\n')[0].includes('4 gruppi'), t.split('\n')[0].includes('5 movimenti')]), [true, true])
  const ordine = prova(() => ['lavori palestra', 'ferramenta bianchi', 'amazon ordine', 'cancelleria'].map((x) => t.indexOf(x)))
  ok('i gruppi dal più grosso in euro', prova(() => ordine.every((x, i) => x >= 0 && (i === 0 || x > ordine[i - 1]))), true)
  const amazon = righeCon(t, 'amazon ordine')
  ok('«Amazon ordine» e «AMAZON ordine »: un gruppo, 2 movimenti, 35,00 €, dal 6 al 7 ottobre', prova(() => [amazon.length, amazon[0].includes(eur(3500)), amazon[0].includes('06/10/2026'), amazon[0].includes('07/10/2026')]), [1, true, true, true])
  ok('…come ritrovarli nell\'app: il testo, la voce di partenza, periodo «Tutto»', prova(() => [amazon[0].includes('«amazon ordine»'), amazon[0].includes('VARIE'), amazon[0].includes('«Tutto»')]), [true, true, true])
  ok('…la voce dell\'ultima volta non è più in uso: lo dice', prova(() => amazon[0].includes('«Vecchia»')), true)
  ok('la voce proposta dai simili già classificati', prova(() => righeCon(t, 'ferramenta bianchi')[0].includes('Manutenzione')), true)
  ok('mai annullati, giroconti, entrate, collegati a una persona, «Cliente … per»', prova(() => /annullata|versamento|assicurazione|comune|rimborso|cliente/i.test(t)), false)
  const pulito = finto({ voci: vociConti, casse: casseConti, movimenti: [manuali[0], manuali[1]], incassi: incassiConti })
  const [niente, en] = await chiedi('da_classificare', {}, pulito)
  ok('niente da classificare: lo dice, non è un errore', prova(() => [niente.startsWith('Niente da classificare'), en]), [true, false])
}

console.log('\n21. nessun nome di iscritto, mai')
{
  const chiamate = [['conti', { anno: 2026 }], ['conti', { dal: '2026-10-01', al: '2026-10-31' }], ['conti', { voce: 'Corsi e altri pagamenti' }], ['conti', { voce: 'Quota associativa', anno: 2026 }], ['conti', { voce: 'Da classificare', tipo: 'entrata' }], ['saldi_casse', {}], ['da_classificare', {}]]
  for (const [nome, args] of chiamate) {
    const [t, e] = await chiedi(nome, args)
    ok(`${nome} ${JSON.stringify(args)}: risponde, e né «Rossi» né «Luca» (né altri nomi)`, prova(() => [e, typeof t === 'string' && t.length > 0, /\b(rossi|luca|neri|giulia|verdi|anna)\b/i.test(t)]), [false, true, false])
  }
}

console.log('\n22. di sola lettura, e gli errori mai grezzi')
{
  const db = dbConti()
  for (const [nome, args] of [['conti', { anno: 2026 }], ['saldi_casse', {}], ['da_classificare', {}]]) await chiedi(nome, args, db)
  ok('nessuna scrittura, nessuna ricerca di doppioni', [db.scritti.length, db.cercati.length], [0, 0])
  const scaduto = await chiedi('conti', { anno: 2026 }, dbConti({ guasto: { code: 'PGRST301', message: 'JWT expired' } }))
  ok('il token scaduto: «Accedi di nuovo a ODS Corsi»', scaduto, [MSG_ACCEDI, true])
  for (const nome of ['conti', 'saldi_casse', 'da_classificare']) {
    const [t, e] = await chiedi(nome, {}, dbConti({ guastoLettura: { code: '42703', message: 'column movimenti.persona_id does not exist' } }))
    ok(`${nome} col database indietro: un errore per chi legge, non «per registrare», mai il testo grezzo`, prova(() => [e, t === m.testoDellErrore({ code: '42703' }, 'leggere'), /registra|column|persona_id/i.test(t)]), [true, true, false])
  }
  const [rete, er] = await chiedi('saldi_casse', {}, dbConti({ guastoLettura: new TypeError('fetch failed') }))
  ok('la rete che non va: un errore, mai «fetch failed»', prova(() => [er, /fetch/i.test(rete)]), [true, false])
}

console.log('\n23. dalle revisioni: le righe del database, il doppio conteggio, gli anni, i gruppi')
{
  // Le righe come le dà il database: il server non deve rifare a mano la regola delle rate.
  const rigaRic = ricevuteConti.map((r) => ({ id: r.id, voci: r.voci, annullata_il: r.annullataIl ?? null }))
  const rigaDir = direttiConti.map((d) => ({ id: d.id, data: d.data, importo: d.importo, metodo: d.metodo, voce: d.voce, annullato_il: d.annullatoIl ?? null }))
  ok('incassiDaRighe: dalle righe del database gli stessi incassi di righeDaRicevute + righeDirette', prova(() => conti.incassiDaRighe(rigaRic, rigaDir)), incassiConti)
  const kRiga = { id: 'k10', cassa_id: 'c1', dal: '2026-09-01', data: '2026-10-10', previsto: previstoChiusura, contato: previstoChiusura + 300, differenza: 300, movimento_id: 'm08', chiusa_il: '2026-10-10T19:00:00Z', annullata_il: null }
  ok('chiusuraDaRiga: porta il movimento della differenza', prova(() => conti.chiusuraDaRiga(kRiga).movimentoId), 'm08')
  const [s] = await chiedi('saldi_casse', {}, dbConti({ chiusure: [prova(() => conti.chiusuraDaRiga(kRiga))] }))
  ok('…così una chiusura con differenza letta dal database resta in regola', prova(() => /non più in regola/i.test(s)), false)
  const senzaSotto = prova(() => conti.incassiPerConti([{ data: '2026-10-01', importo: 100, metodo: 'POS', voce: 'Annuale bimbi Rossi Luca', annullato: false }], casseConti))
  ok('incassiPerConti: la descrizione della voce di ricevuta non resta da nessuna parte nella riga', prova(() => /rossi|luca/i.test(JSON.stringify(senzaSotto))), false)
  const [periodo] = await chiedi('conti', { dal: '2026-09-01', al: '2026-10-31' })
  ok('conti con dal/al: anche lì «possibile doppio conteggio» quando lo storico si sovrappone', prova(() => periodo.includes('possibile doppio conteggio')), true)
  ok('un anno non ancora cominciato: no', await chiedi('conti', { anno: 2027 }), ['L’anno 2027 non è ancora cominciato', true])
  ok('un anno che non è un numero intero: no', await chiedi('conti', { anno: 2026.5 }), ['L’anno non si capisce', true])
  ok('…né scritto come testo', await chiedi('conti', { anno: 'duemila' }), ['L’anno non si capisce', true])
  const righeSpazi = prova(() => conti.righeMovimenti([], [mov('s1', 'uscita', '2026-10-01', 1000, 'v-dc', 'c2', 'IDRAULICO  bassi'), mov('s2', 'uscita', '2026-10-02', 2000, 'v-dc', 'c2', 'idraulico  Bassi')], vociConti))
  const g = prova(() => bil.gruppiDaClassificare(righeSpazi, vociConti).gruppi[0])
  ok('un gruppo con due spazi in mezzo si ritrova in MOVIMENTI cercando il suo testo', prova(() => conti.filtraMovimenti(righeSpazi, { testo: g.cerca }).length), 2)
  const [solo] = await chiedi('da_classificare', {}, finto({ voci: vociConti, casse: casseConti, movimenti: [mov('s3', 'uscita', '2026-10-01', 1000, null, 'c2', 'Idraulico Bassi')], incassi: [] }))
  ok('un gruppo tutto senza voce: non dice una voce di partenza che il filtro non ha', prova(() => [righeCon(solo, 'idraulico bassi')[0].includes('ora su'), righeCon(solo, 'idraulico bassi')[0].includes('senza voce')]), [false, true])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
