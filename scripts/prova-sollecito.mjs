// ---------------------------------------------------------------------------
// Il sollecito per WhatsApp, senza browser.
//
//   node scripts/prova-sollecito.mjs
//
// Nella scheda dell'iscritto la segreteria trova il messaggio già scritto per
// chi ha la quota o il certificato da sistemare, e un link wa.me che apre
// WhatsApp col testo pronto: l'app non manda niente. La regola sta in
// `src/lib/sollecito.ts` e legge gli stessi stati della scheda (`pagamentoDi`,
// `statoCertificato`): qui i motivi, le frasi, il numero e il link.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

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

// Oggi, per la prova, è mercoledì 21 ottobre 2026 a mezzogiorno.
const OGGI = '2026-10-21'
const ADESSO = new Date(2026, 9, 21, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [ADESSO]))
  }
  static now() {
    return ADESSO
  }
}

const m = await impacchetta(
  "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaDatiProva } from './src/lib/datiProva'; export { seminaEsempi } from './src/lib/esempiProva'; export { pagamentoDi } from './src/lib/segreteria'",
)
// Il modulo che ancora non c'è non ferma la prova: la rende rossa dicendolo.
let sol = {}
try {
  sol = await impacchetta("export * from './src/lib/sollecito'")
} catch (e) {
  console.log('  ✗ manca src/lib/sollecito.ts —', (e.errors?.[0]?.text ?? e.message).split('\n')[0])
}
const fraseSollecitato = (...a) => (typeof sol.fraseSollecitato === 'function' ? sol.fraseSollecitato(...a) : 'manca fraseSollecitato')
const lib = (nome) => (typeof sol[nome] === 'function' ? sol[nome] : () => `manca ${nome}`)
const numeroWhatsApp = lib('numeroWhatsApp')
const sollecitoDi = lib('sollecitoDi')

let guai = sol.sollecitoDi ? 0 : 1
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const QUOTA = 3000
// Paolo Bianchi, adulto, cellulare, certificato valido, quota da pagare.
const persona = (x = {}) => ({
  id: 'p-sollecito',
  nome: 'Paolo',
  cognome: 'Bianchi',
  telefono: '333 123 4567',
  attiva: true,
  creataIl: '2026-09-01',
  iscrizioni: [],
  certificato: { scade: '2027-09-01', conFile: true },
  documento: true,
  pagamento: { stato: 'da_pagare' },
  quote: [],
  natoIl: '1980-04-02',
  ...x,
})
const ricevuta = (mancano, x = {}) => ({ anno: 2026, numero: 12, dal: '2026-09-01', al: '2027-07-31', mancano, ...x })
const di = (p, anagrafica) => sollecitoDi(p, anagrafica, QUOTA, OGGI)
const motivi = (p, anagrafica) => di(p, anagrafica)?.motivi ?? null
const testo = (p, anagrafica) => di(p, anagrafica)?.testo ?? ''
const certificato = (scade) => ({ certificato: { scade, conFile: !!scade }, pagamento: { stato: 'pagato' } })

console.log('\n1. il numero per wa.me: solo cifre, col prefisso del paese')
ok('«333 123 4567» prende il 39', numeroWhatsApp('333 123 4567'), '393331234567')
ok('«+39 333 1234567» resta col 39', numeroWhatsApp('+39 333 1234567'), '393331234567')
ok('«0039 3331234567» perde lo 00', numeroWhatsApp('0039 3331234567'), '393331234567')
ok('«393 123 4567» è un cellulare che comincia per 39, non un prefisso', numeroWhatsApp('393 123 4567'), '393931234567')
ok('«+41 79 123 45 67» resta svizzero', numeroWhatsApp('+41 79 123 45 67'), '41791234567')
ok('«0041 79 123 45 67» resta svizzero', numeroWhatsApp('0041 79 123 45 67'), '41791234567')
ok('il telefono vuoto non dà un numero', numeroWhatsApp(''), null)
ok('senza telefono non c\'è un numero', numeroWhatsApp(undefined), null)
ok('«abc» non è un telefono', numeroWhatsApp('abc'), null)
ok('cinque cifre non bastano', numeroWhatsApp('12345'), null)

console.log('\n2. il fisso: WhatsApp non c\'è, e la scheda lo dice')
ok('«011 234 5678» prende il 39', numeroWhatsApp('011 234 5678'), '390112345678')
ok('un numero italiano che comincia per 0 è un fisso', [di(persona({ telefono: '011 234 5678' }))?.numero, di(persona({ telefono: '011 234 5678' }))?.fisso], ['390112345678', true])
ok('un cellulare non è un fisso', di(persona())?.fisso, false)
ok('un numero svizzero non è un fisso', di(persona({ telefono: '+41 79 123 45 67' }))?.fisso, false)
ok('il telefono: c\'è', di(persona())?.telefono, 'ok')
ok('il telefono: vuoto è «manca»', di(persona({ telefono: undefined }))?.telefono, 'manca')
ok('il telefono: scritto ma sbagliato è «sbagliato», non «manca»', di(persona({ telefono: '333-165-9203 (mamma)' }))?.telefono, 'sbagliato')

console.log('\n3-6. la quota associativa')
ok('da pagare: rosso, con l\'importo del listino', motivi(persona()), [{ testo: 'Quota associativa da pagare: 30,00 €', tono: 'rosso' }])
ok('scaduta: rosso, col giorno', motivi(persona({ quote: [ricevuta(0, { anno: 2025, numero: 40, dal: '2025-09-01', al: '2026-08-31' })] })), [{ testo: 'Quota associativa scaduta il 31 agosto 2026: 30,00 €', tono: 'rosso' }])
const inParte = persona({ quote: [ricevuta(1000)] })
ok('in parte da una ricevuta: giallo, con quanto manca', motivi(inParte), [{ testo: 'Quota associativa pagata in parte: mancano 10,00 €', tono: 'giallo' }])
ok('in parte: il messaggio chiede quello che manca', testo(inParte).includes('10,00 €'), true)
ok('in parte: il messaggio non chiede la quota intera', [!!testo(inParte), testo(inParte).includes('30,00 €')], [true, false])
ok('in parte fuori dall\'app: giallo, senza importo', motivi(persona({ pagamento: { stato: 'in_parte' } })), [{ testo: 'Quota associativa pagata in parte', tono: 'giallo' }])
const senzaCertificato = { certificato: { conFile: false } }
const soloCertificato = [{ testo: 'Certificato medico mancante', tono: 'rosso' }]
ok('pagata con una ricevuta: nessun motivo di quota', motivi(persona({ ...senzaCertificato, quote: [ricevuta(0)] })), soloCertificato)
ok('pagata fuori dall\'app: nessun motivo di quota', motivi(persona({ ...senzaCertificato, pagamento: { stato: 'pagato' } })), soloCertificato)
ok('pagata con Satispay: nessun motivo di quota', motivi(persona({ ...senzaCertificato, satispay: 3000 })), soloCertificato)

console.log('\n7. il certificato medico')
ok('manca: rosso', motivi(persona(certificato(undefined))), [{ testo: 'Certificato medico mancante', tono: 'rosso' }])
ok('scaduto: rosso, col giorno', motivi(persona(certificato('2026-03-12'))), [{ testo: 'Certificato medico scaduto il 12 marzo 2026', tono: 'rosso' }])
ok('in scadenza: giallo, col giorno e quanto manca', motivi(persona(certificato('2026-11-05'))), [{ testo: 'Certificato medico in scadenza il 5 novembre 2026, fra 15 giorni', tono: 'giallo' }])
ok('scade fra 40 giorni: niente da dire', di(persona(certificato('2026-11-30'))), null)
ok('compie 6 anni fra meno di un mese: giallo', motivi(persona({ ...certificato(undefined), natoIl: '2020-11-09' })), [{ testo: 'Compie 6 anni il 9 novembre 2026: da allora serve il certificato medico', tono: 'giallo' }])
ok('sotto i 6 anni e oltre un mese: il certificato non serve', di(persona({ ...certificato(undefined), natoIl: '2021-03-01' })), null)

console.log('\n8. l\'ordine: prima la quota, poi il certificato')
ok('quota, poi certificato', motivi(persona({ certificato: { scade: '2026-03-12', conFile: true } }))?.map((x) => x.testo), ['Quota associativa da pagare: 30,00 €', 'Certificato medico scaduto il 12 marzo 2026'])

console.log('\n9. quando non c\'è sollecito')
ok('scheda disattivata: niente', di(persona({ attiva: false })), null)
ok('quota pagata e certificato valido: niente', di(persona({ quote: [ricevuta(0)] })), null)

console.log('\n10-11. il messaggio: a chi e con che parole')
ok('adulto: il messaggio esatto', testo(persona()), 'Ciao Paolo, ti scriviamo dalla segreteria del Centro Judo: la quota associativa è da pagare (30,00 €). Puoi passare in segreteria o rispondere qui. Grazie!')
ok('adulto: si scrive a lui, cognome e nome', di(persona())?.a, 'Bianchi Paolo')
const marco = persona({ nome: 'Marco', cognome: 'Rossi', natoIl: '2017-05-01', certificato: { scade: '2026-03-12', conFile: true } })
const genitore = { natoIl: '2017-05-01', genitoreNome: 'Laura', genitoreCognome: 'Rossi' }
ok('minorenne: si scrive al genitore, per il ragazzo', testo(marco, genitore), 'Ciao Laura, ti scriviamo dalla segreteria del Centro Judo per Marco: la quota associativa è da pagare (30,00 €) e il certificato medico è scaduto il 12 marzo 2026. Puoi passare in segreteria o rispondere qui. Grazie!')
ok('minorenne: a chi si scrive è il genitore', di(marco, genitore)?.a, 'Rossi Laura (genitore)')
ok('minorenne senza genitore: niente saluto per nome (il telefono è forse di un genitore), «per Marco»', testo(marco, undefined).startsWith('Ciao, ti scriviamo dalla segreteria del Centro Judo per Marco: '), true)
ok('minorenne senza genitore: a chi risponde al telefono, non al ragazzo', di(marco, undefined)?.a, 'un genitore di Marco')
ok('minorenne con l\'anagrafica ma senza il nome del genitore: come senza genitore', [testo(marco, { natoIl: '2017-05-01', genitoreNome: '', genitoreCognome: 'Rossi' }).startsWith('Ciao, ti scriviamo dalla segreteria del Centro Judo per Marco: '), di(marco, { natoIl: '2017-05-01', genitoreNome: '', genitoreCognome: 'Rossi' })?.a], [true, 'un genitore di Marco'])
ok('a 18 anni compiuti non si scrive più al genitore', di(persona({ natoIl: '2008-10-21' }), genitore)?.a, 'Bianchi Paolo')

console.log('\n12. le frasi del messaggio')
const frase = (p, f) => [testo(p).includes(f), f]
ok('quota scaduta', frase(persona({ quote: [ricevuta(0, { anno: 2025, numero: 40, dal: '2025-09-01', al: '2026-08-31' })] }), 'la quota associativa è scaduta il 31 agosto 2026 (30,00 €)'), [true, 'la quota associativa è scaduta il 31 agosto 2026 (30,00 €)'])
ok('quota in parte, con quanto manca', frase(inParte, 'della quota associativa mancano 10,00 €'), [true, 'della quota associativa mancano 10,00 €'])
ok('quota in parte fuori dall\'app', frase(persona({ pagamento: { stato: 'in_parte' } }), 'la quota associativa è pagata solo in parte'), [true, 'la quota associativa è pagata solo in parte'])
ok('certificato mancante', frase(persona(certificato(undefined)), 'manca il certificato medico'), [true, 'manca il certificato medico'])
ok('certificato in scadenza', frase(persona(certificato('2026-11-05')), 'il certificato medico scade il 5 novembre 2026'), [true, 'il certificato medico scade il 5 novembre 2026'])
ok('compie 6 anni', frase(persona({ ...certificato(undefined), natoIl: '2020-11-09' }), 'dal 9 novembre 2026, quando compie 6 anni, per allenarsi serve il certificato medico'), [true, 'dal 9 novembre 2026, quando compie 6 anni, per allenarsi serve il certificato medico'])
ok('due frasi unite da «e»', frase(persona({ quote: [ricevuta(1000)], certificato: { conFile: false } }), 'della quota associativa mancano 10,00 € e manca il certificato medico'), [true, 'della quota associativa mancano 10,00 € e manca il certificato medico'])

console.log('\n13. il link wa.me')
const paolo = di(persona())
ok('il link porta al numero col testo', paolo?.link, typeof paolo?.testo === 'string' ? 'https://wa.me/393331234567?text=' + encodeURIComponent(paolo.testo) : 'un sollecito')
const senzaTelefono = di(persona({ telefono: undefined }))
ok('senza telefono: niente numero né link', senzaTelefono ? [senzaTelefono.numero, senzaTelefono.link] : 'manca il sollecito', [null, null])
ok('senza telefono il sollecito c\'è lo stesso', [senzaTelefono?.motivi?.length, senzaTelefono?.testo?.startsWith('Ciao Paolo')], [1, true])
const telefonoSbagliato = di(persona({ telefono: 'abc' }))
ok('con un telefono sbagliato: niente link, il testo resta', telefonoSbagliato ? [telefonoSbagliato.link, !!telefonoSbagliato.testo] : 'manca il sollecito', [null, true])

console.log('\n14. nel messaggio niente dati che non servono')
const riservato = di(
  persona({ ...marco, quote: [ricevuta(1000)], pagamento: { stato: 'da_pagare', nota: 'promesso a voce da Laura' } }),
  { ...genitore, codiceFiscale: 'RSSMRC17E01F205X', genitoreCodiceFiscale: 'RSSLRA80A41F205Y' },
)
ok('c\'è un sollecito da leggere', !!riservato?.testo, true)
ok('niente codice fiscale', [!!riservato?.testo, /RSSMRC17E01F205X|RSSLRA80A41F205Y/.test(riservato?.testo ?? '')], [true, false])
ok('niente numero di ricevuta', [!!riservato?.testo, (riservato?.testo ?? '').includes('12/2026')], [true, false])
const conNota = di(persona({ pagamento: { stato: 'in_parte', nota: 'promesso a voce da Laura' } }))
ok('niente nota del pagamento', [!!conNota?.testo, (conNota?.testo ?? '').includes('promesso a voce')], [true, false])

console.log('\n15. con la modalità prova')
m.creaDatiProva()
m.seminaEsempi()
const s = m.creaSegreteriaProva()
const daPagare = (await s.persone()).filter((p) => p.attiva && m.pagamentoDi(p, OGGI).come === 'da_pagare')
ok('in prova c\'è chi ha la quota da pagare', daPagare.length > 0, true)
const conTelefono = daPagare.find((p) => p.telefono)
ok('in prova c\'è chi ha la quota da pagare e un telefono', !!conTelefono, true)
const diProva = daPagare[0] && sollecitoDi(daPagare[0], undefined, QUOTA, OGGI)
ok('una persona di prova con la quota da pagare ha il suo sollecito', !!diProva && typeof diProva === 'object', true)
const conLink = conTelefono && sollecitoDi(conTelefono, undefined, QUOTA, OGGI)
ok('con il telefono di prova il link c\'è', typeof conLink?.link === 'string' && conLink.link.startsWith('https://wa.me/39'), true)

console.log('\n16. «Sollecitato il … da …» in prova, come 85-solleciti.sql')
const chi = daPagare[0]
ok('mai sollecitato: niente', await s.ultimoSollecito(chi.id), null)
const primo = await s.segnaSollecito(chi.id)
ok('segnato: l\'ultimo è quello', (await s.ultimoSollecito(chi.id))?.quando, primo)
const spenta = daPagare[1] ?? daPagare[0]
await s.attivaPersona(spenta.id, false)
let rifiuto = ''
await s.segnaSollecito(spenta.id).catch((e) => (rifiuto = e.message))
ok('una scheda disattivata non si sollecita', !!rifiuto, true)
let nessuno = ''
await s.segnaSollecito('non-esiste').catch((e) => (nessuno = e.message))
ok('una persona che non c\'è nemmeno', !!nessuno, true)
ok('la riga sotto il tasto, con chi', fraseSollecitato({ quando: new Date(2026, 9, 14, 9, 30).toISOString(), da: 'Giulia Ferri' }), 'Sollecitato l’ultima volta il 14 ottobre 2026 alle 09:30 da Giulia Ferri')
ok('la riga sotto il tasto, senza chi', fraseSollecitato({ quando: new Date(2026, 9, 14, 9, 30).toISOString(), da: '' }), 'Sollecitato l’ultima volta il 14 ottobre 2026 alle 09:30')

// ---------------------------------------------------------------------------
// Il sollecito nell'elenco ISCRITTI filtrato: una cella per riga, la frase
// corta, il genitore di tutti in una volta e l'ultimo sollecito di tutti.
// ---------------------------------------------------------------------------
const cellaSollecito = lib('cellaSollecito')
const fraseCorta = lib('fraseCorta')
const genitoriDa = lib('genitoriDa')
// La cella, o la stringa «manca …» se la funzione non c'è: così la prova lo dice.
const cella = (p, anagrafica, opz) => cellaSollecito(p, anagrafica, QUOTA, OGGI, opz)
const statoCella = (p, anagrafica, opz) => {
  const c = cella(p, anagrafica, opz)
  return typeof c === 'string' ? c : (c?.stato ?? null)
}

console.log('\n17. la cella dell\'elenco: tasto, fisso, manca, sbagliato')
const scaduto = persona(certificato('2026-03-12'))
ok('certificato scaduto e cellulare: il tasto', statoCella(scaduto), 'tasto')
ok('il sollecito della cella è quello della scheda', cella(scaduto)?.sollecito, sollecitoDi(scaduto, undefined, QUOTA, OGGI))
const fisso = persona({ ...certificato('2026-03-12'), telefono: '011 234 5678' })
ok('un fisso: «fisso»', statoCella(fisso), 'fisso')
ok('un fisso: il link c\'è lo stesso', typeof cella(fisso)?.sollecito?.link === 'string', true)
const vuoto = persona({ ...certificato('2026-03-12'), telefono: undefined })
ok('telefono vuoto: «manca»', statoCella(vuoto), 'manca')
ok('telefono vuoto: il sollecito c\'è, senza link', [!!cella(vuoto)?.sollecito, cella(vuoto)?.sollecito?.link], [true, null])
ok('telefono scritto male: «sbagliato»', statoCella(persona({ ...certificato('2026-03-12'), telefono: '333-165 (mamma)' })), 'sbagliato')

console.log('\n18. la cella di chi è in regola')
const inRegola = persona({ quote: [ricevuta(0)] })
ok('in regola con la tessera da sistemare: «tessera», senza sollecito', cella(inRegola, undefined, { tesseraDaSistemare: true }), { stato: 'tessera', sollecito: null })
ok('in regola e niente da sistemare: nessuna cella', cella(inRegola), null)
ok('scheda disattivata: nessuna cella, anche con la tessera', cella(persona({ attiva: false, quote: [ricevuta(0)] }), undefined, { tesseraDaSistemare: true }), null)

console.log('\n19. la quota pagata nel vecchio programma')
const vecchio = { quotaNelVecchio: true }
ok('solo la quota da pagare, nel vecchio: «vecchio», senza sollecito', cella(persona(), undefined, vecchio), { stato: 'vecchio', sollecito: null })
const dueMotivi = persona({ certificato: { scade: '2026-03-12', conFile: true } })
ok('quota e certificato scaduto, nel vecchio: il tasto', statoCella(dueMotivi, undefined, vecchio), 'tasto')
ok('quota e certificato scaduto, nel vecchio: solo il certificato', cella(dueMotivi, undefined, vecchio)?.sollecito?.motivi?.map((x) => x.testo), ['Certificato medico scaduto il 12 marzo 2026'])
const testoVecchio = cella(dueMotivi, undefined, vecchio)?.sollecito?.testo ?? ''
ok('quota e certificato scaduto, nel vecchio: il messaggio non parla di quota', [!!testoVecchio, testoVecchio.includes('quota')], [true, false])
ok('senza il vecchio: i due motivi di sempre', cella(dueMotivi)?.sollecito?.motivi?.map((x) => x.testo), ['Quota associativa da pagare: 30,00 €', 'Certificato medico scaduto il 12 marzo 2026'])

console.log('\n20. sollecitoDi con la quota nel vecchio programma')
const scadutaQuota = persona({ ...senzaCertificato, quote: [ricevuta(0, { anno: 2025, numero: 40, dal: '2025-09-01', al: '2026-08-31' })] })
ok('quota scaduta, nel vecchio: niente motivo di quota', sollecitoDi(scadutaQuota, undefined, QUOTA, OGGI, vecchio)?.motivi, soloCertificato)
ok('quota pagata in parte, nel vecchio: niente motivo di quota', sollecitoDi(persona({ ...senzaCertificato, quote: [ricevuta(1000)] }), undefined, QUOTA, OGGI, vecchio)?.motivi, soloCertificato)

console.log('\n21. la frase corta sotto il tasto')
ok('un altro giorno, con chi', fraseCorta({ quando: new Date(2026, 9, 14, 9, 30).toISOString(), da: 'Giulia Ferri' }), 'Sollecitato il 14/10 da Giulia Ferri')
ok('un altro giorno, senza chi', fraseCorta({ quando: new Date(2026, 9, 14, 9, 30).toISOString(), da: '' }), 'Sollecitato il 14/10')
ok('oggi, con chi: l\'ora', fraseCorta({ quando: new Date(2026, 9, 21, 9, 30).toISOString(), da: 'Giulia Ferri' }), 'Sollecitato oggi alle 09:30 da Giulia Ferri')
ok('oggi, senza chi: l\'ora', fraseCorta({ quando: new Date(2026, 9, 21, 9, 30).toISOString(), da: '' }), 'Sollecitato oggi alle 09:30')

console.log('\n22. il genitore di tutti, come anagrafica(): il più recente, la segreteria a pari')
const genitori = (r, sg) => {
  const g = genitoriDa(r, sg)
  return g instanceof Map ? Object.fromEntries(g) : g
}
const riga = (personaId, quando, genitoreNome, genitoreCognome) => ({ personaId, quando, genitoreNome, genitoreCognome })
ok('solo la richiesta accolta: il suo genitore', genitori([riga('p1', '2026-09-01', 'Laura', 'Rossi')], [])?.p1, { genitoreNome: 'Laura', genitoreCognome: 'Rossi' })
ok('due richieste: vince la più recente', genitori([riga('p2', '2026-08-01', 'Anna', 'Verdi'), riga('p2', '2026-09-10', 'Laura', 'Verdi')], [])?.p2?.genitoreNome, 'Laura')
ok('la segreteria più recente della richiesta: la segreteria', genitori([riga('p3', '2026-09-01', 'Laura', 'Rossi')], [riga('p3', '2026-10-01', 'Marta', 'Rossi')])?.p3?.genitoreNome, 'Marta')
ok('la richiesta più recente della segreteria: la richiesta', genitori([riga('p3', '2026-09-01', 'Laura', 'Rossi')], [riga('p3', '2026-08-01', 'Marta', 'Rossi')])?.p3?.genitoreNome, 'Laura')
ok('stessa data: la segreteria', genitori([riga('p3', '2026-09-01', 'Laura', 'Rossi')], [riga('p3', '2026-09-01', 'Marta', 'Rossi')])?.p3?.genitoreNome, 'Marta')
ok('la segreteria più recente senza genitore: vince lo stesso, come nella scheda', genitori([riga('p4', '2026-09-01', 'Laura', 'Rossi')], [{ personaId: 'p4', quando: '2026-10-01' }])?.p4, {})
const vuota = genitori([], [])
ok('nessuna riga: la persona non c\'è', typeof vuota === 'object' && vuota !== null ? 'p5' in vuota : vuota, false)

console.log('\n23. in prova: i genitori e gli ultimi solleciti di tutti')
// Un archivio di prova nuovo, perché la 16 ha già sollecitato qualcuno.
memoria.clear()
const m2 = await impacchetta(
  "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaDatiProva } from './src/lib/datiProva'; export { seminaEsempi } from './src/lib/esempiProva'",
)
m2.creaDatiProva()
m2.seminaEsempi()
const s2 = m2.creaSegreteriaProva()
const metodo = (nome) => (typeof s2[nome] === 'function' ? s2[nome] : async () => `manca ${nome}`)
const descrivi = (x) => (x instanceof Map ? 'una Map' : x)
const tuttiGenitori = await metodo('genitori')()
ok('genitori() è una Map', descrivi(tuttiGenitori), 'una Map')
const ultimi = await metodo('ultimiSolleciti')()
ok('ultimiSolleciti() all\'inizio è una Map vuota', ultimi instanceof Map ? ultimi.size : ultimi, 0)
const attive = (await s2.persone()).filter((p) => p.attiva)
const uno = attive[0]
const quando = await s2.segnaSollecito(uno.id)
const dopo = await metodo('ultimiSolleciti')()
ok('dopo il sollecito c\'è, col suo quando', dopo instanceof Map ? dopo.get(uno.id)?.quando : dopo, quando)
ok('togliSollecito su chi è sollecitato: vero', await metodo('togliSollecito')(uno.id), true)
const tolto = await metodo('ultimiSolleciti')()
ok('dopo averlo tolto non c\'è più', tolto instanceof Map ? tolto.has(uno.id) : tolto, false)
ok('togliSollecito su chi non è mai stato sollecitato: falso', await metodo('togliSollecito')(attive[1].id), false)

console.log('\n24. in prova: il genitore della mappa è quello della scheda')
let minorenne = null
for (const p of attive) {
  const an = await s2.anagraficaDi(p.id)
  if (an?.dati?.genitoreNome) {
    minorenne = { id: p.id, genitoreNome: an.dati.genitoreNome }
    break
  }
}
ok('in prova c\'è un minorenne col genitore nei dati anagrafici', !!minorenne, true)
if (minorenne)
  ok('genitori() dà lo stesso nome di anagraficaDi()', tuttiGenitori instanceof Map ? tuttiGenitori.get(minorenne.id)?.genitoreNome : tuttiGenitori, minorenne.genitoreNome)

console.log(guai ? `\n${guai} prove non passano.` : '\nTutte le prove passano.')
process.exit(guai ? 1 : 0)
