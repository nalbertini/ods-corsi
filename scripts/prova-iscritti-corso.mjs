// ---------------------------------------------------------------------------
// Il tab ISCRITTI nella scheda di un corso, senza browser.
//
//   node scripts/prova-iscritti-corso.mjs
//
// Chi c'è oggi nel corso (attivi, iscrizione in corso), con certificato e
// quota in una parola; la ricerca per nome e cognome come quella delle
// persone; i valori per l'ordinamento (i guai in cima); il conto «14/20».
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: "export { iscrittiDelCorso, cercaFraGliIscritti, valoriIscrittoCorso, contoCorso, avvisoPosti, riepilogoCorso, corsoDiProvenienza, nonInRegola, soloNonInRegola, fuoriRegola } from './src/lib/segreteria'",
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
const m = await import(modulo)

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const OGGI = '2026-10-17'
const buono = { scade: '2027-06-01', conFile: false }
const pagata = { stato: 'pagato', fino: '2027-07-31' }
const persona = (id, cognome, nome, extra = {}) => ({
  id, cognome, nome, attiva: true, creataIl: '2025-09-01', documento: true,
  iscrizioni: [{ corsoId: 'judo', dal: '2026-09-15' }],
  certificato: buono, pagamento: pagata, ...extra,
})

const gente = [
  persona('p1', 'Rossi', 'Mario'),
  persona('p2', 'D’Angelo', 'Chiara', { iscrizioni: [{ corsoId: 'judo', dal: '2026-09-20' }] }),
  persona('p3', 'Bianchi', 'Zeno'),
  persona('p4', 'Bianchi', 'Anna'),
  persona('arch', 'Archiviato', 'Aldo', { attiva: false }),
  persona('fin', 'Finito', 'Fabio', { iscrizioni: [{ corsoId: 'judo', dal: '2025-09-01', al: '2026-06-30' }] }),
  persona('dom', 'Domani', 'Dario', { iscrizioni: [{ corsoId: 'judo', dal: '2026-10-18' }] }),
  persona('alt', 'Altrove', 'Ada', { iscrizioni: [{ corsoId: 'lotta', dal: '2026-09-15' }] }),
  // Due iscrizioni allo stesso corso: una finita, una in corso. Conta la seconda.
  persona('due', 'Doppia', 'Dora', { iscrizioni: [{ corsoId: 'judo', dal: '2025-09-01', al: '2026-06-30' }, { corsoId: 'judo', dal: '2026-10-01' }] }),
  persona('nocert', 'Senzacert', 'Sara', { certificato: { conFile: false } }),
  persona('scad', 'Scaduto', 'Sergio', { certificato: { scade: '2026-09-01', conFile: false } }),
  persona('sca', 'Inscadenza', 'Ines', { certificato: { scade: '2026-10-25', conFile: false } }),
  persona('nopaga', 'Nonpaga', 'Nino', { pagamento: { stato: 'da_pagare' } }),
  // Compie 6 anni fra un mese: il certificato è «in arrivo», giallo, e in regola come per la pagina ISCRITTI.
  persona('arrivo', 'Prossimo', 'Pino', { natoIl: '2020-11-20', certificato: { conFile: false } }),
  persona('mini', 'Piccolo', 'Pio', { natoIl: '2022-03-10', certificato: { conFile: false } }),
  persona('parte', 'Parziale', 'Pia', { pagamento: { stato: 'in_parte', fino: '2027-07-31' } }),
]
const riga = (righe, id) => righe.find((r) => r.persona.id === id)

console.log('\n1. chi c’è oggi nel corso')
{
  const r = m.iscrittiDelCorso(gente, 'judo', OGGI)
  const ids = r.map((x) => x.persona.id)
  ok('solo attivi con un’iscrizione in corso a quel corso', [...ids].sort(), ['mini', 'nocert', 'nopaga', 'parte', 'p1', 'p2', 'p3', 'p4', 'sca', 'scad', 'due', 'arrivo'].sort())
  ok('non l’archiviato', ids.includes('arch'), false)
  ok('non chi ha finito', ids.includes('fin'), false)
  ok('non chi comincia domani', ids.includes('dom'), false)
  ok('non chi fa un altro corso', ids.includes('alt'), false)
  ok('con due iscrizioni, una finita: conta quella in corso', riga(r, 'due').dal, '2026-10-01')
  ok('«dal» è la data dell’iscrizione a quel corso', riga(r, 'p2').dal, '2026-09-20')
  const cognomi = r.map((x) => `${x.persona.cognome} ${x.persona.nome}`)
  ok('per cognome e poi nome', cognomi, [...cognomi].sort((a, b) => a.localeCompare(b, 'it')))
  ok('Bianchi Anna prima di Bianchi Zeno', ids.indexOf('p4') < ids.indexOf('p3'), true)
  ok('nessun iscritto: elenco vuoto', m.iscrittiDelCorso(gente, 'nuoto', OGGI), [])
  ok('nessuna persona: elenco vuoto', m.iscrittiDelCorso([], 'judo', OGGI), [])
}

console.log('\n2. certificato e quota in una parola')
{
  const r = m.iscrittiDelCorso(gente, 'judo', OGGI)
  ok('tutto a posto: verde, e la quota è sempre una parola', [riga(r, 'p1').certificato.tono, riga(r, 'p1').quota], ['verde', { tono: 'verde', parola: 'PAGATA' }])
  ok('senza certificato: rosso', riga(r, 'nocert').certificato, { tono: 'rosso', parola: 'Manca il certificato' })
  ok('certificato scaduto: rosso, parola da elenco', riga(r, 'scad').certificato, { tono: 'rosso', parola: 'Certificato scaduto' })
  ok('in scadenza: giallo', riga(r, 'sca').certificato, { tono: 'giallo', parola: 'Scade il 25/10' })
  ok('quota da pagare: rosso', riga(r, 'nopaga').quota, { tono: 'rosso', parola: 'Da pagare' })
  ok('sotto i 6 anni il certificato non serve: spento', riga(r, 'mini').certificato, { tono: 'spento', parola: 'Non serve il certificato' })
}

console.log('\n3. la ricerca fra gli iscritti')
{
  const r = m.iscrittiDelCorso(gente, 'judo', OGGI)
  const chi = (s) => m.cercaFraGliIscritti(r, s).map((x) => x.persona.id)
  ok('«dangelo» trova D’Angelo', chi('dangelo'), ['p2'])
  ok('«d angelo» pure', chi('d angelo'), ['p2'])
  ok('con l’apostrofo tipografico', chi('d’angelo'), ['p2'])
  ok('con l’apostrofo dritto', chi('d\'angelo'), ['p2'])
  ok('con il trattino', chi('d-angelo'), ['p2'])
  ok('maiuscole e accenti non contano', chi('CHIÀRA'), ['p2'])
  ok('nome e cognome in qualunque verso', [chi('mario rossi'), chi('rossi mario')], [['p1'], ['p1']])
  ok('solo il nome', chi('mario'), ['p1'])
  ok('più persone, nello stesso ordine', chi('bianchi'), r.filter((x) => x.persona.cognome === 'Bianchi').map((x) => x.persona.id))
  ok('non cerca nell’email', m.cercaFraGliIscritti(r.map((x) => (x.persona.id === 'p1' ? { ...x, persona: { ...x.persona, email: 'zorro@esempio.it' } } : x)), 'zorro'), [])
  ok('scritto vuoto: tutte, nello stesso ordine', chi('').join(), r.map((x) => x.persona.id).join())
  ok('solo spazi: tutte', chi('   ').length, r.length)
  ok('nessuna corrispondenza: nessuna', chi('xyzxyz'), [])
  ok('chi non è nel corso non si trova', chi('archiviato'), [])
}

console.log('\n4. i valori per l’ordinamento')
{
  const r = m.iscrittiDelCorso(gente, 'judo', OGGI)
  const v = (id) => m.valoriIscrittoCorso(riga(r, id))
  ok('cognome, nome e dal', v('p2'), { cognome: 'D’Angelo', nome: 'Chiara', dal: '2026-09-20', certificato: 2, quota: 2 })
  ok('certificato: rosso 0, giallo 1, verde 2', [v('nocert').certificato, v('scad').certificato, v('sca').certificato, v('p1').certificato], [0, 0, 1, 2])
  ok('quota: da pagare 0, pagata 2', [v('nopaga').quota, v('p1').quota], [0, 2])
  ok('spento come verde: 2', v('mini').certificato, 2)
}

console.log('\n5. il conto sul titolo')
{
  ok('con la capienza: «14/20», neutro', m.contoCorso(14, 20), { testo: '14/20', tono: 'neutro' })
  ok('corso pieno: giallo', m.contoCorso(20, 20), { testo: '20/20', tono: 'giallo' })
  ok('oltre la capienza: rosso', m.contoCorso(26, 25), { testo: '26/25', tono: 'rosso' })
  ok('senza capienza: solo il numero', m.contoCorso(14), { testo: '14', tono: 'neutro' })
  ok('capienza 0: come senza', m.contoCorso(3, 0), { testo: '3', tono: 'neutro' })
  ok('nessun iscritto: «0/20»', m.contoCorso(0, 20), { testo: '0/20', tono: 'neutro' })
  ok('persone non lette: un trattino, non «0»', m.contoCorso(null, 20), { testo: '—', tono: 'neutro' })
  ok('avviso: posti liberi, niente', m.avvisoPosti(14, 20), null)
  ok('avviso: senza capienza, niente', m.avvisoPosti(14), null)
  ok('avviso: persone non lette, niente', m.avvisoPosti(null, 20), null)
  ok('avviso: corso pieno', m.avvisoPosti(25, 25), 'Il corso è pieno (25 posti): puoi iscrivere ancora, ma i posti sono finiti.')
  ok('avviso: oltre la capienza', m.avvisoPosti(26, 25), 'Il corso ha 26 iscritti su 25 posti: puoi iscrivere ancora, ma i posti sono finiti.')
}

console.log('\n6. chi non è in regola')
{
  const r = m.iscrittiDelCorso(gente, 'judo', OGGI)
  ok('come la pagina ISCRITTI: stessa definizione di fuoriRegola, per ogni riga',
    r.filter((x) => m.nonInRegola(x) !== m.fuoriRegola(x.persona, OGGI)).map((x) => x.persona.id), [])
  ok('certificato in scadenza e quota pagata: in regola', m.nonInRegola(riga(r, 'sca')), false)
  ok('minore sotto i 6 anni (certificato spento) e quota pagata: in regola', m.nonInRegola(riga(r, 'mini')), false)
  ok('certificato verde e quota IN PARTE (gialla): non in regola', [riga(r, 'parte').quota.tono, m.nonInRegola(riga(r, 'parte'))], ['giallo', true])
  ok('certificato rosso: non in regola', m.nonInRegola(riga(r, 'nocert')), true)
  ok('quota da pagare: non in regola', m.nonInRegola(riga(r, 'nopaga')), true)
  ok('tutto a posto: in regola', m.nonInRegola(riga(r, 'p1')), false)
  const ids = (l) => l.map((x) => x.persona.id)
  const soli = m.soloNonInRegola(r)
  ok('solo chi non è in regola, nello stesso ordine', ids(soli), ids(r.filter((x) => m.nonInRegola(x))))
  ok('e sono proprio quelli giusti', [...ids(soli)].sort(), ['nocert', 'nopaga', 'parte', 'scad'].sort())
  ok('nessuno fuori regola: elenco vuoto', m.soloNonInRegola(r.filter((x) => !m.nonInRegola(x))), [])
  ok('elenco vuoto: vuoto', m.soloNonInRegola([]), [])
  ok('con la ricerca in AND, in qualunque ordine',
    [ids(m.cercaFraGliIscritti(m.soloNonInRegola(r), 'pi')), ids(m.soloNonInRegola(m.cercaFraGliIscritti(r, 'pi')))],
    [['parte'], ['parte']])
  ok('la ricerca che trova solo chi è in regola non dà niente', ids(m.soloNonInRegola(m.cercaFraGliIscritti(r, 'mario'))), [])
}

console.log('\n7. il riepilogo del corso')
{
  const T = (testo, tono) => ({ testo, tono })
  // Una riga fatta apposta: conta solo il tono di certificato e quota.
  const rg = (cert = 'verde', quota = 'verde') => ({ certificato: { tono: cert, parola: 'X' }, quota: { tono: quota, parola: 'Y' } })
  const tanti = (n, ...a) => Array.from({ length: n }, () => rg(...a))
  const R = m.riepilogoCorso
  ok('16 su 20, tutto in regola', R(tanti(16), 20), [T('16/20', 'neutro'), T('TUTTO IN REGOLA', 'verde')])
  ok('corso pieno: giallo, con la voce', R(tanti(25), 25), [T('25/25', 'giallo'), T('CORSO PIENO', 'giallo'), T('TUTTO IN REGOLA', 'verde')])
  ok('oltre di 1: rosso, «1 IN PIÙ DEI POSTI»', R(tanti(26), 25), [T('26/25', 'rosso'), T('1 IN PIÙ DEI POSTI', 'rosso'), T('TUTTO IN REGOLA', 'verde')])
  ok('oltre di 3', R(tanti(28), 25).slice(0, 2), [T('28/25', 'rosso'), T('3 IN PIÙ DEI POSTI', 'rosso')])
  ok('senza capienza: «14 ISCRITTI», niente posti', R(tanti(14)), [T('14 ISCRITTI', 'neutro'), T('TUTTO IN REGOLA', 'verde')])
  ok('senza capienza e uno solo: «1 ISCRITTO»', R(tanti(1), undefined)[0], T('1 ISCRITTO', 'neutro'))
  ok('capienza 0: come senza', R(tanti(3), 0)[0], T('3 ISCRITTI', 'neutro'))
  ok('capienza 0 non fa «pieno» con zero iscritti', R([], 0)[0], T('0 ISCRITTI', 'neutro'))
  ok('zero iscritti: «0/20», tutto in regola', R([], 20), [T('0/20', 'neutro'), T('TUTTO IN REGOLA', 'verde')])
  ok('solo certificati: niente voce DA PAGARE', R([rg('rosso'), rg('rosso'), ...tanti(3)], 20),
    [T('5/20', 'neutro'), T('2 SENZA CERTIFICATO', 'rosso')])
  ok('un solo senza certificato: singolare', R([rg('rosso')], 20).slice(1), [T('1 SENZA CERTIFICATO', 'rosso')])
  ok('solo quote: niente voce SENZA CERTIFICATO', R([rg('verde', 'rosso'), ...tanti(2)], 20),
    [T('3/20', 'neutro'), T('1 DA PAGARE', 'rosso')])
  ok('entrambe, in quest’ordine', R([rg('rosso'), rg('verde', 'rosso'), rg('verde', 'rosso'), rg()], 20),
    [T('4/20', 'neutro'), T('1 SENZA CERTIFICATO', 'rosso'), T('2 DA PAGARE', 'rosso')])
  ok('certificato giallo da solo: TUTTO IN REGOLA', R([rg('giallo')], 20), [T('1/20', 'neutro'), T('TUTTO IN REGOLA', 'verde')])
  ok('certificato spento non conta', R([rg('spento')], 20), [T('1/20', 'neutro'), T('TUTTO IN REGOLA', 'verde')])
  ok('IN PARTE conta come da pagare', R([rg('verde', 'giallo')], 20), [T('1/20', 'neutro'), T('1 DA PAGARE', 'rosso')])
  ok('pieno e con guai: conto, pieno, poi i guai', R([rg('rosso'), ...tanti(1)], 2),
    [T('2/2', 'giallo'), T('CORSO PIENO', 'giallo'), T('1 SENZA CERTIFICATO', 'rosso')])
  const r = m.iscrittiDelCorso(gente, 'judo', OGGI)
  ok('sulle righe vere del judo: 12 iscritti, 2 senza certificato, 2 da pagare + IN PARTE',
    R(r, 20), [T('12/20', 'neutro'), T('2 SENZA CERTIFICATO', 'rosso'), T('2 DA PAGARE', 'rosso')])
  ok('il minore sotto i 6 anni non conta come senza certificato',
    R([riga(r, 'mini')], 20), [T('1/20', 'neutro'), T('TUTTO IN REGOLA', 'verde')])
}

console.log('\n8. il corso da cui si è aperta la scheda')
{
  const corsi = [{ id: 'judo', attivo: true }, { id: 'vecchio', attivo: false }]
  ok('corso in calendario: si torna lì', m.corsoDiProvenienza('judo', corsi), 'judo')
  ok('corso archiviato: niente', m.corsoDiProvenienza('vecchio', corsi), undefined)
  ok('corso inventato: niente', m.corsoDiProvenienza('zzz', corsi), undefined)
  ok('nessun corso di provenienza: niente', m.corsoDiProvenienza(undefined, corsi), undefined)
  ok('corsi non ancora letti: niente', m.corsoDiProvenienza('judo', []), undefined)
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
