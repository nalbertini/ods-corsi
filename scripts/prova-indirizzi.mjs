// ---------------------------------------------------------------------------
// Gli indirizzi della segreteria, senza browser.
//
//   node scripts/prova-indirizzi.mjs
//
// In segreteria la voce, la scheda iscritto e la lezione aperte stanno dopo il
// cancelletto, così Indietro/Avanti e la ricarica ci riportano lì
// (`src/lib/indirizzoSegreteria.ts`). Qui si controlla che un indirizzo scritto
// si rilegga uguale, che uno sbagliato porti a DA FARE e che quelli degli
// altri (link di Supabase, guida, scelta dell'area) non siano presi per nostri.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: "export { leggiIndirizzo, scriviIndirizzo } from './src/lib/indirizzoSegreteria'",
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
// Il posto con le chiavi in ordine, perché il confronto non dipenda da come
// l'oggetto è stato costruito.
const piatto = (v) =>
  v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, piatto(v[k])])) : v
const leggi = (hash, prova = false) => m.leggiIndirizzo(hash, { prova })
const andataRitorno = (posto) => piatto(leggi(m.scriviIndirizzo(posto)))

console.log('La voce')
ok('#corsi apre CORSI', leggi('#corsi')?.voce, 'corsi')
ok('senza cancelletto si apre DA FARE', leggi('')?.voce, 'dafare')
ok('il cancelletto da solo apre DA FARE', leggi('#')?.voce, 'dafare')
ok('#dafare apre DA FARE', leggi('#dafare')?.voce, 'dafare')
ok('ogni voce scritta si rilegge uguale',
  ['dafare', 'settimana', 'corsi', 'iscritti', 'richieste', 'presenze', 'statistiche', 'istruttori', 'importa', 'personale', 'esercizi', 'listino', 'regole', 'segnalazioni']
    .filter((voce) => andataRitorno({ voce })?.voce !== voce),
  [])

console.log('La scheda iscritto')
ok('la scheda di X è #iscritti/X', m.scriviIndirizzo({ voce: 'iscritti', persona: 'X' }), '#iscritti/X')
ok('#iscritti/X riapre la scheda di X', piatto(leggi('#iscritti/X')), { persona: 'X', voce: 'iscritti' })
ok('un id con lettere accentate, barre e spazi torna uguale',
  andataRitorno({ voce: 'iscritti', persona: 'p-prova-à/1 x' }),
  { persona: 'p-prova-à/1 x', voce: 'iscritti' })

console.log('La lezione aperta')
const lezione = { id: 'l-prova-12/3 à', inizio: '2026-09-28T18:30:00+02:00' }
const riletta = leggi(m.scriviIndirizzo({ voce: 'settimana', lezione }))
ok('la lezione riaperta è la stessa', riletta?.lezione?.id, lezione.id)
ok('e comincia alla stessa ora', riletta?.lezione?.inizio, lezione.inizio)
ok('la voce resta SETTIMANA', riletta?.voce, 'settimana')

console.log('La settimana e la sala')
ok('settimana e sala tornano uguali',
  andataRitorno({ voce: 'settimana', settimana: '2026-09-28', sala: 'tatami' }),
  { sala: 'tatami', settimana: '2026-09-28', voce: 'settimana' })
ok('anche la sola settimana',
  andataRitorno({ voce: 'settimana', settimana: '2026-09-28' }),
  { settimana: '2026-09-28', voce: 'settimana' })
ok('settimana, sala e lezione insieme',
  andataRitorno({ voce: 'settimana', settimana: '2026-09-28', sala: 'sala grande', lezione }),
  piatto({ voce: 'settimana', settimana: '2026-09-28', sala: 'sala grande', lezione }))

console.log('Gli indirizzi sbagliati portano a DA FARE')
ok('una voce che non c\'è', leggi('#pippo')?.voce, 'dafare')
ok('una scheda iscritto con un pezzo in più', leggi('#iscritti/X/altro')?.voce, 'dafare')
ok('e non apre nessuna scheda', leggi('#iscritti/X/altro')?.persona, undefined)
ok('fuori prova le segnalate non ci sono', leggi('#segnalate', false)?.voce, 'dafare')
ok('in prova le segnalate ci sono', leggi('#segnalate', true)?.voce, 'segnalate')

console.log('Gli indirizzi degli altri non sono della segreteria')
ok('il ritorno da un link di Supabase', leggi('#access_token=abc&x=1'), null)
ok('un link di Supabase scaduto', leggi('#error=access_denied&error_code=otp_expired'), null)
ok('la guida', leggi('#guida'), null)
ok('una pagina della guida', leggi('#guida/segreteria/da-fare'), null)
ok('la scelta dell\'area', leggi('#aree'), null)

console.log('Nell\'indirizzo non va altro')
const conTroppo = { voce: 'iscritti', persona: 'X', nome: 'Mario', cognome: 'Rossi', email: 'mario@esempio.it', note: 'allergico' }
const lezioneConTroppo = { ...lezione, corso: 'Karate bambini', istruttore: 'Gino' }
ok('i dati della persona non finiscono nell\'indirizzo',
  m.scriviIndirizzo(conTroppo),
  m.scriviIndirizzo({ voce: 'iscritti', persona: 'X' }))
ok('della lezione vanno solo id e inizio',
  m.scriviIndirizzo({ voce: 'settimana', settimana: '2026-09-28', sala: 'tatami', lezione: lezioneConTroppo, note: 'x' }),
  m.scriviIndirizzo({ voce: 'settimana', settimana: '2026-09-28', sala: 'tatami', lezione }))
ok('e nel testo non c\'è niente di quello che è stato tolto',
  /Mario|Rossi|esempio|allergico|Karate|Gino/.test(
    m.scriviIndirizzo(conTroppo) + m.scriviIndirizzo({ voce: 'settimana', lezione: lezioneConTroppo })),
  false)

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
