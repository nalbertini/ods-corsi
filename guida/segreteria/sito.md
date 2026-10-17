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
  Titolo e descrizione compaiono anche nell'anteprima di quando qualcuno
  condivide la pagina (WhatsApp, Facebook, Instagram), con l'immagine del sito.
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

Sul sito la voce che porta ai contatti non sta nel menu in alto: diventa il
pulsante scuro **CONTATTACI**, accanto a **PROVA**. Nel piede resta tra le
pagine. Sul telefono il menu sta su una riga se i nomi sono corti: «I corsi»
entra, «I nostri corsi» rischia di andare a capo.

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

**L'aspetto** è sempre lo stesso per tutte le pagine e non si cambia da qui: sfondo azzurro chiaro,
titoli neri stretti in maiuscolo, pulsante «Prova» giallo in alto a destra, il logo intero in cima e, in
fondo, l'invito giallo e una tessera scura con i recapiti.

Se compare «Il pannello del sito non è ancora attivo sul database», manca un
aggiornamento del database: va chiesto a chi cura l'app.

## Come il testo diventa tessere

Il sito mette in pagina da solo quello che scrivi, secondo come lo scrivi. Nell'ANTEPRIMA del pannello vedi
il testo «com'è scritto»: le tessere si vedono solo sul sito, dopo **PUBBLICA** e una decina di minuti.

- **Titolo grande** (`h2`): apre una **sezione** col titolo in grande, in maiuscolo. Quello che scrivi
  prima del primo titolo grande è l'introduzione, in colonna.
- **Sottotitolo** (`h3`) e il testo che lo segue: una **tessera**. I sottotitoli di una sezione fanno una
  griglia (1 tessera a tutta riga, 2 a coppie, 3 su una riga, 4 come 2×2, 5 come 3+2, 6 come 3×2…). I
  colori ruotano blu, giallo, scuro, chiaro; se **tutti** i sottotitoli di una sezione finiscono con «?»,
  sono tutte tessere chiare (le domande frequenti).
- **Elenco** (`ul`) di 2–12 voci corte, in una sezione senza sottotitoli: una tessera per voce. Il
  **grassetto** all'inizio della voce è il titolo della tessera. Un elenco più lungo, o numerato, resta un elenco.
- **Fascia d'età e pillole sui corsi**: nell'elenco dei corsi, dopo il nome in grassetto scrivi un secondo grassetto con l'età («Dai 7 anni agli adulti»), vai a capo, la descrizione, e in fondo un corsivo con le etichette: `Bambini`, `Adulti`, `Anziani`, `Agonisti`, separate da «·» o da virgole. Diventano le pillole con l'icona in fondo alla tessera. Se nel corsivo c'è un'altra parola, resta un corsivo normale.
- **Citazioni** (`blockquote`): più citazioni di fila scorrono di lato (col dito o con le frecce, senza
  codice); una sola è una tessera larga. L'ultima riga della citazione tutta in *corsivo* o in **grassetto**,
  o che comincia con «—», è la firma.
- **Foto**: una foto sola in una sezione (all'inizio o in fondo) è una tessera a tutta larghezza; più foto
  di fila sono una fila di tessere. Una foto in mezzo a un testo resta com'è. La foto viene ritagliata a
  3:2: teste e piedi vicini ai bordi possono tagliarsi, scegli foto con spazio intorno. Per le foto con
  minori vale la regola di sempre: serve il permesso dei genitori, mai documenti.
- **Quattro foto** di fila (all'inizio o in fondo a una sezione) sono una **fascia alta** a quattro colonne, ritagliata in verticale: scegli foto con la persona al centro. Con 5, 6 o 7 foto restano le file da tre.
- **Una foto e due o più citazioni** (la foto per prima, subito sotto il titolo grande): sul computer la foto sta a sinistra e le citazioni scorrono a destra; sul telefono una sotto l'altra.
- La **firma** di una citazione ha un cerchio giallo con le **iniziali** del nome (le prime due parole, prima di « - »: «Nicola A.» diventa NA, «Serena - Stud. di Medicina» diventa S).
- Un sottotitolo **senza testo** sotto (i «valori») è una tessera col titolo grande in basso.
- Una foto dentro una tessera con sottotitolo va **in cima alla tessera**, sopra il titolo, anche se l'hai scritta dopo.
- **La Home ha in cima un collage** di foto e numeri accanto al titolo. Si ottiene scrivendo, **prima del
  primo titolo grande**: fino a **3 foto** (una per riga; la prima è la grande) e **un solo elenco** di 2–6
  voci che cominciano tutte con un **grassetto** (il numero) seguito dalla scritta, per esempio
  «**35+** anni di sport». La frase sotto il titolo è la **descrizione** della pagina; i paragrafi scritti
  prima del primo titolo restano sotto la testata. Foto e numeri oltre il limite, o un elenco che non
  rispetta la regola, restano nel testo. Vale solo per la Home. La foto grande è più larga che alta: scegli
  foto con spazio sopra e ai lati, e senza minori riconoscibili senza il permesso dei genitori.
- **Collage pieno** (Home): con **4 foto** e **un elenco di 9 voci** prima del primo titolo grande, la testata ha le 13 tessere del design. Le voci seguono l'ordine: i **numeri** (grassetto + scritta, come «**35+** anni di sport»), i **titoli** (solo grassetto, scritta grande), le **note** (niente grassetto, scritta piccola, per l'indirizzo e il motto). Con altre quantità resta il collage di prima.
- Nelle **pagine di un corso**, di **Chi siamo**, di **Contatti**, degli **istruttori** (elenco e singola persona) e nell'elenco **I nostri corsi** le regole di scrittura sono nei testi pronti di `docs/sito/<pagina>.md`: ogni pagina ha il suo testo da incollare e le sue foto proposte in `docs/sito/foto.md`.
- Il paragrafo scritto **dopo l'ultimo sottotitolo** finisce nell'ultima tessera: per chiudere la griglia e
  scrivere altro, apri un nuovo titolo grande.
- Le pagine di legge e le pagine senza titoli grandi restano testo in colonna, come prima.
