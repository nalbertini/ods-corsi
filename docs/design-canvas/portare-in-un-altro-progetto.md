# Design system e canvas di un'applicazione: come rifarlo in un altro progetto

Quello che abbiamo fatto in ODS Corsi, scritto per ripeterlo altrove: cosa
serve nel progetto, le skill e la configurazione, e il prompt da incollare.

## 1. Cosa serve prima di cominciare

**Nel progetto nuovo**

| Cosa | Perché |
|---|---|
| `DESIGN.md` (token: colori, tipografia, raggi, ombre, spaziature, regole) e `PRODUCT.md` (a chi serve, tono) | È la fonte dei valori. Se non ci sono, il prompt li ricava dal codice e li scrive |
| Un file di token nel codice (CSS con variabili, `tailwind.config`, `theme.ts`) | I valori dei mockup si copiano da lì, non si inventano |
| Un controllo dei colori (`verifica.mjs`) | Fallisce se un esadecimale non sta nei token |
| `CLAUDE.md` con le regole del design (sezione 3) | Le regole valgono per ogni sessione |
| `docs/design-canvas/` | Libreria, sezioni, script del canvas unico |

**Nella macchina di chi lavora**

- Claude Code (o l'app desktop) con l'Artifact di tipo **Design**: è quello che
  disegna i file `.dc.html` su una canvas. Senza, i file restano ma non si
  vedono.
- Un browser collegato (il browser dell'app, o Claude in Chrome) per guardare
  il canvas pubblicato. I `.dc.html` non si aprono da soli: serve il canvas.
- Node 20 o più (gli script sono `.mjs`, senza dipendenze).
- Un account che può pubblicare Artifact. Un Artifact è privato finché non lo
  condividi tu dal menu Condividi.

## 2. Skill e agenti da portare

Copia questi file, poi cambia i nomi delle cartelle e le parole del dominio:

- **Skill `nuova-funzione`** (`.claude/skills/nuova-funzione/SKILL.md`): il
  flusso con i passi del design: proposta partendo dalla libreria, discussione
  con l'utente, solo dopo prove e codice, libreria aggiornata a fine lavoro.
- **Skill `chiudi-lavoro`**: prima della PR rilancia `verifica.mjs` e dice di
  ripubblicare il canvas.
- **Agente `designer`** (qui `designer-ods`): rivede le schermate toccate
  rispetto a `DESIGN.md`, guardandole nel browser. Non modifica file.
- **Agente `cliente`** (qui `cliente-ods`): fa la parte di chi usa l'app e
  giudica una proposta o una schermata, senza leggere il codice.
- Niente di nuovo da installare per `/design`: è già nell'app.

Il mio consiglio: se nel progetto nuovo non c'è un flusso di funzione già
scritto, porta solo i passi 4, 5 e 12 e le due frasi di `chiudi-lavoro`.
Il resto del flusso (analista, scrittore di prove, revisori) è di ODS Corsi.

## 3. Configurazione

**`CLAUDE.md`, aggiungi:**

```markdown
- Una funzione che cambia qualcosa che si vede parte dal design: proposta in
  un canvas che parte dalla libreria, discussione con l'utente, solo dopo
  prove e codice, e a fine lavoro la libreria aggiornata.
- Ogni mockup parte dalla libreria in `docs/design-canvas/<libreria>/`, mai da
  artboard disegnate da zero. Un componente mancante si aggiunge alla
  libreria come `.dc.html`, copiando i valori dal codice. Se cambia un token
  o un componente, si aggiorna il file corrispondente nello stesso commit.
- Prima di pubblicare: `node docs/design-canvas/<libreria>/verifica.mjs`.
- Libreria e sezioni stanno in un solo canvas
  (`node docs/design-canvas/unico.mjs <cartella>`); si pubblica sempre sullo
  stesso Artifact.
```

**`package.json`, aggiungi** (comodo, non obbligatorio):

```json
"design:verifica": "node docs/design-canvas/<libreria>/verifica.mjs",
"design:unico": "node docs/design-canvas/unico.mjs"
```

**CI** (una riga nel workflow delle prove): `npm run design:verifica`. Così un
colore fuori dai token blocca la PR.

**Permessi** (`.claude/settings.json`, se usi la modalità con permessi): consenti
`node docs/design-canvas/*` e la scrittura sotto `docs/design-canvas/`.

## 4. Il prompt

Incollalo nella radice del progetto nuovo, dopo aver riempito le parentesi
quadre. È scritto per più passi con una sosta tra uno e l'altro: se vuoi che
vada avanti da solo, togli le soste.

````text
Devi costruire il design system e i canvas di tutta l'applicazione [NOME
PROGETTO], come fotografia di COM'È OGGI (non una proposta). Lingua dei testi:
[ITALIANO]. Sorgenti dell'interfaccia: [src/ ...]. Token: [file dei token].
Dispositivi che l'app serve: [telefono 390px / tablet 1280x800 / schermo largo
1440px].

Regole di tutto il lavoro
- I valori (colori, font, misure, testi) si COPIANO dal codice e da DESIGN.md,
  mai a occhio. Ogni file di libreria cita nel commento le righe del CSS e il
  .tsx da cui viene.
- Colori solo #rrggbb a 6 cifre, presenti nei token. Font: scrivi lo stack
  intero nello stile (mai una costante come `COND` o una variabile non
  risolta: nel canvas esce in serif).
- Una cosa per volta, un branch e una PR per sezione. Prima di ogni PR
  `verifica.mjs` deve uscire 0.
- Gli agenti in parallelo scrivono file DIVERSI e non toccano README,
  canvas.json né i file degli altri; i file condivisi li aggiorni tu.
- Non dire che una schermata è «fedele» se non l'hai vista sul canvas
  pubblicato. Dì cosa hai guardato e cosa no.

Passo 0 — Scoperta (poi fermati e mostrami il risultato)
1. Elenca le schermate e gli stati significativi dell'app, raggruppati per
   area (es. accesso, area A, area B) e per dispositivo. Una riga ciascuna,
   col file sorgente.
2. Elenca i token che esistono (colori, tipografia, raggi, ombre,
   spaziature) e dove stanno. Se manca `DESIGN.md`, scrivilo tu da quei
   valori; se manca `PRODUCT.md`, chiedimi a chi serve l'app e con che tono.
3. Elenca i componenti che si ripetono (bottone, campo, riga di elenco,
   scheda, badge, dialogo, menu, testata, tabella...) con il file sorgente
   e quante volte compaiono.

Passo 1 — Libreria (`docs/design-canvas/<libreria>/`)
- `Main.dc.html`: le fondamenta (colori, neutri e testo in scuro e chiaro se
  l'app ha i due temi, tipografia, raggi, bordi, ombre, spaziature, misure
  del tocco).
- `Pagina.dc.html` e `PaginaTelefono.dc.html` (o le cornici dei dispositivi
  che servono): menu, testata, margini e sfondo come nell'app. Una schermata
  nuova si copia da qui.
- Un `<Nome>.dc.html` per ogni componente del passo 0, con la prop `tema` e
  props per ogni stato (variante, stato, vuoto, errore, selezionato). Il
  valore di riserva di ogni prop nel codice è LO STESSO dichiarato in
  `data-props`: un `?? ''` dove il default non è vuoto lascia il componente
  vuoto.
- Ogni `<dc-import>` ha `hint-size`; `$preview` dichiara la misura vera.
- `README.md`: tabella dei componenti, come si riusa (con esempi di
  `<dc-import>`), cosa NON copre ancora, come aggiornare.
- `verifica.mjs`: esce 1 se trova un colore #rrggbb che non è nei token o in
  DESIGN.md, un `<dc-import>` senza `hint-size`, o verso un file che non c'è.
- `canvas.json`: pagina «Design System» (fondamenta e cornici) e pagina
  «Libreria».
Fermati: mostrami la libreria sul canvas pubblicato (vedi passo 3) prima di
continuare.

Passo 2 — Sezioni
Per ogni area del passo 0, una cartella `docs/design-canvas/<sezione>/` con
`Main.dc.html` (la prima schermata) e una schermata per ogni passo e stato:
parti dalla cornice della libreria, importa i componenti, dati d'esempio
realistici e inventati (nessun dato di persone vere), data fissa. Un
componente che manca va PRIMA nella libreria. Lavora per sezione, in
parallelo se le sezioni sono indipendenti; ogni sezione chiude con
`verifica.mjs docs/design-canvas/<sezione>`. Alla fine di ogni sezione scrivi
cosa non hai coperto (stati d'errore, vuoti, casi che compaiono solo con
lavoro arretrato).

Passo 3 — Canvas unico e controllo a occhio
- Copia `docs/design-canvas/unico.mjs`: mette libreria e sezioni in UN solo
  Artifact «Design», una pagina per sezione; ogni file proprio di una sezione
  prende il prefisso `<sezione>-` perché i nomi sono unici nel canvas. Una
  sezione nuova si aggiunge a `SEZIONI`.
- Pubblica con l'Artifact di tipo Design: `canvas.json` e tutti i file, sulla
  stessa URL ogni volta.
- Guarda il canvas nel browser. Se le anteprime sono troppo piccole, crea
  fogli di controllo (artboard larghe 1200px con 4–8 componenti, ognuno in
  una cella con la sua larghezza) e aprili uno alla volta con
  `launch: {"view":"focused","file":"…"}`. Non toglierli dal canvas
  definitivo, tienili solo nel controllo.
- Correggi quello che trovi alla fonte (il file della libreria), non nel
  foglio.

Passo 4 — Regole di lavoro
Porta nel progetto le regole di `CLAUDE.md`, le skill e gli agenti della
sezione 2 di `portare-in-un-altro-progetto.md`, adattate a questo progetto, e
la riga di CI per `verifica.mjs`.

Consegna: una PR per la libreria, una per sezione, una per il canvas unico e
le regole. In ogni PR scrivi: cosa c'è, cosa non copre, cosa hai guardato sul
canvas e cosa no.
````

## 5. Cose imparate che fanno risparmiare tempo

- **Le anteprime di default vanno guardate.** Un componente che nel foglio
  mostra solo l'etichetta ha di solito il default del codice vuoto.
- **`font-family: COND`** (una costante scritta come testo) è passato in
  tre componenti: nel canvas uscivano serif. Cerca `font-family: [A-Z]+` nei
  file nuovi.
- **I clic nel pannello del canvas** non sempre arrivano dagli strumenti del
  browser: si cambia pagina o vista modificando `launch` in `canvas.json` e
  ripubblicando, non cliccando.
- **I file di una sezione si chiamano `Main`** in ogni cartella: il canvas
  unico li prefissa, quindi lo script riscrive anche i `<dc-import>`.
- **Lo stato di ogni agente va ricontrollato:** gli agenti non vedono il
  canvas, dichiarano «tutto in regola» solo per `verifica.mjs`. La fedeltà
  si controlla a occhio.
