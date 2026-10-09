// ---------------------------------------------------------------------------
// La musica della sala da file del tablet e da radio, senza browser.
//
//   node scripts/prova-musica-file.mjs
//
// Il database (link di radio nelle liste) lo prova supabase/prova/musica.sql
// con gli stessi casi.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './timer/src/lib/musicaLocale'; export { loadSettings } from './timer/src/lib/storage'; export { musicaAttiva } from './timer/src/lib/musicaAttiva'; export { fonteDelLink, erroreDelLink } from './src/lib/musica'",
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
// Ogni caso gira da sé: se la funzione manca o lancia, il caso è rosso e si va avanti.
const prova = (cosa, f, voluto) => {
  try {
    ok(cosa, f(), voluto)
  } catch (e) {
    ok(cosa, `lancia «${e.message}»`, voluto)
  }
}
// Un generatore casuale che si ripete, per poter provare l'ordine.
const seme = (s) => () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
const tutti = (n) => Array.from({ length: n }, (_, i) => i)
const ordinati = (a) => [...a].sort((x, y) => x - y)
const brano = (i) => ({ id: `f${i}`, nome: `Brano ${i}.mp3` })

console.log('La fonte scelta nelle impostazioni')
const salva = (v) => memoria.set('ods-timer:settings', JSON.stringify(v))
for (const f of ['file', 'radio', 'youtube', 'spotify']) {
  prova(`«${f}» si legge com'è`, () => m.leggiFonte(f), f)
}
prova('un salvataggio vecchio senza il campo: Spotify, come prima', () => m.leggiFonte(undefined), 'spotify')
prova('un valore sconosciuto: Spotify', () => m.leggiFonte('napster'), 'spotify')
prova('un valore che non è nemmeno testo: Spotify', () => m.leggiFonte(42), 'spotify')
salva({ musicaFonte: 'radio' })
prova('dal salvataggio si legge «radio»', () => m.loadSettings().musicaFonte, 'radio')
salva({ musicaFonte: 'napster' })
prova('dal salvataggio con un valore sconosciuto esce un valore noto', () => m.loadSettings().musicaFonte, 'spotify')
salva({})
prova('dal salvataggio senza il campo esce Spotify', () => m.loadSettings().musicaFonte, 'spotify')

console.log('\nCosa è un link')
prova('YouTube di oggi: youtube', () => m.fonteDelLink('https://youtu.be/dQw4w9WgXcQ'), 'youtube')
prova('YouTube senza https: youtube', () => m.fonteDelLink('youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube')
prova('Spotify di oggi: spotify', () => m.fonteDelLink('https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP'), 'spotify')
prova("Spotify come URI: spotify", () => m.fonteDelLink('spotify:playlist:37i9dQZF1DX76Wlfdnj7AP'), 'spotify')
prova('un indirizzo https qualunque: radio', () => m.fonteDelLink('https://stream.radio.example/musica'), 'radio')
prova('un indirizzo https con porta e percorso: radio', () => m.fonteDelLink('https://radio.example:8443/live.aac'), 'radio')
prova('un indirizzo http non si accetta come radio', () => m.fonteDelLink('http://stream.radio.example/musica'), null)
prova('e dice cosa fare', () => m.erroreDelLink('http://stream.radio.example/musica'), 'Questo indirizzo non è sicuro: cerca l\'indirizzo che comincia con https.')
prova('un testo qualunque non è musica', () => m.fonteDelLink('la mia musica preferita'), null)
prova('un link troppo lungo dice che è troppo lungo', () => m.erroreDelLink('https://radio.esempio.it/' + 'a'.repeat(500)), 'Il link è troppo lungo')
prova('un testo qualunque non ha il messaggio dell\'http', () => m.erroreDelLink('la mia musica preferita'), null)
prova('vuoto: niente', () => m.fonteDelLink('   '), null)
prova('un indirizzo https buono non ha errori', () => m.erroreDelLink('https://stream.radio.example/musica'), null)
// La stessa regola del vincolo del database (supabase/39-musica-radio.sql): se qui passa e lì no, la segreteria vede un errore falso.
for (const [cosa, link] of [
  ['con una query', 'https://radio.esempio.it?x=1'],
  ['con un frammento', 'https://radio.esempio.it#a'],
  ['con nome utente e password', 'https://u:p@radio.esempio.it/x'],
  ['con un trattino basso nel nome', 'https://radio_x.esempio.it/a'],
  ['con uno spazio nel percorso', 'https://radio.esempio.it/a b'],
  ['con una virgoletta nel percorso', 'https://radio.esempio.it/a"b'],
  ['con un nome non ASCII', 'https://münchen.esempio.de/a'],
  ['con il punto finale', 'https://radio.esempio.it./a'],
  ['troppo lungo', 'https://radio.esempio.it/' + 'a'.repeat(500)],
]) {
  prova(`un indirizzo ${cosa} non è una radio`, () => m.fonteDelLink(link), null)
}
prova('un link di YouTube sbagliato non diventa una radio', () => m.fonteDelLink('https://www.youtube.com/foo'), null)
prova('un link di Spotify sbagliato non diventa una radio', () => m.fonteDelLink('https://open.spotify.com/foo'), null)
prova('un indirizzo https con porta e percorso resta una radio', () => m.fonteDelLink('https://radio.esempio.it:8443/a/b.mp3'), 'radio')
prova('YouTube con http:// vale come prima', () => m.fonteDelLink('http://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube')

console.log('\nFile: l\'ordine casuale')
for (const n of [1, 2, 5, 20]) {
  prova(
    `con ${n} brani suonano tutti, una volta sola, prima di ripetere`,
    () => Array.from({ length: 200 }, (_, s) => JSON.stringify(ordinati(m.ordineCasuale(n, seme(s + 1))))).every((o) => o === JSON.stringify(tutti(n))),
    true,
  )
  // Rimescolato dopo l'ultimo brano: il primo nuovo non è quello appena suonato.
  if (n > 1) {
    prova(
      `con ${n} brani, rimescolando, non si riparte dall'ultimo suonato`,
      () => Array.from({ length: 200 }, (_, s) => m.ordineCasuale(n, seme(s + 1), (s + 1) % n)[0] !== (s + 1) % n).every(Boolean),
      true,
    )
  }
}
prova('con un brano solo ripete lo stesso, anche se è l\'ultimo', () => m.ordineCasuale(1, seme(1), 0), [0])
prova('senza brani non c\'è niente da suonare', () => m.ordineCasuale(0, seme(1)), [])
prova('la coda nuova parte dal primo dell\'ordine', () => m.nuovaCoda(4, seme(3)).pos, 0)
prova('la coda nuova ha tutti i brani', () => ordinati(m.nuovaCoda(4, seme(3)).ordine), [0, 1, 2, 3])
prova('si suonano tutti prima di ripetere, poi si rimescola', () => {
  let c = m.nuovaCoda(4, seme(9))
  const suonati = [c.ordine[c.pos]]
  for (let i = 0; i < 3; i++) {
    c = m.avantiCoda(c, seme(10 + i))
    suonati.push(c.ordine[c.pos])
  }
  const primaVolta = ordinati(suonati)
  const ultimo = suonati[3]
  c = m.avantiCoda(c, seme(20))
  return [primaVolta, c.pos, c.ordine[c.pos] !== ultimo, ordinati(c.ordine)]
}, [[0, 1, 2, 3], 0, true, [0, 1, 2, 3]])
prova('con un brano solo ⏭ ripete lo stesso', () => {
  const c = m.avantiCoda(m.nuovaCoda(1, seme(1)), seme(2))
  return [c.ordine, c.pos]
}, [[0], 0])

console.log('\nFile: ⏭ e ⏮')
const coda = (pos) => ({ ordine: [2, 0, 3, 1], pos })
prova('⏭ passa al brano dopo, nell\'ordine', () => m.avantiCoda(coda(1), seme(1)), { ordine: [2, 0, 3, 1], pos: 2 })
prova('⏮ dopo più di 3 secondi riparte da capo lo stesso brano', () => m.indietroCoda(coda(2), 3.5), { coda: coda(2), daCapo: true })
prova('⏮ entro i 3 secondi va al precedente', () => m.indietroCoda(coda(2), 1), { coda: coda(1), daCapo: false })
prova('⏮ a 3 secondi esatti va al precedente: «più di 3» vuol dire più', () => m.indietroCoda(coda(2), 3), { coda: coda(1), daCapo: false })
prova('⏮ dal primo brano ricomincia il primo', () => m.indietroCoda(coda(0), 1), { coda: coda(0), daCapo: true })

console.log('\nFile: un brano illeggibile')
prova('si salta al successivo', () => m.dopoErrore(coda(0), [2], seme(1)), { coda: coda(1) })
prova('più illeggibili di fila: si salta anche quelli', () => m.dopoErrore(coda(0), [2, 0], seme(1)), { coda: coda(2) })
prova('in fondo all\'ordine si rimescola e si trova quello buono', () => {
  const r = m.dopoErrore(coda(3), [1, 2, 0], seme(4))
  return 'coda' in r ? r.coda.ordine[r.coda.pos] : r
}, 3)
prova('se sono tutti illeggibili: errore che dice cosa fare, e finisce lì', () => m.dopoErrore(coda(1), [0, 1, 2, 3], seme(1)), {
  errore: 'Non riesco a leggere questi file: scegli file MP3 o AAC',
})
prova('con un brano solo illeggibile: lo stesso errore', () => m.dopoErrore({ ordine: [0], pos: 0 }, [0], seme(1)), {
  errore: 'Non riesco a leggere questi file: scegli file MP3 o AAC',
})

console.log('\nRadio')
prova('il titolo è il nome della lista', () => m.radio('Radio Rock', 'https://stream.radio.example/rock').titolo, 'Radio Rock')
prova('senza nome il titolo è l\'indirizzo', () => m.radio('  ', 'https://stream.radio.example/rock').titolo, 'https://stream.radio.example/rock')
prova('⏮ e ⏭ sono spenti', () => {
  const r = m.radio('Radio Rock', 'https://stream.radio.example/rock')
  return [r.indietro, r.avanti]
}, [false, false])
prova('se la radio dà errore dice cosa fare e c\'è «Riprova»', () => m.erroreRadio(), {
  messaggio: 'La radio non parte: controlla la rete e riprova.',
  tasto: 'Riprova',
})

console.log('\nFile: l\'elenco sul tablet')
const elenco = [brano(1), brano(2), brano(3)]
prova('si toglie un file e gli altri restano', () => m.togliFile(elenco, 'f2'), [brano(1), brano(3)])
prova('togliere un file che non c\'è non cambia niente', () => m.togliFile(elenco, 'f9'), elenco)
prova('se ne aggiungono altri: i vecchi restano, in ordine', () => m.aggiungiFile(elenco, [brano(4), brano(5)]), [...elenco, brano(4), brano(5)])
prova('lo stesso file scelto due volte entra una volta sola', () => m.aggiungiFile(elenco, [brano(3), brano(4)]), [...elenco, brano(4)])
prova('si svuota l\'elenco', () => m.svuotaFile(elenco), [])
prova('aggiungere non fa ripartire da zero: la coda va avanti da dove era', () => {
  const c = m.aggiungiACoda({ ordine: [2, 0, 1], pos: 1 }, 2, seme(5))
  return [c.pos, c.ordine.slice(0, 2), ordinati(c.ordine)]
}, [1, [2, 0], [0, 1, 2, 3, 4]])
prova('i file spariti dalla memoria del browser: lo dice, con cosa fare', () => m.erroreMemoria(3, 0), 'Non trovo più i tuoi file, sceglili di nuovo')
prova('i file ci sono: niente messaggio', () => m.erroreMemoria(3, 3), null)
prova('nessun file scelto: niente messaggio', () => m.erroreMemoria(0, 0), null)

console.log('\nFile: tolto un brano si rifà l\'ordine')
prova('il brano che suona resta il primo della coda nuova', () => {
  const c = m.codaDopoTolta([brano(1), brano(2), brano(3)], 'f2', seme(7))
  return [c.pos, c.ordine[0], ordinati(c.ordine)]
}, [0, 1, [0, 1, 2]])
prova('se il brano che suonava non c\'è più, si ricomincia con tutti i brani', () => {
  const c = m.codaDopoTolta([brano(1), brano(3)], 'f2', seme(7))
  return [c.pos, ordinati(c.ordine)]
}, [0, [0, 1]])
prova('senza più brani la coda è vuota', () => m.codaDopoTolta([], 'f1', seme(1)), { ordine: [], pos: 0 })
prova('senza un brano che suona si parte da capo', () => m.codaDopoTolta([brano(1), brano(2)], null, seme(1)).pos, 0)

console.log('\nUna fonte sola alla volta')
for (const da of ['spotify', 'youtube', 'file', 'radio']) {
  for (const a of ['spotify', 'youtube', 'file', 'radio']) {
    if (da !== a) prova(`da ${da} a ${a}: si ferma ${da}`, () => m.cosaSiFerma(da, a), [da])
  }
}
prova('scegliere la stessa fonte non ferma niente', () => m.cosaSiFerma('file', 'file'), [])
prova('la prima scelta non ferma niente', () => m.cosaSiFerma(null, 'radio'), [])

console.log('\nIl player musicale spento')
const impostazioni = (musica, musicaFonte) => ({ musica, musicaFonte, youtube: 'https://youtu.be/dQw4w9WgXcQ' })
const pieno = { spotifyCollegato: true, nFile: 3, radio: 'https://stream.radio.example/rock' }
for (const f of ['spotify', 'youtube', 'file', 'radio']) {
  prova(`${f}: spento, niente suona e niente compare`, () => m.musicaPronta(impostazioni(false, f), pieno), false)
  prova(`${f}: acceso e con qualcosa da suonare, compare`, () => m.musicaPronta(impostazioni(true, f), pieno), true)
}
prova('file: acceso ma senza file scelti, non compare', () => m.musicaPronta(impostazioni(true, 'file'), { ...pieno, nFile: 0 }), false)
prova('radio: accesa ma senza indirizzo, non compare', () => m.musicaPronta(impostazioni(true, 'radio'), { ...pieno, radio: null }), false)
prova('Spotify non collegato, non compare', () => m.musicaPronta(impostazioni(true, 'spotify'), { ...pieno, spotifyCollegato: false }), false)
prova('l\'interruttore di prima vale ancora', () => m.musicaAttiva({ musica: false }, true), false)

console.log('\nLe parole')
// Il timer sta anche sul telefono (app istruttori): «del tablet» lì sarebbe sbagliato.
prova('nelle impostazioni: FILE, su tablet e telefono', () => m.TESTI_MUSICA.file, 'FILE')
prova('nelle impostazioni: RADIO', () => m.TESTI_MUSICA.radio, 'RADIO')
prova('sotto i file: «File su questo apparecchio»', () => m.TESTI_MUSICA.fileQui, 'File su questo apparecchio')
prova('niente parole da tecnici nei testi per chi usa l\'app', () => {
  // Il messaggio sul formato è l'unico che può dire MP3.
  const { fileIlleggibili, ...resto } = m.TESTI_MUSICA
  const vietate = /stream|mp3|\bgiro\b|rimescola/i
  const testi = [...Object.values(resto), m.erroreRadio().messaggio, m.erroreDelLink('http://a.it/b') ?? '', m.erroreMemoria(1, 0) ?? '', fileIlleggibili.replace(/MP3 o AAC/, '')]
  return testi.filter((t) => vietate.test(t))
}, [])
prova('i testi non sono vuoti', () => Object.values(m.TESTI_MUSICA).every((t) => t.length > 0), true)

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
