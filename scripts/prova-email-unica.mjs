// ---------------------------------------------------------------------------
// L'email unica, senza browser.
//
//   node scripts/prova-email-unica.mjs
//
// Una persona ha una sola email: è quella con cui entra nell'app e quella a
// cui arrivano ricevute e avvisi. Gli iscritti possono condividerla (un
// genitore e i suoi figli); chi ha l'accesso (istruttore, staff) no. La
// modalità prova deve dare gli stessi esiti del database (`99-email-unica.sql`,
// provato da `supabase/prova/email-unica.sql`, `iscrizioni.sql`,
// `ricevute-email.sql` e `unisci-doppioni.sql`). In più, le funzioni di
// `src/lib` che la schermata chiama.
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
const erroreDellEmail = lib(m.segreteriaLib, 'erroreDellEmail')
const cosaManca = lib(m.segreteriaLib, 'cosaManca')
const testoResoconto = lib(m.importaLib, 'testoResoconto')

// Gli esempi della modalità prova, prima che le altre sezioni aggiungano persone loro.
m.seminaEsempi()
const diEsempio = await s.persone()
const persone = async () => s.persone()
const di = async (id) => (await persone()).find((p) => p.id === id)
const unico = (() => { let n = 0; return () => `${++n}` })()
const coppia = (p) => [p.email ?? null]

console.log('\n0. sotto il campo Email solo gli errori dell\'email')
ok('l\'email sbagliata', erroreDellEmail(m.segreteriaLib.EMAIL_SBAGLIATA), m.segreteriaLib.EMAIL_SBAGLIATA)
ok('un errore di un altro campo no', erroreDellEmail('Serve almeno il nome'), '')

console.log('\n1. gli iscritti possono avere la stessa email, e la scheda ha un campo solo')
{
  ok('Paola', await errore(() => s.salvaPersona({ nome: 'Paola', cognome: 'Bianchi', email: 'mamma@esempio.it' })), 'nessun errore')
  ok('Marco, la stessa email scritta in maiuscolo: va', await errore(() => s.salvaPersona({ nome: 'Marco', cognome: 'Bianchi', email: 'Mamma@esempio.it' })), 'nessun errore')
  const luca = await s.salvaPersona({ nome: 'Luca', cognome: 'Bianchi' })
  ok('Luca, che l\'aveva vuota, la prende uguale', await errore(() => s.salvaPersona({ id: luca, nome: 'Luca', cognome: 'Bianchi', email: ' mamma@esempio.it ' })), 'nessun errore')
  const bianchi = (await persone()).filter((p) => p.cognome === 'Bianchi' && ['Paola', 'Marco', 'Luca'].includes(p.nome))
  ok('tutti e tre la tengono, senza spazi', bianchi.map((p) => [p.nome, p.email]).sort(), [['Luca', 'mamma@esempio.it'], ['Marco', 'Mamma@esempio.it'], ['Paola', 'mamma@esempio.it']])
  ok('e non c\'è un secondo indirizzo', bianchi.map((p) => 'emailContatto' in p), [false, false, false])
  ok('si toglie con una scritta vuota', await errore(() => s.salvaPersona({ id: luca, nome: 'Luca', cognome: 'Bianchi', email: '  ' })), 'nessun errore')
  ok('e non resta una stringa vuota', (await di(luca)).email, undefined)
}

console.log('\n2. la forma dell\'email, al massimo 160 lettere')
{
  const prova = async (email) => errore(() => s.salvaPersona({ nome: 'Forma', cognome: `Prova${unico()}`, email }))
  for (const sbagliata of ['mamma.esempio.it', 'mamma@esempio', 'la mamma@esempio.it', '@esempio.it']) {
    const messaggio = await prova(sbagliata)
    ok(`«${sbagliata}» no, con un messaggio per chi usa l'app`, [/non sembra un indirizzo/.test(messaggio), /check|constraint|violates|regex|persone_/i.test(messaggio)], [true, false])
  }
  ok('centosessanta lettere sì', await prova('a'.repeat(149) + '@esempio.it'), 'nessun errore')
  ok('centosessantuno no', /non sembra un indirizzo/.test(await prova('a'.repeat(150) + '@esempio.it')), true)
  ok('e non è entrata', (await persone()).some((p) => p.email === 'mamma.esempio.it'), false)
}

console.log('\n3. l\'iscritto può avere l\'email di un istruttore: l\'unicità è di chi ha l\'accesso')
{
  await s.salvaPersonale({ nome: 'Carlo', cognome: 'Istruttore', email: 'carlo.istr@esempio.it', ruolo: 'istruttore' })
  ok('un iscritto con quell\'indirizzo: sì', await errore(() => s.salvaPersona({ nome: 'Gino', cognome: 'Figlio', email: 'Carlo.Istr@esempio.it' })), 'nessun errore')
  ok('e l\'istruttore non cambia', (await s.personale()).filter((p) => p.cognome === 'Istruttore').map((p) => [p.email, p.ruolo]), [['carlo.istr@esempio.it', 'istruttore']])
  ok('un altro istruttore con la stessa email: no', await errore(() => s.salvaPersonale({ nome: 'Dino', cognome: 'Istruttore', email: 'CARLO.istr@esempio.it', ruolo: 'istruttore' })), 'Questa email è già di Carlo Istruttore')
}

console.log('\n4. il database vero: cosa scrive, cosa legge, cosa dice')
// Come Supabase: dalla seconda pagina (`.range()` oltre la prima) un elenco
// finto è finito. Senza, `tutteLeRighe` rileggerebbe le stesse righe per sempre.
const oltre = { then: (f, ko) => Promise.resolve({ data: [], error: null }).then(f, ko) }
{
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
            if (k === 'range' && a[0]) return oltre
            if (['insert', 'update'].includes(k)) scritte.push(a[0])
            return catena(tabella, [...passi, [k, a]])
          }
        },
      })
    return { client: { from: (t) => catena(t), rpc: () => catena('rpc') }, scritte, lette }
  }
  const doppia = { code: '23505', message: 'duplicate key value violates unique constraint "persone_email_unica"' }

  // Il database dove il 99 non è ancora passato: l'indice unico c'è ancora per tutti.
  const a = finto({ sulleScritture: () => ({ data: null, error: doppia }), lettura: () => ({ data: [], error: null }) })
  const messaggio = await errore(() => m.creaSegreteriaSupabase(a.client).salvaPersona({ nome: 'Marco', cognome: 'Bianchi', email: 'mamma@esempio.it' }))
  ok('l\'email già usata, prima del 99: dice cosa serve, non il testo del database', [/99-email-unica\.sql/.test(messaggio), /duplicate|constraint|persone_/i.test(messaggio)], [true, false])

  const b = finto({ sulleScritture: () => ({ data: { id: 'nuovo' }, error: null }), lettura: () => ({ data: [], error: null }) })
  await m.creaSegreteriaSupabase(b.client).salvaPersona({ nome: 'Marco', cognome: 'Bianchi', email: ' mamma@esempio.it ' })
  ok('scrive l\'email nella colonna sua, e solo quella', [b.scritte[0]?.email, 'email_contatto' in (b.scritte[0] ?? {})], ['mamma@esempio.it', false])
  await m.creaSegreteriaSupabase(b.client).salvaPersona({ nome: 'Marco', cognome: 'Bianchi' })
  ok('senza email scrive null, per toglierla', b.scritte[1]?.email, null)
  const dopo = b.scritte.length
  ok('un\'email sbagliata non arriva al database', [/non sembra un indirizzo/.test(await errore(() => m.creaSegreteriaSupabase(b.client).salvaPersona({ nome: 'Marco', cognome: 'Bianchi', email: 'mamma.esempio.it' }))), b.scritte.length], [true, dopo])

  const riga = { id: 'p-2', nome: 'Luca', cognome: 'Bianchi', email: 'mamma@esempio.it', telefono: null, attiva: true, creata_il: '2026-01-01T00:00:00Z', iscrizioni: [], schede_iscritti: null }
  const c = finto({ sulleScritture: () => ({ data: null, error: null }), lettura: () => ({ data: [riga], error: null }) })
  ok('l\'elenco porta l\'email', (await m.creaSegreteriaSupabase(c.client).persone()).map((p) => [p.nome, p.email ?? null]), [['Luca', 'mamma@esempio.it']])
  ok('e non chiede più la colonna del contatto', c.lette.some((x) => /email_contatto/.test(x)), false)
}

console.log('\n5. l\'import: due fratelli con la stessa email')
{
  const nomiCorsi = async () => (await s.corsi()).map((c) => c.nome)
  const foglio = 'nome;cognome;email;telefono;corso\nGino;Fratelli;fratelli@esempio.it;333 111;Judo 2\nPina;Fratelli;Fratelli@esempio.it;333 111;Judo 2\n'
  const f = m.importaLib.leggiFogli(null, foglio, await nomiCorsi())
  ok('tutti e due con l\'email, senza altri campi', f.iscritti.map((x) => [x.nome, x.email ?? null, 'emailContatto' in x]), [['Gino', 'fratelli@esempio.it', false], ['Pina', 'fratelli@esempio.it', false]])
  ok('niente avvisi e niente righe saltate', [f.note.length, f.saltate.length], [0, 0])
  const due = m.importaLib.leggiFogli(null, foglio + 'Pina;Fratelli;fratelli@esempio.it;333 111;Lotta 2\n', await nomiCorsi())
  ok('una persona su due righe (due corsi): una persona sola, due corsi', [due.iscritti.length, due.iscritti.find((x) => x.nome === 'Pina').corsi.length], [2, 2])
  const a = await m.importaLib.importa(s, f, () => {})
  ok('entrano tutti e due', [a.iscrittiNuovi, a.daSistemare.length], [2, 0])
  const fra = (await persone()).filter((p) => p.cognome === 'Fratelli').sort((x, y) => x.nome.localeCompare(y.nome))
  ok('con la stessa email', fra.map((p) => [p.nome, p.email ?? null]), [['Gino', 'fratelli@esempio.it'], ['Pina', 'fratelli@esempio.it']])
  const a2 = await m.importaLib.importa(s, m.importaLib.leggiFogli(null, foglio, await nomiCorsi()), () => {})
  ok('rifatto: nessuno nuovo, nessun doppione', [a2.iscrittiNuovi, (await persone()).filter((p) => p.cognome === 'Fratelli').length], [0, 2])

  // Un altro foglio, dopo: l'email è già di Gino e Pina, il fratello nuovo entra con la stessa.
  const dopo = m.importaLib.leggiFogli(null, 'nome;cognome;email;telefono;corso\nMario;Fratelli;FRATELLI@esempio.it;333;Judo 2\n', await nomiCorsi())
  const a3 = await m.importaLib.importa(s, dopo, () => {})
  ok('il fratello arrivato dopo entra, senza errore', [a3.iscrittiNuovi, a3.daSistemare.length], [1, 0])
  const mario = (await persone()).find((p) => p.nome === 'Mario' && p.cognome === 'Fratelli')
  ok('con la stessa email', mario?.email?.toLowerCase() ?? null, 'fratelli@esempio.it')
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
  ok('dal modulo: tutti e due con l\'email', risp.iscritti.map((x) => [x.nome, x.email ?? null]), [['Lia', 'mamma@gialli.it'], ['Tom', 'mamma@gialli.it']])
  ok('senza avvisi', risp.note.length, 0)
}

console.log('\n6. l\'import: l\'email di un istruttore non blocca, e l\'iscritto la tiene')
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
  ok('tutte e due nuove, nessuna da sistemare, nessun avviso sull\'email', [controllo.righe.map((x) => [x.riga, x.esito]), controllo.totali.da_sistemare ?? 0, controllo.righe.some((x) => x.avvisi.some((v) => /email|contatto/i.test(v)))], [[[2, 'nuova'], [3, 'nuova']], 0, false])
  const a = await m.importaLib.importa(s, f, () => {})
  ok('importando entrano tutte e due', [a.iscrittiNuovi, a.daSistemare.length], [2, 0])
  const ugo = (await persone()).find((p) => p.nome === 'Ugo' && p.cognome === 'Staffa')
  ok('Ugo ha quell\'indirizzo come email', ugo?.email?.toLowerCase() ?? null, 'ilaria.istr@esempio.it')
  ok('Ilaria non cambia', (await s.personale()).filter((p) => p.cognome === 'Istruttrice').map((p) => [p.nome, p.email]), [['Ilaria', 'ilaria.istr@esempio.it']])
  ok('Zeno entra con la sua', (await persone()).filter((p) => p.cognome === 'Libero').map(coppia), [['zeno.libero@esempio.it']])
  const a2 = await m.importaLib.importa(s, m.importaLib.leggiFogli(null, foglio, await nomiCorsi()), () => {})
  ok('rifatto: Ugo non si duplica', [a2.iscrittiNuovi, a2.daSistemare.length, (await persone()).filter((p) => p.cognome === 'Staffa').length], [0, 0, 1])
  const dopo = m.importaLib.controllaRighe(m.importaLib.leggiFogli(null, foglio, await nomiCorsi()), await situazione())
  ok('e il controllo lo riconosce: già in palestra', dopo.righe.map((x) => x.esito), ['in_palestra', 'in_palestra'])
}

console.log('\n7. il modulo online: l\'email della richiesta è quella della scheda')
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
  await s.salvaPersonale({ nome: 'Rita', cognome: 'Istruttrice', email: 'rita.istr@esempio.it', ruolo: 'istruttore' })
  const accogli = async (nome, cognome, email) => {
    const id = await r.accogli(await r.invia(richiesta(nome, cognome, email)))
    return di(id)
  }
  const figlio = await accogli('Fabio', 'Gialli', 'Madre@Esempio.it')
  ok('l\'email è già di un\'iscritta: la nuova persona la tiene uguale', figlio.email?.toLowerCase() ?? null, 'madre@esempio.it')
  const istr = await accogli('Gino', 'Gialli', 'rita.istr@esempio.it')
  ok('già di un\'istruttrice: lo stesso', istr.email ?? null, 'rita.istr@esempio.it')
  ok('l\'istruttrice non cambia', (await s.personale()).filter((p) => p.cognome === 'Istruttrice' && p.nome === 'Rita').map((p) => [p.email, p.ruolo]), [['rita.istr@esempio.it', 'istruttore']])
  // La scheda c'era già (stesso nome, senza email): prende l'email della richiesta, senza duplicarsi.
  await s.salvaPersona({ nome: 'Ivo', cognome: 'Gialli' })
  const ivo = await accogli('Ivo', 'Gialli', 'madre@esempio.it')
  ok('scheda già in elenco: prende l\'email, una persona sola', [ivo.email?.toLowerCase() ?? null, (await persone()).filter((p) => p.nome === 'Ivo').length], ['madre@esempio.it', 1])
  const libera = await accogli('Hugo', 'Gialli', 'hugo@esempio.it')
  ok('un\'email libera resta l\'email', coppia(libera), ['hugo@esempio.it'])
}

console.log('\n8. unire due schede: chi resta tiene la sua email, e cosa non si può tenere')
{
  // Ogni caso: chi resta, chi se ne va, l'email che deve restare, e cosa si perde (da dire prima).
  const casi = [
    ['a. due email diverse: resta quella di chi resta, e l\'altra si dice prima', { email: 'r1@esempio.it' }, { email: 'v1@esempio.it' }, 'r1@esempio.it', ['v1@esempio.it']],
    ['b. chi resta non ha email: prende quella di chi se ne va', {}, { email: 'v2@esempio.it' }, 'v2@esempio.it', []],
    ['c. chi se ne va non ha email', { email: 'r3@esempio.it' }, {}, 'r3@esempio.it', []],
    ['d. la stessa email scritta in maiuscolo: non si perde niente', { email: 'r4@esempio.it' }, { email: 'R4@esempio.it' }, 'r4@esempio.it', []],
    ['e. nessuna delle due', {}, {}, null, []],
  ]
  for (const [cosa, dellaResta, diChiVa, voluto, persi] of casi) {
    // Stesso nome e cognome: due doppioni veri.
    const cognome = `Unione${unico()}`
    const resta = await s.salvaPersona({ nome: 'Ada', cognome, ...dellaResta })
    const via = await s.salvaPersona({ nome: 'Ada', cognome, ...diChiVa })
    const prima = await persone()
    ok(`${cosa}: gli indirizzi che non si possono tenere, detti prima`, indirizziPersi(prima.find((p) => p.id === resta), prima.find((p) => p.id === via)), persi)
    ok(`${cosa}: unite, senza fermarsi`, await errore(() => s.unisciPersone(resta, via)), 'nessun errore')
    ok(`${cosa}: l'email`, (await di(resta)).email ?? null, voluto)
    ok(`${cosa}: chi se ne va non c'è più`, await di(via), undefined)
  }
}

console.log('\n9. «stesso contatto di…» nella scheda: chi ha la stessa email')
{
  const p = (id, nome, cognome, altro = {}) => ({ id, nome, cognome, attiva: true, creataIl: '2026-01-01', iscrizioni: [], certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' }, ...altro })
  const tutte = [
    p('1', 'Paola', 'Bianchi', { email: 'mamma@esempio.it' }),
    p('2', 'Luca', 'Bianchi', { email: 'mamma@esempio.it' }),
    p('3', 'Sara', 'Bianchi', { email: 'MAMMA@esempio.it' }),
    p('4', 'Ada', 'Bianchi', { email: 'mamma@esempio.it' }),
    p('5', 'Teo', 'Verdi', { email: 'altra@esempio.it' }),
    p('6', 'Nina', 'Neri'),
    p('7', 'Omar', 'Neri'),
  ]
  const chi = (id) => stessoContatto(tutte.find((x) => x.id === id), tutte)
  ok('Luca: gli altri tre, per cognome e nome, senza di lui', chi('2'), ['Ada Bianchi', 'Paola Bianchi', 'Sara Bianchi'])
  ok('Sara: scritto in maiuscolo o no, è lo stesso indirizzo', chi('3'), ['Ada Bianchi', 'Luca Bianchi', 'Paola Bianchi'])
  ok('mai se stessa', stessoContatto(tutte[0], [tutte[0]]), [])
  ok('Teo ha un\'email solo sua: nessuno', chi('5'), [])
  ok('chi non ha email non è «uguale» a un altro senza', [chi('6'), chi('7')], [[], []])
  ok('e la stessa email non è un indizio di doppione', m.doppioni.coppieDoppioni(tutte, { codiciFiscali: {}, nascite: {}, nonDoppioni: [] }).length, 0)
}

console.log('\n10. gli indizi dei doppioni, e la ricerca')
{
  const p = (id, nome, cognome, altro = {}) => ({ id, nome, cognome, attiva: true, creataIl: '2026-01-01', iscrizioni: [], certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' }, ...altro })
  const indizi = { codiciFiscali: {}, nascite: {}, nonDoppioni: [] }
  const a = p('1', 'Luca', 'Verdi', { email: 'mamma@esempio.it' })
  const b = p('2', 'Sara', 'Neri', { email: 'mamma@esempio.it' })
  ok('la stessa email non è un indizio di doppione', [m.doppioni.motivoDoppione(a, b, indizi), m.doppioni.coppieDoppioni([a, b], indizi).length], [null, 0])
  const sara = p('3', 'Sara', 'Neri')
  ok('e due che si chiamano uguale lo sono, con l\'email o senza', m.doppioni.motivoDoppione(b, sara, indizi), 'nome')

  const luca = p('4', 'Luca', 'Bianchi', { email: 'mamma@casa.it' })
  const paola = p('5', 'Paola', 'Bianchi', { email: 'paola@lavoro.it' })
  ok('cerca per nome', [cercaNellElenco(luca, 'bianchi luca'), cercaNellElenco(luca, 'Luca Bianchi'), cercaNellElenco(luca, 'verdi')], [true, true, false])
  ok('per email', [cercaNellElenco(paola, 'paola@lav'), cercaNellElenco(luca, 'paola@lav'), cercaNellElenco(luca, 'CASA.IT')], [true, false, true])
  ok('scritto niente, c\'è tutto', cercaNellElenco(luca, ''), true)
  ok('«solo senza email»', [senzaEmail(luca), senzaEmail(p('6', 'X', 'Y')), senzaEmail(p('7', 'X', 'Z', { email: 'x@y.it' }))], [false, true, false])
}

console.log('\n11. gli esempi della modalità prova: qualche famiglia con la stessa email')
{
  const perEmail = new Map()
  for (const p of diEsempio.filter((x) => x.email)) perEmail.set(p.email.toLowerCase(), [...(perEmail.get(p.email.toLowerCase()) ?? []), p])
  const famiglia = [...perEmail.values()].find((g) => g.length >= 2) ?? []
  ok('almeno una famiglia con la stessa email', famiglia.length >= 2, true)
  ok('i parenti si vedono fra loro nella scheda', famiglia.length ? stessoContatto(famiglia[0], diEsempio).sort() : 'nessuna famiglia', famiglia.slice(1).map((p) => `${p.nome} ${p.cognome}`).sort())
  ok('gli esempi non portano più il secondo indirizzo', diEsempio.some((p) => 'emailContatto' in p && p.emailContatto), false)
}

console.log('\n12. il resoconto dell\'import: niente più «email di contatto»')
{
  const foglio = 'nome;cognome;email;telefono;corso\nAldo;Gemelli;gemelli@esempio.it;333;Judo 2\nBice;Gemelli;gemelli@esempio.it;333;Judo 2\n'
  const a = await m.importaLib.importa(s, m.importaLib.leggiFogli(null, foglio, (await s.corsi()).map((c) => c.nome)), () => {})
  ok('entrati tutti e due, e nessuna riga da controllare', [a.iscrittiNuovi, a.daSistemare.length, a.emailDiAltri], [2, 0, undefined])
  ok('il resoconto dice solo FATTO', testoResoconto(a), 'FATTO')
  ok('una riga da sistemare resta', testoResoconto({ daSistemare: [{ foglio: 'iscritti.csv', riga: 5, nome: 'X Y', motivo: 'm' }] }), 'FATTO, 1 riga da sistemare\niscritti.csv, riga 5: X Y — m')
  ok('la frase sul contatto non c\'è più', typeof m.importaLib.fraseResoconto, 'undefined')
}

console.log('\n13. cosa manca nella scheda: l\'email per ricevute e avvisi è quella')
{
  const oggi = new Date()
  const manca = (p) => cosaManca({ nome: 'A', cognome: 'B', ...p }, null, oggi)
  ok('né telefono né email', manca({}), [{ cosa: 'Telefono, email per ricevute e avvisi' }])
  ok('con l\'email manca solo il telefono', manca({ email: 'a@b.it' }), [{ cosa: 'Telefono' }])
  ok('con tutti e due non manca niente', manca({ email: 'a@b.it', telefono: '333 1' }), [])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
