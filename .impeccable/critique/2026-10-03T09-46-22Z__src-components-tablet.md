---
target: sala
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/nicola/Automation/ods-corsi/.claude/worktrees/impeccable-critique-sala-407a10/src/components/tablet"
timestamp: 2026-10-03T09-46-22Z
slug: src-components-tablet
---
# Critique 3: tablet di sala (src/components/tablet)
Method: dual-agent (A: design review · B: detector + browser). A ha rifatto il giro su v0.7.5 (5ed1be8); B ha visto per errore una build precedente su :5192 (v0.7.4, senza #174).

## Design Health Score — 29/40 (Good) · 26 → 29 → 29
| # | Euristica | Voto | Problema chiave |
|---|---|---|---|
| 1 | Stato | 3 | Chi l'istruttore ha segnato assente sembra non segnato finché non tocca |
| 2 | Mondo reale | 4 | Parole della palestra |
| 3 | Controllo | 3 | TUTTI PRESENTI / GLI ALTRI ASSENTI senza conferma né annullo |
| 4 | Coerenza | 2 | AVVIA rosso sulla card, giallo nel timer; verde = presente, invito, RECUPERO |
| 5 | Prevenzione | 3 | Azioni di massa non protette |
| 6 | Riconoscimento | 3 | Conti «0 su 10» nel recupero inutili all'iscritto |
| 7 | Efficienza | 3 | Chip SI SEGNA ORA offre solo una lezione |
| 8 | Estetica | 2 | Lezioni aperte due volte; versione ed Esci in vista; centro vuoto |
| 9 | Recupero errori | 3 | Fascia «L'ISTRUTTORE HA GIÀ SEGNATO» neutra, senza segno |
| 10 | Aiuto | 3 | PIN dimenticato: nessun aiuto |

Detector CLI: 0 su tablet/*.tsx. Overlay: header pair + side-tab e tracking pinnati da DESIGN.md (falsi positivi); borderline .tb-quando 0.10em sul nome.

## Priority issues
- [P1] Tema chiaro: tessere segnate e .tb-invito in --verde puro (3,35:1 / 3,7:1). → colorize
- [P1] TUTTI PRESENTI / GLI ALTRI ASSENTI riscrivono l'appello senza conferma né annullo. → harden
- [P2] Gerarchia dell'attesa: SEGNA non è la cosa più grande; lezioni aperte doppie; versione ed Esci pubblici. → layout
- [P2] RECUPERO del timer colora di verde la testata sopra le presenze. → colorize
- [P2] Select PER CORSO alta 28px invece di 56. → polish
