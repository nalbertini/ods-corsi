// ---------------------------------------------------------------------------
// La quadratura mensile del Conto Corrente col saldo dell'estratto BancoPosta, senza browser.
//
//   node scripts/prova-quadratura.mjs
//
// Controlla `src/lib/quadraturaBanca.ts` (da scrivere) e `GIORNI_DI_DIFFERENZA` di `importaBanca.ts` (da esportare).
// Gli stessi rifiuti del database (iniziale + entrate − uscite = finale, un mese unico) sono in
// `supabase/prova/quadratura-banca.sql`: tabella `saldo_banca` di `supabase/123-quadratura-banca.sql`.
//
// LE FIRME (le fissa questa prova: il codice le segue). Tutto puro, importi in centesimi, mesi `AAAA-MM`,
// giorni `AAAA-MM-GG`; nessuna funzione cambia i dati che riceve.
//
//   SaldoBanca  { mese, saldoIniziale, entrate, uscite, saldoFinale,
//                 verificatoIl?: string|null, verificatoDa?: string|null, improntaVerifica?: string|null }
//   RigaBanca   { chiave, data, tipo: 'entrata'|'uscita', importo, descrizione }   (ci sta anche un MovimentoBanca:
//               il risultato ne copia solo questi cinque campi, mai `codiceFiscaleLetto`)
//
//   saldoAppDelMese(casse, righe, contoId, mese) → { saldoIniziale, entrate, uscite, saldoFinale }
//       Il Conto Corrente come lo vede l'app (come `estrattoConto`: annullate escluse, giroconti compresi,
//       il saldo iniziale è quello della cassa più tutto quel che viene prima del mese).
//   cosaNonVaSaldoBanca(saldo, oggi) → string | null
//       null se si può scrivere. Messaggio per chi usa l'app (dice cosa fare) se: il mese non è AAAA-MM, il mese è
//       futuro (il mese in corso va bene), entrate o uscite negative, i quattro numeri non tornano al centesimo
//       (il messaggio mostra i conti: iniziale + entrate − uscite e il finale scritto, in euro).
//   saldoInizialeProposto(saldi, mese) → number | null     il saldoFinale del mese prima, se c'è
//   improntaMese(righe, contoId, mese) → string
//       Stabile: non dipende dall'ordine; conta le righe non annullate del Conto Corrente del mese (data, tipo,
//       importo, voce, descrizione, cassa/giroconto): cambia se se ne tocca una, non per una annullata né per
//       le righe di altri mesi o altre casse.
//   quadratura({ mese, oggi, contoId, casse, righe, banca, saldo, saldoPrima }) → Quadratura
//       banca: tutte le RigaBanca che si hanno (anche di altri mesi: servono ai 2 giorni a cavallo di mese);
//         per «Cosa è entrato» sono le righe `banca:` importate (anche se poi annullate) e i coperti.
//       saldo / saldoPrima: SaldoBanca del mese e del mese prima, o null.
//     Quadratura {
//       mese,
//       stato: 'non ancora finito' | 'saldo da scrivere' | 'CSV del mese mancante'
//            | 'verificato' | 'cambiato dopo la verifica' | 'non torna' | 'da classificare' | 'torna'
//         in questo ordine di precedenza. «CSV del mese mancante» = il saldo c'è ma nessuna riga della banca
//         nel mese (anche prima della prima importazione: chi scrive il saldo vuole il confronto);
//         «verificato» solo se `saldo.verificatoIl` c'è, l'impronta salvata è quella di adesso e la differenza
//         è 0 (un mese prima cambiato sposta il saldo iniziale) e il saldo iniziale dell'estratto è ancora il
//         finale del mese prima (`saldoPrima`, se c'è); se no «cambiato dopo la verifica».
//       app: saldoAppDelMese(...),
//       differenza: number | null      CONVENZIONE: app − banca, sui saldi finali (app.saldoFinale − saldo.saldoFinale);
//                                      positiva = nell'app c'è più di quanto dice la banca. null senza saldo.
//       nonSpiegato: number | null     (differenza − differenzaIniziale) − (Σ firmato delle righe solo-app − Σ firmato
//                                      delle righe solo-banca), firmato = entrata +, uscita −. differenzaIniziale =
//                                      app.saldoIniziale − saldo.saldoIniziale (0 se i mesi prima tornavano):
//                                      così una riga a cavallo di mese non conta due volte. Righe «solo» = senza
//                                      coppia, o con la coppia in un altro mese.
//       soloApp: { riga: {id,data,tipo,importo,descrizione,voce}, causa: string|null }[] | null   (null = non si calcola)
//       soloBanca: { riga: RigaBanca, causa: string|null }[] | null
//       dataDiversa: { app, banca }[] | null    le coppie con la data diversa (1 o 2 giorni)
//       abbinate: { app, banca }[] | null       tutte le coppie (anche dataDiversa) di cui una riga è nel mese
//       daClassificare: number          righe vive del Conto Corrente del mese con voce «Da classificare»
//       avvisi: { tipo: 'discontinuita' | 'csv-incompleto', testo: string }[]
//     }
//     L'abbinamento: prima per chiave (la riga dell'app con `origineImport` o `bancaChiave` uguale alla chiave della
//     banca), poi per la regola dell'importazione (stesso tipo, stesso importo, al più GIORNI_DI_DIFFERENZA giorni),
//     prima il giorno stesso, poi il più vicino; uno a uno. Un giroconto verso il conto conta come entrata, da
//     conto come uscita. Le cause: solo-app con `satispayId` → «forse un doppione Satispay»; solo-banca entrata con
//     «versament» e «contant» → «forse un giroconto»; uscita con «commission» o «spese» → «commissione di Poste».
//   cosaNonVaVerifica(quadratura) → string | null     null solo con differenza 0 e nessuna riga «Da classificare»,
//       senza l'avviso 'discontinuita' e con uno stato fra 'torna' e 'cambiato dopo la verifica'.
//   mancaSaldoBanca(errore) → boolean, SENZA_SALDO_BANCA: string    come `mancaChiusure` / `SENZA_CHIUSURE`.
//
// E per la modalità prova (`creaSegreteriaProva`, interfaccia `Segreteria`), gli stessi rifiuti del database:
//   saldiBanca(): Promise<SaldoBanca[]> · scriviSaldoBanca(saldo): Promise<void> (rifiuta con cosaNonVaSaldoBanca;
//   riscrivere un mese lo sostituisce e toglie la verifica, anche al mese dopo se non parte più dal suo saldo
//   finale) · verificaMeseBanca(mese, impronta): Promise<void>
//   (rifiuta un mese senza saldo).
//   verificaMeseBanca(quadratura, impronta) rifiuta anche quel che rifiuta cosaNonVaVerifica.
//   leggiSaldoBanca({ iniziale, finale, entrate, uscite }, mese, oggi) → { saldo, errore, campi }
//       I quattro numeri scritti nel modulo: `saldo` solo se si può salvare; `errore` il messaggio per chi scrive
//       (null finché manca un campo e niente è scritto male); `campi` quelli da segnare rossi (nessuno se non si
//       sa quale dei quattro è sbagliato).
// Le righe, i nomi e i codici sono tutti inventati: il repository è pubblico.
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
const q = await carica("export * from './src/lib/quadraturaBanca'")
const ib = await carica("export { GIORNI_DI_DIFFERENZA } from './src/lib/importaBanca'")

let guai = 0
const ok = (cosa, avuto, voluto) => {
  // Una funzione che non c'è dà «ERRORE: …»: non conta mai come risposta giusta, nemmeno dove si aspetta un testo.
  const va = JSON.stringify(avuto) === JSON.stringify(voluto) && !JSON.stringify(avuto)?.includes('ERRORE: ')
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
// Una funzione che non c'è ancora dà un errore che lo dice: la prova non si ferma.
const chiama = (nome, ...args) =>
  prova(() => {
    if (typeof q[nome] !== 'function') throw new Error(`${nome} non esiste in quadraturaBanca.ts`)
    return q[nome](...args)
  })
// Se `quadratura` non c'è (o lancia), i campi mancano e `stato` dice perché: le prove sotto restano rosse col motivo in vista.
// Un rifiuto è un messaggio vero: «string» solo se non è un errore della prova.
const msg = (x) => (typeof x === 'string' && !x.startsWith('ERRORE: ') ? 'string' : x)
const quadra = (o) => {
  const r = chiama('quadratura', o)
  return typeof r === 'string' ? { stato: r } : r
}
const congela = (x) => {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x)
    Object.values(x).forEach(congela)
  }
  return x
}

// --- i dati -----------------------------------------------------------------
const conto = { id: 'conto', nome: 'Conto Corrente', saldoIniziale: 10000 }
const contoZero = { id: 'conto', nome: 'Conto Corrente', saldoIniziale: 0 }
const contanti = { id: 'cassa', nome: 'Cassa Contanti', saldoIniziale: 50000 }
const mv = (id, tipo, data, importo, extra = {}) => ({ id, origine: 'movimento', tipo, data, importo, descrizione: `Movimento ${id}`, voce: 'Corsi e altri pagamenti', cassaId: 'conto', annullato: false, ...extra })
const bn = (chiave, tipo, data, importo, descrizione = 'Bonifico') => ({ riga: 1, data, tipo, importo, descrizione, causale: '', chiave: `banca:${chiave}`, codiceFiscaleLetto: [] })
const sb = (mese, saldoIniziale, entrate, uscite, saldoFinale, extra = {}) => ({ mese, saldoIniziale, entrate, uscite, saldoFinale, ...extra })
const base = (o = {}) => ({ mese: '2026-10', oggi: '2026-11-15', contoId: 'conto', casse: [conto], righe: [], banca: [], saldo: null, saldoPrima: null, ...o })
const ottobre = [mv('e1', 'entrata', '2026-10-05', 5000), mv('u1', 'uscita', '2026-10-10', 2000)]
const bancaOttobre = [bn('1', 'entrata', '2026-10-05', 5000), bn('2', 'uscita', '2026-10-10', 2000)]

console.log('0. la regola dell’importazione, da esportare')
ok('GIORNI_DI_DIFFERENZA è esportata e vale 2', ib.GIORNI_DI_DIFFERENZA, 2)

console.log('1. R1 · il saldo del Conto Corrente nell’app')
ok(
  'iniziale 100,00 + entrata 50,00 − uscita 20,00 = 130,00; l’uscita annullata non conta',
  chiama('saldoAppDelMese', [conto], [...ottobre, mv('u2', 'uscita', '2026-10-12', 999, { annullato: true })], 'conto', '2026-10'),
  { saldoIniziale: 10000, entrate: 5000, uscite: 2000, saldoFinale: 13000 },
)
ok(
  'quel che viene prima del mese entra nel saldo iniziale, quel che viene dopo non conta',
  chiama('saldoAppDelMese', [conto], [...ottobre, mv('s1', 'entrata', '2026-09-20', 300), mv('n1', 'entrata', '2026-11-02', 700)], 'conto', '2026-10'),
  { saldoIniziale: 10300, entrate: 5000, uscite: 2000, saldoFinale: 13300 },
)
ok(
  'le altre casse non contano; un giroconto dai contanti al conto è un’entrata del conto',
  chiama('saldoAppDelMese', [conto, contanti], [...ottobre, mv('c1', 'entrata', '2026-10-06', 9999, { cassaId: 'cassa' }), mv('g1', 'giroconto', '2026-10-07', 20000, { cassaId: 'cassa', cassaAId: 'conto', voce: null })], 'conto', '2026-10'),
  { saldoIniziale: 10000, entrate: 25000, uscite: 2000, saldoFinale: 33000 },
)

console.log('2. R2 · lo stato e la differenza (app − banca)')
{
  const senza = quadra(base({ righe: ottobre, banca: bancaOttobre }))
  ok('mese senza saldo della banca: «saldo da scrivere», nessuna differenza', [senza.stato, senza.differenza, senza.nonSpiegato], ['saldo da scrivere', null, null])
  const torna = quadra(base({ righe: ottobre, banca: bancaOttobre, saldo: sb('2026-10', 10000, 5000, 2000, 13000) }))
  ok('banca 130,00 e app 130,00: differenza 0, «torna»', [torna.stato, torna.differenza, torna.nonSpiegato], ['torna', 0, 0])
  ok('…con le due coppie e niente di spaiato', [torna.abbinate?.length, torna.soloApp, torna.soloBanca, torna.daClassificare, torna.avvisi], [2, [], [], 0, []])
  ok('…e l’app dice il suo saldo', torna.app, { saldoIniziale: 10000, entrate: 5000, uscite: 2000, saldoFinale: 13000 })
  const cinque = quadra(base({ righe: ottobre, banca: [bn('1', 'entrata', '2026-10-05', 4500), bn('2', 'uscita', '2026-10-10', 2000)], saldo: sb('2026-10', 10000, 4500, 2000, 12500) }))
  ok('banca 125,00 e app 130,00: differenza +5,00 (app − banca), «non torna»', [cinque.stato, cinque.differenza], ['non torna', 500])
  ok('…spiegata da una riga solo nell’app (50,00) e una solo in banca (45,00): non spiegato 0', [cinque.soloApp?.map((x) => x.riga.importo), cinque.soloBanca?.map((x) => x.riga.importo), cinque.nonSpiegato], [[5000], [4500], 0])
  const meno = quadra(base({ righe: ottobre, banca: bancaOttobre, saldo: sb('2026-10', 10000, 5000, 2000, 13500) }))
  ok('banca 135,00 e app 130,00: differenza −5,00', meno.differenza, -500)
}

console.log('3. R3a · i quattro numeri devono tornare fra loro')
{
  const giusto = chiama('cosaNonVaSaldoBanca', sb('2026-10', 10000, 5000, 2000, 13000), '2026-11-15')
  ok('iniziale + entrate − uscite = finale: si può scrivere', giusto, null)
  const storto = chiama('cosaNonVaSaldoBanca', sb('2026-10', 10000, 5000, 2000, 12500), '2026-11-15')
  ok('finale 125,00 invece di 130,00: rifiutato, dice di ricontrollare l’estratto', [msg(storto), /ricontrolla/i.test(storto)], ['string', true])
  ok('…e mostra i conti: 130,00 (calcolato) e 125,00 (scritto)', [/130,00/.test(storto), /125,00/.test(storto)], [true, true])
  ok('un centesimo di scarto è già rifiutato', msg(chiama('cosaNonVaSaldoBanca', sb('2026-10', 10000, 5000, 2000, 13001), '2026-11-15')), 'string')
  ok('un saldo sotto zero che torna si scrive', chiama('cosaNonVaSaldoBanca', sb('2026-10', -3000, 1000, 0, -2000), '2026-11-15'), null)
  ok('un mese scritto male è rifiutato', msg(chiama('cosaNonVaSaldoBanca', sb('ottobre', 0, 0, 0, 0), '2026-11-15')), 'string')
  ok('entrate negative sono rifiutate', msg(chiama('cosaNonVaSaldoBanca', sb('2026-10', 0, -500, -1000, 500), '2026-11-15')), 'string')
}

console.log('4. R3b · il saldo iniziale segue il finale del mese prima')
{
  const ott = sb('2026-10', 10000, 5000, 2000, 13000)
  ok('proposto per novembre: il finale di ottobre', chiama('saldoInizialeProposto', [ott], '2026-11'), 13000)
  ok('…anche a cavallo d’anno', chiama('saldoInizialeProposto', [sb('2026-12', 0, 100, 0, 100)], '2027-01'), 100)
  ok('senza il mese prima non si propone niente', chiama('saldoInizialeProposto', [ott], '2026-12'), null)
  ok('nessun saldo scritto: niente', chiama('saldoInizialeProposto', [], '2026-11'), null)
  const nov = (iniziale, saldoPrima = ott) =>
    quadra(base({ mese: '2026-11', oggi: '2026-12-15', righe: [mv('n1', 'entrata', '2026-11-04', 1000)], banca: [bn('1', 'entrata', '2026-10-05', 5000), bn('n', 'entrata', '2026-11-04', 1000)], saldo: sb('2026-11', iniziale, 1000, 0, iniziale + 1000), saldoPrima }))
  ok('novembre parte da 129,00 e ottobre è finito a 130,00: avviso di discontinuità', nov(12900).avvisi?.map((a) => a.tipo), ['discontinuita'])
  ok('novembre parte da 130,00: nessun avviso', nov(13000).avvisi?.map((a) => a.tipo), [])
  ok('senza il mese prima non c’è niente da confrontare', nov(12900, null).avvisi?.map((a) => a.tipo), [])
}

console.log('5. R4 · la differenza spiegata dalle righe spaiate')
{
  const r = quadra(base({ righe: [mv('a1', 'entrata', '2026-10-05', 1000)], banca: [bn('b1', 'entrata', '2026-10-20', 400)], saldo: sb('2026-10', 10000, 400, 0, 10400) }))
  ok('10,00 solo nell’app e 4,00 solo in banca: differenza 6,00', r.differenza, 600)
  ok('…spiegata da quelle due righe: non spiegato 0', [r.soloApp?.map((x) => x.riga.id), r.soloBanca?.map((x) => x.riga.chiave), r.nonSpiegato], [['a1'], ['banca:b1'], 0])
  const resto = quadra(base({ righe: [mv('a1', 'entrata', '2026-10-05', 1000)], banca: [bn('b1', 'entrata', '2026-10-20', 400)], saldo: sb('2026-10', 10000, 450, 0, 10450) }))
  ok('se la banca dice 0,50 in più di quel che il CSV mostra, restano −0,50 non spiegati', [resto.differenza, resto.nonSpiegato], [550, -50])
  ok('…e il CSV non coincide con l’estratto: avviso «CSV incompleto»', resto.avvisi?.map((a) => a.tipo), ['csv-incompleto'])
  ok('col CSV che coincide non c’è avviso', r.avvisi?.map((a) => a.tipo), [])
  const csv = quadra(base({ righe: ottobre, banca: bancaOttobre, saldo: sb('2026-10', 10000, 5000, 2500, 12500) }))
  ok('anche le uscite del CSV si confrontano con l’estratto', csv.avvisi?.map((a) => a.tipo), ['csv-incompleto'])
}

console.log('6. R5 e R6 · senza CSV non si dice «torna»')
{
  const nov = quadra(base({ mese: '2026-11', oggi: '2026-12-15', righe: [], banca: bancaOttobre, saldo: sb('2026-11', 13000, 0, 0, 13000), saldoPrima: sb('2026-10', 10000, 5000, 2000, 13000) }))
  ok('mese dopo la prima importazione ma senza CSV: «CSV del mese mancante»', nov.stato, 'CSV del mese mancante')
  ok('…le liste «non in banca» non si calcolano', [nov.stato, nov.soloApp, nov.soloBanca, nov.dataDiversa, nov.abbinate], ['CSV del mese mancante', null, null, null, null])
  const set = quadra(base({ mese: '2026-09', righe: [], casse: [{ ...conto, saldoIniziale: 13000 }], banca: bancaOttobre, saldo: sb('2026-09', 13000, 0, 0, 13000) }))
  ok('mese prima della prima importazione, col saldo scritto: «CSV del mese mancante», anche con differenza 0', [set.stato, set.differenza], ['CSV del mese mancante', 0])
  const nessuna = quadra(base({ righe: ottobre, banca: [], saldo: sb('2026-10', 10000, 5000, 2000, 13000) }))
  ok('mai importato niente, col saldo scritto: «CSV del mese mancante», non «torna»', nessuna.stato, 'CSV del mese mancante')
}

console.log('7. R6 · un incasso Satispay e il suo doppione')
{
  const satispay = [
    mv('a', 'entrata', '2026-10-05', 5000, { satispayId: 's1', bancaChiave: 'banca:sp1' }),
    mv('b', 'entrata', '2026-10-05', 5000, { satispayId: 's2' }),
  ]
  const r = quadra(base({ righe: satispay, banca: [bn('sp1', 'entrata', '2026-10-06', 5000, 'SATISPAY EUROPE SA')], saldo: sb('2026-10', 10000, 5000, 0, 15000) }))
  ok('quello coperto dalla banca (bancaChiave) è abbinato a lei, per chiave', r.abbinate?.map((x) => [x.app.id, x.banca.chiave]), [['a', 'banca:sp1']])
  ok('il doppione senza segno della banca è «nell’app, non in banca», forse un doppione Satispay', r.soloApp?.map((x) => [x.riga.id, x.causa]), [['b', 'forse un doppione Satispay']])
  ok('…la differenza 50,00 è tutta spiegata', [r.differenza, r.nonSpiegato], [5000, 0])
}

console.log('8. R7 e R8 · la stessa riga a cavallo di mese: 2 giorni di scarto')
{
  const agosto = (dataApp) => {
    const dati = { casse: [contoZero], righe: [mv('a', 'entrata', dataApp, 1500), mv('p', 'uscita', '2026-09-10', 300)], banca: [bn('x', 'entrata', '2026-08-31', 1500), bn('p', 'uscita', '2026-09-10', 300)] }
    return {
      ago: quadra(base({ ...dati, mese: '2026-08', saldo: sb('2026-08', 0, 1500, 0, 1500) })),
      set: quadra(base({ ...dati, mese: '2026-09', saldo: sb('2026-09', 1500, 0, 300, 1200), saldoPrima: sb('2026-08', 0, 1500, 0, 1500) })),
    }
  }
  const uno = agosto('2026-09-01')
  ok('banca 15,00 il 31/08 e app 15,00 il 01/09: nella lista «con la data diversa» di agosto', [uno.ago.dataDiversa?.length, uno.ago.dataDiversa?.[0]?.app.id, uno.ago.dataDiversa?.[0]?.banca.chiave], [1, 'a', 'banca:x'])
  ok('…e di settembre', uno.set.dataDiversa?.length, 1)
  ok('…non manca in nessuno dei due mesi', [uno.ago.soloApp, uno.ago.soloBanca, uno.set.soloApp, uno.set.soloBanca], [[], [], [], []])
  ok('…agosto: differenza −15,00 tutta spiegata dalla riga a cavallo', [uno.ago.differenza, uno.ago.nonSpiegato], [-1500, 0])
  ok('…settembre: torna, e la riga a cavallo non conta due volte', [uno.set.differenza, uno.set.nonSpiegato, uno.set.stato], [0, 0, 'torna'])
  const tre = agosto('2026-09-03')
  ok('con 3 giorni di scarto non è la stessa riga: manca in banca a settembre', [tre.set.soloApp?.map((x) => x.riga.id), tre.set.dataDiversa], [['a'], []])
  ok('…e manca nell’app ad agosto', tre.ago.soloBanca?.map((x) => x.riga.chiave), ['banca:x'])
}

console.log('9. le righe uguali si abbinano una a una')
{
  const due = (n, m) => quadra(base({ righe: Array.from({ length: n }, (_, i) => mv(`u${i}`, 'uscita', '2026-10-10', 2000)), banca: Array.from({ length: m }, (_, i) => bn(`b${i}`, 'uscita', '2026-10-10', 2000)), saldo: sb('2026-10', 10000, 0, 2000 * m, 10000 - 2000 * m) }))
  const pari = due(2, 2)
  ok('due bonifici uguali lo stesso giorno, in banca e nell’app: 2 coppie, nessuno mancante', [pari.abbinate?.length, pari.soloApp, pari.soloBanca, pari.differenza], [2, [], [], 0])
  ok('…ognuno con la sua: nessuna riga dell’app in due coppie', new Set(pari.abbinate?.map((x) => x.app.id)).size, 2)
  const dispari = due(1, 2)
  ok('2 in banca e 1 nell’app: 1 coppia e 1 «in banca, non nell’app»', [dispari.abbinate?.length, dispari.soloApp, dispari.soloBanca?.length, dispari.nonSpiegato], [1, [], 1, 0])
  const preferisce = quadra(base({ righe: [mv('lontano', 'uscita', '2026-10-12', 2000), mv('giusto', 'uscita', '2026-10-10', 2000)], banca: [bn('b', 'uscita', '2026-10-10', 2000)], saldo: sb('2026-10', 10000, 0, 2000, 8000) }))
  ok('fra due candidate, quella dello stesso giorno', preferisce.abbinate?.map((x) => x.app.id), ['giusto'])
}

console.log('10. R9 · il calcolo non cambia i dati')
{
  const dati = base({ righe: [...ottobre, mv('x', 'entrata', '2026-10-20', 700)], banca: [...bancaOttobre, bn('y', 'entrata', '2026-10-21', 700)], saldo: sb('2026-10', 10000, 5700, 2000, 13700), saldoPrima: sb('2026-09', 0, 0, 0, 9000) })
  const prima = JSON.stringify(dati)
  const r = quadra(congela(dati))
  ok('con dati congelati il calcolo non lancia', typeof r.differenza, 'number')
  ok('…e i dati sono quelli di prima', JSON.stringify(dati), prima)
  const rs = [...ottobre]
  const copia = JSON.stringify(rs)
  const lanci = [chiama('improntaMese', congela(rs), 'conto', '2026-10'), chiama('saldoAppDelMese', congela([conto]), rs, 'conto', '2026-10')]
  ok('anche impronta e saldo lavorano su righe congelate senza lanciare', [msg(lanci[0]), typeof lanci[1]?.saldoFinale], ['string', 'number'])
  ok('…e le righe restano come sono', JSON.stringify(rs), copia)
}

console.log('11. R10 · le righe «Da classificare»')
{
  const importate = [1, 2, 3].map((n) => mv(`i${n}`, 'entrata', `2026-10-0${n}`, 1000, { voce: 'Da classificare', origineImport: `banca:i${n}` }))
  const r = quadra(base({ righe: [...importate, mv('an', 'entrata', '2026-10-09', 1000, { voce: 'Da classificare', origineImport: 'banca:an', annullato: true }), mv('o', 'entrata', '2026-10-09', 100, { cassaId: 'cassa', voce: 'Da classificare' })], casse: [conto, contanti], banca: [1, 2, 3].map((n) => bn(`i${n}`, 'entrata', `2026-10-0${n}`, 1000)), saldo: sb('2026-10', 10000, 3000, 0, 13000) }))
  ok('3 righe «Da classificare» del conto: contate (non l’annullata, non l’altra cassa)', r.daClassificare, 3)
  ok('…la differenza è 0 ma il mese non è «torna»: «da classificare»', [r.differenza, r.stato], [0, 'da classificare'])
  ok('…le righe importate si abbinano per chiave', r.abbinate?.length, 3)
  ok('…e non si può segnare verificato', msg(chiama('cosaNonVaVerifica', r)), 'string')
}

console.log('12. R11 · cause probabili delle righe solo in banca')
{
  const dal = (banca) => quadra(base({ casse: [conto, contanti], righe: [], banca, saldo: sb('2026-10', 10000, 0, 0, 10000) }))
  ok('versamento contanti in banca, senza giroconto nell’app: «forse un giroconto», non un incasso mancante', dal([bn('v', 'entrata', '2026-10-08', 20000, 'VERSAMENTO CONTANTI SPORTELLO')]).soloBanca?.map((x) => x.causa), ['forse un giroconto'])
  const con = quadra(base({ casse: [conto, contanti], righe: [mv('g', 'giroconto', '2026-10-08', 20000, { cassaId: 'cassa', cassaAId: 'conto', voce: null })], banca: [bn('v', 'entrata', '2026-10-08', 20000, 'VERSAMENTO CONTANTI SPORTELLO')], saldo: sb('2026-10', 10000, 20000, 0, 30000) }))
  ok('col giroconto nell’app la riga è abbinata, e torna', [con.abbinate?.length, con.soloBanca, con.differenza, con.stato], [1, [], 0, 'torna'])
  ok('uscita di commissioni in banca: «commissione di Poste»', dal([bn('c', 'uscita', '2026-10-09', 150, 'COMMISSIONI SU BONIFICO')]).soloBanca?.map((x) => x.causa), ['commissione di Poste'])
  ok('…anche «spese»', dal([bn('c', 'uscita', '2026-10-09', 150, 'SPESE TENUTA CONTO')]).soloBanca?.map((x) => x.causa), ['commissione di Poste'])
  ok('una riga qualunque non ha causa probabile', dal([bn('z', 'uscita', '2026-10-09', 1234, 'PAGAMENTO FORNITORE')]).soloBanca?.map((x) => x.causa), [null])
  ok('un’entrata chiamata «commissione» non è una commissione', dal([bn('e', 'entrata', '2026-10-09', 1000, 'Rimborso commissione')]).soloBanca?.map((x) => x.causa), [null])
}

console.log('13. R12 · il mese giusto')
{
  const futuro = chiama('cosaNonVaSaldoBanca', sb('2026-12', 0, 0, 0, 0), '2026-11-15')
  ok('il saldo di un mese futuro è rifiutato, dice cosa fare', [msg(futuro), /scegli|scrivi|aspetta/i.test(futuro)], ['string', true])
  ok('quello del mese in corso si può scrivere', chiama('cosaNonVaSaldoBanca', sb('2026-11', 0, 0, 0, 0), '2026-11-15'), null)
  const r = quadra(base({ mese: '2026-11', righe: [], banca: [bn('1', 'entrata', '2026-11-02', 100)], saldo: sb('2026-11', 13000, 100, 0, 13100) }))
  ok('mese in corso: «non ancora finito»', r.stato, 'non ancora finito')
}

console.log('14. «verificato» e l’impronta')
{
  const dati = base({ righe: ottobre, banca: bancaOttobre })
  const imp = chiama('improntaMese', ottobre, 'conto', '2026-10')
  const cambia = (righe) => {
    const x = chiama('improntaMese', righe, 'conto', '2026-10')
    return msg(x) === 'string' && x !== imp
  }
  ok('l’impronta è un testo non vuoto', [msg(imp), imp.length > 0], ['string', true])
  ok('non dipende dall’ordine delle righe', chiama('improntaMese', [...ottobre].reverse(), 'conto', '2026-10'), imp)
  ok('non cambia per una riga annullata, di un altro mese o di un’altra cassa', chiama('improntaMese', [...ottobre, mv('x', 'uscita', '2026-10-15', 500, { annullato: true }), mv('y', 'entrata', '2026-09-15', 500), mv('z', 'entrata', '2026-10-15', 500, { cassaId: 'cassa' })], 'conto', '2026-10'), imp)
  ok('cambia se cambia un importo', cambia([ottobre[0], { ...ottobre[1], importo: 2100 }]), true)
  ok('…una data', cambia([ottobre[0], { ...ottobre[1], data: '2026-10-11' }]), true)
  ok('…una voce', cambia([ottobre[0], { ...ottobre[1], voce: 'Affitto' }]), true)
  ok('…una riga annullata dopo', cambia([ottobre[0], { ...ottobre[1], annullato: true }]), true)
  ok('…una riga aggiunta', cambia([...ottobre, mv('n', 'entrata', '2026-10-20', 100)]), true)
  const verificato = { verificatoIl: '2026-11-02T10:00:00Z', verificatoDa: 'p1', improntaVerifica: imp }
  ok('con l’impronta salvata uguale a quella di adesso: «verificato»', quadra({ ...dati, saldo: sb('2026-10', 10000, 5000, 2000, 13000, verificato) }).stato, 'verificato')
  const cambiato = quadra({ ...dati, righe: [ottobre[0], { ...ottobre[1], importo: 2100 }], saldo: sb('2026-10', 10000, 5000, 2000, 13000, verificato) })
  ok('se dopo cambia una riga del mese: «cambiato dopo la verifica»', cambiato.stato, 'cambiato dopo la verifica')
  const settembre = quadra({ ...dati, righe: [...ottobre, mv('s1', 'entrata', '2026-09-20', 300)], saldo: sb('2026-10', 10000, 5000, 2000, 13000, verificato) })
  ok('se cambia una riga del mese prima (il saldo iniziale si sposta): «cambiato dopo la verifica»', [settembre.stato, settembre.differenza], ['cambiato dopo la verifica', 300])
  ok('un’impronta salvata ma senza il momento della verifica non vale', quadra({ ...dati, saldo: sb('2026-10', 10000, 5000, 2000, 13000, { improntaVerifica: 'vecchia' }) }).stato, 'torna')
  const torna = quadra({ ...dati, saldo: sb('2026-10', 10000, 5000, 2000, 13000) })
  ok('si segna con differenza 0 e niente da classificare', chiama('cosaNonVaVerifica', torna), null)
  ok('…anche di nuovo dopo un cambio', chiama('cosaNonVaVerifica', { ...cambiato, differenza: 0, daClassificare: 0 }), null)
  const non = quadra({ ...dati, saldo: sb('2026-10', 10000, 4500, 2000, 12500) })
  ok('con una differenza no, e il messaggio dice cosa fare', [msg(chiama('cosaNonVaVerifica', non)), non.stato], ['string', 'non torna'])
  ok('senza il saldo scritto no', msg(chiama('cosaNonVaVerifica', quadra(dati))), 'string')
  ok('senza il CSV del mese no', msg(chiama('cosaNonVaVerifica', quadra({ ...dati, banca: [], saldo: sb('2026-10', 10000, 5000, 2000, 13000) }))), 'string')
  ok('mese non ancora finito no', msg(chiama('cosaNonVaVerifica', quadra({ ...dati, oggi: '2026-10-20', saldo: sb('2026-10', 10000, 5000, 2000, 13000) }))), 'string')
  // Il saldo da cui parte ottobre: il finale di settembre scritto dall'estratto.
  const prima = sb('2026-09', 8000, 2000, 0, 10000)
  ok('verificato, col mese prima che finisce dove ottobre comincia: resta «verificato»', quadra({ ...dati, saldoPrima: prima, saldo: sb('2026-10', 10000, 5000, 2000, 13000, verificato) }).stato, 'verificato')
  const spostato = quadra({ ...dati, saldoPrima: { ...prima, entrate: 2500, saldoFinale: 10500 }, saldo: sb('2026-10', 10000, 5000, 2000, 13000, verificato) })
  ok('se dopo cambia il finale del mese prima: «cambiato dopo la verifica», anche con le righe e la differenza intatte', [spostato.stato, spostato.differenza], ['cambiato dopo la verifica', 0])
  const staccato = quadra({ ...dati, saldoPrima: { ...prima, entrate: 2500, saldoFinale: 10500 }, saldo: sb('2026-10', 10000, 5000, 2000, 13000) })
  ok('un mese che non parte dal finale di quello prima non si segna verificato', [staccato.stato, msg(chiama('cosaNonVaVerifica', staccato))], ['torna', 'string'])
}

console.log('15. la tabella non c’è ancora')
{
  ok('42P01 sulla tabella dei saldi si riconosce', chiama('mancaSaldoBanca', { code: '42P01', message: 'relation "public.saldo_banca" does not exist' }), true)
  ok('PGRST205 (PostgREST) pure', chiama('mancaSaldoBanca', { code: 'PGRST205', message: "Could not find the table 'public.saldo_banca' in the schema cache" }), true)
  ok('una tabella di un’altra cosa no', chiama('mancaSaldoBanca', { code: '42P01', message: 'relation "public.chiusure" does not exist' }), false)
  ok('un altro errore no', chiama('mancaSaldoBanca', { code: '23505', message: 'duplicate key value violates unique constraint "saldo_banca_pkey"' }), false)
  ok('nessun errore no', [chiama('mancaSaldoBanca', null), chiama('mancaSaldoBanca', undefined)], [false, false])
  ok('il messaggio dice quale file lanciare', [typeof q.SENZA_SALDO_BANCA, /123-quadratura-banca\.sql/.test(q.SENZA_SALDO_BANCA ?? '')], ['string', true])
}

console.log('16. privacy · mai un codice fiscale')
{
  const CF = 'RSSMRA80A01H501U'
  const r = quadra(base({ righe: [mv('a', 'entrata', '2026-10-05', 1000, { codiciLetti: [CF], personaId: 'p1' })], banca: [{ ...bn('b', 'entrata', '2026-10-20', 400), codiceFiscaleLetto: [CF] }, { ...bn('c', 'entrata', '2026-10-05', 1000), codiceFiscaleLetto: [CF] }], saldo: sb('2026-10', 10000, 1400, 0, 11400) }))
  const testo = JSON.stringify(r)
  ok('il risultato è calcolato (ha le righe)', (r.abbinate?.length ?? 0) + (r.soloBanca?.length ?? 0), 2)
  ok('nel risultato non c’è il codice fiscale', testo.includes(CF), false)
  ok('…né i campi che lo portano', [testo.includes('codiceFiscaleLetto'), testo.includes('codiciLetti')], [false, false])
}

console.log('17. R13 · la modalità prova scrive i saldi come il database')
{
  const memoria = new Map()
  globalThis.localStorage = { getItem: (k) => (memoria.has(k) ? memoria.get(k) : null), setItem: (k, v) => memoria.set(k, String(v)), removeItem: (k) => memoria.delete(k) }
  globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }
  const p = await carica("export { creaSegreteriaProva } from './src/lib/segreteriaProva'")
  const s = prova(() => p.creaSegreteriaProva())
  // «rifiutato» solo se il metodo c'è e dice di no; un metodo che non c'è è un errore della prova, non un rifiuto.
  const esito = async (f) => {
    try {
      await f()
      return 'ok'
    } catch (e) {
      return e instanceof TypeError ? `ERRORE: ${e.message}` : 'rifiutato'
    }
  }
  const dati = (extra = {}) => ({ mese: '2026-01', saldoIniziale: 10000, entrate: 5000, uscite: 2000, saldoFinale: 13000, ...extra })
  ok('un saldo che torna si scrive', await esito(() => s.scriviSaldoBanca(dati())), 'ok')
  ok('…e si rilegge', (await prova(() => s.saldiBanca()))?.map?.((x) => [x.mese, x.saldoFinale]), [['2026-01', 13000]])
  ok('un finale che non torna è rifiutato', await esito(() => s.scriviSaldoBanca(dati({ mese: '2026-02', saldoFinale: 12500 }))), 'rifiutato')
  ok('un mese futuro è rifiutato', await esito(() => s.scriviSaldoBanca(dati({ mese: '2999-01', saldoIniziale: 0, entrate: 0, uscite: 0, saldoFinale: 0 }))), 'rifiutato')
  ok('un mese scritto male è rifiutato', await esito(() => s.scriviSaldoBanca(dati({ mese: '01/2026' }))), 'rifiutato')
  // La quadratura come la calcola la schermata: gennaio torna, salvo dove si cambia di proposito.
  const gen = (extra = {}) => ({ mese: '2026-01', stato: 'torna', differenza: 0, daClassificare: 0, avvisi: [], ...extra })
  ok('verificare un mese senza saldo è rifiutato', await esito(() => s.verificaMeseBanca(gen({ mese: '2025-12' }), 'abc')), 'rifiutato')
  ok('verificare un mese che non torna è rifiutato', await esito(() => s.verificaMeseBanca(gen({ stato: 'non torna', differenza: 500 }), 'abc')), 'rifiutato')
  ok('…anche con righe «Da classificare»', await esito(() => s.verificaMeseBanca(gen({ stato: 'da classificare', daClassificare: 2 }), 'abc')), 'rifiutato')
  ok('…e un mese senza le righe della banca', await esito(() => s.verificaMeseBanca(gen({ stato: 'CSV del mese mancante', differenza: 0 }), 'abc')), 'rifiutato')
  ok('verificare un mese con saldo che torna si può', await esito(() => s.verificaMeseBanca(gen(), 'abc')), 'ok')
  ok('…e resta l’impronta', (await prova(() => s.saldiBanca()))?.map?.((x) => [x.mese, x.improntaVerifica, !!x.verificatoIl]), [['2026-01', 'abc', true]])
  await esito(() => s.scriviSaldoBanca(dati({ entrate: 6000, saldoFinale: 14000 })))
  ok('riscrivere un mese lo sostituisce (uno solo) e toglie la verifica', (await prova(() => s.saldiBanca()))?.map?.((x) => [x.mese, x.saldoFinale, x.verificatoIl ?? null]), [['2026-01', 14000, null]])
  const verificato = async (mese) => (await prova(() => s.saldiBanca()))?.find?.((x) => x.mese === mese)?.verificatoIl ? 'verificato' : 'da verificare'
  await esito(() => s.scriviSaldoBanca(dati({ mese: '2026-02', saldoIniziale: 14000, entrate: 0, uscite: 0, saldoFinale: 14000 })))
  await esito(() => s.verificaMeseBanca(gen({ mese: '2026-02' }), 'feb'))
  ok('febbraio, che parte dal finale di gennaio, si verifica', await verificato('2026-02'), 'verificato')
  await esito(() => s.scriviSaldoBanca(dati({ entrate: 7000, uscite: 3000, saldoFinale: 14000 })))
  ok('gennaio cambia ma finisce sempre a 140,00: febbraio resta verificato', await verificato('2026-02'), 'verificato')
  await esito(() => s.scriviSaldoBanca(dati({ entrate: 7000, uscite: 2000, saldoFinale: 15000 })))
  ok('gennaio ora finisce a 150,00: febbraio torna da verificare', await verificato('2026-02'), 'da verificare')
  ok('verificare con l’avviso del mese prima è rifiutato', await esito(() => s.verificaMeseBanca(gen({ mese: '2026-02', avvisi: [{ tipo: 'discontinuita', testo: '…' }] }), 'feb')), 'rifiutato')
}

console.log('18. la lista della banca: le righe importate (anche annullate) e quelle coperte')
{
  const righe = [
    mv('i1', 'entrata', '2026-10-05', 5000, { origineImport: 'banca:a' }),
    mv('i2', 'uscita', '2026-10-06', 700, { origineImport: 'banca:b', annullato: true }),
    mv('m1', 'entrata', '2026-10-07', 900),
    mv('p1', 'entrata', '2026-10-08', 900, { origineImport: 'prima-nota:x' }),
  ]
  const coperti = [{ chiave: 'banca:c', data: '2026-10-09', tipo: 'entrata', importo: 900, descrizione: 'Bonifico', conId: 'm1', conDescrizione: 'Movimento m1' }]
  ok('importate, annullate comprese, più le coperte; niente prima nota né movimenti a mano', chiama('righeBanca', righe, coperti)?.map?.((b) => [b.chiave, b.importo]), [['banca:a', 5000], ['banca:b', 700], ['banca:c', 900]])
  ok('senza il file dei coperti (null) restano le importate', chiama('righeBanca', righe, null)?.map?.((b) => b.chiave), ['banca:a', 'banca:b'])
  ok('una chiave importata e anche coperta conta una volta', chiama('righeBanca', righe, [{ ...coperti[0], chiave: 'banca:a' }])?.length, 2)
}

console.log('19. il riepilogo della differenza: le parti fanno la differenza')
{
  const banca = [bn('x', 'entrata', '2026-10-05', 5000), bn('y', 'uscita', '2026-10-20', 300, 'Commissioni')]
  const saldo = sb('2026-10', 9000, 5000, 300, 13700)
  const q = quadra(base({ righe: ottobre, banca, saldo }))
  const r = chiama('riepilogoDifferenza', q, saldo)
  ok('solo app, solo banca, inizio diverso, altro mese, non spiegato', r, { soloApp: -2000, soloBanca: 300, inizioDiverso: 1000, altroMese: 0, nonSpiegato: 0 })
  ok('…e sommate fanno la differenza', r && typeof r === 'object' ? Object.values(r).reduce((a, b) => a + b, 0) : r, q.differenza)
  ok('senza saldo non c’è riepilogo', chiama('riepilogoDifferenza', quadra(base({ righe: ottobre, banca })), null), null)
}

console.log('20. un saldo scritto a mano: anche negativo, col meno o il segno lungo')
{
  ok('1.234,56 → 123456', chiama('centesimiConSegno', '1.234,56'), 123456)
  ok('-12,30 → -1230', chiama('centesimiConSegno', '-12,30'), -1230)
  ok('− 12,30 (segno lungo, spazio) → -1230', chiama('centesimiConSegno', '− 12,30'), -1230)
  ok('un testo che non è un importo → null', chiama('centesimiConSegno', '12,3x'), null)
  ok('il solo meno → null', chiama('centesimiConSegno', '-'), null)
}

console.log('21. i segni sulla tessera del Conto Corrente: i mesi finiti che chiedono qualcosa, dal più recente')
{
  const q = (mese, stato) => ({ mese, stato })
  const mesi = [q('2026-05', 'saldo da scrivere'), q('2026-06', 'torna'), q('2026-07', 'non torna'), q('2026-08', 'saldo da scrivere'), q('2026-09', 'cambiato dopo la verifica'), q('2026-10', 'saldo da scrivere')]
  const saldi = [sb('2026-06', 0, 0, 0, 0), sb('2026-07', 0, 0, 0, 0)]
  ok('i mesi prima del primo saldo scritto non chiedono il saldo; l’ultimo finito sì', chiama('segniDelConto', mesi, saldi)?.map?.((x) => [x.mese, x.stato, x.tono]), [
    ['2026-10', 'saldo da scrivere', 'giallo'], ['2026-09', 'cambiato dopo la verifica', 'rosso'], ['2026-08', 'saldo da scrivere', 'giallo'], ['2026-07', 'non torna', 'rosso'],
  ])
  ok('senza nessun saldo chiede solo l’ultimo mese finito', chiama('segniDelConto', mesi.filter((x) => x.stato === 'saldo da scrivere'), [])?.map?.((x) => x.mese), ['2026-10'])
  ok('CSV mancante e da classificare sono gialli', chiama('segniDelConto', [q('2026-09', 'CSV del mese mancante'), q('2026-10', 'da classificare')], [sb('2026-09', 0, 0, 0, 0)])?.map?.((x) => x.tono), ['giallo', 'giallo'])
  ok('verificato e torna non chiedono niente', chiama('segniDelConto', [q('2026-08', 'verificato'), q('2026-09', 'torna')], [sb('2026-08', 0, 0, 0, 0)]), [])
}

console.log('22. il modulo del saldo: cosa si salva e quale campo è sbagliato')
{
  const leggi = (t, oggi = '2026-11-15') => chiama('leggiSaldoBanca', { iniziale: '100,00', finale: '130,00', entrate: '50,00', uscite: '20,00', ...t }, '2026-10', oggi)
  const giusto = leggi({})
  ok('quattro numeri che tornano: si salva, senza errore', [giusto?.saldo, giusto?.errore, giusto?.campi], [sb('2026-10', 10000, 5000, 2000, 13000), null, []])
  ok('un saldo sotto zero, col meno', leggi({ iniziale: '-10,00', finale: '20,00' })?.saldo?.saldoIniziale, -1000)
  const vuoto = leggi({ uscite: ' ' })
  ok('un campo vuoto: non si salva, ma non è ancora un errore', [vuoto?.saldo, vuoto?.errore, vuoto?.campi], [null, null, []])
  const male = leggi({ entrate: 'cinquanta', uscite: '' })
  ok('un numero scritto male: errore, e rosso solo quel campo (anche se un altro è vuoto)', [male?.saldo, msg(male?.errore), male?.campi], [null, 'string', ['entrate']])
  const meno = leggi({ uscite: '-20,00' })
  ok('le uscite col meno: rosso sulle uscite', [meno?.saldo, msg(meno?.errore), meno?.campi], [null, 'string', ['uscite']])
  const nonTorna = leggi({ finale: '125,00' })
  ok('i numeri che non tornano fra loro: errore, nessun campo in particolare', [nonTorna?.saldo, msg(nonTorna?.errore), nonTorna?.campi], [null, 'string', []])
  ok('un mese non ancora cominciato: errore', msg(leggi({}, '2026-09-30')?.errore), 'string')
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
