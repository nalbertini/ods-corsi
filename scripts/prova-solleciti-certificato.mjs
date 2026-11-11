// ---------------------------------------------------------------------------
// I solleciti del certificato per email: le regole di
// `src/lib/sollecitiCertificato.ts` (momenti, oggetto, testo, il prossimo, la
// riga della scheda) e il testo della mail in `src/lib/avvisoSegreteria.ts`.
// Il database lo prova `supabase/prova/solleciti-certificato.sql`.
//
//   node scripts/prova-solleciti-certificato.mjs
//
// Le date sono scritte per esteso (AAAA-MM-GG): niente `new Date()`, niente
// fuso del computer. Si lancia anche con TZ=UTC e TZ=Europe/Rome: stesso esito.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const inizia = (cosa, avuto, inizio) => ok(cosa, typeof avuto === 'string' && avuto.startsWith(inizio) ? inizio : avuto, inizio)
const contiene = (cosa, avuto, pezzo) => ok(cosa, typeof avuto === 'string' && avuto.includes(pezzo), true)

// Un modulo che ancora non c'è non ferma la prova: la rende rossa dicendolo.
const carica = async (file, nomi) => {
  try {
    return await impacchetta(`export * from './src/lib/${file}'`)
  } catch (e) {
    console.log(`  ✗ manca src/lib/${file}.ts —`, (e.errors?.[0]?.text ?? e.message).split('\n')[0])
    guai++
    return {}
  }
}
const sc = await carica('sollecitiCertificato')
const av = await carica('avvisoSegreteria')
const lib = (m, nome) => (typeof m[nome] === 'function' ? m[nome] : () => `manca ${nome}`)
const cosaNonVaMomenti = lib(sc, 'cosaNonVaMomenti')
const cosaNonVaOggetto = lib(sc, 'cosaNonVaOggetto')
const cosaNonVaTesto = lib(sc, 'cosaNonVaTesto')
const rigaMomento = lib(sc, 'rigaMomento')
const prossimoSollecito = lib(sc, 'prossimoSollecito')
const rigaSollecitiEmail = lib(sc, 'rigaSollecitiEmail')
const nomiInsieme = lib(av, 'nomiInsieme')
const testoAvviso = lib(av, 'testoAvviso')

console.log('1. i momenti (da 1 a 6, al più 60 giorni, senza doppioni)')
const NE_SERVONO = 'Ne servono da 1 a 6.'
ok('i momenti proposti', sc.MOMENTI_PROPOSTI, [-7, 0, 7])
ok('i proposti vanno bene', cosaNonVaMomenti([-7, 0, 7]), undefined)
ok('nessuno: no', cosaNonVaMomenti([]), NE_SERVONO)
ok('sei vanno bene', cosaNonVaMomenti([-30, -14, -7, 0, 7, 14]), undefined)
ok('sette: no', cosaNonVaMomenti([-30, -14, -7, 0, 7, 14, 30]), NE_SERVONO)
ok('60 giorni dopo va bene', cosaNonVaMomenti([60]), undefined)
ok('60 giorni prima va bene', cosaNonVaMomenti([-60]), undefined)
ok('61 giorni dopo: no', cosaNonVaMomenti([61]), 'Al più 60 giorni prima o dopo il termine.')
ok('61 giorni prima: no', cosaNonVaMomenti([-61]), 'Al più 60 giorni prima o dopo il termine.')
ok('mezzo giorno: no', cosaNonVaMomenti([1.5]), 'Al più 60 giorni prima o dopo il termine.')
ok('due momenti uguali: no', cosaNonVaMomenti([7, 7]), 'Due momenti sono lo stesso giorno: togline uno.')

console.log('\n2. l\'oggetto (una riga, 200 caratteri, solo {nome} ed {entro})')
ok('quello di default va bene', cosaNonVaOggetto('Il certificato medico di {nome}'), undefined)
ok('con {entro} va bene', cosaNonVaOggetto('{nome}: certificato entro il {entro}'), undefined)
ok('vuoto: no', cosaNonVaOggetto(''), 'Scrivi l’oggetto della mail.')
ok('200 caratteri vanno bene', cosaNonVaOggetto('a'.repeat(200)), undefined)
ok('201: no', cosaNonVaOggetto('a'.repeat(201)), 'L’oggetto è troppo lungo: al più 200 caratteri.')
ok('con un a capo: no (dice qualcosa)', typeof cosaNonVaOggetto('Il certificato\nBcc: x@y.it') === 'string', true)
ok('{cognome}: no', cosaNonVaOggetto('Il certificato di {cognome}'), '{cognome} non si può usare nell’oggetto: solo {nome} ed {entro}.')
ok('{link} nell\'oggetto: no', cosaNonVaOggetto('Qui {link}'), '{link} non si può usare nell’oggetto: solo {nome} ed {entro}.')

console.log('\n3. il testo (4000 caratteri, solo {nome} {entro} {link}, {link} obbligatorio)')
ok('con i tre segnaposto va bene', cosaNonVaTesto('Per {nome} entro il {entro}: {link}'), undefined)
ok('vuoto: no', cosaNonVaTesto(''), 'Scrivi il testo della mail.')
ok('4000 caratteri vanno bene', cosaNonVaTesto('{link}' + 'a'.repeat(3994)), undefined)
ok('4001: no', cosaNonVaTesto('{link}' + 'a'.repeat(3995)), 'Il testo è troppo lungo: al più 4000 caratteri.')
ok('{cognome}: no', cosaNonVaTesto('Il certificato di {nome} {cognome}: {link}'), '{cognome} non si può usare: solo {nome}, {entro} e {link}.')
ok('senza {link}: no', cosaNonVaTesto('Portaci il certificato di {nome}.'), 'Manca {link}: senza, chi legge la mail non sa dove caricarlo.')

console.log('\n4. le parole: rigaMomento, nomiInsieme')
ok('7 giorni prima', rigaMomento(-7), '7 giorni prima del termine')
ok('1 giorno prima', rigaMomento(-1), '1 giorno prima del termine')
ok('il giorno', rigaMomento(0), 'il giorno del termine')
ok('7 giorni dopo', rigaMomento(7), '7 giorni dopo il termine')
ok('1 giorno dopo', rigaMomento(1), '1 giorno dopo il termine')
ok('tre nomi', nomiInsieme(['Marco', 'Giulia', 'Leo']), 'Marco, Giulia e Leo')
ok('due nomi', nomiInsieme(['Marco', 'Giulia']), 'Marco e Giulia')
ok('un nome', nomiInsieme(['Marco']), 'Marco')

console.log('\n5. il prossimo sollecito (oggi stesso conta, ieri no)')
const M = [-7, 0, 7]
ok('il giorno del primo momento: oggi stesso conta', prossimoSollecito('2026-12-12', '2026-12-05', M), { il: '2026-12-05', momento: -7 })
ok('il giorno dopo il primo: il prossimo è il giorno del termine', prossimoSollecito('2026-12-12', '2026-12-06', M), { il: '2026-12-12', momento: 0 })
ok('il giorno del termine, oggi stesso', prossimoSollecito('2026-12-12', '2026-12-12', M), { il: '2026-12-12', momento: 0 })
ok('il giorno dopo il termine: il +7', prossimoSollecito('2026-12-12', '2026-12-13', M), { il: '2026-12-19', momento: 7 })
ok('l\'ultimo, oggi stesso', prossimoSollecito('2026-12-12', '2026-12-19', M), { il: '2026-12-19', momento: 7 })
ok('il giorno dopo l\'ultimo: nessuno', prossimoSollecito('2026-12-12', '2026-12-20', M), null)
ok('momenti in disordine: stesso esito', prossimoSollecito('2026-12-12', '2026-12-06', [7, -7, 0]), { il: '2026-12-12', momento: 0 })
ok('a cavallo dell\'anno', prossimoSollecito('2026-12-30', '2027-01-06', M), { il: '2027-01-06', momento: 7 })
ok('un momento solo, già passato', prossimoSollecito('2026-12-12', '2026-12-12', [-7]), null)

console.log('\n6. la riga SOLLECITI PER EMAIL della scheda')
const base = { nome: 'Marco', accesi: true, sospesi: false, inAttesa: false, entro: '2026-12-12', oggi: '2026-11-25', momenti: M, a: 'laura.rossi@esempio.it' }
ok('senza termine la riga non c\'è', rigaSollecitiEmail({ ...base, entro: undefined }), null)
{
  const r = rigaSollecitiEmail({ ...base, momenti: [0] })
  ok('il prossimo, con il giorno e l\'indirizzo', r?.testo, 'Il prossimo il 12/12/2026, il giorno del termine, a laura.rossi@esempio.it')
  ok('e si può sospendere', r?.tasto, 'sospendi')
}
ok('il prossimo è il primo momento', rigaSollecitiEmail(base)?.testo, 'Il prossimo il 5/12/2026, 7 giorni prima del termine, a laura.rossi@esempio.it')
{
  const r = rigaSollecitiEmail({ ...base, sospesi: true })
  inizia('sospesi: a Marco non scriviamo più', r?.testo, 'Sospesi: a Marco non scriviamo più finché non li riattivi.')
  ok('sospesi: il tasto è Riattiva', r?.tasto, 'riattiva')
}
{
  const r = rigaSollecitiEmail({ ...base, a: null })
  inizia('senza email: lo trovi in DA FARE', r?.testo, 'Nessuna email: il 5/12')
  contiene('senza email: dice WhatsApp', r?.testo, 'WhatsApp')
}
{
  const r = rigaSollecitiEmail({ ...base, inAttesa: true })
  contiene('file in attesa: da confermare', r?.testo, 'da confermare')
  contiene('file in attesa: i solleciti sono fermi', r?.testo, 'i solleciti sono fermi')
}
{
  const r = rigaSollecitiEmail({ ...base, accesi: false })
  ok('spenti per tutti: dove si accendono', r?.testo, 'Spenti per tutti in IMPOSTAZIONI › GLI AVVISI.')
  ok('spenti: niente tasto Sospendi', r?.tasto, undefined)
}
{
  const r = rigaSollecitiEmail({ ...base, oggi: '2026-12-20' })
  inizia('passati tutti: nessun altro, l\'ultimo è partito il 19/12', r?.testo, 'Nessun altro: l’ultimo è partito il 19/12')
  ok('passati tutti: niente tasto Sospendi', r?.tasto, undefined)
}

console.log('\n7. la mail del sollecito (testoAvviso)')
const APP = 'https://app.officinedellosport.it/'
const L1 = 'https://app.officinedellosport.it/certificato/?l=6f1c2a00-0000-4000-8000-000000000001.firmaMarco'
const L2 = 'https://app.officinedellosport.it/certificato/?l=91b0e400-0000-4000-8000-000000000002.firmaGiulia'
const OGGETTO = 'Il certificato medico di {nome}'
const TESTO = 'Buongiorno,\nper {nome} ci manca il certificato medico, da portare entro il {entro}.\nPuoi caricarlo da qui: {link}\nA presto in palestra.'
const marco = { nome: 'Marco', entro: '2026-12-12', link: L1 }
const giulia = { nome: 'Giulia', entro: '2026-12-10', link: L2 }
{
  const m = testoAvviso({ tipo: 'sollecito_certificato', oggetto: OGGETTO, testo: TESTO, persone: [marco] }, APP)
  ok('una persona: oggetto', m.oggetto, 'Il certificato medico di Marco')
  contiene('una persona: {nome} ed {entro} nel testo', m.testo, 'per Marco ci manca il certificato medico, da portare entro il 12 dicembre.')
  contiene('una persona: {link} è l\'indirizzo', m.testo, `Puoi caricarlo da qui: ${L1}\nA presto`)
  ok('una persona: nessun segnaposto rimasto', /\{[a-z]+\}/.test(m.testo + m.oggetto + m.html), false)
  ok('una persona: non c\'è «Marco: » davanti al link', m.testo.includes('Marco: http'), false)
  contiene('html: il tasto con il nome', m.html, 'Carica il certificato di Marco')
  contiene('html: il tasto porta al link', m.html, L1)
  ok('html: un tasto solo', m.html.split('Carica il certificato di').length - 1, 1)
  contiene('html: la testata', m.html, 'OFFICINE DELLO SPORT · CERTIFICATO MEDICO')
  contiene('html: il piede', m.html, 'Mail automatica: per qualsiasi domanda rispondi a questa mail.')
}
{
  const m = testoAvviso({ tipo: 'sollecito_certificato', oggetto: OGGETTO, testo: TESTO, persone: [marco, giulia] }, APP)
  ok('due fratelli: i nomi insieme nell\'oggetto', m.oggetto, 'Il certificato medico di Marco e Giulia')
  contiene('due fratelli: {entro} è la data più vicina', m.testo, 'da portare entro il 10 dicembre.')
  contiene('due fratelli: una riga «nome: indirizzo» per ciascuno', m.testo, `Marco: ${L1}\nGiulia: ${L2}`)
  contiene('html: il tasto di Marco', m.html, 'Carica il certificato di Marco')
  contiene('html: il tasto di Giulia', m.html, 'Carica il certificato di Giulia')
  ok('html: due tasti', m.html.split('Carica il certificato di').length - 1, 2)
  contiene('html: il link di Giulia', m.html, L2)
}
{
  const m = testoAvviso({ tipo: 'sollecito_certificato', oggetto: OGGETTO, testo: '<b>Urgente</b> & subito: {link}', persone: [marco] }, APP)
  contiene('il testo della segreteria è escapato nell\'HTML', m.html, '&lt;b&gt;Urgente&lt;/b&gt; &amp; subito')
  ok('un <b> scritto dalla segreteria non diventa HTML', m.html.includes('<b>Urgente</b>'), false)
  contiene('nel testo semplice resta com\'è', m.testo, '<b>Urgente</b> & subito')
}
{
  const m = testoAvviso({ tipo: 'sollecito_certificato', oggetto: OGGETTO, testo: TESTO, persone: [{ ...marco, cognome: 'Rossi' }] }, APP)
  ok('il cognome non entra mai', (m.oggetto + m.testo + m.html).includes('Rossi'), false)
}
{
  const m = testoAvviso({ tipo: 'sollecito_certificato', oggetto: 'Per {nome}\r\nBcc: x@y.it', testo: TESTO, persone: [marco] }, APP)
  ok('l\'oggetto sta su una riga', /[\r\n]/.test(m.oggetto), false)
}

console.log('\nI momenti in IMPOSTAZIONI')
ok('primoLibero: con −7/0/7 il primo libero dopo è 1', lib(sc, 'primoLibero')([-7, 0, 7]), 1)
ok('primoLibero: con 1–3 è 4', lib(sc, 'primoLibero')([1, 2, 3]), 4)
ok('primoLibero: tutti i 60 giorni dopo presi → null', lib(sc, 'primoLibero')(Array.from({ length: 60 }, (_, i) => i + 1)), null)
ok('esempioMomenti: −7/0/7 in disordine, termine 12 dicembre', lib(sc, 'esempioMomenti')([7, -7, 0]), 'Con un termine il 12 dicembre: 5 dicembre, 12 dicembre, 19 dicembre.')
ok('esempioMomenti: a cavallo del mese', lib(sc, 'esempioMomenti')([-14, 30]), 'Con un termine il 12 dicembre: 28 novembre, 11 gennaio.')
ok('ultimoMomentoArrivato: termine 12/12, oggi 13/12 → il giorno del termine', lib(sc, 'ultimoMomentoArrivato')('2026-12-12', '2026-12-13', [-7, 0, 7]), { il: '2026-12-12', momento: 0 })
ok('ultimoMomentoArrivato: oggi prima del primo → null', lib(sc, 'ultimoMomentoArrivato')('2026-12-12', '2026-12-04', [-7, 0, 7]), null)

console.log(guai ? `\n${guai} prove non passano.` : '\nTutte le prove passano.')
process.exit(guai ? 1 : 0)
