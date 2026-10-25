// ---------------------------------------------------------------------------
// L'accessibilità dell'area iscritti, senza browser.
//
//   node scripts/prova-a11y-iscritti.mjs
//
// Trovati guardando la pagina in prova: gli errori (certificato, segnalazione,
// pagamento) non erano annunciati, la pagina non aveva titoli, lo stato
// NON SEGNATO / PRESENTE era grigio sbiadito (2,4:1), VEDI TUTTE blu chiaro sul
// chiaro (3,5:1).
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

const css = readFileSync('src/styles.css', 'utf8')
const ds = readFileSync('src/components/ds.tsx', 'utf8')
const area = readFileSync('src/components/AreaIscritti.tsx', 'utf8')

const luce = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrasto = (a, b) => {
  const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** Il corpo della prima regola che ha esattamente questo selettore. */
const regola = (sel) => css.match(new RegExp(`^${sel.replace(/[[\]().']/g, '\\$&')} \\{([^}]*)\\}`, 'm'))?.[1] ?? ''
const colore = (sel) => regola(sel).match(/(?:^|[\s;])color:\s*([^;]+)/)?.[1].trim()

ok('un errore (Dettaglio «guaio») è annunciato: role="alert"', /<span className="passo-dettaglio" data-tono=\{tono\} role=\{tono === 'guaio' \? 'alert' : undefined\}/.test(ds), true)
ok('il titoletto di sezione è un titolo (livello 2)', /<span className="rule-label" role="heading" aria-level=\{2\}/.test(ds), true)
ok('«Ciao <nome>» è il titolo della pagina (livello 1)', (area.match(/role="heading" aria-level=\{1\} className="ob mio-nome"/g) ?? []).length, 2)
ok('il titolo dell\'esito di un pagamento è un titolo', /<span className="ob esito-titolo" role="heading" aria-level=\{2\}/.test(ds), true)

// Il testo di stato non usa --faint (il grigio dei bordi: 2,4:1 sul fondo), ma --dim.
ok('lo stato di una presenza (elenco) non è --faint', colore('.mia-presenza-detto'), 'var(--dim)')
ok('la presenza «spento» nel riepilogo non è --faint', colore(".mia-presenza-piccola[data-tono='spento']"), 'var(--dim)')
ok('il nome dello stato nel riepilogo prende il colore del tono', colore('.mia-presenza-piccola .mia-presenza-detto'), 'inherit')
ok('VEDI TUTTE non è --blu (3,5:1 sul chiaro)', colore('.mia-vedi-tutte'), 'var(--text)')

const token = (sel) => Object.fromEntries([...(css.match(new RegExp(`^${sel.replace(/[[\]().']/g, '\\$&')} \\{([^}]*)\\}`, 'm'))?.[1] ?? '').matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]))
const temi = { sito: token(":root[data-look='sito']") }
for (const [n, t] of Object.entries(temi)) ok(`--dim sul fondo delle schede ≥ 4,5 · ${n}`, contrasto(t['--dim'], t['--surface']) >= 4.5, true)

// Le linguette della scheda iscritto hanno un'icona, decorativa: il nome resta quello della linguetta.
const iscritti = readFileSync('src/components/segreteria/Iscritti.tsx', 'utf8')
const icone = readFileSync('src/components/Icons.tsx', 'utf8')
const schede = [...readFileSync('src/lib/schedaSezioni.ts', 'utf8').matchAll(/\{ id: '(\w+)', etichetta/g)].map((m) => m[1])
const blocco = icone.match(/export const ICONE_SCHEDA_ISCRITTO = \{([\s\S]*?)\n\}/)?.[1] ?? ''
ok('ogni scheda ha la sua icona in ICONE_SCHEDA_ISCRITTO', schede.filter((id) => !new RegExp(`^  ${id}: `, 'm').test(blocco)), [])
ok('la linguetta mostra l\'icona della sua scheda', /const Icona = ICONE_SCHEDA_ISCRITTO\[s\.id\]/.test(iscritti) && /<Icona size=\{16\} \/>/.test(iscritti), true)
ok('le icone di voce sono aria-hidden', /function IconaVoce[\s\S]*?aria-hidden="true"/.test(icone), true)

process.exit(fallite ? 1 : 0)
