# Segreteria · Presenze istruttori

← [Torna alla segreteria](README.md)

Un istruttore c'era quando:

- mette il suo **PIN** sul [tablet di sala](../sala.md) durante una lezione.
  «Durante» è la stessa finestra in cui si segnano gli allievi: da mezz'ora
  prima dell'inizio a dieci minuti dopo la fine;
- oppure **fa l'appello** di una lezione, dall'app o dal tablet col PIN,
  anche a lezione finita.

Se era **previsto** su quella lezione — insegna il corso, o è il sostituto
messo nella [Settimana](settimana.md) — la presenza è **confermata da sola**.
Se **non era previsto**, la presenza arriva qui, **da confermare**. La
segreteria che fa l'appello dal banco non si segna.

Nel menu, accanto a **PRESENZE ISTRUTTORI**, c'è quante cose aspettano: le
presenze da confermare e le lezioni tenute senza l'istruttore segnato.

## Le lezioni tenute senza l'istruttore segnato

Una lezione finita, non annullata, con almeno un **presente**, in cui nessun
istruttore ha messo il PIN o fatto l'appello, arriva qui, in cima, sotto
**LEZIONI TENUTE SENZA L'ISTRUTTORE SEGNATO**. Per ognuna: corso, giorno,
orario, sala, quanti presenti, e chi doveva farla. Basta un istruttore
segnato, anche uno non previsto, e la lezione non arriva qui: se la Lotta la
tengono in due e uno si è segnato, l'altro non si chiede.

- **Un istruttore solo previsto**: **CONFERMA** se c'era, **NON C'ERA** se
  no.
- **Più istruttori** (la Lotta in due, la Preparazione atletica in tre): si
  spuntano quelli che c'erano e si preme **CONFERMA I SCELTI**; senza
  spuntare nessuno il tasto dice **NESSUNO C'ERA**.

Chi è scelto ha la presenza confermata, gli altri previsti rifiutata, e la
lezione esce dall'elenco. Ci si può ripensare dall'elenco qui sotto, con
**Conferma** o **Rifiuta**.

Si propongono solo le lezioni da quando c'è questa funzione, non quelle di
prima.

## L'elenco

Per ogni presenza: l'**ISTRUTTORE**, la **LEZIONE** (corso, giorno e orario),
chi era **PREVISTO** su quella lezione, e **ENTRATO**: quando e da quale
tablet, «ha fatto l'appello», «segnata da … nell'appello» (un collega l'ha
segnato dall'appello del telefono: è confermata da sola), o «scelto in
segreteria».

Sotto **PREVISTO**, se uno dei previsti non ha una presenza su quella lezione,
c'è **+ Nome c'era**: un tocco e risulta presente, confermato dalla
segreteria. Serve quando la lezione la fanno in due, uno si è segnato e
l'altro no: la lezione è coperta e non arriva fra quelle senza istruttore.
Compare solo sulle lezioni delle ultime due settimane.

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
un A4 col logo, i numeri e il dettaglio, per capire com'è andato il mese o l'anno.
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
