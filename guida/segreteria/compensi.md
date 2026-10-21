# Segreteria · Compensi

← [Torna alla segreteria](README.md)

Ogni mese ogni tecnico firma la sua ricevuta del compenso: l'autocertificazione
per i compensi sportivi e la liquidazione, su un foglio da stampare.

## Il compenso del mese

Per ogni corso, le **ore confermate** del mese per la **tariffa** di quel
tecnico in quel corso (si scrive nella sua scheda, in
[Istruttori e accessi](istruttori-e-accessi.md#le-tariffe)). Una lezione fatta
da sostituto si paga a chi c'era, con la sua tariffa per quel corso. Il netto
è uguale al lordo: INPS, IRPEF e addizionali escono a 0,00.

## La pagina

Si sceglie il **MESE** (di solito quello appena finito). C'è una riga per ogni
tecnico che ha lezioni nel mese, con le ore, il compenso e a che punto è:

- **PRESENZE DA CONFERMARE**: prima si decidono in
  [Presenze istruttori](presenze-istruttori.md), poi si fa la ricevuta;
- **SENZA TARIFFA**: un corso non ha la tariffa, si scrive nella scheda;
- **RICEVUTA DA FARE**: è pronta;
- **FATTA**: c'è, con la data e se il foglio firmato è tornato;
- **NON TORNA PIÙ**: dopo la ricevuta è cambiata una presenza e il mese ora fa
  un'altra cifra. **Annulla e rifai**.

**Per corso** apre il dettaglio: ore, tariffa e importo di ogni corso.

## Manca la firma

In una lezione tenuta in due, chi dimentica il PIN non ha la presenza e non
sarebbe pagato. Se un altro istruttore del corso ha firmato e lui no, accanto allo stato c'è il
segno giallo **MANCA LA FIRMA** e sotto la riga **MANCA LA SUA FIRMA**: corso,
giorno e ora, chi ha firmato. Per ogni lezione:

- **C'era**: la presenza è confermata e la lezione entra nel compenso, anche
  dopo le due settimane di [Presenze istruttori](presenze-istruttori.md);
- **Non c'era**: la presenza è segnata rifiutata e la firma non si chiede più.
  Se era uno sbaglio, la rifiutata si elimina in Presenze istruttori.

Non ferma la ricevuta: si fa lo stesso. Se la ricevuta è già fatta e poi si
segna **C'era**, la riga diventa **NON TORNA PIÙ**: si annulla e si rifà. Se è
già **PAGATA**, prima si annulla il pagamento in CONTABILITÀ, poi si rifà la
ricevuta del mese giusto e si ripaga. Chi nel mese ha solo lezioni senza la
sua firma c'è lo stesso, con **NIENTE DA PAGARE, PER ORA**. Il filtro **Manca
la firma** le raccoglie.

Nei corsi dove gli istruttori si alternano, in [Corsi](corsi.md) si spunta
**Si alternano: a lezione basta uno**: lì, se uno ha firmato, agli altri non
si chiede.

## Fare le ricevute

**Prepara e stampa le ricevute** fa in una volta tutte quelle da fare e le
scarica in un PDF solo, da stampare. Chi è fermo si salta, e l'app dice chi e
perché. Si può anche fare una ricevuta alla volta, dalla sua riga o dalla
scheda del tecnico, con **Prepara la ricevuta**.

Sulla ricevuta escono già scritti i dati del tecnico (nascita, residenza,
codice fiscale, IBAN), la mansione della sua
[lettera d'incarico](istruttori-e-accessi.md#la-lettera-dincarico) della
stagione, il compenso del mese, «Collegno» e la data di stampa. Le caselle
della mansione sono tre, ATLETA, ALLENATORE e ISTRUTTORE: una lettera con
un'altra qualifica la stampa barrata, dopo le tre. A mano restano
le caselle delle dichiarazioni, la firma e la data del pagamento. Senza codice
fiscale, residenza o IBAN nella scheda, la ricevuta non si fa.

**Modifica il compenso** serve quando il conto non basta (una lezione in più
non segnata, per esempio): si scrive l'importo e il **perché**, che è
obbligatorio. La ricevuta esce con quell'importo.

Quando il foglio firmato torna, si spunta **Firmata**. Il filtro **Da riportare
firmate** fa vedere chi lo deve ancora riportare.

Una ricevuta fatta non si cambia: **Annulla** la toglie (resta nel registro,
annullata) e se ne fa una nuova. **Ristampa** riscarica la stessa.

## Il pagamento

Chi cura anche la contabilità vede **Segna pagato** sulle ricevute fatte: si
apre il pannello del tecnico con le sue ricevute fatte e non pagate (anche di
mesi diversi, già spuntate), il **giorno del pagamento** e la **cassa**
(Conto Corrente per il bonifico, Cassa Contanti per i contanti). Sotto c'è il
riepilogo di quello che si scrive in CONTABILITÀ: un'uscita sola, con la voce
**Compensi istruttori**, il totale e la descrizione «Compenso · Nome Cognome ·
set, ott 2026». **Segna pagato** la scrive, e le ricevute diventano **PAGATA**
con la data.

Una ricevuta pagata non si annulla da qui: prima si annulla il pagamento in
[Contabilità](../amministrazione/contabilita.md) → MOVIMENTI, e le ricevute
tornano da pagare. Il filtro **Da pagare** fa vedere chi aspetta il bonifico.

Nella scheda del tecnico, **PRESO DA NOI NEL** dice quanto ha preso
quest'anno, contato dal giorno del pagamento.
