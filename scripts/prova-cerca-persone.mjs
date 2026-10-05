// ---------------------------------------------------------------------------
// Le prove, senza browser: «Aggiungi chi prova» cerca fra tutte le persone.
//
//   node scripts/prova-cerca-persone.mjs
//
// La prova dell'app rifà in TypeScript le regole di `supabase/43-cerca-persone.sql`:
// iscritti attivi di ogni corso, anche chi non ha mai provato; mai personale
// né disattivati; dalla terza lettera di una parola; al massimo ventuno; i
// corsi di oggi; nessun telefono. In più, quel che dice la pagina: poco
// scritto, nessuno, ce ne sono altri, già in questo appello, senza rete,
// ricerca non attiva, e l'avviso di chi ha lo stesso nome. Le stesse cose,
// dal lato del database, le prova `supabase/prova/cerca-persone.sql`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: "export { creaDatiProva } from './src/lib/datiProva'; export { archivio } from './src/lib/archivioProva'; export * from './src/lib/prove'",
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

const m = await import(modulo)
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const d = m.creaDatiProva()
const dati = m.archivio.dati
const oggi = new Date()
const giorno = (n) => {
  const x = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + n)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const [corsoA, corsoB] = dati.corsi
// Persone inventate, con id loro: la ricerca deve trovarle fra tutte quelle di prova.
const nuova = (id, nome, cognome, altro = {}) => dati.persone.push({ id, nome, cognome, ruolo: 'iscritto', attiva: true, creataIl: giorno(-30), ...altro })
nuova('t-1', 'Ginevra', 'Zanzibar', { telefono: '333 7654321' })
nuova('t-2', 'Ginevra', 'Zeffiri')
nuova('t-3', 'Ottavio', "Dell'Orto")
nuova('t-4', 'Dora', 'Zanardi', { attiva: false })
nuova('t-5', 'Pietro', 'Zagaglia')
dati.persone.push({ id: 't-6', nome: 'Zeno', cognome: 'Zanzotto', ruolo: 'istruttore', attiva: true, creataIl: giorno(-30) })
dati.iscrizioni.push(
  { corsoId: corsoA.id, personaId: 't-1', dal: giorno(-30) },
  { corsoId: corsoB.id, personaId: 't-1', dal: giorno(-30) },
  { corsoId: corsoB.id, personaId: 't-2', dal: giorno(-90), al: giorno(-1) },
)
const trova = async (s) => d.cercaPersone(s)
const nomi = async (s) => (await trova(s)).map((p) => `${p.nome} ${p.cognome}`)

console.log('\n1. la ricerca su tutte le persone')
{
  const uno = (await trova('zanz')).find((p) => p.id === 't-1')
  ok('«zanz» trova chi è iscritto a due corsi, coi corsi di oggi', [uno?.nome, uno?.cognome, uno?.corsi], ['Ginevra', 'Zanzibar', [corsoA.nome, corsoB.nome].sort((a, b) => a.localeCompare(b, 'it'))])
  ok('il telefono non c\'è', Object.keys(uno).sort(), ['corsi', 'cognome', 'id', 'nome'].sort())
  ok('chi non ha mai provato né ha corsi si trova lo stesso, con corsi vuoti', (await trova('zagaglia')).map((p) => p.corsi), [[]])
  ok("l'iscrizione finita ieri non si dice", (await trova('zeffiri'))[0].corsi, [])
  const ginevre = await trova('ginevra')
  ok('chi ha lo stesso nome si trova tutto, in ordine di cognome', [ginevre.length > 2, ginevre.map((p) => p.cognome).join() === [...ginevre.map((p) => p.cognome)].sort((a, b) => a.localeCompare(b, 'it')).join()], [true, true])
  ok('e le mie due, una dopo l\'altra', ginevre.filter((p) => p.id === 't-1' || p.id === 't-2').map((p) => p.cognome), ['Zanzibar', 'Zeffiri'])
  ok('nome e cognome, al contrario', await nomi('zanzibar ginevra'), ['Ginevra Zanzibar'])
  ok('maiuscole e accenti non contano', await nomi('ZANZÌBAR'), ['Ginevra Zanzibar'])
  ok("l'apostrofo si può scrivere in due modi, o non scrivere", [await nomi("dell'or"), await nomi('dell’or'), await nomi('dellorto')], [["Ottavio Dell'Orto"], ["Ottavio Dell'Orto"], ["Ottavio Dell'Orto"]])
  ok('chi è disattivato non compare', await nomi('zanardi'), [])
  ok('un istruttore nemmeno', await nomi('zanzotto'), [])
  ok('la segreteria nemmeno', await nomi('segreteria'), [])
}

console.log('\n2. la soglia e il tetto')
{
  ok('«gi» è troppo poco', await nomi('gi'), [])
  ok('due parole corte non bastano: «gi za»', await nomi('gi za'), [])
  ok('niente scritto: nessuno', [await nomi(''), await nomi('   ')], [[], []])
  ok('% e _ non sono jolly', [await nomi('%%%'), await nomi('___')], [[], []])
  ok('oltre cento lettere non si cerca, come nel database', [await nomi('zanzibar' + ' '.repeat(100)), await nomi('zanzibar' + ' '.repeat(90))], [[], ['Ginevra Zanzibar']])
  for (let i = 1; i <= 30; i++) nuova(`t-p${i}`, 'Provante', `Numero${String(i).padStart(3, '0')}`)
  const tanti = await trova('provante')
  ok('trenta che somigliano: ne arrivano ventuno, i primi per cognome', [tanti.length, tanti[0].cognome, tanti[20].cognome], [21, 'Numero001', 'Numero021'])
}

console.log('\n3. cosa dice la pagina')
{
  const g = new Map([['t-1', 'iscritto'], ['t-2', 'prova']])
  const persone = [
    { id: 't-1', nome: 'Ginevra', cognome: 'Zanzibar', corsi: ['Judo 2'] },
    { id: 't-2', nome: 'Ginevra', cognome: 'Zeffiri', corsi: [] },
    { id: 't-5', nome: 'Pietro', cognome: 'Zagaglia', corsi: [] },
  ]
  const q = (o) => m.trovateDa({ testo: 'gin', risposta: { testo: 'gin', trovati: persone }, giaQui: g, ...o })
  const senza = { risposta: undefined }
  ok('niente scritto: invita a scrivere', q({ testo: '', ...senza }).riga, 'Scrivi il nome o il cognome di chi viene a provare.')
  ok('«gi»: dice che ne servono tre, non «nessuno»', [q({ testo: 'gi', ...senza }).riga, q({ testo: 'gi', ...senza }).aMano], ['Scrivi almeno tre lettere del nome o del cognome.', false])
  ok('scritto e non ancora risposto: cerco', q(senza).riga, 'Cerco…')
  ok('risposta vuota: nessuno, e si offre il nome a mano', [q({ risposta: { testo: 'gin', trovati: [] } }).riga, q({ risposta: { testo: 'gin', trovati: [] } }).aMano], ['Nessuno con questo nome.', true])
  const r = q({})
  ok('i risultati, con chi è già qui', r.voci.map((v) => [v.id, v.qui]), [['t-1', 'iscritto'], ['t-2', 'prova'], ['t-5', null]])
  ok("chi è iscritto a questa lezione lo dice dov'è", r.voci[0].perche, 'È iscritto a questa lezione: lo trovi in ISCRITTI.')
  ok('chi è già in prova lo dice', r.voci[1].perche, 'È già in prova in questa lezione.')
  ok('è la stessa frase anche per la pagina del doppione', [m.perCheGiaQui('iscritto'), m.perCheGiaQui('prova')], [r.voci[0].perche, r.voci[1].perche])
  ok('chi si può aggiungere non ha un perché', r.voci[2].perche, null)
  ok('con dei risultati il nome a mano non si offre da sé', [r.aMano, r.riga], [false, null])
  const molti = Array.from({ length: 21 }, (_, i) => ({ id: `x${i}`, nome: 'Mario', cognome: `Rossi${i}`, corsi: [] }))
  const mm = q({ testo: 'mar', risposta: { testo: 'mar', trovati: molti } })
  ok('ventuno: se ne mostrano venti e si dice che ce ne sono altri', [mm.voci.length, mm.riga], [20, 'Ce ne sono altri: scrivi più lettere, o il cognome.'])
  // La risposta e l'errore sono di un testo: scrivendo ancora, quelli vecchi non contano.
  ok('una risposta di un testo vecchio non vale: cerco', q({ testo: 'ginev', risposta: { testo: 'gin', trovati: persone } }).riga, 'Cerco…')
  ok('un errore di un testo vecchio non vale: cerco', q({ testo: 'ginev', risposta: undefined, fallita: { testo: 'gin', guaio: new Error('x') } }).riga, 'Cerco…')
  const rete = q({ risposta: undefined, fallita: { testo: 'gin', guaio: new Error('Failed to fetch') } })
  ok('senza rete: scrivi a mano, e il nome a mano si offre', [rete.riga, rete.aMano], ['Senza rete non si vede chi è già iscritto: scrivi nome e cognome.', true])
  const manca = q({ risposta: undefined, fallita: { testo: 'gin', guaio: new Error(m.RICERCA_NON_ATTIVA) } })
  ok('senza il file nuovo: lo dice senza nominare file', [manca.riga, manca.aMano], ['La ricerca fra tutti non è disponibile: scrivi nome e cognome, e avvisa la segreteria.', true])
  ok('e non mostra mai il testo grezzo del server', q({ risposta: undefined, fallita: { testo: 'gin', guaio: new Error('JWT expired') } }).riga.includes('JWT'), false)
  ok('con poco scritto il nome a mano non si offre da sé', q({ testo: 'gi', ...senza }).aMano, false)
}

console.log('\n4. lo stesso nome già nel database')
{
  const persone = [
    { id: 'a', nome: 'Marco', cognome: 'Rossi', corsi: ['Judo 2'] },
    { id: 'b', nome: 'Marcello', cognome: 'Rossi', corsi: [] },
  ]
  ok('stesso nome e cognome: avvisa', m.doppioneDi({ nome: 'Marco', cognome: 'Rossi' }, persone)?.id, 'a')
  ok('maiuscole, spazi e accenti non contano', m.doppioneDi({ nome: '  MARCÒ ', cognome: 'rossi ' }, persone)?.id, 'a')
  ok('un nome che comincia uguale non è lo stesso', m.doppioneDi({ nome: 'Marc', cognome: 'Rossi' }, persone), null)
  ok('nome e cognome scambiati sono lo stesso', m.doppioneDi({ nome: 'Rossi', cognome: 'Marco' }, persone)?.id, 'a')
  ok('nessuno uguale: niente avviso', m.doppioneDi({ nome: 'Luca', cognome: 'Bianchi' }, persone), null)
  ok('la frase dell\'avviso, come si legge un elenco, dice dove è iscritto', m.dicePersona(persone[0]), 'Rossi Marco (Judo 2)')
  ok('senza corsi, solo il nome', m.dicePersona(persone[1]), 'Rossi Marcello')
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
