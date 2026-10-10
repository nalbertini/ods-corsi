// ---------------------------------------------------------------------------
// Il modulo di iscrizione in prova, senza browser.
//
//   node scripts/prova-richieste.mjs
//
// Le richieste di prova devono rispondere come `invia_iscrizione` e
// `accogli_iscrizione` di `supabase/06-iscrizioni.sql` (provate da
// `supabase/prova/iscrizioni.sql`): gli stessi rifiuti, e una richiesta
// accolta che diventa un iscritto visto dalla segreteria e dall'appello.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaRichiesteProva } from './src/lib/richiesteProva'; export { creaRichiesteSupabase } from './src/lib/richiesteSupabase'; export { anni, anniScritti, certificatoDaPortare, chiFirma, dataDaCf, controlla, domandaUscita, FILE, firmaDaRifare, minorenne, problemi } from './src/lib/richieste'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { caricaLuoghi, carattereControllo, lettereCognome, lettereNome, luogoDaCf } from './src/lib/codiceFiscale'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
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

// Oggi, per la prova, è sabato 26 settembre 2026 a mezzogiorno.
const OGGI = new Date(2026, 8, 26, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI]))
  }
  static now() {
    return OGGI
  }
}

const m = await import(modulo)
const r = m.creaRichiesteProva()
const s = m.creaSegreteriaProva()
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}

const adulto = (cambi = {}) => ({
  nome: 'Luca', cognome: 'Rossi', natoIl: '1996-01-01', natoA: 'Torino', codiceFiscale: 'rsslcu96a01 l219k',
  indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'Luca@Esempio.it', telefono: '347 111 2233',
  corsi: ['judo-adulti'], formula: 'annuale', regolamento: true, ...cambi,
})
const genitore = { genitoreNome: 'Paola', genitoreCognome: 'Rossi', genitoreCodiceFiscale: 'RSSPLA80A41L219P' }

console.log('\n1. i corsi fra cui scegliere')
{
  const c = await r.corsiAperti()
  ok('ci sono i corsi della stagione', c.length > 10, true)
  ok('in ordine di nome', c.map((x) => x.nome).join() === [...c].map((x) => x.nome).sort((a, b) => a.localeCompare(b, 'it')).join(), true)
  const judo = (await s.corsi()).find((x) => x.id === 'judo-principianti')
  await s.archiviaCorso(judo.id, false)
  ok('un corso archiviato non si sceglie', (await r.corsiAperti()).some((x) => x.id === 'judo-principianti'), false)

  // Gli orari dei corsi aperti, per «Ti iscrivi anche tu?»: come `orari_aperti()` di 48-orari-aperti.sql.
  const orari = await r.orariAperti()
  const judo3 = orari.filter((o) => o.corsoId === 'judo-3')
  ok('gli orari: Judo 3 il lunedì, mercoledì e venerdì alle 18, un’ora', judo3, [1, 3, 5].map((giorno) => ({ corsoId: 'judo-3', giorno, ora: '18:00', durata: 60 })))
  ok('gli orari: solo corso, giorno, ora e durata', [...new Set(orari.map((o) => Object.keys(o).sort().join()))], ['corsoId,durata,giorno,ora'])
  ok('gli orari: un corso archiviato non c’è', orari.some((o) => o.corsoId === 'judo-principianti'), false)
  // Un giorno chiuso dalla segreteria (al = ieri) non c'è più; gli altri giorni del corso restano.
  const mercoledi = (await s.corsi()).find((x) => x.id === 'judo-3').ricorrenze.find((x) => x.giorno === 3)
  await s.togliRicorrenza(mercoledi.id)
  // Cominciata prima di oggi: togliRicorrenza la chiude a ieri invece di cancellarla, e la segreteria non la vede più.
  ok('il mercoledì di Judo 3 era già cominciato: si chiude, non sparisce', mercoledi.dal < '2026-09-26', true)
  ok('chiuso: la segreteria non lo vede più fra i giorni del corso', (await s.corsi()).find((x) => x.id === 'judo-3').ricorrenze.some((x) => x.id === mercoledi.id), false)
  ok('una ricorrenza finita ieri non c’è; il lunedì e il venerdì restano', (await r.orariAperti()).filter((o) => o.corsoId === 'judo-3').map((o) => o.giorno), [1, 5])
  ok('gli orari: ci sono tutti i corsi aperti che hanno un orario', [...new Set(orari.map((o) => o.corsoId))].sort(), (await r.corsiAperti()).map((c) => c.id).sort())
}

console.log('\n2. cosa passa e cosa no: gli stessi messaggi del database')
{
  ok('manca il cognome', await errore(() => r.invia(adulto({ cognome: ' ' }))), 'Mancano: cognome')
  ok('manca il luogo di nascita', await errore(() => r.invia(adulto({ natoA: '' }))), 'Mancano: luogo di nascita')
  ok('CAP corto', await errore(() => r.invia(adulto({ cap: '1009' }))), 'Un campo non va: il CAP ha 5 cifre')
  ok('codice fiscale corto', await errore(() => r.invia(adulto({ codiceFiscale: 'RSSLCU' }))), 'Un campo non va: il codice fiscale ha 16 caratteri, lettere e numeri')
  ok('data a caso', await errore(() => r.invia(adulto({ natoIl: 'ieri' }))), 'La data di nascita non si capisce')
  ok('nato domani', await errore(() => r.invia(adulto({ natoIl: '2026-09-27' }))), 'La data di nascita non torna')
  ok('nessun corso', await errore(() => r.invia(adulto({ corsi: [] }))), 'Scegli almeno un corso')
  ok('un corso chiuso', await errore(() => r.invia(adulto({ corsi: ['judo-principianti'] }))), "Uno dei corsi scelti non c'è più: ricarica la pagina")
  ok('un minore senza genitore', await errore(() => r.invia(adulto({ natoIl: '2017-03-01' }))), 'Per un minore servono nome, cognome e codice fiscale del genitore')
  ok('diciotto anni compiuti ieri: adulto', m.minorenne('2008-09-25'), false)
  ok('diciotto anni domani: minore', m.minorenne('2008-09-27'), true)
  const oggi = new Date(2026, 9, 2)
  ok('certificato: senza data, nessuno', m.certificatoDaPortare('', ['Judo'], oggi), 'nessuno')
  ok('certificato: 5 anni, nessuno', m.certificatoDaPortare('2021-01-01', ['Judo bambini'], oggi), 'nessuno')
  ok('certificato: 6 anni oggi, normale', m.certificatoDaPortare('2020-10-02', ['Judo bambini'], oggi), 'normale')
  ok('certificato: 11 anni a judo, normale', m.certificatoDaPortare('2015-01-01', ['Judo ragazzi'], oggi), 'normale')
  ok('certificato: 12 anni a judo, agonistico', m.certificatoDaPortare('2014-10-02', ['Judo ragazzi'], oggi), 'agonistico')
  ok('certificato: adulto ad aikido, agonistico', m.certificatoDaPortare('1990-05-05', ['Pilates', 'AIKIDO'], oggi), 'agonistico')
  ok('certificato: adulto a lotta, agonistico', m.certificatoDaPortare('1990-05-05', ['Lotta libera'], oggi), 'agonistico')
  ok('certificato: adulto a pilates, normale', m.certificatoDaPortare('1990-05-05', ['Pilates'], oggi), 'normale')
}

console.log('\n2b. il codice fiscale, letto')
{
  const minore = (cambi = {}) => adulto({ nome: 'Giulia', codiceFiscale: 'RSSGLI17C41L219G', natoIl: '2017-03-01', ...genitore, ...cambi })
  ok('manca, detto per nome', await errore(() => r.invia(adulto({ codiceFiscale: '' }))), 'Mancano: codice fiscale')
  ok('manca la data, detto per nome', await errore(() => r.invia(adulto({ natoIl: '' }))), 'Mancano: data di nascita')
  ok('l’ultima lettera sbagliata', await errore(() => r.invia(adulto({ codiceFiscale: 'RSSLCU96A01L219X' }))), 'Il codice fiscale non torna: controlla di averlo copiato giusto')
  ok('due caratteri scambiati', await errore(() => r.invia(adulto({ codiceFiscale: 'RSSLCU69A01L219K' }))), 'Il codice fiscale non torna: controlla di averlo copiato giusto')
  ok('un altro giorno di nascita', await errore(() => r.invia(adulto({ natoIl: '1996-01-02' }))), 'Il codice fiscale e la data di nascita non dicono lo stesso giorno: controlla l’uno e l’altra')
  ok('l’omocodia passa', m.controlla(adulto({ nome: 'Mario', codiceFiscale: 'RSSMRA85T10A56NH', natoIl: '1985-12-10' })), null)
  ok('una donna: il giorno più quaranta', m.controlla(minore()), null)
  ok('il genitore sbagliato di una lettera', await errore(() => r.invia(minore({ genitoreCodiceFiscale: 'RSSPLA80A41L219X' }))), 'Il codice fiscale del genitore non torna: controlla di averlo copiato giusto')
  ok('il genitore col codice del figlio', await errore(() => r.invia(minore({ genitoreCodiceFiscale: 'RSSGLI17C41L219G' }))), 'Il codice fiscale del genitore è lo stesso di chi si iscrive')
  ok('il genitore minorenne', await errore(() => r.invia(minore({ genitoreCodiceFiscale: 'RSSMRC15E05L219V' }))), 'Il codice fiscale del genitore è di un minorenne')
  ok('un numero nel nome', await errore(() => r.invia(adulto({ nome: 'Luca2' }))), 'Un campo non va: nome e cognome non hanno numeri')
  ok('lettere nel telefono', await errore(() => r.invia(adulto({ telefono: '347 abc 2233' }))), 'Un campo non va: il telefono non sembra giusto')
  ok('il telefono col prefisso', m.controlla(adulto({ telefono: '+39 347-111.2233' })), null)
  ok('il secondo telefono si può lasciare vuoto', m.controlla(adulto({ telefono2: '' })), null)
  ok('il secondo telefono, se c’è, va scritto giusto', await errore(() => r.invia(adulto({ telefono2: '011 abc' }))), 'Un campo non va: il secondo telefono non sembra giusto')
  ok('senza il regolamento no', await errore(() => r.invia(adulto({ regolamento: false }))), 'Serve accettare il Regolamento Sociale')
  ok('detto sotto la casella', m.problemi(adulto({ regolamento: undefined })), { regolamento: 'Serve accettarlo per iscriversi' })

  const p = m.problemi(adulto({ nome: '', cap: '100', codiceFiscale: 'RSSLCU96A01L219X', corsi: [] }))
  ok('sotto ogni campo la sua', p, { nome: 'Manca', codiceFiscale: 'Non torna: controlla lettere e numeri, uno per uno', corsi: 'Scegline almeno uno', cap: 'Sono 5 cifre' })
  ok('niente, se va tutto', m.problemi(adulto()), {})
  ok('un codice giusto ma di un altro: fermato', await errore(() => r.invia(adulto({ nome: 'Marco' }))), 'Il codice fiscale non torna con nome e cognome: scrivili tutti, come sul documento')
  ok('detto sotto il campo', m.problemi(adulto({ nome: 'Marco' })), { codiceFiscale: 'Non torna con nome e cognome' })
  const notaCf = (cf) => m.problemi(adulto({ codiceFiscale: cf })).codiceFiscale
  const notaGen = (cf) => m.problemi(minore({ genitoreCodiceFiscale: cf })).genitoreCodiceFiscale
  ok('il codice corto: dice quanti ne mancano', notaCf('RSSMRA80A01'), 'Mancano 5 caratteri')
  ok('ne manca uno solo', notaCf('RSSLCU96A01L219'), 'Manca 1 carattere')
  ok('gli spazi non contano', notaCf('rss lcu 96a01 l219'), 'Manca 1 carattere')
  ok('il codice lungo: dice quanti toglierne', notaCf('RSSLCU96A01L219KABCDE'), 'Togli 5 caratteri')
  ok('uno di troppo', notaCf('RSSLCU96A01L219KA'), 'Togli 1 carattere')
  ok('un segno nel codice', notaCf('RSSMRA80A01-123Z'), 'Solo lettere e numeri')
  ok('un segno nel codice corto', notaCf('RSS-MRA'), 'Solo lettere e numeri')
  ok('il genitore: quanti ne mancano', notaGen('RSSPLA80A41'), 'Mancano 5 caratteri')
  ok('il genitore: uno solo', notaGen('RSSPLA80A41L219'), 'Manca 1 carattere')
  ok('il genitore: quanti toglierne', notaGen('RSSPLA80A41L219PABCDE'), 'Togli 5 caratteri')
  ok('il genitore: uno di troppo', notaGen('RSSPLA80A41L219PA'), 'Togli 1 carattere')
  ok('il genitore: un segno', notaGen('RSSPLA80A41-219P'), 'Solo lettere e numeri')
  // Il codice del genitore uguale a quello del bambino: la nota dice cosa fare, con il nome di chi si iscrive.
  const stessoCf = (nome) => m.problemi(minore({ nome, genitoreCodiceFiscale: 'RSSGLI17C41L219G' })).genitoreCodiceFiscale
  ok('il genitore col codice del figlio: dice di metterci il suo', stessoCf('Giulia'), 'Metti il tuo codice fiscale, non quello di Giulia.')
  ok('il genitore col codice del figlio, senza nome: «del bambino»', stessoCf(''), 'Metti il tuo codice fiscale, non quello del bambino.')
  // La ricevuta non ferma la richiesta: si può pagare in contanti al banco.
  ok('la ricevuta non è obbligatoria', m.FILE.find((f) => f.tipo === 'ricevuta').obbligatorio, false)
  ok('la ricevuta dice che si può pagare in segreteria', m.FILE.find((f) => f.tipo === 'ricevuta').seManca, 'PUOI PAGARE IN SEGRETERIA')
  ok('il certificato si può portare dopo', m.FILE.find((f) => f.tipo === 'certificato').seManca, 'PUOI PORTARLO DOPO')
  ok('il messaggio d’insieme non cambia, lungo', await errore(() => r.invia(adulto({ codiceFiscale: 'RSSLCU96A01L219KABCDE' }))), 'Un campo non va: il codice fiscale ha 16 caratteri, lettere e numeri')
  ok('il messaggio d’insieme non cambia, col segno', await errore(() => r.invia(adulto({ codiceFiscale: 'RSSMRA80A01-123Z' }))), 'Un campo non va: il codice fiscale ha 16 caratteri, lettere e numeri')
  ok('accenti e maiuscole non contano', m.controlla(adulto({ nome: 'lùca', cognome: 'ROSSI' })), null)
  ok('un nome con quattro consonanti', m.controlla(adulto({ nome: 'Demetrio', codiceFiscale: 'RSSDTR80A01L219A', natoIl: '1980-01-01' })), null)
  const luoghi = await m.caricaLuoghi()
  const cf = (quindici) => quindici + m.carattereControllo(quindici)
  ok('il luogo dal codice', m.luogoDaCf(luoghi, 'RSSLCU96A01L219K'), { nome: 'TORINO', sigla: 'TO' })
  ok('col nome che aveva quando si è nati', m.luogoDaCf(luoghi, cf('RSSLCU20A01A001'), '1920-01-01'), { nome: 'ABANO', sigla: 'PD' })
  ok('e dopo, col nome nuovo', m.luogoDaCf(luoghi, cf('RSSLCU30A01A001'), '1930-01-01'), { nome: 'ABANO TERME', sigla: 'PD' })
  ok('l’omocodia anche nel luogo', m.luogoDaCf(luoghi, 'RSSMRA85T10A56NH'), { nome: 'SAN GIULIANO TERME', sigla: 'PI' })
  ok('uno stato estero', m.luogoDaCf(luoghi, cf('RSSLCU96A01Z129')), { nome: 'ROMANIA', sigla: 'EE' })
  ok('un codice che non c’è: si scrive a mano', m.luogoDaCf(luoghi, cf('RSSLCU96A01Z999')), null)
  const ottobre = new Date(2026, 9, 4)
  ok('la data dal codice', m.dataDaCf('RSSLCU96A01L219K', '', ottobre), '1996-01-01')
  ok('la data dal codice, scritto in minuscolo e con spazi', m.dataDaCf(' rsslcu96a01 l219k', '', ottobre), '1996-01-01')
  ok('la data scritta che non torna: vale il codice', m.dataDaCf('RSSLCU96A01L219K', '1990-05-05', ottobre), '1996-01-01')
  ok('la data scritta che torna resta: il secolo lo dice chi scrive', m.dataDaCf(cf('RSSLCU26R04L219'), '1926-10-04', ottobre), '1926-10-04')
  ok('una donna: il giorno meno 40', m.dataDaCf('RSSGLI17C41L219G', '', ottobre), '2017-03-01')
  ok('l’omocodia anche nella data', m.dataDaCf('RSSMRA85T10A56NH', '', ottobre), '1985-12-10')
  ok('un codice a metà non dice niente', m.dataDaCf('RSSLCU96A01L219', '1990-05-05', ottobre), null)
  ok('un codice sbagliato non dice niente', m.dataDaCf('RSSLCU96A01L219X', '', ottobre), null)
  ok('un giorno che non esiste non dice niente', m.dataDaCf(cf('RSSLCU96B31L219'), '', ottobre), null)
  ok('dal codice di un bambino firma il genitore', m.chiFirma(m.dataDaCf('RSSGLI17C41L219G', '', ottobre), undefined, ottobre), true)
  ok('gli anni compiuti', m.anni('2017-03-01', ottobre), 9)
  ok('gli anni, il giorno prima del compleanno', m.anni('2017-10-05', ottobre), 8)
  ok('gli anni, il giorno del compleanno', m.anni('2017-10-04', ottobre), 9)
  ok('gli anni, scritti', m.anniScritti('2017-03-01', ottobre), '9 anni')
  ok('un anno solo, al singolare', m.anniScritti('2025-03-01', ottobre), '1 anno')
  ok('il genitore di un altro nome', await errore(() => r.invia(minore({ genitoreNome: 'Marta' }))), 'Il codice fiscale del genitore non torna con il suo nome e cognome: scrivili tutti, come sul documento')
}

console.log('\n3. le richieste arrivano')
const luca = await r.invia(adulto())
const giulia = await r.invia(adulto({ nome: 'Giulia', codiceFiscale: 'RSSGLI17C41L219G', natoIl: '2017-03-01', email: 'mamma@esempio.it', corsi: ['judo-2', 'lotta-2'], ...genitore }))
const marco = await r.invia(adulto({ nome: 'Marco', codiceFiscale: 'RSSMRC15E05L219V', natoIl: '2015-05-05', email: 'MAMMA@esempio.it', corsi: ['judo-3'], ...genitore }))
const terzo = await r.invia(adulto({ nome: 'Terzo', codiceFiscale: 'RSSTRZ96A01L219A', email: 'mamma@esempio.it' }))
{
  // Sei richieste al giorno per email (`per_email_al_giorno` di 49-richieste-per-email.sql): una famiglia di sei le manda tutte.
  const MSG6 = 'Da questa email sono già arrivate 6 richieste oggi: se serve, scrivi alla segreteria'
  const cfDi = (nome, cognome, natoIl) => {
    const [a, mese, g] = natoIl.split('-')
    const q = m.lettereCognome(cognome) + m.lettereNome(nome) + a.slice(2) + 'ABCDEHLMPRST'[Number(mese) - 1] + g + 'L219'
    return q + m.carattereControllo(q)
  }
  for (const [nome, anno] of [['Quarto', '1990'], ['Quinto', '1991'], ['Sesto', '1992']])
    ok(`la ${nome === 'Quarto' ? 'quarta' : nome === 'Quinto' ? 'quinta' : 'sesta'} dalla stessa email passa`, await errore(() => r.invia(adulto({ nome, codiceFiscale: cfDi(nome, 'Rossi', `${anno}-03-03`), natoIl: `${anno}-03-03`, email: 'mamma@esempio.it' }))), 'nessun errore')
  ok('la settima dalla stessa email no', await errore(() => r.invia(adulto({ nome: 'Ultimo', codiceFiscale: cfDi('Ultimo', 'Rossi', '1993-03-03'), natoIl: '1993-03-03', email: 'mamma@esempio.it' }))), MSG6)
  // Le note: 1000 caratteri come `check (length(note) <= 1000)` di 06-iscrizioni.sql, che `invia_iscrizione` dice «un testo è troppo lungo».
  const conNote = (note, nome, anno) => adulto({ nome, codiceFiscale: cfDi(nome, 'Rossi', `${anno}-03-03`), natoIl: `${anno}-03-03`, email: 'note@esempio.it', note })
  ok('note di 1001 caratteri: no, come il database', await errore(() => r.invia(conNote('x'.repeat(1001), 'Notaa', '1994'))), 'Un campo non va: un testo è troppo lungo')
  ok('note di 1000 caratteri: passano', await errore(() => r.invia(conNote('x'.repeat(1000), 'Notab', '1995'))), 'nessun errore')
  ok('gli spazi attorno non contano, il database li toglie', await errore(() => r.invia(conNote(`  ${'x'.repeat(1000)}  `, 'Notac', '1996'))), 'nessun errore')
  const tutte = await r.richieste()
  // Luca scrive da un'altra email: sono sei da mamma@ (Giulia, Marco, Terzo, Quarto, Quinto, Sesto), le due delle note che passano, più lui.
  ok('sono nove, nuove', tutte.map((x) => x.stato), Array(9).fill('nuova'))
  const l = tutte.find((x) => x.id === luca)
  ok('email e codice fiscale messi in ordine', `${l.email} ${l.codiceFiscale}`, 'luca@esempio.it RSSLCU96A01L219K')
  ok('il genitore di un adulto non si tiene', l.genitoreNome, undefined)
  ok('il luogo di nascita è quello del codice', l.natoA, 'TORINO (TO)')
  await r.caricaFile(luca, 'modulo', new File(['x'], 'modulo.pdf', { type: 'application/pdf' }))
  ok('il file si ritrova, come PDF', (await r.file(luca)).map((f) => [f.tipo, f.pdf]), [['modulo', true]])
  // Come nel database: un file rimandato (la risposta si era persa) è arrivato, e caricato è caricato.
  ok('il modulo rimandato non dà errore', await errore(() => r.caricaFile(luca, 'modulo', new File(['y'], 'modulo.jpg', { type: 'image/jpeg' }))), 'nessun errore')
  ok('e resta quello di prima', (await r.file(luca)).map((f) => [f.tipo, f.pdf]), [['modulo', true]])
  // Il documento arriva col modulo: si stampa e si cancella. Il certificato no: resta nell'app e passa alla scheda (prova-certificati.mjs).
  await r.caricaFile(luca, 'documento', new File(['x'], 'documento.jpg', { type: 'image/jpeg' }))
  await r.caricaFile(luca, 'certificato', new File(['x'], 'certificato.pdf', { type: 'application/pdf' }))
  ok('il documento si trova fra quelli da stampare', [...(await r.conDocumento())], [luca])
  await r.eliminaFile(luca, 'documento')
  ok('stampato il documento, il certificato ancora lì non tiene la richiesta fra quelle da stampare', (await r.conDocumento()).size, 0)
  ok('il certificato resta con il modulo, finché non si accoglie', (await r.file(luca)).map((f) => f.tipo), ['modulo', 'certificato'])
  await r.eliminaFile(luca, 'certificato')
  ok('un certificato sbagliato si toglie prima di accogliere', (await r.file(luca)).map((f) => f.tipo), ['modulo'])
}

console.log('\n4. la segreteria accoglie e rifiuta')
{
  const id = await r.accogli(luca)
  const p = (await s.persone()).find((x) => x.id === id)
  ok('Luca è in elenco', [p.nome, p.cognome, p.email, p.telefono], ['Luca', 'Rossi', 'luca@esempio.it', '347 111 2233'])
  ok('iscritto al Judo adulti da oggi', p.iscrizioni.map((i) => [i.corsoId, i.dal]), [['judo-adulti', '2026-09-26']])
  ok('una seconda volta no', await errore(() => r.accogli(luca)), 'Questa richiesta è già stata accolta')
  ok('la richiesta sa chi è nata', (await r.richieste()).find((x) => x.id === luca).personaId, id)

  await r.caricaFile(giulia, 'certificato', new File(['x'], 'certificato.pdf', { type: 'application/pdf' }))
  const g = await r.accogli(giulia)
  ok('accolta, i file della richiesta non hanno più il certificato (la scheda li rilegge e non lo mostra)', (await r.file(giulia)).some((f) => f.tipo === 'certificato'), false)
  const mm = await r.accogli(marco)
  const persone = await s.persone()
  ok('i due fratelli: la mail a una sola', [persone.find((x) => x.id === g).email, persone.find((x) => x.id === mm).email], ['mamma@esempio.it', undefined])
  ok('Marco senza email di accesso ha quella della mamma come contatto', [persone.find((x) => x.id === g).emailContatto, persone.find((x) => x.id === mm).emailContatto], [undefined, 'mamma@esempio.it'])
  ok('Giulia ha i suoi due corsi', persone.find((x) => x.id === g).iscrizioni.map((i) => i.corsoId).sort(), ['judo-2', 'lotta-2'])

  await r.rifiuta(terzo)
  ok('il terzo è rifiutato', (await r.richieste()).find((x) => x.id === terzo).stato, 'rifiutata')
  ok('e non si accoglie più', await errore(() => r.accogli(terzo)), 'Questa richiesta è già stata rifiutata')
  await r.elimina(terzo)
  ok('eliminato, sparisce', (await r.richieste()).some((x) => x.id === terzo), false)

  const e = await s.esporta(id)
  ok("l'esportazione porta la richiesta", e.richieste_di_iscrizione.map((x) => [x.stato, x.codiceFiscale]), [['accolta', 'RSSLCU96A01L219K']])
}

console.log('\n5. chi torna non diventa un doppione')
{
  // Una persona di prova che ha smesso: la si fa tornare con la richiesta.
  const vecchia = (await s.persone()).find((p) => p.iscrizioni.length && !p.email)
  const corso = vecchia.iscrizioni[0].corsoId
  await s.termina(vecchia.id, corso)
  await s.attivaPersona(vecchia.id, false)
  const base = m.lettereCognome(vecchia.cognome) + m.lettereNome(vecchia.nome) + '96A01L219'
  const id = await r.invia(adulto({ nome: vecchia.nome.toUpperCase(), cognome: vecchia.cognome.toLowerCase(), codiceFiscale: base + m.carattereControllo(base), email: 'torno@esempio.it', corsi: [corso] }))
  ok('accolta sulla scheda che c’era', await r.accogli(id), vecchia.id)
  const p = (await s.persone()).find((x) => x.id === vecchia.id)
  ok('di nuovo attiva, con l’email', [p.attiva, p.email], [true, 'torno@esempio.it'])
  // Aveva smesso oggi: l'iscrizione c'è ancora, e perde la fine.
  ok('resta iscritta com’era, senza più una fine', p.iscrizioni.filter((i) => i.corsoId === corso).map((i) => [i.dal, i.al]), [[vecchia.iscrizioni[0].dal, undefined]])
  ok('una sola in elenco', (await s.persone()).filter((x) => x.nome === vecchia.nome && x.cognome === vecchia.cognome).length, 1)
}

console.log('\n6. lo stesso codice fiscale, l’altro genitore')
{
  // Fra gli iscritti inventati una Giulia Rossi può già esserci: si conta prima e dopo.
  const quante = async () => (await s.persone()).filter((x) => x.nome === 'Giulia' && x.cognome === 'Rossi').length
  const primaDi = await quante()
  const id = await r.invia(adulto({ nome: 'Giulia', codiceFiscale: 'rssgli17c41l219g', natoIl: '2017-03-01', email: 'papa@esempio.it', corsi: ['psicomotricita'], ...genitore }))
  const prima = (await r.richieste()).find((x) => x.id === giulia).personaId
  ok('ritrova Giulia, non ne fa un’altra', await r.accogli(id), prima)
  ok('nessuna Giulia in più', await quante(), primaDi)
  ok('con la mail di prima', (await s.persone()).find((x) => x.id === prima).email, 'mamma@esempio.it')
}

console.log('\n7. la mamma con la sua email: la scheda la sceglie la segreteria')
{
  // In elenco con la sua email; la richiesta arriva con quella della mamma.
  const mario = await s.salvaPersona({ nome: 'Mario', cognome: 'Verdi', email: 'mario@esempio.it' })
  const quanti = async () => (await s.persone()).filter((x) => x.nome === 'Mario' && x.cognome === 'Verdi').length
  const base = m.lettereCognome('Verdi') + m.lettereNome('Mario') + '96A01L219'
  const id = await r.invia(adulto({ nome: 'Mario', cognome: 'Verdi', codiceFiscale: base + m.carattereControllo(base), email: 'elisa@esempio.it', telefono: '347 999 0000' }))
  ok('una scheda che non c’è non si sceglie', await errore(() => r.accogli(id, 'nessuno')), 'Questa scheda non c’è più')
  ok('accolta sulla scheda scelta', await r.accogli(id, mario), mario)
  const p = (await s.persone()).find((x) => x.id === mario)
  ok('un Mario solo, con la sua email e ora il telefono', [await quanti(), p.email, p.telefono], [1, 'mario@esempio.it', '347 999 0000'])
  ok('iscritto al Judo adulti', p.iscrizioni.map((i) => i.corsoId), ['judo-adulti'])

  // Paolo ha lo stesso telefono, scritto in un altro modo: lo si ritrova da sé.
  const paolo = await s.salvaPersona({ nome: 'Paolo', cognome: 'Neri', email: 'paolo@esempio.it', telefono: '+39 333 123 4567' })
  const cf = m.lettereCognome('Neri') + m.lettereNome('Paolo') + '96A01L219'
  const id2 = await r.invia(adulto({ nome: 'Paolo', cognome: 'Neri', codiceFiscale: cf + m.carattereControllo(cf), email: 'casa.neri@esempio.it', telefono: '3331234567' }))
  ok('Paolo ritrovato dal telefono', await r.accogli(id2), paolo)
}

console.log('\n8. i dati anagrafici: dalla richiesta, e dalla scheda dopo')
{
  const lucaId = (await r.richieste()).find((x) => x.id === luca).personaId
  const prima = await s.anagraficaDi(lucaId)
  ok('dalla richiesta accolta', [prima.da, prima.dati.codiceFiscale], ['modulo', (await r.richieste()).find((x) => x.id === luca).codiceFiscale])
  // Corretti dalla scheda dopo aver accolto: valgono i nuovi, anche sulla ricevuta.
  await s.salvaAnagrafica(lucaId, { ...prima.dati, indirizzo: 'via Nuova 2' }, true)
  const dopo = await s.anagraficaDi(lucaId)
  ok('la correzione è più recente e vince', [dopo.da, dopo.dati.indirizzo], ['segreteria', 'via Nuova 2'])
  ok('e la ricevuta la prende', (await s.intestatarioDi(lucaId)).indirizzo, 'via Nuova 2')
}

console.log('\n9. INDIETRO dal modulo, e chi firma che cambia')
{
  const VUOTO = {
    nome: '', cognome: '', natoIl: '', natoA: '', codiceFiscale: '', indirizzo: '', cap: '', comune: '', email: '',
    telefono: '', telefono2: '', genitoreNome: '', genitoreCognome: '', genitoreCodiceFiscale: '', corsi: [],
    formula: 'trimestre', note: '', regolamento: false,
  }
  const DOMANDA = 'LE RISPOSTE SI PERDONO · ESCI?'
  const modulo = (cambi = {}) => ({ risposte: { ...VUOTO, corsi: [] }, inizio: VUOTO, file: 0, scelte: 0, tratti: 0, privacy: false, luogoGenitore: '', ...cambi })
  ok('appena aperto: si esce senza domanda', m.domandaUscita(modulo()), undefined)
  ok('il nome scritto: chiede', m.domandaUscita(modulo({ risposte: { ...VUOTO, nome: 'Luca' } })), DOMANDA)
  ok('solo un tratto di firma: chiede', m.domandaUscita(modulo({ tratti: 1 })), DOMANDA)
  ok('solo un file scelto: chiede', m.domandaUscita(modulo({ file: 1 })), DOMANDA)
  ok('solo la privacy spuntata: chiede', m.domandaUscita(modulo({ privacy: true })), DOMANDA)
  ok('solo il regolamento spuntato: chiede', m.domandaUscita(modulo({ risposte: { ...VUOTO, regolamento: true } })), DOMANDA)
  ok('un corso scelto: chiede', m.domandaUscita(modulo({ risposte: { ...VUOTO, corsi: ['judo-adulti'] } })), DOMANDA)
  const delNucleo = { ...VUOTO, nome: 'Giulia', cognome: 'Rossi' }
  ok('dal nucleo, coi dati già scritti e nient’altro: senza domanda', m.domandaUscita(modulo({ risposte: { ...delNucleo }, inizio: delNucleo })), undefined)
  ok('il luogo del genitore solo spazi: senza domanda', m.domandaUscita(modulo({ luogoGenitore: '  ' })), undefined)

  const GENITORE = 'Firma e autorizzazioni vanno rifatte: ora firma il genitore.'
  const ISCRITTO = 'Firma e autorizzazioni vanno rifatte: ora firma chi si iscrive.'
  const niente = { tratti: 0, scelte: 0, foto: false, avvisato: false }
  ok('niente da rifare, minore: nessun avviso', m.firmaDaRifare(true, niente), undefined)
  ok('niente da rifare, maggiorenne: nessun avviso', m.firmaDaRifare(false, niente), undefined)
  ok('firmato, ora minore: firma il genitore', m.firmaDaRifare(true, { ...niente, tratti: 3 }), GENITORE)
  ok('caselle scelte, ora maggiorenne: firma chi si iscrive', m.firmaDaRifare(false, { ...niente, scelte: 2 }), ISCRITTO)
  ok('solo la foto del foglio: avvisa', m.firmaDaRifare(false, { ...niente, foto: true }), ISCRITTO)
  // Mentre si corregge la data dalla tastiera, il campo passa per vuoto o per anni come 0002:
  // chi firma resta quello di prima, se no firma e caselle sparirebbero per niente.
  ok('data vuota: chi firma resta il genitore', m.chiFirma('', true), true)
  ok('data vuota: chi firma resta chi si iscrive', m.chiFirma('', false), false)
  ok('anno a metà (0002): resta il genitore', m.chiFirma('0002-03-01', true), true)
  ok('anno a metà (0201): resta il genitore', m.chiFirma('0201-03-01', true), true)
  ok('data vera di un minore: il genitore', m.chiFirma('2015-03-01', false), true)
  ok('data vera di un adulto: chi si iscrive', m.chiFirma('1990-03-01', true), false)
  ok('appena aperto, senza data: chi si iscrive', m.chiFirma('', undefined), false)
  // La data cambia due volte: la firma è già sparita al primo, l'avviso resta e dice chi firma ora.
  ok('di nuovo maggiorenne, già avvisato: avvisa ancora', m.firmaDaRifare(false, { ...niente, avvisato: true }), ISCRITTO)
}

console.log('\n10. la metà vera, con un database finto: cosa parte e come si dice quando va male')
{
  // Un finto client: registra ogni chiamata e risponde con quel che gli si dà.
  // Come `prova-certificati.mjs`, ma qui interessa anche l'ordine delle chiamate.
  const finto = ({ rpc = {}, tabella = { data: [], error: null }, elenco = {}, upload = { error: null }, rimuovi, link, cancella = { error: null } } = {}) => {
    const reg = []
    const catena = (nome) => {
      let cancellando = false
      const c = {
        select: (...a) => (reg.push(['select', ...a]), c),
        order: (...a) => (reg.push(['order', ...a]), c),
        // Come Supabase: oltre la prima pagina l'elenco finto è finito.
        range: (...a) => (reg.push(['range', ...a]), a[0] ? { then: (bene) => bene({ data: [], error: null }) } : c),
        delete: () => ((cancellando = true), reg.push(['delete']), c),
        eq: (...a) => (reg.push(['eq', ...a]), c),
        then: (bene, male) => Promise.resolve(cancellando ? cancella : tabella).then(bene, male),
      }
      return c
    }
    const db = {
      from: (t) => (reg.push(['from', t]), catena(t)),
      rpc: async (nome, args) => (reg.push(['rpc', nome, args]), rpc[nome] ?? { data: null, error: null }),
      storage: {
        from: (b) => ({
          list: async (cartella) => (reg.push(['list', b, cartella]), elenco[cartella] ?? { data: [], error: null }),
          upload: async (nome, f, o) => (reg.push(['upload', b, nome, o]), upload),
          remove: async (nomi) => (reg.push(['remove', b, nomi]), rimuovi ?? { data: nomi.map((name) => ({ name })), error: null }),
          createSignedUrls: async (nomi, sec) => (reg.push(['link', b, nomi, sec]), link ?? { data: nomi.map((path) => ({ path, signedUrl: 'https://esempio.it/' + path })), error: null }),
        }),
      },
    }
    return { v: m.creaRichiesteSupabase(db), reg }
  }
  const ERR = (code, message = 'testo grezzo') => ({ data: null, error: { code, message } })
  const PERMESSO = 'Non hai il permesso: serve un accesso da segreteria'
  const NON_ATTIVO = 'Il modulo di iscrizione non è ancora attivo sul database: la segreteria deve lanciare 06-iscrizioni.sql'
  const nomiFile = (...n) => ({ data: n.map((name) => ({ name })), error: null })

  // --- i corsi
  {
    const { v, reg } = finto({ rpc: { corsi_aperti: { data: [{ id: 'judo-adulti', nome: 'Judo adulti' }], error: null } } })
    ok('i corsi: li chiede a corsi_aperti, senza argomenti', [await v.corsiAperti(), reg[0]], [[{ id: 'judo-adulti', nome: 'Judo adulti' }], ['rpc', 'corsi_aperti', undefined]])
    ok('i corsi: senza permesso lo dice per la segreteria', await errore(() => finto({ rpc: { corsi_aperti: ERR('42501') } }).v.corsiAperti()), PERMESSO)
    ok('i corsi: funzione assente, dice cosa lanciare', await errore(() => finto({ rpc: { corsi_aperti: ERR('PGRST202') } }).v.corsiAperti()), NON_ATTIVO)
    ok('i corsi: errore senza testo, il server non risponde', await errore(() => finto({ rpc: { corsi_aperti: { data: null, error: {} } } }).v.corsiAperti()), 'Il server non risponde')
  }

  // --- gli orari: per una proposta in più, mai un guaio che ferma l'iscrizione
  {
    const { v, reg } = finto({ rpc: { orari_aperti: { data: [{ corso_id: 'judo-3', giorno: 1, ora: '18:00:00', durata_min: 60 }, { corso_id: 'judo-agonisti', giorno: 4, ora: '18:30:00', durata_min: 90 }], error: null } } })
    ok('gli orari: li chiede a orari_aperti, senza argomenti', [await v.orariAperti(), reg[0]], [[{ corsoId: 'judo-3', giorno: 1, ora: '18:00', durata: 60 }, { corsoId: 'judo-agonisti', giorno: 4, ora: '18:30', durata: 90 }], ['rpc', 'orari_aperti', undefined]])
    ok('gli orari: funzione assente (48-orari-aperti.sql non lanciato), nessun orario', await finto({ rpc: { orari_aperti: ERR('PGRST202') } }).v.orariAperti(), [])
    ok('gli orari: senza permesso, nessun orario', await finto({ rpc: { orari_aperti: ERR('42501') } }).v.orariAperti(), [])
    ok('gli orari: errore senza testo, nessun orario', await finto({ rpc: { orari_aperti: { data: null, error: {} } } }).v.orariAperti(), [])
    ok('gli orari: senza rete, nessun orario', await finto({ rpc: { orari_aperti: { then: (_, male) => male(new TypeError('Failed to fetch')) } } }).v.orariAperti(), [])
  }

  // --- invia
  {
    const { v, reg } = finto({ rpc: { invia_iscrizione: { data: 'r-1', error: null } } })
    const id = await v.invia(adulto({ telefono2: '011 1', note: 'ciao', ...genitore, regolamento: true }))
    ok('invia: torna l’id della richiesta', id, 'r-1')
    ok('invia: chiama invia_iscrizione con un solo argomento, dati', [reg[0][1], Object.keys(reg[0][2])], ['invia_iscrizione', ['dati']])
    ok('invia: i campi, coi nomi del database e senza ritocchi', reg[0][2].dati, {
      nome: 'Luca', cognome: 'Rossi', nato_il: '1996-01-01', nato_a: 'Torino', codice_fiscale: 'rsslcu96a01 l219k',
      indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'Luca@Esempio.it', telefono: '347 111 2233', telefono_2: '011 1',
      genitore_nome: 'Paola', genitore_cognome: 'Rossi', genitore_codice_fiscale: 'RSSPLA80A41L219P',
      corsi: ['judo-adulti'], formula: 'annuale', note: 'ciao', regolamento: true,
    })
    const a = finto()
    await a.v.invia(adulto({ regolamento: undefined }))
    ok('invia: il regolamento non detto parte come no, mai vuoto', a.reg[0][2].dati.regolamento, false)
    const b = finto()
    await b.v.invia(adulto({ regolamento: 'sì' }))
    ok('invia: il regolamento vale solo se è proprio vero', b.reg[0][2].dati.regolamento, false)
    ok('invia: il rifiuto del database arriva com’è, è già detto per chi si iscrive', await errore(() => finto({ rpc: { invia_iscrizione: ERR('P0001', 'Mancano: cognome') } }).v.invia(adulto({ cognome: ' ' }))), 'Mancano: cognome')
    ok('invia: la settima email del giorno, stesso messaggio della finta', await errore(() => finto({ rpc: { invia_iscrizione: ERR('P0001', 'Da questa email sono già arrivate 6 richieste oggi: se serve, scrivi alla segreteria') } }).v.invia(adulto())), 'Da questa email sono già arrivate 6 richieste oggi: se serve, scrivi alla segreteria')
    ok('invia: funzione assente, dice cosa lanciare', await errore(() => finto({ rpc: { invia_iscrizione: ERR('PGRST202') } }).v.invia(adulto())), NON_ATTIVO)
    ok('invia: errore senza testo, il server non risponde', await errore(() => finto({ rpc: { invia_iscrizione: { data: null, error: {} } } }).v.invia(adulto())), 'Il server non risponde')
  }

  // --- caricaFile
  {
    const pdf = new File(['x'], 'm.pdf', { type: 'application/pdf' })
    const { v, reg } = finto()
    await v.caricaFile('r-1', 'modulo', pdf)
    ok('file: nella cartella della richiesta, col tipo per nome, senza sovrascrivere', reg[0], ['upload', 'iscrizioni', 'r-1/modulo.pdf', { contentType: 'application/pdf', upsert: false }])
    const f = finto()
    await f.v.caricaFile('r-1', 'documento', new File(['x'], 'd.jpg', { type: 'image/jpeg' }))
    ok('file: una foto prende .jpg', f.reg[0][2], 'r-1/documento.jpg')
    const tipoNo = finto()
    ok('file: un tipo che non va, detto prima di toccare la rete', [await errore(() => tipoNo.v.caricaFile('r-1', 'modulo', new File(['x'], 'a.exe', { type: 'application/x-msdownload' }))), tipoNo.reg.length], ['Questo tipo di file non va: serve una foto o un PDF', 0])
    const grande = finto()
    ok('file: oltre 10 MB, detto prima di toccare la rete', [await errore(() => grande.v.caricaFile('r-1', 'modulo', { type: 'application/pdf', size: 10 * 1024 * 1024 + 1 })), grande.reg.length], ['Il file è troppo grande: al massimo 10 MB', 0])
    const giusto = finto()
    await giusto.v.caricaFile('r-1', 'modulo', { type: 'application/pdf', size: 10 * 1024 * 1024 })
    ok('file: 10 MB giusti passano', giusto.reg.length, 1)
    const su = (error) => errore(() => finto({ upload: { error } }).v.caricaFile('r-1', 'modulo', pdf))
    ok('file: già arrivato (risposta persa), per chi riprova è andata', await su({ message: 'The resource already exists', statusCode: '409' }), 'nessun errore')
    ok('file: cartella chiusa (un’ora passata), dice di scrivere alla segreteria', await su({ message: 'new row violates row-level security policy', statusCode: '403' }), 'Il tempo per caricare i file è scaduto, o sono già arrivati tutti: scrivi alla segreteria')
    ok('file: troppo grande per il server', await su({ message: 'The object exceeded the maximum allowed size', statusCode: '413' }), 'Il file è troppo grande: al massimo 10 MB')
    ok('file: tipo rifiutato dal contenitore', await su({ message: 'mime type image/gif is not supported' }), 'Questo tipo di file non va: serve una foto o un PDF')
    ok('file: errore senza testo, riprova', await su({}), 'Il file non è partito: riprova')
  }

  // --- richieste (la segreteria)
  {
    const riga = (cambi = {}) => ({
      id: 'r-1', creata_il: '2026-09-26T10:00:00Z', stato: 'nuova', nome: 'Luca', cognome: 'Rossi', nato_il: '1996-01-01', nato_a: 'TORINO (TO)',
      codice_fiscale: 'RSSLCU96A01L219K', indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'luca@esempio.it', telefono: '347 111 2233',
      telefono_2: null, genitore_nome: null, genitore_cognome: null, genitore_codice_fiscale: null, corsi: ['judo-adulti'], formula: 'annuale', note: null,
      regolamento: true, persona_id: null, gestita_il: null, gestore: null, ...cambi,
    })
    const { v, reg } = finto({ tabella: { data: [riga(), riga({ id: 'r-2', stato: 'accolta', persona_id: 'p-1', gestita_il: '2026-09-27T09:00:00Z', gestore: { nome: 'Anna', cognome: 'Bianchi' }, telefono_2: '011 1', note: 'ciao', genitore_nome: 'Paola', genitore_cognome: 'Rossi', genitore_codice_fiscale: 'RSSPLA80A41L219P' })], error: null } })
    const [a, b] = await v.richieste()
    ok('elenco: dalla tabella richieste_iscrizione, col gestore, dalla più recente, a pagine', reg, [0, 2].flatMap((da) => [['from', 'richieste_iscrizione'], ['select', '*, gestore:persone!gestita_da ( nome, cognome )'], ['order', 'creata_il', { ascending: false }], ['order', 'id'], ['range', da, da + 999]]))
    ok('elenco: i campi, coi nomi dell’app', [a.id, a.creataIl, a.stato, a.natoIl, a.natoA, a.codiceFiscale, a.corsi, a.formula, a.regolamento], ['r-1', '2026-09-26T10:00:00Z', 'nuova', '1996-01-01', 'TORINO (TO)', 'RSSLCU96A01L219K', ['judo-adulti'], 'annuale', true])
    ok('elenco: i campi vuoti del database sono assenti, non null', [a.telefono2, a.genitoreNome, a.genitoreCognome, a.genitoreCodiceFiscale, a.note, a.personaId, a.gestitaIl, a.gestitaDa], [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined])
    ok('elenco: una richiesta gestita porta chi, quando e la scheda', [b.stato, b.personaId, b.gestitaIl, b.gestitaDa], ['accolta', 'p-1', '2026-09-27T09:00:00Z', 'Anna Bianchi'])
    ok('elenco: genitore, secondo telefono e note si tengono', [b.telefono2, b.genitoreNome, b.genitoreCognome, b.genitoreCodiceFiscale, b.note], ['011 1', 'Paola', 'Rossi', 'RSSPLA80A41L219P', 'ciao'])
    ok('elenco: vuoto, nessuna richiesta', await finto({ tabella: { data: [], error: null } }).v.richieste(), [])
    ok('elenco: senza permesso lo dice per la segreteria', await errore(() => finto({ tabella: ERR('42501') }).v.richieste()), PERMESSO)
  }

  // --- file di una richiesta
  {
    const { v, reg } = finto({ elenco: { 'r-1': nomiFile('modulo.pdf', 'documento.jpg') } })
    const tutti = await v.file('r-1')
    ok('apri file: legge la cartella della richiesta e chiede un link per ognuno, a dieci minuti', reg, [['list', 'iscrizioni', 'r-1'], ['link', 'iscrizioni', ['r-1/modulo.pdf', 'r-1/documento.jpg'], 600]])
    ok('apri file: tipo, link e se è un PDF', tutti.map((f) => [f.tipo, f.url, f.pdf]), [['modulo', 'https://esempio.it/r-1/modulo.pdf', true], ['documento', 'https://esempio.it/r-1/documento.jpg', false]])
    const vuoto = finto()
    ok('apri file: nessun file, niente link chiesti', [await vuoto.v.file('r-1'), vuoto.reg.map((x) => x[0])], [[], ['list']])
    const senzaLink = finto({ elenco: { 'r-1': nomiFile('modulo.pdf', 'documento.jpg') }, link: { data: [{ path: 'r-1/modulo.pdf', signedUrl: 'https://x/m' }, { path: 'r-1/documento.jpg', signedUrl: null }], error: null } })
    ok('apri file: un link che non è arrivato non entra', (await senzaLink.v.file('r-1')).map((f) => f.tipo), ['modulo'])
    ok('apri file: cartella illeggibile, dice di scrivere alla segreteria', await errore(() => finto({ elenco: { 'r-1': { data: null, error: { message: 'row-level security', statusCode: '403' } } } }).v.file('r-1')), 'Il tempo per caricare i file è scaduto, o sono già arrivati tutti: scrivi alla segreteria')
    ok('apri file: link negati, stesso modo', await errore(() => finto({ elenco: { 'r-1': nomiFile('modulo.pdf') }, link: { data: null, error: { message: 'x' } } }).v.file('r-1')), 'x')
  }

  // --- documenti da stampare
  {
    const { v, reg } = finto({ rpc: { richieste_con_documento: { data: ['r-1', 'r-2'], error: null } } })
    const s = await v.conDocumento()
    ok('da stampare: chiede a richieste_con_documento', [reg[0][1], [...s]], ['richieste_con_documento', ['r-1', 'r-2']])
    ok('da stampare: nessun risultato, insieme vuoto', (await finto().v.conDocumento()).size, 0)
    ok('da stampare: funzione assente, niente da segnalare e l’elenco si vede', (await finto({ rpc: { richieste_con_documento: ERR('PGRST202') } }).v.conDocumento()).size, 0)
    ok('da stampare: altri errori no, si dicono', await errore(() => finto({ rpc: { richieste_con_documento: ERR('42501') } }).v.conDocumento()), PERMESSO)
  }

  // --- togliere un file
  {
    const elenco = { 'r-1': nomiFile('modulo.pdf', 'documento.jpg', 'certificato.pdf') }
    const { v, reg } = finto({ elenco })
    await v.eliminaFile('r-1', 'documento')
    ok('toglie solo il file di quel tipo', reg[1], ['remove', 'iscrizioni', ['r-1/documento.jpg']])
    const niente = finto({ elenco })
    await niente.v.eliminaFile('r-1', 'ricevuta')
    ok('un tipo che non c’è: niente da cancellare', niente.reg.map((x) => x[0]), ['list'])
    ok('lo Storage non lo cancella (policy): lo dice', await errore(() => finto({ elenco, rimuovi: { data: [], error: null } }).v.eliminaFile('r-1', 'documento')), 'Il file non si è cancellato: serve un accesso da segreteria')
    ok('lo Storage si rompe: messaggio del file', await errore(() => finto({ elenco, rimuovi: { data: null, error: {} } }).v.eliminaFile('r-1', 'documento')), 'Il file non è partito: riprova')
  }

  // --- accogliere, rifiutare, eliminare
  {
    const { v, reg } = finto({ rpc: { accogli_iscrizione: { data: 'p-9', error: null } } })
    ok('accoglie: torna la scheda, con la sola richiesta se la segreteria non ne sceglie una', [await v.accogli('r-1'), reg[0]], ['p-9', ['rpc', 'accogli_iscrizione', { richiesta: 'r-1' }]])
    await v.accogli('r-1', 'p-3')
    ok('accoglie: con la scheda scelta, la manda', reg[1], ['rpc', 'accogli_iscrizione', { richiesta: 'r-1', persona: 'p-3' }])
    ok('accoglie: già accolta, il messaggio è quello del database', await errore(() => finto({ rpc: { accogli_iscrizione: ERR('P0001', 'Questa richiesta è già stata accolta') } }).v.accogli('r-1')), 'Questa richiesta è già stata accolta')
    ok('accoglie: senza permesso', await errore(() => finto({ rpc: { accogli_iscrizione: ERR('42501') } }).v.accogli('r-1')), PERMESSO)
    const r = finto()
    await r.v.rifiuta('r-1')
    ok('rifiuta: chiama rifiuta_iscrizione', r.reg, [['rpc', 'rifiuta_iscrizione', { richiesta: 'r-1' }]])
    ok('rifiuta: già rifiutata, il messaggio del database', await errore(() => finto({ rpc: { rifiuta_iscrizione: ERR('P0001', 'Questa richiesta non è più nuova') } }).v.rifiuta('r-1')), 'Questa richiesta non è più nuova')
    ok('rifiuta: senza permesso', await errore(() => finto({ rpc: { rifiuta_iscrizione: ERR('42501') } }).v.rifiuta('r-1')), PERMESSO)

    const e = finto({ elenco: { 'r-1': nomiFile('modulo.pdf', 'documento.jpg') } })
    await e.v.elimina('r-1')
    ok('elimina: prima i file, poi la riga', e.reg, [['list', 'iscrizioni', 'r-1'], ['remove', 'iscrizioni', ['r-1/modulo.pdf', 'r-1/documento.jpg']], ['from', 'richieste_iscrizione'], ['delete'], ['eq', 'id', 'r-1']])
    const senza = finto()
    await senza.v.elimina('r-1')
    ok('elimina: senza file, solo la riga', senza.reg.map((x) => x[0]), ['list', 'from', 'delete', 'eq'])
    const rotto = finto({ elenco: { 'r-1': nomiFile('modulo.pdf') }, rimuovi: { data: null, error: { message: 'down' } } })
    ok('elimina: se i file non vanno via, la riga resta (un file senza riga non lo ritrova nessuno)', [await errore(() => rotto.v.elimina('r-1')), rotto.reg.some((x) => x[0] === 'delete')], ['down', false])
    ok('elimina: senza permesso sulla riga', await errore(() => finto({ cancella: ERR('42501') }).v.elimina('r-1')), PERMESSO)
  }
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
