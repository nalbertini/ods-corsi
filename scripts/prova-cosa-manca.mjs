// ---------------------------------------------------------------------------
// Le prove, senza browser: la striscia COSA MANCA in cima alle pagine della
// segreteria (appelli non fatti, certificati scaduti, pagamenti, richieste).
//
//   node scripts/prova-cosa-manca.mjs
//
// Regola di fondo: un conto che non si sa (null) non è mai 0 né verde. «A posto»
// detto per errore è peggio di «non so». Se una lettura fallisce dopo una
// riuscita si tiene l'ultimo numero e lo si segna vecchio, con l'orario.
// ---------------------------------------------------------------------------
// L'orario del conto si scrive in ora locale: come le altre prove, Europe/Rome.
process.env.TZ = 'Europe/Rome'

import { build } from 'esbuild'

// La segreteria di prova (dati veri dell'archivio) vuole un localStorage e una
// window: come le altre prove, finti e in memoria.
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/cosaManca'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { senzaCertificatoValido, comePaga } from './src/lib/segreteria'", resolveDir: '.', loader: 'ts' },
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

// Quattro numeri in fila come prima; le tessere, la quinta casella, a posto salvo `extra`.
const conti = (appelli, certificati, pagamenti, richieste, extra = {}) => ({
  appelli, certificati, pagamenti, tessere: 0, richieste, contato: true, ...extra,
})
// Un solo conto alla volta, gli altri a posto.
const solo = (id, n, extra) =>
  id === 'tessere'
    ? conti(0, 0, 0, 0, { tessere: n, ...extra })
    : conti(...['appelli', 'certificati', 'pagamenti', 'richieste'].map((k) => (k === id ? n : 0)), extra)
const casella = (id, n, extra) => m.caselleCosaManca(solo(id, n, extra)).find((x) => x.id === id)
const ID = ['appelli', 'certificati', 'pagamenti', 'tessere', 'richieste']
// 08:32 UTC del 16 ottobre 2026: in Italia (ora legale) sono le 10:32.
const alle1032 = Date.UTC(2026, 9, 16, 8, 32)

console.log('Le caselle')
ok('CASELLE: sei, «corsi» subito dopo «pagamenti»', m.CASELLE, ['appelli', 'certificati', 'pagamenti', 'corsi', 'tessere', 'richieste'])
ok('caselleCosaManca: senza il conto dei corsi (lettura delle ricevute fallita) la casella non c\'è', m.caselleCosaManca(conti(1, 2, 3, 4)).map((x) => x.id), ID)
ok('caselleCosaManca: col conto dei corsi sono sei, nell\'ordine di CASELLE', m.caselleCosaManca(conti(1, 2, 3, 4, { corsi: 5 })).map((x) => x.id), m.CASELLE)
ok('i titoli', m.caselleCosaManca(conti(1, 2, 3, 4)).map((x) => x.titolo), ['Appelli non fatti', 'Certificati scaduti', 'Pagamenti', 'Senza tessera', 'Richieste online'])
ok('titolo di «corsi»', m.caselleCosaManca(conti(1, 2, 3, 4, { corsi: 5 })).find((x) => x.id === 'corsi')?.titolo, 'Corsi scaduti')
ok('GIORNI_APPELLI è 30, SECONDI_RILETTURA è 120', [m.GIORNI_APPELLI, m.SECONDI_RILETTURA], [30, 120])

console.log('\nNumero e stato')
for (const id of ID) {
  const manca = id === 'richieste' ? 'attesa' : 'manca'
  ok(`${id}: 0 → «✓ 0», a posto`, [casella(id, 0).numero, casella(id, 0).stato], ['✓ 0', 'aposto'])
  ok(`${id}: 1 → «1», ${manca}`, [casella(id, 1).numero, casella(id, 1).stato], ['1', manca])
  ok(`${id}: 12 → «12», ${manca}`, [casella(id, 12).numero, casella(id, 12).stato], ['12', manca])
  for (const contato of [true, false]) {
    const c = casella(id, null, { contato })
    ok(`${id}: non si sa (contato ${contato}) → «—», non so`, [c.numero, c.stato, c.n], ['—', 'nonso', null])
    ok(`${id}: non si sa (contato ${contato}) non è mai 0 né a posto`, [c.numero.includes('0'), c.stato === 'aposto', c.nome.includes('a posto')], [false, false, false])
  }
  ok(`statoDi(${id}): null, 0, 5`, [m.statoDi(id, null), m.statoDi(id, 0), m.statoDi(id, 5)], ['nonso', 'aposto', manca])
}

console.log('\nLe note')
ok('appelli: senza appello, ultimi 30 giorni', casella('appelli', 3).nota, 'senza appello, ultimi 30 giorni')
ok('certificati: scaduti o mancanti', casella('certificati', 3).nota, 'scaduti o mancanti')
ok('pagamenti: quote non in regola', casella('pagamenti', 3).nota, 'quote non in regola')
ok('richieste: da accogliere', casella('richieste', 3).nota, 'da accogliere')
ok('la nota resta anche a zero', ID.map((id) => casella(id, 0).nota), ['senza appello, ultimi 30 giorni', 'scaduti o mancanti', 'quote non in regola', 'senza tessera valida', 'da accogliere'])
ok('la nota degli appelli porta i giorni di GIORNI_APPELLI', casella('appelli', 3).nota.includes(String(m.GIORNI_APPELLI)), true)
ok('prima lettura: nota «conto…»', ID.map((id) => casella(id, null, { contato: false }).nota), ['conto…', 'conto…', 'conto…', 'conto…', 'conto…'])
ok('lettura fallita: nota «non so: riconta»', ID.map((id) => casella(id, null, { contato: true }).nota), ['non so: riconta', 'non so: riconta', 'non so: riconta', 'non so: riconta', 'non so: riconta'])
ok('conto vecchio con orario: «conto delle 10:32»', casella('pagamenti', 4, { vecchio: true, aggiornato: alle1032 }).nota, 'conto delle 10:32')
ok('conto vecchio con orario, anche a zero', casella('pagamenti', 0, { vecchio: true, aggiornato: alle1032 }).nota, 'conto delle 10:32')
ok('conto vecchio senza orario: «conto vecchio»', casella('pagamenti', 4, { vecchio: true }).nota, 'conto vecchio')
ok('conto vecchio ma un conto null: vale la nota del null', casella('pagamenti', null, { vecchio: true, aggiornato: alle1032 }).nota, 'non so: riconta')
ok('non vecchio: la nota è quella normale anche con aggiornato', casella('pagamenti', 4, { vecchio: false, aggiornato: alle1032 }).nota, 'quote non in regola')
ok('il numero del conto vecchio resta quello di prima', casella('pagamenti', 4, { vecchio: true, aggiornato: alle1032 }).numero, '4')

console.log('\nLa nota fissa e gli avvisi sul conto')
ok('con un numero buono la nota è quella di sempre (nascondibile)', ID.map((id) => casella(id, 3, { contato: true }).notaFissa), [true, true, true, true, true])
ok('conto vecchio o numero non noto: la nota è un avviso, si vede sempre', [casella('appelli', 3, { vecchio: true, aggiornato: alle1032 }).notaFissa, casella('appelli', null, { contato: true }).notaFissa], [false, false])
ok('il nome per lo screen reader comincia col titolo che si legge', ID.map((id) => casella(id, 3, { contato: true }).nome.toLowerCase().includes(casella(id, 3, { contato: true }).titolo.toLowerCase().split(' ')[0])), [true, true, true, true, true])

console.log('\nIl nome per chi usa lo screen reader')
const nomi = (n, contato = true) => ID.map((id) => casella(id, n, { contato }).nome)
// WCAG 2.5.3: il testo che si vede (titolo e nota) sta dentro il nome, se no chi detta i comandi a voce non la nomina giusta.
ok('uno', nomi(1), [
  '1 Appelli non fatti, senza appello, ultimi 30 giorni',
  '1 Certificati scaduti, scaduti o mancanti',
  '1 Pagamenti, quote non in regola',
  '1 Senza tessera, senza tessera valida',
  '1 Richieste online, da accogliere',
])
ok('più di uno', nomi(7), [
  '7 Appelli non fatti, senza appello, ultimi 30 giorni',
  '7 Certificati scaduti, scaduti o mancanti',
  '7 Pagamenti, quote non in regola',
  '7 Senza tessera, senza tessera valida',
  '7 Richieste online, da accogliere',
])
ok('zero', nomi(0), [
  'Appelli non fatti, senza appello, ultimi 30 giorni: nessuno, a posto',
  'Certificati scaduti, scaduti o mancanti: nessuno, a posto',
  'Pagamenti, quote non in regola: nessuno, a posto',
  'Senza tessera, senza tessera valida: nessuno, a posto',
  'Richieste online, da accogliere: nessuno, a posto',
])
ok('il nome contiene sempre il titolo e, con un conto buono, la nota che si vedono', ID.flatMap((id) => [1, 7, 0].map((n) => {
  const c = casella(id, n, { contato: true })
  const nome = c.nome.toLowerCase()
  return nome.includes(c.titolo.toLowerCase()) && nome.includes(c.nota.toLowerCase())
})), ID.flatMap(() => [true, true, true]))
ok('non so', nomi(null), [
  'Appelli non fatti: non so, non si è riusciti a contare',
  'Certificati scaduti: non so, non si è riusciti a contare',
  'Pagamenti: non so, non si è riusciti a contare',
  'Senza tessera: non so, non si è riusciti a contare',
  'Richieste online: non so, non si è riusciti a contare',
])
ok('sto contando', nomi(null, false), [
  'Appelli non fatti: sto contando',
  'Certificati scaduti: sto contando',
  'Pagamenti: sto contando',
  'Senza tessera: sto contando',
  'Richieste online: sto contando',
])

console.log('\nDove porta un tocco')
ok('destinazioni', m.caselleCosaManca(conti(1, 1, 1, 1)).map((x) => [x.voce, x.filtro]), [
  ['presenze', 'senza-appello'],
  ['iscritti', 'certificato'],
  ['iscritti', 'pagare'],
  ['iscritti', 'senza-tessera'],
  ['richieste', undefined],
])
ok('richieste: nessun filtro', 'filtro' in casella('richieste', 1) && casella('richieste', 1).filtro !== undefined, false)

console.log('\nLa casella «Corsi scaduti»')
{
  const conCorsi = (n, extra) => m.caselleCosaManca({ ...conti(0, 0, 0, 0), corsi: n, ...extra }).find((x) => x.id === 'corsi')
  ok('0 → «✓ 0», a posto', [conCorsi(0)?.numero, conCorsi(0)?.stato], ['✓ 0', 'aposto'])
  ok('3 → «3», manca', [conCorsi(3)?.numero, conCorsi(3)?.stato], ['3', 'manca'])
  ok('non si sa (null) → «—», non so, mai a posto', [conCorsi(null)?.numero, conCorsi(null)?.stato, conCorsi(null)?.n], ['—', 'nonso', null])
  ok('la nota', conCorsi(3)?.nota, 'trimestre o annuale finito')
  ok('i nomi per lo screen reader', [conCorsi(0)?.nome, conCorsi(1)?.nome, conCorsi(7)?.nome], ['Corsi scaduti, trimestre o annuale finito: nessuno, a posto', '1 Corsi scaduti, trimestre o annuale finito', '7 Corsi scaduti, trimestre o annuale finito'])
  ok('dove porta un tocco', [conCorsi(1)?.voce, conCorsi(1)?.filtro], ['iscritti', 'corsi-scaduti'])
  ok('annuncio: da 2 a 5', m.annuncioCambio(conti(0, 0, 0, 0, { corsi: 2 }), conti(0, 0, 0, 0, { corsi: 5 })), 'Corsi scaduti: 5')
  ok('annuncio: dopo «Pagamenti», prima di «Richieste online»', m.annuncioCambio(conti(0, 0, 1, 1, { corsi: 2 }), conti(0, 0, 2, 2, { corsi: 5 })), 'Pagamenti: 2. Corsi scaduti: 5. Richieste online: 2')
  ok('annuncio: il conto dei corsi che compare dopo la prima lettura non si annuncia', m.annuncioCambio(conti(0, 0, 0, 0), conti(0, 0, 0, 0, { corsi: 5 })), null)
  ok('annuncio: un conto null non si annuncia', m.annuncioCambio(conti(0, 0, 0, 0, { corsi: 2 }), conti(0, 0, 0, 0, { corsi: null })), null)
  const prima = conti(1, 2, 3, 4, { aggiornato: 1000, vecchio: false, corsi: 2 })
  const letti = { appelli: 1, certificati: 2, pagamenti: 3, tessere: 0, richieste: 4 }
  ok('mantieniIPrecedenti: un numero nuovo dei corsi lo prende', m.mantieniIPrecedenti(prima, { ...letti, corsi: 6 }, 5000).corsi, 6)
  const fallita = m.mantieniIPrecedenti(prima, { ...letti, corsi: null }, 5000)
  ok('mantieniIPrecedenti: corsi fallito dopo un successo: tiene il 2 e il conto è vecchio', [fallita.corsi, fallita.vecchio], [2, true])
  ok('mantieniIPrecedenti: senza lettura dei corsi la casella resta assente', 'corsi' in m.mantieniIPrecedenti(conti(1, 2, 3, 4), letti, 5000) && m.mantieniIPrecedenti(conti(1, 2, 3, 4), letti, 5000).corsi !== undefined, false)
  ok('contiDellaStriscia: restituisce il conto dei corsi', [4, 0, null].map((corsi) => m.contiDellaStriscia({ persone: [], lezioni: [], richieste: 0, corsi }, Date.UTC(2026, 9, 16, 8, 32), '2026-10-16').corsi), [4, 0, null])
  ok('contiDellaStriscia: senza il campo, non c\'è (non diventa null né 0)', m.contiDellaStriscia({ persone: [], lezioni: [], richieste: 0 }, Date.UTC(2026, 9, 16, 8, 32), '2026-10-16').corsi, undefined)
}

console.log('\nL\'annuncio quando un conto cambia')
ok('due → tre richieste', m.annuncioCambio(conti(0, 0, 0, 2), conti(0, 0, 0, 3)), 'Richieste online: 3')
ok('niente è cambiato → niente da dire', m.annuncioCambio(conti(1, 2, 3, 4), conti(1, 2, 3, 4)), null)
ok('prima lettura (prima non contato) → niente da dire', m.annuncioCambio(conti(null, null, null, null, { contato: false, tessere: null }), conti(1, 2, 3, 4)), null)
ok('un conto null dopo → niente da dire', m.annuncioCambio(conti(1, 2, 3, 4), conti(1, 2, 3, null)), null)
ok('un conto null prima → niente da dire', m.annuncioCambio(conti(1, 2, 3, null), conti(1, 2, 3, 4)), null)
ok('due conti insieme, nell\'ordine delle caselle', m.annuncioCambio(conti(1, 2, 3, 4), conti(1, 5, 3, 9)), 'Certificati scaduti: 5. Richieste online: 9')
ok('tutti e quattro, con i titoli normali', m.annuncioCambio(conti(1, 1, 1, 1), conti(2, 3, 4, 5)), 'Appelli non fatti: 2. Certificati scaduti: 3. Pagamenti: 4. Richieste online: 5')
ok('scende a 0', m.annuncioCambio(conti(0, 0, 2, 0), conti(0, 0, 0, 0)), 'Pagamenti: 0')

console.log('\nQuando rileggere i conti')
const ora = 10_000_000
ok('avvio: sempre', m.contiDaRileggere(ora, ora, 'avvio'), true)
ok('cambiato: sempre', m.contiDaRileggere(ora, ora, 'cambiato'), true)
ok('riprova: sempre', m.contiDaRileggere(ora, ora, 'riprova'), true)
ok('avvio, cambiato, riprova anche senza lettura prima', ['avvio', 'cambiato', 'riprova'].map((x) => m.contiDaRileggere(undefined, ora, x)), [true, true, true])
ok('voce: mai letto → sì', m.contiDaRileggere(undefined, ora, 'voce'), true)
ok('voce: 0 secondi fa → no', m.contiDaRileggere(ora, ora, 'voce'), false)
ok('voce: 119 secondi fa → no', m.contiDaRileggere(ora - 119_000, ora, 'voce'), false)
ok('voce: 120 secondi fa → sì', m.contiDaRileggere(ora - 120_000, ora, 'voce'), true)
ok('voce: 121 secondi fa → sì', m.contiDaRileggere(ora - 121_000, ora, 'voce'), true)

console.log('\nQuando la striscia si vede')
ok('DA FARE: mai (ha già gli stessi conti), neanche sul computer', [m.strisciaVisibile('dafare', false, false), m.strisciaVisibile('dafare', false, true)], [false, false])
ok('DA FARE: mai, neanche sul telefono', [m.strisciaVisibile('dafare', true, false), m.strisciaVisibile('dafare', true, true)], [false, false])
ok('telefono con scheda o modulo aperto: nascosta', m.strisciaVisibile('iscritti', true, true), false)
ok('computer con scheda aperta: visibile', m.strisciaVisibile('iscritti', false, true), true)
ok('telefono senza scheda: visibile', m.strisciaVisibile('iscritti', true, false), true)
ok('le altre voci sul computer: visibile', ['presenze', 'iscritti', 'richieste', 'pagamenti', 'corsi'].map((v) => m.strisciaVisibile(v, false, false)), [true, true, true, true, true])

console.log('\nUnire una lettura ai conti di prima')
{
  const prima = conti(1, 2, 3, 4, { aggiornato: 1000, vecchio: false })
  const copia = JSON.parse(JSON.stringify(prima))
  const dopo = m.mantieniIPrecedenti(prima, { appelli: 5, certificati: 6, pagamenti: 7, tessere: 0, richieste: 8 }, 5000)
  ok('tutti numeri: li prende, aggiornato = ora, non vecchio', dopo, conti(5, 6, 7, 8, { aggiornato: 5000, vecchio: false }))
  ok('non muta l\'ingresso', prima, copia)

  const fallita = m.mantieniIPrecedenti(prima, { appelli: null, certificati: 6, pagamenti: null, tessere: 0, richieste: 8 }, 5000)
  ok('fallito dopo un successo: tiene il numero di prima', [fallita.appelli, fallita.pagamenti], [1, 3])
  ok('i numeri nuovi li prende', [fallita.certificati, fallita.richieste], [6, 8])
  ok('è vecchio e contato', [fallita.vecchio, fallita.contato], [true, true])
  ok('aggiornato resta quello di prima', fallita.aggiornato, 1000)

  const primaLettura = conti(null, null, null, null, { contato: false, tessere: null })
  const copia2 = JSON.parse(JSON.stringify(primaLettura))
  const mai = m.mantieniIPrecedenti(primaLettura, { appelli: null, certificati: null, pagamenti: null, tessere: null, richieste: null }, 5000)
  ok('mai un numero e fallita: resta null, ma contato', [mai.appelli, mai.certificati, mai.pagamenti, mai.richieste, mai.contato], [null, null, null, null, true])
  ok('mai un numero: nessuna casella è a posto', m.caselleCosaManca(mai).map((x) => x.stato), ['nonso', 'nonso', 'nonso', 'nonso', 'nonso'])
  ok('non muta nemmeno la prima lettura', primaLettura, copia2)

  const meta = m.mantieniIPrecedenti(primaLettura, { appelli: 3, certificati: null, pagamenti: 0, tessere: null, richieste: null }, 5000)
  ok('prima lettura a metà: i numeri sì, gli altri null', [meta.appelli, meta.certificati, meta.pagamenti, meta.richieste], [3, null, 0, null])
  ok('prima lettura a metà: aggiornato = ora', meta.aggiornato, 5000)

  const ripresa = m.mantieniIPrecedenti(fallita, { appelli: 2, certificati: 6, pagamenti: 3, tessere: 0, richieste: 8 }, 9000)
  ok('una lettura riuscita toglie il «vecchio»', [ripresa.vecchio, ripresa.aggiornato], [false, 9000])
}

console.log('\nI cinque conti, da dati finti')
{
  const oggi = '2026-10-16'
  const adesso = Date.UTC(2026, 9, 16, 8, 32)
  // I filtri di ISCRITTI, scritti qui come riferimento: la striscia deve dire lo stesso numero della lista che si apre.
  const filtroCertificato = (persone) => persone.filter((p) => p.attiva && m.senzaCertificatoValido(p, oggi)).length
  const filtroPagare = (persone) => persone.filter((p) => p.attiva && m.comePaga(p, oggi) !== 'pagato').length

  let n = 0
  const persona = (extra = {}) => ({
    id: `p${++n}`, nome: 'N', cognome: 'C', attiva: true, creataIl: '2026-01-01', iscrizioni: [], documento: true,
    natoIl: '2000-01-01',
    certificato: { scade: '2027-06-01', conFile: false },
    pagamento: { stato: 'pagato' },
    ...extra,
  })
  const valido = { scade: '2027-06-01', conFile: false }
  const scaduto = { scade: '2026-01-01', conFile: false }
  const manca = { conFile: false }
  const daPagare = { stato: 'da_pagare' }
  const persone = [
    persona(), // in regola su tutto
    persona({ certificato: scaduto }),
    persona({ certificato: manca }),
    persona({ natoIl: '2024-01-01', certificato: manca }), // sotto i 6 anni: il certificato non serve
    persona({ pagamento: daPagare }),
    persona({ pagamento: { stato: 'pagato', fino: '2026-06-30' } }), // pagato fino a una data passata: non vale più
    persona({ certificato: scaduto, pagamento: daPagare }), // tutti e due i guai: conta in tutti e due
    // Archiviati: hanno tutti i guai ma non devono contare.
    persona({ attiva: false, certificato: scaduto, pagamento: daPagare }),
    persona({ attiva: false, certificato: manca, pagamento: daPagare }),
  ]
  const copiaPersone = JSON.parse(JSON.stringify(persone))

  ok('certificatiDaSistemare: come il filtro CERTIFICATO di ISCRITTI', m.certificatiDaSistemare(persone, oggi), filtroCertificato(persone))
  ok('pagamentiNonInRegola: come il filtro DA PAGARE di ISCRITTI', m.pagamentiNonInRegola(persone, oggi), filtroPagare(persone))
  // I numeri a mano, perché il riferimento da solo non basta se sbaglia anche lui.
  ok('certificati: scaduto, mancante, e quello con tutti e due i guai; il sotto i 6 anni e gli archiviati no', m.certificatiDaSistemare(persone, oggi), 3)
  ok('pagamenti: da pagare, pagato scaduto e quello con tutti e due i guai; gli archiviati no', m.pagamentiNonInRegola(persone, oggi), 3)
  ok('gli archiviati non contano: senza di loro il numero è lo stesso', [m.certificatiDaSistemare(persone.filter((p) => p.attiva), oggi), m.pagamentiNonInRegola(persone.filter((p) => p.attiva), oggi)], [3, 3])
  ok('solo archiviati: 0 e 0', [m.certificatiDaSistemare(persone.filter((p) => !p.attiva), oggi), m.pagamentiNonInRegola(persone.filter((p) => !p.attiva), oggi)], [0, 0])
  ok('un certificato che scade domani è ancora valido', m.certificatiDaSistemare([persona({ certificato: { scade: '2026-10-17', conFile: false } })], oggi), 0)
  ok('un certificato scaduto ieri conta', m.certificatiDaSistemare([persona({ certificato: { scade: '2026-10-15', conFile: false } })], oggi), 1)
  ok('non muta l\'ingresso', persone, copiaPersone)
  // Il genitore non iscritto c'è per i figli: come nei chip di ISCRITTI, niente certificato né quota da chiedergli.
  const genitore = persona({ genitoreNonIscritto: true, certificato: manca, pagamento: daPagare })
  ok('il genitore non iscritto non conta fra i certificati né fra i pagamenti', [m.certificatiDaSistemare([genitore], oggi), m.pagamentiNonInRegola([genitore], oggi)], [0, 0])

  const lezione = (id, inizio, fine, extra = {}) => ({
    id, corsoId: 'c', corso: 'C', istruttori: 'I', inizio, fine, stato: 'programmata', straordinaria: false, iscritti: 10, presenti: 0, segnati: 0, ...extra,
  })
  // `adesso` = 10:32 UTC+0 di oggi: le ISO sono in UTC (Z) per non dipendere dal fuso.
  const lezioni = [
    lezione('vecchia', '2026-10-10T16:00:00Z', '2026-10-10T17:00:00Z'),
    lezione('ieri', '2026-10-15T16:00:00Z', '2026-10-15T17:00:00Z'),
    lezione('oggiFinita', '2026-10-16T06:00:00Z', '2026-10-16T07:00:00Z'),
    lezione('inCorso', '2026-10-16T08:00:00Z', '2026-10-16T09:00:00Z'),
    lezione('futura', '2026-10-16T16:00:00Z', '2026-10-16T17:00:00Z'),
    lezione('annullata', '2026-10-14T16:00:00Z', '2026-10-14T17:00:00Z', { stato: 'annullata' }),
    lezione('conUnSegno', '2026-10-13T16:00:00Z', '2026-10-13T17:00:00Z', { segnati: 1, presenti: 1 }),
    lezione('conAssenti', '2026-10-12T16:00:00Z', '2026-10-12T17:00:00Z', { segnati: 4, presenti: 0 }),
  ]
  const copiaLezioni = JSON.parse(JSON.stringify(lezioni))
  const senza = m.appelliSenzaSegni(lezioni, adesso)
  ok('appelliSenzaSegni: solo le finite, non annullate, senza segni, dalla più recente', senza.map((l) => l.id), ['oggiFinita', 'ieri', 'vecchia'])
  ok('una lezione in corso non conta', senza.some((l) => l.id === 'inCorso'), false)
  ok('una lezione futura non conta', senza.some((l) => l.id === 'futura'), false)
  ok('una annullata non conta', senza.some((l) => l.id === 'annullata'), false)
  ok('una finita con un segno (anche solo assenti) non conta', senza.some((l) => l.id === 'conUnSegno' || l.id === 'conAssenti'), false)
  ok('finisce proprio adesso: non è ancora finita', m.appelliSenzaSegni([lezione('x', '2026-10-16T07:32:00Z', '2026-10-16T08:32:00Z')], adesso).length, 0)
  ok('finita un attimo fa: conta', m.appelliSenzaSegni([lezione('x', '2026-10-16T07:31:00Z', '2026-10-16T08:31:59Z')], adesso).length, 1)
  ok('nessuna lezione: nessun appello', m.appelliSenzaSegni([], adesso), [])
  ok('non muta l\'ingresso (l\'ordine resta quello di prima)', lezioni, copiaLezioni)

  const conRichieste = (letti) => m.contiDellaStriscia(letti, adesso, oggi)
  ok('tutto letto: i conti (le tessere non lette sono null, mai 0)', conRichieste({ persone, lezioni, richieste: 2 }), { appelli: 3, certificati: 3, pagamenti: 3, tessere: null, richieste: 2 })
  ok('liste vuote (non null): 0 ovunque', conRichieste({ persone: [], lezioni: [], richieste: 0 }), { appelli: 0, certificati: 0, pagamenti: 0, tessere: null, richieste: 0 })
  ok('persone mancanti: certificati e pagamenti null, mai 0; il resto invariato', conRichieste({ persone: null, lezioni, richieste: 2 }), { appelli: 3, certificati: null, pagamenti: null, tessere: null, richieste: 2 })
  ok('lezioni mancanti: solo appelli null', conRichieste({ persone, lezioni: null, richieste: 2 }), { appelli: null, certificati: 3, pagamenti: 3, tessere: null, richieste: 2 })
  ok('richieste mancanti: solo richieste null', conRichieste({ persone, lezioni, richieste: null }), { appelli: 3, certificati: 3, pagamenti: 3, tessere: null, richieste: null })
  ok('niente letto: tutti null, nessuno 0', conRichieste({ persone: null, lezioni: null, richieste: null }), { appelli: null, certificati: null, pagamenti: null, tessere: null, richieste: null })
  ok('un conto che non si sa dà una casella «non so», non a posto', m.caselleCosaManca({ ...conRichieste({ persone: null, lezioni, richieste: 2 }), contato: true }).map((x) => x.stato), ['manca', 'nonso', 'nonso', 'nonso', 'attesa'])
  ok('le tessere lette arrivano nel conto', conRichieste({ persone, lezioni, richieste: 2, tessere: 14 }).tessere, 14)
}

console.log('\nI cinque conti, sui dati di prova veri')
{
  const s = m.creaSegreteriaProva()
  const adesso = Date.now()
  const d = new Date(adesso)
  const oggi = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const da = new Date(adesso - m.GIORNI_APPELLI * 86_400_000)
  const persone = await s.persone()
  const lezioni = await s.settimana(da, d)
  const filtroCertificato = persone.filter((p) => p.attiva && m.senzaCertificatoValido(p, oggi)).length
  const filtroPagare = persone.filter((p) => p.attiva && m.comePaga(p, oggi) !== 'pagato').length
  const appelli = m.appelliSenzaSegni(lezioni, adesso).length
  const c = m.contiDellaStriscia({ persone, lezioni, richieste: 0 }, adesso, oggi)
  ok('ci sono persone e lezioni su cui contare', [persone.length > 0, lezioni.length > 0], [true, true])
  ok('la striscia dice lo stesso numero dei filtri di ISCRITTI e di appelliSenzaSegni', [c.certificati, c.pagamenti, c.appelli], [filtroCertificato, filtroPagare, appelli])
  // DA FARE (`useDaFare`) è un hook: da uno script non si legge. Ma importa e chiama le stesse
  // appelliSenzaSegni, certificatiDaSistemare e pagamentiNonInRegola (e la striscia legge da lui),
  // quindi i conti sono questi e non ne ha altri: se ne avesse, andrebbero portati in `cosaManca.ts`.
}

console.log('\nNascondere la striscia da IMPOSTAZIONI (la scelta sta sul dispositivo)')
{
  // Una funzione che manca non fa crollare lo script: è un caso rosso come gli altri.
  const prova = (f, ...a) => {
    try {
      return m[f](...a)
    } catch (e) {
      return `ERRORE: ${e.message}`
    }
  }
  ok('di default la striscia si vede: niente salvato', prova('leggiPreferenzaStriscia', null), true)
  ok('anche con valori che non si conoscono', ['', 'mostrata', 'Nascosta', 'NASCOSTA', '1', 'false', ' nascosta', undefined, 0, {}].map((v) => prova('leggiPreferenzaStriscia', v)), Array(10).fill(true))
  ok('solo «nascosta» la nasconde', prova('leggiPreferenzaStriscia', 'nascosta'), false)
  ok('cosa si salva: nascosta o mostrata', [prova('valorePreferenzaStriscia', false), prova('valorePreferenzaStriscia', true)], ['nascosta', 'mostrata'])
  ok('si rilegge quello che si è salvato', [true, false].map((v) => prova('leggiPreferenzaStriscia', prova('valorePreferenzaStriscia', v))), [true, false])
  // Cosa si vede quando il salvataggio non riesce (quota piena, navigazione privata): la scelta fatta in questa pagina vince su
  // quello che c'è salvato, se no Impostazioni e il resto della segreteria vedrebbero due cose diverse.
  ok('niente salvato e niente scelto: si vede', prova('preferenzaStriscia', null, null), true)
  // Sul telefono la striscia parte spenta: solo chi l'ha accesa da IMPOSTAZIONI la vede.
  ok('telefono, niente salvato: spenta', [prova('leggiPreferenzaStriscia', null, true), prova('leggiPreferenzaStriscia', 'valore vecchio', true), prova('preferenzaStriscia', null, null, true)], [false, false, false])
  ok('telefono, accesa a mano: si vede', [prova('leggiPreferenzaStriscia', 'mostrata', true), prova('preferenzaStriscia', null, true, true)], [true, true])
  ok('telefono, spenta a mano: spenta', prova('leggiPreferenzaStriscia', 'nascosta', true), false)
  ok('computer, niente salvato: si vede', prova('leggiPreferenzaStriscia', null, false), true)
  ok('salvata nascosta: nascosta', prova('preferenzaStriscia', 'nascosta', null), false)
  ok('scelta in questa pagina senza poter salvare: vince lei', [prova('preferenzaStriscia', null, false), prova('preferenzaStriscia', 'mostrata', false), prova('preferenzaStriscia', 'nascosta', true)], [false, false, true])
  ok('salvato e scelto uguali: lo stesso', [prova('preferenzaStriscia', 'nascosta', false), prova('preferenzaStriscia', 'mostrata', true)], [false, true])
  ok('nascosta per scelta: mai, in nessuna voce, sul computer e sul telefono', ['presenze', 'iscritti', 'settimana', 'richieste', 'corsi'].flatMap((v) => [prova('strisciaVisibile', v, false, false, false), prova('strisciaVisibile', v, true, false, false)]), Array(10).fill(false))
  ok('voluta (o senza dirlo): le regole di prima', [prova('strisciaVisibile', 'iscritti', false, false, true), prova('strisciaVisibile', 'iscritti', false, false), prova('strisciaVisibile', 'dafare', false, false, true), prova('strisciaVisibile', 'iscritti', true, true, true)], [true, true, false, false])
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
