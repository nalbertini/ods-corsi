# Tasti del tablet nel look del sito · proposta

I tasti del tablet di sala (`.tb-btn` e varianti) prendono la forma del sito sotto `:root[data-look='sito']`,
come i `.btn` dell'app (PR 655). Misure e corpi restano quelli di oggi. La tastiera del PIN (`.tb-tasto`) e i chip non cambiano.

| Tavola | Cosa mostra |
|---|---|
| `Tasti` | Oggi (`TabletTasto` della libreria) e proposta: verde → giallo, linea blu, aperto com'è, SÌ ESCI A (rosso a linea) o B (rosso pieno), spento grigio |
| `Schermate` | L'appello con un solo giallo, l'appello già fatto coi tasti spenti, il recupero della home (bordo A giallo o B blu), l'uscita |

Libreria: `TabletTasto`. Disegnati a mano, con un commento: i tasti proposti e le schermate (la libreria ha i pezzi del tablet col tema vecchio).
