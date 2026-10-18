# Sito · scrivi nella pagina (proposta)

Il testo e le colonne si scrivono **dentro la pagina**, non nel pannello stretto di destra. Parte da `main` dopo
le PR #469 (schede IMPOSTAZIONI | ELENCO) e #471 (terza colonna), tutte e due unite.

Tutte le tavole sono nel look del sito (`data-look='sito'`, quello della segreteria oggi): fondo #eef5fa, inchiostro
#0d2a3d, tasti e campi a 6px, Big Shoulders per titoli, Inter per testi e tasti; i componenti della libreria hanno
`tema="sito"`, il menu è quello di `../segreteria-sito/`. Tasti e stati riprodotti dallo schermo vero (SITO > pagina a pezzi).

Artboard: 1 Oggi · 2 Proposta A (barra sopra il pezzo) · 3 Proposta B (barra fissa in alto) · 4 Colonne ·
5 LINK aperto · 6 Tablet 768px · 7 Telefono 390px con la tastiera.

## Scelte aperte (all'utente)

1. **Dove sta la barra dei tasti.** A: sopra il pezzo scelto, galleggia. B: fissa in alto, seconda riga sotto
   ANNULLA / RIFAI / SU / GIÙ / TOGLI. Consiglio: A sul largo, e sul tablet; sul telefono la barra sta sopra la
   tastiera in tutti e due i casi.
2. **Colonne.** Una barra per pezzo (sopra tutte e tre), non una per colonna: una colonna è troppo stretta.
3. **Pannello di destra senza una parte scelta / con un testo scelto.** Resta una frase («il testo si scrive nella
   pagina») sotto le impostazioni. Va bene o sparisce il campo?

## Rischi da risolvere nel codice

- **Trascinamento contro selezione del testo.** Puck trascina il pezzo da tutta la sua area: un trascinamento per
  selezionare le parole sposterebbe il pezzo. Il trascinamento deve partire solo dalla maniglia ⋮⋮ (o dal bordo),
  mai dal testo; sul tocco, lo scorrimento della pagina non deve far partire il trascinamento.
- **Annulla / rifai due volte.** Puck ha la sua storia, TipTap la sua. ANNULLA e Ctrl+Z dentro il testo devono
  decidere chi risponde (proposta: dentro il testo in fuoco risponde TipTap fino a che non ha niente da annullare,
  poi Puck), e il testo scritto va a Puck a ogni pausa, non a ogni lettera, per non riempire la storia.
- **Fuoco.** Cliccare la barra non deve togliere il fuoco al testo (tasti con `onMouseDown` che non lo perde);
  scegliere un altro pezzo deve chiudere l'editor del primo senza perdere l'ultima battuta.
- **Un editor per pezzo, tanti sulla pagina.** Nel pezzo COLONNE ce ne sono fino a tre vivi insieme: va montato solo
  quello in fuoco e gli altri restano `Testo` (vista), se no la pagina diventa lenta sul telefono.
- **IMMAGINE (`ScegliImmagine`) dentro la pagina.** La scelta si apre sopra la pagina, non dentro il pezzo che si
  sposta; la posizione del cursore va ricordata prima di aprirla e l'immagine entra lì, come oggi.
- **Link aperto.** Il campo DOVE PORTA IL LINK sta dentro la barra; ESC e ANNULLA riportano il cursore dov'era.
- **La barra copre il pezzo di sopra.** Quando galleggia su un pezzo basso copre la fine di quello prima; se il pezzo
  è alto resta agganciata al bordo alto dello scorrimento (`position: sticky`).
- **Tastiera del telefono.** La barra va sopra la tastiera (`visualViewport`), non sotto: e la pagina deve scorrere
  in modo che il cursore non resti coperto.
- **Come sul sito.** Il testo scritto in pagina usa gli stessi stili del sito (`.sito-testo`), quindi `pulisciTesto`
  e `sitoTesto.ts` restano l'unico filtro: niente cose che il sito non accetta.
