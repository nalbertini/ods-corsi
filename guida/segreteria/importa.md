# Segreteria · Importa da Excel

← [Torna alla segreteria](README.md)

Per caricare in un colpo solo corsi e iscritti da fogli Excel, o gli iscritti
dalle risposte del vecchio modulo Google. Si può rifare quante volte si vuole:
**non duplica niente**.

## I fogli

Si caricano file **CSV**:

- da Excel: *File → Salva con nome → CSV UTF-8*;
- dal foglio Google delle risposte: *File → Scarica → Valori separati da
  virgola (.csv)*.

| Foglio | Colonne |
|---|---|
| `corsi.csv` | nome; sala; istruttore; giorno; ora; durata; capienza; colore |
| `iscritti.csv` | nome; cognome; email; telefono; corso |
| risposte del modulo Google | com'è: le colonne si scelgono dopo averlo caricato |

Basta anche un foglio solo: gli iscritti si possono iscrivere ai corsi che ci
sono già.

In `corsi.csv` ogni riga è un giorno, con la sua sala: la prima sala di un
corso è la sala del corso, e una riga con un'altra sala mette quel giorno lì
(Judo 2 in Tatami il lunedì e in Lotta il venerdì).

## I tre passi

1. **I FOGLI** — **SCEGLI IL FOGLIO** per ognuno, poi **CONTROLLA** (o
   **AVANTI**).
   - Per le risposte del modulo Google compaiono **LE COLONNE DEL MODULO** (quale
     domanda dice il nome, il cognome, l'email…) e **LE SCELTE DEI CORSI**
     (quale risposta corrisponde a quale corso). L'app prova a indovinarle; si
     correggono prima di andare avanti. Con nome e cognome nella stessa
     domanda, il cognome è l'ultima parola: un cognome di due parole va
     corretto dopo, nella scheda.
2. **IL CONTROLLO** — prima di scrivere niente:
   - **COSA ENTRA**: quanti corsi, giorni, iscritti e iscrizioni;
   - **DA SISTEMARE**: le righe che non si capiscono, col perché;
   - **I NOMI NUOVI**: sale, istruttori e corsi che non c'erano. Attenzione: un
     nome scritto in modo diverso («Lotta 2» e «Lotta2») vale come un corso
     nuovo. Se è un errore, correggerlo nel foglio e **CARICA DI NUOVO**.
3. **NEL DATABASE** — **IMPORTA LE N RIGHE BUONE**. Alla fine **VAI ALLA
   SETTIMANA** per vedere il calendario, o **IMPORTA DI NUOVO**.

Quello che c'è già resta com'è: un corso esistente prende solo i giorni e gli
istruttori che gli mancano. Le righe saltate non sono entrate: si correggono nel
foglio e si reimporta.
