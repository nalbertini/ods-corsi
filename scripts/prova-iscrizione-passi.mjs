// ---------------------------------------------------------------------------
// L'iscrizione a passi (iscrizioni/#nuova, solo in prova), senza browser.
//
//   node scripts/prova-iscrizione-passi.mjs
//
// Le regole stanno in `src/lib/passiIscrizione.ts`: quello che la schermata
// (`IscrizioneAPassi.tsx`) mostra e chiama. Il modulo di oggi non cambia:
// `prova:richieste` deve passare com'era.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { existsSync, readFileSync } from 'node:fs'

const { outputFiles } = await build({
  stdin: {
    contents: [
      "export * from './src/lib/passiIscrizione'",
      "export { corsiPerEta, LISTINO_PREDEFINITO } from './src/lib/listino'",
      "export { creaRichiesteProva } from './src/lib/richiesteProva'",
      "export { controlla, datiRichieste, domandaUscita, FILE } from './src/lib/richieste'",
      "export { carattereControllo, lettereCognome, lettereNome } from './src/lib/codiceFiscale'",
      "export { causale, stimaIscrizione } from './src/lib/nucleo'",
      // Tutta lib/sito, come spazio di nomi: una funzione che ancora manca cade sulla sua prova, non sul bundle.
      "export * as sito from './src/lib/sito'",
      "export { cfNatoIl, cfValido, codiceFinto } from './src/lib/codiceFiscale'",
      "export { dataDaCf, ESTENSIONI, MASSIMO_FILE, minorenne, problemi } from './src/lib/richieste'",
      "export { firmaVera } from './src/lib/tratti'",
      "export * as riempi from './src/lib/riempiPerProva'",
    ].join('\n'),
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
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }
// In prova niente va al server: se qualcuno chiama la rete, lo si vede.
let chiamateDiRete = 0
globalThis.fetch = async () => {
  chiamateDiRete++
  throw new Error('rete')
}

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
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che manca o rifiuta: la prova cade sul suo valore atteso, non ferma lo script.
const chiama = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
// Una famiglia (elenco di persone): se la funzione manca o rifiuta, un elenco vuoto, così le altre prove cadono sul loro valore atteso e non su un TypeError.
const lista = (f) => {
  try {
    return f()
  } catch {
    return []
  }
}

// --- i dati di prova --------------------------------------------------------

/** Un codice fiscale vero (carattere di controllo compreso), di Torino. */
const MESI = 'ABCDEHLMPRST'
const cfDi = (nome, cognome, natoIl, donna = false) => {
  const [a, mese, g] = natoIl.split('-')
  const q = m.lettereCognome(cognome) + m.lettereNome(nome) + a.slice(2) + MESI[Number(mese) - 1] + String(Number(g) + (donna ? 40 : 0)).padStart(2, '0') + 'L219'
  return q + m.carattereControllo(q)
}
const F = (nome) => new File(['x'], nome, { type: nome.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' })

const CF_LUCA = 'RSSLCU96A01L219K'
const CF_PAOLA = cfDi('Paola', 'Rossi', '1980-01-01', true)
const CF_MATTEO = cfDi('Matteo', 'Rossi', '2016-04-12')
const residenza = { indirizzo: 'Via Roma 1', cap: '10093', comune: 'Collegno' }
const contatti = { email: 'paola@esempio.it', telefono: '347 111 2233', telefono2: '' }
const genitore = { genitoreNome: 'Paola', genitoreCognome: 'Rossi', genitoreCodiceFiscale: CF_PAOLA }
const DOMANDA = 'LE RISPOSTE SI PERDONO · ESCI?'

/** Un adulto che ha compilato tutto: i quattro passi tornano. */
const adulto = (cambi = {}, sul = {}) => ({
  ...m.nuovoStato('adulto'),
  risposte: {
    nome: 'Luca', cognome: 'Rossi', natoIl: '1996-01-01', natoA: 'TORINO (TO)', codiceFiscale: CF_LUCA,
    ...residenza, ...contatti, corsi: ['judo-adulti'], formula: 'annuale', regolamento: true, ...cambi,
  },
  scelte: { tesseramento: true, foto: false },
  tratti: 5,
  file: { documento: F('documento.jpg') },
  privacy: true,
  ...sul,
})
/** Un bambino di dieci anni col genitore che firma, tutto compilato. */
const figlio = (cambi = {}, sul = {}) => ({
  ...m.nuovoStato('figlio'),
  risposte: {
    nome: 'Matteo', cognome: 'Rossi', natoIl: '2016-04-12', natoA: 'TORINO (TO)', codiceFiscale: CF_MATTEO,
    ...residenza, ...contatti, ...genitore, corsi: ['judo-3'], formula: 'annuale', regolamento: true, ...cambi,
  },
  scelte: { tesseramento: true, foto: true },
  tratti: 5,
  file: { documento: F('documento.jpg') },
  privacy: true,
  natoAGenitore: 'Torino',
  ...sul,
})
/**
 * Chi compila un bambino e si iscrive anche lui: un familiare come gli altri, legato al bambino 0. Nome, codice,
 * residenza, contatti, carta, firma e ok li prende dal bambino (`conDatiDellaFamiglia`); corso, formula, caselle
 * e certificato sono suoi.
 */
const io = (cambi = {}, sul = {}) => ({
  ...m.nuovoStato('adulto'),
  io: true,
  risposte: { ...m.nuovoStato('adulto').risposte, corsi: ['judo-adulti'], formula: 'annuale', ...cambi },
  scelte: { tesseramento: true, foto: true },
  ...sul,
})
/** La richiesta di Paola, la mamma di Matteo che si iscrive con lui: quella che oggi fa `richiestaDelGenitore`, scritta a mano. */
const richiestaDiPaola = (cambi = {}) => ({
  nome: 'Paola', cognome: 'Rossi', natoIl: '1980-01-01', natoA: 'TORINO (TO)', codiceFiscale: CF_PAOLA,
  ...residenza, ...contatti, genitoreNome: '', genitoreCognome: '', genitoreCodiceFiscale: '',
  corsi: ['judo-adulti'], formula: 'annuale', regolamento: true, ...cambi,
})
// L'ordine delle pastiglie lo decide la schermata: qui conta quali sono.
const nomi = (stato, passo) => [...m.mancaNelPasso(stato, passo)].sort()

// ---------------------------------------------------------------------------
console.log('\n1. dove si apre: solo in prova, solo con #nuova')
{
  ok('col database vero e #nuova: la pagina di oggi', m.flussoNuovoAcceso(true, '#nuova'), false)
  ok('in prova e #nuova: il flusso nuovo', m.flussoNuovoAcceso(false, '#nuova'), true)
  ok('in prova senza #nuova: la pagina di oggi', m.flussoNuovoAcceso(false, ''), false)
  ok('in prova con un altro cancelletto: la pagina di oggi', m.flussoNuovoAcceso(false, '#altro'), false)
  ok('col database vero, senza cancelletto: la pagina di oggi', m.flussoNuovoAcceso(true, ''), false)
}

// ---------------------------------------------------------------------------
console.log('\n2. in prova le richieste restano sul dispositivo')
{
  const r = m.creaRichiesteProva()
  const dati = { ...adulto().risposte, email: 'luca@esempio.it' }
  const esito = await m.mandaRichieste(r, [{ dati, file: { documento: F('documento.jpg') }, faiPdf: async () => F('modulo.pdf') }])
  ok('è andata a buon fine', esito.esito, 'fatto')
  const tutte = await r.richieste()
  ok('una richiesta, nuova', tutte.map((x) => [x.stato, x.codiceFiscale]), [['nuova', CF_LUCA]])
  ok('con i suoi due file', (await r.file(tutte[0].id)).map((f) => f.tipo).sort(), ['documento', 'modulo'])
  ok('nessuna chiamata alla rete', chiamateDiRete, 0)
}

// ---------------------------------------------------------------------------
console.log('\n4. i passi')
{
  // Il nome del passo è corto e senza articolo: sta sotto le tre tappe (docs/design-canvas/navigazione-passi/).
  const ADULTO = ['DATI', 'CORSO', 'FIRMA', 'DOCUMENTI', 'FAMIGLIA', 'PAGAMENTO', 'INVIO']
  const FIGLIO = ['BAMBINO', 'CHI FIRMA', 'CORSO', 'FIRMA', 'DOCUMENTI', 'FAMIGLIA', 'PAGAMENTO', 'INVIO']
  ok('adulto: sette passi', m.passiDi('adulto'), ADULTO)
  ok('figlio: otto passi', m.passiDi('figlio'), FIGLIO)
  const articolo = /^(IL|LA|I|LE|GLI|LO) |^L[’']/
  for (const chi of ['adulto', 'figlio']) ok(`nessun nome di passo comincia con un articolo (${chi})`, m.passiDi(chi).filter((n) => articolo.test(n)), [])
  // In famiglia i dati del secondo adulto non sono di chi compila: il titolo dice di chi sono.
  const conNome = (nome) => ({ ...m.nuovoStato('adulto'), risposte: { ...m.nuovoStato('adulto').risposte, nome } })
  ok('chi compila: DATI', m.nomiDeiPassi(conNome('Paolo'), 0)[0], 'DATI')
  ok('l’io, anche se non è al posto 0: DATI', m.nomiDeiPassi({ ...conNome('Paolo'), io: true }, 1)[0], 'DATI')
  ok('il secondo adulto, col nome: DATI DI MARIA', m.nomiDeiPassi(conNome('maria'), 1)[0], 'DATI DI MARIA')
  ok('il secondo adulto, senza nome: DATI DI ADULTO 2', m.nomiDeiPassi(conNome(''), 1)[0], 'DATI DI ADULTO 2')
  ok('gli altri passi non cambiano', m.nomiDeiPassi(conNome('Maria'), 1).slice(1), ADULTO.slice(1))
  ok('un bambino aggiunto: come sempre', m.nomiDeiPassi(m.nuovoStato('figlio'), 2), FIGLIO)
  // Cosa si fa in ogni passo lo dice la lib: la schermata non ripete l'ordine.
  ok('tipi: adulto', m.tipiDiPassi('adulto'), ['dati', 'corso', 'modulo', 'documenti', 'famiglia', 'pagamento', 'riepilogo'])
  ok('tipi: figlio', m.tipiDiPassi('figlio'), ['dati', 'genitore', 'corso', 'modulo', 'documenti', 'famiglia', 'pagamento', 'riepilogo'])
  for (const chi of ['adulto', 'figlio']) ok(`tipi e nomi dei passi sono tanti uguali (${chi})`, m.tipiDiPassi(chi).length, m.passiDi(chi).length)
}

// ---------------------------------------------------------------------------
console.log('\n5. ogni AVANTI guarda solo il suo passo')
{
  ok('adulto, passo 1 a posto: nessuna pastiglia', nomi(adulto(), 1), [])
  ok('adulto, passo 1 a posto: avanza al 2', m.avanti(adulto(), 1), { passo: 2, manca: [] })
  const corto = adulto({ codiceFiscale: 'RSSLCU96A01L219' })
  ok('un codice fiscale di 15 caratteri: CODICE FISCALE', nomi(corto, 1), ['CODICE FISCALE'])
  ok('e non avanza', m.avanti(corto, 1), { passo: 1, manca: ['CODICE FISCALE'] })
  ok('il primo campo da correggere, per il focus', m.primoDaCorreggere(corto, 1), 'codiceFiscale')
  ok('a posto: nessun campo da correggere', m.primoDaCorreggere(adulto(), 1), undefined)
  const vuoto = adulto({ nome: '', email: 'a@b', cap: '100' })
  ok('manca e scritto male contano tutti e due', nomi(vuoto, 1), ['CAP', 'EMAIL', 'NOME'])
  ok('un campo di un altro passo non ferma questo', nomi(adulto({ corsi: [], formula: 'annuale' }), 1), [])
  ok('passo 2: nessun corso', nomi(adulto({ corsi: [] }), 2), ['CORSO'])
  ok('passo 4 (i documenti): manca il documento', nomi(adulto({}, { file: {} }), 4), ["CARTA D'IDENTITÀ"])
  ok('passo 3 (il modulo): la carta d’identità non lo ferma più', nomi(adulto({}, { file: {} }), 3), [])
  ok('passo 3: manca la privacy', nomi(adulto({}, { privacy: false }), 3), ['INFORMATIVA PRIVACY'])
  ok('passo 3: manca il regolamento', nomi(adulto({ regolamento: false }), 3), ['REGOLAMENTO'])
  ok('passo 3: nessuna firma né caselle', nomi(adulto({}, { tratti: 0, scelte: {} }), 3), ['FIRMA', 'FOTO', 'TESSERAMENTO'])
  ok('passo 3: col foglio firmato non serve la firma', nomi(adulto({}, { tratti: 0, scelte: {}, file: { documento: F('d.jpg'), modulo: F('m.jpg') } }), 3), [])
  ok('il retro, il certificato e la ricevuta non fermano (modulo e documenti)', [nomi(adulto(), 3), nomi(adulto(), 4)], [[], []])
  ok('i documenti: a posto con la sola carta', nomi(adulto({}, { tratti: 0, scelte: {}, privacy: false }), 4), [])
  ok('l’ultimo passo (7) rimette insieme tutto: a posto', nomi(adulto(), 7), [])
  ok('l’ultimo passo (7) rimette insieme tutto: manca un nome', nomi(adulto({ nome: '' }), 7), ['NOME'])
  ok('l’ultimo passo (7) rimette insieme tutto: modulo e documenti, senza doppioni', nomi(adulto({}, { file: {}, privacy: false }), 7), ["CARTA D'IDENTITÀ", 'INFORMATIVA PRIVACY'])
  ok('il passo del corso non chiede più il pagamento: la ricevuta non manca mai', nomi(adulto(), 2), [])

  ok('figlio, passo 1 a posto', nomi(figlio(), 1), [])
  ok('figlio, passo 2: il genitore non c’è', nomi(figlio({ genitoreNome: '', genitoreCodiceFiscale: '' }), 2), ['CODICE FISCALE DEL GENITORE', 'NOME DEL GENITORE'])
  ok('figlio, passo 2: contatti a posto', nomi(figlio(), 2), [])
  // «Ti iscrivi anche tu?» sta in LA FAMIGLIA: il passo del corso chiede solo il corso del bambino.
  ok('figlio, passo 3: senza corso, solo CORSO (niente «anche te?»)', nomi(figlio({ corsi: [] }), 3), ['CORSO'])
  ok('figlio, passo 3: col corso, a posto', nomi(figlio(), 3), [])
  ok('figlio, passo 2: dove sei nato, se il luogo non si ricava dal codice', nomi(figlio({}, { natoAGenitore: ' ' }), 2), ['DOVE SEI NATO'])
  ok('figlio, passo 4 (il modulo): dove è nato il genitore non manca più', nomi(figlio({}, { natoAGenitore: ' ' }), 4), [])
  ok('figlio, passo 4 (il modulo): la carta d’identità non lo ferma', nomi(figlio({}, { file: {} }), 4), [])
  ok('figlio, passo 5 (i documenti): manca la carta del genitore', nomi(figlio({}, { file: {} }), 5), ["CARTA D'IDENTITÀ"])
  ok('figlio, passo 5 (i documenti): retro, certificato e ricevuta non fermano', nomi(figlio(), 5), [])
  ok('figlio con il genitore col codice del bambino: ferma', nomi(figlio({ genitoreCodiceFiscale: CF_MATTEO }), 2), ['CODICE FISCALE DEL GENITORE'])

  const sotto = (e, provato, visto) => m.notaSottoIlCampo(e, provato, visto)
  ok('«Manca» prima di provare: niente', sotto('Manca', false, true), undefined)
  ok('«Manca» dopo il tentativo: si scrive', sotto('Manca', true, false), 'Manca')
  ok('«scritto male» appena si lascia il campo', sotto('Non torna', false, true), 'Non torna')
  ok('«scritto male» finché non si lascia il campo: niente', sotto('Non torna', false, false), undefined)
  ok('senza errore: niente', sotto(undefined, true, true), undefined)
}

// ---------------------------------------------------------------------------
console.log('\n6. la scelta e il codice fiscale: combaciano?')
{
  const conCf = (cf, sul = {}) => adulto({ codiceFiscale: cf, natoIl: '' }, sul)
  const MINORE = { verdetto: 'minore', domanda: 'Stai iscrivendo un bambino?' }
  const ADULTO = { verdetto: 'adulto', domanda: 'Ti stai iscrivendo tu?' }
  ok('adulto con un codice da bambino: «è un minore»', m.controlloScelta(conCf(CF_MATTEO)), MINORE)
  ok('e AVANTI è bloccato dal CODICE FISCALE', nomi(conCf(CF_MATTEO), 1), ['CODICE FISCALE'])
  ok('adulto con un codice da adulto: niente', m.controlloScelta(conCf(CF_LUCA)), null)
  const nel = (cf) => figlio({ codiceFiscale: cf, natoIl: '' })
  ok('figlio con un codice da adulto: «è un adulto»', m.controlloScelta(nel(CF_LUCA)), ADULTO)
  ok('e AVANTI è bloccato dal CODICE FISCALE', nomi(nel(CF_LUCA), 1), ['CODICE FISCALE'])
  ok('figlio con un codice da bambino: niente', m.controlloScelta(nel(CF_MATTEO)), null)
  ok('codice incompleto: nessun verdetto', m.controlloScelta(conCf('RSSMTT16D12')), null)
  ok('codice di 15 caratteri: nessun verdetto', m.controlloScelta(conCf(CF_MATTEO.slice(0, 15))), null)
  ok('codice che non torna (ultima lettera): nessun verdetto', m.controlloScelta(conCf(CF_MATTEO.slice(0, 15) + (CF_MATTEO[15] === 'A' ? 'B' : 'A'))), null)
  ok('senza codice: nessun verdetto', m.controlloScelta(conCf('')), null)
  // Oggi è il 26/9/2026: come minorenne() di oggi.
  const nato = (giorno) => cfDi('Luca', 'Rossi', giorno)
  ok('diciotto anni oggi: adulto, nessun verdetto per un adulto', m.controlloScelta(conCf(nato('2008-09-26'))), null)
  ok('diciotto anni oggi: per «mio figlio» è un adulto', m.controlloScelta(nel(nato('2008-09-26'))), ADULTO)
  ok('diciotto anni ieri: adulto', m.controlloScelta(conCf(nato('2008-09-25'))), null)
  ok('diciotto anni domani: ancora minore', m.controlloScelta(conCf(nato('2008-09-27'))), MINORE)
  ok('diciotto anni domani: per «mio figlio» va bene', m.controlloScelta(nel(nato('2008-09-27'))), null)
  ok('ricontrollo all’invio: l’ultimo passo (7) lo vede', nomi(conCf(CF_MATTEO), 7).includes('CODICE FISCALE'), true)
}

// ---------------------------------------------------------------------------
console.log('\n7. cambiare scelta: si tiene quel che è uguale, il foglio si rifà')
{
  const firmato = adulto({}, { tratti: 3, scelte: { tesseramento: true, foto: true }, file: { documento: F('d.jpg'), modulo: F('m.jpg') } })
  const mutato = m.cambiaScelta({ ...firmato, risposte: { ...firmato.risposte, codiceFiscale: CF_MATTEO, nome: 'Matteo', natoIl: '' } }, 'figlio')
  const r = mutato.risposte
  ok('ora è un figlio', mutato.chi, 'figlio')
  ok('restano nome, cognome, codice fiscale', [r.nome, r.cognome, r.codiceFiscale], ['Matteo', 'Rossi', CF_MATTEO])
  ok('resta la residenza', [r.indirizzo, r.cap, r.comune], ['Via Roma 1', '10093', 'Collegno'])
  ok('restano i contatti (ora del genitore)', [r.email, r.telefono], ['paola@esempio.it', '347 111 2233'])
  ok('i tratti della firma sono azzerati', mutato.tratti, 0)
  ok('le caselle sono azzerate', mutato.scelte, {})
  ok('la foto del foglio è tolta', mutato.file.modulo, undefined)
  ok('il documento resta', mutato.file.documento?.name, 'd.jpg')
  ok('l’avviso dice chi firma ora', mutato.avvisoFirma, 'Firma e autorizzazioni vanno rifatte: ora firma il genitore.')

  const indietroAdulto = m.cambiaScelta(figlio({}, { tratti: 2 }), 'adulto')
  const a = indietroAdulto.risposte
  ok('dal figlio all’adulto: ora è un adulto', indietroAdulto.chi, 'adulto')
  ok('restano nome, cognome, codice fiscale, residenza, contatti', [a.nome, a.cognome, a.codiceFiscale, a.indirizzo, a.email, a.telefono], ['Matteo', 'Rossi', CF_MATTEO, 'Via Roma 1', 'paola@esempio.it', '347 111 2233'])
  ok('il genitore non c’è più', [a.genitoreNome, a.genitoreCognome, a.genitoreCodiceFiscale].map((x) => x || ''), ['', '', ''])
  ok('firma azzerata e avviso: ora firma chi si iscrive', [indietroAdulto.tratti, indietroAdulto.avvisoFirma], [0, 'Firma e autorizzazioni vanno rifatte: ora firma chi si iscrive.'])

  const pulito = m.cambiaScelta(adulto({}, { tratti: 0, scelte: {}, file: {} }), 'figlio')
  ok('se non c’era niente da rifare, nessun avviso', pulito.avvisoFirma, undefined)
}

// ---------------------------------------------------------------------------
console.log('\n8. INDIETRO e uscire')
{
  const vuoto = m.nuovoStato('adulto')
  const esce = (s) => m.domandaUscita(m.perDomandaUscita(s))
  ok('appena aperto: si esce senza domanda', esce(vuoto), undefined)
  ok('un campo scritto: chiede', esce({ ...vuoto, risposte: { ...vuoto.risposte, nome: 'Luca' } }), DOMANDA)
  ok('una scelta (casella): chiede', esce({ ...vuoto, scelte: { foto: true } }), DOMANDA)
  ok('un tratto di firma: chiede', esce({ ...vuoto, tratti: 1 }), DOMANDA)
  ok('un file: chiede', esce({ ...vuoto, file: { documento: F('d.jpg') } }), DOMANDA)
  ok('la privacy: chiede', esce({ ...vuoto, privacy: true }), DOMANDA)
  ok('il regolamento: chiede', esce({ ...vuoto, risposte: { ...vuoto.risposte, regolamento: true } }), DOMANDA)
  ok('un corso: chiede', esce({ ...vuoto, risposte: { ...vuoto.risposte, corsi: ['judo-adulti'] } }), DOMANDA)
  ok('il luogo del genitore solo spazi: senza domanda', esce({ ...vuoto, natoAGenitore: '  ' }), undefined)
  ok('lo stato compilato chiede', esce(adulto()), DOMANDA)

  ok('dal passo 2 si torna al passo prima, senza domande', m.indietro(2, DOMANDA), { a: 'passo', passo: 1 })
  ok('dal passo 5 si torna al 4', m.indietro(5, DOMANDA), { a: 'passo', passo: 4 })
  ok('dal passo 1, con qualcosa scritto: alla scelta, con la domanda', m.indietro(1, DOMANDA), { a: 'scelta', chiede: DOMANDA })
  ok('dal passo 1, vuoto: alla scelta, senza domanda', m.indietro(1, undefined), { a: 'scelta' })
}

// ---------------------------------------------------------------------------
console.log('\n9. nessuna bozza')
{
  const prima = [...memoria.keys()].sort().join()
  const s = figlio({}, { tratti: 3 })
  for (let p = 1; p <= 7; p++) m.mancaNelPasso(s, p)
  m.controlloScelta(s)
  m.cambiaScelta(s, 'adulto')
  m.righeRiepilogo(s, [{ id: 'judo-3', nome: 'Judo 3' }])
  m.perDomandaUscita(s)
  m.perUnAltroFiglio(s)
  ok('compilando, nessuna chiave nuova in localStorage', [...memoria.keys()].sort().join(), prima)
  for (const f of ['src/lib/passiIscrizione.ts', 'src/components/IscrizioneAPassi.tsx'])
    if (existsSync(f)) ok(`${f}: niente localStorage, sessionStorage, IndexedDB`, /localStorage|sessionStorage|indexedDB/i.test(readFileSync(f, 'utf8')), false)

  const inizio = m.perUnAltroFiglio(figlio({}, { tratti: 5 }))
  const r = inizio.risposte
  ok('un altro figlio: restano i dati del genitore', [r.genitoreNome, r.genitoreCognome, r.genitoreCodiceFiscale, r.indirizzo, r.cap, r.comune, r.email, r.telefono], ['Paola', 'Rossi', CF_PAOLA, 'Via Roma 1', '10093', 'Collegno', 'paola@esempio.it', '347 111 2233'])
  ok('il bambino è da scrivere', [r.nome, r.cognome, r.codiceFiscale, r.natoIl, r.natoA, r.corsi], ['', '', '', '', '', []])
  ok('firma, caselle, file e privacy si rifanno', [inizio.tratti, inizio.scelte, inizio.file, inizio.privacy], [0, {}, {}, false])
  ok('è ancora un figlio', inizio.chi, 'figlio')
  ok('i dati del genitore già dentro non fanno chiedere se si esce', m.domandaUscita(m.perDomandaUscita(inizio)), undefined)
}

// ---------------------------------------------------------------------------
console.log('\n10. le risposte che partono, quelle di oggi')
{
  const a = m.risposteDaiPassi(adulto())
  ok('adulto completo: controlla() torna null', m.controlla(a), null)
  ok('adulto: genitore* vuoto', [a.genitoreNome, a.genitoreCognome, a.genitoreCodiceFiscale].map((x) => x || ''), ['', '', ''])
  const vecchio = m.risposteDaiPassi(adulto({ genitoreNome: 'Avanzo', genitoreCognome: 'Di Prima', genitoreCodiceFiscale: CF_PAOLA }))
  ok('adulto: il genitore di una scelta di prima non parte', [vecchio.genitoreNome, vecchio.genitoreCognome, vecchio.genitoreCodiceFiscale].map((x) => x || ''), ['', '', ''])
  const f = m.risposteDaiPassi(figlio())
  ok('figlio: controlla() torna null', m.controlla(f), null)
  ok('figlio: genitore* pieno', [f.genitoreNome, f.genitoreCognome, f.genitoreCodiceFiscale], ['Paola', 'Rossi', CF_PAOLA])
  ok('figlio: il genitore minorenne', m.controlla(m.risposteDaiPassi(figlio({ genitoreCodiceFiscale: cfDi('Paola', 'Rossi', '2012-01-01', true) }))), 'Il codice fiscale del genitore è di un minorenne')
  ok('figlio: il genitore col codice del bambino', m.controlla(m.risposteDaiPassi(figlio({ genitoreCodiceFiscale: CF_MATTEO }))), 'Il codice fiscale del genitore è lo stesso di chi si iscrive')
}

// ---------------------------------------------------------------------------
console.log('\n11. i file da chiedere')
{
  const tipi = (x) => x.file.map((f) => f.tipo)
  const cinque = m.fileDaChiedere('2021-09-26', ['Judo bambini'])
  ok('5 anni: nessun certificato', [cinque.certificato, tipi(cinque)], ['nessuno', ['modulo', 'documento', 'documento-retro', 'ricevuta']])
  const sei = m.fileDaChiedere('2020-09-26', ['Judo bambini'])
  ok('6 anni oggi: certificato normale', [sei.certificato, tipi(sei)], ['normale', ['modulo', 'documento', 'documento-retro', 'certificato', 'ricevuta']])
  const dodici = m.fileDaChiedere('2014-09-26', ['Judo ragazzi'])
  ok('12 anni a judo: agonistico', dodici.certificato, 'agonistico')
  ok('12 anni a pilates: normale', m.fileDaChiedere('2014-09-26', ['Pilates']).certificato, 'normale')
  ok('senza data: nessun certificato', m.fileDaChiedere('', ['Judo']).certificato, 'nessuno')
  const ob = (x, t) => x.file.find((f) => f.tipo === t).obbligatorio
  ok('il documento è obbligatorio', ob(dodici, 'documento'), true)
  ok('il modulo è obbligatorio', ob(dodici, 'modulo'), true)
  ok('il retro è facoltativo', ob(dodici, 'documento-retro'), false)
  ok('il certificato è sempre facoltativo', [ob(dodici, 'certificato'), ob(sei, 'certificato')], [false, false])
  ok('la ricevuta è facoltativa', ob(dodici, 'ricevuta'), false)
}

// ---------------------------------------------------------------------------
console.log('\n12. mandare: il PDF, le richieste, i file')
{
  const finto = () => {
    const log = []
    const inviati = []
    const guasti = { invia: null, file: null }
    let n = 0
    return {
      log, inviati, guasti, modo: 'prova',
      async invia(dati) {
        log.push(`invia ${dati.nome}`)
        const g = guasti.invia?.(dati)
        if (g !== undefined && g !== null) throw g
        inviati.push(dati)
        return `r${++n}`
      },
      async caricaFile(id, tipo) {
        log.push(`file ${id} ${tipo}`)
        const g = guasti.file?.(tipo, id)
        if (g !== undefined && g !== null) throw g
      },
    }
  }
  const pdf = (log, nome) => async () => {
    log.push(`pdf ${nome}`)
    return F('modulo-firmato.pdf')
  }

  // Un adulto solo.
  {
    const d = finto()
    const dati = m.risposteDaiPassi(adulto())
    const e = await m.mandaRichieste(d, [{ dati, file: { documento: F('d.jpg'), ricevuta: F('r.jpg') }, faiPdf: pdf(d.log, 'Luca') }])
    ok('adulto: il PDF, poi la richiesta, poi i file nell’ordine di FILE', d.log, ['pdf Luca', 'invia Luca', 'file r1 modulo', 'file r1 documento', 'file r1 ricevuta'])
    ok('adulto: esito', [e.esito, e.ids], ['fatto', ['r1']])
    ok('adulto: le note non si toccano', d.inviati[0].note, undefined)
  }
  // Il foglio firmato a mano: niente PDF da fare.
  {
    const d = finto()
    await m.mandaRichieste(d, [{ dati: m.risposteDaiPassi(adulto()), file: { modulo: F('foglio.jpg'), documento: F('d.jpg') } }])
    ok('col foglio scelto non si fa il PDF', d.log, ['invia Luca', 'file r1 modulo', 'file r1 documento'])
  }
  // Il PDF non viene: non nasce niente.
  {
    const d = finto()
    // L'errore vero va solo in console: qui lo si tace per non sporcare l'elenco.
    const consoleErrorVera = console.error
    console.error = () => {}
    const e = await m.mandaRichieste(d, [{ dati: m.risposteDaiPassi(adulto()), file: {}, faiPdf: async () => { throw new Error('boom') } }])
    console.error = consoleErrorVera
    ok('il PDF non viene: nessuna richiesta, si dice cosa fare con le parole dell’app, senza il testo grezzo', [e.esito, e.perche, d.log], ['fermo', 'Non riesco a preparare il modulo con la tua firma. Riprova fra un momento. Se non va, torna indietro, scegli «Ho il foglio firmato», firma il modulo a mano e carica la foto.', []])
  }
  // Con più richieste il foglio in foto non c'è tra le scelte: si manda alla segreteria.
  {
    const d = finto()
    const consoleErrorVera = console.error
    console.error = () => {}
    const pdfNo = async () => { throw new Error('boom') }
    const e = await m.mandaRichieste(d, [
      { dati: m.risposteDaiPassi(adulto()), file: {}, faiPdf: pdfNo },
      { dati: m.risposteDaiPassi(adulto({ nome: 'Paola' })), file: {}, faiPdf: pdfNo },
    ])
    console.error = consoleErrorVera
    ok('il PDF non viene con due richieste: niente foglio in foto, si chiama la segreteria', e.perche, 'Non riesco a preparare il modulo con la tua firma. Riprova fra un momento. Se non va, chiama la segreteria.')
  }
  // Il server non risponde.
  {
    const d = finto()
    d.guasti.invia = () => 'giù'
    const e = await m.mandaRichieste(d, [{ dati: m.risposteDaiPassi(adulto()), file: { documento: F('d.jpg') }, faiPdf: pdf(d.log, 'Luca') }])
    ok('invia che non risponde: si resta, in italiano semplice', [e.esito, e.perche], ['fermo', 'Il server non risponde: riprova fra poco'])
    ok('e non parte nessun file', d.log.some((x) => x.startsWith('file')), false)
    const d2 = finto()
    d2.guasti.invia = () => new Error('Mancano: nome')
    ok('invia che rifiuta: il messaggio del server', (await m.mandaRichieste(d2, [{ dati: m.risposteDaiPassi(adulto()), file: {} }])).perche, 'Mancano: nome')
  }
  // Un file che non parte: si riprova solo quello.
  {
    const d = finto()
    d.guasti.file = (tipo) => (tipo === 'documento' ? new Error('Il file non è partito') : null)
    const e = await m.mandaRichieste(d, [{ dati: m.risposteDaiPassi(adulto()), file: { documento: F('d.jpg'), ricevuta: F('r.jpg') }, faiPdf: pdf(d.log, 'Luca') }])
    ok('un file che non parte: MANCA QUALCHE FILE con quel tipo', [e.esito, e.mancati, e.perche], ['file', [{ richiesta: 0, tipo: 'documento' }], 'Il file non è partito'])
    ok('gli altri sono partiti', d.log, ['pdf Luca', 'invia Luca', 'file r1 modulo', 'file r1 documento', 'file r1 ricevuta'])
    d.guasti.file = null
    d.log.length = 0
    const e2 = await e.riprova()
    ok('RIPROVA rimanda solo quello', d.log, ['file r1 documento'])
    ok('e finisce bene', e2.esito, 'fatto')
  }

  // Il bambino, poi la mamma che si iscrive con lui.
  const duePersone = (d) => {
    const bambino = m.risposteDaiPassi(figlio())
    const lui = richiestaDiPaola()
    const doc = F('d.jpg')
    return [
      { dati: bambino, file: { documento: doc, ricevuta: F('r.jpg') }, faiPdf: pdf(d.log, 'Matteo') },
      { dati: lui, file: { documento: doc, certificato: F('c.pdf'), ricevuta: F('r.jpg') }, faiPdf: pdf(d.log, 'Paola') },
    ]
  }
  {
    const d = finto()
    const e = await m.mandaRichieste(d, duePersone(d))
    ok('bambino e mamma: i due PDF, poi il bambino e i suoi file, poi il genitore e i suoi', d.log, [
      'pdf Matteo', 'pdf Paola',
      'invia Matteo', 'file r1 modulo', 'file r1 documento', 'file r1 ricevuta',
      'invia Paola', 'file r2 modulo', 'file r2 documento', 'file r2 certificato', 'file r2 ricevuta',
    ])
    ok('bambino e mamma: due richieste arrivate', [e.esito, e.ids], ['fatto', ['r1', 'r2']])
    ok('bambino e mamma: il bambino porta il legame col genitore', d.inviati[0].note, 'mandata insieme alla richiesta di Paola Rossi, sconto famiglia da applicare')
    ok('bambino e mamma: il genitore porta il legame col bambino', d.inviati[1].note, 'mandata insieme alla richiesta di Matteo Rossi, sconto famiglia da applicare')
  }
  {
    const d = finto()
    const [b, g] = duePersone(d)
    await m.mandaRichieste(d, [{ ...b, dati: { ...b.dati, note: 'Preferiamo il martedì' } }, g])
    ok('le note scritte restano, il legame va a capo', d.inviati[0].note, 'Preferiamo il martedì\nmandata insieme alla richiesta di Paola Rossi, sconto famiglia da applicare')
  }
  // Il database accetta note fino a 1000 caratteri: la riga di legame ci deve stare nel margine lasciato a chi scrive.
  {
    const d = finto()
    const [b, g] = duePersone(d)
    await m.mandaRichieste(d, [
      { ...b, dati: { ...b.dati, nome: 'MATTEO', cognome: 'rossi', note: 'x'.repeat(m.MASSIMO_NOTE) } },
      { ...g, dati: { ...g.dati, nome: 'paola', cognome: 'ROSSI', note: 'x'.repeat(m.MASSIMO_NOTE) } },
    ])
    ok('note al massimo (900) più il legame: restano sotto i 1000 del database', [m.MASSIMO_NOTE, d.inviati.map((x) => x.note.length <= 1000)], [900, [true, true]])
    ok('nel legame il nome è scritto come lo scrive invia: nomeProprio', d.inviati[0].note.endsWith('\nmandata insieme alla richiesta di Paola Rossi, sconto famiglia da applicare'), true)
  }
  // La seconda si ferma (6 richieste al giorno per email, e questa è la settima): la prima è arrivata.
  {
    const d = finto()
    const MSG = 'Da questa email sono già arrivate 6 richieste oggi: se serve, scrivi alla segreteria'
    d.guasti.invia = (dati) => (dati.nome === 'Paola' ? new Error(MSG) : null)
    const e = await m.mandaRichieste(d, duePersone(d))
    ok('la seconda no: prima arrivata, seconda no, con il motivo', [e.esito, e.perche, e.ids], ['secondaNo', MSG, ['r1']])
    ok('i file del bambino sono partiti lo stesso', d.log.filter((x) => x.startsWith('file')), ['file r1 modulo', 'file r1 documento', 'file r1 ricevuta'])
    d.guasti.invia = null
    d.log.length = 0
    const e2 = await e.riprova()
    ok('RIPROVA manda solo la seconda: mai un doppione del bambino', d.log.filter((x) => x === 'invia Matteo').length, 0)
    ok('RIPROVA: la richiesta del genitore e i suoi file, il PDF già fatto non si rifà', d.log, ['invia Paola', 'file r2 modulo', 'file r2 documento', 'file r2 certificato', 'file r2 ricevuta'])
    ok('RIPROVA: finisce bene, con tutte e due le richieste', [e2.esito, e2.ids], ['fatto', ['r1', 'r2']])
  }
  // Se è il bambino a non partire, non nasce niente.
  {
    const d = finto()
    d.guasti.invia = () => new Error('giù davvero')
    const e = await m.mandaRichieste(d, duePersone(d))
    ok('il bambino non parte: ci si ferma, il genitore non parte da solo', [e.esito, d.log.filter((x) => x === 'invia Paola').length], ['fermo', 0])
  }
  // Un file della seconda non parte.
  {
    const d = finto()
    d.guasti.file = (tipo, id) => (id === 'r2' && tipo === 'certificato' ? new Error('troppo grande') : null)
    const e = await m.mandaRichieste(d, duePersone(d))
    ok('un file del genitore non parte: si dice quale e di chi', [e.esito, e.mancati], ['file', [{ richiesta: 1, tipo: 'certificato' }]])
    d.guasti.file = null
    d.log.length = 0
    await e.riprova()
    ok('RIPROVA rimanda solo quello', d.log, ['file r2 certificato'])
  }
  // La prova vera: il limite per email è sei al giorno (come `per_email_al_giorno` di 49-richieste-per-email.sql), non più tre.
  {
    memoria.clear()
    const r = m.creaRichiesteProva()
    const MSG6 = 'Da questa email sono già arrivate 6 richieste oggi: se serve, scrivi alla segreteria'
    const adultoDi = (nome, cognome, natoIl, email = 'famiglia@esempio.it') =>
      adulto({ nome, cognome, natoIl, codiceFiscale: cfDi(nome, cognome, natoIl), email }).risposte
    for (const [nome, cognome, natoIl] of [['Luca', 'Rossi', '1996-01-01'], ['Marco', 'Verdi', '1990-03-03'], ['Elio', 'Verdi', '1992-03-03'], ['Dino', 'Verdi', '1994-03-03']])
      // Col limite di oggi (3) il quarto si ferma: la prova non deve cadere qui, ma sotto, dove si conta.
      await r.invia(adultoDi(nome, cognome, natoIl)).catch(() => {})
    const bambino = m.risposteDaiPassi(figlio({ email: 'famiglia@esempio.it' }))
    const lui = richiestaDiPaola({ email: 'famiglia@esempio.it' })
    const e = await m.mandaRichieste(r, [{ dati: bambino, file: {} }, { dati: lui, file: {} }])
    ok('con la prova vera: la quinta e la sesta passano, tutte e due', [e.esito, e.ids?.length], ['fatto', 2])
    ok('e in elenco ci sono sei richieste nuove', (await r.richieste()).map((x) => x.stato), ['nuova', 'nuova', 'nuova', 'nuova', 'nuova', 'nuova'])
    const settima = await m.mandaRichieste(r, [{ dati: adultoDi('Ugo', 'Verdi', '1993-03-03'), file: {} }])
    ok('la settima dalla stessa email si ferma, col numero giusto', [settima.esito, settima.perche], ['fermo', MSG6])
    ok('un’altra email non è toccata', (await m.mandaRichieste(r, [{ dati: adultoDi('Ugo', 'Verdi', '1993-03-03', 'altra@esempio.it'), file: {} }])).esito, 'fatto')
    ok('ancora niente rete', chiamateDiRete, 0)
  }
}

// ---------------------------------------------------------------------------
console.log('\n13. bambino e mamma (l’io): il conto, il corso parallelo, la richiesta della mamma')
{
  const voce = (corso, corsoId, natiDal, natiAl, orari, annuale, trimestre) => ({
    corso, corsoId, eta: '', orari, natiDal, natiAl, prezzi: [{ saldo: annuale, annuale, trimestre }],
  })
  const ORARIO = 'martedì e giovedì 17.30-18.30'
  const listino = {
    quota: 50,
    saldoEntro: '2026-08-31',
    offerte: [],
    corsi: [
      voce('Judo 3', 'judo-3', 2013, 2016, [ORARIO], 300, 120),
      voce('Judo adulti', 'judo-adulti', undefined, 2012, [ORARIO], 360, 140),
      voce('Judo 2', 'judo-2', 2017, 2019, [ORARIO], 280, 110),
      voce('Aikido adulti', 'aikido-adulti', undefined, 2012, ['lunedì 20.00-21.00'], 340, 130),
    ],
  }
  const corsi = [
    { id: 'judo-3', nome: 'Judo 3' },
    { id: 'judo-adulti', nome: 'Judo adulti' },
    { id: 'judo-2', nome: 'Judo 2' },
    { id: 'aikido-adulti', nome: 'Aikido adulti' },
  ]
  const giorno = '2026-10-06'
  const conto = (formulaGenitore) =>
    m.contoFamiglia(
      [
        { chi: 'Matteo', corsi: [corsi[0]], formula: 'annuale' },
        { chi: 'Paola', corsi: [corsi[1]], formula: formulaGenitore },
      ],
      giorno,
      listino,
    )
  const annuali = conto('annuale')
  ok('due annuali: 50+300 e 50+360, meno 60 €: 700 €', annuali.totale, 70000)
  ok('lo sconto è il 20% sull’annuale più basso, quota esclusa', annuali.sconto, 6000)
  ok('lo sconto è una riga del conto', annuali.righe.filter((r) => r.importo < 0).map((r) => r.importo), [-6000])
  const trimestre = conto('trimestre')
  ok('con un trimestre: 50+300+50+140 = 540 €, nessuno sconto', [trimestre.totale, trimestre.sconto], [54000, undefined])
  ok('con due trimestri nessuno sconto', m.contoFamiglia([{ chi: 'Matteo', corsi: [corsi[0]], formula: 'trimestre' }, { chi: 'Paola', corsi: [corsi[1]], formula: 'trimestre' }], giorno, listino).sconto, undefined)

  // I corsi alla stessa ora ora si contano dal calendario: le prove sono in 13b.

  // La mamma che si iscrive col bambino è l'io: la sua richiesta prende chi è dal bambino 0.
  const pdfFinto = async () => F('m.pdf')
  const lui = lista(() => m.richiesteDelModulo(m.conDatiDellaFamiglia([figlio(), io({ formula: 'trimestre' })]), (p) => m.richiesteDaMandare(p, 'TO', pdfFinto)))[1]?.dati ?? {}
  ok('la richiesta del genitore: chi è', [lui.nome, lui.cognome, lui.codiceFiscale, lui.natoIl, lui.natoA], ['Paola', 'Rossi', CF_PAOLA, '1980-01-01', 'Torino (TO)'])
  ok('la richiesta del genitore: residenza e contatti del foglio', [lui.indirizzo, lui.cap, lui.comune, lui.email, lui.telefono], ['Via Roma 1', '10093', 'Collegno', 'paola@esempio.it', '347 111 2233'])
  ok('la richiesta del genitore: corso e formula sono suoi', [lui.corsi, lui.formula, lui.regolamento], [['judo-adulti'], 'trimestre', true])
  ok('il genitore è un adulto: nessun genitore*', [lui.genitoreNome, lui.genitoreCognome, lui.genitoreCodiceFiscale].map((x) => x || ''), ['', '', ''])
  ok('la richiesta del genitore passa i controlli di oggi', chiama(() => m.controlla(lui)), null)

  // Il conto è uno solo: il riepilogo dice le stesse cifre della stima a mano.
  const delRiepilogo = chiama(() => m.contoDellaFamiglia(m.conDatiDellaFamiglia([figlio(), io()]), corsi, listino, giorno))
  ok('il conto di bambino e io: stesse cifre della stima a mano', [delRiepilogo?.totale, delRiepilogo?.sconto], [annuali.totale, annuali.sconto])
  ok('senza io il bambino è da solo: nessuno sconto', chiama(() => m.contoDelModulo([figlio()], corsi, listino, giorno)?.conSconto), false)
  ok('l’io sceglie un’altra formula: nel conto conta la sua', chiama(() => m.contoDellaFamiglia(m.conDatiDellaFamiglia([figlio(), io({ formula: 'trimestre' })]), corsi, listino, giorno)?.sconto), undefined)

  const grandi = { ...listino, corsi: listino.corsi.map((v, i) => (i === 0 ? { ...v, etaMinima: 16 } : v)) }
  ok('stessa ora: i corsi per grandi nascosti arrivano alla schermata', m.corsiPerEtaConStessaOra(corsi, grandi, '2016-04-12', [], []).nascosti.length, 1)

  // Cosa parte per ognuno: il file di ogni richiesta e i dati del PDF.
  const chiamate = []
  const faiPdf = async (c) => {
    chiamate.push([c.dati.nome, c.minore, c.scelte, c.natoA, c.provincia])
    return F('modulo-firmato.pdf')
  }
  const doc = F('d.jpg'), retro = F('retro.jpg'), ric = F('ric.jpg')
  const bimbo = figlio({}, { file: { documento: doc, 'documento-retro': retro, ricevuta: ric, certificato: F('c-bimbo.pdf') } })
  const mamma = io({ formula: 'trimestre' }, { scelte: { tesseramento: false, foto: true }, file: { certificato: F('c-lui.pdf') } })
  const due = lista(() => m.richiesteDelModulo(m.conDatiDellaFamiglia([bimbo, mamma]), (p) => m.richiesteDaMandare(p, 'TO', faiPdf)))
  ok('bambino e io: due richieste', due.length, 2)
  ok('il bambino: documento, retro, ricevuta e il suo certificato', Object.entries(due[0]?.file ?? {}).map(([k, f]) => `${k}=${f.name}`).sort(), ['certificato=c-bimbo.pdf', 'documento-retro=retro.jpg', 'documento=d.jpg', 'ricevuta=ric.jpg'].sort())
  ok('il genitore: stessa carta d’identità e ricevuta, ma il certificato è suo', Object.entries(due[1]?.file ?? {}).map(([k, f]) => `${k}=${f.name}`).sort(), ['certificato=c-lui.pdf', 'documento-retro=retro.jpg', 'documento=d.jpg', 'ricevuta=ric.jpg'].sort())
  ok('il genitore non porta il foglio in foto: il PDF lo fa l’app', [typeof due[1]?.faiPdf, due[1]?.file.modulo], ['function', undefined])
  ok('la richiesta del genitore: lui, il suo corso e la sua formula', [due[1]?.dati.nome, due[1]?.dati.corsi, due[1]?.dati.formula, due[1]?.dati.natoA], ['Paola', ['judo-adulti'], 'trimestre', 'Torino (TO)'])
  ok('la richiesta del bambino è quella delle risposte', due[0]?.dati, m.risposteDaiPassi(bimbo))
  for (const x of due) await x.faiPdf?.()
  // Del PDF dell'io contano chi è, che è maggiorenne e le sue caselle: il luogo lo dice la richiesta.
  ok(
    'PDF del bambino: modulo per minori, le sue scelte, dov’è nato il genitore; PDF del genitore: modulo per maggiorenni, le scelte del genitore',
    [chiamate[0], chiamate[1]?.slice(0, 3)],
    [['Matteo', true, { tesseramento: true, foto: true }, 'Torino', 'TO'], ['Paola', false, { tesseramento: false, foto: true }]],
  )
  chiamate.length = 0
  const solo = m.richiesteDaMandare(adulto({}, { scelte: { tesseramento: true, foto: false } }), '', faiPdf)
  await solo[0].faiPdf()
  ok('un adulto: una richiesta, il PDF per maggiorenni con le sue scelte', [solo.length, chiamate], [1, [['Luca', false, { tesseramento: true, foto: false }, '', '']]])
  ok('col foglio firmato in foto non si fa il PDF', m.richiesteDaMandare(adulto({}, { file: { documento: doc, modulo: F('foglio.jpg') } }), '', faiPdf)[0].faiPdf, undefined)
}

// ---------------------------------------------------------------------------
console.log('\n13b. «Ti iscrivi anche tu?»: i corsi alla stessa ora, dal calendario vero')
{
  const ids = (x) => x.map((c) => c.id)
  const r = m.creaRichiesteProva()
  const corsi = await r.corsiAperti()
  const orari = await r.orariAperti()
  ok('in prova gli orari ci sono (creaRichiesteProva().orariAperti)', orari.length > 0, true)
  const voci = m.LISTINO_PREDEFINITO.corsi
  const GENITORE = '1985-03-03'
  const paralleli = (figlio, o = orari, c = corsi, v = voci) => m.corsiParalleli(c, v, GENITORE, figlio, o)

  // R1/R2/R11: Judo 3 (lun, mer, ven 18-19) e Judo agonisti (mar, gio 18-19.30).
  const due = paralleli(['judo-3', 'judo-agonisti'])
  ok('Judo 3 + agonisti: c’è Preparazione atletica 3 (lun, mer, ven 18-19)', ids(due).includes('prep-atletica-3'), true)
  ok('Judo 3 + agonisti: c’è Preparazione atletica 1, che nel listino non ha una voce sua', ids(due).includes('prep-atletica-1'), true)
  ok('Judo 3 + agonisti: non Preparazione atletica 2, che comincia alle 19.30 quando agonisti finisce', ids(due).includes('prep-atletica-2'), false)
  ok('Judo 3 + agonisti: non Judo adulti, che comincia alle 19 quando Judo 3 finisce', ids(due).includes('judo-adulti'), false)
  ok('Judo 3 + agonisti: tutti e soli i corsi del genitore che si sovrappongono, nell’ordine dei corsi per età', ids(due), ['aikido-3', 'lotta-3', 'body-functional', 'pesi-2', 'prep-atletica-1', 'prep-atletica-3'])
  // Psicomotricità (venerdì 18.10) ha nel listino «3-4-5 anni» scritto, senza anni di nascita: è dei piccoli, non si propone.
  ok('Judo 3 + agonisti: non Psicomotricità, che il listino dice per 3-5 anni senza anni di nascita', ids(due).includes('psicomotricita'), false)
  ok('ognuno è «stessa ora», e nessuno ha giorni a parte (si sovrappongono tutti i giorni)', [...new Set(due.map((c) => `${c.stessaOra}/${c.giorni ?? '-'}`))], ['true/-'])
  // Gli orari scritti nel listino non contano più: Judo adulti con l'orario scritto di Judo 3 resta fuori.
  const scritto = voci.map((v) => (v.corso === 'Judo adulti' ? { ...v, orari: ['lunedì, mercoledì e venerdì 18.00-19.00'] } : v))
  ok('l’orario scritto uguale nel listino non basta: conta il calendario', ids(paralleli(['judo-3'], orari, corsi, scritto)).includes('judo-adulti'), false)

  // Solo Judo 3: i corsi del martedì e giovedì non ci sono più.
  const solo = paralleli(['judo-3'])
  ok('solo Judo 3: Preparazione atletica 3 sì', ids(solo).includes('prep-atletica-3'), true)
  ok('solo Judo 3: Preparazione atletica 1 (mar, gio) no', ids(solo).includes('prep-atletica-1'), false)
  // Giorni in parte: Aikido 3 è lun e gio, Judo 3 il lunedì sì e il giovedì no.
  ok('solo Judo 3: prima quelli con tutti i giorni, poi quelli in parte', ids(solo), ['body-functional', 'pesi-2', 'prep-atletica-3', 'aikido-3', 'lotta-3'])
  ok('giorni in parte: Aikido 3 (lun, gio) col figlio solo il lunedì → [1]', solo.find((c) => c.id === 'aikido-3').giorni, [1])
  ok('giorni in parte: Lotta 3 (lun, mar, mer, ven) → [1, 3, 5]', solo.find((c) => c.id === 'lotta-3').giorni, [1, 3, 5])
  ok('tutti i giorni: niente «giorni»', 'giorni' in solo.find((c) => c.id === 'prep-atletica-3'), false)

  // R3: mai fuori età, mai nascosto per età minima, mai un corso del figlio.
  const fuori = [
    { corso: 'Pesistica 2', corsoId: 'pesi-2', eta: '', orari: [], natiDal: 2010, natiAl: 2012, prezzi: [{ annuale: 300, trimestre: 120 }] },
    { corso: 'Body functional', corsoId: 'body-functional', eta: '', orari: [], etaMinima: 50, prezzi: [{ annuale: 300, trimestre: 120 }] },
    ...voci,
  ]
  const r3 = paralleli(['judo-3', 'prep-atletica-3'], orari, corsi, fuori)
  ok('non propone un corso fuori età per il genitore (altri)', ids(r3).includes('pesi-2'), false)
  ok('non propone un corso nascosto per età minima', ids(r3).includes('body-functional'), false)
  ok('non propone un corso già scelto per il figlio', ids(r3).includes('prep-atletica-3'), false)
  ok('gli altri alla stessa ora restano', ids(r3).includes('lotta-3'), true)

  // R4: senza orari non c'è stessa ora.
  const nuovo = [...corsi, { id: 'corso-nuovo', nome: 'Corso nuovo' }]
  ok('un corso senza orari non è mai alla stessa ora', ids(paralleli(['judo-3'], orari, nuovo)).includes('corso-nuovo'), false)
  ok('il figlio senza corsi: nessun parallelo', paralleli([]), [])
  ok('senza orari: nessun parallelo', paralleli(['judo-3'], []), [])

  // Le righe sotto il nome, nel gruppo «ALLA STESSA ORA DI MATTEO».
  const listino = m.LISTINO_PREDEFINITO
  const perEta = m.corsiPerEta(corsi, listino.corsi, GENITORE, listino.senzaPrezzoVaBene)
  const conOra = (figlio, o = orari, c = corsi) => m.corsiPerEtaConStessaOra(c, listino, GENITORE, figlio, o)
  const ep = conOra(['judo-3'])
  // Senza listino non si sa l'età dei corsi: proporre «stessa ora» metterebbe in cima anche quelli dei piccoli.
  ok('senza listino nessun corso alla stessa ora', m.corsiPerEtaConStessaOra(corsi, undefined, GENITORE, ['judo-3'], orari).stessaOra, [])
  const riga = (id) => ep.stessaOra.find((c) => c.id === id)?.riga
  const rigaListino = (id) => [...perEta.adatti, ...perEta.senzaAnni].find((c) => c.id === id)?.riga
  // I corsi vicini (subito prima o dopo, negli stessi giorni) hanno gruppi loro: le regole sono in 42.
  const proposti = (x) => [...ids(x.stessaOra ?? []), ...ids(x.vicini ?? []), ...ids(x.stessiGiorni ?? [])]
  ok('stessaOra: gli stessi corsi di corsiParalleli', ids(ep.stessaOra).sort(), ids(solo).sort())
  // Nel gruppo, prima chi si sovrappone più giorni, poi per nome.
  const quanti = (c) => c.vicinanza?.giorni.length ?? NaN
  const inOrdine = (x) => x.every((c, k) => !k || quanti(x[k - 1]) > quanti(c) || (quanti(x[k - 1]) === quanti(c) && x[k - 1].nome.localeCompare(c.nome, 'it') < 0))
  ok('stessaOra: prima i corsi con più giorni in comune, poi per nome', [ep.stessaOra.length > 2, inOrdine(ep.stessaOra)], [true, true])
  ok('stessaOra: tolti dagli adatti, coi corsi vicini', ep.adatti.map((c) => c.id), perEta.adatti.filter((c) => !proposti(ep).includes(c.id)).map((c) => c.id))
  // Dai senza anni escono solo quelli proposti in cima e quelli del figlio: il genitore li vede già, o non sono per lui.
  ok('senza anni: tolti quelli proposti in cima e quelli del figlio', ep.senzaAnni.map((c) => c.id), perEta.senzaAnni.map((c) => c.id).filter((id) => !proposti(ep).includes(id) && id !== 'judo-3'))
  ok('altri: come corsiPerEta, senza i corsi del figlio', ep.altri.map((c) => c.id), perEta.altri.map((c) => c.id).filter((id) => id !== 'judo-3'))
  ok('nascosti come corsiPerEta', ep.nascosti, perEta.nascosti)
  // I giorni in comune non stanno più nella riga: li dice il perché (`vicinanza`), la riga resta l'orario.
  const giorni = (id) => ep.stessaOra.find((c) => c.id === id)?.vicinanza?.giorni
  ok('riga, giorni in parte: la riga del listino, e il lunedì in comune', [riga('aikido-3'), giorni('aikido-3')], [rigaListino('aikido-3'), [1]])
  ok('riga, tre giorni: la riga del listino, e lunedì, mercoledì e venerdì', [riga('lotta-3'), giorni('lotta-3')], [rigaListino('lotta-3'), [1, 3, 5]])
  // Con Judo 3 e agonisti, Aikido 3 (lun, gio) ha tutti i giorni in comune.
  ok('riga, tutti i giorni e una riga del listino: quella, senza «stessa ora di»', conOra(['judo-3', 'judo-agonisti']).stessaOra.find((c) => c.id === 'aikido-3')?.riga, rigaListino('aikido-3'))
  ok('riga, senza voce nel listino: l’orario del calendario', riga('prep-atletica-3'), 'lunedì, mercoledì e venerdì 18.00-19.00')
  ok('riga, un giorno solo dal calendario', riga('body-functional'), 'mercoledì 18.00-19.00')
  ok('nessuna riga ripete «stessa ora di Matteo»', ep.stessaOra.some((c) => c.riga?.includes('stessa ora di')), false)
  const ep2 = conOra(['judo-3', 'judo-agonisti'])
  ok('riga, mar e gio dal calendario', ep2.stessaOra.find((c) => c.id === 'prep-atletica-1')?.riga, 'martedì e giovedì 18.00-19.00')

  // Corsi inventati, senza voce nel listino: orari diversi fra i giorni, e due giorni in parte.
  const inventati = [...corsi, { id: 'yoga', nome: 'Yoga' }, { id: 'pilates', nome: 'Pilates' }]
  const orariInventati = [
    ...orari,
    { corsoId: 'yoga', giorno: 5, ora: '18:30', durata: 60 },
    { corsoId: 'yoga', giorno: 1, ora: '18:00', durata: 60 },
    { corsoId: 'yoga', giorno: 3, ora: '18:00', durata: 60 },
    { corsoId: 'pilates', giorno: 1, ora: '18:00', durata: 60 },
    { corsoId: 'pilates', giorno: 4, ora: '18:00', durata: 60 },
    { corsoId: 'pilates', giorno: 6, ora: '18:00', durata: 60 },
  ]
  const ep3 = conOra(['judo-3', 'judo-agonisti'], orariInventati, inventati)
  const riga3 = (id) => ep3.stessaOra.find((c) => c.id === id)?.riga
  ok('orari diversi fra i giorni: un pezzo per orario, dal lunedì', riga3('yoga'), 'lunedì e mercoledì 18.00-19.00 · venerdì 18.30-19.30')
  ok('due giorni in parte: l’orario del calendario, e il lunedì e il giovedì in comune', [riga3('pilates'), ep3.stessaOra.find((c) => c.id === 'pilates')?.vicinanza?.giorni], ['lunedì, giovedì e sabato 18.00-19.00', [1, 4]])
  ok('il corso coi giorni in parte: nell’ordine dei giorni in comune', inOrdine(ep3.stessaOra), true)

  ok('senza orari: stessaOra vuoto', conOra(['judo-3'], []).stessaOra, [])
  const senzaOrari = conOra(['judo-3'], [])
  ok('senza orari: adatti come corsiPerEta', senzaOrari.adatti, perEta.adatti)
  ok('senza orari: senza anni come corsiPerEta, tolto il corso del figlio', senzaOrari.senzaAnni.map((c) => [c.id, c.riga]), perEta.senzaAnni.filter((c) => c.id !== 'judo-3').map((c) => [c.id, c.riga]))
  ok('senza orari: altri senza il corso del figlio, e nascosti', [senzaOrari.altri, senzaOrari.nascosti], [perEta.altri.filter((c) => c.id !== 'judo-3'), perEta.nascosti])

  // B e C, col figlio solo in Judo agonisti (mar, gio 18-19.30).
  const ag = conOra(['judo-agonisti'])
  const rigaDi = (elenco, id) => elenco.find((c) => c.id === id)?.riga
  ok('Body functional (mer) non è alla stessa ora: resta nei senza anni', [ag.stessaOra.some((c) => c.id === 'body-functional'), ag.senzaAnni.some((c) => c.id === 'body-functional')], [false, true])
  ok('senza riga del listino, la riga è l’orario del calendario', rigaDi(ag.senzaAnni, 'body-functional'), 'mercoledì 18.00-19.00')
  ok('e così per gli altri senza voce: Pesistica 1', rigaDi(ag.senzaAnni, 'pesi-1'), 'lunedì, mercoledì e venerdì 17.00-18.00')
  ok('«prezzo da confermare» non sta nella riga: lo dice la schermata', ag.senzaAnni.some((c) => c.riga?.includes('prezzo da confermare')), false)
  ok('gli adatti tengono la riga del listino', rigaDi(ag.adatti, 'judo-adulti'), rigaDi(perEta.adatti, 'judo-adulti'))
  ok('senza anni: tolti quelli proposti in cima e quelli del figlio', ag.senzaAnni.map((c) => c.id), perEta.senzaAnni.map((c) => c.id).filter((id) => !proposti(ag).includes(id) && id !== 'judo-agonisti'))
  // Il listino non dice per che anni è Psicomotricità («3-4-5 anni» scritto): resta dov'è, non si propone e basta.
  ok('Psicomotricità resta nei senza anni, non negli altri', [ag.senzaAnni.some((c) => c.id === 'psicomotricita'), ag.altri.some((c) => c.id === 'psicomotricita')], [true, false])
  ok('il corso del figlio non è né nei senza anni né alla stessa ora', [ag.senzaAnni.some((c) => c.id === 'judo-agonisti'), ag.stessaOra.some((c) => c.id === 'judo-agonisti')], [false, false])

  // «Ti iscrivi anche tu?» e il foglio del genitore (`fraseAncheTu`, `suoDopoIscrivoAncheMe`, `scegliSuoCorso`,
  // `nonPiuAllaStessaOra`, `fraseNonPiuAllaStessaOra`) non ci sono più: chi compila si aggiunge in LA FAMIGLIA come l'io, e il corso già
  // spuntato lo dice `corsiGiaScelti` (sezione 40).


  // Il corso dell'io si sceglie al suo passo del corso, come per ogni adulto della famiglia.
  ok('l’io senza corso: il suo passo del corso (2) chiede CORSO', nomi(io({ corsi: [] }), 2), ['CORSO'])
  ok('l’io col corso: a posto', nomi(io(), 2), [])
}

// ---------------------------------------------------------------------------
console.log('\n14. il riepilogo')
{
  const corsi = [{ id: 'judo-adulti', nome: 'Judo adulti' }, { id: 'judo-3', nome: 'Judo 3' }]
  const daCaricare = (righe) => righe.filter((r) => r.carica).map((r) => r.carica)
  const a = m.righeRiepilogo(adulto(), corsi)
  ok('adulto: certificato e ricevuta mancano, con CARICA', daCaricare(a), ['certificato', 'ricevuta'])
  ok('e sono segnati come facoltativi non dati', a.filter((r) => r.carica).map((r) => r.manca), [true, true])
  const dati = m.righeRiepilogo(adulto({}, { file: { documento: F('d.jpg'), certificato: F('c.pdf'), ricevuta: F('r.jpg') } }), corsi)
  ok('dati certificato e ricevuta: niente CARICA', daCaricare(dati), [])
  ok('il corso scelto, col suo nome', dati.find((r) => r.etichetta === 'CORSO')?.valore, 'Judo adulti')
  const f = m.righeRiepilogo(figlio(), corsi)
  ok('figlio: la riga del genitore', f.find((r) => r.etichetta === 'GENITORE')?.valore, 'Paola Rossi')
  ok('ogni riga dice a quale passo manda MODIFICA o CARICA', [f.find((r) => r.cosa === 'corso')?.passo, f.find((r) => r.cosa === 'genitore')?.passo, f.find((r) => r.cosa === 'certificato')?.passo, f.find((r) => r.cosa === 'ricevuta')?.passo], ['corso', 'genitore', 'documenti', 'pagamento'])
  // Il certificato dell'io sta nel suo riepilogo, e porta ai suoi documenti.
  const dellIo = lista(() => m.righeRiepilogo(m.conDatiDellaFamiglia([figlio(), io()])[1], corsi))
  ok('il certificato dell’io rimanda ai suoi documenti', dellIo.filter((r) => r.cosa === 'certificato').map((r) => r.passo), ['documenti'])
  ok('la riga «Carta d’identità» manda ai documenti, quella «Firma» al modulo', (m.passoDelRiepilogo ? [m.passoDelRiepilogo('carta'), m.passoDelRiepilogo('firma')] : 'passoDelRiepilogo non c’è'), ['documenti', 'modulo'])
  // Chi deve portare il certificato: lo stesso conto per il riepilogo e per l'esito.
  ok('certificato: l’adulto che non l’ha caricato', m.certificatiMancanti(adulto(), corsi), ['chi'])
  ok('certificato: caricato, nessuno lo porta', m.certificatiMancanti(adulto({}, { file: { documento: F('d.jpg'), certificato: F('c.pdf') } }), corsi), [])
  // Bambino e io: ognuno il suo certificato, ognuno per la sua età e il suo corso.
  const certificati = (persone) => lista(() => m.conDatiDellaFamiglia(persone)).map((p) => m.certificatiMancanti(p, corsi))
  ok('certificato: bambino e io mancano tutti e due', certificati([figlio(), io()]), [['chi'], ['chi']])
  ok('certificato: solo quello dell’io caricato', certificati([figlio(), io({}, { file: { certificato: F('c.pdf') } })]), [['chi'], []])
  ok('certificato: il bambino da solo', m.certificatiMancanti(figlio(), corsi), ['chi'])
}

console.log('\n14b. cosa manca per fare il modulo firmato')
{
  ok('tutto fatto: si può firmare', m.mancaPerFirmare(adulto()), null)
  ok('il foglio è già in foto: non manca niente', m.mancaPerFirmare(adulto({}, { file: { modulo: F('foglio.jpg') }, scelte: {}, tratti: 0 })), null)
  ok('manca il tesseramento', m.mancaPerFirmare(adulto({}, { scelte: { foto: true } })), 'Nel modulo: scegli se acconsenti al tesseramento alla FIJLKAM e/o FIPE')
  ok('manca la foto', m.mancaPerFirmare(adulto({}, { scelte: { tesseramento: true } })), 'Nel modulo: scegli se autorizzi le foto')
  ok('il bambino: manca dove è nato il genitore', m.mancaPerFirmare(figlio({}, { natoAGenitore: '  ' })), 'Nel modulo: manca dove è nato il genitore')
  ok('l’adulto non lo deve scrivere', m.mancaPerFirmare(adulto({}, { natoAGenitore: '' })), null)
  ok('manca la firma', m.mancaPerFirmare(adulto({}, { tratti: 0 })), 'Manca la firma sul modulo')
  ok('si dice una cosa alla volta, nell’ordine del modulo', m.mancaPerFirmare(figlio({}, { scelte: {}, natoAGenitore: '', tratti: 0 })), 'Nel modulo: scegli se acconsenti al tesseramento alla FIJLKAM e/o FIPE')
}

// ---------------------------------------------------------------------------
console.log('\n15. senza server la strada è quella della prova')
{
  memoria.clear()
  ok('datiRichieste() senza server è la prova', (await m.datiRichieste()).modo, 'prova')
  ok('nessuna chiamata alla rete', chiamateDiRete, 0)
}

// ---------------------------------------------------------------------------
console.log('\n16. l’ordine di «manca» è quello della pagina: il focus va al primo campo che si vede')
{
  const vuoto = (chi) => m.nuovoStato(chi)
  const chiavi = (stato, passo) => {
    const tutte = []
    // primoDaCorreggere dà solo il primo: per l'ordine intero si toglie un campo alla volta dalla lista.
    return tutte.concat(m.mancaNelPasso(stato, passo))
  }
  ok('adulto, passo 1: nome, cognome, codice fiscale, nascita, luogo, indirizzo, cap, comune, contatti', chiavi(vuoto('adulto'), 1), [
    'NOME', 'COGNOME', 'CODICE FISCALE', 'DATA DI NASCITA', 'LUOGO DI NASCITA', 'INDIRIZZO', 'CAP', 'COMUNE', 'EMAIL', 'TELEFONO',
  ])
  ok('adulto, passo 1: il focus va al nome', m.primoDaCorreggere(vuoto('adulto'), 1), 'nome')
  ok('bambino, passo 2: il genitore e poi i contatti', chiavi(figlio({ genitoreNome: '', genitoreCognome: '', genitoreCodiceFiscale: '', email: '', telefono: '' }), 2), ['NOME DEL GENITORE', 'COGNOME DEL GENITORE', 'CODICE FISCALE DEL GENITORE', 'EMAIL', 'TELEFONO'])
  ok('bambino, passo 3: solo il corso, niente domanda «anche te?»', chiavi(vuoto('figlio'), 3), ['CORSO'])
  ok('adulto, passo 3 (il modulo): tesseramento, foto, firma, regolamento, privacy', chiavi({ ...vuoto('adulto'), risposte: { ...vuoto('adulto').risposte, regolamento: false } }, 3), [
    'TESSERAMENTO', 'FOTO', 'FIRMA', 'REGOLAMENTO', 'INFORMATIVA PRIVACY',
  ])
  ok('adulto, passo 4 (i documenti): la carta d’identità', chiavi(vuoto('adulto'), 4), ['CARTA D\'IDENTITÀ'])
  ok('adulto, l’ultimo passo (7): prima il modulo, poi i documenti', chiavi({ ...vuoto('adulto'), risposte: { ...vuoto('adulto').risposte, regolamento: false } }, 7).slice(-6), [
    'TESSERAMENTO', 'FOTO', 'FIRMA', 'REGOLAMENTO', 'INFORMATIVA PRIVACY', 'CARTA D\'IDENTITÀ',
  ])
  ok('adulto, passo 3: il focus va alla prima casella', m.primoDaCorreggere(vuoto('adulto'), 3), 'tesseramento')
  ok('adulto, passo 4: il focus va alla carta d’identità', m.primoDaCorreggere(vuoto('adulto'), 4), 'documento')
  ok('bambino, passo 4 (il modulo): dove è nato il genitore prima della firma', chiavi(figlio({}, { scelte: {}, tratti: 0, file: {}, privacy: false, natoAGenitore: '' }), 4), ['TESSERAMENTO', 'FOTO', 'FIRMA', 'INFORMATIVA PRIVACY'])
  ok('bambino, passo 5 (i documenti): la carta del genitore', chiavi(figlio({}, { file: {} }), 5), ['CARTA D\'IDENTITÀ'])
  ok('bambino, passo 2: «dove sei nato» sta dopo il codice del genitore, prima dei contatti', chiavi(figlio({ genitoreNome: '', genitoreCognome: '', genitoreCodiceFiscale: '', email: '', telefono: '' }, { natoAGenitore: '' }), 2), ['NOME DEL GENITORE', 'COGNOME DEL GENITORE', 'CODICE FISCALE DEL GENITORE', 'DOVE SEI NATO', 'EMAIL', 'TELEFONO'])
  ok('bambino, l’ultimo passo (8): «dove sei nato» una volta sola', m.mancaNelPasso(figlio({}, { natoAGenitore: '' }), 8), ['DOVE SEI NATO'])
  ok('l’io, passo 3 (il modulo): solo tesseramento e foto, la firma e l’ok sono del bambino', chiavi(io({}, { scelte: {} }), 3), ['TESSERAMENTO', 'FOTO'])
}

// ---------------------------------------------------------------------------
console.log('\n16b. le parole per il genitore, nel flusso del figlio')
{
  const t = (chi, tipo, nome, firma = 'Paola') => m.testoFile(chi, tipo, nome, firma)
  const adultoDoc = m.FILE.find((f) => f.tipo === 'documento')
  ok('figlio: la carta d’identità dice di chi è, col nome di chi firma', t('figlio', 'documento', 'Matteo').etichetta, 'LA CARTA D’IDENTITÀ DI PAOLA')
  ok('figlio: il fronte lo firma il genitore, col suo nome', t('figlio', 'documento', 'Matteo').dettaglio, 'Il fronte. È Paola che firma: serve la sua carta, non quella di Matteo.')
  // «di il bambino» non è italiano: senza nome si dice «del bambino».
  ok('figlio senza nome: «non quella del bambino»', t('figlio', 'documento', ' ').dettaglio, 'Il fronte. È Paola che firma: serve la sua carta, non quella del bambino.')
  ok('figlio: il retro è della carta di chi firma', t('figlio', 'documento-retro', 'Matteo').etichetta, 'IL RETRO DELLA CARTA DI PAOLA')
  // Senza il nome di chi firma (non scritto, o cancellato dopo): «del genitore», mai «DI » e niente.
  ok('genitore senza nome: la carta è del genitore', t('figlio', 'documento', 'Matteo', ' ').etichetta, 'LA CARTA D’IDENTITÀ DEL GENITORE')
  ok('genitore senza nome: il retro è del genitore', t('figlio', 'documento-retro', 'Matteo', '').etichetta, 'IL RETRO DELLA CARTA DEL GENITORE')
  ok('genitore senza nome: il fronte dice «il genitore»', t('figlio', 'documento', 'Matteo', '').dettaglio, 'Il fronte. È il genitore che firma: serve la sua carta, non quella di Matteo.')
  ok('il nome di chi firma senza spazi intorno', t('figlio', 'documento', 'Matteo', ' Paola ').etichetta, 'LA CARTA D’IDENTITÀ DI PAOLA')
  ok('nessuna etichetta dice più «TUA»', ['documento', 'documento-retro', 'certificato'].flatMap((x) => [t('figlio', x, 'Matteo'), t('figlio', x, '', '')]).some((x) => /\bTU[AOE]?\b|\btua\b|\btu\b/i.test(x.etichetta + ' ' + x.dettaglio)), false)
  ok('«di chi firma»: col nome e senza', [m.diChiFirma('Paola'), m.diChiFirma(' '), m.diChiFirma(undefined)], ['di Paola', 'del genitore', 'del genitore'])
  ok('figlio: il retro, cosa caricare', t('figlio', 'documento-retro', 'Matteo').dettaglio, 'Il retro. Una foto o il PDF.')
  ok('figlio: il certificato col nome in maiuscolo', t('figlio', 'certificato', 'Matteo').etichetta, 'IL CERTIFICATO DI MATTEO')
  ok('figlio: il certificato senza nome', t('figlio', 'certificato', '').etichetta, 'IL CERTIFICATO DEL BAMBINO')
  ok('figlio: il certificato, cosa succede se manca', t('figlio', 'certificato', 'Matteo').dettaglio, 'Lo porti in segreteria prima della prima lezione: senza, Matteo non può partecipare.')
  ok('figlio senza nome: il certificato dice «il bambino»', t('figlio', 'certificato', '').dettaglio, 'Lo porti in segreteria prima della prima lezione: senza, il bambino non può partecipare.')
  ok('adulto: i testi di oggi, documento', t('adulto', 'documento', 'Luca'), { etichetta: adultoDoc.etichetta, dettaglio: adultoDoc.dettaglio })
  const cert = m.FILE.find((f) => f.tipo === 'certificato')
  ok('adulto: i testi di oggi, certificato', t('adulto', 'certificato', 'Luca'), { etichetta: cert.etichetta, dettaglio: cert.dettaglio })
  ok('i testi di FILE non cambiano', [adultoDoc.etichetta, adultoDoc.dettaglio], ["CARTA D'IDENTITÀ", 'Il fronte. Per un minore, quella del genitore.'])

  // «Dove sei nato» si chiede solo se il codice del genitore non lo dice.
  const luoghi = { L219: [['TORINO', 'TO']] }
  ok('luogo del genitore: il codice lo dice, non si chiede', m.luogoGenitoreDaChiedere(figlio(), luoghi), false)
  ok('luogo del genitore: codice di un luogo che non c’è in elenco, si chiede', m.luogoGenitoreDaChiedere(figlio(), { Z999: [['ROMA', 'RM']] }), true)
  ok('luogo del genitore: elenco assente, si chiede', m.luogoGenitoreDaChiedere(figlio(), undefined), true)
  ok('luogo del genitore: codice non scritto ancora, si chiede', m.luogoGenitoreDaChiedere(figlio({ genitoreCodiceFiscale: '' }), luoghi), true)
  ok('luogo del genitore: l’adulto non lo chiede mai', m.luogoGenitoreDaChiedere(adulto(), undefined), false)
}

// ---------------------------------------------------------------------------
console.log('\n17. due tocchi nello stesso istante mandano una richiesta sola')
{
  const finto = () => {
    const inviati = []
    return {
      inviati, modo: 'prova',
      async invia(dati) {
        await new Promise((r) => setTimeout(r, 5))
        inviati.push(dati.nome)
        return `r${inviati.length}`
      },
      async caricaFile() {},
    }
  }
  const d = finto()
  const da = () => [{ dati: m.risposteDaiPassi(adulto()), file: { documento: F('d.jpg') }, faiPdf: async () => F('m.pdf') }]
  const [a, b] = await Promise.all([m.mandaRichieste(d, da()), m.mandaRichieste(d, da())])
  ok('due chiamate ravvicinate: una sola invia', d.inviati, ['Luca'])
  ok('e tutte e due dicono com’è andata', [a.esito, b.esito, a.ids, b.ids], ['fatto', 'fatto', ['r1'], ['r1']])
  await m.mandaRichieste(d, da())
  ok('finita la prima, un nuovo invio voluto parte', d.inviati.length, 2)

  // RIPROVA: due tocchi, un solo giro.
  const d2 = finto()
  let tentativi = 0
  d2.caricaFile = async () => {
    tentativi++
    if (tentativi === 1) throw new Error('giù')
    await new Promise((r) => setTimeout(r, 5))
  }
  const e = await m.mandaRichieste(d2, da())
  ok('un file non parte', e.esito, 'file')
  tentativi = 1
  await Promise.all([e.riprova(), e.riprova()])
  ok('RIPROVA due volte insieme: il file riparte una volta sola', tentativi, 2)
}

// ---------------------------------------------------------------------------
console.log('\n18. la barra di quel che manca: una riga, e ogni voce è un tasto che porta al campo')
{
  const vuoto = (chi) => m.nuovoStato(chi)
  // Finché `mancanti` non c'è, ogni prova che la usa cade con ✗ invece di fermare lo script.
  const voci = (stato, passo) => (m.mancanti ? m.mancanti(stato, passo) : [])

  // La lista toccabile: nome e chiave, nell'ordine di sempre.
  ok('mancanti: stessi nomi di mancaNelPasso, stesso ordine', voci(vuoto('adulto'), 1).map((v) => v.nome), m.mancaNelPasso(vuoto('adulto'), 1))
  ok('mancanti: la prima chiave è quella del focus', voci(vuoto('adulto'), 1)[0]?.chiave, m.primoDaCorreggere(vuoto('adulto'), 1))
  ok('mancanti: a posto, nessuna voce', voci(adulto(), 1), [])
  ok('mancanti: ogni voce ha nome e chiave', voci(vuoto('adulto'), 1).length > 0 && voci(vuoto('adulto'), 1).every((v) => v.nome && v.chiave), true)
  ok('mancanti: la data di nascita ha la sua chiave', voci(vuoto('adulto'), 1).find((v) => v.nome === 'DATA DI NASCITA')?.chiave, 'natoIl')

  // Bambino e io sono due persone: all'ultimo passo le loro voci restano distinte in `mancantiFamiglia` (sezione 35).

  // Ogni chiave porta a un id che c'è nella pagina.
  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const moduloFile = readFileSync('src/components/ModuloIscrizione.tsx', 'utf8')
  const tutte = new Map()
  for (const stato of [vuoto('adulto'), vuoto('figlio'), io({ corsi: [] }, { scelte: {} })])
    for (let p = 1; p <= m.passiDi(stato.chi).length; p++) for (const v of voci(stato, p)) tutte.set(v.chiave, v.nome)
  const haId = (k) =>
    pagina.includes(`id="n-${k}"`) || pagina.includes(`id: 'n-${k}'`) || pagina.includes(`cf('${k}'`) ||
    (m.FILE.some((f) => f.tipo === k) && moduloFile.includes('id={`m-file-${tipo}`}'))
  ok('ogni voce possibile ha un id nella pagina (n-<chiave> o m-file-<chiave>)', tutte.size > 0 ? [...tutte.keys()].filter((k) => !haId(k)) : ['nessuna voce'], [])

  // Il tocco usa lo stesso focus dell'AVANTI.
  ok('la pagina passa il suo focus alla barra', /<BarraPasso[\s\S]*?onVai=\{focus\}/.test(pagina), true)
}

// ---------------------------------------------------------------------------
console.log('\n19. la barra compatta: markup e stile')
{
  const { outputFiles } = await build({
    stdin: {
      contents:
        "import { createElement } from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { BarraPasso } from './src/components/ds'; export const rendi = (props) => renderToStaticMarkup(createElement(BarraPasso, { onAvanti() {}, onVai() {}, ...props }))",
      resolveDir: '.',
      loader: 'tsx',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    write: false,
    logLevel: 'error',
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(process.cwd() + '/x.js');" },
    define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' },
  })
  let rendi
  try {
    ;({ rendi } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')))
  } catch (e) {
    console.log('  ✗ la barra non si carica:', String(e.message).slice(0, 160))
    process.exit(1)
  }
  const v = (n) => Array.from({ length: n }, (_, i) => ({ nome: `VOCE ${i + 1}`, chiave: `k${i + 1}` }))
  const tasti = (html) => (html.match(/<button/g) ?? []).length
  const riga = (html) => html.match(/<div class="barra-manca"[\s\S]*?<div class="barra-tasti"/)?.[0] ?? ''

  // Oggi la barra vuole stringhe: con voci {nome, chiave} il render cade, e ogni prova che ne legge il markup lo dice.
  const rendiSicuro = (p) => {
    try {
      return rendi(p)
    } catch (e) {
      return `[render caduto: ${String(e.message).slice(0, 90)}]`
    }
  }
  const tre = rendiSicuro({ manca: v(3) })
  ok('titolo scritto col numero: MANCANO 3', riga(tre).includes('MANCANO 3'), true)
  ok('una cosa sola: MANCA 1', riga(rendiSicuro({ manca: v(1) })).includes('MANCA 1'), true)
  ok('chiusa: il tasto «VAI A» porta alla prima voce', riga(tre).includes('VAI A: VOCE 1'), true)
  ok('chiusa: il nome accessibile del tasto è «Vai a: VOCE 1»', riga(tre).includes('aria-label="Vai a: VOCE 1"'), true)
  ok('chiusa: le altre voci non ci sono', riga(tre).includes('VAI A') && !riga(tre).includes('VOCE 2'), true)
  ok('chiusa: due tasti, vai e apri', tasti(riga(tre)), 2)
  ok('chiusa: l’apri è chiuso (aria-expanded=false)', /<button[^>]*aria-expanded="false"/.test(riga(tre)), true)
  const forma = (n) => riga(rendiSicuro({ manca: v(n) })).replace(/\d+/g, 'N').replace(/VOCE N/g, 'V')
  ok('chiusa: la riga è la stessa con 2 o con 9 voci, e ha il VAI A', forma(9) === forma(2) && forma(9).includes('VAI A'), true)
  const aperta = rendiSicuro({ manca: v(3), aperta: true })
  ok('aperta: aria-expanded=true', /<button[^>]*aria-expanded="true"/.test(riga(aperta)), true)
  ok('aperta: ogni voce è un tasto «Vai a: …»', [1, 2, 3].every((i) => riga(aperta).includes(`aria-label="Vai a: VOCE ${i}"`)), true)
  ok('aperta: vai, apri e tre voci = 5 tasti', tasti(riga(aperta)), 5)
  ok('aperta: l’elenco è nella barra, con la sua classe', riga(aperta).includes('barra-manca-elenco'), true)
  ok('a posto: la nota, senza elenco', rendiSicuro({ manca: [], nota: 'Tutto a posto in questo passo.' }).includes('Tutto a posto in questo passo.') && !rendiSicuro({ manca: [], nota: 'x' }).includes('barra-manca'), true)

  const css = readFileSync('src/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const corpo = (sel) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, s]) => s.split(',').map((x) => x.trim()).includes(sel)).map(([, , c]) => c).join(';')
  ok('la riga chiusa non va a capo', /flex-wrap\s*:\s*wrap/.test(corpo('.barra-manca')), false)
  ok('l’elenco aperto scorre, con altezza in dvh', /max-height\s*:[^;]*dvh/.test(corpo('.barra-manca-elenco')) && /overflow-y\s*:\s*(auto|scroll)/.test(corpo('.barra-manca-elenco')), true)
  ok('il tasto VAI A è alto almeno 44px', /min-height\s*:\s*44px/.test(corpo('.barra-manca-vai')), true)
  ok('il tasto ▾ è alto almeno 44px', /min-height\s*:\s*44px/.test(corpo('.barra-manca-apri')), true)
  ok('ogni voce dell’elenco è alta almeno 44px', /min-height\s*:\s*44px/.test(corpo('.barra-manca-voce')), true)
  ok('DESIGN.md descrive la barra compatta («VAI A»)', /Barra del passo[^\n]*VAI A/.test(readFileSync('DESIGN.md', 'utf8')), true)
  ok('DESIGN.md: la barra del passo cita il totale', /Barra del passo[^\n]*totale/i.test(readFileSync('DESIGN.md', 'utf8')), true)
}

// 20. «Ho il foglio firmato» senza ancora il file: la barra manda al file, non a campi che non ci sono.
{
  console.log('\n20. con il foglio firmato la barra chiede il file, non la firma')
  const foto = adulto({}, { tratti: 0, scelte: {}, firmaInFoto: true, file: { documento: F('d.jpg') } })
  ok('foglio firmato, senza file: manca solo MODULO FIRMATO', nomi(foto, 3), ['MODULO FIRMATO'])
  ok('foglio firmato: la voce porta al file del modulo', m.mancanti(foto, 3).map((v) => v.chiave), ['modulo'])
  ok('foglio firmato, col file: non manca niente', nomi(adulto({}, { tratti: 0, scelte: {}, firmaInFoto: true, file: { documento: F('d.jpg'), modulo: F('m.jpg') } }), 3), [])
  ok('firmo qui: restano tesseramento, foto e firma', nomi(adulto({}, { tratti: 0, scelte: {}, firmaInFoto: false }), 3), ['FIRMA', 'FOTO', 'TESSERAMENTO'])
}

// 21. VAI A: FIRMA deve poter portare il fuoco al riquadro: un canvas senza tabindex non lo riceve.
{
  console.log('\n21. il riquadro della firma riceve il fuoco')
  const tavola = readFileSync('src/components/TavolaFirma.tsx', 'utf8')
  ok('il canvas della firma ha tabIndex={-1}', /<canvas[^>]*tabIndex=\{-1\}/s.test(tavola), true)
}

// 22. Col foglio firmato in foto il PDF non si fa: il luogo del genitore non serve, e non ferma il passo.
{
  console.log('\n22. foglio in foto: il luogo del genitore non si chiede')
  const foto = figlio({}, { natoAGenitore: '', firmaInFoto: true, file: { documento: F('d.jpg') } })
  ok('figlio, foglio firmato in foto, luogo non ricavato: il passo del genitore non lo chiede', m.mancaNelPasso(foto, 2).includes('DOVE SEI NATO'), false)
  ok('figlio, firmo qui, luogo non ricavato: lo chiede', m.mancaNelPasso(figlio({}, { natoAGenitore: '' }), 2).includes('DOVE SEI NATO'), true)
}

// 23. Il testo sotto l'elenco di un minore, quando dei corsi per grandi non compaiono.
{
  console.log('\n23. i corsi per grandi che non compaiono: la frase')
  const f = (n, nome = 'Luca') => { try { return m.fraseCorsiNascosti(n, nome) } catch (e) { return `ERRORE: ${e.message}` } }
  ok('due corsi', f(['Pesistica 1', 'Preparazione atletica 2']), 'Pesistica 1 e Preparazione atletica 2 non compaiono: Luca è troppo piccolo. Cerchi altro? Chiama la segreteria.')
  ok('un corso solo: «non compare»', f(['Pesistica 1']), 'Pesistica 1 non compare: Luca è troppo piccolo. Cerchi altro? Chiama la segreteria.')
  ok('tre corsi: «A, B e C»', f(['A', 'B', 'C']), 'A, B e C non compaiono: Luca è troppo piccolo. Cerchi altro? Chiama la segreteria.')
  ok('più di tre corsi: la frase generica', f(['A', 'B', 'C', 'D']), 'I corsi per grandi non compaiono: Luca è troppo piccolo. Cerchi altro? Chiama la segreteria.')
  ok('senza nome: «il bambino»', f(['Pesistica 1'], ''), 'Pesistica 1 non compare: il bambino è troppo piccolo. Cerchi altro? Chiama la segreteria.')
  ok('nome di soli spazi: «il bambino»', f(['Pesistica 1'], '  '), 'Pesistica 1 non compare: il bambino è troppo piccolo. Cerchi altro? Chiama la segreteria.')
  ok('senza corsi nascosti niente frase', f([]), undefined)
}

// 24. Il totale sempre in vista: nel passo del corso e in QUANTO PAGHI, dalla stessa stima del riepilogo.
{
  console.log('\n24. il totale nei passi del corso e del pagamento')
  const voce = (corso, corsoId, natiDal, natiAl, annuale, trimestre) => ({
    corso, corsoId, eta: '', orari: ['martedì 18.00'], natiDal, natiAl, prezzi: [{ saldo: annuale, annuale, trimestre }],
  })
  const listino = { quota: 50, saldoEntro: '2026-08-31', offerte: [], corsi: [voce('Judo 3', 'judo-3', 2013, 2016, 300, 120), voce('Judo adulti', 'judo-adulti', undefined, 2012, 360, 140)] }
  const corsi = [{ id: 'judo-3', nome: 'Judo 3' }, { id: 'judo-adulti', nome: 'Judo adulti' }]
  const giorno = '2026-10-06'
  // Firma attesa: totaleDelPasso(stato, passo, corsi, listino, giorno) → { etichetta, righe, totale } | undefined.
  // Il totale sta solo al passo del corso: a QUANTO PAGHI il conto è il contenuto del passo.
  // Euro interi senza decimali («50 €»), con i centesimi la virgola («50,50 €»); le righe sono «<voce> <prezzo> €» unite da « + ».
  const t = (stato, passo, l = listino) => m.totaleDelPasso(stato, passo, corsi, l, giorno)

  ok('adulto, passo del corso: la riga e il totale', t(adulto(), 2), { etichetta: 'TOTALE', righe: 'Quota 50 € + Judo adulti annuale 360 €', totale: '410 €' })
  ok('adulto, passo del pagamento (6): niente, il conto è nel passo', t(adulto(), 6), undefined)
  ok('con la formula trimestre: la riga dice trimestre e il prezzo cambia', t(adulto({ formula: 'trimestre' }), 2), { etichetta: 'TOTALE', righe: 'Quota 50 € + Judo adulti trimestre 140 €', totale: '190 €' })
  ok('adulto: il totale è quello della stima di oggi, stessi centesimi', t(adulto(), 2)?.totale, `${m.contoFamiglia([{ chi: 'Luca', corsi: [corsi[1]], formula: 'annuale' }], giorno, listino).totale / 100} €`)
  ok('senza corso scelto: niente totale', t(adulto({ corsi: [] }), 2), undefined)
  ok('senza listino: niente totale', t(adulto(), 2, null), undefined)
  for (const passo of [1, 3, 4, 5, 7]) ok(`adulto, passo ${passo}: il totale non c’è`, t(adulto(), passo), undefined)

  ok('figlio, passo del corso (3): il conto del bambino', t(figlio(), 3), { etichetta: 'TOTALE', righe: 'Quota 50 € + Judo 3 annuale 300 €', totale: '350 €' })
  ok('figlio, passo del pagamento (7): niente', t(figlio(), 7), undefined)
  for (const passo of [1, 2, 4, 5, 6, 8]) ok(`figlio, passo ${passo}: il totale non c’è`, t(figlio(), passo), undefined)

  // Bambino e io: il totale sopra la barra è quello della famiglia, con lo sconto, lo stesso del riepilogo. Le cifre sono quelle di «Anche tu».
  const coi = (cambiIo = {}, cambiBimbo = {}) => lista(() => m.conDatiDellaFamiglia([figlio(cambiBimbo), io(cambiIo)]))
  const tFam = (persone, attivo, passo, c = corsi) => chiama(() => m.totaleDellaFamiglia(persone, attivo, passo, c, listino, giorno))
  const totaleDi = (persone, c = corsi) => chiama(() => `${m.contoDellaFamiglia(persone, c, listino, giorno).totale / 100} €`)
  const famiglia = coi()
  const FAMIGLIA = { etichetta: 'TOTALE FAMIGLIA', righe: 'Matteo 350 € + Paola 410 € − sconto famiglia 60 €', totale: '700 €' }
  ok('bambino e io, al passo del corso del bambino (3): il conto della famiglia, con lo sconto', tFam(famiglia, 0, 3), FAMIGLIA)
  ok('bambino e io, al passo del corso dell’io (2): lo stesso conto', tFam(famiglia, 1, 2), FAMIGLIA)
  ok('bambino e io, al passo del pagamento (7): niente, il conto è nel passo', tFam(famiglia, 0, 7), undefined)
  ok('bambino e io: il totale è quello di contoDellaFamiglia', tFam(famiglia, 0, 3)?.totale, totaleDi(famiglia))
  // Lo sconto è uno solo, anche col bambino in due annuali.
  const dueAnnuali = coi({}, { corsi: ['judo-3', 'judo-adulti'] })
  ok('bambino con due annuali e io: «sconto» una volta sola nelle righe', (tFam(dueAnnuali, 0, 3)?.righe?.match(/[Ss]conto/g) ?? []).length, 1)
  ok('bambino con due annuali e io: il totale è quello di contoDellaFamiglia', tFam(dueAnnuali, 0, 3)?.totale, totaleDi(dueAnnuali))
  ok('l’io a trimestre: nessuno sconto, nessuna riga di sconto', tFam(coi({ formula: 'trimestre' }), 0, 3), { etichetta: 'TOTALE FAMIGLIA', righe: 'Matteo 350 € + Paola 190 €', totale: '540 €' })
  const conPsico = [...corsi, { id: 'psico', nome: 'Psicomotricità' }]
  const famPsico = coi({ corsi: ['psico'] })
  const psico = tFam(famPsico, 0, 3, conPsico)
  ok('il corso dell’io senza prezzo: lo dice la riga', [psico?.righe?.startsWith('Matteo 350 € + Paola 50 €'), psico?.righe?.includes('Psicomotricità prezzo da confermare')], [true, true])
  ok('il corso dell’io senza prezzo: il totale è quello di contoDellaFamiglia', psico?.totale, totaleDi(famPsico, conPsico))
  ok('bambino e io: LA FAMIGLIA (6) non lo mostra', tFam(famiglia, 0, 6), undefined)
  // Un corso senza prezzo nel listino non vale 0: la riga lo dice, e il totale è solo quello che si sa.
  const senzaPrezzo = (l = listino) => m.totaleDelPasso(adulto({ corsi: ['psico'] }), 2, [...corsi, { id: 'psico', nome: 'Psicomotricità' }], l, giorno)
  ok('corso senza prezzo: la riga dice «prezzo da confermare»', senzaPrezzo()?.righe, 'Quota 50 € + Psicomotricità prezzo da confermare')
  ok('corso senza prezzo: il totale è la sola quota', senzaPrezzo()?.totale, '50 €')
  ok('l’io senza corso ancora: nel conto solo il bambino', tFam(coi({ corsi: [] }), 0, 3), { etichetta: 'TOTALE FAMIGLIA', righe: 'Matteo 350 €', totale: '350 €' })
}

// 25. La riga del riepilogo e le parole del componente: i numeri dei passi si calcolano, non si scrivono.
{
  console.log('\n25. il componente non scrive a mano i numeri dei passi')
  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const codice = pagina.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((r) => !/^\s*\/\//.test(r)).join('\n')
  const scritti = codice.match(/\b\d+\s+passi\b|\bpass[oi]\s+\d+\b|\bpassi\s+\d+\s+e\s+\d+\b/gi) ?? []
  ok('niente «N passi» né «passo N» scritti a mano', scritti, [])
  ok('la scelta iniziale conta i passi da passiDi', /passiDi\(\s*'adulto'[^)]*\)\.length/.test(codice) && /passiDi\(\s*'figlio'[^)]*\)\.length/.test(codice), true)
  const rigaCarta = codice.split('\n').find((r) => r.includes('cartaNelRiepilogo')) ?? ''
  ok('la riga «Carta d’identità» del riepilogo non manda al modulo', rigaCarta !== '' && !rigaCarta.includes("modifica('modulo')"), true)
}

// 26. L'avviso del browser all'uscita: la stessa regola di INDIETRO, in una funzione sola.
{
  console.log('\n26. l’avviso all’uscita (chiudere la scheda, ricaricare)')
  // Firma attesa: rispostePerdibili(stato) → boolean, vero quando domandaUscita(perDomandaUscita(stato)) dà la domanda.
  const p = (stato) => { try { return m.rispostePerdibili(stato) } catch (e) { return `ERRORE: ${e.message}` } }
  const uguale = (stato) => m.domandaUscita(m.perDomandaUscita(stato)) !== undefined
  const vuoto = m.nuovoStato('adulto')
  const aperto = adulto({}, { inizio: adulto().risposte, scelte: {}, tratti: 0, file: {}, privacy: false })
  const stati = {
    'stato vuoto': vuoto,
    'stato vuoto, figlio': m.nuovoStato('figlio'),
    'appena aperto, niente di nuovo': aperto,
    'una risposta cambiata': { ...aperto, risposte: { ...aperto.risposte, nome: 'Marco' } },
    'un corso scelto in più': { ...aperto, risposte: { ...aperto.risposte, corsi: ['judo-adulti', 'judo-3'] } },
    'un file caricato': { ...aperto, file: { documento: F('d.jpg') } },
    'una scelta fatta': { ...aperto, scelte: { tesseramento: true } },
    'una firma cominciata': { ...aperto, tratti: 2 },
    'la privacy spuntata': { ...aperto, privacy: true },
    'il luogo del genitore': { ...aperto, natoAGenitore: 'Torino' },
    'il luogo del genitore, solo spazi': { ...aperto, natoAGenitore: '  ' },
    'tutto compilato': adulto(),
    'figlio tutto compilato': figlio(),
  }
  for (const [nome, st] of Object.entries(stati)) ok(`${nome}: l’avviso c’è se c’è la domanda di INDIETRO`, p(st), uguale(st))
  ok('stato vuoto: nessun avviso', p(vuoto), false)
  ok('appena aperto: nessun avviso', p(aperto), false)
  ok('tutto compilato: l’avviso c’è', p(adulto()), true)
  ok('una sola lettera cambiata: l’avviso c’è', p(stati['una risposta cambiata']), true)

  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const codice = pagina.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((r) => !/^\s*\/\//.test(r)).join('\n')
  // L'ascoltatore sta in un useEffect che dipende dalla fase: dopo l'invio riuscito (esito) si toglie.
  const effetto = codice.split('useEffect(').find((b) => b.includes('beforeunload')) ?? ''
  ok('il componente ascolta beforeunload', effetto !== '', true)
  ok('lo decide rispostePerdibili, non una regola scritta di nuovo', codice.includes('P.rispostePerdibili(') && /\[\s*perdibile\s*\]/.test(effetto), true)
  ok('si toglie quando non c’è più niente da perdere (removeEventListener, dipende da perdibile)', /removeEventListener\(\s*'beforeunload'/.test(effetto) && /perdibile/.test(effetto.slice(effetto.lastIndexOf('['))), true)
  ok('guarda la fase: dopo una richiesta arrivata («fatto») non avvisa, negli altri esiti sì', /fase\.tipo\s*===\s*'esito'\s*&&\s*fase\.esito\.esito\s*===\s*'fatto'/.test(codice), true)
  ok('il browser chiede con preventDefault', effetto.includes('preventDefault()'), true)
}

// 27. Il fuoco sulla testa del passo, a ogni cambio di passo (e non a ogni lettera).
{
  console.log('\n27. il fuoco va alla testa del passo')
  const ds = readFileSync('src/components/ds.tsx', 'utf8')
  const avanza = ds.slice(ds.indexOf('export function Avanzamento'), ds.indexOf('export function Avanzamento') + 2500).split(/\n}\n/)[0]
  ok('Avanzamento (ds.tsx) prende il fuoco da codice: tabIndex={-1}', avanza.includes('tabIndex={-1}'), true)
  ok('Avanzamento (ds.tsx) riceve un ref', /\bref\b/.test(avanza), true)
  // Il numero a schermo sparisce, ma chi usa uno screen reader sente ancora «Passo N di N: nome».
  ok('Avanzamento (ds.tsx): aria-label «Passo ${numero} di ${totale}: ${titolo}»', avanza.includes('aria-label={`Passo ${numero} di ${totale}: ${titolo}`}'), true)
  ok('Avanzamento (ds.tsx): niente più numero grande (avanza-numero)', avanza.includes('avanza-numero'), false)
  ok('Avanzamento (ds.tsx): niente più «DI {totale}» a schermo', /DI \{totale\}/.test(avanza), false)
  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const codice = pagina.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((r) => !/^\s*\/\//.test(r)).join('\n')
  const effetto = codice.split('useEffect(').find((b) => /\.focus\(/.test(b) && /Ref\.current/.test(b) && /titolo|Titolo|avanz/i.test(b)) ?? ''
  ok('un useEffect mette a fuoco la testa del passo', effetto !== '', true)
  ok('dipende solo da passo: non scatta a ogni lettera', /\[\s*passo\s*\]\s*\)/.test(effetto), true)
  ok('<Avanzamento> riceve il ref', /<Avanzamento[^>]*\bref=/.test(codice) || /<Avanzamento[^>]*\b(titoloRef|rif)=/.test(codice), true)
}

// 28. L'aiuto in fondo al passo, sopra INDIETRO e AVANTI: CHIAMA col numero di «Contatti», SCRIVI su WhatsApp.
{
  console.log('\n28. CHIAMA e SCRIVI nel flusso')
  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const codice = pagina.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((r) => !/^\s*\/\//.test(r)).join('\n')
  const sito = readFileSync('src/lib/sito.ts', 'utf8')
  const schermata = readFileSync('src/components/IscrizioniScreen.tsx', 'utf8')
  ok('il numero sta in lib/sito: CONTATTI.telefono e chiama', /export const CONTATTI/.test(sito) && /export const chiama/.test(sito), true)
  ok('IscrizioniScreen usa la stessa fonte (chiama)', /import \{[^}]*\bchiama\b[^}]*\} from '..\/lib\/sito'/.test(schermata), true)
  ok('il flusso importa chiama e scrivi da lib/sito', /import \{[^}]*\bchiama\b[^}]*\} from '..\/lib\/sito'/.test(codice) && /import \{[^}]*\bscrivi\b[^}]*\} from '..\/lib\/sito'/.test(codice), true)
  // Il numero col prefisso è uno solo, per CHIAMA e SCRIVI: viene da CONTATTI.telefono.
  ok('scrivi (lib/sito) è costruito da CONTATTI.telefono', /const numero = [^\n]*CONTATTI\.telefono/.test(sito) && /export (const|function) scrivi[^\n]*\$\{numero\}/.test(sito) && /export const chiama[^\n]*\$\{numero\}/.test(sito), true)
  ok('il numero non è scritto a mano nel flusso (niente wa.me, tel:, dieci cifre)', /wa\.me|\btel:|\b\d{3}\s?\d{3}\s?\d{4}\b/.test(codice), false)
  // Il passo: la testa, il contenuto, l'aiuto, la barra. Fra la testa e il contenuto non c'è più niente dell'aiuto.
  const passi = codice.slice(codice.lastIndexOf('<Avanzamento'))
  const corpo = passi.indexOf('{corpo()}')
  const barra = passi.indexOf('<BarraPasso')
  const aiuto = passi.indexOf('Hai bisogno di aiuto? Chiama o scrivi.')
  ok('sparisce «Un dubbio? Chiama la segreteria.»', codice.includes('Un dubbio? Chiama la segreteria.'), false)
  ok('fra la testa e il contenuto niente aiuto (passo-chiama, CHIAMA)', /passo-chiama|CHIAMA|SCRIVI/.test(passi.slice(0, corpo)), false)
  ok('«Hai bisogno di aiuto? Chiama o scrivi.» viene dopo {corpo()} e prima di <BarraPasso', corpo > 0 && aiuto > corpo && aiuto < barra, true)
  const fraAiutoEBarra = aiuto > 0 && barra > aiuto ? passi.slice(aiuto, barra) : ''
  ok('c’è un tasto CHIAMA che usa href={chiama}, nello stesso posto', /<Tasto href=\{chiama\} qui>\s*CHIAMA/.test(fraAiutoEBarra), true)
  // SCRIVI apre WhatsApp fuori: il modulo vive in memoria, aprirlo «qui» perderebbe le risposte.
  const tastoScrivi = fraAiutoEBarra.match(/<Tasto[^>]*>\s*SCRIVI/)?.[0] ?? ''
  ok('c’è un tasto SCRIVI col link dalla lib (href={scrivi(…)})', /href=\{scrivi\(/.test(tastoScrivi), true)
  ok('SCRIVI non ha «qui»: si apre fuori dal modulo', tastoScrivi !== '' && !/\bqui\b/.test(tastoScrivi), true)
  // Lo stesso nome nella testa e nel messaggio: `nomePasso`, il nome del passo a schermo.
  ok('il messaggio di SCRIVI è messaggioAiuto col nome del passo a schermo', /scrivi\(\s*P\.messaggioAiuto\(\s*nomePasso\s*\)/.test(tastoScrivi) && /const nomePasso = nomiPassi\[passo - 1\]/.test(codice) && /<Avanzamento[^>]*titolo=\{nomePasso\}/.test(codice), true)
  const dentroBarra = barra > 0 ? passi.slice(barra, passi.indexOf('/>', barra)) : ''
  ok('l’aiuto non sta dentro la barra del passo: scorre col contenuto', /CHIAMA|SCRIVI|aiuto/i.test(dentroBarra), false)
}

// 29. «RICHIESTA ARRIVATA»: l'importo e i contatti li dà la lib, la schermata mostra.
{
  console.log('\n29. la schermata finale: cosa pagare e chi avvisa')
  const voce = (corso, corsoId, natiDal, natiAl, annuale, trimestre) => ({
    corso, corsoId, eta: '', orari: ['martedì 18.00'], natiDal, natiAl, prezzi: [{ saldo: annuale, annuale, trimestre }],
  })
  const listino = { quota: 50, saldoEntro: '2026-08-31', offerte: [], corsi: [voce('Judo 3', 'judo-3', 2013, 2016, 300, 120), voce('Judo adulti', 'judo-adulti', undefined, 2012, 360, 140)] }
  const corsi = [{ id: 'judo-3', nome: 'Judo 3' }, { id: 'judo-adulti', nome: 'Judo adulti' }]
  const giorno = '2026-10-06'
  // Firma attesa: riassuntoEsito(stato, corsi, listino, giorno) → { importo?: string, daPagare: boolean, senzaPrezzo: string[], contatti: { email: string, telefono: string } }.
  // importo: «410 €» come totaleDelPasso; con più persone (bambino e io) il conto della famiglia con lo sconto (contoDellaFamiglia).
  // senzaPrezzo: i nomi dei corsi senza prezzo nel listino («prezzo da confermare»); l'importo è quello che si sa.
  const r = (stato, l = listino, c = corsi) => { try { return m.riassuntoEsito(stato, c, l, giorno) } catch (e) { return { ERRORE: e.message } } }
  const euro = (cent) => `${cent / 100} €`

  ok('adulto, senza ricevuta: da pagare, 410 €', [r(adulto()).daPagare, r(adulto()).importo], [true, '410 €'])
  ok('l’importo è quello di totaleDelPasso', r(adulto()).importo, m.totaleDelPasso(adulto(), 2, corsi, listino, giorno).totale)
  ok('adulto, trimestre: 190 €', r(adulto({ formula: 'trimestre' })).importo, '190 €')
  ok('adulto, con la ricevuta caricata: niente da pagare', r(adulto({}, { file: { documento: F('d.jpg'), ricevuta: F('r.jpg') } })).daPagare, false)
  ok('figlio, senza ricevuta: da pagare, 350 €', [r(figlio()).daPagare, r(figlio()).importo], [true, '350 €'])
  ok('figlio, con la ricevuta: niente da pagare', r(figlio({}, { file: { documento: F('d.jpg'), ricevuta: F('r.jpg') } })).daPagare, false)

  // Bambino e io: due richieste, un conto solo con lo sconto (le cifre di «Anche tu»).
  const coi = (cambiIo = {}, sulBimbo = {}) => lista(() => m.conDatiDellaFamiglia([figlio({}, sulBimbo), io(cambiIo)]))
  const rF = (persone, c = corsi) => chiama(() => m.riassuntoEsito(persone[0], c, listino, giorno, persone)) ?? {}
  const famiglia = coi()
  const conto = chiama(() => m.contoDellaFamiglia(famiglia, corsi, listino, giorno))
  ok('famiglia: l’importo è quello del conto con lo sconto, stessi centesimi', [rF(famiglia).importo, conto?.totale], ['700 €', 70000])
  ok('famiglia: lo sconto c’è, quindi meno della somma dei due', conto?.totale < 35000 + 41000, true)
  ok('famiglia, con la ricevuta: niente da pagare', rF(coi({}, { file: { documento: F('d.jpg'), ricevuta: F('r.jpg') } })).daPagare, false)
  // Cosa scrive la schermata lo decide la lib: `pagamento` e `famiglia`, `conSconto` e i corsi senza prezzo anche per due richieste.
  ok('pagamento: da pagare con importo', r(adulto()).pagamento, 'importo')
  ok('pagamento: con la ricevuta', r(adulto({}, { file: { documento: F('d.jpg'), ricevuta: F('r.jpg') } })).pagamento, 'ricevuta')
  ok('pagamento: da pagare ma senza listino, l’importo non c’è', r(adulto(), null).pagamento, 'senzaImporto')
  ok('famiglia: lo dice il riassunto', [rF(famiglia).famiglia, r(adulto()).famiglia, r(figlio()).famiglia], [true, false, false])
  ok('famiglia con due annuali: c’è lo sconto', rF(famiglia).conSconto, true)
  ok('famiglia con un trimestre: lo sconto non c’è', rF(coi({ formula: 'trimestre' })).conSconto, false)
  ok('famiglia, corso dell’io senza prezzo: lo dice', rF(coi({ corsi: ['psico'] }), [...corsi, { id: 'psico', nome: 'Psicomotricità' }]).senzaPrezzo, ['Psicomotricità'])
  const senzaSuo = coi({ corsi: [] })
  ok('famiglia, corso dell’io non scelto: il conto del solo bambino', rF(senzaSuo).importo, '350 €')

  ok('senza listino: importo non c’è, ma da pagare sì', [r(adulto(), null).importo, r(adulto(), null).daPagare], [undefined, true])
  ok('senza listino: il resto c’è lo stesso', [r(adulto(), undefined).daPagare, r(adulto(), undefined).contatti?.email], [true, 'paola@esempio.it'])
  ok('senza corso scelto: importo non c’è, ma da pagare sì', [r(adulto({ corsi: [] })).importo, r(adulto({ corsi: [] })).daPagare], [undefined, true])
  ok('corso non nell’elenco dei corsi: importo non c’è, ma da pagare sì', [r(adulto(), listino, []).importo, r(adulto(), listino, []).daPagare], [undefined, true])

  const psico = adulto({ corsi: ['psico'] })
  const corsiPsico = [...corsi, { id: 'psico', nome: 'Psicomotricità' }]
  ok('corso senza prezzo: importo è la sola quota', r(psico, listino, corsiPsico).importo, '50 €')
  ok('corso senza prezzo: lo dice per nome', r(psico, listino, corsiPsico).senzaPrezzo, ['Psicomotricità'])
  ok('corso col prezzo: nessun «da confermare»', [r(adulto()).importo, r(adulto()).senzaPrezzo], ['410 €', []])

  ok('adulto: i contatti sono quelli scritti da chi si iscrive', r(adulto({ email: 'luca@esempio.it', telefono: '333 000 1111' })).contatti, { email: 'luca@esempio.it', telefono: '333 000 1111' })
  ok('figlio: i contatti sono quelli del genitore (stanno nelle risposte)', r(figlio({ email: 'paola@esempio.it', telefono: '347 111 2233' })).contatti, { email: 'paola@esempio.it', telefono: '347 111 2233' })
  ok('contatti con spazi ai lati: tagliati', r(adulto({ email: ' luca@esempio.it ', telefono: ' 333 000 1111 ' })).contatti, { email: 'luca@esempio.it', telefono: '333 000 1111' })

  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const codice = pagina.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((r) => !/^\s*\/\//.test(r)).join('\n')
  ok('la schermata finale usa riassuntoEsito', /P\.riassuntoEsito\(|\briassuntoEsito\(/.test(codice), true)
  ok('la schermata finale usa fraseContatti', /P\.fraseContatti\(|\bfraseContatti\(/.test(codice), true)
  ok('il testo vecchio «se manca qualcosa» non è più scritto nel componente', /ti scrive a \{/.test(codice), false)
}

// 30. La frase dei contatti: chi scrive, chi chiama.
{
  console.log('\n30. la frase «La segreteria ti scrive…»')
  // Firma attesa: fraseContatti(email: string, telefono: string) → string | undefined.
  const f = (e, t) => { try { return m.fraseContatti(e, t) } catch (x) { return `ERRORE: ${x.message}` } }
  ok('solo email', f('luca@esempio.it', ''), 'La segreteria ti scrive a luca@esempio.it, se manca qualcosa.')
  ok('solo telefono', f('', '333 000 1111'), 'La segreteria ti chiama al 333 000 1111, se manca qualcosa.')
  ok('tutti e due: «o»', f('luca@esempio.it', '333 000 1111'), 'La segreteria ti scrive a luca@esempio.it o ti chiama al 333 000 1111, se manca qualcosa.')
  ok('nessuno dei due: niente frase', f('', ''), undefined)
  ok('spazi soltanto: come vuoti', f('  ', ' '), undefined)
  ok('spazi attorno: tagliati', f(' luca@esempio.it ', ''), 'La segreteria ti scrive a luca@esempio.it, se manca qualcosa.')
}

// ---------------------------------------------------------------------------
// L'iscrizione di famiglia: più persone nello stesso flusso, un conto solo.
// Il design è in docs/design-canvas/iscrizione-famiglia/. Le funzioni nuove
// (`MASSIMO_PERSONE`, `puoiAggiungere`, `aggiungiFamiliare`) e le forme
// dell'esito (`aMeta`) sono quelle che queste prove fissano.
// ---------------------------------------------------------------------------
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}

console.log('\n31. la famiglia: il conto unico e lo sconto una volta sola')
{
  const voce = (corso, corsoId, orari, annuale, trimestre) => ({ corso, corsoId, eta: '', orari, prezzi: [{ saldo: annuale, annuale, trimestre }] })
  // Orari tutti diversi: in famiglia non serve che si somiglino.
  const listino = {
    quota: 50,
    saldoEntro: '2026-08-31',
    offerte: [],
    corsi: [
      voce('Judo kids', 'judo-kids', ['lunedì 17.00-18.00'], 280, 105),
      voce('Judo adulti', 'judo-adulti', ['martedì 20.00-21.00'], 360, 140),
      voce('Pilates', 'pilates', ['giovedì 19.00-20.00'], 300, 120),
      voce('Aikido adulti', 'aikido-adulti', ['venerdì 20.00-21.00'], 340, 130),
      voce('Judo 3', 'judo-3', ['sabato 10.00-11.00'], 300, 120),
    ],
  }
  const C = Object.fromEntries(listino.corsi.map((v) => [v.corsoId, { id: v.corsoId, nome: v.corso }]))
  const giorno = '2026-10-06'
  const luca = { chi: 'Luca', corsi: [C['judo-kids']], formula: 'trimestre' }
  const matteo = { chi: 'Matteo', corsi: [C['judo-adulti']], formula: 'annuale' }
  const paola = { chi: 'Paola', corsi: [C.pilates], formula: 'annuale' }
  const neg = (c) => c.righe.filter((r) => r.importo < 0)

  // Il caso dell'utente: l'annuale che costa meno è dell'ultima persona.
  const tre = m.contoFamiglia([luca, matteo, paola], giorno, listino)
  ok('famiglia di 3: lo sconto è 60 € sul Pilates, il 20% di 300', tre.sconto, 6000)
  ok('famiglia di 3: 150 di quote + 105 + 360 + 300 − 60 = 855 €', tre.totale, 85500)
  ok('famiglia di 3: lo sconto è una riga sola, di −60 €', neg(tre).map((r) => r.importo), [-6000])
  ok('famiglia di 3: la riga dello sconto è quella del Pilates, di Paola', neg(tre).map((r) => r.testo.startsWith('Paola: ') && r.testo.includes('Pilates')), [true])
  ok('famiglia di 3: le righe sommano al totale', tre.righe.reduce((t, r) => t + r.importo, 0), tre.totale)
  ok('famiglia di 3: una quota per persona', tre.righe.filter((r) => r.testo.includes('Quota')).map((r) => [r.testo.split(':')[0], r.importo]), [['Luca', 5000], ['Matteo', 5000], ['Paola', 5000]])

  // L'ordine in cui si scrivono le persone non cambia il conto.
  const ordini = [[luca, matteo, paola], [luca, paola, matteo], [matteo, luca, paola], [matteo, paola, luca], [paola, luca, matteo], [paola, matteo, luca]]
  ok('in ogni ordine: stesso totale, 855 €', ordini.map((o) => m.contoFamiglia(o, giorno, listino).totale), ordini.map(() => 85500))
  ok('in ogni ordine: una sola riga di sconto, −60 €', ordini.map((o) => neg(m.contoFamiglia(o, giorno, listino)).map((r) => r.importo)), ordini.map(() => [-6000]))

  // Due persone: l'annuale più basso è della seconda (oggi lo sconto sparisce dal totale).
  const due = m.contoFamiglia([matteo, paola], giorno, listino)
  ok('due persone, il più basso è della seconda: 100 + 360 + 300 − 60 = 700 €', [due.totale, due.sconto, neg(due).map((r) => r.importo)], [70000, 6000, [-6000]])

  // A pari prezzo lo sconto si toglie una volta sola.
  const pari = m.contoFamiglia([{ chi: 'Matteo', corsi: [C['judo-3']], formula: 'annuale' }, paola], giorno, listino)
  ok('due annuali da 300: 100 + 600 − 60 = 640 €, una riga di sconto', [pari.totale, neg(pari).length], [64000, 1])

  // Sei persone: l'annuale più basso è della quarta, tra annuali e trimestri.
  const sei = m.contoFamiglia(
    [luca, matteo, paola, { chi: 'Sofia', corsi: [C['judo-kids']], formula: 'annuale' }, { chi: 'Marta', corsi: [C.pilates], formula: 'trimestre' }, { chi: 'Elena', corsi: [C['aikido-adulti']], formula: 'annuale' }],
    giorno,
    listino,
  )
  ok('sei persone: lo sconto è il 20% di 280 (Judo kids di Sofia), 56 €', sei.sconto, 5600)
  ok('sei persone: 300 di quote + 1505 di corsi − 56 = 1749 €', sei.totale, 174900)
  ok('sei persone: una riga di sconto sola, e le righe sommano al totale', [neg(sei).map((r) => r.importo), sei.righe.reduce((t, r) => t + r.importo, 0)], [[-5600], 174900])

  // Con un annuale solo, o nessuno, non c'è sconto; la quota non si sconta mai.
  const unico = m.contoFamiglia([luca, matteo, { chi: 'Elena', corsi: [C.pilates], formula: 'trimestre' }], giorno, listino)
  ok('un solo annuale in famiglia: nessuno sconto, 150 + 105 + 360 + 120 = 735 €', [unico.sconto, unico.totale, neg(unico).length], [undefined, 73500, 0])

  // Il totale si aggiorna: aggiungere una persona somma la sua stima, e basta.
  const duePrima = m.contoFamiglia([luca, matteo], giorno, listino)
  ok('con Luca e Matteo (un annuale): 100 + 105 + 360 = 565 €, nessuno sconto', [duePrima.totale, duePrima.sconto], [56500, undefined])
  ok('aggiungere Paola: 565 + 50 + 300 = 915 €, meno lo sconto di 60 = 855 €', tre.totale, duePrima.totale + 5000 + 30000 - 6000)

  // Sul corso senza prezzo il conto non si inventa niente.
  const senza = m.contoFamiglia([luca, { chi: 'Ugo', corsi: [{ id: 'yoga', nome: 'Yoga' }], formula: 'annuale' }], giorno, listino)
  ok('un corso fuori listino è segnalato, e di lui si conta solo la quota (155 + 50 = 205 €)', [senza.senzaPrezzo, senza.totale], [['Yoga'], 20500])

  // Le prove di prima restano vere (stesso conto per due, il più basso della prima).
  ok('due annuali, il più basso è della prima: 100 + 280 + 360 − 56 = 684 €', m.contoFamiglia([{ chi: 'Sofia', corsi: [C['judo-kids']], formula: 'annuale' }, matteo], giorno, listino).totale, 68400)
}

console.log('\n32. la famiglia: al massimo sei persone, e chi si aggiunge')
{
  ok('il massimo è sei, in un posto solo', m.MASSIMO_PERSONE, 6)
  ok('con cinque persone se ne aggiunge una', chiama(() => m.puoiAggiungere(5)), true)
  ok('con sei no', chiama(() => m.puoiAggiungere(6)), false)
  ok('con una sola persona sì', chiama(() => m.puoiAggiungere(1)), true)
  // Dove sta la famiglia: AGGIUNGI sta nel suo passo, LA FAMIGLIA, prima di QUANTO PAGHI; mai più all'ultimo.
  const fam = (o) => chiama(() => m.famigliaNelPasso(o))
  ok('da solo, in un passo che non è LA FAMIGLIA: niente famiglia', fam({ tipo: 'corso', quante: 1 }), { pastiglie: false, aggiungi: false, massimo: false })
  ok('da solo, a LA FAMIGLIA: AGGIUNGI', fam({ tipo: 'famiglia', quante: 1 }), { pastiglie: false, aggiungi: true, massimo: false })
  ok('da solo, all’ultimo passo: niente AGGIUNGI', fam({ tipo: 'riepilogo', quante: 1 }), { pastiglie: false, aggiungi: false, massimo: false })
  ok('in famiglia, in un passo: le pastiglie, ma non il tasto', fam({ tipo: 'corso', quante: 3 }), { pastiglie: true, aggiungi: false, massimo: false })
  ok('in famiglia, all’ultimo passo: niente tasto (le persone sono nel riepilogo)', fam({ tipo: 'riepilogo', quante: 3 }), { pastiglie: false, aggiungi: false, massimo: false })
  ok('al massimo, a LA FAMIGLIA: il riquadro del massimo al posto del tasto, senza pastiglie', fam({ tipo: 'famiglia', quante: m.MASSIMO_PERSONE }), { pastiglie: false, aggiungi: false, massimo: true })
  ok('al massimo, all’ultimo passo: nemmeno il riquadro', fam({ tipo: 'riepilogo', quante: m.MASSIMO_PERSONE }), { pastiglie: false, aggiungi: false, massimo: false })
  ok('al massimo, in un passo: solo le pastiglie', fam({ tipo: 'corso', quante: m.MASSIMO_PERSONE }), { pastiglie: true, aggiungi: false, massimo: false })

  const luca = adulto()
  const prima = JSON.stringify(luca.risposte)
  const conAdulto = lista(() => m.aggiungiFamiliare([luca], 'adulto', 0))
  ok('si aggiunge un adulto: due persone, la prima com’era', [conAdulto.length, JSON.stringify(conAdulto[0]?.risposte)], [2, prima])
  const nuovo = conAdulto[1]
  ok('l’adulto nuovo è un adulto, senza nome né corsi', [nuovo?.chi, nuovo?.risposte.nome, nuovo?.risposte.corsi], ['adulto', '', []])
  ok('indirizzo ed email non si copiano all’aggiunta: si prendono da Luca quando servono', [nuovo?.risposte.indirizzo, nuovo?.risposte.email], ['', ''])
  const inFamiglia = lista(() => m.conDatiDellaFamiglia(conAdulto))[1]
  ok('indirizzo ed email sono quelli di Luca, e se lui li cambia cambiano anche qui', [inFamiglia?.risposte.indirizzo, inFamiglia?.risposte.cap, inFamiglia?.risposte.comune, inFamiglia?.risposte.email, inFamiglia?.risposte.telefono], ['Via Roma 1', '10093', 'Collegno', 'paola@esempio.it', '347 111 2233'])
  ok('la sua data di nascita e il suo codice fiscale non sono quelli di Luca', [nuovo?.risposte.natoIl, nuovo?.risposte.codiceFiscale], ['', ''])

  const conBambino = lista(() => m.aggiungiFamiliare([luca], 'figlio', 0))
  const b = conBambino[1]
  const bDaLuca = lista(() => m.conDatiDellaFamiglia(conBambino))[1]
  ok('si aggiunge un bambino: firma Luca, che è nella famiglia, e il posto di chi firma si ricorda', [b?.chi, b?.firmatario, bDaLuca?.risposte.genitoreNome, bDaLuca?.risposte.genitoreCognome, bDaLuca?.risposte.genitoreCodiceFiscale], ['figlio', 0, 'Luca', 'Rossi', CF_LUCA])
  ok('il bambino ha i contatti di Luca e il suo nome da scrivere', [bDaLuca?.risposte.email, bDaLuca?.risposte.comune, bDaLuca?.risposte.nome], ['paola@esempio.it', 'Collegno', ''])
  const dopoBambino = lista(() => m.aggiungiFamiliare(conBambino, 'adulto', 0))
  ok('si può aggiungere anche dopo un bambino', dopoBambino.length, 3)
  ok('chi firma per un bambino è un adulto della famiglia: un bambino no', chiama(() => m.aggiungiFamiliare([luca, b], 'figlio', 1)), 'ERRORE: Per firmare serve un adulto della famiglia: scegline un altro.')
  ok('e uno che non c’è nemmeno', chiama(() => m.aggiungiFamiliare([luca], 'figlio', 4)), 'ERRORE: Per firmare serve un adulto della famiglia: scegline un altro.')

  let sei = [luca]
  for (let i = 1; i < 6; i++) sei = lista(() => m.aggiungiFamiliare(sei, i % 2 ? 'adulto' : 'figlio', 0))
  ok('con sei persone: la sesta c’è', sei.length, 6)
  ok('la settima non si aggiunge, e la frase manda alla segreteria', chiama(() => m.aggiungiFamiliare(sei, 'adulto', 0)), 'ERRORE: In un solo modulo ci sono al massimo sei persone.')
  ok('la famiglia rifiutata non cambia: restano sei', sei.length, 6)

  // Senza sovrapposizioni di orari: l'adulto sceglie fra tutti i corsi della sua età, non solo quelli «stessa ora».
  const listino = {
    quota: 50, saldoEntro: '2026-08-31', offerte: [],
    corsi: [
      { corso: 'Judo 3', corsoId: 'judo-3', eta: '', orari: ['martedì 17.30-18.30'], natiDal: 2013, natiAl: 2016, prezzi: [{ saldo: 300, annuale: 300, trimestre: 120 }] },
      { corso: 'Pilates', corsoId: 'pilates', eta: '', orari: ['giovedì 19.00-20.00'], natiAl: 2012, prezzi: [{ saldo: 300, annuale: 300, trimestre: 120 }] },
    ],
  }
  const corsi = [{ id: 'judo-3', nome: 'Judo 3' }, { id: 'pilates', nome: 'Pilates' }]
  const sceglie = m.corsiPerEtaConStessaOra(corsi, listino, '1984-05-05', ['judo-3'], [
    { corsoId: 'judo-3', giorno: 2, ora: '17:30', durata: 60 },
    { corsoId: 'pilates', giorno: 4, ora: '19:00', durata: 60 },
  ])
  ok('un orario diverso da quello del bambino resta fra i corsi, senza «stessa ora»', [sceglie.adatti.map((c) => c.id), sceglie.adatti.some((c) => c.riga?.includes('stessa ora'))], [['pilates'], false])
}

console.log('\n33. la famiglia: ogni richiesta nomina le altre')
{
  const d0 = () => {
    const inviati = []
    return {
      inviati, modo: 'prova',
      async invia(dati) {
        inviati.push(dati)
        return `r${inviati.length}`
      },
      async caricaFile() {},
    }
  }
  const GENTE = [['Luca', 'rossi'], ['MATTEO', 'Rossi'], ['paola', 'ROSSI'], ['Sofia', 'Rossi'], ['Marta', 'Rossi'], ['Elena', 'Rossi']]
  const persone = (n, note = '') =>
    GENTE.slice(0, n).map(([nome, cognome], i) => ({
      dati: { ...m.risposteDaiPassi(adulto({ nome, cognome, codiceFiscale: `CF${i}` })), note: note || undefined },
      file: {},
    }))
  const proprio = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  const NOMI = GENTE.map(([n]) => proprio(n))

  // Con tre persone ogni nota nomina le altre due, mai se stessa.
  {
    const d = d0()
    const e = await m.mandaRichieste(d, persone(3))
    ok('tre persone: tutte arrivate', [e.esito, e.ids], ['fatto', ['r1', 'r2', 'r3']])
    d.inviati.forEach((x, i) => {
      const altri = NOMI.slice(0, 3).filter((_, j) => j !== i)
      ok(`tre persone: la nota di ${NOMI[i]} nomina ${altri.join(' e ')}`, altri.map((a) => (x.note ?? '').includes(`${a} Rossi`)), [true, true])
      ok(`tre persone: la nota di ${NOMI[i]} non nomina se stessa`, (x.note ?? '').includes(`${NOMI[i]} Rossi`), false)
      ok(`tre persone: la nota di ${NOMI[i]} dice che è una famiglia`, (x.note ?? '').includes('sconto famiglia da applicare'), true)
    })
    ok('tre persone: una nota sola, mai due righe uguali', d.inviati.every((x) => (x.note ?? '').split('\n').length === 1), true)
  }
  // Con due il testo di oggi non cambia (provato anche sopra, nel punto 12).
  {
    const d = d0()
    await m.mandaRichieste(d, persone(2))
    ok('due persone: il testo di oggi, per tutte e due', d.inviati.map((x) => (x.note ?? '')), ['mandata insieme alla richiesta di Matteo Rossi, sconto famiglia da applicare', 'mandata insieme alla richiesta di Luca Rossi, sconto famiglia da applicare'])
  }
  // Una persona sola: nessun legame.
  {
    const d = d0()
    await m.mandaRichieste(d, persone(1))
    ok('una persona: le note non si toccano', d.inviati[0].note, undefined)
  }
  // Le note scritte restano, il legame va a capo.
  {
    const d = d0()
    await m.mandaRichieste(d, persone(4, 'Preferiamo il martedì'))
    ok('quattro persone: le note scritte restano, il legame va a capo', d.inviati.map((x) => (x.note ?? '').startsWith('Preferiamo il martedì\n')), [true, true, true, true])
    ok('quattro persone: ognuna nomina le altre tre', d.inviati.map((x, i) => NOMI.slice(0, 4).filter((_, j) => j !== i).every((a) => (x.note ?? '').includes(a))), [true, true, true, true])
  }
  // Sei persone, con le note al massimo: il database accetta 1000 caratteri e chi scrive ne ha 900.
  {
    const d = d0()
    const scritto = 'x'.repeat(m.MASSIMO_NOTE)
    await m.mandaRichieste(d, persone(6, scritto))
    ok('il massimo delle note scritte resta 900', m.MASSIMO_NOTE, 900)
    ok('sei persone, note da 900: nessuna supera i 1000 del database', d.inviati.map((x) => (x.note ?? '').length <= 1000), [true, true, true, true, true, true])
    ok('sei persone: quello che hanno scritto non si taglia', d.inviati.map((x) => (x.note ?? '').startsWith(scritto)), [true, true, true, true, true, true])
    ok('sei persone: ognuna nomina le altre cinque, e non se stessa', d.inviati.map((x, i) => NOMI.filter((a, j) => j !== i).every((a) => (x.note ?? '').slice(900).includes(a)) && !(x.note ?? '').slice(900).includes(NOMI[i])), [true, true, true, true, true, true])
    ok('sei persone: il legame dice ancora «sconto famiglia»', d.inviati.map((x) => (x.note ?? '').slice(900).includes('sconto famiglia')), [true, true, true, true, true, true])
  }
  // Nomi da 60 + 60 caratteri, il massimo dei campi: la riga con i nomi si usa solo se ci sta, se no una riga corta fissa.
  {
    const lunghi = (n, note) =>
      Array.from({ length: n }, (_, i) => ({
        dati: { ...m.risposteDaiPassi(adulto({ nome: String.fromCharCode(97 + i).repeat(60), cognome: String.fromCharCode(97 + i).repeat(60), codiceFiscale: `CF${i}` })), note: note || undefined },
        file: {},
      }))
    const scritto = 'x'.repeat(m.MASSIMO_NOTE)
    const SCONTO = 'sconto famiglia da applicare'
    for (const n of [2, 3, 6]) {
      const d = d0()
      await m.mandaRichieste(d, lunghi(n, scritto))
      ok(`${n} persone, nomi lunghi, note da 900: nessuna supera i 1000 del database`, d.inviati.map((x) => (x.note ?? '').length <= 1000), Array(n).fill(true))
      ok(`${n} persone, nomi lunghi, note da 900: le note scritte restano e il legame dice lo sconto famiglia`, d.inviati.map((x) => (x.note ?? '').startsWith(scritto + '\n') && (x.note ?? '').endsWith(SCONTO)), Array(n).fill(true))
    }
    const sei = d0()
    await m.mandaRichieste(sei, lunghi(6, scritto))
    ok('sei persone, nomi lunghi: la riga corta fissa, ≤ 100 caratteri', sei.inviati.map((x) => x.note.slice(901)), Array(6).fill('con altre cinque persone della famiglia: sconto famiglia da applicare'))
    const due = d0()
    await m.mandaRichieste(due, lunghi(2, scritto))
    ok('due persone, nomi lunghi: la riga corta dice «un’altra persona»', due.inviati.map((x) => x.note.slice(901)), Array(2).fill('con un’altra persona della famiglia: sconto famiglia da applicare'))
    const tre = d0()
    await m.mandaRichieste(tre, lunghi(3, scritto))
    ok('tre persone, nomi lunghi: la riga corta dice «altre due»', tre.inviati.map((x) => x.note.slice(901)), Array(3).fill('con altre due persone della famiglia: sconto famiglia da applicare'))
    // Senza note i nomi ci stanno, e restano.
    const libere = d0()
    await m.mandaRichieste(libere, lunghi(6, ''))
    ok('sei persone, nomi lunghi, senza note: i nomi ci stanno e restano', libere.inviati.map((x) => x.note.startsWith('con ') && !x.note.includes('persone della famiglia') && x.note.split(', ').length === 5), Array(6).fill(true))
    ok('sei persone, nomi lunghi, senza note: sotto i 1000', libere.inviati.map((x) => x.note.length <= 1000), Array(6).fill(true))
    // Le note del database, tutte: nessuna richiesta di un invio supera quanto accetta `invia`.
    ok('le note mandate passano il controllo di `invia` della prova', sei.inviati.map((x) => m.controlla({ ...m.risposteDaiPassi(adulto()), note: x.note })), Array(6).fill(null))
  }
  // Il legame è lo stesso quando una richiesta si rimanda: chi arriva dopo nomina anche chi era già arrivato.
  {
    const d = d0()
    let rifiuta = true
    d.invia = async (dati) => {
      if (rifiuta && dati.nome.toLowerCase() === 'paola') throw new Error('giù')
      d.inviati.push(dati)
      return `r${d.inviati.length}`
    }
    const e = await m.mandaRichieste(d, persone(3))
    rifiuta = false
    await e.riprova()
    const nota = d.inviati.find((x) => x.nome.toLowerCase() === 'paola')?.note ?? ''
    ok('riprovando, la nota di chi mancava nomina chi era già arrivato', ['Luca Rossi', 'Matteo Rossi'].map((a) => nota.includes(a)), [true, true])
  }
}

console.log('\n34. la famiglia: l’invio si ferma a metà')
{
  const finto = () => {
    const log = []
    const inviati = []
    const guasti = { invia: null, file: null }
    let n = 0
    return {
      log, inviati, guasti, modo: 'prova',
      async invia(dati) {
        log.push(`invia ${dati.nome}`)
        const g = guasti.invia?.(dati)
        if (g !== undefined && g !== null) throw g
        inviati.push(dati)
        return `r${++n}`
      },
      async caricaFile(id, tipo) {
        log.push(`file ${id} ${tipo}`)
        const g = guasti.file?.(tipo, id)
        if (g !== undefined && g !== null) throw g
      },
    }
  }
  const NOMI = ['Luca', 'Matteo', 'Paola', 'Sofia']
  const quattro = (d) =>
    NOMI.map((nome, i) => ({
      dati: m.risposteDaiPassi(adulto({ nome, cognome: 'Rossi', codiceFiscale: `CF${i}` })),
      file: { documento: F('d.jpg') },
      faiPdf: async () => {
        d.log.push(`pdf ${nome}`)
        return F('modulo.pdf')
      },
    }))
  const MSG = 'Da questa email sono già arrivate 6 richieste oggi: se serve, scrivi alla segreteria'

  // Paola e Sofia non partono: Luca e Matteo sì.
  {
    const d = finto()
    d.guasti.invia = (dati) => (dati.nome === 'Paola' ? new Error(MSG) : null)
    const e = await m.mandaRichieste(d, quattro(d))
    ok('a metà: l’esito dice chi è arrivato e chi no, per nome', [e.esito, e.arrivati, e.mancanti], ['aMeta', ['Luca Rossi', 'Matteo Rossi'], ['Paola Rossi', 'Sofia Rossi']])
    ok('a metà: il motivo e gli id di chi è arrivato', [e.perche, e.ids], [MSG, ['r1', 'r2']])
    ok('a metà: dopo il primo rifiuto non si prova con Sofia', d.log.includes('invia Sofia'), false)
    ok('a metà: i file di chi è arrivato sono partiti', d.log.filter((x) => x.startsWith('file')), ['file r1 modulo', 'file r1 documento', 'file r2 modulo', 'file r2 documento'])
    d.guasti.invia = null
    d.log.length = 0
    const e2 = await e.riprova()
    ok('RIPROVA rimanda solo Paola e Sofia, con i loro file, senza rifare i PDF', d.log, ['invia Paola', 'file r3 modulo', 'file r3 documento', 'invia Sofia', 'file r4 modulo', 'file r4 documento'])
    ok('RIPROVA: finisce bene, con le quattro richieste in ordine', [e2.esito, e2.ids], ['fatto', ['r1', 'r2', 'r3', 'r4']])
    ok('mai un doppione: ognuno è stato mandato una volta sola', NOMI.map((n) => d.inviati.filter((x) => x.nome === n).length), [1, 1, 1, 1])
  }
  // Si riprova e si ferma di nuovo: ora manca solo Sofia.
  {
    const d = finto()
    d.guasti.invia = (dati) => (dati.nome === 'Matteo' ? new Error(MSG) : null)
    const e = await m.mandaRichieste(d, quattro(d))
    ok('si ferma alla seconda: arrivata solo Luca', [e.esito, e.arrivati, e.mancanti], ['aMeta', ['Luca Rossi'], ['Matteo Rossi', 'Paola Rossi', 'Sofia Rossi']])
    d.guasti.invia = (dati) => (dati.nome === 'Sofia' ? new Error(MSG) : null)
    d.log.length = 0
    const e2 = await e.riprova()
    ok('riprovando si ferma di nuovo: ora manca solo Sofia', [e2.esito, e2.arrivati, e2.mancanti, e2.ids], ['aMeta', ['Luca Rossi', 'Matteo Rossi', 'Paola Rossi'], ['Sofia Rossi'], ['r1', 'r2', 'r3']])
    d.guasti.invia = null
    d.log.length = 0
    const e3 = await e2.riprova()
    ok('il secondo RIPROVA manda solo Sofia', d.log.filter((x) => x.startsWith('invia')), ['invia Sofia'])
    ok('e finisce bene', [e3.esito, e3.ids.length], ['fatto', 4])
  }
  // Un solo RIPROVA alla volta: due tocchi non mandano due volte.
  {
    const d = finto()
    d.guasti.invia = (dati) => (dati.nome === 'Paola' ? new Error(MSG) : null)
    const e = await m.mandaRichieste(d, quattro(d))
    d.guasti.invia = null
    d.log.length = 0
    await Promise.all([e.riprova(), e.riprova()])
    ok('due tocchi su RIPROVA: Paola e Sofia una volta sola', d.log.filter((x) => x.startsWith('invia')), ['invia Paola', 'invia Sofia'])
  }
  // Non parte nemmeno la prima: non nasce niente.
  {
    const d = finto()
    d.guasti.invia = () => new Error(MSG)
    const e = await m.mandaRichieste(d, quattro(d))
    ok('la prima non parte: «fermo», e nessun’altra provata', [e.esito, d.log.filter((x) => x.startsWith('invia'))], ['fermo', ['invia Luca']])
  }
  // Tutte arrivate, ma un file della terza no: si dice di chi, e RIPROVA manda solo quello.
  {
    const d = finto()
    d.guasti.file = (tipo, id) => (id === 'r3' && tipo === 'documento' ? new Error('troppo grande') : null)
    const e = await m.mandaRichieste(d, quattro(d))
    ok('un file della terza non parte: si dice quale e di chi', [e.esito, e.mancati], ['file', [{ richiesta: 2, tipo: 'documento' }]])
    d.guasti.file = null
    d.log.length = 0
    await e.riprova()
    ok('RIPROVA rimanda solo quel file', d.log, ['file r3 documento'])
  }
  // Il vecchio caso a due resta com'era: la seconda no.
  {
    const d = finto()
    d.guasti.invia = (dati) => (dati.nome === 'Matteo' ? new Error(MSG) : null)
    const e = await m.mandaRichieste(d, quattro(d).slice(0, 2))
    ok('con due persone resta «secondaNo», come prima', [e.esito, e.ids], ['secondaNo', ['r1']])
  }
}

console.log('\n35. la famiglia nella schermata: pastiglie, cosa manca a tutti, il totale, il riepilogo, l’esito a metà')
{
  const voce = (corso, corsoId, orari, annuale, trimestre) => ({ corso, corsoId, eta: '', orari, prezzi: [{ saldo: annuale, annuale, trimestre }] })
  const listino = {
    quota: 50, saldoEntro: '2026-08-31', offerte: [],
    corsi: [voce('Judo kids', 'judo-kids', ['lunedì 17.00-18.00'], 280, 105), voce('Judo adulti', 'judo-adulti', ['martedì 20.00-21.00'], 360, 140), voce('Pilates', 'pilates', ['giovedì 19.00-20.00'], 300, 120)],
  }
  const corsi = listino.corsi.map((v) => ({ id: v.corsoId, nome: v.corso }))
  const giorno = '2026-10-06'
  const luca = adulto({ nome: 'Luca', corsi: ['judo-kids'], formula: 'trimestre' })
  // Ognuno col suo codice fiscale, che torna col nome.
  const dati = (nome, natoIl, donna = false) => ({ nome, natoIl, codiceFiscale: cfDi(nome, 'Rossi', natoIl, donna) })
  const matteo = adulto({ ...dati('Matteo', '1990-03-03'), corsi: ['judo-adulti'], formula: 'annuale' })
  const paola = adulto({ ...dati('Paola', '1980-01-01', true), corsi: ['pilates'], formula: 'annuale' })
  const tre = [luca, matteo, paola]
  const senzaFirma = adulto({ ...dati('Paola', '1980-01-01', true), corsi: ['pilates'], formula: 'annuale' }, { tratti: 0 })

  // Chi è, sulla pastiglia e nelle frasi.
  ok('il nome scritto, con la maiuscola', chiama(() => m.nomeDellaPersona(adulto({ nome: 'luca' }), 0)), 'Luca')
  ok('senza nome: «Adulto 2» o «Bambino 3», col posto nella famiglia', [chiama(() => m.nomeDellaPersona(adulto({ nome: '' }), 1)), chiama(() => m.nomeDellaPersona(figlio({ nome: '' }), 2))], ['Adulto 2', 'Bambino 3'])

  // Chi può firmare per un bambino: gli adulti della famiglia, con il loro posto.
  ok('firmano gli adulti, non i bambini', chiama(() => m.chiPuoFirmare([luca, figlio(), paola])), [{ indice: 0, nome: 'Luca' }, { indice: 2, nome: 'Paola' }])
  ok('con un bambino solo, nessuno può firmare per un altro', chiama(() => m.chiPuoFirmare([figlio()])), [])

  // In famiglia nessuno chiede «anche te?»: ogni persona decide da sé, il conto è uno.
  const conBambino = lista(() => m.aggiungiFamiliare([figlio(), adulto()], 'figlio', 1))
  ok('si aggiunge un bambino firmato dal secondo adulto: tre persone', conBambino.length, 3)
  ok('il passo del corso non chiede «anche te?» a nessuno', conBambino.map((p) => (p.chi === 'figlio' ? m.mancaNelPasso({ ...p, risposte: { ...p.risposte, corsi: ['x'], formula: 'annuale' } }, 3).includes('SCEGLI: ANCHE TE?') : false)), [false, false, false])

  // Cosa manca a tutti, per l'ultimo passo: ogni voce dice di chi è, e la chiave porta a quella persona.
  ok('una sola persona: le voci di sempre, senza nome', chiama(() => m.mancantiFamiglia([senzaFirma])), [{ chiave: 'firma', nome: 'FIRMA' }])
  ok('più persone: «FIRMA DI PAOLA», e la chiave ha il posto di Paola', chiama(() => m.mancantiFamiglia([luca, matteo, senzaFirma])), [{ chiave: '2:firma', nome: 'FIRMA DI PAOLA' }])
  ok('tutto a posto: niente', chiama(() => m.mancantiFamiglia(tre)), [])
  ok('chi non ha scritto niente: le sue voci, di lui', chiama(() => m.mancantiFamiglia([luca, adulto({ nome: '', corsi: [] })]).filter((x) => x.chiave === '1:corsi')), [{ chiave: '1:corsi', nome: 'CORSO DI ADULTO 2' }])
  ok('quante cose mancano a una persona, per la pastiglia', [chiama(() => m.quantoManca(luca)), chiama(() => m.quantoManca(senzaFirma)), chiama(() => m.quantoManca(adulto({ corsi: [] }, { tratti: 0 })))], [0, 1, 2])

  // A quale passo porta una voce.
  const vuota = adulto({ nome: '', corsi: [] }, { file: {}, tratti: 0 })
  ok('il passo di ciò che manca: nome 1, corso 2, firma 3, carta 4', ['nome', 'corsi', 'firma', 'documento'].map((k) => chiama(() => m.passoDelCampo(vuota, k))), [1, 2, 3, 4])
  ok('una cosa che non manca non porta da nessuna parte', chiama(() => m.passoDelCampo(luca, 'nome')), undefined)
  ok('il passo di un campo del genitore, nel flusso del figlio', [chiama(() => m.passoDelCampo(figlio({ genitoreNome: '' }), 'genitoreNome')), chiama(() => m.passoDelCampo(figlio({}, { privacy: false }), 'privacy'))], [2, 4])

  // Il conto della famiglia, con le persone che hanno già un corso.
  const conto = chiama(() => m.contoDellaFamiglia(tre, corsi, listino, giorno))
  ok('il conto: 150 di quote + 105 + 360 + 300 − 60 = 855 €', [conto.totale, conto.sconto], [85500, 6000])
  ok('chi non ha un corso ancora non entra nel conto', chiama(() => m.contoDellaFamiglia([luca, adulto({ nome: 'Paola', corsi: [] })], corsi, listino, giorno).totale), 15500)
  ok('senza listino, nessun conto', chiama(() => m.contoDellaFamiglia(tre, corsi, undefined, giorno)), undefined)
  ok('due con lo stesso nome non si confondono: due righe di quota', chiama(() => m.contoDellaFamiglia([adulto({ nome: 'Marco', corsi: ['judo-adulti'], formula: 'annuale' }), adulto({ nome: 'Marco', corsi: ['pilates'], formula: 'annuale' })], corsi, listino, giorno).righe.filter((r) => r.testo.includes('Quota')).length), 2)

  // Il totale sopra la barra: di tutta la famiglia, con lo sconto, nei passi del corso e del pagamento.
  const t = (persone, attivo, passo) => chiama(() => m.totaleDellaFamiglia(persone, attivo, passo, corsi, listino, giorno))
  ok('famiglia di tre, passo del corso: ognuno con la sua cifra, lo sconto a parte', t(tre, 0, 2), { etichetta: 'TOTALE FAMIGLIA', righe: 'Luca 155 € + Matteo 410 € + Paola 350 € − sconto famiglia 60 €', totale: '855 €' })
  ok('nel passo del pagamento (6) no: il conto è nel passo', t(tre, 1, 6), undefined)
  ok('negli altri passi non c’è', [t(tre, 0, 1), t(tre, 0, 3), t(tre, 0, 4), t(tre, 0, 5), t(tre, 0, 7)], [undefined, undefined, undefined, undefined, undefined])
  ok('senza sconto la riga non lo nomina', t([luca, adulto({ ...dati('Paola', '1980-01-01', true), corsi: ['pilates'], formula: 'trimestre' })], 0, 2), { etichetta: 'TOTALE FAMIGLIA', righe: 'Luca 155 € + Paola 170 €', totale: '325 €' })
  ok('una persona sola: com’era, il suo totale', t([matteo], 0, 2), chiama(() => m.totaleDelPasso(matteo, 2, corsi, listino, giorno)))
  // Bambino e io sono una famiglia come le altre: il totale e l'esito sono quelli della famiglia, con lo sconto (le cifre di «Anche tu»).
  const conIo = lista(() => m.conDatiDellaFamiglia([figlio({ corsi: ['judo-kids'], formula: 'annuale' }), io()]))
  ok('bambino e io: il totale della famiglia, con lo sconto, e vale 684 €: 50 + 280 + 50 + 360 − 56', t(conIo, 0, 3), { etichetta: 'TOTALE FAMIGLIA', righe: 'Matteo 330 € + Paola 410 € − sconto famiglia 56 €', totale: '684 €' })
  ok('l’esito di bambino e io: lo stesso conto, con lo sconto', [chiama(() => m.riassuntoEsito(conIo[0], corsi, listino, giorno, conIo))?.importo, chiama(() => m.riassuntoEsito(conIo[0], corsi, listino, giorno, conIo))?.conSconto], ['684 €', true])

  // Il riepilogo: una riga per persona, e se manca qualcosa lo dice.
  const righe = chiama(() => m.righeDellaFamiglia([luca, matteo, senzaFirma], corsi))
  ok('tre righe, coi nomi', righe.map((r) => r.titolo), ['Luca Rossi', 'Matteo Rossi', 'Paola Rossi'])
  ok('a posto: il corso e come paga; manca: cosa', righe.map((r) => r.dettaglio), ['Judo kids · trimestre', 'Judo adulti · annuale', 'manca: firma'])
  ok('chi manca è segnato, e MODIFICA o VAI A porta al passo giusto', righe.map((r) => [r.manca, r.passo]), [[false, 1], [false, 1], [true, 3]])
  ok('più di tre cose: le prime tre e quante altre', chiama(() => m.righeDellaFamiglia([adulto({ nome: '', cognome: '', corsi: [] }, { tratti: 0, scelte: {}, privacy: false, file: {} })], corsi)[0].dettaglio.startsWith('manca: ') && m.righeDellaFamiglia([adulto({ nome: '', cognome: '', corsi: [] }, { tratti: 0, scelte: {}, privacy: false, file: {} })], corsi)[0].dettaglio.includes(' e altre ')), true)

  // L'esito di una famiglia: l'importo è quello del conto, la ricevuta di uno basta.
  const r = (persone) => chiama(() => m.riassuntoEsito(persone[0], corsi, listino, giorno, persone))
  ok('famiglia: 855 € con lo sconto, da pagare', [r(tre).importo, r(tre).famiglia, r(tre).conSconto, r(tre).daPagare, r(tre).pagamento], ['855 €', true, true, true, 'importo'])
  ok('famiglia: la ricevuta di una persona basta', [r([luca, matteo, adulto({ ...dati('Paola', '1980-01-01', true), corsi: ['pilates'], formula: 'annuale' }, { file: { documento: F('d.jpg'), ricevuta: F('r.jpg') } })]).daPagare, r([luca, matteo, paola]).pagamento], [false, 'importo'])

  // Al massimo: il riquadro che prende il posto di AGGIUNGI UN FAMILIARE dice lo stesso numero della regola, in lettere.
  ok('il riquadro dei sei: etichetta, titolo e testo', m.frasiDelMassimo, { etichetta: 'SIETE IN SEI', titolo: 'Di più, chiamaci: vi iscriviamo insieme.', testo: 'In un solo modulo ci sono al massimo sei persone.' })
  ok('il testo del riquadro è la frase dell’errore, una sola', m.frasiDelMassimo.testo, chiama(() => m.aggiungiFamiliare(Array.from({ length: m.MASSIMO_PERSONE }, () => adulto()), 'adulto', 0)).replace('ERRORE: ', ''))

  // Uscire dalla famiglia perde le risposte di tutti, anche di chi non ha scritto niente.
  ok('una persona che non ha scritto niente: si esce senza domande', chiama(() => m.uscitaDellaFamiglia([m.nuovoStato('adulto')])), undefined)
  ok('una persona con qualcosa di scritto: la domanda', chiama(() => m.uscitaDellaFamiglia([luca])), DOMANDA)
  ok('due persone, anche vuote: la domanda', chiama(() => m.uscitaDellaFamiglia([m.nuovoStato('adulto'), m.nuovoStato('adulto')])), DOMANDA)

  // L'invio a metà, detto: chi è arrivato, chi no. Le richieste, non le persone: così il genere non conta.
  const meta = (a, x) => chiama(() => m.fraseAMeta(a, x))
  ok('2 su 4', meta(['Luca Rossi', 'Matteo Rossi'], ['Paola Rossi', 'Sofia Rossi']), {
    titolo: 'ARRIVATE 2 RICHIESTE SU 4',
    arrivate: 'Le richieste di Luca Rossi e Matteo Rossi sono arrivate e restano: non le rimandiamo.',
    mancano: 'Quelle di Paola Rossi e Sofia Rossi non sono partite. Riprova ora, oppure chiama la segreteria.',
  })
  ok('1 su 3: il singolare', meta(['Luca Rossi'], ['Matteo Rossi', 'Paola Rossi']), {
    titolo: 'ARRIVATA 1 RICHIESTA SU 3',
    arrivate: 'La richiesta di Luca Rossi è arrivata e resta: non la rimandiamo.',
    mancano: 'Quelle di Matteo Rossi e Paola Rossi non sono partite. Riprova ora, oppure chiama la segreteria.',
  })
  ok('2 su 3: manca una sola, e tre nomi si elencano con la virgola', [meta(['Luca Rossi', 'Matteo Rossi'], ['Paola Rossi']).mancano, meta(['Luca Rossi'], ['A B', 'C D', 'E F']).mancano], [
    'Quella di Paola Rossi non è partita. Riprova ora, oppure chiama la segreteria.',
    'Quelle di A B, C D e E F non sono partite. Riprova ora, oppure chiama la segreteria.',
  ])
}

console.log('\n36. la famiglia: i dati si prendono quando servono, e le regole che stavano nella schermata')
{
  const luca = adulto()
  const vuoto = (cambi = {}) => adulto({ nome: '', cognome: '', codiceFiscale: '', indirizzo: '', cap: '', comune: '', email: '', telefono: '', ...cambi }, { tratti: 0, file: {}, scelte: {}, privacy: false })
  const lei = (persone, i) => chiama(() => m.conDatiDellaFamiglia(persone))[i]

  // I dati del familiare vengono dalla prima persona e da chi firma, al momento dell'invio e del conto: se Luca li scrive o li corregge dopo, arrivano.
  const aggiunto = lista(() => m.aggiungiFamiliare([vuoto()], 'adulto', 0))
  ok('Luca non ha ancora scritto: il familiare non ha niente', [lei(aggiunto, 1).risposte.indirizzo, lei(aggiunto, 1).risposte.email], ['', ''])
  const dopo = [{ ...aggiunto[0], risposte: { ...aggiunto[0].risposte, indirizzo: 'Via Nuova 5', cap: '10093', comune: 'Collegno', email: 'luca@esempio.it', telefono: '347 999 8877' } }, aggiunto[1]]
  ok('Luca compila dopo: il familiare ha i suoi dati', [lei(dopo, 1).risposte.indirizzo, lei(dopo, 1).risposte.email, lei(dopo, 1).risposte.telefono], ['Via Nuova 5', 'luca@esempio.it', '347 999 8877'])
  const corretto = [{ ...dopo[0], risposte: { ...dopo[0].risposte, indirizzo: 'Via Giusta 9' } }, dopo[1]]
  ok('Luca corregge: il familiare ha quello corretto, non quello vecchio', lei(corretto, 1).risposte.indirizzo, 'Via Giusta 9')
  const suoi = [corretto[0], { ...corretto[1], risposte: { ...corretto[1].risposte, indirizzo: 'Via Sua 2', email: '' } }]
  ok('ciò che il familiare ha scritto lui resta suo; quello che ha lasciato vuoto è di Luca', [lei(suoi, 1).risposte.indirizzo, lei(suoi, 1).risposte.email], ['Via Sua 2', 'luca@esempio.it'])
  ok('Luca, la prima persona, non cambia', JSON.stringify(lei(suoi, 0)), JSON.stringify(suoi[0]))
  const sola = [luca]
  ok('una persona sola: la stessa lista, niente da prendere', chiama(() => m.conDatiDellaFamiglia(sola)) === sola, true)
  ok('non si cambiano gli stati di partenza', JSON.stringify(aggiunto[1].risposte.indirizzo), '""')

  // Il bambino prende il genitore da chi firma, anche se chi firma scrive dopo.
  const conFiglio = lista(() => m.aggiungiFamiliare([vuoto()], 'figlio', 0))
  ok('chi firma non ha scritto ancora: il bambino non ha il genitore', [lei(conFiglio, 1).risposte.genitoreNome, lei(conFiglio, 1).risposte.genitoreCodiceFiscale], [undefined, undefined].map((x) => x ?? ''))
  const firmato = [{ ...conFiglio[0], risposte: { ...conFiglio[0].risposte, nome: 'Luca', cognome: 'Rossi', codiceFiscale: CF_LUCA } }, conFiglio[1]]
  ok('chi firma scrive dopo: il bambino ha nome, cognome e codice di chi firma', [lei(firmato, 1).risposte.genitoreNome, lei(firmato, 1).risposte.genitoreCognome, lei(firmato, 1).risposte.genitoreCodiceFiscale], ['Luca', 'Rossi', CF_LUCA])
  const corretto2 = [{ ...firmato[0], risposte: { ...firmato[0].risposte, nome: 'Luciano' } }, firmato[1]]
  ok('e se lo corregge, il bambino ha il nome corretto', lei(corretto2, 1).risposte.genitoreNome, 'Luciano')
  const proprio = [firmato[0], { ...firmato[1], risposte: { ...firmato[1].risposte, genitoreNome: 'Altro' } }]
  ok('un genitore scritto sul bambino resta quello', lei(proprio, 1).risposte.genitoreNome, 'Altro')
  const secondo = lista(() => m.aggiungiFamiliare([vuoto(), vuoto()], 'figlio', 1))
  const secondoFirma = [secondo[0], { ...secondo[1], risposte: { ...secondo[1].risposte, nome: 'Paola' } }, secondo[2]]
  ok('il bambino firmato dalla seconda persona prende i dati della seconda', lei(secondoFirma, 2).risposte.genitoreNome, 'Paola')

  // Se chi firma non è più un adulto (cambiaScelta), il bambino è fermato, con una frase per chi usa l'app.
  const famiglia = [{ ...firmato[0] }, { ...firmato[1], risposte: { ...firmato[1].risposte, nome: 'Matteo' } }]
  ok('chi firma è un adulto: nessun fermo', chiama(() => m.fermoDellaFamiglia(famiglia)), undefined)
  const luiBambino = [m.cambiaScelta(famiglia[0], 'figlio'), famiglia[1]]
  // Luca ora è un bambino: Matteo, firmato dal posto 0, lo firma chi compila, che scrive i suoi dati di genitore (sezione 41).
  ok('chi firma non è più un adulto: il bambino si ferma, e la frase dice cosa fare', chiama(() => m.fermoDellaFamiglia(luiBambino)), 'Per Matteo firma chi compila: scrivi i tuoi dati nel passo CHI FIRMA di Luca, oppure chiama la segreteria.')
  ok('la frase prende il nome del passo da passiDi, non lo scrive a parte', String(chiama(() => m.fermoDellaFamiglia(luiBambino))).includes(`nel passo ${m.passiDi('figlio')[1]} di`), true)
  const paolaAdulta = adulto({ nome: 'Paola', codiceFiscale: CF_PAOLA })
  ok('chi firma è un altro adulto che non lo è più: «rimetti … come adulto»', chiama(() => m.fermoDellaFamiglia([luca, m.cambiaScelta(paolaAdulta, 'figlio'), { ...famiglia[1], firmatario: 1 }])), 'Paola non è più un adulto, e Matteo ha bisogno di un adulto che firmi: rimetti Paola come adulto, oppure chiama la segreteria.')
  ok('e i dati di chi non è più adulto non passano al bambino', lei(luiBambino, 1).risposte.genitoreNome, '')
  ok('una persona sola non si ferma mai', chiama(() => m.fermoDellaFamiglia([luca])), undefined)
  ok('un bambino senza firmatario (era un adulto che ha cambiato scelta) non si ferma', chiama(() => m.fermoDellaFamiglia([luca, m.cambiaScelta(adulto(), 'figlio')])), undefined)

  // Aggiungere un familiare azzera la foto del modulo di tutti: in famiglia si firma qui.
  const inFoto = adulto({}, { file: { documento: F('d.jpg'), modulo: F('foglio.jpg') } })
  const conFoto = lista(() => m.aggiungiFamiliare([inFoto], 'adulto', 0))
  ok('la foto del foglio firmato non vale più, il documento resta', [conFoto[0].file.modulo, !!conFoto[0].file.documento], [undefined, true])
  ok('e il bambino aggiunto: il foglio non c’è', conFoto[1].file.modulo, undefined)
  ok('lo stato di partenza non si tocca', !!inFoto.file.modulo, true)

  // Il foglio si firma in foto solo da soli, e solo se si è scelto così.
  ok('foto: da soli, scelta la foto', chiama(() => m.firmaInFoto(true, 1)), true)
  ok('foto: non scelta', chiama(() => m.firmaInFoto(false, 1)), false)
  ok('foto: in famiglia no', chiama(() => m.firmaInFoto(true, 2)), false)

  // La sigla della provincia del genitore: la dice il codice fiscale, se no quella scritta.
  const luoghi = { L219: [['TORINO', 'TO']] }
  ok('sigla: la dice il codice del genitore', chiama(() => m.siglaDelGenitore(figlio(), luoghi, 'MI')), 'TO')
  ok('sigla: un luogo che l’elenco non ha: quella scritta', chiama(() => m.siglaDelGenitore(figlio({ genitoreCodiceFiscale: 'RSSPLA80A41Z999X' }), luoghi, 'MI')), 'MI')
  ok('sigla: senza elenco dei luoghi, quella scritta', chiama(() => m.siglaDelGenitore(figlio(), null, 'MI')), 'MI')
  ok('sigla: senza codice, quella scritta', chiama(() => m.siglaDelGenitore(figlio({ genitoreCodiceFiscale: '' }), luoghi, 'MI')), 'MI')

  // La pastiglia, per chi legge lo schermo: «manca 1 cosa» / «mancano N cose».
  ok('manca 1 cosa', chiama(() => m.fraseCoseCheMancano(1)), 'manca 1 cosa')
  ok('mancano 3 cose', chiama(() => m.fraseCoseCheMancano(3)), 'mancano 3 cose')
  ok('l’etichetta della pastiglia: nome e cosa manca', [chiama(() => m.etichettaPastiglia('PAOLA', 1)), chiama(() => m.etichettaPastiglia('PAOLA', 2)), chiama(() => m.etichettaPastiglia('PAOLA', 0))], ['PAOLA: manca 1 cosa', 'PAOLA: mancano 2 cose', 'PAOLA'])

  // Il tasto dell'esito a metà: per chi è rimasto, o per i mancanti.
  ok('riprova per uno', chiama(() => m.etichettaRiprova(['Paola'])), 'RIPROVA PER PAOLA')
  ok('riprova per due', chiama(() => m.etichettaRiprova(['Paola', 'Sofia'])), 'RIPROVA PER PAOLA E SOFIA')
  ok('riprova per più di due: i mancanti', chiama(() => m.etichettaRiprova(['Paola', 'Sofia', 'Elena'])), 'RIPROVA PER I MANCANTI')
  ok('riprova per cinque: i mancanti', chiama(() => m.etichettaRiprova(['A', 'B', 'C', 'D', 'E'])), 'RIPROVA PER I MANCANTI')
}

// ---------------------------------------------------------------------------
console.log('\n37. chi firma, col nome: in famiglia «tu» non è sempre chi compila')
{
  const nicola = adulto({ nome: 'Nicola', cognome: 'Albertini' })
  const paola = adulto({ nome: 'Paola', cognome: 'Rossi' })
  // Manuela la firma Paola (la seconda), Matteo la firma Nicola (chi compila).
  const famiglia = [nicola, paola, figlio({ nome: 'Manuela', genitoreNome: 'Paola' }, { firmatario: 1 }), figlio({ genitoreNome: 'Nicola' }, { firmatario: 0 })]
  ok('chi compila: «tu»', chiama(() => m.chiFirma(famiglia, 0)), undefined)
  ok('un altro adulto della famiglia: il suo nome', chiama(() => m.chiFirma(famiglia, 1)), 'Paola')
  ok('un bambino firmato da un altro adulto: il nome di chi firma', chiama(() => m.chiFirma(famiglia, 2)), 'Paola')
  ok('un bambino firmato da chi compila: «tu»', chiama(() => m.chiFirma(famiglia, 3)), undefined)
  ok('da soli, un figlio: «tu»', chiama(() => m.chiFirma([figlio()], 0)), undefined)
  // Il nome di chi firma il bambino arriva da conDatiDellaFamiglia, quando il suo campo è vuoto.
  const vera = m.conDatiDellaFamiglia([nicola, paola, figlio({ nome: 'Manuela', genitoreNome: '', genitoreCognome: '', genitoreCodiceFiscale: '' }, { firmatario: 1 })])
  ok('il bambino prende il nome di chi firma dalla famiglia', chiama(() => m.chiFirma(vera, 2)), 'Paola')
  ok('…e la carta porta quel nome', m.testoFile('figlio', 'documento', 'Manuela', vera[2].risposte.genitoreNome).etichetta, 'LA CARTA D’IDENTITÀ DI PAOLA')
  // Il genitore mette per primo il bambino, poi aggiunge sé stesso: firma lui, quindi «tu».
  const primaIlBambino = m.conDatiDellaFamiglia([figlio({ nome: 'Manuela', genitoreNome: 'Nicola' }), nicola, figlio({ genitoreNome: '' }, { firmatario: 1 })])
  ok('persona 0 bambina, chi compila si aggiunge: «tu» per lui e per chi firma lui', [1, 2].map((i) => m.chiFirma(primaIlBambino, i)), [undefined, undefined])
  // Un adulto aggiunto che diventa bambino non ha un firmatario: i dati del genitore li scrive chi compila.
  ok('bambino senza firmatario, genitore un altro: il suo nome', chiama(() => m.chiFirma([nicola, figlio({ genitoreNome: 'Paola' })], 1)), 'Paola')
  ok('bambino senza firmatario, genitore chi compila: «tu»', chiama(() => m.chiFirma([nicola, figlio({ genitoreNome: 'nicola ' })], 1)), undefined)
  ok('chi compila senza nome resta «tu»', [m.chiFirma([adulto({ nome: '' }), paola], 0), m.chiFirma([figlio({ genitoreNome: '' }), paola], 0)], [undefined, undefined])
  ok('un bambino firmato da chi compila è «tu» anche senza nomi', chiama(() => m.chiFirma([adulto({ nome: '' }), figlio({ genitoreNome: '' }, { firmatario: 0 })], 1)), undefined)
  ok('…e anche se il nome nel bambino è scritto diverso', chiama(() => m.chiFirma([nicola, figlio({ genitoreNome: 'Nico' }, { firmatario: 0 })], 1)), undefined)
  ok('il nome cancellato: vuoto, non «tu»', chiama(() => m.chiFirma([nicola, adulto({ nome: '  ' })], 1)), '')

  ok('passo del genitore, chi compila: «Firma tu»', chiama(() => m.fraseDelGenitore(undefined)), 'Firma tu, che sei maggiorenne. I tuoi dati servono anche per il modulo.')
  ok('passo del genitore, un altro adulto: il suo nome', chiama(() => m.fraseDelGenitore('Paola')), 'Firma Paola, che è maggiorenne. I suoi dati servono anche per il modulo.')
  ok('passo del genitore, un altro adulto senza nome: «il genitore»', chiama(() => m.fraseDelGenitore('')), 'Firma il genitore, che è maggiorenne. I suoi dati servono anche per il modulo.')

  ok('le foto del genitore, col nome e senza', [m.etichettaSueFoto('Nicola'), m.etichettaSueFoto('')], ['LE FOTO E I VIDEO DI NICOLA', 'LE FOTO E I VIDEO DEL GENITORE'])
  ok('la carta nel riepilogo: di chi firma, del genitore, o di un adulto', [m.cartaNelRiepilogo('figlio', 'Nicola'), m.cartaNelRiepilogo('figlio', ' '), m.cartaNelRiepilogo('adulto', 'Nicola')], ['Carta d’identità di Nicola', 'Carta d’identità del genitore', 'Carta d’identità'])
  ok('il titolo dell’ok, chi compila: IL TUO OK', chiama(() => m.titoloDellOk(undefined)), 'IL TUO OK')
  ok('il titolo dell’ok, un altro adulto: col suo nome', chiama(() => m.titoloDellOk('Paola')), 'L’OK DI PAOLA')
  ok('il titolo dell’ok, senza nome: di chi firma', chiama(() => m.titoloDellOk(' ')), 'L’OK DI CHI FIRMA')
}

// ---------------------------------------------------------------------------
// QUANTO PAGHI: un passo suo fra i documenti e il riepilogo, un conto e una
// causale per tutto il modulo, una ricevuta sola. Il design è in
// docs/design-canvas/quanto-paghi/.
// ---------------------------------------------------------------------------
console.log('\n38. QUANTO PAGHI')
{
  const voce = (corso, corsoId, annuale, trimestre) => ({ corso, corsoId, eta: '', orari: ['martedì 18.00'], prezzi: [{ saldo: annuale, annuale, trimestre }] })
  const listino = {
    quota: 50, saldoEntro: '2026-08-31', offerte: [],
    corsi: [voce('Judo 3', 'judo-3', 300, 120), voce('Judo adulti', 'judo-adulti', 360, 140), voce('Pilates', 'pilates', 300, 120), voce('Judo kids', 'judo-kids', 280, 105)],
  }
  const corsi = [...listino.corsi.map((v) => ({ id: v.corsoId, nome: v.corso })), { id: 'psico', nome: 'Psicomotricità' }]
  const giorno = '2026-10-06'
  // Come euroBreve: euro interi senza decimali, i centesimi con la virgola.
  const euro = (cent) => `${cent % 100 === 0 ? cent / 100 : (cent / 100).toFixed(2).replace('.', ',')} €`
  const soloTestoEImporto = (righe) => (righe ?? []).map((r) => ({ testo: r.testo, importo: r.importo }))
  const dati = (nome, cognome, natoIl, donna = false) => ({ nome, cognome, natoIl, codiceFiscale: cfDi(nome, cognome, natoIl, donna) })

  const luca = adulto({ corsi: ['judo-adulti'], formula: 'annuale' })
  // Bambino e io (chi compila che si iscrive con lui), coi dati che l'io prende dal bambino.
  const conIo = lista(() => m.conDatiDellaFamiglia([figlio(), io()]))
  const manuela = adulto({ ...dati('Manuela', 'Albertini', '1985-05-05', true), corsi: ['pilates'], formula: 'annuale' })
  const nicola = adulto({ ...dati('Nicola', 'Albertini', '1984-04-04'), corsi: ['judo-adulti'], formula: 'annuale' })
  const sara = adulto({ ...dati('Sara', 'Albertini', '1990-01-01', true), corsi: ['judo-kids'], formula: 'trimestre' })
  const tre = [manuela, nicola, sara]
  // Il passo QUANTO PAGHI è il penultimo, dopo LA FAMIGLIA: 6 per l'adulto, 7 per il figlio.
  const PAGA = { adulto: 6, figlio: 7 }

  // --- il passo ---
  ok('il passo del pagamento non ferma mai: adulto senza ricevuta', m.mancaNelPasso(adulto(), PAGA.adulto), [])
  ok('il passo del pagamento non ferma mai: nemmeno con tutto vuoto', m.mancaNelPasso(m.nuovoStato('adulto'), PAGA.adulto), [])
  ok('il passo del pagamento non ferma mai: figlio', m.mancaNelPasso(m.nuovoStato('figlio'), PAGA.figlio), [])
  ok('il passo del pagamento: la barra non ha voci', m.mancanti(m.nuovoStato('adulto'), PAGA.adulto), [])
  ok('quanto manca non cambia: 17 cose a un adulto vuoto, 18 a un figlio vuoto (non più «anche te?»), 0 a chi ha fatto tutto', [m.quantoManca(m.nuovoStato('adulto')), m.quantoManca(m.nuovoStato('figlio')), m.quantoManca(adulto())], [17, 18, 0])
  ok('l’ultimo passo è il riepilogo, dopo QUANTO PAGHI', [m.passiDi('adulto').at(-2), m.passiDi('adulto').at(-1)], ['PAGAMENTO', 'INVIO'])
  ok('la riga della ricevuta nel riepilogo porta a QUANTO PAGHI, caricata o no', [adulto(), adulto({}, { file: { documento: F('d.jpg'), ricevuta: F('r.jpg') } })].map((s) => m.righeRiepilogo(s, corsi).find((r) => r.cosa === 'ricevuta')?.passo), ['pagamento', 'pagamento'])
  ok('la carta e la firma del riepilogo restano ai documenti e al modulo', [m.passoDelRiepilogo('carta'), m.passoDelRiepilogo('firma')], ['documenti', 'modulo'])

  // --- il totale sopra la barra ---
  const tFam = (persone, attivo, passo) => chiama(() => m.totaleDellaFamiglia(persone, attivo, passo, corsi, listino, giorno))
  ok('in famiglia, al passo del corso: TOTALE FAMIGLIA, e le righe cominciano dalle persone', [tFam(tre, 0, 2)?.etichetta, tFam(tre, 0, 2)?.righe?.startsWith('Manuela ')], ['TOTALE FAMIGLIA', true])
  ok('in famiglia, a QUANTO PAGHI: niente totale sopra la barra', tFam(tre, 0, PAGA.adulto), undefined)
  ok('in famiglia, ai documenti: niente totale', tFam(tre, 0, 4), undefined)
  ok('da soli: TOTALE', tFam([luca], 0, 2)?.etichetta, 'TOTALE')
  ok('bambino e io, al corso: TOTALE FAMIGLIA; a QUANTO PAGHI niente', [tFam(conIo, 0, 3)?.etichetta, tFam(conIo, 0, PAGA.figlio)], ['TOTALE FAMIGLIA', undefined])
  ok('bambino e io, al corso: il totale di contoDellaFamiglia, con lo sconto: 700 €', [tFam(conIo, 0, 3)?.totale, chiama(() => euro(m.contoDellaFamiglia(conIo, corsi, listino, giorno).totale))], ['700 €', '700 €'])
  ok('bambino e io, ai documenti: niente totale', tFam(conIo, 0, 5), undefined)

  // --- il conto del modulo ---
  const conto = (persone, ...l) => chiama(() => m.contoDelModulo(persone, corsi, l.length ? l[0] : listino, giorno))
  const fam = chiama(() => m.contoDellaFamiglia(tre, corsi, listino, giorno))
  const cTre = conto(tre)
  ok('più persone: le righe del conto della famiglia', soloTestoEImporto(cTre?.righe), soloTestoEImporto(fam?.righe))
  ok('più persone: il totale, i corsi senza prezzo, e se c’è lo sconto', [cTre?.totale, cTre?.senzaPrezzo, cTre?.conSconto], [fam?.totale, fam?.senzaPrezzo, fam?.righe.some((r) => r.importo < 0)])
  const stato = chiama(() => m.contoDellaFamiglia(conIo, corsi, listino, giorno))
  const cAnche = conto(conIo)
  ok('bambino e io: le righe di contoDellaFamiglia', soloTestoEImporto(cAnche?.righe), soloTestoEImporto(stato?.righe))
  ok('bambino e io: il totale (700 €), nessun corso senza prezzo, e lo sconto', [cAnche?.totale, cAnche?.senzaPrezzo, cAnche?.conSconto], [70000, [], true])
  const stima = m.stimaIscrizione({ chi: 'Luca', corsi: [corsi.find((c) => c.id === 'judo-adulti')], formula: 'annuale' }, [], giorno, listino)
  const cLuca = conto([luca])
  ok('una persona sola: le righe della sua stima', soloTestoEImporto(cLuca?.righe), soloTestoEImporto(stima.righe))
  ok('una persona sola: il totale della stima, senza sconto', [cLuca?.totale, cLuca?.senzaPrezzo, cLuca?.conSconto], [stima.totale, [], false])
  ok('un corso senza prezzo: lo dice', conto([adulto({ corsi: ['psico'] })])?.senzaPrezzo, ['Psicomotricità'])
  ok('senza listino: niente conto', [conto([luca], undefined), conto(tre, undefined)], [undefined, undefined])
  ok('senza nessun corso scelto: niente conto', [conto([adulto({ corsi: [] })]), conto([adulto({ corsi: [] }), adulto({ nome: 'Paola', corsi: [] })])], [undefined, undefined])

  // B5: una cifra sola, al centesimo: il conto del modulo, il totale sopra la barra a QUANTO PAGHI, l'importo dell'esito.
  for (const [nome, persone, paga] of [['adulto solo', [luca], 2], ['bambino e io', conIo, 3], ['famiglia di 3', tre, 2]]) {
    const c = conto(persone)
    const esito = chiama(() => m.riassuntoEsito(persone[0], corsi, listino, giorno, persone))
    ok(`${nome}: il conto del modulo, il totale al passo del corso e l’esito dicono la stessa cifra`, [c?.totale === undefined ? 'nessun conto' : euro(c.totale), tFam(persone, 0, paga)?.totale, esito?.importo], [esito?.importo, esito?.importo, esito?.importo])
  }

  // --- la causale ---
  const causale = (persone) => chiama(() => m.causaleDelModulo(persone, corsi))
  const chi = (nome, cognome) => adulto({ nome, cognome, corsi: ['judo-adulti'] })
  ok('una persona: come oggi, nome, cognome e corsi', causale([luca]), 'Iscrizione Luca Rossi · Judo adulti')
  ok('una persona: la stessa di causale()', causale([luca]), m.causale('Luca', 'Rossi', ['Judo adulti']))
  ok('due con lo stesso cognome: i nomi, il cognome una volta, niente corsi', causale([chi('Manuela', 'Albertini'), chi('Nicola', 'Albertini')]), 'Iscrizione Manuela e Nicola Albertini')
  ok('tre con lo stesso cognome', causale([chi('Manuela', 'Albertini'), chi('Luca', 'Albertini'), chi('Nicola', 'Albertini')]), 'Iscrizione Manuela, Luca e Nicola Albertini')
  ok('cognomi diversi: a gruppi, nell’ordine in cui compaiono', causale([chi('Manuela', 'Albertini'), chi('Paola', 'Rossi'), chi('Nicola', 'Albertini')]), 'Iscrizione Manuela e Nicola Albertini, Paola Rossi')
  const scritti = causale([chi('Manuela', 'Albertini'), chi('Nicola', ' ALBERTINI ')])
  ok('il cognome uguale senza badare a maiuscole e spazi: una volta sola', [typeof scritti === 'string' && scritti.startsWith('Iscrizione Manuela e Nicola '), (String(scritti).match(/albertini/gi) ?? []).length], [true, 1])
  ok('bambino e io: prima il bambino, poi il genitore, senza corsi', causale(conIo), 'Iscrizione Matteo e Paola Rossi')
  const lunghi = Array.from({ length: 6 }, (_, i) => chi(String.fromCharCode(65 + i) + 'a'.repeat(59), String.fromCharCode(65 + i) + 'b'.repeat(59)))
  const seiLunghi = causale(lunghi)
  ok('sei persone dai nomi lunghi: la causale sta nei 140 caratteri del bonifico', [typeof seiLunghi === 'string' && seiLunghi.startsWith('Iscrizione '), String(seiLunghi).length <= 140], [true, true])
  const unaLunga = causale([adulto({ nome: 'a'.repeat(60), cognome: 'b'.repeat(60), corsi: ['judo-adulti', 'pilates', 'judo-kids'] })])
  ok('una persona dal nome lungo, con tanti corsi: anche lei nei 140', [typeof unaLunga === 'string' && unaLunga.startsWith('Iscrizione '), String(unaLunga).length <= 140], [true, true])

  // --- la ricevuta, una per modulo ---
  const ric = F('ricevuta.jpg')
  const doc = F('d.jpg')
  ok('nessuno l’ha caricata: niente ricevuta', chiama(() => m.ricevutaDelModulo(tre)), undefined)
  ok('la ricevuta del modulo, chiunque l’abbia', chiama(() => m.ricevutaDelModulo([manuela, nicola, { ...sara, file: { ...sara.file, ricevuta: ric } }])) === ric, true)

  const caricata = lista(() => m.conLaRicevuta([manuela, nicola, { ...sara, file: { documento: doc, ricevuta: F('vecchia.jpg') } }], ric, 80200))
  ok('caricata: sta nella prima persona', caricata[0]?.file?.ricevuta === ric, true)
  ok('caricata: in nessun’altra, nemmeno in chi ne aveva una', caricata.slice(1).map((p) => p.file.ricevuta), [undefined, undefined])
  ok('caricata: gli altri file restano', [!!caricata[0]?.file?.documento, caricata[2]?.file?.documento === doc], [true, true])
  ok('caricata: il totale e quante persone c’erano', caricata[0]?.ricevutaPer, { totale: 80200, persone: 3 })
  ok('caricata: tre persone restano tre', caricata.length, 3)
  const tolta = lista(() => m.conLaRicevuta(caricata, undefined, 80200))
  ok('tolta: nessuno ha la ricevuta', [tolta.length, tolta.map((p) => p.file.ricevuta)], [3, [undefined, undefined, undefined]])
  ok('tolta: niente più «ricevutaPer»', tolta.map((p) => p.ricevutaPer), [undefined, undefined, undefined])

  // B8: la ricevuta resta quando la famiglia cambia.
  const due = lista(() => m.conLaRicevuta([manuela, nicola], ric, 62200))
  const conLuca = lista(() => m.aggiungiFamiliare(due, 'adulto', 0))
  ok('dopo AGGIUNGI UN FAMILIARE la ricevuta resta, con il totale di quando si è caricata', [chiama(() => m.ricevutaDelModulo(conLuca)) === ric, conLuca[0]?.ricevutaPer], [true, { totale: 62200, persone: 2 }])
  const cambiata = due.length ? [m.cambiaScelta(due[0], 'figlio'), ...due.slice(1)] : []
  ok('dopo aver cambiato scelta alla prima persona la ricevuta resta', [chiama(() => m.ricevutaDelModulo(cambiata)) === ric, cambiata[0]?.ricevutaPer], [true, { totale: 62200, persone: 2 }])

  // B9: all'invio ogni richiesta porta la stessa ricevuta.
  const faiPdf = async () => F('modulo.pdf')
  const daMandare = lista(() => m.conLaRicevuta(tre, ric, 80200)).flatMap((p) => m.richiesteDaMandare(p, '', faiPdf))
  ok('famiglia di 3: tre richieste da mandare', daMandare.length, 3)
  const conRic = lista(() => m.conLaRicevutaInTutte(daMandare, ric))
  ok('ogni richiesta ha la ricevuta del modulo', [conRic.length, conRic.map((d) => d.file.ricevuta === ric)], [3, [true, true, true]])
  ok('gli altri file di ogni richiesta restano', conRic.map((d) => !!d.file.documento), [true, true, true])
  const senzaRic = lista(() => m.conLaRicevutaInTutte(daMandare, undefined))
  ok('senza ricevuta nessuna richiesta la ha', [senzaRic.length, senzaRic.map((d) => d.file.ricevuta)], [3, [undefined, undefined, undefined]])
  const anche = lista(() => m.richiesteDelModulo(m.conLaRicevuta(conIo, ric, 70000), (p) => m.richiesteDaMandare(p, '', faiPdf)))
  ok('bambino e io: il bambino e il genitore hanno la stessa ricevuta', anche.map((d) => d.file.ricevuta === ric), [true, true])

  // L'avviso quando il totale cambia dopo che la ricevuta è caricata.
  const avviso = (persone, ora) => chiama(() => m.avvisoRicevuta(persone, ora))
  const per = (totale, persone, lista) => [{ ...lista[0], ricevutaPer: { totale, persone } }, ...lista.slice(1)]
  const luca3 = adulto({ ...dati('Luca', 'Albertini', '2000-02-02'), corsi: ['judo-kids'] })
  const sara4 = adulto({ ...dati('Sara', 'Albertini', '2001-02-02', true), corsi: ['judo-kids'] })
  const ugo5 = adulto({ ...dati('Ugo', 'Albertini', '2002-02-02'), corsi: ['judo-kids'] })
  const PIU = 'La differenza la paghi in segreteria o con un altro bonifico.'
  ok('senza ricevuta caricata: niente avviso', avviso([manuela, nicola, luca3], 80200), undefined)
  ok('stesso totale: niente avviso', avviso(per(62200, 2, [manuela, nicola]), 62200), undefined)
  ok('totale che non si sa: niente avviso', avviso(per(62200, 2, [manuela, nicola, luca3]), undefined), undefined)
  ok('una persona aggiunta dopo, il totale cresce', avviso(per(62200, 2, [manuela, nicola, luca3]), 80200), `Hai caricato la ricevuta prima di aggiungere Luca: ora il totale è 802 €, cioè 180 € in più. ${PIU}`)
  ok('due persone aggiunte: «Luca e Sara»', avviso(per(62200, 2, [manuela, nicola, luca3, sara4]), 98200), `Hai caricato la ricevuta prima di aggiungere Luca e Sara: ora il totale è 982 €, cioè 360 € in più. ${PIU}`)
  ok('tre persone aggiunte: «Luca, Sara e Ugo»', avviso(per(62200, 2, [manuela, nicola, luca3, sara4, ugo5]), 116200), `Hai caricato la ricevuta prima di aggiungere Luca, Sara e Ugo: ora il totale è 1162 €, cioè 540 € in più. ${PIU}`)
  ok('una persona aggiunta senza nome: «Adulto 3»', avviso(per(62200, 2, [manuela, nicola, adulto({ nome: '' })]), 80200), `Hai caricato la ricevuta prima di aggiungere Adulto 3: ora il totale è 802 €, cioè 180 € in più. ${PIU}`)
  ok('nessuna persona nuova, il totale cresce', avviso(per(62200, 3, [manuela, nicola, luca3]), 80200), `Hai caricato la ricevuta quando il totale era 622 €: ora è 802 €, cioè 180 € in più. ${PIU}`)
  ok('il totale scende', avviso(per(80200, 3, [manuela, nicola, luca3]), 62200), 'Hai caricato la ricevuta quando il totale era 802 €: ora è 622 €, cioè 180 € in meno. La differenza la sistema la segreteria.')
  ok('le cifre coi centesimi, come euroBreve', avviso(per(5000, 1, [luca]), 10050), `Hai caricato la ricevuta quando il totale era 50 €: ora è 100,50 €, cioè 50,50 € in più. ${PIU}`)
}

// ---------------------------------------------------------------------------
console.log('\n39. QUANTO PAGHI: «più persone» è una regola sola, e la riga della ricevuta')
{
  const corsi = [{ id: 'judo-adulti', nome: 'Judo adulti' }, { id: 'judo-3', nome: 'Judo 3' }]
  ok('una persona sola: no', chiama(() => m.insieme([adulto()])), false)
  ok('un figlio da solo: no', chiama(() => m.insieme([figlio()])), false)
  ok('bambino e io: sì', chiama(() => m.insieme([figlio(), io()])), true)
  ok('una famiglia: sì', chiama(() => m.insieme([adulto(), adulto({ nome: 'Paola' })])), true)
  ok('un figlio da solo: la causale è sua, coi corsi', chiama(() => m.causaleDelModulo([figlio()], corsi)), 'Iscrizione Matteo Rossi · Judo 3')

  const ric = F('ricevuta.pdf')
  const riga = (persone) => chiama(() => m.rigaDellaRicevuta(persone))
  ok('la riga della ricevuta: caricata, porta a QUANTO PAGHI', [riga(m.conLaRicevuta([adulto(), adulto({ nome: 'Paola' })], ric, 1000))?.valore, riga([adulto()])?.passo], ['ricevuta.pdf', 'pagamento'])
  ok('la riga della ricevuta: chiunque l’abbia, la trova', riga([adulto(), adulto({ nome: 'Paola' }, { file: { ricevuta: ric } })])?.manca, undefined)
  ok('la riga della ricevuta: non caricata, CARICA', [riga([adulto()])?.manca, riga([adulto()])?.carica], [true, 'ricevuta'])
  // L'invio passa da qui: la famiglia diventa richieste, e la ricevuta del modulo va in ognuna.
  const pdf = async () => F('modulo.pdf')
  const tre = m.conLaRicevuta([adulto(), adulto({ nome: 'Paola' }), figlio({ genitoreNome: 'Luca' }, { firmatario: 0 })], ric, 1000)
  const inviate = chiama(() => m.richiesteDelModulo(tre, (p) => m.richiesteDaMandare(p, 'TO', pdf)))
  ok('l’invio di una famiglia di 3: tre richieste, ognuna con la ricevuta', Array.isArray(inviate) ? inviate.map((x) => x.file.ricevuta?.name) : inviate, ['ricevuta.pdf', 'ricevuta.pdf', 'ricevuta.pdf'])
  const senza = chiama(() => m.richiesteDelModulo([adulto(), adulto({ nome: 'Paola' })], (p) => m.richiesteDaMandare(p, 'TO', pdf)))
  ok('senza ricevuta, nessuna la porta', Array.isArray(senza) ? senza.map((x) => 'ricevuta' in x.file) : senza, [false, false])
  ok('il riepilogo di uno solo usa la stessa riga', m.righeRiepilogo(adulto(), corsi).find((x) => x.cosa === 'ricevuta'), riga([adulto()]))
}

// ---------------------------------------------------------------------------
// LA FAMIGLIA: un passo a sé, prima di QUANTO PAGHI. «Ti iscrivi anche tu?» ci
// si sposta: chi compila un bambino si aggiunge come un familiare (l'io), che
// riusa firma e carta del bambino. Il design è in docs/design-canvas/famiglia-passo/.
// ---------------------------------------------------------------------------
console.log('\n40. LA FAMIGLIA')
{
  const voce = (corso, corsoId, natiDal, natiAl, annuale, trimestre) => ({ corso, corsoId, eta: '', orari: [], natiDal, natiAl, prezzi: [{ saldo: annuale, annuale, trimestre }] })
  const listino = {
    quota: 50, saldoEntro: '2026-08-31', offerte: [],
    corsi: [
      voce('Judo 3', 'judo-3', 2013, 2016, 300, 120),
      voce('Judo 2', 'judo-2', 2017, 2019, 280, 110),
      voce('Lotta 3', 'lotta-3', 2013, 2016, 300, 120),
      voce('Judo piccoli', 'judo-piccoli', 2020, 2022, 250, 100),
      voce('Psicomotricità', 'psico', 2021, 2023, 200, 80),
      voce('Judo adulti', 'judo-adulti', undefined, 2008, 360, 140),
      voce('Pilates', 'pilates', undefined, 2008, 300, 120),
      voce('Aikido adulti', 'aikido-adulti', undefined, 2008, 340, 130),
    ],
  }
  // Yoga non ha prezzo nel listino.
  const corsi = [...listino.corsi.map((v) => ({ id: v.corsoId, nome: v.corso })), { id: 'yoga', nome: 'Yoga' }]
  const giorno = '2026-10-06'
  const ora = (corsoId, g, o, durata = 60) => ({ corsoId, giorno: g, ora: o, durata })
  // Lunedì e giovedì alle 18 Judo 3 e Judo adulti; il sabato alle 10 Aikido adulti e tre corsi per bambini.
  const orari = [
    ora('judo-3', 1, '18:00'), ora('judo-3', 4, '18:00'),
    ora('judo-adulti', 1, '18:00', 90), ora('judo-adulti', 4, '18:00', 90),
    ora('judo-2', 3, '17:00'),
    ora('pilates', 2, '20:00'),
    ora('yoga', 5, '20:00'),
    ora('aikido-adulti', 6, '10:00'), ora('lotta-3', 6, '10:00'), ora('judo-piccoli', 6, '10:00'), ora('psico', 6, '10:30', 30),
  ]
  // Per chi iscrive Matteo (Judo 3): Judo 2 alla stessa ora, per un fratello.
  const orariB = orari.map((o) => (o.corsoId === 'judo-2' ? null : o)).filter(Boolean).concat([ora('judo-2', 1, '18:00'), ora('judo-2', 4, '18:00')])
  // …e anche Pilates il giovedì alle 18: due corsi per un adulto.
  const orariB2 = [...orariB, ora('pilates', 4, '18:00')]
  const luca = (cambi = {}) => adulto({ corsi: ['judo-adulti'], formula: 'annuale', ...cambi })
  const matteo = figlio()
  const ric = F('ricevuta.jpg')

  // --- i passi ---
  ok('il passo si chiama FAMIGLIA: il 5 per l’adulto, il 6 per il figlio', [m.passiDi('adulto')[4], m.passiDi('figlio')[5]], ['FAMIGLIA', 'FAMIGLIA'])
  ok('LA FAMIGLIA non ferma mai: adulto vuoto', m.mancaNelPasso(m.nuovoStato('adulto'), 5), [])
  ok('LA FAMIGLIA non ferma mai: figlio vuoto', m.mancaNelPasso(m.nuovoStato('figlio'), 6), [])
  ok('LA FAMIGLIA non ha voci nella barra', [m.mancanti(m.nuovoStato('adulto'), 5), m.mancanti(m.nuovoStato('figlio'), 6)], [[], []])
  // FAMIGLIA, PAGAMENTO e INVIO sono un passo solo per tutti: niente pastiglie (sezione 45).
  ok('in famiglia, a LA FAMIGLIA: AGGIUNGI, senza pastiglie', chiama(() => m.famigliaNelPasso({ tipo: 'famiglia', quante: 3 })), { pastiglie: false, aggiungi: true, massimo: false })

  // --- chi si aggiunge ---
  const conFratello = lista(() => m.aggiungiFamiliare([matteo], 'figlio', 0))
  ok('persona 0 bambino: si aggiunge un fratello, lo firma chi compila', [conFratello.length, conFratello[1]?.chi, conFratello[1]?.firmatario], [2, 'figlio', 0])
  const conIo = lista(() => m.aggiungiFamiliare([matteo], 'adulto', 0, true))
  ok('persona 0 bambino: chi compila si aggiunge, un adulto che è l’io', [conIo.length, conIo[1]?.chi, conIo[1]?.io], [2, 'adulto', true])
  ok('un altro adulto non è l’io', lista(() => m.aggiungiFamiliare([matteo], 'adulto', 0))[1]?.io, undefined)
  const dueIo = chiama(() => m.aggiungiFamiliare(conIo, 'adulto', 0, true))
  ok('l’io è uno solo: il secondo si rifiuta, con una frase per chi usa l’app', typeof dueIo === 'string' && dueIo.startsWith('ERRORE: ') && !/undefined|TypeError|is not/.test(dueIo), true)
  const ioDaAdulto = chiama(() => m.aggiungiFamiliare([adulto()], 'adulto', 0, true))
  ok('con un adulto per primo l’io non c’è: si rifiuta', typeof ioDaAdulto === 'string' && ioDaAdulto.startsWith('ERRORE: ') && !/undefined|TypeError|is not/.test(ioDaAdulto), true)
  let sei = conIo
  for (let i = 0; i < 4; i++) sei = lista(() => m.aggiungiFamiliare(sei, 'figlio', 0))
  ok('bambino, io e quattro fratelli: sei', sei.length, 6)
  ok('il settimo no: anche l’io conta', chiama(() => m.aggiungiFamiliare(sei, 'figlio', 0)), 'ERRORE: In un solo modulo ci sono al massimo sei persone.')
  let seiBambini = [matteo]
  for (let i = 0; i < 5; i++) seiBambini = lista(() => m.aggiungiFamiliare(seiBambini, 'figlio', 0))
  ok('sei bambini: l’io non entra più', [seiBambini.length, chiama(() => m.aggiungiFamiliare(seiBambini, 'adulto', 0, true))], [6, 'ERRORE: In un solo modulo ci sono al massimo sei persone.'])
  const conRic = lista(() => m.aggiungiFamiliare(m.conLaRicevuta([matteo], ric, 35000), 'adulto', 0, true))
  ok('aggiungendo l’io la ricevuta resta, col totale di quando si è caricata', [chiama(() => m.ricevutaDelModulo(conRic)) === ric, conRic[0]?.ricevutaPer, conRic[1]?.io], [true, { totale: 35000, persone: 1 }, true])

  // --- cosa l'io prende dal bambino 0, al momento ---
  const doc = F('carta.jpg'), retro = F('retro.jpg')
  const bimbo = figlio({}, { tratti: 7, privacy: true, file: { documento: doc, 'documento-retro': retro } })
  const lei = lista(() => m.conDatiDellaFamiglia([bimbo, io({}, { file: { certificato: F('cert.pdf') } })]))[1]
  const r = lei?.risposte ?? {}
  ok('l’io prende chi è dal bambino 0: nome, cognome, codice e luogo del genitore', [r.nome, r.cognome, r.codiceFiscale, r.natoA], ['Paola', 'Rossi', CF_PAOLA, 'Torino'])
  ok('l’io prende residenza e contatti', [r.indirizzo, r.cap, r.comune, r.email, r.telefono], ['Via Roma 1', '10093', 'Collegno', 'paola@esempio.it', '347 111 2233'])
  ok('l’io riusa la firma, il regolamento e la privacy', [lei?.tratti, r.regolamento, lei?.privacy], [7, true, true])
  ok('l’io riusa la carta, fronte e retro; il certificato resta suo', [lei?.file.documento === doc, lei?.file['documento-retro'] === retro, lei?.file.certificato?.name], [true, true, 'cert.pdf'])
  ok('corso, formula e caselle dell’io sono suoi', [r.corsi, r.formula, lei?.scelte], [['judo-adulti'], 'annuale', { tesseramento: true, foto: true }])
  const corretto = lista(() => m.conDatiDellaFamiglia([{ ...bimbo, tratti: 0, risposte: { ...bimbo.risposte, genitoreNome: 'Paolina' } }, io()]))[1]
  ok('una correzione nel bambino 0 si vede nell’io', [corretto?.risposte.nome, corretto?.tratti], ['Paolina', 0])
  const sara = { ...m.nuovoStato('figlio'), firmatario: 0, risposte: { ...m.nuovoStato('figlio').risposte, nome: 'Sara' } }
  const s2 = lista(() => m.conDatiDellaFamiglia([matteo, sara]))[1]?.risposte ?? {}
  ok('un fratello firmato da chi compila prende il genitore dal bambino 0', [s2.genitoreNome, s2.genitoreCognome, s2.genitoreCodiceFiscale], ['Paola', 'Rossi', CF_PAOLA])

  // --- cosa manca all'io ---
  ok('l’io, il modulo (3): niente firma, regolamento né privacy', nomi(io(), 3), [])
  ok('l’io, il modulo (3): tesseramento e foto, se non li ha scelti', nomi(io({}, { scelte: {} }), 3), ['FOTO', 'TESSERAMENTO'])
  ok('l’io, i documenti (4): la carta non si chiede', nomi(io(), 4), [])
  ok('l’io coi dati del bambino: non gli manca niente', chiama(() => m.quantoManca(m.conDatiDellaFamiglia([figlio(), io()])[1])), 0)
  ok('bambino e io: nessun fermo', chiama(() => m.fermoDellaFamiglia([figlio(), io()])), undefined)
  const fermo = chiama(() => m.fermoDellaFamiglia([m.cambiaScelta(figlio(), 'adulto'), io()]))
  ok('la persona 0 non è più un bambino: l’io si ferma, con una frase che dice cosa fare', typeof fermo === 'string' && !fermo.startsWith('ERRORE') && fermo.length > 20, true)

  // --- AGGIUNGI UN ADULTO: chi ---
  const scelte = (persone) => {
    const x = chiama(() => m.scelteAdulto(persone))
    return Array.isArray(x) ? x.map((c) => [c.io, c.testo]) : x
  }
  ok('persona 0 bambino, senza io: IO, PAOLA o UN ALTRO ADULTO', scelte([figlio()]), [[true, 'IO, PAOLA'], [false, 'UN ALTRO ADULTO']])
  ok('con l’io già dentro: solo UN ALTRO ADULTO', scelte([figlio(), io()]), [[false, 'UN ALTRO ADULTO']])
  ok('persona 0 adulta: solo UN ALTRO ADULTO', scelte([adulto()]), [[false, 'UN ALTRO ADULTO']])

  // --- le due carte ---
  const carte = (persone, o = orari) => {
    const x = chiama(() => m.carteDellaFamiglia(persone, corsi, listino, o, giorno))
    return Array.isArray(x) ? x : [x]
  }
  const forma = (c) => c.map((x) => [x?.chi, x?.titolo, x?.tasto])
  const campo = (c, k) => c.map((x) => x?.[k])
  // Il design scrive l'apostrofo dritto: qui conta il testo.
  const frasi = (c) => c.map((x) => (typeof x?.frase === 'string' ? x.frase.replace(/’/g, "'") : x?.frase))
  const ADULTA = [['figlio', 'UN FIGLIO O UNA FIGLIA', '+ AGGIUNGI UN FIGLIO'], ['adulto', 'UN ALTRO ADULTO', '+ AGGIUNGI UN ADULTO']]
  const BAMBINO = [['figlio', 'UN FRATELLO O UNA SORELLA', '+ AGGIUNGI UN BAMBINO'], ['adulto', 'TU O UN ALTRO ADULTO', '+ AGGIUNGI UN ADULTO']]

  // Luca, Judo adulti lunedì e giovedì alle 18: Judo 3 alla stessa ora.
  const a = carte([luca()])
  ok('persona 0 adulta: le due carte, coi titoli e i tasti del design', forma(a), ADULTA)
  // Le righe: etichetta, corso, l'orario intero e i pezzi in nero (le regole dei gruppi sono in 42, i pezzi in 43).
  const nero = (r) => (Array.isArray(r.pezzi) ? r.pezzi.filter((p) => p.evidenza).map((p) => p.testo) : r.pezzi)
  const righe = (x) => (x?.righe ?? []).map((r) => [r.etichetta, r.corso, r.quando, nero(r)])
  ok('persona 0 adulta: la stessa ora, il corso per bambini e i suoi', a.map(righe), [[['STESSA ORA', 'Judo 3', 'lunedì e giovedì 18.00-19.00', ['lunedì e giovedì 18.00-19.00']]], [['STESSO CORSO', 'Judo adulti', 'lunedì e giovedì 18.00-19.30', ['lunedì e giovedì 18.00-19.30']]]])
  ok('persona 0 adulta: quanto risparmiate, con tutti e due ad annuale', campo(a, 'risparmio'), ['Con Judo 3 annuale risparmiate 60 €', 'Con Judo adulti annuale risparmiate 72 €'])
  ok('persona 0 adulta: le frasi del design', frasi(a), ['Mentre fai Judo adulti, si allena anche lui: ecco i corsi per bambini vicini al tuo orario.', 'Venite insieme: Judo adulti, lo stesso corso, gli stessi giorni.'])
  ok('il risparmio fa i conti con l’annuale anche se Luca paga a trimestre', campo(carte([luca({ formula: 'trimestre' })]), 'risparmio'), ['Con Judo 3 annuale risparmiate 60 €', 'Con Judo adulti annuale risparmiate 72 €'])

  // Luca a Pilates, il martedì alle 20: nessun corso per bambini a quell'ora.
  const p1 = carte([luca({ corsi: ['pilates'] })])
  ok('senza corsi per bambini alla stessa ora: le carte restano', forma(p1), ADULTA)
  ok('…senza righe né il risparmio per il figlio', [campo(p1, 'righe')[0], campo(p1, 'risparmio')[0]], [[], undefined])
  ok('…e la frase non parla di stessa ora', [typeof p1[0]?.frase === 'string' && p1[0].frase.length > 0, /stessa ora/i.test(p1[0]?.frase ?? '')], [true, false])
  ok('…il secondo adulto, a Pilates con lui', [righe(p1[1]), campo(p1, 'risparmio')[1]], [[['STESSO CORSO', 'Pilates', 'martedì 20.00-21.00', ['martedì 20.00-21.00']]], 'Con Pilates annuale risparmiate 60 €'])
  // Yoga non ha prezzo: il risparmio non si sa, e non si scrive.
  ok('un corso senza prezzo: niente risparmio', campo(carte([luca({ corsi: ['yoga'] })]), 'risparmio')[1], undefined)
  ok('un corso senza prezzo: la riga sì', righe(carte([luca({ corsi: ['yoga'] })])[1]), [['STESSO CORSO', 'Yoga', 'venerdì 20.00-21.00', ['venerdì 20.00-21.00']]])
  // Ogni corso una riga, fino a tre; il risparmio è quello del primo.
  const due = carte([luca({ corsi: ['judo-adulti', 'pilates'] })])
  // Lo sconto è quello di contoFamiglia: il 20% dell'annuale più basso, Pilates di Luca (300 €).
  ok('due corsi di Luca: una riga per corso, il risparmio del primo', [righe(due[1]).map((r) => r[1]), due[1]?.risparmio], [['Judo adulti', 'Pilates'], 'Con Judo adulti annuale risparmiate 60 €'])
  const tre = carte([luca({ corsi: ['aikido-adulti'] })])
  ok('tre corsi per bambini alla stessa ora: tre righe, per nome', righe(tre[0]).map((r) => [r[0], r[1]]), [['STESSA ORA', 'Judo piccoli'], ['STESSA ORA', 'Lotta 3'], ['STESSA ORA', 'Psicomotricità']])
  ok('tre corsi: il risparmio del primo', tre[0]?.risparmio, 'Con Judo piccoli annuale risparmiate 50 €')

  // Matteo, Judo 3 lunedì e giovedì alle 18: Judo 2 per un fratello, Judo adulti per te.
  const b = carte([matteo], orariB)
  ok('persona 0 bambino: le due carte, coi titoli e i tasti del design', forma(b), BAMBINO)
  ok('persona 0 bambino: la stessa ora, per un fratello e per un adulto', b.map(righe), [[['STESSA ORA', 'Judo 2', 'lunedì e giovedì 18.00-19.00', ['lunedì e giovedì 18.00-19.00']]], [['STESSA ORA', 'Judo adulti', 'lunedì e giovedì 18.00-19.30', ['lunedì e giovedì 18.00-19.30']]]])
  ok('persona 0 bambino: quanto risparmiate', campo(b, 'risparmio'), ['Con Judo 2 annuale risparmiate 56 €', 'Con Judo adulti annuale risparmiate 60 €'])
  ok('persona 0 bambino: le frasi del design', frasi(b), ["Un solo viaggio in palestra: ecco i corsi vicini all'orario di Matteo.", 'Mentre Matteo fa Judo 3, ti alleni anche tu: ecco i corsi vicini al suo orario.'])
  const b2 = carte([matteo], orariB2)
  ok('due corsi per adulti alla stessa ora di Matteo: due righe, il risparmio del primo', [righe(b2[1]), b2[1]?.risparmio], [[['STESSA ORA', 'Judo adulti', 'lunedì e giovedì 18.00-19.30', ['lunedì e giovedì 18.00-19.30']], ['STESSA ORA', 'Pilates', 'martedì 20.00-21.00 · giovedì 18.00-19.00', ['giovedì 18.00-19.00']]], 'Con Judo adulti annuale risparmiate 60 €'])

  // --- il corso già spuntato quando il familiare arriva al passo del corso ---
  const gia = (persone, i, o = orari) => chiama(() => m.corsiGiaScelti(persone, i, corsi, listino, o))
  const nuovoFiglio = (nome, natoIl, donna = false, corsiDi = []) => figlio({ nome, natoIl, codiceFiscale: cfDi(nome, 'Rossi', natoIl, donna), corsi: corsiDi }, { firmatario: 0 })
  const marta = adulto({ nome: 'Marta', natoIl: '1990-03-03', codiceFiscale: cfDi('Marta', 'Rossi', '1990-03-03', true), corsi: [] })
  ok('un figlio di 11 anni aggiunto da Luca: Judo 3, l’unico alla stessa ora per la sua età', gia([luca(), nuovoFiglio('Marco', '2015-02-02')], 1), ['judo-3'])
  ok('una figlia di 8 anni: Judo 3 non è per lei, niente', gia([luca(), nuovoFiglio('Sara', '2018-05-05', true)], 1), [])
  ok('un adulto aggiunto da Luca: i corsi di Luca', gia([luca(), marta], 1), ['judo-adulti'])
  ok('…tutti, se Luca ne ha due', gia([luca({ corsi: ['judo-adulti', 'pilates'] }), marta], 1), ['judo-adulti', 'pilates'])
  ok('un familiare che ha già un corso: niente da spuntare', gia([luca(), nuovoFiglio('Marco', '2015-02-02', false, ['lotta-3'])], 1), [])
  ok('l’io di Matteo: Judo adulti, l’unico alla stessa ora per lui', gia([matteo, io({ corsi: [] })], 1, orariB), ['judo-adulti'])
  ok('l’io di Matteo con due corsi alla stessa ora: non si sceglie per lui', gia([matteo, io({ corsi: [] })], 1, orariB2), [])
  ok('un fratello di Matteo, di 8 anni: Judo 2', gia([matteo, nuovoFiglio('Sara', '2018-05-05', true)], 1, orariB), ['judo-2'])

  // --- l'invio, il conto, la causale: le stesse di «Anche tu» ---
  const bimboRic = figlio({}, { file: { documento: doc, 'documento-retro': retro, ricevuta: ric } })
  const persone = lista(() => m.conDatiDellaFamiglia([bimboRic, io()]))
  const daMandare = lista(() => m.richiesteDelModulo(persone, (p) => m.richiesteDaMandare(p, 'TO', async () => F('modulo.pdf'))))
  const ordinato = (o) => o && Object.fromEntries(Object.entries(o).sort(([x], [y]) => x.localeCompare(y)))
  ok('bambino e io: due richieste', daMandare.length, 2)
  ok('la richiesta del bambino è quella delle sue risposte', daMandare[0]?.dati, m.risposteDaiPassi(bimboRic))
  ok('la richiesta dell’io è quella di oggi del genitore, campo per campo', ordinato(daMandare[1]?.dati), ordinato(richiestaDiPaola({ natoA: 'Torino (TO)' })))
  ok('la ricevuta in tutte e due', daMandare.map((x) => x.file.ricevuta === ric), [true, true])
  ok('l’io porta la carta del bambino, fronte e retro', [daMandare[1]?.file.documento === doc, daMandare[1]?.file['documento-retro'] === retro], [true, true])
  const inviati = []
  const e = await m.mandaRichieste({ modo: 'prova', async invia(x) { inviati.push(x); return `r${inviati.length}` }, async caricaFile() {} }, daMandare)
  ok('arrivano tutte e due, ognuna legata all’altra', [e.esito, inviati.map((x) => x.note)], ['fatto', ['mandata insieme alla richiesta di Paola Rossi, sconto famiglia da applicare', 'mandata insieme alla richiesta di Matteo Rossi, sconto famiglia da applicare']])
  const modulo = chiama(() => m.contoDelModulo(persone, corsi, listino, giorno))
  const fam = chiama(() => m.contoDellaFamiglia(persone, corsi, listino, giorno))
  ok('il conto di Matteo (Judo 3) e Paola (Judo adulti), annuali: 700 €, sconto 60 €', [modulo?.totale, modulo?.conSconto, fam?.totale, fam?.sconto], [70000, true, 70000, 6000])
  ok('ognuno la sua cifra, coi nomi', fam?.persone, [{ chi: 'Matteo', importo: 35000 }, { chi: 'Paola', importo: 41000 }])
  ok('la causale: i due nomi, il cognome una volta', chiama(() => m.causaleDelModulo(persone, corsi)), 'Iscrizione Matteo e Paola Rossi')
}

// ---------------------------------------------------------------------------
console.log('\n41. LA FAMIGLIA: le regole scoperte nelle revisioni')
{
  const voce = (corso, corsoId, natiDal, natiAl, annuale, trimestre) => ({ corso, corsoId, eta: '', orari: [], natiDal, natiAl, prezzi: [{ saldo: annuale, annuale, trimestre }] })
  const listino = {
    quota: 50, saldoEntro: '2026-08-31', offerte: [],
    corsi: [voce('Judo 3', 'judo-3', 2013, 2016, 300, 120), voce('Judo 2', 'judo-2', 2017, 2019, 280, 110), voce('Judo adulti', 'judo-adulti', undefined, 2008, 360, 140), voce('Pilates', 'pilates', undefined, 2008, 300, 120)],
  }
  const corsi = listino.corsi.map((v) => ({ id: v.corsoId, nome: v.corso }))
  const ora = (corsoId, g, o, durata = 60) => ({ corsoId, giorno: g, ora: o, durata })
  const orari = [ora('judo-3', 1, '18:00'), ora('judo-3', 4, '18:00'), ora('judo-2', 1, '18:00'), ora('judo-2', 4, '18:00'), ora('judo-adulti', 1, '18:00', 90), ora('judo-adulti', 4, '18:00', 90), ora('pilates', 2, '20:00')]
  const pdf = async () => F('modulo.pdf')
  const matteo = figlio()
  const conCf = (nome, natoIl, donna = false, cambi = {}, sul = {}) => figlio({ nome, natoIl, codiceFiscale: cfDi(nome, 'Rossi', natoIl, donna), genitoreNome: '', genitoreCognome: '', genitoreCodiceFiscale: '', ...cambi }, { firmatario: 0, ...sul })

  // 1. La provincia si aggiunge solo al luogo dell'io, e mai due volte.
  const natoA = (persone, i) => chiama(() => m.richiesteDaMandare(m.conDatiDellaFamiglia(persone)[i], 'TO', pdf)[0].dati.natoA)
  ok('l’io col luogo che ha già la provincia: resta «Torino (TO)»', natoA([figlio({}, { natoAGenitore: 'Torino (TO)' }), io()], 1), 'Torino (TO)')
  ok('l’io col luogo senza provincia: «Torino (TO)»', natoA([figlio(), io()], 1), 'Torino (TO)')
  ok('un adulto che non è l’io: il suo luogo com’è', chiama(() => m.richiesteDaMandare(adulto({ natoA: 'Collegno' }), 'TO', pdf)[0].dati.natoA), 'Collegno')
  ok('un bambino: il suo luogo com’è', chiama(() => m.richiesteDaMandare(figlio({ natoA: 'Collegno' }), 'TO', pdf)[0].dati.natoA), 'Collegno')

  // 2. Chi può firmare per un bambino che si aggiunge.
  ok('persona 0 bambino: firma chi compila, col nome del genitore', chiama(() => m.firmatariPossibili([figlio()])), [{ indice: 0, nome: 'Paola' }])
  ok('con l’io: non c’è due volte, è già chi compila', chiama(() => m.firmatariPossibili(m.conDatiDellaFamiglia([figlio(), io()]))), [{ indice: 0, nome: 'Paola' }])
  const luca = adulto(), paola = adulto({ nome: 'Paola', codiceFiscale: CF_PAOLA })
  ok('persona 0 adulta: come chiPuoFirmare', chiama(() => m.firmatariPossibili([luca, figlio(), paola])), m.chiPuoFirmare([luca, figlio(), paola]))

  // 3. Un bambino firmato dall'io prende il genitore dal bambino 0.
  const sara = { ...m.nuovoStato('figlio'), firmatario: 1, risposte: { ...m.nuovoStato('figlio').risposte, nome: 'Sara' } }
  const g = lista(() => m.conDatiDellaFamiglia([matteo, io(), sara]))[2]?.risposte ?? {}
  ok('firmato dall’io: il genitore è Paola Rossi, col suo codice', [g.genitoreNome, g.genitoreCognome, g.genitoreCodiceFiscale], ['Paola', 'Rossi', CF_PAOLA])

  // 4. L'io è un adulto: chiederlo come bambino si rifiuta, dicendo cosa fare.
  ok('l’io come bambino: si rifiuta, e dice come aggiungere un bambino', chiama(() => m.aggiungiFamiliare([matteo], 'figlio', 0, true)), 'ERRORE: Ti aggiungi come adulto: un bambino si aggiunge con + AGGIUNGI UN BAMBINO.')

  // 5. I corsi di chi si aggiunge: quelli alla stessa ora in cima, e i corsi della persona 0 restano da scegliere.
  const del = (persone, i) => chiama(() => m.corsiDelFamiliare(persone, i, corsi, listino, orari)) ?? {}
  const ids = (x) => (x ?? []).map((c) => c.id)
  const marta = adulto({ nome: 'Marta', natoIl: '1990-03-03', codiceFiscale: cfDi('Marta', 'Rossi', '1990-03-03', true), corsi: [] })
  const aa = del([adulto({ corsi: ['judo-adulti'] }), marta], 1)
  ok('adulto con persona 0 adulta: in cima i suoi corsi, e non anche sotto', [ids(aa.stessaOra), ids(aa.adatti).includes('judo-adulti')], [['judo-adulti'], false])
  const fr = del([matteo, conCf('Sara', '2018-05-05', true)], 1)
  ok('un fratello di 8 anni: Judo 2 alla stessa ora di Matteo', ids(fr.stessaOra), ['judo-2'])
  const fr2 = del([matteo, conCf('Marco', '2015-02-02')], 1)
  ok('un fratello di 11 anni: il corso di Matteo (Judo 3) resta da scegliere', ids(fr2.adatti).includes('judo-3'), true)
  ok('l’io: Judo adulti alla stessa ora di Matteo', ids(del([matteo, io({ corsi: [] })], 1).stessaOra), ['judo-adulti'])
  ok('la persona 0: niente stessa ora', ids(del([matteo], 0).stessaOra), [])

  // 6. Il corso alla stessa ora si spunta una volta sola: se lo togli, resta tolto.
  const al = (persone, i, passo) => lista(() => m.alPassoDelCorso(persone, i, passo, corsi, listino, orari))
  const marco = conCf('Marco', '2015-02-02', false, { corsi: [] })
  const prima = al([adulto({ corsi: ['judo-adulti'] }), marco], 1, 3)
  ok('la prima volta al passo del corso: Judo 3 spuntato, e segnato', [prima[1]?.risposte.corsi, prima[1]?.corsoProposto], [['judo-3'], true])
  const tolto = prima.length ? [prima[0], { ...prima[1], risposte: { ...prima[1].risposte, corsi: [] } }] : []
  ok('tolto e tornato al passo del corso: resta tolto', al(tolto, 1, 3)[1]?.risposte.corsi, [])
  ok('un altro passo: niente cambia', al([adulto({ corsi: ['judo-adulti'] }), marco], 1, 2)[1]?.corsoProposto, undefined)
  ok('la persona 0: niente cambia', al([adulto({ corsi: [] })], 0, 2)[0]?.corsoProposto, undefined)
  ok('niente da spuntare: segnato lo stesso, così non si riprova', al([adulto({ corsi: ['pilates'] }), marco], 1, 3)[1]?.corsoProposto, true)

  // 7. AVANTI a LA FAMIGLIA: da soli, chi si iscrive da adulto dice «solo io».
  const av = (persone) => chiama(() => m.avantiDellaFamiglia(persone))
  ok('adulto da solo: AVANTI, SOLO IO', av([adulto()]), 'AVANTI, SOLO IO')
  ok('bambino da solo: AVANTI', av([figlio()]), 'AVANTI')
  ok('in famiglia: AVANTI', av([adulto(), figlio()]), 'AVANTI')

  // 8. Un fratello firmato da chi compila prende dal bambino 0 quello che è del genitore: carta, ok e luogo di nascita.
  const doc = F('carta.jpg'), retro = F('retro.jpg')
  const zero = figlio({}, { file: { documento: doc, 'documento-retro': retro } })
  const lei = conCf('Lucia', '2017-06-06', true, { corsi: ['judo-2'], regolamento: false }, { privacy: false, natoAGenitore: '', file: {} })
  const l = lista(() => m.conDatiDellaFamiglia([zero, lei]))[1]
  ok('il fratello: la carta del genitore, fronte e retro', [l?.file.documento === doc, l?.file['documento-retro'] === retro], [true, true])
  ok('il fratello: regolamento, privacy e dove è nato il genitore', [l?.risposte.regolamento, l?.privacy, l?.natoAGenitore], [true, true, 'Torino'])
  ok('il fratello: la firma resta sua', l?.tratti, 5)
  ok('il fratello: a CONTROLLA E INVIA non gli si chiedono di nuovo', chiama(() => m.mancantiFamiglia(m.conDatiDellaFamiglia([zero, lei])).filter((x) => x.chiave.startsWith('1:')).map((x) => x.chiave)), [])

  // 9. La persona 0 passa da adulto a bambino: chi firma il fratello è ora chi compila, che scrive il genitore.
  const luca2 = adulto({ nome: 'Luca' })
  const lucia = { ...m.nuovoStato('figlio'), firmatario: 0, risposte: { ...m.nuovoStato('figlio').risposte, nome: 'Lucia' } }
  ok('la frase dice di scrivere il genitore nel passo CHI FIRMA di Luca', chiama(() => m.fermoDellaFamiglia([m.cambiaScelta(luca2, 'figlio'), lucia])), 'Per Lucia firma chi compila: scrivi i tuoi dati nel passo CHI FIRMA di Luca, oppure chiama la segreteria.')
}

// ---------------------------------------------------------------------------
// CORSI VICINI: per chi si aggiunge, oltre ai corsi alla stessa ora, quelli che
// finiscono o cominciano entro mezz'ora dalla persona 0 lo stesso giorno, e
// quelli negli stessi giorni a un'altra ora. Il design è in
// docs/design-canvas/corsi-vicini/. La distanza è il tempo fra la fine di una
// lezione e l'inizio dell'altra: «un’ora prima di te» è un’ora di attesa.
// ---------------------------------------------------------------------------
console.log('\n42. CORSI VICINI')
{
  const ora = (corsoId, g, o, durata = 60) => ({ corsoId, giorno: g, ora: o, durata })
  // Nicola: Judo adulti lunedì, mercoledì e venerdì 19.00-20.30.
  const NICOLA = ['judo-adulti']
  const orari = [
    ora('judo-adulti', 1, '19:00', 90), ora('judo-adulti', 3, '19:00', 90), ora('judo-adulti', 5, '19:00', 90),
    // si sovrappone tutti i giorni, suoi e di Nicola
    ora('lotta-3', 1, '19:00'), ora('lotta-3', 3, '19:00'), ora('lotta-3', 5, '19:00'),
    // si sovrappone il lunedì; il giovedì Nicola non c'è
    ora('karate-3', 1, '19:30'), ora('karate-3', 4, '19:30'),
    // a filo prima il lunedì (il giovedì Nicola non c'è)
    ora('judo-3', 1, '18:00'), ora('judo-3', 4, '18:00'),
    // a filo dopo il mercoledì
    ora('aikido-3', 3, '20:30'),
    // finisce 15 minuti prima, il venerdì
    ora('ginnastica-3', 5, '17:45'),
    // comincia 30 minuti dopo, il lunedì: ancora vicino
    ora('pesi-3', 1, '21:00'),
    // finisce 31 minuti prima, il mercoledì: non più vicino, gli stessi giorni
    ora('boxe-3', 3, '17:29'),
    // un'ora prima, mercoledì e venerdì: gli stessi giorni, un'ora tonda
    ora('judo-kids', 3, '17:00'), ora('judo-kids', 5, '17:00'),
    // un'ora e un quarto prima il lunedì, e il sabato, quando Nicola non c'è
    ora('scherma-3', 1, '16:45'), ora('scherma-3', 6, '10:00'),
    // un'ora prima il lunedì, due ore prima il mercoledì: un'altra ora, non la stessa
    ora('danza-3', 1, '17:00'), ora('danza-3', 3, '16:00'),
    // due ore e mezza dopo il venerdì
    ora('nuoto-3', 5, '23:00'),
    // giorni diversi
    ora('calcio-3', 2, '19:00'), ora('calcio-3', 4, '19:00'),
  ]
  const nomi = { 'lotta-3': 'Lotta 3', 'karate-3': 'Karate 3', 'judo-3': 'Judo 3', 'aikido-3': 'Aikido 3', 'ginnastica-3': 'Ginnastica 3', 'pesi-3': 'Pesi 3', 'boxe-3': 'Boxe 3', 'judo-kids': 'Judo kids', 'scherma-3': 'Scherma 3', 'danza-3': 'Danza 3', 'nuoto-3': 'Nuoto 3', 'calcio-3': 'Calcio 3', 'judo-adulti': 'Judo adulti' }
  const corsi = Object.entries(nomi).map(([id, nome]) => ({ id, nome }))
  const vic = (id, suoi = NICOLA, o = orari) => chiama(() => m.vicinanza(id, suoi, o))

  ok('la mezz’ora è una costante', m.MINUTI_VICINI, 30)

  // --- i gruppi ---
  ok('sovrapposto tutti i giorni: stessa ora, tutti', vic('lotta-3'), { gruppo: 'stessaOra', giorni: [1, 3, 5] })
  ok('sovrapposto un giorno solo: stessa ora, il lunedì', vic('karate-3'), { gruppo: 'stessaOra', giorni: [1] })
  ok('a filo prima: vicino, prima, 0 minuti, il lunedì', vic('judo-3'), { gruppo: 'vicino', verso: 'prima', giorni: [1] })
  ok('a filo dopo: vicino, dopo, 0 minuti, il mercoledì', vic('aikido-3'), { gruppo: 'vicino', verso: 'dopo', giorni: [3] })
  ok('15 minuti prima: vicino', vic('ginnastica-3'), { gruppo: 'vicino', verso: 'prima', giorni: [5] })
  ok('30 minuti dopo: ancora vicino', vic('pesi-3'), { gruppo: 'vicino', verso: 'dopo', giorni: [1] })
  ok('31 minuti prima: non vicino, gli stessi giorni', vic('boxe-3'), { gruppo: 'stessiGiorni', giorni: [3] })
  ok('un’ora prima, mercoledì e venerdì: gli stessi giorni', vic('judo-kids'), { gruppo: 'stessiGiorni', giorni: [3, 5] })
  ok('il sabato Nicola non c’è: gli stessi giorni solo il lunedì', vic('scherma-3'), { gruppo: 'stessiGiorni', giorni: [1] })
  ok('un’ora il lunedì, due il mercoledì: gli stessi giorni, senza distanza', vic('danza-3'), { gruppo: 'stessiGiorni', giorni: [1, 3] })
  ok('giorni diversi: nessun gruppo', vic('calcio-3'), undefined)
  ok('il corso di Nicola non è vicino a sé stesso', vic('judo-adulti'), undefined)
  ok('senza corsi della persona 0: niente', vic('lotta-3', []), undefined)
  ok('senza orari: niente', vic('lotta-3', NICOLA, []), undefined)
  // Un corso che è sia a filo sia sovrapposto sta nel primo gruppo: la stessa ora.
  const misto = [...orari, ora('judo-3', 3, '19:00')]
  ok('un giorno sovrapposto e uno a filo: stessa ora', vic('judo-3', NICOLA, misto), { gruppo: 'stessaOra', giorni: [3] })
  // A filo il lunedì e 20 minuti prima il venerdì: vicino tutti e due i giorni; verso e minuti sono del più vicino, per l'etichetta.
  const due = [...orari, ora('judo-3', 5, '17:40')]
  ok('vicino due giorni a distanze diverse: tutti e due, il verso del più vicino', vic('judo-3', NICOLA, due), { gruppo: 'vicino', verso: 'prima', giorni: [1, 5] })
  // A filo il lunedì, 45 minuti prima il venerdì: il venerdì non è vicino, e non va coi giorni.
  const unoSolo = [...orari, ora('judo-3', 5, '17:15')]
  ok('vicino un giorno, l’altro oltre la mezz’ora: solo il giorno vicino', vic('judo-3', NICOLA, unoSolo), { gruppo: 'vicino', verso: 'prima', giorni: [1] })
  const dueUguali = [...orari, ora('judo-3', 5, '18:00')]
  ok('a filo due giorni: tutti e due', vic('judo-3', NICOLA, dueUguali), { gruppo: 'vicino', verso: 'prima', giorni: [1, 5] })

  // --- l'ordine: per gruppo, poi più giorni, poi il nome ---
  const elenco = chiama(() => m.corsiVicini(corsi, NICOLA, orari))
  ok('l’ordine: stessa ora, vicini, stessi giorni; dentro, più giorni e poi il nome', Array.isArray(elenco) ? elenco.map((c) => c.id) : elenco, [
    'lotta-3', 'karate-3',
    'aikido-3', 'ginnastica-3', 'judo-3', 'pesi-3',
    'danza-3', 'judo-kids', 'boxe-3', 'nuoto-3', 'scherma-3',
  ])
  ok('ogni corso tiene i suoi campi e la sua vicinanza', Array.isArray(elenco) ? [elenco[0].nome, elenco[0].vicinanza.gruppo] : elenco, ['Lotta 3', 'stessaOra'])

  // --- le etichette della carta ---
  const tutti = (f) => Object.fromEntries(['lotta-3', 'karate-3', 'judo-3', 'aikido-3', 'ginnastica-3', 'pesi-3', 'boxe-3', 'judo-kids', 'scherma-3', 'danza-3', 'nuoto-3'].map((id) => [id, chiama(() => f(m.vicinanza(id, NICOLA, orari)))]))
  ok('le etichette', tutti((v) => m.etichettaVicino(v)), {
    'lotta-3': 'STESSA ORA', 'karate-3': 'STESSA ORA', 'judo-3': 'SUBITO PRIMA', 'aikido-3': 'SUBITO DOPO', 'ginnastica-3': 'SUBITO PRIMA', 'pesi-3': 'SUBITO DOPO',
    'boxe-3': 'STESSI GIORNI', 'judo-kids': 'STESSI GIORNI', 'scherma-3': 'STESSI GIORNI', 'danza-3': 'STESSI GIORNI', 'nuoto-3': 'STESSI GIORNI',
  })
  ok('la nota nella carta e il perché al corso non ci sono più: li dice l’orario a pezzi (43)', [typeof m.notaNellaCarta, typeof m.percheNelCorso], ['undefined', 'undefined'])
  ok('i giorni che vanno con Nicola, corso per corso', tutti((v) => v.giorni), {
    'lotta-3': [1, 3, 5], 'karate-3': [1], 'judo-3': [1], 'aikido-3': [3], 'ginnastica-3': [5], 'pesi-3': [1],
    'boxe-3': [3], 'judo-kids': [3, 5], 'scherma-3': [1], 'danza-3': [1, 3], 'nuoto-3': [5],
  })
  // Tutti i giorni della persona 0: tutti e tre, prima o dopo che sia.
  const ogni = [...orari, ora('judo-3', 3, '18:00'), ora('judo-3', 5, '18:00'), ora('ginnastica-3', 1, '17:45'), ora('ginnastica-3', 3, '17:45'), ora('pesi-3', 3, '21:00'), ora('pesi-3', 5, '21:00'), ora('boxe-3', 1, '17:29'), ora('boxe-3', 5, '17:29'), ora('karate-3', 3, '19:30'), ora('karate-3', 5, '19:30')]
  const ogniVolta = (id) => chiama(() => { const v = m.vicinanza(id, NICOLA, ogni); return [v.gruppo, v.giorni] })
  ok('a filo prima ogni volta', ogniVolta('judo-3'), ['vicino', [1, 3, 5]])
  ok('15 minuti prima ogni volta', ogniVolta('ginnastica-3'), ['vicino', [1, 3, 5]])
  ok('30 minuti dopo ogni volta', ogniVolta('pesi-3'), ['vicino', [1, 3, 5]])
  ok('stessi giorni ogni volta', ogniVolta('boxe-3'), ['stessiGiorni', [1, 3, 5]])
  ok('stessa ora ogni volta, il giovedì in più non conta', ogniVolta('karate-3'), ['stessaOra', [1, 3, 5]])
  // Due lezioni della persona 0 lo stesso giorno: conta la più vicina, non la prima che si trova.
  const dueLezioni = [ora('zero', 1, '17:00', 15), ora('zero', 1, '19:30'), ora('x', 1, '18:00')]
  ok('due lezioni lo stesso giorno: l’attesa più corta, 30 minuti prima', chiama(() => m.vicinanza('x', ['zero'], dueLezioni)), { gruppo: 'vicino', verso: 'prima', giorni: [1] })
  // A filo prima il lunedì e a filo dopo il mercoledì: a pari minuti vince «prima»; vanno tutti e due i giorni.
  const pari = [...orari, ora('pari', 1, '18:00'), ora('pari', 3, '20:30')]
  const vp = chiama(() => m.vicinanza('pari', NICOLA, pari))
  ok('a pari minuti: prima; i giorni sono il lunedì e il mercoledì', vp, { gruppo: 'vicino', verso: 'prima', giorni: [1, 3] })
  ok('a pari minuti: SUBITO PRIMA', chiama(() => m.etichettaVicino(vp)), 'SUBITO PRIMA')

  // --- le carte di LA FAMIGLIA: il canvas Carta ---
  const voce = (corso, corsoId, natiDal, natiAl, annuale) => ({ corso, corsoId, eta: '', orari: [], natiDal, natiAl, prezzi: [{ saldo: annuale, annuale, trimestre: 100 }] })
  const listino = {
    quota: 50, saldoEntro: '2026-08-31', offerte: [],
    corsi: [
      voce('Judo adulti', 'judo-adulti', undefined, 2008, 360),
      voce('Pilates', 'pilates', undefined, 2008, 300),
      voce('Lotta 3', 'lotta-3', 2013, 2016, 280),
      voce('Judo 3', 'judo-3', 2013, 2016, 300),
      voce('Judo kids', 'judo-kids', 2013, 2016, 260),
      voce('Aikido 3', 'aikido-3', 2013, 2016, 300),
      voce('Psicomotricità', 'psico', 2020, 2022, 200),
    ],
  }
  const corsiC = listino.corsi.map((v) => ({ id: v.corsoId, nome: v.corso }))
  const orariC = [
    ora('judo-adulti', 1, '19:00', 90), ora('judo-adulti', 3, '19:00', 90), ora('judo-adulti', 5, '19:00', 90),
    ora('pilates', 2, '19:00'), ora('pilates', 5, '19:00'),
    ora('lotta-3', 1, '18:00', 90), ora('lotta-3', 3, '18:00', 90),
    ora('judo-3', 1, '18:00'), ora('judo-3', 4, '18:00'),
    ora('judo-kids', 3, '17:00'), ora('judo-kids', 5, '17:00'),
    ora('aikido-3', 2, '17:00'), ora('aikido-3', 4, '17:00'),
    ora('psico', 6, '10:00'),
  ]
  const nicola = adulto({ nome: 'Nicola', corsi: ['judo-adulti'] })
  const carte = (persone, o = orariC) => lista(() => m.carteDellaFamiglia(persone, corsiC, listino, o, '2026-10-06'))
  const c = carte([nicola])
  ok('UN FIGLIO: la frase del canvas', c[0]?.frase, 'Mentre fai Judo adulti, si allena anche lui: ecco i corsi per bambini vicini al tuo orario.')
  // Niente nota: i giorni che vanno con Nicola sono in nero nell'orario (43).
  const T = (testo) => ({ testo, evidenza: true }), S = (testo) => ({ testo, evidenza: false })
  ok('UN FIGLIO: tre righe, una per gruppo, con l’orario intero e a pezzi, senza nota', c[0]?.righe, [
    { etichetta: 'STESSA ORA', corso: 'Lotta 3', quando: 'lunedì e mercoledì 18.00-19.30', pezzi: [T('lunedì e mercoledì 18.00-19.30')] },
    { etichetta: 'SUBITO PRIMA', corso: 'Judo 3', quando: 'lunedì e giovedì 18.00-19.00', pezzi: [T('lunedì'), S(' e giovedì '), T('18.00-19.00')] },
    { etichetta: 'STESSI GIORNI', corso: 'Judo kids', quando: 'mercoledì e venerdì 17.00-18.00', pezzi: [T('mercoledì e venerdì 17.00-18.00')] },
  ])
  ok('UN FIGLIO: il risparmio del primo corso', c[0]?.risparmio, 'Con Lotta 3 annuale risparmiate 56 €')
  ok('UN ALTRO ADULTO: la frase del canvas', c[1]?.frase, 'Venite insieme: lo stesso corso, o uno alla stessa ora.')
  ok('UN ALTRO ADULTO: prima lo stesso corso, tutto in nero, poi gli altri per adulti alla stessa ora', c[1]?.righe, [
    { etichetta: 'STESSO CORSO', corso: 'Judo adulti', quando: 'lunedì, mercoledì e venerdì 19.00-20.30', pezzi: [T('lunedì, mercoledì e venerdì 19.00-20.30')] },
    { etichetta: 'STESSA ORA', corso: 'Pilates', quando: 'martedì e venerdì 19.00-20.00', pezzi: [S('martedì e '), T('venerdì 19.00-20.00')] },
  ])
  ok('UN ALTRO ADULTO: il risparmio dello stesso corso', c[1]?.risparmio, 'Con Judo adulti annuale risparmiate 72 €')
  // Per l'adulto solo la stessa ora: un adulto che viene con te non aspetta un'ora.
  const conVicinoAdulto = [...orariC, ora('aikido-adulti', 1, '20:30')]
  const listinoAA = { ...listino, corsi: [...listino.corsi, voce('Aikido adulti', 'aikido-adulti', undefined, 2008, 300)] }
  const aa = lista(() => m.carteDellaFamiglia([nicola], [...corsiC, { id: 'aikido-adulti', nome: 'Aikido adulti' }], listinoAA, conVicinoAdulto, '2026-10-06'))
  ok('UN ALTRO ADULTO: un corso per adulti subito dopo non c’è', (aa[1]?.righe ?? []).map((r) => r.corso), ['Judo adulti', 'Pilates'])
  // Più di tre corsi: le prime tre righe.
  const quattro = [...orariC, ora('psico', 1, '19:00')]
  const listinoQ = { ...listino, corsi: listino.corsi.map((v) => (v.corsoId === 'psico' ? { ...v, natiDal: 2013, natiAl: 2016 } : v)) }
  const q = lista(() => m.carteDellaFamiglia([nicola], corsiC, listinoQ, quattro, '2026-10-06'))
  ok('più di tre corsi: tre righe, le prime', (q[0]?.righe ?? []).map((r) => [r.etichetta, r.corso]), [['STESSA ORA', 'Lotta 3'], ['STESSA ORA', 'Psicomotricità'], ['SUBITO PRIMA', 'Judo 3']])
  // Un corso per bambini senza saperne l'età resta fuori: Calcio 3 non ha anni nel listino.
  const conCalcio = lista(() => m.carteDellaFamiglia([nicola], [...corsiC, { id: 'calcio-3', nome: 'Calcio 3' }], listino, [...orariC, ora('calcio-3', 1, '19:00')], '2026-10-06'))
  ok('un corso senza anni nel listino non va nella carta UN FIGLIO', (conCalcio[0]?.righe ?? []).some((r) => r.corso === 'Calcio 3'), false)
  // Senza nessun corso vicino: niente righe, la frase di prima.
  const solo = carte([adulto({ nome: 'Nicola', corsi: ['pilates'] })], [ora('pilates', 0, '09:00'), ora('lotta-3', 6, '10:00')])
  ok('niente vicino: nessuna riga, la frase di sempre', [solo[0]?.righe, solo[0]?.frase, solo[0]?.risparmio], [[], 'Un figlio o una figlia nello stesso modulo: scegli il suo corso, per la sua età.', undefined])

  // Senza listino non si sa per che età sono i corsi: niente righe per il figlio.
  const senzaListino = lista(() => m.carteDellaFamiglia([nicola], corsiC, undefined, orariC, '2026-10-06'))
  ok('senza listino: la carta del figlio senza righe', [senzaListino[0]?.chi, senzaListino[0]?.righe], ['figlio', []])

  // --- il passo del corso del figlio aggiunto: il canvas Corso ---
  const marco = figlio({ nome: 'Marco', natoIl: '2015-02-02', codiceFiscale: cfDi('Marco', 'Rossi', '2015-02-02'), corsi: [] }, { firmatario: 0 })
  const ep = chiama(() => m.corsiDelFamiliare([nicola, marco], 1, corsiC, listino, orariC)) ?? {}
  // Niente perché: l'orario a pezzi, coi giorni che vanno con Nicola in nero.
  const voci = (x) => (Array.isArray(x) ? x.map((c) => [c.nome, c.perche, c.orario]) : x)
  ok('ALLA STESSA ORA DI NICOLA: Lotta 3, l’orario a pezzi', voci(ep.stessaOra), [['Lotta 3', undefined, [T('lunedì e mercoledì 18.00-19.30')]]])
  ok('SUBITO PRIMA O DOPO: Judo 3, il lunedì in nero', voci(ep.vicini), [['Judo 3', undefined, [T('lunedì'), S(' e giovedì '), T('18.00-19.00')]]])
  ok('NEGLI STESSI GIORNI: Judo kids, l’orario a pezzi', voci(ep.stessiGiorni), [['Judo kids', undefined, [T('mercoledì e venerdì 17.00-18.00')]]])
  ok('GLI ALTRI CORSI PER LA SUA ETÀ: gli altri, senza orario a pezzi', voci(ep.adatti), [['Aikido 3', undefined, undefined]])
  ok('senza età nel listino, sotto il nome solo l’orario a pezzi: la riga non lo ripete', (ep.vicini ?? [])[0]?.riga, undefined)
  ok('fuori età resta negli altri', (ep.altri ?? []).some((c) => c.id === 'psico'), true)
  ok('si spunta solo il corso alla stessa ora, se è uno', chiama(() => m.corsiGiaScelti([nicola, marco], 1, corsiC, listino, orariC)), ['lotta-3'])
  // Un altro adulto: in cima lo stesso corso, col suo perché, poi la stessa ora.
  const marta = adulto({ nome: 'Marta', natoIl: '1990-03-03', codiceFiscale: cfDi('Marta', 'Rossi', '1990-03-03', true), corsi: [] })
  const am = chiama(() => m.corsiDelFamiliare([nicola, marta], 1, corsiC, listino, orariC)) ?? {}
  ok('un altro adulto: lo stesso corso, tutto in nero, poi Pilates alla stessa ora', voci(am.stessaOra), [['Judo adulti', undefined, [T('lunedì, mercoledì e venerdì 19.00-20.30')]], ['Pilates', undefined, [S('martedì e '), T('venerdì 19.00-20.00')]]])
  ok('la persona 0: nessun gruppo', ['stessaOra', 'vicini', 'stessiGiorni'].map((k) => (chiama(() => m.corsiDelFamiliare([nicola], 0, corsiC, listino, orariC)) ?? {})[k]), [[], [], []])
}

// ---------------------------------------------------------------------------
// ORARI EVIDENZIATI: dove si propongono corsi per un familiare (le carte di LA
// FAMIGLIA e i gruppi del suo passo del corso) niente nota né perché: l'orario
// del corso a pezzi, coi giorni che vanno con la persona 0 in nero, e l'ora
// della fascia in nero se almeno un suo giorno ci va. Il design è in
// docs/design-canvas/orari-evidenziati/.
// ---------------------------------------------------------------------------
console.log('\n43. ORARI EVIDENZIATI')
{
  const ora = (corsoId, g, o, durata = 60) => ({ corsoId, giorno: g, ora: o, durata })
  const T = (testo) => ({ testo, evidenza: true }), S = (testo) => ({ testo, evidenza: false })
  const orari = [
    ora('a', 1, '18:00'), ora('a', 3, '18:00'), ora('a', 5, '18:00'),
    ora('b', 1, '18:00'), ora('b', 4, '18:00'),
    ora('c', 2, '20:00'), ora('c', 4, '18:00'),
    ora('d', 1, '18:00'), ora('d', 4, '18:00'), ora('d', 3, '17:00', 90), ora('d', 6, '10:00'),
    ora('e', 0, '10:00'), ora('e', 6, '10:00'),
  ]
  const pezzi = (id, giorni, o = orari) => chiama(() => m.orarioAPezzi(o, id, giorni))
  const unito = (p) => (Array.isArray(p) ? p.map((x) => x.testo).join('') : p)

  // --- lo stesso testo di orarioDetto ---
  const casi = [['a', []], ['a', [3]], ['b', [1]], ['b', [1, 4]], ['c', [4]], ['d', [4]], ['d', [1, 3, 6]], ['e', [0]], ['e', [6]]]
  ok('i pezzi uniti danno esattamente orarioDetto, coi giorni evidenziati o no', Object.fromEntries(casi.map(([id, g]) => [`${id}:${g}`, unito(pezzi(id, g))])), Object.fromEntries(casi.map(([id, g]) => [`${id}:${g}`, m.orarioDetto(orari, id)])))
  ok('un corso senza orari: nessun pezzo', pezzi('x', [1]), [])

  // --- quali pezzi sono in nero ---
  ok('tutti i giorni: un pezzo solo, in nero', pezzi('a', [1, 3, 5]), [T('lunedì, mercoledì e venerdì 18.00-19.00')])
  ok('nessun giorno: un pezzo solo, spento', pezzi('a', []), [S('lunedì, mercoledì e venerdì 18.00-19.00')])
  ok('un giorno che il corso non ha non conta', pezzi('a', [2]), [S('lunedì, mercoledì e venerdì 18.00-19.00')])
  ok('il primo giorno su due: il lunedì e l’ora in nero, il giovedì spento', pezzi('b', [1]), [T('lunedì'), S(' e giovedì '), T('18.00-19.00')])
  ok('il secondo giorno su due: la congiunzione resta spenta', pezzi('b', [4]), [S('lunedì e '), T('giovedì 18.00-19.00')])
  ok('il giorno in mezzo: le virgole spente', pezzi('a', [3]), [S('lunedì, '), T('mercoledì'), S(' e venerdì '), T('18.00-19.00')])
  ok('due fasce, il giorno buono in una sola: l’altra fascia tutta spenta, ora compresa', pezzi('c', [4]), [S('martedì 20.00-21.00 · '), T('giovedì 18.00-19.00')])
  ok('tre fasce, il giorno buono nella prima', pezzi('d', [4]), [S('lunedì e '), T('giovedì 18.00-19.00'), S(' · mercoledì 17.00-18.30 · sabato 10.00-11.00')])
  ok('fra due fasce in nero anche il punto è in nero', pezzi('d', [1, 3]), [T('lunedì'), S(' e giovedì '), T('18.00-19.00 · mercoledì 17.00-18.30'), S(' · sabato 10.00-11.00')])
  ok('la domenica viene dopo il sabato', pezzi('e', [0]), [S('sabato e '), T('domenica 10.00-11.00')])

  // --- i giorni che vanno: dal gruppo del corso ---
  // Nicola: lunedì, mercoledì e venerdì 19.00-20.30. Il corso: a filo il lunedì, 20 minuti prima il venerdì, un'ora prima il mercoledì.
  const nicola = [ora('zero', 1, '19:00', 90), ora('zero', 3, '19:00', 90), ora('zero', 5, '19:00', 90)]
  const vicino = [...nicola, ora('x', 1, '18:00'), ora('x', 5, '17:40'), ora('x', 3, '17:00')]
  const v = chiama(() => m.vicinanza('x', ['zero'], vicino))
  ok('SUBITO PRIMA: vanno il lunedì e il venerdì, entro la mezz’ora; il mercoledì no', [v?.gruppo, v?.giorni], ['vicino', [1, 5]])
  ok('…e nell’orario sono in nero solo loro', chiama(() => m.orarioAPezzi(vicino, 'x', v.giorni)), [T('lunedì 18.00-19.00'), S(' · mercoledì 17.00-18.00 · '), T('venerdì 17.40-18.40')])
  const sovrapposto = [...nicola, ora('x', 1, '19:30'), ora('x', 3, '17:00')]
  ok('STESSA ORA: va solo il giorno in cui si sovrappone, anche se l’altro è lo stesso giorno di Nicola', chiama(() => m.vicinanza('x', ['zero'], sovrapposto).giorni), [1])
  const stessi = [...nicola, ora('x', 1, '16:00'), ora('x', 2, '16:00')]
  ok('STESSI GIORNI: va il giorno in comune', chiama(() => m.vicinanza('x', ['zero'], stessi).giorni), [1])

  // --- le carte di LA FAMIGLIA: la riga «In grassetto …» solo con righe ---
  const voce = (corso, corsoId, natiDal, natiAl, eta = '', orariListino = []) => ({ corso, corsoId, eta, orari: orariListino, natiDal, natiAl, prezzi: [{ saldo: 300, annuale: 300, trimestre: 100 }] })
  const listino = {
    quota: 50, saldoEntro: '2026-08-31', offerte: [],
    corsi: [
      voce('Judo adulti', 'judo-adulti', undefined, 2008, 'nati nel 2008 o prima', ['lunedì e giovedì 18.00-19.30']),
      voce('Pilates', 'pilates', undefined, 2008),
      voce('Judo 3', 'judo-3', 2013, 2016, 'nati 2016-2015-2014-2013', ['lunedì e giovedì 18.00-19.00']),
      voce('Aikido 3', 'aikido-3', 2013, 2016, 'nati 2015-2014-2013'),
    ],
  }
  const corsi = listino.corsi.map((x) => ({ id: x.corsoId, nome: x.corso }))
  const orariC = [ora('judo-adulti', 1, '18:00', 90), ora('judo-adulti', 4, '18:00', 90), ora('judo-3', 1, '18:00'), ora('judo-3', 4, '18:00'), ora('aikido-3', 1, '18:00'), ora('aikido-3', 2, '18:00'), ora('pilates', 0, '09:00')]
  const luca = adulto({ nome: 'Luca', corsi: ['judo-adulti'] })
  const carte = lista(() => m.carteDellaFamiglia([luca], corsi, listino, orariC, '2026-10-06'))
  const legenda = (c) => (Array.isArray(c?.legenda) ? [unito(c.legenda), c.legenda.filter((p) => p.evidenza).map((p) => p.testo)] : c?.legenda)
  ok('con righe: sopra, «In grassetto i giorni che vanno col tuo orario.», con «grassetto» in grassetto', legenda(carte[0]), ['In grassetto i giorni che vanno col tuo orario.', ['grassetto']])
  ok('la riga di Aikido 3: niente nota, l’orario a pezzi', carte[0]?.righe?.find((r) => r.corso === 'Aikido 3'), { etichetta: 'STESSA ORA', corso: 'Aikido 3', quando: 'lunedì e martedì 18.00-19.00', pezzi: [T('lunedì'), S(' e martedì '), T('18.00-19.00')] })
  ok('nessuna riga ha più la nota', (carte[0]?.righe ?? []).concat(carte[1]?.righe ?? []).some((r) => 'nota' in r), false)
  const solo = lista(() => m.carteDellaFamiglia([adulto({ nome: 'Luca', corsi: ['pilates'] })], corsi, listino, orariC, '2026-10-06'))
  ok('senza righe: niente frase «In grassetto …»', [solo[0]?.righe, 'legenda' in (solo[0] ?? {})], [[], false])
  ok('la carta dell’adulto ha la riga dello stesso corso: la frase c’è', legenda(solo[1]), ['In grassetto i giorni che vanno col tuo orario.', ['grassetto']])
  // Il corso di Luca non ha orari nel calendario: la riga c'è, ma senza niente in grassetto la frase non direbbe niente.
  const senzaOrari = lista(() => m.carteDellaFamiglia([adulto({ nome: 'Luca', corsi: ['kendo'] })], [...corsi, { id: 'kendo', nome: 'Kendo' }], listino, orariC, '2026-10-06'))
  ok('righe senza orari nel calendario: niente frase «In grassetto …»', [(senzaOrari[1]?.righe ?? []).map((r) => [r.corso, r.pezzi]), 'legenda' in (senzaOrari[1] ?? {})], [[['Kendo', []]], false])

  // --- il passo del corso del figlio: l'età del listino, poi l'orario a pezzi ---
  const marco = figlio({ nome: 'Marco', natoIl: '2015-02-02', codiceFiscale: cfDi('Marco', 'Rossi', '2015-02-02'), corsi: [] }, { firmatario: 0 })
  const ep = chiama(() => m.corsiDelFamiliare([luca, marco], 1, corsi, listino, orariC)) ?? {}
  const judo3 = (ep.stessaOra ?? []).find((c) => c.id === 'judo-3')
  ok('nei gruppi la riga è l’età del listino, come oggi; l’orario scritto non si ripete', judo3?.riga, 'nati 2016-2015-2014-2013')
  ok('…e l’orario dal calendario, a pezzi', judo3?.orario, [T('lunedì e giovedì 18.00-19.00')])
  ok('nessun corso dei gruppi ha più il perché', ['stessaOra', 'vicini', 'stessiGiorni'].some((k) => (ep[k] ?? []).some((c) => 'perche' in c)), false)
  // Un corso alla stessa ora che il listino non ha: il prezzo resta da confermare, accanto all'orario a pezzi.
  const conPrep = chiama(() => m.corsiDelFamiliare([luca, marco], 1, [...corsi, { id: 'prep', nome: 'Preparazione atletica' }], listino, [...orariC, ora('prep', 1, '18:00'), ora('prep', 3, '18:00')])) ?? {}
  ok('senza voce nel listino: prezzo da confermare e orario a pezzi, niente riga vuota', (conPrep.stessaOra ?? []).find((c) => c.id === 'prep'), { id: 'prep', nome: 'Preparazione atletica', prezzoDaConfermare: true, orario: [T('lunedì'), S(' e mercoledì '), T('18.00-19.00')] })
  const marta = adulto({ nome: 'Marta', natoIl: '1990-03-03', codiceFiscale: cfDi('Marta', 'Rossi', '1990-03-03', true), corsi: [] })
  const am = chiama(() => m.corsiDelFamiliare([luca, marta], 1, corsi, listino, orariC)) ?? {}
  ok('lo stesso corso dell’adulto: l’età e l’orario tutto in nero', [am.stessaOra?.[0]?.riga, am.stessaOra?.[0]?.orario], ['nati nel 2008 o prima', [T('lunedì e giovedì 18.00-19.30')]])

  // --- nel componente: una <span> per pezzo, il testo letto è l'orario intero ---
  const { outputFiles } = await build({
    stdin: {
      contents:
        "import { createElement } from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { SceltaCorsi } from './src/components/ds'; export const rendi = (voci) => renderToStaticMarkup(createElement(SceltaCorsi, { id: 'x', etichetta: 'Corsi', voci, scelti: [], onScegli() {} }))",
      resolveDir: '.',
      loader: 'tsx',
    },
    bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', write: false, logLevel: 'error',
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(process.cwd() + '/x.js');" },
    define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' },
  })
  const { rendi } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  const html = chiama(() => rendi([{ id: 'b', testo: 'Aikido 3', riga: 'nati 2015-2014-2013', orario: [T('lunedì'), S(' e giovedì '), T('18.00-19.00')] }]))
  const tasto = (h) => h.match(/<button[\s\S]*?<\/button>/)?.[0] ?? ''
  ok('SceltaCorsi: il testo del tasto è nome, età e orario interi', tasto(html).replace(/<[^>]+>/g, ''), 'Aikido 3nati 2015-2014-2013 · lunedì e giovedì 18.00-19.00')
  ok('SceltaCorsi: due pezzi in nero, ognuno nella sua <span>', (tasto(html).match(/<span class="orario-evidenza">[^<]*<\/span>/g) ?? []).map((x) => x.replace(/<[^>]+>/g, '')), ['lunedì', '18.00-19.00'])
  ok('SceltaCorsi: niente aria-label sul tasto, lo legge dal testo', /<button[^>]*aria-label/.test(tasto(html)), false)
  ok('SceltaCorsi: niente più riga di perché', /modulo-corso-perche/.test(html), false)
  const sorgente = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  ok('la carta mostra l’orario a pezzi e la frase, non più la nota', [/famiglia-carta-nota|r\.nota/.test(sorgente), /<TestoAPezzi[^>]*pezzi=\{r\.pezzi\}/.test(sorgente), /c\.legenda/.test(sorgente)], [false, true, true])
  const css = readFileSync('src/styles.css', 'utf8')
  ok('lo stile della nota e del perché non c’è più; il nero sì', [/\.famiglia-carta-nota|\.modulo-corso-perche/.test(css), /\.orario-evidenza\s*\{[^}]*font-weight:\s*700[^}]*color:\s*var\(--text\)/.test(css)], [false, true])
}

// ---------------------------------------------------------------------------
// LE TRE TAPPE: la testa del passo dice in quale delle tre parti si è (CHI · IL
// CORSO · PAGA E MANDA), il passo col suo nome corto, e l'aiuto sta in fondo.
// Il design è in docs/design-canvas/navigazione-passi/C4-AiutoInFondo.dc.html.
// ---------------------------------------------------------------------------
console.log('\n44. LE TRE TAPPE')
{
  // Firma attesa: tappeDelPasso(chi, passo) → [{ nome, etichetta, stato: 'fatta'|'adesso'|'dopo', segmenti: Array<'fatto'|'adesso'|'dopo'> }], passo da 1.
  // Se la funzione manca, ogni prova mostra l'errore al posto delle tappe.
  const t = (chi, passo) => chiama(() => m.tappeDelPasso(chi, passo))
  const ogni = (tappe, f) => (Array.isArray(tappe) ? tappe.map(f) : tappe)
  const corta = (tappe) => ogni(tappe, (x) => [x.etichetta, x.stato, x.segmenti])
  const NOMI = ['CHI', 'IL CORSO', 'PAGA E MANDA']
  for (const chi of ['adulto', 'figlio']) {
    const tappe = t(chi, 1)
    ok(`tre tappe, coi loro nomi (${chi})`, ogni(tappe, (x) => x.nome), NOMI)
    ok(`i segmenti sono tanti quanti i passi (${chi})`, Array.isArray(tappe) ? tappe.reduce((n, x) => n + (x.segmenti?.length ?? 0), 0) : tappe, m.tipiDiPassi(chi).length)
  }
  ok('adulto: segmenti 1, 3, 3', ogni(t('adulto', 1), (x) => x.segmenti?.length), [1, 3, 3])
  ok('figlio: segmenti 2, 3, 3', ogni(t('figlio', 1), (x) => x.segmenti?.length), [2, 3, 3])
  // Quale passo sta in quale tappa: CHI = dati e genitore, IL CORSO = corso, modulo, documenti, PAGA E MANDA = famiglia, pagamento, riepilogo.
  const TAPPA = { dati: 'CHI', genitore: 'CHI', corso: 'IL CORSO', modulo: 'IL CORSO', documenti: 'IL CORSO', famiglia: 'PAGA E MANDA', pagamento: 'PAGA E MANDA', riepilogo: 'PAGA E MANDA' }
  for (const chi of ['adulto', 'figlio'])
    ok(`ogni passo è nella sua tappa (${chi})`, m.tipiDiPassi(chi).map((_, i) => { const x = t(chi, i + 1); return Array.isArray(x) ? x.find((y) => y.stato === 'adesso')?.nome : x }), m.tipiDiPassi(chi).map((tipo) => TAPPA[tipo]))

  ok('adulto, passo 1: CHI adesso, il resto dopo', corta(t('adulto', 1)), [
    ['CHI', 'adesso', ['adesso']],
    ['IL CORSO', 'dopo', ['dopo', 'dopo', 'dopo']],
    ['PAGA E MANDA', 'dopo', ['dopo', 'dopo', 'dopo']],
  ])
  ok('figlio, passo 5 (DOCUMENTI): CHI fatta, IL CORSO al terzo segmento', corta(t('figlio', 5)), [
    ['✓ CHI', 'fatta', ['fatto', 'fatto']],
    ['IL CORSO', 'adesso', ['fatto', 'fatto', 'adesso']],
    ['PAGA E MANDA', 'dopo', ['dopo', 'dopo', 'dopo']],
  ])
  ok('adulto, ultimo passo: due tappe fatte, PAGA E MANDA all’ultimo segmento', corta(t('adulto', 7)), [
    ['✓ CHI', 'fatta', ['fatto']],
    ['✓ IL CORSO', 'fatta', ['fatto', 'fatto', 'fatto']],
    ['PAGA E MANDA', 'adesso', ['fatto', 'fatto', 'adesso']],
  ])
  ok('figlio, ultimo passo: due tappe fatte, PAGA E MANDA all’ultimo segmento', corta(t('figlio', 8)), [
    ['✓ CHI', 'fatta', ['fatto', 'fatto']],
    ['✓ IL CORSO', 'fatta', ['fatto', 'fatto', 'fatto']],
    ['PAGA E MANDA', 'adesso', ['fatto', 'fatto', 'adesso']],
  ])

  // Il messaggio di SCRIVI: chi lo riceve sa a che passo si è fermati.
  const msg = (nome) => chiama(() => m.messaggioAiuto(nome))
  ok('il messaggio di SCRIVI dice il passo', msg('DOCUMENTI'), 'Ciao, sto compilando l’iscrizione e ho un dubbio sul passo DOCUMENTI')
  const maria = { ...m.nuovoStato('adulto'), risposte: { ...m.nuovoStato('adulto').risposte, nome: 'maria' } }
  ok('per un adulto aggiunto, il nome del passo come a schermo', msg(m.nomiDeiPassi(maria, 1)[0]), 'Ciao, sto compilando l’iscrizione e ho un dubbio sul passo DATI DI MARIA')
  // Firma attesa: scrivi(testo) in lib/sito → il link di WhatsApp al numero della palestra, col testo già scritto.
  const link = chiama(() => m.sito.scrivi('Ciao, sto compilando l’iscrizione e ho un dubbio sul passo DATI DI MARIA'))
  const wa = String(link).startsWith('https://wa.me/')
  ok('SCRIVI va al WhatsApp della palestra', wa ? String(link).split('?text=')[0] + '?text=' : link, 'https://wa.me/393463292786?text=')
  ok('il testo arriva identico, accenti e apostrofi compresi', wa ? chiama(() => decodeURIComponent(String(link).split('?text=')[1])) : link, 'Ciao, sto compilando l’iscrizione e ho un dubbio sul passo DATI DI MARIA')
  ok('il numero di wa.me è quello di CONTATTI', wa ? String(link).slice('https://wa.me/'.length).split('?')[0] : link, '39' + m.sito.CONTATTI.telefono.replace(/\s/g, ''))
  // CHIAMA e SCRIVI prendono lo stesso numero: senza il «+» il telefono compone un numero sbagliato.
  ok('CHIAMA va al numero di CONTATTI, col +39', m.sito.chiama, 'tel:+39' + m.sito.CONTATTI.telefono.replace(/\s/g, ''))
  // Un nome con & o # taglierebbe il messaggio se il testo non fosse codificato.
  const conE = chiama(() => m.sito.scrivi('DATI DI ANNA & LUCA #2'))
  ok('il testo nel link è codificato: niente spazi, & né #', /[\s&#]/.test(String(conE).split('?text=')[1] ?? ' '), false)
  ok('un nome con & arriva intero', chiama(() => new URL(String(conE)).searchParams.get('text')), 'DATI DI ANNA & LUCA #2')

  // La schermata: la testa e l'esito.
  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const codice = pagina.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((r) => !/^\s*\/\//.test(r)).join('\n')
  const flusso = codice.slice(codice.indexOf('function Flusso('))
  const passi = flusso.slice(flusso.lastIndexOf('return (', flusso.lastIndexOf('<Avanzamento')))
  const testa = passi.slice(0, passi.indexOf('<Avanzamento'))
  ok('il componente chiede le tappe alla lib', /P\.avanzamentoDelPasso\(/.test(codice), true)
  // In cima, una riga sola: il titolo a sinistra, il bollino corto a destra.
  const titolo = testa.indexOf('RICHIESTA DI ISCRIZIONE')
  const bollino = testa.indexOf('<Bollino>PROVA</Bollino>')
  ok('nei passi, RICHIESTA DI ISCRIZIONE e il bollino PROVA stanno prima della testa', titolo >= 0 && bollino >= 0, true)
  ok('stanno nello stesso contenitore', titolo >= 0 && bollino > titolo && !testa.slice(titolo, bollino).includes('</div>'), true)
  ok('il bollino corto c’è solo in prova', /d\?\.modo === 'prova' &&\s*(\(\s*)?<Bollino>PROVA<\/Bollino>/.test(testa), true)
  ok('nei passi niente bollino lungo', passi.includes('PROVA: RESTA SU QUESTO DISPOSITIVO'), false)
  ok('la scelta iniziale tiene il bollino lungo', /function Scelta[\s\S]*?<Bollino>PROVA: RESTA SU QUESTO DISPOSITIVO<\/Bollino>/.test(codice), true)
  const fuori = codice.slice(codice.indexOf('export function IscrizioneAPassi'), codice.indexOf('function SceltaFileGenitore'))
  ok('il titolo non è doppio nei passi: quello di fuori non c’è sempre', /^\s*<Titoletto>RICHIESTA DI ISCRIZIONE<\/Titoletto>\s*$/m.test(fuori), false)
  // Le persone: una riga che comincia con PER, senza il titoletto LA FAMIGLIA.
  ok('niente titoletto LA FAMIGLIA sopra le pastiglie', /<Titoletto[^>]*>\s*LA FAMIGLIA/.test(codice), false)
  const pastiglie = passi.slice(passi.indexOf('vistaFamiglia.pastiglie'), passi.indexOf('{corpo()}'))
  ok('dentro vistaFamiglia.pastiglie, PER viene prima delle pastiglie', /\bPER\b/.test(pastiglie) && pastiglie.indexOf('PER') < pastiglie.indexOf('<Chip'), true)
  // Il nome del passo sta già nella testa: DOCUMENTI non lo ripete.
  ok('il passo DOCUMENTI non ripete il suo nome in un titoletto', /<Titoletto>I DOCUMENTI<\/Titoletto>/.test(codice), false)
  // L'esito non è un passo: niente testa, niente aiuto in fondo.
  const esito = codice.slice(codice.indexOf("if (fase.tipo === 'esito')"), codice.indexOf("const inVolo = fase.tipo === 'invio'"))
  ok('l’esito non ha la testa dei passi', esito.includes('<Avanzamento'), false)
  ok('l’esito non ha la riga d’aiuto', esito.includes('Hai bisogno di aiuto'), false)
  // Il titolo di fuori non c'è più nei passi: l'esito lo rimette da sé.
  // Dentro la riga PER le pastiglie si stringono: un nome lungo si taglia con «…» e il numero di quel che manca resta a schermo.
  const css = readFileSync('src/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const regola = (sel) => css.match(new RegExp(sel.replace(/\./g, '\\.') + '\\s*\\{([^}]*)\\}'))?.[1] ?? ''
  ok('nella riga PER le pastiglie si stringono (min-width: 0)', /min-width:\s*0/.test(regola('.passo-per .famiglia-chip')), true)
  // Un nome senza spazi a 24px non esce di lato: va a capo.
  ok('il nome del passo va a capo anche senza spazi', /overflow-wrap:\s*anywhere/.test(regola('.avanza-nome')), true)
  ok('l’esito rimette il titolo RICHIESTA DI ISCRIZIONE', /function Esito[\s\S]*?<Titoletto>RICHIESTA DI ISCRIZIONE<\/Titoletto>/.test(codice), true)
  ok('i tre esiti passano da <Esito>', [(esito.match(/<Esito>/g) ?? []).length, esito.includes('<div className="stack esito">')], [3, false])
}

// ---------------------------------------------------------------------------
// RIEMPI: solo in prova, un tasto in cima accanto al bollino PROVA riempie con
// dati finti validi il passo in cui si è, per la persona attiva. Corregge quel
// che è scritto male, quel che è giusto resta. Design in
// docs/design-canvas/riempi-prova/A-InCima.dc.html e A-Dopo.dc.html.
// ---------------------------------------------------------------------------
console.log('\n45. RIEMPI, solo in prova')
{
  // Firma attesa, in src/lib/riempiPerProva.ts:
  //   riempiPerProva(persone, i, tipo, { corsi, listino, oggi, fotoDelFoglio? }) → { stato, firma? }
  // `persone` è il grezzo (senza `conDatiDellaFamiglia`), `stato` è la persona `i` riempita, `firma` i tratti da
  // mettere nel riquadro (con `stato.tratti === firma.length`). `fotoDelFoglio`: «Ho il foglio firmato» vale
  // (`firmaInFoto`), il modulo va come file. Nei passi senza tasto (famiglia, pagamento, riepilogo) lo stato resta com'è.
  // `riempibile(tipo)` sta in passiIscrizione: la schermata lo chiama senza caricare il modulo dei dati finti.
  const voce = (corso, corsoId, extra = {}) => ({ corso, corsoId, eta: '', orari: [], prezzi: [{ saldo: 300, annuale: 300, trimestre: 120 }], ...extra })
  const listino = {
    quota: 50, saldoEntro: '2026-08-31', offerte: [],
    // Il primo del listino è «dai 16 anni»: chi prende il primo corso a caso, a un bambino lo sbaglia.
    corsi: [voce('Pesi', 'pesi', { etaMinima: 16 }), voce('Judo ragazzi', 'judo-ragazzi', { natiDal: 2008, natiAl: 2022 }), voce('Judo adulti', 'judo-adulti', { natiAl: 2008 })],
  }
  const corsi = listino.corsi.map((v) => ({ id: v.corsoId, nome: v.corso }))
  const r = (persone, i, tipo, opz = {}) => chiama(() => m.riempi.riempiPerProva(persone, i, tipo, { corsi, listino, oggi: new Date(), ...opz }))
  const S = (x) => (x && typeof x === 'object' ? x.stato : x)
  const vero = (x) => !!x && typeof x === 'object'
  const passoDi = (s, tipo) => m.tipiDiPassi(s?.chi ?? 'adulto').indexOf(tipo) + 1
  const manca = (s, tipo) => chiama(() => m.mancaNelPasso(s, passoDi(s, tipo)))
  // Lo stato come si confronta: i file per nome, tipo e grandezza (JSON.stringify di un File è {}), le chiavi in ordine.
  const scritto = (s) =>
    JSON.stringify(s, (_, v) =>
      v instanceof File ? { file: v.name, tipo: v.type, grande: v.size } : v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.localeCompare(y))) : v)
  const RIEMPIBILI = ['dati', 'genitore', 'corso', 'modulo', 'documenti']
  /** Una persona riempita passo per passo dall'inizio, come chi tocca RIEMPI a ogni passo. */
  const tuttoRiempito = (chi) => {
    let s = m.nuovoStato(chi)
    for (const tipo of m.tipiDiPassi(chi)) if (RIEMPIBILI.includes(tipo)) s = vero(S(r([s], 0, tipo))) ? S(r([s], 0, tipo)) : s
    return s
  }

  // --- dove c'è il tasto ---
  ok('il tasto c’è nei passi dati, genitore, corso, modulo, documenti; non a famiglia, pagamento, riepilogo',
    ['dati', 'genitore', 'corso', 'modulo', 'documenti', 'famiglia', 'pagamento', 'riepilogo'].map((t) => chiama(() => m.riempibile(t))),
    [true, true, true, true, true, false, false, false])
  ok('il modulo dei dati finti c’è (src/lib/riempiPerProva.ts)', typeof m.riempi?.riempiPerProva, 'function')

  // --- 1. l'adulto al passo DATI ---
  const a = S(r([m.nuovoStato('adulto')], 0, 'dati'))
  ok('adulto, DATI: dopo RIEMPI non manca niente', manca(a, 'dati'), [])
  ok('adulto, DATI: il codice fiscale non chiede «Stai iscrivendo un bambino?»', chiama(() => m.controlloScelta(a)), null)
  ok('adulto, DATI: il codice fiscale è di un maggiorenne', chiama(() => m.minorenne(m.dataDaCf(a.risposte.codiceFiscale, a.risposte.natoIl))), false)
  ok('adulto, DATI: CAP 10093, comune Collegno', [a?.risposte?.cap, a?.risposte?.comune], ['10093', 'Collegno'])

  // --- 2. il bambino e chi firma ---
  const b1 = S(r([m.nuovoStato('figlio')], 0, 'dati'))
  const b = S(r([b1], 0, 'genitore'))
  ok('bambino, BAMBINO: dopo RIEMPI non manca niente', manca(b1, 'dati'), [])
  ok('bambino, CHI FIRMA: dopo RIEMPI non manca niente', manca(b, 'genitore'), [])
  ok('bambino, BAMBINO resta a posto dopo CHI FIRMA', manca(b, 'dati'), [])
  ok('il bambino è minorenne', chiama(() => m.minorenne(m.dataDaCf(b.risposte.codiceFiscale, b.risposte.natoIl))), true)
  ok('chi firma è maggiorenne', chiama(() => m.minorenne(m.cfNatoIl(b.risposte.genitoreCodiceFiscale))), false)
  ok('bambino e chi firma hanno codici fiscali diversi', chiama(() => b.risposte.codiceFiscale !== b.risposte.genitoreCodiceFiscale), true)
  ok('i due codici fiscali sono veri (carattere di controllo compreso)', chiama(() => [m.cfValido(b.risposte.codiceFiscale), m.cfValido(b.risposte.genitoreCodiceFiscale)]), [true, true])
  ok('bambino: CAP 10093, comune Collegno', [b?.risposte?.cap, b?.risposte?.comune], ['10093', 'Collegno'])

  // --- 3 e 4. quel che è giusto resta, quel che non va si corregge ---
  const marta = { ...m.nuovoStato('adulto'), risposte: { ...m.nuovoStato('adulto').risposte, nome: 'Marta' } }
  const dm = S(r([marta], 0, 'dati'))
  ok('il nome già scritto resta: Marta', dm?.risposte?.nome, 'Marta')
  ok('il codice fiscale torna con Marta', chiama(() => m.problemi(m.risposteDaiPassi(dm)).codiceFiscale), undefined)
  ok('…e non manca niente', manca(dm, 'dati'), [])
  const scritteMale = { ...m.nuovoStato('adulto'), risposte: { ...m.nuovoStato('adulto').risposte, email: 'luca@', telefono: '347 111 2233' } }
  const sm = S(r([scritteMale], 0, 'dati'))
  ok('l’email scritta male si corregge', chiama(() => sm.risposte.email !== 'luca@' && !m.problemi(m.risposteDaiPassi(sm)).email), true)
  ok('il telefono giusto resta', sm?.risposte?.telefono, '347 111 2233')
  const daMinore = { ...m.nuovoStato('adulto'), risposte: { ...m.nuovoStato('adulto').risposte, nome: 'Matteo', cognome: 'Rossi', codiceFiscale: CF_MATTEO } }
  ok('prima: «IO, SONO ADULTO» col codice di un bambino non torna', chiama(() => m.controlloScelta(daMinore)?.verdetto), 'minore')
  const dmi = S(r([daMinore], 0, 'dati'))
  ok('il codice da minorenne cambia', dmi?.risposte?.codiceFiscale !== CF_MATTEO && typeof dmi?.risposte?.codiceFiscale === 'string', true)
  ok('…e la domanda «Stai iscrivendo un bambino?» non c’è più', chiama(() => m.controlloScelta(dmi)), null)
  ok('…e non manca niente, «Non torna» compreso', manca(dmi, 'dati'), [])

  // --- 5. il corso ---
  const matteo = figlio({ corsi: [] })
  const cm = S(r([matteo], 0, 'corso'))
  const adatti = m.corsiPerEta(corsi, listino.corsi, matteo.risposte.natoIl).adatti.map((c) => c.id)
  ok('bambino, CORSO: dopo RIEMPI non manca niente', manca(cm, 'corso'), [])
  ok('il corso scelto è fra gli adatti alla sua età', chiama(() => cm.risposte.corsi.length > 0 && cm.risposte.corsi.every((c) => adatti.includes(c))), true)
  ok('…e non quello dai 16 anni', chiama(() => cm.risposte.corsi.includes('pesi')), false)
  ok('un corso già scelto e ammesso resta', S(r([figlio({ corsi: ['judo-ragazzi'] })], 0, 'corso'))?.risposte?.corsi, ['judo-ragazzi'])
  const conPesi = S(r([figlio({ corsi: ['pesi'] })], 0, 'corso'))
  ok('un corso «dai 16 anni» scelto per un bambino si toglie, e ne resta uno adatto', chiama(() => !conPesi.risposte.corsi.includes('pesi') && conPesi.risposte.corsi.every((c) => adatti.includes(c)) && conPesi.risposte.corsi.length > 0), true)

  // Con due corsi adatti, quello scelto è il secondo: resta lui, non il primo adatto.
  const dueAdatti = { ...listino, corsi: [...listino.corsi, voce('Lotta ragazzi', 'lotta-ragazzi', { natiDal: 2008, natiAl: 2022 })] }
  const corsiDue = dueAdatti.corsi.map((v) => ({ id: v.corsoId, nome: v.corso }))
  ok('un corso adatto già scelto resta anche se non è il primo', S(chiama(() => m.riempi.riempiPerProva([figlio({ corsi: ['lotta-ragazzi'] })], 0, 'corso', { corsi: corsiDue, listino: dueAdatti, oggi: new Date() })))?.risposte?.corsi, ['lotta-ragazzi'])
  // Chi firma prende il cognome del bambino, se c'è.
  const conCognome = { ...m.nuovoStato('figlio'), risposte: { ...m.nuovoStato('figlio').risposte, cognome: 'Bianchi' } }
  // Come nell'app: prima i dati del bambino (così è minorenne e chi firma serve), poi CHI FIRMA.
  ok('chi firma prende il cognome del bambino', S(r([S(r([conCognome], 0, 'dati'))], 0, 'genitore'))?.risposte?.genitoreCognome, 'Bianchi')
  // Il secondo telefono scritto male si svuota: è facoltativo.
  const tel2 = S(r([{ ...m.nuovoStato('adulto'), risposte: { ...m.nuovoStato('adulto').risposte, telefono2: 'abc' } }], 0, 'dati'))
  ok('il secondo telefono scritto male si svuota', [tel2?.risposte?.telefono2, manca(tel2, 'dati')], ['', []])
  // Il codice di una donna ha il giorno più 40: cfValido guarda solo il carattere di controllo.
  ok('codiceFinto: il giorno di una donna è più 40', chiama(() => [m.codiceFinto('Prova', 'Giulia', '1990-03-10', true, 'L219').slice(9, 11), m.codiceFinto('Prova', 'Marco', '1990-03-10', false, 'L219').slice(9, 11)]), ['50', '10'])

  // --- 6. la firma ---
  const vuoto = adulto({}, { scelte: {}, tratti: 0, privacy: false })
  vuoto.risposte.regolamento = false
  const fr = r([vuoto], 0, 'modulo')
  const f = S(fr)
  ok('FIRMA vuota: dopo RIEMPI non manca niente', manca(f, 'modulo'), [])
  ok('il modulo si può firmare', chiama(() => m.mancaPerFirmare(f)), null)
  ok('la firma finta è una firma vera', chiama(() => m.firmaVera(fr.firma)), true)
  ok('i tratti contati sono quelli della firma', chiama(() => f.tratti === fr.firma.length), true)
  ok('tesseramento e foto su AUTORIZZO', f?.scelte, { tesseramento: true, foto: true })

  // --- 7. il foglio firmato in foto ---
  // Nell'app «Ho il foglio firmato» non sta nello stato grezzo (la schermata lo ricalcola da `come`): arriva solo come opzione.
  const inFoto = adulto({}, { scelte: {}, tratti: 0, file: { documento: F('documento.jpg') } })
  const fo = S(r([inFoto], 0, 'modulo', { fotoDelFoglio: true }))
  ok('«Ho il foglio firmato»: nessuna firma da disegnare', r([inFoto], 0, 'modulo', { fotoDelFoglio: true })?.firma, undefined)
  ok('«Ho il foglio firmato»: il modulo firmato c’è, ed è un PDF', chiama(() => [fo.file.modulo instanceof File, fo.file.modulo.type, fo.file.modulo.name.endsWith('.pdf')]), [true, 'application/pdf', true])
  ok('…e non manca niente, col foglio in foto come lo vede la schermata', manca(fo && { ...fo, firmaInFoto: true }, 'modulo'), [])

  // --- 8. i documenti: solo la carta d'identità ---
  const d0 = adulto({}, { file: {} })
  const dd = S(r([d0], 0, 'documenti'))
  const doc = dd?.file?.documento
  ok('DOCUMENTI: la carta d’identità c’è', doc instanceof File, true)
  ok('…di un tipo che il contenitore accetta, col nome giusto', chiama(() => [doc.type in m.ESTENSIONI, doc.name.endsWith('.' + m.ESTENSIONI[doc.type])]), [true, true])
  ok('…sotto il massimo, e non vuota', chiama(() => doc.size > 0 && doc.size <= m.MASSIMO_FILE), true)
  ok('DOCUMENTI: dopo RIEMPI non manca niente', manca(dd, 'documenti'), [])
  ok('retro, certificato e ricevuta restano vuoti', chiama(() => ['documento-retro', 'certificato', 'ricevuta'].filter((t) => t in dd.file)), [])
  ok('a PAGAMENTO RIEMPI non c’è, e la ricevuta resta vuota', chiama(() => scritto(S(r([d0], 0, 'pagamento')))), scritto(d0))
  for (const tipo of ['famiglia', 'riepilogo']) ok(`a ${tipo.toUpperCase()} lo stato resta com’è`, chiama(() => scritto(S(r([d0], 0, tipo)))), scritto(d0))

  // --- 9. il fratello firmato da chi compila: prende dalla famiglia, non si copia ---
  let fam = lista(() => m.aggiungiFamiliare([figlio()], 'figlio', 0))
  for (const tipo of RIEMPIBILI) {
    const x = S(r(fam, 1, tipo))
    if (vero(x)) fam = fam.map((p, k) => (k === 1 ? x : p))
  }
  const fratello = fam[1]
  ok('fratello: nel grezzo genitore, indirizzo e carta restano vuoti', chiama(() => [fratello.risposte.genitoreNome, fratello.risposte.genitoreCognome, fratello.risposte.genitoreCodiceFiscale, fratello.risposte.indirizzo, fratello.risposte.cap, fratello.risposte.comune, fratello.file.documento]), ['', '', '', '', '', '', undefined])
  const visto = lista(() => m.conDatiDellaFamiglia(fam))[1]
  ok('…e la famiglia gli dà quelli di Matteo', chiama(() => [visto.risposte.genitoreNome, visto.risposte.indirizzo, visto.file.documento === fam[0].file.documento]), ['Paola', 'Via Roma 1', true])
  ok('fratello: nessun passo riempito ha mancanze', chiama(() => RIEMPIBILI.map((t) => manca(visto, t))), RIEMPIBILI.map(() => []))
  ok('il fratello ha un nome suo', chiama(() => fratello.risposte.nome.trim() !== '' && fratello.risposte.nome !== 'Matteo'), true)

  // --- 10. l'io: è già scritto nel bambino 0 ---
  const conIo = [figlio(), io({}, { scelte: {} })]
  ok('io, DATI: lo stato non cambia', chiama(() => scritto(S(r(conIo, 1, 'dati')))), scritto(conIo[1]))
  ok('io, DOCUMENTI: lo stato non cambia', chiama(() => scritto(S(r(conIo, 1, 'documenti')))), scritto(conIo[1]))
  // Per l'io mancaNelPasso chiede solo tesseramento e foto: firma, ok e foglio sono del bambino 0.
  const ioFirma = r(conIo, 1, 'modulo')
  ok('io, FIRMA: cambiano solo le scelte', chiama(() => scritto(S(ioFirma))), scritto({ ...conIo[1], scelte: { tesseramento: true, foto: true } }))
  ok('io, FIRMA: nessuna firma da disegnare', vero(ioFirma) && ioFirma.firma === undefined, true)
  ok('io, FIRMA: non manca niente', manca(S(ioFirma), 'modulo'), [])

  // --- 11. due volte di fila come una ---
  for (const [chi, fresco] of [['adulto', () => m.nuovoStato('adulto')], ['figlio', () => m.nuovoStato('figlio')]])
    for (const tipo of m.tipiDiPassi(chi).filter((t) => RIEMPIBILI.includes(t))) {
      const una = S(r([fresco()], 0, tipo))
      ok(`${chi}, ${tipo}: RIEMPI due volte è come una`, [vero(una), chiama(() => scritto(S(r([una], 0, tipo))))], [true, scritto(una)])
    }

  // --- 12. gli altri passi non cambiano ---
  // Il passo DATI del bambino no: con la data di un minore, CHI FIRMA chiede (giustamente) i dati del genitore.
  for (const chi of ['adulto', 'figlio']) {
    const tipi = m.tipiDiPassi(chi)
    const prima = m.nuovoStato(chi)
    for (const tipo of tipi.filter((t) => RIEMPIBILI.includes(t) && !(chi === 'figlio' && t === 'dati'))) {
      const dopo = S(r([prima], 0, tipo))
      const altri = tipi.slice(0, -1).filter((t) => t !== tipo)
      ok(`${chi}, ${tipo}: gli altri passi hanno le mancanze di prima`, altri.map((t) => manca(dopo, t)), altri.map((t) => manca(prima, t)))
    }
  }

  // --- 13. riempito dall'inizio, la richiesta parte ---
  for (const chi of ['adulto', 'figlio']) {
    const s = tuttoRiempito(chi)
    ok(`${chi} riempito passo per passo: all’INVIO non manca niente`, chiama(() => m.mancantiFamiglia([s])), [])
    ok(`${chi} riempito passo per passo: la richiesta passa i controlli`, chiama(() => m.controlla(m.richiesteDaMandare(s, 'TO', async () => F('modulo.pdf'))[0].dati)), null)
  }

  // --- 14. in famiglia nomi diversi ---
  let due = lista(() => m.aggiungiFamiliare([m.nuovoStato('adulto')], 'adulto', 0))
  for (const i of [0, 1]) {
    const x = S(r(due, i, 'dati'))
    if (vero(x)) due = due.map((p, k) => (k === i ? x : p))
  }
  ok('due adulti riempiti hanno nomi diversi', chiama(() => due[0].risposte.nome.trim() !== '' && due[0].risposte.nome !== due[1].risposte.nome), true)
  ok('…e codici fiscali diversi', chiama(() => due[0].risposte.codiceFiscale !== due[1].risposte.codiceFiscale), true)
  ok('il secondo adulto non ha mancanze ai DATI', manca(lista(() => m.conDatiDellaFamiglia(due))[1], 'dati'), [])

  // --- 15. la schermata ---
  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const codice = pagina.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((x) => !/^\s*\/\//.test(x)).join('\n')
  const flusso = codice.slice(codice.indexOf('function Flusso('))
  const passi = flusso.slice(flusso.lastIndexOf('return (', flusso.lastIndexOf('<Avanzamento')))
  const testa = passi.slice(0, passi.indexOf('<Avanzamento'))
  // Le espressioni {d?.modo === 'prova' && …} della testa, intere: dalla graffa alla sua chiusa.
  const soloInProva = [...testa.matchAll(/\{\s*d\?\.modo === 'prova' &&/g)].map((x) => {
    let n = 0
    for (let k = x.index; k < testa.length; k++) {
      n += testa[k] === '{' ? 1 : testa[k] === '}' ? -1 : 0
      if (!n) return testa.slice(x.index, k + 1)
    }
    return ''
  })
  ok('nella testa dei passi, accanto al bollino PROVA, c’è RIEMPI', /\bRIEMPI\b/.test(testa), true)
  // Ogni espressione «solo in prova» si toglie da sola: due di fila non sono un pezzo unico del sorgente.
  ok('RIEMPI c’è solo in prova', soloInProva.some((e) => /\bRIEMPI\b/.test(e)) && !soloInProva.reduce((t, e) => t.replace(e, ''), testa).includes('RIEMPI'), true)
  ok('RIEMPI solo dove serve: chiede P.riempibile', soloInProva.some((e) => /\bRIEMPI\b/.test(e) && /P\.riempibile\(/.test(e)), true)
  ok('riempiPerProva si carica quando si tocca: import() dinamico', /import\(\s*['"]\.\.\/lib\/riempiPerProva['"]\s*\)/.test(codice), true)
  // «Ho il foglio firmato» la schermata lo sa da `come` (in `tutte`), non dal grezzo: RIEMPI lo prende da lì.
  ok('RIEMPI sa del foglio in foto come la schermata (v.firmaInFoto)', /riempiPerProva\([^)]*fotoDelFoglio:\s*v\.firmaInFoto/.test(codice), true)
  ok('se il pezzo non arriva, RIEMPI lo dice', /import\(\s*['"]\.\.\/lib\/riempiPerProva['"]\s*\)[\s\S]{0,600}\.catch\(/.test(codice), true)
  ok('…e nessun import statico', /^\s*import\b[^;]*['"]\.\.\/lib\/riempiPerProva['"]/m.test(codice), false)
}

// ---------------------------------------------------------------------------
// I PASSI COMUNI: con due o più persone FAMIGLIA, PAGAMENTO e INVIO sono un
// passo solo per tutti. Niente pastiglie, la testa è quella della persona 0
// qualunque sia attiva, e le note per la segreteria sono una per il modulo.
// ---------------------------------------------------------------------------
console.log('\n46. I PASSI COMUNI')
{
  const COMUNI = ['famiglia', 'pagamento', 'riepilogo']
  const SUOI = ['dati', 'genitore', 'corso', 'modulo', 'documenti']
  const passoDi = (s, tipo) => m.tipiDiPassi(s.chi).indexOf(tipo) + 1

  // --- le pastiglie ---
  const fam = (o) => chiama(() => m.famigliaNelPasso(o))
  for (let quante = 2; quante <= m.MASSIMO_PERSONE; quante++) {
    ok(`in ${quante}, nei passi comuni niente pastiglie`, COMUNI.map((tipo) => fam({ tipo, quante })?.pastiglie), [false, false, false])
    ok(`in ${quante}, nei passi di ognuno le pastiglie`, SUOI.map((tipo) => fam({ tipo, quante })?.pastiglie), [true, true, true, true, true])
  }
  ok('da solo, in nessun passo le pastiglie', [...SUOI, ...COMUNI].map((tipo) => fam({ tipo, quante: 1 })?.pastiglie), Array(8).fill(false))

  // --- la testa: numero, totale e tappe ---
  // Un adulto ha 7 passi e un bambino 8: nei passi comuni la testa non deve cambiare con la persona attiva.
  const av = (persone, attivo, passo) => chiama(() => m.avanzamentoDelPasso(persone, attivo, passo))
  const della = (s, passo) => ({ numero: passo, totale: m.tipiDiPassi(s.chi).length, tappe: m.tappeDelPasso(s.chi, passo) })
  for (const [nome, persone] of [['bambino e adulto', [figlio(), adulto()]], ['adulto e bambino', [adulto(), figlio()]]]) {
    for (const tipo of COMUNI) {
      // Un errore resta un errore, non un falso «uguali».
      const [uno, zero] = [av(persone, 1, passoDi(persone[1], tipo)), av(persone, 0, passoDi(persone[0], tipo))]
      ok(`${nome}, ${tipo}: la testa è la stessa con l’una o l’altra attiva`, typeof uno === 'string' ? uno : JSON.stringify(uno) === JSON.stringify(zero), true)
      ok(`${nome}, ${tipo}: la testa è quella della persona 0`, av(persone, 1, passoDi(persone[1], tipo)), della(persone[0], passoDi(persone[0], tipo)))
    }
    ok(`${nome}, fuori dai passi comuni: la testa della persona attiva`, [av(persone, 1, 2), av(persone, 1, passoDi(persone[1], 'documenti'))], [della(persone[1], 2), della(persone[1], passoDi(persone[1], 'documenti'))])
  }
  ok('da solo, a FAMIGLIA: la sua testa', av([adulto()], 0, 5), della(adulto(), 5))

  // --- il messaggio di SCRIVI (guardia: i nomi dei passi comuni sono già uguali per tutti) ---
  for (const [nome, persone] of [['bambino e adulto', [figlio(), adulto()]], ['adulto e bambino', [adulto(), figlio()]]])
    ok(`${nome}: nei passi comuni SCRIVI dice lo stesso passo con l’una o l’altra attiva`,
      COMUNI.map((tipo) => m.messaggioAiuto(m.nomiDeiPassi(persone[1], 1)[passoDi(persone[1], tipo) - 1])),
      COMUNI.map((tipo) => m.messaggioAiuto(m.nomiDeiPassi(persone[0], 0)[passoDi(persone[0], tipo) - 1])))

  // --- INDIETRO da FAMIGLIA (guardia) ---
  for (const s of [adulto(), figlio()]) {
    const ind = m.indietro(passoDi(s, 'famiglia'), DOMANDA)
    ok(`${s.chi}: INDIETRO da FAMIGLIA porta a DOCUMENTI`, ind.a === 'passo' ? m.tipiDiPassi(s.chi)[ind.passo - 1] : ind, 'documenti')
  }

  // --- VAI A non porta mai a un passo comune (guardia) ---
  const incompleti = [
    m.nuovoStato('adulto'), m.nuovoStato('figlio'),
    adulto({}, { tratti: 0 }), figlio({}, { file: {} }), adulto({ corsi: [] }), figlio({ genitoreCodiceFiscale: '' }), adulto({}, { privacy: false }),
  ]
  const conCorsi = [{ id: 'judo-adulti', nome: 'Judo adulti' }, { id: 'judo-3', nome: 'Judo 3' }]
  const righe = lista(() => m.righeDellaFamiglia(incompleti, conCorsi))
  ok('chi manca di qualcosa: VAI A porta a un passo suo, mai a uno comune', righe.map((r, i) => (r.manca ? m.tipiDiPassi(incompleti[i].chi)[r.passo - 1] : 'a posto')).filter((t) => COMUNI.includes(t)), [])
  ok('le righe di prova mancano tutte di qualcosa', righe.map((r) => r.manca), Array(incompleti.length).fill(true))

  // --- le note per la segreteria: una per il modulo ---
  // Come la ricevuta: scritta una volta in INVIO, la stessa in ogni richiesta della famiglia.
  const NOTA = 'Preferiamo il martedì'
  const tre = [figlio(), io(), figlio({ nome: 'Sara', codiceFiscale: cfDi('Sara', 'Rossi', '2018-03-03', true) })]
  const conNota = lista(() => m.conLaNota(tre, NOTA))
  ok('la nota scritta una volta si rilegge uguale', chiama(() => m.notaDelModulo(conNota)), NOTA)
  ok('la nota resta coi dati della famiglia', chiama(() => m.notaDelModulo(m.conDatiDellaFamiglia(conNota))), NOTA)
  ok('la nota resta aggiungendo una persona', chiama(() => m.notaDelModulo(m.aggiungiFamiliare(m.conLaNota(tre, NOTA), 'figlio', 0))), NOTA)
  ok('togliendo la nota non ce n’è più', chiama(() => m.notaDelModulo(m.conLaNota(conNota, ''))), undefined)
  // Una nota vecchia, scritta da una persona sola: quella del modulo la sostituisce in tutte.
  const conVecchia = lista(() => m.conLaNota([tre[0], { ...tre[1], risposte: { ...tre[1].risposte, note: 'vecchia' } }, tre[2]], NOTA))
  const pdfFinto = async () => F('m.pdf')
  const daMandare = (persone) => lista(() => m.richiesteDelModulo(m.conDatiDellaFamiglia(persone), (p) => m.richiesteDaMandare(p, 'TO', pdfFinto)))
  ok('la nota del modulo arriva uguale in ogni richiesta', daMandare(conVecchia).map((x) => x.dati.note), [NOTA, NOTA, NOTA])
  ok('senza nota, nessuna richiesta ne porta una', daMandare(lista(() => m.conLaNota(tre, ''))).map((x) => x.dati.note || ''), ['', '', ''])
  ok('da solo, la nota è nella sua richiesta', daMandare(lista(() => m.conLaNota([adulto()], NOTA))).map((x) => x.dati.note), [NOTA])

  // All'invio: la nota, a capo il legame, sotto i 1000 del database.
  const d0 = () => {
    const inviati = []
    return { inviati, modo: 'prova', async invia(dati) { inviati.push(dati); return `r${inviati.length}` }, async caricaFile() {} }
  }
  {
    const d = d0()
    const tutte = daMandare(conVecchia)
    if (tutte.length) await m.mandaRichieste(d, tutte)
    ok('all’invio, tre richieste: ognuna con la nota e a capo il legame', d.inviati.map((x) => (x.note ?? '').startsWith(`${NOTA}\n`) && (x.note ?? '').endsWith('sconto famiglia da applicare')), [true, true, true])
  }
  {
    const d = d0()
    const lunga = 'y'.repeat(m.MASSIMO_NOTE)
    let sei = tre
    for (let i = 0; i < 3; i++) sei = lista(() => m.aggiungiFamiliare(sei, 'figlio', 0))
    const tutte = daMandare(lista(() => m.conLaNota(sei, lunga)))
    if (tutte.length) await m.mandaRichieste(d, tutte)
    ok('sei persone, nota da 900: tutte la portano intera, col legame, sotto i 1000', d.inviati.map((x) => (x.note ?? '').startsWith(`${lunga}\n`) && (x.note ?? '').includes('sconto famiglia') && (x.note ?? '').length <= 1000), Array(6).fill(true))
  }
  // Una nota vecchia in un'altra persona, e quella del modulo vuota: non parte.
  ok('una nota vecchia di un’altra persona non parte', daMandare([tre[0], { ...tre[1], risposte: { ...tre[1].risposte, note: 'vecchia' } }, tre[2]]).map((x) => x.dati.note || ''), ['', '', ''])

  // --- la pastiglia di chi è fermo in un passo comune ---
  // Tocco Tommaso dal CORSO di Giulia, e Tommaso era a FAMIGLIA: va al suo CORSO, non a un passo senza PER.
  const coppia = [adulto(), figlio()]
  const pastiglia = (i, salvato, attivo, passo) => chiama(() => m.passoDellaPastiglia(coppia, i, salvato, attivo, passo))
  for (const tipo of COMUNI)
    ok(`pastiglia, fermo a ${tipo}: va allo stesso passo di chi è attivo`, pastiglia(1, passoDi(coppia[1], tipo), 0, passoDi(coppia[0], 'corso')), passoDi(coppia[1], 'corso'))
  ok('pastiglia, fermo a FAMIGLIA, da DATI (il bambino ha BAMBINO): il suo primo passo', pastiglia(1, passoDi(coppia[1], 'famiglia'), 0, 1), 1)
  ok('pastiglia, da CHI FIRMA verso un adulto, che non ce l’ha: il suo primo passo', pastiglia(0, passoDi(coppia[0], 'pagamento'), 1, passoDi(coppia[1], 'genitore')), 1)
  ok('pastiglia, fermo in un passo suo: torna lì', pastiglia(1, passoDi(coppia[1], 'modulo'), 0, passoDi(coppia[0], 'corso')), passoDi(coppia[1], 'modulo'))
  const codicePer = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  ok('la pastiglia chiede alla lib dove andare', /vaiA\(i, P\.passoDellaPastiglia\(/.test(codicePer), true)

  // --- la schermata: il campo NOTE è quello del modulo ---
  const sorgente = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const note = sorgente.slice(sorgente.indexOf('id="n-note"'), sorgente.indexOf('/>', sorgente.indexOf('id="n-note"')))
  ok('il campo NOTE legge e scrive la nota del modulo', [/P\.notaDelModulo\(/.test(note), /P\.conLaNota\(/.test(note), /metti\('note'\)/.test(note)], [true, true, false])
}

// ---------------------------------------------------------------------------
// ESCI DALLA PROVA: aperto una volta il link con ?prova, la prova resta accesa
// su quel telefono. Nella pagina Iscrizioni il nastro giallo della sala lo dice
// e la spegne. Design in docs/design-canvas/esci-dalla-prova/Proposta.dc.html.
// ---------------------------------------------------------------------------
console.log('\n47. ESCI DALLA PROVA')
{
  const senzaCommenti = (f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((x) => !/^\s*\/\//.test(x)).join('\n')
  const app = senzaCommenti('src/App.tsx')
  const iscrizioni = app.slice(app.indexOf('function Iscrizioni('), app.indexOf('\nfunction ', app.indexOf('function Iscrizioni(') + 1))
  const ds = senzaCommenti('src/components/ds.tsx')
  const nastro = ds.slice(ds.indexOf('export function NastroProva('), ds.indexOf('\nexport ', ds.indexOf('export function NastroProva(') + 1))
  ok('il nastro della prova sta in ds.tsx, col tasto ESCI DALLA PROVA', [nastro.includes('nastro-prova'), /ESCI DALLA PROVA/.test(nastro), /onClick=\{onEsci\}/.test(nastro), /\{onEsci && \(/.test(nastro)], [true, true, true, true])
  ok('nella pagina Iscrizioni il nastro c’è solo con la prova scelta', /\{\s*inProvaScelta\s*&&\s*\(?\s*<NastroProva\b/.test(iscrizioni), true)
  ok('…e ESCI DALLA PROVA la spegne', /<NastroProva\b[^>]*onEsci=\{\(\)\s*=>\s*scegliProva\(false\)\}/.test(iscrizioni), true)
  ok('…dice che le richieste non arrivano in segreteria', /<NastroProva\b[^>]*testo="PROVA · LE RICHIESTE NON ARRIVANO IN SEGRETERIA"/.test(iscrizioni), true)
  // In sala solo coi dati di prova, ed ESCI solo con la prova scelta.
  ok('la sala usa lo stesso nastro, solo in prova', /\{d\.modo === 'prova' && <NastroProva testo="DATI DI PROVA · ISCRITTI INVENTATI" onEsci=\{inProvaScelta \? \(\) => scegliProva\(false\) : undefined\} \/>\}/.test(senzaCommenti('src/components/Sala.tsx')), true)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
