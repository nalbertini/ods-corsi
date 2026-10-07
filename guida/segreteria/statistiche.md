# Segreteria · Statistiche

← [Torna alla segreteria](README.md)

Come va la palestra, mese per mese: chi viene, quando, in quali corsi, chi
insegna quanto, quanto entra.

[Presenze](presenze.md) guarda un mese e le persone, per sapere chi
richiamare; qui si guardano più mesi insieme, in numeri. I conti sono gli
stessi: si contano solo le lezioni **con l'appello**, e i giustificati non
pesano né sopra né sotto. Una lezione passata senza appello non abbassa le
medie: si conta a parte.

## In alto

- il **periodo**: gli ultimi 3, 6 o 12 mesi, o **Da settembre**, l'inizio
  dell'anno sportivo. Si parte sempre dal primo del mese, così ogni colonna è
  un mese intero; il mese in corso è tratteggiato, perché non è finito;
- **Tutti i corsi**, o un corso solo: vale per tutto, tranne gli incassi;
- **SCARICA CSV** — una riga per lezione, con iscritti, presenti, assenti,
  giustificati e prove, da aprire con Excel.

## I quattro numeri

| | |
|---|---|
| **ISCRITTI OGGI** | chi oggi è iscritto ad almeno un corso, e quanti sono entrati e usciti nel periodo |
| **PRESENZE** | quante presenze in tutto, prove comprese, e la media a lezione |
| **SUGLI ISCRITTI** | la percentuale di presenti sugli iscritti, dove c'è l'appello |
| **PROVE → ISCRITTI** | di chi è venuto a provare nel periodo, quanti oggi sono iscritti |

## I riquadri

- **PRESENZE MESE PER MESE** — una colonna per mese. Col mouse sopra (o
  toccandola) dice le presenze, le prove, la media a lezione e la
  percentuale sugli iscritti.
- **ISCRITTI MESE PER MESE** — quanti erano iscritti a fine mese, e quanti
  sono entrati e usciti in quel mese. Chi è disattivato non conta.
- **QUANDO SI VIENE** — i giorni della settimana e le ore d'inizio delle
  lezioni: in ogni casella quanti vengono in media, più scura dove sono di
  più. Serve a vedere le ore piene e quelle vuote, prima di cambiare un
  orario. Un tocco su un'ora mette in cima i giorni più pieni a quell'ora;
  un tocco su un giorno mette a sinistra le sue ore più piene.
- **CORSI** — per ogni corso le lezioni con l'appello, quanti vengono in
  media, la percentuale sugli iscritti e **sui posti** (quando il corso ha i
  posti scritti, in [Corsi](corsi.md)), le prove, le annullate e quelle senza
  appello. Un tocco sul nome guarda solo quel corso.
- **ISTRUTTORI** — le lezioni svolte da ognuno, quante da sostituto, e quanti
  vengono in media. Una lezione di un corso con due istruttori conta per
  tutti e due.
- **IN REGOLA OGGI** — il certificato medico e il pagamento di chi è
  iscritto oggi; chi ha meno di 6 anni non ha l'obbligo del certificato e non
  si conta. **CHI NON È IN REGOLA** apre [Iscritti](iscritti.md) già filtrato su chi ha il certificato o la quota da sistemare.
- **PROVE MESE PER MESE** — quante persone sono venute a provare, ognuna
  contata una volta, nel mese della sua prima prova (chi fa la settimana di
  prova non conta tre volte). Col mouse sopra dice anche le lezioni di prova
  del mese e quanti di loro oggi sono iscritti.
- **INCASSI MESE PER MESE** — quanto è stato pagato con le
  [ricevute](iscritti.md) del mese, per la data della ricevuta, senza le
  annullate. È di tutti i corsi insieme: una ricevuta può averne più d'uno.

Col database vero le statistiche vogliono `supabase/22-statistiche.sql`:
finché non c'è, la pagina dice che va lanciato.
