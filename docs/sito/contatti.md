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

## La mappa

`sito/risorse/mappa.webp` è la mappa di OpenStreetMap (zoom 17, 1344×520,
centrata su Via Sassi 26, Collegno: 45.0785534, 7.5936698) ricomposta da 18
tessere. Nel testo si usa come una foto: `<img src="/risorse/mappa.webp"
alt="Mappa: Officine dello Sport, Via Sassi 26, Collegno">`. Segnaposto,
targhetta e «© OpenStreetMap contributors» li mette il sito sopra la prima foto
dopo i recapiti, quindi la mappa va sempre al centro dell'immagine.

## Il paragrafo dopo il pulsante

Il secondo paragrafo accanto a «Ottieni indicazioni» («A pochi metri dalla
metropolitana Fermi») è la pillola bianca sulla mappa. Sul telefono, come nel
design, non si vede (né quella né la nota dell'Indirizzo), e nemmeno la frase
sotto «Hai qualche domanda?» e la terza foto.

## Cosa resta diverso dal design

- Il pulsante in testata dice «Prova una settimana · 5 €» sul computer e
  «Prova» sul telefono, come nel design.
- Il testo delle risposte è uno solo: nel design del telefono due risposte sono
  più corte. Si scrive il testo del computer.
- Il sito centra le foto con `object-position` come nel design (50% 55%, la
  terza 50% 30%).

## Da controllare prima di pubblicare

- Le foto ritraggono minori: servono i permessi dei genitori.
- La mappa: i dati sono di OpenStreetMap contributors (ODbL); il credito resta sulla mappa.
