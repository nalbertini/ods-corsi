# Segreteria · Tessere

← [Torna alla segreteria](README.md)

Chi è tesserato (FIJLKAM, FIPE…), di che tipo e fino a quando, e chi è iscritto a un corso
senza la tessera che quel corso chiede. Le tessere si leggono dal RASD; il tesseramento
non si fa qui.

## Quale tessera chiede un corso

In [CORSI](corsi.md), nei dati del corso, **TESSERA RICHIESTA**: l'ente, in maiuscolo
(**FIJLKAM**, **FIPE**), o vuoto se il corso non la chiede. Judo, Lotta, Aikido, MGA e
Avviamento chiedono FIJLKAM; i corsi della sala Pesi FIPE; psicomotricità, giocomotricità
e prepugilistica nessuna. Si cambia quando si vuole.

## Caricare il foglio del RASD

In IMPOSTAZIONI, **TESSERE DAL RASD**, in tre passi:

1. **IL FOGLIO** — dal RASD, tab Tesseramenti, salva il foglio come **CSV** (da Excel: *File → Salva con
   nome → CSV UTF-8*). Le colonne sono **Organismo, Persona, Codice fiscale, Tipo, Codice tess., Valido dal**,
   con `;` o `,` come separatore. **SCEGLI IL FOGLIO**, poi **CONTROLLA**.
2. **IL CONTROLLO** — non scrive niente. Dice quante tessere sono nuove, quante ci sono già e non
   cambiano, e quante righe restano fuori, ognuna col motivo. **METTI N TESSERE** le scrive.
3. **NELL'APP** — le trovi nella scheda di ogni persona, sotto **TESSERE**.

La persona si riconosce dal **codice fiscale e dallo stesso nome** (anche con accenti, apostrofi o
nome e cognome scambiati): se il codice fiscale c'è ma il nome è un altro, la riga non entra. L'import
**non crea nessuna persona**: chi non ha la scheda, o ha la scheda senza il codice fiscale, resta fuori. Si
scrive il codice fiscale nella scheda e si rifà il foglio. Si può rifare quante volte si vuole: non duplica niente.
La tessera vale fino al **31 dicembre** dell'anno di «Valido dal».

Le righe fuori sono di tre tipi: **nessuna scheda con questo codice fiscale**, **il codice
fiscale è di un'altra persona** (controlla il nome) e **la riga ha dei dati che non vanno**.

## La pagina TESSERE

Due elenchi, con i loro numeri:

- **SENZA TESSERA** — chi è iscritto oggi a un corso che chiede una tessera e **non ce l'ha**
  (**NO TESSERA**), ce l'ha **SCADUTA**, o scade entro 60 giorni (**TESSERA SCADE A DICEMBRE**,
  in giallo). Una tessera da dirigente o da tecnico non basta: serve quella da atleta (praticante
  o agonista). Una prova gratuita non è un'iscrizione.
- **TESSERATI SENZA CORSO** — chi ha una tessera da atleta che vale oggi e nessun corso. Può essere
  chi ha smesso e ha ancora la tessera dell'anno.

Un clic su una riga apre la scheda della persona.

## Dove si vede

- In [ISCRITTI](iscritti.md): la colonna **IN REGOLA** dice anche **NO TESSERA** o **TESSERA SCADUTA**,
  c'è il filtro **SENZA TESSERA**, e **NON IN REGOLA** li comprende.
- La striscia **COSA MANCA** ha la casella **TESSERE**, con il numero di chi non ha una tessera valida.
- La scheda della persona ha la sezione **TESSERE**.

Se il database non ha ancora le tessere, niente di tutto questo si vede e la pagina lo dice.
