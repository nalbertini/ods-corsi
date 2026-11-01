// ---------------------------------------------------------------------------
// «Segreteria in ordine»: una grammatica sola per Iscritti, Contabilità e
// Presenze (tasti, testata, schede, filtri, stato, righe), senza browser.
//
//   node scripts/prova-segreteria-ordine.mjs
//
// Il design approvato sta in docs/design-canvas/segreteria-ordine/ e nei
// componenti PROPOSTA di docs/design-canvas/ods-design-system/ (TestataPagina,
// Linguette, SegnoStato, RigaMovimentoCompatta, RigaElenco). Si leggono come
// testo i sorgenti CSS e .tsx.
//
// I NOMI CHE IL CODICE DEVE USARE (la prova li cerca così):
//   .sg-testa-azioni      il blocco di destra di `Testa` (comune.tsx): le azioni
//                         stanno lì dentro; sotto i 1000px (@media max-width:1000px)
//                         `.sg-testa` le porta sotto il titolo. Tasti della
//                         testata: `.sg-testa .sg-btn` min-height 44px.
//   SegnoStato            componente di comune.tsx (`<SegnoStato tono parola />`):
//                         pallino + parola, rende la classe esistente
//                         `.sg-segno-elenco` (Inter 14px, mai a capo, niente
//                         maiuscolo spaziato). NB: `.sg-stato` è già una scheda
//                         d'altro uso (styles.css), perciò non si riusa.
//   .scheda               linguetta sottolineata: min-height >= 44, niente
//                         corsivo, letter-spacing <= 0.05em (resta role=tab).
//   .sg-elenco            il contenitore delle liste anche in Iscritti e
//                         Presenze (Contabilità ce l'ha già); le righe di
//                         Presenze (CHI SI STA PERDENDO, APPELLI MANCANTI)
//                         sono righe d'elenco, non `.sg-riquadro`/`.sg-voce-elenco`.
//   .sg-filtro-menu-valore  la pillola del filtro: min-width:0 + ellipsis.
//   Tasto icona="aggiungi"  ogni «Nuovo …» è `<Tasto icona="aggiungi">` (oppure
//                         `nuovo` mappato su 'aggiungi' in AZIONI di lib/icone.ts).
//   lib/filtriIscritti.ts   'file-di-prima': 'Da archiviare' (stato giallo).
//   lib/contabilita.ts      originiMovimento non ritorna più 'Dal gestionale'.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

const leggi = (p) => readFileSync(p, 'utf8')
const D = 'src/components/segreteria/'
const stili = leggi('src/styles.css') + '\n' + leggi('src/segreteria.css')
const css = stili.replace(/\/\*[\s\S]*?\*\//g, '')
const pagine = { Iscritti: leggi(D + 'Iscritti.tsx'), Contabilita: leggi(D + 'Contabilita.tsx'), Presenze: leggi(D + 'Presenze.tsx'), PresenzeSegnalate: leggi(D + 'PresenzeSegnalate.tsx') }
const figliContabilita = { Bilancio: leggi(D + 'Bilancio.tsx') }
const tutte = { ...pagine, ...figliContabilita }
const comune = leggi(D + 'comune.tsx')

// --- CSS: le dichiarazioni di tutte le regole il cui selettore è proprio `sel` ---
const regole = (sel) => {
  const fuori = []
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selettori = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '))
    if (selettori.includes(sel)) fuori.push(m[2])
  }
  return fuori.join(';')
}
const px = (dich, prop) => Number(dich.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(\\d+(?:\\.\\d+)?)px`))?.[1] ?? 0)
const em = (dich) => Number(dich.match(/letter-spacing:\s*(\d*\.?\d+)em/)?.[1] ?? 0)
// Il blocco di una @media con quella condizione, parentesi bilanciate.
const bloccoMedia = (cond) => {
  const fuori = []
  let da = 0
  for (;;) {
    const i = css.indexOf(`@media ${cond}`, da)
    if (i < 0) break
    let n = 0
    let j = css.indexOf('{', i)
    const inizio = j
    for (; j < css.length; j++) {
      if (css[j] === '{') n++
      else if (css[j] === '}' && --n === 0) break
    }
    fuori.push(css.slice(inizio, j))
    da = j
  }
  return fuori.join('\n')
}

// --- TSX: i tag (con la loro fine vera, anche con `=>` e `{{ }}` dentro) ---
const tagDa = (src, i) => {
  let prof = 0
  let virg = ''
  for (let j = i; j < src.length; j++) {
    const c = src[j]
    if (virg) { if (c === virg) virg = ''; continue }
    if (prof === 0 && c === '"') { virg = '"'; continue }
    if (c === '{') prof++
    else if (c === '}') prof--
    else if (prof === 0 && c === '>' ) return src.slice(i, j + 1)
  }
  return src.slice(i)
}
const tagDi = (src, nome) => {
  const fuori = []
  for (const m of src.matchAll(new RegExp(`<${nome}(?=[\\s>/])`, 'g'))) {
    const tag = tagDa(src, m.index)
    const dopo = src.slice(m.index + tag.length)
    const fine = dopo.indexOf(`</${nome}>`)
    fuori.push({ tag, testo: fine < 0 ? '' : dopo.slice(0, fine) })
  }
  return fuori
}
const tastiDi = (src) => ['button', 'a', 'summary', 'Tasto', 'TastoLink'].flatMap((n) => tagDi(src, n).map((t) => ({ ...t, nome: n })))
const èTasto = (t) => /sg-btn/.test(t.tag) || t.nome === 'Tasto' || t.nome === 'TastoLink'
const pulito = (testo) => testo.replace(/<[^>]*>|\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim()

// 1. Tasti: quattro forme (+ tratteggio e pericolo), giallo del sito.
const AMMESSE = new Set(['pieno', 'linea', 'rosso', 'verde', 'tratteggio', 'pericolo'])
const usate = new Set()
for (const [nome, src] of Object.entries(tutte)) {
  for (const m of src.matchAll(/sg-btn-([a-z]+)/g)) usate.add(`${nome}:${m[1]}`)
  for (const t of tagDi(src, 'Tasto').concat(tagDi(src, 'TastoLink'))) {
    const tono = t.tag.match(/tono=(?:"([a-z]+)"|\{'([a-z]+)'\})/)
    if (tono) usate.add(`${nome}:${tono[1] ?? tono[2]}`)
  }
}
ok('i tasti delle tre pagine usano solo pieno, linea, rosso, verde, tratteggio, pericolo', [...usate].filter((u) => !AMMESSE.has(u.split(':')[1])), [])
const pieno = regole(":root[data-look='sito'] .sg-btn-pieno")
ok('il tasto principale è giallo del sito (#f4c31b) con testo #0d2a3d', [/--giallo:\s*#f4c31b/.test(css) && /background:\s*var\(--giallo\)/.test(pieno), /--su-colore:\s*#0d2a3d/.test(css) && /color:\s*var\(--su-colore\)/.test(pieno)], [true, true])

// 2. Un solo tasto pieno o rosso per testata.
for (const [nome, src] of Object.entries(pagine)) {
  for (const t of tagDi(src, 'Testa')) {
    const quanti = (t.testo.match(/sg-btn-(pieno|rosso)|tono="(pieno|rosso)"/g) ?? []).length
    ok(`${nome}: nella testata al massimo un tasto pieno o rosso`, quanti <= 1, true)
  }
}
// In Contabilità i tasti della testata arrivano da un portale (Movimenti): il giallo è uno solo anche lì.
{
  const mov = pagine.Contabilita.slice(pagine.Contabilita.indexOf('createPortal('), pagine.Contabilita.indexOf('azioni,\n', pagine.Contabilita.indexOf('createPortal(')))
  ok('Contabilità: i tasti che vanno nella testata hanno un solo tasto pieno', (mov.match(/sg-btn-pieno|tono="pieno"/g) ?? []).length, 1)
}

// 3. Misure: .sg-btn 48 (44 nella testata), .sg-chip 44, nessuna misura sua.
ok('.sg-btn è alto almeno 44px', px(regole('.sg-btn'), 'min-height') >= 44, true)
ok('i tasti nella testata sono alti 44px (come TestataPagina)', px(regole('.sg-testa .sg-btn'), 'min-height'), 44)
ok('.sg-chip è alto 44px', px(regole('.sg-chip'), 'min-height'), 44)
for (const [nome, src] of Object.entries(tutte)) {
  const conMisura = tastiDi(src).filter((t) => /sg-(btn|chip)/.test(t.tag) && /style=\{\{[^}]*\b(height|minHeight|padding|paddingBlock|paddingTop|paddingBottom)\b/.test(t.tag)).length
  ok(`${nome}: nessun .sg-btn o .sg-chip con altezza o padding suo`, conMisura, 0)
}

// 4. «Crea» = icona aggiungi, mai «+» a mano.
const iconeLib = leggi('src/lib/icone.ts')
const nuovoMappato = /AZIONI[^=]*=\s*\{[^}]*\bnuovo:\s*'aggiungi'/.test(iconeLib)
for (const [nome, src] of Object.entries(tutte)) {
  const tasti = tastiDi(src).filter(èTasto)
  const piu = tasti.filter((t) => /^\+\s/.test(pulito(t.testo))).map((t) => pulito(t.testo))
  ok(`${nome}: nessun «+» scritto a mano nel testo dei tasti`, piu, [])
  const crea = tasti.filter((t) => /^(Nuov[oa]|Aggiungi|Crea)\b/.test(pulito(t.testo)) || /^\+\s*Nuov/.test(pulito(t.testo)))
  const senzaIcona = crea.filter((t) => !((t.nome === 'Tasto' || t.nome === 'TastoLink') && (/icona="aggiungi"/.test(t.tag) || nuovoMappato)) && !/nome="aggiungi"/.test(t.testo)).map((t) => pulito(t.testo))
  ok(`${nome}: ogni azione «crea» porta l'icona aggiungi`, senzaIcona, [])
}

// 5. Tutta la riga apre: niente «Cambia» / «Apri la scheda» come tasto di riga.
{
  const tavola = (src, aria, lungo) => { const i = src.indexOf(`aria-label="${aria}" className="sg-tabella"`); return i < 0 ? '' : src.slice(i, i + lungo) }
  for (const [nome, righe] of [['Iscritti', tavola(pagine.Iscritti, 'Iscritti', 5000)], ['Contabilita', tavola(pagine.Contabilita, 'Movimenti', 6000)]]) {
    const tasti = tastiDi(righe).map((t) => pulito(t.testo)).filter((x) => /^(Cambia|Apri la scheda|Apri)\b/.test(x))
    ok(`${nome}: le righe dell'elenco non hanno un tasto Cambia / Apri la scheda`, tasti, [])
    ok(`${nome}: le righe dell'elenco sono state lette`, righe.length > 0, true)
  }
  ok('Contabilità: la riga del movimento si apre col clic su tutta la riga', /role="row" className="sg-riga-movimento[^"]*"[^>]*onClick=/.test(pagine.Contabilita), true)
}

// 6. Testata: azioni a destra, sotto i 1000px vanno sotto, niente <a sg-btn> dentro.
{
  const fn = comune.slice(comune.indexOf('export function Testa('), comune.indexOf('/** Un campo con la sua etichetta'))
  ok('Testa tiene le azioni in un blocco a destra (.sg-testa-azioni)', /<div className="sg-testa-azioni"[^>]*>\s*\{children\}\s*<\/div>/.test(fn), true)
  ok('.sg-testa-azioni allinea le azioni in alto, senza ridursi (flex-shrink: 0)', /align-items:\s*flex-start/.test(regole('.sg-testa-azioni')) && /flex-shrink:\s*0/.test(regole('.sg-testa-azioni')), true)
  ok('.sg-testa allinea titolo e azioni in alto (non al centro)', /align-items:\s*flex-start/.test(regole('.sg-testa')), true)
  const stretto = bloccoMedia('(max-width: 1000px)')
  // Sopra i 1000px la testata non va a capo: con una frase lunga sotto il titolo (Contabilità) il blocco del
  // testo si prendeva tutta la riga e le azioni finivano sotto, mentre in Iscritti e Presenze stavano a destra.
  ok('sopra i 1000px la testata non va a capo (flex-wrap: nowrap): le azioni restano a destra', /flex-wrap:\s*nowrap/.test(regole('.sg-testa')), true)
  ok('sotto i 1000px la testata può andare a capo (flex-wrap: wrap)', /\.sg-testa\s*\{[^}]*flex-wrap:\s*wrap/.test(stretto), true)
  ok('sotto i 1000px la testata porta le azioni sotto il titolo', /\.sg-testa-azioni\s*\{[^}]*(flex-basis:\s*100%|width:\s*100%)/.test(stretto) || /\.sg-testa\s*\{[^}]*flex-direction:\s*column/.test(stretto), true)
  for (const [nome, src] of Object.entries(pagine)) {
    for (const t of tagDi(src, 'Testa')) {
      const link = tastiDi(t.testo).filter((x) => (x.nome === 'a' || x.nome === 'TastoLink') && /sg-btn|TastoLink/.test(x.tag + x.nome))
      ok(`${nome}: nessun <a> con classe sg-btn dentro la testata`, link.length, 0)
    }
  }
}

// 7. I contatori (Numero / sg-numeri) solo in Da fare. Le cifre di Bilancio
// (entrate, uscite, risultato) sono il contenuto della scheda, come i saldi:
// restano, l'ha deciso l'utente.
for (const [nome, src] of Object.entries({ Iscritti: pagine.Iscritti, Contabilita: pagine.Contabilita, Presenze: pagine.Presenze })) {
  ok(`${nome}: niente <Numero> né sg-numeri`, [(src.match(/<Numero\b/g) ?? []).length, (src.match(/sg-numeri/g) ?? []).length], [0, 0])
}
ok('i saldi delle casse in Contabilità restano (.sg-saldi)', /sg-saldi/.test(pagine.Contabilita) && regole('.sg-saldi') !== '', true)

// 8. Schede: linguette sottolineate, non tasti spenti.
{
  const s = regole('.scheda')
  ok('.scheda è alta almeno 44px', px(s, 'min-height') >= 44, true)
  ok('.scheda non è in corsivo', /font-style:\s*(oblique|italic)/.test(s), false)
  ok('.scheda non ha il letter-spacing dei tasti (<= 0.05em)', em(s) <= 0.05, true)
  ok('.scheda accesa ha la barra gialla sotto (border-bottom con --giallo)', /border-bottom:[^;]*var\(--giallo\)/.test(regole(".scheda[data-on='true']")), true)
  for (const [nome, src] of Object.entries({ Iscritti: pagine.Iscritti, Contabilita: pagine.Contabilita })) {
    const schede = tagDi(src, 'button').filter((t) => /className="scheda"/.test(t.tag))
    ok(`${nome}: ogni .scheda è role="tab" con aria-selected`, schede.length > 0 && schede.every((t) => /role="tab"/.test(t.tag) && /aria-selected=/.test(t.tag)), true)
    ok(`${nome}: le schede stanno in un role="tablist"`, /role="tablist"/.test(src), true)
  }
}

// 9. Filtri: 44px, la pillola si taglia con «…», la riga di stato va a capo.
ok('i campi dei filtri (.sg-campo) sono alti 44px', px(regole('.sg-campo'), 'height'), 44)
ok('il menu filtro (.sg-filtro-menu) è alto almeno 44px', px(regole('.sg-filtro-menu'), 'min-height') >= 44, true)
ok('i segmenti sono alti almeno 44px', px(regole('.sg-segmenti > button'), 'min-height') >= 44, true)
{
  const v = regole('.sg-filtro-menu-valore')
  ok('la pillola del filtro ha min-width: 0 e text-overflow: ellipsis', [/min-width:\s*0\b/.test(v), /text-overflow:\s*ellipsis/.test(v)], [true, true])
}
ok('la riga di stato dei risultati va a capo (flex-wrap: wrap)', /flex-wrap:\s*wrap/.test(regole('.sg-elenco-stato')), true)
ok('Presenze ha i filtri come FiltroMenu (Mese, Corso), non <select> nudi', [/<FiltroMenu/.test(pagine.Presenze), /<select\b/.test(pagine.Presenze)], [true, false])

// 10. Stato: una sola forma, pallino + parola, che non va a capo.
{
  const seg = regole('.sg-segno-elenco')
  ok('il segno di stato non va a capo (white-space: nowrap)', /white-space:\s*nowrap/.test(seg), true)
  ok('il segno di stato è Inter 14px (come SegnoStato del canvas)', px(seg, 'font-size'), 14)
  ok('il segno di stato non è maiuscolo spaziato', [/text-transform:\s*uppercase/.test(seg), em(seg) > 0.1], [false, false])
  ok('comune.tsx esporta SegnoStato (pallino + parola)', /export function SegnoStato\(/.test(comune) && /sg-segno-elenco/.test(comune.slice(comune.indexOf('export function SegnoStato('))), true)
  for (const nome of ['Iscritti', 'Contabilita', 'Presenze']) {
    ok(`${nome}: lo stato è <SegnoStato>`, /<SegnoStato\b/.test(pagine[nome]), true)
    ok(`${nome}: nessun badge pieno a maiuscolo spaziato (sg-tag) per lo stato`, /sg-tag|<Tag\b/.test(pagine[nome]), false)
  }
  const filtri = leggi('src/lib/filtriIscritti.ts')
  ok('il filtro dei certificati «da archiviare» si chiama «Da archiviare»', [/'file-di-prima':\s*'Da archiviare'/.test(filtri), /Non archiviato/i.test(filtri)], [true, false])
  ok('Iscritti non dice più «non archiviato»', /non archiviat/i.test(pagine.Iscritti), false)
}

// 11. Liste in .sg-elenco, mai una riquadro per riga.
// Le righe dei movimenti al computer stanno in due righe di testo: il nome e, sotto, voce e dettaglio
// su una riga sola tagliata con «…» (il resto è nel dettaglio). Andavano a capo su 3-4 righe.
{
  const sotto = regole('.sg-sotto-movimento')
  ok('il sotto del movimento, al computer, sta su una riga (white-space: nowrap)', /white-space:\s*nowrap/.test(sotto), true)
  ok('il sotto del movimento, al computer, si taglia con «…» (text-overflow: ellipsis)', /text-overflow:\s*ellipsis/.test(sotto) && /overflow:\s*hidden/.test(sotto), true)
  ok('sotto i 1200px il sotto del movimento torna in colonna', /\.sg-sotto-movimento\s*\{[^}]*flex-direction:\s*column/.test(bloccoMedia('(max-width: 1200px)')), true)
}
for (const nome of ['Iscritti', 'Contabilita', 'Presenze']) {
  ok(`${nome}: la lista sta in un contenitore .sg-elenco`, /className="sg-elenco[ "]/.test(pagine[nome]), true)
}
ok('Presenze: CHI SI STA PERDENDO e APPELLI MANCANTI non sono riquadri né voci a contorno', [/sg-riquadro/.test(pagine.Presenze), /sg-voce-elenco/.test(pagine.Presenze), /sg-chiudibile/.test(pagine.Presenze)], [false, false, false])
ok('Presenze: il conto sta nel titolo della sezione, non in un tasto «Apri la scheda» per riga', /Apri la scheda/.test(pagine.Presenze), false)
ok('Contabilità: nessuna riga in .card', /className="[^"]*\bcard\b/.test(pagine.Contabilita), false)

// 12. Niente «Dal gestionale».
ok('Contabilità non scrive «Dal gestionale»', [/Dal gestionale/.test(pagine.Contabilita), /Dal gestionale/.test(figliContabilita.Bilancio)], [false, false])
ok('originiMovimento (lib/contabilita.ts) non ritorna «Dal gestionale»', /Dal gestionale/.test(leggi('src/lib/contabilita.ts')), false)

// 13. Presenze: Statistiche è un link nella frase, «Scarica CSV» un tasto a linea con icona.
{
  const p = pagine.Presenze
  const tasti = tastiDi(p)
  const stat = tasti.filter((t) => /statistiche/.test(t.tag) || /Statistiche/.test(t.testo))
  ok('Presenze: il rimando a Statistiche non è un tasto sg-btn', stat.some((t) => èTasto(t)), false)
  const testa = tagDi(p, 'Testa')[0]
  ok('Presenze: il rimando a Statistiche è un link di testo (sg-link) nella frase sotto il titolo', !!testa && /sotto=\{[\s\S]*sg-link[\s\S]*statistiche/.test(testa.tag), true)
  const csv = tasti.find((t) => /Scarica CSV/.test(t.testo))
  const tono = csv?.tag.match(/tono="([a-z]+)"/)?.[1] ?? (csv && /sg-btn-linea/.test(csv.tag) ? 'linea' : csv?.nome === 'Tasto' ? 'linea' : '?')
  ok('Presenze: «Scarica CSV» è un tasto a linea', tono, 'linea')
  ok('Presenze: «Scarica CSV» porta l\'icona scarica', !!csv && (/icona="scarica"/.test(csv.tag) || (csv.nome === 'Tasto' && /\bscarica:\s*'scarica'/.test(iconeLib))), true)
  ok('Presenze: «Scarica CSV» sta nella testata', !!testa && /Scarica CSV/.test(testa.testo), true)
}

// --- Al telefono ISCRITTI dice certificato e quota a parole (segreteria-parole/) ---
{
  const tel = bloccoMedia('(max-width: 767px)')
  ok('Iscritti al telefono: niente più ✕ … – al posto delle parole', /sg-riga-iscritti[^{]*\{[^}]*content:\s*'[✕…–]'/.test(tel), false)
  ok('Iscritti al telefono: la parola del segno non si nasconde', /sg-riga-iscritti \.sg-segno-parola/.test(tel), false)
  ok('Iscritti: le parole sotto il nome stanno in .sg-stato-telefono, fatte con paroleTelefono', [/className="sg-stato-telefono"/.test(pagine.Iscritti), /paroleTelefono\(/.test(pagine.Iscritti)], [true, true])
  ok('.sg-stato-telefono si vede solo al telefono', [/display:\s*none/.test(regole('.sg-stato-telefono')), /\.sg-stato-telefono\s*\{[^}]*display:\s*flex/.test(tel)], [true, true])
  ok('Iscritti al telefono: due colonne, NOME e 30 GG', /grid-template-columns:\s*minmax\(0, 1fr\) 64px;/.test(tel), true)
  // Subito dopo il tasto, la riga del perché (il tag del tasto ha `=>` dentro: si parte dalla chiusura).
  // Quando e cosa dire lo decide nienteDaScaricare (prova-presenze-csv); qui solo che la frase sta sotto il tasto.
  const dopoIlTasto = (t) => { const m = /Scarica CSV\s*<\/Tasto>\s*\{(\w+) && <span[^>]*>\{(\w+)\}/.exec(t); return !!m && m[1] === m[2] && new RegExp(`const ${m[1]} = nienteDaScaricare\\(`).test(t) }
  ok('Presenze: sotto «Scarica CSV» spento c’è il perché', dopoIlTasto(pagine.Presenze), true)
  ok('Statistiche: sotto «Scarica CSV» spento c’è il perché', dopoIlTasto(leggi(D + 'Statistiche.tsx')), true)
}

process.exit(fallite ? 1 : 0)
