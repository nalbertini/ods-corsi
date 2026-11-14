// ---------------------------------------------------------------------------
// L'elenco «Da sistemare» in cima alla scheda dell'iscritto, senza browser.
//
//   node scripts/prova-da-sistemare.mjs
//
// Prende il posto di COSA MANCA e dei timbri: un elenco solo, prima quel che
// tiene fuori di sala o è da incassare, poi i dati. Il verde non c'è: quel che
// è a posto non si sistema. Sotto il nome una frase coi numeri (`fraseScheda`).
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/daSistemare'", resolveDir: '.', loader: 'ts' },
  bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
})
const { daSistemare, fraseScheda, totaleDaPagare, aPosto, comeFrase, etichettaNuovo } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

const oggi = '2026-11-14'
const persona = (x = {}) => ({
  attiva: true,
  certificato: { scade: '2027-06-21' },
  documento: true,
  pagamento: { stato: 'da_pagare' },
  quote: [{ dal: '2026-09-01', al: '2027-07-31', mancano: 0, numero: 8, anno: 2026 }],
  natoIl: '1981-03-02',
  ...x,
})

console.log('\nUna scheda con tutto da sistemare (Bruno Sofia)')
const bruno = persona({ certificato: { scade: '2026-09-09' }, quote: [] })
const vociBruno = daSistemare(bruno, oggi, {
  prezzoQuota: 5000,
  corsi: [{ corsoId: 'c1', corso: 'Lotta 3', come: 'da_pagare', totale: 48000 }],
  tessera: null,
  manca: [
    { cosa: 'Codice fiscale', perche: 'serve per la ricevuta' },
    { cosa: 'Data di nascita', perche: 'serve anche per il certificato' },
  ],
})
ok('cinque voci: certificato, quota, corso, poi i dati', vociBruno, [
  { chiave: 'certificato', cosa: 'Certificato medico', perche: 'Senza, non può allenarsi', parola: 'Scaduto il 09/09/2026', tono: 'rosso', azione: 'certificato' },
  { chiave: 'quota', cosa: 'Quota associativa', perche: 'Nessun pagamento', parola: 'Da pagare', tono: 'rosso', importo: 5000, azione: 'pagamento' },
  { chiave: 'corso-c1', cosa: 'Lotta 3', perche: 'Annuale, nessun pagamento', parola: 'Da pagare', tono: 'rosso', importo: 48000, azione: 'pagamento' },
  { chiave: 'Codice fiscale', cosa: 'Codice fiscale', perche: 'Serve per la ricevuta', parola: 'Manca', tono: 'giallo', azione: 'anagrafica' },
  { chiave: 'Data di nascita', cosa: 'Data di nascita', perche: 'Serve anche per il certificato', parola: 'Manca', tono: 'giallo', azione: 'anagrafica' },
])
ok('la frase: i soldi, il certificato, poi il resto', fraseScheda(vociBruno), [
  { testo: 'Mancano ' },
  { testo: '530,00 €', tono: 'rosso' },
  { testo: ' e il certificato, ' },
  { testo: 'scaduto il 09/09/2026', tono: 'rosso' },
  { testo: '. Da sistemare anche: codice fiscale e data di nascita.' },
])

console.log('\nTutto a posto (Bellini Andrea)')
const bellini = daSistemare(persona(), oggi, { prezzoQuota: 5000, corsi: [{ corsoId: 'c2', corso: 'Judo 2', come: 'pagato' }], tessera: { tono: 'verde', parola: 'IN REGOLA', righe: [] }, manca: [] })
ok('niente da sistemare', bellini, [])
ok('la frase dice «In regola.» in verde', fraseScheda(bellini), [{ testo: 'In regola.', tono: 'verde' }])

console.log('\nLe voci una per una')
const sola = (x, extra = {}) => daSistemare(persona(x), oggi, { corsi: [], tessera: null, manca: [], ...extra })
ok('certificato che manca: «Manca», e la frase non ripete la parola', fraseScheda(sola({ certificato: {} })), [{ testo: 'Manca il certificato.' }])
ok('certificato in scadenza: giallo, coi giorni, non va nella prima parte della frase', sola({ certificato: { scade: '2026-11-17' } }), [
  { chiave: 'certificato', cosa: 'Certificato medico', perche: 'Fra 3 giorni', parola: 'Scade il 17/11/2026', tono: 'giallo', azione: 'certificato' },
])
ok('…e la frase lo mette fra le cose da sistemare', fraseScheda(sola({ certificato: { scade: '2026-11-17' } })), [{ testo: 'Da sistemare: certificato medico.' }])
ok('quota da pagare senza listino letto: niente importo', sola({ quote: [] }, { prezzoQuota: 'leggo' })[0].importo, undefined)
ok('…e la frase dice «dei pagamenti»', fraseScheda(sola({ quote: [] }, { prezzoQuota: 'leggo' })), [{ testo: 'Mancano ' }, { testo: 'dei pagamenti', tono: 'rosso' }, { testo: '.' }])
ok('quota pagata in parte: giallo, coi centesimi che mancano e la ricevuta', sola({ quote: [{ dal: '2026-09-01', al: '2027-07-31', mancano: 2000, numero: 12, anno: 2026 }] }), [
  { chiave: 'quota', cosa: 'Quota associativa', perche: 'Ricevuta 12/2026', parola: 'Pagata in parte', tono: 'giallo', importo: 2000, azione: 'pagamento' },
])
ok('quota scaduta: rosso, fino a quando valeva', sola({ quote: [{ dal: '2025-09-01', al: '2026-07-31', mancano: 0, numero: 3, anno: 2025 }] }), [
  { chiave: 'quota', cosa: 'Quota associativa', perche: 'Valeva fino al 31/07/2026', parola: 'Scaduta', tono: 'rosso', azione: 'pagamento' },
])
ok('corso pagato in parte: i centesimi che mancano', sola({}, { corsi: [{ corsoId: 'c3', corso: 'Judo 1', come: 'in_parte', mancano: 7000, totale: 14000 }] }), [
  { chiave: 'corso-c3', cosa: 'Judo 1', perche: 'Pagati 70,00 € su 140,00 €', parola: 'Pagato in parte', tono: 'giallo', importo: 7000, azione: 'pagamento' },
])
ok('corso scaduto: rosso, da quando', sola({}, { corsi: [{ corsoId: 'c4', corso: 'Judo 1', come: 'scaduto', al: '2026-10-31' }] }), [
  { chiave: 'corso-c4', cosa: 'Judo 1', perche: 'Scaduto il 31/10/2026', parola: 'Da pagare', tono: 'rosso', azione: 'pagamento' },
])
ok('corso da controllare: giallo, porta ai pagamenti', sola({}, { corsi: [{ corsoId: 'c5', corso: 'Judo 1', come: 'da_controllare' }] }), [
  { chiave: 'corso-c5', cosa: 'Judo 1', perche: 'Voce scritta a mano', parola: 'Da controllare', tono: 'giallo', azione: 'pagamento' },
])
ok('i corsi pagati, fuori app o con Satispay non si dicono', sola({}, { corsi: ['pagato', 'fuori_app', 'satispay'].map((come, i) => ({ corsoId: `p${i}`, corso: 'X', come })) }), [])
ok('tessera che manca: la parola del timbro, l\'ente nel perché', sola({}, { tessera: { tono: 'rosso', parola: 'NO TESSERA', righe: [{ testo: 'FIJLKAM · Judo 1' }] } }), [
  { chiave: 'tessera', cosa: 'Tessera', perche: 'FIJLKAM · Judo 1', parola: 'No tessera', tono: 'rosso', azione: 'tessera' },
])
ok('contatti e documento: ognuno col suo tasto', sola({}, { manca: [{ cosa: 'Telefono o email', perche: 'per ricevute e avvisi' }, { cosa: 'Documento d’identità', perche: 'da portare in segreteria, non serve per entrare' }] }).map((v) => v.azione), ['contatti', 'documento'])
ok('maggiorenne nel nucleo: da chiedere', sola({}, { maggiorenne: '3 marzo 2027' }), [
  { chiave: 'maggiorenne', cosa: 'Maggiorenne dal 3 marzo 2027', perche: 'Chiedi a chi intestare le ricevute nuove', parola: 'Da chiedere', tono: 'giallo', azione: 'anagrafica' },
])

ok('il totale da pagare: quota e corsi', totaleDaPagare(vociBruno), 53000)
ok('senza un importo il totale non si sa', totaleDaPagare(sola({ quote: [] }, { prezzoQuota: 'leggo' })), null)
ok('niente da pagare: niente totale', totaleDaPagare(sola({ certificato: {} })), null)

console.log('\nChi fa solo da genitore')
ok('solo i dati: niente certificato, quota né corsi', daSistemare(persona({ certificato: {}, quote: [] }), oggi, { soloDati: true, corsi: [{ corsoId: 'c1', corso: 'Lotta 3', come: 'da_pagare' }], tessera: null, manca: [{ cosa: 'Telefono o email', perche: 'per ricevute e avvisi' }] }).map((v) => v.chiave), ['Telefono o email'])

console.log('\nQuel che è a posto, quando non c\'è niente da sistemare')
ok('certificato valido, quota pagata con la ricevuta, corso pagato', aPosto(persona(), oggi, [{ corsoId: 'c2', corso: 'Judo 2', come: 'pagato' }]), [
  { chiave: 'certificato', cosa: 'Certificato medico', parola: 'Valido fino al 21/06/2027' },
  { chiave: 'quota', cosa: 'Quota associativa', parola: 'Pagata · ricevuta 8/2026, fino al 31/07/2027' },
  { chiave: 'corso-c2', cosa: 'Judo 2', parola: 'Pagato' },
])
ok('quota pagata fuori dall\'app', aPosto(persona({ quote: [], pagamento: { stato: 'pagato', fino: '2027-07-31' } }), oggi, [])[1], { chiave: 'quota', cosa: 'Quota associativa', parola: 'Pagata fuori app, fino al 31/07/2027' })
ok('una parola in maiuscolo diventa una frase', comeFrase('MANCANO 20,00 €'), 'Mancano 20,00 €')

console.log('\nLa scheda disattivata')
ok('niente da sistemare: resta la nota DISATTIVATA', daSistemare(persona({ attiva: false, certificato: {}, quote: [] }), oggi, { corsi: [], tessera: null, manca: [{ cosa: 'Codice fiscale' }] }), [])

console.log('\nL\'etichetta accanto al nome di chi si è appena iscritto')
const nuovo = (x = {}, cf) => etichettaNuovo({ attiva: true, creataIl: '2026-11-04', ...x }, cf, oggi)
ok('in elenco da dieci giorni, codice fiscale di una donna: «Nuova»', nuovo({}, 'RSSMRA80A41H501Y'), 'Nuova')
ok('…di un uomo: «Nuovo»', nuovo({}, 'RSSMRA80A01H501U'), 'Nuovo')
ok('senza codice fiscale non si indovina dal nome: «Nuova iscrizione»', nuovo({}, undefined), 'Nuova iscrizione')
ok('iscritta oggi', nuovo({ creataIl: oggi }, undefined), 'Nuova iscrizione')
ok('al 29° giorno ancora sì', nuovo({ creataIl: '2026-10-16' }, undefined), 'Nuova iscrizione')
ok('dal 30° giorno no: sono i giorni per portare il certificato', nuovo({ creataIl: '2026-10-15' }, undefined), null)
ok('chi c\'era già a inizio stagione no', nuovo({ creataIl: '2026-09-14' }, undefined), null)
ok('una scheda disattivata no', nuovo({ attiva: false }, undefined), null)
ok('chi fa solo da genitore no: non si è iscritto', nuovo({ genitoreNonIscritto: true }, undefined), null)

console.log(guai ? `\n${guai} prove non passano.` : '\nTutte le prove passano.')
process.exit(guai ? 1 : 0)
