// ---------------------------------------------------------------------------
// I dati e le tariffe dei tecnici, senza browser.
//
//   node scripts/prova-tariffe.mjs
//
// Per pagare un tecnico servono le province e l'IBAN nella sua anagrafica e
// una tariffa oraria per ogni corso che insegna (`src/lib/tariffe.ts`,
// `supabase/78-tariffe-tecnici.sql`, provato da
// `supabase/prova/tariffe-tecnici.sql`). Qui: i controlli dei campi nuovi,
// gli euro scritti a mano, le righe della scheda (i corsi di cui è titolare e
// quelli fatti da sostituto), la segreteria di prova e quella col database.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const importa = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
    // Senza Vite `import.meta.env` non c'è: vuoto vuol dire «modalità prova».
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
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che non c'è, o che si rompe, è un caso rosso, non la prova ferma.
const prova = async (cosa, f, voluto) => {
  let avuto
  try {
    avuto = await f()
  } catch (e) {
    avuto = `ERRORE: ${e.message}`
  }
  ok(cosa, avuto, voluto)
}
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}
// Un rifiuto della regola, non la funzione che manca.
const rifiuta = async (f) => {
  try {
    await f()
    return 'accettato'
  } catch (e) {
    return e instanceof TypeError ? `ERRORE: ${e.message}` : 'rifiutato'
  }
}

let t = {}
try {
  t = await importa("export * from './src/lib/tariffe'")
} catch (e) {
  console.log('  ✗ src/lib/tariffe.ts non si carica —', e.errors?.[0]?.text ?? e.message)
  guai++
}
const m = await importa(
  "export { conDatiDellaSegreteria, cosaNonVaAnagrafica, pulisciAnagrafica } from './src/lib/segreteria'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'",
)

console.log('\n1. le province e l\'IBAN nell\'anagrafica')
{
  const PROVINCIA = 'La provincia è la sigla di due lettere'
  const IBAN = "L'IBAN non è giusto"
  ok('la provincia «TOR» no', m.cosaNonVaAnagrafica({ provincia: 'TOR' }), PROVINCIA)
  ok('la provincia «t» no', m.cosaNonVaAnagrafica({ provincia: 't' }), PROVINCIA)
  ok('la provincia di nascita «TOR» no', m.cosaNonVaAnagrafica({ provinciaNascita: 'TOR' }), PROVINCIA)
  ok('un IBAN troppo corto no', m.cosaNonVaAnagrafica({ iban: 'IT60X0542' }), IBAN)
  ok('un IBAN senza le cifre di controllo no', m.cosaNonVaAnagrafica({ iban: 'ITXXX0542811101000000123456' }), IBAN)
  ok('una sigla che non è una provincia no («CU»)', m.cosaNonVaAnagrafica({ provincia: 'CU' }), PROVINCIA)
  ok('una provincia che non c\'è più va bene per la nascita («CI», Carbonia-Iglesias)', m.cosaNonVaAnagrafica({ provinciaNascita: 'CI' }), null)
  ok('estero per la nascita («EE») sì', m.cosaNonVaAnagrafica({ provinciaNascita: 'EE' }), null)
  ok('un IBAN con una cifra sbagliata no (non torna il controllo)', m.cosaNonVaAnagrafica({ iban: 'IT61X0542811101000000123456' }), IBAN)
  ok('un IBAN maltese giusto sì', m.cosaNonVaAnagrafica({ iban: 'MT84MALT011000012345MTLCAST001S' }), null)
  ok('province e IBAN giusti vanno bene', m.cosaNonVaAnagrafica({ provinciaNascita: 'TO', provincia: 'AT', iban: 'IT60X0542811101000000123456' }), null)
  ok('la provincia scritta in minuscolo diventa maiuscola', m.pulisciAnagrafica({ provincia: 'to', provinciaNascita: ' at ' }), { provincia: 'TO', provinciaNascita: 'AT' })
  ok("l'IBAN perde gli spazi e diventa maiuscolo", m.pulisciAnagrafica({ iban: 'it60 x054 2811 1010 0000 0123 456' }).iban, 'IT60X0542811101000000123456')
  ok("e pulito l'IBAN va bene", m.cosaNonVaAnagrafica(m.pulisciAnagrafica({ iban: 'it60 x054 2811 1010 0000 0123 456', provincia: 'to' })), null)
}

console.log('\n1 bis. chi ha dati e tariffe: chi insegna, non la segreteria che non insegna')
{
  const r = await importa("export { insegna } from './src/lib/ruoli'")
  ok('un istruttore sì', r.insegna({ ruolo: 'istruttore' }), true)
  ok('la segreteria che non insegna no', r.insegna({ ruolo: 'staff' }), false)
  ok('la segreteria che insegna anche sì', r.insegna({ ruolo: 'staff', ancheIstruttore: true }), true)
  ok("l'amministrazione no", r.insegna({ ruolo: 'amministrazione' }), false)
}

console.log('\n2. gli euro scritti a mano, e come si leggono')
{
  for (const [testo, voluto] of [['15', 1500], ['15,50', 1550], ['15.5', 1550], ['0', null], ['-3', null], ['abc', null], ['', null]])
    await prova(`«${testo}» → ${voluto}`, () => t.centesimiDaEuro(testo), voluto)
  await prova('1500 centesimi: «15,00 € l’ora»', () => t.euroOra(1500), '15,00 € l’ora')
  await prova('perché non va: «1520» è oltre mille euro', () => t.cosaNonVaEuroOra('1520'), 'La tariffa è al massimo 1.000 € l’ora')
  await prova('perché non va: «abc»', () => t.cosaNonVaEuroOra('abc'), 'Scrivi gli euro l’ora, per esempio 15 o 15,50')
  await prova('perché non va: vuoto, niente da dire', () => t.cosaNonVaEuroOra(''), null)
  await prova('perché non va: «15,50» va bene', () => t.cosaNonVaEuroOra('15,50'), null)
  await prova('per correggerla, 1250 centesimi si scrivono «12,50»', () => t.euroDaScrivere(1250), '12,50')
}

console.log('\n3. le righe della scheda: una per corso, titolare, sostituto o non più')
{
  const corsi = [{ id: 'c-lotta', nome: 'Lotta 2' }, { id: 'c-judo', nome: 'Judo adulti' }, { id: 'c-aiki', nome: 'Aikido' }, { id: 'c-kara', nome: 'Karate' }]
  const pr = (corso, stato = 'confermata', personaId = 'io') => ({ corso, stato, personaId })
  await prova(
    'i corsi di cui è titolare e quelli fatti da sostituto, una volta sola, in ordine',
    () => t.righeTariffe('io', ['Lotta 2', 'Judo adulti'], [pr('Judo adulti'), pr('Aikido')], [{ corsoId: 'c-judo', corso: 'Judo adulti', centesimi: 1500 }], corsi),
    [
      { corso: 'Aikido', corsoId: 'c-aiki', perche: 'sostituto' },
      { corso: 'Judo adulti', corsoId: 'c-judo', centesimi: 1500, perche: 'titolare' },
      { corso: 'Lotta 2', corsoId: 'c-lotta', perche: 'titolare' },
    ],
  )
  await prova(
    'contano solo le sue presenze confermate: non quelle da confermare, rifiutate o di altri',
    () => t.righeTariffe('io', [], [pr('Aikido', 'da_confermare'), pr('Karate', 'rifiutata'), pr('Lotta 2', 'confermata', 'altro')], [], corsi),
    [],
  )
  await prova(
    'una tariffa di un corso che non insegna più e senza presenze non si perde',
    () => t.righeTariffe('io', ['Lotta 2'], [], [{ corsoId: 'c-kara', corso: 'Karate', centesimi: 1800 }], corsi),
    [
      { corso: 'Karate', corsoId: 'c-kara', centesimi: 1800, perche: 'non più' },
      { corso: 'Lotta 2', corsoId: 'c-lotta', perche: 'titolare' },
    ],
  )
  await prova("in ordine all'italiana: le lettere accentate al loro posto", () => t.righeTariffe('io', ['Zumba', 'Èquilibrio', 'Acro'], [], [], []).map((r) => r.corso), ['Acro', 'Èquilibrio', 'Zumba'])
  await prova('nessun corso, nessuna riga', () => t.righeTariffe('io', [], [], [], []), [])
}

console.log('\n3 bis. province e IBAN restano quelli della segreteria anche quando vince la richiesta')
{
  const seg = { provinciaNascita: 'TO', provincia: 'AT', iban: 'IT60X0542811101000000123456', comune: 'Asti' }
  await prova(
    'vince la richiesta: comune della richiesta, province e IBAN della segreteria',
    () => m.conDatiDellaSegreteria({ dati: { comune: 'Alba' }, da: 'modulo' }, seg),
    { dati: { comune: 'Alba', provinciaNascita: 'TO', provincia: 'AT', iban: 'IT60X0542811101000000123456' }, da: 'modulo' },
  )
  await prova('vince la segreteria: tutto come è', () => m.conDatiDellaSegreteria({ dati: seg, da: 'segreteria' }, seg), { dati: seg, da: 'segreteria' })
  await prova('niente dati: niente', () => m.conDatiDellaSegreteria(null, seg), null)
}

console.log('\n4. la segreteria di prova: le tariffe e i dati per il compenso')
{
  const s = m.creaSegreteriaProva()
  const chi = (await s.personale()).find((p) => p.corsi.includes('Judo 2'))
  ok('c\'è un tecnico titolare di Judo 2', !!chi, true)
  const judo = (await s.corsi()).find((c) => c.nome === 'Judo 2')
  await prova('senza tariffe, nessuna', () => s.tariffe(chi.id), [])
  await prova('scrive una tariffa', () => s.salvaTariffa(chi.id, judo.id, 1500), undefined)
  await prova('e rileggendo si vede', () => s.tariffe(chi.id), [{ corsoId: judo.id, corso: 'Judo 2', centesimi: 1500 }])
  await prova('la cambia', async () => (await s.salvaTariffa(chi.id, judo.id, 1550), s.tariffe(chi.id)), [{ corsoId: judo.id, corso: 'Judo 2', centesimi: 1550 }])
  ok('zero centesimi no', await rifiuta(() => s.salvaTariffa(chi.id, judo.id, 0)), 'rifiutato')
  ok('oltre mille euro l\'ora no', await rifiuta(() => s.salvaTariffa(chi.id, judo.id, 100001)), 'rifiutato')
  await prova('e la tariffa resta quella di prima', () => s.tariffe(chi.id), [{ corsoId: judo.id, corso: 'Judo 2', centesimi: 1550 }])
  await prova('con null la toglie', async () => (await s.salvaTariffa(chi.id, judo.id, null), s.tariffe(chi.id)), [])

  // Le province e l'IBAN del tecnico, poi il MODIFICA della scheda: parte dai dati letti e sostituisce.
  await prova(
    'salva province e IBAN, puliti',
    async () => (await s.salvaAnagrafica(chi.id, { provinciaNascita: 'to', provincia: 'at', iban: 'it60 x054 2811 1010 0000 0123 456', comune: 'Asti' }), (await s.anagraficaDi(chi.id))?.dati),
    { provinciaNascita: 'TO', provincia: 'AT', iban: 'IT60X0542811101000000123456', comune: 'Asti' },
  )
  ok('un IBAN sbagliato non si salva', await errore(() => s.salvaAnagrafica(chi.id, { iban: 'IT60X0542' })), "L'IBAN non è giusto")
  await prova(
    'MODIFICA del comune: province e IBAN restano',
    async () => {
      const letti = (await s.anagraficaDi(chi.id)).dati
      await s.salvaAnagrafica(chi.id, { ...letti, comune: 'Alba' }, true)
      return (await s.anagraficaDi(chi.id)).dati
    },
    { provinciaNascita: 'TO', provincia: 'AT', iban: 'IT60X0542811101000000123456', comune: 'Alba' },
  )
}

console.log('\n5. col database vero: le colonne nuove di anagrafiche e la tabella delle tariffe')
{
  const chiesto = []
  // Ogni catena finisce con la risposta della tabella; si annota cosa si scrive.
  const catena = (tabella, risposta) => {
    const c = new Proxy(() => c, {
      get: (_, k) =>
        k === 'then'
          ? (fatto, ko) => Promise.resolve(risposta).then(fatto, ko)
          : (...a) => (['upsert', 'insert', 'update', 'delete', 'select'].includes(k) && chiesto.push([tabella, k, a[0]]), c),
      apply: () => c,
    })
    return c
  }
  const righe = {
    richieste_iscrizione: { data: null, error: null },
    anagrafiche: { data: { comune: 'Asti', provincia: 'AT', provincia_nascita: 'TO', iban: 'IT60X0542811101000000123456', cambiata_il: '2026-09-01T10:00:00Z' }, error: null },
    tariffe_istruttori: { data: [{ corso_id: 'c1', centesimi_ora: 1500, corsi: { nome: 'Judo 2' } }], error: null },
  }
  const db = m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: (tabella) => catena(tabella, righe[tabella] ?? { data: null, error: null }),
    rpc: (f) => catena(f, { data: null, error: null }),
  })
  await prova(
    'legge province e IBAN',
    async () => (await db.anagraficaDi('p1'))?.dati,
    { comune: 'Asti', provinciaNascita: 'TO', provincia: 'AT', iban: 'IT60X0542811101000000123456' },
  )
  chiesto.length = 0
  await db.salvaAnagrafica('p1', { comune: 'Alba', provincia: 'cn', provinciaNascita: 'TO', iban: 'IT60X0542811101000000123456' }, true)
  const scritta = chiesto.find(([tab, k]) => tab === 'anagrafiche' && k === 'upsert')?.[2] ?? {}
  ok('il MODIFICA scrive province e IBAN', [scritta.provincia, scritta.provincia_nascita, scritta.iban], ['CN', 'TO', 'IT60X0542811101000000123456'])
  // Una richiesta di iscrizione accolta dopo i dati della segreteria: vince lei, ma IBAN e province restano.
  righe.richieste_iscrizione = { data: { comune: 'Alba', gestita_il: '2026-10-01T10:00:00Z', creata_il: '2026-09-30T10:00:00Z' }, error: null }
  await prova(
    'vince la richiesta più nuova, e province e IBAN restano',
    async () => await db.anagraficaDi('p1'),
    { dati: { comune: 'Alba', provinciaNascita: 'TO', provincia: 'AT', iban: 'IT60X0542811101000000123456' }, da: 'modulo' },
  )
  chiesto.length = 0
  await db.salvaAnagrafica('p1', (await db.anagraficaDi('p1')).dati, true)
  ok('e il MODIFICA che parte da lì non cancella l\'IBAN', chiesto.find(([tab, k]) => tab === 'anagrafiche' && k === 'upsert')?.[2]?.iban, 'IT60X0542811101000000123456')
  righe.richieste_iscrizione = { data: null, error: null }
  await prova('le tariffe col nome del corso', () => db.tariffe('p1'), [{ corsoId: 'c1', corso: 'Judo 2', centesimi: 1500 }])
  chiesto.length = 0
  await prova('scrive una tariffa', () => db.salvaTariffa('p1', 'c1', 1550), undefined)
  ok('in tariffe_istruttori, coi nomi delle colonne',
    chiesto.filter(([tab, k]) => tab === 'tariffe_istruttori' && k !== 'select').map(([, k, riga]) => [k, riga]),
    [['upsert', { persona_id: 'p1', corso_id: 'c1', centesimi_ora: 1550 }]])
  chiesto.length = 0
  ok('zero centesimi no, col messaggio giusto', await errore(() => db.salvaTariffa('p1', 'c1', 0)), 'La tariffa è un importo più grande di zero')
  ok('oltre mille euro no, col messaggio giusto', await errore(() => db.salvaTariffa('p1', 'c1', 100001)), 'La tariffa è al massimo 1.000 € l’ora')
  ok('e non parte niente verso il database', chiesto.filter(([tab, k]) => tab === 'tariffe_istruttori' && k !== 'select').length, 0)
  chiesto.length = 0
  await prova('con null la toglie', () => db.salvaTariffa('p1', 'c1', null), undefined)
  ok('cancellando la riga', chiesto.filter(([tab, k]) => tab === 'tariffe_istruttori' && k !== 'select').map(([, k]) => k), ['delete'])
}

console.log('\n6. senza 78-tariffe-tecnici.sql: la scheda dice cosa lanciare')
{
  const manca = { data: null, error: { message: 'column anagrafiche.provincia_nascita does not exist', code: '42703' } }
  const db = m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: (tabella) => {
      const r = tabella === 'tariffe_istruttori' ? { data: null, error: { message: 'relation "public.tariffe_istruttori" does not exist', code: '42P01' } } : tabella === 'anagrafiche' ? manca : { data: null, error: null }
      const c = new Proxy(() => c, { get: (_, k) => (k === 'then' ? (f, ko) => Promise.resolve(r).then(f, ko) : () => c), apply: () => c })
      return c
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  })
  const MANCA = 'Le tariffe e i dati dei tecnici non sono ancora attivi sul database: va lanciato 78-tariffe-tecnici.sql'
  ok('le tariffe', await errore(() => db.tariffe('p1')), MANCA)
  ok('i dati del tecnico', await errore(() => db.anagraficaDi('p1')), MANCA)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
