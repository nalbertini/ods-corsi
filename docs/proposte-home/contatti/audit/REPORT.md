# Audit visivo di Contatti: officinedellosport.it/contatti

Data: 2026-10-18. Sito pubblico e database non toccati. Misure a 1440, 768 e 375 px, tema chiaro (tema scuro: non esiste, come in home).
Screenshot in `img/`: pagina intera `contatti-1440-full.png`, `contatti-768-full.png`, `contatti-375-full.png` e fette `d-0…d-3` (1440), `t-0…t-3` (768), `m-0…m-4` (375). I 375 sono resi in un iframe largo 375 (Chrome headless non scende sotto ~500 px); il 375 reale misurato nel browser integrato non ha scroll orizzontale (`scrollWidth` 375).
Metodo: misure da `getBoundingClientRect` nel browser integrato, contrasti calcolati sui colori reali delle tessere; giudizio visivo con i criteri di impeccable / ui-ux-pro-max (non ho lanciato i loro comandi automatici).

## Cosa funziona (da non toccare)

- Un solo `h1`, `lang="it"`, `header/nav/main/footer`, `<title>` e description pensati, `canonical`, JSON-LD (`SportsActivityLocation` con telefono e indirizzo, `BreadcrumbList`, `FAQPage`).
- Contrasti: inchiostro su giallo 8,95:1; bianco su blu 5,46:1; bianco su inchiostro 14,83:1; inchiostro su azzurro 11,50:1.
- Il pulsante «Ottieni indicazioni» è 212×56 (1440) e 200×52 (375): bersaglio buono. Voci di menu 44 px di altezza a 768 e 375 (a 1440 sono 39 px).
- Nessun overflow orizzontale a nessuna misura; testo dei link `tel:` e `https:` corretto; mappa con `alt` che dice dove è.

## Problemi, in ordine di priorità

### ALTA

**1. Gli orari non ci sono.** Nella pagina dei contatti non c'è un orario né della segreteria né delle lezioni. Chi vuole «passare in sede» non sa quando. (Dato mancante: C1 nel report testi.)

**2. La pagina non porta alla prova.** In fondo c'è la parola «PROVA» a 200 px (1440) senza verbo né prezzo, a contatto con la frase (`d-3`, `m-4`); l'intera scheda è un link ma sembra un titolo. A 375 il pulsante in testata dice solo «Prova» (88×48, il prezzo e «una settimana» spariscono). Le FAQ danno due risposte diverse alla stessa domanda (settimana a 5 € / lezione di prova): D9.

**3. Bersagli piccoli per le cose che servono di più.** Il telefono è un link di 163×39 (375) e 223×53 (1440): a 375 sono 39 px, e la tessera intorno non è cliccabile. Instagram 238×39, Facebook 245×39. Nel piede Instagram e Facebook sono 75×20 e 74×20, le voci del piede 45×20 / 78×30 (sotto i 44). Il menu a 375 va su due righe e «Istruttori» scende a capo (`m-0`).

**4. «Come arrivare» è una frase.** «A pochi metri dalla metropolitana Fermi» compare due volte a 1440 (nota dell'indirizzo e pillola sulla mappa) e non è verificata: la mappa non mostra la stazione e non c'è una distanza. Nessuna indicazione per auto/parcheggio, né a piedi dalla metro.

### MEDIA

**5. La mappa.** Immagine OpenStreetMap 1344×520 senza `width`/`height` (possibile salto di layout; box 1344×380 a 1440, 343×380 a 375 con ritaglio centrato: il segnaposto resta visibile). Pillola e pulsante sono sopra le etichette di mappa («Via Renato Dulbecco», «Piazza Bruno Trentin»); non è zoomabile e non c'è un'alternativa testuale oltre al pulsante. Credito OSM presente e leggibile (13 px). Peso 85 KB: va bene.

**6. Le tre foto sono la home.** Lezione di judo (12e605fc), bambino sui cubi (40ae8db3) e sala pesi (1a03b6b2) sono già in home. A 375 e 768 la terza è nascosta (0×0) ma il file si scarica lo stesso (`loading=auto`, nessun `lazy`). Nessuna foto dice dove si è: manca l'ingresso. A 1440 le foto sono 444×536 verticali e ritagliano la sala. Due minorenni riconoscibili (lezione in fila, bambino sui cubi: volto fuori campo).

**7. FAQ.** 6 domande, due doppie sulla prova, nessuna su dove / quando. Le tessere hanno altezza uguale ma risposta allineata in basso con un vuoto sopra (`d-1`). Titolo di sezione a 120 px (l'h1 è 200 px): due «urla» quasi uguali.

**8. Gerarchia della testa.** `CONTATTACI` a 200 px occupa 164 px di altezza ma la frase accanto (28 parole) non ha un'azione. Le quattro tessere hanno titolo a 58 px e testo del link a 36 px: l'indirizzo è l'unica senza link.

**9. Facebook.** L'etichetta dice «Officine dello Sport» ma l'indirizzo è `facebook.com/ilCentroJudo` (anche nel JSON-LD `sameAs`). C3.

### BASSA

**10. Ritmo verticale.** Tessere → mappa e mappa → foto ~97 px, FAQ → chiamata finale ~195 px, chiamata → piede pochi pixel (come in home, problema 10).
**11. Nessun tema scuro** (dichiarare `color-scheme: light`).
**12. Immagini senza dimensioni.** Mappa e tre foto senza `width`/`height`; le foto sono JPG 1169-1800 px scaricati interi in box da 444 px.
**13. Dati strutturati incompleti.** Nel JSON-LD mancano `openingHours`, `geo` e un'email: da aggiungere solo dopo C1 (non si inventano).
**14. «Via Sassi 26» o «Via Vittorio Sassi 26».** La pagina dice la prima, il JSON-LD e il link di Google la seconda; la mappa dice «Via Vittorio Sassi». Scegliere una forma sola (C7).
**15. Nessun skip-link** per saltare il menu (sette link prima del contenuto). Non misurato con tastiera vera.

## Riepilogo per priorità

| # | Problema | Priorità |
|---|---|---|
| 1 | Nessun orario | alta |
| 2 | Nessun percorso verso la prova; «PROVA» enorme; «Prova» solo a 375 | alta |
| 3 | Bersagli telefono/social/piede sotto 44 px | alta |
| 4 | Come arrivare: una frase non verificata, due volte | alta |
| 5 | Mappa senza dimensioni, pillola sulle etichette | media |
| 6 | Tre foto già in home, terza scaricata e nascosta; manca l'ingresso | media |
| 7 | FAQ con doppioni e senza dove/quando | media |
| 8 | Testa senza azione, tessere dal peso diverso | media |
| 9 | Facebook: etichetta e pagina non coincidono | media |
| 10-15 | Ritmo, tema scuro, dimensioni, JSON-LD, nome della via, skip-link | bassa |

## Limiti

- Niente Lighthouse né prove con tastiera e screen reader: ordine di tabulazione, skip-link e CLS reale sono da misurare.
- 375 e 768 in iframe/emulazione; nessun dispositivo vero.
- Contrasti sui colori delle tessere, non su ogni elemento (testo del piede su inchiostro non misurato).
