// ---------------------------------------------------------------------------
// I certificati medici che restano nell'app, senza browser.
//
//   node scripts/prova-certificati.mjs
//
// La segreteria di prova deve dire quello che dice il database
// (`supabase/45-certificati-online.sql`, provato da `supabase/prova/certificati.sql`,
// `iscrizioni.sql` e `unisci-doppioni.sql`): un file per persona, che prende
// il posto del vecchio insieme alla data, che passa dalla richiesta alla
// scheda, che si cancella 30 giorni dopo la scadenza o con la persona
// disattivata. In più gli stati della scheda, che sono funzioni di
// `src/lib/segreteria.ts`, e il lato Supabase con un database finto: cosa
// manda, in che ordine, e cosa dice se il database non è aggiornato.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export { creaRichiesteProva } from './src/lib/richiesteProva'; export * as segreteriaLib from './src/lib/segreteria'; export * as richiesteLib from './src/lib/richieste'; export * as iscrittoLib from './src/lib/iscritto'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const modulo = 'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

// Oggi, per la prova, è sabato 26 settembre 2026 a mezzogiorno.
// `let`: una prova manda avanti l'orologio, e poi lo rimette.
let OGGI = new Date(2026, 8, 26, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI]))
  }
  static now() {
    return OGGI
  }
}
const GIORNO = 86_400_000

const m = await import(modulo)
const lib = m.segreteriaLib
const s = m.creaSegreteriaProva()
const r = m.creaRichiesteProva()
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
    return e.message
  }
}
/** Una funzione di `segreteria.ts`: se non c'è ancora, la prova lo dice invece di fermarsi. */
const f = (nome, ...a) => (typeof lib[nome] === 'function' ? lib[nome](...a) : `manca la funzione ${nome}`)
/** Una sezione che si ferma a metà (una funzione che manca) non ferma le altre. */
const sezione = async (titolo, corpo) => {
  console.log(`\n${titolo}`)
  try {
    await corpo()
  } catch (e) {
    console.log('  ✗ la prova si ferma qui —', e.message)
    guai++
  }
}

const pdf = () => new File(['x'], 'certificato.pdf', { type: 'application/pdf' })
const png = () => new File(['x'], 'certificato.png', { type: 'image/png' })
const di = async (id) => (await s.persone()).find((p) => p.id === id)
const nuova = (nome, cognome) => s.salvaPersona({ nome, cognome })

await sezione('1. gli stati della scheda', async () => {
  const oggi = '2026-09-26'
  const stato = (c) => f('statoFileCertificato', c, oggi)
  ok('nessun certificato', stato({ conFile: false }), 'nessuno')
  ok('un file senza la data: manca ancora il certificato, finché la segreteria non scrive la data', stato({ conFile: true }), 'nessuno')
  ok('valido, col file', stato({ scade: '2027-03-14', conFile: true }), 'valido')
  ok('valido, senza file: la data c\'è, il foglio no', stato({ scade: '2027-03-14', conFile: false }), 'valido_senza_file')
  ok('valido, col file di prima della carta', stato({ scade: '2027-03-14', conFile: true, vecchio: true }), 'file_vecchio')
  ok('fra trenta giorni: in scadenza', stato({ scade: '2026-10-26', conFile: true }), 'in_scadenza')
  ok('fra trentuno: valido', stato({ scade: '2026-10-27', conFile: true }), 'valido')
  ok('scade oggi: ancora in scadenza', stato({ scade: oggi, conFile: true }), 'in_scadenza')
  ok('in scadenza senza file: in scadenza', stato({ scade: '2026-10-10', conFile: false }), 'in_scadenza')
  ok('scaduto ieri, col file', stato({ scade: '2026-09-25', conFile: true }), 'scaduto_con_file')
  ok('scaduto ieri, senza file', stato({ scade: '2026-09-25', conFile: false }), 'scaduto_senza_file')
  ok('scaduto, anche se il file è di prima della carta', stato({ scade: '2026-09-25', conFile: true, vecchio: true }), 'scaduto_con_file')

  ok('il file si cancella 30 giorni dopo la scadenza', f('cancellaFileIl', '2026-09-01'), '2026-10-01')
  ok('anche a cavallo dell\'anno', f('cancellaFileIl', '2026-12-15'), '2027-01-14')

  const sotto = (natoIl, certificato = { conFile: false }, attiva = true) => f('senzaCertificatoValido', { attiva, certificato, natoIl }, oggi)
  ok('sotto i 6 anni il certificato non manca', sotto('2020-09-27'), false)
  ok('a 6 anni compiuti oggi manca', sotto('2020-09-26'), true)
  ok('senza data di nascita manca come per tutti', sotto(undefined), true)
  ok('un adulto con la data in regola non manca', sotto('1990-05-05', { scade: '2027-03-14', conFile: true }), false)
  ok('in scadenza non manca ancora', sotto('1990-05-05', { scade: '2026-10-10', conFile: true }), false)
  ok('scaduto manca', sotto('1990-05-05', { scade: '2026-09-25', conFile: false }), true)
  ok('il file senza la data manca ancora', sotto('1990-05-05', { conFile: true }), true)
  ok('chi è disattivato non manca', sotto('1990-05-05', { conFile: false }, false), false)

  ok('da stampare solo il file di prima della carta', [
    f('certificatoDaStampare', { conFile: true, vecchio: true }),
    f('certificatoDaStampare', { conFile: true }),
    f('certificatoDaStampare', { conFile: false }),
  ], [true, false, false])
  ok('dalle richieste si stampano documento e retro, non il certificato', m.richiesteLib.DA_STAMPARE, ['documento', 'documento-retro'])
})

await sezione('1b. cosa dice la scheda e cosa si può salvare', async () => {
  const oggi = '2026-09-26'
  const p = (c, natoIl) => f('presentaCertificato', c, natoIl, oggi)
  const riga = (x) => (typeof x === 'string' ? x : [x.parola, x.tono, x.tasto, x.primo])
  ok('nessun certificato: MANCA, rosso, CARICA IL CERTIFICATO, il primo gesto', riga(p({ conFile: false })), ['MANCA', 'rosso', 'CARICA IL CERTIFICATO', true])
  ok('… e la frase', p({ conFile: false }).frase, 'Nessun certificato in segreteria: senza, in sala non si entra.')
  ok('il file senza la data: SCRIVI LA DATA', riga(p({ conFile: true })), ['MANCA', 'rosso', 'SCRIVI LA DATA', true])
  ok('… e dice cosa fare', p({ conFile: true }).frase, 'Il file c’è, ma manca la data: scrivila leggendo il foglio. Senza, in sala non si entra.')
  ok('valido col file: SOSTITUISCI, non è il primo gesto', riga(p({ scade: '2027-03-14', conFile: true })), ['VALIDO', 'verde', 'SOSTITUISCI', false])
  ok('… e la frase', p({ scade: '2027-03-14', conFile: true }).frase, 'Valido fino al 14 marzo 2027.')
  ok('il file di prima è un valido come gli altri', riga(p({ scade: '2027-03-14', conFile: true, vecchio: true })), ['VALIDO', 'verde', 'SOSTITUISCI', false])
  ok('valido senza file: CARICA IL FILE, e lo dice', [riga(p({ scade: '2027-03-14', conFile: false })), p({ scade: '2027-03-14', conFile: false }).frase],
    [['VALIDO', 'verde', 'CARICA IL FILE', true], 'Valido fino al 14 marzo 2027, ma il file non c’è: la data è segnata, il foglio no.'])
  ok('in scadenza: giallo, fra quanti giorni', [riga(p({ scade: '2026-10-08', conFile: true })), p({ scade: '2026-10-08', conFile: true }).frase],
    [['IN SCADENZA', 'giallo', 'SOSTITUISCI', false], 'Scade il 8 ottobre 2026, fra 12 giorni.'])
  ok('scade domani e oggi', [p({ scade: '2026-09-27', conFile: true }).frase, p({ scade: oggi, conFile: true }).frase], ['Scade il 27 settembre 2026, domani.', 'Scade il 26 settembre 2026, oggi.'])
  const sc = p({ scade: '2026-09-25', conFile: true })
  ok('scaduto col file: SOSTITUISCI primo, e quando il file si cancella', [riga(sc), sc.frase, sc.cancellaIl], [['SCADUTO', 'rosso', 'SOSTITUISCI', true], 'Scaduto il 25 settembre 2026: va rinnovato prima di tornare in sala.', '2026-10-25'])
  // Un file c'è stato (il giorno di caricamento resta anche dopo la pulizia): «file cancellato». Se non c'è mai stato, niente sul file.
  const ss = p({ scade: '2026-08-01', conFile: false, caricatoIl: '2026-02-03' })
  ok('scaduto senza file, che c\'era: CARICA IL NUOVO, file cancellato', [riga(ss), ss.frase, ss.cancellaIl, ss.nota], [['SCADUTO', 'rosso', 'CARICA IL NUOVO', true], 'Certificato scaduto, file cancellato. Scaduto il 1 agosto 2026: ne serve uno nuovo prima di tornare in sala.', undefined, 'Il file è stato cancellato 30 giorni dopo la scadenza, come previsto.'])
  const mai = p({ scade: '2026-08-01', conFile: false })
  ok('scaduto con la sola data scritta a mano: niente parola sul file', [riga(mai), mai.frase, mai.nota], [['SCADUTO', 'rosso', 'CARICA IL NUOVO', true], 'Certificato scaduto il 1 agosto 2026: ne serve uno nuovo prima di tornare in sala.', 'Nessun file caricato: la data l’ha scritta la segreteria.'])
  // Disattivata: il file è andato alla disattivazione, e non c'è più niente da cambiare.
  const dis = f('presentaCertificato', { scade: '2027-03-14', conFile: false, caricatoIl: '2026-02-03' }, undefined, oggi, false)
  ok('disattivata: file cancellato alla disattivazione, né SOSTITUISCI né TOGLI', [dis.nota, dis.puoCambiare, p({ scade: '2027-03-14', conFile: true }).puoCambiare], ['File cancellato alla disattivazione.', false, true])
  ok('disattivata con la sola data: nessuna parola sul file cancellato', f('presentaCertificato', { scade: '2027-03-14', conFile: false }, undefined, oggi, false).nota, 'Nessun file caricato: la data l’ha scritta la segreteria.')
  ok('disattivata, ma il file era già andato 30 giorni dopo la scadenza: dice così', f('presentaCertificato', { scade: '2026-08-01', conFile: false, caricatoIl: '2026-02-03' }, undefined, oggi, false).nota, 'Il file è stato cancellato 30 giorni dopo la scadenza, come previsto.')

  // Gli avvisi sotto il gesto, per testo.
  const av = (gesto, c) => f('avvisiGesto', gesto, c, oggi)
  ok('una data di più di 30 giorni fa: il file verrà cancellato subito', av({ scade: '2026-08-27', file: pdf() }, { conFile: false }), ['Questa data è già passata: il certificato risulterà scaduto.', 'Sono passati più di 30 giorni dalla scadenza: il file verrà cancellato subito.'])
  ok('29 giorni fa: scaduto, ma il file resta', av({ scade: '2026-08-28', file: pdf() }, { conFile: false }), ['Questa data è già passata: il certificato risulterà scaduto.'])
  ok('una data futura e un file che ne sostituisce uno: dice che il vecchio si cancella', av({ scade: '2027-01-01', file: pdf() }, { conFile: true }), ['Salvando, il file vecchio si cancella: resta solo questo.'])
  ok('senza data nessun avviso sulla data', av({ scade: '' }, { conFile: false }), [])
  ok('la sola data, senza file da nessuna parte, in scadenza da più di 30 giorni: niente da cancellare', av({ scade: '2026-01-01' }, { conFile: false }), ['Questa data è già passata: il certificato risulterà scaduto.'])
  ok('la sola data su un file che c\'è: il file verrà cancellato subito', av({ scade: '2026-01-01' }, { conFile: true }), ['Questa data è già passata: il certificato risulterà scaduto.', 'Sono passati più di 30 giorni dalla scadenza: il file verrà cancellato subito.'])

  // Le conferme.
  ok('disattivare dice che il file si cancella e non torna', [f('confermaDisattiva', 'Rita Rossi', { scade: '2027-03-14', conFile: true }), f('confermaDisattiva', 'Rita Rossi', { conFile: false })],
    ['Disattivare Rita Rossi? Sparisce dagli appelli e dal tablet; si può riattivare. Il file del certificato si cancella subito e riattivarla non lo riporta: la data resta.', 'Disattivare Rita Rossi? Sparisce dagli appelli e dal tablet; si può riattivare.'])
  ok('unire dice quale certificato resta', [f('confermaUnione', 'Mario Rossi', 'Mario Rossi', { conFile: true }, { conFile: false }), f('confermaUnione', 'Mario Rossi', 'Mario Rossi', { conFile: false }, { conFile: false })],
    ['Unire Mario Rossi in Mario Rossi? La scheda di Mario Rossi se ne va, e non si torna indietro. Del certificato resta quello che scade più tardi, col suo file (se uno non ha il file, quello col file).', 'Unire Mario Rossi in Mario Rossi? La scheda di Mario Rossi se ne va, e non si torna indietro.'])
  ok('sotto i 6 anni senza certificato: NON SERVE, spento, non il primo gesto', riga(p({ conFile: false }, '2021-01-01')), ['NON SERVE', 'spento', 'CARICA IL CERTIFICATO', false])
  ok('… anche con una data scaduta', p({ scade: '2026-01-01', conFile: false }, '2021-01-01').parola, 'NON SERVE')
  ok('… ma con un certificato valido è valido', p({ scade: '2027-03-14', conFile: true }, '2021-01-01').parola, 'VALIDO')

  // Il gesto si apre con la data vuota, anche sostituendo un certificato con la sua data: la vecchia è una trappola nel rinnovo.
  ok('SOSTITUISCI parte con la data vuota, senza file', [f('gestoIniziale', { scade: '2027-03-14', conFile: true }), f('gestoIniziale', { scade: '2026-09-27', conFile: true }), f('gestoIniziale', { conFile: true })], [{ scade: '' }, { scade: '' }, { scade: '' }])
  ok('e così SALVA è spento: niente da salvare finché non c\'è la data nuova', f('certificatoPronto', f('gestoIniziale', { scade: '2027-03-14', conFile: true }), { scade: '2027-03-14', conFile: true }), false)
  const pronto = (gesto, c) => f('certificatoPronto', gesto, c)
  const nessuno = { conFile: false }
  ok('senza la data SALVA è spento, anche col file', [pronto({ scade: '' }, nessuno), pronto({ scade: '', file: pdf() }, nessuno)], [false, false])
  ok('file e data: pronto', pronto({ scade: '2027-01-01', file: pdf() }, nessuno), true)
  ok('la data scritta dove non c\'era niente: pronto', pronto({ scade: '2027-01-01' }, nessuno), true)
  ok('la data com\'era e nessun file nuovo: niente da salvare', pronto({ scade: '2027-01-01' }, { scade: '2027-01-01', conFile: true }), false)
  ok('la data cambiata: pronto', pronto({ scade: '2027-02-01' }, { scade: '2027-01-01', conFile: true }), true)
  ok('un file nuovo con la data com\'era: pronto', pronto({ scade: '2027-01-01', file: png() }, { scade: '2027-01-01', conFile: true }), true)
})

await sezione('1c. sotto i 6 anni, per tutti allo stesso modo', async () => {
  const oggi = '2026-09-26'
  ok('sotto i 6 anni il 29 febbraio: nato il 29 febbraio 2020, il 28 febbraio 2026 ha 5 anni', f('serveCertificato', '2020-02-29', '2026-02-28') !== 'serve', true)
  ok('… il 1 marzo 2026 ne ha 6', f('serveCertificato', '2020-02-29', '2026-03-01') !== 'serve', false)
  ok('oggi che è il 29 febbraio 2028: nato il 29 febbraio 2024, ha 4 anni', f('serveCertificato', '2024-02-29', '2028-02-29') !== 'serve', true)
  ok('nato il 29 febbraio 2020, il 29 febbraio 2028 ne ha 8', f('serveCertificato', '2020-02-29', '2028-02-29') !== 'serve', false)
  ok('senza la data di nascita no', f('serveCertificato', undefined, oggi) !== 'serve', false)
  const persone = [
    { attiva: true, natoIl: '2021-05-05', certificato: { conFile: false } },
    { attiva: true, natoIl: '2021-05-05', certificato: { scade: '2026-01-01', conFile: false } },
    { attiva: true, natoIl: '1990-05-05', certificato: { conFile: false } },
    { attiva: true, natoIl: '1990-05-05', certificato: { scade: '2026-01-01', conFile: true } },
    { attiva: true, natoIl: '1990-05-05', certificato: { scade: '2026-10-10', conFile: true } },
    { attiva: true, natoIl: '1990-05-05', certificato: { scade: '2027-10-10', conFile: true } },
    { attiva: false, natoIl: '1990-05-05', certificato: { conFile: false } },
    { attiva: true, certificato: { conFile: false } },
  ]
  const attive = persone.filter((x) => x.attiva)
  const conti = f('contaCertificati', attive, oggi)
  ok('i conti delle statistiche: valido, in scadenza, scaduto, manca (chi non ha l\'obbligo non si conta)', conti, { valido: 1, in_scadenza: 1, scaduto: 1, manca: 2 })
  ok('chi manca è chi non è a posto: stesso numero in DA FARE, ISCRITTI e nelle statistiche', [
    attive.filter((x) => f('senzaCertificatoValido', x, oggi)).length,
    attive.filter((x) => ['manca', 'scaduto'].includes(f('statoCertificato', x, oggi))).length,
    conti.scaduto + conti.manca,
  ], [3, 3, 3])
  ok('un bambino sotto i 6 anni è a posto, e non avvisa l\'iscritto', [f('statoCertificato', persone[0], oggi), f('statoCertificato', persone[3], oggi)], ['non_serve', 'scaduto'])
  const quotaPagata = { pagamento: { stato: 'pagato' }, quote: [] }
  ok('l\'area dell\'iscritto: un bambino sotto i 6 anni non ha avvisi, un adulto sì', [m.iscrittoLib.avvisi({ certificato: {}, natoIl: '2021-05-05', ...quotaPagata }, oggi).length, m.iscrittoLib.avvisi({ certificato: {}, natoIl: '1990-05-05', ...quotaPagata }, oggi).length], [0, 1])
  ok('inRegola usa la stessa regola', f('inRegola', { ...persone[0], pagamento: { stato: 'pagato' }, quote: [] }, oggi), true)
  ok('il timbro del bambino non è rosso, e non porta DA STAMPARE', [f('timbriScheda', { ...persone[0], documento: false, pagamento: { stato: 'da_pagare' }, quote: [] }, oggi).certificato.tono], ['spento'])
})

await sezione('1d. il timbro non dice più DA STAMPARE, nemmeno col file di prima', async () => {
  const oggi = '2026-09-26'
  const timbro = (c) => f('timbriScheda', { attiva: true, certificato: c, documento: true, pagamento: { stato: 'pagato' }, quote: [] }, oggi).certificato
  const righe = (c) => timbro(c).righe.map((r) => r.testo)
  ok('col file di prima: nessuna riga DA STAMPARE', righe({ scade: '2027-03-14', conFile: true, vecchio: true }).includes('DA STAMPARE'), false)
  ok('con un file nuovo nemmeno', righe({ scade: '2027-03-14', conFile: true }).includes('DA STAMPARE'), false)
  ok('in scadenza col file: solo quanto manca', righe({ scade: '2026-10-06', conFile: true, vecchio: true }), ['FRA 10 GIORNI'])
})

await sezione('2. un file per persona, e prende il posto del vecchio', async () => {
  const p = await nuova('Rita', 'Prova')
  ok('una scheda nuova non ha file', (await di(p)).certificato.conFile, false)
  await s.caricaCertificato(p, png(), '2027-03-14')
  let c = (await di(p)).certificato
  ok('file e data insieme', [c.conFile, c.scade, !c.vecchio, c.caricatoIl], [true, '2027-03-14', true, '2026-09-26'])
  ok('si apre, ed è un\'immagine', (await s.apriCertificato(p))?.pdf, false)
  await s.caricaCertificato(p, pdf(), '2028-01-31')
  c = (await di(p)).certificato
  ok('un file nuovo prende il posto del vecchio, con la sua data', [c.conFile, c.scade], [true, '2028-01-31'])
  ok('e ora si apre il PDF, non l\'immagine', (await s.apriCertificato(p))?.pdf, true)

  const troppo = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'grande.pdf', { type: 'application/pdf' })
  ok('più di 10 MB no', await errore(() => s.caricaCertificato(p, troppo, '2029-01-01')), 'Il file è troppo grande: al massimo 10 MB')
  ok('un tipo che non è una foto né un PDF no', await errore(() => s.caricaCertificato(p, new File(['x'], 'virus.exe', { type: 'application/x-msdownload' }), '2029-01-01')), 'Questo tipo di file non va: serve una foto o un PDF')
  ok('senza la data no', await errore(() => s.caricaCertificato(p, png(), '')), 'Serve la data di scadenza del certificato')
  ok('una data a caso no', await errore(() => s.caricaCertificato(p, png(), 'domani')), 'Serve la data di scadenza del certificato')
  ok('una data più di tre anni avanti no: probabilmente l\'anno è sbagliato', await errore(() => s.caricaCertificato(p, png(), '2029-09-27')), 'La data è troppo lontana: controlla l\'anno.')
  ok('fra tre anni esatti sì', await errore(() => s.caricaCertificato(p, png(), '2029-09-26')), 'nessun errore')
  ok('anche scrivendo la sola data', await errore(() => s.salvaCertificato(p, '2030-01-01')), 'La data è troppo lontana: controlla l\'anno.')
  await s.caricaCertificato(p, pdf(), '2028-01-31')
  c = (await di(p)).certificato
  ok('quando non passa, file e data restano com\'erano', [c.conFile, c.scade, (await s.apriCertificato(p))?.pdf], [true, '2028-01-31', true])
  ok('per una persona che non c\'è no', await errore(() => s.caricaCertificato('p-nessuno', pdf(), '2029-01-01')), 'Persona inesistente')
  ok('l\'iscritto è uno solo', (await s.persone()).filter((x) => x.id === p).length, 1)

  await s.salvaCertificato(p, '2029-06-30')
  c = (await di(p)).certificato
  ok('correggere la sola data lascia il file', [c.conFile, c.scade], [true, '2029-06-30'])
  await s.togliCertificato(p)
  c = (await di(p)).certificato
  ok('tolto: né file né data', [c.conFile, c.scade, await s.apriCertificato(p)], [false, undefined, null])
})

await sezione('3. trenta giorni dopo la scadenza il file se ne va, la data resta', async () => {
  const u = await nuova('Ugo', 'Quasi')
  const v = await nuova('Vera', 'Scaduta')
  await s.caricaCertificato(u, png(), '2026-08-28') // scaduto da 29 giorni
  await s.caricaCertificato(v, png(), '2026-08-27') // da 30
  ok('a 29 giorni dalla scadenza il file c\'è ancora, e la scheda dice scaduto', [(await di(u)).certificato.conFile, f('statoFileCertificato', (await di(u)).certificato, '2026-09-26')], [true, 'scaduto_con_file'])
  const dopo = await di(v)
  ok('a 30 il file non c\'è più, la data sì', [dopo.certificato.conFile, dopo.certificato.scade, await s.apriCertificato(v)], [false, '2026-08-27', null])
  ok('e la scheda dice scaduto, file cancellato', f('statoFileCertificato', dopo.certificato, '2026-09-26'), 'scaduto_senza_file')
  OGGI += GIORNO
  try {
    ok('il giorno dopo se ne va anche quello di Ugo', [(await di(u)).certificato.conFile, (await di(u)).certificato.scade, await s.apriCertificato(u)], [false, '2026-08-28', null])
  } finally {
    OGGI -= GIORNO
  }
})

await sezione('4. la persona disattivata si lascia dietro il file', async () => {
  const l = await nuova('Lia', 'Lontana')
  await s.caricaCertificato(l, pdf(), '2027-01-31')
  await s.attivaPersona(l, false)
  let c = (await di(l)).certificato
  ok('disattivata: il file non c\'è più, la data resta', [c.conFile, c.scade, await s.apriCertificato(l)], [false, '2027-01-31', null])
  await s.attivaPersona(l, true)
  c = (await di(l)).certificato
  ok('riattivarla non lo riporta', [c.conFile, c.scade], [false, '2027-01-31'])
  const k = await nuova('Kira', 'Resta')
  await s.caricaCertificato(k, pdf(), '2027-01-31')
  await s.salvaPersona({ id: k, nome: 'Kira', cognome: 'Resta', telefono: '011 123456' })
  ok('cambiare un altro dato non lo tocca', (await di(k)).certificato.conFile, true)
})

await sezione('5. unendo due schede il file passa a chi resta', async () => {
  const resta = await nuova('Mario', 'Uno')
  const via = await nuova('Mario', 'Uno')
  await s.caricaCertificato(via, pdf(), '2027-01-31')
  await s.unisciPersone(resta, via)
  let c = (await di(resta)).certificato
  ok('l\'unione non si ferma più davanti al file', [c.conFile, c.scade, (await s.apriCertificato(resta))?.pdf], [true, '2027-01-31', true])
  ok('e il doppione non c\'è più', !!(await di(via)), false)

  // Un file ciascuno: resta quello della scadenza più lontana, e l'altro si cancella.
  const a = await nuova('Dino', 'Due')
  const b = await nuova('Dino', 'Due')
  await s.caricaCertificato(a, png(), '2026-12-31')
  await s.caricaCertificato(b, pdf(), '2027-03-31')
  await s.unisciPersone(a, b)
  c = (await di(a)).certificato
  ok('vince il file con la data più lontana, insieme alla sua data', [c.conFile, c.scade, (await s.apriCertificato(a))?.pdf], [true, '2027-03-31', true])

  const x = await nuova('Gea', 'Tre')
  const y = await nuova('Gea', 'Tre')
  await s.caricaCertificato(x, png(), '2027-06-30')
  await s.caricaCertificato(y, pdf(), '2027-01-31')
  await s.unisciPersone(x, y)
  c = (await di(x)).certificato
  ok('se è chi resta ad avere la data più lontana, tiene il suo', [c.conFile, c.scade, (await s.apriCertificato(x))?.pdf], [true, '2027-06-30', false])

  // La data è quella del certificato il cui file resta: una data più lontana senza file non la porta via.
  const k = await nuova('Eva', 'Quattro')
  const l = await nuova('Eva', 'Quattro')
  await s.caricaCertificato(k, pdf(), '2027-01-31')
  await s.salvaCertificato(l, '2028-01-31')
  await s.unisciPersone(k, l)
  c = (await di(k)).certificato
  ok('un file e una data più lontana senza file: resta il file, con la sua data', [c.conFile, c.scade], [true, '2027-01-31'])
})

await sezione('6. la richiesta accolta porta il certificato sulla scheda', async () => {
  const adulto = (cambi = {}) => ({
    nome: 'Luca', cognome: 'Rossi', natoIl: '1996-01-01', natoA: 'Torino', codiceFiscale: 'rsslcu96a01 l219k',
    indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'Luca@Esempio.it', telefono: '347 111 2233',
    corsi: ['judo-adulti'], formula: 'annuale', regolamento: true, ...cambi,
  })
  const luca = await r.invia(adulto())
  await r.caricaFile(luca, 'modulo', new File(['x'], 'modulo.pdf', { type: 'application/pdf' }))
  await r.caricaFile(luca, 'documento', new File(['x'], 'documento.jpg', { type: 'image/jpeg' }))
  await r.caricaFile(luca, 'certificato', pdf())
  ok('da stampare c\'è il documento: la richiesta è nella lista', [...(await r.conDocumento())], [luca])
  await r.eliminaFile(luca, 'documento')
  ok('stampato il documento, il certificato non tiene la richiesta in quella lista', (await r.conDocumento()).size, 0)
  ok('il certificato è ancora lì, e si può togliere solo lui', (await r.file(luca)).map((x) => x.tipo), ['modulo', 'certificato'])
  const id = await r.accogli(luca)
  const c = (await di(id)).certificato
  ok('accolta: il file è sulla scheda, senza data', [c.conFile, c.scade, !c.vecchio, c.caricatoIl], [true, undefined, true, '2026-09-26'])
  ok('la scheda dice che manca il certificato finché non c\'è la data', f('statoFileCertificato', c, '2026-09-26'), 'nessuno')
  ok('e il file si apre', (await s.apriCertificato(id))?.pdf, true)
  ok('dalla richiesta il certificato è uscito, il modulo resta', (await r.file(luca)).map((x) => x.tipo), ['modulo'])
  await s.salvaCertificato(id, '2027-09-01')
  ok('la segreteria scrive la data e il file resta', [(await di(id)).certificato.conFile, f('statoFileCertificato', (await di(id)).certificato, '2026-09-26')], [true, 'valido'])

  // Un file sbagliato si toglie prima di accogliere.
  const terzo = await r.invia(adulto({ nome: 'Terzo', codiceFiscale: 'RSSTRZ96A01L219A', email: 'terzo@esempio.it' }))
  await r.caricaFile(terzo, 'certificato', png())
  await r.eliminaFile(terzo, 'certificato')
  const idTerzo = await r.accogli(terzo)
  ok('tolto prima di accogliere: la scheda non ha niente', [(await di(idTerzo)).certificato.conFile, await s.apriCertificato(idTerzo)], [false, null])

  // Chi aveva già un certificato: quello nuovo prende il posto, la data non si tocca.
  const mario = await nuova('Mario', 'Verdi')
  await s.caricaCertificato(mario, png(), '2027-05-31')
  const quarto = await r.invia(adulto({ nome: 'Quarto', codiceFiscale: 'RSSQRT96A01L219R', email: 'quarto@esempio.it' }))
  await r.caricaFile(quarto, 'certificato', pdf())
  await r.accogli(quarto, mario)
  const cm = (await di(mario)).certificato
  ok('il file nuovo prende il posto del vecchio, la data resta quella scritta dalla segreteria', [cm.conFile, cm.scade, (await s.apriCertificato(mario))?.pdf], [true, '2027-05-31', true])
})

await sezione('6b. accogliere porta anche la data, in un passo solo', async () => {
  const adulto = (cambi = {}) => ({
    nome: 'Ada', cognome: 'Data', natoIl: '1996-01-01', natoA: 'Torino', codiceFiscale: 'DTADAA96A41L219X',
    indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'ada@esempio.it', telefono: '347 111 2233',
    corsi: ['judo-adulti'], formula: 'annuale', regolamento: true, ...cambi,
  })
  const accogli = (rich, dati, richiestaId, persona, scade) =>
    typeof m.richiesteLib.accogliConCertificato === 'function' ? m.richiesteLib.accogliConCertificato(rich, dati, richiestaId, persona, scade) : Promise.reject(new Error('manca la funzione accogliConCertificato'))
  const ada = await r.invia(adulto())
  await r.caricaFile(ada, 'certificato', pdf())
  const id = await accogli(r, s, ada, undefined, '2027-02-01')
  ok('accolta: il file e la data sono sulla scheda', [(await di(id)).certificato.conFile, (await di(id)).certificato.scade], [true, '2027-02-01'])
  const senzaData = await r.invia(adulto({ nome: 'Bea', codiceFiscale: 'DTABEA96A41L219D', email: 'bea@esempio.it' }))
  const idBea = await accogli(r, s, senzaData, undefined, '')
  ok('senza la data, accoglie lo stesso e la data non c\'è', (await di(idBea)).certificato.scade, undefined)
  const cia = await r.invia(adulto({ nome: 'Cia', codiceFiscale: 'DTACIA96A41L219O', email: 'cia@esempio.it' }))
  const rotta = { ...s, salvaCertificato: async () => { throw new Error('Non c’è rete: riprova quando torna') } }
  const e = await errore(() => accogli(r, rotta, cia, undefined, '2027-02-01'))
  ok('se la data non si salva lo dice, con la causa, e dice dove scriverla', [/accolta/.test(e), /Non c’è rete: riprova quando torna/.test(e), /scheda dell’iscritto/.test(e)], [true, true, true])
  ok('e la richiesta è accolta davvero: non si accoglie due volte', (await r.richieste()).find((x) => x.id === cia).stato, 'accolta')
  ok('mancano data e file: la richiesta dice cosa manca', [m.richiesteLib.problemiCertificato(true, ''), m.richiesteLib.problemiCertificato(true, '2027-02-01'), m.richiesteLib.problemiCertificato(false, '')], [['Manca la data del certificato.'], [], []])
})

// ---------------------------------------------------------------------------
// Il database finto: una catena che risponde a qualunque domanda, e uno Storage
// che si ricorda cosa gli è stato chiesto.
// ---------------------------------------------------------------------------
// Come Supabase: dalla seconda pagina (`.range()` oltre la prima) un elenco
// finto è finito. Senza, `tutteLeRighe` rileggerebbe le stesse righe per sempre.
const oltre = { then: (f, ko) => Promise.resolve({ data: [], error: null }).then(f, ko) }
const catena = (risposta, log = []) => {
  const c = new Proxy(function () {}, {
    get: (_, p) => (p === 'range' ? (da) => (da ? oltre : c) : p === 'then' ? (bene, male) => Promise.resolve(risposta()).then(bene, male) : (...a) => (log.push([p, JSON.stringify(a)]), c)),
    apply: () => c,
  })
  return c
}
const finto = ({ rpc = { data: null, error: null }, upload = { data: {}, error: null }, rimuovi, scheda = { certificato_file: 'P/certificato-1.pdf' } } = {}) => {
  const registro = []
  // Cosa si è chiesto alle tabelle (`from(t).update(…)`), a parte: il registro è dello Storage e delle funzioni.
  const tabelle = []
  const db = {
    from: (t) => catena(() => ({ data: t === 'schede_iscritti' ? scheda : null, error: null }), { push: (x) => tabelle.push([t, ...x]) }),
    rpc: async (nome, args) => (registro.push(['rpc', nome, JSON.stringify(args)]), rpc),
    storage: {
      from: (bucket) => ({
        upload: async (nome) => (registro.push(['upload', bucket, nome]), upload),
        remove: async (nomi) => (registro.push(['remove', bucket, ...nomi]), rimuovi ?? { data: nomi.map((name) => ({ name })), error: null }),
        list: async () => ({ data: [], error: null }),
        createSignedUrl: async (nome, secondi) => (registro.push(['link', bucket, nome, secondi]), { data: { signedUrl: 'https://esempio.it/firmato' }, error: null }),
      }),
    },
  }
  return { db, registro, tabelle, segreteria: m.creaSegreteriaSupabase(db) }
}
const P = 'aaaaaaaa-0000-0000-0000-000000000001'

await sezione('7. col database: il link dura dieci minuti al massimo', async () => {
  const { segreteria, registro } = finto()
  const aperto = await segreteria.apriCertificato(P)
  ok('si apre dal contenitore dei certificati, con un link che scade', [registro[0]?.[0], registro[0]?.[1], registro[0]?.[2], registro[0]?.[3] > 0 && registro[0]?.[3] <= 600], ['link', 'certificati', 'P/certificato-1.pdf', true])
  ok('ed è un PDF', aperto, { url: 'https://esempio.it/firmato', pdf: true })
  const senza = finto({ scheda: { certificato_file: null } })
  ok('senza file, niente da aprire', await senza.segreteria.apriCertificato(P), null)
})

await sezione('8. col database: prima il file, poi file e data in un passaggio solo', async () => {
  const { segreteria, registro } = finto()
  await segreteria.caricaCertificato(P, pdf(), '2028-01-31')
  ok('prima sale il file, nella cartella della persona', [registro[0]?.[0], registro[0]?.[1], new RegExp(`^${P}/certificato-\\d+\\.pdf$`).test(registro[0]?.[2] ?? '')], ['upload', 'certificati', true])
  ok('poi la funzione che mette file e data insieme', [registro[1]?.[0], registro[1]?.[1]], ['rpc', 'salva_certificato'])
  ok('col nome del file e la data', [registro[1]?.[2]?.includes(registro[0]?.[2] ?? 'x'), registro[1]?.[2]?.includes('2028-01-31')], [true, true])
  ok('e niente da rimettere a posto', registro.some((x) => x[0] === 'remove'), false)

  // Controlli prima di toccare la rete: il database finto non ha nemmeno lo Storage.
  const nudo = m.creaSegreteriaSupabase({})
  const troppo = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'grande.pdf', { type: 'application/pdf' })
  ok('più di 10 MB no, senza provarci', await errore(() => nudo.caricaCertificato(P, troppo, '2028-01-31')), 'Il file è troppo grande: al massimo 10 MB')
  ok('un tipo sbagliato no', await errore(() => nudo.caricaCertificato(P, new File(['x'], 'a.exe', { type: 'application/x-msdownload' }), '2028-01-31')), 'Questo tipo di file non va: serve una foto o un PDF')
  ok('senza la data no', await errore(() => nudo.caricaCertificato(P, pdf(), '')), 'Serve la data di scadenza del certificato')
  ok('una data troppo lontana no, senza provarci', await errore(() => nudo.caricaCertificato(P, pdf(), '2040-01-01')), 'La data è troppo lontana: controlla l\'anno.')
})

await sezione('9. col database non aggiornato l\'app non finge', async () => {
  const senzaFunzione = finto({ rpc: { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.salva_certificato(persona, file, scade) in the schema cache' } } })
  const msg = await errore(() => senzaFunzione.segreteria.caricaCertificato(P, pdf(), '2028-01-31'))
  ok('dice quale file lanciare', msg.includes('45-certificati-online.sql'), true)
  ok('senza il testo grezzo dell\'API', /PGRST|schema cache/.test(msg), false)
  const caricato = senzaFunzione.registro.find((x) => x[0] === 'upload')?.[2]
  ok('e il file salito non resta lì senza scheda', senzaFunzione.registro.find((x) => x[0] === 'remove'), ['remove', 'certificati', caricato])

  const senzaContenitore = finto({ upload: { data: null, error: { message: 'Bucket not found', statusCode: '404' } } })
  ok('senza contenitore dice lo stesso quale lanciare', (await errore(() => senzaContenitore.segreteria.caricaCertificato(P, pdf(), '2028-01-31'))).includes('45-certificati-online.sql'), true)

  const nonSiToglie = finto({ rpc: { data: null, error: { code: 'XX000', message: 'boom' } }, rimuovi: { data: null, error: { message: 'storage down' } } })
  const guasto = await errore(() => nonSiToglie.segreteria.caricaCertificato(P, pdf(), '2028-01-31'))
  ok('se anche togliere il file fallisce, dice di avvisare chi gestisce il database', /avvisa chi gestisce il database/.test(guasto), true)
  ok('… senza il testo grezzo', /boom|storage down/.test(guasto), false)
  const nessunoToglie = finto({ rpc: { data: null, error: { code: '42501', message: 'x' } }, rimuovi: { data: [], error: null } })
  ok('lo Storage che non toglie niente, senza dare errore, è lo stesso guaio', /avvisa chi gestisce il database/.test(await errore(() => nessunoToglie.segreteria.caricaCertificato(P, pdf(), '2028-01-31'))), true)

  const negato = finto({ rpc: { data: null, error: { code: '42501', message: 'solo la segreteria' } } })
  ok('senza il permesso dice di entrare come segreteria', await errore(() => negato.segreteria.caricaCertificato(P, pdf(), '2028-01-31')), 'Non hai il permesso: serve un accesso da segreteria')
  ok('e anche qui il file non resta', negato.registro.some((x) => x[0] === 'remove'), true)
})

await sezione('9b. togliere il certificato azzera anche il giorno di caricamento', async () => {
  const { segreteria, tabelle } = finto()
  await segreteria.togliCertificato(P)
  const update = tabelle.find((x) => x[0] === 'schede_iscritti' && x[1] === 'update')
  ok('data, file e giorno di caricamento a null', update && JSON.parse(update[2])[0], { certificato_scade: null, certificato_file: null, certificato_caricato_il: null })
})

await sezione('10. col database: file di prima e file nuovi si distinguono dalla data di caricamento', async () => {
  const riga = (scheda) => ({ id: P, nome: 'Rita', cognome: 'Prova', email: null, telefono: null, attiva: true, creata_il: '2026-01-01T00:00:00Z', iscrizioni: [], schede_iscritti: scheda })
  const persone = async (scheda) => {
    const db = {
      from: (t) => catena(() => (t === 'persone' ? { data: [riga(scheda)], error: null } : { data: [], error: null })),
      rpc: async () => ({ data: [], error: null }),
    }
    return (await m.creaSegreteriaSupabase(db).persone())[0].certificato
  }
  const base = { certificato_scade: '2027-03-14', pagamento: 'da_pagare', pagato_fino: null, pagamento_nota: null, documento_in_segreteria: false }
  const vecchio = await persone({ ...base, certificato_file: `${P}/certificato-1.pdf`, certificato_caricato_il: null })
  ok('senza data di caricamento è di prima della carta', [vecchio.conFile, vecchio.vecchio, f('certificatoDaStampare', vecchio)], [true, true, true])
  const nuovo = await persone({ ...base, certificato_file: `${P}/certificato-2.pdf`, certificato_caricato_il: '2026-09-10T08:00:00+00:00' })
  ok('con la data è nuovo, e ricorda quando', [nuovo.conFile, !nuovo.vecchio, nuovo.caricatoIl, f('certificatoDaStampare', nuovo)], [true, true, '2026-09-10', false])
  const senza = await persone({ ...base, certificato_file: null, certificato_caricato_il: null })
  ok('senza file niente di tutto questo', [senza.conFile, !senza.vecchio], [false, true])
})

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
