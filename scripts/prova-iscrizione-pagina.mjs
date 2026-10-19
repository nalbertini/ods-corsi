// ---------------------------------------------------------------------------
// LA PAGINA PUBBLICA /iscrizioni/, senza browser.
//
//   node scripts/prova-iscrizione-pagina.mjs
//
// La pagina corta: il titolo, cosa ti serve (una cosa per riga), un riquadro
// breve con la quota e le due offerte, la prova e i dubbi in un riquadro solo,
// COMPILA LA RICHIESTA una volta sola in fondo. I prezzi di ogni corso e come
// si paga stanno in una pagina a parte, `iscrizioni/#prezzi`. Testi e ordine
// in `lib/paginaIscrizioni.ts`, non nel .tsx.
// Design: docs/design-canvas/iscrizione-oggi/X1-PaginaSenzaCosti.dc.html e
// X2-Prezzi.dc.html.
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const sorgente = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

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

// --- 1. le sezioni -------------------------------------------------------------
console.log('\nLa pagina (src/lib/paginaIscrizioni.ts)')
const p = await caricaLib('paginaIscrizioni')
ok('src/lib/paginaIscrizioni.ts si carica', p.errore ?? 'ok', 'ok')
const P = p.errore ? {} : p

const SEZIONI = ['apertura', 'serve', 'costiBreve', 'provaDubbi', 'richiesta']
ok('modulo aperto: apertura, serve, costiBreve, provaDubbi, richiesta', prova(() => P.sezioniPagina(true)), SEZIONI)
ok('modulo chiuso: le stesse (in fondo c’è SENZA_MODULO al posto del tasto)', prova(() => P.sezioniPagina(false)), SEZIONI)

ok('APERTURA', P.APERTURA, { titolo: 'Iscriviti a Officine Dello Sport', frase: 'Compili la richiesta dal telefono. La segreteria la guarda e ti richiama.' })
ok('nessun tempo promesso sul richiamo: niente cifre, «entro», «ore», «giorni»', typeof P.APERTURA?.frase === 'string' && !/\d|\bentro\b|\bore\b|\bgiorni?\b/i.test(P.APERTURA.frase), true)
ok('AVVISO_RICHIESTA', P.AVVISO_RICHIESTA, 'La richiesta non è ancora l’iscrizione. Non si salva a metà: se esci, ricominci.')
ok('SENZA_MODULO', P.SENZA_MODULO, 'Per iscriverti chiamaci o passa in palestra.')
ok('INFORMATIVA_FRASE', P.INFORMATIVA_FRASE, 'Come trattiamo i tuoi dati:')
ok('COME_SI_PAGA (nella pagina dei prezzi)', P.COME_SI_PAGA, { titolo: 'Dopo la richiesta, oppure in segreteria.', ricevuta: 'La ricevuta la puoi caricare nella richiesta, se hai già pagato.' })

// --- 2. il fondo, uguale nelle due pagine -------------------------------------
console.log('\nIl fondo (fondoDellaPagina)')
ok('modulo aperto: il tasto e sotto AVVISO_RICHIESTA', prova(() => P.fondoDellaPagina(true)), { tasto: true, frase: 'La richiesta non è ancora l’iscrizione. Non si salva a metà: se esci, ricominci.' })
ok('modulo chiuso: niente tasto, solo SENZA_MODULO', prova(() => P.fondoDellaPagina(false)), { tasto: false, frase: 'Per iscriverti chiamaci o passa in palestra.' })
// Con un fondo solo, aperturaDellaPagina e il riquadro IL MODULO non servono più.
ok('aperturaDellaPagina non c’è più (il tasto in cima non c’è)', typeof P.aperturaDellaPagina, 'undefined')
ok('MODULO_DA_LEGGERE non c’è più (si firma col dito nella richiesta)', typeof P.MODULO_DA_LEGGERE, 'undefined')

// --- 4. cosa ti serve ---------------------------------------------------------
console.log('\nCosa ti serve (COSA_SERVE)')
ok('COSA_SERVE: quattro voci, titolo, quando e nota', P.COSA_SERVE, [
  { titolo: 'Il codice fiscale', nota: 'Di chi si iscrive. Se iscrivi un figlio, anche il tuo.' },
  { titolo: 'La carta d’identità', nota: 'Di chi si iscrive, dai 6 anni. Una foto o il PDF.' },
  { titolo: 'Il certificato medico', quando: 'SE CE L’HAI', nota: 'Se non ce l’hai, lo porti in segreteria prima della prima lezione.' },
  { titolo: 'La ricevuta del pagamento', quando: 'SE HAI GIÀ PAGATO', nota: 'Se no, paghi dopo o in segreteria.' },
])
ok('nessuna voce dice «firma il genitore»', JSON.stringify(P.COSA_SERVE ?? '').includes('firma il genitore'), false)

// --- 5 e 6. il riquadro breve dei costi ----------------------------------------
console.log('\nQuanto costa, in breve (costiBreve)')
const RIGHE = [
  { testo: 'Sconto famiglia, sull’annuale che costa meno', cifra: '−20%' },
  { testo: 'Più corsi nella struttura, in tutto', cifra: '660 €' },
]
ok('con Satispay', prova(() => P.costiBreve(50, true)), {
  etichetta: 'QUANTO COSTA · 2026/27',
  titolo: 'Quota associativa 50 €, più il corso.',
  righe: RIGHE,
  testo: 'I prezzi di ogni corso e come si paga: bonifico o Satispay, dopo la richiesta o in segreteria.',
  tasto: 'PREZZI E PAGAMENTO',
})
ok('senza Satispay la frase non lo nomina', prova(() => P.costiBreve(50, false).testo), 'I prezzi di ogni corso e come si paga: bonifico, dopo la richiesta o in segreteria.')
ok('la quota è quella passata (dal listino), non scritta: 55 → «55 €»', prova(() => P.costiBreve(55, true).titolo), 'Quota associativa 55 €, più il corso.')

const lib = sorgente('src/lib/paginaIscrizioni.ts')
const costiTs = sorgente('src/lib/costi.ts')
ok('paginaIscrizioni.ts prende SCONTO_FAMIGLIA da nucleo e PIU_CORSI da costi', [/import\s*\{[^}]*\bSCONTO_FAMIGLIA\b[^}]*\}\s*from\s*'\.\/nucleo'/.test(lib), /import\s*\{[^}]*\bPIU_CORSI\b[^}]*\}\s*from\s*'\.\/costi'/.test(lib)], [true, true])
for (const x of ['50 €', '660', '20%'])
  ok(`«${x}» non è scritto in paginaIscrizioni.ts`, lib.includes(x), false)

const c = await caricaLib('costi')
ok('PIU_CORSI = 660, in src/lib/costi.ts', c.PIU_CORSI, 660)
ok('OFFERTE, PIÙ CORSI: lo stesso testo di oggi', c.OFFERTE?.find((o) => o.titolo === 'PIÙ CORSI')?.testo, 'Il costo totale per partecipare a più corsi nella struttura è di 660 €.')
ok('OFFERTE, PIÙ CORSI: la cifra viene da PIU_CORSI (una verità sola)', /\$\{PIU_CORSI\}\s*€/.test(costiTs) && !/di 660 €/.test(costiTs), true)

// --- 7. la prova e i dubbi ----------------------------------------------------
console.log('\nLa prova e i dubbi (provaEDubbi)')
const sito = await caricaLib('sito')
ok('con i CONTATTI veri', prova(() => P.provaEDubbi(sito.CONTATTI)), {
  etichetta: 'Non sai ancora quale corso? Hai un dubbio?',
  frase: 'Per la prova o per un dubbio, chiamaci o passa in palestra: Via Vittorio Sassi 26, Collegno. Telefono 346 329 2786.',
})
ok('indirizzo e telefono vengono dai contatti passati', prova(() => P.provaEDubbi({ indirizzo: 'Via Altra 1, Torino', telefono: '011 000' }).frase), 'Per la prova o per un dubbio, chiamaci o passa in palestra: Via Altra 1, Torino. Telefono 011 000.')

// --- 8. la vista dall'hash ----------------------------------------------------
console.log('\nLa vista di iscrizioni/ (vistaIscrizioni)')
const V = (server, hash) => prova(() => P.vistaIscrizioni(server, hash))
ok('nessun hash: la pagina, senza testata', V(true, ''), { vista: 'pagina', testata: false })
ok('nessun hash, in prova: la pagina, senza testata', V(false, ''), { vista: 'pagina', testata: false })
ok('#prezzi: la pagina dei prezzi, con la testata', V(true, '#prezzi'), { vista: 'prezzi', testata: true })
ok('#vestiario: il vestiario, con la testata', V(true, '#vestiario'), { vista: 'vestiario', testata: true })
ok('#nuova in prova: il flusso a passi, con la testata', V(false, '#nuova'), { vista: 'passi', testata: true })
ok('#nuova col database vero: la pagina', V(true, '#nuova'), { vista: 'pagina', testata: false })
ok('un hash sconosciuto: la pagina', V(true, '#altro'), { vista: 'pagina', testata: false })
// COMPILA LA RICHIESTA della pagina dei prezzi apre il modulo sulla pagina, al posto di #prezzi nella cronologia:
// l'indietro del browser esce dalle iscrizioni come dalla pagina, invece di smontare il modulo senza domanda.
const can = await caricaLib('cancelletti')
ok('INDIRIZZO_RICHIESTA = #richiesta', can.INDIRIZZO_RICHIESTA, '#richiesta')
ok('#richiesta: la pagina, senza testata', V(true, '#richiesta'), { vista: 'pagina', testata: false })
ok('moduloDalCancelletto: #richiesta apre il modulo, il resto no', ['#richiesta', '', '#prezzi', '#vestiario'].map((h) => prova(() => P.moduloDalCancelletto(h))), [true, false, false, false])

// --- 9. la prova 3/10 € e il cancello ------------------------------------------
console.log('\nLa prova e il cancello (src/lib/iscrizione.ts)')
const isc = await caricaLib('iscrizione')
ok('src/lib/iscrizione.ts si carica', isc.errore ?? 'ok', 'ok')
ok('PROVA.etichetta', isc.PROVA?.etichetta, 'Non sai ancora quale corso?')
ok('PROVA ha ancora costi e testo', [typeof isc.PROVA?.costi, typeof isc.PROVA?.testo], ['object', 'string'])
ok('MODULO_IN_APP resta il cancello', typeof isc.MODULO_IN_APP, 'boolean')
const iscTs = sorgente('src/lib/iscrizione.ts')
ok('MODULO_IN_APP: aperto in prova o con l’informativa approvata', /export const MODULO_IN_APP\s*=\s*!haUnServer\s*\|\|\s*!!INFORMATIVA_PUBBLICA\s*$/m.test(iscTs), true)

console.log('\nVia il Google')
for (const x of ['forms.gle', 'LINK_ISCRIZIONE', 'PASSI_GOOGLE', 'PASSI_PUBBLICI', 'MODULO_IN_APP_PUBBLICO'])
  ok(`iscrizione.ts non contiene più ${x}`, iscTs.includes(x), false)
ok('iscrizione.ts non esporta più PASSI', /export\s+const\s+PASSI\b/.test(iscTs), false)

// --- 3. i sorgenti della pagina ----------------------------------------------
console.log('\nIscrizioniScreen.tsx')
const tsx = sorgente('src/components/IscrizioniScreen.tsx')
const funzione = (testo, nome) => {
  const i = testo.search(new RegExp(`(^|\\n)(export )?function ${nome}\\(`))
  if (i < 0) return ''
  const fine = testo.indexOf('\n}\n', i + 1)
  return testo.slice(i, fine < 0 ? undefined : fine + 3).trim()
}

// Prova e Contatti servono al flusso a passi (IscrizioneAPassi): restano come sono oggi, parola per parola.
const PROVA_DI_OGGI = `export function Prova({ etichetta = 'PRIMA DI ISCRIVERTI' }: { etichetta?: string }) {
  return (
    <section className="pad iscrizioni-prova">
      <Riquadro tono="prova">
        <Etichetta>{etichetta.toUpperCase()}</Etichetta>
        {PROVA.costi.map((c) => (
          <span key={c.cosa} className="row prova-testa">
            <span className="passo-titolo">{c.cosa} di prova</span>
            <Cifra>{c.costo}</Cifra>
          </span>
        ))}
        <Dettaglio>{PROVA.testo} {PROVA_CHIAMA}</Dettaglio>
        <Tasto href={chiama} qui>
          CHIAMA
        </Tasto>
      </Riquadro>
    </section>
  )
}`
const CONTATTI_DI_OGGI = `export function Contatti({ social = true }: { social?: boolean }) {
  return (
    <section className="pad iscrizioni-contatti">
      <Riquadro>
        <span className="passo-titolo">{DUBBIO}</span>
        <Dettaglio>
          {CONTATTI.indirizzo}. Telefono <span className="num testo-pieno">{CONTATTI.telefono}</span>.
        </Dettaglio>
        <Tasti>
          <Tasto href={chiama} qui>
            CHIAMA
          </Tasto>
          <Tasto href={CONTATTI.mappa}>MAPPA</Tasto>
          {social && <Tasto href={CONTATTI.instagram}>INSTAGRAM</Tasto>}
          {social && <Tasto href={CONTATTI.facebook}>FACEBOOK</Tasto>}
          {social && <Tasto href={SITO}>IL SITO</Tasto>}
        </Tasti>
      </Riquadro>
    </section>
  )
}`
ok('Prova è esportata e invariata', funzione(tsx, 'Prova'), PROVA_DI_OGGI)
ok('Contatti è esportata e invariata', funzione(tsx, 'Contatti'), CONTATTI_DI_OGGI)
ok('IscrizioneAPassi le prende ancora da qui', /import \{ Contatti, Prova \} from '\.\/IscrizioniScreen'/.test(sorgente('src/components/IscrizioneAPassi.tsx')), true)

// Il resto del file è la pagina: Prova e Contatti (con i loro CHIAMA e i social del flusso a passi) non contano.
const pagina = tsx.replace(PROVA_DI_OGGI, '').replace(CONTATTI_DI_OGGI, '')
const conta = (testo, x) => testo.split(x).length - 1
ok('usa sezioniPagina(MODULO_IN_APP).map( e niente reverse', /sezioniPagina\(MODULO_IN_APP\)\s*\.map\(/.test(pagina) && !/\.reverse\(/.test(pagina), true)
ok('chiama apriAspettoModulo(', /apriAspettoModulo\(/.test(pagina), true)
const apertura = funzione(pagina, 'Apertura') + (/^\s*apertura:.*$/m.exec(pagina)?.[0] ?? '')
ok('nell’apertura non c’è nessun <Tasto', apertura.length > 0 && !apertura.includes('<Tasto'), true)
ok('CHIAMA in un solo <Tasto (quello della prova e dei dubbi)', conta(pagina, 'CHIAMA\n') + conta(pagina, '>CHIAMA<'), 1)
ok('«COMPILA LA RICHIESTA» una volta sola', conta(pagina, 'COMPILA LA RICHIESTA'), 1)
for (const x of ['MODULI', 'INSTAGRAM', 'FACEBOOK', 'IL SITO', 'ModuloDaLeggere', 'Piede', 'metro Fermi', 'LINK_ISCRIZIONE', 'aperturaDellaPagina'])
  ok(`la pagina non nomina ${x}`, pagina.includes(x), false)
ok('<Costi e ComeSiPaga non stanno nella pagina', [tsx.includes('<Costi'), tsx.includes('ComeSiPaga')], [false, false])
ok('il fondo viene da fondoDellaPagina(MODULO_IN_APP), senza condizionali a mano', /fondoDellaPagina\(MODULO_IN_APP\)/.test(pagina) && !/\{MODULO_IN_APP\s*(\?|&&)/.test(pagina), true)
ok('il riquadro breve: costiBreve(quota del listino, PAGAMENTO.satispay)', /costiBreve\(\s*[^,]*\.quota\b[^,]*,\s*(?:!!PAGAMENTO\.satispay|Boolean\(PAGAMENTO\.satispay\))\s*\)/.test(pagina), true)
ok('la quota la legge useListino(', /useListino\(/.test(pagina), true)
for (const x of ['50 €', '660', '20%', 'Satispay', '3 €', '10 €'])
  ok(`«${x}» non è scritto nella pagina`, pagina.includes(x), false)
ok('il riquadro prova e dubbi: provaEDubbi(CONTATTI), PROVA.costi, PROVA.testo, CONTATTI.mappa', ['provaEDubbi(CONTATTI)', 'PROVA.costi', 'PROVA.testo', 'CONTATTI.mappa'].map((x) => pagina.includes(x)), [true, true, true, true])
ok('le voci di COSA_SERVE si rendono con titolo, quando e nota', ['COSA_SERVE', '.titolo', '.quando', '.nota'].map((x) => pagina.includes(x)), [true, true, true, true])
ok('nessun componente usa PAGAMENTO.quotaAssociativa', (await import('node:child_process')).execSync('grep -rl "PAGAMENTO.quotaAssociativa" src/components || true').toString().trim(), '')

// --- 3 e 9. la pagina dei prezzi ---------------------------------------------
console.log('\nLa pagina dei prezzi (src/components/PrezziIscrizione.tsx)')
const prezzi = sorgente('src/components/PrezziIscrizione.tsx')
ok('il file c’è ed esporta PrezziIscrizione', /export function PrezziIscrizione\(/.test(prezzi), true)
ok('mostra <Costi e ComeSiPaga', [prezzi.includes('<Costi'), prezzi.includes('<ComeSiPaga')], [true, true])
ok('‹ TORNA ALLE ISCRIZIONI', prezzi.includes('TORNA ALLE ISCRIZIONI'), true)
ok('in fondo lo stesso fondo: fondoDellaPagina(MODULO_IN_APP), COMPILA LA RICHIESTA una volta', [/fondoDellaPagina\(MODULO_IN_APP\)/.test(prezzi), conta(prezzi, 'COMPILA LA RICHIESTA')], [true, 1])
ok('chiama apriAspettoModulo(', /apriAspettoModulo\(/.test(prezzi), true)
ok('COMPILA LA RICHIESTA sostituisce #prezzi con #richiesta (location.replace, senza una voce in più nella cronologia), senza un modulo suo', [/location\.replace\([^)]*INDIRIZZO_RICHIESTA/.test(prezzi), prezzi.includes('<ModuloIscrizione')], [true, false])
ok('la pagina parte col modulo aperto se arriva da #richiesta, e poi toglie il cancelletto', [/useState\(\(\)\s*=>\s*moduloDalCancelletto\(window\.location\.hash\)\)/.test(tsx), /if\s*\(moduloDalCancelletto\(window\.location\.hash\)\)\s*history\.replaceState\(null,/.test(tsx)], [true, true])

const costi = sorgente('src/components/Costi.tsx')
ok('la validità della quota una volta sola (pagina + Costi + prezzi)', conta(tsx, 'PAGAMENTO.validaFino') + conta(costi, 'PAGAMENTO.validaFino') + conta(prezzi, 'PAGAMENTO.validaFino'), 1)
ok('l’IBAN una volta sola (pagina + Costi + prezzi)', conta(tsx, 'PAGAMENTO.iban') + conta(costi, 'PAGAMENTO.iban') + conta(prezzi, 'PAGAMENTO.iban'), 1)

// --- 8. App.tsx -----------------------------------------------------------------
console.log('\nApp.tsx')
const app = sorgente('src/App.tsx')
ok('decide la vista con vistaIscrizioni(', /vistaIscrizioni\(/.test(app), true)
ok('monta <PrezziIscrizione', app.includes('<PrezziIscrizione'), true)
ok('<RiquadroVestiario non è più montato (il vestiario sta solo a #vestiario)', app.includes('<RiquadroVestiario'), false)

// --- 9. il CSS: una colonna sola, max 720px ------------------------------------
console.log('\nUna colonna sola (src/styles.css)')
const css = sorgente('src/styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const media = []
for (const m of css.matchAll(/@media\s*([^{]+)\{/g)) {
  let i = m.index + m[0].length, prof = 1
  while (prof && i < css.length) prof += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0, i++
  media.push({ cond: m[1].trim(), corpo: css.slice(m.index + m[0].length, i - 1) })
}
const aPartireDa = (cond) => {
  const min = /min-width:\s*(\d+)px/.exec(cond)
  return min && !/max-width/.test(cond) ? +min[1] : null
}
const stretto = (classe) => media.some((b) => aPartireDa(b.cond) === 640 && [...b.corpo.matchAll(new RegExp(`(^|[}\\s,])\\.scroll\\s*>\\s*\\.${classe}\\s*\\{([^}]*)\\}`, 'g'))].some((r) => /max-width:\s*720px/.test(r[2])))
ok('da 640px `.scroll > .iscrizioni` ha max-width: 720px (senza un max-width nella condizione)', stretto('iscrizioni'), true)
// La pagina dei prezzi sta nei 720px se la sua radice ha la classe `iscrizioni`, o una regola sua.
const radicePrezzi = /return \(\s*<div className="([^"]*)"/.exec(prezzi)?.[1] ?? ''
ok('anche la pagina dei prezzi sta nei 720px da 640px', /(^|\s)iscrizioni(\s|$)/.test(radicePrezzi) || stretto('iscrizioni-prezzi'), true)
ok('la griglia a due colonne (\'passi costi\') non c’è più', /grid-template-areas:\s*'passi costi'/.test(css), false)

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
