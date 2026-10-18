// ---------------------------------------------------------------------------
// Prepara l'import della Prima Nota del vecchio programma: legge il PDF (o il testo di pdftotext),
// controlla che i totali tornino al piede del file e scrive i pacchetti SQL da caricare.
//
//   node scripts/importa-prima-nota.mjs <file.pdf|file.txt> <cartella-fuori-dal-repo> [--incassi-fino-al AAAA-MM-GG]
//
// Non carica niente sul database: scrive `anteprima.txt` e `pacchetto-001.sql`, `pacchetto-002.sql`…
// (ognuno una chiamata a `importa_prima_nota`, al massimo mille righe) nella cartella indicata.
// Il file vero ha nomi di iscritti: la cartella NON può stare dentro il repository, che è pubblico.
// Le regole di lettura sono in `src/lib/importaPrimaNota.ts`, provate da prova-importa-prima-nota.mjs.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const [, , file, uscita, ...resto] = process.argv
const dopoUnaData = (nome) => {
  const i = resto.indexOf(nome)
  return i >= 0 ? resto[i + 1] : null
}
const incassiFinoAl = dopoUnaData('--incassi-fino-al')
if (!file || !uscita || (resto.includes('--incassi-fino-al') && !/^\d{4}-\d{2}-\d{2}$/.test(incassiFinoAl ?? ''))) {
  console.error('Uso: node scripts/importa-prima-nota.mjs <file.pdf|file.txt> <cartella-fuori-dal-repo> [--incassi-fino-al AAAA-MM-GG]')
  process.exit(1)
}

// Il repository è pubblico: niente del file vero ci deve finire. Si guardano il worktree e il checkout principale
// (stesso repository), con i percorsi veri (i collegamenti simbolici non ingannano).
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const veroPercorso = (percorso) => {
  const completo = resolve(percorso)
  // La cartella può non esserci ancora: si risolve il primo pezzo che esiste e si riattacca il resto.
  let su = completo
  const resta = []
  while (!existsSync(su) && dirname(su) !== su) {
    resta.unshift(basename(su))
    su = dirname(su)
  }
  return join(realpathSync(su), ...resta)
}
const radici = [git('rev-parse', '--show-toplevel'), dirname(git('rev-parse', '--path-format=absolute', '--git-common-dir'))].map(veroPercorso)

if (!existsSync(file)) {
  console.error(`Il file «${file}» non c'è.`)
  process.exit(1)
}
let testo
if (file.toLowerCase().endsWith('.pdf')) {
  const r = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (r.status !== 0) {
    console.error('Non riesco a leggere il PDF con pdftotext (si installa con: brew install poppler):', r.error?.message ?? r.stderr)
    process.exit(1)
  }
  testo = r.stdout
} else testo = readFileSync(file, 'utf8')

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/importaPrimaNota'; export { euro } from './src/lib/ricevute'", resolveDir: radici[0], loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

if (m.staDentro(veroPercorso(uscita), radici)) {
  console.error(`La cartella «${uscita}» sta dentro il repository: scegline una fuori (per esempio in /tmp), i dati dei clienti non vanno su GitHub.`)
  process.exit(1)
}

const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
const lettura = m.scartaImpossibili(m.leggiPrimaNota(testo), oggi)
const piede = m.totaliDelPiede(testo)
const controllo = m.quadra(lettura, piede)
const righe = m.senzaIncassiDopo(lettura.righe, incassiFinoAl)
const dati = m.datiImport(righe)
const incerte = m.cassaIncerta(righe)

const conta = (chiave) => {
  const c = {}
  for (const x of dati) c[chiave(x)] = (c[chiave(x)] ?? 0) + 1
  return Object.entries(c).sort()
}
const somma = (tipo) => dati.filter((x) => x.tipo === tipo).reduce((s, x) => s + x.importo, 0)
const righeDi = (titolo, coppie) => [titolo, ...coppie.map(([k, v]) => `  ${k}: ${v}`)]

const anteprima = [
  'ANTEPRIMA DELL\'IMPORT DELLA PRIMA NOTA',
  '',
  `Righe lette dal file: ${lettura.righe.length}, scartate: ${lettura.scartate.length} (${[...new Set(lettura.scartate.map((s) => s.motivo))].join(', ') || 'nessuna'})`,
  piede ? `Piede del file: ${piede.conteggio} movimenti, entrate ${m.euro(piede.entrate)} €, uscite ${m.euro(piede.uscite)} €` : 'Il file non ha il piede coi totali',
  controllo.quadra ? 'I TOTALI TORNANO: movimenti, entrate e uscite sono quelli del piede.' : `ATTENZIONE, NON TORNANO: ${controllo.differenze.join('; ')}`,
  '',
  incassiFinoAl ? `Gli incassi dei clienti si importano solo fino al ${incassiFinoAl}: da lì li ricava l'app da ricevute e pagamenti.` : 'Si importano tutti i movimenti, compresi gli incassi dei clienti di ogni data.',
  `Da importare: ${dati.length} movimenti, entrate ${m.euro(somma('entrata'))} €, uscite ${m.euro(somma('uscita'))} €`,
  '',
  ...righeDi('Per cassa e tipo:', conta((x) => `${x.cassa} ${x.tipo}`)),
  '',
  ...righeDi('Per voce:', conta((x) => `${x.voce} (${x.tipo})`)),
  '',
  ...righeDi('Per anno:', conta((x) => x.data.slice(0, 4))),
  '',
  incerte.length ? `Righe senza la cassa nel file: vanno sul Conto Corrente, controlla (${incerte.length}):` : 'Tutte le righe hanno la cassa.',
  ...incerte.map((r) => `  ${r.data} ${r.tipo} ${m.euro(r.importo)} € ${r.causale}`),
  '',
  lettura.scartate.length ? 'Righe scartate (il numero è la posizione fra le righe con la data del file):' : '',
  ...lettura.scartate.map((s) => `  riga ${s.posizione}: ${s.motivo}${s.motivo === 'Importo zero' ? '' : ` · ${s.testo}`}`),
].join('\n')

mkdirSync(uscita, { recursive: true })
writeFileSync(`${uscita}/anteprima.txt`, `${anteprima}\n`)
console.log(anteprima)
// Se i totali non tornano i pacchetti non si scrivono: carichi solo quel che quadra con il file.
if (!controllo.quadra) {
  console.error('\nI totali non tornano: i pacchetti SQL NON sono stati scritti. Guarda l\'anteprima e le righe scartate.')
  process.exit(2)
}
const pacchetti = m.apacchetti(dati, 1000)
pacchetti.forEach((p, i) => {
  const sql = `-- Pacchetto ${i + 1} di ${pacchetti.length}: ${p.length} movimenti. Rilanciarlo non duplica niente (stesso file).\n${m.istruzioneImport(p)}\n`
  writeFileSync(`${uscita}/pacchetto-${String(i + 1).padStart(3, '0')}.sql`, sql)
})
console.log(`\nScritti in ${resolve(uscita)}: anteprima.txt e ${pacchetti.length} pacchetti SQL. Non è stato caricato niente.`)
