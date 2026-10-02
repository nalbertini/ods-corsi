// ---------------------------------------------------------------------------
// La ricevuta di un pagamento, senza browser.
//
//   node scripts/prova-ricevuta.mjs [cartella]
//
// Controlla i conti e i rifiuti di `src/lib/ricevute.ts` e fa i PDF di tre
// ricevute: quella del programma di prima (quota e annuale), una con tante
// voci che va a una seconda pagina, e una annullata. Con una cartella ci
// lascia i PDF, da aprire per guardare che tutto stia nei riquadri.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/ricevute'; export { listinoDa, cosaNonVaListino, LISTINO_PREDEFINITO } from './src/lib/listino'; export { ricevutaPdf, pagineDelleVoci } from './src/lib/ricevutaPdf'; export { PDFDocument } from 'pdf-lib'",
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
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
const cartella = process.argv[2]

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

console.log('I conti')
ok('418,5 €', m.centesimi('418,5'), 41850)
ok('1.234,00 €', m.centesimi('1.234,00 €'), 123400)
ok('«dieci» non è un importo', m.centesimi('dieci'), null)
ok('i centesimi scritti', m.euro(41800), '418,00')
ok('la data come sulla ricevuta', m.dataRicevuta('2026-09-01'), '01/09/2026')
ok('Collegno è in provincia di Torino', m.provinciaDalCap('10093'), 'TO')
ok('Milano no', m.provinciaDalCap('20121'), '')
ok('il trimestre da ottobre', m.fineTrimestre('2026-10-01'), '2026-12-31')
ok('il trimestre non va oltre la stagione', m.fineTrimestre('2027-05-10'), '2027-06-30')

const pagato = (importo) => [{ data: '2026-09-01', importo, metodo: 'Bonifico' }]
const quella = {
  id: 'r1',
  anno: 2026,
  numero: 116,
  data: '2026-09-01',
  ente: m.ENTE_PREDEFINITO,
  intestatario: {
    nome: 'Manuela', cognome: 'Albertini', indirizzo: "Via San Francesco d'Assisi 16", cap: '10093', comune: 'Collegno', provincia: 'TO',
    natoIl: '2014-06-13', codiceFiscale: 'LBRMNL14H53L219X', genitore: 'Albertini Nicola',
  },
  voci: [
    { ...m.voceQuota().voce('2026-09-01'), pagamenti: pagato(5000) },
    { descrizione: 'Annuale Lotta 3', quantita: 1, prezzo: 36800, dal: '2026-09-01', al: '2027-06-30', pagamenti: pagato(36800) },
  ],
  anticipo: 0,
  totale: 41800,
  pagato: 41800,
  creataIl: '2026-09-01T10:00:00Z',
}
const c = m.conti(quella)
ok('totale, pagato e netto', [c.totale, c.pagato, c.netto], [41800, 41800, 0])
ok('va bene', m.cosaNonVa(quella), null)
ok('senza voci no', m.cosaNonVa({ ...quella, voci: [] }), 'Serve almeno una voce')
ok('pagato più del totale no', m.cosaNonVa({ ...quella, anticipo: 100 }), 'Si è pagato più del totale: controlla gli importi')
ok('senza il nome del socio no', m.cosaNonVa({ ...quella, intestatario: { nome: '', cognome: 'Albertini' } }), 'Servono nome e cognome del socio')
ok('la voce di Lotta 3 dal foglio dei costi', m.vociDelCorso('lotta 3', '2026-08-31').map((v) => v.voce('2026-09-01').prezzo), [48000, 46000, 18000])
ok('dopo il 31 agosto niente saldo', m.vociDelCorso('lotta 3', '2026-09-01').map((v) => v.voce('2026-09-01').prezzo), [48000, 18000])
ok('la quota prima di tutto', m.vociPronte(['Judo 3'], '2026-09-01')[0].chiave, 'quota')

console.log('Il listino cambiato dalla segreteria')
const nuovo = {
  quota: 55,
  saldoEntro: '2026-09-15',
  corsi: [{ corso: 'Lotta 3', eta: 'nati 2016 e prima', orari: [], prezzi: [{ saldo: 470.5, annuale: 490, trimestre: 185 }] }],
  offerte: [],
}
ok('va bene', m.cosaNonVaListino(nuovo), null)
ok('la quota del listino', m.voceQuota(nuovo).voce('2026-09-01').prezzo, 5500)
ok('i prezzi del listino, anche coi centesimi', m.vociDelCorso('Lotta 3', '2026-09-10', nuovo).map((v) => v.voce('2026-09-10').prezzo), [49000, 47050, 18500])
ok('il saldo fino alla data del listino', m.vociDelCorso('Lotta 3', '2026-09-16', nuovo).map((v) => v.voce('2026-09-16').prezzo), [49000, 18500])
ok('un corso che non è nel listino non ha voci', m.vociDelCorso('Judo 3', '2026-09-10', nuovo), [])
ok('due corsi con lo stesso nome no', m.cosaNonVaListino({ ...nuovo, corsi: [...nuovo.corsi, { ...nuovo.corsi[0], corso: 'lotta  3' }] }), '«lotta  3» c’è due volte: le ricevute non saprebbero quale prendere')
ok('una riga senza prezzi no', m.cosaNonVaListino({ ...nuovo, corsi: [{ ...nuovo.corsi[0], prezzi: [{}] }] }), 'Una riga di «Lotta 3» non ha nessun prezzo')
ok('più righe senza nome no', m.cosaNonVaListino({ ...nuovo, corsi: [{ ...nuovo.corsi[0], prezzi: [{ annuale: 1 }, { annuale: 2 }] }] }).startsWith('«Lotta 3» ha più righe'), true)
ok('vuoto vuol dire il foglio', m.listinoDa(null), null)
ok('senza corsi vale il foglio', m.listinoDa({ quota: 10, corsi: [] }), null)
ok('dal database, preso con le pinze', m.listinoDa({ quota: -3, saldoEntro: 'domani', corsi: [{ corso: ' MGA ', prezzi: [{ annuale: '340' }, { trimestre: 130, x: 1 }], orari: ['venerdì', 7] }, { eta: 'senza nome' }], offerte: [{ titolo: 'SOLO TITOLO' }] }), {
  quota: 50, saldoEntro: '2026-08-31', corsi: [{ corso: 'MGA', eta: '', orari: ['venerdì'], prezzi: [{ trimestre: 130 }] }], offerte: [],
})
ok('il foglio va bene così com’è', m.cosaNonVaListino(m.LISTINO_PREDEFINITO), null)
ok('il foglio riletto è uguale', m.listinoDa(JSON.parse(JSON.stringify(m.LISTINO_PREDEFINITO))), m.LISTINO_PREDEFINITO)
ok('il nome del file', m.nomeFileRicevuta(quella), 'ricevuta-116-2026-albertini-manuela.pdf')

console.log('I PDF')
const tante = {
  ...quella,
  numero: 117,
  voci: Array.from({ length: 7 }, (_, i) => ({ descrizione: `Trimestre Judo ${i + 1} con un nome anche lungo lungo`, quantita: 1, prezzo: 18000, dal: '2026-10-01', al: '2026-12-31', pagamenti: [...pagato(9000), ...pagato(9000)] })),
  note: 'Pagato in due volte, con due bonifici: il secondo il giorno stesso.',
}
ok('sette voci da tre righe di pagamento: tre per pagina, senza perderne', [m.pagineDelleVoci(tante.voci).length, m.pagineDelleVoci(tante.voci).flat().length], [3, 7])
const scontata = {
  ...quella,
  numero: 118,
  voci: [quella.voci[0], { ...quella.voci[1], descrizione: 'Annuale Lotta 3 · sconto famiglia 20% su 368,00 €', prezzo: 29440, pagamenti: pagato(29440) }],
}
ok('con lo sconto famiglia, il totale scontato', m.conti(scontata).totale, 34440)
ok('va bene', m.cosaNonVa(scontata), null)
for (const [nome, r] of [['ricevuta-116', quella], ['ricevuta-sconto-famiglia', scontata], ['ricevuta-tante', tante], ['ricevuta-annullata', { ...quella, annullataIl: '2026-09-02T10:00:00Z' }]]) {
  const byte = await m.ricevutaPdf(r)
  const doc = await m.PDFDocument.load(byte)
  const pagine = doc.getPageCount()
  ok(`${nome}: A4 in orizzontale`, doc.getPage(0).getSize().width > doc.getPage(0).getSize().height, true)
  ok(`${nome}: pagine`, pagine, m.pagineDelleVoci(r.voci).length)
  if (cartella) writeFileSync(`${cartella}/${nome}.pdf`, byte)
}

if (guai) {
  console.log(`\n${guai} cose non tornano`)
  process.exit(1)
}
console.log('\nTutto a posto')
