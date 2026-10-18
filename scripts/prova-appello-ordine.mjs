// ---------------------------------------------------------------------------
// Le prove, senza browser: l'ordine dell'appello per presenze.
//
//   node scripts/prova-appello-ordine.mjs
//
// Nell'appello del telefono (istruttore e segreteria) gli iscritti stanno dal
// più presente al meno presente A QUELLA LEZIONE: le ultime 12 lezioni svolte
// dello stesso corso e dello stesso giorno della settimana (fuso Europe/Rome,
// l'ora non conta), prima di quella aperta. Conta solo `presente`. A parità,
// cognome e nome. Le prove restano in fondo e fuori dal conto. Il tablet di
// sala non cambia. Se lo storico non si legge, si apre per cognome, senza errori.
//
// 1. le regole, pure (`src/lib/frequenza.ts`);
// 2. nessuna riga si sposta dopo un tocco; la lezione passata riaperta;
// 3. la modalità prova e il database (finto, in memoria) danno lo stesso
//    ordine sugli stessi dati. Le query dello storico devono essere piatte
//    (tabelle `sessioni` e `presenze`, filtri eq/neq/in/lt/lte/gt/gte/is,
//    order, range, limit): niente join, niente `rpc`. Lato SQL non serve un
//    file nuovo: `sessioni_legge` e `presenze_legge` danno già allo staff e agli
//    istruttori le righe di tutte le lezioni (02-policy.sql).
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

process.env.TZ = 'Europe/Rome'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/frequenza'; export * as lista from './src/lib/appelloListe'; export { cercaNellElenco, perCognome } from './src/lib/sala'; export { creaDatiProva, memoria } from './src/lib/datiProva'; export { archivio } from './src/lib/archivioProva'; export { creaDatiSupabase } from './src/lib/datiSupabase'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const modulo = 'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '', pathname: '/segreteria/' }, addEventListener() {} }

const m = await import(modulo)
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che si rompe è un caso rosso con il suo messaggio, non la prova ferma.
const prova = async (cosa, f, voluto) => {
  let avuto
  try {
    avuto = await f()
  } catch (e) {
    avuto = `ERRORE: ${e.message}`
  }
  ok(cosa, avuto, voluto)
}

// ---- 1. Le regole ----------------------------------------------------------
console.log('Le regole, pure')

const GIORNO = 24 * 60 * 60_000
// Un lunedì alle 17:00 ora italiana (15:00 UTC d'estate), e quelli di prima.
const APERTA_LUN = Date.UTC(2026, 9, 19, 15, 0)
const lunedi = (n, ora = 15) => new Date(APERTA_LUN - n * 7 * GIORNO + (ora - 15) * 3600_000).toISOString()
const aperta = { id: 'aperta', corsoId: 'judo', inizio: lunedi(0) }
const sess = (id, inizio, stato = 'svolta', corsoId = 'judo') => ({ id, corsoId, inizio, stato })
const pres = (sessioneId, personaId, stato = 'presente') => ({ sessioneId, personaId, stato })
const conti = (sessioni, presenze, a = aperta) => Object.fromEntries(m.contaPresenze(a, sessioni, presenze))
const P = (id, cognome, nome = 'X', prova) => ({ id, cognome, nome, ruolo: 'iscritto', ...(prova ? { prova } : {}) })
const ids = (l) => l.map((x) => x.id)

// Tre lunedì svolti: Anna 3 presenze, Bea 2, Carla 1.
const tre = [sess('l1', lunedi(1)), sess('l2', lunedi(2)), sess('l3', lunedi(3))]
const trePres = [pres('l1', 'anna'), pres('l2', 'anna'), pres('l3', 'anna'), pres('l1', 'bea'), pres('l2', 'bea'), pres('l3', 'carla')]
ok('1. conta le presenze di quel giorno', conti(tre, trePres), { anna: 3, bea: 2, carla: 1 })
{
  // Cognomi in ordine inverso: l'ordine per cognome sarebbe Carla, Bea, Anna.
  const elenco = [P('carla', 'Albi'), P('bea', 'Bianchi'), P('anna', 'Zanni')]
  ok('1. 9, 5, 2 presenze: nell\'ordine 9, 5, 2, non per cognome', ids(m.ordinaPerPresenze(elenco, new Map([['anna', 9], ['bea', 5], ['carla', 2]]))), ['anna', 'bea', 'carla'])
  ok('1. dal conteggio all\'ordine: anna, bea, carla', ids(m.ordinaPerPresenze(elenco, m.contaPresenze(aperta, tre, trePres))), ['anna', 'bea', 'carla'])
}

// 2. Il lunedì non conta per il martedì dello stesso corso.
{
  const martedi = { id: 'aperta-mar', corsoId: 'judo', inizio: new Date(APERTA_LUN + GIORNO).toISOString() }
  ok('2. presenze del lunedì: nessuna conta per il martedì', conti(tre, trePres, martedi), {})
  const marSvolte = [sess('t1', new Date(APERTA_LUN - 6 * GIORNO).toISOString())]
  ok('2. contano i martedì, non i lunedì', conti([...tre, ...marSvolte], [...trePres, pres('t1', 'carla')], martedi), { carla: 1 })
}

// 3. Solo `presente`; l'annullata non conta.
{
  const dieci = Array.from({ length: 10 }, (_, i) => sess(`d${i}`, lunedi(i + 1), i === 9 ? 'annullata' : 'svolta'))
  const stati = ['presente', 'presente', 'presente', 'presente', 'assente', 'assente', 'assente', 'giustificato', 'giustificato']
  const segni = [...stati.map((s, i) => pres(`d${i}`, 'x', s)), pres('d9', 'x', 'presente')]
  ok('3. 4 presente, 3 assente, 2 giustificato e 1 annullata: conta 4', conti(dieci, segni), { x: 4 })
}

// 4. La lezione che si sta aprendo non entra nel conteggio.
ok('4. la lezione aperta non conta', conti([...tre, sess('aperta', lunedi(0))], [...trePres, pres('aperta', 'carla'), pres('aperta', 'dina')]), { anna: 3, bea: 2, carla: 1 })
ok('4. una lezione dopo quella aperta non conta', conti([...tre, sess('dopo', lunedi(-1))], [...trePres, pres('dopo', 'dina')]), { anna: 3, bea: 2, carla: 1 })
ok('4. una lezione passata con presenze ma non chiusa (ancora «prevista») conta: Chiudi non è l\'appello', conti([...tre, sess('p', lunedi(4), 'prevista')], [...trePres, pres('p', 'dina')]), { anna: 3, bea: 2, carla: 1, dina: 1 })

// 5. Parità: cognome e poi nome.
{
  const elenco = [P('1', 'Rossi', 'Mario'), P('2', 'Rossi', 'Anna'), P('3', 'Bianchi', 'Zeno'), P('4', "D'Amico", 'Maria')]
  ok('5. parità: cognome e nome, come oggi', ids(m.ordinaPerPresenze(elenco, new Map([['1', 2], ['2', 2], ['3', 2], ['4', 2]]))), ['3', '4', '2', '1'])
  ok('5. senza conti: cognome e nome', ids(m.ordinaPerPresenze(elenco, new Map())), ['3', '4', '2', '1'])
  ok('5. chi non ha storico vale 0, sotto chi ha presenze', ids(m.ordinaPerPresenze(elenco, new Map([['1', 1]]))), ['1', '3', '4', '2'])
}

// 7. Le prove in fondo, fuori dal conto.
{
  const elenco = [P('a', 'Zeta'), P('p', 'Aaa', 'Pia', true), P('b', 'Alfa'), P('q', 'Bbb', 'Quirino', true)]
  ok('7. le prove in fondo, anche con più presenze, per cognome', ids(m.ordinaPerPresenze(elenco, new Map([['p', 50], ['q', 40], ['a', 1]]))), ['a', 'b', 'p', 'q'])
}

// 12. Corsi diversi alla stessa ora non si mescolano.
ok('12. un altro corso, stesso giorno e ora: non conta', conti([...tre, sess('o1', lunedi(1), 'svolta', 'principianti'), sess('o2', lunedi(2), 'svolta', 'principianti')], [...trePres, pres('o1', 'dina'), pres('o2', 'anna')]), { anna: 3, bea: 2, carla: 1 })

// 13. Solo le ultime 12.
{
  const quattordici = Array.from({ length: 14 }, (_, i) => sess(`v${i}`, lunedi(i + 1)))
  // Edo è venuto alle 2 più vecchie, Fio alle 12 più recenti.
  const segni = [pres('v12', 'edo'), pres('v13', 'edo'), ...Array.from({ length: 12 }, (_, i) => pres(`v${i}`, 'fio'))]
  ok('13. oltre 12 lezioni: le due più vecchie non contano', conti(quattordici, segni), { fio: 12 })
  ok('13. e non lo stesso giorno di altre settimane: la dodicesima c\'è', conti(quattordici.slice(0, 12), [pres('v11', 'edo')]), { edo: 1 })
}

// 14. L'ora spostata non azzera lo storico.
{
  const ore = [sess('h1', lunedi(1, 15)), sess('h2', lunedi(2, 16)), sess('h3', lunedi(3, 17))]   // 17:00, 18:00, 19:00 italiane
  ok('14. stesso corso e giorno a ore diverse contano insieme', conti(ore, [pres('h1', 'g'), pres('h2', 'g'), pres('h3', 'g')]), { g: 3 })
  const straordinaria = [sess('x@s', new Date(APERTA_LUN - 3 * 7 * GIORNO + 4 * 3600_000).toISOString())]   // lunedì 21:00, senza ricorrenza
  ok('14. una straordinaria dello stesso giorno si abbina per corso e giorno', conti(straordinaria, [pres('x@s', 'g')]), { g: 1 })
}

// Il giorno è quello italiano: lunedì 23:30 UTC d'inverno è già martedì a Roma.
{
  const martediNotte = { id: 'aperta-notte', corsoId: 'judo', inizio: '2026-01-13T17:00:00.000Z' }   // martedì 18:00 a Roma
  const unaNotte = [sess('n1', '2026-01-05T23:30:00.000Z')]                                           // martedì 00:30 a Roma
  ok('fuso: lunedì 23:30 UTC è martedì per Roma, conta per il martedì', conti(unaNotte, [pres('n1', 'g')], martediNotte), { g: 1 })
  const lunediAperto = { id: 'aperta-lun', corsoId: 'judo', inizio: '2026-01-12T17:00:00.000Z' }
  ok('fuso: e non conta per il lunedì', conti(unaNotte, [pres('n1', 'g')], lunediAperto), {})
}

// ---- 2. Dopo un tocco; la lezione passata riaperta --------------------------
console.log('Dopo un tocco, e la lezione passata riaperta')
{
  const elenco = m.ordinaPerPresenze(
    [P('a', 'Albi'), P('b', 'Bianchi'), P('c', 'Conti'), P('z', 'Zanni')],
    new Map([['z', 9], ['b', 5], ['c', 2]]),
  ).map((p) => ({ ...p, stato: null }))
  ok('partenza: 9, 5, 2, poi chi non ha storico', ids(elenco), ['z', 'b', 'c', 'a'])
  let e = elenco
  for (const [id, azione] of [['b', 'presente'], ['a', 'assente'], ['z', 'presente'], ['b', 'rimetti']]) e = m.lista.dopoIlTocco(e, id, azione, m.lista.listaDi(e.find((x) => x.id === id).stato)).elenco
  ok('6. dopo i tocchi nessuna riga si è spostata', ids(e), ['z', 'b', 'c', 'a'])
  const liste = m.lista.dividiElenco(elenco)
  ok('6. e dentro le liste resta l\'ordine per presenze', ids(liste.da_segnare), ['z', 'b', 'c', 'a'])

  // 8. Passata riaperta: i non segnati in cima (fissati all'apertura), poi gli altri, ognuno per presenze.
  const ricevuto = [
    { id: 'z', stato: 'presente' },
    { id: 'b', stato: null },
    { id: 'c', stato: 'assente' },
    { id: 'a', stato: null },
  ]
  const primi = m.primiDaSegnare(ricevuto, true)
  ok('8. passata: i non segnati sono i primi', [...primi].sort(), ['a', 'b'])
  ok('8. passata: non segnati in cima per presenze, poi gli altri per presenze', ids(m.inOrdineDiApertura(ricevuto, primi)), ['b', 'a', 'z', 'c'])
  const dopoIlTocco = ricevuto.map((r) => (r.id === 'b' ? { ...r, stato: 'presente' } : r))
  ok('8. un tocco non muove le righe (il gruppo è fissato all\'apertura)', ids(m.inOrdineDiApertura(dopoIlTocco, primi)), ['b', 'a', 'z', 'c'])
  ok('8. non passata: nessun gruppo in cima, ordine per presenze', ids(m.inOrdineDiApertura(ricevuto, m.primiDaSegnare(ricevuto, false))), ['z', 'b', 'c', 'a'])
  ok('8. passata ma nessuno segnato: nessun gruppo in cima', [...m.primiDaSegnare(ricevuto.map((r) => ({ ...r, stato: null })), true)], [])

  // 9. La ricerca lavora sull'ordine nuovo.
  const nell = [P('z', 'Zanni', 'Marco'), P('b', 'Bianchi', 'Marta'), P('c', 'Conti', 'Luca'), P('a', 'Albi', 'Mara')]
  ok('9. ricerca per nome: i trovati restano nell\'ordine per presenze', ids(m.cercaNellElenco(nell, 'mar')), ['z', 'b', 'a'])
}

// ---- 3. Modalità prova e database: stesso ordine ----------------------------
console.log('Modalità prova e database, sugli stessi dati')

// La lezione aperta è un mercoledì passato di Judo 2 (lun, mer, ven alle 17:00); lo storico sono
// i mercoledì prima, e i lunedì che non devono mischiarsi.
const idLezione = (d) => `s@judo-2@${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}@17:00`
const oggi = new Date()
const mercoledi = (n) => new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7) - 7 + 2 - 7 * n)
const lunediDi = (n) => new Date(mercoledi(n).getFullYear(), mercoledi(n).getMonth(), mercoledi(n).getDate() - 2)
const APERTA = idLezione(mercoledi(0))
const W = Array.from({ length: 16 }, (_, i) => idLezione(mercoledi(i)))   // W[0] è l'aperta
const L = Array.from({ length: 10 }, (_, i) => idLezione(lunediDi(i + 1)))
const ANNULLATA = W[6]
const inizioDi = (id) => {
  const [, , giorno, ora] = id.split('@')
  const [a, me, g] = giorno.split('-').map(Number)
  return new Date(a, me - 1, g, Number(ora.slice(0, 2)), 0).toISOString()
}

const dati = m.creaDatiProva()
m.memoria.segnate = {}
m.archivio.dati.lezioni = { ...m.archivio.dati.lezioni, [ANNULLATA]: { stato: 'annullata' } }
const base = (await dati.dettaglio(APERTA)).elenco.filter((p) => !p.prova)
ok('la lezione di Judo 2 ha almeno cinque iscritti', base.length >= 5, true)
const q = base.map((p) => p.id)   // in ordine di cognome

// q[4]: 5 presenze nelle ultime cinque lezioni, e un'assente. q[2]: 2. q[3]: 2 più la presenza
// nell'annullata e due oltre le dodici svolte (l'annullata non fa numero): non devono contare. q[1]: solo assenze, ma 9 lunedì.
const segni = {}
const segna = (lez, chi, stato = 'presente') => ((segni[lez] ??= {})[chi] = stato)
for (const i of [1, 2, 3, 4, 5]) segna(W[i], q[4])
segna(W[7], q[4], 'assente')
segna(W[1], q[2]); segna(W[2], q[2])
segna(W[1], q[3]); segna(W[2], q[3]); segna(ANNULLATA, q[3]); segna(W[14], q[3]); segna(W[15], q[3])
for (const i of [1, 2, 3]) segna(W[i], q[1], i === 1 ? 'giustificato' : 'assente')
for (const l of L) segna(l, q[1])
// Le lezioni senza nessun segno devono comunque esserci: ognuna è una lezione svolta.
for (const w of W.slice(1)) segni[w] ??= {}
m.memoria.segnate = segni
m.memoria.salva()

// Lo stesso, come righe del database (finto).
const persone = (id) => base.find((p) => p.id === id)
const tabelle = {
  sessioni: [APERTA, ...W.slice(1), ...L].map((id) => ({
    id, corso_id: 'judo-2', inizio: inizioDi(id), fine: new Date(new Date(inizioDi(id)).getTime() + 3600_000).toISOString(),
    stato: id === ANNULLATA ? 'annullata' : id === W[1] ? 'prevista' : id === APERTA || W.includes(id) || L.includes(id) ? 'svolta' : 'prevista',
    note: null, istruttore_id: null,
    corsi: { nome: 'Judo 2', colore: null, capienza: null, istruttore_id: null, corsi_istruttori: [] }, sale: null, persone: null,
  })),
  iscrizioni: base.map((p, i) => ({ id: `i${i}`, corso_id: 'judo-2', dal: '2000-01-01', al: null, persone: { ...p, attiva: true } })),
  presenze: Object.entries(segni).flatMap(([s, v]) => Object.entries(v).map(([chi, stato], i) => ({ id: `${s}|${chi}`, sessione_id: s, persona_id: chi, stato }))),
  prove: [],
}

// Un database finto in memoria: solo le operazioni di una query piatta. Una che non conosce lo dice.
const finto = (t, guasto = () => false) => ({
  from(nome) {
    const filtri = []
    let ordine = null, da = 0, a = Infinity, uno = false
    const q = {
      select: () => q,
      order: (col, o) => ((ordine = [col, o?.ascending !== false]), q),
      range: (x, y) => ((da = x), (a = y + 1), q),
      limit: (n) => ((a = da + n), q),
      single: () => ((uno = true), q),
      then(res, rif) {
        let righe = [...(t[nome] ?? [])]
        for (const [op, col, v] of filtri) righe = righe.filter((r) => ({
          eq: r[col] === v, neq: r[col] !== v, in: v.includes(r[col]), lt: r[col] < v, lte: r[col] <= v, gt: r[col] > v, gte: r[col] >= v, is: r[col] === v,
        })[op])
        const guasta = guasto(nome, filtri)
        if (ordine) righe.sort((x, y) => (x[ordine[0]] < y[ordine[0]] ? -1 : x[ordine[0]] > y[ordine[0]] ? 1 : 0) * (ordine[1] ? 1 : -1))
        righe = righe.slice(da, a)
        const r = guasta ? { data: null, error: { code: '57014', message: 'non risponde' } }
          : uno ? (righe.length === 1 ? { data: righe[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'nessuna riga' } })
          : { data: righe, error: null }
        return Promise.resolve(r).then(res, rif)
      },
    }
    for (const op of ['eq', 'neq', 'in', 'lt', 'lte', 'gt', 'gte', 'is']) q[op] = (col, v) => (filtri.push([op, col, v]), q)
    return new Proxy(q, { get: (o, k) => (k in o ? o[k] : (() => { throw new Error(`il database finto non conosce .${String(k)}()`) })) })
  },
  rpc: async (f) => { throw new Error(`il database finto non conosce rpc ${f}`) },
})
const soloCognome = (elenco) => ids([...elenco].sort(m.perCognome))
const ordineProva = async () => ids((await dati.dettaglio(APERTA)).elenco)
const ordineDb = async (db = finto(tabelle)) => ids((await m.creaDatiSupabase(db).dettaglio(APERTA)).elenco)

const voluto = [q[4], q[2], q[3], ...soloCognome(base.filter((p) => ![q[4], q[2], q[3]].includes(p.id)))]
await prova('10. prova: 5, 2, 2 (a parità per cognome), poi 0 per cognome', ordineProva, voluto)
await prova('10. database: la stessa uscita della prova', ordineDb, voluto)
ok('i dati di prova sono diversi dall\'ordine per cognome (la prova ha senso)', JSON.stringify(voluto) !== JSON.stringify(soloCognome(base)), true)

// Le prove restano in fondo anche con lo storico, e fuori dal conto.
{
  const chi = { nome: 'Pia', cognome: 'Aaaprova' }
  const nuova = await dati.aggiungiProva(APERTA, chi)
  const el = (await dati.dettaglio(APERTA)).elenco
  ok('7. prova: la persona in prova è in fondo, marcata prova', [el.at(-1).id, el.at(-1).prova], [nuova.id, true])
  await dati.togliProva(APERTA, nuova.id)

  tabelle.prove = [{ sessione_id: APERTA, persone: { id: nuova.id, nome: 'Pia', cognome: 'Aaaprova', ruolo: 'iscritto', attiva: true } }]
  const e2 = (await m.creaDatiSupabase(finto(tabelle)).dettaglio(APERTA)).elenco
  ok('7. database: la persona in prova è in fondo, marcata prova', [e2.at(-1)?.id, e2.at(-1)?.prova], [nuova.id, true])
  tabelle.prove = []
}

// 11. Lo storico non si legge: per cognome, senza errori.
const perCognomeSolo = soloCognome(base)
const guastoStorico = (nome, filtri) =>
  (nome === 'sessioni' && !filtri.some(([op, col]) => op === 'eq' && col === 'id')) ||
  (nome === 'presenze' && filtri.some(([op, col, v]) => op === 'in' && col === 'sessione_id' && v.some((x) => x !== APERTA)))
await prova('11. database: lo storico non si legge, si apre per cognome senza errori', () => ordineDb(finto(tabelle, guastoStorico)), perCognomeSolo)
await prova('11. database: solo le presenze dello storico non si leggono, si apre per cognome', () => ordineDb(finto(tabelle, (n, f) => n === 'presenze' && f.some(([op, col, v]) => op === 'in' && col === 'sessione_id' && v.some((x) => x !== APERTA)))), perCognomeSolo)
await prova('11. database: lo storico che non si legge non nasconde lo stato dei segnati', async () => {
  const d = await m.creaDatiSupabase(finto({ ...tabelle, presenze: [...tabelle.presenze, { id: 'u', sessione_id: APERTA, persona_id: q[0], stato: 'presente' }] }, guastoStorico)).dettaglio(APERTA)
  return d.elenco.find((p) => p.id === q[0]).stato
}, 'presente')

// Un iscritto nuovo, senza storico, sta sotto chi ha presenze.
{
  const nuovo = { id: 'nuovo', nome: 'Zeno', cognome: 'Aaanuovo', ruolo: 'iscritto' }
  const t = { ...tabelle, iscrizioni: [...tabelle.iscrizioni, { id: 'in', corso_id: 'judo-2', dal: '2000-01-01', al: null, persone: { ...nuovo, attiva: true } }] }
  await prova('nuovo iscritto senza storico: vale 0, sotto chi ha presenze (anche se il cognome viene prima)', async () => (await ordineDb(finto(t))).slice(0, 4), [q[4], q[2], q[3], 'nuovo'])
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
