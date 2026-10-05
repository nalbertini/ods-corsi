// ---------------------------------------------------------------------------
// Le prove, senza browser: la ricerca per nome e cognome nell'appello.
//
//   node scripts/prova-appello-cerca.mjs
//
// Chi fa l'appello scrive qualche lettera e l'elenco si restringe a chi
// somiglia: nome o cognome, in qualunque ordine, senza badare a maiuscole,
// accenti e apostrofi. Senza niente scritto l'elenco è intero.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export { cercaNellElenco } from './src/lib/sala'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const elenco = [
  { id: '1', nome: 'Marco', cognome: 'Rossi' },
  { id: '2', nome: 'Maria Grazia', cognome: "D'Amico" },
  { id: '3', nome: 'Nicolò', cognome: 'De Luca' },
  { id: '4', nome: 'Luca', cognome: 'Marchetti' },
]
const ids = (scritto) => m.cercaNellElenco(elenco, scritto).map((p) => p.id)

ok('niente scritto: tutti', ids(''), ['1', '2', '3', '4'])
ok('solo spazi: tutti', ids('   '), ['1', '2', '3', '4'])
ok('inizio del nome', ids('mar'), ['1', '2', '4'])
ok('inizio del cognome', ids('ros'), ['1'])
ok('maiuscole non contano', ids('ROSSI'), ['1'])
ok('nome e cognome', ids('marco rossi'), ['1'])
ok('cognome e nome, al contrario', ids('rossi marco'), ['1'])
ok('nome e cognome di due persone diverse non si mescolano', ids('marco amico'), [])
ok('gli accenti non contano', ids('nicolo'), ['3'])
ok('apostrofo: d’am', ids('d’am'), ['2'])
ok('apostrofo scritto dritto: d\'am', ids("d'am"), ['2'])
ok('senza apostrofo: damico', ids('damico'), ['2'])
ok('secondo nome', ids('grazia'), ['2'])
ok('cognome con spazio scritto attaccato', ids('deluca'), ['3'])
ok('nessuno: elenco vuoto', ids('zzz'), [])
ok('l\'ordine dell\'elenco resta quello dato', ids('luca'), ['3', '4'])
ok('i campi in più (stato, prova) restano', m.cercaNellElenco([{ id: '9', nome: 'Ada', cognome: 'Neri', stato: 'presente', prova: true }], 'ada'), [
  { id: '9', nome: 'Ada', cognome: 'Neri', stato: 'presente', prova: true },
])

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
