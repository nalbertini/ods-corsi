// ---------------------------------------------------------------------------
// La sezione IMPORTAZIONI (Satispay e banca), senza browser.
//
//   node scripts/prova-importazioni.mjs
//
// Le regole stanno in `src/lib/satispayScarico.ts` e `src/lib/importaBanca.ts`; il database
// (113-importazioni.sql) dice le stesse cose, e `supabase/prova/importazioni.sql` ha gli stessi
// casi con gli stessi messaggi. Oggi, per la prova, è il 22 ottobre 2026.
//
// Firme che queste prove si aspettano (satispayScarico.ts):
//   gruppiDaDecidere(casi: DaDecidere[]): Array<{ tipo, motivo, data, importo, pagamenti: DaDecidere[], candidati: DaDecidere['candidati'] }>
//   nomeSimile(chi: string, descrizione: string): boolean
//   decidiGruppo(dati: DatiScarico, scelte: Array<{ satispayId, scelta: SceltaSatispay, movimentoId? }>): { movimenti, negozio }
//   scollegaScarico(dati: DatiScarico, satispayId: string): { movimenti, negozio }
//   righeEntrato(dati: Pick<DatiScarico, 'negozio'|'movimenti'|'voci'|'casse'>, mese: 'AAAA-MM'):
//     Array<{ satispayId, tipo, importo, data, chi, esito, movimento: { id, descrizione, cassa } | null }>
//   riepilogoEntrato(dati: Pick<DatiScarico, 'negozio'>, mese): { entrato, secondoSatispay, aMano: { conteggio, importo } }
// (importaBanca.ts):
//   copertiDaSalvare(a: AnteprimaBanca): Array<{ chiave, data, tipo, importo, descrizione, conId, conDescrizione }>
//   nonEQuestoBanca(coperti, chiave: string, chiusure: ChiusuraCassa[], contoId: string): { scrivi: DatoImportBanca, coperti }
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const OGGI = '2026-10-22'

// Un modulo che manca fa rosso i suoi casi, non ferma gli altri.
const carica = async (contents) => {
  try {
    const { outputFiles } = await build({
      stdin: { contents, resolveDir: '.', loader: 'ts' },
      bundle: true,
      format: 'esm',
      platform: 'node',
      write: false,
      logLevel: 'silent',
      define: { 'import.meta.env': '{}' },
    })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log(`  ✗ non si carica: ${contents}\n      ${String(e.message).split('\n').slice(0, 2).join(' ')}`)
    return {}
  }
}
const s = await carica("export * from './src/lib/satispayScarico'")
const b = await carica("export * from './src/lib/importaBanca'")

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Il risultato di una funzione, o «ERRORE: …» se non c'è o si rompe (anche una funzione che manca fa rosso).
const prova = (fn) => {
  try {
    return fn()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
const copia = (x) => JSON.parse(JSON.stringify(x))

// --- i dati -----------------------------------------------------------------
const casse = [
  { id: 'co', nome: 'Cassa Contanti', saldoIniziale: 0 },
  { id: 'cc', nome: 'Conto Corrente', saldoIniziale: 0, dal: '2026-09-01' },
  { id: 'sa', nome: 'Satispay', saldoIniziale: 0, dal: '2026-10-01' },
]
const voci = [
  { id: 'vc', nome: 'Corsi e altri pagamenti', tipo: 'entrata', diSistema: true, attiva: true },
  { id: 'vde', nome: 'Da classificare', tipo: 'entrata', diSistema: false, attiva: true },
  { id: 'vdu', nome: 'Da classificare', tipo: 'uscita', diSistema: false, attiva: true },
]
// Un'entrata a mano; `creatoIl` ordina i candidati.
const mv = (id, data, importo, cassaId, altro = {}) => ({
  id, tipo: 'entrata', data, importo, voceId: 'vc', cassaId, descrizione: `a mano ${id}`, creatoIl: `2026-10-14T0${id.length}:00:00Z`, ...altro,
})
const pn = (satispayId, importo, quando, altro = {}) => ({ satispayId, tipo: 'TO_BUSINESS', stato: 'ACCEPTED', importo, quando, chi: 'Mario Rossi', ...altro })
const dd = (satispayId, importo, quando, candidati, altro = {}) => pn(satispayId, importo, quando, { esito: 'da_decidere', motivo: 'forse_doppione', candidati, ...altro })
const dati = (negozio, movimenti, chiusure = []) => ({ negozio, modulo: [], pagamenti: [], movimenti, casse, chiusure, voci, oggi: OGGI })
const chiusa = (cassaId, data) => ({ id: `k-${cassaId}-${data}`, cassaId, dal: '2026-09-01', data, previsto: 0, contato: 0, differenza: 0, chiusaIl: '2026-10-16T08:00:00Z' })

console.log('1. i candidati non includono i movimenti già presi o annullati (bug)')
{
  const movimenti = [
    mv('m1', '2026-10-14', 1250, 'cc', { satispayId: 'ALTRO' }), // già di un altro pagamento
    mv('m2', '2026-10-14', 1250, 'cc'),
    mv('m33', '2026-10-14', 1250, 'cc', { annullatoIl: '2026-10-15T10:00:00Z' }), // annullato
  ]
  const d = dati([dd('P1', 1250, '2026-10-14T10:00:00Z', ['m1', 'm2', 'm33'])], movimenti)
  ok('un movimento col segno di un altro pagamento o annullato non è candidato', prova(() => s.daDecidere(d)[0].candidati.map((c) => c.id)), ['m2'])
  ok('senza segni né annullamenti restano tutti, nell\'ordine di scrittura', prova(() => s.daDecidere(dati([dd('P1', 1250, '2026-10-14T10:00:00Z', ['m1', 'm2'])], [mv('m1', '2026-10-14', 1250, 'cc'), mv('m2', '2026-10-14', 1250, 'cc')]))[0].candidati.map((c) => c.id)), ['m1', 'm2'])
}

console.log('\n2. i casi uguali si decidono insieme: gruppiDaDecidere')
{
  const cand = (id) => ({ id, descrizione: `a mano ${id}`, voce: 'Corsi e altri pagamenti', cassa: 'Conto Corrente', importo: 1250 })
  const caso = (satispayId, data, importo, candidati, altro = {}) => ({ satispayId, tipo: 'TO_BUSINESS', importo, chi: satispayId, motivo: 'forse_doppione', data, candidati: candidati.map(cand), ...altro })
  // Alla rinfusa: il gruppo non dipende dall'ordine in cui arrivano.
  const casi = [
    caso('P4', '2026-10-15', 1250, ['m9']),
    caso('P1', '2026-10-14', 1250, ['m1', 'm2']),
    caso('P5', '2026-10-14', 2500, [], { tipo: 'REFUND_TO_BUSINESS', motivo: 'giorno_chiuso' }),
    caso('P2', '2026-10-14', 1250, ['m2', 'm3']),
    caso('P6', '2026-10-12', 900, ['m7']),
    caso('P3', '2026-10-14', 1250, ['m1', 'm3']),
    caso('P7', '2026-10-14', 2000, [], { motivo: 'giorno_chiuso' }),
    caso('P8', '2026-10-14', 2000, [], { motivo: 'giorno_chiuso' }),
  ]
  const prima = copia(casi)
  const g = prova(() => s.gruppiDaDecidere(casi))
  ok('un gruppo per tipo, motivo, giorno e importo, per data e poi importo', prova(() => g.map((x) => [x.tipo, x.motivo, x.data, x.importo])), [
    ['TO_BUSINESS', 'forse_doppione', '2026-10-12', 900],
    ['TO_BUSINESS', 'forse_doppione', '2026-10-14', 1250],
    ['TO_BUSINESS', 'giorno_chiuso', '2026-10-14', 2000],
    ['REFUND_TO_BUSINESS', 'giorno_chiuso', '2026-10-14', 2500],
    ['TO_BUSINESS', 'forse_doppione', '2026-10-15', 1250],
  ])
  ok('ogni gruppo ha i suoi pagamenti', prova(() => g.map((x) => x.pagamenti.map((p) => p.satispayId))), [['P6'], ['P1', 'P2', 'P3'], ['P7', 'P8'], ['P5'], ['P4']])
  ok('i candidati di un gruppo sono l\'unione, una volta sola', prova(() => g[1].candidati.map((c) => c.id).sort()), ['m1', 'm2', 'm3'])
  ok('un gruppo senza candidati ne ha una lista vuota', prova(() => g[2].candidati), [])
  ok('i casi di partenza non cambiano', casi, prima)
  ok('nessun caso: nessun gruppo', prova(() => s.gruppiDaDecidere([])), [])
}

console.log('\n3. nomeSimile: serve solo a mettere un candidato per primo, non sceglie')
{
  const v = (chi, descr) => prova(() => s.nomeSimile(chi, descr))
  ok('«Mario Rossi» e «Cliente Rossi Mario»: l\'ordine e «Cliente» non contano', v('Mario Rossi', 'Cliente Rossi Mario'), true)
  ok('un altro nome: no', v('Luca Bianchi', 'Cliente Rossi Mario'), false)
  ok('maiuscole e accenti non contano', v('JOSÈ Núñez', 'bonifico jose nunez'), true)
  ok('«Cliente» da solo non basta', v('Cliente Rossi', 'Cliente Verdi'), false)
  ok('senza nome di chi ha pagato: no', v('', 'Cliente Rossi Mario'), false)
  ok('solo il cognome in comune e il nome diverso: no', v('Mario Rossi', 'Cliente Rossi Anna'), false)
  const cs = [{ id: 'a', descrizione: 'Cliente Verdi Anna' }, { id: 'b', descrizione: 'Cliente Bianchi Luca' }, { id: 'c', descrizione: 'Cliente Rossi Mario' }]
  ok('il candidato col nome simile va primo, gli altri restano in ordine', prova(() => s.candidatiInOrdine('Mario Rossi', cs).map((x) => x.id)), ['c', 'a', 'b'])
  ok('senza nome simile l\'ordine non cambia', prova(() => s.candidatiInOrdine('Pia', cs).map((x) => x.id)), ['a', 'b', 'c'])
}

console.log('\n4. decidiGruppo: tutte le scelte o nessuna')
{
  const movimenti = [mv('m1', '2026-10-14', 1250, 'cc'), mv('m2', '2026-10-14', 1250, 'cc')]
  const negozio = [dd('P1', 1250, '2026-10-14T09:00:00Z', ['m1', 'm2']), dd('P2', 1250, '2026-10-14T11:00:00Z', ['m1', 'm2'])]
  const d = dati(negozio, movimenti)
  const prima = copia(d)
  const r = prova(() => s.decidiGruppo(d, [{ satispayId: 'P1', scelta: 'a_mano', movimentoId: 'm1' }, { satispayId: 'P2', scelta: 'a_mano', movimentoId: 'm2' }]))
  ok('due pagamenti, due movimenti diversi: tutti e due a_mano', prova(() => r.negozio.map((p) => [p.esito, p.movimentoId])), [['a_mano', 'm1'], ['a_mano', 'm2']])
  ok('…e i movimenti prendono il segno', prova(() => r.movimenti.map((m) => m.satispayId)), ['P1', 'P2'])
  ok('i dati di partenza non cambiano', d, prima)

  ok('lo stesso movimento per due pagamenti: errore', prova(() => s.decidiGruppo(d, [{ satispayId: 'P1', scelta: 'a_mano', movimentoId: 'm1' }, { satispayId: 'P2', scelta: 'a_mano', movimentoId: 'm1' }])), 'ERRORE: Lo stesso movimento è scelto per due pagamenti')
  ok('«incasso nuovo» per tutti: due movimenti nuovi nel giorno del pagamento, sulla cassa Satispay',
    prova(() => { const x = s.decidiGruppo(d, [{ satispayId: 'P1', scelta: 'scrivi' }, { satispayId: 'P2', scelta: 'scrivi' }]); return [x.negozio.map((p) => p.esito), x.movimenti.length, x.movimenti.slice(2).map((m) => [m.data, m.cassaId, m.importo, m.satispayId])] }),
    [['scritto', 'scritto'], 4, [['2026-10-14', 'sa', 1250, 'P1'], ['2026-10-14', 'sa', 1250, 'P2']]])
  ok('una scelta mista: uno a mano, uno nuovo', prova(() => s.decidiGruppo(d, [{ satispayId: 'P1', scelta: 'a_mano', movimentoId: 'm1' }, { satispayId: 'P2', scelta: 'scrivi' }]).negozio.map((p) => p.esito)), ['a_mano', 'scritto'])

  // Il 14 la cassa Satispay è chiusa: «scrivi» per il secondo rifiuta, e il primo non deve restare fatto.
  const chiuso = dati(negozio, movimenti, [chiusa('sa', '2026-10-15')])
  const primaChiuso = copia(chiuso)
  ok('una scelta che fallisce (giorno chiuso) ferma tutto', prova(() => s.decidiGruppo(chiuso, [{ satispayId: 'P1', scelta: 'a_mano', movimentoId: 'm1' }, { satispayId: 'P2', scelta: 'scrivi' }])), 'ERRORE: Quel giorno la cassa è chiusa: scrivilo oggi')
  ok('…e i dati non hanno niente di cambiato', chiuso, primaChiuso)
  ok('in un giorno chiuso «incasso nuovo» è «oggi»: scrive con la data di oggi', prova(() => { const x = s.decidiGruppo(chiuso, [{ satispayId: 'P1', scelta: 'oggi' }, { satispayId: 'P2', scelta: 'oggi' }]); return x.movimenti.slice(2).map((m) => m.data) }), [OGGI, OGGI])
  ok('un pagamento già deciso nel gruppo: errore', prova(() => s.decidiGruppo(dati([{ ...negozio[0], esito: 'fuori' }, negozio[1]], movimenti), [{ satispayId: 'P1', scelta: 'fuori' }, { satispayId: 'P2', scelta: 'fuori' }])), 'ERRORE: Questo pagamento è già deciso')
  ok('un movimento fuori dai candidati del suo pagamento: errore', prova(() => s.decidiGruppo(d, [{ satispayId: 'P1', scelta: 'a_mano', movimentoId: 'm9' }])), 'ERRORE: Scegli uno dei movimenti proposti')
}

console.log('\n5. «Non è questo»: scollegaScarico')
{
  const movimenti = [mv('m1', '2026-10-14', 1250, 'cc', { satispayId: 'P1' }), mv('m2', '2026-10-14', 1250, 'cc')]
  const negozio = [pn('P1', 1250, '2026-10-14T10:00:00Z', { esito: 'a_mano', movimentoId: 'm1' })]
  const d = dati(negozio, movimenti)
  const prima = copia(d)
  const r = prova(() => s.scollegaScarico(d, 'P1'))
  ok('il movimento a mano resta, senza segno', prova(() => r.movimenti.map((m) => [m.id, m.satispayId ?? null, m.annullatoIl ?? null])), [['m1', null, null], ['m2', null, null]])
  ok('il pagamento torna da decidere, forse doppione, senza movimento', prova(() => [r.negozio[0].esito, r.negozio[0].motivo, r.negozio[0].movimentoId ?? null]), ['da_decidere', 'forse_doppione', null])
  ok('i candidati si ricalcolano: anche il movimento appena scollegato', prova(() => r.negozio[0].candidati), ['m1', 'm2'])
  ok('…e in daDecidere si vedono con i loro dati', prova(() => s.daDecidere({ ...d, ...r })[0].candidati.map((c) => c.id)), ['m1', 'm2'])
  ok('con un solo movimento possibile resta da decidere: lo sceglie chi legge', prova(() => { const x = s.scollegaScarico(dati(negozio, [movimenti[0]]), 'P1'); return [x.negozio[0].esito, x.negozio[0].candidati] }), ['da_decidere', ['m1']])
  ok('i dati di partenza non cambiano', d, prima)

  ok('la cassa di quel giorno è chiusa: il collegamento resta', prova(() => s.scollegaScarico(dati(negozio, movimenti, [chiusa('cc', '2026-10-14')]), 'P1')), 'ERRORE: Quel giorno la cassa è chiusa: il collegamento resta')
  ok('una chiusura di un\'altra cassa non conta', prova(() => s.scollegaScarico(dati(negozio, movimenti, [chiusa('sa', '2026-10-31')]), 'P1').negozio[0].esito), 'da_decidere')
  ok('un pagamento scritto da noi non si scollega', prova(() => s.scollegaScarico(dati([pn('P1', 1250, '2026-10-14T10:00:00Z', { esito: 'scritto', movimentoId: 'm1' })], movimenti), 'P1')), 'ERRORE: Questo pagamento non è collegato a un movimento a mano')
  ok('un pagamento ancora da decidere nemmeno', prova(() => s.scollegaScarico(dati([dd('P1', 1250, '2026-10-14T10:00:00Z', ['m2'])], movimenti), 'P1')), 'ERRORE: Questo pagamento non è collegato a un movimento a mano')
  ok('un pagamento che non c\'è', prova(() => s.scollegaScarico(d, 'XX')), 'ERRORE: Il pagamento non c’è')
}

console.log('\n6. cosa è entrato in un mese: righeEntrato e riepilogoEntrato')
{
  const movimenti = [
    mv('ms1', '2026-10-14', 1250, 'sa', { satispayId: 'S1', descrizione: 'Satispay · Mario Rossi' }),
    mv('ma', '2026-10-14', 1250, 'cc', { satispayId: 'S2', descrizione: 'Bonifico di Mario' }),
    mv('ms7', '2026-10-16', 500, 'sa', { satispayId: 'S7', tipo: 'uscita', descrizione: 'Rimborso Satispay · Pia' }),
  ]
  const negozio = [
    pn('S1', 1250, '2026-10-14T10:00:00Z', { esito: 'scritto', movimentoId: 'ms1' }),
    pn('S2', 1250, '2026-10-14T11:00:00Z', { esito: 'a_mano', movimentoId: 'ma' }),
    pn('S3', 5000, '2026-10-13T10:00:00Z', { esito: 'modulo' }),
    pn('S4', 3000, '2026-10-13T11:00:00Z', { esito: 'pagamenti' }),
    dd('S5', 800, '2026-10-15T10:00:00Z', []),
    pn('S6', 600, '2026-10-16T10:00:00Z', { esito: 'fuori', motivo: 'prima_della_cassa' }),
    pn('S7', 500, '2026-10-16T12:00:00Z', { tipo: 'REFUND_TO_BUSINESS', esito: 'scritto', movimentoId: 'ms7', chi: 'Pia' }),
    pn('S8', 2000, '2026-09-20T10:00:00Z', { esito: 'scritto' }), // di settembre
    pn('S9', 400, '2026-10-17T10:00:00Z'), // ancora senza esito
    pn('S10', 1000, '2026-10-17T11:00:00Z', { stato: 'PENDING' }), // non accettato
    pn('S11', 100, '2026-10-31T23:30:00Z', { esito: 'scritto' }), // le 00:30 del 1 novembre a Roma
  ]
  const d = dati(negozio, movimenti)
  const r = prova(() => s.righeEntrato(d, '2026-10'))
  ok('una riga per pagamento entrato del mese, per giorno e poi id; non da decidere, non fuori', prova(() => r.map((x) => [x.satispayId, x.esito])), [['S3', 'modulo'], ['S4', 'pagamenti'], ['S1', 'scritto'], ['S2', 'a_mano'], ['S7', 'scritto']])
  ok('la riga porta il movimento collegato', prova(() => [r[2].movimento, r[3].movimento, r[4].movimento.id]), [{ id: 'ms1', descrizione: 'Satispay · Mario Rossi', cassa: 'Satispay' }, { id: 'ma', descrizione: 'Bonifico di Mario', cassa: 'Conto Corrente' }, 'ms7'])
  ok('modulo e pagamenti non hanno un movimento', prova(() => [r[0].movimento, r[1].movimento]), [null, null])
  ok('la riga dice tipo, importo, giorno e chi', prova(() => [r[4].tipo, r[4].importo, r[4].data, r[4].chi]), ['REFUND_TO_BUSINESS', 500, '2026-10-16', 'Pia'])
  ok('il giorno è quello di Roma: le 00:30 del 1 novembre sono di novembre', prova(() => s.righeEntrato(d, '2026-11').map((x) => x.satispayId)), ['S11'])
  const q = prova(() => s.riepilogoEntrato(d, '2026-10'))
  // Come nel design: «di cui già a mano» sta dentro l'entrato, e a mese deciso l'entrato torna col totale di Satispay.
  ok('entrato da Satispay: tutto quel che è in contabilità (scritto, a mano, modulo, pagamenti), incassi meno rimborsi (1250 + 1250 + 5000 + 3000 − 500)', prova(() => q.entrato), 10000)
  ok('secondo Satispay: tutti gli ACCEPTED del mese, qualunque esito, incassi meno rimborsi', prova(() => q.secondoSatispay), 11800)
  ok('già a mano: quanti e quanto', prova(() => q.aMano), { conteggio: 1, importo: 1250 })
  ok('un mese senza pagamenti: tutto a zero', prova(() => s.riepilogoEntrato(d, '2026-08')), { entrato: 0, secondoSatispay: 0, aMano: { conteggio: 0, importo: 0 } })
}

console.log('\n7. banca: i movimenti coperti si salvano per rivederli')
const T = '\t'
const riga = (data, add, acc, testo) => [data, data, add, acc, '26', testo, 'BONIFICO'].join(T)
const file = (...righe) => ['LISTA MOVIMENTI', T + 'Data contabile', ...righe].join('\r\n')
const esistente = (o) => ({ id: 'r1', origine: 'movimento', tipo: 'entrata', data: '2026-10-03', importo: 12000, descrizione: 'Saldo corso Luca', voce: 'Corsi e altri pagamenti', cassaId: 'cc', annullato: false, ...o })
{
  const lettura = prova(() => b.leggiBanca(file(riga('03/10/2026', '', '120,00', 'Da Luca Verdi saldo corso'), riga('05/10/2026', '', '50,00', 'Da Anna'))))
  const a = prova(() => b.anteprimaBanca(lettura, [esistente()], 'cc', OGGI))
  const c = prova(() => b.copertiDaSalvare(a))
  ok('un movimento coperto: una riga da salvare', prova(() => c.length), 1)
  ok('…con i campi per `banca_segna_coperti`', prova(() => Object.keys(c[0]).sort()), ['chiave', 'conDescrizione', 'conId', 'data', 'descrizione', 'importo', 'tipo'])
  ok('…quelli del movimento della banca e di quello a mano', prova(() => [c[0].chiave, c[0].data, c[0].tipo, c[0].importo, c[0].descrizione, c[0].conId, c[0].conDescrizione]), [a.coperti[0].movimento.chiave, '2026-10-03', 'entrata', 12000, 'Da Luca Verdi saldo corso BONIFICO', 'r1', 'Saldo corso Luca'])
  ok('niente coperti: niente da salvare', prova(() => b.copertiDaSalvare(b.anteprimaBanca(lettura, [], 'cc', OGGI))), [])

  console.log('\n8. banca: «Non è questo»')
  const k = (chiave, data) => ({ chiave, data, tipo: 'entrata', importo: 12000, descrizione: 'Da Luca Verdi saldo corso BONIFICO', conId: 'r1', conDescrizione: 'Saldo corso Luca' })
  const coperti = [k('banca:20261003:abc:0', '2026-10-03'), k('banca:20261004:def:0', '2026-10-04')]
  const r = prova(() => b.nonEQuestoBanca(coperti, 'banca:20261003:abc:0', [], 'cc'))
  ok('dice cosa scrivere: come un import normale, nel Conto Corrente, da classificare', prova(() => r.scrivi), { chiave: 'banca:20261003:abc:0', data: '2026-10-03', cassa: 'conto', tipo: 'entrata', importo: 12000, descrizione: 'Da Luca Verdi saldo corso BONIFICO', voce: 'Da classificare' })
  ok('…e toglie la riga dai coperti', prova(() => r.coperti.map((x) => x.chiave)), ['banca:20261004:def:0'])
  ok('i coperti di partenza non cambiano', prova(() => coperti.length), 2)
  ok('il Conto Corrente è chiuso quel giorno: il collegamento resta', prova(() => b.nonEQuestoBanca(coperti, 'banca:20261003:abc:0', [chiusa('cc', '2026-10-03')], 'cc')), 'ERRORE: Quel giorno la cassa è chiusa: il collegamento resta')
  ok('una chiusura di un\'altra cassa non conta', prova(() => b.nonEQuestoBanca(coperti, 'banca:20261003:abc:0', [chiusa('sa', '2026-10-31')], 'cc').scrivi.chiave), 'banca:20261003:abc:0')
  ok('una chiave che non c\'è', prova(() => b.nonEQuestoBanca(coperti, 'banca:x', [], 'cc')), 'ERRORE: Questo movimento non è fra quelli già scritti')
}

console.log('\n9. il riepilogo di un gruppo prima della conferma: riepilogoGruppo')
{
  const cand = (id, descrizione) => ({ id, descrizione, voce: 'Corsi e altri pagamenti', cassa: 'Conto Corrente', importo: 1250 })
  const pag = (satispayId, chi) => ({ satispayId, tipo: 'TO_BUSINESS', importo: 1250, chi, motivo: 'forse_doppione', data: '2026-10-14', candidati: [] })
  const gruppo = {
    tipo: 'TO_BUSINESS', motivo: 'forse_doppione', data: '2026-10-14', importo: 1250,
    pagamenti: [pag('P1', 'Mario Rossi'), pag('P2', 'Anna Verdi'), pag('P3', 'Pia')],
    candidati: [cand('m1', 'Cliente Rossi Mario'), cand('m2', 'Cliente Bianchi Luca')],
  }
  const vuoto = prova(() => s.riepilogoGruppo(gruppo, {}))
  ok('nessuna scelta: ne mancano tre, e niente da confermare', prova(() => [vuoto.mancano, vuoto.scelte]), [3, null])
  const r = prova(() => s.riepilogoGruppo(gruppo, { P1: { scelta: 'a_mano', movimentoId: 'm1' }, P2: { scelta: 'a_mano', movimentoId: 'm2' }, P3: { scelta: 'scrivi' } }))
  ok('tutte scelte: non ne manca nessuna', prova(() => r.mancano), 0)
  ok('i collegati dicono chi, con cosa, e se il nome somiglia', prova(() => r.collegati), [
    { chi: 'Mario Rossi', descrizione: 'Cliente Rossi Mario', simile: true },
    { chi: 'Anna Verdi', descrizione: 'Cliente Bianchi Luca', simile: false },
  ])
  ok('gli incassi nuovi: quanti e quanto', prova(() => r.nuovi), { conteggio: 1, importo: 1250 })
  ok('le scelte per decidiGruppo, nell\'ordine dei pagamenti', prova(() => r.scelte), [
    { satispayId: 'P1', scelta: 'a_mano', movimentoId: 'm1' },
    { satispayId: 'P2', scelta: 'a_mano', movimentoId: 'm2' },
    { satispayId: 'P3', scelta: 'scrivi' },
  ])
  ok('un movimento preso da un pagamento è spento per gli altri', prova(() => s.riepilogoGruppo(gruppo, { P1: { scelta: 'a_mano', movimentoId: 'm1' } }).presi), { m1: 'P1' })
  ok('lo stesso movimento per due pagamenti non si conferma', prova(() => s.riepilogoGruppo(gruppo, { P1: { scelta: 'a_mano', movimentoId: 'm1' }, P2: { scelta: 'a_mano', movimentoId: 'm1' }, P3: { scelta: 'scrivi' } }).scelte), null)
  ok('«a mano» senza movimento è una scelta che manca', prova(() => s.riepilogoGruppo(gruppo, { P1: { scelta: 'a_mano' } }).mancano), 3)
}

console.log('\n10. banca: cosa è entrato in un mese, entratoBanca')
{
  const rb = (id, data, importo, altro = {}) => ({ id, origine: 'movimento', tipo: 'entrata', data, importo, descrizione: `banca ${id}`, voce: 'Da classificare', cassaId: 'cc', annullato: false, origineImport: `banca:${id}`, ...altro })
  const righe = [
    rb('b1', '2026-10-05', 5000),
    rb('b2', '2026-10-03', 2000, { tipo: 'uscita', voce: 'Affitto' }),
    rb('b3', '2026-10-06', 900, { annullato: true }), // annullata
    rb('b4', '2026-09-30', 700), // di settembre
    { ...rb('a1', '2026-10-05', 300), origineImport: undefined }, // a mano
    { ...rb('s1', '2026-10-05', 300), origineImport: 'satispay:S1' }, // non della banca
  ]
  const coperti = [
    { chiave: 'banca:c1', data: '2026-10-04', tipo: 'entrata', importo: 12000, descrizione: 'Da Luca Verdi', conId: 'r1', conDescrizione: 'Saldo corso Luca' },
    { chiave: 'banca:c2', data: '2026-11-02', tipo: 'entrata', importo: 100, descrizione: 'Di novembre', conId: 'r2', conDescrizione: 'x' },
  ]
  const e = prova(() => b.entratoBanca(righe, coperti, '2026-10'))
  ok('le righe del mese: importate e coperte, per giorno; non annullate, non a mano, non di altri mesi', prova(() => e.righe.map((x) => [x.chiave, x.come])), [['banca:b2', 'nuovo'], ['banca:c1', 'coperto'], ['banca:b1', 'nuovo']])
  ok('una riga importata porta il suo movimento e la voce', prova(() => e.righe[0]), { chiave: 'banca:b2', data: '2026-10-03', tipo: 'uscita', importo: 2000, descrizione: 'banca b2', come: 'nuovo', voce: 'Affitto', con: null })
  ok('una coperta porta il movimento a mano', prova(() => [e.righe[1].voce, e.righe[1].con]), [null, { id: 'r1', descrizione: 'Saldo corso Luca' }])
  ok('i conti: nuovi (entrate meno uscite) e coperti', prova(() => [e.nuovi, e.coperti]), [{ conteggio: 2, importo: 3000 }, { conteggio: 1, importo: 12000 }])
  ok('un mese senza niente', prova(() => b.entratoBanca(righe, coperti, '2026-08')), { righe: [], nuovi: { conteggio: 0, importo: 0 }, coperti: { conteggio: 0, importo: 0 } })
}

console.log('\n11. un movimento a mano è di Satispay o della banca, mai di tutti e due')
{
  // m1 è già coperto da un movimento della banca (il segno `bancaChiave`), m2 è libero.
  const coperto = mv('m1', '2026-10-14', 1250, 'cc', { bancaChiave: 'banca:20261014:abc:0' })
  const libero = mv('m2', '2026-10-14', 1250, 'cc')
  const r = prova(() => s.applicaScarico(dati([pn('P1', 1250, '2026-10-14T10:00:00Z')], [coperto]), true))
  ok('lo scarico non collega da solo un movimento coperto dalla banca: lo scrive nuovo', prova(() => [r.negozio[0].esito, r.negozio[0].movimentoId === 'm1', r.movimenti[0].satispayId ?? null]), ['scritto', false, null])
  ok('fra i candidati da decidere un movimento coperto dalla banca non c\'è', prova(() => s.daDecidere(dati([dd('P1', 1250, '2026-10-14T10:00:00Z', ['m1', 'm2'])], [coperto, libero]))[0].candidati.map((c) => c.id)), ['m2'])
  ok('sceglierlo lo stesso (pagina vecchia): errore, e niente cambia',
    prova(() => s.decidiGruppo(dati([dd('P1', 1250, '2026-10-14T10:00:00Z', ['m1', 'm2'])], [coperto, libero]), [{ satispayId: 'P1', scelta: 'a_mano', movimentoId: 'm1' }])),
    'ERRORE: Quel movimento è già coperto da un movimento della banca: ricarica la pagina')
  ok('«Non è questo» ricalcola i candidati senza i movimenti coperti dalla banca',
    prova(() => s.scollegaScarico(dati([pn('P1', 1250, '2026-10-14T10:00:00Z', { esito: 'a_mano', movimentoId: 'm2' })], [coperto, { ...libero, satispayId: 'P1' }]), 'P1').negozio[0].candidati), ['m2'])

  const lettura = prova(() => b.leggiBanca(file(riga('03/10/2026', '', '120,00', 'Da Luca Verdi saldo corso'))))
  const chiave = prova(() => lettura.movimenti[0].chiave)
  ok('un movimento a mano già di Satispay non copre un movimento della banca: entra nuovo',
    prova(() => { const a = b.anteprimaBanca(lettura, [esistente({ satispayId: 'P1' })], 'cc', OGGI); return [a.coperti.length, a.entrano.length] }), [0, 1])
  ok('un movimento a mano già coperto da un\'altra riga della banca non ne copre una seconda',
    prova(() => { const a = b.anteprimaBanca(lettura, [esistente({ bancaChiave: 'banca:altra' })], 'cc', OGGI); return [a.coperti.length, a.entrano.length] }), [0, 1])
  ok('rileggendo lo stesso file, la riga già coperta è «già importata», non coperta di nuovo',
    prova(() => { const a = b.anteprimaBanca(lettura, [esistente({ bancaChiave: chiave })], 'cc', OGGI); return [a.giaImportati.length, a.coperti.length, a.entrano.length] }), [1, 0, 0])

  console.log('\n12. banca: segnaCoperti, come `banca_segna_coperti`')
  const conto = (id, altro = {}) => mv(id, '2026-10-03', 12000, 'cc', altro)
  const k = (chiave, conId, altro = {}) => ({ chiave, data: '2026-10-03', tipo: 'entrata', importo: 12000, descrizione: 'Da Luca Verdi BONIFICO', conId, conDescrizione: `a mano ${conId}`, ...altro })
  const mov = [conto('r1'), conto('r2', { satispayId: 'P1' }), mv('r3', '2026-10-03', 12000, 'co'), conto('r4', { annullatoIl: '2026-10-05T10:00:00Z' })]
  const sc = prova(() => b.segnaCoperti(mov, [], [k('banca:a:0', 'r1')], 'cc'))
  ok('il movimento a mano prende il segno della banca', prova(() => sc.movimenti.map((m) => m.bancaChiave ?? null)), ['banca:a:0', null, null, null])
  ok('…la riga entra fra i coperti, e niente da scrivere', prova(() => [sc.coperti.map((c) => c.chiave), sc.daScrivere]), [['banca:a:0'], []])
  ok('i movimenti di partenza non cambiano', prova(() => mov[0].bancaChiave ?? null), null)
  const due = prova(() => b.segnaCoperti(mov, [], [k('banca:a:0', 'r1'), k('banca:b:0', 'r1')], 'cc'))
  ok('due righe della banca sullo stesso movimento: la seconda non lo copre, entra nuova', prova(() => [due.coperti.map((c) => c.chiave), due.daScrivere]), [['banca:a:0'], [{ chiave: 'banca:b:0', data: '2026-10-03', cassa: 'conto', tipo: 'entrata', importo: 12000, descrizione: 'Da Luca Verdi BONIFICO', voce: 'Da classificare' }]])
  ok('un movimento già di Satispay, di un\'altra cassa, annullato, che non c\'è, o con un altro importo: entra nuovo',
    prova(() => b.segnaCoperti(mov, [], [k('banca:c:0', 'r2'), k('banca:d:0', 'r3'), k('banca:e:0', 'r4'), k('banca:f:0', 'r9'), k('banca:g:0', 'r1', { importo: 1 })], 'cc').daScrivere.map((x) => x.chiave)),
    ['banca:c:0', 'banca:d:0', 'banca:e:0', 'banca:f:0', 'banca:g:0'])
  ok('rilanciata con le stesse righe: non duplica e non scrive', prova(() => { const x = b.segnaCoperti(sc.movimenti, sc.coperti, [k('banca:a:0', 'r1')], 'cc'); return [x.coperti.length, x.daScrivere.length] }), [1, 0])
  ok('una riga senza la chiave della banca: errore', prova(() => b.segnaCoperti(mov, [], [k('x', 'r1')], 'cc')), 'ERRORE: Un movimento già scritto non ha la chiave della banca')
}

console.log('\n13. un rimborso si dice rimborso: dettoNuovo')
{
  ok('un incasso', prova(() => s.dettoNuovo('TO_BUSINESS', 2)), { scelta: 'Incasso nuovo', conto: '2 incassi nuovi', verso: 'in più' })
  ok('uno solo', prova(() => s.dettoNuovo('TO_BUSINESS', 1).conto), '1 incasso nuovo')
  ok('un rimborso', prova(() => s.dettoNuovo('REFUND_TO_BUSINESS', 1)), { scelta: 'Rimborso nuovo', conto: '1 rimborso nuovo', verso: 'in meno' })
  ok('più rimborsi', prova(() => s.dettoNuovo('REFUND_TO_BUSINESS', 3).conto), '3 rimborsi nuovi')
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
