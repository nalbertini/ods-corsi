// ---------------------------------------------------------------------------
// Il certificato portato dopo, senza browser: chi si iscrive senza certificato
// ha un termine per portarlo (`supabase/141-certificato-dopo.sql`, provato da
// `supabase/prova/certificato-dopo.sql`).
//
//   node scripts/prova-certificato-dopo.mjs
//
// Il termine (`termineCertificato`), lo stato nuovo `atteso` (giallo: nel
// termine, non vale come valido da nessuna parte, gare comprese), cosa blocca
// (niente più «NON PUÒ ENTRARE IN SALA»), i conti di DA FARE e COSA MANCA, il
// riquadro della scheda, i testi del modulo e dell'area iscritti, e la
// proroga della segreteria di prova. Le date sono quelle del database.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: `
      export * as seg from './src/lib/segreteria'
      export * as ric from './src/lib/richieste'
      export * as isc from './src/lib/iscritto'
      export * as certIsc from './src/lib/certificatoIscritto'
      export * as blocca from './src/lib/cosaBlocca'
      export * as manca from './src/lib/cosaManca'
      export * as daFare from './src/lib/daFareChi'
      export * as schede from './src/lib/schedeIscritto'
      export * as areaTab from './src/lib/areaTab'
      export * as gare from './src/lib/gare'
      export { creaSegreteriaProva } from './src/lib/segreteriaProva'
    `,
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

// Oggi, per la prova di proroga, è sabato 26 settembre 2026 a mezzogiorno.
const OGGI_PROVA = new Date(2026, 8, 26, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI_PROVA]))
  }
  static now() {
    return OGGI_PROVA
  }
}

let guai = 0
// Le chiavi in ordine: un oggetto è uguale a un altro anche scritto in un altro ordine.
const ordinato = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x))
const ok = (cosa, avuto, voluto) => {
  const va = ordinato(avuto) === ordinato(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const errore = async (g) => {
  try {
    await g()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}
/** Una funzione che non c'è ancora la prova la dice, invece di fermarsi: la si cerca in tutti i moduli. */
const f = (nome, ...a) => {
  const dove = (nome === 'avvisi' ? m.isc : nome === 'rigaCertificato' ? m.certIsc : undefined) ?? Object.values(m).find((x) => x && typeof x === 'object' && typeof x[nome] === 'function')
  return dove ? dove[nome](...a) : `manca la funzione ${nome}`
}
const sezione = async (titolo, corpo) => {
  console.log(`\n${titolo}`)
  try {
    await corpo()
  } catch (e) {
    console.log('  ✗ la prova si ferma qui —', e.message)
    guai++
  }
}

const QUOTA = [{ anno: 2026, numero: 1, dal: '2026-09-01', al: '2027-07-31', mancano: 0 }]
let n = 0
// Una persona in regola con la quota; ogni caso cambia il certificato.
const persona = (extra = {}) => ({
  id: `p${++n}`, nome: 'Prova', cognome: `Numero${n}`, attiva: true, creataIl: '2026-01-01', iscrizioni: [], documento: true,
  natoIl: '1990-05-05', certificato: { conFile: false }, pagamento: { stato: 'da_pagare' }, quote: QUOTA, ...extra,
})
const conCert = (certificato, extra = {}) => persona({ certificato, ...extra })
const stato = (certificato, natoIl, oggi) => f('statoCertificato', { certificato, natoIl }, oggi)

await sezione('1. il termine: il più lontano fra quello scritto, la scadenza + giorni e il 6° compleanno + giorni', async () => {
  const t = (c, nato, creata, giorni = 30) => f('termineCertificato', c, nato, creata, giorni)
  ok('accolta il 12/11 con 30 giorni: entro il 12/12', t({ entroScritto: '2026-12-12' }, '1990-05-05', '2020-01-01'), '2026-12-12')
  ok('rinnovo scaduto il 01/11: entro il 01/12', t({ scade: '2026-11-01' }, '1990-05-05', '2020-01-01'), '2026-12-01')
  ok('il termine scritto più lontano vince', t({ scade: '2026-11-01', entroScritto: '2026-12-12' }, '1990-05-05', '2020-01-01'), '2026-12-12')
  ok('la scadenza + giorni vince su un termine scritto più vicino', t({ scade: '2026-11-01', entroScritto: '2026-11-15' }, '1990-05-05', '2020-01-01'), '2026-12-01')
  ok('giorni a 45: il termine scritto (accolta a 30) resta', t({ entroScritto: '2026-12-12' }, '1990-05-05', '2020-01-01', 45), '2026-12-12')
  ok('giorni a 45: il rinnovo (calcolato) usa 45', t({ scade: '2026-11-01' }, '1990-05-05', '2020-01-01', 45), '2026-12-16')
  ok('compie 6 anni il 20/11 da iscritto: entro il 20/12', t({}, '2020-11-20', '2026-10-01'), '2026-12-20')
  ok('6 anni compiuti prima di iscriversi: nessun termine dal compleanno', t({}, '2020-05-05', '2026-10-01'), undefined)
  ok('un adulto senza termine scritto e senza certificato: nessun termine (il compleanno è di 30 anni fa)', t({}, '1990-05-05', '2020-01-01'), undefined)
  ok('chi è nato il 29 febbraio compie gli anni il 1 marzo: entro il 31 marzo', t({}, '2020-02-29', '2026-01-01'), '2026-03-31')
  ok('senza data di nascita, né scadenza né termine: nessun termine', t({}, undefined, '2026-01-01'), undefined)
  // La data messa a mano dalla segreteria vale così com'è (deciso il 2026-11-11): può accorciare il rinnovo.
  ok('data a mano più vicina del rinnovo: vale quella', t({ scade: '2026-11-01', entroScritto: '2026-11-15', spostatoIl: '2026-11-10' }, '1990-05-05', '2020-01-01'), '2026-11-15')
  ok('data a mano più vicina del 6° compleanno + giorni: vale quella', t({ entroScritto: '2026-11-25', spostatoIl: '2026-11-10' }, '2020-11-20', '2026-10-01'), '2026-11-25')
})

await sezione('2. lo stato `atteso` (giallo) e il rosso dopo il termine', async () => {
  const nuovo = { conFile: false, entro: '2026-12-12' }
  ok('accolta il 12/11 con 30 giorni: il 12/12 è atteso', stato(nuovo, '1990-05-05', '2026-12-12'), 'atteso')
  ok('il 13/12 manca', stato(nuovo, '1990-05-05', '2026-12-13'), 'manca')
  const rinnovo = { scade: '2026-11-01', conFile: false, entro: '2026-12-01' }
  ok('rinnovo scaduto il 01/11: atteso fino al 01/12', stato(rinnovo, '1990-05-05', '2026-12-01'), 'atteso')
  ok('scaduto dal 02/12', stato(rinnovo, '1990-05-05', '2026-12-02'), 'scaduto')
  const sei = { conFile: false, entro: '2026-12-20' }
  ok('compie 6 anni il 20/11: atteso fino al 20/12', stato(sei, '2020-11-20', '2026-12-20'), 'atteso')
  ok('… e manca dal 21/12', stato(sei, '2020-11-20', '2026-12-21'), 'manca')
  ok('un adulto senza termine e senza certificato è manca', stato({ conFile: false }, '1990-05-05', '2026-11-24'), 'manca')
  ok('un file mandato (inAttesaIl) non cambia lo stato: atteso resta atteso', stato({ ...nuovo, conFile: true, inAttesaIl: '2026-11-20' }, '1990-05-05', '2026-11-24'), 'atteso')
  ok('… e senza termine resta manca', stato({ conFile: true, inAttesaIl: '2026-11-20' }, '1990-05-05', '2026-11-24'), 'manca')
  ok('un certificato valido resta valido, anche con un termine di prima', stato({ scade: '2027-03-01', conFile: true, entro: '2026-12-12' }, '1990-05-05', '2026-11-24'), 'valido')
  ok('sotto i 6 anni non serve, termine o no', stato(nuovo, '2022-01-01', '2026-11-24'), 'non_serve')

  const oggi = '2026-11-24'
  ok('`atteso` non è fra i rossi: senzaCertificatoValido è falso', f('senzaCertificatoValido', conCert(nuovo), oggi), false)
  ok('manca e scaduto restano rossi', [f('senzaCertificatoValido', conCert({ conFile: false }), oggi), f('senzaCertificatoValido', conCert({ scade: '2026-10-01', conFile: false }), oggi)], [true, true])
  ok('certificatoAtteso: attiva e atteso', [f('certificatoAtteso', conCert(nuovo), oggi), f('certificatoAtteso', conCert(nuovo, { attiva: false }), oggi), f('certificatoAtteso', conCert({ conFile: false }), oggi)], [true, false, false])
})

await sezione('3. i conti: contaCertificati, certificatiDaSistemare, certificatiDaPortare', async () => {
  const oggi = '2026-11-24'
  const nuovo = conCert({ conFile: false, entro: '2026-12-12' })
  const rinnovo = conCert({ scade: '2026-11-01', conFile: false, entro: '2026-12-01' })
  const passato = conCert({ conFile: false, entro: '2026-11-10' })
  const valido = conCert({ scade: '2027-06-01', conFile: true })
  const inScadenza = conCert({ scade: '2026-12-10', conFile: true })
  const scaduto = conCert({ scade: '2026-01-01', conFile: false })
  const piccolo = conCert({ conFile: false, entro: '2026-12-12' }, { natoIl: '2022-01-01' })
  ok('i conti delle statistiche, con `atteso` a parte', f('contaCertificati', [nuovo, rinnovo, passato, valido, inScadenza, scaduto, piccolo], oggi), { valido: 1, in_scadenza: 1, scaduto: 1, manca: 1, atteso: 2 })

  const disattivo = conCert({ conFile: false, entro: '2026-12-12' }, { attiva: false })
  const genitore = conCert({ conFile: false, entro: '2026-12-12' }, { genitoreNonIscritto: true })
  const tutte = [nuovo, rinnovo, passato, scaduto, valido, disattivo, genitore]
  ok('da sistemare conta solo i rossi (manca, scaduto)', f('certificatiDaSistemare', tutte, oggi), 2)
  ok('da portare conta gli `atteso` di chi è attivo e non è un genitore non iscritto', f('certificatiDaPortare', tutte, oggi), 2)
  ok('scheda disattivata: nessun conteggio', [f('certificatiDaSistemare', [conCert({ conFile: false }, { attiva: false })], oggi), f('certificatiDaPortare', [disattivo], oggi), f('certificatoAtteso', disattivo, oggi)], [0, 0, false])
})

await sezione('4. DA FARE: chi manca, chi deve portarlo', async () => {
  const oggi = '2026-11-24'
  const perId = (v) => (Array.isArray(v) ? Object.fromEntries(v.map((x) => [x.id, [x.perche, x.rosso]])) : v)
  const passato = conCert({ conFile: false, entro: '2026-11-12' })
  const scaduto = conCert({ scade: '2026-10-02', conFile: false })
  const senzaTermine = conCert({ conFile: false })
  const senzaNascita = conCert({ conFile: false }, { natoIl: undefined })
  const atteso = conCert({ conFile: false, entro: '2026-12-12' })
  const v = f('chiCertificati', [passato, scaduto, senzaTermine, senzaNascita, atteso, conCert({ conFile: false }, { attiva: false })], oggi)
  ok('chiCertificati: il termine passato, lo scaduto, nessun certificato (anche senza nascita); mai chi è atteso', perId(v), {
    [passato.id]: ['doveva portarlo entro il 12 novembre', true],
    [scaduto.id]: ['scaduto il 2 ottobre', true],
    [senzaTermine.id]: ['nessun certificato', true],
    [senzaNascita.id]: ['nessun certificato · senza data di nascita', true],
  })
  const a = conCert({ conFile: false, entro: '2026-12-05' })
  // Oggi è il 24/11: il 25 è ancora nel termine.
  const b = conCert({ conFile: false, entro: '2026-11-25' })
  const c = conCert({ conFile: false, entro: '2026-11-30' })
  const w = f('chiDaPortare', [a, b, c, passato, conCert({ conFile: false, entro: '2026-11-30' }, { attiva: false })], oggi)
  ok('chiDaPortare: gli `atteso` per termine crescente, con «entro il …»', Array.isArray(w) ? w.map((x) => [x.id, x.perche]) : w, [[b.id, 'entro il 25 novembre'], [c.id, 'entro il 30 novembre'], [a.id, 'entro il 5 dicembre']])
})

await sezione('5. cosaBlocca: il certificato non arrivato non tiene fuori dalla sala', async () => {
  const oggi = '2026-11-24'
  const pagata = { pagamento: { stato: 'pagato' } }
  const cb = (p) => f('cosaBlocca', p, oggi)
  ok('atteso: niente (passa alla quota, che è pagata)', cb(conCert({ conFile: false, entro: '2026-12-12' }, pagata)), null)
  ok('atteso e quota da pagare: solo la quota', cb(conCert({ conFile: false, entro: '2026-12-12' }, { quote: [] }))?.tasto, 'quota')
  ok('atteso con un file mandato: niente', cb(conCert({ conFile: true, inAttesaIl: '2026-11-20', entro: '2026-12-12' }, pagata)), null)
  ok('manca: CERTIFICATO NON ARRIVATO, non blocca', cb(conCert({ conFile: false }, pagata)), { blocca: false, titolo: 'CERTIFICATO NON ARRIVATO', frase: 'Manca il certificato medico.', tasto: 'certificato' })
  ok('manca col termine passato: lo stesso', cb(conCert({ conFile: false, entro: '2026-11-10' }, pagata)), { blocca: false, titolo: 'CERTIFICATO NON ARRIVATO', frase: 'Manca il certificato medico.', tasto: 'certificato' })
  ok('manca anche con un file mandato (non vale finché non si conferma)', cb(conCert({ conFile: true, inAttesaIl: '2026-11-20' }, pagata))?.titolo, 'CERTIFICATO NON ARRIVATO')
  ok('scaduto: lo stesso titolo, la frase di prima', cb(conCert({ scade: '2026-10-01', conFile: true }, pagata)), { blocca: false, titolo: 'CERTIFICATO NON ARRIVATO', frase: 'Il certificato è scaduto il 01/10/2026.', tasto: 'certificato' })
  ok('niente «NON PUÒ ENTRARE IN SALA» da nessuna parte', JSON.stringify([cb(conCert({ conFile: false }, pagata)), cb(conCert({ scade: '2026-10-01', conFile: true }, pagata))]).includes('NON PUÒ ENTRARE'), false)
})

await sezione('6. il riquadro CERTIFICATO della scheda', async () => {
  const r = (c, nato, oggi) => f('riquadroCertificato', c, nato, oggi, true)
  const adulto = '1990-05-05'
  ok('atteso, nuovo: DA PORTARE ENTRO, giallo, «Cambia la data»', r({ conFile: false, entro: '2026-12-12', entroScritto: '2026-12-12' }, adulto, '2026-11-24'),
    { nome: 'DA PORTARE ENTRO IL 12 DICEMBRE 2026', sotto: 'fra 18 giorni · iscritto senza certificato', tono: 'giallo', tasto: 'Cambia la data' })
  ok('atteso, nuovo, con la data spostata: da chi e quando', r({ conFile: false, entro: '2026-12-12', entroScritto: '2026-12-12', spostatoDa: 'Laura', spostatoIl: '2026-11-20' }, adulto, '2026-11-24'),
    { nome: 'DA PORTARE ENTRO IL 12 DICEMBRE 2026', sotto: 'fra 18 giorni · data spostata da Laura il 20 novembre 2026', tono: 'giallo', tasto: 'Cambia la data' })
  ok('atteso, rinnovo: SCADUTO IL … · DA PORTARE ENTRO IL …, nessun tasto', r({ scade: '2026-11-01', conFile: false, entro: '2026-12-01' }, adulto, '2026-11-24'),
    { nome: 'SCADUTO IL 1 NOVEMBRE 2026 · DA PORTARE ENTRO IL 1 DICEMBRE 2026', sotto: 'fra 7 giorni · il nuovo va portato entro 30 giorni dalla scadenza', tono: 'giallo' })
  ok('atteso con un file mandato: da confermare, nessun tasto', r({ conFile: false, entro: '2026-12-12', inAttesaIl: '2026-11-20' }, adulto, '2026-11-24'),
    { nome: 'DA PORTARE ENTRO IL 12 DICEMBRE 2026', sotto: 'caricato il 20 novembre 2026, da confermare: finché non lo confermi non vale', tono: 'giallo' })
  ok('manca col termine passato, termine scritto: DOVEVA PORTARLO, rosso, «Cambia la data»', r({ conFile: false, entro: '2026-12-12', entroScritto: '2026-12-12' }, adulto, '2026-12-15'),
    { nome: 'DOVEVA PORTARLO ENTRO IL 12 DICEMBRE 2026', sotto: 'da 3 giorni · la presenza si segna, ma va sollecitato', tono: 'rosso', tasto: 'Cambia la data' })
  ok('… da ieri, per un giorno solo', r({ conFile: false, entro: '2026-12-12', entroScritto: '2026-12-12' }, adulto, '2026-12-13').sotto, 'da ieri · la presenza si segna, ma va sollecitato')
  ok('manca col termine passato, calcolato (nessun termine scritto): «Dai una data»', r({ conFile: false, entro: '2026-12-12' }, adulto, '2026-12-15').tasto, 'Dai una data')
  ok('manca senza termine, scheda di prima: CERTIFICATO NON ARRIVATO, «Dai una data»', r({ conFile: false }, adulto, '2026-12-15'),
    { nome: 'CERTIFICATO NON ARRIVATO', sotto: 'senza un termine per portarlo · la presenza si segna', tono: 'rosso', tasto: 'Dai una data' })
  const scaduto = { scade: '2026-11-01', conFile: false, caricatoIl: '2026-02-03', entro: '2026-12-01' }
  ok('scaduto rosso: come oggi, più «Dai una data»', r(scaduto, adulto, '2026-12-15'),
    { nome: 'SCADUTO IL 1 NOVEMBRE 2026', sotto: '44 giorni fa · file cancellato', tono: 'rosso', tasto: 'Dai una data' })
  ok('scaduto rosso con un termine scritto: «Cambia la data»', r({ ...scaduto, entroScritto: '2026-12-01' }, adulto, '2026-12-15').tasto, 'Cambia la data')
  ok('valido: niente tasto', r({ scade: '2027-06-30', conFile: true, caricatoIl: '2026-09-03' }, adulto, '2026-11-24').tasto, undefined)
})

await sezione('7. i testi del modulo di iscrizione (richieste.ts)', async () => {
  ok('la domanda, normale', f('domandaCertificato', 'normale'), 'Dai 6 anni serve il certificato medico per fare sport. Ce l’hai già?')
  ok('la domanda, agonistico', f('domandaCertificato', 'agonistico'), 'Per judo, aikido e lotta, dai 12 anni serve il certificato medico agonistico. Ce l’hai già?')
  ok('«Non ce l’ho ancora»: 30 giorni', f('testoCertificatoDopo', 30), 'Hai 30 giorni da quando la segreteria accoglie l’iscrizione: lo carichi dall’area iscritti o lo porti in segreteria. Intanto vieni alle lezioni.')
  ok('un giorno solo', f('testoCertificatoDopo', 1), 'Hai 1 giorno da quando la segreteria accoglie l’iscrizione: lo carichi dall’area iscritti o lo porti in segreteria. Intanto vieni alle lezioni.')
  ok('senza una scelta: dicci se ce l’hai', f('mancaCertificato', undefined, false), 'Dicci se il certificato ce l’hai.')
  ok('«Lo carico ora» senza file: caricalo o scegli l’altra', f('mancaCertificato', 'ora', false), 'Manca il certificato: caricalo, oppure scegli «Non ce l’ho ancora».')
  ok('«Lo carico ora» col file: niente da dire', f('mancaCertificato', 'ora', true), undefined)
  ok('«Non ce l’ho ancora»: niente da dire', f('mancaCertificato', 'dopo', false), undefined)
  ok('il promemoria con il nome', f('promemoriaCertificato', { di: 'Matteo', giorni: 30 }),
    { titolo: 'Porti il certificato medico di Matteo', testo: 'entro 30 giorni da quando la segreteria accoglie l’iscrizione: dall’area iscritti o in segreteria. Intanto Matteo viene alle lezioni' })
  ok('il promemoria senza nome', f('promemoriaCertificato', { giorni: 30 }),
    { titolo: 'Porti il certificato medico', testo: 'entro 30 giorni da quando la segreteria accoglie l’iscrizione: dall’area iscritti o in segreteria. Intanto vieni alle lezioni' })
})

await sezione('8. l’area dell’iscritto: gli avvisi, la riga, il segno', async () => {
  const s = (certificato, natoIl = '1990-05-05') => ({ certificato, natoIl, pagamento: { stato: 'pagato' }, quote: QUOTA })
  const avv = (c, oggi) => f('avvisi', s(c), oggi)
  ok('atteso senza scadenza: avviso, vieni alle lezioni', avv({ conFile: false, entro: '2026-12-12' }, '2026-11-24'),
    [{ tono: 'avviso', testo: 'Il certificato medico va caricato entro il 12 dicembre: caricalo qui o portalo in segreteria. Fino ad allora vieni alle lezioni.' }])
  ok('atteso con la scadenza (rinnovo)', avv({ scade: '2026-11-01', conFile: false, entro: '2026-12-01' }, '2026-11-24'),
    [{ tono: 'avviso', testo: 'Il certificato medico è scaduto il 01/11/2026: il nuovo va caricato entro il 1 dicembre, qui o in segreteria. Fino ad allora vieni alle lezioni.' }])
  ok('manca col termine passato: guaio', avv({ conFile: false, entro: '2026-12-12' }, '2026-12-15'),
    [{ tono: 'guaio', testo: 'Il certificato medico doveva arrivare entro il 12 dicembre: caricalo qui o portalo in segreteria.' }])
  ok('manca senza termine: guaio', avv({ conFile: false }, '2026-12-15'), [{ tono: 'guaio', testo: 'Manca il certificato medico: caricalo qui o portalo in segreteria.' }])

  const riga = (c, oggi) => f('rigaCertificato', { certificato: c, natoIl: '1990-05-05' }, oggi)
  ok('la riga: atteso, «Da caricare entro il …»', riga({ conFile: false, entro: '2026-12-12' }, '2026-11-24'), { tono: 'avviso', testo: 'Da caricare entro il 12 dicembre.' })
  ok('la riga: manca, «Non risulta.»', riga({ conFile: false }, '2026-11-24'), { tono: 'guaio', testo: 'Non risulta.' })

  ok('il segno su DOCUMENTI: atteso è giallo', f('segnoInRegola', 'atteso', 'pagato'), { parola: 'DA SISTEMARE', tono: 'giallo' })
  ok('atteso con la quota da pagare: rosso, vince il peggiore', f('segnoInRegola', 'atteso', 'da_pagare'), { parola: 'DA SISTEMARE', tono: 'rosso' })
})

await sezione('9. i giorni: da 1 a 120', async () => {
  const g = (x) => f('cosaNonVaGiorniCertificato', x)
  ok('0, 121, -5, 1,5 e non un numero: «I giorni vanno da 1 a 120.»', [0, 121, -5, 1.5, NaN].map(g), Array(5).fill('I giorni vanno da 1 a 120.'))
  ok('1, 30 e 120 vanno bene', [1, 30, 120].map(g), [undefined, undefined, undefined])
  const cost = (k) => Object.values(m).find((x) => x && typeof x === 'object' && k in x)?.[k]
  ok('i valori di base', [cost('GIORNI_CERTIFICATO'), cost('GIORNI_CERTIFICATO_MAX')], [30, 120])
})

await sezione('10. le gare: `atteso` non vale come certificato valido', async () => {
  const gara = { id: 'g1', nome: 'Trofeo', dal: '2026-12-05', al: '2026-12-06' }
  const nelTermine = conCert({ conFile: false, entro: '2026-12-12' }, { nome: 'Anna', cognome: 'Atteso' })
  const dopo = conCert({ conFile: false, entro: '2026-12-01' }, { nome: 'Dino', cognome: 'Dopo' })
  const valida = conCert({ scade: '2027-06-01', conFile: true }, { nome: 'Vera', cognome: 'Valida' })
  ok('all’ultimo giorno della gara il termine corre ancora: atteso', f('certificatoAllaGara', nelTermine, gara), 'atteso')
  ok('se il termine finisce prima della gara: manca', f('certificatoAllaGara', dopo, gara), 'manca')
  const atleti = [nelTermine, dopo, valida].map((p) => ({ garaId: 'g1', personaId: p.id }))
  const righe = f('righeGara', gara, atleti, [nelTermine, dopo, valida])
  ok('nella riga, chi è atteso conta come senza certificato valido', Array.isArray(righe) ? righe.map((x) => [x.cognome, x.senzaCertificatoValido]) : righe, [['Atteso', true], ['Dopo', true], ['Valida', false]])
  ok('l’avviso conta anche l’atteso: 2', f('avvisoCertificati', Array.isArray(righe) ? righe : []), '2 atleti senza certificato valido')
  const rie = f('riepilogoCertificati', Array.isArray(righe) ? righe : [])
  ok('il riepilogo: 3 atleti, 1 a posto, e chi no per nome', [rie.atleti, rie.aPosto, rie.senza?.map((x) => x.cognome)], [3, 1, ['Atteso', 'Dopo']])
  ok('nella gara dell’iscritto: il termine non vale, va portato prima', f('certificatoPerLaGara', nelTermine, gara)?.guaio, true)
})

await sezione('11. la proroga nella segreteria di prova: cambiaTermineCertificato', async () => {
  const s = m.creaSegreteriaProva()
  const id = await s.salvaPersona({ nome: 'Anna', cognome: 'Proroga' })
  const dice = (entro) => errore(() => s.cambiaTermineCertificato(id, entro))
  ok('fra 121 giorni no: stesso messaggio del database', await dice('2027-01-25'), 'La data va da oggi a 120 giorni da oggi.')
  ok('ieri no', await dice('2026-09-25'), 'La data va da oggi a 120 giorni da oggi.')
  ok('fra 120 giorni sì', await dice('2027-01-24'), 'nessun errore')
  const p = (await s.persone()).find((x) => x.id === id)
  ok('il termine scritto è quello nuovo, e vale come termine', [p.certificato.entroScritto, p.certificato.entro], ['2027-01-24', '2027-01-24'])
  ok('la traccia: il giorno in cui l’ha spostato', p.certificato.spostatoIl, '2026-09-26')
})

// Il giro di correzioni dopo collaudo e revisioni: ognuna lascia la sua prova.
await sezione('12. le correzioni: esito, invio, scheda, gare, prova', async () => {
  ok('famiglia: «Portate i certificati medici», e vengono alle lezioni', f('promemoriaCertificato', { di: ['Luca', 'Sara'], giorni: 30 }),
    { titolo: 'Portate i certificati medici', testo: 'entro 30 giorni da quando la segreteria accoglie l’iscrizione: dall’area iscritti o in segreteria. Intanto Luca e Sara vengono alle lezioni' })
  ok('una persona sola in elenco: come col nome', f('promemoriaCertificato', { di: ['Luca'], giorni: 30 }).titolo, 'Porti il certificato medico di Luca')
  const fine = (x) => f('fraseCertificatoFinale', { tipo: 'normale', conFile: false, dopo: false, giorni: 30, ...x })
  ok('la pagina finale con «non ce l’ho ancora»: titolo e testo dei giorni insieme', fine({ dopo: true, di: 'Matteo' }),
    'Porti il certificato medico di Matteo entro 30 giorni da quando la segreteria accoglie l’iscrizione: dall’area iscritti o in segreteria. Intanto Matteo viene alle lezioni.')
  ok('senza la scelta (prima di 141): solo il ricordo, senza «non si partecipa»', fine({ giorni: null, tipo: 'agonistico' }), 'Ricorda di portare in segreteria il certificato medico agonistico.')
  ok('col file caricato, o sotto i 6 anni: niente', [fine({ conFile: true }), fine({ tipo: 'nessuno' })], [null, null])
  const r = (c, oggi = '2026-11-24') => f('riquadroCertificato', c, '1990-05-05', oggi, true)
  ok('il file senza data: niente «Dai una data» (c’è «Scrivi la data»)', r({ conFile: true }).tasto, undefined)
  ok('rinnovo spostato a mano: la traccia, non i giorni dalla scadenza', r({ scade: '2026-11-01', conFile: false, entro: '2026-12-20', entroScritto: '2026-12-20', spostatoDa: 'Laura', spostatoIl: '2026-11-20' }).sotto,
    'fra 26 giorni · data spostata da Laura il 20 novembre 2026')
  const gara = { dal: '2026-12-05', al: '2026-12-06' }
  ok('gare, segreteria: nel termine col certificato scaduto dice com’è', f('scrittaCertificato', { certificato: 'atteso', scade: '2026-11-01', daConfermare: false }).tipo, 'manca')
  ok('LE MIE GARE: rinnovo nel termine, «scade il…»', f('certificatoPerLaGara', { certificato: { scade: '2026-11-20', entro: '2026-12-20' }, natoIl: '1990-05-05' }, gara)?.testo, 'Certificato: scade il 20 novembre')
  const t = (e) => f('cosaNonVaTermineCertificato', e, '2026-11-24')
  ok('cosaNonVaTermineCertificato: ieri e fra 121 giorni no, oggi e fra 120 sì', [t('2026-11-23'), t('2027-03-25'), t('2026-11-24'), t('2027-03-24')],
    ['La data va da oggi a 120 giorni da oggi.', 'La data va da oggi a 120 giorni da oggi.', undefined, undefined])
  // In prova come nel database: il termine resta, salvo un certificato valido.
  const s = m.creaSegreteriaProva()
  const id = await s.salvaPersona({ nome: 'Tea', cognome: 'Termine' })
  await s.cambiaTermineCertificato(id, '2026-10-20')
  const file = new File(['x'], 'cert.pdf', { type: 'application/pdf' })
  await s.caricaCertificato(id, file, '2026-09-01').catch(() => {})
  ok('caricato un certificato già scaduto: il termine resta', (await s.persone()).find((x) => x.id === id)?.certificato.entroScritto, '2026-10-20')
  await s.caricaCertificato(id, file, '2027-09-01')
  ok('caricato uno valido: il termine va via', (await s.persone()).find((x) => x.id === id)?.certificato.entroScritto, undefined)
})

if (guai) {
  console.log(`\n${guai} COSE NON TORNANO`)
  process.exit(1)
}
console.log('\nTUTTO A POSTO')
