// ---------------------------------------------------------------------------
// Chi compie gli anni oggi, senza browser.
//
//   node scripts/prova-compleanni.mjs
//
// `compleannoOggi(nato, oggi)` (`src/lib/compleanni.ts`) è la regola che la
// modalità prova applica ai dati finti, la stessa di `compleanni_sala` e
// `compleanni_lezione` (`supabase/108-compleanni.sql`, provato da
// `supabase/prova/108-compleanni.sql`): giorno e mese di Roma, il 29 febbraio
// si festeggia il 1° marzo negli anni non bisestili, mai un'eccezione.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

// Il giorno è quello di Roma anche su una macchina in un altro fuso.
process.env.TZ = 'America/New_York'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

let m
try {
  const { outputFiles } = await build({
    stdin: { contents: "export { compleannoOggi, festeggiatiDa, nascitaOggi } from './src/lib/compleanni'", resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  })
  m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
} catch (e) {
  console.log('  ✗ src/lib/compleanni.ts non si carica o non esporta compleannoOggi, festeggiatiDa e nascitaOggi —', (e.errors?.[0]?.text ?? String(e.message)))
  process.exit(1)
}
const c = (nato, oggi) => m.compleannoOggi(nato, new Date(oggi))

console.log('\n1. Oggi, ieri, domani')
ok('compie gli anni oggi', c('1990-10-24', '2026-10-24T10:00:00Z'), true)
ok('lo compie ogni anno, a qualunque età', c('2015-10-24', '2026-10-24T10:00:00Z'), true)
ok('ieri: no', c('1990-10-23', '2026-10-24T10:00:00Z'), false)
ok('domani: no', c('1990-10-25', '2026-10-24T10:00:00Z'), false)
ok('stesso giorno di un altro mese: no', c('1990-11-24', '2026-10-24T10:00:00Z'), false)
ok('stesso mese di un altro giorno, un anno dopo: no', c('1990-10-24', '2026-10-25T10:00:00Z'), false)

console.log('\n2. Il fuso: il giorno è quello di Roma')
ok('23:30 UTC del giorno prima, d’estate, a Roma è già oggi', c('1990-10-24', '2026-10-23T22:30:00Z'), true)
ok('...e il giorno prima non è ancora', c('1990-10-23', '2026-10-23T22:30:00Z'), false)
ok('23:30 UTC d’inverno, a Roma è già oggi', c('1990-01-15', '2026-01-14T23:30:00Z'), true)
ok('22:30 UTC d’estate del giorno stesso, a Roma è già domani', c('1990-10-24', '2026-10-24T22:30:00Z'), false)
ok('mezzogiorno UTC: lo stesso giorno', c('1990-10-24', '2026-10-24T12:00:00Z'), true)

console.log('\n3. Il 29 febbraio')
ok('anno bisestile: il 29 febbraio', c('2000-02-29', '2028-02-29T10:00:00Z'), true)
ok('anno bisestile: il 1° marzo no', c('2000-02-29', '2028-03-01T10:00:00Z'), false)
ok('anno bisestile: il 28 febbraio no', c('2000-02-29', '2028-02-28T10:00:00Z'), false)
ok('anno non bisestile: il 28 febbraio no', c('2000-02-29', '2026-02-28T10:00:00Z'), false)
ok('anno non bisestile: il 1° marzo sì', c('2000-02-29', '2026-03-01T10:00:00Z'), true)
ok('anno non bisestile, 1° marzo a mezzanotte di Roma (23:30 UTC)', c('2000-02-29', '2026-02-28T23:30:00Z'), true)
ok('2100 non è bisestile: il 1° marzo sì', c('2000-02-29', '2100-03-01T10:00:00Z'), true)
ok('chi è nato il 1° marzo lo festeggia sempre il 1° marzo', c('1999-03-01', '2028-03-01T10:00:00Z'), true)
ok('chi è nato il 28 febbraio non festeggia il 29', c('1999-02-28', '2028-02-29T10:00:00Z'), false)

console.log('\n4. Dati mancanti o sbagliati: false, mai un errore')
const mai = (cosa, nato, oggi = new Date('2026-10-24T10:00:00Z')) => {
  let avuto
  try { avuto = m.compleannoOggi(nato, oggi) } catch (e) { avuto = 'eccezione: ' + e.message }
  ok(cosa, avuto, false)
}
mai('senza data (null)', null)
mai('senza data (undefined)', undefined)
mai('stringa vuota', '')
mai('testo qualunque', 'ieri')
mai('mese che non c’è', '1990-13-24')
mai('giorno che non c’è', '1990-02-30')
mai('29 febbraio di un anno che non lo ha', '1999-02-29', new Date('2026-03-01T10:00:00Z'))
mai('data scritta all’italiana', '24/10/1990')
mai('una data con l’ora', '1990-10-24T00:00:00Z')
mai('oggi non è una data', '1990-10-24', new Date('non è una data'))

console.log('\n5. La risposta del database: solo gli id, e se non risponde nessuno')
ok('gli id di chi festeggia', await m.festeggiatiDa(Promise.resolve({ data: [{ persona_id: 'a' }, { persona_id: 'b' }], error: null })), ['a', 'b'])
ok('nessuno', await m.festeggiatiDa(Promise.resolve({ data: [], error: null })), [])
ok('senza dati', await m.festeggiatiDa(Promise.resolve({ data: null, error: null })), [])
ok('funzione non ancora sul database (errore)', await m.festeggiatiDa(Promise.resolve({ data: null, error: { code: '42883' } })), [])
ok('rete rotta (la promessa fallisce)', await m.festeggiatiDa(Promise.reject(new Error('rete'))), [])
ok('le lezioni con un istruttore in festa', await m.festeggiatiDa(Promise.resolve({ data: [{ sessione_id: 's1' }], error: null }), 'sessione_id'), ['s1'])
ok('...senza il database nuovo: nessuna', await m.festeggiatiDa(Promise.resolve({ data: null, error: { code: '42883' } }), 'sessione_id'), [])

console.log('\n6. Chi è nato oggi (per i dati di prova)')
ok('nascitaOggi compie gli anni oggi', m.compleannoOggi(m.nascitaOggi(28, new Date('2026-10-24T10:00:00Z')), new Date('2026-10-24T10:00:00Z')), true)
ok('anche il 29 febbraio', m.compleannoOggi(m.nascitaOggi(28, new Date('2028-02-29T10:00:00Z')), new Date('2028-02-29T10:00:00Z')), true)
ok('il giorno è quello di Roma', m.nascitaOggi(28, new Date('2026-10-24T23:30:00Z')), '1998-10-25')

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
