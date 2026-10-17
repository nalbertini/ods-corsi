// ---------------------------------------------------------------------------
// La pubblicazione del sito, senza GitHub.
//
//   node scripts/prova-sito-pubblica.mjs
//
// `scripts/pubblica-sito.sh <sito-generato> <repository-del-sito>` copia i file
// generati nel repository del sito e, se qualcosa è cambiato, fa un commit e lo
// spinge. Qui il «repository del sito» è uno finto in una cartella temporanea,
// con un remoto finto accanto (un repository nudo): non si tocca niente di vero.
//
// Cosa conta: mai pubblicare un sito vuoto o a metà (il sito vero resta com'è),
// mai un commit se non è cambiato niente, e quello che sparisce dalle pagine
// sparisce anche dal sito.
// ---------------------------------------------------------------------------
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const radice = process.cwd()
const SCRIPT = join(radice, 'scripts/pubblica-sito.sh')
const git = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' })
const lancia = (generato, repo) => spawnSync('bash', [SCRIPT, generato, repo], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME } })
const scrivi = (cartella, file, testo) => {
  mkdirSync(join(cartella, file, '..'), { recursive: true })
  writeFileSync(join(cartella, file), testo)
}

// Un remoto finto e il suo clone, con un primo commit (README e .nojekyll, come nel repository vero).
function nuovoMondo() {
  const base = mkdtempSync(join(tmpdir(), 'pubblica-'))
  const remoto = join(base, 'remoto.git')
  const repo = join(base, 'sito')
  git(base, 'init', '-q', '--bare', '-b', 'main', remoto)
  git(base, 'clone', '-q', remoto, repo)
  git(repo, 'config', 'user.name', 'Prova')
  git(repo, 'config', 'user.email', 'prova@example.it')
  git(repo, 'checkout', '-q', '-b', 'main')
  scrivi(repo, 'README.md', '# sito\n')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'primo')
  git(repo, 'push', '-q', 'origin', 'main')
  const generato = join(base, 'generato')
  scrivi(generato, 'index.html', '<html>home</html>')
  scrivi(generato, 'judo/index.html', '<html>judo</html>')
  scrivi(generato, 'risorse/logo.webp', 'logo')
  scrivi(generato, 'CNAME', 'www.officinedellosport.it\n')
  scrivi(generato, '.nojekyll', '')
  const conta = () => Number(git(remoto, 'rev-list', '--count', 'main').stdout.trim())
  const nelRemoto = (f) => git(remoto, 'show', `main:${f}`).stdout
  return { base, remoto, repo, generato, conta, nelRemoto }
}

console.log('\nIl primo giro')
{
  const m = nuovoMondo()
  const r = lancia(m.generato, m.repo)
  ok('finisce bene', r.status, 0)
  ok('il remoto ha un commit in più', m.conta(), 2)
  ok('la home è nel remoto', m.nelRemoto('index.html'), '<html>home</html>')
  ok('anche le pagine, le risorse, il CNAME e .nojekyll', ['judo/index.html', 'risorse/logo.webp', 'CNAME', '.nojekyll'].every((f) => git(m.remoto, 'cat-file', '-e', `main:${f}`).status === 0), true)
  ok('il README di prima non c\'è più: il repository è il sito, tutto il resto sparisce', git(m.remoto, 'cat-file', '-e', 'main:README.md').status !== 0, true)
  ok('il commit dice cosa è', /sito/i.test(git(m.remoto, 'log', '-1', '--format=%s', 'main').stdout), true)
  ok('l\'autore non è uno sconosciuto', git(m.remoto, 'log', '-1', '--format=%an', 'main').stdout.trim().length > 0, true)
  ok('la cartella .git del repository del sito resta', existsSync(join(m.repo, '.git')), true)

  console.log('\nLo stesso sito una seconda volta')
  const di_nuovo = lancia(m.generato, m.repo)
  ok('finisce bene', di_nuovo.status, 0)
  ok('niente commit nuovo', m.conta(), 2)
  ok('lo dice', /niente da pubblicare/i.test(di_nuovo.stdout), true)

  console.log('\nUna pagina cambia, una sparisce, una nasce')
  scrivi(m.generato, 'index.html', '<html>home nuova</html>')
  rmSync(join(m.generato, 'judo'), { recursive: true })
  scrivi(m.generato, 'aikido/index.html', '<html>aikido</html>')
  const dopo = lancia(m.generato, m.repo)
  ok('finisce bene', dopo.status, 0)
  ok('un commit solo in più', m.conta(), 3)
  ok('la home è cambiata', m.nelRemoto('index.html'), '<html>home nuova</html>')
  ok('la pagina tolta non c\'è più nel sito', git(m.remoto, 'cat-file', '-e', 'main:judo/index.html').status !== 0, true)
  ok('quella nuova c\'è', m.nelRemoto('aikido/index.html'), '<html>aikido</html>')
  ok('il CNAME c\'è ancora (senza, il dominio si perde)', m.nelRemoto('CNAME'), 'www.officinedellosport.it\n')
}

console.log('\nCosa non si pubblica mai')
{
  const m = nuovoMondo()
  const prima = m.conta()
  const vuoto = join(m.base, 'vuoto')
  mkdirSync(vuoto)
  const a = lancia(vuoto, m.repo)
  ok('una cartella vuota no', a.status !== 0 && /index\.html|home|vuot/i.test(a.stderr), true)
  const b = lancia(join(m.base, 'non-c-e'), m.repo)
  ok('una cartella che non c\'è no', b.status !== 0, true)
  const senzaHome = join(m.base, 'senza-home')
  scrivi(senzaHome, 'judo/index.html', '<html>judo</html>')
  const c = lancia(senzaHome, m.repo)
  ok('un sito senza la home no', c.status !== 0, true)
  ok('nessuno di questi tocca il remoto', m.conta(), prima)
  ok('né il repository del sito (il README di prima c\'è ancora)', existsSync(join(m.repo, 'README.md')), true)
  const d = lancia(m.generato, join(m.base, 'non-e-un-repository'))
  ok('una cartella che non è un repository no', d.status !== 0, true)
  const e = lancia(m.generato, m.generato)
  ok('la stessa cartella come origine e destinazione no', e.status !== 0, true)
  ok('e i file generati sono ancora lì', existsSync(join(m.generato, 'index.html')), true)
  const f = lancia(m.generato, '/')
  ok('la radice come destinazione no (non è un repository)', f.status !== 0, true)
}

console.log('\nSe il remoto rifiuta')
{
  const m = nuovoMondo()
  git(m.base, 'init', '-q', '--bare', join(m.base, 'altro.git'))
  git(m.repo, 'remote', 'set-url', 'origin', join(m.base, 'non-esiste.git'))
  const r = lancia(m.generato, m.repo)
  ok('lo dice con un errore (un giro rosso, non un sito che sembra aggiornato)', r.status !== 0, true)
}

console.log(guai ? `\n✗ ${guai} casi falliti` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
