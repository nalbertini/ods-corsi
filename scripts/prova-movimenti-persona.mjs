// ---------------------------------------------------------------------------
// I movimenti dello storico collegati alla persona che li ha fatti, senza browser.
//
//   node scripts/prova-movimenti-persona.mjs
//
// Controlla `src/lib/movimentiPersona.ts`: il nome che sta nella causale
// («Cliente … per …»), l'abbinamento a una sola scheda (o a più, o a nessuna),
// cosa si può collegare e il riepilogo prima di scrivere. Le stesse regole di
// `supabase/70-movimenti-persona.sql`, provato da `supabase/prova/movimenti-persona.sql`.
// I nomi sono tutti inventati: il repository è pubblico.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/movimentiPersona'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
// Gli oggetti si confrontano senza badare all'ordine dei campi.
const stabile = (x) => JSON.stringify(x, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v))
const ok = (cosa, avuto, voluto) => {
  const va = stabile(avuto) === stabile(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che non c'è ancora lancia: la prova fallisce con quel messaggio, non si ferma.
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

console.log('1. normalizzaNome: maiuscole, accenti, spazi')
ok('minuscolo', prova(() => m.normalizzaNome('GIULIA Verdi')), 'giulia verdi')
ok('gli accenti spariscono (é, è, à)', prova(() => ['José', 'JOSÈ', 'Renée', 'Lucà'].map(m.normalizzaNome)), ['jose', 'jose', 'renee', 'luca'])
ok('spazi doppi e a capo diventano uno, e quelli ai bordi se ne vanno', prova(() => m.normalizzaNome('  Maria \n  Grazia\t Fontana  ')), 'maria grazia fontana')
ok('l\'apostrofo tipografico vale quello dritto', prova(() => [m.normalizzaNome('D\'Angelo'), m.normalizzaNome('D’Angelo')]), ['d\'angelo', 'd\'angelo'])
ok('lo spazio unificatore è uno spazio', prova(() => m.normalizzaNome('Elena Neri')), 'elena neri')
ok('vuoto resta vuoto', prova(() => m.normalizzaNome('   ')), '')

console.log('\n2. nomeDallaCausale: «Cliente … per …»')
const nome = (d) => prova(() => m.nomeDallaCausale(d))
ok('la causale dell\'import', nome('Cliente Giulia Verdi per annuale judo kids'), 'Giulia Verdi')
ok('cognome e nome', nome('Cliente VERDI GIULIA per quota associativa'), 'VERDI GIULIA')
ok('doppio nome', nome('Cliente Maria Grazia Fontana per corso'), 'Maria Grazia Fontana')
ok('apostrofo', nome('Cliente Elena D\'Angelo per corso danza'), 'Elena D\'Angelo')
ok('con le maiuscole di «Cliente» e «per» diverse', prova(() => m.normalizzaNome(m.nomeDallaCausale('CLIENTE Marco Bianchi PER mensile'))), 'marco bianchi')
ok('spazi doppi e a capo fra le parole', prova(() => m.normalizzaNome(m.nomeDallaCausale('Cliente\nJOSÈ  FERRARI\nper mensile'))), 'jose ferrari')
ok('spazi prima di «Cliente»', prova(() => m.normalizzaNome(m.nomeDallaCausale('  Cliente Marco Bianchi per mensile'))), 'marco bianchi')
ok('la prima «per» chiude il nome', nome('Cliente Marco Bianchi per mensile per tutti'), 'Marco Bianchi')
ok('una causale che non è «Cliente … per …»: nessun nome', ['Bonifico anonimo per quota', 'Affitto palestra', 'Cliente Marco Bianchi', 'Cliente per mensile', 'Fornitore Rossi per fattura', ''].map(nome), [null, null, null, null, null, null])
ok('«per» dentro un cognome non chiude il nome', nome('Cliente Alberto Peretti per mensile'), 'Alberto Peretti')

console.log('\n3. abbinaPersone: una scheda sola, più d\'una, nessuna')
const gente = [
  { id: 'g1', nome: 'Giulia', cognome: 'Verdi' },
  { id: 'm1', nome: 'Marco', cognome: 'Bianchi' },
  { id: 's1', nome: 'Sara', cognome: 'Neri' },
  { id: 's2', nome: 'Sara', cognome: 'Neri' },
  { id: 'e1', nome: 'Elena', cognome: 'D\'Angelo' },
  { id: 'mg', nome: 'Maria Grazia', cognome: 'Fontana' },
  { id: 'j1', nome: 'José', cognome: 'Ferrari' },
]
const abbina = (n, p = gente) => prova(() => m.abbinaPersone(n, p))
ok('nome e cognome: una scheda, sicuro', abbina('Giulia Verdi'), { esito: 'sicuro', ids: ['g1'] })
ok('cognome e nome: la stessa', abbina('VERDI GIULIA'), { esito: 'sicuro', ids: ['g1'] })
ok('maiuscole e spazi doppi', abbina('  marco   BIANCHI '), { esito: 'sicuro', ids: ['m1'] })
ok('accento nella scheda, senza nella causale', abbina('Jose Ferrari'), { esito: 'sicuro', ids: ['j1'] })
ok('accento nella causale, senza nella scheda', abbina('JOSÈ Ferrari', gente.map((p) => (p.id === 'j1' ? { ...p, nome: 'Jose' } : p))), { esito: 'sicuro', ids: ['j1'] })
ok('É maiuscola con accento contro e semplice', abbina('JOSÉ FERRARI'), { esito: 'sicuro', ids: ['j1'] })
ok('apostrofo dritto o tipografico', [abbina('Elena D\'Angelo').ids, abbina('Elena D’Angelo').ids, abbina('D\'Angelo Elena').ids], [['e1'], ['e1'], ['e1']])
ok('doppio nome, in tutti gli ordini', [abbina('Maria Grazia Fontana').ids, abbina('Fontana Maria Grazia').ids, abbina('Grazia Maria Fontana').ids], [['mg'], ['mg'], ['mg']])
ok('doppio nome scritto con il solo primo: non basta', abbina('Maria Fontana'), { esito: 'nessuna', ids: [] })
ok('il solo cognome non basta', abbina('Verdi'), { esito: 'nessuna', ids: [] })
ok('nome e cognome con una parola in più non bastano', abbina('Giulia Verdi Rossi'), { esito: 'nessuna', ids: [] })
ok('due schede con lo stesso nome: omonimi, mai uno solo', abbina('Sara Neri'), { esito: 'omonimi', ids: ['s1', 's2'] })
ok('…anche scritti alla rovescia', abbina('NERI SARA'), { esito: 'omonimi', ids: ['s1', 's2'] })
ok('una scheda inattiva o di un ex iscritto conta come una scheda', abbina('Marco Bianchi', [{ id: 'm1', nome: 'Marco', cognome: 'Bianchi', attiva: false }]), { esito: 'sicuro', ids: ['m1'] })
ok('nessuna scheda col nome', abbina('Paolo Gialli'), { esito: 'nessuna', ids: [] })
ok('nessun nome (causale non «Cliente … per …»)', [abbina(null), abbina(''), abbina('   ')], [{ esito: 'nessuna', ids: [] }, { esito: 'nessuna', ids: [] }, { esito: 'nessuna', ids: [] }])
ok('nessuna scheda in archivio', abbina('Giulia Verdi', []), { esito: 'nessuna', ids: [] })
ok('con la causale intera: dalla causale alla scheda', prova(() => m.abbinaPersone(m.nomeDallaCausale('Cliente\nJOSÈ  FERRARI\nper mensile'), gente)), { esito: 'sicuro', ids: ['j1'] })

console.log('\n4. cosaNonVaCollegato: cosa si collega e cosa no (le stesse parole di supabase/70-movimenti-persona.sql)')
const mv = (o) => ({ id: 'x', tipo: 'entrata', data: '2025-03-04', importo: 3000, descrizione: 'Cliente Giulia Verdi per extra', voce: 'Corsi e altri pagamenti', annullato: false, origineImport: 'prima-nota:1', ...o })
const no = (o) => prova(() => m.cosaNonVaCollegato(mv(o)))
ok('un\'entrata dello storico su «Corsi e altri pagamenti»: niente da dire', no({}), null)
ok('…e su «Quota associativa»', no({ voce: 'Quota associativa' }), null)
ok('un annullato', no({ annullato: true }), 'Il movimento del 04/03/2025 (Cliente Giulia Verdi per extra) è annullato: non si collega')
ok('un giroconto', no({ tipo: 'giroconto', voce: null, origineImport: undefined }), 'Un giroconto non ha una persona')
ok('la differenza di una chiusura', no({ voce: 'Differenza di cassa', origineImport: undefined, descrizione: 'Differenza di cassa', data: '2026-09-07' }), 'Il movimento del 07/09/2026 (Differenza di cassa) è scritto dalla chiusura di cassa: non si collega')
ok('un\'uscita', no({ tipo: 'uscita', voce: 'Da classificare', data: '2025-03-03', descrizione: 'Cliente Giulia Verdi per rimborso' }), 'Il movimento del 03/03/2025 (Cliente Giulia Verdi per rimborso) è un’uscita: si collegano solo le entrate')
ok('un movimento scritto a mano, anche con un nome nel testo', no({ origineImport: undefined, voce: 'Quota associativa', data: '2026-09-10', descrizione: 'Cliente Giulia Verdi per mano' }), 'Il movimento del 10/09/2026 (Cliente Giulia Verdi per mano) non viene dal vecchio programma: non si collega')
ok('una chiave che non è dello storico', no({ origineImport: 'altro:7' }), 'Il movimento del 04/03/2025 (Cliente Giulia Verdi per extra) non viene dal vecchio programma: non si collega')
ok('un\'entrata su «Da classificare»', no({ voce: 'Da classificare', data: '2025-03-02', descrizione: 'Cliente Giulia Verdi per regalo' }), 'Il movimento del 02/03/2025 (Cliente Giulia Verdi per regalo) è su «Da classificare»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»')
ok('un giorno chiuso non è un motivo per dire no: è un\'etichetta', no({ data: '2026-09-03' }), null)
ok('un movimento già collegato a un\'altra persona si può ricollegare a mano', no({ personaId: 'g9' }), null)
ok('l\'annullato batte il resto (è annullato E uscita)', no({ annullato: true, tipo: 'uscita' }), 'Il movimento del 04/03/2025 (Cliente Giulia Verdi per extra) è annullato: non si collega')
ok('il giroconto batte l\'uscita', no({ tipo: 'giroconto', voce: null }), 'Un giroconto non ha una persona')

console.log('\n5. riepilogoCollegamenti: sicuri, da decidere, senza scheda (la forma del riepilogo del database)')
const storico = [
  mv({ id: 'a1', data: '2025-09-02', importo: 31000, descrizione: 'Cliente Giulia Verdi per annuale judo kids' }),
  mv({ id: 'a2', data: '2025-09-03', importo: 3000, descrizione: 'Cliente VERDI GIULIA per quota associativa', voce: 'Quota associativa' }),
  mv({ id: 'a3', data: '2026-09-03', importo: 4700, descrizione: 'Cliente Marco Bianchi per mensile judo' }),
  mv({ id: 'a4', data: '2025-10-05', importo: 4500, descrizione: 'Cliente Sara Neri per mensile judo' }),
  mv({ id: 'a5', data: '2025-11-05', importo: 4500, descrizione: 'Cliente Neri Sara per mensile judo' }),
  mv({ id: 'a6', data: '2024-10-10', importo: 6000, descrizione: 'Cliente Paolo Gialli per quota associativa', voce: 'Quota associativa' }),
  mv({ id: 'a7', data: '2024-10-15', importo: 5200, descrizione: 'Cliente Elena D\'Angelo per corso danza' }),
  mv({ id: 'a8', data: '2025-01-20', importo: 5500, descrizione: 'Cliente Maria Grazia Fontana per corso' }),
  mv({ id: 'a9', data: '2023-11-05', importo: 2000, descrizione: 'Cliente Jose Ferrari per quota associativa', voce: 'Quota associativa' }),
  mv({ id: 'a10', data: '2025-03-01', importo: 1500, descrizione: 'Bonifico anonimo per quota', voce: 'Quota associativa' }),
  mv({ id: 'a14', data: '2026-05-10', importo: 2500, descrizione: 'Cliente\nJOSÈ  FERRARI\nper mensile' }),
  // Fuori dal riepilogo: voce sbagliata, uscita, annullato, a mano, giroconto, differenza.
  mv({ id: 'f11', voce: 'Da classificare', importo: 7000, descrizione: 'Cliente Giulia Verdi per regalo' }),
  mv({ id: 'f12', tipo: 'uscita', voce: 'Da classificare', importo: 8000, descrizione: 'Cliente Giulia Verdi per rimborso' }),
  mv({ id: 'f13', annullato: true, importo: 1000 }),
  mv({ id: 'f15', origineImport: undefined, voce: 'Quota associativa', importo: 3000, descrizione: 'Cliente Giulia Verdi per mano' }),
  mv({ id: 'f16', tipo: 'giroconto', voce: null, origineImport: undefined, importo: 1000, descrizione: 'Giroconto' }),
  mv({ id: 'f17', voce: 'Differenza di cassa', origineImport: undefined, importo: 500, descrizione: 'Differenza di cassa' }),
]
const rie = (mm = storico, p = gente) => prova(() => m.riepilogoCollegamenti(mm, p))
const senzaCampione = (r) => (r && typeof r === 'object' ? { ...r, campione: undefined } : r)
ok('7 sicuri di 5 persone, 2 da decidere (gli omonimi), 2 senza scheda (Paolo e l\'anonimo), nessuno già collegato', senzaCampione(rie()), {
  sicuri: { movimenti: 7, persone: 5, centesimi: 53900, dal: '2023-11-05', al: '2026-09-03' },
  daDecidere: { movimenti: 2, centesimi: 9000 },
  senzaScheda: { movimenti: 2, centesimi: 7500 },
  giaCollegati: 0,
})
ok('le chiavi sono quelle del riepilogo del database, in camelCase', prova(() => Object.keys(rie()).sort()), ['campione', 'daDecidere', 'giaCollegati', 'senzaScheda', 'sicuri'])
const campione = rie().campione
ok('il campione: cinque esempi, ognuno con causale e persona (nome cognome)', prova(() => [campione.length, campione.every((c) => Object.keys(c).sort().join() === 'causale,persona')]), [5, true])
ok('…e ogni persona è quella della causale', prova(() => campione.every((c) => {
  const trovate = m.abbinaPersone(m.nomeDallaCausale(c.causale), gente)
  const p = gente.find((x) => x.id === trovate.ids[0])
  return trovate.esito === 'sicuro' && c.persona === `${p.nome} ${p.cognome}`
})), true)
ok('con tre sicuri il campione ne ha tre', prova(() => rie(storico.slice(0, 3)).campione.length), 3)
ok('uno già collegato (a un\'altra persona) esce dai sicuri e va fra i collegati', senzaCampione(rie(storico.map((x) => (x.id === 'a2' ? { ...x, personaId: 'm1' } : x)))), {
  sicuri: { movimenti: 6, persone: 5, centesimi: 50900, dal: '2023-11-05', al: '2026-09-03' },
  daDecidere: { movimenti: 2, centesimi: 9000 },
  senzaScheda: { movimenti: 2, centesimi: 7500 },
  giaCollegati: 1,
})
ok('tutti i sicuri collegati: zero, senza date, campione vuoto', rie(storico.map((x) => (['a1', 'a2', 'a3', 'a7', 'a8', 'a9', 'a14'].includes(x.id) ? { ...x, personaId: 'g1' } : x))), {
  sicuri: { movimenti: 0, persone: 0, centesimi: 0, dal: null, al: null },
  daDecidere: { movimenti: 2, centesimi: 9000 },
  senzaScheda: { movimenti: 2, centesimi: 7500 },
  giaCollegati: 7,
  campione: [],
})
ok('un omonimo già collegato a mano non è più da decidere', senzaCampione(rie(storico.map((x) => (x.id === 'a4' ? { ...x, personaId: 's1' } : x)))).daDecidere, { movimenti: 1, centesimi: 4500 })
ok('con due «Carlo Sala» nessuno dei due movimenti è sicuro', senzaCampione(rie([mv({ id: 'c1', descrizione: 'Cliente Carlo Sala per mensile', importo: 3500 }), mv({ id: 'c2', descrizione: 'Cliente Sala Carlo per quota', importo: 3000 })], [{ id: 'k1', nome: 'Carlo', cognome: 'Sala' }, { id: 'k2', nome: 'Carlo', cognome: 'Sala' }])), {
  sicuri: { movimenti: 0, persone: 0, centesimi: 0, dal: null, al: null },
  daDecidere: { movimenti: 2, centesimi: 6500 },
  senzaScheda: { movimenti: 0, centesimi: 0 },
  giaCollegati: 0,
})
ok('una scheda eliminata: il suo movimento torna «senza scheda», nessuna scheda fantasma', senzaCampione(rie([mv({ id: 'e1', descrizione: 'Cliente Elena D\'Angelo per corso', importo: 5200 })], gente.filter((p) => p.id !== 'e1'))), {
  sicuri: { movimenti: 0, persone: 0, centesimi: 0, dal: null, al: null },
  daDecidere: { movimenti: 0, centesimi: 0 },
  senzaScheda: { movimenti: 1, centesimi: 5200 },
  giaCollegati: 0,
})
ok('un annullato collegato non conta in nessun totale', senzaCampione(rie([mv({ id: 'z1', annullato: true, personaId: 'g1' })])), {
  sicuri: { movimenti: 0, persone: 0, centesimi: 0, dal: null, al: null },
  daDecidere: { movimenti: 0, centesimi: 0 },
  senzaScheda: { movimenti: 0, centesimi: 0 },
  giaCollegati: 0,
})
ok('nessun movimento: tutto a zero', senzaCampione(rie([])), {
  sicuri: { movimenti: 0, persone: 0, centesimi: 0, dal: null, al: null },
  daDecidere: { movimenti: 0, centesimi: 0 },
  senzaScheda: { movimenti: 0, centesimi: 0 },
  giaCollegati: 0,
})

console.log('\n6. lo stesso nome del database: accenti, apostrofi e spazi di ogni tipo (le stesse righe di supabase/prova/movimenti-persona.sql, sezione 15)')
ok('«João Silva»: la ã', prova(() => [m.normalizzaNome('João Silva'), m.normalizzaNome('JOÃO SILVA')]), ['joao silva', 'joao silva'])
ok('«Jose» con l\'accento combinante U+0301, anche in maiuscolo', prova(() => [m.normalizzaNome('José Lima'), m.normalizzaNome('JOSÉ LIMA'), m.normalizzaNome('José Lima')]), ['jose lima', 'jose lima', 'jose lima'])
ok('l\'apostrofo ’, ‘ e il grave `', prova(() => ['D’Angelo', 'D‘Angelo', 'D`Angelo', 'D\'Angelo'].map(m.normalizzaNome)), ['d\'angelo', 'd\'angelo', 'd\'angelo', 'd\'angelo'])
ok('lo spazio stretto U+202F, quello di cifra U+2007, U+FEFF, U+00A0 fra le parole valgono uno spazio', prova(() => [' ', ' ', '﻿', ' '].map((s) => m.normalizzaNome(`Elena${s}Rossi`))), ['elena rossi', 'elena rossi', 'elena rossi', 'elena rossi'])
ok('…e ai bordi', prova(() => m.normalizzaNome(' ﻿ Elena Rossi  ')), 'elena rossi')
ok('«Cliente», il nome e «per» separati da quegli spazi', prova(() => m.normalizzaNome(m.nomeDallaCausale('Cliente Elena Neri per﻿mensile'))), 'elena neri')
ok('…anche con U+FEFF dopo «Cliente»', prova(() => m.normalizzaNome(m.nomeDallaCausale('Cliente﻿Elena Neri per mensile'))), 'elena neri')
ok('la prima «per» chiude il nome: «De» è un nome intero', [nome('Cliente De per Luca per quota'), nome('Cliente Marco Bianchi per mensile per tutti')], ['De', 'Marco Bianchi'])
ok('…e «De» non è una scheda', abbina(nome('Cliente De per Luca per quota')), { esito: 'nessuna', ids: [] })
ok('le causali di sezione 15 trovano la scheda giusta (accenti, apostrofi, spazi)', prova(() => {
  const p = [{ id: 'jo', nome: 'João', cognome: 'Silva' }, { id: 'jl', nome: 'José', cognome: 'Lima' }, { id: 'on', nome: 'Olga', cognome: 'Neri' }, { id: 'sd', nome: 'Sandra', cognome: 'D\'Amico' }]
  return ['Cliente Joao Silva per quota', 'Cliente José Lima per quota', 'Cliente Olga Neri per﻿mensile', 'Cliente Sandra D‘Amico per quota', 'Cliente Sandra D`Amico per quota'].map((d) => m.abbinaPersone(m.nomeDallaCausale(d), p).ids[0])
}), ['jo', 'jl', 'on', 'sd', 'sd'])

console.log('\n7. esitiCollegamenti e filtraPerPersona: i tag e i filtri dell\'elenco')
ok('esitiCollegamenti, filtraPerPersona e collegaTuttiISicuri ci sono', [typeof m.esitiCollegamenti, typeof m.filtraPerPersona, typeof m.collegaTuttiISicuri], ['function', 'function', 'function'])
// Se la funzione manca, la lista è vuota e i controlli sotto falliscono uno per uno invece di fermare la prova.
const esitiDi = (mm = storico, p = gente) => {
  const r = prova(() => m.esitiCollegamenti(mm, p))
  return Array.isArray(r) ? r : []
}
const e0 = esitiDi()
ok('gli esiti: solo i movimenti che si collegano e non hanno persona, con l\'esito giusto', Object.fromEntries(e0.map((e) => [e.id, e.esito])), {
  a1: 'sicuro', a2: 'sicuro', a3: 'sicuro', a4: 'omonimi', a5: 'omonimi', a6: 'nessuna', a7: 'sicuro', a8: 'sicuro', a9: 'sicuro', a10: 'nessuna', a14: 'sicuro',
})
ok('…ordinati per id', e0.map((e) => e.id), [...e0.map((e) => e.id)].sort((a, b) => a.localeCompare(b)))
ok('…ogni riga ha solo id ed esito', e0.every((e) => Object.keys(e).sort().join() === 'esito,id'), true)
ok('…chi ha già una persona non c\'è', esitiDi(storico.map((x) => (x.id === 'a2' ? { ...x, personaId: 'm1' } : x))).some((e) => e.id === 'a2'), false)
ok('…uscite, giroconti, annullati, movimenti a mano, la differenza e le voci non ammesse non ci sono', e0.some((e) => /^f/.test(e.id)), false)
ok('…senza movimenti: lista vuota', esitiDi([]), [])
ok('…con una scheda eliminata il suo movimento diventa «nessuna»', esitiDi(storico, gente.filter((p) => p.id !== 'e1')).find((e) => e.id === 'a7')?.esito, 'nessuna')
ok('i numeri degli esiti coincidono con quelli del riepilogo', prova(() => {
  const r = m.riepilogoCollegamenti(storico, gente)
  return ['sicuro', 'omonimi', 'nessuna'].map((x) => e0.filter((e) => e.esito === x).length)
}), prova(() => {
  const r = m.riepilogoCollegamenti(storico, gente)
  return [r.sicuri.movimenti, r.daDecidere.movimenti, r.senzaScheda.movimenti]
}))

const righeElenco = [{ id: 'r1', personaId: 'g1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5', personaId: 'g2' }, { id: 'r6' }]
const esitiElenco = { r2: 'omonimi', r3: 'nessuna', r4: 'sicuro', r5: 'omonimi', r6: 'omonimi' }
const filtra = (f) => prova(() => m.filtraPerPersona(righeElenco, f, esitiElenco).map((r) => r.id))
ok('nessun filtro: tutte le righe, nello stesso ordine', filtra(''), ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'])
ok('«collegati»: quelle con una persona', filtra('collegati'), ['r1', 'r5'])
ok('«da decidere»: senza persona e con più schede (un collegato con un esito vecchio non conta)', filtra('da_decidere'), ['r2', 'r6'])
ok('«senza scheda»: senza persona e senza scheda', filtra('senza_scheda'), ['r3'])
ok('una riga senza esito (un\'uscita, un movimento a mano) non è in nessuno dei due', prova(() => m.filtraPerPersona([{ id: 'x' }], 'da_decidere', {}).length + m.filtraPerPersona([{ id: 'x' }], 'senza_scheda', {}).length), 0)
ok('il filtro non cambia le righe: stesso oggetto', prova(() => m.filtraPerPersona(righeElenco, 'collegati', esitiElenco)[0] === righeElenco[0]), true)

console.log('\n8. collegaTuttiISicuri: i pacchetti da 500, senza mai lanciare')
const finto = (risposte) => {
  const chiamate = []
  const d = {
    collegaSicuriPersona: async (lotto, quanti) => {
      chiamate.push([lotto, quanti])
      const r = risposte[Math.min(chiamate.length, risposte.length) - 1]
      if (r instanceof Error || r === 'rifiuto') throw r === 'rifiuto' ? undefined : r
      return r
    },
  }
  return { d, chiamate }
}
const tutti = async (risposte, totale, lotto = 'L1') => {
  const { d, chiamate } = finto(risposte)
  const progressi = []
  // Una funzione che manca, o che lancia, non ferma la prova: il risultato dice «lanciato» e il controllo fallisce.
  const r = await Promise.resolve().then(() => m.collegaTuttiISicuri(d, lotto, totale, (n) => progressi.push(n))).then((x) => x, (e) => ({ lanciato: e?.message ?? String(e) }))
  return { r, chiamate, progressi }
}
const dueGiri = await tutti([{ collegati: 500, restano: 300 }, { collegati: 300, restano: 0 }], 800).catch((e) => ({ r: `ERRORE: ${e.message}` }))
ok('due pacchetti: 500 e 300, si ferma a restano 0', dueGiri.r, { collegati: 800, restano: 0 })
ok('…il lotto è lo stesso a ogni giro, a pacchetti da 500', dueGiri.chiamate, [['L1', 500], ['L1', 500]])
ok('…il progresso dice i collegati finora dopo ogni giro', dueGiri.progressi, [500, 800])
const unGiro = await tutti([{ collegati: 3, restano: 0 }], 3).catch((e) => ({ r: `ERRORE: ${e.message}` }))
ok('restano 0 al primo giro: un giro solo', [unGiro.r, unGiro.chiamate.length], [{ collegati: 3, restano: 0 }, 1])
const fermo = await tutti([{ collegati: 0, restano: 5 }], 5).catch((e) => ({ r: `ERRORE: ${e.message}` }))
ok('se non collega niente non gira all\'infinito: un giro e basta', [fermo.r, fermo.chiamate.length], [{ collegati: 0, restano: 5 }, 1])
const sempre = await tutti([{ collegati: 1, restano: 10 }], 1000).catch((e) => ({ r: `ERRORE: ${e.message}` }))
ok('un database che collega sempre 1: si ferma a ceil(1000/500)+2 = 4 giri', [sempre.r, sempre.chiamate.length], [{ collegati: 4, restano: 10 }, 4])
const guasto = await tutti([{ collegati: 500, restano: 300 }, new Error('Rete caduta')], 800).catch((e) => ({ r: `ERRORE: ${e.message}` }))
ok('un errore al secondo giro: rende i collegati del primo e il messaggio, e non lancia', [guasto.r?.collegati, guasto.r?.errore, guasto.chiamate.length, guasto.progressi], [500, 'Rete caduta', 2, [500]])
const vuoto = await tutti([new Error('')], 800).catch((e) => ({ r: `ERRORE: ${e.message}` }))
ok('un errore senza messaggio: la frase per chi usa l\'app', [vuoto.r?.collegati, vuoto.r?.errore], [0, 'Non è cambiato niente in quel pacchetto: riprova.'])
const niente = await tutti(['rifiuto'], 800).catch((e) => ({ r: `ERRORE: ${e.message}` }))
ok('un rifiuto senza nemmeno un errore: la stessa frase, e non lancia', [niente.r?.collegati, niente.r?.errore, niente.r?.lanciato], [0, 'Non è cambiato niente in quel pacchetto: riprova.', undefined])
const senzaProgresso = await (async () => {
  const { d } = finto([{ collegati: 2, restano: 0 }])
  return Promise.resolve().then(() => m.collegaTuttiISicuri(d, 'L1', 2)).catch((e) => `ERRORE: ${e.message}`)
})()
ok('il progresso è facoltativo', senzaProgresso, { collegati: 2, restano: 0 })

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
