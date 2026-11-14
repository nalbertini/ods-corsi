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
const { vociAltro, azioniTestata, vociQuota } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

console.log('\nLe voci del menu «Altro»')
const voci = (attiva, inModifica) => (typeof vociAltro === 'function' ? vociAltro({ attiva }, inModifica) : 'vociAltro non esiste')
ok('scheda attiva: unisci, esporta, disattiva', voci(true, false), ['unisci', 'esporta', 'disattiva'])
ok('scheda disattivata: unisci, esporta, riattiva', voci(false, false), ['unisci', 'esporta', 'riattiva'])
ok('in modifica, scheda attiva: il menu non c\'è', voci(true, true), [])
ok('in modifica, scheda disattivata: il menu non c\'è', voci(false, true), [])

console.log('\nLe azioni in testata')
const azioni = (...a) => (typeof azioniTestata === 'function' ? azioniTestata(...a) : 'azioniTestata non esiste')
const attiva = { attiva: true }
const altro = ['unisci', 'esporta', 'disattiva']
ok('da sollecitare, niente da pagare: il sollecito è il tasto giallo', azioni(attiva, true, {}), { pieno: 'sollecito', pagamento: true, sollecito: true, altro })
ok('da sollecitare e da pagare: il tasto giallo è il pagamento, il sollecito a filo', azioni(attiva, true, { daPagare: true }), { pieno: 'pagamento', pagamento: true, sollecito: true, altro })
ok('niente da sollecitare: pagamento pieno e Altro', azioni(attiva, false, {}), { pieno: 'pagamento', pagamento: true, sollecito: false, altro })
ok('in modifica: resta il sollecito, pieno; né pagamento né Altro', azioni(attiva, true, { modifica: true }), { pieno: 'sollecito', pagamento: false, sollecito: true, altro: [] })
ok('genitore non iscritto: niente pagamento, il sollecito pieno', azioni(attiva, true, { soloGenitore: true }), { pieno: 'sollecito', pagamento: false, sollecito: true, altro })
ok('genitore non iscritto senza sollecito: nessun tasto pieno', azioni(attiva, false, { soloGenitore: true }), { pieno: null, pagamento: false, sollecito: false, altro })
ok("durante l'unione: niente", azioni(attiva, true, { unendo: true }), { pieno: null, pagamento: false, sollecito: false, altro: [] })
ok('durante il pagamento: niente', azioni(attiva, true, { pagando: true }), { pieno: null, pagamento: false, sollecito: false, altro: [] })

console.log('\nLe voci della quota nel menu «Altro» (la sezione QUOTA non c\'è più)')
const vq = (pagamento, quote = []) => (typeof vociQuota === 'function' ? vociQuota({ pagamento, quote }, '2026-11-13') : 'vociQuota non esiste')
ok('quota da pagare: «Segna la quota pagata»', vq({ stato: 'da_pagare' }), ['segna'])
ok('quota pagata con una ricevuta: niente', vq({ stato: 'da_pagare' }, [{ dal: '2026-09-01', al: '2027-07-31', mancano: 0, numero: 3, anno: 2026 }]), [])
ok('pagata fuori dall\'app: «Togli»', vq({ stato: 'pagato', fino: '2027-07-31' }), ['togli'])
ok('pagata fuori dall\'app e anche con la ricevuta: «Togli», non serve più', vq({ stato: 'pagato', fino: '2027-07-31' }, [{ dal: '2026-09-01', al: '2027-07-31', mancano: 0, numero: 3, anno: 2026 }]), ['togli'])

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
ok('la voce Disattiva chiede conferma', !!disattiva && disattiva.includes('chiedi(confermaDisattiva('), true)
const riattiva = voceMenu.find((v) => v.includes('Riattiva'))
ok('la voce Riattiva non è rossa', !!riattiva && (!riattiva.includes('sg-pericolo') || /attiva\s*(\?|&&)[^}]*sg-pericolo/.test(riattiva)), true)

console.log('\nIl sollecito in testata')
ok('c\'è il tasto «Sollecita su WhatsApp»', (isc + sol).includes('Sollecita su WhatsApp'), true)
ok('il tasto apre e chiude: aria-expanded', /aria-expanded[\s\S]{0,400}Sollecita su WhatsApp|Sollecita su WhatsApp[\s\S]{0,400}aria-expanded/.test(isc + sol), true)
const iSol = isc.indexOf('<SollecitoWhatsApp')
ok('il riquadro sta sopra DA SISTEMARE', iSol > 0 && iSol < isc.indexOf('<DaSistemare'), true)

console.log('\nEsc nel menu «Altro»')
// La scheda è un dialogo (useDialogo ascolta Esc su window): l'Esc che chiude il menu
// non deve salire fin lì, se no chiude anche la scheda.
const comune = readFileSync('src/components/segreteria/comune.tsx', 'utf8')
const menu = comune.slice(comune.indexOf('export function MenuAzioni'))
const escMenu = menu.match(/const tasto = \(e: KeyboardEvent\) => \{[\s\S]*?\n/)?.[0] ?? ''
ok('l\'Esc che chiude il menu si ferma lì (stopPropagation)', escMenu.includes('stopPropagation'), true)
// Lo stop funziona perché il menu ascolta su document, che l'Esc incontra prima di window.
ok('il menu ascolta l\'Esc su document', /document\.addEventListener\('keydown', tasto\)/.test(menu.slice(0, menu.indexOf('return ('))), true)
const dialogo = comune.slice(comune.indexOf('export function useDialogo'), comune.indexOf('export function useDialogo') + 2000)
ok('la scheda (useDialogo) ascolta l\'Esc su window', dialogo.includes("window.addEventListener('keydown', tasto)"), true)

console.log(guai ? `\n${guai} da sistemare` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
