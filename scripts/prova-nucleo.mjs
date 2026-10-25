// ---------------------------------------------------------------------------
// Il nucleo familiare dal lato della segreteria, senza browser.
//
//   node scripts/prova-nucleo.mjs
//
// Il nucleo (`persone.nucleo`: il titolare di una persona) passa dalla
// modalità prova al database vero (`100-nucleo.sql`, provato da
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
//   · senza il file SQL la scheda non si rompe;
//   · il genitore non iscritto (`113-genitore-non-iscritto.sql`, provato da
//     `supabase/prova/genitore-non-iscritto.sql`): le sezioni 14-17.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export { creaRichiesteProva } from './src/lib/richiesteProva'; export { creaRichiesteSupabase } from './src/lib/richiesteSupabase'; export { creaIscrittoProva } from './src/lib/iscrittoProva'; export { archivio } from './src/lib/archivioProva'; export { cosaNonVaNucleo, nuovoTitolare, doveVaLoSconto } from './src/lib/nucleo'; export * as nucleo from './src/lib/nucleo'; export { contiChip } from './src/lib/filtriIscritti'; export { leggiFogli, importa } from './src/lib/importa'; export { carattereControllo, lettereCognome, lettereNome } from './src/lib/codiceFiscale'",
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
// Il genitore non iscritto e il nucleo di soli adulti. Una funzione che ancora
// non c'è non ferma la prova: la rende rossa dicendolo.
const GENITORE_SENZA_CF = 'Per aggiungere il genitore serve il suo codice fiscale'
const GENITORE_GIA_IN_ELENCO = 'C’è già una persona con questo codice fiscale: mettilo nel suo nucleo'
const GENITORE_SENZA_NOME = 'Scrivi nome e cognome del genitore'
const CF = 'RSSMRA70A01H501X'
const lib = (nome, ...args) => (typeof m.nucleo[nome] === 'function' ? m.nucleo[nome](...args) : `manca ${nome}`)

console.log('\n14. le regole di nucleo.ts per il genitore (propostaGenitore, fratelliDi, maggiorenneDal)')
{
  const x = (id, extra = {}) => ({ id, attiva: true, ...extra })
  const OGGI_ISO = '2026-10-25'
  const dati = (o) => new Map(Object.entries(o))
  const gen = { genitoreNome: 'Mario', genitoreCognome: 'Rossi', genitoreCodiceFiscale: CF }
  const persone = [
    x('f', { natoIl: '2015-03-01' }),
    x('adulto', { natoIl: '1990-01-01' }),
    x('senzaData'),
    x('dentro', { natoIl: '2014-01-01', nucleo: 't' }),
    x('t', { natoIl: '1980-01-01' }),
    x('titolare', { natoIl: '1980-01-01' }),
    x('figlio', { natoIl: '2012-01-01', nucleo: 'titolare' }),
  ]
  const prop = (id, d, ps = persone) => lib('propostaGenitore', ps, id, dati(d), OGGI_ISO)
  ok('un minorenne col genitore e il suo codice: «nuovo», col codice pulito', prop('f', { f: gen }), { tipo: 'nuovo', nome: 'Mario', cognome: 'Rossi', codiceFiscale: CF })
  const pulito = prop('f', { f: { ...gen, genitoreCodiceFiscale: ' rssmra70a01 h501x ' } })
  ok('il codice con spazi e minuscole si pulisce', pulito?.codiceFiscale ?? pulito, CF)
  ok('un adulto: nessuna proposta', prop('adulto', { adulto: gen }), null)
  ok('senza data di nascita: nessuna proposta', prop('senzaData', { senzaData: gen }), null)
  ok('chi è già in un nucleo: nessuna proposta', prop('dentro', { dentro: gen }), null)
  ok('chi ha gente nel suo nucleo: nessuna proposta', prop('titolare', { titolare: gen }), null)
  ok('il codice del genitore manca: «manca-cf»', prop('f', { f: { genitoreNome: 'Mario', genitoreCognome: 'Rossi' } }), { tipo: 'manca-cf' })
  ok('senza nessun dato: «manca-cf»', prop('f', {}), { tipo: 'manca-cf' })
  ok('quindici caratteri: «manca-cf», sbagliato', prop('f', { f: { ...gen, genitoreCodiceFiscale: 'RSSMRA70A01H501' } }), { tipo: 'manca-cf', sbagliato: true })
  ok('con un segno che non è lettera né cifra: «manca-cf», sbagliato', prop('f', { f: { ...gen, genitoreCodiceFiscale: 'RSSMRA70A01H50-X' } }), { tipo: 'manca-cf', sbagliato: true })
  ok('solo spazi: manca, non è sbagliato', prop('f', { f: { ...gen, genitoreCodiceFiscale: '   ' } }), { tipo: 'manca-cf' })
  const altre = [...persone, x('mamma', { natoIl: '1975-01-01' }), x('padre', { natoIl: '1970-01-01', genitoreNonIscritto: true })]
  ok('un\'altra persona ha quel codice: «iscritto», col suo id', prop('f', { f: gen, mamma: { codiceFiscale: CF.toLowerCase() } }, altre), { tipo: 'iscritto', titolare: 'mamma' })
  ok('lo ha un genitore non iscritto: «gia-in-elenco»', prop('f', { f: gen, padre: { codiceFiscale: ` ${CF.slice(0, 8)} ${CF.slice(8)} ` } }, altre), { tipo: 'gia-in-elenco', titolare: 'padre' })
  const se = prop('f', { f: { ...gen, codiceFiscale: CF } })
  // Come `aggiungi_genitore`, che lo rifiuta: un figlio non è mai il suo genitore.
  ok('il codice è della persona stessa: è sbagliato', se, { tipo: 'manca-cf', sbagliato: true })

  // I fratelli: stesso genitore, già nel nucleo di qualcuno.
  const f2 = [
    x('f', { natoIl: '2015-03-01' }),
    x('gp', { natoIl: '1975-01-01', genitoreNonIscritto: true }),
    x('fr1', { natoIl: '2012-01-01', nucleo: 'gp' }),
    x('fr2', { natoIl: '2010-01-01', nucleo: 'gp' }),
    x('altroCodice', { natoIl: '2011-01-01', nucleo: 'gp' }),
    x('senzaNucleo', { natoIl: '2013-01-01' }),
    x('spenta', { natoIl: '2009-01-01', nucleo: 'gp', attiva: false }),
    x('vuoto', { natoIl: '2009-01-01', nucleo: 'gp' }),
  ]
  const d2 = { f: { genitoreCodiceFiscale: CF }, fr1: { genitoreCodiceFiscale: CF.toLowerCase() }, fr2: { genitoreCodiceFiscale: ` ${CF} ` }, altroCodice: { genitoreCodiceFiscale: 'BNCLRA80A41H501Z' }, senzaNucleo: { genitoreCodiceFiscale: CF }, spenta: { genitoreCodiceFiscale: CF }, vuoto: {} }
  ok('i fratelli: stesso codice, nel nucleo di qualcuno, attivi', lib('fratelliDi', f2, 'f', dati(d2)), [{ personaId: 'fr1', titolare: 'gp' }, { personaId: 'fr2', titolare: 'gp' }])
  ok('senza il codice di lei, nessun fratello', lib('fratelliDi', f2, 'f', dati({ ...d2, f: {} })), [])
  ok('chi è già nel nucleo dove sta lei non si propone', lib('fratelliDi', f2.map((p) => (p.id === 'f' ? { ...p, nucleo: 'gp' } : p)), 'f', dati(d2)), [])
  const fr = lib('fratelliDi', f2, 'fr1', dati(d2))
  ok('non lei stessa', Array.isArray(fr) ? fr.some((r) => r.personaId === 'fr1') : fr, false)
  // La richiesta di un fratello, prima di accoglierla: non è ancora una persona, conta il codice del genitore.
  ok('una richiesta col codice del genitore trova i fratelli', lib('fratelliPerGenitore', f2, ` ${CF.toLowerCase()}`, dati(d2)), [{ personaId: 'fr1', titolare: 'gp' }, { personaId: 'fr2', titolare: 'gp' }])
  // Quelli da proporre nella scheda: uno per nucleo, non quello già proposto come genitore.
  const proponi = (proposta, ps = f2) => lib('fratelliDaProporre', ps, 'f', dati(d2), proposta)
  ok('due fratelli nello stesso nucleo: uno solo da proporre', proponi({ tipo: 'nuovo' }), [{ personaId: 'fr1', titolare: 'gp' }])
  ok('il loro titolare è già la proposta del genitore: nessuno', proponi({ tipo: 'gia-in-elenco', titolare: 'gp' }), [])
  ok('la proposta è un altro titolare: restano', proponi({ tipo: 'iscritto', titolare: 'altro' }), [{ personaId: 'fr1', titolare: 'gp' }])
  ok('un nucleo dove non può entrare: non si propone', proponi(null, f2.map((p) => (p.id === 'f' ? { ...p, attiva: false } : p))), [])
  ok('una richiesta senza codice del genitore: nessuno', lib('fratelliPerGenitore', f2, '', dati(d2)), [])

  // Maggiorenne dal: il giorno dei diciotto anni, solo nel nucleo di un genitore non iscritto.
  const nuc = (nonIscritto, natoIl) => [x('gp', { natoIl: '1975-01-01', ...(nonIscritto && { genitoreNonIscritto: true }) }), x('f', { natoIl, nucleo: 'gp' })]
  const dal = (ps, id = 'f') => lib('maggiorenneDal', ps, id, OGGI_ISO)
  ok('nato il 3 marzo 2008: maggiorenne dal 3 marzo 2026', dal(nuc(true, '2008-03-03')), '2026-03-03')
  ok('diciotto anni oggi: dal giorno di oggi', dal(nuc(true, '2008-10-25')), '2026-10-25')
  ok('diciotto anni domani: ancora minorenne', dal(nuc(true, '2008-10-26')), null)
  ok('nato il 29 febbraio 2008: maggiorenne dal 1 marzo 2026, che non è bisestile', dal(nuc(true, '2008-02-29')), '2026-03-01')
  ok('nato il 29 febbraio, diciotto anni in un anno bisestile: il 29', lib('maggiorenneDal', nuc(true, '2010-02-29'), 'f', '2028-03-01'), '2028-02-29')
  ok('senza data di nascita: nessuna data', dal(nuc(true, undefined)), null)
  ok('il titolare è un iscritto vero: nessuna data', dal(nuc(false, '2008-03-03')), null)
  ok('chi non è nel nucleo di nessuno: nessuna data', dal([x('f', { natoIl: '2008-03-03' })]), null)

  // Due sorelle adulte: già va, e lo sconto famiglia va sull'annuale che costa meno.
  const sconto = m.doveVaLoSconto([{ chi: 'Anna', corso: 'Judo', importo: 34000 }], [{ chi: 'Bea', corso: 'Judo', importo: 28000 }])
  ok('due adulte: lo sconto famiglia va sull\'annuale che costa meno (Bea)', sconto?.chi, 'Bea')
  ok('Bea (29) entra nel nucleo di Anna (34)', m.cosaNonVaNucleo([x('anna', { natoIl: nato(34) }), x('bea', { natoIl: nato(29) })], 'bea', 'anna'), null)
}

console.log('\n15. la segreteria aggiunge il genitore non iscritto (sezione 14 del file SQL)')
{
  await crea('figlia', 'Lia', 'Genitori', nato(12))
  await crea('figlio2', 'Gigi', 'Genitori', nato(9))
  await crea('altra', 'Altra', 'Persona', nato(40))
  await s.salvaAnagrafica(P.altra, { codiceFiscale: 'BNCLRA80A41H501Z' })
  await crea('spenta', 'Spenta', 'Genitori', nato(10))
  await s.attivaPersona(P.spenta, false)
  await crea('conNucleo', 'Con', 'Nucleo', nato(11))
  await s.mettiNelNucleo(P.conNucleo, P.altra)
  const aggiungi = (figlio, g) => (typeof s.aggiungiGenitore === 'function' ? s.aggiungiGenitore(P[figlio], g) : Promise.reject(new Error('manca aggiungiGenitore')))
  const mario = { nome: 'Mario', cognome: 'Rossi', codiceFiscale: ' rssmra70a01 h501x ' }
  const quante = () => a.persone.length
  const prima = quante()
  const id = await aggiungi('figlia', mario).catch((e) => e.message)
  ok('aggiungere il genitore dà l\'id della persona nuova', [typeof id, quante()], ['string', prima + 1])
  const nuovo = a.persone.find((p) => p.id === id)
  ok('è un iscritto attivo, «genitore non iscritto», col nome dato', nuovo && [nuovo.ruolo, nuovo.attiva, nuovo.genitoreNonIscritto, nuovo.nome, nuovo.cognome], ['iscritto', true, true, 'Mario', 'Rossi'])
  ok('il suo codice fiscale è nell\'anagrafica, pulito', (await s.anagraficaDi(id).catch(() => null))?.dati.codiceFiscale, CF)
  ok('la figlia entra nel suo nucleo', nucleoDi(P.figlia), id)
  const nellElenco = (await s.persone()).find((p) => p.id === id)
  ok('l\'elenco lo dà col segno, e senza nucleo suo', [nellElenco?.genitoreNonIscritto, nellElenco?.nucleo ?? null], [true, null])

  await s.salvaAnagrafica(P.figlio2, { codiceFiscale: 'GNRGGI17A01H501K' })
  const imp = impronta()
  const n = quante()
  ok('senza il nome: va scritto', await errore(() => aggiungi('figlio2', { ...mario, nome: '  ', codiceFiscale: 'VRDLGU80A01H501Y' })), GENITORE_SENZA_NOME)
  ok('senza il cognome: va scritto', await errore(() => aggiungi('figlio2', { ...mario, cognome: '', codiceFiscale: 'VRDLGU80A01H501Y' })), GENITORE_SENZA_NOME)
  ok('il codice del figlio stesso: già in elenco, non è il suo genitore', await errore(() => aggiungi('figlio2', { ...mario, codiceFiscale: 'gnrggi17a01h501k' })), GENITORE_GIA_IN_ELENCO)
  ok('un codice fiscale non valido: serve il codice', await errore(() => aggiungi('figlio2', { ...mario, codiceFiscale: 'RSSMRA70A01H501' })), GENITORE_SENZA_CF)
  ok('un codice fiscale vuoto: serve il codice', await errore(() => aggiungi('figlio2', { ...mario, codiceFiscale: '' })), GENITORE_SENZA_CF)
  ok('il codice di un\'altra persona (anche in minuscolo): già in elenco', await errore(() => aggiungi('figlio2', { ...mario, codiceFiscale: 'bncl ra80a41h501z' })), GENITORE_GIA_IN_ELENCO)
  ok('il codice del genitore appena aggiunto: già in elenco', await errore(() => aggiungi('figlio2', mario)), GENITORE_GIA_IN_ELENCO)
  ok('un figlio già in un nucleo: il messaggio di sempre', await errore(() => aggiungi('conNucleo', { ...mario, codiceFiscale: 'VRDLGU80A01H501Y' })), DI_UN_ALTRO)
  ok('un figlio disattivato: il messaggio di sempre', await errore(() => aggiungi('spenta', { ...mario, codiceFiscale: 'VRDLGU80A01H501Y' })), DISATTIVATA)
  ok('un rifiuto non lascia una persona nuova, né cambia nuclei', [quante(), impronta()], [n, imp])

  // Il genitore si iscrive: diventa un iscritto come gli altri, titolare, coi figli.
  await s.iscrivi(id, 'lotta-2')
  const dopo = (await s.persone()).find((p) => p.id === id)
  ok('iscritto a un corso: il segno si toglie', dopo?.genitoreNonIscritto ?? false, false)
  ok('resta titolare, la figlia resta', nucleoDi(P.figlia), id)

  // Il modulo accolto conta come la scheda: il codice di una richiesta accolta, anche se la scheda ora ne dice un altro.
  const r = m.creaRichiesteProva()
  const pezzo = `${m.lettereCognome('Moduli')}${m.lettereNome('Ada')}80A41L219`
  const cfAda = pezzo + m.carattereControllo(pezzo)
  const modulo = { nome: 'Ada', cognome: 'Moduli', natoIl: '1980-01-01', natoA: 'Torino', codiceFiscale: cfAda, indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno', email: 'ada@esempio.it', telefono: '347 111 2233', corsi: ['judo-adulti'], formula: 'annuale', regolamento: true }
  const ada = await r.accogli(await r.invia(modulo))
  await s.salvaAnagrafica(ada, { codiceFiscale: 'VRDLGU80A01H501Y' })
  ok('il codice del modulo accolto: già in elenco', await errore(() => aggiungi('figlio2', { ...mario, codiceFiscale: cfAda })), GENITORE_GIA_IN_ELENCO)

  // Una richiesta accolta sulla scheda del genitore lo iscrive: perde il segno, come col trigger.
  const pezzoP = `${m.lettereCognome('Genitori')}${m.lettereNome('Pietro')}80A01L219`
  const cfPietro = pezzoP + m.carattereControllo(pezzoP)
  const pietro = await aggiungi('figlio2', { nome: 'Pietro', cognome: 'Genitori', codiceFiscale: cfPietro })
  const suo = { ...modulo, nome: 'Pietro', cognome: 'Genitori', codiceFiscale: cfPietro, email: 'pietro@esempio.it' }
  await r.accogli(await r.invia(suo), pietro)
  ok('accolta la sua richiesta: il segno si toglie', (await s.persone()).find((p) => p.id === pietro)?.genitoreNonIscritto ?? false, false)

  // genitori(): anche il codice del genitore e quello della persona.
  await s.salvaAnagrafica(P.ugo, { genitoreNome: 'Luigi', genitoreCognome: 'Neri', genitoreCodiceFiscale: 'NRELGU70A01H501Q', codiceFiscale: 'NRIGUO10A01H501Z' })
  ok('genitori() dà anche i codici fiscali', (await s.genitori()).get(P.ugo), { genitoreNome: 'Luigi', genitoreCognome: 'Neri', genitoreCodiceFiscale: 'NRELGU70A01H501Q', codiceFiscale: 'NRIGUO10A01H501Z' })

  // Due adulte nello stesso nucleo (guardia: già va).
  await crea('anna', 'Anna', 'Sorelle', nato(34))
  await crea('bea', 'Bea', 'Sorelle', nato(29))
  ok('due sorelle adulte: Bea entra nel nucleo di Anna', await metti('bea', 'anna'), 'nessun errore')
  ok('il nucleo è di Anna', nucleoDi(P.bea), P.anna)
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

console.log('\n11. col database: le tre funzioni (100-nucleo.sql)')
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
    ok(`senza il file SQL (${code}): «va lanciato 100-nucleo.sql», non il testo dell'API`, [/va lanciato 100-nucleo\.sql/i.test(detto), /schema cache|does not exist|function public/i.test(detto)], [true, false])
  }
  ok('lo stesso per togliere e per cambiare titolare', [
    /va lanciato 100-nucleo\.sql/i.test(await errore(() => no(chiave.PGRST202.replace('metti_nel_nucleo', 'togli_dal_nucleo'), 'PGRST202').togliDalNucleo('p1'))),
    /va lanciato 100-nucleo\.sql/i.test(await errore(() => no(chiave.PGRST202.replace('metti_nel_nucleo', 'rendi_titolare'), 'PGRST202').rendiTitolare('p1'))),
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
  ok('e i tasti dicono «va lanciato 100-nucleo.sql»', /va lanciato 100-nucleo\.sql/i.test(await errore(() => senzaTabelle({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.rendi_titolare(persona) in the schema cache' } }, []).rendiTitolare('t'))), true)
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

console.log('\n16. col database: aggiungi_genitore (113-genitore-non-iscritto.sql)')
{
  const chiamate = []
  const db = senzaTabelle({ data: 'uuid-nuovo', error: null }, chiamate)
  const g = { nome: 'Mario', cognome: 'Rossi', codiceFiscale: CF }
  const r = await (typeof db.aggiungiGenitore === 'function' ? db.aggiungiGenitore('f1', g) : Promise.resolve('manca aggiungiGenitore')).catch((e) => e.message)
  ok('chiama aggiungi_genitore con figlio, nome, cognome, codice_fiscale, e rende l\'uuid', [r, chiamate], ['uuid-nuovo', [['aggiungi_genitore', { figlio: 'f1', nome: 'Mario', cognome: 'Rossi', codice_fiscale: CF }]]])
  const no = (message, code = 'P0001') => senzaTabelle({ data: null, error: { code, message } }, [])
  const prova = (database) => errore(() => (typeof database.aggiungiGenitore === 'function' ? database.aggiungiGenitore('f1', g) : Promise.reject(new Error('manca aggiungiGenitore'))))
  ok('un rifiuto arriva com\'è: serve il codice', await prova(no(GENITORE_SENZA_CF)), GENITORE_SENZA_CF)
  ok('un rifiuto arriva com\'è: già in elenco', await prova(no(GENITORE_GIA_IN_ELENCO)), GENITORE_GIA_IN_ELENCO)
  ok('un rifiuto arriva com\'è: figlio già in un nucleo', await prova(no(DI_UN_ALTRO)), DI_UN_ALTRO)
  for (const [code, message] of [['PGRST202', 'Could not find the function public.aggiungi_genitore(figlio, nome) in the schema cache'], ['42883', 'function public.aggiungi_genitore(uuid, text) does not exist']]) {
    const detto = await prova(no(message, code))
    ok(`senza il file SQL (${code}): «va lanciato 113-genitore-non-iscritto.sql», non il testo dell'API`, [/va lanciato 113-genitore-non-iscritto\.sql/i.test(detto), /schema cache|does not exist|function public/i.test(detto)], [true, false])
  }
}

console.log('\n17. col database: l\'elenco legge il segno, e senza la colonna non si rompe')
{
  const catena = (risposta) => {
    const q = { colonne: '' }
    const c = new Proxy(function () {}, {
      get: (_, p) => (p === 'range' ? (da) => (da ? oltre : c) : p === 'then' ? (bene, male) => Promise.resolve(risposta(q)).then(bene, male) : (...x) => (p === 'select' && (q.colonne = String(x[0])), c)),
      apply: () => c,
    })
    return c
  }
  const riga = (id, extra = {}) => ({ id, nome: id, cognome: 'Prova', email: null, telefono: null, attiva: true, creata_il: '2026-01-01T10:00:00Z', iscrizioni: [], nucleo: null, ...extra })
  const elenco = (righe, { colonna = true } = {}) => {
    const chiesto = []
    const db = m.creaSegreteriaSupabase({
      from: (t) =>
        catena((q) => {
          if (t !== 'persone') return { data: [], error: null }
          chiesto.push(q.colonne)
          return !colonna && /genitore_non_iscritto/.test(q.colonne) ? { data: null, error: { code: '42703', message: 'column persone.genitore_non_iscritto does not exist' } } : { data: righe, error: null }
        }),
      rpc: async () => ({ data: [], error: null }),
    })
    return { db, chiesto }
  }
  const con = elenco([riga('g', { genitore_non_iscritto: true }), riga('f', { nucleo: 'g' }), riga('l', { genitore_non_iscritto: false })])
  const lette = await con.db.persone()
  ok('chi è genitore non iscritto ha il segno; gli altri no', lette.map((p) => [p.id, p.genitoreNonIscritto ?? false]), [['g', true], ['f', false], ['l', false]])
  ok('la colonna si chiede al database', con.chiesto.some((c) => /genitore_non_iscritto/.test(c)), true)

  const senza = elenco([riga('g'), riga('f', { nucleo: 'g' })], { colonna: false })
  const x = await senza.db.persone().catch((e) => e.message)
  ok('senza la colonna l\'elenco si legge lo stesso, senza il segno', Array.isArray(x) ? [x.length, x.some((p) => p.genitoreNonIscritto), x.find((p) => p.id === 'f')?.nucleo] : x, [2, false, 'g'])
  ok('ma la colonna si era chiesta (e il nucleo si legge ancora)', senza.chiesto.some((c) => /genitore_non_iscritto/.test(c)), true)
}

console.log('\n15. il nucleo per lo sconto della ricevuta (nucleoPerRicevuta)')
{
  const t = { id: 'papa', attiva: true }
  const f1 = { id: 'sara', nucleo: 'papa', attiva: true }
  const f2 = { id: 'leo', nucleo: 'papa', attiva: true }
  const via = { id: 'ugo', nucleo: 'papa', attiva: false }
  const solo = { id: 'zeno', attiva: true }
  const tutti = [t, f1, f2, via, solo]
  const ids = (p) => m.nucleo.nucleoPerRicevuta(p, tutti).map((x) => x.id)
  ok('per la figlia: il titolare e il fratello, non lei', ids(f1), ['papa', 'leo'])
  ok('per il titolare: i figli attivi', ids(t), ['sara', 'leo'])
  ok('chi ha lasciato la palestra non conta', ids(f2).includes('ugo'), false)
  ok('chi non ha nucleo: nessuno', ids(solo), [])
  ok('un titolare che non c\'è più: nessuno', m.nucleo.nucleoPerRicevuta({ id: 'x', nucleo: 'manca', attiva: true }, tutti), [])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
