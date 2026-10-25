// ---------------------------------------------------------------------------
// Chi ha pagato un movimento non identificato (banca o Satispay), senza browser.
//
//   node scripts/prova-abbina-movimenti.mjs
//
// Controlla `src/lib/abbinaMovimenti.ts` e il riquadro «Suggerito» di `suggerimentoMovimento.ts`: le sei regole in
// ordine (nome e cognome interi nel testo, nome e cognome del genitore, codice fiscale letto dalla causale, importo e
// cognome, solo cognome, nome di battesimo e corso; «nome e corso» non si preseleziona mai), ognuna solo
// se la precedente non trova nessuno; l'ordine per iscrizione alla data del movimento (chi non è iscritto prima, chi lo
// è in fondo col segno «già iscritto»); la preselezione; cosa esce (mai codici, genitori, date). Gli stessi casi, con gli
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
const abbina = (testo, codiciFiscali = [], data = '2026-10-09', elenco = persone) => prova(() => a.abbinaMovimento({ testo, data, codiciFiscali }, elenco))
const elenca = (r) => (r.candidati ? r.candidati.map((c) => `${c.nome} ${c.cognome} (${c.come}${c.giaIscritto ? ', già iscritto' : ''})`).join('; ') || 'nessuno' : r)

console.log('1. regola 1: nome e cognome interi nel testo')
ok('«Prudente Domenico» è il genitore, e un cognome solo non basta: Manuel Prudente, per nome intero', elenca(abbina('Da PRUDENTE DOMENICO,MANCA FEDERICA PAOLA, TRN 1 per Quota associativa 2026/2027 Prudente Manuel BONIFICO SEPA')), 'Manuel Prudente (nome intero)')
ok('…ed è preselezionato', abbina('Da PRUDENTE DOMENICO,MANCA FEDERICA PAOLA, TRN 1 per Quota associativa 2026/2027 Prudente Manuel BONIFICO SEPA').preselezionato, 'manuel')
ok('in qualunque ordine, senza maiuscole né accenti', elenca(abbina('da manuél prudente trn')), 'Manuel Prudente (nome intero)')
ok('solo il cognome (o solo il nome) non basta', elenca(abbina('Da PRUDENTE LUCIANO BONIFICO SEPA')), 'nessuno')
ok('il nome intero dell\'adulto che paga per sé', elenca(abbina('Da GALLO MARTA TRN 5 BONIFICO SEPA')), 'Marta Gallo (nome intero)')
ok('chi non è più attivo non esce', elenca(abbina('Da Bruno Ines TRN 5', [], '2026-10-09')), 'nessuno')

console.log('\n2. regola 2: nome e cognome del genitore nel testo, i figli')
ok('Andrea Vaccaro nel testo: i suoi figli attivi (non Ines), a scegliere', elenca(abbina('Da VACCARO ANDREA TRN 2 BONIFICO SEPA')), 'Elia Bruno (genitore); Sofia Bruno (genitore)')
ok('…nessuno preselezionato, perché sono due', abbina('Da VACCARO ANDREA TRN 2 BONIFICO SEPA').preselezionato, null)
ok('un solo figlio: preselezionato, col segno «genitore»', prova(() => { const r = a.abbinaMovimento({ testo: 'Da VACCARO ANDREA TRN 2', data: '2026-10-09', codiciFiscali: [] }, persone.filter((p) => p.id !== 'elia')); return [elenca(r), r.preselezionato] }), ['Sofia Bruno (genitore)', 'sofia'])
ok('il cognome del genitore da solo (o il nome) non basta', elenca(abbina('Da VACCARO TRN 2')), 'nessuno')
ok('un genitore senza cognome nella scheda non si abbina per il solo nome', elenca(abbina('Da Andrea TRN 2', [], '2026-10-09', [P('x', 'Ugo', 'Rizzo', { genitoreNome: 'Andrea' })])), 'nessuno')
ok('il nome vince sul genitore: la regola 2 si prova solo se la 1 non trova nessuno', elenca(abbina('Da VACCARO ANDREA per Gallo Marta TRN 2')), 'Marta Gallo (nome intero)')

console.log('\n3. regola 3: il codice fiscale letto dalla causale (solo bancari nuovi)')
ok('il codice del genitore: i suoi figli', elenca(abbina('Da ROSSI GINO TRN 3 BONIFICO SEPA', [CF_VACCARO])), 'Elia Bruno (codice fiscale); Sofia Bruno (codice fiscale)')
ok('se paga l\'adulto per sé, il suo codice', elenca(abbina('Da ROSSI GINO TRN 4 BONIFICO SEPA', [CF_GALLO])), 'Marta Gallo (codice fiscale)')
ok('il nome vince sul codice', elenca(abbina('Da GALLO MARTA TRN 5 BONIFICO SEPA', [CF_VACCARO])), 'Marta Gallo (nome intero)')
ok('il genitore per nome vince sul codice', elenca(abbina('Da VACCARO ANDREA TRN 5 BONIFICO SEPA', [CF_GALLO])), 'Elia Bruno (genitore); Sofia Bruno (genitore)')
ok('un codice di nessuno non propone nessuno', elenca(abbina('Da ROSSI GINO TRN 6 BONIFICO SEPA', ['ZZZZZZ99Z99Z999Z'])), 'nessuno')
ok('senza codici letti (movimenti già importati, Satispay): solo regole 1 e 2', elenca(abbina('Da ROSSI GINO TRN 7 BONIFICO SEPA', [])), 'nessuno')
ok('due codici nella causale: vale quello che trova qualcuno', elenca(abbina('Da ROSSI GINO TRN 8', [CF_PRUDENTE, CF_GALLO], '2026-10-09', persone.filter((p) => p.id !== 'manuel'))), 'Marta Gallo (codice fiscale)')

console.log('\n4. l\'ordine: chi non è iscritto il giorno del movimento prima, chi lo è in fondo')
const ferri = abbina('Da Ferri Anna, Ferri Bruno, Ferri Carlo, Ferri Dora BONIFICO SEPA')
ok('non iscritti (Bruno: finita; Carlo: comincia dopo) prima, poi iscritti (Anna; Dora, che il 9 c\'era anche se oggi no), «già iscritto»', elenca(ferri), 'Bruno Ferri (nome intero); Carlo Ferri (nome intero); Anna Ferri (nome intero, già iscritto); Dora Ferri (nome intero, già iscritto)')
ok('conta il giorno del movimento: Dora, iscritta fino al 15/10, il 20 non lo è e il 15 sì', [elenca(abbina('Da Ferri Dora', [], '2026-10-20')), elenca(abbina('Da Ferri Dora', [], '2026-10-15'))], ['Dora Ferri (nome intero)', 'Dora Ferri (nome intero, già iscritto)'])
ok('l\'iscrizione comincia il suo primo giorno e finisce l\'ultimo, compresi', [elenca(abbina('Da Ferri Carlo', [], '2026-11-01')), elenca(abbina('Da Ferri Carlo', [], '2026-10-31'))], ['Carlo Ferri (nome intero, già iscritto)', 'Carlo Ferri (nome intero)'])
ok('un iscritto non si esclude mai: si propone col segno', elenca(abbina('Da Ferri Ennio BONIFICO SEPA')), 'Ennio Ferri (nome intero, già iscritto)')
ok('…ma da solo non è mai preselezionato', abbina('Da Ferri Ennio BONIFICO SEPA').preselezionato, null)
ok('non iscritto e iscritto insieme: due candidati, si sceglie a mano', abbina('Da Ferri Bruno, Ferri Anna').preselezionato, null)
ok('l\'ordine vale anche per le regole 2 e 3', prova(() => elenca(a.abbinaMovimento({ testo: 'Da VACCARO ANDREA', data: '2026-10-09', codiciFiscali: [] }, persone.map((p) => (p.id === 'elia' ? { ...p, iscrizioni: [{ dal: '2026-09-01', al: null }] } : p))))), 'Sofia Bruno (genitore); Elia Bruno (genitore, già iscritto)')
ok('al massimo otto', prova(() => a.abbinaMovimento({ testo: 'Da Rosa Pini BONIFICO SEPA', data: '2026-10-09', codiciFiscali: [] }, persone).candidati.length), 8)
ok('…i primi otto in ordine di cognome e nome', prova(() => a.abbinaMovimento({ testo: 'Da Rosa Pini BONIFICO SEPA', data: '2026-10-09', codiciFiscali: [] }, persone).candidati.map((c) => c.nome).join(',')), 'Pino1,Pino10,Pino2,Pino3,Pino4,Pino5,Pino6,Pino7')

console.log('\n5. la privacy: dell\'abbinamento esce solo quel che serve')
ok('di ogni candidato: id, nome, cognome, come e già iscritto; mai codici, genitori, date o corsi', prova(() => Object.keys(abbina('Da VACCARO ANDREA').candidati[0]).sort()), ['cognome', 'come', 'giaIscritto', 'id', 'nome'])
ok('l\'esito intero non contiene né codici né il nome del genitore', prova(() => { const j = JSON.stringify(abbina('Da VACCARO ANDREA')); return [j.includes(CF_VACCARO), j.includes('Andrea'), j.includes('2026-09-01')] }), [false, false, false])

console.log('\n6. ordinaAbbinati: le righe che il database rende, con la stessa regola')
{
  const x = (id, nome, cognome, giaIscritto = false, come = 'nome intero') => ({ id, nome, cognome, come, giaIscritto })
  const o = (l) => prova(() => a.ordinaAbbinati(l))
  ok('non iscritti prima (cognome e nome), iscritti in fondo', prova(() => o([x('c', 'Zeta', 'Alfa', true), x('b', 'Bea', 'Beta'), x('a', 'Ada', 'Beta')]).candidati.map((c) => c.id)), ['a', 'b', 'c'])
  ok('uno solo non iscritto: preselezionato', o([x('a', 'Ada', 'Beta')]).preselezionato, 'a')
  ok('uno solo iscritto: no', o([x('a', 'Ada', 'Beta', true)]).preselezionato, null)
  ok('nessuno: niente', prova(() => [o([]).candidati, o([]).preselezionato]), [[], null])
  ok('più di uno: no', o([x('a', 'Ada', 'Beta'), x('b', 'Bea', 'Beta')]).preselezionato, null)
  ok('«nome e corso» da solo non è mai preselezionato', o([x('a', 'Ada', 'Beta', false, 'nome e corso')]).preselezionato, null)
  ok('…«cognome» sì, come le altre', o([x('a', 'Ada', 'Beta', false, 'cognome')]).preselezionato, 'a')
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
  const x = (id, giaIscritto = false, come = 'genitore') => ({ id, nome: id, cognome: 'Test', come, giaIscritto })
  const sug = (abbinati) => prova(() => s.suggerisciMovimento(riga, righe, voci, [], undefined, abbinati))
  const r1 = sug([x('sofia')])
  ok('un abbinato solo, non iscritto: caso A, preselezionato, «Conferma» acceso', prova(() => [r1.caso, r1.preselezionato, s.confermaDi(r1, null)]), ['A', 'sofia', { voceId: 'vq', personaId: 'sofia' }])
  ok('…col segno «genitore» e «già iscritto» a falso', prova(() => r1.candidati.map((c) => [c.id, c.come, c.giaIscritto])), [['sofia', 'genitore', false]])
  const r2 = sug([x('sofia'), x('elia')])
  ok('due: caso B, nessuno preselezionato, «Conferma» spento finché non si sceglie', prova(() => [r2.caso, r2.preselezionato, s.confermaDi(r2, null), s.confermaDi(r2, 'elia')]), ['B', null, null, { voceId: 'vq', personaId: 'elia' }])
  const r3 = sug([x('anna', true, 'nome intero')])
  ok('uno solo «già iscritto»: si propone ma non si preseleziona, «Conferma» spento', prova(() => [r3.caso, r3.candidati.map((c) => c.giaIscritto), r3.preselezionato, s.confermaDi(r3, null)]), ['A', [true], null, null])
  ok('…si può sceglierlo a mano', prova(() => s.confermaDi(r3, 'anna')), { voceId: 'vq', personaId: 'anna' })
  const r5 = sug([x('giulia', false, 'nome e corso')])
  ok('uno solo per «nome e corso»: si propone ma non si preseleziona, «Conferma» spento', prova(() => [r5.caso, r5.preselezionato, s.confermaDi(r5, null)]), ['A', null, null])
  const r4 = sug([x('anna', true, 'nome intero'), x('bruno', false, 'nome intero')])
  ok('già iscritto in fondo, anche se il database lo rende per primo', prova(() => [r4.candidati.map((c) => c.id), r4.preselezionato]), [['bruno', 'anna'], null])
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
  const co = (n) => prova(() => a.corsiConImporto(n, voci))
  ok('un importo uguale al prezzo di un corso lo trova (trimestre)', co(180), ['c-judo'])
  ok('lo stesso importo su più corsi li trova tutti, ogni corso una volta', co(480), ['c-judo', 'c-karate'])
  ok('saldo e annuale contano, il prezzo con etichetta pure', [co(460), co(200)], [['c-judo'], ['c-karate']])
  ok('un importo che non è di nessun corso, o un corso senza id, non trova niente', [co(999), co(300), co(0)], [[], [], []])

  const I = (corsoId, o = {}) => ({ corsoId, dal: '2026-09-01', al: null, ...o })
  const pc = [
    P('rossi1', 'Paolo', 'Rossi', { iscrizioni: [I('c-judo')] }),
    P('rossi2', 'Anna', 'Rossi', { iscrizioni: [I('c-karate')] }),
    P('bianchi', 'Marco', 'Bianchi', { genitoreNome: 'Luisa', genitoreCognome: 'Verdi', iscrizioni: [I('c-judo')] }),
    P('neri', 'Elia', 'Neri', { iscrizioni: [I('c-judo', { al: '2026-10-31' })] }),
    P('fuori', 'Gigi', 'Rossi', { attiva: false, iscrizioni: [I('c-judo')] }),
  ]
  const ab = (testo, corsi, data = '2026-12-10') => prova(() => { const r = a.abbinaMovimento({ testo, data, codiciFiscali: [], corsiImporto: corsi }, pc); return [r.candidati.map((c) => [c.id, c.come, c.giaIscritto]), r.preselezionato] })
  ok('il solo cognome nel testo + iscritto al corso dell\'importo: lui, preselezionato', ab('Bonifico Rossi retta', ['c-judo']), [[['rossi1', 'corso e cognome', false]], 'rossi1'])
  ok('senza il corso dell\'importo vale il solo cognome (regola 5): i Rossi iscritti, a scegliere', ab('Bonifico Rossi retta', []), [[['rossi2', 'cognome', false], ['rossi1', 'cognome', false]], null])
  ok('nome e cognome interi del genitore vincono sull’importo (già iscritto: in fondo, non preselezionato)', ab('Bonifico Verdi Luisa retta', ['c-judo']), [[['bianchi', 'genitore', true]], null])
  ok('…anche col solo cognome del genitore', ab('Bonifico Verdi retta', ['c-judo']), [[['bianchi', 'corso e cognome', false]], 'bianchi'])
  ok('più iscritti al corso con lo stesso cognome: si sceglie, nessuno preselezionato', ab('Bonifico Rossi retta', ['c-judo', 'c-karate']), [[['rossi2', 'corso e cognome', false], ['rossi1', 'corso e cognome', false]], null])
  ok('iscrizione finita prima del movimento, o persona non attiva: la regola 4 non vale (Neri lo trova la 5, cognome unico)', [ab('Neri retta', ['c-judo']), ab('Gigi Rossi retta', ['c-judo'])[0].length], [[[['neri', 'cognome', false]], 'neri'], 1])
  ok('nome e cognome interi vincono sull\'importo: la regola 4 non si guarda', ab('Anna Rossi retta', ['c-judo']), [[['rossi2', 'nome intero', true]], null])
}

console.log('\n10. regola 5, il solo cognome; regola 6, il nome di battesimo e il corso')
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
  ok('cognome di una persona attiva sola: lei, preselezionata', ab('Bonifico CONTI retta'), ['Giulia Conti (cognome)', 'conti'])
  ok('…anche se è il cognome del genitore', ab('Da TOSI TRN 1'), ['Pia Sala (cognome)', 'sala'])
  ok('…già iscritta il giorno del movimento: col segno, non preselezionata', ab('Bonifico Moro retta'), ['Ada Moro (cognome, già iscritto)', null])
  ok('chi non è attivo non conta: il cognome resta di uno solo', ab('Bonifico Neri retta', [...pc, P('neri', 'Elia', 'Neri')]), ['Elia Neri (cognome)', 'neri'])
  ok('cognome di più persone: solo chi è iscritto il giorno del movimento', ab('Bonifico GRECO retta'), ['Rita Greco (cognome)', 'greco1'])
  ok('…se nessuno lo è, chi è stato o sarà iscritto (in qualunque momento), a scegliere', ab('Bonifico RIVA retta'), ['Eva Riva (cognome); Ivo Riva (cognome)', null])
  ok('…se nessuno ha iscrizioni, nessuno', ab('Bonifico POZZI retta'), ['nessuno', null])
  ok('nome di battesimo + un corso a cui è iscritto, alla data: lei, mai preselezionata', ab("Retta psicomotricita' Giulia"), ['Giulia Esposito (nome e corso)', null])
  ok('…chi è iscritto alla data vince su chi lo era prima', ab('Retta aikido Nora'), ['Nora Galli (nome e corso)', null])
  ok('…se nessuno lo è alla data, vale un\'iscrizione in qualunque momento', ab('Retta aikido Olga'), ['Olga Ricci (nome e corso)', null])
  ok('…le cifre del nome del corso non bastano', ab('Retta 2 Olga'), ['nessuno', null])
  ok('…il solo nome, senza corso, non basta', ab('Retta Giulia'), ['nessuno', null])
  ok('…né il corso senza il nome', ab('Retta aikido'), ['nessuno', null])
  ok('il cognome vince su nome e corso: la regola 6 si guarda solo se la 5 non trova nessuno', ab('Retta aikido Nora Riva'), ['Eva Riva (cognome); Ivo Riva (cognome)', null])
  ok('il corso non esce mai dall\'abbinamento', prova(() => JSON.stringify(a.abbinaMovimento({ testo: "Retta psicomotricita' Giulia", data: '2026-12-10', codiciFiscali: [] }, pc)).toLowerCase().includes('psico')), false)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
