# Segreteria · Sito

← [Torna alla segreteria](README.md)

Le pagine del sito della palestra si scrivono qui: i testi, il menu in alto e
il footer in fondo. Quello che scrivi resta **bozza** finché non premi
**PUBBLICA**: salvare la bozza non cambia il sito.

## Le pagine

**PAGINE** è l'elenco. Ogni pagina ha il suo stato:

- **PUBBLICATA**: il sito mostra quello che c'è scritto qui.
- **MODIFICHE NON PUBBLICATE**: la bozza è diversa dal sito. Il sito mostra
  ancora la versione di prima.
- **SOLO BOZZA**: non è mai stata pubblicata, il sito non la mostra.
- **NASCOSTA**: pubblicata o no, il sito non la mostra. Resta qui.

**NUOVA PAGINA** chiede il titolo e propone l'indirizzo (senza accenti, con i
trattini: «Chi siamo» diventa `chi-siamo`). Si può cambiare. Un indirizzo già
usato, o uno che serve al sito (`admin`, `api`, `privacy`…), non va.

Toccando una pagina si apre per scriverla:

- Il testo ha i tasti **TITOLO**, **SOTTOTITOLO**, **G** (grassetto), **C**
  (corsivo), gli elenchi, la citazione, **LINK**, **IMMAGINE** e **PULSANTE**. **LINK** e
  **PULSANTE** chiedono dove portano: un indirizzo che comincia con `https://`,
  `mailto:`, `tel:` o con `/` per una pagina del sito. Altro non si può
  scrivere: se incolli un testo da Word o da un altro sito, quello che il sito
  non ammette sparisce da solo.
- **LINK** e **PULSANTE** non mettono un indirizzo che il sito non ammette: se è sbagliato dicono cosa scrivere.
- Il testo di una pagina arriva a 200.000 caratteri: oltre, **SALVA BOZZA** e **PUBBLICA** aspettano e una riga dice di quanto.
- A destra il **titolo per Google** (al massimo 60 lettere), la
  **descrizione** (160) e l'**indirizzo della pagina**. Il numero sotto dice a
  quanto sei; diventa rosso se superi il limite. Cambiando l'indirizzo di una
  pagina pubblicata, il vecchio porta al nuovo.
- **SALVA BOZZA** salva senza cambiare il sito. **ANTEPRIMA** mostra com'è
  scritta; **TORNA A SCRIVERE** la richiude.
- **PUBBLICA** salva la bozza, se serve, e la rende il testo del sito. Se
  nel frattempo qualcun altro ha cambiato la pagina, non scrive niente e lo
  dice: ricaricala per vedere le sue modifiche, poi rifai la tua.
- **NASCONDI DAL SITO** toglie la pagina dal sito senza cancellarla;
  **MOSTRA SUL SITO** la rimette. **CANCELLA LA PAGINA** la toglie per sempre;
  non si cancella finché è nel menu o nel footer.

Le pagine di legge (**privacy, cookie, contributi pubblici**) non si
nascondono né si cancellano.

Se esci con qualcosa scritto e non salvato, l'app chiede prima.

## Le immagini

**IMMAGINI** è la libreria delle immagini caricate per le pagine. **CARICA
UN'IMMAGINE** prende uno o più file JPEG, PNG o WebP; una foto che pesa più di
1 MB si rimpicciolisce da sola, una piccola resta com'è (una PNG con la
trasparenza non la perde). Ogni immagine dice in quali pagine è usata, anche
nella bozza: finché è usata non si cancella; se non lo è, **TOGLI** la toglie.

Per metterne una nel testo, in una pagina tocca **IMMAGINE**: scegli una di
quelle caricate (o **+ CARICA UN'IMMAGINE NUOVA**, che la sceglie da sola),
scrivi nel **testo alternativo** cosa si vede, per chi non la vede, oppure
spunta **solo decorativa**; poi **INSERISCI**. Senza testo e senza la spunta
non si inserisce. Nel testo l'immagine va a tutta la larghezza e si sposta o si
cancella come un paragrafo.

Le immagini sono **pubbliche**: chiunque conosca l'indirizzo le vede, anche se
la pagina è nascosta. Niente foto di persone senza il loro permesso, per i
minorenni quello dei genitori; niente documenti. Finché sul database non c'è
`58-sito-immagini.sql`, **IMMAGINI** dice che non sono ancora attive e le
pagine si scrivono come prima.

## Menu e footer

**MENU E FOOTER** ha due elenchi: **MENU IN ALTO** e **FOOTER**. Ogni voce ha
un nome e dice dove porta: una pagina del sito o un indirizzo. Il nome arriva a 60 lettere. Le frecce
**↑** e **↓** la spostano, **TOGLI** la toglie, **+ AGGIUNGI UNA VOCE**
ne aggiunge una. **SALVA** salva, **BUTTA I CAMBI** torna a prima. Se passi da **PAGINE** a **MENU E FOOTER** con voci a metà, l'app chiede prima.

L'app non ti lascia salvare se una voce non va, e dice quale:

- una voce senza nome;
- una voce che non porta da nessuna parte, o a una pagina nascosta o mai
  pubblicata;
- un indirizzo che non comincia con `https://`, `mailto:`, `tel:` o `/`;
- nel footer, una pagina di legge mancante o non pubblicata.

## Il sito vero

Il sito nuovo, su `www.officinedellosport.it`, si genera dalle pagine
**pubblicate** e si aggiorna da solo: dopo **PUBBLICA** ci vuole una decina
di minuti perché compaia (non si preme niente). Quelle in bozza, nascoste o
mai pubblicate non ci sono. Il
passaggio dal sito di prima a quello nuovo, e le immagini, arrivano in un
secondo momento: finché non è fatto, **PUBBLICA** prepara il testo ma il sito
che si vede è ancora quello vecchio.

Il sito nuovo ha sempre una **Home**: senza una Home pubblicata non si genera.
Le pagine di legge (privacy, cookie, contributi pubblici) hanno l'impaginazione
solo testo; le altre hanno in cima il titolo grande (in maiuscolo) e, sotto, la frase della
**descrizione**. Il pulsante «Contattaci» e l'invito giallo «Prova» in fondo
compaiono se esiste una pagina pubblicata con indirizzo `contatti`.

**L'aspetto** è sempre lo stesso per tutte le pagine, e non si cambia da qui: sfondo azzurro chiaro,
titoli neri stretti, pulsante «Prova» giallo in alto a destra, il logo intero in cima e, in fondo, una
tessera scura con i recapiti. Cambiano solo i testi che scrivi tu, che prendono da soli i colori e il carattere.

Se compare «Il pannello del sito non è ancora attivo sul database», manca un
aggiornamento del database: va chiesto a chi cura l'app.
