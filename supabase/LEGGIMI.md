# La sala corsi: mettere in piedi il database

L'app funziona senza tutto questo: senza le due variabili d'ambiente parte in
**modalità prova**, con l'orario vero e degli iscritti inventati, e lo dice con un
nastro giallo in cima allo schermo. Questi passi servono quando si vuole il
calendario vero della palestra.

## 1. Il progetto

Su [supabase.com](https://supabase.com) si crea un progetto in una regione
dell'Unione Europea — i dati qui dentro sono nomi e presenze di persone,
quindi non è un dettaglio. Quello della palestra, **ODS-Sala**, sta a
**Stockholm (eu-north-1)**; Frankfurt (eu-central-1) andrebbe bene uguale. La
regione non si cambia dopo, e conta anche fuori da qui: l'informativa dice dove
stanno i dati, e gli indirizzi del *pooler* (vedi «Il backup») ce l'hanno nel
nome.

Il piano gratuito basta per una palestra sola: 500 MB di database e 50.000
utenti attivi al mese sono molto più di quel che serve.

In **Authentication → Sign In / Providers** si spegne **Allow new users to
sign up**: gli account li crea la segreteria, e con la registrazione aperta
chiunque avrebbe un accesso con cui leggere il calendario e le note delle
lezioni. Resta acceso **Confirm email**: il primo accesso lega un account
alla scheda di un istruttore solo se l'email è confermata.

## 2. Lo schema

Nel **SQL Editor** del progetto, si incollano e si lanciano **in quest'ordine**:

1. `01-schema.sql` — tabelle, indici, vincoli
2. `02-policy.sql` — chi può vedere e fare cosa
3. `03-funzioni.sql` — il calendario, il tracciamento di chi segna, la pulizia
4. `04-tablet.sql` — il tablet di sala e i PIN degli istruttori
5. `05-segreteria.sql` — le lezioni che seguono i cambi dei corsi, il primo accesso
6. `06-iscrizioni.sql` — il modulo di iscrizione, i suoi file, e chi può chiamare cosa
7. `07-certificati-pagamenti.sql` — il certificato medico (su carta: qui la scadenza), il documento d'identità e il pagamento degli iscritti
8. `08-timer.sql` — il timer: la libreria della palestra, i timer personali e dei corsi, lo storico, le preferenze
9. `09-musica.sql` — la musica delle sale, che il tablet fa partire dalla sua barra
10. `10-timer-sale.sql` — il timer dei tablet di sala, uguale per tutti
11. `11-timer-lezioni.sql` — il timer di una singola lezione, scelto dall'istruttore in I MIEI TIMER
12. `12-calendario-da-se.sql` — il calendario che si allunga da sé, senza job, e le date di inizio e fine dei corsi
13. `13-voce-esercizi.sql` — la voce, le clip incise e gli esercizi dei tablet di sala, scelti dalla segreteria
14. `14-timer-dal-tablet.sql` — il timer dei tablet di sala si cambia da un tablet qualunque
15. `15-presenze-istruttori.sql` — la presenza degli istruttori dal PIN del tablet: da sola se erano previsti, se no da confermare in segreteria
16. `16-ricevute.sql` — le ricevute dei pagamenti, col loro numero, e i dati dell'associazione che vanno in testa
17. `17-luoghi.sql` — i comuni e gli stati esteri del codice fiscale, per il luogo di nascita del modulo. Lo genera `scripts/luoghi.py` dalle tabelle dell'ANPR; è grande (circa 600 KB), e se il SQL Editor non lo prende si lancia con `psql`. Finché non c'è, il luogo di nascita resta quello scritto nel modulo
18. `18-anagrafiche.sql` — nascita, residenza e genitore degli iscritti che arrivano dalle risposte del modulo Google
19. `19-listino.sql` — il listino dei costi, cambiato dalla segreteria da LISTINO e letto dalla pagina di iscrizione
20. `20-nomi.sql` — nomi e cognomi scritti tutti allo stesso modo, «Maria Grazia De Luca», anche quelli già salvati
21. `21-prove.sql` — le prove: chi viene a provare entra nell'appello, aggiunto da chi lo fa col tasto PROVE
22. `22-statistiche.sql` — le statistiche della segreteria: i conti delle lezioni e degli incassi, fatti dal database
23. `23-istruttori-dalle-lezioni.sql` — la presenza degli istruttori anche dall'appello che fanno, e le lezioni tenute senza nessun istruttore segnato, proposte alla segreteria che sceglie chi c'era
24. `24-kanji.sql` — il kanji degli istruttori: un segno solo, scelto dalla segreteria, che li fa riconoscere a colpo d'occhio nel calendario, nell'appello e sul tablet di sala
25. `25-segnalazioni.sql` — le segnalazioni della segreteria: cosa non va o cosa servirebbe nell'app, con le risposte nello stesso filo, invece di un documento a parte
26. `26-colori-corsi.sql` — i corsi rossi passano al viola: in segreteria il rosso vuol dire solo che qualcosa manca
27. `27-pagamento-dalle-ricevute.sql` — se ha pagato lo dicono le ricevute: in regola vuol dire la quota associativa pagata, e lo stato scritto a mano resta solo come eccezione per chi ha pagato fuori dall'app
28. `28-elimina-istruttore.sql` — eliminare un istruttore che non ha mai insegnato, anche se è di segreteria col ruolo doppio, la scheda e l'account (con la funzione `elimina`, vedi «L'invito per email»); chi ha corsi, lezioni o presenze non si elimina, nemmeno cancellando la riga a mano
29. `29-unisci-doppioni.sql` — unire due schede della stessa persona (un doppione fatto all'appello o dall'import): solo la segreteria, solo due iscritti senza accesso, mai con due codici fiscali diversi; tutto quello della scheda che se ne va passa a quella che resta
30. `30-pronto-fino-dalle-ricorrenze.sql` — fin dove è pronto il calendario lo dicono le lezioni dell'orario: una straordinaria lontana non lo ferma più
31. `31-informativa-mesi.sql` — per quanto si tengono le presenze, letto dall'informativa privacy anche da chi non ha un accesso
32. `32-segnalazioni-allegati.sql` — i file nelle segnalazioni: fino a 3 foto o PDF per messaggio (10 MB), in un contenitore privato; li vede la segreteria, li toglie solo chi li ha mandati, e 30 giorni dopo la chiusura del filo si tolgono da soli
33. `33-non-doppioni.sql` — le coppie di schede che la segreteria ha segnato «non sono doppioni» (due omonimi veri), così non compaiono più fra i possibili doppioni di ISCRITTI

Si possono rilanciare tutti quante volte si vuole: non distruggono niente.
Rilanciarne uno dei primi cinque rimette i permessi di default alle sue
funzioni, quindi dopo va rilanciato anche `06-iscrizioni.sql`. Gli altri
chiudono da sé le funzioni che creano: Postgres le fa nascere eseguibili da
tutti, `anon` compreso, e `06` non può cambiarlo per quelle che verranno.

Su un database già in uso, dopo un aggiornamento dell'app si rilanciano i
file cambiati e poi `06-iscrizioni.sql`. Per certificati e pagamenti basta
lanciare `07-certificati-pagamenti.sql`: finché non c'è, l'elenco degli
iscritti si vede lo stesso, e salvare un certificato dice che manca. Per il
certificato e il documento su carta si rilanciano `06-iscrizioni.sql` e
`07-certificati-pagamenti.sql`: dopo, documento e certificato arrivano col
modulo e la segreteria li stampa e li cancella, e nel contenitore dei
certificati non entra più niente (vedi «Certificato e documento su carta»,
più sotto). Per la sala dei singoli giorni
(la colonna `ricorrenze.sala_id`) sono `01-schema.sql`, `03-funzioni.sql`,
`04-tablet.sql` e `05-segreteria.sql`: le lezioni già generate restano dove
sono. Per il timer basta lanciare `08-timer.sql`, che non chiede di
rilanciare `06-iscrizioni.sql`: finché non c'è, il timer tiene tutto sul
dispositivo come prima e dice che il database non risponde. Lo stesso per la
musica delle sale con `09-musica.sql`: finché non c'è, la segreteria dice che
le liste non si leggono e il tablet suona quella delle impostazioni del timer.
Per il timer delle singole lezioni con
`11-timer-lezioni.sql`: finché non c'è, I MIEI TIMER dice che le lezioni non
si leggono, e le lezioni aprono i timer del corso come prima. Per il
calendario che si allunga da sé si rilanciano `03-funzioni.sql`, poi
`06-iscrizioni.sql`, poi `12-calendario-da-se.sql`: finché non c'è, il
calendario si allunga solo con RIGENERA o con il job settimanale. Per le
date di inizio e fine dei corsi in IMPOSTAZIONI basta rilanciare
`12-calendario-da-se.sql`: finché non c'è, IMPOSTAZIONI dice che va
rilanciato, e il calendario si prepara per i giorni scelti come prima. Per la
voce e gli esercizi dei tablet basta `13-voce-esercizi.sql`, che non chiede
di rilanciare `06-iscrizioni.sql`: finché non c'è, la segreteria dice che
voce ed esercizi non si leggono, e i tablet tengono la voce e il catalogo
che avevano. Per cambiare il timer delle sale da un tablet basta
`14-timer-dal-tablet.sql` (dopo `10-timer-sale.sql`), che non chiede di
rilanciare `06-iscrizioni.sql`: finché non c'è, quello che si sceglie su un
tablet non si salva, e al giro dopo il tablet torna a quello del database.
Per la presenza degli istruttori dal PIN del tablet basta
`15-presenze-istruttori.sql` (dopo `04-tablet.sql`), che non chiede di
rilanciare `06-iscrizioni.sql`: finché non c'è, il tablet apre l'area
istruttore come prima senza segnare niente, e PRESENZE ISTRUTTORI in
segreteria dice che va lanciato. Per le ricevute dei pagamenti basta
`16-ricevute.sql` (dopo `07-certificati-pagamenti.sql`), che non chiede di
rilanciare `06-iscrizioni.sql`: finché non c'è, la scheda di un iscritto dice
che le ricevute non sono attive, e il pagamento si segna come prima. Per il
ruolo doppio, segreteria e istruttore, si rilanciano `01-schema.sql`, poi
`15-presenze-istruttori.sql` e `06-iscrizioni.sql`: finché non c'è, si entra
come prima, e scegliere **TUTTI E DUE** dice che va rilanciato `01-schema.sql`. Per nascita,
residenza e genitore degli iscritti importati basta `18-anagrafiche.sql`
(dopo `07-certificati-pagamenti.sql`), che non chiede di rilanciare
`06-iscrizioni.sql`: finché non c'è, l'import porta dentro gli iscritti come
prima, e dice che quei dati sono rimasti fuori. Per il listino cambiato dalla
segreteria basta `19-listino.sql` (dopo `05-segreteria.sql`), che non chiede
di rilanciare `06-iscrizioni.sql` (e se lo si rilancia dopo, `06` rimette lui
il permesso ad `anon` su `listino()`): finché non c'è, la pagina di iscrizione
e le ricevute usano il listino del foglio, e salvare da LISTINO dice che va
lanciato. Per nomi e cognomi scritti tutti allo stesso modo basta
`20-nomi.sql` (dopo `18-anagrafiche.sql`), che non chiede di rilanciare
`06-iscrizioni.sql` e sistema anche i nomi già salvati, tranne quelli delle
ricevute già emesse: finché non c'è, l'app li scrive giusti lei, ma il
modulo di iscrizione e l'import da SQL Editor li lasciano come arrivano. Per
le prove basta `21-prove.sql` (dopo `04-tablet.sql`), che non chiede di
rilanciare `06-iscrizioni.sql`: finché non c'è, l'appello si fa come prima, il
tasto PROVE dice che va lanciato, e in segreteria PRESENZE lo dice nel
riquadro PROVE. Per le statistiche basta `22-statistiche.sql` (dopo
`05-segreteria.sql`), che non chiede di rilanciare `06-iscrizioni.sql`:
finché non c'è, STATISTICHE in segreteria dice che va lanciato. Per la
presenza degli istruttori dall'appello e le lezioni tenute da confermare basta
`23-istruttori-dalle-lezioni.sql` (dopo `15-presenze-istruttori.sql`), che non
chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, l'appello non segna
l'istruttore e PRESENZE ISTRUTTORI dice che va lanciato, sopra l'elenco delle
presenze dal PIN che resta com'è. Le lezioni si propongono da quando lo si
lancia, non quelle di prima. Per il kanji degli istruttori basta
`24-kanji.sql` (dopo `04-tablet.sql`), che non chiede di rilanciare
`06-iscrizioni.sql`: finché non c'è, l'app funziona come prima, senza kanji.
Per le segnalazioni della segreteria basta `25-segnalazioni.sql` (dopo
`02-policy.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non
c'è, SEGNALAZIONI dice che non si leggono. Chi l'aveva già lanciato lo
rilancia: la prima versione lasciava entrare un filo senza titolo.
Per i file nelle segnalazioni basta `32-segnalazioni-allegati.sql` (dopo
`25-segnalazioni.sql`), che non chiede di rilanciare `06-iscrizioni.sql`:
finché non c'è, le segnalazioni funzionano come prima e il tasto per allegare
dice che va lanciato. La pulizia dopo 30 giorni gira ogni notte con pg_cron
(Database → Extensions); se non è acceso, `select pulisci_allegati();` si
lancia a mano di tanto in tanto.
Per i corsi rossi che passano al viola basta `26-colori-corsi.sql` (dopo
`01-schema.sql`), una volta sola, che non chiede di rilanciare
`06-iscrizioni.sql`: finché non c'è, i corsi che erano rossi restano rossi.
Per il pagamento ricavato dalle ricevute basta `27-pagamento-dalle-ricevute.sql`
(dopo `16-ricevute.sql`), che non chiede di rilanciare `06-iscrizioni.sql`:
finché non c'è, l'app ricava le stesse righe dalle ricevute da sola.
Per eliminare un istruttore basta `28-elimina-istruttore.sql` (dopo
`15-presenze-istruttori.sql`), che non chiede di rilanciare
`06-iscrizioni.sql`, e la funzione `elimina` pubblicata come `invita`:
finché non ci sono, ELIMINA nella scheda dell'istruttore dice cosa manca.
Chi l'aveva già lanciato lo rilancia: la prima versione non eliminava la
segreteria che insegna anche.
Per unire due schede della stessa persona basta `29-unisci-doppioni.sql`
(dopo `28-elimina-istruttore.sql`), che non chiede di rilanciare
`06-iscrizioni.sql`: finché non c'è, UNISCI nella scheda dell'iscritto dice
che va lanciato.
Per il calendario che non si ferma a una straordinaria basta
`30-pronto-fino-dalle-ricorrenze.sql` (dopo `05-segreteria.sql`), che non
chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, una lezione
straordinaria fissata oltre la fine del calendario lo ferma fino a lei.
Per i mesi delle presenze scritti nell'informativa privacy basta
`31-informativa-mesi.sql` (dopo `05-segreteria.sql`), che non chiede di
rilanciare `06-iscrizioni.sql` (e se lo si rilancia dopo, `06` rimette lui il
permesso ad `anon` su `mesi_presenze_pubblici()`): finché non c'è,
l'informativa dice «per il periodo stabilito dalla palestra (oggi indicato in
segreteria)», senza un numero.
Per segnare due schede «non sono doppioni» basta `33-non-doppioni.sql` (dopo
`29-unisci-doppioni.sql`), che non chiede di rilanciare `06-iscrizioni.sql`:
finché non c'è, i possibili doppioni si vedono lo stesso e NON SONO DOPPIONI
dice che va lanciato.
Chi aveva già lanciato `21-prove.sql` lo rilancia, che non chiede di
rilanciare `06-iscrizioni.sql`: la prima versione dava il telefono di chi è
venuto a provare a tutto il personale, ora solo alla segreteria. Finché non
c'è, l'istruttore continua a vederlo.
Le funzioni dei trigger di `07`, `08`, `12` e `20`, e `nome_proprio`,
restavano chiamabili da chi non ha un accesso (senza far uscire niente): basta
rilanciare `06-iscrizioni.sql`, che le chiude.
Dodici funzioni di `02`, `04`, `06`, `07` e `08` non dicevano dove cercare le
tabelle (`search_path`), e Supabase lo segnala: si rilanciano quei cinque file,
poi `06-iscrizioni.sql`. Finché non c'è, l'app funziona come prima.

Per sapere cosa manca su un database già in uso c'è **`controllo.sql`**: si
incolla nel SQL Editor, legge soltanto, e per ogni file dice «ok» o «DA
LANCIARE», anche quando un file c'è ma in una versione vecchia, o quando dopo
uno dei primi cinque non è stato rilanciato `06-iscrizioni.sql`. Chi cambia uno
dei file numerati aggiunge lì una riga per quello che ha aggiunto.

Se l'app dice *Could not find the function public.… in the schema cache*,
il file che la crea non è stato lanciato su questo progetto (per
`corsi_aperti` è `06-iscrizioni.sql`): lanciarlo basta, perché ogni file
finisce con `notify pgrst, 'reload schema'` e l'API la vede subito.

## 3. Le persone

Con il database vero l'app chiede l'accesso e non ha schede: l'istruttore
entra da `istruttori/` e trova il calendario e l'appello, chi è di segreteria
entra da `segreteria/` e trova la segreteria, e nient'altro.
Chi vuole iscriversi non entra da qui: ha la pagina pubblica, `iscrizioni/` in
fondo all'indirizzo, che la segreteria copia con **COPIA LINK ISCRIZIONI**.

Ogni istruttore e chi sta in segreteria ha bisogno di due cose: un utente in
**Authentication → Users** e una riga in `persone` che lo colleghi. Con
l'invito per email (sotto, *L'invito per email*) la segreteria fa tutte e due
dall'app; senza, l'utente si crea a mano dal pannello. Un account
che non ha la sua riga in `persone` (o ce l'ha con ruolo `iscritto`) non entra,
e l'app lo dice.

```sql
-- dopo aver creato l'utente dal pannello: la persona, se non c'è ancora…
insert into persone (nome, cognome, ruolo, email, utente_id)
select 'Maurizio', 'Innella', 'istruttore', email, id from auth.users where email = 'maurizio@esempio.it';

-- …o, se c'è già (per esempio dall'import), si legano i due
update persone set utente_id = (select id from auth.users where email = 'maurizio@esempio.it')
where nome = 'Maurizio' and cognome = 'Innella';
```

Per la segreteria il ruolo è `staff`. Chi sta in segreteria e insegna anche
ha `staff` e in più `anche_istruttore = true` (la colonna arriva con
`01-schema.sql`): gli si danno dei corsi, il PIN del tablet gli segna la
presenza come a un istruttore, e all'accesso l'app gli chiede se andare in
segreteria o nel calendario. Dall'app lo si sceglie in **ISTRUTTORI E
ACCESSI** → **RUOLO** → **TUTTI E DUE**.

Se nella riga di `persone` c'è già la sua **email**, il secondo passo si può
saltare: al primo accesso l'app lega da sé l'account alla persona con la
stessa email (`collega_utente()`, in `05-segreteria.sql`). Vale solo per
istruttori e segreteria, e solo per una persona che non ha già un account. La
prima persona di segreteria va comunque messa a mano, perché prima di lei
nessuno può scrivere in `persone`.

### L'invito per email

Da **ISTRUTTORI E ACCESSI** la segreteria aggiunge una persona e le manda
l'invito: una mail con un link, che apre l'app su una pagina dove si sceglie
la password. Aprire il link conferma l'email, e al primo accesso l'account si
lega alla scheda da solo. Chi ha già un account ma non è mai entrato (un
invito scaduto, un utente creato a mano) riceve invece il link per scegliere
la password. Dalla porta c'è anche **password dimenticata?**, che manda lo
stesso link a chi una password l'aveva.

L'account lo crea la funzione **`invita`** (`functions/invita/index.ts`), che
gira sul server di Supabase con la chiave `service_role`: dal browser non si
può, perché la chiave dell'app è pubblica. Controlla che chi la chiama sia
della segreteria e invita solo istruttori e segreteria già in `persone`, con
un'email e l'accesso attivo. Per metterla in piedi, una volta:

1. **La funzione.** Con la [CLI di Supabase](https://supabase.com/docs/guides/cli),
   dalla cartella del repository:

   ```sh
   supabase login
   supabase functions deploy invita --project-ref <id-del-progetto>
   ```

   L'id è quello di `https://<id>.supabase.co`. Le chiavi che usa
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) Supabase
   gliele dà da sé: non c'è niente da impostare. Senza la CLI, si crea dal
   pannello in **Edge Functions → Deploy a new function**, col nome `invita`,
   incollando il file.

2. **Dove porta il link.** In **Authentication → URL Configuration**: in
   **Site URL** l'indirizzo dell'app pubblicata, e fra i **Redirect URLs** lo
   stesso (per esempio `https://corsi.esempio.it/**`). Un indirizzo che non è
   in elenco Supabase non lo usa, e il link porta alla Site URL.

3. **Chi manda le mail.** Il server di posta che Supabase ha di suo serve
   solo a provare: poche mail all'ora, e solo agli indirizzi del team del
   progetto. Per invitare davvero serve un SMTP (quello del dominio della
   palestra, o un servizio come Brevo o Resend), in **Authentication → Emails
   → SMTP Settings**. Finché non c'è, l'app dice che la mail non è partita.

4. **Il testo della mail**, facoltativo: in **Authentication → Emails →
   Templates**, *Invite user* e *Reset password*. Il link resta
   `{{ .ConfirmationURL }}`; il nome della persona è `{{ .Data.nome }}`.
   Quelli in italiano sono in `mail/invito.html` e `mail/password.html`, da
   incollare nel campo *Message body*; oggetti: «Il tuo accesso ai corsi di
   Officine Dello Sport» e «Scegli la password per i corsi».

Il link vale un'ora (**Authentication → Providers → Email → Email OTP
Expiration**, fino a un giorno). Se scade, dall'elenco «manda l'invito» ne
manda un altro.

La registrazione resta spenta (**Allow new users to sign up**): l'invito non
ne ha bisogno, e la funzione invita solo chi la segreteria ha messo in elenco.

Allo stesso modo, **ELIMINA** nella scheda di un istruttore chiama la funzione
**`elimina`** (`functions/elimina/index.ts`): la scheda la cancella il
database con `elimina_istruttore()` (`28-elimina-istruttore.sql`), col token
di chi chiama, e solo dopo la funzione toglie l'account da **Authentication →
Users**. Si pubblica come `invita`:

```sh
supabase functions deploy elimina --project-ref <id-del-progetto>
```

Chi ha il ruolo `staff` entra nella **segreteria**, all'indirizzo
`segreteria/`: la settimana con gli appelli, i corsi e gli iscritti, pensati
per il computer della reception. Un istruttore che apre quell'indirizzo viene
rimandato a `istruttori/`.

Chi frequenta i corsi **non** ha bisogno di un account: in questa fase gli
iscritti sono nomi in un elenco e basta.

## 4. Corsi e iscritti dai fogli

Dall'app: **SEGRETERIA → IMPORTA DA EXCEL**. Si caricano i due fogli, si vede
cosa entra e quali righe non vanno, e si importa; si può rifare quante volte si
vuole, quello che c'è già non si duplica. Un istruttore scritto col nome
soltanto si lega a chi ha quel nome, se in palestra ce n'è uno solo.

Oppure, per chi preferisce leggere l'SQL prima di lanciarlo:

```
node scripts/importa.mjs corsi.csv iscritti.csv > semina.sql
```

Lo script scrive SQL invece di scrivere sul database: così si legge prima di
lanciarlo, si tiene in un file e si rilancia uguale senza duplicare niente.
L'SQL si incolla nel SQL Editor.

I fogli esportati da Excel in italiano — punto e virgola, BOM, accenti — vanno
bene così come sono.

| `corsi.csv` | |
|---|---|
| `nome` | Il nome del corso |
| `sala` | Creata se non c'è. La prima riga del corso dà la sala del corso; una riga con un'altra sala mette lì quel giorno |
| `istruttore` | Nome e cognome; creato se non c'è. Più istruttori separati da virgola: entrano tutti |
| `giorno` | `lunedì`, `lun` o il numero (0 = domenica) |
| `ora` | `19:00` o `19.00` |
| `durata` | In minuti |
| `capienza`, `colore` | Facoltativi |
| `note` | Ignorata dall'import: serve a chi legge il foglio |

| `iscritti.csv` | |
|---|---|
| `nome`, `cognome` | Obbligatori |
| `email` | Facoltativa, ma è l'unica cosa che distingue due omonimi |
| `telefono` | Facoltativo |
| `corso` | Il nome del corso, come scritto in `corsi.csv` |

Le righe che non si capiscono vengono saltate e stampate: si correggono nel
foglio e si rilancia.

### Dalle risposte del modulo Google

Nella stessa schermata c'è un terzo foglio: le risposte del modulo Google,
scaricate dal foglio delle risposte con *File → Scarica → Valori separati da
virgola (.csv)*, così come sono. Le domande di un modulo sono scritte come le
ha scritte chi l'ha fatto, quindi:

- l'app **indovina le colonne**: nome, cognome (o nome e cognome insieme),
  email, telefono, corsi. Una domanda che parla del genitore non vale come
  nome dell'iscritto, ma la sua email e il suo telefono sì. Si correggono
  dai menu prima di andare avanti. Le altre colonne (le foto caricate, i
  consensi) non entrano;
- **le scelte dei corsi** si abbinano ai corsi veri: «Judo 2 (nati
  2017-2019)» diventa Judo 2 da sé, una scelta che non somiglia a nessun corso
  resta da abbinare a mano, o da lasciar stare. Chi l'ha scelta entra lo
  stesso, senza quel corso;
- due fratelli iscritti con l'email del genitore entrano tutti e due, e il
  secondo senza email, perché un'email è di una persona sola. Chi ha mandato
  il modulo due volte è una persona sola, con i corsi di tutte e due.

Si può rifare col foglio che è cresciuto: chi era già entrato si riconosce
(dall'email con lo stesso nome, o da nome e cognome) e non si duplica.

L'orario della stagione 2026/27 è in
[`dati/corsi-2026-27.csv`](../dati/corsi-2026-27.csv): sono i corsi ufficiali
come li ha sistemati la segreteria a ottobre, con orari, sale di ogni giorno
e istruttori, scritti come stanno in `persone` così un nuovo import li
riconosce. I corsi archiviati (Body functional, Judo principianti,
Pesistica 1 e 2, Preparazione atletica 1, 2 e 3) non ci sono più.

I corsi con più istruttori (Lotta, Preparazione atletica) li legano tutti in
`corsi_istruttori`: ognuno può fare l'appello e aggiornare le lezioni del
corso. `corsi.istruttore_id` resta il primo della lista, quello di riferimento.

## 5. Il modulo di iscrizione

Chi si iscrive lo compila dalla pagina pubblica (`iscrizioni/`), senza un accesso: le
domande di prima (i dati di chi si iscrive, del genitore se è minorenne, la
residenza, i corsi, come paga) e i file: il modulo firmato, il documento
d'identità (fronte e, se serve, retro), il certificato medico se ce l'ha già,
e la ricevuta. Documento e certificato la segreteria li stampa, li tiene su
carta e li cancella dall'app. La segreteria le trova in **SEGRETERIA → RICHIESTE
ONLINE**, guarda i file e la accoglie o la rifiuta. Chi manda una richiesta
rifiutata non viene avvisato dall'app: va chiamato o scritto a mano.

Cosa fa `06-iscrizioni.sql`:

- la tabella `richieste_iscrizione`, che legge e cambia solo la segreteria;
- il contenitore **`iscrizioni`** nello Storage, privato: niente link
  pubblici, la segreteria apre i file con un link che dura dieci minuti;
- chi non ha un accesso può solo chiamare `corsi_aperti()` e
  `invia_iscrizione()`, e caricare al massimo cinque file (modulo,
  documento fronte e retro, certificato, ricevuta: foto o PDF, fino a 10 MB), nella cartella della richiesta appena mandata,
  entro un'ora. Non li può rileggere né sostituire;
- `richieste_con_documento()` dice alla segreteria quali richieste hanno
  ancora il documento d'identità o il certificato caricato: RICHIESTE ONLINE
  le segna **DA STAMPARE**;
- la porta non è spalancata: tre richieste al giorno dalla stessa email, trenta
  all'ora in tutto. I numeri stanno in `iscrizioni_regole()`;
- accogliere (`accogli_iscrizione`) mette la persona in elenco e la iscrive ai
  corsi scelti. Se c'era già la ritrova: dal codice fiscale di una richiesta
  accolta prima o dei dati anagrafici importati, oppure da nome e cognome con
  la stessa email, nessuna o lo stesso telefono. Se no, la scheda la sceglie
  la segreteria: RICHIESTE ONLINE mostra chi in elenco ha lo stesso nome e
  cognome (l'iscritto che aveva dato la sua email, e stavolta la richiesta
  l'ha mandata la mamma con la sua), e la si accoglie su quella. Due
  fratelli iscritti dalla stessa email entrano tutti e due, e il secondo resta
  senza email, perché in `persone` un'email può essere di una persona sola;
- `anon`, che finora non aveva nemmeno lo schema, ora lo vede per queste due
  funzioni. Prima di aprirglielo il file gli toglie tutte le altre:
  `materializza_sessioni` e `pulisci_presenze`, per esempio, lasciano passare
  chi non ha un utente, perché è così che le chiama un job.

**Si accende con l'informativa approvata.** Il modulo chiede codici fiscali
e dati dei genitori, e col database vero l'app lo mostra solo quando
l'informativa (`informativa.html`) è approvata, cioè quando in
`src/lib/iscrizione.ts` `INFORMATIVA_BOZZA` è `false`: lo è dal 27 settembre
2026. Se si rimette a `true` il passo torna al modulo Google
(`LINK_ISCRIZIONE`). In prova il modulo è sempre acceso.

**Le domande** sono ricavate dai moduli di autorizzazione e dai passi di
prima, non copiate dal modulo Google, che senza accesso non si legge. Se
quello chiedeva altro, vanno allineati tre posti: `invia_iscrizione` qui,
`controlla()` in `src/lib/richieste.ts` e `ModuloIscrizione.tsx`.

**Per quanto si tengono.** Accolta o rifiutata, una richiesta resta con i suoi
file finché la segreteria non la elimina («Elimina richiesta e file», nella
richiesta). Documento e certificato no: si stampano e si cancellano appena
accolta la richiesta, e la copia su carta segue i tempi dell'informativa.

### Il certificato medico, il documento e il pagamento

Nella scheda di ogni iscritto (**SEGRETERIA → ISCRITTI**) la segreteria
scrive fino a quando vale il certificato medico, segna se la copia del
documento d'identità è in segreteria, e se ha pagato: da pagare, in parte o
pagato, e per il trimestre fino a quando. L'elenco dice chi non è in regola
e si filtra.

Cosa fa `07-certificati-pagamenti.sql`:

- la tabella `schede_iscritti`, una riga per persona, che legge e cambia solo
  la segreteria. Sta a parte da `persone` apposta: gli istruttori leggono
  `persone` per l'appello, e il certificato è un dato sulla salute. Chi l'ha
  cambiata e quando lo scrive il server. `documento_in_segreteria` dice se
  la copia del documento è nella cartellina;
- le policy del contenitore **`certificati`**, dove c'è ancora: la segreteria
  legge e cancella i file di prima, e nessuno ne carica di nuovi;
- la riga se ne va con la persona (`on delete cascade`). Un file di prima,
  se la persona si cancella dal database a mano, resta nel contenitore e va
  tolto a mano anche lui.

Documento e certificato arrivano col modulo, nella cartella della richiesta
(o si portano in segreteria): la scheda ne tiene solo la scadenza e se il
documento c'è. L'esportazione dei dati di una persona (IMPOSTAZIONI) comprende
la scadenza e se il documento c'è.

### Certificato e documento su carta

Il certificato medico e la copia del documento d'identità si tengono **su
carta**, in segreteria, in un armadio chiuso: nell'app restano solo la data
fino a cui vale il certificato e se il documento c'è. Col modulo si caricano,
così raccoglierli è facile, ma restano nell'app solo finché la segreteria non
li stampa: poi si cancellano. Prima il certificato si caricava nella scheda:
quei file si stampano e si cancellano allo stesso modo.

1. Si rilanciano `06-iscrizioni.sql` e `07-certificati-pagamenti.sql`. Da lì
   il modulo accetta documento e certificato, e nel contenitore `certificati`
   non entra più niente.
2. In **ISCRITTI**, **CERTIFICATI DA STAMPARE** mostra chi ha ancora il file:
   dalla scheda **APRI PER STAMPARE**, si stampa, si mette nella cartellina, e
   **STAMPATO, CANCELLALO**.
3. In **RICHIESTE ONLINE**, **DA STAMPARE** mostra le richieste con
   documento o certificato: accolta la richiesta, li si apre, si stampano e
   **STAMPATO, CANCELLA**. La scheda dell'iscritto segna da sé che la copia
   del documento è in segreteria; la scadenza del certificato la si scrive lì.
4. Quando **CERTIFICATI DA STAMPARE** non compare più, nel pannello di Supabase,
   **Storage**, il contenitore `certificati` è vuoto: si elimina (i tre
   puntini → **Delete bucket**), dal pannello e non dall'SQL Editor: i file
   dello Storage si cancellano dallo Storage. Il contenitore `iscrizioni`
   resta: per moduli e ricevute, e per documenti e certificati finché non
   sono stampati.

## 6. Il calendario

`materializza_sessioni` trasforma le ricorrenze in lezioni vere, ognuna nella
sala del suo giorno (`ricorrenze.sala_id`) o, se il giorno non ne ha una, in
quella del corso. L'import la
chiama già per i due mesi successivi; poi il calendario si allunga da sé
(`12-calendario-da-se.sql`): quando l'app legge il calendario — un
istruttore, la segreteria o un tablet di sala — chiama `allunga_calendario`,
che lo allunga se alla fine manca meno di metà del periodo. Quanti giorni
avanti si decide in **SEGRETERIA → IMPOSTAZIONI**.

Se per settimane nessuno apre l'app, il calendario si ferma: lo riallunga il
primo che la apre. Chi vuole comunque un job settimanale (**Database → Cron**)
lo può aggiungere, e legge i giorni dallo stesso posto:

```sql
select cron.schedule('calendario', '0 3 * * 1',
  $$select materializza_sessioni(current_date, current_date + (select giorni_calendario from impostazioni))$$);
```

E un secondo job, la prima notte di ogni mese, cancella le presenze più vecchie
del periodo scelto nelle stesse regole:

```sql
select cron.schedule('pulizia', '0 4 1 * *', $$select pulisci_presenze()$$);
```

## 7. I tablet di sala

Ogni sala ha un tablet appeso al muro con il calendario della sala: chi arriva
tocca il suo nome e la presenza è segnata. Il tablet ha un **account suo**, che
non è di nessuna persona e sa fare solo questo:

- vede le lezioni della sua sala, e degli iscritti **il nome e l'iniziale** del
  cognome — mai l'anagrafica, le email, i telefoni;
- segna «presente» da 30 minuti prima dell'inizio a 10 minuti dopo la fine; le lezioni
  passate si recuperano fino a 14 giorni indietro;
- un tocco sbagliato si annulla entro 2 minuti;
- **non scavalca l'istruttore**: se l'istruttore ha già segnato qualcuno
  assente, il tablet non lo cambia.

I numeri stanno in `tablet_regole()`, in cima a `04-tablet.sql`.

Per metterne uno in una sala: la sala ha un **nome utente** e una password,
non un'email. Supabase però vuole un'email, e l'app aggiunge da sé
`@sale.ods-corsi.it` al nome utente (vedi `DOMINIO_SALE` in `src/lib/tablet.ts`):
a quell'indirizzo non arriva mai niente, serve solo da nome.

Il modo più corto è **`account-sale.sql`** nel SQL Editor: per ogni sala che
non ha ancora un tablet crea l'utente e la riga in `postazioni`, e alla fine
mostra sala, nome utente e password. Il nome utente è il nome della sala in
minuscolo, senza accenti e con i trattini («Sala grande» → `sala-grande`). Le
password si vedono solo lì, una volta: vanno scritte subito. Si rilancia senza
danni, e una sala aggiunta dopo prende il suo account al giro successivo.

A mano, per una sala sola: si crea un utente in **Authentication → Users → Add
user → Create new user**, con email `lotta@sale.ods-corsi.it`, una password
lunga e **Auto Confirm User** acceso, poi

```sql
insert into postazioni (nome, sala_id, utente_id)
select 'Tablet Lotta', (select id from sale where nome = 'Lotta'),
       (select id from auth.users where email = 'lotta@sale.ods-corsi.it');
```

e sul tablet si apre l'app con `sala/` in fondo all'indirizzo (per esempio
`https://…/ods-corsi/sala/`), si fa l'accesso una volta con il nome utente (`lotta`) e la password, e
conviene installarla come app. Da lì il tablet riapre sempre il tablet e lo
schermo non si spegne. Se il tablet si perde,
`update postazioni set attiva = false where nome = 'Tablet Lotta'` lo spegne
subito, e poi si cancella l'utente. Per spostarlo in un'altra sala, o per farlo
tornare un dispositivo qualunque, c'è «Scollega il tablet» nell'area
istruttore.

### Il PIN degli istruttori

Dal tablet un istruttore può aprire l'appello completo con un PIN di 4 cifre.
Lo imposta solo la segreteria, dalla pagina Istruttori e accessi o così:

```sql
select imposta_pin((select id from persone where nome = 'Maura' and ruolo = 'istruttore'), '4321');
```

Un istruttore non se lo cambia da sé: dovendo essere diverso da quello di
tutti, il «già di un altro» gli farebbe scoprire quali PIN sono in uso.

Il PIN è salvato cifrato e due istruttori non possono avere lo stesso. Dopo 5
PIN sbagliati in 5 minuti il tablet si blocca per qualche minuto: gli altri
tablet no.

### La musica delle sale

Il tablet ha la musica nella barra in basso, sotto le presenze e sotto il
timer. Cosa far partire lo prepara la segreteria, da **Impostazioni → La
musica delle sale**: qualche lista, ognuna un nome e il link a una playlist di
YouTube o di Spotify, per una sala o per tutte (`09-musica.sql`, tabella
`musica_sale`). La segreteria le cura, il resto del personale le vede, il
tablet le legge da `musica_sala()` — solo quelle della sua sala e quelle di
tutte — e non le cambia.

### Il timer delle sale

Maurizio, i segnali, il volume, lo schermo e la musica durante il timer dei
tablet sono uguali su tutti i tablet, e si scelgono nelle impostazioni del
timer, su un tablet qualunque. Stanno nella riga delle impostazioni, colonna
`timer` (`10-timer-sale.sql`), così come le scrive l'app
(`timer/src/lib/impostazioniSala.ts`), e le legge chiunque abbia un accesso,
tablet compresi. La riga la cambia solo la segreteria: il tablet passa da
`salva_timer_sala` (`14-timer-dal-tablet.sql`), che cambia il timer e
nient'altro, e che chiama solo un tablet o la segreteria. Gli altri tablet le
prendono al loro giro, ogni cinque minuti.

La segreteria sceglie invece, da **Impostazioni → La voce dei tablet** e da **Esercizi** (`13-voce-esercizi.sql`): la voce di sistema, per nome (il
tablet usa quella con lo stesso nome, se ce l'ha, altrimenti la prima voce
italiana), le clip della voce incisa, nel contenitore privato `voce` che
legge chiunque abbia un accesso e scrive la segreteria, e il catalogo degli
esercizi, colonna `esercizi`. Lo storico dei timer dei tablet e degli
istruttori (`allenamenti`) la segreteria lo legge da **Impostazioni → Lo
storico dei timer**.

## 8. Il timer

Il timer (la cartella `timer/`) non ha una porta sua: trova l'accesso fatto in
ODS Corsi, perché le due app stanno sulla stessa origine e Supabase tiene la
sessione nel `localStorage`. Chi fa cosa, secondo `08-timer.sql`:

| | istruttore o segreteria | tablet di sala | senza accesso |
|---|---|---|---|
| timer della palestra | vede, crea, cambia; toglie quelli che ha creato (la segreteria tutti) | vede e fa partire | — |
| timer propri | vede, crea, cambia, toglie | — | — |
| timer di un collega | vede e copia, se collegato a un corso | vede e fa partire, se collegato a un corso | — |
| collegare un timer a un corso | sì, a qualunque corso | no | — |
| storico | scrive il suo, legge tutto | scrive e legge il suo | — |
| preferenze | le sue | quelle scelte dalla segreteria, senza cambiarle | — |

Senza accesso, in prova o senza database, il timer tiene tutto sul
dispositivo, com'è sempre stato. Chi aveva già dei timer sul telefono li porta
fra i suoi da **Impostazioni → ODS Corsi → PORTA FRA I MIEI**.

Le modifiche fatte senza rete restano in coda sul dispositivo (la stessa coda
delle presenze, sotto `ods-timer:coda`) e partono da sole quando il database
risponde. Quelle che il database rifiuta — un permesso che non c'è — si
lasciano andare invece di bloccare la coda, e restano solo su quel
dispositivo.

## 9. L'app

Le due variabili vanno messe dove si compila (in locale un file `.env`, su
GitHub Actions dei *repository secrets*):

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

L'indirizzo è la *Project URL* (**Integrations → Data API**, oppure
`https://<id del progetto>.supabase.co`); la chiave è la *publishable key* in
**Settings → API Keys**, o la vecchia chiave `anon` nella scheda *Legacy API
Keys*: vanno bene tutte e due.

La chiave `anon` **è pubblica** ed è fatta per finire nel codice del browser:
non è un segreto trapelato. A proteggere i dati sono le policy di
`02-policy.sql`, e sono quelle da guardare se qualcosa sembra troppo aperto.

## 10. Il backup

Il piano gratuito di Supabase fa i suoi backup ma non li lascia scaricare. La
copia che resta alla palestra la fa GitHub Actions, con
`.github/workflows/backup.yml`: ogni lunedì alle 3:17 UTC, o quando serve
(per esempio prima di lanciare un file SQL nuovo) dalla segreteria, più
sotto, o da **Actions → Backup del database → Run workflow**. Copia il database, non i file dello Storage
(moduli firmati, ricevute, clip della voce). Certificati e documenti d'identità
stanno su carta, in segreteria.

Servono due *repository secrets* in **Settings → Secrets → Actions**:

- **`SUPABASE_DB_URL`**: in Supabase, **Connect → Session pooler**, la stringa
  così come la mostra, con la password del database al posto di
  `[YOUR-PASSWORD]`. Ha questa forma:
  `postgresql://postgres.<id del progetto>:<password>@aws-<n>-<regione>.pooler.supabase.com:5432/postgres`,
  e per ODS-Sala la regione è `eu-north-1`. Il numero dopo `aws-` e la
  regione non vanno indovinati: si copia quella del pannello. Il *Session pooler* e non la
  *Direct connection*: quella parla solo IPv6, e le macchine di GitHub no.
- **`BACKUP_PASSWORD`**: una password lunga, inventata per questo, da tenere
  anche fuori da GitHub (la segreteria, un gestore di password). Il
  repository è pubblico e le copie le scarica chiunque abbia un account
  GitHub: per questo escono cifrate, e senza questa password non le apre
  nessuno, palestra compresa.

Senza `SUPABASE_DB_URL` il workflow passa senza fare niente; con l'indirizzo e
senza password si ferma rosso, invece di mettere fuori i dati in chiaro.

Ogni copia è un artefatto `backup-AAAA-MM-GG`, nella pagina del suo lancio in
**Actions**, e resta novanta giorni: ci sono sempre le ultime tredici
settimane. GitHub spegne i workflow programmati di un repository pubblico
dopo sessanta giorni senza commit, e lo dice per email: se succede, si
riaccende dalla stessa pagina con **Enable workflow**.

### Dalla segreteria, e su Drive

In **IMPOSTAZIONI → IL BACKUP** la segreteria vede com'è andato l'ultimo
backup e le copie che ci sono, ne fa partire una con **FAI UN BACKUP ORA**, e
ognuna la scarica con **SCARICA**: è lo zip che GitHub dà per l'artefatto, con
dentro il file cifrato, da mettere su Drive così com'è. Cifrato com'è, può
stare anche in una cartella condivisa; la password no.

Per chiedere le copie a GitHub serve un token, e nell'app non può stare: lo
tiene la funzione **`backup`** (`functions/backup/index.ts`), che controlla
che chi la chiama sia della segreteria. Per metterla in piedi, una volta:

1. **Il token.** Su GitHub, **Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token**: *Repository access*
   solo questo repository, *Permissions → Actions: Read and write*, e
   nient'altro. Scade al massimo dopo un anno: quando scade, la segreteria
   legge «GitHub non accetta il token» e se ne fa uno nuovo.
2. **I segreti della funzione.** In Supabase, **Edge Functions → Secrets**:
   `GITHUB_TOKEN` col token. `GITHUB_REPO` serve solo se il repository non
   è `nalbertini/ods-corsi`.
3. **La funzione**, come `invita`:

   ```sh
   supabase functions deploy backup --project-ref <id-del-progetto>
   ```

   o dal pannello, **Edge Functions → Deploy a new function**, col nome
   `backup`.

Il pulsante fa partire il workflow su `main`: finché il workflow non è lì,
GitHub dice che non lo trova.

### Rimettere a posto una copia

In un progetto nuovo creato come al passo 1 (schema, persone e account
arrivano con la copia: i file `NN-*.sql` non servono). Lo zip scaricato
dall'app o da GitHub si apre prima, con `unzip backup-AAAA-MM-GG.zip`; poi:

```
gpg -d backup-AAAA-MM-GG.tar.gz.gpg | tar xz
cd backup-AAAA-MM-GG
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file ruoli.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file dati.sql \
  --dbname "<la stringa del Session pooler del progetto nuovo>"
```

`session_replication_role = replica` tiene spenti i trigger mentre entrano i
dati, che altrimenti ricalcolerebbero lezioni e numeri delle ricevute già
fatti. Dopo, l'app va ripuntata sul progetto nuovo (passo 9) e i file dello
Storage ricaricati a mano.

## Le cose da decidere prima di usarlo sul serio

- **L'informativa privacy.** Nomi e presenze sono dati personali e la palestra
  ne è titolare del trattamento. L'informativa è in
  `informativa.html` (quella del sito copre solo la navigazione), e la
  palestra l'ha approvata il 27 settembre 2026: per quanto si tengono
  richieste, documenti e ricevute, e che l'app si pubblica con GitHub Pages.
  L'ha riapprovata il 2 ottobre 2026, quando si è corretto dove stanno i
  dati (Stoccolma, non Francoforte).
  Si vede in fondo alla pagina delle iscrizioni, a tutti, e col database vero
  accende il modulo di iscrizione dell'app. I tempi di conservazione che
  promette (una richiesta rifiutata via entro 30 giorni, il documento
  d'identità non oltre la fine della stagione) oggi li rispetta la segreteria
  a mano, con «Elimina richiesta e file».
- **Per quanto si tengono le presenze.** `presenze_scadute` dice cosa è
  scaduto e `pulisci_presenze()` lo cancella; il periodo di partenza è
  ventiquattro mesi e si cambia in **IMPOSTAZIONI**. È una scelta della
  palestra, non una regola che decide il codice. L'informativa la riporta da
  sé, chiedendola a `mesi_presenze_pubblici()` (`31-informativa-mesi.sql`):
  finché non c'è, dice «per il periodo stabilito dalla palestra».
- **Il certificato medico è un dato sanitario.** È l'unico che la palestra
  tiene, perché senza non si fa sport. È un'altra categoria di dati (art. 9
  del GDPR), con altri obblighi: per questo il foglio sta su carta, in un
  armadio chiuso, e nell'app c'è solo fino a quando vale, che vede solo la
  segreteria. La palestra deve dirlo nell'informativa (lo dice) e decidere
  per quanto tenerlo (finché vale, poi via quando arriva il nuovo o
  l'iscritto smette). Patologie e simili, invece, non ci vanno.

## Provare lo schema senza Supabase

Nella cartella `prova/` ci sono i file usati per verificare schema, policy e
funzioni su un Postgres qualunque: `finto-supabase.sql` rifà il minimo che
Supabase mette a disposizione (`auth.users`, `auth.uid()`, i ruoli),
`calendario.sql` prova la generazione delle lezioni e il cambio dell'ora
legale, `rls.sql` prova che chi non ha fatto l'accesso chiami solo le funzioni del
modulo di iscrizione e che ogni funzione abbia il suo `search_path`, poi gli accessi dal punto di vista di un iscritto, di un
istruttore, della segreteria e di chi non ha fatto l'accesso, `tablet.sql`
prova il tablet di sala: le finestre di tempo, il recupero, l'annullo, il PIN
e il blocco, e che il tablet non veda niente più di quel che deve;
`segreteria.sql` prova cosa succede alle lezioni quando un corso, o uno dei
suoi giorni, cambia sala, quando cambiano istruttore o giorni, o si archivia, e il primo accesso; `iscrizioni.sql`
prova il modulo di iscrizione: cosa può fare chi non ha un accesso, i limiti
sui file (anche documento e certificato, e che si trovino da stampare), e chi accoglie le richieste;
`certificati.sql` prova che certificati, documento e pagamenti li veda e li
cambi solo la segreteria, e che di certificati nuovi nello Storage non ne
entrino; `timer.sql` prova il timer:
chi vede e cambia i timer della palestra, i propri e quelli dei colleghi, il
tablet che li apre senza scriverli, lo storico e le preferenze; `musica.sql`
prova la musica delle sale: la cura la segreteria, e il tablet vede solo la
sua; in fondo, che il timer delle sale lo legga il tablet e lo cambi, dalla
sua funzione, solo lui o la segreteria, senza toccare il resto della riga; `timer-lezioni.sql`, dopo `timer.sql`, prova il timer di
una singola lezione: lo lega il personale, lo legge il tablet, e un timer
personale legato a una lezione lo vedono anche gli altri; `calendario-da-se.sql`
prova il calendario che si allunga da sé: lo allunga anche un istruttore, ma
solo quando serve e fin dove dicono le regole, e non fuori dalle date dei corsi; `calendario-pronto-fino.sql` prova che
fin dove è pronto il calendario lo dicano le lezioni dell'orario, e che una
straordinaria lontana non lo fermi; `presenze-istruttori.sql`, dopo
`tablet.sql`, prova la presenza degli istruttori dal PIN: confermata da sola a
chi era previsto (anche da sostituto), da confermare agli altri, e confermata
o rifiutata solo dalla segreteria; `istruttori-dalle-lezioni.sql`, dopo
`presenze-istruttori.sql`, prova chi fa l'appello (confermato se previsto, da
confermare se no, la segreteria al banco no), le lezioni tenute senza
l'istruttore segnato, la scelta di chi c'era fatta solo dalla segreteria e
solo fra i previsti, e da quando si propongono; `informativa-mesi.sql` prova
che chi non ha un accesso legga i mesi delle presenze, quelli che la segreteria
ha appena salvato, e nient'altro della tabella, anche dopo aver rilanciato
`06-iscrizioni.sql`; `ricevute.sql` prova le ricevute: le fa e le
annulla solo la segreteria, il numero va avanti da sé e riparte ogni anno, i
conti li fa il server, e una fatta non si cambia; `anagrafiche.sql` prova
nascita, residenza e genitore degli iscritti importati: li vede e li cambia
solo la segreteria, e se ne vanno con la persona. `statistiche.sql` prova le
statistiche: i numeri di ogni lezione contati come in PRESENZE, le prove,
chi l'ha fatta, gli incassi del mese, e che le veda solo la segreteria. `segnalazioni.sql` prova le
segnalazioni: le legge e le scrive solo la segreteria, l'autore è sempre chi
scrive, si risponde solo a un filo, un messaggio non si cambia, di un filo si
cambia solo se è chiuso, e niente si cancella; gli allegati li vede e li carica la segreteria (max 3, tipi e peso del contenitore), li toglie solo chi li ha mandati lasciando la traccia, e dopo 30 giorni dalla chiusura si tolgono. `elimina-istruttore.sql` prova
che un istruttore lo elimini solo la segreteria, e solo se non ha corsi,
lezioni o presenze, anche cancellando la riga a mano. `unisci-doppioni.sql` prova
che due schede le unisca solo la segreteria, solo fra iscritti senza accesso
e mai con due codici fiscali diversi, che passi tutto (una presenza per
lezione, un'iscrizione per corso, le ricevute intatte, chi ha segnato le
presenze) e che un errore a metà non cambi niente. `non-doppioni.sql` prova
che le coppie «non sono doppioni» le veda, le segni e le tolga solo la
segreteria, una riga per coppia a nome di chi scrive, e che unendo due schede
le coppie passino senza fermare l'unione. `finto-supabase.sql` rifà anche le due
tabelle dello Storage che le policy dei file guardano.
