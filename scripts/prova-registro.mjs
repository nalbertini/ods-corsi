// ---------------------------------------------------------------------------
// `docs/qa/percorsi-critici.md`: il registro resta una tabella che si legge.
// Era cresciuto fino a 280 KB di diario (rami, date, rotture a mano) e nessuno
// vedeva più cosa copre cosa: la storia sta nelle PR e in `git log`.
// Qui si controlla che le righe restino corte e che le prove citate esistano.
//
//   node scripts/prova-registro.mjs [file]
// ---------------------------------------------------------------------------
import { existsSync, readdirSync, readFileSync } from 'node:fs'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const file = process.argv[2] ?? 'docs/qa/percorsi-critici.md'
const testo = existsSync(file) ? readFileSync(file, 'utf8') : ''
ok('il registro c\'è', testo.length > 0, true)

const script = Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).scripts)
const sql = readdirSync('supabase/prova')
// `calendario*.sql` vale per tutti i file che cominciano così: ne basta uno.
const trova = (nome, elenco) => {
  const forma = new RegExp(`^${nome.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('*', '.*')}$`)
  return elenco.some((x) => forma.test(x))
}
const esiste = (nome) =>
  nome.startsWith('prova:') ? trova(nome, script)
  : nome.startsWith('scripts/') ? existsSync(nome)
  : nome.endsWith('.sql') ? trova(nome, sql)
  : true // un nome di file o di funzione nel testo, non una prova

const righe = testo.split('\n').filter((r) => r.startsWith('| ') && !/^\| (Percorso|---)/.test(r))
ok('la tabella ha righe', righe.length > 0, true)

const lunghe = []
const mancano = []
for (const riga of righe) {
  const celle = riga.split(' | ').map((c) => c.replace(/^\| |\s*\|$/g, ''))
  const [percorso, , , prove = ''] = celle
  // Le prove possono essere tante; le altre celle dicono cosa, non come.
  if (celle.filter((_, i) => i !== 3).some((c) => c.length > 80)) lunghe.push(percorso.slice(0, 40))
  for (const [, nome] of prove.matchAll(/`([^`]+)`/g)) if (!esiste(nome)) mancano.push(`${percorso.slice(0, 30)}: ${nome}`)
}
ok('nessuna cella oltre 80 caratteri (fuori da Prove)', lunghe, [])
ok('ogni prova citata esiste', mancano, [])

// Un buco è un punto dell'elenco, anche se va a capo.
const buchi = testo.split(/\n(?=- |\n|## )/).filter((b) => b.startsWith('- '))
ok('nessun punto oltre 250 caratteri', buchi.filter((b) => b.length > 250).map((b) => b.slice(0, 40)), [])

// Il diario si riconosceva dai rami citati: quelli stanno nelle PR.
ok('nessun ramo', testo.match(/\bclaude\/(?!agents)[\w-]+/g) ?? [], [])

console.log(guai ? `\n${guai} da correggere` : '\nTutto in ordine')
process.exitCode = guai ? 1 : 0
