// ---------------------------------------------------------------------------
// I tab della pagina dell'iscritto, senza browser (`src/lib/areaTab.ts`).
//
//   node scripts/prova-area-tab.mjs
//
// Quattro tab (LEZIONI, DOCUMENTI, FAMIGLIA, CONTATTI), FAMIGLIA solo per il titolare; si apre
// su LEZIONI; la tastiera col giro; il segno su DOCUMENTI dice DA SISTEMARE
// quando certificato o quota non vanno (il peggiore vince).
// Canvas: docs/design-canvas/area-iscritti-tab.
// ---------------------------------------------------------------------------
process.env.TZ = 'Europe/Rome'

import { build } from 'esbuild'

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/areaTab'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const f = (nome, ...args) => (typeof m[nome] === 'function' ? m[nome](...args) : `manca ${nome}()`)

console.log('Quali tab')
ok('chi non è titolare: LEZIONI, DOCUMENTI e CONTATTI', f('tabArea', false), ['lezioni', 'regola', 'contatti'])
ok('il titolare: anche FAMIGLIA, prima di CONTATTI', f('tabArea', true), ['lezioni', 'regola', 'nucleo', 'contatti'])
ok('le etichette', ['lezioni', 'regola', 'nucleo', 'contatti'].map((t) => f('etichettaTab', t)), ['LEZIONI', 'DOCUMENTI', 'FAMIGLIA', 'CONTATTI'])
ok('si apre su LEZIONI', m.TAB_INIZIALE, 'lezioni')

console.log('La tastiera')
const tre = ['lezioni', 'regola', 'nucleo']
const quattro = [...tre, 'contatti']
ok('destra: avanti', f('tastoTabArea', tre, 'lezioni', { key: 'ArrowRight' }), 'regola')
ok('destra dall’ultimo: giro', f('tastoTabArea', tre, 'nucleo', { key: 'ArrowRight' }), 'lezioni')
ok('sinistra dal primo: giro', f('tastoTabArea', tre, 'lezioni', { key: 'ArrowLeft' }), 'nucleo')
ok('Home e Fine', [f('tastoTabArea', tre, 'regola', { key: 'Home' }), f('tastoTabArea', tre, 'regola', { key: 'End' })], ['lezioni', 'nucleo'])
ok('un altro tasto: niente', f('tastoTabArea', tre, 'regola', { key: 'a' }), null)
ok('con Alt, Ctrl o Cmd il tasto è del browser', [{ altKey: true }, { ctrlKey: true }, { metaKey: true }].map((m) => f('tastoTabArea', tre, 'regola', { key: 'ArrowLeft', ...m })), [null, null, null])
ok('senza modificatori la freccia vale', f('tastoTabArea', tre, 'regola', { key: 'ArrowLeft' }), 'lezioni')
ok('destra da FAMIGLIA: CONTATTI; da CONTATTI: giro', [f('tastoTabArea', quattro, 'nucleo', { key: 'ArrowRight' }), f('tastoTabArea', quattro, 'contatti', { key: 'ArrowRight' })], ['contatti', 'lezioni'])
ok('FAMIGLIA aperta ma non più titolare: si riparte da LEZIONI', f('tabAperto', ['lezioni', 'regola', 'contatti'], 'nucleo'), 'lezioni')
ok('CONTATTI resta aperto', f('tabAperto', quattro, 'contatti'), 'contatti')
ok('un tab che c\'è resta aperto', f('tabAperto', tre, 'nucleo'), 'nucleo')

console.log('Il segno su DOCUMENTI')
const s = (cert, paga) => f('segnoInRegola', cert, paga)
ok('tutto a posto: niente', s('valido', 'pagato'), null)
ok('sotto i 6 anni e pagato: niente', s('non_serve', 'pagato'), null)
ok('certificato scaduto: rosso', s('scaduto', 'pagato'), { parola: 'DA SISTEMARE', tono: 'rosso' })
ok('certificato che manca: rosso', s('manca', 'pagato'), { parola: 'DA SISTEMARE', tono: 'rosso' })
ok('certificato in scadenza: giallo', s('in_scadenza', 'pagato'), { parola: 'DA SISTEMARE', tono: 'giallo' })
ok('a 6 anni in arrivo: giallo', s('in_arrivo', 'pagato'), { parola: 'DA SISTEMARE', tono: 'giallo' })
ok('quota da pagare: rosso', s('valido', 'da_pagare'), { parola: 'DA SISTEMARE', tono: 'rosso' })
ok('quota scaduta: rosso', s('valido', 'scaduto'), { parola: 'DA SISTEMARE', tono: 'rosso' })
ok('quota pagata in parte: giallo', s('valido', 'in_parte'), { parola: 'DA SISTEMARE', tono: 'giallo' })
ok('il peggiore vince', s('in_scadenza', 'da_pagare'), { parola: 'DA SISTEMARE', tono: 'rosso' })

console.log('Il tab CONTATTI')
const g = f('gruppiContatti', { guida: '/guida/iscritti/', conEsci: true })
const C = { telefono: '346 329 2786', indirizzo: 'Via Vittorio Sassi 26, Collegno' }
ok('i gruppi, in ordine', Array.isArray(g) ? g.map((x) => x.titolo) : g, ['SEGRETERIA', 'SEGUICI', 'LA TUA PAGINA'])
const voci = (i) => (Array.isArray(g) ? g[i].voci.map((v) => v.nome) : g)
ok('SEGRETERIA: chiama, WhatsApp, come arrivare', voci(0), ['CHIAMA', 'WHATSAPP', 'COME ARRIVARE'])
ok('SEGUICI: Instagram e Facebook', voci(1), ['INSTAGRAM', 'FACEBOOK'])
ok('LA TUA PAGINA: guida ed esci', voci(2), ['GUIDA', 'ESCI'])
const href = (i, n) => (Array.isArray(g) ? g[i].voci[n].href : g)
ok('CHIAMA va al telefono della palestra', href(0, 0), 'tel:+393463292786')
ok('WHATSAPP allo stesso numero', href(0, 1), 'https://wa.me/393463292786')
ok('COME ARRIVARE alla mappa', href(0, 2), 'https://www.google.com/maps/dir/?api=1&destination=Via+Vittorio+Sassi+26,+10093+Collegno+TO')
ok('il numero e la via si leggono sulla riga', Array.isArray(g) ? [g[0].voci[0].nota, g[0].voci[2].nota] : g, [C.telefono, 'Via V. Sassi 26'])
ok('GUIDA va alla guida', href(2, 0), '/guida/iscritti/')
ok('ESCI non è un link: è un’azione', Array.isArray(g) ? [g[2].voci[1].href, g[2].voci[1].esci] : g, [undefined, true])
const senza = f('gruppiContatti', { guida: '/guida/iscritti/', conEsci: false })
ok('senza accesso vero (in prova) ESCI non c’è', Array.isArray(senza) ? senza[2].voci.map((v) => v.nome) : senza, ['GUIDA'])

console.log('La prossima lezione in evidenza')
const L = (id, inizio, stato = 'prevista') => ({ id, corso: 'Lotta', inizio, fine: inizio, stato, sostituto: false, altraSala: false, straordinaria: false })
const P = (id) => ({ sessioneId: id, inizio: '2026-10-20T17:00', corso: 'Lotta', stato: 'presente' })
const el = f('elencoLezioni', [L('a', '2026-10-27T17:00'), L('b', '2026-11-03T17:00'), L('c', '2026-11-10T17:00')])
ok('la prossima è la prima lezione', el.prossima?.id, 'a')
ok('le altre seguono in ordine, senza la prossima', el.seguenti?.map((l) => l.id), ['b', 'c'])
const ann = f('elencoLezioni', [L('a', '2026-10-27T17:00', 'annullata'), L('b', '2026-11-03T17:00')])
ok('una lezione annullata non è la prossima', ann.prossima?.id, 'b')
ok('l’annullata resta nell’elenco', ann.seguenti?.map((l) => l.id), ['a'])
const vuoto = f('elencoLezioni', [])
ok('senza lezioni non c’è la prossima', vuoto.prossima, null)
ok('cinque viste, e VEDI TUTTE solo se ce ne sono di più', [f('lezioniViste', [1, 2, 3, 4, 5], false).piu, f('lezioniViste', [1, 2, 3, 4, 5, 6], false)], [false, { viste: [1, 2, 3, 4, 5], piu: true }])
ok('VEDI TUTTE le mostra tutte', f('lezioniViste', [1, 2, 3, 4, 5, 6], true).viste.length, 6)
ok('una annullata al singolare', f('contoAnnullate', 1), '1 ANNULLATA')
ok('più annullate al plurale', f('contoAnnullate', 2), '2 ANNULLATE')
const adesso = new Date('2026-10-23T13:57:00')
ok('oggi', f('fraQuanto', '2026-10-23T18:00', adesso), 'OGGI')
ok('domani', f('fraQuanto', '2026-10-24T09:00', adesso), 'DOMANI')
ok('fra quattro giorni', f('fraQuanto', '2026-10-27T17:00', adesso), 'FRA 4 GIORNI')

console.log('Cosa cambia in una lezione')
const LC = (extra) => ({ ...L('x', '2026-10-27T17:00'), ...extra })
ok('una lezione come al solito: niente', f('cosaCambia', LC({})), null)
ok('annullata', f('cosaCambia', LC({ stato: 'annullata' })), { testo: 'ANNULLATA', frase: 'Annullata', tono: 'guaio', icona: 'annullata' })
ok('annullata vince su tutto', f('cosaCambia', LC({ stato: 'annullata', sostituto: true })).testo, 'ANNULLATA')
ok('sostituto', f('cosaCambia', LC({ sostituto: true })), { testo: 'SOSTITUTO', frase: 'Sostituto', tono: 'avviso', icona: 'sostituto' })
ok('in più', f('cosaCambia', LC({ straordinaria: true })), { testo: 'IN PIÙ', frase: 'In più', tono: 'avviso', icona: 'piu' })
ok('altra sala', f('cosaCambia', LC({ altraSala: true, sala: 'Sala 2' })), { testo: 'IN SALA 2', frase: 'In sala 2', tono: 'avviso', icona: 'sala' })
ok('più cose: l’icona è della prima', f('cosaCambia', LC({ straordinaria: true, sostituto: true })), { testo: 'IN PIÙ · SOSTITUTO', frase: 'In più · sostituto', tono: 'avviso', icona: 'piu' })

console.log('La riga sotto il corso')
const I = (extra) => LC({ istruttore: 'Maurizio', ...extra })
ok('istruttore e giorno, l’icona è dell’istruttore', f('sottoLezione', I({})), { pezzi: ['Maurizio', 'martedì 27 ottobre'], icona: 'istruttore' })
ok('senza istruttore: solo il giorno, icona del giorno', f('sottoLezione', LC({})), { pezzi: ['martedì 27 ottobre'], icona: 'giorno' })
ok('la sala non c’è: sta in cosa cambia', f('sottoLezione', I({ sala: 'Sala 1', altraSala: true })).pezzi, ['Maurizio', 'martedì 27 ottobre'])

console.log('Le ultime presenze in cima')
const PP = ['a', 'b', 'c', 'd', 'e'].map(P)
ok('le prime tre, dalla più recente', f('ultimePresenze', PP).map((p) => p.sessioneId), ['a', 'b', 'c'])
ok('meno di tre: tutte', f('ultimePresenze', PP.slice(0, 2)).length, 2)

console.log('La data breve dei box')
ok('mer 21 ott', f('quandoBreve', '2026-10-21T17:00'), 'mer 21 ott')
ok('lun 1 giu', f('quandoBreve', '2026-06-01T09:00'), 'lun 1 giu')

console.log('Il segno di una presenza')
ok('presente', f('segnoPresenza', 'presente'), { icona: 'presente', parola: 'PRESENTE', tono: 'fatto' })
ok('assente', f('segnoPresenza', 'assente'), { icona: 'assente', parola: 'ASSENTE', tono: 'guaio' })
ok('giustificato', f('segnoPresenza', 'giustificato'), { icona: 'giustificato', parola: 'GIUSTIFICATO', tono: 'spento' })
ok('non segnato', f('segnoPresenza', null), { icona: 'niente', parola: 'NON SEGNATO', tono: 'spento' })
ok('segnalata da confermare prende il posto della parola', f('segnoPresenza', 'assente', 'da_vedere'), { icona: 'assente', parola: 'DA CONFERMARE', tono: 'avviso' })
ok('segnalata rifiutata', f('segnoPresenza', null, 'rifiutata'), { icona: 'niente', parola: 'RIFIUTATA', tono: 'guaio' })
ok('segnalata accolta: vale lo stato', f('segnoPresenza', 'presente', 'accolta').parola, 'PRESENTE')

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)

console.log('Chi può segnalare')
ok('non segnato sì, assente sì', [f('puoSegnalare', null), f('puoSegnalare', 'assente')], [true, true])
ok('presente e giustificato no', [f('puoSegnalare', 'presente'), f('puoSegnalare', 'giustificato')], [false, false])
ok('già segnalata no', f('puoSegnalare', 'assente', 'da_vedere'), false)
ok('le ultime tre sono le più recenti anche se l’ordine non lo è', f('ultimePresenze', [P('a'), { ...P('b'), inizio: '2026-10-22T17:00' }, { ...P('c'), inizio: '2026-10-19T17:00' }, { ...P('d'), inizio: '2026-10-21T17:00' }]).map((x) => x.sessioneId), ['b', 'd', 'a'])
ok('altra sala senza nome: niente «undefined»', f('cosaCambia', { ...L('a', '2026-10-27T17:00'), altraSala: true })?.testo, 'IN UN’ALTRA SALA')
ok('la frase è in minuscolo dopo la prima', f('cosaCambia', { ...L('a', '2026-10-27T17:00'), sostituto: true, straordinaria: true })?.frase, 'In più · sostituto')
