// ---------------------------------------------------------------------------
// La coda delle scritture offline, provata senza browser.
//
//   node scripts/prova-coda.mjs
//
// È il pezzo dell'app che non si può guardare da una schermata: fa il suo
// lavoro proprio quando la rete non c'è. Qui `coda.ts` viene compilato al volo
// e girato contro un finto `localStorage`, così i sei casi che contano si
// possono rilanciare in un secondo.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/lib/coda.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
})
const modulo = 'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')

// Finge il minimo browser che `coda.ts` tocca: localStorage e window.
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
const ascoltatori = {}
globalThis.window = {
  addEventListener: (e, f) => { (ascoltatori[e] ??= []).push(f) },
}
const rete = (e) => (ascoltatori[e] ?? []).forEach((f) => f())

const { Coda } = await import(modulo)
const attesa = () => new Promise((r) => setTimeout(r, 10))
let guai = 0
const dimmi = (s) => { console.log('  ✗', s); guai++ }

// --- 1. con la rete, parte subito -----------------------------------------
{
  memoria.clear()
  const fatte = []
  const c = new Coda(async (op) => { fatte.push(op.tipo + ':' + op.args.join(',')) })
  c.accoda('k1', 'segna', ['s1', 'p1', 'presente'])
  await attesa()
  console.log(`1 con la rete: eseguite ${JSON.stringify(fatte)} · in attesa ${c.inAttesa}`)
  if (fatte.length !== 1 || c.inAttesa !== 0) dimmi('non è partita subito')
}

// --- 2. senza rete resta in coda ------------------------------------------
{
  memoria.clear()
  let giù = true
  const fatte = []
  const c = new Coda(async (op) => { if (giù) throw new Error('niente rete'); fatte.push(op.chiave) })
  c.accoda('k1', 'segna', ['s1', 'p1', 'presente'])
  c.accoda('k2', 'segna', ['s1', 'p2', 'assente'])
  await attesa()
  console.log(`2 senza rete: in attesa ${c.inAttesa}, eseguite ${fatte.length}`)
  if (c.inAttesa !== 2 || fatte.length) dimmi(`avrebbero dovuto restare 2 in coda, ce ne sono ${c.inAttesa}`)

  // --- 3. torna la rete, si svuota in ordine ------------------------------
  giù = false
  rete('online')
  await attesa()
  console.log(`3 torna la rete: eseguite ${JSON.stringify(fatte)} · in attesa ${c.inAttesa}`)
  if (c.inAttesa !== 0) dimmi(`la coda non si è svuotata: ${c.inAttesa} rimaste`)
  if (fatte.join() !== 'k1,k2') dimmi(`ordine sbagliato: ${fatte.join(', ')}`)
}

// --- 4. la stessa persona segnata tre volte lascia una scrittura sola ------
{
  memoria.clear()
  let giù = true
  const fatte = []
  const c = new Coda(async (op) => { if (giù) throw new Error('niente rete'); fatte.push(op.args[2]) })
  c.accoda('segna:s1:p1', 'segna', ['s1', 'p1', 'presente'])
  c.accoda('segna:s1:p1', 'segna', ['s1', 'p1', 'assente'])
  c.accoda('segna:s1:p1', 'segna', ['s1', 'p1', 'presente'])
  await attesa()
  console.log(`4 tre tocchi sullo stesso nome, offline: in coda ${c.inAttesa}`)
  if (c.inAttesa !== 1) dimmi(`in coda ${c.inAttesa} scritture invece di 1`)
  giù = false
  rete('online')
  await attesa()
  console.log(`  arriva al server: ${JSON.stringify(fatte)}`)
  if (fatte.join() !== 'presente') dimmi(`al server è arrivato ${fatte.join(', ')} invece dell'ultimo stato`)
}

// --- 5. l'app chiusa e riaperta ritrova la coda ---------------------------
{
  memoria.clear()
  const c1 = new Coda(async () => { throw new Error('niente rete') })
  c1.accoda('k1', 'segna', ['s1', 'p1', 'presente'])
  c1.accoda('k2', 'segna', ['s1', 'p2', 'presente'])
  await attesa()
  const salvato = memoria.get('ods-corsi:coda')
  const fatte = []
  const c2 = new Coda(async (op) => { fatte.push(op.chiave) })   // come dopo un riavvio
  console.log(`5 riaperta: ${c2.inAttesa} scritture ritrovate su disco (${salvato ? JSON.parse(salvato).length : 0} salvate)`)
  if (c2.inAttesa !== 2) dimmi(`dopo il riavvio la coda ha ${c2.inAttesa} scritture invece di 2`)
  await c2.scarica()
  console.log(`  svuotata: ${JSON.stringify(fatte)} · resta ${c2.inAttesa}`)
  if (c2.inAttesa !== 0) dimmi('non si è svuotata al riavvio')
}

// --- 6. si ferma alla prima che non passa, non salta avanti ---------------
{
  memoria.clear()
  const fatte = []
  let quante = 0
  const c = new Coda(async (op) => {
    quante++
    if (op.chiave === 'k1') throw new Error('questa non passa')
    fatte.push(op.chiave)
  })
  c.accoda('k1', 'segna', ['s1', 'p1', 'presente'])
  c.accoda('k2', 'segna', ['s1', 'p2', 'presente'])
  await attesa()
  console.log(`6 la prima non passa: tentativi ${quante}, eseguite ${JSON.stringify(fatte)}, in coda ${c.inAttesa}`)
  if (fatte.length) dimmi(`ha saltato avanti ed eseguito ${fatte.join(', ')} scavalcando la prima`)
  if (c.inAttesa !== 2) dimmi(`in coda ${c.inAttesa} invece di 2`)
}

console.log(guai ? `\n${guai} PROBLEMI` : '\nTUTTO A POSTO')
