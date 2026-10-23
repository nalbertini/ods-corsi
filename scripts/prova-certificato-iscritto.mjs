// ---------------------------------------------------------------------------
// Il certificato medico mandato dall'iscritto, senza browser né rete.
//
//   node scripts/prova-certificato-iscritto.mjs
//
// L'iscritto manda il file dalla tab IN REGOLA; resta «in attesa» finché la
// segreteria scrive la scadenza (o lo rifiuta). Qui le regole che stanno in
// `src/lib` e quelle della modalità prova, che devono dire gli stessi sì e gli
// stessi no del database (le prove vere sono in
// supabase/prova/certificato-iscritto.sql, con gli stessi casi).
//
// Nomi che il codice deve avere:
//   src/lib/certificatoIscritto.ts  cosaNonVaFileMandato, guaioMandaCertificato, boxCertificato
//   DatiIscritto.mandaCertificato(personaId, file)
//   SchedaIscritto.certificato.inAttesaIl   (AAAA-MM-GG, senza il nome del file)
//   segreteria (prova): certificatiDaControllare(), confermaCertificatoIscritto(id, scade), rifiutaCertificatoIscritto(id)
//   daFareTesti: la chiave 'certificati-ricevuti'
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una sezione che si ferma (manca una funzione) segna rosso e lascia provare le altre.
const prova = async (f) => {
  try {
    await f()
  } catch (e) {
    console.log('  ✗ si è fermata —', e instanceof Error ? e.message : e)
    guai++
  }
}
const errore = async (cosa, f, voluto) => {
  let dice = null
  try {
    await f()
  } catch (e) {
    dice = e instanceof Error ? e.message : String(e)
  }
  ok(cosa, dice, voluto)
}

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}
const m = await impacchetta(`
  export { creaIscrittoProva } from './src/lib/iscrittoProva'
  export { creaSegreteriaProva } from './src/lib/segreteriaProva'
  export { archivio } from './src/lib/archivioProva'
  export { seminaEsempi } from './src/lib/esempiProva'
  export { statoCertificato } from './src/lib/segreteria'
  export { TESTI_DA_FARE } from './src/lib/daFareTesti'
`)
// Il modulo nuovo non c'è ancora: si dice una volta, e le prove che lo usano falliscono per questo.
const nuovo = await impacchetta(`export * from './src/lib/certificatoIscritto'`).catch((e) => {
  console.log('  ✗ src/lib/certificatoIscritto.ts non c’è ancora —', String(e.message ?? e).split('\n')[0])
  guai++
  return {}
})
const f = (nome) => nuovo[nome] ?? (() => { throw new Error(`manca ${nome} in src/lib/certificatoIscritto.ts`) })

const g = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const oggi = g(new Date())
const fra = (n) => g(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + n))
const MB = 1024 * 1024
const file = (tipo, byte, nome = 'certificato') => new File([new Uint8Array(byte)], nome, { type: tipo })
const pdf = () => file('application/pdf', 2 * MB, 'visita.pdf')

m.seminaEsempi()
const io = m.creaIscrittoProva()
const s = m.creaSegreteriaProva()
const iscritti = m.archivio.dati.persone.filter((p) => p.ruolo === 'iscritto' && p.attiva)
const [chi, altro, terzo] = iscritti.map((p) => p.id)
const mio = async (id) => (await io.scheda(id)).certificato
const daControllare = async () => (await s.certificatiDaControllare()).map((x) => x.personaId).sort()

console.log('\n1. manda il file: resta in attesa, la data non si scrive')
await prova(async () => {
  await s.togliCertificato(chi)
  await io.mandaCertificato(chi, pdf())
  const c = await mio(chi)
  ok('la scadenza resta vuota', c.scade, undefined)
  ok('c’è il giorno dell’invio', c.inAttesaIl, oggi)
  ok('lo stato è «manca»: l’iscritto non è ancora in regola', m.statoCertificato({ certificato: c, natoIl: '1990-01-01' }, oggi), 'manca')
  ok('la segreteria lo ha da controllare', await daControllare(), [chi])
  ok('DA FARE ha una riga per i certificati ricevuti', typeof m.TESTI_DA_FARE['certificati-ricevuti']?.plurale, 'string')
})

console.log('\n2. un altro file prende il posto del primo')
await prova(async () => {
  await io.mandaCertificato(chi, file('image/png', MB, 'foto.png'))
  ok('uno solo da controllare', (await s.certificatiDaControllare()).filter((x) => x.personaId === chi).length, 1)
})

console.log('\n3. l’iscritto non vede il file né il nome')
await prova(async () => {
  const c = await mio(chi)
  ok('(c’è un invio in attesa da guardare)', c.inAttesaIl, oggi)
  ok('solo scadenza e giorno dell’invio', Object.keys(c).every((k) => ['scade', 'inAttesaIl'].includes(k)), true)
  ok('niente nome del file nella scheda', /visita|foto|certificato-|\.pdf|\.png/.test(JSON.stringify(await io.scheda(chi))), false)
  ok('e nel nucleo nemmeno', /visita|foto|certificato-|\.pdf|\.png/.test(JSON.stringify(await io.nucleo(chi))), false)
})

console.log('\n4. chi non c’è più non può mandare')
await prova(() => errore('una persona che non c’è', () => io.mandaCertificato('p-non-c-e', pdf()), 'Questa persona non è più fra gli iscritti'))

console.log('\n5. la segreteria conferma: la scadenza è quella scritta')
await prova(async () => {
  await errore('senza la data', () => s.confermaCertificatoIscritto(chi, ''), 'Serve la data di scadenza del certificato')
  await errore('data troppo lontana', () => s.confermaCertificatoIscritto(chi, fra(365 * 4)), "La data è troppo lontana: controlla l'anno.")
  ok('rifiutata la conferma, resta in attesa', await daControllare(), [chi])
  await s.confermaCertificatoIscritto(chi, fra(200))
  const c = await mio(chi)
  ok('la scadenza è quella scritta, e non è più in attesa', [c.scade, c.inAttesaIl], [fra(200), undefined])
  ok('stato valido', m.statoCertificato({ certificato: c, natoIl: '1990-01-01' }, oggi), 'valido')
  ok('non è più da controllare', await daControllare(), [])
  await errore('confermare senza niente in attesa', () => s.confermaCertificatoIscritto(chi, fra(200)), 'Non c’è un certificato da confermare')
  const pers = m.archivio.dati.persone.find((p) => p.id === chi)
  ok('il file è uno solo e c’è il giorno del caricamento', [!!pers.certificato.file, pers.certificato.caricatoIl], [true, oggi])
})

console.log('\n6. la segreteria rifiuta: il file sparisce e si può rimandare')
await prova(async () => {
  await s.togliCertificato(altro)
  await io.mandaCertificato(altro, pdf())
  await s.rifiutaCertificatoIscritto(altro)
  ok('niente in attesa', [(await mio(altro)).inAttesaIl, await daControllare()], [undefined, []])
  await errore('rifiutare senza niente in attesa', () => s.rifiutaCertificatoIscritto(altro), 'Non c’è un certificato da rifiutare')
  await io.mandaCertificato(altro, pdf())
  ok('rimandato', (await mio(altro)).inAttesaIl, oggi)
})

console.log('\n6b. la segreteria carica lei un certificato mentre ce n’è uno in attesa')
await prova(async () => {
  await io.mandaCertificato(altro, pdf())
  await s.caricaCertificato(altro, pdf(), fra(200))
  ok('il file mandato non resta in attesa, come nel database', [(await mio(altro)).inAttesaIl, await daControllare()], [undefined, []])
  await io.mandaCertificato(altro, pdf()) // la prova 7 riparte da un file in attesa
})

console.log('\n7. se la persona esce o si unisce a un’altra')
await prova(async () => {
  ok('(altro ha un file in attesa)', (await mio(altro)).inAttesaIl, oggi)
  await s.attivaPersona(altro, false)
  await s.attivaPersona(altro, true)
  ok('disattivata: il file in attesa non torna riattivandola', (await mio(altro)).inAttesaIl, undefined)
  await s.togliCertificato(terzo)
  await s.togliCertificato(altro)
  await io.mandaCertificato(altro, pdf())
  await s.unisciPersone(terzo, altro)
  ok('unite: quello in attesa passa a chi resta', await daControllare(), [terzo])
})

console.log('\n8. sotto i 6 anni e con l’avviso «in arrivo»')
await prova(async () => {
  const tra = (anni, giorni = 0) => {
    const d = new Date(oggi)
    return g(new Date(d.getFullYear() - anni, d.getMonth(), d.getDate() + giorni))
  }
  const scheda = (natoIl, scade) => ({ certificato: { scade }, natoIl, pagamento: { stato: 'pagato' } })
  const box = (natoIl, scade, attivo = true, inAttesaIl) => f('boxCertificato')({ ...scheda(natoIl, scade), certificato: { scade, inAttesaIl } }, oggi, attivo)
  ok('sotto i 6 anni: niente tasto', box(tra(4), undefined).tasto, null)
  ok('compie 6 anni fra un mese: il tasto c’è', box(tra(6, 15), undefined).tasto, 'manda')
  ok('manca: il tasto c’è', box('1990-01-01', undefined).tasto, 'manda')
  ok('scaduto: il tasto c’è', box('1990-01-01', fra(-10)).tasto, 'manda')
  ok('scade fra 20 giorni: il tasto c’è', box('1990-01-01', fra(20)).tasto, 'manda')
  ok('valido più di un mese: niente tasto', box('1990-01-01', fra(120)).tasto, null)
  ok('in attesa: «manda un altro file»', box('1990-01-01', undefined, true, oggi).tasto, 'manda-altro')
  ok('in attesa: il testo lo dice', box('1990-01-01', undefined, true, oggi).testo.startsWith('In attesa di conferma'), true)
})

console.log('\n9. il file non va: dice cosa fare, mai il testo dell’API')
await prova(async () => {
  const non = f('cosaNonVaFileMandato')
  ok('un PDF di 2 MB va', non(pdf()), null)
  ok('un JPG e un PNG vanno', [non(file('image/jpeg', MB)), non(file('image/png', MB))], [null, null])
  ok('12 MB è troppo', non(file('application/pdf', 12 * MB)), 'Il file è troppo grande: al massimo 5 MB')
  ok('5 MB esatti vanno, uno di più no', [non(file('application/pdf', 5 * MB)), non(file('application/pdf', 5 * MB + 1))], [null, 'Il file è troppo grande: al massimo 5 MB'])
  ok('un tipo che non va', non(file('application/zip', MB)), 'Questo tipo di file non va: serve una foto o un PDF')
  ok('un file vuoto', non(file('application/pdf', 0)), 'Il file è vuoto: scegline un altro')
  const dice = (e) => f('guaioMandaCertificato')(e).message
  ok('senza rete', dice({ message: 'TypeError: Failed to fetch' }), 'Il server non risponde: c’è rete? Riprova fra poco')
  ok('la funzione non c’è sul database: dice di andare in segreteria', dice({ code: 'PGRST202', message: 'Could not find the function public.iscritto_manda_certificato' }), 'Mandare il certificato da qui non è ancora attivo: portalo in segreteria')
  ok('non è una persona sua', dice({ code: '42501', message: 'permission denied' }), 'Non puoi mandare il certificato di questa persona')
  ok('altro: niente testo dell’API', dice({ code: 'XX000', message: 'relation "storage.objects" boom' }), 'Il certificato non è partito: riprova fra poco')
})

console.log('\n10. il database senza il file nuovo')
await prova(async () => {
  const b = f('boxCertificato')({ certificato: {}, natoIl: '1990-01-01', pagamento: { stato: 'pagato' } }, oggi, false)
  ok('niente tasto', b.tasto, null)
  ok('il testo manda in segreteria', /segreteria/.test(b.testo), true)
})

console.log('\n11. la guida')
await prova(async () => {
  const guida = readFileSync('guida/iscritti.md', 'utf8').replace(/\s+/g, ' ')
  ok('non dice più che il file non si vede mai', /il file del certificato lo vede solo la segreteria: qui c'è solo la data/i.test(guida), false)
  ok('dice che il file si manda e resta in attesa', /in attesa di conferma/i.test(guida), true)
})

console.log(guai ? `\n${guai} da sistemare` : '\nTutto a posto')
process.exit(guai ? 1 : 0)
