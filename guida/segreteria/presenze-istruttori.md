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

Si vedono tutte, **confermate** e **da confermare** (e le rifiutate, in
grigio), dalla lezione più recente, con chi le ha decise (o **da sé: era
previsto**). In cima quattro filtri:

- **Periodo** — un mese (normalmente quello in corso), un **anno** intero
  (quest'anno o quello prima), o gli **ultimi dodici mesi**.
- **Corso** e **Istruttore** — solo quelli che nel mese scelto ci sono.
- **Stato** — **Da confermare**, **Confermate** o **Rifiutate**.

Sopra l'elenco si legge quante ce ne sono, confermate e da confermare. Se
qualcuna da confermare è in un altro mese, lo dice, e **vedile tutte** le fa
vedere, di tutti i mesi.

**SCARICA CSV** scarica l'elenco così come si vede, coi filtri, in un foglio
da aprire con Excel: giorno, orario e ore della lezione, istruttore, corso, chi
era previsto, sala, quando è entrato, stato e chi l'ha decisa.

## Il report PDF

**REPORT PDF** scarica il report del periodo scelto, da stampare o da tenere:
un A4 con i numeri e il dettaglio, per capire com'è andato il mese o l'anno.
Tiene conto del corso e dell'istruttore scelti, non dello stato: le
statistiche contano sempre confermate, da confermare e rifiutate.

- **I numeri**: lezioni e ore confermate (dall'orario delle lezioni: sono
  quelle da pagare), quanti istruttori su quanti corsi, quante da confermare.
  Sotto, la media di ore per istruttore e di minuti a lezione, quante lezioni
  confermate erano **fuori programma** (l'istruttore non era previsto) e
  quante presenze sono state rifiutate.
- **Per istruttore**: lezioni, ore e la loro parte sul totale, corsi, fuori
  programma, da confermare e rifiutate.
- **Per corso**: lezioni, ore, la parte sul totale e chi li ha fatti.
- **Mese per mese**, se il periodo è un anno o gli ultimi dodici mesi.
- **Per giorno della settimana**: dove si concentrano le ore.
- **Il dettaglio**: ogni lezione di ogni istruttore, con giorno, orario, ore,
  corso, sala e stato.

Prima di chiudere il mese conviene decidere quelle da confermare: il report
le conta a parte, in rosso.

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
