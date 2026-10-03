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

console.log('Le voci in due gruppi')
// Finché la funzione non c'è, ogni caso dice ✗ invece di fermare tutto.
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `errore: ${e.message}`
  }
}
const chiavi = (vv) => (Array.isArray(vv) ? vv.map((v) => v.chiave) : vv)
const gruppi = (...a) => {
  const x = prova(() => m.vociInDueGruppi(...a))
  return typeof x === 'string' ? { primi: x, altri: x } : { primi: chiavi(x.primi), altri: chiavi(x.altri) }
}
const senzaFissi = (vv) => (Array.isArray(vv) ? vv.filter((k) => k !== 'quota' && k !== 'mano') : vv)
const delCorso = (k, ...corsi) => corsi.some((c) => k.startsWith(`${c}~`))
const tutteDel = (corsi, giorno, listino) => corsi.flatMap((c) => m.vociDelCorso(c, giorno, listino)).map((v) => v.chiave)
const listinoChiavi = (giorno, listino = m.LISTINO_PREDEFINITO) => ['quota', ...tutteDel(listino.corsi.map((c) => c.corso), giorno, listino)]
const { primi, altri } = gruppi(['Judo 3', 'Lotta 3'], '2026-09-10')
const sonoListe = Array.isArray(primi) && Array.isArray(altri)
ok('Judo 3 e Lotta 3: la quota per prima', sonoListe && primi[0], 'quota')
ok('Judo 3 e Lotta 3: fra i primi anche la voce scritta a mano', sonoListe && primi.includes('mano'), true)
ok('Judo 3 e Lotta 3: fra i primi tutte le loro righe di prezzo, e nient’altro', senzaFissi(primi), tutteDel(['Judo 3', 'Lotta 3'], '2026-09-10'))
ok('Judo 3 e Lotta 3: fra i primi anche il trimestre, non solo l’annuale', sonoListe && primi.includes('Lotta 3~0~trimestre') && primi.includes('Judo 3~0~trimestre'), true)
ok('Judo 3 e Lotta 3: negli altri nessuna loro voce', sonoListe && altri.filter((k) => delCorso(k, 'Judo 3', 'Lotta 3')), [])
ok('negli altri il resto del listino, nel suo ordine', altri, listinoChiavi('2026-09-10').filter((k) => k !== 'quota' && !delCorso(k, 'Judo 3', 'Lotta 3')))
ok('primi e altri insieme: il listino e la quota, più la voce a mano', sonoListe && [...primi, ...altri].filter((k) => k !== 'mano').sort(), listinoChiavi('2026-09-10').sort())
ok('nessuna voce due volte', sonoListe && new Set([...primi, ...altri]).size === primi.length + altri.length, true)
ok('un corso a righe (1 giorno, 2 giorni…): fra i primi tutte le righe', senzaFissi(gruppi(['Pesistica e Mobility'], '2026-09-10').primi), tutteDel(['Pesistica e Mobility'], '2026-09-10'))
const minuscolo = { ...nuovo, corsi: [{ ...nuovo.corsi[0], corso: 'lotta  3' }] }
ok('il corso «Lotta 3» trova la voce «lotta  3» del listino', senzaFissi(gruppi(['Lotta 3'], '2026-09-10', minuscolo).primi), tutteDel(['lotta  3'], '2026-09-10', minuscolo))
ok('un corso che non è nel listino: fra i primi solo quota e voce a mano', gruppi(['Judo 3'], '2026-09-10', nuovo).primi, ['quota', 'mano'])
ok('chi non fa corsi: fra i primi solo quota e voce a mano', gruppi([], '2026-09-10').primi, ['quota', 'mano'])
const fineAgosto = gruppi(['Lotta 3'], '2026-08-31')
const settembre = gruppi(['Lotta 3'], '2026-09-01')
ok('il 31 agosto il saldo di Lotta 3 c’è, fra i primi', Array.isArray(fineAgosto.primi) && fineAgosto.primi.includes('Lotta 3~0~saldo'), true)
ok('il 1° settembre il saldo di Lotta 3 non c’è più, da nessuna parte', Array.isArray(settembre.primi) && Array.isArray(settembre.altri) ? [...settembre.primi, ...settembre.altri].includes('Lotta 3~0~saldo') : settembre.primi, false)

console.log('I dati del socio')
const adulto = { nome: 'Nicola', cognome: 'Albertini', natoIl: '1980-03-02', codiceFiscale: 'LBRNCL80C02L219X', indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno' }
const minore = { ...quella.intestatario, genitoreCodiceFiscale: 'LBRNCL80C02L219X' }
ok('un adulto senza codice fiscale: la ricevuta non si fa', prova(() => m.mancanoDatiSocio({ ...adulto, codiceFiscale: '' })), { blocca: ['il codice fiscale'], avvisa: [] })
ok('un adulto senza indirizzo: si fa, ma lo dice', prova(() => m.mancanoDatiSocio({ ...adulto, indirizzo: '  ' })), { blocca: [], avvisa: ['l’indirizzo'] })
ok('un minore senza il codice fiscale del genitore: la ricevuta non si fa', prova(() => m.mancanoDatiSocio({ ...minore, genitoreCodiceFiscale: undefined })), { blocca: ['il codice fiscale del genitore'], avvisa: [] })
ok('un minore senza il genitore: servono nome e codice fiscale', prova(() => m.mancanoDatiSocio({ ...minore, genitore: undefined, genitoreCodiceFiscale: undefined }).blocca), ['il genitore', 'il codice fiscale del genitore'])
ok('un adulto con tutto: completo', prova(() => m.mancanoDatiSocio(adulto)), { blocca: [], avvisa: [] })
ok('un minore con tutto: completo', prova(() => m.mancanoDatiSocio(minore)), { blocca: [], avvisa: [] })

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
