// ---------------------------------------------------------------------------
// La fila DAL SITO ALLE RICHIESTE di STATISTICHE, senza browser.
//
//   node scripts/prova-fila-sito.mjs
//
// `src/lib/filaSito.ts`: i quattro gradini (visite, tocchi su Iscriviti,
// richieste dal sito, accolte), quali richieste sono «dal sito», le
// percentuali fra un gradino e l'altro, e il guaio di una metà che non tocca
// l'altra. Visite e tocchi sono quelli di IL SITO, le richieste quelle di DA
// DOVE ARRIVANO LE RICHIESTE: la fila non legge niente di suo. Non va nel CSV,
// che ha solo le lezioni.
// Design: docs/design-canvas/fila-sito/.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/filaSito'", resolveDir: '.', loader: 'ts' },
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

const numeri = (visite, iscriviti) => ({ mesi: [], visite, iscriviti, chiama: 7, scrivici: 11, pagine: [], altrePagine: { quante: 0, visite: 0 }, provenienze: [], altreProvenienze: { quante: 0, visite: 0 }, diretto: 0 })
const riga = (provenienza, stato, n = 1, extra = {}) => ({ ...(provenienza ? { provenienza } : {}), corsi: ['Judo'], stato, n, ...extra })
// Le pagine del sito: `orari` è una pagina, `vecchi-orari` un vecchio indirizzo (un rinvio), `karate` un corso.
const titoli = { home: 'Home', orari: 'Orari', 'vecchi-orari': 'Orari', karate: 'Karate' }

console.log('\n1. i quattro gradini, coi numeri di IL SITO e delle richieste')
{
  const righe = [riga('home', 'accolta', 2), riga('corso-karate', 'accolta', 2), riga('orari', 'nuova', 3), riga('home', 'rifiutata', 2)]
  const f = m.contaFila(numeri(1200, 26), { righe, titoli })
  ok('visite = numeri.visite', f.visite, 1200)
  ok('tocchi = numeri.iscriviti (non Chiama né Scrivici)', f.tocchi, 26)
  ok('richieste dal sito, per persona', f.richieste, 9)
  ok('accolte, nello stato di oggi', f.accolte, 4)
  ok('le tre percentuali', f.passaggi, ['2%', '35%', '44%'])
  ok('le richieste non passano i tocchi', f.oltre, false)
}

console.log('\n2. per persona: una famiglia di tre e una persona sola fanno quattro')
{
  const f = m.contaFila(numeri(100, 2), { righe: [riga('home', 'nuova', 3), riga('home', 'nuova', 1)], titoli })
  ok('quattro richieste', f.richieste, 4)
}

console.log('\n3. «dal sito»: le pagine del sito, i corsi e i vecchi indirizzi; non segreteria, area iscritti, volantini, niente')
{
  for (const [e, voluto] of [
    ['home', true],
    ['corso-karate', true],
    ['orari', true],
    ['vecchi-orari', true],
    ['segreteria', false],
    ['area-iscritti', false],
    ['volantino', false],
    [undefined, false],
    [null, false],
    ['', false],
  ])
    ok(`${JSON.stringify(e)} → ${voluto}`, m.eDalSito(e, titoli), voluto)
  // Anche se il sito avesse una pagina chiamata così, i link della segreteria e dell'area iscritti non sono il sito.
  ok('segreteria resta fuori anche con una pagina omonima', m.eDalSito('segreteria', { ...titoli, segreteria: 'Segreteria' }), false)
  ok('area-iscritti resta fuori anche con una pagina omonima', m.eDalSito('area-iscritti', { ...titoli, 'area-iscritti': 'Area' }), false)
  ok('la Home è del sito anche senza titoli', m.eDalSito('home', {}), true)
  ok('un corso che sul sito non c\'è (un volantino scritto a mano) no', m.eDalSito('corso-estate', titoli), false)
  ok('un nome che ogni oggetto ha (constructor) non è una pagina', m.eDalSito('constructor', titoli), false)
  ok('nemmeno come corso', m.eDalSito('corso-constructor', titoli), false)
  const righe = [
    riga('home', 'nuova'),
    riga('corso-karate', 'nuova'),
    riga('orari', 'nuova'),
    riga('vecchi-orari', 'nuova'),
    riga('segreteria', 'accolta'),
    riga('area-iscritti', 'accolta'),
    riga('volantino', 'accolta'),
    riga(undefined, 'accolta'),
    riga(undefined, 'accolta', 1, { conosciuto: 'sito' }),
  ]
  const f = m.contaFila(numeri(100, 10), { righe, titoli })
  ok('contano solo le prime quattro', f.richieste, 4)
  ok('e nessuna di quelle è accolta', f.accolte, 0)
}

console.log('\n4. gli stati: arrivate tutte (nuove, accolte, rifiutate), accolte solo le accolte')
{
  const f = m.contaFila(numeri(500, 20), { righe: [riga('home', 'accolta', 2), riga('home', 'rifiutata', 1), riga('orari', 'nuova', 2)], titoli })
  ok('richieste dal sito', f.richieste, 5)
  ok('accolte', f.accolte, 2)
}

console.log('\n5. il corso scelto in alto non conta: la fila è di tutta la palestra')
{
  const righe = [riga('home', 'nuova', 1, { corsi: ['Judo'] }), riga('home', 'nuova', 1, { corsi: ['Karate'] })]
  ok('tutte e due le richieste', m.contaFila(numeri(100, 5), { righe, titoli }).richieste, 2)
}

console.log('\n6. le percentuali')
{
  ok('1.200 visite, 26 tocchi', m.percentuale(1200, 26), '2%')
  ok('1.200 visite, 3 tocchi', m.percentuale(1200, 3), "meno dell'1%")
  ok('zero di zero', m.percentuale(0, 0), '—')
  ok('qualcosa di zero', m.percentuale(0, 3), '—')
  ok('zero di qualcosa', m.percentuale(9, 0), '0%')
  ok('9 richieste, 4 accolte', m.percentuale(9, 4), '44%')
  ok('non si sa', m.percentuale(null, 4), '—')
  ok('oltre il 100% non si tronca', m.percentuale(5, 8), '160%')
}

console.log('\n7. le richieste più dei tocchi: lo si dice')
{
  ok('tante quante i tocchi: niente frase', m.contaFila(numeri(100, 3), { righe: [riga('home', 'nuova', 3)], titoli }).oltre, false)
  ok('zero tocchi: niente frase (la percentuale è «—»)', m.contaFila(numeri(100, 0), { righe: [riga('home', 'nuova', 2)], titoli }).oltre, false)
  const f = m.contaFila(numeri(410, 5), { righe: [riga('home', 'accolta', 3), riga('home', 'nuova', 5)], titoli })
  ok('oltre', f.oltre, true)
  ok('la percentuale fra tocchi e richieste', f.passaggi[1], '160%')
}

console.log('\n8. un guaio tocca solo la sua metà')
{
  const senzaSito = m.contaFila(null, { righe: [riga('home', 'accolta', 4), riga('home', 'nuova', 5)], titoli })
  ok('senza i numeri del sito: visite e tocchi non si sanno', [senzaSito.visite, senzaSito.tocchi], [null, null])
  ok('le richieste ci sono', [senzaSito.richieste, senzaSito.accolte], [9, 4])
  ok('niente percentuale verso le richieste', senzaSito.passaggi, ['—', '—', '44%'])
  ok('e niente frase «oltre»', senzaSito.oltre, false)
  const senzaRichieste = m.contaFila(numeri(1200, 26), null)
  ok('senza il file 74: le richieste non si sanno', [senzaRichieste.richieste, senzaRichieste.accolte], [null, null])
  ok('visite e tocchi ci sono', [senzaRichieste.visite, senzaRichieste.tocchi], [1200, 26])
  ok('solo la prima percentuale', senzaRichieste.passaggi, ['2%', '—', '—'])
}

console.log('\n8b. dalle letture di STATISTICHE alla fila: senza i titoli le richieste non si sanno')
{
  const conti = { dal: '2026-10-20', righe: [riga('orari', 'accolta', 2)] }
  const t = (dato, guaio = null) => ({ dato, guaio })
  ok('tutto letto', m.richiesteFila({ dato: { conti }, guaio: null }, t(titoli)), { righe: conti.righe, titoli })
  ok('le richieste si leggono ancora', m.richiesteFila({ dato: null, guaio: null }, t(titoli)), undefined)
  ok('i titoli si leggono ancora: non si contano a metà', m.richiesteFila({ dato: { conti }, guaio: null }, t(null)), undefined)
  ok('i titoli non letti: si dice perché', m.richiesteFila({ dato: { conti }, guaio: null }, t(null, 'Senza rete')), { manca: 'Senza rete' })
  ok('le richieste non lette: il loro guaio', m.richiesteFila({ dato: null, guaio: 'Senza rete' }, t(titoli)), { manca: 'Senza rete' })
  ok('senza il file 74', 'manca' in m.richiesteFila({ dato: { conti: null }, guaio: null }, t(titoli)), true)
  const f = m.contaFila(numeri(100, 5), m.richiesteFila({ dato: { conti }, guaio: null }, t(null)) ?? null)
  ok('e la fila lascia le richieste non sapute, non a zero', [f.richieste, f.accolte], [null, null])
}

console.log('\n9. la fila non legge niente di suo: usa la lettura di IL SITO e quella di DA DOVE')
{
  const sito = readFileSync('src/components/segreteria/StatisticheSito.tsx', 'utf8')
  const pagina = readFileSync('src/components/segreteria/Statistiche.tsx', 'utf8')
  ok('IL SITO chiama statisticheSito una volta sola', sito.match(/\.statisticheSito\(/g)?.length, 1)
  ok('IL SITO non legge le richieste né i titoli', /\.(richiesteDaDove|titoliSito)\(/.test(sito), false)
  ok('STATISTICHE legge le richieste una volta sola', pagina.match(/\.richiesteDaDove\(/g)?.length, 1)
  ok('la fila sta in IL SITO, prima del riquadro', sito.indexOf('<Fila') > -1 && sito.indexOf('<Fila') < sito.indexOf('aria-label="Il sito"'), true)
}

console.log(guai ? `\n${guai} prove non passano` : '\nTutte le prove passano')
process.exit(guai ? 1 : 0)
