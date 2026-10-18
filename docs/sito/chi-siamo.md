# La pagina Chi siamo, nella nuova veste

Testo da incollare nel pannello SITO (PAGINE › Chi siamo) per avere la pagina
rivista: titolo e frase, foto di gruppo con la frase grande, due tessere,
quattro numeri, il pannello «Gli istruttori», la fila di quattro foto con il
nome del corso, la missione con foto, i quattro valori e la chiamata finale con
i due pulsanti. **Finché non si incolla il testo nuovo la pagina resta com'è
oggi**: il sito riconosce quella nuova da un pulsante verso il modulo online
(`https://app.officinedellosport.it/iscrizioni/`) in una delle sezioni. Il
testo di prima è in [`scripts/fixture-chi-siamo-vecchia.html`](../../scripts/fixture-chi-siamo-vecchia.html).

## Prima di incollare: le foto

Nella libreria IMMAGINI vanno caricate **tre foto nuove** (il sito le chiama
con il nome che l'app dà al caricamento). Le versioni migliorate sono in
`docs/proposte-home/chi-siamo/foto/approvate/` (non nel repository: sono nel
computer di chi ha sviluppato le foto).

| Foto | File | Dove | Nel testo c'è il segnaposto |
|---|---|---|---|
| Aikido (dimostrazione, in bianco e nero) | `987-aikido-v2.jpg` | fila di quattro foto | `DA-CARICARE-aikido-987.jpg` |
| Gruppo di judoka che ride | `205-gruppo-v2.jpg` | missione | `DA-CARICARE-missione-205.jpg` |
| Quattro istruttori di aikido | `948-aikido-istruttori-v2.jpg` | chiamata finale | `DA-CARICARE-istruttori-aikido-948.jpg` |

Dopo il caricamento si sostituiscono i segnaposto in `chi-siamo.html` con i
nomi veri, **prima** di copiare. Le altre foto (gruppo con la maglia blu,
istruttori, lotta, sala, cubi) sono già nella libreria; le versioni migliorate
(`*-v2.jpg`, le stesse della Home) si caricano allo stesso modo e si mettono al
posto dei nomi attuali (`18c88f1d…`, `814a717b…`, `701a887f…`, `1a03b6b2…`,
`40ae8db3…`). Il punto in cui ritagliare ogni foto lo sceglie il sito dal posto
che occupa nella pagina, non dal nome del file: cambiare foto non obbliga a
rifarlo.

## Come si fa

1. Apri **PAGINE › Chi siamo**.
2. Nei campi a destra: **titolo** e **descrizione** qui sotto (non cambiano).
3. Apri `docs/sito/chi-siamo.html` nel browser, seleziona tutto (Cmd+A), copia.
   Nel pannello clicca nel testo, cancella **tutto** e incolla (Cmd+V).
4. **ANTEPRIMA** per controllare, poi **PUBBLICA**. Il sito si aggiorna dopo
   una decina di minuti. L'anteprima del pannello mostra solo il testo: i
   riquadri si vedono sul sito pubblicato.

## Titolo

Chi siamo

## Descrizione

Le Officine dello Sport di Collegno sono uno spazio dove allenarsi con metodo e passione, mettendosi alla prova ogni giorno.

## Come è scritto il testo (per chi lo modifica)

Il sito legge la forma, non i titoli: si possono cambiare le parole, non l'ordine.

- **Prima del primo titolo grande**: una foto e una citazione (la foto con la
  frase grande gialla accanto); due titoli piccoli, ognuno col suo paragrafo
  (le due tessere); un elenco di 2–6 voci col numero in grassetto (i numeri).
- **Una foto, un paragrafo (e un pulsante, se c'è)** sotto un titolo grande: un
  pannello con la foto a destra. Il primo è scuro («Gli istruttori»), il
  secondo giallo (la missione): il colore segue l'ordine, non il pulsante. Se il
  pulsante «Conosci gli istruttori» non c'è, il pannello resta com'è.
- **Due o più foto, ognuna seguita da un paragrafo** (il nome del corso): la
  fila di foto con le didascalie; un paragrafo con un pulsante, dopo, diventa
  il pulsante «Vedi tutti i corsi». Il titolo della fila non si vede, ma lo
  legge chi usa uno screen reader. Una foto senza paragrafo resta senza
  didascalia. Le didascalie non sono link.
- **I nostri valori**: un paragrafo e quattro titoli piccoli, ognuno col suo paragrafo.
- **La chiamata finale** (l'ultima sezione): titolo, paragrafi, i due pulsanti
  («Prova una settimana a 5 €» verso il modulo online, «Scrivici» verso
  `/contatti/`) e la foto. **Il pulsante verso il modulo online è quello che
  fa riconoscere la pagina nuova**: se lo togli, la pagina torna come prima,
  senza avvisi.

## Cosa cambia rispetto a oggi

- Il titolo è più piccolo (120 px) e la foto di gruppo ha la frase grande sulla destra; i due testi «Chi siamo oggi» e «Come tutto è iniziato» sono lunghi uguale e con la stessa misura.
- I quattro numeri sono nell'ordine della Home: **35+** anni di sport, **9** attività, **300+** atleti, **13** tecnici (prima 8 attività).
- «Gli istruttori»: una foto grande e il pulsante «Conosci gli istruttori» (porta a `/istruttori/`); il testo non ripete più «Tredici».
- La fila di foto ha una didascalia per foto e il pulsante «Vedi tutti i corsi»; la foto di aikido è nuova (quella di prima compariva due volte).
- La missione ha una foto.
- «Chiamata finale» nuova: «Vieni a provare.», la settimana a 5 €, i due pulsanti e la foto degli istruttori. Prima c'era la parola «PROVA» gigante, senza pulsanti.
- Testi: «in ogni attività, in un ambiente dove chiunque può allenarsi» (6 parole in meno); introduzione dei valori più corta; verbi dei valori tutti alla prima persona («Cresciamo», «Creiamo»).
- Le descrizioni delle foto (alt) sono corrette: non ci sono judogi nella foto di gruppo e la lotta è un incontro.

## Da controllare prima di pubblicare

- **«Conosci gli istruttori» porta a `/istruttori/`**: va pubblicata prima (o si toglie il pulsante dal testo; il pannello resta).
- Il nome «A.s.d. il Centro Judo» è com'era nel testo pubblicato (da confermare se è ancora quello ufficiale).
- L'ordine dei numeri (come la Home) e i valori (frasi che ripetono il titolo) sono rimasti come nella proposta; si cambiano scrivendo il testo.
- Le foto: le liberatorie ci sono per tutte quelle proposte; nessun cognome leggibile sul dorso.
- Nella Home c'è ancora «8 attività»: la Home e Chi siamo vanno allineate a 9 (decisione D2).
