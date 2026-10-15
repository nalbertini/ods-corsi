// ---------------------------------------------------------------------------
// LA PASSWORD DEL BACKUP e la cifratura, senza toccare i segreti veri.
//
//   node scripts/prova-backup.mjs
//
// Il repository è pubblico e le copie le scarica chiunque: la riservatezza
// dipende dalla password. Qui si lanciano i passi veri dei workflow (il testo
// di `run:` letto dai file .yml) con password finte: la password corta ferma
// rosso senza essere stampata, la lunga passa, e un file cifrato da
// backup.yml lo apre ripristino.yml.
// ---------------------------------------------------------------------------
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) guai++
  console.log(`${bene ? '✓' : '✗'} ${cosa}${bene ? '' : `\n    avuto  ${JSON.stringify(avuto)}\n    voluto ${JSON.stringify(voluto)}`}`)
}

// Il testo del `run: |` del passo `nome` nel workflow.
const passo = (file, nome) => {
  const righe = readFileSync(file, 'utf8').split('\n')
  const i = righe.findIndex((r) => r.trim() === `- name: ${nome}`)
  if (i < 0) throw new Error(`manca il passo «${nome}» in ${file}`)
  const r = righe.findIndex((x, k) => k > i && x.trim() === 'run: |')
  const rientro = righe[r + 1].match(/^ */)[0].length
  const corpo = []
  for (let k = r + 1; k < righe.length && (righe[k].trim() === '' || righe[k].startsWith(' '.repeat(rientro))); k++) corpo.push(righe[k].slice(rientro))
  return corpo.join('\n')
}
const lancia = (script, env, cwd) =>
  spawnSync('bash', ['-eo', 'pipefail', '-c', script], { env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env }, cwd, encoding: 'utf8' })

const finta = 'password-finta-solo-per-la-prova-1234567890'
const dir = mkdtempSync(join(tmpdir(), 'prova-backup-'))

for (const wf of ['backup.yml', 'ripristino.yml']) {
  const controllo = passo(`.github/workflows/${wf}`, 'Controlla i segreti')
  const esce = (password) => {
    const out = join(dir, `out-${wf}`)
    writeFileSync(out, '')
    const r = lancia(controllo, { SUPABASE_DB_URL: 'x', BACKUP_PASSWORD: password, GITHUB_OUTPUT: out })
    return { stato: r.status, scritto: r.stdout + r.stderr }
  }
  const corta = esce('a'.repeat(23))
  ok(`${wf}: 23 caratteri fermano rosso`, corta.stato, 1)
  ok(`${wf}: il messaggio dice cosa fare`, /openssl rand -base64 32/.test(corta.scritto), true)
  ok(`${wf}: la password non finisce nel log`, corta.scritto.includes('a'.repeat(23)), false)
  ok(`${wf}: 24 caratteri passano`, esce('a'.repeat(24)).stato, 0)
  ok(`${wf}: la password finta passa`, esce(finta).stato, 0)
  ok(`${wf}: vuota ferma rosso`, esce('').stato, 1)
}

// Cifra come backup.yml, decifra come ripristino.yml e come scripts/ripristina.sh
// (il comando gpg del README).
const lavoro = join(dir, 'lavoro')
mkdirSync(join(lavoro, 'backup-2026-01-01'), { recursive: true })
writeFileSync(join(lavoro, 'backup-2026-01-01', 'dati.sql'), 'dato finto\n')
const cifra = lancia(passo('.github/workflows/backup.yml', 'Cifra'), { BACKUP_PASSWORD: finta, GIORNO: '2026-01-01' }, lavoro)
ok('Cifra: riesce', cifra.status, 0)
const file = join(lavoro, 'backup-2026-01-01.tar.gz.gpg')
ok('Cifra: il file c\'è', existsSync(file), true)
const info = spawnSync('gpg', ['--batch', '--list-packets', file], { encoding: 'utf8' })
ok('Cifra: AES256 con S2K salato e iterato, SHA512', /cipher 9, aead 0, s2k 3, hash 10/.test(info.stdout + info.stderr), true)
ok('Cifra: 65011712 giri', /count 65011712/.test(info.stdout + info.stderr), true)

const scarico = join(dir, 'ripristino')
mkdirSync(join(scarico, 'scarico', 'backup-2026-01-01'), { recursive: true })
writeFileSync(join(scarico, 'scarico', 'backup-2026-01-01', 'backup-2026-01-01.tar.gz.gpg'), readFileSync(file))
const decifra = lancia(passo('.github/workflows/ripristino.yml', 'Decifra'), { BACKUP_PASSWORD: finta }, scarico)
ok('Decifra: riesce con la stessa password', decifra.status, 0)
ok('Decifra: il contenuto torna', existsSync(join(scarico, 'copia', 'backup-2026-01-01', 'dati.sql')) && readFileSync(join(scarico, 'copia', 'backup-2026-01-01', 'dati.sql'), 'utf8'), 'dato finto\n')
const sbagliata = lancia(passo('.github/workflows/ripristino.yml', 'Decifra'), { BACKUP_PASSWORD: finta + 'x' }, scarico)
ok('Decifra: con un\'altra password non apre', sbagliata.status !== 0, true)

process.exit(guai ? 1 : 0)
