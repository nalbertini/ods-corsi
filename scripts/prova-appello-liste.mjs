// ---------------------------------------------------------------------------
// Le prove, senza browser: le tre liste dell'appello della segreteria
// (DA SEGNARE, PRESENTI, ASSENTI) e i tocchi che spostano una persona.
//
//   node scripts/prova-appello-liste.mjs
//
// Una lista alla volta, un tocco sul nome rimette in DA SEGNARE, il giustificato
// sta tra gli assenti, le prove restano fuori da liste e conti. L'ordine in
// ogni lista è sempre quello dell'elenco ricevuto (cognome, nome), mai quello
// dei tocchi.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/appelloListe'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const r = (id, cognome, nome, stato = null, prova) => ({ id, cognome, nome, stato, ...(prova ? { prova } : {}) })
const ids = (righe) => righe.map((x) => x.id)
const statoDi = (elenco, id) => elenco.find((x) => x.id === id)?.stato

// Elenco misto in ordine di cognome, con apostrofi e accenti, un giustificato e una prova.
const misto = [
  r('1', "D'Amico", 'Maria', 'assente'),
  r('2', 'De Luca', 'Nicolò', null),
  r('3', 'Neri', 'Ada', 'giustificato'),
  r('4', 'Prova', 'Pia', 'presente', true),
  r('5', 'Rossi', 'Mario', 'presente'),
  r('6', 'Verdi', 'Anna', null),
  r('7', 'Zeta', 'Zoe', 'presente'),
]

console.log('Le liste')
ok('LISTE: tre, in questo ordine', m.LISTE, ['da_segnare', 'presenti', 'assenti'])
ok('listaDi: non segnato → da segnare', m.listaDi(null), 'da_segnare')
ok('listaDi: presente → presenti', m.listaDi('presente'), 'presenti')
ok('listaDi: assente → assenti', m.listaDi('assente'), 'assenti')
ok('listaDi: giustificato → assenti', m.listaDi('giustificato'), 'assenti')

const parti = m.dividiElenco(misto)
ok('dividiElenco: da segnare', ids(parti.da_segnare), ['2', '6'])
ok('dividiElenco: presenti, senza la prova', ids(parti.presenti), ['5', '7'])
ok('dividiElenco: assenti, col giustificato', ids(parti.assenti), ['1', '3'])
ok('le prove non compaiono in nessuna lista', m.LISTE.flatMap((l) => ids(parti[l])).includes('4'), false)
ok('contiListe: elenco misto', m.contiListe(misto), { da_segnare: 2, presenti: 2, assenti: 2 })

// Invariante: la somma dei conti = iscritti non prova, ognuno in una sola lista.
const casi = {
  misto,
  vuoto: [],
  'solo prove': [r('a', 'Uno', 'A', null, true), r('b', 'Due', 'B', 'presente', true)],
  'tutti non segnati': [r('a', 'Uno', 'A'), r('b', 'Due', 'B')],
  'tutti giustificati': [r('a', 'Uno', 'A', 'giustificato'), r('b', 'Due', 'B', 'giustificato')],
}
for (const [nome, elenco] of Object.entries(casi)) {
  const iscritti = elenco.filter((x) => !x.prova).map((x) => x.id)
  const conti = m.contiListe(elenco)
  const p = m.dividiElenco(elenco)
  ok(`invariante (${nome}): la somma dei conti è il numero di iscritti`, conti.da_segnare + conti.presenti + conti.assenti, iscritti.length)
  ok(`invariante (${nome}): ogni iscritto è in una sola lista`, m.LISTE.flatMap((l) => ids(p[l])).sort(), [...iscritti].sort())
  ok(`invariante (${nome}): i conti sono le lunghezze delle liste`, m.LISTE.map((l) => conti[l]), m.LISTE.map((l) => p[l].length))
}
ok('elenco vuoto: conti a zero', m.contiListe([]), { da_segnare: 0, presenti: 0, assenti: 0 })
ok('solo prove: conti a zero', m.contiListe(casi['solo prove']), { da_segnare: 0, presenti: 0, assenti: 0 })

console.log('Titoli, messaggi, parole')
ok('titolo: DA SEGNARE', m.titoloLista('da_segnare', 9), 'DA SEGNARE 9')
ok('titolo: PRESENTI', m.titoloLista('presenti', 3), 'PRESENTI 3')
ok('titolo: ASSENTI', m.titoloLista('assenti', 1), 'ASSENTI 1')
ok('titolo: anche a zero', m.titoloLista('assenti', 0), 'ASSENTI 0')
ok('messaggio vuoto: da segnare', m.messaggioVuoto('da_segnare'), 'Tutti segnati ✓')
ok('messaggio vuoto: presenti', m.messaggioVuoto('presenti'), 'Nessun presente')
ok('messaggio vuoto: assenti', m.messaggioVuoto('assenti'), 'Nessun assente')
ok('parola: presente', m.parolaDiStato('presente'), 'PRESENTE')
ok('parola: assente', m.parolaDiStato('assente'), 'ASSENTE')
ok('parola: il giustificato si dice GIUSTIFICATO', m.parolaDiStato('giustificato'), 'GIUSTIFICATO')
ok('parola: non segnato', m.parolaDiStato(null), 'NON SEGNATO')
ok('tocco: presente', m.statoDaTocco('presente'), 'presente')
ok('tocco: assente', m.statoDaTocco('assente'), 'assente')
ok('tocco: rimetti → non segnato', m.statoDaTocco('rimetti'), null)

console.log('Il tasto da cui si parte')
ok('ci sono non segnati: DA SEGNARE', m.tastoIniziale(misto), 'da_segnare')
ok('tutti segnati con presenti: PRESENTI', m.tastoIniziale([r('1', 'A', 'a', 'presente'), r('2', 'B', 'b', 'assente')]), 'presenti')
ok('tutti assenti: ASSENTI', m.tastoIniziale([r('1', 'A', 'a', 'assente'), r('2', 'B', 'b', 'giustificato')]), 'assenti')
ok('elenco vuoto: DA SEGNARE', m.tastoIniziale([]), 'da_segnare')
ok('solo prove non segnate: DA SEGNARE', m.tastoIniziale(casi['solo prove']), 'da_segnare')
ok('una prova non segnata non tiene aperto DA SEGNARE', m.tastoIniziale([r('1', 'A', 'a', 'presente'), r('2', 'B', 'b', null, true)]), 'presenti')

console.log('Il tocco')
// Il tocco ricevuto non va mai modificato: la schermata lo confronta col precedente.
const copia = JSON.stringify(misto)
const t = m.dopoIlTocco(misto, '2', 'presente', 'da_segnare')
ok('non muta l\'elenco ricevuto', JSON.stringify(misto), copia)
ok('nel mezzo: la persona diventa presente', statoDi(t.elenco, '2'), 'presente')
ok('nel mezzo: gli altri sono invariati', t.elenco.filter((x) => x.id !== '2'), misto.filter((x) => x.id !== '2'))
ok('nel mezzo: stesso ordine', ids(t.elenco), ids(misto))
ok('nel mezzo: il fuoco va alla successiva', t.prossimoFuoco, '6')
ok('assente: la persona diventa assente', statoDi(m.dopoIlTocco(misto, '6', 'assente', 'da_segnare').elenco, '6'), 'assente')
ok('sull\'ultima: il fuoco va alla precedente', m.dopoIlTocco(misto, '6', 'presente', 'da_segnare').prossimoFuoco, '2')

const unica = [r('1', 'A', 'a'), r('2', 'B', 'b', 'presente')]
ok('sull\'unica riga: lista vuota, nessun fuoco', m.dopoIlTocco(unica, '1', 'presente', 'da_segnare').prossimoFuoco, null)
ok('id che non esiste: nessun fuoco', m.dopoIlTocco(misto, 'xx', 'presente', 'da_segnare').prossimoFuoco, null)
ok('id che non esiste: elenco com\'era', m.dopoIlTocco(misto, 'xx', 'presente', 'da_segnare').elenco, misto)

const inP = m.dopoIlTocco(misto, '5', 'rimetti', 'presenti')
ok('PRESENTI, rimetti: torna non segnato', statoDi(inP.elenco, '5'), null)
ok('PRESENTI, rimetti sulla prima: il fuoco va alla successiva', inP.prossimoFuoco, '7')
ok('PRESENTI, rimetti sull\'ultima: il fuoco va alla precedente', m.dopoIlTocco(misto, '7', 'rimetti', 'presenti').prossimoFuoco, '5')
ok('PRESENTI, rimetti: stesso ordine', ids(inP.elenco), ids(misto))
ok('ASSENTI, rimetti il giustificato: torna non segnato', statoDi(m.dopoIlTocco(misto, '3', 'rimetti', 'assenti').elenco, '3'), null)
ok('ASSENTI, rimetti sull\'ultima: il fuoco va alla precedente', m.dopoIlTocco(misto, '3', 'rimetti', 'assenti').prossimoFuoco, '1')
const conProva = [r('1', 'A', 'a', 'presente'), r('2', 'B', 'b', 'presente', true), r('3', 'C', 'c', 'presente')]
ok('il fuoco salta le prove', m.dopoIlTocco(conProva, '1', 'rimetti', 'presenti').prossimoFuoco, '3')
const tre = [r('1', 'A', 'a'), r('2', 'B', 'b'), r('3', 'C', 'c')]
ok('davvero nel mezzo: il fuoco va alla successiva', m.dopoIlTocco(tre, '2', 'presente', 'da_segnare').prossimoFuoco, '3')

console.log('L\'ordine dopo gli spostamenti')
// D'Amico, De Luca, Nicolò: l'ordine è quello ricevuto, anche se li si tocca al contrario.
const nomi = [r('1', "D'Amico", 'Maria'), r('2', 'De Luca', 'Nicolò'), r('3', 'Rossi', 'Nicolò'), r('4', 'Verdi', 'Anna')]
let e = nomi
for (const id of ['3', '1', '4']) e = m.dopoIlTocco(e, id, 'presente', 'da_segnare').elenco
ok('presenti: ordine ricevuto, non dei tocchi', ids(m.dividiElenco(e).presenti), ['1', '3', '4'])
ok('da segnare: resta chi non è stato toccato', ids(m.dividiElenco(e).da_segnare), ['2'])
e = m.dopoIlTocco(e, '4', 'rimetti', 'presenti').elenco
e = m.dopoIlTocco(e, '1', 'rimetti', 'presenti').elenco
ok('da segnare dopo i ritorni: ordine ricevuto', ids(m.dividiElenco(e).da_segnare), ['1', '2', '4'])
e = m.dopoIlTocco(e, '2', 'assente', 'da_segnare').elenco
e = m.dopoIlTocco(e, '1', 'assente', 'da_segnare').elenco
ok('assenti: ordine ricevuto', ids(m.dividiElenco(e).assenti), ['1', '2'])

console.log('TUTTI PRESENTI')
ok('solo i non segnati; assenti, giustificati e presenti restano', m.chiSegnaTuttiPresenti(misto), ['2', '6'])
ok('una prova non segnata compare', m.chiSegnaTuttiPresenti([r('1', 'A', 'a'), r('2', 'B', 'b', null, true), r('3', 'C', 'c', 'assente')]), ['1', '2'])
ok('tutti segnati: nessuno', m.chiSegnaTuttiPresenti([r('1', 'A', 'a', 'presente'), r('2', 'B', 'b', 'assente')]), [])
ok('elenco vuoto: nessuno', m.chiSegnaTuttiPresenti([]), [])
ok('ordine dell\'elenco', m.chiSegnaTuttiPresenti([r('1', 'Z', 'a'), r('2', 'A', 'b'), r('3', 'M', 'c')]), ['1', '2', '3'])

console.log('TUTTI PRESENTI sui dati di prova veri')
// segnaNonSegnati deve toccare solo chi non è segnato: qui la si prova contro l'archivio di prova,
// non contro un finto, perché è lì che `segnaTutti` sovrascriverebbe davvero le assenze.
{
  const memoria = new Map()
  globalThis.localStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  }
  // Area segreteria: nessun limite di finestra sulle presenze.
  globalThis.window = { location: { search: '', hash: '', pathname: '/segreteria/' }, addEventListener() {} }
  const { outputFiles: dp } = await build({
    stdin: { contents: "export { creaDatiProva } from './src/lib/datiProva'", resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'error',
    define: { 'import.meta.env': '{}' },
  })
  const dati = (await import('data:text/javascript;base64,' + Buffer.from(dp[0].text).toString('base64'))).creaDatiProva()

  // Lotta 2, mercoledì della settimana scorsa: lezione già fatta, come in prova-prove.mjs.
  const oggi = new Date()
  const lun = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7) - 7)
  const g = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const LEZIONE = `s@lotta-2@${g(new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() + 2))}@17:00`

  const leggi = async () => (await dati.dettaglio(LEZIONE)).elenco
  const base = await leggi()
  ok('la lezione ha almeno cinque iscritti per i casi misti', base.length >= 5, true)
  const [pres, ass, giu] = base.slice(0, 3).map((x) => x.id)
  const nonSegnati = base.slice(3).map((x) => x.id)
  await dati.segna(LEZIONE, pres, 'presente')
  await dati.segna(LEZIONE, ass, 'assente')
  await dati.segna(LEZIONE, giu, 'giustificato')
  const prova = await dati.aggiungiProva(LEZIONE, { nome: 'Marco', cognome: 'Nuovo' })
  await dati.segna(LEZIONE, prova.id, null)   // la prova arriva già presente: la si rimette non segnata
  const prima = await leggi()
  ok('partenza: presente, assente, giustificato', [pres, ass, giu].map((id) => statoDi(prima, id)), ['presente', 'assente', 'giustificato'])
  ok('partenza: la prova è non segnata e marcata prova', [statoDi(prima, prova.id), prima.find((x) => x.id === prova.id)?.prova], [null, true])
  ok('partenza: i non segnati sono tali', nonSegnati.map((id) => statoDi(prima, id)), nonSegnati.map(() => null))
  ok('partenza: da segnare = i non segnati (la prova non conta)', m.contiListe(prima).da_segnare, nonSegnati.length)

  // Il confronto: segnaTutti su una copia identica avrebbe cambiato l'assente. Per questo la regola serve.
  await dati.segnaTutti(LEZIONE, 'presente')
  const confronto = await leggi()
  ok('confronto: segnaTutti(presente) cambierebbe assente e giustificato', [statoDi(confronto, ass), statoDi(confronto, giu)], ['presente', 'presente'])
  await dati.segna(LEZIONE, ass, 'assente')
  await dati.segna(LEZIONE, giu, 'giustificato')
  for (const id of [...nonSegnati, prova.id]) await dati.segna(LEZIONE, id, null)

  // I segni si registrano dalla lettura: chiamate fatte, per provare che sono una per persona.
  const chiamate = []
  let tutti = 0   // segnaTutti è la rottura da cogliere: lo si conta ed esegue davvero, così la prova va in rosso invece di fermarsi
  const strato = {
    segna: (s, id, stato) => { chiamate.push(id); return dati.segna(s, id, stato) },
    segnaTutti: (s, stato) => { tutti++; return dati.segnaTutti(s, stato) },
  }
  await m.segnaNonSegnati(strato, LEZIONE, await leggi())
  const dopo = await leggi()
  ok('assente intatto', statoDi(dopo, ass), 'assente')
  ok('giustificato intatto', statoDi(dopo, giu), 'giustificato')
  ok('presente intatto', statoDi(dopo, pres), 'presente')
  ok('i non segnati ora sono presenti', nonSegnati.map((id) => statoDi(dopo, id)), nonSegnati.map(() => 'presente'))
  ok('anche la prova non segnata è presente', statoDi(dopo, prova.id), 'presente')
  ok('una scrittura per ogni non segnato, prova compresa', chiamate.sort(), [...nonSegnati, prova.id].sort())
  ok('mai segnaTutti', tutti, 0)
  ok('da segnare a zero', m.contiListe(dopo).da_segnare, 0)
}

console.log('L\'annuncio per chi non vede lo schermo')
const rossi = r('5', 'Rossi', 'Mario')
ok('presente, restano 8', m.annuncio(rossi, 'presente', 8), 'Rossi Mario: presente. Restano 8 da segnare.')
ok('assente, restano 2', m.annuncio(rossi, 'assente', 2), 'Rossi Mario: assente. Restano 2 da segnare.')
ok('resta 1 (singolare)', m.annuncio(rossi, 'presente', 1), 'Rossi Mario: presente. Resta 1 da segnare.')
ok('zero: tutti segnati', m.annuncio(rossi, 'presente', 0), 'Rossi Mario: presente. Tutti segnati.')
ok('rimetti, restano 3', m.annuncio(rossi, 'rimetti', 3), 'Rossi Mario: da segnare. Restano 3 da segnare.')
ok('rimetti, resta 1', m.annuncio(rossi, 'rimetti', 1), 'Rossi Mario: da segnare. Resta 1 da segnare.')
ok('accenti e apostrofi nel nome', m.annuncio(r('9', "D'Amico", 'Nicolò'), 'assente', 0), "D'Amico Nicolò: assente. Tutti segnati.")

console.log('\nTogliere una giustificazione chiede conferma')
{
  const riga = (stato) => ({ id: 'x', nome: 'Ludovica', cognome: 'Romano', stato })
  ok('rimettere da segnare un giustificato chiede conferma', m.serveConferma(riga('giustificato'), 'rimetti'), true)
  ok('rimettere un presente o un assente no', [m.serveConferma(riga('presente'), 'rimetti'), m.serveConferma(riga('assente'), 'rimetti')], [false, false])
  ok('segnare presente o assente un giustificato no (decide chi tocca ✓ o ✕)', [m.serveConferma(riga('giustificato'), 'presente'), m.serveConferma(riga('giustificato'), 'assente')], [false, false])
  ok('un non segnato no', m.serveConferma(riga(null), 'presente'), false)
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
