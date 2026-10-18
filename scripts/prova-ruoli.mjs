// ---------------------------------------------------------------------------
// I ruoli del personale, senza browser: le tre spunte, le aree, e chi può cosa.
//
//   node scripts/prova-ruoli.mjs
//
// Le stesse regole del database (`supabase/prova/amministrazione.sql`): la
// lista di `puo` qui e le policy là devono dire le stesse cose.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { existsSync } from 'node:fs'

const { outputFiles } = await build({
  stdin: {
    contents: "export * from './src/lib/ruoli'; export * from './src/lib/menuSegreteria'; export { VOCI } from './src/lib/indirizzoSegreteria'",
    resolveDir: '.',
    loader: 'ts',
  },
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
// Le chiavi in un ordine solo, perché il confronto è sul testo.
const piatto = (o) => (o ? Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1))) : o)
const p = (ruolo, ancheIstruttore = false, ancheAmministrazione = false) => ({ ruolo, ancheIstruttore, ancheAmministrazione })

// Le sette combinazioni non vuote: spunte, come stanno in `persone`, aree, nome.
const COMBINAZIONI = [
  { spunte: ['segreteria'], persona: p('staff'), aree: ['segreteria'], nome: 'Segreteria' },
  { spunte: ['amministrazione'], persona: p('amministrazione'), aree: ['segreteria'], nome: 'Amministrazione' },
  { spunte: ['istruttore'], persona: p('istruttore'), aree: ['istruttori'], nome: 'Istruttore' },
  { spunte: ['segreteria', 'amministrazione'], persona: p('staff', false, true), aree: ['segreteria'], nome: 'Segreteria e amministrazione' },
  { spunte: ['segreteria', 'istruttore'], persona: p('staff', true), aree: ['segreteria', 'istruttori'], nome: 'Segreteria e istruttore' },
  { spunte: ['amministrazione', 'istruttore'], persona: p('amministrazione', true), aree: ['segreteria', 'istruttori'], nome: 'Amministrazione e istruttore' },
  {
    spunte: ['segreteria', 'amministrazione', 'istruttore'],
    persona: p('staff', true, true),
    aree: ['segreteria', 'istruttori'],
    nome: 'Segreteria, amministrazione e istruttore',
  },
]

console.log('\nle tre spunte e il ruolo nel database')
for (const c of COMBINAZIONI) {
  const chiave = c.spunte.join(' + ')
  ok(`${chiave}: dalle spunte al ruolo`, piatto(m.daSpunte(c.spunte)), piatto(c.persona))
  ok(`${chiave}: dal ruolo alle spunte`, m.spunteDi(c.persona), c.spunte)
  ok(`${chiave}: andata e ritorno`, m.spunteDi(m.daSpunte(c.spunte)), c.spunte)
}
ok('nessuna spunta: niente ruolo', m.daSpunte([]), undefined)
ok('l\'ordine delle spunte non conta', piatto(m.daSpunte(['istruttore', 'segreteria', 'amministrazione'])), piatto(p('staff', true, true)))
ok('chi è istruttore non ha le altre due, anche se il dato le porta', m.spunteDi(p('istruttore', true, true)), ['istruttore'])
ok('l\'amministrazione non è segreteria, anche se il dato lo porta', m.spunteDi(p('amministrazione', false, true)), ['amministrazione'])

console.log('\nle aree, chi insegna, il nome')
for (const c of COMBINAZIONI) {
  const chiave = c.spunte.join(' + ')
  ok(`${chiave}: le aree`, m.areeDi(c.persona), c.aree)
  ok(`${chiave}: insegna`, m.insegna(c.persona), c.spunte.includes('istruttore'))
  ok(`${chiave}: il nome`, m.nomeDelRuolo(c.persona), c.nome)
}

console.log('\nun ruolo che l\'app non conosce')
{
  const strano = { ruolo: 'contabile' }
  ok('non va in nessuna area', m.areeDi(strano), [])
  ok('non va in segreteria', m.areeDi(strano).includes('segreteria'), false)
  ok('non insegna', m.insegna(strano), false)
  ok('non ha spunte', m.spunteDi(strano), [])
  ok('nemmeno col ruolo doppio nel dato', m.areeDi({ ruolo: 'contabile', ancheIstruttore: true, ancheAmministrazione: true }), [])
}

// La lista dei permessi mostrata a chi sceglie i ruoli: `puo(persona, cosa)`.
// Le righe sono quelle del canvas «ruolo amministrazione».
console.log('\nchi può cosa')
const TUTTO = [
  'ricevute', 'pagamenti', 'pagina-pagamenti', 'listino', 'contabilita', 'emettere-ricevute',
  'persone', 'schede', 'certificati', 'presenze', 'iscritti', 'corsi', 'prove', 'statistiche',
  'account', 'ruoli', 'invito', 'backup', 'appello', 'pin',
]
const SOLDI = ['ricevute', 'pagamenti', 'pagina-pagamenti', 'listino']
const DELLA_SEGRETERIA = ['persone', 'schede', 'certificati', 'presenze', 'iscritti', 'corsi', 'prove', 'statistiche', 'account', 'ruoli', 'invito', 'backup']
const sono = (c) => TUTTO.filter((x) => m.puo(c.persona, x))
const per = (nome) => COMBINAZIONI.find((c) => c.spunte.join('+') === nome)
ok('solo amministrazione: i soldi e la contabilità, niente altro', sono(per('amministrazione')), [...SOLDI, 'contabilita'])
ok('solo amministrazione: le ricevute le annulla, ma non le emette (lo strumento non c\'è ancora)', [m.puo(per('amministrazione').persona, 'ricevute'), m.puo(per('amministrazione').persona, 'emettere-ricevute')], [true, false])
ok('solo amministrazione: non vede STATISTICHE', m.puo(per('amministrazione').persona, 'statistiche'), false)
ok('solo amministrazione: non fa l\'appello e non ha un PIN', [m.puo(per('amministrazione').persona, 'appello'), m.puo(per('amministrazione').persona, 'pin')], [false, false])
ok('solo segreteria: tutto tranne la contabilità', sono(per('segreteria')), TUTTO.filter((x) => x !== 'contabilita'))
ok('segreteria e amministrazione: tutto', sono(per('segreteria+amministrazione')), TUTTO)
ok('amministrazione e istruttore: i soldi, la contabilità, l\'appello e il PIN',
  sono(per('amministrazione+istruttore')), TUTTO.filter((x) => [...SOLDI, 'contabilita', 'appello', 'pin'].includes(x)))
ok('solo istruttore: l\'appello e il PIN', sono(per('istruttore')), ['appello', 'pin'])
ok('segreteria e istruttore: come la segreteria', sono(per('segreteria+istruttore')), sono(per('segreteria')))
ok('quel che è della segreteria all\'amministrazione non va', DELLA_SEGRETERIA.filter((x) => m.puo(per('amministrazione').persona, x)), [])
ok('un ruolo sconosciuto non può niente', TUTTO.filter((x) => m.puo({ ruolo: 'contabile' }, x)), [])

console.log('\nil menu: un solo menu, le voci delle autorizzazioni di chi lo usa')
{
  const chi = {
    segreteria: p('staff'),
    'segreteria + amministrazione': p('staff', false, true),
    amministrazione: p('amministrazione'),
    'amministrazione + istruttore': p('amministrazione', true),
    'segreteria + istruttore': p('staff', true),
    istruttore: p('istruttore'),
    strano: { ruolo: 'contabile', ancheIstruttore: true, ancheAmministrazione: true },
  }
  const gruppi = (c) => m.menuDi(chi[c]).map((g) => [g.titolo, g.voci.map(([id]) => id)])
  const DELLA_SEGRETERIA_NEL_MENU = [
    ['Ogni giorno', ['dafare', 'richieste', 'presenze']],
    ['Iscritti e soldi', ['iscritti', 'tessere', 'pagamenti']],
    ['Corsi e orari', ['settimana', 'corsi', 'listino']],
    ['Istruttori', ['istruttori', 'personale']],
    ['Il resto', ['statistiche', 'vestiario', 'esercizi', 'segnalazioni', 'sito']],
  ]
  ok('solo segreteria: i cinque gruppi, senza CONTABILITÀ', gruppi('segreteria'), DELLA_SEGRETERIA_NEL_MENU)
  ok('segreteria e amministrazione: gli stessi, e «I conti» con CONTABILITÀ dopo «Iscritti e soldi»', gruppi('segreteria + amministrazione'), DELLA_SEGRETERIA_NEL_MENU.flatMap(([t, v]) => (t === 'Iscritti e soldi' ? [[t, v], ['I conti', ['contabilita']]] : [[t, v]])))
  ok('solo amministrazione: solo «I conti», tre voci', gruppi('amministrazione'), [['I conti', ['contabilita', 'pagamenti', 'listino']]])
  ok('insegnare non aggiunge voci a chi ha l\'amministrazione', gruppi('amministrazione + istruttore'), gruppi('amministrazione'))
  ok('insegnare non aggiunge voci a chi ha la segreteria', gruppi('segreteria + istruttore'), gruppi('segreteria'))
  ok('un istruttore non ha il menu', gruppi('istruttore'), [])
  ok('un ruolo che l\'app non conosce nemmeno, anche col dato sporco', gruppi('strano'), [])
  ok('LA PALESTRA è il gruppo secondario, sul telefono più piccolo', m.menuDi(chi.segreteria).filter((g) => g.secondario).map((g) => g.titolo), ['Il resto'])
  ok('nessun gruppo è vuoto, per nessuno', Object.keys(chi).every((c) => m.menuDi(chi[c]).every((g) => g.voci.length > 0)), true)
  ok('nessuna voce due volte', Object.keys(chi).every((c) => { const v = m.vociDelMenu(chi[c]); return v.length === new Set(v).size }), true)
  ok('CONTABILITÀ solo a chi ha l\'amministrazione', Object.keys(chi).filter((c) => m.vociDelMenu(chi[c]).includes('contabilita')), ['segreteria + amministrazione', 'amministrazione', 'amministrazione + istruttore'])
  ok('ogni voce del menu è una voce che l\'indirizzo conosce', Object.keys(chi).every((c) => m.vociDelMenu(chi[c]).every((v) => m.VOCI.includes(v))), true)
  ok('la guida di ogni voce è una pagina che esiste', ['segreteria', 'amministrazione', 'segreteria + amministrazione'].every((c) => [...m.vociConsentite(chi[c], { prova: true })].every((v) => existsSync(`guida/${m.guidaDellaVoce(v, chi[c])}.md`))), true)
  ok('CONTABILITÀ ha la guida dell\'amministrazione', m.guidaDellaVoce('contabilita', chi.amministrazione), 'amministrazione/contabilita')
  ok('PAGAMENTI: la guida ridotta per chi ha solo l\'amministrazione, quella completa per la segreteria', [m.guidaDellaVoce('pagamenti', chi.amministrazione), m.guidaDellaVoce('pagamenti', chi['segreteria + amministrazione'])], ['amministrazione/pagamenti', 'segreteria/pagamenti'])
  ok('PAGAMENTI ridotto (solo nomi) solo senza la segreteria', Object.keys(chi).filter((c) => m.pagamentiRidotti(chi[c])), ['amministrazione', 'amministrazione + istruttore', 'istruttore', 'strano'])
  ok('dove si atterra: la prima voce del menu', Object.keys(chi).map((c) => m.primaVoce(chi[c])), ['dafare', 'dafare', 'contabilita', 'contabilita', 'dafare', undefined, undefined])
  const consenti = (voce, c, prova = false) => m.postoConsentito({ voce }, chi[c], { prova })
  ok('una voce che spetta resta com\'è', consenti('iscritti', 'segreteria'), { voce: 'iscritti' })
  ok('CONTABILITÀ a chi non ha l\'amministrazione porta alla prima voce', consenti('contabilita', 'segreteria'), { voce: 'dafare' })
  ok('chi ha solo l\'amministrazione che scrive #iscritti arriva a CONTABILITÀ', consenti('iscritti', 'amministrazione'), { voce: 'contabilita' })
  ok('…e anche #regole (le impostazioni sono della segreteria)', consenti('regole', 'amministrazione'), { voce: 'contabilita' })
  ok('la segreteria apre le impostazioni, che non sono nel menu', consenti('regole', 'segreteria'), { voce: 'regole' })
  ok('le segnalate sono della segreteria, e solo in prova', [consenti('segnalate', 'segreteria', true).voce, consenti('segnalate', 'segreteria', false).voce], ['segnalate', 'dafare'])
  ok('l\'id della scheda aperta resta, se la voce spetta', m.postoConsentito({ voce: 'iscritti', persona: 'p1' }, chi.segreteria, { prova: false }), { voce: 'iscritti', persona: 'p1' })
  ok('e non resta se la voce non spetta', m.postoConsentito({ voce: 'iscritti', persona: 'p1' }, chi.amministrazione, { prova: false }), { voce: 'contabilita' })
  ok('il titolo del posto: uno solo, non due sezioni', Object.keys(chi).map((c) => m.titoloDelMenu(chi[c])), ['SEGRETERIA', 'GESTIONE', 'AMMINISTRAZIONE', 'AMMINISTRAZIONE', 'SEGRETERIA', 'SEGRETERIA', 'SEGRETERIA'])
}

console.log('\nil menu e i permessi dicono la stessa cosa')
{
  // Ogni voce del menu ha il suo permesso in `puo`: se qualcuno cambia l'uno senza l'altro, qui si vede.
  const PERMESSO = { contabilita: 'contabilita', pagamenti: 'pagina-pagamenti', listino: 'listino' }
  const permessoDi = (v) => PERMESSO[v] ?? 'persone'
  const persone = [p('staff'), p('staff', false, true), p('amministrazione'), p('amministrazione', true), p('staff', true), p('istruttore'), { ruolo: 'contabile', ancheIstruttore: true, ancheAmministrazione: true }]
  for (const x of persone) {
    const nome = `${x.ruolo}${x.ancheAmministrazione ? ' + amministrazione' : ''}${x.ancheIstruttore ? ' + istruttore' : ''}`
    const nelMenu = m.vociDelMenu(x)
    ok(`${nome}: ogni voce del menu la può usare`, nelMenu.filter((v) => !m.puo(x, permessoDi(v))), [])
    ok(`${nome}: le voci dei conti che può usare ci sono tutte`, ['contabilita', 'pagamenti', 'listino'].filter((v) => m.puo(x, permessoDi(v)) && !nelMenu.includes(v)), [])
  }
  ok('chi legge la segreteria: la segreteria sì, i soli conti no', [m.leggeLaSegreteria(p('staff')), m.leggeLaSegreteria(p('staff', false, true)), m.leggeLaSegreteria(p('amministrazione')), m.leggeLaSegreteria(p('istruttore'))], [true, true, false, false])
}

console.log('\nl\'indirizzo scritto a mano e il vecchio indirizzo dell\'amministrazione')
{
  const amm = p('amministrazione')
  const seg = p('staff')
  const segAmm = p('staff', false, true)
  const corretto = (hash, c, prova = false) => m.indirizzoConsentito(hash, c, { prova })
  ok('chi cura solo i conti: una voce che non c\'è porta a CONTABILITÀ, e l\'indirizzo lo dice', [corretto('#foo', amm), corretto('#iscritti/', amm), corretto('#iscritti/p1', amm)], ['#contabilita', '#contabilita', '#contabilita'])
  ok('…anche le impostazioni e le segnalate', [corretto('#regole', amm), corretto('#segnalate', amm, true)], ['#contabilita', '#contabilita'])
  ok('…e una sua voce va bene com\'è', [corretto('#contabilita', amm), corretto('#pagamenti', amm), corretto('#listino', amm)], [null, null, null])
  ok('la segreteria senza amministrazione: CONTABILITÀ porta alla prima voce', corretto('#contabilita', seg), '#dafare')
  ok('la segreteria con tutte e due apre la contabilità', corretto('#contabilita', segAmm), null)
  ok('una voce e una scheda della segreteria vanno bene', [corretto('#iscritti', seg), corretto('#iscritti/p1', seg), corretto('#regole', seg)], [null, null, null])
  ok('senza cancelletto o col cancelletto degli altri non si tocca niente', [corretto('', amm), corretto('#', amm), corretto('#access_token=x', amm), corretto('#guida/sala', amm)], [null, null, null, null])
  ok('il vecchio indirizzo dell\'amministrazione va a quello nuovo, con la query e il cancelletto', [m.rimandaAmministrazione('', ''), m.rimandaAmministrazione('?adesso=2026-10-01', '#pagamenti'), m.rimandaAmministrazione('', '#contabilita')], ['segreteria/', 'segreteria/?adesso=2026-10-01#pagamenti', 'segreteria/#contabilita'])
  ok('l\'area «amministrazione», ancora nel tipo, ha lo stesso nome del menu e non diventa SALA', [m.nomeDellArea('amministrazione', amm), m.nomeDellArea('amministrazione', p('staff', false, true))], ['AMMINISTRAZIONE', 'GESTIONE'])
  ok('il passaggio dal calendario: il nome del posto, uno solo', [m.nomeDellArea('segreteria', p('staff')), m.nomeDellArea('segreteria', p('staff', true, true)), m.nomeDellArea('segreteria', amm), m.nomeDellArea('istruttori', amm), m.nomeDellArea('sala', amm)], ['SEGRETERIA', 'GESTIONE', 'AMMINISTRAZIONE', 'ISTRUTTORI', 'SALA'])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
