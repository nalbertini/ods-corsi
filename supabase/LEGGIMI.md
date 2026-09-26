# La sala corsi: mettere in piedi il database

L'app funziona senza tutto questo: senza le due variabili d'ambiente parte in
**modalità prova**, con l'orario vero e degli iscritti inventati, e lo dice con un
nastro giallo in cima allo schermo. Questi passi servono quando si vuole il
calendario vero della palestra.

## 1. Il progetto

Su [supabase.com](https://supabase.com) si crea un progetto nella regione
**Frankfurt (eu-central-1)**, che è la più vicina e tiene i dati in Europa — e
i dati qui dentro sono nomi e presenze di persone, quindi non è un dettaglio.

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
7. `07-certificati-pagamenti.sql` — il certificato medico e il pagamento degli iscritti
8. `08-timer.sql` — il timer: la libreria della palestra, i timer personali e dei corsi, lo storico, le preferenze
9. `09-musica.sql` — la musica delle sale, che il tablet fa partire dalla sua barra
10. `10-timer-sale.sql` — il timer dei tablet di sala, scelto dalla segreteria
11. `11-timer-lezioni.sql` — il timer di una singola lezione, scelto dall'istruttore in I MIEI TIMER
12. `12-calendario-da-se.sql` — il calendario che si allunga da sé, senza job

Si possono rilanciare tutti quante volte si vuole: non distruggono niente.
Rilanciarne uno dei primi cinque rimette i permessi di default alle sue
funzioni, quindi dopo va rilanciato anche `06-iscrizioni.sql`.

Su un database già in uso, dopo un aggiornamento dell'app si rilanciano i
file cambiati e poi `06-iscrizioni.sql`. Per certificati e pagamenti basta
lanciare `07-certificati-pagamenti.sql`: finché non c'è, l'elenco degli
iscritti si vede lo stesso, e salvare un certificato dice che manca. Per la sala dei singoli giorni
(la colonna `ricorrenze.sala_id`) sono `01-schema.sql`, `03-funzioni.sql`,
`04-tablet.sql` e `05-segreteria.sql`: le lezioni già generate restano dove
sono. Per il timer basta lanciare `08-timer.sql`, che non chiede di
rilanciare `06-iscrizioni.sql`: finché non c'è, il timer tiene tutto sul
dispositivo come prima e dice che il database non risponde. Lo stesso per la
musica delle sale con `09-musica.sql`: finché non c'è, la segreteria dice che
le liste non si leggono e il tablet suona quella delle impostazioni del timer.
E per il timer delle sale con `10-timer-sale.sql`: finché non c'è, la
segreteria dice che il timer delle sale non si legge e i tablet tengono le
impostazioni che avevano. Per il timer delle singole lezioni con
`11-timer-lezioni.sql`: finché non c'è, I MIEI TIMER dice che le lezioni non
si leggono, e le lezioni aprono i timer del corso come prima. Per il
calendario che si allunga da sé si rilanciano `03-funzioni.sql`, poi
`06-iscrizioni.sql`, poi `12-calendario-da-se.sql`: finché non c'è, il
calendario si allunga solo con RIGENERA o con il job settimanale.

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

Per la segreteria il ruolo è `staff`.

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

L'orario della stagione 2026/27, copiato dal volantino «Corsi e attività» e
corretto con il foglio dei costi dove i due non coincidono, è in
[`dati/corsi-2026-27.csv`](../dati/corsi-2026-27.csv). Una cosa manca ancora:
**gli istruttori hanno solo il nome.** Finché nel foglio non c'è il cognome i
corsi entrano senza istruttore, e lo script lo dice riga per riga.

I corsi con più istruttori (Lotta, Preparazione atletica) li legano tutti in
`corsi_istruttori`: ognuno può fare l'appello e aggiornare le lezioni del
corso. `corsi.istruttore_id` resta il primo della lista, quello di riferimento.

## 5. Il modulo di iscrizione

Chi si iscrive lo compila dalla pagina pubblica (`iscrizioni/`), senza un accesso: le
domande di prima (i dati di chi si iscrive, del genitore se è minorenne, la
residenza, i corsi, come paga) e tre file, cioè il modulo firmato, il
documento e la ricevuta. La segreteria le trova in **SEGRETERIA → RICHIESTE
ONLINE**, guarda i file e la accoglie o la rifiuta. Chi manda una richiesta
rifiutata non viene avvisato dall'app: va chiamato o scritto a mano.

Cosa fa `06-iscrizioni.sql`:

- la tabella `richieste_iscrizione`, che legge e cambia solo la segreteria;
- il contenitore **`iscrizioni`** nello Storage, privato: niente link
  pubblici, la segreteria apre i file con un link che dura dieci minuti;
- chi non ha un accesso può solo chiamare `corsi_aperti()` e
  `invia_iscrizione()`, e caricare al massimo quattro file (foto o PDF, fino a
  10 MB) nella cartella della richiesta appena mandata, entro un'ora. Non li
  può rileggere né sostituire;
- la porta non è spalancata: tre richieste al giorno dalla stessa email, trenta
  all'ora in tutto. I numeri stanno in `iscrizioni_regole()`;
- accogliere (`accogli_iscrizione`) mette la persona in elenco e la iscrive ai
  corsi scelti. Se c'era già la ritrova: dal codice fiscale di una richiesta
  accolta prima, oppure da nome e cognome con la stessa email o senza. Due
  fratelli iscritti dalla stessa email entrano tutti e due, e il secondo resta
  senza email, perché in `persone` un'email può essere di una persona sola;
- `anon`, che finora non aveva nemmeno lo schema, ora lo vede per queste due
  funzioni. Prima di aprirglielo il file gli toglie tutte le altre:
  `materializza_sessioni` e `pulisci_presenze`, per esempio, lasciano passare
  chi non ha un utente, perché è così che le chiama un job.

**Si accende con l'informativa approvata.** Il modulo chiede codici fiscali
e documenti d'identità, e col database vero l'app lo mostra solo quando
l'informativa (`public/informativa.html`) è approvata, cioè quando in
`src/lib/iscrizione.ts` `INFORMATIVA_BOZZA` è `false`. Fino ad allora il passo
porta ancora al modulo Google (`LINK_ISCRIZIONE`). In prova il modulo è
sempre acceso.

**Le domande** sono ricavate dai moduli di autorizzazione e dai passi di
prima, non copiate dal modulo Google, che senza accesso non si legge. Se
quello chiedeva altro, vanno allineati tre posti: `invia_iscrizione` qui,
`controlla()` in `src/lib/richieste.ts` e `ModuloIscrizione.tsx`.

**Per quanto si tengono.** Accolta o rifiutata, una richiesta resta con i suoi
file finché la segreteria non la elimina («Elimina richiesta e file», nella
richiesta). Il documento d'identità serve per il tesseramento, poi no: quanto
tenerlo è una scelta della palestra da mettere nell'informativa.

### Il certificato medico e il pagamento

Nella scheda di ogni iscritto (**SEGRETERIA → ISCRITTI**) la segreteria
carica il certificato medico, con la data fino a cui vale, e segna se ha
pagato: da pagare, in parte o pagato, e per il trimestre fino a quando.
L'elenco dice chi non è in regola e si filtra.

Cosa fa `07-certificati-pagamenti.sql`:

- la tabella `schede_iscritti`, una riga per persona, che legge e cambia solo
  la segreteria. Sta a parte da `persone` apposta: gli istruttori leggono
  `persone` per l'appello, e il certificato è un dato sulla salute. Chi l'ha
  cambiata e quando lo scrive il server;
- il contenitore **`certificati`** nello Storage, privato, solo per la
  segreteria: il file sta in `<persona>/certificato-<n>.<est>`, si apre con un
  link di dieci minuti, e quando ne arriva uno nuovo il vecchio si cancella;
- la riga se ne va con la persona (`on delete cascade`). Il file, se la
  persona si cancella dal database a mano, resta nel contenitore e va tolto
  a mano anche lui.

Il modulo online non chiede il certificato: si consegna in segreteria, che lo
carica. L'esportazione dei dati di una persona (REGOLE E PRIVACY) lo
comprende.

## 6. Il calendario

`materializza_sessioni` trasforma le ricorrenze in lezioni vere, ognuna nella
sala del suo giorno (`ricorrenze.sala_id`) o, se il giorno non ne ha una, in
quella del corso. L'import la
chiama già per i due mesi successivi; poi il calendario si allunga da sé
(`12-calendario-da-se.sql`): quando l'app legge il calendario — un
istruttore, la segreteria o un tablet di sala — chiama `allunga_calendario`,
che lo allunga se alla fine manca meno di metà del periodo. Quanti giorni
avanti si decide in **SEGRETERIA → REGOLE E PRIVACY**.

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
timer. Cosa far partire lo prepara la segreteria, da **Regole e privacy → La
musica delle sale**: qualche lista, ognuna un nome e il link a una playlist di
YouTube o di Spotify, per una sala o per tutte (`09-musica.sql`, tabella
`musica_sale`). La segreteria le cura, il resto del personale le vede, il
tablet le legge da `musica_sala()` — solo quelle della sua sala e quelle di
tutte — e non le cambia.

### Il timer delle sale

Maurizio, i segnali, il volume, lo schermo e la musica durante il timer dei
tablet li sceglie la segreteria, da **Regole e privacy → Il timer delle
sale**, per tutti i tablet. Stanno nella riga delle impostazioni, colonna
`timer` (`10-timer-sale.sql`), così come le scrive l'app
(`timer/src/lib/impostazioniSala.ts`): le legge chiunque abbia un accesso,
tablet compresi, le cambia la segreteria. Sul tablet non si cambiano.

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

## Le cose da decidere prima di usarlo sul serio

- **L'informativa privacy.** Nomi e presenze sono dati personali e la palestra
  ne è titolare del trattamento. Ce n'è una **bozza** in
  `public/informativa.html`, scritta insieme all'app: quella del sito copre
  solo la navigazione. La palestra la deve leggere e fare sua, e decidere i
  punti fra quadre: per quanto si tengono richieste, documenti e ricevute, e
  dove si pubblica l'app. Poi si toglie il riquadro BOZZA dalla pagina e si
  mette `INFORMATIVA_BOZZA = false` in `src/lib/iscrizione.ts`: da lì si vede
  in fondo alla pagina delle iscrizioni, a tutti, e col database vero accende il
  modulo di iscrizione dell'app.
- **Per quanto si tengono le presenze.** `presenze_scadute` dice cosa è
  scaduto e `pulisci_presenze()` lo cancella; il periodo di partenza è
  ventiquattro mesi e si cambia in **REGOLE E PRIVACY**. È una scelta della
  palestra, non una regola che decide il codice.
- **Il certificato medico è un dato sanitario.** È l'unico che l'app tiene,
  perché senza non si fa sport, e lo vede solo la segreteria. È un'altra
  categoria di dati (art. 9 del GDPR), con altri obblighi: la palestra deve
  dirlo nell'informativa (la bozza ne parla già) e decidere per quanto
  tenerlo. Patologie e simili, invece, non ci vanno.

## Provare lo schema senza Supabase

Nella cartella `prova/` ci sono i file usati per verificare schema, policy e
funzioni su un Postgres qualunque: `finto-supabase.sql` rifà il minimo che
Supabase mette a disposizione (`auth.users`, `auth.uid()`, i ruoli),
`calendario.sql` prova la generazione delle lezioni e il cambio dell'ora
legale, `rls.sql` prova gli accessi dal punto di vista di un iscritto, di un
istruttore, della segreteria e di chi non ha fatto l'accesso, `tablet.sql`
prova il tablet di sala: le finestre di tempo, il recupero, l'annullo, il PIN
e il blocco, e che il tablet non veda niente più di quel che deve;
`segreteria.sql` prova cosa succede alle lezioni quando un corso, o uno dei
suoi giorni, cambia sala, quando cambiano istruttore o giorni, o si archivia, e il primo accesso; `iscrizioni.sql`
prova il modulo di iscrizione: cosa può fare chi non ha un accesso, i limiti
sui file, e chi accoglie le richieste; `certificati.sql` prova che certificati
e pagamenti li veda e li cambi solo la segreteria; `timer.sql` prova il timer:
chi vede e cambia i timer della palestra, i propri e quelli dei colleghi, il
tablet che li apre senza scriverli, lo storico e le preferenze; `musica.sql`
prova la musica delle sale: la cura la segreteria, e il tablet vede solo la
sua; in fondo, che il timer delle sale lo cambi solo la segreteria e il
tablet lo legga; `timer-lezioni.sql`, dopo `timer.sql`, prova il timer di
una singola lezione: lo lega il personale, lo legge il tablet, e un timer
personale legato a una lezione lo vedono anche gli altri; `calendario-da-se.sql`
prova il calendario che si allunga da sé: lo allunga anche un istruttore, ma
solo quando serve e fin dove dicono le regole. `finto-supabase.sql` rifà anche le due
tabelle dello Storage che le policy dei file guardano.
