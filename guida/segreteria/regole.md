# Segreteria · Impostazioni

← [Torna alla segreteria](README.md)

Le scelte che spettano alla palestra, non al programma.

La pagina ha cinque gruppi: **LA STAGIONE**, **LE SALE E I TABLET**, **LE
RICEVUTE**, **IMPORTA DA EXCEL** (la [guida](importa.md)), **DATI E PRIVACY**. In cima, un tasto per ognuno porta dritto al
gruppo. Le spiegazioni lunghe di un riquadro stanno dietro **COME
FUNZIONA?**: si tocca per aprirle; i numeri e gli avvisi restano sempre in vista.

## La stagione

### Il calendario

- **PRONTO FINO AL** — fino a che giorno le lezioni dell'orario sono già in
  calendario. Le lezioni straordinarie non contano: una fissata lontano resta
  dov'è, e il calendario continua ad allungarsi.
- **SI ALLUNGA** — **DA SÉ**: quando alla fine manca meno di metà del periodo
  (o, con la fine dei corsi, quando non ci arriva), il primo che apre il
  calendario lo allunga, istruttore, segreteria o tablet.
- **INIZIO CORSI** e **FINE CORSI** — le date della stagione, facoltative. Con
  la fine, le lezioni si preparano tutte e subito fino a quel giorno (per
  esempio da settembre a fine giugno in un colpo solo), e dopo non ne nascono;
  prima dell'inizio non ne nascono. **SALVA LE DATE** le salva, toglie le
  lezioni da domani in poi rimaste fuori dalle date, anche annullate o col
  sostituto, e allunga subito il calendario. Restano solo quelle con l'appello
  (almeno una persona segnata) o qualcuno venuto a provare: l'avviso dice quante ne
  ha tolte e quali restano. Oggi, il passato e le lezioni straordinarie non si
  toccano. Allargando di nuovo le date le lezioni tornano, ma come da corso:
  annullate e sostituti non si ricordano. Fra inizio e fine ci sta al massimo
  un anno. In prova le lezioni non si preparano prima: fuori dalle date
  restano solo quelle passate e quelle già toccate.
- «Senza la fine dei corsi, genera le lezioni per i prossimi **30 / 60 / 90 /
  180 giorni**» — quanto avanti preparare il calendario quando la fine dei
  corsi non è scritta. Vale dal prossimo rigenera.
- **RIGENERA ADESSO** — lo allunga subito. Non duplica e non tocca le lezioni
  che hanno già un appello, anche a cavallo del cambio d'ora.

## Le sale e i tablet

### Le sale

L'elenco delle sale con i loro posti: **CAMBIA** per il nome o i posti,
**AGGIUNGI UNA SALA** per una nuova.

### Le attività

Cosa si fa in una lezione: «Karate», «Fitness», «Open mat». L'elenco lo scrive
la segreteria e **parte vuoto**. Ogni attività si sceglie poi per un giorno di
un corso (vedi [Corsi](corsi.md)) e il tablet di sala la
scrive accanto all'orario.

- **AGGIUNGI UN'ATTIVITÀ** per una nuova; **CAMBIA** per il nome: il nome nuovo
  si vede ovunque, perché è sempre la stessa attività.
- **NON PIÙ IN USO** la toglie dai menu ma la lascia dov'è già: le lezioni che
  l'hanno restano com'erano. **RIMETTI IN USO** la riporta nei menu.
- **ELIMINA** solo per una mai usata. Se è su un giorno o su una lezione, sotto
  il nome si legge dove, e cosa fare.

Se compare «Le attività non sono ancora attive sul database», va lanciato
l'aggiornamento 41 (vedi `supabase/LEGGIMI.md`): finché manca, i menu delle
attività non ci sono e tutto il resto funziona come prima.

### La musica delle sale

Le liste che il tablet di sala fa partire dalla sua barra in basso (vedi
[Il tablet di sala](../sala.md#la-musica)). Ognuna ha:

- **un nome**, quello che si legge sul tablet: «Riscaldamento», «Randori»;
- **il link a una playlist** di YouTube o di Spotify: dall'app, **Condividi ›
  Copia link**, e si incolla. Oppure **l'indirizzo di una radio**, che
  comincia con https: suona senza pubblicità né account. Sotto il campo si
  legge cos'è; un indirizzo che comincia con http, o che non è nessuno dei
  tre, non si salva;
- **la sala**, o **Tutte le sale**;
- **la categoria** (Judo, Lotta, Core…; la lista si cura in [ESERCIZI](esercizi.md)),
  o **Tutte** per quelle comuni, o nessuna: sul tablet si filtrano per quella.

**CAMBIA** per correggerla, **TOGLI** per toglierla. Il tablet le rilegge ogni
cinque minuti. Le liste di Spotify suonano solo se sul tablet è collegato un
account Spotify Premium, dalle impostazioni del timer.

### La voce dei tablet

Maurizio, i segnali, il volume, lo schermo e la musica durante il timer non
si scelgono da qui: si scelgono nelle impostazioni del timer, su un tablet
qualunque, e valgono per tutti (vedi [Il tablet di sala](../sala.md#il-timer)).

- **VOCE DI SISTEMA** — con che voce parla il timer dei tablet. Le voci le
  mette il dispositivo, non l'app: qui ci sono quelle di questo computer, e
  toccarne una la fa sentire e la sceglie. Il tablet usa la voce con lo
  stesso nome, se ce l'ha, altrimenti la sua prima voce italiana (come con
  **LA PRIMA ITALIANA DEL TABLET**). Se il tablet ha una voce che il computer
  non ha, se ne scrive il nome nel campo sotto. Sui tasti i nomi si leggono senza la
  lingua («GRANDMA», non «GRANDMA (ITALIANO (ITALIA))»): sono tutte italiane.
- **VOCE INCISA** — le frasi del timer registrate con una voce vera: gli
  stati («Lavoro», «Recupero»…), il conto alla rovescia, le battute di
  Maurizio e i nomi degli esercizi della palestra. **REGISTRA** accende il
  microfono del computer, **FERMA** salva la clip, che va sul server e arriva
  a tutti i tablet; **ASCOLTA**, **RIFAI** e **TOGLI** per le altre. Dove
  manca una clip, il tablet usa la voce di sistema. Il tablet le usa se nelle
  impostazioni del suo timer è acceso **Usa le clip incise**. Conviene
  registrare con lo stesso browser dei tablet: Safari e Chrome registrano in
  formati diversi.

### Lo storico dei timer

Gli ultimi timer arrivati in fondo, o fermati prima, sui tablet di sala e sui
telefoni degli istruttori collegati: quando, quale, chi (l'istruttore o il
tablet di quale sala), in quale corso, quanto è durato. **ALTRI 50** per
andare indietro.

## Le ricevute

**CHI FA LE RICEVUTE**: i dati dell'associazione che vanno in testa a ogni ricevuta: nome, indirizzo,
CAP, comune, codice fiscale e, se c'è, la partita IVA; e la **DICITURA IN
FONDO**, quella dell'esenzione da IVA e bollo. Si parte con quelli di Asd Il
Centro Judo. **SALVA** compare quando si cambia qualcosa, e vale per le
ricevute che si fanno da lì in poi: quelle già fatte restano come erano. Le
ricevute si fanno dalla scheda di un iscritto (vedi
[Iscritti](iscritti.md#un-pagamento-e-la-sua-ricevuta)).

## Importa da Excel

Corsi e iscritti dai fogli CSV, o gli iscritti dalle risposte del modulo Google,
in tre passi: i fogli, il controllo, il database. Si può rifare quante volte si
vuole, non duplica niente. Tutto è spiegato in [Importa da Excel](importa.md).

## Dati e privacy

### Per quanto si tengono le presenze

Si sceglie fra **12, 24, 36 o 60 mesi**: dopo, le presenze si cancellano.
Ventiquattro mesi è il valore di partenza, non una regola di legge: la scelta è
della palestra, titolare del trattamento, e l'informativa privacy la riporta da
sé.

Scegliendo più mesi si salva subito. Scegliendo meno mesi, l'app conta prima
quante presenze sono più vecchie del periodo nuovo e, se ce ne sono, chiede
conferma col numero: «Accorciare a 12 mesi? Il primo del mese si cancellano
340 presenze più vecchie di 12 mesi…». Con **NO, LASCIA STARE** resta il
periodo di prima.

Sotto c'è quante presenze sono già scadute. Si cancellano da sé il primo di
ogni mese, oppure subito con **CANCELLA ORA** (chiede conferma: non si
recuperano). In prova non c'è il giro del primo del mese: si cancellano solo
con CANCELLA ORA.

### Il backup

Una copia di tutto il database si fa da sé ogni lunedì notte; **FAI UN BACKUP
ORA** ne fa una subito, prima di un cambiamento grosso. **SCARICA** prende una
copia per metterla su Drive: è cifrata, si apre solo con la password del
backup.

### Privacy

- **L'informativa** — lo stato dell'informativa privacy che vede chi si
  iscrive. Finché è una **BOZZA DA APPROVARE**, va letta e fatta propria dalla
  palestra, che è titolare del trattamento.
- **DATI SANITARI: SOLO IL CERTIFICATO, SU CARTA** — il certificato medico si
  tiene su carta, nella cartellina in un armadio chiuso; nell'app si scrive
  solo fino a quando vale, nella scheda dell'iscritto (vedi
  [Iscritti](iscritti.md)), dove lo vede la segreteria e nessun altro. Lo
  stesso per la copia del documento d'identità. Se arrivano col modulo di
  iscrizione si stampano e si cancellano dalla richiesta; per email o
  WhatsApp, si stampano e si cancellano da lì. Patologie, allergie e simili
  non vanno scritte da nessuna parte nell'app, nemmeno nelle note.
- **ESPORTA I DATI DI UNA PERSONA** — si sceglie chi li ha chiesti e si preme
  **ESPORTA**: un file con anagrafica, iscrizioni, presenze, certificato, pagamento e ricevute. È quello che una
  persona ha diritto di chiedere.
