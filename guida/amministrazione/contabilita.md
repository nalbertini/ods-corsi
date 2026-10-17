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
corregge annullando e rifacendo, oppure con un movimento di oggi con una voce
«Rettifica» che crei tu.

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

La chiusura della cassa, col contato e la differenza, e la stampa in PDF
arrivano nella parte dopo.

## Cosa non c'è

- L'IVA e la fattura elettronica: restano nel software a parte.
- Allegati di fatture e scontrini: la carta resta carta.
- Il rendiconto di fine anno e il collegamento al RASD.
- Il backup scaricato dalla segreteria contiene anche i conti, ma è cifrato: la
  password non è della segreteria.

Se compare «Il database non è ancora aggiornato per la contabilità», manca un
aggiornamento del database: va chiesto a chi cura l'app.
