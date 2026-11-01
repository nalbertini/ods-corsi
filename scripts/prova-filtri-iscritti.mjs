// ---------------------------------------------------------------------------
// ISCRITTI: cinque filtri in vista (con MINORENNI), gli altri dietro «Altri filtri», senza browser.
//
//   node scripts/prova-filtri-iscritti.mjs
//
// src/lib/filtriIscritti.ts esporta FILTRI_VISIBILI, TESTI_FILTRI, altriFiltri
// e altriAperti; Iscritti.tsx li importa e non ha più i testi dei filtri suoi.
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

const c = existsSync('src/lib/filtriIscritti.ts')
const m = c ? await impacchetta("export * from './src/lib/filtriIscritti'") : {}
const mancante = 'src/lib/filtriIscritti.ts non esiste'
const altri = (x) => (m.altriFiltri ? m.altriFiltri(x) : mancante)
const aperti = (a, s) => (m.altriAperti ? m.altriAperti(a, s) : mancante)
const nessuno = { conTessere: false, filePrima: 0, doppioni: 0 }

console.log('\nI cinque in vista')
ok('certificato, pagare, corsi-scaduti, fuori, minorenni: in quest\'ordine', m.FILTRI_VISIBILI ?? mancante, ['certificato', 'pagare', 'corsi-scaduti', 'fuori', 'minorenni'])

console.log('\nI testi')
ok('un testo per ognuno dei 16 filtri', m.TESTI_FILTRI ?? mancante, {
  'senza-email': 'Solo senza email', poco: 'Vengono poco', certificato: 'Senza certificato valido',
  scadenza: 'Certificato in scadenza', arrivo: 'Compiono 6 anni', pagare: 'Da pagare', fuori: 'Non in regola',
  'senza-tessera': 'Senza tessera', 'senza-corso': 'Tesserati senza corso', 'senza-documento': 'Senza documento', 'file-di-prima': 'Da archiviare',
  doppioni: 'Possibili doppioni', 'pagato-prima': 'Pagato nel vecchio programma', 'corsi-scaduti': 'Corsi scaduti',
  minorenni: 'Minorenni', famiglie: 'Famiglie',
})

console.log('\nTesserati senza corso')
{
  const t = await impacchetta("export { tesseratoSenzaCorso } from './src/lib/tessere'")
  const f = typeof t.tesseratoSenzaCorso === 'function' ? t.tesseratoSenzaCorso : () => 'manca tesseratoSenzaCorso in src/lib/tessere.ts'
  const r = (esito) => ({ personaId: 'p1', ente: 'CSEN', esito })
  ok('ID_FILTRI include senza-corso', (m.ID_FILTRI ?? []).includes('senza-corso'), true)
  ok('una riga non_iscritto: tesserato senza corso', f([r('non_iscritto')]), true)
  ok('non_iscritto fra altre righe: sì', f([r('manca'), r('non_iscritto')]), true)
  ok('manca, scaduta, in_scadenza: no', f([r('manca'), r('scaduta'), r('in_scadenza')]), false)
  ok('nessuna riga: no', f([]), false)
}

console.log('\nGli altri filtri, quelli presenti adesso')
const base = ['senza-email', 'poco', 'scadenza', 'arrivo', 'senza-documento', 'famiglie']
ok('nessun opzionale: sei, nell\'ordine', altri(nessuno), base)
ok('con le tessere: senza-tessera e senza-corso prima di senza-documento', altri({ ...nessuno, conTessere: true }), ['senza-email', 'poco', 'scadenza', 'arrivo', 'senza-tessera', 'senza-corso', 'senza-documento', 'famiglie'])
ok('con le segnalazioni delle tessere spente: resta solo senza-corso', altri({ ...nessuno, conTessere: true, segnalaTessere: false }), ['senza-email', 'poco', 'scadenza', 'arrivo', 'senza-corso', 'senza-documento', 'famiglie'])
ok('con i file di prima: file-di-prima in fondo', altri({ ...nessuno, filePrima: 3 }), [...base, 'file-di-prima'])
ok('con i doppioni: doppioni in fondo', altri({ ...nessuno, doppioni: 2 }), [...base, 'doppioni'])
const tutti = altri({ conTessere: true, filePrima: 3, doppioni: 2 })
ok('tutti gli opzionali: dieci, nell\'ordine', tutti, ['senza-email', 'poco', 'scadenza', 'arrivo', 'senza-tessera', 'senza-corso', 'senza-documento', 'famiglie', 'file-di-prima', 'doppioni'])
ok('i cinque in vista non sono mai fra gli altri', Array.isArray(tutti) ? tutti.filter((x) => ['certificato', 'pagare', 'corsi-scaduti', 'fuori', 'minorenni'].includes(x)) : tutti, [])

console.log('\nIl gruppo aperto')
ok('aperto dall\'utente: aperto', aperti([], true), true)
ok('nessun filtro acceso, gruppo chiuso: chiuso', aperti([], false), false)
ok('acceso uno in vista, gruppo chiuso: chiuso', aperti(['pagare'], false), false)
ok('acceso uno nascosto, gruppo chiuso: si apre da sé', aperti(['poco'], false), true)
ok('acceso uno in vista e uno nascosto: aperto', aperti(['fuori', 'doppioni'], false), true)

console.log('\nMinorenni e famiglie')
{
  const oggi = '2026-10-25'
  const contesto = { oggi, scopertiDi: () => [], tesseraDi: () => [] }
  const P = (id, altro = {}) => ({ id, nome: id, cognome: 'Prova', attiva: true, creataIl: '2026-09-01', iscrizioni: [], documento: true, quote: [], pagamento: { stato: 'da_pagare' }, certificato: { conFile: false }, ...altro })
  const passa = (id, p, cx = contesto) => (typeof m.passaChip === 'function' ? m.passaChip(id, p, cx) : 'manca passaChip')
  ok('MINORENNI e FAMIGLIE sono fra tutti i filtri', ['minorenni', 'famiglie'].filter((x) => !(m.ID_FILTRI ?? []).includes(x)), [])
  ok('MINORENNI è un chip con il conto', typeof m.haConto === 'function' ? m.haConto('minorenni') : 'manca haConto', true)
  ok('FAMIGLIE no: sta dietro «Altri filtri», senza conto', typeof m.haConto === 'function' ? m.haConto('famiglie') : 'manca haConto', false)
  ok('17 anni compiuti ieri: minorenne', passa('minorenni', P('a', { natoIl: '2009-10-24' })), true)
  ok('18 anni compiuti oggi: non più minorenne', passa('minorenni', P('b', { natoIl: '2008-10-25' })), false)
  ok('18 anni domani: ancora minorenne', passa('minorenni', P('c', { natoIl: '2008-10-26' })), true)
  ok('senza data di nascita: vale da adulto, non passa', passa('minorenni', P('d')), false)
  ok('adulto: non passa', passa('minorenni', P('e', { natoIl: '1990-01-01' })), false)
  // Il giorno conta in data, non in ore: su un computer a ovest di Greenwich la mezzanotte UTC di `oggi` è ancora ieri.
  const fuso = process.env.TZ
  process.env.TZ = 'America/New_York'
  ok('18 anni compiuti oggi, col computer a New York: non più minorenne', passa('minorenni', P('b', { natoIl: '2008-10-25' })), false)
  process.env.TZ = fuso ?? ''

  const gente = [P('t'), P('f1', { natoIl: '2015-05-05', nucleo: 't' }), P('f2', { natoIl: '1985-05-05', nucleo: 't' }), P('m', { natoIl: '2012-01-01' }), P('s', { natoIl: '1990-01-01' }), P('o', { nucleo: 'fuori-elenco' })]
  const perId = new Map(gente.map((p) => [p.id, p]))
  const titolari = typeof m.titolariDi === 'function' ? m.titolariDi(gente) : new Set()
  const fam = (p) => (typeof m.famigliaDi === 'function' ? m.famigliaDi(p, perId, titolari) : 'manca famigliaDi')
  ok('chi ha qualcuno nel nucleo: titolare', fam(gente[0]), { tipo: 'titolare' })
  ok('un minorenne nel nucleo: membro, con il titolare', fam(gente[1]), { tipo: 'membro', titolare: gente[0] })
  ok('anche un adulto nel nucleo è membro', fam(gente[2])?.tipo, 'membro')
  ok('un minorenne senza nucleo: niente famiglia', fam(gente[3]), null)
  ok('un adulto senza nucleo: niente famiglia', fam(gente[4]), null)
  ok('membro il cui titolare non è nell\'elenco: titolare undefined', fam(gente[5]), { tipo: 'membro', titolare: undefined })
  const inFam = (p) => (typeof m.inFamiglia === 'function' ? m.inFamiglia(p, titolari) : 'manca inFamiglia')
  ok('il filtro FAMIGLIE lascia passare titolari e membri, non gli altri', gente.filter((p) => inFam(p) === true).map((p) => p.id), ['t', 'f1', 'f2', 'o'])

  const conti = typeof m.contiChip === 'function' ? m.contiChip(gente, () => true, contesto) : 'manca contiChip'
  ok('contiChip conta i minorenni (f1 e m)', conti?.minorenni, 2)
  ok('… solo fra chi passa la base', typeof m.contiChip === 'function' ? m.contiChip(gente, (p) => p.id === 'f1', contesto).minorenni : 'manca contiChip', 1)
  ok('… e torna con passaChip', conti?.minorenni, gente.filter((p) => passa('minorenni', p)).length)

  const sn = (l) => (typeof m.senzaNascita === 'function' ? m.senzaNascita(l) : 'manca senzaNascita')
  ok('senzaNascita conta chi non ha la data', sn([P('x'), P('y', { natoIl: '2000-01-01' }), P('z')]), 2)
  ok('senzaNascita: tutti con la data, zero', sn([P('y', { natoIl: '2000-01-01' })]), 0)
  ok('senzaNascita: elenco vuoto, zero', sn([]), 0)

  // Il genitore non iscritto c'è per i figli: nessun chip lo conta (niente certificato, quota o corsi da lui).
  const padre = P('padre', { genitoreNonIscritto: true, natoIl: '1975-01-01' })
  const figlio = P('figlio', { nucleo: 'padre', natoIl: '2015-01-01' })
  const cx = { oggi, scopertiDi: () => [1], tesseraDi: () => [] }
  ok('il genitore non iscritto non passa nessun chip', ['certificato', 'pagare', 'corsi-scaduti', 'fuori', 'minorenni'].filter((id) => passa(id, padre, cx) !== false), [])
  ok('lo stesso senza il segno passa: il segno è la differenza', ['certificato', 'pagare', 'corsi-scaduti', 'fuori'].filter((id) => passa(id, { ...padre, genitoreNonIscritto: undefined }, cx) === true), ['certificato', 'pagare', 'corsi-scaduti', 'fuori'])
  const dueConti = typeof m.contiChip === 'function' ? m.contiChip([padre, figlio], (p) => p.id === 'padre', cx) : 'manca contiChip'
  ok('contiChip non lo conta', dueConti, { certificato: 0, pagare: 0, 'corsi-scaduti': 0, fuori: 0, minorenni: 0 })
  const titolariGenitore = typeof m.titolariDi === 'function' ? m.titolariDi([padre, figlio]) : new Set()
  const perIdGenitore = new Map([padre, figlio].map((p) => [p.id, p]))
  ok('è ancora il titolare del nucleo, e il filtro FAMIGLIE lo lascia passare', [typeof m.famigliaDi === 'function' ? m.famigliaDi(padre, perIdGenitore, titolariGenitore) : 'manca famigliaDi', typeof m.inFamiglia === 'function' ? m.inFamiglia(padre, titolariGenitore) : 'manca inFamiglia'], [{ tipo: 'titolare' }, true])
  ok('il figlio ha lui come titolare', typeof m.famigliaDi === 'function' ? m.famigliaDi(figlio, perIdGenitore, titolariGenitore) : 'manca famigliaDi', { tipo: 'membro', titolare: padre })

  const frase = (n, senza) => (typeof m.fraseMinorenni === 'function' ? m.fraseMinorenni(n, senza) : 'manca fraseMinorenni')
  ok('sottotitolo: nessun minorenne, tutti con la data', frase(0, 0), '0 minorenni.')
  ok('sottotitolo: uno, al singolare', frase(1, 0), 'Un minorenne.')
  ok('sottotitolo: chi non ha la data, al singolare', frase(3, 1), '3 minorenni · una persona senza data di nascita non è contata.')
  ok('sottotitolo: chi non ha la data, al plurale', frase(3, 151), '3 minorenni · 151 persone senza data di nascita non sono contate.')
}

console.log('\nIscritti.tsx li prende da src/lib')
{
  const tsx = readFileSync('src/components/segreteria/Iscritti.tsx', 'utf8')
  ok('importa da filtriIscritti', tsx.includes("lib/filtriIscritti'"), true)
  const vecchi = ['SOLO SENZA EMAIL', 'VENGONO POCO', 'SENZA CERTIFICATO VALIDO', 'CERTIFICATO IN SCADENZA', 'COMPIONO 6 ANNI', 'NON IN REGOLA', 'SENZA TESSERA', 'SENZA DOCUMENTO', 'NON ARCHIVIATO', '+ NUOVO ISCRITTO']
  ok('niente più i testi dei filtri in maiuscolo, né «+ NUOVO ISCRITTO»', vecchi.filter((x) => tsx.includes(x)), [])
  // Il «+» a mano è diventato l'icona aggiungi (grammatica dei tasti, prova-segreteria-ordine).
  ok('«Nuovo iscritto» e le etichette di colonna «CERTIFICATO» e «QUOTA»', ['Nuovo iscritto', 'CERTIFICATO', 'QUOTA'].filter((x) => !tsx.includes(x)), [])
  ok('«Nuovo iscritto» senza «+» scritto a mano', tsx.includes('+ Nuovo iscritto'), false)
  ok('la colonna «IN REGOLA?» non c\'è più', tsx.includes('IN REGOLA?'), false)
  ok('il conto di un chip si legge solo per i cinque chip sempre in vista', typeof m.haConto === 'function' ? m.ID_FILTRI.filter(m.haConto) : 'manca haConto', ['certificato', 'pagare', 'corsi-scaduti', 'fuori', 'minorenni'])
}

console.log('\nIl sollecito nell\'elenco: solo coi filtri di chi ha qualcosa da sistemare')
{
  const con = (a) => (typeof m.conSollecito === 'function' ? m.conSollecito(a) : 'manca conSollecito')
  ok('i filtri del sollecito sono esattamente sei', m.FILTRI_SOLLECITO ?? 'manca FILTRI_SOLLECITO', ['certificato', 'scadenza', 'arrivo', 'pagare', 'corsi-scaduti', 'fuori'])
  ok('nessun filtro acceso: niente sollecito', con([]), false)
  ok('solo «Vengono poco»: niente sollecito', con(['poco']), false)
  ok('«Solo senza email» e «Vengono poco»: niente sollecito', con(['senza-email', 'poco']), false)
  for (const f of ['certificato', 'scadenza', 'arrivo', 'pagare', 'corsi-scaduti', 'fuori']) ok(`acceso «${f}»: il sollecito c'è`, con([f]), true)
  ok('«Vengono poco» insieme a «Da pagare»: il sollecito c\'è', con(['poco', 'pagare']), true)
  ok('«Pagato nel vecchio programma» ha la sua vista: niente colonna, anche con «Da pagare»', con(['pagare', 'pagato-prima']), false)
  ok('«Possibili doppioni» ha la sua vista: niente colonna', con(['fuori', 'doppioni']), false)
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
