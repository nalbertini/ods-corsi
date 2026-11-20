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
// `pieno` finge la memoria del telefono piena: `setItem` solleva, come fa il browser.
let pieno = false
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => {
    if (pieno) throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' })
    memoria.set(k, String(v))
  },
  removeItem: (k) => memoria.delete(k),
}
const ascoltatori = {}
globalThis.window = {
  addEventListener: (e, f) => { (ascoltatori[e] ??= []).push(f) },
}
const rete = (e) => (ascoltatori[e] ?? []).forEach((f) => f())

const { Coda, aspettaLAccesso, avvisiCoda, avvisoPerChiRientra } = await import(modulo)

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

// --- 13. una coda illeggibile non diventa una coda vuota -------------------
{
  memoria.clear()
  memoria.set('ods-corsi:coda', '[{"chiave":"k1","tipo":"segna","args":["s1","p1"')
  const c = new Coda(async () => { throw new Error('niente rete') })
  await attesa()
  const copia = [...memoria].find(([k]) => k.startsWith('ods-corsi:coda:illeggibile'))
  console.log(`13 coda illeggibile: avvisata ${c.stato?.illeggibile}, copia ${copia ? 'tenuta' : 'persa'}`)
  if (c.stato?.illeggibile !== true) dimmi('una coda illeggibile si legge come vuota, senza dirlo')
  // La copia è una lista: più code illeggibili, una dopo l'altra, non si coprono.
  if (JSON.parse(copia?.[1] ?? '[]')[0] !== '[{"chiave":"k1","tipo":"segna","args":["s1","p1"') dimmi('il contenuto illeggibile non è stato messo da parte')
  c.accoda('k2', 'segna', ['s1', 'p2', 'presente'])
  const ancora = [...memoria].find(([k]) => k.startsWith('ods-corsi:coda:illeggibile'))
  if (!ancora) dimmi('la scrittura dopo ha cancellato la copia')
  c.svuota()
}

// --- 13b. se la copia non si può fare, l'originale non si tocca -----------
{
  memoria.clear()
  memoria.set('ods-corsi:coda', '{rotto')
  pieno = true
  const c = new Coda(async () => { throw new Error('niente rete') })
  c.accoda('k1', 'segna', ['s1', 'p1', 'presente'])
  await attesa()
  pieno = false
  console.log(`13b copia impossibile: originale «${memoria.get('ods-corsi:coda')}», solo in memoria ${c.soloInMemoria}`)
  if (memoria.get('ods-corsi:coda') !== '{rotto') dimmi('la coda illeggibile è stata sovrascritta senza copia')
  if (c.soloInMemoria !== 1) dimmi('la presenza nuova doveva risultare solo in memoria')
  c.svuota()
}

// --- 13c. una riga rotta accanto a righe buone: avviso e copia ------------
// Le righe buone ripartono, ma quella rotta non si butta in silenzio.
{
  memoria.clear()
  const grezzo = '[{"chiave":"k1","tipo":"segna","args":["s1","p1","presente"]},{"rotta":1}]'
  memoria.set('ods-corsi:coda', grezzo)
  const c = new Coda(async () => { throw new Error('niente rete') })
  await attesa()
  const copia = [...memoria].find(([k]) => k.startsWith('ods-corsi:coda:illeggibile'))
  console.log(`13c riga rotta: avvisata ${c.stato?.illeggibile}, in attesa ${c.stato?.inAttesa}, copia ${copia ? 'tenuta' : 'persa'}`)
  if (c.stato?.illeggibile !== true) dimmi('una riga rotta accanto a righe buone si butta senza dirlo')
  if (JSON.parse(copia?.[1] ?? '[]')[0] !== grezzo) dimmi('la coda con la riga rotta non è stata messa da parte')
  if (c.stato?.inAttesa !== 1) dimmi('la riga buona accanto a quella rotta doveva restare in coda')
  c.svuota()
}

// --- 14. la memoria piena si dice a chi guarda la coda --------------------
{
  memoria.clear()
  const visti = []
  const c = new Coda(async () => { throw new Error('niente rete') })
  c.guarda((n, stato) => visti.push(stato?.soloInMemoria))
  pieno = true
  c.accoda('k1', 'segna', ['s1', 'p1', 'presente'])
  pieno = false
  await attesa()
  console.log(`14 memoria piena: la spia ha saputo ${JSON.stringify(visti)}`)
  if (visti.at(-1) !== 1) dimmi('la spia non sa che la presenza sta solo in memoria')
  c.svuota()
}

// --- 15. il 42501 senza accesso aspetta, con l'accesso si butta -----------
{
  const casi = [
    [{ code: '42501' }, false, true],
    [{ code: '42501' }, true, false],
    [{ code: '23505' }, false, false],
    [new Error('niente rete'), false, false],
  ]
  const avuti = await Promise.all(casi.map(([e, conAccesso]) => aspettaLAccesso(e, () => conAccesso)))
  // Per la rete che manca la sessione non si chiede.
  let chiesta = false
  await aspettaLAccesso(new Error('niente rete'), () => (chiesta = true))
  if (chiesta) dimmi('per un errore di rete si è chiesta la sessione')
  console.log(`15 42501: ${JSON.stringify(avuti)}`)
  casi.forEach(([e, conAccesso, voluto], i) => {
    if (avuti[i] !== voluto) dimmi(`${e.code ?? e.message} ${conAccesso ? 'con' : 'senza'} accesso: voluto ${voluto}, avuto ${avuti[i]}`)
  })
}

// Per i casi che confrontano un valore con quello voluto.
const ok = (cosa, avuto, voluto) => { if (avuto !== voluto) dimmi(`${cosa}: avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`) }

// 16. Le frasi della spia: chi usa l'app deve sapere se le presenze sono al
// sicuro sul telefono, se si perdono chiudendo, o se qualcosa non si legge più.
{
  ok('16: coda vuota, nessun avviso', avvisiCoda({ inAttesa: 0, soloInMemoria: 0, illeggibile: false }).length, 0)
  const attesa = avvisiCoda({ inAttesa: 2, soloInMemoria: 0, illeggibile: false })
  ok('16: in attesa, un avviso', attesa.length, 1)
  ok('16: in attesa, tono attesa', attesa[0]?.tono, 'attesa')
  ok('16: in attesa, dice che sono sul telefono', /salvate sul telefono/.test(attesa[0]?.frase ?? ''), true)
  const memoria = avvisiCoda({ inAttesa: 2, soloInMemoria: 2, illeggibile: false })
  ok('16: memoria piena, tono guaio', memoria[0]?.tono, 'guaio')
  // Dire «salvate sul telefono» quando il disco non le ha prese è falso: chi chiude l'app le perde.
  ok('16: memoria piena, non dice che sono salvate', /salvate sul telefono/.test(memoria[0]?.frase ?? ''), false)
  ok('16: memoria piena, dice di non chiudere', /non chiudere/i.test(memoria[0]?.frase ?? ''), true)
  const rotta = avvisiCoda({ inAttesa: 0, soloInMemoria: 0, illeggibile: true })
  ok('16: coda illeggibile, un avviso anche a coda vuota', rotta.length, 1)
  ok('16: coda illeggibile, tono guaio', rotta[0]?.tono, 'guaio')
  ok('16: coda illeggibile, dice di ricontrollare', /ricontrolla/i.test(rotta[0]?.frase ?? ''), true)
  ok('16: illeggibile e in attesa, due avvisi', avvisiCoda({ inAttesa: 1, soloInMemoria: 0, illeggibile: true }).length, 2)
  ok('16: una sola, al singolare', avvisiCoda({ inAttesa: 1, soloInMemoria: 0, illeggibile: false })[0]?.titolo, 'UNA PRESENZA DA INVIARE')
  ok('16: due, al plurale', attesa[0]?.titolo, '2 PRESENZE DA INVIARE')
  // Sul tablet di sala «questo telefono» è falso: chi legge cerca un telefono che non c'è.
  const tablet = avvisiCoda({ inAttesa: 2, soloInMemoria: 2, illeggibile: true }, 'tablet')
  ok('16: sul tablet, si dice tablet', tablet.every((a) => /tablet/.test(a.frase) && !/telefono/.test(a.frase)), true)
}

// 17. Alla porta, dopo la sessione scaduta: chi rientra sa che qualcosa aspetta lui.
{
  ok('17: niente in coda, niente avviso', avvisoPerChiRientra(0), null)
  const a = avvisoPerChiRientra(3)
  ok('17: tre in coda, dice quante', /3/.test(a?.titolo ?? ''), true)
  ok('17: tre in coda, dice di entrare', /entra/i.test(a?.frase ?? ''), true)
  ok('17: una sola, al singolare', /^UNA /.test(avvisoPerChiRientra(1)?.titolo ?? ''), true)
}

// 18. La coda illeggibile non si perde per strada: né uscendo, né ricaricando.
{
  // Gli array si confrontano per contenuto: `ok` guarda l'identità.
  const uguali = (cosa, avuto, voluto) => ok(cosa, JSON.stringify(avuto), JSON.stringify(voluto))
  const copie = (dove = 'ods-corsi:coda') => JSON.parse(memoria.get(`${dove}:illeggibile`) ?? '[]')

  // Chi esce la cancellerebbe insieme alle altre: ESCI deve chiedere.
  memoria.clear()
  memoria.set('ods-corsi:coda', '{rotto')
  const u = new CodaDiUscita(async () => { throw new Error('niente rete') }, 'ods-corsi:coda')
  await attesa()
  let uscito = 0
  let chiesto = 0
  const smetti = guardaUscita((p) => { if (p) chiesto++ })
  await uscita(async () => { uscito++ }, 20)
  smetti()
  ok('18: con la coda illeggibile ESCI chiede', chiesto, 1)
  ok('18: e non esce da solo', uscito, 0)
  ok('18: la copia resta', copie().length, 1)
  u.svuota()

  // Ogni ricarica rileggeva lo stesso JSON rotto e ne aggiungeva un'altra copia.
  memoria.clear()
  memoria.set('ods-corsi:coda', '{rotto')
  new Coda(async () => { throw new Error('niente rete') })
  new Coda(async () => { throw new Error('niente rete') })
  await attesa()
  uguali('18: ricaricata due volte, una copia sola', copie(), ['{rotto'])
  ok('18: messa da parte, la coda rotta non resta al suo posto', memoria.get('ods-corsi:coda'), '[]')

  // Due code rotte diverse, una dopo l'altra: si tengono tutte e due.
  memoria.set('ods-corsi:coda', '{rotto due')
  new Coda(async () => { throw new Error('niente rete') })
  await attesa()
  uguali('18: due code rotte diverse, due copie', copie(), ['{rotto', '{rotto due'])

  // Una riga buona e una no: la buona parte, la rotta si mette da parte.
  memoria.clear()
  const mista = '[{"chiave":"k1","tipo":"segna","args":["s1","p1","presente"]},42]'
  memoria.set('ods-corsi:coda', mista)
  const c = new Coda(async () => { throw new Error('niente rete') })
  await attesa()
  ok('18: lista mista, la riga buona resta in coda', c.inAttesa, 1)
  ok('18: lista mista, si dice illeggibile', c.stato?.illeggibile, true)
  uguali('18: lista mista, la copia c\'è', copie(), [mista])
  c.svuota()
}

// 19. Chi rientra deve sapere su quale dispositivo, e con quale account.
{
  const t = avvisoPerChiRientra(2, 'tablet')
  ok('19: sul tablet si dice tablet', /tablet/.test(t?.frase ?? ''), true)
  // Con un altro account le scritture partirebbero col token sbagliato, e il server le rifiuterebbe.
  ok('19: si dice di rientrare con lo stesso account', /stesso account/.test(t?.frase ?? ''), true)
  ok('19: sul telefono di chi insegna, questo dispositivo', /questo dispositivo/.test(avvisoPerChiRientra(1)?.frase ?? ''), true)
}

console.log(guai ? `\n${guai} PROBLEMI` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
