// ---------------------------------------------------------------------------
// L'importazione delle persone da CSV, senza browser (`src/lib/importa.ts`).
//
//   node scripts/prova-importa.mjs
//
// Il CSV com'è scritto (virgolette, a-capo, BOM, separatore), le colonne
// dell'intestazione e i loro ruoli, il foglio iscritti.csv (righe vuote,
// doppioni, email di un altro, corsi sconosciuti), le risposte del modulo
// Google (date, codici fiscali, nomi), e cosa resta da sistemare e perché.
// Quanto l'importazione scrive davvero sul database sta in
// `prova-email-contatto.mjs` e `prova-segreteria.mjs`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: "export * as importaLib from './src/lib/importa'; export { carattereControllo } from './src/lib/codiceFiscale'",
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

const m = await import(modulo)
const L = m.importaLib
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// Un codice fiscale giusto, col carattere di controllo calcolato.
const cfDa = (primi15) => primi15 + m.carattereControllo(primi15)
const CF_MARIO = cfDa('RSSMRA14H13H501') // Mario Rossi, 13/06/2014

console.log('Il CSV com’è scritto')
ok('virgole: due colonne', L.leggiCsv('nome,cognome\nAnna,Bianchi'), [{ nome: 'Anna', cognome: 'Bianchi' }])
ok('punto e virgola: lo stesso foglio', L.leggiCsv('nome;cognome\nAnna;Bianchi'), [{ nome: 'Anna', cognome: 'Bianchi' }])
ok('col BOM la prima colonna si chiama ancora «nome»', Object.keys(L.leggiCsv('﻿nome;cognome\nA;B')[0]), ['nome', 'cognome'])
ok('virgole dentro le virgolette restano nella cella', L.leggiCsv('nome,corso\nAnna,"Judo 2, Lotta 3"')[0].corso, 'Judo 2, Lotta 3')
ok('il separatore dentro le virgolette non divide (;)', L.leggiCsv('nome;corso\nAnna;"a;b"')[0].corso, 'a;b')
ok('virgolette doppie dentro le virgolette fanno una virgoletta', L.leggiCsv('nome,nota\nAnna,"dice ""ciao"""')[0].nota, 'dice "ciao"')
ok('a-capo dentro le virgolette restano nella cella, e la riga dopo è un’altra', L.leggiCsv('nome,nota\n"Anna","uno\ndue"\nBea,x'), [{ nome: 'Anna', nota: 'uno\ndue' }, { nome: 'Bea', nota: 'x' }])
ok('a-capo di Windows (\\r\\n) e di Mac vecchio (\\r)', L.leggiCsv('nome,x\r\nA,1\rB,2'), [{ nome: 'A', x: '1' }, { nome: 'B', x: '2' }])
ok('l’ultima riga senza a-capo in fondo si legge', L.leggiCsv('nome\nA\nB').length, 2)
ok('a-capo in fondo: nessuna riga in più', L.leggiCsv('nome\nA\n').length, 1)
ok('intestazioni senza maiuscole, accenti né spazi', Object.keys(L.leggiCsv(' Città ; NOME \nx;y')[0]), ['citta', 'nome'])
ok('spazi attorno alle celle tolti', L.leggiCsv('nome,cognome\n  Anna  ,  Bianchi ')[0], { nome: 'Anna', cognome: 'Bianchi' })
ok('una riga più corta: le celle che mancano sono vuote', L.leggiCsv('nome,cognome,email\nAnna')[0], { nome: 'Anna', cognome: '', email: '' })
ok('una cella in più oltre l’intestazione si perde', Object.keys(L.leggiCsv('nome\nA,B')[0]), ['nome'])
ok('testo vuoto: nessuna riga', L.leggiCsv(''), [])
ok('solo l’intestazione: nessuna riga', L.leggiCsv('nome,cognome'), [])
ok('accenti e apostrofi nelle celle restano come scritti', L.leggiCsv("nome;cognome\nNicolò;D’Angelo")[0], { nome: 'Nicolò', cognome: 'D’Angelo' })
ok('leggiTabella: l’intestazione resta come scritta (con maiuscole e accenti)', L.leggiTabella('Città,Nome\nx,y').testa, ['Città', 'Nome'])

console.log('\nI corsi (corsi.csv)')
const corsi = L.leggiFogli('nome;giorno;ora;sala;istruttore;capienza\nJudo 2;martedì;18.30;Sala A;Anna Verdi, Luca Neri;12\nJudo 2;gio;19:00;Sala B;;\n', null)
ok('un corso, due giorni', [corsi.corsi.length, corsi.corsi[0].orari.length], [1, 2])
ok('«martedì» e «gio» si capiscono, l’ora 18.30 diventa 18:30', corsi.corsi[0].orari.map((o) => [o.giorno, o.ora]), [[2, '18:30'], [4, '19:00']])
ok('la sala della prima riga è quella del corso, un’altra è la sala di quel giorno', [corsi.corsi[0].sala, corsi.corsi[0].orari[1].sala], ['Sala A', 'Sala B'])
ok('gli istruttori separati da virgola', corsi.corsi[0].istruttori, ['Anna Verdi', 'Luca Neri'])
ok('durata di base 60 minuti', corsi.corsi[0].orari[0].durata, 60)
ok('il giorno anche come numero (0 = domenica)', L.leggiFogli('nome;giorno;ora\nZumba;0;9:00\n', null).corsi[0].orari[0].giorno, 0)
ok('ora a una cifra riempita: 9:00 → 09:00', L.leggiFogli('nome;giorno;ora\nZumba;0;9:00\n', null).corsi[0].orari[0].ora, '09:00')
ok('lo stesso corso con maiuscole diverse è un corso solo', L.leggiFogli('nome;giorno;ora\nJudo;lun;10:00\nJUDO;mar;10:00\n', null).corsi.length, 1)
ok('lo stesso giorno e ora ripetuti non fanno un giorno in più', L.leggiFogli('nome;giorno;ora\nJudo;lun;10:00\nJudo;lun;10:00\n', null).corsi[0].orari.length, 1)
const cattivi = L.leggiFogli('nome;giorno;ora\n;lun;10:00\nJudo;boh;10:00\nJudo;lun;dieci\nJudo;7;10:00\n', null)
ok('senza nome, giorno o ora illeggibili, giorno 7: tutte saltate', cattivi.saltate.map((s) => [s.foglio, s.riga]), [['corsi.csv', 2], ['corsi.csv', 3], ['corsi.csv', 4], ['corsi.csv', 5]])
ok('il motivo dice il corso e cosa non si capisce', cattivi.saltate[1].motivo, '«Judo»: non capisco il giorno «boh»')
ok('nessun corso entra dalle righe saltate', cattivi.corsi.length, 0)
ok('riga tutta vuota: né saltata né contata come corso', L.leggiFogli('nome;giorno;ora\n;;\nJudo;lun;10:00\n', null).saltate.length, 0)

console.log('\nGli iscritti (iscritti.csv)')
const base = 'nome;cognome;email;telefono;corso\n'
const noti = ['Judo 2', 'Lotta 3']
const dif = (testo, g = noti) => L.leggiFogli(null, testo, g)
let f = dif(base + 'Anna;Bianchi;Anna@Esempio.IT;333 1;Judo 2\n')
ok('l’email va in minuscolo', f.iscritti[0].email, 'anna@esempio.it')
ok('una persona, un corso', [f.iscritti.length, f.iscritti[0].corsi], [1, ['Judo 2']])
ok('le righe lette si contano', f.righe.iscritti, 1)
f = dif(base + 'Anna;Bianchi;a@e.it;;Judo 2\nAnna;Bianchi;a@e.it;;Lotta 3\nAnna;Bianchi;a@e.it;;judo 2\n')
ok('una persona su più righe: una sola scheda coi corsi sommati, senza doppi', [f.iscritti.length, f.iscritti[0].corsi], [1, ['Judo 2', 'Lotta 3']])
ok('…e conta tre righe lette', f.righe.iscritti, 3)
ok('…e nessuna nota (stessa persona, stessa email)', f.note.length, 0)
f = dif(base + 'Anna;Bianchi;;;Judo 2\nANNA;bianchi;;;Lotta 3\n')
ok('senza email: stesso nome con maiuscole diverse è la stessa persona', [f.iscritti.length, f.iscritti[0].corsi], [1, ['Judo 2', 'Lotta 3']])
f = dif(base + "Dino;D'Angelo;;;Judo 2\nDino;D’Angelo;;;Lotta 3\nDino;Dangelo;;;Judo 2\n")
ok('apostrofo dritto, curvo e assente: stesso cognome', f.iscritti.length, 1)
f = dif(base + 'Nicolò;Rossi;;;Judo 2\nNicolo;Rossi;;;Lotta 3\n')
ok('con o senza accento: stesso nome', f.iscritti.length, 1)
f = dif(base + 'Luca;Neri;;;Judo 2\n;;;;\n\nAnna;Bianchi;;;Judo 2\n')
ok('righe vuote: ignorate, ma il numero di riga resta quello del foglio', f.iscritti.map((x) => x.riga), [2, 5])
ok('righe vuote non finiscono fra le saltate', f.saltate.length, 0)
f = dif(base + 'Mario;Rossi;m@e.it;;Judo 2\nPaolo;Rossi;M@E.it;;Judo 2\n')
ok('due fratelli con la stessa email: entrano tutti e due', f.iscritti.length, 2)
ok('il secondo senza email di accesso, con quella come contatto', [f.iscritti[1].email, f.iscritti[1].emailContatto, f.iscritti[1].contattoDi], [undefined, 'm@e.it', 'Mario Rossi'])
ok('e una nota che dice di chi era e a che riga', f.note.map((n) => n.motivo.includes('già di Mario Rossi (riga 2)') && n.riga === 3), [true])
f = dif(base + 'Mario;Rossi;m@e.it;;Judo 2\nPaolo;Rossi;m@e.it;;Judo 2\nPaolo;Rossi;m@e.it;;Lotta 3\n')
ok('il secondo fratello su due righe: una nota sola', f.note.length, 1)
f = dif(base + 'Anna;Bianchi;a@e.it;;Judo 2\nAnna;Bianchi;a@e.it;333;Lotta 3\n')
ok('telefono vuoto nella prima riga: vale il primo scritto più sotto, senza note', [f.iscritti[0].telefono, f.note.length], ['333', 0])
f = dif(base + 'Anna;Bianchi;a@e.it;333 1;Judo 2\nAnna;Bianchi;a@e.it;444 2;Lotta 3\n')
ok('due telefoni diversi: vale quello dell’ultima riga', f.iscritti[0].telefono, '444 2')
ok('…e una nota con le righe e i numeri', f.note.map((n) => [n.foglio, n.riga, n.motivo]), [['iscritti.csv', 3, 'Anna Bianchi: due telefoni diversi (riga 2: 333 1, riga 3: 444 2), ho preso 444 2']])
f = dif(base + 'Anna;Bianchi;a@e.it;333 1234;Judo 2\nAnna;Bianchi;a@e.it;3331234;Lotta 3\n')
ok('lo stesso telefono scritto con spazi diversi: nessuna nota', f.note.length, 0)
f = dif(base + 'Mario;Rossi;m@e.it;333;Judo 2\nPaolo;Rossi;m@e.it;333;Judo 2\n')
ok('fratelli col telefono del genitore: tutti e due lo tengono, nessuna nota di telefono', [f.iscritti.map((x) => x.telefono), f.note.some((n) => n.motivo.includes('telefon'))], [['333', '333'], false])
f = dif(base + 'Anna;Bianchi;;;Karate\n')
ok('un corso che non c’è: la riga è saltata, col nome e il perché', [f.iscritti.length, f.saltate[0].foglio, f.saltate[0].riga, f.saltate[0].nome, f.saltate[0].motivo], [0, 'iscritti.csv', 2, 'Anna Bianchi', 'Il corso «Karate» non è fra i corsi'])
f = dif(base + 'Anna;Bianchi;;;JUDO 2\n')
ok('il nome del corso senza badare a maiuscole', f.iscritti[0].corsi, ['JUDO 2'])
f = L.leggiFogli('nome;giorno;ora\nKarate;lun;10:00\n', base + 'Anna;Bianchi;;;karate\n')
ok('un corso scritto nello stesso import è noto', [f.saltate.length, f.iscritti.length], [0, 1])
f = dif(base + 'Anna;;;;Judo 2\n;Bianchi;;;Judo 2\n')
ok('senza cognome o senza nome: saltate, col perché', f.saltate.map((s) => s.motivo), ['Manca il cognome: «Anna», Judo 2', 'Manca il nome: «Bianchi», Judo 2'])
f = dif(base + 'Anna;Bianchi;;;\n')
ok('senza corso entra lo stesso, senza iscrizioni', [f.iscritti.length, f.iscritti[0].corsi], [1, []])
f = dif('cognome;nome;corso\nBianchi;Anna;Judo 2\n')
ok('colonne in ordine diverso e senza email né telefono', [f.iscritti[0].nome, f.iscritti[0].cognome, f.iscritti[0].email], ['Anna', 'Bianchi', undefined])
f = dif('NOME;COGNOME;Corso\nAnna;Bianchi;Judo 2\n')
ok('intestazioni in maiuscolo', f.iscritti.length, 1)
f = dif('Cognome e nome;corso\nBianchi Anna;Judo 2\n')
ok('foglio senza colonne nome e cognome (come le risposte del modulo): una riga sola dice cosa fare', [f.iscritti.length, f.saltate.length, f.saltate[0].riga, f.saltate[0].motivo.includes('risposte del modulo Google')], [0, 1, 1, true])
ok('…e la riga unica conta tutte le righe del foglio nel motivo', dif('x;corso\na;Judo 2\nb;Judo 2\n').saltate[0].motivo.startsWith('Le 2 righe'), true)
f = dif('')
ok('foglio vuoto: niente, né saltate', [f.iscritti.length, f.saltate.length], [0, 0])
f = L.leggiFogli(null, null)
ok('nessun foglio: tutto vuoto', [f.corsi.length, f.iscritti.length, f.saltate.length], [0, 0, 0])
f = dif(base + 'Anna;Bianchi;a@e.it;;Judo 2\nAnna;Bianchi;b@e.it;;Judo 2\n')
ok('due omonimi con email diverse sono due persone', f.iscritti.length, 2)

console.log('\nSeparatore e BOM nel foglio intero')
f = L.leggiFogli(null, '﻿nome,cognome,email,telefono,corso\r\n"Anna","Bianchi","a@e.it","333,44","Judo 2"\r\n', noti)
ok('BOM + virgole + virgolette + \\r\\n: la riga si legge', [f.iscritti.length, f.iscritti[0].telefono, f.iscritti[0].nome], [1, '333,44', 'Anna'])

console.log('\nLe righe del foglio: nuove, già in palestra, da sistemare')
const persona = (o) => ({ id: o.id ?? 'p' + o.nome, nome: o.nome, cognome: o.cognome, email: o.email, emailContatto: o.emailContatto, attiva: o.attiva ?? true, iscrizioni: o.iscrizioni ?? [] })
const sit = (persone, personale = []) => ({ sale: [], personale, corsi: [], persone })
const controllo = (foglio, persone, personale) => L.controllaRighe(dif(foglio), sit(persone, personale))
let c = controllo(base + 'Anna;Bianchi;;;Judo 2\n', [])
ok('chi non c’è è nuovo', [c.righe[0].esito, c.totali], ['nuova', { nuova: 1, in_palestra: 0, da_sistemare: 0 }])
c = controllo(base + 'Anna;Bianchi;;;Judo 2\n', [persona({ nome: 'Anna', cognome: 'Bianchi' })])
ok('chi c’è già (stesso nome) è «in palestra»', c.righe[0].esito, 'in_palestra')
c = controllo(base + 'ANNA;D’ANGELO;;;Judo 2\n', [persona({ nome: 'Anna', cognome: "D'Angelo" })])
ok('stesso nome con maiuscole e apostrofo curvo: lo stesso', c.righe[0].esito, 'in_palestra')
c = controllo(base + 'Anna;Bianchi;ANNA@e.it;;Judo 2\n', [persona({ nome: 'Anna', cognome: 'Bianchi', email: 'anna@e.it' })])
ok('stessa email (anche maiuscola) e stesso nome: già in palestra', c.righe[0].esito, 'in_palestra')
c = controllo(base + 'Manuel;Prudente;;;Judo 2\n', [persona({ nome: 'Prudente', cognome: 'Manuel' })])
ok('nome e cognome scambiati: da sistemare, non nuovo in silenzio', [c.righe[0].esito, c.righe[0].motivo, c.righe[0].chiedeScelta], ['da_sistemare', 'forse è già in palestra come Prudente Manuel', true])
ok('…e dice chi è il possibile doppione', c.righe[0].doppione, { id: 'pPrudente', nome: 'Prudente Manuel' })
c = controllo(base + 'Maria Grazia;Rossi;;;Judo 2\n', [persona({ nome: 'Grazia', cognome: 'Maria Rossi' })])
ok('le stesse parole in un altro ordine fra nome e cognome: da sistemare', c.righe[0].esito, 'da_sistemare')
c = controllo(base + 'Anna;Bianchi;nuova@e.it;;Judo 2\n', [persona({ nome: 'Anna', cognome: 'Bianchi', email: 'vecchia@e.it' })])
ok('stesso nome ma email diversa da quella in palestra: non è data per nuova in silenzio, la segreteria sceglie', [c.righe[0].esito, c.righe[0].doppione.nome], ['da_sistemare', 'Anna Bianchi'])
c = controllo(base + 'Anna;Bianchi;;;Judo 2\n', [persona({ nome: 'Anna', cognome: 'Bianchi', attiva: false })])
ok('archiviata: già in palestra, con avviso e scelta da fare', [c.righe[0].esito, c.righe[0].archiviato, c.righe[0].chiedeScelta, c.righe[0].avvisi.length], ['in_palestra', true, true, 1])
c = controllo(base + 'Anna;Bianchi;x@e.it;;Judo 2\n', [], [{ id: 'i1', nome: 'Luca', cognome: 'Neri', email: 'x@e.it' }])
ok('nuova ma con l’email di un istruttore: avviso, entra come contatto', [c.righe[0].esito, c.righe[0].avvisi.length], ['nuova', 1])
c = controllo(base + 'Anna;;;;Judo 2\nLuca;Neri;;;Karate\nAnna;Bianchi;;;Judo 2\n', [])
ok('righe saltate e buone in ordine di riga, con i totali', [c.righe.map((r) => r.riga), c.totali], [[2, 3, 4], { nuova: 1, in_palestra: 0, da_sistemare: 2 }])
ok('una riga saltata è «da sistemare» col suo motivo e il nome', [c.righe[0].esito, c.righe[0].nome, c.righe[0].motivo, c.righe[1].nome], ['da_sistemare', 'Anna', 'Manca il cognome: «Anna», Judo 2', 'Luca Neri'])

console.log('\nLa stessa persona con e senza email')
const schede = (testo) => dif(base + testo).iscritti.map((i) => [i.nome, i.cognome, i.email, i.corsi])
ok('senza email + con email, stesso nome: una scheda con l’email e i due corsi', schede('Anna;Bianchi;;;Judo 2\nAnna;Bianchi;a@e.it;;Lotta 3\n'), [['Anna', 'Bianchi', 'a@e.it', ['Judo 2', 'Lotta 3']]])
ok('…e in ordine inverso è identico', schede('Anna;Bianchi;a@e.it;;Lotta 3\nAnna;Bianchi;;;Judo 2\n'), [['Anna', 'Bianchi', 'a@e.it', ['Lotta 3', 'Judo 2']]])
ok('…il nome si confronta senza badare alle maiuscole', schede('ANNA;Bianchi;;;Judo 2\nAnna;BIANCHI;a@e.it;;Lotta 3\n').length, 1)
ok('due schede con email diverse + una senza: la senza non si lega, restano tre', schede('Anna;Bianchi;a@e.it;;Judo 2\nAnna;Bianchi;b@e.it;;Judo 2\nAnna;Bianchi;;;Lotta 3\n').map((s) => s[2]), ['a@e.it', 'b@e.it', undefined])
ok('due righe senza email, stesso nome: una scheda sola, corsi sommati', schede('Anna;Bianchi;;;Judo 2\nAnna;Bianchi;;;Lotta 3\n'), [['Anna', 'Bianchi', undefined, ['Judo 2', 'Lotta 3']]])
ok('fratelli con nomi diversi: non si toccano', schede('Anna;Bianchi;;;Judo 2\nLuca;Bianchi;l@e.it;;Lotta 3\n').length, 2)
c = controllo(base + 'Anna;Bianchi;;;Judo 2\nAnna;Bianchi;a@e.it;;Lotta 3\n', [])
ok('il controllo con database vuoto dice 1 nuova, non 2', c.totali, { nuova: 1, in_palestra: 0, da_sistemare: 0 })
{
  const creati = []
  const corsiFinti = [{ id: 'j2', nome: 'Judo 2', ricorrenze: [], istruttori: [] }, { id: 'l3', nome: 'Lotta 3', ricorrenze: [], istruttori: [] }]
  const iscritte = []
  const d = {
    sale: async () => [], personale: async () => [], corsi: async () => corsiFinti,
    persone: async () => creati.map((p, i) => persona({ ...p, id: 'n' + i })),
    salvaPersona: async (p) => { creati.push(p); return 'n' + (creati.length - 1) },
    iscrivi: async (id, corso) => { iscritte.push([id, corso]) },
    rigenera: async () => {},
  }
  const r = await L.importa(d, dif(base + 'Anna;Bianchi;;;Judo 2\nAnna;Bianchi;a@e.it;;Lotta 3\n'), () => {})
  ok('importa: una sola persona creata, con l’email', creati.map((p) => [p.nome, p.cognome, p.email]), [['Anna', 'Bianchi', 'a@e.it']])
  ok('…iscritta a tutti e due i corsi', iscritte, [['n0', 'j2'], ['n0', 'l3']])
  ok('…e niente da sistemare', r.daSistemare, [])
}

console.log('\nQuante righe entrano (righeBuone)')
let ff = dif(base + 'Anna;Bianchi;;;Judo 2\nLuca;Neri;;;Karate\nPaola;Gialli;;;Judo 2\n')
let cc = L.controllaRighe(ff, sit([]))
ok('tre lette, una saltata (corso sconosciuto): due buone', L.righeBuone(ff, cc, {}), 2)
ff = dif(base + 'Manuel;Prudente;;;Judo 2\nAnna;Bianchi;;;Judo 2\n')
cc = L.controllaRighe(ff, sit([persona({ nome: 'Prudente', cognome: 'Manuel' })]))
ok('un possibile doppione senza scelta aspetta: non conta', L.righeBuone(ff, cc, {}), 1)
ok('con la scelta «lega» entra', L.righeBuone(ff, cc, { [L.chiaveRiga({ foglio: 'iscritti.csv', riga: 2 })]: { doppione: 'lega' } }), 2)
ok('con la scelta «nuova» entra', L.righeBuone(ff, cc, { 'iscritti.csv:2': { doppione: 'nuova' } }), 2)
cc = L.controllaRighe(dif(base + 'Anna;Bianchi;;;Judo 2\n'), sit([persona({ nome: 'Anna', cognome: 'Bianchi', attiva: false })]))
ok('un’archiviata senza scelta non conta', L.righeBuone(dif(base + 'Anna;Bianchi;;;Judo 2\n'), cc, {}), 0)
ok('…con «riattiva» sì', L.righeBuone(dif(base + 'Anna;Bianchi;;;Judo 2\n'), cc, { 'iscritti.csv:2': { archiviato: 'riattiva' } }), 1)
ok('la saltata non si conta due volte come in attesa', (() => {
  const g = dif(base + 'Anna;;;;Judo 2\nLuca;Neri;;;Judo 2\n')
  return L.righeBuone(g, L.controllaRighe(g, sit([])), {})
})(), 1)
ok('chiaveRiga: stesso numero in due fogli, chiavi diverse', [L.chiaveRiga({ foglio: 'iscritti.csv', riga: 5 }), L.chiaveRiga({ foglio: 'risposte', riga: 5 })], ['iscritti.csv:5', 'risposte:5'])

console.log('\nLe righe da sistemare, in testo')
const sistemare = [{ foglio: 'iscritti.csv', riga: 4, nome: 'Anna', motivo: 'Manca il cognome' }, { foglio: 'risposte', riga: 7, nome: 'Luca Neri', motivo: 'forse è già in palestra' }]
ok('una riga per ognuna: foglio, riga, nome, motivo', L.righeDaSistemare({ daSistemare: sistemare }), ['iscritti.csv, riga 4: Anna — Manca il cognome', 'risposte, riga 7: Luca Neri — forse è già in palestra'])
ok('nessuna da sistemare: nessuna riga', L.righeDaSistemare({ daSistemare: [] }), [])
ok('resoconto senza niente da dire: FATTO', L.testoResoconto({ daSistemare: [] }), 'FATTO')
ok('resoconto con una riga: singolare, «sistemare»', L.testoResoconto({ daSistemare: [sistemare[0]] }), 'FATTO, 1 riga da sistemare\niscritti.csv, riga 4: Anna — Manca il cognome')
ok('resoconto con due: plurale', L.testoResoconto({ daSistemare: sistemare }).split('\n')[0], 'FATTO, 2 righe da sistemare')
ok('con solo contatti da controllare: «controllare», e i contatti in coda', L.testoResoconto({ daSistemare: [], emailDiAltri: ['riga 3: x'] }), 'FATTO, 1 riga da controllare\nriga 3: x')
ok('messaggioRiga: email già usata', L.messaggioRiga(new Error('duplicate key value violates unique constraint')).startsWith('questa email è già'), true)
ok('messaggioRiga: permesso', L.messaggioRiga(new Error('new row violates row-level security policy')).startsWith('non hai il permesso'), true)
ok('messaggioRiga: rete', L.messaggioRiga(new Error('Failed to fetch')).startsWith('la rete è caduta'), true)
ok('messaggioRiga: un testo inglese non riconosciuto non si mostra', L.messaggioRiga(new Error('kaboom')), 'la riga non è entrata: rilancia, e se si ripete scrivilo in SEGNALAZIONI')
ok('messaggioRiga: un messaggio nostro resta com’è', L.messaggioRiga(new Error('Serve un cognome')), 'Serve un cognome')
ok('fraseResoconto: uno', L.fraseResoconto({ iscrittiNuovi: 1, emailDiAltri: ['x'] }), 'È entrato 1 iscritto. Per 1 l’email era già di un’altra persona: ora è la sua email di contatto.'.replace(/’/g, "'"))
ok('fraseResoconto: più', L.fraseResoconto({ iscrittiNuovi: 3, emailDiAltri: ['x', 'y'] }), 'Sono entrati 3 iscritti. Per 2 l\'email era già di un\'altra persona: ora è la loro email di contatto.')

console.log('\nI ruoli e le colonne del modulo Google')
const ruoli = L.RUOLI.map(([r]) => r)
ok('ogni ruolo compare una volta sola', new Set(ruoli).size, ruoli.length)
ok('ogni ruolo ha un’etichetta in maiuscolo per chi usa l’app', L.RUOLI.every(([, e]) => e.length > 0 && e === e.toUpperCase()), true)
ok('i ruoli sono quelli attesi, in questo ordine', ruoli, ['nome', 'cognome', 'nomeCompleto', 'codiceFiscale', 'email', 'telefono', 'corsi', 'natoIl', 'natoA', 'comune', 'indirizzo', 'cap', 'genitore', 'genitoreCodiceFiscale', 'genitoreNato', 'dataRisposta'])
const testa = ['Informazioni cronologiche', 'Nome e cognome', 'Indirizzo email', 'Cellulare', 'Codice fiscale', 'Data di nascita', 'Luogo di nascita', 'Comune di residenza', 'Indirizzo di residenza', 'CAP', 'Nome e cognome del genitore', 'Codice fiscale del genitore', 'Corsi a cui vuoi iscriverti']
const col = L.indovinaColonne(testa)
// L'ordine delle chiavi non è una regola: si confronta ordinato.
const ordina = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
ok('le colonne si indovinano dall’intestazione', ordina(col), ordina({ nomeCompleto: 1, codiceFiscale: 4, email: 2, telefono: 3, corsi: 12, natoIl: 5, natoA: 6, comune: 7, indirizzo: 8, cap: 9, genitoreCodiceFiscale: 11, dataRisposta: 0, genitore: 10 }))
ok('ogni ruolo trovato è un ruolo dell’elenco', Object.keys(col).every((k) => ruoli.includes(k)), true)
ok('nome e cognome separati: due colonne, e niente nome intero', ordina(L.indovinaColonne(['Cognome', 'Nome'])), ordina({ cognome: 0, nome: 1 }))
ok('«Nome del genitore» non è il nome della persona', ordina(L.indovinaColonne(['Nome', 'Cognome', 'Nome del genitore'])), ordina({ nome: 0, cognome: 1, genitore: 2 }))
ok('maiuscole e accenti non contano', ordina(L.indovinaColonne(['NOME', 'COGNOME', 'CITTÀ'])), ordina({ nome: 0, cognome: 1, comune: 2 }))
ok('un’intestazione che non dice niente: nessun ruolo', L.indovinaColonne(['Boh', 'Altro']), {})
ok('lo stesso ruolo non si assegna a due colonne', Object.values(L.indovinaColonne(['Email', 'Email', 'Nome', 'Cognome'])).filter((i) => i === 0 || i === 1).length, 1)
ok('indovinaOrdine: «Cognome e nome» → cognome prima', L.indovinaOrdine(['Cognome e nome'], { nomeCompleto: 0 }), 'cognomeNome')
ok('indovinaOrdine: «Nome e cognome» → nome prima', L.indovinaOrdine(['Nome e cognome'], { nomeCompleto: 0 }), 'nomeCognome')
ok('indovinaOrdine: senza colonna, nome prima', L.indovinaOrdine([], {}), 'nomeCognome')

console.log('\nLe scelte dei corsi')
ok('divideScelte: due scelte', L.divideScelte('Judo 2, Lotta 3'), ['Judo 2', 'Lotta 3'])
ok('divideScelte: la virgola dentro le parentesi non divide', L.divideScelte('Judo 2 (nati 2017, 2018), Lotta 3'), ['Judo 2 (nati 2017, 2018)', 'Lotta 3'])
ok('divideScelte: la virgola seguita da una minuscola non divide', L.divideScelte('Yoga lunedì, mercoledì, Judo 2'), ['Yoga lunedì, mercoledì', 'Judo 2'])
ok('divideScelte: celle vuote o solo virgole', [L.divideScelte(''), L.divideScelte(' , ')], [[], []])
ok('scelteCorsi: conta e ordina', L.scelteCorsi({ testa: ['c'], righe: [['Judo, Lotta'], ['Judo'], ['']] }, 0), [{ testo: 'Judo', quante: 2 }, { testo: 'Lotta', quante: 1 }])
ok('scelteCorsi: senza colonna, niente', L.scelteCorsi({ testa: [], righe: [['x']] }, undefined), [])
const elencoCorsi = [{ id: 'j', nome: 'Judo' }, { id: 'j2', nome: 'Judo 2' }, { id: 'ja', nome: 'Judo adulti' }]
ok('indovinaCorso: stesso nome', L.indovinaCorso('judo 2', elencoCorsi), 'j2')
ok('indovinaCorso: il nome del corso apre la scelta', L.indovinaCorso('Judo 2 (nati 2017-2019)', elencoCorsi), 'j2')
ok('indovinaCorso: Judo 22 non è Judo 2', L.indovinaCorso('Judo 22', [{ id: 'j2', nome: 'Judo 2' }]), undefined)
ok('indovinaCorso: il più lungo vince', L.indovinaCorso('Judo adulti (sera)', elencoCorsi), 'ja')
ok('indovinaCorso: nessuno', L.indovinaCorso('Danza', elencoCorsi), undefined)

console.log('\nLe date')
const oggi = new Date(2026, 9, 7)
ok('13/06/2014', L.leggiData('13/06/2014', oggi), '2014-06-13')
ok('3-6-14 (anno a due cifre)', L.leggiData('3-6-14', oggi), '2014-06-03')
ok('13.06.2014', L.leggiData('13.06.2014', oggi), '2014-06-13')
ok('già 2014-06-13', L.leggiData('2014-06-13', oggi), '2014-06-13')
ok('con l’ora dopo (ISO): vale il giorno', L.leggiData('2014-06-13 10:30:00', oggi), '2014-06-13')
ok('anno a due cifre che sarebbe nel futuro: 1900', L.leggiData('1/1/60', oggi), '1960-01-01')
ok('anno a due cifre nel passato: 2000', L.leggiData('1/1/20', oggi), '2020-01-01')
ok('31/02 non esiste', L.leggiData('31/02/2014', oggi), null)
ok('29/02 di un anno bisestile sì', L.leggiData('29/02/2016', oggi), '2016-02-29')
ok('29/02 di un anno non bisestile no', L.leggiData('29/02/2015', oggi), null)
ok('mese 13', L.leggiData('1/13/2014', oggi), null)
ok('una data nel futuro non è una nascita', L.leggiData('08/10/2026', oggi), null)
ok('oggi vale', L.leggiData('07/10/2026', oggi), '2026-10-07')
ok('testo qualsiasi', L.leggiData('ieri', oggi), null)
ok('stringa vuota', L.leggiData('', oggi), null)
ok('spazi attorno', L.leggiData('  13/06/2014 ', oggi), '2014-06-13')

console.log('\nNome e cognome da una casella sola')
ok('«Anna Bianchi»: nome prima', L.dividiNome('Anna Bianchi'), { nome: 'Anna', cognome: 'Bianchi' })
ok('«Anna De Luca»: la particella resta col cognome', L.dividiNome('Anna De Luca'), { nome: 'Anna', cognome: 'De Luca' })
ok('«Maria Grazia Rossi»: due nomi', L.dividiNome('Maria Grazia Rossi'), { nome: 'Maria Grazia', cognome: 'Rossi' })
ok('cognome prima: «De Luca Anna»', L.dividiNome('De Luca Anna', undefined, undefined, 'cognomeNome'), { nome: 'Anna', cognome: 'De Luca' })
ok('cognome prima: «Rossi Mario»', L.dividiNome('Rossi Mario', undefined, undefined, 'cognomeNome'), { nome: 'Mario', cognome: 'Rossi' })
ok('una parola sola, senza codice: non si divide', L.dividiNome('Rossi'), null)
ok('testo vuoto: null', L.dividiNome('   '), null)
ok('il codice fiscale vince sull’ordine: «Rossi Mario» col CF di Mario Rossi, ordine nome-cognome', L.dividiNome('Rossi Mario', CF_MARIO), { nome: 'Mario', cognome: 'Rossi' })
ok('…anche con cognome in due parole', L.dividiNome('De Luca Mario', cfDa('DLCMRA14H13H501')), { nome: 'Mario', cognome: 'De Luca' })
ok('una parola sola + email + codice: l’altra parola viene dall’email', L.dividiNome('Rossi', CF_MARIO, 'mario.rossi@e.it'), { nome: 'Mario', cognome: 'Rossi', dallEmail: true })
ok('un codice fiscale che non torna con le parole: vale l’ordine', L.dividiNome('Anna Bianchi', CF_MARIO), { nome: 'Anna', cognome: 'Bianchi' })

console.log('\nLe risposte del modulo Google')
const leggi = (csv, abb = { 'Judo 2': 'j2' }, ordine) => {
  const t = L.leggiTabella(csv)
  return L.leggiRisposte(t, L.indovinaColonne(t.testa), abb, [{ id: 'j2', nome: 'Judo 2' }], ordine)
}
const T = 'Informazioni cronologiche,Nome e cognome,Indirizzo email,Telefono,Codice fiscale,Data di nascita,CAP,Corsi\n'
let r = leggi(T + '13/06/2020 10:00:00,Mario Rossi,Mario@E.it,333,,13/06/2014,00100,Judo 2\n')
ok('una risposta: un iscritto, email in minuscolo, corso abbinato', [r.iscritti.length, r.iscritti[0].email, r.iscritti[0].corsi, r.righe], [1, 'mario@e.it', ['Judo 2'], 1])
ok('iscritto dal giorno della risposta', r.iscritti[0].iscrittoIl, '2020-06-13')
ok('data di nascita e CAP in anagrafica', r.iscritti[0].anagrafica, { natoIl: '2014-06-13', cap: '00100' })
ok('le risposte valgono come «stesso nome» anche con email nuova', r.iscritti[0].soloStessoNome, true)
r = leggi(T + ',Mario,,,,,,\n')
ok('una parola sola e niente altro: saltata, col perché', [r.iscritti.length, r.saltate[0].riga, r.saltate[0].motivo], [0, 2, '«Mario»: servono nome e cognome'])
r = leggi(T + ',,,,,,,\n,,,,,,,\n')
ok('righe tutte vuote: non si contano', [r.righe, r.saltate.length], [0, 0])
r = leggi(T + '1/1/2020,Mario Rossi,mario@e.it,111,,,,Judo 2\n2/2/2021,mario rossi,mario@e.it,222,,,,Judo 2\n')
ok('lo stesso nome due volte: una persona, l’ultimo telefono, la prima data', [r.iscritti.length, r.iscritti[0].telefono, r.iscritti[0].iscrittoIl, r.iscritti[0].corsi], [1, '222', '2020-01-01', ['Judo 2']])
ok('…e se i telefoni sono diversi, una nota con le righe e i numeri', leggi(T + '1/1/2020,Mario Rossi,mario@e.it,111,,,,\n2/2/2021,Mario Rossi,mario@e.it,222,,,,\n').note.map((n) => [n.foglio, n.riga, n.motivo]), [['risposte', 3, 'Mario Rossi: due telefoni diversi (riga 2: 111, riga 3: 222), ho preso 222']])
ok('…stesso telefono scritto in altro modo: nessuna nota', leggi(T + '1/1/2020,Mario Rossi,mario@e.it,333 1234,,,,\n2/2/2021,Mario Rossi,mario@e.it,3331234,,,,\n').note.length, 0)
ok('…primo telefono vuoto, secondo scritto: vale il secondo, senza note', (({ iscritti, note }) => [iscritti[0].telefono, note.length])(leggi(T + '1/1/2020,Mario Rossi,mario@e.it,,,,,\n2/2/2021,Mario Rossi,mario@e.it,222,,,,\n')), ['222', 0])
r = leggi(T + '1/1/2020,Mario Rossi,famiglia@e.it,,,,,\n1/1/2020,Paolo Rossi,famiglia@e.it,,,,,\n')
ok('due fratelli con la stessa email: il secondo come contatto, con una nota', [r.iscritti[1].email, r.iscritti[1].emailContatto, r.note.length], [undefined, 'famiglia@e.it', 1])
r = leggi(T + '1/1/2020,Mario Rossi,non-una-email,,,,,\n')
ok('email che non sembra tale: entra senza, con nota', [r.iscritti[0].email, r.note[0].motivo.includes('non sembra giusta')], [undefined, true])
r = leggi(T + '1/1/2020,Mario Rossi,,,,31/02/2014,,\n')
ok('data di nascita impossibile: entra senza, con nota che dice quale', [r.iscritti[0].anagrafica, r.note[0].motivo.includes('«31/02/2014»')], [undefined, true])
r = leggi(T + `1/1/2020,Mario Rossi,,,${CF_MARIO.toLowerCase()},13/06/2014,,\n`)
ok('codice fiscale giusto, scritto in minuscolo: maiuscolo e senza note', [r.iscritti[0].anagrafica.codiceFiscale, r.note.length], [CF_MARIO, 0])
r = leggi(T + `1/1/2020,Mario Rossi,,,${CF_MARIO.slice(0, 15)}X,,,\n`)
ok('ultimo carattere sbagliato: entra, con nota «non torna»', [r.iscritti[0].anagrafica.codiceFiscale, r.note[0].motivo.includes('l\'ultimo carattere non torna')], [CF_MARIO.slice(0, 15) + 'X', true])
r = leggi(T + '1/1/2020,Mario Rossi,,,ABC,,,\n')
ok('codice fiscale che non ha la forma: entra senza, con nota', [r.iscritti[0].anagrafica, r.note[0].motivo.includes('non sembra giusto')], [undefined, true])
r = leggi(T + `1/1/2020,Anna Bianchi,,,${CF_MARIO},,,\n`)
ok('codice di un’altra persona: nota «di qualcun altro»', r.note.some((n) => n.motivo.includes('non torna con nome e cognome')), true)
r = leggi(T + `1/1/2020,Mario Rossi,,,${CF_MARIO},20/01/2015,,\n`)
ok('data e codice che dicono giorni diversi: nota, e la data scritta resta', [r.note.some((n) => n.motivo.includes('non dicono lo stesso giorno')), r.iscritti[0].anagrafica.natoIl], [true, '2015-01-20'])
r = leggi(T + '1/1/2020,Mario Rossi,,,,,123,\n')
ok('CAP di tre cifre: fuori, con nota', [r.iscritti[0].anagrafica, r.note[0].motivo.includes('CAP')], [undefined, true])
r = leggi(T + '1/1/2020,Mario Rossi,,,,,,Karate\n')
ok('una scelta non abbinata: entra senza il corso, con nota', [r.iscritti[0].corsi, r.note[0].motivo.includes('non è abbinato')], [[], true])
r = leggi(T + '1/1/2020,Mario Rossi,,,,,,Karate\n', { Karate: '' })
ok('una scelta lasciata stare («»): niente corso e niente nota', [r.iscritti[0].corsi, r.note.length], [[], 0])
r = leggi(T + "1/1/2020,Nicolò D’Angelo,,,,,,\n")
ok('accenti e apostrofi nel nome sono quelli scritti', [r.iscritti[0].nome, r.iscritti[0].cognome], ['Nicolò', 'D’Angelo'])
r = leggi('Cognome e nome,Corsi\nRossi Mario,Judo 2\n', undefined, 'cognomeNome')
ok('ordine «cognome nome» dalla casella sola', [r.iscritti[0].nome, r.iscritti[0].cognome], ['Mario', 'Rossi'])
const G = 'Nome e cognome,Data di nascita,Nome e cognome del genitore,Codice fiscale del genitore\n'
r = leggi(G + 'Mario Rossi,13/06/2014,Paola Verdi,\n')
ok('il genitore di un minore entra, diviso in nome e cognome', [r.iscritti[0].anagrafica.genitoreNome, r.iscritti[0].anagrafica.genitoreCognome], ['Paola', 'Verdi'])
r = leggi(G + 'Mario Rossi,13/06/1990,Paola Verdi,\n')
ok('un maggiorenne: il genitore non entra, con nota', [r.iscritti[0].anagrafica.genitoreNome, r.note.some((n) => n.motivo.includes('maggiorenne'))], [undefined, true])
r = leggi(G + 'Mario Rossi,13/06/2014,Paola Verdi,\nPaola Verdi,13/06/1980,,\n')
ok('il genitore che ha mandato il modulo: si prende il suo nome com’è scritto lì', [r.iscritti[0].anagrafica.genitoreNome, r.iscritti[0].anagrafica.genitoreCognome], ['Paola', 'Verdi'])
r = leggi('Nome e cognome,Indirizzo\nMario Rossi,' + 'x'.repeat(161) + '\n')
ok('un indirizzo di oltre 160 lettere: fuori, con nota', [r.iscritti[0].anagrafica, r.note[0].motivo.includes('troppo lungo')], [undefined, true])

console.log('\nLo stesso nome in iscritti.csv e nel modulo: una persona sola')
const unisci = L.unisciFogli
const corsiDue = [{ id: 'j2', nome: 'Judo 2', ricorrenze: [], istruttori: [] }, { id: 'yo', nome: 'Yoga', ricorrenze: [], istruttori: [] }]
const Tm = 'Informazioni cronologiche,Nome e cognome,Indirizzo email,Telefono,Data di nascita,CAP,Corsi\n'
const duePosti = (csv, modulo) => {
  const f = L.leggiFogli(null, base + csv, ['Judo 2', 'Yoga'])
  const t = L.leggiTabella(Tm + modulo)
  const r = L.leggiRisposte(t, L.indovinaColonne(t.testa), { 'Judo 2': 'j2', Yoga: 'yo' }, [{ id: 'j2', nome: 'Judo 2' }, { id: 'yo', nome: 'Yoga' }])
  const u = unisci(f.iscritti, r.iscritti)
  return { ...f, iscritti: u.iscritti, note: [...(f.note ?? []), ...u.note] }
}
// Il database finto: chi c'è già (`dentro`), cosa salva importa().
const provaImporta = async (f, dentro = []) => {
  const creati = []
  const iscritte = []
  const salvate = []
  const d = {
    sale: async () => [], personale: async () => [], corsi: async () => corsiDue,
    persone: async () => [...dentro, ...creati.map((p, i) => persona({ ...p, id: 'n' + i }))],
    salvaPersona: async (p) => { creati.push(p); return 'n' + (creati.length - 1) },
    iscrivi: async (id, corso, dal) => { iscritte.push([id, corso, dal]) },
    salvaAnagrafica: async (id, a) => { salvate.push([id, a]) },
    rigenera: async () => {},
  }
  const r = await L.importa(d, f, () => {})
  return { creati, iscritte, salvate, r }
}
const AnnaCsv = 'Anna;Bianchi;;111;Judo 2\n'
const AnnaMod = '13/06/2020 10:00:00,Anna Bianchi,anna@x.it,222,,,Judo 2\n'
{
  const f = duePosti(AnnaCsv, AnnaMod)
  ok('stesso nome nei due fogli: una scheda sola', f.iscritti.length, 1)
  ok('il controllo dice 1 nuova, non 2', L.controllaRighe(f, sit([])).totali, { nuova: 1, in_palestra: 0, da_sistemare: 0 })
  const { creati, r } = await provaImporta(f)
  ok('importa: una persona creata, con l’email del modulo e il suo telefono', creati.map((p) => [p.nome, p.cognome, p.email, p.telefono]), [['Anna', 'Bianchi', 'anna@x.it', '222']])
  ok('…e niente da sistemare', r.daSistemare, [])
  const n = f.note.filter((x) => x.motivo.includes('111'))
  ok('una nota dice il telefono di iscritti.csv che non è entrato, con foglio e riga', [n.length, n[0]?.foglio, n[0]?.riga, n[0]?.motivo.includes('iscritti.csv'), n[0]?.motivo.includes('riga 2')], [1, 'iscritti.csv', 2, true, true])
}
{
  const f = duePosti('Anna;Bianchi;csv@x.it;;Judo 2\n', AnnaMod)
  const { creati } = await provaImporta(f)
  ok('email diverse: vince il modulo, e quella di iscritti.csv non diventa email di contatto', creati.map((p) => [p.email, p.emailContatto]), [['anna@x.it', undefined]])
  ok('…ma è scritta in una nota, con foglio e riga', f.note.filter((x) => x.motivo.includes('csv@x.it')).map((x) => [x.foglio, x.riga]), [['iscritti.csv', 2]])
}
{
  const { creati } = await provaImporta(duePosti('Anna;Bianchi;;111;Judo 2\n', '13/06/2020 10:00:00,Anna Bianchi,,,,,Judo 2\n'))
  ok('telefono solo in iscritti.csv: vale quello, senza note', creati.map((p) => p.telefono), ['111'])
  const f = duePosti('Anna;Bianchi;;111;Judo 2\n', '13/06/2020 10:00:00,Anna Bianchi,,,,,Judo 2\n')
  ok('…nessuna nota di dato scartato', f.note.length, 0)
}
{
  const { creati } = await provaImporta(duePosti('Anna;Bianchi;csv@x.it;;Judo 2\n', '13/06/2020 10:00:00,Anna Bianchi,,222,,,Judo 2\n'))
  ok('email solo in iscritti.csv, telefono solo nel modulo: entrano tutti e due', creati.map((p) => [p.email, p.telefono]), [['csv@x.it', '222']])
}
{
  const { creati } = await provaImporta(duePosti('Anna;Bianchi;;111;Judo 2\n', '13/06/2020 10:00:00,anna  BIANCHI,,111 ,,,Judo 2\n'))
  ok('stesso telefono scritto in altro modo, nome con maiuscole diverse: una persona, nessuna nota', creati.length, 1)
  const f = duePosti('Anna;Bianchi;;111;Judo 2\n', '13/06/2020 10:00:00,anna  BIANCHI,,111 ,,,Judo 2\n')
  ok('…nessuna nota', f.note.length, 0)
}
{
  const f = duePosti('Anna;Bianchi;;;Judo 2\n', '13/06/2020 10:00:00,Anna Bianchi,,,,,"Judo 2, Yoga"\n')
  ok('corsi sommati senza doppioni: Judo 2 e Yoga una volta ciascuno', f.iscritti.map((x) => x.corsi), [['Judo 2', 'Yoga']])
  const { iscritte } = await provaImporta(f)
  ok('importa: due iscrizioni, e Judo 2 con la data della risposta del modulo', iscritte, [['n0', 'j2', '2020-06-13'], ['n0', 'yo', '2020-06-13']])
}
{
  const { salvate } = await provaImporta(duePosti(AnnaCsv, '13/06/2020 10:00:00,Anna Bianchi,anna@x.it,222,10/03/2015,00100,Judo 2\n'))
  ok('l’anagrafica che c’è solo nel modulo viene salvata', salvate, [['n0', { natoIl: '2015-03-10', cap: '00100' }]])
}
{
  const gia = { ...persona({ nome: 'Anna', cognome: 'Bianchi', id: 'a1' }), telefono: '999' }
  const f = duePosti(AnnaCsv, AnnaMod)
  const { creati, iscritte, r } = await provaImporta(f, [gia])
  ok('già nel database: non si crea una seconda persona', creati.length, 0)
  ok('…il telefono (999) e l’email non si toccano: nessuna scrittura sulla persona', [gia.telefono, gia.email], ['999', undefined])
  ok('…iscritta al suo corso, una volta', iscritte, [['a1', 'j2', '2020-06-13']])
  ok('…e niente da sistemare', r.daSistemare, [])
}
{
  const f = duePosti('Anna;Rossi;;;Judo 2\n', '13/06/2020 10:00:00,Anna Bianchi,,,,,Judo 2\n')
  ok('Anna Rossi in iscritti.csv, Anna Bianchi nel modulo: due persone', f.iscritti.map((x) => [x.nome, x.cognome]), [['Anna', 'Rossi'], ['Anna', 'Bianchi']])
  ok('…il controllo conta due nuove', L.controllaRighe(f, sit([])).totali.nuova, 2)
}
{
  const f = duePosti('Mario;Rossi;fam@x.it;;Judo 2\n', '13/06/2020 10:00:00,Paolo Rossi,fam@x.it,,,,Judo 2\n')
  ok('fratelli con la stessa email del genitore, uno per foglio: due persone', f.iscritti.map((x) => x.nome), ['Mario', 'Paolo'])
  const { creati } = await provaImporta(f)
  ok('…il secondo senza email di accesso, con quella come contatto', creati.map((p) => [p.nome, p.email, p.emailContatto]), [['Mario', 'fam@x.it', undefined], ['Paolo', undefined, 'fam@x.it']])
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
