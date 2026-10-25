// ---------------------------------------------------------------------------
// Il suggerimento di voce e persona per un movimento «Da classificare», senza browser.
//
//   node scripts/prova-suggerimento-movimento.mjs
//
// Controlla `src/lib/suggerimentoMovimento.ts`: il nome nel testo («Satispay · Elisa M.»),
// l'abbinamento per nome intero o per nome e iniziale, la voce dalle altre righe uguali,
// e i quattro casi del blocco «Suggerito». Niente si applica da solo.
// I nomi sono tutti inventati: il repository è pubblico.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/suggerimentoMovimento'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
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
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

const P = (id, nome, cognome) => ({ id, nome, cognome })
const voci = [
  { id: 'vq', nome: 'Quota associativa', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'vc', nome: 'Corsi e altri pagamenti', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'vg', nome: 'Gare', tipo: 'entrata', diSistema: false, attiva: true },
  { id: 'vx', nome: 'Vecchia', tipo: 'entrata', diSistema: false, attiva: false },
  { id: 'va', nome: 'Affitto', tipo: 'uscita', diSistema: false, attiva: true },
]
let n = 0
const riga = (o) => ({ id: `r${++n}`, origine: 'movimento', tipo: 'entrata', data: '2026-10-09', importo: 5000, descrizione: 'x', voce: 'Da classificare', cassaId: 'c1', annullato: false, ...o })

console.log('1. nomeDalTesto')
const nome = (d) => prova(() => m.nomeDalTesto(d))
ok('Satispay', nome('Satispay · Elisa M.'), 'Elisa M.')
ok('rimborso Satispay', nome('Rimborso Satispay · M. Rossi'), 'M. Rossi')
ok('«Cliente … per …»', nome('Cliente Giulia Verdi per quota'), 'Giulia Verdi')
ok('altro testo: nessun nome', nome('Bonifico Enel'), null)

console.log('\n2. nome intero o nome e iniziale')
const ab = (t, p) => prova(() => m.abbinaPerNomeOIniziale(t, p))
ok('nome intero, ordine libero', ab('Verdi Giulia', [P('g', 'Giulia', 'Verdi')]), [{ id: 'g', come: 'nome intero' }])
ok('nome e iniziale', ab('Elisa M.', [P('a', 'Elisa', 'Mosca'), P('b', 'Elisa', 'Rossi'), P('c', 'Elena', 'Moro')]), [{ id: 'a', come: 'nome e iniziale' }])
ok('iniziale del nome e cognome intero, in ordine di cognome e nome', ab('M. Rossi', [P('a', 'Marco', 'Rossi'), P('b', 'Maria', 'Rossi'), P('c', 'Marco', 'Bianchi')]), [{ id: 'a', come: 'nome e iniziale' }, { id: 'b', come: 'nome e iniziale' }])
ok('solo il nome non basta', ab('Elisa', [P('a', 'Elisa', 'Mosca')]), [])
ok('due iniziali non bastano', ab('E. M.', [P('a', 'Elisa', 'Mosca')]), [])
ok('doppio nome', ab('Maria F.', [P('a', 'Maria Grazia', 'Fontana')]), [{ id: 'a', come: 'nome e iniziale' }])
ok('la stessa parola non vale due volte', ab('Maria M.', [P('a', 'Maria', 'Mosca'), P('b', 'Maria', 'Rossi')]), [{ id: 'a', come: 'nome e iniziale' }])
ok('la parola da cercare è la più lunga', prova(() => [m.parolaDaCercare('Elisa M.'), m.parolaDaCercare('M. Rossi'), m.parolaDaCercare('E. M.')]), ['elisa', 'rossi', null])

console.log('\n3. la voce dalle altre righe uguali')
const vd = (r, altre) => prova(() => m.vocePerDescrizione(r, altre, voci)?.nome ?? null)
const sat = (o) => riga({ descrizione: 'Satispay · Elisa M.', ...o })
const q = riga({ descrizione: 'Satispay · Elisa M.' })
ok('due uguali sulla stessa voce', vd(q, [sat({ voce: 'Corsi e altri pagamenti' }), sat({ voce: 'Corsi e altri pagamenti' })]), 'Corsi e altri pagamenti')
ok('una sola: tace', vd(q, [sat({ voce: 'Gare' })]), null)
ok('voci diverse: tace', vd(q, [sat({ voce: 'Gare' }), sat({ voce: 'Corsi e altri pagamenti' })]), null)
ok('un\'annullata non conta', vd(q, [sat({ voce: 'Gare' }), sat({ voce: 'Gare', annullato: true })]), null)
ok('«Da classificare» non conta', vd(q, [sat({ voce: 'Gare' }), sat()]), null)
ok('una voce spenta non si propone', vd(q, [sat({ voce: 'Vecchia' }), sat({ voce: 'Vecchia' })]), null)
ok('un\'uscita non prende una voce di entrata', vd(riga({ tipo: 'uscita', descrizione: 'Affitto' }), [riga({ tipo: 'uscita', descrizione: 'Affitto', voce: 'Gare' }), riga({ tipo: 'uscita', descrizione: 'Affitto', voce: 'Gare' })]), null)
ok('cifre e date non contano', vd(riga({ tipo: 'uscita', descrizione: 'Affitto 10/2026' }), [riga({ tipo: 'uscita', descrizione: 'Affitto 03/2026', voce: 'Affitto' }), riga({ tipo: 'uscita', descrizione: 'Affitto 04/2026', voce: 'Affitto' })]), 'Affitto')
ok('il motivo dice quante', prova(() => m.vocePerDescrizione(q, [sat({ voce: 'Gare' }), sat({ voce: 'Gare' })], voci).motivo), 'Altre 2 voci uguali sono su «Gare»')

console.log('\n4. i casi del blocco')
const sug = (r, altre, persone) => prova(() => m.suggerisciMovimento(r, altre, voci, persone))
const due = (v) => [sat({ voce: v }), sat({ voce: v })]
const elisa = [P('a', 'Elisa', 'Mosca')]
const A = sug(q, due('Corsi e altri pagamenti'), elisa)
ok('A: un candidato, voce e persona', [A.caso, A.persona, A.preselezionato, A.voce?.nome], ['A', 'candidati', 'a', 'Corsi e altri pagamenti'])
ok('A: la conferma ha voce e persona', prova(() => m.confermaDi(A, null)), { voceId: 'vc', personaId: 'a' })
const B = sug(q, due('Corsi e altri pagamenti'), [P('a', 'Elisa', 'Mosca'), P('b', 'Elisa', 'Marchi')])
ok('B: due candidati, nessuna preselezione', [B.caso, B.candidati.length, B.preselezionato], ['B', 2, null])
ok('B: senza scelta il tasto è spento', prova(() => m.confermaDi(B, null)), null)
ok('B: con la scelta si conferma', prova(() => m.confermaDi(B, 'b')), { voceId: 'vc', personaId: 'b' })
ok('B: una scelta fuori elenco non vale', prova(() => m.confermaDi(B, 'zz')), null)
const C = sug(riga({ tipo: 'uscita', descrizione: 'Affitto' }), [riga({ tipo: 'uscita', descrizione: 'Affitto', voce: 'Affitto' }), riga({ tipo: 'uscita', descrizione: 'Affitto', voce: 'Affitto' })], [])
ok('C: uscita, voce senza persona', [C.caso, C.persona, prova(() => m.confermaDi(C, null))], ['C', 'nessuna-spesa', { voceId: 'va' }])
const Cg = sug(q, due('Gare'), elisa)
ok('C: entrata su una voce senza persona', [Cg.caso, Cg.persona, Cg.candidati.length], ['C', 'nessuna-senza-persona', 0])
const D = sug(riga({ descrizione: 'Bonifico Enel' }), [], elisa)
ok('D: niente da suggerire', [D.caso, D.voce, prova(() => m.confermaDi(D, null))], ['D', null, null])
// Senza righe uguali la voce viene dall'importo: 5000 centesimi sono la quota (vedi sezione 4b).
const senzaVoce = sug(q, [], elisa)
ok('persona senza righe uguali: la voce viene dall\'importo', [senzaVoce.caso, senzaVoce.persona, senzaVoce.voce?.nome], ['A', 'candidati', 'Quota associativa'])
const dasc = sug(q, due('Quota associativa'), [])
ok('voce da persona ma nessuna scheda: da scegliere', [dasc.persona, prova(() => m.confermaDi(dasc, null))], ['da-scegliere', null])
const gia = sug(riga({ descrizione: 'Satispay · Elisa M.', personaId: 'a' }), due('Quota associativa'), elisa)
ok('persona già collegata: solo la voce', [gia.persona, gia.candidati.length, prova(() => m.confermaDi(gia, null))], ['gia-collegata', 0, { voceId: 'vq' }])
const storico = sug(riga({ descrizione: 'Satispay · Elisa M.', origineImport: 'prima-nota:3' }), due('Quota associativa'), elisa)
ok('movimento dello storico: niente persona', [storico.persona, prova(() => m.confermaDi(storico, null))], ['nessuna-senza-persona', { voceId: 'vq' }])
const storicoSenzaVoce = sug(riga({ descrizione: 'Satispay · Elisa M.', origineImport: 'prima-nota:3' }), [], elisa)
ok('storico senza voce: nessun candidato, niente da confermare', [storicoSenzaVoce.persona, storicoSenzaVoce.candidati.length, prova(() => m.confermaDi(storicoSenzaVoce, null))], ['nessuna-senza-persona', 0, null])
ok('la parola da cercare del movimento: solo entrata da classificare, senza persona', prova(() => [
  m.parolaDelMovimento(riga({ descrizione: 'Satispay · Elisa M.' })),
  m.parolaDelMovimento(riga({ descrizione: 'Satispay · Elisa M.', tipo: 'uscita' })),
  m.parolaDelMovimento(riga({ descrizione: 'Satispay · Elisa M.', personaId: 'a' })),
  m.parolaDelMovimento(riga({ descrizione: 'Satispay · Elisa M.', annullato: true })),
  m.parolaDelMovimento(riga({ descrizione: 'Satispay · Elisa M.', voce: 'Gare' })),
]), ['elisa', null, null, null, null])
ok('chi cerca la persona: anche senza un nome nel testo («Da VACCARO ANDREA»)', prova(() => [
  m.cercaPersonaDelMovimento(riga({ descrizione: 'Da VACCARO ANDREA retta figlio' })),
  m.parolaDelMovimento(riga({ descrizione: 'Da VACCARO ANDREA retta figlio' })),
  m.cercaPersonaDelMovimento(riga({ descrizione: 'Da VACCARO ANDREA', tipo: 'uscita' })),
]), [true, null, false])
ok('la nota «a pari, dopo» solo con più schede', [
  m.motivoCandidati([{ come: 'nome intero', giaIscritto: true }]).includes('è dopo'),
  m.motivoCandidati([{ come: 'genitore', giaIscritto: false }, { come: 'genitore', giaIscritto: true }]).includes('è dopo'),
], [false, true])

console.log('\n4b. la voce dall\'importo, quando la persona è proposta')
const corso = (nome, prezzi) => ({ corso: nome, eta: '', orari: [], prezzi })
const listino = { quota: 50, saldoEntro: '2026-08-31', offerte: [], corsi: [corso('Judo kids', [{ saldo: 240, annuale: 260, trimestre: 90 }]), corso('Pilates', [{ saldo: 240, annuale: 280 }])] }
const sugL = (importoEuro, persone = elisa, altre = [], o = {}) => prova(() => m.suggerisciMovimento(riga({ descrizione: 'Satispay · Elisa M.', importo: importoEuro * 100, ...o }), altre, voci, persone, listino))
const quota = sugL(50)
ok('50 € è la quota associativa', [quota.voce?.nome, quota.voce?.motivo, prova(() => m.confermaDi(quota, null))], ['Quota associativa', '50 € è la quota associativa', { voceId: 'vq', personaId: 'a' }])
const unCorso = sugL(90)
ok('il prezzo di un corso: Corsi e altri pagamenti, e dice quale', [unCorso.voce?.nome, unCorso.voce?.motivo], ['Corsi e altri pagamenti', '90 € è il prezzo di Judo kids, trimestre'])
ok('lo stesso prezzo su più corsi: ne cita uno e dice che ce ne sono altri', sugL(240).voce?.motivo, '240 € è il prezzo di Judo kids, saldo e di un altro prezzo')
ok('un prezzo con l\'etichetta la cita', prova(() => m.suggerisciMovimento(riga({ descrizione: 'Satispay · Elisa M.', importo: 15000 }), [], voci, elisa, { ...listino, corsi: [corso('Karate', [{ etichetta: '2 GIORNI', annuale: 150 }])] }).voce?.motivo), '150 € è il prezzo di Karate 2 GIORNI, annuale')
const fuori = sugL(85)
ok('importo fuori listino: Corsi e altri pagamenti con l\'avviso, e si conferma', [fuori.voce?.nome, fuori.voce?.motivo, prova(() => m.confermaDi(fuori, null))], ['Corsi e altri pagamenti', '85 € non è un prezzo del listino: controlla che la voce sia giusta', { voceId: 'vc', personaId: 'a' }])
ok('centesimi nell\'avviso', sugL(85.5).voce?.motivo, '85,50 € non è un prezzo del listino: controlla che la voce sia giusta')
const piu = sugL(85, [P('a', 'Elisa', 'Mosca'), P('b', 'Elisa', 'Marchi')])
ok('più candidati: la voce c\'è, il tasto resta spento finché non scegli', [piu.caso, piu.voce?.nome, prova(() => m.confermaDi(piu, null)), prova(() => m.confermaDi(piu, 'b'))], ['B', 'Corsi e altri pagamenti', null, { voceId: 'vc', personaId: 'b' }])
ok('le righe uguali battono l\'importo', sugL(50, elisa, due('Gare')).voce?.nome, 'Gare')
ok('senza persona candidata l\'importo non propone niente', [sugL(50, []).caso, sugL(50, []).voce], ['D', null])
ok('un\'uscita non prende la voce dall\'importo', [sugL(50, elisa, [], { tipo: 'uscita' }).voce], [null])
ok('senza listino resta la quota e il resto è fuori listino', prova(() => [m.suggerisciMovimento(riga({ descrizione: 'Satispay · Elisa M.', importo: 5000 }), [], voci, elisa).voce?.nome, m.suggerisciMovimento(riga({ descrizione: 'Satispay · Elisa M.', importo: 9000 }), [], voci, elisa).voce?.nome]), ['Quota associativa', 'Corsi e altri pagamenti'])
ok('la voce spenta non si propone', prova(() => m.suggerisciMovimento(riga({ descrizione: 'Satispay · Elisa M.', importo: 5000 }), [], voci.map((v) => (v.id === 'vq' ? { ...v, attiva: false } : v)), elisa, listino).voce), null)
ok('persona proposta ma voce spenta: non si conferma', prova(() => m.confermaDi(m.suggerisciMovimento(riga({ descrizione: 'Satispay · Elisa M.', importo: 5000 }), [], voci.map((v) => (v.id === 'vq' ? { ...v, attiva: false } : v)), elisa, listino), null)), null)

console.log('\n5. quando il blocco non c\'è')
for (const [cosa, r] of [
  ['voce già vera', riga({ voce: 'Gare' })],
  ['annullato', riga({ annullato: true })],
  ['incasso di un iscritto', riga({ origine: 'ricevuta' })],
  ['giroconto', riga({ tipo: 'giroconto' })],
]) ok(cosa, sug(r, [], elisa), null)

console.log(guai ? `\n${guai} da sistemare` : '\nTutto in regola')
process.exit(guai ? 1 : 0)
