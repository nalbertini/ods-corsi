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

## 2. Lo schema

Nel **SQL Editor** del progetto, si incollano e si lanciano **in quest'ordine**:

1. `01-schema.sql` — tabelle, indici, vincoli
2. `02-policy.sql` — chi può vedere e fare cosa
3. `03-funzioni.sql` — il calendario, il tracciamento di chi segna, la pulizia
4. `04-tablet.sql` — il tablet di sala e i PIN degli istruttori
5. `05-segreteria.sql` — le lezioni che seguono i cambi dei corsi, il primo accesso
6. `06-iscrizioni.sql` — il modulo di iscrizione, i suoi file, e chi può chiamare cosa

Si possono rilanciare tutti quante volte si vuole: non distruggono niente.
Rilanciarne uno dei primi cinque rimette i permessi di default alle sue
funzioni, quindi dopo va rilanciato anche `06-iscrizioni.sql`.

## 3. Le persone

Con il database vero la scheda **CORSI** chiede l'accesso: calendario e
appello sono solo per istruttori e segreteria. **ISCRIZIONI** resta aperta a
tutti.

Ogni istruttore e chi sta in segreteria ha bisogno di due cose: un utente in
**Authentication → Users** e una riga in `persone` che lo colleghi. Un account
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

Chi ha il ruolo `staff` vede anche la scheda **SEGRETERIA**: la settimana, i
corsi e gli iscritti, pensati per il computer della reception.

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
| `sala` | Creata se non c'è |
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

Chi si iscrive lo compila dalla scheda **ISCRIZIONI**, senza un accesso: le
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

## 6. Il calendario

`materializza_sessioni` trasforma le ricorrenze in lezioni vere. L'import la
chiama già per i due mesi successivi; poi va richiamata ogni tanto, con un job
settimanale (**Database → Cron**). Quanti giorni avanti si decide in
**SEGRETERIA → REGOLE E PRIVACY**, e il job lo legge da lì:

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
- segna «presente» da 30 minuti prima dell'inizio a 10 minuti dopo; le lezioni
  passate si recuperano fino a 14 giorni indietro;
- un tocco sbagliato si annulla entro 2 minuti;
- **non scavalca l'istruttore**: se l'istruttore ha già segnato qualcuno
  assente, il tablet non lo cambia.

I numeri stanno in `tablet_regole()`, in cima a `04-tablet.sql`.

Per metterne uno in una sala: si crea un utente in **Authentication → Users**
(per esempio `tablet-lotta@…`, con una password lunga), poi

```sql
insert into postazioni (nome, sala_id, utente_id)
select 'Tablet Lotta', (select id from sale where nome = 'Lotta'),
       (select id from auth.users where email = 'tablet-lotta@esempio.it');
```

e sul tablet si apre l'app con `#tablet` in fondo all'indirizzo (per esempio
`https://…/ods-corsi/#tablet`), si fa l'accesso una volta con quell'utente e
conviene installarla come app. Da lì il tablet riapre sempre il tablet e lo
schermo non si spegne. Se il tablet si perde,
`update postazioni set attiva = false where nome = 'Tablet Lotta'` lo spegne
subito, e poi si cancella l'utente. Per spostarlo in un'altra sala, o per farlo
tornare un dispositivo qualunque, c'è «Scollega il tablet» nell'area
istruttore.

### Il PIN degli istruttori

Dal tablet un istruttore può aprire l'appello completo con un PIN di 4 cifre.
Lo imposta la segreteria (o l'istruttore per sé):

```sql
select imposta_pin((select id from persone where nome = 'Maura' and ruolo = 'istruttore'), '4321');
```

Il PIN è salvato cifrato e due istruttori non possono avere lo stesso. Dopo 5
PIN sbagliati in 5 minuti il tablet si blocca per qualche minuto: gli altri
tablet no.

## 8. L'app

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
  in fondo alla scheda ISCRIZIONI, a tutti, e col database vero accende il
  modulo di iscrizione dell'app.
- **Per quanto si tengono le presenze.** `presenze_scadute` dice cosa è
  scaduto e `pulisci_presenze()` lo cancella; il periodo di partenza è
  ventiquattro mesi e si cambia in **REGOLE E PRIVACY**. È una scelta della
  palestra, non una regola che decide il codice.
- **Niente dati sanitari.** Certificati medici e simili sono un'altra
  categoria, con un altro livello di obblighi: qui dentro non ci vanno.

## Provare lo schema senza Supabase

Nella cartella `prova/` ci sono i file usati per verificare schema, policy e
funzioni su un Postgres qualunque: `finto-supabase.sql` rifà il minimo che
Supabase mette a disposizione (`auth.users`, `auth.uid()`, i ruoli),
`calendario.sql` prova la generazione delle lezioni e il cambio dell'ora
legale, `rls.sql` prova gli accessi dal punto di vista di un iscritto, di un
istruttore, della segreteria e di chi non ha fatto l'accesso, `tablet.sql`
prova il tablet di sala: le finestre di tempo, il recupero, l'annullo, il PIN
e il blocco, e che il tablet non veda niente più di quel che deve;
`segreteria.sql` prova cosa succede alle lezioni quando un corso cambia sala,
istruttore o giorni, o si archivia, e il primo accesso; `iscrizioni.sql`
prova il modulo di iscrizione: cosa può fare chi non ha un accesso, i limiti
sui file, e chi accoglie le richieste. `finto-supabase.sql` rifà anche le due
tabelle dello Storage che le policy dei file guardano.
