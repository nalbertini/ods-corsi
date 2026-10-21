// ---------------------------------------------------------------------------
// Il filtro «Pagato nel vecchio programma» degli ISCRITTI, senza browser.
//
//   node scripts/prova-pagato-prima.mjs
//
// Chi ha pagato la quota nel vecchio programma (lo storico importato e collegato
// alla persona, 70-movimenti-persona.sql) e nell'app risulta ancora da pagare:
// la lettura è `incassi_vecchio_programma()` (71-pagato-vecchio-programma.sql,
// provata da supabase/prova/pagato-vecchio-programma.sql), la logica sta in
// src/lib/pagatoPrima.ts. Nomi tutti inventati.
//
// Forma dei dati (importi in centesimi, come `movimenti.importo`):
//   IncassoPrima = { personaId: string | null, data: 'AAAA-MM-GG', importo, voce }
//   pagatoNelVecchio(persone, incassi, oggi) → { quota, daGuardare, nonCollegati }
//   RigaPagatoPrima = { personaId, data, importo, voce, motivo?, daPersonaId? }
//   segnaPagatoPrima(d, persone, { fino?, nota?, oggi? }) → { riusciti: id[], falliti: [{ id, nome, errore }] }
// ---------------------------------------------------------------------------
process.env.TZ = 'Europe/Rome'
import { existsSync } from 'node:fs'
import { build } from 'esbuild'

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const impacchetta = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}
// src/lib/pagatoPrima.ts può non esserci ancora: le prove falliscono con «non è una funzione», non per un import.
const m = {
  ...(existsSync('src/lib/pagatoPrima.ts') ? await impacchetta("export * from './src/lib/pagatoPrima'") : {}),
  ...(await impacchetta("export * from './src/lib/filtriIscritti'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'; export { pagamentoDi } from './src/lib/segreteria'; export { STAGIONE, stagioneDi } from './src/lib/costi'")),
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che non c'è ancora lancia: la prova fallisce con quel messaggio, non si ferma.
const prova = async (f) => {
  try { return await f() } catch (e) { return `ERRORE: ${e.message}` }
}

const OGGI = '2026-10-18'
const QUOTA = 'Quota associativa'
const CORSI = 'Corsi e altri pagamenti'
const persona = (id, nome, cognome, altro = {}) => ({ id, nome, cognome, attiva: true, pagamento: { stato: 'da_pagare' }, quote: [], ...altro })
const inc = (personaId, data, importo, voce = QUOTA) => ({ personaId, data, importo, voce })
const gruppi = (persone, incassi, oggi = OGGI) => prova(() => m.pagatoNelVecchio(persone, incassi, oggi))
const ids = (g, quale) => (g && g[quale] ? g[quale].map((r) => r.personaId) : g)

console.log('1. chi si può segnare: quota di almeno 50 € collegata a lui, in stagione')
{
  const clio = persona('clio', 'Clio', 'Tatone')
  const g = await gruppi([clio], [inc('clio', '2026-09-28', 5000)])
  ok('Clio, 50 € di quota il 28/09/2026, da pagare: nel gruppo quota', ids(g, 'quota'), ['clio'])
  ok('…e non fra quelli da guardare a mano', ids(g, 'daGuardare'), [])
  ok('la riga porta data, importo e voce', g.quota?.[0] && [g.quota[0].data, g.quota[0].importo, g.quota[0].voce], ['2026-09-28', 5000, QUOTA])
  ok('la frase della riga', await prova(() => m.frasePagatoPrima(g.quota[0])), '28/09/2026 · 50 € quota associativa')
  ok('la frase con i centesimi', await prova(() => m.frasePagatoPrima(inc('x', '2026-10-03', 5050))), '03/10/2026 · 50,50 € quota associativa')
  ok('la frase di un corso', await prova(() => m.frasePagatoPrima(inc('x', '2026-09-12', 12500, CORSI))), '12/09/2026 · 125 € corsi e altri pagamenti')
  ok('più di 50 € vale: 310 € di quota', ids(await gruppi([clio], [inc('clio', '2026-09-28', 31000)]), 'quota'), ['clio'])
  ok('scaduta (quota di un\'altra stagione scaduta) è inclusa', ids(await gruppi([persona('s', 'Marta', 'Esposito', { quote: [{ anno: 2025, numero: 3, al: '2026-07-31', mancano: 0 }] })], [inc('s', '2026-09-14', 5000)]), 'quota'), ['s'])
  ok('in parte (ricevuta con ancora da pagare) è inclusa', ids(await gruppi([persona('p', 'Elia', 'Moretti', { quote: [{ anno: 2026, numero: 4, dal: '2026-09-01', al: '2027-07-31', mancano: 2000 }] })], [inc('p', '2026-09-14', 5000)]), 'quota'), ['p'])
  ok('più incassi: quota da 30 € e poi da 50 €: quota (almeno uno basta)', ids(await gruppi([clio], [inc('clio', '2026-09-10', 3000), inc('clio', '2026-09-28', 5000)]), 'quota'), ['clio'])
  ok('un incasso di quota e uno di corsi: quota, e la riga mostra quello di quota', await prova(async () => (await m.pagatoNelVecchio([clio], [inc('clio', '2026-09-30', 31000, CORSI), inc('clio', '2026-09-28', 5000)], OGGI)).quota[0].voce), QUOTA)
}

console.log('\n2. chi non compare')
{
  const clio = persona('clio', 'Clio', 'Tatone')
  const pagato = (altro) => gruppi([persona('x', 'Ugo', 'Neri', altro)], [inc('x', '2026-09-28', 5000)])
  const tutto = async (g) => (await g).quota ? [...(await g).quota, ...(await g).daGuardare] : await g
  ok('ricevuta valida con la quota pagata: no', await tutto(pagato({ quote: [{ anno: 2026, numero: 1, dal: '2026-09-01', al: '2027-07-31', mancano: 0 }] })), [])
  ok('già segnata senza ricevuta (fuori dall\'app): no', await tutto(pagato({ pagamento: { stato: 'pagato', fino: '2027-07-31', nota: 'Dal vecchio programma' } })), [])
  ok('segnata senza «fino»: vale fino a fine stagione: no', await tutto(pagato({ pagamento: { stato: 'pagato' } })), [])
  ok('persona non attiva: no', await tutto(pagato({ attiva: false })), [])
  const c = await gruppi([clio], [
    inc('clio', '2025-09-28', 5000), // stagione scorsa
    inc('clio', '2027-08-01', 5000), // dopo la fine: è già della stagione dopo
    inc('clio', '2026-07-31', 5000), // il giorno prima di agosto: la stagione prima
  ])
  ok('storico fuori stagione (confini compresi): no', await tutto(Promise.resolve(c)), [])
  ok('il 1 settembre e il 31 luglio sono dentro', [ids(await gruppi([clio], [inc('clio', '2026-09-01', 5000)]), 'quota'), ids(await gruppi([clio], [inc('clio', '2027-07-31', 5000)]), 'quota')], [['clio'], ['clio']])
  // Agosto è già della stagione che inizia: chi paga ad agosto paga quella (come nel database, 71-pagato-vecchio-programma.sql).
  ok('il 1 e il 31 agosto 2026 sono dentro', [ids(await gruppi([clio], [inc('clio', '2026-08-01', 5000)]), 'quota'), ids(await gruppi([clio], [inc('clio', '2026-08-31', 5000)]), 'quota')], [['clio'], ['clio']])
  // La stagione si ricava dalla data di oggi, come nel database: da settembre 2027 il filtro non resta vuoto.
  const confini = (g) => { const x = m.stagioneDi?.(g); return x && { dal: x.dal, al: x.al } }
  ok('la stagione di oggi (ottobre 2026) e di gennaio 2027', [confini('2026-10-18'), confini('2027-01-10')], [{ dal: '2026-08-01', al: '2027-07-31' }, { dal: '2026-08-01', al: '2027-07-31' }])
  ok('dal 1 agosto 2027 è la stagione nuova', [confini('2027-07-31'), confini('2027-08-01'), confini('2027-09-01')], [{ dal: '2026-08-01', al: '2027-07-31' }, { dal: '2027-08-01', al: '2028-07-31' }, { dal: '2027-08-01', al: '2028-07-31' }])
  ok('a ottobre 2027 conta l\'incasso di settembre 2027, non quello del 2026', ids(await gruppi([clio], [inc('clio', '2027-09-28', 5000), inc('clio', '2026-09-28', 5000)], '2027-10-18'), 'quota'), ['clio'])
  ok('…e solo quello nuovo', (await gruppi([clio], [inc('clio', '2026-09-28', 5000)], '2027-10-18')).quota?.length, 0)
  ok('la riga dice se la quota è scaduta o da pagare', [(await gruppi([persona('s', 'Marta', 'Esposito', { quote: [{ anno: 2025, numero: 3, al: '2026-07-31', mancano: 0 }] })], [inc('s', '2026-09-14', 5000)])).quota?.[0]?.scaduta, (await gruppi([clio], [inc('clio', '2026-09-14', 5000)])).quota?.[0]?.scaduta], [true, false])
  ok('nessun incasso: nessuno', await tutto(gruppi([clio], [])), [])
  ok('incasso di una persona che non c\'è nell\'elenco: nessuno', await tutto(gruppi([clio], [inc('altro', '2026-09-28', 5000)])), [])
  const n = await gruppi([clio], [inc(null, '2026-09-28', 5000), inc(null, '2026-09-29', 12500, CORSI), inc('clio', '2025-09-28', 5000)])
  ok('incasso non collegato: Clio non compare', await tutto(Promise.resolve(n)), [])
  ok('…ma i non collegati si contano a parte (K): 2, non quello fuori stagione', n.nonCollegati, 2)
  ok('K conta solo la stagione', (await gruppi([clio], [inc(null, '2025-09-28', 5000)])).nonCollegati, 0)
  ok('K non cambia per quelli collegati', (await gruppi([clio], [inc('clio', '2026-09-28', 5000)])).nonCollegati, 0)
}

console.log('\n3. da guardare a mano: senza casella')
{
  const clio = persona('clio', 'Clio', 'Tatone')
  const sotto = await gruppi([clio], [inc('clio', '2026-10-03', 3000)])
  ok('quota sotto 50 €: da guardare, non da segnare', [ids(sotto, 'quota'), ids(sotto, 'daGuardare')], [[], ['clio']])
  ok('…col motivo «sotto-quota»', sotto.daGuardare?.[0]?.motivo, 'sotto-quota')
  ok('49,99 € è ancora sotto, 50 € no', [(await gruppi([clio], [inc('clio', '2026-10-03', 4999)])).daGuardare?.length, (await gruppi([clio], [inc('clio', '2026-10-03', 5000)])).daGuardare?.length], [1, 0])
  const corsi = await gruppi([clio], [inc('clio', '2026-09-12', 12500, CORSI)])
  ok('solo corsi, senza quota: da guardare, non da segnare', [ids(corsi, 'quota'), ids(corsi, 'daGuardare')], [[], ['clio']])
  ok('…col motivo «solo-corsi» e la frase del corso', [corsi.daGuardare?.[0]?.motivo, await prova(() => m.frasePagatoPrima(corsi.daGuardare[0]))], ['solo-corsi', '12/09/2026 · 125 € corsi e altri pagamenti'])
  ok('quota sotto 50 € più corsi: ancora da guardare, motivo sotto-quota', (await gruppi([clio], [inc('clio', '2026-09-10', 3000), inc('clio', '2026-09-12', 12500, CORSI)])).daGuardare?.[0]?.motivo, 'sotto-quota')
  ok('due quote da 30 €: non si sommano, da guardare', ids(await gruppi([clio], [inc('clio', '2026-09-10', 3000), inc('clio', '2026-09-20', 3000)]), 'daGuardare'), ['clio'])
  // L'incasso è del genitore (titolare del nucleo), il figlio non ne ha uno suo: non si segna il figlio.
  const anna = persona('anna', 'Anna', 'Gallo')
  const elia = persona('elia', 'Elia', 'Gallo', { nucleo: 'anna' })
  const g = await gruppi([anna, elia], [inc('anna', '2026-09-12', 5000)])
  ok('incasso del genitore: Anna si segna, Elia no', [ids(g, 'quota'), ids(g, 'daGuardare')], [['anna'], ['elia']])
  ok('…Elia col motivo «altra-persona» e il genitore indicato', [g.daGuardare?.[0]?.motivo, g.daGuardare?.[0]?.daPersonaId], ['altra-persona', 'anna'])
  ok('…e la frase è quella dell\'incasso del genitore', await prova(() => m.frasePagatoPrima(g.daGuardare[0])), '12/09/2026 · 50 € quota associativa')
  const suo = await gruppi([anna, elia], [inc('anna', '2026-09-12', 5000), inc('elia', '2026-09-13', 5000)])
  ok('se Elia ha anche un incasso suo, si segna: quota', ids(suo, 'quota'), ['anna', 'elia'])
  const pagataAnna = await gruppi([persona('anna', 'Anna', 'Gallo', { pagamento: { stato: 'pagato' } }), elia], [inc('anna', '2026-09-12', 5000)])
  ok('con Anna già a posto, Elia resta da guardare (l\'incasso non è suo)', [ids(pagataAnna, 'quota'), ids(pagataAnna, 'daGuardare')], [[], ['elia']])
  ok('ordine: per cognome e nome', ids(await gruppi([persona('b', 'Bea', 'Zeta'), persona('a', 'Ada', 'Zeta'), persona('c', 'Ciro', 'Alfa')], [inc('b', '2026-09-12', 5000), inc('a', '2026-09-12', 5000), inc('c', '2026-09-12', 5000)]), 'quota'), ['c', 'a', 'b'])
}

console.log('\n4. segnare in blocco: pagato, fino a fine stagione, nota «Dal vecchio programma»')
{
  const chiamate = []
  const d = (rifiuta = []) => ({
    async salvaPagamento(id, p) {
      chiamate.push([id, p])
      if (rifiuta.includes(id)) throw new Error('Rete assente')
    },
  })
  const tre = [{ id: 'a', nome: 'Clio', cognome: 'Tatone' }, { id: 'b', nome: 'Marta', cognome: 'Esposito' }, { id: 'c', nome: 'Elia', cognome: 'Moretti' }]
  const r = await prova(() => m.segnaPagatoPrima(d(), tre, { oggi: OGGI }))
  ok('tutte riuscite: tre riusciti, nessun fallito', [r.riusciti, r.falliti], [['a', 'b', 'c'], []])
  ok('ognuna è segnata «pagato», fino a fine stagione, con la nota', chiamate.map(([id, p]) => [id, p]), tre.map((x) => [x.id, { stato: 'pagato', fino: '2027-07-31', nota: 'Dal vecchio programma' }]))
  chiamate.length = 0
  await prova(() => m.segnaPagatoPrima(d(), tre.slice(0, 1), { oggi: '2027-10-01' }))
  ok('segnata a ottobre 2027: «fino» di default è la fine della 2027/28', chiamate.map(([, p]) => p.fino), ['2028-07-31'])
  chiamate.length = 0
  await prova(() => m.segnaPagatoPrima(d(), tre.slice(0, 1), { fino: '2027-01-31', nota: 'Ricevuta di carta' }))
  ok('fino e nota si possono cambiare', chiamate, [['a', { stato: 'pagato', fino: '2027-01-31', nota: 'Ricevuta di carta' }]])
  chiamate.length = 0
  const x = await prova(() => m.segnaPagatoPrima(d(['b']), tre))
  ok('una fallita: le altre due riescono, la fallita si riporta per nome', [x.riusciti, x.falliti?.map((f) => [f.id, f.nome])], [['a', 'c'], [['b', 'Esposito Marta']]])
  ok('…senza il testo grezzo dell\'errore, ma con una frase per chi usa l\'app', typeof x.falliti?.[0]?.errore === 'string' && x.falliti[0].errore.length > 0 && !/Rete assente/.test(x.falliti[0].errore), true)
  ok('…e tutte e tre sono state tentate', chiamate.length, 3)
  ok('tutte fallite: nessun riuscito, tre falliti (mai a metà in silenzio)', await prova(async () => { const y = await m.segnaPagatoPrima(d(['a', 'b', 'c']), tre); return [y.riusciti, y.falliti.map((f) => f.nome)] }), [[], ['Tatone Clio', 'Esposito Marta', 'Moretti Elia']])
  chiamate.length = 0
  const molte = Array.from({ length: 53 }, (_, i) => ({ id: `p${i}`, nome: `N${i}`, cognome: 'C' }))
  let insieme = 0, massimo = 0
  const lento = { async salvaPagamento() { insieme++; massimo = Math.max(massimo, insieme); await new Promise((f) => setTimeout(f, 1)); insieme-- } }
  const y = await prova(() => m.segnaPagatoPrima(lento, molte))
  ok('53 persone: tutte segnate, a pacchetti (non tutte insieme)', [y.riusciti?.length, y.falliti?.length, massimo > 1 && massimo < 53], [53, 0, true])
  ok('nessuna persona: niente da fare, nessuna chiamata', await prova(async () => { const z = await m.segnaPagatoPrima(d(), []); return [z.riusciti, z.falliti] }), [[], []])
  // Chi è segnato esce dal filtro: la stessa segnatura, riletta da pagamentoDi, lo mette a posto.
  const clio = persona('clio', 'Clio', 'Tatone', { pagamento: { stato: 'pagato', fino: m.STAGIONE.quota.al, nota: 'Dal vecchio programma' } })
  ok('dopo la segnatura Clio è «pagato» e non è più nel filtro', [m.pagamentoDi(clio, OGGI).come, ids(await gruppi([clio], [inc('clio', '2026-09-28', 5000)]), 'quota')], ['pagato', []])
}

console.log('\n5. il filtro: «Pagato nel vecchio programma», dietro «Altri filtri»')
{
  const nessuno = { conTessere: false, filePrima: 0, doppioni: 0 }
  const altri = (c) => (m.altriFiltri ? m.altriFiltri(c) : 'manca')
  ok('il testo', m.TESTI_FILTRI?.['pagato-prima'], 'Pagato nel vecchio programma')
  ok('è fra tutti i filtri (si sa se è acceso anche senza chip)', m.ID_FILTRI?.includes('pagato-prima'), true)
  ok('non è fra quelli in vista', m.FILTRI_VISIBILI?.includes('pagato-prima'), false)
  ok('con almeno una persona: compare fra gli altri, dopo «senza-documento»', altri({ ...nessuno, conStorico: true }), ['senza-email', 'poco', 'scadenza', 'arrivo', 'senza-documento', 'pagato-prima'])
  ok('senza persone: non compare', altri({ ...nessuno, conStorico: false }).includes('pagato-prima'), false)
  ok('se la lettura non c\'è (manca) o il conto non si dà: non compare, mai «nessuno»', altri(nessuno).includes('pagato-prima'), false)
  ok('acceso, il gruppo «Altri filtri» si apre da sé', m.altriAperti(['pagato-prima'], false), true)
}

console.log('\n6. senza il file nuovo il filtro non si offre')
{
  const sbagliato = { code: 'PGRST202', message: 'Could not find the function public.incassi_vecchio_programma without parameters in the schema cache' }
  const giusto = [
    { persona_id: 'p1', data: '2026-09-28', importo: 5000, voce: QUOTA },
    { persona_id: null, data: '2026-09-29', importo: 12500, voce: CORSI },
  ]
  const lettura = (r) => prova(() => m.creaSegreteriaSupabase({ rpc: async (nome) => (nome === 'incassi_vecchio_programma' ? r : { data: null, error: { message: 'rpc inattesa ' + nome } }) }).pagatoPrima())
  ok('il database ce l\'ha: gli incassi, personaId vuoto se non collegato, nessun «manca»', await lettura({ data: giusto, error: null }), {
    elenco: [{ personaId: 'p1', data: '2026-09-28', importo: 5000, voce: QUOTA }, { personaId: null, data: '2026-09-29', importo: 12500, voce: CORSI }],
  })
  ok('il database non ce l\'ha (funzione assente): elenco vuoto e manca, non «nessuno»', await lettura({ data: null, error: sbagliato }), { elenco: [], manca: true })
  const altro = String(await lettura({ data: null, error: { code: '42501', message: 'permission denied for function incassi_vecchio_programma' } }))
  ok('un altro errore non è «manca»: si dice a parole, senza il testo grezzo', [altro.startsWith('ERRORE:'), /is not a function|permission denied/.test(altro)], [true, false])
}

console.log('\n7. la modalità prova ha dati inventati: una persona con storico in stagione e quota da pagare')
{
  const s = await prova(() => m.creaSegreteriaProva())
  const l = await prova(() => s.pagatoPrima())
  ok('la lettura c\'è e non manca', [Array.isArray(l.elenco), l.manca], [true, undefined])
  const elenco = l.elenco ?? []
  const persone = await prova(() => s.persone())
  const g = await gruppi(persone, elenco)
  ok('c\'è almeno una persona da segnare, nel gruppo quota', Array.isArray(g.quota) && g.quota.length >= 1, true)
  const [r] = g.quota ?? []
  const p = persone.find?.((x) => x.id === r?.personaId)
  ok('è attiva e la sua quota è da pagare (non pagata, non in parte)', [p?.attiva, p && m.pagamentoDi(p, OGGI).come], [true, 'da_pagare'])
  const adesso = m.stagioneDi(new Date().toISOString().slice(0, 10))
  ok('gli incassi sono tutti nella stagione di oggi', elenco.every((i) => i.data >= adesso.dal && i.data <= adesso.al), true)
  ok('ce n\'è anche uno da guardare a mano (sotto 50 € o solo corsi) e uno non collegato, per vedere il filtro per intero', [g.daGuardare?.length >= 1, g.nonCollegati >= 1], [true, true])
  // Segnarla davvero, con la segreteria di prova: la stessa riga esce dal filtro.
  if (r) {
    const e = await prova(() => m.segnaPagatoPrima(s, [{ id: r.personaId, nome: p.nome, cognome: p.cognome }]))
    const dopo = await gruppi(await s.persone(), elenco)
    ok('segnata in blocco con la segreteria di prova: riuscita, ed esce dal filtro', [e.riusciti, ids(dopo, 'quota').includes(r.personaId)], [[r.personaId], false])
  }
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
