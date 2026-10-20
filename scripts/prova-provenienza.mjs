// ---------------------------------------------------------------------------
// Da dove arrivano le richieste di iscrizione, senza browser.
//
//   node scripts/prova-provenienza.mjs
//
// `src/lib/provenienza.ts`: l'etichetta del link (`?da=`), letta dall'indirizzo
// con cui si è aperta la pagina e mai salvata sul telefono, pulita come la
// pulisce `73-provenienza-richieste.sql` (provato da
// `supabase/prova/provenienza-richieste.sql`); «come ci hai conosciuto», una
// volta per modulo; i nomi leggibili della segreteria; i conti del riquadro DA
// DOVE ARRIVANO LE RICHIESTE di STATISTICHE, per persona e per corso.
// Design: docs/design-canvas/provenienza-richieste/.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/provenienza'; export { conLaProvenienza, conIlConosciuto, conosciutoDelModulo } from './src/lib/passiIscrizione'; export { creaSegreteriaSupabase } from './src/lib/segreteriaSupabase'",
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

const memoria = new Map()
const sessione = new Map()
const deposito = (m) => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) })
globalThis.localStorage = deposito(memoria)
globalThis.sessionStorage = deposito(sessione)
globalThis.document = { cookie: '' }
globalThis.window = { location: { search: '?da=home', hash: '' }, addEventListener() {} }

const m = await import(modulo)
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const vedi = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

console.log('\n1. l\'etichetta del link: pulita come nel database, o niente')
{
  const p = (x) => vedi(() => m.pulisciProvenienza(x)) ?? '—'
  ok('dalla pagina di un corso', p('corso-karate'), 'corso-karate')
  ok('spazi ai lati e maiuscole: puliti', p('  Instagram '), 'instagram')
  ok('90 caratteri vanno', p('a'.repeat(90)), 'a'.repeat(90))
  ok('91 no', p('a'.repeat(91)), '—')
  ok('un pezzo di codice no', p('<script>alert(1)</script>'), '—')
  ok('una barra no', p('a/b'), '—')
  ok('una formula da foglio di calcolo no', p('=1+1'), '—')
  ok('vuota no', p(''), '—')
  ok('uno spazio in mezzo no', p('volantino ottobre'), '—')
  ok('due trattini di fila no', p('volantino--ottobre'), '—')
  ok('un trattino in fondo no', p('volantino-'), '—')
  ok('un numero no', p(12), '—')
  ok('un elenco no', p(['home']), '—')
  ok('niente no', p(undefined), '—')
  ok('cifre e trattini sì', p('volantino-2026'), 'volantino-2026')
}

console.log('\n2. «come ci hai conosciuto»: otto scelte, in quest\'ordine, e niente testo libero')
{
  ok('le scelte, coi nomi del modulo', (m.CONOSCIUTO ?? []).map((x) => x.nome), ['Amici o parenti', 'Sito', 'Instagram', 'Facebook', 'Google', 'Volantino', 'Passando davanti', 'Altro'])
  ok('le chiavi, quelle del database', (m.CONOSCIUTO ?? []).map((x) => x.chiave), ['amici-parenti', 'sito', 'instagram', 'facebook', 'google', 'volantino', 'passando-davanti', 'altro'])
  ok('la domanda, da soli', vedi(() => m.domandaConosciuto(false)), 'COME CI HAI CONOSCIUTO? · FACOLTATIVA')
  ok('la domanda, in famiglia', vedi(() => m.domandaConosciuto(true)), 'COME CI AVETE CONOSCIUTO? · FACOLTATIVA')
  ok('la prima voce, vuota', m.SCEGLI_SE_VUOI, 'Scegli, se vuoi')
  const c = (x) => vedi(() => m.pulisciConosciuto(x)) ?? '—'
  ok('Instagram', c('instagram'), 'instagram')
  ok('con gli spazi e le maiuscole', c(' Passando-Davanti '), 'passando-davanti')
  ok('una scelta inventata si scarta', c('tiktok'), '—')
  ok('un testo libero si scarta', c("me l'ha detto Mario"), '—')
  ok('vuota: non ha risposto', c(''), '—')
  ok('un numero si scarta', c(3), '—')
}

console.log('\n3. l\'etichetta si legge dall\'indirizzo della visita, e non resta sul telefono')
{
  const d = (s) => vedi(() => m.provenienzaDaIndirizzo(s)) ?? '—'
  ok('?da=home', d('?da=home'), 'home')
  ok('con la modalità prova accanto', d('?prova=1&da=corso-karate'), 'corso-karate')
  ok('scritta con lo spazio codificato e le maiuscole', d('?da=Volantino%20'), 'volantino')
  ok('due etichette: vale la prima', d('?da=home&da=volantino'), 'home')
  ok('sbagliata: niente', d('?da=a/b'), '—')
  ok('senza etichetta: niente', d(''), '—')
  ok('la visita aperta con ?da=home', vedi(() => m.provenienzaDellaVisita()) ?? '—', 'home')
  // Passando da #prezzi e da «compila» la pagina cambia solo il cancelletto (o si ricarica con la stessa query):
  // l'etichetta si rilegge ogni volta dall'indirizzo, senza tenerla da nessuna parte.
  window.location.hash = '#prezzi'
  ok('passando da #prezzi resta', vedi(() => m.provenienzaDellaVisita()) ?? '—', 'home')
  window.location.search = '?da=volantino'
  ok('si legge dall\'indirizzo di adesso, niente copie tenute in memoria', vedi(() => m.provenienzaDellaVisita()) ?? '—', 'volantino')
  window.location.search = '?da=home'
  ok('niente in localStorage', [...memoria.keys()], [])
  ok('niente in sessionStorage', [...sessione.keys()], [])
  ok('niente cookie', document.cookie, '')
}

console.log('\n4. la richiesta: dal modulo l\'etichetta della visita, dall\'area iscritti «area-iscritti» e nessuna domanda')
{
  ok('dal modulo pubblico', vedi(() => m.origineDellaRichiesta(false, 'instagram')), { provenienza: 'home', conosciuto: 'instagram' })
  ok('dal modulo pubblico senza risposta', vedi(() => m.origineDellaRichiesta(false, '')), { provenienza: 'home' })
  ok('dall\'area iscritti: la sua etichetta, e la risposta non c\'è', vedi(() => m.origineDellaRichiesta(true, 'instagram')), { provenienza: 'area-iscritti' })
  // Una famiglia di tre: la stessa etichetta e la stessa risposta in tutte e tre le richieste.
  const persone = [0, 1, 2].map((i) => ({ risposte: { nome: `P${i}`, note: '' } }))
  ok('nessuna risposta: non c\'è in nessuno', vedi(() => m.conIlConosciuto(persone, undefined).map((p) => 'conosciuto' in p.risposte)), [false, false, false])
  const conRisposta = vedi(() => m.conIlConosciuto(persone, 'amici-parenti'))
  ok('la risposta sta nella persona 0 e in nessun\'altra', Array.isArray(conRisposta) ? conRisposta.map((p) => p.risposte.conosciuto ?? '—') : conRisposta, ['amici-parenti', '—', '—'])
  ok('si rilegge uguale', vedi(() => m.conosciutoDelModulo(conRisposta)), 'amici-parenti')
  const daMandare = [0, 1, 2].map((i) => ({ dati: { nome: `P${i}`, conosciuto: i === 2 ? 'sito' : undefined }, file: {} }))
  const pronte = vedi(() => m.conLaProvenienza(daMandare, { provenienza: 'home', conosciuto: 'amici-parenti' }))
  ok('famiglia di tre: la stessa etichetta in tutte', Array.isArray(pronte) ? pronte.map((x) => x.dati.provenienza) : pronte, ['home', 'home', 'home'])
  ok('famiglia di tre: la stessa risposta in tutte (una vecchia di un\'altra persona non parte)', Array.isArray(pronte) ? pronte.map((x) => x.dati.conosciuto) : pronte, ['amici-parenti', 'amici-parenti', 'amici-parenti'])
  const senza = vedi(() => m.conLaProvenienza(daMandare, {}))
  ok('senza etichetta né risposta: niente in nessuna', Array.isArray(senza) ? senza.map((x) => [x.dati.provenienza ?? '—', x.dati.conosciuto ?? '—']) : senza, [['—', '—'], ['—', '—'], ['—', '—']])
}

console.log('\n5. le etichette dei link: il sito, la segreteria')
{
  ok('la Home', vedi(() => m.etichettaPagina('home', false)), 'home')
  ok('la pagina di un corso', vedi(() => m.etichettaPagina('karate', true)), 'corso-karate')
  ok('un\'altra pagina', vedi(() => m.etichettaPagina('orari', false)), 'orari')
  const ISCRIZIONI = 'https://app.officinedellosport.it/iscrizioni/'
  ok('COPIA LINK ISCRIZIONI porta ?da=segreteria', vedi(() => m.linkDellaSegreteria(ISCRIZIONI)), `${ISCRIZIONI}?da=segreteria`)
  ok('con un\'altra query: in coda', vedi(() => m.conProvenienza(`${ISCRIZIONI}?prova=1`, 'segreteria')), `${ISCRIZIONI}?prova=1&da=segreteria`)
  ok('col cancelletto: prima del cancelletto', vedi(() => m.conProvenienza(`${ISCRIZIONI}#prezzi`, 'home')), `${ISCRIZIONI}?da=home#prezzi`)
  ok('un ?da= c\'è già: resta quello', vedi(() => m.conProvenienza(`${ISCRIZIONI}?da=volantino`, 'home')), `${ISCRIZIONI}?da=volantino`)
}

console.log('\n6. i nomi leggibili, per la segreteria')
{
  const titoli = vedi(() => m.titoliDelSito([{ slug: 'karate', titolo: 'Karate ragazzi' }, { slug: 'orari', titolo: 'Orari' }, { slug: 'home', titolo: 'Home' }], [{ da: 'karate-bimbi', a: 'karate' }]))
  ok('i titoli del sito, anche dai vecchi indirizzi', titoli, { karate: 'Karate ragazzi', orari: 'Orari', home: 'Home', 'karate-bimbi': 'Karate ragazzi' })
  const n = (e) => vedi(() => m.nomeProvenienza(e, typeof titoli === 'object' ? titoli : {}))
  ok('home', n('home'), 'Home del sito')
  ok('la segreteria', n('segreteria'), 'Link della segreteria')
  ok('l\'area iscritti', n('area-iscritti'), 'Area iscritti')
  ok('un corso: il titolo della sua pagina', n('corso-karate'), 'Karate ragazzi')
  ok('un corso che ha cambiato indirizzo: lo stesso titolo', n('corso-karate-bimbi'), 'Karate ragazzi')
  ok('una pagina: il suo titolo', n('orari'), 'Orari')
  ok('un\'etichetta che il sito non conosce: com\'è', n('volantino-ottobre'), 'volantino-ottobre')
  ok('un corso che non c\'è più: com\'è', n('corso-scherma'), 'corso-scherma')
  ok('senza etichetta', n(undefined), 'Non si sa')
  ok('come ci ha conosciuto', vedi(() => m.nomeConosciuto('amici-parenti')), 'Amici o parenti')
  ok('non ha risposto', vedi(() => m.nomeConosciuto(undefined)), 'Non si sa')
}

console.log('\n7. i conti del riquadro: per persona, arrivate nel periodo e come stanno oggi')
{
  const K = 'karate'
  const J = 'judo'
  const righe = [
    { provenienza: 'home', conosciuto: 'instagram', corsi: [K], stato: 'nuova', n: 1 },
    { provenienza: 'home', conosciuto: null, corsi: [J], stato: 'accolta', n: 1 },
    { provenienza: 'instagram', conosciuto: 'amici-parenti', corsi: [K, J], stato: 'rifiutata', n: 1 },
    { provenienza: null, conosciuto: null, corsi: [K], stato: 'nuova', n: 3 },
  ]
  const titoli = { karate: 'Karate ragazzi', 'karate-bimbi': 'Karate ragazzi' }
  const conta = (r, corso = '') => vedi(() => m.contaDaDove(r, corso, titoli))
  const riga = (x) => [x.nome, x.arrivate, x.accolte, x.rifiutate, x.nonSiSa]
  const tutti = conta(righe)
  ok('ARRIVATE DA: home 2/1/0, instagram 1/0/1, NON SI SA 3/0/0 in fondo', tutti.arrivateDa?.map(riga), [
    ['Home del sito', 2, 1, 0, false],
    ['instagram', 1, 0, 1, false],
    ['Non si sa', 3, 0, 0, true],
  ])
  ok('COME CI HANNO CONOSCIUTO: NON SI SA in fondo', tutti.conosciuto?.map(riga), [
    ['Amici o parenti', 1, 0, 1, false],
    ['Instagram', 1, 0, 0, false],
    ['Non si sa', 4, 1, 0, true],
  ])
  ok('In tutto', tutti.totale, { arrivate: 6, accolte: 1, rifiutate: 1 })
  const karate = conta(righe, K)
  ok('col filtro Karate: chi chiede due corsi conta anche qui', karate.arrivateDa?.map(riga), [
    ['Home del sito', 1, 0, 0, false],
    ['instagram', 1, 0, 1, false],
    ['Non si sa', 3, 0, 0, true],
  ])
  ok('col filtro Karate: in tutto 5', karate.totale, { arrivate: 5, accolte: 0, rifiutate: 1 })
  const judo = conta(righe, J)
  ok('col filtro Judo: home 1 accolta e instagram, niente NON SI SA', judo.arrivateDa?.map(riga), [
    ['Home del sito', 1, 1, 0, false],
    ['instagram', 1, 0, 1, false],
  ])
  ok('un corso che non ha cambiato nome ma indirizzo non si spezza: una riga sola',
    conta([{ provenienza: 'corso-karate', conosciuto: null, corsi: [K], stato: 'nuova', n: 2 }, { provenienza: 'corso-karate-bimbi', conosciuto: null, corsi: [K], stato: 'accolta', n: 1 }]).arrivateDa?.map(riga),
    [['Karate ragazzi', 3, 1, 0, false]])
  ok('niente richieste: elenchi vuoti', [conta([]).arrivateDa, conta([]).conosciuto, conta([]).totale], [[], [], { arrivate: 0, accolte: 0, rifiutate: 0 }])
  ok('a pari numero, in ordine di nome', conta([
    { provenienza: 'volantino', conosciuto: 'sito', corsi: [K], stato: 'nuova', n: 1 },
    { provenienza: 'home', conosciuto: 'altro', corsi: [K], stato: 'nuova', n: 1 },
  ]).arrivateDa?.map((x) => x.nome), ['Home del sito', 'volantino'])
}

console.log('\n7b. NON SI SA resta in fondo, comunque si ordini')
{
  const voci = [
    { nome: 'Home del sito', arrivate: 2, accolte: 1, rifiutate: 0, nonSiSa: false },
    { nome: 'Non si sa', arrivate: 9, accolte: 0, rifiutate: 0, nonSiSa: true },
    { nome: 'instagram', arrivate: 1, accolte: 0, rifiutate: 1, nonSiSa: false },
  ]
  const perArrivate = (v) => [...v].sort((a, b) => b.arrivate - a.arrivate)
  ok('ordinate per arrivate: NON SI SA, la più grande, in fondo', vedi(() => m.conNonSiSaInFondo(voci, perArrivate).map((x) => x.nome)), ['Home del sito', 'instagram', 'Non si sa'])
  ok('al contrario: sempre in fondo', vedi(() => m.conNonSiSaInFondo(voci, (v) => perArrivate(v).reverse()).map((x) => x.nome)), ['instagram', 'Home del sito', 'Non si sa'])
  ok('senza NON SI SA: com\'erano ordinate', vedi(() => m.conNonSiSaInFondo(voci.filter((x) => !x.nonSiSa), (v) => v).map((x) => x.nome)), ['Home del sito', 'instagram'])
}

console.log('\n8. le frasi del riquadro')
{
  ok('da quando si conta', vedi(() => m.fraseDaDove('2026-11-04')),
    'Si conta dal 4 novembre 2026: per persona (una famiglia di tre conta tre), arrivate nel periodo e come stanno oggi; le altre aspettano. Chi chiede due corsi conta in tutti e due col filtro per corso.')
  ok('niente ancora contato', vedi(() => m.fraseDaDove(undefined)), 'Non è ancora arrivata nessuna richiesta da contare: si comincia dalla prossima.')
  ok('niente nel periodo, ma si contava già', vedi(() => m.fraseDaDove('2026-11-04', true)), 'Nessuna richiesta in questo periodo. Si conta dal 4 novembre 2026: per persona (una famiglia di tre conta tre), arrivate nel periodo e come stanno oggi; le altre aspettano. Chi chiede due corsi conta in tutti e due col filtro per corso.')
  ok('la nota, tutti i corsi', vedi(() => m.notaDaDove(undefined)), 'le richieste arrivate nel periodo, per persona, e come stanno oggi')
  ok('la nota, un corso', vedi(() => m.notaDaDove('Judo kids')), 'le richieste che chiedono Judo kids, arrivate nel periodo, per persona, e come stanno oggi')
  ok('senza il file SQL, il riquadro dice cosa lanciare', m.MANCA_PROVENIENZA, 'Per contare da dove arrivano le richieste va lanciato 73-provenienza-richieste.sql: il resto delle statistiche funziona.')
}

console.log('\n9. la metà vera: il riquadro e i titoli, anche senza il file SQL')
{
  const finto = (rpc, tabelle = {}) => {
    const reg = []
    const catena = (t) => {
      const c = { select: () => c, order: () => c, range: () => c, then: (bene, male) => Promise.resolve(tabelle[t] ?? { data: [], error: null }).then(bene, male) }
      return c
    }
    const db = { rpc: async (nome, args) => (reg.push([nome, args]), rpc), from: (t) => catena(t), auth: { getUser: async () => ({ data: { user: null } }) } }
    return { s: m.creaSegreteriaSupabase(db), reg }
  }
  const { s, reg } = finto({ data: { dal: '2026-09-01', righe: [{ provenienza: 'home', conosciuto: null, corsi: ['k'], stato: 'nuova', n: 2 }] }, error: null })
  const d = await vedi(() => s.richiesteDaDove(new Date(2026, 8, 1), new Date(2026, 8, 26)))
  ok('chiede richieste_da_dove coi due giorni', reg[0], ['richieste_da_dove', { da: '2026-09-01', a: '2026-09-26' }])
  ok('e torna le righe com\'erano, senza i null', d, { dal: '2026-09-01', righe: [{ provenienza: 'home', corsi: ['k'], stato: 'nuova', n: 2 }] })
  ok('senza 73-provenienza-richieste.sql: null, e nessun errore', await vedi(() => finto({ data: null, error: { code: 'PGRST202', message: 'x' } }).s.richiesteDaDove(new Date(2026, 8, 1), new Date(2026, 8, 26))), null)
  const t = finto(null, {
    sito_pagine: { data: [{ slug: 'karate', titolo: 'Karate (bozza)', titolo_pubblicato: 'Karate ragazzi' }, { slug: 'orari', titolo: 'Orari', titolo_pubblicato: null }], error: null },
    sito_redirect: { data: [{ da: 'karate-bimbi', a: 'karate' }], error: null },
  })
  ok('i titoli: quelli che il sito mostra, e i vecchi indirizzi', await vedi(() => t.s.titoliSito()), { karate: 'Karate ragazzi', orari: 'Orari', 'karate-bimbi': 'Karate ragazzi' })
  const senzaSito = finto(null, { sito_pagine: { data: null, error: { code: 'PGRST205', message: 'x' } }, sito_redirect: { data: null, error: { code: 'PGRST205', message: 'x' } } })
  ok('senza il sito sul database: nessun titolo, nessun errore', await vedi(() => senzaSito.s.titoliSito()), {})
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
