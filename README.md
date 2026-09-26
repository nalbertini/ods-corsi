# ODS Corsi

Il calendario dei corsi e il registro delle presenze di **Officine Dello Sport**,
Collegno.

È un progetto separato dal timer ([nalbertini/Timer-](https://github.com/nalbertini/Timer-))
di proposito: la presenza riguarda la palestra, il timer riguarda la lezione, e
tenerli nello stesso posto li legava più di quanto servisse. Le due app hanno lo
stesso marchio e lo stesso modo di fare le cose, e nient'altro in comune.

## Cosa fa oggi

- **Il calendario**: una striscia di sette giorni e sotto le lezioni di quello
  scelto, in ordine di orario, con sala, istruttore e iscritti.
- **L'appello**: l'elenco degli iscritti, un tocco per riga — presente, assente,
  non segnato — e `TUTTI PRESENTI` in cima, perché in una classe di ventidue con
  venti presenti si segnano due assenze invece di venti presenze.
- **Il tablet di sala**: un tablet appeso al muro di ogni sala con il calendario
  della sala. Chi arriva tocca il suo nome e la presenza è segnata, senza
  domande e con ANNULLA per chi sbaglia; chi si è dimenticato recupera le
  lezioni delle ultime due settimane partendo dal corso; l'istruttore, col suo
  PIN, apre l'appello completo e vede chi si è segnato da sé. Si apre con
  `#tablet` in fondo all'indirizzo, e da lì il dispositivo resta un tablet.
- **La segreteria**: per il computer della reception, a chi ha il ruolo di
  segreteria. La **settimana** in una griglia, con gli appelli che mancano in
  rosso, e ogni lezione si apre per annullarla, dare un sostituto, spostarla di
  sala o segnare tutti presenti; le lezioni straordinarie. I **corsi**, con sala,
  istruttori, posti, colore e i giorni in cui si fanno. Gli **iscritti**, da
  cercare, iscrivere e togliere dai corsi, con quanto vengono negli ultimi
  trenta giorni. Le **presenze** del mese: medie per corso, chi si sta
  perdendo, gli appelli che mancano, e il CSV. L'**import dai fogli Excel**, e delle risposte del modulo Google così come
  si scaricano, con le colonne e i corsi da abbinare.
  **Istruttori e accessi**, coi PIN del tablet. Le **regole**: per quanto si
  tengono le presenze, fin dove si prepara il calendario, le sale, e
  l'esportazione dei dati di una persona.
- **Il modulo di iscrizione**, al posto di quello su Google Form: chi si
  iscrive risponde alle domande dal telefono e carica il modulo firmato, il
  documento e la ricevuta; per un minore la data di nascita fa chiedere i dati
  del genitore. Le richieste arrivano in segreteria, in **RICHIESTE ONLINE**,
  con i file da guardare: accolta, la persona entra in elenco iscritta ai
  corsi che ha scelto, senza doppioni se c'era già. Col database vero si
  accende quando l'informativa privacy (`public/informativa.html`, per ora una
  bozza da far approvare alla palestra) è approvata; fino ad allora resta il
  link a Google.
- **L'accesso** col database: calendario, appello e segreteria sono per
  istruttori e segreteria; al primo accesso l'account si lega da sé alla
  persona con la stessa email.
- **Senza rete non si perde niente**: ogni presenza è scritta sul dispositivo
  prima di partire e resta in coda finché il server non l'ha presa.

## Provarla

```
npm install
npm run dev
```

Senza configurazione parte in **modalità prova**, con l'orario vero della stagione
2026/27, degli iscritti inventati e un nastro giallo che lo dichiara. Le presenze segnate in prova restano
sul dispositivo e basta.

La scheda **SEGRETERIA** in prova è aperta a tutti: i corsi, i giorni e gli
iscritti che si cambiano lì restano su questo dispositivo, e li vedono anche il
calendario, l'appello e il tablet. «Riparti dall'orario vero», in fondo al menu
della segreteria, rimette tutto com'era.

Il tablet di sala si prova dal link nel nastro giallo, o aprendo
`http://localhost:5173/#tablet`. In prova la sala si sceglie da un elenco, e
l'orologio si può spostare per vedere una lezione che si apre:
`http://localhost:5173/?adesso=2026-09-24T17:55#tablet` è giovedì alle sei meno
cinque, con il Judo agonisti in cui ci si segna. I PIN di prova sono 1234
(Maurizio), 2468 (Maura) e 5678 (Fabio).

## Il database

Supabase, con la sicurezza tutta nelle policy RLS. Come metterlo in piedi, come
importare corsi e iscritti da un foglio Excel e cosa decidere prima di usarlo sul
serio: [`supabase/LEGGIMI.md`](supabase/LEGGIMI.md).

## Le prove

| | |
|---|---|
| `npm run prova:coda` | La coda delle scritture offline, senza browser: i sei casi che contano. |
| `npm run prova:segreteria` | La segreteria di prova: i cambi di un corso che arrivano al calendario, all'appello e al tablet. |
| `npm run prova:richieste` | Il modulo di iscrizione di prova: gli stessi rifiuti del database, e una richiesta accolta che diventa un iscritto. |
| `npm run prova:tablet` | Le regole del tablet di prova: finestre di tempo, recupero, annullo, PIN, il tablet che non scavalca l'istruttore. |
| `supabase/prova/calendario.sql` | La generazione delle lezioni, il cambio dell'ora legale, la rigenerazione che non duplica. |
| `supabase/prova/rls.sql` | Gli accessi dal punto di vista di un iscritto, di un istruttore, della segreteria e di chi non ha fatto l'accesso. |
| `supabase/prova/segreteria.sql` | Le lezioni che seguono i cambi dei corsi, i giorni tolti, gli archiviati, il primo accesso. |
| `supabase/prova/iscrizioni.sql` | Il modulo di iscrizione: cosa può fare chi non ha un accesso, i file, chi accoglie le richieste e come ritrova chi c'era già. |
| `supabase/prova/tablet.sql` | Le stesse regole del tablet, dal lato del database, e che il tablet non veda niente più di quel che deve. |

I file SQL girano su un Postgres qualunque con `supabase/prova/finto-supabase.sql`
applicato prima: rifà il minimo che Supabase mette a disposizione.

## Da dove viene

Il lavoro è partito dentro il timer, come «fase 1 della sala corsi»
([PR #9](https://github.com/nalbertini/Timer-/pull/9), chiusa senza unirla), ed è
stato spostato qui togliendo tutto quello che lo legava al timer: la tabella degli
allenamenti, il collegamento fra un corso e il suo timer, il tasto per avviarlo
dall'appello.
