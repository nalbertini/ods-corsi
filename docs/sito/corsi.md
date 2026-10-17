# I nostri corsi del sito come nel design

Testo da incollare nel pannello SITO (PAGINE › I nostri corsi) per avere la
pagina del design «tatami blu e giallo» (`TatamiBlu-Corsi`, desktop 1440px, e
`TatamiBluM-Corsi`, telefono). Il testo sta in [`corsi.html`](corsi.html): si
apre nel browser, Cmd+A, copia, e si incolla nel pannello (come per la Home).
Le foto di prova sono quelle già nella libreria IMMAGINI: vanno sostituite
con una foto per corso.

## Come si scrive

Nessun `h2`: nel design il titolo grande è già il titolo della pagina.

1. Un paragrafo di apertura: è la frase grande sopra le tessere.
2. Per ogni corso, nell'ordine:
   - un titolo (`h3`) **che è un link** alla pagina del corso;
   - una foto (facoltativa: senza, resta il vuoto sopra il titolo, così le
     tessere restano allineate);
   - un paragrafo con la fascia d'età **in grassetto** e poi la descrizione;
   - un elenco di fasce: «Bambini», «Adulti», «Agonisti», «Anziani» hanno
     la loro icona; altre voci brevi (fino a 20 caratteri) sono pillole senza icona.
3. In fondo, due foto di fila: sono la fascia larga sotto le tessere (la
   seconda sparisce sul telefono, come nel design).

## La regola nel codice

- Un `h3` con un link dentro è un corso. Se lo sono tutti quelli di una
  sezione, la griglia è «corsi» (`.tessere.corsi`): tre colonne, tessere da
  400px, colori sfalsati giallo/blu/inchiostro, freccia ↗ dopo il titolo.
  Tutta la tessera porta alla pagina del corso.
- Il testo prima del primo `h2` (o senza alcun `h2`) che segue questa regola
  è una sezione senza titolo.
- Esattamente due foto alla fine dell'ultima tessera sono la fascia
  (`foto-fila due fascia`, alta 620px, la seconda larga 420px).
- Un `h3` senza link resta una tessera normale (nessuna regola nuova).

Codice: `src/lib/sitoLayout.ts` (la regola), `src/lib/sitoCorsi.ts` (misure e
icone). Prove: `npm run prova:sito-corsi`.

## Cosa resta diverso dal design

- La posizione della foto dentro la tessera (`object-position`) è sempre al
  centro: il testo non può dirla.
- Tra le tessere ci sono 6px come in tutto il sito; nel design sul telefono
  sono a contatto.
- Il paragrafo di apertura è quello lungo del desktop anche sul telefono.
- Testata della pagina (titolo da 200px con la frase a destra), invito
  «Prova» e piede sono i pezzi comuni a tutte le pagine interne: non cambiano qui.
