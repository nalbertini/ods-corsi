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
| `Bottone.dc.html` | `.btn`, `.sg-btn`, `.icon-btn`: principale, vai, linea, tratteggiato, pieno, rosso, icona; app e segreteria |
| `SchedaCorso.dc.html` | `Costo` di `ds.tsx`: la scheda di un corso nel listino |
| `RigaCalendario.dc.html` | La lezione nel calendario (`.lezione`): tinta, ora, kanji, conto e stato |
| `RigaAppello.dc.html` | `.riga-appello`: presente, assente, non segnato, e la riga di una prova |
| `Badge.dc.html` | `.prova-marchio`, `.sg-bollino`, `.sg-tag`, `.sg-segno-regola` |
| `Menu.dc.html` | Il menu di segreteria (`.sg-menu`); `impostazioni` accende il tasto coi cursori |
| `StrisciaGiorni.dc.html` | I sette giorni del calendario (`.striscia-giorni`) |
| `TimerAnello.dc.html` | L'anello del giro del timer (`Ring` e `DentroAnello` di `Quadrante.tsx`). Non è più nella schermata dell'allenamento, resta per il cronometro e il conto alla rovescia |
| `TimerScaletta.dc.html` | `Scaletta`: i passi dell'allenamento, il primo in corso |
| `TimerLinea.dc.html` | `LineaDelTempo`: un blocco per passo, che si colora via via |
| `Titoletto.dc.html` | `Titoletto` di `ds.tsx`: l'etichetta spaziata con la riga |
| `Testata.dc.html` | `Testata` di `App.tsx`: marchio, luogo, guida e tema (misura del telefono) |
| `Passi.dc.html` | `.sg-passi` di `Importa.tsx`: I FOGLI, IL CONTROLLO, NELL'APP, con quello corrente acceso |
| `FoglioLetto.dc.html` | Il riquadro (`.sg-riquadro`) di un foglio letto: nome, conto delle righe, «tutte lette» o «N saltate» |
| `CosaEntra.dc.html` | Il riquadro COSA ENTRA: `Riga` di `comune.tsx` + i conti (`.sg-cosa-entra`) + la frase sotto |
| `RigaPerRiga.dc.html` | Il riquadro RIGA PER RIGA: sommario, le righe dubbie con la loro select (`.sg-campo`) e VEDI TUTTE LE RIGHE chiuso (`.sg-spiega`) |
| `NomiNuovi.dc.html` | Il riquadro I NOMI NUOVI: gruppi di nomi con l'etichetta (`Elenco`) |
| `Resoconto.dc.html` | Il resoconto di fine import: riquadro a bordo giallo o verde, elenco monospazio e i tre tasti |
| `TestaAppello` | La testa dell'appello (`.appello-testa`): indietro, titolo con kanji, conto, TUTTI PRESENTI e AZZERA |
| `Riquadro` | `Riquadro`, `Etichetta`, `Cifra`, `Dettaglio` di `ds.tsx` e `.sg-riquadro`; toni normale, prova, guaio |
| `Campo` | I campi del modulo e di segreteria: testo, select, area, sola lettura, scelta, spunta, con nota ed errore. Bordo `riga-campo`; con `una` la scelta è un segmento pieno, senza quadratino |
| `Dialogo` | Il pannello sul velo: conferma, dialogo (lezione straordinaria) e cassetto della lezione |
| `ProvaPannello` | `Prove.tsx`: CHI VIENE A PROVARE, con campi, già venuti e i due tasti |
| `CercaPersona` | La pagina «Aggiungi chi prova» (`CercaPersona.tsx`) |
| `TestataTabella` | La testata delle tabelle di segreteria (`.sg-lista-testa`, `.sg-ordina`) |
| `RigaIscritto` | La riga della tabella ISCRITTI: normale, scelta, spenta |
| `RigaPresenzaIstruttore` | La riga di PRESENZE ISTRUTTORI, con CONFERMA e RIFIUTA; `nonSegnati` (nomi separati da `\|`) mette sotto PREVISTO i link «+ Nome c’era» |
| `FiltriIscritti` | La barra sopra la tabella ISCRITTI: ricerca, corso, chip |
| `CercaIscritto` | La ricerca in cima al menu di segreteria, anche con l'elenco aperto |
| `Timbro` | Un timbro della scheda iscritto (`.sg-timbro`) |
| `SchedaCertificato` | PROPOSTA «certificati online»: il blocco CERTIFICATO MEDICO della scheda iscritto (`Certificato` di `Iscritti.tsx`) col file online: titolo + bollino, frase di stato, riga del file con APRI, CARICA / SOSTITUISCI e TOGLI; `stato` nessuno, valido, in_scadenza, scaduto_con_file, scaduto_senza_file, valido_senza_file, file_vecchio; `gesto` apre file + VALIDO FINO AL + un solo SALVA; `telefono` mette i tasti in colonna |
| `MenuIstruttori` | Il menu degli istruttori sullo schermo largo (`App.tsx`) |
| `BarraTelefono` | La barra in cima al telefono con il tasto MENU (`.sg-barra-tel`); il menu aperto è `Menu` |
| `BarraNavigazione` | PROPOSTA, scelta la variante B: la barra in basso del telefono istruttori (CALENDARIO, TIMER, I MIEI, ORE; due voci per la segreteria che non insegna): icona a linea, etichetta, voce corrente con barra, fondo e testo. `MenuIstruttori` ha la prop `elenco` per le stesse voci a sinistra |
| `SchedeTimer` | Variante A scartata: le schede DA FARE / I MIEI in cima alla pagina TIMER: tasti da 52px, quella attiva con bordo, quadratino e bordo sotto spesso |
| `TimerRiga` | La riga di un timer nell'elenco (tipo, durata, nome, nota, ▶), per le sezioni CREATI DA TE e le copie; `TimerPagina` ha `conTitolo`, `conBarra`, `tutti` e `cronometro`: nella B la pagina TIMER è `conBarra` falso, `tutti="LIBRERIA"`, `cronometro` vero |
| `RigaDaFare` | Una riga di DA FARE (`.sg-dafare-riga`): numero grande rosso (`blocca`) o giallo (`presto`), titolo, frase e tasto VEDI CHI |
| `TabletTasto` | `.tb-btn`: linea, verde, rosso, grande, quadro |
| `TabletTastiera` | I pallini e il tastierino del PIN |
| `TabletTessera` | Il nome da toccare nella lista della sala |
| `TabletFascia` | La fascia dopo un tocco: fatto, attesa, già, errore |
| `TabletTestata`, `TabletLezione`, `TabletPiede`, `TabletRigaGiornata` | La testata, la lezione aperta, il piede e la riga della giornata del tablet di sala |
| `MieOreNumero`, `MieOreRiga` | I numeri e le righe di LE MIE ORE |
| `MiaLezione`, `MiaPresenza` | La lezione e la riga delle presenze nell'area iscritti |
| `MieiTimerRiga` | La riga di I MIEI TIMER, per un corso o una lezione |
| `TimerComandi`, `TimerTestata`, `TimerCella` | I comandi, la testata e la cella dell'editor del timer (`timer/src/`) |
| `GuidaTesto` | La colonna di testo della guida dentro l'app |
| `ChiSei` | La riga «NOME COGNOME · RUOLO» con ESCI (e SEGRETERIA per chi ha due aree) sopra il calendario del telefono (`ChiSei` di `Porta.tsx`) |
| `TabletTestataIstruttore` | `TabletTestata` col bollino blu AREA ISTRUTTORE · nome (`Tablet.tsx`) |
| `TabletSchede`, `TabletLezioneIstr` | Le schede OGGI / PER CORSO (con la tendina) e una lezione nell'elenco dell'area istruttore (`.tb-schede`, `.tb-lezione-istr`) |
| `TabletRigaAppello`, `TabletTestaAppello`, `TabletRiquadro` | La riga dell'appello del tablet (DAL TABLET, SEGNATO DOPO, PROVA), la sua testa con i tre tasti, e il riquadro LA TUA PRESENZA |
| `Arretrato` | `Arretrato` di `CalendarioScreen.tsx` (`.arretrato*`): la riga delle cose rimaste indietro sotto la lezione di adesso, in giallo (presenze segnalate) o rosso (appelli da chiudere), chiusa o aperta con le righe `primo:secondo|...` |
| `TabletScelta` | Le scelte di TI SEI DIMENTICATO DI SEGNARTI? (`.tb-scelta`): `variante="corso"` (barra nella tinta, nome, giorni) o `"lezione"` (giorno, ora, «N su M») |
| `TabletTestaAppelloPassato` | `TabletTestaAppello` per una lezione passata: col primo tocco il tasto diventa «CONFERMA: N PRESENTI» e compare la frase gialla |
| `PassoIscrizione` | Un passo della pagina ISCRIZIONI (`.passo` di `IscrizioniScreen.tsx`): numero, titolo, frasi, IBAN e tasti |
| `Avanzamento` | `Avanzamento` di `ds.tsx` (`.avanza`): il modulo a passi, un segmento per passo (fatti verdi, quello di adesso in `testo`), il numero da 56px e «DI N» col nome del passo; a ogni cambio di passo il fuoco va qui (`tabIndex -1`) |
| `BarraPasso` | `BarraPasso` di `ds.tsx` (`.barra-passo`, sticky in fondo): cosa manca in una riga sola (`compatta`: MANCANO N, VAI A la prima voce, ▾ che apre l'elenco con `aperta`; ogni voce un tasto da 44px) o la nota verde; `totale` e `totaleRighe` mettono sopra la barra il totale della richiesta, INDIETRO da 110px e AVANTI; `tono="vai"` all'ultimo passo, `indietroChiede` per i due tocchi |
| `RigaChiama` | La riga CHIAMA sotto l'avanzamento di ogni passo (`.passo-chiama`): la frase «Un dubbio? Chiama la segreteria.» e il tasto, nel flusso e non sticky |
| `Riepilogo` | `Riepilogo` di `ds.tsx` (`.riepilogo`): una riga per cosa col segno ✓ verde, – giallo (facoltativa non data), ! rosso o il numero, e il tasto MODIFICA o CARICA da 44px |
| `RiquadroPasso` | Il riquadro con titolo da 17px, righe `Titolo:cifra`, frasi e tasti (`Riquadro` di `ds.tsx`): PRIMA DI ISCRIVERTI, contatti, nucleo, il guaio sopra MANDA LA RICHIESTA |
| `MusicaTelefono` | la barra della musica nella pagina TIMER del telefono, su due righe (brano e volume; ⏮ ▶ ⏭ ☰ ✕); `musica` suona, pausa, ferma, errore, spenta |
| `MusicaMini` | la barra piccola della musica fuori dal TIMER, sopra la barra delle pagine: titolo, MUSICA scritto e ⏸/▶ |
| `MusicaYoutubeTelefono` | con YouTube il video 200×200 dentro la barra, a destra, e i comandi in una colonna accanto |
| `CaricaFile` | La riga di un file del modulo (`CaricaFile` di `ds.tsx`): SCEGLI o CAMBIA, file scelto in verde, errore |
| `TavolaFirma` | Il riquadro della firma (`TavolaFirma.tsx`): vuoto con FIRMA QUI COL DITO, o firmato |
| `FirmaSchermoIntero` | La firma a schermo intero (`FirmaSchermoIntero` in `TavolaFirma.tsx`, `.firma-intera*`): ANNULLA, nome e FATTO in cima, il riquadro con la riga a un quarto dal fondo, la frase e CANCELLA E RIFAI; `orientamento` verticale o orizzontale, `firmata` |
| `StimaCosto` | QUANTO COSTA di una persona del nucleo: righe, sconto famiglia, totale, IBAN, causale, tasti |
| `TitoloEsito` | `TitoloEsito` di `ds.tsx` con le frasi `.esito-testo`: RICHIESTA ARRIVATA e MANCA QUALCHE FILE |
| `MembroNucleo` | Una persona del nucleo (`.mio-membro`): IN REGOLA, DA SISTEMARE, in attesa o rifiutata |
| `RigaNucleoPagamento` | Una riga di PAGAMENTI DEL NUCLEO, con la variante «Tutto il nucleo» |
| `NastroProva` | Il nastro giallo DATI DI PROVA in cima all'area iscritti (`.nastro-prova`) |
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
| `canvas.json` | Layout del canvas: pagina "Design System" (Foundations, le due cornici) e pagina "Libreria" |
| `verifica.mjs` | Il controllo da lanciare prima di pubblicare |

Tutti i componenti hanno la prop `tema` (`scuro` | `chiaro`).

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
da Excel, timer) stanno in un solo Artifact, una pagina per sezione:

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
