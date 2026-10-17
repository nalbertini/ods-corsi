# La pagina Contatti del sito come nel design

Testo da scrivere nel pannello SITO (PAGINE › Contatti) per avere la pagina del
design «tatami blu e giallo». Il titolo grande e la frase accanto sono **titolo**
e **descrizione** della pagina; il resto è il testo.

## Come si scrive il testo

In ordine, tutto prima del primo titolo grande (`h2`):

1. **I recapiti**: un sottotitolo (`h3`) per ognuno e sotto il valore. Sul sito
   sono quattro tessere in fila, nei colori giallo, blu, inchiostro, chiaro.
   Il primo paragrafo è il valore in grande (un valore di al massimo 14
   caratteri, come un telefono, esce ancora più grande); un secondo paragrafo è
   una nota piccola. Un recapito arriva fino alla prima foto.
2. **La mappa**: la prima foto dopo i recapiti. Una foto della mappa (da
   caricare nella libreria IMMAGINI), larga quanto la pagina e alta 520px.
3. **Le indicazioni**: un paragrafo con un solo link `pulsante` («Ottieni
   indicazioni», verso Google Maps). Sul sito il pulsante sta sopra la mappa,
   in basso a sinistra.
4. **Le foto**: tre foto di fila, alte 536px (sul telefono due, alte 200px).
5. **Le domande**: un titolo grande («Hai qualche domanda?»), un paragrafo e un
   sottotitolo (`h3`) con la risposta sotto per ogni domanda; le tessere vanno
   a tre per riga, gialle e chiare a scacchiera.

La regola vale solo per la pagina con indirizzo `contatti`: `impagina(testo,
true)` in `src/lib/sitoLayout.ts`, `main.pagina-contatti` nel CSS.

## Cosa resta diverso dal design

- **La mappa è una foto** (senza il segnaposto e la targhetta «Officine dello
  Sport»): il sito non ha codice né richieste a servizi esterni, quindi niente
  mappa viva. Il segnaposto si può disegnare sulla foto. L'indicazione
  «© OpenStreetMap contributors» va scritta sulla foto se la mappa è di
  OpenStreetMap.
- **La seconda scritta sulla mappa** («A pochi metri dalla metropolitana
  Fermi») sta nella tessera dell'Indirizzo, come nel design desktop.
- **Il pulsante «Contattaci» e il blocco giallo «Prova» in fondo** non ci sono
  nella pagina Contatti: già ci si trova (vedi `sitoGenera.ts`).
- **Sul telefono** il design toglie la terza foto, la nota dell'indirizzo e la
  frase sotto «Hai qualche domanda?»: la terza foto non si vede, il resto
  resta.
- **Testata e piede** sono quelli del sito intero, non di questa pagina.

## Da controllare prima di pubblicare

- Le foto ritraggono minori: servono i permessi dei genitori.
- La mappa: l'immagine da caricare non c'è ancora nella libreria.
