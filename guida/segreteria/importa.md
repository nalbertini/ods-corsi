# Segreteria · Importa da Excel

← [Torna alla segreteria](README.md)

Sta in IMPOSTAZIONI, nel gruppo **IMPORTA DA EXCEL**. Per caricare in un colpo solo corsi e iscritti da fogli Excel, o gli iscritti
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

Il foglio delle risposte del modulo Google va nella sua casella, non in
`iscritti.csv`: se lo metti lì, l'app lo dice con una riga sola («mancano le
colonne nome e cognome») e non importa niente.

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
     domanda conviene scegliere anche la colonna del **CODICE FISCALE**: le
     sue lettere dicono qual è il cognome, anche se è di due parole («De Luca
     Sara») o scritto prima del nome («Bianchi Anna»), e a chi ha scritto
     solo il cognome il nome si cerca nell'email («mario.rossi@…»), se torna
     col codice; fra le note si vede a chi è successo. Senza codice vale
     l'ordine che scegli sotto **NELLA COLONNA DEL NOME INTERO, PRIMA C'È**: il
     nome («Anna De Luca») o il cognome («De Luca Anna»). L'app lo propone da
     sola dall'intestazione («COGNOME NOME ATLETA» → il cognome), e lo correggi
     se sbaglia. De, Di, Del, Dell', Van… restano col cognome; un cognome che
     non segue queste regole va corretto dopo, nella scheda.
   - Dalle risposte entrano anche **nascita, residenza e genitore**: la data
     e il luogo di nascita, il codice fiscale, il comune, l'indirizzo e il
     CAP, e per un minore il genitore (nome e cognome, codice fiscale, luogo
     e data di nascita). Servono alle **ricevute**, che li prendono da soli.
     Se il genitore ha mandato il modulo anche lui, si riconosce e si prende
     il suo codice fiscale; a un maggiorenne il genitore non si mette. Una
     data che non si capisce, un codice fiscale sbagliato o che non torna con
     la data restano fra le note, da controllare.
   - Un modulo con le sezioni (maggiorenni e minorenni) ripete le stesse
     domande: basta sceglierne una, se è vuota vale quella con la stessa
     domanda.
2. **IL CONTROLLO** — prima di scrivere niente:
   - **COSA ENTRA**: quanti corsi, giorni, iscritti e iscrizioni;
   - **RIGA PER RIGA**: quante righe sono nuove, quante già in palestra, quante
     da sistemare, e per ogni riga il nome e il numero di riga del foglio
     (**VEDI TUTTE LE RIGHE** le elenca tutte). Chi c'è già si riconosce dal
     nome e cognome, anche scritti con accenti, apostrofi o maiuscole
     diverse («D'Angelo», «Deluca» e «De Luca» sono lo stesso cognome), e gli
     si aggiungono solo i corsi che mancano. Il telefono di una persona che
     sta su più righe è il primo che trovi; se due righe ne hanno di diversi
     vale l'ultimo e una nota dice quali erano. Le righe di una persona con
     l'email e senza sono una scheda sola (con due omonimi dalle email
     diverse, la riga senza email resta a parte). Chi sta sia nel foglio Excel
     sia nelle risposte del modulo è una persona sola, con i corsi di tutti e
     due; se telefono o email sono diversi vale quello del modulo e una nota
     dice quello dell'Excel che non è entrato. Per le righe dubbie c'è una
     scelta; **finché non scegli, non entrano**:
     - *forse è già in palestra come…*: nome e cognome sono scritti al
       contrario di una persona che c'è già («Prudente Manuel» per «Manuel
       Prudente»). Scegli **È lei: aggiungi i corsi** (non si crea un doppione)
       o **È un'altra persona: creala**. Con il codice fiscale scelto fra le
       colonne l'ordine si capisce da solo e non c'è dubbio;
     - una persona **archiviata**: di base resta archiviata e non la iscrivo;
       con **Riattivala e iscrivila** torna fra gli iscritti;
     - un'iscrizione **terminata** a un corso: di base resta terminata; con
       **Riapri** riparte da oggi.
   - **EMAIL DI CONTATTO**: se l'email di una riga è già di un'altra
     persona (il fratello nel foglio, un iscritto, un istruttore o la
     segreteria), la riga entra lo stesso, senza email di accesso, e quell'indirizzo
     diventa la sua **email di contatto**. Il controllo e il resoconto dicono
     chi è e quale indirizzo; rifacendo l'import non si duplica;
   - **DA SISTEMARE**: le righe che non si capiscono, col perché;
   - **I NOMI NUOVI**: sale, istruttori e corsi che non c'erano. Attenzione: un
     nome scritto in modo diverso («Lotta 2» e «Lotta2») vale come un corso
     nuovo. Se è un errore, correggerlo nel foglio e **CARICA DI NUOVO**.
   Sopra i tasti c'è il promemoria del **backup**: dice quando è stato fatto
   l'ultimo, e in giallo se non c'è, non è riuscito o è di più di ieri. L'import
   scrive e non si disfa: in quel caso conviene fare **FAI UN BACKUP ORA** in
   IMPOSTAZIONI › IL BACKUP prima di importare.
3. **NELL'APP** — **IMPORTA LE N RIGHE BUONE** (senza quelle da sistemare e
   quelle che aspettano una scelta). Una riga che non va non ferma le altre.
   A fine import il titolo dice **FATTO, N righe da sistemare**, e sotto c'è
   l'elenco «foglio, riga N: nome — motivo», con **COPIA L'ELENCO** per
   correggere il foglio. Poi **VAI ALLA SETTIMANA** per vedere il calendario,
   o **IMPORTA DI NUOVO**.

**Da quando è iscritto.** Dalle risposte del modulo Google, la colonna
«Informazioni cronologiche» si propone da sola come **DATA DELLA RISPOSTA**: le
iscrizioni nuove partono da quel giorno (da quello della prima risposta, se
qualcuno ha mandato il modulo più volte). Se la data manca, non si legge o è
nel futuro, vale oggi, senza avvisi: controlla che il foglio abbia le date
scritte giorno/mese/anno.

Quello che c'è già resta com'è: un corso esistente prende solo i giorni e gli
istruttori che gli mancano. Chi c'è già tiene i suoi dati anagrafici: dalle
risposte del modulo l'import riempie solo quelli vuoti, e non cambia quelli già
scritti, anche se nel modulo sono diversi. Le righe saltate non sono entrate: si correggono nel
foglio e si reimporta.
