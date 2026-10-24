# Accessibilità del sito pubblico: stato

Scansione del 2026-10-24 su `www.officinedellosport.it`, tutte le 20 pagine
della sitemap. È la base per compilare la Dichiarazione di accessibilità
(`src/lib/sitoAccessibilita.ts`); non la compila e non la pubblica.

## Come è stata fatta

- **axe-core** (regole WCAG 2.0/2.1/2.2 A e AA) su ogni pagina a 1280 e a 375 px:
  40 scansioni.
- **Reflow** (WCAG 1.4.10): ogni pagina a 320 px, cercando lo scorrimento
  orizzontale.
- **Tastiera**: su ogni pagina a 1280 px, fino a 60 Tab, controllando che il
  fuoco si veda.
- **Struttura**: `lang`, un solo `h1`, `main`, link «Salta al contenuto», `alt`
  su ogni immagine.

## Esito

| Controllo | Esito |
|---|---|
| axe, 40 scansioni | **nessuna violazione** |
| `lang="it"`, un `h1`, `main`, «Salta al contenuto», `alt` | ok su tutte le pagine |
| Tastiera: ordine e fuoco visibile | ok (il fuoco è un anello sul riquadro, non sul link: visto a schermo su `/corsi/`) |
| Reflow a 320 px | **1 pagina su 20 non passa** |

## Da correggere

**`/giocomotricita-e-psicomotricita/`** (WCAG 1.4.10, Reflow): a 320 px la
pagina scorre in orizzontale di 24 px. La causa è la tessera «Quando», con gli
orari lunghi («Martedì e giovedì (giocomotricità), venerdì …»): il testo
non va a capo e allarga le tessere (`.tessere` 328 px in una colonna di 288).
Le altre pagine, Judo compresa, stanno in 320 px.

## Cosa non è coperto

- **Lettore di schermo** (VoiceOver, TalkBack): axe non dice se i testi sono
  sensati letti ad alta voce. Va fatta a mano da chi può, e la data va nella
  dichiarazione.
- **Zoom del testo al 200 %** e contrasto di foto con testo sopra: non misurati.
- **Il modulo di iscrizione** vive nell'app (`iscrizioni/`), coperto da
  `docs/qa/accessibilita.md`, non da questa scansione.
- **Pagine nascoste o in bozza**: non sono in sitemap, quindi non scansionate
  (la Dichiarazione stessa è una bozza finché non si pubblica).

## Per la Dichiarazione

Con questo esito la sezione «Contenuti non accessibili» può dire: la pagina di
giocomotricità non si legge bene a 320 px per via delle tessere degli orari,
con la data in cui sarà sistemata. Lo stato di conformità («conforme»,
«parzialmente conforme») lo decide chi pubblica, dopo la prova col lettore di
schermo: con un difetto di reflow aperto, «parzialmente conforme» è l'unica
dicitura onesta.

## Come si rifà

Lo script non è nel repo: axe sulle pagine della sitemap con Playwright, come
`scripts/prova-a11y-axe.mjs` ma contro il sito vero.
