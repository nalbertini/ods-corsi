// ---------------------------------------------------------------------------
// ISCRITTI: tre filtri in vista, gli altri dietro «Altri filtri», senza browser.
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

console.log('\nI tre in vista')
ok('certificato, pagare, fuori: in quest\'ordine', m.FILTRI_VISIBILI ?? mancante, ['certificato', 'pagare', 'fuori'])

console.log('\nI testi')
ok('un testo per ognuno degli 11 filtri', m.TESTI_FILTRI ?? mancante, {
  'senza-email': 'Solo senza email', poco: 'Vengono poco', certificato: 'Senza certificato valido',
  scadenza: 'Certificato in scadenza', arrivo: 'Compiono 6 anni', pagare: 'Da pagare', fuori: 'Non in regola',
  'senza-tessera': 'Senza tessera', 'senza-documento': 'Senza documento', 'file-di-prima': 'Non archiviato',
  doppioni: 'Possibili doppioni',
})

console.log('\nGli altri filtri, quelli presenti adesso')
const base = ['senza-email', 'poco', 'scadenza', 'arrivo', 'senza-documento']
ok('nessun opzionale: cinque, nell\'ordine', altri(nessuno), base)
ok('con le tessere: senza-tessera prima di senza-documento', altri({ ...nessuno, conTessere: true }), ['senza-email', 'poco', 'scadenza', 'arrivo', 'senza-tessera', 'senza-documento'])
ok('con i file di prima: file-di-prima in fondo', altri({ ...nessuno, filePrima: 3 }), [...base, 'file-di-prima'])
ok('con i doppioni: doppioni in fondo', altri({ ...nessuno, doppioni: 2 }), [...base, 'doppioni'])
const tutti = altri({ conTessere: true, filePrima: 3, doppioni: 2 })
ok('tutti gli opzionali: otto, nell\'ordine', tutti, ['senza-email', 'poco', 'scadenza', 'arrivo', 'senza-tessera', 'senza-documento', 'file-di-prima', 'doppioni'])
ok('i tre in vista non sono mai fra gli altri', Array.isArray(tutti) ? tutti.filter((x) => ['certificato', 'pagare', 'fuori'].includes(x)) : tutti, [])

console.log('\nIl gruppo aperto')
ok('aperto dall\'utente: aperto', aperti([], true), true)
ok('nessun filtro acceso, gruppo chiuso: chiuso', aperti([], false), false)
ok('acceso uno in vista, gruppo chiuso: chiuso', aperti(['pagare'], false), false)
ok('acceso uno nascosto, gruppo chiuso: si apre da sé', aperti(['poco'], false), true)
ok('acceso uno in vista e uno nascosto: aperto', aperti(['fuori', 'doppioni'], false), true)

console.log('\nIscritti.tsx li prende da src/lib')
{
  const tsx = readFileSync('src/components/segreteria/Iscritti.tsx', 'utf8')
  ok('importa da filtriIscritti', tsx.includes("lib/filtriIscritti'"), true)
  const vecchi = ['SOLO SENZA EMAIL', 'VENGONO POCO', 'SENZA CERTIFICATO VALIDO', 'CERTIFICATO IN SCADENZA', 'COMPIONO 6 ANNI', 'NON IN REGOLA', 'SENZA TESSERA', 'SENZA DOCUMENTO', 'NON ARCHIVIATO', '+ NUOVO ISCRITTO']
  ok('niente più i testi dei filtri in maiuscolo, né «+ NUOVO ISCRITTO»', vecchi.filter((x) => tsx.includes(x)), [])
  ok('«+ Nuovo iscritto» e l\'etichetta di colonna «IN REGOLA?»', ['+ Nuovo iscritto', 'IN REGOLA?'].filter((x) => !tsx.includes(x)), [])
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
