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
      "export { corsiPerEta, LISTINO_PREDEFINITO } from './src/lib/listino'",
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
  const ADULTO = ['I TUOI DATI', 'SCEGLI IL CORSO', 'IL MODULO E LA FIRMA', 'I DOCUMENTI E IL PAGAMENTO', 'CONTROLLA E INVIA']
  const FIGLIO = ['IL BAMBINO', 'IL GENITORE CHE FIRMA', 'SCEGLI IL CORSO', 'IL MODULO E LA FIRMA', 'I DOCUMENTI E IL PAGAMENTO', 'CONTROLLA E INVIA']
  ok('adulto: cinque passi', m.passiDi('adulto', false), ADULTO)
  ok('figlio: sei passi', m.passiDi('figlio', false), FIGLIO)
  ok('figlio e anche tu: sette passi', m.passiDi('figlio', true), [...FIGLIO.slice(0, 5), 'ANCHE TU: POCHE COSE', 'CONTROLLA E INVIA'])
  // In famiglia i dati del secondo adulto non sono «tuoi»: il titolo dice di chi sono.
  const conNome = (nome) => ({ ...m.nuovoStato('adulto'), risposte: { ...m.nuovoStato('adulto').risposte, nome } })
  ok('chi compila: I TUOI DATI', m.nomiDeiPassi(conNome('Paolo'), 0)[0], 'I TUOI DATI')
  ok('il secondo adulto, col nome: I DATI DI MARIA', m.nomiDeiPassi(conNome('maria'), 1)[0], 'I DATI DI MARIA')
  ok('il secondo adulto, senza nome: I DATI DI ADULTO 2', m.nomiDeiPassi(conNome(''), 1)[0], 'I DATI DI ADULTO 2')
  ok('gli altri passi non cambiano', m.nomiDeiPassi(conNome('Maria'), 1).slice(1), ADULTO.slice(1))
  ok('un bambino aggiunto: come sempre', m.nomiDeiPassi(m.nuovoStato('figlio'), 2), FIGLIO)
  ok('un adulto non ha un «anche tu»', m.passiDi('adulto', true), ADULTO)
  // Cosa si fa in ogni passo lo dice la lib: la schermata non ripete l'ordine.
  ok('tipi: adulto', m.tipiDiPassi('adulto', false), ['dati', 'corso', 'modulo', 'documenti', 'riepilogo'])
  ok('tipi: figlio', m.tipiDiPassi('figlio', false), ['dati', 'genitore', 'corso', 'modulo', 'documenti', 'riepilogo'])
  ok('tipi: figlio e anche tu', m.tipiDiPassi('figlio', true), ['dati', 'genitore', 'corso', 'modulo', 'documenti', 'anche', 'riepilogo'])
  ok('tipi: un adulto non ha un «anche tu»', m.tipiDiPassi('adulto', true), ['dati', 'corso', 'modulo', 'documenti', 'riepilogo'])
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
  ok('passo 4 (i documenti): manca il documento', nomi(adulto({}, { file: {} }), 4), ["CARTA D'IDENTITÀ"])
  ok('passo 3 (il modulo): la carta d’identità non lo ferma più', nomi(adulto({}, { file: {} }), 3), [])
  ok('passo 3: manca la privacy', nomi(adulto({}, { privacy: false }), 3), ['INFORMATIVA PRIVACY'])
  ok('passo 3: manca il regolamento', nomi(adulto({ regolamento: false }), 3), ['REGOLAMENTO'])
  ok('passo 3: nessuna firma né caselle', nomi(adulto({}, { tratti: 0, scelte: {} }), 3), ['FIRMA', 'FOTO', 'TESSERAMENTO'])
  ok('passo 3: col foglio firmato non serve la firma', nomi(adulto({}, { tratti: 0, scelte: {}, file: { documento: F('d.jpg'), modulo: F('m.jpg') } }), 3), [])
  ok('il retro, il certificato e la ricevuta non fermano (modulo e documenti)', [nomi(adulto(), 3), nomi(adulto(), 4)], [[], []])
  ok('i documenti: a posto con la sola carta', nomi(adulto({}, { tratti: 0, scelte: {}, privacy: false }), 4), [])
  ok('l’ultimo passo rimette insieme tutto: a posto', nomi(adulto(), 5), [])
  ok('l’ultimo passo rimette insieme tutto: manca un nome', nomi(adulto({ nome: '' }), 5), ['NOME'])
  ok('l’ultimo passo rimette insieme tutto: modulo e documenti, senza doppioni', nomi(adulto({}, { file: {}, privacy: false }), 5), ["CARTA D'IDENTITÀ", 'INFORMATIVA PRIVACY'])
  ok('il passo del corso non chiede più il pagamento: la ricevuta non manca mai', nomi(adulto(), 2), [])

  ok('figlio, passo 1 a posto', nomi(figlio(), 1), [])
  ok('figlio, passo 2: il genitore non c’è', nomi(figlio({ genitoreNome: '', genitoreCodiceFiscale: '' }), 2), ['CODICE FISCALE DEL GENITORE', 'NOME DEL GENITORE'])
  ok('figlio, passo 2: contatti a posto', nomi(figlio(), 2), [])
  ok('figlio, passo 3: «anche te?» senza risposta', nomi(figlio({}, { ancheTu: undefined }), 3), ['SCEGLI: ANCHE TE?'])
  ok('figlio, passo 3: risposto no, a posto', nomi(figlio(), 3), [])
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
  ok('ricontrollo all’invio: l’ultimo passo lo vede', nomi(conCf(CF_MATTEO), 5).includes('CODICE FISCALE'), true)
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
  for (let p = 1; p <= 6; p++) m.mancaNelPasso(s, p)
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
    const lui = m.richiestaDelGenitore(bambino, { corsi: ['judo-adulti'], formula: 'annuale', natoA: 'TORINO (TO)' })
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

  // I corsi alla stessa ora ora si contano dal calendario: le prove sono in 13b.

  const bambino = m.risposteDaiPassi(figlio())
  const lui = m.richiestaDelGenitore(bambino, { corsi: ['judo-adulti'], formula: 'trimestre', natoA: 'TORINO (TO)' })
  ok('la richiesta del genitore: chi è', [lui.nome, lui.cognome, lui.codiceFiscale, lui.natoIl, lui.natoA], ['Paola', 'Rossi', CF_PAOLA, '1980-01-01', 'TORINO (TO)'])
  ok('la richiesta del genitore: residenza e contatti del foglio', [lui.indirizzo, lui.cap, lui.comune, lui.email, lui.telefono], ['Via Roma 1', '10093', 'Collegno', 'paola@esempio.it', '347 111 2233'])
  ok('la richiesta del genitore: corso e formula sono suoi', [lui.corsi, lui.formula, lui.regolamento], [['judo-adulti'], 'trimestre', true])
  ok('il genitore è un adulto: nessun genitore*', [lui.genitoreNome, lui.genitoreCognome, lui.genitoreCodiceFiscale].map((x) => x || ''), ['', '', ''])
  ok('la richiesta del genitore passa i controlli di oggi', m.controlla(lui), null)

  // Il conto è uno solo: il riepilogo dice le stesse cifre della stima a mano.
  const conGenitore = figlio({}, { ancheTu: true, suo: { corsi: ['judo-adulti'], formula: 'annuale', scelte: {} } })
  const delRiepilogo = m.contoDelloStato(conGenitore, corsi, listino, giorno)
  ok('il conto dallo stato: stesse cifre della stima a mano', [delRiepilogo.totale, delRiepilogo.sconto], [annuali.totale, annuali.sconto])
  ok('senza genitore non c’è un conto di famiglia', m.contoDelloStato(figlio(), corsi, listino, giorno), undefined)
  ok('il genitore sceglie un’altra formula: nel riepilogo conta la sua', m.contoDelloStato(figlio({}, { ancheTu: true, suo: { corsi: ['judo-adulti'], formula: 'trimestre', scelte: {} } }), corsi, listino, giorno)?.sconto, undefined)

  const grandi = { ...listino, corsi: listino.corsi.map((v, i) => (i === 0 ? { ...v, etaMinima: 16 } : v)) }
  ok('stessa ora: i corsi per grandi nascosti arrivano alla schermata', m.corsiPerEtaConStessaOra(corsi, grandi, '2016-04-12', [], []).nascosti.length, 1)

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
  ok('stessaOra: gli stessi corsi di corsiParalleli', ids(ep.stessaOra), ids(solo))
  ok('stessaOra: tolti dagli adatti', ep.adatti.map((c) => c.id), perEta.adatti.filter((c) => !ids(solo).includes(c.id)).map((c) => c.id))
  // Dai senza anni escono solo quelli alla stessa ora e quelli del figlio: il genitore li vede già, o non sono per lui.
  ok('senza anni: tolti quelli alla stessa ora e quelli del figlio', ep.senzaAnni.map((c) => c.id), perEta.senzaAnni.map((c) => c.id).filter((id) => !ids(solo).includes(id) && id !== 'judo-3'))
  ok('altri: come corsiPerEta, senza i corsi del figlio', ep.altri.map((c) => c.id), perEta.altri.map((c) => c.id).filter((id) => id !== 'judo-3'))
  ok('nascosti come corsiPerEta', ep.nascosti, perEta.nascosti)
  ok('riga, giorni in parte: «stessa ora il lunedì» e la riga del listino', riga('aikido-3'), `stessa ora il lunedì · ${rigaListino('aikido-3')}`)
  ok('riga, tre giorni: «il lunedì, il mercoledì e il venerdì»', riga('lotta-3'), `stessa ora il lunedì, il mercoledì e il venerdì · ${rigaListino('lotta-3')}`)
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
  ok('due giorni in parte: «il lunedì e il giovedì», poi l’orario del calendario', riga3('pilates'), 'stessa ora il lunedì e il giovedì · lunedì, giovedì e sabato 18.00-19.00')
  ok('il corso coi giorni in parte viene dopo quelli con tutti i giorni', ids(ep3.stessaOra).slice(-1), ['pilates'])

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
  ok('senza anni: tolti quelli alla stessa ora e quelli del figlio', ag.senzaAnni.map((c) => c.id), perEta.senzaAnni.map((c) => c.id).filter((id) => !ids(ag.stessaOra).includes(id) && id !== 'judo-agonisti'))
  // Il listino non dice per che anni è Psicomotricità («3-4-5 anni» scritto): resta dov'è, non si propone e basta.
  ok('Psicomotricità resta nei senza anni, non negli altri', [ag.senzaAnni.some((c) => c.id === 'psicomotricita'), ag.altri.some((c) => c.id === 'psicomotricita')], [true, false])
  ok('il corso del figlio non è né nei senza anni né alla stessa ora', [ag.senzaAnni.some((c) => c.id === 'judo-agonisti'), ag.stessaOra.some((c) => c.id === 'judo-agonisti')], [false, false])

  // Il riquadro «Ti iscrivi anche tu?»: il titolo dice cosa c'è alla stessa ora.
  const frase = (nome, del, par) => m.fraseAncheTu(nome, del, par.map((n) => ({ nome: n })))
  ok('nessun corso alla stessa ora: la domanda e basta', frase('Luca', 'Judo 2', []).titolo, 'Ti iscrivi anche tu?')
  const uno = frase('Luca', 'Judo 2', ['Pesistica 1'])
  ok('un corso: «Mentre Luca fa Judo 2, tu puoi fare Pesistica 1»', uno.titolo, 'Mentre Luca fa Judo 2, tu puoi fare Pesistica 1')
  ok('un corso: il dettaglio lo dice per la sua età e alla stessa ora', uno.dettaglio.startsWith('Pesistica 1 è per la tua età, alla stessa ora di Luca.'), true)
  const coppia = frase('Luca', 'Judo 2', ['Pesistica 1', 'Lotta 3'])
  ok('due corsi: «tu puoi fare A o B»', coppia.titolo, 'Mentre Luca fa Judo 2, tu puoi fare Pesistica 1 o Lotta 3')
  ok('due corsi: il dettaglio al plurale', coppia.dettaglio.startsWith('Sono per la tua età, alla stessa ora di Luca.'), true)
  ok('tre o più: si contano', frase('Manuela', 'Judo 3', ['a', 'b', 'c', 'd', 'e', 'f']).titolo, 'Mentre Manuela è in palestra, ci sono 6 corsi per te alla stessa ora')

  // R7: ISCRIVO ANCHE ME con una sola proposta la spunta già.
  const P3 = { id: 'prep-atletica-3' }
  const dopo = (suo, par) => m.suoDopoIscrivoAncheMe(suo, par)
  const essenziale = (x) => [x.corsi, x.formula, x.scelte]
  ok('nessuna proposta: il foglio del genitore vuoto', essenziale(dopo(undefined, [])), [[], 'trimestre', {}])
  ok('una proposta: già spuntata', essenziale(dopo(undefined, [P3])), [['prep-atletica-3'], 'trimestre', {}])
  ok('due proposte: non si sceglie per lui', essenziale(dopo(undefined, [P3, { id: 'pesi-2' }])), [[], 'trimestre', {}])
  const giaScelto = { corsi: ['judo-adulti'], formula: 'annuale', scelte: { foto: true } }
  ok('una proposta ma un corso già scelto: non lo tocca', essenziale(dopo(giaScelto, [P3])), [['judo-adulti'], 'annuale', { foto: true }])
  ok('una proposta, il suo foglio già aperto ma senza corsi: la spunta e tiene il resto', essenziale(dopo({ corsi: [], formula: 'annuale', scelte: { foto: false } }, [P3])), [['prep-atletica-3'], 'annuale', { foto: false }])

  // R9: il figlio cambia corso dopo che il genitore ha scelto.
  const scegli = (suo, id, par) => m.scegliSuoCorso(suo, id, par)
  const vuoto = { corsi: [], formula: 'trimestre', scelte: {} }
  const s1 = scegli(vuoto, 'prep-atletica-3', solo)
  ok('sceglie Preparazione atletica 3 mentre è alla stessa ora: segnato', [s1.corsi, s1.allaStessaOra], [['prep-atletica-3'], ['prep-atletica-3']])
  const s2 = scegli(s1, 'judo-adulti', solo)
  ok('sceglie Judo adulti, che non è alla stessa ora: non segnato', [s2.corsi, s2.allaStessaOra], [['prep-atletica-3', 'judo-adulti'], ['prep-atletica-3']])
  ok('finché i corsi del figlio restano, niente da dire', m.nonPiuAllaStessaOra(s2, solo), [])
  const senzaJudo3 = paralleli([])
  ok('il figlio toglie Judo 3: Preparazione atletica 3 resta scelta', s2.corsi, ['prep-atletica-3', 'judo-adulti'])
  ok('il figlio toglie Judo 3: Preparazione atletica 3 non è più alla stessa ora', m.nonPiuAllaStessaOra(s2, senzaJudo3), ['prep-atletica-3'])
  ok('un corso scelto fuori dai paralleli non compare mai', m.nonPiuAllaStessaOra(s2, senzaJudo3).includes('judo-adulti'), false)
  const s3 = scegli(s2, 'prep-atletica-3', solo)
  ok('togliendolo, esce dai corsi e dai segnati', [s3.corsi, (s3.allaStessaOra ?? []).includes('prep-atletica-3')], [['judo-adulti'], false])

  // L'avviso quando il figlio cambia corso: i nomi dei corsi del genitore non più alla stessa ora.
  ok('nessun corso: nessun avviso', m.fraseNonPiuAllaStessaOra([], 'Manuela'), undefined)
  ok('un corso: «… non è più alla stessa ora di Manuela.»', m.fraseNonPiuAllaStessaOra(['Preparazione atletica 3'], 'Manuela'), 'Preparazione atletica 3 non è più alla stessa ora di Manuela.')
  ok('due corsi: «A e B non sono più…»', m.fraseNonPiuAllaStessaOra(['Preparazione atletica 3', 'Pesistica 2'], 'Manuela'), 'Preparazione atletica 3 e Pesistica 2 non sono più alla stessa ora di Manuela.')

  // Il corso del genitore si sceglie al passo del corso, subito; «Anche tu» chiede solo tesseramento e foto.
  const famiglia = (suo) => figlio({}, { ancheTu: true, suo })
  const chiavi = (stato, passo) => m.mancanti(stato, passo).map((p) => [p.chiave, p.nome])
  ok('passo 3, anche tu senza il suo corso: IL TUO CORSO', chiavi(famiglia({ corsi: [], formula: 'trimestre', scelte: { tesseramento: true, foto: true } }), 3), [['suoCorsi', 'IL TUO CORSO']])
  ok('passo 3, anche tu senza ancora un foglio suo: IL TUO CORSO', chiavi(famiglia(undefined), 3), [['suoCorsi', 'IL TUO CORSO']])
  ok('passo 3, AVANTI lo conta come CORSO', m.mancaNelPasso(famiglia({ corsi: [], formula: 'trimestre', scelte: {} }), 3), ['CORSO'])
  ok('passo 3, col suo corso scelto: niente', chiavi(famiglia({ corsi: ['prep-atletica-3'], formula: 'trimestre', scelte: {} }), 3), [])
  ok('passo 3, senza «anche tu»: il suo corso non si chiede', chiavi(figlio(), 3), [])
  ok('passo 3, «anche tu» non ancora risposto: il suo corso non si chiede', chiavi(figlio({}, { ancheTu: undefined }), 3).map(([k]) => k), ['ancheTu'])
  ok('passo «anche tu» (6): tesseramento e foto, il corso no', chiavi(famiglia({ corsi: [], formula: 'trimestre', scelte: {} }), 6), [['suoTesseramento', 'TESSERAMENTO DEL GENITORE'], ['suoFoto', 'FOTO DEL GENITORE']])
  ok('ultimo passo: il suo corso c’è ancora, una volta', chiavi(famiglia({ corsi: [], formula: 'trimestre', scelte: { tesseramento: true, foto: true } }), 7), [['suoCorsi', 'IL TUO CORSO']])
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
  ok('ogni riga dice a quale passo manda MODIFICA o CARICA', [f.find((r) => r.cosa === 'corso')?.passo, f.find((r) => r.cosa === 'genitore')?.passo, f.find((r) => r.cosa === 'certificato')?.passo, f.find((r) => r.cosa === 'ricevuta')?.passo], ['corso', 'genitore', 'documenti', 'documenti'])
  ok('il certificato del genitore rimanda al passo «anche tu»', t.filter((r) => r.cosa === 'certificato').map((r) => [!!r.suo, r.passo]), [[false, 'documenti'], [true, 'anche']])
  ok('la riga «Carta d’identità» manda ai documenti, quella «Firma» al modulo', (m.passoDelRiepilogo ? [m.passoDelRiepilogo('carta'), m.passoDelRiepilogo('firma')] : 'passoDelRiepilogo non c’è'), ['documenti', 'modulo'])
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
  ok('adulto, passo 3 (il modulo): tesseramento, foto, firma, regolamento, privacy', chiavi({ ...vuoto('adulto'), risposte: { ...vuoto('adulto').risposte, regolamento: false } }, 3), [
    'TESSERAMENTO', 'FOTO', 'FIRMA', 'REGOLAMENTO', 'INFORMATIVA PRIVACY',
  ])
  ok('adulto, passo 4 (i documenti): la carta d’identità', chiavi(vuoto('adulto'), 4), ['CARTA D\'IDENTITÀ'])
  ok('adulto, l’ultimo passo: prima il modulo, poi i documenti', chiavi({ ...vuoto('adulto'), risposte: { ...vuoto('adulto').risposte, regolamento: false } }, 5).slice(-6), [
    'TESSERAMENTO', 'FOTO', 'FIRMA', 'REGOLAMENTO', 'INFORMATIVA PRIVACY', 'CARTA D\'IDENTITÀ',
  ])
  ok('adulto, passo 3: il focus va alla prima casella', m.primoDaCorreggere(vuoto('adulto'), 3), 'tesseramento')
  ok('adulto, passo 4: il focus va alla carta d’identità', m.primoDaCorreggere(vuoto('adulto'), 4), 'documento')
  ok('bambino, passo 4 (il modulo): dove è nato il genitore prima della firma', chiavi(figlio({}, { scelte: {}, tratti: 0, file: {}, privacy: false, natoAGenitore: '' }), 4), ['TESSERAMENTO', 'FOTO', 'FIRMA', 'INFORMATIVA PRIVACY'])
  ok('bambino, passo 5 (i documenti): la carta del genitore', chiavi(figlio({}, { file: {} }), 5), ['CARTA D\'IDENTITÀ'])
  ok('bambino, passo 2: «dove sei nato» sta dopo il codice del genitore, prima dei contatti', chiavi(figlio({ genitoreNome: '', genitoreCognome: '', genitoreCodiceFiscale: '', email: '', telefono: '' }, { natoAGenitore: '' }), 2), ['NOME DEL GENITORE', 'COGNOME DEL GENITORE', 'CODICE FISCALE DEL GENITORE', 'DOVE SEI NATO', 'EMAIL', 'TELEFONO'])
  ok('bambino, l’ultimo passo: «dove sei nato» una volta sola', m.mancaNelPasso(figlio({}, { natoAGenitore: '' }), 6), ['DOVE SEI NATO'])
  ok('anche tu, passo 6: tesseramento e foto (il corso si sceglie al passo 3)', chiavi({ ...vuoto('figlio'), ancheTu: true, suo: { corsi: [], formula: 'trimestre', scelte: {} } }, 6), ['TESSERAMENTO', 'FOTO'])
}

// ---------------------------------------------------------------------------
console.log('\n16b. le parole per il genitore, nel flusso del figlio')
{
  const t = (chi, tipo, nome) => m.testoFile(chi, tipo, nome)
  const adultoDoc = m.FILE.find((f) => f.tipo === 'documento')
  ok('figlio: la carta d’identità è del genitore', t('figlio', 'documento', 'Matteo').etichetta, 'LA TUA CARTA D’IDENTITÀ')
  ok('figlio: il fronte lo firma il genitore', t('figlio', 'documento', 'Matteo').dettaglio, 'Il fronte. Firmi tu, genitore: serve la tua, non quella di Matteo.')
  // «di il bambino» non è italiano: senza nome si dice «del bambino».
  ok('figlio senza nome: «non quella del bambino»', t('figlio', 'documento', ' ').dettaglio, 'Il fronte. Firmi tu, genitore: serve la tua, non quella del bambino.')
  ok('figlio: il retro è della carta del genitore', t('figlio', 'documento-retro', 'Matteo').etichetta, 'IL RETRO DELLA TUA CARTA')
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
  const anche = { ...vuoto('figlio'), ancheTu: true, suo: { corsi: [], formula: 'trimestre', scelte: {} } }
  // Finché `mancanti` non c'è, ogni prova che la usa cade con ✗ invece di fermare lo script.
  const voci = (stato, passo) => (m.mancanti ? m.mancanti(stato, passo) : [])

  // La lista toccabile: nome e chiave, nell'ordine di sempre.
  ok('mancanti: stessi nomi di mancaNelPasso, stesso ordine', voci(vuoto('adulto'), 1).map((v) => v.nome), m.mancaNelPasso(vuoto('adulto'), 1))
  ok('mancanti: la prima chiave è quella del focus', voci(vuoto('adulto'), 1)[0]?.chiave, m.primoDaCorreggere(vuoto('adulto'), 1))
  ok('mancanti: a posto, nessuna voce', voci(adulto(), 1), [])
  ok('mancanti: ogni voce ha nome e chiave', voci(vuoto('adulto'), 1).length > 0 && voci(vuoto('adulto'), 1).every((v) => v.nome && v.chiave), true)
  ok('mancanti: la data di nascita ha la sua chiave', voci(vuoto('adulto'), 1).find((v) => v.nome === 'DATA DI NASCITA')?.chiave, 'natoIl')

  // «Anche tu»: all'ultimo passo il riepilogo mette insieme tutto, ma due persone non diventano una voce.
  const riepilogo = voci(anche, 7)
  ok('anche tu, ultimo passo: corso del bambino e corso del genitore sono due voci', riepilogo.filter((v) => v.chiave === 'corsi' || v.chiave === 'suoCorsi').map((v) => v.chiave), ['corsi', 'suoCorsi'])
  ok('anche tu, ultimo passo: tesseramento e foto, due volte ciascuno', riepilogo.filter((v) => /tesseramento|foto/i.test(v.chiave)).map((v) => v.chiave).sort(), ['foto', 'suoFoto', 'suoTesseramento', 'tesseramento'])
  ok('anche tu, ultimo passo: nessun nome ripetuto, si distinguono a parole', riepilogo.length > 0 && new Set(riepilogo.map((v) => v.nome)).size === riepilogo.length, true)
  ok('anche tu: il corso del genitore si chiama «IL TUO CORSO»', riepilogo.find((v) => v.chiave === 'suoCorsi')?.nome, 'IL TUO CORSO')
  ok('anche tu, passo 6: tesseramento e foto, il corso non più', m.mancaNelPasso(anche, 6), ['TESSERAMENTO', 'FOTO'])
  ok('anche tu, ultimo passo: la barra conta le persone, AVANTI i nomi', riepilogo.length > m.mancaNelPasso(anche, 7).length, true)

  // Ogni chiave porta a un id che c'è nella pagina.
  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const moduloFile = readFileSync('src/components/ModuloIscrizione.tsx', 'utf8')
  const tutte = new Map()
  for (const stato of [vuoto('adulto'), vuoto('figlio'), anche, { ...vuoto('figlio'), ancheTu: false }])
    for (let p = 1; p <= m.passiDi(stato.chi, stato.ancheTu === true).length; p++) for (const v of voci(stato, p)) tutte.set(v.chiave, v.nome)
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

// 24. Il totale sempre in vista: nel passo del corso e in quello dei documenti, dalla stessa stima del riepilogo.
{
  console.log('\n24. il totale nei passi del corso e dei documenti')
  const voce = (corso, corsoId, natiDal, natiAl, annuale, trimestre) => ({
    corso, corsoId, eta: '', orari: ['martedì 18.00'], natiDal, natiAl, prezzi: [{ saldo: annuale, annuale, trimestre }],
  })
  const listino = { quota: 50, saldoEntro: '2026-08-31', offerte: [], corsi: [voce('Judo 3', 'judo-3', 2013, 2016, 300, 120), voce('Judo adulti', 'judo-adulti', undefined, 2012, 360, 140)] }
  const corsi = [{ id: 'judo-3', nome: 'Judo 3' }, { id: 'judo-adulti', nome: 'Judo adulti' }]
  const giorno = '2026-10-06'
  // Firma attesa: totaleDelPasso(stato, passo, corsi, listino, giorno) → { righe, totale } | undefined.
  // Euro interi senza decimali («50 €»), con i centesimi la virgola («50,50 €»); le righe sono «<voce> <prezzo> €» unite da « + ».
  const t = (stato, passo, l = listino) => m.totaleDelPasso(stato, passo, corsi, l, giorno)

  ok('adulto, passo del corso: la riga e il totale', t(adulto(), 2), { righe: 'Quota 50 € + Judo adulti annuale 360 €', totale: '410 €' })
  ok('adulto, passo dei documenti: lo stesso', t(adulto(), 4), t(adulto(), 2))
  ok('con la formula trimestre: la riga dice trimestre e il prezzo cambia', t(adulto({ formula: 'trimestre' }), 2), { righe: 'Quota 50 € + Judo adulti trimestre 140 €', totale: '190 €' })
  ok('adulto: il totale è quello della stima di oggi, stessi centesimi', t(adulto(), 2)?.totale, `${m.contoFamiglia([{ chi: 'Luca', corsi: [corsi[1]], formula: 'annuale' }], giorno, listino).totale / 100} €`)
  ok('senza corso scelto: niente totale', t(adulto({ corsi: [] }), 2), undefined)
  ok('senza listino: niente totale', t(adulto(), 2, null), undefined)
  for (const passo of [1, 3, 5]) ok(`adulto, passo ${passo}: il totale non c’è`, t(adulto(), passo), undefined)

  ok('figlio, passo del corso (3): il conto del bambino', t(figlio(), 3), { righe: 'Quota 50 € + Judo 3 annuale 300 €', totale: '350 €' })
  ok('figlio, passo dei documenti (5): lo stesso', t(figlio(), 5), t(figlio(), 3))
  for (const passo of [1, 2, 4, 6]) ok(`figlio, passo ${passo}: il totale non c’è`, t(figlio(), passo), undefined)

  // Con «Anche tu» e il corso del genitore scelto, il totale sopra la barra è quello della famiglia, con lo sconto: lo stesso del riepilogo.
  const famiglia = figlio({}, { ancheTu: true, suo: { corsi: ['judo-adulti'], formula: 'annuale', scelte: {} } })
  const FAMIGLIA = { righe: 'Matteo: Quota 50 € + Judo 3 annuale 300 € · Tu: Quota 50 € + Judo adulti annuale 360 € · Sconto famiglia −60 €', totale: '700 €' }
  ok('anche tu, passo del corso (3): il conto della famiglia, con lo sconto', t(famiglia, 3), FAMIGLIA)
  // Al passo dei documenti c'è QUANTO COSTA del bambino, con la sua causale: il totale sopra la barra è quello, non due cifre diverse.
  ok('anche tu, passo dei documenti (5): il conto del bambino, come QUANTO COSTA', t(famiglia, 5), t(figlio(), 5))
  ok('anche tu: il totale è quello di contoDelloStato', t(famiglia, 3)?.totale, `${m.contoDelloStato(famiglia, corsi, listino, giorno).totale / 100} €`)
  // Lo sconto è uno solo: quello di contoDelloStato, non anche dentro le righe del bambino.
  const dueAnnuali = figlio({ corsi: ['judo-3', 'judo-adulti'] }, { ancheTu: true, suo: { corsi: ['judo-adulti'], formula: 'annuale', scelte: {} } })
  ok('anche tu, il bambino con due annuali: «Sconto» una volta sola nelle righe', (t(dueAnnuali, 3)?.righe.match(/[Ss]conto/g) ?? []).length, 1)
  ok('anche tu, il bambino con due annuali: il totale è quello di contoDelloStato', t(dueAnnuali, 3)?.totale, `${m.contoDelloStato(dueAnnuali, corsi, listino, giorno).totale / 100} €`)
  const famTrim = figlio({}, { ancheTu: true, suo: { corsi: ['judo-adulti'], formula: 'trimestre', scelte: {} } })
  ok('anche tu, il genitore a trimestre: nessuno sconto, nessuna riga di sconto', t(famTrim, 3), { righe: 'Matteo: Quota 50 € + Judo 3 annuale 300 € · Tu: Quota 50 € + Judo adulti trimestre 140 €', totale: '540 €' })
  const conPsico = [...corsi, { id: 'psico', nome: 'Psicomotricità' }]
  const famPsico = figlio({}, { ancheTu: true, suo: { corsi: ['psico'], formula: 'annuale', scelte: {} } })
  const psico = m.totaleDelPasso(famPsico, 3, conPsico, listino, giorno)
  ok('anche tu, il corso del genitore senza prezzo: lo dice la sua parte', psico?.righe?.startsWith('Matteo: Quota 50 € + Judo 3 annuale 300 € · Tu: Quota 50 € + Psicomotricità prezzo da confermare'), true)
  ok('anche tu, il corso del genitore senza prezzo: il totale è quello di contoDelloStato', psico?.totale, `${m.contoDelloStato(famPsico, conPsico, listino, giorno).totale / 100} €`)
  ok('senza «anche tu»: solo il bambino', t(figlio({}, { ancheTu: false, suo: { corsi: ['judo-adulti'], formula: 'annuale', scelte: {} } }), 3), { righe: 'Quota 50 € + Judo 3 annuale 300 €', totale: '350 €' })
  ok('anche tu: il passo «anche tu» (6) non lo mostra', t(famiglia, 6), undefined)
  // Un corso senza prezzo nel listino non vale 0: la riga lo dice, e il totale è solo quello che si sa.
  const senzaPrezzo = (l = listino) => m.totaleDelPasso(adulto({ corsi: ['psico'] }), 2, [...corsi, { id: 'psico', nome: 'Psicomotricità' }], l, giorno)
  ok('corso senza prezzo: la riga dice «prezzo da confermare»', senzaPrezzo()?.righe, 'Quota 50 € + Psicomotricità prezzo da confermare')
  ok('corso senza prezzo: il totale è la sola quota', senzaPrezzo()?.totale, '50 €')
  const senzaSuo = figlio({}, { ancheTu: true, suo: { corsi: [], formula: 'annuale', scelte: {} } })
  ok('anche tu, ma il corso del genitore non è ancora scelto: solo il bambino', t(senzaSuo, 5), { righe: 'Quota 50 € + Judo 3 annuale 300 €', totale: '350 €' })
}

// 25. La riga del riepilogo e le parole del componente: i numeri dei passi si calcolano, non si scrivono.
{
  console.log('\n25. il componente non scrive a mano i numeri dei passi')
  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const codice = pagina.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((r) => !/^\s*\/\//.test(r)).join('\n')
  const scritti = codice.match(/\b\d+\s+passi\b|\bpass[oi]\s+\d+\b|\bpassi\s+\d+\s+e\s+\d+\b/gi) ?? []
  ok('niente «N passi» né «passo N» scritti a mano', scritti, [])
  ok('la scelta iniziale conta i passi da passiDi', /passiDi\(\s*'adulto'[^)]*\)\.length/.test(codice) && /passiDi\(\s*'figlio'[^)]*\)\.length/.test(codice), true)
  const rigaCarta = codice.split('\n').find((r) => r.includes('Carta d’identità')) ?? ''
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

// 27. Il fuoco sul titolo del passo, a ogni cambio di passo (e non a ogni lettera).
{
  console.log('\n27. il fuoco va al titolo del passo')
  const ds = readFileSync('src/components/ds.tsx', 'utf8')
  const avanza = ds.slice(ds.indexOf('export function Avanzamento'), ds.indexOf('export function Avanzamento') + 1500).split(/\n}\n/)[0]
  ok('Avanzamento (ds.tsx) prende il fuoco da codice: tabIndex={-1}', avanza.includes('tabIndex={-1}'), true)
  ok('Avanzamento (ds.tsx) riceve un ref', /\bref\b/.test(avanza), true)
  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const codice = pagina.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((r) => !/^\s*\/\//.test(r)).join('\n')
  const effetto = codice.split('useEffect(').find((b) => /\.focus\(/.test(b) && /Ref\.current/.test(b) && /titolo|Titolo|avanz/i.test(b)) ?? ''
  ok('un useEffect mette a fuoco il titolo del passo', effetto !== '', true)
  ok('dipende solo da passo: non scatta a ogni lettera', /\[\s*passo\s*\]\s*\)/.test(effetto), true)
  ok('<Avanzamento> riceve il ref', /<Avanzamento[^>]*\bref=/.test(codice) || /<Avanzamento[^>]*\b(titoloRef|rif)=/.test(codice), true)
}

// 28. La riga CHIAMA sotto la testata dei passi: lo stesso numero di «Contatti».
{
  console.log('\n28. CHIAMA nel flusso')
  const pagina = readFileSync('src/components/IscrizioneAPassi.tsx', 'utf8')
  const codice = pagina.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((r) => !/^\s*\/\//.test(r)).join('\n')
  const sito = readFileSync('src/lib/sito.ts', 'utf8')
  const schermata = readFileSync('src/components/IscrizioniScreen.tsx', 'utf8')
  ok('il numero sta in lib/sito: CONTATTI.telefono e chiama', /export const CONTATTI/.test(sito) && /export const chiama/.test(sito), true)
  ok('IscrizioniScreen usa la stessa fonte (chiama)', /import \{[^}]*\bchiama\b[^}]*\} from '..\/lib\/sito'/.test(schermata), true)
  ok('il flusso importa chiama da lib/sito', /import \{[^}]*\bchiama\b[^}]*\} from '..\/lib\/sito'/.test(codice), true)
  ok('c’è un tasto CHIAMA che usa href={chiama}', /<Tasto[^>]*href=\{chiama\}[^>]*>\s*CHIAMA/.test(codice), true)
  ok('il numero non è scritto a mano nel flusso', /\btel:|\b\d{3}\s\d{3}\s\d{4}\b/.test(codice), false)
  // Sta nel flusso, sotto la testata: prima di <Avanzamento> non c'è, e non dentro <BarraPasso>.
  const dopoAvanzamento = codice.slice(codice.indexOf('<Avanzamento'))
  ok('CHIAMA viene dopo la testata <Avanzamento>', /CHIAMA/.test(dopoAvanzamento), true)
  const barra = codice.slice(codice.indexOf('<BarraPasso'), codice.indexOf('/>', codice.indexOf('<BarraPasso')))
  ok('CHIAMA non sta dentro la barra del passo', /CHIAMA/.test(barra), false)
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
  // importo: «410 €» come totaleDelPasso; con due richieste (bambino + genitore) il conto della famiglia con lo sconto (contoDelloStato).
  // senzaPrezzo: i nomi dei corsi senza prezzo nel listino («prezzo da confermare»); l'importo è quello che si sa.
  const r = (stato, l = listino, c = corsi) => { try { return m.riassuntoEsito(stato, c, l, giorno) } catch (e) { return { ERRORE: e.message } } }
  const euro = (cent) => `${cent / 100} €`

  ok('adulto, senza ricevuta: da pagare, 410 €', [r(adulto()).daPagare, r(adulto()).importo], [true, '410 €'])
  ok('l’importo è quello di totaleDelPasso', r(adulto()).importo, m.totaleDelPasso(adulto(), 2, corsi, listino, giorno).totale)
  ok('adulto, trimestre: 190 €', r(adulto({ formula: 'trimestre' })).importo, '190 €')
  ok('adulto, con la ricevuta caricata: niente da pagare', r(adulto({}, { file: { documento: F('d.jpg'), ricevuta: F('r.jpg') } })).daPagare, false)
  ok('figlio, senza ricevuta: da pagare, 350 €', [r(figlio()).daPagare, r(figlio()).importo], [true, '350 €'])
  ok('figlio, con la ricevuta: niente da pagare', r(figlio({}, { file: { documento: F('d.jpg'), ricevuta: F('r.jpg') } })).daPagare, false)

  const famiglia = figlio({}, { ancheTu: true, suo: { corsi: ['judo-adulti'], formula: 'annuale', scelte: {} } })
  const conto = m.contoDelloStato(famiglia, corsi, listino, giorno)
  ok('famiglia: l’importo è quello del conto con lo sconto, stessi centesimi', r(famiglia).importo, euro(conto.totale))
  ok('famiglia: lo sconto c’è, quindi meno della somma dei due', conto.totale < 35000 + 41000, true)
  ok('famiglia, con la ricevuta: niente da pagare', r({ ...famiglia, file: { ...famiglia.file, ricevuta: F('r.jpg') } }).daPagare, false)
  // Cosa scrive la schermata lo decide la lib: `pagamento` e `famiglia`, `conSconto` e i corsi senza prezzo anche per due richieste.
  ok('pagamento: da pagare con importo', r(adulto()).pagamento, 'importo')
  ok('pagamento: con la ricevuta', r(adulto({}, { file: { documento: F('d.jpg'), ricevuta: F('r.jpg') } })).pagamento, 'ricevuta')
  ok('pagamento: da pagare ma senza listino, l’importo non c’è', r(adulto(), null).pagamento, 'senzaImporto')
  ok('famiglia: lo dice il riassunto', [r(famiglia).famiglia, r(adulto()).famiglia, r(figlio()).famiglia], [true, false, false])
  ok('famiglia con due annuali: c’è lo sconto', r(famiglia).conSconto, true)
  const famTrimestre = figlio({}, { ancheTu: true, suo: { corsi: ['judo-adulti'], formula: 'trimestre', scelte: {} } })
  ok('famiglia con un trimestre: lo sconto non c’è', r(famTrimestre).conSconto, false)
  const conSenzaPrezzo = (l = listino) => r(famiglia, l, [...corsi, { id: 'psico', nome: 'Psicomotricità' }])
  const famPsico = figlio({}, { ancheTu: true, suo: { corsi: ['psico'], formula: 'annuale', scelte: {} } })
  ok('famiglia, corso del genitore senza prezzo: lo dice', r(famPsico, listino, [...corsi, { id: 'psico', nome: 'Psicomotricità' }]).senzaPrezzo, ['Psicomotricità'])
  void conSenzaPrezzo
  const senzaSuo = figlio({}, { ancheTu: true, suo: { corsi: [], formula: 'annuale', scelte: {} } })
  ok('famiglia, corso del genitore non scelto: come il conto dello stato', r(senzaSuo).importo, euro(m.contoDelloStato(senzaSuo, corsi, listino, giorno).totale))

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
  const conBambino = lista(() => m.aggiungiFamiliare([figlio({}, { ancheTu: undefined }), adulto()], 'figlio', 1))
  ok('un bambino in famiglia non chiede «anche te?»', [conBambino.length, conBambino.map((p) => p.ancheTu)], [3, [false, undefined, false]])
  ok('e il passo del corso non glielo chiede', conBambino.map((p) => (p.chi === 'figlio' ? m.mancaNelPasso({ ...p, risposte: { ...p.risposte, corsi: ['x'], formula: 'annuale' } }, 3).includes('SCEGLI: ANCHE TE?') : false)), [false, false, false])

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

  // Il totale sopra la barra: di tutta la famiglia, con lo sconto, nei passi del corso e dei documenti.
  const t = (persone, attivo, passo) => chiama(() => m.totaleDellaFamiglia(persone, attivo, passo, corsi, listino, giorno))
  ok('famiglia di tre, passo del corso: ognuno con la sua cifra, lo sconto a parte', t(tre, 0, 2), { righe: 'Luca 155 € + Matteo 410 € + Paola 350 € − sconto famiglia 60 €', totale: '855 €' })
  ok('lo stesso nel passo dei documenti', t(tre, 1, 4)?.totale, '855 €')
  ok('negli altri passi non c’è', [t(tre, 0, 1), t(tre, 0, 3), t(tre, 0, 5)], [undefined, undefined, undefined])
  ok('senza sconto la riga non lo nomina', t([luca, adulto({ ...dati('Paola', '1980-01-01', true), corsi: ['pilates'], formula: 'trimestre' })], 0, 2), { righe: 'Luca 155 € + Paola 170 €', totale: '325 €' })
  ok('una persona sola: com’era, il suo totale', t([matteo], 0, 2), chiama(() => m.totaleDelPasso(matteo, 2, corsi, listino, giorno)))
  // «Anche tu» (un bambino e il genitore, una persona sola nel modulo) e famiglia (più persone) non si pestano i piedi: il totale è uno solo, quello giusto per ognuno.
  const conAncheTu = figlio({ corsi: ['judo-kids'], formula: 'annuale' }, { ancheTu: true, suo: { corsi: ['judo-adulti'], formula: 'annuale', scelte: {} } })
  ok('anche tu con una persona sola nel modulo: il totale è quello della famiglia di «Anche tu», con lo sconto', t([conAncheTu], 0, 3), chiama(() => m.totaleDelPasso(conAncheTu, 3, corsi, listino, giorno)))
  ok('e vale 684 €: 50 + 280 + 50 + 360 − 56', t([conAncheTu], 0, 3)?.totale, '684 €')
  ok('l’esito con «Anche tu» e una persona sola: lo stesso conto, con lo sconto', [chiama(() => m.riassuntoEsito(conAncheTu, corsi, listino, giorno, [conAncheTu])).importo, chiama(() => m.riassuntoEsito(conAncheTu, corsi, listino, giorno, [conAncheTu])).conSconto], ['684 €', true])
  ok('aggiungere un familiare a chi non ha ancora risposto a «anche te?»: non lo chiede più, e il conto è quello della famiglia', chiama(() => m.aggiungiFamiliare([figlio({}, { ancheTu: undefined }), adulto()], 'adulto', 1)[0].ancheTu), false)

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
  ok('chi firma non è più un adulto: il bambino si ferma, e la frase dice cosa fare', chiama(() => m.fermoDellaFamiglia(luiBambino)), 'Luca non è più un adulto, e Matteo ha bisogno di un adulto che firmi: rimetti Luca come adulto, oppure chiama la segreteria.')
  ok('e i dati di chi non è più adulto non passano al bambino', lei(luiBambino, 1).risposte.genitoreNome, '')
  ok('una persona sola non si ferma mai', chiama(() => m.fermoDellaFamiglia([luca])), undefined)
  ok('un bambino senza firmatario (era un adulto che ha cambiato scelta) non si ferma', chiama(() => m.fermoDellaFamiglia([luca, m.cambiaScelta(adulto(), 'figlio', true)])), undefined)

  // Aggiungere un familiare azzera la foto del modulo di tutti: in famiglia si firma qui.
  const inFoto = adulto({}, { file: { documento: F('d.jpg'), modulo: F('foglio.jpg') } })
  const conFoto = lista(() => m.aggiungiFamiliare([inFoto], 'adulto', 0))
  ok('la foto del foglio firmato non vale più, il documento resta', [conFoto[0].file.modulo, !!conFoto[0].file.documento], [undefined, true])
  ok('e il bambino aggiunto: il foglio non c’è', conFoto[1].file.modulo, undefined)
  ok('lo stato di partenza non si tocca', !!inFoto.file.modulo, true)

  // «Anche te?» non si chiede in famiglia: una regola sola, per chi si aggiunge e per chi cambia scelta.
  ok('si cambia scelta in famiglia: un bambino non chiede «anche te?»', [chiama(() => m.cambiaScelta(luca, 'figlio', true).ancheTu), chiama(() => m.cambiaScelta(luca, 'figlio').ancheTu)], [false, undefined])
  ok('e un adulto resta com’era', chiama(() => m.cambiaScelta(figlio(), 'adulto', true).ancheTu), undefined)
  ok('un bambino che ha già risposto «anche te» non cambia aggiungendo un familiare', chiama(() => m.aggiungiFamiliare([figlio({}, { ancheTu: true }), adulto()], 'adulto', 1)[0].ancheTu), true)

  // Il foglio si firma in foto solo da soli, e solo se si è scelto così.
  ok('foto: da soli, scelta la foto', chiama(() => m.firmaInFoto(luca, true, 1)), true)
  ok('foto: non scelta', chiama(() => m.firmaInFoto(luca, false, 1)), false)
  ok('foto: in famiglia no', chiama(() => m.firmaInFoto(luca, true, 2)), false)
  ok('foto: con «Anche te» no', chiama(() => m.firmaInFoto(figlio({}, { ancheTu: true }), true, 1)), false)

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

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
