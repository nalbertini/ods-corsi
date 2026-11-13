// ---------------------------------------------------------------------------
// L'appello in un Chromium vero, in modalità prova e alla misura del telefono:
// quel che le regex non vedono (il fuoco, cosa copre cosa).
//
//   npm run build && node scripts/prova-appello-browser.mjs
//
// Aperto il menu il fuoco va sul foglio e col TAB non esce: il foglio si dice
// `aria-modal` e dietro il velo c'è l'elenco da segnare. Chiuso (CHIUDI IL
// MENU, ESC, tocco sul velo, AZZERA confermato) il fuoco torna sul ⋯: con la
// tastiera o il lettore di schermo non si riparte dal fondo della pagina.
// Le regex di prova-istruttori-look.mjs dicevano che il codice c'era, non che
// funzionava: il TAB che scappava dietro il velo lo ha trovato il browser.
//
// Il Chromium è quello di Playwright (`npx playwright install chromium`, come
// in CI); dove ce n'è un altro già installato si passa con CHROMIUM=<percorso>.
// ---------------------------------------------------------------------------
import { chromium } from 'playwright'
import { preview } from 'vite'

let fallite = 0
const ok = (cosa, avuto, voluto) => {
  const bene = JSON.stringify(avuto) === JSON.stringify(voluto)
  if (!bene) fallite++
  console.log(`${bene ? 'ok  ' : 'KO  '}${cosa}${bene ? '' : ` — avuto ${JSON.stringify(avuto)}, voluto ${JSON.stringify(voluto)}`}`)
}

const server = await preview({ preview: { port: 4398, strictPort: true } })
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})

try {
  const pagina = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const errori = []
  pagina.on('pageerror', (e) => errori.push(e.message))
  await pagina.goto('http://localhost:4398/istruttori/?prova')
  await pagina.waitForLoadState('networkidle')
  // Un appello aperto a qualunque ora: le lezioni passate con qualcuno da segnare (i dati di prova sono relativi a oggi).
  await pagina.getByRole('button', { name: /APPELLI DA CHIUDERE/ }).click()
  await pagina.getByRole('button', { name: /da segnare/ }).first().click()

  const tasto = pagina.getByRole('button', { name: /^Altro: azzera/ })
  await tasto.waitFor()

  // L'appello fitto (proposta in docs/design-canvas/appello-telefono-spazio/): la testa resta a 90px anche a 375,
  // dove «lunedì 9 novembre 19:00 · Tatami» andava a capo e la portava a 104 (l'ha trovato il collaudo).
  await pagina.setViewportSize({ width: 375, height: 667 })
  const altaTesta = await pagina.locator('.appello-testa').evaluate((e) => Math.round(e.getBoundingClientRect().height))
  ok('a 375px la testa dell\'appello è alta al più 92px', altaTesta <= 92 ? 'sì' : `${altaTesta}px`, 'sì')
  // A 390×760, striscia dei dati di prova compresa, i nomi interi sopra CHIUDI sono almeno 9.
  await pagina.setViewportSize({ width: 390, height: 760 })
  const interi = await pagina.evaluate(() => {
    const fondo = document.querySelector('.barra-chiudi')?.getBoundingClientRect().top ?? innerHeight
    const cima = document.querySelector('.appello-testa')?.getBoundingClientRect().bottom ?? 0
    return [...document.querySelectorAll('.elenco-appello .riga-appello')].filter((r) => {
      const b = r.getBoundingClientRect()
      return b.top >= cima && b.bottom <= fondo
    }).length
  })
  ok('a 390×760 si vedono almeno 9 nomi interi', interi >= 9 ? 'sì' : `${interi}`, 'sì')
  await pagina.setViewportSize({ width: 390, height: 844 })

  const foglio = pagina.getByRole('dialog', { name: 'Altro dell’appello' })
  /** Dove sta il fuoco: «foglio», «tasto ⋯», «nel foglio: <nome>» o «fuori: <nome>». */
  const fuoco = () =>
    pagina.evaluate(() => {
      const a = document.activeElement
      const f = document.querySelector('.foglio-appello')
      const nome = (x) => (x?.getAttribute('aria-label') || x?.textContent || x?.tagName || '').trim().slice(0, 40)
      if (!a || a === document.body) return 'nessuno'
      if (a === f) return 'foglio'
      if (a.classList.contains('appello-menu')) return 'tasto ⋯'
      return f?.contains(a) ? `nel foglio: ${nome(a)}` : `fuori: ${nome(a)}`
    })
  const apri = async () => {
    // Se un passo prima non l'ha chiuso, lo si chiude: una KO sola, non un tempo scaduto su tutte le altre.
    if (await foglio.count()) await foglio.getByRole('button', { name: 'CHIUDI IL MENU' }).click()
    await tasto.click()
    await foglio.waitFor()
  }

  // Aperto: il fuoco va sul foglio.
  await apri()
  ok('aperto il menu, il fuoco è sul foglio', await fuoco(), 'foglio')
  ok('il ⋯ dice che il menu è aperto', await tasto.getAttribute('aria-expanded'), 'true')

  // TAB e MAIUSC+TAB girano dentro il foglio, senza passare dietro il velo.
  const giro = []
  for (let i = 0; i < 6; i++) {
    await pagina.keyboard.press('Tab')
    giro.push(await fuoco())
  }
  ok('col TAB il fuoco resta nel foglio', giro.filter((x) => !x.startsWith('nel foglio')), [])
  const indietro = []
  for (let i = 0; i < 6; i++) {
    await pagina.keyboard.press('Shift+Tab')
    indietro.push(await fuoco())
  }
  ok('col MAIUSC+TAB il fuoco resta nel foglio', indietro.filter((x) => !x.startsWith('nel foglio')), [])

  // ESC chiude e il fuoco torna sul ⋯.
  await pagina.keyboard.press('Escape')
  ok('ESC chiude il menu', await foglio.count(), 0)
  ok('chiuso con ESC, il fuoco torna sul ⋯', await fuoco(), 'tasto ⋯')
  ok('il ⋯ dice che il menu è chiuso', await tasto.getAttribute('aria-expanded'), 'false')

  // CHIUDI IL MENU.
  await apri()
  await foglio.getByRole('button', { name: 'CHIUDI IL MENU' }).click()
  ok('chiuso con CHIUDI IL MENU, il fuoco torna sul ⋯', await fuoco(), 'tasto ⋯')

  // Un tocco sul velo, sopra il foglio.
  await apri()
  await pagina.locator('.foglio-appello-velo').click({ position: { x: 195, y: 60 } })
  ok('un tocco sul velo chiude il menu', await foglio.count(), 0)
  ok('chiuso col velo, il fuoco torna sul ⋯', await fuoco(), 'tasto ⋯')

  // AZZERA, col secondo tocco: azzera, chiude e il fuoco torna sul ⋯ (non resta su un tasto smontato).
  await apri()
  await foglio.getByRole('button', { name: 'AZZERA L’APPELLO' }).click()
  // DueTocchi scarta un secondo tocco entro mezzo secondo dal primo: è il doppio tocco delle mani sudate.
  await pagina.waitForTimeout(600)
  await foglio.getByRole('button', { name: 'SÌ, TOGLI TUTTI I SEGNI' }).click()
  ok('AZZERA confermato chiude il menu', await foglio.count(), 0)
  ok('chiuso con AZZERA, il fuoco torna sul ⋯', await fuoco(), 'tasto ⋯')

  // Riaperto dopo AZZERA, con zero segni il tasto è spento: il TAB resta comunque dentro.
  await apri()
  await pagina.keyboard.press('Tab')
  await pagina.keyboard.press('Tab')
  ok('con AZZERA spento, il TAB resta nel foglio', (await fuoco()).startsWith('nel foglio'), true)
  await pagina.keyboard.press('Escape')
  ok('e ESC lo richiude sul ⋯', await fuoco(), 'tasto ⋯')

  // Nessuno segnato e un tocco su CHIUDI: accanto al tasto che chiede compare TUTTI PRESENTI al posto di + PROVA,
  // e CHIUDI dice cosa fa il secondo tocco (proposta in docs/design-canvas/appello-tutti-assenti/, tavola C).
  await pagina.setViewportSize({ width: 360, height: 740 })
  await pagina.locator('.btn-chiudi').click()
  const rimedio = pagina.locator('.barra-chiudi .btn-rimedio')
  // La barra cambia dopo che il tasto ha detto «chiedo» (un effetto): si aspetta, senza farne una KO a tempo scaduto.
  await rimedio.waitFor({ timeout: 2000 }).catch(() => {})
  ok('nessuno segnato, al primo tocco di CHIUDI c\'è TUTTI PRESENTI', await rimedio.count(), 1)
  ok('e + PROVA non c\'è', await pagina.locator('.barra-chiudi .btn-prova').count(), 0)
  ok('CHIUDI dice «Tutti assenti? Tocca di nuovo»', /Tutti assenti\? Tocca di nuovo/.test(await pagina.locator('.btn-chiudi').innerText()), true)
  const misure = await pagina.evaluate(() => ({
    largo: document.documentElement.scrollWidth <= innerWidth,
    bassi: [...document.querySelectorAll('.barra-chiudi .btn')].filter((b) => b.getBoundingClientRect().height < 44).length,
  }))
  ok('a 360px niente scorrimento di lato, tasti alti almeno 44px', misure, { largo: true, bassi: 0 })
  await rimedio.click()
  await pagina.locator('.barra-chiudi .btn-prova').waitFor()
  ok('TUTTI PRESENTI segna tutti: nessuno resta da segnare', await pagina.locator('.btn-chiudi').innerText().then((t) => /non segnat/.test(t)), false)
  await pagina.setViewportSize({ width: 390, height: 844 })

  // + PROVA: la riga di chi è appena entrato si vede, non resta sotto la barra
  // CHIUDI ferma in fondo (l'ha trovato il collaudo: c'era solo «PROVE 1»).
  await pagina.locator('.btn-prova').click()
  await pagina.getByRole('button', { name: /NON LO TROVO/ }).click()
  const campi = pagina.locator('input:visible')
  await campi.nth(1).fill('Ada')
  await campi.nth(2).fill('Lovelace')
  await pagina.getByRole('button', { name: 'AGGIUNGI' }).click()
  const riga = pagina.locator('.riga-prova').first()
  await riga.waitFor()
  await pagina.waitForTimeout(800) // lo scorrimento è morbido
  const [r, barra] = await Promise.all([riga.boundingBox(), pagina.locator('.barra-chiudi').boundingBox()])
  ok('+ PROVA: la riga nuova finisce sopra la barra CHIUDI', !!r && !!barra && r.y + r.height <= barra.y, true)

  ok('nessun errore nella pagina', errori, [])
} finally {
  await browser.close()
  server.httpServer.close()
}

process.exit(fallite ? 1 : 0)
