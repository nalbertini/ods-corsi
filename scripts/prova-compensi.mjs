// ---------------------------------------------------------------------------
// Il compenso del mese dei tecnici e la sua ricevuta, senza browser.
//
//   node scripts/prova-compensi.mjs [cartella]
//
// Il compenso di un mese è, corso per corso, le ore confermate per la tariffa
// di quel tecnico per quel corso, anche da sostituto (`src/lib/compensi.ts`,
// sul conto di `delMese` in `src/lib/ore.ts`). La ricevuta (autocertificazione
// e liquidazione, `src/lib/ricevutaCompensoPdf.ts`) copia dentro il conto e i
// dati del tecnico, come le ricevute e le lettere
// (`supabase/80-ricevute-compensi.sql`, provato da
// `supabase/prova/ricevute-compensi.sql`): una sola non annullata per persona
// e mese, dopo si spunta solo «firmata». Il compenso si cambia a mano solo
// scrivendo il perché. Netto uguale al lordo; la riga del progetto «spazi
// civici» non c'è più. Con una cartella ci lascia il PDF, da guardare.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

// Il giorno della lezione è quello di Roma, anche su una macchina in UTC.
process.env.TZ = 'Europe/Rome'

// pdf-lib vuole `platform: 'node'`; la segreteria no, come in prova-lettere.mjs.
const importa = async (contents, platform = 'browser') => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform,
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
const cartella = process.argv[2]

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
// Un messaggio qualunque, purché ci sia: la funzione che manca non vale.
const unMessaggio = (f) => {
  try {
    const x = f()
    return typeof x === 'string' && x.trim() ? 'un messaggio' : x
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
// Il testo scritto nel PDF: gli stream si aprono e le stringhe esadecimali dei `Tj` si rileggono byte per byte.
const testoDelPdf = (bytes) => {
  const b = Buffer.from(bytes)
  const s = b.toString('latin1')
  let fuori = ''
  for (const x of s.matchAll(/stream\r?\n/g)) {
    const da = x.index + x[0].length
    try {
      fuori += inflateSync(b.subarray(da, s.indexOf('endstream', da))).toString('latin1')
    } catch {
      /* non è un contenuto di pagina */
    }
  }
  return [...fuori.matchAll(/<([0-9A-F]+)> Tj/g)].map((t) => Buffer.from(t[1], 'hex').toString('latin1')).join('\n')
}
// Per cercare una frase: apostrofi diritti e spazi semplici, anche dove il testo va a capo.
const piatto = (s) => s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()
const quante = (testo, pezzo) => testo.split(pezzo).length - 1
const aspetta = (ms) => new Promise((fatto) => setTimeout(fatto, ms))

// Ognuno per sé: se manca il PDF, il resto si prova lo stesso.
const carica = async (contents, file) => {
  try {
    return await importa(contents, 'node')
  } catch (e) {
    console.log(`  ✗ ${file} non si carica —`, e.errors?.[0]?.text ?? e.message)
    guai++
    return {}
  }
}
const c = {
  ...(await carica("export * from './src/lib/compensi'", 'src/lib/compensi.ts')),
  ...(await carica(
    "export { ricevutaCompensoPdf, ricevuteCompensiPdf } from './src/lib/ricevutaCompensoPdf'; export { PDFDocument } from 'pdf-lib'",
    'src/lib/ricevutaCompensoPdf.ts',
  )),
}
const m = await importa(
  "export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'",
)

// Il primo del mese, `quanti` mesi da questo, `AAAA-MM-01`: la segreteria di prova guarda il giorno vero.
const primo = (quanti = 0) => {
  const d = new Date()
  const x = new Date(d.getFullYear(), d.getMonth() + quanti, 1)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`
}
const oggi = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()

const iso = (...a) => new Date(...a).toISOString()
const presenza = (id, personaId, corso, inizio, minuti, stato) => ({
  id,
  sessioneId: `s-${id}`,
  corso,
  inizio: iso(inizio),
  fine: iso(inizio.getTime() + minuti * 60_000),
  personaId,
  stato,
  prevista: true,
})
const ottobre = { da: new Date(2026, 9, 1), a: new Date(2026, 9, 31) }
const tariffa = (corso, centesimi) => ({ corsoId: `c-${corso}`, corso, centesimi })
// Diana (A): Judo kids da titolare, Judo adulti da sostituta, Pesi senza tariffa.
const tariffeA = [tariffa('Judo kids', 1500), tariffa('Judo adulti', 2100)]
const presenze = [
  presenza('p1', 'A', 'Judo kids', new Date(2026, 9, 2, 17, 0), 90, 'confermata'),
  presenza('p2', 'A', 'Judo adulti', new Date(2026, 9, 6, 19, 0), 60, 'confermata'),
  presenza('p3', 'A', 'Judo adulti', new Date(2026, 9, 13, 19, 0), 60, 'confermata'),
  presenza('p4', 'A', 'Pesi', new Date(2026, 9, 14, 18, 0), 60, 'confermata'),
  presenza('p5', 'A', 'Judo kids', new Date(2026, 9, 9, 17, 0), 90, 'rifiutata'),
  presenza('p6', 'A', 'Judo kids', new Date(2026, 9, 16, 17, 0), 90, 'da_confermare'),
  // Di novembre, e di un altro: non contano.
  presenza('p7', 'A', 'Judo kids', new Date(2026, 10, 6, 17, 0), 90, 'confermata'),
  presenza('p8', 'B', 'Judo kids', new Date(2026, 9, 2, 17, 0), 90, 'confermata'),
]

console.log('\n1. il compenso del mese: ore confermate per la tariffa, corso per corso')
{
  const conto = (...x) => {
    try {
      return c.compensoDelMese(...x)
    } catch (e) {
      return { errore: e.message }
    }
  }
  const x = conto(presenze, [], 'A', ottobre, tariffeA)
  ok('una riga per corso, in ordine, con lezioni, minuti, tariffa e importo', x.righe, [
    { corso: 'Judo adulti', lezioni: 2, minuti: 120, centesimiOra: 2100, importo: 4200 },
    { corso: 'Judo kids', lezioni: 1, minuti: 90, centesimiOra: 1500, importo: 2250 },
    { corso: 'Pesi', lezioni: 1, minuti: 60 },
  ])
  ok('90 minuti a 15 € l\'ora fanno 22,50 €', x.righe?.find((r) => r.corso === 'Judo kids')?.importo, 2250)
  ok('il corso senza tariffa non ha importo', x.righe?.find((r) => r.corso === 'Pesi') && 'importo' in x.righe.find((r) => r.corso === 'Pesi'), false)
  ok('ed è fra i senza tariffa', x.senzaTariffa, ['Pesi'])
  ok('il calcolato somma solo i corsi con la tariffa', x.calcolato, 6450)
  ok('lezioni e minuti di tutte le confermate del mese', [x.lezioni, x.minuti], [4, 270])
  ok('una da confermare', x.daConfermare, 1)
  ok('anche le lezioni tenute senza segno sono da confermare',
    conto(presenze, [{ sessioneId: 's9', corso: 'Judo kids', inizio: iso(2026, 9, 23, 17), fine: iso(2026, 9, 23, 18), presenti: 4, previsti: [{ id: 'A', nome: 'Diana' }] }], 'A', ottobre, tariffeA).daConfermare, 2)
  const y = conto(presenze, [], 'A', ottobre, [...tariffeA, tariffa('Pesi', 1000)])
  ok('con la tariffa anche dei Pesi: niente senza tariffa, e il calcolato li conta', [y.senzaTariffa, y.calcolato], [[], 7450])
  ok('i minuti si pagano a frazione d\'ora, arrotondati al centesimo (50 minuti a 10 €: 8,33 €)',
    conto([presenza('q1', 'C', 'Aikido', new Date(2026, 9, 5, 18, 0), 50, 'confermata')], [], 'C', ottobre, [tariffa('Aikido', 1000)]).righe, [
      { corso: 'Aikido', lezioni: 1, minuti: 50, centesimiOra: 1000, importo: 833 },
    ])
  ok('le tariffe di un altro corso non valgono', conto(presenze, [], 'A', ottobre, [tariffa('Karate', 1500)]).calcolato, 0)
  const z = conto(presenze, [], 'Z', ottobre, [])
  ok('un tecnico senza lezioni: tutto a zero', [z.righe, z.lezioni, z.minuti, z.calcolato, z.daConfermare, z.senzaTariffa], [[], 0, 0, 0, 0, []])
}

console.log('\n2. lo stato del compenso, e chi ha una riga nella pagina COMPENSI')
{
  const conto = { righe: [], lezioni: 4, minuti: 270, calcolato: 6450, daConfermare: 0, senzaTariffa: [] }
  const ricevuta = { calcolato: 6450, importo: 6450, annullataIl: null }
  const stato = (x) => {
    try {
      return c.statoCompenso(x)
    } catch (e) {
      return `ERRORE: ${e.message}`
    }
  }
  ok('lezioni da confermare e nessuna ricevuta: da confermare', stato({ conto: { ...conto, daConfermare: 2 } }), 'da-confermare')
  ok('da confermare vince su senza tariffa', stato({ conto: { ...conto, daConfermare: 2, senzaTariffa: ['Pesi'] } }), 'da-confermare')
  ok('un corso senza tariffa e nessuna ricevuta: senza tariffa', stato({ conto: { ...conto, senzaTariffa: ['Pesi'] } }), 'senza-tariffa')
  ok('tutto confermato e con le tariffe: da fare', stato({ conto }), 'da-fare')
  ok('con la ricevuta e il conto che torna: fatta', stato({ conto, ricevuta }), 'fatta')
  ok('fatta anche col compenso cambiato a mano: conta il calcolato', stato({ conto, ricevuta: { ...ricevuta, importo: 9000, motivo: 'Una lezione in più' } }), 'fatta')
  ok('fatta anche se dopo arriva una lezione da confermare, finché il conto torna', stato({ conto: { ...conto, daConfermare: 1 }, ricevuta }), 'fatta')
  ok('la ricevuta fatta ma il calcolato di adesso è diverso: non torna', stato({ conto: { ...conto, calcolato: 7450 }, ricevuta }), 'non-torna')
  ok('una ricevuta annullata è come non averla', stato({ conto, ricevuta: { ...ricevuta, annullataIl: '2026-11-02T10:00:00Z' } }), 'da-fare')

  const tecnici = [
    { id: 'A', nome: 'Diana', cognome: 'Ballabio' },
    { id: 'B', nome: 'Bruno', cognome: 'Rossi' },
    { id: 'C', nome: 'Carla', cognome: 'Zeta' },
    { id: 'D', nome: 'Dario', cognome: 'Anselmi' },
    { id: 'E', nome: 'Elio', cognome: 'Verdi' },
  ]
  const ricevute = [
    // Di E: fatta quando aveva lezioni, che poi sono state tolte.
    { id: 'r1', personaId: 'E', mese: '2026-10-01', calcolato: 3000, importo: 3000, annullataIl: null },
    // Di B, ma annullata, e di B per settembre: non contano per ottobre.
    { id: 'r2', personaId: 'B', mese: '2026-10-01', calcolato: 2250, importo: 2250, annullataIl: '2026-11-02T10:00:00Z' },
    { id: 'r3', personaId: 'B', mese: '2026-09-01', calcolato: 2250, importo: 2250, annullataIl: null },
  ]
  // Senza la da confermare di A, così A resta senza tariffa (i Pesi).
  const conD = [...presenze.filter((x) => x.id !== 'p6'), presenza('d1', 'D', 'Judo kids', new Date(2026, 9, 20, 17, 0), 60, 'da_confermare')]
  await prova(
    'una riga per chi ha lezioni confermate, da confermare o una ricevuta, per cognome; chi non ha niente no',
    () => c.righeCompensi({ tecnici, presenze: conD, senzaIstruttore: [], mese: ottobre, tariffe: { A: tariffeA, B: [tariffa('Judo kids', 1500)] }, ricevute })
      .map((r) => [r.persona.id, r.stato, r.conto.calcolato, r.ricevuta?.id ?? null]),
    [['D', 'da-confermare', 0, null], ['A', 'senza-tariffa', 6450, null], ['B', 'da-fare', 2250, null], ['E', 'non-torna', 0, 'r1']],
  )
  await prova(
    'con la ricevuta di A: fatta',
    () => c.righeCompensi({ tecnici: tecnici.slice(0, 1), presenze, senzaIstruttore: [], mese: ottobre, tariffe: { A: tariffeA }, ricevute: [{ id: 'r4', personaId: 'A', mese: '2026-10-01', calcolato: 6450, importo: 6450, annullataIl: null }] })
      .map((r) => [r.persona.id, r.stato, r.ricevuta?.id]),
    [['A', 'fatta', 'r4']],
  )
}

console.log('\n3. cosa non va nel compenso, prima di fare la ricevuta')
{
  const no = (x) => {
    try {
      return c.cosaNonVaCompenso(x)
    } catch (e) {
      return `ERRORE: ${e.message}`
    }
  }
  const PERCHE = 'Scrivi perché il compenso è diverso da quello calcolato'
  ok('uguale al calcolato, senza perché: niente', no({ importo: 6450, calcolato: 6450, motivo: '' }), null)
  ok('uguale al calcolato, col perché null: niente', no({ importo: 6450, calcolato: 6450, motivo: null }), null)
  ok('diverso senza perché', no({ importo: 7000, calcolato: 6450, motivo: '' }), PERCHE)
  ok('diverso col perché di soli spazi', no({ importo: 7000, calcolato: 6450, motivo: '   ' }), PERCHE)
  ok('diverso col perché: niente', no({ importo: 7000, calcolato: 6450, motivo: 'Una lezione in più non segnata' }), null)
  ok('il perché di due lettere no', unMessaggio(() => c.cosaNonVaCompenso({ importo: 7000, calcolato: 6450, motivo: 'ok' })), 'un messaggio')
  ok('il perché oltre 200 caratteri no', unMessaggio(() => c.cosaNonVaCompenso({ importo: 7000, calcolato: 6450, motivo: 'x'.repeat(201) })), 'un messaggio')
  ok('il perché di 200 caratteri sì', no({ importo: 7000, calcolato: 6450, motivo: 'x'.repeat(200) }), null)
  ok('un compenso di zero no', unMessaggio(() => c.cosaNonVaCompenso({ importo: 0, calcolato: 0, motivo: '' })), 'un messaggio')
  ok('un compenso negativo no', unMessaggio(() => c.cosaNonVaCompenso({ importo: -100, calcolato: 6450, motivo: 'Restituito' })), 'un messaggio')
  ok('un compenso coi decimali di centesimo no', unMessaggio(() => c.cosaNonVaCompenso({ importo: 6450.5, calcolato: 6450, motivo: 'Arrotondato' })), 'un messaggio')
  ok('oltre 100.000 € no', unMessaggio(() => c.cosaNonVaCompenso({ importo: 10_000_001, calcolato: 6450, motivo: 'Battuto male' })), 'un messaggio')
  ok('fino a 100.000 € sì', no({ importo: 10_000_000, calcolato: 6450, motivo: 'Il premio della stagione' }), null)
}

const BALLABIO = {
  nome: 'Diana', cognome: 'Ballabio', indirizzo: 'Via Montelera 73', cap: '10040', comune: 'Val della Torre', provincia: 'TO',
  codiceFiscale: 'BLLDNI86H61H355W', natoIl: '1986-06-21', natoA: 'Pinerolo', provinciaNascita: 'TO', iban: 'IT60X0542811101000000123456',
}
// Sei lezioni di due ore di Judo kids a 15 € l'ora: 180 €.
const dati = {
  personaId: 'p1',
  mese: '2026-10-01',
  righe: [{ corso: 'Judo kids', lezioni: 6, minuti: 720, centesimiOra: 1500, importo: 18000 }],
  calcolato: 18000,
  importo: 18000,
  motivo: null,
  tecnico: BALLABIO,
  qualifica: 'Allenatore',
  data: '2026-10-21',
}
const ricevuta = { ...dati, id: 'r1', firmata: false, annullataIl: null, creataIl: '2026-10-21T10:00:00Z' }
const MANSIONI = ['ATLETA', 'ALLENATORE', 'ISTRUTTORE', 'DIRETTORE TECNICO', 'DIRETTORE SPORTIVO', 'PREPARATORE ATLETICO', 'DIRETTORE DI GARA', 'ALTRO']

console.log('\n4. il testo: la bozza della palestra, senza il progetto, coi dati della ricevuta')
{
  // Una stringa per riga, o {testo}; una stringa sola si legge riga per riga.
  const righe = (x) => {
    try {
      const t = c.testoRicevutaCompenso(x)
      return (Array.isArray(t) ? t.map((p) => (typeof p === 'string' ? p : p.testo)) : String(t).split('\n')).map(piatto)
    } catch (e) {
      return [`ERRORE: ${e.message}`]
    }
  }
  const rs = righe(ricevuta)
  const tutto = rs.join('\n')
  const ha = (cosa, frase) => ok(cosa, tutto.includes(frase), true)
  const come = (cosa, re) => ok(cosa, re.test(piatto(tutto)), true)
  const nonHa = (cosa, frase) => ok(cosa, tutto.includes(frase), false)
  const riga = (inizio) => rs.find((r) => r.startsWith(inizio)) ?? `(nessuna riga «${inizio}…»)`
  ok('più righe, non una sola', rs.length > 20, true)
  ha("il titolo dell'autocertificazione, con l'anno del mese", 'AUTOCERTIFICAZIONE PER COMPENSI A COLLABORATORI SPORTIVI – ANNO 2026')
  come('il cognome', /COGNOME:? BALLABIO/i)
  come('il nome', /\bNOME:? DIANA/i)
  come('nato a, con la provincia', /NATO A:? PINEROLO.{0,20}PROV\.?:? TO\b/i)
  come('la data di nascita', /DATA DI NASCITA:? 21\/06\/1986/i)
  come('indirizzo e numero civico', /INDIRIZZO E N\. CIVICO:? VIA MONTELERA 73/i)
  come('il comune, con la provincia', /COMUNE:? VAL DELLA TORRE.{0,20}PROV\.?:? TO\b/i)
  come('il CAP', /CAP:? 10040/i)
  come('il codice fiscale', /CODICE FISCALE:? BLLDNI86H61H355W/i)
  ha("l'articolo del rapporto di lavoro sportivo", "Il sottoscritto, titolare di un rapporto di lavoro sportivo ai sensi dell'art. 25 del Decreto Legislativo 28 febbraio 2021, n. 36")
  ha('la mansione della lettera, già barrata', '☒ ALLENATORE')
  for (const x of MANSIONI.filter((x) => x !== 'ALLENATORE')) ha(`«${x}» col quadratino vuoto`, `☐ ${x}`)
  ok('una sola casella barrata', quante(tutto, '☒'), 1)
  ha('la dichiarazione delle sanzioni penali', 'consapevole delle sanzioni penali previste in caso di dichiarazioni non veritiere')
  ha('le dichiarazioni fiscali', 'DICHIARA ai fini fiscali')
  ha('la prima fiscale, vuota', "☐ di NON AVER RICEVUTO compensi di cui all'articolo 36, comma 6 del D.lgs. 36/2021")
  ha('quella con la soglia (euro 15.000), vuota', '☐ di AVER RICEVUTO compensi di cui all\'articolo 36, comma 6 del D.lgs. 36/2021 eguali o superiori')
  ha('le dichiarazioni previdenziali', 'DICHIARA ai fini previdenziali')
  ha('la prima previdenziale, vuota', '☐ di NON AVER RICEVUTO compensi per prestazioni di lavoro sportivo dilettantistico')
  ok("l'ammontare da scrivere a mano, nella fiscale e nella previdenziale", quante(tutto, 'per un ammontare complessivo di euro ____'), 2)
  nonHa('niente importo scritto nella previdenziale («100,00euro» della bozza)', '100,00euro')
  ha('cassa professionale, vuota', '☐ di essere iscritto alla cassa professionale')
  ha('pensionato, vuota', '☐ di essere pensionato')
  ha('nessuna forma pensionistica, vuota', '☐ di non essere iscritto ad alcuna forma pensionistica obbligatoria')
  ha('non dipendente pubblico, vuota', '☐ di non essere dipendente pubblico')
  ha('dipendente pubblico, vuota', '☐ di essere dipendente pubblico')
  ok('tutte le caselle vuote: sette mansioni e tredici dichiarazioni', quante(tutto, '☐'), 20)
  come('la richiesta col compenso, il periodo e l\'IBAN',
    /RICHIEDE La liquidazione e il pagamento del compenso lordo pari ad € 180,00 maturato nel periodo 01\/10\/2026-31\/10\/2026, a mezzo bonifico bancario su IBAN IT60X0542811101000000123456/)
  nonHa('senza il doppio «€ €» della bozza', '€ €')
  ha('luogo e data', 'Luogo e data')
  ha('la firma del collaboratore, da fare a mano', 'Firma del collaboratore')
  ha('Collegno, il giorno della stampa', 'Collegno, 21/10/2026')
  ha('il titolo della liquidazione', 'LIQUIDAZIONE DEI COMPENSI A COLLABORATORI SPORTIVI – ANNO 2026')
  ok('compenso lordo: + 180,00', /\+\s*180,00/.test(riga('Compenso lordo')), true)
  ok('INPS a carico del collaboratore: - 0,00', /-\s*0,00/.test(riga('Contribuzione INPS a carico del collaboratore (1/3)')), true)
  ok('IRPEF: - 0,00', /-\s*0,00/.test(riga('Ritenute IRPEF a carico del collaboratore')), true)
  ok('addizionali regionali: - 0,00', /-\s*0,00/.test(riga('Addizionali regionali')), true)
  ok('addizionali comunali: - 0,00', /-\s*0,00/.test(riga('Addizionali comunali')), true)
  ok('netto a pagare: = 180,00', /=\s*180,00/.test(riga('NETTO A PAGARE')), true)
  ok('«DATA PAGAMENTO:» e poi niente, da scrivere a mano', /^DATA PAGAMENTO:[\s_.]*$/.test(riga('DATA PAGAMENTO')), true)
  nonHa('niente spazi civici', 'spazi civici')
  nonHa('niente play district', 'play district')
  nonHa('niente «fermi tutti»', 'fermi tutti')
  nonHa('niente CUP', 'CUP')
  nonHa('niente codice del progetto', 'J59J21014580001')
  nonHa('niente «in relazione al progetto»', 'in relazione al progetto')

  const senza = righe({ ...ricevuta, qualifica: null }).join('\n')
  ok('senza la lettera: nessuna mansione barrata', quante(senza, '☒'), 0)
  ok('e tutte e otto col quadratino vuoto', MANSIONI.every((x) => senza.includes(`☐ ${x}`)), true)
  ok("un'altra qualifica: «Direttore di gara»", righe({ ...ricevuta, qualifica: 'Direttore di gara' }).join('\n').includes('☒ DIRETTORE DI GARA'), true)
  ok('«Altro»', righe({ ...ricevuta, qualifica: 'Altro' }).join('\n').includes('☒ ALTRO'), true)

  const cambiato = righe({ ...ricevuta, importo: 20000, motivo: 'Una lezione in più non segnata' })
  ok('il compenso cambiato a mano: la ricevuta esce con quello', piatto(cambiato.join(' ')).includes('compenso lordo pari ad € 200,00'), true)
  ok('anche nel lordo e nel netto', [/\+\s*200,00/.test(cambiato.find((r) => r.startsWith('Compenso lordo')) ?? ''), /=\s*200,00/.test(cambiato.find((r) => r.startsWith('NETTO A PAGARE')) ?? '')], [true, true])

  const febbraio = righe({ ...ricevuta, mese: '2027-02-01', data: '2027-03-02' }).join('\n')
  ok("l'anno è quello del mese: 2027, due volte", quante(febbraio, '– ANNO 2027'), 2)
  ok('il periodo di febbraio finisce il 28', febbraio.includes('maturato nel periodo 01/02/2027-28/02/2027'), true)
  ok('e la data è quella della stampa', febbraio.includes('Collegno, 02/03/2027'), true)
  const dicembre = righe({ ...ricevuta, mese: '2026-12-01', data: '2027-01-10' }).join('\n')
  ok('dicembre stampato a gennaio: anno 2026, non 2027', [quante(dicembre, '– ANNO 2026'), dicembre.includes('ANNO 2027')], [2, false])
}

console.log('\n4 bis. i dati della ricevuta, dalla scheda')
{
  const an = { natoA: 'Pinerolo', provinciaNascita: 'TO', natoIl: '1986-06-21', codiceFiscale: 'BLLDNI86H61H355W', indirizzo: 'Via Montelera 73', cap: '10040', comune: 'Val della Torre', provincia: 'TO', iban: 'IT60X0542811101000000123456', genitoreNome: 'X' }
  const conto = { righe: [{ corso: 'Judo kids', lezioni: 6, minuti: 720, centesimiOra: 1500, importo: 18000 }, { corso: 'Pesi', lezioni: 1, minuti: 60 }], lezioni: 7, minuti: 780, calcolato: 18000, daConfermare: 0, senzaTariffa: ['Pesi'] }
  const lettere = [
    { stagione: '2026/27', qualifica: 'Istruttore', sostituitaIl: '2026-09-10T10:00:00Z' },
    { stagione: '2026/27', qualifica: 'Allenatore', sostituitaIl: null },
    { stagione: '2025/26', qualifica: 'Atleta', sostituitaIl: null },
  ]
  const fatti = await (async () => { try { return c.datiPerRicevuta({ id: 'p1', nome: 'Diana', cognome: 'Ballabio' }, an, conto, '2026-10-01', lettere, '2026-11-02') } catch (e) { return `ERRORE: ${e.message}` } })()
  ok('solo le righe con la tariffa', fatti.righe?.map?.((r) => r.corso), ['Judo kids'])
  ok('il calcolato e, senza cambi, lo stesso importo', [fatti.calcolato, fatti.importo, fatti.motivo], [18000, 18000, null])
  ok('la qualifica della lettera valida di quella stagione', fatti.qualifica, 'Allenatore')
  ok("l'IBAN e le province copiati, niente genitore", [fatti.tecnico?.iban, fatti.tecnico?.provincia, fatti.tecnico?.provinciaNascita, fatti.tecnico?.genitoreNome], ['IT60X0542811101000000123456', 'TO', 'TO', undefined])
  ok('mese e data della stampa', [fatti.mese, fatti.data, fatti.personaId], ['2026-10-01', '2026-11-02', 'p1'])
  ok('agosto 2027 è ancora della stagione 2026/27', c.datiPerRicevuta({ id: 'p1', nome: 'D', cognome: 'B' }, an, conto, '2027-08-01', lettere, '2027-09-02').qualifica, 'Allenatore')
  ok('settembre 2027 è della stagione dopo: senza lettera, nessuna qualifica', c.datiPerRicevuta({ id: 'p1', nome: 'D', cognome: 'B' }, an, conto, '2027-09-01', lettere, '2027-10-02').qualifica, null)
  ok('col compenso cambiato a mano e il perché', (({ importo, motivo }) => [importo, motivo])(c.datiPerRicevuta({ id: 'p1', nome: 'D', cognome: 'B' }, an, conto, '2026-10-01', lettere, '2026-11-02', { importo: 20000, motivo: ' Lezione in più ' })), [20000, 'Lezione in più'])
  ok('mancano i dati: codice fiscale, residenza o IBAN', c.mancaPerRicevuta({ ...an, iban: undefined }), 'Mancano i dati per la ricevuta: codice fiscale, residenza e IBAN')
  ok('ci sono tutti: niente', c.mancaPerRicevuta(an), null)
  ok('senza anagrafica', c.mancaPerRicevuta(null), 'Mancano i dati per la ricevuta: codice fiscale, residenza e IBAN')
}

console.log('\n5. il PDF')
{
  const fai = async (f) => {
    try {
      const byte = await f()
      const doc = await c.PDFDocument.load(byte)
      return { byte, doc, testo: piatto(testoDelPdf(byte)) }
    } catch (e) {
      return { errore: e.message }
    }
  }
  const p = await fai(() => c.ricevutaCompensoPdf(ricevuta))
  ok('si fa', p.errore ?? 'fatto', 'fatto')
  if (!p.errore) {
    const { width, height } = p.doc.getPage(0).getSize()
    ok('A4 in verticale', [Math.round(width), Math.round(height)], [595, 842])
    ok('il nome', p.testo.toUpperCase().includes('BALLABIO') && p.testo.toUpperCase().includes('DIANA'), true)
    ok('il codice fiscale', p.testo.includes('BLLDNI86H61H355W'), true)
    ok("l'IBAN", p.testo.includes('IT60X0542811101000000123456'), true)
    ok('il compenso', p.testo.includes('180,00'), true)
    ok('Collegno', p.testo.includes('Collegno'), true)
    ok('la liquidazione', p.testo.includes('LIQUIDAZIONE DEI COMPENSI A COLLABORATORI SPORTIVI'), true)
    ok('niente spazi civici', p.testo.includes('spazi civici') || p.testo.includes('J59J21014580001'), false)
    if (cartella) writeFileSync(`${cartella}/ricevuta-compenso-ballabio.pdf`, p.byte)
  }
  const altra = { ...ricevuta, id: 'r2', tecnico: { ...BALLABIO, nome: 'Mario', cognome: 'Rossi', codiceFiscale: 'RSSMRA80A01L219M' }, qualifica: null }
  const q = await fai(() => c.ricevutaCompensoPdf(altra))
  const tutte = await fai(() => c.ricevuteCompensiPdf([ricevuta, altra]))
  ok('più ricevute in un PDF solo', tutte.errore ?? 'fatto', 'fatto')
  if (!tutte.errore && !p.errore && !q.errore) {
    ok('con le pagine di tutte, ognuna dalla sua', tutte.doc.getPageCount(), p.doc.getPageCount() + q.doc.getPageCount())
    ok('e i nomi di tutte e due', tutte.testo.includes('BLLDNI86H61H355W') && tutte.testo.includes('RSSMRA80A01L219M'), true)
    ok('tutte A4 in verticale', tutte.doc.getPages().every((x) => Math.round(x.getSize().width) === 595 && Math.round(x.getSize().height) === 842), true)
    if (cartella) writeFileSync(`${cartella}/ricevute-compensi.pdf`, tutte.byte)
  }
}

console.log('\n6. la segreteria di prova: fa, annulla, rifà, spunta firmata')
{
  const s = m.creaSegreteriaProva()
  const personale = await s.personale()
  const tecnico = personale.find((p) => p.ruolo === 'istruttore')
  const nonInsegna = personale.find((p) => p.ruolo === 'staff' && !p.ancheIstruttore)
  ok("c'è un istruttore e una segreteria che non insegna", [!!tecnico, !!nonInsegna], [true, true])
  const sua = { ...dati, personaId: tecnico.id, mese: primo(-1), data: oggi }
  await prova('senza ricevute, nessuna', () => s.ricevuteCompensi(tecnico.id), [])
  let prima
  await prova('fa la ricevuta del mese scorso', async () => {
    prima = await s.faiRicevutaCompenso(sua)
    return [typeof prima.id, prima.personaId, prima.mese, prima.importo, prima.calcolato, prima.motivo ?? null, prima.firmata, prima.annullataIl ?? null, prima.tecnico.iban, prima.qualifica]
  }, ['string', tecnico.id, primo(-1), 18000, 18000, null, false, null, 'IT60X0542811101000000123456', 'Allenatore'])
  ok('la seconda dello stesso mese no, col messaggio', await errore(() => s.faiRicevutaCompenso(sua)), "C'è già la ricevuta di questo mese: annullala prima di rifarla")
  await prova('la annulla', async () => {
    await s.annullaRicevutaCompenso(prima.id)
    return typeof (await s.ricevuteCompensi(tecnico.id)).find((x) => x.id === prima.id)?.annullataIl
  }, 'string')
  ok('una annullata non si annulla due volte', await rifiuta(() => s.annullaRicevutaCompenso(prima.id)), 'rifiutato')
  await aspetta(5)
  let seconda
  await prova('e la rifà, col compenso cambiato e il perché', async () => {
    seconda = await s.faiRicevutaCompenso({ ...sua, importo: 20000, motivo: 'Una lezione in più non segnata' })
    return [seconda.importo, seconda.calcolato, seconda.motivo]
  }, [20000, 18000, 'Una lezione in più non segnata'])
  await aspetta(5)
  await prova('questo mese sì, anche se non è finito', async () => (await s.faiRicevutaCompenso({ ...sua, mese: primo(0) })).mese, primo(0))
  await prova('dalla più nuova: il mese, poi quando è stata fatta', async () => (await s.ricevuteCompensi(tecnico.id)).map((x) => [x.mese, x.annullataIl ? 'annullata' : 'valida']), [
    [primo(0), 'valida'], [primo(-1), 'valida'], [primo(-1), 'annullata'],
  ])
  ok('il mese prossimo no', await rifiuta(() => s.faiRicevutaCompenso({ ...sua, mese: primo(1) })), 'rifiutato')
  ok('il compenso diverso senza perché no, col messaggio', await errore(() => s.faiRicevutaCompenso({ ...sua, mese: primo(-2), importo: 20000 })), 'Scrivi perché il compenso è diverso da quello calcolato')
  ok('un compenso di zero no', await rifiuta(() => s.faiRicevutaCompenso({ ...sua, mese: primo(-2), importo: 0, motivo: 'Non ha lavorato' })), 'rifiutato')
  ok('senza righe no', await rifiuta(() => s.faiRicevutaCompenso({ ...sua, mese: primo(-2), righe: [] })), 'rifiutato')
  ok('per chi non insegna no', await rifiuta(() => s.faiRicevutaCompenso({ ...sua, personaId: nonInsegna.id })), 'rifiutato')
  await prova('e le sue ricevute sono ancora tre', async () => (await s.ricevuteCompensi(tecnico.id)).length, 3)
  await prova('la spunta firmata', async () => {
    await s.segnaFirmataCompenso(seconda.id, true)
    return (await s.ricevuteCompensi(tecnico.id)).find((x) => x.id === seconda.id)?.firmata
  }, true)
  await prova('e la toglie', async () => {
    await s.segnaFirmataCompenso(seconda.id, false)
    return (await s.ricevuteCompensi(tecnico.id)).find((x) => x.id === seconda.id)?.firmata
  }, false)
  // Un tecnico nuovo, senza corsi né lezioni: l'unica cosa che lo tiene è la ricevuta.
  const nuovo = await s.salvaPersonale({ nome: 'Teo', cognome: 'Nuovo', ruolo: 'istruttore' })
  let sue = {}
  await prova('anche a lui', async () => {
    sue = await s.faiRicevutaCompenso({ ...sua, personaId: nuovo })
    return sue.personaId
  }, nuovo)
  await prova('senza persona: le ricevute di tutti', async () => (await s.ricevuteCompensi()).map((x) => x.personaId).sort(), [tecnico.id, tecnico.id, tecnico.id, nuovo].sort())
  await prova('con la persona: solo le sue', async () => (await s.ricevuteCompensi(nuovo)).map((x) => x.id), [sue.id])
  ok('un tecnico con ricevute non si elimina, come col database', await errore(() => s.eliminaIstruttore(nuovo)), "Teo Nuovo ha già lavorato nei registri: non si elimina, gli si toglie l'accesso")
  await s.annullaRicevutaCompenso?.(sue.id).catch(() => {})
  ok('nemmeno se la ricevuta è annullata', await errore(() => s.eliminaIstruttore(nuovo)), "Teo Nuovo ha già lavorato nei registri: non si elimina, gli si toglie l'accesso")
  await prova('le ricevute dei compensi stanno nei dati della persona che si esportano', async () => (await s.esporta(tecnico.id)).ricevute_compensi?.length, 3)
}

console.log('\n7. col database vero: le funzioni, la sola colonna firmata, la tabella')
{
  const chiesto = []
  const catena = (tabella, risposta) => {
    const c = new Proxy(() => c, {
      get: (_, k) => (k === 'then' ? (fatto, ko) => Promise.resolve(risposta).then(fatto, ko) : (...a) => (chiesto.push([tabella, k, ...a]), c)),
      apply: () => c,
    })
    return c
  }
  const RIGHE_DB = [{ corso: 'Judo kids', lezioni: 6, minuti: 720, centesimi_ora: 1500, importo: 18000 }]
  const riga = {
    id: 'r2', persona_id: 'p1', mese: '2026-10-01', righe: RIGHE_DB, calcolato: 18000, importo: 18000, motivo: null, tecnico: BALLABIO,
    qualifica: 'Allenatore', data: '2026-10-21', firmata: false, annullata_il: null, creata_il: '2026-10-21T10:00:00Z', creata_da: 'a1',
  }
  const vecchia = { ...riga, id: 'r1', importo: 20000, motivo: 'Una lezione in più', firmata: true, annullata_il: '2026-10-21T09:00:00Z', creata_il: '2026-10-20T10:00:00Z' }
  const db = m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: (tabella) => catena(tabella, tabella === 'ricevute_compensi' ? { data: [riga, vecchia], error: null } : { data: null, error: null }),
    rpc: (f, args) => (chiesto.push([f, 'rpc', args]), catena(f, { data: f === 'annulla_ricevuta_compenso' ? { ...riga, annullata_il: '2026-10-22T10:00:00Z' } : riga, error: null })),
  })
  const sceltR = (x) => x && [x.id, x.personaId, x.mese, x.righe, x.calcolato, x.importo, x.motivo ?? null, x.qualifica, x.data, x.firmata, x.annullataIl ?? null, x.creataIl, x.tecnico?.iban]

  chiesto.length = 0
  await prova('fa la ricevuta con fai_ricevuta_compenso, e la rende', async () => sceltR(await db.faiRicevutaCompenso(dati)),
    ['r2', 'p1', '2026-10-01', dati.righe, 18000, 18000, null, 'Allenatore', '2026-10-21', false, null, '2026-10-21T10:00:00Z', 'IT60X0542811101000000123456'])
  const rpc = chiesto.find(([, k]) => k === 'rpc')
  ok('la funzione giusta', rpc?.[0], 'fai_ricevuta_compenso')
  ok('coi nomi giusti degli argomenti', Object.keys(rpc?.[2] ?? {}).sort(), ['calcolato', 'data', 'importo', 'mese', 'motivo', 'persona', 'qualifica', 'righe', 'tecnico'])
  ok('e i valori, con le righe scritte come nel database (centesimi_ora)',
    rpc?.[2] && [rpc[2].persona, rpc[2].mese, rpc[2].righe, rpc[2].calcolato, rpc[2].importo, rpc[2].motivo, rpc[2].tecnico?.iban, rpc[2].qualifica, rpc[2].data],
    ['p1', '2026-10-01', RIGHE_DB, 18000, 18000, null, 'IT60X0542811101000000123456', 'Allenatore', '2026-10-21'])

  chiesto.length = 0
  ok('il compenso diverso senza perché no, col messaggio', await errore(() => db.faiRicevutaCompenso({ ...dati, importo: 20000 })), 'Scrivi perché il compenso è diverso da quello calcolato')
  ok('e non parte niente verso il database', chiesto.filter(([, k]) => k === 'rpc').length, 0)

  chiesto.length = 0
  await prova('annulla con annulla_ricevuta_compenso', async () => { await db.annullaRicevutaCompenso('r2'); return chiesto.filter(([, k]) => k === 'rpc').map(([f, , a]) => [f, a]) },
    [['annulla_ricevuta_compenso', { id: 'r2' }]])

  chiesto.length = 0
  await prova('spunta firmata', () => db.segnaFirmataCompenso('r2', true), undefined)
  ok('cambiando la sola colonna firmata', chiesto.filter(([tab, k]) => tab === 'ricevute_compensi' && k === 'update').map(([, , r]) => r), [{ firmata: true }])
  ok('di quella ricevuta', chiesto.some(([tab, k, col, val]) => tab === 'ricevute_compensi' && k === 'eq' && col === 'id' && val === 'r2'), true)
  chiesto.length = 0
  await prova('e la toglie', () => db.segnaFirmataCompenso('r2', false), undefined)
  ok('sempre con la sola colonna firmata', chiesto.filter(([tab, k]) => tab === 'ricevute_compensi' && k === 'update').map(([, , r]) => r), [{ firmata: false }])

  chiesto.length = 0
  await prova('legge le ricevute della persona da ricevute_compensi', async () => (await db.ricevuteCompensi('p1')).map(sceltR), [
    ['r2', 'p1', '2026-10-01', dati.righe, 18000, 18000, null, 'Allenatore', '2026-10-21', false, null, '2026-10-21T10:00:00Z', 'IT60X0542811101000000123456'],
    ['r1', 'p1', '2026-10-01', dati.righe, 18000, 20000, 'Una lezione in più', 'Allenatore', '2026-10-21', true, '2026-10-21T09:00:00Z', '2026-10-20T10:00:00Z', 'IT60X0542811101000000123456'],
  ])
  ok('solo le sue', chiesto.some(([tab, k, col, val]) => tab === 'ricevute_compensi' && k === 'eq' && col === 'persona_id' && val === 'p1'), true)
  const ordini = chiesto.filter(([tab, k]) => tab === 'ricevute_compensi' && k === 'order').map(([, , col, o]) => [col, o?.ascending])
  ok('dalla più nuova: per mese, poi per quando è stata fatta', ordini, [['mese', false], ['creata_il', false]])
  chiesto.length = 0
  await prova('senza persona: tutte', async () => (await db.ricevuteCompensi()).length, 2)
  ok('senza filtro sulla persona', chiesto.some(([tab, k, col]) => tab === 'ricevute_compensi' && k === 'eq' && col === 'persona_id'), false)
}

console.log('\n8. senza 80-ricevute-compensi.sql: dice cosa lanciare')
{
  const tabella = { data: null, error: { message: 'relation "public.ricevute_compensi" does not exist', code: '42P01' } }
  const funzione = (f) => ({ data: null, error: { message: `Could not find the function public.${f}(...) in the schema cache`, code: 'PGRST202' } })
  const risponde = (r) => {
    const c = new Proxy(() => c, { get: (_, k) => (k === 'then' ? (f, ko) => Promise.resolve(r).then(f, ko) : () => c), apply: () => c })
    return c
  }
  const db = m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: (t) => risponde(t === 'ricevute_compensi' ? tabella : { data: null, error: null }),
    rpc: (f) => risponde(f === 'fai_ricevuta_compenso' || f === 'annulla_ricevuta_compenso' ? funzione(f) : { data: null, error: null }),
  })
  const lancia = (msg) => (msg.includes('va lanciato 80-ricevute-compensi.sql') ? 'dice di lanciare 80-ricevute-compensi.sql' : msg)
  ok('le ricevute', lancia(await errore(() => db.ricevuteCompensi('p1'))), 'dice di lanciare 80-ricevute-compensi.sql')
  ok('fare la ricevuta', lancia(await errore(() => db.faiRicevutaCompenso(dati))), 'dice di lanciare 80-ricevute-compensi.sql')
  ok('annullarla', lancia(await errore(() => db.annullaRicevutaCompenso('r1'))), 'dice di lanciare 80-ricevute-compensi.sql')
  ok('spuntare firmata', lancia(await errore(() => db.segnaFirmataCompenso('r1', true))), 'dice di lanciare 80-ricevute-compensi.sql')
  // PostgREST, quando la tabella non è nella sua cache, risponde così.
  const cache = m.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => risponde({ data: null, error: { message: "Could not find the table 'public.ricevute_compensi' in the schema cache", code: 'PGRST205' } }),
    rpc: () => risponde({ data: null, error: null }),
  })
  ok('le ricevute, quando PostgREST non trova la tabella', lancia(await errore(() => cache.ricevuteCompensi())), 'dice di lanciare 80-ricevute-compensi.sql')
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
