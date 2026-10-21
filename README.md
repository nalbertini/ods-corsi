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
| `istruttori/` | Il calendario e l'appello, per istruttori e segreteria, nell'aspetto del sito (blu e giallo, sempre chiaro; il cronometro resta scuro). |
| `segreteria/` | L'area della reception, solo per chi ha il ruolo di segreteria (anche insieme a quello di istruttore o di amministrazione). |
| `amministrazione/` | L'area dei conti: PAGAMENTI e LISTINO, per chi ha il ruolo di amministrazione. Non vede le persone (`supabase/55-amministrazione.sql`). |
| `iscrizioni/` | La pagina pubblica per chi vuole iscriversi, senza accesso. |
| `iscritti/` | La pagina di chi frequenta i corsi. Il pilota, per ora solo in prova. |
| `sala/` | Il tablet di sala. |
| `collega/` | Dove chi cura i conti dice CONSENTI quando collega Claude al suo account (vedi «Le fatture dalla chat»). Ci si arriva solo da Claude. |

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

- **Pagare l'iscrizione con Satispay**: nel modulo si sceglie Satispay o il bonifico (con la ricevuta). Con Satispay l'importo lo calcola il database dal listino (solo un corso a riga di prezzo unica), e il pagamento si segna da solo: la richiesta dice «Pagata», e la ricevuta lo prende dentro una volta sola.
- **La ricevuta per email**: fatta la ricevuta, parte da sola all'email di contatto (per un minore, del genitore) da info@officinedellosport.it, col PDF allegato; lo storico dice se è partita, e **MANDA PER EMAIL** la manda o la rimanda.
- **Gli avvisi alla segreteria**: quando arriva una richiesta di iscrizione (una famiglia è un'email sola) o un pagamento Satispay, parte un'email all'indirizzo scritto in **IMPOSTAZIONI**, con la copia facoltativa; il link apre la richiesta. Solo nomi, corsi e importi, al più 50 al giorno: quelli in più li conta **RICHIESTE ONLINE**.
- **Le fatture dalla chat**: chi cura i conti fotografa a Claude fatture e scontrini dei fornitori, e Claude
  li registra in CONTABILITÀ dopo il suo «ok», col segno DALLA CHAT (server MCP `supabase/functions/mcp`,
  `supabase/72-movimenti-dalla-chat.sql`; come si accende in `supabase/LEGGIMI.md`, «Claude e la contabilità»).
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
- **I dati e le tariffe dei tecnici**: nella scheda di chi insegna, i dati per
  lettera d'incarico e ricevute (province e IBAN compresi) e una tariffa oraria
  per ogni corso, anche fatto da sostituto (`supabase/78-tariffe-tecnici.sql`).
- **La lettera d'incarico**: nella scheda del tecnico, la lettera della stagione col testo della
  palestra e le sue tariffe orarie (anche in lettere), da stampare e firmare a mano; correggerla ne
  fa una nuova e la vecchia resta, con la spunta «Firmata» (`supabase/79-lettere-incarico.sql`).
- **I compensi dei tecnici**: la pagina COMPENSI (ISTRUTTORI) fa ogni mese la ricevuta di ogni
  tecnico (autocertificazione e liquidazione) dalle ore confermate per la sua tariffa, anche col
  compenso cambiato a mano e il perché, tutte in un PDF; «Firmata» e «Non torna più»
  (`supabase/80-ricevute-compensi.sql`). SEGNA PAGATO scrive l'uscita in CONTABILITÀ (anche più
  mesi in un movimento, bonifico o contanti), e il movimento annullato le rimette da pagare
  (`supabase/81-compensi-pagati.sql`).
- **Manca la firma**: in COMPENSI chi era previsto a una lezione tenuta in due e non ha firmato,
  con C'ERA e «Non c'era»; nei corsi alternati «a lezione basta uno» (`supabase/82-manca-la-firma.sql`).
- **Gli iscritti di un corso**: nella scheda di un corso, DATI e ISCRITTI; in ISCRITTI una
  persona per riga con certificato e quota a parole, ricerca, ordinamento per colonna e un clic
  che apre la sua scheda; Indietro ritrova ricerca e ordine (`src/lib/segreteria.ts`).
- **L'email di contatto**: l'email di accesso resta di una sola persona; chi usa
  l'indirizzo di un altro (fratelli, un genitore, a volte un istruttore) ha una
  seconda, l'email di contatto, che può ripetersi e dove la palestra scrive alla
  famiglia; l'app non ci manda mai mail. L'import e il modulo online ci mettono
  da soli l'indirizzo già di altri, la scheda mostra chi lo condivide
  (`supabase/44-email-contatto.sql`).
- **La pagina delle iscrizioni** è corta: cosa preparare, quanto costa in breve, la prova e i dubbi, e il tasto
  per cominciare in fondo; i prezzi di ogni corso e come si paga stanno a `iscrizioni/#prezzi`.
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
  tiene in rosso gli appelli da chiudere degli ultimi sette giorni. I nomi
  sono in ordine di chi viene di più a quella lezione (stesso corso e giorno
  della settimana, ultime 12 volte), poi per cognome (`src/lib/frequenza.ts`).
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
  insegnava con lui (`supabase/46-istruttore-collega.sql`); una presenza rifiutata si può eliminare dall'elenco (`supabase/65-elimina-presenza-rifiutata.sql`). Si apre con
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
  `src/lib/ricevutaPdf.ts`). Lo **storico dei pagamenti** di ogni persona nella sua scheda (ogni ricevuta con i suoi pagamenti sotto, e i pagamenti fatti a mano senza ricevuta, `supabase/54-pagamenti-diretti.sql`); registrando un pagamento a mano l'app chiede se farne la ricevuta (già compilata, il pagamento conta una volta sola) e a chi vede CONTABILITÀ dice dove entra l'incasso e la pagina **PAGAMENTI** con quelli di tutti: cerca, periodo, modo di pagare, chi deve ancora pagare e il CSV per il commercialista (`src/lib/pagamenti.ts`). Le **presenze** del mese: medie per corso, chi si sta
  perdendo, gli appelli che mancano, e il CSV. Le **statistiche**, su più mesi: presenze e iscritti mese per mese, i giorni e le ore
  in cui si viene, i corsi che si riempiono (sugli iscritti e sui posti), le lezioni di ogni
  istruttore, le prove mese per mese, chi è in regola e gli incassi delle ricevute; i conti li fa il database
  (`supabase/22-statistiche.sql`). In fondo **IL SITO**, solo per la segreteria: visite al sito e tocchi su Iscriviti, Chiama e
  Scrivici mese per mese, le pagine più lette e da dove si arriva, letti da GoatCounter dalla funzione `conti-sito` (`src/lib/sitoNumeri.ts`, `src/lib/sitoStatistiche.ts`). Subito sopra, **DAL SITO ALLE RICHIESTE**: visite →
  tocchi su Iscriviti → richieste arrivate dal sito (per persona) → accolte, con quanti passano da un gradino all'altro (`src/lib/filaSito.ts`). Le **presenze degli istruttori** entrati col PIN,
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
  stampa in PDF (`supabase/60-chiusura-cassa.sql`, `src/lib/chiusuraCassaPdf.ts`). Il **bilancio** di un anno
  solare, per cassa, con il confronto con l'anno prima, i saldi delle casse e il CSV e il PDF per il
  commercialista (`src/lib/bilancio.ts`, `src/lib/bilancioPdf.ts`; nessun file SQL). I movimenti dello **storico
  del vecchio programma** si **collegano alla persona** che ha pagato: i casi sicuri (nome e cognome di una sola scheda) in
  blocco, con riepilogo da confermare e TOGLI QUESTO LOTTO; gli omonimi a mano; lo storico compare a parte nella scheda
  della persona, mai sommato ai suoi pagamenti. È solo un'etichetta: i conti non cambiano
  (`supabase/70-movimenti-persona.sql`, `src/lib/movimentiPersona.ts`).
  In ISCRITTI il filtro **Pagato nel vecchio programma** (dietro «Altri filtri») mostra chi ha un incasso collegato nella
  stagione e risulta ancora da pagare: chi ha pagato la quota si segna in blocco «pagata senza ricevuta dell'app», gli altri
  (solo corsi, sotto 50 €, incasso del genitore) si guardano dalla scheda
  (`supabase/71-pagato-vecchio-programma.sql`, `src/lib/pagatoPrima.ts`).
- **L'editor delle pagine** (voce SITO, toccando una pagina): Puck completo a tutto schermo, col suo aspetto, per ogni pagina
  (`src/components/segreteria/EditorPuck.tsx`, regole in `src/lib/sitoPezzi.ts`). In alto Salva bozza e Pubblica; nel pannello della
  pagina titolo e descrizione col conteggio, indirizzo, orario dai corsi, Dividi in parti, nascondi e cancella. Le pagine di legge hanno
  solo la parte Testo (`parteAmmessa`). Ha le parti PULSANTI (da 1 a 3, il modulo sempre «Iscriviti» per primo, senza cambiare impaginazione) e DOMANDE
  (tessere chiare e domande frequenti per Google), disegnate da `conPartiPulsanti` e `impagina` di `src/lib/sitoGenera.ts`.
- **L'orario delle pagine corso del sito** (voce SITO, ORARIO DAI CORSI): una pagina si collega a uno o più corsi e il suo
  orario viene dalle ricorrenze di CORSI (solo giorno, ora e durata), senza riscriverlo a mano né premere Pubblica: il sito
  si aggiorna da solo entro 5 minuti. Un corso senza giorni dà «Orario in arrivo», mai un orario vecchio
  (`src/lib/sitoOrario.ts`, `supabase/68-sito-orario.sql`).
- **Le pagine del sito a pezzi** (voce SITO, NUOVA PAGINA): una pagina nuova si compone con foto in cima, testi, foto e
  colonne affiancate (da due a tre; una sotto l'altra sul telefono), con l'editor Puck (`src/components/segreteria/EditorPuck.tsx`):
  i pezzi si trascinano, si spostano, si tolgono e si annullano; COM'È SUL SITO mostra la pagina come il generatore la scrive.
  I pezzi si conservano in `sito_pagine.bozza_pezzi` (`supabase/62-sito-pezzi.sql`) e il testo piatto che ne esce (`src/lib/sitoPezzi.ts`) è la
  bozza di sempre: il sito resta statico e le tessere si formano da sole. Le pagine che c'erano prima, scritte col testo solo, si aprono
  già a parti (`pezziDaAprire`: `htmlInPezzi` spezza il testo senza cambiarlo) e restano com'erano finché non si salvano; da lì non si torna indietro.
  La parte ISCRIVITI è l'invito giallo in fondo alla pagina (`invito()` di `src/lib/sitoGenera.ts`: prove da 3 € e 10 €, poi i riquadri Iscriviti,
  Chiama, Scrivici e Vieni a trovarci), con titolo e frase della segreteria: una sola, sempre in fondo, e prende il posto dell'invito di sempre.
  Nella pagina Istruttori la parte ISTRUTTORE è un tecnico (nome, cognome, corsi, foto, la sua pagina): le tessere del sito seguono l'ordine
  delle parti (`elencoIstruttori` di `src/lib/sitoIstruttori.ts`), e un testo messo prima di un istruttore porta l'avviso col «!».
- **Il sito della palestra** (voce SITO della segreteria): le pagine del sito, il menu in alto e il footer si
  scrivono nell'app, senza WordPress. Ogni pagina ha una **bozza**, che non cambia il sito, e un testo
  **pubblicato**, che cambia solo con PUBBLICA; il testo ricco passa da un editor che ammette solo titoli,
  grassetto, corsivo, elenchi, citazione, link e pulsante, e viene ripulito prima di salvarlo
  (`src/lib/sitoTesto.ts`, `src/lib/sitoPagine.ts`). Le pagine di legge (privacy, cookie, contributi pubblici)
  restano sempre sul sito. Le scrive solo la segreteria; chi non ha l'accesso legge solo il pubblicato
  (`supabase/56-sito.sql`). Le pagine pubblicate diventano il sito vero con `npm run sito:genera`
  (`src/lib/sitoGenera.ts`, `scripts/genera-sito.mjs`): file statici senza codice né servizi esterni, a parte il contatore delle visite qui sotto (c'è solo un blocco di dati strutturati JSON-LD per Google e gli assistenti AI:
  sede, corsi, domande frequenti, briciole, in `src/lib/sitoDati.ts`; per le condivisioni, le meta Open Graph e Twitter con l'immagine `sito/risorse/social.png`, 1200×630; e `llms.txt` alla radice, che racconta il sito agli assistenti AI), con
  carattere (Big Shoulders Display e Inter, licenza OFL accanto) e logo propri in `sito/risorse/`, nell'aspetto «tatami blu e giallo»
  (i colori e le regole sono in `docs/design-canvas/sito-approvato/token-proposta.md`, A2); il testo si ripulisce un'altra volta quando si genera, perché
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
  **Le visite al sito** si contano con [GoatCounter](https://www.goatcounter.com/), senza cookie: la variabile del
  repository `SITO_STATISTICHE` è il codice del sito su GoatCounter (quello di `https://<codice>.goatcounter.com`,
  solo minuscole, cifre e trattini). Con la variabile, ogni pagina e la 404 hanno nella `<head>` lo script ufficiale
  (`https://gc.zgo.at/count.js`, `async`), e i link a iscrizione, telefono e WhatsApp contano un clic come «iscriviti»,
  «chiama» e «scrivici» (solo un totale, mai il testo del link); la 404 si conta col titolo «404» e l'indirizzo chiesto.
  I rinvii, la sitemap, `robots.txt`, `llms.txt` e l'anteprima del pannello non cambiano. Senza la variabile (o vuota)
  il sito è identico a prima; con un codice fuori forma pure, e il giro mette un avviso senza fermarsi. **La variabile si
  accende solo dopo aver pubblicato le pagine cookie e privacy nuove**, che dicono del contatore: prima i testi, poi il codice.
- **La pagina Orari del sito**: l'orario settimanale dei corsi (corso, giorno, ora) preso da CORSI, non scritto a mano.
  La segreteria crea la pagina `orari` con un paragrafo `[orari]` e il sito la riempie da solo a ogni giro
  (`src/lib/sitoOrari.ts`, `orari_sito()` in `supabase/69-orari-sito.sql`): niente sala, istruttore o iscritti.
- **Il modulo di iscrizione**, al posto di quello su Google Form: chi si
  iscrive risponde alle domande dal telefono, **firma col dito** il modulo
  delle autorizzazioni (il PDF della palestra, compilato coi suoi dati da
  `src/lib/firma.ts`; o ne carica la foto firmata a mano), e carica il
  documento d'identità, il certificato medico se c'è già, e la ricevuta del
  bonifico o di Satispay, obbligatoria dalla pagina pubblica: il modulo mostra
  quanto pagare, l'IBAN e la causale (`fileObbligatori` in `src/lib/richieste.ts`)
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
- **Da dove arrivano le richieste**: ogni link al modulo porta un'etichetta (`?da=home`, `?da=corso-judo` dal sito,
  da sé; `?da=segreteria` da COPIA LINK ISCRIZIONI; una scritta a mano per un post o un volantino) e il modulo chiede,
  facoltativo, «Come ci hai conosciuto?» con otto scelte; un'etichetta sbagliata non ferma mai la richiesta. La
  segreteria le vede nella richiesta (ARRIVATA DA, CI HA CONOSCIUTO) e le conta in STATISTICHE, per persona e per corso,
  e le eliminate da nuove, come lo spam, non contano più (`src/lib/provenienza.ts`, `supabase/74-provenienza-richieste.sql`).
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
| `npm run prova:sito-pezzi` | Le pagine del sito a pezzi, senza browser: pezzi validi o no (tipi, id unici, 2 o 3 colonne, foto in cima solo al primo posto, al massimo 100), il loro HTML piatto sempre ripulito, le colonne ammesse da `pulisciTesto` e lasciate intatte dal generatore, affiancate sul computer e in colonna sola sul telefono (720px). |
| `npm run prova:sito-orario` | L'orario delle pagine del sito dalle ricorrenze di CORSI, senza browser: righe raggruppate per ora e durata e ordinate lunedì-domenica, più corsi che si sommano, «Orario in arrivo» e mai orari vecchi, avviso dei corsi collegati senza orari, pagina non collegata identica a oggi, database senza `68-sito-orario.sql`, modalità prova. |
| `npm run prova:sito-collage` | La testata della home con foto e numeri, senza browser: il collage c'è solo nella home che non è di legge e solo dal testo prima del primo `<h2>`; le foto dell'introduzione (al massimo tre, la prima grande, quelle di un sito non dichiarato fuori) e un elenco di 2–6 voci con il grassetto iniziale (cifra grande, scritta piccola, voce lunga a testo piccolo) diventano tessere; colori a rotazione senza colori nuovi, `35+ anni di sport` testo normale e non titolo, `loading`, `fetchpriority` e `decoding` messi dal generatore dopo la pulizia, «Contattaci» solo con la pagina contatti e mai un prezzo che la segreteria non ha scritto; griglia a 6 colonne sul desktop (foto grande 4×3, numeri da 2 colonne, due foto in fondo) e a 2 colonne sotto i 900px, senza buchi. |
| `npm run prova:sito-home` | Le fasce della Home come nel design, senza browser: quattro foto di fila fanno una fascia alta a quattro colonne (a 2 colonne sul telefono), la firma di una citazione ha l'avatar con le iniziali, la tessera col solo titolo lo tiene in basso e grande, e una foto seguita da due o più citazioni sta a sinistra del carosello (una sotto l'altra sul telefono). Le voci dei corsi con un `<em>` finale di etichette note (Bambini, Adulti, Anziani, Agonisti) hanno le pillole d'età con l'icona. |
| `npm run prova:sito-fasce` | La coerenza fra `docs/sito/home.html` e `docs/sito/corsi.html`: per ogni corso presente in tutte e due, stesse fasce (Bambini, Adulti, Agonisti, Anziani) e stessa età. Non dice cosa significhi «Bambini». |
| `npm run prova:sito-istruttori-pagine` | Le pagine dei singoli istruttori in `docs/sito/istruttori`, senza browser: quella di Maurizio, passata da `generaSito`, ha la forma del design (in breve a 4 tessere, la sua storia a 3, il percorso a 3); nessuna pagina ha email, telefono o indirizzo di casa; c'è un file per ognuno dei 13 con nome e corsi giusti; chi non ha il testo ha «[da scrivere]» e «Stato: da scrivere». |
| `npm run prova:sito-home-nuova` | La Home rivista, senza browser: si riconosce dal pulsante verso l'iscrizione nell'introduzione (senza, il `<main>` è identico a prima, con uno snapshot), pulsanti primario e secondario, foto, numeri e motto dell'introduzione, schede dei corsi con foto o iniziale e pastiglie, quattro tessere numerate, citazioni con estratto e «Leggi tutto», due recensioni larghe e «In breve», domande sempre aperte, chiamata finale, e la testata (pulsante intero, MENU senza script) e il piede (indirizzo e metro Fermi) di ogni pagina. |
| `npm run prova:sito-corsi-nuova` | La pagina I corsi rivista, senza browser: si riconosce dal pulsante verso l'iscrizione e dai corsi tutti con link prima del primo titolo grande (senza, il `<main>` di prima); titolo da 120 px, frase, nove schede come nella Home, foto in coda scartate, chiamata finale, e il testo `docs/sito/corsi.html`. |
| `npm run prova:sito-home-aspetto` | Le misure della Home rivista a 1440, 768 e 375px lette dal CSS: titoli con `clamp()`, passo di 96px (64 sul telefono), stacchi, numeri, foto delle schede, colonne, bersagli di almeno 48px e il tasto MENU che apre `#menu` con `:target`. |
| `npm run prova:sito-scala` | Il sito sul computer ha la scala del design a 1440px, senza browser: titolo da 228px, collage largo 640px con righe da 128px, 96px sotto ogni sezione, tessere alte almeno 190px solo dal computer in su; sul telefono la testata non si allunga. |
| `npm run prova:sito-social` | Le anteprime di condivisione e `llms.txt`: meta Open Graph e Twitter su ogni pagina indicizzabile con indirizzi assoluti e testo escapato, nessuna sul 404 né sui rinvii, l'immagine 1200×630, e `llms.txt` fatto solo dalle pagine pubblicate (corsi, pagine, legge, contatti), su una riga per voce, senza date e uguale a ogni generazione. |
| `npm run prova:fila-sito` | La fila DAL SITO ALLE RICHIESTE di STATISTICHE, senza browser: visite e tocchi su Iscriviti presi da IL SITO, le richieste «dal sito» per persona (Home, corsi e pagine del sito anche col vecchio indirizzo; non il link della segreteria, l'area iscritti, un corso o una parola che sul sito non c'è), le accolte nello stato di oggi, il corso che non conta, le percentuali («meno dell'1%», «—», oltre il 100% con la frase), un guaio che toglie solo la sua metà, senza i titoli del sito le richieste a «non si sa», nessuna lettura sua. |
| `npm run prova:statistiche-sito` | IL SITO in STATISTICHE, senza rete: i giorni di Roma in UTC (anche il 25 ottobre e il 28 marzo), il periodo da chiedere a GoatCounter che comincia dal 20 ottobre 2026, i mesi senza quelli prima, le visite mese per mese senza i clic, Iscriviti/Chiama/Scrivici, le 5 pagine più lette senza la 404 e senza i clic, le 5 provenienze, «Altre» e «Diretto o non si sa»; la funzione `conti-sito` con la copia identica delle regole, il segreto, il sito `ods`, la segreteria attiva e le tre chiamate; la memoria di 10 minuti per periodo, AGGIORNA una volta al minuto, «si conta dal», le sette frasi d’errore (401 e 403 della funzione dicono di rientrare) e la modalità prova coi numeri fissi; i testi di GoatCounter tagliati a 120 caratteri, i tocchi senza giorni spartiti sui mesi come stima, fino a 3 pagine di voci; il riquadro in fondo, fuori dal CSV, senza regole di lettura sue. |
| `npm run prova:sito-statistiche` | Il contatore delle visite (GoatCounter, senza cookie), senza browser: senza `SITO_STATISTICHE` (o vuota) il sito è identico byte per byte; con un codice buono un solo script esterno, quello ufficiale, nella `<head>` di ogni pagina e della 404 (titolo «404», senza canonical), niente codice in linea, e i clic contati solo su iscrizione («iscriviti»), telefono («chiama») e WhatsApp («scrivici») col nome come titolo, mai il testo del link; rinvii, sitemap, robots e llms uguali; un codice fuori forma (virgolette, spazi, indirizzi, `../`, troppo lungo, a capo) non entra mai, `generaSito` non si ferma e lo script finisce bene con un `::warning::` che non ripete il valore; la variabile la legge solo `scripts/genera-sito.mjs` e il giro del sito la passa. |
| `npm run prova:sito-genera` | Il sito generato e lo script che lo scrive: un file per pagina, mai codice né servizi esterni (a parte il contatore delle visite, vedi `prova:sito-statistiche`), titolo e voci sempre escapati anche se arrivano dall'API, indirizzi strani scartati, sitemap, robots, rinvii e 404, le stesse pagine due volte danno gli stessi file, e lo script non cancella mai una cartella che non è sua né tocca il sito di prima se qualcosa non va. Ogni link al modulo con l'etichetta della sua pagina (`?da=home`, `?da=corso-…`, l'indirizzo), un `?da=` scritto a mano che resta con la stessa impaginazione, `eIscrizione` che ignora la query. |
| `npm run prova:sito-orari` | La pagina Orari del sito: la voce «Martedì 19:00–20:00 · corso» (fine anche oltre la mezzanotte), l'ordine da lunedì a domenica e per ora, solo corso, giorno, ora e durata (mai sala, istruttore, iscritti), nome del corso escapato, «Orari in arrivo» senza orari, «Aggiornato al» dai dati e mai da oggi, il giro del sito che si ferma se `orari_sito()` manca e lascia il sito di prima, la gemella della modalità prova e la voce di menu solo verso una pagina pubblicata. Il filtro sul database sta in `supabase/prova/orari-sito.sql`. |
| `npm run prova:sito-pubblica` | La pubblicazione del sito, senza GitHub: un repository finto e il suo remoto. Il primo giro copia i file e fa un commit, lo stesso sito due volte non ne fa un altro, quello che sparisce dalle pagine sparisce dal sito, il dominio (`CNAME`) resta, e un sito vuoto, senza la home o in una cartella sbagliata non si pubblica mai. |
| `npm run prova:segreteria` | La segreteria di prova: i cambi di un corso che arrivano al calendario, all'appello e al tablet. Unire due schede della stessa persona, e i possibili doppioni da proporre. L'«Attività» di ogni giorno scelta da un elenco: nomi, rinomina, eliminazione, NON PIÙ IN USO, giorno e lezioni, l'istruttore che cambia la sua, il database senza `41-attivita.sql`. SALVA LE DATE che toglie le lezioni fuori dalle date dei corsi, tranne quelle con l'appello o una prova: la conferma prima, col conto, e l'avviso dopo, con corso e ora di quelle rimaste. I pagamenti a mano della prova rifiutano il futuro e, in contanti, un giorno chiuso. |
| `npm run prova:ruoli` | I ruoli del personale: le tre spunte (segreteria, amministrazione, istruttore) in tutte le combinazioni e il ruolo che ne esce, le aree, chi insegna, il nome del ruolo, un ruolo sconosciuto che non va in nessuna area, e chi può cosa (l'amministrazione solo ricevute, pagamenti, listino e contabilità). |
| `npm run prova:bilancio` | Il bilancio di un anno, senza browser: i confini dell'anno (31 dicembre e 1 gennaio), totali senza giroconti e annullati, le voci che sommano ai totali e a MOVIMENTI, la somma degli anni uguale a «Tutto», l'annullo che cambia l'anno vecchio, «Da classificare» e il risultato provvisorio oltre metà delle uscite, la differenza di cassa a parte, l'anno in corso parziale col confronto allo stesso giorno, «nessun dato», i saldi delle casse con giroconti e giorno di partenza, il possibile doppio conteggio fra storico e app, il CSV senza nomi con i negativi veri, e il PDF senza nomi. |
| `npm run prova:movimenti-persona` | I movimenti dello storico collegati alla persona, senza browser: il nome nella causale («Cliente … per …») in qualunque ordine, con maiuscole, accenti, spazi doppi, a capo, apostrofi e nome doppio; una scheda sola (sicuro), più d'una (omonimi, da decidere a mano) o nessuna; cosa si può collegare e cosa no, con le parole del database; la forma del riepilogo prima di scrivere. Nomi tutti inventati. |
| `npm run prova:pagato-prima` | Il filtro «Pagato nel vecchio programma» degli ISCRITTI, senza browser: chi ha una quota di almeno 50 € collegata a sé, in stagione, e nell'app è ancora da pagare (da segnare); sotto 50 €, solo corsi o incasso del genitore (da guardare a mano, senza casella); chi è già a posto, non attivo o con storico fuori stagione no; i non collegati si contano a parte; la frase «28/09/2026 · 50 € quota associativa»; segnare in blocco a pacchetti, con i falliti per nome; il filtro dietro «Altri filtri»; senza `71-pagato-vecchio-programma.sql` il filtro non si offre; i dati della modalità prova. |
| `npm run prova:contabilita` | La contabilità, prima parte, senza browser: gli incassi degli iscritti ricavati da ricevute e pagamenti a mano (cassa per metodo, voce di sistema, annullati che si vedono e non contano, anticipo e «pagato fino al» che non sono incassi), i movimenti a mano e il giroconto, il residuo di ogni cassa (saldo iniziale dal giorno scelto), i totali e quelli per voce senza giroconti, i filtri, il CSV con i campi neutralizzati, e gli stessi rifiuti del database per movimento, giroconto, voce e saldo. La chiusura di cassa: il previsto dei contanti (lo stesso numero del database), l'ultima chiusura e i giorni chiusi, i suoi rifiuti nell'ordine del database, la differenza in parole, l'annullo della sola ultima chiusura, l'avviso di una ricevuta annullata dopo la chiusura, e i movimenti, i giroconti, gli annulli e il saldo che un giorno chiuso rifiuta. Il riepilogo prima di registrare un movimento o un giroconto (Contabilita.tsx scrive solo dopo il sì) e la chiusura alla cieca: il previsto, il dentro e la differenza compaiono solo dopo aver contato. Cambiare la voce: quali movimenti si scelgono (non incassi, annullati, giroconti, la differenza di una chiusura), gli stessi rifiuti del database con le stesse parole, il riepilogo, i pacchetti da 500 e l'esito; e Contabilita.tsx che scrive solo dopo il sì del riepilogo. |
| `npm run prova:mcp` | Le fatture dalla chat, senza Deno e senza browser: il server MCP (`src/lib/mcp.ts`) che chiede l'accesso a chi non ha il token (401 coi metadati per l'OAuth di Claude), risponde a `initialize`, tace sulle notifiche, dice -32601 a un metodo che non c'è e offre quattro strumenti (solo `registra_movimento` scrive); solo l'amministrazione li usa. Le regole (`src/lib/movimentiDallaChat.ts`): le voci da offrire (mai disattivate, incassi degli iscritti, «Differenza di cassa»; «Da classificare» solo se la chiedi), l'importo all'italiana, i campi che mancano, gli stessi rifiuti del database su date, casse e giorni chiusi, codice fiscale e IBAN fuori dalla descrizione, il doppione che ferma finché non lo si conferma, la voce proposta dai simili e l'errore detto per chi usa l'app. Poi la segreteria dalla chat, in sola lettura (`src/lib/chatSegreteria.ts`): `tools/list` e istruzioni secondo il ruolo (contabilità, segreteria, tutte e due; spenta di base), `corsi`, `certificati`, `quote`, `iscritti`, `presenze`, `chi_manca` solo per la segreteria, adulti per nome e minori, chi è senza data di nascita e chi è venuto a provare solo contati, mai contatti, codice fiscale, data di nascita, nota del pagamento o numero di ricevuta; `presenze` al massimo per un anno, con le date che non vanno dette per chi usa l'app e l'errore del database (22023) com'è; il certificato dei minori dal giorno dei 6 anni (`seiAnni`, `serveCertificatoDal`); il database non ancora aggiornato detto per chi usa l'app, quello che non risponde a chi sei con gli strumenti di sempre; `puoCollegare`, `cosaPotra` e `frasiConsenso` del consenso. |
| `npm run prova:certificati` | I certificati medici che restano nell'app: gli stati della scheda (nessuno, valido, in scadenza, scaduto con o senza file, valido senza file, file di prima), sotto i 6 anni che non manca, un file per persona che prende il posto del vecchio con la data, i rifiuti (tipo, 10 MB, data) che non cambiano niente, il file che se ne va 30 giorni dopo la scadenza o con la persona disattivata, il file che passa a chi resta unendo due schede e dalla richiesta accolta alla scheda, il link di dieci minuti e il database non aggiornato col Supabase finto; cosa dice la scheda in ogni stato e quando SALVA è pronto, una sola regola per «in regola» (sotto i 6 anni, anche il 29 febbraio) in DA FARE, ISCRITTI, statistiche e area iscritti, la data che viaggia con l'accoglimento e il rollback che dice di avvisare chi gestisce il database. |
| `npm run prova:richieste` | Il modulo di iscrizione di prova: gli stessi rifiuti del database (sei richieste al giorno per email, la settima no), e una richiesta accolta che diventa un iscritto. L'etichetta del link e «come ci hai conosciuto» puliti o scartati come nel database, che non passano alla scheda, e i conteggi in una chiave loro, che seguono lo stato; eliminata da nuova non conta più, accolta o rifiutata sì. |
| `npm run prova:provenienza` | Da dove arrivano le richieste, senza browser: l'etichetta `?da=` pulita come nel database (91 caratteri, codice, barre, formule, numeri, elenchi: scartati), la prima della visita e mai salvata sul telefono, `area-iscritti` dall'area iscritti senza domanda, la stessa etichetta e risposta per tutta la famiglia, COPIA LINK ISCRIZIONI con `?da=segreteria`, i nomi leggibili (anche di un corso che ha cambiato indirizzo), i conti del riquadro di STATISTICHE per persona e per corso con NON SI SA in fondo, le frasi, e il client Supabase senza `74-provenienza-richieste.sql`. |
| `npm run prova:iscrizione-passi` | L'iscrizione a passi (`#nuova`, solo in prova), senza browser: i passi, il conto e lo sconto famiglia una volta sola in qualunque ordine e fino a sei persone, chi si aggiunge alla famiglia (adulto o bambino, e chi firma), la nota che lega le richieste nominando le altre dentro i 1000 caratteri del database, e l'invio che si ferma a metà: chi è arrivato, chi no, e RIPROVA che manda solo le mancanti. |
| `npm run prova:iscrizione-pagina` | La pagina pubblica `iscrizioni/`, senza browser: le sezioni (apertura, cosa ti serve, quanto costa in breve, prova e dubbi, COMPILA LA RICHIESTA una volta in fondo), le frasi di `lib/paginaIscrizioni.ts`, le cifre del riquadro breve dal listino, da `SCONTO_FAMIGLIA` e da `PIU_CORSI`, la pagina dei prezzi a `#prezzi`, la vista scelta dall'hash e la colonna da 720px. |
| `npm run prova:comune-cap` | Il comune dal CAP nel modulo a passi, per la provincia di Torino: un comune solo si scrive da sé se il campo è vuoto (con la nota), un comune già scritto non si tocca, pochi comuni coi tasti, più di sei con la tendina, fuori provincia e CAP a metà niente. |
| `npm run prova:ricevuta` | La ricevuta di un pagamento: i conti, i rifiuti, e i PDF (con una cartella li lascia lì da guardare). |
| `npm run prova:ricevute-email` | La ricevuta per email: lo stato nello storico (mandata, non mandata, fatta prima, senza email di contatto, annullata), la domanda di FAI LA RICEVUTA e di MANDA PER EMAIL, gli avvisi (soglia di 400, posta che non risponde, file SQL mancante) mai grezzi, il testo della mail senza codici fiscali, e la modalità prova che simula senza rete. |
| `npm run prova:tariffe` | I dati e le tariffe dei tecnici: province (due lettere) e IBAN controllati e puliti, gli euro scritti a mano in centesimi («15,50», «15.5»; zero, negativi e testo no), le righe della scheda (i corsi di cui è titolare e quelli fatti da sostituto, senza doppioni e in ordine, una tariffa vecchia che non si perde), la segreteria di prova che scrive e toglie una tariffa, il MODIFICA dell'anagrafica che non cancella province e IBAN, e le colonne giuste col database. |
| `npm run prova:lettere` | La lettera d'incarico dei tecnici: gli importi a parole («quindici/50», «ventuno/00»), la stagione che parte il 1° settembre e la proposta di periodo, il saluto dal codice fiscale, cosa manca prima di farla (tariffe, periodo, qualifica, codice fiscale e residenza), il testo della bozza coi punti da 2 a 11, il PDF (con una cartella lo lascia lì da guardare), la segreteria di prova che fa, sostituisce e spunta firmata, e la funzione e la sola colonna `firmata` col database. |
| `npm run prova:carta` | La carta intestata dei documenti: `cartaIntestata` la scarica o dice di controllare la connessione (404, rete giù, HTML al posto del PDF), `stampaSuCarta` stampa sulla carta o chiede se stampare senza, `cartaSePuoi` va avanti senza dove non c'è nessuno a cui chiedere. Come escono sulla carta ricevute, compensi, bilancio, chiusura di cassa e report lo provano i loro script. |
| `npm run prova:compensi` | Il compenso del mese dei tecnici: corso per corso le ore confermate per la tariffa (90 minuti a 15 € fanno 22,50 €), i corsi senza tariffa a parte e fuori dal calcolato, lo stato di ogni tecnico (da confermare, senza tariffa, da fare, fatta, non torna) e chi ha una riga nella pagina COMPENSI, il perché obbligatorio se il compenso è cambiato a mano, il testo della ricevuta (autocertificazione e liquidazione, senza la riga del progetto, mansione della lettera già barrata, netto uguale al lordo), il PDF di una e di più ricevute (con una cartella lo lascia lì da guardare), la segreteria di prova che fa, annulla, rifà e spunta firmata, e le funzioni e la sola colonna `firmata` col database. Le lezioni senza firma: chi era previsto a una lezione tenuta in due e non ha firmato (mai se rifiutato o da confermare, se nessuno ha firmato, col sostituto, annullata, non ancora finita, di un altro mese o nei corsi dove «a lezione basta uno»), e la riga di chi ha solo quelle («solo attese»). |
| `npm run prova:compensi-pagati` | Il compenso pagato in CONTABILITÀ: la ricevuta pagata (`pagata`, anche se il conto adesso non torna), la descrizione del movimento coi mesi brevi in ordine («Compenso · Anna Gialli · set, ott 2026», «dic 2026, gen 2027»), il preso nell'anno per data di pagamento, le ricevute da pagare di un tecnico, la segreteria di prova che paga più mesi con un movimento «Compensi istruttori» dal Conto Corrente o dalla Cassa Contanti, i rifiuti (due tecnici, annullate, già pagate, domani, prima della cassa, giorno chiuso), la pagata che non si annulla, il movimento annullato che le rimette da pagare, e `paga_compensi` col database. |
| `npm run prova:avvisi-segreteria` | Gli avvisi alla segreteria: il testo delle email (una richiesta da pagare o pagata, la famiglia in una mail sola col «fuori età, da richiamare», il pagamento Satispay dopo la richiesta e quello senza richiesta con l'email lasciata), mai note, codice fiscale, nascita o nomi di file, l'HTML e l'oggetto al riparo da quel che scrive chi si iscrive, gli indirizzi (senza il primo nessun avviso, la chiocciola senza dominio rifiutata), il tetto di 50, la stessa chiave d'invio per le richieste mandate insieme, il link a una richiesta, la copia della Edge Function, e la modalità prova senza rete. |
| `npm run prova:pagamenti` | Lo storico dei pagamenti: le righe dalle ricevute (l'anticipo non è una riga) e dai pagamenti a mano, le annullate fuori dai totali, i filtri per nome (anche in ordine inverso) e per numero di ricevuta, i periodi, chi deve ancora pagare, i numeri della pagina, il CSV. Il pagamento a mano non è nel futuro e, in contanti, non va in un giorno già chiuso (carta e bonifico sì); il riepilogo che si legge prima di registrare (con dove entra in CONTABILITÀ, la stessa cassa e voce di `incassiDerivati`), e che Ricevute.tsx scrive solo dopo il sì e non se si fa la ricevuta. La ricevuta fatta da un pagamento a mano: una voce sola già pagata, la quota con le date della stagione (non pagata per sempre), una riga sola in PAGAMENTI; ricevuta non fatta, il pagamento torna nel modulo. |
| `npm run prova:listino` | Il legame fra corsi e voci del listino per id: rinomina, voci doppie, corsi senza prezzo o voci senza corso, aggancio dei listini vecchi per nome. |
| `npm run prova:satispay` | Satispay nel modulo di iscrizione, senza rete: lo stato di Satispay, quando il modulo lo offre (non attivo, corsi senza prezzo), i testi dopo l'invio (in attesa, pagato, non andato), un pagato in PAGAMENTI e CONTABILITÀ una volta sola anche dopo la ricevuta, la firma delle chiamate, `paga` in prova con l'importo della stima, e prima paghi poi mandi: il riquadro PAGA (`statoRiquadroPaga`), il pagato senza richiesta in PAGAMENTI, il ritorno da Satispay, `prepara` e `invia` col pagamento in prova, e il tasto PAGA che è un link già pronto. |
| `npm run prova:iscritti` | L'area degli iscritti: le lezioni annullate, i sostituti e le sale cambiate, le presenze, le ricevute, gli avvisi; e che di un altro non si vede niente. Il nucleo familiare: chi lo vede, la persona in più coi dati del titolare, lo sconto famiglia, e i cambi dalla scheda della segreteria. Le presenze segnalate: chi le manda, chi le vede e chi le accoglie. |
| `npm run prova:indirizzi` | Gli indirizzi della segreteria: voce, scheda iscritto, lezione, settimana e sala che si rileggono uguali; gli indirizzi sbagliati che portano a DA FARE; quelli di Supabase, della guida e delle aree che non sono della segreteria. |
| `npm run prova:banco` | Il Banco: l'aspetto scelto (solo sul computer), dove sta ogni voce della segreteria, cosa tiene fuori di sala una persona, il tabellone sale per ore di oggi, la coda "da fare al banco", gli elenchi DA PAGARE e RICEVUTE. |
| `npm run prova:cerca-persone` | «Aggiungi chi prova» cerca fra tutte le persone: anche chi è iscritto altrove o non ha mai provato, coi corsi di oggi e senza telefono; mai personale né disattivati; dalla terza lettera, massimo ventuno, tetto di cento lettere; cosa dice la pagina (poco scritto, nessuno, ce ne sono altri, già nell'appello, senza rete, ricerca non disponibile) e l'avviso di chi ha già quel nome. |
| `npm run prova:ricerca` | La ricerca universale di «Cerca iscritto» (`cercaTutto`): i gruppi nell'ordine e solo quelli con risultati; gli iscritti per nome come `trovaIscritti`, per telefono (comunque scritto) ed email, con il perché; il minore trovato dal genitore senza mai mostrarne i dati; corsi per nome, sala e giorno; richieste online con lo stato e le da accogliere prima; istruttori coi corsi; tre righe per gruppo col totale vero; testo vuoto; lettura fallita distinta da «nessun risultato»; i dati della modalità prova, senza rete. |
| `npm run prova:prove` | Le prove dell'app di prova: aggiunte dall'appello e dal tablet, ritrovate per nome (sul tablet al massimo venti, cercate scrivendo), tolte per sbaglio, e l'elenco della segreteria. |
| `npm run prova:timer-istruttori` | Il timer nell'app istruttori: le voci di navigazione per ruolo (CALENDARIO, TIMER, I MIEI, ORE), il timer aperto dall'appello con la lezione, lo stato dell'allenamento per la striscia (calcolato dall'orologio), la domanda prima di sostituire un allenamento in corso, l'avviso senza rete. |
| `npm run prova:istruttori-look` | L'area istruttore col look del sito: sempre chiara anche con scuro o Tatami salvato (la scelta non si cancella e torna fuori dall'area), niente tasto del tema, passare da segreteria a istruttori senza passare dallo scuro, le parole di stato dell'appello e del calendario col segno davanti (`src/lib/etichetteAppello.ts`), le regole del CSS (giallo solo su tasto principale e voce corrente, sola lettura in giallo scuro su bianco, striscia chiara) e la guida. |
| `npm run prova:informativa` | Per quanto si tengono le presenze nell'informativa: solo un numero di mesi valido dal database cambia il testo; un errore, il tempo scaduto o l'app senza database lasciano quello della pagina, che non dice un numero. |
| `npm run prova:tema` | I tre temi (nero, bianco, Tatami): quale resta dopo l'avvio, un valore salvato che non si conosce, il tasto che passa al successivo, il colore della barra del browser, il timer già pubblicato che trova un tema che non conosce, i contrasti dei colori del Tatami (anche nel menu verde) e i blocchi uguali fra app e timer. |
| `npm run prova:appello-liste` | L'appello della segreteria a tre tasti: chi sta in DA SEGNARE, PRESENTI o ASSENTI (il giustificato fra gli assenti, le prove fuori), i conti che tornano sempre, il tasto con cui si apre, la riga che prende il posto dopo un tocco, TUTTI PRESENTI solo sui non segnati e l'annuncio per chi non vede lo schermo. |
| `npm run prova:appello-ordine` | L'ordine dell'appello per presenze: gli iscritti dal più presente al meno presente a quella lezione (ultime 12 svolte, non annullate, stesso corso e stesso giorno della settimana in fuso italiano, l'ora non conta), solo `presente` conta, la lezione aperta no, a parità il cognome, le prove in fondo, nessuna riga che si sposta dopo un tocco, la lezione passata riaperta con i non segnati in cima, la modalità prova e il database (finto) con la stessa uscita e, se lo storico non si legge, l'appello per cognome senza errori. |
| `npm run prova:frequenza` | Chi viene e chi si sta perdendo (`src/lib/frequenza.ts`): presenti su dovute senza i giustificati, annullate e lezioni senza appello fuori, chi ha 3 o più assenze di fila con l'ultima presenza e i corsi, lo stesso risultato di PRESENZE di prima; `GIORNI_RECENTI` (60), quanto indietro guarda `chi_manca`. |
| `npm run prova:tessere` | Le tessere: il foglio del RASD in righe per `importa_tessere` (tipo tradotto, fine al 31 dicembre, `;` o `,` e BOM, le righe che non si leggono saltate col motivo e il numero di riga), lo stato per ente (manca, scaduta, in scadenza a 60 giorni esatti, il rinnovo già fatto vale, un dirigente o un tecnico non copre), le parole in IN REGOLA, l'incrocio fra iscrizioni e tessere (manca, scaduta, in scadenza a 60 giorni, non iscritto; le prove gratuite, le schede archiviate e un corso senza tessera non contano), l'import in prova (nome con accenti, righe doppie, motivi) e la quinta casella di COSA MANCA |
| `npm run prova:fogli-moduli` | I tre fogli di `public/moduli/` costruiti da codice: le autorizzazioni con i campi giusti (caselle vere, vuoti, A4, titolo e lingua, niente JavaScript) e le stesse parole di prima (`scripts/fixture-moduli`), il foglio dei costi con ogni voce di `costi.ts` (il saldo solo se è ancora aperto), i file committati uguali a quelli che si generano, font e loghi incorporati; il testo si estrae con `pdfcraft-cli` |
| `npm run prova:cosa-manca` | La striscia COSA MANCA della segreteria: cinque caselle (con TESSERE) nell'ordine giusto, lo stato di ognuna (richieste in giallo, le altre in rosso, ✓ 0 in verde), mai uno 0 o un verde quando il numero non si sa, l'ultimo numero buono con l'orario se una lettura fallisce, note e nomi per chi non vede lo schermo con singolare e plurale, dove porta ogni casella, cosa si annuncia quando un numero cambia, quando i conti si rileggono e quando la striscia si vede, anche nascosta da IMPOSTAZIONI (`leggiPreferenzaStriscia`: solo «nascosta» la toglie). |
| `npm run prova:calendario` | Il calendario che si apre dalle date della SETTIMANA: il mese del giovedì della settimana in griglia, le sei righe da sette (compresi febbraio di 28 e 29 giorni e il mese che comincia di domenica), la settimana evidenziata a cavallo di mese e d'anno, i giorni con lezioni letti con i fusi giusti (la lezione di sabato sera resta di sabato), la settimana del cambio d'ora che ha sempre sette giorni, dove porta un giorno scelto (e la lezione aperta che si toglie), i titoli, e `giorniConLezioni` dei dati di prova uguale alle lezioni di `settimana`. |
| `npm run prova:ore` | LE MIE ORE dell'area istruttori: ognuno vede solo le sue, nel mese della lezione (non di quando è stata confermata), lezioni e ore delle confermate, le da confermare contate come in PRESENZE, le rifiutate con chi e quando, le lezioni tenute dove era previsto e nessuno si è segnato; e le decisioni della segreteria di prova che arrivano a `mieOre`. |
| `npm run prova:tablet` | Le regole del tablet di prova: finestre di tempo, recupero, annullo, PIN, il tablet che non scavalca l'istruttore, la presenza dell'istruttore col PIN e dall'appello, le lezioni tenute da confermare. L'«Attività» della lezione sul tablet della sua sala e di nessun'altra, e la lettura del database che non perde né kanji né attività se manca una delle due. |
| `npm run prova:email-contatto` | L'email di contatto: l'email di accesso doppia si rifiuta dicendo di chi è e di mettere l'altra come contatto, il contatto no; la forma e le 160 lettere; l'import dei fogli e il modulo online che mettono nel contatto l'indirizzo che non si può tenere; unire due schede e gli indirizzi che non si possono tenere, da dire prima; «stesso contatto di…», la ricerca, il database senza `44-email-contatto.sql`, gli esempi con un contatto in comune. |
| `npm run prova:importa-prima-nota` | L'import dello storico dei movimenti dal vecchio programma, su un testo inventato: le righe con la causale che va a capo, i salti pagina, le righe senza cassa o a zero, l'importo lordo, le voci scelte dalla causale, i totali del piede e il filtro sugli incassi dopo una data (`src/lib/importaPrimaNota.ts`). |
| `npm run prova:importa` | L'importazione delle persone da CSV: virgolette, a-capo e separatore (`;` o `,`) con BOM, le righe vuote, le colonne in ordine diverso, i corsi sconosciuti, i doppioni nello stesso foglio e quelli già in palestra (nome scambiato, archiviati), le righe buone contro quelle da sistemare col perché e il loro resoconto, i ruoli delle colonne del modulo Google, le date, i codici fiscali, nome e cognome da una casella sola. |
| `npm run prova:colleghi` | Il collega segnato dall'appello: chi fa l'appello vede gli istruttori della lezione e segna presente l'altro previsto (confermata, «segnata da …»), mai se stesso, chi non è previsto, su una lezione annullata o dove non insegna, né dalla segreteria; col PIN o rifiutata non cambia niente; si toglie solo quella segnata da sé e non ancora guardata dalla segreteria. La segreteria che segna un previsto su una lezione già coperta. La riga di PRESENZE ISTRUTTORI, LE MIE ORE, e la coda senza rete (un «già segnato» non è una presenza rifiutata). Lo stesso nel database: `supabase/prova/istruttore-collega.sql`. «Non c'era»: la segreteria segna un previsto senza firma come rifiutato (una volta sola, mai fuori dai previsti né su una annullata), e «a lezione basta uno» salvato col corso e letto nelle presenze: `supabase/prova/manca-la-firma.sql`. |
| `npm run prova:vestiario` | Gli ordini di vestiario: il catalogo (capi, taglie, prezzo, nota) e i capi doppi o senza prezzo, aperti fino alla data compresa e chiusi senza data o senza capi, i rifiuti di un ordine (capo o taglia fuori catalogo, zero righe, quantità 0 o oltre 10, senza telefono), il totale fatto dal catalogo e che non cambia col prezzo, proroga e raccolta nuova, un ordine per famiglia, saldato, annullato e spostato, le righe corrette dalla segreteria e l'ordine dal banco, l'elenco per il fornitore e per persona in CSV, i numeri della raccolta, il riepilogo per il genitore. |
| `npm run prova:testi` | I testi di tasti, tag e conferme delle schermate della segreteria elencate nello script: nessuna parola tutta maiuscola (salvo sigle come CSV e PDF); etichette di colonna e titoli restano maiuscoli. |
| `npm run prova:etichette-lezione` | I tag di una lezione nella settimana, senza browser: Annullata, Senza appello, Appello fatto, Manca l'istruttore, Sostituto, Cambiata a mano, Straordinaria, e il loro ordine. |
| `supabase/prova/email-contatto.sql` | L'email di contatto: l'email di accesso resta di una persona sola, il contatto no, stessa forma dell'email e al massimo 160 lettere, e il primo accesso lega per email e mai per contatto (anche se è quello di un istruttore o di un iscritto). Chi lo legge sta in `rls.sql`, il modulo in `iscrizioni.sql`, l'unione in `unisci-doppioni.sql`. |
| `supabase/prova/ricevute-email.sql` | La ricevuta per email: l'indirizzo è solo l'email di contatto della persona della ricevuta (mai quella di accesso) e lo legge solo la funzione del server; una riga per tentativo, mandata o non partita; la segreteria legge tutto, l'amministrazione solo data ed esito, istruttore, tablet, iscritto e chi non ha accesso niente; le 400 mandate al giorno di Roma; le annullate non si mandano. |
| `supabase/prova/accessi-piu-stretti.sql` | Gli accessi più stretti: calendario e impostazioni le legge solo il personale, l'amministrazione e il tablet (iscritto, account senza persona e `anon` no); `allunga_calendario` non è per l'iscritto; le funzioni da segreteria o da job non si aprono a chi ha l'uid nullo se non è il sistema. |
| `supabase/prova/calendario.sql` | La generazione delle lezioni, il cambio dell'ora legale, la rigenerazione che non duplica. |
| `supabase/prova/calendario-da-se.sql` | Il calendario che si allunga da sé: anche per un istruttore, solo quando serve, fin dove dicono le regole. |
| `supabase/prova/calendario-pronto-fino.sql` | Fin dove è pronto il calendario: contano le lezioni dell'orario, e una straordinaria lontana non ferma le altre. |
| `supabase/prova/date-corsi.sql` | SALVA LE DATE: solo la segreteria; toglie le lezioni da ricorrenza di domani in poi fuori dalle date, tranne quelle con l'appello o una prova (annullate, sostituti e presenze degli istruttori se ne vanno con loro), e dice quante ne ha tolte e quante restano, con corso e ora delle prime tre; contare prima, per la conferma, non cambia niente; straordinarie, oggi e passato intatti; date sbagliate o infinite non tolgono niente. |
| `supabase/prova/attivita.sql` | L'«Attività» dei giorni e delle lezioni: il nome valido e unico, l'elenco che parte vuoto, chi lo scrive e chi lo legge, l'istruttore che sceglie solo per le sue lezioni, le lezioni future che seguono il giorno tranne quelle con l'appello, una prova o cambiate a mano, le nuove che nascono con quella del giorno, l'attività che non si elimina finché è usata, il tablet che legge solo la sua sala. |
| `supabase/prova/categorie-esercizi.sql` | Una sola categorizzazione degli esercizi: l'elenco delle discipline si completa con A corpo libero, Attrezzi, Core, Cardio, Mobilità (senza duplicare né rimettere quelle tolte), e il catalogo perde la `categoria` (vince la disciplina, se no la categoria diventa la voce; «tutte» e gli esercizi senza voce restano). Si può rilanciare; la segreteria lo scrive, gli altri lo leggono. |
| `supabase/prova/rls.sql` | Gli accessi dal punto di vista di un iscritto, di un istruttore, della segreteria e di chi non ha fatto l'accesso. |
| `supabase/prova/cambia-voce.sql` | Cambiare la voce dei movimenti: solo l'amministrazione, un lotto tutto o niente (al massimo 500), i rifiuti (annullati, giroconti, differenza di una chiusura, voce spenta o dell'altro tipo), la voce che cambia anche in un giorno chiuso senza muovere la chiusura, la traccia di chi e quando, l'import rilanciato che non la disfa. |
| `supabase/prova/movimenti-persona.sql` | Collegare lo storico alla persona: solo l'amministrazione collega, scollega e legge la traccia (lo storico di una scheda lo vede la segreteria, non istruttori, tablet, iscritti), il blocco dei sicuri e il rilancio, gli omonimi a mano, un lotto tutto o niente, TOGLI QUESTO LOTTO, i rifiuti, il giorno chiuso, scheda unita o eliminata, e saldi, bilancio, previsto e chiusure identici prima e dopo. |
| `supabase/prova/pagato-vecchio-programma.sql` | La lettura `incassi_vecchio_programma()`: solo la segreteria (amministrazione senza segreteria, istruttori, tablet, iscritti e anon no); gli incassi dello storico in stagione (1 settembre – 31 luglio, confini compresi), collegati o no; fuori la stagione scorsa, gli annullati, le uscite, i movimenti a mano e le altre voci; sola lettura. |
| `supabase/prova/importa-prima-nota.sql` | L'import dello storico dei movimenti: solo l'amministrazione, idempotenza per chiave, voci, rifiuti con il numero della riga, un pacchetto o entra tutto o niente, giorni chiusi, rilancio del file. |
| `supabase/prova/movimenti-dalla-chat.sql` | Le fatture dalla chat: `registra_movimento_dalla_chat` e `movimenti_simili` solo per l'amministrazione (segreteria semplice, istruttore, tablet, iscritto e `anon` no, nessuna scrittura); la stessa chiave due volte scrive un movimento solo, segnato dalla chat e di chi ha il token; le regole di `registra_movimento` (importo, data, inizio della cassa, giorno chiuso) e niente incassi degli iscritti; i simili al più cinque, a mano e non annullati, mai persone, voci di sistema o chi li ha scritti. |
| `supabase/prova/75-chat-segreteria.sql` | La segreteria dalla chat: `chat_iscritti`, `chat_registro`, `chat_prove` solo per la segreteria (istruttore, sola amministrazione, iscritto, accesso senza scheda, tablet di sala: «Questa parte è per la segreteria»; `anon` niente), security definer e stable con `search_path = public, extensions`, `chat_eta` stable, colonne fisse; nome e cognome solo degli adulti, mai la data di nascita: solo il giorno dei 6 anni dei minori che non li hanno compiuti (il 29 febbraio dal 1° marzo), la chiave di un minore che cambia col «sale» di ogni domanda e resta la stessa fra le pagine, e niente senza sale; la data dalla fonte più recente (scheda o richiesta accolta, a parità la scheda); 18 anni oggi e il 29 febbraio; disattivati fuori; le quote senza ricevuta né nota, in ordine; il registro per giorni di Roma, mai dopo adesso, al massimo un anno, con la lezione senza iscritti e lo staff iscritto a un corso; le prove solo contate. |
| `supabase/prova/chiusura-cassa.sql` | La chiusura di cassa: il previsto dei contanti (saldo, movimenti, ricevute e pagamenti a mano in contanti; non POS, anticipo, annullati) lo stesso numero dell'app; i rifiuti nell'ordine, la differenza che si scrive da sola come movimento («Differenza di cassa») e nasce insieme alla chiusura o per niente; i giorni chiusi che non accettano né annulli né saldo; si annulla solo l'ultima e si può richiudere; solo l'amministrazione; si rilancia. |
| `supabase/prova/amministrazione.sql` | Il ruolo amministrazione: `e_staff()` ed `e_amministrazione()` mai nulle, ricevute e pagamenti per amministrazione e segreteria (e a nessun altro), listino come la segreteria, niente su persone, schede, corsi, iscrizioni, lezioni e tablet, niente statistiche, PIN e cambio ruoli solo alla segreteria, presenze solo se insegna anche, i vincoli dei ruoli doppi. |
| `supabase/prova/segreteria.sql` | Le lezioni che seguono i cambi dei corsi, i giorni tolti, gli archiviati, il primo accesso. |
| `supabase/prova/provenienza-richieste.sql` | Da dove arrivano le richieste (`74-provenienza-richieste.sql`): l'etichetta del link e «come ci hai conosciuto» puliti o scartati senza fermare la richiesta, il vincolo per chi scrive a mano, solo la segreteria le legge, i conteggi senza dati personali scritti solo dal trigger, per persona e per stato; eliminata da nuova (lo spam) non conta più, accolta o rifiutata sì; e il file che si rilancia. |
| `supabase/prova/iscrizioni.sql` | Il modulo di iscrizione: cosa può fare chi non ha un accesso, i file, chi accoglie le richieste e come ritrova chi c'era già, e sei richieste al giorno dalla stessa email (la settima no). Il certificato non si stampa: accolta la richiesta passa alla scheda, e uno sbagliato si toglie prima. |
| `supabase/prova/vestiario.sql` | Gli ordini di vestiario: il catalogo lo salva solo la segreteria e lo legge chi non ha un accesso da `vestiario()`; chi non ha un accesso manda un ordine solo da `invia_ordine_vestiario()`, rifiutato a raccolta chiusa, fuori catalogo, senza righe, con quantità sbagliate o senza telefono; il totale dal catalogo; proroga e raccolta nuova; gli ordini li vede e li cambia solo la segreteria (e il ruolo doppio), che corregge le righe e scrive dal banco anche a raccolta chiusa; tipi, foto e tabelle delle taglie solo come nomi di file, e il contenitore «vestiario» lo riempie e lo svuota solo la segreteria, senza che chi non ha un accesso ne elenchi i file. |
| `supabase/prova/timer.sql` | Il timer: la libreria della palestra, i timer personali e dei corsi, il tablet che li apre e non li scrive, lo storico, le preferenze. |
| `supabase/prova/certificati.sql` | Certificati medici, documento e pagamenti: li vede e li cambia solo la segreteria. Il file del certificato sta in un contenitore privato (foto e PDF, 10 MB) che apre solo lei: istruttori, iscritti, tablet e chi non ha un accesso non lo leggono né ne vedono la presenza; un file nuovo prende il posto del vecchio con la data in un passaggio solo, si cancella da sé 30 giorni dopo la scadenza e con la persona disattivata. |
| `supabase/prova/ricevute.sql` | Le ricevute: le fa e le annulla solo la segreteria, il numero va avanti da sé e riparte ogni anno, i conti li fa il server, e una ricevuta fatta non si cambia. |
| `supabase/prova/pagamenti-diretti.sql` | I pagamenti a mano: li registra e li annulla solo la segreteria (persona che esiste, data, importo intero positivo, metodo, voce e nota nei limiti), uno annullato resta e non si annulla due volte, non si cambiano né si cancellano nemmeno a mano; istruttore, iscritto e chi non ha accesso non li vedono né li toccano; disattivare la persona non li tocca e unendo due schede passano a chi resta. Non nel futuro (oggi a Roma sì, il passato senza soglie nuove, anche scritto a mano) e, in contanti, non in un giorno già chiuso dalla cassa (carta e bonifico sì). |
| `supabase/prova/tessere.sql` | Le tessere: le legge e le scrive solo la segreteria (istruttore, iscritto, tablet e `anon` no, anche i permessi sulle funzioni); `importa_tessere` aggancia per codice fiscale E stesso nome (l'accento, l'ente in minuscolo), non crea persone, non fa doppioni (neanche dentro lo stesso foglio), dice i motivi (`nessuna_scheda`, `nome_diverso`, `riga_non_valida`) e con `solo_prova` non scrive; l'unione di due schede con la stessa tessera (senza il trigger `tessere_unione` cade con 23505); la mappa dei corsi si scrive una volta sola |
| `supabase/prova/tablet-conto-prove.sql` | Sul tablet quanti dei presenti sono venuti a provare, cioè non iscritti quel giorno (chi ha provato e poi si è iscritto è un iscritto), solo per il tablet: «10 su 10 · +1 PROVA», non «11 su 10». |
| `supabase/prova/tablet.sql` | Le stesse regole del tablet, dal lato del database, e che il tablet non veda niente più di quel che deve. |
| `supabase/prova/presenze-istruttori.sql` | La presenza degli istruttori dal PIN del tablet: da sola a chi era previsto, anche da sostituto, da confermare agli altri; la conferma, e l'eliminazione di una rifiutata, solo la segreteria. |
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
| `supabase/prova/sito-pezzi.sql` | Le pagine del sito a pezzi: `bozza_pezzi` la scrive solo la segreteria (creando la pagina o con `salva_bozza_pezzi_sito`, stessa versione e stessi errori di `salva_bozza_sito`, che non la tocca); un JSON che non è un oggetto o pesa più di 400000 caratteri si rifiuta, il testo con codice si rifiuta come sempre; istruttore, iscritto, tablet e chi non ha un accesso non salvano né leggono i pezzi; `sito_pagine_pubbliche()` non li mostra. |
| `supabase/prova/sito-orario.sql` | L'orario del sito dai corsi: una pagina si collega ai corsi solo dalla segreteria (`salva_corsi_sito`, senza doppioni e nell'ordine scelto, un corso o una pagina che non ci sono si rifiutano, versione e bozza non cambiano); chi non ha un accesso legge i corsi collegati solo delle pagine pubblicate e non nascoste; `orari_aperti()` dice solo corso, giorno, ora e durata, senza le ricorrenze finite; istruttori e iscritti non collegano niente. |
| `supabase/prova/satispay.sql` | Satispay nel modulo di iscrizione: l'importo dal listino (`importo_iscrizione`: saldo, annuale, trimestre, corso senza prezzo), solo un corso con una riga di prezzo, un solo pagamento in attesa per richiesta, l'esito di Satispay che non torna indietro, le funzioni solo per la Edge Function, la tabella letta solo dalla segreteria e scritta da nessuno, il pagamento che resta se la richiesta se ne va, ed `emetti_ricevuta_satispay` una volta sola e con l'importo esatto; dalla sezione 8, prima paghi poi mandi (`83-satispay-prima.sql`): `importo_corso`, il pagamento senza richiesta, `invia_iscrizione` che lo prende solo se è arrivato, libero e per il suo corso e la sua formula, e chi lo legge. |
| `supabase/prova/tariffe-tecnici.sql` | Province e IBAN nell'anagrafica (due lettere maiuscole, IBAN senza spazi, gli altri rifiutati) e le tariffe orarie dei tecnici per corso: una per corso, fra 1 centesimo e 1000 euro, con chi l'ha cambiata; le legge e le scrive solo la segreteria (né un istruttore, né l'amministrazione senza segreteria, né chi non ha un accesso, che non legge nemmeno l'IBAN); se ne vanno col corso o con la persona. |
| `supabase/prova/lettere-incarico.sql` | Le lettere d'incarico dei tecnici: fatte solo dalla funzione e solo dalla segreteria, coi dati e le tariffe copiati dentro, una sola valida per persona e stagione (la seconda sostituisce la prima), i rifiuti, dopo si cambia solo `firmata`, nessun altro ruolo legge o scrive, e un tecnico con lettere non si elimina. |
| `supabase/prova/ricevute-compensi.sql` | Le ricevute mensili dei compensi dei tecnici: fatte solo dalla funzione e solo dalla segreteria, per chi insegna, mai per un mese che deve ancora venire, coi dati del tecnico e le righe del conto copiati dentro, una sola non annullata per persona e mese (annullata, si rifà), il perché obbligatorio se il compenso non è il calcolato, i rifiuti, dopo si cambia solo `firmata`, nessun altro ruolo legge o scrive (nemmeno il tecnico), e un tecnico con ricevute non si elimina. |
| `supabase/prova/compensi-pagati.sql` | Il compenso pagato in CONTABILITÀ: la voce di sistema «Compensi istruttori», `paga_compensi` solo per chi è segreteria e amministrazione insieme, un movimento d'uscita per più ricevute dello stesso tecnico (importo, persona, descrizione coi mesi, mai codice fiscale né IBAN), tutto o niente sui rifiuti (due tecnici, annullate, già pagate, domani, prima della cassa, giorno chiuso), la pagata che non si annulla, il movimento annullato che le rimette da pagare, le colonne nuove che non si cambiano a mano, e il file che si rilancia. |
| `supabase/prova/avvisi-segreteria.sql` | Gli avvisi alla segreteria: un avviso per richiesta, uno per la famiglia mandata insieme (col fuori età), la richiesta che aspetta qualche minuto, la ricevuta del bonifico vista, un pagamento Satispay dopo la richiesta avvisato una volta anche con più callback, quello fatto prima detto nella richiesta, quello senza richiesta solo dopo un'ora, mai due volte, niente dopo un rifiuto o una cancellazione, niente arretrati, senza indirizzo nessun avviso, al più 50 al giorno con quelli in più contati, mai note, codice fiscale o nascita, e chi può cosa: indirizzi solo alla segreteria, avvisi solo alla Edge Function. |
| `supabase/prova/manca-la-firma.sql` | Manca la firma: `segna_istruttore_assente` («Non c'era») solo dalla segreteria, una presenza rifiutata, prevista, scelta da chi la segna, una volta sola («gia»), mai fuori dai previsti (nemmeno chi il sostituto ha sostituito), su una annullata o una lezione che non c'è; istruttore, iscritto, tablet e senza accesso no. `corsi.basta_uno` parte falso, non vuoto, e lo cambia solo la segreteria. |

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
