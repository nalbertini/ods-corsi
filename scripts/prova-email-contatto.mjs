// ---------------------------------------------------------------------------
// L'email di contatto, senza browser.
//
//   node scripts/prova-email-contatto.mjs
//
// `email` resta l'email di accesso, una per persona; `emailContatto` è dove
// scrivere a chi è iscritto, facoltativa e uguale per i parenti. La modalità
// prova deve dare gli stessi esiti del database (`44-email-contatto.sql`,
// provato da `supabase/prova/email-contatto.sql`, `iscrizioni.sql` e
// `unisci-doppioni.sql`): l'email doppia si rifiuta dicendo di chi è, il
// contatto no; l'import e il modulo online mettono nel contatto l'indirizzo che
// non si può tenere come email; unendo due schede non si perde niente di
// nascosto. In più, le funzioni di `src/lib` che la schermata chiama.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaRichiesteProva } from './src/lib/richiesteProva'; export { creaDatiProva } from './src/lib/datiProva'; export { archivio } from './src/lib/archivioProva'; export { seminaEsempi } from './src/lib/esempiProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export { carattereControllo, lettereCognome, lettereNome } from './src/lib/codiceFiscale'; export * as doppioni from './src/lib/doppioni'; export * as segreteriaLib from './src/lib/segreteria'; export * as importaLib from './src/lib/importa'",
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
globalThis.window = { location: { search: '', hash: '', pathname: '/' }, addEventListener() {} }

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
m.creaDatiProva()
const s = m.creaSegreteriaProva()
const r = m.creaRichiesteProva()
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
// Una funzione di `src/lib` che ancora non c'è non ferma la prova: la rende rossa dicendolo.
const lib = (modulo, nome) => (typeof modulo[nome] === 'function' ? modulo[nome] : () => `manca ${nome}`)
const stessoContatto = lib(m.doppioni, 'stessoContatto')
const indirizziPersi = lib(m.doppioni, 'indirizziPersi')
const cercaNellElenco = lib(m.segreteriaLib, 'cercaNellElenco')
const senzaEmail = lib(m.segreteriaLib, 'senzaEmail')
const campoDelGuaio = lib(m.segreteriaLib, 'campoDelGuaio')
const emailGiaDi = lib(m.segreteriaLib, 'emailGiaDi')
const contattoDopoUnione = lib(m.doppioni, 'contattoDopoUnione')
const testoResoconto = lib(m.importaLib, 'testoResoconto')
const fraseResoconto = lib(m.importaLib, 'fraseResoconto')

// Gli esempi della modalità prova, prima che le altre sezioni aggiungano persone loro.
m.seminaEsempi()
const diEsempio = await s.persone()
const persone = async () => s.persone()
const di = async (id) => (await persone()).find((p) => p.id === id)
const unico = (() => { let n = 0; return () => `${++n}` })()

console.log('\n1. l\'email di accesso resta di una persona sola, e dice di chi è')
{
  await s.salvaPersona({ nome: 'Paola', cognome: 'Bianchi', email: 'mamma@esempio.it' })
  ok('un\'altra persona con la stessa email: no, e dice di chi è e cosa fare',
    await errore(() => s.salvaPersona({ nome: 'Marco', cognome: 'Bianchi', email: 'Mamma@esempio.it' })),
    'Questo indirizzo è già di Paola Bianchi: mettilo come email di contatto.')
  const luca = await s.salvaPersona({ nome: 'Luca', cognome: 'Bianchi' })
  ok('nemmeno cambiandola a chi c\'è', await errore(() => s.salvaPersona({ id: luca, nome: 'Luca', cognome: 'Bianchi', email: 'mamma@esempio.it' })),
    'Questo indirizzo è già di Paola Bianchi: mettilo come email di contatto.')
  ok('Marco non è stato creato', (await persone()).some((p) => p.nome === 'Marco' && p.cognome === 'Bianchi'), false)
}

console.log('\n2. il contatto no: più persone, anche con l\'indirizzo che è l\'email di un\'altra')
{
  const luca = (await persone()).find((p) => p.nome === 'Luca' && p.cognome === 'Bianchi')
  ok('Luca col contatto della mamma', await errore(() => s.salvaPersona({ id: luca.id, nome: 'Luca', cognome: 'Bianchi', emailContatto: 'mamma@esempio.it' })), 'nessun errore')
  ok('Sara, lo stesso contatto scritto in maiuscolo', await errore(() => s.salvaPersona({ nome: 'Sara', cognome: 'Bianchi', emailContatto: 'MAMMA@esempio.it' })), 'nessun errore')
  const bianchi = (await persone()).filter((p) => p.cognome === 'Bianchi' && ['Paola', 'Luca', 'Sara'].includes(p.nome))
  ok('Paola ha l\'email, i figli il contatto', bianchi.map((p) => [p.nome, p.email ?? null, p.emailContatto ?? null]).sort(),
    [['Luca', null, 'mamma@esempio.it'], ['Paola', 'mamma@esempio.it', null], ['Sara', null, 'MAMMA@esempio.it']])
  ok('il contatto si toglie con una scritta vuota', await errore(() => s.salvaPersona({ id: luca.id, nome: 'Luca', cognome: 'Bianchi', emailContatto: '  ' })), 'nessun errore')
  ok('e non resta una stringa vuota', (await di(luca.id)).emailContatto, undefined)
  await s.salvaPersona({ id: luca.id, nome: 'Luca', cognome: 'Bianchi', emailContatto: ' mamma@esempio.it ' })
  ok('gli spazi attorno non contano', (await di(luca.id)).emailContatto, 'mamma@esempio.it')
}

console.log('\n3. la forma del contatto è quella dell\'email, al massimo 160 lettere')
{
  const prova = async (emailContatto) => errore(() => s.salvaPersona({ nome: 'Forma', cognome: `Prova${unico()}`, emailContatto }))
  for (const sbagliata of ['mamma.esempio.it', 'mamma@esempio', 'la mamma@esempio.it', '@esempio.it']) {
    const messaggio = await prova(sbagliata)
    ok(`«${sbagliata}» no, con un messaggio per chi usa l'app`, [/contatto/i.test(messaggio), /check|constraint|violates|regex|persone_/i.test(messaggio)], [true, false])
  }
  ok('centosessanta lettere sì', await prova('a'.repeat(149) + '@esempio.it'), 'nessun errore')
  ok('centosessantuno no', /contatto/i.test(await prova('a'.repeat(150) + '@esempio.it')), true)
  ok('e non è entrata', (await persone()).some((p) => p.emailContatto === 'mamma.esempio.it'), false)
}

console.log('\n4. il database vero: cosa scrive, cosa legge, cosa dice')
{
  // Un database finto: chi scrive riceve l'errore dell'email già usata, chi legge la riga di Paola.
  const paola = { id: 'p-1', nome: 'Paola', cognome: 'Bianchi', email: 'mamma@esempio.it', ruolo: 'iscritto' }
  const finto = ({ sulleScritture, lettura, scritte = [], lette = [] }) => {
    const catena = (tabella, passi = []) =>
      new Proxy(() => {}, {
        get: (_, k) => {
          if (k === 'then')
            return (fatto, rifiuta) => {
              const scrive = passi.some(([n]) => ['insert', 'update', 'upsert'].includes(n))
              if (tabella !== 'persone' && !scrive) return Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'non c\'è' } }).then(fatto, rifiuta)
              if (scrive) return Promise.resolve(sulleScritture(passi)).then(fatto, rifiuta)
              lette.push(passi.find(([n]) => n === 'select')?.[1]?.[0] ?? '')
              return Promise.resolve(lettura(passi)).then(fatto, rifiuta)
            }
          return (...a) => {
            if (['insert', 'update'].includes(k)) scritte.push(a[0])
            return catena(tabella, [...passi, [k, a]])
          }
        },
      })
    return { client: { from: (t) => catena(t), rpc: () => catena('rpc') }, scritte, lette }
  }
  const doppia = { code: '23505', message: 'duplicate key value violates unique constraint "persone_email_unica"' }
  // Una riga che vale come oggetto e come primo di un elenco, qualunque query si faccia per ritrovare di chi è l'email.
  const comeElenco = (riga) => Object.assign([riga], riga)

  const a = finto({ sulleScritture: () => ({ data: null, error: doppia }), lettura: () => ({ data: comeElenco(paola), error: null }) })
  ok('l\'email già di un altro: dice di chi è, non il testo del database',
    await errore(() => m.creaSegreteriaSupabase(a.client).salvaPersona({ nome: 'Marco', cognome: 'Bianchi', email: 'mamma@esempio.it' })),
    'Questo indirizzo è già di Paola Bianchi: mettilo come email di contatto.')

  const b = finto({ sulleScritture: () => ({ data: { id: 'nuovo' }, error: null }), lettura: () => ({ data: [], error: null }) })
  await m.creaSegreteriaSupabase(b.client).salvaPersona({ nome: 'Marco', cognome: 'Bianchi', emailContatto: ' mamma@esempio.it ' })
  ok('scrive il contatto nella colonna sua, e l\'email vuota', [b.scritte[0]?.email_contatto, b.scritte[0]?.email], ['mamma@esempio.it', null])
  await m.creaSegreteriaSupabase(b.client).salvaPersona({ nome: 'Marco', cognome: 'Bianchi' })
  ok('senza contatto scrive null, per toglierlo', b.scritte[1]?.email_contatto, null)

  const riga = { id: 'p-2', nome: 'Luca', cognome: 'Bianchi', email: null, email_contatto: 'mamma@esempio.it', telefono: null, attiva: true, creata_il: '2026-01-01T00:00:00Z', iscrizioni: [], schede_iscritti: null }
  const c = finto({ sulleScritture: () => ({ data: null, error: null }), lettura: () => ({ data: [riga], error: null }) })
  ok('l\'elenco porta il contatto', (await m.creaSegreteriaSupabase(c.client).persone()).map((p) => [p.nome, p.email ?? null, p.emailContatto ?? null]), [['Luca', null, 'mamma@esempio.it']])
  ok('e lo chiede', c.lette.some((x) => /email_contatto/.test(x)), true)

  // Un database dove 44-email-contatto.sql non è ancora passato: la colonna non c'è, l'elenco si vede lo stesso.
  const senza = finto({
    sulleScritture: () => ({ data: null, error: null }),
    lettura: (passi) => {
      const chiede = passi.find(([n]) => n === 'select')?.[1]?.[0] ?? ''
      return /email_contatto/.test(chiede)
        ? { data: null, error: { code: '42703', message: 'column persone.email_contatto does not exist' } }
        : { data: [{ ...riga, email_contatto: undefined, email: 'luca@esempio.it' }], error: null }
    },
  })
  ok('senza 44-email-contatto.sql l\'elenco si vede lo stesso', (await m.creaSegreteriaSupabase(senza.client).persone()).map((p) => [p.nome, p.email ?? null, p.emailContatto ?? null]), [['Luca', 'luca@esempio.it', null]])
}

console.log('\n5. l\'import: due fratelli con la stessa email')
{
  const nomiCorsi = async () => (await s.corsi()).map((c) => c.nome)
  const foglio = 'nome;cognome;email;telefono;corso\nGino;Fratelli;fratelli@esempio.it;333 111;Judo 2\nPina;Fratelli;Fratelli@esempio.it;333 111;Judo 2\n'
  const f = m.importaLib.leggiFogli(null, foglio, await nomiCorsi())
  ok('il primo con l\'email, il secondo senza e col contatto', f.iscritti.map((x) => [x.nome, x.email ?? null, x.emailContatto ?? null]), [['Gino', 'fratelli@esempio.it', null], ['Pina', null, 'fratelli@esempio.it']])
  ok('un avviso sulla riga del secondo, che parla del contatto', f.note.map((x) => [x.riga, /contatto/.test(x.motivo)]), [[3, true]])
  ok('e niente righe saltate', f.saltate.length, 0)
  const due = m.importaLib.leggiFogli(null, foglio + 'Pina;Fratelli;fratelli@esempio.it;333 111;Lotta 2\n', await nomiCorsi())
  ok('una persona su due righe (due corsi): una nota sola', [due.note.length, due.iscritti.find((x) => x.nome === 'Pina').corsi.length], [1, 2])
  const a = await m.importaLib.importa(s, f, () => {})
  ok('entrano tutti e due', [a.iscrittiNuovi, a.daSistemare.length], [2, 0])
  const fra = (await persone()).filter((p) => p.cognome === 'Fratelli').sort((x, y) => x.nome.localeCompare(y.nome))
  ok('Gino con l\'email, Pina col contatto', fra.map((p) => [p.nome, p.email ?? null, p.emailContatto ?? null]), [['Gino', 'fratelli@esempio.it', null], ['Pina', null, 'fratelli@esempio.it']])
  const a2 = await m.importaLib.importa(s, m.importaLib.leggiFogli(null, foglio, await nomiCorsi()), () => {})
  ok('rifatto: nessuno nuovo, nessun doppione', [a2.iscrittiNuovi, (await persone()).filter((p) => p.cognome === 'Fratelli').length], [0, 2])

  // Un altro foglio, dopo: l'email è già di Gino, il fratello nuovo entra col contatto.
  const dopo = m.importaLib.leggiFogli(null, 'nome;cognome;email;telefono;corso\nMario;Fratelli;FRATELLI@esempio.it;333;Judo 2\n', await nomiCorsi())
  const a3 = await m.importaLib.importa(s, dopo, () => {})
  ok('il fratello arrivato dopo entra, senza errore', [a3.iscrittiNuovi, a3.daSistemare.length], [1, 0])
  const mario = (await persone()).find((p) => p.nome === 'Mario' && p.cognome === 'Fratelli')
  ok('senza email e col contatto', [mario?.email ?? null, mario?.emailContatto ?? null], [null, 'fratelli@esempio.it'])
  const a4 = await m.importaLib.importa(s, m.importaLib.leggiFogli(null, 'nome;cognome;email;telefono;corso\nMario;Fratelli;FRATELLI@esempio.it;333;Judo 2\n', await nomiCorsi()), () => {})
  ok('rifatto: Mario non si duplica', [a4.iscrittiNuovi, (await persone()).filter((p) => p.nome === 'Mario' && p.cognome === 'Fratelli').length], [0, 1])

  // Le risposte del modulo Google: due figli, la stessa email della mamma.
  const csv = [
    '"Informazioni cronologiche","Indirizzo email","Nome dell\'atleta","Cognome dell\'atleta","Numero di telefono","A quali corsi vuoi iscriverti?"',
    '"20/09/2026 18.01.22","Mamma@Gialli.it","Lia","Gialli","347 000 1111","Judo 2"',
    '"20/09/2026 18.07.40","mamma@gialli.it","Tom","Gialli","347 000 1111","Judo 2"',
  ].join('\n')
  const t = m.importaLib.leggiTabella(csv)
  const col = m.importaLib.indovinaColonne(t.testa)
  const risp = m.importaLib.leggiRisposte(t, col, { 'Judo 2': 'judo-2' }, (await s.corsi()).map((c) => ({ id: c.id, nome: c.nome })))
  ok('dal modulo: la prima con l\'email, il secondo col contatto', risp.iscritti.map((x) => [x.nome, x.email ?? null, x.emailContatto ?? null]), [['Lia', 'mamma@gialli.it', null], ['Tom', null, 'mamma@gialli.it']])
  ok('con un avviso, che parla del contatto', risp.note.map((x) => /contatto/.test(x.motivo)), [true])
}

console.log('\n6. l\'import: l\'email di un istruttore o della segreteria non è più un blocco')
{
  const nomiCorsi = async () => (await s.corsi()).map((c) => c.nome)
  const situazione = async () => {
    const [sale, personale, corsi, ps] = await Promise.all([s.sale(), s.personale(), s.corsi(), s.persone()])
    return { sale, personale, corsi, persone: ps }
  }
  await s.salvaPersonale({ nome: 'Ilaria', cognome: 'Istruttrice', email: 'ilaria.istr@esempio.it', ruolo: 'istruttore' })
  const foglio = 'nome;cognome;email;telefono;corso\nUgo;Staffa;ILARIA.istr@esempio.it;333 222;Judo 2\nZeno;Libero;zeno.libero@esempio.it;;Judo 2\n'
  const f = m.importaLib.leggiFogli(null, foglio, await nomiCorsi())
  const controllo = m.importaLib.controllaRighe(f, await situazione())
  ok('tutte e due nuove, nessuna da sistemare', [controllo.righe.map((x) => [x.riga, x.esito]), controllo.totali.da_sistemare ?? 0], [[[2, 'nuova'], [3, 'nuova']], 0])
  ok('e la prima dice che l\'indirizzo va nel contatto', controllo.righe.map((x) => x.avvisi.some((v) => /contatto/.test(v))), [true, false])
  const a = await m.importaLib.importa(s, f, () => {})
  ok('importando entrano tutte e due, nessuna da sistemare', [a.iscrittiNuovi, a.daSistemare.length], [2, 0])
  const ugo = (await persone()).find((p) => p.nome === 'Ugo' && p.cognome === 'Staffa')
  ok('Ugo: email vuota, contatto quell\'indirizzo', [ugo?.email ?? null, ugo?.emailContatto ?? null], [null, 'ilaria.istr@esempio.it'])
  ok('Ilaria non cambia', (await s.personale()).filter((p) => p.cognome === 'Istruttrice').map((p) => [p.nome, p.email]), [['Ilaria', 'ilaria.istr@esempio.it']])
  ok('Zeno entra con la sua email, senza contatto', (await persone()).filter((p) => p.cognome === 'Libero').map((p) => [p.email ?? null, p.emailContatto ?? null]), [['zeno.libero@esempio.it', null]])
  const a2 = await m.importaLib.importa(s, m.importaLib.leggiFogli(null, foglio, await nomiCorsi()), () => {})
  ok('rifatto: Ugo non si duplica', [a2.iscrittiNuovi, a2.daSistemare.length, (await persone()).filter((p) => p.cognome === 'Staffa').length], [0, 0, 1])
  const dopo = m.importaLib.controllaRighe(m.importaLib.leggiFogli(null, foglio, await nomiCorsi()), await situazione())
  ok('e il controllo lo riconosce: già in palestra', dopo.righe.map((x) => x.esito), ['in_palestra', 'in_palestra'])
}

console.log('\n7. il modulo online: l\'email già di un\'altra persona va nel contatto')
{
  const cf = (cognome, nome) => {
    const corpo = m.lettereCognome(cognome) + m.lettereNome(nome) + '96A01L219'
    return corpo + m.carattereControllo(corpo)
  }
  const richiesta = (nome, cognome, email) => ({
    nome, cognome, natoIl: '1996-01-01', natoA: 'Torino', codiceFiscale: cf(cognome, nome), indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno',
    email, telefono: '347 555 0000', corsi: ['judo-adulti'], formula: 'annuale', regolamento: true,
  })
  await s.salvaPersona({ nome: 'Elena', cognome: 'Madre', email: 'madre@esempio.it' })
  await s.salvaPersonale({ nome: 'Carlo', cognome: 'Istruttore', email: 'carlo.istr@esempio.it', ruolo: 'istruttore' })
  const accogli = async (nome, cognome, email) => {
    const id = await r.accogli(await r.invia(richiesta(nome, cognome, email)))
    return di(id)
  }
  const figlio = await accogli('Fabio', 'Gialli', 'Madre@Esempio.it')
  ok('l\'email è già di un\'iscritta: nuova persona, email vuota, contatto quell\'indirizzo', [figlio.email ?? null, figlio.emailContatto ?? null], [null, 'madre@esempio.it'])
  const istr = await accogli('Gino', 'Gialli', 'carlo.istr@esempio.it')
  ok('già di un istruttore: lo stesso', [istr.email ?? null, istr.emailContatto ?? null], [null, 'carlo.istr@esempio.it'])
  ok('l\'istruttore non cambia', (await s.personale()).filter((p) => p.cognome === 'Istruttore').map((p) => [p.email, p.ruolo]), [['carlo.istr@esempio.it', 'istruttore']])
  // La scheda c'era già (stesso nome, senza email): l'indirizzo di un altro va nel suo contatto, se non ne ha uno.
  await s.salvaPersona({ nome: 'Ivo', cognome: 'Gialli' })
  await s.salvaPersona({ nome: 'Lia', cognome: 'Gialli', emailContatto: 'casa@esempio.it' })
  const ivo = await accogli('Ivo', 'Gialli', 'madre@esempio.it')
  ok('scheda già in elenco: l\'email di un altro va nel contatto, l\'email resta vuota', [ivo.email ?? null, ivo.emailContatto ?? null, (await persone()).filter((p) => p.nome === 'Ivo').length], [null, 'madre@esempio.it', 1])
  const lia = await accogli('Lia', 'Gialli', 'madre@esempio.it')
  ok('se aveva già un contatto, resta quello', [lia.email ?? null, lia.emailContatto ?? null], [null, 'casa@esempio.it'])
  // Una richiesta arrivata con le maiuscole (esempi, archivio vecchio): l'email si confronta in minuscolo, come il database.
  const maiuscola = await r.invia(richiesta('Nora', 'Gialli', 'x@esempio.it'))
  await s.salvaPersona({ nome: 'Dora', cognome: 'Madre', email: 'dora@esempio.it' })
  localStorage.setItem('ods-corsi:prova-richieste', JSON.stringify(JSON.parse(localStorage.getItem('ods-corsi:prova-richieste')).map((x) => (x.id === maiuscola ? { ...x, email: 'Dora@Esempio.it' } : x))))
  await r.richieste()
  const nora = await di(await r.accogli(maiuscola))
  ok('l\'email in maiuscolo è di Dora: Nora entra senza e col contatto, in minuscolo', [nora.email ?? null, nora.emailContatto?.toLowerCase() ?? null], [null, 'dora@esempio.it'])
  const libera = await accogli('Hugo', 'Gialli', 'hugo@esempio.it')
  ok('un\'email libera resta l\'email, senza contatto', [libera.email ?? null, libera.emailContatto ?? null], ['hugo@esempio.it', null])
}

console.log('\n8. unire due schede: email e contatto, e cosa non si può tenere')
{
  const scheda = async (id) => {
    const p = await di(id)
    return [p.email ?? null, p.emailContatto ?? null]
  }
  // Ogni caso: chi resta, chi se ne va, cosa deve restare, e cosa si perde (da dire prima).
  const casi = [
    ['a. due email diverse, nessun contatto: l\'altra diventa il contatto', { email: 'r1@esempio.it' }, { email: 'v1@esempio.it' }, ['r1@esempio.it', 'v1@esempio.it'], []],
    ['b. tutto pieno e diverso: resta quello di chi resta, e si dice cosa si perde',
      { email: 'r2@esempio.it', emailContatto: 'cr2@esempio.it' }, { email: 'v2@esempio.it', emailContatto: 'cv2@esempio.it' }, ['r2@esempio.it', 'cr2@esempio.it'], ['v2@esempio.it', 'cv2@esempio.it']],
    ['c. chi resta non ha niente: prende email e contatto', {}, { email: 'v3@esempio.it', emailContatto: 'cv3@esempio.it' }, ['v3@esempio.it', 'cv3@esempio.it'], []],
    ['d. un solo posto per il contatto: vince il contatto di chi se ne va, l\'email si perde',
      { email: 'r4@esempio.it' }, { email: 'v4@esempio.it', emailContatto: 'cv4@esempio.it' }, ['r4@esempio.it', 'cv4@esempio.it'], ['v4@esempio.it']],
    ['e. chi se ne va ha solo il contatto', { email: 'r5@esempio.it' }, { emailContatto: 'cv5@esempio.it' }, ['r5@esempio.it', 'cv5@esempio.it'], []],
    ['f. chi resta ha solo il contatto, chi se ne va solo l\'email', { emailContatto: 'cr6@esempio.it' }, { email: 'v6@esempio.it' }, ['v6@esempio.it', 'cr6@esempio.it'], []],
    ['g. l\'email di chi se ne va è già il contatto di chi resta: non si perde', { email: 'r7@esempio.it', emailContatto: 'V7@esempio.it' }, { email: 'v7@esempio.it' }, ['r7@esempio.it', 'V7@esempio.it'], []],
    ['h. lo stesso contatto scritto in maiuscolo: non si perde', { email: 'r8@esempio.it', emailContatto: 'cx@esempio.it' }, { emailContatto: 'CX@esempio.it' }, ['r8@esempio.it', 'cx@esempio.it'], []],
  ]
  for (const [cosa, dellaResta, diChiVa, voluto, persi] of casi) {
    // Stesso nome e cognome: due doppioni veri.
    const cognome = `Unione${unico()}`
    const resta = await s.salvaPersona({ nome: 'Ada', cognome, ...dellaResta })
    const via = await s.salvaPersona({ nome: 'Ada', cognome, ...diChiVa })
    const prima = await persone()
    ok(`${cosa}: gli indirizzi che non si possono tenere, detti prima`, indirizziPersi(prima.find((p) => p.id === resta), prima.find((p) => p.id === via)), persi)
    ok(`${cosa}: unite, senza fermarsi`, await errore(() => s.unisciPersone(resta, via)), 'nessun errore')
    ok(`${cosa}: email e contatto`, await scheda(resta), voluto)
    ok(`${cosa}: chi se ne va non c'è più`, await di(via), undefined)
  }
}

console.log('\n9. «stesso contatto di…» nella scheda')
{
  const p = (id, nome, cognome, altro = {}) => ({ id, nome, cognome, attiva: true, creataIl: '2026-01-01', iscrizioni: [], certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' }, ...altro })
  const tutte = [
    p('1', 'Paola', 'Bianchi', { email: 'mamma@esempio.it' }),
    p('2', 'Luca', 'Bianchi', { emailContatto: 'mamma@esempio.it' }),
    p('3', 'Sara', 'Bianchi', { emailContatto: 'MAMMA@esempio.it' }),
    p('4', 'Ada', 'Bianchi', { emailContatto: 'mamma@esempio.it' }),
    p('5', 'Teo', 'Verdi', { emailContatto: 'altra@esempio.it' }),
    p('6', 'Nina', 'Neri'),
    p('7', 'Omar', 'Neri'),
  ]
  const chi = (id) => stessoContatto(tutte.find((x) => x.id === id), tutte)
  ok('Luca (contatto): Ada e Sara, che hanno il contatto, e Paola, che lo ha come email; per cognome e nome, senza di lui', chi('2'), ['Ada Bianchi', 'Paola Bianchi', 'Sara Bianchi'])
  ok('Sara: scritto in maiuscolo o no, è lo stesso indirizzo', chi('3'), ['Ada Bianchi', 'Luca Bianchi', 'Paola Bianchi'])
  ok('Paola ha l\'indirizzo come email: vede chi lo ha come contatto', chi('1'), ['Ada Bianchi', 'Luca Bianchi', 'Sara Bianchi'])
  ok('mai se stessa, nemmeno con email e contatto uguali', stessoContatto(p('8', 'Zoe', 'Verdi', { email: 'z@esempio.it', emailContatto: 'Z@esempio.it' }), [p('8', 'Zoe', 'Verdi', { email: 'z@esempio.it', emailContatto: 'Z@esempio.it' })]), [])
  ok('Teo ha un contatto solo suo: nessuno', chi('5'), [])
  ok('e il contatto non è un indizio di doppione', m.doppioni.coppieDoppioni(tutte, { codiciFiscali: {}, nascite: {}, nonDoppioni: [] }).length, 0)
  ok('chi non ha contatto non è «uguale» a un altro senza', [chi('6'), chi('7')], [[], []])
}

console.log('\n10. gli indizi dei doppioni, e la ricerca')
{
  const p = (id, nome, cognome, altro = {}) => ({ id, nome, cognome, attiva: true, creataIl: '2026-01-01', iscrizioni: [], certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' }, ...altro })
  const indizi = { codiciFiscali: {}, nascite: {}, nonDoppioni: [] }
  const a = p('1', 'Luca', 'Verdi', { emailContatto: 'mamma@esempio.it' })
  const b = p('2', 'Sara', 'Neri', { emailContatto: 'mamma@esempio.it' })
  ok('lo stesso contatto non è un indizio di doppione', [m.doppioni.motivoDoppione(a, b, indizi), m.doppioni.coppieDoppioni([a, b], indizi).length], [null, 0])
  const sara = p('3', 'Sara', 'Neri')
  ok('e due che si chiamano uguale lo sono, col contatto o senza', m.doppioni.motivoDoppione(b, sara, indizi), 'nome')

  const luca = p('4', 'Luca', 'Bianchi', { emailContatto: 'mamma@casa.it' })
  const paola = p('5', 'Paola', 'Bianchi', { email: 'paola@lavoro.it' })
  ok('cerca per nome', [cercaNellElenco(luca, 'bianchi luca'), cercaNellElenco(luca, 'Luca Bianchi'), cercaNellElenco(luca, 'verdi')], [true, true, false])
  ok('per email', [cercaNellElenco(paola, 'paola@lav'), cercaNellElenco(luca, 'paola@lav')], [true, false])
  ok('e anche per contatto', [cercaNellElenco(luca, 'mamma@casa'), cercaNellElenco(paola, 'mamma@casa'), cercaNellElenco(luca, 'CASA.IT')], [true, false, true])
  ok('scritto niente, c\'è tutto', cercaNellElenco(luca, ''), true)
  ok('«solo senza email» guarda solo l\'email di accesso', [senzaEmail(luca), senzaEmail(paola), senzaEmail(p('6', 'X', 'Y', { email: 'x@y.it', emailContatto: 'z@y.it' })), senzaEmail(p('7', 'X', 'Z'))], [true, false, false, true])
}

console.log('\n11. gli esempi della modalità prova: qualche iscritto col contatto in comune')
{
  const tutte = diEsempio
  const perContatto = new Map()
  for (const p of tutte.filter((x) => x.emailContatto)) perContatto.set(p.emailContatto.toLowerCase(), [...(perContatto.get(p.emailContatto.toLowerCase()) ?? []), p])
  const gruppi = [...perContatto.values()]
  ok('almeno una famiglia con lo stesso contatto', gruppi.some((g) => g.length >= 2), true)
  const famiglia = gruppi.find((g) => g.length >= 2) ?? []
  const indirizzo = famiglia[0]?.emailContatto.toLowerCase()
  const parenti = tutte.filter((p) => p.id !== famiglia[0]?.id && (p.email?.toLowerCase() === indirizzo || p.emailContatto?.toLowerCase() === indirizzo)).map((p) => `${p.nome} ${p.cognome}`).sort()
  ok('i parenti si vedono fra loro nella scheda, anche chi ha l\'indirizzo come email', famiglia.length ? stessoContatto(famiglia[0], tutte).sort() : 'nessuna famiglia', parenti)
  ok('di quell\'indirizzo uno solo può averlo come email di accesso', famiglia.length ? tutte.filter((p) => p.email?.toLowerCase() === famiglia[0].emailContatto.toLowerCase()).length <= 1 : 'nessuna famiglia', true)
}

console.log('\n12. il resoconto dell\'import: riga, nome e di chi era l\'email')
{
  await s.salvaPersonale({ nome: 'Olga', cognome: 'Istruttrice', email: 'olga.istr@esempio.it', ruolo: 'istruttore' })
  const foglio = 'nome;cognome;email;telefono;corso\nAldo;Gemelli;gemelli@esempio.it;333;Judo 2\nBice;Gemelli;gemelli@esempio.it;333;Judo 2\nCarlo;Altro;OLGA.istr@esempio.it;333;Judo 2\n'
  const a = await m.importaLib.importa(s, m.importaLib.leggiFogli(null, foglio, (await s.corsi()).map((c) => c.nome)), () => {})
  ok('una riga per chi ha il contatto: numero di riga del foglio, nome, indirizzo, di chi era', a.emailDiAltri,
    ['riga 3: Bice Gemelli, contatto gemelli@esempio.it (email di Aldo Gemelli)', 'riga 4: Carlo Altro, contatto olga.istr@esempio.it (email di Olga Istruttrice)'])
  ok('il titolo dice quante righe guardare', testoResoconto(a).split('\n')[0], 'FATTO, 2 righe da controllare')
  ok('e COPIA L\'ELENCO ha anche quelle righe', a.emailDiAltri.every((r) => testoResoconto(a).includes(r)), true)
  ok('la frase dice quanti sono entrati e per quanti era di un altro', fraseResoconto(a), 'Sono entrati 3 iscritti. Per 2 l\'email era già di un\'altra persona: ora è la loro email di contatto.')
  ok('con una riga sola, al singolare', testoResoconto({ daSistemare: [], emailDiAltri: ['riga 2: A B, contatto a@b.it (email di C D)'] }).split('\n')[0], 'FATTO, 1 riga da controllare')
  ok('con righe da sistemare e contatti, si sommano', testoResoconto({ daSistemare: [{ foglio: 'iscritti.csv', riga: 5, nome: 'X Y', motivo: 'm' }], emailDiAltri: ['riga 2: A B, contatto a@b.it (email di C D)'] }).split('\n')[0], 'FATTO, 2 righe da controllare')
}

console.log('\n13. l\'errore va sotto il campo giusto, e il contatto dopo l\'unione è uno solo')
{
  ok('«già di…» è dell\'email', campoDelGuaio(emailGiaDi('Paola Bianchi')), 'email')
  ok('il contatto sbagliato è del contatto', campoDelGuaio(m.segreteriaLib.CONTATTO_SBAGLIATO), 'emailContatto')
  ok('un altro errore non è di nessun campo', campoDelGuaio('Servono nome e cognome'), null)
  ok('il messaggio è quello della prova', emailGiaDi('Paola Bianchi'), 'Questo indirizzo è già di Paola Bianchi: mettilo come email di contatto.')
  const c = (r, v) => contattoDopoUnione(r, v) ?? null
  ok('contatto di chi resta vince', c({ email: 'a@x.it', emailContatto: 'ca@x.it' }, { email: 'b@x.it', emailContatto: 'cb@x.it' }), 'ca@x.it')
  ok('senza, prende quello di chi se ne va', c({ email: 'a@x.it' }, { emailContatto: 'cb@x.it' }), 'cb@x.it')
  ok('senza nessuno dei due, l\'altra email se chi resta ne ha una', c({ email: 'a@x.it' }, { email: 'b@x.it' }), 'b@x.it')
  ok('se chi resta non ha email, quella di chi se ne va diventa la sua: niente contatto', c({}, { email: 'b@x.it' }), null)
  const p = (id, o) => ({ id, nome: 'N', cognome: 'C', attiva: true, creataIl: '2026-01-01', iscrizioni: [], certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' }, ...o })
  ok('resta e se ne va hanno tutto e diverso: se ne perdono due, e li dice tutti e due',
    indirizziPersi(p('1', { email: 'r@x.it', emailContatto: 'cr@x.it' }), p('2', { email: 'v@x.it', emailContatto: 'cv@x.it' })), ['v@x.it', 'cv@x.it'])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
