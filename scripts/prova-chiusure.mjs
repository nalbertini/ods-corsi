// ---------------------------------------------------------------------------
// La chiusura della palestra, senza browser (`src/lib/chiusure.ts` e la
// modalità prova di `src/lib/segreteriaProva.ts`).
//
//   node scripts/prova-chiusure.mjs
//
// In SETTIMANA la segreteria annulla in un colpo le lezioni di un periodo
// (Natale, ponti): conta, chiede conferma, annulla, ricorda la chiusura e la
// toglie. Qui le regole lato app; quelle del database (tabelle, RLS, funzioni,
// trigger) sono in `supabase/prova/chiusure.sql`, con gli stessi casi e gli
// stessi messaggi. I criteri sono in `docs/design-canvas/chiusura-palestra/CRITERI.md`
// (i numeri fra parentesi).
//
// L'INTERFACCIA CHE QUESTA PROVA SI ASPETTA da `src/lib/chiusure.ts`
// (date `AAAA-MM-GG`, `oggi` lo passa chi chiama):
//
//   interface Chiusura { id: string; dal: string; al: string; salaId: string | null; lezioni: number }
//
//   cosaNonVaChiusura(dal, al): string | null     vuoti, al prima di dal, oltre un anno   (1)
//       (messaggi: «primo giorno», «ultimo giorno», «prima», «anno»)
//   periodoInLettere(dal, al): string             «dal 24 dicembre al 6 gennaio»; stesso giorno «il 24 dicembre»  (3)
//       L'anno non si scrive mai (un periodo dura al massimo un anno), tranne quando
//       dal e al hanno lo stesso giorno e mese (un anno preciso): allora in tutti e due.
//       Mai compattato: «dal 24 dicembre al 28 dicembre», non «dal 24 al 28 dicembre».
//   nelPassato(dal, oggi): boolean                dal è prima di oggi                     (6)
//   giorniOltreIlCalendario(dal, al, prontoFino: string | null): string[]
//       i giorni del periodo dopo prontoFino; con prontoFino null, tutti                  (10)
//   chiusureDellaSettimana(chiusure, lunedi: Date): Chiusura[]   quelle che toccano lun–dom, nell'ordine dato  (14)
//   chiusoIl(chiusure, giorno: string, salaId: string | null): Chiusura | null
//       una chiusura di tutte le sale (salaId null) o proprio di quella sala              (9)
//   testoConferma(conto, dal, al, nomeSala: string | null): { titolo: string; righe: string[] }   (3, 4, 20)
//       conto = { lezioni, straordinarie, conAppello: { corso, inizio /* ISO */, prova: boolean }[] }
//   avvisoFatto(dal, al, lezioni): string         «Chiusa dal 24 dicembre al 6 gennaio: 39 lezioni annullate.»  (15)
//
// E in `DatiSegreteria` (`segreteria.ts`), con la modalità prova a farle da sé:
//
//   chiusurePalestra(): Promise<Chiusura[]>   (`chiusure()` è già della cassa)
//   contaChiusura(dal, al, salaId: string | null): Promise<{ lezioni; straordinarie; conAppello }>
//   chiudi(dal, al, salaId: string | null): Promise<{ id: string; lezioni: number }>
//   togliChiusura(id): Promise<number>            quante lezioni tornano com'erano
//
// In modalità prova le lezioni non sono salvate una per una, si calcolano dalle
// ricorrenze: non c'è un «create dopo» da provare, e «nascono annullate» (8, 18)
// vuol dire che la chiusura vale anche per giorni lontani, mai toccati.
// ---------------------------------------------------------------------------
process.env.TZ = 'Europe/Rome'

import { build } from 'esbuild'

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

// Oggi, per la prova, è domenica 25 ottobre 2026 a mezzogiorno.
const OGGI_MS = new Date(2026, 9, 25, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI_MS]))
  }
  static now() {
    return OGGI_MS
  }
}
const OGGI = '2026-10-25'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/chiusure'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { archivio } from './src/lib/archivioProva'; export { memoria } from './src/lib/datiProva'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
// Un rifiuto che dice cosa fare: una frase italiana, mai un testo tecnico.
const parla = (msg, parola) => typeof msg === 'string' && new RegExp(parola, 'i').test(msg) && !/\bundefined\b|\bnull\b|\[object|TypeError/.test(msg)

const ch = (id, dal, al, salaId = null, lezioni = 0) => ({ id, dal, al, salaId, lezioni })
const natale = ch('n', '2026-12-24', '2027-01-06')

// ---------------------------------------------------------------------------
console.log('\n1 · DAL e AL: senza non si conta, e dice cosa manca')
ok('un periodo normale va bene', m.cosaNonVaChiusura('2026-12-24', '2027-01-06'), null)
ok('un solo giorno va bene (AL uguale a DAL)', m.cosaNonVaChiusura('2026-12-24', '2026-12-24'), null)
ok('senza DAL dice di scegliere il primo giorno', parla(m.cosaNonVaChiusura('', '2027-01-06'), 'primo giorno'), true)
ok('senza AL dice di scegliere l\'ultimo giorno', parla(m.cosaNonVaChiusura('2026-12-24', ''), 'ultimo giorno'), true)
ok('senza niente dice prima il primo giorno', parla(m.cosaNonVaChiusura('', ''), 'primo giorno'), true)
ok('AL prima di DAL no, e lo dice', parla(m.cosaNonVaChiusura('2027-01-06', '2026-12-24'), 'prima'), true)
ok('24/12/2026 → 24/12/2027 (un anno preciso) va', m.cosaNonVaChiusura('2026-12-24', '2027-12-24'), null)
ok('fino al 25/12/2027 no: oltre un anno, e lo dice', parla(m.cosaNonVaChiusura('2026-12-24', '2027-12-25'), 'anno'), true)
ok('una data che non esiste (31 novembre) non vale', m.cosaNonVaChiusura('2026-11-31', '2026-12-05') === null, false)

console.log('\n3 · IL PERIODO IN LETTERE')
ok('a cavallo dell\'anno', m.periodoInLettere('2026-12-24', '2027-01-06'), 'dal 24 dicembre al 6 gennaio')
ok('nello stesso mese non si compatta', m.periodoInLettere('2026-12-28', '2026-12-30'), 'dal 28 dicembre al 30 dicembre')
ok('il primo del mese si scrive 1, senza zero', m.periodoInLettere('2026-05-01', '2026-05-03'), 'dal 1 maggio al 3 maggio')
ok('un solo giorno', m.periodoInLettere('2026-12-24', '2026-12-24'), 'il 24 dicembre')
ok('un anno preciso mette l\'anno a tutti e due', m.periodoInLettere('2026-12-24', '2027-12-24'), 'dal 24 dicembre 2026 al 24 dicembre 2027')

console.log('\n6 · IL PASSATO si può chiudere, ma lo dice')
ok('dal prima di oggi è passato', m.nelPassato('2026-10-24', OGGI), true)
ok('dal oggi no', m.nelPassato(OGGI, OGGI), false)
ok('dal domani no', m.nelPassato('2026-10-26', OGGI), false)

console.log('\n10 · OLTRE IL CALENDARIO: i giorni in cui le lezioni nasceranno già annullate')
ok('il calendario arriva al 31/12: dall\'1 al 6 gennaio', m.giorniOltreIlCalendario('2026-12-24', '2027-01-06', '2026-12-31'), ['2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06'])
ok('pronto fino all\'ultimo giorno: nessuno', m.giorniOltreIlCalendario('2026-12-24', '2027-01-06', '2027-01-06'), [])
ok('pronto oltre il periodo: nessuno', m.giorniOltreIlCalendario('2026-12-24', '2027-01-06', '2027-06-30'), [])
ok('pronto prima del periodo: tutti i giorni', m.giorniOltreIlCalendario('2026-12-30', '2027-01-02', '2026-12-01'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
ok('senza calendario pronto: tutti i giorni', m.giorniOltreIlCalendario('2026-12-30', '2026-12-31', null), ['2026-12-30', '2026-12-31'])

console.log('\n14 · LE CHIUSURE DELLA SETTIMANA')
{
  const ponte = ch('p', '2027-04-24', '2027-04-26')
  const tutte = [natale, ponte]
  const sett = (g, mese, giorno) => m.chiusureDellaSettimana(tutte, new Date(g, mese, giorno)).map((c) => c.id)
  ok('la settimana prima di Natale (lun 14/12) non la tocca', sett(2026, 11, 14), [])
  ok('la settimana di Natale (lun 21/12) sì', sett(2026, 11, 21), ['n'])
  ok('e la successiva (lun 28/12)', sett(2026, 11, 28), ['n'])
  ok('la settimana del 4 gennaio la tocca ancora (fino al 6)', sett(2027, 0, 4), ['n'])
  ok('quella dell\'11 gennaio no', sett(2027, 0, 11), [])
  ok('una chiusura che finisce di domenica tocca quella settimana (lun 19/4 → dom 25/4)', sett(2027, 3, 19), ['p'])
  ok('una che comincia il lunedì dopo no (lun 26/4 → ponte è fino al 26)', sett(2027, 3, 26), ['p'])
  ok('senza chiusure niente', m.chiusureDellaSettimana([], new Date(2026, 11, 21)), [])
}

console.log('\n9 · UN GIORNO CHIUSO: tutte le sale, o quella sala')
{
  const tatami = ch('t', '2026-12-24', '2027-01-06', 'Tatami')
  ok('chiusura di tutte le sale: chiude ogni sala', m.chiusoIl([natale], '2026-12-25', 'Tatami')?.id, 'n')
  ok('e una lezione senza sala', m.chiusoIl([natale], '2026-12-25', null)?.id, 'n')
  ok('il primo giorno è chiuso', m.chiusoIl([natale], '2026-12-24', 'Lotta')?.id, 'n')
  ok('l\'ultimo giorno è chiuso', m.chiusoIl([natale], '2027-01-06', 'Lotta')?.id, 'n')
  ok('il giorno prima no', m.chiusoIl([natale], '2026-12-23', 'Lotta'), null)
  ok('il giorno dopo no', m.chiusoIl([natale], '2027-01-07', 'Lotta'), null)
  ok('la chiusura di una sala chiude quella sala', m.chiusoIl([tatami], '2026-12-25', 'Tatami')?.id, 't')
  ok('non un\'altra sala', m.chiusoIl([tatami], '2026-12-25', 'Lotta'), null)
  ok('né una lezione senza sala', m.chiusoIl([tatami], '2026-12-25', null), null)
  ok('con due chiusure basta una', m.chiusoIl([tatami, natale], '2026-12-25', 'Lotta')?.id, 'n')
}

console.log('\n3, 4 e 20 · LA CONFERMA')
{
  const conto = { lezioni: 39, straordinarie: 0, conAppello: [] }
  const t = m.testoConferma(conto, '2026-12-24', '2027-01-06', null)
  ok('il titolo dice periodo e lezioni', t.titolo, 'Chiudere dal 24 dicembre al 6 gennaio? Si annullano 39 lezioni.')
  ok('dice che gli iscritti non vengono avvisati', t.righe.some((r) => /non vengono avvisati/i.test(r)), true)
  ok('senza straordinarie non ne parla', t.righe.some((r) => /straordinari/i.test(r)), false)
  ok('senza appelli non elenca niente', t.righe.length, 1)
  ok('una lezione sola: singolare', m.testoConferma({ lezioni: 1, straordinarie: 0, conAppello: [] }, '2026-12-24', '2026-12-24', null).titolo, 'Chiudere il 24 dicembre? Si annulla 1 lezione.')
  ok('nessuna lezione: lo dice, e si può chiudere lo stesso', m.testoConferma({ lezioni: 0, straordinarie: 0, conAppello: [] }, '2026-12-24', '2027-01-06', null).titolo, 'Chiudere dal 24 dicembre al 6 gennaio? Non c\'è nessuna lezione da annullare.')
  const con = m.testoConferma(
    {
      lezioni: 39,
      straordinarie: 2,
      conAppello: [
        { corso: 'Judo 2', inizio: new Date(2026, 11, 28, 17, 0).toISOString(), prova: false },
        { corso: 'Lotta 2', inizio: new Date(2026, 11, 30, 18, 0).toISOString(), prova: true },
      ],
    },
    '2026-12-24',
    '2027-01-06',
    'Tatami',
  )
  ok('le straordinarie si dicono a parte, col numero', con.righe.some((r) => /2/.test(r) && /straordinari/i.test(r)), true)
  ok('le straordinarie in italiano', con.righe.find((r) => /straordinari/i.test(r)), 'Fra queste ci sono 2 lezioni straordinarie.')
  ok('una straordinaria sola', m.testoConferma({ lezioni: 3, straordinarie: 1, conAppello: [] }, '2026-12-24', '2026-12-26', null).righe[0], 'Fra queste c’è 1 lezione straordinaria.')
  ok('le lezioni con appello si elencano per corso e giorno', con.righe.some((r) => /Judo 2/.test(r) && /28 dicembre/.test(r)), true)
  ok('anche l\'altra', con.righe.some((r) => /Lotta 2/.test(r) && /30 dicembre/.test(r)), true)
  ok('la lezione con una prova lo dice', con.righe.some((r) => /Lotta 2/.test(r) && /prova/i.test(r)), true)
  ok('e quella senza prova no', con.righe.some((r) => /Judo 2/.test(r) && /prova/i.test(r)), false)
  ok('dice che presenze e prove restano', con.righe.some((r) => /restano/i.test(r)), true)
  ok('con una sala sola dice quale', con.righe.some((r) => /Tatami/.test(r)), true)
  ok('e il titolo non cambia', con.titolo, 'Chiudere dal 24 dicembre al 6 gennaio? Si annullano 39 lezioni.')
  ok('gli iscritti non vengono avvisati, anche qui', con.righe.some((r) => /non vengono avvisati/i.test(r)), true)
}

console.log('\n15 · L\'AVVISO DOPO LA CHIUSURA')
ok('con tante lezioni', m.avvisoFatto('2026-12-24', '2027-01-06', 39), 'Chiusa dal 24 dicembre al 6 gennaio: 39 lezioni annullate.')
ok('con una', m.avvisoFatto('2026-12-24', '2026-12-24', 1), 'Chiusa il 24 dicembre: 1 lezione annullata.')
ok('con nessuna', m.avvisoFatto('2026-12-24', '2027-01-06', 0), 'Chiusa dal 24 dicembre al 6 gennaio: nessuna lezione annullata.')

console.log('\nTOGLIERE: la domanda e l’avviso')
const feste = { id: 'n', dal: '2026-12-24', al: '2027-01-06', salaId: null, lezioni: 39 }
ok(
  'la domanda dice quante tornano e che quelle a mano restano',
  m.testoTogli(feste, null),
  'Togliere la chiusura dal 24 dicembre al 6 gennaio?\nLe 39 lezioni annullate dalla chiusura tornano PREVISTE, con le presenze che avevano. Quelle annullate a mano, prima o dopo, restano annullate.\nGli iscritti non vengono avvisati: se serve, avvisali tu.',
)
ok('una sala sola: la nomina', m.testoTogli({ ...feste, salaId: 's', lezioni: 1 }, 'Tatami').split('\n').slice(0, 2), [
  'Togliere la chiusura della sala Tatami dal 24 dicembre al 6 gennaio?',
  'La lezione annullata dalla chiusura torna PREVISTA, con le presenze che aveva. Quelle annullate a mano, prima o dopo, restano annullate.',
])
ok('nessuna lezione: niente da rimettere', m.testoTogli({ ...feste, lezioni: 0 }, null).split('\n')[1], 'Non ci sono lezioni da rimettere: si toglie solo la chiusura.')
ok('avviso con tante', m.avvisoTolta(39), 'Chiusura tolta: 39 lezioni di nuovo previste.')
ok('avviso con una', m.avvisoTolta(1), 'Chiusura tolta: 1 lezione di nuovo prevista.')
ok('avviso con nessuna', m.avvisoTolta(0), 'Chiusura tolta.')

console.log('\nL’ELENCO: una riga per chiusura, con quante lezioni ha annullato')
ok('tutte le sale', m.rigaChiusura(feste, null), 'Dal 24 dicembre al 6 gennaio · Tutte le sale · 39 lezioni')
ok('una sala, una lezione', m.rigaChiusura({ ...feste, lezioni: 1 }, 'Tatami'), 'Dal 24 dicembre al 6 gennaio · Tatami · 1 lezione')
ok('nessuna lezione: lo dice', m.rigaChiusura({ ...feste, lezioni: 0 }, null), 'Dal 24 dicembre al 6 gennaio · Tutte le sale · nessuna lezione')

// ---------------------------------------------------------------------------
// La modalità prova: stesse regole del database (`supabase/prova/chiusure.sql`).
const s = m.creaSegreteriaProva()
const giorno = (a, b = a) => [new Date(2026, a[0], a[1]), new Date(2026, b[0], b[1])]
const settimana = (da, a) => s.settimana(...giorno(da, a))
const viva = (l) => l.stato !== 'annullata'
const stati = async (da, a) => Object.fromEntries((await settimana(da, a)).map((l) => [l.id, l.stato]))

// La settimana di lunedì 26 ottobre 2026 (futura).
const SETT = ['2026-10-26', '2026-11-01']
const sett = () => settimana([9, 26], [10, 1])

console.log('\n2 · CONTARE NON CAMBIA NIENTE · 5 · LE GIÀ ANNULLATE NON CONTANO')
{
  const prima = await sett()
  ok('la settimana ha lezioni', prima.length > 6, true)
  ok('non ci sono chiusure', await s.chiusurePalestra(), [])
  const daAnnullare = prima[0]
  await s.aggiornaLezione(daAnnullare.id, { stato: 'annullata' })
  const viveProva = (await sett()).filter(viva).length
  const stato0 = await stati([9, 26], [10, 1])
  const conto = await s.contaChiusura(...SETT, null)
  ok('conta quelle non annullate, senza la già annullata a mano', conto.lezioni, viveProva)
  ok('nessuna straordinaria, nessun appello', [conto.straordinarie, conto.conAppello], [0, []])
  ok('contare non ha cambiato niente', await stati([9, 26], [10, 1]), stato0)
  ok('e non ha ricordato nessuna chiusura', await s.chiusurePalestra(), [])
  ok('un periodo senza lezioni conta zero', (await s.contaChiusura('2026-07-15', '2026-07-16', null)).lezioni, 0)
}

console.log('\n4 · APPELLO E PROVE: si contano a parte, si annullano lo stesso, restano salvati')
{
  const vive = (await sett()).filter(viva)
  const conAppello = vive[0]
  const conProva = vive[1]
  m.memoria.segnate = { ...m.memoria.segnate, [conAppello.id]: { 'p-qualcuno': 'presente' } }
  m.archivio.dati.prove = [...(m.archivio.dati.prove ?? []), { sessioneId: conProva.id, personaId: 'p-un-altro', il: conProva.inizio }]
  const conto = await s.contaChiusura(...SETT, null)
  ok('la conferma le elenca per corso e giorno, la prova segnata', conto.conAppello.map((x) => [x.corso, x.inizio, x.prova]), [
    [conAppello.corso, conAppello.inizio, false],
    [conProva.corso, conProva.inizio, true],
  ])
  ok('e restano nel totale', conto.lezioni, vive.length)
}

console.log('\n2 e 9 · LE STRAORDINARIE: si contano a parte e si annullano')
{
  const nonVive = (await sett()).filter((l) => !viva(l)).length
  await s.straordinaria('lotta-2', new Date(2026, 9, 28, 20, 30), 60)
  const conto = await s.contaChiusura(...SETT, null)
  ok('una straordinaria è contata a parte', conto.straordinarie, 1)
  ok('e sta anche nel totale', conto.lezioni, (await sett()).length - nonVive)
}

console.log('\n7 · UNA SALA SOLA: tocca solo quella sala')
let chiusuraTatami
{
  const tatami = (await sett()).filter((l) => l.sala === 'Tatami' && viva(l))
  const altre = (await sett()).filter((l) => l.sala !== 'Tatami' && viva(l))
  ok('ci sono lezioni in Tatami e in altre sale', tatami.length > 0 && altre.length > 0, true)
  ok('il conto è di quella sala', (await s.contaChiusura(...SETT, 'Tatami')).lezioni, tatami.length)
  chiusuraTatami = await s.chiudi(...SETT, 'Tatami')
  ok('chiudere dice quante ne ha annullate', chiusuraTatami.lezioni, tatami.length)
  const dopo = await sett()
  ok('quelle del Tatami sono annullate', dopo.filter((l) => l.sala === 'Tatami').every((l) => !viva(l)), true)
  ok('le altre sale hanno le loro lezioni ancora previste', dopo.filter((l) => l.sala !== 'Tatami' && viva(l)).length, altre.length)
  ok('la chiusura si ricorda, con sala e conto', (await s.chiusurePalestra()).map((c) => [c.dal, c.al, c.salaId, c.lezioni]), [[SETT[0], SETT[1], 'Tatami', tatami.length]])
}

console.log('\n7 e 4 · CHIUDERE TUTTO: annulla le contate, compreso l\'appello, e le presenze restano')
let chiusuraTutte
let restanti
{
  const sale = (await sett()).filter(viva)
  restanti = sale.length
  const segnate = JSON.stringify(m.memoria.segnate)
  const prove = JSON.stringify(m.archivio.dati.prove)
  ok('le già annullate (anche dalla chiusura di prima) non si contano', (await s.contaChiusura(...SETT, null)).lezioni, restanti)
  chiusuraTutte = await s.chiudi(...SETT, null)
  ok('chiudere annulla tutte le contate', chiusuraTutte.lezioni, restanti)
  ok('in settimana non resta niente di previsto', (await sett()).filter(viva).length, 0)
  ok('le presenze sono ancora lì', JSON.stringify(m.memoria.segnate), segnate)
  ok('le prove anche', JSON.stringify(m.archivio.dati.prove), prove)
  ok('le chiusure ricordate sono due, con i loro conti', (await s.chiusurePalestra()).map((c) => [c.salaId, c.lezioni]).sort(), [['Tatami', chiusuraTatami.lezioni], [null, restanti]].sort())
  ok('una nuova conta dà zero', (await s.contaChiusura(...SETT, null)).lezioni, 0)
}

console.log('\n9 · UNA STRAORDINARIA AGGIUNTA IN UN GIORNO CHIUSO NASCE PREVISTA')
{
  await s.straordinaria('lotta-2', new Date(2026, 9, 29, 21, 0), 60)
  const x = (await sett()).filter((l) => l.straordinaria && new Date(l.inizio).getHours() === 21)
  ok('c\'è', x.length, 1)
  ok('ed è prevista', x[0]?.stato, 'prevista')
  await s.togliLezione(x[0].id)
}

console.log('\n8 e 18 · LE LEZIONI CHE NASCONO DOPO IN UN GIORNO CHIUSO NASCONO ANNULLATE')
{
  // In prova le lezioni si calcolano, non si creano: vale per giorni mai toccati.
  ok('prima un giorno lontano ha lezioni previste', (await settimana([11, 28], [11, 31])).filter(viva).length > 0, true)
  const c = await s.chiudi('2026-12-24', '2027-01-06', null)
  ok('chiude le lezioni di Natale', c.lezioni > 0, true)
  ok('e quelle dopo, calcolate più tardi, sono annullate', (await s.settimana(new Date(2027, 0, 4), new Date(2027, 0, 6))).filter(viva).length, 0)
  ok('il giorno dopo la chiusura è normale', (await s.settimana(new Date(2027, 0, 7), new Date(2027, 0, 8))).filter(viva).length > 0, true)
  ok('il giorno prima anche', (await settimana([11, 23])).filter(viva).length > 0, true)
  ok('togliendola le lezioni di Natale tornano', (await s.togliChiusura(c.id)) === c.lezioni, true)
  ok('anche quelle lontane', (await s.settimana(new Date(2027, 0, 4), new Date(2027, 0, 6))).filter(viva).length > 0, true)
}

console.log('\n11 · TOGLIERE: le lezioni tornano com\'erano, quelle annullate a mano restano annullate')
{
  const annullataAMano = (await sett())[0]
  ok('la lezione annullata a mano è annullata anche ora', annullataAMano.stato, 'annullata')
  ok('togliere la chiusura di tutte dice quante lezioni tornano', await s.togliChiusura(chiusuraTutte.id), restanti)
  const dopo = await sett()
  ok('tornano previste quelle annullate dalla chiusura', dopo.filter(viva).length, restanti)
  ok('la straordinaria annullata dalla chiusura è tornata prevista', dopo.filter((l) => l.straordinaria && viva(l)).length, 1)
  ok('quelle del Tatami, di un\'altra chiusura, restano annullate', dopo.filter((l) => l.sala === 'Tatami').every((l) => !viva(l)), true)
  ok('la chiusura sparisce dall\'elenco', (await s.chiusurePalestra()).map((c) => c.id), [chiusuraTatami.id])
  ok('togliere l\'altra rimette il Tatami', await s.togliChiusura(chiusuraTatami.id), chiusuraTatami.lezioni)
  const fine = await sett()
  ok('resta annullata solo quella a mano', fine.filter((l) => !viva(l)).map((l) => l.id), [annullataAMano.id])
  ok('e l\'elenco è vuoto', await s.chiusurePalestra(), [])
  ok('togliere una chiusura che non c\'è dice cosa fare', parla(await errore(() => s.togliChiusura('non-c-e')), 'chiusura'), true)
}

console.log('\n11 · TOGLIERE: una lezione rimessa a mano non è più della chiusura')
{
  const [x, y] = (await settimana([10, 9])).filter(viva)
  const a = await s.chiudi('2026-11-09', '2026-11-09', null)
  // x rimessa e poi annullata di nuovo a mano: è una decisione della segreteria.
  await s.aggiornaLezione(x.id, { stato: 'prevista' })
  await s.aggiornaLezione(x.id, { stato: 'annullata' })
  // y rimessa a mano, poi chiusa da un'altra chiusura: è di quella.
  await s.aggiornaLezione(y.id, { stato: 'prevista' })
  const b = await s.chiudi('2026-11-09', '2026-11-10', null)
  ok('la seconda chiusura prende quella rimessa a mano', b.lezioni > 0, true)
  await s.togliChiusura(a.id)
  ok('togliere la prima non rimette quella annullata di nuovo a mano', (await stati([10, 9]))[x.id], 'annullata')
  ok('né quella che ora è della seconda', (await stati([10, 9]))[y.id], 'annullata')
  await s.togliChiusura(b.id)
  ok('togliere la seconda la rimette', (await stati([10, 9]))[y.id], 'prevista')
  ok('quella annullata a mano resta annullata', (await stati([10, 9]))[x.id], 'annullata')
  await s.aggiornaLezione(x.id, { stato: 'prevista' })
}

console.log('\n11 · DUE CHIUSURE SULLO STESSO GIORNO: togliere la prima lascia la lezione alla seconda')
{
  const [l] = (await settimana([10, 16])).filter(viva)
  const sala = await s.chiudi('2026-11-16', '2026-11-16', l.salaId)
  const tutte = await s.chiudi('2026-11-15', '2026-11-17', null)
  await s.togliChiusura(sala.id)
  ok('il 16 è ancora chiuso: la lezione resta annullata', (await stati([10, 16]))[l.id], 'annullata')
  ok('ed è della seconda', (await s.chiusurePalestra()).find((c) => c.id === tutte.id)?.lezioni > 0, true)
  await s.togliChiusura(tutte.id)
  ok('togliere anche la seconda la rimette', (await stati([10, 16]))[l.id], 'prevista')
}

console.log('\n6 e 11 · IL PASSATO: una lezione svolta, chiusa e riaperta, torna svolta')
{
  const [lun] = (await settimana([9, 19])).filter(viva)
  await s.aggiornaLezione(lun.id, { stato: 'svolta' })
  const c = await s.chiudi('2026-10-19', '2026-10-20', null)
  ok('il passato si chiude lo stesso', c.lezioni > 0, true)
  ok('la svolta è annullata', (await stati([9, 19]))[lun.id], 'annullata')
  await s.togliChiusura(c.id)
  ok('togliendo la chiusura torna svolta, non prevista', (await stati([9, 19]))[lun.id], 'svolta')
}

console.log('\n1 · I RIFIUTI, anche dalla modalità prova')
ok('AL prima di DAL', parla(await errore(() => s.chiudi('2026-12-31', '2026-12-24', null)), 'prima'), true)
ok('oltre un anno', parla(await errore(() => s.chiudi('2026-12-24', '2027-12-25', null)), 'anno'), true)
ok('anche solo contare', parla(await errore(() => s.contaChiusura('2026-12-24', '2027-12-25', null)), 'anno'), true)
ok('niente è rimasto chiuso', await s.chiusurePalestra(), [])

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
