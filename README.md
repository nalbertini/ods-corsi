# ODS Corsi

Il calendario dei corsi e il registro delle presenze di **Officine Dello Sport**,
Collegno.

Nella cartella [`timer/`](timer/README.md) c'è anche l'interval timer delle
lezioni, portato qui da [nalbertini/Timer-](https://github.com/nalbertini/Timer-)
con tutta la sua storia, per integrare meglio le due app. Per ora resta un'app
a sé — il suo `package.json`, il suo service worker, la sua installazione — ma
si pubblica insieme a ODS Corsi, nella sottocartella `timer/` dello stesso sito.

## Cosa fa oggi

L'app ha sei indirizzi veri, ognuno con il suo accesso
(`app.officinedellosport.it/segreteria/` e così via):

| | |
|---|---|
| `istruttori/` | Il calendario e l'appello, per istruttori e segreteria. |
| `segreteria/` | L'area della reception, solo per chi ha il ruolo di segreteria (anche insieme a quello di istruttore o di amministrazione). |
| `amministrazione/` | L'area dei conti: PAGAMENTI e LISTINO, per chi ha il ruolo di amministrazione. Non vede le persone (`supabase/55-amministrazione.sql`). |
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
nel calendario, e poi passa dall'uno all'altra dal menu senza uscire. Il **timer** è una pagina dell'area istruttori
(barra in basso sul telefono, menu a sinistra su schermo largo: CALENDARIO, TIMER, I MIEI, ORE), con la striscia
dell'allenamento in corso sempre in vista; resta anche l'app a sé in `timer/`
(`app.officinedellosport.it/timer/`). Nel timer del telefono c'è anche la musica del tablet di sala:
le liste della segreteria, accesa da chi insegna, ricordata solo su quel telefono.

- **Il calendario**: una striscia di sette giorni e sotto le lezioni di quello
  scelto, in ordine di orario, con sala, istruttore e iscritti.
- **L'attività**: ogni giorno di un corso può avere la sua attività (Tecnica,
  Sparring…), scelta da un elenco che la segreteria tiene in IMPOSTAZIONI; si
  cambia anche per una lezione sola, e l'istruttore cambia quella della sua.
  Si vede accanto all'orario su calendario, appello e tablet di sala
  (`supabase/41-attivita.sql`).
- **La categoria degli esercizi**: una sola divisione, la stessa lista di timer e
  liste di musica (Judo, Lotta, Pilates, Yoga, A corpo libero, Attrezzi, Core,
  Cardio, Mobilità…), che la segreteria cura in ESERCIZI; un filtro e gruppi
  per categoria in segreteria e nel timer (`supabase/42-categorie-esercizi.sql`).
- **La ricerca in segreteria**: il campo in cima al menu trova, a gruppi,
  iscritti (per nome, telefono o email), richieste online, corsi (anche per
  giorno) e istruttori, senza chiamare il database; «ALTRI N» apre la voce già
  filtrata (`src/lib/ricerca.ts`).
- **Gli iscritti di un corso**: nella scheda di un corso, DATI e ISCRITTI; in ISCRITTI una
  persona per riga con certificato e quota a parole, ricerca, ordinamento per colonna e un clic
  che apre la sua scheda; Indietro ritrova ricerca e ordine (`src/lib/segreteria.ts`).
- **L'email di contatto**: l'email di accesso resta di una sola persona; chi usa
  l'indirizzo di un altro (fratelli, un genitore, a volte un istruttore) ha una
  seconda, l'email di contatto, che può ripetersi e dove la palestra scrive alla
  famiglia; l'app non ci manda mai mail. L'import e il modulo online ci mettono
  da soli l'indirizzo già di altri, la scheda mostra chi lo condivide
  (`supabase/44-email-contatto.sql`).
- **Il vestiario**: judogi, costumini e vestiario si ordinano da `iscrizioni/#vestiario`,
  al posto del modulo Google; la segreteria tiene catalogo e chiusura, segna chi ha
  pagato e scarica l'elenco per il fornitore, solo coi capi saldati (`supabase/47-vestiario.sql`).
  La pagina segue i passi del vecchio modulo (per chi è, il tipo, i capi con foto e tabella delle taglie,
  ti serve altro?), e le foto le carica la segreteria (`supabase/51-vestiario-foto.sql`).
- **I miei timer**: nell'area istruttori, quali timer partono con ogni corso e
  con ogni singola lezione delle prossime due settimane, anche più d'uno;
  quelli di una lezione vengono prima di quelli del corso, dall'appello e sul tablet di sala
  (`supabase/11-timer-lezioni.sql`).
- **Le mie ore**: nell'area istruttori, mese per mese, le lezioni che in
  segreteria risultano dell'istruttore, con lezioni, ore e da confermare
  uguali alla sua scheda in segreteria (`src/lib/ore.ts`), le rifiutate con
  chi e quando, e a parte quelle tenute in cui nessuno si è segnato
  (`supabase/37-mie-ore.sql`).
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
  PRESENZE per richiamarlo (`supabase/21-prove.sql`). Dall'app degli istruttori
  `+ AGGIUNGI CHI PROVA` apre una pagina che cerca per nome fra tutte le persone
  della palestra, anche iscritte ad altri corsi, coi loro corsi e senza telefono,
  e se manca fa scrivere il nome a mano, avvisando se esiste già
  (`supabase/43-cerca-persone.sql`).
- **Il tablet di sala**: un tablet appeso al muro di ogni sala con il calendario
  della sala. Chi arriva tocca il suo nome e la presenza è segnata, senza
  domande e con ANNULLA per chi sbaglia; quando non si segna ancora, dice qual
  è la prossima lezione e da che ora ci si segna; chi si è dimenticato recupera le
  lezioni delle ultime due settimane partendo dal corso; l'istruttore, col suo
  PIN, apre l'appello completo e vede chi si è segnato da sé; durante una
  lezione il PIN segna anche la sua presenza, da sola se era previsto su
  quella lezione, se no da confermare in segreteria
  (`supabase/15-presenze-istruttori.sql`); la segna anche fare l'appello,
  dall'app o col PIN (`supabase/23-istruttori-dalle-lezioni.sql`), e chi fa
  l'appello dal telefono segna presente anche il collega previsto che
  insegnava con lui (`supabase/46-istruttore-collega.sql`). Si apre con
  `sala/` in fondo all'indirizzo, e da lì il dispositivo resta un tablet.
- **La segreteria**: per il computer della reception, a chi ha il ruolo di
  segreteria. Si apre su **DA FARE**: gli appelli che mancano, le richieste nuove, le presenze degli istruttori da confermare, i certificati e i pagamenti da sistemare, contati, ognuno col tasto per andare a sistemarlo. La **settimana** in una griglia, con gli appelli che mancano in
  rosso, e ogni lezione si apre per annullarla, dare un sostituto, spostarla di
  sala o fare l'appello, un nome alla volta o tutti presenti, come dall'app;
  le lezioni straordinarie. I **corsi**, con sala,
  istruttori, posti, colore e i giorni in cui si fanno, ognuno anche in
  una sala diversa (il lunedì in Tatami, il giovedì in Lotta). Gli **iscritti**, da
  cercare, iscrivere e togliere dai corsi, con quanto vengono negli ultimi
  trenta giorni, il **certificato medico** (fino a quando vale, col file che solo la
  segreteria apre dalla scheda e che si cancella da sé 30 giorni dopo la
  scadenza) e lo
  stato del **pagamento**, con chi non è in regola in evidenza. Quando
  qualcuno paga, la **ricevuta**: la «ricevuta semplice» dell'associazione,
  in PDF con le due copie affiancate, col numero che va avanti da sé, la
  quota e i corsi dal listino, i dati del socio dal modulo di
  iscrizione; fatta non si cambia, si annulla (`supabase/16-ricevute.sql`,
  `src/lib/ricevutaPdf.ts`). Lo **storico dei pagamenti** di ogni persona nella sua scheda (ogni ricevuta con i suoi pagamenti sotto, e i pagamenti fatti a mano senza ricevuta, `supabase/54-pagamenti-diretti.sql`) e la pagina **PAGAMENTI** con quelli di tutti: cerca, periodo, modo di pagare, chi deve ancora pagare e il CSV per il commercialista (`src/lib/pagamenti.ts`). Le **presenze** del mese: medie per corso, chi si sta
  perdendo, gli appelli che mancano, e il CSV. Le **statistiche**, su più mesi: presenze e iscritti mese per mese, i giorni e le ore
  in cui si viene, i corsi che si riempiono (sugli iscritti e sui posti), le lezioni di ogni
  istruttore, le prove mese per mese, chi è in regola e gli incassi delle ricevute; i conti li fa il database
  (`supabase/22-statistiche.sql`). Le **presenze degli istruttori** entrati col PIN,
  in elenco per mese, corso, istruttore e stato: quelle in cui non erano previsti si confermano o si rifiutano, e
  le lezioni tenute in cui nessun istruttore si è segnato si propongono, per scegliere chi c'era
  (`supabase/23-istruttori-dalle-lezioni.sql`). Il CSV e il report PDF del mese o dell'anno, con le statistiche. L'**import dai fogli Excel**, e delle risposte del modulo Google così come
  si scaricano, con le colonne e i corsi da abbinare, e con nascita, residenza e genitore per le ricevute (`supabase/18-anagrafiche.sql`). Si può ricaricare lo stesso foglio senza doppioni: nome e cognome al contrario si segnalano e si sceglie, e a fine import c'è l'elenco, riga per riga, di chi non è entrato.
  **Istruttori e accessi**, coi PIN del tablet e il **kanji** di ciascuno: un
  segno solo, come un timbro, che lo fa riconoscere a colpo d'occhio accanto al
  nome nel calendario, nell'appello e sul tablet di sala (`src/lib/kanji.ts`, `supabase/24-kanji.sql`). Un istruttore che non ha
  mai insegnato si **elimina**, scheda e account (`supabase/28-elimina-istruttore.sql`, `supabase/functions/elimina`). Due schede della stessa
  persona si **uniscono** dalla scheda: tutto quello del doppione passa a quella che resta (`src/lib/doppioni.ts`, `supabase/29-unisci-doppioni.sql`). Il **listino** dei costi, che
  la segreteria cambia da sé e che vale per la pagina di iscrizione e per le
  voci delle ricevute (`supabase/19-listino.sql`); ogni voce è di un corso solo, per id, e il prezzo segue il corso se cambia nome (`src/lib/listino.ts`). Le **segnalazioni**: cosa non va o cosa servirebbe
  nell'app, scritto lì invece che in un documento, con le risposte nello stesso
  filo e il menu che dice quante aspettano una risposta (`supabase/25-segnalazioni.sql`). Si può allegare fino a 3 foto o PDF per messaggio (`supabase/32-segnalazioni-allegati.sql`). Ognuna è un'idea o una correzione, scelta da chi la apre e cambiabile dalla segreteria (`supabase/38-segnalazioni-categoria.sql`). Le **impostazioni**: per quanto si
  tengono le presenze, fin dove si prepara il calendario, le sale con la loro
  musica e la **voce** del timer (la voce di sistema e le clip incise, uguali
  su tutti i tablet), lo storico dei timer, il **backup** e l'esportazione
  dei dati di una persona. Gli **esercizi** della palestra, che i tablet
  propongono scrivendo un timer.
- **L'amministrazione** (`amministrazione/`): per chi cura i conti. Ha il ruolo
  **Amministrazione**, da solo o insieme alla segreteria e all'insegnamento
  (tre spunte in ISTRUTTORI E ACCESSI), e vede PAGAMENTI e LISTINO, non le persone:
  dei pagatori il nome, senza contatti. Registra un pagamento a mano (cercando chi
  ha pagato per nome) e annulla un pagamento o una ricevuta senza aprire la scheda;
  le ricevute nuove, per ora, le fa la segreteria. Account, ruoli, PIN e backup
  restano alla segreteria (`supabase/55-amministrazione.sql`, `src/lib/ruoli.ts`). La voce **CONTABILITÀ**, solo
  per l'amministrazione: i movimenti di entrata e uscita nelle due casse (Contanti e Conto Corrente) con
  il residuo di ciascuna, le voci della palestra, il saldo iniziale, il giroconto per il versamento in banca;
  gli incassi degli iscritti entrano da soli da ricevute e pagamenti, senza ricopiarli
  (`supabase/59-contabilita.sql`, `src/lib/contabilita.ts`). La **chiusura di cassa**: si conta la Cassa
  Contanti, la differenza si scrive da sola nei conti, i giorni chiusi non si toccano più e il foglio si
  stampa in PDF (`supabase/60-chiusura-cassa.sql`, `src/lib/chiusuraCassaPdf.ts`).
- **Il sito della palestra** (voce SITO della segreteria): le pagine del sito, il menu in alto e il footer si
  scrivono nell'app, senza WordPress. Ogni pagina ha una **bozza**, che non cambia il sito, e un testo
  **pubblicato**, che cambia solo con PUBBLICA; il testo ricco passa da un editor che ammette solo titoli,
  grassetto, corsivo, elenchi, citazione, link e pulsante, e viene ripulito prima di salvarlo
  (`src/lib/sitoTesto.ts`, `src/lib/sitoPagine.ts`). Le pagine di legge (privacy, cookie, contributi pubblici)
  restano sempre sul sito. Le scrive solo la segreteria; chi non ha l'accesso legge solo il pubblicato
  (`supabase/56-sito.sql`). Le pagine pubblicate diventano il sito vero con `npm run sito:genera`
  (`src/lib/sitoGenera.ts`, `scripts/genera-sito.mjs`): file statici senza codice né servizi esterni (c'è solo un blocco di dati strutturati JSON-LD per Google e gli assistenti AI:
  sede, corsi, domande frequenti, briciole, in `src/lib/sitoDati.ts`; per le condivisioni, le meta Open Graph e Twitter con l'immagine `sito/risorse/social.png`, 1200×630; e `llms.txt` alla radice, che racconta il sito agli assistenti AI), con
  carattere (Big Shoulders Display e Inter, licenza OFL accanto) e logo propri in `sito/risorse/`, nell'aspetto «tatami blu e giallo»
  (i colori e le regole sono in `docs/design-canvas/sito-rebrand/token-proposta.md`, A2); il testo si ripulisce un'altra volta quando si genera, perché
  è la pulizia di cui ci si fida. Il sito sta su www.officinedellosport.it con GitHub Pages, nel
  repository `nalbertini/officinedellosport-sito` (file generati, non si toccano a mano): il workflow
  `.github/workflows/sito.yml` lo rigenera ogni cinque minuti e a ogni cambio del generatore, e manda
  nel repository del sito solo quello che è cambiato (`scripts/pubblica-sito.sh`), con una chiave di
  scrittura che vale solo per quel repository (`SITO_DEPLOY_KEY`); `SUPABASE_URL` e `SUPABASE_ANON_KEY`
  sono variabili del repository. Senza una Home pubblicata non c'è niente da pubblicare e il sito di
  prima resta com'è (anche se la Home sparisse per sbaglio: il giro resta verde, il sito non cambia).
  Il repository del sito contiene solo il sito generato: quello che vi si scrive a mano, un README
  compreso, al giro dopo sparisce. Se la chiave di scrittura si perde si toglie fra le *Deploy keys* di
  quel repository e se ne fa una nuova (`SITO_DEPLOY_KEY`). I giri programmati si fermano dopo 60 giorni
  senza attività nel repository: un lancio a mano (Actions → Sito → Run workflow) li riaccende. Il dominio e l'app su app.officinedellosport.it, le immagini e i rinvii dai vecchi
  indirizzi arrivano dopo.
- **Il modulo di iscrizione**, al posto di quello su Google Form: chi si
  iscrive risponde alle domande dal telefono, **firma col dito** il modulo
  delle autorizzazioni (il PDF della palestra, compilato coi suoi dati da
  `src/lib/firma.ts`; o ne carica la foto firmata a mano), e carica il
  documento d'identità, il certificato medico se c'è già, e la ricevuta
  (il documento la segreteria lo stampa, lo tiene su carta e lo cancella
  dall'app; il certificato resta nella scheda); per un minore la data di nascita fa chiedere i dati
  del genitore. Il codice fiscale si controlla davvero (il carattere di
  controllo, la data di nascita, e per un minore che quello del genitore sia
  di un adulto) e cosa non va si scrive sotto il campo. Le richieste arrivano in segreteria, in **RICHIESTE ONLINE**,
  con i file da guardare: accolta, la persona entra in elenco iscritta ai
  corsi che ha scelto, senza doppioni se c'era già. Col database vero è
  acceso da quando la palestra ha approvato l'informativa privacy
  (`informativa.html`, 2 ottobre 2026), che si legge in fondo alla
  pagina delle iscrizioni.
- **L'aspetto del modulo di iscrizione** è quello del sito (tatami blu e giallo, Big Shoulders Display e
  Inter), sempre chiaro anche col tema scuro; lo accende `src/lib/aspettoModulo.ts` finché il modulo è aperto
  (`data-modulo` su `<html>`, colori in `styles.css`; `npm run prova:iscrizione-sito`).
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
- **Tre temi**: il nero del marchio, il bianco e il **Tatami** (paglia chiara
  e menu verde scuro). Il tasto in testata (in segreteria nel riquadro in
  basso) passa al successivo a ogni tocco e lo sceglie per quel dispositivo,
  anche per il timer; finché nessuno sceglie, l'app segue il tema del
  dispositivo (nero o bianco, mai Tatami). Sul tablet di sala il tasto sta
  accanto all'ora.
- **Senza rete non si perde niente**: ogni presenza è scritta sul dispositivo
  prima di partire e resta in coda finché il server non l'ha presa. Anche sul
  tablet di sala, dove il nome toccato resta segnato con IN ATTESA DI RETE.

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
segreteria (`supabase/09-musica.sql`; le radio, indirizzi https, con
`supabase/39-musica-radio.sql`). Oltre a YouTube e Spotify la musica può venire
da **file del tablet** (nella memoria del browser, in ordine casuale) e da
**radio**, con un `<audio>` senza account né pubblicità (`timer/src/lib/musicaAudio.ts`,
regole in `musicaLocale.ts`), e così la voce di sistema dei tablet,
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
| `npm run prova:sito` | Il pannello SITO, senza browser: la pulizia del testo con una lista di attacchi noti, gli indirizzi delle pagine, lo stato fra bozza e pubblicato, il controllo di menu e footer, e le stesse regole della modalità prova. |
| `npm run prova:sito-aspetto` | L'aspetto del sito generato (A2, tatami blu e giallo): solo i colori del design e il bianco, Big Shoulders Display e Inter come file del sito con la licenza OFL, contrasto di almeno 4,5:1, focus e movimento, testata col logo intero, invito giallo e piede scuro, niente ingranaggio, angoli a 6px. |
| `npm run prova:sito-tessere` | Le pagine del sito a tessere (A2), senza browser: da `<h2>` e `<h3>` del testo a sezioni e tessere a filo senza celle vuote (da 1 a 7 tessere, una colonna sul telefono), colori a rotazione e sezioni di domande chiare, contrasto e focus, elenchi corti come tessere, citazioni a scorrimento con la tastiera e senza codice, foto con l'`alt` di chi scrive, nessuna classe della segreteria che sopravvive, titoli lunghissimi che non escono dalla pagina, pagine di legge e pagine senza `<h2>` come prima. |
| `npm run prova:sito-collage` | La testata della home con foto e numeri, senza browser: il collage c'è solo nella home che non è di legge e solo dal testo prima del primo `<h2>`; le foto dell'introduzione (al massimo tre, la prima grande, quelle di un sito non dichiarato fuori) e un elenco di 2–6 voci con il grassetto iniziale (cifra grande, scritta piccola, voce lunga a testo piccolo) diventano tessere; colori a rotazione senza colori nuovi, `35+ anni di sport` testo normale e non titolo, `loading`, `fetchpriority` e `decoding` messi dal generatore dopo la pulizia, «Contattaci» solo con la pagina contatti e mai un prezzo che la segreteria non ha scritto; griglia a 6 colonne sul desktop (foto grande 4×3, numeri da 2 colonne, due foto in fondo) e a 2 colonne sotto i 900px, senza buchi. |
| `npm run prova:sito-home` | Le fasce della Home come nel design, senza browser: quattro foto di fila fanno una fascia alta a quattro colonne (a 2 colonne sul telefono), la firma di una citazione ha l'avatar con le iniziali, la tessera col solo titolo lo tiene in basso e grande, e una foto seguita da due o più citazioni sta a sinistra del carosello (una sotto l'altra sul telefono). Le voci dei corsi con un `<em>` finale di etichette note (Bambini, Adulti, Anziani, Agonisti) hanno le pillole d'età con l'icona. |
| `npm run prova:sito-scala` | Il sito sul computer ha la scala del design a 1440px, senza browser: titolo da 228px, collage largo 640px con righe da 128px, 96px sotto ogni sezione, tessere alte almeno 190px solo dal computer in su; sul telefono la testata non si allunga. |
| `npm run prova:sito-social` | Le anteprime di condivisione e `llms.txt`: meta Open Graph e Twitter su ogni pagina indicizzabile con indirizzi assoluti e testo escapato, nessuna sul 404 né sui rinvii, l'immagine 1200×630, e `llms.txt` fatto solo dalle pagine pubblicate (corsi, pagine, legge, contatti), su una riga per voce, senza date e uguale a ogni generazione. |
| `npm run prova:sito-genera` | Il sito generato e lo script che lo scrive: un file per pagina, mai codice né servizi esterni, titolo e voci sempre escapati anche se arrivano dall'API, indirizzi strani scartati, sitemap, robots, rinvii e 404, le stesse pagine due volte danno gli stessi file, e lo script non cancella mai una cartella che non è sua né tocca il sito di prima se qualcosa non va. |
| `npm run prova:sito-pubblica` | La pubblicazione del sito, senza GitHub: un repository finto e il suo remoto. Il primo giro copia i file e fa un commit, lo stesso sito due volte non ne fa un altro, quello che sparisce dalle pagine sparisce dal sito, il dominio (`CNAME`) resta, e un sito vuoto, senza la home o in una cartella sbagliata non si pubblica mai. |
| `npm run prova:segreteria` | La segreteria di prova: i cambi di un corso che arrivano al calendario, all'appello e al tablet. Unire due schede della stessa persona, e i possibili doppioni da proporre. L'«Attività» di ogni giorno scelta da un elenco: nomi, rinomina, eliminazione, NON PIÙ IN USO, giorno e lezioni, l'istruttore che cambia la sua, il database senza `41-attivita.sql`. SALVA LE DATE che toglie le lezioni fuori dalle date dei corsi, tranne quelle con l'appello o una prova: la conferma prima, col conto, e l'avviso dopo, con corso e ora di quelle rimaste. |
| `npm run prova:ruoli` | I ruoli del personale: le tre spunte (segreteria, amministrazione, istruttore) in tutte le combinazioni e il ruolo che ne esce, le aree, chi insegna, il nome del ruolo, un ruolo sconosciuto che non va in nessuna area, e chi può cosa (l'amministrazione solo ricevute, pagamenti, listino e contabilità). |
| `npm run prova:contabilita` | La contabilità, prima parte, senza browser: gli incassi degli iscritti ricavati da ricevute e pagamenti a mano (cassa per metodo, voce di sistema, annullati che si vedono e non contano, anticipo e «pagato fino al» che non sono incassi), i movimenti a mano e il giroconto, il residuo di ogni cassa (saldo iniziale dal giorno scelto), i totali e quelli per voce senza giroconti, i filtri, il CSV con i campi neutralizzati, e gli stessi rifiuti del database per movimento, giroconto, voce e saldo. La chiusura di cassa: il previsto dei contanti (lo stesso numero del database), l'ultima chiusura e i giorni chiusi, i suoi rifiuti nell'ordine del database, la differenza in parole, l'annullo della sola ultima chiusura, l'avviso di una ricevuta annullata dopo la chiusura, e i movimenti, i giroconti, gli annulli e il saldo che un giorno chiuso rifiuta. |
| `npm run prova:certificati` | I certificati medici che restano nell'app: gli stati della scheda (nessuno, valido, in scadenza, scaduto con o senza file, valido senza file, file di prima), sotto i 6 anni che non manca, un file per persona che prende il posto del vecchio con la data, i rifiuti (tipo, 10 MB, data) che non cambiano niente, il file che se ne va 30 giorni dopo la scadenza o con la persona disattivata, il file che passa a chi resta unendo due schede e dalla richiesta accolta alla scheda, il link di dieci minuti e il database non aggiornato col Supabase finto; cosa dice la scheda in ogni stato e quando SALVA è pronto, una sola regola per «in regola» (sotto i 6 anni, anche il 29 febbraio) in DA FARE, ISCRITTI, statistiche e area iscritti, la data che viaggia con l'accoglimento e il rollback che dice di avvisare chi gestisce il database. |
| `npm run prova:richieste` | Il modulo di iscrizione di prova: gli stessi rifiuti del database (sei richieste al giorno per email, la settima no), e una richiesta accolta che diventa un iscritto. |
| `npm run prova:iscrizione-passi` | L'iscrizione a passi (`#nuova`, solo in prova), senza browser: i passi, il conto e lo sconto famiglia una volta sola in qualunque ordine e fino a sei persone, chi si aggiunge alla famiglia (adulto o bambino, e chi firma), la nota che lega le richieste nominando le altre dentro i 1000 caratteri del database, e l'invio che si ferma a metà: chi è arrivato, chi no, e RIPROVA che manda solo le mancanti. |
| `npm run prova:comune-cap` | Il comune dal CAP nel modulo a passi, per la provincia di Torino: un comune solo si scrive da sé se il campo è vuoto (con la nota), un comune già scritto non si tocca, pochi comuni coi tasti, più di sei con la tendina, fuori provincia e CAP a metà niente. |
| `npm run prova:ricevuta` | La ricevuta di un pagamento: i conti, i rifiuti, e i PDF (con una cartella li lascia lì da guardare). |
| `npm run prova:pagamenti` | Lo storico dei pagamenti: le righe dalle ricevute (l'anticipo non è una riga) e dai pagamenti a mano, le annullate fuori dai totali, i filtri per nome (anche in ordine inverso) e per numero di ricevuta, i periodi, chi deve ancora pagare, i numeri della pagina, il CSV. |
| `npm run prova:listino` | Il legame fra corsi e voci del listino per id: rinomina, voci doppie, corsi senza prezzo o voci senza corso, aggancio dei listini vecchi per nome. |
| `npm run prova:iscritti` | L'area degli iscritti: le lezioni annullate, i sostituti e le sale cambiate, le presenze, le ricevute, gli avvisi; e che di un altro non si vede niente. Il nucleo familiare: chi lo vede, la persona in più coi dati del titolare, lo sconto famiglia, e i cambi dalla scheda della segreteria. Le presenze segnalate: chi le manda, chi le vede e chi le accoglie. |
| `npm run prova:indirizzi` | Gli indirizzi della segreteria: voce, scheda iscritto, lezione, settimana e sala che si rileggono uguali; gli indirizzi sbagliati che portano a DA FARE; quelli di Supabase, della guida e delle aree che non sono della segreteria. |
| `npm run prova:banco` | Il Banco: l'aspetto scelto (solo sul computer), dove sta ogni voce della segreteria, cosa tiene fuori di sala una persona, il tabellone sale per ore di oggi, la coda "da fare al banco", gli elenchi DA PAGARE e RICEVUTE. |
| `npm run prova:cerca-persone` | «Aggiungi chi prova» cerca fra tutte le persone: anche chi è iscritto altrove o non ha mai provato, coi corsi di oggi e senza telefono; mai personale né disattivati; dalla terza lettera, massimo ventuno, tetto di cento lettere; cosa dice la pagina (poco scritto, nessuno, ce ne sono altri, già nell'appello, senza rete, ricerca non disponibile) e l'avviso di chi ha già quel nome. |
| `npm run prova:ricerca` | La ricerca universale di «Cerca iscritto» (`cercaTutto`): i gruppi nell'ordine e solo quelli con risultati; gli iscritti per nome come `trovaIscritti`, per telefono (comunque scritto) ed email, con il perché; il minore trovato dal genitore senza mai mostrarne i dati; corsi per nome, sala e giorno; richieste online con lo stato e le da accogliere prima; istruttori coi corsi; tre righe per gruppo col totale vero; testo vuoto; lettura fallita distinta da «nessun risultato»; i dati della modalità prova, senza rete. |
| `npm run prova:prove` | Le prove dell'app di prova: aggiunte dall'appello e dal tablet, ritrovate per nome (sul tablet al massimo venti, cercate scrivendo), tolte per sbaglio, e l'elenco della segreteria. |
| `npm run prova:timer-istruttori` | Il timer nell'app istruttori: le voci di navigazione per ruolo (CALENDARIO, TIMER, I MIEI, ORE), il timer aperto dall'appello con la lezione, lo stato dell'allenamento per la striscia (calcolato dall'orologio), la domanda prima di sostituire un allenamento in corso, l'avviso senza rete. |
| `npm run prova:informativa` | Per quanto si tengono le presenze nell'informativa: solo un numero di mesi valido dal database cambia il testo; un errore, il tempo scaduto o l'app senza database lasciano quello della pagina, che non dice un numero. |
| `npm run prova:tema` | I tre temi (nero, bianco, Tatami): quale resta dopo l'avvio, un valore salvato che non si conosce, il tasto che passa al successivo, il colore della barra del browser, il timer già pubblicato che trova un tema che non conosce, i contrasti dei colori del Tatami (anche nel menu verde) e i blocchi uguali fra app e timer. |
| `npm run prova:appello-liste` | L'appello della segreteria a tre tasti: chi sta in DA SEGNARE, PRESENTI o ASSENTI (il giustificato fra gli assenti, le prove fuori), i conti che tornano sempre, il tasto con cui si apre, la riga che prende il posto dopo un tocco, TUTTI PRESENTI solo sui non segnati e l'annuncio per chi non vede lo schermo. |
| `npm run prova:tessere` | Le tessere: il foglio del RASD in righe per `importa_tessere` (tipo tradotto, fine al 31 dicembre, `;` o `,` e BOM, le righe che non si leggono saltate col motivo e il numero di riga), lo stato per ente (manca, scaduta, in scadenza a 60 giorni esatti, il rinnovo già fatto vale, un dirigente o un tecnico non copre), le parole in IN REGOLA, l'incrocio fra iscrizioni e tessere (manca, scaduta, in scadenza a 60 giorni, non iscritto; le prove gratuite, le schede archiviate e un corso senza tessera non contano), l'import in prova (nome con accenti, righe doppie, motivi) e la quinta casella di COSA MANCA |
| `npm run prova:cosa-manca` | La striscia COSA MANCA della segreteria: cinque caselle (con TESSERE) nell'ordine giusto, lo stato di ognuna (richieste in giallo, le altre in rosso, ✓ 0 in verde), mai uno 0 o un verde quando il numero non si sa, l'ultimo numero buono con l'orario se una lettura fallisce, note e nomi per chi non vede lo schermo con singolare e plurale, dove porta ogni casella, cosa si annuncia quando un numero cambia, quando i conti si rileggono e quando la striscia si vede, anche nascosta da IMPOSTAZIONI (`leggiPreferenzaStriscia`: solo «nascosta» la toglie). |
| `npm run prova:calendario` | Il calendario che si apre dalle date della SETTIMANA: il mese del giovedì della settimana in griglia, le sei righe da sette (compresi febbraio di 28 e 29 giorni e il mese che comincia di domenica), la settimana evidenziata a cavallo di mese e d'anno, i giorni con lezioni letti con i fusi giusti (la lezione di sabato sera resta di sabato), la settimana del cambio d'ora che ha sempre sette giorni, dove porta un giorno scelto (e la lezione aperta che si toglie), i titoli, e `giorniConLezioni` dei dati di prova uguale alle lezioni di `settimana`. |
| `npm run prova:ore` | LE MIE ORE dell'area istruttori: ognuno vede solo le sue, nel mese della lezione (non di quando è stata confermata), lezioni e ore delle confermate, le da confermare contate come in PRESENZE, le rifiutate con chi e quando, le lezioni tenute dove era previsto e nessuno si è segnato; e le decisioni della segreteria di prova che arrivano a `mieOre`. |
| `npm run prova:tablet` | Le regole del tablet di prova: finestre di tempo, recupero, annullo, PIN, il tablet che non scavalca l'istruttore, la presenza dell'istruttore col PIN e dall'appello, le lezioni tenute da confermare. L'«Attività» della lezione sul tablet della sua sala e di nessun'altra, e la lettura del database che non perde né kanji né attività se manca una delle due. |
| `npm run prova:email-contatto` | L'email di contatto: l'email di accesso doppia si rifiuta dicendo di chi è e di mettere l'altra come contatto, il contatto no; la forma e le 160 lettere; l'import dei fogli e il modulo online che mettono nel contatto l'indirizzo che non si può tenere; unire due schede e gli indirizzi che non si possono tenere, da dire prima; «stesso contatto di…», la ricerca, il database senza `44-email-contatto.sql`, gli esempi con un contatto in comune. |
| `npm run prova:importa` | L'importazione delle persone da CSV: virgolette, a-capo e separatore (`;` o `,`) con BOM, le righe vuote, le colonne in ordine diverso, i corsi sconosciuti, i doppioni nello stesso foglio e quelli già in palestra (nome scambiato, archiviati), le righe buone contro quelle da sistemare col perché e il loro resoconto, i ruoli delle colonne del modulo Google, le date, i codici fiscali, nome e cognome da una casella sola. |
| `npm run prova:colleghi` | Il collega segnato dall'appello: chi fa l'appello vede gli istruttori della lezione e segna presente l'altro previsto (confermata, «segnata da …»), mai se stesso, chi non è previsto, su una lezione annullata o dove non insegna, né dalla segreteria; col PIN o rifiutata non cambia niente; si toglie solo quella segnata da sé e non ancora guardata dalla segreteria. La segreteria che segna un previsto su una lezione già coperta. La riga di PRESENZE ISTRUTTORI, LE MIE ORE, e la coda senza rete (un «già segnato» non è una presenza rifiutata). Lo stesso nel database: `supabase/prova/istruttore-collega.sql`. |
| `npm run prova:vestiario` | Gli ordini di vestiario: il catalogo (capi, taglie, prezzo, nota) e i capi doppi o senza prezzo, aperti fino alla data compresa e chiusi senza data o senza capi, i rifiuti di un ordine (capo o taglia fuori catalogo, zero righe, quantità 0 o oltre 10, senza telefono), il totale fatto dal catalogo e che non cambia col prezzo, proroga e raccolta nuova, un ordine per famiglia, saldato, annullato e spostato, le righe corrette dalla segreteria e l'ordine dal banco, l'elenco per il fornitore e per persona in CSV, i numeri della raccolta, il riepilogo per il genitore. |
| `supabase/prova/email-contatto.sql` | L'email di contatto: l'email di accesso resta di una persona sola, il contatto no, stessa forma dell'email e al massimo 160 lettere, e il primo accesso lega per email e mai per contatto (anche se è quello di un istruttore o di un iscritto). Chi lo legge sta in `rls.sql`, il modulo in `iscrizioni.sql`, l'unione in `unisci-doppioni.sql`. |
| `supabase/prova/accessi-piu-stretti.sql` | Gli accessi più stretti: calendario e impostazioni le legge solo il personale, l'amministrazione e il tablet (iscritto, account senza persona e `anon` no); `allunga_calendario` non è per l'iscritto; le funzioni da segreteria o da job non si aprono a chi ha l'uid nullo se non è il sistema. |
| `supabase/prova/calendario.sql` | La generazione delle lezioni, il cambio dell'ora legale, la rigenerazione che non duplica. |
| `supabase/prova/calendario-da-se.sql` | Il calendario che si allunga da sé: anche per un istruttore, solo quando serve, fin dove dicono le regole. |
| `supabase/prova/calendario-pronto-fino.sql` | Fin dove è pronto il calendario: contano le lezioni dell'orario, e una straordinaria lontana non ferma le altre. |
| `supabase/prova/date-corsi.sql` | SALVA LE DATE: solo la segreteria; toglie le lezioni da ricorrenza di domani in poi fuori dalle date, tranne quelle con l'appello o una prova (annullate, sostituti e presenze degli istruttori se ne vanno con loro), e dice quante ne ha tolte e quante restano, con corso e ora delle prime tre; contare prima, per la conferma, non cambia niente; straordinarie, oggi e passato intatti; date sbagliate o infinite non tolgono niente. |
| `supabase/prova/attivita.sql` | L'«Attività» dei giorni e delle lezioni: il nome valido e unico, l'elenco che parte vuoto, chi lo scrive e chi lo legge, l'istruttore che sceglie solo per le sue lezioni, le lezioni future che seguono il giorno tranne quelle con l'appello, una prova o cambiate a mano, le nuove che nascono con quella del giorno, l'attività che non si elimina finché è usata, il tablet che legge solo la sua sala. |
| `supabase/prova/categorie-esercizi.sql` | Una sola categorizzazione degli esercizi: l'elenco delle discipline si completa con A corpo libero, Attrezzi, Core, Cardio, Mobilità (senza duplicare né rimettere quelle tolte), e il catalogo perde la `categoria` (vince la disciplina, se no la categoria diventa la voce; «tutte» e gli esercizi senza voce restano). Si può rilanciare; la segreteria lo scrive, gli altri lo leggono. |
| `supabase/prova/rls.sql` | Gli accessi dal punto di vista di un iscritto, di un istruttore, della segreteria e di chi non ha fatto l'accesso. |
| `supabase/prova/chiusura-cassa.sql` | La chiusura di cassa: il previsto dei contanti (saldo, movimenti, ricevute e pagamenti a mano in contanti; non POS, anticipo, annullati) lo stesso numero dell'app; i rifiuti nell'ordine, la differenza che si scrive da sola come movimento («Differenza di cassa») e nasce insieme alla chiusura o per niente; i giorni chiusi che non accettano né annulli né saldo; si annulla solo l'ultima e si può richiudere; solo l'amministrazione; si rilancia. |
| `supabase/prova/amministrazione.sql` | Il ruolo amministrazione: `e_staff()` ed `e_amministrazione()` mai nulle, ricevute e pagamenti per amministrazione e segreteria (e a nessun altro), listino come la segreteria, niente su persone, schede, corsi, iscrizioni, lezioni e tablet, niente statistiche, PIN e cambio ruoli solo alla segreteria, presenze solo se insegna anche, i vincoli dei ruoli doppi. |
| `supabase/prova/segreteria.sql` | Le lezioni che seguono i cambi dei corsi, i giorni tolti, gli archiviati, il primo accesso. |
| `supabase/prova/iscrizioni.sql` | Il modulo di iscrizione: cosa può fare chi non ha un accesso, i file, chi accoglie le richieste e come ritrova chi c'era già, e sei richieste al giorno dalla stessa email (la settima no). Il certificato non si stampa: accolta la richiesta passa alla scheda, e uno sbagliato si toglie prima. |
| `supabase/prova/vestiario.sql` | Gli ordini di vestiario: il catalogo lo salva solo la segreteria e lo legge chi non ha un accesso da `vestiario()`; chi non ha un accesso manda un ordine solo da `invia_ordine_vestiario()`, rifiutato a raccolta chiusa, fuori catalogo, senza righe, con quantità sbagliate o senza telefono; il totale dal catalogo; proroga e raccolta nuova; gli ordini li vede e li cambia solo la segreteria (e il ruolo doppio), che corregge le righe e scrive dal banco anche a raccolta chiusa; tipi, foto e tabelle delle taglie solo come nomi di file, e il contenitore «vestiario» lo riempie e lo svuota solo la segreteria, senza che chi non ha un accesso ne elenchi i file. |
| `supabase/prova/timer.sql` | Il timer: la libreria della palestra, i timer personali e dei corsi, il tablet che li apre e non li scrive, lo storico, le preferenze. |
| `supabase/prova/certificati.sql` | Certificati medici, documento e pagamenti: li vede e li cambia solo la segreteria. Il file del certificato sta in un contenitore privato (foto e PDF, 10 MB) che apre solo lei: istruttori, iscritti, tablet e chi non ha un accesso non lo leggono né ne vedono la presenza; un file nuovo prende il posto del vecchio con la data in un passaggio solo, si cancella da sé 30 giorni dopo la scadenza e con la persona disattivata. |
| `supabase/prova/ricevute.sql` | Le ricevute: le fa e le annulla solo la segreteria, il numero va avanti da sé e riparte ogni anno, i conti li fa il server, e una ricevuta fatta non si cambia. |
| `supabase/prova/pagamenti-diretti.sql` | I pagamenti a mano: li registra e li annulla solo la segreteria (persona che esiste, data, importo intero positivo, metodo, voce e nota nei limiti), uno annullato resta e non si annulla due volte, non si cambiano né si cancellano nemmeno a mano; istruttore, iscritto e chi non ha accesso non li vedono né li toccano; disattivare la persona non li tocca e unendo due schede passano a chi resta. |
| `supabase/prova/tessere.sql` | Le tessere: le legge e le scrive solo la segreteria (istruttore, iscritto, tablet e `anon` no, anche i permessi sulle funzioni); `importa_tessere` aggancia per codice fiscale E stesso nome (l'accento, l'ente in minuscolo), non crea persone, non fa doppioni (neanche dentro lo stesso foglio), dice i motivi (`nessuna_scheda`, `nome_diverso`, `riga_non_valida`) e con `solo_prova` non scrive; l'unione di due schede con la stessa tessera (senza il trigger `tessere_unione` cade con 23505); la mappa dei corsi si scrive una volta sola |
| `supabase/prova/tablet-conto-prove.sql` | Sul tablet quanti dei presenti sono venuti a provare, cioè non iscritti quel giorno (chi ha provato e poi si è iscritto è un iscritto), solo per il tablet: «10 su 10 · +1 PROVA», non «11 su 10». |
| `supabase/prova/tablet.sql` | Le stesse regole del tablet, dal lato del database, e che il tablet non veda niente più di quel che deve. |
| `supabase/prova/presenze-istruttori.sql` | La presenza degli istruttori dal PIN del tablet: da sola a chi era previsto, anche da sostituto, da confermare agli altri; la conferma solo la segreteria. |
| `supabase/prova/istruttori-dalle-lezioni.sql` | La presenza di chi fa l'appello (confermata se era previsto, da confermare se no, la segreteria al banco no) e le lezioni tenute senza l'istruttore segnato: le decide solo la segreteria, scegliendo fra i previsti; le vede lei tutte, un istruttore solo quelle dove era previsto, un iscritto no. Dopo `tablet.sql` e `presenze-istruttori.sql`. |
| `supabase/prova/istruttore-collega.sql` | Il collega segnato dall'appello: solo da chi insegna la lezione, solo fra i previsti, mai se stesso né su una lezione annullata; col PIN o rifiutata resta com'è; lo toglie solo chi l'ha segnato, finché la segreteria non l'ha guardato. La segreteria segna un previsto su una lezione già coperta. Dopo `tablet.sql`. |
| `supabase/prova/presenze-finestra.sql` | La finestra delle presenze: un istruttore segna, cambia e toglie solo da 14 giorni indietro a mezz'ora avanti (anche chi sostituisce, anche spostando un segno da una lezione all'altra), fuori finestra riceve un errore che manda alla segreteria, mai «0 righe»; la segreteria, col ruolo doppio compreso, non ha limiti; iscritta e tablet restano fuori; chi fa l'appello di una lezione non ancora cominciata non risulta presente come istruttore; la prova aggiunta dall'app segue la stessa finestra; la pulizia delle presenze vecchie non cambia. Dopo `tablet.sql`. |
| `supabase/prova/prove.sql` | Le prove: le aggiunge chi fa l'appello (dall'app o col PIN), già presenti; si ritrovano per nome, col telefono solo per la segreteria; si tolgono con la persona se è nata lì; un iscritto e chi non ha accesso non le vedono. Dopo `tablet.sql`. |
| `supabase/prova/cerca-persone.sql` | «Aggiungi chi prova» cerca per nome fra tutte le persone: anche chi è iscritto a un altro corso o non ha mai provato, con i corsi di oggi; mai personale né disattivati; dalla terza lettera di una parola, al massimo ventuno; senza telefono per nessuno; solo al personale (non al tablet, né a un iscritto, né ad `anon`). Dopo `tablet.sql`. |
| `supabase/prova/prove-per-nome.sql` | Il tablet ritrova chi è venuto a provare solo per nome: dalla terza lettera di una parola, al massimo venti e i più recenti, cento ricerche in dieci minuti e trecento al giorno per tablet, con apostrofi, trattini e accenti come nell'app, e % _ \ che non fanno da jolly; col PIN giusto e solo da un tablet. Dopo `tablet.sql` e `prove.sql`. |
| `supabase/prova/statistiche.sql` | Le statistiche: i numeri di ogni lezione contati come in PRESENZE, le prove, chi l'ha fatta, gli incassi del mese; le vede solo la segreteria. |
| `supabase/prova/elimina-istruttore.sql` | Eliminare un istruttore: solo la segreteria, solo un istruttore, e solo se non ha corsi non archiviati, lezioni in calendario o presenze da istruttore, anche cancellando la riga a mano. Un iscritto si cancella come prima. |
| `supabase/prova/unisci-doppioni.sql` | Unire due schede della stessa persona: solo la segreteria, solo due iscritti senza accesso, mai con due codici fiscali diversi; il file del certificato di chi se ne va passa a chi resta, e se ce n'è uno per parte resta quello con la scadenza più lontana; vince chi resta, il doppione riempie i vuoti, presenze, prove e iscrizioni una per lezione e per corso, le ricevute passano intatte, e tutto o niente. |
| `supabase/prova/non-doppioni.sql` | Le coppie «non sono doppioni»: le vede, le segna e le toglie solo la segreteria, una riga per coppia a nome di chi scrive; se ne vanno con la scheda, e unendo due schede passano senza fermare l'unione. |
| `supabase/prova/segnalazioni.sql` | Le segnalazioni: le legge e le scrive solo la segreteria, a nome suo; si risponde a un filo e non a una risposta; un messaggio scritto non si cambia, di un filo si cambia solo se è chiuso e la categoria (idea o correzione, obbligatoria per un filo nuovo, mai su una risposta), e niente si cancella. Istruttore, iscritto, tablet e chi non ha accesso non vedono niente. Gli allegati: bucket privato, max 3 per messaggio, tipi e 10 MB, li toglie solo chi li ha mandati (resta la traccia), si tolgono da soli 30 giorni dopo la chiusura. |
| `supabase/prova/informativa-mesi.sql` | Per quanto si tengono le presenze, per l'informativa: chi non ha un accesso legge i mesi scelti dalla segreteria e nient'altro delle impostazioni, anche dopo aver rilanciato `06-iscrizioni.sql`. |
| `supabase/prova/musica.sql` | La musica delle sale: la prepara la segreteria, il tablet vede solo quella della sua sala e non la cambia; anche le radio (indirizzi https). In fondo, il timer delle sale: uguale per tutti, lo cambia un tablet (o la segreteria) dalla sua funzione, e nient'altro della riga. |
| `supabase/prova/sito.sql` | Il sito della palestra (SITO): pagine, menu, footer e rinvii li legge e li scrive solo la segreteria; chi non ha accesso, istruttore, iscritto e tablet vedono solo il pubblicato delle pagine non nascoste, mai una bozza, e il menu senza voci verso pagine nascoste o non pubblicate. Il testo con script, iframe, `on…=`, `style=` o link `javascript:`/`data:` si rifiuta; salvare con una versione vecchia dice che la pagina è cambiata; le pagine di legge non si nascondono né si cancellano, una pagina nel menu non si cancella; indirizzi (maiuscole, accenti, riservati), voci del menu e footer con le pagine di legge, e il rinvio lasciato da un cambio di indirizzo. |
| `supabase/prova/sito-immagini.sql` | Le immagini del sito: il contenitore «sito» è pubblico, pesa al massimo 1 MB e accetta solo JPEG, PNG e WebP; le carica e le cancella solo la segreteria, con un nome fatto da un uuid minuscolo e dall'estensione (niente cartelle, niente `.html`, niente il nome del file di chi carica); istruttore, iscritto, tablet e chi non ha un accesso non caricano né cancellano. |

I file SQL girano su un Postgres qualunque con `supabase/prova/finto-supabase.sql`
applicato prima: rifà il minimo che Supabase mette a disposizione.
`npm run prova:sql` li lancia tutti, ognuno su un database suo, con le
variabili `PG*` del Postgres da usare (`scripts/prova-sql.sh`).

Su ogni PR le prove girano da sole (`.github/workflows/controlla.yml`): la
compilazione dell'app e del timer, tutti gli `npm run prova:*` e tutti i file
di `supabase/prova`. Una prova nuova entra da sé.

## Da dove viene

Il lavoro è partito dentro il timer, come «fase 1 della sala corsi»
([PR #9](https://github.com/nalbertini/Timer-/pull/9), chiusa senza unirla), ed è
stato spostato qui togliendo tutto quello che lo legava al timer: la tabella degli
allenamenti, il collegamento fra un corso e il suo timer, il tasto per avviarlo
dall'appello.
