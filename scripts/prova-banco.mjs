// ---------------------------------------------------------------------------
// Il Banco, senza browser: l'aspetto scelto, dove sta ogni voce, cosa tiene
// fuori di sala, il tabellone di oggi, la coda «da fare al banco».
//
//   node scripts/prova-banco.mjs
//
// Tutta logica di `src/lib`: i componenti del Banco mostrano e chiamano.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: `
      export * as aspetto from './src/lib/aspetto'
      export * as indirizzo from './src/lib/indirizzoSegreteria'
      export * as luoghi from './src/lib/luoghiBanco'
      export * as blocca from './src/lib/cosaBlocca'
      export * as giornata from './src/lib/giornata'
      export * as coda from './src/lib/codaBanco'
      export * as segreteria from './src/lib/segreteria'
    `,
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const testo = outputFiles[0].text
const carica = (n = 0) => import('data:text/javascript;base64,' + Buffer.from(testo + `\n//${n}`).toString('base64'))

// Il minimo browser che `aspetto.ts` tocca.
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const m = await carica()

let guai = 0
// Le chiavi in ordine, perché il confronto non dipenda da come è costruito l'oggetto.
const piatto = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, piatto(v[k])])) : Array.isArray(v) ? v.map(piatto) : v
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(piatto(avuto)) === JSON.stringify(piatto(voluto))
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const errore = (f) => {
  try {
    f()
    return null
  } catch (e) {
    return e
  }
}
const titolo = (t) => console.log(`\n${t}`)

const OGGI = '2026-10-18'

// ---------------------------------------------------------------------------
titolo('aspetto')
{
  ok('aspettoDa: banco resta banco', m.aspetto.aspettoDa('banco'), 'banco')
  for (const brutto of [null, undefined, 'x', 3, 'BANCO', '', {}, 'oggi'])
    ok(`aspettoDa(${JSON.stringify(brutto)}) è oggi`, m.aspetto.aspettoDa(brutto), 'oggi')

  memoria.clear()
  const a = await carica(1)
  ok('senza niente salvato si parte da oggi', a.aspetto.leggiAspetto(), 'oggi')
  a.aspetto.scegliAspetto('banco')
  ok('scelto banco, si rilegge banco', a.aspetto.leggiAspetto(), 'banco')
  ok('la scelta è scritta in localStorage', memoria.get('ods-aspetto'), 'banco')
  ok('ricaricando la pagina resta banco', (await carica(2)).aspetto.leggiAspetto(), 'banco')
  a.aspetto.scegliAspetto('oggi')
  ok('tornando a oggi si rilegge oggi', a.aspetto.leggiAspetto(), 'oggi')

  memoria.clear()
  memoria.set('ods-aspetto', 'BANCO')
  ok('valore salvato corrotto: oggi', (await carica(3)).aspetto.leggiAspetto(), 'oggi')
  memoria.set('ods-aspetto', '{"x":1')
  ok('valore salvato illeggibile: oggi', (await carica(4)).aspetto.leggiAspetto(), 'oggi')

  // Un localStorage che lancia (navigazione privata, spazio finito): la scelta vale finché la pagina resta aperta.
  const buono = globalThis.localStorage
  globalThis.localStorage = {
    getItem: () => {
      throw new Error('negato')
    },
    setItem: () => {
      throw new Error('negato')
    },
  }
  const b = await carica(5)
  ok('localStorage che lancia: leggere non lancia', errore(() => b.aspetto.leggiAspetto()), null)
  ok('localStorage che lancia: leggere dà oggi', b.aspetto.leggiAspetto(), 'oggi')
  ok('localStorage che lancia: scegliere non lancia', errore(() => b.aspetto.scegliAspetto('banco')), null)
  ok('localStorage che lancia: la scelta resta', b.aspetto.leggiAspetto(), 'banco')
  globalThis.localStorage = buono

  ok('sul computer vale la scelta: banco', m.aspetto.aspettoInUso('banco', false), 'banco')
  ok('sul computer vale la scelta: oggi', m.aspetto.aspettoInUso('oggi', false), 'oggi')
  ok('sul telefono banco diventa oggi', m.aspetto.aspettoInUso('banco', true), 'oggi')
  ok('il Banco è della segreteria: chi cura solo i conti ha l\'aspetto di sempre', [m.aspetto.aspettoInUso('banco', false, false), m.aspetto.aspettoInUso('banco', false, true), m.aspetto.aspettoInUso('banco', false)], ['oggi', 'banco', 'banco'])
  ok('sul telefono oggi resta oggi', m.aspetto.aspettoInUso('oggi', true), 'oggi')
}

// ---------------------------------------------------------------------------
titolo('indirizzi del Banco')
{
  const leggi = (h) => m.indirizzo.leggiIndirizzo(h, { prova: false })
  ok('#pagamenti e #tessere rimandano a CONTABILITÀ e ISCRITTI, #sito è una voce', ['#pagamenti', '#tessere', '#sito'].map((h) => leggi(h)?.voce), ['contabilita', 'iscritti', 'sito'])
  ok('VOCI non ha più tessere né pagamenti', m.indirizzo.VOCI.filter((v) => v === 'tessere' || v === 'pagamenti'), [])
}

// ---------------------------------------------------------------------------
titolo('luoghi del Banco')
{
  const { LUOGHI, luogoDi, voceInLista } = m.luoghi
  const VOCI = m.indirizzo.VOCI
  const nelleListe = LUOGHI.flatMap((l) => l.voci.map((v) => v.voce))

  ok('i luoghi sono cinque, in ordine', LUOGHI.map((l) => l.id), ['oggi', 'persone', 'corsi', 'soldi', 'palestra'])
  ok('i nomi dei luoghi', LUOGHI.map((l) => l.nome), ['OGGI', 'PERSONE', 'CORSI', 'SOLDI', 'PALESTRA'])
  const voci = (id) => (LUOGHI.find((l) => l.id === id)?.voci ?? []).map((v) => [v.voce, v.nome])
  ok('OGGI', voci('oggi'), [['dafare', 'OGGI'], ['settimana', 'SETTIMANA'], ['presenze', 'PRESENZE']])
  ok('PERSONE', voci('persone'), [['iscritti', 'ISCRITTI'], ['richieste', 'RICHIESTE ONLINE'], ['istruttori', 'ISTRUTTORI'], ['compensi', 'COMPENSI'], ['personale', 'ACCESSI']])
  ok('CORSI', voci('corsi'), [['corsi', 'CORSI']])
  // CONTABILITÀ è il primo: l'estratto conto è dove si apre di più.
  ok('SOLDI', voci('soldi'), [['contabilita', 'CONTABILITÀ'], ['importazioni', 'IMPORTAZIONI'], ['listino', 'LISTINO'], ['vestiario', 'VESTIARIO']])
  ok('PALESTRA', voci('palestra'), [['statistiche', 'STATISTICHE'], ['segnalazioni', 'SEGNALAZIONI'], ['sito', 'SITO'], ['regole', 'IMPOSTAZIONI']])

  // Chi ha solo l'amministrazione vede solo i luoghi con le sue voci, e dentro solo quelle.
  const nomi = (luoghi) => luoghi.map((l) => [l.id, l.voci.map((v) => v.voce)])
  ok('con tutte le voci i luoghi sono quelli di sempre', nomi(m.luoghi.luoghiPer(VOCI)).map(([id]) => id), ['oggi', 'persone', 'corsi', 'soldi', 'palestra'])
  ok('solo amministrazione: un luogo, SOLDI, con le voci dei conti', nomi(m.luoghi.luoghiPer(['contabilita', 'importazioni', 'listino'])), [['soldi', ['contabilita', 'importazioni', 'listino']]])
  ok('solo segreteria: SOLDI senza CONTABILITÀ', nomi(m.luoghi.luoghiPer(VOCI.filter((v) => v !== 'contabilita' && v !== 'importazioni'))).find(([id]) => id === 'soldi'), ['soldi', ['listino', 'vestiario']])
  ok('nessuna voce, nessun luogo', m.luoghi.luoghiPer([]), [])
  ok('i luoghi dati non cambiano', LUOGHI.length, 5)

  for (const v of VOCI) {
    // segnalate è una scheda di PRESENZE; palestra è la pagina d'ingresso del luogo, non una voce della riga.
    if (v === 'segnalate' || v === 'palestra') continue
    ok(`${v}: compare in uno e un solo luogo`, nelleListe.filter((x) => x === v).length, 1)
  }
  ok('nessuna voce in due luoghi', nelleListe.length, new Set(nelleListe).size)
  const ids = LUOGHI.map((l) => l.id)
  for (const v of VOCI) {
    const voluto = v === 'segnalate' ? 'oggi' : v === 'palestra' ? 'palestra' : LUOGHI.find((l) => l.voci.some((x) => x.voce === v))?.id
    ok(`luogoDi(${v}) è un luogo e quello giusto`, [ids.includes(luogoDi(v)), luogoDi(v)], [true, voluto])
  }
  // PALESTRA si apre di rado: il luogo porta a una pagina sua, con le quattro voci in grande, e nessuna voce accesa.
  const { voceDelLuogo } = m.luoghi
  ok('#palestra è una voce', m.indirizzo.leggiIndirizzo('#palestra', { prova: false })?.voce, 'palestra')
  ok('#palestra si riscrive uguale', m.indirizzo.scriviIndirizzo({ voce: 'palestra' }), '#palestra')
  ok('il luogo PALESTRA apre la pagina d\'ingresso', voceDelLuogo(LUOGHI.find((l) => l.id === 'palestra')), 'palestra')
  ok('gli altri luoghi aprono la loro prima voce', ['oggi', 'persone', 'corsi', 'soldi'].map((id) => voceDelLuogo(LUOGHI.find((l) => l.id === id))), ['dafare', 'iscritti', 'corsi', 'contabilita'])
  ok('solo amministrazione: SOLDI apre CONTABILITÀ', voceDelLuogo(m.luoghi.luoghiPer(['contabilita', 'listino'])[0]), 'contabilita')
  ok('la pagina d\'ingresso accende PALESTRA', luogoDi('palestra'), 'palestra')
  ok('…e nessuna voce della riga', LUOGHI.find((l) => l.id === 'palestra').voci.some((v) => v.voce === voceInLista('palestra')), false)
  ok('palestra non è una voce di nessun luogo', nelleListe.includes('palestra'), false)
  // Le tessere di LA PALESTRA nascono dalle voci del luogo: se ne cambia una, cambiano insieme.
  const tessere = (n) => m.luoghi.tesserePalestra?.(n) ?? []
  ok('le tessere sono le voci di PALESTRA, in ordine', tessere(0).map((t) => [t.voce, t.titolo]), voci('palestra'))
  ok('ogni tessera ha la sua frase', tessere(0).map((t) => t.frase.length > 0), [true, true, true, true])
  ok('nessuna segnalazione da rispondere: nessuno stato', tessere(0).map((t) => t.stato ?? null), [null, null, null, null])
  ok('1 da rispondere', tessere(1).map((t) => t.stato ?? null), [null, '1 da rispondere', null, null])
  ok('3 da rispondere, solo su SEGNALAZIONI', tessere(3).map((t) => t.stato ?? null), [null, '3 da rispondere', null, null])
  ok('segnalate sta in OGGI (è una scheda di PRESENZE)', luogoDi('segnalate'), 'oggi')
  ok('voceInLista: segnalate evidenzia presenze', voceInLista('segnalate'), 'presenze')
  for (const v of VOCI) if (v !== 'segnalate') ok(`voceInLista(${v}) è se stessa`, voceInLista(v), v)

  // Il guscio non perde voci: le tredici di oggi (GRUPPI di Segreteria.tsx) più le impostazioni.
  for (const v of ['dafare', 'settimana', 'richieste', 'presenze', 'iscritti', 'corsi', 'istruttori', 'personale', 'statistiche', 'listino', 'vestiario', 'segnalazioni', 'regole'])
    ok(`il Banco ha ancora ${v}`, nelleListe.includes(v), true)
}

// ---------------------------------------------------------------------------
// Persone di prova, a mano, con i tipi di segreteria.ts.
const persona = (id, cognome, nome, extra = {}) => ({
  id,
  nome,
  cognome,
  attiva: true,
  creataIl: '2026-09-01',
  iscrizioni: [{ corsoId: 'c1', dal: '2026-09-10' }],
  certificato: { scade: '2027-06-01', conFile: true },
  documento: true,
  pagamento: { stato: 'da_pagare' },
  quote: [],
  natoIl: '1990-05-01',
  ...extra,
})
const PAGATA = [{ anno: 2026, numero: 1, dal: '2026-09-01', al: '2027-07-31', mancano: 0 }]
const SENZA_CERT = { scade: undefined, conFile: false }
const CERT_SCADUTO = { scade: '2026-10-01', conFile: true }

titolo('cosaBlocca')
{
  const cb = (p) => m.blocca.cosaBlocca(p, OGGI)
  const a = persona('a', 'Rossi', 'Anna', { quote: PAGATA })
  ok('tutto a posto: niente', cb(a), null)
  ok('non attiva: niente', cb({ ...a, attiva: false, certificato: SENZA_CERT }), null)
  ok('non attiva e senza quota: niente', cb({ ...a, attiva: false, quote: [] }), null)

  ok('certificato mancante', cb({ ...a, certificato: SENZA_CERT }), { blocca: true, titolo: 'NON PUÒ ENTRARE IN SALA', frase: 'Manca il certificato medico.', tasto: 'certificato' })
  ok('certificato scaduto', cb({ ...a, certificato: CERT_SCADUTO }), { blocca: true, titolo: 'NON PUÒ ENTRARE IN SALA', frase: 'Il certificato è scaduto il 01/10/2026.', tasto: 'certificato' })
  ok('scaduto ieri conta come scaduto', cb({ ...a, certificato: { scade: '2026-10-17', conFile: false } })?.frase, 'Il certificato è scaduto il 17/10/2026.')
  ok('scade oggi vale ancora (in scadenza, niente guaio)', cb({ ...a, certificato: { scade: OGGI, conFile: true } }), null)

  ok('quota non pagata, certificato a posto: non blocca', cb({ ...a, quote: [] }), { blocca: false, titolo: 'QUOTA DA SISTEMARE', frase: 'La quota non è pagata.', tasto: 'quota' })
  ok(
    'quota scaduta',
    cb({ ...a, quote: [{ anno: 2025, numero: 3, dal: '2025-09-01', al: '2026-07-31', mancano: 0 }] }),
    { blocca: false, titolo: 'QUOTA DA SISTEMARE', frase: 'La quota è scaduta il 31/07/2026.', tasto: 'quota' },
  )
  ok(
    'quota pagata in parte da una ricevuta',
    cb({ ...a, quote: [{ anno: 2026, numero: 4, dal: '2026-09-01', al: '2027-07-31', mancano: 1550 }] }),
    { blocca: false, titolo: 'QUOTA DA SISTEMARE', frase: 'Mancano € 15,50 della quota.', tasto: 'quota' },
  )
  ok(
    'quota pagata in parte fuori app',
    cb({ ...a, quote: [], pagamento: { stato: 'in_parte', fino: '2027-07-31' } }),
    { blocca: false, titolo: 'QUOTA DA SISTEMARE', frase: 'La quota è pagata solo in parte.', tasto: 'quota' },
  )
  ok('quota pagata fuori app: niente', cb({ ...a, quote: [], pagamento: { stato: 'pagato', fino: '2027-07-31' } }), null)

  ok(
    'manca tutto: vince il certificato e la frase nomina solo lui',
    cb({ ...a, quote: [], certificato: SENZA_CERT }),
    { blocca: true, titolo: 'NON PUÒ ENTRARE IN SALA', frase: 'Manca il certificato medico.', tasto: 'certificato' },
  )
  ok('certificato in scadenza e quota ok: niente', cb({ ...a, certificato: { scade: '2026-11-01', conFile: true } }), null)
  ok('certificato in scadenza e quota da pagare: guaio di quota', cb({ ...a, quote: [], certificato: { scade: '2026-11-01', conFile: true } })?.tasto, 'quota')
  ok('sotto i 6 anni senza certificato, quota ok: niente', cb({ ...a, natoIl: '2022-01-01', certificato: SENZA_CERT }), null)
  ok('sotto i 6 anni, quota da pagare: solo la quota', cb({ ...a, natoIl: '2022-01-01', certificato: SENZA_CERT, quote: [] })?.tasto, 'quota')

  // Il tasto deve essere quello che la scheda propone a riposo.
  const casi = [
    { ...a, certificato: SENZA_CERT },
    { ...a, certificato: CERT_SCADUTO, quote: [] },
    { ...a, quote: [] },
    { ...a, quote: [], pagamento: { stato: 'in_parte', fino: '2027-07-31' } },
    { ...a, quote: [], certificato: SENZA_CERT },
  ]
  casi.forEach((p, i) => ok(`caso ${i + 1}: il tasto concorda con tastoPrincipale`, cb(p)?.tasto, m.segreteria.tastoPrincipale(p, OGGI)))
}

// ---------------------------------------------------------------------------
// Lezioni di oggi, con l'ora locale (senza fuso: si leggono sull'ora del giorno).
const ora = (h, mi = 0) => `${OGGI}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:00`
const lezione = (id, salaId, [h1, m1], [h2, m2], extra = {}) => ({
  id,
  corsoId: `c-${id}`,
  corso: `Corso ${id}`,
  salaId,
  sala: salaId,
  istruttori: 'Gianni',
  inizio: ora(h1, m1),
  fine: ora(h2, m2),
  stato: 'prevista',
  straordinaria: false,
  iscritti: 12,
  presenti: 0,
  segnati: 0,
  ...extra,
})
const adesso = (h, mi = 0) => new Date(2026, 9, 18, h, mi)

titolo('giornata: il tabellone')
{
  const SALE = [{ id: 's1', nome: 'Sala 1' }, { id: 's2', nome: 'Sala 2' }]
  const t = (l, s = SALE, quando = adesso(18), o) => m.giornata.tabellone(l, s, quando, o)
  const bl = (tab, c = 0) => tab.colonne[c]?.blocchi ?? []

  const vuoto = t([], [], adesso(18))
  ok('senza sale né lezioni: nessuna colonna', vuoto.colonne, [])
  ok('la fascia di partenza è 16-21', [vuoto.dalleOre, vuoto.alleOre], [16, 21])
  ok('una colonna per sala, anche vuota, nell\'ordine delle sale', t([]).colonne.map((c) => [c.sala?.id, c.blocchi.length]), [['s1', 0], ['s2', 0]])

  const x = t([lezione('a', 's1', [17, 0], [18, 0])])
  ok('lezione 17-18: top 96', bl(x)[0]?.top, 96)
  ok('lezione 17-18: altezza 96', bl(x)[0]?.altezza, 96)
  const y = t([lezione('b', 's1', [17, 30], [19, 0])])
  ok('lezione 17:30-19: top 144', bl(y)[0]?.top, 144)
  ok('lezione 17:30-19: altezza 144', bl(y)[0]?.altezza, 144)
  ok('il blocco porta la sua lezione', bl(y)[0]?.lezione.id, 'b')
  const z = t([lezione('c', 's1', [18, 0], [19, 0])], SALE, adesso(18), { dalleOre: 17, oraPx: 60 })
  ok('con oraPx 60 e dalle 17: top 60, altezza 60', [bl(z)[0]?.top, bl(z)[0]?.altezza], [60, 60])

  ok('lezione sulla sala 2 va nella colonna 2', bl(t([lezione('d', 's2', [17, 0], [18, 0])]), 1).length, 1)
  ok('i blocchi sono in ordine di inizio', bl(t([lezione('tardi', 's1', [19, 0], [20, 0]), lezione('presto', 's1', [16, 30], [17, 30])])).map((b) => b.lezione.id), ['presto', 'tardi'])

  ok('senza lezioni orfane non c\'è la colonna in fondo', t([lezione('a', 's1', [17, 0], [18, 0])]).colonne.length, 2)
  const orfane = t([lezione('senza', undefined, [17, 0], [18, 0]), lezione('ignota', 'sX', [18, 0], [19, 0])])
  ok('lezioni senza sala o con sala ignota: colonna in fondo', [orfane.colonne.length, orfane.colonne[2]?.sala, orfane.colonne[2]?.blocchi.map((b) => b.lezione.id)], [3, null, ['senza', 'ignota']])
  ok('le colonne delle sale restano vuote', orfane.colonne.slice(0, 2).map((c) => c.blocchi.length), [0, 0])

  const stato = (l, quando) => bl(t([l], SALE, quando))[0]?.stato
  ok('finita con appello fatto: fatto', stato(lezione('e', 's1', [16, 0], [17, 0], { segnati: 10 }), adesso(18)), 'fatto')
  ok('finita senza appello: appello non fatto', stato(lezione('f', 's1', [16, 0], [17, 0]), adesso(18)), 'appello_non_fatto')
  ok('in corso', stato(lezione('g', 's1', [17, 30], [18, 30]), adesso(18)), 'in_corso')
  ok('in corso con l\'appello già fatto: resta in corso', stato(lezione('g2', 's1', [17, 30], [18, 30], { segnati: 5 }), adesso(18)), 'in_corso')
  ok('comincia adesso: in corso', stato(lezione('h', 's1', [18, 0], [19, 0]), adesso(18)), 'in_corso')
  ok('deve ancora cominciare: prossima', stato(lezione('i', 's1', [19, 0], [20, 0]), adesso(18)), 'prossima')
  ok('annullata nel passato: annullata, non appello non fatto', stato(lezione('j', 's1', [16, 0], [17, 0], { stato: 'annullata' }), adesso(18)), 'annullata')
  ok('annullata nel futuro: annullata', stato(lezione('k', 's1', [19, 0], [20, 0], { stato: 'annullata' }), adesso(18)), 'annullata')

  ok('la riga rossa alle 18:30 sta a 240', t([], SALE, adesso(18, 30)).adesso, 240)
  ok('la riga rossa alle 22:00 non c\'è', t([], SALE, adesso(22)).adesso, null)
  ok('la riga rossa alle 15:00 non c\'è', t([], SALE, adesso(15)).adesso, null)
  ok('la riga rossa con la fascia 17-21 e oraPx 60, alle 18:30', t([], SALE, adesso(18, 30), { dalleOre: 17, oraPx: 60 }).adesso, 90)
  ok('la riga rossa alle 16:00 in punto sta a 0', t([], SALE, adesso(16)).adesso, 0)
  ok('la riga rossa alle 21:00 in punto sta a 480', t([], SALE, adesso(21)).adesso, 480)
  // Al secondo esatto in cui finisce, la lezione è ancora «in corso»: l'appello si fa fino all'ultimo minuto.
  ok('adesso uguale alla fine: in corso, non appello non fatto', bl(t([lezione('a', 's1', [17, 0], [18, 0])], SALE, adesso(18)))[0]?.stato, 'in_corso')

  const fuori = t([lezione('m', 's1', [15, 0], [16, 0])])
  ok('lezione alle 15 non si scarta: compare con top negativo', [bl(fuori).length, bl(fuori)[0]?.top], [1, -96])
  const dopo = t([lezione('n', 's1', [21, 30], [22, 30])])
  ok('lezione alle 21:30 non si scarta: top oltre la fascia', [bl(dopo).length, bl(dopo)[0]?.top], [1, 528])
}

// ---------------------------------------------------------------------------
titolo('giornata: la fascia delle ore')
{
  const f = (l) => m.giornata.fasciaDelleLezioni?.(l)
  ok('senza lezioni: 16-21', f([]), { dalleOre: 16, alleOre: 21 })
  ok('lezioni dentro la fascia: resta 16-21', f([lezione('a', 's1', [17, 0], [18, 0])]), { dalleOre: 16, alleOre: 21 })
  ok('una lezione alle 15 allarga all\'indietro', f([lezione('a', 's1', [15, 0], [16, 0])])?.dalleOre, 15)
  ok('una lezione che finisce alle 21:30 allarga fino alle 22', f([lezione('a', 's1', [20, 30], [21, 30])])?.alleOre, 22)
  ok('una lezione che finisce alle 21:00 non allarga', f([lezione('a', 's1', [20, 0], [21, 0])])?.alleOre, 21)
  // La fine a mezzanotte cade il giorno dopo: l'ora locale è 0, ma la fascia arriva a 24.
  const finePerNotte = new Date(ora(23, 0))
  finePerNotte.setHours(24, 0, 0, 0)
  const tarda = { ...lezione('n', 's1', [23, 0], [23, 59]), fine: finePerNotte.toISOString() }
  ok('una lezione che finisce a mezzanotte porta la fascia a 24', f([tarda])?.alleOre, 24)
}

titolo('giornata: il riepilogo')
{
  // Le 18:30: la lezione delle 17-18 è finita da mezz'ora.
  const r = (l, q = adesso(18, 30)) => m.giornata.riepilogoGiornata?.(l, q)
  ok('senza lezioni: tutto a zero', r([]), { presenti: 0, attesi: 0, appelliDaFare: 0 })
  const l1 = lezione('a', 's1', [16, 0], [17, 0], { iscritti: 10, presenti: 8, segnati: 10 })
  const l2 = lezione('b', 's1', [17, 0], [18, 0], { iscritti: 12 })
  const l3 = lezione('c', 's1', [19, 0], [20, 0], { iscritti: 14 })
  const l4 = lezione('d', 's1', [16, 0], [17, 0], { iscritti: 9, presenti: 5, stato: 'annullata' })
  ok('presenti e attesi sommano le lezioni non annullate', [r([l1, l2, l3, l4])?.presenti, r([l1, l2, l3, l4])?.attesi], [8, 36])
  ok('un appello da fare: fine passata e nessun segno', r([l1, l2, l3])?.appelliDaFare, 1)
  ok('l\'annullata non vale come appello da fare', r([l4])?.appelliDaFare, 0)
  ok('una lezione non ancora finita non è un appello mancante', r([l3])?.appelliDaFare, 0)
  ok('coincide con i blocchi del tabellone', r([l1, l2, l3, l4])?.appelliDaFare, m.giornata.tabellone([l1, l2, l3, l4], [{ id: 's1', nome: 'Sala 1' }], adesso(18, 30)).colonne.flatMap((c) => c.blocchi).filter((b) => b.stato === 'appello_non_fatto').length)
}

titolo('giornata: il sottotitolo di OGGI')
{
  // I presenti stanno qui e non fra le cifre: le cifre sono solo cose da sistemare, le stesse della striscia.
  const s = (n, r) => m.giornata.sottotitoloOggi('giovedì 22 ottobre', n, r)
  ok('lezioni, appelli e presenti', s(6, { presenti: 15, attesi: 27, appelliDaFare: 8 }), 'giovedì 22 ottobre · 6 lezioni, 8 appelli da fare · 15 presenti su 27 attesi.')
  ok('un appello solo è al singolare', s(6, { presenti: 15, attesi: 27, appelliDaFare: 1 }), 'giovedì 22 ottobre · 6 lezioni, 1 appello da fare · 15 presenti su 27 attesi.')
  ok('una lezione sola è al singolare', s(1, { presenti: 3, attesi: 9, appelliDaFare: 0 }), 'giovedì 22 ottobre · 1 lezione · 3 presenti su 9 attesi.')
  ok('un presente e un atteso al singolare', s(1, { presenti: 1, attesi: 1, appelliDaFare: 0 }), 'giovedì 22 ottobre · 1 lezione · 1 presente su 1 atteso.')
  ok('un presente su tanti attesi', s(8, { presenti: 1, attesi: 80, appelliDaFare: 0 }), 'giovedì 22 ottobre · 8 lezioni · 1 presente su 80 attesi.')
  ok('senza lezioni: niente presenti', s(0, { presenti: 0, attesi: 0, appelliDaFare: 0 }), 'giovedì 22 ottobre · nessuna lezione.')
  ok('lezioni non ancora lette: solo la data', s(0, null), 'giovedì 22 ottobre.')
}

titolo('coda del banco')
{
  const cod = (i, oggi = OGGI) => m.coda.codaBanco({ appelli: [], persone: [], richieste: 0, istruttori: 0, ...i }, oggi)
  const ids = (r) => r.map((x) => x.id)
  const app = (id, [h, mi], iscritti = 12) => lezione(id, 's1', [h, mi], [h + 1, mi], { iscritti })
  const ok1 = (id, cognome, nome, extra = {}) => persona(id, cognome, nome, { quote: PAGATA, ...extra })

  ok('tutto a posto: niente', cod({ persone: [ok1('a', 'Rossi', 'Anna')] }), [])
  ok('senza niente: niente', cod({}), [])

  // (a) gli appelli
  const uno = cod({ appelli: [app('x', [17, 0], 9)] })
  ok('un appello non fatto: una riga che blocca', uno, [
    { id: 'appello-x', livello: 'blocca', titolo: 'Corso x · appello non fatto', sotto: 'Erano alle 17:00. 9 iscritti da segnare.', tasto: 'Fai l’appello', vai: { voce: 'settimana', lezione: { id: 'x', inizio: ora(17) } } },
  ])
  // Un appello di un altro giorno dice quale: due lezioni uguali non si distinguono dall'ora.
  const vecchio = { ...app('y', [17, 0], 9), inizio: '2000-01-03T17:00:00', fine: '2000-01-03T18:00:00' }
  const sottoVecchio = cod({ appelli: [vecchio] })[0]?.sotto ?? ''
  ok('appello di un altro giorno: nomina il giorno e non dice «Erano» da solo', [sottoVecchio.includes('3 gennaio'), sottoVecchio.startsWith('Erano alle')], [true, false])
  ok('appello di un altro giorno: ora e iscritti restano', sottoVecchio.endsWith('alle 17:00. 9 iscritti da segnare.'), true)
  const tre = cod({ appelli: [app('a', [16, 0]), app('b', [17, 0]), app('c', [18, 0])] })
  ok('tre appelli: tre righe, la più recente prima, senza «altri»', ids(tre), ['appello-c', 'appello-b', 'appello-a'])
  const cinque = cod({ appelli: [app('a', [16, 0]), app('b', [17, 0]), app('c', [18, 0]), app('d', [19, 0]), app('e', [20, 0])] })
  ok('cinque appelli: tre più «altri»', ids(cinque), ['appello-e', 'appello-d', 'appello-c', 'appelli-altri'])
  ok('«altri» appelli', cinque[3], { id: 'appelli-altri', livello: 'blocca', titolo: 'Altri 2 appelli non fatti', sotto: cinque[3]?.sotto, tasto: 'Vedi tutti', vai: { voce: 'presenze', filtro: 'senza-appello' } })

  // (b) il certificato
  const cert = (id, cognome, nome, extra) => ok1(id, cognome, nome, { certificato: SENZA_CERT, ...extra })
  const c1 = cod({ persone: [cert('p1', 'Rossi', 'Anna')] })
  ok('un senza certificato: una riga', c1, [
    { id: 'certificato-p1', livello: 'blocca', titolo: 'Rossi Anna · certificato mancante', sotto: 'Manca il certificato medico.', tasto: 'Apri la scheda', vai: { voce: 'iscritti', persona: 'p1' } },
  ])
  const c2 = cod({ persone: [ok1('p2', 'Verdi', 'Carla', { certificato: CERT_SCADUTO })] })
  ok('certificato scaduto: titolo e frase', [c2[0]?.titolo, c2[0]?.sotto], ['Verdi Carla · certificato scaduto', 'Il certificato è scaduto il 01/10/2026.'])
  const molti = ['Zeta', 'Beta', 'Alfa', 'Delta', 'Gamma'].map((c, i) => cert(`z${i}`, c, 'Mario'))
  const c5 = cod({ persone: molti })
  ok('cinque senza certificato: tre per cognome e «altri»', ids(c5), ['certificato-z2', 'certificato-z1', 'certificato-z3', 'certificati-altri'])
  ok('«altri» certificati', [c5[3]?.titolo, c5[3]?.tasto, c5[3]?.vai], ['Altri 2 senza certificato', 'Vedi chi', { voce: 'iscritti', filtro: 'certificato' }])
  ok('a pari cognome conta il nome', ids(cod({ persone: [cert('b', 'Rossi', 'Bruno'), cert('a', 'Rossi', 'Anna')] })), ['certificato-a', 'certificato-b'])
  ok('tre senza certificato: niente «altri»', ids(cod({ persone: molti.slice(0, 3) })).includes('certificati-altri'), false)
  ok('chi non è attivo non conta', cod({ persone: [cert('i', 'Rossi', 'Anna', { attiva: false })] }), [])
  ok('sotto i 6 anni senza certificato non conta', cod({ persone: [cert('j', 'Rossi', 'Anna', { natoIl: '2022-01-01' })] }), [])

  // (c) la quota
  const senzaQuota = (id, cognome, nome, extra) => persona(id, cognome, nome, extra)
  const q1 = cod({ persone: [senzaQuota('q1', 'Neri', 'Dario')] })
  ok('quota non pagata: una riga che blocca', q1, [
    { id: 'quota-q1', livello: 'blocca', titolo: 'Neri Dario · quota non pagata', sotto: 'La quota non è pagata.', tasto: 'Fai la ricevuta', vai: { voce: 'iscritti', persona: 'q1' } },
  ])
  ok('chi ha già il certificato mancante non si ripete per la quota', ids(cod({ persone: [senzaQuota('d', 'Neri', 'Dario', { certificato: SENZA_CERT })] })), ['certificato-d'])
  ok('quota in parte e scaduta contano', ids(cod({ persone: [senzaQuota('p', 'Alfa', 'A', { quote: [{ anno: 2026, numero: 4, dal: '2026-09-01', al: '2027-07-31', mancano: 500 }] }), senzaQuota('s', 'Beta', 'B', { quote: [{ anno: 2025, numero: 3, dal: '2025-09-01', al: '2026-07-31', mancano: 0 }] })] })), ['quota-p', 'quota-s'])
  const q5 = cod({ persone: ['Zeta', 'Beta', 'Alfa', 'Delta', 'Gamma'].map((c, i) => senzaQuota(`y${i}`, c, 'Mario')) })
  ok('cinque da pagare: tre più «altri»', ids(q5), ['quota-y2', 'quota-y1', 'quota-y3', 'quote-altre'])
  ok('«altri» da pagare', [q5[3]?.livello, q5[3]?.titolo, q5[3]?.tasto, q5[3]?.vai], ['blocca', 'Altri 2 da pagare', 'Vedi chi', { voce: 'iscritti', filtro: 'pagare' }])
  const q3 = cod({ persone: ['Zeta', 'Beta', 'Alfa'].map((c, i) => senzaQuota(`z${i}`, c, 'Mario')) })
  ok('tre da pagare esatti: niente «altri»', ids(q3), ['quota-z2', 'quota-z1', 'quota-z0'])
  ok('la quota non pagata di chi non è attivo non conta', cod({ persone: [senzaQuota('n', 'Neri', 'Dario', { attiva: false })] }), [])

  // (d) le cose da fare presto
  ok('richieste: plurale', cod({ richieste: 3 }), [{ id: 'richieste', livello: 'presto', titolo: '3 richieste online nuove', sotto: cod({ richieste: 3 })[0]?.sotto, tasto: 'Accogli', vai: { voce: 'richieste' } }])
  ok('richieste: singolare', cod({ richieste: 1 })[0]?.titolo, '1 richiesta online nuova')
  ok('istruttori: plurale', [cod({ istruttori: 2 })[0]?.titolo, cod({ istruttori: 2 })[0]?.tasto, cod({ istruttori: 2 })[0]?.vai], ['2 presenze istruttori da confermare', 'Conferma', { voce: 'istruttori' }])
  ok('istruttori: singolare', cod({ istruttori: 1 })[0]?.titolo, '1 presenza istruttore da confermare')
  ok('segnalate: plurale', [cod({ segnalate: 4 })[0]?.titolo, cod({ segnalate: 4 })[0]?.tasto, cod({ segnalate: 4 })[0]?.vai], ['4 presenze segnalate da vedere', 'Vedi', { voce: 'segnalate' }])
  ok('segnalate: singolare', cod({ segnalate: 1 })[0]?.titolo, '1 presenza segnalata da vedere')
  ok('segnalate 0 o assenti: niente', [cod({ segnalate: 0 }), cod({})], [[], []])
  ok('livello delle cose da fare presto', cod({ richieste: 1, istruttori: 1, segnalate: 1 }).map((r) => r.livello), ['presto', 'presto', 'presto'])

  // l'ordine
  const tutto = cod({ appelli: [app('x', [17, 0])], persone: [cert('c', 'Rossi', 'Anna'), senzaQuota('q', 'Neri', 'Dario')], richieste: 2, istruttori: 1, segnalate: 1 })
  ok('l\'ordine: appelli, certificati, quote, poi le cose da fare presto', ids(tutto), ['appello-x', 'certificato-c', 'quota-q', 'richieste', 'istruttori', 'segnalate'])
  ok('i «blocca» vengono prima dei «presto»', tutto.map((r) => r.livello), ['blocca', 'blocca', 'blocca', 'presto', 'presto', 'presto'])
}

// Il rosso di «Fai la ricevuta» viene dall'id della riga, non dal testo del tasto: le parole si cambiano, il segnale no.
{
  const oggiTsx = (await import('node:fs')).readFileSync('src/components/segreteria/banco/Oggi.tsx', 'utf8')
  ok('Oggi.tsx non confronta il testo del tasto', /\.tasto\s*[!=]==/.test(oggiTsx), false)
  // Le cifre di OGGI sono la striscia COSA MANCA: un conto solo, non un secondo che può divergere.
  ok('le cifre di OGGI sono le caselle della striscia', /caselleDaMostrare\(conti\.striscia\)/.test(oggiTsx), true)
  ok('le cifre aprono la voce e il filtro della casella', /onVai\(c\.voce, c\.filtro/.test(oggiTsx), true)
}
// Il titolo della scheda del browser dice la sezione: si riconosce fra le schede aperte, nella cronologia e nei segnalibri.
{
  const t = m.luoghi.titoloDellaVoce
  ok('CONTABILITÀ ha il suo titolo', t('contabilita'), 'Contabilità - Segreteria - Centro Judo')
  ok('DA FARE si chiama come nel menu, OGGI', t('dafare'), 'Oggi - Segreteria - Centro Judo')
  ok('le segnalate sono una scheda di PRESENZE', t('segnalate'), 'Presenze - Segreteria - Centro Judo')
  ok('PALESTRA, che non è nella seconda riga', t('palestra'), 'Palestra - Segreteria - Centro Judo')
  ok('RICHIESTE ONLINE, due parole', t('richieste'), 'Richieste online - Segreteria - Centro Judo')
  ok('ogni voce ha un titolo suo', m.indirizzo.VOCI.filter((v) => !/^[A-Z][a-zà-ù ]+ - Segreteria - Centro Judo$/.test(t(v))), [])
  ok('un\'area col suo nome', m.luoghi.titolo('ISCRIZIONI'), 'Iscrizioni - Centro Judo')
}
console.log(guai ? `\n${guai} prove non passano` : '\nTutto bene')
process.exit(guai ? 1 : 0)
