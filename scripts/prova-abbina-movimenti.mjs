// ---------------------------------------------------------------------------
// Chi ha pagato un movimento non identificato (banca o Satispay), senza browser.
//
//   node scripts/prova-abbina-movimenti.mjs
//
// Controlla `src/lib/abbinaMovimenti.ts` e il riquadro «Suggerito» di `suggerimentoMovimento.ts`: il punteggio che somma
// i segnali (nome e cognome interi nel testo, nome e cognome del genitore, codice fiscale letto dalla causale, corso
// dell'importo col cognome, lo storico dei movimenti uguali già collegati, nome di battesimo e corso, il cognome);
// l'ordine (punteggio, poi chi non è iscritto il giorno del movimento, poi cognome e nome); la preselezione solo se il
// primo è «sicuro» (alto e staccato dal secondo; mai per «nome e corso»); cosa esce (mai codici, genitori, date, corsi,
// punteggi). Gli stessi casi, con gli
// stessi messaggi, di supabase/prova/abbina-movimenti.sql: la modalità prova e il database danno lo stesso risultato.
// «Importa banca → Da decidere» si prova in prova-importa-banca.mjs, la lettura del codice fiscale pure.
// I nomi e i codici sono tutti inventati: il repository è pubblico.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

// Un modulo che non c'è ancora non ferma la prova: ogni caso dice la sua cosa mancante.
const carica = async (contenuto) => {
  try {
    const { outputFiles } = await build({ stdin: { contents: contenuto, resolveDir: '.', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' } })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log('  (non si carica:', e.errors?.[0]?.text ?? e.message, ')')
    return {}
  }
}
const a = await carica("export * from './src/lib/abbinaMovimenti'")
const s = await carica("export { suggerisciMovimento, confermaDi } from './src/lib/suggerimentoMovimento'")

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

// Una persona come la vede la modalità prova (che ha tutto): il database ne rende solo id, nome, cognome e il segno.
const P = (id, nome, cognome, o = {}) => ({ id, nome, cognome, attiva: true, codiceFiscale: null, genitoreNome: null, genitoreCognome: null, genitoreCodiceFiscale: null, iscrizioni: [], ...o })
const CF_VACCARO = 'VCCNDR75B02L219Z'
const CF_GALLO = 'GLLMRT85C45L219P'
const CF_PRUDENTE = 'PRDDNC70A01L219K'
const persone = [
  P('manuel', 'Manuel', 'Prudente', { genitoreNome: 'Domenico', genitoreCognome: 'Prudente', genitoreCodiceFiscale: CF_PRUDENTE }),
  P('luca', 'Luca', 'Prudente'),
  P('sofia', 'Sofia', 'Bruno', { genitoreNome: 'Andrea', genitoreCognome: 'Vaccaro', genitoreCodiceFiscale: CF_VACCARO }),
  P('elia', 'Elia', 'Bruno', { genitoreNome: 'Andrea', genitoreCognome: 'Vaccaro', genitoreCodiceFiscale: CF_VACCARO }),
  P('ines', 'Ines', 'Bruno', { attiva: false, genitoreNome: 'Andrea', genitoreCognome: 'Vaccaro', genitoreCodiceFiscale: CF_VACCARO }),
  P('marta', 'Marta', 'Gallo', { codiceFiscale: CF_GALLO }),
  // Viste dal 9/10/2026: Anna sì; Bruno finita a settembre; Carlo comincia a novembre; Dora finita il 15/10 (a oggi
  // non c'è più, ma il 9 c'era); Ennio sì.
  P('anna', 'Anna', 'Ferri', { iscrizioni: [{ dal: '2026-09-01', al: null }] }),
  P('bruno', 'Bruno', 'Ferri', { iscrizioni: [{ dal: '2025-09-01', al: '2026-09-30' }] }),
  P('carlo', 'Carlo', 'Ferri', { iscrizioni: [{ dal: '2026-11-01', al: null }] }),
  P('dora', 'Dora', 'Ferri', { iscrizioni: [{ dal: '2026-09-01', al: '2026-10-15' }] }),
  P('ennio', 'Ennio', 'Ferri', { iscrizioni: [{ dal: '2026-09-01', al: null }] }),
  ...Array.from({ length: 10 }, (_, i) => P(`pini${String(i + 1).padStart(2, '0')}`, `Pino${i + 1}`, 'Pini', { genitoreNome: 'Rosa', genitoreCognome: 'Pini' })),
]
// Come il database: un testo, il giorno del movimento, i codici letti (solo dei bancari nuovi).
const abbina = (testo, codiciFiscali = [], data = '2026-10-09', elenco = persone, precedenti = []) => prova(() => a.abbinaMovimento({ testo, data, codiciFiscali, precedenti }, elenco))
const elenca = (r) => (r.candidati ? r.candidati.map((c) => `${c.nome} ${c.cognome} (${c.come}${c.giaIscritto ? ', già iscritto' : ''})`).join('; ') || 'nessuno' : r)

console.log('1. nome e cognome interi nel testo')
ok('«Prudente Domenico» è il genitore, e un cognome solo non basta: Manuel Prudente, per nome intero', elenca(abbina('Da PRUDENTE DOMENICO,MANCA FEDERICA PAOLA, TRN 1 per Quota associativa 2026/2027 Prudente Manuel BONIFICO SEPA')), 'Manuel Prudente (nome intero)')
ok('…ed è preselezionato: nome, genitore e cognome sommati, Luca (solo il cognome) molto sotto', abbina('Da PRUDENTE DOMENICO,MANCA FEDERICA PAOLA, TRN 1 per Quota associativa 2026/2027 Prudente Manuel BONIFICO SEPA').preselezionato, 'manuel')
ok('in qualunque ordine, senza maiuscole né accenti', elenca(abbina('da manuél prudente trn')), 'Manuel Prudente (nome intero)')
ok('solo il cognome (o solo il nome) non basta', elenca(abbina('Da PRUDENTE LUCIANO BONIFICO SEPA')), 'nessuno')
ok('il nome intero dell\'adulto che paga per sé', elenca(abbina('Da GALLO MARTA TRN 5 BONIFICO SEPA')), 'Marta Gallo (nome intero)')
ok('chi non è più attivo non esce', elenca(abbina('Da Bruno Ines TRN 5', [], '2026-10-09')), 'nessuno')

console.log('\n2. nome e cognome del genitore nel testo, i figli')
ok('Andrea Vaccaro nel testo: i suoi figli attivi (non Ines), a scegliere', elenca(abbina('Da VACCARO ANDREA TRN 2 BONIFICO SEPA')), 'Elia Bruno (genitore); Sofia Bruno (genitore)')
ok('…nessuno preselezionato, perché sono due', abbina('Da VACCARO ANDREA TRN 2 BONIFICO SEPA').preselezionato, null)
ok('un solo figlio: preselezionato, col segno «genitore»', prova(() => { const r = a.abbinaMovimento({ testo: 'Da VACCARO ANDREA TRN 2', data: '2026-10-09', codiciFiscali: [] }, persone.filter((p) => p.id !== 'elia')); return [elenca(r), r.preselezionato] }), ['Sofia Bruno (genitore)', 'sofia'])
ok('il cognome del genitore da solo (o il nome) non basta', elenca(abbina('Da VACCARO TRN 2')), 'nessuno')
ok('un genitore senza cognome nella scheda non si abbina per il solo nome', elenca(abbina('Da Andrea TRN 2', [], '2026-10-09', [P('x', 'Ugo', 'Rizzo', { genitoreNome: 'Andrea' })])), 'nessuno')
ok('il nome pesa più del genitore, ma non lo nasconde: tutti, Marta per prima', elenca(abbina('Da VACCARO ANDREA per Gallo Marta TRN 2')), 'Marta Gallo (nome intero); Elia Bruno (genitore); Sofia Bruno (genitore)')
ok('…e nessuno preselezionato: il primo non è staccato abbastanza dal secondo', abbina('Da VACCARO ANDREA per Gallo Marta TRN 2').preselezionato, null)

console.log('\n3. il codice fiscale letto dalla causale (solo bancari nuovi)')
ok('il codice del genitore: i suoi figli', elenca(abbina('Da ROSSI GINO TRN 3 BONIFICO SEPA', [CF_VACCARO])), 'Elia Bruno (codice fiscale); Sofia Bruno (codice fiscale)')
ok('se paga l\'adulto per sé, il suo codice', elenca(abbina('Da ROSSI GINO TRN 4 BONIFICO SEPA', [CF_GALLO])), 'Marta Gallo (codice fiscale)')
ok('nome e codice di due persone diverse: tutte e due, il nome (col cognome) prima', elenca(abbina('Da GALLO MARTA TRN 5 BONIFICO SEPA', [CF_VACCARO])), 'Marta Gallo (nome intero); Elia Bruno (codice fiscale); Sofia Bruno (codice fiscale)')
ok('genitore per nome e codice di un\'altra: a pari, cognome e nome', elenca(abbina('Da VACCARO ANDREA TRN 5 BONIFICO SEPA', [CF_GALLO])), 'Elia Bruno (genitore); Sofia Bruno (genitore); Marta Gallo (codice fiscale)')
ok('il codice da solo, di una persona sola: preselezionata', abbina('Da ROSSI GINO TRN 4 BONIFICO SEPA', [CF_GALLO]).preselezionato, 'marta')
ok('un codice di nessuno non propone nessuno', elenca(abbina('Da ROSSI GINO TRN 6 BONIFICO SEPA', ['ZZZZZZ99Z99Z999Z'])), 'nessuno')
ok('senza codici letti (movimenti già importati, Satispay): il codice non conta', elenca(abbina('Da ROSSI GINO TRN 7 BONIFICO SEPA', [])), 'nessuno')
ok('due codici nella causale: contano tutti e due', elenca(abbina('Da ROSSI GINO TRN 8', [CF_PRUDENTE, CF_GALLO], '2026-10-09', persone.filter((p) => p.id !== 'manuel'))), 'Marta Gallo (codice fiscale)')

console.log('\n4. l\'ordine a pari punteggio: chi non è iscritto il giorno del movimento prima, chi lo è dopo')
const ferri = abbina('Da Ferri Anna, Ferri Bruno, Ferri Carlo, Ferri Dora BONIFICO SEPA')
ok('non iscritti (Bruno: finita; Carlo: comincia dopo) prima, poi iscritti (Anna; Dora, che il 9 c\'era anche se oggi no), «già iscritto»', elenca(ferri), 'Bruno Ferri (nome intero); Carlo Ferri (nome intero); Anna Ferri (nome intero, già iscritto); Dora Ferri (nome intero, già iscritto)')
ok('conta il giorno del movimento: Dora, iscritta fino al 15/10, il 20 non lo è e il 15 sì', [elenca(abbina('Da Ferri Dora', [], '2026-10-20')), elenca(abbina('Da Ferri Dora', [], '2026-10-15'))], ['Dora Ferri (nome intero)', 'Dora Ferri (nome intero, già iscritto)'])
ok('l\'iscrizione comincia il suo primo giorno e finisce l\'ultimo, compresi', [elenca(abbina('Da Ferri Carlo', [], '2026-11-01')), elenca(abbina('Da Ferri Carlo', [], '2026-10-31'))], ['Carlo Ferri (nome intero, già iscritto)', 'Carlo Ferri (nome intero)'])
ok('un iscritto non si esclude mai: si propone col segno', elenca(abbina('Da Ferri Ennio BONIFICO SEPA')), 'Ennio Ferri (nome intero, già iscritto)')
ok('…ma da solo non è mai preselezionato', abbina('Da Ferri Ennio BONIFICO SEPA').preselezionato, null)
ok('non iscritto e iscritto insieme: due candidati, si sceglie a mano', abbina('Da Ferri Bruno, Ferri Anna').preselezionato, null)
ok('l\'ordine vale anche per il genitore e il codice', prova(() => elenca(a.abbinaMovimento({ testo: 'Da VACCARO ANDREA', data: '2026-10-09', codiciFiscali: [] }, persone.map((p) => (p.id === 'elia' ? { ...p, iscrizioni: [{ dal: '2026-09-01', al: null }] } : p))))), 'Sofia Bruno (genitore); Elia Bruno (genitore, già iscritto)')
ok('al massimo otto', prova(() => a.abbinaMovimento({ testo: 'Da Rosa Pini BONIFICO SEPA', data: '2026-10-09', codiciFiscali: [] }, persone).candidati.length), 8)
ok('…i primi otto in ordine di cognome e nome', prova(() => a.abbinaMovimento({ testo: 'Da Rosa Pini BONIFICO SEPA', data: '2026-10-09', codiciFiscali: [] }, persone).candidati.map((c) => c.nome).join(',')), 'Pino1,Pino10,Pino2,Pino3,Pino4,Pino5,Pino6,Pino7')

console.log('\n5. la privacy: dell\'abbinamento esce solo quel che serve')
ok('di ogni candidato: id, nome, cognome, come, già iscritto e sicuro; mai codici, genitori, date, corsi o punteggi', prova(() => Object.keys(abbina('Da VACCARO ANDREA').candidati[0]).sort()), ['cognome', 'come', 'giaIscritto', 'id', 'nome', 'sicuro'])
ok('l\'esito intero non contiene né codici né il nome del genitore', prova(() => { const j = JSON.stringify(abbina('Da VACCARO ANDREA')); return [j.includes(CF_VACCARO), j.includes('Andrea'), j.includes('2026-09-01')] }), [false, false, false])

console.log('\n6. ordinaAbbinati: le righe che il database rende, già in ordine')
{
  const x = (id, nome, cognome, giaIscritto = false, sicuro = false) => ({ id, nome, cognome, come: 'nome intero', giaIscritto, sicuro })
  const o = (l) => prova(() => a.ordinaAbbinati(l))
  ok('l\'ordine è quello del database (il punteggio lo sa lui)', prova(() => o([x('c', 'Zeta', 'Alfa', true), x('b', 'Bea', 'Beta'), x('a', 'Ada', 'Beta')]).candidati.map((c) => c.id)), ['c', 'b', 'a'])
  ok('il primo «sicuro»: preselezionato', o([x('a', 'Ada', 'Beta', false, true), x('b', 'Bea', 'Beta')]).preselezionato, 'a')
  ok('uno solo ma non «sicuro»: no', o([x('a', 'Ada', 'Beta')]).preselezionato, null)
  ok('nessuno: niente', prova(() => [o([]).candidati, o([]).preselezionato]), [[], null])
  ok('«nome e corso» non è mai preselezionato, neanche se il database lo dicesse «sicuro»', o([{ ...x('a', 'Ada', 'Beta', false, true), come: 'nome e corso' }]).preselezionato, null)
  ok('al massimo otto, anche se il database ne rendesse di più', prova(() => o(Array.from({ length: 12 }, (_, i) => x(`i${i}`, 'N', `C${String(i).padStart(2, '0')}`))).candidati.length), 8)
}

console.log('\n7. il riquadro «Suggerito» con le persone abbinate')
{
  const voci = [{ id: 'vq', nome: 'Quota associativa', tipo: 'entrata', diSistema: true, attiva: true }]
  const testo = 'Da VACCARO ANDREA TRN 2 BONIFICO SEPA'
  const base = { origine: 'movimento', tipo: 'entrata', data: '2026-10-09', importo: 5000, voce: 'Da classificare', cassaId: 'c1', annullato: false }
  // Due righe uguali già classificate: dànno la voce, così «Conferma» dipende solo dalla persona.
  const righe = [1, 2].map((i) => ({ ...base, id: `v${i}`, descrizione: `${testo} ${i}`, voce: 'Quota associativa' }))
  const riga = { ...base, id: 'r', descrizione: testo }
  const x = (id, giaIscritto = false, come = 'genitore', sicuro = false) => ({ id, nome: id, cognome: 'Test', come, giaIscritto, sicuro })
  const sug = (abbinati) => prova(() => s.suggerisciMovimento(riga, righe, voci, [], undefined, abbinati))
  const r1 = sug([x('sofia', false, 'genitore', true)])
  ok('un abbinato solo, «sicuro»: caso A, preselezionato, «Conferma» acceso', prova(() => [r1.caso, r1.preselezionato, s.confermaDi(r1, null)]), ['A', 'sofia', { voceId: 'vq', personaId: 'sofia' }])
  ok('…col segno «genitore» e «già iscritto» a falso', prova(() => r1.candidati.map((c) => [c.id, c.come, c.giaIscritto])), [['sofia', 'genitore', false]])
  const r2 = sug([x('sofia'), x('elia')])
  ok('due: caso B, nessuno preselezionato, «Conferma» spento finché non si sceglie', prova(() => [r2.caso, r2.preselezionato, s.confermaDi(r2, null), s.confermaDi(r2, 'elia')]), ['B', null, null, { voceId: 'vq', personaId: 'elia' }])
  const r3 = sug([x('anna', true, 'nome intero')])
  ok('uno solo «già iscritto»: si propone ma non si preseleziona, «Conferma» spento', prova(() => [r3.caso, r3.candidati.map((c) => c.giaIscritto), r3.preselezionato, s.confermaDi(r3, null)]), ['A', [true], null, null])
  ok('…si può sceglierlo a mano', prova(() => s.confermaDi(r3, 'anna')), { voceId: 'vq', personaId: 'anna' })
  const r4 = sug([x('sofia', false, 'storico')])
  ok('uno solo non «sicuro» (lo storico da solo): si propone ma non si preseleziona', prova(() => [r4.caso, r4.preselezionato, s.confermaDi(r4, null)]), ['A', null, null])
  const r5 = sug([x('giulia', false, 'nome e corso')])
  ok('uno solo per «nome e corso»: si propone ma non si preseleziona, «Conferma» spento', prova(() => [r5.caso, r5.preselezionato, s.confermaDi(r5, null)]), ['A', null, null])
  ok('senza abbinati (funzione assente o nessun abbinato) vale il solo nome, senza errore', prova(() => { const r = s.suggerisciMovimento({ ...riga, descrizione: 'Cliente Gallo Marta per quota TRN 3' }, righe, voci, [{ id: 'marta', nome: 'Marta', cognome: 'Gallo' }]); return [r.candidati.map((c) => c.id), r.preselezionato] }), [['marta'], 'marta'])
  ok('…e con la lista vuota dal database vale lo stesso il nome', prova(() => s.suggerisciMovimento({ ...riga, descrizione: 'Cliente Gallo Marta per quota TRN 3' }, righe, voci, [{ id: 'marta', nome: 'Marta', cognome: 'Gallo' }], undefined, []).candidati.map((c) => c.id)), ['marta'])
}

console.log('\n8. funzione assente: ricade sul nome')
{
  const manca = (e) => prova(() => a.funzioneAssente(e))
  ok('PostgREST: funzione non trovata (PGRST202)', manca({ code: 'PGRST202' }), true)
  ok('Postgres: funzione che non esiste (42883)', manca({ code: '42883' }), true)
  ok('un altro errore (tetto delle ricerche, permessi) non è «assente»', [manca({ code: '42501' }), manca(null), manca(new Error('x'))], [false, false, false])
}

console.log('\n9. l\'importo dice il corso, il corso dice chi cercare')
{
  const voci = [
    { corso: 'Judo 2', corsoId: 'c-judo', prezzi: [{ saldo: 460, annuale: 480, trimestre: 180 }] },
    { corso: 'Karate', corsoId: 'c-karate', prezzi: [{ annuale: 480 }, { etichetta: '2 GIORNI', trimestre: 200 }] },
    { corso: 'Senza id', prezzi: [{ annuale: 300 }] },
  ]
  // L'importo arriva in centesimi, come nelle righe dei movimenti; il listino è in euro.
  const co = (euro) => prova(() => a.corsiConImporto(euro * 100, voci))
  ok('un importo uguale al prezzo di un corso lo trova (trimestre)', co(180), ['c-judo'])
  ok('lo stesso importo su più corsi li trova tutti, ogni corso una volta', co(480), ['c-judo', 'c-karate'])
  ok('saldo e annuale contano, il prezzo con etichetta pure', [co(460), co(200)], [['c-judo'], ['c-karate']])
  ok('un importo che non è di nessun corso, o un corso senza id, non trova niente', [co(999), co(300), co(0)], [[], [], []])
  ok('i centesimi non si leggono come euro: 180 centesimi non sono il trimestre da 180 euro', prova(() => a.corsiConImporto(180, voci)), [])

  const I = (corsoId, o = {}) => ({ corsoId, dal: '2026-09-01', al: null, ...o })
  const pc = [
    P('rossi1', 'Paolo', 'Rossi', { iscrizioni: [I('c-judo')] }),
    P('rossi2', 'Anna', 'Rossi', { iscrizioni: [I('c-karate')] }),
    P('bianchi', 'Marco', 'Bianchi', { genitoreNome: 'Luisa', genitoreCognome: 'Verdi', iscrizioni: [I('c-judo')] }),
    P('neri', 'Elia', 'Neri', { iscrizioni: [I('c-judo', { al: '2026-10-31' })] }),
    P('fuori', 'Gigi', 'Rossi', { attiva: false, iscrizioni: [I('c-judo')] }),
  ]
  const ab = (testo, corsi, data = '2026-12-10') => prova(() => { const r = a.abbinaMovimento({ testo, data, codiciFiscali: [], corsiImporto: corsi }, pc); return [r.candidati.map((c) => [c.id, c.come, c.giaIscritto]), r.preselezionato] })
  ok('il solo cognome nel testo + iscritto al corso dell\'importo: lui, ma da soli non bastano a preselezionare', ab('Bonifico Rossi retta', ['c-judo']), [[['rossi1', 'corso e cognome', false]], null])
  ok('senza il corso dell\'importo vale il solo cognome: i Rossi iscritti, a scegliere', ab('Bonifico Rossi retta', []), [[['rossi2', 'cognome', false], ['rossi1', 'cognome', false]], null])
  ok('genitore intero + corso dell\'importo si sommano: preselezionato, e l\'iscrizione a quel corso è a favore', ab('Bonifico Verdi Luisa retta', ['c-judo']), [[['bianchi', 'genitore', false]], 'bianchi'])
  ok('…col solo cognome del genitore si propone, senza preselezione', ab('Bonifico Verdi retta', ['c-judo']), [[['bianchi', 'corso e cognome', false]], null])
  ok('più iscritti al corso con lo stesso cognome: si sceglie, nessuno preselezionato', ab('Bonifico Rossi retta', ['c-judo', 'c-karate']), [[['rossi2', 'corso e cognome', false], ['rossi1', 'corso e cognome', false]], null])
  ok('iscrizione finita prima del movimento, o persona non attiva: il corso non vale (Neri resta per il cognome, di lui solo)', [ab('Neri retta', ['c-judo']), ab('Gigi Rossi retta', ['c-judo'])[0].length], [[[['neri', 'cognome', false]], null], 1])
  ok('nome e cognome interi pesano più dell\'importo, che non sparisce', ab('Anna Rossi retta', ['c-judo']), [[['rossi2', 'nome intero', true], ['rossi1', 'corso e cognome', false]], null])
}

console.log('\n10. lo storico: un movimento con le stesse parole già collegato a qualcuno')
{
  const prima = (testo, personaId, data = '2026-09-09') => ({ testo, data, personaId })
  const st = (testo, precedenti, elenco = persone) => abbina(testo, [], '2026-10-09', elenco, precedenti)
  ok('le stesse parole (le cifre non contano): chi era, col segno «storico»', elenca(st('Bonifico da Mario Conti TRN 222', [prima('Bonifico da MARIO CONTI TRN 111', 'marta')])), 'Marta Gallo (storico)')
  ok('…da solo non basta a preselezionare', st('Bonifico da Mario Conti TRN 222', [prima('Bonifico da Mario Conti TRN 111', 'marta')]).preselezionato, null)
  ok('storico e cognome insieme: preselezionato', st('Bonifico Gallo TRN 2', [prima('Bonifico Gallo TRN 1', 'marta')]).preselezionato, 'marta')
  ok('parole diverse: niente storico', elenca(st('Bonifico da Mario Conti per judo', [prima('Bonifico da Mario Conti', 'marta')])), 'nessuno')
  ok('un testo di sole cifre non fa storico', elenca(st('123 456', [prima('123 789', 'marta')])), 'nessuno')
  ok('due persone dallo stesso conto (fratelli): tutte e due, nessuna preselezionata', prova(() => { const r = st('Bonifico da Mario Conti', [prima('Bonifico da Mario Conti', 'sofia'), prima('Bonifico da Mario Conti', 'elia')]); return [elenca(r), r.preselezionato] }), ['Elia Bruno (storico); Sofia Bruno (storico)', null])
  ok('la stessa persona collegata più volte conta una volta', elenca(st('Bonifico da Mario Conti', [prima('Bonifico da Mario Conti', 'marta'), prima('Bonifico da Mario Conti 2', 'marta')])), 'Marta Gallo (storico)')
  ok('chi non è più attivo non esce neanche dallo storico', elenca(st('Bonifico da Mario Conti', [prima('Bonifico da Mario Conti', 'ines')])), 'nessuno')
  ok('nome intero e storico di un altro: il nome prima, staccato abbastanza da preselezionare', prova(() => { const r = st('Da Gallo Marta', [prima('Da Gallo Marta', 'sofia')]); return [elenca(r), r.preselezionato] }), ['Marta Gallo (nome intero); Sofia Bruno (storico)', 'marta'])
  ok('il segno è uno solo, il più forte: nome intero più storico resta «nome intero»', elenca(st('Da Gallo Marta', [prima('Da Gallo Marta', 'marta')])), 'Marta Gallo (nome intero)')

}

console.log('\n11. il solo cognome e il nome di battesimo col corso: si propongono, non si preselezionano da soli')
{
  const I = (corso, dal = '2026-09-01', al = null) => ({ corsoId: `c-${corso}`, corso, dal, al })
  const PRIMA = ['2025-09-01', '2026-06-30']
  const pc = [
    P('conti', 'Giulia', 'Conti'),
    P('moro', 'Ada', 'Moro', { iscrizioni: [I('Judo 2')] }),
    P('sala', 'Pia', 'Sala', { genitoreNome: 'Ugo', genitoreCognome: 'Tosi' }),
    P('greco1', 'Rita', 'Greco', { iscrizioni: [I('Judo 2')] }),
    P('greco2', 'Sara', 'Greco', { iscrizioni: [I('Judo 2', ...PRIMA)] }),
    P('greco3', 'Tea', 'Greco'),
    P('riva1', 'Eva', 'Riva', { iscrizioni: [I('Judo 2', ...PRIMA)] }),
    P('riva2', 'Ivo', 'Riva', { iscrizioni: [I('Judo 2', '2027-01-10')] }),
    P('riva3', 'Leo', 'Riva'),
    P('pozzi1', 'Lia', 'Pozzi'),
    P('pozzi2', 'Ugo', 'Pozzi'),
    P('spento', 'Rino', 'Neri', { attiva: false }),
    P('esposito', 'Giulia', 'Esposito', { iscrizioni: [I('Psicomotricità')] }),
    P('marino', 'Giulia', 'Marino', { iscrizioni: [I('Judo 2')] }),
    P('fabbri', 'Nora', 'Fabbri', { iscrizioni: [I('Aikido 2', ...PRIMA)] }),
    P('galli', 'Nora', 'Galli', { iscrizioni: [I('Aikido 2')] }),
    P('ricci', 'Olga', 'Ricci', { iscrizioni: [I('Aikido 2', ...PRIMA)] }),
  ]
  const ab = (testo, elenco = pc) => prova(() => { const r = a.abbinaMovimento({ testo, data: '2026-12-10', codiciFiscali: [] }, elenco); return [elenca(r), r.preselezionato] })
  ok('cognome di una persona attiva sola: lei, ma da solo non basta a preselezionare', ab('Bonifico CONTI retta'), ['Giulia Conti (cognome)', null])
  ok('…anche se è il cognome del genitore', ab('Da TOSI TRN 1'), ['Pia Sala (cognome)', null])
  ok('…già iscritta il giorno del movimento: col segno, non preselezionata', ab('Bonifico Moro retta'), ['Ada Moro (cognome, già iscritto)', null])
  ok('chi non è attivo non conta: il cognome resta di uno solo', ab('Bonifico Neri retta', [...pc, P('neri', 'Elia', 'Neri')]), ['Elia Neri (cognome)', null])
  ok('cognome di più persone: solo chi è iscritto il giorno del movimento', ab('Bonifico GRECO retta'), ['Rita Greco (cognome)', null])
  ok('…se nessuno lo è, chi è stato o sarà iscritto (in qualunque momento), a scegliere', ab('Bonifico RIVA retta'), ['Eva Riva (cognome); Ivo Riva (cognome)', null])
  ok('…se nessuno ha iscrizioni, nessuno', ab('Bonifico POZZI retta'), ['nessuno', null])
  ok('nome di battesimo + un corso a cui è iscritto, alla data: lei, mai preselezionata', ab("Retta psicomotricita' Giulia"), ['Giulia Esposito (nome e corso)', null])
  ok('…chi è iscritto alla data vince su chi lo era prima', ab('Retta aikido Nora'), ['Nora Galli (nome e corso)', null])
  ok('…se nessuno lo è alla data, vale un\'iscrizione in qualunque momento', ab('Retta aikido Olga'), ['Olga Ricci (nome e corso)', null])
  ok('…le cifre del nome del corso non bastano', ab('Retta 2 Olga'), ['nessuno', null])
  ok('…il solo nome, senza corso, non basta', ab('Retta Giulia'), ['nessuno', null])
  ok('…né il corso senza il nome', ab('Retta aikido'), ['nessuno', null])
  ok('nome e corso pesa più del solo cognome di altri, che allora non si propongono', ab('Retta aikido Nora Riva'), ['Nora Galli (nome e corso)', null])
  ok('nome e corso più il cognome della stessa persona (dal genitore) si sommano: lei prima, ma non basta a preselezionare', ab('Retta aikido Nora Tosi', [...pc, P('sala2', 'Nora', 'Sala', { genitoreNome: 'Ugo', genitoreCognome: 'Tosi', iscrizioni: [I('Aikido 2')] })].filter((p) => p.id !== 'sala')), ['Nora Sala (nome e corso); Nora Galli (nome e corso)', null])
  ok('accanto a un nome intero gli omonimi col solo cognome non si propongono, e lui è staccato abbastanza', ab('Bonifico Greco Tea'), ['Tea Greco (nome intero)', 'greco3'])
  ok('il corso non esce mai dall\'abbinamento', prova(() => JSON.stringify(a.abbinaMovimento({ testo: "Retta psicomotricita' Giulia", data: '2026-12-10', codiciFiscali: [] }, pc)).toLowerCase().includes('psico')), false)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
