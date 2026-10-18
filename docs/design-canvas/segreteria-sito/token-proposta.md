# Segreteria nel look del sito · token della proposta

Direzione: le pagine della segreteria (DA FARE, ISCRITTI, SETTIMANA e il menu) con l'aspetto del sito
pubblico, «tatami blu e giallo» (A2 di `../sito-rebrand/token-proposta.md`). Sono gli stessi valori che
`:root[data-modulo='sito']` in `src/styles.css` usa già per il modulo di iscrizione; non c'è nessun colore
nuovo. Diventano token dell'app solo dopo il sì.

| Uso | Valore |
|---|---|
| Fondo | #eef5fa |
| Tessera | #ffffff |
| Tessera chiara, filo | #cfe6f4 |
| Inchiostro (testo, menu) | #0d2a3d |
| Testo attenuato | #46606f |
| Blu (bordi dei campi e dei tasti a linea) | #14709f |
| Giallo del marchio | #f4c31b |
| Rosso, manca (testo) | #b81d1d |
| Rosso, manca (barra) | #e4292a |
| Verde, fatto (testo) | #0b7a33 |
| Giallo scuro, aspetta (testo e bordo) | #8f6a00 |
| Tinte dei corsi (solo la barra a sinistra) | #1b8ac4 · #16a54a · #f4c31b · #8b5cc4 · #e4292a |

## Il giallo ha due vite separate

- **Giallo pieno `#f4c31b`: è del marchio.** Solo il tasto principale (uno per schermata) e la voce corrente
  del menu. Mai uno stato.
- **«Aspetta, non blocca»** è testo e bordo `#8f6a00` su tessera bianca, mai un riempimento giallo.
- **Rosso** = manca o blocca. **Verde** = fatto. Lo stato si legge sempre a parole con un segno (✕, …, ✓),
  non dal solo colore.

## Caratteri e forme

Big Shoulders Display 800 per titoli e cifre grandi, Inter per tutto il resto (menu, tasti, tabelle, date,
telefoni: le cifre in Inter, perché in Big Shoulders 1 e I si confondono). Raggio 6px, niente bordi da 2px
pieni: la profondità la fanno le tessere bianche sul fondo azzurro. Le maiuscole restano per le etichette
di colonna e di gruppo; voci di menu, tasti e stati sono in minuscolo con l'iniziale maiuscola.
