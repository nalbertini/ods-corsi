// ---------------------------------------------------------------------------
// Le prove, senza browser: il doppio turno (`src/lib/turni.ts`).
//
//   node scripts/prova-turni.mjs
//
// Un corso con due lezioni lo stesso giorno: chi è presente a una non si segna
// nell'altra, né presente né assente. Nei conti il giorno vale una lezione sola.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/turni'; export { conto, chiSiStaPerdendo } from './src/lib/frequenza'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// Martedì 10 novembre 2026: Judo kids alle 17:30 (A) e alle 18:30 (B), ora di Roma (UTC+1).
const A = { id: 'A', corsoId: 'judo', inizio: '2026-11-10T16:30:00Z', stato: 'prevista' }
const B = { id: 'B', corsoId: 'judo', inizio: '2026-11-10T17:30:00Z', stato: 'prevista' }
const C = { id: 'C', corsoId: 'judo', inizio: '2026-11-10T18:30:00Z', stato: 'prevista' }
const altroGiorno = { id: 'D', corsoId: 'judo', inizio: '2026-11-11T16:30:00Z', stato: 'prevista' }
const altroCorso = { id: 'E', corsoId: 'lotta', inizio: '2026-11-10T16:30:00Z', stato: 'prevista' }
const p = (sessioneId, personaId, stato) => ({ sessioneId, personaId, stato })

console.log('presentiAltrove')
{
  const altrove = m.presentiAltrove(B, [A, B, C, altroGiorno, altroCorso], [
    p('A', 'giulia', 'presente'), p('A', 'luca', 'assente'), p('A', 'sara', 'giustificato'),
    p('D', 'marco', 'presente'), p('E', 'anna', 'presente'), p('B', 'piero', 'presente'), p('A', 'piero', 'presente'),
  ])
  ok('presente a A: in B sta altrove, con l\'ora di A', Object.fromEntries(altrove), { giulia: A.inizio })
  ok('assente o giustificato a A non conta, un altro giorno o un altro corso nemmeno', ['luca', 'sara', 'marco', 'anna'].some((x) => altrove.has(x)), false)
  ok('presente anche qui: resta nell\'appello di B', altrove.has('piero'), false)
}
{
  const annullata = { ...A, stato: 'annullata' }
  ok('una lezione annullata non è un turno', m.presentiAltrove(B, [annullata, B], [p('A', 'giulia', 'presente')]).size, 0)
  ok('tre turni: presente a C, fuori da A', [...m.presentiAltrove(A, [A, B, C], [p('C', 'giulia', 'presente')]).keys()], ['giulia'])
  ok('a mezzanotte cambia il giorno di Roma, non quello di UTC', m.presentiAltrove(
    { id: 'tardi', corsoId: 'judo', inizio: '2026-11-10T23:30:00Z', stato: 'prevista' },
    [{ id: 'sera', corsoId: 'judo', inizio: '2026-11-10T22:30:00Z', stato: 'prevista' }],
    [p('sera', 'giulia', 'presente')],
  ).size, 0)
}

console.log('togliAltrove (il registro, una riga per lezione)')
{
  const riga = (s, appello) => ({ ...s, sessioneId: s.id, corso: 'Judo kids', appello })
  const io = (personaId, stato) => ({ personaId, nome: personaId, cognome: 'X', stato })
  const righe = m.togliAltrove([
    riga(A, [io('giulia', 'presente'), io('luca', 'assente'), io('sara', null)]),
    riga(B, [io('giulia', null), io('luca', 'presente'), io('sara', null)]),
  ])
  ok('in A resta Giulia, Luca (presente a B) esce anche se era ASSENTE', righe[0].appello.map((x) => x.personaId), ['giulia', 'sara'])
  ok('in B Giulia (presente a A) esce', righe[1].appello.map((x) => x.personaId), ['luca', 'sara'])
  ok('le righe non cambiano di numero né di ordine', righe.map((r) => r.id), ['A', 'B'])
}

console.log('conti: il giorno vale una lezione sola')
{
  const riga = (s, appello) => ({ ...s, corso: 'Judo kids', appello: appello.map(([personaId, stato]) => ({ personaId, nome: personaId, cognome: 'X', stato })) })
  const giorno = [
    riga(A, [['giulia', 'presente'], ['luca', 'assente'], ['sara', 'assente'], ['ugo', 'giustificato']]),
    riga(B, [['giulia', null], ['luca', 'presente'], ['sara', null], ['ugo', 'assente']]),
  ]
  // Giulia presente (A), Luca presente (B, l'assenza di A si ignora), Sara assente una volta, Ugo giustificato non conta.
  ok('conto: 2 presenti su 3 dovute', m.conto(giorno), { presenti: 2, dovute: 3 })
  ok('unisciTurni: una riga per corso e giorno', m.unisciTurni(giorno).length, 1)
  const senzaAppelloB = [giorno[0], riga(B, [['giulia', null], ['luca', null], ['sara', null], ['ugo', null]])]
  ok('un turno senza appello non aggiunge assenze', m.conto(senzaAppelloB), { presenti: 1, dovute: 3 })
  const annullataB = [giorno[0], { ...riga(B, [['luca', 'presente']]), stato: 'annullata' }]
  ok('un turno annullato non conta', m.conto(annullataB), { presenti: 1, dovute: 3 })
  // Tre giorni di fila con Sara assente a tutti e due i turni: tre assenze, non sei.
  const giorni = [10, 12, 14].flatMap((g) => [
    riga({ ...A, id: `A${g}`, inizio: `2026-11-${g}T16:30:00Z` }, [['sara', 'assente']]),
    riga({ ...B, id: `B${g}`, inizio: `2026-11-${g}T17:30:00Z` }, [['sara', 'assente']]),
  ])
  ok('chi si sta perdendo: tre assenze di fila, non sei', m.chiSiStaPerdendo(giorni).map((x) => x.fila), [3])
  const venuta = [...giorni, riga({ ...B, id: 'B16', inizio: '2026-11-16T17:30:00Z' }, [['sara', 'presente']]), riga({ ...A, id: 'A16', inizio: '2026-11-16T16:30:00Z' }, [['sara', 'assente']])]
  ok('presente al secondo turno: la fila si spezza anche se al primo era ASSENTE', m.chiSiStaPerdendo(venuta).length, 0)
}

console.log('modalità prova: Psicomotricità, venerdì 6 novembre alle 17:00 (A) e alle 18:10 (B)')
{
  const { outputFiles: f } = await build({
    stdin: {
      contents: "export { creaDatiProva } from './src/lib/datiProva'; export { creaTabletProva } from './src/lib/tabletProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaIscrittoProva } from './src/lib/iscrittoProva'; export { memoria } from './src/lib/datiProva'",
      resolveDir: '.',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'error',
    define: { 'import.meta.env': '{}' },
  })
  const archivio = new Map()
  globalThis.localStorage = { getItem: (k) => (archivio.has(k) ? archivio.get(k) : null), setItem: (k, v) => archivio.set(k, String(v)), removeItem: (k) => archivio.delete(k) }
  globalThis.window = { location: { search: '', hash: '', pathname: '/' }, addEventListener() {} }
  const p = await import('data:text/javascript;base64,' + Buffer.from(f[0].text).toString('base64'))
  const dati = p.creaDatiProva()
  const A = 's@psicomotricita@2026-11-06@17:00'
  const B = 's@psicomotricita@2026-11-06@18:10'
  const iscritti = (await dati.dettaglio(A)).elenco.filter((x) => !x.prova).map((x) => x.id)
  const [x, y] = iscritti
  await dati.segna(A, x, 'presente')
  await dati.segna(A, y, 'assente')
  await dati.segna(B, y, 'presente')
  const b = await dati.dettaglio(B)
  ok('in B chi è presente ad A non è nell\'elenco', b.elenco.some((q) => q.id === x), false)
  ok('in B è fra gli altrove, con l\'ora di A', b.altrove.filter((q) => q.id === x).map((q) => q.inizio), [(await dati.dettaglio(A)).sessione.inizio])
  ok('i conti di B non lo contano', b.sessione.iscritti, iscritti.length - 1)
  await dati.segnaTutti(A, 'presente')
  ok('TUTTI PRESENTI in A: l\'ASSENTE di chi è presente in B resta salvato', p.memoria.segnate[A][y], 'assente')
  ok('e in A non è nell\'elenco', (await dati.dettaglio(A)).elenco.some((q) => q.id === y), false)
  const freq = await p.creaSegreteriaProva().frequenze()
  ok('frequenze: una presenza sola per chi è venuto ad A, e per chi è venuto a B', [freq.get(x)?.presenti, freq.get(y)?.presenti], [1, 1])
  await dati.segna(B, y, null)
  ok('tolta la presenza da B, in A torna ASSENTE', (await dati.dettaglio(A)).elenco.find((q) => q.id === y)?.stato, 'assente')
  window.location.search = '?adesso=2026-11-06T19:20:00'
  const tablet = p.creaTabletProva()
  await tablet.scegliSala('Motricità')
  ok('tablet: il tocco in B di chi è presente ad A', await tablet.segna(B, x), 'altro_turno')
  ok('e non scrive', p.memoria.segnate[B]?.[x], undefined)
  ok('tablet: l\'elenco di B non lo ha', (await tablet.elenco(B)).some((q) => q.personaId === x), false)
}

if (guai) {
  console.log(`\n${guai} prova/e fallita/e`)
  process.exit(1)
}
console.log('\nTutto a posto')
