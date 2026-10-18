# Audit visivo della home — officinedellosport.it

Data: 2026-10-18. Sito pubblico non toccato, database non toccato.
Misure: 1440, 768, 375 px, tema chiaro. **Tema scuro: non esiste** (nessun `prefers-color-scheme: dark`, nessun `color-scheme`): non c'è niente da verificare, vedi problema 14.

Screenshot in `img/`: pagina intera `home-1440-full.png`, `home-768-full.png`, `home-375-full.png`; fette leggibili `d-0…d-5` (1440), `t-0…t-4` (768), `m-0…m-5` (375).
I 768 e 375 sono resi in un iframe della larghezza giusta; il 375 reale misurato nel browser integrato non ha scroll orizzontale (`scrollWidth` = 375).

## Cosa funziona (da non toccare)

- Un solo `h1`, `lang="it"`, landmark `header/nav/main/footer`, font caricati (Big Shoulders Display, Inter).
- Contrasti buoni: bianco su blu 5,46:1; inchiostro su giallo 8,95:1; bianco su inchiostro 14,83:1; inchiostro su fondo 13,48:1.
- `:focus-visible` definito con colore per sfondo (blu / giallo / inchiostro). Nessun overflow orizzontale a 375.
- Alt descrittivi su tutte le foto di contenuto; foto sotto la piega `loading=lazy`.
- Schede corso e griglia «Perché» si adattano bene a 768 e 375.

## Problemi, in ordine di priorità

### ALTA

**1. Hero desktop: titolo e sottotitolo si toccano.** `h1` finisce a y=940, il `p` parte a y=940: zero spazio, «TATAMI.» appoggiato al testo. Il titolo è 227 px su 4 righe con `line-height` 0,82; riempie 750 px di altezza e spinge tutto il resto sotto la piega (a 900 px di altezza si vede solo il titolo).
Prova: `img/d-0.png`.
Proposta: `clamp()` più basso (≈ 150–170 px a 1440, 3 righe «SI CRESCE / SUL TATAMI.»), `margin-top` ≥ 24 px sul sottotitolo, e un pulsante «Prova una settimana» accanto al sottotitolo. Hero alto ~620 px invece di 1006.

**2. Hero desktop: la foto di gruppo è ritagliata a verticale.** La foto è 1800×1012 (orizzontale) ma sta in un box 317×530: si perdono i lati del gruppo (bambini e istruttori tagliati). A 768 e 375 la stessa foto si vede intera ed è molto meglio.
Prova: `d-0.png` vs `t-0.png`.
Proposta: box orizzontale (foto a tutta larghezza della colonna, sopra le statistiche) o `object-position` sul centro del gruppo; lavora insieme alla sessione gravity/ritaglio.

**3. CTA finale: parola «PROVA» enorme, testo che la tocca, resto vuoto.** Il box giallo (300 px) ha a sinistra frase + «PROVA» a 120 px che si toccano (`d-5.png`), e tutta la metà destra vuota. Il pulsante vero è la parola «PROVA» senza verbo né prezzo, e non sembra cliccabile. Intera scheda è un link a `app…/iscrizioni/`.
Proposta: titolo «Una settimana di prova: 5 €» (come l'hero), frase sotto con distanza, pulsante pieno «Prenota la prova →» a destra; box 2 colonne. Stesso verbo del pulsante in testata.

**4. Le stesse 4 foto girano 3 volte.** Judo (`46c39293`), Lotta (`701a887f`), Preparazione (`1a03b6b2`), Psicomotricità (`40ae8db3`) compaiono: nella striscia hero (2 delle 4), nelle schede corso (mobile/tablet), nella griglia «Perché unirti» (tutte e 4). La griglia «Perché» è quindi una ripetizione di cose già viste 1.500 px sopra (`d-0` vs `d-3`). Foto uniche in tutta la pagina: ~7 (logo escluso).
Proposta: nella sezione «Perché» foto nuove (spogliatoio/ingresso, istruttore con bambino, premiazione podio, aikido, boxe); la striscia hero con foto diverse dalle schede. Serve materiale nuovo → sessione foto.

### MEDIA

**5. Il box statistiche hero è denso e rumoroso a 1440.** Nove tessere (35+, 300+, 8, 13, prova 5 €, indirizzo, «Il corso giusto…», «Armonia…», «Bambini, ragazzi, adulti») in 4 colori con 3 tipi di testo diverso (da 14 a 96 px). Le due tessere stat più importanti («35+», «300+») hanno altezze diverse dal resto e il testo «Via Sassi 26…» è 14 px su blu, il più piccolo della pagina. Mancano proporzioni coerenti: `13` e `35+` stanno in colonne alte, `8` e `300+` in basse.
Proposta: una riga unica di 4 numeri con la stessa altezza; l'indirizzo va nel footer/CTA, il motto «Armonia, rispetto…» nel testo della presentazione.

**6. Titoletti «Perché unirti a noi?» senza testo.** Quattro tessere con una frase a 50 px, nessuna spiegazione, e gerarchia piatta (tre sono titoli di 3–4 parole, una è una frase lunga). «La crescita viene prima del risultato» e «Educazione sportiva» dicono quasi la stessa cosa. Le tessere sono alte 190 px per una riga di testo → molto colore, poca informazione.
Proposta: sotto ogni titolo una riga di 12–16 parole con un fatto («Gruppi per età e livello, istruttori con brevetto federale»); oppure meno ingombro: tessere da 120 px. Testi → sessione testi.

**7. Le schede corso a 1440 sono alte e vuote.** Judo/Lotta/Aikido sono 340 px con 130 px di testo e un grande vuoto prima dei tag; senza foto né freccia (`d-1.png`). A 375/768 invece mostrano foto e freccia «↗» (solo 3–4 corsi su 9 hanno la foto: `m-1`, `m-2`). Comportamento diverso per larghezza e incoerente tra schede. Solo una parte è chiaramente cliccabile.
Proposta: a desktop mostrare la foto (o un'icona) in tutte le schede e la freccia sempre; altezza ridotta a ~260 px; stessa regola ovunque.

**8. Numero di corsi incoerente: 8 nelle stat, 9 schede.** Il contatore dice «8 attività» (hero e testo di presentazione), la griglia ne mostra 9 (Judo, Lotta, Aikido, Pre pugilistica, Autodifesa, Preparazione atletica, Giocomotricità, Avviamento, Sollevamento pesi). Anche 13 tecnici e 300+ atleti sono dati da confermare.
Proposta: allineare il numero (o il raggruppamento); controlla chi gestisce i dati.

**9. FAQ: due domande duplicate e refusi.** «Posso fare una prova prima di iscrivermi?» e «Posso provare un corso prima di iscrivermi?» dicono la stessa cosa con due risposte diverse (una settimana a 5 € / lezione di prova senza impegno): contraddizione che confonde. Refusi: «Si, alle Officine…» (manca l'accento: «Sì»), «un Associazione» (→ «un'Associazione»), «crescita» ok ma «Officine dello sport» con s minuscola.
Proposta: fondere in una sola con la risposta vera. Testi → sessione testi.

**10. Spaziature irregolari tra sezioni.** Sotto l'hero ~140 px vuoti prima del testo di presentazione; tra FAQ e CTA ~190 px; tra CTA e footer solo 6 px (`d-5`). Ritmo verticale non costante (da 6 a 190 px).
Proposta: un solo passo di sezione (es. `clamp(64px, 8vw, 112px)`) tra tutte le sezioni; CTA e footer separati da 24 px.

**11. Citazioni degli esperti: schede di altezza e lunghezza molto diverse.** Il primo testo è 15 righe, il secondo 10; il terzo (judo) è ancora più lungo e tagliato a destra in carosello (`d-3`). Il carosello mostra 2,5 schede, il testo lungo è difficile da leggere in 560 px di colonna e a 375 occupa 1.000 px di altezza (`m-2`). I «puntini» sono piccoli (8–10 px) e non hanno etichetta.
Proposta: citazioni più corte (≤ 40 parole) con nome e ruolo; 1 scheda alla volta a mobile con frecce; puntini ≥ 24 px con `aria-label`. Testi → sessione testi.

**12. Recensioni: foto del gruppo in mezzo al carosello.** Una foto (640×540) fa da prima «scheda» del carosello recensioni accanto a citazioni di 4 righe: le recensioni hanno altezza 540 px con testo di 5 righe → molto vuoto (`d-4`). Cinque recensioni brevi e senza stelle né fonte (Google?).
Proposta: scheda alta quanto il testo (≈ 260 px), foto fuori dal carosello, stelle e «Recensione su Google» se è vero.

### BASSA

**13. Target di tocco piccoli.** Voci del menu 39 px di altezza (< 44), link del footer 20–30 px, Instagram/Facebook 20 px, puntini dei caroselli ~10 px. Il menu a 375 va su due righe e si schiaccia contro il titolo (`m-0`, spazio 0 tra «Istruttori» e «SI CRESCE»).
Proposta: padding a 44 px nei link del footer, menu a 375 in riga scorrevole o hamburger, 16 px di distanza dal titolo.

**14. Nessun tema scuro.** Non è un difetto se non lo si vuole: però lo sfondo è un azzurro molto chiaro (#eef5fa) fisso. Se serve, dichiarare `color-scheme: light` per evitare inversioni forzate dai browser.

**15. CLS / caricamento immagini.** Solo il logo ha `width`/`height`; le altre 11 immagini no (`hasWH: false`): il box di ogni foto si calcola dopo il caricamento, possibile salto di layout se il CSS non fissa l'altezza dei box (non verificato con Lighthouse). I file sono JPG 1201–1800 px di lato e vengono scaricati interi anche in box da 209×128: spreco di banda.
Proposta: `width`/`height` o `aspect-ratio` su tutte; `srcset` con 480/960/1800 px; WebP/AVIF; `fetchpriority="high"` sulla foto hero.

**16. Titoli sezione molto grandi (120 px) fanno poca gerarchia.** «I NOSTRI CORSI», «PERCHÉ UNIRTI A NOI?», «COSA DICONO GLI ESPERTI», «COSA DICONO I NOSTRI CLIENTI», «HAI QUALCHE DOMANDA?» hanno tutti la stessa dimensione e occupano 100 px ciascuno: la pagina ha cinque «urla» uguali e nessun punto di arrivo; il CTA, che dovrebbe essere il più forte, è più debole.
Proposta: titoli sezione 72–88 px a 1440, riservare i 120+ px all'hero.

## Riepilogo per priorità

| # | Problema | Priorità |
|---|---|---|
| 1 | Hero: titolo tocca il sottotitolo, altezza 1006 px | alta |
| 2 | Foto di gruppo ritagliata a verticale a desktop | alta |
| 3 | CTA finale: «PROVA» enorme, testo che la tocca, metà vuota | alta |
| 4 | Le stesse 4 foto ripetute 3 volte | alta |
| 5 | Box statistiche denso, 9 tessere in 4 colori | media |
| 6 | «Perché unirti a noi?» titoletti senza testo | media |
| 7 | Schede corso alte e vuote a desktop, foto solo a mobile | media |
| 8 | 8 attività dichiarate, 9 schede | media |
| 9 | FAQ con domanda duplicata e refusi | media |
| 10 | Spaziature tra sezioni irregolari (6–190 px) | media |
| 11 | Citazioni esperti troppo lunghe, puntini piccoli | media |
| 12 | Recensioni: foto nel carosello, schede vuote | media |
| 13 | Target di tocco < 44 px, menu a 375 schiacciato | bassa |
| 14 | Nessun tema scuro (dichiarare `color-scheme`) | bassa |
| 15 | Immagini senza `width`/`height`, niente `srcset` | bassa |
| 16 | Cinque titoli sezione tutti da 120 px | bassa |

## Limiti

- Screenshot a 768 e 375 in iframe (misurati a parte nel browser integrato); nessuna prova su dispositivi veri.
- Contrasto calcolato sulle variabili CSS (`--blu`, `--giallo`, `--inchiostro`, `--fondo`, `--chiara`), non su ogni elemento.
- Giudizio visivo secondo le regole di impeccable / ui-ux-pro-max / design-taste-frontend (gerarchia, ritmo, anti-ripetizione), senza averne lanciato i comandi di audit automatici.
