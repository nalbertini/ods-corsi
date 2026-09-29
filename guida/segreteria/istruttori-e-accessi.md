# Segreteria · Istruttori e accessi

← [Torna alla segreteria](README.md)

Chi entra nell'app e cosa può fare. Gli iscritti non sono qui: non hanno un
accesso.

## L'elenco

Per ogni persona: nome e corsi, **EMAIL**, **RUOLO**, **ACCESSO**, **PIN
TABLET**.

- **ACCESSO**:
  - **HA FATTO L'ACCESSO** — è entrata almeno una volta;
  - **NON ANCORA ENTRATO** — c'è in elenco ma non è mai entrata;
  - **SENZA ACCESSO** — l'accesso è stato tolto.
- Senza email (in rosso «nessuna email») una persona non può entrare.

## La scheda di una persona

Un clic su un nome apre la sua scheda a tutta pagina, al posto dell'elenco;
**ISTRUTTORI E ACCESSI** in alto torna all'elenco.

- **MODIFICA** — nome, cognome ed email. Chi è già entrato non cambia email da
  qui: è quella con cui fa l'accesso.
- **RUOLO** — **ISTRUTTORE** o **SEGRETERIA**: si cambia con un tocco.
- **ACCESSO** — com'è messa. Se non è mai entrata, **MANDA L'INVITO** le manda
  un'altra mail (l'invito non arrivato, scaduto o non spuntato). Chi è già
  entrato e ha perso la password la chiede da sé, dalla porta, con **PASSWORD
  DIMENTICATA?**.
- **PIN TABLET** — vedi sotto.
- **TOGLI L'ACCESSO** — la persona non entra più nell'app né nell'area
  istruttore del tablet; le presenze che ha segnato restano nel registro.
  **RIDAI L'ACCESSO** lo rimette.

## Il PIN del tablet

Quattro cifre, per l'**AREA ISTRUTTORE** del [tablet di sala](../sala.md).

Nella scheda, **IMPOSTA IL PIN** (o **CAMBIA IL PIN** se c'è già) → le quattro
cifre → **OK**. Due persone non possono avere lo stesso PIN. Il PIN lo cambia
solo la segreteria.

Messo sul tablet durante una lezione, il PIN segna anche la presenza
dell'istruttore: da sola se era previsto, se no da confermare in
[Presenze istruttori](presenze-istruttori.md).

## Le presenze del mese, per i compensi

In fondo alla scheda, **PRESENZE**: si sceglie il mese (gli ultimi dodici) e
si vede quante **LEZIONI** ha fatto e quante **ORE** (dall'orario delle
lezioni, coi decimali: 1,5 è un'ora e mezza), e il dettaglio per corso. Un
corso si apre per vedere i giorni.

Contano solo le presenze **confermate** — dal PIN sul tablet, da sole o dalla
[segreteria](presenze-istruttori.md). Se **DA CONFERMARE** è rosso, prima di
chiudere il mese vanno decise in **PRESENZE ISTRUTTORI**.

**SCARICA** dà il foglio Excel del mese: una riga per lezione, con data,
orario, ore, corso e sala.

## Aggiungere una persona

**+ AGGIUNGI UNA PERSONA** → nome, cognome, email, ruolo (**ISTRUTTORE** o
**SEGRETERIA**) → **AGGIUNGI**. Poi si apre la sua scheda.

Con **Manda subito l'invito per email** spuntato (lo è già), alla persona
arriva una mail con un link: lo apre, sceglie la sua password ed entra, nel
calendario se è istruttore, nella segreteria se è di segreteria. Il link scade
dopo un'ora: se scade, **MANDA L'INVITO** nella sua scheda ne manda un altro.

Perché le mail partano davvero, chi gestisce il database deve prima
pubblicare la funzione dell'invito e impostare il server di posta: i passi
sono in `supabase/LEGGIMI.md`, *L'invito per email*. In prova nessuna email
parte.

## Cosa può fare ogni ruolo

| | Istruttore | Segreteria |
|---|:-:|:-:|
| Vedere il calendario e fare l'appello, anche da sostituto | sì | sì |
| Aprire l'area istruttore del tablet col PIN | sì | sì |
| Annullare o chiudere le lezioni dei suoi corsi | sì | sì |
| Cambiare corsi, orari e sale | no | sì |
| Aggiungere e togliere iscritti | no | sì |
| Vedere il resoconto delle presenze e le impostazioni | no | sì |
