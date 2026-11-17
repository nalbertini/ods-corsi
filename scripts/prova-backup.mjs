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
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs'
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

// UN BACKUP SENZA CERTIFICATI NON È VERDE. La copia del database si cifra e si
// carica lo stesso (non si perde), ma la run finisce rossa e dice cosa manca.
{
  const wf = '.github/workflows/backup.yml'
  const testo = readFileSync(wf, 'utf8')
  const dove = (cosa) => testo.indexOf(cosa)
  ok('backup.yml: se la copia dei certificati cade, cifra e carica lo stesso', /- name: Copia i certificati\n\s+id: certificati\n\s+continue-on-error: true/.test(testo), true)
  ok('backup.yml: il controllo dei certificati viene dopo il caricamento', dove('- name: Controlla i certificati') > dove('actions/upload-artifact'), true)
  const controllo = passo(wf, 'Controlla i certificati')
  const chiave = 'chiave-finta-di-servizio-da-non-stampare'
  const esce = (CERTIFICATI, ESITO) => {
    const r = lancia(controllo, { CERTIFICATI, ESITO, SUPABASE_URL: 'https://finto.supabase.co', SUPABASE_SERVICE_ROLE_KEY: chiave })
    return { stato: r.status, scritto: r.stdout + r.stderr }
  }
  const senza = esce('no', 'skipped')
  ok('backup.yml: senza i segreti dei certificati finisce rosso', senza.stato, 1)
  ok('backup.yml: il messaggio dice quali segreti aggiungere e dove', /SUPABASE_URL/.test(senza.scritto) && /SUPABASE_SERVICE_ROLE_KEY/.test(senza.scritto) && /Settings → Secrets/.test(senza.scritto), true)
  ok('backup.yml: il messaggio dice che la copia del database c\'è', /copia del database è stata caricata/.test(senza.scritto), true)
  const caduta = esce('si', 'failure')
  ok('backup.yml: se la copia dei certificati cade finisce rosso', caduta.stato, 1)
  ok('backup.yml: la chiave non finisce nel log', (senza.scritto + caduta.scritto).includes(chiave), false)
  ok('backup.yml: con i certificati copiati resta verde', esce('si', 'success').stato, 0)
  // Il cablaggio: il controllo legge l'esito vero della copia e niente lo fa passare lo stesso.
  const blocco = testo.slice(dove('- name: Controlla i certificati'))
  ok('backup.yml: il controllo legge l\'esito della copia', blocco.includes('ESITO: ${{ steps.certificati.outcome }}'), true)
  ok('backup.yml: il controllo legge se i segreti ci sono', blocco.includes('CERTIFICATI: ${{ steps.segreti.outputs.certificati }}'), true)
  ok('backup.yml: il controllo non ha continue-on-error', blocco.includes('continue-on-error'), false)
}

// Un `gh` finto: scrive in un file come è stato chiamato e risponde quel che gli si dice.
const finti = join(dir, 'finti')
mkdirSync(finti)
writeFileSync(join(finti, 'gh'), '#!/usr/bin/env bash\nprintf \'%s\\n\' "$*" >> "$GH_CHIAMATE"\ncase "$1 $2" in\n  "issue list") echo "$GH_ISSUE" ;;\n  "run list") echo 5 ;;\n  "run download") mkdir -p scarico/backup-x && touch scarico/backup-x/copia ;;\nesac\n')
chmodSync(join(finti, 'gh'), 0o755)
const conGh = (script, env, nome) => {
  const chiamate = join(dir, `gh-${nome}`)
  const cwd = join(dir, `cwd-${nome}`)
  mkdirSync(cwd)
  writeFileSync(chiamate, '')
  const r = lancia(script, { ...env, PATH: `${finti}:${process.env.PATH}`, GH_CHIAMATE: chiamate }, cwd)
  return { stato: r.status, chiamate: readFileSync(chiamate, 'utf8') }
}

// La prova di ripristino apre l'ultima copia fatta, anche quando il backup è
// finito rosso perché mancavano i certificati: se no proverebbe per sempre una
// copia vecchia, restando verde.
{
  const r = conGh(passo('.github/workflows/ripristino.yml', "Scarica l'ultima copia"), {}, 'scarica')
  ok('ripristino.yml: scarica la copia', r.stato, 0)
  ok('ripristino.yml: prende l\'ultimo backup finito, non l\'ultimo verde', /^run list .*--status completed/m.test(r.chiamate), true)
}

// UN BACKUP O UN RIPRISTINO CADUTO AVVISA: una issue col link alla run, una
// sola per lavoro (se è già aperta ci va un commento).
{
  const avviso = passo('.github/workflows/avviso-backup.yml', 'Apri o aggiorna la issue')
  const env = { LAVORO: 'Backup del database', RUN_URL: 'https://github.com/x/y/actions/runs/1' }
  const prima = conGh(avviso, { ...env, GH_ISSUE: '[{"number":3,"title":"Un\'altra cosa"}]' }, 'prima')
  ok('avviso: riesce', prima.stato, 0)
  ok('avviso: senza una issue aperta ne apre una col nome del lavoro', /^issue create --title Non riuscito: Backup del database /m.test(prima.chiamate), true)
  ok('avviso: nella issue c\'è il link alla run', prima.chiamate.includes(env.RUN_URL), true)
  const poi = conGh(avviso, { ...env, GH_ISSUE: '[{"number":3,"title":"Un\'altra cosa"},{"number":7,"title":"Non riuscito: Backup del database"}]' }, 'poi')
  ok('avviso: con la issue già aperta la commenta', /^issue comment 7 /m.test(poi.chiamate), true)
  ok('avviso: e non ne apre un\'altra', /^issue create/m.test(poi.chiamate), false)
  const wf = readFileSync('.github/workflows/avviso-backup.yml', 'utf8')
  // Quando parte: a run finita, solo se rossa e solo sul ramo principale.
  const quando = wf.slice(wf.indexOf('    if: >-'), wf.indexOf('    runs-on:'))
  ok('avviso: parte a run finita', wf.includes('types: [completed]'), true)
  ok('avviso: parte solo per una run rossa', quando.includes(`contains(fromJSON('["failure", "timed_out", "startup_failure"]'), github.event.workflow_run.conclusion)`), true)
  ok('avviso: parte solo per il ramo principale', quando.includes('&& github.event.workflow_run.head_branch == github.event.repository.default_branch'), true)
  ok('avviso: guarda il backup e la prova di ripristino', ['Backup del database', 'Prova di ripristino del backup'].every((n) => wf.includes(`'${n}'`)) && [readFileSync('.github/workflows/backup.yml', 'utf8'), readFileSync('.github/workflows/ripristino.yml', 'utf8')].map((t) => t.split('\n')[0]), ['name: Backup del database', 'name: Prova di ripristino del backup'])
}

process.exit(guai ? 1 : 0)
