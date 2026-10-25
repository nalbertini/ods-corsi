// ---------------------------------------------------------------------------
// «Importa dalla banca» (CONTABILITÀ → MOVIMENTI), senza browser.
//
//   node scripts/prova-importa-banca.mjs
//
// Controlla `src/lib/importaBanca.ts` su un CSV inventato fatto come la «Lista movimenti» di
// BancoPosta (TAB, CRLF, riepilogo in testa, intestazione sfasata, date gg/mm/aaaa, importi con la
// virgola): la lettura, l'anteprima senza scrivere (già importati, coperti da un movimento a mano,
// da decidere, avvisi, totali) e i dati per `importa_prima_nota`. Niente nomi veri né IBAN veri: il
// file vero non entra mai nel repository. La metà database è in supabase/prova/importa-banca.sql.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/importaBanca'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
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
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const OGGI = '2026-10-23'
const T = '\t'
// data contabile, data valuta, addebito, accredito, codice causale, testo, tipo operazione
const mov = (data, add, acc, testo, tipo = 'BONIFICO') => [data, data, add, acc, '26', testo, tipo].join(T)
const CSV = [
  'Riepilogo conto BancoPosta Impresa',
  `Saldo contabile${T}1000,00`,
  '',
  'LISTA MOVIMENTI',
  T + ['Data contabile', 'Data valuta', 'Addebito', 'Accredito', 'Causale', 'Descrizione', 'Tipo'].join(T), // sfasata di una colonna
  mov('02/10/2026', '-50,00', '', 'A favore di Anna Bianchi IBAN IT60X0542811101000000123456 CF BNCNNA80A41H501Z   lezioni'), // 6
  mov('03/10/2026', '', '120,00', 'Da Luca Verdi IBAN IT60X0542811101000000654321 saldo corso', 'ACCREDITO'), // 7
  mov('05/10/2026', '-10,00', '', 'Pagamento POS Bar Centro', 'POS'), // 8
  mov('05/10/2026', '-10,00', '', 'Pagamento POS Bar Centro', 'POS'), // 9 (identica alla 8)
  mov('06/10/2026', '', '345,67', 'Accredito Satispay Europe SA', 'ACCREDITO'), // 10
  mov('07/10/2026', '', '100,00', 'Versamento Contanti ATM Torino', 'VERSAMENTO'), // 11
  mov('xx/10/2026', '-5,00', '', 'data rotta'), // 12
  mov('08/10/2026', '', '', 'senza importo'), // 13
  mov('30/10/2026', '-20,00', '', 'Addebito nel futuro'), // 14
  mov('09/10/2026', '', '1234,56', 'Da Anna Bianchi quota annuale', 'ACCREDITO'), // 15
].join('\r\n')
// Un file di una riga sola, per provare un caso solo.
const piccolo = (...righe) => ['LISTA MOVIMENTI', T + 'Data contabile', ...righe].join('\r\n')

console.log('1. la lettura del file')
const L = prova(() => m.leggiBanca(CSV))
const mv = L.movimenti ?? []
{
  ok('otto movimenti letti (la riga futura si scarta in anteprima), due righe scartate', prova(() => [mv.length, L.scartate.length]), [8, 2])
  ok('le righe del file (da 1) di quelli letti', prova(() => mv.map((x) => x.riga)), [6, 7, 8, 9, 10, 11, 14, 15])
  ok('la prima: data contabile, tipo, importo in centesimi, causale', prova(() => [mv[0].data, mv[0].tipo, mv[0].importo, mv[0].causale]), ['2026-10-02', 'uscita', 5000, '26'])
  ok('l\'accredito è un\'entrata', prova(() => [mv[1].tipo, mv[1].importo]), ['entrata', 12000])
  ok('importi senza separatore di migliaia: 1234,56', prova(() => mv[7].importo), 123456)
  ok('descrizione = testo + tipo operazione, senza IBAN né codice fiscale, spazi normalizzati', prova(() => mv[0].descrizione), 'A favore di Anna Bianchi lezioni BONIFICO')
  ok('…anche col solo IBAN', prova(() => mv[1].descrizione), 'Da Luca Verdi saldo corso ACCREDITO')
  ok('una descrizione lunga si taglia a 200 caratteri', prova(() => m.leggiBanca(piccolo(mov('02/10/2026', '-1,00', '', 'x'.repeat(300)))).movimenti[0].descrizione.length), 200)
  ok('dal e al: il primo e l\'ultimo giorno dei movimenti letti', prova(() => [L.dal, L.al]), ['2026-10-02', '2026-10-30'])
  ok('le righe scartate dicono il numero di riga e il testo', prova(() => L.scartate.map((x) => [x.riga, x.testo.includes('data rotta') || x.testo.includes('senza importo') || x.testo.includes('futuro')]).slice(0, 2)), [[12, true], [13, true]])
  ok('…e il motivo', prova(() => L.scartate.slice(0, 2).every((x) => typeof x.motivo === 'string' && x.motivo.length > 3)), true)
  ok('il file senza «LISTA MOVIMENTI»: niente movimenti', prova(() => m.leggiBanca('Saldo\t10,00\r\nun altro file').movimenti), [])
  ok('…e dice di scaricare «Lista movimenti» in CSV', prova(() => { const s = m.leggiBanca('Saldo\t10,00\r\nun altro file').scartate; return [s.length > 0, /Lista movimenti/.test(s[0].motivo) && /CSV/.test(s[0].motivo)] }), [true, true])
  ok('il testo vuoto non dà niente', prova(() => m.leggiBanca('').movimenti), [])
  ok('dal e al senza movimenti', prova(() => [m.leggiBanca('').dal, m.leggiBanca('').al]), [null, null])
}

console.log('\n2. la chiave non cambia')
{
  const k = mv.map((x) => x.chiave)
  ok('forma: banca:aaaammgg:hash:n, al più 100 caratteri, solo i segni ammessi', prova(() => k.every((c) => /^banca:\d{8}:[A-Za-z0-9_.-]+:\d+$/.test(c) && c.length <= 100)), true)
  ok('il giorno è quello del movimento', prova(() => k[0].split(':')[1]), '20261002')
  ok('le chiavi sono tutte diverse', prova(() => new Set(k).size), 8)
  ok('due righe identiche dello stesso giorno hanno la stessa impronta e un n diverso', prova(() => { const a = k[2].split(':'), b = k[3].split(':'); return [a[2] === b[2], a[3] !== b[3]] }), [true, true])
  ok('rileggendo lo stesso file escono le stesse chiavi', prova(() => m.leggiBanca(CSV).movimenti.map((x) => x.chiave)), k)
  ok('con righe in più prima (il riepilogo cambia) le chiavi restano', prova(() => m.leggiBanca('altra riga\r\n' + CSV).movimenti.map((x) => x.chiave)), k)
  ok('un testo o un importo diverso, un\'impronta diversa', prova(() => k[0].split(':')[2] !== k[1].split(':')[2]), true)
}

// Un movimento a mano (o altro) già scritto, con i valori che servono.
let n = 0
const riga = (o) => ({ id: `r${++n}`, origine: 'movimento', tipo: 'uscita', data: '2026-10-02', importo: 5000, descrizione: 'a mano', voce: 'Varie', cassaId: 'conto', annullato: false, ...o })
// Il conto dell'anteprima non include le righe scartate (data nel futuro compresa), né nel numero né nel periodo.
ok('l\'anteprima conta solo i movimenti non scartati, e il periodo con loro', prova(() => { const a = m.anteprimaBanca(L, [], 'conto', OGGI); return [a.lette, a.dal, a.al, a.lette === a.entrano.length + a.giaImportati.length + a.coperti.length + a.daDecidere.length] }), [L.movimenti.length - 1, '2026-10-02', '2026-10-09', true])
const anteprima = (righe, scelte) => prova(() => m.anteprimaBanca(L, righe, 'conto', OGGI, scelte))

console.log('\n3. l\'anteprima senza niente nel registro')
{
  const a = anteprima([])
  ok('entrano i sette validi, la riga futura si scarta', prova(() => [a.entrano.map((x) => x.riga), a.giaImportati.length, a.coperti.length, a.daDecidere.length]), [[6, 7, 8, 9, 10, 11, 15], 0, 0, 0])
  ok('scartate: le due del file e quella nel futuro', prova(() => a.scartate.map((x) => x.riga)), [12, 13, 14])
  ok('i totali: quattro entrate e tre uscite, e la differenza', prova(() => a.totali), { entrate: { conteggio: 4, importo: 180023 }, uscite: { conteggio: 3, importo: 7000 }, differenza: 173023 })
  ok('un accredito con «Satispay Europe»: un avviso, entra comunque', prova(() => [a.avvisi.find((x) => x.tipo === 'satispay'), a.entrano.some((x) => x.riga === 10)]), [{ tipo: 'satispay', conteggio: 1, totale: 34567 }, true])
  ok('un versamento di contanti: un avviso, senza badare alle maiuscole', prova(() => a.avvisi.find((x) => x.tipo === 'contanti')), { tipo: 'contanti', conteggio: 1, totale: 10000 })
  ok('non ci sono altri avvisi', prova(() => a.avvisi.length), 2)
  ok('un addebito che dice «Satispay» non è un versamento da Satispay', prova(() => m.anteprimaBanca(m.leggiBanca(piccolo(mov('02/10/2026', '-5,00', '', 'Satispay Europe commissione'))), [], 'conto', OGGI).avvisi), [])
  ok('un versamento scritto in minuscolo si riconosce', prova(() => m.anteprimaBanca(m.leggiBanca(piccolo(mov('02/10/2026', '', '5,00', 'versamento di contanti'))), [], 'conto', OGGI).avvisi), [{ tipo: 'contanti', conteggio: 1, totale: 500 }])
  ok('oggi si può, domani no', prova(() => [m.anteprimaBanca(m.leggiBanca(piccolo(mov('23/10/2026', '', '1,00', 'x'))), [], 'conto', OGGI).entrano.length, m.anteprimaBanca(m.leggiBanca(piccolo(mov('24/10/2026', '', '1,00', 'x'))), [], 'conto', OGGI).entrano.length]), [1, 0])
}

console.log('\n4. quelli già importati non rientrano')
{
  const a = anteprima([riga({ id: 'x1', origine: 'movimento', tipo: 'entrata', importo: 12000, origineImport: mv[1]?.chiave }), riga({ id: 'x2', tipo: 'uscita', importo: 5000, origineImport: mv[0]?.chiave, annullato: true })])
  ok('la chiave già nel registro: già importato', prova(() => a.giaImportati.map((x) => x.riga)), [6, 7])
  ok('…anche se quel movimento è stato annullato: non rientra', prova(() => a.entrano.some((x) => x.riga === 6)), false)
  ok('…e non è nemmeno coperto o da decidere', prova(() => [a.coperti.length, a.daDecidere.length]), [0, 0])
  ok('i totali non li contano', prova(() => [a.totali.entrate.conteggio, a.totali.uscite.conteggio]), [3, 2])
}

console.log('\n5. un pagamento già scritto a mano nel Conto Corrente è coperto')
{
  const entra6 = (...righe) => prova(() => anteprima(righe).entrano.some((x) => x.riga === 6))
  ok('stesso tipo, importo e giorno: coperto, e dice da quale riga', prova(() => { const a = anteprima([riga({ id: 'mano' })]); return [a.coperti.map((c) => [c.movimento.riga, c.con.id]), a.entrano.some((x) => x.riga === 6)] }), [[[6, 'mano']], false])
  ok('due giorni di distanza vanno bene', prova(() => anteprima([riga({ id: 'm1', data: '2026-09-30' })]).coperti.length), 1)
  ok('…tre no: il movimento entra', entra6(riga({ data: '2026-09-29' })), true)
  ok('un altro importo no', entra6(riga({ importo: 5001 })), true)
  ok('un altro tipo no', entra6(riga({ tipo: 'entrata' })), true)
  ok('un\'altra cassa no', entra6(riga({ cassaId: 'contanti' })), true)
  ok('una riga annullata no', entra6(riga({ annullato: true })), true)
  ok('una riga già importata dalla banca (con un\'altra chiave) non copre', entra6(riga({ origineImport: 'banca:20261002:zzzz:0' })), true)
  ok('copre anche una ricevuta o un pagamento di un iscritto, non solo i movimenti a mano', prova(() => anteprima([riga({ origine: 'ricevuta', tipo: 'uscita' })]).coperti.length), 1)
  ok('con più candidati a distanze diverse vince il più vicino', prova(() => { const a = anteprima([riga({ id: 'lontano', data: '2026-10-04' }), riga({ id: 'vicino', data: '2026-10-03' })]); return [a.coperti.map((c) => c.con.id), a.daDecidere.length] }), [['vicino'], 0])
  ok('un pagamento copre una riga sola: due movimenti identici, un solo pagamento', prova(() => { const a = anteprima([riga({ id: 'u', tipo: 'uscita', importo: 1000, data: '2026-10-05' })]); return [a.coperti.length, a.entrano.filter((x) => x.riga === 8 || x.riga === 9).length] }), [1, 1])
  ok('…con due pagamenti sono coperti tutti e due', prova(() => { const a = anteprima([riga({ id: 'u1', importo: 1000, data: '2026-10-05' }), riga({ id: 'u2', importo: 1000, data: '2026-10-05' })]); return [a.coperti.length, a.entrano.filter((x) => x.riga === 8 || x.riga === 9).length, a.daDecidere.length] }), [2, 0, 0])
}

console.log('\n6. se i candidati sono a pari distanza, decide la segreteria')
{
  const due = [riga({ id: 'prima', tipo: 'entrata', importo: 12000, data: '2026-10-02' }), riga({ id: 'dopo', tipo: 'entrata', importo: 12000, data: '2026-10-04' })]
  const a = anteprima(due)
  ok('due candidati alla stessa distanza: da decidere, con tutti e due', prova(() => a.daDecidere.map((d) => [d.movimento.riga, d.candidati.map((c) => c.id)])), [[7, ['prima', 'dopo']]])
  ok('…non entra e non conta nei totali di quelli che entrano', prova(() => [a.entrano.some((x) => x.riga === 7), a.totali.entrate.conteggio, a.totali.entrate.importo]), [false, 3, 168023])
  const c = anteprima(due, { [mv[1]?.chiave]: 'dopo' })
  ok('scelto un candidato: diventa coperto da quello', prova(() => [c.coperti.map((x) => [x.movimento.riga, x.con.id]), c.daDecidere.length, c.entrano.some((x) => x.riga === 7)]), [[[7, 'dopo']], 0, false])
  const n = anteprima(due, { [mv[1]?.chiave]: 'nessuno' })
  ok('«nessuno»: è un movimento nuovo, entra', prova(() => [n.entrano.some((x) => x.riga === 7), n.daDecidere.length, n.coperti.length, n.totali.entrate.conteggio]), [true, 0, 0, 4])
  ok('una scelta per un altro movimento non cambia niente', prova(() => anteprima(due, { 'banca:20990101:x:0': 'nessuno' }).daDecidere.length), 1)
}

console.log('\n7. quello che si manda al database')
{
  const a = anteprima([riga({ id: 'mano' })])
  const d = prova(() => m.datiImportBanca(a))
  ok('solo quelli che entrano (non i coperti)', prova(() => d.length), 6)
  ok('la forma di una riga: chiave, data, cassa «conto», tipo, importo, descrizione, voce «Da classificare»', prova(() => d[0]), { chiave: mv[1]?.chiave, data: '2026-10-03', cassa: 'conto', tipo: 'entrata', importo: 12000, descrizione: 'Da Luca Verdi saldo corso ACCREDITO', voce: 'Da classificare' })
  ok('le chiavi sono quelle della lettura', prova(() => d.map((x) => x.chiave)), mv.filter((x) => x.riga !== 6 && x.riga !== 14).map((x) => x.chiave))
  ok('niente che non entra: né già importati né da decidere', prova(() => m.datiImportBanca(anteprima([riga({ id: 'x1', tipo: 'entrata', importo: 12000, origineImport: mv[1]?.chiave })])).some((x) => x.chiave === mv[1]?.chiave)), false)
  ok('…una riga da decidere senza scelta non parte', prova(() => m.datiImportBanca(anteprima([riga({ id: 'p', tipo: 'entrata', importo: 12000, data: '2026-10-02' }), riga({ id: 'q', tipo: 'entrata', importo: 12000, data: '2026-10-04' })])).length), 6)
}

console.log('\n8. il codice fiscale letto dalla causale: si tiene a parte, la descrizione resta pulita')
{
  const una = (testo, tipo = 'ACCREDITO') => prova(() => m.leggiBanca(piccolo(mov('05/10/2026', '', '50,00', testo, tipo))).movimenti[0])
  const cf = (testo) => prova(() => una(testo).codiceFiscaleLetto)
  ok('un codice valido (16 caratteri, struttura del codice fiscale) si legge', cf('Da Prudente Genitore PRDDNC70A01L219K saldo'), ['PRDDNC70A01L219K'])
  ok('…anche con la sigla davanti, e la descrizione non lo mostra', prova(() => [una('Da Anna Bianchi CF BNCNNA80A41H501Z lezioni').codiceFiscaleLetto, una('Da Anna Bianchi CF BNCNNA80A41H501Z lezioni').descrizione]), [['BNCNNA80A41H501Z'], 'Da Anna Bianchi lezioni ACCREDITO'])
  ok('nel file di prova: il primo movimento ha il suo, gli altri nessuno', prova(() => mv.map((x) => x.codiceFiscaleLetto)), [['BNCNNA80A41H501Z'], [], [], [], [], [], [], []])
  ok('un codice che non ha la struttura (mese «Z») si scarta, e dalla descrizione se ne va lo stesso', prova(() => [cf('Da Rossi BNCNNA80Z41H501Z saldo'), una('Da Rossi BNCNNA80Z41H501Z saldo').descrizione]), [[], 'Da Rossi saldo ACCREDITO'])
  ok('un codice di quindici caratteri si scarta', cf('Da Rossi BNCNNA80A41H501 saldo'), [])
  ok('un testo senza codici: elenco vuoto, mai «undefined»', cf('Da Rossi saldo'), [])
  ok('al massimo due codici per causale, i primi', cf('Da A PRDDNC70A01L219K e BNCNNA80A41H501Z e GLLMRT85C45L219P'), ['PRDDNC70A01L219K', 'BNCNNA80A41H501Z'])
  ok('lo stesso codice due volte conta uno', cf('Da A PRDDNC70A01L219K e PRDDNC70A01L219K'), ['PRDDNC70A01L219K'])
  ok('il codice non compare in nessun altro campo del movimento (né nella chiave)', prova(() => { const { codiceFiscaleLetto, ...resto } = una('Da A PRDDNC70A01L219K saldo'); return JSON.stringify(resto).includes('PRDDNC70A01L219K') }), false)
  ok('la chiave non cambia: leggere lo stesso file due volte dà le stesse chiavi', prova(() => m.leggiBanca(CSV).movimenti.map((x) => x.chiave)), mv.map((x) => x.chiave))
  const a = prova(() => m.anteprimaBanca(m.leggiBanca(piccolo(mov('05/10/2026', '', '50,00', 'Da A CF PRDDNC70A01L219K saldo', 'ACCREDITO'), mov('06/10/2026', '', '60,00', 'Da B saldo', 'ACCREDITO'))), [], 'conto', OGGI))
  const d = prova(() => m.datiImportBanca(a))
  ok('verso il database il codice parte con la riga che entra: `codiceFiscaleLetto`', prova(() => d[0].codiceFiscaleLetto), ['PRDDNC70A01L219K'])
  ok('…e una riga senza codici non ha il campo (le righe di sempre restano com\'erano)', prova(() => 'codiceFiscaleLetto' in d[1]), false)
  ok('…e la descrizione che parte è pulita', prova(() => d[0].descrizione), 'Da A saldo ACCREDITO')
  ok('un movimento coperto da uno scritto a mano non salva il codice: è già collegato', prova(() => {
    const c = m.anteprimaBanca(m.leggiBanca(piccolo(mov('05/10/2026', '', '50,00', 'Da A CF PRDDNC70A01L219K saldo'))), [riga({ id: 'mano', tipo: 'entrata', importo: 5000, data: '2026-10-05' })], 'conto', OGGI)
    return [c.coperti.length, m.copertiDaSalvare(c).some((x) => JSON.stringify(x).includes('PRDDNC70A01L219K'))]
  }), [1, false])
}

console.log('\n9. «Da decidere»: la persona giusta in cima, e preselezionata se è una sola')
{
  // Candidati a pari distanza (un giorno prima e un giorno dopo), se no il più vicino sarebbe già coperto.
  const entrata = (id, descrizione, data) => riga({ id, tipo: 'entrata', importo: 5000, data, descrizione })
  const decidi = (testo, candidati, perGenitore = {}) => {
    const l = m.leggiBanca(piccolo(mov('05/10/2026', '', '50,00', testo, 'ACCREDITO')))
    const a = m.anteprimaBanca(l, candidati, 'conto', OGGI, {}, perGenitore)
    const d = a.daDecidere[0]
    return { ordine: d?.candidati.map((c) => c.id), preselezionato: d?.preselezionato, come: d?.come, chiave: l.movimenti[0].chiave }
  }
  const prudente = 'Da PRUDENTE DOMENICO,MANCA FEDERICA PAOLA, TRN 1 per Quota associativa 2026/2027 Prudente Manuel BONIFICO SEPA'
  const cs = [entrata('rossi', 'Cliente ROSSI LUCA per QUOTA ASSOCIATIVA', '2026-10-04'), entrata('luca', 'Cliente PRUDENTE LUCA per QUOTA ASSOCIATIVA', '2026-10-04'), entrata('manuel', 'Cliente PRUDENTE MANUEL per QUOTA ASSOCIATIVA', '2026-10-06')]
  const r = prova(() => decidi(prudente, cs))
  ok('nome e cognome interi nel testo: Manuel Prudente primo (Domenico è il genitore, e un cognome solo non basta)', r.ordine, ['manuel', 'rossi', 'luca'])
  ok('…preselezionato, col segno «nome intero»', [r.preselezionato, r.come], ['manuel', { manuel: 'nome intero' }])
  ok('…resta da decidere: niente si scrive senza conferma', prova(() => m.anteprimaBanca(m.leggiBanca(piccolo(mov('05/10/2026', '', '50,00', prudente, 'ACCREDITO'))), cs, 'conto', OGGI).coperti.length), 0)
  ok('gli altri restano nell\'ordine di prima, per vicinanza di data', prova(() => decidi('Da PRUDENTE MANUEL BONIFICO', cs).ordine.slice(1)), ['rossi', 'luca'])
  ok('nome e cognome in altro ordine, senza maiuscole né accenti', prova(() => decidi('da manuél prudente trn', cs).ordine[0]), 'manuel')
  ok('un cognome solo (Prudente) non basta: nessuno sale, nessuno è preselezionato', prova(() => { const x = decidi('Da PRUDENTE DOMENICO TRN 1', cs); return [x.ordine, x.preselezionato, x.come] }), [['rossi', 'luca', 'manuel'], null, {}])
  ok('due con nome e cognome interi (omonimi): salgono tutti e due, nessuno preselezionato', prova(() => { const x = decidi(prudente, [...cs, entrata('omonimo', 'Cliente MANUEL PRUDENTE per CORSO', '2026-10-04')]); return [x.ordine.slice(0, 2).sort(), x.preselezionato] }), [['manuel', 'omonimo'], null])

  const vaccaro = 'Da VACCARO ANDREA TRN 99 BONIFICO SEPA'
  const fs = [entrata('gallo', 'Cliente GALLO MARTA per CORSO', '2026-10-04'), entrata('sofia', 'Cliente BRUNO SOFIA per QUOTA ASSOCIATIVA', '2026-10-06')]
  const g = (ids) => prova(() => { const x = decidi(vaccaro, fs, ids === null ? {} : { [m.leggiBanca(piccolo(mov('05/10/2026', '', '50,00', vaccaro, 'ACCREDITO'))).movimenti[0].chiave]: ids }); return x })
  ok('nessun candidato col nome, uno è figlio di Andrea Vaccaro (lo dice il database): sale in cima, «genitore»', [g(['sofia']).ordine, g(['sofia']).come], [['sofia', 'gallo'], { sofia: 'genitore' }])
  ok('…se è l\'unico, preselezionato', g(['sofia']).preselezionato, 'sofia')
  ok('senza risposta del database (funzione assente o niente) l\'ordine resta quello per data', [g(null).ordine, g(null).preselezionato, g(null).come], [['gallo', 'sofia'], null, {}])
  ok('due figli dello stesso genitore: salgono tutti e due, a scegliere a mano', prova(() => { const x = decidi(vaccaro, [...fs, entrata('elia', 'Cliente BRUNO ELIA per QUOTA ASSOCIATIVA', '2026-10-04')], { [m.leggiBanca(piccolo(mov('05/10/2026', '', '50,00', vaccaro, 'ACCREDITO'))).movimenti[0].chiave]: ['sofia', 'elia'] }); return [x.ordine.slice(0, 2).sort(), x.preselezionato] }), [['elia', 'sofia'], null])
  ok('il nome vince sul genitore: la regola 2 si prova solo se la 1 non trova nessuno', prova(() => {
    const t = 'Da VACCARO ANDREA per Gallo Marta TRN 99'
    const x = decidi(t, fs, { [m.leggiBanca(piccolo(mov('05/10/2026', '', '50,00', t, 'ACCREDITO'))).movimenti[0].chiave]: ['sofia'] })
    return [x.ordine[0], x.preselezionato, x.come]
  }), ['gallo', 'gallo', { gallo: 'nome intero' }])
  ok('un movimento senza nomi né genitori non cambia: stesso ordine di oggi (per data), niente preselezionato', prova(() => { const x = decidi('Bonifico generico TRN 5', cs); return [x.ordine, x.preselezionato] }), [['rossi', 'luca', 'manuel'], null])
}

// L'ultima importazione ancora in piedi, per «Annulla tutta l'importazione».
{
  const r = (id, creatoIl, extra = {}) => ({ id, origine: 'movimento', tipo: 'entrata', data: '2026-10-01', importo: 100, descrizione: 'x', voce: 'Da classificare', cassaId: 'conto', annullato: false, origineImport: `banca:${id}`, creatoIl, ...extra })
  const u = (righe) => m.ultimaImportazione(righe)
  ok('nessuna riga della banca: niente da annullare', u([r('a', '2026-10-01T10:00:00.000Z', { origineImport: undefined })]), null)
  ok('prende il lotto più recente, con quanti sono e il periodo', u([r('a', '2026-10-01T10:00:00.000Z'), r('b', '2026-10-02T10:00:00.000Z', { data: '2026-09-01' }), r('c', '2026-10-02T10:00:00.000Z', { data: '2026-09-20' })]), { creatoIl: '2026-10-02T10:00:00.000Z', conteggio: 2, dal: '2026-09-01', al: '2026-09-20' })
  ok('un lotto già annullato non conta: torna il precedente', u([r('a', '2026-10-01T10:00:00.000Z'), r('b', '2026-10-02T10:00:00.000Z', { annullato: true })])?.creatoIl, '2026-10-01T10:00:00.000Z')
}

// La segreteria di prova rifiuta come `importa_prima_nota`: un pacchetto sbagliato non scrive niente.
{
  const memoria = new Map()
  globalThis.localStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  }
  globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }
  const { outputFiles: of } = await build({
    stdin: { contents: "export { creaSegreteriaProva } from './src/lib/segreteriaProva'", resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  })
  const p = await import('data:text/javascript;base64,' + Buffer.from(of[0].text).toString('base64'))
  const s = p.creaSegreteriaProva()
  const riga = (extra = {}) => ({ chiave: 'banca:20260101:aaa:0', data: '2026-01-02', cassa: 'conto', tipo: 'entrata', importo: 5000, descrizione: 'Bonifico', voce: 'Da classificare', ...extra })
  const esito = async (dati) => {
    const prima = (await s.movimenti()).length
    let e
    try {
      e = `scritti ${await s.importaMovimentiBanca(dati)}`
    } catch (x) {
      e = 'rifiutato'
    }
    return [e, (await s.movimenti()).length - prima]
  }
  ok('una riga buona entra', await esito([riga()]), ['scritti 1', 1])
  ok('rilanciata non si duplica', await esito([riga()]), ['scritti 0', 0])
  ok('la data nel futuro è rifiutata', await esito([riga({ chiave: 'banca:f:0', data: '2999-01-01' })]), ['rifiutato', 0])
  ok('una descrizione vuota è rifiutata', await esito([riga({ chiave: 'banca:d:0', descrizione: '   ' })]), ['rifiutato', 0])
  ok('una descrizione oltre 200 caratteri è rifiutata', await esito([riga({ chiave: 'banca:l:0', descrizione: 'x'.repeat(201) })]), ['rifiutato', 0])
  ok('un importo a zero è rifiutato', await esito([riga({ chiave: 'banca:z:0', importo: 0 })]), ['rifiutato', 0])
  ok('una voce che non c\'è è rifiutata', await esito([riga({ chiave: 'banca:v:0', voce: 'Inventata' })]), ['rifiutato', 0])
  ok('la stessa chiave due volte nel pacchetto è rifiutata', await esito([riga({ chiave: 'banca:k:0' }), riga({ chiave: 'banca:k:0' })]), ['rifiutato', 0])
  ok('più di 1000 righe sono rifiutate', await esito(Array.from({ length: 1001 }, (_, i) => riga({ chiave: `banca:m:${i}` }))), ['rifiutato', 0])
  ok('tutto o niente: una riga sbagliata ferma anche le buone', await esito([riga({ chiave: 'banca:t:0' }), riga({ chiave: 'banca:t:1', data: '2999-01-01' })]), ['rifiutato', 0])
  // L'annullo del lotto tocca solo le righe «banca:» scritte nello stesso istante, non gli altri lotti, e non due volte.
  const vive = async () => (await s.movimenti()).filter((x) => x.origineImport?.startsWith('banca:') && !x.annullatoIl).map((x) => x.origineImport).sort()
  await new Promise((r) => setTimeout(r, 5))
  await s.importaMovimentiBanca([riga({ chiave: 'banca:lotto2:0' })])
  const primo = (await s.movimenti()).find((x) => x.origineImport === 'banca:20260101:aaa:0')
  ok('annullo del lotto: ne toglie uno, l\'altro lotto resta', [await s.annullaImportazioneBanca(primo.creatoIl), await vive()], [1, ['banca:lotto2:0']])
  ok('…e rifatto non annulla più niente', await s.annullaImportazioneBanca(primo.creatoIl), 0)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
