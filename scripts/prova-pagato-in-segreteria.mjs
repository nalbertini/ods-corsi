// ---------------------------------------------------------------------------
// I soldi che la segreteria ha già, visti dall'area iscritti, senza browser e senza rete.
//
//   node scripts/prova-pagato-in-segreteria.mjs
//
// Un bonifico assegnato alla quota o a un corso, o un pagamento registrato a
// mano, finché non diventa ricevuta sta in `pagamenti_diretti`. La segreteria lo
// conta già come pagato: l'area iscritti deve dire lo stesso, e non far pagare
// di nuovo online. La metà del database è `supabase/prova/pagato-in-segreteria.sql`
// (146), con gli stessi casi e gli stessi testi; le regole stanno in
// `src/lib/assegna.ts`, `corsoSatispay.ts` e `iscrittoProva.ts`.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const OGGI = new Date(2026, 9, 20, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI]))
  }
  static now() {
    return OGGI
  }
}
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '', pathname: '/iscritti/' }, addEventListener() {} }

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
// Un solo bundle: l'archivio di prova dev'essere lo stesso per chi scrive e per chi legge.
const m = await carica(
  "export { archivio } from './src/lib/archivioProva'; export { pagamentiSatispayProva, salvaSatispay } from './src/lib/richiesteProva';" +
    "export * as iscrittoLib from './src/lib/iscrittoProva'; export { pagamentoDi } from './src/lib/segreteria';" +
    "export { statoCorsiDi, DA_PAGARE } from './src/lib/corsoSatispay'; export { salvaListinoProva } from './src/lib/listino'",
)

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const aspetta = async (fn) => {
  try {
    return await fn()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

// Gli stessi testi del 146.
const T_QUOTA = 'ERRORE: La quota risulta già pagata in segreteria: per quel che manca chiedi alla segreteria'
const T_CORSO = 'ERRORE: Il corso risulta già pagato in segreteria: per quel che manca chiedi alla segreteria'

const OGGI_ISO = '2026-10-20'
const i = m.iscrittoLib ?? {}
const d = m.archivio?.dati
const [anna, luca] = (d?.persone ?? []).filter((p) => p.ruolo === 'iscritto' && p.attiva)
const corso = d?.corsi?.[0]
const dati = i.creaIscrittoProva?.()
// Una riga di `pagamenti_diretti`: con `movimentoId` è un bonifico assegnato, senza un pagamento a mano.
const pd = (voce, importo, extra = {}) => ({
  id: `pd-${Math.random()}`, personaId: anna?.id, data: '2026-10-15', importo, metodo: 'Bonifico', voce, creatoIl: '2026-10-15T09:00:00Z', movimentoId: 'm1', ...extra,
})
const ricevutaQuota = (pagato) => ({
  id: 'r-quota', anno: 2026, numero: 77, data: '2026-10-01', personaId: anna?.id, ente: { nome: 'ODS' }, intestatario: { nome: 'A', cognome: 'B' },
  voci: [{ descrizione: 'QUOTA ASSOCIATIVA', quantita: 1, prezzo: 5000, dal: '2026-10-01', al: '2027-07-31', pagamenti: [{ data: '2026-10-01', importo: pagato, metodo: 'Contanti' }] }],
  totale: 5000, pagato, anticipo: 0, creataIl: '2026-10-01T08:00:00Z',
})
// Anna parte iscritta al primo corso, senza ricevute né pagamenti: ogni caso mette solo quel che gli serve.
const riparti = (diretti = [], ricevute = []) => {
  if (!d || !anna || !luca || !corso) return
  d.pagamentiDiretti = diretti
  d.ricevute = (d.ricevute ?? []).filter((r) => r.personaId !== anna.id).concat(ricevute)
  d.iscrizioni = d.iscrizioni.filter((x) => x.personaId !== anna.id).concat([{ corsoId: corso.id, personaId: anna.id, dal: '2026-09-01' }])
  anna.pagamento = { stato: 'da_pagare' }
  m.salvaSatispay?.([])
  m.salvaListinoProva?.({ quota: 50, saldoEntro: '2026-08-31', offerte: [], corsi: [{ corso: corso.nome, corsoId: corso.id, eta: '', orari: [], prezzi: [{ annuale: 300, trimestre: 120 }] }] })
}
const quota = async () => {
  const s = await aspetta(() => dati.scheda(anna?.id))
  const p = m.pagamentoDi?.(s, OGGI_ISO)
  return [p?.come, p?.mancano ?? null]
}

console.log('1. la quota pagata in segreteria, nella scheda dell\'iscritto')
riparti([pd('Quota associativa 2026/27', 5000)])
ok('tutta da un bonifico assegnato: pagata', await quota(), ['pagato', null])
riparti([pd('QUOTA ASSOCIATIVA', 2000)])
ok('metà da un bonifico: in parte, mancano 30 €', await quota(), ['in_parte', 3000])
riparti([pd('QUOTA ASSOCIATIVA', 5000, { movimentoId: undefined, metodo: 'Contanti' })])
ok('un pagamento a mano, senza ricevuta, conta come il bonifico', await quota(), ['pagato', null])
riparti([pd('Quota associativa 2025/26', 5000)])
ok('la quota della stagione passata non è quella di adesso', await quota(), ['da_pagare', null])
riparti([pd('QUOTA ASSOCIATIVA', 5000, { data: '2026-07-20' })])
ok('…né un bonifico di luglio, senza stagione nel nome', await quota(), ['da_pagare', null])
riparti([pd('QUOTA ASSOCIATIVA', 5000, { annullatoIl: '2026-10-16T09:00:00Z' })])
ok('un bonifico tolto non conta', await quota(), ['da_pagare', null])
riparti([pd('QUOTA ASSOCIATIVA', 1000)], [ricevutaQuota(2000)])
ok('20 € in ricevuta e 10 € da un bonifico: mancano 20 €', await quota(), ['in_parte', 2000])

console.log('\n2. la quota pagata in segreteria non si paga online')
riparti([pd('QUOTA ASSOCIATIVA', 2000)])
ok('PAGA LA QUOTA non c\'è: nessun importo', (await aspetta(() => dati.chiPaga(anna?.id, luca?.id)))?.importo ?? null, null)
ok('…e se ci si prova, il testo del database', await aspetta(() => i.pagaQuotaProva(anna?.id)), T_QUOTA)
ok('…senza scrivere niente', (m.pagamentiSatispayProva?.() ?? []).length, 0)
riparti([pd('Quota associativa 2025/26', 5000)])
ok('con un bonifico della stagione passata la quota si paga', (await aspetta(() => dati.chiPaga(anna?.id, luca?.id)))?.importo ?? null, 5000)

console.log('\n3. il saldo toglie quel che è già arrivato in segreteria')
riparti([pd('QUOTA ASSOCIATIVA', 1000)], [ricevutaQuota(2000)])
await aspetta(() => i.pagaSaldoProva(anna?.id, 'r-quota'))
ok('il saldo è di 20 €, non di 30', (m.pagamentiSatispayProva?.() ?? []).map((p) => p.importo), [2000])

console.log('\n4. il corso pagato in segreteria non si paga online')
const corsi = async () => {
  const s = await aspetta(() => dati.scheda(anna?.id))
  const c = await aspetta(() => dati.chiPagaCorsi(anna?.id, luca?.id))
  const x = c?.corsi?.[0]
  const daPagare = (m.statoCorsiDi?.(s, d?.ricevute ?? [], c, OGGI_ISO) ?? []).filter((y) => m.DA_PAGARE.includes(y.come)).length
  return [x?.assegnato ?? null, x?.annuale ?? null, x?.trimestre ?? null, daPagare]
}
riparti([pd(`Annuale ${corso?.nome}`, 10000)])
ok('un annuale in parte da un bonifico: assegnato, nessun prezzo, non è nei corsi da pagare', await corsi(), [true, null, null, 0])
ok('…e se ci si prova, il testo del database', await aspetta(() => i.pagaCorsoProva(anna?.id, corso?.id, 'trimestre')), T_CORSO)
riparti([pd(`TRIMESTRE ${corso?.nome}`, 12000, { movimentoId: undefined })])
ok('un trimestre pagato a mano: lo stesso', await corsi(), [true, null, null, 0])
riparti([pd(`Annuale ${corso?.nome}`, 30000, { data: '2025-10-15' })])
ok('un bonifico di un anno fa non copre il corso di adesso', await corsi(), [false, 30000, 12000, 1])
riparti()
ok('senza niente, il corso si paga', await corsi(), [false, 30000, 12000, 1])

console.log(guai ? `\n${guai} cose non tornano` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
