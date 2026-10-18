# Gli istruttori: elenco rivisto e scheda di ognuno

Testo da incollare nel pannello SITO (PAGINE › Istruttori, indirizzo `/istruttori/`). Design approvato: `docs/design-canvas/istruttori-miglioramenti/`. **Non è stato scritto niente sul database né pubblicato.**

## Come si fa

1. Titolo **Gli istruttori**, descrizione: *Tredici tecnici sportivi che accompagnano ogni persona passo dopo passo, rispettando tempi, capacità e obiettivi.*
2. Apri `docs/sito/istruttori.html` nel browser, seleziona tutto (Cmd+A), copia; nel pannello clicca nel testo e incolla.
3. **Le quattro foto** (libreria SITO › IMMAGINI): carica `42-maurizio-photocraft.jpg`, `200-maura-lightcraft.jpg`, `948-4-fabio-lightcraft.jpg`, `199-federico-lightcraft.jpg` (sono nella cartella `docs/proposte-home/istruttori/foto/approvate/` della sessione delle foto: non stanno nel repository). Poi, nel testo, metti il cursore **tra il nome e la riga «Cognome · corsi»** e inserisci la foto dalla libreria. Il testo alternativo si può lasciare vuoto: il sito scrive «Ritratto di Nome Cognome». Gli altri nove restano senza foto: il sito mette l'iniziale.
4. **ANTEPRIMA**, poi **PUBBLICA**.

## Come si scrive una riga

`Nome` (titolo piccolo), la foto se c'è, poi **«Cognome · corso, corso»**: il puntino centrale `·` (Opzione+Maiusc+9 su Mac) divide cognome e corsi, la virgola divide un corso dall'altro. Il cognome doppio va bene («De Chiara»); un nome di corso non può contenere una virgola. Senza `·`, una riga con virgole sono solo corsi, una senza sono solo il cognome.

## I link ai nomi

Il nome diventa un link (con la freccia ↗) **solo se la pagina dell'istruttore è pubblicata**; altrimenti il sito lo scrive come testo semplice, senza dirlo. Quindi: se colleghi un nome e non vedi la freccia, controlla che la sua pagina sia pubblicata. Gli indirizzi sono piatti: `/fabio-berta/`, non `/istruttori/fabio-berta/`. Nel testo di qui sopra sono già collegati Maurizio (la sua pagina è pronta in `docs/sito/istruttori/maurizio-innella.md`) e Fabio (scheda scarna: `docs/sito/istruttori/modello-scarno.md`); per un altro istruttore, scrivi la sua pagina e poi trasforma il suo nome in link.

## La tessera «Vieni a conoscerli sul tatami»

Compare da sola quando l'ultima riga di quattro tessere è incompleta (con 13 tecnici, sì); con 12 o 16 non c'è e resta l'invito giallo in fondo alla pagina. Aggiungendo o togliendo un tecnico può comparire o sparire: è normale.

## Cosa cambia rispetto a oggi

- Quattro colonne sul computer, una sul telefono; foto quadrata (o fascia azzurra con l'iniziale), nome, cognome e corsi in pastiglie.
- Il ruolo di Maurizio («Maestro di Judo V Dan») non sta più nell'elenco: sta nella sua pagina.
- Titolo più piccolo, su una riga; i nomi con link sono tutta la tessera, bersaglio da 48 px.
- Le schede degli istruttori ora esistono (prima `/istruttori/<nome>/` dava 404).
- Il piede ha telefono, social e «vicino alla metro Fermi» (già pubblicato con la Home).

## Da controllare prima di pubblicare

- I tredici sono quelli del database a oggi; se cambia un istruttore, si cambia la pagina (e il «Tredici» di descrizione e Chi siamo).
- **Foto**: i nomi dei volti sono quelli già assegnati in LightCraft; le liberatorie le ha dichiarate l'utente. Il ritaglio di Federico è stretto per escludere le altre persone.
- Ordine: lo mette il sito, qualunque sia l'ordine del testo: Maurizio, Maura, Katia, Fabio, Tiziano, Valerio, Manuel, Federico, poi gli altri come scritti. I colori vanno a diagonali: nessun vicino, in riga o in colonna, ha lo stesso colore.
- Nomi dei corsi (MGA, Body functional, Pesistica, Mobility): domanda aperta I8.

## La regola del sito

Codice: `src/lib/sitoIstruttori.ts` (`elencoIstruttori`, `schedaScarna`). Un testo senza `h2` che comincia con un `h3` ed ha almeno due `h3` è l'elenco. La scheda completa (foto, citazione, `h2`) è quella descritta in `istruttore.md` e non cambia.
