// ---------------------------------------------------------------------------
// L'area degli iscritti, senza browser: ognuno vede solo il suo.
//
//   node scripts/prova-iscritti.mjs
//
// Il pilota c'è solo in prova (vedi `src/lib/iscritto.ts`): qui si prova che
// legge quello che fanno la segreteria e l'appello — una lezione annullata,
// un sostituto, una sala cambiata, una presenza, una ricevuta — e che di un
// altro iscritto non vede niente. In fondo gli avvisi in cima alla pagina e
// le ricevute degli esempi.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaIscrittoProva } from './src/lib/iscrittoProva'; export { avvisi, contoPresenze } from './src/lib/iscritto'; export { creaDatiProva } from './src/lib/datiProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { archivio } from './src/lib/archivioProva'; export { seminaEsempi } from './src/lib/esempiProva'; export { ENTE_PREDEFINITO } from './src/lib/ricevute'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  // Senza Vite `import.meta.env` non c'è: vuoto vuol dire «modalità prova».
  define: { 'import.meta.env': '{}' },
})
const modulo = 'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const m = await import(modulo)
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const g = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const oggi = new Date()
oggi.setHours(0, 0, 0, 0)
const fra = (n) => new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + n)

const io = m.creaIscrittoProva()
const s = m.creaSegreteriaProva()
const d = m.creaDatiProva()

// Uno di Lotta 2 (lunedì, mercoledì e venerdì alle 17, sala Lotta) che non fa Lotta 3.
const iscrizioni = m.archivio.dati.iscrizioni
const di = (corso) => new Set(iscrizioni.filter((i) => i.corsoId === corso).map((i) => i.personaId))
const lotta2 = di('lotta-2')
const lotta3 = di('lotta-3')
const chi = [...lotta2].find((id) => !lotta3.has(id))
const altro = [...lotta3].find((id) => !lotta2.has(id))

console.log('\n1. chi si può essere, e la scheda')
{
  const tutti = await io.iscritti()
  ok('solo iscritti, niente istruttori né segreteria', tutti.every((p) => p.id.startsWith('p-')), true)
  ok('in ordine di cognome', tutti.map((p) => p.cognome).join() === [...tutti.map((p) => p.cognome)].sort((a, b) => a.localeCompare(b, 'it')).join(), true)
  const sc = await io.scheda(chi)
  ok('fra i suoi corsi c’è Lotta 2, non Lotta 3', [sc.corsi.some((c) => c.id === 'lotta-2'), sc.corsi.some((c) => c.id === 'lotta-3')], [true, false])
  ok('un istruttore non ha una scheda da iscritto', await io.scheda('i-maurizio'), null)
  await s.attivaPersona(altro, false)
  ok('chi è stato tolto dagli attivi nemmeno', [await io.scheda(altro), (await io.lezioni(altro, fra(0), fra(14))).length], [null, 0])
  await s.attivaPersona(altro, true)
}

console.log('\n2. le prossime lezioni, con quello che cambia')
{
  const prima = await io.lezioni(chi, fra(1), fra(14))
  const suoi = (await io.scheda(chi)).corsi.map((c) => c.nome)
  ok('solo dei suoi corsi', prima.length > 0 && prima.every((l) => suoi.includes(l.corso)), true)
  ok('nessuna lezione di Lotta 3', prima.some((l) => l.corso === 'Lotta 3'), false)
  const [a, b, c] = prima.filter((l) => l.corso === 'Lotta 2')
  await s.aggiornaLezione(a.id, { stato: 'annullata' })
  await s.aggiornaLezione(b.id, { sostitutoId: 'i-manuel' })
  await s.aggiornaLezione(c.id, { salaId: 'Tatami' })
  const dopo = await io.lezioni(chi, fra(1), fra(14))
  const x = (id) => dopo.find((l) => l.id === id)
  ok('annullata', x(a.id).stato, 'annullata')
  ok('col sostituto, e il suo nome', [x(b.id).sostituto, x(b.id).istruttore], [true, 'Manuel'])
  ok('in un’altra sala', [x(c.id).altraSala, x(c.id).sala], [true, 'Tatami'])
  ok('le altre come sempre', dopo.filter((l) => ![a.id, b.id, c.id].includes(l.id)).every((l) => l.stato === 'prevista' && !l.sostituto && !l.altraSala), true)
  await s.termina(chi, 'lotta-2')
  ok('chi smette non vede più le lezioni future del corso', (await io.lezioni(chi, fra(1), fra(14))).some((l) => l.corso === 'Lotta 2'), false)
  await s.iscrivi(chi, 'lotta-2')
}

console.log('\n3. le presenze, dalla più recente')
{
  const passate = await io.presenze(chi, 30)
  ok('ci sono lezioni passate', passate.length > 0, true)
  ok('dalla più recente', passate.every((p, i) => i === 0 || passate[i - 1].inizio >= p.inizio), true)
  const [ultima, penultima] = passate.filter((p) => p.corso === 'Lotta 2')
  await d.segna(ultima.sessioneId, chi, 'presente')
  await d.segna(penultima.sessioneId, chi, 'giustificato')
  const ora = await io.presenze(chi, 30)
  ok('il segno dell’appello arriva qui', [ora.find((p) => p.sessioneId === ultima.sessioneId).stato, ora.find((p) => p.sessioneId === penultima.sessioneId).stato], ['presente', 'giustificato'])
  const c = m.contoPresenze(ora)
  ok('le giustificate non contano', c.dovute, ora.filter((p) => p.stato !== 'giustificato').length)
  ok('e le annullate non ci sono', (await s.registro(fra(-30), fra(0))).filter((r) => r.stato === 'annullata').some((r) => ora.some((p) => p.sessioneId === r.sessioneId)), false)
  ok('l’appello di un altro non si vede', (await io.presenze(chi, 30)).some((p) => p.corso === 'Lotta 3'), false)
}

console.log('\n4. le ricevute, solo le sue')
{
  const voce = { descrizione: 'QUOTA ASSOCIATIVA', quantita: 1, prezzo: 3000, pagamenti: [{ data: g(oggi), importo: 3000, metodo: 'Contanti' }] }
  const r = await s.emettiRicevuta({ data: g(oggi), personaId: chi, ente: m.ENTE_PREDEFINITO, intestatario: { nome: 'A', cognome: 'B' }, voci: [voce], anticipo: 0 })
  ok('la vede chi ha pagato', (await io.ricevute(chi)).map((x) => x.id), [r.id])
  ok('non un altro', (await io.ricevute(altro)).some((x) => x.id === r.id), false)
  await s.annullaRicevuta(r.id)
  ok('annullata, resta e lo dice', !!(await io.ricevute(chi))[0].annullataIl, true)
}

console.log('\n5. gli avvisi in cima')
{
  const t = (certificato, pagamento) => m.avvisi({ certificato, pagamento }, '2026-10-02').map((a) => a.tono)
  ok('in regola: niente', t({ scade: '2027-06-01', conFile: true }, { stato: 'pagato' }), [])
  ok('certificato che manca: guaio', t({ conFile: false }, { stato: 'pagato' }), ['guaio'])
  ok('senza il file è come se mancasse', t({ scade: '2027-06-01', conFile: false }, { stato: 'pagato' }), ['guaio'])
  ok('che scade entro un mese: avviso', t({ scade: '2026-10-20', conFile: true }, { stato: 'pagato' }), ['avviso'])
  ok('scaduto e da pagare: due guai', t({ scade: '2026-09-01', conFile: true }, { stato: 'da_pagare' }), ['guaio', 'guaio'])
  ok('pagato in parte: avviso', t({ scade: '2027-06-01', conFile: true }, { stato: 'in_parte' }), ['avviso'])
  ok('pagato fino a ieri: guaio', t({ scade: '2027-06-01', conFile: true }, { stato: 'pagato', fino: '2026-10-01' }), ['guaio'])
}

console.log('\n6. le ricevute degli esempi')
{
  const prima = (m.archivio.dati.ricevute ?? []).length
  m.seminaEsempi()
  const tutte = m.archivio.dati.ricevute
  const esempi = tutte.filter((r) => r.id.startsWith('r-esempio-'))
  const paganti = m.archivio.dati.persone.filter((p) => p.ruolo === 'iscritto' && p.attiva && ['pagato', 'in_parte'].includes(p.pagamento?.stato))
  ok('una a chi ha pagato, tranne chi ne aveva già una', esempi.length, paganti.filter((p) => p.id !== chi).length)
  ok('chi non ha pagato niente non ne ha', esempi.some((r) => m.archivio.dati.persone.find((p) => p.id === r.personaId)?.pagamento?.stato === 'da_pagare'), false)
  const parte = esempi.find((r) => m.archivio.dati.persone.find((p) => p.id === r.personaId).pagamento.stato === 'in_parte' && r.voci.length > 1)
  ok('chi ha pagato in parte ha dato meno del totale', !!parte && parte.pagato < parte.totale, true)
  const numeri = tutte.filter((r) => r.anno === esempi[0].anno).map((r) => r.numero)
  ok('numeri tutti diversi', new Set(numeri).size, numeri.length)
  ok('nessuna nel futuro', esempi.every((r) => r.data <= g(new Date())), true)
  localStorage.removeItem('ods-corsi:prova-esempi-ricevute')
  m.seminaEsempi()
  ok('rifatti, non raddoppiano', m.archivio.dati.ricevute.length, prima + esempi.length)
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
