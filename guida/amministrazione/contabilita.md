# Amministrazione · Contabilità

← [Torna all'amministrazione](README.md)

Le entrate e le uscite della palestra, in due casse: **Cassa Contanti** e
**Conto Corrente**. La vede solo chi ha il ruolo di amministrazione: la segreteria
semplice, gli istruttori e il tablet no. Ha quattro schede: **MOVIMENTI**, **BILANCIO**, **VOCI**, **CASSE**.

## Movimenti

In cima, il **residuo** di ogni cassa e il **totale**: saldo iniziale, più le entrate,
meno le uscite.

L'elenco unisce due cose:

- gli **incassi degli iscritti**: le ricevute, i pagamenti a mano e i
  pagamenti Satispay dal modulo di iscrizione (finché non sono in una
  ricevuta, poi conta la ricevuta) di [PAGAMENTI](pagamenti.md) entrano da soli, uno per pagamento, col segno
  **Incasso iscritto**. Non si ricopiano e non si cambiano da qui: se una ricevuta
  o un pagamento si annulla, cambia da sé anche qui. Contanti vanno in Cassa
  Contanti, tutto il resto (bonifico, POS, Satispay, assegno) in Conto Corrente.
  Il «pagato fino al» non è un incasso e qui non compare. Satispay entra per
  l'importo pagato dalla famiglia: le commissioni e i rimborsi fatti dall'app
  Satispay Business si registrano a mano;
- i **movimenti che scrivi tu**: altre entrate (contributi, gare, attività
  fatturate) e le uscite.

Si parte da **Tutto l'anno**: l'elenco, ENTRATE, USCITE e DIFFERENZA in fondo contano l'anno in
corso, non più il mese. I filtri sono in due righe: sopra la **ricerca** nella descrizione, il
**periodo** (il mese, il mese scorso, tutto l'anno, tutto) e il **tipo** (**Entrate**, **Uscite**,
**Giroconti**); sotto la **cassa**, la **voce**, la **persona** (un menu) e **Mostra annullati**.
Sotto i filtri la riga «N trovati · N filtri attivi» dice quanti ne hai acceso, e **Togli i
filtri** (compare solo se ne hai acceso almeno uno) ti riporta a Tutto l'anno senza altro.
**Vista**: **Elenco** o **Per voce**, che dà i totali per voce. **Esporta CSV** è un foglio per
Excel e per il commercialista, senza gli annullati.

### Nuovo movimento

**Nuovo movimento** si apre in una **pagina intera**, al posto dell'elenco (il **Giroconto** lo
stesso); **← I movimenti** torna all'elenco com'era, coi filtri che avevi, e se hai già scritto
qualcosa chiede prima se lasciare. Si sceglie entrata o uscita, data, importo, cassa, **voce** (solo quelle
del tipo giusto, non quelle disattivate), descrizione e una nota se serve. Un solo
importo, senza IVA. La data non è nel futuro e non è prima del giorno da cui parte
la cassa. Niente dati personali che non servono, nella descrizione e nella nota.
Prima di scrivere, l'app mostra un **riepilogo** (importo, voce, cassa, data): **Sì,
registra il movimento** lo scrive, **No, torna al modulo** lascia tutto com'era. Se il movimento scritto è fuori dai filtri che hai
acceso, l'elenco lo dice («Non lo vedi nell'elenco: è fuori dai filtri») e **Togli i filtri** lo
fa comparire.

Un movimento registrato **non si cambia** negli importi: toccandolo si apre in una **finestra** sopra l'elenco
(vedi [La finestra dei dettagli](../segreteria/README.md#la-finestra-dei-dettagli)), e si può
**annullare** (resta in elenco, annullato, e non si conta più), correggere la descrizione e
la nota (di un giroconto, solo la nota) o **cambiare la voce** (vedi sotto). Per correggere
importo, data o cassa si annulla e si rifà.

### Cambiare la voce

La voce di un movimento si cambia **senza annullare e rifare**: importo, data, cassa e testo
restano come sono, e anche i giorni già chiusi (la chiusura non cambia: i soldi sono gli stessi).

- **Uno solo**: apri il movimento, scegli la **voce** nuova e tocca **Cambia la voce**. In fondo, **Cosa è
  cambiato** dice chi l'ha cambiata, quando e da quale voce veniva.
- **Tanti insieme**: nell'elenco scrivi nella ricerca una parte della causale (per esempio «enel»),
  scegli la **voce** da cui partire (per esempio «Da classificare») e, se serve, il periodo
  **Tutto**. L'elenco dice quanti ne ha trovati. Spunta le righe, oppure tocca **Scegli tutte le N
  trovate**. In fondo compare la barra **N scelti**: **Cambia voce** apre il riepilogo (quanti sono,
  di che tipo, quanto fanno, da quali voci vengono). Scegli la **nuova voce** e tocca **Sì, cambia la
  voce**: finché non lo dici, non cambia niente. Se cambi la ricerca o i filtri, la scelta si svuota.
  Si fa anche dal telefono.
- Le righe vanno a **pacchetti da 500**, ognuno **tutto o niente**: se uno si ferma, l'app dice
  quanti ne ha cambiati e perché, e quelli dopo non cambiano. Quelli che avevano già la voce non
  vengono toccati e il riepilogo li conta a parte.
- Non hanno la casella e non si cambiano da qui: gli **incassi degli iscritti** (si correggono in
  PAGAMENTI), i **movimenti annullati**, i **giroconti** (non hanno voce) e la **Differenza di cassa**
  scritta da una chiusura. La voce nuova deve essere in uso e dello stesso tipo: una voce di entrata
  per le entrate, di uscita per le uscite. Con entrate e uscite scelte insieme, **Cambia voce** resta
  spento: tocca **Solo le entrate** o **Solo le uscite**.
- Un cambio sbagliato si rimedia scegliendo di nuovo le righe e assegnando la voce giusta: la traccia
  non si cancella.

### Collegare lo storico alla persona

Nei movimenti dello storico il nome di chi ha pagato sta solo nella causale («Cliente NOME per …»).
Si può **collegare il movimento alla persona**: è solo un'etichetta, «di chi è questo pagamento».
Importo, data, cassa e voce non cambiano, e i saldi, il bilancio e le chiusure restano uguali, anche
nei giorni già chiusi. Non è un incasso in più: lo storico collegato compare nella scheda della persona
in un blocco a parte, **Dal vecchio programma**, e non si somma ai suoi pagamenti.

Si collegano solo le **entrate dello storico** su «Quota associativa» e «Corsi e altri pagamenti».
Non si collegano i movimenti scritti qui, i giroconti, la «Differenza di cassa» e gli annullati.

- **I casi sicuri, in blocco**: **Collega i casi sicuri** apre il riepilogo (quanti movimenti, a quante
  persone, quanto fanno, un campione di nomi). Sono sicuri i movimenti con nome e cognome della causale
  uguali a quelli di **una sola scheda**, in qualunque ordine e senza badare a maiuscole e accenti.
  Niente si scrive finché non dici **Sì, collega**. Vanno a pacchetti da 500, ognuno tutto o niente; se uno
  si ferma, l'app dice quanti ne ha collegati e **Rifai il collegamento** riparte dagli altri. A fine
  lavoro **Togli questo lotto** scollega solo quelli appena collegati: quelli cambiati a mano dopo non si toccano.
- **Chi ha più schede dello stesso nome** (omonimi) non si collega mai da sé: il tag **Omonimi** e il
  filtro **Da decidere** li mostrano. Scegli i movimenti e tocca **Collega a una persona**: l'app offre
  le persone con quel nome e quel che le distingue (anno di nascita, corsi, iscrizione). Se non basta,
  si cerca per nome.
- **Chi non ha più la scheda** (un ex iscritto): il movimento resta com'è, con il tag **Senza scheda** e il
  nome nella causale. Non si creano schede per lo storico.
- **Per correggere**: scegli i movimenti e tocca **Scollega**, o **Collega a una persona** per spostarli
  su un'altra. Ogni collegamento resta scritto: chi, quando, a quale persona.
- Se una scheda viene eliminata, i suoi movimenti restano, senza persona; se due schede si uniscono,
  il collegamento passa a chi resta.

Il filtro **Persona** sopra l'elenco ha **Collegati**, **Da decidere** e **Senza scheda**, con il numero
di ognuno sull'intero storico.

### Giroconto

**Giroconto** sposta soldi da una cassa all'altra, per esempio il versamento dei
contanti in banca: da Cassa Contanti a Conto Corrente. Non è un'entrata né
un'uscita: non entra nei totali, né nei totali per voce. Si annulla come un movimento.
Anche qui, prima di scrivere c'è il riepilogo da confermare.

### Dalla chat, con Claude

Le fatture, le ricevute e gli scontrini dei **fornitori** si possono registrare fotografandoli
a Claude, invece di ricopiarli in **Nuovo movimento**. Claude legge data, importo e fornitore,
propone la voce (quella usata l'ultima volta per lo stesso fornitore) e la cassa, e mostra il
riepilogo: registra solo dopo il tuo «ok», e poi dice cosa ha scritto.

- **Collegarlo, una volta**: in Claude, Impostazioni → Connettori, si aggiunge ODS Corsi.
  Si apre una pagina dell'app: entri col tuo account, leggi cosa potrà fare e tocchi
  **Consenti**. Lo può fare solo chi ha l'amministrazione. Il collegamento si toglie da lì,
  dai Connettori di Claude.
- **Cosa può fare**: leggere voci, casse e i movimenti simili, e registrare un'entrata o
  un'uscita. Non vede iscritti né pagamenti, non annulla, non fa giroconti, non chiude la cassa.
- **Solo fornitori**: le foto le vede Claude, non l'app. Compensi degli istruttori e ricevute
  degli iscritti si registrano qui, come sempre: gli incassi degli iscritti in PAGAMENTI.
- **La data** è il giorno in cui i soldi sono usciti o entrati, non quella della fattura: per
  una bolletta con l'addebito Claude chiede quando è stata addebitata. Una fattura non ancora
  pagata si registra quando si paga.
- **L'importo** è quello pagato: con la ritenuta d'acconto è il netto, e la ritenuta si
  registra a parte quando si paga l'F24.
- **La cassa**: contanti nella Cassa Contanti, il resto (POS, bonifico, addebito) nel Conto
  Corrente; se il documento non lo dice, Claude chiede. Un versamento in banca è un
  **Giroconto**, e si fa qui.
- **Lo stesso movimento due volte**: se c'è già un movimento con lo stesso importo lo stesso
  giorno, o dello stesso fornitore nei 60 giorni prima, Claude si ferma e chiede se è un altro.
- **La descrizione** è «Fornitore · documento n. · mese», per esempio «Enel · bolletta n. 123 ·
  set 2026», senza codice fiscale né IBAN.

Un movimento registrato così ha il segno **Dalla chat** quando lo apri. Per il resto è uguale
agli altri: la voce e il testo si correggono qui, il resto annullando e rifacendo.

### Rimborsi e errori in periodi passati

Un rimborso a un iscritto è un'uscita, con una voce tua. Un errore trovato dopo si
corregge annullando e rifacendo, oppure, se il giorno è già chiuso (vedi sotto), con un movimento
con una data dopo la chiusura e una voce «Rettifica» (in VOCI si crea con un tocco).

## Bilancio

Il bilancio di un anno solare, da gennaio a dicembre: ogni anno ha il suo e niente
si mescola da un anno all'altro. Si sceglie l'anno con le frecce **‹ ›**, con i
chip degli ultimi cinque anni o con **Altri anni** (si va indietro fino al primo anno
con movimenti).

È **per cassa**: conta il giorno in cui il denaro è entrato o uscito (per gli incassi
degli iscritti, il giorno del singolo pagamento), non l'anno a cui la quota si
riferisce. Una quota pagata a dicembre per l'anno dopo sta nell'anno in cui l'hai incassata.
Non è un bilancio fiscale: è il riepilogo di cassa da dare al commercialista.

Si vede:

- **Entrate**, **uscite** e **risultato** dell'anno, ognuno col confronto con
  l'anno prima («nessun dato» se l'anno prima è vuoto). L'anno in corso è **parziale**:
  va dal 1 gennaio a oggi e si confronta con lo stesso periodo dell'anno prima.
- Il dettaglio **per voce**, con l'anno prima e la differenza. La
  **Differenza di cassa** della chiusura sta a parte, nelle uscite o nelle entrate
  secondo il segno.
- Il riquadro giallo **Da classificare**: i movimenti senza una voce (quasi tutte le
  uscite dello storico dal vecchio programma). Se sono più di metà delle uscite, il
  risultato è segnato **provvisorio**: non è affidabile finché non si classificano.
- L'avviso **Possibile doppio conteggio**, se nell'anno ci sono incassi dello storico importato
  oltre il primo incasso registrato nell'app: in quei giorni lo stesso incasso può
  comparire due volte. Si controlla in MOVIMENTI.
- I **saldi delle casse** al 1 gennaio e a fine anno. Per gli anni prima che la cassa
  partisse c'è scritto «saldo non disponibile», mai uno zero.

**Esporta CSV** e **Esporta PDF** danno il foglio per il commercialista: le voci con
l'anno prima, i totali e i saldi, con «per cassa» e la data di calcolo. Non
portano nomi di iscritti né movimenti singoli.

Un movimento con la data di domani non c'è ancora in nessun anno (non si può scrivere).
Si legge e basta: non scrive niente e non blocca niente. Se si annulla un incasso dopo,
il bilancio dell'anno in cui era cambia (l'incasso non c'è mai stato): per questo il foglio
porta la data di calcolo. Una rettifica in un periodo chiuso va nell'anno in cui la
scrivi, non nell'anno vecchio.

## Voci

Le voci sono quelle che crei: ogni voce è **solo di entrata o solo di uscita**, con un
nome diverso dalle altre dello stesso tipo. Una voce usata non si cancella: si
**disattiva**, resta sui movimenti vecchi e non si offre per i nuovi; si **riattiva**
quando serve. Le due voci **Sistema** («Quota associativa» e «Corsi e altri
pagamenti») servono agli incassi degli iscritti e non si cambiano. Non c'è una voce
«Varie»: se la crei, non farci finire spese diverse, o non si capisce più dove vanno i soldi.

## Casse

Per ogni cassa, il **saldo iniziale** e il giorno da cui si contano i movimenti
(**DAL**). Il residuo è il saldo iniziale più le entrate, meno le uscite, più o meno i
giroconti, da quel giorno. Un movimento più vecchio non si registra. Il giorno
non può essere nel futuro, e non può essere dopo un movimento che hai già
registrato: prima si annulla quel movimento, o si sceglie un giorno più vecchio.
Il saldo iniziale lo cambia solo l'amministrazione, da qui.

## Chiusura della cassa

Ogni tanto (a fine settimana, per esempio) si conta il denaro nella **Cassa Contanti** e si
controlla che torni. In **CASSE**, **Chiudi la cassa**:

1. Scegli **FINO AL** (di solito oggi). Il periodo parte dal giorno dopo l'ultima chiusura.
2. Conta il denaro e scrivi i **CONTANTI CONTATI**, un solo totale. La cassa si conta **alla
   cieca**: finché non scrivi quanto hai contato, l'app non mostra quanto dovrebbe esserci.
3. Solo allora compaiono **IN CASSA SECONDO I CONTI** (il saldo iniziale, i contanti incassati
   dagli iscritti, le entrate e le uscite scritte a mano, i versamenti in banca), la
   **DIFFERENZA** («Tornano», «in più» o «in meno») e **COSA C'È DENTRO**: l'elenco dei
   movimenti in contanti del periodo, per vedere da dove viene il numero. Una nota facoltativa
   dice perché. Se la differenza è sopra 20,00 €, chiede una conferma in più.
4. **Chiudi la cassa**. Se i conti non tornano, la differenza si scrive da sola nei conti, come
   movimento «Differenza di cassa» di quel giorno (un'entrata se c'erano più soldi, un'uscita se meno),
   così a fine giorno «in cassa» è quanto hai contato. Non si sceglie a mano in NUOVO MOVIMENTO.

Il Conto Corrente non si conta: si confronta con l'estratto della banca.

**Dopo la chiusura quei giorni sono chiusi**: non si registrano né si annullano più movimenti con
quella data, e il saldo iniziale della cassa non cambia. La descrizione e la nota si possono ancora
correggere. Per correggere uno sbaglio di un giorno chiuso si scrive un movimento con una data
**dopo la chiusura** e una voce di rettifica (dopo la prima chiusura, in VOCI compare **CREA LA VOCE «RETTIFICA»**: un
tocco, e c'è sia di entrata sia di uscita). Se hai chiuso oggi, la prima data possibile è domani: se serve prima, si annulla la
chiusura (solo l'ultima). Anche un versamento in banca fatto dopo la chiusura va datato dopo la
chiusura.

Sotto le casse c'è l'elenco delle **chiusure**: chi ha chiuso e quando, quanto si è contato, la
differenza. **PDF** scarica il foglio da stampare e firmare (A4: l'associazione, il periodo, le cifre, i
movimenti in contanti senza i nomi degli iscritti, due righe per le firme). **Annulla** c'è solo
sull'ultima chiusura: toglie anche la sua «Differenza di cassa» e riapre i giorni; il foglio già
stampato non vale più. Una chiusura non si cambia: si annulla e si rifà.

Se stai per annullare una ricevuta o un pagamento in contanti di un giorno già chiuso, la domanda di
conferma te lo dice prima. Se dopo una chiusura qualcuno annulla una ricevuta o un pagamento in contanti di quei giorni,
compare un avviso rosso «La chiusura del … non è più in regola»: il foglio già stampato non torna
più coi conti, e la correzione è una rettifica con una data dopo la chiusura.

## Lo storico dal vecchio programma

I movimenti del vecchio programma (la «Prima Nota» dal 2011) sono stati caricati una volta sola
come **movimenti** normali, con la voce scelta dalla causale: i pagamenti dei clienti sulle voci
«Quota associativa» e «Corsi e altri pagamenti», tutto il resto su **«Da classificare»**. Si
riconoscono perché nessuno risulta averli scritti qui. Per sistemarli si cambia la voce (vedi
**Cambiare la voce**): cerca per causale, scegli le righe e assegna la voce giusta, senza annullare.
Si annullano come ogni movimento. Un movimento dello storico che annulli non torna da solo se lo storico
venisse ricaricato; e una voce già sistemata non torna a «Da classificare» se lo storico venisse ricaricato.

I saldi iniziali delle casse non cambiano per questo: lo storico entra nei conti dal giorno di
ogni movimento. Se la cassa parte da una certa data (**DAL**), i movimenti più vecchi restano
nell'elenco ma non contano nel «in cassa».

## Cosa non c'è

- L'IVA e la fattura elettronica: restano nel software a parte.
- Allegati di fatture e scontrini: la carta resta carta, anche quando la si fotografa a Claude.
- Un bilancio per competenza, la chiusura di un anno (si può leggere, non bloccare) e il collegamento al RASD.
- Il backup scaricato dalla segreteria contiene anche i conti, ma è cifrato: la
  password non è della segreteria.

Se compare «Il database non è ancora aggiornato per la contabilità», «…per la chiusura
della cassa» o «…per cambiare la voce dei movimenti» o «…per collegare i movimenti alle persone», o se Claude dice «Il database non è ancora aggiornato per
registrare dalla chat», manca un aggiornamento del database: va chiesto a chi cura l'app.
