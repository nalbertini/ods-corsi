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
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const { outputFiles } = await build({
  stdin: {
    contents: [
      "export * from './src/lib/passiIscrizione'",
      "export { creaRichiesteProva } from './src/lib/richiesteProva'",
      "export { controlla, datiRichieste, domandaUscita, FILE } from './src/lib/richieste'",
      "export { carattereControllo, lettereCognome, lettereNome } from './src/lib/codiceFiscale'",
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
  ancheTu: false,
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
console.log('\n3. il modulo di oggi non cambia: solo la parola export')
{
  const file = ['src/components/ModuloIscrizione.tsx', 'src/components/IscrizioniScreen.tsx']
  let diff
  for (const base of ['main', 'origin/main']) {
    try {
      diff = execFileSync('git', ['diff', '--unified=0', base, '--', ...file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      break
    } catch {
      /* quel ramo qui non c'è: si prova l'altro */
    }
  }
  if (diff === undefined) console.log('  - saltata: senza un ramo main con cui confrontare')
  else {
    const righe = diff.split('\n').filter((r) => /^[+-]/.test(r) && !/^(\+\+\+|---)/.test(r))
    const senza = (segno) => righe.filter((r) => r[0] === segno).map((r) => r.slice(1).replace(/^export /, '')).sort()
    ok('le righe cambiate sono le stesse, a meno di «export»', senza('+'), senza('-'))
  }
}

// ---------------------------------------------------------------------------
console.log('\n4. i passi')
{
  const ADULTO = ['I TUOI DATI', 'IL CORSO E COME SI PAGA', 'IL MODULO, LA FIRMA E I FILE', 'CONTROLLA E INVIA']
  const FIGLIO = ['IL BAMBINO', 'IL GENITORE CHE FIRMA', 'CORSI E COME SI PAGA', 'IL MODULO, LA FIRMA E I FILE', 'CONTROLLA E INVIA']
  ok('adulto: quattro passi', m.passiDi('adulto', false), ADULTO)
  ok('figlio: cinque passi', m.passiDi('figlio', false), FIGLIO)
  ok('figlio e anche tu: sei passi', m.passiDi('figlio', true), [...FIGLIO.slice(0, 4), 'ANCHE TU: POCHE COSE', 'CONTROLLA E INVIA'])
  ok('un adulto non ha un «anche tu»', m.passiDi('adulto', true), ADULTO)
  // Cosa si fa in ogni passo lo dice la lib: la schermata non ripete l'ordine.
  ok('tipi: adulto', m.tipiDiPassi('adulto', false), ['dati', 'corso', 'modulo', 'riepilogo'])
  ok('tipi: figlio', m.tipiDiPassi('figlio', false), ['dati', 'genitore', 'corso', 'modulo', 'riepilogo'])
  ok('tipi: figlio e anche tu', m.tipiDiPassi('figlio', true), ['dati', 'genitore', 'corso', 'modulo', 'anche', 'riepilogo'])
  ok('tipi: un adulto non ha un «anche tu»', m.tipiDiPassi('adulto', true), ['dati', 'corso', 'modulo', 'riepilogo'])
  for (const [chi, anche] of [['adulto', false], ['figlio', false], ['figlio', true]])
    ok(`tipi e nomi dei passi sono tanti uguali (${chi}${anche ? ' + anche tu' : ''})`, m.tipiDiPassi(chi, anche).length, m.passiDi(chi, anche).length)
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
  ok('passo 3: manca il documento', nomi(adulto({}, { file: {} }), 3), ["CARTA D'IDENTITÀ"])
  ok('passo 3: manca la privacy', nomi(adulto({}, { privacy: false }), 3), ['INFORMATIVA PRIVACY'])
  ok('passo 3: manca il regolamento', nomi(adulto({ regolamento: false }), 3), ['REGOLAMENTO'])
  ok('passo 3: nessuna firma né caselle', nomi(adulto({}, { tratti: 0, scelte: {} }), 3), ['FIRMA', 'FOTO', 'TESSERAMENTO'])
  ok('passo 3: col foglio firmato non serve la firma', nomi(adulto({}, { tratti: 0, scelte: {}, file: { documento: F('d.jpg'), modulo: F('m.jpg') } }), 3), [])
  ok('il retro e il certificato non fermano', nomi(adulto(), 3), [])
  ok('l’ultimo passo rimette insieme tutto: a posto', nomi(adulto(), 4), [])
  ok('l’ultimo passo rimette insieme tutto: manca un nome', nomi(adulto({ nome: '' }), 4), ['NOME'])

  ok('figlio, passo 1 a posto', nomi(figlio(), 1), [])
  ok('figlio, passo 2: il genitore non c’è', nomi(figlio({ genitoreNome: '', genitoreCodiceFiscale: '' }), 2), ['CODICE FISCALE DEL GENITORE', 'NOME DEL GENITORE'])
  ok('figlio, passo 2: contatti a posto', nomi(figlio(), 2), [])
  ok('figlio, passo 3: «anche te?» senza risposta', nomi(figlio({}, { ancheTu: undefined }), 3), ['SCEGLI: ANCHE TE?'])
  ok('figlio, passo 3: risposto no, a posto', nomi(figlio(), 3), [])
  ok('figlio, passo 4: dove è nato il genitore', nomi(figlio({}, { natoAGenitore: ' ' }), 4), ['DOVE È NATO IL GENITORE'])
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
  ok('ricontrollo all’invio: l’ultimo passo lo vede', nomi(conCf(CF_MATTEO), 4).includes('CODICE FISCALE'), true)
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
  ok('niente «anche tu»', indietroAdulto.ancheTu, undefined)
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
  for (let p = 1; p <= 5; p++) m.mancaNelPasso(s, p)
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
  ok('è ancora un figlio, da capire se anche tu', [inizio.chi, inizio.ancheTu], ['figlio', undefined])
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
  // Con «Anche tu» il foglio in foto non c'è tra le scelte: si manda alla segreteria.
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

  // Anche tu: il bambino, poi il genitore.
  const duePersone = (d) => {
    const bambino = m.risposteDaiPassi(figlio())
    const lui = m.richiestaDelGenitore(bambino, { corsi: ['judo-adulti'], formula: 'annuale', natoA: 'TORINO (TO)' })
    const doc = F('d.jpg')
    return [
      { dati: bambino, file: { documento: doc, ricevuta: F('r.jpg') }, faiPdf: pdf(d.log, 'Matteo') },
      { dati: lui, file: { documento: doc, certificato: F('c.pdf'), ricevuta: F('r.jpg') }, faiPdf: pdf(d.log, 'Paola') },
    ]
  }
  {
    const d = finto()
    const e = await m.mandaRichieste(d, duePersone(d))
    ok('anche tu: i due PDF, poi il bambino e i suoi file, poi il genitore e i suoi', d.log, [
      'pdf Matteo', 'pdf Paola',
      'invia Matteo', 'file r1 modulo', 'file r1 documento', 'file r1 ricevuta',
      'invia Paola', 'file r2 modulo', 'file r2 documento', 'file r2 certificato', 'file r2 ricevuta',
    ])
    ok('anche tu: due richieste arrivate', [e.esito, e.ids], ['fatto', ['r1', 'r2']])
    ok('anche tu: il bambino porta il legame col genitore', d.inviati[0].note, 'mandata insieme alla richiesta di Paola Rossi, sconto famiglia da applicare')
    ok('anche tu: il genitore porta il legame col bambino', d.inviati[1].note, 'mandata insieme alla richiesta di Matteo Rossi, sconto famiglia da applicare')
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
  // La seconda si ferma (3 richieste al giorno per email): la prima è arrivata.
  {
    const d = finto()
    const MSG = 'Da questa email sono già arrivate 3 richieste oggi: se serve, scrivi alla segreteria'
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
  // La prova vera: la seconda incontra il limite di tre al giorno per email.
  {
    memoria.clear()
    const r = m.creaRichiesteProva()
    for (const [nome, cognome, cf] of [['Luca', 'Rossi', CF_LUCA], ['Marco', 'Verdi', cfDi('Marco', 'Verdi', '1990-03-03')]])
      await r.invia({ ...adulto({ nome, cognome, codiceFiscale: cf, natoIl: cf === CF_LUCA ? '1996-01-01' : '1990-03-03', email: 'famiglia@esempio.it' }).risposte })
    const bambino = m.risposteDaiPassi(figlio({ email: 'famiglia@esempio.it' }))
    const lui = m.richiestaDelGenitore(bambino, { corsi: ['judo-adulti'], formula: 'annuale', natoA: 'TORINO (TO)' })
    const e = await m.mandaRichieste(r, [{ dati: bambino, file: {} }, { dati: lui, file: {} }])
    ok('con la prova vera: la terza passa, la quarta si ferma', [e.esito, e.perche], ['secondaNo', 'Da questa email sono già arrivate 3 richieste oggi: se serve, scrivi alla segreteria'])
    ok('e in elenco ci sono tre richieste nuove', (await r.richieste()).map((x) => x.stato), ['nuova', 'nuova', 'nuova'])
    ok('ancora niente rete', chiamateDiRete, 0)
  }
}

// ---------------------------------------------------------------------------
console.log('\n13. anche tu: il conto, il corso parallelo, la richiesta del genitore')
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

  const paralleli = m.corsiParalleli(corsi, listino.corsi, '1984-05-05', ['judo-3'])
  ok('corso parallelo: per la sua età con lo stesso orario del figlio', paralleli.map((c) => c.id), ['judo-adulti'])
  ok('corso parallelo: «stessa ora»', paralleli.map((c) => c.stessaOra), [true])
  ok('niente corsi di un altro orario', paralleli.some((c) => c.id === 'aikido-adulti'), false)
  ok('niente corsi fuori età', paralleli.some((c) => c.id === 'judo-2'), false)
  ok('il figlio senza corsi: nessun parallelo', m.corsiParalleli(corsi, listino.corsi, '1984-05-05', []), [])

  const bambino = m.risposteDaiPassi(figlio())
  const lui = m.richiestaDelGenitore(bambino, { corsi: ['judo-adulti'], formula: 'trimestre', natoA: 'TORINO (TO)' })
  ok('la richiesta del genitore: chi è', [lui.nome, lui.cognome, lui.codiceFiscale, lui.natoIl, lui.natoA], ['Paola', 'Rossi', CF_PAOLA, '1980-01-01', 'TORINO (TO)'])
  ok('la richiesta del genitore: residenza e contatti del foglio', [lui.indirizzo, lui.cap, lui.comune, lui.email, lui.telefono], ['Via Roma 1', '10093', 'Collegno', 'paola@esempio.it', '347 111 2233'])
  ok('la richiesta del genitore: corso e formula sono suoi', [lui.corsi, lui.formula, lui.regolamento], [['judo-adulti'], 'trimestre', true])
  ok('il genitore è un adulto: nessun genitore*', [lui.genitoreNome, lui.genitoreCognome, lui.genitoreCodiceFiscale].map((x) => x || ''), ['', '', ''])
  ok('la richiesta del genitore passa i controlli di oggi', m.controlla(lui), null)

  // Il conto è uno solo: la proposta del passo 3 e il riepilogo dicono le stesse cifre.
  const conGenitore = figlio({}, { ancheTu: true, suo: { corsi: ['judo-adulti'], formula: 'annuale', scelte: {} } })
  const delRiepilogo = m.contoDelloStato(conGenitore, corsi, listino, giorno)
  const proposta = m.contoDelloStato(figlio(), corsi, listino, giorno, corsi[1])
  ok('il conto dallo stato: stesse cifre della stima a mano', [delRiepilogo.totale, delRiepilogo.sconto], [annuali.totale, annuali.sconto])
  ok('la proposta (corso parallelo, formula del figlio) e il riepilogo (scelta del genitore) tornano uguali', proposta, delRiepilogo)
  ok('senza genitore e senza proposta non c’è un conto di famiglia', m.contoDelloStato(figlio(), corsi, listino, giorno), undefined)
  ok('il genitore sceglie un’altra formula: nel riepilogo conta la sua', m.contoDelloStato(figlio({}, { ancheTu: true, suo: { corsi: ['judo-adulti'], formula: 'trimestre', scelte: {} } }), corsi, listino, giorno)?.sconto, undefined)

  // «Stessa ora» in cima: lo decide la lib, non la schermata.
  const rovesciato = { ...listino, corsi: [listino.corsi[3], listino.corsi[1], listino.corsi[0], listino.corsi[2]] }
  const ep = m.corsiPerEtaConStessaOra(corsi, rovesciato, '1984-05-05', ['judo-3'], 'Matteo')
  ok('stessa ora: il corso con lo stesso orario del figlio passa in cima', ep.adatti.map((c) => c.id), ['judo-adulti', 'aikido-adulti'])
  ok('stessa ora: la riga lo dice, solo su quello', ep.adatti.map((c) => c.riga?.includes('stessa ora di Matteo') ?? false), [true, false])
  ok('senza listino niente corsi per età e nessun «stessa ora»', m.corsiPerEtaConStessaOra(corsi, undefined, '1984-05-05', ['judo-3'], 'Matteo').adatti.some((c) => c.riga?.includes('stessa ora')), false)

  // Cosa parte per ognuno: il file di ogni richiesta e i dati del PDF.
  const chiamate = []
  const faiPdf = async (c) => {
    chiamate.push([c.dati.nome, c.minore, c.scelte, c.natoA, c.provincia])
    return F('modulo-firmato.pdf')
  }
  const doc = F('d.jpg'), retro = F('retro.jpg'), ric = F('ric.jpg')
  const due = m.richiesteDaMandare(
    figlio({}, {
      ancheTu: true,
      suo: { corsi: ['judo-adulti'], formula: 'trimestre', scelte: { tesseramento: false, foto: true }, certificato: F('c-lui.pdf') },
      file: { documento: doc, 'documento-retro': retro, ricevuta: ric, certificato: F('c-bimbo.pdf') },
    }),
    'TO',
    faiPdf,
  )
  ok('anche tu: due richieste', due.length, 2)
  ok('il bambino: documento, retro, ricevuta e il suo certificato', Object.entries(due[0].file).map(([k, f]) => `${k}=${f.name}`).sort(), ['certificato=c-bimbo.pdf', 'documento-retro=retro.jpg', 'documento=d.jpg', 'ricevuta=ric.jpg'].sort())
  ok('il genitore: stessa carta d’identità e ricevuta, ma il certificato è suo', Object.entries(due[1].file).map(([k, f]) => `${k}=${f.name}`).sort(), ['certificato=c-lui.pdf', 'documento-retro=retro.jpg', 'documento=d.jpg', 'ricevuta=ric.jpg'].sort())
  ok('il genitore non porta il foglio in foto: il PDF lo fa l’app', due[1].file.modulo, undefined)
  ok('la richiesta del genitore: lui, il suo corso e la sua formula', [due[1].dati.nome, due[1].dati.corsi, due[1].dati.formula, due[1].dati.natoA], ['Paola', ['judo-adulti'], 'trimestre', 'Torino (TO)'])
  ok('la richiesta del bambino è quella delle risposte', due[0].dati, m.risposteDaiPassi(figlio({}, { ancheTu: true })))
  await due[0].faiPdf()
  await due[1].faiPdf()
  ok(
    'PDF del bambino: modulo per minori, le sue scelte, dov’è nato il genitore; PDF del genitore: modulo per maggiorenni, le scelte del genitore',
    chiamate,
    [['Matteo', true, { tesseramento: true, foto: true }, 'Torino', 'TO'], ['Paola', false, { tesseramento: false, foto: true }, '', '']],
  )
  chiamate.length = 0
  const solo = m.richiesteDaMandare(adulto({}, { scelte: { tesseramento: true, foto: false } }), '', faiPdf)
  await solo[0].faiPdf()
  ok('un adulto: una richiesta, il PDF per maggiorenni con le sue scelte', [solo.length, chiamate], [1, [['Luca', false, { tesseramento: true, foto: false }, '', '']]])
  ok('col foglio firmato in foto non si fa il PDF', m.richiesteDaMandare(adulto({}, { file: { documento: doc, modulo: F('foglio.jpg') } }), '', faiPdf)[0].faiPdf, undefined)
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
  const t = m.righeRiepilogo(figlio({}, { ancheTu: true, suo: { corsi: ['judo-adulti'], formula: 'annuale', scelte: { tesseramento: true, foto: true }, certificato: undefined } }), corsi)
  ok('ogni riga dice a quale passo manda MODIFICA o CARICA', [f.find((r) => r.cosa === 'corso')?.passo, f.find((r) => r.cosa === 'genitore')?.passo, f.find((r) => r.cosa === 'certificato')?.passo, f.find((r) => r.cosa === 'ricevuta')?.passo], ['corso', 'genitore', 'modulo', 'corso'])
  ok('il certificato del genitore rimanda al passo «anche tu»', t.filter((r) => r.cosa === 'certificato').map((r) => [!!r.suo, r.passo]), [[false, 'modulo'], [true, 'anche']])
  // Chi deve portare il certificato: lo stesso conto per il riepilogo e per l'esito.
  const lui = { corsi: ['judo-adulti'], formula: 'annuale', scelte: { tesseramento: true, foto: true } }
  ok('certificato: l’adulto che non l’ha caricato', m.certificatiMancanti(adulto(), corsi), ['chi'])
  ok('certificato: caricato, nessuno lo porta', m.certificatiMancanti(adulto({}, { file: { documento: F('d.jpg'), certificato: F('c.pdf') } }), corsi), [])
  ok('certificato: bambino e genitore mancano tutti e due', m.certificatiMancanti(figlio({}, { ancheTu: true, suo: lui }), corsi), ['chi', 'genitore'])
  ok('certificato: solo quello del genitore caricato', m.certificatiMancanti(figlio({}, { ancheTu: true, suo: { ...lui, certificato: F('c.pdf') } }), corsi), ['chi'])
  ok('certificato: senza «anche tu» il genitore non conta', m.certificatiMancanti(figlio(), corsi), ['chi'])
  ok('anche tu: il certificato è chiesto a tutti e due, la ricevuta una volta sola', [daCaricare(t).filter((x) => x === 'certificato').length, daCaricare(t).filter((x) => x === 'ricevuta').length], [2, 1])
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
  ok('bambino, passo 3: i corsi prima della domanda «anche te?»', chiavi(vuoto('figlio'), 3), ['CORSO', 'SCEGLI: ANCHE TE?'])
  ok('adulto, passo 3 (il modulo): tesseramento, foto, firma, regolamento, privacy, carta d’identità', chiavi({ ...vuoto('adulto'), risposte: { ...vuoto('adulto').risposte, regolamento: false } }, 3), [
    'TESSERAMENTO', 'FOTO', 'FIRMA', 'REGOLAMENTO', 'INFORMATIVA PRIVACY', 'CARTA D\'IDENTITÀ',
  ])
  ok('adulto, passo 3: il focus va alla prima casella, non alla carta d’identità', m.primoDaCorreggere(vuoto('adulto'), 3), 'tesseramento')
  ok('bambino, passo 4 (il modulo): dove è nato il genitore prima della firma', chiavi(figlio({}, { scelte: {}, tratti: 0, file: {}, privacy: false, natoAGenitore: '' }), 4), ['TESSERAMENTO', 'FOTO', 'DOVE È NATO IL GENITORE', 'FIRMA', 'INFORMATIVA PRIVACY', 'CARTA D\'IDENTITÀ'])
  ok('anche tu, passo 5: corso, tesseramento, foto', chiavi({ ...vuoto('figlio'), ancheTu: true, suo: { corsi: [], formula: 'trimestre', scelte: {} } }, 5), ['CORSO', 'TESSERAMENTO', 'FOTO'])
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

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
