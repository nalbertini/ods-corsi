# Amministrazione · Importazioni

← [Torna all'amministrazione](README.md)

Quello che arriva da **Satispay** e dalla **banca**, in una pagina sola: da dove, quando,
cosa resta da decidere e cosa è entrato. È nel menu, in **I CONTI**, dopo **Contabilità**,
per chi vede la contabilità.

## Le fonti

In cima, un riquadro per fonte:

- **Satispay**: quando è stato l'ultimo scarico e quanti pagamenti sono da decidere.
  **Scarica ora** lo fa subito (la prima volta c'è invece l'anteprima, vedi
  [Lo scarico da Satispay](contabilita.md#lo-scarico-da-satispay)).
- **Banca · BancoPosta**: l'ultimo file importato, quando e quanti movimenti.
  **Importa un file** apre l'importazione dal file della banca, la stessa di MOVIMENTI
  (vedi [Importare dalla banca](contabilita.md#importare-dalla-banca)).

**Cosa è entrato**, in ogni riquadro, apre il riepilogo del mese di quella fonte.

## Da decidere

Sotto le fonti ci sono i pagamenti Satispay che lo scarico non ha potuto scrivere da
solo. Finché non decidi, non entrano in contabilità.

I pagamenti uguali (stesso giorno, stesso importo, stesso motivo) stanno **in un gruppo
solo**, e si decidono insieme con **una conferma**:

- **Forse già scritti a mano**: quel giorno ci sono movimenti a mano con lo stesso
  importo. Il gruppo li mostra una volta sola, e per ogni pagamento scegli il movimento
  che è già quel pagamento, oppure **Incasso nuovo** (per i rimborsi, **Rimborso nuovo**). Il movimento col **nome simile** a
  chi ha pagato su Satispay va per primo, segnato **NOME SIMILE**: è un indizio, non
  una scelta, e niente è scelto da solo. Un movimento scelto per un pagamento non si
  può scegliere per un altro: sotto il pagamento c'è scritto di chi è già. Sotto, il riepilogo dice cosa succede: chi si collega a
  cosa (e se il nome non somiglia, ti chiede di controllare) e quanti incassi nuovi
  entrano. **Conferma** si accende quando hai scelto per tutti. Collegare non cambia il
  movimento a mano: resta con la sua persona e la sua voce, e prende il segno
  DA SATISPAY.
- **Cassa già chiusa quel giorno**: per tutto il gruppo, **Registrali oggi** (con la
  data di oggi) o **Lasciali fuori**.

Se una scelta non si può fare (per esempio la cassa è stata chiusa nel frattempo), non
si fa niente del gruppo: o tutto o niente. Un incasso nuovo scritto per sbaglio si
annulla da MOVIMENTI, come ogni movimento.

In MOVIMENTI resta solo un avviso breve, con **Vai a Importazioni**. Nel menu, accanto a
**Importazioni**, il numero dice quanti pagamenti sono da decidere.

## Da classificare

Sotto **Da decidere** c'è l'elenco di tutto quel che è già in contabilità ma sulla voce
**Da classificare**: Satispay scaricato da solo, movimenti importati dalla banca, uscite e
commissioni, movimenti scritti a mano e lo storico importato. Sono le stesse righe di
MOVIMENTI con quella voce, dalla più vecchia. Le entrate sono col **+** e verdi, le uscite
col **−** e rosse.

I tasti sopra l'elenco (**Tutte**, **Satispay**, **Banca**, **A mano**, **Storico**) lo
restringono per origine. Si vedono le prime 20 voci: **Mostra altre** ne aggiunge altre
20. In fondo, il totale delle entrate e delle uscite di tutto l'elenco, non solo di
quelle che si vedono.

**Classifica** apre il movimento in MOVIMENTI, dove si sceglie la voce vera. Non c'è un
tasto «fatto»: una voce esce dall'elenco da sola quando la classifichi, e così anche
se la annulli.

## Cosa è entrato

Il riepilogo di un mese, per fonte (**Satispay** o **Banca**) e per mese.

**Satispay**: tre numeri, **Entrato da Satispay** (quel che è in contabilità), **Secondo
Satispay** (tutti i pagamenti del mese, incassi meno rimborsi: a mese deciso tornano) e
**Di cui già a mano**. Poi una riga per pagamento: il giorno, il movimento, come è
entrato (**Incasso nuovo** o **Rimborso nuovo**, **Collegato a Satispay**, dal modulo o dagli incassi degli
iscritti), la voce e l'importo.

**Banca**: due numeri, **Importati nuovi** (scritti dal file) e **Già scritti a mano**
(abbinati a un movimento già scritto, entrate o uscite), poi una riga per movimento.
Un movimento a mano abbinato alla banca non si collega più a un pagamento Satispay, e
viceversa: lo stesso soldo non si conta due volte.

**Non è questo**, su una riga collegata a un movimento a mano, toglie il collegamento:

- per Satispay il pagamento torna **da decidere**, e il movimento a mano resta com'era;
- per la banca il movimento della banca entra come un import normale, nel Conto
  Corrente, da classificare.

Nei giorni in cui la cassa è già chiusa **Non è questo** non c'è: il collegamento è già
nei conti di quella chiusura.
