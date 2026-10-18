# Sito · pagine a pezzi: com'è venuto (PR 1 di 3)

Il canvas è la proposta approvata; qui sta quel che il costruito ha cambiato. Dove diverge, vale il costruito.

- **Parti**: FOTO IN CIMA, TESTO, FOTO e COLONNE. DUE COLONNE e TRE COLONNE sono una parte sola, COLONNE, da 2 a 3 (campo
  «COLONNE (da 2 a 3)»). ELENCO DEI CORSI arriva con la PR 2.
- **Barra sopra l'editor** (`Comandi` in `EditorPezzi.tsx`): `+` per ogni parte (si mette dopo quella scelta, o in fondo), ANNULLA,
  RIFAI, SU, GIÙ, TOGLI, tutti da 44px. Servono al tablet, dove trascinare con il dito sbaglia: la tavola 3 del canvas.
- **Sotto i 1280px** il pannello delle parti si nasconde, la pagina sta sopra e i campi sotto, a tutta larghezza (la tavola 3 mostra
  già i campi sotto). Sopra i 1280px i tre pannelli di Puck: parti, pagina, campi.
- **Aspetto**: i colori, i raggi (zero) e il carattere di Puck sono quelli dell'app (`.sito-pezzi` in `src/styles.css`, variabili `--puck-*`
  legate ai token del tema). Le parole di Puck sono in italiano (PARTI, ELENCO, Pagina, Parte…).
- **Parti vuote**: un riquadro tratteggiato alto 44px dice «Testo vuoto», «Colonna 1 vuota», «Foto: scegli la foto». Una colonna vuota
  non esce sul sito.
- **ANTEPRIMA** è la pagina scritta dal generatore (con le tessere), in una cornice senza codice; carattere e logo del sito si vedono solo sul sito vero.
- Non ci sono: il titolo «COME SARÀ SUL SITO» sopra l'anteprima, l'Outline numerata, l'avviso dei dieci minuti (nasce con ELENCO DEI CORSI).
