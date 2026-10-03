---
target: sala
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/Users/nicola/Automation/ods-corsi/.claude/worktrees/impeccable-critique-sala-407a10/src/components/tablet"
timestamp: 2026-10-03T09-04-39Z
slug: src-components-tablet
---
# Critique 2: tablet di sala (src/components/tablet)
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score — 29/40 (Good) · prima 26/40
| # | Euristica | Voto | Problema chiave |
|---|---|---|---|
| 1 | Stato del sistema | 3 | ANNULLA toglie il segno senza dirlo |
| 2 | Mondo reale | 4 | Parole della palestra ovunque |
| 3 | Controllo e libertà | 3 | Uscire dal recupero: 3 INDIETRO |
| 4 | Coerenza | 2 | Verde = corso, invito e fatto; rosso = LAVORO ed errore; nomi in maiuscolo nella fascia |
| 5 | Prevenzione errori | 2 | IMPOSTAZIONI del timer aperte a tutti, cambiano tutti i tablet; PIN in vista della sala |
| 6 | Riconoscimento | 4 | Trova il nome, toccalo; recupero dal corso |
| 7 | Efficienza | 3 | TUTTI PRESENTI, chip SI SEGNA ORA |
| 8 | Estetica | 2 | Verticale rotta (regressione #167, corretta in locale); colonna vuota in orizzontale |
| 9 | Recupero errori | 3 | Messaggi specifici; tentativi PIN rimasti non detti |
| 10 | Aiuto | 3 | Note grigie a 17px poco lette a 2 m |

Detector CLI: 0. Overlay: 2 regole in 7 punti, tutte volute da DESIGN.md tranne .tb-quando (0.10em sul nome dell'istruttore). Timer non scansionato (shadow DOM).

## Priority issues
- [P0] Verticale: .tb-aperta-testo flex 1 1 280px diventa altezza; riquadri sovrapposti alla giornata. Corretto in locale (flex 0 0 auto sotto 900px). → harden
- [P1] IMPOSTAZIONI del timer aperte a chiunque al muro, cambiano tutti i tablet. → harden
- [P1] Verde e rosso con più significati: .tb-invito verde, tessere segnate --verde su surface-2 3,35:1 chiaro, tinta verde dei corsi, LAVORO rosso. → colorize
- [P2] Area istruttore: riquadro presenza in cima, tutto scorre insieme, schede 48px. → layout
- [P2] ANNULLA silenzioso, nessuna chiusura dopo il tocco. → clarify
