// ---------------------------------------------------------------------------
// L'orario a tessere della pagina di un corso viene da CORSI, senza browser.
//
//   node scripts/prova-sito-orario.mjs
//
// Design: docs/design-canvas/orario-automatico/. Una pagina del sito si collega
// a uno o più corsi; le righe d'orario sono le ricorrenze di CORSI
// (`orari_aperti()`, supabase/48-orari-aperti.sql: solo corso, giorno, ora,
// durata; giorno 0 = domenica, come `getDay()`), raggruppate e ordinate
// lunedì-domenica. Nessuna riga = «Orario in arrivo», mai orari vecchi.
// Le stesse regole, sul database, le prova supabase/prova/sito-orario.sql.
//
//  1. Le righe: raggruppate, ordinate, scritte.  2. Più corsi, corsi vuoti.
//  3. Il generatore: pagina non collegata = identica a oggi.
//  4. Pagina collegata.  5. Fascia blu.  6. Database senza 68-sito-orario.sql.
//  7. Modalità prova.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'
import { createHash } from 'node:crypto'

const carica = async (file) => {
  try {
    const { outputFiles } = await build({
      entryPoints: [file], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
      define: { 'import.meta.env': '{}' },
      banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.cwd() + '/');" },
    })
    return await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
  } catch (e) {
    console.log(`  (modulo mancante: ${file} — ${String(e.message).split('\n')[0]})`)
    return {}
  }
}
const o = await carica('src/lib/sitoOrario.ts')
const g = await carica('src/lib/sitoGenera.ts')
const sp = await carica('src/lib/sitoProva.ts')
const sb = await carica('src/lib/segreteriaSupabase.ts')
const ind = await carica('src/lib/indirizzoSegreteria.ts')

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = (f) => {
  try { return f() } catch (e) { return `ERRORE: ${e.message}` }
}

const A = 'cccccccc-0000-0000-0000-000000000001'
const B = 'cccccccc-0000-0000-0000-000000000002'
const C = 'cccccccc-0000-0000-0000-000000000003'
// Una ricorrenza come la dà orari_aperti(), con le chiavi in camelCase.
const r = (corsoId, giorno, ora, durataMin = 60) => ({ corsoId, giorno, ora, durataMin })
const testi = (corsi, orari) => prova(() => o.testiOrario(corsi, orari))

console.log('\n1. Le righe: raggruppate, ordinate lunedì-domenica, scritte')
ok('IN_ARRIVO è la frase del design', o.IN_ARRIVO, 'Orario in arrivo')
ok('input vuoto: nessuna riga', prova(() => o.righeOrario([])), [])
ok('input vuoto: «Orario in arrivo»', testi([A], []), ['Orario in arrivo'])
ok('lunedì e mercoledì alla stessa ora e durata: una riga', testi([A], [r(A, 1, '17:00'), r(A, 3, '17:00')]), ['Lunedì e mercoledì · 17:00–18:00'])
ok('la riga è fatta di giorni (1 = lunedì), ora e durata', prova(() => o.righeOrario([r(A, 3, '17:00'), r(A, 1, '17:00')])), [{ giorni: [1, 3], ora: '17:00', durataMin: 60 }])
ok('tre giorni: virgole e «e» solo prima dell’ultimo', testi([A], [r(A, 1, '17:00'), r(A, 3, '17:00'), r(A, 5, '17:00')]), ['Lunedì, mercoledì e venerdì · 17:00–18:00'])
ok('un giorno solo', testi([A], [r(A, 6, '10:00', 90)]), ['Sabato · 10:00–11:30'])
ok('17:00 lunedì e 18:00 giovedì: due righe, non un gruppo', testi([A], [r(A, 4, '18:00'), r(A, 1, '17:00')]), ['Lunedì · 17:00–18:00', 'Giovedì · 18:00–19:00'])
ok('cambio d’ora: stessa durata, un’ora diversa un altro giorno = due righe', testi([A], [r(A, 1, '17:00'), r(A, 3, '17:30')]), ['Lunedì · 17:00–18:00', 'Mercoledì · 17:30–18:30'])
ok('stessa ora, durata diversa = due righe', testi([A], [r(A, 1, '17:00', 60), r(A, 3, '17:00', 90)]), ['Lunedì · 17:00–18:00', 'Mercoledì · 17:00–18:30'])
ok('due fasce nello stesso giorno: due righe, la prima ora prima', testi([A], [r(A, 6, '11:15'), r(A, 6, '10:00')]), ['Sabato · 10:00–11:00', 'Sabato · 11:15–12:15'])
ok('ordine lunedì-domenica: la domenica (0) sta in fondo', testi([A], [r(A, 0, '10:00'), r(A, 6, '10:00', 90), r(A, 1, '09:00')]), ['Lunedì · 09:00–10:00', 'Sabato · 10:00–11:30', 'Domenica · 10:00–11:00'])
ok('domenica e lunedì insieme: i giorni vanno in ordine di settimana', testi([A], [r(A, 0, '10:00'), r(A, 1, '10:00')]), ['Lunedì e domenica · 10:00–11:00'])
ok('le righe vanno per primo giorno, poi per ora', testi([A], [r(A, 2, '16:00'), r(A, 1, '18:00'), r(A, 3, '18:00')]), ['Lunedì e mercoledì · 18:00–19:00', 'Martedì · 16:00–17:00'])
ok('una durata che scavalca la mezzanotte', testi([A], [r(A, 5, '23:30', 60)]), ['Venerdì · 23:30–00:30'])
ok('la durata che finisce giusto a mezzanotte', testi([A], [r(A, 5, '23:00', 60)]), ['Venerdì · 23:00–00:00'])
ok('l’ora del database ha i secondi (time): si scrivono HH:MM', testi([A], [r(A, 2, '17:00:00')]), ['Martedì · 17:00–18:00'])
ok('la stessa ricorrenza due volte è una riga sola', testi([A], [r(A, 1, '17:00'), r(A, 1, '17:00')]), ['Lunedì · 17:00–18:00'])

console.log('\n2. Più corsi: le righe si sommano; i corsi senza orari')
const aperti = [r(A, 1, '17:00'), r(A, 3, '17:00'), r(B, 2, '16:30'), r(B, 4, '16:30'), r(B, 6, '10:00'), r(B, 6, '11:15'), r(C, 5, '20:00')]
ok('due corsi si sommano e restano in ordine di settimana (il design)', testi([A, B], aperti), ['Lunedì e mercoledì · 17:00–18:00', 'Martedì e giovedì · 16:30–17:30', 'Sabato · 10:00–11:00', 'Sabato · 11:15–12:15'])
ok('le ricorrenze di un corso non collegato non entrano', testi([A], aperti), ['Lunedì e mercoledì · 17:00–18:00'])
ok('due corsi con lo stesso orario: una riga sola', testi([A, B], [r(A, 1, '17:00'), r(B, 1, '17:00')]), ['Lunedì · 17:00–18:00'])
ok('due corsi, giorni diversi alla stessa ora: si raggruppano', testi([A, B], [r(A, 1, '17:00'), r(B, 3, '17:00')]), ['Lunedì e mercoledì · 17:00–18:00'])
ok('nessun corso collegato: «Orario in arrivo» (la pagina non è collegata, ma la funzione non inventa)', testi([], aperti), ['Orario in arrivo'])
ok('un corso che non c’è fra gli orari (archiviato, finito): «Orario in arrivo», mai orari vecchi', testi([C], [r(A, 1, '17:00')]), ['Orario in arrivo'])
ok('orarioDeiCorsi: stesse righe, strutturate', prova(() => o.orarioDeiCorsi([B], aperti).length), 3)
ok('orarioDeiCorsi con input vuoto', prova(() => o.orarioDeiCorsi([A], [])), [])
ok('quali corsi collegati non hanno orari: tutti hanno', prova(() => o.corsiSenzaOrari([A, B], aperti)), [])
ok('quali corsi collegati non hanno orari: solo uno è vuoto, anche se l’altro ne ha', prova(() => o.corsiSenzaOrari([A, 'x-vuoto'], aperti)), ['x-vuoto'])
ok('l’anteprima non sarebbe «in arrivo», ma l’avviso c’è lo stesso', [testi([A, 'x-vuoto'], aperti), prova(() => o.corsiSenzaOrari([A, 'x-vuoto'], aperti).length)], [['Lunedì e mercoledì · 17:00–18:00'], 1])
ok('due corsi vuoti: li dice nell’ordine in cui sono collegati', prova(() => o.corsiSenzaOrari(['y', 'x'], [])), ['y', 'x'])
ok('un corso collegato due volte è detto una volta', prova(() => o.corsiSenzaOrari(['x', 'x'], [])), ['x'])
ok('nessun corso collegato: niente da avvisare', prova(() => o.corsiSenzaOrari([], aperti)), [])

const OGGI_ISO = '2026-10-18'
const dai = (ric) => prova(() => o.orariDaiCorsi([{ id: A, attivo: true, ricorrenze: ric }, { id: B, attivo: false, ricorrenze: [{ giorno: 2, ora: '16:30', durata: 60 }] }], OGGI_ISO))
ok('il pannello legge le ricorrenze dai corsi attivi', dai([{ giorno: 1, ora: '17:00', durata: 60 }]), [r(A, 1, '17:00')])
ok('una ricorrenza finita ieri non c’è (come orari_aperti)', dai([{ giorno: 1, ora: '17:00', durata: 60, al: '2026-10-17' }]), [])
ok('una che finisce oggi c’è ancora; una senza fine pure', dai([{ giorno: 1, ora: '17:00', durata: 60, al: OGGI_ISO }, { giorno: 3, ora: '17:00', durata: 60 }]).length, 2)
ok('corso con tutte le ricorrenze finite: senza orari e «Orario in arrivo»', [prova(() => o.corsiSenzaOrari([A], dai([{ giorno: 1, ora: '17:00', durata: 60, al: '2026-10-01' }]))), testi([A], dai([{ giorno: 1, ora: '17:00', durata: 60, al: '2026-10-01' }]))], [[A], ['Orario in arrivo']])
const av = (v, c) => prova(() => o.avvisoSenzaOrari(v, c, (id) => id.toUpperCase()))
ok('avviso: nessun corso vuoto, nessun avviso', av([], ['a', 'b']), null)
ok('avviso: nessun corso collegato, nessun avviso', av([], []), null)
ok('avviso: tutti vuoti, un corso', av(['a'], ['a'])?.titolo, 'Il sito mostrerà «Orario in arrivo»')
ok('avviso: tutti vuoti, due corsi', av(['a', 'b'], ['a', 'b'])?.titolo, 'Il sito mostrerà «Orario in arrivo»')
ok('avviso: la frase dice quali corsi mancano', /«A» e «B»/.test(av(['a', 'b'], ['a', 'b'])?.frase ?? ''), true)
ok('avviso: solo uno vuoto, titolo vero (singolare)', av(['a'], ['a', 'b'])?.titolo, 'Il sito non mostra orari per 1 corso')
ok('avviso: solo alcuni vuoti, titolo vero (plurale)', av(['a', 'b'], ['a', 'b', 'c'])?.titolo, 'Il sito non mostra orari per 2 corsi')
const avA = (v, c, arch) => prova(() => o.avvisoSenzaOrari(v, c, (id) => id.toUpperCase(), arch))
ok('avviso: un corso archiviato dice di ripristinarlo o scollegarlo, non di aggiungere un giorno', [/archiviato/.test(avA(['a'], ['a'], ['a'])?.frase ?? ''), /ripristin/i.test(avA(['a'], ['a'], ['a'])?.frase ?? ''), /scolleg/i.test(avA(['a'], ['a'], ['a'])?.frase ?? ''), /aggiung/i.test(avA(['a'], ['a'], ['a'])?.frase ?? '')], [true, true, true, false])
ok('avviso: archiviato e un altro senza giorni, due frasi', [/«B» non ha giorni/.test(avA(['a', 'b'], ['a', 'b', 'c'], ['a'])?.frase ?? ''), /«A» è archiviato/.test(avA(['a', 'b'], ['a', 'b', 'c'], ['a'])?.frase ?? ''), avA(['a', 'b'], ['a', 'b', 'c'], ['a'])?.titolo], [true, true, 'Il sito non mostra orari per 2 corsi'])
ok('avviso: archiviato = vuoto, titolo «Orario in arrivo» se è l’unico', avA(['a'], ['a'], ['a'])?.titolo, 'Il sito mostrerà «Orario in arrivo»')
ok('indirizzo verso CORSI: percorso, query e poi il cancelletto (le pagine hanno <base href="../">)', prova(() => ind.indirizzoCompleto({ pathname: '/segreteria/', search: '?prova=1' }, { voce: 'corsi' })), '/segreteria/?prova=1#corsi')
ok('indirizzo verso un corso', prova(() => ind.indirizzoCompleto({ pathname: '/segreteria/', search: '' }, { voce: 'corsi', corso: 'c 1' })), '/segreteria/#corsi/c%201')
ok('avviso: solo alcuni vuoti, dice quali mancano e che gli altri restano', [/«A»/.test(av(['a'], ['a', 'b'])?.frase ?? ''), /altri/.test(av(['a'], ['a', 'b'])?.frase ?? '')], [true, true])

// --- le pagine generate -------------------------------------------------------
const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
const ISC = 'https://app.officinedellosport.it/iscrizioni/'
const PUL = `<p><a class="pulsante" href="/contatti/">Scrivici</a> <a class="pulsante" href="${ISC}">Prova una settimana a 5 €</a></p>`
const FOTO = `<img src="${P}foto-a.jpg" alt="Una lezione" />`
const VOCI = (...v) => `<ul>${v.map(([e, t]) => `<li><strong>${e}</strong> ${t}</li>`).join('')}</ul>`
// L'orario scritto a mano: parole che non possono uscire dall'orario automatico.
const A_MANO = '<h2>Orario delle lezioni</h2><h3>Gruppo piccoli</h3><p><strong>09:15 – 10:15</strong></p><p>giorni scritti a mano</p><h3>Gruppo grandi</h3><p><strong>21:45 – 22:45</strong></p><p>altri giorni a mano</p>'
const CON_FOTO = PUL + FOTO + VOCI(['Giorni', 'Lun e mer'], ['Età', 'Dal 2012'], ['Costo', 'Da 30 €'], ['Sala', 'Tatami']) + A_MANO
// Senza foto di apertura la fascia blu prende le prime tre voci: giorno, ora, età.
const FASCIA = PUL + VOCI(['Giorno', 'Martedì'], ['Ora', '20:00'], ['Età', 'Dal 2012'], ['Costo', 'Da 30 €'])
const pagina = (testo, extra = {}, dati = {}) => g.generaSito({
  dominio: 'https://officinedellosport.it',
  pagine: [{ slug: 'avviamento', titolo: 'Avviamento', descrizione: 'Per iniziare.', testo, ...extra }, { slug: 'corsi', titolo: 'Corsi', descrizione: '', testo: '<p>c</p>' }, { slug: 'contatti', titolo: 'Contatti', descrizione: '', testo: '<p>c</p>' }],
  menu: [{ dove: 'menu', ordine: 1, etichetta: 'Home', slug: 'home', indirizzo: null }],
  rinvii: [],
  ospitiImmagini: [P],
  ...dati,
})['avviamento/index.html'] ?? ''
const sha = (t) => createHash('sha256').update(t).digest('hex')
const main = (h) => h.match(/<main[^>]*>([\s\S]*)<\/main>/)?.[1] ?? ''
const testo = (h) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
// Ogni riga d'orario è un elemento con classe `riga-orario` e dentro solo il testo di `testoRiga`.
const righe = (h) => [...main(h).matchAll(/<(\w+) class="riga-orario">([\s\S]*?)<\/\1>/g)].map((m) => testo(m[2]))
const orariDel = (...x) => x.map(({ corsoId, giorno, ora, durataMin }) => ({ corsoId, giorno, ora, durataMin }))
const ORARI = orariDel(r(A, 1, '17:00'), r(A, 3, '17:00'), r(B, 2, '16:30'), r(B, 6, '10:00'), r(B, 6, '11:15'), r(C, 5, '20:00'))

console.log('\n3. Pagina non collegata: l’HTML è quello di oggi')
// Le impronte sono dell’HTML di una pagina non collegata (senza campi nuovi): cambiano se cambia la testata, il logo o il CSS, e allora si rifanno.
// Rifatte quando ogni pagina ha avuto «Salta al contenuto» in cima e il telefono del piede è diventato un link tel:, , per le correzioni di Scrivici, logo e numeri 1-4, e per le recensioni a carte uguali (via il CSS di «In breve»).
const OGGI = { dati: "af6c945292cc71bd17eba761c786cfb7351cd83081bd8096d4dc4217f24cd71d", foto: '7093e1e8787bf77083e08b038ec06fc7d3c0d7bd29173da79b719a9670c8fc48', fascia: '66b780bf5ac03ab573f61cf1dfbdc35b2134377ca4dbc98fb9d0d9b049de9b3d' }
ok('con foto di apertura: HTML di oggi', sha(pagina(CON_FOTO)), OGGI.foto)
ok('fascia blu: HTML di oggi', sha(pagina(FASCIA)), OGGI.fascia)
ok('l’orario a mano si vede ancora', /09:15 – 10:15/.test(testo(main(pagina(CON_FOTO)))), true)
ok('la fascia a mano si vede ancora', /Martedì/.test(testo(main(pagina(FASCIA)))), true)
ok('corsiCollegati vuoto = non collegata', [sha(pagina(CON_FOTO, { corsiCollegati: [] })), sha(pagina(FASCIA, { corsiCollegati: [] }))], [OGGI.foto, OGGI.fascia])
ok('corsiCollegati assente (undefined) = non collegata', [sha(pagina(CON_FOTO, { corsiCollegati: undefined })), sha(pagina(FASCIA, { corsiCollegati: undefined }))], [OGGI.foto, OGGI.fascia])
ok('gli orari nei dati non cambiano una pagina non collegata', [sha(pagina(CON_FOTO, {}, { orari: ORARI })), sha(pagina(FASCIA, {}, { orari: ORARI }))], [OGGI.foto, OGGI.fascia])
ok('nessuna riga d’orario automatica', righe(pagina(CON_FOTO, {}, { orari: ORARI })), [])

console.log('\n4. Pagina collegata: l’orario viene da CORSI')
{
  const h = pagina(CON_FOTO, { corsiCollegati: [A, B] }, { orari: ORARI })
  ok('le righe dei due corsi, in ordine di settimana', righe(h), ['Lunedì e mercoledì · 17:00–18:00', 'Martedì · 16:30–17:30', 'Sabato · 10:00–11:00', 'Sabato · 11:15–12:15'])
  ok('l’orario scritto a mano non si mostra', /09:15|21:45|giorni scritti a mano|altri giorni a mano/.test(testo(main(h))), false)
  ok('il resto della pagina non cambia: le voci dei dati ci sono ancora', ['Dal 2012', 'Da 30 €', 'Tatami'].map((x) => testo(main(h)).includes(x)), [true, true, true])
  ok('niente sala, istruttore, posti: le righe sono solo giorno, ora e durata', righe(h).every((x) => /^[A-Zè][^·]+ · \d\d:\d\d–\d\d:\d\d$/.test(x)), true)
  ok('un corso non collegato (C) non entra', /20:00/.test(testo(main(h))), false)
  ok('con foto, la voce a mano «Giorni» sparisce (c’è l’orario di CORSI); età e costo restano', [/Lun e mer/.test(testo(main(h))), /Dal 2012/.test(testo(main(h))), /Da 30 €/.test(testo(main(h)))], [false, true, true])
  const uno = pagina(CON_FOTO, { corsiCollegati: [A] }, { orari: ORARI })
  ok('un corso solo', righe(uno), ['Lunedì e mercoledì · 17:00–18:00'])
  const vuota = pagina(CON_FOTO, { corsiCollegati: ['cccccccc-0000-0000-0000-0000000000ff'] }, { orari: ORARI })
  ok('nessun corso trovato: la riga «Orario in arrivo»', righe(vuota), ['Orario in arrivo'])
  ok('…e mai l’orario a mano', /09:15|21:45/.test(testo(main(vuota))), false)
  ok('corso senza orari (archiviato, finito): «Orario in arrivo»', righe(pagina(CON_FOTO, { corsiCollegati: [A] }, { orari: orariDel(r(B, 1, '10:00')) })), ['Orario in arrivo'])
  ok('collegata ma il generatore non ha ricevuto gli orari: «Orario in arrivo»', righe(pagina(CON_FOTO, { corsiCollegati: [A] })), ['Orario in arrivo'])
  ok('collegata a un corso e a uno vuoto: le righe dell’altro, nessun «in arrivo»', righe(pagina(CON_FOTO, { corsiCollegati: [A, 'x-vuoto'] }, { orari: ORARI })), ['Lunedì e mercoledì · 17:00–18:00'])
  ok('l’HTML generato dello stesso input è sempre lo stesso', sha(h), sha(pagina(CON_FOTO, { corsiCollegati: [A, B] }, { orari: ORARI })))
  ok('un orario da 0 a 7 righe regge senza rompere la pagina', [0, 1, 2, 3, 4, 5, 6, 7].map((n) => righe(pagina(CON_FOTO, { corsiCollegati: [A] }, { orari: orariDel(...Array.from({ length: n }, (_, i) => r(A, i, `0${i + 8}:00`))) })).length), [1, 1, 2, 3, 4, 5, 6, 7])
}

console.log('\n5. Pre pugilistica e Autodifesa: la fascia blu')
{
  const h = pagina(FASCIA, { corsiCollegati: [A] }, { orari: ORARI })
  ok('giorno e ora scritti a mano spariscono', /Martedì|20:00/.test(testo(main(h))), false)
  ok('al loro posto c’è l’orario automatico', righe(h), ['Lunedì e mercoledì · 17:00–18:00'])
  ok('l’età resta una voce a mano', /Età/.test(testo(main(h))) && /Dal 2012/.test(testo(main(h))), true)
  ok('le altre voci a mano restano', /Da 30 €/.test(testo(main(h))), true)
  ok('senza orari: «Orario in arrivo» e non quelli a mano', [righe(pagina(FASCIA, { corsiCollegati: [A] })), /Martedì|20:00/.test(testo(main(pagina(FASCIA, { corsiCollegati: [A] }))))], [['Orario in arrivo'], false])
}

console.log('\n6. Dal database al generatore, e senza 68-sito-orario.sql')
{
  const riga = (extra = {}) => ({ slug: 'avviamento', titolo: 'Avviamento', descrizione: 'Per iniziare.', testo: CON_FOTO, pubblicata_il: null, ...extra })
  const dati = (pagine, orari) => prova(() => g.datiDaRisposte('https://officinedellosport.it/', pagine, [], [], orari))
  const html = (d) => prova(() => g.generaSito({ ...d, pagine: [...d.pagine, { slug: 'corsi', titolo: 'Corsi', descrizione: '', testo: '<p>c</p>' }], ospitiImmagini: [P] })['avviamento/index.html'])
  const riceve = dati([riga({ corsi_collegati: [A] })], [{ corso_id: A, giorno: 1, ora: '17:00:00', durata_min: 60 }])
  ok('i corsi collegati della pagina arrivano al generatore', riceve.pagine?.[0]?.corsiCollegati, [A])
  ok('gli orari arrivano con le chiavi del generatore', riceve.orari, [{ corsoId: A, giorno: 1, ora: '17:00:00', durataMin: 60 }])
  ok('dal database alla pagina: la riga d’orario', righe(html(riceve)), ['Lunedì · 17:00–18:00'])
  const senza = dati([riga()])
  ok('senza la colonna (68 non lanciato): pagina non collegata, nessun errore', (senza.pagine?.[0]?.corsiCollegati ?? []).length, 0)
  ok('senza la colonna: la pagina è quella di oggi', sha(html(senza)), OGGI.dati)
  ok('colonna null: pagina non collegata', sha(html(dati([riga({ corsi_collegati: null })]))), OGGI.dati)
  ok('colonna vuota: pagina non collegata', sha(html(dati([riga({ corsi_collegati: [] })], []))), OGGI.dati)
  const senzaOrari = dati([riga({ corsi_collegati: [A] })])
  ok('senza orari_aperti() (orari undefined) le pagine tornano non collegate', senzaOrari.pagine?.[0]?.corsiCollegati, [])
  ok('…e la pagina è quella di oggi, non «Orario in arrivo»', sha(html(senzaOrari)), OGGI.dati)
  ok('orari presenti ma vuoti: la pagina collegata dice «Orario in arrivo»', righe(html(dati([riga({ corsi_collegati: [A] })], []))), ['Orario in arrivo'])
  ok('senza orari_aperti() (48 non lanciato) i dati si costruiscono lo stesso', (dati([riga({ corsi_collegati: [A] })]).orari ?? []).length, 0)

  // La segreteria: senza 68 il pannello lo sa e lo dice, come per 62-sito-pezzi.sql.
  ok('databaseConCorsi: nessuna pagina, non si sa = senza 68', prova(() => o.databaseConCorsi([])), false)
  ok('databaseConCorsi: nessuna pagina col campo = senza 68', prova(() => o.databaseConCorsi([{}, {}])), false)
  ok('databaseConCorsi: una pagina col campo (anche vuoto) = con 68', prova(() => o.databaseConCorsi([{}, { corsiCollegati: [] }])), true)
  const risposta = (x) => ({ ...x, then: (f, ko) => Promise.resolve(x).then(f, ko) })
  const base = { id: 'p1', slug: 'home', titolo: 'Home', descrizione: '', titolo_pubblicato: null, descrizione_pubblicata: null, bozza: '<p>x</p>', pubblicato: null, nascosta: false, di_legge: false, versione: 1, pubblicata_il: null }
  const errore = async (f) => { try { await f(); return 'nessun errore' } catch (e) { return e.message } }
  const FRASE = 'Qui l’orario dai corsi non è ancora attivo. Per ora l’orario resta quello scritto a mano.'
  const client = (con67, codice, messaggio) => sb.creaSegreteriaSupabase({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => ({
      select: (cols) => ({ order: () => risposta(cols.includes('corsi_collegati')
        ? (con67 ? { data: [{ ...base, corsi_collegati: [A, B] }], error: null } : { data: null, error: { code: '42703', message: 'column sito_pagine.corsi_collegati does not exist' } })
        : { data: [base], error: null }) }),
    }),
    rpc: () => risposta(con67 ? { data: null, error: null } : { data: null, error: { code: codice, message: messaggio } }),
  })
  const con = await prova(() => client(true).sitoPagine())
  ok('con il 68: la pagina porta i corsi collegati', Array.isArray(con) ? con[0]?.corsiCollegati : con, [A, B])
  const senza67 = await prova(() => client(false).sitoPagine())
  ok('senza il 68: le pagine si leggono lo stesso, senza il campo', Array.isArray(senza67) ? [senza67.length, senza67[0].corsiCollegati] : senza67, [1, undefined])
  ok('senza il 68: collegare un corso dice quale file lanciare (funzione assente, PGRST202)', await errore(() => client(false, 'PGRST202', 'Could not find the function public.salva_corsi_sito in the schema cache').collegaCorsiSito('p1', [A])), FRASE)
  ok('senza il 68: collegare un corso (42883)', await errore(() => client(false, '42883', 'function public.salva_corsi_sito does not exist').collegaCorsiSito('p1', [A])), FRASE)
  ok('con il 68: collegare i corsi riesce', await errore(() => client(true).collegaCorsiSito('p1', [A, B])), 'nessun errore')
}

console.log('\n7. Modalità prova: le stesse regole sui dati inventati')
{
  const s0 = prova(() => sp.sitoIniziale())
  const id = 'sp-pre-pugilistica'
  const col = (s, i, c, esistenti) => prova(() => sp.collegaCorsi(s, i, c, esistenti))
  const collegata = col(s0, id, [A, B])
  const di = (s, i = id) => s?.pagine?.find((p) => p.id === i)
  ok('le pagine di prova nascono non collegate (campo presente ma vuoto)', di(s0)?.corsiCollegati ?? [], [])
  ok('collega due corsi', di(collegata)?.corsiCollegati, [A, B])
  ok('un corso collegato due volte vale una volta', di(col(s0, id, [A, A]))?.corsiCollegati, [A])
  ok('si scollega: lista vuota', di(col(collegata, id, []))?.corsiCollegati, [])
  ok('le altre pagine non cambiano', di(collegata, 'sp-home')?.corsiCollegati ?? [], [])
  ok('collegare non cambia versione, bozza, pubblicato', ['versione', 'bozza', 'pubblicato'].map((k) => di(collegata)?.[k] === di(s0)?.[k]), [true, true, true])
  ok('una pagina che non c’è: la frase di sempre', String(col(s0, 'sp-non-c-e', [A])), 'ERRORE: La pagina non c’è più')
  ok('pagina e corso che non ci sono: prima la pagina, come il database', String(col(s0, 'sp-non-c-e', ['x-no'], [A])), 'ERRORE: La pagina non c’è più')
  ok('un corso che non c’è non si collega', String(col(s0, id, [A, 'x-no'], [A])), 'ERRORE: Uno dei corsi scelti non c’è più: ricarica la pagina e scegli di nuovo')
  ok('lo stato di prima non è toccato', di(s0)?.corsiCollegati ?? [], [])
}

console.log('\n8. Il giro del sito (scripts/genera-sito.mjs) senza orari_aperti(), con un server finto')
{
  const { createServer } = await import('node:http')
  const { spawn } = await import('node:child_process')
  const { mkdtempSync, existsSync, readFileSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const PAG = [
    { slug: 'home', titolo: 'Home', descrizione: '', testo: '<p>Benvenuti</p>', pubblicata_il: null, corsi_collegati: [] },
    { slug: 'avviamento', titolo: 'Avviamento', descrizione: 'Per iniziare.', testo: CON_FOTO, pubblicata_il: null, corsi_collegati: [A] },
  ]
  // Un giro: il server risponde per funzione; dice come finisce lo script e se la pagina collegata ha le righe automatiche.
  const giro = async (risposte) => {
    const server = createServer((req, res) => {
      const f = req.url.split('/').pop()
      const r = risposte[f] ?? { stato: 200, corpo: [] }
      res.writeHead(r.stato, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(r.corpo))
    })
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
    const cartella = mkdtempSync(join(tmpdir(), 'prova-giro-'))
    // Lo script legge il primo argomento solo con --da-file: l'uscita è la sua cartella di default, `dist-sito`, nella cartella da cui parte.
    const uscita = join(cartella, 'dist-sito')
    const codice = await new Promise((fine) => {
      const p = spawn('node', [join(process.cwd(), 'scripts/genera-sito.mjs')], { cwd: cartella, env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_ANON_KEY: 'x' }, stdio: 'ignore' })
      p.on('close', fine)
    })
    server.close()
    const file = join(uscita, 'avviamento/index.html')
    const html = existsSync(file) ? readFileSync(file, 'utf8') : ''
    rmSync(cartella, { recursive: true, force: true })
    return { codice, righe: righe(html), generato: html !== '' }
  }
  const base = { sito_pagine_pubbliche: { stato: 200, corpo: PAG }, sito_menu_pubblico: { stato: 200, corpo: [] }, sito_redirect_pubblici: { stato: 200, corpo: [] } }
  const senza = (stato, code) => giro({ ...base, orari_aperti: { stato, corpo: { code, message: 'non c’è' } } })
  const normale = await giro({ ...base, orari_aperti: { stato: 200, corpo: [{ corso_id: A, giorno: 1, ora: '17:00:00', durata_min: 60 }] } })
  ok('controllo: con orari_aperti() la pagina collegata ha la sua riga', [normale.codice, normale.righe], [0, ['Lunedì · 17:00–18:00']])
  const vuoti = await giro({ ...base, orari_aperti: { stato: 200, corpo: [] } })
  ok('controllo: orari_aperti() vuota = «Orario in arrivo» (non è un guasto)', [vuoti.codice, vuoti.righe], [0, ['Orario in arrivo']])
  for (const [stato, code] of [[404, 'PGRST202'], [404, '42883'], [400, '42703']]) {
    const g = await senza(stato, code)
    ok(`orari_aperti() ${code} (${stato}): il sito si genera lo stesso, pagine non collegate`, [g.codice, g.generato, g.righe], [0, true, []])
  }
  const cinquecento = await giro({ ...base, orari_aperti: { stato: 500, corpo: { code: 'XX000', message: 'guasto' } } })
  ok('orari_aperti() 500: resta un guasto (codice 1), il sito di prima non si tocca', [cinquecento.codice, cinquecento.generato], [1, false])
  const pagineManca = await giro({ ...base, sito_pagine_pubbliche: { stato: 404, corpo: { code: 'PGRST202', message: 'non c’è' } }, orari_aperti: { stato: 200, corpo: [] } })
  ok('sito_pagine_pubbliche() PGRST202: resta un guasto (codice 1)', [pagineManca.codice, pagineManca.generato], [1, false])
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
if (guai) process.exit(1)
