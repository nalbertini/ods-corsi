# Il sito in Statistiche · proposta

Passo 4 di `nuova-funzione`: il riquadro IL SITO in fondo a STATISTICHE della
segreteria, nel look del sito. «Oggi» e proposta affiancati, schermo largo e
telefono. Numeri di esempio di una palestra di arti marziali a Collegno, al
17 marzo 2027 (con il contatore acceso il 20 ottobre 2026 c'è qualche mese da
guardare).

| Tavola | Cosa mostra |
|---|---|
| `Oggi`, `OggiTelefono` | La pagina com'è: finisce con INCASSI MESE PER MESE |
| `Proposta`, `PropostaTelefono` | IL SITO in fondo, ultimi 3 mesi, tutti i corsi |
| `ProponiCorso` | Con un corso scelto: i numeri in alto cambiano, IL SITO no, e una frase lo dice |
| `ProponiDal` | Ultimi 6 mesi (dal 1 ottobre): «Si conta dal 20 ottobre 2026», ottobre corto, niente mesi a zero |
| `ProponiErrore`, `ErroreTelefono` | GoatCounter non risponde: l'errore sta nel riquadro, gli altri restano |
| `Stati` | Letti alle / Aggiorna (prima lettura, dalla memoria, appena riletto), modalità prova, le sei frasi d'errore |
| `RiquadroSito` | Il componente della proposta |
| `StatisticheSopra` | Solo nel canvas: la pagina sopra il riquadro, con i riquadri di mezzo tagliati |

Le scelte:

- Il riquadro è come gli altri: tessera bianca, testa di `Riga` (IL SITO, filo,
  nota), il totale grande come INCASSI, le colonne delle visite uguali a quelle
  di PRESENZE, PROVE e INCASSI (`Colonne` della libreria), mese in corso
  tratteggiato.
- Accanto alle colonne, HANNO TOCCATO: una tabella mese per mese con visite,
  Iscriviti, Chiama e Scrivici e la riga TOTALE (lo stile di `.sg-stat-tabella`).
  Tre serie su un grafico solo sarebbero colori diversi: la tabella si legge.
- LE PAGINE PIÙ LETTE e DA DOVE ARRIVANO: barre di un valore solo come
  `.sg-barra` di PRESENZE, col titolo della pagina e l'indirizzo sotto;
  «Diretto o non si sa» a parte, sotto un filo, con la spiegazione.
- Una riga dice che i numeri sono indicativi (visite, non pagine viste; 8 ore).
  «Letti alle 10:42» e Aggiorna (tasto a linea: il giallo resta a nessuno,
  la pagina non ha un tasto principale) stanno nella testa del riquadro.
- Le frasi (si conta dal, corso scelto) sono una fascia azzurra senza segno:
  non sono guai. L'errore è il `Guaio` dell'app (NON LETTO, rosso) con la barra
  rossa del look e una frase che dice cosa fare.
- Sul telefono una colonna: nelle barre il nome e il numero sopra, la barra
  sotto; la tabella stringe le celle e scrive il mese corto (GEN 2027).

## Come è stato costruito

Approvato e costruito (`StatisticheSito.tsx`): ora lo descrive la libreria,
`ods-design-system/RiquadroSito.dc.html`; queste tavole restano come storia.
Le differenze dal disegno: «Altre N pagine» senza i nomi sotto (GoatCounter
dà solo i conti), e «· di nuovo fra un minuto» accanto all'ora finché
Aggiorna è spento, anche subito dopo la prima lettura.
