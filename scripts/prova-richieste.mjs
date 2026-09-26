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
      "export { creaRichiesteProva } from './src/lib/richiesteProva'; export { controlla, minorenne } from './src/lib/richieste'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'",
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
  nome: 'Luca', cognome: 'Rossi', natoIl: '1996-01-01', natoA: 'Torino', codiceFiscale: 'rsslcu96a01 l219x',
  indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'Luca@Esempio.it', telefono: '347 111 2233',
  corsi: ['judo-adulti'], formula: 'annuale', ...cambi,
})
const genitore = { genitoreNome: 'Paola', genitoreCognome: 'Rossi', genitoreCodiceFiscale: 'RSSPLA80A41L219X' }

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
}

console.log('\n3. le richieste arrivano')
const luca = await r.invia(adulto())
const giulia = await r.invia(adulto({ nome: 'Giulia', codiceFiscale: 'RSSGLI17C41L219X', natoIl: '2017-03-01', email: 'mamma@esempio.it', corsi: ['judo-2', 'lotta-2'], ...genitore }))
const marco = await r.invia(adulto({ nome: 'Marco', codiceFiscale: 'RSSMRC15E05L219X', natoIl: '2015-05-05', email: 'MAMMA@esempio.it', corsi: ['judo-3'], ...genitore }))
const terzo = await r.invia(adulto({ nome: 'Terzo', codiceFiscale: 'RSSTRZ90A01L219X', email: 'mamma@esempio.it' }))
{
  ok('la quarta dalla stessa email no', await errore(() => r.invia(adulto({ nome: 'Quarto', email: 'mamma@esempio.it' }))), 'Da questa email sono già arrivate 3 richieste oggi: se serve, scrivi alla segreteria')
  const tutte = await r.richieste()
  ok('sono quattro, nuove', tutte.map((x) => x.stato), ['nuova', 'nuova', 'nuova', 'nuova'])
  const l = tutte.find((x) => x.id === luca)
  ok('email e codice fiscale messi in ordine', `${l.email} ${l.codiceFiscale}`, 'luca@esempio.it RSSLCU96A01L219X')
  ok('il genitore di un adulto non si tiene', l.genitoreNome, undefined)
  await r.caricaFile(luca, 'modulo', new File(['x'], 'modulo.pdf', { type: 'application/pdf' }))
  ok('il file si ritrova, come PDF', (await r.file(luca)).map((f) => [f.tipo, f.pdf]), [['modulo', true]])
}

console.log('\n4. la segreteria accoglie e rifiuta')
{
  const id = await r.accogli(luca)
  const p = (await s.persone()).find((x) => x.id === id)
  ok('Luca è in elenco', [p.nome, p.cognome, p.email, p.telefono], ['Luca', 'Rossi', 'luca@esempio.it', '347 111 2233'])
  ok('iscritto al Judo adulti da oggi', p.iscrizioni.map((i) => [i.corsoId, i.dal]), [['judo-adulti', '2026-09-26']])
  ok('una seconda volta no', await errore(() => r.accogli(luca)), 'Questa richiesta è già stata accolta')
  ok('la richiesta sa chi è nata', (await r.richieste()).find((x) => x.id === luca).personaId, id)

  const g = await r.accogli(giulia)
  const mm = await r.accogli(marco)
  const persone = await s.persone()
  ok('i due fratelli: la mail a una sola', [persone.find((x) => x.id === g).email, persone.find((x) => x.id === mm).email], ['mamma@esempio.it', undefined])
  ok('Giulia ha i suoi due corsi', persone.find((x) => x.id === g).iscrizioni.map((i) => i.corsoId).sort(), ['judo-2', 'lotta-2'])

  await r.rifiuta(terzo)
  ok('il terzo è rifiutato', (await r.richieste()).find((x) => x.id === terzo).stato, 'rifiutata')
  ok('e non si accoglie più', await errore(() => r.accogli(terzo)), 'Questa richiesta è già stata rifiutata')
  await r.elimina(terzo)
  ok('eliminato, sparisce', (await r.richieste()).some((x) => x.id === terzo), false)

  const e = await s.esporta(id)
  ok("l'esportazione porta la richiesta", e.richieste_di_iscrizione.map((x) => [x.stato, x.codiceFiscale]), [['accolta', 'RSSLCU96A01L219X']])
}

console.log('\n5. chi torna non diventa un doppione')
{
  // Una persona di prova che ha smesso: la si fa tornare con la richiesta.
  const vecchia = (await s.persone()).find((p) => p.iscrizioni.length && !p.email)
  const corso = vecchia.iscrizioni[0].corsoId
  await s.termina(vecchia.id, corso)
  await s.attivaPersona(vecchia.id, false)
  const id = await r.invia(adulto({ nome: vecchia.nome.toUpperCase(), cognome: vecchia.cognome.toLowerCase(), codiceFiscale: 'VCCTRN90A01L219X', email: 'torno@esempio.it', corsi: [corso] }))
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
  const id = await r.invia(adulto({ nome: 'Giulia', codiceFiscale: 'rssgli17c41l219x', natoIl: '2017-03-01', email: 'papa@esempio.it', corsi: ['psicomotricita'], ...genitore }))
  const prima = (await r.richieste()).find((x) => x.id === giulia).personaId
  ok('ritrova Giulia, non ne fa un’altra', await r.accogli(id), prima)
  ok('nessuna Giulia in più', await quante(), primaDi)
  ok('con la mail di prima', (await s.persone()).find((x) => x.id === prima).email, 'mamma@esempio.it')
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
