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
import { readFileSync } from 'node:fs'

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
ok('il «+» nell\'email è un «+», non uno spazio', m.accessoDalLink('?email=mario+x@esempio.it&codice=123456'), { email: 'mario+x@esempio.it', codice: '123456' })
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
ok('il messaggio dice di usare l\'email data alla palestra', m.NON_ISCRITTO, 'Non troviamo questa email tra gli iscritti. Prova con quella che hai dato alla palestra, oppure chiama la segreteria.')
ok('il personale è mandato all\'accesso dello staff', m.E_PERSONALE, 'Questa email è del personale della palestra. Usa l’accesso dello staff.')
ok('email del personale: lo dice e non lo disconnette', m.esitoAccesso({ id: 'a', nome: 'L', cognome: 'R', ruolo: 'segreteria', attiva: true }), { errore: m.E_PERSONALE, chiudi: false })
ok('scheda disattivata: come nessuna scheda', m.esitoAccesso({ id: 'a', nome: 'L', cognome: 'R', ruolo: 'iscritto', attiva: false }), { errore: m.NON_ISCRITTO, chiudi: true })

console.log('\nEntra con Google')
ok('i testi di Google', [m.GOOGLE_ANNULLATO, m.GOOGLE_NON_RIUSCITO, m.NO_RETE], [
  'Accesso annullato. Puoi riprovare o usare il codice via email.',
  'Qualcosa non ha funzionato. Riprova o usa il codice via email.',
  'Il server non risponde: c’è rete?',
])
const base = 'https://app.officinedellosport.it/iscritti/'
const ritorno = (u) => m.esitoRitornoGoogle(u)
ok('ritorno annullato (query)', ritorno(base + '?error=access_denied'), { tipo: 'errore', messaggio: m.GOOGLE_ANNULLATO })
ok('ritorno annullato (hash)', ritorno(base + '#error=access_denied&error_code=access_denied'), { tipo: 'errore', messaggio: m.GOOGLE_ANNULLATO })
ok('ritorno annullato (solo error_code)', ritorno(base + '?error_code=access_denied'), { tipo: 'errore', messaggio: m.GOOGLE_ANNULLATO })
ok('ritorno con altro errore', ritorno(base + '?error=server_error&error_description=boom+0xdead'), { tipo: 'errore', messaggio: m.GOOGLE_NON_RIUSCITO })
ok('ritorno con la sola error_description', ritorno(base + '#error_description=boom'), { tipo: 'errore', messaggio: m.GOOGLE_NON_RIUSCITO })
ok('ritorno con ?code: nessun errore', ritorno(base + '?code=abc'), { tipo: 'nessuno' })
ok('ritorno con #access_token: nessun errore', ritorno(base + '#access_token=a&refresh_token=b'), { tipo: 'nessuno' })
ok('nessun ritorno', ritorno(base), { tipo: 'nessuno' })
ok('url pulito: via code, state, error e hash di auth', m.urlPulito(base + '?code=1&state=2&error=e&error_code=c&error_description=d&x=1#access_token=a'), base + '?x=1')
ok('url pulito: via hash di auth', m.urlPulito(base + '?x=1#access_token=a'), base + '?x=1')
ok('url pulito: via hash d\'errore', m.urlPulito(base + '#error=access_denied'), base)
ok('url pulito: un hash che non è di auth resta', m.urlPulito(base + '#aree'), base + '#aree')
ok('url pulito: altri parametri e percorso intatti', m.urlPulito(base + '?a=1&b=2'), base + '?a=1&b=2')
ok('Google non c\'è dalla Home dell\'iPhone', m.googleDisponibile(true), false)
ok('Google c\'è nel browser', m.googleDisponibile(false), true)
ok('opzioni di Google: si torna alla stessa pagina, pulita', m.opzioniGoogle(base + '?code=1&x=1'), { provider: 'google', options: { redirectTo: base + '?x=1' } })
ok('Google non parte: rete', m.perchéNonParteGoogle({ message: 'TypeError: Failed to fetch' }), m.NO_RETE)
ok('Google non parte: troppe richieste', m.perchéNonParteGoogle({ status: 429 }), 'Troppe richieste: aspetta un minuto e riprova')
ok('Google non parte: provider spento (code)', m.perchéNonParteGoogle({ code: 'provider_disabled' }), m.GOOGLE_NON_RIUSCITO)
ok('Google non parte: validation_failed', m.perchéNonParteGoogle({ code: 'validation_failed' }), m.GOOGLE_NON_RIUSCITO)
ok('Google non parte: provider is not enabled', m.perchéNonParteGoogle({ message: 'provider is not enabled' }), m.GOOGLE_NON_RIUSCITO)
ok('Google non parte: altro, niente testo grezzo', m.perchéNonParteGoogle({ message: 'boom 0xdead' }), m.GOOGLE_NON_RIUSCITO)

const iscritto = { id: 'a', nome: 'L', cognome: 'R', ruolo: 'iscritto', attiva: true }
ok('Google torna con una riga di iscritto: entra', m.esitoAccesso(iscritto), { io: { id: 'a', nome: 'L', cognome: 'R' } })
ok('Google torna senza riga in persone: non iscritto, sessione chiusa', m.esitoAccesso(null), { errore: m.NON_ISCRITTO, chiudi: true })
ok('Google torna con l\'email del personale: non si chiude', m.esitoAccesso({ ...iscritto, ruolo: 'admin' }), { errore: m.E_PERSONALE, chiudi: false })

// Un finto client: conta rpc e signOut, e risponde a from('persone').select().eq().maybeSingle().
const finto = (riga, errore = null, { rpcErrore = null, sessione = { user: { id: 'u1' } }, oauthErrore = null } = {}) => {
  const chiamate = { rpc: [], signOut: 0 }
  const oauth = []
  const c = {
    rpc: async (nome) => { chiamate.rpc.push(nome); return { data: null, error: rpcErrore } },
    auth: {
      signOut: async () => { chiamate.signOut++; return { error: null } },
      getSession: async () => ({ data: { session: sessione }, error: null }),
      signInWithOAuth: async (o) => { oauth.push(o); return { data: {}, error: oauthErrore } },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: errore ? null : riga, error: errore }) }) }) }),
  }
  return { c, chiamate, oauth }
}
const entra = async (riga, errore) => {
  const { c, chiamate } = finto(riga, errore)
  let esito
  try { esito = { io: await m.entraDopoGoogle(c, 'u1') } } catch (e) { esito = { errore: e instanceof Error ? e.message : String(e) } }
  return [esito, chiamate]
}
{
  const [e, ch] = await entra(iscritto)
  ok('entraDopoGoogle: iscritto entra, collega e non chiude', [e, ch], [{ io: { id: 'a', nome: 'L', cognome: 'R' } }, { rpc: ['collega_utente'], signOut: 0 }])
}
{
  const [e, ch] = await entra(null)
  ok('entraDopoGoogle: non iscritto, errore e signOut', [e, ch], [{ errore: m.NON_ISCRITTO }, { rpc: ['collega_utente'], signOut: 1 }])
}
{
  const [e, ch] = await entra({ ...iscritto, ruolo: 'segreteria' })
  ok('entraDopoGoogle: personale, errore e NIENTE signOut', [e, ch], [{ errore: m.E_PERSONALE }, { rpc: ['collega_utente'], signOut: 0 }])
}
{
  const [e, ch] = await entra(null, { code: 'XX000', message: 'boom' })
  ok('entraDopoGoogle: lettura che fallisce, signOut e errore in italiano', [e, ch], [{ errore: 'Non riesco a leggere i tuoi dati: riprova fra poco' }, { rpc: ['collega_utente'], signOut: 1 }])
}

{
  // La chiamata che lega l'account cade (rete): non è «non iscritto», e la sessione resta.
  const { c, chiamate } = finto(null, null, { rpcErrore: { message: 'Failed to fetch' } })
  let errore
  try { await m.entraDopoGoogle(c, 'u1') } catch (e) { errore = e instanceof Error ? e.message : String(e) }
  ok('entraDopoGoogle: collega_utente che cade, errore di rete e niente signOut', [errore, chiamate.signOut], [m.NO_RETE, 0])
}

// Il ritorno da Google, con un client finto passato da chi chiama.
const riprendi = async (indirizzo, riga, errore, opzioni) => {
  const { c, chiamate } = finto(riga, errore, opzioni)
  let esito
  try { esito = await m.riprendiDaGoogle(indirizzo, async () => c) } catch (e) { esito = { lancia: e instanceof Error ? e.message : String(e) } }
  return [esito, chiamate]
}
{
  const [e, ch] = await riprendi(base, iscritto)
  ok('riprendiDaGoogle: indirizzo senza ritorno, niente da fare', [e, ch.rpc], [null, []])
}
{
  const [e] = await riprendi(base + '?error=access_denied', iscritto)
  ok('riprendiDaGoogle: annullato, il messaggio', e, { errore: m.GOOGLE_ANNULLATO })
}
{
  const [e] = await riprendi(base + '#access_token=a', iscritto, null, { sessione: null })
  ok('riprendiDaGoogle: ritorno ma nessuna sessione, errore', e, { errore: m.GOOGLE_NON_RIUSCITO })
}
{
  const [e, ch] = await riprendi(base + '#access_token=a', iscritto)
  ok('riprendiDaGoogle: sessione e iscritto, entra e collega', [e, ch.rpc], [{ io: { id: 'a', nome: 'L', cognome: 'R' } }, ['collega_utente']])
}
{
  const [e, ch] = await riprendi(base + '#access_token=a', null)
  ok('riprendiDaGoogle: sessione ma non iscritto, errore e signOut', [e, ch.signOut], [{ errore: m.NON_ISCRITTO }, 1])
}
{
  const [e] = await riprendi(base + '#access_token=a', null, { code: 'XX000', message: 'boom' })
  ok('riprendiDaGoogle: lettura che fallisce, errore in italiano', e, { errore: 'Non riesco a leggere i tuoi dati: riprova fra poco' })
}
{
  const { c, oauth } = finto(iscritto, null, { oauthErrore: { message: 'boom 0xdead' } })
  let errore
  try { await m.entraConGoogle(base + '?x=1#access_token=a', async () => c) } catch (e) { errore = e instanceof Error ? e.message : String(e) }
  ok('entraConGoogle: errore, niente testo grezzo', errore, m.GOOGLE_NON_RIUSCITO)
  ok('entraConGoogle: parte con le opzioni di Google', oauth, [{ provider: 'google', options: { redirectTo: base + '?x=1' } }])
}
{
  let errore
  try { await m.entraConGoogle(base, async () => { throw new TypeError('anon key undefined') }) } catch (e) { errore = e instanceof Error ? e.message : String(e) }
  ok('entraConGoogle: il client che non nasce, niente testo grezzo', errore, m.GOOGLE_NON_RIUSCITO)
}

console.log('\nIl link nella mail')
ok('email e codice nell\'indirizzo: puliti', m.accessoDalLink('?email=Mario@Esempio.it&codice=123456'), { email: 'mario@esempio.it', codice: '123456' })
ok('il codice con gli spazi, come lo si copia', m.accessoDalLink('?codice=12%2034%2056&email=a@b.it'), { email: 'a@b.it', codice: '123456' })
ok('senza parametri dell\'accesso: niente da fare', [m.accessoDalLink(''), m.accessoDalLink('?da=volantino')], [null, null])
ok('email che non è un indirizzo: errore detto per chi usa l\'app', m.accessoDalLink('?email=x&codice=123456'), { errore: m.LINK_NON_VALE })
ok('manca il codice o è corto: stesso errore', [m.accessoDalLink('?email=a@b.it'), m.accessoDalLink('?email=a@b.it&codice=12345')], [{ errore: m.LINK_NON_VALE }, { errore: m.LINK_NON_VALE }])
ok('manca l\'email: stesso errore', m.accessoDalLink('?codice=123456'), { errore: m.LINK_NON_VALE })
ok('via email e codice, restano gli altri parametri', m.indirizzoSenzaAccesso('/iscritti', '?da=volantino&email=a@b.it&codice=123456'), '/iscritti?da=volantino')
ok('via tutto: resta il solo percorso, senza «?»', m.indirizzoSenzaAccesso('/iscritti', '?email=a@b.it&codice=123456'), '/iscritti')
{
  const tsx = readFileSync('src/components/AccessoIscritto.tsx', 'utf8')
  const toglie = tsx.search(/indirizzoSenzaAccesso\(/)
  ok('legge il link con accessoDalLink', /accessoDalLink\(window\.location\.search\)/.test(tsx), true)
  ok('toglie email e codice dalla barra (replaceState) prima di entrare', toglie > -1 && /history\.replaceState/.test(tsx) && toglie < tsx.indexOf('entraConCodice(', tsx.indexOf('accessoDalLink')), true)
  ok('il campo del codice a mano resta', tsx.includes('autoComplete="one-time-code"'), true)
}

console.log('\nQuale strato dati')
ok('senza server è la prova', (await m.datiIscritto()).modo, 'prova')

console.log(guai ? `\n${guai} da sistemare` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
