# Design canvas — ODS Design System

Libreria di artboard riutilizzabili per i mockup fatti con `/design` (canvas
pubblicato come Artifact). Riproduce con i valori esatti del codice i token di
`src/styles.css` e `DESIGN.md` e i componenti ricorrenti di `src/`. I valori
sono copiati a mano, non derivati: ogni file cita nel commento le righe di
`styles.css` o il `.tsx` da cui vengono.

I font sono Saira Condensed e Barlow, gli stessi dell'app. Nell'app stanno in
`public/fonts`; un canvas è un Artifact e li può caricare solo da Google Fonts
(stessi file, licenza OFL): è l'unico posto dove il progetto li chiede a
Google, e vale solo per i mockup.

## Contenuto

| File | Cosa è |
|---|---|
| `Main.dc.html` | Foundations: colori del marchio, neutri e testo (scuro e chiaro affiancati), colori dei corsi, tipografia, raggi, bordi, ombre, spaziature e misure del tocco |
| `Pagina.dc.html` | Cornice dello schermo largo: menu di segreteria (240px) + corpo, con PRESENZE come schermata d'esempio. Una schermata nuova si copia da qui |
| `PaginaTelefono.dc.html` | Cornice del telefono (390px): testata col marchio + scorrimento, con ISCRIZIONI > COSTI d'esempio. È la faccia che l'app mostra per prima |
| `PaginaSito.dc.html`, `PaginaSitoTelefono.dc.html` | Le cornici della **segreteria nel look del sito**: menu inchiostro con le icone (240px) o barra del telefono, titolo, COSA MANCA a cinque caselle e le righe di DA FARE; per una schermata nuova della segreteria si copia una di queste, non `Pagina.dc.html` |
| `TemaSito.dc.html` | Tutti i componenti della segreteria col `tema="sito"` uno accanto all'altro: la tavola da guardare per capire il look |
| `LezioneSettimana.dc.html` | La lezione nella SETTIMANA (`Tessera` di `Settimana.tsx`) col look del sito: tinta in alto, barra rossa se manca l'appello, tag in parole (`etichetteLezione.ts`) |
| `Bottone.dc.html` | `.btn`, `.sg-btn`, `.icon-btn`: principale, vai, linea, tratteggiato, pieno, rosso, pericolo (contorno e testo rossi: cancella, elimina, annulla, togli, disattiva), icona; app e segreteria; `tema="sito"` è il look del sito (appello, scelta, area iscritti: dritto, principale giallo, spento grigio), `contesto="modulo"` il modulo pubblico (spento a 0.4); `bordo="riga-campo"` per i tasti che sono scelte (i tipi di TI SERVE ALTRO?) |
| `SchedaCorso.dc.html` | `Costo` di `ds.tsx`: la scheda di un corso nel listino; col `tema="sito"` (pagina `iscrizioni/`) bianca, filo `#cfe6f4`, corso e prezzi in Big Shoulders |
| `RigaCalendario.dc.html` | La lezione nel calendario (`.lezione`): tinta, ora, kanji, conto e stato; `tema="sito"` (area istruttore, costruito): tessera bianca, tinta in una barra in alto, stato in testo col segno davanti (✕ DA CHIUDERE, ✓ FATTO, … IN CORSO), nessun tag e nessuna barra a sinistra |
| `RigaAppello.dc.html` | `.riga-appello`: presente, assente, non segnato, e la riga di una prova; `tema="sito"` (costruito): tessera bianca, barra di 4px verde/rossa, segno ✓/✕, quadratino vuoto col bordo blu per il non segnato; `lettura` per la sola lettura (la riga non si tocca, il quadratino resta) |
| `SegnoCompleanno.dc.html` | COSTRUITO (proposta in `../compleanni/`; nel look sito, che sala e istruttori hanno sempre, è bianco con testo `giallo-testo` e filo, tema `giallo` per gli altri; misure `tablet`, `tessera` 15px, `torta` sola, `telefono`): il segno «compleanno oggi», un avviso che non cambia presenze né ordine: torta a linea + COMPLEANNO su fondo `giallo` con testo `su-colore` (come `.sg-bollino`), leggibile anche senza colore; `forma` `etichetta` (misura `tablet` Saira 17px o `telefono` Inter 11px), `icona` (24px, `role="img"`, per `RigaCalendario`), `riga` («1 COMPLEANNO OGGI: Giulia R.» sotto `TestaAppello`, barra gialla a sinistra). Mai età; in sala solo «Nome C.». Per l'istruttore lo stesso segno sta su una riga sua sotto il nome di chi fa la lezione (tessera aperta del tablet, intestazione dell'appello), senza nome. Prop `compleanno` su `TabletTessera`, `TabletRigaAppello`, `RigaAppello` (sito) e `RigaCalendario` (sito) |
| `Badge.dc.html` | `.prova-marchio`, `.sg-bollino`, `.sg-tag` (neutro, rosso, giallo e verde `fatto`: PUBBLICATA nel SITO), `.sg-segno-regola` |
| `Menu.dc.html` | Il menu unico (`.sg-menu`), con l'icona davanti a ogni voce (`ICONE_MENU`) e un filetto fra i gruppi; `tema="sito"`: inchiostro, voci in parole con l'iniziale maiuscola, voce corrente gialla: le voci sono quelle delle autorizzazioni della persona (`autorizzazioni`: `segreteria`, `segreteria e amministrazione`, `amministrazione`), non di due aree. I cinque gruppi della segreteria (OGNI GIORNO, ISCRITTI E SOLDI, CORSI E ORARI, ISTRUTTORI, IL RESTO); con l'amministrazione in più I CONTI con CONTABILITÀ, e con solo l'amministrazione I CONTI e basta (CONTABILITÀ, PAGAMENTI, LISTINO), senza ricerca né link da copiare; VESTIARIO e SITO in IL RESTO, COPIA LINK ISCRIZIONI e COPIA LINK ORDINI in fondo; AIUTO e IMPOSTAZIONI col loro nome in cima al riquadro di chi è dentro (sotto i link, più basso), `impostazioni` accende IMPOSTAZIONI; `area="amministrazione"` resta come alias di `autorizzazioni="amministrazione"`; `compensi` (PROPOSTA, `../compensi-tecnici/`) aggiunge COMPENSI in ISTRUTTORI dopo PRESENZE ISTRUTTORI |
| `StrisciaGiorni.dc.html` | I sette giorni del calendario (`.striscia-giorni`); `tema="sito"` (costruito): caselle bianche, giorno scelto con contorno blu, oggi con riga gialla scura |
| `TimerAnello.dc.html` | L'anello del giro del timer (`Ring` e `DentroAnello` di `Quadrante.tsx`). Non è più nella schermata dell'allenamento, resta per il cronometro e il conto alla rovescia |
| `TimerScaletta.dc.html` | `Scaletta`: i passi dell'allenamento, il primo in corso |
| `TimerLinea.dc.html` | `LineaDelTempo`: un blocco per passo, che si colora via via |
| `BarraScelta.dc.html` | La barra dei movimenti scelti in CONTABILITÀ → MOVIMENTI (`.sg-barra-scelta`): «N SCELTI», uscite o entrate e il totale, CAMBIA VOCE e DESELEZIONA; con scelta mista SOLO LE N ENTRATE / SOLO LE N USCITE al posto di CAMBIA VOCE (`misto`); `collega` aggiunge COLLEGA A UNA PERSONA (entrate dello storico) e `scollega` SCOLLEGA (almeno uno già collegato) |
| `SceltaPersona.dc.html` | Una persona da scegliere fra due omonimi (`SchedaCandidata`, `.sg-scelta-persona`): cerchietto, cognome e nome, e sotto anno di nascita, corsi e iscrizione; `scelta` mette bordo `text` e fondo `surface-2` |
| `RigaStorico.dc.html` | Una riga del blocco «Dal vecchio programma» nella scheda di una persona (`.sg-riga-storico`): data, causale con voce e cassa sotto, importo; lo storico non si somma ai pagamenti dell'app |
| `RigaStoricoIscritto.dc.html` | COSTRUITA (`PagatoPrima.tsx`, `.sg-riga-prima`; `../filtro-storico-pagamenti/`): una riga dell'elenco ISCRITTI filtrato su «Pagato nel vecchio programma», tema sito, trasparente sul fondo azzurro con filetto `line-soft` (niente riquadro bianco): nome (bottone da 44px), bollino della quota (DA PAGARE / SCADUTA), «data · importo · voce» dell'incasso, `collegato` («incasso del genitore <nome>»), PARZIALE?, `casella` vuota / scelta (barra laterale 4px `giallo-testo`) / senza (senza: nota e «Apri la scheda ›»), `errore` per l'esito |
| `BarraSegna.dc.html` | COSTRUITA (`.sg-barra-scelta`): la barra in fondo dell'elenco filtrato, solo con almeno una scelta; look sito: bianca, bordo 2px `giallo-testo`; «N SCELTE», «Seleziona tutte», «Deseleziona» e il tasto giallo «Segna N come pagate senza ricevuta dell'app» (16px 600, non in maiuscolo); `telefono` mette il tasto a tutta larghezza |
| `DialogoSegna.dc.html` | COSTRUITA (`Conferma` in `PagatoPrima.tsx`, `.sg-dialogo`): il pannello di conferma del segnare in blocco (senza velo): «SEGNA N PERSONE», elenco con «✕ Escludi» per riga, VALE FINO AL e NOTA, la frase sulla correzione dalla scheda, Annulla e Segna |
| `Titoletto.dc.html` | `Titoletto` di `ds.tsx`: l'etichetta spaziata con la riga. Il `tema="sito"` è quello del modulo di iscrizione; con `piccolo` è il titoletto dell'app nel look del sito (appello, area iscritti): Big Shoulders 15px a 0.12em in `dim` #46606f |
| `Testata.dc.html` | `Testata` di `App.tsx`: marchio, luogo, guida e tema (misura del telefono); `istruttori` (con `tema="sito"`, costruito): la testata dell'area istruttore sul telefono, senza tasto del tema; `senzaTema` toglie il tasto del tema (pagina `iscrizioni/` e modulo, sempre chiari: nell'app il tasto è nascosto) |
| `Passi.dc.html` | `.sg-passi` di `Importa.tsx`: I FOGLI, IL CONTROLLO, NELL'APP, con quello corrente acceso |
| `FoglioLetto.dc.html` | Il riquadro (`.sg-riquadro`) di un foglio letto: nome, conto delle righe, «tutte lette» o «N saltate» |
| `CosaEntra.dc.html` | Il riquadro COSA ENTRA: `Riga` di `comune.tsx` + i conti (`.sg-cosa-entra`) + la frase sotto |
| `RigaPerRiga.dc.html` | Il riquadro RIGA PER RIGA: sommario, le righe dubbie con la loro select (`.sg-campo`) e VEDI TUTTE LE RIGHE chiuso (`.sg-spiega`) |
| `NomiNuovi.dc.html` | Il riquadro I NOMI NUOVI: gruppi di nomi con l'etichetta (`Elenco`) |
| `Resoconto.dc.html` | Il resoconto di fine import: riquadro a bordo giallo o verde, elenco monospazio e i tre tasti |
| `TestaAppello` | La testa dell'appello (`.appello-testa`): indietro, titolo con kanji, conto, TUTTI PRESENTI e AZZERA; stato `lettura` (SOLO LETTURA, senza tasti); `tema="sito"` (costruito): stato in testo col segno (non in tag), TUTTI PRESENTI giallo (il tasto principale), AZZERA a linea blu, conto in Inter 800 |
| `Riquadro` | `Riquadro`, `Etichetta`, `Cifra`, `Dettaglio` di `ds.tsx` e `.sg-riquadro`; toni normale, prova, guaio; COSTRUITO (`../quote-persona/`) `avviso` in segreteria: bordo ed etichetta `giallo-testo`, nel sito la barra gialla a sinistra (FORSE GIÀ IN PAGAMENTI del Nuovo movimento); COSTRUITO (`../paga-dall-area-iscritti/`, `PagaCorso.tsx`) il corso da pagare nell'area iscritti: `tono="prova"` con etichetta `NOME · ANNUALE|TRIMESTRE`, cifra `num cifra`, avviso e tasto PAGA N € CON SATISPAY; senza tasto (`PIÙ CORSI`) niente bordo, solo il perché |
| `RigaPersonaMovimento` | COSTRUITA (`MovimentoAperto` di `Contabilita.tsx`; `../quote-persona/`): la riga PERSONA del movimento aperto in CONTABILITÀ: nome (vuoto «Nessuna: di chi è?» rosso), «Apri la scheda ›» e, sui movimenti a mano (`aMano`), «Cambia persona» / «Collega a una persona» e «Scollega», link da 15px alti 44px |
| `Campo` | I campi del modulo e di segreteria: testo, select, area, sola lettura, scelta, spunta, con nota ed errore. Bordo `riga-campo`; con `una` la scelta è un segmento pieno, senza quadratino; `avviso` mette sotto la riga di una scelta la frase in `giallo-testo` («non è più alla stessa ora di …»); `orario` aggiunge alla riga l'orario a pezzi, coi pezzi fra asterischi in evidenza |
| `Dialogo` | Il pannello sul velo: conferma, dialogo (lezione straordinaria) e cassetto della lezione; `tema="sito"` (bianco, raggio 6px, domanda in Big Shoulders); PROPOSTA `spunta` / `spuntata` / `spuntaNota`: una casella nella conferma («Manda per email a …», `../ricevuta-email/`); la stessa in REGISTRA IL PAGAMENTO («Fai anche la ricevuta», `../pagamento-ricevuta/`), col tasto del sì che segue la spunta |
| `Avviso` | L'avviso dopo un'azione della segreteria (`useAvviso` di `comune.tsx`, `.sg-avviso`): fondo inchiostro e testo chiaro, `guaio` rosso che resta, tasto «Chiudi» o, con `azione`, la parola dell'azione e la ✕; scuro, chiaro e sito |
| `ProvaPannello` | `Prove.tsx`: CHI VIENE A PROVARE, con campi, già venuti e i due tasti |
| `CercaPersona` | La pagina «Aggiungi chi prova» (`CercaPersona.tsx`) |
| `TestataTabella` | La testata delle tabelle di segreteria (`.sg-lista-testa`, `.sg-ordina`) |
| `RigaIscritto` | La riga della tabella ISCRITTI: normale, scelta, spenta; COSTRUITO `sollecito` (`../sollecito-elenco/`): la colonna WHATSAPP coi filtri del sollecito (tasto a linea, o il perché: fisso, manca, sbagliato, tessera, vecchio) e `sollecitato` sotto; `telefono` la cella sotto la riga; COSTRUITO `proposta` (`../iscritti-elenco/`): stato dopo il nome, solo i guai in fila a pallino (al telefono ✕ e …), ✓ (`ok`) e note grigie (`nota`), righe alte uguali, icona davanti al contatto, barretta sotto 30 GIORNI, «+N» sui corsi (`piu`), `quota` divide lo stato in CERTIFICATO e QUOTA |
| `RigaPresenzaIstruttore` | La riga di PRESENZE ISTRUTTORI, con CONFERMA e RIFIUTA; `nonSegnati` (nomi separati da `\|`) mette sotto PREVISTO i link «+ Nome c’era» |
| `RigaCompenso` | PROPOSTA (`../compensi-tecnici/`): una riga di COMPENSI, look sito: nome, lezioni, ore, importo, stato con segno e parola (`stato` da-confermare, senza-tariffa con il `corso`, da-fare, da-pagare, non-torna, pagata) e sotto il perché, il tasto o il link; `firmata` falso aggiunge DA RIPORTARE FIRMATA accanto alla spunta «Firmata»; `aperta` mostra per corso ore × tariffa (`corsi`); `attese` (PROPOSTA, `../coistruttore-atteso/`) aggiunge MANCA LA FIRMA e, a riga aperta, le lezioni in due senza la sua firma con C’ERA / Non c’era; `solo-attese` è chi ha solo quelle; `solo-extra` (`../compenso-extra/`) chi nel mese ha solo ricevute extra; `telefono` la impila |
| `RigaExtra` | COSTRUITO (`../compenso-extra/`, `RigaExtra` in `Compensi.tsx`): una ricevuta di compenso extra sotto la riga del suo tecnico in COMPENSI, rientrata col filetto a sinistra: segno EXTRA, per cosa, importo, `stato` da-pagare (FATTA · DA PAGARE, Ristampa, Segna pagato, Modifica, Annulla) o pagata (PAGATA, Ristampa); `firmata` falso aggiunge DA RIPORTARE FIRMATA; `telefono` va a capo |
| `FiltriIscritti` | La barra sopra la tabella ISCRITTI: ricerca, corso, chip; `storico` aggiunge «Pagato nel vecchio programma N» dietro «Altri filtri» (PROPOSTA); `corsiScaduti` aggiunge CORSI SCADUTI accanto a DA PAGARE; COSTRUITO `conti` (`../iscritti-elenco/`): il numero sui chip |
| `CorsiPagati` | I corsi sotto la QUOTA nella scheda iscritto: «pagato fino al …», «valeva fino al …»; toni `rosso` e `giallo` per il corso scaduto o in parte, etichetta CORSI e consiglio sotto lo scaduto |
| `CercaIscritto` | La ricerca in cima al menu (⌘K o Ctrl+K la apre in una finestra al centro, `.sg-ricerca-finestra`, sul velo nero al 60%; ogni riga ha l'icona del suo tipo: `ICONE_RISULTATO`) di segreteria (campo da 216px) con l'elenco aperto, da 368px, a gruppi ISCRITTI / RICHIESTE ONLINE / CORSI / ISTRUTTORI (`gruppi` = `TITOLO:totale=nome~sotto~nota~stato\|…;…`, tre righe e «ALTRI N ›», nota in maiuscole = bollino giallo; `stato` = `parola:tono+parola:tono` a destra, impilate, o `ok` = solo ✓ verde), `tema` `sito`, riga scelta con la barra a sinistra, `leggo`, `offline` |
| `FiltroRicerca` | La riga sopra ISCRITTI, CORSI e RICHIESTE ONLINE aperti da «ALTRI N» della ricerca (`.sg-filtro-ricerca`): «Cercato «gio»: 17 trovati.» e il chip MOSTRA TUTTI |
| `SchedaPopover` | PROPOSTA «dettagli in una finestra»: il dettaglio di una pagina della segreteria (richiesta, corso, iscritto, persona, ordine) sopra l'elenco, su un velo `rgba(13,42,61,.55)`: finestra bianca di 760px con bordo `#0d2a3d` e barra in alto nella `tinta` (come `.sg-scheda`), titolo, riga sotto, ✕ e, in Richieste e Corsi, PRECEDENTE / «N DI M» / SUCCESSIVA (`passaggio`, `posizione`); `telefono` riduce PRECEDENTE e SUCCESSIVA alle frecce ‹ ›; `avviso` mette sotto la testa la striscia gialla delle modifiche non salvate; `campi` («ETICHETTA:valore\|…») il corpo, `azioni` («testo:variante\|…») il piede fisso |
| `SchedeCorso` | `Scheda` di `Corsi.tsx`: le schede DATI \| ISCRITTI in cima alla scheda di un corso (`.schede` come IL MESE \| SEGNALATE); `acceso`, `conto` n/capienza sulla scheda ISCRITTI (`tonoConto` giallo a corso pieno, rosso oltre), `daSalvare` il puntino ● giallo su DATI, `daIscrivere` su ISCRITTI, `conIscritti` falso nel corso nuovo |
| `SchedeIscritto` | La scheda iscritto a schede: le schede PERSONA \| DOCUMENTI \| QUOTA E PAGAMENTI \| CORSI sotto i timbri di `Scheda` (`Iscritti.tsx`), stesso pattern di `SchedeCorso`; `acceso`, il segno d'avviso ● + parola (`segnoDocumenti` / `segnoQuota` giallo o rosso, `parolaDocumenti` / `parolaQuota`), `inModifica` mette ● IN MODIFICA su PERSONA quando si guarda un'altra scheda, `telefono` accorcia a QUOTA (nome intero nell'`aria-label`) e fa scorrere la riga; `tema="sito"` (Big Shoulders, azzurri del sito) |
| `SchedeArea` | PROPOSTA (`../area-iscritti-tab/`): i tab della pagina dell'iscritto sul telefono (`AreaIscritti.tsx`), LEZIONI \| IN REGOLA \| NUCLEO (`voci`; NUCLEO solo per il titolare di un nucleo): stesso pattern di `SchedeIscritto`, colonne uguali da 44px, `acceso`, e il segno d'avviso ● + parola in 11px sotto il nome (`segnoSu`, `tonoSegno`, `parolaSegno`) |
| `SchedeImpostazioni` | COSTRUITA (`Regole.tsx`, `../impostazioni-riordino/`): le sette schede in cima a IMPOSTAZIONI (LA STAGIONE, LE SALE E I TABLET, LE RICEVUTE, GLI AVVISI, DATI E PRIVACY, IMPORTA, QUESTO COMPUTER), stesso pattern di `SchedeIscritto` ma vanno a capo (`.sg-schede-impostazioni`); `acceso`, `telefono` stringe a 358px; `tema="sito"`. Le stesse schede, sotto la Testa e con le frecce, in CONTABILITÀ (MOVIMENTI, BILANCIO, VOCI, CASSE) e in PRESENZE (IL MESE, SEGNALATE: il titolo resta PRESENZE) |
| `RigaIscrittoCorso` | `IscrittiDelCorso` di `Corsi.tsx` (`.sg-riga-iscritto-corso`): una riga del tab ISCRITTI di un corso: cognome, nome, ISCRITTO DAL (data lunga), segno del certificato e della quota, sempre a parole (NO CERTIFICATO, DA PAGARE, quelle di `paroleInRegola`); sotto i 780px della scheda va su due righe; `stato="fuoco"` per la riga scelta |
| `RiepilogoIscrittiCorso` | `RiepilogoCorso` di `Corsi.tsx` (da `riepilogoCorso`): la riga sopra la ricerca del tab ISCRITTI, `voci` «testo:tono» separate da «\|» (conto n/capienza, SENZA CERTIFICATO e DA PAGARE rossi, CORSO PIENO giallo, TUTTO IN REGOLA verde) |
| `Dato` | Un dato in lettura della scheda iscritto: `Campo` di `comune.tsx` con `.sg-etichetta` e `.sg-valore`; vuoto = «—» in `dim`; `codice` per il codice fiscale; `tono` giallo o rosso (proposta in `scheda-iscritto-persona/`) colora etichetta e nota di un dato che serve e manca |
| `Timbro` | Un timbro della scheda iscritto (`.sg-timbro`); `tema="sito"`: fondo bianco e raggio 6px; il quarto, `titolo="TESSERA"` (parola NO TESSERA, SCADUTA, SCADE A DICEMBRE o IN REGOLA, una riga per ente), c’è solo per chi ha un corso che chiede la tessera: la fila `.sg-timbri` passa a quattro colonne, tutte larghe uguale |
| `Stato` | COSTRUITO (`Stato` di `comune.tsx`, `.sg-stato*`; `../scheda-iscritto-schede-revisione/`): un riquadro delle schede DOCUMENTI, QUOTA E PAGAMENTI e CORSI della scheda iscritto: lo stato in grande col colore del `tono` (bordo rosso col rosso), il dettaglio `sotto`, i tasti a destra (`tasto` un chip, `pericolo` il «Togli» rosso, nell'app un `.sg-chip.sg-pericolo`); `finita` per un'iscrizione TERMINATA, tratteggiata; a 640px i tasti vanno a capo. Le parole vengono da `src/lib/schedeIscritto.ts` |
| `Sollecito` | COSTRUITO (`Sollecito.tsx`, `.sg-sollecito*`; `../sollecito-whatsapp/`): il riquadro del sollecito su WhatsApp sotto i timbri della scheda iscritto: titolo spaziato, i `motivi` («testo:tono\|…»), il messaggio come partirà, il tasto giallo «Apri WhatsApp» (link `wa.me`, l'app non manda niente) e a chi va (`chi`); `avviso` la frase gialla del numero che sembra un fisso, `ultimo` «Sollecitato il … da …»; `stato="senza-telefono"` la frase rossa e «Vai a PERSONA»; `telefono` tasto a tutta larghezza; tessera bianca con barra giallo scuro a sinistra |
| `SchedaCertificato` | PROPOSTA «certificati online»: il blocco CERTIFICATO MEDICO della scheda iscritto (`Certificato` di `Iscritti.tsx`) col file online: titolo + bollino, frase di stato, riga del file con APRI, CARICA / SOSTITUISCI e TOGLI; `stato` nessuno, valido, in_scadenza, scaduto_con_file, scaduto_senza_file, valido_senza_file, file_vecchio; `gesto` apre file + VALIDO FINO AL + un solo SALVA; `telefono` mette i tasti in colonna |
| `MenuIstruttori` | Il menu degli istruttori sullo schermo largo (`App.tsx`); `tema="sito"` (costruito): inchiostro, senza icone, voce corrente gialla, niente tasto del tema |
| `BarraTelefono` | La barra in cima al telefono con il tasto MENU (`.sg-barra-tel`); il menu aperto è `Menu`. L'area istruttore sul telefono non la usa: ha la `Testata` (`istruttori`) e la barra delle pagine in basso |
| `BarraNavigazione` | COSTRUITA (variante B): la barra in basso del telefono istruttori (CALENDARIO, TIMER, I MIEI, ORE; due voci per la segreteria che non insegna): icona a linea, etichetta, voce corrente con barra, fondo e testo; `tema="sito"`: inchiostro, Inter 12px che va a capo, voce corrente gialla. `MenuIstruttori` ha la prop `elenco` per le stesse voci a sinistra. COSTRUITA anche nell'area iscritti (LEZIONI, IN REGOLA, NUCLEO, CONTATTI, con le icone relative; `.mia-barra`, sticky in fondo). Canvas: `../lezioni-iscritto/` |
| `SchedeTimer` | Variante A scartata: le schede DA FARE / I MIEI in cima alla pagina TIMER: tasti da 52px, quella attiva con bordo, quadratino e bordo sotto spesso |
| `TimerRiga` | La riga di un timer nell'elenco (tipo, durata, nome, nota, ▶), per le sezioni CREATI DA TE e le copie; `TimerPagina` ha `conTitolo`, `conBarra`, `tutti` e `cronometro`: nella B la pagina TIMER è `conBarra` falso, `tutti="LIBRERIA"`, `cronometro` vero |
| `RigaDaFare` | Una riga di DA FARE (`.sg-dafare-riga`): numero grande rosso (`blocca`) o giallo (`presto`), titolo, frase, i primi 5 nomi col perché (`elenco`) e il tasto a linea «Vedi tutti» |
| `SegnalazioneListino` | Una riga di `Segnalazioni` in LISTINO: in rosso cosa manca a un corso («senza prezzo nel listino», «manca il prezzo del trimestre»…), col link «Va bene senza prezzo» che non va a capo; `rosso` falso per «…, va bene così» col link «Rimetti il rosso» |
| `TabletTasto` | `.tb-btn`: linea, verde, rosso, grande, quadro (look sito: verde giallo, rosso a linea, spento grigio) |
| `TabletTastiera` | I pallini e il tastierino del PIN |
| `Cifra` | Un numero grande di OGGI nel Banco (`.bn-cifra`): titolo, numero (rosso se è un guaio), frase |
| `RigaCoda` | Una riga della coda DA FARE AL BANCO (`.bn-riga`): titolo, frase, tasto; bordo rosso se blocca, giallo se aspetta |
| `BarraBanco` | La testata del Banco nel look del sito (`BarraBanco.tsx`, `.bn-alto`, `.bn-luoghi`, `.bn-voci`): inchiostro con marchio, ricerca, Link ▾, guida e chi è dentro; i cinque luoghi su bianco col corrente sottolineato; le voci del luogo su `#cfe6f4` con la corrente piena. `voce` vuota: nessuna voce accesa |
| `VoceGrande` | Una voce in grande della pagina LA PALESTRA del Banco (`banco/Palestra.tsx`, `.bn-tessera`): icona del menu, titolo Big Shoulders, la frase della pagina che apre; `stato` mette la barra gialla scura e il tag |
| `BloccoLezione` | Un blocco del tabellone sale × ore di OGGI (`.bn-blocco`): corso, ora, stato in parole; `stato` fatto, in_corso, appello_non_fatto, prossima, annullata |
| `TabletTessera` | Il nome da toccare nella lista della sala |
| `TabletFascia` | La fascia dopo un tocco: fatto, attesa, già, errore |
| `TabletTestata`, `TabletLezione`, `TabletPiede`, `TabletRigaGiornata` | La testata, la lezione aperta, il piede e la riga della giornata del tablet di sala; i componenti `Tablet*`, `Timer*`, `MieiTimerRiga` e `SchedeTimer` hanno `tema` `scuro`, `chiaro` o `sito` (predefinito: il look del sito, sempre chiaro, blu e giallo; con `sito` la testata non ha il tasto del tema) |
| `MieOreNumero`, `MieOreRiga` | I numeri e le righe di LE MIE ORE |
| `MiaLezione`, `MiaPresenza`, `MiaPresenzaPiccola` | La lezione e la riga delle presenze nell'area iscritti; `tema="sito"` com'è l'area adesso (look del sito, sempre chiara), la tinta del corso a sinistra; SEGNALA da 44px col bordo blu; `MiaPresenza` con `soloTasto`: dove si può segnalare c'è solo il tasto, senza «NON SEGNATO» |
| `MieiTimerRiga` | La riga di I MIEI TIMER, per un corso o una lezione |
| `TimerComandi`, `TimerTestata`, `TimerCella` | I comandi, la testata e la cella dell'editor del timer (`timer/src/`) |
| `GuidaTesto` | La colonna di testo della guida dentro l'app |
| `ChiSei` | La riga «NOME COGNOME · RUOLO» con ESCI (e SEGRETERIA per chi ha due aree) sopra il calendario del telefono (`ChiSei` di `Porta.tsx`); `tema="sito"` (costruito): stessa riga, Big Shoulders e #46606f dai token |
| `TabletTestataIstruttore` | `TabletTestata` col bollino blu AREA ISTRUTTORE · nome (`Tablet.tsx`) |
| `TabletSchede`, `TabletLezioneIstr` | Le schede OGGI / PER CORSO (con la tendina) e una lezione nell'elenco dell'area istruttore (`.tb-schede`, `.tb-lezione-istr`) |
| `TabletRigaAppello`, `TabletTestaAppello`, `TabletRiquadro` | La riga dell'appello del tablet (DAL TABLET, SEGNATO DOPO, PROVA), la sua testa con i tre tasti, e il riquadro LA TUA PRESENZA |
| `Arretrato` | `Arretrato` di `CalendarioScreen.tsx` (`.arretrato*`): la riga delle cose rimaste indietro sotto la lezione di adesso, in giallo (presenze segnalate) o rosso (appelli da chiudere), chiusa o aperta con le righe `primo:secondo|...`; `tema="sito"` (costruito): tessera bianca senza bordo, il tono nel colore del titolo, senza barra né segno |
| `TabletScelta` | Le scelte di TI SEI DIMENTICATO DI SEGNARTI? (`.tb-scelta`): `variante="corso"` (barra nella tinta, nome, giorni) o `"lezione"` (giorno, ora, «N su M») |
| `TabletTestaAppelloPassato` | `TabletTestaAppello` per una lezione passata: col primo tocco il tasto diventa «CONFERMA: N PRESENTI» e compare la frase gialla |
| `PassoIscrizione` | Un passo della pagina ISCRIZIONI (`.passo` di `IscrizioniScreen.tsx`): numero, titolo, frasi, IBAN e tasti |
| `Avanzamento` | `Avanzamento` di `ds.tsx` (`.avanza`): il modulo a passi in tre tappe (CHI, IL CORSO, PAGA E MANDA), ognuna coi segmenti dei suoi passi (fatti verdi, quello di adesso in `testo`) e il nome sotto (✓ verde quando è finita), poi il nome del passo da 24px; `totale` 7 adulto, 8 figlio. Il numero a schermo non c'è; a ogni cambio di passo il fuoco va qui (`tabIndex -1`) e lo screen reader legge «Passo N di N: nome» |
| `BarraPasso` | `BarraPasso` di `ds.tsx` (`.barra-passo`, sticky in fondo): cosa manca in una riga sola (`compatta`: MANCANO N, VAI A la prima voce, ▾ che apre l'elenco con `aperta`; ogni voce un tasto da 44px) o la nota verde; `totale` e `totaleRighe` mettono sopra la barra il totale della richiesta, INDIETRO da 110px e AVANTI; `tono="vai"` all'ultimo passo, `indietroChiede` per i due tocchi; `senzaAvanti` senza AVANTI né riga del mancante (IL TIPO del vestiario: `onAvanti` facoltativo) |
| `IntestaPasso` | La riga in cima ai passi del modulo a passi (`.passo-intesta`): RICHIESTA DI ISCRIZIONE, il bollino PROVA e, solo in prova e nei passi che si possono riempire, il tasto **RIEMPI** tratteggiato giallo (`.passo-riempi`); `riempi` falso a FAMIGLIA, PAGAMENTO e INVIO |
| `RigaChiama` | La riga d'aiuto in fondo a ogni passo, sopra la barra (`.passo-aiuto`): «Hai bisogno di aiuto? Chiama o scrivi.» e i tasti CHIAMA e SCRIVI (WhatsApp), nel flusso e non sticky, con un filo sopra |
| `Riepilogo` | `Riepilogo` di `ds.tsx` (`.riepilogo`): una riga per cosa col segno ✓ verde, – giallo (facoltativa non data), ! rosso o il numero, e il tasto MODIFICA o CARICA da 44px |
| `RiquadroPasso` | Il riquadro con titolo da 17px, righe `Titolo:cifra`, frasi e tasti (`Riquadro` di `ds.tsx`): PRIMA DI ISCRIVERTI, contatti, nucleo, il guaio sopra MANDA LA RICHIESTA |
| `MusicaTelefono` | la barra della musica nella pagina TIMER del telefono, su due righe (brano e volume; ⏮ ▶ ⏭ ☰ ✕); `musica` suona, pausa, ferma, errore, spenta |
| `MusicaMini` | la barra piccola della musica fuori dal TIMER, sopra la barra delle pagine: titolo, MUSICA scritto e ⏸/▶; `tema="sito"` (costruito): bianca, tasto con filo celeste |
| `SpiaCoda` | `.spia-coda` e `.spia-coda-quante`: N PRESENZE DA INVIARE, PRESENZE RIFIUTATE (`tono="guaio"`) e la frase della SOLA LETTURA nell'appello; `tema="sito"` (costruito): bianca, bordo e titolo giallo scuro (rosso con guaio), segno «… » / «✕ » |
| `TimerStriscia` | La striscia dell'allenamento in corso, visibile fuori dal TIMER (`StrisciaTimer`): PREPARATI, LAVORO, RECUPERO, RIPOSO, DEFATICAMENTO, IN PAUSA, FINITO; `tema="sito"` (costruito): fondi pieni con ▶ (LAVORO rosso scuro, RECUPERO verde scuro, RIPOSO e DEFATICAMENTO blu), bianca con riga e «… » / «✓ » per PREPARATI, IN PAUSA e FINITO |
| `TimerElenco` | La pagina TIMER dell'area istruttori com'è costruita (`HomeScreen.tsx` incorporato): STRUMENTI, I TUOI TIMER, ACCENDI LA MUSICA e la `BarraNavigazione`; `tema="sito"` (costruito): token del look, ▶ e musica blu, angoli 6px; `tema="scuro"` com'era prima. Proposta e storia in `../timer-sito/` |
| `TimerInCorso` | L'allenamento nella pagina TIMER dell'area istruttori com'è costruito (`TimerScreen.tsx`, `.tf-*`): cornice del colore della fase, fase, cifre, esercizio, AVVIA/PAUSA, INDIETRO +30″ AVANTI, SCALETTA; `stato` pronto, lavoro, recupero; `tema="sito"` (costruito): fase in una fascia piena del suo colore, AVVIA del colore della fase, bianco sopra rosso, verde e blu, inchiostro sopra il giallo, cifre inchiostro; `tema="scuro"` com'era prima |
| `MusicaYoutubeTelefono` | con YouTube il video 200×200 dentro la barra, a destra, e i comandi in una colonna accanto |
| `CaricaFile` | La riga di un file del modulo (`CaricaFile` di `ds.tsx`): SCEGLI o CAMBIA, file scelto in verde, errore |
| `CartaIntestata` | COSTRUITA (`Foglio.testata` e `Foglio.piede` di `fogliModuli.ts`; `../carta-intestata/`, variante A): la carta intestata dei PDF, A4. Mascotte, «ASD IL CENTRO JUDO» e `sottotitolo` (il nome del modulo, o ASSOCIAZIONE SPORTIVA DILETTANTISTICA per `public/moduli/carta-intestata.pdf`), filo blu che comincia con un tatami giallo, piede in tessera chiara con SEDE, CONTATTI e DATI FISCALI. La lettera d'incarico, la ricevuta del compenso, il bilancio, la chiusura di cassa e il report istruttori ci scrivono sopra (`corpo`) e con più fogli mettono `pagina` sopra il piede (`numeraPagine` di `cartaPdf.ts`). La ricevuta di un iscritto (A4 orizzontale, due copie) prende solo la testata, rimpicciolita sopra ogni copia (`../carta-intestata-documenti/`). Senza carta l'`Avviso` di segreteria è un guaio col tasto «Senza carta» |
| `TavolaFirma` | Il riquadro della firma (`TavolaFirma.tsx`): vuoto con FIRMA QUI COL DITO, o firmato |
| `FirmaSchermoIntero` | La firma a schermo intero (`FirmaSchermoIntero` in `TavolaFirma.tsx`, `.firma-intera*`): ANNULLA, nome e FATTO in cima, il riquadro con la riga a un quarto dal fondo, la frase e CANCELLA E RIFAI; `orientamento` verticale o orizzontale, `firmata` |
| `StimaCosto` | QUANTO COSTA di una persona del nucleo: righe, sconto famiglia, totale, IBAN, causale, tasti; `etichetta` e `stima` cambiano il titolo e la frase prima dell'IBAN; `tema="sito"` è quello del modulo di iscrizione |
| `CartaFamiglia` | Il passo LA FAMIGLIA del modulo a passi (`.famiglia-*`): `tipo=sconto` il riquadro −20% SCONTO FAMIGLIA a bordo verde; `tipo=carta` una carta di `carteDellaFamiglia` con titolo, frase, «In grassetto i giorni che vanno col tuo orario.», le righe (STESSA ORA, SUBITO PRIMA…) con l'orario a pezzi, risparmio in verde e il tasto tratteggiato |
| `IlPagamento` | IL PAGAMENTO del modulo pubblico (tema sito): QUANTO PAGHI e PAGHI CON (Satispay o Bonifico, con la ricevuta obbligatoria) con la frase sotto («Paghi in fondo al modulo, prima di mandare la richiesta…» con Satispay); `satispay` falso toglie la scelta e mostra `perche` |
| `RiquadroPaga` | COSTRUITO (`satispay-prima`): la sezione PAGA in fondo al modulo pubblico con Satispay, da `statoRiquadroPaga`: riquadro col bordo che dice com'è andata (blu, verde, giallo-testo, rosso-testo), cifra coi centesimi, «Quota associativa e …», la frase e il tasto giallo (PAGA … CON SATISPAY link già pronto, MANDA LA RICHIESTA, RIPROVA CON SATISPAY, CHIAMA LA SEGRETERIA); `stato` = manca, prepara, paga, pagato, non-andato, non-vale |
| `TitoloEsito` | `TitoloEsito` di `ds.tsx` con le frasi `.esito-testo`: RICHIESTA ARRIVATA e MANCA QUALCHE FILE |
| `MembroNucleo` | Una persona del nucleo (`.mio-membro`): IN REGOLA, DA SISTEMARE, in attesa o rifiutata |
| `RigaNucleoPagamento` | Una riga di PAGAMENTI DEL NUCLEO, con la variante «Tutto il nucleo» |
| `NastroProva` | Il nastro giallo di prova (`.nastro-prova`, `NastroProva` di `ds.tsx`): area iscritti, sala e pagina Iscrizioni; `esci` aggiunge ESCI DALLA PROVA; `tema="sito"` è il nastro nel look del sito (13px, 800, 0.08em) |
| `MiaChip` | `.mia-chip` (corso col colore) e `.mia-chip-tasto` (TU, nome di chi è nel nucleo) |
| `TabletTestataSala` | La testata completa del tablet (`Tablet.tsx`): come `TabletTestata`, più il chip del timer in corso, SI SEGNA ORA, IN ATTESA DI RETE e i bollini IMPOSTAZIONI APERTE e AREA ISTRUTTORE |
| `TabletPiedeMusica` | La barra in basso: PRESENZE / TIMER e la musica (`MusicaSala.tsx`): suona, pausa, errore, spenta; Spotify, radio, YouTube |
| `TabletListeMusica` | Il pannello LA MUSICA DELLA SALA (`.tb-liste`): filtri per categoria e liste accese o spente |
| `TabletTimerCard` | La scheda di un timer nella lista del timer, col solo tasto ▶ |
| `TabletAvviso` | `Riquadro` e `Guaio` di `comune.tsx`: riquadro normale o errore rosso a tutta colonna |
| `TabletCampo` | `.tb-campo`, il campo di testo del tablet: segnaposto, valore, password, fuoco |
| `TabletPinSchermata` | La schermata del PIN (`TabletPin.tsx`) com'è nell'app: pallini a sinistra, tastierino a destra |
| `TimerAnelloAttrezzo` | L'anello di cronometro e conto alla rovescia con tre scritte a scelta (`Ring` e `DentroAnello` di `Quadrante.tsx`); `TimerAnello` ha GIRO e RESTA fissi |
| `TimerGiri` | I giri segnati del cronometro (`.crono-giri`): il più recente in cima, il più veloce in verde |
| `TimerDurate` | Le sei durate del conto alla rovescia (`.al-volo-scelte`), con quella scelta accesa |
| `TimerSegmenti` | `.segmenti` e `.livello` delle impostazioni del timer: voci, attiva, colonne, tono blu o giallo |
| `TimerInterruttore` | `Toggle` delle impostazioni del timer: nome, nota, acceso o spento |
| `TabletTendina` | La tendina CORSO aperta dell'area istruttore (`.tb-select`); il `<select>` vero è del sistema |
| `TabletProvaPannello` | `PannelloProve` con stile tablet (`Prove.tsx`): CHI VIENE A PROVARE alzato per il dito, campi su tre colonne e già venuti sotto |
| `Chiudibile` | COSTRUITA (`Presenze.tsx`, `../presenze-riorganizzata/`): la testata di una sezione lunga che si apre e si chiude (`.sg-chiudibile`, `<details>`): `titolo` spaziato col conto, `nota`, filo, ⌄ / ⌃ (`aperta`), `allarme` con la barra rossa a sinistra; in PRESENZE: APPELLI MANCANTI (aperta se ce ne sono), PROVE, REGISTRO DEL MESE (chiusi); `tema` solo sito |
| `CosaManca` | `CosaManca` di `CosaManca.tsx` (`.sg-mancano*`): la striscia COSA MANCA in cima alle pagine di segreteria, `voci` «numero\|titolo\|nota\|tono» separate da `;` (tono r manca, g da accogliere, v a posto, n non si sa; 0 è sempre ✓ verde); `colonne` 4 come oggi, 5 o 2 per le proposte |
| `Numero` | `Numero` di `Presenze.tsx` (`.sg-numero`): titolo, cifra da 44px e riga sotto; `allarme` col bordo rosso. Quattro in fila in `.sg-numeri` (PRESENZE non li ha più: rimanda a STATISTICHE), cinque in VESTIARIO (`data-cinque`). BILANCIO (`Bilancio.tsx`) usa questo stesso `Numero` per ENTRATE, USCITE e RISULTATO, tre in `.sg-numeri-tre`; `tema="sito"`: etichetta e cifra in Inter, bordo 2px #cfe6f4, senza raggio (i canvas di `bilancio-anno`, fatti prima, tengono i tre numeri inline); CONTABILITÀ → MOVIMENTI li mette in `.sg-numeri.sg-numeri-conti` (colonne `auto-fit` da 220px minimo): uno per cassa (CASSA CONTANTI, CONTO CORRENTE, SATISPAY, con «entrate … · uscite …») e TOTALE «saldi iniziali compresi» |
| `Colonne` | `Colonne` di `Statistiche.tsx` (`.sg-colonne*`): le colonne mese per mese di un valore solo, scala a sinistra (tetto, metà, 0), mese in corso tratteggiato; `mesi` «etichetta:valore\|…», `euro`, `sopra` + `dettaglio` per il suggerimento aperto; tutti a 0 «Niente da contare in questo periodo.» |
| `RiquadroStatistica` | Un riquadro di STATISTICHE nel look del sito (`Statistiche.tsx`, `.sg-riquadro` + `Riga` + `.sg-stat-tabella`): titolo spaziato col filo e la nota, una o due tabelle (`righe` «cella\|cella» separate da «;», «%74» la `Barretta`, «!» davanti la riga spenta NON SI SA, «#rrggbb!» la tinta del corso; `totale` la riga In tutto; `righe2` un secondo elenco, `affiancati`), le ↕ delle colonne che ordinano e la frase sotto. `telefono`: come il riquadro DA DOVE ARRIVANO LE RICHIESTE sul telefono (`.sg-da-dove`), righe a due piani invece dello scorrimento di lato; nell'app NON SI SA compare solo se c'è almeno una richiesta senza. `mesi` (con `euro`, `sopra`, `dettaglio`): il riquadro «mese per mese» (PRESENZE, ISCRITTI, PROVE, INCASSI) con `Colonne` al posto delle tabelle; `somma`/`sommaDopo` la riga di INCASSI sopra le colonne (`../sito-in-statistiche/`) |
| `RiquadroFila` | COSTRUITO (`Fila` in `StatisticheSito.tsx`, `.sg-fila-*`; `../fila-sito/`): DAL SITO ALLE RICHIESTE sopra IL SITO: quattro gradini (visite, tocchi su Iscriviti, richieste dal sito, accolte) in tessere del colore del fondo, fra l'uno e l'altro la freccia e la percentuale (`meno dell'1%`, `—`, oltre il 100% senza troncare); le frasi in fascia azzurra (`dal`, `corso`, `prova`, e quella delle richieste più dei tocchi); `guaioSito` (il titolo di `TESTI_GUAI`) toglie i gradini 1–2, `guaioRichieste` i gradini 3–4; `telefono` uno sotto l'altro |
| `RiquadroSito` | COSTRUITO (`StatisticheSito.tsx`, `.sg-sito-*`; `../sito-in-statistiche/`): IL SITO in fondo a STATISTICHE: testa di `Riga`, numeri indicativi, «Letti alle» e Aggiorna (spento per un minuto: «· di nuovo fra un minuto»), le frasi in fascia azzurra senza segno (`dal`, `corso`, `prova`, `stimati`), il guaio è `Guaio` col titolo, il totale, le visite in `Colonne` e la tabella HANNO TOCCATO, LE PAGINE PIÙ LETTE e DA DOVE ARRIVANO con «Altre» e «Diretto o non si sa»; `stato` pieno, errore (le sette frasi di `TESTI_GUAI`), legge; `telefono` una colonna |
| `RigaBilancio` | `RigaVoce` di `Bilancio.tsx` (`.sg-riga-bilancio`): nome con nota, importo dell'anno, quello di prima e la differenza (cifre già scritte come `euro()`); `variante` normale, totale (filo 2px e fondo), daclassificare (barra gialla a sinistra) |
| `SaldoCassa` | Il riquadro di una cassa sotto SALDI DELLE CASSE di `Bilancio.tsx`: saldo iniziale, entrate, uscite, giroconti, saldo finale; `nonDisponibile` la frase «Saldo non disponibile» al posto delle righe; le casse sono tre (Cassa Contanti, Conto Corrente, Satispay: `nome="SATISPAY"`) |
| `MenuAzioni` | COSTRUITO (`MenuAzioni` in `comune.tsx`; `../contabilita-ritocchi/`): il menu «Altre azioni» della testata di CONTABILITÀ, lista ancorata a sinistra del tasto, voci da 44px |
| `RigaMovimento` | COSTRUITA (`Contabilita.tsx`, `.sg-riga-movimento`): la riga di MOVIMENTI con la colonna TIPO (icona e nome), senza SALDO; voce e dettaglio sotto il nome senza ripetizioni |
| `StrisciaSatispay` | NON PIÙ NELL'APP (tolta con i ritocchi di CONTABILITÀ: lo scarico sta nel menu «Altre azioni»); era COSTRUITA (`ScaricoSatispay.tsx`; `../satispay-scarico/`): sotto i numeri delle casse in MOVIMENTI, la striscia SATISPAY (ultimo scarico e «Scarica ora» a linea, o prima volta con «Guarda il primo scarico» pieno; `errore` in rosso) e, con `daDecidere` > 0, l'avviso a bordo e titolo gialli «N PAGAMENTI SATISPAY DA DECIDERE» col tasto «Guarda i N casi» |
| `PrimoScarico` | COSTRUITA (`PrimoScarico` in `ScaricoSatispay.tsx`; `../satispay-scarico/`): la pagina PRIMO SCARICO DA SATISPAY, anteprima senza scrivere: titolo, frase «Satispay ha N pagamenti del negozio», le righe col numero da 22px a sinistra (incassi, rimborsi, modulo, già in PAGAMENTI, a mano, da decidere, di prima; quelle a 0 non ci sono), nota sul cambio di cassa al 01/10/2026 e i tasti «Sì, scrivi i N movimenti» / «Non ora» |
| `DaDecidereSatispay` | COSTRUITA (`DaDecidereScheda` in `ScaricoSatispay.tsx`; `../satispay-scarico/`): un pagamento Satispay da decidere, `motivo` `giorno_chiuso` («Scrivilo oggi» / «Lascialo fuori») o `doppione` (i movimenti a mano candidati, un tasto «È «…»» per ciascuno e «Nessuno dei due: scrivilo»); `rimborso` per il segno − |
| `CommissioneGiroconto` | COSTRUITA (`NuovoGiroconto` in `Contabilita.tsx`; `../satispay-scarico/`): il blocco dentro il GIROCONTO FRA LE CASSE quando DA è Satispay, su fondo `bg`: quanto ha incassato Satispay nel periodo, quanto è arrivato in banca e la casella 24×24 spuntata «Registra N € come uscita «Commissioni bancarie»» (riga da 44px) |
| `BarraSalva` | La barra per salvare di LISTINO (`.sg-listino-salva`): frase, BUTTA I CAMBI e SALVA, bordo giallo; `guaio` la frase in rosso e SALVA spento |
| `VoceElenco` | Una voce chiusa di LISTINO > I CORSI (`.sg-voce-elenco`): nome, riga rossa se manca qualcosa, riassunto e il chip CAMBIA; `bollino` il `.sg-tag` giallo accanto al nome (SENZA TIPO nel catalogo del vestiario) |
| `RigaVestiario` | Una riga di un ordine di vestiario in segreteria (`RigheTabella` di `Vestiario.tsx`): `contesto="segreteria"`, una riga di campi sotto `TestataTabella` (`etichette` sotto i 1000px). Il `contesto` app (il riquadro RIGA N del telefono) **non è più usato**: la pagina degli ordini va a passi, con `SchedaCapo` e `RigaRiepilogoVestiario` |
| `RigaOrdineVestiario` | La riga della tabella degli ordini in VESTIARIO: chi ordina (sotto, quando e da dove è arrivato; `stessoTelefono` il bollino giallo STESSO TELEFONO), capi, telefono, DA SALDARE / SALDATO / ANNULLATO, totale (sotto, in rosso, `resto`: «mancano 7 €»); l'annullato ha il testo spento, non è trasparente |
| `RigaPagamento` | Una riga dello storico dei pagamenti (`RigaDelloStorico` e la testata della ricevuta in `StoricoIscritto`, `Ricevute.tsx`; `.sg-voce-elenco` e `.sg-pagamento` di `styles.css`): `tipo=ricevuta` la testata (N./anno, data, voci e totale, tag MANCA o ANNULLATA, PDF e ANNULLA RICEVUTA), `tipo=pagamento` un pagamento rientrato sotto la sua ricevuta, importo verde; `annullato` barra e spegne; `tag` anche più d'uno («parola:tono\|…»), `tastiSotto` i tasti su una riga loro a destra («testo:pericolo», «testo:spento») con `motivo` accanto; `tema="sito"` (tag bianchi col segno, chip Inter, raggio 6px); PROPOSTA `posta` / `postaTono`: la riga dello stato dell'invio per email (`../ricevuta-email/`) COSTRUITO (`../pagamento-diventa-ricevuta/`): sulla riga di un pagamento a mano il chip «Fanne la ricevuta» (`tasti`) e, diventato ricevuta, `annullato` col tag verde «Diventato ricevuta n. N/AAAA» (`tag="…:verde"`; nell'app sta su una riga sua sotto la voce). COSTRUITO (`StoricoPersona` di `CollegaPersona.tsx`; `../quote-persona/`): SCRITTI IN CONTABILITÀ · N nella scheda, `tipo=pagamento` con data · cassa, sotto voce · descrizione e il tag giallo «Scritto in contabilità» (`tag="Scritto in contabilità:giallo"`), importo verde mai sommato, chip «Apri in contabilità» |
| `SitoBarraProva` | PROPOSTA Home del sito sul telefono: la barra fissa in basso (sotto i 901px), fondo inchiostro, «Prova a 5 €» giallo e «Chiama» col filo bianco, due pulsanti da 56px, alta 80px |
| `SitoRigaCorso`, `SitoAncoreCorsi` | PROPOSTA Home del sito sul telefono: la scheda corso compatta (104px: foto o iniziale a sinistra, titolo, età e una frase, freccia; tono giallo/blu/inchiostro per gruppo) e la riga di ancore ai gruppi di età (chip da 48px, link veri, senza script) |
| `ChipCorso` | `.sito-corso-chip` di OrarioSito (pannello SITO > ORARIO DAI CORSI): un corso collegato alla pagina, bordo `blu`, nome, «· 2 orari» / «· 1 orario» / «· senza giorni» / «· archiviato» e la ✕ da 44px che scollega |
| `AnteprimaOrario` | `.sito-orario-righe` («Così lo vede il sito»): una riga per «giorni · fascia», in due pezzi (giorni a capo, fascia nowrap a destra), filo blu; tutte le righe uguali, col filo blu |
| `AvvisoOrario` | `.avviso-rete` di OrarioSito con `role="alert"`: «! » + titolo in maiuscolo giallo-testo, frase, «Mai orari vecchi…» e i tasti linea «Apri il corso in CORSI ›» / «Apri l'elenco di CORSI ›» (corso senza giorni, finito o archiviato) |
| `CampoSpento` | `.sg-campo.sito-spento`: il campo che non si scrive più perché la pagina è collegata («ORARIO SUL SITO»: «Ora vale CORSI · …»); pieno, non tratteggiato come `Campo` sola lettura, cursore not-allowed |
| `Chip` | `.sg-chip`: il tasto piccolo della segreteria (filtri, CAMBIA, SCHEDA); `acceso` (aria-pressed), `pieno`, `disabled`, e un numero dentro |
| `Segmenti` | `Segmenti` di `comune.tsx` (CONTABILITÀ → MOVIMENTI): una scelta fra poche che si escludono (periodo, vista) in un pezzo solo, mai le schede di una pagina (quelle sono `SchedeImpostazioni`), voci alte 44px, bordo 2px `riga-campo`, la scelta blu piena con ✓; solo `tema="sito"` |
| `FiltroMenu` | `FiltroMenu` di `comune.tsx`: un filtro fra tante scelte come tasto-menu «Nome Valore ▾» sopra un `<select>` nativo; `attivo` (fondo `line`, valore in grassetto, ✕ da 44px che toglie il filtro), `aperto` solo per la proposta (nell'app l'elenco è del browser) |
| `FiltroCasse` | `FiltroCasse` di `Contabilita.tsx`: il filtro CASSE a scelta multipla (una casella per cassa, Satispay compresa), chiuso come `FiltroMenu`; `scelte` le casse spuntate, `aperto` l'elenco sotto il tasto |
| `AnteprimaCsv` | PROPOSTA «ordini vestiario», non costruita: le prime righe di un CSV scaricato, in `.sg-mono`, col nome del file sopra. Nell'app ci sono solo i due tasti, con una frase sotto |
| `FotoCapo` | La foto di un capo o la tabella delle taglie (`Foto` di `OrdinaVestiario.tsx`, `.vestiario-foto`). Nel canvas niente immagini: l'icona a linea del tipo (`judogi`, `costume`, `felpa`, `tabella`) e il nome, su `surface-2`, alta 220px col tasto ⤢ da 44px; `tabella` alta 200px senza bordi ai lati; `stato="errore"` resta il nome (il testo alternativo); `tasto` falso senza ⤢ (foto aperta, miniatura). Un capo senza foto non ne ha: niente segnaposto |
| `SchedaCapo` | `SchedaCapo` di `OrdinaVestiario.tsx` (`.vestiario-scheda`): un capo nella pagina del tipo: foto, nome, prezzo da 26px, nota, TAGLIA e QUANTI («—» finché non c'è la taglia); con `taglia` il bordo verde e il conto; `foto` foto, errore o nessuna (la scheda comincia dal nome) |
| `RigaRiepilogoVestiario` | `RigaRiepilogo` di `OrdinaVestiario.tsx`: una riga di IL RIEPILOGO: il capo, «Togli» (almeno 44×44px), TAGLIA e QUANTI da cambiare lì, il conto; `guaio` sotto TAGLIA. Per chi sta sopra, una volta per persona (`PersonaVestiario`) |
| `CaricaFoto` | `CaricaFoto` di `segreteria/Vestiario.tsx` (`.sg-carica-foto`): miniatura 96px (vuota tratteggiata: NESSUNA FOTO / NESSUNA TABELLA; `nuova` col bollino giallo NUOVA), etichetta, frase in `sec` («La foto che vede chi ordina», «nome · va sulla pagina con SALVA», «Tolta: il file si cancella con SALVA»), CARICA FOTO / CARICA LA TABELLA / SOSTITUISCI, «Togli la foto»; `cosa` FOTO o TABELLA; `avviso` giallo «Solo il capo, niente persone: la foto è pubblica» (vuoto per le tabelle) |
| `PersonaVestiario` | `Persona` di `OrdinaVestiario.tsx`: l'etichetta PER e sotto il nome in Barlow 600 17px, sopra le righe di una persona in IL RIEPILOGO; `riquadro` con `righe` («cosa:prezzo\|…») è il riquadro di TI SERVE ALTRO? |
| `SceltaTipo` | Un tipo nel passo IL TIPO (`.modulo-corso` senza spunta, bordo `riga-campo`): nome, «3 capi · dai 6 €» e ›; un tocco porta alla pagina del tipo |
| `canvas.json` | Layout del canvas: pagina "Design System" (Foundations, le due cornici) e pagina "Libreria" |
| `verifica.mjs` | Il controllo da lanciare prima di pubblicare |

Tutti i componenti hanno la prop `tema` (`scuro` | `chiaro`). `sito` è un terzo tema e ha **due usi**: il **modulo di
iscrizione** (`Campo`, `Bottone`, `Titoletto`, `CaricaFile`, `TavolaFirma`, `RiquadroPasso`, `Testata`, `SchedaCorso`: vedi «Il tema sito»)
e la **segreteria nel look del sito** (con `contesto="segreteria"` dove c'è: `Bottone`, `Campo`, `Riquadro`, `Badge`, `Chip`, `Menu`,
`BarraTelefono`, `CosaManca`, `RigaDaFare`, `RigaIscritto`, `FiltriIscritti`, `TestataTabella`; vedi «La segreteria nel look del sito»).

## Come si riusa

1. **Una schermata nuova**: si copia `Pagina.dc.html` (computer) o
   `PaginaTelefono.dc.html` (telefono) e si sostituisce il contenuto di
   `<main>`. Menu, testata, margini e sfondo restano quelli dell'app, non si
   ridisegnano. Per il tema chiaro: sfondo `#f4f4f1` e `tema="chiaro"` su
   ogni `<dc-import>`.

2. **Importare un componente**:

   ```html
   <dc-import name="Bottone" label="SEGNA LA PRESENZA" variante="vai" hint-size="220px,56px"></dc-import>
   <dc-import name="Bottone" label="SALVA" variante="pieno" contesto="segreteria" hint-size="120px,48px"></dc-import>
   <dc-import name="RigaCalendario" ora="18:30" quando="ADESSO" corso="Judo kids" sala="Sala 1" istruttore="Marco R." kanji="柔" tinta="#1b8ac4" iscritti="12" presenti="7" stato="in-corso" hint-size="100%,72px"></dc-import>
   <dc-import name="RigaAppello" nome="Rossi Giulia" stato="presente" hint-size="100%,56px"></dc-import>
   <dc-import name="SchedaCorso" corso="Judo kids" eta="Dai 6 ai 10 anni" orari="Lunedì 17:30|Sabato 10:00" prezzi="120 €|310 €|105 €" hint-size="100%,300px"></dc-import>
   <dc-import name="Badge" tipo="tag" tono="giallo" label="3" hint-size="30px,20px"></dc-import>
   <dc-import name="StrisciaGiorni" giorni="MAR 6 4 o s, MER 7 3, GIO 8 2" hint-size="100%,66px"></dc-import>
   <dc-import name="Titoletto" label="LEZIONI" conto="4" hint-size="100%,50px"></dc-import>
   <dc-import name="Menu" attiva="PRESENZE" numeri="RICHIESTE ONLINE:3" altezza="900px" hint-size="240px,900px"></dc-import>
   <dc-import name="Testata" luogo="ISTRUTTORI" hint-size="100%,72px"></dc-import>
   ```

   Le props si passano come attributi (camelCase → kebab-case: `nota-trimestre`),
   i booleani con `{{ true }}`. `hint-size` è sempre obbligatorio. Quel che non
   si vuole mostrare si passa vuoto (`kanji=""`): un attributo omesso prende il
   valore di default dell'artboard.

   - `SchedaCorso`: `orari` separati da `|`; `prezzi` a righe separate da `;` e
     celle da `|` (saldo, annuale, trimestre; senza `saldo` solo gli ultimi
     due); con `etichette` la prima cella di ogni riga è l'etichetta.
   - `StrisciaGiorni`: `NOME numero lezioni`, più `o` per oggi e `s` per il
     giorno scelto.
   - `Menu`: ha l'altezza dello schermo e, come l'app, scorre; con
     `altezza="1140px"` si vede intero.
   - `Bottone`: `alto`, `corpo`, `spazio`, `larghezza` sono gli style inline
     del codice (il ‹ del calendario: 44px, 22px, padding 0).

3. **In un nuovo canvas**: al comando `/design` si passano SEMPRE i file della
   libreria insieme alle schermate nuove (`--artboard Bottone.dc.html ...`,
   la stessa forma del Toolkit, il cui README non ne dà una più completa), e
   nel `canvas.json` vanno in una pagina "Libreria" separata. L'esempio è
   `../calendario-istruttore/`: `Main.dc.html` usa solo `<dc-import>` e la
   cornice del telefono, e il suo `canvas.json` elenca i componenti usati.

4. **Aggiornare la libreria**: si modificano i file qui, si ri-semina il canvas
   e si ripubblica sullo stesso Artifact; mai la copia pubblicata a mano. Se
   cambia un token in `src/styles.css` o `DESIGN.md`, o un componente in `src/`,
   si aggiorna il file corrispondente qui nello stesso commit.

## Il canvas unico

Libreria e sezioni (istruttore, tablet di sala, registrazione utente, importa
da Excel, timer) stanno in un solo Artifact, con tre pagine: Design System, Libreria e Archivio. L'Archivio
tiene tutti i design già fatti, ordinati per area e per riferimento, una sezione sotto l'altra col suo titolo e
un indice in cima:

```bash
node docs/design-canvas/unico.mjs <cartella>
```

Si pubblica sempre sullo stesso Artifact, «ODS Corsi · Design»:
<https://claude.ai/artifact/3Q5mhpdEkgt2K6D3RRwvm1>.

Scrive in `<cartella>/project/` i file e `canvas.json`, e `files.json` con
l'elenco da pubblicare. I file di ogni sezione prendono il prefisso della
sezione (ogni cartella ha il suo `Main`); quelli della libreria restano coi loro
nomi. Una sezione nuova si aggiunge a `SEZIONI` in `unico.mjs`.

## Controllo prima di pubblicare

```bash
node docs/design-canvas/ods-design-system/verifica.mjs
```

Senza argomenti controlla tutte le cartelle di `docs/design-canvas`; si può
passare una cartella sola. Esce con 1 se trova un colore `#rrggbb` che non sta
in `src/styles.css`, `DESIGN.md` o `COLORI` di `src/lib/segreteria.ts`, un
`<dc-import>` senza `hint-size` o verso un file che non c'è. Riconosce solo gli
esadecimali a 6 cifre: i file della libreria scrivono sempre così.

## Cosa non copre (ancora)

- Le liste musica del tablet (`.tb-liste`, `.tb-musica*`), `tb-campo`,
  `.mia-chip`; lo stato «doppione» di `CercaPersona`.
- Nella guida, titoli h3 e h4, codice e collegamenti.
- Gli stati dinamici: passaggio del mouse e fuoco da tastiera.
- I componenti nuovi sono stati scritti dal codice ma non guardati in un
  canvas: la prima volta che un mockup li usa, si controlla a occhio.

Un mockup che vuole una cosa che manca la aggiunge alla libreria come
`<Nome>.dc.html`, copiando i valori dal codice, prima di usarla.

## Il calendario dalle date

`../segreteria-tatami/TatamiCalendario.dc.html` (e `TatamiSettimana.dc.html` per il titolo che diventa un tasto con ▾) è il
riferimento del calendario della SETTIMANA (`CalendarioSettimana.tsx`, regole in `src/lib/calendarioSettimana.ts`): 460px, celle
da 52px, sei righe da sette, settimana evidenziata, oggi in giallo-testo, quadratino blu sui giorni con lezioni (assente finché non
si sa). Nell'app si aggancia sotto il tasto delle date e non esce mai dallo schermo.

## La striscia COSA MANCA

`../segreteria-tatami/TatamiMancano.dc.html` è il riferimento della striscia in cima alle pagine di segreteria
(`CosaManca.tsx`, regole in `src/lib/cosaManca.ts`): quattro caselle, numero da 64px, segno spesso sotto. Il canvas la
mostra a 1284px in una riga. Nell'app sotto i 1240px va due per due, sotto i 768px il numero sta sopra il testo, e su
uno schermo basso (fino a 800px, da 768px di larghezza) è una riga sola senza nota; sul telefono sparisce con una scheda aperta.

## L'appello a tre tasti

`../segreteria-tatami/TatamiAppello.dc.html` è il riferimento dell'appello della segreteria (`Appello` di
`Settimana.tsx`, regole in `src/lib/appelloListe.ts`): tre tasti DA SEGNARE / PRESENTI / ASSENTI, una lista sola sotto,
✓ e ✕ in DA SEGNARE. Il canvas ha sempre tutta la lista; nell'app il pannello scorre con la pagina.

## Il tema Tatami

L'app ha tre temi: nero, bianco e **Tatami** (paglia e verde muschio). I componenti di questa libreria sono
disegnati nel nero e nel bianco (`tema`). I valori del Tatami e il confronto fra i tre temi stanno in
`../segreteria-tatami/token-proposta.md` e nei componenti `Tatami*.dc.html` della stessa sezione, che hanno il `tema`
a tre valori. I token veri sono nel blocco `:root[data-tema='tatami']` di `src/styles.css` (valori finali, un po' più
scuri per giallo, verde, rosso e testo spento: vedi `DESIGN.md`). Il canvas della sezione conserva i valori della
proposta, che per quei quattro colori sono precedenti ai valori finali.

## Il tema sito (pagina `iscrizioni/` e modulo di iscrizione)

Costruito: `sito` è il tema della pagina pubblica `iscrizioni/` (`IscrizioniScreen.tsx`, sezione `../iscrizioni-pagina/`) e del **modulo di iscrizione** (`ModuloIscrizione.tsx`) nell'aspetto del sito
pubblico «tatami blu e giallo» (A2). Il modulo è sempre chiaro, qualunque sia il tema dell'app. Non è un quarto tema
dell'app: nei componenti sopra, `tema="sito"` cambia colori, **carattere** (Big Shoulders Display 800 per titoli, etichette
e tasti; Inter per testi e campi; il canvas li prende da Google Fonts, in app saranno file locali OFL) e **raggio** (6px su
campi, scelte, tasti e riquadri). Senza `tema="sito"` l'aspetto dei componenti è quello di prima.

| Cosa | Valore nel tema `sito` |
|---|---|
| Fondo, bianco, scelta scelta | #eef5fa, #ffffff, #cfe6f4 (con ✓ o ●) |
| Inchiostro, bordo dei controlli | #0d2a3d, #14709f (4,96:1 sul fondo) |
| Testo spento | #46606f (6,03:1 sul fondo, 5,15:1 su #cfe6f4) |
| Tasto principale · `vai` | inchiostro con testo bianco · giallo #f4c31b con l'inchiostro sopra |
| Stati | rosso, verde e giallo del tema chiaro, sempre con «!» o ✓ e una parola |
| Misure | tasti 56px, campi 52px, bersagli ≥ 44px; etichette Big Shoulders 15px, 0.08em |

I valori e i rapporti di contrasto calcolati stanno in `../iscrizione-sito/token-proposta.md`; i board in
`../iscrizione-sito/`. Il fuoco da tastiera (contorno 3px blu #14709f) non è riprodotto.

## La segreteria nel look del sito

COSTRUITA (PR #446, #448, #449, #451, #458, #460, #463, #470): `<html data-look="sito">` per la segreteria e l'amministrazione (`src/lib/aspettoSegreteria.ts`), con il
blocco `:root[data-look='sito']` di `src/styles.css`. Il tema è uno solo e sempre chiaro (il tasto del tema non c'è). Il design approvato sta in
`../segreteria-sito/` (`token-proposta.md`, `Proponi*.dc.html`); i componenti di questa libreria lo riproducono col `tema="sito"`.

| Cosa | Valore |
|---|---|
| Fondo, tessera, filo | #eef5fa, #ffffff, #cfe6f4 |
| Inchiostro, testo spento | #0d2a3d, #46606f |
| Blu (bordo di campi, tasti a linea e filtri; filtro acceso) | #14709f |
| Giallo del marchio | #f4c31b, **solo** il tasto principale (uno per schermata) e la voce corrente del menu |
| «Aspetta» | testo e bordo #8f6a00 su bianco, mai un riempimento giallo |
| Manca, fatto | #b81d1d (barra #e4292a), #0b7a33 |
| Caratteri | Big Shoulders Display 800 solo per titoli e cifre grandi; Inter per tutto il resto (menu, tasti, tabelle, tag, cifre di telefono e conti) |
| Forme | raggio 6px; tessere bianche senza bordo; lo stato sta in una barra di 4px a sinistra (o in alto, nella lezione) |
| Stati | tag bianco, bordo e testo dello stesso colore, segno davanti: ✕ manca, … aspetta, ✓ fatto |
| Tasti e filtri | in parole con l'iniziale maiuscola, Inter 15-16px 600, senza spaziatura; il filtro acceso è blu pieno con ✓ |

- **Menu** (`menuSegreteria.ts`): inchiostro, cinque gruppi (Ogni giorno, Iscritti e soldi, Corsi e orari, Istruttori, Il resto) con «I conti» per chi ha l'amministrazione;
  un'icona per voce e un filetto fra i gruppi. I titoli dei gruppi sono maiuscoli per stile, Inter 12px 600.
- **DA FARE** (`daFareTesti.ts`): il tasto dice il gesto («Fai gli appelli», «Chiedi i certificati»), e solo quello della prima riga è giallo.
- **ISCRITTI** (`filtriIscritti.ts`): ricerca, corso e tre filtri in vista (Senza certificato valido, Da pagare, Non in regola), poi «Altri filtri (N) ▾».
- **SETTIMANA** (`etichetteLezione.ts`): i tag della lezione sono in parole (Senza appello, Appello fatto, Manca l’istruttore, Sostituto, ✎ Cambiata a mano, Straordinaria, Annullata).
- **COSA MANCA**: cinque caselle in una riga, cifra Big Shoulders 44px, titolo Inter 14px, senza la nota.
- **Fuori dal look**: il fuoco da tastiera (contorno 3px blu, bianco nel menu) non è riprodotto. L'area degli istruttori ora è nel look (vedi sotto, «L'area istruttore nel look del sito»): la pagina TIMER ha il look anche lei (`TimerSala` con `sito`), e I MIEI e ORE ereditano i token ma non sono ridisegnati (PR 2).

## L'area istruttore nel look del sito

COSTRUITA (PR 1: menu, CALENDARIO e APPELLO; `lookDellArea('istruttori')` è `'sito'` in `src/lib/aspettoSegreteria.ts`, regole in `src/styles.css` sotto «L'area istruttore nel look del sito», parole di stato in `src/lib/etichetteAppello.ts`). TIMER ha il look (PR 3: `TimerSala` con `sito`, `temaDelTimer` dà il tema `sito` del timer, blocco `:root[data-tema='sito']` di `timer/src/styles.css`; il tablet di sala e il timer da solo non cambiano; vedi `TimerElenco` e `TimerInCorso`); I MIEI e ORE ereditano i token del look ma non sono ridisegnati (PR 2). Il design approvato sta in `../istruttore-sito/` (storia: «oggi» e proposta affiancati, e in fondo al suo README le differenze del costruito). Stessi valori della tabella «La segreteria nel look del sito»; tema unico e sempre chiaro, il tasto del tema non c'è (`senzaTema` in `Testata`, niente `TastoTema` nel menu). Col `tema="sito"` hanno il look: `MenuIstruttori`, `BarraNavigazione`, `Testata` (`istruttori`), `ChiSei`, `RigaCalendario`, `RigaAppello`, `StrisciaGiorni`, `TestaAppello`, `Arretrato`, `TimerStriscia`, `MusicaMini`, `SpiaCoda`. `Titoletto` e `BarraTelefono` non cambiano.

| Cosa | Valore (come costruito) |
|---|---|
| Stati | Sono **testo** col segno davanti, mai tag: `.num` nel look è Inter. ✕ DA CHIUDERE rosso #b81d1d, ✓ FATTO verde #0b7a33, … NESSUN PRESENTE giallo scuro, … IN CORSO e ISCRITTI spenti (#46606f); nell'appello … N DA SEGNARE e … SOLO LETTURA in inchiostro, ✓ TUTTI SEGNATI verde, ✕ TUTTI ASSENTI rosso, CHIUDI IN FONDO ↓ verde e sottolineato; +N PROVA, … N DA INVIARE e … NON ANCORA COMINCIATA giallo scuro |
| Lezione nel calendario | tessera bianca, raggio 6px, tinta del corso in una barra di 4px in alto; nome Big Shoulders 800 19px; ora, conto e stato Inter; nessuna barra a sinistra per DA CHIUDERE; la colonna di destra non si stringe (margine 8px, al massimo 45%, stato che va a capo) e i nomi vanno a capo; la lezione aperta ha il contorno blu #14709f da 2px |
| `SpiaCoda` | `.spia-coda`: N PRESENZE DA INVIARE, PRESENZE RIFIUTATE e la frase della SOLA LETTURA. Bianca, bordo e titolo #8f6a00 (mai riempimento giallo; rosso #b81d1d con `tono="guaio"`), segno «… » / «✕ »; la frase 14px #46606f |
| Testa dell'appello | fondo #eef5fa, margini di 20px; titolo Big Shoulders 800 26px; conto Inter 800 52px, che non va a capo; il sottotitolo (giorno, ora, sala) va a capo invece di tagliarsi; «?», indietro, timer e frecce della settimana con bordo 2px blu #14709f |
| Tasto principale dell'appello | TUTTI PRESENTI / GLI ALTRI PRESENTI giallo #f4c31b con l'inchiostro, raggio 6px, Big Shoulders 700 17px, 0.1em; spento: bianco con testo e bordo 2px verde #0b7a33 per ✓ TUTTI SEGNATI, #cfe6f4 con testo #46606f per elenco vuoto. CHIUDI IN FONDO ↓ alto 44px. AZZERA: bordo 2px blu, senza raggio e senza fondo, Big Shoulders 700 16px. CHIUDI L'APPELLO resta verde o rosso (stato, non giallo) |
| Riga dell'appello | tessera bianca, barra di 4px verde o rossa, segno ✓ / ✕; non segnato = quadratino vuoto da 22px, raggio 4px, bordo blu |
| Barra in basso | inchiostro #0d2a3d, voci Inter 12px 600 senza spaziatura e che vanno a capo, la corrente gialla #f4c31b con l'inchiostro e in grassetto |
| Menu largo | inchiostro, voci Inter 15px senza icone, la corrente gialla; ODS CORSI Big Shoulders 700 |
| Striscia dell'allenamento | LAVORO fondo #b81d1d, RECUPERO #0b7a33, RIPOSO e DEFATICAMENTO blu #14709f (testo bianco, ▶ davanti); PREPARATI e IN PAUSA bianca con riga #8f6a00 e «… »; FINITO bianca con riga #0b7a33 e «✓ »; sul bianco il testo è inchiostro (la riga porta il colore). Tempo Big Shoulders 800 36px |
| Musica | barra bianca sopra la barra delle pagine, tasto ⏸/▶ con filo celeste #cfe6f4 (non blu) |
| Titoletti, `ChiSei`, `Arretrato` | senza regole proprie: Big Shoulders e `dim` dai token; `Arretrato` è una tessera bianca col tono nel colore del titolo, senza barra né segno |

## Il sito pubblico: Chi siamo

COSTRUITA (`src/lib/sitoChiSiamo.ts`, testo da incollare in `docs/sito/chi-siamo.md`): usa i pezzi della home (`SitoTestata`, `SitoPulsante`, `SitoTessera`, `SitoPerche`, `SitoCta`, `SitoPiede`); slogan, due tessere, pannello con foto e fila di foto con didascalie sono `div` con gli stessi valori, senza componente (vedi `../chi-siamo-miglioramenti/`). Differenze del costruito: i titoli delle due tessere in cima sono `h2` (non `h3`, per non saltare un livello dopo l'`h1`); il pannello con foto è scuro il primo e giallo il secondo, per posizione e non per pulsante; il fuoco delle foto segue il riquadro (slogan, pannelli, quarta della fila), non il file.

## Il sito pubblico: i pezzi della home

COSTRUITA nella Home del sito (`src/lib/sitoHome.ts`, regole in `src/lib/sitoGenera.ts`, testo da incollare in `docs/sito/home.md`): la testata (due pulsanti, tasto MENU sul telefono) e il piede valgono per tutte le pagine; le altre pagine potranno chiedere gli stessi pezzi. Differenze del costruito: nel menu aperto sul telefono il pulsante di prova è la prima voce; il fuoco delle foto delle schede segue il corso (`FOCI_SCHEDE`), non il file; la voce attiva del menu ha il fondo giallo. I componenti `Sito*` riproducono nell'aspetto del sito (Big Shoulders Display + Inter, colori A2 di
`../sito-approvato/token-proposta.md`) i pezzi della home proposta in `../home-miglioramenti/`. Non hanno la prop `tema`: sono già
del sito. `piccolo` li porta alla misura del telefono (375px). `nota="DA CONFERMARE …"` li marca con contorno rosso e cartellino.

| File | Cosa è |
|---|---|
| `SitoTestata.dc.html` | COSTRUITA (`testata()` di `sitoGenera.ts`): marchio, voci da 48px (la corrente è una pillola gialla, Contatti è una voce come le altre), «Iscriviti» pieno e giallo, e con `conAccedi` «Accedi» a linea accanto (`../sito-accedi/`; sul telefono in fondo al menu); sul telefono marchio + MENU. `conScrivici` e `conVoceContatti` mostrano com'era prima (`../senza-scrivici/`) |
| `SitoPulsante.dc.html` | Il pulsante del sito (giallo, inchiostro, linea), minimo 48px |
| `SitoTessera.dc.html` | Una tessera numero (`35+`, `300+`…), tutte alte uguali |
| `SitoTitolo.dc.html` | Titolo di sezione a 72-88px (56px sul telefono) con la frase d'apertura |
| `SitoSchedaCorso.dc.html` | La scheda corso con foto (fuoco `object-position`), freccia e pastiglie; senza foto, fascia azzurra con l'iniziale |
| `SitoPerche.dc.html` | Le quattro tessere di «Perché unirti a noi?», con titolo e riga di testo |
| `SitoCitazione.dc.html` | La citazione di un esperto: estratto + «Leggi tutto», avatar con una sola iniziale |
| `SitoRecensione.dc.html` | Una recensione per intero, carta larga |
| `SitoInBreve.dc.html` | La carta «In breve» con le recensioni da 7 parole |
| `SitoDomanda.dc.html` | Una domanda delle FAQ |
| `PannelloPuck.dc.html` | COSTRUITO (`EditorPuck.tsx`, `../sito-pulsanti-domande/`, `../sito-solo-puck/`): il pannello di destra dell'editor delle pagine (l'unico, con l'aspetto e i colori di Puck: `--puck-color-*`, sempre chiaro); `parte="pagina"` i campi della pagina (titolo e descrizione col conteggio, rosso e a parole oltre il limite; indirizzo; orario dai corsi; Dividi in parti; Nascondi e Cancella coi tasti di Puck da 44px); con la parte PULSANTI (`parte="pulsanti"`: da 1 a 3, DOVE PORTA, pagina pubblicata da scegliere, testo; il modulo è sempre «Iscriviti») o DOMANDE (`parte="domande"`: titolo vuoto = «Domande frequenti», domanda senza «?» con bordo e avviso `giallo-testo`, risposta senza titoli). Sul sito la fila è `SitoPulsante` giallo per primo e gli altri `linea`, le domande `SitoDomanda` |
| `SitoCta.dc.html` | La chiamata finale a due colonne con pulsante pieno (`alt` della foto come prop) |
| `SitoInvito.dc.html` | COSTRUITO (`invito()` di `sitoGenera.ts`, `.invito*`; `../invito-iscriviti/` e i commenti sul canvas del 21 ottobre): l'invito giallo in fondo alle pagine. In alto titolo (88px) a sinistra, frase sulle prove (3 € / 10 €, «€» con lo spazio indivisibile) e il link «Guarda gli orari» (48px, `conOrari`: c'è la pagina Orari e non è lei) a destra; sotto quattro riquadri in fila (due fra 901 e 1200px, uno sotto l'altro sul telefono), ognuno con etichetta, valore in Big Shoulders, nota e lo stesso pulsante pieno da 52px: ISCRIVITI per primo, l'unico inchiostro col pulsante giallo, poi CHIAMA, SCRIVICI e VIENI A TROVARCI bianchi col pulsante inchiostro. La parte ISCRIVITI degli editor a pezzi ne cambia solo titolo e frase (vuoti = di sempre); `piccolo` il telefono |
| `SitoPiede.dc.html` | Il piede, link da 48px |
| `SitoRecapito.dc.html` | Un recapito (telefono, Instagram, Facebook, indirizzo) come tessera intera con azione da 48px; il cartellino «DA CONFERMARE» sta sopra il titolo |
| `SitoMappa.dc.html` | La mappa OpenStreetMap con segnaposto, targhetta e pulsante «Ottieni indicazioni» da 56px; `width`/`height` dichiarati |
| `SitoArrivo.dc.html` | Una riga di «Come arrivare» (metro, auto, navigatore): sigla da 48px, titolo e frase |
| `SitoRitratto.dc.html` | Il ritratto dell'elenco Istruttori: foto quadrata (fuoco `object-position`), nome, cognome, corsi in pastiglie; tutti alti uguali; senza foto, fascia azzurra con l'iniziale; telefono (`piccolo`): foto a sinistra e corsi su due righe |
| `SitoDatoPersona.dc.html` | Una tessera Ruolo / Corsi / Quando / Titoli della scheda di un istruttore, tutte alte uguali (9-10 parole); il cartellino «DA CONFERMARE» sta a cavallo del bordo alto |
| `SitoBloccoPersona.dc.html` | Un blocco di testo della scheda (Chi è / Come ha iniziato / A scuola), 25-36 parole |
| `SitoElencoPercorso.dc.html` | Una colonna di «Il percorso» (Federazione e sport / Scuola / Titoli e studi) con elenco puntato |

Costruito (`src/lib/sitoIstruttori.ts`): il ritratto dell'elenco è come `SitoRitratto` (484 px alto, nome 48, cognome 20, freccia ↗ da 48 solo se la scheda è pubblicata); la tessera d'invito che completa la riga di quattro è nera con titolo da 96 px; la scheda scarna ha l'invito giallo di fondo pagina, non la tessera nera.

## La pagina del corso (proposta)

PROPOSTA, non costruita: i pezzi nuovi della pagina di un corso in `../corso-miglioramenti/`. Gli altri pezzi sono quelli della home (`SitoDatoPersona` per i quattro dati, `SitoBloccoPersona` per i testi, `SitoPerche`, `SitoPiede`).

| File | Cosa è |
|---|---|
| `SitoCorsoTitolo.dc.html` | La testata: nome a 160px (92px sul telefono), descrizione di 12-14 parole e pulsante di prova da 60px |
| `SitoOrarioGruppo.dc.html` | Una tessera dell'orario (nome, ora, giorni, anni di nascita), tutte alte uguali nella riga |
| `SitoCorsoFascia.dc.html` | L'apertura di un corso senza foto: tre fatti (giorno, ora, per chi) su blu, al posto della foto |
| `SitoCorsoCta.dc.html` | La chiamata finale della pagina corso: come `SitoCta`, con `alt` della foto come prop e `senzaFoto` (una colonna, testo a sinistra e pulsanti a destra in basso) |
| `SitoPiedeContatti.dc.html` | Il piede di `SitoPiede` con telefono, Instagram e Facebook nella colonna dell'indirizzo, come in Contatti |
| `SitoOrarioGiorno.dc.html` | PROPOSTA pagina Orari (`../orari-sito/`): un giorno dell'orario tipo, tessera `#cfe6f4` con il giorno in Big Shoulders e una riga per lezione (`voci` = «ora\|corso» separate da «;»); schermo largo ora sopra e nome sotto, telefono (`piccolo`) ora a sinistra; il nome va a capo, mai tagliato. `SitoTestata` e `SitoPiede` hanno `conOrari` (voce «Orari» fra «I nostri corsi» e «Chi siamo») |

## Orario dai corsi (pannello SITO)

COSTRUITA (`src/components/segreteria/OrarioSito.tsx`, regole `.sito-*` in `src/styles.css`; la storia della proposta sta in `../orario-automatico/`).
Sezione propria «ORARIO DAI CORSI» (`Titoletto`) sotto l'indirizzo, solo per le pagine non di legge: avviso (se serve), `Campo` «COLLEGATA AL CORSO» (da 2 corsi «COLLEGATA AI CORSI») con
i `ChipCorso` e la tendina «Scegli un corso» / «+ Un altro corso», poi `CampoSpento`, la frase «Viene dai corsi. L'orario scritto a mano resta salvato nella pagina…», `AnteprimaOrario`,
«Si aggiorna da solo… entro 5 minuti» e «Controlla a mano: l'età e il testo». Nella testa della pagina il bollino «Collegata a N corsi» è `Badge` `tipo="tag"` `tono="verde"` (`.sg-tag[data-tipo='fatto']`, con ✓ nel look sito), accanto allo stato.
Differenze dalla proposta approvata: righe dell'anteprima col filo a sinistra su fondo `surface-2` (non tinte piene); chip quadrati col bordo `blu`; avviso con «!» invece di un'icona.
