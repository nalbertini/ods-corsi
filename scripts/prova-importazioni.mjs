// ---------------------------------------------------------------------------
// La sezione IMPORTAZIONI (Satispay e banca), senza browser.
//
//   node scripts/prova-importazioni.mjs
//
// Le regole stanno in `src/lib/satispayScarico.ts` e `src/lib/importaBanca.ts`; il database
// (114-importazioni.sql) dice le stesse cose, e `supabase/prova/importazioni.sql` ha gli stessi
// casi con gli stessi messaggi. Oggi, per la prova, è il 22 ottobre 2026.
//
// Firme che queste prove si aspettano (satispayScarico.ts):
//   scollegaScarico(dati: DatiScarico, satispayId: string): { movimenti, negozio }
//   chiHaPagato(dati: { negozio, movimenti, pagamenti: RigaPagamento[], modulo: PagamentoSatispay[] }, mese: 'AAAA-MM'):
//     Array<{ satispayId, tipo, importo, data, chi, come, detto, movimentoId }>
//   contiChiHaPagato(righe): { totale, pagamenti, rimborsi, riconosciuti, nonRiconosciuti }
//   filtraChiHaPagato(righe, cerca, soloNonRiconosciuti): righe
// (daClassificare.ts):
//   FONTI_DA_CLASSIFICARE: la lista delle fonti, in ordine
//   vistaDaClassificare(righe, fonte, quante): { fonte (vuota se non ha più voci), visibili, restano, prossime }
//   daClassificare(righe: RigaMovimento[]): { righe: Array<RigaMovimento & { fonte: 'Satispay'|'Banca'|'A mano'|'Storico' }>, entrate: { conteggio, importo }, uscite: { conteggio, importo } }
//   filtraDaClassificare(righe, fonte: '' | 'Satispay'|'Banca'|'A mano'|'Storico'): righe
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
const dc = await carica("export * from './src/lib/daClassificare'")

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
const dati = (negozio, movimenti, chiusure = []) => ({ negozio, modulo: [], pagamenti: [], movimenti, casse, chiusure, voci, oggi: OGGI })
const chiusa = (cassaId, data) => ({ id: `k-${cassaId}-${data}`, cassaId, dal: '2026-09-01', data, previsto: 0, contato: 0, differenza: 0, chiusaIl: '2026-10-16T08:00:00Z' })

console.log('1. «Non è questo»: scollegaScarico (resta per i collegamenti già fatti)')
{
  const movimenti = [mv('m1', '2026-10-14', 1250, 'sa', { satispayId: 'P1' }), mv('m2', '2026-10-14', 1250, 'sa')]
  const negozio = [pn('P1', 1250, '2026-10-14T10:00:00Z', { esito: 'a_mano', movimentoId: 'm1' })]
  const d = dati(negozio, movimenti)
  const prima = copia(d)
  const r = prova(() => s.scollegaScarico(d, 'P1'))
  ok('il movimento a mano resta, senza segno', prova(() => r.movimenti.map((m) => [m.id, m.satispayId ?? null, m.annullatoIl ?? null])), [['m1', null, null], ['m2', null, null]])
  ok('il pagamento torna fuori/nel_versamento, senza movimento (non più da decidere)', prova(() => [r.negozio[0].esito, r.negozio[0].motivo, r.negozio[0].movimentoId ?? null]), ['fuori', 'nel_versamento', null])
  ok('i dati di partenza non cambiano', d, prima)
  ok('la cassa di quel giorno è chiusa: il collegamento resta', prova(() => s.scollegaScarico(dati(negozio, movimenti, [chiusa('sa', '2026-10-14')]), 'P1')), 'ERRORE: Quel giorno la cassa è chiusa: il collegamento resta')
  ok('una chiusura di un\'altra cassa non conta', prova(() => s.scollegaScarico(dati(negozio, movimenti, [chiusa('cc', '2026-10-31')]), 'P1').negozio[0].esito), 'fuori')
  ok('un pagamento scritto da noi non si scollega', prova(() => s.scollegaScarico(dati([pn('P1', 1250, '2026-10-14T10:00:00Z', { esito: 'scritto', movimentoId: 'm1' })], movimenti), 'P1')), 'ERRORE: Questo pagamento non è collegato a un movimento a mano')
  ok('un pagamento che non c\'è', prova(() => s.scollegaScarico(d, 'XX')), 'ERRORE: Il pagamento non c’è')
}

console.log('\n4. chi ha pagato in un mese: chiHaPagato, contiChiHaPagato, filtraChiHaPagato')
{
  const movimenti = [mv('ma', '2026-10-14', 1250, 'cc', { satispayId: 'S2', descrizione: 'Bonifico di Mario' })]
  const negozio = [
    pn('S1', 3000, '2026-10-13T08:00:00Z', { esito: 'fuori', motivo: 'nel_versamento', chi: 'Giulia Bianchi' }),
    pn('S2', 1250, '2026-10-14T11:00:00Z', { esito: 'a_mano', movimentoId: 'ma' }),
    pn('S3', 5000, '2026-10-13T10:00:00Z', { esito: 'modulo', chi: 'Anna Verdi' }),
    pn('S4', 2500, '2026-10-13T11:00:00Z', { esito: 'pagamenti', chi: 'Luca Neri' }),
    pn('S5', 800, '2026-10-15T10:00:00Z', { esito: 'fuori', motivo: 'nel_versamento', chi: 'Pia Gallo' }),
    pn('S6', 2500, '2026-10-13T12:00:00Z', { esito: 'fuori', motivo: 'nel_versamento', chi: 'Ugo Riva' }),
    pn('S7', 500, '2026-10-16T12:00:00Z', { tipo: 'REFUND_TO_BUSINESS', esito: 'fuori', motivo: 'nel_versamento', chi: 'Pia' }),
    pn('S8', 2000, '2026-09-20T10:00:00Z', { esito: 'fuori' }), // di settembre
    pn('S10', 1000, '2026-10-17T11:00:00Z', { stato: 'PENDING' }), // non accettato
    pn('S11', 100, '2026-10-31T23:30:00Z'), // le 00:30 del 1 novembre a Roma
  ]
  const pagamenti = [
    { id: 'r1', data: '2026-10-13', importo: 3000, metodo: 'Satispay', voce: 'Quota associativa', chi: 'Bianchi Giulia', ricevuta: { id: 'ric1', anno: 2026, numero: 41 }, annullato: false },
    { id: 'r2', data: '2026-10-13', importo: 2500, metodo: ' satispay ', voce: 'Corsi e altri pagamenti', chi: 'Neri Luca', annullato: false },
    { id: 'r3', data: '2026-10-15', importo: 800, metodo: 'Satispay', voce: 'Corsi e altri pagamenti', chi: 'Gallo Pia', annullato: true }, // annullata: non riconosce
    { id: 'r4', data: '2026-10-15', importo: 800, metodo: 'Contanti', voce: 'Corsi e altri pagamenti', chi: 'Gallo Pia', annullato: false }, // altro metodo
    { id: 'r5', data: '2026-10-13', importo: 5000, metodo: 'Satispay', voce: 'Quota associativa', chi: 'Verdi Anna', ricevuta: { id: 'ricM', anno: 2026, numero: 40 }, annullato: false }, // ricevuta del modulo
  ]
  const modulo = [{ id: 'S3', chi: 'Verdi Anna', importo: 5000, stato: 'pagato', creatoIl: '2026-10-13T09:00:00Z', ricevutaId: 'ricM' }]
  const d = { negozio, movimenti, pagamenti, modulo }
  const r = prova(() => s.chiHaPagato(d, '2026-10'))
  ok('una riga per ogni ACCEPTED del mese, in ordine di quando', prova(() => r.map((x) => x.satispayId)), ['S1', 'S3', 'S4', 'S6', 'S2', 'S5', 'S7'])
  ok('come è riconosciuto', prova(() => r.map((x) => x.come)), ['ricevuta', 'modulo', 'pagamenti', 'non_riconosciuto', 'a_mano', 'non_riconosciuto', 'rimborso'])
  ok('con le parole della palestra', prova(() => r.map((x) => x.detto)), [
    'In una ricevuta · 41/2026, Bianchi Giulia',
    'Dal modulo · iscrizione di Verdi Anna',
    'Nei pagamenti · Neri Luca, corsi e altri pagamenti',
    'Non riconosciuto',
    'Collegato a mano · Bonifico di Mario',
    'Non riconosciuto',
    'Rimborso · esce dal versamento, non dai conti',
  ])
  ok('una riga di PAGAMENTI riconosce un pagamento solo: il secondo da 25 € dello stesso giorno resta non riconosciuto', prova(() => r[3].come), 'non_riconosciuto')
  ok('il collegato a mano porta il movimento, gli altri no', prova(() => r.map((x) => x.movimentoId)), [null, null, null, null, 'ma', null, null])
  ok('la riga dice tipo, importo, giorno e chi', prova(() => [r[6].tipo, r[6].importo, r[6].data, r[6].chi]), ['REFUND_TO_BUSINESS', 500, '2026-10-16', 'Pia'])
  ok('il giorno è quello di Roma: le 00:30 del 1 novembre sono di novembre', prova(() => s.chiHaPagato(d, '2026-11').map((x) => x.satispayId)), ['S11'])
  ok('esito «pagamenti» senza riga che lo copra: resta nei pagamenti', prova(() => s.chiHaPagato({ ...d, pagamenti: [] }, '2026-10')[2].detto), 'Nei pagamenti')
  ok('i conti: totale coi rimborsi in meno, riconosciuti su pagamenti', prova(() => s.contiChiHaPagato(r)), { totale: 3000 + 5000 + 2500 + 2500 + 1250 + 800 - 500, pagamenti: 6, rimborsi: 1, riconosciuti: 4, nonRiconosciuti: 2 })
  ok('un mese senza pagamenti: tutto a zero', prova(() => s.contiChiHaPagato(s.chiHaPagato(d, '2026-08'))), { totale: 0, pagamenti: 0, rimborsi: 0, riconosciuti: 0, nonRiconosciuti: 0 })
  const f = (cerca, solo = false) => prova(() => s.filtraChiHaPagato(r, cerca, solo).map((x) => x.satispayId))
  ok('senza ricerca: tutti', f(''), ['S1', 'S3', 'S4', 'S6', 'S2', 'S5', 'S7'])
  ok('per nome, in chi ha pagato o in chi l\'ha riconosciuto, senza maiuscole', f('bianchi'), ['S1'])
  ok('tutte le parole devono esserci', f('giulia 41'), ['S1'])
  ok('per importo in euro: «25» e «25,00»', [f('25'), f('25,00')], [['S4', 'S6'], ['S4', 'S6']])
  ok('per importo coi centesimi', f('12,50'), ['S2'])
  ok('solo i non riconosciuti', f('', true), ['S6', 'S5'])
  ok('solo i non riconosciuti, e per nome', f('pia', true), ['S5'])
}

console.log('\n5. banca: i movimenti coperti si salvano per rivederli')
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

  console.log('\n6. banca: «Non è questo»')
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

console.log('\n7. banca: cosa è entrato in un mese, entratoBanca')
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

console.log('\n8. un movimento a mano è di Satispay o della banca, mai di tutti e due')
{
  // m1 è già coperto da un movimento della banca (il segno `bancaChiave`), m2 è libero.
  const coperto = mv('m1', '2026-10-14', 1250, 'cc', { bancaChiave: 'banca:20261014:abc:0' })
  const libero = mv('m2', '2026-10-14', 1250, 'cc')
  const r = prova(() => s.applicaScarico(dati([pn('P1', 1250, '2026-10-14T10:00:00Z')], [coperto]), true))
  ok('lo scarico non collega né scrive: fuori/nel_versamento, il movimento coperto resta com\'è', prova(() => [r.negozio[0].esito, r.negozio[0].motivo, r.movimenti.length, r.movimenti[0].satispayId ?? null]), ['fuori', 'nel_versamento', 1, null])
  ok('«Non è questo» su un movimento del Conto Corrente: il movimento perde il segno, il pagamento torna fuori',
    prova(() => { const x = s.scollegaScarico(dati([pn('P1', 1250, '2026-10-14T10:00:00Z', { esito: 'a_mano', movimentoId: 'm2' })], [coperto, { ...libero, satispayId: 'P1' }]), 'P1'); return [x.movimenti.map((m) => m.satispayId ?? null), x.negozio[0].esito] }), [[null, null], 'fuori'])

  const lettura = prova(() => b.leggiBanca(file(riga('03/10/2026', '', '120,00', 'Da Luca Verdi saldo corso'))))
  const chiave = prova(() => lettura.movimenti[0].chiave)
  ok('un movimento a mano già di Satispay non copre un movimento della banca: entra nuovo',
    prova(() => { const a = b.anteprimaBanca(lettura, [esistente({ satispayId: 'P1' })], 'cc', OGGI); return [a.coperti.length, a.entrano.length] }), [0, 1])
  ok('un movimento a mano già coperto da un\'altra riga della banca non ne copre una seconda',
    prova(() => { const a = b.anteprimaBanca(lettura, [esistente({ bancaChiave: 'banca:altra' })], 'cc', OGGI); return [a.coperti.length, a.entrano.length] }), [0, 1])
  ok('rileggendo lo stesso file, la riga già coperta è «già importata», non coperta di nuovo',
    prova(() => { const a = b.anteprimaBanca(lettura, [esistente({ bancaChiave: chiave })], 'cc', OGGI); return [a.giaImportati.length, a.coperti.length, a.entrano.length] }), [1, 0, 0])

  console.log('\n9. banca: segnaCoperti, come `banca_segna_coperti`')
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

console.log('\n10. DA CLASSIFICARE: le voci già in contabilità ma senza una voce vera, di qualunque fonte')
{
  const r = (id, data, tipo, importo, altro = {}) => ({ id, origine: 'movimento', tipo, data, importo, descrizione: `voce ${id}`, voce: 'Da classificare', cassaId: 'cc', annullato: false, ...altro })
  const righe = [
    r('b1', '2026-10-15', 'entrata', 12000, { origineImport: 'banca:a:0' }),
    r('s2', '2026-10-22', 'entrata', 4000, { satispayId: 'P2', cassaId: 'sa' }),
    r('s1', '2026-10-22', 'entrata', 4000, { satispayId: 'P1', cassaId: 'sa' }),
    r('u1', '2026-10-21', 'uscita', 800, { satispayId: 'P3', cassaId: 'sa' }),
    r('c1', '2026-10-15', 'uscita', 420, { origineImport: 'banca:a:1' }),
    r('m1', '2026-10-12', 'uscita', 3500),
    r('p1', '2019-03-01', 'entrata', 5000, { origineImport: 'prima-nota:7' }),
    // fuori: voce vera, annullata, giroconto, incasso iscritto
    r('x1', '2026-10-10', 'entrata', 1000, { voce: 'Corsi e altri pagamenti' }),
    r('x2', '2026-10-10', 'entrata', 1000, { annullato: true }),
    r('x3', '2026-10-10', 'giroconto', 1000, { voce: null }),
    r('x4', '2026-10-10', 'entrata', 1000, { origine: 'ricevuta' }),
  ]
  const prima = copia(righe)
  const x = prova(() => dc.daClassificare(righe))
  ok('entrano le voci su «Da classificare» non annullate, non giroconti, non incassi iscritti; le più vecchie in alto, a pari data per id', prova(() => x.righe.map((y) => y.id)), ['p1', 'm1', 'b1', 'c1', 'u1', 's1', 's2'])
  ok('la fonte: Satispay, Banca, A mano, Storico (prima nota)', prova(() => x.righe.map((y) => y.fonte)), ['Storico', 'A mano', 'Banca', 'Banca', 'Satispay', 'Satispay', 'Satispay'])
  ok('il totale: entrate e uscite, con il conteggio', prova(() => [x.entrate, x.uscite]), [{ conteggio: 4, importo: 25000 }, { conteggio: 3, importo: 4720 }])
  ok('le righe di partenza non cambiano', righe, prima)
  ok('niente da classificare: lista vuota e totali a zero', prova(() => dc.daClassificare([righe[7]])), { righe: [], entrate: { conteggio: 0, importo: 0 }, uscite: { conteggio: 0, importo: 0 } })
  ok('il filtro Satispay', prova(() => dc.filtraDaClassificare(x.righe, 'Satispay').map((y) => y.id)), ['u1', 's1', 's2'])
  ok('il filtro Banca', prova(() => dc.filtraDaClassificare(x.righe, 'Banca').map((y) => y.id)), ['b1', 'c1'])
  ok('senza filtro: tutte', prova(() => dc.filtraDaClassificare(x.righe, '').length), 7)
  // La vista a pagine: quante righe si vedono, quante restano, quante ne porta «Mostra altre».
  const v = (fonte, quante) => prova(() => { const p = dc.vistaDaClassificare(x.righe, fonte, quante); return [p.fonte, p.visibili.map((y) => y.id), p.restano, p.prossime] })
  ok('la vista: le prime 3 di 7, ne restano 4 e «Mostra altre» ne porta 3', v('', 3), ['', ['p1', 'm1', 'b1'], 4, 3])
  ok('la vista: l’ultima pagina porta solo quelle che restano', v('', 5), ['', ['p1', 'm1', 'b1', 'c1', 'u1'], 2, 2])
  ok('la vista: tutte visibili, niente «Mostra altre»', v('', 20), ['', ['p1', 'm1', 'b1', 'c1', 'u1', 's1', 's2'], 0, 0])
  ok('la vista col filtro conta solo la fonte', v('Satispay', 2), ['Satispay', ['u1', 's1'], 1, 1])
  ok('la vista: una fonte senza più voci torna su «Tutte»', prova(() => dc.vistaDaClassificare(dc.filtraDaClassificare(x.righe, 'Satispay'), 'Banca', 20).fonte), '')
  ok('le fonti da mostrare, nell’ordine dei chip', prova(() => dc.FONTI_DA_CLASSIFICARE), ['Satispay', 'Banca', 'A mano', 'Storico'])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
