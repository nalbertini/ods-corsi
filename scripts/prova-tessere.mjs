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
ok('il tipo non si guarda (da confermare): un dirigente copre', m.statoTessera([T('FIJLKAM', '2026-09-01', '2026-12-31', 'dirigente')], 'FIJLKAM', OGGI), 'valida')

console.log('\nLe parole nella tabella ISCRITTI')
ok('manca: rosso', m.parolaTessera('manca', undefined, OGGI), { tono: 'rosso', parola: 'NO TESSERA' })
ok('scaduta: rosso', m.parolaTessera('scaduta', '2025-12-31', OGGI), { tono: 'rosso', parola: 'TESSERA SCADUTA' })
ok('in scadenza: giallo, col mese', m.parolaTessera('in_scadenza', '2026-12-31', '2026-11-10'), { tono: 'giallo', parola: 'TESSERA SCADE A DICEMBRE' })
ok('valida: niente, IN REGOLA lo dice già', m.parolaTessera('valida', '2026-12-31', OGGI), null)
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
  P('marco', 'Tesserato', [], [T('FIJLKAM', '2026-09-01', '2026-12-31', 'dirigente')]),
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
ok('il conto per COSA MANCA: manca + scaduta, non l\'in scadenza né i non iscritti',
  m.contaTessere(m.incrocioTessere(persone, corsi, '2026-11-01')), 3)

console.log('\nL\'esito dell\'import, in parole di chi lo legge')
ok('nome diverso: dice cosa fare', m.motivoNonAbbinata('nome_diverso'), 'Il codice fiscale è di un\'altra persona: controlla il nome.')
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
