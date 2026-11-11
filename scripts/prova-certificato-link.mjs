// ---------------------------------------------------------------------------
// Il certificato che si carica da un link, senza password: le regole di
// `src/lib/certificatoLink.ts` e il link nel sollecito di `src/lib/sollecito.ts`.
// Il database lo prova `supabase/prova/certificato-link.sql`, la Edge Function
// `scripts/prova-edge-certificato.mjs`.
//
//   node scripts/prova-certificato-link.mjs
//
// Il codice del link, cosa non va in una scadenza (coi bordi: oggi sì, ieri no,
// 3 anni sì, 3 anni e un giorno no), i testi della pagina, gli esiti, la riga
// dello storico dei solleciti e il link nel messaggio WhatsApp.
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

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '', pathname: '/' }, addEventListener() {} }

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// Il modulo che ancora non c'è non ferma la prova: la rende rossa dicendolo.
let cl = {}
try {
  cl = await impacchetta("export * from './src/lib/certificatoLink'")
} catch (e) {
  console.log('  ✗ manca src/lib/certificatoLink.ts —', (e.errors?.[0]?.text ?? e.message).split('\n')[0])
  guai++
}
const lib = (nome) => (typeof cl[nome] === 'function' ? cl[nome] : () => `manca ${nome}`)
const codiceDalLink = lib('codiceDalLink')
const cosaNonVaScadenza = lib('cosaNonVaScadenza')
const testiLink = lib('testiLink')
const esitoLink = lib('esitoLink')
const rigaStoricoSollecito = lib('rigaStoricoSollecito')
const sol = await impacchetta("export { sollecitoDi } from './src/lib/sollecito'")

const ID = '0b5f2c7e-3a41-4f6e-9d1c-7a8e5b2c9f10'
const FIRMA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO-_'.slice(0, 43)

console.log('\n1. codiceDalLink: ?l=<uuid>.<43 caratteri base64url>')
ok('il codice giusto', codiceDalLink(`?l=${ID}.${FIRMA}`), `${ID}.${FIRMA}`)
ok('con altri parametri prima e dopo', codiceDalLink(`?x=1&l=${ID}.${FIRMA}&y=2`), `${ID}.${FIRMA}`)
ok('niente l', codiceDalLink('?x=1'), null)
ok('niente di niente', codiceDalLink(''), null)
ok('l vuoto', codiceDalLink('?l='), null)
ok('senza la firma', codiceDalLink(`?l=${ID}`), null)
ok('senza l\'id', codiceDalLink(`?l=.${FIRMA}`), null)
ok('l\'id non è un uuid', codiceDalLink(`?l=non-un-uuid.${FIRMA}`), null)
ok('la firma di 42 caratteri', codiceDalLink(`?l=${ID}.${FIRMA.slice(0, 42)}`), null)
ok('la firma di 44 caratteri', codiceDalLink(`?l=${ID}.${FIRMA}A`), null)
ok('la firma col = in fondo (base64 con il riempimento)', codiceDalLink(`?l=${ID}.${FIRMA.slice(0, 42)}=`), null)
ok('la firma col + (base64 e non base64url)', codiceDalLink(`?l=${ID}.${FIRMA.slice(0, 42)}+`), null)
ok('la firma con una barra', codiceDalLink(`?l=${ID}.${FIRMA.slice(0, 42)}/`), null)
ok('un pezzo in più dopo la firma', codiceDalLink(`?l=${ID}.${FIRMA}.altro`), null)

console.log('\n2. cosaNonVaScadenza: oggi 11 novembre 2026')
const OGGI = '2026-11-11'
const SCADUTO = 'Questo certificato è già scaduto: serve quello nuovo.'
const LONTANO = 'La data è troppo lontana: controlla l’anno.'
ok('vuota', cosaNonVaScadenza('', OGGI), 'Scrivi quando scade il certificato.')
ok('ieri: già scaduto', cosaNonVaScadenza('2026-11-10', OGGI), SCADUTO)
ok('oggi stesso va bene', cosaNonVaScadenza('2026-11-11', OGGI), null)
ok('domani', cosaNonVaScadenza('2026-11-12', OGGI), null)
ok('fra un anno', cosaNonVaScadenza('2027-11-11', OGGI), null)
ok('fra 3 anni esatti va bene', cosaNonVaScadenza('2029-11-11', OGGI), null)
ok('fra 3 anni e un giorno: troppo lontana', cosaNonVaScadenza('2029-11-12', OGGI), LONTANO)
ok('l\'anno scritto male (2207)', cosaNonVaScadenza('2207-11-11', OGGI), LONTANO)

console.log('\n3. testiLink: titolo, etichetta e testo')
const marco = { nome: 'Marco', iniziale: 'R', tipo: 'normale', entro: '2026-12-12' }
ok('normale, col termine', testiLink(marco), {
  titolo: 'Certificato medico di Marco R.',
  etichetta: 'NON AGONISTICO · ENTRO IL 12 DICEMBRE',
  testo: 'Carica una foto o il PDF del certificato e scrivi quando scade. La segreteria lo controlla: fino ad allora Marco viene alle lezioni.',
})
ok('agonistico, col termine', testiLink({ ...marco, tipo: 'agonistico' }), {
  titolo: 'Certificato medico di Marco R.',
  etichetta: 'AGONISTICO · ENTRO IL 12 DICEMBRE',
  testo: 'Per judo, aikido e lotta, dai 12 anni serve il certificato agonistico. La segreteria lo controlla: fino ad allora Marco viene alle lezioni.',
})
ok('senza termine: solo il tipo', [testiLink({ nome: 'Marco', iniziale: 'R', tipo: 'normale' })?.etichetta, testiLink({ nome: 'Marco', iniziale: 'R', tipo: 'agonistico' })?.etichetta], ['NON AGONISTICO', 'AGONISTICO'])
ok('il termine il 1 gennaio: «1 GENNAIO», senza zero', testiLink({ ...marco, entro: '2027-01-01' })?.etichetta, 'NON AGONISTICO · ENTRO IL 1 GENNAIO')
ok('l’8 e l’11: l’articolo si elide', [testiLink({ ...marco, entro: '2026-12-08' })?.etichetta, testiLink({ ...marco, entro: '2026-12-11' })?.etichetta], ['NON AGONISTICO · ENTRO L’8 DICEMBRE', 'NON AGONISTICO · ENTRO L’11 DICEMBRE'])

console.log('\n4. esitoLink')
ok('già arrivato', esitoLink({ stato: 'arrivato', nome: 'Marco' }), { titolo: 'GIÀ ARRIVATO', tono: 'fatto', testi: ['Il certificato di Marco è già arrivato ed è a posto. Grazie.'] })
ok('il link non vale', esitoLink({ stato: 'non_vale' }), { titolo: 'LINK NON VALIDO', tono: 'avviso', testi: ['Questo link non vale più: scrivi alla segreteria o passa in palestra.'] })
ok('ricevuto', esitoLink({ stato: 'ricevuto', scade: '2027-11-20' }), {
  titolo: 'RICEVUTO',
  tono: 'fatto',
  testi: ['La segreteria lo controlla: non devi fare altro. Se qualcosa non va, ti scriviamo.', 'Scade il 20/11/2027, come hai scritto.'],
})

console.log('\n5. rigaStoricoSollecito: date g/m/aaaa nel fuso di Roma')
ok('WhatsApp con chi l\'ha segnato, senza link', rigaStoricoSollecito({ quando: '2026-12-05T10:00:00Z', da: 'Laura', canale: 'whatsapp', conLink: false }), { testo: 'WhatsApp · 5/12/2026 da Laura' })
ok('email, senza chi: «Email · 5/12/2026»', rigaStoricoSollecito({ quando: '2026-12-05T10:00:00Z', canale: 'email', conLink: false }), { testo: 'Email · 5/12/2026' })
ok('WhatsApp senza chi', rigaStoricoSollecito({ quando: '2026-12-05T10:00:00Z', canale: 'whatsapp', conLink: false }), { testo: 'WhatsApp · 5/12/2026' })
ok('col link aperto', rigaStoricoSollecito({ quando: '2026-12-05T10:00:00Z', da: 'Laura', canale: 'whatsapp', conLink: true, apertoIl: '2026-12-06T09:00:00Z' }), { testo: 'WhatsApp · 5/12/2026 da Laura', link: 'link aperto il 6/12/2026' })
ok('col link non aperto', rigaStoricoSollecito({ quando: '2026-12-05T10:00:00Z', da: 'Laura', canale: 'whatsapp', conLink: true }), { testo: 'WhatsApp · 5/12/2026 da Laura', link: 'link non aperto' })
ok('il fuso di Roma: le 23:30 UTC di inverno sono già il giorno dopo', rigaStoricoSollecito({ quando: '2026-12-05T23:30:00Z', canale: 'whatsapp', conLink: false })?.testo, 'WhatsApp · 6/12/2026')
ok('…e d\'estate le 22:30 UTC', rigaStoricoSollecito({ quando: '2026-07-31T22:30:00Z', canale: 'whatsapp', conLink: false })?.testo, 'WhatsApp · 1/8/2026')
ok('la data dell\'apertura nel fuso di Roma', rigaStoricoSollecito({ quando: '2026-12-05T10:00:00Z', canale: 'whatsapp', conLink: true, apertoIl: '2026-12-31T23:30:00Z' })?.link, 'link aperto il 1/1/2027')

console.log('\n6. il sollecito col link per caricare il certificato')
const ADESSO = new Date(2026, 9, 21, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [ADESSO]))
  }
  static now() {
    return ADESSO
  }
}
const OGGI_S = '2026-10-21'
const LINK = 'https://esempio.it/certificato/?l=' + ID + '.' + FIRMA
const paolo = (x = {}) => ({
  id: 'p-sollecito',
  nome: 'Paolo',
  cognome: 'Bianchi',
  telefono: '333 123 4567',
  attiva: true,
  creataIl: '2026-09-01',
  iscrizioni: [],
  certificato: { scade: '2027-09-01', conFile: true },
  documento: true,
  pagamento: { stato: 'pagato' },
  quote: [],
  natoIl: '1980-04-02',
  ...x,
})
const conCert = (cert) => paolo({ certificato: cert })
const di = (p, opz = { linkCertificato: LINK }) => (typeof sol.sollecitoDi === 'function' ? sol.sollecitoDi(p, undefined, 3000, OGGI_S, opz) : null)
const CHIUSA = 'Puoi passare in segreteria o rispondere qui. Grazie!'
const DA_QUI = `Puoi caricarlo da qui, senza password: ${LINK} ${CHIUSA}`
const SALUTO = 'Ciao Paolo, ti scriviamo dalla segreteria del Centro Judo'
ok('manca: il testo con il link', di(conCert({ conFile: false }))?.testo, `${SALUTO}: manca il certificato medico. ${DA_QUI}`)
ok('scaduto', di(conCert({ scade: '2026-03-12', conFile: true }))?.testo, `${SALUTO}: il certificato medico è scaduto il 12 marzo 2026. ${DA_QUI}`)
ok('in scadenza', di(conCert({ scade: '2026-11-05', conFile: true }))?.testo, `${SALUTO}: il certificato medico scade il 5 novembre 2026. ${DA_QUI}`)
ok('atteso (nel termine)', di(conCert({ conFile: false, entro: '2026-11-30' }))?.testo, `${SALUTO}: il certificato medico va portato entro il 30 novembre 2026. ${DA_QUI}`)
ok('quota e certificato: il link c\'è, in fondo', di(paolo({ pagamento: { stato: 'da_pagare' }, certificato: { conFile: false } }))?.testo, `${SALUTO}: la quota associativa è da pagare (30,00 €) e manca il certificato medico. ${DA_QUI}`)
ok('senza linkCertificato il testo è quello di prima', di(conCert({ conFile: false }), {})?.testo, `${SALUTO}: manca il certificato medico. ${CHIUSA}`)
ok('solo la quota: il link non entra', di(paolo({ pagamento: { stato: 'da_pagare' } }))?.testo, `${SALUTO}: la quota associativa è da pagare (30,00 €). ${CHIUSA}`)
ok('i motivi non cambiano col link', di(conCert({ conFile: false }))?.motivi, di(conCert({ conFile: false }), {})?.motivi)
ok('il link wa.me porta lo stesso testo, con il link dentro', decodeURIComponent((di(conCert({ conFile: false }))?.link ?? '').split('?text=')[1] ?? ''), di(conCert({ conFile: false }))?.testo)
const marcoRossi = paolo({ nome: 'Marco', cognome: 'Rossi', natoIl: '2017-05-01', certificato: { scade: '2026-03-12', conFile: true } })
ok('un minorenne: il link c\'è anche nel messaggio al genitore', di(marcoRossi)?.testo.includes(`senza password: ${LINK} ${CHIUSA}`), true)

console.log('\n7. in modalità prova, come 142-certificato-link.sql')
{
  const m = await impacchetta("export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaDatiProva } from './src/lib/datiProva'; export { seminaEsempi } from './src/lib/esempiProva'")
  m.creaDatiProva()
  m.seminaEsempi()
  const s = m.creaSegreteriaProva()
  const [uno, due] = (await s.persone()).filter((p) => p.attiva)
  const l1 = await s.linkCertificato(uno.id)
  ok('il link ha la forma di quello vero', !!l1 && codiceDalLink(`?l=${l1.codice}`) === l1.codice, true)
  ok('lo stesso link finché vale', (await s.linkCertificato(uno.id))?.id, l1?.id)
  ok('un\'altra persona ha un link suo', (await s.linkCertificato(due.id))?.id !== l1?.id, true)
  let rifiuto = null
  await s.segnaSollecitoLink(due.id, l1.id).catch((e) => (rifiuto = e.message))
  ok('il link di un\'altra persona non si segna', rifiuto, 'Il link non è di questa persona.')
  await s.segnaSollecito(uno.id)
  await s.segnaSollecitoLink(uno.id, l1.id)
  const storia = await s.sollecitiDi(uno.id)
  ok('la storia: due solleciti, uno col link', [storia.length, storia.filter((x) => x.conLink).length, storia.every((x) => x.canale === 'whatsapp')], [2, 1, true])
}

console.log(guai ? `\n${guai} prove non passano.` : '\nTutte le prove passano.')
process.exit(guai ? 1 : 0)
