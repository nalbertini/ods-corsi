// ---------------------------------------------------------------------------
// La scheda dell'iscritto rivista, senza browser: sotto il nome, minorenne,
// cosa manca, la quota fuori app, il sesso dal codice fiscale.
//
//   node scripts/prova-scheda-persona.mjs
//
// (`prova-scheda.mjs` è delle schede PERSONA/DOCUMENTI/QUOTA/CORSI.)
// Canvas: docs/design-canvas/scheda-iscritto-persona.
// ---------------------------------------------------------------------------
process.env.TZ = 'Europe/Rome'

import { build } from 'esbuild'

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * as seg from './src/lib/segreteria'; export * as cf from './src/lib/codiceFiscale'; export { mancanoDatiSocio } from './src/lib/ricevute'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che manca è una prova che fallisce, non un'uscita a metà.
const f = (modulo, nome, ...args) => (typeof m[modulo][nome] === 'function' ? m[modulo][nome](...args) : `manca ${nome}()`)
const seg = (nome, ...args) => f('seg', nome, ...args)
// cosaManca dà { cosa, perche }: le prove leggono la riga come la mostra la scheda.
const righe = (r) => (Array.isArray(r) ? r.map((x) => (typeof x === 'string' ? x : `${x.cosa}${x.perche ? ` · ${x.perche}` : ''}`)) : [])
// La maiuscola la mette cosaManca: le prove guardano le parole.
const conta = (r, re) => righe(r).filter((x) => new RegExp(re.source, 'i').test(x)).length

const OGGI = new Date(2026, 9, 22)
const cf = (quindici) => quindici + m.cf.carattereControllo(quindici)
const CF_ADULTO = cf('RSSMRA90E10H501') // nato il 10/05/1990
const CF_MINORE = cf('RSSMRA12R01H501') // nato il 01/10/2012
const CF_GENITORE = cf('VRDLRA80A41H501') // donna

const persona = { id: 'p1', nome: 'Mario', cognome: 'Rossi', email: 'a@x.it', telefono: '3331234567', attiva: true, creataIl: '2026-10-06' }
const adulta = { natoIl: '1990-05-10', codiceFiscale: CF_ADULTO, indirizzo: 'Via Roma 1', comune: 'Roma' }
const minore = { natoIl: '2012-10-01', codiceFiscale: CF_MINORE, indirizzo: 'Via Roma 1', comune: 'Roma', genitoreNome: 'Laura', genitoreCognome: 'Verdi', genitoreCodiceFiscale: CF_GENITORE }
const cosaManca = (p, a) => seg('cosaManca', p, a, OGGI)

console.log('A1. Sotto il nome')
ok('con la data di nascita: età e da quando è in elenco', seg('sottoNome', '2012-10-01', '2026-10-06', OGGI), '14 anni · in elenco dal 6 ottobre 2026')
ok('senza data di nascita: solo da quando è in elenco', seg('sottoNome', null, '2026-10-06', OGGI), 'In elenco dal 6 ottobre 2026')
ok('mai «nessun accesso»', /nessun accesso/i.test(String(seg('sottoNome', null, '2026-10-06', OGGI))), false)

console.log('\nA2. Minorenne')
const eM = (p, a) => seg('eMinorenne', p, a, OGGI)
ok('dalla data della persona', eM({ natoIl: '2012-10-01' }, null), true)
ok('dalla data dell’anagrafica se la persona non ce l’ha', eM({}, { natoIl: '2012-10-01' }), true)
ok('dal codice fiscale se natoIl manca', eM({}, { codiceFiscale: CF_MINORE }), true)
ok('dal codice fiscale di un adulto: maggiorenne', eM({}, { codiceFiscale: CF_ADULTO }), false)
ok('nessun dato: maggiorenne', eM({}, null), false)
ok('codice fiscale non valido e niente data: maggiorenne', eM({}, { codiceFiscale: 'XXXX' }), false)
ok('il giorno dei 18 anni: maggiorenne', eM({ natoIl: '2008-10-22' }, null), false)
ok('il giorno prima dei 18: minorenne', eM({ natoIl: '2008-10-23' }, null), true)
// Come la ricevuta: letti i dati anagrafici, vincono loro (poi il CF) sulla data dell'elenco.
ok('i dati anagrafici senza data vincono sull’elenco: la data dal CF', seg('natoIlDi', { natoIl: '2012-10-01' }, { codiceFiscale: CF_ADULTO }, OGGI), '1990-05-10')
ok('dati anagrafici non ancora letti: la data dell’elenco', seg('natoIlDi', { natoIl: '2012-10-01' }, null, OGGI), '2012-10-01')
ok('solo il CF: la data dal CF', seg('natoIlDi', {}, { codiceFiscale: CF_ADULTO }, OGGI), '1990-05-10')

console.log('\nA3. Il genitore del minorenne')
const GEN_CF = /codice fiscale del genitore · serve per la ricevuta/
ok('CF del genitore vuoto: la riga', conta(cosaManca(persona, { ...minore, genitoreCodiceFiscale: '' }), GEN_CF), 1)
ok('CF del genitore non valido: la riga dice che non è giusto', conta(cosaManca(persona, { ...minore, genitoreCodiceFiscale: 'ABC' }), /codice fiscale del genitore.*non è giusto/), 1)
ok('CF del genitore valido: nessuna riga', conta(cosaManca(persona, minore), /genitore/i), 0)
ok('senza nome del genitore: la riga del nome', conta(cosaManca(persona, { ...minore, genitoreNome: '', genitoreCognome: '' }), /nome del genitore/i), 1)
// Come la ricevuta (intestatarioDaRichiesta): senza nome il CF del genitore non conta.
ok('senza nome del genitore: chiede anche il CF', conta(cosaManca(persona, { ...minore, genitoreNome: '', genitoreCognome: '' }), GEN_CF), 1)
const primaRiga = cosaManca(persona, { ...adulta, codiceFiscale: '' })
ok('le righe separano cosa e perché', Array.isArray(primaRiga) ? primaRiga[0] : primaRiga, { cosa: 'Codice fiscale', perche: 'serve per la ricevuta' })

console.log('\nA4. Contatti')
ok('tutto compilato: niente', cosaManca(persona, adulta), [])
const senzaTutti = cosaManca({ ...persona, telefono: '', email: '' }, adulta)
ok('telefono ed email vuoti: una riga sola', righe(senzaTutti).length, 1)
ok('…che nomina il telefono e l’email per ricevute e avvisi', /telefono/i.test(righe(senzaTutti)[0] ?? '') && /email per ricevute e avvisi/i.test(righe(senzaTutti)[0] ?? ''), true)
const soloTel = cosaManca({ ...persona, telefono: '' }, adulta)
ok('solo il telefono vuoto: una riga, solo il telefono', righe(soloTel).length === 1 && /telefono/i.test(righe(soloTel)[0]) && !/email/i.test(righe(soloTel)[0]), true)
ok('solo l’email vuota: una riga, solo l’email', righe(cosaManca({ ...persona, email: '' }, adulta)).length === 1 && !/telefono/i.test(righe(cosaManca({ ...persona, email: '' }, adulta))[0]), true)

console.log('\nA5. Cosa non si chiede')
ok('maggiorenne senza genitore: nessuna riga del genitore', conta(cosaManca(persona, adulta), /genitore/i), 0)
ok('residenza vuota: nessuna riga', conta(cosaManca(persona, { ...adulta, indirizzo: '', comune: '' }), /residenza|indirizzo|comune/i), 0)

console.log('\nA5b. L’iscritto')
ok('CF vuoto: la riga', conta(cosaManca(persona, { ...adulta, codiceFiscale: '' }), /codice fiscale/i), 1)
ok('CF non valido: la riga dice che non è giusto', conta(cosaManca(persona, { ...adulta, codiceFiscale: 'ABC' }), /codice fiscale.*non è giusto/i), 1)
ok('senza data di nascita (né natoIl né dal CF): la riga', conta(cosaManca(persona, { ...adulta, natoIl: '', codiceFiscale: '' }), /data di nascita/i), 1)
ok('la data si legge dal CF: nessuna riga della data', conta(cosaManca(persona, { ...adulta, natoIl: '' }), /data di nascita/i), 0)

console.log('\nA6. Allineata con la ricevuta (mancanoDatiSocio.blocca)')
const casi = [
  ['adulto senza CF', { ...adulta, codiceFiscale: '' }],
  ['adulto con CF sbagliato', { ...adulta, codiceFiscale: 'ABC' }],
  ['minore senza genitore', { ...minore, genitoreNome: '', genitoreCognome: '' }],
  ['minore, CF del genitore vuoto', { ...minore, genitoreCodiceFiscale: '' }],
  ['minore, CF del genitore sbagliato', { ...minore, genitoreCodiceFiscale: 'ABC' }],
  ['minore senza CF suo', { ...minore, codiceFiscale: '' }],
]
for (const [nome, a] of casi) {
  const { blocca } = m.mancanoDatiSocio(
    { natoIl: a.natoIl, codiceFiscale: a.codiceFiscale, genitore: [a.genitoreNome, a.genitoreCognome].filter(Boolean).join(' '), genitoreCodiceFiscale: a.genitoreCodiceFiscale },
    OGGI,
  )
  const r = righe(cosaManca(persona, a))
  // Ogni blocco ha la sua riga, con le stesse parole (senza «il» e «del socio»).
  const cosa = (t) => t.replace(/^il /, '').replace(' del socio', '').replace('genitore', 'nome del genitore').replace('codice fiscale del nome del genitore', 'codice fiscale del genitore')
  ok(`${nome}: una riga per ogni cosa che blocca la ricevuta`, blocca.length > 0 && blocca.every((b) => r.some((x) => x.toLowerCase().startsWith(cosa(b.testo)))), true)
}

console.log('\nA7. Quota pagata fuori app: una riga sola')
ok('con la data', seg('rigaFuoriApp', { fonte: 'fuori_app', fino: '2027-07-31' }), 'fuori app · fino al 31/07/2027')
ok('senza la data', seg('rigaFuoriApp', { fonte: 'fuori_app' }), 'fuori app')
ok('una quota da ricevuta non è fuori app', seg('rigaFuoriApp', { fonte: 'ricevuta', fino: '2027-07-31' }), null)

console.log('\nA8. Sesso dal codice fiscale')
const sesso = (c) => f('cf', 'cfSesso', c)
ok('femminile (giorno + 40)', sesso(CF_GENITORE), 'F')
ok('maschile', sesso(CF_ADULTO), 'M')
// Giorno 41 scritto con le lettere dell'omocodia: 4 → Q, 1 → M.
ok('omocodico: decodificato', sesso(cf('VRDLRA80A' + 'QM' + 'H501')), 'F')
ok('omocodico maschile: 10 → ML', sesso(cf('RSSMRA90E' + 'ML' + 'H501')), 'M')
ok('non valido: null', sesso('ABC'), null)
ok('con gli spazi: si legge lo stesso', sesso(CF_GENITORE.slice(0, 6) + ' ' + CF_GENITORE.slice(6)), 'F')
ok('etichetta della data: NATA IL', seg('etichettaNatoIl', CF_GENITORE), 'NATA IL')
ok('etichetta della data: NATO IL senza un CF valido', seg('etichettaNatoIl', 'ABC'), 'NATO IL')

console.log('\nA9. Il codice fiscale del genitore nella scheda')
ok('vuoto: manca', seg('cfGenitoreDaMostrare', { genitoreCodiceFiscale: '' }), { codice: '', giusto: false })
ok('sbagliato: non giusto', seg('cfGenitoreDaMostrare', { genitoreCodiceFiscale: 'abc' }), { codice: 'ABC', giusto: false })
ok('giusto, con spazi e minuscole: giusto', seg('cfGenitoreDaMostrare', { genitoreCodiceFiscale: CF_GENITORE.toLowerCase().slice(0, 6) + ' ' + CF_GENITORE.slice(6) }), { codice: CF_GENITORE, giusto: true })
ok('carattere di controllo sbagliato: null', sesso(CF_GENITORE.slice(0, 15) + (CF_GENITORE[15] === 'A' ? 'B' : 'A')), null)

console.log(guai ? `\n${guai} prove non passano` : '\nTutte le prove passano')
process.exit(guai ? 1 : 0)
