// ---------------------------------------------------------------------------
// Il menu della segreteria in cinque gruppi, senza browser.
//
//   node scripts/prova-menu.mjs
//
// src/lib/menuSegreteria.ts esporta GRUPPI_MENU (i cinque gruppi della segreteria) e `menuDi`, che
// dà a ognuno le voci delle sue autorizzazioni; Segreteria.tsx lo importa. Amministrazione non è più
// un'area a sé (vedi prova-ruoli.mjs): con l'amministrazione compare in più il gruppo «I conti».
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
    // Icons.tsx è JSX: senza questo cercherebbe React.createElement.
    jsx: 'automatic',
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

const sg0 = () => readFileSync('src/components/segreteria/Segreteria.tsx', 'utf8')
const c = existsSync('src/lib/menuSegreteria.ts')
const m = c ? await impacchetta("export * from './src/lib/menuSegreteria'") : {}
const mancante = 'src/lib/menuSegreteria.ts non esiste'
const GRUPPI = m.GRUPPI_MENU ?? mancante

console.log('\nI cinque gruppi')
ok('titoli e voci, nell\'ordine', Array.isArray(GRUPPI) ? GRUPPI.map((g) => [g.titolo, g.voci]) : GRUPPI, [
  ['Ogni giorno', [['dafare', 'Da fare'], ['richieste', 'Richieste online'], ['presenze', 'Presenze']]],
  ['Iscritti e soldi', [['iscritti', 'Iscritti']]],
  ['Corsi e orari', [['settimana', 'Settimana'], ['corsi', 'Corsi'], ['gare', 'Gare'], ['listino', 'Listino']]],
  ['Istruttori', [['istruttori', 'Presenze istruttori'], ['compensi', 'Compensi'], ['personale', 'Istruttori e accessi']]],
  ['Il resto', [['statistiche', 'Statistiche'], ['vestiario', 'Vestiario'], ['segnalazioni', 'Segnalazioni'], ['sito', 'Sito']]],
])
const ID16 = 'dafare settimana richieste presenze iscritti corsi gare istruttori compensi personale statistiche listino vestiario segnalazioni sito'.split(' ')
ok('le 15 voci (senza TESSERE e PAGAMENTI, unite in ISCRITTI e CONTABILITÀ) ci sono, una volta sola',
  Array.isArray(GRUPPI) ? GRUPPI.flatMap((g) => g.voci.map(([id]) => id)).sort() : GRUPPI, [...ID16].sort())
ok('solo «Il resto» è secondario',
  Array.isArray(GRUPPI) ? GRUPPI.filter((g) => g.secondario === true).map((g) => g.titolo) : GRUPPI, ['Il resto'])
ok('gli altri gruppi non dicono secondario',
  Array.isArray(GRUPPI) ? GRUPPI.filter((g) => g.titolo !== 'Il resto').map((g) => g.secondario ?? false) : GRUPPI, [false, false, false, false])

// Iniziale maiuscola e non tutto maiuscolo: il maiuscolo dei titoli lo mette il CSS.
const maiuscola = (t) => /^\p{Lu}/u.test(t) && t !== t.toUpperCase()
const testi = (v) => (Array.isArray(v) ? v : [])
ok('titoli dei gruppi e voci: iniziale maiuscola, non tutto maiuscolo',
  testi(GRUPPI).flatMap((g) => [g.titolo, ...g.voci.map(([, t]) => t)]).filter((t) => !maiuscola(t)),
  Array.isArray(GRUPPI) ? [] : ['mancano i gruppi'])

console.log('\nUn\'icona per ogni voce')
const ic = await impacchetta("export { ICONE_MENU, ICONE_RISULTATO } from './src/components/Icons'").catch(() => ({}))
const ICONE = ic.ICONE_MENU ?? {}
const chiavi = Object.keys(ICONE).sort()
const attese = [...ID16, 'contabilita', 'importazioni', 'areaIstruttori', 'link'].sort()
ok('ICONE_MENU ha una chiave per ogni voce, per la contabilità e le importazioni, il passaggio agli istruttori e i link', chiavi, attese)
ok('ognuna è un componente che disegna', Object.values(ICONE).filter((f) => typeof f !== 'function').length, 0)
ok('Segreteria.tsx disegna l\'icona di ogni voce', /ICONE_MENU\[id\]/.test(sg0()), true)
ok('«Istruttori →» e i link hanno la loro icona', [/ICONE_MENU\.areaIstruttori/.test(sg0()), /ICONE_MENU\.link/.test(sg0())], [true, true])
ok('un filetto separa un gruppo dal successivo', /\.sg-gruppo \+ \.sg-gruppo\s*\{[^}]*border-top/.test(readFileSync('src/styles.css', 'utf8') + readFileSync('src/segreteria.css', 'utf8')), true)


console.log('\nIl gruppo dei conti (con l\'amministrazione)')
const chi = (ruolo, ancheAmministrazione = false) => ({ ruolo, ancheIstruttore: false, ancheAmministrazione })
const gruppi = (c) => (m.menuDi ? m.menuDi(c).map((g) => [g.titolo, g.voci]) : mancante)
ok('solo segreteria: i cinque gruppi, e basta', gruppi(chi('staff')), Array.isArray(GRUPPI) ? GRUPPI.map((g) => [g.titolo, g.voci]) : GRUPPI)
ok('segreteria e amministrazione: «I conti» con Contabilità dopo «Iscritti e soldi»', Array.isArray(gruppi(chi('staff', true))) ? gruppi(chi('staff', true)).map(([t]) => t) : gruppi(chi('staff', true)), ['Ogni giorno', 'Iscritti e soldi', 'I conti', 'Corsi e orari', 'Istruttori', 'Il resto'])
ok('segreteria e amministrazione: «I conti» con Contabilità e poi Importazioni', Array.isArray(gruppi(chi('staff', true))) ? gruppi(chi('staff', true)).find(([t]) => t === 'I conti') : gruppi(chi('staff', true)), ['I conti', [['contabilita', 'Contabilità'], ['importazioni', 'Importazioni']]])
ok('solo amministrazione: «I conti» e basta, con Contabilità, Importazioni e Listino', gruppi(chi('amministrazione')), [['I conti', [['contabilita', 'Contabilità'], ['importazioni', 'Importazioni'], ['listino', 'Listino']]]])

console.log('\nIl piè del menu')
const sg = readFileSync('src/components/segreteria/Segreteria.tsx', 'utf8')
ok('«Istruttori →» (non più in maiuscolo) e nessun passaggio verso l\'amministrazione: è un\'autorizzazione dello stesso menu', [/>\s*Istruttori →\s*</.test(sg), />\s*Amministrazione →\s*</.test(sg)], [true, false])
ok('niente ISTRUTTORI → né AMMINISTRAZIONE → in Segreteria.tsx', /ISTRUTTORI →|AMMINISTRAZIONE →/.test(sg), false)
ok('Amministrazione.tsx non c\'è più', existsSync('src/components/segreteria/Amministrazione.tsx'), false)
ok('«Copia link iscrizioni» e «Copia link ordini»', [/testo="Copia link iscrizioni"/.test(sg), /testo="Copia link ordini"/.test(sg)], [true, true])
ok('niente COPIA LINK in maiuscolo nei componenti', /testo="COPIA LINK/.test(sg), false)
ok('«DATI DI PROVA» resta maiuscolo (è una sigla di stato)', />DATI DI PROVA</.test(sg), true)
// banco/BarraBanco.tsx non esiste: i tasti del link stanno solo in Segreteria.tsx.
if (existsSync('src/components/banco/BarraBanco.tsx'))
  ok('BarraBanco.tsx: niente COPIA LINK in maiuscolo', /COPIA LINK/.test(readFileSync('src/components/banco/BarraBanco.tsx', 'utf8')), false)

console.log('\nAiuto e Impostazioni con il loro nome, nel riquadro di chi è dentro')
const nav = sg.slice(sg.indexOf('<nav className="sg-menu"'), sg.indexOf('</nav>'))
const chiBox = nav.slice(nav.indexOf('className="sg-chi"'))
ok('in cima al menu non c\'è più la riga di icone con ? e impostazioni', /className="row sg-icone"/.test(nav), false)
ok('nel riquadro di chi è dentro: «Aiuto» e «Impostazioni» scritti', [/sg-voce-testo">Aiuto</.test(sg) && /\{guidaNome\}/.test(chiBox), /sg-voce-testo">Impostazioni</.test(sg) && /\{impostazioniNome\}/.test(chiBox)], [true, true])
ok('il riquadro tiene il tema e la ricerca resta nel menu', [/<TastoTema \/>/.test(chiBox), /<CercaIscritto/.test(nav)], [true, true])

console.log('\nLa ricerca con ⌘K, in una finestra al centro')
const sc = existsSync('src/lib/scorciatoiaRicerca.ts') ? await impacchetta("export * from './src/lib/scorciatoiaRicerca'") : {}
const tasto = (key, o = {}) => (sc.eScorciatoiaDiRicerca ? sc.eScorciatoiaDiRicerca({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...o }) : 'src/lib/scorciatoiaRicerca.ts non esiste')
ok('Esc: nella finestra chiude subito, nel menu svuota ed esce dal campo', [sc.cosaFaEsc?.(true), sc.cosaFaEsc?.(false)], ['chiudi', 'svuota-e-esci'])
ok('⌘K (Mac) apre', tasto('k', { metaKey: true }), true)
ok('Ctrl+K (Windows) apre', tasto('k', { ctrlKey: true }), true)
ok('con il maiuscolo bloccato apre lo stesso', tasto('K', { metaKey: true }), true)
ok('k da sola no: è una lettera che si scrive', tasto('k'), false)
ok('⌘⇧K e ⌘⌥K no: sono di altri', [tasto('k', { metaKey: true, shiftKey: true }), tasto('k', { metaKey: true, altKey: true })], [false, false])
ok('⌘J no', tasto('j', { metaKey: true }), false)
ok('Segreteria.tsx ascolta la scorciatoia e apre una finestra (dialog) con la ricerca', [/eScorciatoiaDiRicerca\(/.test(sg), /role="dialog"/.test(sg), /aria-modal/.test(sg)], [true, true, true])
const ci = readFileSync('src/components/segreteria/CercaIscritto.tsx', 'utf8')
const RIS = ic.ICONE_RISULTATO ?? {}
ok('ICONE_RISULTATO: una icona per tipo di risultato', Object.keys(RIS).sort(), ['corsi', 'iscritti', 'istruttori', 'richieste'])
ok('CercaIscritto disegna l\'icona del tipo davanti a ogni risultato', /ICONE_RISULTATO\[/.test(ci), true)

console.log('\nIl menu del Banco')
// I cinque luoghi e le voci che portano (gli id, non i nomi): la serie «segreteria nel look del sito» non li sposta.
const luoghi = await impacchetta("export { LUOGHI } from './src/lib/luoghiBanco'")
ok('LUOGHI: i cinque luoghi con le loro voci', (luoghi.LUOGHI ?? []).map((l) => [l.id, l.voci.map((v) => v.voce)]), [
  ['oggi', ['dafare', 'settimana', 'presenze']],
  ['persone', ['iscritti', 'richieste', 'istruttori', 'compensi', 'personale']],
  ['corsi', ['corsi', 'gare']],
  ['soldi', ['contabilita', 'importazioni', 'listino', 'vestiario']],
  ['palestra', ['statistiche', 'segnalazioni', 'sito', 'regole']],
])

console.log('\nLe schede di PRESENZE sotto il titolo')
// Come IMPOSTAZIONI: prima il titolo, poi le schede. Il titolo resta PRESENZE anche in SEGNALATE.
for (const f of ['Presenze', 'PresenzeSegnalate']) {
  const tsx = readFileSync(`src/components/segreteria/${f}.tsx`, 'utf8')
  ok(`${f}.tsx: Testa con titolo PRESENZE`, /<Testa\s+titolo="PRESENZE"/.test(tsx), true)
  ok(`${f}.tsx: le schede dopo la Testa`, tsx.indexOf('{schede}') > tsx.indexOf('</Testa>') && tsx.indexOf('</Testa>') > 0, true)
}
ok('Segreteria.tsx: le schede delle presenze con la tastiera (`tastoLinguette`) e solo l\'aperta nel giro del Tab', /tastoLinguette\(/.test(sg) && /tabIndex=\{voce === 'presenze' \? 0 : -1\}/.test(sg), true)
ok('Segreteria.tsx: il tablist delle presenze non sta più prima delle pagine', /\{d && inPresenze && conSegnalate && \(\s*<div role="tablist"/.test(sg), false)

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
