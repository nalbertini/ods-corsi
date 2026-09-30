# Segreteria · Presenze istruttori

← [Torna alla segreteria](README.md)

Quando un istruttore mette il suo **PIN** sul [tablet di sala](../sala.md)
durante una lezione, gli si segna la presenza in quella lezione. «Durante» è
la stessa finestra in cui si segnano gli allievi: da mezz'ora prima
dell'inizio a dieci minuti dopo la fine.

- Se era **previsto** su quella lezione — insegna il corso, o è il sostituto
  messo nella [Settimana](settimana.md) — la presenza è **confermata da sola**.
- Se **non era previsto**, la presenza arriva qui, **da confermare**.

Nel menu, accanto a **PRESENZE ISTRUTTORI**, c'è quante ne aspettano.

## L'elenco

Per ogni presenza: l'**ISTRUTTORE**, la **LEZIONE** (corso, giorno e orario),
chi era **PREVISTO** su quella lezione, quando è **ENTRATO** e da quale tablet.

Normalmente si vedono solo quelle da confermare; **ANCHE QUELLE GIÀ GESTITE**
mostra anche le confermate e le rifiutate degli ultimi sessanta giorni, con
chi le ha decise (o **da sé: era previsto**).

## Decidere

- **CONFERMA** — l'istruttore c'era davvero: ha fatto lezione, o ha aiutato.
- **RIFIUTA** — non conta: era passato solo per fare l'appello di un collega,
  o ha sbagliato sala.

Ci si può ripensare: accanto a una presenza già gestita c'è **Rifiuta** o
**Conferma**, per cambiarla.

Se un istruttore fa spesso lezioni in cui non è previsto, forse va messo fra
gli istruttori del corso ([Corsi](corsi.md)) o come sostituto
([Settimana](settimana.md)): da lì in poi la sua presenza si conferma da sola.

## Da sapere

- Rimettere il PIN nella stessa lezione non la segna due volte.
- Con due lezioni aperte insieme (una che finisce, una che comincia) si
  segnano tutte e due, se sono sue; se non è previsto in nessuna, va da
  confermare quella in corso.
- Una presenza rifiutata resta rifiutata anche se l'istruttore rimette il PIN.
- Chi ha il ruolo **Segreteria** e mette il PIN in una lezione non sua non si
  segna: apre l'appello, non fa lezione. Chi ha tutti e due i ruoli
  (segreteria e istruttore) invece si segna come un istruttore.
- Col database, questa voce c'è dopo aver lanciato
  `supabase/15-presenze-istruttori.sql`. Prima dice che manca, e il tablet
  apre l'area istruttore come sempre, senza segnare niente.
