# Audit visivo di Chi siamo — officinedellosport.it/chi-siamo

Data: 2026-10-18. Sito pubblico e database non toccati. Misure a 1440, 768, 375 px, tema chiaro (browser integrato per i numeri, Chrome headless per gli screenshot; il 375 è reso in un iframe da 375 px, `scrollWidth` = 375: nessun overflow orizzontale).
Screenshot in `img/`: pagina intera `chi-1440-full.png`, `chi-768-full.png`, `chi-375-full.png`; fette `d-0…d-3` (1440), `t-0…t-2` (768), `m-0…m-3` e foglio `m-sheet.png` (375).

**Attenzione: il sito pubblicato non è `docs/sito/chi-siamo.html`.** Il file in repo è la versione «come nel design» ancora da incollare; la pagina pubblicata non ha il pulsante «Conosci gli istruttori» (nessun link dentro `main`) e il pannello «Gli istruttori» non porta da nessuna parte. L'audit descrive la pagina pubblicata e dice dove la bozza in repo la sistema già.

## Cosa funziona (da non toccare)

- Un solo `h1`, `lang="it"`, font caricati (Big Shoulders Display + Inter), `:focus-visible` definito.
- Palette coerente con la home (blu, giallo, inchiostro su fondo azzurro chiaro): contrasti già buoni (home: 5,46:1 bianco su blu, 8,95:1 inchiostro su giallo).
- Foto in alto larga e leggibile a 1440 (gruppo intero, nessun volto tagliato); alt su tutte le foto.
- Nessun overflow a 375; i numeri (300+, 13, 8, 35+) a due colonne sul telefono funzionano.

## Problemi, in ordine di priorità

### ALTA

**1. Le due tessere «Chi siamo oggi» / «Come tutto è iniziato» sono sbilanciate.** Stessa riga, stessa altezza, ma: titolo da 30 px contro 64 px (1440), 30 contro 44 px (768/375); testo da 17 px contro 21 px; il testo di sinistra è ancorato in basso con 200 px vuoti sopra, quello di destra parte in alto. Sembrano due pagine diverse. Prova: `d-0.png` (in basso), `d-1.png`. 
Proposta: stessa dimensione di titolo e testo (titolo 48 px, testo 20 px), stessa ancora in alto, stessa altezza.

**2. La frase grande sulla foto: righe che si toccano e foto che perde i lati.** «Nasciamo dal judo, mettiamo al centro la persona» è 76 px con `line-height` 68 px (0,9) e va a capo su 5 righe: accenti e discendenti si toccano («DAL JUDO,» sopra «METTIAMO»). Sul telefono la frase finisce incollata sotto la foto (zero spazio) e la foto di gruppo, 1800×1012, è tagliata a 343×300: si perdono i lati del gruppo. Prova: `d-0.png`, `m-0.png`.
Proposta: 56-64 px a 1440, `line-height` 1, 3 righe; foto con fuoco sul gruppo (50% 55%) e box 3:2 anche sul telefono; 16 px di stacco tra foto e frase.

**3. CTA finale: «PROVA» da 170 px a contatto con la frase, metà vuota, nessun pulsante.** Stesso difetto della home (audit home n. 3): il testo «Vieni a provare…» tocca la parola enorme; nel `main` non c'è nessun link; tra CTA e piede ci sono 6 px. Prova: `d-3.png`.
Proposta: stessa chiamata finale della home (titolo «Una settimana per scegliere.», frase con indirizzo, pulsante pieno «Prova una settimana a 5 €», 24 px di stacco dal piede).

**4. «Gli istruttori»: pannello che non porta da nessuna parte, con miniature da 64-132 px.** Nel sito pubblicato non c'è il pulsante; le quattro foto sono 132 px a 1440, 64 px a 768 e 375: troppo piccole per riconoscere qualcuno. Solo la prima (814a717b) mostra istruttori; le altre due sono lezioni di judo (12e605fc, 46c39293) e una è aikido (fbfe492b). Proposta: pulsante «Conosci gli istruttori» (già nella bozza), una foto sola (814a717b) a tutta altezza del pannello e basta.

**5. Foto ripetute e «incollate»: aikido (fbfe492b) due volte in 800 px.** Compare nella striscia del pannello istruttori e subito sotto nella fila di quattro. A 768 e 375 la fila di quattro diventa due foto (sala e cubi spariscono, `display:none`), quindi sul telefono il lettore vede lotta + aikido (di nuovo). La fila non ha titolo né didascalia: è decorazione senza legame con il testo. Prova: `d-0.png`, `t-1.png`, `m-sheet.png`.
Proposta: la fila di quattro diventa una fila che dice qualcosa («Dove ci alleniamo» o simile, vedi testi), con quattro foto diverse, nessuna già usata nel pannello, e su telefono tutte e quattro in griglia 2×2 (o rimosse: scelta da fare).

### MEDIA

**6. Gerarchia dei titoli piatta e rotta.** Un `h1`, poi tre `h3` senza `h2` («Chi siamo oggi», «Come tutto è iniziato», «Gli istruttori», «Alleniamo il corpo…»), poi un `h2` («I nostri valori»), poi altri `h3`. Per chi usa lo screen reader la pagina salta da `h1` a `h3`. Visivamente: «I nostri valori» 120 px, «Gli istruttori» 120 px, «Alleniamo il corpo…» 120 px su due righe (215 px), «Come tutto è iniziato» 64 px, «Chi siamo oggi» 30 px, valori 58 px: sei misure, nessun ordine. Proposta: una scala sola: sezione 80 px, tessera 40 px (come home), testo 20 px; `h2` per le sezioni, `h3` per le tessere.

**7. Missione: titolo da 120 px su due righe e testo piccolo.** Il blocco giallo ripete la stessa «voce» del titolo della pagina; testo 24 px stretto in 820 px. Il titolo è la frase migliore della pagina, ma è subito dopo un altro blocco con titolo da 120 px: la pagina urla due volte di fila. Proposta: 80 px, a sinistra col testo, foto di un allenamento a destra (non nel blocco giallo) o lasciare solo testo.

**8. «I nostri valori»: quattro tessere con titolo da 58 px e una riga.** Titoli lunghi che vanno a capo («PERCORSI CHE DURANO NEL TEMPO») alzano una tessera, le altre restano vuote in basso (altezze 190/190/200/200 con testo da 1 riga). Il testo sotto ripete il titolo («Centralità della persona» / «Mettiamo le persone al centro»). Proposta: titoli 36-40 px, testo di una frase che aggiunge qualcosa (vedi testi); tessere alte uguali.

**9. Numeri: «300+» riempie la tessera.** Il numero da 96 px occupa quasi tutta la larghezza a 1440 (300+ finisce a ~23 px dal bordo destro, `d-1.png`) e ha un aspetto più pesante di «8» e «13». Le quattro tessere sono in tre colori. Proposta: stessa tessera della home (SitoTessera), 4 uguali, numero 72 px.

**10. Dati.** 13 tecnici (nel testo scritto «Tredici»), 8 attività (la home e le schede ne mostrano 9), 35+ anni, 300+ atleti. Confermati dall'utente il 18 ottobre: 9 attività, il resto invariato.

**11. Alt sbagliati nel sito pubblicato.** Hero: «atleti in judogi» — in foto bambini e adulti in maglietta blu (non judogi). Lotta: «Il gruppo di lotta in posa sul materasso, con le tute rosse e blu» — la foto è un incontro, non una posa. Aikido (bozza): «giovane allieva» ok ma la stessa foto è descritta in due modi diversi. Da correggere nelle proposte.

**12. Spaziature irregolari.** Tra hero e tessere ~95 px, tra tessere e numeri 96 px, tra numeri e istruttori 96, tra fila di foto e missione 96, tra valori e CTA ~190 px, tra CTA e piede 6 px. Proposta: un solo passo (96 px / 64 px sul telefono), 24 px tra chiamata e piede.

### BASSA

**13. Bersagli < 44 px.** Voci del menu 39 px di altezza (1440); a 768 le voci stanno già a 44 px, ma i link del piede (Instagram, Facebook, Home, I corsi…, Privacy, Cookie, Contributi) sono alti 20-30 px a tutte le larghezze (sul telefono i link del piede sono in riga separati da «·»). Proposta: 48 px (padding) come nella home.

**14. Foto senza `width`/`height`, senza `srcset`, hero senza `fetchpriority`.** Come nella home (audit n. 15): 8 foto da 1201-1800 px scaricate intere anche in riquadri da 132 px (64 px sul telefono); possibile salto di layout. Non è da mockup: nota per chi pubblica.

**15. Nessun tema scuro, `color-scheme: normal`.** Come nella home (n. 14). Non è un difetto se non lo si vuole.

**16. Lunghezza.** 4951 px a 1440, 4349 a 768, 5199 a 375: pagina corta e ben misurata; il difetto non è la lunghezza ma il ritmo.

## Riepilogo per priorità

| # | Problema | Priorità |
|---|---|---|
| 1 | Tessere «oggi»/«iniziato» sbilanciate (30 vs 64 px) | alta |
| 2 | Frase grande: righe che si toccano, foto tagliata sul telefono | alta |
| 3 | CTA finale: «PROVA» da 170 px, nessun pulsante | alta |
| 4 | «Gli istruttori»: nessun pulsante, miniature 64-132 px | alta |
| 5 | Aikido due volte, fila foto senza senso, due foto nascoste su telefono | alta |
| 6 | Gerarchia titoli piatta (h1→h3) e sei misure | media |
| 7 | Missione: 120 px su due righe, subito dopo altro 120 px | media |
| 8 | Valori: tessere con una riga, titoli che vanno a capo | media |
| 9 | Numeri: «300+» a contatto col bordo | media |
| 10 | Dati da confermare (13/8/35+/300+) | media |
| 11 | Alt sbagliati (hero «judogi», lotta «in posa») | media |
| 12 | Spazi tra sezioni da 6 a 190 px | media |
| 13 | Bersagli < 44 px (piede, menu a 1440) | bassa |
| 14 | Foto senza width/height/srcset | bassa |
| 15 | Niente tema scuro | bassa |

## Limiti

- Sito pubblicato ≠ bozza in repo (vedi sopra): le proposte partono dalla bozza `docs/sito/chi-siamo.html`.
- Screenshot di Chrome headless; 768 e 375 misurati nel browser integrato a larghezza emulata. Nessuna prova su dispositivi veri.
- Contrasti non ricalcolati: stessa palette della home. Fuoco da tastiera e tema scuro non guardati.
