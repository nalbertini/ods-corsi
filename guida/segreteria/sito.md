# Segreteria · Sito

← [Torna alla segreteria](README.md)

Le pagine del sito della palestra si scrivono qui: i testi, il menu in alto e
il footer in fondo. Quello che scrivi resta **bozza** finché non premi
**Pubblica**: salvare la bozza non cambia il sito.

## Le pagine

**Pagine** è l'elenco. Ogni pagina ha il suo stato:

- **PUBBLICATA**: il sito mostra quello che c'è scritto qui.
- **MODIFICHE NON PUBBLICATE**: la bozza è diversa dal sito. Il sito mostra
  ancora la versione di prima.
- **SOLO BOZZA**: non è mai stata pubblicata, il sito non la mostra.
- **NASCOSTA**: pubblicata o no, il sito non la mostra. Resta qui.

**Nuova pagina** chiede il titolo e propone l'indirizzo (senza accenti, con i
trattini: «Chi siamo» diventa `chi-siamo`). Si può cambiare. Un indirizzo già
usato, o uno che serve al sito (`admin`, `api`, `privacy`…), non va.

**Nuova pagina** crea una pagina **a pezzi**. Le pagine che c'erano prima (la
Home, i corsi) si scrivono ancora come ti ricordi, con il testo solo; le pagine
di legge restano così.

Per portare una pagina vecchia ai pezzi, aprila e, sotto i tasti, premi **PORTA
AI PEZZI** (sotto «EDITOR A PEZZI»). Il testo resta com'è: la foto messa in cima
diventa **FOTO IN CIMA**, le colonne diventano **COLONNE**, ogni foto messa tra i
paragrafi diventa una **FOTO**, e ogni titolo grande apre un nuovo **TESTO**: così
nell'**Elenco** trovi più parti e le sposti con **Su** e **Giù**. Il sito non cambia finché non premi **Pubblica**. **Non si torna al
vecchio editor.** Il tasto è spento finché ci sono modifiche non salvate: prima
**Salva bozza**. Se la pagina è troppo lunga, un avviso dice di togliere qualcosa.

Una pagina già a pezzi, ma con un solo **TESTO** lungo (nell'**Elenco** c'è una
voce sola), si divide con **DIVIDI IN PARTI**, sotto «EDITOR A PEZZI»: il tasto
compare solo se c'è qualcosa da dividere. Ogni titolo apre una parte nuova (i
sottotitoli restano nel testo) e ogni foto tra i paragrafi diventa una **FOTO**;
foto in cima e colonne restano dove sono. Il testo non cambia. La pagina resta
**Da salvare**: se non ti piace, **Tutte le pagine** e poi **Torna alle pagine**
la scarta; se ti piace, **Salva bozza**. Il tasto è spento finché ci sono
modifiche non salvate: prima **Salva bozza**.

Una pagina a pezzi si compone con le parti che metti in fila:

- **+ FOTO IN CIMA**: una foto sola, sempre in alto.
- **+ TESTO**: un testo, con gli stessi tasti di sempre (qui sotto).
- **+ FOTO**: una foto, col suo testo alternativo (o «solo decorativa»).
- **+ COLONNE**: da due a tre colonne di testo, una accanto all'altra. Sul telefono
  si mettono una sotto l'altra. Una colonna lasciata vuota non compare sul sito.

Le parti si mettono dopo quella scelta, o in fondo. Per cambiare l'ordine si
trascina la parte, oppure si sceglie e si premono **SU** o **GIÙ**; **Togli** la
toglie dalla pagina.

**Il testo si scrive nella pagina**, dove lo vedi: tocca un **TESTO** o una
colonna e scrivi lì. Sopra la parte scelta compare la barra dei tasti (**TITOLO**,
**SOTTOTITOLO**, **GRASSETTO**, **CORSIVO**, **ELENCO**, **ELENCO 1, 2, 3**, **CITAZIONE**,
**LINK**, **IMMAGINE**, **PULSANTE**); se sopra non c'è posto, sta dentro la parte, in alto. Nelle
**COLONNE** ogni colonna si scrive per conto suo: tocca quella che vuoi, la
barra è una sola per tutte. **ANNULLA** e **RIFAI** (e Ctrl+Z) tolgono e rimettono un pezzo di testo alla
volta, non una lettera. Per spostare una parte con un testo dentro usa **SU** e
**GIÙ** (o l'**ELENCO**): trascinando sul testo si selezionano le parole.

La pagina prende tutto lo spazio; a destra ci sono due schede. **IMPOSTAZIONI**
mostra i campi della parte che hai toccato, come la foto e quante colonne sono (di un testo
dice solo di scriverlo nella pagina; se non ne hai toccata nessuna dice
di toccarne una). **ELENCO** mostra le parti della pagina in fila: da lì le
scegli e le trascini. Sotto i 1280 pixel di larghezza (tablet in piedi) la pagina
sta sopra e le due schede sotto. Le tessere, le domande e le citazioni a scorrimento si
formano da sole dal testo, come per ogni pagina (vedi «Come il testo diventa
tessere»). **Anteprima** mostra la pagina come il sito la farà, con le
tessere; il carattere del sito e il logo si vedono solo sul sito vero.

Se compare «Le pagine a pezzi non sono ancora attive sul database», va
lanciato `62-sito-pezzi.sql` (lo fa chi cura l'app): finché non c'è, le pagine
nuove si scrivono col testo solo.

Toccando una pagina si apre per scriverla:

- Il testo ha i tasti **TITOLO**, **SOTTOTITOLO**, **GRASSETTO**, **CORSIVO**,
  **ELENCO**, **ELENCO 1, 2, 3**, **CITAZIONE**, **LINK**, **IMMAGINE** e **PULSANTE**. **LINK** e
  **PULSANTE** chiedono dove portano: un indirizzo che comincia con `https://`,
  `mailto:`, `tel:` o con `/` per una pagina del sito. Altro non si può
  scrivere: se incolli un testo da Word o da un altro sito, quello che il sito
  non ammette sparisce da solo.
- **LINK** e **PULSANTE** non mettono un indirizzo che il sito non ammette: se è sbagliato dicono cosa scrivere.
- Il testo di una pagina arriva a 200.000 caratteri: oltre, **Salva bozza** e **Pubblica** aspettano e una riga dice di quanto.
- A destra il **titolo per Google** (al massimo 60 lettere), la
  **descrizione** (160) e l'**indirizzo della pagina**. Il numero sotto dice a
  quanto sei; diventa rosso se superi il limite. Cambiando l'indirizzo di una
  pagina pubblicata, il vecchio porta al nuovo.
  Titolo e descrizione compaiono anche nell'anteprima di quando qualcuno
  condivide la pagina (WhatsApp, Facebook, Instagram), con l'immagine del sito.
- **Salva bozza** salva senza cambiare il sito. **Anteprima** mostra com'è
  scritta (nelle pagine a pezzi, com'è sul sito); **Torna a scrivere** la richiude.
- **Pubblica** salva la bozza, se serve, e la rende il testo del sito. Se
  nel frattempo qualcun altro ha cambiato la pagina, non scrive niente e lo
  dice: ricaricala per vedere le sue modifiche, poi rifai la tua.
- **Nascondi dal sito** toglie la pagina dal sito senza cancellarla;
  **Mostra sul sito** la rimette. **Cancella la pagina** la toglie per sempre;
  non si cancella finché è nel menu o nel footer.

Le pagine di legge (**privacy, cookie, contributi pubblici**) non si
nascondono né si cancellano.

Se esci con qualcosa scritto e non salvato, l'app chiede prima.

### Il nuovo editor, da provare

Accanto ai tasti di una pagina c'è **Prova il nuovo editor**: lo stesso lavoro,
in un editor solo, a tutto schermo. Non c'è per le pagine di legge, e si apre
solo se la pagina è salvata.

- A sinistra, in **Parti**, le quattro parti (foto in cima, testo, foto,
  colonne): si trascinano nella pagina dove le vuoi. In **Struttura** c'è
  l'elenco delle parti della pagina: trascinando una riga la sposti.
- Al centro la pagina, coi caratteri e i colori del sito, come sul tablet.
  Sopra, i tasti per vederla come sul telefono o sul computer.
- A destra i campi di quel che hai scelto. Senza niente di scelto ci sono
  **Titolo** (anche su Google) e **Descrizione**; scelto un testo, lo scrivi lì o
  direttamente nella pagina. **Pagina**, in cima, riporta a titolo e descrizione.
- **Com'è sul sito** mostra la pagina com'è dopo la pubblicazione, con tessere e
  orari.
- **Salva bozza** salva senza cambiare il sito; resta spento finché non cambi
  qualcosa, o se manca qualcosa (una foto senza immagine, il titolo): accanto c'è
  scritto cosa, in fondo allo schermo. Anche le pagine scritte col testo solo si
  aprono a parti, ma restano come prima finché non salvi: la prima volta l'app
  chiede, perché salvata la pagina resta a parti.
- Per **pubblicare** chiudi il nuovo editor (**Chiudi**: torni alle pagine),
  riapri la pagina e premi **Pubblica**.

## L'orario dai corsi

Nella pagina di un corso l'**orario** può venire da CORSI invece che dal testo.
Aprendo la pagina, a destra, sotto **ORARIO DAI CORSI**:

- **Collegata al corso** dice da quali corsi viene l'orario. Si sceglie dalla
  lista (**Scegli un corso**, poi **+ Un altro corso** per aggiungerne altri,
  per esempio i gruppi piccoli e grandi di uno stesso corso); la ✕ accanto al
  nome scollega. Non c'è bisogno di **Salva bozza** né di **Pubblica**: il
  collegamento vale subito, e il sito si aggiorna da solo entro 5 minuti. Se
  non scegli nessun corso, l'orario resta quello scritto a mano, come prima.
- **Così lo vede il sito** mostra le righe come le farà il sito: giorno, ora e
  durata («Lunedì e mercoledì · 17:00–18:00»), i giorni con la stessa ora
  insieme, da lunedì a domenica. Mai sala, istruttore o posti. Se cambi i giorni
  di un corso in CORSI, cambia da solo anche qui e sul sito.
- Con il corso collegato l'orario scritto a mano nel testo non si vede più sul
  sito, ma non si cancella (la casella **ORARIO SUL SITO** dice «Ora vale CORSI»):
  se scolleghi i corsi lo ritrovi.
- Se un corso collegato non ha giorni in CORSI (o li ha tutti finiti), il
  pannello avvisa. Se mancano gli orari di tutti i corsi collegati, **il sito
  mostrerà «Orario in arrivo»**; se mancano solo di alcuni, il sito non mostra
  quelli e tiene gli orari degli altri. **Apri il corso in CORSI ›** porta al
  corso per aggiungere un giorno. Un orario vecchio non torna mai.
- **L'età e il testo si controllano a mano.** L'età è una voce scritta a mano
  (nelle pagine con la fascia blu, come Pre pugilistica e Autodifesa, resta
  nella fascia; giorno e ora li sostituisce l'orario di CORSI). Frasi come «il
  martedì alle 18» scritte in un paragrafo non le cambia nessuno.

Se compare «Qui l'orario dai corsi non è ancora attivo», va lanciato
`68-sito-orario.sql` (lo fa chi cura l'app): finché non c'è, l'orario delle
pagine resta quello scritto a mano.

## Le immagini

**Immagini** è la libreria delle immagini caricate per le pagine. **CARICA
UN'IMMAGINE** prende uno o più file JPEG, PNG o WebP; una foto che pesa più di
1 MB si rimpicciolisce da sola, una piccola resta com'è (una PNG con la
trasparenza non la perde). Ogni immagine dice in quali pagine è usata, anche
nella bozza: finché è usata non si cancella; se non lo è, **Togli** la toglie.

Per metterne una nel testo, in una pagina tocca **IMMAGINE**: scegli una di
quelle caricate (o **+ CARICA UN'IMMAGINE NUOVA**, che la sceglie da sola),
scrivi nel **testo alternativo** cosa si vede, per chi non la vede, oppure
spunta **solo decorativa**; poi **Inserisci**. Senza testo e senza la spunta
non si inserisce. Nel testo l'immagine va a tutta la larghezza e si sposta o si
cancella come un paragrafo.

Toccata una foto nel testo, ha il bordo pieno e al posto dei tasti del testo
compare la barra **FOTO SCELTA**: il campo del testo alternativo (si salva
uscendo dal campo o con Invio), **Solo decorativa**, **CAMBIA FOTO** e **Togli la
foto**. Un tocco sul testo riporta i tasti del testo.

Le immagini sono **pubbliche**: chiunque conosca l'indirizzo le vede, anche se
la pagina è nascosta. Niente foto di persone senza il loro permesso, per i
minorenni quello dei genitori; niente documenti. Finché sul database non c'è
`58-sito-immagini.sql`, **Immagini** dice che non sono ancora attive e le
pagine si scrivono come prima.

## Menu e footer

**Menu e footer** ha due elenchi: **MENU IN ALTO** e **FOOTER**. Ogni voce ha
un nome e dice dove porta: una pagina del sito o un indirizzo. Il nome arriva a 60 lettere. Le frecce
**↑** e **↓** la spostano, **Togli** la toglie, **+ Aggiungi una voce**
ne aggiunge una. **Salva** salva, **Butta i cambi** torna a prima. Se passi da **Pagine** a **Menu e footer** con voci a metà, l'app chiede prima.

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
**pubblicate** e si aggiorna da solo: dopo **Pubblica** ci vogliono un paio
di minuti perché compaia (non si preme niente). Quelle in bozza, nascoste o
mai pubblicate non ci sono. Il
passaggio dal sito di prima a quello nuovo, e le immagini, arrivano in un
secondo momento: finché non è fatto, **Pubblica** prepara il testo ma il sito
che si vede è ancora quello vecchio.

Il sito nuovo ha sempre una **Home**: senza una Home pubblicata non si genera.
Le pagine di legge (privacy, cookie, contributi pubblici) hanno l'impaginazione
solo testo; le altre hanno in cima il titolo grande (in maiuscolo) e, sotto, la frase della
**descrizione**. In alto a destra c'è il solo pulsante «Iscriviti»; l'invito giallo in fondo
compare se esiste una pagina pubblicata con indirizzo `contatti`. **Contatti è una voce del
menu**, non un pulsante: nel menu e nel piede si chiama sempre «Contatti», qualunque
etichetta scrivi, e sta nel posto che le dai in **MENU**. Un pulsante «Scrivici» verso
`/contatti/` scritto nel testo di una pagina il sito non lo mostra (il testo qui resta com'è);
i pulsanti verso WhatsApp o altri indirizzi restano.

**L'aspetto** è sempre lo stesso per tutte le pagine e non si cambia da qui: sfondo azzurro chiaro,
titoli neri stretti in maiuscolo, pulsante «Iscriviti» giallo in alto a destra, il logo intero in cima e, in
fondo, l'invito giallo e una tessera scura con i recapiti.

Se compare «Il pannello del sito non è ancora attivo sul database», manca un
aggiornamento del database: va chiesto a chi cura l'app.

## La pagina degli orari

La pagina **Orari** del sito mostra gli orari dei corsi senza che tu li scriva:
li prende da **CORSI**. Cambi un orario in CORSI e il sito si aggiorna da solo in
circa 5 minuti, **senza premere Pubblica**.

Per avere la pagina:

1. In **Sito**, **Nuova pagina**, con titolo «Orari»: l'indirizzo deve restare
   `orari`.
2. Nel testo scrivi tre righe, una per riga (premi Invio fra l'una e l'altra):
   - una frase di introduzione;
   - `[orari]`, da solo, con le parentesi quadre: lì compaiono gli orari;
   - la riga per le variazioni, per esempio «Per variazioni contatta la
     segreteria: 346 329 2786.».
3. **Pubblica**, poi in **Menu e footer** aggiungi la voce **Orari** e scegli
   questa pagina.

Attenzione a `[orari]`: se lo scrivi diverso (`[orario]`, parentesi tonde, un
altro indirizzo della pagina) non c'è nessun avviso, e la pagina esce con le
tue righe e senza orari. Guarda sempre l'**Anteprima** prima di Pubblica.

Come si presenta: una tessera per ogni giorno, da lunedì a domenica (un giorno
senza lezioni non c'è), con ora di inizio e fine e nome del corso. In fondo, la
tua riga delle variazioni e il pulsante giallo **Scrivici su WhatsApp**: il
pulsante c'è sempre e usa il numero dei contatti del sito, non si scrive nella
pagina. Sotto, «Aggiornato al…»: il giorno dell'ultima volta che hai cambiato
giorno, ora, durata, fine o corso di una lezione (cambiare la sala non lo
sposta).

Finché nessun corso ha un orario, la pagina dice «Orari in arrivo» e, sotto il
titolo, «L'orario della settimana comparirà qui.» al posto della tua
introduzione.

Sul sito **non** compaiono la sala, l'istruttore, gli iscritti, né le lezioni
annullate o con un sostituto: è l'orario tipo, uguale per tutto l'anno. Un corso
archiviato, o un orario che è già finito, non ci sono.

Se compare un errore su `orari_sito`, manca un aggiornamento del database
(`69-orari-sito.sql`): va chiesto a chi cura l'app. Il sito di prima resta
com'è finché non c'è.

## Come il testo diventa tessere

Il sito mette in pagina da solo quello che scrivi, secondo come lo scrivi. Nell'ANTEPRIMA del pannello vedi
il testo «com'è scritto»: le tessere si vedono solo sul sito, dopo **Pubblica** e un paio di minuti.

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
- **La Home nuova** (testo pronto in `docs/sito/home.md` e `home.html`): si riconosce da un paragrafo col pulsante **«Prova una settimana a 5 €»** (verso `https://app.officinedellosport.it/iscrizioni/`), prima del primo titolo grande; un «Scrivici» verso `/contatti/` accanto non esce. Senza il pulsante verso il modulo online la Home resta come prima, senza avvisi: se dopo **PUBBLICA** non cambia niente, controlla quell'indirizzo. Da lì il sito riconosce ogni sezione dalla forma: i **numeri** (elenco di 2–6 voci col grassetto), i **corsi** (sottotitoli col link: foto facoltativa, età, descrizione, fasce in corsivo), i **quattro motivi** (quattro sottotitoli con un paragrafo), le **citazioni con «LEGGI TUTTO»** (primo paragrafo l'estratto, poi il testo intero, poi la firma in corsivo; le virgolette non si scrivono), le **recensioni** (due citazioni e un sottotitolo «In breve» con un elenco), le **domande** e la **chiamata finale** (l'ultima sezione, con i due pulsanti e la foto). Prima di incollare il testo nuovo cancella tutto il vecchio.
- **I nostri corsi, nella nuova veste** (testo pronto in `docs/sito/corsi.md` e `corsi.html`): come la Home, parte solo se nel testo c'è il pulsante **«Prova una settimana a 5 €»** (verso `https://app.officinedellosport.it/iscrizioni/`) **e** ogni corso è un sottotitolo con il link alla sua pagina; altrimenti la pagina resta come prima, senza avvisi. Il **primo paragrafo** (prima dei corsi) è la frase sotto il titolo: non è la descrizione. Ogni corso ha la foto subito sotto il titolo (facoltativa: senza, la scheda ha una fascia con l'iniziale), l'età, la descrizione e le fasce in corsivo; **le foto messe dopo l'ultimo corso non si usano**. In fondo, sotto un titolo grande, la chiamata con i due pulsanti e una foto. Prima di incollare cancella tutto il vecchio.
- **La pagina di un corso nuova** (testi pronti in `docs/sito/<corso>.md` e `<corso>.html`, quello di prima in `<corso>-precedente.html`): si riconosce dallo stesso paragrafo con i due pulsanti della Home nuova, prima del primo titolo grande. Senza, la pagina resta com'era, senza avvisi: se dopo **PUBBLICA** non cambia niente, controlla l'indirizzo del pulsante «Prova una settimana a 5 €». Con la **foto** in apertura il sito mette subito dopo i quattro dati e l'orario a tessere. **Senza foto** (Pre pugilistica, Autodifesa) la pagina non ne presta una: al suo posto c'è una fascia blu con le prime tre voci dell'elenco (nei testi pronti: Quando, Ora, Per chi), Dove e Per iniziare restano tessere e l'orario non si ripete. Poi «Cosa si fa» e «A chi è rivolto» (due sottotitoli sotto un titolo vuoto; una foto nel primo sta accanto al testo), le sezioni libere (la storia del judo), «Cosa aspettarsi» (3 o 4 sottotitoli con un paragrafo, numerati: deve essere la sezione subito prima della chiusura) e la chiusura (l'ultima sezione con i pulsanti; una foto in fondo sta a destra).
- **La Home nuova** (testo pronto in `docs/sito/home.md` e `home.html`): si riconosce da un paragrafo col pulsante **«Prova una settimana a 5 €»** (verso `https://app.officinedellosport.it/iscrizioni/`), prima del primo titolo grande; un «Scrivici» verso `/contatti/` accanto non esce. Senza il pulsante verso il modulo online la Home resta come prima, senza avvisi: se dopo **Pubblica** non cambia niente, controlla quell'indirizzo. Da lì il sito riconosce ogni sezione dalla forma: i **numeri** (elenco di 2–6 voci col grassetto), i **corsi** (sottotitoli col link: foto facoltativa, età, descrizione, fasce in corsivo), i **quattro motivi** (quattro sottotitoli con un paragrafo), le **citazioni con «LEGGI TUTTO»** (primo paragrafo l'estratto, poi il testo intero, poi la firma in corsivo; le virgolette non si scrivono), le **recensioni** (due citazioni e un sottotitolo «In breve» con un elenco), le **domande** e la **chiamata finale** (l'ultima sezione, con i due pulsanti e la foto). Prima di incollare il testo nuovo cancella tutto il vecchio.
- **Gli istruttori** (testi pronti in `docs/sito/istruttori.md` e `istruttori.html`): per ogni tecnico si scrive il **nome** (titolo piccolo), la **foto** (facoltativa) e una riga **«Cognome · corso, corso»** (il puntino `·` divide il cognome dai corsi, la virgola un corso dall'altro). Il sito fa le tessere a quattro colonne con i corsi in pastiglie, mette per primi Maurizio, Maura, Diana, Fabio, Tiziano, Valerio, Manuel e Federico (poi gli altri come scritti) e alterna i colori a diagonali, e scrive da solo il testo alternativo delle foto. Il **nome diventa un link (con la freccia ↗) solo se la pagina di quell'istruttore è pubblicata**: se colleghi un nome e la freccia non compare, controlla che la sua pagina sia pubblicata (l'indirizzo è piatto, `/fabio-berta/`). Se l'ultima riga di quattro è incompleta, compare da sola la tessera «Vieni a conoscerli sul tatami»: aggiungendo o togliendo un tecnico può comparire o sparire. La **scheda scarna** di un istruttore (foto facoltativa e un elenco con la sola voce **Corsi**; modello in `docs/sito/istruttori/modello-scarno.md`) mostra nome, foto o iniziale, corsi, i due pulsanti e l'invito.
- **La Chi siamo nuova** (testo pronto in `docs/sito/chi-siamo.md` e `chi-siamo.html`): si riconosce da un pulsante verso il modulo online (**«Prova una settimana a 5 €»**, `https://app.officinedellosport.it/iscrizioni/`) in una delle sezioni, di norma la chiamata finale. Senza quel pulsante la pagina resta come prima, senza avvisi. Il sito riconosce ogni fascia dalla forma: foto con citazione (la frase grande), due titoli piccoli (le tessere), l'elenco coi numeri, **una foto con un paragrafo** sotto un titolo grande (pannello: il primo scuro, il secondo giallo), **più foto ognuna col suo paragrafo** (la fila con i nomi dei corsi, più un pulsante «Vedi tutti i corsi»), i quattro valori e la chiamata finale con i due pulsanti. Prima di incollare il testo nuovo cancella tutto il vecchio.
- **La pagina Contatti nuova** (testo pronto in `docs/sito/contatti.md` e `contatti.html`): si riconosce da un paragrafo con due pulsanti, **«Prova una settimana a 5 €»** (verso `https://app.officinedellosport.it/iscrizioni/`) e **«Scrivici»** (verso `https://wa.me/393463292786`, sempre con `https://`), prima dei recapiti. Senza il pulsante verso il modulo online la pagina resta com'è. Da lì il sito riconosce dalla forma i **quattro recapiti** (sottotitolo, valore, un paragrafo che è solo un link), **«Come arrivare»** (mappa, pulsante e tre sottotitoli), i **tre passi della prova** (tre sottotitoli con un paragrafo, foto in fila subito dopo) e le **domande**. Prima di incollare cancella tutto il vecchio testo e risolvi i segnaposto tra parentesi quadre.
- **Il pulsante verso il modulo online si legge sempre «Iscriviti»** sul sito, in testata, nel menu, nella barra del telefono e nelle pagine nuove, comunque l'abbia scritto il testo («Prova una settimana a 5 €» resta valido per farlo riconoscere). Il prezzo della prova lo dicono le frasi intorno.
- Nelle **pagine di un corso**, di **Chi siamo**, di **Contatti**, degli **istruttori** (elenco e singola persona) e nell'elenco **I nostri corsi** le regole di scrittura sono nei testi pronti di `docs/sito/<pagina>.md`: ogni pagina ha il suo testo da incollare e le sue foto proposte in `docs/sito/foto.md`.
- Il paragrafo scritto **dopo l'ultimo sottotitolo** finisce nell'ultima tessera: per chiudere la griglia e
  scrivere altro, apri un nuovo titolo grande.
- Le pagine di legge e le pagine senza titoli grandi restano testo in colonna, come prima.
