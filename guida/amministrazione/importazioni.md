# Amministrazione · Importazioni

← [Torna all'amministrazione](README.md)

Quello che arriva da **Satispay** e dalla **banca**, in una pagina sola: da dove, quando,
chi ha pagato con Satispay e cosa è entrato dalla banca. È nel menu, in **I CONTI**, dopo
**Contabilità**, per chi vede la contabilità.

## Le fonti

Accanto al titolo, **Importa** apre l'importazione dal file della banca, la stessa di MOVIMENTI
(vedi [Importare dalla banca](contabilita.md#importare-dalla-banca)). Sotto, una tabella con una
riga per fonte e tre colonne: **FONTE**, **STATO** e **ULTIMO ARRIVO**.

- **Banca** (BancoPosta · Conto Corrente): **Aggiornata**, o **Mai importata** se non c'è ancora
  un file; l'ultimo arrivo dice quando e quanti movimenti. **Visualizza i movimenti** apre il
  riepilogo del mese dell'ultimo file importato.
- **Satispay**: **Acceso**, **Spento** o **Non riuscito** se l'ultimo scarico si è fermato
  (sotto, cosa è successo); l'ultimo arrivo dice quando è stato l'ultimo scarico. I pagamenti
  Satispay non entrano in contabilità: i soldi arrivano in banca col versamento «Da Satispay
  Europe S.A.» (vedi [Satispay](contabilita.md#satispay)). **Visualizza chi ha pagato** apre
  l'elenco del mese dell'ultimo scarico; **Scarica ora** fa subito lo scarico (la prima volta c'è invece
  l'anteprima, **Guarda il primo scarico**). Con Satispay spento in **REGOLE → COME SI PAGA**
  lo scarico è fermo, di notte e a mano: lo stato è **Spento**, **Riaccendi in Regole ›** porta
  lì, **Scarica ora** non c'è e **Visualizza chi ha pagato** mostra quel che era già stato
  scaricato. Riaccendendo, lo scarico riparte da dove si era fermato.

## Da classificare

Sotto le fonti c'è l'elenco di tutto quel che è già in contabilità ma sulla voce
**Da classificare**: movimenti importati dalla banca, uscite e commissioni, movimenti
scritti a mano e lo storico importato (e i pagamenti Satispay scritti prima che lo scarico
smettesse di scrivere movimenti). Sono le stesse righe di
MOVIMENTI con quella voce, dalla più vecchia. Le entrate sono col **+** e verdi, le uscite
col **−** e rosse.

I tasti sopra l'elenco (**Tutte**, **Satispay**, **Banca**, **A mano**, **Storico**) lo
restringono per origine. Si vedono le prime 20 voci: **Mostra altre** ne aggiunge altre
20. In fondo, il totale delle entrate e delle uscite di tutto l'elenco, non solo di
quelle che si vedono.

**Classifica** apre il movimento in MOVIMENTI, dove si sceglie la voce vera. Se l'app riconosce la voce o la persona, le propone in un riquadro giallo e le scrive solo quando tocchi **Conferma** (vedi «Cambiare la voce» in CONTABILITÀ). Non c'è un
tasto «fatto»: una voce esce dall'elenco da sola quando la classifichi, e così anche
se la annulli.

## Chi ha pagato

Si apre con **Visualizza chi ha pagato**. L'elenco dei pagamenti Satispay di un mese, e a chi sono stati riconosciuti. È in sola
lettura: i soldi sono già nei versamenti della banca, qui non si scrive niente.

In cima tre numeri: **Pagato con Satispay** (i pagamenti del mese, meno i rimborsi),
**Riconosciuti** (quanti su tutti) e **Non riconosciuti**. **Cerca** trova per nome,
cognome o importo; **Solo non riconosciuti** lascia solo quelli senza un nome.

Una riga per pagamento: il giorno, chi ha pagato su Satispay, l'importo e come è
riconosciuto:

- **In una ricevuta**, col numero e la persona;
- **Nei pagamenti**, una riga di PAGAMENTI col metodo Satispay, lo stesso giorno e
  importo;
- **Dal modulo**, se è l'iscrizione online;
- **Collegato a mano**, se prima era stato collegato a un movimento a mano;
- **Non riconosciuto**, in giallo: nessuna ricevuta né pagamento lo dice. Se è una quota,
  scrivila in PAGAMENTI col metodo Satispay.

I rimborsi sono in rosso, col **−**: escono dal versamento, non dai conti.

**Non è questo** c'è solo sui pagamenti collegati a mano, fuori dai giorni con la cassa
chiusa: toglie il collegamento, il movimento a mano resta com'era e il pagamento resta
nel versamento della banca.

## I movimenti della banca

Si apre con **Visualizza i movimenti**. Il riepilogo di un mese dalla banca: due numeri, **Importati nuovi** (scritti dal file) e
**Già scritti a mano** (abbinati a un movimento già scritto, entrate o uscite, o a una
ricevuta o a un pagamento a mano in bonifico o POS), poi una riga per movimento.

**Non è questo**, su una riga abbinata a un movimento a mano, a una ricevuta o a un
pagamento a mano, toglie l'abbinamento: il movimento della banca entra come un import
normale, nel Conto Corrente, da classificare, e quello a mano (o la ricevuta) resta com'era. Nei giorni in cui la cassa è già chiusa **Non è questo**
non c'è: l'abbinamento è già nei conti di quella chiusura.
