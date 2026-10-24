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

## Lettura con VoiceOver (2026-10-24)

`scripts/leggi-voiceover.mjs` apre in Safari le 20 pagine della sitemap e
fa leggere a VoiceOver, con Guidepup, ogni elemento dall'inizio alla fine
(macOS 27, Safari). Tutte le pagine si leggono per intero, con menu, titoli,
elenchi e piè di pagina; le immagini di contenuto hanno una descrizione sensata.

Trovato:

- salto di livello nei titoli (h1 → h3) su `/istruttori/`,
  `/mga-metodo-globale-di-autodifesa/` e `/pre-pugilistica/`;
- in `/privacy/` due link che VoiceOver legge solo «informativa».

I salti di titolo sono corretti nel generatore (`titoliInOrdine`, prova in
`prova-sito-titoli.mjs`); il link «informativa» sta nel testo della privacy, che
si cambia dall'editor del sito: «informativa di GitHub» e «informativa di
GoatCounter». Nessun altro difetto. Il reflow di giocomotricità, trovato dalla scansione, è
già corretto. Se una pagina resta ferma su «Salta al contenuto» è la prova
che parte troppo presto: `PAUSA=9000` e, per rileggere solo alcune pagine,
`PAGINE=url1,url2`.

## Per la Dichiarazione

Stato onesto: «parzialmente conforme», finché i salti di titolo e il link
«informativa» non sono sistemati. Dichiarazione compilata:

- **Gestore**: ASD Il Centro Judo, Corso Francia 224, Rivoli (TO).
- **Contenuti non accessibili**: i titoli di tre pagine saltano un livello
  e in una pagina un link si legge solo «informativa»; chi usa un lettore di
  schermo li trova comunque, ma l'ordine dei titoli è meno chiaro.
- **Verifica**: 24 ottobre 2026; controllo automatico (axe, larghezza a 320 px,
  tastiera) e lettura di tutte le pagine con VoiceOver su Safari.
- **Contatto**: asdilcentrojudo@gmail.com, 346 329 2786.

Il testo si scrive e si pubblica dall'editor del sito (la pagina nasce come
bozza): non si cambia il SQL, che non riscrive una pagina già presente.

## Come si rifà

Axe sulle pagine della sitemap con Playwright, come `scripts/prova-a11y-axe.mjs`
ma contro il sito vero (lo script non è nel repo); la lettura con
`node scripts/leggi-voiceover.mjs` (serve `npx @guidepup/setup`, una volta).
