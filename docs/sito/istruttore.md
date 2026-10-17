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

## Altre regole di questa pagina

- Il nome sulla foto è l'`alt`; se scrivi «Nome — ruolo» (con il trattino lungo) il ruolo va sotto, piccolo.
- Un titolo grande (`h2`) seguito solo da paragrafi (per esempio «Fuori dal tatami») è una tessera blu larga come la riga.
- Nel menu in alto la voce «Chi siamo» (pagina `chi-siamo`) è evidenziata in giallo: gli istruttori sono parte di Chi siamo.
- Testata, invito e piede hanno le misure del design solo nelle pagine di persona; il piede ha tre colonne
  (recapiti, menu, altri link), senza la riga «©», e l'invito la frase lunga. Sul telefono il pulsante è «Prova».
- I colori delle tessere sono quelli del design (4 e 3 in apertura, percorso, altri istruttori).

## Cosa resta diverso dal design

- Il cerchio «Foto» segnaposto degli altri istruttori diventa la loro foto vera.
- Sul telefono il nome sulla foto non c'è (è già il titolo).
- I titoli di colonna del piede ci sono per chi legge con lo schermo, ma non si vedono.
