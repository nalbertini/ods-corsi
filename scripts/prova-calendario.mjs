// ---------------------------------------------------------------------------
// Le prove, senza browser: il calendario della SETTIMANA (toccando le date si
// apre il mese, un quadratino sui giorni con lezioni, si salta a un'altra
// settimana).
//
//   node scripts/prova-calendario.mjs
//
// I giorni sono sempre giorni di calendario locale (Europe/Rome), mai
// «24 ore dopo»: nei due cambi d'ora un giorno dura 23 o 25 ore.
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

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/calendarioSettimana'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { chiaveGiorno } from './src/lib/sala'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'", resolveDir: '.', loader: 'ts' },
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

const g = (a, mese, giorno) => new Date(a, mese - 1, giorno) // mese 1-12, mezzanotte locale
const chiavi = (ds) => ds.map((d) => m.chiaveGiorno(d))

console.log('I titoli')
ok('12 – 18 OTTOBRE', m.titoloSettimana(g(2026, 10, 12)), '12 – 18 OTTOBRE')
ok('28 SET – 4 OTTOBRE a cavallo di mese', m.titoloSettimana(g(2026, 9, 28)), '28 SET – 4 OTTOBRE')
ok('a cavallo d\'anno: 28 DIC – 3 GENNAIO', m.titoloSettimana(g(2026, 12, 28)), '28 DIC – 3 GENNAIO')
ok('la versione per chi non vede: minuscolo e invito', m.nomeTitoloSettimana(g(2026, 10, 12)), "12 – 18 ottobre: scegli un'altra data")
ok('la versione per chi non vede, a cavallo di mese', m.nomeTitoloSettimana(g(2026, 9, 28)), "28 set – 4 ottobre: scegli un'altra data")

console.log('\nSabato e domenica senza lezioni')
{
  const sett = m.giorniDellaSettimana(g(2026, 10, 12))
  const alle = (giorno, ora = 17) => new Date(2026, 9, giorno, ora).toISOString()
  ok('solo feriali: sabato e domenica si stringono', m.giorniStretti(sett, [alle(12), alle(14)]), [false, false, false, false, false, true, true])
  ok('una lezione di sabato: sabato resta largo, domenica no', m.giorniStretti(sett, [alle(12), alle(17)]), [false, false, false, false, false, false, true])
  ok('una lezione di domenica: domenica resta larga', m.giorniStretti(sett, [alle(18, 23)]), [false, false, false, false, false, true, false])
  ok('un giorno feriale vuoto non si stringe mai', m.giorniStretti(sett, [alle(17)])[2], false)
  ok('settimana ancora da leggere: niente si stringe', m.giorniStretti(sett, null), [false, false, false, false, false, false, false])
  ok('una gara di sabato: sabato resta largo, per la sua tessera', m.giorniStretti(sett, [alle(12)], ['2026-10-17']), [false, false, false, false, false, false, true])
}

console.log('\nI giorni della settimana')
ok('19/10/2026 (cambio d\'ora del 25): sette consecutivi', chiavi(m.giorniDellaSettimana(g(2026, 10, 19))), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
ok('23/3/2026 (cambio d\'ora del 29): sette consecutivi', chiavi(m.giorniDellaSettimana(g(2026, 3, 23))), ['2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29'])
ok('28/12/2026: passa l\'anno', chiavi(m.giorniDellaSettimana(g(2026, 12, 28))), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
ok('ogni giorno è a mezzanotte locale', m.giorniDellaSettimana(g(2026, 10, 19)).every((d) => d.getHours() === 0 && d.getMinutes() === 0), true)

console.log('\nIl mese mostrato all\'apertura (quello del giovedì)')
const mese = (a, me, gi) => m.meseDellaSettimana(g(a, me, gi))
ok('28/9/2026: il giovedì è 1 ottobre → ottobre', mese(2026, 9, 28), { anno: 2026, mese: 9 })
ok('12/10/2026 → ottobre', mese(2026, 10, 12), { anno: 2026, mese: 9 })
ok('28/12/2026: il giovedì è 31 dicembre → dicembre', mese(2026, 12, 28), { anno: 2026, mese: 11 })
ok('29/12/2025: il giovedì è 1 gennaio → gennaio 2026', mese(2025, 12, 29), { anno: 2026, mese: 0 })
ok('30/3/2026: il giovedì è 2 aprile → aprile', mese(2026, 3, 30), { anno: 2026, mese: 3 })
ok('26/10/2026: il giovedì è 29 ottobre → ottobre', mese(2026, 10, 26), { anno: 2026, mese: 9 })

console.log('\nLe frecce del mese')
ok('dicembre + 1 → gennaio dell\'anno dopo', m.mesePrimaDopo({ anno: 2026, mese: 11 }, 1), { anno: 2027, mese: 0 })
ok('gennaio − 1 → dicembre dell\'anno prima', m.mesePrimaDopo({ anno: 2027, mese: 0 }, -1), { anno: 2026, mese: 11 })
ok('ottobre + 1 → novembre, stesso anno', m.mesePrimaDopo({ anno: 2026, mese: 9 }, 1), { anno: 2026, mese: 10 })
ok('marzo − 1 → febbraio, stesso anno', m.mesePrimaDopo({ anno: 2026, mese: 2 }, -1), { anno: 2026, mese: 1 })
ok('nomeMese', m.nomeMese({ anno: 2026, mese: 9 }), 'OTTOBRE 2026')
ok('nomeMese: gennaio', m.nomeMese({ anno: 2027, mese: 0 }), 'GENNAIO 2027')

console.log('\nLa griglia del mese')
const OGGI = g(2026, 10, 16)
const griglia = (a, me, lun = g(2026, 10, 12), set = null) => m.grigliaDelMese({ anno: a, mese: me - 1 }, lun, OGGI, set)
const piatta = (gr) => gr.flat()
for (const [nome, a, me, giorni, primo] of [
  ['febbraio 2027 (28 giorni, comincia di lunedì)', 2027, 2, 28, '2027-02-01'],
  ['febbraio 2026 (comincia di domenica)', 2026, 2, 28, '2026-01-26'],
  ['febbraio 2028 (bisestile)', 2028, 2, 29, '2028-01-31'],
  ['ottobre 2026', 2026, 10, 31, '2026-09-28'],
  ['aprile 2026 (30 giorni)', 2026, 4, 30, '2026-03-30'],
]) {
  const gr = griglia(a, me)
  const celle = piatta(gr)
  ok(`${nome}: 6 righe da 7`, [gr.length, gr.every((r) => r.length === 7)], [6, true])
  ok(`${nome}: la prima cella è ${primo}, un lunedì`, [celle[0].chiave, new Date(celle[0].chiave + 'T12:00').getDay()], [primo, 1])
  const attese = chiavi(Array.from({ length: 42 }, (_, i) => g(Number(primo.slice(0, 4)), Number(primo.slice(5, 7)), Number(primo.slice(8)) + i)))
  ok(`${nome}: 42 giorni consecutivi, senza buchi né doppioni`, celle.map((c) => c.chiave), attese)
  ok(`${nome}: i giorni del mese sono ${giorni}`, celle.filter((c) => c.delMese).length, giorni)
  ok(`${nome}: i giorni del mese sono quelli giusti`, celle.filter((c) => c.delMese).map((c) => c.giorno), Array.from({ length: giorni }, (_, i) => i + 1))
}

console.log('\nLa settimana evidenziata')
{
  const celle = piatta(griglia(2026, 10, g(2026, 9, 28)))
  const sel = celle.filter((c) => c.dellaSettimana)
  ok('28 set–4 ott in ottobre: sette celle evidenziate', sel.map((c) => c.chiave), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
  ok('…di cui tre fuori mese', sel.filter((c) => !c.delMese).length, 3)
  const dic = piatta(griglia(2026, 12, g(2026, 12, 28))).filter((c) => c.dellaSettimana)
  const gen = piatta(griglia(2027, 1, g(2026, 12, 28))).filter((c) => c.dellaSettimana)
  ok('28 dic 2026–3 gen 2027 in dicembre: sette celle', dic.map((c) => c.chiave), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
  ok('28 dic 2026–3 gen 2027 in gennaio: le stesse sette', gen.map((c) => c.chiave), dic.map((c) => c.chiave))
  ok('una settimana lontana non evidenzia niente', piatta(griglia(2026, 2, g(2026, 10, 12))).some((c) => c.dellaSettimana), false)
}

console.log('\nOggi')
{
  const o = piatta(griglia(2026, 10)).filter((c) => c.oggi)
  ok('una sola cella è oggi, il 16 ottobre', o.map((c) => c.chiave), ['2026-10-16'])
  ok('oggi fuori dal mese mostrato: nessuna cella', piatta(griglia(2026, 2)).some((c) => c.oggi), false)
  ok('oggi a fine mese si vede anche nel mese dopo se rientra in griglia', piatta(m.grigliaDelMese({ anno: 2026, mese: 10 }, g(2026, 10, 12), g(2026, 10, 31), null)).filter((c) => c.oggi).map((c) => c.chiave), ['2026-10-31'])
}

console.log('\nI quadratini «ha lezioni»')
{
  const conL = (set) => piatta(griglia(2026, 10, g(2026, 10, 12), set)).filter((c) => c.conLezioni).map((c) => c.chiave)
  ok('non si sa (null): nessun quadratino', conL(null), [])
  ok('letto e vuoto: nessun quadratino', conL(new Set()), [])
  ok('con chiavi: solo quelle celle', conL(new Set(['2026-10-13', '2026-10-20'])), ['2026-10-13', '2026-10-20'])
  ok('anche fuori mese (1 novembre in griglia di ottobre)', conL(new Set(['2026-11-01', '2026-09-28'])), ['2026-09-28', '2026-11-01'])
  ok('una chiave fuori dalla griglia non fa niente', conL(new Set(['2030-01-01'])), [])
}

console.log('\nLa finestra da leggere')
{
  const f = m.finestraDelMese({ anno: 2026, mese: 9 })
  ok('ottobre 2026: da lunedì 28/9 a domenica 8/11, a mezzanotte locale', [m.chiaveGiorno(f.da), f.da.getHours(), m.chiaveGiorno(f.a), f.a.getHours(), f.a.getMinutes()], ['2026-09-28', 0, '2026-11-08', 0, 0])
  const f2 = m.finestraDelMese({ anno: 2026, mese: 1 })
  ok('febbraio 2026: da 26/1 a 8/3', [m.chiaveGiorno(f2.da), m.chiaveGiorno(f2.a)], ['2026-01-26', '2026-03-08'])
  const celle = piatta(griglia(2026, 10))
  ok('coincide con la prima e l\'ultima cella della griglia', [celle[0].chiave, celle[41].chiave], [m.chiaveGiorno(f.da), m.chiaveGiorno(f.a)])
}

console.log('\nDagli istanti ai giorni locali')
ok('23:30 locali di sabato 24/10/2026 (21:30Z) è il 24', [...m.giorniConLezioni(['2026-10-24T21:30:00Z'])], ['2026-10-24'])
ok('00:30 locali di domenica 25/10 (22:30Z di sabato) è il 25', [...m.giorniConLezioni(['2026-10-24T22:30:00Z'])], ['2026-10-25'])
ok('due lezioni nello stesso giorno fanno una chiave', [...m.giorniConLezioni(['2026-10-13T07:00:00Z', '2026-10-13T17:00:00Z'])], ['2026-10-13'])
ok('nessuna lezione: insieme vuoto', m.giorniConLezioni([]).size, 0)
ok('inverno: 23:30Z di sabato 14/11 è già domenica 15', [...m.giorniConLezioni(['2026-11-14T23:30:00Z'])], ['2026-11-15'])

console.log('\nOltre il calendario')
ok('dopo l\'ultima lezione creata: vero', m.oltreIlCalendario('2026-07-01', '2026-06-30'), true)
ok('proprio l\'ultimo giorno: falso', m.oltreIlCalendario('2026-06-30', '2026-06-30'), false)
ok('prima: falso', m.oltreIlCalendario('2026-06-29', '2026-06-30'), false)
ok('non si sa (null): falso', m.oltreIlCalendario('2030-01-01', null), false)

console.log('\nScegliere un giorno')
{
  const posto = { voce: 'settimana', sala: 's-2', settimana: '2026-10-05', lezione: { id: 'x', inizio: '2026-10-06T10:00:00Z' } }
  const copia = JSON.stringify(posto)
  const dopo = (dd) => m.postoDopoIlGiorno(posto, dd)
  ok('martedì 13/10/2026 → settimana 2026-10-12', dopo(g(2026, 10, 13)).settimana, '2026-10-12')
  ok('domenica 25/10/2026 → 2026-10-19 (non la settimana dopo)', dopo(g(2026, 10, 25)).settimana, '2026-10-19')
  ok('domenica 1/11/2026 → 2026-10-26', dopo(g(2026, 11, 1)).settimana, '2026-10-26')
  ok('lunedì 12/10/2026 → se stesso', dopo(g(2026, 10, 12)).settimana, '2026-10-12')
  ok('la lezione aperta si toglie dal posto', dopo(g(2026, 10, 13)).lezione, undefined)
  ok('sala e voce restano', [dopo(g(2026, 10, 13)).sala, dopo(g(2026, 10, 13)).voce], ['s-2', 'settimana'])
  ok('l\'ingresso non è mutato', JSON.stringify(posto), copia)
  ok('senza lezione aperta funziona lo stesso', m.postoDopoIlGiorno({ voce: 'settimana' }, g(2026, 10, 13)).settimana, '2026-10-12')
}

console.log('\nIl metodo giorniConLezioni della segreteria di prova')
{
  const s = m.creaSegreteriaProva()
  const da = g(2026, 10, 12)
  const a = g(2026, 10, 18)
  const inizi = (ls) => [...new Set(ls.map((l) => m.chiaveGiorno(new Date(l.inizio))))].sort()
  const letti = async (x, y) => [...(await s.giorniConLezioni(x, y))].sort()
  const lez = await s.settimana(da, a)
  ok('la settimana di prova ha lezioni su cui confrontare', lez.length > 0, true)
  ok('stessi giorni di settimana(da, a)', await letti(da, a), inizi(lez))
  ok('un periodo senza lezioni dà []', await s.giorniConLezioni(g(2000, 1, 3), g(2000, 1, 9)), [])
  // Una straordinaria in un giorno senza lezioni e una lezione annullata: contano tutte e due.
  const corsi = await s.corsi()
  await s.straordinaria(corsi[0].id, new Date(2026, 9, 17, 21, 0), 60)
  const dopo = await s.settimana(da, a)
  ok('con una straordinaria: coincide ancora, e c\'è il suo giorno', [await letti(da, a), (await letti(da, a)).includes('2026-10-17')], [inizi(dopo), true])
  const primaDelloStop = (await letti(da, a)).length
  const una = dopo.find((l) => l.stato !== 'annullata')
  await s.aggiornaLezione(una.id, { stato: 'annullata' })
  ok('una lezione annullata conta ancora', [(await letti(da, a)).length, await letti(da, a)], [primaDelloStop, inizi(await s.settimana(da, a))])
}
console.log('\nIl metodo giorniConLezioni della segreteria col database (client finto)')
{
  // Il finto registra la catena di chiamate e annota tutto quel che scrive:
  // il calendario si apre spesso e non deve toccare il database (né `allunga_calendario`).
  // Si annota invece di lanciare: una scrittura di troppo deve dare un ✗ chiaro, non un crollo dello script.
  const finto = (righe, errore = null) => {
    const chiamate = []
    const scritture = []
    const scrive = (nome) => () => (scritture.push(nome), Promise.resolve({ data: null, error: null }))
    const costruisci = (tabella) => {
      const q = {}
      for (const f of ['select', 'gte', 'lte', 'order']) q[f] = (...a) => (chiamate.push([f, ...a]), q)
      q.range = async (prima, ultima) => (chiamate.push(['range', prima, ultima]), errore ? { data: null, error: errore } : { data: righe.slice(prima, ultima + 1), error: null })
      for (const f of ['insert', 'update', 'upsert', 'delete']) q[f] = scrive(`${tabella}.${f}`)
      return q
    }
    const db = { from: (t) => (chiamate.push(['from', t]), costruisci(t)), rpc: scrive('rpc') }
    return { chiamate, scritture, seg: m.creaSegreteriaSupabase(db) }
  }
  const da = g(2026, 10, 12)
  const a = g(2026, 10, 18)

  // (1) La stessa finestra di `settimana`, e solo la colonna `inizio`.
  const f1 = finto([{ inizio: '2026-10-13T07:00:00.000Z' }])
  await f1.seg.giorniConLezioni(da, a)
  // La catena si ripete a ogni pagina: si guarda la prima, i `range` si guardano tutti.
  const prima = f1.chiamate.slice(0, f1.chiamate.findIndex((c) => c[0] === 'range') + 1)
  const nomi = (f) => (f === 'range' ? f1.chiamate : prima).filter((c) => c[0] === f)
  ok('legge dalla tabella sessioni', nomi('from').map((c) => c[1]), ['sessioni'])
  ok('legge solo la colonna inizio', nomi('select').map((c) => c.slice(1)), [['inizio']])
  ok('da: dall\'inizio del primo giorno', nomi('gte').map((c) => c.slice(1)), [['inizio', da.toISOString()]])
  ok('fino alle 23:59:59.999 locali dell\'ultimo giorno', nomi('lte').map((c) => c.slice(1)), [['inizio', new Date(2026, 9, 18, 23, 59, 59, 999).toISOString()]])
  ok('ordinate per inizio (poi id), così le pagine non si accavallano', nomi('order').map((c) => c[1]), ['inizio', 'id'])
  ok('a pagine di 1000, finché una è vuota', nomi('range').map((c) => c.slice(1)), [[0, 999], [1, 1000]])

  // (2) Giorni locali, una chiave per giorno, tutte le pagine.
  const f2 = finto([{ inizio: '2026-10-24T22:30:00.000Z' }, { inizio: '2026-10-13T07:00:00.000Z' }, { inizio: '2026-10-13T17:00:00.000Z' }])
  ok('00:30 locali del 25 è il 25; due lezioni nello stesso giorno, una chiave', (await f2.seg.giorniConLezioni(da, a)).sort(), ['2026-10-13', '2026-10-25'])
  const molte = Array.from({ length: 1199 }, (_, i) => ({ inizio: new Date(Date.UTC(2026, 9, 13, 8) + i * 1000).toISOString() }))
  molte.push({ inizio: '2026-10-16T09:00:00.000Z' }) // sta nella seconda pagina
  ok('con più pagine legge anche la seconda', (await finto(molte).seg.giorniConLezioni(da, a)).sort(), ['2026-10-13', '2026-10-16'])
  ok('nessuna lezione: elenco vuoto', await finto([]).seg.giorniConLezioni(da, a), [])

  // (3) Né rpc (`allunga_calendario`) né scritture, nemmeno per la prima apertura.
  const f3 = finto([{ inizio: '2026-10-13T07:00:00.000Z' }])
  await f3.seg.giorniConLezioni(da, a)
  ok('non scrive e non chiama rpc', f3.scritture, [])

  // (4) Un errore non è «nessuna lezione»: sarebbe un calendario vuoto detto a chi non lo sa.
  let rifiutata = false
  await finto([], { message: 'rete assente' }).seg.giorniConLezioni(da, a).catch(() => { rifiutata = true })
  ok('un errore del database rifiuta la promessa', rifiutata, true)
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
