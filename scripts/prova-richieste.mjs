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
import { readFileSync } from 'node:fs'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaRichiesteProva } from './src/lib/richiesteProva'; export { creaRichiesteSupabase } from './src/lib/richiesteSupabase'; export { siElimina, ACCOLTA_RESTA, daSelezionare, anni, anniScritti, certificatoDaPortare, avvisoCertificato, chiFirma, dataDaCf, controlla, domandaUscita, mancaPerInviare, sceltaMancante, MANCA_SCELTA, aiutoScelta, NOTA_SCELTA, FILE, firmaDaRifare, minorenne, problemi, tipiDaChiedere, fileObbligatori, MANCA_RICEVUTA, DETTAGLIO_RICEVUTA } from './src/lib/richieste'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { caricaLuoghi, carattereControllo, lettereCognome, lettereNome, luogoDaCf } from './src/lib/codiceFiscale'; export { archivio } from './src/lib/archivioProva'; export { aggiungiRichiesteProva, scordaRichiesteProva, richiesteContateProva } from './src/lib/richiesteProva'; export { seminaEsempi } from './src/lib/esempiProva'",
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
  const chiuso = (await s.corsi()).find((x) => x.id === 'pre-pugilistica')
  await s.archiviaCorso(chiuso.id, false)
  ok('un corso archiviato non si sceglie', (await r.corsiAperti()).some((x) => x.id === 'pre-pugilistica'), false)

  // Gli orari dei corsi aperti, per «Ti iscrivi anche tu?»: come `orari_aperti()` di 48-orari-aperti.sql.
  const orari = await r.orariAperti()
  const judo3 = orari.filter((o) => o.corsoId === 'judo-3')
  ok('gli orari: Judo 3 il lunedì, mercoledì e venerdì alle 18, un’ora', judo3, [1, 3, 5].map((giorno) => ({ corsoId: 'judo-3', giorno, ora: '18:00', durata: 60 })))
  ok('gli orari: solo corso, giorno, ora e durata', [...new Set(orari.map((o) => Object.keys(o).sort().join()))], ['corsoId,durata,giorno,ora'])
  ok('gli orari: un corso archiviato non c’è', orari.some((o) => o.corsoId === 'pre-pugilistica'), false)
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
  ok('un corso chiuso', await errore(() => r.invia(adulto({ corsi: ['pre-pugilistica'] }))), "Uno dei corsi scelti non c'è più: ricarica la pagina")
  ok('un minore senza genitore', await errore(() => r.invia(adulto({ natoIl: '2017-03-01' }))), 'Per un minore servono nome, cognome e codice fiscale del genitore')
  ok('diciotto anni compiuti ieri: adulto', m.minorenne('2008-09-25'), false)
  ok('diciotto anni domani: minore', m.minorenne('2008-09-27'), true)
  const oggi = new Date(2026, 9, 2)
  ok('certificato: senza data, nessuno', m.certificatoDaPortare('', ['Judo'], oggi), 'nessuno')
  // La carta d'identità è dell'atleta, dai 6 anni: anche per un minore del nucleo (non è più «quella del genitore»).
  const tipi = (nato, corsi = ['Judo']) => m.tipiDaChiedere(nato, corsi, oggi)
  ok('carta: 6 anni oggi, fronte e retro', tipi('2020-10-02').filter((t) => t.startsWith('documento')), ['documento', 'documento-retro'])
  ok('carta: 5 anni e 364 giorni, nessuna', tipi('2020-10-03').filter((t) => t.startsWith('documento')), [])
  ok('carta: un adulto, fronte e retro', tipi('1990-05-05').filter((t) => t.startsWith('documento')), ['documento', 'documento-retro'])
  ok('carta: senza data non decide, nessuna', tipi('').filter((t) => t.startsWith('documento')), [])
  ok('un minore di 10 anni: carta e certificato, modulo e ricevuta', tipi('2016-01-01'), ['modulo', 'documento', 'documento-retro', 'certificato', 'ricevuta'])
  ok('4 anni: solo modulo e ricevuta', tipi('2022-01-01'), ['modulo', 'ricevuta'])
  ok('il testo del documento in FILE non manda più al genitore', /genitore/i.test(m.FILE.find((f) => f.tipo === 'documento').dettaglio), false)
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
  const primo = (await r.file(luca))[0].url
  ok('il modulo rimandato non dà errore', await errore(() => r.caricaFile(luca, 'modulo', new File(['y'], 'modulo.pdf', { type: 'application/pdf' }))), 'nessun errore')
  ok('e resta quello di prima', (await r.file(luca)).map((f) => [f.tipo, f.url !== '' && f.url === primo]), [['modulo', true]])
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
  // Accolta, la richiesta tiene nascita, codice fiscale e residenza della scheda: non si elimina.
  ok('accolta: non si elimina, lo dice', await errore(() => r.elimina(luca)), m.ACCOLTA_RESTA)
  ok('accolta: la richiesta resta, coi suoi dati', (await r.richieste()).find((x) => x.id === luca)?.codiceFiscale, 'RSSLCU96A01L219K')
  ok('la regola: nuova e rifiutata sì, accolta con la scheda no, accolta senza scheda sì', [{ stato: 'nuova' }, { stato: 'rifiutata' }, { stato: 'accolta', personaId: 'p-1' }, { stato: 'accolta' }].map(m.siElimina), [true, true, false, true])

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
  // Il codice fiscale lo sanno in tanti: con un altro nome (le sei lettere tornano lo stesso) non si finisce sulla scheda di Giulia.
  const altro = await r.invia(adulto({ nome: 'Giulio', codiceFiscale: 'rssgli17c41l219g', natoIl: '2017-03-01', email: 'giulio@esempio.it', corsi: ['psicomotricita'], ...genitore }))
  const nuovo = await r.accogli(altro)
  ok('Giulio non finisce sulla scheda di Giulia', nuovo !== prima, true)
  ok('una scheda sua', (await s.persone()).find((x) => x.id === nuovo)?.nome, 'Giulio')
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

console.log('\n7b. lo stesso nome, un altro codice fiscale: le regole di accogli_iscrizione')
{
  const a = m.archivio.dati
  const cf = (cognome, nome, resto) => {
    const b = m.lettereCognome(cognome) + m.lettereNome(nome) + resto
    return b + m.carattereControllo(b)
  }
  const persona = (p) => {
    a.persone = [...a.persone, { ruolo: 'iscritto', attiva: true, creataIl: '2026-01-01', ...p }]
    return p.id
  }
  const nuove = (nome) => a.persone.filter((p) => p.nome === nome && p.cognome === 'Rana').length

  // Ugo è stato accolto con l'email di Mario: la sua scheda resta senza email, ma il codice è noto.
  const ugo = await s.salvaPersona({ nome: 'Ugo', cognome: 'Rana' })
  await r.accogli(await r.invia(adulto({ nome: 'Ugo', cognome: 'Rana', codiceFiscale: cf('Rana', 'Ugo', '96A01L219'), email: 'mario@esempio.it', telefono: '347 666 0001' })), ugo)
  const altroUgo = await r.accogli(await r.invia(adulto({ nome: 'Ugo', cognome: 'Rana', natoIl: '1976-01-01', codiceFiscale: cf('Rana', 'Ugo', '76A01L219'), email: 'ugo.altro@esempio.it', telefono: '347 666 0001' })))
  ok('l’altro Ugo non finisce sulla scheda senza email del primo, nemmeno col suo telefono', altroUgo !== ugo, true)
  ok('due Ugo Rana', nuove('Ugo'), 2)

  // Ada ha la sua email e un codice dal modulo Google: la stessa email con un altro codice è un’altra persona.
  const ada = persona({ id: 'p-ada', nome: 'Ada', cognome: 'Rana', email: 'ada@esempio.it' })
  a.anagrafiche = { ...a.anagrafiche, [ada]: { codiceFiscale: cf('Rana', 'Ada', '96A41L219') } }
  const altraAda = await r.accogli(await r.invia(adulto({ nome: 'Ada', cognome: 'Rana', natoIl: '1976-01-01', codiceFiscale: cf('Rana', 'Ada', '76A41L219'), email: 'ada@esempio.it', telefono: '347 666 0004' })))
  ok('l’altra Ada non finisce sulla scheda di Ada, anche con la stessa email', altraAda !== ada, true)

  // Un istruttore con lo stesso nome non è chi si iscrive.
  const ivo = persona({ id: 'i-ivo', nome: 'Ivo', cognome: 'Rana', ruolo: 'istruttore' })
  const iscrittoIvo = await r.accogli(await r.invia(adulto({ nome: 'Ivo', cognome: 'Rana', codiceFiscale: cf('Rana', 'Ivo', '96A01L219'), email: 'ivo@esempio.it', telefono: '347 666 0005' })))
  ok('Ivo l’istruttore resta istruttore: l’iscritto è una scheda nuova', [iscrittoIvo !== ivo, a.persone.find((p) => p.id === ivo).ruolo], [true, 'istruttore'])

  // Due Eva senza codice: la più vecchia senza email, la più nuova con un’altra email e lo stesso telefono. Come il database: la più vecchia.
  persona({ id: 'p-eva-1', nome: 'Eva', cognome: 'Rana', creataIl: '2025-01-01' })
  persona({ id: 'p-eva-2', nome: 'Eva', cognome: 'Rana', email: 'eva.vecchia@esempio.it', telefono: '347 666 0006', creataIl: '2026-02-01' })
  ok('fra due Eva senza la stessa email, la più vecchia', await r.accogli(await r.invia(adulto({ nome: 'Eva', cognome: 'Rana', codiceFiscale: cf('Rana', 'Eva', '96A41L219'), email: 'eva@esempio.it', telefono: '347 666 0006' }))), 'p-eva-1')

  // Due Zoe: la più vecchia senza email, la più nuova con la stessa della richiesta. Vince la stessa email.
  persona({ id: 'p-zoe-1', nome: 'Zoe', cognome: 'Rana', creataIl: '2025-01-01' })
  persona({ id: 'p-zoe-2', nome: 'Zoe', cognome: 'Rana', email: 'zoe@esempio.it', creataIl: '2026-02-01' })
  ok('fra due Zoe, prima quella con la stessa email', await r.accogli(await r.invia(adulto({ nome: 'Zoe', cognome: 'Rana', codiceFiscale: cf('Rana', 'Zoe', '96A41L219'), email: 'zoe@esempio.it', telefono: '347 666 0008' }))), 'p-zoe-2')

  // Teo ha un certificato valido: quello arrivato col modulo non lo sostituisce, e resta fra i file della richiesta.
  persona({ id: 'p-teo', nome: 'Teo', cognome: 'Rana', email: 'teo@esempio.it', certificato: { scade: '2027-01-01', file: 'p-teo/certificato-1.pdf' } })
  const perTeo = await r.invia(adulto({ nome: 'Teo', cognome: 'Rana', codiceFiscale: cf('Rana', 'Teo', '96A01L219'), email: 'teo@esempio.it', telefono: '347 666 0007' }))
  await r.caricaFile(perTeo, 'certificato', new File(['x'], 'certificato.pdf', { type: 'application/pdf' }))
  ok('Teo ritrovato', await r.accogli(perTeo), 'p-teo')
  ok('il certificato valido di Teo resta il suo', a.persone.find((p) => p.id === 'p-teo').certificato, { scade: '2027-01-01', file: 'p-teo/certificato-1.pdf' })
  ok('e quello del modulo resta fra i file della richiesta', (await r.file(perTeo)).some((f) => f.tipo === 'certificato'), true)
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
    // Il pagamento Satispay fatto prima (83-satispay-prima.sql): senza la chiave giusta il database non lo prende.
    const c = finto()
    await c.v.invia(adulto({ pagamentoSatispay: 'sp-1' }))
    ok('invia: il pagamento Satispay parte come pagamento_satispay', c.reg[0][2].dati.pagamento_satispay, 'sp-1')
    const e = finto()
    await e.v.invia(adulto())
    ok('invia: senza pagamento, nessun pagamento_satispay (JSON lo lascia fuori)', e.reg[0][2].dati.pagamento_satispay, undefined)
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

    const accolta = finto({ tabella: { data: [{ stato: 'accolta', persona_id: 'p-1' }], error: null }, elenco: { 'r-1': nomiFile('modulo.pdf') } })
    ok('elimina: accolta, con la scheda, non tocca né file né riga', [await errore(() => accolta.v.elimina('r-1')), accolta.reg.some((x) => x[0] === 'remove' || x[0] === 'delete')], [m.ACCOLTA_RESTA, false])
    const e = finto({ elenco: { 'r-1': nomiFile('modulo.pdf', 'documento.jpg') } })
    await e.v.elimina('r-1')
    ok('elimina: prima lo stato, poi i file, poi la riga', e.reg, [['from', 'richieste_iscrizione'], ['select', 'stato, persona_id'], ['eq', 'id', 'r-1'], ['list', 'iscrizioni', 'r-1'], ['remove', 'iscrizioni', ['r-1/modulo.pdf', 'r-1/documento.jpg']], ['from', 'richieste_iscrizione'], ['delete'], ['eq', 'id', 'r-1']])
    const senza = finto()
    await senza.v.elimina('r-1')
    ok('elimina: senza file, solo la riga', senza.reg.map((x) => x[0]), ['from', 'select', 'eq', 'list', 'from', 'delete', 'eq'])
    const rotto = finto({ elenco: { 'r-1': nomiFile('modulo.pdf') }, rimuovi: { data: null, error: { message: 'down' } } })
    ok('elimina: se i file non vanno via, la riga resta (un file senza riga non lo ritrova nessuno)', [await errore(() => rotto.v.elimina('r-1')), rotto.reg.some((x) => x[0] === 'delete')], ['down', false])
    ok('elimina: senza permesso sulla riga', await errore(() => finto({ cancella: ERR('42501') }).v.elimina('r-1')), PERMESSO)
  }
}

console.log('\n11. il riquadro rosso in fondo: il primo messaggio che blocca, a ogni modifica')
{
  // Lo stato del modulo: `firma` è l'esito di «cosa manca per firmare» (null = firmato), `obbligatori` i file che
  // servono. Il passo del riquadro è tutto qui: la schermata lo richiama a ogni modifica dopo il primo invio.
  const REG = 'Serve accettare il Regolamento Sociale'
  const PRIVACY = "Serve la conferma di aver letto l'informativa privacy"
  const pronto = (cambi = {}) => ({ dati: adulto(), privacy: true, come: 'foto', firma: null, file: { modulo: {}, documento: {} }, obbligatori: ['modulo', 'documento'], ...cambi })
  const manca = (cambi) => m.mancaPerInviare(pronto(cambi))
  ok('tutto a posto: nessun messaggio', manca(), null)
  ok('regolamento non accettato', manca({ dati: adulto({ regolamento: false }) }), REG)
  ok('messa la spunta, il messaggio sparisce', manca({ dati: adulto({ regolamento: true }) }), null)
  ok('tolta la spunta, torna', manca({ dati: adulto({ regolamento: false }) }), REG)
  ok('privacy non confermata', manca({ privacy: false }), PRIVACY)
  ok('messa la spunta alla privacy, sparisce', manca({ privacy: true }), null)
  ok('campo obbligatorio mancante', manca({ dati: adulto({ cognome: '' }) }), 'Mancano: cognome')
  ok('compilato il campo, sparisce', manca({ dati: adulto({ cognome: 'Rossi' }) }), null)
  // Due blocchi insieme: sistemato il primo si vede il secondo, poi più niente.
  const due = { dati: adulto({ regolamento: false }), privacy: false }
  ok('due blocchi: prima il regolamento', manca(due), REG)
  ok('sistemato il regolamento, resta la privacy', manca({ ...due, dati: adulto() }), PRIVACY)
  ok('sistemata anche la privacy, nessuno', manca({ ...due, dati: adulto(), privacy: true }), null)
  // L'ordine: campi, poi firma, poi file, poi privacy.
  const tutti = { dati: adulto({ cognome: '' }), come: 'qui', firma: 'Manca la firma sul modulo', file: {}, privacy: false }
  ok('ordine: prima i campi', manca(tutti), 'Mancano: cognome')
  ok('ordine: poi la firma', manca({ ...tutti, dati: adulto() }), 'Manca la firma sul modulo')
  ok('ordine: poi i file', manca({ ...tutti, dati: adulto(), firma: null }), 'Manca: carta d\'identità')
  ok('ordine: infine la privacy', manca({ ...tutti, dati: adulto(), firma: null, file: { documento: {} } }), PRIVACY)
  ok('con la firma qui il modulo non si chiede come file', manca({ come: 'qui', file: { documento: {} } }), null)
  ok('con la foto la firma non conta', manca({ come: 'foto', firma: 'Manca la firma sul modulo' }), null)
  ok('con la foto il modulo si chiede', manca({ file: { documento: {} } }), 'Manca: modulo firmato')
  // Un minore senza genitore: i dati del genitore mancano, e spariscono se la data diventa quella di un maggiorenne.
  const minoreSenza = adulto({ natoIl: '2017-03-01', codiceFiscale: 'RSSGLI17C41L219G' })
  ok('minore senza dati del genitore', manca({ dati: minoreSenza }), 'Per un minore servono nome, cognome e codice fiscale del genitore')
  ok('la data cambia a maggiorenne: il blocco sparisce', manca({ dati: adulto({ natoIl: '1996-01-01' }) }), null)
}

console.log('\n11b. la ricevuta obbligatoria nel modulo della pagina pubblica (non in «una persona in più»)')
{
  const RICEVUTA = 'Manca la ricevuta del pagamento: paga con bonifico o Satispay e carica la foto, lo screenshot o il PDF.'
  const PRIVACY = "Serve la conferma di aver letto l'informativa privacy"
  ok('MANCA_RICEVUTA, il testo', m.MANCA_RICEVUTA, RICEVUTA)
  ok('DETTAGLIO_RICEVUTA, il testo', m.DETTAGLIO_RICEVUTA, 'Del bonifico o di Satispay: una foto, lo screenshot o il PDF.')
  // I file chiesti come li costruisce il modulo: i tipi di tipiDaChiedere, con l'«obbligatorio» di FILE.
  const oggi = new Date(2026, 9, 2)
  const chiesti = (nato) => m.tipiDaChiedere(nato, ['Judo'], oggi).map((tipo) => m.FILE.find((f) => f.tipo === tipo))
  const obbl = (nato, ricevuta) => {
    try {
      return m.fileObbligatori(chiesti(nato), ricevuta)
    } catch (e) {
      return `ERRORE: ${e.message}`
    }
  }
  ok('adulto, pagina pubblica: modulo, documento e ricevuta', obbl('1990-05-05', true), ['modulo', 'documento', 'ricevuta'])
  ok('adulto, una persona in più: modulo e documento, la ricevuta no', obbl('1990-05-05', false), ['modulo', 'documento'])
  ok('4 anni, pagina pubblica (chiesti solo modulo e ricevuta): modulo e ricevuta', obbl('2022-01-01', true), ['modulo', 'ricevuta'])
  ok('la ricevuta si aggiunge solo se è fra i chiesti', (() => { try { return m.fileObbligatori([{ tipo: 'modulo', obbligatorio: true }], true) } catch (e) { return `ERRORE: ${e.message}` } })(), ['modulo'])

  const OBBL = ['modulo', 'documento', 'ricevuta']
  const pronto = (cambi = {}) => ({ dati: adulto(), privacy: true, come: 'foto', firma: null, file: { modulo: {}, documento: {} }, obbligatori: OBBL, ...cambi })
  const manca = (cambi) => m.mancaPerInviare(pronto(cambi))
  ok('firmato qui, senza ricevuta: il messaggio della ricevuta', manca({ come: 'qui', file: { documento: {} } }), RICEVUTA)
  ok('firmato qui, con la ricevuta: nessun messaggio', manca({ come: 'qui', file: { documento: {}, ricevuta: {} } }), null)
  ok('modulo in foto, senza ricevuta: il messaggio della ricevuta', manca(), RICEVUTA)
  ok('modulo in foto, con la ricevuta: nessun messaggio', manca({ file: { modulo: {}, documento: {}, ricevuta: {} } }), null)
  ok('senza privacy e senza ricevuta: prima la ricevuta (i file vengono prima della privacy)', manca({ privacy: false }), RICEVUTA)
  ok('con la ricevuta e senza privacy: la privacy', manca({ privacy: false, file: { modulo: {}, documento: {}, ricevuta: {} } }), PRIVACY)
  ok('i campi vengono prima della ricevuta', manca({ dati: adulto({ cognome: '' }) }), 'Mancano: cognome')
  ok('la firma viene prima della ricevuta', manca({ come: 'qui', firma: 'Manca la firma sul modulo', file: { documento: {} } }), 'Manca la firma sul modulo')
  ok('gli altri file dicono ancora «Manca: …»', manca({ file: { modulo: {}, ricevuta: {} } }), "Manca: carta d'identità")
  ok('senza ricevuta fra gli obbligatori, non si chiede', manca({ obbligatori: ['modulo', 'documento'] }), null)
  // Il legame sta nel modulo: dalla pagina pubblica col bonifico la ricevuta è obbligatoria, e la lista arriva a
  // `mancaPerInviare`. Con Satispay non si chiede (decisione del 2026-10-20: `modoPagamento`, `cosaNonVaModo` in prova:satispay).
  const moduloSorgente = readFileSync('src/components/ModuloIscrizione.tsx', 'utf8')
  ok('il modulo chiede la ricevuta col bonifico', moduloSorgente.includes("fileObbligatori(daChiedere, modo === 'bonifico')"), true)
  ok('il modulo passa quella lista a mancaPerInviare', /mancaPerInviare\(\{[^}]*\bobbligatori,/.test(moduloSorgente), true)
}

console.log('\n12. il campo precompilato: al primo tocco si seleziona tutto')
{
  // Il modulo aperto da «aggiungi una persona» parte coi dati del nucleo: toccando il campo la prima lettera
  // deve sostituire il testo, non attaccarsi. Se la persona l'ha già cambiato, il tocco mette il cursore.
  ok('precompilato e non toccato: si seleziona', m.daSelezionare('Rossi', 'Rossi'), true)
  ok('vuoto: niente da selezionare', m.daSelezionare('', 'Rossi'), false)
  ok('vuoto anche all\'apertura: niente da selezionare', m.daSelezionare('', ''), false)
  ok('cambiato dalla persona: il cursore va dove si tocca', m.daSelezionare('Rossini', 'Rossi'), false)
  ok('cambiato e riportato uguale: si seleziona di nuovo', m.daSelezionare('Rossi', 'Rossi'), true)
  ok('solo spazi: niente da selezionare', m.daSelezionare('   ', '   '), false)
}

console.log('\n13. Le scelte tesseramento e foto: obbligatorie, ma «non autorizzo» vale')
{
  ok('nessuna risposta: manca prima il tesseramento', m.sceltaMancante({}), 'tesseramento')
  ok('dato il tesseramento, mancano le foto', m.sceltaMancante({ tesseramento: true }), 'foto')
  ok('«non acconsento» al tesseramento è una risposta: mancano le foto', m.sceltaMancante({ tesseramento: false }), 'foto')
  ok('date le foto e non il tesseramento, manca il tesseramento', m.sceltaMancante({ foto: true }), 'tesseramento')
  ok('«non autorizzo» a tutte e due è una risposta: non manca niente', m.sceltaMancante({ tesseramento: false, foto: false }), null)
  ok('autorizzo a tutte e due: non manca niente', m.sceltaMancante({ tesseramento: true, foto: true }), null)
  ok('testi di ciò che manca', m.MANCA_SCELTA, {
    tesseramento: 'Nel modulo: scegli se acconsenti al tesseramento alla FIJLKAM e/o FIPE',
    foto: 'Nel modulo: scegli se autorizzi le foto',
  })
  ok('aiuto tesseramento, maggiorenne', m.aiutoScelta('tesseramento', false), 'Devi scegliere una delle due. Anche se non acconsenti, l\'iscrizione va avanti.')
  ok('aiuto tesseramento, minore', m.aiutoScelta('tesseramento', true), 'Devi scegliere una delle due. Anche se non autorizzi, l\'iscrizione va avanti.')
  ok('aiuto foto, maggiorenne', m.aiutoScelta('foto', false), 'Devi scegliere una delle due. Anche se non autorizzi, l\'iscrizione non cambia e non compari nelle foto.')
  ok('la nota sotto la scelta non ha il «Nel modulo:»', [m.NOTA_SCELTA.tesseramento, m.NOTA_SCELTA.foto], ['Scegli una risposta per il tesseramento alla FIJLKAM e/o FIPE', 'Scegli una risposta per le foto'])
  ok('aiuto foto, minore', m.aiutoScelta('foto', true), 'Devi scegliere una delle due. Anche se non autorizzi, l\'iscrizione non cambia e il minore non compare nelle foto.')
}

console.log('\n14. L\'avviso del certificato: una frase sola, serve per partecipare')
{
  // L'avviso del certificato è una frase sola: serve per partecipare, si carica o si porta. Né «obbligatorio» né il tag «PUOI PORTARLO DOPO».
  const avvisi = { normale: m.avvisoCertificato('normale'), agonistico: m.avvisoCertificato('agonistico') }
  ok('avviso certificato normale, testo esatto', avvisi.normale, 'Dai 6 anni serve il certificato medico per partecipare alle lezioni. Caricalo qui sotto o portalo in segreteria.')
  ok('avviso certificato agonistico, testo esatto', avvisi.agonistico, 'Per judo, aikido e lotta, dai 12 anni serve il certificato medico agonistico per partecipare alle lezioni. Caricalo qui sotto o portalo in segreteria.')
  ok('avviso certificato: nessuno dei due dice «obbligatorio» o «PUOI PORTARLO DOPO»', Object.values(avvisi).map((t) => /obbligatori|PUOI PORTARLO DOPO/i.test(t)), [false, false])
  ok('avviso certificato: entrambi dicono «per partecipare alle lezioni» e «portalo in segreteria»', Object.values(avvisi).map((t) => t.includes('per partecipare alle lezioni') && t.includes('portalo in segreteria')), [true, true])
}

console.log('\n15. da dove arriva la richiesta: la prova pulisce e scarta come 74-provenienza-richieste.sql')
{
  let n = 0
  // Ogni richiesta con un'email sua: il limite per email non c'entra.
  const manda = async (cambi) => {
    const id = await r.invia(adulto({ email: `da${++n}@esempio.it`, ...cambi }))
    const x = (await r.richieste()).find((y) => y.id === id)
    return `${x.provenienza ?? '—'}|${x.conosciuto ?? '—'}`
  }
  ok('dalla pagina di un corso', await manda({ provenienza: 'corso-karate' }), 'corso-karate|—')
  ok('spazi ai lati e maiuscole: puliti', await manda({ provenienza: '  Instagram ' }), 'instagram|—')
  ok('91 caratteri: la richiesta arriva, senza etichetta', await manda({ provenienza: 'a'.repeat(91) }), '—|—')
  ok('90 caratteri vanno', await manda({ provenienza: 'a'.repeat(90) }), `${'a'.repeat(90)}|—`)
  ok('un pezzo di codice: senza etichetta', await manda({ provenienza: '<script>alert(1)</script>' }), '—|—')
  ok('una barra: senza etichetta', await manda({ provenienza: 'a/b' }), '—|—')
  ok('una formula da foglio di calcolo: senza etichetta', await manda({ provenienza: '=1+1' }), '—|—')
  ok('vuota: senza etichetta', await manda({ provenienza: '' }), '—|—')
  ok('uno spazio in mezzo: senza etichetta', await manda({ provenienza: 'volantino ottobre' }), '—|—')
  ok('un numero invece del testo: senza etichetta', await manda({ provenienza: 12 }), '—|—')
  ok('un elenco invece del testo: senza etichetta', await manda({ provenienza: ['home'] }), '—|—')
  ok('Instagram fra le scelte', await manda({ conosciuto: 'instagram' }), '—|instagram')
  ok('Passando davanti, con gli spazi', await manda({ conosciuto: ' Passando-Davanti ' }), '—|passando-davanti')
  ok('una scelta inventata: si scarta', await manda({ conosciuto: 'tiktok' }), '—|—')
  ok('un testo libero: si scarta', await manda({ conosciuto: "me l'ha detto Mario" }), '—|—')
  ok('le due insieme', await manda({ provenienza: 'home', conosciuto: 'google' }), 'home|google')
  ok('un\'etichetta sbagliata non cambia l\'errore di un campo sbagliato', await errore(() => r.invia(adulto({ email: 'da-cap@esempio.it', provenienza: 'a/b', cap: '1009' }))), 'Un campo non va: il CAP ha 5 cifre')

  // Accolta, la persona non porta l'etichetta: resta nella richiesta.
  const id = (await r.richieste()).find((x) => x.provenienza === 'home' && x.conosciuto === 'google').id
  const persona = await r.accogli(id)
  const scheda = m.archivio.dati.persone.find((p) => p.id === persona)
  ok('accolta: la scheda della persona non ha né etichetta né «come ci ha conosciuto»', ['provenienza', 'conosciuto'].filter((k) => k in scheda), [])
  ok('accolta: la richiesta le tiene', (await r.richieste()).find((x) => x.id === id).provenienza, 'home')

  // I conteggi della prova: una riga per richiesta, senza dati personali, che resta quando la richiesta si elimina.
  const conteggi = async () => (typeof s.richiesteDaDove === 'function' ? s.richiesteDaDove(new Date(2026, 8, 1), new Date(2026, 8, 26)) : { righe: [] })
  const quante = (d, dove) => d.righe.filter((x) => x.provenienza === dove).reduce((t, x) => t + x.n, 0)
  const prima = await conteggi()
  ok('i conteggi: la richiesta da corso-karate c\'è', quante(prima, 'corso-karate'), 1)
  ok('i conteggi: home accolta', prima.righe.filter((x) => x.provenienza === 'home').map((x) => x.stato), ['accolta'])
  ok('i conteggi: le chiavi di ogni riga, niente nomi né email', [...new Set(prima.righe.flatMap((x) => Object.keys(x)))].sort(), ['conosciuto', 'corsi', 'n', 'provenienza', 'stato'])
  ok('i conteggi: da quando si conta, oggi', prima.dal, '2026-09-26')
  const daEliminare = (await r.richieste()).find((x) => x.provenienza === 'corso-karate').id
  await r.elimina(daEliminare)
  // Eliminata quando è ancora nuova (lo spam) non conta più; accolta o rifiutata, eliminata, resta contata.
  ok('una richiesta eliminata da nuova non conta più', quante(await conteggi(), 'corso-karate'), 0)
  ok('una richiesta accolta non si elimina, e resta contata', [await errore(() => r.elimina(id)), quante(await conteggi(), 'home')], [m.ACCOLTA_RESTA, 1])
  ok('fuori dal periodo non conta', typeof s.richiesteDaDove === 'function' && (await s.richiesteDaDove(new Date(2026, 7, 1), new Date(2026, 7, 31))).righe.length, 0)
  const rif = (await r.richieste()).find((x) => x.provenienza === 'instagram').id
  await r.rifiuta(rif)
  ok('rifiutata: il conteggio segue lo stato', (await conteggi()).righe.filter((x) => x.provenienza === 'instagram').map((x) => x.stato), ['rifiutata'])
}

console.log('\n16. la metà vera: le due chiavi partono, e si rileggono')
{
  const reg = []
  const db = {
    rpc: async (nome, args) => (reg.push([nome, args]), { data: 'r-1', error: null }),
  }
  const v = m.creaRichiesteSupabase(db)
  await v.invia(adulto({ provenienza: 'corso-karate', conosciuto: 'instagram' }))
  ok('invia: provenienza e conosciuto, coi nomi del database', [reg[0][1].dati.provenienza, reg[0][1].dati.conosciuto], ['corso-karate', 'instagram'])
  const riga = { id: 'r-2', creata_il: '2026-09-26T10:00:00Z', stato: 'nuova', nome: 'Luca', cognome: 'Rossi', nato_il: '1996-01-01', nato_a: 'Torino', codice_fiscale: 'RSSLCU96A01L219K', indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'l@e.it', telefono: '347', telefono_2: null, genitore_nome: null, genitore_cognome: null, genitore_codice_fiscale: null, corsi: [], formula: 'annuale', note: null, regolamento: true, persona_id: null, gestita_il: null, gestore: null }
  const leggi = (righe) => {
    const c = { select: () => c, order: () => c, range: (a) => (a ? { then: (bene) => bene({ data: [], error: null }) } : { then: (bene) => bene({ data: righe, error: null }) }) }
    return m.creaRichiesteSupabase({ from: () => c }).richieste()
  }
  const [con] = await leggi([{ ...riga, provenienza: 'home', conosciuto: 'google' }])
  ok('richieste: le due colonne si leggono', [con.provenienza, con.conosciuto], ['home', 'google'])
  const [senza] = await leggi([riga])
  ok('richieste: senza 74-provenienza-richieste.sql le colonne non ci sono, e la richiesta si legge lo stesso', [senza.id, senza.provenienza, senza.conosciuto], ['r-2', undefined, undefined])
}

console.log('\n17. i conteggi della prova: una chiave loro, riletta a ogni uso, come il database')
{
  const DOVE_CONTE = 'ods-corsi:prova-richieste-contate'
  const conte = () => JSON.parse(localStorage.getItem(DOVE_CONTE) ?? '[]')
  let n = 0
  const manda = (cambi = {}) => r.invia(adulto({ email: `conte${++n}@esempio.it`, ...cambi }))
  const id1 = await manda({ provenienza: 'volantino' })
  ok('i conteggi stanno nella loro chiave', conte().some((x) => x.richiestaId === id1 && x.provenienza === 'volantino'), true)
  ok('e non nell\'archivio di prova', 'richiesteContate' in m.archivio.dati, false)
  // Un'altra scheda (la segreteria, aperta prima) salva il suo archivio: i conteggi non si perdono.
  m.archivio.salva()
  ok('due schede: la segreteria salva l\'archivio, il conteggio del modulo resta', conte().some((x) => x.richiestaId === id1), true)
  // Un'altra scheda (il modulo) scrive un conteggio nella chiave: questa scheda non lo cancella alla scrittura dopo.
  localStorage.setItem(DOVE_CONTE, JSON.stringify([...conte(), { richiestaId: 'r-altra-scheda', giorno: '2026-09-26', corsi: ['judo-adulti'], stato: 'nuova' }]))
  await manda({ provenienza: 'festa' })
  ok('due schede: il conteggio scritto dall\'altra scheda resta', conte().some((x) => x.richiestaId === 'r-altra-scheda'), true)
  ok('e lo legge anche la segreteria', (await s.richiesteDaDove(new Date(2026, 8, 1), new Date(2026, 8, 26))).righe.some((x) => x.provenienza === undefined && x.corsi.includes('judo-adulti')), true)

  // Una richiesta di prima (senza conteggio), rifiutata o accolta: il conteggio non nasce, come nel database.
  const vecchie = JSON.parse(localStorage.getItem('ods-corsi:prova-richieste'))
  localStorage.setItem('ods-corsi:prova-richieste', JSON.stringify([...vecchie, { ...adulto({ email: 'vecchia@esempio.it', codiceFiscale: 'RSSLCU96A01L219K' }), id: 'r-vecchia', creataIl: '2026-05-01T10:00:00Z', stato: 'nuova' }]))
  const r2 = m.creaRichiesteProva()
  await r2.rifiuta('r-vecchia')
  ok('una richiesta senza conteggio, rifiutata, resta senza conteggio', conte().some((x) => x.richiestaId === 'r-vecchia'), false)

  // La regola del database: eliminata da nuova non conta più, accolta o rifiutata sì.
  const id3 = await manda({ provenienza: 'spam' })
  await r.elimina(id3)
  ok('eliminata da nuova: il conteggio va via', conte().some((x) => x.provenienza === 'spam'), false)
  const id4 = await manda({ provenienza: 'rifiutata-poi' })
  await r.rifiuta(id4)
  await r.elimina(id4)
  ok('rifiutata e poi eliminata: resta contata, senza legame', conte().filter((x) => x.provenienza === 'rifiutata-poi').map((x) => [x.stato, x.richiestaId ?? '—']), [['rifiutata', '—']])

  // Ricominciare la prova toglie anche i conteggi.
  m.scordaRichiesteProva()
  ok('scordaRichiesteProva toglie anche i conteggi', localStorage.getItem(DOVE_CONTE), null)
  ok('e la funzione esportata li legge vuoti', m.richiesteContateProva(), [])

  // Gli esempi: almeno una richiesta con l'etichetta e una senza, contate una volta sola anche caricandoli due volte.
  m.seminaEsempi(new Date())
  const esempi = (await r2.richieste()).filter((x) => x.id.startsWith('r-esempio-'))
  ok('gli esempi: almeno uno con l\'etichetta e uno senza', [esempi.some((x) => x.provenienza), esempi.some((x) => !x.provenienza)], [true, true])
  const righe = (await s.richiesteDaDove(new Date(2026, 0, 1), new Date(2026, 11, 31))).righe
  ok('gli esempi nel riquadro: una riga con l\'etichetta e una senza', [righe.some((x) => x.provenienza), righe.some((x) => !x.provenienza)], [true, true])
  const prima = m.richiesteContateProva().length
  m.aggiungiRichiesteProva(esempi)
  ok('gli esempi caricati due volte contano una volta sola', [m.richiesteContateProva().length, prima], [esempi.length, esempi.length])
  ok('il periodo al contrario: lo stesso errore del database', await errore(() => s.richiesteDaDove(new Date(2026, 8, 26), new Date(2026, 8, 1))), 'il periodo è al contrario')
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
