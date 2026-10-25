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

Si sceglie il **MESE** (di solito quello appena finito). Accanto, il
riepilogo: quanti tecnici, quanti fermi, quanto c'è da pagare e quanto è già
pagato. Sotto, una tabella sola, coi tecnici in gruppi nell'ordine in cui si
lavora:

- **DA SISTEMARE PRIMA**: finché non sono a posto la ricevuta non si fa.
  Nelle note il perché: **DA CONFERMARE** (le presenze si decidono in
  [Presenze istruttori](presenze-istruttori.md)), una **tariffa** che manca
  (✕ nella colonna TARIFFA), i **dati** che mancano (✕ nella colonna IBAN, o
  scritti nelle note), **NON TORNA PIÙ** (dopo la ricevuta è cambiata una
  presenza: si apre il tecnico e **Annulla e rifai**). **Gestisci** porta dove
  si sistema;
- **DA FARE**: la ricevuta è pronta;
- **DA FAR FIRMARE**: fatta e consegnata, aspetta il foglio firmato;
- **DA PAGARE**: firmata, aspetta il pagamento;
- **PAGATE**: chiuso, si apre per ristampare.

Ogni riga dice corsi, lezioni, ore, tariffa, importo, se c'è l'IBAN e a che
punto è la ricevuta, e ha un tasto solo: quello che serve adesso. Il **nome**
del tecnico apre la sua finestra, con tutto il resto: i tasti della ricevuta
(prepararla, **Modifica il compenso**, **Annulla**), le sue extra, il conto
**Per corso** (ore, tariffa e importo di ogni corso, e il totale) e **Apri la
scheda**.

Su uno schermo stretto la riga si stringe: nome e importo in alto, sotto le
note, lezioni e ore, e il tasto.

## Manca la firma

In una lezione tenuta in due, chi dimentica il PIN non ha la presenza e non
sarebbe pagato. Se un altro istruttore del corso ha firmato e lui no, la
lezione va in fondo alla pagina, in **ASPETTANO UNA FIRMA**: una riga per
lezione, col tecnico, il corso, giorno e ora, chi ha firmato. Nelle note del
tecnico, più su, c'è quante ne aspetta. Per ogni lezione:

- **C'era**: la presenza è confermata e la lezione entra nel compenso, anche
  dopo le due settimane di [Presenze istruttori](presenze-istruttori.md);
- **Non c'era**: la presenza è segnata rifiutata e la firma non si chiede più.
  Se era uno sbaglio, la rifiutata si elimina in Presenze istruttori.

Non ferma la ricevuta: si fa lo stesso. Se la ricevuta è già fatta e poi si
segna **C'era**, la riga diventa **NON TORNA PIÙ**: si annulla e si rifà. Se è
già **PAGATA**, prima si annulla il pagamento in CONTABILITÀ, poi si rifà la
ricevuta del mese giusto e si ripaga. Chi nel mese ha solo lezioni senza la
sua firma sta solo in ASPETTANO UNA FIRMA. La pastiglia **Manca la firma**, in
alto, fa vedere solo quelle.

Nei corsi dove gli istruttori si alternano, in [Corsi](corsi.md) si spunta
**Si alternano: a lezione basta uno**: lì, se uno ha firmato, agli altri non
si chiede.

## Fare le ricevute

**Prepara le ricevute**, in testa a DA FARE, fa in una volta tutte quelle da
fare e le scarica in un PDF solo, da stampare. Chi è fermo si salta, e l'app
dice chi e perché. Si può anche fare una ricevuta alla volta: **Prepara la
ricevuta** sulla riga apre il tecnico, e lì si prepara (o si cambia prima il
compenso). Anche dalla scheda del tecnico.

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

Quando il foglio firmato torna, **Segna firmata** sulla riga, e il tecnico
passa a DA PAGARE. Chi lo deve ancora riportare sta in DA FAR FIRMARE.

Una ricevuta fatta non si cambia: **Annulla** la toglie (resta nel registro,
annullata) e se ne fa una nuova. **Ristampa** riscarica la stessa.

## Il compenso extra

Per un lavoro che non sta nelle lezioni (uno stage, un arbitraggio, un
evento) si fa una **ricevuta a parte**, oltre a quella del mese. **+ Compenso
extra**, in alto, apre il dialogo: si sceglie il **tecnico** (anche chi nel
mese non ha lezioni), il **mese** in cui lo si paga (propone quello in corso, anche per un lavoro
di un mese prima), si scrive **per cosa**
(da 3 a 200 caratteri, si legge così sulla ricevuta) e l'**importo**. Dalla
finestra di un tecnico c'è **+ Compenso extra** col tecnico già scelto. **Fai e stampa la ricevuta** la salva e scarica il PDF:
lo stesso modello di quella del mese, con «per cosa» al posto delle lezioni e
la mansione della ricevuta del mese (senza, si barra a mano). Come per il
mese, senza codice fiscale, residenza o IBAN non si fa.

Nello stesso mese se ne possono fare quante servono: stanno sotto la riga del
tecnico, con «↳ per cosa» e il segno **EXTRA**. Chi nel mese ha solo extra
c'è lo stesso, con **SOLO EXTRA**. Si segnano firmate, si ristampano e si
pagano come quella del mese, dalla loro riga; il loro nome le apre per
cambiarle. Finché non è pagata, **Modifica** cambia per cosa
e quanto (e la ricevuta torna da firmare: si ristampa e si rifà firmare), e
**Annulla** la toglie (resta nel registro, annullata). La pastiglia
**Extra**, in alto, fa vedere solo i tecnici che ne hanno.

## Il pagamento

Chi cura anche la contabilità vede **Segna pagato** sulle ricevute firmate: si
apre il pannello del tecnico con le sue ricevute fatte e non pagate (anche di
mesi diversi, già spuntate), il **giorno del pagamento** e la **cassa**
(Conto Corrente per il bonifico, Cassa Contanti per i contanti). Sotto c'è il
riepilogo di quello che si scrive in CONTABILITÀ: un'uscita sola, con la voce
**Compensi istruttori**, il totale e la descrizione «Compenso · Nome Cognome ·
set, ott 2026»; un'extra ci aggiunge il suo «per cosa». **Segna pagato** la scrive, e le ricevute diventano **PAGATA**
con la data.

Una ricevuta pagata non si annulla da qui: prima si annulla il pagamento in
[Contabilità](../amministrazione/contabilita.md) → MOVIMENTI, e le ricevute
tornano da pagare. Chi aspetta il bonifico sta in DA PAGARE.

Nella scheda del tecnico, **PRESO DA NOI NEL** dice quanto ha preso
quest'anno, contato dal giorno del pagamento.
