# Il sito in FigCraft

`ods-sito.figcraft` è il sito pubblico (www.officinedellosport.it) com'era il
2026-10-18, aperto in FigCraft: 19 pagine, ognuna a 1440 px e a 390 px, con
31 componenti (pagina «Componenti»), i 6 colori del sito come variabili e
l'auto layout dove le posizioni lo permettono. Non è il sorgente del sito:
quello sta in `officinedellosport-sito` e si genera da ODS Corsi. Questo file
serve per guardare e ridisegnare.

## Rifarlo quando il sito cambia

Servono `figcraft-cli` (dalla release di FigCraft su GitHub), Google Chrome e
Node 22 o più. Il font Big Shoulders Display deve essere installato sul Mac
(licenza OFL, `ofl/bigshouldersdisplay` nel repo google/fonts), e FigCraft
riavviato dopo averlo installato: legge i font una volta sola.

```bash
cd docs/figcraft/strumenti
node estrai.mjs <cartella>/raw ""          # legge le pagine vere con Chrome
node converti.mjs <cartella>/raw <cartella>/out
figcraft-cli convert <cartella>/out/ods-sito.json ../ods-sito.figcraft
./verifica.sh "" Home desktop              # % di pixel diversi dal sito vero
```

`converti.mjs` scarica le foto in `out/images`; prima di `convert` conviene
togliere quelle non usate, se no entrano tutte nel file.

## Cosa non fa

- I colori diversi della stessa scheda sono componenti separati, non varianti.
- Il fuoco delle foto è un ritaglio vero della foto: per cambiarlo si
  sostituisce l'immagine.
- Il testo è a misura fissa: se si allunga, il riquadro non si allarga.
