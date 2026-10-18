# Istruttori nel look del sito (storia)

Questa cartella è la proposta com'era stata approvata: i canvas `Oggi*` (com'era) e `Proponi*` (la proposta)
restano come storia e non si aggiornano. **Per sapere com'è l'app vale la libreria**
(`../ods-design-system/`, sezione «L'area istruttore nel look del sito» del suo README) e
`src/styles.css`.

## Com'è stato costruito (PR 1: menu, calendario, appello)

Il costruito ha cambiato queste cose dell'approvato. Dove c'è una differenza vince il costruito, e la
libreria lo dice.

**Gli stati sono testo, non tag.** La proposta metteva lo stato in un tag bianco col bordo (componente
`Badge`). Nell'app è una parola in Inter col segno davanti e il suo colore, senza bordo: ✕ DA CHIUDERE,
✓ FATTO, … IN CORSO, … NESSUN PRESENTE nel calendario; … N DA SEGNARE, … SOLO LETTURA, ✓ TUTTI SEGNATI,
✕ TUTTI ASSENTI nella testa dell'appello. Lo stesso vale per +N PROVA, … N DA INVIARE e … NON ANCORA
COMINCIATA, che erano tag e ora sono testo giallo scuro #8f6a00. Nel calendario … IN CORSO e ISCRITTI sono
spenti (#46606f) e nell'appello gli stati che aspettano sono in inchiostro: la proposta li voleva gialli.

**Niente barra di stato a sinistra.** Una lezione DA CHIUDERE non ha la barra rossa a sinistra (c'è solo
la tinta del corso, in alto, 4px) e `Arretrato` è una tessera bianca col tono nel colore del titolo, senza
barra e senza segno.

**Misure e caratteri.**
- Il conto grande dell'appello è Inter 800 (la classe `num` nel look è Inter), non Big Shoulders; il «/ N»
  e il conto non vanno a capo, il sottotitolo (giorno, ora, sala) sì, invece di tagliarsi dietro il timer.
- I margini laterali di testa, `ChiSei`, `Arretrato` e titoletti restano 20px (la proposta li portava a 16px,
  e a 24px sullo schermo largo); solo la striscia dei giorni è a 16px. La prop `lato` di `Titoletto` non c'è.
- Il titolo dell'appello ha 0.05em, il nome della lezione 19px e 0.02em.
- La barra in basso ha le voci a 12px (non 13) senza spaziatura, e vanno a capo.
- `ChiSei` è Big Shoulders 700 a 12px con 0.16em (come prima, con i font del look), ESCI nello stesso #46606f.
- Il menu largo non ha le icone; ODS CORSI è Big Shoulders 700 (non 800); DATI DI PROVA ha 0.18em.
- Sul telefono l'area non usa `BarraTelefono` ma la `Testata` di sempre, senza tasto del tema
  (`senzaTema`); `BarraTelefono` non ha più le prop `senzaMenu` e `senzaImpostazioni`.

**Tasti.**
- TUTTI PRESENTI / GLI ALTRI PRESENTI è giallo ma in Big Shoulders 700 (la proposta lo disegnava in Inter) e
  con 0.1em; AZZERA, «?», indietro, timer e frecce della settimana hanno il bordo 2px blu: AZZERA e le frecce
  senza raggio e senza fondo, «?» senza raggio, indietro e timer (`.appello-testa .icon-btn`) con fondo bianco
  e raggio 6px.
- TOGLI (la prova) non è un tasto blu: ha il filo celeste #cfe6f4, 12px, come prima.
- Il quadratino del non segnato ha il raggio 4px (non 6) e resta anche nella sola lettura.
- `SpiaCoda`: la frase è 14px in #46606f, come prima, non 15px in inchiostro.

**Striscia dell'allenamento.** Oltre a LAVORO (#b81d1d), RECUPERO (#0b7a33), IN PAUSA e FINITO (bianche
con la riga) ci sono gli stati che la proposta non disegnava: PREPARATI (bianca con la riga gialla scura),
RIPOSO e DEFATICAMENTO (blu #14709f). Sul bianco il testo, anche l'etichetta, è inchiostro: il colore sta
nella riga. I colori non sono più in linea nel componente: `data-stato` e `data-fase` e il CSS. Il margine a
sinistra è 20px.

**Musica.** Il tasto ⏸/▶ ha il filo celeste, non il bordo blu, e nessun raggio.

**Cronometro in allenamento.** Resta scuro dentro la pagina chiara, come previsto, ma lo fa il codice:
`.faccia-timer` ha i token del tema scuro e il timer incorporato prende sempre `data-tema="scuro"`
(`temaDelTimer` in `src/lib/timerNelRiquadro.ts`).

**Non fatto (PR 2).** I MIEI e ORE ereditano i token del look ma non sono ridisegnati.

**Ritocchi dopo la costruzione.** Colonna destra della lezione che non si stringe (8px, max 45%, stato a capo); ✓ TUTTI SEGNATI spento e bianco con bordo verde (resta #cfe6f4 solo per elenco vuoto); CHIUDI IN FONDO alto 44px; `.btn-dashed` senza a capo.
