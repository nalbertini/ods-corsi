# Segreteria · Settimana

← [Torna alla segreteria](README.md)

La prima cosa che si vede entrando in segreteria: tutta la settimana in una
griglia, da lunedì a domenica, con una riga per ogni orario.

## Leggere la griglia

In ogni casella ci sono le lezioni che cominciano a quell'ora, con il colore
della disciplina, la sala e l'istruttore. Il numero in basso dice:

| Si vede | Significa |
|---|---|
| `8/9` in verde | presenti su iscritti: l'appello è fatto |
| `14/16` in grigio | iscritti su posti: l'appello non c'è ancora |
| **SENZA APPELLO** in rosso | la lezione è passata e nessuno ha segnato niente |
| **SOSTITUTO** | la fa un altro istruttore, solo quel giorno |
| **ANNULLATA** | non si è fatta |
| **✎ CAMBIATA A MANO** | l'attività di quella lezione è diversa da quella del giorno: non lo segue più |
| **STRAORDINARIA** | una lezione in più, fuori dall'orario |

In alto:

- le frecce spostano di una settimana, **OGGI** riporta a quella corrente;
- i tasti delle sale (**TUTTE**, **TATAMI**, …) fanno vedere una sala sola;
- sotto il titolo c'è scritto fino a che giorno è pronto il calendario, cioè
  fin dove ci sono le lezioni dell'orario (le straordinarie non contano).
  Il calendario si allunga da sé, anche quando si aggiunge un orario a un
  corso; per allungarlo subito c'è **RIGENERA ADESSO** in
  [Impostazioni](regole.md#il-calendario), che non duplica niente e non tocca
  le lezioni che hanno già un appello.

## Aprire una lezione

Un clic su una lezione apre il riquadro a destra. Ogni cambio si salva subito;
**FATTO** (o Esc) lo chiude, e così il tasto Indietro del browser: la griglia
resta sulla stessa settimana e sala. Le settimane sfogliate con le frecce non
contano: Indietro riporta alla voce di prima.

- **STATO**: **PREVISTA**, **SVOLTA** o **ANNULLATA**. Una lezione saltata va
  messa ANNULLATA: così non risulta un appello mancante e non pesa sulle medie. Prima di annullarla l'app chiede conferma, perché gli iscritti non vengono
  avvisati: vanno chiamati o scritti. Si rimette con PREVISTA.
- **ISTRUTTORE**: «Come da corso» o un altro nome. Scegliere un altro nome mette
  un **sostituto** solo per quella lezione; il corso resta com'è. Il sostituto
  vede la lezione nel suo calendario e fa l'appello.
- **ATTIVITÀ**: **Come il giorno** (con il nome), **Nessuna attività** o una
  dell'elenco di [Impostazioni](regole.md#le-attività). Con «Come il giorno»
  si legge **Si aggiorna da sola**: se il giorno cambia attività, cambia anche
  la lezione. Scegliere altro la segna **Cambiata a mano**, solo per quella
  lezione: il giorno resta com'è. **COME IL GIORNO** la riporta com'era. Anche
  l'istruttore della lezione può cambiarla, dall'appello sul telefono.
- **SALA**: per spostare quella lezione in un'altra sala. Se un giorno del
  corso si fa **sempre** in un'altra sala, si sceglie invece nei
  [corsi](corsi.md), accanto a quel giorno.
- **APPELLO**: lo stesso dell'app, per segnare al banco le presenze che
  l'istruttore ha preso su carta, o per correggere un errore.
  - Un clic: presente; due: assente; tre: non segnato.
  - **TUTTI PRESENTI** e **AZZERA** (che chiede conferma).
  - Si apre solo quando la lezione è **cominciata**: prima c'è scritto «Si segna
    quando la lezione è cominciata».
  - **PROVE**: per aggiungere chi è venuto a provare, come fanno gli istruttori
    dall'app (vedi la [guida degli istruttori](../istruttori.md)). Entra in
    fondo all'appello, presente, col bollino **PROVA**; **TOGLI** lo toglie.

## Lezione straordinaria

**+ LEZIONE STRAORDINARIA**, in alto a destra: una lezione in più, fuori dalle
ricorrenze — un recupero, un evento, una prova aperta.

1. Scegliere il **corso**, il **giorno**, l'**ora** e i **minuti**.
2. **AGGIUNGI**.

Gli iscritti del corso sono già nell'appello. Se era un errore, aprirla e
premere **TOGLI QUESTA LEZIONE STRAORDINARIA**.
