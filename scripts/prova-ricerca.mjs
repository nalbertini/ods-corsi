// ---------------------------------------------------------------------------
// La ricerca universale di «Cerca iscritto», senza browser.
//
//   node scripts/prova-ricerca.mjs
//
// `cercaTutto` (src/lib/ricerca.ts) è una funzione pura sui dati già letti, senza
// nuove chiamate al database. Firma:
//
//   cercaTutto(scritto: string, fonti: Fonti, oggi?: Date): EsitoRicerca
//
//   Fonti = { persone: PersonaSeg[] | null; richieste: Richiesta[] | null;
//             corsi: CorsoSeg[] | null; istruttori: Istruttore[] | null }
//           (`null` = non si è potuto leggere)
//   EsitoRicerca = {
//     stato: 'vuoto' | 'trovato' | 'niente' | 'non_letto'
//     gruppi: Array<{ tipo: 'iscritti' | 'richieste' | 'corsi' | 'istruttori';
//                     titolo: string; totale: number;
//                     righe: Array<{ id: string; nome: string; sotto: string; nota?: string }> }>
//     nonLetti: Array<'iscritti' | 'richieste' | 'corsi' | 'istruttori'>
//   }
// ---------------------------------------------------------------------------
import { existsSync } from 'node:fs'

// Il giorno di «oggi» si conta sull'orologio del banco, non su UTC: la prova 13 lo guarda vicino a mezzanotte.
process.env.TZ = 'Europe/Rome'
import { build } from 'esbuild'

const c = existsSync('src/lib/ricerca.ts') ? "export { cercaTutto, VOCE_DEL_GRUPPO, doveVa, unisciLetture } from './src/lib/ricerca'; " : ''
const { outputFiles } = await build({
  stdin: {
    contents:
      c +
      "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaRichiesteProva } from './src/lib/richiesteProva'; export { trovaIscritti } from './src/lib/segreteria'",
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
// Nessuna rete: se la ricerca chiamasse fuori, qui salta.
globalThis.fetch = () => {
  throw new Error('la ricerca ha chiamato la rete')
}

const m = await import(modulo)
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// Sabato 26 settembre 2026.
const OGGI = new Date(2026, 8, 26, 12, 0)
// Se la funzione non c'è ancora, ogni prova fallisce dicendolo.
const cerca = (scritto, fonti) => {
  if (typeof m.cercaTutto !== 'function') return { stato: 'cercaTutto non esiste (src/lib/ricerca.ts)', gruppi: [], nonLetti: [] }
  return m.cercaTutto(scritto, { persone: [], richieste: [], corsi: [], istruttori: [], ...fonti }, OGGI)
}
const tipi = (e) => e.gruppi.map((g) => g.tipo)
const gr = (e, tipo) => e.gruppi.find((g) => g.tipo === tipo) ?? { totale: 0, righe: [] }
const idIn = (e, tipo) => (gr(e, tipo)?.righe ?? []).map((r) => r.id)

const persona = (id, nome, cognome, altro = {}) => ({
  id, nome, cognome, attiva: true, creataIl: '2026-01-01', iscrizioni: [], certificato: {}, documento: false, pagamento: { stato: 'da_pagare' }, ...altro,
})
const richiesta = (id, nome, cognome, stato, creataIl, altro = {}) => ({
  id, nome, cognome, stato, creataIl, natoIl: '1990-01-01', natoA: '', codiceFiscale: '', indirizzo: '', cap: '', comune: '', email: '', telefono: '', corsi: [], formula: 'annuale', ...altro,
})
const corso = (id, nome, sala, ricorrenze, istruttori = []) => ({
  id, nome, sala, istruttori, attivo: true,
  ricorrenze: ricorrenze.map(([giorno, ora], i) => ({ id: `${id}-r${i}`, giorno, ora, durata: 60, dal: '2026-09-01' })),
})

console.log('\n1. i gruppi, nell\'ordine, e solo quelli con risultati')
{
  const fonti = {
    persone: [persona('p1', 'Giorgio', 'Neri')],
    richieste: [richiesta('r1', 'Gioia', 'Bassi', 'nuova', '2026-09-20')],
    corsi: [corso('c1', 'Judo kids', 'Tatami', [[4, '18:00']])],
    istruttori: [{ id: 'i1', nome: 'Giovanni' }],
  }
  const e = cerca('gio', fonti)
  ok('stato trovato', e.stato, 'trovato')
  ok('ISCRITTI, RICHIESTE ONLINE, CORSI, ISTRUTTORI', e.gruppi.map((g) => g.titolo), ['ISCRITTI', 'RICHIESTE ONLINE', 'CORSI', 'ISTRUTTORI'])
  ok('e i tipi', tipi(e), ['iscritti', 'richieste', 'corsi', 'istruttori'])
  ok('la riga dell\'iscritto: «Cognome Nome»', gr(e, 'iscritti').righe[0]?.nome, 'Neri Giorgio')
  const solo = cerca('giorgio', fonti)
  ok('un gruppo senza risultati non compare', tipi(solo), ['iscritti'])
  ok('nonLetti vuoto quando si è letto tutto', solo.nonLetti, [])
}

console.log('\n2. gli iscritti per nome, come oggi')
{
  const persone = [
    persona('a', 'Luca', "D'Amico"),
    persona('b', 'Maria', 'De Luca'),
    persona('c', 'Nicolò', 'Rossi', { attiva: false }),
    persona('d', 'Anna', 'Amicucci'),
    ...Array.from({ length: 12 }, (_, i) => persona(`z${i}`, `Zeta${i}`, 'Bianchi')),
  ]
  for (const q of ["d'am", 'dam', 'amico', "D’AMICO", 'deluca', 'de luca', 'nicolo', 'ros', 'luca', 'bianchi', 'zeta3 bianchi', 'xyz']) {
    const voluto = [...new Set(m.trovaIscritti ? persone.filter((p) => m.trovaIscritti([p], q).length).map((p) => p.id) : [])]
    const e = cerca(q, { persone })
    const tutti = (gr(e, 'iscritti').totale ?? 0)
    ok(`«${q}»: gli stessi di trovaIscritti, i primi tre in ordine`, [idIn(e, 'iscritti'), tutti], [m.trovaIscritti(persone, q).slice(0, 3).map((p) => p.id), voluto.length])
  }
  const e = cerca('rossi', { persone })
  ok('l\'archiviato si trova, «non attiva»', [gr(e, 'iscritti').righe[0]?.id, gr(e, 'iscritti').righe[0]?.nota], ['c', 'non attiva'])
  ok('gli attivi prima degli archiviati', idIn(cerca('luca', { persone }), 'iscritti'), ['a', 'b'])
}

console.log('\n3. gli iscritti per telefono ed email')
{
  const p1 = persona('p1', 'Giulia', 'Rossi', { telefono: '338 123 4567', email: 'g.rossi@mail.it' })
  const altri = [persona('p2', 'Paolo', 'Verdi', { telefono: '339 999 0000' })]
  const persone = [p1, ...altri]
  for (const q of ['3381234567', '338-123-4567', '+39 338 123 4567', '0039 338 1234567', '338 123', '1234567', '4567', '123']) {
    ok(`il telefono «${q}» trova Giulia, solo lei`, idIn(cerca(q, { persone }), 'iscritti'), ['p1'])
  }
  ok('la riga dice perché: il telefono', gr(cerca('4567', { persone }), 'iscritti').righe[0]?.sotto, 'tel. 338 123 4567')
  ok('due cifre non bastano', cerca('45', { persone }).stato, 'niente')
  ok('trovata per nome, la riga non parla di telefono', gr(cerca('giulia', { persone }), 'iscritti').righe[0]?.sotto.includes('tel.'), false)
  const em = cerca('g.rossi@', { persone })
  ok('l\'email si trova da un frammento', idIn(em, 'iscritti'), ['p1'])
  ok('la riga dice perché: l\'email', gr(em, 'iscritti').righe[0]?.sotto, 'email g.rossi@mail.it')
  ok('anche dal dominio', idIn(cerca('mail.it', { persone }), 'iscritti'), ['p1'])
}

console.log('\n4. il minore trovato dal genitore')
{
  const minore = persona('m', 'Marco', 'Rossi', { natoIl: '2017-03-01', telefono: '+39 347 555 0199', email: 'genitore.rossi@example.it' })
  const genitore = persona('g', 'Anna', 'Verdi', { natoIl: '1985-05-05', telefono: '347-555-0199', email: 'genitore.rossi@example.it' })
  const persone = [minore, genitore]
  const tel = cerca('3475550199', { persone })
  ok('dal telefono escono il minore e il genitore', idIn(tel, 'iscritti'), ['m', 'g'])
  ok('il minore: età e «numero di un genitore»', gr(tel, 'iscritti').righe[0]?.sotto, '9 anni · numero di un genitore')
  const riga = JSON.stringify(gr(tel, 'iscritti').righe[0]) ?? ''
  ok('del minore non esce né numero, né email, né nome del genitore', ['555', 'example', 'Anna', 'Verdi'].filter((x) => riga.includes(x)), [])
  ok('il genitore esce per i suoi dati', gr(tel, 'iscritti').righe[1]?.sotto, 'tel. 347-555-0199')
  const em = cerca('genitore.rossi@', { persone })
  ok('dall\'email: il minore dice «email di un genitore»', gr(em, 'iscritti').righe[0]?.sotto, '9 anni · email di un genitore')
  ok('e non la mostra', (JSON.stringify(gr(em, 'iscritti').righe[0]) ?? '').includes('example'), false)
  ok('senza il genitore in elenco, esce solo il minore', idIn(cerca('3475550199', { persone: [minore] }), 'iscritti'), ['m'])
}

console.log('\n5. i corsi: nome, sala, giorno')
{
  const corsi = [
    corso('c1', 'Judo kids', 'Tatami', [[1, '17:00'], [4, '17:00']]),
    corso('c2', 'Yoga', 'Motricità', [[2, '19:00']]),
    corso('c3', 'Pilates', 'Motricità', [[4, '09:30']]),
  ]
  const f = { corsi }
  ok('per nome', idIn(cerca('kid', f), 'corsi'), ['c1'])
  ok('per sala', idIn(cerca('motr', f), 'corsi').sort(), ['c2', 'c3'])
  ok('per giorno: «gio» i corsi del giovedì', idIn(cerca('gio', f), 'corsi').sort(), ['c1', 'c3'])
  ok('«martedì» solo lo yoga', idIn(cerca('martedì', f), 'corsi'), ['c2'])
  ok('nessun corso il sabato: il gruppo non c\'è', tipi(cerca('sab', f)), [])
  ok('la riga dice giorno, ora, sala', gr(cerca('kid', f), 'corsi').righe[0]?.sotto, 'lun 17:00, gio 17:00 · Tatami')
  ok('un corso disattivato non esce', idIn(cerca('kid', { corsi: [{ ...corsi[0], attivo: false }] }), 'corsi'), [])
}

console.log('\n6. le richieste online')
{
  const richieste = [
    richiesta('r1', 'Elena', 'Rossi', 'accolta', '2026-09-24'),
    richiesta('r2', 'Elia', 'Rossi', 'nuova', '2026-09-10'),
    richiesta('r3', 'Edo', 'Rossi', 'rifiutata', '2026-09-25'),
    richiesta('r4', 'Ennio', 'Rossi', 'nuova', '2026-09-12'),
  ]
  const e = cerca('rossi', { richieste })
  ok('anche accolte e rifiutate: il totale le conta tutte', gr(e, 'richieste').totale, 4)
  ok('le da accogliere prima delle altre', gr(e, 'richieste').righe.slice(0, 2).map((r) => r.nota), ['DA ACCOGLIERE', 'DA ACCOGLIERE'])
  ok('le righe sono tre', gr(e, 'richieste').righe.length, 3)
  ok('accolta: lo stato', gr(cerca('elena', { richieste }), 'richieste').righe[0]?.nota, 'accolta')
  ok('rifiutata: lo stato', gr(cerca('edo', { richieste }), 'richieste').righe[0]?.nota, 'rifiutata')
  ok('il nome come in elenco', gr(cerca('elena', { richieste }), 'richieste').righe[0]?.nome, 'Rossi Elena')
  const minore = [richiesta('r5', 'Teo', 'Neri', 'nuova', '2026-09-20', { genitoreNome: 'Paola', genitoreCognome: 'Zeta', telefono: '333 000 1111' })]
  ok('si cerca il richiedente, non il genitore', tipi(cerca('paola', { richieste: minore })), [])
  ok('né il suo telefono', tipi(cerca('3330001111', { richieste: minore })), [])
}

console.log('\n7. gli istruttori')
{
  const istruttori = [{ id: 'i1', nome: 'Maurizio' }, { id: 'i2', nome: 'Maura' }, { id: 'i3', nome: 'Katia' }]
  const corsi = [corso('c1', 'Judo 2', 'Tatami', [[1, '17:00']], [istruttori[0]]), corso('c2', 'Judo 3', 'Tatami', [[1, '18:00']], [istruttori[0], istruttori[1]])]
  const e = cerca('mauri', { istruttori, corsi })
  ok('per nome', idIn(e, 'istruttori'), ['i1'])
  ok('i corsi che insegna', gr(e, 'istruttori').righe[0]?.sotto, 'Judo 2, Judo 3')
  ok('«maur» ne trova due', idIn(cerca('maur', { istruttori, corsi }), 'istruttori').sort(), ['i1', 'i2'])
  ok('senza corsi, la riga c\'è lo stesso', gr(cerca('katia', { istruttori, corsi }), 'istruttori').righe[0]?.sotto, '')
}

console.log('\n8. al massimo tre righe per gruppo, col totale vero')
{
  const persone = Array.from({ length: 12 }, (_, i) => persona(`p${i}`, 'Bianca', `Bianchi${i}`))
  const e = cerca('bian', {
    persone,
    richieste: [richiesta('r1', 'Bianca', 'Neri', 'nuova', '2026-09-20')],
    istruttori: [{ id: 'i1', nome: 'Bianca' }],
  })
  ok('iscritti: tre righe, dodici in tutto', [gr(e, 'iscritti').righe.length, gr(e, 'iscritti').totale], [3, 12])
  ok('il gruppo grande non toglie spazio agli altri', tipi(e), ['iscritti', 'richieste', 'istruttori'])
  ok('i trovati interi restano nel gruppo, oltre alle tre righe', [gr(e, 'iscritti').ids?.length, gr(e, 'iscritti').ids?.slice(0, 3)], [12, ['p0', 'p1', 'p10']])
  ok('totale 1 per gli altri', [gr(e, 'richieste').totale, gr(e, 'istruttori').totale], [1, 1])
}

console.log('\n9. testo vuoto')
{
  const fonti = { persone: [persona('p', 'Anna', 'Rossi')] }
  for (const q of ['', '   ', '\t \n']) ok(`«${JSON.stringify(q)}»: stato vuoto, nessun gruppo`, [cerca(q, fonti).stato, cerca(q, fonti).gruppi], ['vuoto', []])
}

console.log('\n10. la lettura fallita non è «nessun risultato»')
{
  const tutteNull = { persone: null, richieste: null, corsi: null, istruttori: null }
  const e = cerca('rossi', tutteNull)
  ok('niente letto: «non_letto», non «niente»', [e.stato, e.gruppi, e.nonLetti], ['non_letto', [], ['iscritti', 'richieste', 'corsi', 'istruttori']])
  ok('letto tutto e nulla trovato: «niente»', [cerca('qqqq', { persone: [persona('p', 'Anna', 'Rossi')] }).stato, cerca('qqqq', {}).nonLetti], ['niente', []])
  const parz = cerca('judo', { persone: null, corsi: [corso('c1', 'Judo kids', 'Tatami', [[1, '17:00']])] })
  ok('letto in parte: si mostra quel che c\'è e si dice cosa manca', [parz.stato, tipi(parz), parz.nonLetti], ['trovato', ['corsi'], ['iscritti']])
  const parzVuoto = cerca('qqqq', { persone: null })
  ok('letto in parte e nulla trovato: non si dice «nessuno»', [parzVuoto.stato, parzVuoto.nonLetti], ['non_letto', ['iscritti']])
  ok('testo vuoto resta «vuoto» anche senza lettura', cerca('', tutteNull).stato, 'vuoto')
}

console.log('\n11. sui dati della modalità prova, senza rete')
{
  const s = m.creaSegreteriaProva()
  const r = m.creaRichiesteProva()
  const fonti = { persone: await s.persone(), richieste: await r.richieste(), corsi: await s.corsi(), istruttori: await s.istruttori() }
  const e = cerca('judo', fonti)
  ok('«judo»: corsi, al massimo tre righe, il totale vero', [gr(e, 'corsi')?.righe.length, gr(e, 'corsi')?.totale > 3], [3, true])
  const i = cerca('maurizio', fonti)
  ok('«maurizio»: l\'istruttore coi corsi che insegna', [idIn(i, 'istruttori').length, gr(i, 'istruttori')?.righe[0]?.sotto.includes('Judo')], [1, true])
  ok('una persona di prova si trova per nome', fonti.persone.length > 0 && cerca(fonti.persone[0].nome, fonti).gruppi[0]?.tipo, 'iscritti')
  ok('la lettura riuscita non è mai «non_letto»', cerca('qqqq', fonti).stato, 'niente')
}

console.log('\n12. dove porta ogni gruppo')
ok('ALTRI N apre la voce del menu; l\'istruttore, che non ha una scheda, ISTRUTTORI E ACCESSI', m.VOCE_DEL_GRUPPO, { iscritti: 'iscritti', richieste: 'richieste', corsi: 'corsi', istruttori: 'personale' })

console.log('\n13. a mezzanotte «oggi» è il giorno del banco')
{
  const mezzanotte = new Date(2026, 8, 26, 0, 30)
  const corsi = [corso('c1', 'Judo kids', 'Tatami', [[1, '17:00']])]
  const finita = persona('p', 'Anna', 'Rossi', { iscrizioni: [{ corsoId: 'c1', dal: '2026-01-01', al: '2026-09-25' }] })
  const incorso = persona('q', 'Aldo', 'Rossi', { iscrizioni: [{ corsoId: 'c1', dal: '2026-01-01', al: '2026-09-26' }] })
  if (typeof m.cercaTutto !== 'function') ok('cercaTutto non esiste', 0, 1)
  else {
    const e = m.cercaTutto('rossi', { persone: [finita, incorso], richieste: [], corsi, istruttori: [] }, mezzanotte)
    ok('chi ha finito ieri non ha più il corso; chi finisce oggi sì', e.gruppi[0]?.righe.map((r) => [r.id, r.sotto]), [['p', ''], ['q', 'Judo kids']])
  }
}

console.log('\n14. lo stile di una riga lo dice la riga, non il suo testo')
{
  const e = cerca('rossi', {
    persone: [persona('a', 'Anna', 'Rossi'), persona('b', 'Bruno', 'Rossi', { attiva: false })],
    richieste: [richiesta('r1', 'Elia', 'Rossi', 'nuova', '2026-09-10'), richiesta('r2', 'Elena', 'Rossi', 'accolta', '2026-09-11'), richiesta('r3', 'Edo', 'Rossi', 'rifiutata', '2026-09-12')],
  })
  ok('iscritti: spenta solo l\'archiviato', gr(e, 'iscritti').righe.map((r) => [r.id, !!r.spenta]), [['a', false], ['b', true]])
  ok('richieste: il tag solo a quella da accogliere, spenta la rifiutata', gr(e, 'richieste').righe.map((r) => [r.id, !!r.tag, !!r.spenta]), [['r1', true, false], ['r3', false, true], ['r2', false, false]])
}

console.log('\n15. dove porta ogni risultato')
{
  const d = (tipo, id, ricerca) => (typeof m.doveVa === 'function' ? m.doveVa(tipo, id === undefined ? undefined : { id }, ricerca) : 'doveVa non esiste')
  const r = { testo: 'ros', ids: ['a', 'b', 'c', 'd'] }
  ok('un iscritto apre la sua scheda', d('iscritti', 'p1'), { voce: 'iscritti', dest: { persona: 'p1' } })
  ok('un corso apre la sua scheda', d('corsi', 'c1'), { voce: 'corsi', dest: { corso: 'c1' } })
  ok('una richiesta si apre in RICHIESTE ONLINE', d('richieste', 'r1'), { voce: 'richieste', dest: { richiesta: 'r1' } })
  ok('un istruttore apre ISTRUTTORI E ACCESSI', d('istruttori', 'i1'), { voce: 'personale' })
  ok('ALTRI N apre ISCRITTI, CORSI e RICHIESTE già filtrati: testo e tutti i trovati', [d('iscritti', undefined, r), d('corsi', undefined, r), d('richieste', undefined, r)], [
    { voce: 'iscritti', dest: { ricerca: r } },
    { voce: 'corsi', dest: { ricerca: r } },
    { voce: 'richieste', dest: { ricerca: r } },
  ])
  ok('gli istruttori non hanno un elenco da filtrare', d('istruttori', undefined, r), { voce: 'personale' })
}

console.log('\n16. una lettura fallita tiene i dati di prima')
{
  const prima = { persone: [persona('p', 'Anna', 'Rossi')], richieste: [], corsi: [], istruttori: [{ id: 'i', nome: 'Ugo' }] }
  const u = (p, n) => (typeof m.unisciLetture === 'function' ? m.unisciLetture(p, n) : 'unisciLetture non esiste')
  const tutte = { persone: [], richieste: [], corsi: [], istruttori: [] }
  ok('la prima lettura è quella che è', u(null, tutte), { fonti: tutte, vecchi: false })
  ok('la prima lettura fallita resta null, e non è «dati di prima»', u(null, { ...tutte, persone: null }), { fonti: { ...tutte, persone: null }, vecchi: false })
  for (const k of ['persone', 'richieste', 'corsi', 'istruttori']) {
    const r = u(prima, { ...tutte, [k]: null })
    ok(`${k} fallita: resta quella di prima, e si dice`, [r.fonti?.[k], r.vecchi], [prima[k], true])
  }
  ok('una riuscita sostituisce la vecchia', u(prima, tutte), { fonti: tutte, vecchi: false })
}

console.log('\n17. l\'iscritto attivo trovato dice se è in regola')
{
  const quotaPagata = { anno: 2026, numero: 1, dal: '2026-09-01', al: '2027-08-31', mancano: 0 }
  const cert = (scade) => ({ certificato: { scade, conFile: true }, natoIl: '1990-01-01' })
  const stato = (p, q = 'rossi') => gr(cerca(q, { persone: [p] }), 'iscritti').righe[0]?.stato
  const rosso = (parola) => ({ tono: 'rosso', parola })
  const giallo = (parola) => ({ tono: 'giallo', parola })
  // In regola: niente da dire, la lista è vuota e la riga mostra il solo ✓.
  const inRegola = []

  ok('senza certificato né ricevuta: prima il certificato, poi la quota', stato(persona('a', 'Anna', 'Rossi', { natoIl: '1990-01-01' })), [rosso('Manca il certificato'), rosso('Da pagare')])
  ok('certificato scaduto e quota pagata: solo il certificato', stato(persona('a', 'Anna', 'Rossi', { ...cert('2026-08-01'), quote: [quotaPagata] })), [rosso('Certificato scaduto')])
  ok('certificato valido e quota pagata: In regola', stato(persona('a', 'Anna', 'Rossi', { ...cert('2027-06-01'), quote: [quotaPagata] })), inRegola)
  ok('la quota pagata fuori app non aggiunge «Fuori app»', stato(persona('a', 'Anna', 'Rossi', { ...cert('2027-06-01'), pagamento: { stato: 'pagato', fino: '2027-08-31' } })), inRegola)
  ok('il certificato in scadenza dà il giallo con la data', stato(persona('a', 'Anna', 'Rossi', { ...cert('2026-10-10'), quote: [quotaPagata] })), [giallo('Scade il 10/10')])
  ok('un certificato che scade proprio oggi: «Scade oggi»', stato(persona('a', 'Anna', 'Rossi', { ...cert('2026-09-26'), quote: [quotaPagata] })), [giallo('Scade oggi')])
  ok('la quota pagata in parte è gialla', stato(persona('a', 'Anna', 'Rossi', { ...cert('2027-06-01'), quote: [{ ...quotaPagata, mancano: 500 }] })), [giallo('Pagata in parte')])
  ok('l\'adulto senza data di nascita, certificato e quota a posto: In regola (la nota grigia non si dice)', stato(persona('a', 'Anna', 'Rossi', { certificato: { scade: '2027-06-01', conFile: true }, quote: [quotaPagata] })), inRegola)

  const piccolo = { natoIl: '2022-01-01' }
  ok('sotto i 6 anni senza certificato conta solo la quota: da pagare', stato(persona('a', 'Anna', 'Rossi', piccolo)), [rosso('Da pagare')])
  ok('sotto i 6 anni, quota pagata: In regola', stato(persona('a', 'Anna', 'Rossi', { ...piccolo, quote: [quotaPagata] })), inRegola)

  const archiviato = gr(cerca('rossi', { persone: [persona('b', 'Bruno', 'Rossi', { attiva: false })] }), 'iscritti').righe[0]
  ok('chi non è attivo non ha «stato» (la chiave manca), tiene «non attiva» e spenta', [archiviato && 'stato' in archiviato, archiviato?.nota, archiviato?.spenta], [false, 'non attiva', true])

  const minore = persona('m', 'Marco', 'Bianchi', { natoIl: '2017-03-01', telefono: '347 555 0199' })
  const genitore = persona('g', 'Anna', 'Verdi', { ...cert('2027-06-01'), quote: [quotaPagata], telefono: '347 555 0199' })
  const righe = gr(cerca('3475550199', { persone: [minore, genitore] }), 'iscritti').righe
  ok('il minore trovato dal numero del genitore porta il suo stato; il genitore il proprio', righe.map((r) => [r.id, r.stato]), [['m', [rosso('Manca il certificato'), rosso('Da pagare')]], ['g', inRegola]])

  const e = cerca('rossi', {
    persone: [persona('a', 'Anna', 'Rossi')],
    richieste: [richiesta('r1', 'Elia', 'Rossi', 'nuova', '2026-09-10')],
    corsi: [corso('c1', 'Rossi team', 'Tatami', [[1, '17:00']])],
    istruttori: [{ id: 'i1', nome: 'Rossi' }],
  })
  ok('richieste, corsi e istruttori non hanno «stato»', ['richieste', 'corsi', 'istruttori'].map((t) => gr(e, t).righe.some((r) => 'stato' in r)), [false, false, false])
}

console.log(guai ? `\n${guai} prove non passano.` : '\nTutto a posto.')
process.exit(guai ? 1 : 0)
