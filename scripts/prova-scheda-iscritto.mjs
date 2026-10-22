// ---------------------------------------------------------------------------
// La scheda dell'iscritto in segreteria, senza browser.
//
//   node scripts/prova-scheda-iscritto.mjs
//
// Il sollecito su WhatsApp è un tasto in testata accanto al nome; le azioni
// rare del piede (Unisci, Esporta, Disattiva/Riattiva) stanno nel menu
// «Altro». Quali voci ha il menu lo decide `vociAltro` (src/lib/segreteria.ts);
// il resto si prova leggendo il sorgente di Iscritti.tsx.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/segreteria'", resolveDir: '.', loader: 'ts' },
  bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
})
const { vociAltro } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

console.log('\nLe voci del menu «Altro»')
const voci = (attiva, inModifica) => (typeof vociAltro === 'function' ? vociAltro({ attiva }, inModifica) : 'vociAltro non esiste')
ok('scheda attiva: unisci, esporta, disattiva', voci(true, false), ['unisci', 'esporta', 'disattiva'])
ok('scheda disattivata: unisci, esporta, riattiva', voci(false, false), ['unisci', 'esporta', 'riattiva'])
ok('in modifica, scheda attiva: il menu non c\'è', voci(true, true), [])
ok('in modifica, scheda disattivata: il menu non c\'è', voci(false, true), [])

console.log('\nLa scheda (sorgente)')
const isc = readFileSync('src/components/segreteria/Iscritti.tsx', 'utf8')
const sol = readFileSync('src/components/segreteria/Sollecito.tsx', 'utf8')

ok('la scheda disattivata dice «Altro → Riattiva»', isc.includes('Per rimetterla: Altro → Riattiva.'), true)
ok('non rimanda più a «RIATTIVA, in fondo alla scheda»', /RIATTIVA,? in fondo alla scheda/.test(isc), false)
ok('la nota sotto ISCRIVI dice «prima Altro → Riattiva»', isc.includes('prima Altro → Riattiva'), true)

ok('il piede ha il menu «Altro»', isc.includes('<MenuAzioni etichetta="Altro"'), true)
ok('il piede non ha più i tasti Unisci/Esporta/Disattiva affiancati', isc.includes('sg-scheda-piede-destra'), false)
const voceMenu = isc.match(/<button\b[^>]*role="menuitem"[^>]*>[\s\S]*?<\/button>/g) ?? []
ok('le voci del menu hanno role="menuitem" (unisci, esporta, disattiva/riattiva)', voceMenu.length >= 3, true)
const disattiva = voceMenu.find((v) => v.includes('Disattiva'))
ok('la voce Disattiva è rossa', !!disattiva && disattiva.includes('sg-pericolo'), true)
ok('la voce Disattiva chiede conferma', !!disattiva && isc.includes('chiedi(confermaDisattiva('), true)
const riattiva = voceMenu.find((v) => v.includes('Riattiva'))
ok('la voce Riattiva non è rossa', !!riattiva && (!riattiva.includes('sg-pericolo') || /attiva\s*(\?|&&)[^}]*sg-pericolo/.test(riattiva)), true)

console.log('\nIl sollecito in testata')
ok('c\'è il tasto «Sollecita su WhatsApp»', (isc + sol).includes('Sollecita su WhatsApp'), true)
ok('il tasto apre e chiude: aria-expanded', /aria-expanded[\s\S]{0,400}Sollecita su WhatsApp|Sollecita su WhatsApp[\s\S]{0,400}aria-expanded/.test(isc + sol), true)
const iSol = isc.indexOf('<SollecitoWhatsApp')
ok('il riquadro sta sopra i timbri', iSol > 0 && iSol < isc.indexOf('<Timbri p={p}'), true)

console.log(guai ? `\n${guai} da sistemare` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
