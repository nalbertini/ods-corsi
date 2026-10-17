# La pagina di un istruttore

Aspetto del design «tatami blu e giallo» (`docs/design-canvas/sito-rebrand/TatamiBlu-Istruttore.dc.html`
e `TatamiBluM-Istruttore.dc.html`). Il sito la riconosce da sola: **una pagina
(non la Home, non di legge) il cui testo comincia con una foto e subito dopo
una citazione** è «di persona». Il codice è `persona()` in `src/lib/sitoLayout.ts`.

## Cosa scrivere nel pannello SITO

In quest'ordine:

1. Una **foto** (ritratto). Il suo testo alternativo è il **nome**: sul computer
   compare sulla foto, in basso a sinistra.
2. Una **citazione** (blockquote); l'ultimo paragrafo in corsivo è la firma
   (il solo nome, in grande).
3. Un **elenco** da 2 a 12 voci, ognuna col grassetto iniziale: sono le
   tessere «Ruolo / Corsi / Quando / Titoli» (grassetto = titolo, resto = testo).
4. Dei **sottotitoli** (`h3`) col loro testo, senza titolo grande prima: sono
   le tre tessere «Chi è / Come ha iniziato / Come insegna».
5. Poi i titoli grandi (`h2`) di sempre: «Il percorso» con tre `h3` e un elenco
   in ognuno, «Gli altri istruttori» con `h3` e una foto per ognuno (la foto
   diventa un cerchio da 110px).

Titolo e descrizione della pagina sono il nome grande e la frase a destra, col
pulsante «Contattaci» sotto.

## Cosa resta diverso dal design

- «Fuori dal tatami» nel design è una tessera blu larga quanto la riga; nel
  sito, scritto come `h2` con un paragrafo, è un titolo grande col testo in colonna.
  Una tessera larga a parte non si può esprimere col testo della segreteria.
- Sotto il nome sulla foto il design ha il ruolo («Maestro di Judo V Dan»):
  il testo non ha dove metterlo, e il ruolo sta già nella tessera «Ruolo».
- I colori delle tessere seguono la rotazione di tutto il sito (blu, giallo,
  inchiostro, chiaro, da blu in ogni gruppo), non quelli scelti a mano nel design.
- Il cerchio «Foto» segnaposto degli altri istruttori diventa la loro foto vera.
- Sul telefono il nome sulla foto non c'è (è già il titolo).
- Testata, invito e piede (uguali per tutte le pagine) hanno le misure del design solo
  nelle pagine di persona: 154px di testata col logo da 110px, invito alto 300px, piede
  con 48px ai lati. Il piede ha ancora i titoli «Altri link» e «Vieni a trovarci» e la riga
  «©», che nel design non ci sono; l'invito ha la freccia ↗ (è un link) e una frase più corta.
- Le voci del menu restano alte 44px (nel design 39px) per il tocco; nessuna è evidenziata
  come «Chi siamo» (il sito non sa a quale voce appartiene la pagina).
- Sul telefono il pulsante di testata dice «Prova una settimana · 5 €» e va a capo sotto il
  logo; nel design è «Prova», a fianco del logo.
