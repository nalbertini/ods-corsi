# Segreteria · Settimana

← [Torna alla segreteria](README.md)

La prima cosa che si vede entrando in segreteria: tutta la settimana in una
griglia, da lunedì a domenica, con una fascia per ogni orario, separata dalla successiva da una linea.

## Leggere la griglia

In ogni casella ci sono le lezioni che cominciano a quell'ora, ognuna con il suo
orario (es. 17:00–18:00), il colore della disciplina, la sala e l'istruttore. Il numero in basso dice:

| Si vede | Significa |
|---|---|
| `8/9` in verde | presenti su iscritti: l'appello è fatto |
| `14/16` in grigio | iscritti su posti: l'appello non c'è ancora |
| **✕ Senza appello** in rosso | la lezione è passata e nessuno ha segnato niente |
| **✓ Appello fatto** in verde | la lezione è passata e l'appello c'è |
| **… Manca l'istruttore** | la lezione non ha ancora un istruttore: si assegna in CORSI |
| **Sostituto** | la fa un altro istruttore, solo quel giorno |
| **Annullata** | non si è fatta |
| **✎ CAMBIATA A MANO** | l'attività di quella lezione è diversa da quella del giorno: non lo segue più |
| **Straordinaria** | una lezione in più, fuori dall'orario |

Una **gara** sta in una riga sua, **GARE**, sotto i giorni: prende i giorni che
dura, col luogo e quanti atleti. Toccandola si apre in [GARE](gare.md). Le
lezioni di quei giorni restano: se una va annullata per la gara, si annulla
come sempre. Sul telefono la gara sta in cima al suo giorno.

Sabato e domenica, se quella settimana non hanno lezioni, si stringono a una
colonna sottile con solo il giorno: la griglia lascia il posto agli altri.
Se una lezione c'è (anche annullata), il giorno resta largo.

In alto:

- le frecce spostano di una settimana, **Oggi** riporta a quella corrente;
- le **date** (es. «12 – 18 OTTOBRE», col ▾) sono un tasto: aprono un **calendario** del mese,
  con la settimana che si vede evidenziata e oggi in giallo. Un tocco su un giorno porta alla
  sua settimana (sul telefono, a quel giorno) e chiude il calendario; le frecce del calendario
  cambiano solo il mese che si guarda. Un quadratino blu sotto un giorno dice che ha lezioni
  (anche annullate, e di **qualunque sala**, anche se in griglia ne hai scelta una); se non c'è,
  può essere che non si sia ancora letto: non vuol dire che non ce ne siano. Scegliere un
  giorno non aggiunge un passo per Indietro. **Oggi** nel calendario porta alla settimana di oggi. Si
  chiude con **Esc**, con un tocco fuori o ritoccando le date. Dopo la data fino a cui il
  calendario ha le lezioni lo dice sotto il mese;
- i tasti delle sale (**Tutte**, **Tatami**, …) fanno vedere una sala sola;
- sotto il titolo c'è scritto fino a che giorno è pronto il calendario, cioè
  fin dove ci sono le lezioni dell'orario (le straordinarie non contano).
  Il calendario si allunga da sé, anche quando si aggiunge un orario a un
  corso; per allungarlo subito c'è **Rigenera adesso** in
  [Impostazioni](regole.md#il-calendario), che non duplica niente e non tocca
  le lezioni che hanno già un appello.

## Aprire una lezione

Un clic su una lezione apre il riquadro a destra. Ogni cambio si salva subito;
**Fatto** (o Esc) lo chiude, e così il tasto Indietro del browser: la griglia
resta sulla stessa settimana e sala. Le settimane sfogliate con le frecce non
contano: Indietro riporta alla voce di prima.

- **STATO**: **Prevista**, **Svolta** o **Annullata**. Una lezione saltata va
  messa ANNULLATA: così non risulta un appello mancante e non pesa sulle medie. Prima di annullarla l'app chiede conferma, perché gli iscritti non vengono
  avvisati: vanno chiamati o scritti. Si rimette con PREVISTA.
- **ISTRUTTORE**: «Come da corso» o un altro nome. Scegliere un altro nome mette
  un **sostituto** solo per quella lezione; il corso resta com'è. Il sostituto
  vede la lezione nel suo calendario e fa l'appello.
- **ATTIVITÀ**: **Come il giorno** (con il nome), **Nessuna attività** o una
  dell'elenco di [Impostazioni](regole.md#le-attività). Con «Come il giorno»
  si legge **Si aggiorna da sola**: se il giorno cambia attività, cambia anche
  la lezione. Scegliere altro la segna **Cambiata a mano**, solo per quella
  lezione: il giorno resta com'è. **Come il giorno** la riporta com'era. Anche
  l'istruttore della lezione può cambiarla, dall'appello sul telefono.
- **SALA**: per spostare quella lezione in un'altra sala. Se un giorno del
  corso si fa **sempre** in un'altra sala, si sceglie invece nei
  [corsi](corsi.md), accanto a quel giorno.
- **APPELLO**: per segnare al banco le presenze che l'istruttore ha preso su
  carta, o per correggere un errore. Sotto i conti ci sono tre tasti, **DA
  SEGNARE**, **PRESENTI** e **ASSENTI**, ognuno col suo numero: sotto si vede
  la lista di quello premuto, intera, e si apre su DA SEGNARE (se non manca
  nessuno, su PRESENTI).
  - In **DA SEGNARE** ogni nome ha **✓** (presente) e **✕** (assente): il nome
    passa nell'altra lista e il cursore va al nome dopo, così si segna in fila.
    Il tasto premuto non cambia da solo, nemmeno quando DA SEGNARE si svuota.
  - In **PRESENTI** e **ASSENTI** un tocco sul nome lo rimette da segnare. Un
    giustificato sta fra gli assenti, con la scritta GIUSTIFICATO; per toglierlo
    da lì chiede conferma, perché la giustifica è un'informazione che qualcuno ha messo.
  - **Tutti presenti** segna presenti solo chi non è ancora segnato: le assenze
    già messe restano. **Azzera** toglie tutti i segni, chiede conferma e riporta su DA SEGNARE.
  - Si apre solo quando la lezione è **cominciata**: prima c'è scritto «Si segna
    quando la lezione è cominciata».
  - **Prove**: per aggiungere chi è venuto a provare, come fanno gli istruttori
    dall'app (vedi la [guida degli istruttori](../istruttori.md)). Entra in
    fondo all'appello, presente, col bollino **PROVA**; un tocco sul nome lo gira
    fra presente e assente, **Togli** lo toglie. Le prove non sono nei tre tasti.

## Lezione straordinaria

**+ Lezione straordinaria**, in alto a destra: una lezione in più, fuori dalle
ricorrenze — un recupero, un evento, una prova aperta.

1. Scegliere il **corso**, il **giorno**, l'**ora** e i **minuti**.
2. **Aggiungi**.

Gli iscritti del corso sono già nell'appello. Se era un errore, aprirla e
premere **Togli questa lezione straordinaria**.
