// ---------------------------------------------------------------------------
// L'interruttore della musica nelle impostazioni del timer, senza browser.
//
//   node scripts/prova-musica.mjs
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { DEFAULT_SETTINGS } from './timer/src/lib/storage'; export { musicaAttiva } from './timer/src/lib/musicaAttiva'; export { musicaDellaSala, disciplinaDaSalvare } from './src/lib/musica'; export * as musicaLib from './src/lib/musica'",
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
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
const m = await import(modulo)
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

console.log('La musica si può spegnere')
ok('di fabbrica è accesa: chi aveva già la musica non la perde', m.DEFAULT_SETTINGS.musica, true)
ok('accesa e con qualcosa da comandare: attiva', m.musicaAttiva({ musica: true }, true), true)
ok('accesa ma senza niente da comandare: non attiva', m.musicaAttiva({ musica: true }, false), false)
ok('spenta, anche con Spotify collegato o un link valido: non attiva', m.musicaAttiva({ musica: false }, true), false)
ok('un salvataggio vecchio, senza il campo: resta accesa', m.musicaAttiva({}, true), true)

// Il tablet di sala può spegnere la musica da sé, anche se nelle impostazioni è accesa.
const base = { musicaFonte: 'youtube', youtube: 'https://youtu.be/x' }
ok('tablet acceso: fonte e link restano, e il campo `musica` non c\'è (vale quello delle impostazioni)', m.musicaDellaSala(base, false), base)
ok('tablet spento: stessa fonte, ma `musica` è falso', m.musicaDellaSala(base, true), { ...base, musica: false })
ok('spento dal tablet, anche con la musica accesa nelle impostazioni: non attiva', m.musicaAttiva({ ...{ musica: true }, ...m.musicaDellaSala(base, true) }, true), false)
ok('acceso dal tablet ma spento nelle impostazioni: resta non attiva', m.musicaAttiva({ ...{ musica: false }, ...m.musicaDellaSala(base, false) }, true), false)

// La disciplina di una lista di musica quando la segreteria la salva.
const dis = [{ id: 'judo', nome: 'Judo' }, { id: 'lotta', nome: 'Lotta' }]
ok('assente: non si tocca (undefined)', m.disciplinaDaSalvare({ nome: 'A' }, dis), undefined)
ok('scelta e nella lista: l\'id', m.disciplinaDaSalvare({ disciplina: 'lotta' }, dis), 'lotta')
ok('«tutte»: vale', m.disciplinaDaSalvare({ disciplina: 'tutte' }, []), 'tutte')
ok('nulla: si toglie (null)', m.disciplinaDaSalvare({ disciplina: null }, dis), null)
ok('indefinita ma presente: si toglie (null)', m.disciplinaDaSalvare({ disciplina: undefined }, dis), null)
ok('sconosciuta: si toglie (null)', m.disciplinaDaSalvare({ disciplina: 'karate' }, dis), null)

// ---------------------------------------------------------------------------
// LA MUSICA DEL TABLET ANCHE SUL TELEFONO (timer dell'app istruttori).
// Le regole si spostano da Tablet.tsx e MusicaSala.tsx in `src/lib/musica.ts`,
// così tablet e telefono le dividono. Una funzione che manca fa fallire il
// caso, non tutta la prova.
// ---------------------------------------------------------------------------
const L = m.musicaLib
const vedi = (f) => { try { return f() } catch (e) { return `ERRORE: ${e.message}` } }
// Le chiavi in ordine: conta cosa c'è, non in che ordine è scritto.
const piano = (o) => (o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))) : o)

const YT = 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPbo1Z'
const SP = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'
const RADIO = 'https://stream.esempio.it/rock'
const lista = (id, link, extra = {}) => ({ id, nome: id, link, salaId: 'Tatami', ...extra })
const listaYt = lista('Randori', YT)
const listaSp = lista('Riscaldamento', SP)
const listaRadio = lista('Radio della palestra', RADIO)
const listaRotta = lista('Rotta', 'la mia musica')
const imp = { musicaFonte: 'file', youtube: 'https://youtu.be/dQw4w9WgXcQ', radio: 'https://stream.esempio.it/jazz' }

console.log('\nLa musica scelta per il timer: una funzione sola per tablet e telefono')
// Quello che oggi Tablet.tsx scrive dentro il componente: la funzione nuova deve dare lo stesso.
const comeIlTablet = (l, i, spenta) => {
  const f = l ? L.fonteDelLink(l.link) : null
  return m.musicaDellaSala(
    l && f
      ? { musicaFonte: f, youtube: f === 'youtube' ? l.link : i.youtube, radio: f === 'radio' ? l.link : i.radio }
      : { musicaFonte: i.musicaFonte, youtube: i.youtube, radio: i.radio },
    spenta,
  )
}
const scelta = (l, spenta) => piano(vedi(() => L.musicaScelta(l, imp, spenta)))
ok('una lista YouTube: fonte YouTube e il suo link', scelta(listaYt, false), piano({ musicaFonte: 'youtube', youtube: YT, radio: imp.radio }))
ok('una lista Spotify: fonte Spotify, i link restano quelli delle impostazioni', scelta(listaSp, false), piano({ musicaFonte: 'spotify', youtube: imp.youtube, radio: imp.radio }))
ok('una radio: fonte radio e il suo link', scelta(listaRadio, false), piano({ musicaFonte: 'radio', youtube: imp.youtube, radio: RADIO }))
ok('senza lista: valgono le impostazioni del timer', scelta(null, false), piano(imp))
ok('una lista col link rotto: valgono le impostazioni del timer', scelta(listaRotta, false), piano(imp))
ok('spenta: `musica: false` vince, anche con una lista', scelta(listaYt, true), piano({ musicaFonte: 'youtube', youtube: YT, radio: imp.radio, musica: false }))
ok('spenta e senza lista: `musica: false` sulle impostazioni', scelta(null, true), piano({ ...imp, musica: false }))
for (const l of [listaYt, listaSp, listaRadio, listaRotta, null]) {
  for (const spenta of [false, true]) {
    ok(`stesso risultato del tablet: ${l?.id ?? 'nessuna lista'}${spenta ? ', spenta' : ''}`, scelta(l, spenta), piano(comeIlTablet(l, imp, spenta)))
  }
}

console.log('\nSul telefono la musica parte spenta, e non tocca la memoria del tablet')
memoria.clear()
ok('telefono, niente di ricordato: spenta', vedi(() => L.spentaRicordata('telefono')), true)
ok('tablet, niente di ricordato: accesa, come oggi', vedi(() => L.spentaRicordata('tablet')), false)
ok('telefono, niente di ricordato: nessuna lista', vedi(() => L.listaRicordata('telefono')), null)
vedi(() => L.ricordaSpenta('telefono', false))
ok('accesa sul telefono: dopo un ricaricamento resta accesa', vedi(() => L.spentaRicordata('telefono')), false)
ok('accesa sul telefono: la chiave del tablet non si tocca', memoria.has('ods-corsi:musica-spenta'), false)
vedi(() => L.ricordaSpenta('tablet', true))
ok('spenta sul tablet: la chiave è quella di oggi', memoria.get('ods-corsi:musica-spenta'), '1')
ok('spenta sul tablet: il telefono resta acceso', vedi(() => L.spentaRicordata('telefono')), false)
vedi(() => L.ricordaLista('telefono', 'Randori'))
ok('la lista scelta sul telefono si ricorda', vedi(() => L.listaRicordata('telefono')), 'Randori')
ok('la lista scelta sul telefono non cambia quella del tablet', vedi(() => L.listaRicordata('tablet')), null)
ok('la lista scelta sul telefono non usa la chiave del tablet', memoria.has('ods-corsi:musica-sala'), false)
vedi(() => L.ricordaLista('tablet', 'Riscaldamento'))
ok('la lista del tablet sta nella chiave di oggi', memoria.get('ods-corsi:musica-sala'), 'Riscaldamento')
ok('la lista del tablet non cambia quella del telefono', vedi(() => L.listaRicordata('telefono')), 'Randori')
vedi(() => L.ricordaLista('telefono', null))
ok('tolta la lista sul telefono: nessuna', vedi(() => L.listaRicordata('telefono')), null)
ok('tolta la lista sul telefono: il tablet tiene la sua', vedi(() => L.listaRicordata('tablet')), 'Riscaldamento')
{
  const vera = globalThis.localStorage
  globalThis.localStorage = { getItem() { throw new Error('privata') }, setItem() { throw new Error('privata') }, removeItem() { throw new Error('privata') } }
  ok('senza memoria (navigazione privata): il telefono resta spento', vedi(() => L.spentaRicordata('telefono')), true)
  ok('senza memoria: il tablet resta acceso, come oggi', vedi(() => L.spentaRicordata('tablet')), false)
  globalThis.localStorage = vera
}

console.log('\nDopo un ricaricamento la musica non riparte da sola')
memoria.clear()
vedi(() => L.ricordaLista('telefono', 'Randori'))
vedi(() => L.ricordaSpenta('telefono', false))
const iniziale = vedi(() => L.statoMusica({ spenta: L.spentaRicordata('telefono'), partita: false, inRiproduzione: false }))
ok('lista ricordata e non spenta: ferma', iniziale, 'ferma')
ok('ferma: la barra dice di toccare ▶', vedi(() => L.sottoMusica({ stato: iniziale, errore: null, dettaglio: 'Playlist YouTube' })), 'Tocca ▶ per farla partire')
ok('spenta: spenta, anche se era partita', vedi(() => L.statoMusica({ spenta: true, partita: true, inRiproduzione: true })), 'spenta')
ok('partita e suona: suona', vedi(() => L.statoMusica({ spenta: false, partita: true, inRiproduzione: true })), 'suona')
ok('partita e ferma: in pausa', vedi(() => L.statoMusica({ spenta: false, partita: true, inRiproduzione: false })), 'pausa')
ok('suona: sotto il dettaglio', vedi(() => L.sottoMusica({ stato: 'suona', errore: null, dettaglio: 'Playlist YouTube' })), 'Playlist YouTube')
ok('un errore vince su «Tocca ▶»', vedi(() => L.sottoMusica({ stato: 'ferma', errore: 'Senza rete non parte.', dettaglio: 'Playlist YouTube' })), 'Senza rete non parte.')

console.log('\nUna lista che non si può suonare è spenta e dice perché, col dispositivo giusto')
const judo = [{ id: 'judo', nome: 'Judo' }]
const riga = (l, dispositivo, spotifyCollegato) => vedi(() => {
  const r = L.rigaLista(l, { dispositivo, spotifyCollegato, discipline: judo })
  return [r.spenta, r.sotto]
})
ok('tablet: Spotify non collegato', riga(listaSp, 'tablet', false), [true, 'Spotify non è collegato su questo tablet'])
ok('tablet: link non valido', riga(listaRotta, 'tablet', true), [true, 'Link non valido'])
ok('tablet: YouTube per tutte le sale e per il judo, come oggi', riga({ ...listaYt, salaId: null, disciplina: 'judo' }, 'tablet', true), [false, 'Playlist YouTube · tutte le sale · Judo'])
ok('tablet: Spotify collegato', riga(listaSp, 'tablet', true), [false, 'Playlist Spotify'])
ok('tablet: radio', riga(listaRadio, 'tablet', false), [false, 'Radio'])
ok('telefono: Spotify non collegato', riga(listaSp, 'telefono', false), [true, 'Spotify non è collegato su questo telefono'])
ok('telefono: link non valido', riga(listaRotta, 'telefono', true), [true, 'Link non valido'])
ok('telefono: YouTube dice che col telefono bloccato si ferma', riga(listaYt, 'telefono', true), [false, 'Playlist YouTube · si ferma col telefono bloccato'])
ok('telefono: Spotify collegato', riga(listaSp, 'telefono', true), [false, 'Playlist Spotify'])
ok('telefono: radio', riga(listaRadio, 'telefono', false), [false, 'Radio'])
ok('telefono: per tutte le sale e per il judo, la sala non si dice', riga({ ...listaYt, salaId: null, disciplina: 'judo' }, 'telefono', true), [false, 'Playlist YouTube · Judo · si ferma col telefono bloccato'])

console.log('\nCosa fanno i tasti della musica: cosa si ricorda e se la musica è partita')
const az = (a) => piano(vedi(() => L.azioneMusica(a)))
ok('una lista toccata: parte, e non si ricorda niente sullo spento', az('scegli'), piano({ parti: true, pausa: false }))
ok('✕: pausa, si ricorda spenta, non è più partita', az('spegni'), piano({ parti: false, pausa: true, spenta: true }))
ok('ACCENDI: si ricorda accesa, ma non parte da sola', az('accendi'), piano({ parti: false, pausa: false, spenta: false }))
ok('ESCI: pausa e non più partita, lo spento resta com\'era', az('ferma'), piano({ parti: false, pausa: true }))
ok('il lettore suona: è partita', az('suona'), piano({ parti: true, pausa: false }))

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
