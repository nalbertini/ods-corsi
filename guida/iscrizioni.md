# Iscrizioni

*Indirizzo: `iscrizioni/` · Per: chi vuole iscriversi · Senza accesso*

← [Torna alla guida generale](README.md)

È la pagina pubblica da mandare a chi chiede come ci si iscrive, al posto della
lista di passi scritta ogni volta su WhatsApp. Non chiede nessun accesso.

L'indirizzo è <https://app.officinedellosport.it/iscrizioni/>. In
segreteria si copia al volo con **COPIA LINK ISCRIZIONI**, in fondo al menu:
il link copiato finisce con `?da=segreteria`, così le richieste che arrivano
da lì si contano come «Link della segreteria» (vedi
[Statistiche](segreteria/statistiche.md)). Chi lo apre non vede niente di
diverso.

## Cosa c'è nella pagina

La pagina ha l'aspetto del sito della palestra (blu e giallo, sempre chiaro,
qualunque sia il tema dell'app) ed è corta: si legge dall'alto, in questo
ordine.

1. **Il titolo**: il marchio della palestra, «Iscriviti a Officine Dello
   Sport» e la frase «Compili la richiesta dal telefono. La segreteria la
   guarda e ti richiama.». In cima non c'è la testata dell'app né un tasto: la
   pagina non promette un giorno né un'ora.
2. **Cosa ti serve**: una lista di cosa preparare, una cosa per riga con una
   casella da spuntare a mente (la pagina non salva niente):
   - il **codice fiscale** di chi si iscrive, e il tuo se iscrivi un figlio;
   - la **carta d'identità** di chi si iscrive, dai 6 anni (quella del
     genitore non serve);
   - il **certificato medico**, **SE CE L'HAI**: se no lo porti in segreteria
     prima della prima lezione;
   - **come paghi**, **NELLA RICHIESTA**: con Satispay, oppure col bonifico,
     e allora serve la sua ricevuta.
3. **Quanto costa**, in breve: la quota associativa (quella del
   [listino](segreteria/listino.md)), lo sconto famiglia e il costo di più
   corsi, come si paga in una riga (bonifico o Satispay, prima di mandare la
   richiesta) e il tasto **PREZZI E PAGAMENTO**.
4. **Non sai ancora quale corso? Hai un dubbio?** Un riquadro solo: le
   **prove**, una lezione (3 €) o una settimana (10 €), indirizzo e telefono,
   e i tasti **CHIAMA** e **MAPPA**.
5. **COMPILA LA RICHIESTA**, una volta sola, in fondo. Sotto, che la richiesta
   non è ancora l'iscrizione e non si salva a metà (se esci, ricominci), e il
   link all'**informativa privacy**.

Se l'informativa tornasse una bozza, il tasto non c'è: al suo posto la pagina
dice «Per iscriverti chiamaci o passa in palestra». Il modulo Google non c'è
più.

### Prezzi e pagamento

**PREZZI E PAGAMENTO** apre una pagina a parte, con un indirizzo suo
(<https://app.officinedellosport.it/iscrizioni/#prezzi>): l'indietro del
telefono riporta alla pagina, e il link si può mandare a chi chiede solo i
prezzi. In cima c'è **‹ TORNA ALLE ISCRIZIONI**, poi:

- **Quanto costa**: la quota associativa e le schede dei corsi del listino,
  con il foglio in PDF finché il listino non è stato cambiato. Passata la data
  del saldo (il 31 agosto) la colonna **SALDO 31/8** sparisce: quel prezzo non
  vale più. Il PDF riporta i costi di partenza della stagione: se la segreteria
  li cambia da LISTINO, l'app mostra quelli nuovi ma il PDF resta quello di
  partenza, finché non lo si rigenera. Poi le **offerte**.
- **Come si paga**: nella richiesta, con Satispay o col bonifico. L'IBAN si
  copia con un tocco (**COPIA IBAN**) e **PAGA CON SATISPAY** apre l'app sul
  negozio dell'associazione (il link è `PAGAMENTO.satispay` in
  `src/lib/iscrizione.ts`: questo pagamento la segreteria lo segna a mano).
  Col bonifico, la sua ricevuta si carica nella richiesta.
- **COMPILA LA RICHIESTA**: apre lo stesso modulo. Chiuso il modulo, si torna
  in cima alla pagina delle iscrizioni.

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
  quelli per cui il listino non dice gli anni. I corsi di un'altra età stanno
  chiusi dietro **+ ALTRI N CORSI, NON PER LA SUA ETÀ**: un tocco e compaiono
  sotto **ALTRI CORSI** (restano aperti se ne hai già scelto uno). Si possono
  scegliere lo stesso, e un avviso giallo dice
  quali sono e che la segreteria richiama. Un corso che il listino non ha
  ancora (senza prezzo) si sceglie lo stesso, e sotto il nome c'è scritto
  «prezzo da confermare».
  Sotto c'è **QUANTO COSTA**: la stima dal listino (la quota associativa, i
  corsi scelti, il totale), l'IBAN, la causale col nome e i tasti **COPIA
  IBAN**, **COPIA CAUSALE** e **PAGA CON SATISPAY**. Un corso senza prezzo è
  scritto in giallo («Lo dice la segreteria»): si paga il totale che si vede, il
  resto lo sistema la segreteria.
- **Il modulo**: le autorizzazioni si firmano **qui, col dito** (o col mouse
  dal computer). Si sceglie come sul foglio se si acconsente al
  **tesseramento** alla FIJLKAM e/o FIPE e se si autorizzano le **foto**: le
  due scelte partono vuote e vanno fatte per mandare il modulo, ma anche con
  «non autorizzo» l'iscrizione va avanti (per le foto il minore non compare).
  Se si prova a mandare senza sceglierne una, sotto quella scelta compare una
  nota rossa e la pagina va lì. **Firmo qui** è già scelto; con **Ho il foglio
  firmato** si carica invece la foto del foglio. Per un minore si scrive anche dove è nato il genitore, e firma il genitore.
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
  I fogli delle autorizzazioni da scaricare (maggiorenni e minori) hanno ora
  l'aspetto del sito, con la mascotte e il simbolo di sempre, e si compilano
  anche al computer: nome, date, anno (un campo corto che comincia per «2») e
  caselle sono campi da scrivere o da crociare; poi si stampa e si firma. Le parole non cambiano. Sul telefono molti
  lettori di PDF non compilano i campi: lì c'è il modulo dell'app. Il modulo
  firmato che parte dall'app non ha campi: è fermo e uguale in ogni lettore.
  Se si cambia la data di nascita e chi si iscrive diventa minore (o non lo è
  più), il foglio è un altro: firma, crocette e foto del foglio si azzerano, e
  un avviso giallo dice «Firma e autorizzazioni vanno rifatte».
- **I file**: la foto della **carta d'identità** di chi si iscrive, dai 6
  anni, anche per un minore aggiunto dal nucleo (serve per stage e trasferte
  senza genitori; quella del genitore non serve, e sotto i 6 anni non si
  chiede), il retro se serve, il **certificato
  medico** se ce l'ha già (lo vede solo la segreteria). Il certificato si
  chiede solo quando serve: dai 6 anni quello normale, dai 12 quello
  agonistico se tra i corsi scelti c'è judo, aikido o lotta (lo dice il nome
  del corso). Sopra c'è una frase sola: serve per partecipare alle lezioni,
  e si carica lì o si porta in segreteria (sotto il nome
  c'è **PUOI PORTARLO DOPO**); senza non si
  partecipa alle lezioni: se non è stato caricato, lo ricorda **RICHIESTA
  ARRIVATA**. Il documento la segreteria lo stampa, lo tiene su carta e lo
  cancella dall'app; il certificato resta nell'app e lo vede solo la
  segreteria.
- **Il pagamento**, dopo aver scelto un corso: **QUANTO PAGHI**, quota e
  corso dal listino, e **PAGHI CON**, da scegliere fra **Satispay** e
  **Bonifico** (nessuno è già scelto).
  - Con **Satispay** si paga **prima** di mandare, in fondo al modulo: dopo
    **ALTRO** c'è **PAGA** con l'importo, quello che calcola il database dal
    listino. Quando il resto del modulo è a posto (firma, caselle, documenti),
    il tasto giallo **PAGA … CON SATISPAY** apre Satispay con l'importo già
    scritto; finché manca qualcosa, sotto c'è scritto cosa. Si conferma nell'app e si torna alla pagina del
    modulo, che si aggiorna da sola: «✓ Pagati con Satispay alle …» e il
    tasto diventa **MANDA LA RICHIESTA**. La richiesta parte solo dopo, già
    pagata, e la pagina finale dice **RICHIESTA ARRIVATA · PAGATO**. Se il
    pagamento non è andato c'è **RIPROVA CON SATISPAY**, o si sceglie il
    bonifico. Chiudere Satispay senza confermare non fa pagare due volte: si
    riapre lo stesso pagamento, e chi ricarica la pagina dopo aver pagato
    ritrova il pagamento fatto, con gli stessi nome, email e corso. Satispay
    riporta a una pagina (`iscrizioni/?satispay=…`) che dice com'è andata e di
    tornare alla scheda del modulo.
  - Pagato e poi cambiato corso, annuale/trimestre, nome o email, quel
    pagamento non vale per la richiesta: si rimette quello di prima, o si
    chiama la segreteria (**CHIAMA LA SEGRETERIA**). Pagato con Satispay e poi
    scelto il bonifico, il modulo lo dice e non manda: si pagherebbe due volte.
  - Satispay c'è solo nei casi semplici: un corso della sua età, con una sola
    riga di prezzo nel listino della segreteria. Con più corsi (valgono le
    offerte), con un corso a giorni, senza prezzo o fuori età non c'è, e una
    frase dice perché: si paga col bonifico.
  - Col **Bonifico**: IBAN e causale da copiare e la **ricevuta del bonifico**,
    obbligatoria (una foto, lo screenshot o il PDF).

  Dal nucleo dell'area iscritti (**UNA PERSONA IN PIÙ**) resta **QUANTO
  COSTA** come prima, con la ricevuta fra i file.
- **Altro**: **COME CI HAI CONOSCIUTO?**, facoltativa, una tendina con otto
  scelte (Amici o parenti, Sito, Instagram, Facebook, Google, Volantino,
  Passando davanti, Altro; lasciata su «Scegli, se vuoi» non si manda
  niente, e non si scrive a parole); le note per la segreteria (facoltative, e **mai dati sulla
  salute**: quelli si portano in segreteria), la casella obbligatoria
  «Accetto il Regolamento Sociale» (col link al regolamento, quando c'è:
  `REGOLAMENTO` in `src/lib/iscrizione.ts`) e la casella «Ho letto
  l'informativa privacy».

Da dove si è arrivati lo sa il link: quelli del sito della palestra
finiscono con `?da=` e la pagina da cui partono (`?da=home`,
`?da=corso-judo`…), quello della segreteria con `?da=segreteria`. Non si
vede, non si salva sul telefono e non ferma mai la richiesta: un'etichetta
sbagliata si lascia fuori. La risposta e il link li vede solo la segreteria,
nella richiesta: non in **RICHIESTA ARRIVATA** né nel modulo firmato. Dall'area
degli iscritti (una persona in più nel nucleo) la domanda non c'è: la palestra
la conoscono già.

Nel modulo non resta niente sul telefono: chiuso, si riparte da capo. Per
questo **← INDIETRO**, se c'è già qualcosa di scritto, firmato o scelto, al
primo tocco chiede «LE RISPOSTE SI PERDONO · ESCI?» e esce solo al secondo;
senza il secondo tocco, dopo qualche secondo torna com'era.

Se **MANDA LA RICHIESTA** trova qualcosa che manca, in fondo al modulo
compare un avviso rosso con la prima cosa da sistemare. L'avviso si aggiorna
da solo: sistemata quella passa alla successiva, e sparisce quando non manca
più niente, senza premere di nuovo il tasto.

Premuto **MANDA LA RICHIESTA**, compare **RICHIESTA ARRIVATA**. Se un file non
è partito compare **MANCA QUALCHE FILE**, con il tasto per riprovare (per
un'ora); se non va, chiama la segreteria (da **UNA PERSONA IN PIÙ**: i fogli
si portano in segreteria).

La richiesta **non è ancora un'iscrizione**: arriva in segreteria, in
[RICHIESTE ONLINE](segreteria/richieste.md), dove qualcuno guarda i file e la
accoglie.

Il modulo ha l'aspetto del sito della palestra: sfondo chiaro, blu e giallo, anche se il telefono è in tema scuro. Il tasto del tema in alto, a modulo aperto, non c'è: il modulo resta chiaro in ogni caso; ricompare quando si chiude.

## Il modulo a passi (solo in prova)

È un modulo nuovo, che fa le stesse domande una schermata alla volta. Chi si iscrive fa sette passi (**DATI**, **CORSO**, **FIRMA**, **DOCUMENTI**, **FAMIGLIA**, **PAGAMENTO**, **INVIO**); per un figlio sono otto (**BAMBINO** al posto di DATI, e in più **CHI FIRMA**). In cima i passi sono raggruppati in tre tappe, **CHI**, **IL CORSO** e **PAGA E MANDA**, ognuna con un segmento per passo (verde quelli fatti, scuro quello di adesso) e il nome sotto, con ✓ quando è finita; sotto le tappe c'è il nome del passo. Per un altro adulto della famiglia il primo passo si chiama **DATI DI** e il suo nome. Nel passo del corso, sopra i tasti, c'è sempre il **TOTALE** da pagare, che cambia a ogni scelta: con più persone è quello di tutti, e lo dice (**TOTALE FAMIGLIA**). A PAGAMENTO il conto è nel passo. Prima
si sceglie **IO, SONO ADULTO** o **MIO FIGLIO O MIA FIGLIA**, poi si va avanti
con **AVANTI**. Se tocchi AVANTI e manca qualcosa, in fondo allo schermo una riga dice quante cose mancano e **VAI A** la prima: un tocco e il cursore è già nel campo. La freccia accanto apre l'elenco di tutto quel che manca, e ogni voce porta al suo campo. L'ultimo passo
è il riepilogo: da lì **MODIFICA** riporta al passo da cambiare, e **MANDA LA
RICHIESTA** la manda.

**FAMIGLIA** viene dopo i documenti, prima di PAGAMENTO: «Iscrivi anche
qualcuno della tua famiglia?» (o «qualcun altro della famiglia?» per chi
iscrive un bambino), il riquadro verde **−20% SCONTO FAMIGLIA** e due carte.
Chi si iscrive da adulto trova **UN FIGLIO O UNA FIGLIA** (i corsi per
bambini vicini al suo orario, se ci sono) e **UN ALTRO ADULTO** (lo stesso
corso, o uno per adulti alla stessa ora); chi iscrive un bambino trova **UN
FRATELLO O UNA SORELLA** e **TU O UN ALTRO ADULTO** (i corsi vicini
all'orario del bambino). La carta propone fino a tre corsi, dal più comodo,
ognuno con l'etichetta e l'orario. Sopra i corsi una riga dice «In **grassetto** i
giorni che vanno col tuo orario.»: nell'orario di ogni corso i giorni che
vanno sono in grassetto, gli altri grigi; l'ora di una fascia
(«lunedì e giovedì 18.00-19.00») è in grassetto se almeno uno dei suoi giorni va.
Quali giorni vanno lo dice l'etichetta:

- **STESSA ORA**: le lezioni si sovrappongono almeno un giorno; vanno i
  giorni in cui si sovrappongono.
- **SUBITO PRIMA** o **SUBITO DOPO**: lo stesso giorno, finisce o comincia
  entro mezz'ora dall'altro (l'attesa fra la fine di una lezione e l'inizio
  dell'altra); vanno i giorni in cui si aspetta mezz'ora o meno.
- **STESSI GIORNI**: un'altra ora, ma negli stessi giorni, così si viene in
  palestra una volta sola; vanno i giorni in comune.
- **STESSO CORSO**: per un altro adulto, il corso di chi si è iscritto; tutto
  l'orario è in grassetto.

In verde quanto si risparmia con l'annuale, col primo corso della carta.
Il tasto tratteggiato aggiunge la persona: per un adulto, chi iscrive un
bambino sceglie fra **IO** col suo nome (**IO, PAOLO**: si iscrive anche lui, e nome, codice
fiscale, residenza, contatti e firma sono quelli già scritti
per il bambino, e restano da dare la sua carta d'identità, il corso, come paga, il tesseramento,
le foto e il certificato) e **UN ALTRO ADULTO**; per un bambino, se può
firmare più di un adulto, si sceglie chi firma per lui. Un fratello che firmi tu ha già
il tuo ok e dove sei nato: si firma il suo modulo e si carica la sua carta d'identità (dai 6 anni). Nessuno da
aggiungere? **AVANTI, SOLO IO** (o **AVANTI**) e si va a PAGAMENTO.

Chi si aggiunge parte dal suo primo passo. Al suo passo del corso, in cima,
sotto **ALLA STESSA ORA DI** e il nome di chi si è iscritto per primo, ci sono
i corsi per la sua età che si fanno mentre lui è in palestra (basta che le
lezioni si sovrappongano, anche solo in parte, almeno un giorno; lo dice il
calendario dei corsi): se è uno solo è già spuntato, e un altro adulto trova
già spuntati i corsi di chi si è iscritto per primo. Si può togliere e
sceglierne un altro. Poi **SUBITO PRIMA O DOPO** e **NEGLI STESSI GIORNI**,
con le stesse regole della carta, e infine **GLI ALTRI CORSI PER LA SUA
ETÀ**. Sotto il nome di ogni corso proposto ci sono l'età del listino e
l'orario, coi giorni che vanno con chi si è iscritto per primo in grassetto, come
nella carta. Finiti i suoi documenti, AVANTI porta di nuovo a
FAMIGLIA (per aggiungere qualcun altro) e poi a PAGAMENTO, col conto di
tutti.

**PAGAMENTO** viene dopo FAMIGLIA, prima del riepilogo, ed è uno
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
suoi corsi. Nei passi di ognuno (CHI e IL CORSO), sotto il nome del passo c'è **PER** coi nomi di
tutti, per passare dall'uno all'altro. FAMIGLIA, PAGAMENTO e INVIO invece sono
uno solo per tutti, senza PER: per tornare ai dati di qualcuno si tocca
**MODIFICA** accanto al suo nome in **NEL MODULO** (o nell'elenco di INVIO). Le
note per la segreteria sono una per tutto il modulo e arrivano in ogni
richiesta; lo stesso **COME CI AVETE CONOSCIUTO?**, facoltativa, a INVIO sopra
le note (con una persona sola dice «hai»): una risposta per tutta la famiglia,
in ogni richiesta, come l'etichetta del link. Per aggiungerne un altro si torna a FAMIGLIA, non all'ultimo passo. Quando chi firma non è chi compila (un altro adulto, o il bambino
firmato da un altro adulto), il modulo lo chiama per nome: «Firma Paola, che è
maggiorenne», **L'OK DI PAOLA**, **LA CARTA D'IDENTITÀ DI PAOLA**. Per chi si è aggiunto con **IO**, la
casella delle foto porta il suo nome (**LE FOTO E I VIDEO DI NICOLA**).

Quando c'è da scegliere fra due cose (**IO, SONO ADULTO** o **MIO FIGLIO**, **TRIMESTRE** o **ANNUALE**, **AUTORIZZO** o **NON AUTORIZZO**) la scelta fatta si riempie: è il tasto pieno. I corsi, dove se ne possono scegliere più d'uno, hanno invece la casella con la spunta. I bordi dei campi sono più chiari, anche nel tema scuro.

I corsi per grandi (quelli che la segreteria segna con un'età minima in **LISTINO**, per esempio la Pesistica dai 16 anni) non compaiono per un bambino troppo piccolo: sotto l'elenco una frase dice quali e di chiamare la segreteria. Per chi ha l'età compare fra i corsi per lui, con scritto «dai 16 anni».

Chi iscrive un figlio trova scritto di chi è ogni cosa: **LA CARTA D'IDENTITÀ DI** e **IL RETRO DELLA CARTA DI** col nome del bambino (finché il nome non c'è, **DEL BAMBINO**; sotto i 6 anni la carta non si chiede), **IL CERTIFICATO DI** e il nome del bambino (con cosa succede se manca), e l'errore sul codice fiscale dice «Metti il tuo codice fiscale, non quello di» e il nome. Il luogo di nascita del genitore (**DOVE SEI NATO**, **PROVINCIA**) si chiede solo nei suoi dati e solo se il suo codice fiscale non lo dice da sé.

In fondo a ogni passo, sopra INDIETRO e AVANTI, «Hai bisogno di aiuto? Chiama o scrivi.»: **CHIAMA** telefona alla segreteria, **SCRIVI** apre WhatsApp allo stesso numero col messaggio già scritto, che dice a che passo si è («Ciao, sto compilando l'iscrizione e ho un dubbio sul passo DOCUMENTI»). A ogni passo nuovo il cursore va al titolo, così chi usa uno screen reader sente dove si trova. Se si esce o si ricarica la pagina dopo aver scritto qualcosa, il browser chiede conferma. Alla fine, **RICHIESTA ARRIVATA** dice dove la segreteria ti scrive o ti chiama, e se non hai caricato la ricevuta quanto devi pagare e come (l'IBAN, e per una persona sola anche la causale), con **CHIAMA LA SEGRETERIA** a portata di mano.

Per ora si apre solo in prova, con l'indirizzo `iscrizioni/?prova#nuova`. In prova, accanto al bollino PROVA, c'è **RIEMPI**: un tocco scrive dati finti ma validi nel passo in cui sei (nomi diversi per ogni persona della famiglia, codice fiscale vero, CAP di Collegno, corso adatto all'età, firma disegnata, una carta d'identità di esempio), così si arriva all'invio solo con RIEMPI e AVANTI. Quello che è già giusto resta; retro, certificato e ricevuta restano vuoti. Non c'è nei passi FAMIGLIA, PAGAMENTO e INVIO, e col database vero non c'è mai.
Non salva niente: se si esce prima di mandare, le risposte si perdono, e con
la prova nulla va a un server. Il modulo di sopra resta quello di oggi.

Aperto una volta un indirizzo con `?prova`, la prova resta accesa su quel
telefono. Finché è accesa, sotto la testata della pagina Iscrizioni c'è il
nastro giallo **PROVA · LE RICHIESTE NON ARRIVANO IN SEGRETERIA**, con
**ESCI DALLA PROVA**: un tocco la spegne e riapre la pagina vera, come in sala.

Cosa arriva in **RICHIESTE ONLINE**: una richiesta per persona (anche per chi
iscrive il bambino e si è aggiunto con **IO**: la sua ha i suoi dati, la sua
carta d'identità e il suo modulo, con la firma data per il bambino; ogni persona ha la sua carta). Sono
separate, e nelle note di ognuna c'è una riga che dice «mandata insieme alla
richiesta di…, sconto famiglia da applicare», così la segreteria le lega. La ricevuta del
bonifico, se c'è, arriva in ognuna: è un pagamento solo per tutte. Le note che scrive chi
compila sono al massimo 900 caratteri, per fare posto a quella riga.

## Ordinare il vestiario

Judogi, costumini da lotta e vestiario della palestra si ordinano da una pagina
pubblica, al posto del modulo Google. L'indirizzo è
<https://app.officinedellosport.it/iscrizioni/#vestiario>: in segreteria
si copia con **COPIA LINK ORDINI**, in fondo al menu. La pagina delle iscrizioni non lo nomina: gli ordini si aprono solo dal
loro link.

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

- «Ti mando il link: c'è cosa preparare e il tasto per la richiesta. I prezzi
  sono in PREZZI E PAGAMENTO.» Per chi chiede solo i prezzi c'è il link
  `iscrizioni/#prezzi`.
- «Quando hai mandato la richiesta la guardiamo noi e ti iscriviamo ai corsi
  che hai scelto.»
- Per i dubbi: telefono o passare in palestra, come dice il riquadro della
  prova.
