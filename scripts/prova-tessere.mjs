// ---------------------------------------------------------------------------
// Le tessere, senza browser (`src/lib/tessere.ts`).
//
//   node scripts/prova-tessere.mjs
//
// Il foglio del RASD diventa righe per `importa_tessere` (tipo tradotto,
// «valido dal» in data, fine al 31 dicembre); le righe che non si possono
// leggere si dicono in italiano; lo stato di una persona per ente (manca,
// scaduta, in scadenza a 60 giorni, valida) e le sue parole nella tabella
// ISCRITTI; l'incrocio dell'app in prova, che deve dire le stesse cose di
// `incrocio_tessere` (supabase/prova/tessere.sql, stessi dati e stessi esiti).
// Le prove gratuite non sono iscrizioni. I motivi delle righe non abbinate
// non sono mai il testo grezzo dell'API.
// La quinta casella di COSA MANCA (scelta A, confermata dall'utente) è la sezione 6:
// canvas docs/design-canvas/tessere.
// ---------------------------------------------------------------------------
process.env.TZ = 'Europe/Rome'

import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/tessere'; export * as cosaManca from './src/lib/cosaManca'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

console.log('Il tipo del RASD')
ok('Atleta Praticante', m.tipoDaRasd('Atleta Praticante'), 'praticante')
ok('Atleta Agonista, in maiuscolo e con spazi', m.tipoDaRasd('  ATLETA AGONISTA '), 'agonista')
ok('Dirigente', m.tipoDaRasd('Dirigente'), 'dirigente')
ok('Tecnico', m.tipoDaRasd('Tecnico'), 'tecnico')
ok('uno che non conosciamo è «altro», non un errore', m.tipoDaRasd('Ufficiale di gara'), 'altro')

console.log('\nIl foglio del RASD')
const FOGLIO = [
  'Organismo;Persona;Codice fiscale;Tipo;Codice tess.;Valido dal',
  'FIJLKAM;ROSSI MARIO;rssmra10a01l219x;Atleta Agonista;2026-0123;01/09/2026',
  'fijlkam ;GULLI\' ANNA;GLLNNA80A41L219X;Atleta Praticante;2026-0777;2026-09-15',
  'FIPE;BIANCHI SILVIA;;Atleta Praticante;2026-0600;01/09/2026',
  'FIPE;VERDI LUIGI;VRDLGU85B01L219Y;Dirigente;2026-0601;ieri',
  'FIPE;NERI SARA;NRESRA;Dirigente;2026-0602;01/09/2026',
  ';;;;;',
].join('\n')
{
  const r = m.righeDalFoglio(FOGLIO)
  ok('due righe buone', r.righe.length, 2)
  ok('la prima: ente, nome, codice fiscale in maiuscolo, tipo, fine al 31 dicembre',
    r.righe[0], { ente: 'FIJLKAM', nome: 'ROSSI MARIO', codice_fiscale: 'RSSMRA10A01L219X', tipo: 'agonista', codice: '2026-0123', dal: '2026-09-01', al: '2026-12-31' })
  ok('la seconda: ente pulito, data già in ISO', [r.righe[1].ente, r.righe[1].dal, r.righe[1].al], ['FIJLKAM', '2026-09-15', '2026-12-31'])
  ok('tre saltate, con il numero di riga del foglio (l\'intestazione è la 1)', r.saltate.map((x) => x.riga), [4, 5, 6])
  ok('senza codice fiscale', r.saltate[0].motivo, 'Manca il codice fiscale.')
  ok('data che non si legge', r.saltate[1].motivo, 'La data «ieri» non si legge.')
  ok('codice fiscale che non è di 16 caratteri', r.saltate[2].motivo, 'Il codice fiscale non è di 16 caratteri.')
  ok('la riga tutta vuota non è un problema, non si segnala', r.saltate.length, 3)
  ok('le colonne in un altro ordine e con altre maiuscole si trovano lo stesso',
    m.righeDalFoglio('Valido dal,CODICE TESS.,Tipo,Codice fiscale,Persona,Organismo\n01/09/2026,A1,Dirigente,RSSMRA10A01L219X,ROSSI MARIO,FIPE').righe[0],
    { ente: 'FIPE', nome: 'ROSSI MARIO', codice_fiscale: 'RSSMRA10A01L219X', tipo: 'dirigente', codice: 'A1', dal: '2026-09-01', al: '2026-12-31' })
  ok('con la virgola e il BOM: lo stesso', m.righeDalFoglio('\uFEFFOrganismo,Persona,Codice fiscale,Tipo,Codice tess.,Valido dal\nFIPE,"ROSSI, MARIO",RSSMRA10A01L219X,Atleta Praticante,A1,01/09/2026').righe[0].nome, 'ROSSI, MARIO')
  ok('un foglio senza la colonna del codice fiscale dice quale manca',
    m.righeDalFoglio('Organismo;Persona;Tipo\nFIPE;X;Dirigente').errore, 'Nel foglio manca la colonna «Codice fiscale».')
  ok('un foglio vuoto non è un foglio del RASD', m.righeDalFoglio('').errore, 'Il foglio è vuoto.')
}

console.log('\nLo stato di una persona per ente')
const T = (ente, dal, al, tipo = 'praticante') => ({ ente, tipo, dal, al })
const OGGI = '2026-10-17'
ok('nessuna tessera: manca', m.statoTessera([], 'FIJLKAM', OGGI), 'manca')
ok('una di un altro ente non vale: manca', m.statoTessera([T('FIPE', '2026-09-01', '2026-12-31')], 'FIJLKAM', OGGI), 'manca')
ok('valida fino a dicembre, il 17 ottobre: valida', m.statoTessera([T('FIJLKAM', '2026-09-01', '2026-12-31')], 'FIJLKAM', OGGI), 'valida')
ok('esattamente 60 giorni prima della fine: in scadenza', m.statoTessera([T('FIJLKAM', '2026-09-01', '2026-12-31')], 'FIJLKAM', '2026-11-01'), 'in_scadenza')
ok('61 giorni prima: ancora valida', m.statoTessera([T('FIJLKAM', '2026-09-01', '2026-12-31')], 'FIJLKAM', '2026-10-31'), 'valida')
ok('l\'ultimo giorno vale ancora', m.statoTessera([T('FIJLKAM', '2026-09-01', '2026-12-31')], 'FIJLKAM', '2026-12-31'), 'in_scadenza')
ok('il giorno dopo è scaduta', m.statoTessera([T('FIJLKAM', '2026-09-01', '2026-12-31')], 'FIJLKAM', '2027-01-01'), 'scaduta')
ok('una vecchia e una nuova: conta la più lontana', m.statoTessera([T('FIJLKAM', '2025-09-01', '2025-12-31'), T('FIJLKAM', '2026-09-01', '2026-12-31')], 'FIJLKAM', OGGI), 'valida')
ok('il rinnovo già fatto (comincia l\'anno dopo) basta: non è in scadenza', m.statoTessera([T('FIJLKAM', '2026-09-01', '2026-12-31'), T('FIJLKAM', '2027-01-01', '2027-12-31')], 'FIJLKAM', '2026-11-10'), 'valida')
ok('una tessera da dirigente o da tecnico non copre chi pratica: manca', [m.statoTessera([T('FIJLKAM', '2026-09-01', '2026-12-31', 'dirigente')], 'FIJLKAM', OGGI), m.statoTessera([T('FIJLKAM', '2026-09-01', '2026-12-31', 'tecnico')], 'FIJLKAM', OGGI)], ['manca', 'manca'])

console.log('\nLe parole nella tabella ISCRITTI')
ok('manca: rosso', m.parolaTessera('manca', undefined), { tono: 'rosso', parola: 'NO TESSERA' })
ok('scaduta: rosso', m.parolaTessera('scaduta', '2025-12-31'), { tono: 'rosso', parola: 'TESSERA SCADUTA' })
ok('in scadenza: giallo, col mese', m.parolaTessera('in_scadenza', '2026-12-31'), { tono: 'giallo', parola: 'TESSERA SCADE A DICEMBRE' })
ok('valida: niente, IN REGOLA lo dice già', m.parolaTessera('valida', '2026-12-31'), null)
ok('la frase nella scheda: valida', m.fraseTessera(T('FIJLKAM', '2026-09-01', '2026-12-31', 'agonista'), OGGI), 'FIJLKAM · agonista · fino al 31 dicembre 2026')
ok('la frase nella scheda: scaduta', m.fraseTessera(T('FIPE', '2025-09-01', '2025-12-31'), OGGI), 'FIPE · praticante · scaduta il 31 dicembre 2025')
ok('la frase nella scheda: scade presto', m.fraseTessera(T('FIJLKAM', '2026-09-01', '2026-12-31'), '2026-11-10'), 'FIJLKAM · praticante · fino al 31 dicembre 2026 · scade fra 51 giorni')

console.log('\nL\'incrocio in prova: come il database')
// Gli stessi dati di supabase/prova/tessere.sql.
const corsi = [
  { id: 'judo', nome: 'Judo 3', enteTessera: 'FIJLKAM' },
  { id: 'lotta', nome: 'Lotta 2', enteTessera: 'FIJLKAM' },
  { id: 'pesi', nome: 'Pesi agonisti', enteTessera: 'FIPE' },
  { id: 'psico', nome: 'Psicomotricità', enteTessera: null },
]
const P = (id, cognome, iscrizioni, tessere = [], attiva = true) => ({ id, cognome, attiva, iscrizioni, tessere })
const persone = [
  P('mario', 'Rossi', [{ corsoId: 'judo', dal: '2026-09-14' }], [T('FIJLKAM', '2026-09-01', '2026-12-31', 'agonista')]),
  P('anna', 'Gullì', [{ corsoId: 'judo', dal: '2026-09-14' }, { corsoId: 'lotta', dal: '2026-09-14' }], [T('FIJLKAM', '2025-09-01', '2025-12-31'), T('FIJLKAM', '2026-09-01', '2026-12-31')]),
  P('luigi', 'Verdi', [{ corsoId: 'lotta', dal: '2026-09-14' }]),
  P('sara', 'Neri', [{ corsoId: 'psico', dal: '2026-09-14' }]),
  P('piero', 'Archiviato', [{ corsoId: 'judo', dal: '2025-09-14' }], [], false),
  P('elena', 'Prova', [], []), // è venuta a provare: una prova non è un'iscrizione
  P('marco', 'Tesserato', [], [T('FIJLKAM', '2026-09-01', '2026-12-31', 'agonista')]),
  P('dario', 'Prossimo', [{ corsoId: 'lotta', dal: '2026-10-20' }]),
  P('teo', 'Doppio', [{ corsoId: 'pesi', dal: '2026-09-14' }]),
]
const dice = (oggi) => m.incrocioTessere(persone, corsi, oggi).map((x) => `${persone.find((p) => p.id === x.personaId).cognome}/${x.ente}/${x.esito}`).sort().join(', ')
ok('il 17 ottobre', dice('2026-10-17'), 'Doppio/FIPE/manca, Tesserato/FIJLKAM/non_iscritto, Verdi/FIJLKAM/manca')
ok('dal 20 ottobre Dario manca anche lui', dice('2026-10-20'), 'Doppio/FIPE/manca, Prossimo/FIJLKAM/manca, Tesserato/FIJLKAM/non_iscritto, Verdi/FIJLKAM/manca')
ok('il primo novembre: 60 giorni, in scadenza', dice('2026-11-01'), 'Doppio/FIPE/manca, Gullì/FIJLKAM/in_scadenza, Prossimo/FIJLKAM/manca, Rossi/FIJLKAM/in_scadenza, Tesserato/FIJLKAM/non_iscritto, Verdi/FIJLKAM/manca')
ok('a gennaio: scadute (chi non è più valido non è nemmeno «non iscritto»)', dice('2027-01-15'), 'Doppio/FIPE/manca, Gullì/FIJLKAM/scaduta, Prossimo/FIJLKAM/manca, Rossi/FIJLKAM/scaduta, Verdi/FIJLKAM/manca')
ok('Luigi: il corso che la chiede', m.incrocioTessere(persone, corsi, OGGI).find((x) => x.personaId === 'luigi').corsi, 'Lotta 2')
ok('senza tessera nessuna scheda è tolta dal conto per errore: Sara (corso senza tessera), Piero (archiviato), Elena (prova) non ci sono',
  m.incrocioTessere(persone, corsi, OGGI).filter((x) => ['sara', 'piero', 'elena'].includes(x.personaId)).length, 0)
{
  const extra = [
    P('dina', 'Dirigente', [{ corsoId: 'judo', dal: '2026-09-14' }], [T('FIJLKAM', '2026-09-01', '2026-12-31', 'dirigente')]),
    P('tullio', 'Tecnico', [], [T('FIJLKAM', '2026-09-01', '2026-12-31', 'tecnico')]),
  ]
  const r = m.incrocioTessere(extra, corsi, OGGI)
  ok('un dirigente iscritto a Judo senza una tessera da atleta: manca', r.filter((x) => x.personaId === 'dina').map((x) => x.esito), ['manca'])
  ok('un tecnico senza corso non è un «non iscritto»', r.filter((x) => x.personaId === 'tullio').length, 0)
}
ok('il conto per COSA MANCA: manca + scaduta, non l\'in scadenza né i non iscritti',
  m.contaTessere(m.incrocioTessere(persone, corsi, '2026-11-01')), 3)

console.log('\nLa tessera dentro IN REGOLA')
{
  const V = [{ tono: 'verde', parola: 'IN REGOLA' }]
  const R = (esito, tesseraAl) => ({ personaId: 'x', ente: 'FIJLKAM', esito, tesseraAl })
  ok('niente corsi che la chiedono: le parole di prima', m.paroleConTessera(V, []), V)
  ok('manca: IN REGOLA se ne va, resta il rosso', m.paroleConTessera(V, [R('manca')]), [{ tono: 'rosso', parola: 'NO TESSERA' }])
  ok('scaduta: rosso', m.paroleConTessera(V, [R('scaduta', '2025-12-31')]), [{ tono: 'rosso', parola: 'TESSERA SCADUTA' }])
  ok('in scadenza: giallo, col mese', m.paroleConTessera(V, [R('in_scadenza', '2026-12-31')]), [{ tono: 'giallo', parola: 'TESSERA SCADE A DICEMBRE' }])
  ok('con un altro guaio: resta anche quello', m.paroleConTessera([{ tono: 'rosso', parola: 'DA PAGARE' }], [R('manca')]), [{ tono: 'rosso', parola: 'DA PAGARE' }, { tono: 'rosso', parola: 'NO TESSERA' }])
  ok('«non iscritto» non è un guaio della tabella ISCRITTI', m.paroleConTessera(V, [R('non_iscritto', '2026-12-31')]), V)
  ok('due enti senza tessera: la parola una volta sola', m.paroleConTessera(V, [R('manca'), { ...R('manca'), ente: 'FIPE' }]).length, 1)
  ok('SENZA TESSERA: manca e scaduta sì, in scadenza e non iscritto no', [R('manca'), R('scaduta'), R('in_scadenza'), R('non_iscritto')].map((r) => m.senzaTessera([r])), [true, true, false, false])
}

console.log('\nL\'import in prova: come `importa_tessere`')
{
  // Lo stesso foglio e le stesse schede di supabase/prova/tessere.sql.
  const R = (nome, cf, tipo, codice, dal, al, ente = 'FIJLKAM') => ({ ente, nome, codice_fiscale: cf, tipo, codice, dal, al })
  const foglio = [
    R('ROSSI MARIO', 'RSSMRA10A01L219X', 'agonista', '2026-0123', '2026-09-01', '2026-12-31'),
    R('GULLI\' ANNA', 'GLLNNA80A41L219X', 'praticante', '2026-0777', '2026-09-01', '2026-12-31'),
    R('Tesserato Marco', 'TSSMRC70C01L219Z', 'agonista', '2026-0900', '2026-09-01', '2026-12-31'),
    R('ROSSI GIANNI', 'RSSMRA10A01L219X', 'praticante', '2026-0500', '2026-09-01', '2026-12-31'),
    R('BIANCHI SILVIA', 'BNCSLV90E41L219V', 'praticante', '2026-0600', '2026-09-01', '2026-12-31', 'FIPE'),
    R('ROSSI MARIO', 'RSSMRA10A01L219X', 'agonista', '2026-0123', '2026-09-01', '2026-12-31'),
    R('ROSSI MARIO', 'RSSMRA10A01L219X', 'arbitro', '2026-0124', '2026-09-01', '2026-12-31'),
    R('ROSSI MARIO', 'RSSMRA10A01L219X', 'praticante', '2026-0125', '2026-09-01', '2026-08-31'),
  ]
  const schede = [
    { personaId: 'mario', nome: 'Mario', cognome: 'Rossi', codiceFiscale: 'RSSMRA10A01L219X' },
    { personaId: 'anna', nome: 'Anna', cognome: 'Gullì', codiceFiscale: 'GLLNNA80A41L219X' },
    { personaId: 'marco', nome: 'Marco', cognome: 'Tesserato', codiceFiscale: 'TSSMRC70C01L219Z' },
  ]
  const vecchie = [{ personaId: 'anna', ente: 'FIJLKAM', tipo: 'praticante', dal: '2025-09-01', al: '2025-12-31' }]
  ok('le parole di un nome: accenti, apostrofi e ordine non contano', [m.paroleNome('GULLI\' ANNA'), m.paroleNome('Anna Gullì'), m.paroleNome('INNELLA  Rocco Maurizio'), m.paroleNome('Rocco Maurizio Innella')], ['ANNA GULLI', 'ANNA GULLI', 'INNELLA MAURIZIO ROCCO', 'INNELLA MAURIZIO ROCCO'])
  const e = m.importaTessereProva(foglio, schede, vecchie)
  ok('anteprima: tre nuove (la riga doppia una volta sola), una già presente', [e.esito.nuove, e.esito.gia_presenti, e.esito.scritto], [3, 1, false])
  ok('i motivi, come nel database', e.esito.non_abbinate.map((x) => x.esito).sort(), ['nessuna_scheda', 'nome_diverso', 'riga_non_valida', 'riga_non_valida'])
  ok('cosa si scrive: tre tessere, di chi giusto, ente in maiuscolo', e.daScrivere.map((x) => `${x.personaId} ${x.ente} ${x.tipo} ${x.codice}`), ['mario FIJLKAM agonista 2026-0123', 'anna FIJLKAM praticante 2026-0777', 'marco FIJLKAM agonista 2026-0900'])
  const gia = m.importaTessereProva(foglio, schede, [...vecchie, ...e.daScrivere.map((x) => ({ ...x }))])
  ok('lo stesso foglio di nuovo: niente di nuovo', [gia.esito.nuove, gia.esito.gia_presenti, gia.daScrivere.length], [0, 4, 0])
  ok('il codice fiscale in minuscolo e l\'ente con lo spazio si trovano lo stesso', m.importaTessereProva([R('ROSSI MARIO', 'rssmra10a01l219x', 'agonista', 'X', '2026-09-01', '2026-12-31', ' fijlkam ')], schede, []).daScrivere.map((x) => [x.personaId, x.ente]), [['mario', 'FIJLKAM']])
}

console.log('\nL\'esito dell\'import, in parole di chi lo legge')
ok('nome diverso: dice cosa fare', m.motivoNonAbbinata('nome_diverso'), 'Il codice fiscale è di un’altra persona: controlla il nome.')
ok('nessuna scheda: dice cosa fare', m.motivoNonAbbinata('nessuna_scheda'), 'Nessuna scheda ha questo codice fiscale: scrivilo nella scheda della persona.')
ok('riga non valida', m.motivoNonAbbinata('riga_non_valida'), 'La riga ha dei dati che non vanno: controllala nel foglio.')
ok('un motivo che non conosciamo non è il testo grezzo', m.motivoNonAbbinata('boh').includes('boh'), false)
ok('COSA ENTRA: i conti dell\'anteprima', m.contiImport({ nuove: 248, gia_presenti: 6, non_abbinate: [{}, {}, {}] }),
  [['248', 'tessere nuove'], ['6', 'già in app, non cambiano'], ['3', 'righe non abbinate']])
ok('una nuova sola: singolare', m.contiImport({ nuove: 1, gia_presenti: 0, non_abbinate: [] })[0], ['1', 'tessera nuova'])

console.log('\nLa quinta casella di COSA MANCA (scelta A del canvas, confermata)')
{
  const C = m.cosaManca
  ok('CASELLE: cinque, TESSERE prima delle richieste', C.CASELLE, ['appelli', 'certificati', 'pagamenti', 'tessere', 'richieste'])
  const conti = (tessere) => ({ appelli: 0, certificati: 0, pagamenti: 0, tessere, richieste: 0, contato: true })
  const c = (n) => C.caselleCosaManca(conti(n)).find((x) => x.id === 'tessere')
  ok('titolo e nota', [c(14).titolo, c(14).nota], ['TESSERE', 'senza tessera valida'])
  ok('14: rosso, il numero', [c(14).stato, c(14).numero], ['manca', '14'])
  ok('0: verde con la spunta', [c(0).stato, c(0).numero], ['aposto', '✓ 0'])
  ok('non si sa: grigio e «—», mai uno 0 verde', [c(null).stato, c(null).numero], ['nonso', '—'])
  ok('porta agli ISCRITTI col filtro «senza tessera»', [c(14).voce, c(14).filtro], ['iscritti', 'senza-tessera'])
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
