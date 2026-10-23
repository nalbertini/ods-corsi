// ---------------------------------------------------------------------------
// L'area degli iscritti col database vero, senza browser né rete.
//
//   node scripts/prova-iscritto-supabase.mjs
//
// Le mappature dalle colonne di 101-iscritto.sql ai tipi di iscritto.ts, i
// messaggi per chi usa l'app (mai il testo grezzo dell'API), come si pulisce
// quel che scrive chi entra con l'email e il codice, chi può entrare, e
// quale strato dati sceglie `datiIscritto()`. Le funzioni vere si provano in
// supabase/prova/iscritto.sql.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}
const m = await impacchetta(`
  export * from './src/lib/iscrittoSupabase'
  export * from './src/lib/accessoIscritto'
  export { datiIscritto } from './src/lib/iscritto'
`)

console.log('\nDalle colonne ai tipi')
ok(
  'la scheda: i null diventano assenti, le quote restano',
  m.schedaDa({ id: 'a', nome: 'Luca', cognome: 'Rossi', corsi: [{ id: 'c', nome: 'Karate', colore: null }], certificato_scade: null, pagamento: 'in_parte', pagato_fino: null, quote: [{ anno: 2026, numero: 1, dal: '2026-09-01', al: null, mancano: 5 }], nato_il: '2010-05-01' }),
  { id: 'a', nome: 'Luca', cognome: 'Rossi', corsi: [{ id: 'c', nome: 'Karate' }], certificato: {}, pagamento: { stato: 'in_parte' }, quote: [{ anno: 2026, numero: 1, dal: '2026-09-01', mancano: 5 }], natoIl: '2010-05-01' },
)
{
  const r = { id: 'a', nome: 'L', cognome: 'R', corsi: null, certificato_scade: null, pagamento: 'pagato', pagato_fino: null, quote: null, nato_il: null }
  const con = m.schedaDa({ ...r, certificato_in_attesa_il: '2026-10-20T14:05:00+00:00' })
  ok('mandato: dal timestamp resta il giorno, e il tasto può esserci', [con.certificato.inAttesaIl, con.certificatoDaQui], ['2026-10-20', true])
  ok('colonna vuota (102 c\'è): niente in attesa, ma il tasto può esserci', [m.schedaDa({ ...r, certificato_in_attesa_il: null }).certificato.inAttesaIl, m.schedaDa({ ...r, certificato_in_attesa_il: null }).certificatoDaQui], [undefined, true])
  ok('senza la colonna (102 non c\'è): niente tasto', m.schedaDa(r).certificatoDaQui, undefined)
}
ok('la scheda senza corsi né quote: elenchi vuoti', m.schedaDa({ id: 'a', nome: 'L', cognome: 'R', corsi: null, certificato_scade: '2027-01-01', pagamento: 'pagato', pagato_fino: '2027-06-30', quote: null, nato_il: null }).corsi, [])
ok('la lezione: snake_case in camelCase', m.lezioneDa({ id: 'l', corso: 'Karate', colore: null, inizio: 'i', fine: 'f', stato: 'confermata', sala: null, istruttore: 'Anna', sostituto: true, altra_sala: true, straordinaria: false }), {
  id: 'l', corso: 'Karate', inizio: 'i', fine: 'f', stato: 'confermata', istruttore: 'Anna', sostituto: true, altraSala: true, straordinaria: false,
})
ok('la presenza', m.presenzaDa({ sessione_id: 's', inizio: 'i', corso: 'K', stato: null }), { sessioneId: 's', inizio: 'i', corso: 'K', stato: null })
ok('la presenza segnalata', m.segnalataDa({ id: 'x', sessione_id: 's', persona_id: 'p', il: 'ieri', nota: null, stato: 'nuova', gestita_il: null }), { id: 'x', sessioneId: 's', personaId: 'p', il: 'ieri', stato: 'nuova' })
ok('l\'aggiunta senza corsi', m.aggiuntaDa({ id: 'g', nome: 'T', cognome: 'R', corsi: null, creata_il: 'oggi', stato: 'nuova' }).corsi, [])
ok(
  'i dati del nucleo di un minorenne: niente dati da genitore',
  m.datiNucleoDa({ cognome: 'R', indirizzo: 'v', cap: '1', comune: 'C', email: 'e', telefono: 't', genitore_nome: null, genitore_cognome: null, genitore_codice_fiscale: null, nucleo_di: 'p' }),
  { cognome: 'R', indirizzo: 'v', cap: '1', comune: 'C', email: 'e', telefono: 't', nucleoDi: 'p' },
)
ok('i dati del nucleo di un adulto: anche i suoi da genitore', m.datiNucleoDa({ cognome: 'R', indirizzo: 'v', cap: '1', comune: 'C', email: 'e', telefono: 't', genitore_nome: 'L', genitore_cognome: 'R', genitore_codice_fiscale: null, nucleo_di: 'p' }).genitoreCodiceFiscale, '')
const ric = m.ricevutaDa({ id: 'r', anno: 2026, numero: 3, data: '2026-10-01', ente: 'ods', intestatario: { nome: 'L' }, voci: [{ descrizione: 'Quota', importo: 10, dal: null, al: null }], totale: 10, pagato: 10, anticipo: 0, creata_il: 'c', annullata_il: null }, 'p')
ok('la ricevuta: persona data da chi chiama, non annullata', [ric.personaId, ric.annullataIl, ric.voci[0].dal], ['p', undefined, undefined])

console.log('\nChi sono io')
ok('un iscritto attivo', m.ioDa({ id: 'a', nome: 'L', cognome: 'R', ruolo: 'iscritto', attiva: true }), { id: 'a', nome: 'L', cognome: 'R' })
ok('un iscritto disattivato non entra', m.ioDa({ id: 'a', nome: 'L', cognome: 'R', ruolo: 'iscritto', attiva: false }), null)
ok('il personale non è un iscritto', m.ioDa({ id: 'a', nome: 'L', cognome: 'R', ruolo: 'segreteria', attiva: true }), null)
ok('nessuna scheda', m.ioDa(null), null)

console.log('\nI messaggi: mai il testo grezzo')
const dice = (e, seg) => m.guaioIscritto(e, seg).message
ok('rete', dice({ message: 'TypeError: Failed to fetch' }), 'Il server non risponde: c’è rete?')
ok('funzione che non c\'è (101 non lanciato)', dice({ code: 'PGRST202', message: 'Could not find the function public.iscritto_scheda' }), 'L’area degli iscritti non è ancora attiva: chiedi alla segreteria')
ok('non è tuo', dice({ code: '42501', message: 'permission denied for x' }), 'Non puoi vedere questa persona: esci e rientra con la tua email')
ok('altro: niente testo dell\'API', dice({ code: 'XX000', message: 'relation "persone" boom' }), 'Non riesco a leggere i tuoi dati: riprova fra poco')
ok('segnalando passa la regola già in italiano', dice({ code: '22023', message: 'Questa lezione non è tra le tue' }, true), 'Questa lezione non è tra le tue')
ok('non segnalando, la stessa regola non passa', dice({ code: '22023', message: 'Questa lezione non è tra le tue' }, false), 'Non riesco a leggere i tuoi dati: riprova fra poco')

console.log('\nL\'accesso con email e codice')
ok('l\'email si pulisce', m.emailPulita('  Luca.Rossi@Esempio.IT '), 'luca.rossi@esempio.it')
ok('un\'email che non lo è', m.emailPulita('luca'), null)
ok('il codice con gli spazi di quando si copia', m.codicePulito(' 123 456 '), '123456')
ok('un codice corto', m.codicePulito('12345'), null)
ok('un codice con lettere', m.codicePulito('12345a'), null)
ok('troppe richieste', m.perchéNonParte({ status: 429, message: 'email rate limit exceeded' }), 'Troppe richieste: aspetta un minuto e riprova')
ok('accesso con l\'email spento', m.perchéNonParte({ code: 'otp_disabled' }), 'L’accesso con l’email non è ancora attivo: chiedi alla segreteria')
ok('errore sconosciuto all\'invio: niente testo grezzo', m.perchéNonParte({ message: 'smtp exploded 0xdead' }), 'Il codice non è partito: riprova fra poco')
ok('codice sbagliato o scaduto', m.perchéNonVale({ message: 'Token has expired or is invalid' }), m.CODICE_SBAGLIATO)
ok('troppi tentativi', m.perchéNonVale({ status: 429 }), 'Troppi tentativi: aspetta un minuto e riprova')
ok('entra un iscritto', m.esitoAccesso({ id: 'a', nome: 'L', cognome: 'R', ruolo: 'iscritto', attiva: true }), { io: { id: 'a', nome: 'L', cognome: 'R' } })
ok('email di nessuna scheda: messaggio chiaro e sessione chiusa', m.esitoAccesso(null), { errore: m.NON_ISCRITTO, chiudi: true })
ok('il messaggio dice di usare l\'email data in segreteria', m.NON_ISCRITTO.startsWith('Questa email non risulta tra gli iscritti: usa quella data in segreteria'), true)
ok('email del personale: lo dice e non lo disconnette', m.esitoAccesso({ id: 'a', nome: 'L', cognome: 'R', ruolo: 'segreteria', attiva: true }), { errore: m.E_PERSONALE, chiudi: false })
ok('scheda disattivata: come nessuna scheda', m.esitoAccesso({ id: 'a', nome: 'L', cognome: 'R', ruolo: 'iscritto', attiva: false }), { errore: m.NON_ISCRITTO, chiudi: true })

console.log('\nQuale strato dati')
ok('senza server è la prova', (await m.datiIscritto()).modo, 'prova')

console.log(guai ? `\n${guai} da sistemare` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
