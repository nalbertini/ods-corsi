// ---------------------------------------------------------------------------
// La ricevuta per email, senza browser.
//
//   node scripts/prova-ricevute-email.mjs
//
// Fatta la ricevuta, la famiglia la riceve in PDF all'email di contatto. Il
// database sceglie l'indirizzo e tiene un tentativo per riga
// (`76-ricevute-email.sql`, provato da `supabase/prova/ricevute-email.sql`);
// qui le parole che la segreteria vede, il testo della mail e la modalità
// prova, che simula senza rete con le stesse regole.
//
// Le funzioni stanno in `src/lib/ricevuteEmail.ts`:
//   SOGLIA_MAIL_GIORNO = 400
//   type EsitoInvio = 'mandata' | 'non partita'
//   type MotivoNonPartita = 'posta' | 'soglia' | 'senza-indirizzo' | 'annullata' | 'manca-sql' | 'manca-funzione' | 'manca-password'
//   type EsitoMandata = { esito: 'mandata'; indirizzo: string } | { esito: 'non partita'; motivo: MotivoNonPartita }
//   interface InvioRicevuta { ricevutaId: string; creatoIl: string; esito: EsitoInvio; indirizzo?: string; motivo?: string }
//   statoPosta(r: Pick<Ricevuta, 'creataIl' | 'annullataIl'>, invii: InvioRicevuta[], email: string | null, dal: string | null)
//     → { testo: string; tono: 'fatto' | 'aspetta' | null; tasto: 'Manda per email' | 'Manda di nuovo' | null; spento: boolean; motivo: string | null } | null
//   confermaEmail(email: string | null, genitore: string | null, spuntata: boolean) → { spunta: string | null; nota: string }
//   domandaManda(r: Pick<Ricevuta, 'numero' | 'anno'>, indirizzo: string, genitore: string | null, giaMandata: string | null) → { domanda: string; resto: string; si: string }
//   avvisoDopoRicevuta(r: Pick<Ricevuta, 'numero' | 'anno'>, esito: EsitoMandata | null) → string
//   avvisoManda(r: Pick<Ricevuta, 'numero' | 'anno'>, esito: EsitoMandata) → string
//   motivoDaErrore(e: unknown) → MotivoNonPartita
//   mandateOggi(invii: InvioRicevuta[], ora: Date) → number
//   testoMail(r: Pick<Ricevuta, 'numero' | 'anno' | 'data' | 'totale' | 'intestatario'>) → { oggetto: string; testo: string; allegato: string }
// E nella segreteria (`Segreteria` in `src/lib/segreteria.ts`, la prova in `segreteriaProva.ts`):
//   mandaRicevuta(id: string): Promise<EsitoMandata>
//   inviiRicevute(personaId: string): Promise<InvioRicevuta[]>
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '', pathname: '/' }, addEventListener() {} }

// Oggi, per la prova, è mercoledì 21 ottobre 2026 a mezzogiorno.
const OGGI = new Date(2026, 9, 21, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI]))
  }
  static now() {
    return OGGI
  }
}

// La modalità prova non deve mai uscire in rete: ogni chiamata si conta.
let chiamate = 0
globalThis.fetch = async () => {
  chiamate++
  throw new Error('la modalità prova è uscita in rete')
}

const m = await impacchetta(
  "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export { archivio } from './src/lib/archivioProva'; export { creaDatiProva } from './src/lib/datiProva'; export { ENTE_PREDEFINITO, nomeFileRicevuta } from './src/lib/ricevute'; export { nomeCorso } from './src/lib/listino'; export { CONTATTI } from './src/lib/sito'",
)
// Le regole della Edge Function (src/lib/ricevutaMail.ts, copiata in supabase/functions/ricevuta-email/mail.ts).
let fz = {}
try {
  fz = await impacchetta("export * from './src/lib/ricevutaMail'")
} catch {
  console.log('(manca src/lib/ricevutaMail.ts)')
}
// Il modulo nuovo, se c'è: se manca, ogni prova lo dice da sé.
let e = {}
try {
  e = await impacchetta("export * from './src/lib/ricevuteEmail'")
} catch {
  console.log('(manca src/lib/ricevuteEmail.ts)')
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const lib = (nome) => (typeof e[nome] === 'function' ? e[nome] : () => `manca ${nome}`)
const statoPosta = lib('statoPosta')
const confermaEmail = lib('confermaEmail')
const domandaManda = lib('domandaManda')
const avvisoDopoRicevuta = lib('avvisoDopoRicevuta')
const avvisoManda = lib('avvisoManda')
const motivoDaErrore = lib('motivoDaErrore')
const mandateOggi = lib('mandateOggi')
const testoMail = lib('testoMail')

const DAL = '2026-10-15T08:00:00.000Z'
const fatta = { creataIl: '2026-10-21T09:00:00.000Z' }
const vecchia = { creataIl: '2026-09-02T09:00:00.000Z' }
const invio = (creatoIl, esito, indirizzo = 'mamma@esempio.it', motivo) => ({ ricevutaId: 'r1', creatoIl, esito, indirizzo, ...(motivo ? { motivo } : {}) })

console.log('1. lo stato della mail nello storico')
ok('mandata: verde, con la data e l\'indirizzo, e MANDA DI NUOVO',
  statoPosta(fatta, [invio('2026-10-21T09:01:00.000Z', 'mandata')], 'mamma@esempio.it', DAL),
  { testo: '✓ Mandata il 21/10/2026 a mamma@esempio.it', tono: 'fatto', tasto: 'Manda di nuovo', spento: false, motivo: null })
ok('la data è quella di Roma, anche alle 23:30 UTC',
  statoPosta(fatta, [invio('2026-10-20T23:30:00.000Z', 'mandata')], 'mamma@esempio.it', DAL)?.testo,
  '✓ Mandata il 21/10/2026 a mamma@esempio.it')
ok('l\'indirizzo è quello a cui è partita, anche se in scheda ora è un altro',
  statoPosta(fatta, [invio('2026-10-21T09:01:00.000Z', 'mandata')], 'nuova@esempio.it', DAL)?.testo,
  '✓ Mandata il 21/10/2026 a mamma@esempio.it')
ok('mandata due volte e poi un tentativo andato male: resta mandata, coll\'ultima mandata e quante volte',
  statoPosta(fatta, [invio('2026-10-21T09:01:00.000Z', 'mandata'), invio('2026-10-22T09:01:00.000Z', 'mandata', 'mamma@esempio.it'), invio('2026-10-23T09:01:00.000Z', 'non partita', 'mamma@esempio.it', 'posta')], 'mamma@esempio.it', DAL)?.testo,
  '✓ Mandata il 22/10/2026 a mamma@esempio.it · 2 volte')
ok('l\'ultima anche se le righe arrivano in disordine',
  statoPosta(fatta, [invio('2026-10-22T09:01:00.000Z', 'mandata', 'nuova@esempio.it'), invio('2026-10-21T09:01:00.000Z', 'mandata'), invio('2026-10-21T10:01:00.000Z', 'mandata')], 'mamma@esempio.it', DAL)?.testo,
  '✓ Mandata il 22/10/2026 a nuova@esempio.it · 3 volte')
const ultimaMandata = lib('ultimaMandata')
ok('MANDA DI NUOVO chiede con la data dell\'ultimo invio partito',
  ultimaMandata([invio('2026-10-22T09:01:00.000Z', 'mandata'), invio('2026-10-21T09:01:00.000Z', 'mandata'), invio('2026-10-23T09:01:00.000Z', 'non partita', 'mamma@esempio.it', 'posta')]), '2026-10-22T09:01:00.000Z')
ok('mai partita: nessuna data', ultimaMandata([invio('2026-10-23T09:01:00.000Z', 'non partita', 'mamma@esempio.it', 'posta')]), null)
ok('non partita: gialla, con MANDA PER EMAIL',
  statoPosta(fatta, [invio('2026-10-21T09:01:00.000Z', 'non partita', 'mamma@esempio.it', 'posta')], 'mamma@esempio.it', DAL),
  { testo: '… Non mandata: la mail non è partita', tono: 'aspetta', tasto: 'Manda per email', spento: false, motivo: null })
ok('fatta senza spunta: «Non mandata»',
  statoPosta(fatta, [], 'mamma@esempio.it', DAL),
  { testo: 'Non mandata', tono: null, tasto: 'Manda per email', spento: false, motivo: null })
ok('fatta prima della funzione: lo dice, e si manda solo a mano',
  statoPosta(vecchia, [], 'mamma@esempio.it', DAL),
  { testo: 'Fatta prima dell’invio per email', tono: null, tasto: 'Manda per email', spento: false, motivo: null })
ok('senza email di contatto: tasto spento, e dice dove aggiungerla',
  statoPosta(fatta, [], null, DAL),
  { testo: 'Non mandata: nessuna email in scheda', tono: null, tasto: 'Manda per email', spento: true, motivo: 'Nessuna email in scheda: aggiungila in PERSONA.' })
ok('anche se è vecchia',
  statoPosta(vecchia, [], null, DAL)?.spento, true)
ok('mandata, ma il contatto poi tolto: MANDA DI NUOVO spento',
  statoPosta(fatta, [invio('2026-10-21T09:01:00.000Z', 'mandata')], null, DAL),
  { testo: '✓ Mandata il 21/10/2026 a mamma@esempio.it', tono: 'fatto', tasto: 'Manda di nuovo', spento: true, motivo: 'Nessuna email in scheda: aggiungila in PERSONA.' })
ok('annullata e mandata prima: lo dice, grigio, senza tasto',
  statoPosta({ ...fatta, annullataIl: '2026-10-21T10:00:00.000Z' }, [invio('2026-10-20T09:01:00.000Z', 'mandata')], 'mamma@esempio.it', DAL),
  { testo: 'Mandata il 20/10/2026 a mamma@esempio.it', tono: null, tasto: null, spento: false, motivo: null })
ok('annullata e mai mandata: nessun tasto',
  statoPosta({ ...fatta, annullataIl: '2026-10-21T10:00:00.000Z' }, [], 'mamma@esempio.it', DAL)?.tasto, null)
ok('senza il file SQL lanciato lo storico non dice niente della mail',
  statoPosta(fatta, [], 'mamma@esempio.it', null), null)

const rigaEmail = lib('rigaEmail')
ok('per l\'amministrazione: la data dell\'ultima mandata, senza indirizzo',
  rigaEmail([{ ricevutaId: 'r1', creatoIl: '2026-10-20T23:30:00.000Z', esito: 'mandata' }, { ricevutaId: 'r1', creatoIl: '2026-10-22T09:00:00.000Z', esito: 'non partita' }]), 'Mandata il 21/10/2026')
ok('o «Non mandata»', rigaEmail([{ ricevutaId: 'r1', creatoIl: '2026-10-21T09:00:00.000Z', esito: 'non partita' }]), 'Non mandata')

console.log('\n2. la domanda di FAI LA RICEVUTA')
ok('adulto con email di contatto: spunta e nota',
  confermaEmail('sara.bianchi@esempio.it', null, true),
  { spunta: 'Manda per email a sara.bianchi@esempio.it', nota: 'Email della scheda. Se è sbagliata togli la spunta: la ricevuta si fa senza mail.' })
ok('minore: è l\'email del genitore, e lo dice',
  confermaEmail('mamma@esempio.it', 'Rossi Laura', true),
  { spunta: 'Manda per email a mamma@esempio.it', nota: 'Email del genitore, Rossi Laura. Se è sbagliata togli la spunta: la ricevuta si fa senza mail.' })
ok('spunta tolta: si manda dopo dallo storico',
  confermaEmail('mamma@esempio.it', 'Rossi Laura', false),
  { spunta: 'Manda per email a mamma@esempio.it', nota: 'Senza spunta la ricevuta si fa senza mail: si può mandare dopo con MANDA PER EMAIL, dallo storico.' })
ok('senza email di contatto: niente spunta, e la frase',
  confermaEmail(null, null, true),
  { spunta: null, nota: 'Nessuna email in scheda: la ricevuta non si manda. Il PDF si scarica come sempre.' })
ok('anche per un minore', confermaEmail(null, 'Rossi Laura', true)?.spunta, null)
ok('un contatto di soli spazi è come non averlo', confermaEmail('   ', null, true)?.spunta, null)
const daMandare = lib('daMandare')
ok('si manda con l\'email di contatto e la spunta', daMandare('mamma@esempio.it', true), true)
ok('spunta tolta: niente mail', daMandare('mamma@esempio.it', false), false)
ok('senza email di contatto: niente mail, anche spuntata', [daMandare(null, true), daMandare('  ', true)], [false, false])
const genitoreDellaMail = lib('genitoreDellaMail')
const minore = { nome: 'Marco', cognome: 'Rossi', natoIl: '2017-01-01', genitore: ' Rossi Laura ' }
ok('minore: la mail è del genitore, per nome', genitoreDellaMail({ data: '2026-10-21', intestatario: minore }), 'Rossi Laura')
ok('adulto: nessun genitore, anche se scritto', genitoreDellaMail({ data: '2026-10-21', intestatario: { ...minore, natoIl: '1990-01-01' } }), null)
ok('minore senza genitore scritto: nessun nome', genitoreDellaMail({ data: '2026-10-21', intestatario: { ...minore, genitore: '' } }), null)
ok('minore il giorno della ricevuta, anche se ora è maggiorenne', genitoreDellaMail({ data: '2026-10-21', intestatario: { ...minore, natoIl: '2008-10-22' } }), 'Rossi Laura')

console.log('\n3. la domanda di MANDA PER EMAIL e MANDA DI NUOVO')
ok('la prima volta',
  domandaManda({ numero: 10, anno: 2026 }, 'mamma@esempio.it', 'Rossi Laura', null),
  { domanda: 'Mandare la ricevuta n. 10/2026 a mamma@esempio.it?', resto: 'Email del genitore, Rossi Laura. Il PDF va allegato alla mail; la ricevuta non cambia.', si: 'Manda' })
ok('di nuovo: con la data del primo invio',
  domandaManda({ numero: 12, anno: 2026 }, 'mamma@esempio.it', 'Rossi Laura', '2026-10-21T09:01:00.000Z'),
  { domanda: 'Mandare di nuovo la ricevuta n. 12/2026 a mamma@esempio.it?', resto: 'Email del genitore, Rossi Laura. È già partita il 21/10/2026: la famiglia la riceve un’altra volta, uguale.', si: 'Manda di nuovo' })
ok('un adulto',
  domandaManda({ numero: 13, anno: 2026 }, 'sara.bianchi@esempio.it', null, null)?.resto,
  'Email della scheda. Il PDF va allegato alla mail; la ricevuta non cambia.')

console.log('\n4. l\'avviso dopo FAI LA RICEVUTA: la ricevuta c\'è sempre')
const r12 = { numero: 12, anno: 2026 }
ok('mandata', avvisoDopoRicevuta(r12, { esito: 'mandata', indirizzo: 'mamma@esempio.it' }),
  'Ricevuta n. 12/2026 fatta e mandata a mamma@esempio.it. Il PDF è scaricato.')
ok('la posta non risponde', avvisoDopoRicevuta(r12, { esito: 'non partita', motivo: 'posta' }),
  'Ricevuta n. 12/2026 fatta, il PDF è scaricato. La mail non è partita: riprova con MANDA PER EMAIL.')
ok('la soglia', avvisoDopoRicevuta(r12, { esito: 'non partita', motivo: 'soglia' }),
  'Ricevuta n. 12/2026 fatta, il PDF è scaricato. Oggi sono partite 400 mail, il massimo: riprova domani con MANDA PER EMAIL.')
ok('senza spunta o senza email', avvisoDopoRicevuta(r12, null),
  'Ricevuta n. 12/2026 fatta: il PDF è scaricato. Non mandata per email.')
ok('il file SQL non lanciato: lo nomina', avvisoDopoRicevuta(r12, { esito: 'non partita', motivo: 'manca-sql' }),
  'Ricevuta n. 12/2026 fatta, il PDF è scaricato. La mail non parte: va lanciato 76-ricevute-email.sql.')
ok('la funzione non pubblicata: lo dice', avvisoDopoRicevuta(r12, { esito: 'non partita', motivo: 'manca-funzione' }),
  'Ricevuta n. 12/2026 fatta, il PDF è scaricato. La mail non parte: va pubblicata la funzione ricevuta-email.')
ok('partita ma non segnata nello storico: lo dice, perché non la si rimandi', avvisoDopoRicevuta(r12, { esito: 'mandata', indirizzo: 'mamma@esempio.it', registrata: false }),
  'Ricevuta n. 12/2026 fatta e mandata a mamma@esempio.it. Il PDF è scaricato. Lo storico non segna la mail: non mandarla di nuovo.')
ok('il PDF non si è scaricato ma la mail è partita', avvisoDopoRicevuta(r12, { esito: 'mandata', indirizzo: 'mamma@esempio.it' }, false),
  'Ricevuta n. 12/2026 fatta e mandata a mamma@esempio.it. Il PDF non si è scaricato: riscaricalo con PDF dallo storico.')
ok('il PDF non si è scaricato e la mail non c\'era', avvisoDopoRicevuta(r12, null, false),
  'Ricevuta n. 12/2026 fatta, non mandata per email. Il PDF non si è scaricato: riscaricalo con PDF dallo storico.')
ok('il PDF non si è scaricato e la mail non è partita', avvisoDopoRicevuta(r12, { esito: 'non partita', motivo: 'posta' }, false),
  'Ricevuta n. 12/2026 fatta. Il PDF non si è scaricato: riscaricalo con PDF dallo storico. La mail non è partita: riprova con MANDA PER EMAIL.')
const siRiprova = lib('siRiprova')
ok('si riprova dall\'avviso solo se la posta non ha risposto',
  [{ esito: 'non partita', motivo: 'posta' }, { esito: 'non partita', motivo: 'soglia' }, { esito: 'non partita', motivo: 'manca-sql' }, { esito: 'mandata', indirizzo: 'a@b.it' }, null].map((x) => siRiprova(x)),
  [true, false, false, false, false])
const restaDopoRicevuta = lib('restaDopoRicevuta')
ok('l\'avviso dopo la ricevuta se ne va da solo, se è andata',
  [restaDopoRicevuta({ esito: 'mandata', indirizzo: 'a@b.it' }, true), restaDopoRicevuta(null, true), restaDopoRicevuta({ esito: 'non partita', motivo: 'posta' }, true)], [false, false, false])
ok('resta se il PDF non c\'è o se la mail partita non è segnata',
  [restaDopoRicevuta(null, false), restaDopoRicevuta({ esito: 'mandata', indirizzo: 'a@b.it', registrata: false }, true)], [true, true])

console.log('\n5. l\'avviso dopo MANDA PER EMAIL')
ok('mandata', avvisoManda({ numero: 10, anno: 2026 }, { esito: 'mandata', indirizzo: 'mamma@esempio.it' }), 'Ricevuta n. 10/2026 mandata a mamma@esempio.it')
ok('la posta non risponde', avvisoManda(r12, { esito: 'non partita', motivo: 'posta' }), 'La mail non è partita: controlla la connessione e riprova.')
ok('la soglia', avvisoManda(r12, { esito: 'non partita', motivo: 'soglia' }), 'Oggi sono partite 400 mail, il massimo: riprova domani.')
ok('annullata', avvisoManda(r12, { esito: 'non partita', motivo: 'annullata' }), 'La ricevuta è annullata: non si manda.')
ok('senza email di contatto', avvisoManda(r12, { esito: 'non partita', motivo: 'senza-indirizzo' }), 'Nessuna email in scheda: aggiungila in PERSONA.')
ok('il file SQL non lanciato', avvisoManda(r12, { esito: 'non partita', motivo: 'manca-sql' }), 'La mail non parte: va lanciato 76-ricevute-email.sql.')
ok('la stessa ricevuta già tre volte in un giorno', avvisoManda(r12, { esito: 'non partita', motivo: 'troppe' }), 'Questa ricevuta è già partita 3 volte nelle ultime 24 ore: riprova domani.')
ok('partita ma non segnata', avvisoManda(r12, { esito: 'mandata', indirizzo: 'mamma@esempio.it', registrata: false }),
  'Ricevuta n. 12/2026 mandata a mamma@esempio.it. Lo storico non la segna: non mandarla di nuovo.')
const restaDopoManda = lib('restaDopoManda')
ok('dopo MANDA: se ne va da solo se è partita, resta se no o se non è segnata',
  [restaDopoManda({ esito: 'mandata', indirizzo: 'a@b.it' }), restaDopoManda({ esito: 'non partita', motivo: 'posta' }), restaDopoManda({ esito: 'mandata', indirizzo: 'a@b.it', registrata: false })], [false, true, true])

console.log('\n6. gli errori grezzi diventano un motivo, mai testo dell\'API')
ok('la rete', motivoDaErrore(Object.assign(new Error('Failed to send a request to the Edge Function'), { name: 'FunctionsFetchError' })), 'posta')
ok('la funzione che non c\'è', motivoDaErrore(Object.assign(new Error('Edge Function returned a non-2xx status code'), { name: 'FunctionsHttpError', context: { status: 404 } })), 'manca-funzione')
ok('la funzione SQL che non c\'è', motivoDaErrore({ code: 'PGRST202', message: 'Could not find the function public.controlla_invio_ricevuta(ricevuta) in the schema cache' }), 'manca-sql')
ok('o la tabella', motivoDaErrore({ code: '42P01', message: 'relation "invii_ricevute" does not exist' }), 'manca-sql')
ok('qualsiasi altra cosa: la posta', motivoDaErrore(new Error('SMTP 535 5.7.8 Authentication credentials invalid')), 'posta')
ok('anche niente', motivoDaErrore(undefined), 'posta')
ok('il tipo della funzione vince', [motivoDaErrore({ tipo: 'soglia' }), motivoDaErrore({ tipo: 'troppe' }), motivoDaErrore({ tipo: 'annullata' })], ['soglia', 'troppe', 'annullata'])
ok('un tipo che non conosciamo: la posta', motivoDaErrore({ tipo: 'boh' }), 'posta')
// `\b` su undefined e null: «annullata» contiene «null», ed è la parola giusta.
const grezzo = /error|failed|smtp|pgrst|edge function|status|credentials|\bundefined\b|\bnull\b/i
const motivi = ['posta', 'soglia', 'troppe', 'senza-indirizzo', 'annullata', 'manca-sql', 'manca-funzione', 'manca-password']
ok('nessun avviso ha parole dell\'API',
  motivi.flatMap((motivo) => [avvisoDopoRicevuta(r12, { esito: 'non partita', motivo }), avvisoManda(r12, { esito: 'non partita', motivo })]).filter((t) => typeof t !== 'string' || t.startsWith('manca ') || grezzo.test(t)),
  [])

console.log('\n7. la soglia: 400 mandate oggi, giorno di Roma')
ok('la soglia è 400', e.SOGLIA_MAIL_GIORNO, 400)
const ora = new DateVera('2026-10-21T10:00:00.000Z')
ok('contano le mandate di oggi, non le non partite né quelle di ieri sera',
  mandateOggi([
    invio('2026-10-20T21:59:00.000Z', 'mandata'), // 23:59 di ieri a Roma
    invio('2026-10-20T22:00:00.000Z', 'mandata'), // mezzanotte di oggi a Roma
    invio('2026-10-21T09:00:00.000Z', 'mandata'),
    invio('2026-10-21T09:30:00.000Z', 'non partita', 'x@esempio.it', 'posta'),
  ], ora), 2)

console.log('\n8. il testo della mail')
const mail = {
  numero: 12, anno: 2026, data: '2026-10-21', totale: 8000,
  intestatario: { nome: 'Marco', cognome: 'Rossi', codiceFiscale: 'RSSMRC17A01L219X', genitore: 'Rossi Laura', genitoreCodiceFiscale: 'RSSLRA85C41L219Y', indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', natoIl: '2017-01-01' },
}
const t = testoMail(mail)
ok('l\'oggetto', t?.oggetto, 'Ricevuta n. 12/2026 per Marco Rossi · Officine Dello Sport')
ok('il corpo: due righe, col telefono della palestra',
  t?.testo,
  `Buongiorno, in allegato la ricevuta n. 12/2026 del 21 ottobre 2026 per Marco Rossi: 80,00 €.\n\nPer qualsiasi domanda chiamaci al ${m.CONTATTI.telefono}. A presto in palestra, Officine Dello Sport.`)
ok('il PDF allegato si chiama come quello scaricato', [t?.allegato, m.nomeFileRicevuta(mail)], ['ricevuta-12-2026-rossi-marco.pdf', 'ricevuta-12-2026-rossi-marco.pdf'])
const strano = { numero: 3, anno: 2026, intestatario: { nome: 'Zoë Anna', cognome: 'D’Àngelo' } }
ok('accenti e apostrofi: come nomeCorso di listino.ts', [m.nomeFileRicevuta(strano), `ricevuta-3-2026-${m.nomeCorso('D’Àngelo Zoë Anna').replace(/ /g, '-')}.pdf`],
  ['ricevuta-3-2026-d-angelo-zoe-anna.pdf', 'ricevuta-3-2026-d-angelo-zoe-anna.pdf'])
ok('niente codici fiscali, indirizzo, nascita',
  ['RSSMRC17A01L219X', 'RSSLRA85C41L219Y', 'Via Roma', '10093', 'Collegno', '2017'].filter((x) => typeof t !== 'object' || `${t.oggetto} ${t.testo}`.includes(x)), [])

console.log('\n9. la modalità prova simula, senza rete, con le stesse regole')
m.creaDatiProva()
const s = m.creaSegreteriaProva()
const manda = (id) => (typeof s.mandaRicevuta === 'function' ? s.mandaRicevuta(id) : Promise.resolve('manca mandaRicevuta'))
const invii = (p) => (typeof s.inviiRicevute === 'function' ? s.inviiRicevute(p) : Promise.resolve('manca inviiRicevute'))
const voce = { descrizione: 'QUOTA ASSOCIATIVA', quantita: 1, prezzo: 3000, pagamenti: [{ data: '2026-10-21', importo: 3000, metodo: 'Bonifico' }] }
const fai = (personaId, nome, cognome) => s.emettiRicevuta({ data: '2026-10-21', personaId, ente: m.ENTE_PREDEFINITO, intestatario: { nome, cognome }, voci: [voce], anticipo: 0 })
const sara = await s.salvaPersona({ nome: 'Sara', cognome: 'Bianchi', email: 'sara.bianchi@esempio.it' })
const teo = await s.salvaPersona({ nome: 'Teo', cognome: 'Verdi' })
const rs = await fai(sara, 'Sara', 'Bianchi')
const rt = await fai(teo, 'Teo', 'Verdi')
ok('fare la ricevuta non manda niente da sé', await invii(sara), [])
ok('mandata all\'email della scheda', await manda(rs.id), { esito: 'mandata', indirizzo: 'sara.bianchi@esempio.it' })
ok('e resta registrata', (await invii(sara)).map?.((i) => [i.ricevutaId === rs.id, i.esito, i.indirizzo]), [[true, 'mandata', 'sara.bianchi@esempio.it']])
await manda(rs.id)
ok('MANDA DI NUOVO: una riga per tentativo', (await invii(sara)).length, 2)
ok('senza email: non parte', await manda(rt.id), { esito: 'non partita', motivo: 'senza-indirizzo' })
ok('e non lascia righe', await invii(teo), [])
await s.annullaRicevuta(rs.id)
ok('annullata: non si manda', await manda(rs.id), { esito: 'non partita', motivo: 'annullata' })
ok('annullare non ha mandato niente', (await invii(sara)).length, 2)

const marco = await s.salvaPersona({ nome: 'Marco', cognome: 'Rossi', email: 'mamma@esempio.it' })
const rm = await s.emettiRicevuta({ data: '2026-10-21', personaId: marco, ente: m.ENTE_PREDEFINITO, intestatario: { nome: 'Marco', cognome: 'Rossi', natoIl: '2017-01-01', genitore: 'Rossi Laura' }, voci: [voce], anticipo: 0 })
ok('minore: va all\'email in scheda, quella del genitore', await manda(rm.id), { esito: 'mandata', indirizzo: 'mamma@esempio.it' })

const rv = await fai(sara, 'Sara', 'Bianchi')
await manda(rv.id)
await manda(rv.id)
ok('la terza volta in un giorno parte ancora', await manda(rv.id), { esito: 'mandata', indirizzo: 'sara.bianchi@esempio.it' })
ok('la quarta no: la stessa ricevuta al più 3 volte in 24 ore', await manda(rv.id), { esito: 'non partita', motivo: 'troppe' })
ok('e non lascia righe, come il database', (await invii(sara)).filter((i) => i.ricevutaId === rv.id).length, 3)

// La soglia: 400 «mandate» oggi, giorno di Roma, di tutte le ricevute. Quelle di ieri sera non contano.
const giaFatte = m.archivio.dati.inviiRicevute ?? []
const oggiMandate = giaFatte.filter((i) => i.esito === 'mandata').length
const finta = (creatoIl) => ({ ricevutaId: 'altra', creatoIl, esito: 'mandata', indirizzo: 'x@esempio.it' })
m.archivio.dati.inviiRicevute = [
  ...giaFatte,
  ...Array.from({ length: 30 }, () => finta('2026-10-20T21:30:00.000Z')), // 23:30 di ieri a Roma
  ...Array.from({ length: 399 - oggiMandate }, () => finta('2026-10-20T22:30:00.000Z')), // 00:30 di oggi a Roma
]
const ru = await fai(sara, 'Sara', 'Bianchi')
ok('399 mandate oggi: parte la quattrocentesima', await manda(ru.id), { esito: 'mandata', indirizzo: 'sara.bianchi@esempio.it' })
const rz = await fai(sara, 'Sara', 'Bianchi')
ok('alla quattrocentunesima: la soglia', await manda(rz.id), { esito: 'non partita', motivo: 'soglia' })
ok('e resta la riga «non partita», col motivo', (await invii(sara)).filter((i) => i.ricevutaId === rz.id).map((i) => [i.esito, i.motivo]), [['non partita', 'soglia']])
ok('mai una chiamata in rete', chiamate, 0)

console.log('\n10. la funzione ricevuta-email: il testo è lo stesso, l\'indirizzo lo sceglie il database')
const { readFileSync } = await import('node:fs')
const leggi = (f) => readFileSync(f, 'utf8')
ok('mail.ts è la copia di src/lib/ricevutaMail.ts', leggi('supabase/functions/ricevuta-email/mail.ts') === leggi('src/lib/ricevutaMail.ts'), true)
const fn = leggi('supabase/functions/ricevuta-email/index.ts')
ok('usa la copia', fn.includes("from './mail.ts'"), true)
ok('l\'indirizzo da indirizzo_ricevuta, mai dal corpo', [fn.includes("rpc('indirizzo_ricevuta'"), /corpo\??\.(indirizzo|email|to)\b/.test(fn)], [true, false])
ok('controlla col token di chi preme, registra solo il server', [fn.includes("suo.rpc('controlla_invio_ricevuta'"), fn.includes("admin.rpc('registra_invio_ricevuta'"), fn.includes("suo.rpc('registra_invio_ricevuta'")], [true, true, false])
ok('decide con le regole provate qui sotto', ['leggiCorpo', 'noDalControllo', 'decidiInvio', 'rispostaMandata'].filter((f) => !fn.includes(`${f}(`)), [])
ok('nei log niente indirizzo', (fn.match(/console\.\w+\([^)]*\)/g) ?? []).filter((x) => /\bindirizzo\b|\bto\b|\.message/.test(x)), [])

console.log('\n11. le decisioni della funzione ricevuta-email, senza posta né database')
const fzf = (nome) => (typeof fz[nome] === 'function' ? fz[nome] : () => `manca ${nome}`)
const leggiCorpo = fzf('leggiCorpo')
const noDalControllo = fzf('noDalControllo')
const decidiInvio = fzf('decidiInvio')
const rispostaMandata = fzf('rispostaMandata')
const ID = '0b6e1c1e-1d1e-4c4e-9a9a-0123456789ab'
const PDF = Buffer.from('%PDF-1.7 ricevuta').toString('base64')
ok('il corpo: solo ricevuta e PDF, un indirizzo si ignora', leggiCorpo({ ricevuta: ID, pdf: PDF, indirizzo: 'ladro@esempio.it', to: 'x@y.it' }), { ricevuta: ID, pdf: PDF })
ok('senza ricevuta', leggiCorpo({ pdf: PDF }), { guaio: 'Manca la ricevuta', stato: 400, tipo: 'posta' })
ok('un PDF che non è un PDF', leggiCorpo({ ricevuta: ID, pdf: Buffer.from('<html>').toString('base64') }), { guaio: 'Il PDF non va', stato: 400, tipo: 'posta' })
ok('un PDF troppo grosso', leggiCorpo({ ricevuta: ID, pdf: 'JVBE' + 'A'.repeat(3 * 1024 * 1024) })?.tipo, 'posta')
ok('niente corpo', leggiCorpo(null)?.guaio, 'Manca la ricevuta')
ok('controllo: annullata, dal codice e non dal testo', noDalControllo('55000'), { guaio: 'La ricevuta è annullata: non si manda', stato: 409, tipo: 'annullata' })
ok('controllo: la stessa ricevuta tre volte in 24 ore', noDalControllo('54000'), { guaio: 'Questa ricevuta è già partita 3 volte nelle ultime 24 ore', stato: 429, tipo: 'troppe' })
ok('controllo: il file SQL non lanciato', [noDalControllo('PGRST202')?.tipo, noDalControllo('42883')?.tipo], ['manca-sql', 'manca-sql'])
ok('controllo: chi non è della segreteria', noDalControllo('42501'), { guaio: 'Serve un accesso da segreteria', stato: 403, tipo: 'posta' })
ok('controllo: altro', noDalControllo('XX000'), { guaio: 'La ricevuta non si legge', stato: 400, tipo: 'posta' })
const c = { ha_indirizzo: true, oltre_soglia: false, segreteria: true }
ok('si manda all\'indirizzo del database', decidiInvio(c, 'mamma@esempio.it', true), { manda: true, a: 'mamma@esempio.it' })
ok('senza indirizzo in scheda: non parte, e niente riga', decidiInvio({ ...c, ha_indirizzo: false }, null, true), { manda: false, guaio: 'Nessuna email in scheda', stato: 409, tipo: 'senza-indirizzo', registra: null })
ok('l\'indirizzo sparito fra il controllo e l\'invio: uguale', decidiInvio(c, '', true)?.tipo, 'senza-indirizzo')
ok('oltre la soglia: non parte, e resta la riga «soglia»', decidiInvio({ ...c, oltre_soglia: true }, 'mamma@esempio.it', true), { manda: false, guaio: 'Oggi sono partite 400 mail, il massimo', stato: 429, tipo: 'soglia', registra: 'soglia' })
ok('senza la password della posta: lo dice, e resta la riga', decidiInvio(c, 'mamma@esempio.it', false), { manda: false, guaio: 'Manca la password della posta fra i segreti della funzione: vedi supabase/LEGGIMI.md, «La ricevuta per email»', stato: 501, tipo: 'manca-password', registra: 'manca SMTP_PASSWORD' })
ok('partita: alla segreteria dice a chi', rispostaMandata(c, 'mamma@esempio.it', true), { esito: 'mandata', indirizzo: 'mamma@esempio.it' })
ok('all\'amministrazione no', rispostaMandata({ ...c, segreteria: false }, 'mamma@esempio.it', true), { esito: 'mandata' })
ok('partita ma non registrata: lo dice', rispostaMandata(c, 'mamma@esempio.it', false), { esito: 'mandata', indirizzo: 'mamma@esempio.it', registrata: false })

console.log('\n12. mandaRicevuta col database vero finto: non lancia mai, ogni guaio diventa un motivo')
{
  const riga = { id: ID, anno: 2026, numero: 12, data: '2026-10-21', persona_id: 'p1', ente: m.ENTE_PREDEFINITO, intestatario: { nome: 'Marco', cognome: 'Rossi' }, voci: [voce], totale: 3000, pagato: 3000, anticipo: 0, note: null, creata_il: '2026-10-21T09:00:00Z', annullata_il: null }
  const finto = ({ ricevuta = { data: riga, error: null }, invoca = { data: { esito: 'mandata', indirizzo: 'mamma@esempio.it' }, error: null }, tabella = {}, rpc = {}, rompi = false } = {}) => {
    const reg = []
    const catena = (t) => {
      const c = {
        select: () => c, eq: () => c, in: () => c, order: () => c, maybeSingle: () => c,
        single: () => c,
        then: (bene, male) => Promise.resolve(t === 'ricevute' && ricevuta !== null ? ricevuta : (tabella[t] ?? { data: [], error: null })).then(bene, male),
      }
      return c
    }
    const db = {
      from: (t) => {
        if (rompi) throw new TypeError('Failed to fetch')
        return catena(t)
      },
      rpc: async (nome, args) => (reg.push(['rpc', nome, args]), rpc[nome] ?? { data: [], error: null }),
      functions: { invoke: async (nome, o) => (reg.push(['invoke', nome, o]), invoca) },
    }
    return { seg: m.creaSegreteriaSupabase(db), reg }
  }
  const httpErr = (status, corpo) => ({ data: null, error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { name: 'FunctionsHttpError', context: new Response(corpo === undefined ? 'Not found' : JSON.stringify(corpo), { status }) }) })
  const lancia = async (f) => {
    try {
      return await f()
    } catch (e) {
      return `LANCIA: ${e?.message}`
    }
  }
  {
    const { seg, reg } = finto()
    ok('partita: dice a chi', await lancia(() => seg.mandaRicevuta(ID)), { esito: 'mandata', indirizzo: 'mamma@esempio.it' })
    const corpo = reg.find((x) => x[0] === 'invoke')?.[2]?.body ?? {}
    ok('alla funzione ricevuta-email, col corpo di sole ricevuta e PDF', [reg.find((x) => x[0] === 'invoke')?.[1], Object.keys(corpo).sort(), corpo.ricevuta, Buffer.from(String(corpo.pdf), 'base64').subarray(0, 4).toString()], ['ricevuta-email', ['pdf', 'ricevuta'], ID, '%PDF'])
  }
  ok('partita ma non registrata', await lancia(() => finto({ invoca: { data: { esito: 'mandata', indirizzo: 'mamma@esempio.it', registrata: false }, error: null } }).seg.mandaRicevuta(ID)), { esito: 'mandata', indirizzo: 'mamma@esempio.it', registrata: false })
  ok('il database che non risponde: non lancia, è la posta', await lancia(() => finto({ rompi: true }).seg.mandaRicevuta(ID)), { esito: 'non partita', motivo: 'posta' })
  ok('la ricevuta che non si legge: uguale', await lancia(() => finto({ ricevuta: { data: null, error: { code: 'PGRST116', message: 'grezzo' } } }).seg.mandaRicevuta(ID)), { esito: 'non partita', motivo: 'posta' })
  ok('la funzione non pubblicata (404)', await lancia(() => finto({ invoca: httpErr(404) }).seg.mandaRicevuta(ID)), { esito: 'non partita', motivo: 'manca-funzione' })
  ok('la soglia, dal tipo della risposta', await lancia(() => finto({ invoca: httpErr(429, { guaio: 'Oggi sono partite 400 mail, il massimo', tipo: 'soglia' }) }).seg.mandaRicevuta(ID)), { esito: 'non partita', motivo: 'soglia' })
  ok('tre volte la stessa', await lancia(() => finto({ invoca: httpErr(429, { guaio: 'x', tipo: 'troppe' }) }).seg.mandaRicevuta(ID)), { esito: 'non partita', motivo: 'troppe' })
  ok('la rete che cade', await lancia(() => finto({ invoca: { data: null, error: Object.assign(new Error('Failed to send a request to the Edge Function'), { name: 'FunctionsFetchError' }) } }).seg.mandaRicevuta(ID)), { esito: 'non partita', motivo: 'posta' })
  ok('senza 76-ricevute-email.sql lo storico è vuoto', await lancia(() => finto({ tabella: { ricevute: { data: [{ id: ID }], error: null }, invii_ricevute: { data: null, error: { code: '42P01', message: 'grezzo' } } }, ricevuta: null }).seg.inviiRicevute('p1')), [])
  ok('gli esiti per l\'amministrazione: vuoti', await lancia(() => finto({ rpc: { esiti_invio_ricevuta: { data: null, error: { code: 'PGRST202', message: 'grezzo' } } } }).seg.esitiInvioRicevuta(ID)), [])
  ok('e da quando: nessuno', await lancia(() => finto({ tabella: { impostazioni: { data: null, error: { code: '42703', message: 'grezzo' } } } }).seg.ricevuteEmailDal()), null)
}

console.log('\n13. gli indirizzi lunghi vanno a capo, anche sul telefono')
const css = leggi('src/styles.css')
// Le regole che hanno `sel` fra i loro selettori, una dopo l'altra.
const regola = (sel) => [...css.matchAll(/(?:^|\n)([^{}\n@/][^{}]*)\{([^}]*)\}/g)].filter((x) => x[1].split(',').map((y) => y.trim()).includes(sel)).map((x) => x[2]).join(' ')
ok('la casella sotto la domanda (Manda per email a …)', /overflow-wrap:\s*anywhere/.test(regola('.sg-conferma-spunta .modulo-privacy')), true)
ok('la domanda di MANDA', /overflow-wrap:\s*anywhere/.test(regola('.sg-conferma-domanda')), true)
ok('l\'avviso in basso, che non spinge fuori Chiudi', [/overflow-wrap:\s*anywhere/.test(regola('.sg-avviso > .grow')), /min-width:\s*0/.test(regola('.sg-avviso > .grow'))], [true, true])

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
if (guai) process.exit(1)
