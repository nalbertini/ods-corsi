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
      "export { creaRichiesteProva } from './src/lib/richiesteProva'; export { anni, anniScritti, certificatoDaPortare, chiFirma, dataDaCf, controlla, domandaUscita, FILE, firmaDaRifare, minorenne, problemi } from './src/lib/richieste'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { caricaLuoghi, carattereControllo, lettereCognome, lettereNome, luogoDaCf } from './src/lib/codiceFiscale'",
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
  ok('la quarta dalla stessa email no', await errore(() => r.invia(adulto({ nome: 'Quarto', codiceFiscale: 'RSSQRT96A01L219R', email: 'mamma@esempio.it' }))), 'Da questa email sono già arrivate 3 richieste oggi: se serve, scrivi alla segreteria')
  const tutte = await r.richieste()
  ok('sono quattro, nuove', tutte.map((x) => x.stato), ['nuova', 'nuova', 'nuova', 'nuova'])
  const l = tutte.find((x) => x.id === luca)
  ok('email e codice fiscale messi in ordine', `${l.email} ${l.codiceFiscale}`, 'luca@esempio.it RSSLCU96A01L219K')
  ok('il genitore di un adulto non si tiene', l.genitoreNome, undefined)
  ok('il luogo di nascita è quello del codice', l.natoA, 'TORINO (TO)')
  await r.caricaFile(luca, 'modulo', new File(['x'], 'modulo.pdf', { type: 'application/pdf' }))
  ok('il file si ritrova, come PDF', (await r.file(luca)).map((f) => [f.tipo, f.pdf]), [['modulo', true]])
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

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
