// ---------------------------------------------------------------------------
// Il menu della segreteria in cinque gruppi, senza browser.
//
//   node scripts/prova-menu.mjs
//
// src/lib/menuSegreteria.ts esporta GRUPPI_MENU (i cinque gruppi della segreteria) e `menuDi`, che
// dà a ognuno le voci delle sue autorizzazioni; Segreteria.tsx lo importa. Amministrazione non è più
// un'area a sé (vedi prova-ruoli.mjs): con l'amministrazione Contabilità e Importazioni stanno in fondo a «Iscritti e soldi».
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

// Il CSS letto a pezzi: regole (selettore, corpo, dentro quale @media) senza un parser.
const CSS = readFileSync('src/styles.css', 'utf8') + readFileSync('src/segreteria.css', 'utf8')
const norma = (t) => t.replace(/"/g, "'").replace(/\s+/g, ' ').trim()
const regole = (css, media = null) => {
  const fuori = []
  const dentro = []
  let i = 0
  while (i < css.length) {
    const ap = css.indexOf('{', i)
    if (ap < 0) break
    const testa = css.slice(i, ap)
    // Salta i commenti prima del selettore.
    const sel = norma(testa.replace(/\/\*[\s\S]*?\*\//g, ''))
    let prof = 1, j = ap + 1
    while (j < css.length && prof > 0) { if (css[j] === '{') prof++; else if (css[j] === '}') prof--; j++ }
    const corpo = css.slice(ap + 1, j - 1)
    if (sel.startsWith('@media')) dentro.push(...regole(corpo, sel).map((r) => ({ ...r, media: sel })))
    else fuori.push({ sel: sel.split(',').map(norma), corpo: norma(corpo), media })
    i = j
  }
  return [...fuori, ...dentro]
}
const REGOLE = regole(CSS)
const SITO = ":root[data-look='sito']"
// Le regole che hanno un selettore del look «sito» che finisce con `fine`.
const delSito = (fine) => REGOLE.filter((r) => r.sel.some((x) => x.startsWith(SITO) && x.endsWith(fine)))
const corpi = (rs) => rs.map((r) => r.corpo).join(' ; ')
// I colori stanno in variabili (--menu-aperta, --giallo…): la prova guarda il valore, non il nome.
const valori = (s) => s.replace(/var\(--([\w-]+)\)/g, (v, n) => CSS.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? v)

console.log('\nI cinque gruppi')
ok('titoli e voci, nell\'ordine', Array.isArray(GRUPPI) ? GRUPPI.map((g) => [g.titolo, g.voci]) : GRUPPI, [
  ['Ogni giorno', [['dafare', 'Da fare'], ['richieste', 'Richieste online'], ['presenze', 'Presenze']]],
  ['Iscritti e soldi', [['iscritti', 'Iscritti']]],
  ['Corsi e orari', [['settimana', 'Settimana'], ['corsi', 'Corsi'], ['gare', 'Gare'], ['listino', 'Listino']]],
  ['Istruttori', [['istruttori', 'Presenze istruttori'], ['compensi', 'Compensi'], ['personale', 'Istruttori e accessi']]],
  ['Il resto', [['statistiche', 'Statistiche'], ['vestiario', 'Vestiario'], ['segnalazioni', 'Segnalazioni'], ['sito', 'Sito'], ['verbali', 'Verbali']]],
])
const ID16 = 'dafare settimana richieste presenze iscritti corsi gare istruttori compensi personale statistiche listino vestiario segnalazioni sito verbali'.split(' ')
ok('le 16 voci (senza TESSERE e PAGAMENTI, unite in ISCRITTI e CONTABILITÀ) ci sono, una volta sola',
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
ok('«Istruttori →» e i link hanno la loro icona', [/ICONE_MENU\.areaIstruttori/.test(sg0()), /ICONE_MENU\.link/.test(readFileSync('src/components/segreteria/comune.tsx', 'utf8'))], [true, true])
ok('nessun filetto separa un gruppo dal successivo', /\.sg-gruppo \+ \.sg-gruppo\s*\{[^}]*border-top/.test(CSS), false)

console.log('\nContabilità e Importazioni in fondo a Iscritti e soldi (con l\'amministrazione)')
const chi = (ruolo, ancheAmministrazione = false) => ({ ruolo, ancheIstruttore: false, ancheAmministrazione })
const gruppi = (c) => (m.menuDi ? m.menuDi(c).map((g) => [g.titolo, g.voci]) : mancante)
const titoliDi = (c) => (Array.isArray(gruppi(c)) ? gruppi(c).map(([t]) => t) : gruppi(c))
ok('solo segreteria: i cinque gruppi, e basta', gruppi(chi('staff')), Array.isArray(GRUPPI) ? GRUPPI.map((g) => [g.titolo, g.voci]) : GRUPPI)
ok('segreteria e amministrazione: cinque gruppi, nessun «I conti»', titoliDi(chi('staff', true)), ['Ogni giorno', 'Iscritti e soldi', 'Corsi e orari', 'Istruttori', 'Il resto'])
ok('segreteria e amministrazione: «Iscritti e soldi» ha iscritti, contabilità e importazioni, in quest\'ordine', Array.isArray(gruppi(chi('staff', true))) ? gruppi(chi('staff', true)).find(([t]) => t === 'Iscritti e soldi') : gruppi(chi('staff', true)), ['Iscritti e soldi', [['iscritti', 'Iscritti'], ['contabilita', 'Contabilità'], ['importazioni', 'Importazioni']]])
ok('solo segreteria: «Iscritti e soldi» ha solo gli iscritti', Array.isArray(gruppi(chi('staff'))) ? gruppi(chi('staff')).find(([t]) => t === 'Iscritti e soldi') : gruppi(chi('staff')), ['Iscritti e soldi', [['iscritti', 'Iscritti']]])
ok('solo amministrazione: «I conti» e basta, con Contabilità, Importazioni e Listino', gruppi(chi('amministrazione')), [['I conti', [['contabilita', 'Contabilità'], ['importazioni', 'Importazioni'], ['listino', 'Listino']]]])
ok('i titoli restano nei dati dei gruppi (sono l\'aria-label)', Array.isArray(m.menuDi?.(chi('staff', true))) ? m.menuDi(chi('staff', true)).every((g) => typeof g.titolo === 'string' && g.titolo) : false, true)

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

console.log('\nAiuto e Impostazioni con il loro nome, nel piede del menu')
const nav = sg.slice(sg.indexOf('<nav className="sg-menu"'), sg.indexOf('</nav>'))
const chiBox = nav.slice(nav.indexOf('className="sg-piede"'))
ok('in cima al menu non c\'è più la riga di icone con ? e impostazioni', /className="row sg-icone"/.test(nav), false)
ok('nel piede: «Aiuto» e «Impostazioni» scritti', [/sg-voce-testo">Aiuto</.test(sg) && /\{guidaNome\}/.test(chiBox), /sg-voce-testo">Impostazioni</.test(sg) && /\{impostazioniNome\}/.test(chiBox)], [true, true])
ok('il riquadro non ha più il tasto del tema e la ricerca resta nel menu', [/<TastoTema/.test(chiBox), /<CercaIscritto/.test(nav)], [false, true])

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
  ['palestra', ['statistiche', 'segnalazioni', 'sito', 'verbali', 'regole']],
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

console.log('\nI titoli del menu, in parole normali')
const cfg = (ruolo, ancheIstruttore, ancheAmministrazione) => ({ ruolo, ancheIstruttore, ancheAmministrazione })
ok('titoloDelMenu: Segreteria, Gestione, Amministrazione', m.titoloDelMenu ? [m.titoloDelMenu(cfg('staff', false, false)), m.titoloDelMenu(cfg('staff', false, true)), m.titoloDelMenu(cfg('amministrazione', false, false))] : mancante, ['Segreteria', 'Gestione', 'Amministrazione'])

console.log('\nMenu compatto: niente titoli di gruppo, gruppi a 12px')
ok('nel menu non c\'è più sg-gruppo-titolo', /sg-gruppo-titolo/.test(nav), false)
ok('i gruppi restano role="group" con aria-label del titolo', [/role="group"/.test(nav), /aria-label=\{g\.titolo\}/.test(nav)], [true, true])
ok('look sito: i gruppi distano 12px', /(^|;)\s*gap: 12px/.test(corpi(delSito('.sg-gruppi'))), true)

console.log('\nCopia link fuori dal menu')
const navCopia = /Copia link/.test(nav)
ok('nessun «Copia link» dentro la nav di Segreteria.tsx', navCopia, false)
const ric = readFileSync('src/components/segreteria/Richieste.tsx', 'utf8')
const ves = readFileSync('src/components/segreteria/Vestiario.tsx', 'utf8')
const dentroTesta = (tsx, testo) => { const a = tsx.indexOf('<Testa'); const b = tsx.indexOf('</Testa>', a); return a >= 0 && b > a && tsx.slice(a, b).includes(`testo="${testo}"`) }
ok('Richieste.tsx: «Copia link iscrizioni» fra i figli della Testa', dentroTesta(ric, 'Copia link iscrizioni'), true)
ok('Vestiario.tsx: «Copia link ordini» fra i figli della Testa', dentroTesta(ves, 'Copia link ordini'), true)
const com = readFileSync('src/components/segreteria/comune.tsx', 'utf8')
ok('CopiaLink è esportato da comune.tsx', /export (function|const) CopiaLink\b/.test(com), true)
ok('Segreteria.tsx non definisce più CopiaLink', /(function|const) CopiaLink\b/.test(sg), false)
const bb = sg.indexOf('link={')
ok('Segreteria.tsx: i due testi compaiono solo nel blocco link={…} del Banco', [(sg.match(/Copia link iscrizioni/g) ?? []).length, (sg.match(/Copia link ordini/g) ?? []).length, bb > 0 && sg.slice(bb, bb + 900).includes('Copia link iscrizioni') && sg.slice(bb, bb + 900).includes('Copia link ordini')], [1, 1, true])

console.log('\nPiede fisso e area che scorre')
const iS = nav.indexOf('className="sg-scorre"')
const iP = nav.indexOf('className="sg-piede"')
ok('nella nav: sg-scorre (le voci) viene prima di sg-piede', iS >= 0 && iP > iS, true)
const piede = iP >= 0 ? nav.slice(iP) : ''
const pos = ['{guidaNome}', '{impostazioniNome}', '{nome}', 'Esci', 'DATI DI PROVA', 'Riparti dall\'orario vero'].map((t) => piede.indexOf(t))
ok('il piede ha, in ordine, Aiuto, Impostazioni, nome, Esci, DATI DI PROVA e il riavvio dell\'orario', pos.every((x) => x >= 0) && pos.every((x, k) => k === 0 || x > pos[k - 1]), true)
ok('look sito: il piede ha lo sfondo #0a2232', /background(-color)?: #0a2232/i.test(valori(corpi(delSito('.sg-piede')))), true)
// A 200px (fra 768 e 1000px) Aiuto e Impostazioni insieme non ci stanno: Impostazioni usciva dal menu.
ok('look sito: Aiuto e Impostazioni vanno a capo se non c\'è posto', /flex-wrap: wrap/.test(corpi(delSito('.sg-chi-voci'))), true)
// Sul telefono Aiuto e Impostazioni stanno nella barra in alto: il display del look sito non deve battere il none del telefono.
ok('look sito: la riga Aiuto e Impostazioni si mostra solo da 768px in su', delSito('.sg-chi-voci').filter((r) => /display:/.test(r.corpo)).map((r) => /min-width: 768px/.test(r.media ?? '')), [true])
// L'altra metà: sotto i 768px .sg-chi-voci resta nascosta (Aiuto e Impostazioni sono nella barra del telefono).
ok('telefono: la riga Aiuto e Impostazioni è nascosta sotto i 768px', REGOLE.some((r) => /max-width: 767px/.test(r.media ?? '') && r.sel.some((x) => x.endsWith('.sg-chi-voci')) && /display: none/.test(r.corpo)), true)
// Il bollino DATI DI PROVA sta nella riga di Riparti: senza i 4px di margine sopra, anche sul telefono.
ok('il bollino nel piede di prova non ha margine sopra, a ogni larghezza', REGOLE.some((r) => !r.media && r.sel.some((x) => x.endsWith('.sg-piede-prova > .sg-bollino')) && /margin-top: 0/.test(r.corpo)), true)
ok('look sito: l\'area centrale scorre da sola (overflow-y auto, min-height 0)', [/overflow-y: auto/.test(corpi(delSito('.sg-scorre'))), /min-height: 0/.test(corpi(delSito('.sg-scorre')))], [true, true])
const menuFermo = REGOLE.filter((r) => r.media === '@media (min-width: 768px)' && r.sel.some((x) => x.endsWith('.sg-menu') || x.endsWith('#sg-menu')) && /overflow: hidden/.test(r.corpo))
ok('da 768px in su la nav non scorre lei (overflow hidden, dentro @media (min-width: 768px))', menuFermo.length > 0, true)

console.log('\nVoce aperta e conteggi')
const aperta = corpi(delSito(".sg-voce[aria-current='page']"))
ok('voce aperta: sfondo #1d4560 e testo #ffffff', [/background(-color)?: #1d4560/i.test(valori(aperta)), /(^|[ ;])color: #ffffff/i.test(aperta)], [true, true])
ok('voce aperta: non più sfondo giallo pieno', /background(-color)?: var\(--giallo\)/.test(aperta), false)
ok('voce aperta: l\'icona è gialla #f4c31b', /color: #f4c31b|fill: #f4c31b|stroke: #f4c31b/i.test(valori(corpi(delSito(".sg-voce[aria-current='page'] svg")))), true)
const conta = valori(corpi(REGOLE.filter((r) => r.sel.some((x) => x.endsWith('.sg-conta')))))
ok('sg-conta: giallo #f4c31b, 14px, bold, cifre tabulari', [/(^|[ ;])color: #f4c31b/i.test(conta), /font-size: 14px/.test(conta), /font-weight: 700/.test(conta), /tabular-nums/.test(conta)], [true, true, true, true])
// Il numero lo disegna `conta`, definita prima della nav: nella nav ci sono le sue chiamate, e nessun segno a bollino.
ok('Segreteria.tsx: le voci del menu usano conta (sg-conta) e non sg-tag né segno', [/const conta = [\s\S]{0,120}className="num sg-conta"/.test(sg), (nav.match(/conta\(/g) ?? []).length, /sg-tag|segno\(/.test(nav)], [true, 5, false])
// .sg-scorre e il piede tagliano quel che sporge: un contorno fuori dalla voce non si vedrebbe.
ok('fuoco da tastiera: il contorno delle voci del menu sta dentro la voce', /outline-offset: -3px/.test(corpi(REGOLE.filter((r) => r.sel.some((x) => /\.sg-menu \.sg-voce:focus-visible$/.test(x))))), true)
ok('le voci restano alte almeno 44px', /min-height: 44px/.test(corpi(delSito('.sg-voce'))), true)

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
