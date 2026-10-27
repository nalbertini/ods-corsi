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
7. `07-certificati-pagamenti.sql` — il certificato medico (la scadenza; il file lo aggiunge il 45), il documento d'identità (su carta) e il pagamento degli iscritti
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
34. `34-prove-per-nome.sql` — sul tablet chi è già venuto a provare si cerca per nome, dalla terza lettera di una parola e al massimo venti, con cento ricerche in dieci minuti e trecento al giorno per tablet: il tablet non ha più l'elenco intero
35. `35-date-corsi.sql` — SALVA LE DATE toglie le lezioni da domani in poi rimaste fuori da inizio e fine dei corsi, tranne quelle con l'appello o una prova, e dice quante
36. `36-tablet-conto-prove.sql` — sul tablet chi è venuto a provare si conta a parte: «10 presenti su 10 · +1 PROVA», non «11 su 10»
37. `37-mie-ore.sql` — in LE MIE ORE l'istruttore vede anche le lezioni tenute in cui era previsto e nessuno si è segnato; la segreteria le vede tutte, come prima
38. `38-segnalazioni-categoria.sql` — la categoria delle segnalazioni: idea o correzione, scelta da chi la apre e cambiabile dalla segreteria; i fili di prima restano senza
39. `39-musica-radio.sql` — le liste della musica delle sale possono essere anche radio: un indirizzo https, accanto a YouTube e Spotify
40. `40-discipline.sql` — la lista delle discipline della palestra (Judo, Lotta, Pilates, Yoga…), tenuta dalla segreteria, e la disciplina di ogni lista di musica; esercizi e timer la tengono nel loro JSON
41. `41-attivita.sql` — l'«Attività» di ogni giorno dei corsi e di ogni lezione, scelta da un elenco della segreteria: le lezioni future seguono il giorno, l'istruttore cambia solo quella delle sue lezioni, il tablet legge quella della sua sala
42. `42-categorie-esercizi.sql` — gli esercizi hanno una sola categoria: le cinque vecchie (A corpo libero, Attrezzi, Core, Cardio, Mobilità) diventano voci dell'elenco delle discipline, e il campo `categoria` esce dal catalogo
43. `43-cerca-persone.sql` — «Aggiungi chi prova» cerca per nome fra tutte le persone iscritte e attive, anche di altri corsi, dalla terza lettera di una parola e al massimo ventuno risultati, con i corsi di oggi e mai il telefono; solo il personale
44. `44-email-contatto.sql` — l'email di contatto delle persone (`persone.email_contatto`): facoltativa, può ripetersi fra parenti, la scrive la segreteria e la legge il personale come l'email di accesso, che resta una per persona; accogliere una richiesta e unire due schede la tengono in conto
45. `45-certificati-online.sql` — il certificato medico resta nell'app: un file per persona (foto o PDF, 10 MB) in un contenitore privato che apre solo la segreteria, caricato insieme alla data in un passaggio solo, cancellato 30 giorni dopo la scadenza o quando la persona è disattivata; accogliendo una richiesta il certificato passa alla scheda, e unire due schede non si ferma più sul file
46. `46-istruttore-collega.sql` — il collega che insegnava con te: chi fa l'appello vede gli altri istruttori previsti e ne segna uno presente (confermato, «segnata da …»), e lo toglie finché la segreteria non l'ha guardato; la segreteria segna «c'era» un previsto anche su una lezione già coperta
47. `47-vestiario.sql` — gli ordini di vestiario, judogi e costumini: il catalogo (capo, taglie, prezzo, nota) in `impostazioni.vestiario` e la data di chiusura nella raccolta, li salva la segreteria; chi non ha un accesso legge il catalogo da `vestiario()` e manda un ordine da `invia_ordine_vestiario()` fino alla data compresa, coi prezzi e il totale messi dal database; gli ordini li vede e li cambia solo la segreteria, che corregge le righe e scrive dal banco anche a raccolta chiusa
48. `48-orari-aperti.sql` — gli orari dei corsi aperti (giorno, ora e durata delle ricorrenze non finite) per chi non ha un accesso, da `orari_aperti()`: il modulo a passi ci propone al genitore i corsi alla stessa ora del figlio; le tabelle restano chiuse
49. `49-richieste-per-email.sql` — sei richieste al giorno dalla stessa email, non più tre: una famiglia di sei persone le manda tutte con una email sola; cambia solo il numero in `iscrizioni_regole()`
50. `50-file-rimandato.sql` — un file rimandato non è un file di troppo: se il quinto file di una richiesta è arrivato ma la risposta si è persa, RIPROVA lo rimanda e sbatte sul doppione (che l'app legge «arrivato»), non sul limite di cinque; il file già caricato resta quello
51. `51-vestiario-foto.sql` — il vestiario come il modulo: ogni capo con un tipo facoltativo (judogi, costumini, vestiario) e una foto, e una tabella delle taglie per tipo in `impostazioni.vestiario_tabelle`; le immagini stanno nel contenitore pubblico «vestiario» (1 MB, jpeg, png, webp), le carica, cambia e cancella solo la segreteria, chi non ha un accesso le vede dall'URL pubblico ma non le elenca; `salva_vestiario()` e `vestiario()` cambiano dentro, non nella firma
52. `52-presenze-finestra.sql` — le presenze degli allievi si toccano solo nelle lezioni di questi giorni: un istruttore da 30 minuti prima dell'inizio a 14 giorni dopo (gli stessi numeri del tablet, `tablet_regole()`), la segreteria sempre; fuori finestra il database risponde con un errore che dice di scrivere alla segreteria (un trigger su `presenze`, non una policy, perché una policy toglierebbe le righe in silenzio); l'appello non accredita più l'ora dell'istruttore per una lezione che inizia fra più di mezz'ora
53. `53-codice-fiscale-stesso-nome.sql` — accogliendo una richiesta, il codice fiscale aggancia una scheda già in elenco solo se anche nome e cognome sono gli stessi (prima bastava il codice, che sanno in tanti): con un altro nome nasce una scheda nuova, e la segreteria che sa che è la stessa persona la sceglie a mano; `accogli_iscrizione()` cambia dentro, non nella firma
54. `54-pagamenti-diretti.sql` — i pagamenti fatti a mano, senza ricevuta (in palestra, in contanti, prima dell'app): la segreteria li registra nella scheda e compaiono nello storico dei pagamenti accanto a quelli delle ricevute; come le ricevute non si cambiano e non si cancellano, si annullano; non cambiano se uno è in regola; l'unione di due schede li porta con sé
55. `55-amministrazione.sql` — il ruolo «amministrazione», per chi cura i conti: vede e fa sulle ricevute, sui pagamenti e sul listino quel che fa la segreteria, e non vede le persone né le statistiche. Si combina con la segreteria (`anche_amministrazione`) e con l'insegnamento (`anche_istruttore`, ora anche per l'amministrazione, con PIN e presenze). Chi cura i conti registra e annulla i pagamenti senza vedere le persone: i nomi di chi ha pagato li cerca `cerca_pagatori` (solo nome e cognome, al massimo otto, sessanta ricerche ogni dieci minuti, dopo `34-prove-per-nome.sql`). Account, ruoli, PIN e backup restano alla segreteria
56. `56-sito.sql` — il sito della palestra, scritto dal pannello SITO: le pagine (bozza e pubblicato, con la versione che ferma chi salva sopra un'altra), il menu e il footer, i rinvii dei vecchi indirizzi; le legge e le scrive solo la segreteria, e chiunque, anche senza accesso, vede soltanto il pubblicato delle pagine non nascoste (`sito_pagine_pubbliche()`, `sito_menu_pubblico()`, `sito_redirect_pubblici()`); il testo con script, iframe, `on…=`, `style=` o link `javascript:` si rifiuta; privacy, cookie e contributi pubblici non si nascondono né si cancellano
57. `57-accessi-piu-stretti.sql` — niente che si veda in app: `sessioni` e `impostazioni` le legge solo chi lavora (istruttori e segreteria, amministrazione, tablet di sala) e non più ogni account con un accesso; `allunga_calendario()` la chiama solo chi lavora; `materializza_sessioni`, `pulisci_presenze`, `imposta_pin`, `chiudi_ricorrenza` e `salva_date_corsi` non lasciano più passare una chiamata dall'API senza accesso (passano la segreteria e il database stesso, per un job o il SQL Editor). Cambia il controllo dentro le funzioni, non le firme
58. `58-sito-immagini.sql` — le immagini del sito, in un contenitore pubblico «sito» (JPEG, PNG e WebP fino a 1 MB, nome uuid): le vede chiunque dall'indirizzo pubblico, ma le elenca, carica e cancella solo la segreteria
59. `59-contabilita.sql` — la contabilità di base, solo per chi ha il ruolo di amministrazione: le voci (di entrata o di uscita, due di sistema per gli incassi degli iscritti), le due casse (Cassa Contanti e Conto Corrente, col saldo iniziale e il giorno da cui si contano i movimenti) e i movimenti scritti a mano, con il giroconto fra le casse. Gli incassi degli iscritti non si ricopiano: restano in `ricevute` e `pagamenti_diretti`. Un movimento non si modifica: si annulla. Si scrive solo dalle funzioni, senza grant sulle tabelle
60. `60-chiusura-cassa.sql` — la chiusura di cassa, solo per l'amministrazione: a fine settimana si conta la Cassa Contanti e si confronta con quel che c'è «secondo i conti» (saldo iniziale, movimenti e contanti incassati dagli iscritti). Se non tornano, la differenza si scrive da sola come movimento «Differenza di cassa» (due voci di sistema nuove), e da quel giorno indietro non si scrive né si annulla più niente: si fa una rettifica di oggi, o si annulla la chiusura (solo l'ultima). Ridefinisce con `create or replace` le funzioni del 59 che ora sanno dei giorni chiusi (`registra_movimento`, `registra_giroconto`, `annulla_movimento`, `imposta_saldo_cassa`). Si scrive solo dalle funzioni `chiudi_cassa` e `annulla_chiusura_cassa`, senza grant sulla tabella `chiusure_cassa`.
61. `61-tessere.sql` — le tessere di chi è tesserato (ente, tipo, numero, valida dal / fino al, dal RASD o scritte a mano), che vede e cambia solo la segreteria; `corsi.ente_tessera` dice quale tessera chiede un corso (la prima volta lo scrive da sé per Judo, Lotta, Aikido, MGA, Avviamento → FIJLKAM e la sala Pesi → FIPE, poi non lo tocca più); `importa_tessere()` legge il foglio del RASD agganciando per codice fiscale E stesso nome, senza creare persone e senza doppioni, con l'anteprima; chi è iscritto senza tessera valida, e chi è tesserato senza corso, lo conta l'app dalle iscrizioni e dalle tessere; un trigger fa passare le tessere con `unisci_persone` anche quando la stessa è su tutte e due le schede
62. `62-sito-pezzi.sql` — le pagine del sito composte a pezzi (foto in cima, testi, foto, colonne): la struttura si conserva in `sito_pagine.bozza_pezzi` per riaprirla uguale, accanto alla bozza in testo piatto che ne esce; la scrive solo la segreteria (creando la pagina o con `salva_bozza_pezzi_sito`, con la stessa versione e gli stessi errori di `salva_bozza_sito`, che non la tocca); il sito pubblico non la vede mai. `bozza_pezzi` vuota = pagina col vecchio editor di testo
63. `63-importa-prima-nota.sql` — l'import dello storico dei movimenti dal vecchio programma, solo per l'amministrazione: la colonna `movimenti.origine_import` (la chiave di ogni riga, unica solo dove c'è) e la funzione `importa_prima_nota(dati jsonb)`, che carica fino a mille movimenti per volta con le voci di sistema degli incassi e «Da classificare», senza `creato_da`. Rilanciare lo stesso file non duplica niente, una riga sbagliata ferma tutto il pacchetto e un giorno già chiuso della Cassa Contanti non si tocca. I dati si preparano con `scripts/importa-prima-nota.mjs` (fuori dal repository: hanno nomi di iscritti). Per l'import basta `63-importa-prima-nota.sql` (dopo `60-chiusura-cassa.sql`), che non chiede di rilanciare `06-iscrizioni.sql`.
65. `65-elimina-presenza-rifiutata.sql` — la presenza di un istruttore rifiutata si può eliminare: la funzione `elimina_presenza_istruttore(presenza)`, solo per la segreteria e solo se la presenza è rifiutata (una confermata o da confermare si rifiuta prima). Se l'istruttore rimette il PIN dopo, la presenza si segna da capo
66. `66-elimina-segreteria.sql` — si elimina anche chi è solo di segreteria, se nessuna riga dei registri (ricevute, pagamenti, cassa, tessere, sito, segnalazioni…) lo nomina come autore: `elimina_istruttore()` guarda tutti i riferimenti a `persone` `on delete set null` dal catalogo. Chi ha storia, e chi è solo di amministrazione, resta com'è: gli si toglie l'accesso. La funzione ora è `security definer`, con il permesso controllato per primo. Si lancia dopo `55-amministrazione.sql`.
67. `67-cambia-voce.sql` — si cambia la voce di un movimento, anche dello storico importato, uno alla volta o fino a 500 insieme: la funzione `cambia_voce_movimenti(ids, voce)`, solo per l'amministrazione. Cambia solo la voce (importi, date, casse e testi restano, quindi anche i giorni chiusi): tutti o nessuno, mai un annullato, un giroconto o la «Differenza di cassa» di una chiusura, e la voce di arrivo è in uso e del tipo dei movimenti. Ogni cambio lascia chi, quando, la voce di prima e quella di dopo nella tabella `cambi_voce` (la legge solo l'amministrazione). Si lancia dopo `59-contabilita.sql` e `60-chiusura-cassa.sql`
68. `68-sito-orario.sql` — l'orario delle pagine del sito viene da CORSI: ogni pagina si collega a uno o più corsi (`sito_pagine.corsi_collegati`, in ordine di scelta) e il sito generato ne scrive le righe d'orario dalle ricorrenze (`orari_aperti()`), non dal testo a mano; senza orari, «Orario in arrivo». Il collegamento lo scrive solo la segreteria con `salva_corsi_sito` (senza doppioni, un corso che non c'è si rifiuta, non tocca versione né bozza); `sito_pagine_pubbliche()` dice anche i corsi collegati, delle sole pagine pubblicate. Si lancia dopo `56-sito.sql` e `48-orari-aperti.sql`.
69. `69-orari-sito.sql` — gli orari dei corsi per la pagina «Orari» del sito (corso, giorno, ora, durata e quando l'orario è cambiato), da `orari_sito()`, per chi non ha un accesso; la data la scrive un trigger su `ricorrenze.modificata_il` a ogni inserimento e modifica; le tabelle restano chiuse. Si lancia dopo `06-iscrizioni.sql`.
70. `70-movimenti-persona.sql` — ogni movimento dello storico importato può avere una persona collegata (`movimenti.persona_id`), come etichetta: non cambia importi, date, casse, voci né chiusure. Il riepilogo, lo stato di ogni movimento (`esiti_collegamenti_persona()`: sicuro, omonimi, nessuna scheda) e il blocco automatico dei casi sicuri (nome e cognome della causale uguali a quelli di una sola scheda), a pacchetti da 500 con il lotto, TOGLI QUESTO LOTTO, il collegamento e lo scollegamento a mano e le persone con quel nome per scegliere un omonimo: `riepilogo_collegamenti_persona()`, `collega_sicuri_persona(lotto, quanti)`, `collega_movimenti_persona(ids, persona)`, `scollega_movimenti_persona(ids)`, `togli_lotto_collegamenti(lotto)`, `candidati_persona_movimento(movimento)`, solo per l'amministrazione, con la traccia `collegamenti_persona` (chi, quando, la persona di prima e di dopo, il lotto, anche col loro nome se la scheda sparisce). Lo storico di una persona per la sua scheda: `storico_persona(persona)`, per segreteria e amministrazione. Il nome si confronta senza maiuscole, accenti, spazi doppi e ordine delle parole, e l'apostrofo in fondo a una parola dopo una vocale vale accento (il vecchio programma scrive «NICOLO'» per «Nicolò»); a ogni lancio rifà l'indice `persone_nome_token`. Si lancia dopo `59-contabilita.sql`, `63-importa-prima-nota.sql` e `67-cambia-voce.sql`.
71. `71-pagato-vecchio-programma.sql` — la lettura per il filtro «Pagato nel vecchio programma» dell'elenco ISCRITTI: gli incassi dello storico importato nella stagione di oggi (1 agosto – 31 luglio: agosto è già della stagione che inizia) su «Quota associativa» e «Corsi e altri pagamenti», con la persona a cui sono collegati (vuota se non lo sono ancora): `incassi_vecchio_programma()`, sola lettura, solo per la segreteria (ruolo `staff`). Non scrive niente: lo storico non diventa un incasso. Si lancia dopo `70-movimenti-persona.sql`.
72. `72-movimenti-dalla-chat.sql` — i movimenti registrati da Claude col server MCP (vedi «Claude e la contabilità»): le colonne `movimenti.chiave_chat` (la chiave che Claude manda con ogni registrazione, unica dove c'è: riprovare non scrive due volte) e `movimenti.dalla_chat` (il segno «Dalla chat» nel movimento aperto), `registra_movimento_dalla_chat(dati)`, con le regole di `registra_movimento` e niente incassi degli iscritti, e `movimenti_simili(testo)`, al più cinque uscite non annullate con quel testo nella descrizione, senza persone collegate, nomi «Cliente … per», voci di sistema né autori. Una chiave già usata vale solo per chi l'ha scritta, con gli stessi dati, e non supera i 100 caratteri. Solo per l'amministrazione. Si lancia dopo `60-chiusura-cassa.sql` e `70-movimenti-persona.sql`.
73. `73-satispay.sql` — il pagamento con Satispay dal modulo di iscrizione (vedi «Satispay nel modulo di iscrizione»): la tabella `pagamenti_satispay` (un pagamento vivo per richiesta, il nome e la scheda che restano se la richiesta si cancella), `importo_iscrizione` (quota e corso dal listino, solo un corso con una riga di prezzo), le funzioni che usa la Edge Function `satispay` (`satispay_prepara`, `satispay_stato`, `satispay_creato`, `satispay_esito`, solo `service_role`) ed `emetti_ricevuta_satispay`, la ricevuta col pagamento dentro una volta sola. Legge la segreteria e l'amministrazione; non scrive nessuno direttamente. Si lancia dopo `55-amministrazione.sql`.
74. `74-provenienza-richieste.sql` — da dove arrivano le richieste di iscrizione: le colonne `richieste_iscrizione.provenienza` (l'etichetta del link, `?da=`: minuscole, cifre e trattini, al più 90 caratteri) e `richieste_iscrizione.conosciuto` (una delle otto risposte a «Come ci hai conosciuto?»), con i loro vincoli; `invia_iscrizione` rifatta con le regole di `06-iscrizioni.sql` e in più le due chiavi, pulite (`pulisci_provenienza`, `pulisci_conosciuto`: spazi ai lati via, minuscolo) o scartate senza fermare la richiesta; la tabella `richieste_contate` (giorno, etichetta, risposta, corsi e stato, nessun dato personale), scritta solo dal trigger della richiesta, letta solo dalla segreteria (ruolo `staff`), da cui una richiesta eliminata da nuova (lo spam) si toglie, mentre una accolta o rifiutata eliminata resta (`on delete set null`); `richieste_da_dove(da, a)`, le righe del periodo raggruppate, per il riquadro di STATISTICHE, solo per la segreteria. Si lancia dopo `06-iscrizioni.sql` e `49-richieste-per-email.sql`; rilanciando `06` va rilanciato anche questo.
75. `75-chat-segreteria.sql` — le letture per le domande della segreteria a Claude (vedi «Claude e la contabilità», «La segreteria dalla chat»): `chat_iscritti(sale)` (gli iscritti attivi con certificato, quota, quote delle ricevute senza anno né numero e corsi in corso oggi), `chat_registro(dal, al, sale)` (una riga per lezione e iscritto con la sua presenza, giorni di Roma, mai dopo adesso) e `chat_prove(dal, al)` (quante prove per lezione, mai chi). Nome e cognome solo degli adulti di oggi, mai la data di nascita (dei minori sotto i 6 anni solo il giorno in cui li compiono); dei minori, e di chi non ha la data di nascita, niente nome e una chiave che vale per una sola domanda (`md5` dell'id col «sale» che il server sceglie a caso). Mai telefono, email, codice fiscale, note o file. Solo la segreteria (`e_staff()`), nessuna scrittura. Si lancia dopo `27-pagamento-dalle-ricevute.sql`.
76. `76-ricevute-email.sql` — la ricevuta per email (vedi «La ricevuta per email»): la tabella `invii_ricevute` (una riga per tentativo, «mandata» o «non partita» col motivo corto e l'indirizzo a cui è partita, mai cambiata né cancellata, letta solo dalla segreteria `e_staff()`), la colonna `impostazioni.ricevute_email_dal` (da quando si mandano: le ricevute di prima si mandano solo a mano), `indirizzo_ricevuta(ricevuta)` (l'email di contatto della persona della ricevuta, mai quella di accesso; solo `service_role`, cioè la Edge Function), `controlla_invio_ricevuta(ricevuta)` (i dati per la mail, se l'indirizzo c'è, le mail «mandate» oggi a Roma e se sono già 400, chi preme; mai l'indirizzo; la stessa ricevuta al più 3 volte in 24 ore), `registra_invio_ricevuta(ricevuta, esito, motivo, da, indirizzo, pdf_sha256)` (solo `service_role`: la Edge Function, dopo aver provato a mandare, con l'impronta del PDF allegato) ed `esiti_invio_ricevuta(ricevuta)` (data ed esito, senza indirizzo, per l'amministrazione). Mandano segreteria e amministrazione; le annullate no. Si lancia dopo `44-email-contatto.sql` e `55-amministrazione.sql`.
77. `77-claude-dalla-porta.sql` — Claude passa solo dalla sua porta: i token che Claude riceve collegandosi (OAuth Server, claim `client_id`) raggiungono solo le funzioni del server MCP. `controlla_richiesta()`, che PostgREST chiama prima di ogni richiesta (`pgrst.db_pre_request` sul ruolo `authenticator`), lascia passare a quei token solo le funzioni di `porta_di_claude()`, nessuna tabella (con l'«embedding» di PostgREST, `?select=*,persone(*)`, da una tabella si arriva alle altre); il resto è 42501. Le funzioni della porta rispondono con `returns table`, mai con righe di una tabella (anche lì PostgREST farebbe l'embedding). I file dello Storage sono chiusi a quei token (policy restrittiva `claude_fuori`). Le letture del server diventano funzioni: i conti della sola amministrazione (`chat_movimenti`, `chat_movimenti_uguali`, `chat_movimento_per_chiave`, `chat_ricevute`, `chat_pagamenti_diretti`), `chat_voci`, `chat_casse`, `chat_chiusure`, `chat_corsi`, e la registrazione `chat_registra`. I token dell'app non hanno `client_id` e passano come prima. Le Edge Function `backup`, `invita`, `sito` e `conti-sito`, che lavorano con `service_role`, rifiutano da sé il token con `client_id`. Una funzione nuova del server MCP va aggiunta a `porta_di_claude()`. Dopo averlo lanciato si ripubblicano `mcp` e le quattro funzioni.
78. `78-tariffe-tecnici.sql` — i dati e le tariffe dei tecnici, per lettera d'incarico e compensi: in `anagrafiche` le sigle delle province di nascita e di residenza e l'IBAN (solo la segreteria, come il resto dell'anagrafica; il modulo di iscrizione non li chiede), e la tabella `tariffe_istruttori` (centesimi l'ora per persona e corso, fra 1 e 100.000, se ne va col corso o con la persona; la legge e la scrive solo la segreteria `e_staff()`). Si lancia dopo `18-anagrafiche.sql`.
79. `79-lettere-incarico.sql` — le lettere d'incarico dei tecnici: la tabella `lettere_incarico` (i dati del tecnico e le tariffe copiati dentro, come le ricevute; una sola valida per persona e stagione, le altre restano segnate `sostituita_il`; dopo si cambia solo `firmata`; un tecnico con lettere non si elimina) e `fai_lettera_incarico(...)`, l'unico modo di farla: sostituisce la valida della stagione e fa la nuova, solo per chi insegna e con almeno una tariffa. Solo la segreteria (`e_staff()`) legge, fa e spunta. Si lancia dopo `78-tariffe-tecnici.sql`.
80. `80-ricevute-compensi.sql` — le ricevute mensili dei compensi dei tecnici: la tabella `ricevute_compensi` (righe del conto, tecnico con IBAN e province e qualifica della lettera copiati dentro; il compenso cambiato a mano col `motivo`; una sola non annullata per persona e mese; dopo si cambia solo `firmata`; un tecnico con ricevute non si elimina), `fai_ricevuta_compenso(...)` (solo per chi insegna, mese non nel futuro, righe giuste e `calcolato` uguale alla loro somma) e `annulla_ricevuta_compenso(id)`. Solo la segreteria (`e_staff()`). Si lancia dopo `79-lettere-incarico.sql`.
81. `81-compensi-pagati.sql` — il compenso pagato finisce in CONTABILITÀ: la voce di sistema «Compensi istruttori» (uscita), le colonne `ricevute_compensi.movimento_id` e `pagata_il` (le scrive solo il pagamento), `paga_compensi(ricevute, data, cassa)` (solo chi ha segreteria e amministrazione; ricevute della stessa persona, non annullate, non pagate; data non futura, non prima del `dal` della cassa, non in un giorno chiuso; un movimento solo «Compenso · Nome Cognome · set, ott 2026» collegato al tecnico, mai CF né IBAN), `annulla_ricevuta_compenso` rifatta (una pagata non si annulla) e il trigger `compensi_tornano` (il movimento annullato rimette le sue ricevute da pagare). Si lancia dopo `80-ricevute-compensi.sql`; se si rilancia l'80, va rilanciato anche questo.
82. `82-manca-la-firma.sql` — chi era previsto a una lezione tenuta in due e non ha firmato: la colonna `corsi.basta_uno` (nei corsi dove gli istruttori si alternano basta uno, e agli altri non si chiede la firma; la scrive chi scrive i corsi) e `segna_istruttore_assente(sessione, persona)` («Non c'era» di COMPENSI: solo la segreteria, su una lezione non annullata e fra i previsti, una presenza rifiutata `come` = 'segreteria'; chi una presenza ce l'ha resta com'è). «C'era» è `segna_istruttore_previsto` del `46`. Si lancia dopo `46-istruttore-collega.sql`.
83. `83-satispay-prima.sql` — Satispay prima di mandare (vedi «Satispay nel modulo di iscrizione»): in `pagamenti_satispay` le colonne `corso_id`, `formula`, `nome`, `cognome`, `email` (un pagamento nasce senza richiesta, dal corso e dalla formula scelti) e `preso_il` (quando una richiesta l'ha preso: non si azzera, così un pagamento già usato non torna libero se la richiesta si cancella); `importo_corso(corso, formula, giorno)`, la regola di `importo_iscrizione` (che ora la riusa); `satispay_prepara_prima(corso, formula, nome, cognome, email)` (quello vivo per la stessa scelta e persona, anche già pagato e non ancora preso, o uno nuovo) e `satispay_stato_pagamento(id)`, solo `service_role`; `invia_iscrizione` rifatta con le regole di `74` e la chiave `pagamento_satispay`, che prende il pagamento solo se è arrivato, mai preso, per il suo corso e la sua formula e pagato da chi si iscrive (nome, cognome, email); lo stesso invio rimandato dopo una risposta persa ritrova la sua richiesta. Si lancia dopo `73-satispay.sql` e `74-provenienza-richieste.sql`; rilanciando `06` o `74` va rilanciato anche questo.
84. `84-avvisi-segreteria.sql` — gli avvisi alla segreteria (vedi «Gli avvisi alla segreteria»): la colonna `richieste_iscrizione.invio` (le richieste mandate insieme dallo stesso modulo, una famiglia), la tabella `avvisi_indirizzi` (a chi va l'avviso e in copia a chi, solo email giuste, e `dal`: quel che è arrivato prima non avvisa mai; la legge e la cambia solo la segreteria `e_staff()`), il registro `avvisi_segreteria` (un avviso per `chiave`, solo i riferimenti, mai note, codice fiscale, nascita o file; nessuno lo legge da fuori), `avvisi_da_mandare()`, `avviso_preso(id)` e `avviso_mandato(id)` (solo `service_role`, la Edge Function: una richiesta o una famiglia cinque minuti dopo l'ultima arrivata, chi della famiglia arriva dopo con un avviso suo, un pagamento Satispay arrivato dopo l'avviso della sua richiesta, uno senza richiesta dopo un'ora; «fuori età» coi sei mesi di tolleranza dell'app; ogni avviso preso prima di mandarlo, così due chiamate insieme non mandano due mail; al più 50 al giorno di Roma, gli altri segnati `tetto`; dodici volte rifiutato dalla posta, `guasto`; senza più niente da dire, `vuoto`); il trigger `avvisi_riaccesi` (messo l'indirizzo dove non c'era, `dal` riparte: niente arretrati), `avvisi_non_mandati_oggi()` (solo la segreteria) e `invia_iscrizione` rifatta con le regole di `83` e la chiave `invio`; con pg_cron e pg_net, la chiamata alla Edge Function `avvisi-segreteria` ogni cinque minuti. Si lancia dopo `83-satispay-prima.sql`; rilanciando `06`, `74` o `83` va rilanciato anche questo.
85. `85-solleciti.sql` — i solleciti su WhatsApp dalla scheda di una persona: la tabella `solleciti` (una riga per tasto premuto: persona, quando, chi; mai il testo, che passa da WhatsApp; nessuno la legge o la scrive da fuori), `segna_sollecito(persona)` (solo la segreteria `e_staff()`, su una persona attiva; chi preme è `persona_corrente()`) e `ultimo_sollecito(persona)` (solo la segreteria: l'ultimo, col nome di chi l'ha segnato). Il messaggio lo apre l'app in WhatsApp, il database non manda niente. Si lancia dopo `02-policy.sql`.
86. `86-ricevuta-una-volta.sql` — una ricevuta fatta una volta sola: la colonna `ricevute.chiave` (unica anche fra le annullate; la manda il modulo FAI LA RICEVUTA, una per modulo aperto), `chiave_ricevuta(dati)` e `ricevuta_gia_fatta(chiave, persona)` (nessuno le chiama da fuori), `emetti_ricevuta` ed `emetti_ricevuta_satispay` rifatte: con una chiave già usata danno la ricevuta fatta invece di un'altra (se la rete ha perso la risposta e si ripreme), la rifiutano se è di un'altra persona, annullata, o senza il pagamento Satispay; senza chiave, come prima. Si lancia dopo `55-amministrazione.sql` e `73-satispay.sql`; rilanciando uno dei due va rilanciato anche questo.
87. `87-solleciti-elenco.sql` — i solleciti nell'elenco ISCRITTI: `ultimi_solleciti()` (per ogni persona l'ultimo sollecito, col nome di chi l'ha segnato, in un colpo) e `togli_sollecito(persona)` («Annulla»: toglie l'ultimo solo se l'ha segnato chi è collegato negli ultimi 15 minuti). Solo la segreteria (`e_staff()`); la tabella resta chiusa. Si lancia dopo `85-solleciti.sql`.
88. `88-pagamento-una-volta.sql` — un pagamento a mano registrato una volta sola: `registra_pagamento_diretto` rifatta rifiuta il pagamento con la `chiave` di una ricevuta non annullata della stessa persona (il modulo ripreso dopo «Fai anche la ricevuta» e la rete caduta, con la ricevuta già fatta) e quello con Satispay quando dal modulo è arrivato un Satispay non ancora in una ricevuta valida. Si lancia dopo `64-pagamenti-non-nel-futuro.sql`, `73-satispay.sql` e `86-ricevuta-una-volta.sql`; rilanciando `64` va rilanciato anche questo.
89. `89-pagamento-diventa-ricevuta.sql` — il pagamento a mano diventa ricevuta (FANNE LA RICEVUTA nello storico della scheda): la colonna `pagamenti_diretti.ricevuta_id` (la ricevuta in cui è finito), `emetti_ricevuta_da_pagamento(dati, pagamento)` (la ricevuta e l'annullo del pagamento a mano nella stessa transazione; i pagamenti con lo stesso modo e la stessa data fanno esattamente il suo importo, così la cassa non si muove; con la chiave della `86`, ripetuta dà la stessa ricevuta) e `annulla_ricevuta` rifatta (il pagamento a mano che era diventato quella ricevuta torna SENZA RICEVUTA). Si lancia dopo `55-amministrazione.sql` e `86-ricevuta-una-volta.sql`; rilanciando `55` va rilanciato anche questo.
90. `90-omonimi-codice-fiscale.sql` — due persone con lo stesso nome non finiscono sulla stessa scheda: accogliendo una richiesta, la ricerca per nome salta le schede che hanno già un codice fiscale (da una richiesta accolta o dai dati anagrafici) diverso da quello della richiesta, anche se sono senza email o hanno la stessa email o lo stesso telefono; nasce una scheda nuova, e la segreteria che sa che è la stessa persona la sceglie a mano. `accogli_iscrizione()` cambia dentro, non nella firma. Si lancia dopo `18-anagrafiche.sql` e `53-codice-fiscale-stesso-nome.sql`; rilanciando `06`, `44`, `45` o `53` va rilanciato anche questo.
91. `91-richieste-accolte-restano.sql` — una richiesta accolta non si elimina finché c'è la sua scheda: tiene nascita, codice fiscale, residenza e genitore (la policy `richieste_cancella`, e niente `update` a mano sulla riga, come in `06-iscrizioni.sql`). Si lancia dopo `06`.
92. `92-ricevuta-cassa-chiusa.sql` — i contanti di un giorno di cassa chiusa non entrano dalla ricevuta: `emetti_ricevuta` (corpo in `fai_ricevuta`, interna) rifiuta un pagamento in contanti con la data di un giorno in cui la Cassa Contanti è chiusa, come già il pagamento a mano; `emetti_ricevuta_da_pagamento` lascia passare solo i contanti del suo pagamento a mano, già contati; `cassa_contanti_chiusa_fino()` dice a segreteria e amministrazione solo la data dell'ultima chiusura, per l'avviso quando si annulla. Si lancia dopo `86-ricevuta-una-volta.sql` e `89-pagamento-diventa-ricevuta.sql`; rilanciando uno dei due va rilanciato anche questo.
93. `93-ricevuta-data-numero.sql` — la ricevuta non si fa nel futuro: `fai_ricevuta` rifiuta la data dopo oggi (il giorno di Roma) o fuori dal 2000–2100, un pagamento dentro una voce dopo oggi o prima del 2000, il numero a mano se l'anno ha già ricevute (serve solo a continuare un altro programma, in un anno senza ricevute) o fuori da 1–999999, e la nota oltre 500 caratteri. Si lancia dopo `92-ricevuta-cassa-chiusa.sql`; rilanciando la 92 va rilanciato anche questo.
94. `94-disattiva-chiude-iscrizioni.sql` — disattivare una scheda chiude oggi le sue iscrizioni aperte (il trigger `persone_iscrizioni_disattivata`; una che comincia più avanti finisce il giorno in cui comincia), e riattivarla non le riapre: riattivata a mano o accogliendo una richiesta, torna solo nei corsi chiesti. Una volta sola chiude quelle ancora aperte di chi è già disattivato. Si lancia dopo `06`.
95. `95-certificato-piu-lontano.sql` — accogliendo una richiesta col certificato vince quello che scade dopo: la data letta dalla segreteria viaggia con l'accoglimento (`accogli_iscrizione(richiesta, persona, scade)`), e se il certificato nuovo scade dopo quello valido della scheda, o la scheda non ne ha uno valido, file e data nuovi prendono il posto dei vecchi; se no la scheda resta com'era e il file resta nella richiesta. Toglie la firma vecchia `accogli_iscrizione(uuid, uuid)`. Si lancia dopo `90`; rilanciando `06`, `44`, `45`, `53` o `90` va rilanciato anche questo.
96. `96-compensi-extra.sql` — la ricevuta di compenso extra (uno stage, un torneo), separata da quella del mese: colonna `ricevute_compensi.extra` (per che cosa, 3–200 caratteri; null per la ricevuta del mese), nessuna riga corso, l'importo scritto dalla segreteria. Più extra per tecnico e mese; la ricevuta del mese resta una sola (`ricevute_compensi_valida` guarda solo quelle). `fai_ricevuta_compenso_extra` prende tecnico e qualifica dal server, `modifica_ricevuta_compenso_extra` cambia descrizione e importo finché non è pagata; `paga_compensi` aggiunge il testo delle extra alla descrizione del movimento. Si lancia dopo `81`; rilanciando `80` o `81` va rilanciato anche questo.
97. `97-satispay-scarico.sql` — i pagamenti Satispay del negozio entrano da soli in CONTABILITÀ: la cassa «Satispay» (dal 2026-10-01; prima i pagamenti vanno nel Conto Corrente), le voci «Da classificare» e «Commissioni bancarie», il segno `movimenti.satispay_id` (uno per pagamento, anche annullato), le tabelle `satispay_negozio` (i pagamenti letti) e `satispay_scarico` (lo stato, una riga), che legge solo l'amministrazione. La Edge Function `satispay-scarico` salva i pagamenti (`satispay_negozio_salva`) e `satispay_negozio_applica` li scrive: quelli del modulo restano fuori, uno uguale scritto a mano prende il segno, due uguali o un giorno chiuso diventano «da decidere» (`satispay_decidi`, dall'amministrazione). Finito uno scarico vero, `satispay_scarico_avvisa` mette un avviso alla segreteria (tipo `satispay_scarico` di `84`) se ha scritto movimenti, lasciato pagamenti da decidere o non è riuscito. pg_cron la chiama ogni notte, dopo il primo scarico confermato. Si lancia dopo `59`, `60`, `63`, `73`, `84` e `92`.
98. `98-quote-persona.sql` — un'entrata scritta a mano in CONTABILITÀ (Nuovo movimento, Satispay, la chat) su «Quota associativa» o «Corsi e altri pagamenti» ha la sua persona, obbligatoria: `registra_movimento` la chiede (`persona_id`), `cambia_voce_movimenti(ids, voce, persona)` sposta una riga a mano su quelle voci una alla volta e con la persona, `collegamento_perche` lascia collegare, cambiare e scollegare anche le righe a mano, `storico_persona` dice quali sono scritte a mano (`a_mano`) e la scheda le mette fra i pagamenti, mai sommate. La persona è un'etichetta: la quota non conta come pagata, importi, saldi e chiusure non cambiano. Lo storico del vecchio programma resta com'era. Ogni collegamento lascia la traccia in `collegamenti_persona`. Solo per l'amministrazione (lo storico anche la segreteria). Si lancia dopo `60`, `67` e `70`.
99. `99-email-unica.sql` — una sola email per persona (`persone.email`): per entrare nell'app, per le ricevute e per gli avvisi. L'unicità vale solo per chi ha un accesso (istruttore, segreteria, amministrazione), gli iscritti possono dividerla (un genitore e i figli); l'email di contatto passa nel campo unico senza perdere niente (la colonna `email_contatto` resta, non più usata); rifà `accogli_iscrizione`, `unisci_persone` e `indirizzo_ricevuta`.
100. `100-nucleo.sql` — il nucleo familiare sul database: la colonna `persone.nucleo` (l'id del titolare; al massimo due livelli, nessun ciclo, titolare maggiorenne, un titolare con altri dentro non si disattiva) con le regole in un trigger, quindi valide anche per una scrittura diretta; le funzioni `metti_nel_nucleo`, `togli_dal_nucleo` e `rendi_titolare` (solo segreteria) e `richieste_iscrizione.nucleo_di`, che `accogli_iscrizione` usa per far entrare nel nucleo chi si iscrive (solo una scheda nuova, e solo se il modulo l'ha mandato l'iscritto stesso con l'accesso fatto). `unione_possibile` (quindi UNISCI e la sua anteprima) rifiuta chi è titolare o in un nucleo. Rifà `unione_possibile` (da `45`), `accogli_iscrizione` (da `95`) e `invia_iscrizione` (da `84`): rilanciando uno di quei file, va rilanciato anche questo. Senza questo file l'app mostra l'elenco senza nuclei e i tasti dicono che va lanciato `100-nucleo.sql`. Si lancia dopo `98`.
101. `101-iscritto.sql` — l'area degli iscritti sul database: chi frequenta può avere un account e leggere solo le sue cose (corsi, lezioni, presenze, certificato, quota, ricevute) e, se è titolare di un nucleo (vedi `100`), quelle del suo nucleo, con le funzioni `iscritto_scheda`, `iscritto_lezioni`, `iscritto_presenze`, `iscritto_ricevute`, `iscritto_nucleo`, `iscritto_titolare`, `iscritto_aggiunte`, `iscritto_dati_del_nucleo`, `iscritto_segnala` e `iscritto_segnalate` (security definer, solo `authenticated`; il file del certificato e le note della segreteria non escono mai). Un iscritto con l'account non è personale: le tabelle restano chiuse e le funzioni sono l'unica strada. Rifà `collega_utente` (da `55`): lega l'account anche a un iscritto con la stessa email confermata, ma solo senza dubbi (unico con quell'indirizzo, o titolare di tutti gli altri che lo dividono); rilanciando il `55` va rilanciato anche questo. Aggiunge la tabella `presenze_segnalate` (le legge la segreteria; l'iscritto scrive solo con `iscritto_segnala`). Prova: `prova/iscritto.sql`. Si lancia dopo `100-nucleo.sql`.
102. `102-certificato-iscritto.sql` — l'iscritto manda il suo certificato medico dall'area iscritti (per sé, o il titolare per chi sta nel nucleo senza account): il file va in `certificati/<persona>/attesa-<n>.(pdf|jpg|png)` e resta «in attesa» (colonne `certificato_in_attesa` e `certificato_in_attesa_il` della scheda) finché la segreteria non lo conferma con la scadenza (`conferma_certificato_iscritto`, diventa il certificato della scheda) o lo rifiuta (`rifiuta_certificato_iscritto`, si cancella). `iscritto_manda_certificato` è l'unica scrittura dell'iscritto; dalla scheda esce solo la data di invio, mai il nome del file. Rifà `iscritto_scheda_di`, `iscritto_scheda` e `iscritto_nucleo` (da `101`), `pulisci_certificati` e `certificato_alla_disattivazione` (da `45`) e avvolge `unisci_persone` (da `99`): rilanciando uno di quei file va rilanciato anche questo. Senza questo file l'area iscritti non mostra il tasto e dice di portare il certificato in segreteria. Prova: `prova/certificato-iscritto.sql`. Si lancia dopo `101-iscritto.sql`.
103. `103-saldo-satispay.sql` — il saldo della quota con Satispay dall'area degli iscritti: chi ha pagato in parte la quota associativa paga il resto dal telefono (o il titolare per un familiare senza account), con l'importo che calcola il database dalla ricevuta (`satispay_prepara_saldo`, `satispay_saldo_stato`). Dopo `101` e `73`, non chiede di rilanciare `06`; finché non c'è, l'app non mostra PAGA.
104. `104-importa-banca.sql` — «Importa dalla banca» in CONTABILITÀ → MOVIMENTI: i movimenti del CSV di BancoPosta si scrivono con `importa_prima_nota` (chiave `banca:…`, Conto Corrente, «Da classificare»); `annulla_importazione_banca(creato)` annulla in un colpo i movimenti della banca scritti in quel momento (un'importazione), non quelli a mano né lo storico. Solo l'amministrazione. Si lancia dopo `59` e `63`.
105. `105-paga-quota-satispay.sql` — la quota associativa intera con Satispay dall'area degli iscritti (per chi non ce l'ha o ce l'ha scaduta; il resto di una quota in parte resta il saldo, 103): la colonna `pagamenti_satispay.voce` (`'quota'`) con l'indice unico di una quota in attesa per persona, `quota_importo` (la quota del listino, centesimi; mai dal telefono) e le funzioni per chi ha un account (`authenticated`, ciascuna controlla `iscritto_puo_vedere`): `satispay_prepara_quota`, `satispay_quota_stato`, `satispay_quota_chi`. Dopo averlo lanciato si ripubblica la Edge Function `satispay`. Si lancia dopo `103-saldo-satispay.sql`.
106. `106-paga-corso-satispay.sql` — un corso semplice (una sola riga di prezzo nel listino) pagato con Satispay dall'area degli iscritti: la colonna `pagamenti_satispay.voce` ammette anche `'corso'` (con l'indice unico di un corso in attesa per persona e corso), `corso_importo` (annuale o trimestre dal listino, centesimi, mai dal telefono; 22023 con il testo per chi paga se il corso ha più righe o non si paga), e per chi ha un account (`authenticated`, ciascuna controlla `iscritto_puo_vedere`) `satispay_prepara_corso`, `satispay_corso_stato`, `satispay_corsi_chi` (cosa si può pagare e cosa è già pagato, per la scheda). Dopo averlo lanciato si ripubblica la Edge Function `satispay`. Si lancia dopo `105-paga-quota-satispay.sql`.
107. `107-sito-accessibilita.sql` — la Dichiarazione di accessibilità del sito, quarta pagina di legge (slug `dichiarazione-accessibilita`, riservato: il vincolo `slug` lo concede solo a una pagina di legge). Nasce come bozza mai pubblicata, con un testo-traccia a segnaposto `[DA COMPILARE …]`, e la voce «Accessibilità» in coda al footer; finché la segreteria non preme PUBBLICA non compare sul sito. Una pagina normale con quello slug diventa di legge senza perdere il testo. Rifà `salva_menu_sito` (da `56`): una pagina di legge può stare nel footer anche mai pubblicata, le altre no; rilanciando il `56` va rilanciato anche questo. Senza questo file la pagina non compare nell'editor del sito. Prova: `prova/sito.sql`. Si lancia dopo `106-paga-corso-satispay.sql`.
109. `109-privilegi-e-certificati.sql` — toglie `TRUNCATE`, `TRIGGER` e `REFERENCES` ad `anon` e `authenticated` su tutte le tabelle di `public` e su quelle future (TRUNCATE non passa dalla RLS: da una connessione SQL col ruolo `authenticated` svuotava una tabella), e mette un tetto di 3 file in attesa per persona in `certificati/<persona>/attesa-N.*` con un trigger su `storage.objects` (come `limita_file_allegati`, 32): prima un iscritto ne caricava senza limite. Select, insert, update e delete restano come prima. Prova: `prova/109-privilegi-e-certificati.sql`. Si lancia dopo `108-compleanni.sql`; non chiede di rilanciare `06-iscrizioni.sql`.
110. `110-tetto-certificato-messaggio.sql` — il tetto dei 3 file in attesa (109) scatta con `54000` invece di 42501, che Storage trasformava in «new row violates row-level security policy» perdendo il testo; e conta solo per chi la policy `certificati_iscritto_carica` lascerebbe caricare, così chi non è titolare di una cartella piena riceve l'errore della policy, come per una cartella vuota. Prova: `prova/110-tetto-certificato-messaggio.sql`. Si lancia dopo `109-privilegi-e-certificati.sql`.
111. `111-iscrizione-troppo-grande.sql` — `invia_iscrizione` (la chiama anche chi non ha un accesso) rifiuta subito una richiesta oltre i 64 kB (una vera ne fa meno di 10) con 22023 e «La richiesta è troppo grande: ricarica la pagina e rifalla», prima di leggere altro, come `invia_ordine_vestiario` (47): prima una chiave sconosciuta da 5 MB veniva letta e poi scartata. Il resto è la funzione di `100`: rilanciando `100`, `06`, `74`, `83` o `84` va rilanciato anche questo. Prova: `prova/111-iscrizione-troppo-grande.sql`. Si lancia dopo `109-privilegi-e-certificati.sql`; non chiede di rilanciare `06-iscrizioni.sql`.
112. `112-sito-accessibilita-agid.sql` — la traccia della Dichiarazione di accessibilità (107) ha anche le parti del modello AgID che mancavano: la norma EN 301 549, la data di redazione, il tempo di risposta alle segnalazioni e come rivolgersi all'AgID se la risposta non basta. Riscrive la bozza solo se la pagina non è mai stata pubblicata e il testo è ancora la traccia di 107: una bozza che la segreteria ha cominciato a compilare, o una pagina già pubblicata, resta com'è. La versione sale di uno. Prova: `prova/sito.sql` (sezione 20). Si lancia dopo `107-sito-accessibilita.sql`; non chiede di rilanciare `06-iscrizioni.sql`; finché non lo lanci, la bozza resta con la traccia di prima.
113. `113-genitore-non-iscritto.sql` — il genitore non iscritto, titolare del nucleo dei figli minorenni: la colonna `persone.genitore_non_iscritto` e `aggiungi_genitore(figlio, nome, cognome, codice_fiscale)` (solo la segreteria), che crea la persona col segno e il codice fiscale in `anagrafiche` e ci mette il figlio nel nucleo, con le regole di `nucleo_non_va`; senza un codice fiscale valido, o se è già di un'altra persona, non crea niente. Un trigger su `iscrizioni` toglie il segno a chi si iscrive a un corso. Prova: `prova/genitore-non-iscritto.sql`. Si lancia dopo `100-nucleo.sql`; non chiede di rilanciare `06-iscrizioni.sql`.
114. `114-importazioni.sql` — I CONTI → IMPORTAZIONI: i pagamenti Satispay da decidere si decidono a gruppi (`satispay_decidi_gruppo`, tutte le scelte o nessuna, un movimento a mano per un pagamento solo), «Non è questo» scollega un pagamento dal movimento a mano (`satispay_scollega`, non nei giorni chiusi), e lo stato non propone più i movimenti già presi o annullati. I movimenti della banca abbinati da soli a uno scritto a mano restano in `banca_coperti` (`banca_segna_coperti`), e `banca_non_e_questo` li fa entrare come un import normale. Solo l'amministrazione. Prova: `prova/importazioni.sql`. Si lancia dopo `97` e `104`; non chiede di rilanciare `06-iscrizioni.sql`.
115. `115-carta.sql` — la carta di credito o di debito (con Apple Pay e Google Pay) nel modulo di iscrizione, accanto a Satispay: incassa PayPal coi suoi campi carta ospitati, e nessun dato della carta passa dal database. In `pagamenti_satispay` le colonne `circuito` (`'satispay'` o `'carta'`) e `paypal_id` (l'ordine PayPal, unico); la cassa «Carta»; `carta_prepara_prima(dati)`, `carta_creato`, `carta_esito` e `carta_stato_pagamento`, solo `service_role` (le chiama la Edge Function `paypal`). Un pagamento con la carta in attesa da più di 30 minuti non si riprende: se ne fa uno nuovo. Rifà `satispay_prepara_prima` (ritrova solo i Satispay), `invia_iscrizione` (prende anche un pagamento con la carta, coi testi suoi), `emetti_ricevuta_satispay` (con la carta vuole il metodo «Carta») e `registra_pagamento_diretto` («Carta» a mano no, finché dal modulo ci sono soldi con la carta non in una ricevuta). Prova: `prova/carta.sql`. Si lancia dopo `112-sito-accessibilita-agid.sql`; non chiede di rilanciare `06-iscrizioni.sql`; rilanciando `83`, `86`, `88`, `100` o `111` va rilanciato anche questo. Finché non c'è, la Edge Function `paypal` dice che la carta è spenta e il modulo offre solo Satispay e bonifico.
116. `116-satispay-separato.sql` — Satispay separato dal Conto Corrente: ogni pagamento Satispay, di qualunque data, entra nella cassa Satispay (che parte dal 1° gennaio 2025), e i «forse già scritti a mano» si cercano solo tra i movimenti di quella cassa (`satispay_negozio_applica`, `satispay_scollega`). Gli a_mano collegati a un movimento del Conto Corrente si scollegano e, coi da decidere che avevano un candidato fuori da Satispay, tornano senza esito per lo scarico dopo; gli scritti restano dove sono. Prova: `prova/116-satispay-separato.sql`. Si lancia dopo `114`; non chiede di rilanciare `06-iscrizioni.sql`.
117. `117-gare.sql` — le gare: `gare` (uno o più giorni), la quota a voci `gare_voci`, `gare_accompagnatori` e `gare_atleti`, col pagamento di ogni atleta e le voci di quel momento. Scrive solo la segreteria; l'istruttore legge le gare che accompagna e quelle dei suoi atleti, l'iscritto le sue e dei figli, solo la riga sua. `incassa_gara(atleta, metodo, data)` (solo la segreteria) incassa una volta sola il totale delle voci di adesso e registra il pagamento diretto con la voce «Gare», che il file aggiunge alle voci contabili. Una gara passata non si cancella; unendo due schede resta una riga per gara, quella pagata. Prova: `prova/gare.sql`. Si lancia dopo `88-pagamento-una-volta.sql`, `99-email-unica.sql` e `101-iscritto.sql`; non chiede di rilanciare `06-iscrizioni.sql`.
118. `118-chiusure.sql` — le chiusure della palestra: `chiusure` (dal, al, una sala o tutte, al massimo un anno) e `chiusure_lezioni`, con com'era ogni lezione annullata. `chiudi_palestra(dal, al, sala, solo_contare)` conta o annulla le lezioni non annullate del periodo (giorno italiano) e ricorda la chiusura; `togli_chiusura(id)` rimette solo quelle ancora annullate. Un trigger fa nascere annullate le lezioni dell'orario create dopo in un giorno chiuso; le straordinarie no. Legge, chiude e toglie solo la segreteria. Prova: `prova/chiusure.sql`. Si lancia dopo `117-gare.sql`; non chiede di rilanciare `06-iscrizioni.sql`.
119. `119-abbina-movimenti.sql` — i movimenti non identificati (banca e Satispay) propongono le persone con più giudizio, senza mostrare a chi amministra codici, genitori e date. `abbina_pagatori_movimento(movimento, corsi)` prova in ordine, fermandosi alla prima regola che trova qualcuno: nome e cognome interi nel testo; nome e cognome interi del genitore (i suoi figli); codice fiscale letto dalla causale (del genitore o di chi paga per sé); l'importo, cioè gli iscritti ai corsi che costano quella cifra col cognome proprio o del genitore nel testo. Chi ha già l'iscrizione in corso il giorno del movimento va in fondo, col segno; al massimo otto, solo persone attive. `abbina_testo_banca(testo, movimenti)` fa lo stesso per le righe «Da decidere» dell'importazione dalla banca. La tabella `movimenti_codici_letti` tiene il codice fiscale letto (max due) finché il movimento non è collegato a una persona, poi si cancella. Rifà `importa_prima_nota` (porta `codice_fiscale_letto`) e `collegamento_scrivi`. Solo l'amministrazione. Prova: `prova/abbina-movimenti.sql`. Si lancia dopo `114` e `63`; non chiede di rilanciare `06-iscrizioni.sql`; rilanciando `63` o `114` va rilanciato anche questo. Finché non c'è, l'app propone solo per nome, come prima.
121. `121-punteggio-movimenti.sql` — chi ha pagato un movimento non identificato si sceglie con un punteggio al posto delle regole in cascata di `119` e `120`: `abbina_pagatori_movimento` somma nome intero (4), codice fiscale letto (4), genitore intero (3), storico (3: un altro movimento con le stesse parole, senza le cifre, già collegato a quella persona), corso dell'importo col cognome (2), nome e corso (2) e cognome (1; da solo propone solo se nessuno ha di più), e rende in più `sicuro`, vero solo per il primo se ha almeno 4, almeno 2 più del secondo e non è già iscritto: l'app preseleziona solo lui, mai per «nome e corso». I corsi dell'importo li ricava dal listino: il parametro `corsi` non conta più. Il punteggio non esce. `parole_pagatori` toglie l'apostrofo dopo una vocale a fine parola, come l'app. `abbina_testo_banca` rende per ogni movimento il segno più forte, senza cascata. Solo l'amministrazione. Prova: `prova/abbina-movimenti.sql`. Si lancia dopo `120`; rilanciando `119` o `120` va rilanciato anche questo.
122. `122-avvisi-senza-quote.sql` — gli avvisi alla segreteria non scambiano più una quota o un corso pagati dal telefono (`105`, `106`) per un «pagamento senza richiesta»: `avvisi_da_mandare()` rifatta com'è in `84`, ma il ramo `pagamento_senza_richiesta` guarda solo i pagamenti senza `persona_id`, cioè quelli fatti in fondo al modulo. Prima, ogni quota pagata dall'area iscritti faceva partire un'ora dopo l'avviso «soldi da restituire o persona da chiamare». Prova: `prova/quota-satispay.sql`. Si lancia dopo `121`; rilanciando `84` va rilanciato anche questo.
123. `123-quadratura-banca.sql` — il saldo dell'estratto BancoPosta, mese per mese: `saldo_banca` (mese `AAAA-MM` una volta sola, saldo iniziale, entrate, uscite, saldo finale in centesimi, con iniziale + entrate − uscite = finale) e la verifica del mese (chi, quando e l'impronta dei movimenti, sempre insieme). Il confronto coi movimenti lo fa l'app. Legge e scrive solo l'amministrazione, anche col ruolo doppio, come movimenti e casse. Prova: `prova/quadratura-banca.sql`. Si lancia dopo `59-contabilita.sql`; non chiede di rilanciare `06-iscrizioni.sql`.

Si possono rilanciare tutti quante volte si vuole: non distruggono niente.
Rilanciarne uno dei primi cinque rimette i permessi di default alle sue
funzioni, quindi dopo va rilanciato anche `06-iscrizioni.sql`. Gli altri
chiudono da sé le funzioni che creano: Postgres le fa nascere eseguibili da
tutti, `anon` compreso, e `06` non può cambiarlo per quelle che verranno.

Su un database già in uso, dopo un aggiornamento dell'app si rilanciano i
file cambiati e poi `06-iscrizioni.sql`. Per certificati e pagamenti basta
lanciare `07-certificati-pagamenti.sql`: finché non c'è, l'elenco degli
iscritti si vede lo stesso, e salvare un certificato dice che manca. Per il
documento su carta si rilanciano `06-iscrizioni.sql` e
`07-certificati-pagamenti.sql`: dopo, il documento arriva col modulo e la
segreteria lo stampa e lo cancella. Perché il limite delle richieste di
iscrizione regga anche quando ne arrivano tante insieme si rilancia
`06-iscrizioni.sql`, e dopo `45-certificati-online.sql`: finché non c'è, il
modulo funziona come prima. Lo stesso rilancio tiene i file di una richiesta
dentro il limite anche quando si caricano tutti insieme: lo fa un trigger su
`storage.objects`, una tabella di Supabase, e se un suo aggiornamento lo
togliesse `controllo.sql` lo dice e si rilancia `06-iscrizioni.sql`. Per il certificato nell'app, al posto
della carta, basta `45-certificati-online.sql` (vedi «Il certificato medico
nell'app», più sotto). Per la sala dei singoli giorni
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
Per cambiare la voce dei movimenti basta `67-cambia-voce.sql` (dopo `59-contabilita.sql` e `60-chiusura-cassa.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione del `59`, del `60` o del `63`: finché non c'è, CAMBIA VOCE dice di lanciare questo file e il resto della contabilità funziona. Per eliminare anche la segreteria senza storia basta `66-elimina-segreteria.sql` (dopo `55-amministrazione.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, ELIMINA c'è già ma il database dice che si eliminano solo gli istruttori. Se si rilancia `55` va rilanciato anche il `66`. Per eliminare una presenza rifiutata basta `65-elimina-presenza-rifiutata.sql` (dopo `15-presenze-istruttori.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, ELIMINA dice di lanciare questo file e il resto di PRESENZE ISTRUTTORI funziona come prima. Per le pagine del sito a pezzi basta `62-sito-pezzi.sql` (dopo `56-sito.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, SITO apre tutte le pagine col vecchio editor di testo e dice che le pagine a pezzi non sono ancora attive; se si rilancia il `56` va rilanciato anche il `62`, che ne rimette il permesso di creare una pagina a pezzi. Per la chiusura di cassa basta `60-chiusura-cassa.sql` (dopo `59-contabilita.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, la scheda CASSE dice di lanciare questo file e movimenti, voci e casse funzionano come prima; se si rilancia il `59` va rilanciato anche il `60`, che ne ridefinisce quattro funzioni. Per la contabilità basta `59-contabilita.sql` (dopo `55-amministrazione.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non lo tocca nessun rilancio di `16`, `54` o `55`: finché non c'è, la voce CONTABILITÀ dice di lanciare questo file e il resto dell'area amministrazione funziona. Per le immagini del sito basta `58-sito-immagini.sql` (dopo `56-sito.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, SITO dice che le immagini non sono ancora attive. Per gli accessi più stretti basta `57-accessi-piu-stretti.sql` (dopo `56-sito.sql`), che non chiede di rilanciare `06-iscrizioni.sql` (ma se si rilanciano dopo di lui `02`, `03`, `04`, `05`, `12`, `35` o `55`, va rilanciato anche lui): finché non c'è, tutto va come prima, solo che iscritti e account senza scheda possono ancora leggere calendario e impostazioni. Per il sito basta `56-sito.sql` (dopo `02-policy.sql`), che non chiede di rilanciare `06-iscrizioni.sql` (che anzi ora riapre da sé le tre funzioni pubbliche del sito, se ci sono): finché non c'è, SITO dice che il pannello non è ancora attivo. Per il ruolo amministrazione basta `55-amministrazione.sql` (dopo `54-pagamenti-diretti.sql`), che non chiede di rilanciare `06-iscrizioni.sql` (ma se si rilanciano dopo di lui `02`, `04`, `05`, `16` o `54`, va rilanciato anche lui): finché non c'è, in IMPOSTAZIONI → ISTRUTTORI E ACCESSI non si può scegliere AMMINISTRAZIONE, e provarci dice di aggiornare il database. Per i pagamenti fatti a mano basta `54-pagamenti-diretti.sql` (dopo `16-ricevute.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, la scheda mostra solo le ricevute e REGISTRA UN PAGAMENTO dice che i pagamenti a mano non sono ancora attivi. Per le presenze degli allievi solo nella finestra di questi giorni basta `52-presenze-finestra.sql` (dopo `23-istruttori-dalle-lezioni.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, un istruttore può ancora toccare le presenze di ogni data; se si rilancia `23` va rilanciato anche `52`. Per la presenza degli istruttori dal PIN del tablet basta
Per l'orario del sito dai corsi basta `68-sito-orario.sql` (dopo `56-sito.sql` e `48-orari-aperti.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, SITO dice che i corsi collegati non sono ancora attivi e il sito si genera come prima, con l'orario scritto a mano; dopo ogni rilancio del `56` rilancia anche il `68` (il `56` rifà `sito_pagine_pubbliche()` senza la colonna dei corsi collegati; `controllo.sql` lo segna «da lanciare»), perché il `68` la ridefinisce. Per eliminare anche la segreteria senza storia basta `66-elimina-segreteria.sql` (dopo `55-amministrazione.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, ELIMINA c'è già ma il database dice che si eliminano solo gli istruttori. Se si rilancia `55` va rilanciato anche il `66`. Per eliminare una presenza rifiutata basta `65-elimina-presenza-rifiutata.sql` (dopo `15-presenze-istruttori.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, ELIMINA dice di lanciare questo file e il resto di PRESENZE ISTRUTTORI funziona come prima. Per le pagine del sito a pezzi basta `62-sito-pezzi.sql` (dopo `56-sito.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, SITO apre tutte le pagine col vecchio editor di testo e dice che le pagine a pezzi non sono ancora attive; se si rilancia il `56` va rilanciato anche il `62`, che ne rimette il permesso di creare una pagina a pezzi. Per la chiusura di cassa basta `60-chiusura-cassa.sql` (dopo `59-contabilita.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, la scheda CASSE dice di lanciare questo file e movimenti, voci e casse funzionano come prima; se si rilancia il `59` va rilanciato anche il `60`, che ne ridefinisce quattro funzioni. Per la contabilità basta `59-contabilita.sql` (dopo `55-amministrazione.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non lo tocca nessun rilancio di `16`, `54` o `55`: finché non c'è, la voce CONTABILITÀ dice di lanciare questo file e il resto dell'area amministrazione funziona. Per le immagini del sito basta `58-sito-immagini.sql` (dopo `56-sito.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, SITO dice che le immagini non sono ancora attive. Per gli accessi più stretti basta `57-accessi-piu-stretti.sql` (dopo `56-sito.sql`), che non chiede di rilanciare `06-iscrizioni.sql` (ma se si rilanciano dopo di lui `02`, `03`, `04`, `05`, `12`, `35` o `55`, va rilanciato anche lui): finché non c'è, tutto va come prima, solo che iscritti e account senza scheda possono ancora leggere calendario e impostazioni. Per il sito basta `56-sito.sql` (dopo `02-policy.sql`), che non chiede di rilanciare `06-iscrizioni.sql` (che anzi ora riapre da sé le tre funzioni pubbliche del sito, se ci sono): finché non c'è, SITO dice che il pannello non è ancora attivo. Per il ruolo amministrazione basta `55-amministrazione.sql` (dopo `54-pagamenti-diretti.sql`), che non chiede di rilanciare `06-iscrizioni.sql` (ma se si rilanciano dopo di lui `02`, `04`, `05`, `16` o `54`, va rilanciato anche lui): finché non c'è, in IMPOSTAZIONI → ISTRUTTORI E ACCESSI non si può scegliere AMMINISTRAZIONE, e provarci dice di aggiornare il database. Per i pagamenti fatti a mano basta `54-pagamenti-diretti.sql` (dopo `16-ricevute.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, la scheda mostra solo le ricevute e REGISTRA UN PAGAMENTO dice che i pagamenti a mano non sono ancora attivi. Per le presenze degli allievi solo nella finestra di questi giorni basta `52-presenze-finestra.sql` (dopo `23-istruttori-dalle-lezioni.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, un istruttore può ancora toccare le presenze di ogni data; se si rilancia `23` va rilanciato anche `52`. Per la presenza degli istruttori dal PIN del tablet basta
Per la pagina «Orari» del sito basta `69-orari-sito.sql` (dopo `06-iscrizioni.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: se lo si rilancia dopo, è `06` a rimettere il permesso ad `anon` su `orari_sito()`. Finché non c'è, il giro che genera il sito si ferma e dice di lanciare questo file, e il sito di prima resta com'è. Per eliminare anche la segreteria senza storia basta `66-elimina-segreteria.sql` (dopo `55-amministrazione.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, ELIMINA c'è già ma il database dice che si eliminano solo gli istruttori. Se si rilancia `55` va rilanciato anche il `66`. Per eliminare una presenza rifiutata basta `65-elimina-presenza-rifiutata.sql` (dopo `15-presenze-istruttori.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, ELIMINA dice di lanciare questo file e il resto di PRESENZE ISTRUTTORI funziona come prima. Per le pagine del sito a pezzi basta `62-sito-pezzi.sql` (dopo `56-sito.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, SITO apre tutte le pagine col vecchio editor di testo e dice che le pagine a pezzi non sono ancora attive; se si rilancia il `56` va rilanciato anche il `62`, che ne rimette il permesso di creare una pagina a pezzi. Per la chiusura di cassa basta `60-chiusura-cassa.sql` (dopo `59-contabilita.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, la scheda CASSE dice di lanciare questo file e movimenti, voci e casse funzionano come prima; se si rilancia il `59` va rilanciato anche il `60`, che ne ridefinisce quattro funzioni. Per la contabilità basta `59-contabilita.sql` (dopo `55-amministrazione.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non lo tocca nessun rilancio di `16`, `54` o `55`: finché non c'è, la voce CONTABILITÀ dice di lanciare questo file e il resto dell'area amministrazione funziona. Per le immagini del sito basta `58-sito-immagini.sql` (dopo `56-sito.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, SITO dice che le immagini non sono ancora attive. Per gli accessi più stretti basta `57-accessi-piu-stretti.sql` (dopo `56-sito.sql`), che non chiede di rilanciare `06-iscrizioni.sql` (ma se si rilanciano dopo di lui `02`, `03`, `04`, `05`, `12`, `35` o `55`, va rilanciato anche lui): finché non c'è, tutto va come prima, solo che iscritti e account senza scheda possono ancora leggere calendario e impostazioni. Per il sito basta `56-sito.sql` (dopo `02-policy.sql`), che non chiede di rilanciare `06-iscrizioni.sql` (che anzi ora riapre da sé le tre funzioni pubbliche del sito, se ci sono): finché non c'è, SITO dice che il pannello non è ancora attivo. Per il ruolo amministrazione basta `55-amministrazione.sql` (dopo `54-pagamenti-diretti.sql`), che non chiede di rilanciare `06-iscrizioni.sql` (ma se si rilanciano dopo di lui `02`, `04`, `05`, `16` o `54`, va rilanciato anche lui): finché non c'è, in IMPOSTAZIONI → ISTRUTTORI E ACCESSI non si può scegliere AMMINISTRAZIONE, e provarci dice di aggiornare il database. Per i pagamenti fatti a mano basta `54-pagamenti-diretti.sql` (dopo `16-ricevute.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, la scheda mostra solo le ricevute e REGISTRA UN PAGAMENTO dice che i pagamenti a mano non sono ancora attivi. Per le presenze degli allievi solo nella finestra di questi giorni basta `52-presenze-finestra.sql` (dopo `23-istruttori-dalle-lezioni.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, un istruttore può ancora toccare le presenze di ogni data; se si rilancia `23` va rilanciato anche `52`. Per la presenza degli istruttori dal PIN del tablet basta

Per collegare lo storico dei movimenti alle persone basta `70-movimenti-persona.sql` (dopo `59-contabilita.sql`, `63-importa-prima-nota.sql` e `67-cambia-voce.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione del `59`, del `63` o del `67`: finché non c'è, COLLEGA A UNA PERSONA e lo storico nella scheda dicono di lanciare questo file e il resto della contabilità funziona. Su un database dove c'è già, rilanciarlo porta l'apostrofo che vale accento («NICOLO'» = «Nicolò»): finché non si rilancia, quei movimenti restano «senza scheda». Per il filtro «Pagato nel vecchio programma» basta `71-pagato-vecchio-programma.sql` (dopo `70-movimenti-persona.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione degli altri file: finché non c'è, il filtro non compare nell'elenco ISCRITTI e il resto funziona. Su un database dove c'è già, rilanciarlo porta agosto nella stagione che inizia: finché non si rilancia, gli incassi di agosto non entrano nel filtro. Per sapere da dove arrivano le richieste di iscrizione basta `74-provenienza-richieste.sql` (dopo `06-iscrizioni.sql` e `49-richieste-per-email.sql`), che non chiede di rilanciare `06-iscrizioni.sql`, ma rifà la sua `invia_iscrizione`: se si rilancia `06` dopo, va rilanciato anche questo (`controllo.sql` lo dice). Finché non c'è, il modulo manda le due chiavi e il database le ignora, il dettaglio della richiesta dice «Non si sa» e il riquadro DA DOVE ARRIVANO LE RICHIESTE di STATISTICHE dice di lanciarlo; il resto funziona. Per registrare dalla chat con Claude basta `72-movimenti-dalla-chat.sql` (dopo `60-chiusura-cassa.sql` e `70-movimenti-persona.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione degli altri file: finché non c'è, Claude legge voci e casse ma non registra, e dice di chiederlo a chi cura l'app; l'app non cambia. Per pagare con Satispay dal modulo basta `73-satispay.sql` (dopo `55-amministrazione.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione di prima, più la Edge Function `satispay` coi suoi segreti: finché non ci sono, il modulo propone solo il bonifico con la sua ricevuta. Per pagare con Satispay prima di mandare la richiesta basta `83-satispay-prima.sql` (dopo `73-satispay.sql` e `74-provenienza-richieste.sql`), che non chiede di rilanciare `06-iscrizioni.sql` ma rifà la sua `invia_iscrizione`: se si rilancia `06` o `74` dopo, va rilanciato anche questo (`controllo.sql` lo dice). L'app di prima continua a funzionare; la Edge Function `satispay` nuova va pubblicata dopo averlo lanciato: finché non c'è, dice che Satispay non è attivo e il modulo propone il bonifico. Per mandare la ricevuta per email basta `76-ricevute-email.sql` (dopo `44-email-contatto.sql` e `55-amministrazione.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione di prima, più la Edge Function `ricevuta-email` col segreto `SMTP_PASSWORD`: finché non ci sono, la ricevuta si fa e si scarica come sempre, l'avviso dice cosa manca (il file o la funzione) e lo storico non dice niente della mail. Per i dati e le tariffe dei tecnici basta `78-tariffe-tecnici.sql` (dopo `18-anagrafiche.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione di prima: finché non c'è, la scheda di un tecnico dice di lanciare questo file e i dati anagrafici scritti dalla segreteria non si leggono (vale la richiesta di iscrizione). Per le lettere d'incarico basta `79-lettere-incarico.sql` (dopo `78-tariffe-tecnici.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione di prima: finché non c'è, la scheda del tecnico dice di lanciarlo e il resto funziona. Per le ricevute dei compensi basta `80-ricevute-compensi.sql` (dopo `79-lettere-incarico.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione di prima: finché non c'è, COMPENSI e la scheda del tecnico dicono di lanciarlo. Per pagare i compensi basta `81-compensi-pagati.sql` (dopo `80-ricevute-compensi.sql`), che non chiede di rilanciare `06-iscrizioni.sql` ma rifà `annulla_ricevuta_compenso` dell'80: se si rilancia l'80 dopo, va rilanciato anche questo (`controllo.sql` lo dice). Finché non c'è, SEGNA PAGATO dice di lanciarlo. Per «manca la firma» basta `82-manca-la-firma.sql` (dopo `46-istruttore-collega.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione di prima: finché non c'è, CORSI non mostra la spunta «a lezione basta uno», COMPENSI mostra le lezioni senza firma e «Non c'era» dice di lanciarlo. Per gli avvisi alla segreteria basta `84-avvisi-segreteria.sql` (dopo `83-satispay-prima.sql`), che non chiede di rilanciare `06-iscrizioni.sql` ma rifà la sua `invia_iscrizione`: se si rilancia `06`, `74` o `83` dopo, va rilanciato anche questo (`controllo.sql` lo dice). Poi la Edge Function `avvisi-segreteria`, che usa lo stesso segreto `SMTP_PASSWORD` di `ricevuta-email`. Finché non c'è, IMPOSTAZIONI mostra gli avvisi spenti e non parte niente; il resto funziona. Per non avvisare la segreteria delle quote pagate dal telefono basta `122-avvisi-senza-quote.sql` (dopo `84-avvisi-segreteria.sql` e `105`/`106`), che non chiede di rilanciare `06-iscrizioni.sql` e rifà solo `avvisi_da_mandare()`: se si rilancia `84` dopo, va rilanciato anche questo (`controllo.sql` lo dice). Finché non c'è, ogni quota o corso pagato dal telefono fa partire dopo un'ora l'avviso «pagamento senza richiesta»; il resto funziona. Per i solleciti su WhatsApp basta `85-solleciti.sql` (dopo `02-policy.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione di prima: finché non c'è, il sollecito nella scheda c'è lo stesso, senza la riga «Sollecitato il … da …». Per il tasto nell'elenco ISCRITTI basta `87-solleciti-elenco.sql` (dopo `85-solleciti.sql`), che non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna funzione di prima: finché non c'è, il tasto nell'elenco c'è lo stesso, senza la riga «Sollecitato il …», e «Annulla» dice di lanciarlo. Per la ricevuta fatta una volta sola basta `86-ricevuta-una-volta.sql` (dopo `55-amministrazione.sql` e `73-satispay.sql`), che non chiede di rilanciare `06-iscrizioni.sql` ma rifà `emetti_ricevuta` ed `emetti_ricevuta_satispay`: se si rilancia `55` o `73` dopo, va rilanciato anche questo (`controllo.sql` lo dice). Finché non c'è, l'app manda la chiave e le funzioni di prima la ignorano: la ricevuta si fa come prima, e ripremendo dopo una risposta persa ne nasce un'altra.
Per le tessere basta `61-tessere.sql` (dopo `18-anagrafiche.sql` e `29-unisci-doppioni.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, l'app non mostra tessere né il campo nel corso, e IMPORTA dice che va lanciato. Per i pagamenti fatti a mano basta `54-pagamenti-diretti.sql` (dopo `16-ricevute.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, la scheda mostra solo le ricevute e REGISTRA UN PAGAMENTO dice che i pagamenti a mano non sono ancora attivi. Per le presenze degli allievi solo nella finestra di questi giorni basta `52-presenze-finestra.sql` (dopo `23-istruttori-dalle-lezioni.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, un istruttore può ancora toccare le presenze di ogni data; se si rilancia `23` va rilanciato anche `52`. Per la presenza degli istruttori dal PIN del tablet basta
Per non registrare due volte un pagamento a mano basta `88-pagamento-una-volta.sql` (dopo `64`, `73` e `86`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, l'app manda la chiave e la funzione di prima la ignora, e il Satispay già arrivato lo ferma solo il modulo della scheda.
Per fare la ricevuta da un pagamento a mano basta `89-pagamento-diventa-ricevuta.sql` (dopo `55` e `86`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, FANNE LA RICEVUTA dice di lanciarlo, lo storico si legge senza la ricevuta del pagamento e annullare una ricevuta va come prima.
Perché due persone con lo stesso nome non finiscano sulla stessa scheda basta `90-omonimi-codice-fiscale.sql` (dopo `18` e `53`), che non chiede di rilanciare `06-iscrizioni.sql` ma va rilanciato dopo `06`, `44`, `45` o `53`, che rifanno `accogli_iscrizione`: finché non c'è, accogliere aggancia ancora l'omonimo senza email anche con un altro codice fiscale.
Per tenere le richieste accolte basta `91-richieste-accolte-restano.sql` (dopo `06`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, l'app non mostra «Elimina richiesta e file» sulle accolte, ma il database le lascia cancellare.
Per fermare i contanti di un giorno di cassa chiusa anche dalla ricevuta basta `92-ricevuta-cassa-chiusa.sql` (dopo `86` e `89`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, la ricevuta accetta quei contanti come prima e l'avviso quando si annulla lo vede solo l'amministrazione.
Per fermare le ricevute nel futuro e il numero a mano in un anno che ha già ricevute basta `93-ricevuta-data-numero.sql` (dopo `92`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, la data e il numero li controlla solo l'app.
Per chiudere le iscrizioni di chi si disattiva basta `94-disattiva-chiude-iscrizioni.sql` (dopo `06`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, l'app dice che le iscrizioni si chiudono ma il database le lascia aperte, e chi viene riattivato torna in tutti i corsi vecchi.
Perché accogliendo vinca il certificato che scade dopo basta `95-certificato-piu-lontano.sql` (dopo `90`), che non chiede di rilanciare `06-iscrizioni.sql` ma va rilanciato dopo `06`, `44`, `45`, `53` o `90`, che rifanno `accogli_iscrizione` con la firma vecchia: finché non c'è, l'app che manda la data non riesce ad accogliere, quindi si lancia prima di pubblicare.
Per la ricevuta di compenso extra basta `96-compensi-extra.sql` (dopo `81`), che non chiede di rilanciare `06-iscrizioni.sql` ma va rilanciato dopo `80` o `81`, che rifanno `fai_ricevuta_compenso` e `paga_compensi` senza le extra: finché non c'è, COMPENSI dice di lanciarlo quando si prova a fare una extra.
Per lo scarico dei pagamenti Satispay del negozio basta `97-satispay-scarico.sql` (dopo `92`), più la funzione `satispay-scarico` (sezione 13): finché non c'è, la striscia Satispay in MOVIMENTI non compare e i pagamenti del negozio si scrivono a mano come prima.
Per la persona delle quote e dei corsi scritti a mano basta `98-quote-persona.sql` (dopo `60-chiusura-cassa.sql`, `67-cambia-voce.sql` e `70-movimenti-persona.sql`), che non chiede di rilanciare `06-iscrizioni.sql` ma rifà `registra_movimento` del `60`, `cambia_voce_movimenti` del `67` e `collegamento_perche` e `storico_persona` del `70`: se si rilancia uno di quei tre dopo, va rilanciato anche questo (`controllo.sql` lo dice). Finché non c'è, la persona scelta non si salva e lo spostamento su una quota dice di lanciarlo; il resto della contabilità funziona.
Per l'importazione dal file della banca basta `104-importa-banca.sql` (dopo `59` e `63`): senza, si importa lo stesso e il tasto «Annulla tutta l'importazione» dice di lanciarlo.
Per il genitore non iscritto, titolare del nucleo dei figli, basta `113-genitore-non-iscritto.sql` (dopo `100`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, l'elenco si legge senza il segno e «Aggiungi il genitore» dice di lanciarlo.
Per IMPORTAZIONI basta `114-importazioni.sql` (dopo `97` e `104`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, la conferma di un gruppo, «Non è questo» e i movimenti della banca già scritti dicono di lanciarlo; l'import e le decisioni una per una funzionano come prima.
Per la carta nel modulo di iscrizione basta `115-carta.sql` (dopo `114`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, la funzione `paypal` dice che la carta è spenta e il modulo mostra solo Satispay e bonifico.
Per Satispay separato dal Conto Corrente basta `116-satispay-separato.sql` (dopo `114`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, lo scarico mette i pagamenti di prima di ottobre 2026 nel Conto Corrente e propone come già scritti anche i movimenti a mano del Conto Corrente.
Per le gare basta `117-gare.sql` (dopo `116`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, GARE dice «non ancora disponibile» e il resto dell'app non cambia.
Per le chiusure basta `118-chiusure.sql` (dopo `117`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, il tasto della chiusura in SETTIMANA dice «non ancora disponibile» e il resto dell'app non cambia.
Per la quadratura col saldo della banca basta `123-quadratura-banca.sql` (dopo `121`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, in CONTABILITÀ → Casse il riquadro «Il conto con la banca» dice quale file lanciare e il resto dell'app non cambia.
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
lancia a mano di tanto in tanto. Perché i 3 allegati per messaggio restino 3
anche caricandoli insieme si rilancia `32-segnalazioni-allegati.sql`: lo fa un
trigger su `storage.objects`, una tabella di Supabase, e se un suo
aggiornamento lo togliesse `controllo.sql` lo dice.
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
Per cercare per nome, sul tablet, chi è venuto a provare basta
`34-prove-per-nome.sql` (dopo `21-prove.sql`), che non chiede di rilanciare
`06-iscrizioni.sql`: finché non c'è, sul tablet i già venuti non compaiono, e
chi ha un PIN può ancora leggere l'elenco intero. Chi rilancia `21-prove.sql`
rilancia poi anche `34`.
Perché SALVA LE DATE tolga le lezioni rimaste fuori dalle date dei corsi basta
`35-date-corsi.sql` (dopo `21-prove.sql`), che non chiede di rilanciare
`06-iscrizioni.sql`: finché non c'è, le date si salvano come prima, le lezioni
fuori restano e l'app dice che va lanciato.
Perché il tablet conti chi prova a parte basta `36-tablet-conto-prove.sql`
(dopo `04-tablet.sql`), che non chiede di rilanciare `06-iscrizioni.sql`:
finché non c'è, il tablet conta come prima, prove comprese («11 su 10»).
Perché in LE MIE ORE l'istruttore veda le sue lezioni tenute senza segno basta
`37-mie-ore.sql` (dopo `23-istruttori-dalle-lezioni.sql`), che non chiede di
rilanciare `06-iscrizioni.sql`: finché non c'è, quelle lezioni lì non
compaiono. Chi rilancia `23` rilancia poi anche `37`.
Per la categoria delle segnalazioni (idea o correzione) basta
`38-segnalazioni-categoria.sql` (dopo `25-segnalazioni.sql`), che non chiede di
rilanciare `06-iscrizioni.sql`: finché non c'è, SEGNALAZIONI si legge senza
categorie e MANDA dice che va lanciato. Chi rilancia `25` rilancia poi anche `38`.
Per le radio nelle liste della musica basta `39-musica-radio.sql` (dopo
`09-musica.sql`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non
c'è, la segreteria non può salvare una radio e il database dice di lanciarlo.
Chi rilancia `09` rilancia poi anche `39`.
Per le discipline (esercizi, timer e liste di musica divisi per Judo, Lotta…)
basta `40-discipline.sql` (dopo `13-voce-esercizi.sql` e `09-musica.sql`), che
non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, l'app funziona
come prima, senza filtri per disciplina. Il `09`, rilanciato dopo, si ferma su
`musica_sala()` (ha una colonna in meno): si toglie la funzione e si rilancia il `40`.
Per l'attività dei giorni e delle lezioni basta `41-attivita.sql` (dopo
`05-segreteria.sql` e `24-kanji.sql`), che non chiede di rilanciare
`06-iscrizioni.sql`: finché non c'è, l'app non offre l'attività e le lezioni
restano com'erano. Chi rilancia `03` o `05` rilancia poi anche `41`.
Per la categoria unica degli esercizi basta `42-categorie-esercizi.sql` (dopo
`40-discipline.sql`), che non chiede di rilanciare `06-iscrizioni.sql`. Va
lanciato prima di pubblicare l'app che non usa più la categoria: finché non
c'è, un esercizio che aveva solo la categoria si legge senza voce, e la
segreteria che salva la perde.
Per cercare chi prova fra tutte le persone basta `43-cerca-persone.sql` (dopo
`34-prove-per-nome.sql`), che non chiede di rilanciare `06-iscrizioni.sql`:
finché non c'è, l'app dice che manca l'aggiornamento e lascia scrivere il nome
a mano; l'appello degli iscritti non cambia. Il tablet non usa questa ricerca.
Per l'email di contatto basta `44-email-contatto.sql` (dopo `43-cerca-persone.sql`,
`06` e `29`), che non chiede di rilanciare `06-iscrizioni.sql`: finché non c'è,
l'elenco si vede lo stesso, il contatto non si salva (l'app dice che manca
l'aggiornamento) e l'email già di un'altra persona resta fuori dalla scheda
come prima. Chi rilancia `06` o `29` rilancia poi anche `44`.
Per il certificato medico che resta nell'app basta `45-certificati-online.sql`
(dopo `44-email-contatto.sql`, quindi anche dopo `06`, `07` e `29`), che non
chiede di rilanciare `06-iscrizioni.sql`: rifà da sé (partendo dalle versioni del `44-email-contatto.sql`, che tiene) `accogli_iscrizione` e
`richieste_con_documento` (06) e `unione_possibile` e `unisci_persone` (29),
e chiude le sue funzioni. Rilanciando `06` o `29` dopo, quelle quattro tornano
a com'erano: va rilanciato anche il `45` (e lo stesso dopo `44-email-contatto.sql`). Finché non c'è, la scheda dice che
va lanciato questo file; caricare un certificato non funziona, e il certificato
resta su carta come prima. Va lanciato prima di pubblicare l'app che non
stampa più il certificato.

Per la sola email basta `99-email-unica.sql` (dopo `95-certificato-piu-lontano.sql`, quindi anche dopo `45` e `76`), che non chiede di rilanciare `06-iscrizioni.sql`. **Prima di lanciarlo** si guardano gli indirizzi che lascia da parte, cioè gli iscritti con due email diverse e senza account (tiene quella di contatto; chi con la sua email ha un account la tiene): la query è in testa al file. Finché non c'è, l'app che manda una sola email non riesce a salvare due iscritti con lo stesso indirizzo e dice che manca l'aggiornamento: va lanciato prima di pubblicare. Chi rilancia `45`, `53`, `90`, `95` o `76` rilancia poi anche `99`.

Per segnare il collega che insegnava con te basta `46-istruttore-collega.sql`
(dopo `23-istruttori-dalle-lezioni.sql`), che non chiede di rilanciare
`06-iscrizioni.sql`: finché non c'è, l'appello non mostra gli istruttori e
PRESENZE ISTRUTTORI non ha «c'era» sulle lezioni già coperte; il resto
dell'appello va come prima.

Per gli ordini di vestiario basta `47-vestiario.sql` (dopo `06-iscrizioni.sql`),
che non chiede di rilanciare `06-iscrizioni.sql`: se lo si rilancia dopo,
rimette lui il permesso ad `anon` su `vestiario()` e `invia_ordine_vestiario()`.
Finché non c'è, la pagina pubblica dice «ordini non ancora aperti» e VESTIARIO
dice che manca l'aggiornamento.

Per i corsi «alla stessa ora» del genitore nell'iscrizione a passi basta
`48-orari-aperti.sql` (dopo `06-iscrizioni.sql`), che non chiede di rilanciare
`06-iscrizioni.sql`: se lo si rilancia dopo, è `06` a rimettere il permesso
ad `anon` su `orari_aperti()`. Finché non c'è, il modulo
non propone corsi alla stessa ora e fa scegliere fra tutti i corsi per l'età.

Per mandare più di tre richieste al giorno dalla stessa email basta
`49-richieste-per-email.sql` (dopo `06-iscrizioni.sql`), che non chiede di
rilanciarlo: se lo si rilancia dopo, `06` rimette il limite a tre e va
rilanciato anche il `49`. Finché non c'è, la quarta richiesta dalla stessa email
è rifiutata e l'iscrizione di una famiglia si ferma a metà.

Perché un file rimandato non sbatta sul limite di cinque basta
`50-file-rimandato.sql` (dopo `06-iscrizioni.sql`), che non chiede di
rilanciarlo: se lo si rilancia dopo, `06` rimette le versioni vecchie di
`puo_caricare()` e `limita_file_iscrizione()` e va rilanciato anche il `50`.
Finché non c'è, il quinto file rimandato dopo una risposta persa dice «scrivi
alla segreteria», anche se è arrivato.

Per tipi, foto e tabelle delle taglie del vestiario basta `51-vestiario-foto.sql`
(dopo `47-vestiario.sql`), che non chiede di rilanciare `06-iscrizioni.sql`:
se si rilancia il `47`, riporta `salva_vestiario()` e `vestiario()` a
com'erano e va rilanciato anche il `51`. Finché non c'è, VESTIARIO dice che
manca l'aggiornamento e la pagina pubblica mostra il catalogo senza tipi né foto.

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
e la ricevuta. Il documento la segreteria lo stampa, lo tiene su carta e lo
cancella dall'app; il certificato resta nell'app, e accolta la richiesta passa
alla scheda dell'iscritto. La segreteria le trova in **SEGRETERIA → RICHIESTE
ONLINE**, guarda i file e la accoglie o la rifiuta. Chi manda una richiesta
rifiutata non viene avvisato dall'app: va chiamato o scritto a mano.

Cosa fa `06-iscrizioni.sql`:

- la tabella `richieste_iscrizione`, che legge e cambia solo la segreteria;
- il contenitore **`iscrizioni`** nello Storage, privato: niente link
  pubblici, la segreteria apre i file con un link che dura dieci minuti;
- chi non ha un accesso può solo chiamare `corsi_aperti()`,
  `orari_aperti()` (con `48-orari-aperti.sql`) e `invia_iscrizione()`, e caricare al massimo cinque file (modulo,
  documento fronte e retro, certificato, ricevuta: foto o PDF, fino a 10 MB), nella cartella della richiesta appena mandata,
  entro un'ora. Non li può rileggere né sostituire;
- `richieste_con_documento()` dice alla segreteria quali richieste hanno
  ancora il documento d'identità caricato: RICHIESTE ONLINE le segna **DA
  STAMPARE** (il certificato no: dal `45` resta nell'app, vedi più sotto);
- la porta non è spalancata: sei richieste al giorno dalla stessa email (tre fino al `49`),
  sessanta all'ora in tutto. I numeri stanno in `iscrizioni_regole()`;
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
2026. Se si rimette a `true` la pagina `iscrizioni/` non mostra più il
tasto e dice di chiamare la segreteria (`SENZA_MODULO`). In prova il modulo è
sempre acceso.

**Le domande** sono ricavate dai moduli di autorizzazione e dai passi di
prima, non copiate dal modulo Google, che senza accesso non si legge. Se
quello chiedeva altro, vanno allineati tre posti: `invia_iscrizione` qui,
`controlla()` in `src/lib/richieste.ts` e `ModuloIscrizione.tsx`.

**Per quanto si tengono.** Accolta o rifiutata, una richiesta resta con i suoi
file finché la segreteria non la elimina («Elimina richiesta e file», nella
richiesta). Il documento no: si stampa e si cancella appena accolta la
richiesta, e la copia su carta segue i tempi dell'informativa. Il certificato
passa alla scheda (vedi «Il certificato medico nell'app»).

### Il certificato medico, il documento e il pagamento

Nella scheda di ogni iscritto (**SEGRETERIA → ISCRITTI**) la segreteria
scrive fino a quando vale il certificato medico (e ne carica il file, vedi
più sotto), segna se la copia del
documento d'identità è in segreteria, e se ha pagato: da pagare, in parte o
pagato, e per il trimestre fino a quando. L'elenco dice chi non è in regola
e si filtra.

Cosa fa `07-certificati-pagamenti.sql`:

- la tabella `schede_iscritti`, una riga per persona, che legge e cambia solo
  la segreteria. Sta a parte da `persone` apposta: gli istruttori leggono
  `persone` per l'appello, e il certificato è un dato sulla salute. Chi l'ha
  cambiata e quando lo scrive il server. `documento_in_segreteria` dice se
  la copia del documento è nella cartellina;
- le policy del contenitore **`certificati`** (che il `45` rifà): la
  segreteria legge e cancella i file;
- la riga se ne va con la persona (`on delete cascade`). Un file di prima,
  se la persona si cancella dal database a mano, resta nel contenitore e va
  tolto a mano anche lui.

Il documento arriva col modulo, nella cartella della richiesta (o si porta in
segreteria): la scheda ne tiene solo se c'è. L'esportazione dei dati di una
persona (IMPOSTAZIONI) comprende la scadenza del certificato e se il documento
c'è, non il file.

### Il certificato medico nell'app

Il certificato medico non si stampa più: il file (foto o PDF, fino a 10 MB)
sta nell'app, nella scheda dell'iscritto, in **CERTIFICATO MEDICO**. La
copia del documento d'identità invece resta su carta, in un armadio chiuso, e
nell'app si segna solo che c'è: si stampa dalla richiesta e si cancella.

Cosa fa `45-certificati-online.sql`:

- il contenitore **`certificati`**, privato, foto e PDF fino a 10 MB, una
  cartella per persona (`<persona>/certificato-<n>.<est>`). Lo legge, lo
  carica e lo cancella solo la segreteria: istruttori, iscritti, tablet e chi
  non ha un accesso non lo leggono, e non sanno nemmeno se c'è. Si apre con un
  link che dura al massimo dieci minuti;
- `schede_iscritti.certificato_caricato_il`: quando il file è stato caricato.
  Senza, il file è di prima (la scheda lo dice, e si apre lo stesso). Resta
  anche quando il file si cancella (a scadenza + 30 giorni, o alla
  disattivazione): così la scheda sa che un file c'è stato e dice «file
  cancellato», e non lo dice a chi ha solo la data scritta a mano. Lo azzera
  solo TOGLI IL CERTIFICATO;
- `salva_certificato(persona, file, scade)`: il file e la data insieme, in un
  passaggio solo (la data non può essere più di tre anni avanti: «La data è
  troppo lontana: controlla l'anno»). L'app carica prima il file, poi chiama la funzione, che
  controlla (è della persona, c'è davvero, c'è la data), lo mette sulla scheda
  e cancella quello di prima: un file per persona. Se la funzione dice di no,
  l'app toglie il file appena caricato e non cambia niente;
- `pulisci_certificati()`: 30 giorni dopo la scadenza il file si cancella e la
  data resta. Ogni notte alle 3:45 con pg_cron, se c'è (come
  `pulisci_allegati`); se no `select pulisci_certificati();` si lancia a mano
  nel SQL Editor. Non si chiama dall'app;
- disattivare una persona toglie subito il file (un trigger su `persone`); la
  data resta, e riattivarla non lo riporta. A una persona disattivata
  `salva_certificato` non mette un file nuovo (risponde come per una persona
  che non c'è), se no la regola si aggirerebbe. Cancellando la persona dal
  database se ne va anche il suo file (un altro trigger);
- `pulisci_certificati()` toglie anche i file del contenitore che nessuna
  scheda tiene (un caricamento a metà), ma solo se hanno più di un giorno: uno
  appena caricato aspetta ancora `salva_certificato`;
- `accogli_iscrizione`: il certificato arrivato col modulo passa alla scheda,
  nel contenitore `certificati` e senza data (la scrive la segreteria
  leggendo il foglio); se la scheda ne aveva già uno scaduto, quello nuovo lo
  sostituisce e la data resta com'era. Se ne ha uno **ancora valido**, quello
  della richiesta non lo sostituisce (potrebbe essere sbagliato o di un altro):
  resta fra i file della richiesta, per la segreteria. Uno sbagliato la
  segreteria lo toglie dalla richiesta prima di accogliere (**RIFIUTA IL
  FILE**). «Chi c'era già in elenco» si cerca solo fra gli iscritti: una
  richiesta con nome ed email di un istruttore non diventa l'istruttore;
- `unisci_persone`: il file di chi se ne va passa a chi resta; se ce n'è uno
  per parte resta quello con la scadenza più lontana, e l'altro si cancella.
  La data è quella del certificato il cui file resta (non la più lontana
  delle due: se uno ha una data più lontana ma senza file, il file e la data
  restano quelli dell'altro); senza file da nessuna parte, la più lontana. Quel
  che resta nella cartella di chi se ne va si cancella.

Sotto i 6 anni il certificato non si chiede: la scheda dice «NON SERVE» e chi
ha meno di 6 anni non conta fra gli iscritti senza certificato, negli
avvisi dell'area iscritti e nelle statistiche: una regola sola
(`certificatoInRegola`). Per chi non ha
la data di nascita vale come per tutti.

**I file si cancellano da SQL, come per gli allegati delle segnalazioni.**
Cancellare la riga di `storage.objects` toglie il file dall'app (non si apre
più, nemmeno con un link), ma Supabase può tenerne la copia fisica nello
Storage, e di norma vieta la cancellazione da SQL: `togli_file_certificato`
la consente solo per la sua transazione (`storage.allow_delete_query`). Se il
progetto la rifiuta, `pulisci_certificati` lascia il file com'è e lo riprova
la notte dopo; il file che l'app toglie dalla scheda con TOGLI IL CERTIFICATO
lo cancella invece l'API dello Storage, e quello si cancella davvero.
Allo stesso modo, il certificato che passa da una richiesta alla scheda
cambia nome da SQL: se Supabase non lo ritrova (la riga si sposta, il file
fisico no), lo si ricarica dalla scheda. Il pannello **Storage** mostra cosa
c'è davvero nel contenitore.

**Il controllo da fare subito dopo aver lanciato il `45`:** accogliere una
richiesta di prova che ha un certificato (una persona nuova, o una con il
certificato scaduto) e, dalla sua scheda, **APRI**. Se il file si apre, a posto.
Se dà 404, la riga è passata ma il file fisico no: il passaggio da SQL non
basta su questo progetto. Allora si dice a chi cura l'app (il passaggio va fatto
dall'API dello Storage, `move`, e non da SQL) e nel frattempo il certificato
arrivato col modulo si ricarica a mano dalla scheda (**SOSTITUISCI**), aprendolo
dal file della richiesta prima di accogliere. Lo stesso controllo vale unendo
due schede dove una ha un file.

Un file di un certificato **non è nel dump del database**: sta nello Storage.
Per questo il backup settimanale lo scarica a parte (vedi «Il backup»).

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
YouTube o di Spotify, o l'indirizzo https di una radio (`39-musica-radio.sql`),
per una sala o per tutte (`09-musica.sql`, tabella
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
sotto, o da **Actions → Backup del database → Run workflow**. Copia il
database e, nella stessa copia cifrata, i file del contenitore `certificati`
dello Storage (i certificati medici, in una cartella `certificati/`, una
sottocartella per persona). Non copia gli altri file dello Storage (moduli
firmati, ricevute, clip della voce). I documenti d'identità stanno su carta,
in segreteria.

Servono due *repository secrets* in **Settings → Secrets → Actions**:

- **`SUPABASE_DB_URL`**: in Supabase, **Connect → Session pooler**, la stringa
  così come la mostra, con la password del database al posto di
  `[YOUR-PASSWORD]`. Ha questa forma:
  `postgresql://postgres.<id del progetto>:<password>@aws-<n>-<regione>.pooler.supabase.com:5432/postgres`,
  e per ODS-Sala la regione è `eu-north-1`. Il numero dopo `aws-` e la
  regione non vanno indovinati: si copia quella del pannello. Il *Session pooler* e non la
  *Direct connection*: quella parla solo IPv6, e le macchine di GitHub no.
- **`BACKUP_PASSWORD`**: una password casuale di almeno 24 caratteri, da
  generare così (sul Mac, nel Terminale) e da tenere anche fuori da GitHub
  (la segreteria, un gestore di password):

  ```sh
  openssl rand -base64 32
  ```

  Il repository è pubblico e le copie le scarica chiunque abbia un account
  GitHub: per questo escono cifrate, e senza questa password non le apre
  nessuno, palestra compresa. Ma chi scarica una copia può provare a
  indovinare la password quante volte vuole, a casa sua: la sicurezza è tutta
  nella password. Per questo i workflow si fermano rossi sotto i 24
  caratteri, e la cifratura usa la derivazione della chiave più dura di gpg.

Senza `SUPABASE_DB_URL` il workflow passa senza fare niente; con l'indirizzo e
senza password, o con una password sotto i 24 caratteri, si ferma rosso,
invece di mettere fuori i dati in chiaro o poco protetti.

**Se la password era corta**, o l'hai scritta altrove: le copie già fatte
restano scaricabili da chiunque per novanta giorni, cifrate con quella password.
Cambia il segreto (Settings → Secrets → Actions → `BACKUP_PASSWORD`, con una
nuova da `openssl rand -base64 32`), poi cancella a mano le copie vecchie da
**Actions** (nella pagina di ogni lancio, in fondo, il cestino accanto
all'artefatto) e fai subito **FAI UN BACKUP ORA**: la prova di ripristino del
lunedì apre l'ultima copia con la password di quel momento, quindi una copia
cifrata con la vecchia non si aprirebbe più. La vecchia password va conservata
finché esiste una copia fatta con quella.

Per i certificati servono altri due segreti, **che aggiunge l'utente** (il
codice non può farlo):

- **`SUPABASE_URL`**: l'indirizzo del progetto, `https://<id del progetto>.supabase.co`
  (Supabase, **Project Settings → API**);
- **`SUPABASE_SERVICE_ROLE_KEY`**: la chiave `service_role` dello stesso
  pannello. Apre tutto il progetto, saltando le policy: sta solo nei segreti
  di GitHub, mai nel codice, nell'app o in un file del repository.

Senza uno dei due il passo «Copia i certificati» si salta con un avviso
(*notice*) e la copia del database si fa lo stesso: i certificati nello
Storage restano fuori, e il backup non è completo finché i segreti mancano. Con
tutti e due, il passo si ferma rosso se un file non si scarica, invece di
dare per completa una copia a metà.

Ogni copia è un artefatto `backup-AAAA-MM-GG`, nella pagina del suo lancio in
**Actions**, e resta novanta giorni: ci sono sempre le ultime tredici
settimane. GitHub spegne i workflow programmati di un repository pubblico
dopo sessanta giorni senza commit, e lo dice per email: se succede, si
riaccende dalla stessa pagina con **Enable workflow**.

### La prova di ripristino

`.github/workflows/ripristino.yml` parte ogni lunedì alle 4:17 UTC, un'ora dopo
il backup (o da **Actions → Prova di ripristino del backup → Run workflow**):
scarica l'ultima copia, la decifra con `BACKUP_PASSWORD`, la rimette in un
Postgres usa e getta e conta le righe di persone, iscrizioni, presenze e
ricevute (e i file dei certificati). Si ferma rosso se la copia manca, non si
apre, non si rimette a posto o non ha nessuna persona. Non vede mai il
database vero. Il repository è pubblico, quindi nei log escono solo numeri:
per capire un errore sui dati si rifà in locale, con la copia scaricata e la
password: `scripts/ripristina.sh <cartella della copia>` (serve un Postgres
con `PGHOST`, `PGUSER` e `PGPASSWORD`).

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
Storage ricaricati a mano: quelli dei certificati sono nella cartella
`certificati/` della copia (`<persona>/certificato-<n>.<est>`), da ricaricare
nel contenitore `certificati` con lo stesso nome.

## 11. Il sito subito

Il sito pubblico lo genera `.github/workflows/sito.yml` ogni cinque minuti.
Per non aspettare il giro, dopo **PUBBLICA** (e dopo indirizzo, nascondi,
cancella e menu) l'app chiede alla funzione **`sito`**
(`functions/sito/index.ts`) di far partire il workflow: il sito è aggiornato
in un paio di minuti. Usa gli stessi segreti del backup (`GITHUB_TOKEN`, con
«Actions: Read and write»), quindi non c'è niente da aggiungere. Si pubblica
come le altre:

```sh
supabase functions deploy sito --project-ref <id-del-progetto>
```

o dal pannello, **Edge Functions → Deploy a new function**, col nome `sito`.
Senza la funzione l'app funziona uguale: il sito si aggiorna col giro a tempo.

### I numeri del sito

Il riquadro **IL SITO** di STATISTICHE legge le visite e i tocchi su
Iscriviti, Chiama e Scrivici da GoatCounter con la funzione
**`conti-sito`** (`functions/conti-sito/index.ts`). La chiave di
GoatCounter sta solo nella funzione, mai nell'app; all'app tornano solo i
conti. La usa solo la segreteria (`ruolo = 'staff'`, attiva).

1. Su <https://ods.goatcounter.com>: in alto a destra il tuo utente → **API**
   → nuova chiave. Dagli un nome («app ODS Corsi») e lascia **solo** il
   permesso di leggere le statistiche: niente che scriva, conti visite o
   cambi le impostazioni (i nomi dei permessi li dice la pagina, GoatCounter
   non li documenta). Copia la chiave: la vedi una volta sola.
2. Su Supabase, **Edge Functions → Secrets**, aggiungi `GOATCOUNTER_CHIAVE`
   con quella chiave.
3. Pubblica la funzione:

```sh
supabase functions deploy conti-sito --project-ref <id-del-progetto>
```

o dal pannello, **Edge Functions → Deploy a new function**, col nome
`conti-sito` e i due file della cartella (`index.ts` e `numeri.ts`).
`numeri.ts` è una copia di `src/lib/sitoNumeri.ts`: si cambia là e si
ricopia (`npm run prova:statistiche-sito` controlla che siano uguali).
Il nome non dice «statistiche»: i filtri contro il tracciamento dei browser
bloccano gli indirizzi che lo contengono, e il riquadro restava vuoto.
`statistiche-sito`, il nome di prima, si può cancellare dal pannello.

Senza la funzione il riquadro dice «Il contatore non è ancora acceso»;
senza la chiave «Manca la chiave del contatore»; con una chiave scaduta o
senza permesso «Il contatore non accetta la chiave». Il resto delle
statistiche funziona uguale.

## 12. Claude e la contabilità

Chi cura i conti può collegare Claude al suo account e fotografargli fatture,
ricevute e scontrini dei fornitori: Claude propone il movimento e lo registra in
CONTABILITÀ dopo il suo «ok» (vedi la guida, `guida/amministrazione/contabilita.md`).
Claude legge anche i conti (strumenti `conti`, `saldi_casse`, `da_classificare`): gli stessi
numeri di BILANCIO, dalle tabelle con le sole colonne che servono (delle ricevute le voci coi
pagamenti, mai intestatario, ente o note; dei pagamenti a mano mai persona o nota), senza file SQL
in più. Della Cassa Contanti non dice il previsto. Claude parla con la funzione **`mcp`** (`functions/mcp/index.ts`), un server MCP
che legge e scrive col token di chi si è collegato, mai con la chiave
`service_role`: valgono le stesse regole dell'app. Servono tre cose, una volta:

1. **Il database**: `72-movimenti-dalla-chat.sql`.
2. **L'accesso**: in Supabase, **Authentication → OAuth Server**, si accende il
   server OAuth, si mette come **Authorization Path** `/collega/` (la pagina
   dell'app dove si dice CONSENTI: si somma alla Site URL, quindi la Site URL
   deve essere l'indirizzo dell'app) e si accende la **Dynamic client
   registration**, che Claude usa per presentarsi da solo.
3. **La funzione**: le regole stanno in `src/lib` (`mcp.ts`,
   `movimentiDallaChat.ts`) e prima di pubblicarla si mettono in un file solo,
   senza il controllo del token di Supabase (il token lo controlla lei, e senza
   deve rispondere lei, col 401 che manda Claude all'accesso):

   ```sh
   node scripts/costruisci-mcp.mjs
   supabase functions deploy mcp --no-verify-jwt --project-ref <id-del-progetto>
   ```

Poi in Claude: **Impostazioni → Connettori → Aggiungi connettore
personalizzato**, con l'indirizzo
`https://<id-del-progetto>.supabase.co/functions/v1/mcp`. Claude apre la pagina
`collega/` dell'app: si entra, si legge cosa potrà fare e si dice CONSENTI. Il
collegamento si toglie da lì, dai Connettori di Claude.

### La segreteria dalla chat (costruita, spenta)

La segreteria potrà chiedere a Claude certificati, quote, iscritti e presenze di un
corso e chi si sta perdendo (strumenti `corsi`, `certificati`, `quote`, `iscritti`,
`presenze`, `chi_manca`, tutti di sola lettura; regole in `src/lib/chatSegreteria.ts`,
le stesse di DA FARE e PRESENZE). Degli adulti esce il nome; dei minori, di chi non ha
la data di nascita e di chi è venuto a provare solo numeri. Il taglio lo fa il database
(`75-chat-segreteria.sql`), non solo il server. Gli strumenti dipendono dal ruolo:
l'amministrazione vede la contabilità, la segreteria i suoi, chi ha tutti e due li vede
tutti.

È **spenta** (`CHAT_SEGRETERIA_ACCESA = false` in `src/lib/chatSegreteria.ts`): la
segreteria non può collegare Claude e non vede gli strumenti. Per accenderla:

0. fatto: `77-claude-dalla-porta.sql` chiude ai token di Claude tutto quello che il server
   MCP non usa, così i minori restano fuori anche se il token uscisse dal connettore;
1. il sì di chi segue la privacy della palestra (la scadenza del certificato è un dato
   sulla salute?) e l'informativa (`informativa.html`) che nomina Anthropic fra i
   fornitori, come responsabile del trattamento, col trasferimento fuori dall'UE e cosa
   vede; la data dell'informativa e il principio 4 in `PRODUCT.md`;
2. `75-chat-segreteria.sql` sul database;
3. `CHAT_SEGRETERIA_ACCESA = true`, la guida della segreteria, e la funzione `mcp`
   ripubblicata (`node scripts/costruisci-mcp.mjs`, poi il deploy).

Chi ha già collegato Claude per la contabilità e ha anche la segreteria, dopo
l'accensione vede gli strumenti nuovi senza un nuovo CONSENTI: va avvisato, o si toglie e
si rimette il connettore.

## 13. Satispay nel modulo di iscrizione

Chi si iscrive sceglie Satispay e, in fondo al modulo, paga dall'app Satispay
l'importo che calcola il database dal listino (`73-satispay.sql`,
`83-satispay-prima.sql`); solo dopo manda la richiesta, che prende con sé il
pagamento. Satispay avvisa la funzione `satispay`, che rilegge lo stato da
Satispay e lo scrive: la richiesta arriva già pagata, e la ricevuta dalla
scheda prende quel pagamento. Chi paga e non manda la richiesta resta in
PAGAMENTI come «Satispay senza richiesta», con nome, email e corso. Il
pagamento vale solo per la stessa persona e la stessa scelta: chi conosce l'id
di un altro non ci fa la sua richiesta. Finché la funzione non c'è, o non ha le chiavi, il modulo propone
bonifico e segreteria come prima.

1. **Il database**: si lanciano `73-satispay.sql` e `83-satispay-prima.sql`.
2. **Le chiavi**: una coppia RSA, che resta solo nei segreti della funzione.

   ```sh
   openssl genrsa -out satispay.pem 4096
   openssl rsa -in satispay.pem -pubout -out satispay.pub
   ```

   Dalla dashboard di Satispay Business (o dalla mail della sandbox) si prende
   il **codice di attivazione** e si chiede il KeyId, una volta sola. Prima in
   sandbox (`staging.authservices.satispay.com`), poi in produzione
   (`authservices.satispay.com`), ognuno col suo codice:

   ```sh
   curl -s https://staging.authservices.satispay.com/g_business/v1/authentication_keys \
     -H 'Content-Type: application/json' \
     -d "{\"public_key\": $(jq -Rs . < satispay.pub), \"token\": \"<codice di attivazione>\"}"
   ```

3. **I segreti e la funzione**: la callback di Satispay arriva senza token,
   quindi la funzione si pubblica senza il controllo di Supabase (le scritture
   le fanno solo le funzioni di `73`, con la chiave che non esce dal server).

   ```sh
   supabase secrets set --project-ref <id-del-progetto> \
     SATISPAY_KEY_ID=<key_id> SATISPAY_CHIAVE="$(cat satispay.pem)" \
     SATISPAY_HOST=staging.authservices.satispay.com \
     APP_URL=https://<indirizzo-dell-app>/iscrizioni/
   supabase functions deploy satispay --no-verify-jwt --project-ref <id-del-progetto>
   ```

   In produzione `SATISPAY_HOST=authservices.satispay.com`, col KeyId di
   produzione. `satispay.pem` poi si cancella dal computer.

Il prezzo vale solo per i corsi agganciati alla loro voce in LISTINO: con un
corso senza voce (o col listino del foglio) Satispay non compare. Un rimborso
si fa dalla dashboard di Satispay; in CONTABILITÀ lo porta lo scarico qui sotto.

### Lo scarico del negozio

`97-satispay-scarico.sql` e la funzione `satispay-scarico` portano in
CONTABILITÀ tutti i pagamenti del negozio Satispay (anche quelli col QR alla
cassa) e i loro rimborsi, una volta sola. La funzione usa gli stessi segreti
di `satispay`, e scrive solo con `SATISPAY_HOST=authservices.satispay.com`: con
la sandbox risponde «Lo scarico gira solo col negozio vero di Satispay».

```sh
supabase functions deploy satispay-scarico --no-verify-jwt --project-ref <id-del-progetto>
```

La funzione è aperta (`--no-verify-jwt`), quindi la notte si riconosce da un
segreto, uguale in due posti: fra i secret della funzione e nel Vault del
database, dove lo legge pg_cron. Si genera sul proprio computer e non passa
mai da chat o file:

```sh
S=$(openssl rand -hex 32)
supabase secrets set SATISPAY_SCARICO_SEGRETO="$S" --project-ref <id-del-progetto>
psql "<stringa-di-connessione>" -c "select vault.create_secret('$S', 'satispay_scarico_segreto')"
unset S
```

Senza il segreto giusto (né un accesso dell'amministrazione) risponde 403.
Col segreto (pg_cron, ogni notte) lavora solo dopo che l'amministrazione ha
visto l'anteprima del primo scarico e l'ha confermata da MOVIMENTI. Lo storico
si legge dal pagamento più nuovo al più vecchio, e se si ferma a metà riparte
da dove era arrivato.

Finito uno scarico vero (non l'anteprima), se ha scritto movimenti, lasciato
pagamenti da decidere o non è riuscito, la segreteria riceve un avviso (vedi
«Gli avvisi alla segreteria»): la funzione `avvisi-segreteria` va ripubblicata
con la `mail.ts` che conosce il tipo `satispay_scarico`.

### La carta

`115-carta.sql` e la funzione `paypal` aggiungono la carta di credito o di
debito (con Apple Pay e Google Pay) in fondo al modulo, accanto a Satispay.
Incassa PayPal (pagamenti avanzati con carta): i campi della carta sono di
PayPal, e nessun dato della carta passa dall'app o dal database. Servono un
conto PayPal Business con le carte avanzate attive, e dalla sua dashboard
sviluppatori un'app REST: client id e segreto, prima in sandbox.

```sh
supabase secrets set --project-ref <id-del-progetto> \
  PAYPAL_CLIENT_ID=<client id> PAYPAL_SECRET=<segreto> \
  PAYPAL_HOST=api-m.sandbox.paypal.com
supabase functions deploy paypal --no-verify-jwt --project-ref <id-del-progetto>
```

In produzione `PAYPAL_HOST=api-m.paypal.com`, con le chiavi di produzione,
solo dopo che l'informativa sulla privacy nomina PayPal. Senza i segreti la
carta non compare. Apple Pay chiede anche il file di verifica del dominio di
PayPal in `/.well-known/` del sito che apre il modulo.

I soldi arrivano sul conto PayPal: in CONTABILITÀ stanno nella cassa «Carta»,
e passano al conto corrente con un giroconto. Un rimborso si fa dal conto
PayPal e poi si segna in CONTABILITÀ.


## 14. La ricevuta per email

Fatta la ricevuta, la famiglia la riceve in PDF all'**email di contatto** della
persona della ricevuta (per un minore, quella del genitore), mai a quella di
accesso. La manda la funzione **`ricevuta-email`**
(`functions/ricevuta-email/index.ts`) dalla casella
`info@officinedellosport.it` di Register.it (`authsmtp.securemail.pro`, porta
465, SSL). L'indirizzo lo sceglie il database (`76-ricevute-email.sql`), mai
il browser; ogni tentativo resta in `invii_ricevute`, e lo scrive solo la
funzione (col ruolo `service_role`), con l'impronta SHA-256 del PDF allegato.
Register lascia 500 mail al giorno per casella: l'app ne manda al più 400
(giorno di Roma), il resto resta a inviti e reset; la stessa ricevuta parte al
più 3 volte in 24 ore. Mandano la segreteria e l'amministrazione.

1. **Il database**: si lancia `76-ricevute-email.sql`.
2. **Il segreto**: su Supabase, **Edge Functions → Secrets**, aggiungi
   `SMTP_PASSWORD` con la password della casella `info@officinedellosport.it`
   (o `supabase secrets set --project-ref <id-del-progetto> SMTP_PASSWORD=…`).
3. **La funzione**:

```sh
supabase functions deploy ricevuta-email --project-ref <id-del-progetto>
```

o dal pannello, **Edge Functions → Deploy a new function**, col nome
`ricevuta-email` e i due file della cartella (`index.ts` e `mail.ts`).
`mail.ts` è una copia di `src/lib/ricevutaMail.ts`: si cambia là e si
ricopia (`npm run prova:ricevute-email` controlla che siano uguali).

Senza il file la ricevuta si fa e si scarica, e l'avviso dice di lanciare
`76-ricevute-email.sql`; senza la funzione dice di pubblicarla; senza il
segreto «manca la password della posta». La ricevuta resta «Non mandata» e
si manda dopo con MANDA PER EMAIL dallo storico. L'indirizzo non va mai nei
log della funzione.

## 15. Gli avvisi alla segreteria

Quando arriva una richiesta di iscrizione o un pagamento Satispay, o finisce
uno scarico Satispay in CONTABILITÀ con qualcosa da dire, la segreteria
riceve un'email all'indirizzo scritto in **IMPOSTAZIONI → GLI AVVISI**, con la copia facoltativa (all'inizio `asdilcentrojudo@gmail.com`).
Cosa avvisare lo decide il database (`84-avvisi-segreteria.sql`); scrive e
manda la funzione **`avvisi-segreteria`**
(`functions/avvisi-segreteria/index.ts`), dalla stessa casella della ricevuta
per email. La chiama pg_cron ogni cinque minuti con pg_net (il file 84 li
accende): un avviso arriva da cinque a dieci minuti dopo la richiesta. Al più
50 al giorno, così le 400 ricevute stanno nelle 500 mail della casella; quelli
in più non partono e RICHIESTE ONLINE li conta. Un avviso non partito (la
posta che non risponde) si riprova dieci minuti dopo; dopo dodici volte si
chiude e RICHIESTE ONLINE lo conta. Ogni avviso la funzione lo prende
(`avviso_preso`) prima di mandarlo: due chiamate insieme non mandano la stessa
mail.

1. **Il database**: si lancia `84-avvisi-segreteria.sql`.
2. **La funzione**, senza token perché la chiama pg_cron (chiamarla da fuori
   manda solo gli avvisi che il database ha già pronti, una volta):

```sh
supabase functions deploy avvisi-segreteria --no-verify-jwt --project-ref <id-del-progetto>
```

   Il segreto è `SMTP_PASSWORD`, lo stesso di `ricevuta-email`. `mail.ts` è
   una copia di `src/lib/avvisoSegreteria.ts`: si cambia là e si ricopia
   (`npm run prova:avvisi-segreteria` controlla che siano uguali).
3. **L'indirizzo**: la segreteria lo scrive in IMPOSTAZIONI. Finché è vuoto
   non parte niente; scritto, gli avvisi partono da quel momento (le
   richieste arrivate prima non avvisano). Lo stesso se si spengono e si
   riaccendono.

Nella mail solo nomi, corsi e importi: mai note, codice fiscale, data di
nascita, documenti o file. Nei log della funzione mai indirizzi né nomi.

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
  del GDPR), con altri obblighi: per questo il file sta in un
  contenitore privato che apre solo la segreteria, con un link che dura dieci
  minuti. Si cancella da solo 30 giorni dopo la scadenza e subito quando la
  persona è disattivata; sotto i 6 anni non si chiede. La palestra deve
  dirlo nell'informativa e decidere per quanto tenerlo (qui: finché vale più
  trenta giorni, e meno se arriva il nuovo o l'iscritto smette). Patologie e simili, invece, non ci vanno.

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
`categorie-esercizi.sql` prova la categoria unica degli esercizi: le cinque voci in più, la conversione dei dati vecchi, il rilancio, e che il database accetti ancora una copia vecchia dell'app; `attivita.sql` prova l'elenco delle attività, le lezioni che seguono il giorno e chi può cambiarle; `segreteria.sql` prova cosa succede alle lezioni quando un corso, o uno dei
suoi giorni, cambia sala, quando cambiano istruttore o giorni, o si archivia, e il primo accesso; `iscrizioni.sql`
prova il modulo di iscrizione: cosa può fare chi non ha un accesso, le sei richieste al giorno per email (la settima no), i limiti
sui file (il documento, che si trovi da stampare; il certificato, che passi alla scheda accogliendo), e chi accoglie le richieste;
`disattiva-chiude-iscrizioni.sql` prova che disattivare una scheda chiude le sue iscrizioni e che riattivarla, o accogliere una sua richiesta, non riapre i corsi vecchi.
`satispay-scarico.sql` prova lo scarico dei pagamenti Satispay del negozio: il modulo resta fuori, il doppione sicuro prende il segno, quelli dubbi e i giorni chiusi aspettano una decisione, l'anteprima non scrive niente, e lo scarico lo vedono e lo decidono solo l'amministrazione e il servizio.
`importazioni.sql` prova IMPORTAZIONI: la conferma di un gruppo è tutta o niente e non dà lo stesso movimento a due pagamenti, «Non è questo» rimette il pagamento da decidere ma non nei giorni chiusi, i movimenti della banca già scritti si segnano una volta sola e si fanno entrare con «Non è questo», e tutto lo fa solo l'amministrazione.
`116-satispay-separato.sql` prova Satispay separato dal Conto Corrente: la cassa Satispay dal 1° gennaio 2025, i candidati solo in Satispay, e i dati di prima rimessi da valutare senza toccare gli scritti né un «Non è questo» deciso in Satispay, anche lanciando il 116 due volte.
`tessere.sql` prova le tessere: che le veda e le scriva solo la segreteria, l'import dal RASD (codice fiscale e stesso nome, anteprima, senza doppioni né persone nuove), l'unione di due schede con la stessa tessera e la mappa dei corsi che si scrive una volta sola;
`orari-sito.sql` prova `orari_sito()`: solo corso, giorno, ora, durata e data di modifica, solo corsi attivi e ricorrenze non finite, le tabelle chiuse, la data di modifica scritta sempre dal database e il permesso rimesso da `06`;
`certificato-iscritto.sql` prova che l'iscritto mandi il certificato solo per sé (o il titolare per chi sta senza account), che resti in attesa finché la segreteria lo conferma o lo rifiuta, e che la scheda non mostri mai il nome del file;
`109-privilegi-e-certificati.sql` prova che TRUNCATE, TRIGGER e REFERENCES non restino ad `anon` e `authenticated` (nemmeno sulle tabelle nuove) e che un iscritto tenga in attesa al più 3 file del certificato.
`110-tetto-certificato-messaggio.sql` prova che il quarto file in attesa sia negato con 54000 e il testo del tetto (anche da superutente), e che chi non è titolare della cartella riceva l'errore della policy, uguale per una cartella piena e una vuota.
`109-privilegi-e-certificati.sql` prova che TRUNCATE, TRIGGER e REFERENCES non restino ad `anon` e `authenticated` (nemmeno sulle tabelle nuove) e che un iscritto tenga in attesa al più 3 file del certificato;
`111-iscrizione-troppo-grande.sql` prova che `invia_iscrizione` rifiuti subito una richiesta da 5 MB, senza leggerla.
`update-con-where.sql` prova che nessuna funzione di `public` faccia un UPDATE o un DELETE senza WHERE (su Supabase `safeupdate` lo rifiuta con 21000, e il Postgres delle prove no); un `on conflict … do update` va bene.
`carta.sql` prova la carta nel modulo di iscrizione (`115-carta.sql`): l'importo dal listino, un solo pagamento vivo per scelta, persona e circuito (dopo 30 minuti uno nuovo), l'ordine PayPal scritto una volta, l'esito che non torna indietro, le funzioni solo per la Edge Function, `invia_iscrizione`, la ricevuta e il pagamento a mano col metodo «Carta», e che Satispay e carta non si scambino i soldi.
`certificati.sql` prova che certificati, documento e pagamenti li veda e li
cambi solo la segreteria, che il file del certificato stia in un contenitore
privato (foto e PDF, 10 MB) che apre solo lei, che un file nuovo prenda il
posto del vecchio con la data in un passaggio solo, e che si cancelli da sé 30
giorni dopo la scadenza e con la persona disattivata; `timer.sql` prova il timer:
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
straordinaria lontana non lo fermi; `date-corsi.sql` prova SALVA LE DATE: la
segreteria toglie le lezioni da domani in poi rimaste fuori dalle date, tranne
quelle con l'appello o una prova, e gli altri no; `presenze-istruttori.sql`, dopo
`tablet.sql`, prova la presenza degli istruttori dal PIN: confermata da sola a
chi era previsto (anche da sostituto), da confermare agli altri, e confermata
o rifiutata solo dalla segreteria, e una rifiutata eliminata solo da lei (`65-elimina-presenza-rifiutata.sql`); `cambia-voce.sql`, dopo `finto-supabase.sql`, prova il cambio di voce (`67-cambia-voce.sql`): solo l'amministrazione, un lotto tutto o niente, i rifiuti (annullati, giroconti, differenza di una chiusura, voce spenta o di un altro tipo), la voce che cambia anche in un giorno chiuso senza muovere la chiusura, la traccia e che l'import rilanciato non la disfa; `movimenti-persona.sql`, dopo `finto-supabase.sql`, prova il collegamento dei movimenti alle persone (`70-movimenti-persona.sql`): solo l'amministrazione (e `storico_persona` anche la segreteria), i numeri del riepilogo, il blocco dei casi sicuri a lotti e il rilancio senza doppioni, gli omonimi a mano, TOGLI QUESTO LOTTO, i rifiuti tutto o niente, i giorni chiusi, la traccia che non si scrive da fuori, l'unione di due schede e la persona eliminata, l'apostrofo in fondo alla parola che vale accento («NICOLO'» = «Nicolò», ma «D'Amico» e «Sant' Anna» restano), con le somme di saldi, voci, mesi, previsto e chiusure sempre uguali; `pagato-vecchio-programma.sql`, dopo `finto-supabase.sql`, prova `incassi_vecchio_programma()` (`71-pagato-vecchio-programma.sql`): solo la segreteria, gli incassi dello storico della stagione (i confini del 1 agosto e del 31 luglio), i non collegati, niente di annullato, di uscita o scritto a mano, e che non scrive niente; `movimenti-dalla-chat.sql`, dopo `finto-supabase.sql`, prova le registrazioni dalla chat (`72-movimenti-dalla-chat.sql`): solo l'amministrazione, la stessa chiave che scrive una volta sola, il segno e l'autore, i rifiuti di `registra_movimento` più gli incassi degli iscritti, e `movimenti_simili` senza annullati, persone, voci di sistema né autori; `satispay.sql`, dopo `finto-supabase.sql`, prova il pagamento con Satispay (`73-satispay.sql`): l'importo dal listino solo nei casi semplici, un pagamento vivo per richiesta, l'esito che non torna indietro, le funzioni solo per la Edge Function, la tabella che nessuno scrive, il pagamento che resta se la richiesta se ne va o la ricevuta si annulla, ed `emetti_ricevuta_satispay` una volta sola e con l'importo esatto; `provenienza-richieste.sql`, dopo `finto-supabase.sql`, prova da dove arrivano le richieste (`74-provenienza-richieste.sql`): l'etichetta del link e la risposta pulite o scartate senza fermare la richiesta (91 caratteri, codice, barre, formule, numeri, elenchi, scelte inventate), il vincolo per chi scrive a mano, che solo la segreteria le legge, i conteggi senza dati personali che nessuno scrive dall'app, per persona e per stato, l'eliminata da nuova che non conta più e l'accolta o rifiutata eliminata che resta, il giorno che segue la data della richiesta, e il file rilanciato; `solleciti.sql`, dopo `finto-supabase.sql`, prova i solleciti su WhatsApp (`85-solleciti.sql`): solo la segreteria segna e legge, la tabella chiusa a tutti (anche alla segreteria, che passa dalle funzioni), chi ha premuto scritto dal server, l'ultimo col nome, la scheda disattivata o che non c'è rifiutata, e il sollecito che resta senza nome se la scheda di chi l'ha segnato se ne va; poi l'elenco (`87-solleciti-elenco.sql`): `ultimi_solleciti()` una riga per persona, l'ultima, e `togli_sollecito` che toglie solo l'ultimo segnato da chi è collegato da meno di 15 minuti; `avvisi-segreteria.sql`, dopo `finto-supabase.sql`, prova gli avvisi alla segreteria (`84-avvisi-segreteria.sql`): solo la segreteria legge e cambia gli indirizzi e un indirizzo sbagliato non entra, il registro e le funzioni della Edge Function chiusi agli altri, una richiesta che avvisa dopo cinque minuti e una volta sola, la famiglia mandata insieme in un avviso solo, il bonifico con o senza ricevuta senza il nome del file, il pagamento Satispay dopo la richiesta (anche con più callback) e quello senza richiesta dopo un'ora, nessun arretrato, il tetto di 50 al giorno, e mai note, codice fiscale o nascita; `ricevute-email.sql`, dopo `finto-supabase.sql`, prova la ricevuta per email (`76-ricevute-email.sql`): l'indirizzo è solo l'email di contatto della persona della ricevuta e lo legge solo la funzione del server, nessuna funzione che il browser chiama prende un indirizzo, i tentativi li registra solo il server (anche la mail partita su una ricevuta annullata nel frattempo), una riga per tentativo con l'impronta del PDF, la stessa ricevuta al più 3 volte in 24 ore, la segreteria che legge tutto, l'amministrazione solo data ed esito, istruttore, tablet, iscritto e `anon` niente, le 400 mandate al giorno di Roma col server in UTC (anche quelle delle 00:30), le annullate che non si mandano, la persona cancellata e il file rilanciato che non sposta la data; `tariffe-tecnici.sql`, dopo `finto-supabase.sql`, prova i dati e le tariffe dei tecnici (`78-tariffe-tecnici.sql`): province e IBAN scritti giusti o rifiutati, una tariffa per persona e corso fra 1 centesimo e 1.000 €, chi l'ha cambiata scritto dal server, la segreteria che legge e scrive, istruttore, amministrazione senza segreteria e `anon` niente, e le tariffe che se ne vanno col corso o con la persona; `lettere-incarico.sql`, dopo `finto-supabase.sql`, prova le lettere d'incarico (`79-lettere-incarico.sql`): la lettera fatta dalla segreteria coi dati copiati e chi l'ha fatta scritto dal server, la seconda della stessa stagione che sostituisce la prima, una sola valida anche per il superuser, i rifiuti (tariffe vuote o sbagliate, qualifica fuori elenco, date, stagione, giorni lunghi, chi non insegna), che dopo si cambia solo `firmata`, istruttore (anche il tecnico stesso), amministrazione, iscritto e `anon` niente, e il tecnico con lettere che non si elimina; `ricevute-compensi.sql`, dopo `finto-supabase.sql`, prova le ricevute dei compensi (`80-ricevute-compensi.sql`): la ricevuta fatta dalla segreteria coi dati copiati, una sola non annullata per mese, l'annullamento, i rifiuti (mese futuro o non al primo, righe sbagliate o che non tornano col calcolato, importo, motivo, qualifica, tecnico, chi non insegna), che dopo si cambia solo `firmata`, nessun altro ruolo legge o scrive, e il tecnico con ricevute che non si elimina; `manca-la-firma.sql`, dopo `tablet.sql`, prova «manca la firma» (`82-manca-la-firma.sql`): «Non c'era» segnato dalla segreteria come presenza rifiutata una volta sola, chi ha già una presenza che resta com'è, i rifiuti (fuori dai previsti, sostituito, annullata, lezione che non c'è), nessun altro ruolo, e `corsi.basta_uno` che scrive solo la segreteria; `compensi-pagati.sql`, dopo `finto-supabase.sql`, prova il pagamento dei compensi (`81-compensi-pagati.sql`): la voce di sistema, un movimento solo per più mesi con importo, cassa, persona e descrizione giusti e senza CF né IBAN, i rifiuti tutto o niente (persone diverse, annullate, già pagate, data futura o prima della cassa, giorno chiuso), la pagata che non si annulla, il movimento annullato che rimette le ricevute da pagare e si ripagano, che solo chi ha segreteria e amministrazione paga, che le colonne del pagamento non si cambiano a mano, e il file rilanciato; `compensi-extra.sql`, dopo `finto-supabase.sql`, prova la ricevuta di compenso extra (`96-compensi-extra.sql`): più extra per tecnico e mese accanto alla ricevuta del mese che resta una sola, tecnico e qualifica presi dal server, i rifiuti (importo, descrizione, mese, chi non insegna, scheda incompleta, extra scritta a mano), la modifica e l'annullamento finché non è pagata, il pagamento con la ricevuta del mese in un movimento solo col testo della extra, e che solo la segreteria la fa; `quote-persona.sql`, dopo `finto-supabase.sql`, prova la persona delle quote e dei corsi scritti a mano (`98-quote-persona.sql`): la persona obbligatoria registrando e ignorata sulle altre voci, la scheda che non c'è rifiutata, lo spostamento su una quota una riga alla volta e con la persona, lo storico che resta facoltativo e si sposta anche in blocco, il collegamento, il cambio e lo scollegamento delle righe a mano con la traccia, `storico_persona` con `a_mano`, solo l'amministrazione, e le somme di saldi e chiusure sempre uguali; `istruttori-dalle-lezioni.sql`, dopo
`presenze-istruttori.sql`, prova chi fa l'appello (confermato se previsto, da
confermare se no, la segreteria al banco no), le lezioni tenute senza
l'istruttore segnato, la scelta di chi c'era fatta solo dalla segreteria e
solo fra i previsti, da quando si propongono, e che un istruttore vede solo
quelle dove era previsto (`37-mie-ore.sql`); `istruttore-collega.sql`, dopo
`tablet.sql`, prova il collega segnato dall'appello (solo da chi insegna la
lezione, solo fra i previsti, mai se stesso, tolto solo da chi l'ha segnato) e
la segreteria che segna un previsto su una lezione già coperta; `informativa-mesi.sql` prova
che chi non ha un accesso legga i mesi delle presenze, quelli che la segreteria
ha appena salvato, e nient'altro della tabella, anche dopo aver rilanciato
`06-iscrizioni.sql`; `accessi-piu-stretti.sql` prova che sessioni e impostazioni le legga solo chi lavora (non un iscritto né un account senza scheda), che `allunga_calendario()` la chiami solo chi lavora, e che le cinque funzioni col controllo sull'utente nullo restino chiuse a `anon` anche se gli si dà il grant, mentre la segreteria e il database stesso passano; `amministrazione.sql` prova il ruolo amministrazione: vede e fa sui soldi come la segreteria, non vede le persone né le statistiche, non cambia altro delle impostazioni che il listino, e i ruoli doppi con segreteria e istruttore; `ricevute.sql` prova le ricevute: le fa e le
annulla solo la segreteria, il numero va avanti da sé e riparte ogni anno, i
conti li fa il server, e una fatta non si cambia; `anagrafiche.sql` prova
nascita, residenza e genitore degli iscritti importati: li vede e li cambia
solo la segreteria, e se ne vanno con la persona. `statistiche.sql` prova le
statistiche: i numeri di ogni lezione contati come in PRESENZE, le prove,
chi l'ha fatta, gli incassi del mese, e che le veda solo la segreteria. `segnalazioni.sql` prova le
segnalazioni: le legge e le scrive solo la segreteria, l'autore è sempre chi
scrive, si risponde solo a un filo, un messaggio non si cambia, di un filo si
cambia solo se è chiuso, e niente si cancella; gli allegati li vede e li carica la segreteria (max 3, tipi e peso del contenitore), li toglie solo chi li ha mandati lasciando la traccia, e dopo 30 giorni dalla chiusura si tolgono. `sito.sql` prova il sito: pagine, menu, footer e rinvii li tocca solo la segreteria, chi non ha accesso (o è istruttore, iscritto, tablet) vede solo il pubblicato delle pagine non nascoste e mai la bozza, il testo con codice si rifiuta, chi salva con una versione vecchia si sente dire che la pagina è cambiata, le pagine di legge e quelle nel menu non si cancellano, e un cambio di indirizzo lascia il rinvio. `sito-pezzi.sql` prova le pagine del sito a pezzi: `bozza_pezzi` la scrive solo la segreteria (creando la pagina o con `salva_bozza_pezzi_sito`, con la stessa versione e gli stessi errori di `salva_bozza_sito`, che non la tocca), un oggetto JSON troppo grande o che non è un oggetto si rifiuta, il testo con codice si rifiuta come sempre, e istruttore, iscritto, tablet e chi non ha un accesso non salvano né leggono i pezzi; `sito_pagine_pubbliche()` non li mostra. `sito-orario.sql` prova l'orario del sito dai corsi: una pagina si collega ai corsi solo dalla segreteria (con `salva_corsi_sito`, senza doppioni e nell'ordine scelto, un corso o una pagina che non ci sono si rifiutano, versione e bozza non cambiano), chi non ha un accesso legge i corsi collegati solo delle pagine pubblicate e non nascoste, `orari_aperti()` dice solo corso, giorno, ora e durata dei corsi attivi senza le ricorrenze finite, e istruttori e iscritti non collegano niente. `elimina-istruttore.sql` prova
che un istruttore lo elimini solo la segreteria, e solo se non ha corsi,
lezioni o presenze, anche cancellando la riga a mano. `unisci-doppioni.sql` prova
che due schede le unisca solo la segreteria, solo fra iscritti senza accesso
e mai con due codici fiscali diversi, che passi tutto (una presenza per
lezione, un'iscrizione per corso, le ricevute intatte, chi ha segnato le
presenze) e che un errore a metà non cambi niente. `non-doppioni.sql` prova
che le coppie «non sono doppioni» le veda, le segni e le tolga solo la
segreteria, una riga per coppia a nome di chi scrive, e che unendo due schede
le coppie passino senza fermare l'unione. `email-unica.sql` prova che l'email sia di una persona sola fra chi ha un accesso e possa ripetersi fra gli iscritti, che il primo accesso leghi per email solo il personale, e che i dati del contatto passino nel campo unico (e rilanciando il file non cambi più niente). `prove-per-nome.sql`,
dopo `prove.sql`, prova che il tablet ritrovi chi è venuto a provare solo per
nome: dalla terza lettera di una parola, al massimo venti, come la ricerca
dell'app, e non più di cento ricerche in dieci minuti e trecento al giorno.
`cerca-persone.sql`, dopo `tablet.sql`, prova che «Aggiungi chi prova» trovi anche chi è iscritto a un altro corso o non ha mai provato, con i corsi di oggi e senza telefono per nessuno; che personale e disattivati non compaiano; la soglia delle tre lettere, il tetto di ventuno e che tablet, iscritti e `anon` non la usino. `tablet-conto-prove.sql` prova che il tablet sappia quanti dei presenti sono
prove, cioè non iscritti quel giorno (chi ha provato e poi si è iscritto no,
chi ha l'iscrizione finita sì), e che nessun altro lo chieda. `vestiario.sql` prova gli ordini di vestiario: il catalogo lo salva solo la segreteria e lo legge chi non ha un accesso, aperti fino alla data compresa, i rifiuti di un ordine, il totale fatto dal catalogo, proroga e raccolta nuova, e che gli ordini li veda e li cambi solo la segreteria, che corregge le righe e scrive dal banco; con `51-vestiario-foto.sql`, che tipi, foto e tabelle delle taglie entrino solo come nomi di file del contenitore, e che il contenitore «vestiario» lo riempia e lo svuoti solo la segreteria, senza che chi non ha un accesso ne elenchi i file. `finto-supabase.sql` rifà anche le due
tabelle dello Storage che le policy dei file guardano. `presenze-finestra.sql`, dopo `tablet.sql`, prova che un istruttore tocchi le presenze (inserire, cambiare, togliere, spostare) solo da 30 minuti prima a 14 giorni dopo, con un errore chiaro e mai «0 righe» fuori finestra, anche con «Aggiungi chi prova»; che la segreteria, ruolo doppio compreso, non abbia limiti; che l'appello non accrediti l'ora dell'istruttore per una lezione futura. `pagamento-una-volta.sql` prova che un pagamento a mano non si registri se la ricevuta del suo modulo (la chiave) è già fatta e non annullata per la stessa persona, né con Satispay se dal modulo ne è arrivato uno non ancora in una ricevuta; con una chiave annullata, sconosciuta o di un altro, in contanti o con un Satispay già in ricevuta si registra, e l'istruttore resta fuori. `pagamento-diventa-ricevuta.sql` prova che FANNE LA RICEVUTA faccia la ricevuta e annulli il pagamento a mano insieme (o niente), solo con quei soldi tali e quali, con la chiave che ripetuta dà la stessa ricevuta, che annullando la ricevuta il pagamento torni senza ricevuta, che il previsto della cassa non si muova, e che chi non è segreteria o amministrazione resti fuori. `ricevuta-cassa-chiusa.sql` prova che una ricevuta, anche col Satispay, non faccia entrare contanti datati in un giorno di Cassa Contanti già chiusa (e non prenda un numero), che carta, POS e bonifico passino, che la chiave già usata dia la ricevuta già fatta, che FANNE LA RICEVUTA lasci passare solo i contanti del suo pagamento a mano, che una chiusura annullata non conti, e che `cassa_contanti_chiusa_fino()` dia la data solo a segreteria e amministrazione. `genitore-non-iscritto.sql`, dopo `nucleo.sql`, prova il genitore non iscritto (`113-genitore-non-iscritto.sql`): `aggiungi_genitore` solo dalla segreteria, il codice fiscale che manca o è già di un'altra persona che non crea niente, le regole del nucleo controllate prima di creare la scheda, il segno che se ne va quando il genitore si iscrive a un corso, e istruttore, iscritto e `anon` che non la chiamano. `gare.sql` prova le gare (`117-gare.sql`): nome e date (AL non prima di DAL), le voci più di zero, un atleta una volta sola per gara, la gara passata che non si cancella ma si annulla, `incassa_gara` una volta sola con le voci di quel momento e il pagamento diretto «Gare», l'istruttore che legge solo le gare che accompagna o dei suoi atleti e non scrive, l'iscritto che vede solo la riga sua e dei figli, `anon` fuori, e l'unione di due schede che tiene la riga pagata. `chiusure.sql` prova le chiusure (`118-chiusure.sql`): il periodo (AL non prima di DAL, un anno al massimo), il conto che non cambia niente, le lezioni annullate del giorno italiano e della sala scelta, le già annullate e le gare non toccate, le lezioni dell'orario create dopo che nascono annullate e le straordinarie no, «togli» che rimette solo quelle ancora annullate, e istruttore, iscritto e `anon` fuori. `quadratura-banca.sql` prova il saldo dell'estratto (`123-quadratura-banca.sql`): i quattro numeri che tornano al centesimo, entrate e uscite non negative, il saldo che può andare sotto zero, il mese unico e scritto `AAAA-MM`, la verifica sempre con la sua impronta, e la segreteria senza amministrazione, istruttore, iscritto e `anon` fuori.
