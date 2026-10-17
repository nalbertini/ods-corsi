# Amministrazione · Contabilità

← [Torna all'amministrazione](README.md)

Le entrate e le uscite della palestra, in due casse: **Cassa Contanti** e
**Conto Corrente**. La vede solo chi ha il ruolo di amministrazione: la segreteria
semplice, gli istruttori e il tablet no. Ha tre schede: **MOVIMENTI**, **VOCI**, **CASSE**.

## Movimenti

In cima, il **residuo** di ogni cassa e il **totale**: saldo iniziale, più le entrate,
meno le uscite.

L'elenco unisce due cose:

- gli **incassi degli iscritti**: le ricevute e i pagamenti a mano di
  [PAGAMENTI](pagamenti.md) entrano da soli, uno per pagamento, col segno
  **INCASSO ISCRITTO**. Non si ricopiano e non si cambiano da qui: se una ricevuta
  o un pagamento si annulla, cambia da sé anche qui. Contanti vanno in Cassa
  Contanti, tutto il resto (bonifico, POS, Satispay, assegno) in Conto Corrente.
  Il «pagato fino al» non è un incasso e qui non compare;
- i **movimenti che scrivi tu**: altre entrate (contributi, gare, attività
  fatturate) e le uscite.

Si cerca nella descrizione, si sceglie il periodo (il mese, il mese scorso, tutto
l'anno, tutto), si filtra per **ENTRATE**, **USCITE**, **GIROCONTI** e per cassa.
**RAGGRUPPA PER VOCE** dà i totali per voce; **ANNULLATI** mostra anche quelli
annullati. **ESPORTA CSV** è un foglio per Excel e per il commercialista, senza gli
annullati.

### Nuovo movimento

**NUOVO MOVIMENTO**: entrata o uscita, data, importo, cassa, **voce** (solo quelle
del tipo giusto, non quelle disattivate), descrizione e una nota se serve. Un solo
importo, senza IVA. La data non è nel futuro e non è prima del giorno da cui parte
la cassa. Niente dati personali che non servono, nella descrizione e nella nota.

Un movimento registrato **non si cambia**: toccandolo si apre, e si può **annullare**
(resta in elenco, annullato, e non si conta più) oppure correggere la descrizione e
la nota (di un giroconto, solo la nota). Per correggere importo, data, voce o
cassa si annulla e si rifà.

### Giroconto

**GIROCONTO** sposta soldi da una cassa all'altra, per esempio il versamento dei
contanti in banca: da Cassa Contanti a Conto Corrente. Non è un'entrata né
un'uscita: non entra nei totali, né nei totali per voce. Si annulla come un movimento.

### Rimborsi e errori in periodi passati

Un rimborso a un iscritto è un'uscita, con una voce tua. Un errore trovato dopo si
corregge annullando e rifacendo, oppure, se il giorno è già chiuso (vedi sotto), con un movimento
con una data dopo la chiusura e una voce «Rettifica» che crei tu.

## Voci

Le voci sono quelle che crei: ogni voce è **solo di entrata o solo di uscita**, con un
nome diverso dalle altre dello stesso tipo. Una voce usata non si cancella: si
**disattiva**, resta sui movimenti vecchi e non si offre per i nuovi; si **riattiva**
quando serve. Le due voci **SISTEMA** («Quota associativa» e «Corsi e altri
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
controlla che torni. In **CASSE**, **CHIUDI LA CASSA**:

1. Scegli **FINO AL** (di solito oggi). Il periodo parte dal giorno dopo l'ultima chiusura.
2. L'app dice **IN CASSA SECONDO I CONTI**: il saldo iniziale, i contanti incassati dagli
   iscritti, le entrate e le uscite scritte a mano, i versamenti in banca. Sotto, **COSA
   C'È DENTRO**: l'elenco dei movimenti in contanti del periodo, per vedere da dove viene il numero.
3. Scrivi i **CONTANTI CONTATI**, un solo totale. L'app dice la **DIFFERENZA**: «Tornano»,
   «in più» o «in meno». Una nota facoltativa dice perché. Se la differenza è sopra 20,00 €,
   chiede una conferma in più.
4. **CHIUDI LA CASSA**. Se i conti non tornano, la differenza si scrive da sola nei conti, come
   movimento «Differenza di cassa» di quel giorno (un'entrata se c'erano più soldi, un'uscita se meno),
   così a fine giorno «in cassa» è quanto hai contato. Non si sceglie a mano in NUOVO MOVIMENTO.

Il Conto Corrente non si conta: si confronta con l'estratto della banca.

**Dopo la chiusura quei giorni sono chiusi**: non si registrano né si annullano più movimenti con
quella data, e il saldo iniziale della cassa non cambia. La descrizione e la nota si possono ancora
correggere. Per correggere uno sbaglio di un giorno chiuso si scrive un movimento con una data
**dopo la chiusura** e una voce di rettifica (la crea chi cura i conti, in VOCI: per esempio
«Rettifica»). Se hai chiuso oggi, la prima data possibile è domani: se serve prima, si annulla la
chiusura (solo l'ultima). Anche un versamento in banca fatto dopo la chiusura va datato dopo la
chiusura.

Sotto le casse c'è l'elenco delle **chiusure**: chi ha chiuso e quando, quanto si è contato, la
differenza. **PDF** scarica il foglio da stampare e firmare (A4: l'associazione, il periodo, le cifre, i
movimenti in contanti senza i nomi degli iscritti, due righe per le firme). **ANNULLA** c'è solo
sull'ultima chiusura: toglie anche la sua «Differenza di cassa» e riapre i giorni; il foglio già
stampato non vale più. Una chiusura non si cambia: si annulla e si rifà.

Se dopo una chiusura qualcuno annulla una ricevuta o un pagamento in contanti di quei giorni,
compare un avviso rosso «La chiusura del … non è più in regola»: il foglio già stampato non torna
più coi conti, e la correzione è una rettifica con una data dopo la chiusura.

## Cosa non c'è

- L'IVA e la fattura elettronica: restano nel software a parte.
- Allegati di fatture e scontrini: la carta resta carta.
- Il rendiconto di fine anno e il collegamento al RASD.
- Il backup scaricato dalla segreteria contiene anche i conti, ma è cifrato: la
  password non è della segreteria.

Se compare «Il database non è ancora aggiornato per la contabilità» o «…per la chiusura
della cassa», manca un aggiornamento del database: va chiesto a chi cura l'app.
