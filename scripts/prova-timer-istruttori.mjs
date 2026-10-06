// ---------------------------------------------------------------------------
// IL TIMER NELL'APP ISTRUTTORI, senza browser.
//
//   node scripts/prova-timer-istruttori.mjs
//
// Il timer è una pagina della scheda degli istruttori, con la navigazione
// CALENDARIO · TIMER · I MIEI · ORE (barra in basso sul telefono, menu a
// sinistra su schermo largo). La logica sta in `src/lib/timerIstruttori.ts`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/timerIstruttori'; export { timerDellaLezione } from './src/lib/aree'; export { lezioneDaIndirizzo } from './timer/src/lib/lezione'",
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
const nomi = (p) => m.vociNavigazione(p).map((v) => v.nome)

// 1. NAVIGAZIONE per ruolo.
ok('istruttore: CALENDARIO, TIMER, I MIEI, ORE', nomi({ ruolo: 'istruttore' }), ['CALENDARIO', 'TIMER', 'I MIEI', 'ORE'])
ok('segreteria che insegna (ruolo doppio): tutte e quattro', nomi({ ruolo: 'staff', ancheIstruttore: true }), ['CALENDARIO', 'TIMER', 'I MIEI', 'ORE'])
ok('segreteria che non insegna: senza ORE', nomi({ ruolo: 'staff' }), ['CALENDARIO', 'TIMER', 'I MIEI'])
ok(
  'le pagine dell\'istruttore, nell\'ordine del menu',
  m.vociNavigazione({ ruolo: 'istruttore' }).map((v) => v.pagina),
  ['calendario', 'timer', 'mieiTimer', 'ore'],
)
const tutte = ['istruttore', 'staff'].flatMap((ruolo) => nomi({ ruolo, ancheIstruttore: true }))
ok('nessuna voce TIMER ↗ né STRUMENTI', tutte.filter((n) => /↗|STRUMENTI|LE MIE ORE|I MIEI TIMER/.test(n)), [])

// 2. IL CRONOMETRO dell'appello apre il timer dentro l'app, con la lezione.
const lez = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', corsoId: 'c0a80101-0000-4000-8000-000000000001', corso: 'Judo ragazzi' }
ok(
  'dall\'appello il timer si apre con corso e lezione, come timer/?corso=…&lezione=…',
  m.timerAperto(lez),
  m.lezioneDaIndirizzo('https://ods.test/' + m.timerDellaLezione(lez)),
)
ok('la lezione aperta ha il corso, la lezione e il nome', m.timerAperto(lez)?.corsoId + '|' + m.timerAperto(lez)?.sessioneId + '|' + m.timerAperto(lez)?.nome, `${lez.corsoId}|${lez.id}|Judo ragazzi`)
ok('dal menu il timer si apre senza lezione', m.timerAperto(null), null)

// 3. LA STRISCIA: stato, testo e colore; il tempo viene dall'orologio.
const ORA = 1_000_000
const lavoro = { status: 'running', kind: 'work', scadeAlle: ORA + 45_000, secondiFermo: 0 }
ok('lavoro: LAVORO, rosso, 00:45', m.statoStriscia(lavoro, ORA), { testo: 'LAVORO', colore: 'var(--rosso)', tempo: '00:45' })
ok('il tempo si ricalcola dall\'orologio, non si accumula', m.statoStriscia(lavoro, ORA + 30_000).tempo, '00:15')
ok('un orologio fermo (scheda in secondo piano) poi riletto dà il tempo giusto', m.statoStriscia(lavoro, ORA + 44_100).tempo, '00:01')
ok('scaduto: mai negativo', m.statoStriscia(lavoro, ORA + 50_000).tempo, '00:00')
ok('recupero: RECUPERO, verde', m.statoStriscia({ ...lavoro, kind: 'rest' }, ORA), { testo: 'RECUPERO', colore: 'var(--verde)', tempo: '00:45' })
ok(
  'pausa: IN PAUSA, il colore dell\'intervallo, tempo fermo anche se l\'orologio va',
  m.statoStriscia({ status: 'paused', kind: 'work', scadeAlle: 0, secondiFermo: 20 }, ORA + 99_000),
  { testo: 'IN PAUSA', colore: 'var(--rosso)', tempo: '00:20' },
)
ok(
  'finito: FINITO, giallo (il verde è RECUPERO), il tempo diventa FINE',
  m.statoStriscia({ status: 'done', kind: 'work', scadeAlle: 0, secondiFermo: 0 }, ORA),
  { testo: 'FINITO', colore: 'var(--giallo)', tempo: 'FINE' },
)

// 4. SOSTITUIRE un allenamento in corso.
const inCorso = (status, lezioneId = 'L1') => ({ lezioneId, status })
ok('un\'altra lezione con l\'allenamento in corso: chiedi prima', m.chiediPrimaDiSostituire(inCorso('running'), 'L2'), true)
ok('un\'altra lezione con l\'allenamento in pausa: chiedi prima', m.chiediPrimaDiSostituire(inCorso('paused'), 'L2'), true)
ok('dal menu (senza lezione) il timer non chiede mai di sostituire', m.chiediPrimaDiSostituire(inCorso('running'), null), false)
ok('allenamento finito: nessuna domanda', m.chiediPrimaDiSostituire(inCorso('done'), 'L2'), false)
ok('allenamento non partito: nessuna domanda', m.chiediPrimaDiSostituire(inCorso('idle'), 'L2'), false)
ok('la stessa lezione: nessuna domanda', m.chiediPrimaDiSostituire(inCorso('running'), 'L1'), false)
ok('nessun allenamento: nessuna domanda', m.chiediPrimaDiSostituire(null, 'L2'), false)

// 5. LA LEZIONE che il timer mostra.
ok('dal menu con un allenamento in corso: riapre la sua lezione', m.lezioneDelTimer(inCorso('running', 'L1'), null, true), 'L1')
ok('dal menu con un allenamento in pausa: riapre la sua lezione', m.lezioneDelTimer(inCorso('paused', 'L1'), null, true), 'L1')
ok('dal menu con un allenamento in corso senza lezione: nessuna lezione', m.lezioneDelTimer(inCorso('running', null), null, true), null)
ok('dal menu senza allenamento: nessuna lezione', m.lezioneDelTimer(null, null, true), null)
ok('dal menu con un allenamento solo finito: nessuna lezione', m.lezioneDelTimer(inCorso('done', 'L1'), null, true), null)
ok('dall\'appello: la lezione richiesta', m.lezioneDelTimer(inCorso('running', 'L1'), 'L2', false), 'L2')
ok('dall\'appello senza allenamento: la lezione richiesta', m.lezioneDelTimer(null, 'L2', false), 'L2')

// 6. LA STRISCIA si vede fuori dalla pagina timer, finché c'è un allenamento.
ok('in corso su un\'altra pagina: si vede', m.mostraStriscia('running', 'calendario'), true)
ok('in pausa su un\'altra pagina: si vede', m.mostraStriscia('paused', 'ore'), true)
ok('finito resta finché non si tocca OK', m.mostraStriscia('done', 'mieiTimer'), true)
ok('nella pagina timer: non si vede', m.mostraStriscia('running', 'timer'), false)
ok('finito nella pagina timer: non si vede', m.mostraStriscia('done', 'timer'), false)
ok('allenamento non partito: non si vede', m.mostraStriscia('idle', 'calendario'), false)

// 7. RIDISEGNARE solo quando cambia qualcosa di visibile, non a ogni secondo.
const st = { status: 'running', kind: 'work', nome: 'Judo', conto: 3 }
ok('cambia lo status: ridisegna', m.statoCambiato(st, { ...st, status: 'paused' }), true)
ok('cambia l\'intervallo: ridisegna', m.statoCambiato(st, { ...st, kind: 'rest' }), true)
ok('cambia il nome: ridisegna', m.statoCambiato(st, { ...st, nome: 'Karate' }), true)
ok('cambia il conto: ridisegna', m.statoCambiato(st, { ...st, conto: 4 }), true)
ok('cambiano solo i secondi: non ridisegna', m.statoCambiato({ ...st, secondi: 10 }, { ...st, secondi: 9 }), false)
ok('uguale: non ridisegna', m.statoCambiato(st, { ...st }), false)
ok('prima nessuno, dopo uno: ridisegna', m.statoCambiato(null, st), true)
ok('prima uno, dopo nessuno: ridisegna', m.statoCambiato(st, null), true)
ok('nessuno e nessuno: non ridisegna', m.statoCambiato(null, null), false)

// 8. SENZA RETE: l'avviso solo offline; il timer parte comunque.
const TESTO = 'Il timer funziona lo stesso. La voce incisa lascia il posto a quella del telefono e le illustrazioni degli esercizi non si vedono.'
ok('offline: il testo del design', m.avvisoSenzaRete(false), TESTO)
ok('online: nessun avviso', m.avvisoSenzaRete(true), null)

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
