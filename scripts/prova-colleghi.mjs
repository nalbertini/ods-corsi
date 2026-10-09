// ---------------------------------------------------------------------------
// Il collega segnato dall'appello, senza browser.
//
//   node scripts/prova-colleghi.mjs
//
// Chi fa l'appello dal telefono, ed è previsto sulla lezione, segna presente
// anche l'altro istruttore previsto che non ha messo il PIN: confermata da
// sola, «segnata da …», e la può togliere finché la segreteria non l'ha
// guardata. La segreteria segna «c'era» un previsto anche su una lezione già
// coperta. La modalità prova deve fare come il database
// (`supabase/prova/istruttore-collega.sql`, stessi casi e stessi messaggi);
// in fondo la coda delle scritture col database finto, e la riga di
// PRESENZE ISTRUTTORI come la dice `src/lib/segreteria.ts`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

process.env.TZ = 'Europe/Rome'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaDatiProva, istruttoreDallAppello } from './src/lib/datiProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { archivio } from './src/lib/archivioProva'; export { creaDatiSupabase } from './src/lib/datiSupabase'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export * as segreteriaLib from './src/lib/segreteria'; export * as oreLib from './src/lib/ore'; export { righeIstruttori, conMioAppello } from './src/lib/dati'",
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
// Chi fa l'appello in prova lo dice l'indirizzo: nell'area istruttori è Maurizio.
const ascoltatori = {}
globalThis.window = {
  location: { search: '', hash: '', pathname: '/istruttori/' },
  addEventListener: (e, f) => { (ascoltatori[e] ??= []).push(f) },
}
const area = (a) => { globalThis.window.location.pathname = `/${a}/` }

// Oggi, per la prova, è sabato 26 settembre 2026 a mezzogiorno.
const OGGI = new Date(2026, 8, 26, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI]))
  }
  static now() {
    return OGGI
  }
}

const m = await import(modulo)
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che non c'è, o che si rompe, è un caso rosso, non la prova ferma.
const prova = async (cosa, f, voluto) => {
  let avuto
  try {
    avuto = await f()
  } catch (e) {
    avuto = `ERRORE: ${e.message}`
  }
  ok(cosa, avuto, voluto)
}
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}

// Un corso che insegnano Maurizio e Maura, il sabato alle 9 e alle 11:30.
// Maurizio fa da «Nicola» (chi fa l'appello), Maura da «Giulia» (la collega).
const a = m.archivio.dati
a.corsi.push({
  id: 'collega',
  nome: 'Lotta collega',
  colore: '#16a54a',
  sala: 'Lotta',
  istruttori: ['i-maurizio', 'i-maura'],
  attivo: true,
  ricorrenze: [
    { id: 'collega-9', giorno: 6, ora: '09:00', durata: 60, dal: '2026-09-01' },
    { id: 'collega-11', giorno: 6, ora: '11:30', durata: 60, dal: '2026-09-01' },
  ],
})
const OGGI_ID = 's@collega@2026-09-26@11:30'      // in corso
const ANNULLATA = 's@collega@2026-09-26@09:00'
const COPERTA = 's@collega@2026-09-19@11:30'      // Maurizio ha fatto l'appello
const SOSTITUITA = 's@collega@2026-09-19@09:00'   // Fabio al posto di tutti e due
a.lezioni = { ...a.lezioni, [ANNULLATA]: { stato: 'annullata' }, [SOSTITUITA]: { istruttore: 'i-fabio' } }
const iscritto = a.persone.find((p) => p.ruolo === 'iscritto' && p.attiva).id
m.archivio.salva()

const app = m.creaDatiProva()
const seg = m.creaSegreteriaProva()
const righe = () => m.archivio.dati.presenzeIstruttori ?? []
const di = (sessioneId, personaId) => {
  const x = righe().find((p) => p.sessioneId === sessioneId && p.personaId === personaId)
  return x ? `${x.stato} ${x.come ?? 'pin'} ${x.prevista}` : 'nessuna'
}
const istruttori = async (sessioneId) => (await app.istruttoriLezione(sessioneId)).map((x) => [x.id, x.stato ?? null])
const segnaCollega = async (sessioneId, personaId, presente = true) => app.segnaCollega(sessioneId, personaId, presente)
const togli = (sessioneId, personaId) => {
  m.archivio.dati.presenzeIstruttori = righe().filter((p) => !(p.sessioneId === sessioneId && p.personaId === personaId))
  m.archivio.salva()
}
const metti = (riga) => {
  m.archivio.dati.presenzeIstruttori = [...righe(), { id: `pi-${riga.personaId}-${riga.sessioneId}`, prevista: true, entratoIl: new Date().toISOString(), sala: 'Lotta', ...riga }]
  m.archivio.salva()
}

console.log('\n1. chi fa l\'appello vede gli istruttori della lezione')
{
  await prova('prima dell\'appello nessuno è segnato', () => istruttori(OGGI_ID), [['i-maura', null], ['i-maurizio', null]])
  await app.segna(OGGI_ID, iscritto, 'presente')
  await prova('fatto l\'appello: Maurizio sì, Maura no', () => istruttori(OGGI_ID), [['i-maura', null], ['i-maurizio', 'confermata']])
}

console.log('\n2. Maurizio segna Maura')
{
  await prova('Maurizio segna Maura', () => segnaCollega(OGGI_ID, 'i-maura'), undefined)
  await prova('e la vede segnata', () => istruttori(OGGI_ID), [['i-maura', 'confermata'], ['i-maurizio', 'confermata']])
  ok('Maura confermata, da collega, era prevista', di(OGGI_ID, 'i-maura'), 'confermata collega true')
  ok('segnata da Maurizio', righe().find((p) => p.sessioneId === OGGI_ID && p.personaId === 'i-maura')?.segnataDa, 'i-maurizio')
  ok('non è una decisione della segreteria', righe().find((p) => p.sessioneId === OGGI_ID && p.personaId === 'i-maura')?.gestitaIl ?? null, null)
  await prova('una seconda volta: niente doppioni', async () => (await segnaCollega(OGGI_ID, 'i-maura'), righe().filter((p) => p.sessioneId === OGGI_ID && p.personaId === 'i-maura').length), 1)
  ok('la riga di Maurizio resta dall\'appello', di(OGGI_ID, 'i-maurizio'), 'confermata appello true')
  await prova('in LE MIE ORE di Maura la lezione è confermata', async () => {
    const mie = await app.mieOre('i-maura', new Date(2026, 8, 1), new Date(2026, 8, 30))
    return m.oreLib.delMese(mie.presenze, mie.senzaIstruttore, 'i-maura', { da: new Date(2026, 8, 1), a: new Date(2026, 8, 30) }).confermate.map((x) => x.sessioneId)
  }, [OGGI_ID])
}

console.log('\n3. chi non può, e chi non si segna')
{
  ok('non se stesso', await errore(() => segnaCollega(OGGI_ID, 'i-maurizio')), "te stesso ti segna l'appello")
  ok('non la segreteria, che lì non insegna', await errore(() => segnaCollega(OGGI_ID, 's-prova')), 'si segnano solo gli istruttori previsti')
  ok('non un iscritto', await errore(() => segnaCollega(OGGI_ID, iscritto)), 'si segnano solo gli istruttori previsti')
  ok('non su una lezione dove Maurizio non insegna', await errore(() => segnaCollega('s@lotta-2@2026-09-25@17:00', 'i-maura')), 'segna un collega solo chi insegna questa lezione')
  ok('non dove c\'è un sostituto al suo posto', await errore(() => segnaCollega(SOSTITUITA, 'i-maura')), 'segna un collega solo chi insegna questa lezione')
  ok('non su una lezione annullata', await errore(() => segnaCollega(ANNULLATA, 'i-maura')), 'la lezione è annullata')
  ok('non prima del suo appello', await errore(() => segnaCollega(COPERTA, 'i-maura')), "prima fai l'appello: il collega si segna dopo")
  ok('né su una che non c\'è', await errore(() => segnaCollega('s@niente@2026-09-26@11:30', 'i-maura')), 'lezione inesistente')
  area('segreteria')
  ok('dalla segreteria non è un collega', await errore(() => segnaCollega(OGGI_ID, 'i-maura')), 'segna un collega solo chi insegna questa lezione')
  area('istruttori')
  await prova('su una lezione annullata la parte ISTRUTTORI non c\'è', () => app.istruttoriLezione(ANNULLATA), [])
  ok('nessuna riga dai rifiuti', righe().filter((p) => [ANNULLATA, SOSTITUITA, 's@lotta-2@2026-09-25@17:00'].includes(p.sessioneId)).length, 0)
}

console.log('\n4. togliere il segno')
{
  await prova('Maurizio toglie Maura, segnata da lui', () => segnaCollega(OGGI_ID, 'i-maura', false), undefined)
  ok('la riga se ne va', di(OGGI_ID, 'i-maura'), 'nessuna')
  await prova('e non è più segnata', () => istruttori(OGGI_ID), [['i-maura', null], ['i-maurizio', 'confermata']])
  ok('toglierla di nuovo: niente', await errore(() => segnaCollega(OGGI_ID, 'i-maura', false)), 'nessun errore')
  ok('non toglie la propria presenza', await errore(() => segnaCollega(OGGI_ID, 'i-maurizio', false)), 'si toglie solo un collega segnato da te')

  metti({ sessioneId: OGGI_ID, personaId: 'i-maura', stato: 'confermata', come: 'pin' })
  ok('col PIN: segnarla non cambia niente', await errore(() => segnaCollega(OGGI_ID, 'i-maura')), 'nessun errore')
  ok('resta dal PIN', di(OGGI_ID, 'i-maura'), 'confermata pin true')
  ok('col PIN: non si toglie', await errore(() => segnaCollega(OGGI_ID, 'i-maura', false)), 'si toglie solo un collega segnato da te')
  togli(OGGI_ID, 'i-maura')

  metti({ sessioneId: OGGI_ID, personaId: 'i-maura', stato: 'rifiutata', come: 'pin', gestitaDa: 'Segreteria di prova', gestitaIl: new Date().toISOString() })
  await segnaCollega(OGGI_ID, 'i-maura').catch(() => {})
  ok('rifiutata: segnarla non cambia niente', di(OGGI_ID, 'i-maura'), 'rifiutata pin true')
  togli(OGGI_ID, 'i-maura')

  metti({ sessioneId: OGGI_ID, personaId: 'i-maura', stato: 'confermata', come: 'segreteria', gestitaDa: 'Segreteria di prova', gestitaIl: new Date().toISOString() })
  ok('scelta dalla segreteria: non si toglie', await errore(() => segnaCollega(OGGI_ID, 'i-maura', false)), 'si toglie solo un collega segnato da te')
  togli(OGGI_ID, 'i-maura')

  await segnaCollega(OGGI_ID, 'i-maura').catch(() => {})
  const id = righe().find((p) => p.sessioneId === OGGI_ID && p.personaId === 'i-maura')?.id
  await seg.gestisciPresenzaIstruttore(id, false).catch(() => {})
  ok('guardata dalla segreteria: Maurizio non la toglie più', await errore(() => segnaCollega(OGGI_ID, 'i-maura', false)), 'si toglie solo un collega segnato da te')
  ok('resta rifiutata, da collega', di(OGGI_ID, 'i-maura'), 'rifiutata collega true')
}

console.log('\n5. la segreteria segna un previsto su una lezione già coperta')
{
  m.istruttoreDallAppello(COPERTA, 'i-maurizio')
  ok('Maurizio ha fatto l\'appello', di(COPERTA, 'i-maurizio'), 'confermata appello true')
  await prova('la lezione è coperta: fra le senza istruttore non c\'è', async () => (await seg.lezioniSenzaIstruttore()).some((l) => l.sessioneId === COPERTA), false)
  await prova('la segreteria segna Maura: c\'era', () => seg.segnaIstruttorePrevisto(COPERTA, 'i-maura'), undefined)
  ok('Maura confermata dalla segreteria', di(COPERTA, 'i-maura'), 'confermata segreteria true')
  ok('la riga della segreteria sa se la lezione è annullata', (await seg.presenzeIstruttori(365)).find((x) => x.sessioneId === COPERTA)?.annullata ?? false, false)
  ok('decisa dalla segreteria di prova', righe().find((p) => p.sessioneId === COPERTA && p.personaId === 'i-maura')?.gestitaDa, 'Segreteria di prova')
  ok('Maurizio resta dall\'appello', di(COPERTA, 'i-maurizio'), 'confermata appello true')
  ok('Maurizio c\'è già: niente', await errore(() => seg.segnaIstruttorePrevisto(COPERTA, 'i-maurizio')), 'nessun errore')
  ok('e resta com\'era', di(COPERTA, 'i-maurizio'), 'confermata appello true')
  ok('non uno fuori dai previsti', await errore(() => seg.segnaIstruttorePrevisto(COPERTA, 'i-federico')), 'si sceglie fra gli istruttori previsti')
  ok('né su una annullata', await errore(() => seg.segnaIstruttorePrevisto(ANNULLATA, 'i-maura')), 'la lezione è annullata')
  ok('né su una lezione che non c\'è', await errore(() => seg.segnaIstruttorePrevisto('s@niente@2026-09-26@11:30', 'i-maura')), 'lezione inesistente')
}

console.log('\n6. la riga di PRESENZE ISTRUTTORI')
{
  const come = (x) => m.segreteriaLib.comeArrivata(x)
  const tutte = await seg.presenzeIstruttori(365)
  const collega = tutte.find((x) => x.sessioneId === OGGI_ID && x.personaId === 'i-maura')
  ok('la segreteria legge chi l\'ha segnata, per nome', collega && [collega.come, collega.segnataDa], ['collega', 'Maurizio'])
  // Qui segnata e mai guardata dalla segreteria: la si rimette così.
  const daCollega = { ...collega, stato: 'confermata', gestitaIl: undefined, gestitaDa: undefined }
  await prova('segnata da un collega', () => come(daCollega), { come: 'segnata da Maurizio nell’appello', nota: 'da Maurizio: era prevista' })
  const base = { ...collega, segnataDa: undefined, gestitaIl: undefined, gestitaDa: undefined, prevista: true, stato: 'confermata' }
  // Quelle di prima, come le scriveva PresenzeIstruttori.tsx.
  await prova('chi ha fatto l\'appello', () => come({ ...base, come: 'appello' }), { come: 'ha fatto l’appello', nota: 'da sé: appello, era previsto' })
  await prova('col PIN dal tablet di una sala', () => come({ ...base, come: 'pin', sala: 'Lotta' }), { come: 'tablet Lotta', nota: 'da sé: era previsto' })
  await prova('col PIN, sala sconosciuta, non previsto', () => come({ ...base, come: 'pin', sala: undefined, prevista: false, stato: 'da_confermare' }), { come: 'col PIN', nota: '' })
  await prova('scelto in segreteria', () => come({ ...base, come: 'segreteria' }).come, 'scelto in segreteria')
}

{
  const riga = (id, personaId, sessioneId = 's') => ({ id, personaId, sessioneId, previstiElenco: [{ id: 'n', nome: 'Nicola' }, { id: 'g', nome: 'Giulia' }] })
  const tutte = [riga('1', 'n'), riga('2', 'x'), riga('3', 'g', 'altra')]
  const c = (x, viste) => m.segreteriaLib.previstiSenzaPresenza(x, viste, tutte).map((p) => p.id)
  ok('c\'era: Giulia, sulla prima riga della lezione', c(tutte[0], tutte), ['g'])
  ok('non ripetuto sulla seconda', c(tutte[1], tutte), [])
  ok('su un\'altra lezione Nicola manca', c(tutte[2], tutte), ['n'])
  ok('lezione annullata: niente c\'era', m.segreteriaLib.previstiSenzaPresenza({ ...tutte[0], annullata: true }, tutte, tutte), [])
  ok('ordinate al contrario: va sulla prima che si vede', c(tutte[1], [tutte[1], tutte[0]]), ['g'])
  ok('la prima nascosta da un filtro: va sulla seconda, e Nicola resta segnato', c(tutte[1], [tutte[1]]), ['g'])
}

console.log('\n6b. la parte ISTRUTTORI dell\'appello')
{
  const r = (elenco, io) => m.righeIstruttori(elenco, io).map((x) => [x.id, x.tu, x.segnato, x.tocco])
  const nicola = { id: 'n', nome: 'Nicola', stato: 'confermata', come: 'appello' }
  ok('chi non è previsto non la vede', r([nicola, { id: 'g', nome: 'Giulia' }], 'x'), [])
  ok('da solo non serve', r([nicola], 'n'), [])
  ok('Giulia da segnare, tu già segnato', r([nicola, { id: 'g', nome: 'Giulia' }], 'n'), [['n', true, true, null], ['g', false, false, 'segna']])
  ok('segnata da te: si toglie', r([nicola, { id: 'g', nome: 'Giulia', stato: 'confermata', come: 'collega', segnataDa: 'n' }], 'n'), [['n', true, true, null], ['g', false, true, 'togli']])
  ok('col PIN: si guarda', r([nicola, { id: 'g', nome: 'Giulia', stato: 'confermata', come: 'pin' }], 'n'), [['n', true, true, null], ['g', false, true, null]])
  ok('segnata da un altro: si guarda', r([nicola, { id: 'g', nome: 'Giulia', stato: 'confermata', come: 'collega', segnataDa: 'z' }], 'n')[1], ['g', false, true, null])
  ok('appello cominciato: tu hai la ✓ anche prima di rileggere', m.righeIstruttori([{ id: 'n', nome: 'Nicola' }, { id: 'g', nome: 'Giulia' }], 'n', true).map((x) => [x.id, x.segnato]), [['n', true], ['g', false]])
  ok('appello non cominciato: ancora no', m.righeIstruttori([{ id: 'n', nome: 'Nicola' }, { id: 'g', nome: 'Giulia' }], 'n', false)[0].segnato, false)
  ok('tu rifiutato: l\'appello non ti rimette', m.righeIstruttori([{ id: 'n', nome: 'Nicola', stato: 'rifiutata' }, { id: 'g', nome: 'Giulia' }], 'n', true)[0].segnato, false)
  ok('guardata dalla segreteria: non si toglie più', r([nicola, { id: 'g', nome: 'Giulia', stato: 'confermata', come: 'collega', segnataDa: 'n', gestita: true }], 'n')[1], ['g', false, true, null])
  ok('tu rifiutato: si dice', m.righeIstruttori([{ id: 'n', nome: 'Nicola', stato: 'rifiutata' }, { id: 'g', nome: 'Giulia' }], 'n', true)[0].rifiutata, true)
  ok('dopo il primo segno la tua presenza c\'è, anche se poi azzeri', m.conMioAppello([{ id: 'n', nome: 'Nicola' }, { id: 'g', nome: 'Giulia' }], 'n').map((x) => [x.id, x.stato ?? null, x.come ?? null]), [['n', 'confermata', 'appello'], ['g', null, null]])
  ok('una rifiutata resta rifiutata', m.conMioAppello([{ id: 'n', nome: 'Nicola', stato: 'rifiutata', come: 'pin' }], 'n')[0].stato, 'rifiutata')
  ok('rifiutata: non è segnata e non si tocca', r([nicola, { id: 'g', nome: 'Giulia', stato: 'rifiutata', come: 'collega', segnataDa: 'n' }], 'n')[1], ['g', false, false, null])
}

console.log('\n7. col database: la coda delle scritture')
{
  const DOVE = 'ods-corsi:coda'
  const inCoda = () => JSON.parse(memoria.get(DOVE) ?? '[]').map((o) => [o.tipo, ...o.args])
  const attesa = () => new Promise((r) => setTimeout(r, 10))
  const rete = () => (ascoltatori.online ?? []).forEach((f) => f())
  const finto = (risposta) => {
    const chiamate = []
    const db = { rpc: async (nome, args) => (chiamate.push([nome, args]), risposta(nome, args)), from: () => { throw new Error('qui non si legge') } }
    return { db, chiamate }
  }
  const senzaRete = { data: null, error: { code: '', message: 'TypeError: Failed to fetch' } }

  memoria.delete(DOVE)
  let giu = true
  const f = finto(() => (giu ? senzaRete : { data: null, error: null }))
  const d = m.creaDatiSupabase(f.db)
  let scartate = 0
  d.guardaScartate?.((n) => { scartate = n })
  await prova('senza rete il segno resta in coda, come tipo suo', async () => (await d.segnaCollega('s1', 'p2', true), await attesa(), inCoda()), [['collega', 's1', 'p2', true]])
  await prova('segnato e tolto senza rete: una scrittura sola, l\'ultima', async () => (await d.segnaCollega('s1', 'p2', false), await attesa(), inCoda()), [['collega', 's1', 'p2', false]])
  giu = false
  rete()
  await attesa()
  ok('torna la rete: arriva, ed è il togliere', f.chiamate.at(-1), ['togli_collega', { sessione: 's1', persona: 'p2' }])
  ok('la coda è vuota, e niente rifiutato', [inCoda().length, scartate], [0, 0])

  memoria.delete(DOVE)
  const g = finto(() => ({ data: 'gia', error: null }))
  const d2 = m.creaDatiSupabase(g.db)
  let scartate2 = 0
  d2.guardaScartate?.((n) => { scartate2 = n })
  await prova('già segnato col PIN: arriva, e non è una presenza rifiutata', async () => (await d2.segnaCollega('s1', 'p2', true), await attesa(), [g.chiamate.at(-1), inCoda().length, scartate2]), [['segna_collega', { sessione: 's1', persona: 'p2' }], 0, 0])

  memoria.delete(DOVE)
  const h = finto(() => ({ data: null, error: { code: '42501', message: 'segna un collega solo chi insegna questa lezione' } }))
  const d3 = m.creaDatiSupabase(h.db)
  let scartate3 = 0
  d3.guardaScartate?.((n) => { scartate3 = n })
  await prova('un rifiuto vero sì: si dice', async () => (await d3.segnaCollega('s1', 'p2', true), await attesa(), [inCoda().length, scartate3]), [0, 1])

  const rispondi = (data, error = null) => finto(() => ({ data, error })).db
  await prova('gli istruttori della lezione, dal database', async () =>
    (await m.creaDatiSupabase(rispondi([
      { persona_id: 'p1', nome: 'Maura', cognome: 'Uno', stato: 'confermata', come: 'appello', segnata_da: null },
      { persona_id: 'p2', nome: 'Federico', cognome: 'Due', stato: null, come: null, segnata_da: null },
    ])).istruttoriLezione('s1')).map((x) => [x.id, x.nome, x.stato ?? null]),
  [['p1', 'Maura Uno', 'confermata'], ['p2', 'Federico Due', null]])
  await prova('senza il file sul database: nessun istruttore, l\'appello va come prima', async () =>
    m.creaDatiSupabase(rispondi(null, { code: 'PGRST202', message: 'Could not find the function public.istruttori_lezione(sessione) in the schema cache' })).istruttoriLezione('s1'),
  [])
  memoria.delete(DOVE)

  // Riaperto senza rete: il collega in coda si vede segnato, e si toglie ancora.
  memoria.delete(DOVE)
  const elenco = [
    { persona_id: 'p1', nome: 'Maura', cognome: 'Uno', stato: 'confermata', come: 'appello', segnata_da: null },
    { persona_id: 'p2', nome: 'Federico', cognome: 'Due', stato: null, come: null, segnata_da: null },
  ]
  const r = finto((nome) => (nome === 'istruttori_lezione' ? { data: elenco, error: null } : senzaRete))
  const d4 = m.creaDatiSupabase(r.db)
  await d4.segnaCollega('s1', 'p2', true)
  await attesa()
  await prova('segnato senza rete, riaperto: ✓ e si toglie', async () => m.righeIstruttori(await d4.istruttoriLezione('s1'), 'p1').map((x) => [x.id, x.segnato, x.tocco]), [['p1', true, null], ['p2', true, 'togli']])
  await d4.segnaCollega('s1', 'p2', false)
  await attesa()
  await prova('tolto senza rete, riaperto: da segnare', async () => m.righeIstruttori(await d4.istruttoriLezione('s1'), 'p1').map((x) => [x.id, x.segnato, x.tocco]), [['p1', true, null], ['p2', false, 'segna']])
  memoria.delete(DOVE)

  // Un «togli» in coda non nasconde una presenza col PIN: il database lo rifiuterà.
  const conPin = [{ ...elenco[0] }, { persona_id: 'p2', nome: 'Federico', cognome: 'Due', stato: 'confermata', come: 'pin', segnata_da: null }]
  const q = finto((nome) => (nome === 'istruttori_lezione' ? { data: conPin, error: null } : senzaRete))
  const d5 = m.creaDatiSupabase(q.db)
  await d5.segnaCollega('s1', 'p2', false)
  await attesa()
  await prova('togli in coda su uno col PIN: resta col PIN', async () => (await d5.istruttoriLezione('s1')).map((x) => [x.id, x.stato ?? null, x.come ?? null]), [['p1', 'confermata', 'appello'], ['p2', 'confermata', 'pin']])
  memoria.delete(DOVE)

  const s = finto(() => ({ data: 'segnata', error: null }))
  await prova('la segreteria chiama la sua funzione', async () => (await m.creaSegreteriaSupabase(s.db).segnaIstruttorePrevisto('s1', 'p2'), s.chiamate.at(-1)), ['segna_istruttore_previsto', { sessione: 's1', persona: 'p2' }])
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
