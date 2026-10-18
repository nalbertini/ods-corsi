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

// `uscita.ts` importa `coda.ts`: va compilata a parte, con la stessa copia
// (un solo bundle) perché il registro delle code sia quello di `Coda`.
const { outputFiles: fuori } = await build({
  stdin: { contents: "export * from './src/lib/coda'; export * from './src/lib/uscita'", resolveDir: '.' },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
})
const { uscita, guardaUscita, avvisoUscita, Coda: CodaDiUscita } = await import(
  'data:text/javascript;base64,' + Buffer.from(fuori[0].text).toString('base64')
)
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

// --- 4b. TUTTI PRESENTI a mano: tante persone di fila, senza rete ----------
// Ogni persona ha la sua chiave `segna:sessione:persona`: nessuna scrittura si
// perde o ne copre un'altra, e al ritorno della rete partono nell'ordine in cui sono entrate.
{
  memoria.clear()
  let giù = true
  const fatte = []
  const c = new Coda(async (op) => { if (giù) throw new Error('niente rete'); fatte.push(op.args[1]) })
  const persone = Array.from({ length: 10 }, (_, i) => `p${i + 1}`)
  for (const p of persone) c.accoda(`segna:s1:${p}`, 'segna', ['s1', p, 'presente'])
  await attesa()
  console.log(`4b ${persone.length} persone di fila, offline: in coda ${c.inAttesa}`)
  if (c.inAttesa !== persone.length) dimmi(`in coda ${c.inAttesa} scritture invece di ${persone.length}`)
  giù = false
  rete('online')
  await attesa()
  console.log(`  arrivano al server: ${fatte.join(',')}`)
  if (fatte.join() !== persone.join()) dimmi(`ordine o numero sbagliato: ${fatte.join(', ')}`)
  if (c.inAttesa) dimmi('la coda non si è svuotata')
}

// --- 4c. segna e poi rimetti: l'ultimo tocco vince, e arriva null ----------
{
  memoria.clear()
  let giù = true
  const fatte = []
  const c = new Coda(async (op) => { if (giù) throw new Error('niente rete'); fatte.push(op.args[2]) })
  c.accoda('segna:s1:p1', 'segna', ['s1', 'p1', 'presente'])
  c.accoda('segna:s1:p1', 'segna', ['s1', 'p1', null])
  await attesa()
  giù = false
  rete('online')
  await attesa()
  console.log(`4c segna e rimetti offline: arriva ${JSON.stringify(fatte)}`)
  if (fatte.length !== 1 || fatte[0] !== null) dimmi(`al server è arrivato ${JSON.stringify(fatte)} invece di [null]`)
}

// --- 4d. i non segnati uno a uno, poi un tocco su uno già in coda -----------
{
  memoria.clear()
  let giù = true
  const fatte = []
  const c = new Coda(async (op) => { if (giù) throw new Error('niente rete'); fatte.push(`${op.args[1]}=${op.args[2]}`) })
  for (const p of ['p1', 'p2', 'p3', 'p4']) c.accoda(`segna:s1:${p}`, 'segna', ['s1', p, 'presente'])
  c.accoda('segna:s1:p2', 'segna', ['s1', 'p2', 'assente'])   // ci ripensa su p2
  await attesa()
  if (c.inAttesa !== 4) dimmi(`in coda ${c.inAttesa} scritture invece di 4`)
  giù = false
  rete('online')
  await attesa()
  console.log(`4d tocco su uno già in coda: ${fatte.join(' ')}`)
  // Le altre restano presenti; p2 è assente. L'ordine di p2 non conta, il suo stato sì.
  if (fatte.slice().sort().join() !== 'p1=presente,p2=assente,p3=presente,p4=presente') dimmi(`al server è arrivato ${fatte.join(', ')}`)
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

// --- 7. uscire con la coda vuota: nessun avviso ----------------------------
// Chi esce con scritture in sospeso le lascerebbe al prossimo account del
// dispositivo (il tablet della palestra è di tutti): partirebbero col suo
// token. Per questo ESCI manda quel che può, e se resta qualcosa lo dice.
{
  memoria.clear()
  let uscito = 0
  let avvisi = 0
  const smetti = guardaUscita((p) => { if (p) avvisi++ })
  await uscita(async () => { uscito++ })
  smetti()
  console.log(`7 coda vuota: uscito ${uscito}, avvisi ${avvisi}`)
  if (uscito !== 1) dimmi('non è uscito con la coda vuota')
  if (avvisi) dimmi('ha avvisato senza motivo')
}

// --- 8. con la rete, prima le manda, poi esce senza chiedere ---------------
{
  memoria.clear()
  const arrivate = []
  let aperta = false
  const c = new CodaDiUscita(async (op) => {
    if (!aperta) throw new Error('niente rete')
    arrivate.push(op.chiave)
  }, 'ods-corsi:coda')
  c.accoda('k1', 'segna', ['s1', 'p1', 'presente'])
  c.accoda('k2', 'chiudi', ['s1'])
  await attesa()
  aperta = true   // la rete torna mentre si preme ESCI
  let uscito = 0
  let avvisi = 0
  const smetti = guardaUscita((p) => { if (p) avvisi++ })
  await uscita(async () => { uscito++ })
  smetti()
  console.log(`8 la rete c'è: arrivate ${JSON.stringify(arrivate)}, uscito ${uscito}, avvisi ${avvisi}`)
  if (arrivate.length !== 2) dimmi('non ha mandato le scritture prima di uscire')
  if (uscito !== 1 || avvisi) dimmi('doveva uscire senza chiedere')
}

// --- 9. senza rete non esce da solo: avvisa, e ESCI LO STESSO le butta ------
{
  memoria.clear()
  const c = new CodaDiUscita(async () => { throw new Error('niente rete') }, 'ods-corsi:coda')
  c.accoda('k1', 'segna', ['s1', 'p1', 'presente'])
  c.accoda('k2', 'segna', ['s1', 'p2', 'assente'])
  c.accoda('k3', 'chiudi', ['s1'])
  await attesa()
  let uscito = 0
  let pendenza = null
  const smetti = guardaUscita((p) => { if (p) pendenza = p })
  await uscita(async () => { uscito++ })
  console.log(`9 senza rete: uscito ${uscito}, avviso per ${pendenza?.quante}`)
  if (uscito) dimmi('è uscito perdendo scritture in silenzio')
  if (pendenza?.quante !== 3) dimmi(`doveva avvisare per 3, ha detto ${pendenza?.quante}`)
  if (JSON.parse(memoria.get('ods-corsi:coda') ?? '[]').length !== 3) dimmi('l\'avviso ha già toccato la coda: TORNA le perderebbe')
  await pendenza.esciComunque()
  smetti()
  const resta = JSON.parse(memoria.get('ods-corsi:coda') ?? '[]').length
  console.log(`  ESCI LO STESSO: uscito ${uscito}, su disco ${resta}, in memoria ${c.inAttesa}`)
  if (uscito !== 1) dimmi('ESCI LO STESSO non è uscito')
  if (resta) dimmi('la coda è rimasta su disco: la leggerebbe il prossimo account')
  if (c.inAttesa) dimmi('la coda è rimasta in memoria: il prossimo giro la riscriverebbe su disco')
  await attesa()
  if (memoria.has('ods-corsi:coda') && JSON.parse(memoria.get('ods-corsi:coda')).length) dimmi('la coda è tornata su disco dopo l\'uscita')
}

// --- 10. anche la coda della sala si svuota --------------------------------
{
  memoria.clear()
  const sala = new CodaDiUscita(async () => { throw new Error('niente rete') }, 'ods-corsi:coda-sala')
  sala.accoda('segna:s1:p1', 'segna', ['s1', 'p1'])
  await attesa()
  let pendenza = null
  const smetti = guardaUscita((p) => { if (p) pendenza = p })
  await uscita(async () => {})
  console.log(`10 coda della sala: avviso per ${pendenza?.quante}`)
  if (pendenza?.quante !== 1) dimmi('non vede la coda della sala')
  await pendenza?.esciComunque()
  smetti()
  if (sala.inAttesa || JSON.parse(memoria.get('ods-corsi:coda-sala') ?? '[]').length) dimmi('la coda della sala non si è svuotata')
}

// --- 11. un server che non risponde non tiene bloccato ESCI ----------------
{
  memoria.clear()
  const c = new CodaDiUscita(() => new Promise(() => {}), 'ods-corsi:coda')
  c.accoda('k1', 'segna', ['s1', 'p1', 'presente'])
  let pendenza = null
  const smetti = guardaUscita((p) => { if (p) pendenza = p })
  const via = Date.now()
  await uscita(async () => {}, 50)
  smetti()
  console.log(`11 server muto: avviso dopo ${Date.now() - via} ms per ${pendenza?.quante}`)
  if (!pendenza) dimmi('è rimasto appeso invece di avvisare')
  c.svuota()
}

// --- 11b. senza nessuno che mostri l'avviso non si esce e non si perde ------
{
  memoria.clear()
  const c = new CodaDiUscita(async () => { throw new Error('niente rete') }, 'ods-corsi:coda')
  c.accoda('k1', 'segna', ['s1', 'p1', 'presente'])
  await attesa()
  let uscito = 0
  const risposta = await uscita(async () => { uscito++ })
  console.log(`11b nessun avviso montato: uscito ${uscito}, risposta ${risposta}, in coda ${c.inAttesa}`)
  if (uscito || risposta !== false) dimmi('è uscito senza poter chiedere')
  if (c.inAttesa !== 1) dimmi('ha toccato la coda')
  c.svuota()   // non resti nel registro a sporcare le prove dopo
}

// --- 11c. dice se è uscito -------------------------------------------------
{
  memoria.clear()
  const vuota = await uscita(async () => {})
  console.log(`11c coda vuota: risposta ${vuota}`)
  if (vuota !== true) dimmi('con la coda vuota doveva dire di essere uscito')
}

// --- 12. le parole dell'avviso ---------------------------------------------
{
  const uno = avvisoUscita(1)
  const tre = avvisoUscita(3)
  console.log(`12 testi: «${uno}» · «${tre}»`)
  if (!/^C’è 1 cosa non ancora arrivata/.test(uno)) dimmi('il singolare è sbagliato')
  if (!/^Ci sono 3 cose non ancora arrivate/.test(tre)) dimmi('il plurale è sbagliato')
  if (!/ESCI LO STESSO/.test(tre)) dimmi('l\'avviso non dice cosa fa ESCI LO STESSO')
}

console.log(guai ? `\n${guai} PROBLEMI` : '\nTUTTO A POSTO')
