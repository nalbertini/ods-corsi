// ---------------------------------------------------------------------------
// «Come paga» nell'iscrizione online, senza browser: chi si iscrive sceglie
// fra Satispay, carta, bonifico e contanti (in segreteria, in palestra); la
// ricevuta del bonifico è facoltativa; la segreteria vede la scelta.
//
//   node scripts/prova-come-paga.mjs
//
// Il design approvato è in docs/design-canvas/come-paga/. Le regole stanno in
// `src/lib/satispay.ts` (`Pago`, `modoPagamento`, `chiedeRicevuta`,
// `cosaNonVaModo`) e in `src/lib/comePaga.ts` (i modi da offrire, le frasi
// della pagina finale, i segni della segreteria). Il database è provato da
// `supabase/prova/come-paga.sql` (`supabase/160-come-paga.sql`): stessi casi.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const OGGI = new Date(2026, 10, 14, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI]))
  }
  static now() {
    return OGGI
  }
}
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '', pathname: '/iscrizioni/' }, addEventListener() {} }

// Un modulo per volta: uno che manca fa rosso i suoi casi, non ferma gli altri.
const carica = async (contents) => {
  try {
    const { outputFiles } = await build({
      stdin: { contents, resolveDir: '.', loader: 'ts' },
      bundle: true,
      format: 'esm',
      platform: 'node',
      write: false,
      logLevel: 'silent',
      define: { 'import.meta.env': '{}' },
    })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log(`  ✗ non si carica: ${contents}\n      ${String(e.message).split('\n').slice(0, 2).join(' ')}`)
    guai++
    return {}
  }
}
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = (fn) => {
  try {
    return fn()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
const aspetta = async (fn) => {
  try {
    return await fn()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const s = await carica("export * from './src/lib/satispay'")
// La parte nuova sta in `comePaga.ts`: finché manca, fanno rosso i suoi casi.
const c = await carica("export * from './src/lib/comePaga'")
const mp = await carica("export { acceso } from './src/lib/metodiPagamento'")
const rp = await carica("export { creaRichiesteProva } from './src/lib/richiesteProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'")
const rs = await carica("export { creaRichiesteSupabase } from './src/lib/richiesteSupabase'")
const pa = await carica("export * from './src/lib/paginaIscrizioni'")
const pi = await carica("export { nuovoStato, mancaNelPasso, risposteDaiPassi } from './src/lib/passiIscrizione'")
const ri = await carica("export { fileObbligatori, FILE } from './src/lib/richieste'")

const si = { satispay: true, carta: true }
const nessuno = { pronto: false, giaPagato: false }

console.log('1. il modo che vale: i contanti sono il quarto')
{
  ok('contanti scelto e acceso: contanti', prova(() => s.modoPagamento('contanti', si, false, true, true)), 'contanti')
  ok('contanti: acceso di partenza, senza dirlo', prova(() => s.modoPagamento('contanti', si, false)), 'contanti')
  ok('contanti scelto senza Satispay: contanti (non dipendono da Satispay)', prova(() => s.modoPagamento('contanti', { satispay: false }, false, true, true)), 'contanti')
  ok('contanti scelto ma spento: il bonifico', prova(() => s.modoPagamento('contanti', si, false, true, false)), 'bonifico')
  ok('contanti scelto, spenti insieme al bonifico: nessun modo', prova(() => s.modoPagamento('contanti', si, false, false, false)), null)
  ok('dal nucleo nessuna scelta, nemmeno contanti', prova(() => s.modoPagamento('contanti', si, true, true, true)), null)
  ok('il bonifico resta com’era con i contanti spenti', prova(() => s.modoPagamento('bonifico', si, false, true, false)), 'bonifico')
  ok('Satispay non possibile, contanti spenti: il bonifico, come prima', prova(() => s.modoPagamento('satispay', { satispay: false }, false, true, false)), 'bonifico')
  ok('niente scelto: si sceglie', prova(() => s.modoPagamento(null, si, false, true, true)), null)
  // I contanti spenti in IMPOSTAZIONI → COME SI PAGA: la scelta non si offre (`acceso`, metodiPagamento.ts).
  ok('spenti i contanti in IMPOSTAZIONI: acceso dice no', prova(() => mp.acceso(['contanti'], 'contanti')), false)
  ok('spento il bonifico: i contanti restano accesi', prova(() => mp.acceso(['bonifico'], 'contanti')), true)
}

console.log('\n2. la ricevuta: facoltativa col bonifico, mai coi contanti')
{
  ok('coi contanti non si chiede', prova(() => s.chiedeRicevuta('contanti', false)), false)
  ok('col bonifico si offre ancora', prova(() => s.chiedeRicevuta('bonifico', false)), true)
  ok('dal nucleo resta fra i file', prova(() => s.chiedeRicevuta(null, true)), true)
  const chiesti = [{ tipo: 'modulo', obbligatorio: true }, { tipo: 'documento', obbligatorio: true }, { tipo: 'ricevuta', obbligatorio: false }]
  ok('dal modulo pubblico la ricevuta non è mai obbligatoria', prova(() => ri.fileObbligatori(chiesti)), ['modulo', 'documento'])
  const modulo = readFileSync('src/components/ModuloIscrizione.tsx', 'utf8')
  ok('il modulo pubblico non passa il bonifico a fileObbligatori', /fileObbligatori\([^)]*bonifico/.test(modulo), false)
  ok('il modulo pubblico non scrive più «Non hai caricato la ricevuta: paga in segreteria»', modulo.includes('Non hai caricato la ricevuta: paga in segreteria'), false)
}

console.log('\n3. cosa ferma il modulo')
{
  ok('bonifico senza ricevuta: parte', prova(() => s.cosaNonVaModo('bonifico', false, false, nessuno)), null)
  ok('bonifico con la ricevuta: parte', prova(() => s.cosaNonVaModo('bonifico', false, true, nessuno)), null)
  ok('contanti: parte', prova(() => s.cosaNonVaModo('contanti', false, false, nessuno)), null)
  ok('contanti con la carta accesa: parte', prova(() => s.cosaNonVaModo('contanti', false, false, nessuno, true)), null)
  ok('senza scelta dalla pagina pubblica: si sceglie, come oggi', prova(() => s.cosaNonVaModo(null, false, false, nessuno)), 'Manca come paghi: Satispay o bonifico')
  ok('senza scelta, con la carta: come oggi', prova(() => s.cosaNonVaModo(null, false, false, nessuno, true)), 'Manca come paghi: Satispay, carta o bonifico')
  ok('dal nucleo non si sceglie', prova(() => s.cosaNonVaModo(null, true, false, nessuno)), null)
  // Pagato con Satispay e poi scelti i contanti: i soldi ci sono già, in un altro modo si pagherebbe due volte.
  ok('pagato con Satispay e poi scelti i contanti: non parte, lo dice', prova(() => s.cosaNonVaModo('contanti', false, false, { pronto: false, giaPagato: true })), s.GIA_PAGATO_SATISPAY)
}

console.log('\n4. i modi da offrire, nell’ordine')
{
  const tutti = { satispay: true, carta: true, bonifico: true, contanti: true }
  const id = (o) => prova(() => c.modiDaOffrire(o).map((x) => x.id))
  ok('tutti: Satispay, carta, bonifico, contanti', id(tutti), ['satispay', 'carta', 'bonifico', 'contanti'])
  ok('contanti spenti: non ci sono', id({ ...tutti, contanti: false }), ['satispay', 'carta', 'bonifico'])
  ok('senza Satispay e carta: bonifico e contanti', id({ ...tutti, satispay: false, carta: false }), ['bonifico', 'contanti'])
  ok('solo i contanti', id({ satispay: false, carta: false, bonifico: false, contanti: true }), ['contanti'])
  ok('niente acceso: nessuna scelta', id({ satispay: false, carta: false, bonifico: false, contanti: false }), [])
  const testo = (o, i) => prova(() => c.modiDaOffrire(o).find((x) => x.id === i))
  ok('bonifico: il testo del design', testo(tutti, 'bonifico')?.riga, 'La ricevuta la carichi se ce l’hai, se no la porti dopo')
  ok('contanti: il testo del design', testo(tutti, 'contanti')?.riga, 'Paghi in segreteria, in palestra')
  ok('contanti: si chiama «In contanti»', testo(tutti, 'contanti')?.testo, 'In contanti')
  ok('Satispay: il testo di oggi', testo(tutti, 'satispay')?.riga, 'Paghi subito, dall’app: l’importo è già scritto')
  ok('carta: il testo di oggi', testo(tutti, 'carta')?.riga, 'Paghi subito qui, senza app e senza aprire conti')
}

console.log('\n5. la pagina finale (RICHIESTA ARRIVATA)')
{
  // Il totale in centesimi, scritto con `soldi` come ogni altro importo della pagina.
  const frasi = (modo, cent, conRicevuta) => prova(() => c.frasiPagamentoFinale(modo, cent, conRicevuta))
  const importo = prova(() => s.soldi(18000))
  ok('contanti: quanto portare, dove e quando', frasi('contanti', 18000, false)?.[0], `Hai scelto di pagare in contanti: porti ${importo} in segreteria, in palestra, entro la prima lezione.`)
  ok('contanti: si può già venire a lezione', frasi('contanti', 18000, false)?.[1], 'Puoi già venire a lezione.')
  ok('contanti: due frasi e basta', frasi('contanti', 18000, false)?.length, 2)
  ok('contanti: la ricevuta non c’entra, nemmeno se c’è', frasi('contanti', 18000, true)?.length, 2)
  const senza = frasi('bonifico', 18000, false)
  ok('bonifico senza ricevuta: una frase', Array.isArray(senza) && senza.length, 1)
  ok('bonifico senza ricevuta: dice di portare la ricevuta in segreteria', /ricevuta/.test(senza?.[0] ?? '') && /in segreteria/.test(senza?.[0] ?? ''), true)
  ok('bonifico senza ricevuta: il bonifico vale quando la segreteria lo vede sul conto', /vale come pagato quando la segreteria lo vede sul conto/.test(senza?.[0] ?? ''), true)
  ok('bonifico con la ricevuta: nessuna frase in più', frasi('bonifico', 18000, true), [])
  ok('Satispay e carta: nessuna frase in più', [frasi('satispay', 18000, false), frasi('carta', 18000, false)], [[], []])
  ok('dal nucleo (nessun modo): nessuna frase in più', frasi(null, 18000, false), [])
  const modulo = readFileSync('src/components/ModuloIscrizione.tsx', 'utf8')
  ok('la frase di oggi, «paga in segreteria, o portala lì», non c’è più', modulo.includes('o portala lì se hai già pagato'), false)
}

console.log('\n6. la segreteria: RICHIESTE ONLINE')
{
  const segno = (comePaga, conRicevuta) => prova(() => c.segnoComePaga(comePaga, conRicevuta))
  ok('contanti: «Contanti»', segno('contanti', false), 'Contanti')
  ok('contanti: la ricevuta, se c’è, non cambia il segno', segno('contanti', true), 'Contanti')
  ok('bonifico con la ricevuta caricata', segno('bonifico', true), 'Bonifico · ricevuta')
  ok('bonifico senza ricevuta', segno('bonifico', false), 'Bonifico · senza ricevuta')
  ok('null (Satispay, carta, nucleo, richieste vecchie): nessun segno', segno(null, false), null)
  ok('campo non scritto: nessun segno', segno(undefined, true), null)
  const campo = (comePaga, cent) => prova(() => c.campoComePaga(comePaga, cent))
  ok('campo COME PAGA, contanti', campo('contanti'), 'In contanti, in segreteria')
  ok('campo COME PAGA, bonifico', campo('bonifico'), 'Col bonifico')
  ok('campo COME PAGA, bonifico con l’importo', campo('bonifico', 18000), `Col bonifico · ${prova(() => s.soldi(18000))}`)
  ok('campo COME PAGA, contanti con l’importo', campo('contanti', 18000), `In contanti, in segreteria · ${prova(() => s.soldi(18000))}`)
  ok('campo COME PAGA, null: non c’è', campo(null), null)
  // «Nessuna ricevuta: il pagamento si fa in segreteria.» solo dove non è già detto da COME PAGA.
  const nota = (comePaga, conFile, haRicevuta) => prova(() => c.dicaNessunaRicevuta(comePaga, conFile, haRicevuta))
  ok('contanti: la nota non compare', nota('contanti', true, false), false)
  ok('richiesta vecchia, senza scelta e senza ricevuta, con altri file: compare', nota(null, true, false), true)
  ok('richiesta vecchia con la ricevuta: no', nota(null, true, true), false)
  ok('richiesta vecchia senza file ancora caricati: no', nota(null, false, false), false)
  const sorgente = readFileSync('src/components/segreteria/Richieste.tsx', 'utf8')
  ok('l’elenco usa il segno di src/lib', /segnoComePaga/.test(sorgente), true)
  ok('la richiesta aperta ha il campo COME PAGA', sorgente.includes('COME PAGA'), true)
}

console.log('\n7. i dati: invia manda comePaga, la richiesta lo rilegge')
{
  const adulto = (cambi = {}) => ({
    nome: 'Luca', cognome: 'Rossi', natoIl: '1996-01-01', natoA: 'Torino', codiceFiscale: 'rsslcu96a01 l219k',
    indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'Luca@Esempio.it', telefono: '347 111 2233',
    corsi: ['judo-adulti'], formula: 'annuale', regolamento: true, ...cambi,
  })
  const r = rp.creaRichiesteProva?.()
  const letta = async (cambi, nome) => {
    const id = await r.invia(adulto({ nome, ...cambi }))
    return (await r.richieste()).find((x) => x.id === id)
  }
  ok('in prova: contanti si salva e si rilegge', (await aspetta(() => letta({ comePaga: 'contanti' }, 'Luca')))?.comePaga, 'contanti')
  ok('in prova: bonifico si salva e si rilegge', (await aspetta(() => letta({ comePaga: 'bonifico', codiceFiscale: 'RSSMRA85T10A56NH', natoIl: '1985-12-10' }, 'Mario')))?.comePaga, 'bonifico')
  ok('in prova: senza scelta legge null', (await aspetta(() => letta({ email: 'altro@esempio.it' }, 'Luca')))?.comePaga, null)

  // Il database: `invia_iscrizione` riceve `come_paga` dentro `dati`; una riga vecchia non ha la colonna.
  const reg = []
  const db = { rpc: async (nome, args) => (reg.push([nome, args]), { data: 'r-1', error: null }) }
  await aspetta(() => rs.creaRichiesteSupabase(db).invia(adulto({ comePaga: 'contanti' })))
  ok('Supabase: invia manda come_paga', reg[0]?.[1]?.dati?.come_paga, 'contanti')
  reg.length = 0
  await aspetta(() => rs.creaRichiesteSupabase(db).invia(adulto({ comePaga: 'bonifico' })))
  ok('Supabase: invia manda come_paga, bonifico', reg[0]?.[1]?.dati?.come_paga, 'bonifico')
  reg.length = 0
  await aspetta(() => rs.creaRichiesteSupabase(db).invia(adulto()))
  ok('Supabase: senza scelta (Satispay, carta, nucleo) non manda niente o null', reg[0]?.[1]?.dati?.come_paga ?? null, null)
  const riga = { id: 'r-2', creata_il: '2026-11-14T10:00:00Z', stato: 'nuova', nome: 'Luca', cognome: 'Rossi', nato_il: '1996-01-01', nato_a: 'Torino', codice_fiscale: 'RSSLCU96A01L219K', indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'l@e.it', telefono: '347', telefono_2: null, genitore_nome: null, genitore_cognome: null, genitore_codice_fiscale: null, corsi: [], formula: 'annuale', note: null, regolamento: true, persona_id: null, gestita_il: null, gestore: null }
  const leggi = (righe) => {
    const q = { select: () => q, order: () => q, range: (a) => (a ? { then: (bene) => bene({ data: [], error: null }) } : { then: (bene) => bene({ data: righe, error: null }) }) }
    return rs.creaRichiesteSupabase({ from: () => q }).richieste()
  }
  ok('Supabase: legge contanti', (await aspetta(() => leggi([{ ...riga, come_paga: 'contanti' }])))?.[0]?.comePaga, 'contanti')
  ok('Supabase: legge bonifico', (await aspetta(() => leggi([{ ...riga, come_paga: 'bonifico' }])))?.[0]?.comePaga, 'bonifico')
  ok('Supabase: colonna null legge null', (await aspetta(() => leggi([{ ...riga, come_paga: null }])))?.[0]?.comePaga, null)
  ok('Supabase: una richiesta vecchia, senza la colonna, legge null', (await aspetta(() => leggi([riga])))?.[0]?.comePaga, null)
}

console.log('\n8. la pagina Iscrizioni')
{
  const cs = JSON.stringify(pa.COME_SI_PAGA ?? null)
  ok('nomina Satispay, il bonifico e i contanti', ['Satispay', 'bonifico', 'contanti'].map((x) => cs.includes(x)), [true, true, true])
  ok('i contanti: in segreteria, in palestra', cs.includes('in segreteria, in palestra'), true)
  ok('la ricevuta del bonifico è facoltativa', /facoltativ/.test(pa.COME_SI_PAGA?.ricevuta ?? ''), true)
}

console.log('\n9. il modulo a passi: la scelta è obbligatoria')
{
  const PAGA = 6 // il passo QUANTO PAGHI dell'adulto (prova-iscrizione-passi.mjs)
  const vuoto = pi.nuovoStato?.('adulto')
  ok('senza scelta il passo del pagamento ferma', prova(() => pi.mancaNelPasso(vuoto, PAGA).length), 1)
  ok('con i contanti il passo non ferma', prova(() => pi.mancaNelPasso({ ...vuoto, comePaga: 'contanti' }, PAGA)), [])
  ok('col bonifico, senza ricevuta, il passo non ferma', prova(() => pi.mancaNelPasso({ ...vuoto, comePaga: 'bonifico' }, PAGA)), [])
  ok('la richiesta porta la scelta: contanti', prova(() => pi.risposteDaiPassi({ ...vuoto, comePaga: 'contanti' }).comePaga), 'contanti')
  ok('la richiesta porta la scelta: bonifico', prova(() => pi.risposteDaiPassi({ ...vuoto, comePaga: 'bonifico' }).comePaga), 'bonifico')
  ok('senza scelta la richiesta non porta niente', prova(() => pi.risposteDaiPassi(vuoto).comePaga), undefined)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
