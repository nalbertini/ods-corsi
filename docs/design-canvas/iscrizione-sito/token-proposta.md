# Modulo di iscrizione nell'aspetto del sito · tema `sito`

PROPOSTA di design (solo canvas, nessun codice dell'app). Il modulo vero
(`src/components/ModuloIscrizione.tsx`) sempre chiaro come il sito pubblico
«tatami blu e giallo» (A2, `../sito-approvato/token-proposta.md`), qualunque sia
il tema dell'app. Gli stati restano rosso, verde e giallo, con segno e parola.
Big Shoulders Display e Inter solo per il modulo.

## Valori del tema `sito`

| Chiave | Valore | Da dove |
|---|---|---|
| bg | #eef5fa | sito: `--fondo` |
| surface | #ffffff | bianco |
| surface2 (scelta scelta), line | #cfe6f4 | sito: `--chiara` |
| lineCampo, tratteggio, blu | #14709f | sito: `--blu` |
| text, sec, tasto | #0d2a3d | sito: `--inchiostro` |
| dim, faint | #46606f | NUOVO: inchiostro attenuato |
| giallo | #f4c31b | sito: `--giallo` |
| gialloTesto | #8f6a00 | DESIGN.md, tema chiaro |
| rosso, rossoTesto | #e4292a, #b81d1d | DESIGN.md, tema chiaro |
| verde, verdeTesto | #12913f, #0b7a33 | DESIGN.md, tema chiaro |

## Contrasti (WCAG 2.x, calcolati)

| Coppia | Rapporto | Soglia |
|---|---|---|
| testo #0d2a3d su fondo #eef5fa | 13,48 | 4,5 |
| testo su bianco | 14,83 | 4,5 |
| testo su #cfe6f4 (scelta scelta) | 11,50 | 4,5 |
| dim #46606f su fondo | 6,03 | 4,5 |
| dim su bianco | 6,64 | 4,5 |
| dim su #cfe6f4 | 5,15 | 4,5 |
| bianco su inchiostro (tasto principale, segmento pieno) | 14,83 | 4,5 |
| inchiostro su giallo (MANDA) | 8,95 | 4,5 |
| bordo campo #14709f su fondo / su bianco | 4,96 / 5,46 | 3 |
| bordo errore #e4292a su bianco | 4,52 | 3 |
| bordo file caricato #12913f su bianco | 4,08 | 3 |
| nota errore #b81d1d su bianco | 6,50 | 4,5 |
| avviso #8f6a00 su fondo / su bianco | 4,51 / 4,97 | 4,5 |
| etichetta verde #0b7a33 su bianco | 5,46 | 4,5 |
| fuoco blu #14709f su fondo | 4,96 | 3 |

## Correzioni ai valori dati

- `faint` #cfe6f4 farebbe 1,29:1 sul bianco: è il colore di FIRMA QUI COL DITO,
  che si legge. Nel tema `sito` `faint` è #46606f (6,64:1).
- `gialloTesto` #8f6a00 regge su fondo e bianco ma NON su #cfe6f4 (3,85:1): sulla
  scelta scelta non si scrivono avvisi (gli avvisi stanno sotto il gruppo).
- Il filo #cfe6f4 (`line`) è decorazione: i controlli (campi, scelte, tasto a
  linea, SCEGLI) hanno il bordo blu `lineCampo`, che sta a 3:1.

## Com'è stato costruito (2026-10-17)
Vince il costruito: in `styles.css`, sotto `:root[data-modulo='sito']`, MANDA LA RICHIESTA e RIPROVA (`.btn-primary`) sono gialli con l'inchiostro; le note d'errore e i file caricati non hanno «!» né ✓ (lo dicono le parole); codice fiscale, CAP e telefono sono in Inter; il fuoco da tastiera è un anello blu da 3px su ogni controllo; i tasti della firma a schermo intero hanno il bordo blu e il testo dritto. Il tema non cambia dopo i colori: i cinque del sito più i toni degli stati del tema bianco e `#46606f` per il testo spento.
