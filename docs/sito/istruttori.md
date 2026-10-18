# Gli istruttori: la pagina come nel design

Testo da incollare nel pannello SITO (PAGINE › Istruttori, indirizzo `/istruttori/`), per avere la griglia dei ritratti del design «tatami blu e giallo» (`TatamiBlu-Istruttori`, desktop, e `TatamiBluM-Istruttori`, telefono). Oggi questa pagina **non esiste** sul sito (`/istruttori/` dà 404): va creata, e il pulsante «Conosci gli istruttori» di Chi siamo punta lì.

Come si fa:

1. Crea **PAGINE › Istruttori** (indirizzo `istruttori`).
2. Nei campi a destra: **titolo** e **descrizione** qui sotto.
3. Apri `docs/sito/istruttori.html` nel browser, seleziona tutto (Cmd+A), copia. Nel pannello clicca nel testo e incolla (Cmd+V).
4. **ANTEPRIMA** per controllare, poi **PUBBLICA**.

## Titolo

Gli istruttori

## Descrizione

Tredici tecnici sportivi che accompagnano ogni persona passo dopo passo, rispettando tempi, capacità e obiettivi.

## Testo

Il testo sta in [`istruttori.html`](istruttori.html). Un `h3` col nome e un paragrafo col ruolo («Cognome · discipline») per ognuno dei tredici; in fondo la frase sulle pagine personali. Il sito li mette in una griglia di ritratti, tre per riga.

I nomi, i cognomi e i corsi sono quelli letti dal database negli stessi canvas del design (`TatamiBlu-Istruttori.dc.html`): non sono scritti a mano. Non ho aggiunto né titoli né storie.

## Cosa cambia rispetto a oggi

- Pagina nuova (non c’è sul sito di oggi).
- Nessuna foto per ora: il cerchio del ritratto mostra l’iniziale del nome. Quando le foto ci sono, vanno messe subito sotto ogni nome (`<img>` col nome in `alt`), nella libreria IMMAGINI.
- I nomi non sono link: le pagine personali (`/istruttori/<nome>/`) non ci sono ancora. Quando esistono, il nome diventa `<h3><a href="/istruttori/<nome>/">Nome</a></h3>` e compare la freccia ↗.

## Da controllare prima di pubblicare

- **L’elenco dei tredici** viene dal database a oggi: se un istruttore cambia, la pagina va cambiata (e il «Tredici» della descrizione e di Chi siamo).
- **Il ruolo di Maurizio** («Maestro di Judo V Dan») è l’unico ruolo scritto: viene dal design. Gli altri hanno solo cognome e corsi; ruoli e titoli (cinture, qualifiche) li dà solo la segreteria.
- «Tiziano Bartocci: Body functional, pesistica, prepugilistica», «Manuel Tagini: … Mobility»: i corsi sono quelli del database, con le parole del design.
- **Foto dei ritratti: DA SCEGLIERE.** Servono i permessi delle persone ritratte.
- Le pagine personali (ramo `claude/sito-istruttore-d4f7dd`) hanno bisogno di testi per ognuno: non li ho scritti, sono nomi, storie e titoli di persone vere che solo loro o la segreteria possono dare.

## La regola del sito

Un testo **senza titoli grandi (`h2`)** che **comincia con un titolo piccolo (`h3`)** ed ha almeno due `h3` è una griglia di ritratti (`ritratti()` in `src/lib/sitoLayout.ts`), tre per riga sul computer e due sul telefono. Ogni ritratto è:

1. un `h3`: il nome (grande, in basso nella tessera);
2. una foto, se c'è: va nel cerchio; senza foto il cerchio ha l'iniziale del nome;
3. un paragrafo: il ruolo («Cognome · discipline»), sotto il nome.

Il primo blocco che non segue un ritratto, e tutto quel che viene dopo, resta testo sotto la griglia (sul telefono non si vede, come nel design). I colori sono quelli del design, uno per uno. Se il nome è un link, tutta la tessera è cliccabile e compare la freccia ↗.

## Differenze dal design

- Senza foto il cerchio ha l'iniziale del nome: la scritta «Foto» del design è il segnaposto del disegno.
- Il ruolo di Maurizio nel design telefono è accorciato: sul sito il testo è uno solo, quindi la sua tessera è più alta di 17px.
