# I nostri corsi, nella nuova veste

Testo da incollare nel pannello SITO (PAGINE › I nostri corsi, indirizzo `/corsi/`)
per avere la pagina rivista: titolo grande su una riga, una frase, nove schede
uguali (foto o fascia con l'iniziale) e la chiamata «Una settimana per scegliere.».
**Finché non si incolla il testo nuovo la pagina resta com'è oggi**: il sito
riconosce quella nuova da due cose, il pulsante verso il modulo online e i corsi
scritti tutti come sottotitoli con il link. Se manca una delle due la pagina
resta quella di prima, senza avvisi.

## Prima di incollare: le foto

Le schede usano le stesse foto e gli stessi testi della Home (`home.html`): le
tre foto nuove (`161-judo-C`, `446-lotta-A`, `989-aikido-B`) si caricano nella
libreria IMMAGINI una volta sola, per la Home e per questa pagina. In
`corsi.html` hanno lo stesso segnaposto (`DA-CARICARE-judo-161.jpg`,
`DA-CARICARE-lotta-446.jpg`, `DA-CARICARE-aikido-989.jpg`): dopo il caricamento
si sostituiscono con i nomi veri, come in `home.html`. Preparazione atletica,
Giocomotricità e la foto degli istruttori sono già nella libreria. Pre
pugilistica, Autodifesa, Avviamento e Sollevamento pesi non hanno foto: la
scheda ha la fascia con l'iniziale (la foto dell'Avviamento è ancora da
decidere: 0511 o quella online).

## Come si fa

1. Apri **PAGINE › I nostri corsi**.
2. Nei campi a destra: **titolo** e **descrizione** qui sotto (sono quelli di oggi).
3. Apri `docs/sito/corsi.html` nel browser, seleziona tutto (Cmd+A), copia. Nel
   pannello clicca nel testo, cancella **tutto** e incolla (Cmd+V).
4. **ANTEPRIMA**, poi **PUBBLICA**. Il sito si aggiorna dopo una decina di minuti.
   Le schede e i colori si vedono sul sito pubblicato, non nell'anteprima.

## Titolo

I nostri corsi

## Descrizione

Judo, lotta, aikido, pre pugilistica, autodifesa, preparazione atletica, pesi e psicomotricità per bambini, ragazzi e adulti a Collegno.

## Come è scritto il testo

- **La frase** è il primo paragrafo, prima dei corsi: sta sotto il titolo. Non è la
  descrizione, che resta nei motori di ricerca. Altri paragrafi prima dei corsi
  stanno sopra le schede.
- **Ogni corso**: sottotitolo con il link alla sua pagina, la foto (facoltativa) subito
  sotto, un paragrafo con l'età, uno con la descrizione e uno tutto in corsivo
  con le fasce separate da « · » (Bambini · Adulti · Anziani · Agonisti). È
  esattamente la forma della Home. Le foto messe dopo l'ultimo corso non si usano.
- **La chiamata finale**: un titolo grande (qui «Una settimana per scegliere.»),
  il paragrafo con l'indirizzo e «vicino alla metro Fermi», i due pulsanti
  («Prova una settimana a 5 €» verso `https://app.officinedellosport.it/iscrizioni/`,
  il giallo, sempre primo; «Scrivici» verso `/contatti/`) e la foto degli
  istruttori. Senza, il sito mette l'invito giallo di sempre.

## Cosa cambia rispetto a oggi

- Titolo da 200 px su due righe → 120 px su una riga (56 px sul telefono); una sola frase al posto di due.
- Nove schede uguali, con la fascia con l'iniziale dove manca la foto; testi di 12-14 parole, gli stessi della Home.
- In fondo non ci sono più due foto di fila ma la chiamata «Una settimana per scegliere.» con i due pulsanti.

## Da controllare prima di pubblicare

- Le liberatorie delle foto con minori (le ha l'utente per tutte quelle proposte).
- Età e fasce ancora aperte (le stesse della Home): Pre pugilistica «Dai 18 anni» e Autodifesa «Dai 15 anni» contro «dal 2015 in poi» delle loro pagine; «Anziani» ad Aikido e Preparazione atletica; «Bambini» a Sollevamento pesi (dagli 11 anni).
