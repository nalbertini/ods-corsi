# Amministrazione · Contabilità

← [Torna all'amministrazione](README.md)

Le entrate e le uscite della palestra, in due casse: **Cassa Contanti** e
**Conto Corrente**. La vede solo chi ha il ruolo di amministrazione: la segreteria
semplice, gli istruttori e il tablet no. Ha quattro schede, sotto il titolo come in IMPOSTAZIONI: **MOVIMENTI**, **BILANCIO**, **VOCI**, **CASSE**. Quel che resta da assegnare si trova in MOVIMENTI, con MOSTRA **Da assegnare**.

## Movimenti

MOVIMENTI è un **estratto conto**. Sotto i filtri, una striscia di quattro cifre: **SALDO INIZIALE**,
**ENTRATE**, **USCITE** e **SALDO FINALE**, del periodo che hai scelto. Con **Da assegnare**,
**Annullati**, un TIPO, una voce o una ricerca restano solo **ENTRATE** e **USCITE**: i saldi sono di tutta
la cassa e non tornerebbero con le righe che vedi. La
tabella ha le colonne **DATA**, **DESCRIZIONE**, **TIPO** (con la sua icona: Incasso iscritto,
Giroconto, Entrata, Uscita), **CASSA**, **ENTRATE** e **USCITE**, con le righe dalla più
recente. Accanto al titolo CONTABILITÀ, e solo in questa scheda, c'è **Nuovo movimento**
e il menu **Altre azioni**: **Collega i casi sicuri**, **Giroconto** ed **Esporta CSV**.

Una riga che non è scritta qui dice da dove viene, accanto al nome: **Dalla banca**, **Dallo storico**, **Da Satispay**, **Dalla chat**. Gli incassi degli iscritti e i movimenti scritti qui non hanno segno. Voce, descrizione e nota di un movimento si correggono allo stesso modo, qualunque sia l'origine.
Al computer ogni riga sta in due righe di testo: sopra il nome, sotto la voce e il resto, tagliati con «…» quando non ci stanno; tutto si legge aprendo il movimento.

L'elenco unisce due cose:

- gli **incassi degli iscritti**: le ricevute, i pagamenti a mano e i
  pagamenti Satispay dal modulo di iscrizione (finché non sono in una
  ricevuta, poi conta la ricevuta) entrano da soli, uno per pagamento, con il tipo
  **Incasso iscritto** (sotto il nome: la voce, e ricevuta N/AAAA o senza ricevuta; il metodo lo dice la cassa). Non si ricopiano e non si cambiano da qui: toccare la riga apre la scheda della
  persona, nella scheda **QUOTA E PAGAMENTI**, dove si registra l'incasso e si fa la ricevuta. Se una ricevuta
  o un pagamento si annulla, cambia da sé anche qui. In **PERSONA** c'è il nome
  della scheda dell'iscritto (vuota se il pagamento non ha una scheda): la
  descrizione resta il nome scritto sulla ricevuta, che può essere diverso. Contanti vanno in Cassa
  Contanti; tutto il resto (bonifico, POS, assegno) in Conto Corrente. Satispay no:
  vedi [Satispay](#satispay).
  Prima di registrare un pagamento a mano, il riepilogo dice già dove entra
  («Entra in CONTABILITÀ: Cassa Contanti · Quota associativa»).
  Il «pagato fino al» non è un incasso e qui non compare;
- i **movimenti che scrivi tu**: altre entrate (contributi, gare, attività
  fatturate) e le uscite.

Si parte dal **mese corrente**. Filtri ed elenco stanno in un riquadro solo. In alto, su una riga
(sullo schermo stretto vanno a capo):

- la **ricerca** nella descrizione, nel nome o nell'importo (non bada a maiuscole, accenti e
  spazi in più) e il **periodo**: i menu **Mese** e **Anno**, con le frecce **‹** e **›** per il mese
  prima e quello dopo. **›** si ferma al mese corrente; con **Tutti i mesi** le frecce non ci sono.
  **Tutti gli anni** guarda tutto lo storico; un mese scelto senza anno è di quest'anno. Ci sono anche i
  movimenti di prima della data di partenza di una cassa (lo storico importato): contano in BILANCIO e
  si sistemano come gli altri, ma non nei saldi, quindi con loro la striscia tiene solo ENTRATE e USCITE;
- **MOSTRA**: **Da assegnare · N** (quel che resta da sistemare: una quota o un corso senza persona,
  un omonimo da decidere, soldi ancora da assegnare, la voce **Da classificare**; guarda tutto lo
  storico, il periodo passa a tutti gli anni), **Tutti** o **Annullati** (solo quelli annullati,
  che non contano). **TIPO**: **Entrate**, **Uscite** o **Tutti**. **Voce**: una sola voce, fra
  quelle che i movimenti hanno (anche quelle vecchie o spente); segue il TIPO, e se cambi TIPO e la
  voce non c'è più si toglie da sola. Con una voce scelta restano solo **ENTRATE** e **USCITE**.

Sotto, quanti movimenti ci sono («38 movimenti a novembre 2026»), quanti ne hai scelti e, a destra,
la **VISTA**: **Elenco** o **Per voce**, che dà i totali per voce.

**Esporta CSV**, nel menu **Altre azioni**, dà un foglio per Excel e per il commercialista,
senza gli annullati.

### Gli incassi degli iscritti

Qui si guardano; si registrano dalla scheda della persona. Toccare una riga **Incasso iscritto**
apre la scheda, nella scheda **QUOTA E PAGAMENTI**: lì **+ AGGIUNGI INCASSO** (con il
riepilogo prima di scrivere, e dove entra: Cassa Contanti per i contanti, Satispay, Conto
Corrente per il resto) e **+ FAI LA RICEVUTA** ([Un pagamento e la sua
ricevuta](../segreteria/iscritti.md#un-pagamento-e-la-sua-ricevuta)). Si annulla da lì: un
pagamento senza ricevuta con **Annulla il pagamento**, uno di una ricevuta annullando la ricevuta
intera. Sparisce dai conti, resta in elenco con MOSTRA **Annullati**.

- **Satispay senza richiesta**: chi ha pagato con Satispay in fondo al modulo e poi non ha mandato
  la richiesta compare da solo, col segno **Satispay senza richiesta** e sotto il nome l'email e il
  corso, per richiamare. Si fa mandare la richiesta (stesso nome, email e corso: il pagamento si
  ritrova da solo), o si restituiscono i soldi dall'app Satispay Business.
- **Chi deve ancora pagare** non è qui: è in [ISCRITTI](../segreteria/iscritti.md), con il filtro **Da pagare**.
- **Non ci sono** i pagamenti dei corsi fuori dall'app che nessuno ha registrato, né gli ordini del
  **vestiario**, che hanno la loro pagina. **STATISTICHE** conta gli incassi per mese della
  ricevuta e non i pagamenti a mano: i due numeri possono non coincidere.

### Nuovo movimento

**Nuovo movimento** si apre in una **pagina intera**, al posto dell'elenco (il **Giroconto** lo
stesso); **← I movimenti** torna all'elenco com'era, coi filtri che avevi, e se hai già scritto
qualcosa chiede prima se lasciare. Si sceglie entrata o uscita, data, importo, cassa, **voce** (solo quelle
del tipo giusto, non quelle disattivate), descrizione e una nota se serve. Un solo
importo, senza IVA. La data non è nel futuro e non è prima del giorno da cui parte
la cassa. Niente dati personali che non servono, nella descrizione e nella nota.

Un'entrata su **Quota associativa** o **Corsi e altri pagamenti** si registra sempre con la
**persona**: compare il campo **PERSONA · DI CHI È**, si cerca da tre lettere e si tocca la scheda giusta.
Sotto il nome di chi non è un iscritto c'è il ruolo (**istruttore**, **segreteria**): chi insegna e
frequenta anche i corsi ha due schede con lo stesso nome, e la quota va su quella senza ruolo.
Per un minore è chi frequenta, anche se ha pagato il genitore. Senza persona non si registra. Se quella
persona ha già una ricevuta o un pagamento con lo stesso importo negli ultimi 30 giorni, l'app avvisa
(**Forse già tra gli incassi**): se è la stessa quota non scriverla qui, c'è già. La persona è un'etichetta:
la quota **non conta come pagata** (per questo serve la ricevuta, dalla scheda della persona).

Prima di scrivere, l'app mostra un **riepilogo** (importo, voce, cassa, data e, se c'è, la persona): **Sì,
registra il movimento** lo scrive, **No, torna al modulo** lascia tutto com'era. Se il movimento scritto è fuori dai filtri che hai
acceso, l'elenco lo dice («Non lo vedi nell'elenco: è fuori dai filtri») e **Mostralo** porta al suo
mese, con tutti i movimenti.

Un movimento registrato **non si cambia** negli importi: toccandolo si apre in una **finestra** sopra l'elenco
(vedi [La finestra dei dettagli](../segreteria/README.md#la-finestra-dei-dettagli)). In alto c'è da dove viene
(«Movimento dalla banca», la cassa e la data, col lucchetto: questi non si cambiano), l'**importo** grande e se è
un'entrata o un'uscita.

Sotto c'è la **persona**: un riquadro col suo nome, **Apri scheda →** (porta alla scheda della persona, anche per
un incasso di un iscritto) e **⋯**, con **Cambia persona** e **Scollega**. Se manca: «Nessuna persona collegata»
e **Collega una persona**. Su un'entrata di quota o corsi con soldi ancora da dire a cosa vanno, nello stesso
riquadro c'è **Da assegnare** (vedi sotto). MOSTRA **Da assegnare** trova anche le quote e i corsi senza persona,
scritti prima che la persona fosse obbligatoria.

Poi la **voce** e la **nota**. La descrizione (di un movimento della banca, il suo testo) e **Cosa è cambiato**
stanno in **Descrizione e storico**, chiuso: si apre per leggerli o correggere la descrizione (di un giroconto,
solo la nota). **Salva** compare solo quando hai cambiato qualcosa, e scrive quel che hai cambiato.
**Annulla movimento**, in rosso in basso a sinistra, chiede prima di annullare: il movimento resta in elenco,
annullato, e non si conta più. Per correggere importo, data o cassa si annulla e si rifà.

### Cambiare la voce

La voce di un movimento si cambia **senza annullare e rifare**: importo, data, cassa e testo
restano come sono, e anche i giorni già chiusi (la chiusura non cambia: i soldi sono gli stessi).

- **Uno solo**: apri il movimento, scegli la **voce** nuova e tocca **Salva**. In **Descrizione e storico**, **Cosa è
  cambiato** dice chi l'ha cambiata, quando e da quale voce veniva. Un movimento scritto qui che va su
  **Quota associativa** o **Corsi e altri pagamenti** chiede la **persona**, se non ce l'ha già.
- **Il suggerimento**: un movimento su **Da classificare** apre con un riquadro giallo,
  **Suggerito · conferma tu**, con il **testo della banca** in cima, per confrontarlo, e sotto la **voce** e la **persona** affiancate. La **voce** è quella delle
  altre righe uguali (almeno due, tutte sulla stessa voce); se non ci sono, si capisce dall'importo:
  50 € è la **Quota associativa**, il prezzo di un corso del listino è **Corsi e altri pagamenti**, e un
  importo che non combacia con nessun prezzo va lo stesso su **Corsi e altri pagamenti**, con un avviso
  in giallo: controlla che sia giusta. La **persona** si cerca mettendo insieme quel che si sa, e ogni
  cosa conta: il nome scritto nel testo («Satispay · Elisa M.»: nome intero, o nome e iniziale del
  cognome); il nome e cognome del **genitore** come sono nei dati di registrazione (i minori li paga di
  solito un genitore: si propongono i figli); un **codice fiscale** scritto nella causale; un bonifico
  **con lo stesso testo** già collegato a una persona (stesso conto, cambiano solo numeri e date);
  l'**importo**, se è quello di un corso a cui è iscritta e il cognome è nel testo; il **nome** con una
  parola del **corso** a cui è iscritta (per esempio «Giulia psicomotricità»); il **cognome**, suo o del
  genitore. In cima va chi ne ha di più; a pari, chi ha già l'iscrizione in corso quel giorno va dopo,
  col segno. Sotto le schede una riga dice il motivo della prima. Se nessuno ha di più, si propone chi
  ha il solo **cognome** (se è di più persone, chi di loro è iscritto quel giorno, o se nessuno chi lo è
  stato). La prima è già scelta solo se è chiaramente avanti alle altre, e mai per il solo cognome o
  per nome e corso; se no scegli tu, e **Conferma** resta spento finché non scegli. Per un'uscita la persona non c'è.
  **Conferma** collega la voce e la persona e non crea una ricevuta: la quota resta da pagare finché non
  registri l’incasso nella scheda della persona. **Scegli tu** non cambia niente: mette la proposta nei campi qui sotto, e decidi lì.
  Senza suggerimento, il riquadro non c'è.
- **Tanti insieme**: nell'elenco scrivi nella ricerca una parte della causale (per esempio «enel»),
  e, se serve, MOSTRA **Da assegnare** (le voci da classificare ci sono), la **Voce** di partenza
  (per spostare tutta una voce in un'altra) o il periodo **Tutti gli anni**. L'elenco dice quanti ne ha trovati. Spunta le righe, oppure la casella in testa alla
  colonna, che le sceglie tutte. In fondo compare la barra **N scelti**: **Cambia voce** apre il riepilogo (quanti sono,
  di che tipo, quanto fanno, da quali voci vengono). Scegli la **nuova voce** e tocca **Sì, cambia la
  voce**: finché non lo dici, non cambia niente. Se cambi la ricerca o i filtri, la scelta si svuota.
  Si fa anche dal telefono.
- Le righe vanno a **pacchetti da 500**, ognuno **tutto o niente**: se uno si ferma, l'app dice
  quanti ne ha cambiati e perché, e quelli dopo non cambiano. Quelli che avevano già la voce non
  vengono toccati e il riepilogo li conta a parte.
- Non hanno la casella e non si cambiano da qui: gli **incassi degli iscritti** (si correggono dalla scheda della
  persona), i **movimenti annullati**, i **giroconti** (non hanno voce) e la **Differenza di cassa**
  scritta da una chiusura. La voce nuova deve essere in uso e dello stesso tipo: una voce di entrata
  per le entrate, di uscita per le uscite. Con entrate e uscite scelte insieme, **Cambia voce** resta
  spento: tocca **Solo le entrate** o **Solo le uscite**. I movimenti scritti qui non vanno **in blocco** su
  **Quota associativa** o **Corsi e altri pagamenti**: ognuno ha la sua persona, quindi si apre e si
  cambia uno alla volta. Lo storico sì, anche in blocco.
- Un cambio sbagliato si rimedia scegliendo di nuovo le righe e assegnando la voce giusta: la traccia
  non si cancella.

### Collegare lo storico alla persona

Nei movimenti dello storico il nome di chi ha pagato sta solo nella causale («Cliente NOME per …»).
Si può **collegare il movimento alla persona**: è solo un'etichetta, «di chi è questo pagamento».
Importo, data, cassa e voce non cambiano, e i saldi, il bilancio e le chiusure restano uguali, anche
nei giorni già chiusi. Non è un incasso in più: lo storico collegato compare nella scheda della persona
in un blocco a parte, **Dal vecchio programma**, e non si somma ai suoi pagamenti.

Si collegano solo le **entrate** su «Quota associativa» e «Corsi e altri pagamenti»: quelle dello
storico qui, quelle scritte a mano dalla loro finestra (vedi sopra). Non si collegano i giroconti, la
«Differenza di cassa» e gli annullati.

- **I casi sicuri, in blocco**: **Collega i casi sicuri** apre il riepilogo (quanti movimenti, a quante
  persone, quanto fanno, un campione di nomi). Sono sicuri i movimenti con nome e cognome della causale
  uguali a quelli di **una sola scheda**, in qualunque ordine e senza badare a maiuscole e accenti, anche quando il vecchio programma scrive l'accento come apostrofo (NICOLO' è Nicolò).
  Niente si scrive finché non dici **Sì, collega**. Vanno a pacchetti da 500, ognuno tutto o niente; se uno
  si ferma, l'app dice quanti ne ha collegati e **Rifai il collegamento** riparte dagli altri. A fine
  lavoro **Togli questo lotto** scollega solo quelli appena collegati: quelli cambiati a mano dopo non si toccano.
  Quelli della **stagione in corso** che si possono dividere in un modo solo si **assegnano da soli** (vedi
  sotto, «Si assegnano da soli»), e il riepilogo dice quanti; **Togli questo lotto** toglie anche quelle
  assegnazioni. Lo stesso vale quando colleghi a mano con **Collega a una persona**.
- **Chi ha più schede dello stesso nome** (omonimi) non si collega mai da sé: il tag **Omonimi** e
  MOSTRA **Da assegnare** li mostrano. Scegli i movimenti e tocca **Collega a una persona**: l'app offre
  le persone con quel nome e quel che le distingue (anno di nascita, corsi, iscrizione). Se non basta,
  si cerca per nome.
- **Chi non ha più la scheda** (un ex iscritto): il movimento resta com'è, con il tag **Senza scheda** e il
  nome nella causale. Non si creano schede per lo storico.
- **Per correggere**: scegli i movimenti e tocca **Scollega**, o **Collega a una persona** per spostarli
  su un'altra. Ogni collegamento resta scritto: chi, quando, a quale persona.
- Se una scheda viene eliminata, i suoi movimenti restano, senza persona; se due schede si uniscono,
  il collegamento passa a chi resta.

Gli omonimi da decidere e le quote senza persona sono in MOSTRA **Da assegnare**, su tutto lo storico.

### Assegnare un bonifico a quota e corsi

Collegare un'entrata a una persona dice di chi è, non a cosa va: finché non la **assegni**, la quota e i
corsi restano da pagare. Assegnare dice quanto del bonifico va a ogni cosa da pagare (la quota, un
annuale, un trimestre), e ogni importo diventa un pagamento della persona: un **saldo** se copre quel
che manca, se no un **parziale**. Dallo stesso passaggio si fa la ricevuta, senza scrivere un secondo
movimento: i soldi contano una volta sola.

Si assegnano le **entrate** su «Quota associativa» e «Corsi e altri pagamenti» già collegate a una
persona, sul **Conto Corrente**. I contanti no: si registrano in PAGAMENTI. Lo storico del vecchio
programma solo dalla **stagione in corso**: quello delle stagioni passate resta nello storico.

- **CHI HA PAGATO E PER COSA?** è la finestra che dice chi ha pagato un bonifico e a cosa va, in un passo
  solo. È la stessa dovunque cominci: dal campo PERSONA di una riga dell'**import della banca**, dal tasto
  **Chi e per cosa** di un'entrata in MOVIMENTI (Da classificare, o su quota e corsi ancora da assegnare,
  con o senza persona) e da **Assegna a quota e corsi** nel movimento. In alto l'importo in grande, la
  data, chi ha fatto il bonifico e la causale senza i codici (**Causale intera** la mostra com'è). Poi le
  schede col nome del testo e la ricerca; scelta la persona, la ricerca si chiude in una riga col suo nome
  e **Cambia**, che la riapre. Sotto, in **COSA PAGA**, la sua situazione e quella del suo **nucleo**: cosa
  deve (quota e corsi, con quel che manca) e i **pagamenti** già fatti; con più persone della famiglia, un
  riquadro per persona col nome. In fondo, sempre in vista, il conto: quanto è assegnato di tutto il
  bonifico e se è **Tutto assegnato**, **Da assegnare** (in giallo) o **più del bonifico** (in rosso), con
  la **tipologia**, che la dice quel che paga: solo la quota → «Quota associativa»; con un corso → «Corsi
  e altri pagamenti».
  **Solo la persona, decido dopo** collega e basta. Se c'è una ricevuta fatta a parte che può essere
  questo bonifico, la finestra chiede **C'È GIÀ LA RICEVUTA: è questa?**: **Sì, è questa** la lega,
  **No, dividi il bonifico** torna alle cose da pagare.
- Gli importi sono già proposti (un bonifico solo per due fratelli si divide fra tutti e due): prima la
  quota, poi i corsi dal più vecchio; se c'è un solo modo di dividere, il conto in fondo lo dice
  («Tutto assegnato · un solo modo di dividere»). Per un corso ancora da pagare propone l'**annuale**, o il **trimestre** se il
  testo del bonifico dice «trimestrale» o «trimestre». Gli importi si correggono a mano; accanto a ognuno il tag **Saldo** o **Parziale**, e sotto
  quanto resterà. **Svuota tutto** azzera la proposta. Non si assegna più di quel che manca a ogni voce,
  né più del bonifico.
- Chi fa **più corsi annuali** non paga ogni corso a listino: i corsi insieme costano al massimo 660,00 €,
  la quota a parte. La finestra mostra una riga sola, **Annuale più corsi (N corsi)**, con i corsi sotto
  e quel che manca: 660,00 € meno quel che ha già pagato sugli annuali in questa stagione (il trimestre
  non conta). Un bonifico da 660,00 € con quattro annuali diventa quota 50,00 € e «Annuale più corsi»
  610,00 €. Un secondo bonifico paga quel che manca alla stessa voce; un annuale aggiunto dopo aver
  raggiunto i 660,00 € costa 0,00 €. Con la voce «Annuale più corsi» l'area iscritti e Satispay vedono
  pagati tutti i suoi annuali.
- Se il bonifico paga una cosa che non è fra quelle da pagare, sotto ogni persona c'è **AGGIUNGI**, con
  le scelte da un tocco, tutte tasti uguali col «+»: la **quota associativa** dell'anno (se non è già una riga e non è già pagata tutta
  nell'app), le voci dei **corsi a cui è iscritta** («Judo 2 annuale», «Judo 2 trimestre»), **Abbigliamento · a mano** e
  **Altro corso…**, che apre un campo per cercare gli altri corsi per nome (maiuscole e accenti non
  contano; **Chiudi** o Esc lo chiude). La voce scelta diventa una riga come le altre, con «dal listino» e
  il prezzo: l'importo parte da quel che resta del bonifico e non supera il prezzo. **Togli** la toglie.
  Se la persona non è iscritta a quel corso, la finestra lo dice: l'iscrizione si fa dalla scheda.
  **Abbigliamento · a mano** non ha un prezzo: l'importo parte da quel che resta del bonifico e si
  corregge a mano. Non tocca nessun ordine in VESTIARIO. Come gli altri pagamenti, va su «Corsi e altri
  pagamenti»: un bonifico si assegna solo lì o sulla quota.
- Se in VESTIARIO c'è un ordine **da saldare** che può essere della famiglia, sopra AGGIUNGI compare
  **ORDINI DEL VESTIARIO**: per ogni ordine chi l'ha fatto e per chi, la data, i capi, le ultime cifre
  del telefono e quanto manca. Un ordine è della famiglia se l'ha fatto una persona del nucleo a nome suo,
  o se in «per chi» c'è nome e cognome di una persona del nucleo (anche col telefono del genitore, diverso da
  quello della scheda). Un ordine fatto a nome di una persona del nucleo ma con un telefono diverso da quello
  della scheda è di un omonimo e non compare. Due ordini simili si vedono
  tutti e due: la scelta è tua. **È questo ordine** lo fa diventare una riga «Abbigliamento, ordine del
  …», con quel che manca all'ordine e l'importo che non va oltre il bonifico. Se la riga copre tutto
  (**Saldo**), con **Conferma** l'ordine in VESTIARIO diventa saldato con bonifico. Se copre una parte
  (**Parziale**), l'ordine resta com'è e si segna a mano in VESTIARIO; il bonifico dopo vede quel che manca
  ancora, e se lo copre salda l'ordine. Un ordine scelto per una persona sparisce dalle altre. Se poi annulli
  il bonifico (o la sua ricevuta), l'ordine torna da saldare. Un abbigliamento assegnato **a mano** prima di
  questa novità non è legato all'ordine: l'ordine può ricomparire fra quelli da saldare, guarda in VESTIARIO
  prima di sceglierlo.
- **Conferma** scrive persona, tipologia e assegnazione, senza ricevuta: la ricevuta si fa dopo, dal
  movimento, con **Fai la ricevuta**. Dal movimento c'è anche **Conferma e fai la ricevuta**, che apre la
  ricevuta già compilata (data del bonifico, modo **Bonifico**). All'import si scrive tutto quando
  importi. Quel che non assegni resta **da assegnare**.
- Se la persona è segnata **pagata a mano** nella scheda, senza un pagamento nell'app, non c'è niente da
  pagare e la finestra mostra il riquadro giallo **GIÀ PAGATO A MANO**. Se il bonifico è quel
  pagamento, **È questo bonifico** propone la quota e i corsi interi, prima i suoi e quel che avanza ai
  familiari: assegnali, con o senza ricevuta, e il bonifico esce da Da assegnare. Se il bonifico copre
  meno del listino, il corso diventa **pagato in parte** con quel che manca: la finestra lo dice prima,
  con «Resteranno…». **Non è questo** chiude il riquadro e il bonifico resta da assegnare, con la scheda
  segnata pagata com'era.
- Nella finestra, **ASSEGNATO A** elenca a chi e a cosa sono andati i soldi, con la ricevuta (e il
  **PDF**) o il tag **Senza ricevuta**.
- **Si assegnano da soli** i bonifici collegati per cui c'è **un solo modo di dividere** l'importo fra
  le cose che il nucleo deve, ognuna pagata per intero: 220,00 € e un annuale da 220,00 €, o 270,00 € e
  quota da 50,00 € più un annuale da 220,00 €. Non si assegna da solo un bonifico che si può dividere in
  più modi (due corsi dello stesso prezzo), pagato **in parte**, **più** di quel che deve, di chi è
  segnato **pagato a mano**, con la ricevuta già fatta a parte (va abbinata), o già assegnato in parte.
  Si assegnano **senza ricevuta**: la ricevuta si fa dal movimento, quando serve. Succede da sé dopo
  l'**import della banca**, **Collega i casi sicuri** e **Collega a una persona**. Per quelli collegati
  prima, in MOVIMENTI con MOSTRA **Da assegnare** in cima c'è il riquadro **SI ASSEGNANO DA SOLI**: tutti, uno per
  riga, con persona, voce e importo; **Assegna i N** chiede conferma e li scrive. Subito dopo **Togli
  questo lotto** li rimette in Da assegnare; uno solo si annulla anche dal movimento.
- La persona di un bonifico è **sicura** con la stessa regola dappertutto: all'import il primo dei
  proposti con almeno 4 punti e 2 più del secondo, anche se è già iscritto quando la causale ha il suo
  **nome e cognome interi**; nello storico il nome della causale di una sola scheda.
- MOSTRA **Da assegnare** in MOVIMENTI elenca le altre, e sotto ognuna perché non si assegna da sola
  («Ci sono più modi di dividere…», «Pagato in parte: … di …»), col tasto **Chi e per cosa**. In cima,
  oltre a SI ASSEGNANO DA SOLI, **C'È GIÀ LA RICEVUTA**: i bonifici già nel Conto
  Corrente per cui la ricevuta in Bonifico l'hai fatta a parte (stesso importo, pagata tutta con
  bonifico, entro 30 giorni). La ricevuta può essere della persona del bonifico o della sua famiglia
  (il genitore paga, la ricevuta è del figlio). **Abbina** li lega senza scrivere niente di nuovo, così i
  soldi non si contano due volte; **Non è questa** la toglie dalla proposta.
- Lo stesso lo vedi **dal movimento**: se il bonifico non ha ancora niente assegnato e c'è la sua
  ricevuta fatta a parte (la stessa che proporrebbe C'È GIÀ LA RICEVUTA), al posto di **DA ASSEGNARE** c'è
  **C'È GIÀ LA RICEVUTA**: «C'è già la ricevuta n. … del … da …: è questa?». **Abbina** la lega al
  bonifico, che resta aperto con la ricevuta in **ASSEGNATO A**; **Non è questa** torna a **DA
  ASSEGNARE**, finché non chiudi la finestra.
- Anche un bonifico ancora **Da classificare** compare in C'È GIÀ LA RICEVUTA, con le ricevute che possono
  essere sue, dalla data più vicina: solo quelle di chi la causale nomina con nome e cognome interi (la
  persona della ricevuta, qualcuno della sua famiglia o il genitore scritto nella sua anagrafica). Se la
  causale non nomina nessuno, il bonifico non compare: collegalo a mano. Poi scegli quella giusta con **È questa** (o **Abbina**, se è una sola),
  o **Nessuna di queste**. Non si abbina mai da solo, e nemmeno con «Abbina tutti»: abbinato, il bonifico
  prende la persona della ricevuta e la voce (**Quota associativa** se la ricevuta è solo quota, se no
  **Corsi e altri pagamenti**).
- **Per correggere** si annulla la ricevuta (i soldi tornano da assegnare) e si riassegna. Finché un
  movimento ha dei soldi assegnati non si scollega, non cambia persona né va su una voce senza persona, e
  il suo lotto di Importa banca non si annulla: l'app dice cosa annullare prima.

Nella scheda della persona, in **QUOTA E PAGAMENTI**, un bonifico collegato e non assegnato è una riga
gialla, **Da assegnare**, con **Assegna ›**; assegnato, è una riga sola con l'importo arrivato e sotto come
è stato diviso, il tag **Senza ricevuta** finché non c'è, e **Apri in contabilità**. Se fai la ricevuta dalla scheda mentre c'è un
bonifico collegato da assegnare, il modulo lo dice: se è quello, falla dal bonifico.
Con **PAGATO CON Bonifico**, se nel Conto Corrente c'è già un bonifico libero con lo stesso importo
entro 30 giorni (della persona, della sua famiglia o Da classificare con il loro nome nella causale), il modulo lo mostra in **FORSE È
GIÀ IN BANCA**: spunta **È questo: abbinalo alla ricevuta** e, fatta la ricevuta, il bonifico si abbina
da solo. Non è obbligatorio, e lo vede solo chi ha CONTABILITÀ: per gli altri resta C'È GIÀ LA RICEVUTA.

### Giroconto

**Giroconto** sposta soldi da una cassa all'altra, per esempio il versamento dei
contanti in banca: da Cassa Contanti a Conto Corrente. Non è un'entrata né
un'uscita: non entra nei totali, né nei totali per voce. Si annulla come un movimento.
Anche qui, prima di scrivere c'è il riepilogo da confermare.

### Satispay

Satispay non entra in CONTABILITÀ, né i pagamenti del modulo né quelli del negozio (anche
col QR alla cassa) né quelli registrati in palestra. I soldi arrivano in banca col
versamento **«Da Satispay Europe S.A.»**: è quello l'incasso, e entra in Conto Corrente con
[Importare dalla banca](#importare-dalla-banca), sulla voce **Incassi Satispay**, che l'app
propone da sola. Così ogni
euro si conta una volta sola.

Il versamento è già **al netto della commissione** di Satispay: l'importo in banca è un
po' meno di quanto hanno pagato le famiglie. Non si scrive a parte, e non c'è niente da
far tornare.

La cassa **Satispay** è chiusa: non prende movimenti nuovi, né giroconti. Quel che c'era
dentro resta visibile, e si annulla come ogni movimento.

Nei saldi in cima a CONTABILITÀ le casse **Satispay** e **Carta** non compaiono finché sono
a zero: i loro soldi sono sul Conto Corrente. Se dentro c'è qualcosa, tornano, così il
**Totale** si spiega.

Chi ha pagato con Satispay (nome, importo, giorno, se l'app lo riconosce fra gli iscritti)
lo dice lo scarico, ogni notte, in [IMPORTAZIONI → Visualizza chi ha pagato](importazioni.md#chi-ha-pagato).
Se lo scarico non riesce arriva un'email agli indirizzi degli avvisi (IMPOSTAZIONI → GLI
AVVISI, vedi [Le regole](../segreteria/regole.md#gli-avvisi)).

### Importare dalla banca

**Importa dalla banca**, nel menu **Altre azioni** di MOVIMENTI (o **Importa** in [IMPORTAZIONI](importazioni.md)), apre una pagina sua che legge il file della banca e scrive nel **Conto
Corrente** i movimenti che mancano; il tasto in alto torna indietro. Dall'home banking di BancoPosta scarica la
**Lista movimenti** in formato CSV, poi tocca **Scegli file**. Il file resta sul tuo computer:
l'app ne legge solo i movimenti, e toglie dalla descrizione IBAN e codici fiscali.

Di un bonifico in uscita la banca dà solo «Distinta: …», senza dire a chi hai pagato.
Aprendo il movimento compare **MANCANO DEI DATI**: scrivi il destinatario e premi
**Salva il destinatario**. Diventa il titolo del movimento, e la scritta della banca resta
nella nota (con «Dalla banca:»), per ritrovarlo sull'estratto conto. Il movimento resta
aperto: scegli subito la **VOCE** (e la persona, se serve) e premi **Salva**.

Prima c'è l'anteprima, e niente si scrive finché non dici **Sì, importa**. In alto il conto delle
righe del file: quante sono **nuove**, quante **forse già nell'app**, quante **già nell'app** e quante
**scartate**, poi quanto entra e per quanto. Sotto, le righe: data, descrizione (il tipo d'operazione
della banca in piccolo sopra, il testo senza codici TRN), tipologia, importo e, in fondo a destra,
la persona o i tasti della riga. I filtri sopra l'elenco sono **Da fare** (la pagina parte da qui:
le nuove e quelle da decidere), **Già nell'app**, **Scartate** e **Tutte**; accanto **Entrambe**,
**Entrate** o **Uscite** tiene solo i soldi che entrano o che escono (le scartate, senza importo,
restano fuori). Se il file non ha niente di nuovo, la pagina lo dice e mostra le già nell'app.

Le righe sono a gruppi:

- **Forse già nell'app**, per prime: un movimento uguale a uno già scritto a mano (stesso importo, stesso giorno o due giorni prima o dopo). Accanto c'è il movimento dell'app che potrebbe essere (per esempio «Rossi Luca · ricevuta n. 119 · 26/10/2026»): **Conferma** se è quello, **Nuovo** se è un movimento diverso; finché non scegli, la riga non entra. **Nome diverso** vuol dire che nel testo della banca c'è un nome che non è quello della ricevuta. Sulla fascia del gruppo, **Conferma** collega insieme le righe dove nome e cognome (o il genitore) sono nel testo, **Tutti nuovi** le fa entrare tutte come movimenti nuovi.
- **Movimenti nuovi**: entrano. Un **versamento di contanti** ha sotto la riga gialla «controlla che non siano già nella cassa contanti».
- **Già nell'app**: c'è già, anche come ricevuta o pagamento a mano in bonifico o POS, e non si scrive una seconda volta. Accanto c'è il movimento dell'app a cui corrisponde. Se l'abbinamento l'ha fatto l'anteprima e non è giusto, **Nuovo** fa entrare la riga come movimento nuovo; sulle righe già importate in una volta precedente il tasto non c'è, per non scrivere due volte lo stesso pagamento.
- **Una ricevuta pagata in più rate**: se la ricevuta ha più pagamenti dello stesso giorno sul Conto Corrente (per esempio quota 50,00 + trimestre 170,00 in bonifico) e dalla banca arriva un bonifico solo con la somma (220,00), la ricevuta intera è una voce sola, con le rate nel dettaglio. È **già nell'app** da sola solo se nel testo della banca ci sono nome e cognome di chi ha la ricevuta; se no è **forse già nell'app**, con **Nome diverso**. Si somma solo dentro una ricevuta: un bonifico che paga le ricevute di più persone entra come nuovo e si divide con **Assegna a quota e corsi**. Un bonifico importato come nuovo prima di questa regola si sistema annullando il movimento in **MOVIMENTI**: la ricevuta resta e i soldi contano una volta.
- **Scartate**: la data o l'importo sono illeggibili, o la data è nel futuro. Il motivo è scritto nella riga. Correggila nel file e riprova.

I versamenti **«Da Satispay Europe S.A.»** entrano come gli altri: sono l'incasso di Satispay, sulla voce **Incassi Satispay** (vedi [Satispay](#satispay)). Le righe già nell'app si ricontrollano dopo l'importazione in [IMPORTAZIONI → Cosa è entrato](importazioni.md#cosa-è-entrato).

Sulle righe che entrano scegli la **tipologia**: parte da quella che l'app propone (come per
i movimenti da classificare) o da **Da classificare**. Per una quota o un corso serve anche la
**persona**, in fondo alla riga: se nel testo c'è il nome di una sola scheda, l'app la mette già lì
e all'importazione vale quella. Premendo il campo (o **Chi e per cosa**, se è vuoto) si apre **CHI HA
PAGATO E PER COSA?** (vedi [Assegnare un bonifico](#assegnare-un-bonifico-a-quota-e-corsi)): scegli la
persona e a cosa va. Il campo dice poi chi e per cosa («Trimestre Judo kids 120,00 €»), e la tipologia
segue quel che paga. Un'entrata **Da classificare** può aprire la stessa finestra.
In fondo l'app dice quante righe avranno la voce scelta e quante restano in **Da classificare**:
una quota senza persona, per esempio, entra lo stesso e resta lì. Se esci dalla pagina con delle
scelte fatte, l'app chiede prima.

Un bonifico in entrata su **Quota associativa** o **Corsi e altri pagamenti**, con la persona, entra
già **con la sua ricevuta** se ne hai fatta una sola che gli va: in **Bonifico**, non ancora legata a
un movimento, stesso importo, entro 30 giorni, della persona o della sua famiglia (come per
[**Abbina**](#assegnare-un-bonifico-a-quota-e-corsi)). Sotto la riga, in verde, «Va con la ricevuta
n. … di …», con la data e l'importo, e «(nucleo)» se è di un altro della famiglia. **Togli** la lascia
fuori: il bonifico entra senza, resta in **Da assegnare** e lo abbini tu; **Abbina** la rimette.
Con **più ricevute possibili**, o se due bonifici del file vogliono la stessa, la riga lo dice in
giallo e non si abbina niente: la scegli dopo in **Da assegnare**. Se cambi persona o voce, la
proposta si rifà. In fondo l'app dice anche quanti bonifici entrano con la ricevuta, e dopo
l'importazione il riepilogo elenca le ricevute abbinate (numero e persona) e, in giallo, i bonifici
che non si sono abbinati, col motivo. I bonifici con la persona e senza ricevuta che si dividono in un
modo solo **si assegnano da soli** a quota e corsi, senza ricevuta (vedi [«Si assegnano da
soli»](#assegnare-un-bonifico-a-quota-e-corsi)): il riepilogo dice quanti, e quanti restano in **Da
assegnare** perché c'è da scegliere.

I movimenti entrano col segno **DALLA BANCA**, nella voce scelta o in **Da classificare**:
quelle rimaste le sistemi dopo, con **Cambia voce**. Rileggere lo stesso file non duplica niente,
nemmeno un movimento annullato. Se qualcosa non torna, **Annulla**, accanto all'ultima importazione in cima alla pagina,
toglie in un colpo i movimenti dell'ultima importazione; uno annullato per sbaglio si
recupera da **Annullati**. Solo l'amministrazione importa; la segreteria può poi
classificare. Una volta sola al massimo 1000 movimenti.

### Dalla chat, con Claude

Le fatture, le ricevute e gli scontrini dei **fornitori** si possono registrare fotografandoli
a Claude, invece di ricopiarli in **Nuovo movimento**. Claude legge data, importo e fornitore,
propone la voce (quella usata l'ultima volta per lo stesso fornitore) e la cassa, e mostra il
riepilogo: registra solo dopo il tuo «ok», e poi dice cosa ha scritto.

- **Collegarlo, una volta**: in Claude, Impostazioni → Connettori, si aggiunge ODS Corsi.
  Si apre una pagina dell'app: entri col tuo account, leggi cosa potrà fare e tocchi
  **Consenti**. Sotto c'è scritto dove si torna dopo il tuo sì: deve essere claude.ai
  (o claude.com); se la pagina dice che il collegamento non viene da Claude, non si approva.
  Lo può fare solo chi ha l'amministrazione. Il collegamento si toglie da lì,
  dai Connettori di Claude.
- **Cosa può fare**: leggere voci, casse e i movimenti simili, e registrare un'entrata o
  un'uscita. Non annulla, non fa giroconti, non chiude la cassa.
- **Leggere i conti**: «quanto abbiamo speso di utenze quest'anno?», «ottobre rispetto a
  ottobre scorso», «il riepilogo dell'anno per il direttivo». I numeri sono quelli di
  **Bilancio**, per anno solare; un periodo in corso si confronta con lo stesso tratto dell'anno
  prima, e Claude dice se ci sono ancora spese da classificare che possono cambiare i totali.
  Gli incassi degli iscritti sono solo importi: Claude non vede i nomi.
- **Il saldo**: del Conto Corrente, secondo i conti, da confrontare con la banca. Della Cassa
  Contanti dice solo l'ultima chiusura e quanto si è contato, mai il previsto: la chiusura si
  conta alla cieca.
- **Le spese da classificare**: le uscite su «Da classificare», «Varie» o senza voce,
  raggruppate per descrizione, le più pesanti prima, con la voce proposta. La voce si cambia qui,
  da **Cambiare la voce**: Claude dice cosa cercare, la voce di partenza e il periodo **Tutto**.
- **Solo fornitori**: le foto le vede Claude, non l'app. I compensi degli istruttori si pagano
  da [COMPENSI](../segreteria/compensi.md#il-pagamento), che scrive qui il movimento; gli
  incassi degli iscritti dalla scheda della persona.
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

### I compensi dei tecnici

Un pagamento segnato in [COMPENSI](../segreteria/compensi.md#il-pagamento) è un'uscita
come le altre, con la voce di sistema **Compensi istruttori**, collegata al tecnico, e la
descrizione «Compenso · Nome Cognome · ott 2026». Se è sbagliato si **annulla** qui: le sue
ricevute tornano da pagare in COMPENSI e si ripagano da lì.

Se il bonifico al tecnico è già arrivato dall'importazione della banca (di solito Da
classificare), non serve scriverne un altro: in COMPENSI, **Segna pagato** lo propone in
FORSE È GIÀ IN BANCA, e scelto prende il tecnico e la voce Compensi istruttori, con la sua
descrizione della banca. Annullarlo qui rimette le ricevute da pagare, come sopra.

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

Il Conto Corrente non si conta: si confronta con l'estratto della banca (vedi sotto).

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

Una ricevuta con un pagamento in contanti di un giorno già chiuso non si fa (anche quella aperta da
REGISTRA IL PAGAMENTO), come il pagamento a mano: scegli una data dopo la chiusura, o annulla prima la
chiusura. Passa solo **FANNE LA RICEVUTA** su un pagamento a mano già registrato, i cui contanti sono
già nei conti di quel giorno. Se stai per annullare una ricevuta o un pagamento in contanti di un giorno
già chiuso, la domanda di conferma te lo dice prima, anche alla segreteria. Se dopo una chiusura qualcuno annulla una ricevuta o un pagamento in contanti di quei giorni,
compare un avviso rosso «La chiusura del … non è più in regola»: il foglio già stampato non torna
più coi conti, e la correzione è una rettifica con una data dopo la chiusura.

## Il conto con la banca

Ogni mese il **Conto Corrente** dell'app si confronta con l'estratto BancoPosta, così una
differenza si trova subito e non a fine anno. In **CASSE**, sotto le tessere, **IL CONTO CON LA
BANCA** mostra i mesi dell'anno (‹ › cambia anno), ognuno col suo stato:

- **✓ Verificato** o **✓ Torna**: il saldo dell'app a fine mese è quello della banca.
- **✕ e la differenza**: non torna. **✕ Cambiato dopo la verifica**: il mese era verificato, poi
  una riga del Conto Corrente di quel mese è cambiata (nuova, annullata, importo o data diversi), o
  il saldo finale del mese prima non è più il suo saldo iniziale.
- **… Saldo da scrivere**, **… CSV mancante**, **… Da classificare**: manca qualcosa per controllarlo.

I mesi rossi e gialli compaiono anche sulla tessera del Conto Corrente, i più recenti per primi. Un
mese senza saldo prima del primo saldo scritto non chiede niente, tranne l'ultimo mese finito.

**Scrivi il saldo dell'estratto**: copia i quattro numeri del riepilogo dell'estratto del mese,
**SALDO INIZIALE**, **SALDO FINALE**, **ENTRATE**, **USCITE** (con il meno davanti se il saldo è
sotto zero). Il saldo iniziale è già scritto col finale del mese prima, se c'è. I numeri devono
tornare fra loro (iniziale + entrate − uscite = finale) e il mese non può essere nel futuro: se
no, in rosso, «Il saldo non si può salvare così» con il motivo, e il saldo non si salva.
**Cambia il saldo dell'estratto** riscrive i quattro numeri: un mese verificato torna da verificare,
e anche il mese dopo, se non parte più dal nuovo saldo finale.

Scelto un mese, si vedono **NELL'APP** (il saldo del Conto Corrente all'ultimo giorno del mese),
**IN BANCA** e la **DIFFERENZA** (app meno banca). Sotto, le righe che la spiegano, confrontando i
movimenti dell'app con le righe della banca importate dal CSV (vedi **Importare dalla banca**):
due righe sono la stessa se hanno lo stesso importo e lo stesso verso entro due giorni.

- **DA DOVE VIENE LA DIFFERENZA**: quanto pesano le righe che mancano da una parte o dall'altra, un
  saldo iniziale diverso, le righe a cavallo col mese prima o dopo, e quel che resta non spiegato.
- **NELL'APP, NON IN BANCA**: di solito un pagamento in contanti scritto in Conto Corrente, o un
  doppione (l'app lo dice quando è forse un doppione Satispay). **Apri** porta al movimento.
- **IN BANCA, NON NELL'APP**: per esempio un versamento di contanti (forse un giroconto da scrivere)
  o una commissione di Poste. **Registra** porta a IMPORTAZIONI.
- **CON LA DATA DIVERSA**: la stessa riga con un giorno o due di differenza. Non mancano.
- **ABBINATE**: le righe che tornano, chiuse all'inizio.

Senza il CSV del mese l'app non sa quali righe ci sono in banca: lo dice, con **Importa**. Le righe
**«Da classificare»** del mese si vedono con **Vedi le righe** e vanno sistemate prima.

**Segna … come verificato** si può solo a mese finito, quando la differenza è zero, non ci sono
righe «Da classificare» e il saldo iniziale è il finale del mese prima. Resta scritto chi l'ha
verificato e quando.

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
