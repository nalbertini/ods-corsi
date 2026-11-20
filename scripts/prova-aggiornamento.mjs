// ---------------------------------------------------------------------------
// Un pezzo dell'app che non c'è più, provato senza browser.
//
//   node scripts/prova-aggiornamento.mjs
//
// Dopo una pubblicazione i file con l'impronta nel nome (`supabase-xxx.js`)
// cambiano: una pagina rimasta aperta chiede quelli vecchi e non li trova.
// Si ricarica una volta; se il guaio resta, non si ricarica all'infinito.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/aggiornamento'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
})
const codice = outputFiles[0].text
const m = await import('data:text/javascript;base64,' + Buffer.from(codice).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const ORA = 1_000_000
ok('mai ricaricata: si ricarica', m.ricaricarePerPezzoMancante(null, ORA), true)
ok('ricaricata 5 secondi fa: non si ripete', m.ricaricarePerPezzoMancante(String(ORA - 5_000), ORA), false)
ok('ricaricata un minuto fa: si può ancora', m.ricaricarePerPezzoMancante(String(ORA - 60_000), ORA), true)
ok('valore illeggibile: si ricarica', m.ricaricarePerPezzoMancante('boh', ORA), true)

// ---------------------------------------------------------------------------
// La trattenuta: chi compila un modulo (o il timer del tablet) tiene ferma la
// ricarica; la pagina si ricarica solo quando l'ultimo lascia.
// Lo stato del modulo è uno solo: ogni caso importa il bundle con un suffisso
// diverso nel data URL, così parte da un'istanza nuova, coi suoi finti.
// ---------------------------------------------------------------------------
let istanza = 0
async function nuova() {
  const f = { ascoltatori: {}, ricariche: 0, scritture: 0, sw: {} }
  const registra = (dove) => (nome, fn) => { dove[nome] = fn }
  Object.defineProperty(globalThis, 'window', {
    value: {
      addEventListener: registra(f.ascoltatori),
      location: { reload: () => { f.ricariche++ } },
      setInterval: () => 0,
    },
    configurable: true, writable: true,
  })
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      serviceWorker: {
        controller: {},
        addEventListener: registra(f.sw),
        register: () => Promise.resolve({ update: () => Promise.resolve() }),
      },
    },
    configurable: true, writable: true,
  })
  Object.defineProperty(globalThis, 'document', {
    value: { visibilityState: 'visible', addEventListener: () => {} },
    configurable: true, writable: true,
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: { getItem: () => null, setItem: () => { f.scritture++ } },
    configurable: true, writable: true,
  })
  const mod = await import(
    'data:text/javascript;base64,' + Buffer.from(`${codice}\n// ${++istanza}`).toString('base64'),
  )
  return { mod, f }
}
// Il rilascio può mancare (interfaccia vecchia): si segnala senza far crollare la prova.
const lascia = (r) => { if (typeof r === 'function') r() }
const trattenuto = (mod) => typeof mod.aggiornamentoTrattenuto === 'function' ? mod.aggiornamentoTrattenuto() : 'funzione assente'
const arrivaAggiornamento = (f) => f.sw.controllerchange()
const pezzoMancante = (f) => {
  const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
  f.ascoltatori['vite:preloadError'](e)
  return e
}

{
  const { mod, f } = await nuova()
  mod.registraAggiornamenti()
  const l = mod.trattieniAggiornamento()
  ok('trattenere restituisce la funzione che lascia', typeof l, 'function')
  ok('con una trattenuta l\'aggiornamento risulta trattenuto', trattenuto(mod), true)
  arrivaAggiornamento(f)
  ok('con un modulo aperto la versione nuova non ricarica la pagina', f.ricariche, 0)
  lascia(l)
  ok('chiuso il modulo, la versione arrivata entra', f.ricariche, 1)
  ok('lasciata l\'ultima trattenuta non risulta più trattenuto', trattenuto(mod), false)
}
{
  const { mod, f } = await nuova()
  mod.registraAggiornamenti()
  const a = mod.trattieniAggiornamento()
  const b = mod.trattieniAggiornamento()
  arrivaAggiornamento(f)
  lascia(a)
  ok('con due trattenitori, lasciato il primo non si ricarica', f.ricariche, 0)
  lascia(b)
  ok('lasciato anche il secondo si ricarica una volta sola', f.ricariche, 1)
}
{
  const { mod, f } = await nuova()
  mod.registraAggiornamenti()
  const a = mod.trattieniAggiornamento()
  const b = mod.trattieniAggiornamento()
  arrivaAggiornamento(f)
  lascia(a)
  lascia(a)
  ok('lasciare due volte lo stesso rilascio conta una volta: il secondo tiene ancora', f.ricariche, 0)
  ok('il secondo trattenitore tiene ancora', trattenuto(mod), true)
  lascia(b)
  ok('lasciato il secondo si ricarica', f.ricariche, 1)
}
{
  const { mod, f } = await nuova()
  mod.registraAggiornamenti()
  arrivaAggiornamento(f)
  ok('senza trattenitori la versione nuova ricarica subito, una volta', f.ricariche, 1)
  arrivaAggiornamento(f)
  ok('e non si ricarica una seconda volta', f.ricariche, 1)
}
{
  const { mod, f } = await nuova()
  mod.registraAggiornamenti()
  const l = mod.trattieniAggiornamento()
  lascia(l)
  ok('lasciare senza che sia arrivata una versione nuova non ricarica', f.ricariche, 0)
}
{
  const { mod, f } = await nuova()
  mod.ricaricaSePezzoMancante()
  const l = mod.trattieniAggiornamento()
  const e = pezzoMancante(f)
  ok('con un modulo aperto un pezzo mancante non si inghiotte (niente preventDefault)', e.defaultPrevented, false)
  ok('con un modulo aperto un pezzo mancante non scrive in sessionStorage', f.scritture, 0)
  ok('con un modulo aperto un pezzo mancante non ricarica', f.ricariche, 0)
  lascia(l)
}
{
  const { mod, f } = await nuova()
  mod.ricaricaSePezzoMancante()
  const e = pezzoMancante(f)
  ok('senza trattenitori un pezzo mancante è gestito (preventDefault)', e.defaultPrevented, true)
  ok('senza trattenitori un pezzo mancante ricarica una volta', f.ricariche, 1)
}
// Controlli sul sorgente, non di comportamento: dicono che i componenti sono
// collegati alla trattenuta come le prove sopra si aspettano.
{
  const modulo = readFileSync('src/components/ModuloIscrizione.tsx', 'utf8')
  const tablet = readFileSync('src/components/tablet/Tablet.tsx', 'utf8')
  ok(
    'il modulo d\'iscrizione trattiene l\'aggiornamento finché è aperto',
    /useEffect\(\s*\(\)\s*=>\s*trattieniAggiornamento\(\)\s*,\s*\[\s*\]\s*\)/.test(modulo) ||
      /return\s+trattieniAggiornamento\(\)/.test(modulo),
    true,
  )
  ok('il tablet non passa più un argomento a trattieniAggiornamento', /trattieniAggiornamento\(\s*[^)\s]/.test(tablet), false)
  // Il tablet trattiene solo a timer in corso e lascia quando si ferma: senza
  // il controllo non si aggiornerebbe mai, senza il return la trattenuta resta.
  ok(
    'il tablet trattiene solo ad allenamento in corso e lascia quando finisce',
    /useEffect\(\s*\(\)\s*=>\s*\{\s*if\s*\(\s*allenamentoInCorso\s*\)\s*return\s+trattieniAggiornamento\(\)\s*\}\s*,\s*\[\s*allenamentoInCorso\s*\]\s*\)/.test(tablet),
    true,
  )
}

if (guai) process.exit(1)
