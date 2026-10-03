# ODS Corsi

Il calendario dei corsi e il registro delle presenze di **Officine Dello Sport**,
Collegno.

Nella cartella [`timer/`](timer/README.md) c'è anche l'interval timer delle
lezioni, portato qui da [nalbertini/Timer-](https://github.com/nalbertini/Timer-)
con tutta la sua storia, per integrare meglio le due app. Per ora resta un'app
a sé — il suo `package.json`, il suo service worker, la sua installazione — ma
si pubblica insieme a ODS Corsi, nella sottocartella `timer/` dello stesso sito.

## Cosa fa oggi

L'app ha cinque indirizzi veri, ognuno con il suo accesso
(`nalbertini.github.io/ods-corsi/segreteria/` e così via):

| | |
|---|---|
| `istruttori/` | Il calendario e l'appello, per istruttori e segreteria. |
| `segreteria/` | L'area della reception, solo per chi ha il ruolo di segreteria (anche insieme a quello di istruttore). |
| `iscrizioni/` | La pagina pubblica per chi vuole iscriversi, senza accesso. |
| `iscritti/` | La pagina di chi frequenta i corsi. Il pilota, per ora solo in prova. |
| `sala/` | Il tablet di sala. |

I vecchi indirizzi col cancelletto (`#segreteria`, `#sala`, `#tablet`…)
portano da soli a quelli nuovi, così i tablet già appesi e i link già mandati
continuano a funzionare. GitHub Pages serve solo file che esistono, quindi la
compilazione mette in ogni cartella una copia della pagina con
`<base href="../">` (vedi `pagineDelleAree` in `vite.config.ts`): l'app resta
una sola, e i file si prendono dalla radice come prima.

Senza niente in fondo all'indirizzo si apre la porta unica dell'accesso, che
porta ognuno nella sua area (in prova, una pagina con tutte), tranne
su un tablet di sala, che va sempre al tablet. Non c'è una pagina per
scegliere l'area: la sceglie l'account. Tranne per chi ha il ruolo doppio,
segreteria e istruttore (`persone.anche_istruttore`, in
`supabase/01-schema.sql`): dopo l'accesso sceglie se andare in segreteria o
nel calendario, e poi passa dall'uno all'altra dal menu senza uscire. Il **timer** si apre in `timer/`
(`nalbertini.github.io/ods-corsi/timer/`), dal menu degli istruttori.

- **Il calendario**: una striscia di sette giorni e sotto le lezioni di quello
  scelto, in ordine di orario, con sala, istruttore e iscritti.
- **I miei timer**: nell'area istruttori, quali timer partono con ogni corso e
  con ogni singola lezione delle prossime due settimane, anche più d'uno;
  quelli di una lezione vengono prima di quelli del corso, dall'appello e sul tablet di sala
  (`supabase/11-timer-lezioni.sql`).
- **L'appello**: l'elenco degli iscritti, un tocco per riga — presente, assente,
  non segnato — e `TUTTI PRESENTI` in cima, perché in una classe di ventidue con
  venti presenti si segnano due assenze invece di venti presenze.
  `CHIUDI L'APPELLO` in fondo segna assenti i non segnati e dice se è arrivato
  in segreteria; il calendario degli istruttori apre con la lezione di adesso e
  tiene in rosso gli appelli da chiudere degli ultimi sette giorni.
- **Le prove**: chi viene a provare lo aggiunge all'appello chi lo sta facendo,
  col tasto `PROVE` (l'istruttore dall'app o dal tablet col PIN, la segreteria
  dalla lezione aperta): nome, cognome e telefono, o chi è già venuto a
  provare, ritrovato per nome. Entra già presente, e la segreteria lo ritrova in
  PRESENZE per richiamarlo (`supabase/21-prove.sql`).
- **Il tablet di sala**: un tablet appeso al muro di ogni sala con il calendario
  della sala. Chi arriva tocca il suo nome e la presenza è segnata, senza
  domande e con ANNULLA per chi sbaglia; chi si è dimenticato recupera le
  lezioni delle ultime due settimane partendo dal corso; l'istruttore, col suo
  PIN, apre l'appello completo e vede chi si è segnato da sé; durante una
  lezione il PIN segna anche la sua presenza, da sola se era previsto su
  quella lezione, se no da confermare in segreteria
  (`supabase/15-presenze-istruttori.sql`); la segna anche fare l'appello,
  dall'app o col PIN (`supabase/23-istruttori-dalle-lezioni.sql`). Si apre con
  `sala/` in fondo all'indirizzo, e da lì il dispositivo resta un tablet.
- **La segreteria**: per il computer della reception, a chi ha il ruolo di
  segreteria. Si apre su **DA FARE**: gli appelli che mancano, le richieste nuove, le presenze degli istruttori da confermare, i certificati e i pagamenti da sistemare, contati, ognuno col tasto per andare a sistemarlo. La **settimana** in una griglia, con gli appelli che mancano in
  rosso, e ogni lezione si apre per annullarla, dare un sostituto, spostarla di
  sala o fare l'appello, un nome alla volta o tutti presenti, come dall'app;
  le lezioni straordinarie. I **corsi**, con sala,
  istruttori, posti, colore e i giorni in cui si fanno, ognuno anche in
  una sala diversa (il lunedì in Tatami, il giovedì in Lotta). Gli **iscritti**, da
  cercare, iscrivere e togliere dai corsi, con quanto vengono negli ultimi
  trenta giorni, il **certificato medico** (fino a quando vale: il foglio sta
  su carta in segreteria, come la copia del documento d'identità) e lo
  stato del **pagamento**, con chi non è in regola in evidenza. Quando
  qualcuno paga, la **ricevuta**: la «ricevuta semplice» dell'associazione,
  in PDF con le due copie affiancate, col numero che va avanti da sé, la
  quota e i corsi dal listino, i dati del socio dal modulo di
  iscrizione; fatta non si cambia, si annulla (`supabase/16-ricevute.sql`,
  `src/lib/ricevutaPdf.ts`). Le **presenze** del mese: medie per corso, chi si sta
  perdendo, gli appelli che mancano, e il CSV. Le **statistiche**, su più mesi: presenze e iscritti mese per mese, i giorni e le ore
  in cui si viene, i corsi che si riempiono (sugli iscritti e sui posti), le lezioni di ogni
  istruttore, le prove mese per mese, chi è in regola e gli incassi delle ricevute; i conti li fa il database
  (`supabase/22-statistiche.sql`). Le **presenze degli istruttori** entrati col PIN,
  in elenco per mese, corso, istruttore e stato: quelle in cui non erano previsti si confermano o si rifiutano, e
  le lezioni tenute in cui nessun istruttore si è segnato si propongono, per scegliere chi c'era
  (`supabase/23-istruttori-dalle-lezioni.sql`). Il CSV e il report PDF del mese o dell'anno, con le statistiche. L'**import dai fogli Excel**, e delle risposte del modulo Google così come
  si scaricano, con le colonne e i corsi da abbinare, e con nascita, residenza e genitore per le ricevute (`supabase/18-anagrafiche.sql`).
  **Istruttori e accessi**, coi PIN del tablet e il **kanji** di ciascuno: un
  segno solo, come un timbro, che lo fa riconoscere a colpo d'occhio accanto al
  nome nel calendario, nell'appello e sul tablet di sala (`src/lib/kanji.ts`, `supabase/24-kanji.sql`). Il **listino** dei costi, che
  la segreteria cambia da sé e che vale per la pagina di iscrizione e per le
  voci delle ricevute (`supabase/19-listino.sql`). Le **segnalazioni**: cosa non va o cosa servirebbe
  nell'app, scritto lì invece che in un documento, con le risposte nello stesso
  filo e il menu che dice quante aspettano una risposta (`supabase/25-segnalazioni.sql`). Le **impostazioni**: per quanto si
  tengono le presenze, fin dove si prepara il calendario, le sale con la loro
  musica e la **voce** del timer (la voce di sistema e le clip incise, uguali
  su tutti i tablet), lo storico dei timer, il **backup** e l'esportazione
  dei dati di una persona. Gli **esercizi** della palestra, che i tablet
  propongono scrivendo un timer.
- **Il modulo di iscrizione**, al posto di quello su Google Form: chi si
  iscrive risponde alle domande dal telefono, **firma col dito** il modulo
  delle autorizzazioni (il PDF della palestra, compilato coi suoi dati da
  `src/lib/firma.ts`; o ne carica la foto firmata a mano), e carica il
  documento d'identità, il certificato medico se c'è già, e la ricevuta
  (documento e certificato la segreteria li stampa, li tiene su carta e li
  cancella dall'app); per un minore la data di nascita fa chiedere i dati
  del genitore. Il codice fiscale si controlla davvero (il carattere di
  controllo, la data di nascita, e per un minore che quello del genitore sia
  di un adulto) e cosa non va si scrive sotto il campo. Le richieste arrivano in segreteria, in **RICHIESTE ONLINE**,
  con i file da guardare: accolta, la persona entra in elenco iscritta ai
  corsi che ha scelto, senza doppioni se c'era già. Col database vero è
  acceso da quando la palestra ha approvato l'informativa privacy
  (`public/informativa.html`, 2 ottobre 2026), che si legge in fondo alla
  pagina delle iscrizioni.
- **L'area degli iscritti**, il pilota: dal telefono, chi frequenta vede
  le prossime lezioni dei suoi corsi (con le annullate, i sostituti e i
  cambi di sala), le sue presenze degli ultimi trenta giorni, il certificato
  medico, la quota e le ricevute in PDF. Solo da leggere. Per ora c'è solo in
  prova, dove in cima si sceglie quale iscritto inventato essere
  (`src/lib/iscritto.ts`, `src/components/AreaIscritti.tsx`): col database
  vero la pagina dice che arriva, perché un iscritto non ha ancora un accesso
  e quello che può leggere di sé va deciso prima. Il **nucleo familiare**:
  il titolare passa alla pagina di ogni persona del suo nucleo, vede i
  pagamenti di tutti con lo sconto famiglia, e aggiunge una persona col
  modulo di iscrizione già compilato coi suoi dati, che dice quanto costa e
  come pagarlo; la richiesta arriva in RICHIESTE ONLINE col segno NUCLEO
  (`src/lib/nucleo.ts`). La segreteria vede e cambia il nucleo dalla
  scheda di un iscritto (NUCLEO FAMILIARE), con lo sconto famiglia dalle
  ricevute, e la ricevuta nuova mette da sé lo sconto famiglia sull'annuale
  giusto; col database la sezione non c'è ancora. Le **presenze
  segnalate**: dalla sua pagina un iscritto dice di esserci stato a una
  lezione dove non risulta, e la conferma l'istruttore (in cima al
  calendario e nell'appello) o la segreteria (PRESENZE SEGNALATE); vedi
  `src/lib/segnalate.ts`. Cosa manca è in
  [`guida/iscritti.md`](guida/iscritti.md#cosa-manca-per-aprirla-davvero).
- **L'accesso** col database è uno solo: la radice è la porta unica, e la
  stessa porta sta in `istruttori/`, `segreteria/` e `sala/`. Si entra con
  l'email, o col nome utente per il tablet di una sala, e l'account dice dove
  andare: la segreteria in segreteria, l'istruttore nel calendario e
  nell'appello, il tablet nella sua sala (`accedi` in `src/lib/accesso.ts`),
  qualunque porta si sia aperta; nessuno vede schede che non gli servono. Chi
  apre la radice ed è già collegato su quel dispositivo va dritto nella sua
  area. La sessione è una sola per dispositivo, la stessa per istruttori,
  segreteria e sala (`src/lib/sessioni.ts`): chi è entrato in un'area non
  entra nelle altre, e aprendone l'indirizzo torna nella sua (`useChi` in
  `src/components/Porta.tsx`); per cambiare area si esce, e **Esci** riporta
  sempre alla porta. Dagli istruttori non ci sono rimandi alle
  altre aree (segreteria, sala, iscrizioni), nemmeno in prova; al primo accesso l'account si lega da sé alla persona con la
  stessa email. Chi vuole iscriversi ha la pagina pubblica (`iscrizioni/`),
  che la segreteria copia con **COPIA LINK ISCRIZIONI**.
- **Il tema bianco**, oltre al nero del marchio: il tasto col sole in
  testata (in segreteria «Tema bianco», nel riquadro in basso) lo sceglie per
  quel dispositivo; finché nessuno sceglie, l'app segue il tema del
  dispositivo. Sul tablet di sala il tasto sta accanto all'ora.
- **Senza rete non si perde niente**: ogni presenza è scritta sul dispositivo
  prima di partire e resta in coda finché il server non l'ha presa.

## Il timer

Il codice sta in `timer/`, con le sue dipendenze, e si prova da solo:

```
npm install --prefix timer
npm run dev:timer
```

Il tasto TIMER del menu degli istruttori e dell'appello apre `timer/`, e il
tasto SALA del timer (solo su un tablet di sala) torna a `../`, la radice. Sono relativi, quindi valgono
dovunque sia pubblicato il sito; in `npm run dev` il tasto TIMER non trova
niente, perché il server di sviluppo serve una sola app. Per provarle insieme:

```
npm run build:tutto   # ODS Corsi in dist/, il timer in dist/timer/
npm run preview
```

Le due app stanno sulla stessa origine e quindi condividono il
`localStorage`: il tema (`ods-tema`) è lo stesso, e i dati di ognuna hanno il
suo prefisso. Per chi aveva il timer al vecchio indirizzo
(`nalbertini.github.io/Timer-/`) i timer salvati ci sono ancora, perché
l'origine non cambia; l'app installata sul telefono o sul tablet, però, va
aggiunta di nuovo alla schermata Home dal nuovo indirizzo. Il service worker di
ODS Corsi lascia stare `timer/` (`navigateFallbackDenylist` e `globIgnores` in
`vite.config.ts`): ognuna delle due app si aggiorna per conto suo.

### Il timer dentro il tablet di sala

Sul tablet di sala il timer non è un'altra pagina: è la scheda **TIMER**
accanto a **PRESENZE**, nella barra in basso, e il codice è lo stesso di
`timer/src`, compilato dentro ODS Corsi (`src/components/tablet/TimerSala.tsx`,
caricato solo sul tablet). Resta montato anche quando si guardano le
presenze, quindi un allenamento avviato continua mentre chi arriva tardi si
segna; la testata ne mostra l'intervallo, i secondi e il colore. Nella barra
c'è anche la musica, sempre nello stesso punto: il lettore di YouTube non si
sposta e non si ricarica cambiando scheda. Le liste della musica le prepara la
segreteria (`supabase/09-musica.sql`), e così la voce di sistema dei tablet,
le clip della voce incisa e il catalogo degli esercizi, da **Impostazioni** ed
**Esercizi** (`supabase/13-voce-esercizi.sql`,
`timer/src/lib/impostazioniSala.ts`); in Impostazioni c'è anche lo storico dei
timer. Maurizio, i segnali, il volume, lo schermo e la musica che segue il
timer si scelgono nelle impostazioni del timer dentro il tablet, e valgono per
tutti i tablet (`supabase/10-timer-sale.sql`, `supabase/14-timer-dal-tablet.sql`):
cambiati su uno, gli altri li prendono al giro dopo. Lì non ci sono l'accesso, il tema, il salvataggio
su file e la versione, che sono di ODS Corsi: resta la fonte della musica con
Spotify.

Tre cose tengono insieme le due app nella stessa pagina:

- **Gli stili del timer stanno in un'ombra** (Shadow DOM): hanno classi con
  lo stesso nome di quelle di ODS Corsi (`.btn`, `.card`, `.row`), e le misure
  sulla finestra (`vh`, `@media`) diventano misure del riquadro (`cqh`,
  `@container`). Vuole un browser del 2022 in su (Safari 16, Chrome 105).
- **Una React sola**: `resolve.dedupe` in `vite.config.ts` e `paths` in
  `tsconfig.json` fanno usare ai file del timer le dipendenze di qui, non
  quelle di `timer/node_modules`. Il timer, compilato da solo, resta com'è.
- **I file del timer** (voce, illustrazioni, guida) si cercano in `timer/`
  (`__TIMER_RADICE__`, vedi `timer/src/lib/radice.ts`), e un aggiornamento
  dell'app aspetta la fine dell'allenamento prima di ricaricare la pagina.

### Il timer sul database

Col database, il timer usa l'accesso fatto qui — da istruttore o da tablet di
sala — e tiene sul database i timer, lo storico e le preferenze
(`supabase/08-timer.sql`; chi può fare cosa è in
[`supabase/LEGGIMI.md`](supabase/LEGGIMI.md#8-il-timer)):

- **La libreria della palestra** e **i timer di ogni istruttore**, che li
  ritrova su ogni dispositivo in cui entra. Un timer nuovo nasce fra i propri;
  l'editor lascia metterlo nella palestra o solo sul dispositivo.
- **I timer di un corso.** Nell'editor, alla voce CORSI, un timer si collega
  ai corsi. Il tasto TIMER dell'appello apre il timer con la lezione —
  `timer/?corso=…&lezione=…&nome=…` — e i timer del suo corso stanno in cima;
  sul tablet di sala la scheda TIMER fa lo stesso con la lezione in cui ci si
  segna.
- **Lo storico**: ogni allenamento, con la lezione in cui è partito e chi
  l'ha fatto partire (l'istruttore o il tablet).
- **Le preferenze** che seguono l'istruttore: Maurizio, bip e voce, volume.
  Quelle del dispositivo (la voce di sistema, lo schermo acceso) restano lì.
  Sul tablet di sala non ci sono preferenze di qualcuno: vale il timer delle
  sale scelto dalla segreteria.

Il timer riusa due file di qui: `src/lib/sessioni.ts`, per trovare la
sessione con la stessa chiave, e `src/lib/coda.ts`, la coda delle scritture
offline. Senza database, in prova o senza un accesso, il timer fa quello che
ha sempre fatto: tutto sul dispositivo.

Restano sul dispositivo, per ora, il catalogo degli esercizi e la voce incisa.

## La versione

L'app mostra la sua versione — il numero di `package.json` e il commit da cui
è compilata, per esempio `v0.1.0 · 99db9d7` — in fondo alla pagina di scelta,
nel piede del tablet di sala e nel menu della segreteria; passandoci sopra col
mouse si vede anche quando è stata compilata.

La versione sale da sola a ogni pubblicazione da `main` (`scripts/versione.mjs`,
lanciato da `pubblica.yml`): per le PR unite dall'ultimo tag `v*` alza
`version` in `package.json`, scrive cosa è cambiato in cima a
[`guida/novita.md`](guida/novita.md) (la pagina **Novità** della guida), e
crea il tag e la Release su GitHub. Lo decide il prefisso del titolo della PR:

| Titolo della PR | Sezione | Versione |
|---|---|---|
| `Nuovo: …` (o `Novità: …`) | Novità | minor, `0.1.3` → `0.2.0` |
| `Risolto: …` (o `Corretto:`, `Fix:`) | Risolto | patch, `0.1.3` → `0.1.4` |
| tutto il resto | Modificato | patch |

Il titolo, senza prefisso, è la riga che si legge nelle novità: va scritto per
chi usa l'app. Una PR che fa due cose prende il prefisso di quella più grossa.

## Le guide

Per chi usa l'app, non per chi la sviluppa: [`guida/`](guida/README.md). La
guida generale spiega come funziona a istruttori e segreteria; poi c'è una
guida per ogni area (istruttori, tablet di sala, iscrizioni, segreteria) e una
per ogni voce del menu della segreteria.

Gli stessi file si leggono anche dentro l'app, all'indirizzo `#guida` (una
pagina per file: `#guida/sala`, `#guida/segreteria/settimana`), dal tasto **?**
in testata o da **GUIDA** nel menu della segreteria, che apre la pagina della
voce aperta. Si scrivono una volta sola, in `guida/`: l'app li legge così come
sono (`src/lib/guida.ts`, `src/components/Guida.tsx`), quindi una guida nuova
compare da sé, purché usi il Markdown che il lettore conosce: titoli,
paragrafi, elenchi, tabelle, grassetto, corsivo, codice e collegamenti.

## Provarla

```
npm install
npm run dev
```

Senza configurazione parte in **modalità prova**, con l'orario vero della stagione
2026/27, degli iscritti inventati e un nastro giallo che lo dichiara. Le presenze segnate in prova restano
sul dispositivo e basta.

Perché ogni area abbia qualcosa da far vedere, al primo avvio la prova mette
anche degli esempi, contando da quel giorno (`src/lib/esempiProva.ts`): gli
appelli delle ultime cinque settimane, con qualcuno che manca, qualcuno fatto
solo dai tablet e qualche iscritto che si sta perdendo; le presenze col PIN
degli istruttori, due da confermare; una lezione annullata, un sostituto e uno
stage il sabato; quattro richieste online, una di un minore; un telefono a
ogni iscritto; una ricevuta a chi ha pagato; tre presenze segnalate nelle
lezioni di Maurizio; e qualche nucleo familiare fra
chi ha lo stesso cognome. Si aggiungono a quello che c'è senza cambiarlo, una volta per
dispositivo. Restano senza esempi la musica delle sale (servirebbero playlist
vere), lo storico dei timer e i timer degli istruttori, che sono quelli del
timer sullo stesso dispositivo.

In prova le porte sono aperte a tutti, e fra le aree si passa con le schede in
cima, per far vedere l'app intera; col database vero si entra dalla porta unica e si finisce nel proprio
indirizzo. La **segreteria** (`http://localhost:5173/segreteria/`) in prova è
aperta a tutti: i corsi, i giorni e gli
iscritti che si cambiano lì restano su questo dispositivo, e li vedono anche il
calendario, l'appello e il tablet. «Riparti dall'orario vero», in fondo al menu
della segreteria, rimette tutto com'era.

Il tablet di sala si prova dal link nel nastro giallo, o aprendo
`http://localhost:5173/sala/`. In prova la sala si sceglie da un elenco, e
l'orologio si può spostare per vedere una lezione che si apre:
`http://localhost:5173/sala/?adesso=2026-09-24T17:55` è giovedì alle sei meno
cinque, con il Judo agonisti in cui ci si segna. I PIN di prova sono 1234
(Maurizio), 2468 (Maura) e 5678 (Fabio).

Anche quando l'app è collegata al database, la prova si apre dalla porta
d'accesso con **PROVA CON DATI INVENTATI**, o aggiungendo `?prova`
all'indirizzo: chi non ha ancora un account vede l'app com'è, e niente di quel
che tocca arriva al database, che in prova non si carica nemmeno. Resta accesa
sul dispositivo finché non si preme **ESCI DALLA PROVA** nel nastro giallo (o
«Esci» nel menu della segreteria), o si apre l'indirizzo con `?prova=no`.

## Il database

Supabase, con la sicurezza tutta nelle policy RLS. Come metterlo in piedi, come
importare corsi e iscritti da un foglio Excel e cosa decidere prima di usarlo sul
serio: [`supabase/LEGGIMI.md`](supabase/LEGGIMI.md).

Una copia cifrata del database si fa da sé ogni lunedì
(`.github/workflows/backup.yml`), e dalla segreteria quando serve: in
IMPOSTAZIONI → IL BACKUP si fa partire e si scarica per metterla su Drive
(`supabase/functions/backup`). I segreti che vuole e come rimetterla a posto
sono in [`supabase/LEGGIMI.md`](supabase/LEGGIMI.md#10-il-backup).

## Le prove

| | |
|---|---|
| `npm run prova:coda` | La coda delle scritture offline, senza browser: i sei casi che contano. |
| `npm run prova:segreteria` | La segreteria di prova: i cambi di un corso che arrivano al calendario, all'appello e al tablet. |
| `npm run prova:richieste` | Il modulo di iscrizione di prova: gli stessi rifiuti del database, e una richiesta accolta che diventa un iscritto. |
| `npm run prova:ricevuta` | La ricevuta di un pagamento: i conti, i rifiuti, e i PDF (con una cartella li lascia lì da guardare). |
| `npm run prova:iscritti` | L'area degli iscritti: le lezioni annullate, i sostituti e le sale cambiate, le presenze, le ricevute, gli avvisi; e che di un altro non si vede niente. Il nucleo familiare: chi lo vede, la persona in più coi dati del titolare, lo sconto famiglia, e i cambi dalla scheda della segreteria. Le presenze segnalate: chi le manda, chi le vede e chi le accoglie. |
| `npm run prova:prove` | Le prove dell'app di prova: aggiunte dall'appello e dal tablet, ritrovate per nome, tolte per sbaglio, e l'elenco della segreteria. |
| `npm run prova:tablet` | Le regole del tablet di prova: finestre di tempo, recupero, annullo, PIN, il tablet che non scavalca l'istruttore, la presenza dell'istruttore col PIN e dall'appello, le lezioni tenute da confermare. |
| `supabase/prova/calendario.sql` | La generazione delle lezioni, il cambio dell'ora legale, la rigenerazione che non duplica. |
| `supabase/prova/calendario-da-se.sql` | Il calendario che si allunga da sé: anche per un istruttore, solo quando serve, fin dove dicono le regole. |
| `supabase/prova/rls.sql` | Gli accessi dal punto di vista di un iscritto, di un istruttore, della segreteria e di chi non ha fatto l'accesso. |
| `supabase/prova/segreteria.sql` | Le lezioni che seguono i cambi dei corsi, i giorni tolti, gli archiviati, il primo accesso. |
| `supabase/prova/iscrizioni.sql` | Il modulo di iscrizione: cosa può fare chi non ha un accesso, i file, chi accoglie le richieste e come ritrova chi c'era già. |
| `supabase/prova/timer.sql` | Il timer: la libreria della palestra, i timer personali e dei corsi, il tablet che li apre e non li scrive, lo storico, le preferenze. |
| `supabase/prova/certificati.sql` | Certificati medici, documento e pagamenti: li vede e li cambia solo la segreteria; i certificati stanno su carta, di file nuovi non ne entrano, e quelli di prima li legge e li cancella solo lei. |
| `supabase/prova/ricevute.sql` | Le ricevute: le fa e le annulla solo la segreteria, il numero va avanti da sé e riparte ogni anno, i conti li fa il server, e una ricevuta fatta non si cambia. |
| `supabase/prova/tablet.sql` | Le stesse regole del tablet, dal lato del database, e che il tablet non veda niente più di quel che deve. |
| `supabase/prova/presenze-istruttori.sql` | La presenza degli istruttori dal PIN del tablet: da sola a chi era previsto, anche da sostituto, da confermare agli altri; la conferma solo la segreteria. |
| `supabase/prova/istruttori-dalle-lezioni.sql` | La presenza di chi fa l'appello (confermata se era previsto, da confermare se no, la segreteria al banco no) e le lezioni tenute senza l'istruttore segnato: le vede e le decide solo la segreteria, scegliendo fra i previsti. Dopo `tablet.sql` e `presenze-istruttori.sql`. |
| `supabase/prova/prove.sql` | Le prove: le aggiunge chi fa l'appello (dall'app o col PIN), già presenti; si ritrovano per nome; si tolgono con la persona se è nata lì; un iscritto e chi non ha accesso non le vedono. Dopo `tablet.sql`. |
| `supabase/prova/statistiche.sql` | Le statistiche: i numeri di ogni lezione contati come in PRESENZE, le prove, chi l'ha fatta, gli incassi del mese; le vede solo la segreteria. |
| `supabase/prova/musica.sql` | La musica delle sale: la prepara la segreteria, il tablet vede solo quella della sua sala e non la cambia. In fondo, il timer delle sale: uguale per tutti, lo cambia un tablet (o la segreteria) dalla sua funzione, e nient'altro della riga. |

I file SQL girano su un Postgres qualunque con `supabase/prova/finto-supabase.sql`
applicato prima: rifà il minimo che Supabase mette a disposizione.

## Da dove viene

Il lavoro è partito dentro il timer, come «fase 1 della sala corsi»
([PR #9](https://github.com/nalbertini/Timer-/pull/9), chiusa senza unirla), ed è
stato spostato qui togliendo tutto quello che lo legava al timer: la tabella degli
allenamenti, il collegamento fra un corso e il suo timer, il tasto per avviarlo
dall'appello.
