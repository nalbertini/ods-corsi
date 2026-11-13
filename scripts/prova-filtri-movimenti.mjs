// ---------------------------------------------------------------------------
// I filtri di MOVIMENTI, senza browser.
//
//   node scripts/prova-filtri-movimenti.mjs
//
// Controlla `src/lib/filtriMovimenti.ts`: il periodo a mese e anno con le
// frecce, MOSTRA (Da assegnare | Tutti | Annullati), TIPO (Entrate | Uscite |
// Tutti), la riga «N movimenti a …» e quando un movimento appena scritto resta
// fuori dall'elenco. In fondo, che Contabilita.tsx usi questi filtri e non più
// casse, persona, «Mostra annullati» e le pillole; la VOCE c'è, in una riga sola.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: "export * from './src/lib/filtriMovimenti'; export { estrattoConto } from './src/lib/contabilita'",
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

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che non c'è ancora lancia: la prova fallisce con quel messaggio, non si ferma.
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const OGGI = '2026-11-11'
const riga = (id, o = {}) => ({ id, origine: 'movimento', tipo: 'uscita', data: '2026-11-05', importo: 100, descrizione: id, voce: 'Affitto sala', cassaId: 'c1', annullato: false, ...o })

console.log('1. la partenza: il mese corrente, tutti i movimenti non annullati, entrate e uscite')
const base = prova(() => m.filtriIniziali(OGGI))
ok('i filtri di partenza', base, { testo: '', mese: 11, anno: 2026, mostra: 'tutti', tipo: '', voce: '' })

console.log('\n2. il periodo: un mese, un anno intero o tutto')
ok('novembre 2026', prova(() => m.intervalloFiltri(base)), { dal: '2026-11-01', al: '2026-11-30' })
ok('febbraio 2028, anno bisestile', prova(() => m.intervalloFiltri({ ...base, mese: 2, anno: 2028 })), { dal: '2028-02-01', al: '2028-02-29' })
ok('«Tutti i mesi» del 2025: tutto l\'anno', prova(() => m.intervalloFiltri({ ...base, mese: 0, anno: 2025 })), { dal: '2025-01-01', al: '2025-12-31' })
ok('«Tutti gli anni»: nessun limite', prova(() => m.intervalloFiltri({ ...base, mese: 0, anno: 0 })), { dal: '', al: '' })
ok('scegliere «Tutti gli anni» toglie anche il mese', prova(() => m.conPeriodo(base, { anno: 0 }, OGGI)), { ...base, mese: 0, anno: 0 })
ok('scegliere un mese con «Tutti gli anni» va all\'anno corrente', prova(() => m.conPeriodo({ ...base, mese: 0, anno: 0 }, { mese: 3 }, OGGI)), { ...base, mese: 3, anno: 2026 })
ok('scegliere l\'anno tiene il mese', prova(() => m.conPeriodo(base, { anno: 2024 }, OGGI)), { ...base, anno: 2024 })

console.log('\n3. le frecce ‹ › spostano di un mese; › è spenta sul mese corrente')
ok('‹ da novembre: ottobre', prova(() => m.spostaMese(base, -1)), { ...base, mese: 10 })
ok('‹ da gennaio: dicembre dell\'anno prima', prova(() => m.spostaMese({ ...base, mese: 1 }, -1)), { ...base, mese: 12, anno: 2025 })
ok('› da dicembre 2025: gennaio 2026', prova(() => m.spostaMese({ ...base, mese: 12, anno: 2025 }, 1)), { ...base, mese: 1, anno: 2026 })
ok('sul mese corrente › è spenta, ‹ no', prova(() => [m.puoSpostare(base, -1, OGGI), m.puoSpostare(base, 1, OGGI)]), [true, false])
ok('a ottobre › si accende', prova(() => m.puoSpostare({ ...base, mese: 10 }, 1, OGGI)), true)
ok('con «Tutti i mesi» o «Tutti gli anni» le frecce sono spente', prova(() => [m.puoSpostare({ ...base, mese: 0 }, -1, OGGI), m.puoSpostare({ ...base, mese: 0, anno: 0 }, -1, OGGI)]), [false, false])

console.log('\n4. gli anni del menu: quelli con movimenti, dal più recente, sempre col corrente')
ok('2024 e 2025 dai movimenti, più il 2026', prova(() => m.anniConMovimenti([riga('a', { data: '2024-03-01' }), riga('b', { data: '2025-06-01' }), riga('c', { data: '2024-12-31' })], OGGI)), [2026, 2025, 2024])
ok('senza movimenti c\'è solo l\'anno corrente', prova(() => m.anniConMovimenti([], OGGI)), [2026])

console.log('\n5. la riga «N movimenti a …»')
ok('a novembre 2026', prova(() => m.testoConto(38, base)), '38 movimenti a novembre 2026')
ok('uno solo', prova(() => m.testoConto(1, base)), '1 movimento a novembre 2026')
ok('tutto l\'anno', prova(() => m.testoConto(5, { ...base, mese: 0 })), '5 movimenti nel 2026')
ok('tutti gli anni', prova(() => m.testoConto(0, { ...base, mese: 0, anno: 0 })), '0 movimenti in tutto')
// Come il menu di PRESENZE (ore.ts): «ad» davanti ad aprile e agosto.
ok('«ad aprile»', prova(() => m.testoConto(3, { ...base, mese: 4 })), '3 movimenti ad aprile 2026')
ok('«ad agosto»', prova(() => m.testoConto(3, { ...base, mese: 8 })), '3 movimenti ad agosto 2026')

console.log('\n6. Da assegnare: manca la persona, o la voce è «Da classificare»')
{
  const ctx = { ids: new Set(['collegata-da-assegnare']), esiti: { omonimo: 'omonimi', nessuno: 'nessuna' } }
  const quotaSenza = riga('quota-senza', { tipo: 'entrata', voce: 'Quota associativa' })
  const daClass = riga('da-class', { voce: 'Da classificare' })
  const omonimo = riga('omonimo', { tipo: 'entrata', voce: 'Donazioni' })
  const collegata = riga('collegata-da-assegnare', { tipo: 'entrata', voce: 'Corsi e altri pagamenti', personaId: 'p1' })
  const affitto = riga('affitto')
  const annullataDaClass = riga('annullata', { voce: 'Da classificare', annullato: true })
  const conPersona = riga('quota-ok', { tipo: 'entrata', voce: 'Quota associativa', personaId: 'p2' })
  const tutte = [quotaSenza, daClass, omonimo, collegata, affitto, annullataDaClass, conPersona]
  ok('una quota senza persona', prova(() => m.daAssegnare(quotaSenza, ctx)), true)
  ok('un movimento «Da classificare»', prova(() => m.daAssegnare(daClass, ctx)), true)
  ok('uno storico con più persone possibili (omonimi)', prova(() => m.daAssegnare(omonimo, ctx)), true)
  ok('un\'entrata collegata con soldi ancora da assegnare', prova(() => m.daAssegnare(collegata, ctx)), true)
  ok('un affitto con la sua voce no', prova(() => m.daAssegnare(affitto, ctx)), false)
  ok('una quota con la persona no', prova(() => m.daAssegnare(conPersona, ctx)), false)
  ok('un annullato mai', prova(() => m.daAssegnare(annullataDaClass, ctx)), false)
  const ids = (xs) => xs.map((x) => x.id)
  ok('MOSTRA Tutti: i non annullati', prova(() => ids(m.filtraMostra(tutte, 'tutti', ctx))), ['quota-senza', 'da-class', 'omonimo', 'collegata-da-assegnare', 'affitto', 'quota-ok'])
  ok('MOSTRA Annullati: solo gli annullati', prova(() => ids(m.filtraMostra(tutte, 'annullati', ctx))), ['annullata'])
  ok('MOSTRA Da assegnare', prova(() => ids(m.filtraMostra(tutte, 'da_assegnare', ctx))), ['quota-senza', 'da-class', 'omonimo', 'collegata-da-assegnare'])
  // Collegato a una persona ma con la voce ancora da scegliere: va assegnato lo stesso.
  ok('collegato e «Da classificare» è da assegnare', prova(() => m.daAssegnare(riga('x', { personaId: 'p1', voce: 'Da classificare' }), { ids: new Set(), esiti: {} })), true)
  ok('collegato, voce vera, soldi tutti assegnati no', prova(() => m.daAssegnare(riga('y', { personaId: 'p1', voce: 'Affitto' }), { ids: new Set(), esiti: {} })), false)
  ok('scegliere Da assegnare guarda tutto lo storico', prova(() => m.conMostra(base, 'da_assegnare')), { ...base, mostra: 'da_assegnare', mese: 0, anno: 0 })
  ok('scegliere Annullati tiene il periodo', prova(() => m.conMostra(base, 'annullati')), { ...base, mostra: 'annullati' })
}

console.log('\n7. un movimento appena scritto fuori dai filtri: la schermata lo dice')
{
  const nuovo = riga('n', { data: '2026-11-11' })
  ok('dentro il mese si vede', prova(() => m.nonSiVedra(nuovo, base)), false)
  ok('di ottobre, col filtro a novembre, no', prova(() => m.nonSiVedra({ ...nuovo, data: '2026-10-30' }, base)), true)
  ok('un\'uscita col TIPO Entrate no', prova(() => m.nonSiVedra(nuovo, { ...base, tipo: 'entrata' })), true)
  ok('con MOSTRA Annullati no', prova(() => m.nonSiVedra(nuovo, { ...base, mostra: 'annullati' })), true)
  ok('con MOSTRA Da assegnare un affitto no', prova(() => m.nonSiVedra(nuovo, { ...base, mostra: 'da_assegnare' })), true)
  ok('…uno «Da classificare» sì', prova(() => m.nonSiVedra({ ...nuovo, voce: 'Da classificare' }, { ...base, mostra: 'da_assegnare' })), false)
  ok('con la VOCE Tasse un affitto no', prova(() => m.nonSiVedra(nuovo, { ...base, voce: 'Tasse' })), true)
  ok('…con la VOCE Affitto sala sì', prova(() => m.nonSiVedra(nuovo, { ...base, voce: 'Affitto sala' })), false)
  ok('cercando «cena» no', prova(() => m.nonSiVedra(nuovo, { ...base, testo: 'cena' })), true)
  ok('un giroconto con TIPO Uscite no: sposta fra le casse, non esce', prova(() => m.nonSiVedra({ ...nuovo, tipo: 'giroconto', voce: null, cassaAId: 'c2' }, { ...base, tipo: 'uscita' })), true)
  ok('il tasto «Mostralo» porta al suo mese, con tutti i movimenti', prova(() => m.filtriPer({ ...nuovo, data: '2025-03-04' })), { testo: '', mese: 3, anno: 2025, mostra: 'tutti', tipo: '', voce: '' })
}

console.log('\n8. i totali con MOSTRA Annullati: in elenco ma fuori dai saldi')
{
  const casse = [{ id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 1000 }]
  const righe = [riga('a', { importo: 200 }), riga('b', { importo: 50, annullato: true })]
  const t = prova(() => m.estrattoMostra(righe, casse, { ...base, mostra: 'annullati' }, { ids: new Set(), esiti: {} }))
  ok('con Annullati si vede solo l\'annullato', t.righe?.map((x) => x.riga.id), ['b'])
  ok('…con uscite 0,00 e il saldo finale vero (1.000,00 − 200,00)', [t.uscite, t.saldoFinale], [0, 800])
  const tutti = prova(() => m.estrattoMostra(righe, casse, base, { ids: new Set(), esiti: {} }))
  ok('con Tutti solo il valido', tutti.righe?.map((x) => x.riga.id), ['a'])
}

console.log('\n8c. lo storico prima del «dal» della cassa: si vede e si può sistemare, ma non sposta i saldi')
{
  const casse = [{ id: 'c1', nome: 'Conto Corrente', saldoIniziale: 1000, dal: '2025-01-01' }]
  const ctx = { ids: new Set(), esiti: {} }
  const righe = [
    riga('nuova', { data: '2025-03-01', importo: 200 }),
    riga('vecchia', { data: '2023-05-10', importo: 70, voce: 'Pagamento istruttori' }),
    riga('vecchia-entrata', { tipo: 'entrata', data: '2024-02-01', importo: 30, voce: 'Da classificare' }),
    riga('vecchia-annullata', { data: '2023-06-01', importo: 5, annullato: true }),
    riga('vecchio-giro', { tipo: 'giroconto', data: '2023-01-01', importo: 9, voce: null, cassaAId: 'c2' }),
  ]
  const tutti = { ...base, mese: 0, anno: 0 }
  const e = prova(() => m.estrattoMostra(righe, casse, tutti, ctx))
  ok('con Tutti gli anni ci sono anche le righe vecchie, dalla più recente; non i giroconti', e.righe?.map((x) => x.riga.id), ['nuova', 'vecchia-entrata', 'vecchia'])
  ok('…con il loro importo, come in BILANCIO', [e.entrate, e.uscite], [30, 270])
  ok('…ma il saldo finale resta quello della cassa', e.saldoFinale, 800)
  ok('…e la striscia tiene solo entrate e uscite', prova(() => m.striscia(e, tutti).map((x) => x.nome)), ['ENTRATE', 'USCITE'])
  ok('il 2023 da solo', prova(() => m.estrattoMostra(righe, casse, { ...base, mese: 0, anno: 2023 }, ctx).righe.map((x) => x.riga.id)), ['vecchia'])
  ok('il TESTO trova il nome della persona collegata', prova(() => m.estrattoMostra([riga('druetto', { data: '2025-03-01', importo: 50, descrizione: 'Bonifico SEPA', personaId: 'p1' }), ...righe], casse, { ...tutti, testo: 'druetto' }, { ...ctx, nomePersona: (id) => (id === 'p1' ? 'Druetto Marco' : undefined) }).righe.map((x) => x.riga.id)), ['druetto'])
  ok('la VOCE trova le vecchie', prova(() => m.estrattoMostra(righe, casse, { ...tutti, voce: 'Pagamento istruttori' }, ctx).righe.map((x) => x.riga.id)), ['vecchia'])
  ok('Da assegnare trova le vecchie da classificare', prova(() => m.estrattoMostra(righe, casse, m.conMostra(base, 'da_assegnare'), ctx).righe.map((x) => x.riga.id)), ['vecchia-entrata'])
  ok('Annullati trova anche le vecchie annullate, a zero', prova(() => m.estrattoMostra(righe, casse, { ...tutti, mostra: 'annullati' }, ctx).righe.map((x) => [x.riga.id, x.uscita])), [['vecchia-annullata', 0]])
  ok('nel solo 2025 la striscia ha di nuovo i saldi', prova(() => m.striscia(m.estrattoMostra(righe, casse, { ...base, mese: 0, anno: 2025 }, ctx), { ...base, mese: 0, anno: 2025 }).length), 4)
}

console.log('\n8a. VOCE: un menu delle voci dei movimenti, che segue TIPO')
{
  const righe = [riga('a', { voce: 'Tasse' }), riga('b', { voce: 'Affitto sala' }), riga('c', { tipo: 'entrata', voce: 'Affitto sala' }), riga('d', { tipo: 'entrata', voce: 'Contributi comunali' }), riga('g', { tipo: 'giroconto', voce: null }), riga('e', { voce: 'Tasse', annullato: true })]
  ok('le voci in ordine, una volta sola, senza i giroconti', prova(() => m.vociDelFiltro(righe, '')), ['Affitto sala', 'Contributi comunali', 'Tasse'])
  ok('con TIPO Entrate solo quelle di entrata', prova(() => m.vociDelFiltro(righe, 'entrata')), ['Affitto sala', 'Contributi comunali'])
  const casse = [{ id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 0 }]
  const f = { ...base, voce: 'Tasse' }
  ok('con la VOCE Tasse restano solo le tasse', prova(() => m.estrattoMostra(righe, casse, f, { ids: new Set(), esiti: {} }).righe.map((x) => x.riga.id)), ['a'])
  ok('cambiando TIPO una voce che non c\'è più si toglie', prova(() => m.conTipo(righe, f, 'entrata')), { ...f, tipo: 'entrata', voce: '' })
  ok('…una che c\'è resta', prova(() => m.conTipo(righe, { ...base, voce: 'Affitto sala' }, 'entrata')), { ...base, voce: 'Affitto sala', tipo: 'entrata' })
}

console.log('\n8b. la striscia dei totali torna sempre: i saldi solo senza filtri sulle righe')
{
  const casse = [{ id: 'c1', nome: 'Cassa Contanti', saldoIniziale: 1000 }]
  const righe = [riga('a', { importo: 200 }), riga('e', { tipo: 'entrata', importo: 300 })]
  const ctx = { ids: new Set(), esiti: {} }
  const nomi = (f) => prova(() => m.striscia(m.estrattoMostra(righe, casse, f, ctx), f).map((x) => x.nome))
  ok('con Tutti i 4 totali', nomi(base), ['SALDO INIZIALE', 'ENTRATE', 'USCITE', 'SALDO FINALE'])
  // Il saldo è delle casse, entrate e uscite delle righe viste: insieme non tornerebbero.
  ok('con TIPO Uscite solo entrate e uscite', nomi({ ...base, tipo: 'uscita' }), ['ENTRATE', 'USCITE'])
  ok('cercando un testo solo entrate e uscite', nomi({ ...base, testo: 'cena' }), ['ENTRATE', 'USCITE'])
  ok('con una VOCE solo entrate e uscite', nomi({ ...base, voce: 'Affitto sala' }), ['ENTRATE', 'USCITE'])
  ok('con Da assegnare solo entrate e uscite', nomi(m.conMostra(base, 'da_assegnare')), ['ENTRATE', 'USCITE'])
  ok('con Annullati solo entrate e uscite', nomi({ ...base, mostra: 'annullati' }), ['ENTRATE', 'USCITE'])
  const cifre = prova(() => m.striscia(m.estrattoMostra(righe, casse, { ...base, tipo: 'entrata' }, ctx), { ...base, tipo: 'entrata' }).map((x) => x.cifra))
  ok('zero uscite: la cifra senza il meno', typeof cifre?.[1] === 'string' && !cifre[1].includes('−'), true)
}

console.log('\n9. Contabilita.tsx: i filtri nuovi, con la voce, niente casse, persona, annullati e pillole')
{
  const tsx = readFileSync('src/components/segreteria/Contabilita.tsx', 'utf8')
  const da = tsx.indexOf('function Movimenti(')
  const fino = tsx.indexOf('function CambiaVoce(')
  const corpo = da >= 0 && fino > da ? tsx.slice(da, fino) : ''
  ok('i filtri partono da filtriIniziali(oggi)', /useState<FiltriElenco>\(\(\) => filtriIniziali\(oggi\)\)/.test(corpo), true)
  ok('MOSTRA e TIPO sono a segmenti', /<Segmenti[^>]*Quali movimenti/.test(corpo) && /<Segmenti[^>]*Entrate o uscite/.test(corpo), true)
  ok('il periodo ha le frecce Mese prima e Mese dopo', /Mese prima/.test(corpo) && /Mese dopo/.test(corpo), true)
  ok('niente più casse, persona e «Mostra annullati»', [/<FiltroCasse /, /id="filtro-persona"/, /Mostra annullati/].map((r) => r.test(corpo)), [false, false, false])
  ok('c\'è il menu VOCE, con le voci di vociDelFiltro', /id="filtro-voce"/.test(corpo) && /vociDelFiltro\(/.test(corpo), true)
  ok('i filtri stanno su una riga sola', (corpo.match(/className="sg-elenco-barra/g) ?? []).length, 1)
  ok('niente più pillole né «Togli i filtri»', [/filtriAccesi\(/, /togliFiltro\(/, /Togli i filtri/].map((r) => r.test(corpo)), [false, false, false])
  ok('«Vedi i da decidere» porta a MOSTRA Da assegnare', /onVediDaDecidere=\{[^}]*conMostra\([^)]*'da_assegnare'\)/.test(corpo), true)
  ok('anche «Vedi» dopo l\'importazione della banca', /onVedi=\{[^}]*conMostra\([^)]*'da_assegnare'\)/.test(corpo), true)
  ok('la striscia dei totali viene da striscia()', /striscia\(estratto, f\)/.test(corpo), true)
  ok('dopo la registrazione fuori dai filtri lo dice (`nonSiVedra`)', /nonSiVedra\(/.test(corpo), true)
  const lib = readFileSync('src/lib/contabilita.ts', 'utf8')
  ok('in contabilita.ts non restano i filtri vecchi', [/export function filtriAccesi/, /export function togliFiltro/, /export function filtriAttivi/, /PERIODO_INIZIALE/].map((r) => r.test(lib)), [false, false, false, false])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
