// ---------------------------------------------------------------------------
// L'AREA ISTRUTTORE COL LOOK DEL SITO (PR 1: menu, calendario, appello), senza browser.
//
//   node scripts/prova-istruttori-look.mjs
//
// L'area istruttore ha il look del sito come ogni altra: nessun tema da scegliere, nessun tasto.
// Le parole di stato dell'appello e del calendario (segno davanti, mai solo il colore) stanno in
// `src/lib/etichetteAppello.ts`. Il CSS sta sotto `:root[data-look='sito']`; la pagina TIMER ha il
// tema `sito` del timer, come il tablet di sala.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const vedi = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
const carica = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

// --- 1. l'aspetto è uno solo -------------------------------------------------
console.log('\nL\'aspetto del sito, sempre')
ok('index.html: <html data-look="sito">, nessun tema da scegliere', /<html[^>]*\bdata-look="sito"/.test(readFileSync('index.html', 'utf8')), true)

// --- 2. il tasto del tema non c'è più -----------------------------------------
console.log('\nIl tasto del tema non c\'è più')
const app = readFileSync('src/App.tsx', 'utf8')
ok('App.tsx non nomina il tasto del tema', /TastoTema|senzaTema/.test(app), false)
ok('né il tablet né la segreteria lo nominano', [
  /TastoTema/.test(readFileSync('src/components/tablet/Tablet.tsx', 'utf8')),
  /TastoTema/.test(readFileSync('src/components/segreteria/Segreteria.tsx', 'utf8')),
], [false, false])

// --- 4. le parole di stato: src/lib/etichetteAppello.ts ----------------------
console.log('\nLe parole di stato (src/lib/etichetteAppello.ts)')
const e = await carica("export * from './src/lib/etichetteAppello'")
const A = (x = {}) => ({ soloLettura: false, tuttiSegnati: false, tuttiAssenti: false, mancano: 0, proveMancano: 0, haChiudi: false, ...x })
ok('SOLO LETTURA: segno … davanti, tono aspetta', e.statoAppello(A({ soloLettura: true })), { testo: '… SOLO LETTURA', tono: 'aspetta' })
ok('tutti assenti: ✕ TUTTI ASSENTI, tono manca', e.statoAppello(A({ tuttiSegnati: true, tuttiAssenti: true })), { testo: '✕ TUTTI ASSENTI', tono: 'manca' })
ok('tutti segnati: ✓ TUTTI SEGNATI, tono fatto', e.statoAppello(A({ tuttiSegnati: true })), { testo: '✓ TUTTI SEGNATI', tono: 'fatto' })
ok('tutti segnati e si può chiudere: CHIUDI IN FONDO ↓ (tasto, tono fatto)', e.statoAppello(A({ tuttiSegnati: true, haChiudi: true })), { testo: 'CHIUDI IN FONDO ↓', tono: 'fatto', tasto: true })
ok('tutti assenti e si può chiudere: resta ✕ TUTTI ASSENTI', e.statoAppello(A({ tuttiSegnati: true, tuttiAssenti: true, haChiudi: true })).testo, '✕ TUTTI ASSENTI')
ok('ne mancano 3: … 3 DA SEGNARE', e.statoAppello(A({ mancano: 3 })), { testo: '… 3 DA SEGNARE', tono: 'aspetta' })
ok('mancano solo le prove: … 2 PROVA DA SEGNARE', e.statoAppello(A({ proveMancano: 2 })).testo, '… 2 PROVA DA SEGNARE')
ok('in sola lettura vince su tutto', e.statoAppello(A({ soloLettura: true, tuttiSegnati: true, haChiudi: true })).testo, '… SOLO LETTURA')
ok('NON ANCORA COMINCIATA: con il segno …', e.NON_ANCORA_COMINCIATA, '… NON ANCORA COMINCIATA')
ok('coda: 3 → … 3 DA INVIARE', e.codaAppello(3), '… 3 DA INVIARE')
ok('coda: 0 → vuota (la testa non cambia altezza)', e.codaAppello(0), '')
const T = (x) => e.tastoAppello({ segnatiIscritti: 0, tuttiAssenti: false, tuttiSegnati: false, ...x })
ok('tasto: nessuno segnato → TUTTI PRESENTI', T({}), 'TUTTI PRESENTI')
ok('tasto: tutti assenti → TUTTI PRESENTI', T({ segnatiIscritti: 4, tuttiAssenti: true, tuttiSegnati: true }), 'TUTTI PRESENTI')
ok('tasto: qualcuno segnato → GLI ALTRI PRESENTI', T({ segnatiIscritti: 2 }), 'GLI ALTRI PRESENTI')
ok('tasto: tutti segnati → ✓ TUTTI SEGNATI', T({ segnatiIscritti: 4, tuttiSegnati: true }), '✓ TUTTI SEGNATI')
const L = (x) => e.statoLezione({ manca: false, iniziato: true, fatto: false, presentiIscritti: 0, ...x })
ok('lezione da chiudere: ✕ DA CHIUDERE, tono manca', L({ manca: true }), { testo: '✕ DA CHIUDERE', tono: 'manca' })
ok('lezione non iniziata: ISCRITTI, senza tono (non è uno stato)', L({ iniziato: false }), { testo: 'ISCRITTI' })
ok('lezione fatta con presenti: ✓ FATTO, tono fatto', L({ fatto: true, presentiIscritti: 5 }), { testo: '✓ FATTO', tono: 'fatto' })
ok('lezione fatta senza presenti: … NESSUN PRESENTE, tono aspetta', L({ fatto: true }), { testo: '… NESSUN PRESENTE', tono: 'aspetta' })
ok('lezione in corso: … IN CORSO, tono aspetta', L({}), { testo: '… IN CORSO', tono: 'aspetta' })
ok('+N PROVA: il + è il segno', e.proveInPiu(2), '+2 PROVA')

// --- 5. il CSS ---------------------------------------------------------------
console.log('\nIl CSS dell\'area istruttore (sotto :root[data-look=\'sito\'])')
const css = readFileSync('src/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const LOOK = ":root[data-look='sito']"
const regole = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, c]) => ({ sel: s.split(',').map((x) => x.trim().replace(/"/g, "'")), corpo: c.trim() }))
const delLook = regole.filter((r) => r.sel.some((s) => s.startsWith(LOOK)))
// Il corpo di tutte le regole del look il cui selettore ha `re` (e non è il blocco dei token).
const corpo = (re) => delLook.filter((r) => r.sel.some((s) => s !== LOOK && s.startsWith(LOOK) && re.test(s))).map((r) => r.corpo).join(' ; ')
const GIALLO_PIENO = /background(-color)?:\s*(var\(--giallo\)|#f4c31b)/i
const SCURO_TESTO = /(?<![-\w])color:\s*(var\(--(text|su-colore)\)|#0d2a3d)/i
const sfondoBianco = /background(-color)?:\s*(var\(--surface\)|#ffffff)/i

for (const [nome, re] of [
  ['il calendario (.lezione)', /\.lezione(?![\w-])/],
  ['la striscia dei giorni', /\.striscia-giorni/],
  ['la riga dell\'appello', /\.riga-appello(?![\w-])/],
  ['la testa dell\'appello', /\.appello-(testa|stato)/],
  ['la barra in basso', /\.barra-(nav|voce)/],
  ['la striscia dell\'allenamento', /\.striscia-timer/],
  ['la spia della coda', /\.spia-coda/],
]) ok(`c'è una regola del look per ${nome}`, corpo(re).length > 0, true)

ok('.lezione: tessera bianca, angoli da 6px', sfondoBianco.test(corpo(/\.lezione(?![\w-])/)) && /border-radius:\s*6px/.test(corpo(/\.lezione(?![\w-])/)), true)
ok('.riga-appello: barra di stato da 4px (inset 4px 0 0 o border-left 4px)', /inset 4px 0 0|border-left:\s*4px/.test(corpo(/\.riga-appello(?![\w-])/)), true)
ok('.riga-appello: tessera bianca', sfondoBianco.test(corpo(/\.riga-appello(?![\w-])/)), true)
ok('TUTTI PRESENTI (.btn-go dell\'appello): fondo giallo, testo inchiostro', GIALLO_PIENO.test(corpo(/\.appello-testa .*\.btn-go|\.btn-go/)) && SCURO_TESTO.test(corpo(/\.appello-testa .*\.btn-go|\.btn-go/)), true)
ok('la voce corrente della barra in basso: fondo giallo, testo inchiostro', GIALLO_PIENO.test(corpo(/\.barra-voce\[aria-current='page'\]/)) && SCURO_TESTO.test(corpo(/\.barra-voce\[aria-current='page'\]/)), true)
ok('la barra in basso: fondo inchiostro (var(--menu))', /background(-color)?:\s*(var\(--menu\)|#0d2a3d)/i.test(corpo(/\.barra-nav(?![\w-])/)), true)
ok('SOLA LETTURA e coda (.spia-coda): bianco, testo e bordo giallo scuro (#8f6a00)', sfondoBianco.test(corpo(/\.spia-coda(?![\w-])/)) && /border(-color)?:[^;]*(#8f6a00|var\(--giallo-testo\))/i.test(corpo(/\.spia-coda(?![\w-])/)), true)
ok('.spia-coda: titolo in giallo scuro, mai giallo pieno', /color:\s*(#8f6a00|var\(--giallo-testo\))/i.test(corpo(/\.spia-coda-quante/)) && !GIALLO_PIENO.test(corpo(/\.spia-coda/)), true)
const striscia = corpo(/\.striscia-timer/)
// I valori sono i token del look (--rosso-testo #b81d1d, --verde-testo #0b7a33, --su-rosso #ffffff): `prova:look` vieta gli esadecimali.
ok('striscia: LAVORO su var(--rosso-testo), testo var(--su-rosso)', /background:\s*var\(--rosso-testo\)/.test(striscia) && /(?<![-\w])color:\s*var\(--su-rosso\)/.test(striscia), true)
ok('striscia: RECUPERO su var(--verde-testo)', /background:\s*var\(--verde-testo\)/.test(striscia), true)
ok('niente font-style oblique sotto il look', delLook.filter((r) => /oblique/.test(r.corpo)).length, 0)
// Il cronometro in allenamento, il tablet e i timer fuori dall'app non cambiano: il look non li nomina.
// Fanno eccezione i tasti del tablet (.tb-btn), passati all'aspetto del sito (prova-look, sezione 9): il timer non li usa.
ok('nessuna regola del look nomina il tablet (.tb-, tranne i tasti .tb-btn) né il timer incorporato (.faccia-timer .tb, .timer-)', delLook.flatMap((r) => r.sel).filter((s) => /\.tb-(?!btn)|\.timer-(?!striscia)/.test(s)), [])
ok('il blocco dei token del look non è cambiato per il cronometro (--bg resta #eef5fa)', regole.find((r) => r.sel.length === 1 && r.sel[0] === LOOK)?.corpo.includes('--bg: #eef5fa'), true)

// --- 5b. la pagina TIMER col look del sito (design: docs/design-canvas/timer-sito) ----------
console.log('\nLa pagina TIMER col look del sito (src/lib/timerNelRiquadro.ts, timer/src/styles.css)')
{
  const t = await carica("export * from './src/lib/timerNelRiquadro'")
  ok('il timer nel riquadro non sceglie più il tema', t.temaDelTimer, undefined)
  ok('perLaSala: :root[data-tema=\'sito\'] diventa :host([data-tema=sito])', vedi(() => t.perLaSala(":root[data-tema='sito'] .a { x: 1 }")), ':host([data-tema=sito]) .a { x: 1 }')
  ok('TimerSala mette data-tema="sito" sul riquadro', /data-tema="sito"/.test(readFileSync('src/components/tablet/TimerSala.tsx', 'utf8')), true)
  ok('né la pagina TIMER né il tablet passano un tema a TimerSala', /<TimerSala[^>]*(sito|scuro)/.test(readFileSync('src/components/TimerIstruttori.tsx', 'utf8') + readFileSync('src/components/tablet/Tablet.tsx', 'utf8')), false)
  ok('.faccia-timer non sta più nel blocco dei token scuri', /\.faccia-timer\s*,\s*:root\s*\{/.test(css), false)

  const tcss = readFileSync('timer/src/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const SITO = ":root[data-tema='sito']"
  const tregole = [...tcss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, c]) => ({ sel: s.split(',').map((x) => x.trim()), corpo: c.trim() }))
  const tok = (sel, nome) => tregole.filter((r) => r.sel.includes(sel)).map((r) => r.corpo.match(new RegExp(`${nome}:\\s*([^;]+);`))?.[1].trim()).filter(Boolean).at(-1)
  const tsito = (re) => tregole.filter((r) => r.sel.some((s) => s.startsWith(SITO + ' ') && re.test(s))).map((r) => r.corpo).join(' ; ')
  // I valori del look sito dell'app (src/styles.css, :root[data-look='sito']) e delle fasi della striscia.
  for (const [nome, v] of [['--bg', '#eef5fa'], ['--surface', '#ffffff'], ['--line', '#cfe6f4'], ['--text', '#0d2a3d'], ['--dim', '#46606f'], ['--blu', '#14709f'], ['--giallo', '#f4c31b'], ['--giallo-testo', '#8f6a00'], ['--su-giallo', '#0d2a3d']])
    ok(`timer, tema sito: ${nome} è ${v}`, tok(SITO, nome), v)
  ok('tema sito: LAVORO #b81d1d', tok(SITO, '--work'), '#b81d1d')
  ok('tema sito: RECUPERO #0b7a33', tok(SITO, '--rest'), '#0b7a33')
  ok('tema sito: RIPOSO e DEFATICAMENTO blu', [tok(SITO, '--setRest'), tok(SITO, '--cooldown')], ['var(--blu)', 'var(--blu)'])
  ok('tema sito: Big Shoulders e Inter', [/Big Shoulders/.test(tok(SITO, '--cond') ?? ''), /^Inter/.test(tok(SITO, '--body') ?? '')], [true, true])
  // Sopra le fasi: inchiostro sul giallo, bianco sul rosso, sul verde e sul blu (sotto 4,5:1 col testo scuro).
  ok('tema sito: sopra PREPARATI inchiostro, sopra le altre fasi bianco', ['--su-prepare', '--su-work', '--su-rest', '--su-setRest', '--su-cooldown'].map((n) => tok(SITO, n)), ['var(--su-giallo)', '#ffffff', '#ffffff', '#ffffff', '#ffffff'])
  // Fuori dagli intervalli (cronometro, conto alla rovescia, chip, COMPLETATO) il testo sopra i colori è --su-colore:
  // nel sito bianco, perché i fondi pieni sono blu, rosso e verde; sopra il giallo c'è --su-giallo, inchiostro.
  ok('tema sito: sopra blu, rosso e verde bianco (--su-colore), verde scuro', [tok(SITO, '--su-colore'), tok(SITO, '--verde')], ['#ffffff', '#0b7a33'])
  ok('sopra il giallo (.livello acceso, MAURIZIO) --su-giallo', /\.livello\[data-on='true'\]\s*\{[^}]*color:\s*var\(--su-giallo\)/.test(tcss) && /background: 'var\(--giallo\)'[^}]*color: 'var\(--su-giallo\)'/.test(readFileSync('timer/src/components/TimerScreen.tsx', 'utf8')), true)
  ok('tema sito: i ▶ blu (--play)', tok(SITO, '--play'), 'var(--blu)')
  ok('i ▶ della lista usano --play', (readFileSync('timer/src/components/HomeScreen.tsx', 'utf8').match(/className="play-btn" style=\{\{ borderColor: 'var\(--play\)', color: 'var\(--play\)' \}\}/g) ?? []).length, 2)
  // La fase è una fascia piena del suo colore, con la parola sopra.
  const fase = tsito(/\.tf-stato/)
  ok('tema sito: la fase (.tf-stato) è una fascia del colore della fase', /background:\s*var\(--state\)/.test(fase) && /(?<![-\w])color:\s*var\(--su-state\)/.test(fase), true)
  const schermo = readFileSync('timer/src/components/TimerScreen.tsx', 'utf8')
  ok('TimerScreen passa --su-state', /\['--su-state' as string\]/.test(schermo), true)
  // Il legame tra la fase e il colore del suo testo: se una fase puntasse al token di un'altra, il bianco finirebbe sul giallo.
  const quadrante = readFileSync('timer/src/components/Quadrante.tsx', 'utf8')
  const suState = Object.fromEntries([...(quadrante.match(/SU_STATE = \{([^}]*)\}/)?.[1] ?? '').matchAll(/(\w+):\s*'([^']+)'/g)].map(([, k, v]) => [k, v]))
  ok('SU_STATE: ogni fase col suo --su-<fase>', suState, { prepare: 'var(--su-prepare)', work: 'var(--su-work)', rest: 'var(--su-rest)', setRest: 'var(--su-setRest)', cooldown: 'var(--su-cooldown)' })
  ok('AVVIA: fondo della fase, testo del suo --su (a fine allenamento --su-colore)', /const suTinta = !done && seg \? SU_STATE\[seg\.kind\] : 'var\(--su-colore\)'/.test(schermo) && /className="tf-avvia"\s*style=\{\{ background: tinta, color: suTinta \}\}/.test(schermo), true)
  ok('tema sito: +30″ col bordo della fase quando si può usare', /border-color:\s*var\(--state\)/.test(tsito(/\.tf-piu:not\(:disabled\)/)), true)
  // Tutti i tasti del timer con gli angoli del look, non solo carte, ▶ e AVVIA.
  const angoli = tregole.filter((r) => /border-radius:\s*6px/.test(r.corpo)).flatMap((r) => r.sel)
  ok('tema sito: angoli 6px su chip, +30″, tasti piccoli e livelli', ['.chip', '.btn-piu', '.btn', '.icon-btn', '.livello', '.segmento'].filter((c) => !angoli.includes(`${SITO} ${c}`)), [])
  ok('il passo corrente della scaletta scrive col suo --su', /\.tf-riga\[data-corrente='true'\]\s*\{[^}]*color:\s*var\(--su\)/.test(tcss) && /\['--su' as string\]/.test(readFileSync('timer/src/components/Scaletta.tsx', 'utf8')), true)
  ok('tema sito: tasti secondari col bordo blu e testo blu', /border-color:\s*var\(--blu\)/.test(tsito(/\.tf-secondario/)) && /(?<![-\w])color:\s*var\(--blu\)/.test(tsito(/\.tf-secondario/)), true)
  ok('tema sito: niente obliquo, in nessun posto', /font-style:\s*normal/.test(tsito(/^:root\[data-tema='sito'\] \*$/)), true)
}

// Il sottotitolo dell'appello va a capo, non si taglia dietro il tasto del timer; il conto non si spezza.
ok('sottotitolo dell\'appello: a capo (white-space: normal), né nowrap né ellipsis', (() => {
  const c = corpo(/\.appello-testa .*chi-kanji/)
  return /white-space:\s*normal/.test(c) && !/nowrap|ellipsis/.test(c)
})(), true)
ok('conto dell\'appello (11 / 12): su una riga sola', /white-space:\s*nowrap/.test(corpo(/\.conto-appello/)), true)

// Telefono a 375px (segnalazioni del cliente istruttore).
ok('calendario: il tag di stato non si attacca ai nomi (colonna a destra che non si stringe, con aria, nomi che vanno a capo)', (() => {
  const d = corpo(/\.lezione-destra/)
  const n = corpo(/\.lezione \.chi-kanji/)
  return /flex-shrink:\s*0/.test(d) && /margin-left:\s*\d+px/.test(d) && /overflow-wrap:\s*anywhere/.test(n)
})(), true)
ok('NON LO TROVO: SCRIVI IL NOME (.btn-dashed) sta su una riga', /white-space:\s*nowrap/.test(corpo(/\.btn-dashed/)) && /letter-spacing:\s*0(?![.\d])/.test(corpo(/\.btn-dashed/)), true)
{
  const spento = corpo(/\.appello-testa \.btn-go\[data-fatto\]:disabled/)
  ok('✓ TUTTI SEGNATI spento: bianco, testo e bordo verde (≥ 4,5:1 e 3:1), non sbiadito', sfondoBianco.test(spento) && /color:\s*var\(--verde-testo\)/.test(spento) && /border(-color)?:[^;]*var\(--verde-testo\)/.test(spento) && /opacity:\s*1/.test(spento), true)
  ok('l\'appello segna data-fatto sul tasto quando sono tutti segnati', /data-fatto=\{[^}]*tuttiSegnati[^}]*\}/.test(readFileSync('src/components/AppelloScreen.tsx', 'utf8')), true)
}
ok('CHIUDI IN FONDO ↓: bersaglio alto almeno 44px', /min-height:\s*44px/.test(corpo(/\.appello-vai/)), true)

// --- 6. la guida -------------------------------------------------------------
console.log('\nLa guida (guida/istruttori.md)')
const guida = readFileSync('guida/istruttori.md', 'utf8').replace(/\s+/g, ' ')
ok('non dice più che nel menu c\'è il tasto del tema', /quello del tema/i.test(guida), false)
ok('dice che l\'area ha l\'aspetto del sito', /aspetto del sito|colori e i caratteri del sito/i.test(guida), true)

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
