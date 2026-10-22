// ---------------------------------------------------------------------------
// Il nucleo familiare dal lato della segreteria, senza browser.
//
//   node scripts/prova-nucleo.mjs
//
// Il nucleo (`persone.nucleo`: il titolare di una persona) passa dalla
// modalità prova al database vero (`99-nucleo.sql`, provato da
// `supabase/prova/nucleo.sql`). Qui i casi sono gli stessi, con gli stessi
// messaggi: le regole di `nucleo.ts` e la segreteria di prova da una parte, il
// client del database (con un database finto) dall'altra. Le sezioni vanno
// in coppia con quelle del file SQL.
//   · il titolare è maggiorenne (senza data di nascita passa);
//   · disattivare un titolare con gente nel nucleo non si può;
//   · il titolare che non frequenta non conta fra le quote da incassare né fra
//     i «da sistemare»;
//   · unire due schede, eliminare un titolare, accogliere una richiesta «per
//     il nucleo di» seguono il nucleo;
//   · l'importazione dai fogli non crea né cambia nuclei;
//   · senza il file SQL la scheda non si rompe.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export { creaRichiesteProva } from './src/lib/richiesteProva'; export { creaRichiesteSupabase } from './src/lib/richiesteSupabase'; export { creaIscrittoProva } from './src/lib/iscrittoProva'; export { archivio } from './src/lib/archivioProva'; export { cosaNonVaNucleo, nuovoTitolare } from './src/lib/nucleo'; export { contiChip } from './src/lib/filtriIscritti'; export { leggiFogli, importa } from './src/lib/importa'; export { carattereControllo, lettereCognome, lettereNome } from './src/lib/codiceFiscale'",
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

// Come Supabase: dalla seconda pagina (`.range()` oltre la prima) un elenco finto è finito.
const oltre = { then: (f, ko) => Promise.resolve({ data: [], error: null }).then(f, ko) }
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

// Oggi, per la prova, è sabato 26 settembre 2026 a mezzogiorno: «diciotto anni oggi» e «domani» si contano da qui.
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
const s = m.creaSegreteriaProva()
const a = m.archivio.dati
let guai = 0
// Un errore non previsto dice il messaggio, non l'intero modulo in base64.
process.on('uncaughtException', (e) => {
  console.log('  ✗ errore non previsto —', e.message, (e.stack ?? '').split('\n').find((r) => r.includes('prova-nucleo')) ?? '')
  process.exit(1)
})
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

// I messaggi, gli stessi del database (`supabase/prova/nucleo.sql`).
const MINORE = 'Il titolare deve essere maggiorenne: scegli un adulto'
const NON_NEL_NUCLEO = 'Non è nel nucleo di nessuno'
const PRIMA_IL_TITOLARE = 'Prima cambia il titolare del nucleo'
const DISATTIVATA = 'Le schede disattivate non entrano in un nucleo'
const DI_UN_ALTRO = 'È già nel nucleo di un altro: prima toglilo da lì'
const SCEGLI_IL_TITOLARE = 'È già nel nucleo di un altro: scegli il titolare'
const GIA_QUI = 'È già in questo nucleo'
const CON_ALTRI = 'Ha un nucleo suo, con altri dentro: prima toglili, o fai titolare un altro'
const DA_SOLO = 'Una persona non entra nel suo stesso nucleo'
const INESISTENTE = 'Persona inesistente'
const unitaMembro = (nome) => `${nome} è nel nucleo familiare di un'altra persona: prima toglila dal nucleo`
const unitaTitolare = (nome) => `${nome} è titolare di un nucleo familiare: prima rendi titolare qualcun altro o togli gli altri dal nucleo`

// Una data di nascita a `anni` anni da oggi, più `giorni` (diciotto anni «domani»: giorni = 1).
const g = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const nato = (anni, giorni = 0) => g(new Date(2026 - anni, 8, 26 + giorni))

// ---------------------------------------------------------------------------
console.log('\n1. le regole di nucleo.ts (cosaNonVaNucleo, nuovoTitolare)')
{
  const x = (id, extra = {}) => ({ id, attiva: true, ...extra })
  const tutti = [
    x('adulto', { natoIl: '1980-01-01' }),
    x('altro', { natoIl: '1975-05-05' }),
    x('minore', { natoIl: '2015-03-01' }),
    x('senza'),
    x('spenta', { attiva: false, natoIl: '1990-01-01' }),
    x('diciotto', { natoIl: nato(18) }),
    x('quasi', { natoIl: nato(18, 1) }),
    x('membro', { nucleo: 'adulto', natoIl: '2014-01-01' }),
    x('titolare', { natoIl: '1982-01-01' }),
    x('suo', { nucleo: 'titolare', natoIl: '2012-01-01' }),
  ]
  const va = (p, t) => m.cosaNonVaNucleo(tutti, p, t)
  ok('un adulto libero entra nel nucleo di un adulto', va('altro', 'adulto'), null)
  ok('un minore entra come membro', va('minore', 'adulto'), null)
  ok('un titolare senza data di nascita passa', va('minore', 'senza'), null)
  ok('diciotto anni oggi: maggiorenne', va('minore', 'diciotto'), null)
  ok('diciotto anni domani: ancora no', va('altro', 'quasi'), MINORE)
  ok('un minorenne non è titolare', va('altro', 'minore'), MINORE)
  ok('una persona che non c\'è', va('fantasma', 'adulto'), INESISTENTE)
  ok('un titolare che non c\'è', va('altro', 'fantasma'), INESISTENTE)
  ok('non in sé stesso', va('adulto', 'adulto'), DA_SOLO)
  ok('una scheda disattivata non entra', va('spenta', 'adulto'), DISATTIVATA)
  ok('né fa da titolare', va('altro', 'spenta'), DISATTIVATA)
  ok('il titolare non è nel nucleo di un altro', va('altro', 'membro'), SCEGLI_IL_TITOLARE)
  ok('non due volte nello stesso', va('membro', 'adulto'), GIA_QUI)
  ok('non in un altro nucleo', va('membro', 'altro'), DI_UN_ALTRO)
  ok('un titolare con altri dentro non entra in un altro', va('titolare', 'altro'), CON_ALTRI)

  // Il nuovo titolare: lei esce, il vecchio e gli altri passano a lei.
  const famiglia = [
    x('t', { natoIl: '1980-01-01' }),
    x('a', { nucleo: 't', natoIl: '1982-01-01' }),
    x('b', { nucleo: 't', natoIl: '2010-01-01' }),
    x('c', { nucleo: 't', natoIl: '2012-01-01' }),
    x('z', { natoIl: '1990-01-01' }),
    x('w', { nucleo: 'z', natoIl: '2015-01-01' }),
  ]
  const nuovo = m.nuovoTitolare(famiglia, 'a')
  ok('a diventa titolare: esce, e il vecchio e gli altri passano a lei', [...nuovo.entries()], [['a', null], ['t', 'a'], ['b', 'a'], ['c', 'a']])
  ok('un altro nucleo non si tocca', nuovo.has('z') || nuovo.has('w'), false)
  ok('chi non è nel nucleo di nessuno no', m.nuovoTitolare(famiglia, 'z'), NON_NEL_NUCLEO)
  ok('un titolare nemmeno: lo è già', m.nuovoTitolare(famiglia, 't'), NON_NEL_NUCLEO)
  ok('un minorenne non diventa titolare', m.nuovoTitolare(famiglia, 'b'), MINORE)
  ok('senza la data di nascita sì', [...m.nuovoTitolare([x('t'), x('u', { nucleo: 't' })], 'u').entries()], [['u', null], ['t', 'u']])
}

// ---------------------------------------------------------------------------
// Le persone di queste prove: le stesse di `supabase/prova/nucleo.sql`.
const P = {}
const crea = async (chiave, nome, cognome, natoIl) => {
  P[chiave] = await s.salvaPersona({ nome, cognome })
  if (natoIl) await s.salvaAnagrafica(P[chiave], { natoIl })
  return P[chiave]
}
await crea('marco', 'Marco', 'Rossi', nato(45))
await crea('sara', 'Sara', 'Rossi', nato(12))
await crea('gino', 'Gino', 'Rossi', nato(9))
await crea('elena', 'Elena', 'Bianchi', nato(40))
await crea('teo', 'Teo', 'Bianchi', nato(10))
await crea('pia', 'Pia', 'Verdi') // senza data di nascita
await crea('ugo', 'Ugo', 'Neri', nato(15))
await crea('dora', 'Dora', 'Gialli', nato(30))
await crea('gianni', 'Gianni', 'Grigi', nato(50))
await crea('rita', 'Rita', 'Blu', nato(18))
await crea('lia', 'Lia', 'Rosa', nato(18, 1))
await crea('zita', 'Zita', 'Libera', nato(29))
await crea('vera', 'Vera', 'Libera', nato(33)) // adulta libera: fa da «chi non deve entrare» nei rifiuti
await s.attivaPersona(P.dora, false)
const nucleoDi = (id) => a.persone.find((p) => p.id === id)?.nucleo ?? null
const impronta = () => JSON.stringify(a.persone.filter((p) => p.ruolo === 'iscritto').map((p) => [p.id, p.nucleo ?? null, p.attiva]))
const metti = (p, t) => errore(() => s.mettiNelNucleo(P[p], P[t]))
const togli = (p) => errore(() => s.togliDalNucleo(P[p]))
const rendi = (p) => errore(() => s.rendiTitolare(P[p]))

console.log('\n2. la segreteria mette nel nucleo (sezione 1 e 2 del file SQL)')
{
  ok('Sara entra nel nucleo di Marco', await metti('sara', 'marco'), 'nessun errore')
  ok('Gino anche', await metti('gino', 'marco'), 'nessun errore')
  ok('Sara e Gino da Marco; lui da nessuno', [nucleoDi(P.sara), nucleoDi(P.gino), nucleoDi(P.marco)], [P.marco, P.marco, null])
  ok('un titolare senza data di nascita passa (Pia)', await metti('teo', 'pia'), 'nessun errore')
  ok('diciotto anni oggi: maggiorenne, titolare', await metti('gianni', 'rita'), 'nessun errore')
  // Sara ha un corso e una ricevuta: toglierla dal nucleo non li tocca.
  await s.iscrivi(P.sara, 'lotta-2')
  const ente = await s.enteRicevute()
  const socio = await s.intestatarioDi(P.sara)
  await s.emettiRicevuta({
    data: '2026-09-01', personaId: P.sara, ente, intestatario: socio, anticipo: 0,
    voci: [{ descrizione: 'Annuale Lotta 2', quantita: 1, prezzo: 5000, dal: '2026-09-01', al: '2027-06-30', pagamenti: [{ data: '2026-09-01', importo: 5000, metodo: 'Bonifico' }] }],
  })

  const prima = impronta()
  ok('una persona che non c\'è', await errore(() => s.mettiNelNucleo('non-esiste', P.marco)), INESISTENTE)
  ok('un titolare che non c\'è', await errore(() => s.mettiNelNucleo(P.elena, 'non-esiste')), INESISTENTE)
  ok('non in sé stesso', await metti('marco', 'marco'), DA_SOLO)
  ok('una scheda disattivata non entra', await metti('dora', 'marco'), DISATTIVATA)
  ok('né fa da titolare', await metti('elena', 'dora'), DISATTIVATA)
  ok('il titolare non è già nel nucleo di un altro', await metti('elena', 'sara'), SCEGLI_IL_TITOLARE)
  ok('non due volte nello stesso', await metti('sara', 'marco'), GIA_QUI)
  ok('non in un altro nucleo', await metti('sara', 'elena'), DI_UN_ALTRO)
  ok('un titolare con altri dentro non entra in un altro', await metti('marco', 'elena'), CON_ALTRI)
  ok('un minorenne non è titolare', await metti('vera', 'ugo'), MINORE)
  ok('nemmeno a un giorno dai diciotto anni', await metti('zita', 'lia'), MINORE)
  ok('niente è cambiato', impronta(), prima)
}

console.log('\n3. togliere dal nucleo (sezione 4)')
{
  ok('Sara esce', await togli('sara'), 'nessun errore')
  ok('è fuori dal nucleo e resta attiva', [nucleoDi(P.sara), a.persone.find((p) => p.id === P.sara).attiva], [null, true])
  ok('il suo corso c\'è ancora', a.iscrizioni.filter((i) => i.personaId === P.sara && !i.al).length, 1)
  const ric = await s.ricevute(P.sara)
  ok('e la sua ricevuta, intera', [ric.length, ric[0].totale, ric[0].pagato], [1, 5000, 5000])
  ok('gli altri restano dove sono', nucleoDi(P.gino), P.marco)
  ok('chi non è nel nucleo di nessuno non si toglie', await togli('sara'), NON_NEL_NUCLEO)
  ok('nemmeno un titolare', await togli('marco'), NON_NEL_NUCLEO)
}

console.log('\n4. cambiare titolare (sezione 5)')
{
  ok('Sara torna da Marco', await metti('sara', 'marco'), 'nessun errore')
  ok('Elena, adulta, entra nel nucleo di Marco', await metti('elena', 'marco'), 'nessun errore')
  ok('chi non è nel nucleo di nessuno non diventa titolare', await rendi('pia'), NON_NEL_NUCLEO)
  ok('un titolare nemmeno: lo è già', await rendi('marco'), NON_NEL_NUCLEO)
  const prima = impronta()
  ok('un minorenne non diventa titolare', await rendi('gino'), MINORE)
  ok('niente è cambiato', impronta(), prima)
  ok('Elena diventa titolare', await rendi('elena'), 'nessun errore')
  ok('lei esce dal nucleo; Marco, Sara e Gino passano a lei', [P.elena, P.marco, P.sara, P.gino].map(nucleoDi), [null, P.elena, P.elena, P.elena])
  ok('nessuno ha più Marco come titolare', a.persone.filter((p) => p.nucleo === P.marco).length, 0)
  ok('Gianni, adulto, diventa titolare del suo: Rita passa a lui', [await rendi('gianni'), nucleoDi(P.gianni), nucleoDi(P.rita)], ['nessun errore', null, P.gianni])
  ok('Rita, di prima, non c\'entra con quello di Elena', nucleoDi(P.rita) === P.elena, false)
}

console.log('\n5. disattivare (sezione 6)')
{
  ok('il titolare con gente nel nucleo non si disattiva', await errore(() => s.attivaPersona(P.elena, false)), PRIMA_IL_TITOLARE)
  ok('è ancora attivo', a.persone.find((p) => p.id === P.elena).attiva, true)
  await s.attivaPersona(P.sara, false)
  ok('un membro si disattiva come sempre, e resta nel nucleo come storia', [a.persone.find((p) => p.id === P.sara).attiva, nucleoDi(P.sara)], [false, P.elena])
  ok('ma da disattivata non si aggiunge a un altro', await metti('sara', 'pia'), DISATTIVATA)
  await s.attivaPersona(P.ugo, false)
  ok('chi non ha un nucleo si disattiva come sempre', a.persone.find((p) => p.id === P.ugo).attiva, false)
  await s.attivaPersona(P.marco, false)
  await s.attivaPersona(P.rita, false)
  ok('Marco (membro) e Rita (membro) anche', [P.marco, P.rita].map((id) => a.persone.find((p) => p.id === id).attiva), [false, false])
  await s.attivaPersona(P.sara, true)
  await s.attivaPersona(P.marco, true)
  ok('riattivare è sempre libero', [P.sara, P.marco].map((id) => a.persone.find((p) => p.id === id).attiva), [true, true])
  for (const f of ['marco', 'sara', 'gino']) await togli(f)
  await s.attivaPersona(P.elena, false)
  ok('svuotato il nucleo, anche il titolare si disattiva', a.persone.find((p) => p.id === P.elena).attiva, false)
  for (const f of ['elena', 'ugo', 'rita']) await s.attivaPersona(P[f], true)
  await togli('rita')
  await togli('teo')
}

console.log('\n6. unire due schede (sezione 7)')
{
  await crea('carlo', 'Carlo', 'Uno')
  await crea('dino', 'Dino', 'Due')
  await crea('enzo', 'Enzo', 'Tre')
  await crea('fabio', 'Fabio', 'Quattro')
  await crea('gaia', 'Gaia', 'Cinque')
  await crea('hugo', 'Hugo', 'Sei')
  await crea('ivo', 'Ivo', 'Sette')
  await s.mettiNelNucleo(P.dino, P.carlo)
  await s.mettiNelNucleo(P.ivo, P.carlo)
  await s.mettiNelNucleo(P.gaia, P.fabio)
  const prima = impronta()
  const unisci = (resta, via) => errore(() => s.unisciPersone(P[resta], P[via]))
  const anteprima = (resta, via) => errore(() => s.anteprimaUnione(P[resta], P[via]))
  ok('chi va via è nel nucleo di un altro', await unisci('enzo', 'dino'), unitaMembro('Dino Due'))
  ok('lo dice anche l\'anteprima', await anteprima('enzo', 'dino'), unitaMembro('Dino Due'))
  ok('chi va via è titolare con altri dentro', await unisci('enzo', 'fabio'), unitaTitolare('Fabio Quattro'))
  ok('lo dice anche l\'anteprima', await anteprima('enzo', 'fabio'), unitaTitolare('Fabio Quattro'))
  ok('due dello stesso nucleo non si uniscono', await unisci('dino', 'ivo'), unitaMembro('Ivo Sette'))
  ok('il titolare non assorbe un suo membro', await unisci('carlo', 'dino'), unitaMembro('Dino Due'))
  ok('il membro non assorbe il suo titolare', await unisci('dino', 'carlo'), unitaTitolare('Carlo Uno'))
  ok('niente è cambiato, nessuna scheda è sparita', impronta(), prima)
  ok('Enzo, libero, si unisce al titolare Carlo', await unisci('carlo', 'enzo'), 'nessun errore')
  ok('Hugo, libero, si unisce al membro Dino', await unisci('dino', 'hugo'), 'nessun errore')
  ok('le due schede libere non ci sono più', [P.enzo, P.hugo].map((id) => a.persone.some((p) => p.id === id)), [false, false])
  ok('Dino è ancora nel nucleo di Carlo', nucleoDi(P.dino), P.carlo)
  ok('nessuno ha come titolare una scheda sparita', a.persone.filter((p) => p.nucleo && !a.persone.some((t) => t.id === p.nucleo)).length, 0)
}

console.log('\n7. chi si cancella: i suoi tornano senza nucleo (sezione 8)')
{
  const bruno = await s.salvaPersonale({ nome: 'Bruno', cognome: 'Istruttore', ruolo: 'istruttore' })
  await crea('omar', 'Omar', 'Trentaquattro')
  // Un istruttore titolare non si fa dalle funzioni del nucleo: qui lo si mette a mano, come lo lascerebbe una scrittura diretta.
  a.persone = a.persone.map((p) => (p.id === P.omar ? { ...p, nucleo: bruno } : p))
  ok('elimina_istruttore: Bruno se ne va', await errore(() => s.eliminaIstruttore(bruno)), 'nessun errore')
  ok('Omar torna senza nucleo', nucleoDi(P.omar), null)
  ok('nessun riferimento orfano', a.persone.filter((p) => p.nucleo && !a.persone.some((t) => t.id === p.nucleo)).length, 0)
}

console.log('\n8. il titolare che non frequenta non pesa (regola 8)')
{
  await crea('tito', 'Tito', 'Titolari', nato(44))
  await crea('mia', 'Mia', 'Titolari', nato(8))
  await crea('solo', 'Solo', 'Senzacorsi', nato(44))
  await s.mettiNelNucleo(P.mia, P.tito)
  await s.iscrivi(P.mia, 'lotta-2')
  const contesto = { oggi: '2026-09-26', scopertiDi: () => [], tesseraDi: () => [] }
  // Si guarda l'elenco intero, non la persona sola: come lo dà `persone()` alla pagina ISCRITTI.
  const conta = async (...chi) => (({ pagare, fuori }) => ({ pagare, fuori }))(m.contiChip(await s.persone(), (p) => chi.includes(p.id), contesto))
  ok('il titolare senza corsi non è da incassare, né da sistemare', await conta(P.tito), { pagare: 0, fuori: 0 })
  ok('chi è senza corsi e senza nucleo sì, come sempre', await conta(P.solo), { pagare: 1, fuori: 1 })
  ok('il membro che frequenta sì, come sempre', await conta(P.mia), { pagare: 1, fuori: 1 })
  ok('il nucleo dei figli resta intero', (await s.persone()).filter((p) => p.nucleo === P.tito).map((p) => p.id), [P.mia])
  await s.iscrivi(P.tito, 'lotta-2')
  ok('se il titolare frequenta anche lui, è come tutti', await conta(P.tito), { pagare: 1, fuori: 1 })
  await s.termina(P.tito, 'lotta-2')
  await s.togliDalNucleo(P.mia)
  ok('senza nessuno nel nucleo è un iscritto senza corsi, come tutti', await conta(P.tito), { pagare: 1, fuori: 1 })
}

console.log('\n9. una richiesta fatta per il nucleo di qualcuno (sezione 9)')
{
  const r = m.creaRichiesteProva()
  // Una richiesta di un adulto (codice fiscale giusto) per il nucleo di `nucleoDi`.
  const richiesta = (nome, nucleoDi) => {
    const natoIl = nato(35)
    const pezzo = `${m.lettereCognome('Richiesti')}${m.lettereNome(nome)}${natoIl.slice(2, 4)}P26L219`
    return { nome, cognome: 'Richiesti', natoIl, natoA: 'Torino', codiceFiscale: pezzo + m.carattereControllo(pezzo), indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: `${nome.toLowerCase()}@esempio.it`, telefono: '347 111 2233', corsi: ['judo-adulti'], formula: 'annuale', regolamento: true, nucleoDi }
  }
  await crea('pino', 'Pino', 'Quaranta', nato(35))
  await crea('rosa', 'Rosa', 'Quarantuno', nato(38))
  await crea('sofia', 'Sofia', 'Quarantadue')
  await s.mettiNelNucleo(P.sofia, P.rosa)

  const dolce = await r.invia(richiesta('Tina', P.pino))
  const tina = await r.accogli(dolce)
  ok('accolta, la persona nuova entra nel nucleo di chi l\'ha aggiunta', nucleoDi(tina), P.pino)

  const stessa = await r.invia(richiesta('Pina', P.pino))
  ok('accolta sulla scheda del titolare stesso: l\'accoglimento riesce', await r.accogli(stessa, P.pino), P.pino)
  ok('ma non entra nel suo stesso nucleo', nucleoDi(P.pino), null)

  const sua = await r.invia(richiesta('Rina', P.pino))
  ok('accolta sulla scheda di chi ha un nucleo suo: l\'accoglimento riesce', await r.accogli(sua, P.rosa), P.rosa)
  ok('Rosa resta titolare, e Sofia è ancora sua', [nucleoDi(P.rosa), nucleoDi(P.sofia)], [null, P.rosa])
}

console.log('\n10. l\'importazione dai fogli non crea né cambia nuclei (regola 13)')
{
  await crea('lina', 'Lina', 'Foglio')
  await s.salvaPersona({ id: P.lina, nome: 'Lina', cognome: 'Foglio', email: 'lina@esempio.it' })
  await crea('piero', 'Piero', 'Foglio', nato(40))
  await s.mettiNelNucleo(P.lina, P.piero)
  const corsi = (await s.corsi()).map((c) => c.nome)
  const fogli = m.leggiFogli(null, 'nome;cognome;email;telefono;corso\nLina;Foglio;lina@esempio.it;333;Lotta 2\nNicola;Foglio;nicola@esempio.it;333;Lotta 2\n', corsi)
  await m.importa(s, fogli, () => {})
  ok('chi c\'è già e viene aggiornata conserva il suo nucleo', nucleoDi(P.lina), P.piero)
  const nuova = a.persone.find((p) => p.nome === 'Nicola' && p.cognome === 'Foglio')
  ok('chi nasce dal foglio nasce senza nucleo, e c\'è', [!!nuova, nuova?.nucleo ?? null], [true, null])
}

// ---------------------------------------------------------------------------
// Il client del database, con un database finto: le funzioni del nucleo e la scheda che non si rompe.
const rispostaOk = { data: null, error: null }
const senzaTabelle = (risposta, chiamate) =>
  m.creaSegreteriaSupabase({
    from: () => {
      throw new Error('non deve leggere tabelle')
    },
    rpc: async (nome, args) => (chiamate.push([nome, args]), typeof risposta === 'function' ? risposta(nome) : risposta),
  })

console.log('\n11. col database: le tre funzioni (99-nucleo.sql)')
{
  const chiamate = []
  const db = senzaTabelle(rispostaOk, chiamate)
  const dette = [
    await errore(() => db.mettiNelNucleo('p1', 't1')),
    await errore(() => db.togliDalNucleo('p1')),
    await errore(() => db.rendiTitolare('p2')),
  ]
  ok('le tre funzioni non rifiutano più «solo in prova»', dette.filter((d) => /solo in prova/.test(d)), [])
  ok('mette, toglie e cambia titolare con le funzioni, una sola chiamata ciascuna', chiamate, [
    ['metti_nel_nucleo', { persona: 'p1', titolare: 't1' }],
    ['togli_dal_nucleo', { persona: 'p1' }],
    ['rendi_titolare', { persona: 'p2' }],
  ])
  const no = (message, code = 'P0001') => senzaTabelle({ data: null, error: { code, message } }, [])
  ok('un rifiuto del database arriva com\'è: già nel nucleo', await errore(() => no(GIA_QUI).mettiNelNucleo('p1', 't1')), GIA_QUI)
  ok('il titolare minorenne', await errore(() => no(MINORE).mettiNelNucleo('p1', 't1')), MINORE)
  ok('togliere chi non c\'è', await errore(() => no(NON_NEL_NUCLEO).togliDalNucleo('p1')), NON_NEL_NUCLEO)
  ok('rendere titolare un minorenne', await errore(() => no(MINORE).rendiTitolare('p1')), MINORE)
  ok('disattivare il titolare', await errore(() => senzaTabelle(rispostaOk, []) && m.creaSegreteriaSupabase({ from: () => ({ update: () => ({ eq: async () => ({ data: null, error: { code: 'P0001', message: PRIMA_IL_TITOLARE } }) }) }) }).attivaPersona('t1', false)), PRIMA_IL_TITOLARE)
  const chiave = { PGRST202: 'Could not find the function public.metti_nel_nucleo(persona, titolare) in the schema cache', 42883: 'function public.metti_nel_nucleo(uuid, uuid) does not exist' }
  for (const [code, message] of Object.entries(chiave)) {
    const detto = await errore(() => no(message, code).mettiNelNucleo('p1', 't1'))
    ok(`senza il file SQL (${code}): «va lanciato 99-nucleo.sql», non il testo dell'API`, [/va lanciato 99-nucleo\.sql/i.test(detto), /schema cache|does not exist|function public/i.test(detto)], [true, false])
  }
  ok('lo stesso per togliere e per cambiare titolare', [
    /va lanciato 99-nucleo\.sql/i.test(await errore(() => no(chiave.PGRST202.replace('metti_nel_nucleo', 'togli_dal_nucleo'), 'PGRST202').togliDalNucleo('p1'))),
    /va lanciato 99-nucleo\.sql/i.test(await errore(() => no(chiave.PGRST202.replace('metti_nel_nucleo', 'rendi_titolare'), 'PGRST202').rendiTitolare('p1'))),
  ], [true, true])
}

console.log('\n12. col database: l\'elenco legge il nucleo, e senza la colonna non si rompe')
{
  const catena = (risposta) => {
    const q = { colonne: '' }
    const c = new Proxy(function () {}, {
      get: (_, p) => (p === 'range' ? (da) => (da ? oltre : c) : p === 'then' ? (bene, male) => Promise.resolve(risposta(q)).then(bene, male) : (...x) => (p === 'select' && (q.colonne = String(x[0])), c)),
      apply: () => c,
    })
    return c
  }
  const riga = (id, nucleo) => ({ id, nome: id, cognome: 'Prova', email: null, telefono: null, attiva: true, creata_il: '2026-01-01T10:00:00Z', iscrizioni: [], ...(nucleo !== undefined && { nucleo }) })
  const elenco = (righe, { colonna = true } = {}) => {
    const chiesto = []
    const db = m.creaSegreteriaSupabase({
      from: (t) =>
        catena((q) => {
          if (t !== 'persone') return { data: [], error: null }
          chiesto.push(q.colonne)
          return !colonna && /nucleo/.test(q.colonne) ? { data: null, error: { code: '42703', message: 'column persone.nucleo does not exist' } } : { data: righe, error: null }
        }),
      rpc: async () => ({ data: [], error: null }),
    })
    return { db, chiesto }
  }
  const con = elenco([riga('t', null), riga('f1', 't'), riga('f2', 't'), riga('l')])
  const lette = await con.db.persone()
  ok('chi è nel nucleo ha il titolare; il titolare e chi non ne ha, nessuno', lette.map((p) => [p.id, p.nucleo ?? null]), [['t', null], ['f1', 't'], ['f2', 't'], ['l', null]])
  ok('la colonna si chiede al database', con.chiesto.some((c) => /nucleo/.test(c)), true)

  const senza = elenco([riga('t'), riga('f1')], { colonna: false })
  const dopo = await errore(async () => {
    const x = await senza.db.persone()
    if (x.length !== 2) throw new Error(`le persone sono ${x.length}`)
    if (x.some((p) => p.nucleo)) throw new Error('un nucleo che non c\'è')
  })
  ok('senza la colonna l\'elenco si legge lo stesso, senza nuclei', dopo, 'nessun errore')
  ok('e i tasti dicono «va lanciato 99-nucleo.sql»', /va lanciato 99-nucleo\.sql/i.test(await errore(() => senzaTabelle({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.rendi_titolare(persona) in the schema cache' } }, []).rendiTitolare('t'))), true)
}

console.log('\n13. col database: la richiesta per il nucleo parte col nucleo (sezione 9)')
{
  const chiamate = []
  const db = m.creaRichiesteSupabase({ rpc: async (nome, args) => (chiamate.push([nome, args]), { data: 'id-richiesta', error: null }) })
  await db.invia({ nome: 'Tina', cognome: 'Nuova', nucleoDi: 'titolare-1' })
  ok('invia_iscrizione porta il titolare', chiamate[0][1].dati.nucleo_di, 'titolare-1')
  chiamate.length = 0
  await db.invia({ nome: 'Pino', cognome: 'Solo' })
  ok('senza nucleo, nessun titolare', chiamate[0][1].dati.nucleo_di ?? null, null)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
