// ---------------------------------------------------------------------------
// Il legame fra i corsi (CORSI) e le voci del listino (LISTINO), senza browser.
//
//   node scripts/prova-listino.mjs
//
// Il legame è per id del corso (`corsoId` sulla voce): un corso rinominato
// tiene il suo prezzo. Il listino resta un json nelle impostazioni, quindi il
// controllo sta tutto in `src/lib/listino.ts`, non nel database.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/listino'; export { vociDelCorso, vociPronte } from './src/lib/ricevute'; export { stimaIscrizione } from './src/lib/nucleo'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che manca o che scoppia deve far rosso quel caso, non fermare tutto.
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}
const errore = async (f) => {
  try {
    await f()
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}

const GIORNO = '2026-10-02'
const voce = (corso, corsoId, prezzi = [{ annuale: 400, trimestre: 150 }]) => ({ corso, corsoId, eta: '', orari: [], prezzi })
const lista = (...corsi) => ({ quota: 50, saldoEntro: '2026-08-31', corsi, offerte: [] })
const prezziDi = (l, corso) => m.vociDelCorso(corso, GIORNO, l).map((v) => v.voce(GIORNO).prezzo)

const judo3 = { id: 'c-judo3', nome: 'Judo 3', attivo: true }
const lotta = { id: 'c-lotta', nome: 'Lotta 3', attivo: true }
const pa = { id: 'c-pa', nome: 'Preparazione atletica', attivo: true }
const L = lista(voce('Judo 3', 'c-judo3'))

console.log('1. il corso rinominato tiene il suo prezzo')
{
  const nuovo = { ...judo3, nome: 'Judo 3 ragazzi' }
  ok('la voce si trova dall’id', prova(() => m.voceDelCorso(L.corsi, nuovo)?.corso), 'Judo 3')
  ok('la ricevuta propone ancora i suoi prezzi', prova(() => prezziDi(L, nuovo)), [40000, 15000])
  ok('la ricevuta dice il nome nuovo, anche se il listino non è stato risalvato', prova(() => m.vociDelCorso(nuovo, GIORNO, m.listinoUsabile(L, [nuovo]))[0].voce(GIORNO).descrizione), 'Annuale Judo 3 ragazzi'),
  ok('chi legge il listino vede il nome nuovo, e il corso che non si vede resta com’è', prova(() => m.conNomiDi(lista(voce('Judo 3', 'c-judo3'), voce('Lotta 3', 'c-lotta')), [nuovo]).corsi.map((v) => v.corso)), ['Judo 3 ragazzi', 'Lotta 3'])
  ok('un corso con un altro id e lo stesso nome vecchio non li prende', prova(() => prezziDi(L, { id: 'altro', nome: 'Judo 3' })), [])
  ok('il modulo mostra il corso rinominato con la sua riga (età dal listino)', prova(() => m.corsiPerEta([nuovo], [{ ...L.corsi[0], eta: 'dai 8 anni' }], '').adatti.map((c) => [c.nome, c.riga ?? null, c.prezzoDaConfermare ?? false])), [['Judo 3 ragazzi', 'dai 8 anni', false]])
  ok('la stima lo conta, non è senza prezzo', prova(() => m.stimaIscrizione({ chi: 'A', corsi: [nuovo], formula: 'annuale' }, [], GIORNO, L).senzaPrezzo), [])
}

console.log('\n2. due voci sullo stesso corso non si salvano')
{
  const doppio = lista(voce('Judo 3', 'c-judo3'), voce('Judo 3 bis', 'c-judo3'))
  const guaio = String(prova(() => m.cosaNonVaListino(doppio, [judo3])))
  ok('il messaggio dice quale corso e cosa fare', [guaio.includes('Judo 3'), /una sola|una voce sola|unisci|togli/i.test(guaio)], [true, true])
  ok('voci su corsi diversi vanno', prova(() => m.cosaNonVaListino(lista(voce('Judo 3', 'c-judo3'), voce('Lotta 3', 'c-lotta')), [judo3, lotta])), null)
  ok('le voci vecchie senza id restano come oggi', prova(() => m.cosaNonVaListino(lista(voce('Judo 3'), voce('Lotta 3')), [judo3, lotta])), null)
}

console.log('\n3. l’elenco di scelta non ha i corsi già usati')
{
  const corsi = [judo3, lotta, pa]
  const voci = [voce('Judo 3', 'c-judo3')]
  ok('Judo 3 non c’è più', prova(() => m.corsiScegliibili(corsi, voci).map((c) => c.id)), ['c-lotta', 'c-pa'])
  ok('nella sua stessa voce resta', prova(() => m.corsiScegliibili(corsi, voci, 'c-judo3').map((c) => c.id)), ['c-judo3', 'c-lotta', 'c-pa'])
}

console.log('\n4. i segnali del listino')
{
  const corsi = [judo3, lotta, { id: 'c-x', nome: 'Orfano', attivo: true }]
  const l = lista(voce('Judo 3', 'c-judo3'), voce('Voce sola'))
  const s = prova(() => m.segnalazioniListino(l, corsi))
  ok('un corso attivo senza voce è «senza prezzo»', s.senzaPrezzo, ['Lotta 3', 'Orfano'])
  ok('una voce senza corso è «senza corso»', s.senzaCorso, ['Voce sola'])
  ok('il corso senza prezzo resta scegliibile, «da confermare»', prova(() => m.corsiPerEta([judo3, lotta], l.corsi, '').adatti.map((c) => [c.nome, c.prezzoDaConfermare ?? false])), [['Judo 3', false], ['Lotta 3', true]])
  ok('la stima lo mette in senzaPrezzo', prova(() => m.stimaIscrizione({ chi: 'A', corsi: [lotta], formula: 'annuale' }, [], GIORNO, l).senzaPrezzo), ['Lotta 3'])
  const va = { ...l, senzaPrezzoVaBene: ['c-lotta'] }
  ok('«senza prezzo, va bene così» spegne il rosso di quel corso', prova(() => m.segnalazioniListino(va, corsi).senzaPrezzo), ['Orfano'])
  ok('e il modulo lo lascia scegliere lo stesso', prova(() => m.corsiPerEta([lotta], va.corsi, '').adatti.map((c) => c.nome)), ['Lotta 3'])
  ok('il segno si tiene a salvare e rileggere', prova(() => m.listinoDa(JSON.parse(JSON.stringify(va))).senzaPrezzoVaBene), ['c-lotta'])
  ok('e un listino senza il segno non ne inventa', prova(() => m.listinoDa(JSON.parse(JSON.stringify(l))).senzaPrezzoVaBene ?? null), null)
}

console.log('\n5. il listino vecchio, solo col nome')
{
  const vecchio = lista(voce('Judo 3'), voce('lotta  3'), voce('Zumba'))
  delete vecchio.corsi[0].corsoId
  delete vecchio.corsi[1].corsoId
  delete vecchio.corsi[2].corsoId
  const letto = prova(() => m.listinoDa(JSON.parse(JSON.stringify(vecchio))))
  ok('si legge e le ricevute trovano i prezzi per nome', prova(() => prezziDi(letto, 'Judo 3')), [40000, 15000])
  ok('anche col corso intero', prova(() => prezziDi(letto, judo3)), [40000, 15000])
  ok('il modulo lo trova per nome', prova(() => m.corsiPerEta([judo3], letto.corsi, '').adatti.map((c) => c.prezzoDaConfermare ?? false)), [false])
  ok('la stima uguale a prima', prova(() => m.stimaIscrizione({ chi: 'A', corsi: ['Judo 3'], formula: 'annuale' }, [], GIORNO, letto).senzaPrezzo), [])
  const preso = JSON.stringify(letto)
  const agganciato = prova(() => m.agganciaPerNome(letto, [judo3, lotta]))
  ok('l’aggancio dà l’id alle voci che coincidono (anche con altre maiuscole e spazi)', prova(() => agganciato.corsi.map((c) => c.corsoId ?? null)), ['c-judo3', 'c-lotta', null])
  ok('non cambia il listino che gli si dà', JSON.stringify(letto), preso)
  const dubbi = prova(() => m.agganciaPerNome(lista(voce('Judo 3'), voce('judo 3')), [judo3]).corsi.map((c) => c.corsoId ?? null))
  ok('due voci per lo stesso corso: restano senza corso', dubbi, [null, null])
  const dueCorsi = prova(() => m.agganciaPerNome(lista(voce('Judo 3')), [judo3, { id: 'c-j3b', nome: 'JUDO 3', attivo: true }]).corsi.map((c) => c.corsoId ?? null))
  ok('due corsi con lo stesso nome: resta senza corso', dueCorsi, [null])
  ok('chi ha già l’id non si tocca', prova(() => m.agganciaPerNome(lista(voce('Judo 3', 'c-lotta')), [judo3, lotta]).corsi[0].corsoId), 'c-lotta')
  ok('le dubbie sono «senza corso» e si agganciano a mano', prova(() => m.segnalazioniListino(agganciato, [judo3, lotta]).senzaCorso), ['Zumba'])
}

console.log('\n6. un corso tolto o archiviato')
{
  const l = lista(voce('Judo 3', 'c-judo3'), voce('Lotta 3', 'c-lotta'))
  const archiviato = { ...lotta, attivo: false }
  ok('tolto da CORSI: la voce è segnalata', prova(() => m.segnalazioniListino(l, [lotta]).tolti), ['Judo 3'])
  ok('e non propone prezzi sulle ricevute', prova(() => prezziDi(m.listinoUsabile(l, [lotta]), 'Judo 3')), [])
  ok('nemmeno fra tutte le voci del listino', prova(() => m.vociPronte([], GIORNO, m.listinoUsabile(l, [lotta])).map((v) => v.chiave.split('~')[0])), ['quota', 'Lotta 3', 'Lotta 3'])
  ok('archiviato: la voce non è segnalata', prova(() => m.segnalazioniListino(l, [judo3, archiviato])), { senzaPrezzo: [], senzaCorso: [], tolti: [] })
  ok('un corso archiviato senza voce non è «senza prezzo»', prova(() => m.segnalazioniListino(lista(voce('Judo 3', 'c-judo3')), [judo3, archiviato]).senzaPrezzo), [])
}

console.log('\n7. le ricevute già emesse non cambiano')
{
  const l = lista(voce('Judo 3', 'c-judo3'))
  const emessa = (corso) => prova(() => JSON.stringify(m.vociDelCorso(corso, GIORNO, l).map((v) => v.voce(GIORNO))))
  const prima = emessa(judo3)
  prova(() => m.agganciaPerNome(l, [{ ...judo3, nome: 'Judo 3 ragazzi' }]))
  const dopo = emessa({ ...judo3, nome: 'Judo 3 ragazzi' })
  ok('le voci della ricevuta dicono «Annuale Judo 3»', prima.includes('Annuale Judo 3'), true)
  ok('la descrizione resta quella scritta nel listino, non il nome nuovo del corso', dopo, prima)
}

console.log('\n8. in prova: rinominare il corso, il prezzo lo segue')
{
  const s = m.creaSegreteriaProva()
  const prendi = async (id) => (await s.corsi()).find((c) => c.id === id)
  const judo = await prendi('judo-3')
  const vecchio = { corso: 'Judo 3', eta: '', orari: [], prezzi: [{ annuale: 400 }] }
  await s.salvaListino(lista(vecchio))
  const letto = async () => (await s.listino()).listino
  ok('al primo salvataggio la voce si aggancia da sé per nome', await (async () => (await letto()).corsi[0].corsoId)().catch((e) => `ERRORE: ${e.message}`), 'judo-3')
  await s.salvaCorso({ id: 'judo-3', nome: 'Judo 3 ragazzi', istruttori: judo.istruttori.map((i) => i.id), salaId: judo.salaId, capienza: judo.capienza, colore: judo.colore })
  const rinominato = await prendi('judo-3')
  ok('il corso ha il nome nuovo', rinominato.nome, 'Judo 3 ragazzi')
  const l = await letto()
  ok('e il prezzo del corso rinominato è quello di prima', prova(() => prezziDi(l, rinominato)), [40000])
  ok('due voci sullo stesso corso: il salvataggio rifiuta', (await errore(() => s.salvaListino(lista(voce('Judo 3', 'judo-3'), voce('Altra', 'judo-3'))))) !== 'nessun errore', true)
  ok('e il listino salvato resta com’era', (await letto()).corsi.length, 1)
}

console.log('\n9. più righe di prezzo per corso')
{
  const l = lista({ corso: 'Preparazione atletica', corsoId: 'c-pa', eta: '', orari: [], prezzi: [{ etichetta: '1 GIORNO', annuale: 300, trimestre: 110 }, { etichetta: '2 GIORNI', annuale: 450, trimestre: 160 }] })
  ok('il listino con due righe va', prova(() => m.cosaNonVaListino(l, [pa])), null)
  ok('le righe restano tutte', prova(() => prezziDi(l, pa)), [30000, 11000, 45000, 16000])
  ok('riletto dal database tiene id e righe', prova(() => m.listinoDa(JSON.parse(JSON.stringify(l))).corsi.map((c) => [c.corsoId, c.prezzi.length])), [['c-pa', 2]])
  const a = (corso) => m.stimaIscrizione({ chi: 'A', corsi: [corso], formula: 'annuale' }, [], GIORNO, l)
  ok('la stima è quella di prima, per nome o per corso', prova(() => [a('Preparazione atletica').totale, a(pa).totale]), [5000 + 30000, 5000 + 30000])
}

console.log('\n10. una sola funzione trova la voce di un corso')
{
  const voci = [voce('Judo 3', 'c-judo3'), voce('Lotta 3')]
  ok('per id', prova(() => m.voceDelCorso(voci, { id: 'c-judo3', nome: 'altro nome' })?.corso), 'Judo 3')
  ok('per nome, se la voce non ha id', prova(() => m.voceDelCorso(voci, { id: 'c-lotta', nome: ' LOTTA 3 ' })?.corso), 'Lotta 3')
  ok('l’id vince sul nome', prova(() => m.voceDelCorso([voce('Judo 3', 'altro'), voce('X', 'c-judo3')], judo3)?.corso), 'X')
  ok('senza voce, niente', prova(() => m.voceDelCorso(voci, { id: 'zz', nome: 'Zumba' }) ?? null), null)
}

console.log('\n5. l’età minima di un corso («dai N anni»)')
{
  const OGGI = new Date(2026, 9, 6, 12, 0)
  const ora = ['lunedì, mercoledì e venerdì 18.00-19.00']
  const pesistica = { ...voce('Pesistica 1', 'c-pes'), etaMinima: 16, orari: ora }
  const judoPiccoli = { ...voce('Judo piccoli', 'c-jp'), natiDal: 2017, natiAl: 2019 }
  const preparazione = { ...voce('Preparazione atletica 2', 'c-pa2'), etaMinima: 14 }
  const libero = voce('Zumba', 'c-zu')
  const corsi = [{ id: 'c-pes', nome: 'Pesistica 1' }, { id: 'c-jp', nome: 'Judo piccoli' }, { id: 'c-pa2', nome: 'Preparazione atletica 2' }, { id: 'c-zu', nome: 'Zumba' }]
  const voci = [pesistica, judoPiccoli, preparazione, libero]
  const dove = (natoIl, v = voci, c = corsi) => prova(() => {
    const r = m.corsiPerEta(c, v, natoIl, [], OGGI)
    const n = (x) => x.map((y) => y.nome)
    return { adatti: n(r.adatti), senzaAnni: n(r.senzaAnni), altri: n(r.altri), nascosti: r.nascosti }
  })

  const base = lista(voce('Judo 3', 'c-judo3'))
  for (const [cosa, x] of [['16', 16], ['1', 1], ['99', 99]])
    ok(`l’età minima ${cosa} si tiene`, prova(() => m.listinoDa({ ...base, corsi: [{ ...base.corsi[0], etaMinima: x }] }).corsi[0].etaMinima), x)
  for (const [cosa, x] of [['zero', 0], ['100', 100], ['negativa', -3], ['con la virgola', 16.5], ['una stringa', '16'], ['NaN', NaN], ['null', null]])
    ok(`l’età minima ${cosa} si butta, in silenzio`, prova(() => 'etaMinima' in m.listinoDa({ ...base, corsi: [{ ...base.corsi[0], etaMinima: x }] }).corsi[0]), false)
  ok('un listino vecchio senza il campo resta com’è', prova(() => m.listinoDa(base).corsi[0]), { corso: 'Judo 3', corsoId: 'c-judo3', eta: '', orari: [], prezzi: [{ annuale: 400, trimestre: 150 }] })
  ok('l’età minima sopravvive a salvataggio e lettura', prova(() => m.listinoDa(JSON.parse(JSON.stringify({ ...base, corsi: [{ ...base.corsi[0], etaMinima: 16 }] }))).corsi[0].etaMinima), 16)
  ok('un listino con l’età minima si salva', prova(() => m.cosaNonVaListino({ ...base, corsi: [{ ...base.corsi[0], etaMinima: 16 }] }, [judo3])), null)

  ok('16 anni compiuti oggi: Pesistica è fra gli adatti', dove('2010-10-06'), { adatti: ['Pesistica 1', 'Preparazione atletica 2'], senzaAnni: ['Zumba'], altri: ['Judo piccoli'], nascosti: [] })
  ok('15 anni, il compleanno è domani: Pesistica non compare', dove('2010-10-07'), { adatti: ['Preparazione atletica 2'], senzaAnni: ['Zumba'], altri: ['Judo piccoli'], nascosti: ['Pesistica 1'] })
  ok('nato nel 2018: i corsi per grandi non compaiono in nessuna lista, i nomi in ordine del listino', dove('2018-05-10'), { adatti: ['Judo piccoli'], senzaAnni: ['Zumba'], altri: [], nascosti: ['Pesistica 1', 'Preparazione atletica 2'] })
  ok('un adulto vede tutto, niente nascosto', dove('1985-01-01').nascosti, [])
  ok('un corso con l’età minima e senza anni di nascita è «adatto», non «senza anni»', dove('1985-01-01').adatti, ['Pesistica 1', 'Preparazione atletica 2'])
  ok('età minima e anni di nascita: valgono tutti e due (età giusta, anno sbagliato: negli altri)', dove('2005-03-03', [{ ...pesistica, natiDal: 2009, natiAl: 2010 }], [corsi[0]]), { adatti: [], senzaAnni: [], altri: ['Pesistica 1'], nascosti: [] })
  ok('età minima e anni di nascita: età giusta e anno giusto, adatto', dove('2009-03-03', [{ ...pesistica, natiDal: 2009, natiAl: 2010 }], [corsi[0]]), { adatti: ['Pesistica 1'], senzaAnni: [], altri: [], nascosti: [] })
  ok('età minima e anni di nascita: troppo piccolo, nascosto anche se l’anno andrebbe', dove('2012-03-03', [{ ...pesistica, natiDal: 2009, natiAl: 2012 }], [corsi[0]]), { adatti: [], senzaAnni: [], altri: [], nascosti: ['Pesistica 1'] })
  for (const [cosa, d] of [['vuota', ''], ['che non è una data', 'ieri'], ['dell’anno 2', '0002-03-01']])
    ok(`data ${cosa}: un elenco solo, niente nascosto`, dove(d), { adatti: ['Pesistica 1', 'Judo piccoli', 'Preparazione atletica 2', 'Zumba'], senzaAnni: [], altri: [], nascosti: [] })
  ok('un corso senza voce non ha età minima: compare', dove('2018-05-10', [], [{ id: 'x', nome: 'Nuovo' }]), { adatti: [], senzaAnni: ['Nuovo'], altri: [], nascosti: [] })

  const riga = (v, natoIl = '1985-01-01') => prova(() => m.corsiPerEta([corsi[0]], [v], natoIl, [], OGGI).adatti[0].riga)
  ok('la riga comincia con «dai N anni», poi gli orari', riga(pesistica), 'dai 16 anni · lunedì, mercoledì e venerdì 18.00-19.00')
  ok('«dai N anni» anche senza orari', riga({ ...pesistica, orari: [] }), 'dai 16 anni')
  ok('se la voce ha già il testo dell’età, resta quello', riga({ ...pesistica, eta: 'ragazzi e adulti' }), 'ragazzi e adulti · lunedì, mercoledì e venerdì 18.00-19.00')
}


// Un corso già scelto che l'età (corretta dopo) nasconde non parte con la richiesta.
{
  const OGGI = new Date(2026, 9, 6, 12, 0)
  const corsi = [{ id: 'c-pes', nome: 'Pesistica 1' }, { id: 'c-zu', nome: 'Zumba' }]
  const voci = [{ ...voce('Pesistica 1', 'c-pes'), etaMinima: 16 }, voce('Zumba', 'c-zu')]
  ok('corsi scelti: un bambino perde il corso per grandi', prova(() => m.corsiAmmessi(['c-pes', 'c-zu'], corsi, voci, '2016-04-12', OGGI)), ['c-zu'])
  ok('corsi scelti: un adulto li tiene tutti', prova(() => m.corsiAmmessi(['c-pes', 'c-zu'], corsi, voci, '1984-05-05', OGGI)), ['c-pes', 'c-zu'])
  ok('corsi scelti: senza data vera non si toglie niente', prova(() => m.corsiAmmessi(['c-pes', 'c-zu'], corsi, voci, '', OGGI)), ['c-pes', 'c-zu'])
}

if (guai) {
  console.log(`\n${guai} cose non tornano`)
  process.exit(1)
}
console.log('\nTutto a posto')
