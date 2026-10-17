# La pagina di un corso

Design: `docs/design-canvas/sito-rebrand/TatamiBlu-Corso.dc.html` (desktop) e `TatamiBluM-Corso.dc.html` (telefono).
Prova: `npm run prova:sito-corso`. Tutto lo stile sta dentro `main.corso`: le altre pagine non cambiano.

## Come si scrive nel pannello SITO

Una pagina è «di un corso» se il testo **prima del primo titolo grande (`h2`)** ha, in quest'ordine:

1. una **foto** (la foto grande, a tutta larghezza, 620px sul computer, 360px sul telefono);
2. un **elenco** di 2–6 voci che cominciano col grassetto (`**Per chi** Dai 7 anni…`): sono le tessere dei dati, quattro in riga sul computer, due per riga sul telefono;
3. uno o più **sottotitoli (`h3`)** col loro testo: le tessere di presentazione (tre in riga sul computer, una sotto l'altra sul telefono).

Il titolo della pagina e la descrizione sono la testata (titolo enorme a sinistra, descrizione e «Contattaci» a destra). Se la forma non è questa la pagina resta com'era.

Dopo la testata, ogni `h2` è una sezione:

| Cosa si scrive | Come esce |
| --- | --- |
| `h3` + paragrafi | tessere a due colonne, titolo grande (64px), colori giallo → blu → inchiostro → giallo… |
| `h3` senza testo | tessere più basse, con il titolo in alto |
| `h3` + un paragrafo che è solo grassetto (l'ora) + paragrafi (giorni, età) | **orario**: titolo e ora sulla stessa riga, giorni a sinistra ed età a destra; l'ultima tessera è gialla, le altre azzurre |
| 2–3 foto di fila | fila di foto alte 516px (sul telefono: la prima a tutta larghezza, le altre due affiancate) |
| un solo paragrafo, al massimo 160 caratteri | **banda blu** con il titolo enorme e la frase grande |

## Cosa resta diverso dal design

- La foto di testata e quelle di fila sono centrate (`object-position`): il testo non può dire dove tagliare.
- Una fila di foto vuole il suo `h2`: il design ha la fila senza titolo, il testo non può esprimerlo.
- La quarta tessera di una sezione è gialla, non azzurra («Oggi a Collegno» nel design).
- Il titolo «Cosa può aspettarsi…» ha 56px sul telefono come gli altri (nel design 48px).
- Sul telefono la terza tessera di presentazione ha l'altezza minima delle altre (220px, nel design 180px) e i testi sono quelli del sito, non le versioni accorciate del design.
- Testata (logo, menu), invito «Prova» e piede sono comuni a tutte le pagine: misure e confronto stanno con la Home.
