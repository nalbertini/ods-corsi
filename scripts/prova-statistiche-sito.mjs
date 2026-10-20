// ---------------------------------------------------------------------------
// IL SITO in STATISTICHE: i numeri di GoatCounter per la segreteria, senza rete.
//
//   node scripts/prova-statistiche-sito.mjs
//
// src/lib/sitoNumeri.ts tiene le regole che servono alla funzione
// `statistiche-sito` (giorni di Roma in UTC, mese per mese, pagine e
// provenienze); la funzione ne ha una copia identica in
// supabase/functions/statistiche-sito/numeri.ts, perché Deno non legge src/lib.
// src/lib/sitoStatistiche.ts tiene quelle dell'app: memoria di 10 minuti,
// AGGIORNA una volta al minuto, «si conta dal», le frasi d'errore e i numeri
// della modalità prova.
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const impacchetta = async (file) => {
  if (!existsSync(file)) return {}
  const { outputFiles } = await build({
    stdin: { contents: `export * from './${file.replace(/\.ts$/, '')}'`, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}
const leggi = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `errore: ${e instanceof Error ? e.message : e}`
  }
}

const N = await impacchetta('src/lib/sitoNumeri.ts')
const S = await impacchetta('src/lib/sitoStatistiche.ts')

console.log('I giorni di Roma in UTC')
const roma = (g) => prova(() => N.inizioGiornoRoma(g).toISOString())
ok('24 ottobre 2026 (ora legale)', roma('2026-10-24'), '2026-10-23T22:00:00.000Z')
ok('25 ottobre 2026: la mezzanotte è ancora ora legale', roma('2026-10-25'), '2026-10-24T22:00:00.000Z')
ok('26 ottobre 2026: ora solare', roma('2026-10-26'), '2026-10-25T23:00:00.000Z')
ok('15 gennaio 2027', roma('2027-01-15'), '2027-01-14T23:00:00.000Z')
ok('28 marzo 2027: la mezzanotte è ancora ora solare', roma('2027-03-28'), '2027-03-27T23:00:00.000Z')
ok('29 marzo 2027: ora legale', roma('2027-03-29'), '2027-03-28T22:00:00.000Z')

console.log('Il periodo da chiedere a GoatCounter')
ok('si conta dal 20 ottobre 2026', N.SITO_DAL, '2026-10-20')
ok('da settembre: comincia il 20 ottobre, finisce a mezzanotte dopo l’ultimo giorno', prova(() => N.intervalloSito('2026-09-01', '2026-10-31')), { start: '2026-10-19T22:00:00Z', end: '2026-10-31T23:00:00Z' })
ok('un periodo dopo il 20 ottobre resta com’è', prova(() => N.intervalloSito('2027-01-01', '2027-03-17')), { start: '2026-12-31T23:00:00Z', end: '2027-03-17T23:00:00Z' })
ok('tutto prima del contatore: niente da chiedere', prova(() => N.intervalloSito('2026-09-01', '2026-10-19')), null)
ok('i mesi: dal mese del contatore, senza quelli prima', prova(() => N.mesiDelPeriodo('2026-09-01', '2027-01-10')), ['2026-10', '2026-11', '2026-12', '2027-01'])
ok('i mesi di un periodo dopo il contatore', prova(() => N.mesiDelPeriodo('2027-01-01', '2027-03-17')), ['2027-01', '2027-02', '2027-03'])
ok('un giorno storto non passa', prova(() => N.giornoValido('2027-02-30')), false)
ok('un giorno dritto passa', prova(() => N.giornoValido('2027-02-28')), true)

console.log('Il riassunto di quello che dice GoatCounter')
const giorno = (day, daily) => ({ day, daily, hourly: [] })
const totale = {
  total: 400, total_events: 40,
  stats: [giorno('2026-12-30', 100), giorno('2026-12-31', 60), giorno('2027-01-02', 140), giorno('2027-01-03', 100)],
}
const pagina = (path, title, count) => ({ path, title, count, event: false, stats: [] })
const evento = (path, stats) => ({ path, title: path, event: true, count: stats.reduce((s, x) => s + x.daily, 0), stats })
const hits = {
  hits: [
    pagina('/', 'Officine dello Sport', 300),
    pagina('/corsi', 'I corsi', 120),
    pagina('/corsi/judo', 'Judo', 90),
    pagina('/orari', 'Orari', 70),
    pagina('/sbagliata', '404', 65),
    pagina('/corsi/karate', 'Karate', 50),
    pagina('/contatti', 'Contatti', 20),
    pagina('/chi-siamo', '', 10),
    evento('iscriviti', [giorno('2026-12-30', 5), giorno('2027-01-02', 7)]),
    evento('chiama', [giorno('2026-12-31', 3), giorno('2027-01-03', 4)]),
    evento('/scrivici', [giorno('2027-01-02', 9)]),
    evento('altro-clic', [giorno('2027-01-03', 12)]),
  ],
  more: false,
}
const refs = {
  hits: [
    { name: 'Google', count: 150 },
    { name: '', count: 120 },
    { name: 'Instagram', count: 60 },
    { name: 'Facebook', count: 30 },
    { name: '(unknown)', count: 10 },
    { name: 'Bing', count: 8 },
    { name: 'Pagine Gialle', count: 6 },
    { name: 'DuckDuckGo', count: 4 },
    { name: 'Ecosia', count: 2 },
  ],
}
const r = prova(() => N.riassumi(totale, hits, refs, '2026-12-01', '2027-01-10'))
ok('i mesi del periodo', r.mesi?.map((m) => m.mese), ['2026-12', '2027-01'])
ok('dicembre: le visite senza i clic (100+60-5-3)', r.mesi?.[0]?.visite, 152)
ok('gennaio: le visite senza i clic (140+100-7-9-4-12)', r.mesi?.[1]?.visite, 208)
ok('dicembre: Iscriviti, Chiama, Scrivici', r.mesi?.[0] && [r.mesi[0].iscriviti, r.mesi[0].chiama, r.mesi[0].scrivici], [5, 3, 0])
ok('gennaio: Iscriviti, Chiama, Scrivici (anche con la barra davanti)', r.mesi?.[1] && [r.mesi[1].iscriviti, r.mesi[1].chiama, r.mesi[1].scrivici], [7, 4, 9])
ok('il totale delle visite è la somma dei mesi', r.visite, 360)
ok('i totali dei tre tasti', r && [r.iscriviti, r.chiama, r.scrivici], [12, 7, 9])
ok('le 5 pagine più lette, senza la 404 e senza i clic', r.pagine?.map((p) => p.percorso), ['/', '/corsi', '/corsi/judo', '/orari', '/corsi/karate'])
ok('col titolo della pagina', r.pagine?.[2]?.titolo, 'Judo')
ok('le altre pagine: quante e quante visite', r.altrePagine, { quante: 2, visite: 30 })
ok('le 5 provenienze più grandi, senza il diretto', r.provenienze?.map((p) => p.nome), ['Google', 'Instagram', 'Facebook', 'Bing', 'Pagine Gialle'])
ok('le altre provenienze', r.altreProvenienze, { quante: 2, visite: 6 })
ok('«Diretto o non si sa»: senza nome e (unknown) insieme', r.diretto, 130)
ok('la 404 non c’è da nessuna parte', typeof r === 'object' && !JSON.stringify(r).includes('sbagliata'), true)
ok('una pagina senza titolo si chiama col percorso', prova(() => N.riassumi(totale, { hits: [pagina('/chi-siamo', '', 3)] }, refs, '2026-12-01', '2027-01-10').pagine?.[0]?.titolo), '/chi-siamo')
ok('una risposta vuota non rompe: mesi a zero', prova(() => N.riassumi({}, {}, {}, '2027-01-01', '2027-01-31').mesi), [{ mese: '2027-01', visite: 0, iscriviti: 0, chiama: 0, scrivici: 0 }])
ok('un mese con più clic che visite non va sotto zero', prova(() => N.riassumi({ stats: [giorno('2027-01-02', 2)] }, { hits: [evento('chiama', [giorno('2027-01-02', 5)])] }, {}, '2027-01-01', '2027-01-31').mesi?.[0]?.visite), 0)
ok('i giorni fuori dai mesi del periodo non contano', prova(() => N.riassumi({ stats: [giorno('2026-10-19', 50), giorno('2026-10-20', 4)] }, {}, {}, '2026-09-01', '2026-10-31').visite), 4)

ok('un titolo lunghissimo da GoatCounter si taglia a 120 caratteri', prova(() => N.riassumi({}, { hits: [pagina('/x', 'a'.repeat(300), 5)] }, { hits: [{ name: 'b'.repeat(300), count: 2 }] }, '2027-01-01', '2027-01-31')).pagine?.[0]?.titolo.length, 120)
ok('… anche il nome di una provenienza', prova(() => N.riassumi({}, {}, { hits: [{ name: 'b'.repeat(300), count: 2 }] }, '2027-01-01', '2027-01-31')).provenienze?.[0]?.nome.length, 120)

console.log('Se GoatCounter non dà i giorni dei clic')
const senzaGiorni = { hits: [{ path: 'iscriviti', title: 'iscriviti', event: true, count: 10 }, { path: 'chiama', title: 'chiama', event: true, count: 3 }] }
const conGiorni = { stats: [giorno('2026-12-10', 100), giorno('2027-01-10', 300)] }
const st = prova(() => N.riassumi(conGiorni, senzaGiorni, {}, '2026-12-01', '2027-01-31'))
ok('i tocchi non vanno persi: il totale resta', st && [st.iscriviti, st.chiama], [10, 3])
ok('si spartiscono sui mesi come le visite (1 a 3)', st.mesi?.map((x) => [x.iscriviti, x.chiama]), [[3, 1], [7, 2]])
ok('e i numeri dicono che i mesi sono stimati', st.stimati, true)
ok('con i giorni non sono stimati', r.stimati, undefined)

console.log('Più di 100 voci: le pagine seguenti')
const pag1 = { hits: [{ ...pagina('/', 'Home', 50), path_id: 1 }, { ...pagina('/corsi', 'I corsi', 40), path_id: 2 }], more: true }
const pag2 = { hits: [{ ...pagina('/orari', 'Orari', 30), path_id: 3 }, evento('chiama', [giorno('2027-01-05', 4)])], more: false }
ok('le pagine seguenti si sommano alla prima', prova(() => N.riassumi({ stats: [giorno('2027-01-05', 20)] }, [pag1, pag2], {}, '2027-01-01', '2027-01-31')).pagine?.map((x) => x.percorso), ['/', '/corsi', '/orari'])
ok('… anche i clic', prova(() => N.riassumi({ stats: [giorno('2027-01-05', 20)] }, [pag1, pag2], {}, '2027-01-01', '2027-01-31')).chiama, 4)
ok('quali voci escludere alla pagina dopo', prova(() => N.giaViste([pag1])), '1,2')
ok('se ce ne sono ancora', prova(() => [N.ancoraVoci(pag1), N.ancoraVoci(pag2)]), [true, false])

console.log('La funzione statistiche-sito')
const lib = leggi('src/lib/sitoNumeri.ts')
const copia = leggi('supabase/functions/statistiche-sito/numeri.ts')
ok('la funzione tiene una copia identica delle regole', lib !== '' && copia === lib, true)
ok('le regole non importano niente (Deno le legge così come sono)', /^\s*import\s/m.test(lib), false)
const fn = leggi('supabase/functions/statistiche-sito/index.ts')
ok('usa la copia', fn.includes("from './numeri.ts'"), true)
ok('il segreto è GOATCOUNTER_CHIAVE', fn.includes("Deno.env.get('GOATCOUNTER_CHIAVE')"), true)
ok('il sito è fisso: ods', fn.includes('https://ods.goatcounter.com/api/v0'), true)
ok('solo la segreteria attiva', ["eq('ruolo', 'staff')", "eq('attiva', true)"].every((x) => fn.includes(x)), true)
ok('tre indirizzi: total, hits, toprefs', [...new Set([...fn.matchAll(/\/stats\/[a-z]+/g)].map((m) => m[0]))].sort(), ['/stats/hits', '/stats/toprefs', '/stats/total'])
ok('risponde 401, 403, 400, 501, 502', [401, 403, 400, 501, 502].every((s) => new RegExp(`,\\s*${s}[,)]`).test(fn)), true)
ok('la chiave non torna mai all’app', /risposta\([^)]*chiave/.test(fn), false)
const iStaff = fn.indexOf("eq('ruolo', 'staff')")
const i403 = fn.indexOf(', 403)')
const iChiave = fn.indexOf("Deno.env.get('GOATCOUNTER_CHIAVE')")
ok('prima si guarda chi chiama, poi si prende la chiave', iStaff > 0 && i403 > iStaff && iChiave > i403, true)
ok('fino a 3 pagine di voci, non di più', /PAGINE_MASSIME = 3\b/.test(fn), true)

console.log('Le regole dell’app')
ok('«si conta dal» quando il periodo comincia prima', prova(() => S.contaDal('2026-09-01')), '20 ottobre 2026')
ok('niente frase se comincia il 20 ottobre', prova(() => S.contaDal('2026-10-20')), null)
ok('niente frase se comincia dopo', prova(() => S.contaDal('2027-01-01')), null)
const m = prova(() => S.creaMemoria())
const t0 = Date.UTC(2027, 2, 17, 9, 42)
const numeri = { visite: 1 }
m.salva?.('2027-01-01|2027-03-17', numeri, t0)
ok('la memoria ridà i numeri entro 10 minuti', m.leggi?.('2027-01-01|2027-03-17', t0 + 9 * 60_000 + 59_000)?.numeri, numeri)
ok('dopo 10 minuti si rileggono', m.leggi?.('2027-01-01|2027-03-17', t0 + 10 * 60_000), undefined)
ok('la memoria è per periodo', m.leggi?.('2026-10-01|2027-03-17', t0 + 1000), undefined)
ok('la memoria dice quando sono stati letti', m.leggi?.('2027-01-01|2027-03-17', t0 + 1000)?.letti, t0)
const mm = prova(() => S.creaMemoria())
const kA = '2027-01-01|2027-03-17'
const kB = '2026-10-01|2027-03-17'
ok('niente in memoria: si legge', mm.daLeggere?.(kA, t0), { cosa: 'leggi' })
mm.ricevuto?.(kA, { guaio: 'non-risponde' }, t0)
ok('un guaio si tiene: riaprendo entro il minuto non si richiama', mm.daLeggere?.(kA, t0 + 30_000), { cosa: 'aspetta', stato: { guaio: 'non-risponde', letti: t0 } })
ok('dopo il minuto, riaprendo si rilegge', mm.daLeggere?.(kA, t0 + 60_000), { cosa: 'leggi' })
ok('anche un guaio conta come ultima lettura', mm.ultima?.(kA), t0)
mm.ricevuto?.(kA, { numeri }, t0 + 70_000)
ok('i numeri in memoria per 10 minuti', mm.daLeggere?.(kA, t0 + 70_000 + 9 * 60_000), { cosa: 'memoria', stato: { numeri, letti: t0 + 70_000 } })
ok('dopo 10 minuti si rileggono', mm.daLeggere?.(kA, t0 + 70_000 + 10 * 60_000), { cosa: 'leggi' })
// Una lettura partita per il periodo B e arrivata quando si guarda già A: si salva lo stesso, per B.
mm.ricevuto?.(kB, { numeri }, t0 + 80_000)
ok('una lettura arrivata tardi si tiene per il suo periodo', mm.daLeggere?.(kB, t0 + 81_000), { cosa: 'memoria', stato: { numeri, letti: t0 + 80_000 } })
ok('e conta come ultima lettura di quel periodo', mm.ultima?.(kB), t0 + 80_000)
ok('il periodo A non cambia', mm.ultima?.(kA), t0 + 70_000)
ok('AGGIORNA: quanto manca, dopo una lettura', mm.aggiornaFra?.(kA, t0 + 70_000 + 20_000), 40_000)
ok('AGGIORNA: niente da aspettare dopo il minuto', mm.aggiornaFra?.(kA, t0 + 70_000 + 60_000), 0)
ok('AGGIORNA: niente da aspettare senza letture', mm.aggiornaFra?.('2025-01-01|2025-02-01', t0), 0)
ok('AGGIORNA spento entro un minuto dalla lettura', prova(() => S.puoAggiornare(t0, t0 + 59_000)), false)
ok('AGGIORNA acceso dopo un minuto', prova(() => S.puoAggiornare(t0, t0 + 60_000)), true)
ok('AGGIORNA acceso se non s’è letto niente', prova(() => S.puoAggiornare(null, t0)), true)
ok('«Letti alle» in ora di Roma', prova(() => S.lettiAlle(t0)), 'Letti alle 10:42')

console.log('Gli errori, per chi usa l’app')
const tipi = ['non-pubblicata', 'chiave-manca', 'chiave-rifiutata', 'aspetta', 'non-risponde', 'senza-rete', 'accesso']
ok('sette guai, ognuno con titolo e frase', tipi.map((t) => !!(S.TESTI_GUAI?.[t]?.titolo && S.TESTI_GUAI?.[t]?.frase)), tipi.map(() => true))
ok('quelli che passano dicono di riprovare con Aggiorna', ['aspetta', 'non-risponde', 'senza-rete'].map((t) => /Aggiorna/.test(S.TESTI_GUAI?.[t]?.frase ?? '')), [true, true, true])
ok('l’accesso dice di uscire e rientrare', /esci e rientra/.test(S.TESTI_GUAI?.accesso?.frase ?? ''), true)
ok('non pubblicata dice anche della rete debole', /rete è debole: riprova con Aggiorna/.test(S.TESTI_GUAI?.['non-pubblicata']?.frase ?? ''), true)
ok('quelli della chiave dicono a chi chiedere', ['non-pubblicata', 'chiave-manca', 'chiave-rifiutata'].map((t) => /chi segue l’app/.test(S.TESTI_GUAI?.[t]?.frase ?? '')), [true, true, true])
const tipo = (stato, corpo, nome, rete = true) => prova(() => S.tipoDaRisposta(stato, corpo, nome, rete))
ok('404: la funzione non è pubblicata', tipo(404, null, 'FunctionsHttpError'), 'non-pubblicata')
ok('il tipo detto dalla funzione', tipo(501, { guaio: 'x', tipo: 'chiave-manca' }, 'FunctionsHttpError'), 'chiave-manca')
ok('la chiave rifiutata', tipo(502, { tipo: 'chiave-rifiutata' }, 'FunctionsHttpError'), 'chiave-rifiutata')
ok('GoatCounter chiede di aspettare', tipo(502, { tipo: 'aspetta' }, 'FunctionsHttpError'), 'aspetta')
ok('401 della funzione: l’accesso', tipo(401, { guaio: 'Serve un accesso da segreteria' }, 'FunctionsHttpError'), 'accesso')
ok('403 della funzione: l’accesso', tipo(403, { guaio: 'Non hai il permesso' }, 'FunctionsHttpError'), 'accesso')
ok('senza rete', tipo(undefined, null, 'FunctionsFetchError', false), 'senza-rete')
ok('con la rete ma la funzione non raggiunta: non pubblicata (o rete debole)', tipo(undefined, null, 'FunctionsFetchError', true), 'non-pubblicata')
ok('un tipo sconosciuto: non risponde', tipo(502, { tipo: 'boh' }, 'FunctionsHttpError'), 'non-risponde')
ok('un 500 qualunque: non risponde', tipo(500, null, 'FunctionsHttpError'), 'non-risponde')
ok('un corpo che non è un oggetto: decide lo stato', tipo(404, 'boh', 'FunctionsHttpError'), 'non-pubblicata')
ok('la regola sta in src/lib, non in segreteriaSupabase.ts', leggi('src/lib/segreteriaSupabase.ts').includes('tipoDaRisposta('), true)

console.log('Le etichette dei mesi')
ok('corto e lungo', prova(() => S.nomeMeseSito('2026-10')), { corto: 'ott', lungo: 'Ottobre 2026' })
ok('il primo mese col contatore dice «dal 20»', prova(() => S.notaMese('2026-10', '2026-09-01', '2027-03-17')), 'dal 20')
ok('l’ultimo mese, se è quello di oggi, dice «fino a oggi»', prova(() => S.notaMese('2027-03', '2027-01-01', '2027-03-17')), 'fino a oggi')
ok('un mese intero non dice niente', prova(() => S.notaMese('2027-02', '2027-01-01', '2027-03-17')), '')

console.log('La modalità prova')
const p3 = prova(() => S.numeriDiProva('2027-01-01', '2027-03-17'))
const p6 = prova(() => S.numeriDiProva('2026-10-01', '2027-03-17'))
ok('fissi: due volte gli stessi', JSON.stringify(p3) === JSON.stringify(S.numeriDiProva?.('2027-01-01', '2027-03-17')), true)
ok('proporzionati al periodo: sei mesi sono di più di tre', p6.visite > p3.visite, true)
ok('i mesi sono quelli del periodo, dal contatore', p6.mesi?.map((x) => x.mese), ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'])
ok('cinque pagine, cinque provenienze e il diretto', [p3.pagine?.length, p3.provenienze?.length, p3.diretto > 0], [5, 5, true])
ok('il totale è la somma dei mesi', p3.mesi?.reduce((s, x) => s + x.visite, 0), p3.visite)
ok('dicono di essere di prova', p3.prova, true)
ok('la modalità prova non chiama niente', /fetch|invoke/.test(leggi('src/lib/sitoStatistiche.ts')), false)

console.log('L’app')
const seg = leggi('src/lib/segreteria.ts')
ok('DatiSegreteria ha statisticheSito', /statisticheSito\(da: string, a: string\): Promise<LetturaSito>/.test(seg), true)
const sup = leggi('src/lib/segreteriaSupabase.ts')
ok('Supabase chiama la funzione statistiche-sito', sup.includes("functions.invoke('statistiche-sito'"), true)
ok('la prova usa i numeri inventati', leggi('src/lib/segreteriaProva.ts').includes('numeriDiProva('), true)
const stat = leggi('src/components/segreteria/Statistiche.tsx')
const iSito = stat.indexOf('<StatisticheSito')
ok('IL SITO sta in fondo, dopo INCASSI', iSito > stat.indexOf('INCASSI MESE PER MESE') && stat.indexOf('INCASSI MESE PER MESE') > 0, true)
ok('IL SITO non va nel CSV', /scaricaCsv[\s\S]*?sito/i.test(stat.slice(stat.indexOf('function scaricaCsv'), stat.indexOf('export function Statistiche'))), false)
ok('il componente c’è', existsSync('src/components/segreteria/StatisticheSito.tsx'), true)
const comp = leggi('src/components/segreteria/StatisticheSito.tsx')
ok('il componente non importa da Statistiche.tsx (niente giro di import)', /from '\.\/Statistiche'/.test(comp), false)
ok('il componente non tiene regole di lettura sue', /new Map|puoAggiornare\(|MEMORIA_MS/.test(comp), false)
ok('l’errore è il Guaio di comune.tsx, col titolo', /<Guaio[^>]*titolo=/.test(comp), true)

console.log(guai ? `\n${guai} prove non passano` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
