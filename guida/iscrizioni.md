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

È un modulo nuovo, che fa le stesse domande una schermata alla volta. Chi si iscrive fa sei passi (**I TUOI DATI**, **SCEGLI IL CORSO**, **IL MODULO E LA FIRMA**, **I DOCUMENTI**, **QUANTO PAGHI**, **CONTROLLA E INVIA**); per un figlio sono sette, perché c'è anche **IL GENITORE CHE FIRMA**. Nei passi del corso e di QUANTO PAGHI, sopra i tasti, c'è sempre il **totale** da pagare: con più persone è quello di tutti, e lo dice («Totale famiglia»). Prima
si sceglie **IO, SONO ADULTO** o **MIO FIGLIO O MIA FIGLIA**, poi si va avanti
con **AVANTI**. Se tocchi AVANTI e manca qualcosa, in fondo allo schermo una riga dice quante cose mancano e **VAI A** la prima: un tocco e il cursore è già nel campo. La freccia accanto apre l'elenco di tutto quel che manca, e ogni voce porta al suo campo. L'ultimo passo
è il riepilogo: da lì **MODIFICA** riporta al passo da cambiare, e **MANDA LA
RICHIESTA** la manda. Chi iscrive il figlio può iscriversi anche lui, con
**ISCRIVO ANCHE ME**: sono poche domande in più, e la segreteria vede il
conto della famiglia con lo sconto.

**QUANTO PAGHI** viene dopo l'ultima persona, prima del riepilogo, ed è uno
solo per tutto il modulo: il conto di tutti con lo sconto famiglia, la cifra da
pagare, l'IBAN con **COPIA IBAN**, la causale con **COPIA CAUSALE** e **PAGA CON
SATISPAY**. La causale ha i nomi di tutti, il cognome uguale una volta sola
(«Iscrizione Manuela e Nicola Albertini»); da soli resta col corso. La
**ricevuta** del bonifico è facoltativa e una sola per tutti: chi la carica
prima di aggiungere un familiare, o prima di cambiare corso, legge sotto di
quanto è cambiato il totale e che la differenza si paga in segreteria o con un
altro bonifico. Nel riepilogo, la riga **Ricevuta del pagamento** porta qui.

Nel passo del corso del figlio, il riquadro **TI ISCRIVI ANCHE TU?** propone
al genitore i corsi per la sua età che si fanno mentre il figlio è in palestra:
basta che le lezioni si sovrappongano, anche solo in parte, almeno un giorno
(un corso che comincia quando quello del figlio finisce non conta). Lo dice il
calendario dei corsi, non gli orari scritti nel listino. Con **ISCRIVO ANCHE
ME** l'elenco dei corsi del genitore si apre lì: in cima, sotto **ALLA STESSA
ORA DI** e il nome del figlio, quelli alla stessa ora (se è uno solo è già
spuntato; se i giorni in comune non sono tutti, la riga dice quali), poi gli
altri corsi per la sua età. Se nessun corso è alla stessa ora, c'è l'elenco
intero. Se dopo il figlio cambia corso, sotto compare quale corso del genitore
non è più alla stessa ora. Nel passo **ANCHE TU: POCHE COSE** il corso è già
scritto, con **MODIFICA**: lì restano come paga il genitore e i suoi consensi.

Nel passo dei dati, scritto il **CAP**, il comune lo propone l'app, per i CAP
della provincia di Torino: se il CAP è di un comune solo e **COMUNE** è vuoto si
scrive da sé, con sotto «Dal CAP …»; se è di più comuni compaiono i comuni da
toccare (fino a sei) o una tendina. Il comune si può sempre correggere a mano, e
uno già scritto non si tocca. Fuori provincia si scrive come prima. L'elenco dei
CAP non è di Poste (che non lo pubblica): se un comune manca o è sbagliato, va
corretto in `scripts/cap-torino.mjs`.

Chi si iscrive da solo pensa a una persona alla volta: nei passi la famiglia
non c'è. All'ultimo passo, **CONTROLLA E INVIA**, dopo il riepilogo, sotto **LA
FAMIGLIA** c'è «Iscrivi anche qualcun altro della famiglia?» con **+ AGGIUNGI UN
FAMILIARE**: indirizzo e contatti restano quelli già scritti, e ognuno sceglie i
suoi corsi. Da lì in poi, in ogni passo, sotto il numero ci sono i nomi di tutti,
per passare dall'uno all'altro; il tasto per aggiungerne un altro resta
all'ultimo passo. Quando chi firma non è chi compila (un altro adulto, o il bambino
firmato da un altro adulto), il modulo lo chiama per nome: «Firma Paola, che è
maggiorenne», **L'OK DI PAOLA**, **LA CARTA D'IDENTITÀ DI PAOLA**. Con «Anche tu»,
nella barra di quel che manca, il corso, il tesseramento e le foto del genitore
portano il suo nome (**CORSO DI NICOLA**), e così la casella **LE FOTO E I VIDEO
DI NICOLA**.

Quando c'è da scegliere fra due cose (**IO, SONO ADULTO** o **MIO FIGLIO**, **TRIMESTRE** o **ANNUALE**, **AUTORIZZO** o **NON AUTORIZZO**) la scelta fatta si riempie: è il tasto pieno. I corsi, dove se ne possono scegliere più d'uno, hanno invece la casella con la spunta. I bordi dei campi sono più chiari, anche nel tema scuro.

I corsi per grandi (quelli che la segreteria segna con un'età minima in **LISTINO**, per esempio la Pesistica dai 16 anni) non compaiono per un bambino troppo piccolo: sotto l'elenco una frase dice quali e di chiamare la segreteria. Per chi ha l'età compare fra i corsi per lui, con scritto «dai 16 anni».

Chi iscrive un figlio trova scritto di chi è ogni cosa: **LA CARTA D'IDENTITÀ DI** e **IL RETRO DELLA CARTA DI** col nome di chi firma (la sua, non quella del bambino; finché il nome non c'è, **DEL GENITORE**), **IL CERTIFICATO DI** e il nome del bambino (con cosa succede se manca), e l'errore sul codice fiscale dice «Metti il tuo codice fiscale, non quello di» e il nome. Il luogo di nascita del genitore (**DOVE SEI NATO**, **PROVINCIA**) si chiede solo nei suoi dati e solo se il suo codice fiscale non lo dice da sé.

In ogni passo, sotto il numero, c'è **CHIAMA**: un tocco e si telefona alla segreteria. A ogni passo nuovo il cursore va al titolo, così chi usa uno screen reader sente dove si trova. Se si esce o si ricarica la pagina dopo aver scritto qualcosa, il browser chiede conferma. Alla fine, **RICHIESTA ARRIVATA** dice dove la segreteria ti scrive o ti chiama, e se non hai caricato la ricevuta quanto devi pagare e come (l'IBAN, e per una persona sola anche la causale), con **CHIAMA LA SEGRETERIA** a portata di mano.

Per ora si apre solo in prova, con l'indirizzo `iscrizioni/?prova#nuova`.
Non salva niente: se si esce prima di mandare, le risposte si perdono, e con
la prova nulla va a un server. Il modulo di sopra resta quello di oggi.

Cosa arriva in **RICHIESTE ONLINE**: una richiesta, o due se c'è «Anche tu»
(una del bambino, una del genitore). Le due sono separate, e nelle note di
ognuna c'è una riga che dice «mandata insieme alla richiesta di…, sconto
famiglia da applicare», così la segreteria le lega. La ricevuta del
bonifico, se c'è, arriva in ognuna: è un pagamento solo per tutte. Le note che scrive chi
compila sono al massimo 900 caratteri, per fare posto a quella riga.

## Ordinare il vestiario

Judogi, costumini da lotta e vestiario della palestra si ordinano da una pagina
pubblica, al posto del modulo Google. L'indirizzo è
<https://nalbertini.github.io/ods-corsi/iscrizioni/#vestiario>: in segreteria
si copia con **COPIA LINK ORDINI**, in fondo al menu. Finché gli ordini sono
aperti, anche la pagina delle iscrizioni ha in fondo il riquadro **IL
VESTIARIO** con **ORDINA IL VESTIARIO**.

1. **IL CATALOGO** — i capi col prezzo, le taglie e la nota per scegliere la
   taglia.
2. **IL TUO ORDINE** — una riga per capo: per chi è (nome e cognome del
   bambino), il capo, la taglia, quanti. **+ UN ALTRO CAPO** aggiunge una riga
   per lo stesso bambino, **+ PER UN ALTRO FIGLIO** una per un altro: i fratelli
   stanno in un ordine solo, con un totale solo.
3. **CHI ORDINA** — nome, cognome e telefono di chi ordina (la segreteria
   chiama chi non ha pagato); l'email è facoltativa.
4. **MANDA L'ORDINE**. Il totale lo calcola l'app coi prezzi del catalogo.

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
