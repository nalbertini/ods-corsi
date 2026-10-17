// ---------------------------------------------------------------------------
// I ruoli del personale, senza browser: le tre spunte, le aree, e chi può cosa.
//
//   node scripts/prova-ruoli.mjs
//
// Le stesse regole del database (`supabase/prova/amministrazione.sql`): la
// lista di `puo` qui e le policy là devono dire le stesse cose.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: "export * from './src/lib/ruoli'",
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
  { spunte: ['amministrazione'], persona: p('amministrazione'), aree: ['amministrazione'], nome: 'Amministrazione' },
  { spunte: ['istruttore'], persona: p('istruttore'), aree: ['istruttori'], nome: 'Istruttore' },
  { spunte: ['segreteria', 'amministrazione'], persona: p('staff', false, true), aree: ['segreteria', 'amministrazione'], nome: 'Segreteria e amministrazione' },
  { spunte: ['segreteria', 'istruttore'], persona: p('staff', true), aree: ['segreteria', 'istruttori'], nome: 'Segreteria e istruttore' },
  { spunte: ['amministrazione', 'istruttore'], persona: p('amministrazione', true), aree: ['amministrazione', 'istruttori'], nome: 'Amministrazione e istruttore' },
  {
    spunte: ['segreteria', 'amministrazione', 'istruttore'],
    persona: p('staff', true, true),
    aree: ['segreteria', 'amministrazione', 'istruttori'],
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

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
