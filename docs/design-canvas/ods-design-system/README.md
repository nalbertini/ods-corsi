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
| `Menu.dc.html` | Il menu di segreteria (`.sg-menu`) |
| `StrisciaGiorni.dc.html` | I sette giorni del calendario (`.striscia-giorni`) |
| `TimerAnello.dc.html` | L'anello del giro del timer (`Ring` e `DentroAnello` di `Quadrante.tsx`). Non è più nella schermata dell'allenamento, resta per il cronometro e il conto alla rovescia |
| `TimerScaletta.dc.html` | `Scaletta`: i passi dell'allenamento, il primo in corso |
| `TimerLinea.dc.html` | `LineaDelTempo`: un blocco per passo, che si colora via via |
| `Titoletto.dc.html` | `Titoletto` di `ds.tsx`: l'etichetta spaziata con la riga |
| `Testata.dc.html` | `Testata` di `App.tsx`: marchio, luogo, guida e tema (misura del telefono) |
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

- La testa dell'appello (titolo, conto, TUTTI PRESENTI), le card dei riquadri
  (`Riquadro`), i campi del modulo, le tabelle di segreteria, i dialoghi e i
  cassetti, i tasti del tablet di sala (`.tb-*`), le schermate del timer oltre a anello, scaletta e linea (esempio completo in `../timer-desktop/`). Un mockup che li
  vuole li aggiunge alla libreria come `<Nome>.dc.html`, copiando i valori dal
  codice, prima di usarli.
- Il menu sul telefono (la barra con MENU) e quello degli istruttori sullo
  schermo largo.
- Gli stati dinamici: passaggio del mouse, fuoco da tastiera, ricerca aperta.
