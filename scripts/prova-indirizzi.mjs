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
    contents: "export * from './src/lib/indirizzoSegreteria'",
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
  ['dafare', 'settimana', 'corsi', 'iscritti', 'richieste', 'presenze', 'statistiche', 'istruttori', 'personale', 'esercizi', 'listino', 'regole', 'segnalazioni']
    .filter((voce) => andataRitorno({ voce })?.voce !== voce),
  [])
// L'import da Excel sta dentro IMPOSTAZIONI: un vecchio link a #importa non porta a una voce che non c'è più.
ok('#importa non è più una voce: apre DA FARE', leggi('#importa')?.voce, 'dafare')

console.log('La scheda iscritto')
ok('la scheda di X è #iscritti/X', m.scriviIndirizzo({ voce: 'iscritti', persona: 'X' }), '#iscritti/X')
ok('#iscritti/X riapre la scheda di X', piatto(leggi('#iscritti/X')), { persona: 'X', voce: 'iscritti' })
ok('un id con lettere accentate, barre e spazi torna uguale',
  andataRitorno({ voce: 'iscritti', persona: 'p-prova-à/1 x' }),
  { persona: 'p-prova-à/1 x', voce: 'iscritti' })

console.log('Il modulo del nuovo iscritto')
ok('il modulo nuovo è #iscritti/nuovo', m.scriviIndirizzo({ voce: 'iscritti', nuovo: true }), '#iscritti/nuovo')
ok('#iscritti/nuovo riapre il modulo, senza scheda', piatto(leggi('#iscritti/nuovo')), { nuovo: true, voce: 'iscritti' })
ok('un id vero (uuid) resta una scheda',
  piatto(leggi('#iscritti/0b6c2f3e-8a1d-4f5e-9c7b-2d4e6f8a0b1c')), { persona: '0b6c2f3e-8a1d-4f5e-9c7b-2d4e6f8a0b1c', voce: 'iscritti' })
ok('anche un id di prova', piatto(leggi('#iscritti/p-nuovo')), { persona: 'p-nuovo', voce: 'iscritti' })
ok('Indietro dal modulo torna all\'elenco', m.dopoIndietro({ voce: 'iscritti', nuovo: true }, '#iscritti', { prova: false }), { voce: 'iscritti' })
ok('Avanti riapre il modulo', piatto(m.dopoIndietro({ voce: 'iscritti' }, '#iscritti/nuovo', { prova: false })), { nuovo: true, voce: 'iscritti' })
ok('ISCRITTI ritoccato chiude il modulo', m.postoDelMenu({ voce: 'iscritti', nuovo: true }, 'iscritti'), { voce: 'iscritti' })
ok('un\'altra voce lo chiude', m.postoDelMenu({ voce: 'iscritti', nuovo: true }, 'corsi'), { voce: 'corsi' })
ok('il modulo nuovo non è di altre voci', leggi('#presenze/nuovo')?.voce, 'dafare')

console.log('Il corso aperto')
ok('il corso X è #corsi/X', m.scriviIndirizzo({ voce: 'corsi', corso: 'X' }), '#corsi/X')
ok('#corsi/X riapre il corso X', piatto(leggi('#corsi/X')), { corso: 'X', voce: 'corsi' })
ok('un id di corso con lettere accentate, barre e spazi torna uguale',
  andataRitorno({ voce: 'corsi', corso: 'p-prova-à/1 x' }),
  { corso: 'p-prova-à/1 x', voce: 'corsi' })
ok('il corso nuovo è #corsi/nuovo', m.scriviIndirizzo({ voce: 'corsi', nuovo: true }), '#corsi/nuovo')
ok('#corsi/nuovo riapre il corso nuovo, senza corso', piatto(leggi('#corsi/nuovo')), { nuovo: true, voce: 'corsi' })
ok('un id di prova resta un corso', piatto(leggi('#corsi/c-nuovo')), { corso: 'c-nuovo', voce: 'corsi' })
ok('Indietro dal corso torna all\'elenco CORSI', m.dopoIndietro({ voce: 'corsi', corso: 'X' }, '#corsi', { prova: false }), { voce: 'corsi' })
ok('Avanti riapre il corso', piatto(m.dopoIndietro({ voce: 'corsi' }, '#corsi/X', { prova: false })), { corso: 'X', voce: 'corsi' })
ok('Indietro dal corso nuovo torna all\'elenco CORSI', m.dopoIndietro({ voce: 'corsi', nuovo: true }, '#corsi', { prova: false }), { voce: 'corsi' })
ok('CORSI ritoccato chiude il corso', m.postoDelMenu({ voce: 'corsi', corso: 'X' }, 'corsi'), { voce: 'corsi' })
ok('un\'altra voce chiude il corso', m.postoDelMenu({ voce: 'corsi', corso: 'X' }, 'iscritti'), { voce: 'iscritti' })
ok('il corso non va nell\'indirizzo di ISCRITTI', m.scriviIndirizzo({ voce: 'iscritti', corso: 'X' }), '#iscritti')
ok('la persona non va nell\'indirizzo di CORSI', m.scriviIndirizzo({ voce: 'corsi', persona: 'X' }), '#corsi')
ok('un corso con un pezzo in più porta a DA FARE', leggi('#corsi/X/altro')?.voce, 'dafare')
ok('un corso storpiato porta a DA FARE', leggi('#corsi/%E0')?.voce, 'dafare')
ok('#corsi/ si corregge in #corsi', m.indirizzoCorretto('#corsi/', { prova: false }), '#corsi')

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

console.log('La settimana nell\'indirizzo è una data vera')
ok('un mese che non c\'è non diventa una settimana', leggi('#settimana?dal=2026-13-45'), { voce: 'settimana' })
ok('nemmeno il 30 febbraio', leggi('#settimana?dal=2026-02-30'), { voce: 'settimana' })
ok('un giorno a metà settimana porta al suo lunedì', leggi('#settimana?dal=2026-09-30')?.settimana, '2026-09-28')
ok('e l\'indirizzo si corregge sul lunedì', m.indirizzoCorretto('#settimana?dal=2026-09-30', { prova: false }), '#settimana?dal=2026-09-28')

console.log('La barra in fondo')
ok('#iscritti/ è l\'elenco ISCRITTI', leggi('#iscritti/'), { voce: 'iscritti' })
ok('e l\'indirizzo si corregge in #iscritti', m.indirizzoCorretto('#iscritti/', { prova: false }), '#iscritti')

console.log('Il menu')
const inSettimana = { voce: 'settimana', settimana: '2026-09-28', sala: 'tatami', lezione }
ok('la stessa voce ritoccata chiude la lezione e tiene settimana e sala',
  piatto(m.postoDelMenu(inSettimana, 'settimana')),
  { sala: 'tatami', settimana: '2026-09-28', voce: 'settimana' })
ok('ISCRITTI ritoccato chiude la scheda',
  m.postoDelMenu({ voce: 'iscritti', persona: 'X' }, 'iscritti'), { voce: 'iscritti' })
ok('una voce diversa riparte da capo', m.postoDelMenu(inSettimana, 'corsi'), { voce: 'corsi' })
ok('e torna alla settimana di oggi', m.postoDelMenu({ voce: 'corsi' }, 'settimana'), { voce: 'settimana' })
ok('da un\'altra voce, la scheda di qualcuno', m.postoDelMenu({ voce: 'dafare' }, 'iscritti', { persona: 'X' }), { voce: 'iscritti', persona: 'X' })
ok('la stessa voce con una scheda apre quella scheda',
  m.postoDelMenu({ voce: 'iscritti', persona: 'X' }, 'iscritti', { persona: 'Y' }), { voce: 'iscritti', persona: 'Y' })
ok('da un\'altra voce, una lezione', piatto(m.postoDelMenu({ voce: 'dafare' }, 'settimana', { lezione })), piatto({ voce: 'settimana', lezione }))

console.log('Indietro e Avanti')
const ind = (ora, hash, prova = false) => m.dopoIndietro(ora, hash, { prova })
ok('torna alla voce di prima', ind({ voce: 'iscritti', persona: 'X' }, '#corsi'), { voce: 'corsi' })
ok('torna alla scheda', ind({ voce: 'iscritti' }, '#iscritti/X'), { voce: 'iscritti', persona: 'X' })
ok('il posto dove si è già: niente da fare', ind({ voce: 'iscritti', persona: 'X' }, '#iscritti/X'), null)
ok('la guida non è della segreteria', ind({ voce: 'corsi' }, '#guida/segreteria'), null)
ok('nemmeno un link di Supabase', ind({ voce: 'corsi' }, '#access_token=abc'), null)
ok('un indirizzo sconosciuto porta a DA FARE', ind({ voce: 'corsi' }, '#pippo'), { voce: 'dafare' })
ok('che si corregge in #dafare', m.indirizzoCorretto('#pippo', { prova: false }), '#dafare')
ok('un indirizzo già giusto non si corregge', m.indirizzoCorretto('#iscritti/X', { prova: false }), null)
ok('senza cancelletto non si scrive niente', m.indirizzoCorretto('', { prova: false }), null)
ok('il cancelletto degli altri non si tocca', m.indirizzoCorretto('#aree', { prova: false }), null)

console.log('Quale settimana si vede')
const chiave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const oggi = new Date('2026-10-01T10:00')
ok('prima la settimana della lezione aperta',
  chiave(m.settimanaDi({ voce: 'settimana', settimana: '2026-09-07', lezione: { id: 'l', inizio: '2026-09-23T18:30:00+02:00' } }, oggi)), '2026-09-21')
ok('poi quella dell\'indirizzo', chiave(m.settimanaDi({ voce: 'settimana', settimana: '2026-09-07' }, oggi)), '2026-09-07')
ok('se no quella di oggi', chiave(m.settimanaDi({ voce: 'settimana' }, oggi)), '2026-09-28')
ok('dalla mezzanotte', m.settimanaDi({ voce: 'settimana' }, oggi).getHours(), 0)

console.log('Il filtro dopo un clic')
const { filtroDopo } = m
ok('da DA FARE a ISCRITTI col filtro chiesto si apre quello', filtroDopo('dafare', 'iscritti', undefined, 'certificato'), 'certificato')
ok('da DA FARE a RICHIESTE col filtro chiesto si apre quello', filtroDopo('dafare', 'richieste', undefined, 'stampare'), 'stampare')
ok('da DA FARE a PRESENZE col filtro chiesto si apre quello', filtroDopo('dafare', 'presenze', undefined, 'senza-appello'), 'senza-appello')
ok('ISCRITTI ritoccato senza filtro chiesto tiene il filtro acceso', filtroDopo('iscritti', 'iscritti', 'certificato', undefined), 'certificato')
ok('RICHIESTE ritoccato senza filtro chiesto tiene il filtro acceso', filtroDopo('richieste', 'richieste', 'stampare', undefined), 'stampare')
ok('PRESENZE ritoccato senza filtro chiesto tiene il filtro acceso', filtroDopo('presenze', 'presenze', 'senza-appello', undefined), 'senza-appello')
ok('una voce diversa senza filtro chiesto riparte senza filtro', filtroDopo('iscritti', 'corsi', 'certificato', undefined), undefined)
ok('una voce diversa col filtro chiesto apre quello, non l\'acceso', filtroDopo('iscritti', 'richieste', 'certificato', 'stampare'), 'stampare')
ok('la stessa voce con un altro filtro chiesto passa a quello', filtroDopo('iscritti', 'iscritti', 'certificato', 'pagare'), 'pagare')
ok('la stessa voce senza filtri resta senza filtro', filtroDopo('iscritti', 'iscritti', undefined, undefined), undefined)

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
