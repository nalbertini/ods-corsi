// ---------------------------------------------------------------------------
// Gli ordini di vestiario, senza browser.
//
//   node scripts/prova-vestiario.mjs
//
// Le regole stanno in `src/lib/vestiario.ts` (funzioni pure: aperti o chiusi,
// cosa non va in un ordine, totale, elenchi, numeri, riepilogo) e la modalità
// prova in `src/lib/vestiarioProva.ts`, che deve fare quello che fa il
// database (`supabase/47-vestiario.sql`, provato da
// `supabase/prova/vestiario.sql`): stessi casi, stessi messaggi.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/vestiario'; export { creaVestiarioProva } from './src/lib/vestiarioProva'; export { PAGAMENTO } from './src/lib/iscrizione'; export * from './src/lib/vestiarioPagina'; export { creaVestiarioSupabase, datiVestiario } from './src/lib/vestiarioDati'; export { riduciFoto, TROPPO_GRANDE, NON_SI_APRE } from './src/lib/foto'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che manca o che scoppia deve far rosso quel caso, non fermare tutto.
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
const aspetta = async (f) => {
  try {
    return await f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}
/** Il messaggio di un rifiuto, ridotto a «dice quella parola?». */
const dice = (testo, parola) => typeof testo === 'string' && testo !== 'nessun errore' && parola.test(testo)

const judogi = { capo: 'Judogi', taglie: ['120', '130', '140'], prezzo: 35, nota: 'Altezza del bambino + 10 cm. I campioni sono in segreteria.' }
const costumino = { capo: 'Costumino', taglie: ['S', 'M'], prezzo: 30 }
const CAPI = [judogi, costumino]
const riga = (perChi, capo, taglia, quanti = 1) => ({ perChi, capo, taglia, quanti })
const ordine = (righe, altro = {}) => ({ nome: 'Paola', cognome: 'Rossi', telefono: '333 123 4567', righe, ...altro })

/** Una modalità prova nuova, con l'orologio in mano alla prova. */
const nuova = (giorno) => {
  memoria.clear()
  const orologio = { oggi: giorno }
  const v = m.creaVestiarioProva(() => orologio.oggi)
  return { v, orologio }
}
/** Le raccolte, o un elenco vuoto se la funzione manca: una lunghezza che non è di una stringa d'errore. */
const raccolte = async (v) => {
  const r = await aspetta(() => v.raccolte())
  return Array.isArray(r) ? r : []
}
const ordineDi = async (v, id) => {
  for (const r of await v.raccolte()) {
    const o = (await v.ordini(r.id)).find((x) => x.id === id)
    if (o) return o
  }
  return null
}

console.log('1. il catalogo salvato è quello che vede la pagina pubblica')
{
  ok('le taglie si scrivono separate da virgola', prova(() => m.taglieDa('120, 130,140 ,')), ['120', '130', '140'])
  const { v } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: [{ ...judogi, taglie: m.taglieDa('120, 130, 140') }] }))
  const c = await aspetta(() => v.catalogo())
  ok('capo, taglie, prezzo e nota', prova(() => c.capi.map((x) => [x.capo, x.taglie, x.prezzo, x.nota])), [['Judogi', ['120', '130', '140'], 35, judogi.nota]])
  ok('e la data di chiusura', prova(() => c.chiude), '2026-10-17')
  ok('un catalogo giusto va', prova(() => m.cosaNonVaCatalogo({ chiude: '2026-10-17', capi: CAPI })), null)
  ok('due capi con lo stesso nome no (due prezzi sono due capi)', dice(prova(() => m.cosaNonVaCatalogo({ chiude: '2026-10-17', capi: [judogi, { ...judogi, prezzo: 40 }] })), /Judogi/), true)
  ok('un capo senza prezzo no', dice(prova(() => m.cosaNonVaCatalogo({ chiude: '2026-10-17', capi: [{ ...judogi, prezzo: 0 }] })), /prezzo/i), true)
  ok('un capo senza taglie no', dice(prova(() => m.cosaNonVaCatalogo({ chiude: '2026-10-17', capi: [{ ...judogi, taglie: [] }] })), /taglie/i), true)
  ok('e la modalità prova non lo salva', dice(await errore(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: [judogi, { ...judogi, prezzo: 40 }] })), /Judogi/), true)
  ok('il catalogo resta quello di prima', (await aspetta(() => v.catalogo()))?.capi?.length, 1)
}

console.log('\n2. aperti fino alla data di chiusura compresa')
{
  const cat = { chiude: '2026-10-17', capi: CAPI }
  ok('il 17/10 sono aperti', prova(() => m.ordiniAperti(cat, '2026-10-17')), true)
  ok('il 18/10 sono chiusi', prova(() => m.ordiniAperti(cat, '2026-10-18')), false)
  ok('senza data sono chiusi', prova(() => m.ordiniAperti({ chiude: null, capi: CAPI }, '2026-10-10')), false)
  ok('senza capi sono chiusi', prova(() => m.ordiniAperti({ chiude: '2026-10-17', capi: [] }, '2026-10-10')), false)
  ok('senza catalogo sono chiusi', prova(() => m.ordiniAperti(null, '2026-10-10')), false)
}

console.log('\n3. cosa non entra in un ordine')
{
  const no = (o) => prova(() => m.cosaNonVaOrdine(o, CAPI))
  ok('un ordine giusto va', no(ordine([riga('Luca Rossi', 'Judogi', '130')])), null)
  ok('l’email è facoltativa, ma se c’è va scritta giusta', [no(ordine([riga('Luca Rossi', 'Judogi', '130')], { email: 'paola@esempio.it' })), dice(no(ordine([riga('Luca Rossi', 'Judogi', '130')], { email: 'paola' })), /email/i)], [null, true])
  ok('un capo fuori catalogo no, e dice quale', dice(no(ordine([riga('Luca Rossi', 'Judogi rosa', '130')])), /Judogi rosa/), true)
  ok('una taglia fuori catalogo no, e dice quale', dice(no(ordine([riga('Luca Rossi', 'Judogi', '200')])), /taglia 200/), true)
  ok('zero righe no', dice(no(ordine([])), /almeno un capo/i), true)
  ok('quantità 0 no', dice(no(ordine([riga('Luca Rossi', 'Judogi', '130', 0)])), /quantità/i), true)
  ok(`oltre ${m.MAX_QUANTI} no`, dice(no(ordine([riga('Luca Rossi', 'Judogi', '130', (m.MAX_QUANTI ?? 10) + 1)])), /quantità/i), true)
  ok(`${m.MAX_QUANTI} sì`, no(ordine([riga('Luca Rossi', 'Judogi', '130', m.MAX_QUANTI ?? 10)])), null)
  ok('senza telefono no', dice(no(ordine([riga('Luca Rossi', 'Judogi', '130')], { telefono: '' })), /telefono/i), true)
  ok('un telefono di tre cifre no', dice(no(ordine([riga('Luca Rossi', 'Judogi', '130')], { telefono: '123' })), /telefono/i), true)
  ok('senza il nome di chi ordina no', dice(no(ordine([riga('Luca Rossi', 'Judogi', '130')], { cognome: ' ' })), /cognome/i), true)
  ok('una riga senza per chi no', dice(no(ordine([riga(' ', 'Judogi', '130')])), /per chi/i), true)

  const { v, orologio } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  ok('dalla pagina pubblica, la taglia fuori catalogo è rifiutata', dice(await errore(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '200')]))), /taglia 200/), true)
  orologio.oggi = '2026-10-18'
  ok('a raccolta chiusa la pagina pubblica è rifiutata', dice(await errore(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')]))), /chiusi/i), true)
  ok('e non è entrato niente', (await aspetta(async () => (await Promise.all((await v.raccolte()).map((r) => v.ordini(r.id)))).flat().length)), 0)
}

console.log('\n4. un ordine salvato')
{
  const { v } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const arrivato = await aspetta(() => v.inviaOrdine({ ...ordine([riga('Luca Rossi', 'Judogi', '130')]), codiceFiscale: 'RSSPLA80A41L219X', natoIl: '1980-01-01' }))
  const o = await aspetta(() => ordineDi(v, arrivato.id))
  ok('chi ordina: nome, cognome, telefono, email vuota', prova(() => [o.nome, o.cognome, o.telefono, o.email]), ['Paola', 'Rossi', '333 123 4567', null])
  ok('le righe: per chi, capo, taglia, quantità e prezzo', prova(() => o.righe.map((r) => [r.perChi, r.capo, r.taglia, r.quanti, r.prezzo])), [['Luca Rossi', 'Judogi', '130', 1, 35]])
  ok('niente codice fiscale né data di nascita', prova(() => o.righe && Object.keys(o).filter((k) => /fiscale|nat/i.test(k))), [])
  ok('arriva da saldare, non annullato', prova(() => [o.saldato, o.annullato, m.statoOrdine(o)]), [false, false, 'da saldare'])
}

console.log('\n5. il totale lo fa il catalogo, non chi manda l’ordine')
{
  ok('due righe, la somma', prova(() => m.totaleOrdine([{ quanti: 2, prezzo: 35 }, { quanti: 1, prezzo: 30 }])), 100)
  const { v } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const arrivato = await aspetta(() => v.inviaOrdine({ ...ordine([riga('Luca Rossi', 'Judogi', '130', 2)]), totale: 1, righe: [{ ...riga('Luca Rossi', 'Judogi', '130', 2), prezzo: 0.5 }] }))
  ok('due judogi a 35 € con un totale finto di 1 €: 70 €', prova(() => arrivato.totale), 70)
  ok('e il prezzo nella riga è quello del catalogo', prova(() => arrivato.righe.map((r) => r.prezzo)), [35])
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: [{ ...judogi, prezzo: 40 }, costumino] }))
  const o = await aspetta(() => ordineDi(v, arrivato.id))
  ok('il catalogo passa a 40 €: l’ordine resta a 70 €', prova(() => [o.totale, o.righe[0].prezzo]), [70, 35])
}

console.log('\n6. proroga e raccolta nuova')
{
  const { v, orologio } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const prima = await raccolte(v)
  const a = await aspetta(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')])))
  const raccoltaDi = async (id) => (await aspetta(() => ordineDi(v, id)))?.raccolta
  const ottobre = await raccoltaDi(a.id)
  ok('l’ordine sta nella raccolta aperta', prova(() => ottobre === prima[0]?.id && typeof ottobre === 'string'), true)
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-24', capi: CAPI }))
  ok('proroga al 24/10: le raccolte sono le stesse', [(await raccolte(v)).length, typeof ottobre], [prima.length, 'string'])
  ok('e l’ordine resta nella sua', [await raccoltaDi(a.id), typeof ottobre], [ottobre, 'string'])
  ok('la raccolta dice la data nuova', (await raccolte(v)).find((r) => r.id === ottobre)?.chiude, '2026-10-24')

  const n = nuova('2026-10-10')
  await aspetta(() => n.v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const b = await aspetta(() => n.v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')])))
  const vecchia = (await aspetta(() => ordineDi(n.v, b.id)))?.raccolta
  const quante = (await raccolte(n.v)).length
  n.orologio.oggi = '2026-10-18'
  await aspetta(() => n.v.salvaCatalogo({ chiude: '2027-03-20', capi: CAPI }))
  const dopo = await raccolte(n.v)
  ok('raccolta chiusa, data al 20/3: una raccolta in più', dopo.length, quante + 1)
  const marzo = dopo.find((r) => r.chiude === '2027-03-20')
  const diMarzo = await aspetta(() => n.v.ordini(marzo?.id))
  ok('la nuova è vuota', Array.isArray(diMarzo) ? diMarzo.length : diMarzo, 0)
  ok('quello di ottobre resta nella sua', [(await aspetta(() => ordineDi(n.v, b.id)))?.raccolta, typeof vecchia], [vecchia, 'string'])
  ok('la vecchia tiene la sua data', dopo.find((r) => r.id === vecchia)?.chiude, '2026-10-17')
  const c = await aspetta(() => n.v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '140')])))
  ok('un ordine nuovo va nella nuova', [(await aspetta(() => ordineDi(n.v, c.id)))?.raccolta, typeof marzo?.id], [marzo?.id, 'string'])
}

console.log('\n7. un ordine per famiglia')
{
  const { v } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const a = await aspetta(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130'), riga('Sara Rossi', 'Costumino', 'S')])))
  const o = await aspetta(() => ordineDi(v, a.id))
  ok('due bambini, un ordine, due righe', prova(() => o.righe.map((r) => r.perChi)), ['Luca Rossi', 'Sara Rossi'])
  ok('un totale solo', prova(() => o.totale), 65)
}

console.log('\n8. la segreteria: saldato, annullato, spostato')
{
  const { v, orologio } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const a = await aspetta(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')])))
  const stato = async () => aspetta(async () => m.statoOrdine(await ordineDi(v, a.id)))
  await aspetta(() => v.segnaSaldato(a.id, 'bonifico'))
  ok('segna SALDATO', await stato(), 'saldato')
  await aspetta(() => v.segnaSaldato(a.id, null))
  ok('e toglie il segno', await stato(), 'da saldare')
  await aspetta(() => v.segnaSaldato(a.id, 'bonifico'))
  await aspetta(() => v.annulla(a.id, true))
  ok('annulla: annullato vince su saldato', await stato(), 'annullato')
  await aspetta(() => v.annulla(a.id, false))
  ok('e lo rimette, saldato com’era', await stato(), 'saldato')
  const ottobre = (await aspetta(() => ordineDi(v, a.id)))?.raccolta
  orologio.oggi = '2026-10-18'
  await aspetta(() => v.salvaCatalogo({ chiude: '2027-03-20', capi: CAPI }))
  const marzo = (await raccolte(v)).find((r) => r.chiude === '2027-03-20')?.id
  await aspetta(() => v.sposta(a.id, marzo))
  ok('lo sposta alla raccolta di marzo', [(await aspetta(() => ordineDi(v, a.id)))?.raccolta === marzo, typeof marzo, marzo !== ottobre], [true, 'string', true])
}

console.log('\n9. la segreteria corregge le righe e scrive dal banco')
{
  const { v, orologio } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const a = await aspetta(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130', 2)])))
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: [{ ...judogi, prezzo: 40 }, costumino] }))
  const vecchia = (await aspetta(() => ordineDi(v, a.id)))?.righe?.[0]
  await aspetta(() => v.correggiRighe(a.id, [{ ...vecchia, taglia: '140', prezzo: 1 }, riga('Sara Rossi', 'Judogi', '120')]))
  const o = await aspetta(() => ordineDi(v, a.id))
  ok('taglia cambiata, riga aggiunta', prova(() => o.righe.map((r) => [r.perChi, r.taglia, r.quanti])), [['Luca Rossi', '140', 2], ['Sara Rossi', '120', 1]])
  ok('la riga vecchia tiene 35 €, la nuova prende 40 €', prova(() => o.righe.map((r) => r.prezzo)), [35, 40])
  ok('il totale si ricalcola', prova(() => o.totale), 110)
  const nuovaRiga = o?.righe?.[1]
  await aspetta(() => v.correggiRighe(a.id, [{ ...nuovaRiga, quanti: 3 }]))
  const tolta = await aspetta(() => ordineDi(v, a.id))
  ok('riga tolta e quantità cambiata: resta una riga', prova(() => tolta.righe.map((r) => [r.perChi, r.quanti, r.prezzo])), [['Sara Rossi', 3, 40]])
  ok('e il totale è 120 €', prova(() => tolta.totale), 120)
  ok('un capo fuori catalogo in una riga nuova no', dice(await errore(() => v.correggiRighe(a.id, [riga('Sara Rossi', 'Felpa', 'S')])), /Felpa/), true)
  ok('togliere tutte le righe no: si annulla', dice(await errore(() => v.correggiRighe(a.id, [])), /almeno un capo/i), true)
  ok('e l’ordine resta com’era', (await aspetta(() => ordineDi(v, a.id)))?.totale, 120)

  orologio.oggi = '2026-10-18'
  const banco = await aspetta(() => v.scriviOrdine(ordine([riga('Marco Bianchi', 'Costumino', 'M')], { nome: 'Anna', cognome: 'Bianchi' })))
  const b = await aspetta(() => ordineDi(v, banco))
  ok('dal banco, a raccolta chiusa, si scrive', prova(() => [b.cognome, b.totale, m.statoOrdine(b)]), ['Bianchi', 30, 'da saldare'])
  const gia = await aspetta(() => v.scriviOrdine(ordine([riga('Marco Bianchi', 'Judogi', '140')], { nome: 'Anna', cognome: 'Bianchi' }), 'bonifico'))
  ok('e anche già saldato', await aspetta(async () => m.statoOrdine(await ordineDi(v, gia))), 'saldato')
  ok('dal banco valgono le stesse regole sulle righe', dice(await errore(() => v.scriviOrdine(ordine([riga('Marco Bianchi', 'Judogi', '999')]))), /taglia 999/), true)
}

// Gli ordini di una raccolta, fatti a mano: tre saldati, uno da saldare, uno annullato e saldato.
// Un saldato ha pagato il suo totale, con un bonifico.
const fatto = (id, cognome, righe, totale, saldato, annullato = false) => ({
  id, raccolta: 'r1', nome: 'Paola', cognome, telefono: '333 123 4567', email: null,
  righe: righe.map((r, i) => ({ id: `${id}-${i}`, prezzo: r.capo === 'Judogi' ? 35 : 30, ...r })), totale, saldato, annullato,
  pagato: saldato ? totale : 0, pagatoCon: saldato ? 'bonifico' : null, pagatoIl: saldato ? '2026-10-12' : null, arrivato: '2026-10-10T18:00:00.000Z', dalBanco: false,
})
const ORDINI = [
  fatto('o1', 'Rossi', [riga('Luca Rossi', 'Judogi', '140')], 35, true),
  fatto('o2', 'Bianchi', [riga('Tommaso Bianchi', 'Judogi', '140')], 35, true),
  fatto('o3', 'Colombo', [riga('Giulia "Giuly" Colombo', 'Costumino', 'S')], 30, true),
  fatto('o4', 'Verdi', [riga('Anna Verdi', 'Judogi', '120', 2)], 70, false),
  fatto('o5', 'Neri', [riga('Ugo Neri', 'Costumino', 'M')], 30, true, true),
]

console.log('\n10. gli elenchi')
{
  const fornitore = (x) => `${x.capo} ${x.taglia}: ${x.quanti}`
  const persona = (x) => [x.perChi, x.capo, x.taglia, x.quanti, x.chiOrdina, x.telefono, x.stato]
  ok('per il fornitore: solo i saldati non annullati, per capo e taglia, nell’ordine del catalogo', prova(() => m.elencoFornitore(ORDINI, CAPI).map(fornitore)), ['Judogi 140: 2', 'Costumino S: 1'])
  ok('le quantità si sommano', prova(() => m.elencoFornitore([ORDINI[0], { ...ORDINI[3], saldato: true }], CAPI).map(fornitore)), ['Judogi 120: 2', 'Judogi 140: 1'])
  ok('per persona: chi, capo, taglia, quantità, chi ordina, telefono e stato; gli annullati no; per nome', prova(() => m.elencoPersone(ORDINI).map(persona)), [
    ['Anna Verdi', 'Judogi', '120', 2, 'Verdi Paola', '333 123 4567', 'da saldare'],
    ['Giulia "Giuly" Colombo', 'Costumino', 'S', 1, 'Colombo Paola', '333 123 4567', 'saldato'],
    ['Luca Rossi', 'Judogi', '140', 1, 'Rossi Paola', '333 123 4567', 'saldato'],
    ['Tommaso Bianchi', 'Judogi', '140', 1, 'Bianchi Paola', '333 123 4567', 'saldato'],
  ])
  // Lo stesso formato del CSV di PRESENZE: punto e virgola, a capo \r\n,
  // virgolette solo dove servono. Il BOM lo mette chi scarica, come lì.
  ok('il CSV per il fornitore', prova(() => m.csvFornitore(ORDINI, CAPI).split('\r\n')), ['capo;taglia;quanti', 'Judogi;140;2', 'Costumino;S;1'])
  ok('il CSV per persona, con le virgolette dove servono', prova(() => m.csvPersone(ORDINI).split('\r\n').slice(0, 3)), [
    'per chi;capo;taglia;quanti;chi ordina;telefono;stato',
    'Anna Verdi;Judogi;120;2;Verdi Paola;333 123 4567;da saldare',
    '"Giulia ""Giuly"" Colombo";Costumino;S;1;Colombo Paola;333 123 4567;saldato',
  ])
}

console.log('\n11. i numeri della raccolta')
{
  const numeri = (x) => [x.ordini, x.saldati, x.daSaldare, x.incassato, x.mancante]
  ok('ordini, saldati, da saldare, incassato, mancante; gli annullati non contano', prova(() => numeri(m.numeriRaccolta(ORDINI))), [4, 3, 1, 100, 70])
  ok('una raccolta vuota è tutta a zero', prova(() => numeri(m.numeriRaccolta([]))), [0, 0, 0, 0, 0])
}

console.log('\n12. il riepilogo per il genitore')
{
  const arrivato = { nome: 'Paola', cognome: 'Rossi', righe: [{ ...riga('Luca Rossi', 'Judogi', '130', 2), prezzo: 35 }, { ...riga('Sara Rossi', 'Costumino', 'S'), prezzo: 30 }], totale: 100 }
  ok('la causale', prova(() => m.causaleVestiario(arrivato)), 'Vestiario Rossi Paola')
  const t = String(prova(() => m.riepilogoOrdine(arrivato, '2026-10-17')))
  ok('ci sono le righe', ['Luca Rossi', 'Judogi', '130', 'Sara Rossi', 'Costumino'].every((x) => t.includes(x)), true)
  ok('c’è il totale', /100(,00)? €/.test(t), true)
  ok('c’è l’IBAN', t.includes(m.PAGAMENTO.iban), true)
  ok('c’è la causale', t.includes('Vestiario Rossi Paola'), true)
  ok('c’è la data entro cui pagare', t.includes('entro il 17 ottobre'), true)
  ok('e con l’apostrofo: entro l’8 ottobre', String(prova(() => m.riepilogoOrdine(arrivato, '2026-10-08'))).includes("entro l'8 ottobre"), true)
}

console.log('\n13. la barra della pagina pubblica dice tutto quel che manca')
{
  const nomi = (o) => prova(() => m.mancaNellOrdine(o, CAPI).map((x) => x.nome))
  ok('un ordine pronto non ha niente', nomi(ordine([riga('Luca Rossi', 'Judogi', '130')])), [])
  ok(
    'le righe prima, nel loro ordine, poi chi ordina',
    nomi({ nome: '', cognome: ' ', telefono: '', righe: [riga('Luca Rossi', 'Judogi', '130'), riga('', 'Costumino', 'S'), riga('Sara Rossi', 'Costumino', '')] }),
    ['Per chi è la riga 2', 'La taglia della riga 3', 'Il nome di chi ordina', 'Il cognome di chi ordina', 'Il telefono di chi ordina'],
  )
  ok('un capo che non c’è è da scegliere', nomi(ordine([riga('Luca Rossi', '', '')])), ['Il capo della riga 1'])
  ok('senza righe, almeno un capo', nomi(ordine([])), ['Almeno un capo'])
  ok('quel che manca non è scritto male', prova(() => m.mancaNellOrdine({ nome: '', cognome: 'Rossi', telefono: '', righe: [riga('Luca Rossi', 'Judogi', '')] }, CAPI).map((x) => x.scrittoMale)), [false, false, false])
  ok('ogni voce porta al suo campo', prova(() => m.mancaNellOrdine(ordine([riga('Luca Rossi', 'Judogi', '')]), CAPI).map((x) => x.chiave)), ['r0-taglia'])
}

console.log('\n14. la segreteria corregge un ordine: le scelte e il totale prima di SALVA')
{
  const vecchie = [
    { id: 'a', ...riga('Luca Rossi', 'Judogi', '110'), prezzo: 32 },
    { id: 'b', ...riga('Sara Rossi', 'Felpa', 'M'), prezzo: 25 },
  ]
  const capi = prova(() => m.capiPerCorreggere(CAPI, vecchie))
  ok('una taglia tolta dal catalogo resta da scegliere per quel capo', prova(() => capi.find((c) => c.capo === 'Judogi').taglie), ['120', '130', '140', '110'])
  ok('e un capo tolto pure, con la sua taglia', prova(() => capi.find((c) => c.capo === 'Felpa')?.taglie), ['M'])
  ok('il catalogo non cambia', CAPI[0].taglie, ['120', '130', '140'])
  ok('come prima, il totale di prima', prova(() => m.totaleCorretto(vecchie, vecchie, CAPI)), 57)
  ok(
    'la taglia cambiata tiene il prezzo, il capo cambiato prende quello di adesso, una riga nuova pure',
    prova(() => m.totaleCorretto(vecchie, [{ ...vecchie[0], taglia: '130' }, { ...vecchie[1], capo: 'Costumino', taglia: 'S' }, riga('Sara Rossi', 'Judogi', '120', 2)], CAPI)),
    32 + 30 + 70,
  )
}

console.log('\n15. come il database (supabase/prova/vestiario.sql)')
{
  // A raccolta chiusa, la stessa data con un prezzo cambiato non apre una raccolta nuova.
  const { v, orologio } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const a = await aspetta(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')])))
  const ottobre = (await aspetta(() => ordineDi(v, a?.id)))?.raccolta
  const quante = (await raccolte(v)).length
  orologio.oggi = '2026-10-18'
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: [{ ...judogi, prezzo: 40 }, costumino] }))
  ok('raccolta chiusa, stessa data e un prezzo nuovo: le raccolte sono quelle', (await raccolte(v)).length, quante)
  ok('e l’ordine resta lì', [(await aspetta(() => ordineDi(v, a?.id)))?.raccolta, typeof ottobre], [ottobre, 'string'])

  // Senza data si salva solo il catalogo: la raccolta non si crea e non perde la sua data.
  await aspetta(() => v.salvaCatalogo({ chiude: null, capi: CAPI }))
  ok('senza data, a raccolta chiusa: nessuna raccolta nuova', (await raccolte(v)).length, quante)
  ok('e quella di adesso tiene la sua data', (await raccolte(v)).find((r) => r.id === ottobre)?.chiude, '2026-10-17')
  const aperta = nuova('2026-10-10')
  await aspetta(() => aperta.v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const prima = await raccolte(aperta.v)
  await aspetta(() => aperta.v.salvaCatalogo({ chiude: null, capi: CAPI }))
  ok('senza data, a raccolta aperta: sempre la stessa, con la sua data', (await raccolte(aperta.v)).map((r) => [r.id, r.chiude]), prima.map((r) => [r.id, r.chiude]))
  ok('e c’era', prima.length > 0, true)

  const vuota = nuova('2026-10-10')
  await aspetta(() => vuota.v.salvaCatalogo({ chiude: null, capi: CAPI }))
  ok('il primo catalogo senza data: nessuna raccolta', (await raccolte(vuota.v)).length, 0)
  ok('ma il catalogo c’è', (await aspetta(() => vuota.v.catalogo()))?.capi?.length, 2)
  ok('il banco senza raccolta rifiuta, e dice cosa fare', await errore(() => vuota.v.scriviOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')]))),
    'Non c\'è ancora una raccolta: salva prima il catalogo con la data di chiusura')
}
{
  // Una riga di un altro ordine, e un ordine che non c'è più.
  const { v } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const a = await aspetta(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')])))
  const b = await aspetta(() => v.inviaOrdine(ordine([riga('Sara Rossi', 'Costumino', 'S')])))
  const diB = (await aspetta(() => ordineDi(v, b?.id)))?.righe?.[0]
  ok('una riga di un altro ordine no', await errore(() => v.correggiRighe(a?.id, [{ ...riga('Luca Rossi', 'Judogi', '130'), id: diB?.id }])),
    'Una riga non è di quest\'ordine: ricarica la pagina')
  ok('e la riga resta all’altro', (await aspetta(() => ordineDi(v, b?.id)))?.righe?.length, 1)
  ok('un ordine che non c’è più: lo stesso messaggio del database', await errore(() => v.correggiRighe('non-c-e', [riga('Luca Rossi', 'Judogi', '130')])),
    'L\'ordine non c\'è più: ricarica la pagina')
  ok('anche segnandolo saldato', await errore(() => v.segnaSaldato('non-c-e', 'bonifico')), 'L\'ordine non c\'è più: ricarica la pagina')
}
{
  // I limiti del catalogo, coi messaggi del database.
  const { v } = nuova('2026-10-10')
  const no = (capi, chiude = '2026-10-17') => errore(() => v.salvaCatalogo({ chiude, capi }))
  ok('51 capi no', await no(Array.from({ length: 51 }, (_, n) => ({ capo: `Capo ${n + 1}`, taglie: ['S'], prezzo: 10 }))), 'Il catalogo ha al massimo 50 capi')
  ok('31 taglie no', await no([{ ...judogi, taglie: Array.from({ length: 31 }, (_, n) => String(n + 1)) }]), 'Le taglie del capo «Judogi» sono troppe o troppo lunghe')
  ok('una taglia di 21 caratteri no', await no([{ ...judogi, taglie: ['x'.repeat(21)] }]), 'Le taglie del capo «Judogi» sono troppe o troppo lunghe')
  ok('un nome di capo di 81 lettere no', await no([{ ...judogi, capo: 'J'.repeat(81) }]), `Il nome del capo «${'J'.repeat(80)}» è troppo lungo`)
  ok('un prezzo oltre 9999 no', await no([{ ...judogi, prezzo: 10000 }]), '«Judogi» non ha un prezzo')
  ok('un prezzo coi millesimi no', await no([{ ...judogi, prezzo: 35.125 }]), '«Judogi» non ha un prezzo')
  ok('una data che non c’è no', await no(CAPI, '2026-02-30'), 'La data di chiusura non sembra una data')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: [judogi, { ...costumino, taglie: ['S', ' S', 'M', 'S'] }] }))
  ok('le taglie doppie si tolgono, nell’ordine scritto', (await aspetta(() => v.catalogo()))?.capi?.[1]?.taglie, ['S', 'M'])
}
{
  // I limiti dell'ordine, coi messaggi del database.
  const { v } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const no = (o) => errore(() => v.inviaOrdine(o))
  const una = [riga('Luca Rossi', 'Judogi', '130')]
  ok('21 righe no', await no(ordine(Array.from({ length: 21 }, () => riga('Luca Rossi', 'Judogi', '130')))), 'Un ordine ha al massimo 20 righe: dividilo in due')
  ok('un nome di 81 lettere no', await no(ordine(una, { nome: 'a'.repeat(81) })), 'Un campo non va: nome e cognome sono troppo lunghi')
  ok('un cognome di 81 lettere no', await no(ordine(una, { cognome: 'a'.repeat(81) })), 'Un campo non va: nome e cognome sono troppo lunghi')
  ok('per chi di 161 lettere no', await no(ordine([riga('a'.repeat(161), 'Judogi', '130')])), 'Un campo non va: «per chi» è troppo lungo')
  ok('un telefono di 31 caratteri no', await no(ordine(una, { telefono: '333' + ' .'.repeat(12) + ' 123456' })), 'Il telefono non sembra giusto: servono da 6 a 15 cifre (spazi e + davanti vanno bene)')
  ok('un’email di 161 caratteri no', await no(ordine(una, { email: 'a'.repeat(150) + '@esempio.it' })), 'L\'email non sembra giusta: scrivila come nome@esempio.it')
  const s = await aspetta(() => v.inviaOrdine(ordine([riga(' Luca Rossi ', ' Judogi ', '130')], { email: ' Paola.Rossi@Esempio.IT ' })))
  const o = await aspetta(() => ordineDi(v, s?.id))
  ok('« Judogi » con gli spazi entra come Judogi', prova(() => o.righe.map((r) => [r.perChi, r.capo, r.prezzo])), [['Luca Rossi', 'Judogi', 35]])
  ok('e l’email si salva in minuscolo', prova(() => o.email), 'paola.rossi@esempio.it')
}

console.log('\n16. le regole delle pagine, in src/lib')
{
  const sp = (c, db, oggi) => prova(() => m.statoPagina(c, db, oggi))
  const cat = { chiude: '2026-10-17', capi: CAPI }
  ok('dal telefono: fino al 17/10 aperti', sp(cat, undefined, '2026-10-17'), 'aperti')
  ok('dal telefono: il 18/10 chiusi', sp(cat, undefined, '2026-10-18'), 'chiusi')
  ok('senza catalogo: non aperti', sp(null, undefined, '2026-10-10'), 'non aperti')
  ok('senza data: non aperti', sp({ chiude: null, capi: CAPI }, undefined, '2026-10-10'), 'non aperti')
  ok('senza capi: non aperti', sp({ chiude: '2026-10-17', capi: [] }, undefined, '2026-10-10'), 'non aperti')
  ok('il database dice chiusi e il telefono è indietro di un giorno: chiusi, non «non aperti»', sp(cat, false, '2026-10-17'), 'chiusi')
  ok('il database dice aperti e il telefono è avanti: aperti', sp(cat, true, '2026-10-18'), 'aperti')
  ok('il database dice chiusi e non c’è data: non aperti', sp({ chiude: null, capi: CAPI }, false, '2026-10-10'), 'non aperti')
  ok('il database dice chiusi e non c’è catalogo: non aperti', sp(null, false, '2026-10-10'), 'non aperti')

  const bozza = (capi, chiude = '2026-10-17') => ({ chiude, capi: capi.map((x) => ({ capo: 'Judogi', taglie: '120, 130', prezzo: '35', nota: '', ...x })) })
  const letto = prova(() => m.catalogoDaBozza(bozza([{ capo: ' Judogi ', prezzo: '12,50' }, { capo: 'Costumino', taglie: 'S, M, S', prezzo: '35', nota: ' Fino ai 14 anni la taglia è l’età ' }])))
  ok('dalla bozza: «12,50» è 12,5, «35» è 35, le taglie con taglieDa, nomi e note senza spazi', prova(() => letto.catalogo.capi.map((c) => [c.capo, c.taglie, c.prezzo, c.nota ?? null])), [
    ['Judogi', ['120', '130'], 12.5, null],
    ['Costumino', ['S', 'M'], 35, 'Fino ai 14 anni la taglia è l’età'],
  ])
  ok('e la data', prova(() => letto.catalogo.chiude), '2026-10-17')
  ok('una data vuota è nessuna data', prova(() => m.catalogoDaBozza(bozza([{}], '')).catalogo.chiude), null)
  ok('un prezzo che non si capisce', prova(() => m.catalogoDaBozza(bozza([{ prezzo: 'trenta' }]))), { guaio: 'Il prezzo di «Judogi» non si capisce: «trenta»' })
  ok('un prezzo vuoto', prova(() => m.catalogoDaBozza(bozza([{ prezzo: '' }]))), { guaio: '«Judogi» non ha un prezzo' })
  ok('e il resto lo dice cosaNonVaCatalogo', prova(() => m.catalogoDaBozza(bozza([{}, {}]))), { guaio: '«Judogi» c\'è due volte: due prezzi sono due capi, con due nomi diversi' })

  const prima = [{ id: 'r1', perChi: 'Luca Rossi', capo: 'Judogi', taglia: '150', quanti: 2, prezzo: 35 }, { id: 'r2', perChi: 'Sara Rossi', capo: 'Felpa', taglia: 'S', quanti: 1, prezzo: 28 }]
  const ora = [{ ...judogi, prezzo: 40 }, costumino]
  const pr = (r) => prova(() => m.prezzoRiga(prima, r, ora))
  ok('la riga che tiene il capo tiene il prezzo, anche cambiando taglia', pr({ id: 'r1', perChi: 'Luca Rossi', capo: 'Judogi', taglia: '140', quanti: 2 }), 35)
  ok('anche col capo scritto con gli spazi', pr({ id: 'r1', perChi: 'Luca Rossi', capo: ' Judogi ', taglia: '140', quanti: 2 }), 35)
  ok('il capo cambiato prende il prezzo di adesso', pr({ id: 'r1', perChi: 'Luca Rossi', capo: 'Costumino', taglia: 'S', quanti: 2 }), 30)
  ok('una riga nuova prende il prezzo di adesso', pr({ perChi: 'Luca Rossi', capo: 'Judogi', taglia: '140', quanti: 1 }), 40)
  ok('un id che non c’era è una riga nuova', pr({ id: 'zz', perChi: 'Luca Rossi', capo: 'Judogi', taglia: '140', quanti: 1 }), 40)

  const scelte = (r) => prova(() => m.capiPerRiga(prima, ora)(r).map((c) => [c.capo, c.taglie]))
  ok('la riga che tiene capo e taglia ha anche la sua taglia tolta dal catalogo', scelte({ id: 'r1', perChi: 'Luca Rossi', capo: 'Judogi', taglia: '150', quanti: 2 }), [['Judogi', ['120', '130', '140', '150']], ['Costumino', ['S', 'M']]])
  ok('e il suo capo tolto dal catalogo', scelte({ id: 'r2', perChi: 'Sara Rossi', capo: 'Felpa', taglia: 'S', quanti: 1 }), [['Judogi', ['120', '130', '140']], ['Costumino', ['S', 'M']], ['Felpa', ['S']]])
  ok('una riga nuova ha solo il catalogo', scelte({ perChi: 'Luca Rossi', capo: 'Judogi', taglia: '130', quanti: 1 }), [['Judogi', ['120', '130', '140']], ['Costumino', ['S', 'M']]])
  ok('una riga che ha cambiato taglia ha solo il catalogo', scelte({ id: 'r1', perChi: 'Luca Rossi', capo: 'Judogi', taglia: '130', quanti: 2 }), [['Judogi', ['120', '130', '140']], ['Costumino', ['S', 'M']]])

  const o = { id: 'o1', raccolta: 'r', nome: 'Paola', cognome: 'Rossi', telefono: '333 123 4567', email: null, righe: [{ id: 'x', perChi: 'Luca Bianchi', capo: 'Judogi', taglia: '130', quanti: 1, prezzo: 35 }], totale: 35, saldato: false, annullato: false }
  const cerca = (t) => prova(() => m.cercaOrdine(o, t))
  ok('si cerca per nome, cognome e per chi, senza maiuscole', ['paola', 'ROSSI', 'bianchi'].map(cerca), [true, true, true])
  ok('e per le cifre del telefono, scritte in un altro modo', ['1234567', '333-123'].map(cerca), [true, true])
  ok('un testo senza cifre non combacia col telefono', cerca('Verdi'), false)
  ok('un testo vuoto li prende tutti', [cerca(''), cerca('  ')], [true, true])
  ok('le cifre del telefono: «393 123 4567» è un cellulare, resta com’è', prova(() => m.cifreTelefono('393 123 4567')), '3931234567')
  ok('«39 347 0001111» ha il prefisso, si toglie', prova(() => m.cifreTelefono('39 347 0001111')), '3470001111')

  ok('MAX_CAPI è 50, come vestiario_regole()', m.MAX_CAPI, 50)
  ok('ORDINE_SPARITO è il messaggio del database', m.ORDINE_SPARITO, 'L\'ordine non c\'è più: ricarica la pagina')
  ok('totaleCorretto: un capo nuovo con gli spazi ha il prezzo del catalogo', prova(() => m.totaleCorretto([], [riga('Luca Rossi', ' Judogi ', '130', 2)], CAPI)), 70)
  ok('totaleCorretto: la riga che tiene il capo, scritto con gli spazi, tiene il suo prezzo', prova(() => m.totaleCorretto(prima, [{ id: 'r1', perChi: 'Luca Rossi', capo: ' Judogi ', taglia: '140', quanti: 2 }], ora)), 70)
}

console.log('\n17. le righe nell’ordine mandato, e lo stesso ordine mandato due volte')
{
  const { v } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const a = await aspetta(() => v.inviaOrdine(ordine([riga('Uno', 'Judogi', '130'), riga('Due', 'Judogi', '140'), riga('Tre', 'Costumino', 'S')])))
  const righe = async () => (await aspetta(() => ordineDi(v, a?.id)))?.righe ?? []
  const [uno, due, tre] = await righe()
  await aspetta(() => v.correggiRighe(a?.id, [{ ...uno, quanti: 2 }, due, tre]))
  ok('cambiata la prima, sempre 1, 2, 3', (await righe()).map((r) => `${r.perChi} ${r.quanti}`), ['Uno 2', 'Due 1', 'Tre 1'])
  const dopo = await righe()
  await aspetta(() => v.correggiRighe(a?.id, [dopo[2], dopo[0], dopo[1]]))
  ok('mandate in un altro ordine, tornano in quello', (await righe()).map((r) => r.perChi), ['Tre', 'Uno', 'Due'])

  const id = 'dispositivo-1234'
  const primo = await aspetta(() => v.inviaOrdine({ ...ordine([riga('Luca Rossi', 'Judogi', '130', 2)]), id }))
  const secondo = await aspetta(() => v.inviaOrdine({ ...ordine([riga('Luca Rossi', 'Judogi', '130', 2)]), id }))
  ok('il primo invio ha l’id del dispositivo', primo?.id, id)
  ok('il secondo risponde con lo stesso ordine', [secondo?.id, secondo?.totale], [id, 70])
  const terzo = await aspetta(() => v.inviaOrdine({ ...ordine([riga('Sara Rossi', 'Costumino', 'S')], { nome: 'Altro', telefono: '+39 333 1234567' }), id }))
  ok('con dati diversi, e lo stesso telefono col +39, risponde con quello già salvato', [terzo?.id, terzo?.totale], [id, 70])
  ok('con un altro telefono è rifiutato, senza le righe di quell’ordine', await errore(() => v.inviaOrdine({ ...ordine([riga('Sara Rossi', 'Costumino', 'S')], { telefono: '333 999 9999' }), id })),
    'Quest\'ordine non si può rimandare: ricarica la pagina e rifallo')
  const tutti = (await Promise.all((await raccolte(v)).map((r) => aspetta(() => v.ordini(r.id))))).flat()
  ok('un ordine solo con quell’id', Array.isArray(tutti) ? tutti.filter((o) => o?.id === id).length : tutti, 1)
  const salvato = await aspetta(() => ordineDi(v, id))
  ok('e non è cambiato', prova(() => [salvato.nome, salvato.totale, salvato.righe.map((r) => `${r.perChi} ${r.capo} ${r.quanti}`)]), ['Paola', 70, ['Luca Rossi Judogi 2']])
  const senza = await aspetta(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130', 2)])))
  ok('senza id funziona come prima: un ordine nuovo', [typeof senza?.id, senza?.id !== id], ['string', true])
}

console.log('\n18. la metà vera (vestiarioDati.ts), con un database finto')
{
  // Un finto client, come in prova-richieste.mjs: registra ogni chiamata e risponde con quel che gli si dà.
  const finto = ({ rpc = {}, tabella = { data: [], error: null } } = {}) => {
    const reg = []
    const catena = () => {
      const c = {
        select: (...a) => (reg.push(['select', ...a]), c),
        update: (...a) => (reg.push(['update', ...a]), c),
        order: (...a) => (reg.push(['order', ...a]), c),
        eq: (...a) => (reg.push(['eq', ...a]), c),
        then: (bene, male) => Promise.resolve(tabella).then(bene, male),
      }
      return c
    }
    const db = {
      from: (t) => (reg.push(['from', t]), catena()),
      rpc: async (nome, args) => (reg.push(['rpc', nome, args]), rpc[nome] ?? { data: null, error: null }),
    }
    return { v: m.creaVestiarioSupabase(db), reg }
  }
  const ERR = (code, message = 'testo grezzo') => ({ data: null, error: { code, message } })
  const args = (reg, nome) => reg.find((x) => x[0] === 'rpc' && x[1] === nome)?.[2]

  {
    const { v, reg } = finto()
    await aspetta(() => v.correggiRighe('o1', [{ id: 'r1', perChi: 'Luca Rossi', capo: 'Judogi', taglia: '140', quanti: 2 }, riga('Sara Rossi', 'Costumino', 'S')]))
    ok('correggiRighe manda l’id delle righe che c’erano, e per_chi', prova(() => [args(reg, 'correggi_ordine_vestiario').ordine, args(reg, 'correggi_ordine_vestiario').righe.map((r) => [r.id ?? null, r.per_chi])]),
      ['o1', [['r1', 'Luca Rossi'], [null, 'Sara Rossi']]])
  }
  {
    const { v, reg } = finto({ rpc: { invia_ordine_vestiario: { data: { id: 'dev-1', totale: '70.00', righe: [{ per_chi: 'Luca Rossi', capo: 'Judogi', taglia: '130', quanti: 2, prezzo: '35.00' }] }, error: null } } })
    const o = await aspetta(() => v.inviaOrdine({ ...ordine([riga('Luca Rossi', 'Judogi', '130', 2)], { email: ' Paola.Rossi@Esempio.IT ' }), id: 'dev-1' }))
    const dati = args(reg, 'invia_ordine_vestiario')?.dati
    ok('inviaOrdine manda l’id del dispositivo e l’email in minuscolo', [dati?.id, dati?.email], ['dev-1', 'paola.rossi@esempio.it'])
    ok('e risponde con numeri, non testi: totale e prezzo', prova(() => [o.totale, o.righe[0].prezzo]), [70, 35])
    ok('per_chi diventa perChi', prova(() => o.righe[0].perChi), 'Luca Rossi')
  }
  {
    const { v, reg } = finto({ tabella: { data: [{ id: 'o1', raccolta_id: 'rc-1', nome: 'Paola', cognome: 'Rossi', telefono: '333 123 4567', email: null, totale: '70.00', saldato: false, annullato: false,
      pagato: '35.00', pagato_con: 'satispay', pagato_il: '2026-10-12', creato_il: '2026-10-10T18:00:00+00:00', dal_banco: true,
      righe_vestiario: [{ id: 'r1', per_chi: 'Luca Rossi', capo: 'Judogi', taglia: '130', quanti: 2, prezzo: '35.00' }] }], error: null } })
    const x = await aspetta(() => v.ordini('rc-1'))
    ok('ordini() chiede le righe in ordine di posizione', reg.some((c) => JSON.stringify(c) === JSON.stringify(['order', 'posizione', { referencedTable: 'righe_vestiario' }])), true)
    ok('raccolta_id diventa raccolta, per_chi perChi', prova(() => [x[0].raccolta, x[0].righe[0].perChi, x[0].righe[0].id]), ['rc-1', 'Luca Rossi', 'r1'])
    ok('totale e prezzo sono numeri', prova(() => [x[0].totale, x[0].righe[0].prezzo]), [70, 35])
    ok('il già pagato, come e quando, l’arrivo e la provenienza', prova(() => [x[0].pagato, x[0].pagatoCon, x[0].pagatoIl, x[0].arrivato, x[0].dalBanco]), [35, 'satispay', '2026-10-12', '2026-10-10T18:00:00+00:00', true])
    ok('ordini() va dal più recente', reg.some((c) => JSON.stringify(c) === JSON.stringify(['order', 'creato_il', { ascending: false }])), true)
  }
  {
    const { v, reg } = finto()
    await aspetta(() => v.segnaSaldato('o1', 'contanti'))
    await aspetta(() => v.segnaSaldato('o2', null, true))
    ok('segnaSaldato chiama segna_vestiario con come e tieni_pagato', reg.filter((c) => c[0] === 'rpc').map((c) => [c[1], c[2]]),
      [['segna_vestiario', { ordine: 'o1', come: 'contanti', tieni_pagato: false }], ['segna_vestiario', { ordine: 'o2', come: null, tieni_pagato: true }]])
    await aspetta(() => v.scriviOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')]), 'satispay'))
    ok('scriviOrdine manda come', args(reg, 'scrivi_ordine_vestiario')?.come, 'satispay')
  }
  ok('sposta su una raccolta che non c’è più (23503)', await errore(() => finto({ tabella: ERR('23503') }).v.sposta('o1', 'rc-x')), m.RACCOLTA_SPARITA)
  ok('catalogo senza permesso (42501): nessun catalogo', await aspetta(() => finto({ rpc: { vestiario: ERR('42501') } }).v.catalogo()), null)
  const zitto = console.error
  console.error = () => {}
  const grezzo = await errore(() => finto({ rpc: { invia_ordine_vestiario: ERR('22023', 'invalid input syntax for type uuid: "x"') } }).v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')])))
  console.error = zitto
  ok('un errore inglese 22023 non arriva così com’è', [grezzo.includes('invalid input'), grezzo === 'nessun errore'], [false, false])
  ok('il rifiuto italiano 22023 sì', await errore(() => finto({ rpc: { invia_ordine_vestiario: ERR('22023', m.CHIUSI) } }).v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')]))), m.CHIUSI)
}

console.log('\n19. altre regole uguali al database')
{
  const { v, orologio } = nuova('2026-10-17')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const prima = await raccolte(v)
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-24', capi: CAPI }))
  ok('chiude oggi, prorogata di una settimana: stessa raccolta, con la data nuova', (await raccolte(v)).map((r) => [r.id, r.chiude]), prima.map((r) => [r.id, '2026-10-24']))
  ok('e c’era', prima.length > 0, true)

  const id = 'dispositivo-chiuso'
  const a = await aspetta(() => v.inviaOrdine({ ...ordine([riga('Luca Rossi', 'Judogi', '130')]), id }))
  orologio.oggi = '2026-10-25'
  const b = await aspetta(() => v.inviaOrdine({ ...ordine([riga('Luca Rossi', 'Judogi', '130')]), id }))
  ok('a raccolta chiusa, lo stesso ordine rimandato risponde con quello salvato', [a?.id, b?.id, b?.totale], [id, id, 35])

  ok('«Judogi» e «judogi» sono lo stesso capo', await errore(() => v.salvaCatalogo({ chiude: '2026-10-24', capi: [judogi, { ...costumino, capo: 'judogi' }] })),
    '«judogi» c\'è due volte: due prezzi sono due capi, con due nomi diversi')
}

console.log('\n20. dal collaudo')
{
  // Due schede aperte sullo stesso dispositivo: ognuna rilegge localStorage, nessuna cancella l'altra.
  const { v: a } = nuova('2026-10-10')
  await aspetta(() => a.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const y = await aspetta(() => a.inviaOrdine(ordine([riga('Sara Rossi', 'Costumino', 'S')])))
  const b = m.creaVestiarioProva(() => '2026-10-10')
  const x = await aspetta(() => a.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')])))
  await aspetta(() => b.segnaSaldato(y?.id, 'bonifico'))
  const c = m.creaVestiarioProva(() => '2026-10-10')
  ok('due schede: l’ordine di A c’è ancora dopo che B ha segnato un saldato', [!!(await aspetta(() => ordineDi(c, x?.id))), (await aspetta(() => ordineDi(c, y?.id)))?.saldato], [true, true])
  ok('e B lo vede', !!(await aspetta(() => ordineDi(b, x?.id))), true)
}
{
  const TEL = 'Il telefono non sembra giusto: servono da 6 a 15 cifre (spazi e + davanti vanno bene)'
  const EMAIL = 'L\'email non sembra giusta: scrivila come nome@esempio.it'
  const manca = (o) => prova(() => m.mancaNellOrdine(o, CAPI).map((x) => [x.nome, x.chiave, x.scrittoMale]))
  const una = [riga('Luca Rossi', 'Judogi', '130')]
  ok('la barra dice l’email scritta male, e porta al campo', manca(ordine(una, { email: 'paola' })), [[EMAIL, 'email', true]])
  ok('e il telefono con meno di 6 cifre', manca(ordine(una, { telefono: '123' })), [[TEL, 'telefono', true]])
  ok('e il telefono con le lettere', manca(ordine(una, { telefono: '333 abc 4567' })), [[TEL, 'telefono', true]])
  ok('lo stesso testo di cosaNonVaOrdine', prova(() => m.cosaNonVaOrdine(ordine(una, { telefono: '123' }), CAPI)), TEL)
}
{
  const o = { id: 'o1', raccolta: 'r', nome: 'Paola', cognome: 'Rossi', telefono: '333 123 4567', email: null, righe: [], totale: 125, saldato: true, annullato: false }
  const av = (x, t) => prova(() => m.avvisoSaldato(x, t))
  ok('saldato e il totale cambia: lo dice', av(o, 205), 'L\'ordine è già saldato: il totale passa da 125 € a 205 €.')
  ok('coi centesimi come la pagina', av({ ...o, totale: 35 }, 40.5), 'L\'ordine è già saldato: il totale passa da 35 € a 40,50 €.')
  ok('stesso totale: niente', av(o, 125), null)
  ok('il totale scende: niente (resta saldato, non c’è da chiedere)', av(o, 100), null)
  ok('da saldare: niente', av({ ...o, saldato: false }, 205), null)
  ok('annullato: niente', av({ ...o, annullato: true }, 205), null)
}
{
  const R = { id: 'rc-1', chiude: '2026-10-17' }
  const ef = (r, chiude, oggi) => prova(() => m.effettoSalvataggio(r, chiude, oggi))
  const PASSATA = 'La data è già passata: la pagina degli ordini si chiude subito.'
  const NUOVA = 'Si apre una raccolta nuova, vuota: gli ordini di prima restano in quella del 17 ottobre.'
  ok('senza data: solo i capi', ef(R, null, '2026-10-10'), { cosa: 'solo capi', avviso: null })
  ok('la stessa data: solo i capi', ef(R, '2026-10-17', '2026-10-10'), { cosa: 'solo capi', avviso: null })
  ok('raccolta aperta e data nuova: proroga', ef(R, '2026-10-24', '2026-10-10'), { cosa: 'proroga', avviso: null })
  ok('il giorno della chiusura è ancora aperta: proroga', ef(R, '2026-10-24', '2026-10-17'), { cosa: 'proroga', avviso: null })
  ok('raccolta aperta, data già passata: proroga che chiude subito', ef(R, '2026-10-09', '2026-10-10'), { cosa: 'proroga', avviso: PASSATA })
  ok('raccolta chiusa e data nuova: raccolta nuova, e lo dice', ef(R, '2027-03-20', '2026-10-18'), { cosa: 'raccolta nuova', avviso: NUOVA })
  ok('nessuna raccolta e una data: raccolta nuova, senza avviso', ef(undefined, '2026-10-24', '2026-10-10'), { cosa: 'raccolta nuova', avviso: null })
  ok('nessuna raccolta e nessuna data: solo i capi', ef(undefined, null, '2026-10-10'), { cosa: 'solo capi', avviso: null })
  ok('raccolta chiusa e data già passata: i due avvisi, in quest’ordine', ef(R, '2026-10-15', '2026-10-18'), { cosa: 'raccolta nuova', avviso: `${PASSATA} ${NUOVA}` })
}
{
  // Un valore che Excel leggerebbe come formula esce con un ' davanti.
  const tel = (o, telefono) => ({ ...o, telefono })
  const brutti = [
    tel(fatto('f1', 'Rossi', [riga('=HYPERLINK("x";"y")', 'Judogi', '140')], 35, true), '+39 340 111 2222'),
    fatto('f2', 'Bianchi', [riga('@Tommaso', 'Judogi', '140')], 35, true),
    fatto('f3', 'Verdi', [riga('-Anna', 'Judogi', '140')], 35, true),
    fatto('f4', 'Neri', [riga('\tUgo', 'Judogi', '140')], 35, true),
    fatto('f5', 'Gialli', [riga('Luca\rGialli', 'Judogi', '140')], 35, true),
  ]
  const righe = String(prova(() => m.csvPersone(brutti))).split('\r\n')
  ok('per chi «=HYPERLINK(…)» col \' davanti, e il telefono +39 pure', righe.includes('"\'=HYPERLINK(""x"";""y"")";Judogi;140;1;Rossi Paola;\'+39 340 111 2222;saldato'), true)
  ok('anche @, - e il tab', ["'@Tommaso;", "'-Anna;", "'\tUgo;"].map((x) => righe.some((r) => r.startsWith(x))), [true, true, true])
  ok('un valore con \\r va tra virgolette', righe.some((r) => r.startsWith('"Luca\rGialli";')), true)
  const capi = [{ capo: '=Cintura', taglie: ['240'], prezzo: 6 }]
  ok('anche per il fornitore', prova(() => m.csvFornitore([fatto('f6', 'Rossi', [riga('Luca Rossi', '=Cintura', '240')], 6, true)], capi).split('\r\n')), ['capo;taglia;quanti', "'=Cintura;240;1"])
}
{
  const { v, orologio } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  orologio.oggi = '2026-10-20'
  const id = 'banco-dispositivo'
  const uno = await aspetta(() => v.scriviOrdine({ ...ordine([riga('Marco Bianchi', 'Costumino', 'M')]), id }, 'bonifico'))
  const due = await aspetta(() => v.scriviOrdine({ ...ordine([riga('Marco Bianchi', 'Costumino', 'M')], { telefono: '+39 333 1234567' }), id }, 'bonifico'))
  ok('dal banco con un id, rimandato: lo stesso id', [uno, due], [id, id])
  const tutti = (await Promise.all((await raccolte(v)).map((r) => aspetta(() => v.ordini(r.id))))).flat()
  ok('e non ne crea un altro', tutti.filter((o) => o?.id === id).length, 1)
  ok('con un altro telefono è rifiutato', await errore(() => v.scriviOrdine({ ...ordine([riga('Marco Bianchi', 'Costumino', 'M')], { telefono: '333 999 9999' }), id }, 'bonifico')),
    'Quest\'ordine non si può rimandare: ricarica la pagina e rifallo')
}
{
  ok('ilGiorno: il 17 ottobre, l’8 ottobre, l’11 novembre, il 1° maggio', ['2026-10-17', '2026-10-08', '2026-11-11', '2027-05-01'].map((d) => prova(() => m.ilGiorno(d))),
    ['il 17 ottobre', "l'8 ottobre", "l'11 novembre", 'il 1° maggio'])
  ok('MAX_RIGHE_DETTO', m.MAX_RIGHE_DETTO, 'Al massimo 20 righe in un ordine: per altro fai un secondo ordine')
}

console.log('\n21. il già pagato, come ha pagato, da dove arriva, i doppioni')
{
  const { v } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const a = await aspetta(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')])))
  const leggi = async (id) => aspetta(() => ordineDi(v, id))
  const pag = (o) => prova(() => [o.saldato, o.pagato, o.pagatoCon, o.pagatoIl])
  ok('arriva da saldare, niente pagato', pag(await leggi(a?.id)), [false, 0, null, null])
  await aspetta(() => v.segnaSaldato(a?.id, 'bonifico'))
  ok('saldato: pagato il totale, con bonifico, oggi', pag(await leggi(a?.id)), [true, 35, 'bonifico', '2026-10-10'])
  await aspetta(() => v.segnaSaldato(a?.id, null))
  ok('tolto a mano: pagato 0, come e quando vuoti', pag(await leggi(a?.id)), [false, 0, null, null])
  ok('come fuori da bonifico, satispay o contanti: rifiutato', (await errore(() => v.segnaSaldato(a?.id, 'assegno'))) !== 'nessun errore', true)
  ok('e l’ordine resta com’era', pag(await leggi(a?.id)), [false, 0, null, null])
  await aspetta(() => v.annulla(a?.id, true))
  ok('segnare un annullato: rifiutato', String(await errore(() => v.segnaSaldato(a?.id, 'contanti'))).startsWith('Rimetti l\'ordine prima di segnarlo'), true)
  ok('e resta da saldare', pag(await leggi(a?.id)), [false, 0, null, null])

  // Correzione di un saldato: RESTA SALDATO.
  const b = await aspetta(() => v.inviaOrdine(ordine([riga('Sara Rossi', 'Judogi', '130')])))
  await aspetta(() => v.segnaSaldato(b?.id, 'satispay'))
  const rb = (await leggi(b?.id))?.righe?.[0]
  await aspetta(() => v.correggiRighe(b?.id, [{ ...rb, quanti: 2 }]))
  ok('corretto da 35 a 70, resta saldato: pagato 70', pag(await leggi(b?.id)), [true, 70, 'satispay', '2026-10-10'])

  // Correzione di un saldato: TOGLI IL SEGNO, prima di salvare la correzione.
  const c = await aspetta(() => v.inviaOrdine(ordine([riga('Ugo Neri', 'Judogi', '130')])))
  await aspetta(() => v.segnaSaldato(c?.id, 'contanti'))
  const rc = (await leggi(c?.id))?.righe?.[0]
  await aspetta(() => v.segnaSaldato(c?.id, null, true))
  await aspetta(() => v.correggiRighe(c?.id, [{ ...rc, quanti: 2 }]))
  const oc = await leggi(c?.id)
  ok('TOGLI IL SEGNO: da saldare, il pagato di prima resta, con come e quando', pag(oc), [false, 35, 'contanti', '2026-10-10'])
  ok('da pagare: 35', prova(() => oc.totale - oc.pagato), 35)
  ok('e nei numeri manca 35, incassato 35', prova(() => { const n = m.numeriRaccolta([oc]); return [n.incassato, n.mancante] }), [35, 35])

  const banco = await aspetta(() => v.scriviOrdine(ordine([riga('Marco Bianchi', 'Costumino', 'M')]), 'contanti'))
  const ob = await leggi(banco)
  ok('dal banco già saldato: con contanti, oggi, dal banco', prova(() => [ob.saldato, ob.pagato, ob.pagatoCon, ob.pagatoIl, ob.dalBanco]), [true, 30, 'contanti', '2026-10-10', true])
  const banco2 = await aspetta(() => v.scriviOrdine(ordine([riga('Marco Bianchi', 'Costumino', 'M')], { telefono: '347 000 9999' })))
  ok('dal banco senza come: da saldare', pag(await leggi(banco2)), [false, 0, null, null])
  ok('dal banco con un come sbagliato: rifiutato', (await errore(() => v.scriviOrdine(ordine([riga('Marco Bianchi', 'Costumino', 'M')], { telefono: '347 000 8888' }), 'assegno'))) !== 'nessun errore', true)
  ok('dal link: non dal banco, con l’ora d’arrivo', prova(() => [oc.dalBanco, /^\d{4}-\d{2}-\d{2}T/.test(oc.arrivato)]), [false, true])
}
{
  // L'elenco va dal più recente.
  const { v } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const primo = await aspetta(() => v.inviaOrdine(ordine([riga('Primo', 'Judogi', '130')])))
  await new Promise((fatto) => setTimeout(fatto, 5))
  const secondo = await aspetta(() => v.inviaOrdine(ordine([riga('Secondo', 'Judogi', '130')])))
  const r = (await raccolte(v))[0]
  ok('ordini() dal più recente', (await aspetta(() => v.ordini(r?.id)))?.map?.((o) => o.id), [secondo?.id, primo?.id])
}
{
  // I numeri col già pagato.
  const ordini = [
    { ...fatto('p1', 'Rossi', [riga('Luca Rossi', 'Judogi', '140', 2)], 70, false), pagato: 63, pagatoCon: 'bonifico', pagatoIl: '2026-10-12' },
    fatto('p2', 'Bianchi', [riga('Tommaso Bianchi', 'Judogi', '140')], 35, true),
    fatto('p3', 'Verdi', [riga('Anna Verdi', 'Costumino', 'S')], 30, false),
    { ...fatto('p4', 'Neri', [riga('Ugo Neri', 'Costumino', 'M')], 30, true, true) },
  ]
  ok('incassato = somma del pagato, mancante = totale − pagato dei non saldati; annullati fuori', prova(() => { const n = m.numeriRaccolta(ordini); return [n.ordini, n.saldati, n.daSaldare, n.incassato, n.mancante] }), [3, 1, 2, 98, 37])
  ok('il fornitore ha solo i saldati, non chi ha pagato in parte', prova(() => m.elencoFornitore(ordini, CAPI).map((x) => `${x.capo} ${x.taglia}: ${x.quanti}`)), ['Judogi 140: 1'])
}
{
  // Stesso telefono nella stessa raccolta.
  const tel = (id, telefono, annullato = false) => ({ ...fatto(id, 'Rossi', [riga('Luca Rossi', 'Judogi', '140')], 35, false, annullato), telefono })
  const ordini = [tel('t1', '333 123 4567'), tel('t2', '+39 3331234567'), tel('t3', '333-123-4567', true), tel('t4', '340 000 0000'), tel('t5', '340 111 1111', true), tel('t6', '0039 340 111 1111', true)]
  ok('stessoTelefono: +39 e spazi contano uguale, gli annullati no', prova(() => [...m.stessoTelefono(ordini)].sort()), ['t1', 't2'])
  ok('ordineConStessoTelefono trova chi ha già ordinato', prova(() => ['t1', 't2'].includes(m.ordineConStessoTelefono(ordini, '0039 333 123 4567')?.id)), true)
  ok('un annullato non conta', prova(() => m.ordineConStessoTelefono(ordini, '340 111 1111') ?? null), null)
  ok('un telefono nuovo: nessuno', prova(() => m.ordineConStessoTelefono(ordini, '347 222 3333') ?? null), null)
}

console.log('\n22. dalla rilettura del codice')
{
  ok('RACCOLTA_SPARITA', m.RACCOLTA_SPARITA, 'Questa raccolta non c\'è più: ricarica la pagina')
  const { v, orologio } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const a = await aspetta(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')])))
  ok('in prova, spostare su una raccolta che non c’è: lo stesso testo', await errore(() => v.sposta(a?.id, 'rc-non-c-e')), m.RACCOLTA_SPARITA)

  // TOGLI IL SEGNO dentro la correzione, tutto insieme.
  const leggi = async (id) => aspetta(() => ordineDi(v, id))
  const pag = (o) => prova(() => [o.saldato, o.totale, o.pagato, o.pagatoCon, o.pagatoIl])
  const sale = await aspetta(() => v.inviaOrdine(ordine([riga('Sara Rossi', 'Judogi', '130')])))
  await aspetta(() => v.segnaSaldato(sale?.id, 'contanti'))
  const rs = (await leggi(sale?.id))?.righe?.[0]
  await aspetta(() => v.correggiRighe(sale?.id, [{ ...rs, quanti: 2 }], true))
  ok('togliSegno col totale che sale: da saldare, pagato il vecchio totale, come e quando restano', pag(await leggi(sale?.id)), [false, 70, 35, 'contanti', '2026-10-10'])
  const scende = await aspetta(() => v.inviaOrdine(ordine([riga('Ugo Neri', 'Judogi', '130', 2)])))
  await aspetta(() => v.segnaSaldato(scende?.id, 'satispay'))
  const rd = (await leggi(scende?.id))?.righe?.[0]
  await aspetta(() => v.correggiRighe(scende?.id, [{ ...rd, quanti: 1 }], true))
  ok('togliSegno col totale che scende: si ignora, resta saldato col totale nuovo', pag(await leggi(scende?.id)), [true, 35, 35, 'satispay', '2026-10-10'])
  const uguale = await aspetta(() => v.inviaOrdine(ordine([riga('Anna Verdi', 'Judogi', '130')])))
  await aspetta(() => v.segnaSaldato(uguale?.id, 'bonifico'))
  const ru = (await leggi(uguale?.id))?.righe?.[0]
  await aspetta(() => v.correggiRighe(uguale?.id, [{ ...ru, taglia: '140' }], true))
  ok('togliSegno col totale uguale: si ignora', pag(await leggi(uguale?.id)), [true, 35, 35, 'bonifico', '2026-10-10'])
  orologio.oggi = '2026-10-10'
}
{
  const o = { ...fatto('m1', 'Rossi', [riga('Luca Rossi', 'Judogi', '140', 2)], 70, false), pagato: 63 }
  const mo = (x) => prova(() => m.mancanoOrdine(x))
  ok('mancanoOrdine: totale − pagato', mo(o), 7)
  ok('mai sotto zero', mo({ ...o, pagato: 80 }), 0)
  ok('saldato: 0', mo({ ...o, saldato: true }), 0)
  ok('annullato: 0', mo({ ...o, annullato: true }), 0)
  ok('numeriRaccolta: il pagato in più non toglie al mancante degli altri', prova(() => m.numeriRaccolta([o, { ...fatto('m2', 'Verdi', [riga('Anna Verdi', 'Costumino', 'S')], 30, false), pagato: 35 }]).mancante), 7)

  ok('raccoltaAperta: il giorno della chiusura sì, quello dopo no', ['2026-10-17', '2026-10-18'].map((g) => prova(() => m.raccoltaAperta({ id: 'r', chiude: '2026-10-17' }, g))), [true, false])
  const raccolte = [{ id: 'A', chiude: '2026-10-01' }, { id: 'B', chiude: '2026-10-17' }, { id: 'C', chiude: '2026-10-05' }, { id: 'D', chiude: '2026-11-01' }, { id: 'r1', chiude: '2026-12-01' }]
  ok('doveSpostare: prima le aperte, poi le chiuse, mai la sua', prova(() => m.doveSpostare(raccolte, o, '2026-10-10').map((r) => r.id)), ['B', 'D', 'A', 'C'])

  const tel = (id, telefono) => ({ ...fatto(id, 'Rossi', [riga('Luca Rossi', 'Judogi', '140')], 35, false), telefono })
  const ordini = [tel('t1', '333 123 4567'), tel('t2', '+39 3331234567'), tel('t3', '340 000 0000')]
  ok('ordineConStessoTelefono tranne sé stesso', prova(() => m.ordineConStessoTelefono(ordini, '333 123 4567', 't1')?.id ?? null), 't2')
  ok('e se c’è solo lui, nessuno', prova(() => m.ordineConStessoTelefono(ordini, '340 000 0000', 't3') ?? null), null)

  ok('alGiorno', ['2026-10-17', '2026-10-08', '2027-05-01', '2026-11-11'].map((d) => prova(() => m.alGiorno(d))), ['al 17 ottobre', "all'8 ottobre", 'al 1° maggio', "all'11 novembre"])
  ok('tagliaDopo: la taglia resta se il capo nuovo ce l’ha', prova(() => m.tagliaDopo(CAPI, 'Costumino', 'S')), 'S')
  ok('altrimenti si sceglie di nuovo', prova(() => [m.tagliaDopo(CAPI, 'Judogi', 'S'), m.tagliaDopo(CAPI, 'Felpa', 'S')]), ['', ''])
}

console.log('\n23. come il modulo: i tipi, le foto, le tabelle delle taglie')
{
  ok('i tre tipi, con le parole del modulo', prova(() => m.TIPI.map((t) => [t.id, t.nome])), [['judogi', 'JUDOGI'], ['costumini', 'COSTUMINI LOTTA'], ['vestiario', 'VESTIARIO LOGATO']])
  const no = (capi, tabelle) => prova(() => m.cosaNonVaCatalogo({ chiude: '2026-10-17', capi, ...(tabelle && { tabelle }) }))
  const FOTO = 'La foto di "Judogi" non si capisce: ricaricala'
  ok('tipo e foto giusti vanno', no([{ ...judogi, tipo: 'judogi', foto: 'judogi-1.jpg' }, { ...costumino, tipo: 'costumini', foto: 'c.webp' }], { judogi: 'tabella-judogi.png' }), null)
  ok('il tipo non è obbligatorio', no([{ ...judogi, foto: 'judogi-1.jpeg' }, costumino]), null)
  ok('un tipo fuori dai tre no', no([{ ...judogi, tipo: 'felpe' }]), '"Judogi": il tipo non si capisce')
  for (const [cosa, foto] of [['con la barra', 'cartella/judogi.jpg'], ['un indirizzo', 'http://esempio.it/judogi.jpg'], ['con i due punti', 'c:judogi.jpg'], ['con ..', 'su..giu.jpg'], ['una gif', 'judogi.gif'], ['senza estensione', 'judogi']])
    ok(`una foto ${cosa} no`, no([{ ...judogi, foto }]), FOTO)
  ok('una tabella che non è un file del contenitore no', no([judogi], { judogi: 'http://esempio.it/t.png' }), 'La tabella delle taglie di "JUDOGI" non si capisce: ricaricala')
  ok('una tabella di un tipo che non c’è no', no([judogi], { felpe: 't.png' }), 'La tabella delle taglie non si capisce: ricaricala')
  ok('fotoPubblica', prova(() => m.fotoPubblica('https://xyz.supabase.co', 'judogi-1.jpg')), 'https://xyz.supabase.co/storage/v1/object/public/vestiario/judogi-1.jpg')
}
{
  const J = { ...judogi, tipo: 'judogi' }
  const C = { ...costumino, tipo: 'costumini' }
  const F = { capo: 'Felpa', taglie: ['S', 'M'], prezzo: 28, tipo: 'vestiario' }
  const B = { capo: 'Cintura', taglie: ['240'], prezzo: 6, tipo: 'judogi' }
  ok('tipiDaMostrare: solo i tipi con capi, nell’ordine dei tipi', prova(() => m.tipiDaMostrare([F, J, B])), ['judogi', 'vestiario'])
  ok('un capo senza tipo: pagina sola', prova(() => m.tipiDaMostrare([J, { ...costumino }])), 'pagina sola')
  ok('nessun capo: pagina sola', prova(() => m.tipiDaMostrare([])), 'pagina sola')
  ok('capiDelTipo', prova(() => m.capiDelTipo([F, J, C, B], 'judogi').map((c) => c.capo)), ['Judogi', 'Cintura'])
  ok('capiDelTipo della pagina sola: tutti', prova(() => m.capiDelTipo([F, J, C], 'pagina sola').map((c) => c.capo)), ['Felpa', 'Judogi', 'Costumino'])

  const righe = [riga('Luca Rossi', 'Judogi', '130', 2), riga('Sara Rossi', 'Judogi', '120'), riga('Luca Rossi', 'Costumino', 'S')]
  ok('sceltePagina: quel che Luca ha già scelto fra i judogi', prova(() => m.sceltePagina(righe, 'Luca Rossi', [J, B])), { Judogi: { taglia: '130', quanti: 2 } })
  ok('per chi non ha scelto niente: vuoto', prova(() => m.sceltePagina(righe, 'Ugo Neri', [J, B])), {})
  const testo = (rr) => rr.map((x) => `${x.perChi}|${x.capo}|${x.taglia}|${x.quanti}`).sort()
  ok('applicaScelte: toglie le righe di Luca per quei capi e mette le scelte; il resto resta',
    prova(() => testo(m.applicaScelte(righe, 'Luca Rossi', [J, B], { Judogi: { taglia: '140', quanti: 3 }, Cintura: { taglia: '240', quanti: 1 } }))),
    ['Luca Rossi|Cintura|240|1', 'Luca Rossi|Costumino|S|1', 'Luca Rossi|Judogi|140|3', 'Sara Rossi|Judogi|120|1'])
  ok('una taglia vuota toglie la riga', prova(() => testo(m.applicaScelte(righe, 'Luca Rossi', [J], { Judogi: { taglia: '', quanti: 2 } }))), ['Luca Rossi|Costumino|S|1', 'Sara Rossi|Judogi|120|1'])
  ok('quanti, se non c’è, è 1', prova(() => testo(m.applicaScelte([], 'Ugo Neri', [J], { Judogi: { taglia: '130' } }))), ['Ugo Neri|Judogi|130|1'])
  const venti = Array.from({ length: 20 }, () => riga('Sara Rossi', 'Costumino', 'S'))
  ok('oltre 20 righe: rifiutato col messaggio delle 20 righe', await errore(() => m.applicaScelte(venti, 'Luca Rossi', [J], { Judogi: { taglia: '130', quanti: 1 } })), m.MAX_RIGHE_DETTO)
  ok('e il messaggio c’è', typeof m.MAX_RIGHE_DETTO, 'string')
  ok('righePerPersona: raggruppate, nell’ordine in cui arrivano', prova(() => m.righePerPersona(righe).map((g) => [g.perChi, g.righe.map((x) => x.capo)])), [['Luca Rossi', ['Judogi', 'Costumino']], ['Sara Rossi', ['Judogi']]])

  const prima = { chiude: '2026-10-17', capi: [{ ...J, foto: 'a.jpg' }, { ...C, foto: 'b.jpg' }, { ...F, foto: 'x.png' }], tabelle: { judogi: 't.png', costumini: 'u.png' } }
  const dopo = { chiude: '2026-10-17', capi: [{ ...J, foto: 'a.jpg' }, { ...C, foto: 'c.jpg' }, F], tabelle: { judogi: 't.png', vestiario: 'x.png' } }
  ok('fotoDaTogliere: i file che nessun capo e nessuna tabella usano più', prova(() => [...m.fotoDaTogliere(prima, dopo)].sort()), ['b.jpg', 'u.png'])
  ok('niente cambiato: niente da togliere', prova(() => m.fotoDaTogliere(prima, prima)), [])
}
{
  const { v } = nuova('2026-10-10')
  const cat = { chiude: '2026-10-17', capi: [{ ...judogi, tipo: 'judogi', foto: 'judogi-1.jpg' }, { ...costumino, tipo: 'costumini' }], tabelle: { judogi: 'tabella-judogi.png' } }
  await aspetta(() => v.salvaCatalogo(cat))
  const letto = await aspetta(() => v.catalogo())
  ok('in prova si tengono tipo, foto e tabelle', prova(() => [letto.capi.map((c) => [c.capo, c.tipo ?? null, c.foto ?? null]), letto.tabelle]),
    [[['Judogi', 'judogi', 'judogi-1.jpg'], ['Costumino', 'costumini', null]], { judogi: 'tabella-judogi.png' }])
  await aspetta(() => v.salvaCatalogo({ chiude: cat.chiude, capi: cat.capi }))
  ok('salvato senza tabelle: restano com’erano', (await aspetta(() => v.catalogo()))?.tabelle, { judogi: 'tabella-judogi.png' })
  ok('e rifiuta un tipo sbagliato', await errore(() => v.salvaCatalogo({ ...cat, capi: [{ ...judogi, tipo: 'felpe' }] })), '"Judogi": il tipo non si capisce')
  memoria.clear()
  const d = await aspetta(() => m.datiVestiario())
  const esempi = await aspetta(() => d.catalogo())
  ok('ci sono gli esempi', prova(() => esempi.capi.length > 0), true)
  ok('gli esempi di prova hanno tutti un tipo dei tre', prova(() => esempi.capi.length > 0 && esempi.capi.every((c) => ['judogi', 'costumini', 'vestiario'].includes(c.tipo))), true)
}

console.log('\n24. dal custode-dati: foto, spazio pieno, database senza il 50')
{
  const FOTO = 'La foto di "Judogi" non si capisce: ricaricala'
  const no = (foto) => prova(() => m.cosaNonVaCatalogo({ chiude: '2026-10-17', capi: [{ ...judogi, foto }] }))
  ok('un nome di foto di 120 caratteri va', no('a'.repeat(116) + '.jpg'), null)
  ok('di 121 no, come nel database', no('a'.repeat(117) + '.jpg'), FOTO)
  ok('le maiuscole vanno', no('JUDOGI-1.JPG'), null)
  ok('spazi, accenti, ? e #, il punto davanti: no', ['foto judogi.jpg', 'fötö.jpg', 'a?b#c.jpg', '.x.jpg'].map(no), [FOTO, FOTO, FOTO, FOTO])
}
{
  // Lo spazio della prova pieno: salvare non deve dire «fatto».
  const PIENO = 'Lo spazio della prova su questo dispositivo è pieno: premi Riparti dall\'orario vero'
  const { v } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI }))
  const scrivi = localStorage.setItem
  localStorage.setItem = () => { throw new Error('QuotaExceededError') }
  const cat = await errore(() => v.salvaCatalogo({ chiude: '2026-10-24', capi: CAPI }))
  const ord = await errore(() => v.inviaOrdine(ordine([riga('Luca Rossi', 'Judogi', '130')])))
  localStorage.setItem = scrivi
  ok('spazio pieno: salvaCatalogo lo dice', cat, PIENO)
  ok('spazio pieno: inviaOrdine lo dice', ord, PIENO)
}
{
  const finto = ({ rpc = {}, upload = { error: null } } = {}) => {
    const reg = []
    const db = {
      from: () => ({ select() { return this }, order() { return this }, eq() { return this }, update() { return this }, then: (b) => Promise.resolve({ data: [], error: null }).then(b) }),
      rpc: async (nome, args) => (reg.push(['rpc', nome, args]), rpc[nome] ?? { data: null, error: null }),
      storage: { from: () => ({ upload: async (nome) => (reg.push(['upload', nome]), upload), remove: async () => ({ error: null }) }) },
    }
    return { v: m.creaVestiarioSupabase(db), reg }
  }
  ok('urlFoto di nessun nome: niente', prova(() => finto().v.urlFoto('')), '')

  // Il browser che rimpicciolisce la foto, finto: qui interessa cosa dice il contenitore.
  const prima = { c: globalThis.createImageBitmap, d: globalThis.document }
  globalThis.createImageBitmap = async () => ({ width: 10, height: 10, close() {} })
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: (fatto) => fatto(new Blob(['x'], { type: 'image/jpeg' })) }) }
  const foto = new Blob(['x'], { type: 'image/jpeg' })
  const zitto = console.error
  console.error = () => {}
  const rls = await errore(() => finto({ upload: { error: { message: 'new row violates row-level security policy', statusCode: '403' } } }).v.caricaFoto(foto))
  const vietato = await errore(() => finto({ upload: { error: { message: 'Unauthorized', statusCode: '403' } } }).v.caricaFoto(foto))
  console.error = zitto
  globalThis.createImageBitmap = prima.c
  globalThis.document = prima.d
  ok('caricaFoto respinta dalle regole: serve un accesso da segreteria', rls, 'Non hai il permesso: serve un accesso da segreteria')
  ok('e così col 403', vietato, 'Non hai il permesso: serve un accesso da segreteria')

  // Senza aver mai letto il catalogo, su un database senza il 50: tipi e foto non si buttano via.
  const { v, reg } = finto({ rpc: { vestiario: { data: { chiude: null, capi: [], aperti: false }, error: null }, salva_vestiario: { data: 'rc-1', error: null } } })
  ok('salvaCatalogo con tipi e foto, senza il 50: lo dice', await errore(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: [{ ...judogi, tipo: 'judogi', foto: 'judogi-1.jpg' }] })), m.MANCA_FOTO)
  ok('e non salva', reg.some((c) => c[1] === 'salva_vestiario'), false)
}

console.log('\n25. i passi del modulo, le foto al salvataggio, riduciFoto')
// Gli oggetti si confrontano con le chiavi in ordine: conta cosa c'è, non in che ordine è scritto.
const ordinato = (x) => (Array.isArray(x) ? x.map(ordinato) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, ordinato(x[k])])) : x)
const okO = (cosa, avuto, voluto) => ok(cosa, ordinato(avuto), ordinato(voluto))
{
  const J = { ...judogi, tipo: 'judogi' }
  const C = { ...costumino, tipo: 'costumini' }
  const senzaTipo = { capo: 'Felpa', taglie: ['S'], prezzo: 28 }
  okO('dopo PER CHI È, coi tipi: si sceglie il tipo', prova(() => m.passoDopoPerChi([J, C], 'Luca Rossi')), { a: 'tipo', perChi: 'Luca Rossi' })
  okO('con un tipo solo: dritti alla sua pagina', prova(() => m.passoDopoPerChi([J], 'Luca Rossi')), { a: 'pagina', tipo: 'judogi', perChi: 'Luca Rossi' })
  okO('con un capo senza tipo: la pagina sola', prova(() => m.passoDopoPerChi([J, senzaTipo], 'Luca Rossi')), { a: 'pagina', tipo: 'pagina sola', perChi: 'Luca Rossi' })

  const storia = [
    { a: 'perChi' }, { a: 'tipo', perChi: 'Luca Rossi' }, { a: 'pagina', tipo: 'judogi', perChi: 'Luca Rossi' }, { a: 'altro', perChi: 'Luca Rossi' },
    { a: 'perChi' }, { a: 'tipo', perChi: 'Anna Verdi' }, { a: 'pagina', tipo: 'costumini', perChi: 'Anna Verdi' },
  ]
  const righe = [riga('Luca Rossi', 'Judogi', '130', 2), riga('Anna Verdi', 'Costumino', 'S'), riga('Luca Rossi', 'Felpa vecchia', 'M')]
  const salvato = JSON.stringify({ storia, righe, id: 'dev-1' })
  const ripresa = prova(() => m.ripresaDa(salvato, [J, C]))
  okO('ripresaDa: storia e id restano, le righe di capi che non ci sono più se ne vanno', prova(() => [ripresa.storia, ripresa.righe.map((x) => x.capo), ripresa.id]), [storia, ['Judogi', 'Costumino'], 'dev-1'])
  const indietro = prova(() => ripresa.storia[2])
  ok('tornando alla pagina dei judogi, la persona è Luca', prova(() => indietro.perChi), 'Luca Rossi')
  okO('e le scelte sono quelle di Luca', prova(() => m.sceltePagina(ripresa.righe, indietro.perChi, m.capiDelTipo([J, C], indietro.tipo))), { Judogi: { taglia: '130', quanti: 2 } })
  okO('una pagina di un tipo senza capi: la storia riparte', prova(() => m.ripresaDa(salvato, [J]).storia), [{ a: 'perChi' }])
  okO('un passo del tipo, ora che è pagina sola: riparte', prova(() => m.ripresaDa(JSON.stringify({ storia: storia.slice(0, 3), righe: [], id: 'x' }), [J, senzaTipo]).storia), [{ a: 'perChi' }])
  okO('la pagina sola, ora che ci sono i tipi: riparte', prova(() => m.ripresaDa(JSON.stringify({ storia: [{ a: 'perChi' }, { a: 'pagina', tipo: 'pagina sola', perChi: 'Luca Rossi' }], righe: [], id: 'x' }), [J, C]).storia), [{ a: 'perChi' }])
  ok('e le righe restano', prova(() => m.ripresaDa(salvato, [J]).righe.map((x) => x.capo)), ['Judogi'])
  ok('JSON rotto: niente', prova(() => m.ripresaDa('{rotto', [J, C])), null)
  ok('niente salvato: niente', prova(() => m.ripresaDa(null, [J, C])), null)

  ok('rinomina: le righe di Luca prendono il nome nuovo, le altre no', prova(() => m.rinomina(righe, 'Luca Rossi', 'Luca Bianchi').map((x) => x.perChi)), ['Luca Bianchi', 'Anna Verdi', 'Luca Bianchi'])

  const diciannove = Array.from({ length: 19 }, () => riga('Sara Rossi', 'Costumino', 'S'))
  ok('applicaScelte: 19 righe più una scelta fanno 20, vanno', prova(() => m.applicaScelte(diciannove, 'Luca Rossi', [J], { Judogi: { taglia: '130' } }).length), 20)
}
{
  // Dalla bozza: tipo, foto e tabelle restano, anche le tabelle vuote.
  const bozza = { chiude: '2026-10-17', capi: [{ capo: 'Judogi', taglie: '120, 130', prezzo: '35', nota: '', tipo: 'judogi', foto: 'judogi-1.jpg' }, { capo: 'Costumino', taglie: 'S', prezzo: '30', nota: '', tipo: 'costumini' }] }
  const c = prova(() => m.catalogoDaBozza({ ...bozza, tabelle: { judogi: 't.png' } }).catalogo)
  okO('catalogoDaBozza tiene tipo, foto e tabelle', prova(() => [c.capi.map((x) => [x.tipo ?? null, x.foto ?? null]), c.tabelle]), [[['judogi', 'judogi-1.jpg'], ['costumini', null]], { judogi: 't.png' }])
  ok('tabelle vuote nella bozza: tabelle vuote nel catalogo', prova(() => m.catalogoDaBozza({ ...bozza, tabelle: {} }).catalogo.tabelle), {})
  ok('niente tabelle nella bozza: niente tabelle', prova(() => 'tabelle' in m.catalogoDaBozza(bozza).catalogo), false)
  const { v } = nuova('2026-10-10')
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI, tabelle: { judogi: 't.png' } }))
  await aspetta(() => v.salvaCatalogo({ chiude: '2026-10-17', capi: CAPI, tabelle: {} }))
  ok('in prova, tabelle vuote le tolgono', Object.keys((await aspetta(() => v.catalogo()))?.tabelle ?? {}).length, 0)

  okO('tabelleDellaPagina: per un tipo la sua', prova(() => m.tabelleDellaPagina({ vestiario: 'v.png', judogi: 't.png' }, 'judogi')), [{ tipo: 'judogi', nome: 't.png' }])
  okO('un tipo senza tabella: nessuna', prova(() => m.tabelleDellaPagina({ judogi: 't.png' }, 'costumini')), [])
  okO('la pagina sola: tutte, nell’ordine dei tipi', prova(() => m.tabelleDellaPagina({ vestiario: 'v.png', judogi: 't.png' }, 'pagina sola')), [{ tipo: 'judogi', nome: 't.png' }, { tipo: 'vestiario', nome: 'v.png' }])
  okO('nessuna tabella', prova(() => m.tabelleDellaPagina(undefined, 'pagina sola')), [])

  const prima = { chiude: '2026-10-17', capi: [{ capo: 'Judogi bianco', taglie: ['130'], prezzo: 35, tipo: 'judogi', foto: 'a.jpg' }], tabelle: { judogi: 't.png' } }
  const conFoto = (foto, tabelle) => ({ ...prima, capi: [{ ...prima.capi[0], foto }], tabelle })
  ok('cosaSiCancella: niente', prova(() => m.cosaSiCancella(prima, prima)), '')
  ok('una foto', prova(() => m.cosaSiCancella(prima, conFoto('b.jpg', { judogi: 't.png' }))), 'Con SALVA si cancella la foto di prima di Judogi bianco.')
  ok('una foto e una tabella', prova(() => m.cosaSiCancella(prima, conFoto('b.jpg', {}))), 'Con SALVA si cancellano la foto di prima di Judogi bianco e la tabella delle taglie di JUDOGI.')
  ok('nomeTipo', prova(() => ['judogi', 'costumini', 'vestiario'].map(m.nomeTipo)), ['JUDOGI', 'COSTUMINI LOTTA', 'VESTIARIO LOGATO'])
  ok('un nome di foto con un’altra estensione dopo, o una barra dopo: no', ['a.jpg.html', 'a.jpg/x'].map((foto) => prova(() => m.cosaNonVaCatalogo({ chiude: '2026-10-17', capi: [{ ...judogi, foto }] }))),
    ['La foto di "Judogi" non si capisce: ricaricala', 'La foto di "Judogi" non si capisce: ricaricala'])
}
{
  // salvaConFoto con un DatiVestiario finto che registra le chiamate.
  const A = new Blob(['a']), B = new Blob(['b']), Cn = new Blob(['c'])
  const nomeDi = (b) => (b === A ? 'vero-a.jpg' : b === B ? 'vero-b.jpg' : 'vero-c.jpg')
  const finto = ({ salva = true, cadeAlla = 0 } = {}) => {
    const reg = []
    let n = 0
    const d = {
      caricaFoto: async (b) => { n++; if (n === cadeAlla) throw new Error('rete'); reg.push(['carica', nomeDi(b)]); return nomeDi(b) },
      salvaCatalogo: async (c) => { reg.push(['salva', c]); if (!salva) throw new Error('non salvato') },
      togliFoto: async (nomi) => { reg.push(['togli', [...nomi].sort()]) },
    }
    return { d, reg }
  }
  const salvato = { chiude: '2026-10-17', capi: [{ ...judogi, tipo: 'judogi', foto: 'vecchia-j.jpg' }, { ...costumino, tipo: 'costumini', foto: 'vecchia-c.jpg' }] }
  const catalogo = { chiude: '2026-10-17', capi: [{ ...judogi, tipo: 'judogi', foto: 'nuova-1.jpg' }, { ...costumino, tipo: 'costumini', foto: 'vecchia-c.jpg' }], tabelle: { judogi: 'nuova-2.jpg' } }
  const nuove = { 'nuova-1.jpg': A, 'nuova-2.jpg': B, 'nuova-3.jpg': Cn }

  const bene = finto()
  await aspetta(() => m.salvaConFoto(bene.d, catalogo, nuove, salvato))
  ok('carica solo le foto nuove usate', bene.reg.filter((c) => c[0] === 'carica').map((c) => c[1]).sort(), ['vero-a.jpg', 'vero-b.jpg'])
  const salvatoOra = bene.reg.find((c) => c[0] === 'salva')?.[1]
  okO('e salva coi nomi veri', prova(() => [salvatoOra.capi.map((x) => x.foto), salvatoOra.tabelle]), [['vero-a.jpg', 'vecchia-c.jpg'], { judogi: 'vero-b.jpg' }])
  ok('poi toglie la foto di prima che non serve più', bene.reg.filter((c) => c[0] === 'togli').map((c) => c[1]), [['vecchia-j.jpg']])
  ok('nell’ordine: carica, salva, togli', bene.reg.map((c) => c[0]), ['carica', 'carica', 'salva', 'togli'])

  const male = finto({ salva: false })
  ok('il salvataggio fallisce: lo dice', await errore(() => m.salvaConFoto(male.d, catalogo, nuove, salvato)), 'non salvato')
  ok('e toglie i file appena caricati, mai i vecchi', male.reg.filter((c) => c[0] === 'togli').map((c) => c[1]), [['vero-a.jpg', 'vero-b.jpg']])

  const cade = finto({ cadeAlla: 2 })
  ok('caricaFoto cade alla seconda: lo dice', await errore(() => m.salvaConFoto(cade.d, catalogo, nuove, salvato)), 'rete')
  const prima = cade.reg.find((c) => c[0] === 'carica')?.[1]
  ok('toglie la prima, e non salva', [cade.reg.filter((c) => c[0] === 'togli').map((c) => c[1]), cade.reg.some((c) => c[0] === 'salva')], [[[prima]], false])
}
{
  // creaVestiarioSupabase: catalogo con tipi, foto e tabelle; togliFoto che non riesce non fa danni.
  const finto = ({ rpc = {}, remove } = {}) => {
    const db = {
      from: () => ({ select() { return this }, order() { return this }, eq() { return this }, then: (b) => Promise.resolve({ data: [], error: null }).then(b) }),
      rpc: async (nome) => rpc[nome] ?? { data: null, error: null },
      storage: { from: () => ({ remove }) },
    }
    return m.creaVestiarioSupabase(db)
  }
  const v = finto({ rpc: { vestiario: { data: { chiude: '2026-10-17', aperti: true, capi: [{ capo: 'Judogi', taglie: ['130'], prezzo: '35.00', tipo: 'judogi', foto: 'judogi-1.jpg' }, { capo: 'Felpa', taglie: ['S'], prezzo: 28, tipo: null, foto: null }], tabelle: { judogi: 't.png' } }, error: null } } })
  const c = await aspetta(() => v.catalogo())
  okO('catalogo() dal database: tipo, foto e tabelle', prova(() => [c.capi.map((x) => [x.capo, x.tipo ?? null, x.foto ?? null]), c.tabelle]), [[['Judogi', 'judogi', 'judogi-1.jpg'], ['Felpa', null, null]], { judogi: 't.png' }])
  const zitto = console.error
  console.error = () => {}
  const lancia = await errore(() => finto({ remove: async () => { throw new Error('rete') } }).togliFoto(['a.jpg']))
  const sbaglia = await errore(() => finto({ remove: async () => ({ data: null, error: { message: 'no' } }) }).togliFoto(['a.jpg']))
  console.error = zitto
  ok('togliFoto con remove che lancia, o che dà errore: si risolve lo stesso', [lancia, sbaglia], ['nessun errore', 'nessun errore'])
}
{
  // riduciFoto, col browser finto: i blob che dà la tela si scelgono qui.
  const conBrowser = async (blobs, f, { apre = true } = {}) => {
    const prima = { c: globalThis.createImageBitmap, d: globalThis.document }
    const coda = [...blobs]
    globalThis.createImageBitmap = async () => { if (!apre) throw new Error('non si apre'); return { width: 4000, height: 3000, close() {} } }
    globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: (fatto) => fatto(coda.length ? coda.shift() : null) }) }
    try { return await f() } catch (e) { return `ERRORE: ${e.message}` } finally { globalThis.createImageBitmap = prima.c; globalThis.document = prima.d }
  }
  const peso = (n) => new Blob(['x'.repeat(n)], { type: 'image/jpeg' })
  const file = (n, type = 'image/jpeg', nome = 'foto.heic') => new File(['x'.repeat(n)], nome, { type })
  const di = (r) => (typeof r === 'string' ? r : [r.name, r.type, r.size])

  const piccola = file(10)
  ok('piccola: resta com’è', await conBrowser([peso(5)], async () => (await m.riduciFoto(piccola, { basta: 50 })) === piccola), true)
  const pdf = file(100, 'application/pdf', 'modulo.pdf')
  ok('non un’immagine: resta com’è', await conBrowser([peso(5)], async () => (await m.riduciFoto(pdf, { basta: 50 })) === pdf), true)
  ok('grande: diventa un .jpg più leggero', di(await conBrowser([peso(20)], () => m.riduciFoto(file(100), { basta: 50 }))), ['foto.jpg', 'image/jpeg', 20])
  const grande = file(100)
  ok('se rimpicciolita pesa di più: resta l’originale', await conBrowser([peso(200)], async () => (await m.riduciFoto(grande, { basta: 50 })) === grande), true)
  ok('se non si apre: resta l’originale', await conBrowser([], async () => (await m.riduciFoto(grande, { basta: 50 })) === grande, { apre: false }), true)

  ok('sempreJpeg: il primo troppo grande, il secondo va → un .jpg', di(await conBrowser([peso(100), peso(30)], () => m.riduciFoto(file(10), { basta: 50, sempreJpeg: true }))), ['foto.jpg', 'image/jpeg', 30])
  ok('sempreJpeg: tutti troppo grandi → TROPPO_GRANDE', await conBrowser([peso(100), peso(90), peso(80)], () => m.riduciFoto(file(10), { basta: 50, sempreJpeg: true })), `ERRORE: ${m.TROPPO_GRANDE}`)
  ok('sempreJpeg: non si apre → NON_SI_APRE', await conBrowser([], () => m.riduciFoto(file(10), { basta: 50, sempreJpeg: true }), { apre: false }), `ERRORE: ${m.NON_SI_APRE}`)
  ok('sempreJpeg: la tela non dà niente → NON_SI_APRE, non TROPPO_GRANDE', await conBrowser([], () => m.riduciFoto(file(10), { basta: 50, sempreJpeg: true })), `ERRORE: ${m.NON_SI_APRE}`)
}

console.log('\n26. dal collaudo: la stessa persona scritta in due modi, chi ordina che resta')
{
  const J = { ...judogi, tipo: 'judogi' }
  const C = { ...costumino, tipo: 'costumini' }
  ok('stessaPersona: maiuscole e spazi non contano', prova(() => [m.stessaPersona('luca  rossini', 'Luca Rossini'), m.stessaPersona(' Luca Rossini ', 'luca rossini'), m.stessaPersona('Luca Rossini', 'Luca Rossi')]), [true, true, false])

  const righe = [riga('Luca Rossini', 'Judogi', '130'), riga('luca  rossini', 'Costumino', 'S'), riga('Anna Verdi', 'Costumino', 'M')]
  ok('nomeGiaUsato: rinominare «luca  rossini» in «Luca Rossini» no, c’è già', prova(() => m.nomeGiaUsato([riga('Luca Rossini', 'Judogi', '130'), riga('Sara Neri', 'Costumino', 'S')], 'luca rossini', 'Sara Neri')),
    '"Luca Rossini" è già in quest\'ordine: torna ai suoi passi con INDIETRO')
  ok('il caso del collaudo: due modi di scrivere Luca, la seconda rinominata come la prima', prova(() => m.nomeGiaUsato([riga('Luca Rossini', 'Judogi', '130'), riga('Mario Bianchi', 'Costumino', 'S')], 'Luca Rossini', 'Mario Bianchi')),
    '"Luca Rossini" è già in quest\'ordine: torna ai suoi passi con INDIETRO')
  ok('la persona stessa, scritta in un altro modo: va', prova(() => m.nomeGiaUsato(righe, 'LUCA ROSSINI', 'Luca Rossini')), null)
  ok('un nome nuovo: va', prova(() => m.nomeGiaUsato(righe, 'Ugo Neri')), null)
  ok('senza «tranne», un nome che c’è già: no', prova(() => m.nomeGiaUsato(righe, 'anna verdi')), '"Anna Verdi" è già in quest\'ordine: torna ai suoi passi con INDIETRO')

  ok('sceltePagina: «luca  rossini» è Luca Rossini', prova(() => Object.keys(m.sceltePagina(righe, 'Luca Rossini', [J, C])).sort()), ['Costumino', 'Judogi'])
  ok('applicaScelte: toglie anche le righe scritte con le minuscole', prova(() => m.applicaScelte(righe, 'Luca Rossini', [J, C], { Judogi: { taglia: '140' } }).map((x) => `${x.perChi}|${x.capo}|${x.taglia}`).sort()),
    ['Anna Verdi|Costumino|M', 'Luca Rossini|Judogi|140'])
  ok('righePerPersona: una persona sola', prova(() => m.righePerPersona(righe).map((g) => [g.righe.length])), [[2], [1]])

  const chi = { nome: 'Paola', cognome: 'Rossi', telefono: '333 123 4567', email: 'paola@esempio.it' }
  const testo = (x) => JSON.stringify({ storia: [{ a: 'perChi' }], righe: [], id: 'dev-1', ...x })
  ok('ripresaDa tiene chi ordina', prova(() => m.ripresaDa(testo({ chi }), [J, C]).chi), chi)
  ok('con una forma sbagliata la ignora', prova(() => [m.ripresaDa(testo({ chi: 'Paola' }), [J, C]).chi ?? null, m.ripresaDa(testo({ chi: { nome: 3 } }), [J, C]).chi ?? null]), [null, null])
  ok('senza, niente', prova(() => m.ripresaDa(testo({}), [J, C]).chi ?? null), null)
}

console.log('\n27. dalla prova del cliente')
{
  const vuoto = { capo: '', taglie: '', prezzo: '', nota: '' }
  ok('un capo nuovo ancora vuoto: prima il nome', prova(() => m.catalogoDaBozza({ chiude: '2026-10-17', capi: [vuoto] })), { guaio: 'Ogni capo ha un nome' })
  ok('anche dopo un capo giusto', prova(() => m.catalogoDaBozza({ chiude: '2026-10-17', capi: [{ capo: 'Judogi', taglie: '130', prezzo: '35', nota: '' }, vuoto] })), { guaio: 'Ogni capo ha un nome' })

  const senza = [{ ...judogi, tipo: 'judogi' }, { ...costumino }, { capo: 'Felpa', taglie: ['S'], prezzo: 28 }, { capo: 'Cintura', taglie: ['240'], prezzo: 6, tipo: 'judogi' }]
  ok('capiSenzaTipo: i nomi, nell’ordine del catalogo', prova(() => m.capiSenzaTipo(senza)), ['Costumino', 'Felpa'])
  ok('tutti col tipo: nessuno', prova(() => m.capiSenzaTipo([{ ...judogi, tipo: 'judogi' }])), [])

  ok('ordineAMeta: senza righe niente', prova(() => m.ordineAMeta([])), null)
  ok('un capo per una persona', prova(() => m.ordineAMeta([riga('Luca Rossi', 'Judogi', '130')])), 'Hai già scelto 1 capo per Luca Rossi')
  ok('i capi sono la somma di quanti, le persone come nel riepilogo', prova(() => m.ordineAMeta([riga('Luca Rossi', 'Judogi', '130', 2), riga('Sara Rossi', 'Costumino', 'S')])), 'Hai già scelto 3 capi per Luca Rossi e Sara Rossi')
  ok('tre persone: virgola e «e»', prova(() => m.ordineAMeta([riga('Luca Rossi', 'Judogi', '130'), riga('Sara Rossi', 'Costumino', 'S'), riga('Ugo Neri', 'Costumino', 'M'), riga('luca  rossi', 'Costumino', 'S')])), 'Hai già scelto 4 capi per Luca Rossi, Sara Rossi e Ugo Neri')
}

if (guai) {
  console.log(`\n${guai} cose non tornano`)
  process.exit(1)
}
console.log('\nTutto a posto')
