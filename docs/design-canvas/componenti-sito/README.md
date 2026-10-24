# Componenti nel look del sito · proposta

I componenti condivisi del sistema vecchio (`.btn` e varianti, `.rule-label`, `.testata-luogo`,
`.modulo-etichetta`, `.etichetta-riquadro`, `.nastro-prova`, `.scelta-titolo`, `.campo`) prendono la forma
del sito sotto `:root[data-look='sito']`. Il modulo di iscrizione (`data-modulo='sito'`) non cambia.

| Tavola | Cosa mostra |
|---|---|
| `Tasti` | Oggi (tema chiaro della libreria: stessa forma, carattere diverso) e proposta: principale giallo, vai verde, linea e tratteggiato blu, disabilitato A (opacità 0.4) o B (grigio), conferma rossa invariata |
| `Etichette` | Titoletto A (piccolo, 0.12em) o B (titolo del modulo), luogo della testata a 0.12em, striscia di prova, campo con raggio 6px e bordo blu |
| `TelefonoAppello` | L'appello sul telefono con i tasti nuovi |

Libreria: `Bottone`, `Titoletto`, `Testata`, `Campo`, `NastroProva`, `TestaAppello`, `RigaAppello`, `BarraTelefono`.
Disegnati a mano, con un commento: il `vai` verde e il disabilitato grigio nella forma del sito, il titoletto A, la striscia di prova a 0.08em (valori nuovi che la libreria non ha ancora).
