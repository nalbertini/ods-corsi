# Segreteria · Istruttori e accessi

← [Torna alla segreteria](README.md)

Chi entra nell'app e cosa può fare. Gli iscritti non sono qui: non hanno un
accesso.

## L'elenco

Per ogni persona: nome e corsi, **EMAIL**, **RUOLO**, **ACCESSO**, **PIN
TABLET**.

- **RUOLO**: **Istruttore** o **Segreteria**, si cambia dal menu.
- **ACCESSO**:
  - **HA FATTO L'ACCESSO** — è entrata almeno una volta;
  - **NON ANCORA ENTRATO** — c'è in elenco ma non è mai entrata;
  - **SENZA ACCESSO** — l'accesso è stato tolto.
- Senza email (in rosso «nessuna email») una persona non può entrare.

## Il PIN del tablet

Quattro cifre, per l'**AREA ISTRUTTORE** del [tablet di sala](../sala.md).

**IMPOSTA** (o **CAMBIA** se c'è già) → le quattro cifre → **OK**. Due persone
non possono avere lo stesso PIN. Il PIN lo cambia solo la segreteria.

## Aggiungere una persona

**AGGIUNGI UNA PERSONA** → nome, cognome, email, ruolo (**ISTRUTTORE** o
**SEGRETERIA**) → **AGGIUNGI**.

Con **Manda subito l'invito per email** spuntato (lo è già), alla persona
arriva una mail con un link: lo apre, sceglie la sua password ed entra, nel
calendario se è istruttore, nella segreteria se è di segreteria. Il link scade
dopo un'ora.

Se l'invito non è arrivato, è scaduto o non era spuntato: nell'elenco, sotto
**NON ANCORA ENTRATO**, **manda l'invito** ne manda un altro. Chi è già entrato
e ha perso la password la chiede da sé, dalla porta, con **PASSWORD
DIMENTICATA?**.

Perché le mail partano davvero, chi gestisce il database deve prima
pubblicare la funzione dell'invito e impostare il server di posta: i passi
sono in `supabase/LEGGIMI.md`, *L'invito per email*. In prova nessuna email
parte.

## Togliere l'accesso

**togli l'accesso** — la persona non entra più nell'app né nell'area istruttore
del tablet; le presenze che ha segnato restano nel registro. **ridai
l'accesso** lo rimette.

## Cosa può fare ogni ruolo

| | Istruttore | Segreteria |
|---|:-:|:-:|
| Vedere il calendario e fare l'appello, anche da sostituto | sì | sì |
| Aprire l'area istruttore del tablet col PIN | sì | sì |
| Annullare o chiudere le lezioni dei suoi corsi | sì | sì |
| Cambiare corsi, orari e sale | no | sì |
| Aggiungere e togliere iscritti | no | sì |
| Vedere il resoconto delle presenze e le regole | no | sì |
