// ---------------------------------------------------------------------------
// Gli avvisi alla segreteria, senza browser.
//
//   node scripts/prova-avvisi-segreteria.mjs
//
// Quando arriva una richiesta di iscrizione o un pagamento Satispay, parte
// un'email alla segreteria. Il database decide cosa avvisare e quando
// (`84-avvisi-segreteria.sql`, provato da `supabase/prova/avvisi-segreteria.sql`):
// un avviso per invio (la famiglia è uno), mai due volte, al più 50 al giorno.
// Qui il testo della mail, gli indirizzi, il legame fra le richieste dello
// stesso invio, il link alla richiesta e la modalità prova, che non esce mai in
// rete.
//
// Le regole della Edge Function stanno in `src/lib/avvisoSegreteria.ts`, copiata
// identica in `supabase/functions/avvisi-segreteria/mail.ts`:
//   MITTENTE = 'ODS Corsi <info@officinedellosport.it>'
//   TETTO_AVVISI = 50
//   type Pagamento = { come: 'satispay'; importo: number (centesimi); pagatoIl: string }
//                  | { come: 'bonifico'; ricevuta: boolean } | { come: 'palestra' }
//   type Avviso =
//     | { tipo: 'richiesta'; arrivataIl: string; pagamento: Pagamento;
//         persone: Array<{ richiestaId: string; nome: string; cognome: string; corsi: string[]; fuoriEta: string[] }> }
//     | { tipo: 'pagamento'; richiestaId: string; nome: string; cognome: string; corso: string; importo: number; pagatoIl: string; arrivataIl: string }
//     | { tipo: 'pagamento_senza_richiesta'; nome: string; cognome: string; email: string; corso: string; importo: number; pagatoIl: string }
//   È la stessa forma di `avviso` in `avvisi_da_mandare()`.
//   testoAvviso(avviso: Avviso, app: string) → { oggetto: string; testo: string; html: string }
//     `app` è l'indirizzo della segreteria (finisce con `/`): i link sono `app + '#richieste/<id>'`,
//     `app + '#richieste'`, `app + '#pagamenti'`.
//   indirizziAvvisi(x: { a: string | null; cc: string | null } | null) → { a: string; cc: string | null } | null
//   indirizzoValido(s: string) → string | null   (null se va, se no cosa fare)
//   possoMandare(mandatiOggi: number, tetto = TETTO_AVVISI) → boolean
// Nell'app:
//   · `mandaRichieste` (passiIscrizione.ts) dà a tutte le richieste dello stesso invio la stessa chiave `invio`,
//     e `creaRichiesteSupabase().invia` la passa a `invia_iscrizione` (`dati.invio`);
//   · `leggiIndirizzo('#richieste/<id>')` (indirizzoSegreteria.ts) apre quella richiesta: `{ voce: 'richieste', richiesta: id }`;
//   · in `DatiSegreteria` (segreteria.ts, la prova in segreteriaProva.ts):
//       avvisiIndirizzi(): Promise<{ a: string | null; cc: string | null }>
//       salvaAvvisiIndirizzi(x: { a: string; cc: string }): Promise<void>   (rifiuta con il testo di indirizzoValido)
//       avvisiNonMandatiOggi(): Promise<number>
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { existsSync, readFileSync } from 'node:fs'

const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '', pathname: '/' }, addEventListener() {} }

// Oggi, per la prova, è mercoledì 21 ottobre 2026 alle 19.11 di Roma.
const OGGI = Date.parse('2026-10-21T17:11:00Z')
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI]))
  }
  static now() {
    return OGGI
  }
}

// La modalità prova non deve mai uscire in rete: ogni chiamata si conta.
let chiamate = 0
globalThis.fetch = async () => {
  chiamate++
  throw new Error('la modalità prova è uscita in rete')
}

const m = await impacchetta(
  "export { creaDatiProva } from './src/lib/datiProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export { creaRichiesteSupabase } from './src/lib/richiesteSupabase'; export { mandaRichieste } from './src/lib/passiIscrizione'; export { leggiIndirizzo, scriviIndirizzo } from './src/lib/indirizzoSegreteria'",
)
// Il modulo nuovo, se c'è: se manca, ogni prova lo dice da sé.
let a = {}
try {
  a = await impacchetta("export * from './src/lib/avvisoSegreteria'")
} catch {
  console.log('(manca src/lib/avvisoSegreteria.ts)')
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e?.message
  }
}
const lib = (nome) => (typeof a[nome] === 'function' ? a[nome] : () => `manca ${nome}`)
const testoAvviso = lib('testoAvviso')
const indirizzoValido = lib('indirizzoValido')

const APP = 'https://corsi.esempio.it/segreteria/'
const R1 = '0b6e1c1e-1d1e-4c4e-9a9a-000000000001'
const R2 = '0b6e1c1e-1d1e-4c4e-9a9a-000000000002'
const R3 = '0b6e1c1e-1d1e-4c4e-9a9a-000000000003'
// Le 18.32 e le 18.30 di Roma, oggi.
const ARRIVATA = '2026-10-21T16:32:00Z'
const PAGATA = '2026-10-21T16:30:00Z'
const marco = { richiestaId: R1, nome: 'Marco', cognome: 'Rossi', corsi: ['Judo kids'], fuoriEta: [] }
const richiesta = (pagamento, persone = [marco]) => ({ tipo: 'richiesta', arrivataIl: ARRIVATA, pagamento, persone })
const testo = (x) => (typeof x === 'object' && x ? x.testo : String(x))
const html = (x) => (typeof x === 'object' && x ? x.html : String(x))

console.log('1. una richiesta: oggetto, frase, pagamento, link')
{
  const t = testoAvviso(richiesta({ come: 'bonifico', ricevuta: true }), APP)
  ok('da pagare: l\'oggetto con nome, corso e «da pagare»', t?.oggetto, 'Richiesta di iscrizione · Marco Rossi · Judo kids · da pagare')
  ok('la frase con l\'ora di Roma', testo(t).includes('È arrivata la richiesta di Marco Rossi per Judo kids, oggi alle 18.32.'), true)
  ok('bonifico con la ricevuta', testo(t).includes('Pagamento: bonifico, ricevuta caricata'), true)
  ok('il link apre quella richiesta', [testo(t).includes(`${APP}#richieste/${R1}`), html(t).includes(`${APP}#richieste/${R1}`), html(t).includes('Apri la richiesta')], [true, true, true])
}
{
  const t = testoAvviso(richiesta({ come: 'satispay', importo: 12000, pagatoIl: PAGATA }), APP)
  ok('pagata con Satispay: «pagata» nell\'oggetto', t?.oggetto, 'Richiesta di iscrizione · Marco Rossi · Judo kids · pagata')
  ok('e la riga del pagamento, coi centesimi e l\'ora', testo(t).includes('Pagamento: Satispay, pagata 120,00 € alle 18.30'), true)
}
ok('bonifico senza ricevuta: da pagare, e lo dice',
  [testoAvviso(richiesta({ come: 'bonifico', ricevuta: false }), APP)?.oggetto, testo(testoAvviso(richiesta({ come: 'bonifico', ricevuta: false }), APP)).includes('Pagamento: bonifico, nessuna ricevuta')],
  ['Richiesta di iscrizione · Marco Rossi · Judo kids · da pagare', true])
ok('in palestra: da pagare, e lo dice',
  [testoAvviso(richiesta({ come: 'palestra' }), APP)?.oggetto, testo(testoAvviso(richiesta({ come: 'palestra' }), APP)).includes('Pagamento: in palestra')],
  ['Richiesta di iscrizione · Marco Rossi · Judo kids · da pagare', true])

console.log('\n2. una famiglia mandata insieme: una mail sola')
{
  const famiglia = [
    marco,
    { richiestaId: R2, nome: 'Anna', cognome: 'Rossi', corsi: ['Karate'], fuoriEta: ['Karate'] },
    { richiestaId: R3, nome: 'Paolo', cognome: 'Rossi', corsi: ['Pilates'], fuoriEta: [] },
  ]
  const t = testoAvviso(richiesta({ come: 'satispay', importo: 31000, pagatoIl: PAGATA }, famiglia), APP)
  ok('l\'oggetto: famiglia, cognome e quanti', t?.oggetto, 'Richiesta di iscrizione · famiglia Rossi (3) · pagata')
  ok('quante e quando', testo(t).includes('Sono arrivate 3 richieste insieme, oggi alle 18.32'), true)
  ok('ognuna col suo corso', ['Marco Rossi, Judo kids', 'Anna Rossi, Karate', 'Paolo Rossi, Pilates'].map((x) => testo(t).includes(x)), [true, true, true])
  ok('fuori età: da richiamare, solo chi lo è', [testo(t).includes('Anna Rossi, Karate · fuori età, da richiamare'), testo(t).includes('Marco Rossi, Judo kids · fuori età'), testo(t).includes('Paolo Rossi, Pilates · fuori età')], [true, false, false])
  ok('il pagamento della famiglia', testo(t).includes('Pagamento: Satispay, pagata 310,00 € alle 18.30'), true)
  ok('il link apre le richieste', [testo(t).includes(`${APP}#richieste`), testo(t).includes('#richieste/'), html(t).includes('Apri le richieste')], [true, false, true])
  ok('da bonifico: da pagare', testoAvviso(richiesta({ come: 'bonifico', ricevuta: true }, famiglia), APP)?.oggetto, 'Richiesta di iscrizione · famiglia Rossi (3) · da pagare')
}

console.log('\n3. i pagamenti Satispay')
{
  const t = testoAvviso({ tipo: 'pagamento_senza_richiesta', nome: 'Laura', cognome: 'Bianchi', email: 'laura.bianchi@esempio.it', corso: 'Pilates', importo: 12000, pagatoIl: '2026-10-21T15:05:00Z' }, APP)
  ok('senza richiesta: l\'oggetto con importo e nome', t?.oggetto, 'Pagamento Satispay senza richiesta · 120,00 € · Laura Bianchi')
  ok('la frase: quanto, quando, per cosa', testo(t).includes('Laura Bianchi ha pagato 120,00 € con Satispay oggi alle 17.05 per Pilates'), true)
  ok('l\'email lasciata, per richiamare', testo(t).includes('Email lasciata: laura.bianchi@esempio.it'), true)
  ok('il link apre PAGAMENTI', [testo(t).includes(`${APP}#pagamenti`), html(t).includes('Apri PAGAMENTI')], [true, true])
}
{
  const t = testoAvviso({ tipo: 'pagamento', richiestaId: R1, nome: 'Marco', cognome: 'Rossi', corso: 'Judo kids', importo: 12000, pagatoIl: '2026-10-21T17:10:00Z', arrivataIl: ARRIVATA }, APP)
  ok('dopo la richiesta: l\'oggetto con importo, nome e corso', t?.oggetto, 'Pagamento Satispay · 120,00 € · Marco Rossi · Judo kids')
  ok('la frase lega il pagamento alla richiesta', testo(t).includes('Marco Rossi ha pagato 120,00 € con Satispay oggi alle 19.10 per la richiesta di Judo kids arrivata alle 18.32'), true)
  const ieri = testoAvviso({ tipo: 'pagamento', richiestaId: R1, nome: 'Marco', cognome: 'Rossi', corso: 'Judo kids', importo: 12000, pagatoIl: '2026-10-21T17:10:00Z', arrivataIl: '2026-10-20T16:32:00Z' }, APP)
  ok('la richiesta di ieri dice il giorno', testo(ieri).includes('per la richiesta di Judo kids arrivata il 20 ottobre alle 18.32'), true)
  ok('il link apre quella richiesta', testo(t).includes(`${APP}#richieste/${R1}`), true)
}

console.log('\n4. nella mail mai note, codice fiscale, nascita, file')
{
  // Quel che il modulo raccoglie e la mail non deve dire, anche se arriva per sbaglio dentro l'avviso.
  const sporca = {
    ...richiesta({ come: 'bonifico', ricevuta: true }, [{ ...marco, note: 'Ha l’asma, prende il Ventolin prima della lezione', codiceFiscale: 'RSSMRC17A01L219X', natoIl: '2017-01-01', file: ['ricevuta.jpg', 'certificato.pdf'] }]),
    note: 'Ha l’asma, prende il Ventolin prima della lezione',
  }
  const t = testoAvviso(sporca, APP)
  const tutto = JSON.stringify(t)
  ok('niente note di salute, codice fiscale, data di nascita, nomi di file', [typeof t?.oggetto, ['Ventolin', 'asma', 'RSSMRC17A01L219X', '2017', '01/01', 'ricevuta.jpg', 'certificato'].filter((x) => tutto.includes(x))], ['string', []])
}
{
  // Nome e cognome li scrive chiunque nel modulo pubblico.
  const t = testoAvviso(richiesta({ come: 'palestra' }, [{ ...marco, nome: 'Marco <img src=x onerror=alert(1)>', cognome: 'Rossi\r\nBcc: ladro@esempio.it' }]), APP)
  ok('l\'HTML non esegue quel che scrive chi si iscrive', [typeof t?.html, html(t).includes('<img src=x')], ['string', false])
  ok('l\'oggetto sta su una riga: nessuna intestazione in più', /[\r\n]/.test(t?.oggetto ?? '\n'), false)
}

console.log('\n5. gli indirizzi: a chi va e in copia a chi')
ok('il mittente', a.MITTENTE, 'ODS Corsi <info@officinedellosport.it>')
ok('un indirizzo giusto va', indirizzoValido('segreteria@officinedellosport.it'), null)
ok('senza niente dopo il punto della chiocciola: lo dice', indirizzoValido('segreteria@officinedellosport'), 'Manca qualcosa dopo la chiocciola: controlla l’indirizzo.')
ok('senza chiocciola, con due, con uno spazio: non va', ['segreteria', 'a@b@c.it', 'segre teria@ods.it'].map((x) => typeof indirizzoValido(x) === 'string' && indirizzoValido(x) !== 'manca indirizzoValido'), [true, true, true])

// 6. Il tetto di 50 al giorno sta nel database: supabase/prova/avvisi-segreteria.sql, sezione 10.

console.log('\n7. la famiglia: le richieste dello stesso invio si riconoscono')
{
  const finto = () => {
    const inviati = []
    return {
      inviati, modo: 'prova',
      async invia(dati) {
        inviati.push(dati)
        return `r${inviati.length}`
      },
      async caricaFile() {},
    }
  }
  const persona = (nome) => ({ dati: { nome, cognome: 'Rossi', note: '' }, file: {} })
  const d = finto()
  await m.mandaRichieste(d, [persona('Marco'), persona('Anna'), persona('Paolo')])
  const chiavi = d.inviati.map((x) => x.invio)
  ok('tre richieste, la stessa chiave d\'invio', [chiavi.length, typeof chiavi[0] === 'string' && chiavi[0].length > 0, new Set(chiavi).size], [3, true, 1])
  const d2 = finto()
  await m.mandaRichieste(d2, [persona('Luca')])
  ok('un altro invio, un\'altra chiave', [typeof d2.inviati[0]?.invio === 'string', d2.inviati[0]?.invio !== chiavi[0]], [true, true])
  // Un telefono vecchio (Safari prima della 15.4) non ha crypto.randomUUID: la richiesta parte lo stesso.
  const vero = crypto.randomUUID
  crypto.randomUUID = undefined
  const d3 = finto()
  try {
    await m.mandaRichieste(d3, [persona('Gino'), persona('Lina')])
  } catch (e) {
    d3.guaio = e?.message
  } finally {
    crypto.randomUUID = vero
  }
  const k = d3.inviati.map((x) => x.invio)
  ok('senza crypto.randomUUID la famiglia parte, con la stessa chiave, un uuid', [d3.guaio ?? null, k.length, new Set(k).size, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(k[0] ?? '')], [null, 2, 1, true])
}
{
  const reg = []
  const db = { rpc: async (nome, args) => (reg.push([nome, args]), { data: R1, error: null }) }
  await m.creaRichiesteSupabase(db).invia({ nome: 'Marco', cognome: 'Rossi', invio: 'chiave-di-prova' })
  ok('la chiave arriva a invia_iscrizione', [reg[0]?.[0], reg[0]?.[1]?.dati?.invio], ['invia_iscrizione', 'chiave-di-prova'])
}

console.log('\n8. «Apri la richiesta» porta a quella richiesta')
ok('#richieste/<id> apre la richiesta', m.leggiIndirizzo(`#richieste/${R1}`, { prova: false }), { voce: 'richieste', richiesta: R1 })
ok('e si riscrive uguale', m.scriviIndirizzo({ voce: 'richieste', richiesta: R1 }), `#richieste/${R1}`)
ok('#richieste resta l\'elenco', m.leggiIndirizzo('#richieste', { prova: false }), { voce: 'richieste' })

console.log('\n9. la funzione avvisi-segreteria usa le stesse regole')
{
  const leggi = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : `manca ${f}`)
  ok('mail.ts è la copia di src/lib/avvisoSegreteria.ts', leggi('supabase/functions/avvisi-segreteria/mail.ts') === leggi('src/lib/avvisoSegreteria.ts'), true)
  const fn = leggi('supabase/functions/avvisi-segreteria/index.ts')
  ok('usa la copia', fn.includes("from './mail.ts'"), true)
  ok('prende gli avvisi dal database e segna quelli partiti', [fn.includes("rpc('avvisi_da_mandare'"), fn.includes("rpc('avviso_mandato'")], [true, true])
  ok('prende ogni avviso prima di mandarlo: due chiamate insieme non mandano due mail', fn.includes("rpc('avviso_preso'"), true)
  ok('scrive col testo provato qui', fn.includes('testoAvviso('), true)
  ok('nei log niente indirizzi né nomi', (fn.match(/console\.\w+\([^)]*\)/g) ?? []).filter((x) => /\b(a|cc|indirizz\w*|nome|cognome|email)\b|\.message/.test(x)), [])
}

console.log('\n10. la modalità prova: niente rete, le stesse regole')
m.creaDatiProva()
{
  const s = m.creaSegreteriaProva()
  const fa = (nome, ...x) => (typeof s[nome] === 'function' ? s[nome](...x) : Promise.resolve(`manca ${nome}`))
  ok('all\'inizio: nessun indirizzo, la copia di sempre', await fa('avvisiIndirizzi'), { a: null, cc: 'asdilcentrojudo@gmail.com' })
  ok('un indirizzo sbagliato non si salva', await errore(() => fa('salvaAvvisiIndirizzi', { a: 'segreteria@officinedellosport', cc: '' })), 'Manca qualcosa dopo la chiocciola: controlla l’indirizzo.')
  await fa('salvaAvvisiIndirizzi', { a: 'segreteria@officinedellosport.it', cc: '' })
  ok('quello giusto sì, e la copia vuota resta vuota', await fa('avvisiIndirizzi'), { a: 'segreteria@officinedellosport.it', cc: null })
  ok('nessun avviso perso oggi', await fa('avvisiNonMandatiOggi'), 0)
}
ok('mai una chiamata in rete', chiamate, 0)

console.log('\n11. col database: senza il file SQL nessun guaio, e i rifiuti detti per chi usa l\'app')
{
  const finto = ({ tabella = {}, rpc = {} } = {}) => {
    const reg = []
    const catena = (t) => {
      const c = {
        select: () => c, eq: () => c, update: (v) => (reg.push(['update', t, v]), c), upsert: (v) => (reg.push(['upsert', t, v]), c),
        insert: (v) => (reg.push(['insert', t, v]), c), maybeSingle: () => c, single: () => c, limit: () => c, not: () => c, is: () => c,
        then: (bene, male) => Promise.resolve(tabella[t] ?? { data: null, error: null }).then(bene, male),
      }
      return c
    }
    const db = {
      from: (t) => (reg.push(['from', t]), catena(t)),
      rpc: async (nome, args) => (reg.push(['rpc', nome, args]), rpc[nome] ?? { data: null, error: null }),
    }
    return { seg: m.creaSegreteriaSupabase(db), reg }
  }
  const fa = (seg, nome, ...x) => (typeof seg[nome] === 'function' ? seg[nome](...x) : Promise.resolve(`manca ${nome}`))
  const ERR = (code) => ({ data: null, error: { code, message: 'testo grezzo' } })
  ok('senza 84-avvisi-segreteria.sql: nessun indirizzo', await fa(finto({ tabella: { avvisi_indirizzi: ERR('42P01') } }).seg, 'avvisiIndirizzi'), { a: null, cc: null })
  ok('e nessun avviso perso', await fa(finto({ rpc: { avvisi_non_mandati_oggi: ERR('PGRST202') } }).seg, 'avvisiNonMandatiOggi'), 0)
  ok('salvare senza il file 84 dice quale lanciare',
    await errore(() => fa(finto({ tabella: { avvisi_indirizzi: { data: null, error: { code: '42P01', message: 'relation "public.avvisi_indirizzi" does not exist' } } } }).seg, 'salvaAvvisiIndirizzi', { a: 'segreteria@officinedellosport.it', cc: '' })),
    'Gli avvisi non sono ancora attivi sul database: va lanciato 84-avvisi-segreteria.sql')
  ok('il numero, quando c\'è', await fa(finto({ rpc: { avvisi_non_mandati_oggi: { data: 12, error: null } } }).seg, 'avvisiNonMandatiOggi'), 12)
  {
    const { seg, reg } = finto()
    ok('un indirizzo sbagliato non arriva al database', [await errore(() => fa(seg, 'salvaAvvisiIndirizzi', { a: 'segreteria@officinedellosport', cc: '' })), reg.length], ['Manca qualcosa dopo la chiocciola: controlla l’indirizzo.', 0])
  }
  {
    const { seg, reg } = finto()
    await fa(seg, 'salvaAvvisiIndirizzi', { a: 'segreteria@officinedellosport.it', cc: '' })
    ok('quello giusto sì, negli indirizzi degli avvisi', JSON.stringify(reg).includes('avvisi_indirizzi') && JSON.stringify(reg).includes('segreteria@officinedellosport.it'), true)
  }
  ok('chi non è della segreteria: lo dice senza il testo grezzo',
    await errore(() => fa(finto({ tabella: { avvisi_indirizzi: ERR('42501') }, rpc: { salva_avvisi_indirizzi: ERR('42501') } }).seg, 'salvaAvvisiIndirizzi', { a: 'segreteria@officinedellosport.it', cc: '' })),
    'Non hai il permesso: serve un accesso da segreteria')
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
if (guai) process.exit(1)
