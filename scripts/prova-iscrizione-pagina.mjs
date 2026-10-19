// ---------------------------------------------------------------------------
// LA PAGINA PUBBLICA /iscrizioni/, senza browser.
//
//   node scripts/prova-iscrizione-pagina.mjs
//
// Ripensata: tasto COMPILA LA RICHIESTA in cima, nessun tempo promesso sul
// richiamo, niente Google, l'aspetto del sito su tutta la pagina e una colonna
// sola. L'ordine delle sezioni sta in `lib/paginaIscrizioni.ts`, non nel .tsx.
// Design: docs/design-canvas/iscrizioni-pagina.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const sorgente = (f) => readFileSync(f, 'utf8')

const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  })
  return outputFiles[0].text
}
let n = 0
const carica = (testo) => import('data:text/javascript;base64,' + Buffer.from(testo + `\n// ${++n}`).toString('base64'))
const caricaLib = async (nome) => {
  try {
    return await carica(await impacchetta(`export * from './src/lib/${nome}'`))
  } catch (e) {
    return { errore: e.errors?.[0]?.text ?? e.message }
  }
}

// --- a. i testi e l'ordine ---------------------------------------------------
console.log('\nLa pagina (src/lib/paginaIscrizioni.ts)')
const p = await caricaLib('paginaIscrizioni')
ok('src/lib/paginaIscrizioni.ts si carica', p.errore ?? 'ok', 'ok')
const P = p.errore ? {} : p

const SEZIONI = ['apertura', 'serve', 'prova', 'costi', 'paga', 'richiesta', 'modulo', 'aiuto', 'piede']
ok('modulo aperto: apertura, serve, prova, costi, paga, richiesta, modulo, aiuto, piede', P.sezioniPagina?.(true), SEZIONI)
ok('modulo chiuso: lo stesso senza «richiesta» (il secondo COMPILA LA RICHIESTA)', P.sezioniPagina?.(false), SEZIONI.filter((s) => s !== 'richiesta'))

ok('APERTURA', P.APERTURA, { titolo: 'Iscriviti a Officine Dello Sport', frase: 'Compili la richiesta dal telefono. La segreteria la guarda e ti richiama.' })
// Senza la frase la prova non passa a vuoto: serve prima che ci sia.
ok('nessun tempo promesso sul richiamo: niente cifre, «entro», «ore», «giorni»', typeof P.APERTURA?.frase === 'string' && !/\d|\bentro\b|\bore\b|\bgiorni?\b/i.test(P.APERTURA.frase), true)
ok('AVVISO_RICHIESTA', P.AVVISO_RICHIESTA, 'La richiesta non è ancora l’iscrizione. Non si salva a metà: se esci, ricominci.')
ok('SENZA_MODULO (al posto del tasto)', P.SENZA_MODULO, 'Per iscriverti chiamaci o passa in palestra.')
// La carta è di chi si iscrive, dai 6 anni: la prima riga non manda più a quella del genitore.
ok('COSA_SERVE: la carta di chi si iscrive, dai 6 anni, senza il genitore', [/^La carta d’identità/.test(P.COSA_SERVE?.[0] ?? ''), /6 anni/.test(P.COSA_SERVE?.[0] ?? ''), /genitore/i.test(P.COSA_SERVE?.[0] ?? '')], [true, true, false])
ok('COSA_SERVE: le altre righe', P.COSA_SERVE?.slice(1), [
  'Il certificato medico, se ce l’hai. Se no, mandi la richiesta lo stesso e lo porti in segreteria.',
  'La ricevuta del pagamento, se hai già pagato.',
  'Per un minore firma il genitore.',
])
const serve = (P.COSA_SERVE ?? []).join('\n')
ok('COSA_SERVE nomina la carta d’identità', /carta d’identità/.test(serve), true)
ok('COSA_SERVE: il certificato non blocca («lo stesso»)', /certificato medico/.test(serve) && /lo stesso/.test(serve), true)
ok('COSA_SERVE nomina la ricevuta', /ricevuta/.test(serve), true)
ok('COSA_SERVE: per un minore firma il genitore', /minore firma il genitore/.test(serve), true)
ok('COME_SI_PAGA', P.COME_SI_PAGA, { titolo: 'Dopo la richiesta, oppure in segreteria.', ricevuta: 'La ricevuta la puoi caricare nella richiesta, se hai già pagato.' })
ok('apertura col modulo aperto: tasto e avviso, niente SENZA_MODULO', P.aperturaDellaPagina?.(true), { tasto: true, avviso: true, senzaModulo: false })
ok('apertura col modulo chiuso: niente tasto né avviso, solo SENZA_MODULO', P.aperturaDellaPagina?.(false), { tasto: false, avviso: false, senzaModulo: true })
ok('PROVA_CHIAMA, DUBBIO, INFORMATIVA_FRASE', [P.PROVA_CHIAMA, P.DUBBIO, P.INFORMATIVA_FRASE], ['Per cominciare, passa in palestra o chiamaci.', 'Hai un dubbio? Chiamaci o passa in palestra.', 'Come trattiamo i tuoi dati:'])
ok('MODULO_DA_LEGGERE', P.MODULO_DA_LEGGERE, { titolo: 'Si firma col dito, nella richiesta.', testo: 'Se vuoi, prima lo leggi o lo stampi: quello per maggiorenni, o quello per minori che firma il genitore.' })

// --- b. la prova 3/10 € ------------------------------------------------------
console.log('\nLa prova (PROVA in src/lib/iscrizione.ts)')
const isc = await caricaLib('iscrizione')
ok('src/lib/iscrizione.ts si carica', isc.errore ?? 'ok', 'ok')
ok('PROVA.etichetta', isc.PROVA?.etichetta, 'Non sai ancora quale corso?')
ok('PROVA ha ancora costi e testo', [typeof isc.PROVA?.costi, typeof isc.PROVA?.testo], ['object', 'string'])
ok('MODULO_IN_APP resta il cancello', typeof isc.MODULO_IN_APP, 'boolean')

// --- c. via il Google --------------------------------------------------------
console.log('\nVia il Google')
const lib = sorgente('src/lib/iscrizione.ts')
for (const x of ['forms.gle', 'LINK_ISCRIZIONE', 'PASSI_GOOGLE', 'PASSI_PUBBLICI', 'MODULO_IN_APP_PUBBLICO'])
  ok(`iscrizione.ts non contiene più ${x}`, lib.includes(x), false)
ok('iscrizione.ts non esporta più PASSI', /export\s+const\s+PASSI\b/.test(lib), false)

// --- d. i sorgenti della pagina ----------------------------------------------
console.log('\nIscrizioniScreen.tsx')
const pag = sorgente('src/components/IscrizioniScreen.tsx')
ok('usa sezioniPagina( (l’ordine non è scritto a mano)', /sezioniPagina\(/.test(pag), true)
ok('chiama apriAspettoModulo( (tutta la pagina ha l’aspetto del sito)', /apriAspettoModulo\(/.test(pag), true)
ok('non nomina più «metro Fermi»', pag.includes('metro Fermi'), false)
ok('non usa più LINK_ISCRIZIONE', pag.includes('LINK_ISCRIZIONE'), false)
// Il cancello è uno solo, MODULO_IN_APP, e il .tsx lo passa alle due funzioni di lib: con un `true` fisso o un condizionale a mano le due metà direbbero cose diverse.
ok('il .tsx chiama sezioniPagina(MODULO_IN_APP) e le sezioni si rendono in quell\'ordine (map diretto, niente reverse)', /sezioniPagina\(MODULO_IN_APP\)\s*\.map\(/.test(pag) && !/\.reverse\(/.test(pag), true)
ok('il .tsx chiama aperturaDellaPagina(MODULO_IN_APP) e non decide a mano il tasto', /aperturaDellaPagina\(MODULO_IN_APP\)/.test(pag) && !/\{MODULO_IN_APP\s*(\?|&&)/.test(pag), true)
ok('MODULO_IN_APP: aperto in prova o con l\'informativa approvata', /export const MODULO_IN_APP\s*=\s*!haUnServer\s*\|\|\s*!!INFORMATIVA_PUBBLICA\s*$/m.test(lib), true)
ok('{PROVA_CHIAMA} è nel JSX, non solo nell\'import', /\{PROVA_CHIAMA\}/.test(pag), true)
// I testi stanno in lib: una frase ritoccata nel .tsx non farebbe cadere nessuna prova.
for (const f of ['Per cominciare', 'Hai un dubbio', 'Come trattiamo'])
  ok(`«${f}…» non è scritta nel .tsx`, pag.includes(f), false)
ok('il .tsx usa le frasi di lib (PROVA_CHIAMA, DUBBIO, INFORMATIVA_FRASE)', ['PROVA_CHIAMA', 'DUBBIO', 'INFORMATIVA_FRASE'].every((x) => pag.includes(x)), true)

const conta = (testo, x) => testo.split(x).length - 1
const costi = sorgente('src/components/Costi.tsx')
ok('la validità della quota compare una sola volta (pagina + Costi)', conta(pag, 'PAGAMENTO.validaFino') + conta(costi, 'PAGAMENTO.validaFino'), 1)
ok('l’IBAN compare una sola volta (pagina + Costi)', conta(pag, 'PAGAMENTO.iban') + conta(costi, 'PAGAMENTO.iban'), 1)

// --- e. il CSS: una colonna sola, max 720px ----------------------------------
console.log('\nUna colonna sola (src/styles.css)')
const css = sorgente('src/styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
// I blocchi @media con le loro regole, per sapere a che larghezza vale ciascuna.
const media = []
for (const m of css.matchAll(/@media\s*([^{]+)\{/g)) {
  let i = m.index + m[0].length, prof = 1
  while (prof && i < css.length) prof += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0, i++
  media.push({ cond: m[1].trim(), corpo: css.slice(m.index + m[0].length, i - 1) })
}
const SEL = /(^|[}\s,])\.scroll\s*>\s*\.iscrizioni\s*\{([^}]*)\}/g
const aPartireDa = (cond) => {
  const min = /min-width:\s*(\d+)px/.exec(cond)
  return min && !/max-width/.test(cond) ? +min[1] : null
}
const stretta = media.some((b) => {
  const da = aPartireDa(b.cond)
  return da === 640 && [...b.corpo.matchAll(SEL)].some((r) => /max-width:\s*720px/.test(r[2]))
})
ok('da 640px `.scroll > .iscrizioni` ha max-width: 720px (e vale anche a 960px e oltre: la regola non ha un max-width)', stretta, true)
const stretto = (sel) => media.some((b) => aPartireDa(b.cond) === 640 && [...b.corpo.matchAll(new RegExp('(^|[}\\s,])' + sel.replace(/[.>]/g, '\\$&').replace(/ /g, '\\s*') + '\\s*\\{([^}]*)\\}', 'g'))].some((r) => /max-width:\s*720px/.test(r[2])))
ok('anche il riquadro IL VESTIARIO, sotto la pagina, sta nei 720px da 640px', stretto('.scroll > .iscrizioni-contatti'), true)
ok('la griglia a due colonne (\'passi costi\') non c’è più', /grid-template-areas:\s*'passi costi'/.test(css), false)

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
