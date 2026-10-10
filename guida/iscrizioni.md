# Iscrizioni

*Indirizzo: `iscrizioni/` · Per: chi vuole iscriversi · Senza accesso*

← [Torna alla guida generale](README.md)

È la pagina pubblica da mandare a chi chiede come ci si iscrive, al posto della
lista di passi scritta ogni volta su WhatsApp. Non chiede nessun accesso.

L'indirizzo è <https://nalbertini.github.io/ods-corsi/iscrizioni/>. In
segreteria si copia al volo con **COPIA LINK ISCRIZIONI**, in fondo al menu.

## Cosa c'è nella pagina

- **Prima di iscriverti**: le **prove**, una lezione (3 €) o una settimana
  (10 €), per chi non ha ancora deciso, con il tasto CHIAMA.
- **I passi, in ordine**, ognuno col suo tasto:
  1. **Leggi il modulo** — per maggiorenni, o per minori (firmato dal
     genitore). Col modulo dell'app si firma col dito nell'ultimo passo; chi
     preferisce lo stampa, lo firma a mano e ne carica la foto.
  2. **Il pagamento** — la quota associativa e il trimestre, oppure l'annuale,
     con l'IBAN da copiare con un tocco e il tasto **PAGA CON SATISPAY**, che
     apre l'app sul negozio dell'associazione (il link è
     `PAGAMENTO.satispay` in `src/lib/iscrizione.ts`). Oppure in contanti in
     segreteria.
  3. **La richiesta** — con il modulo dell'app (**COMPILA LA RICHIESTA**)
     oppure, finché quello non è acceso, con il modulo Google (**APRI IL
     MODULO**), che ha i suoi passi: scaricare il modulo, firmarlo e caricarlo.
- **I costi** della stagione, quelli del [listino](segreteria/listino.md)
  della segreteria, e il foglio in PDF finché il listino non è stato
  cambiato. Passata la data del saldo (il 31 agosto) la colonna **SALDO 31/8**
  sparisce: quel prezzo non vale più.
- **I contatti**: CHIAMA, MAPPA, INSTAGRAM, FACEBOOK, IL SITO.

## Il modulo di iscrizione dell'app

Chi si iscrive risponde alle domande dal telefono:

- **Chi si iscrive**: nome, cognome, codice fiscale, data e luogo di nascita.
  Scritto il codice fiscale, data e luogo si riempiono da soli e non si
  cambiano (si corregge il codice); accanto alla data c'è quanti anni ha, così
  il codice del genitore al posto di quello del figlio si vede subito. Se il
  codice non è valido, la data si scrive a mano.
  Se dalla data di nascita risulta **minorenne**, il modulo chiede anche i dati
  del **genitore** e il modulo per minori, che firma il genitore.
- **Residenza**, e **come raggiungerti** (email, telefono e, se si vuole, un
  **telefono 2**; per un minore, quelli del genitore).
- **I corsi** a cui iscriversi e **come paghi** (trimestre o annuale). Sotto
  ogni corso ci sono età e orari del listino. Scritta la data di nascita, i
  corsi giusti per quell'anno vengono per primi, sotto **PER LA SUA ETÀ** (anche se si è nati nei sei
  mesi prima o dopo gli anni del corso); sotto **SENZA FASCIA D'ETÀ**
  quelli per cui il listino non dice gli anni, e sotto **ALTRI CORSI** quelli
  di un'altra età: si possono scegliere lo stesso, e un avviso giallo dice
  quali sono e che la segreteria richiama. Un corso che il listino non ha
  ancora (senza prezzo) si sceglie lo stesso, e sotto il nome c'è scritto
  «prezzo da confermare».
- **Il modulo**: le autorizzazioni si firmano **qui, col dito** (o col mouse
  dal computer). Si sceglie come sul foglio se si acconsente al
  **tesseramento** alla FIJLKAM e/o FIPE e se si autorizzano le **foto**; per
  un minore si scrive anche dove è nato il genitore, e firma il genitore.
  Il riquadro della firma è piccolo: sotto c'è **FIRMA A SCHERMO INTERO**
  (o basta un tocco sul riquadro), che apre una schermata tutta per la firma,
  con **ANNULLA**, **FATTO** e **CANCELLA E RIFAI**. **Gira il telefono in
  orizzontale: firmi meglio**, il riquadro diventa molto più alto (in
  verticale un riquadro giallo te lo ricorda finché non cominci a firmare).
  La schermata sta ferma
  mentre firmi: la pagina sotto non scorre e il tasto indietro del browser non
  fa niente. Se **giri il telefono** la firma si cancella e va rifatta (lo
  dice un avviso), perché le misure cambiano; **ANNULLA** lascia la firma di
  prima.
  **GUARDA IL MODULO** mostra il PDF com'è venuto: il foglio della palestra
  con i dati delle domande, le crocette, la data e la firma su ogni riga dove
  serve, e in fondo, in piccolo, che è stato firmato dal telefono e quando.
  È quello che parte come modulo firmato. Chi ha già il foglio firmato a mano
  sceglie **Ho il foglio firmato** e ne carica la foto.
  Se si cambia la data di nascita e chi si iscrive diventa minore (o non lo è
  più), il foglio è un altro: firma, crocette e foto del foglio si azzerano, e
  un avviso giallo dice «Firma e autorizzazioni vanno rifatte».
- **I file**: la foto della **carta d'identità** (per un minore, quella del
  genitore; non si chiede per un minore aggiunto dal nucleo, perché la
  segreteria ha già quella del genitore), il retro se serve, il **certificato
  medico** se ce l'ha già (lo vede solo la segreteria), e la **ricevuta del pagamento** se ha già pagato:
  chi paga in contanti al banco la lascia vuota (accanto c'è **PUOI PAGARE IN
  SEGRETERIA**). Il certificato si
  chiede solo quando serve: dai 6 anni quello normale, dai 12 quello
  agonistico se tra i corsi scelti c'è judo, aikido o lotta (lo dice il nome
  del corso). Si può anche portare dopo in segreteria (accanto al nome
  c'è **PUOI PORTARLO DOPO**), ma senza non si
  partecipa alle lezioni: se non è stato caricato, lo ricorda **RICHIESTA
  ARRIVATA**. Il documento la segreteria lo stampa, lo tiene su carta e lo
  cancella dall'app; il certificato resta nell'app e lo vede solo la
  segreteria.
- **Altro**: le note per la segreteria (facoltative, e **mai dati sulla
  salute**: quelli si portano in segreteria), la casella obbligatoria
  «Accetto il Regolamento Sociale» (col link al regolamento, quando c'è:
  `REGOLAMENTO` in `src/lib/iscrizione.ts`) e la casella «Ho letto
  l'informativa privacy».

Nel modulo non resta niente sul telefono: chiuso, si riparte da capo. Per
questo **← INDIETRO**, se c'è già qualcosa di scritto, firmato o scelto, al
primo tocco chiede «LE RISPOSTE SI PERDONO · ESCI?» e esce solo al secondo;
senza il secondo tocco, dopo qualche secondo torna com'era.

Premuto **MANDA LA RICHIESTA**, compare **RICHIESTA ARRIVATA**. Se un file non
è partito compare **MANCA QUALCHE FILE**, con il tasto per riprovare (per
un'ora); altrimenti i fogli si portano in segreteria.

La richiesta **non è ancora un'iscrizione**: arriva in segreteria, in
[RICHIESTE ONLINE](segreteria/richieste.md), dove qualcuno guarda i file e la
accoglie.

## Il modulo a passi (solo in prova)

È un modulo nuovo, che fa le stesse domande una schermata alla volta. Chi si iscrive fa sette passi (**I TUOI DATI**, **SCEGLI IL CORSO**, **IL MODULO E LA FIRMA**, **I DOCUMENTI**, **LA FAMIGLIA**, **QUANTO PAGHI**, **CONTROLLA E INVIA**); per un figlio sono otto, perché c'è anche **IL GENITORE CHE FIRMA**. Nel passo del corso, sopra i tasti, c'è sempre il **TOTALE** da pagare, che cambia a ogni scelta: con più persone è quello di tutti, e lo dice (**TOTALE FAMIGLIA**). A QUANTO PAGHI il conto è nel passo. Prima
si sceglie **IO, SONO ADULTO** o **MIO FIGLIO O MIA FIGLIA**, poi si va avanti
con **AVANTI**. Se tocchi AVANTI e manca qualcosa, in fondo allo schermo una riga dice quante cose mancano e **VAI A** la prima: un tocco e il cursore è già nel campo. La freccia accanto apre l'elenco di tutto quel che manca, e ogni voce porta al suo campo. L'ultimo passo
è il riepilogo: da lì **MODIFICA** riporta al passo da cambiare, e **MANDA LA
RICHIESTA** la manda.

**LA FAMIGLIA** viene dopo i documenti, prima di QUANTO PAGHI: «Iscrivi anche
qualcuno della tua famiglia?» (o «qualcun altro della famiglia?» per chi
iscrive un bambino), il riquadro verde **−20% SCONTO FAMIGLIA** e due carte.
Chi si iscrive da adulto trova **UN FIGLIO O UNA FIGLIA** (con il corso per
bambini alla stessa ora del suo, se c'è) e **UN ALTRO ADULTO** (lo stesso
corso, gli stessi giorni); chi iscrive un bambino trova **UN FRATELLO O UNA
SORELLA** e **TU O UN ALTRO ADULTO** (un corso per te mentre il bambino si
allena). Sotto **STESSA ORA** la carta nomina il corso coi giorni e l'ora
(da tre corsi in su li conta), e in verde quanto si risparmia con l'annuale.
Il tasto tratteggiato aggiunge la persona: per un adulto, chi iscrive un
bambino sceglie fra **IO** col suo nome (**IO, PAOLO**: si iscrive anche lui, e nome, codice
fiscale, residenza, contatti, carta d'identità e firma sono quelli già scritti
per il bambino, e restano da dare solo il corso, come paga, il tesseramento,
le foto e il certificato) e **UN ALTRO ADULTO**; per un bambino, se può
firmare più di un adulto, si sceglie chi firma per lui. Un fratello che firmi tu ha già
la tua carta d'identità, il tuo ok e dove sei nato: si firma solo il suo modulo. Nessuno da
aggiungere? **AVANTI, SOLO IO** (o **AVANTI**) e si va a QUANTO PAGHI.

Chi si aggiunge parte dal suo primo passo. Al suo passo del corso, in cima,
sotto **ALLA STESSA ORA DI** e il nome di chi si è iscritto per primo, ci sono
i corsi per la sua età che si fanno mentre lui è in palestra (basta che le
lezioni si sovrappongano, anche solo in parte, almeno un giorno; lo dice il
calendario dei corsi): se è uno solo è già spuntato, e un altro adulto trova
già spuntati i corsi di chi si è iscritto per primo. Si può togliere e
sceglierne un altro. Finiti i suoi documenti, AVANTI porta di nuovo a LA
FAMIGLIA (per aggiungere qualcun altro) e poi a QUANTO PAGHI, col conto di
tutti.

**QUANTO PAGHI** viene dopo LA FAMIGLIA, prima del riepilogo, ed è uno
solo per tutto il modulo: il conto di tutti con lo sconto famiglia, la cifra da
pagare, l'IBAN con **COPIA IBAN**, la causale con **COPIA CAUSALE** e **PAGA CON
SATISPAY**. La causale ha i nomi di tutti, il cognome uguale una volta sola
(«Iscrizione Manuela e Nicola Albertini»); da soli resta col corso. La
**ricevuta** del bonifico è facoltativa e una sola per tutti: chi la carica
prima di aggiungere un familiare, o prima di cambiare corso, legge sotto di
quanto è cambiato il totale e che la differenza si paga in segreteria o con un
altro bonifico. Nel riepilogo, la riga **Ricevuta del pagamento** porta qui. Se la ricevuta non c'è, la
schermata finale, sotto **DA PAGARE**, ripete IBAN e causale, con i tasti per
copiarli.

Nel passo dei dati, scritto il **CAP**, il comune lo propone l'app, per i CAP
della provincia di Torino: se il CAP è di un comune solo e **COMUNE** è vuoto si
scrive da sé, con sotto «Dal CAP …»; se è di più comuni compaiono i comuni da
toccare (fino a sei) o una tendina. Il comune si può sempre correggere a mano, e
uno già scritto non si tocca. Fuori provincia si scrive come prima. L'elenco dei
CAP non è di Poste (che non lo pubblica): se un comune manca o è sbagliato, va
corretto in `scripts/cap-torino.mjs`.

Chi si aggiunge prende indirizzo e contatti già scritti, e ognuno sceglie i
suoi corsi. Da lì in poi, in ogni passo, sotto il numero ci sono i nomi di
tutti, per passare dall'uno all'altro; per aggiungerne un altro si torna a LA
FAMIGLIA, non all'ultimo passo. Quando chi firma non è chi compila (un altro adulto, o il bambino
firmato da un altro adulto), il modulo lo chiama per nome: «Firma Paola, che è
maggiorenne», **L'OK DI PAOLA**, **LA CARTA D'IDENTITÀ DI PAOLA**. Per chi si è aggiunto con **IO**, la
casella delle foto porta il suo nome (**LE FOTO E I VIDEO DI NICOLA**).

Quando c'è da scegliere fra due cose (**IO, SONO ADULTO** o **MIO FIGLIO**, **TRIMESTRE** o **ANNUALE**, **AUTORIZZO** o **NON AUTORIZZO**) la scelta fatta si riempie: è il tasto pieno. I corsi, dove se ne possono scegliere più d'uno, hanno invece la casella con la spunta. I bordi dei campi sono più chiari, anche nel tema scuro.

I corsi per grandi (quelli che la segreteria segna con un'età minima in **LISTINO**, per esempio la Pesistica dai 16 anni) non compaiono per un bambino troppo piccolo: sotto l'elenco una frase dice quali e di chiamare la segreteria. Per chi ha l'età compare fra i corsi per lui, con scritto «dai 16 anni».

Chi iscrive un figlio trova scritto di chi è ogni cosa: **LA CARTA D'IDENTITÀ DI** e **IL RETRO DELLA CARTA DI** col nome di chi firma (la sua, non quella del bambino; finché il nome non c'è, **DEL GENITORE**), **IL CERTIFICATO DI** e il nome del bambino (con cosa succede se manca), e l'errore sul codice fiscale dice «Metti il tuo codice fiscale, non quello di» e il nome. Il luogo di nascita del genitore (**DOVE SEI NATO**, **PROVINCIA**) si chiede solo nei suoi dati e solo se il suo codice fiscale non lo dice da sé.

In ogni passo, sotto il numero, c'è **CHIAMA**: un tocco e si telefona alla segreteria. A ogni passo nuovo il cursore va al titolo, così chi usa uno screen reader sente dove si trova. Se si esce o si ricarica la pagina dopo aver scritto qualcosa, il browser chiede conferma. Alla fine, **RICHIESTA ARRIVATA** dice dove la segreteria ti scrive o ti chiama, e se non hai caricato la ricevuta quanto devi pagare e come (l'IBAN, e per una persona sola anche la causale), con **CHIAMA LA SEGRETERIA** a portata di mano.

Per ora si apre solo in prova, con l'indirizzo `iscrizioni/?prova#nuova`.
Non salva niente: se si esce prima di mandare, le risposte si perdono, e con
la prova nulla va a un server. Il modulo di sopra resta quello di oggi.

Cosa arriva in **RICHIESTE ONLINE**: una richiesta per persona (anche per chi
iscrive il bambino e si è aggiunto con **IO**: la sua ha i suoi dati, la sua
carta d'identità e il suo modulo, con la firma data per il bambino). Sono
separate, e nelle note di ognuna c'è una riga che dice «mandata insieme alla
richiesta di…, sconto famiglia da applicare», così la segreteria le lega. La ricevuta del
bonifico, se c'è, arriva in ognuna: è un pagamento solo per tutte. Le note che scrive chi
compila sono al massimo 900 caratteri, per fare posto a quella riga.

## Ordinare il vestiario

Judogi, costumini da lotta e vestiario della palestra si ordinano da una pagina
pubblica, al posto del modulo Google. L'indirizzo è
<https://nalbertini.github.io/ods-corsi/iscrizioni/#vestiario>: in segreteria
si copia con **COPIA LINK ORDINI**, in fondo al menu. Finché gli ordini sono
aperti, anche la pagina delle iscrizioni ha in fondo il riquadro **IL
VESTIARIO** con **ORDINA IL VESTIARIO**.

I passi sono quelli del vecchio modulo Google:

1. **PER CHI È** — nome e cognome di chi indossa i capi: il bambino, o
   l'adulto che ordina per sé.
2. **IL TIPO** — **JUDOGI**, **COSTUMINI LOTTA** o **VESTIARIO LOGATO**. Ci
   sono solo i tipi che hanno capi; se ce n'è uno solo, il passo si salta.
3. **La pagina del tipo** — in cima la tabella delle taglie, poi ogni capo
   con la foto, il prezzo e la nota. Toccando una foto o la tabella si apre
   grande, e si ingrandisce con le dita. Un capo si ordina scegliendo la
   **TAGLIA**: **QUANTI** parte da 1, e rimettere «Scegli» lo toglie.
4. **TI SERVE ALTRO?** — un altro tipo, **+ PER UN'ALTRA PERSONA** (un
   fratello: si riparte da PER CHI È, nello stesso ordine) o **NO, HO
   FINITO**.
5. **CHI ORDINA** — nome, cognome e telefono di chi ordina (la segreteria
   chiama chi non ha pagato); l'email è facoltativa. Sotto c'è il riepilogo,
   persona per persona: taglia e quantità si cambiano lì, e **Togli** toglie
   una riga.
6. **MANDA L'ORDINE**. Il totale lo calcola l'app coi prezzi del catalogo.

Le scelte restano se si torna indietro o la pagina si ricarica. Riaprendo il
link con un ordine lasciato a metà, in cima si legge cosa c'è già («Hai già
scelto 2 capi per Luca Rossi»), con **VEDI IL RIEPILOGO** e **RICOMINCIA DA
CAPO**. Scrivere di nuovo il nome di una persona già nell'ordine continua con
le sue scelte. Una foto che non arriva (rete debole) non blocca l'ordine.

**ORDINE ARRIVATO** ripete l'ordine e dice come pagare: bonifico (**COPIA
IBAN**, **COPIA CAUSALE**), Satispay o contanti in segreteria. **CONDIVIDI IL
RIEPILOGO** lo manda dove si vuole, per esempio a sé stessi su WhatsApp: dopo
non si può più rileggere dalla pagina. Al fornitore va solo quello che è
pagato entro la data di chiusura.

Un ordine mandato non si cambia dalla pagina: per una taglia sbagliata si
chiama la segreteria. Dopo la data di chiusura la pagina dice **ORDINI CHIUSI**
e dà il telefono; prima che la segreteria li apra dice **ORDINI NON ANCORA
APERTI**.

## Cosa dire a chi chiede

- «Ti mando il link: ci sono i passi, i costi e il modulo.»
- «Quando hai mandato la richiesta la guardiamo noi e ti iscriviamo ai corsi
  che hai scelto.»
- Per i dubbi: telefono o passare in palestra, come dice il fondo della
  pagina.
