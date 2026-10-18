# Barra fissa «Prova a 5 € / Chiama» (Home del sito, telefono)

Proposta da approvare prima di toccare il sito. Nasce dalla critique della Home
mobile del 18 ottobre 2026 (problema P1: il pulsante di prova sta solo
nell'hero e nel finale, 12.000 px più in basso; il telefono nel piede non si
tocca per chiamare). Niente è stato cambiato in `src/`.

| Tavola (375×812) | Cosa è |
|---|---|
| 1 · Barra oggi | A metà pagina: nessun pulsante a portata di pollice |
| 2 · Barra proposta | La stessa schermata con la barra in basso |
| 3 · Barra in fondo | Con la chiamata finale in vista la barra sparisce |
| 4 · Barra e menu aperto | Il pannello del MENU sta sopra la barra |

Componente nuovo in `../ods-design-system/`: `SitoBarraProva` (fondo inchiostro,
due pulsanti da 56 px: «Prova a 5 €» giallo, «Chiama» col filo bianco; alta 80 px).

## Regole proposte

- Solo sul telefono (sotto i 901 px, come il tasto MENU) e solo sulla Home nuova.
- Compare dopo l'hero, sparisce sulla chiamata finale (nessun pulsante doppio).
- «Prova a 5 €» va al modulo online (lo stesso indirizzo dell'hero); «Chiama» è un
  link `tel:` con lo stesso numero del piede, che diventa cliccabile su tutto il sito.
- Sotto la pagina c'è spazio per 80 px (più l'area sicura dell'iPhone): la barra non
  copre il testo né il piede. Il MENU aperto sta sopra.

## Com'è stata costruita

Senza script: la barra sta in fondo al blocco che segue l'hero (`.dopo-hero`) con
`position: sticky; bottom: 0`. Resta in basso mentre si scorre quel blocco; finito il
blocco, sale via con la pagina e la chiamata finale resta libera. Occupa i suoi 80 px
nella pagina, quindi prima della chiamata finale si vede per un tratto come fascia scura.
Decisioni dell'utente: testo «Prova a 5 €», fondo inchiostro (approvati il 18 ottobre).

## Era da decidere

- Il testo del primo pulsante: «Prova a 5 €» (corto, entra a 375 px) o intero «Prova una settimana a 5 €» (non entra a fianco di «Chiama»).
- Il fondo: inchiostro (proposto, stacca dal giallo delle schede) o chiaro con filo.
